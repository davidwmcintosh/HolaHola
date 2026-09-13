import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import {
  coordinationV2Attempts,
  coordinationV2HostEnrollments,
  coordinationV2OperatorGrants,
  coordinationV2PolicyIdentities,
  coordinationV2PolicyVersions,
  coordinationV2SessionEvents,
  coordinationV2Sessions,
  coordinationV2CleanupObligations,
  type CoordinationV2Session,
} from '@shared/schema';
import { canonicalJson } from './coordination-policy-canonicalization';
import { transitionSession as reduceSession, type SessionCommand } from './coordination-session-state';
import type { FailureClassification, SessionState, SessionStatus } from './coordination-v2-types';
import { authorizeCoordinationLifecycleInTransaction, CoordinationLifecycleAuthorizationError } from './coordination-lifecycle-authorization';

export type SessionServiceErrorCode =
  | 'SESSION_INVALID_REQUEST' | 'SESSION_NOT_FOUND' | 'SESSION_CONFLICT'
  | 'SESSION_POLICY_NOT_APPROVED' | 'SESSION_POLICY_REVOKED'
  | 'SESSION_GRANT_NOT_FOUND' | 'SESSION_GRANT_INVALID' | 'SESSION_HOST_NOT_FOUND'
  | 'SESSION_HOST_INACTIVE' | 'SESSION_PROVIDER_NOT_ALLOWED' | 'SESSION_DATABASE_UNAVAILABLE'
  | 'SESSION_TRANSITION_REJECTED' | 'SESSION_REQUEST_REPLAY_CONFLICT'
  | 'SESSION_RETRYABLE_DATABASE_CONFLICT';

export class CoordinationSessionError extends Error {
  readonly code: SessionServiceErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: SessionServiceErrorCode, details?: Record<string, unknown>) {
    super(code);
    this.name = 'CoordinationSessionError';
    this.code = code;
    this.details = details;
  }
}

function fail(code: SessionServiceErrorCode, details?: Record<string, unknown>): never {
  throw new CoordinationSessionError(code, details);
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value.trim() !== value) {
    fail('SESSION_INVALID_REQUEST', { field });
  }
  return value;
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function sha(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    fail('SESSION_INVALID_REQUEST', { field });
  }
  return value;
}

function commit(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(value)) {
    fail('SESSION_INVALID_REQUEST', { field: 'startingCommit' });
  }
  return value;
}

export type CreateSessionInput = {
  operatorActor: string;
  operatorGrantId: string;
  policyVersionId: string;
  taskRef: string;
  taskArtifactSha256: string;
  repositoryIdentity: string;
  startingCommit: string;
  enrolledHostId: string;
  requestedProviders: string[];
  idempotencyKey: string;
  now?: Date;
};

export type SessionDto = {
  created?: boolean;
  id: string;
  policyVersionId: string;
  operatorGrantId: string;
  operatorActor: string;
  taskRef: string;
  taskArtifactSha256: string;
  repositoryIdentity: string;
  startingCommit: string;
  enrolledHostId: string;
  requestedProviders: string[];
  expiresAt: string;
  attemptBudget: number;
  perProviderBudgets: Record<string, number>;
  requiredValidations: string[];
  completionCriteria: Record<string, unknown>;
  state: string;
  terminalReason: string | null;
  terminalAt: string | null;
  idempotencyKey: string;
  sessionDigest: string;
  createdAt: string;
  updatedAt: string;
};

