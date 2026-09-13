import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  coordinationV2CleanupObligations,
  coordinationV2SessionEvents,
  coordinationV2Sessions,
  type CoordinationV2CleanupObligation,
  type CoordinationV2Session,
} from '@shared/schema';
import { canonicalJson } from './coordination-policy-canonicalization';
import { transitionCleanup as reduceCleanup } from './coordination-cleanup-state';
import { transitionSession } from './coordination-session-state';
import type { CleanupState, SessionState } from './coordination-v2-types';
import { authorizeCoordinationLifecycleInTransaction, CoordinationLifecycleAuthorizationError } from './coordination-lifecycle-authorization';

export type CleanupServiceErrorCode =
  | 'CLEANUP_INVALID_REQUEST' | 'CLEANUP_NOT_FOUND' | 'CLEANUP_SESSION_NOT_FOUND'
  | 'CLEANUP_REPLAY_CONFLICT' | 'CLEANUP_TRANSITION_REJECTED' | 'CLEANUP_RECEIPTS_EXHAUSTED'
  | 'CLEANUP_DATABASE_UNAVAILABLE';

export class CoordinationCleanupError extends Error {
  readonly code: CleanupServiceErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: CleanupServiceErrorCode, details?: Record<string, unknown>) {
    super(code);
    this.name = 'CoordinationCleanupError';
    this.code = code;
    this.details = details;
  }
}
function fail(code: CleanupServiceErrorCode, details?: Record<string, unknown>): never {
  throw new CoordinationCleanupError(code, details);
}
function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > 160) fail('CLEANUP_INVALID_REQUEST', { field });
  return value;
}
function hash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
async function lockById(tx: any, table: any, id: string): Promise<any | undefined> {
  const rows = await tx.select().from(table).where(eq(table.id, id)).for('update');
  return rows[0];
}
function sessionState(row: CoordinationV2Session): SessionState {
  return {
    sessionId: row.id, policyVersionId: row.policyVersionId, state: row.state as any, providerOrder: row.requestedProviders,
    totalAttemptBudget: row.attemptBudget, providerAttemptBudgets: row.perProviderBudgets,
    expiresAt: row.expiresAt.getTime(), attemptCount: 0, attemptsByProvider: {},
    currentProvider: null, completionAccepted: row.state === 'succeeded',
    terminalAt: row.terminalAt?.getTime() ?? null, terminalReason: row.terminalReason,
  } as unknown as SessionState;
}
function cleanupState(row: CoordinationV2CleanupObligation): CleanupState {
  return {
    sessionId: row.sessionId, status: row.state as any,
    terminalOutcome: row.terminalOutcome as any, terminalReason: row.terminalReason,
    requestedAt: row.requestedAt.getTime(), acknowledgedAt: row.completedAt?.getTime() ?? null,
    lastFailureCode: row.lastErrorCode,
  } as CleanupState;
}
function cleanupDto(row: CoordinationV2CleanupObligation) {
  return {
    id: row.id, sessionId: row.sessionId, kind: row.kind, state: row.state,
    terminalOutcome: row.terminalOutcome, terminalReason: row.terminalReason,
    required: row.required, idempotencyKey: row.idempotencyKey, attemptCount: row.attemptCount,
    requestedAt: row.requestedAt.toISOString(), deadlineAt: row.deadlineAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null, lastErrorCode: row.lastErrorCode,
  };
}

export type CompletionInput = {
  sessionId: string;
  requestKey: string;
  actorId: string;
  evidence: Array<{ type: string; reference: string; digest: string }>;
  now?: Date;
};

/**
 * Completion and all terminal cleanup obligations share the session lock. A
 * concurrent completion can therefore observe either the complete terminal
 * result or the exact replay, never a partially-created cleanup set.
 */
