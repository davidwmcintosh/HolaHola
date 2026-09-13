import { createHash, randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import {
  coordinationV2FounderDecisions,
  coordinationV2OperatorGrants,
  coordinationV2PolicyAuditEvents,
  coordinationV2PolicyIdentities,
  coordinationV2PolicyVersions,
} from '@shared/schema';
import {
  canonicalizeAndHashPolicy,
  canonicalJson,
  type CanonicalCoordinationPolicy,
} from './coordination-policy-canonicalization';

export type PolicyServiceErrorCode =
  | 'POLICY_INVALID'
  | 'POLICY_NOT_FOUND'
  | 'POLICY_VERSION_NOT_FOUND'
  | 'POLICY_IDENTITY_REVOKED'
  | 'POLICY_ALREADY_APPROVED'
  | 'POLICY_ALREADY_REJECTED'
  | 'POLICY_ALREADY_REVOKED'
  | 'POLICY_NOT_DRAFT'
  | 'POLICY_NOT_APPROVED'
  | 'FOUNDER_REQUIRED'
  | 'FOUNDER_DECISION_REQUIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'OPERATOR_REQUIRED'
  | 'OPERATOR_GRANT_NOT_FOUND'
  | 'OPERATOR_GRANT_EXPIRED'
  | 'OPERATOR_GRANT_REVOKED'
  | 'OPERATOR_GRANT_SCOPE_DENIED'
  | 'OPERATOR_GRANT_ACTION_DENIED'
  | 'OPERATOR_GRANT_POLICY_DENIED'
  | 'OPERATOR_GRANT_ALREADY_REVOKED'
  | 'OPERATOR_GRANT_INVALID'
  | 'POLICY_DATABASE_UNAVAILABLE';

export class CoordinationPolicyError extends Error {
  readonly code: PolicyServiceErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: PolicyServiceErrorCode, details?: Record<string, unknown>) {
    super(code);
    this.name = 'CoordinationPolicyError';
    this.code = code;
    this.details = details;
  }
}

function fail(code: PolicyServiceErrorCode, details?: Record<string, unknown>): never {
  throw new CoordinationPolicyError(code, details);
}

function required(value: string | undefined, code: PolicyServiceErrorCode): string {
  if (typeof value !== 'string' || !value || value.length > 128 || value.trim() !== value) fail(code);
  return value;
}

function asDate(value: Date | string): Date {
  const result = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(result.getTime())) fail('OPERATOR_GRANT_INVALID');
  return result;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export type PolicyVersionDto = {
  id: string;
  policyIdentityId: string;
  version: number;
  policyDigest: string;
  approvalState: string;
  canonicalPolicy: CanonicalCoordinationPolicy;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  approvedAt: string | null;
  revokedAt: string | null;
};

export type PolicyIdentityDto = {
  id: string;
  policyKey: string;
  displayName: string;
  description: string | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  revokedAt: string | null;
};

export type FounderDecisionDto = {
  id: string;
  policyVersionId: string;
  decision: string;
  founderActor: string;
  requestKey: string;
  policyDigest: string;
  reason: string | null;
  createdAt: string;
};

export type OperatorGrantDto = {
  id: string;
  policyIdentityId: string;
  operatorActor: string;
  minVersion: number | null;
  maxVersion: number | null;
  actions: string[];
  issuedBy: string;
  issuedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  grantDigest: string;
  requestKey: string;
};

function identityDto(row: typeof coordinationV2PolicyIdentities.$inferSelect): PolicyIdentityDto {
  return {
    id: row.id,
    policyKey: row.policyKey,
    displayName: row.displayName,
    description: row.description,
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    revokedAt: iso(row.revokedAt),
  };
}

function versionDto(row: typeof coordinationV2PolicyVersions.$inferSelect): PolicyVersionDto {
  return {
    id: row.id,
    policyIdentityId: row.policyIdentityId,
    version: row.version,
    policyDigest: row.policyDigest,
    approvalState: row.approvalState,
    canonicalPolicy: row.canonicalPolicy as CanonicalCoordinationPolicy,
    createdBy: row.createdBy,
    approvedBy: row.approvedBy,
    createdAt: row.createdAt.toISOString(),
    approvedAt: iso(row.approvedAt),
    revokedAt: iso(row.revokedAt),
  };
}

