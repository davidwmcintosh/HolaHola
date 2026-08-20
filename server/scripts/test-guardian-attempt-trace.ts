/**
 * Hermetic Guardian attempt trace coverage.
 *
 * Verifies the trace model without Gemini, sockets, or a database:
 * delivery, stale discard, queued-but-unconsumed, and unrelated Archive calls.
 *
 * Run: npx tsx server/scripts/test-guardian-attempt-trace.ts
 */

import {
  appendGuardianTraceEvent,
  canLinkGuardianArchiveCall,
  createGuardianAttempt,
  finalizeGuardianAttempt,
  selectGuardianArchiveCandidate,
} from '../services/guardian-attempt-trace';

let passed = 0;
let failed = 0;

function assert(label: string, actual: boolean): void {
  if (actual) {
    console.log(`✓ ${label}`);
    passed++;
  } else {
    console.error(`✗ ${label}`);
    failed++;
  }
}

function attempt(turn = 7) {
  return createGuardianAttempt({
    path: 'pre-turn',
    studentTurnEpoch: turn,
    studentUtterance: 'I think you remember what I told you about my first class.',
    candidateAssertion: 'you remember what I told you about my first class',
  });
}

console.log('Guardian attempt trace — hermetic checks\n');

// Delivery: tool-response dispatch and a subsequently related Archive call are
// strong evidence of a connected intervention, without claiming the model's intent.
{
  const trace = attempt();
  appendGuardianTraceEvent(trace, { type: 'lookup_completed' });
  appendGuardianTraceEvent(trace, { type: 'queued', channel: 'tool-response' });
  appendGuardianTraceEvent(trace, { type: 'injected', channel: 'tool-response', modelTurnId: 12, toolBatchSequence: 4 });
  appendGuardianTraceEvent(trace, { type: 'tool_response_consumed', channel: 'tool-response', modelTurnId: 12, toolBatchSequence: 4 });
  appendGuardianTraceEvent(trace, { type: 'tool_response_sent', channel: 'tool-response', modelTurnId: 12, toolBatchSequence: 4 });
  assert('delivered attempt can link a later Archive batch on its own student turn', canLinkGuardianArchiveCall(trace, 7, 5));
  appendGuardianTraceEvent(trace, { type: 'archive_call_linked', archiveTool: 'grounding_query', modelTurnId: 13 });
  assert('delivery with related Archive call has an explicit connected outcome', finalizeGuardianAttempt(trace, 13) === 'injected_with_related_archive_call');
}

// Queue replacement: the displaced payload must become terminal immediately,
// never linger as a misleading queued attempt.
{
  const trace = attempt();
  appendGuardianTraceEvent(trace, { type: 'lookup_completed' });
  appendGuardianTraceEvent(trace, { type: 'queued', channel: 'tool-response' });
  appendGuardianTraceEvent(trace, {
    type: 'superseded',
    detail: 'A newer Guardian payload replaced the single queue slot.',
  });
  assert('a displaced queued attempt is terminally superseded', finalizeGuardianAttempt(trace, 15) === 'superseded');
}

// Stale: a newer utterance ends the attempt instead of letting it bleed forward.
{
  const trace = attempt();
  appendGuardianTraceEvent(trace, { type: 'lookup_completed' });
  appendGuardianTraceEvent(trace, { type: 'stale_discarded', detail: 'Newer student utterance began.' });
  assert('stale discard is terminal and not reported as a miss', finalizeGuardianAttempt(trace, 14) === 'stale_discarded');
}

// Queued-but-unconsumed: trace the failure boundary honestly rather than applying
// a heuristic label to Daniela.
{
  const trace = attempt();
  appendGuardianTraceEvent(trace, { type: 'lookup_completed' });
  appendGuardianTraceEvent(trace, { type: 'queued', channel: 'tool-response' });
  assert('queued attempt with no dispatch is explicitly queued-but-unconsumed', finalizeGuardianAttempt(trace, 15) === 'queued_unconsumed');
}

// Direct sendClientContent has no function-response batch of its own. Its
// dispatch marker must still let a following tool-call batch be attributed.
{
  const trace = attempt();
  appendGuardianTraceEvent(trace, { type: 'lookup_completed' });
  appendGuardianTraceEvent(trace, {
    type: 'injected',
    channel: 'send-client-content',
    modelTurnId: 16,
    toolBatchSequence: 3,
  });
  assert('direct-channel delivery can link a later Archive batch', canLinkGuardianArchiveCall(trace, 7, 4));
}

// Unrelated Archive call: a matching tool name alone must not satisfy another
// student turn's intervention.
{
  const trace = attempt(7);
  appendGuardianTraceEvent(trace, { type: 'lookup_completed' });
  appendGuardianTraceEvent(trace, { type: 'queued', channel: 'tool-response' });
  appendGuardianTraceEvent(trace, { type: 'tool_response_sent', channel: 'tool-response', modelTurnId: 16, toolBatchSequence: 9 });
  assert('unrelated Archive call from a newer student turn is not attributed', !canLinkGuardianArchiveCall(trace, 8, 10));
  assert('Archive call from the pre-dispatch batch is not attributed', !canLinkGuardianArchiveCall(trace, 7, 9));
  assert('later Archive batch in the same Gemini model turn is attributed', canLinkGuardianArchiveCall(trace, 7, 10));
}

// Competing deliveries: the latest distinct delivery is the only candidate;
// equal delivery batches are observably ambiguous and must remain unknown.
{
  const earlier = attempt(7);
  const later = attempt(7);
  for (const [trace, batch] of [[earlier, 4], [later, 6]] as const) {
    appendGuardianTraceEvent(trace, { type: 'lookup_completed' });
    appendGuardianTraceEvent(trace, { type: 'queued', channel: 'tool-response' });
    appendGuardianTraceEvent(trace, { type: 'tool_response_sent', channel: 'tool-response', toolBatchSequence: batch });
  }
  assert(
    'only the latest eligible delivery receives a later Archive attribution',
    selectGuardianArchiveCandidate([earlier, later], 7, 7)?.attemptId === later.attemptId,
  );

  const sameBatchA = attempt(7);
  const sameBatchB = attempt(7);
  for (const trace of [sameBatchA, sameBatchB]) {
    appendGuardianTraceEvent(trace, { type: 'lookup_completed' });
    appendGuardianTraceEvent(trace, { type: 'queued', channel: 'tool-response' });
    appendGuardianTraceEvent(trace, { type: 'tool_response_sent', channel: 'tool-response', toolBatchSequence: 8 });
  }
  assert(
    'same-batch competing deliveries remain unlinked rather than being over-attributed',
    selectGuardianArchiveCandidate([sameBatchA, sameBatchB], 7, 9) === null,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);