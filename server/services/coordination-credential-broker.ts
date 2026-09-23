import crypto from 'node:crypto';
import { and, eq, gt, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import {
  COORDINATION_ACTOR_IDS,
  COORDINATION_CREDENTIAL_CAPABILITIES,
  coordinationCredentialAuditEvents,
  coordinationGate3ProofGrants,
  coordinationRuntimeCredentials,
  coordinationRuntimeRegistrations,
  coordinationRuntimeRotations,
  type CoordinationActorId,
  type CoordinationCredentialCapability,
} from '@shared/schema';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { getSharedDb } from '../db';

const actorIds = new Set<string>(COORDINATION_ACTOR_IDS);
const capabilityIds = new Set<string>(COORDINATION_CREDENTIAL_CAPABILITIES);
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 3600;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

type RotationConcurrencyTestPoint =
  | 'stage_snapshot_read'
  | 'ready_before_lock'
  | 'complete_snapshot_read'
  | 'rollback_snapshot_read';
let rotationConcurrencyTestHook: ((point: RotationConcurrencyTestPoint) => Promise<void>) | undefined;

export function setCoordinationCredentialBrokerConcurrencyTestHook(
  hook: ((point: RotationConcurrencyTestPoint) => Promise<void>) | undefined,
): void {
  if (hook && !process.env.COORDINATION_INBOX_DISPOSABLE_BRANCH_ID && !process.env.CI_DATABASE_URL) {
    throw new Error('rotation concurrency test hooks require a disposable database');
  }
  rotationConcurrencyTestHook = hook;
}

export type RuntimeReplacementFailureReason =
  | 'source_runtime_unavailable'
  | 'replacement_runtime_exists'
  | 'replacement_mismatch'
  | 'replacement_not_ready'
  | 'rotation_not_staged'
  | 'runtime_already_rotating';

export type RuntimeReplacementResult<T> =
  | ({ ok: true } & T)
  | { ok: false; reason: RuntimeReplacementFailureReason };

export type BrokerCredential = {
  actor: CoordinationActorId;
  runtimeId: string;
  credentialId: string;
  capabilities: CoordinationCredentialCapability[];
  expiresAt: Date;
  standingVerifier: boolean;
};

type ExchangeBootstrapCredentialTestHooks = {
  afterRegistrationLocked?: () => Promise<void>;
};
export function hashCoordinationSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function consumedCoordinationBootstrapHash(runtimeId: string, bootstrapSha256: string): string {
  return hashCoordinationSecret(`consumed-bootstrap:${runtimeId}:${bootstrapSha256}`);
}

export function generateCoordinationSecret(prefix: 'cb' | 'ct'): string {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

function validCapabilities(values: string[]): values is CoordinationCredentialCapability[] {
  return values.length > 0 && values.every((value) => capabilityIds.has(value));
}

function validateRuntimeRegistrationInput(input: {
  runtimeId: string;
  actor: CoordinationActorId;
  displayName: string;
  capabilities: CoordinationCredentialCapability[];
  tokenTtlSeconds?: number;
}): number {
  if (!input.runtimeId || input.runtimeId.length > 120) throw new Error('runtimeId is invalid');
  if (!actorIds.has(input.actor) || input.actor === 'coordination-system') throw new Error('actor is invalid');
  if (!input.displayName || input.displayName.length > 200) throw new Error('displayName is invalid');
  if (!validCapabilities(input.capabilities)) throw new Error('capabilities are invalid');
  const tokenTtlSeconds = input.tokenTtlSeconds ?? 900;
  if (tokenTtlSeconds < MIN_TTL_SECONDS || tokenTtlSeconds > MAX_TTL_SECONDS) {
    throw new Error(`tokenTtlSeconds must be between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS}`);
  }
  return tokenTtlSeconds;
}

async function audit(input: {
  eventType: string;
  success: boolean;
  runtimeId?: string;
  actor?: string;
  credentialId?: string;
  reason?: string;
  sourceIp?: string;
  metadata?: Record<string, unknown>;
}, executor: ReturnType<typeof getSharedDb> = getSharedDb()): Promise<void> {
  const auditKey = process.env.COORDINATION_AUDIT_HMAC_KEY;
  await executor.insert(coordinationCredentialAuditEvents).values({
    eventType: input.eventType,
    success: input.success,
    runtimeId: input.runtimeId,
    actor: input.actor,
    credentialId: input.credentialId,
    reason: input.reason,
    sourceIpHash: input.sourceIp && auditKey && auditKey.length >= 32
      ? crypto.createHmac('sha256', auditKey).update(input.sourceIp).digest('hex')
      : undefined,
    metadata: input.metadata ?? {},
  });
}

/**
 * Detects a duplicate `id` insert into coordination_runtime_registrations
 * (see shared/schema.ts) -- the natural failure when a human re-runs
 * coordination-runtime-bootstrap.ts with a --runtime-id that is already
 * registered, often after a copy-paste mistake. Walks a possible `.cause`
 * chain since some drivers wrap the underlying driver error, matching
 * isActiveDestinationRace in shared-spec-core.ts.
 */
function isDuplicateRuntimeIdError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
    const value = current as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (value.code === '23505' && value.constraint === 'coordination_runtime_registrations_pkey') {
      return true;
    }
    current = value.cause;
  }
  return false;
}

/**
 * Builds the operator-facing error for a duplicate --runtime-id registration
 * attempt. Runtime IDs are immutable (docs/coordination-clients.md):
 * revokeRuntimeCredentials() only sets enabled=false/revokedAt on the row, it
 * never deletes it, so the exact same id can never be inserted again even
 * after revocation -- a message suggesting "revoke it, then register this id
 * again" would be false and could talk an operator into revoking a live,
 * still-needed runtime for no benefit. Looks up the conflicting row's own
 * state so the guidance matches what stageCoordinationRuntimeReplacement
 * itself will actually accept: rotation only succeeds while the source is
 * still enabled and not revoked (it fails closed with
 * 'source_runtime_unavailable' otherwise).
 */
