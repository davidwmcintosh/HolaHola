import { createHash, randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../db';
import {
  coordinationV2Attempts,
  coordinationV2AttemptEvents,
  coordinationV2SessionEvents,
  coordinationV2Sessions,
  type CoordinationV2Attempt,
  type CoordinationV2Session,
} from '@shared/schema';
import { canonicalJson } from './coordination-policy-canonicalization';
import { transitionAttempt as reduceAttempt, type AttemptCommand } from './coordination-attempt-state';
import { transitionSession } from './coordination-session-state';
import type { AttemptState, FailureClassification, SessionState } from './coordination-v2-types';
import { authorizeCoordinationLifecycleInTransaction, CoordinationLifecycleAuthorizationError } from './coordination-lifecycle-authorization';

export type AttemptServiceErrorCode =
  | 'ATTEMPT_INVALID_REQUEST' | 'ATTEMPT_NOT_FOUND' | 'ATTEMPT_SESSION_NOT_FOUND'
  | 'ATTEMPT_SESSION_TERMINAL' | 'ATTEMPT_PROVIDER_NOT_ALLOWED' | 'ATTEMPT_BUDGET_EXHAUSTED'
  | 'ATTEMPT_PREVIOUS_INVALID' | 'ATTEMPT_TRANSITION_REJECTED' | 'ATTEMPT_REQUEST_REPLAY_CONFLICT'
  | 'ATTEMPT_DATABASE_UNAVAILABLE' | 'ATTEMPT_RETRYABLE_DATABASE_CONFLICT';

export class CoordinationAttemptError extends Error {
  readonly code: AttemptServiceErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: AttemptServiceErrorCode, details?: Record<string, unknown>) {
    super(code);
    this.name = 'CoordinationAttemptError';
    this.code = code;
    this.details = details;
  }
}

function fail(code: AttemptServiceErrorCode, details?: Record<string, unknown>): never {
  throw new CoordinationAttemptError(code, details);
}
function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value || value.trim() !== value || value.length > 160) fail('ATTEMPT_INVALID_REQUEST', { field });
  return value;
}
function sha(value: unknown, field: string): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) fail('ATTEMPT_INVALID_REQUEST', { field });
  return value;
}
function hash(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}
function dto(row: CoordinationV2Attempt) {
  return {
    id: row.id, sessionId: row.sessionId, attemptGeneration: row.attemptGeneration,
    provider: row.provider, model: row.model, adapterVersion: row.adapterVersion,
    sessionOrdinal: row.sessionOrdinal, providerOrdinal: row.providerOrdinal,
    previousAttemptId: row.previousAttemptId, packetId: row.packetId, executionId: row.executionId,
    state: row.state, failureClassification: row.failureClassification, resultCode: row.resultCode,
    attemptDigest: row.attemptDigest, deadlineAt: row.deadlineAt.toISOString(),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
    terminalAt: row.terminalAt?.toISOString() ?? null,
  };
}
async function lockById(tx: any, table: any, id: string): Promise<any | undefined> {
  const rows = await tx.select().from(table).where(eq(table.id, id)).for('update');
  return rows[0];
}
async function sessionState(tx: any, row: CoordinationV2Session): Promise<SessionState> {
  const attempts = await tx.select().from(coordinationV2Attempts).where(eq(coordinationV2Attempts.sessionId, row.id))
    .orderBy(desc(coordinationV2Attempts.sessionOrdinal));
  const byProvider: Record<string, number> = {};
  for (const item of attempts) byProvider[item.provider] = (byProvider[item.provider] ?? 0) + 1;
  return {
    sessionId: row.id, policyVersionId: row.policyVersionId, state: row.state as any, providerOrder: row.requestedProviders,
    totalAttemptBudget: row.attemptBudget, providerAttemptBudgets: row.perProviderBudgets,
    expiresAt: row.expiresAt.getTime(), attemptCount: attempts.length, attemptsByProvider: byProvider,
    currentProvider: attempts[0]?.provider ?? null, completionAccepted: row.state === 'succeeded',
    terminalAt: row.terminalAt?.getTime() ?? null, terminalReason: row.terminalReason,
  } as unknown as SessionState;
}
function attemptState(row: CoordinationV2Attempt): AttemptState {
  return {
    attemptId: row.id, sessionId: row.sessionId, provider: row.provider, model: row.model,
    adapterVersion: row.adapterVersion, ordinal: row.sessionOrdinal, providerOrdinal: row.providerOrdinal,
    createdAt: row.createdAt.getTime(), deadline: row.deadlineAt.getTime(),
    state: row.state as any, failureClassification: (row.failureClassification as FailureClassification | null),
    terminalAt: row.terminalAt?.getTime() ?? null, resultCode: row.resultCode,
  } as AttemptState;
}

