import crypto from 'node:crypto';
import { and, eq, gt, inArray, isNull, or, sql } from 'drizzle-orm';
import {
  COORDINATION_ACTOR_IDS,
  COORDINATION_CREDENTIAL_CAPABILITIES,
  coordinationCredentialAuditEvents,
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
};

type ExchangeBootstrapCredentialTestHooks = {
  afterRegistrationLocked?: () => Promise<void>;
};
export function hashCoordinationSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function generateCoordinationSecret(prefix: 'cb' | 'ct'): string {
  return `${prefix}_${crypto.randomBytes(32).toString('base64url')}`;
}

function validCapabilities(values: string[]): values is CoordinationCredentialCapability[] {
  return values.length > 0 && values.every((value) => capabilityIds.has(value));
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

export async function registerCoordinationRuntime(input: {
  runtimeId: string;
  actor: CoordinationActorId;
  displayName: string;
  capabilities: CoordinationCredentialCapability[];
  tokenTtlSeconds?: number;
}): Promise<{ bootstrapToken: string }> {
  if (!input.runtimeId || input.runtimeId.length > 120) throw new Error('runtimeId is invalid');
  if (!actorIds.has(input.actor) || input.actor === 'coordination-system') throw new Error('actor is invalid');
  if (!validCapabilities(input.capabilities)) throw new Error('capabilities are invalid');
  const tokenTtlSeconds = input.tokenTtlSeconds ?? 900;
  if (tokenTtlSeconds < MIN_TTL_SECONDS || tokenTtlSeconds > MAX_TTL_SECONDS) {
    throw new Error(`tokenTtlSeconds must be between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS}`);
  }
  const bootstrapToken = generateCoordinationSecret('cb');
  await getSharedDb().insert(coordinationRuntimeRegistrations).values({
    id: input.runtimeId,
    actor: input.actor,
    displayName: input.displayName,
    bootstrapHash: hashCoordinationSecret(bootstrapToken),
    capabilities: input.capabilities,
    tokenTtlSeconds,
  });
  await audit({ eventType: 'runtime_registered', success: true, runtimeId: input.runtimeId, actor: input.actor });
  return { bootstrapToken };
}

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
        Buffer.from(hashCoordinationSecret(bootstrapToken)),
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

export async function auditMissingBootstrapAttempt(runtimeId: string | undefined, sourceIp?: string): Promise<void> {
  await audit({
    eventType: 'exchange_failed',
    success: false,
    runtimeId,
    reason: 'missing_runtime_or_bootstrap',
    sourceIp,
  });
}
