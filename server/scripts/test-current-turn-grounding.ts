/**
 * Regression check: an old Guardian lookup must never make Daniela answer an
 * earlier subject after David begins a new utterance.
 *
 * Reproduces the live diagnostic sequence:
 *   1. Earlier guitar assertion starts an Archive lookup.
 *   2. David asks about the counting game before that lookup resolves.
 *   3. The guitar result is stale and must be discarded.
 *   4. The current counting lookup remains the only grounding context.
 *
 * Run: npx tsx server/scripts/test-current-turn-grounding.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  createGroundingTurnBinding,
  formatCurrentTurnGroundingContext,
  isGroundingBindingCurrent,
} from '../services/gemini-live-session';

let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓  ${label}`);
  } else {
    failures++;
    console.error(`  ✗  ${label}`);
  }
}

console.log('\n[1] Guitar lookup becomes stale when counting begins');

const guitarTurn = createGroundingTurnBinding(
  41,
  'You said earlier that I played guitar. Do you remember that?',
  'I played guitar',
);
const countingTurn = createGroundingTurnBinding(
  42,
  'Do you remember our counting game? We take turns: I say one, then you say two.',
  'our counting game',
);

assert(
  guitarTurn.candidateAssertion === 'I played guitar',
  'Earlier lookup retains its exact guitar candidate assertion',
);
assert(
  countingTurn.candidateAssertion === 'our counting game',
  'New lookup targets the counting-game candidate, not the earlier guitar claim',
);
assert(
  !isGroundingBindingCurrent(guitarTurn, countingTurn.studentTurnEpoch),
  'Late guitar result is rejected for the newer counting turn',
);
assert(
  isGroundingBindingCurrent(countingTurn, countingTurn.studentTurnEpoch),
  'Counting result remains valid for its own student turn',
);

console.log('\n[2] Failed verification stays honest and current-topic-bound');

const replyGrounding = formatCurrentTurnGroundingContext(countingTurn, '');

assert(
  replyGrounding.includes('Do you remember our counting game?'),
  'Reply context names David’s current counting-game question',
);
assert(
  replyGrounding.includes('Candidate memory assertion under evaluation: "our counting game"'),
  'Reply context identifies the exact current candidate being verified',
);
assert(
  replyGrounding.includes('No verified Archive source surfaced for this candidate.'),
  'A failed current lookup preserves explicit, bounded uncertainty',
);
assert(
  !replyGrounding.toLowerCase().includes('guitar'),
  'Reply context cannot redirect Daniela to the stale guitar topic',
);

console.log('\n[3] Delayed post-turn and hard-wall checks cannot repopulate the queue');

async function assertDelayedGroundingIsDiscarded(
  label: string,
  origin: ReturnType<typeof createGroundingTurnBinding>,
): Promise<void> {
  let activeEpoch = origin.studentTurnEpoch;
  let resolveLookup!: (result: string) => void;
  const delayedLookup = new Promise<string>(resolve => { resolveLookup = resolve; });
  let queuedGrounding: string | null = null;
  let queuedBinding: ReturnType<typeof createGroundingTurnBinding> | null = null;

  const completion = delayedLookup.then(result => {
    if (!isGroundingBindingCurrent(origin, activeEpoch)) return;
    queuedGrounding = result;
    queuedBinding = origin;
  });

  // This is the timing race from the live failure: Daniela's preceding response
  // starts an Archive check, then David begins a newer counting-game utterance
  // before the old lookup completes.
  activeEpoch = countingTurn.studentTurnEpoch;
  resolveLookup(`${label} result about guitar`);
  await completion;

  assert(
    queuedGrounding === null && queuedBinding === null,
    `${label} result resolving after counting begins is never queued`,
  );
}

await assertDelayedGroundingIsDiscarded('Post-turn frictionless-slide', guitarTurn);
await assertDelayedGroundingIsDiscarded('Hard-wall correction', guitarTurn);

const queuedBeforeNewTurn = {
  text: 'old guitar correction',
  binding: guitarTurn,
};
const toolResponseGrounding = isGroundingBindingCurrent(
  queuedBeforeNewTurn.binding,
  countingTurn.studentTurnEpoch,
) ? queuedBeforeNewTurn.text : null;
assert(
  toolResponseGrounding === null,
  'A queue populated before the new turn is also rejected immediately before tool delivery',
);

console.log('\n[4] Production guard remains wired to the turn binding');

const sourcePath = path.resolve(process.cwd(), 'server/services/gemini-live-session.ts');
const source = fs.readFileSync(sourcePath, 'utf8');

assert(
  source.includes('createGroundingTurnBinding(\n            this.activeStudentTurnEpoch,'),
  'Guardian binds each lookup to the active student turn',
);
assert(
  source.includes('groundingBinding.candidateAssertion,'),
  'Auto-grounding query uses the exact bound candidate assertion',
);
assert(
  source.includes('Discarding stale grounding result for'),
  'Resolved lookup is discarded when its original turn is no longer active',
);
assert(
  source.includes('Discarding stale carry-forward grounding from student turn'),
  'Carry-forward grounding is discarded when a newer utterance begins',
);
assert(
  source.includes('private pendingWeeOoGroundingBinding: GroundingTurnBinding | null = null;'),
  'Post-turn tool-channel queue carries its originating turn binding',
);
assert(
  source.includes('[FrictionlessSlide/GL] Discarding stale grounding from student turn'),
  'Frictionless-slide completion rejects a result that resolves after a newer turn',
);
assert(
  source.includes('[FrictionSignal/GL] Discarding stale grounding from student turn'),
  'Friction-signal completion rejects a result that resolves after a newer turn',
);
assert(
  source.includes('[HardWall] Discarding stale correction from student turn'),
  'Hard-wall completion rejects a result that resolves after a newer turn',
);
assert(
  source.includes('Discarding stale or unbound queued grounding before tool response.'),
  'Tool-response injection validates the queued binding immediately before delivery',
);
assert(
  source.includes('CURRENT STUDENT TURN — ANSWER THIS FIRST:'),
  'Injected grounding explicitly prioritizes the current student utterance',
);

console.log('\n' + '─'.repeat(68));
if (failures === 0) {
  console.log('✓ Current-turn grounding guard passed: counting remains primary.');
  process.exit(0);
}

console.error(`✗ ${failures} current-turn grounding assertion(s) failed.`);
process.exit(1);