export type CreateAttemptInput = {
  sessionId: string;
  requestKey: string;
  actorId: string;
  provider: string;
  model: string;
  adapterVersion: string;
  /** Client/server retry identity. The server generates one only for the first attempt. */
  attemptGeneration?: string;
  previousAttemptId?: string;
  classification?: 'fresh_attempt_same_provider' | 'fresh_attempt_next_provider';
  deadlineAt?: Date;
  now?: Date;
};

export async function createFreshAttempt(input: CreateAttemptInput) {
  required(input.sessionId, 'sessionId'); required(input.requestKey, 'requestKey'); required(input.actorId, 'actorId');
  const provider = required(input.provider, 'provider');
  const model = required(input.model, 'model');
  const adapterVersion = required(input.adapterVersion, 'adapterVersion');
  if (input.attemptGeneration !== undefined
    && !/^[0-9a-f]{64}$/.test(input.attemptGeneration)
    && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.attemptGeneration)) {
    fail('ATTEMPT_INVALID_REQUEST', { field: 'attemptGeneration' });
  }
  if (input.classification && (!input.previousAttemptId || !input.attemptGeneration)) {
    fail('ATTEMPT_INVALID_REQUEST', { field: 'previousAttemptId/attemptGeneration' });
  }
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      // Session is the authority/budget lock. Attempts are read and written
      // only after it, preserving grant -> policy -> host -> session -> attempt.
      let session: CoordinationV2Session;
      try {
        ({ session } = await authorizeCoordinationLifecycleInTransaction(tx, {
          sessionId: input.sessionId, actorId: input.actorId,
          action: input.classification ? 'resume' : 'launch', now,
        }));
      } catch (error) {
        if (error instanceof CoordinationLifecycleAuthorizationError) {
          if (error.code === 'LIFECYCLE_SESSION_NOT_FOUND') fail('ATTEMPT_SESSION_NOT_FOUND');
          if (error.code === 'LIFECYCLE_ACTOR_MISMATCH') fail('ATTEMPT_SESSION_NOT_FOUND');
          fail('ATTEMPT_SESSION_TERMINAL');
        }
        throw error;
      }
      const generation = input.attemptGeneration ?? randomUUID();
      const existingGeneration = await tx.select().from(coordinationV2Attempts)
        .where(and(
          eq(coordinationV2Attempts.sessionId, session.id),
          eq(coordinationV2Attempts.attemptGeneration, generation),
        )).for('update');
      if (existingGeneration[0]) {
        const existing = existingGeneration[0] as CoordinationV2Attempt;
        const immutableMatch = existing.sessionId === session.id
          && existing.attemptGeneration === generation
          && existing.provider === provider
          && existing.model === model
          && existing.adapterVersion === adapterVersion
          && (existing.previousAttemptId ?? null) === (input.previousAttemptId ?? null);
        if (!immutableMatch) fail('ATTEMPT_REQUEST_REPLAY_CONFLICT');
        if (['retryable_failed', 'terminal_failed', 'cancelled', 'completed'].includes(existing.state)) {
          fail('ATTEMPT_PREVIOUS_INVALID');
        }
        return { ...dto(existing), created: false };
      }
      const replayEvents = await tx.select({ event: coordinationV2AttemptEvents, attemptSessionId: coordinationV2Attempts.sessionId })
        .from(coordinationV2AttemptEvents)
        .innerJoin(coordinationV2Attempts, eq(coordinationV2AttemptEvents.attemptId, coordinationV2Attempts.id))
        .where(and(
          eq(coordinationV2AttemptEvents.requestKey, input.requestKey),
          eq(coordinationV2Attempts.sessionId, session.id),
        ));
      if (replayEvents[0]) {
        const replayAttempt = await lockById(tx, coordinationV2Attempts, replayEvents[0].event.attemptId) as CoordinationV2Attempt | undefined;
        const replayDigest = hash({ generation, provider, model, adapterVersion, previousAttemptId: input.previousAttemptId ?? null });
        if (!replayAttempt
          || (replayEvents[0].event.metadata as Record<string, unknown>)?.commandDigest !== replayDigest) {
          fail('ATTEMPT_REQUEST_REPLAY_CONFLICT');
        }
        return {
          ...((replayEvents[0].event.metadata as Record<string, unknown>)?.resultSnapshot ?? dto(replayAttempt)),
          created: false,
        };
      }
      if (['succeeded', 'failed', 'exhausted', 'expired', 'revoked'].includes(session.state)) fail('ATTEMPT_SESSION_TERMINAL');
      const allAttempts = await tx.select().from(coordinationV2Attempts)
        .where(eq(coordinationV2Attempts.sessionId, session.id)).orderBy(desc(coordinationV2Attempts.sessionOrdinal));
      const commandType = input.classification ? 'retry' : 'start_attempt';
      const result = transitionSession(await sessionState(tx, session), {
        type: commandType as any, provider, classification: input.classification,
        requestId: input.requestKey, eventId: randomUUID(), now: now.getTime(),
      } as any);
      if (!result.ok) {
        if (result.code === 'attempt_budget_exhausted' || result.code === 'provider_budget_exhausted') fail('ATTEMPT_BUDGET_EXHAUSTED', { reason: result.code });
        if (result.code === 'provider_not_in_policy_order' || result.code === 'provider_order_regression') fail('ATTEMPT_PROVIDER_NOT_ALLOWED', { reason: result.code });
        fail('ATTEMPT_TRANSITION_REJECTED', { reason: result.code });
      }
      if (input.previousAttemptId) {
        const previous = allAttempts.find((item) => item.id === input.previousAttemptId);
        if (!previous || previous.sessionId !== session.id
          || !['retryable_failed', 'terminal_failed', 'cancelled'].includes(previous.state)) fail('ATTEMPT_PREVIOUS_INVALID');
      }
      const attemptOrdinal = allAttempts.length + 1;
      const providerOrdinal = allAttempts.filter((item) => item.provider === provider).length + 1;
      const deadlineAt = input.deadlineAt ?? new Date(Math.min(
        session.expiresAt.getTime(), now.getTime() + 24 * 60 * 60 * 1_000,
      ));
      if (deadlineAt <= now) fail('ATTEMPT_INVALID_REQUEST', { field: 'deadlineAt' });
      const attemptDigest = hash({
        sessionId: session.id, attemptGeneration: generation, provider, model, adapterVersion,
        sessionOrdinal: attemptOrdinal, providerOrdinal, previousAttemptId: input.previousAttemptId ?? null,
      });
      const inserted = await tx.insert(coordinationV2Attempts).values({
        id: randomUUID(), sessionId: session.id, attemptGeneration: generation, provider, model,
        adapterVersion, sessionOrdinal: attemptOrdinal, providerOrdinal,
        previousAttemptId: input.previousAttemptId, state: 'created', attemptDigest, deadlineAt,
        createdAt: now, updatedAt: now,
      }).returning();
      const attempt = inserted[0];
      const sessionEvents = await tx.select({ sequence: coordinationV2SessionEvents.sequence })
        .from(coordinationV2SessionEvents)
        .where(eq(coordinationV2SessionEvents.sessionId, session.id))
        .orderBy(desc(coordinationV2SessionEvents.sequence)).limit(1);
      await tx.update(coordinationV2Sessions).set({
        state: result.state.state, updatedAt: now,
      }).where(eq(coordinationV2Sessions.id, session.id));
      await tx.insert(coordinationV2SessionEvents).values({
        id: result.event.eventId, sessionId: session.id, sequence: (sessionEvents[0]?.sequence ?? 0) + 1,
        fromState: result.event.from, toState: result.event.to, eventType: result.event.kind,
        actorType: 'operator', actorId: input.actorId, requestKey: input.requestKey,
        metadata: { commandDigest: hash({ provider, model, adapterVersion, previousAttemptId: input.previousAttemptId ?? null }) },
        createdAt: now,
      });
      await tx.insert(coordinationV2AttemptEvents).values({
        id: randomUUID(), attemptId: attempt.id, sequence: 1, fromState: null, toState: 'created',
        eventType: 'attempt_created', actorType: 'operator', actorId: input.actorId,
        requestKey: input.requestKey,
        metadata: {
          attemptDigest,
          commandDigest: hash({ generation, provider, model, adapterVersion, previousAttemptId: input.previousAttemptId ?? null }),
          resultSnapshot: dto(attempt),
        }, createdAt: now,
      });
      return { ...dto(attempt), created: true };
    });
  } catch (error) {
    if (error instanceof CoordinationAttemptError) throw error;
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '23505') fail('ATTEMPT_REQUEST_REPLAY_CONFLICT');
    if (pgCode === '23514') fail('ATTEMPT_TRANSITION_REJECTED');
    if (pgCode === '40001' || pgCode === '40P01') fail('ATTEMPT_RETRYABLE_DATABASE_CONFLICT');
    fail('ATTEMPT_DATABASE_UNAVAILABLE');
  }
}