function dto(row: CoordinationV2Session): SessionDto {
  return {
    id: row.id, policyVersionId: row.policyVersionId, operatorGrantId: row.operatorGrantId,
    operatorActor: row.operatorActor, taskRef: row.taskRef, taskArtifactSha256: row.taskArtifactSha256,
    repositoryIdentity: row.repositoryIdentity, startingCommit: row.startingCommit,
    enrolledHostId: row.enrolledHostId, requestedProviders: [...row.requestedProviders],
    expiresAt: row.expiresAt.toISOString(), attemptBudget: row.attemptBudget,
    perProviderBudgets: row.perProviderBudgets, requiredValidations: [...row.requiredValidations],
    completionCriteria: row.completionCriteria, state: row.state,
    terminalReason: row.terminalReason, terminalAt: row.terminalAt?.toISOString() ?? null,
    idempotencyKey: row.idempotencyKey, sessionDigest: row.sessionDigest,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}

function policyValue(policy: Record<string, unknown>, key: string): unknown {
  return policy[key];
}

function immutableEnvelope(input: CreateSessionInput): Record<string, unknown> {
  // This is the sole launch envelope.  It intentionally contains every
  // immutable launch input; sessionDigest is not a second request ledger.
  return {
    operatorRequestKey: input.idempotencyKey,
    taskArtifactSha256: input.taskArtifactSha256,
    repositoryIdentity: input.repositoryIdentity,
    startingCommit: input.startingCommit,
    enrolledHostId: input.enrolledHostId,
    policyVersionId: input.policyVersionId,
    operatorActor: input.operatorActor,
    operatorGrantId: input.operatorGrantId,
    taskRef: input.taskRef,
    requestedProviders: input.requestedProviders,
  };
}

function sameLaunch(row: CoordinationV2Session, input: CreateSessionInput, sessionDigest: string): boolean {
  return row.sessionDigest === sessionDigest
    && row.operatorActor === input.operatorActor
    && row.operatorGrantId === input.operatorGrantId
    && row.policyVersionId === input.policyVersionId
    && row.taskRef === input.taskRef
    && row.taskArtifactSha256 === input.taskArtifactSha256
    && row.repositoryIdentity === input.repositoryIdentity
    && row.startingCommit === input.startingCommit
    && row.enrolledHostId === input.enrolledHostId
    && row.idempotencyKey === input.idempotencyKey
    && JSON.stringify(row.requestedProviders) === JSON.stringify(input.requestedProviders);
}

async function lockById(tx: any, table: any, id: string): Promise<any | undefined> {
  const rows = await tx.select().from(table).where(eq(table.id, id)).for('update');
  return rows[0];
}

export async function createOrResumeSession(input: CreateSessionInput): Promise<SessionDto> {
  const operatorActor = required(input.operatorActor, 'operatorActor');
  const operatorGrantId = required(input.operatorGrantId, 'operatorGrantId');
  const policyVersionId = required(input.policyVersionId, 'policyVersionId');
  const taskRef = required(input.taskRef, 'taskRef');
  const idempotencyKey = required(input.idempotencyKey, 'idempotencyKey');
  if (!/^[1-9][0-9]*$/.test(taskRef)) fail('SESSION_INVALID_REQUEST', { field: 'taskRef' });
  const taskArtifactSha256 = sha(input.taskArtifactSha256, 'taskArtifactSha256');
  const startingCommit = commit(input.startingCommit);
  const repositoryIdentity = required(input.repositoryIdentity, 'repositoryIdentity');
  const enrolledHostId = required(input.enrolledHostId, 'enrolledHostId');
  if (!Array.isArray(input.requestedProviders) || input.requestedProviders.length === 0
    || input.requestedProviders.some((p) => typeof p !== 'string' || !p.trim() || p.trim() !== p)
    || new Set(input.requestedProviders).size !== input.requestedProviders.length) {
    fail('SESSION_INVALID_REQUEST', { field: 'requestedProviders' });
  }
  const sessionDigest = digest(immutableEnvelope({ ...input, operatorActor, operatorGrantId, policyVersionId, taskRef, taskArtifactSha256, startingCommit, repositoryIdentity, enrolledHostId, idempotencyKey }));
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      // Deliberate lock order: grant -> policy identity -> policy version ->
      // host -> session. Do not call authorizeOperatorAction here: it would
      // reacquire an earlier lock while this transaction owns a later one.
      const grant = await lockById(tx, coordinationV2OperatorGrants, operatorGrantId);
      if (!grant || grant.operatorActor !== operatorActor) fail('SESSION_GRANT_NOT_FOUND');
      if (grant.revokedAt || grant.expiresAt <= now || !grant.actions.includes('launch')) fail('SESSION_GRANT_INVALID');
      const identity = await lockById(tx, coordinationV2PolicyIdentities, grant.policyIdentityId);
      if (!identity) fail('SESSION_POLICY_REVOKED');
      const version = await lockById(tx, coordinationV2PolicyVersions, policyVersionId);
      if (!version || version.policyIdentityId !== identity.id
        || version.approvalState !== 'approved'
        || (grant.minVersion !== null && version.version < grant.minVersion)
        || (grant.maxVersion !== null && version.version > grant.maxVersion)) {
        fail('SESSION_POLICY_NOT_APPROVED');
      }
      if (identity.status !== 'active' || version.revokedAt) fail('SESSION_POLICY_REVOKED');
      const host = await lockById(tx, coordinationV2HostEnrollments, enrolledHostId);
      if (!host) fail('SESSION_HOST_NOT_FOUND');
      if (host.status !== 'active' || host.revokedAt) fail('SESSION_HOST_INACTIVE');
      const policy = version.canonicalPolicy as Record<string, unknown>;
      const policyProviders = Array.isArray(policyValue(policy, 'providerOrder'))
        ? policyValue(policy, 'providerOrder') as string[] : [];
      let cursor = -1;
      if (input.requestedProviders.some((provider) => {
        const index = policyProviders.indexOf(provider);
        if (index <= cursor) return true;
        cursor = index;
        return index < 0;
      })) {
        fail('SESSION_PROVIDER_NOT_ALLOWED');
      }
      const prior = await tx.select().from(coordinationV2Sessions)
        .where(and(eq(coordinationV2Sessions.operatorActor, operatorActor), eq(coordinationV2Sessions.idempotencyKey, idempotencyKey)))
        .for('update');
      if (prior[0]) {
        if (!sameLaunch(prior[0], { ...input, operatorActor, operatorGrantId, policyVersionId, taskRef, taskArtifactSha256, startingCommit, repositoryIdentity, enrolledHostId, idempotencyKey }, sessionDigest)) {
          fail('SESSION_CONFLICT');
        }
        const creation = await tx.select().from(coordinationV2SessionEvents).where(and(
          eq(coordinationV2SessionEvents.sessionId, prior[0].id),
          eq(coordinationV2SessionEvents.requestKey, idempotencyKey),
        ));
        const creationMetadata = creation[0]?.metadata as Record<string, unknown> | undefined;
        if (!creation[0] || creationMetadata?.sessionDigest !== sessionDigest
          || creationMetadata.envelopeVersion !== 1 || !creationMetadata.resultSnapshot) {
          fail('SESSION_REQUEST_REPLAY_CONFLICT');
        }
        const snapshot = creationMetadata.resultSnapshot as SessionDto;
        return { ...snapshot, created: false };
      }
      const totalAttemptBudget = policyValue(policy, 'totalAttemptBudget');
      const perProviderBudgets = (policyValue(policy, 'perProviderAttemptBudgets') ?? {}) as Record<string, number>;
      const sessionDurationMs = policyValue(policy, 'sessionDurationMs');
      if (typeof totalAttemptBudget !== 'number' || !Number.isSafeInteger(totalAttemptBudget)
        || totalAttemptBudget < 1 || totalAttemptBudget > 100
        || typeof sessionDurationMs !== 'number' || !Number.isSafeInteger(sessionDurationMs)
        || sessionDurationMs < 1_000
        || !perProviderBudgets || typeof perProviderBudgets !== 'object'
        || Object.entries(perProviderBudgets).some(([provider, budget]) =>
          !policyProviders.includes(provider) || !Number.isSafeInteger(budget) || budget < 1 || budget > totalAttemptBudget)) {
        fail('SESSION_POLICY_NOT_APPROVED');
      }
      const expiresAt = new Date(now.getTime() + sessionDurationMs);
      const requiredValidations = Array.isArray(policyValue(policy, 'requiredValidationCommands'))
        ? policyValue(policy, 'requiredValidationCommands') as string[] : [];
      const completionCriteria: Record<string, unknown> = {
        requiredCompletionEvidence: Array.isArray(policyValue(policy, 'requiredCompletionEvidence'))
          ? policyValue(policy, 'requiredCompletionEvidence') : [],
      };
      const inserted = await tx.insert(coordinationV2Sessions).values({
        id: randomUUID(), policyVersionId, operatorGrantId, operatorActor, taskRef,
        taskArtifactSha256, repositoryIdentity, startingCommit, enrolledHostId,
        requestedProviders: input.requestedProviders, expiresAt,
        attemptBudget: totalAttemptBudget, perProviderBudgets,
        requiredValidations, completionCriteria, state: 'preparing',
        idempotencyKey, sessionDigest, createdAt: now, updatedAt: now,
      }).returning();
      const row = inserted[0];
      await tx.insert(coordinationV2SessionEvents).values({
        id: randomUUID(), sessionId: row.id, sequence: 1, fromState: null, toState: 'preparing',
        eventType: 'session_created', actorType: 'operator', actorId: operatorActor,
        requestKey: idempotencyKey,
        metadata: { envelopeVersion: 1, sessionDigest, resultSnapshot: dto(row) },
        createdAt: now,
      });
      return { ...dto(row), created: true };
    });
  } catch (error) {
    if (error instanceof CoordinationSessionError) throw error;
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '23505') fail('SESSION_CONFLICT');
    if (pgCode === '23514') fail('SESSION_TRANSITION_REJECTED');
    if (pgCode === '40001' || pgCode === '40P01') fail('SESSION_RETRYABLE_DATABASE_CONFLICT');
    fail('SESSION_DATABASE_UNAVAILABLE');
  }
}