export async function acceptCoordinationCompletion(input: CompletionInput) {
  required(input.sessionId, 'sessionId'); required(input.requestKey, 'requestKey'); required(input.actorId, 'actorId');
  if (!Array.isArray(input.evidence)
    || input.evidence.some((entry) => !entry || typeof entry.type !== 'string'
      || !/^[a-z][a-z0-9_.-]{0,63}$/.test(entry.type)
      || typeof entry.reference !== 'string' || entry.reference.length === 0 || entry.reference.length > 255
      || entry.reference.trim() !== entry.reference
      || !/^[0-9a-f]{64}$/.test(entry.digest))) {
    fail('CLEANUP_INVALID_REQUEST', { field: 'evidence' });
  }
  const evidenceTypes = input.evidence.map((entry) => entry.type);
  if (new Set(evidenceTypes).size !== evidenceTypes.length) fail('CLEANUP_INVALID_REQUEST', { field: 'evidence' });
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      let session: CoordinationV2Session;
      try {
        ({ session } = await authorizeCoordinationLifecycleInTransaction(tx, {
          sessionId: input.sessionId, actorId: input.actorId, action: 'terminate', now,
        }));
      } catch (error) {
        if (error instanceof CoordinationLifecycleAuthorizationError) fail('CLEANUP_TRANSITION_REJECTED', { reason: error.code });
        throw error;
      }
      const requiredEvidence = Array.isArray(session.completionCriteria?.requiredCompletionEvidence)
        ? session.completionCriteria.requiredCompletionEvidence.filter((entry): entry is string => typeof entry === 'string') : [];
      if (requiredEvidence.length !== evidenceTypes.length
        || requiredEvidence.some((type) => !evidenceTypes.includes(type))) {
        fail('CLEANUP_INVALID_REQUEST', { field: 'evidence' });
      }
      const evidenceEnvelopeDigest = hash({ evidence: input.evidence });
      const prior = await tx.select().from(coordinationV2SessionEvents)
        .where(and(eq(coordinationV2SessionEvents.sessionId, session.id), eq(coordinationV2SessionEvents.requestKey, input.requestKey)));
      if (prior[0]) {
        if ((prior[0].metadata as Record<string, unknown>)?.completionDigest !== evidenceEnvelopeDigest) fail('CLEANUP_REPLAY_CONFLICT');
        const snapshot = (prior[0].metadata as Record<string, unknown>)?.resultSnapshot;
        if (snapshot) return snapshot;
        const obligations = await tx.select().from(coordinationV2CleanupObligations)
          .where(eq(coordinationV2CleanupObligations.sessionId, session.id));
        return { session: sessionDto(session), obligations: obligations.map(cleanupDto) };
      }
      const state = sessionState(session);
      const result = transitionSession(state, {
        type: 'accept_completion', evidenceDigest: 'completion_accepted',
        requestId: input.requestKey, eventId: randomUUID(), now: now.getTime(),
      });
      if (!result.ok) fail('CLEANUP_TRANSITION_REJECTED', { reason: result.code });
      const updated = await tx.update(coordinationV2Sessions).set({
        state: 'succeeded', terminalReason: 'completion_accepted', terminalAt: now, updatedAt: now,
      }).where(eq(coordinationV2Sessions.id, session.id)).returning();
      const sequenceRows = await tx.select({ sequence: coordinationV2SessionEvents.sequence })
        .from(coordinationV2SessionEvents).where(eq(coordinationV2SessionEvents.sessionId, session.id))
        .orderBy(desc(coordinationV2SessionEvents.sequence)).limit(1);
      // These are the durable, policy-independent revocation boundaries for a
      // terminal session. They are created in this transaction and never
      // delete evidence.
      const kinds = ['revoke_authority', 'release_lease', 'cleanup_generation', 'revoke_credentials'] as const;
      const obligations = [];
      for (const kind of kinds) {
        const inserted = await tx.insert(coordinationV2CleanupObligations).values({
          id: randomUUID(), sessionId: session.id, kind, state: 'pending',
          terminalOutcome: 'succeeded', terminalReason: 'completion_accepted',
          required: true, idempotencyKey: `${input.requestKey}:${kind}`,
          requestedAt: now, createdAt: now, updatedAt: now,
        }).returning();
        obligations.push(inserted[0]);
      }
      const snapshot = { session: sessionDto(updated[0]), obligations: obligations.map(cleanupDto) };
      await tx.insert(coordinationV2SessionEvents).values({
        id: result.event.eventId, sessionId: session.id, sequence: (sequenceRows[0]?.sequence ?? 0) + 1,
        fromState: result.event.from, toState: result.event.to, eventType: result.event.kind,
        actorType: 'operator', actorId: input.actorId,
        requestKey: input.requestKey,
        metadata: {
          completionDigest: evidenceEnvelopeDigest, evidenceEnvelopeDigest, evidence: input.evidence,
          resultSnapshot: snapshot,
        },
        createdAt: now,
      });
      return snapshot;
    });
  } catch (error) {
    if (error instanceof CoordinationCleanupError) throw error;
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '23505') fail('CLEANUP_REPLAY_CONFLICT');
    if (pgCode === '23514') fail('CLEANUP_TRANSITION_REJECTED');
    fail('CLEANUP_DATABASE_UNAVAILABLE');
  }
}