function decisionDto(row: typeof coordinationV2FounderDecisions.$inferSelect): FounderDecisionDto {
  return {
    id: row.id,
    policyVersionId: row.policyVersionId,
    decision: row.decision,
    founderActor: row.founderActor,
    requestKey: row.requestKey,
    policyDigest: row.policyDigest,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

function grantDto(row: typeof coordinationV2OperatorGrants.$inferSelect): OperatorGrantDto {
  return {
    id: row.id,
    policyIdentityId: row.policyIdentityId,
    operatorActor: row.operatorActor,
    minVersion: row.minVersion,
    maxVersion: row.maxVersion,
    actions: [...row.actions],
    issuedBy: row.issuedBy,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    revokedAt: iso(row.revokedAt),
    grantDigest: row.grantDigest,
    requestKey: row.requestKey,
  };
}

function normalizedReason(reason: string | undefined): string | undefined {
  const normalized = reason?.trim().replace(/\s+/g, ' ');
  return normalized || undefined;
}

function requestDigest(value: Record<string, unknown>): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

async function appendAudit(tx: any, value: {
  policyIdentityId: string;
  policyVersionId?: string;
  operatorGrantId?: string;
  actorType: 'founder' | 'operator' | 'system';
  actorId: string;
  action: string;
  requestKey: string;
  requestDigest: string;
  reason?: string;
  success: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await tx.insert(coordinationV2PolicyAuditEvents).values({
    id: randomUUID(),
    policyIdentityId: value.policyIdentityId,
    policyVersionId: value.policyVersionId,
    operatorGrantId: value.operatorGrantId,
    actorType: value.actorType,
    actorId: value.actorId,
    action: value.action,
    requestKey: value.requestKey,
    requestDigest: value.requestDigest,
    reason: value.reason,
    success: value.success,
    metadata: value.metadata ?? {},
  });
}

async function lockIdentity(tx: any, policyKey: string): Promise<typeof coordinationV2PolicyIdentities.$inferSelect | undefined> {
  // The advisory lock covers the create-if-absent case; the row lock covers
  // all subsequent version allocation and identity lifecycle changes.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${policyKey}, 0))`);
  const rows = await tx.select().from(coordinationV2PolicyIdentities)
    .where(eq(coordinationV2PolicyIdentities.policyKey, policyKey)).for('update');
  return rows[0];
}

async function lockVersion(tx: any, versionId: string): Promise<typeof coordinationV2PolicyVersions.$inferSelect | undefined> {
  const rows = await tx.select().from(coordinationV2PolicyVersions)
    .where(eq(coordinationV2PolicyVersions.id, versionId)).for('update');
  return rows[0];
}

export async function createPolicyDraft(input: {
  policyKey: string;
  displayName: string;
  description?: string;
  policy: unknown;
  createdBy: string;
}): Promise<{ identity: PolicyIdentityDto; version: PolicyVersionDto }> {
  const policyKey = required(input.policyKey, 'POLICY_INVALID');
  const displayName = required(input.displayName, 'POLICY_INVALID');
  const createdBy = required(input.createdBy, 'FOUNDER_REQUIRED');
  let canonical: ReturnType<typeof canonicalizeAndHashPolicy>;
  try {
    canonical = canonicalizeAndHashPolicy(input.policy);
  } catch (error) {
    const details = error as { code?: string; field?: string };
    fail('POLICY_INVALID', { reason: details.code || 'invalid_policy', ...(details.field ? { field: details.field } : {}) });
  }
  try {
    return await db.transaction(async (tx) => {
      let identity = await lockIdentity(tx, policyKey);
      if (!identity) {
        const inserted = await tx.insert(coordinationV2PolicyIdentities).values({
          id: randomUUID(),
          policyKey,
          displayName,
          description: input.description ?? null,
          createdBy,
          status: 'active',
        }).returning();
        identity = inserted[0];
      } else if (identity.status === 'revoked') {
        fail('POLICY_IDENTITY_REVOKED');
      }
      const existing = await tx.select().from(coordinationV2PolicyVersions)
        .where(and(
          eq(coordinationV2PolicyVersions.policyIdentityId, identity.id),
          eq(coordinationV2PolicyVersions.policyDigest, canonical.policyDigest),
        ));
      if (existing[0]) return { identity: identityDto(identity), version: versionDto(existing[0]) };
      const latest = await tx.select({ version: coordinationV2PolicyVersions.version })
        .from(coordinationV2PolicyVersions)
        .where(eq(coordinationV2PolicyVersions.policyIdentityId, identity.id))
        .orderBy(desc(coordinationV2PolicyVersions.version))
        .limit(1);
      const version = (latest[0]?.version ?? 0) + 1;
      const inserted = await tx.insert(coordinationV2PolicyVersions).values({
        id: randomUUID(),
        policyIdentityId: identity.id,
        version,
        canonicalPolicy: canonical.canonicalPolicy,
        policyDigest: canonical.policyDigest,
        approvalState: 'draft',
        createdBy,
      }).returning();
      await appendAudit(tx, {
        policyIdentityId: identity.id,
        policyVersionId: inserted[0].id,
        actorType: 'founder',
        actorId: createdBy,
        action: 'draft_created',
        requestKey: `draft:${canonical.policyDigest}`,
        requestDigest: canonical.policyDigest,
        success: true,
      });
      return { identity: identityDto(identity), version: versionDto(inserted[0]) };
    });
  } catch (error) {
    if (error instanceof CoordinationPolicyError) throw error;
    fail('POLICY_DATABASE_UNAVAILABLE');
  }
}

type DecisionName = 'approved' | 'rejected' | 'revoked';

async function decidePolicy(input: {
  versionId: string;
  founderActor: string;
  requestKey: string;
  decision: DecisionName;
  reason?: string;
}): Promise<{ version: PolicyVersionDto; decision: FounderDecisionDto }> {
  required(input.founderActor, 'FOUNDER_REQUIRED');
  required(input.requestKey, 'FOUNDER_DECISION_REQUIRED');
  if (input.reason && input.reason.length > 2_000) fail('POLICY_INVALID');
  const reason = normalizedReason(input.reason);
  try {
    return await db.transaction(async (tx) => {
      const version = await lockVersion(tx, required(input.versionId, 'POLICY_VERSION_NOT_FOUND'));
      if (!version) fail('POLICY_VERSION_NOT_FOUND');
      const decisionDigest = requestDigest({
        policyVersionId: version.id,
        policyDigest: version.policyDigest,
        decision: input.decision,
        founderActor: input.founderActor,
        reason: reason ?? null,
      });
      const previous = await tx.select().from(coordinationV2FounderDecisions)
        .where(and(
          eq(coordinationV2FounderDecisions.policyVersionId, version.id),
          eq(coordinationV2FounderDecisions.requestKey, input.requestKey),
        ));
      if (previous[0]) {
        const previousAudit = await tx.select().from(coordinationV2PolicyAuditEvents)
          .where(and(
            eq(coordinationV2PolicyAuditEvents.policyVersionId, version.id),
            eq(coordinationV2PolicyAuditEvents.action, `policy_${input.decision}`),
            eq(coordinationV2PolicyAuditEvents.requestKey, input.requestKey),
          ));
        if (previous[0].decision !== input.decision
          || previous[0].policyDigest !== version.policyDigest
          || previous[0].founderActor !== input.founderActor
          || normalizedReason(previous[0].reason ?? undefined) !== reason
          || (previousAudit[0] && previousAudit[0].requestDigest !== decisionDigest)) {
          fail('IDEMPOTENCY_CONFLICT');
        }
        return { version: versionDto(version), decision: decisionDto(previous[0]) };
      }
      const allowed = input.decision === 'approved'
        ? version.approvalState === 'draft'
        : input.decision === 'rejected'
          ? version.approvalState === 'draft'
          : version.approvalState === 'approved';
      if (!allowed) {
        fail(input.decision === 'approved'
          ? version.approvalState === 'approved' ? 'POLICY_ALREADY_APPROVED' : version.approvalState === 'rejected' ? 'POLICY_ALREADY_REJECTED' : 'POLICY_NOT_DRAFT'
          : input.decision === 'revoked' ? version.approvalState === 'revoked' ? 'POLICY_ALREADY_REVOKED' : 'POLICY_NOT_APPROVED' : 'POLICY_NOT_DRAFT');
      }
      const now = new Date();
      const update = input.decision === 'approved'
        ? { approvalState: 'approved', approvedBy: input.founderActor, approvedAt: now }
        : input.decision === 'rejected'
          ? { approvalState: 'rejected', revokedAt: now }
          : { approvalState: 'revoked', revokedAt: now };
      const updated = await tx.update(coordinationV2PolicyVersions).set(update)
        .where(eq(coordinationV2PolicyVersions.id, version.id)).returning();
      const inserted = await tx.insert(coordinationV2FounderDecisions).values({
        id: randomUUID(),
        policyVersionId: version.id,
        decision: input.decision,
        founderActor: input.founderActor,
        requestKey: input.requestKey,
        policyDigest: version.policyDigest,
        reason: reason ?? null,
      }).returning();
      await appendAudit(tx, {
        policyIdentityId: version.policyIdentityId,
        policyVersionId: version.id,
        actorType: 'founder',
        actorId: input.founderActor,
        action: `policy_${input.decision}`,
        requestKey: input.requestKey,
        requestDigest: decisionDigest,
        reason,
        success: true,
      });
      return { version: versionDto(updated[0]), decision: decisionDto(inserted[0]) };
    });
  } catch (error) {
    if (error instanceof CoordinationPolicyError) throw error;
    fail('POLICY_DATABASE_UNAVAILABLE');
  }
}

export const approvePolicyVersion = (input: Omit<Parameters<typeof decidePolicy>[0], 'decision'>) =>
  decidePolicy({ ...input, decision: 'approved' });
export const rejectPolicyVersion = (input: Omit<Parameters<typeof decidePolicy>[0], 'decision'>) =>
  decidePolicy({ ...input, decision: 'rejected' });
export const revokePolicyVersion = (input: Omit<Parameters<typeof decidePolicy>[0], 'decision'>) =>
  decidePolicy({ ...input, decision: 'revoked' });

export async function issueOperatorGrant(input: {
  policyIdentityId: string;
  operatorActor: string;
  minVersion?: number;
  maxVersion?: number;
  actions: string[];
  expiresAt: Date | string;
  requestKey: string;
  founderActor: string;
  founderRole: 'founder';
}): Promise<OperatorGrantDto> {
  if (input.founderRole !== 'founder') fail('FOUNDER_REQUIRED');
  required(input.founderActor, 'FOUNDER_REQUIRED');
  const operatorActor = required(input.operatorActor, 'OPERATOR_REQUIRED');
  required(input.requestKey, 'OPERATOR_GRANT_INVALID');
  if (!Array.isArray(input.actions)) fail('OPERATOR_GRANT_INVALID');
  const actions = [...new Set(input.actions)].sort();
  const allowedActions = new Set(['launch', 'resume', 'terminate', 'status']);
  if (!Array.isArray(input.actions) || actions.length === 0 || actions.length > 16 || actions.some((action) => !allowedActions.has(action))) {
    fail('OPERATOR_GRANT_INVALID');
  }
  if (input.minVersion !== undefined && (!Number.isSafeInteger(input.minVersion) || input.minVersion < 1)) fail('OPERATOR_GRANT_INVALID');
  if (input.maxVersion !== undefined && (!Number.isSafeInteger(input.maxVersion) || input.maxVersion < 1)) fail('OPERATOR_GRANT_INVALID');
  if (input.minVersion !== undefined && input.maxVersion !== undefined && input.minVersion > input.maxVersion) fail('OPERATOR_GRANT_INVALID');
  const expiresAt = asDate(input.expiresAt);
  const issuedAt = new Date();
  if (expiresAt <= issuedAt || expiresAt.getTime() - issuedAt.getTime() > 7 * 24 * 60 * 60 * 1_000) fail('OPERATOR_GRANT_INVALID');
  const grantRequestDigest = hashGrant({
    policyIdentityId: input.policyIdentityId,
    operatorActor,
    minVersion: input.minVersion ?? null,
    maxVersion: input.maxVersion ?? null,
    actions,
    expiresAt: expiresAt.toISOString(),
    issuedBy: input.founderActor,
  });
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${input.policyIdentityId}, 0))`);
      const identityRows = await tx.select().from(coordinationV2PolicyIdentities)
        .where(eq(coordinationV2PolicyIdentities.id, input.policyIdentityId)).for('update');
      const identity = identityRows[0];
      if (!identity) fail('POLICY_NOT_FOUND');
      if (identity.status !== 'active') fail('POLICY_IDENTITY_REVOKED');
      const versions = await tx.select().from(coordinationV2PolicyVersions)
        .where(and(
          eq(coordinationV2PolicyVersions.policyIdentityId, identity.id),
          eq(coordinationV2PolicyVersions.approvalState, 'approved'),
        ));
      if (!versions.some((v) => (input.minVersion === undefined || v.version >= input.minVersion)
        && (input.maxVersion === undefined || v.version <= input.maxVersion))) fail('POLICY_NOT_APPROVED');
      const scopedVersions = versions.filter((v) => (input.minVersion === undefined || v.version >= input.minVersion)
        && (input.maxVersion === undefined || v.version <= input.maxVersion));
      const policyLifetimeCaps = scopedVersions
        .map((v) => (v.canonicalPolicy as Record<string, unknown>).maxCredentialLifetimeMs)
        .filter((value): value is number => typeof value === 'number');
      if (policyLifetimeCaps.length > 0) {
        const cap = Math.min(...policyLifetimeCaps);
        if (expiresAt.getTime() - issuedAt.getTime() > cap) fail('OPERATOR_GRANT_INVALID');
      }
      const existing = await tx.select().from(coordinationV2OperatorGrants)
        .where(and(
          eq(coordinationV2OperatorGrants.policyIdentityId, identity.id),
          eq(coordinationV2OperatorGrants.requestKey, input.requestKey),
        ));
      const existingAudit = await tx.select().from(coordinationV2PolicyAuditEvents)
        .where(and(
          eq(coordinationV2PolicyAuditEvents.policyIdentityId, identity.id),
          eq(coordinationV2PolicyAuditEvents.action, 'grant_issued'),
          eq(coordinationV2PolicyAuditEvents.requestKey, input.requestKey),
        ));
      if (existingAudit.some((event) => event.requestDigest !== grantRequestDigest)) {
        fail('IDEMPOTENCY_CONFLICT');
      }
      if (existing[0]) {
        if (existing[0].grantDigest !== grantRequestDigest) fail('IDEMPOTENCY_CONFLICT');
        return grantDto(existing[0]);
      }
      if (existingAudit[0]) fail('POLICY_DATABASE_UNAVAILABLE');
      const inserted = await tx.insert(coordinationV2OperatorGrants).values({
        id: randomUUID(),
        policyIdentityId: identity.id,
        operatorActor,
        minVersion: input.minVersion ?? null,
        maxVersion: input.maxVersion ?? null,
        actions,
        issuedBy: input.founderActor,
        issuedAt,
        expiresAt,
        grantDigest: grantRequestDigest,
        requestKey: input.requestKey,
      }).returning();
      await appendAudit(tx, {
        policyIdentityId: identity.id,
        operatorGrantId: inserted[0].id,
        actorType: 'founder',
        actorId: input.founderActor,
        action: 'grant_issued',
        requestKey: input.requestKey,
        requestDigest: grantRequestDigest,
        success: true,
        metadata: { operatorActor, actions },
      });
      return grantDto(inserted[0]);
    });
  } catch (error) {
    if (error instanceof CoordinationPolicyError) throw error;
    fail('POLICY_DATABASE_UNAVAILABLE');
  }
}

function hashGrant(value: Record<string, unknown>): string {
  // Importing the canonicalizer's digest helper would also validate a policy;
  // grant metadata has a deliberately separate, small canonical envelope.
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

async function recordAuthorizationDenial(
  input: { grantId: string; operatorActor: string; policyVersionId: string; action: string },
  error: CoordinationPolicyError,
): Promise<void> {
  const denialCodes = new Set([
    'OPERATOR_GRANT_EXPIRED',
    'OPERATOR_GRANT_REVOKED',
    'OPERATOR_GRANT_SCOPE_DENIED',
    'OPERATOR_GRANT_ACTION_DENIED',
    'OPERATOR_GRANT_POLICY_DENIED',
  ]);
  if (!denialCodes.has(error.code)) return;
  const grants = await db.select().from(coordinationV2OperatorGrants)
    .where(eq(coordinationV2OperatorGrants.id, input.grantId));
  const grant = grants[0];
  let policyIdentityId = grant?.policyIdentityId;
  let policyVersionId: string | undefined;
  if (!policyIdentityId) {
    const versions = await db.select({
      id: coordinationV2PolicyVersions.id,
      policyIdentityId: coordinationV2PolicyVersions.policyIdentityId,
    })
      .from(coordinationV2PolicyVersions)
      .where(eq(coordinationV2PolicyVersions.id, input.policyVersionId));
    policyIdentityId = versions[0]?.policyIdentityId;
    policyVersionId = versions[0]?.id;
  } else {
    const versions = await db.select({ id: coordinationV2PolicyVersions.id })
      .from(coordinationV2PolicyVersions)
      .where(and(
        eq(coordinationV2PolicyVersions.id, input.policyVersionId),
        eq(coordinationV2PolicyVersions.policyIdentityId, policyIdentityId),
      ));
    policyVersionId = versions[0]?.id;
  }
  if (!policyIdentityId) return;
  const digest = requestDigest({ ...input, error: error.code });
  const requestKey = `deny:${digest}`.slice(0, 128);
  try {
    await db.insert(coordinationV2PolicyAuditEvents).values({
      id: randomUUID(),
      policyIdentityId,
      policyVersionId,
      operatorGrantId: grant?.id,
      actorType: 'operator',
      actorId: input.operatorActor || 'unknown-operator',
      action: 'authorization_denied',
      requestKey,
      requestDigest: digest,
      reason: error.code,
      success: false,
      metadata: { action: input.action },
    });
  } catch (auditError) {
    // A duplicate is the expected result when the same denied request is
    // replayed. Any other failure must fail closed rather than lose evidence.
    const code = (auditError as { code?: string }).code;
    if (code !== '23505') throw auditError;
  }
}

export async function authorizeOperatorAction(input: {
  grantId: string;
  operatorActor: string;
  policyVersionId: string;
  action: string;
  now?: Date;
}): Promise<OperatorGrantDto> {
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx.select().from(coordinationV2OperatorGrants)
        .where(eq(coordinationV2OperatorGrants.id, required(input.grantId, 'OPERATOR_GRANT_NOT_FOUND')))
        .for('update');
      const grant = rows[0];
      if (!grant) fail('OPERATOR_GRANT_NOT_FOUND');
      const now = input.now ?? new Date();
      const identities = await tx.select().from(coordinationV2PolicyIdentities)
        .where(eq(coordinationV2PolicyIdentities.id, grant.policyIdentityId))
        .for('update');
      if (!identities[0] || identities[0].status !== 'active') fail('OPERATOR_GRANT_POLICY_DENIED');
      if (grant.operatorActor !== input.operatorActor) fail('OPERATOR_GRANT_SCOPE_DENIED');
      if (grant.revokedAt) fail('OPERATOR_GRANT_REVOKED');
      if (grant.expiresAt <= now) fail('OPERATOR_GRANT_EXPIRED');
      if (!grant.actions.includes(input.action)) fail('OPERATOR_GRANT_ACTION_DENIED');
      const versions = await tx.select().from(coordinationV2PolicyVersions)
        .where(eq(coordinationV2PolicyVersions.id, input.policyVersionId))
        .for('update');
      const version = versions[0];
      if (!version || version.policyIdentityId !== grant.policyIdentityId || version.approvalState !== 'approved'
        || (grant.minVersion !== null && version.version < grant.minVersion)
        || (grant.maxVersion !== null && version.version > grant.maxVersion)) {
        fail('OPERATOR_GRANT_POLICY_DENIED');
      }
      return grantDto(grant);
    });
  } catch (error) {
    if (error instanceof CoordinationPolicyError) {
      try {
        await recordAuthorizationDenial(input, error);
      } catch {
        fail('POLICY_DATABASE_UNAVAILABLE');
      }
      throw error;
    }
    fail('POLICY_DATABASE_UNAVAILABLE');
  }
}

export async function revokeOperatorGrant(input: {
  grantId: string;
  founderActor: string;
  founderRole: 'founder';
  requestKey: string;
  reason?: string;
}): Promise<OperatorGrantDto> {
  if (input.founderRole !== 'founder') fail('FOUNDER_REQUIRED');
  required(input.founderActor, 'FOUNDER_REQUIRED');
  required(input.requestKey, 'OPERATOR_GRANT_INVALID');
  if (input.reason && input.reason.length > 2_000) fail('POLICY_INVALID');
  const reason = normalizedReason(input.reason);
  const revocationDigest = requestDigest({
    grantId: input.grantId,
    founderActor: input.founderActor,
    reason: reason ?? null,
  });
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx.select().from(coordinationV2OperatorGrants)
        .where(eq(coordinationV2OperatorGrants.id, required(input.grantId, 'OPERATOR_GRANT_NOT_FOUND')))
        .for('update');
      const grant = rows[0];
      if (!grant) fail('OPERATOR_GRANT_NOT_FOUND');
      const priorAudit = await tx.select().from(coordinationV2PolicyAuditEvents)
        .where(and(
          eq(coordinationV2PolicyAuditEvents.policyIdentityId, grant.policyIdentityId),
          eq(coordinationV2PolicyAuditEvents.action, 'grant_revoked'),
          eq(coordinationV2PolicyAuditEvents.requestKey, input.requestKey),
        ));
      if (priorAudit[0]) {
        if (priorAudit.length !== 1 || priorAudit[0].action !== 'grant_revoked'
          || priorAudit[0].operatorGrantId !== grant.id
          || priorAudit[0].requestDigest !== revocationDigest) {
          fail('IDEMPOTENCY_CONFLICT');
        }
        return grantDto(grant);
      }
      if (grant.revokedAt) fail('OPERATOR_GRANT_ALREADY_REVOKED');
      const revoked = await tx.update(coordinationV2OperatorGrants)
        .set({ revokedAt: new Date() })
        .where(eq(coordinationV2OperatorGrants.id, grant.id))
        .returning();
      await appendAudit(tx, {
        policyIdentityId: grant.policyIdentityId,
        operatorGrantId: grant.id,
        actorType: 'founder',
        actorId: input.founderActor,
        action: 'grant_revoked',
        requestKey: input.requestKey,
        requestDigest: revocationDigest,
        reason,
        success: true,
      });
      return grantDto(revoked[0]);
    });
  } catch (error) {
    if (error instanceof CoordinationPolicyError) throw error;
    fail('POLICY_DATABASE_UNAVAILABLE');
  }
}

export async function getPolicyVersion(versionId: string): Promise<PolicyVersionDto> {
  const rows = await db.select().from(coordinationV2PolicyVersions).where(eq(coordinationV2PolicyVersions.id, versionId));
  if (!rows[0]) fail('POLICY_VERSION_NOT_FOUND');
  return versionDto(rows[0]);
}

export async function listPolicyVersions(policyIdentityId: string): Promise<PolicyVersionDto[]> {
  const rows = await db.select().from(coordinationV2PolicyVersions)
    .where(eq(coordinationV2PolicyVersions.policyIdentityId, policyIdentityId))
    .orderBy(asc(coordinationV2PolicyVersions.version));
  return rows.map(versionDto);
}