async function buildDuplicateRuntimeIdError(input: {
  runtimeId: string;
  actor: CoordinationActorId;
  displayName: string;
  capabilities: CoordinationCredentialCapability[];
  tokenTtlSeconds: number;
}): Promise<Error> {
  const [existing] = await getSharedDb()
    .select({ enabled: coordinationRuntimeRegistrations.enabled, revokedAt: coordinationRuntimeRegistrations.revokedAt })
    .from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, input.runtimeId));

  const freshBootstrapCommand = 'npx tsx server/scripts/coordination-runtime-bootstrap.ts --runtime-id <new-id> '
    + `--actor ${input.actor} --display-name "${input.displayName}" `
    + `--capabilities ${input.capabilities.join(',')} --ttl-seconds ${input.tokenTtlSeconds}`;

  const immutabilityNotice = `Runtime "${input.runtimeId}" is already registered. Runtime IDs are immutable: `
    + 'revoking a registration disables it but never deletes the row, so this exact id can never be '
    + 'registered again, even after revocation. Pick a different --runtime-id.';

  if (existing && existing.enabled && !existing.revokedAt) {
    const rotationCommand = 'npx tsx server/scripts/coordination-runtime-rotation.ts stage '
      + `--from-runtime-id ${input.runtimeId} --runtime-id <new-id> --display-name "${input.displayName}"`;
    return new Error(
      `${immutabilityNotice} That registration is still active, so the recommended next step is to stage `
      + 'a rotation, which copies its actor, capabilities, and token TTL onto the new id and then '
      + `retires "${input.runtimeId}" automatically once the replacement is ready:\n${rotationCommand}\n`
      + 'See docs/coordination-clients.md for the full stage/complete flow. To start over instead '
      + `without preserving anything, bootstrap a fresh id directly:\n${freshBootstrapCommand}\nand `
      + `optionally revoke "${input.runtimeId}" afterward if you no longer need it (revoking does not `
      + 'free the id for reuse).',
    );
  }

  return new Error(
    `${immutabilityNotice} That registration is already revoked, so rotation is not available for it `
    + '(coordination-runtime-rotation.ts requires an active source). Bootstrap a new runtime instead:\n'
    + freshBootstrapCommand,
  );
}

export async function registerCoordinationRuntime(input: {
  runtimeId: string;
  actor: CoordinationActorId;
  displayName: string;
  capabilities: CoordinationCredentialCapability[];
  tokenTtlSeconds?: number;
}): Promise<{ bootstrapToken: string }> {
  const tokenTtlSeconds = validateRuntimeRegistrationInput(input);
  const bootstrapToken = generateCoordinationSecret('cb');
  try {
    await getSharedDb().insert(coordinationRuntimeRegistrations).values({
      id: input.runtimeId,
      actor: input.actor,
      displayName: input.displayName,
      bootstrapHash: hashCoordinationSecret(bootstrapToken),
      capabilities: input.capabilities,
      tokenTtlSeconds,
    });
  } catch (error) {
    if (isDuplicateRuntimeIdError(error)) {
      throw await buildDuplicateRuntimeIdError({ ...input, tokenTtlSeconds });
    }
    throw error;
  }
  await audit({ eventType: 'runtime_registered', success: true, runtimeId: input.runtimeId, actor: input.actor });
  return { bootstrapToken };
}

export type PrehashedRuntimeRegistration = {
  runtimeId: string;
  actor: CoordinationActorId;
  displayName: string;
  capabilities: CoordinationCredentialCapability[];
  tokenTtlSeconds: number;
  status: 'created' | 'replayed';
};

/**
 * Registers a runtime from a trusted operator-side SHA-256 verifier.
 * This deliberately has no HTTP exposure: callers must already have validated
 * the public provisioning bundle and must never pass the plaintext bootstrap.
 */
export async function registerCoordinationRuntimeWithBootstrapSha256InExecutor(input: {
  runtimeId: string;
  actor: CoordinationActorId;
  displayName: string;
  capabilities: CoordinationCredentialCapability[];
  tokenTtlSeconds?: number;
  bootstrapSha256: string;
}, executor: ReturnType<typeof getSharedDb>): Promise<PrehashedRuntimeRegistration> {
  const tokenTtlSeconds = validateRuntimeRegistrationInput(input);
  if (!SHA256_HEX_PATTERN.test(input.bootstrapSha256)) {
    throw new Error('bootstrapSha256 must be lowercase hexadecimal SHA-256');
  }

  const result = await (async (tx: ReturnType<typeof getSharedDb>) => {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${input.runtimeId}, 0))
    `);
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${input.bootstrapSha256}, 0))
    `);
    const [existing] = await tx.select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, input.runtimeId))
      .for('update');
    if (existing) {
      const compatible = existing.actor === input.actor
        && existing.displayName === input.displayName
        && sameStringArray(existing.capabilities, input.capabilities)
        && existing.tokenTtlSeconds === tokenTtlSeconds
        && existing.bootstrapHash === input.bootstrapSha256
        && existing.enabled
        && !existing.revokedAt;
      if (compatible) {
        await audit({
          eventType: 'runtime_registration_replayed',
          success: true,
          runtimeId: input.runtimeId,
          actor: input.actor,
          metadata: { status: 'compatible_retry' },
        }, executor);
        return { ...input, tokenTtlSeconds, status: 'replayed' as const };
      }
      return { conflict: true as const };
    }
    const [sameDigest] = await tx.select({ id: coordinationRuntimeRegistrations.id })
      .from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.bootstrapHash, input.bootstrapSha256))
      .limit(1);
    if (sameDigest) return { conflict: true as const };

    await tx.insert(coordinationRuntimeRegistrations).values({
      id: input.runtimeId,
      actor: input.actor,
      displayName: input.displayName,
      bootstrapHash: input.bootstrapSha256,
      capabilities: input.capabilities,
      tokenTtlSeconds,
    });
    await audit({
      eventType: 'runtime_registered',
      success: true,
      runtimeId: input.runtimeId,
      actor: input.actor,
      metadata: { registrationMode: 'trusted_prehashed' },
    }, executor);
    return { ...input, tokenTtlSeconds, status: 'created' as const };
  })(executor);
  if ('conflict' in result) {
    throw new Error('runtime registration conflicts with an existing record');
  }
  return {
    runtimeId: result.runtimeId,
    actor: result.actor,
    displayName: result.displayName,
    capabilities: result.capabilities,
    tokenTtlSeconds: result.tokenTtlSeconds,
    status: result.status,
  };
}