function sessionDto(row: CoordinationV2Session) {
  return {
    id: row.id, state: row.state, terminalReason: row.terminalReason,
    terminalAt: row.terminalAt?.toISOString() ?? null, sessionDigest: row.sessionDigest,
  };
}

export type CleanupTransitionInput = {
  obligationId: string;
  requestKey: string;
  actorId: string;
  command: { type: 'start' | 'failed' | 'retry'; code?: string };
  now?: Date;
};

export async function transitionCoordinationCleanup(input: CleanupTransitionInput) {
  required(input.obligationId, 'obligationId'); required(input.requestKey, 'requestKey'); required(input.actorId, 'actorId');
  if (input.requestKey.length > 128) fail('CLEANUP_INVALID_REQUEST', { field: 'requestKey' });
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      const lookup = await tx.select().from(coordinationV2CleanupObligations)
        .where(eq(coordinationV2CleanupObligations.id, input.obligationId));
      const reference = lookup[0] as CoordinationV2CleanupObligation | undefined;
      if (!reference) fail('CLEANUP_NOT_FOUND');
      let session: CoordinationV2Session;
      try {
        ({ session } = await authorizeCoordinationLifecycleInTransaction(tx, {
          sessionId: reference.sessionId, actorId: input.actorId, action: 'terminate',
          now,
        }));
      } catch (error) {
        if (error instanceof CoordinationLifecycleAuthorizationError) fail('CLEANUP_TRANSITION_REJECTED', { reason: error.code });
        throw error;
      }
      const obligation = await lockById(tx, coordinationV2CleanupObligations, reference.id) as CoordinationV2CleanupObligation;
      const receipts = obligation.operationReceipts ?? {};
      const prior = receipts[input.requestKey];
      const commandDigest = hash(input.command);
      if (prior) {
        if (prior.commandDigest !== commandDigest) fail('CLEANUP_REPLAY_CONFLICT');
        return prior.snapshot;
      }
      const result = reduceCleanup(cleanupState(obligation), {
        ...(input.command as any), requestId: input.requestKey, eventId: randomUUID(), now: now.getTime(),
      } as any);
      if (!result.ok) fail('CLEANUP_TRANSITION_REJECTED', { reason: result.code });
      const resultSnapshot = cleanupDto({
        ...obligation,
        state: result.state.status,
        completedAt: result.state.status === 'acknowledged' ? now : null,
        lastErrorCode: result.state.lastFailureCode,
        attemptCount: obligation.attemptCount + 1,
        updatedAt: now,
      } as CoordinationV2CleanupObligation);
      const nextReceipts = {
        ...receipts,
        [input.requestKey]: { commandDigest, snapshot: resultSnapshot },
      };
      if (Buffer.byteLength(JSON.stringify(nextReceipts), 'utf8') > 16_384) {
        fail('CLEANUP_RECEIPTS_EXHAUSTED');
      }
      const updated = await tx.update(coordinationV2CleanupObligations).set({
        state: result.state.status, completedAt: result.state.status === 'acknowledged' ? now : null,
        lastErrorCode: result.state.lastFailureCode, attemptCount: obligation.attemptCount + 1, updatedAt: now,
        operationReceipts: nextReceipts,
      }).where(eq(coordinationV2CleanupObligations.id, obligation.id)).returning();
      return resultSnapshot;
    });
  } catch (error) {
    if (error instanceof CoordinationCleanupError) throw error;
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '23505') fail('CLEANUP_REPLAY_CONFLICT');
    if (pgCode === '23514') fail('CLEANUP_TRANSITION_REJECTED');
    fail('CLEANUP_DATABASE_UNAVAILABLE');
  }
}

export const completeCoordinationSession = acceptCoordinationCompletion;
export const acceptSessionCompletion = acceptCoordinationCompletion;
export const transitionCleanupTransactionally = transitionCoordinationCleanup;
export const acceptCompletion = acceptCoordinationCompletion;
export const transitionCleanup = transitionCoordinationCleanup;