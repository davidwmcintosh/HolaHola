import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  coordinationV2CleanupObligations,
  coordinationV2SessionEvents,
  coordinationV2Sessions,
  coordinationV2TransportLeases,
} from '@shared/schema';

export type CoordinationCanonicalState =
  | 'preparing'
  | 'ready'
  | 'running'
  | 'waiting_for_host'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'exhausted'
  | 'expired'
  | 'revoked';

export type CoordinationStatusBlockingReason = Readonly<{
  code:
    | 'preparation_pending'
    | 'attempt_pending'
    | 'execution_in_progress'
    | 'waiting_for_host'
    | 'verification_pending'
    | 'execution_failed'
    | 'attempt_budget_exhausted'
    | 'session_expired'
    | 'session_revoked'
    | 'cleanup_required';
  phase: 'preparation' | 'execution' | 'host' | 'verification' | 'terminal' | 'cleanup';
  retryable: boolean;
}>;

export type CoordinationSessionStatus = Readonly<{
  sessionId: string;
  /** The persisted execution result. Cleanup never rewrites this value. */
  canonicalState: CoordinationCanonicalState;
  /** Kept as a small compatibility alias for existing operator clients. */
  state: CoordinationCanonicalState;
  terminalResult: CoordinationCanonicalState | null;
  currentActiveLeaseHolder: string | null;
  lastTransition: Readonly<{
    fromState: string | null;
    toState: string;
    eventType: string;
    occurredAt: string;
  }> | null;
  nextAction:
    | 'await_preparation'
    | 'start_attempt'
    | 'continue_attempt'
    | 'await_host'
    | 'submit_completion'
    | 'repair_cleanup'
    | 'none';
  blockingReason: CoordinationStatusBlockingReason | null;
  cleanupRequired: boolean;
  cleanupState: 'cleanup_required' | 'complete' | null;
}>;

export class CoordinationSessionStatusError extends Error {
  readonly code:
    | 'STATUS_INVALID_REQUEST'
    | 'STATUS_NOT_FOUND'
    | 'STATUS_NOT_AUTHORIZED'
    | 'STATUS_DATABASE_UNAVAILABLE';

  constructor(code: CoordinationSessionStatusError['code']) {
    super(code);
    this.name = 'CoordinationSessionStatusError';
    this.code = code;
  }
}

export type CoordinationSessionStatusInput = Readonly<{
  sessionId: string;
  actorId: string;
}>;

type TransitionProjection = Readonly<{
  fromState: string | null;
  toState: string;
  eventType: string;
  createdAt: Date | string;
}>;

export type CoordinationSessionStatusProjectionInput = Readonly<{
  sessionId: string;
  state: string;
  transition: TransitionProjection | null;
  activeLeaseHolder?: string | null;
  holderVisible?: boolean;
  cleanupObligationStates: readonly string[];
}>;

const CANONICAL_STATES = new Set<CoordinationCanonicalState>([
  'preparing', 'ready', 'running', 'waiting_for_host', 'verifying',
  'succeeded', 'failed', 'exhausted', 'expired', 'revoked',
]);
const TERMINAL_STATES = new Set<CoordinationCanonicalState>([
  'succeeded', 'failed', 'exhausted', 'expired', 'revoked',
]);

function canonicalState(value: string): CoordinationCanonicalState {
  if (!CANONICAL_STATES.has(value as CoordinationCanonicalState)) {
    throw new CoordinationSessionStatusError('STATUS_DATABASE_UNAVAILABLE');
  }
  return value as CoordinationCanonicalState;
}

/*
 * Holder IDs are coordinator-generated opaque labels. Keep this additional
 * shape check so malformed or accidentally path-like values never become
 * operator output. The authorization query only sets holderVisible when the
 * actor's grant contains the status action.
 */
function safeHolder(value: string | null | undefined, visible: boolean): string | null {
  if (!visible || !value || value.length > 128
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) return null;
  return value;
}