export async function registerCoordinationRuntimeWithBootstrapSha256(input: {
  runtimeId: string;
  actor: CoordinationActorId;
  displayName: string;
  capabilities: CoordinationCredentialCapability[];
  tokenTtlSeconds?: number;
  bootstrapSha256: string;
}): Promise<PrehashedRuntimeRegistration> {
  try {
    return await getSharedDb().transaction(async (tx) =>
      registerCoordinationRuntimeWithBootstrapSha256InExecutor(
        input,
        tx as unknown as ReturnType<typeof getSharedDb>,
      ));
  } catch (error) {
    await audit({
      eventType: 'runtime_registration_rejected',
      success: false,
      runtimeId: input.runtimeId,
      actor: input.actor,
      reason: error instanceof Error && error.message.includes('lowercase hexadecimal')
        ? 'invalid_bootstrap_digest'
        : 'conflicting_registration',
      metadata: { registrationMode: 'trusted_prehashed' },
    });
    throw error;
  }
}

// Descriptive compatibility alias for trusted operator callers.
export const registerCoordinationRuntimeWithBootstrapHash =
  registerCoordinationRuntimeWithBootstrapSha256;

export type BootstrapReissueFailureReason = 'runtime_not_found' | 'runtime_disabled_or_revoked';
function sameStringArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function lockRuntimePair(
  executor: ReturnType<typeof getSharedDb>,
  firstRuntimeId: string,
  secondRuntimeId: string,
): Promise<void> {
  const [first, second] = [firstRuntimeId, secondRuntimeId].sort();
  await executor.execute(sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${first}, 0))
  `);
  await executor.execute(sql`
    SELECT pg_advisory_xact_lock(hashtextextended(${second}, 0))
  `);
  await executor.execute(sql`
    SELECT id FROM coordination_runtime_registrations
    WHERE id IN (${first}, ${second})
    ORDER BY id
    FOR UPDATE
  `);
}

export async function stageCoordinationRuntimeReplacement(input: {
  sourceRuntimeId: string;
  replacementRuntimeId: string;
  replacementDisplayName: string;
}): Promise<RuntimeReplacementResult<{
  bootstrapToken: string;
  actor: CoordinationActorId;
  capabilities: CoordinationCredentialCapability[];
  tokenTtlSeconds: number;
  rotationId: string;
}>> {
  if (!input.replacementRuntimeId || input.replacementRuntimeId.length > 120) {
    throw new Error('replacementRuntimeId is invalid');
  }
  if (!input.replacementDisplayName || input.replacementDisplayName.length > 200) {
    throw new Error('replacementDisplayName is invalid');
  }
  if (input.sourceRuntimeId === input.replacementRuntimeId) {
    throw new Error('replacementRuntimeId must differ from sourceRuntimeId');
  }

  return getSharedDb().transaction(async (tx) => {
    const executor = tx as unknown as ReturnType<typeof getSharedDb>;
    await lockRuntimePair(executor, input.sourceRuntimeId, input.replacementRuntimeId);
    const registrations = await tx.select().from(coordinationRuntimeRegistrations)
      .where(inArray(coordinationRuntimeRegistrations.id, [
        input.sourceRuntimeId,
        input.replacementRuntimeId,
      ]));
    const source = registrations.find((row) => row.id === input.sourceRuntimeId);
    const replacement = registrations.find((row) => row.id === input.replacementRuntimeId);

    if (!source?.enabled || source.revokedAt || !actorIds.has(source.actor) || !validCapabilities(source.capabilities)) {
      await audit({
        eventType: 'rotation_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: source?.actor,
        reason: 'source_runtime_unavailable',
        metadata: { replacementRuntimeId: input.replacementRuntimeId },
      }, executor);
      return { ok: false, reason: 'source_runtime_unavailable' };
    }
    if (replacement) {
      await audit({
        eventType: 'rotation_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: source.actor,
        reason: 'replacement_runtime_exists',
        metadata: { replacementRuntimeId: input.replacementRuntimeId },
      }, executor);
      return { ok: false, reason: 'replacement_runtime_exists' };
    }
    const [activeRotation] = await tx.select({ id: coordinationRuntimeRotations.id })
      .from(coordinationRuntimeRotations)
      .where(and(
        inArray(coordinationRuntimeRotations.state, ['staged', 'ready']),
        or(
          inArray(coordinationRuntimeRotations.sourceRuntimeId, [
            input.sourceRuntimeId,
            input.replacementRuntimeId,
          ]),
          inArray(coordinationRuntimeRotations.replacementRuntimeId, [
            input.sourceRuntimeId,
            input.replacementRuntimeId,
          ]),
        ),
      ))
      .limit(1);
    await rotationConcurrencyTestHook?.('stage_snapshot_read');
    if (activeRotation) {
      await audit({
        eventType: 'rotation_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: source.actor,
        reason: 'runtime_already_rotating',
        metadata: {
          replacementRuntimeId: input.replacementRuntimeId,
          conflictingRotationId: activeRotation.id,
        },
      }, executor);
      return { ok: false, reason: 'runtime_already_rotating' };
    }

    const bootstrapToken = generateCoordinationSecret('cb');
    await tx.insert(coordinationRuntimeRegistrations).values({
      id: input.replacementRuntimeId,
      actor: source.actor,
      displayName: input.replacementDisplayName,
      bootstrapHash: hashCoordinationSecret(bootstrapToken),
      capabilities: source.capabilities,
      tokenTtlSeconds: source.tokenTtlSeconds,
    });
    const [rotation] = await tx.insert(coordinationRuntimeRotations).values({
      sourceRuntimeId: input.sourceRuntimeId,
      replacementRuntimeId: input.replacementRuntimeId,
      actor: source.actor,
      capabilities: source.capabilities,
      tokenTtlSeconds: source.tokenTtlSeconds,
    }).returning({ id: coordinationRuntimeRotations.id });
    await audit({
      eventType: 'rotation_started',
      success: true,
      runtimeId: input.sourceRuntimeId,
      actor: source.actor,
      metadata: {
        replacementRuntimeId: input.replacementRuntimeId,
        rotationId: rotation.id,
        capabilities: source.capabilities,
        tokenTtlSeconds: source.tokenTtlSeconds,
      },
    }, executor);
    return {
      ok: true,
      bootstrapToken,
      actor: source.actor as CoordinationActorId,
      capabilities: source.capabilities as CoordinationCredentialCapability[],
      tokenTtlSeconds: source.tokenTtlSeconds,
      rotationId: rotation.id,
    };
  });
}

async function getReplacementPair(
  executor: ReturnType<typeof getSharedDb>,
  sourceRuntimeId: string,
  replacementRuntimeId: string,
): Promise<{
  source?: typeof coordinationRuntimeRegistrations.$inferSelect;
  replacement?: typeof coordinationRuntimeRegistrations.$inferSelect;
  rotation?: typeof coordinationRuntimeRotations.$inferSelect;
}> {
  const registrations = await executor.select().from(coordinationRuntimeRegistrations)
    .where(inArray(coordinationRuntimeRegistrations.id, [sourceRuntimeId, replacementRuntimeId]));
  const [rotation] = await executor.select().from(coordinationRuntimeRotations)
    .where(and(
      eq(coordinationRuntimeRotations.sourceRuntimeId, sourceRuntimeId),
      eq(coordinationRuntimeRotations.replacementRuntimeId, replacementRuntimeId),
      inArray(coordinationRuntimeRotations.state, ['staged', 'ready']),
    ))
    .limit(1);
  return {
    source: registrations.find((row) => row.id === sourceRuntimeId),
    replacement: registrations.find((row) => row.id === replacementRuntimeId),
    rotation,
  };
}

function validReplacementPair(
  source: typeof coordinationRuntimeRegistrations.$inferSelect | undefined,
  replacement: typeof coordinationRuntimeRegistrations.$inferSelect | undefined,
  rotation: typeof coordinationRuntimeRotations.$inferSelect | undefined,
): boolean {
  return Boolean(
    source?.enabled
    && !source.revokedAt
    && replacement?.enabled
    && !replacement.revokedAt
    && source.actor === replacement.actor
    && source.tokenTtlSeconds === replacement.tokenTtlSeconds
    && sameStringArray(source.capabilities, replacement.capabilities)
    && rotation
    && rotation.actor === source.actor
    && rotation.tokenTtlSeconds === source.tokenTtlSeconds
    && sameStringArray(rotation.capabilities, source.capabilities)
  );
}

function matchesRotationSnapshot(
  source: typeof coordinationRuntimeRegistrations.$inferSelect | undefined,
  replacement: typeof coordinationRuntimeRegistrations.$inferSelect | undefined,
  rotation: typeof coordinationRuntimeRotations.$inferSelect | undefined,
): boolean {
  return Boolean(
    source
    && replacement
    && rotation
    && source.actor === replacement.actor
    && source.actor === rotation.actor
    && source.tokenTtlSeconds === replacement.tokenTtlSeconds
    && source.tokenTtlSeconds === rotation.tokenTtlSeconds
    && sameStringArray(source.capabilities, replacement.capabilities)
    && sameStringArray(source.capabilities, rotation.capabilities)
  );
}

export async function markCoordinationRuntimeReplacementReady(input: {
  sourceRuntimeId: string;
  credential: BrokerCredential;
  sourceIp?: string;
}): Promise<RuntimeReplacementResult<{ rotationId: string }>> {
  await rotationConcurrencyTestHook?.('ready_before_lock');
  return getSharedDb().transaction(async (tx) => {
    const executor = tx as unknown as ReturnType<typeof getSharedDb>;
    await lockRuntimePair(executor, input.sourceRuntimeId, input.credential.runtimeId);
    const { source, replacement, rotation } = await getReplacementPair(
      executor,
      input.sourceRuntimeId,
      input.credential.runtimeId,
    );
    if (!validReplacementPair(source, replacement, rotation) || rotation?.state !== 'staged') {
      await audit({
        eventType: 'rotation_ready_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: input.credential.actor,
        credentialId: input.credential.credentialId,
        reason: 'rotation_not_staged',
        sourceIp: input.sourceIp,
        metadata: { replacementRuntimeId: input.credential.runtimeId },
      }, executor);
      return { ok: false, reason: 'rotation_not_staged' };
    }
    if (
      input.credential.actor !== rotation.actor
      || !sameStringArray(input.credential.capabilities, rotation.capabilities)
      || input.credential.expiresAt <= new Date()
    ) {
      await audit({
        eventType: 'rotation_ready_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: input.credential.actor,
        credentialId: input.credential.credentialId,
        reason: 'replacement_mismatch',
        sourceIp: input.sourceIp,
        metadata: { replacementRuntimeId: input.credential.runtimeId, rotationId: rotation.id },
      }, executor);
      return { ok: false, reason: 'replacement_mismatch' };
    }
    const [activeCredential] = await tx.select({ id: coordinationRuntimeCredentials.id })
      .from(coordinationRuntimeCredentials)
      .where(and(
        eq(coordinationRuntimeCredentials.id, input.credential.credentialId),
        eq(coordinationRuntimeCredentials.runtimeId, input.credential.runtimeId),
        eq(coordinationRuntimeCredentials.actor, input.credential.actor),
        isNull(coordinationRuntimeCredentials.revokedAt),
        gt(coordinationRuntimeCredentials.expiresAt, new Date()),
      ))
      .limit(1);
    if (!activeCredential) {
      await audit({
        eventType: 'rotation_ready_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: input.credential.actor,
        credentialId: input.credential.credentialId,
        reason: 'replacement_mismatch',
        sourceIp: input.sourceIp,
        metadata: { replacementRuntimeId: input.credential.runtimeId, rotationId: rotation.id },
      }, executor);
      return { ok: false, reason: 'replacement_mismatch' };
    }
    const now = new Date();
    const [marked] = await tx.update(coordinationRuntimeRotations).set({
      state: 'ready',
      readyAt: now,
      readyCredentialId: input.credential.credentialId,
    }).where(and(
      eq(coordinationRuntimeRotations.id, rotation.id),
      eq(coordinationRuntimeRotations.state, 'staged'),
    )).returning({ id: coordinationRuntimeRotations.id });
    if (!marked) {
      await audit({
        eventType: 'rotation_ready_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: input.credential.actor,
        credentialId: input.credential.credentialId,
        reason: 'rotation_not_staged',
        sourceIp: input.sourceIp,
        metadata: { replacementRuntimeId: input.credential.runtimeId, rotationId: rotation.id },
      }, executor);
      return { ok: false, reason: 'rotation_not_staged' };
    }
    await audit({
      eventType: 'rotation_ready',
      success: true,
      runtimeId: input.sourceRuntimeId,
      actor: rotation.actor,
      credentialId: input.credential.credentialId,
      sourceIp: input.sourceIp,
      metadata: { replacementRuntimeId: input.credential.runtimeId, rotationId: rotation.id },
    }, executor);
    return { ok: true, rotationId: rotation.id };
  });
}

export async function completeCoordinationRuntimeReplacement(input: {
  sourceRuntimeId: string;
  replacementRuntimeId: string;
}): Promise<RuntimeReplacementResult<{ actor: CoordinationActorId }>> {
  return getSharedDb().transaction(async (tx) => {
    const executor = tx as unknown as ReturnType<typeof getSharedDb>;
    await lockRuntimePair(executor, input.sourceRuntimeId, input.replacementRuntimeId);
    const { source, replacement, rotation } = await getReplacementPair(
      executor,
      input.sourceRuntimeId,
      input.replacementRuntimeId,
    );
    await rotationConcurrencyTestHook?.('complete_snapshot_read');
    if (!rotation || !validReplacementPair(source, replacement, rotation)) {
      await audit({
        eventType: 'rotation_completion_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: source?.actor,
        reason: 'replacement_mismatch',
        metadata: { replacementRuntimeId: input.replacementRuntimeId },
      }, executor);
      return { ok: false, reason: 'replacement_mismatch' };
    }

    if (rotation?.state !== 'ready' || !rotation.readyCredentialId) {
      await audit({
        eventType: 'rotation_completion_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: source!.actor,
        reason: 'replacement_not_ready',
        metadata: { replacementRuntimeId: input.replacementRuntimeId, rotationId: rotation?.id },
      }, executor);
      return { ok: false, reason: 'replacement_not_ready' };
    }

    const now = new Date();
    await tx.update(coordinationRuntimeRegistrations)
      .set({ enabled: false, revokedAt: now, updatedAt: now })
      .where(eq(coordinationRuntimeRegistrations.id, input.sourceRuntimeId));
    await tx.update(coordinationRuntimeCredentials)
      .set({ revokedAt: now })
      .where(and(
        eq(coordinationRuntimeCredentials.runtimeId, input.sourceRuntimeId),
        isNull(coordinationRuntimeCredentials.revokedAt),
      ));
    await tx.update(coordinationRuntimeRotations).set({
      state: 'completed',
      completedAt: now,
    }).where(and(
      eq(coordinationRuntimeRotations.id, rotation.id),
      eq(coordinationRuntimeRotations.state, 'ready'),
    ));
    await audit({
      eventType: 'rotation_completed',
      success: true,
      runtimeId: input.sourceRuntimeId,
      actor: source!.actor,
      credentialId: rotation.readyCredentialId,
      metadata: { replacementRuntimeId: input.replacementRuntimeId, rotationId: rotation.id },
    }, executor);
    return { ok: true, actor: source!.actor as CoordinationActorId };
  });
}

export async function rollbackCoordinationRuntimeReplacement(input: {
  sourceRuntimeId: string;
  replacementRuntimeId: string;
}): Promise<RuntimeReplacementResult<{ actor: CoordinationActorId; sourceActive: boolean }>> {
  return getSharedDb().transaction(async (tx) => {
    const executor = tx as unknown as ReturnType<typeof getSharedDb>;
    await lockRuntimePair(executor, input.sourceRuntimeId, input.replacementRuntimeId);
    const { source, replacement, rotation } = await getReplacementPair(
      executor,
      input.sourceRuntimeId,
      input.replacementRuntimeId,
    );
    await rotationConcurrencyTestHook?.('rollback_snapshot_read');
    if (!rotation || !matchesRotationSnapshot(source, replacement, rotation)) {
      await audit({
        eventType: 'rotation_rollback_failed',
        success: false,
        runtimeId: input.sourceRuntimeId,
        actor: source?.actor,
        reason: 'replacement_mismatch',
        metadata: { replacementRuntimeId: input.replacementRuntimeId },
      }, executor);
      return { ok: false, reason: 'replacement_mismatch' };
    }

    const now = new Date();
    await tx.update(coordinationRuntimeRegistrations)
      .set({ enabled: false, revokedAt: now, updatedAt: now })
      .where(eq(coordinationRuntimeRegistrations.id, input.replacementRuntimeId));
    await tx.update(coordinationRuntimeCredentials)
      .set({ revokedAt: now })
      .where(and(
        eq(coordinationRuntimeCredentials.runtimeId, input.replacementRuntimeId),
        isNull(coordinationRuntimeCredentials.revokedAt),
      ));
    await tx.update(coordinationRuntimeRotations).set({
      state: 'rolled_back',
      rolledBackAt: now,
    }).where(and(
      eq(coordinationRuntimeRotations.id, rotation.id),
      inArray(coordinationRuntimeRotations.state, ['staged', 'ready']),
    ));
    await audit({
      eventType: 'rotation_rolled_back',
      success: true,
      runtimeId: input.sourceRuntimeId,
      actor: source!.actor,
      metadata: {
        replacementRuntimeId: input.replacementRuntimeId,
        rotationId: rotation.id,
        sourceActive: Boolean(source!.enabled && !source!.revokedAt),
      },
    }, executor);
    return {
      ok: true,
      actor: source!.actor as CoordinationActorId,
      sourceActive: Boolean(source!.enabled && !source!.revokedAt),
    };
  });
}

async function issueForRegistration(
  registration: typeof coordinationRuntimeRegistrations.$inferSelect,
  eventType: 'issued' | 'renewed',
  sourceIp?: string,
  renewedFromCredentialId?: string,
  executor: ReturnType<typeof getSharedDb> = getSharedDb(),
): Promise<{ accessToken: string; credential: BrokerCredential }> {
  const accessToken = generateCoordinationSecret('ct');
  const expiresAt = new Date(Date.now() + registration.tokenTtlSeconds * 1000);
  const [row] = await executor.insert(coordinationRuntimeCredentials).values({
    runtimeId: registration.id,
    actor: registration.actor,
    tokenHash: hashCoordinationSecret(accessToken),
    capabilities: registration.capabilities,
    expiresAt,
    renewedFromCredentialId,
  }).returning();
  await audit({
    eventType,
    success: true,
    runtimeId: registration.id,
    actor: registration.actor,
    credentialId: row.id,
    sourceIp,
  }, executor);
  return {
    accessToken,
    credential: {
      actor: registration.actor as CoordinationActorId,
      runtimeId: registration.id,
      credentialId: row.id,
      capabilities: registration.capabilities as CoordinationCredentialCapability[],
      expiresAt,
      standingVerifier: registration.standingVerifier,
    },
  };
}

export async function exchangeBootstrapCredential(
  runtimeId: string,
  bootstrapToken: string | undefined,
  sourceIp?: string,
  testHooks?: ExchangeBootstrapCredentialTestHooks,
): Promise<{ accessToken: string; credential: BrokerCredential } | null> {
  if (testHooks && !getVerifiedCiDatabaseUrl()) {
    throw new Error('credential broker test hooks require a verified disposable CI database');
  }
  return getSharedDb().transaction(async (tx) => {
    const bootstrapSha256 = bootstrapToken
      ? hashCoordinationSecret(bootstrapToken)
      : hashCoordinationSecret('missing-bootstrap');
    const consumedHash = consumedCoordinationBootstrapHash(runtimeId, bootstrapSha256);
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${runtimeId}, 0))
    `);
    for (const digest of [bootstrapSha256, consumedHash].sort()) {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(hashtextextended(${digest}, 0))
      `);
    }
    await tx.execute(sql`
      SELECT id FROM coordination_runtime_registrations
      WHERE id = ${runtimeId}
      FOR UPDATE
    `);
    const [registration] = await tx.select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, runtimeId));
    await testHooks?.afterRegistrationLocked?.();
    const valid = Boolean(
      registration?.enabled
      && !registration.revokedAt
      && bootstrapToken
      && crypto.timingSafeEqual(
         Buffer.from(bootstrapSha256),
        Buffer.from(registration.bootstrapHash),
      ),
    );
    if (!registration || !valid || !validCapabilities(registration.capabilities)) {
      await audit({
        eventType: 'exchange_failed',
        success: false,
        runtimeId,
        actor: registration?.actor,
        reason: registration ? 'invalid_bootstrap' : 'unknown_runtime',
        sourceIp,
      }, tx as unknown as ReturnType<typeof getSharedDb>);
      return null;
    }
    const [tombstoneOwner] = await tx.select({ id: coordinationRuntimeRegistrations.id })
      .from(coordinationRuntimeRegistrations)
      .where(and(
        eq(coordinationRuntimeRegistrations.bootstrapHash, consumedHash),
        ne(coordinationRuntimeRegistrations.id, runtimeId),
      ))
      .limit(1);
    if (tombstoneOwner) {
      await audit({
        eventType: 'exchange_failed',
        success: false,
        runtimeId,
        actor: registration.actor,
        reason: 'consumed_bootstrap_digest_conflict',
        sourceIp,
      }, tx as unknown as ReturnType<typeof getSharedDb>);
      return null;
    }
    const [consumed] = await tx.update(coordinationRuntimeRegistrations).set({
      bootstrapHash: consumedHash,
      updatedAt: new Date(),
    }).where(and(
      eq(coordinationRuntimeRegistrations.id, runtimeId),
      eq(coordinationRuntimeRegistrations.bootstrapHash, registration.bootstrapHash),
      eq(coordinationRuntimeRegistrations.enabled, true),
      isNull(coordinationRuntimeRegistrations.revokedAt),
    )).returning({ id: coordinationRuntimeRegistrations.id });
    if (!consumed) {
      await audit({
        eventType: 'exchange_failed',
        success: false,
        runtimeId,
        actor: registration.actor,
        reason: 'bootstrap_already_consumed',
        sourceIp,
      }, tx as unknown as ReturnType<typeof getSharedDb>);
      return null;
    }
    await audit({
      eventType: 'runtime_bootstrap_consumed',
      success: true,
      runtimeId,
      actor: registration.actor,
      sourceIp,
      metadata: {
        approvedBootstrapSha256: bootstrapSha256,
        consumedBootstrapSha256: consumedHash,
      },
    }, tx as unknown as ReturnType<typeof getSharedDb>);
    return issueForRegistration(
      registration,
      'issued',
      sourceIp,
      undefined,
      tx as unknown as ReturnType<typeof getSharedDb>,
    );
  });
}

export async function resolveBrokerCredential(
  accessToken: string,
  sourceIp?: string,
): Promise<BrokerCredential | null> {
  const tokenHash = hashCoordinationSecret(accessToken);
  const [row] = await getSharedDb().select({
    credential: coordinationRuntimeCredentials,
    runtimeEnabled: coordinationRuntimeRegistrations.enabled,
    runtimeRevokedAt: coordinationRuntimeRegistrations.revokedAt,
    standingVerifier: coordinationRuntimeRegistrations.standingVerifier,
  }).from(coordinationRuntimeCredentials)
    .innerJoin(
      coordinationRuntimeRegistrations,
      eq(coordinationRuntimeCredentials.runtimeId, coordinationRuntimeRegistrations.id),
    )
    .where(eq(coordinationRuntimeCredentials.tokenHash, tokenHash));
  const stored = row?.credential;
  if (!stored || !actorIds.has(stored.actor) || !validCapabilities(stored.capabilities)) {
    await audit({ eventType: 'access_failed', success: false, reason: 'invalid_token', sourceIp });
    return null;
  }
  if (!row.runtimeEnabled || row.runtimeRevokedAt || stored.revokedAt || stored.expiresAt <= new Date()) {
    await audit({
      eventType: row.runtimeRevokedAt || stored.revokedAt ? 'access_failed' : 'expired',
      success: false,
      runtimeId: stored.runtimeId,
      actor: stored.actor,
      credentialId: stored.id,
      reason: row.runtimeRevokedAt || stored.revokedAt ? 'revoked' : 'expired',
      sourceIp,
    });
    return null;
  }
  await getSharedDb().update(coordinationRuntimeCredentials)
    .set({ lastUsedAt: new Date() })
    .where(eq(coordinationRuntimeCredentials.id, stored.id));
  return {
    actor: stored.actor as CoordinationActorId,
    runtimeId: stored.runtimeId,
    credentialId: stored.id,
    capabilities: stored.capabilities,
    expiresAt: stored.expiresAt,
    standingVerifier: row.standingVerifier,
  };
}

export async function auditBrokerAccessDenied(
  credential: BrokerCredential,
  capability: string,
  sourceIp?: string,
): Promise<void> {
  await audit({
    eventType: 'access_failed',
    success: false,
    runtimeId: credential.runtimeId,
    actor: credential.actor,
    credentialId: credential.credentialId,
    reason: 'insufficient_capability',
    sourceIp,
    metadata: { requiredCapability: capability },
  });
}

export async function renewBrokerCredential(
  credential: BrokerCredential,
  sourceIp?: string,
): Promise<{ accessToken: string; credential: BrokerCredential } | null> {
  return getSharedDb().transaction(async (tx) => {
    await tx.execute(sql`
      SELECT pg_advisory_xact_lock(
        hashtextextended(${'gate3-credential:' + credential.credentialId}, 0)
      )
    `);
    await tx.execute(sql`
      SELECT id FROM coordination_runtime_registrations
      WHERE id = ${credential.runtimeId}
      FOR UPDATE
    `);
    const [registration] = await tx.select().from(coordinationRuntimeRegistrations)
      .where(and(
        eq(coordinationRuntimeRegistrations.id, credential.runtimeId),
        eq(coordinationRuntimeRegistrations.enabled, true),
        isNull(coordinationRuntimeRegistrations.revokedAt),
      ));
    const [activeGate3Grant] = await tx.select({ id: coordinationGate3ProofGrants.id })
      .from(coordinationGate3ProofGrants)
      .where(and(
        eq(coordinationGate3ProofGrants.credentialId, credential.credentialId),
        isNull(coordinationGate3ProofGrants.revokedAt),
        gt(coordinationGate3ProofGrants.expiresAt, new Date()),
      ))
      .limit(1);
    if (activeGate3Grant) {
      await audit({
        eventType: 'renewal_failed',
        success: false,
        ...credential,
        reason: 'gate3_grant_active',
        sourceIp,
      }, tx as unknown as ReturnType<typeof getSharedDb>);
      return null;
    }
    const [won] = await tx.update(coordinationRuntimeCredentials)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(coordinationRuntimeCredentials.id, credential.credentialId),
        isNull(coordinationRuntimeCredentials.revokedAt),
        gt(coordinationRuntimeCredentials.expiresAt, new Date()),
      ))
      .returning({ id: coordinationRuntimeCredentials.id });
    if (!registration || !won) {
      await audit({
        eventType: 'renewal_failed',
        success: false,
        ...credential,
        reason: registration ? 'already_renewed_expired_or_revoked' : 'runtime_revoked',
        sourceIp,
      }, tx as unknown as ReturnType<typeof getSharedDb>);
      return null;
    }
    return issueForRegistration(
      registration,
      'renewed',
      sourceIp,
      credential.credentialId,
      tx as unknown as ReturnType<typeof getSharedDb>,
    );
  });
}

export async function revokeBrokerCredential(credential: BrokerCredential, sourceIp?: string): Promise<void> {
  await getSharedDb().update(coordinationRuntimeCredentials)
    .set({ revokedAt: new Date() })
    .where(eq(coordinationRuntimeCredentials.id, credential.credentialId));
  await audit({ eventType: 'revoked', success: true, ...credential, sourceIp });
}

export async function revokeRuntimeCredentials(runtimeId: string, actor: CoordinationActorId, sourceIp?: string): Promise<boolean> {
  return getSharedDb().transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id FROM coordination_runtime_registrations
      WHERE id = ${runtimeId}
      FOR UPDATE
    `);
    const [registration] = await tx.select().from(coordinationRuntimeRegistrations)
      .where(and(
        eq(coordinationRuntimeRegistrations.id, runtimeId),
        eq(coordinationRuntimeRegistrations.actor, actor),
      ));
    if (!registration) {
      await audit({
        eventType: 'revocation_failed',
        success: false,
        runtimeId,
        actor,
        reason: 'actor_mismatch_or_unknown',
        sourceIp,
      }, tx as unknown as ReturnType<typeof getSharedDb>);
      return false;
    }
    await tx.update(coordinationRuntimeRegistrations)
      .set({ enabled: false, revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(coordinationRuntimeRegistrations.id, runtimeId));
    await tx.update(coordinationRuntimeCredentials)
      .set({ revokedAt: new Date() })
      .where(and(
        eq(coordinationRuntimeCredentials.runtimeId, runtimeId),
        isNull(coordinationRuntimeCredentials.revokedAt),
      ));
    await audit(
      { eventType: 'runtime_revoked', success: true, runtimeId, actor, sourceIp },
      tx as unknown as ReturnType<typeof getSharedDb>,
    );
    return true;
  });
}