async function stateFor(tx: any, row: CoordinationV2Session): Promise<SessionState> {
  const attempts = await tx.select().from(coordinationV2Attempts)
    .where(eq(coordinationV2Attempts.sessionId, row.id))
    .orderBy(desc(coordinationV2Attempts.sessionOrdinal));
  const attemptsByProvider: Record<string, number> = {};
  for (const attempt of attempts) attemptsByProvider[attempt.provider] = (attemptsByProvider[attempt.provider] ?? 0) + 1;
  return {
    sessionId: row.id, policyVersionId: row.policyVersionId, state: row.state as SessionStatus, providerOrder: row.requestedProviders,
    totalAttemptBudget: row.attemptBudget, providerAttemptBudgets: row.perProviderBudgets,
    expiresAt: row.expiresAt.getTime(), attemptCount: attempts.length, attemptsByProvider,
    currentProvider: attempts.at(-1)?.provider ?? null, completionAccepted: row.state === 'succeeded',
    terminalAt: row.terminalAt?.getTime() ?? null, terminalReason: row.terminalReason,
  } as unknown as SessionState;
}

export type SessionTransitionInput = {
  sessionId: string;
  requestKey: string;
  actorId: string;
  command: Omit<SessionCommand, 'requestId' | 'eventId' | 'now'>;
  now?: Date;
  evidenceRef?: string;
};