function transitionDate(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new CoordinationSessionStatusError('STATUS_DATABASE_UNAVAILABLE');
  }
  return date.toISOString();
}

const SAFE_TRANSITION_EVENTS = new Set([
  'session_created',
  'session_ready',
  'attempt_started',
  'transport_resumed',
  'fresh_attempt',
  'host_waiting',
  'verification_started',
  'completion_accepted',
  'session_failed',
  'session_exhausted',
  'session_expired',
  'session_revoked',
]);

function safeTransitionValue(value: string | null, fallback: string): string | null {
  return value !== null && CANONICAL_STATES.has(value as CoordinationCanonicalState) ? value : fallback;
}

function safeTransitionEvent(value: string): string {
  return SAFE_TRANSITION_EVENTS.has(value) ? value : 'state_transition';
}

function blockingReason(
  state: CoordinationCanonicalState,
  cleanupRequired: boolean,
): CoordinationStatusBlockingReason | null {
  if (cleanupRequired) {
    return { code: 'cleanup_required', phase: 'cleanup', retryable: true };
  }
  switch (state) {
    case 'preparing':
      return { code: 'preparation_pending', phase: 'preparation', retryable: true };
    case 'ready':
      return { code: 'attempt_pending', phase: 'execution', retryable: true };
    case 'running':
      return { code: 'execution_in_progress', phase: 'execution', retryable: true };
    case 'waiting_for_host':
      return { code: 'waiting_for_host', phase: 'host', retryable: true };
    case 'verifying':
      return { code: 'verification_pending', phase: 'verification', retryable: true };
    case 'failed':
      return { code: 'execution_failed', phase: 'terminal', retryable: false };
    case 'exhausted':
      return { code: 'attempt_budget_exhausted', phase: 'terminal', retryable: false };
    case 'expired':
      return { code: 'session_expired', phase: 'terminal', retryable: false };
    case 'revoked':
      return { code: 'session_revoked', phase: 'terminal', retryable: false };
    case 'succeeded':
      return null;
    default:
      return null;
  }
}

function nextAction(
  state: CoordinationCanonicalState,
  cleanupRequired: boolean,
): CoordinationSessionStatus['nextAction'] {
  if (cleanupRequired) return 'repair_cleanup';
  switch (state) {
    case 'preparing': return 'await_preparation';
    case 'ready': return 'start_attempt';
    case 'running': return 'continue_attempt';
    case 'waiting_for_host': return 'await_host';
    case 'verifying': return 'submit_completion';
    default: return 'none';
  }
}

/**
 * Pure projection used by the database reader and by focused safety tests.
 * No internal authority, policy, grant, credential, digest, path, or command
 * fields are accepted by or emitted from this function.
 */
export function projectCoordinationSessionStatus(
  input: CoordinationSessionStatusProjectionInput,
): CoordinationSessionStatus {
  const state = canonicalState(input.state);
  const terminal = TERMINAL_STATES.has(state);
  const cleanupRequired = terminal
    && (input.cleanupObligationStates.length === 0
      || input.cleanupObligationStates.some((value) => value !== 'acknowledged'));
  const cleanupState = terminal ? (cleanupRequired ? 'cleanup_required' : 'complete') : null;
  const transition = input.transition
    ? {
      fromState: safeTransitionValue(input.transition.fromState, 'unknown'),
      toState: safeTransitionValue(input.transition.toState, 'unknown') ?? 'unknown',
      eventType: safeTransitionEvent(input.transition.eventType),
      occurredAt: transitionDate(input.transition.createdAt),
    }
    : null;

  return Object.freeze({
    sessionId: safeHolder(input.sessionId, true) ?? 'unknown',
    canonicalState: state,
    state,
    terminalResult: terminal ? state : null,
    currentActiveLeaseHolder: safeHolder(input.activeLeaseHolder, input.holderVisible === true),
    lastTransition: transition,
    nextAction: nextAction(state, cleanupRequired),
    blockingReason: blockingReason(state, cleanupRequired),
    cleanupRequired,
    cleanupState,
  });
}