const STANDING_VERIFIER_ACTORS = new Set<CoordinationActorId>(['luca-replit', 'luca-claude-code']);

/**
 * The only supported way to mark a registration eligible to verify other
 * runtimes' completed work (coordination-runtime.ts's verify() rejects any
 * verifier lacking this flag with `verifier_registration_not_standing`).
 *
 * This is deliberately an operator action, not something any provisioning
 * flow calls for itself: prepare-antigravity-provisioning.ts and
 * antigravity-provisioning-bundle.ts mint per-task executor credentials and
 * must never reach this function. Restricting `actor` to the two approved
 * verifier identities keeps a `luca-gemini` (or any other) registration from
 * ever being designated, even by operator error.
 */
export async function designateStandingCoordinationVerifier(
  runtimeId: string,
  actor: CoordinationActorId,
  sourceIp?: string,
): Promise<boolean> {
  if (!STANDING_VERIFIER_ACTORS.has(actor)) {
    await audit({
      eventType: 'standing_verifier_designation_failed',
      success: false,
      runtimeId,
      actor,
      reason: 'actor_not_eligible_for_verification',
      sourceIp,
    });
    return false;
  }
  return getSharedDb().transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id FROM coordination_runtime_registrations
      WHERE id = ${runtimeId}
      FOR UPDATE
    `);
    const [registration] = await tx.select().from(coordinationRuntimeRegistrations)
      .where(and(
        eq(coordinationRuntimeRegistrations.id, runtimeId),
        eq(coordinationRuntimeRegistrations.actor, actor),
        eq(coordinationRuntimeRegistrations.enabled, true),
        isNull(coordinationRuntimeRegistrations.revokedAt),
      ));
    if (!registration) {
      await audit({
        eventType: 'standing_verifier_designation_failed',
        success: false,
        runtimeId,
        actor,
        reason: 'actor_mismatch_unknown_or_disabled',
        sourceIp,
      }, tx as unknown as ReturnType<typeof getSharedDb>);
      return false;
    }
    await tx.update(coordinationRuntimeRegistrations)
      .set({
        standingVerifier: true,
        standingVerifierDesignatedAt: new Date(),
        standingVerifierDesignatedBy: actor,
        updatedAt: new Date(),
      })
      .where(eq(coordinationRuntimeRegistrations.id, runtimeId));
    await audit(
      { eventType: 'standing_verifier_designated', success: true, runtimeId, actor, sourceIp },
      tx as unknown as ReturnType<typeof getSharedDb>,
    );
    return true;
  });
}

export async function auditMissingBootstrapAttempt(runtimeId: string | undefined, sourceIp?: string): Promise<void> {
  await audit({
    eventType: 'exchange_failed',
    success: false,
    runtimeId,
    reason: 'missing_runtime_or_bootstrap',
    sourceIp,
  });
}

/**
 * Issues a brand new one-time bootstrap for an EXISTING, still-enabled runtime
 * registration. The runtime ID, actor, display name, capabilities, and token
 * TTL are all left exactly as they are -- only the bootstrap secret changes.
 *
 * This is the fast recovery path for a runtime whose bootstrap was already
 * consumed (see exchangeBootstrapCredential) or otherwise lost, and which has
 * no live credential worth protecting with a full
 * stage/markReady/completeCoordinationRuntimeReplacement rotation. It never
 * reads, revokes, or otherwise touches any credential the registration has
 * already issued: a process that is still alive and renewing normally keeps
 * working exactly as before. Pair this with revokeRuntimeCredentials if a
 * suspected-duplicate or compromised process must also be forced out.
 *
 * Use stageCoordinationRuntimeReplacement instead when the registration's
 * current credential is live and must keep serving traffic without
 * interruption during the changeover, or when the runtime's identity itself
 * needs to change.
 */
export async function reissueCoordinationRuntimeBootstrap(
  runtimeId: string,
  sourceIp?: string,
): Promise<BootstrapReissueResult> {
  return getSharedDb().transaction(async (tx) => {
    const executor = tx as unknown as ReturnType<typeof getSharedDb>;
    await tx.execute(sql`
      SELECT id FROM coordination_runtime_registrations
      WHERE id = ${runtimeId}
      FOR UPDATE
    `);
    const [registration] = await tx.select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, runtimeId));
    if (!registration) {
      await audit({
        eventType: 'bootstrap_reissue_failed',
        success: false,
        runtimeId,
        reason: 'runtime_not_found',
        sourceIp,
      }, executor);
      return { ok: false, reason: 'runtime_not_found' };
    }
    if (!registration.enabled || registration.revokedAt) {
      await audit({
        eventType: 'bootstrap_reissue_failed',
        success: false,
        runtimeId,
        actor: registration.actor,
        reason: 'runtime_disabled_or_revoked',
        sourceIp,
      }, executor);
      return { ok: false, reason: 'runtime_disabled_or_revoked' };
    }

    const [activeCredential] = await tx.select({ id: coordinationRuntimeCredentials.id })
      .from(coordinationRuntimeCredentials)
      .where(and(
        eq(coordinationRuntimeCredentials.runtimeId, runtimeId),
        isNull(coordinationRuntimeCredentials.revokedAt),
        gt(coordinationRuntimeCredentials.expiresAt, new Date()),
      ))
      .limit(1);

    const bootstrapToken = generateCoordinationSecret('cb');
    const [updated] = await tx.update(coordinationRuntimeRegistrations).set({
      bootstrapHash: hashCoordinationSecret(bootstrapToken),
      updatedAt: new Date(),
    }).where(and(
      eq(coordinationRuntimeRegistrations.id, runtimeId),
      eq(coordinationRuntimeRegistrations.enabled, true),
      isNull(coordinationRuntimeRegistrations.revokedAt),
    )).returning({ id: coordinationRuntimeRegistrations.id });
    if (!updated) {
      await audit({
        eventType: 'bootstrap_reissue_failed',
        success: false,
        runtimeId,
        actor: registration.actor,
        reason: 'runtime_disabled_or_revoked',
        sourceIp,
      }, executor);
      return { ok: false, reason: 'runtime_disabled_or_revoked' };
    }
    await audit({
      eventType: 'bootstrap_reissued',
      success: true,
      runtimeId,
      actor: registration.actor,
      sourceIp,
      metadata: { hadActiveCredentialAtReissue: Boolean(activeCredential) },
    }, executor);
    return { ok: true, bootstrapToken, actor: registration.actor as CoordinationActorId };
  });
}

export type BootstrapReissueResult =
  | { ok: true; bootstrapToken: string; actor: CoordinationActorId }
  | { ok: false; reason: BootstrapReissueFailureReason };