export async function transitionCoordinationSession(input: SessionTransitionInput): Promise<SessionDto> {
  required(input.sessionId, 'sessionId'); required(input.requestKey, 'requestKey'); required(input.actorId, 'actorId');
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      let row: CoordinationV2Session;
      try {
        ({ session: row } = await authorizeCoordinationLifecycleInTransaction(tx, {
          sessionId: input.sessionId, actorId: input.actorId,
          action: ['revoke', 'expire'].includes((input.command as { type?: string }).type ?? '') ? 'terminate' : 'launch',
          now,
          allowExpired: (input.command as { type?: string }).type === 'expire',
        }));
      } catch (error) {
        if (error instanceof CoordinationLifecycleAuthorizationError) {
          if (error.code === 'LIFECYCLE_SESSION_NOT_FOUND') fail('SESSION_NOT_FOUND');
          if (error.code === 'LIFECYCLE_ACTOR_MISMATCH') fail('SESSION_CONFLICT');
          fail('SESSION_GRANT_INVALID');
        }
        throw error;
      }
      const existing = await tx.select().from(coordinationV2SessionEvents)
        .where(and(eq(coordinationV2SessionEvents.sessionId, row.id), eq(coordinationV2SessionEvents.requestKey, input.requestKey)));
      if (existing[0]) {
        const expected = digest(input.command);
        const actual = (existing[0].metadata as Record<string, unknown>)?.commandDigest;
        if (actual !== expected) fail('SESSION_REQUEST_REPLAY_CONFLICT');
        return ((existing[0].metadata as Record<string, unknown>)?.resultSnapshot ?? dto(row)) as SessionDto;
      }
      const result = reduceSession(await stateFor(tx, row), {
        ...(input.command as SessionCommand), requestId: input.requestKey, eventId: randomUUID(), now: now.getTime(),
      });
      if (!result.ok) fail('SESSION_TRANSITION_REJECTED', { reason: result.code });
      const updatedRows = await tx.update(coordinationV2Sessions).set({
        state: result.state.state, terminalAt: result.state.terminalAt ? new Date(result.state.terminalAt) : null,
        terminalReason: result.state.terminalReason, updatedAt: now,
      }).where(eq(coordinationV2Sessions.id, row.id)).returning();
      const sequenceRows = await tx.select({ sequence: coordinationV2SessionEvents.sequence })
        .from(coordinationV2SessionEvents).where(eq(coordinationV2SessionEvents.sessionId, row.id))
        .orderBy(desc(coordinationV2SessionEvents.sequence)).limit(1);
      await tx.insert(coordinationV2SessionEvents).values({
        id: result.event.eventId, sessionId: row.id, sequence: (sequenceRows[0]?.sequence ?? 0) + 1,
        fromState: result.event.from, toState: result.event.to, eventType: result.event.kind,
        actorType: 'operator', actorId: input.actorId, reasonCode: result.event.classification,
        evidenceRef: input.evidenceRef, requestKey: input.requestKey,
        metadata: { commandDigest: digest(input.command), resultSnapshot: dto(updatedRows[0]) }, createdAt: now,
      });
      if (['succeeded', 'failed', 'exhausted', 'expired', 'revoked'].includes(result.state.state)) {
        const kinds = ['revoke_authority', 'release_lease', 'cleanup_generation', 'revoke_credentials'] as const;
        const terminalReason = result.state.terminalReason ?? 'terminal session';
        for (const kind of kinds) {
          await tx.insert(coordinationV2CleanupObligations).values({
            id: randomUUID(), sessionId: row.id, kind, state: 'pending',
            terminalOutcome: result.state.state, terminalReason,
            required: true, idempotencyKey: `${input.requestKey}:${kind}`,
            requestedAt: now, createdAt: now, updatedAt: now,
          });
        }
      }
      return dto(updatedRows[0]);
    });
  } catch (error) {
    if (error instanceof CoordinationSessionError) throw error;
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '23505') fail('SESSION_REQUEST_REPLAY_CONFLICT');
    if (pgCode === '23514') fail('SESSION_TRANSITION_REJECTED');
    if (pgCode === '40001' || pgCode === '40P01') fail('SESSION_RETRYABLE_DATABASE_CONFLICT');
    fail('SESSION_DATABASE_UNAVAILABLE');
  }
}

export const createCoordinationSession = createOrResumeSession;
export const resumeCoordinationSession = createOrResumeSession;
export const transitionSessionTransactionally = transitionCoordinationSession;
export const createSession = createOrResumeSession;
export const resumeSession = createOrResumeSession;
export const transitionSession = transitionCoordinationSession;