import crypto from 'node:crypto';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import {
  COORDINATION_ACTOR_IDS,
  COORDINATION_CREDENTIAL_CAPABILITIES,
  coordinationCredentialAuditEvents,
  coordinationRuntimeCredentials,
  coordinationRuntimeRegistrations,
  type CoordinationActorId,
  type CoordinationCredentialCapability,
} from '@shared/schema';
import { getSharedDb } from '../db';

const actorIds = new Set<string>(COORDINATION_ACTOR_IDS);
const capabilityIds = new Set<string>(COORDINATION_CREDENTIAL_CAPABILITIES);
const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 3600;

export type BrokerCredential = {
  actor: CoordinationActorId;
  runtimeId: string;
  credentialId: string;
  capabilities: CoordinationCredentialCapability[];
  expiresAt: Date;
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
): Promise<{ accessToken: string; credential: BrokerCredential } | null> {
  return getSharedDb().transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id FROM coordination_runtime_registrations
      WHERE id = ${runtimeId}
      FOR UPDATE
    `);
    const [registration] = await tx.select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, runtimeId));
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