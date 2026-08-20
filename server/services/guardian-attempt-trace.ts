import { randomUUID } from 'crypto';

export type GuardianAttemptPath =
  | 'pre-turn'
  | 'post-turn-phrase'
  | 'friction-signal'
  | 'hard-wall';

export type GuardianTraceEventType =
  | 'lookup_started'
  | 'lookup_completed'
  | 'lookup_failed'
  | 'queued'
  | 'injected'
  | 'tool_response_consumed'
  | 'tool_response_sent'
  | 'archive_call_linked'
  | 'stale_discarded'
  | 'superseded'
  | 'generation_completed'
  | 'generation_interrupted';

/**
 * The terminal status deliberately distinguishes delivery evidence from model
 * behavior. A tool response sent to Gemini is evidence of delivery to the API,
 * not evidence that Daniela used it. That distinction is essential for an
 * honest grounding diagnosis.
 */
export type GuardianTerminalOutcome =
  | 'lookup_failed'
  | 'stale_discarded'
  | 'superseded'
  | 'queued_unconsumed'
  | 'injected_delivery_unknown'
  | 'injected_with_related_archive_call'
  | 'delivery_unknown'
  | null;

export interface GuardianTraceEvent {
  type: GuardianTraceEventType;
  ts: string;
  channel?: 'tool-response' | 'send-client-content';
  modelTurnId?: number;
  /** Monotonic function-call batch order within this Live session. */
  toolBatchSequence?: number;
  archiveTool?: string;
  detail?: string;
}

export interface GuardianAttemptTrace {
  attemptId: string;
  path: GuardianAttemptPath;
  studentTurnEpoch: number;
  studentUtterance: string;
  candidateAssertion: string;
  startedAt: string;
  events: GuardianTraceEvent[];
  terminalOutcome: GuardianTerminalOutcome;
}

export function createGuardianAttempt(input: Omit<GuardianAttemptTrace, 'attemptId' | 'startedAt' | 'events' | 'terminalOutcome'>): GuardianAttemptTrace {
  const startedAt = new Date().toISOString();
  return {
    ...input,
    attemptId: randomUUID(),
    startedAt,
    events: [{ type: 'lookup_started', ts: startedAt }],
    terminalOutcome: null,
  };
}

export function appendGuardianTraceEvent(
  attempt: GuardianAttemptTrace,
  event: Omit<GuardianTraceEvent, 'ts'>,
): GuardianTraceEvent {
  const record: GuardianTraceEvent = { ...event, ts: new Date().toISOString() };
  attempt.events.push(record);
  return record;
}

export function resolveGuardianTerminalOutcome(attempt: GuardianAttemptTrace): GuardianTerminalOutcome {
  const types = new Set(attempt.events.map(event => event.type));
  if (types.has('lookup_failed')) return 'lookup_failed';
  if (types.has('stale_discarded')) return 'stale_discarded';
  if (types.has('superseded')) return 'superseded';
  if (types.has('tool_response_sent') || attempt.events.some(event => event.channel === 'send-client-content')) {
    return types.has('archive_call_linked')
      ? 'injected_with_related_archive_call'
      : 'injected_delivery_unknown';
  }
  if (types.has('queued')) return 'queued_unconsumed';
  return 'delivery_unknown';
}

export function canLinkGuardianArchiveCall(
  attempt: GuardianAttemptTrace,
  activeStudentTurnEpoch: number,
  currentToolBatchSequence: number,
): boolean {
  const deliveryBatches = attempt.events
    .filter(event => event.type === 'tool_response_sent' || event.channel === 'send-client-content')
    .map(event => event.toolBatchSequence)
    .filter((sequence): sequence is number => typeof sequence === 'number');
  const deliveryBatch = deliveryBatches.length > 0 ? Math.max(...deliveryBatches) : null;
  const alreadyLinked = attempt.events.some(event => event.type === 'archive_call_linked');
  return (
    !attempt.terminalOutcome
    && !alreadyLinked
    && deliveryBatch !== null
    // Tool calls in the dispatch batch preceded delivery. A later batch is
    // the only observable Archive call that could have followed the response.
    && currentToolBatchSequence > deliveryBatch
    && attempt.studentTurnEpoch === activeStudentTurnEpoch
  );
}

/**
 * A later Archive call can only be attributed when exactly one most-recent
 * Guardian delivery precedes it. Two payloads in the same delivery batch are
 * indistinguishable to telemetry, so that case deliberately remains unknown.
 */
export function selectGuardianArchiveCandidate(
  attempts: readonly GuardianAttemptTrace[],
  activeStudentTurnEpoch: number,
  currentToolBatchSequence: number,
): GuardianAttemptTrace | null {
  const eligible = attempts.filter(attempt =>
    canLinkGuardianArchiveCall(attempt, activeStudentTurnEpoch, currentToolBatchSequence),
  );
  if (eligible.length === 0) return null;

  const deliveryBatch = (attempt: GuardianAttemptTrace): number =>
    Math.max(...attempt.events
      .filter(event => event.type === 'tool_response_sent' || event.channel === 'send-client-content')
      .map(event => event.toolBatchSequence)
      .filter((sequence): sequence is number => typeof sequence === 'number'));

  const newestBatch = Math.max(...eligible.map(deliveryBatch));
  const newest = eligible.filter(attempt => deliveryBatch(attempt) === newestBatch);
  return newest.length === 1 ? newest[0] : null;
}

export function finalizeGuardianAttempt(
  attempt: GuardianAttemptTrace,
  modelTurnId: number,
): GuardianTerminalOutcome {
  if (attempt.terminalOutcome) return attempt.terminalOutcome;
  appendGuardianTraceEvent(attempt, { type: 'generation_completed', modelTurnId });
  attempt.terminalOutcome = resolveGuardianTerminalOutcome(attempt);
  return attempt.terminalOutcome;
}