export type AttemptTransitionInput = {
  attemptId: string;
  requestKey: string;
  actorId: string;
  command: Omit<AttemptCommand, 'requestId' | 'eventId' | 'now'>;
  now?: Date;
};

export async function transitionCoordinationAttempt(input: AttemptTransitionInput) {
  required(input.attemptId, 'attemptId'); required(input.requestKey, 'requestKey'); required(input.actorId, 'actorId');
  const now = input.now ?? new Date();
  try {
    return await db.transaction(async (tx) => {
      // Lock the session before the attempt; a completion/fallback and a
      // transport transition therefore serialize through one authority row.
      const attemptLookup = await tx.select().from(coordinationV2Attempts)
        .where(eq(coordinationV2Attempts.id, input.attemptId));
      const attemptRef = attemptLookup[0] as CoordinationV2Attempt | undefined;
      if (!attemptRef) fail('ATTEMPT_NOT_FOUND');
      let session: CoordinationV2Session;
      try {
        ({ session } = await authorizeCoordinationLifecycleInTransaction(tx, {
          sessionId: attemptRef.sessionId, actorId: input.actorId, action: 'resume', now,
        }));
      } catch (error) {
        if (error instanceof CoordinationLifecycleAuthorizationError) {
          if (error.code === 'LIFECYCLE_SESSION_NOT_FOUND') fail('ATTEMPT_SESSION_NOT_FOUND');
          fail('ATTEMPT_TRANSITION_REJECTED', { reason: error.code });
        }
        throw error;
      }
      const attempt = await lockById(tx, coordinationV2Attempts, input.attemptId) as CoordinationV2Attempt | undefined;
      if (!attempt) fail('ATTEMPT_NOT_FOUND');
      const prior = await tx.select().from(coordinationV2AttemptEvents)
        .where(and(eq(coordinationV2AttemptEvents.attemptId, attempt.id), eq(coordinationV2AttemptEvents.requestKey, input.requestKey)));
      if (prior[0]) {
        if ((prior[0].metadata as Record<string, unknown>)?.commandDigest !== hash(input.command)) fail('ATTEMPT_REQUEST_REPLAY_CONFLICT');
        return ((prior[0].metadata as Record<string, unknown>)?.resultSnapshot ?? dto(attempt)) as ReturnType<typeof dto>;
      }
      const result = reduceAttempt(attemptState(attempt), {
        ...(input.command as AttemptCommand), requestId: input.requestKey, eventId: randomUUID(), now: now.getTime(),
      });
      if (!result.ok) fail('ATTEMPT_TRANSITION_REJECTED', { reason: result.code });
      const updated = await tx.update(coordinationV2Attempts).set({
        state: result.state.state, failureClassification: result.state.failureClassification,
        resultCode: result.state.resultCode, terminalAt: result.state.terminalAt ? new Date(result.state.terminalAt) : null,
        updatedAt: now,
      }).where(eq(coordinationV2Attempts.id, attempt.id)).returning();
      const seq = await tx.select({ sequence: coordinationV2AttemptEvents.sequence }).from(coordinationV2AttemptEvents)
        .where(eq(coordinationV2AttemptEvents.attemptId, attempt.id)).orderBy(desc(coordinationV2AttemptEvents.sequence)).limit(1);
      await tx.insert(coordinationV2AttemptEvents).values({
        id: result.event.eventId, attemptId: attempt.id, sequence: (seq[0]?.sequence ?? 0) + 1,
        fromState: result.event.from, toState: result.event.to, eventType: result.event.kind,
        actorType: 'operator', actorId: input.actorId, failureClassification: result.event.classification,
        resultCode: result.event.resultCode, requestKey: input.requestKey,
        metadata: { commandDigest: hash(input.command), resultSnapshot: dto(updated[0]) }, createdAt: now,
      });
      return dto(updated[0]);
    });
  } catch (error) {
    if (error instanceof CoordinationAttemptError) throw error;
    const pgCode = (error as { code?: string }).code;
    if (pgCode === '23505') fail('ATTEMPT_REQUEST_REPLAY_CONFLICT');
    if (pgCode === '23514') fail('ATTEMPT_TRANSITION_REJECTED');
    if (pgCode === '40001' || pgCode === '40P01') fail('ATTEMPT_RETRYABLE_DATABASE_CONFLICT');
    fail('ATTEMPT_DATABASE_UNAVAILABLE');
  }
}

export const createCoordinationAttempt = createFreshAttempt;
export const transitionAttemptTransactionally = transitionCoordinationAttempt;
export const createAttempt = createFreshAttempt;
export const transitionAttempt = transitionCoordinationAttempt;

export async function resumeSameCoordinationAttempt(input: {
  attemptId: string;
  requestKey: string;
  actorId: string;
  now?: Date;
}) {
  return transitionCoordinationAttempt({
    ...input,
    command: { type: 'transport_recovered' },
  });
}