function required(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value.trim() !== value) {
    throw new CoordinationSessionStatusError('STATUS_INVALID_REQUEST');
  }
  return value;
}

/**
 * Read a status projection from one PostgreSQL repeatable-read snapshot.
 *
 * Status is a historical read, not new execution authority. It binds to the
 * immutable operator actor recorded on the session so terminal history remains
 * readable after grants expire or hosts are retired.
 */
export function getCoordinationSessionStatus(
  input: CoordinationSessionStatusInput,
): Promise<CoordinationSessionStatus>;
export function getCoordinationSessionStatus(
  sessionId: string,
  actorId: string,
): Promise<CoordinationSessionStatus>;
export async function getCoordinationSessionStatus(
  inputOrSessionId: CoordinationSessionStatusInput | string,
  actorIdArgument?: string,
): Promise<CoordinationSessionStatus> {
  const sessionId = typeof inputOrSessionId === 'string'
    ? inputOrSessionId : inputOrSessionId.sessionId;
  const actorId = typeof inputOrSessionId === 'string'
    ? actorIdArgument : inputOrSessionId.actorId;
  const validSessionId = required(sessionId, 'sessionId');
  const validActorId = required(actorId, 'actorId');
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
      const sessions = await tx.select({
        id: coordinationV2Sessions.id,
        state: coordinationV2Sessions.state,
        operatorActor: coordinationV2Sessions.operatorActor,
      }).from(coordinationV2Sessions)
        .where(eq(coordinationV2Sessions.id, validSessionId))
        .limit(1);
      const session = sessions[0];
      if (!session) throw new CoordinationSessionStatusError('STATUS_NOT_FOUND');
      if (session.operatorActor !== validActorId) {
        throw new CoordinationSessionStatusError('STATUS_NOT_AUTHORIZED');
      }

      const transitions = await tx.select({
        fromState: coordinationV2SessionEvents.fromState,
        toState: coordinationV2SessionEvents.toState,
        eventType: coordinationV2SessionEvents.eventType,
        createdAt: coordinationV2SessionEvents.createdAt,
      }).from(coordinationV2SessionEvents)
        .where(eq(coordinationV2SessionEvents.sessionId, validSessionId))
        .orderBy(desc(coordinationV2SessionEvents.sequence))
        .limit(1);
      const leases = await tx.select({
        holderInstanceId: coordinationV2TransportLeases.holderInstanceId,
      }).from(coordinationV2TransportLeases)
        .where(and(
          eq(coordinationV2TransportLeases.sessionId, validSessionId),
          eq(coordinationV2TransportLeases.state, 'active'),
          gt(coordinationV2TransportLeases.expiresAt, sql`CURRENT_TIMESTAMP`),
        ))
        .orderBy(desc(coordinationV2TransportLeases.epoch))
        .limit(1);
      const obligations = await tx.select({
        state: coordinationV2CleanupObligations.state,
      }).from(coordinationV2CleanupObligations)
        .where(eq(coordinationV2CleanupObligations.sessionId, validSessionId));

      return projectCoordinationSessionStatus({
        sessionId: session.id,
        state: session.state,
        transition: transitions[0]
          ? {
            fromState: transitions[0].fromState,
            toState: transitions[0].toState,
            eventType: transitions[0].eventType,
            createdAt: transitions[0].createdAt,
          }
          : null,
        activeLeaseHolder: leases[0]?.holderInstanceId ?? null,
        holderVisible: true,
        cleanupObligationStates: obligations.map((obligation) => obligation.state),
      });
    });
  } catch (error) {
    if (error instanceof CoordinationSessionStatusError) throw error;
    const code = (error as { code?: string }).code;
    if (code === '40001' || code === '40P01') {
      throw new CoordinationSessionStatusError('STATUS_DATABASE_UNAVAILABLE');
    }
    throw new CoordinationSessionStatusError('STATUS_DATABASE_UNAVAILABLE');
  }
}

export const readCoordinationSessionStatus = getCoordinationSessionStatus;