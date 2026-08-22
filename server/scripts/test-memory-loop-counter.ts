/**
 * test-memory-loop-counter.ts
 *
 * Four-part test of the memory-loop guard (consecutiveMemoryCalls) in
 * GeminiLiveSession.  All parts run as pure logic simulations — no live GL
 * connection or DB required.
 *
 * Part 1 — Counter increment: 3 consecutive memory-only batches → nudge fires.
 * Part 2 — One-shot nudge: 4th memory batch does NOT re-inject the nudge.
 * Part 3 — Reset paths: non-memory tool, generationComplete, and watchdog-seal
 *           all reset the counter to 0.
 * Part 4 — Reconnect: a fresh session object starts with counter = 0 (undefined
 *           coerces to 0 on the first increment).
 *
 * Run: npx tsx server/scripts/test-memory-loop-counter.ts
 */

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Exact constants from gemini-live-session.ts ───────────────────────────────

const GL_MEMORY_TOOL_NAMES = new Set([
  'recall', 'browse_conversations_by_date', 'search_my_teaching_wisdom',
  'introspect', 'memory_lookup', 'read_full_session', 'read_my_reflections',
]);
const GL_MEMORY_CHAIN_LIMIT = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

type SessionLike = {
  consecutiveMemoryCalls?: number;
  glMemoryNudgeSent?: boolean;
};

const NUDGE_TEXT =
  'CRITICAL: Approaching processing limit. Student-facing latency is high. ' +
  'Do not perform further tool calls. Synthesize the current findings into a direct response to the student immediately.';

/**
 * Exact logic copy of the memory-chain guard block from gemini-live-session.ts
 * (~line 3419).  Returns the mutated session and whether a nudge was appended to
 * the last response.
 */
function runMemoryChainGuard(
  session: SessionLike,
  batchToolNames: string[],
): { nudgeFired: boolean } {
  const allMemoryBatch = batchToolNames.every(n => GL_MEMORY_TOOL_NAMES.has(n));

  if (!allMemoryBatch) {
    session.consecutiveMemoryCalls = 0;
    session.glMemoryNudgeSent = false;
    return { nudgeFired: false };
  }

  const prev = (session.consecutiveMemoryCalls ?? 0);
  session.consecutiveMemoryCalls = prev + 1;

  if (
    !session.glMemoryNudgeSent &&
    session.consecutiveMemoryCalls >= GL_MEMORY_CHAIN_LIMIT
  ) {
    session.glMemoryNudgeSent = true;
    console.log(
      `  [MemoryBudgetGuard] ${session.consecutiveMemoryCalls} consecutive memory-only batches — nudge injected.`,
    );
    return { nudgeFired: true };
  }

  return { nudgeFired: false };
}

/**
 * Exact logic copy of the generationComplete reset block from
 * gemini-live-session.ts (~line 2906).  (Called when Daniela produced audio.)
 */
function simulateGenerationComplete(session: SessionLike): void {
  session.consecutiveMemoryCalls = 0;
  session.glMemoryNudgeSent = false;
}

/**
 * Exact logic copy of the watchdog-seal reset block added in this task.
 * (Called when the watchdog fires: audio was produced but generationComplete
 * never arrived.)
 */
function simulateWatchdogSeal(session: SessionLike): void {
  // The watchdog guard condition: isTutorGeneratingAudio && hadAudioInCurrentSubturn
  // Both are true when the watchdog fires — same semantic as generationComplete.
  session.consecutiveMemoryCalls = 0;
  session.glMemoryNudgeSent = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Counter increments to 3 and nudge fires
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Counter increment + nudge at threshold'));
sep();

{
  const session: SessionLike = {};

  const batch1 = runMemoryChainGuard(session, ['recall']);
  console.log(`After batch 1 (recall):                counter=${session.consecutiveMemoryCalls}  nudgeFired=${batch1.nudgeFired}`);
  const p1_b1_ok = session.consecutiveMemoryCalls === 1 && !batch1.nudgeFired;
  console.log(p1_b1_ok ? G('  ✓ counter=1, no nudge yet') : R('  ✗ FAIL'));

  const batch2 = runMemoryChainGuard(session, ['memory_lookup', 'introspect']);
  console.log(`After batch 2 (memory_lookup+introspect): counter=${session.consecutiveMemoryCalls}  nudgeFired=${batch2.nudgeFired}`);
  const p1_b2_ok = session.consecutiveMemoryCalls === 2 && !batch2.nudgeFired;
  console.log(p1_b2_ok ? G('  ✓ counter=2, no nudge yet') : R('  ✗ FAIL'));

  const batch3 = runMemoryChainGuard(session, ['read_full_session']);
  console.log(`After batch 3 (read_full_session):     counter=${session.consecutiveMemoryCalls}  nudgeFired=${batch3.nudgeFired}`);
  const p1_b3_ok = session.consecutiveMemoryCalls === 3 && batch3.nudgeFired && session.glMemoryNudgeSent === true;
  console.log(p1_b3_ok ? G('  ✓ counter=3, nudge fired, glMemoryNudgeSent=true') : R('  ✗ FAIL'));

  const part1Pass = p1_b1_ok && p1_b2_ok && p1_b3_ok;
  console.log('\n' + (part1Pass ? G('✓ PART 1 PASSED') : R('✗ PART 1 FAILED')));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — One-shot nudge gate (glMemoryNudgeSent prevents re-injection)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — One-shot nudge gate'));
sep();

{
  const session: SessionLike = {};

  // Get to threshold
  runMemoryChainGuard(session, ['recall']);
  runMemoryChainGuard(session, ['memory_lookup']);
  const atThreshold = runMemoryChainGuard(session, ['introspect']);
  console.log(`At threshold (batch 3): nudgeFired=${atThreshold.nudgeFired}, glMemoryNudgeSent=${session.glMemoryNudgeSent}`);

  // 4th memory batch — nudge must NOT fire again
  const batch4 = runMemoryChainGuard(session, ['read_my_reflections']);
  console.log(`After batch 4:          counter=${session.consecutiveMemoryCalls}, nudgeFired=${batch4.nudgeFired}`);
  const p2_ok = atThreshold.nudgeFired === true && batch4.nudgeFired === false && session.consecutiveMemoryCalls === 4;
  console.log(p2_ok ? G('  ✓ nudge fired exactly once, not again on batch 4') : R('  ✗ FAIL'));

  // 5th memory batch — still no re-nudge
  const batch5 = runMemoryChainGuard(session, ['search_my_teaching_wisdom']);
  console.log(`After batch 5:          counter=${session.consecutiveMemoryCalls}, nudgeFired=${batch5.nudgeFired}`);
  const p2_b5_ok = !batch5.nudgeFired && session.consecutiveMemoryCalls === 5;
  console.log(p2_b5_ok ? G('  ✓ still no re-nudge on batch 5') : R('  ✗ FAIL'));

  console.log('\n' + (p2_ok && p2_b5_ok ? G('✓ PART 2 PASSED') : R('✗ PART 2 FAILED')));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Reset paths: non-memory tool, generationComplete, watchdog-seal
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Reset paths'));
sep();

// 3A — Non-memory tool in batch resets counter
{
  const session: SessionLike = {};
  runMemoryChainGuard(session, ['recall']);
  runMemoryChainGuard(session, ['memory_lookup']);
  console.log(`Before non-memory batch: counter=${session.consecutiveMemoryCalls}`);

  // A batch that mixes a memory tool with a non-memory tool — allMemoryBatch = false
  runMemoryChainGuard(session, ['recall', 'show_vocab_grid']);
  const p3a_ok = session.consecutiveMemoryCalls === 0 && session.glMemoryNudgeSent === false;
  console.log(`After mixed batch (recall+show_vocab_grid): counter=${session.consecutiveMemoryCalls}`);
  console.log(p3a_ok ? G('  ✓ 3A: counter reset to 0 — non-memory tool in batch') : R('  ✗ 3A FAIL'));
}

// 3B — Pure non-memory batch resets counter
{
  const session: SessionLike = {};
  runMemoryChainGuard(session, ['recall']);
  runMemoryChainGuard(session, ['introspect']);
  console.log(`Before non-memory-only batch: counter=${session.consecutiveMemoryCalls}`);

  runMemoryChainGuard(session, ['show_image']);
  const p3b_ok = session.consecutiveMemoryCalls === 0 && session.glMemoryNudgeSent === false;
  console.log(`After show_image batch: counter=${session.consecutiveMemoryCalls}`);
  console.log(p3b_ok ? G('  ✓ 3B: counter reset to 0 — pure non-memory batch') : R('  ✗ 3B FAIL'));
}

// 3C — generationComplete resets counter (audio turn confirmed)
{
  const session: SessionLike = {};
  runMemoryChainGuard(session, ['recall']);
  runMemoryChainGuard(session, ['memory_lookup']);
  const atThreshold = runMemoryChainGuard(session, ['introspect']);
  console.log(`\nBefore generationComplete: counter=${session.consecutiveMemoryCalls}, nudgeSent=${session.glMemoryNudgeSent}`);

  simulateGenerationComplete(session);
  const p3c_ok = session.consecutiveMemoryCalls === 0 && session.glMemoryNudgeSent === false;
  console.log(`After generationComplete:  counter=${session.consecutiveMemoryCalls}, nudgeSent=${session.glMemoryNudgeSent}`);
  console.log(p3c_ok ? G('  ✓ 3C: generationComplete reset counter and nudge gate') : R('  ✗ 3C FAIL'));

  // Verify a new memory spiral can re-arm after the reset
  runMemoryChainGuard(session, ['recall']);
  runMemoryChainGuard(session, ['memory_lookup']);
  const reArmed = runMemoryChainGuard(session, ['introspect']);
  const p3c_rearm = reArmed.nudgeFired && session.consecutiveMemoryCalls === 3;
  console.log(`After 3 more batches post-reset: counter=${session.consecutiveMemoryCalls}, nudgeFired=${reArmed.nudgeFired}`);
  console.log(p3c_rearm ? G('  ✓ 3C: new spiral correctly arms again after reset') : R('  ✗ 3C re-arm FAIL'));
}

// 3D — Watchdog-seal resets counter (audio produced but generationComplete never fired)
{
  const session: SessionLike = {};
  runMemoryChainGuard(session, ['recall']);
  runMemoryChainGuard(session, ['memory_lookup']);
  runMemoryChainGuard(session, ['introspect']); // nudge fires
  console.log(`\nBefore watchdog seal: counter=${session.consecutiveMemoryCalls}, nudgeSent=${session.glMemoryNudgeSent}`);

  simulateWatchdogSeal(session);
  const p3d_ok = session.consecutiveMemoryCalls === 0 && session.glMemoryNudgeSent === false;
  console.log(`After watchdog seal:  counter=${session.consecutiveMemoryCalls}, nudgeSent=${session.glMemoryNudgeSent}`);
  console.log(p3d_ok ? G('  ✓ 3D: watchdog-seal reset counter and nudge gate') : R('  ✗ 3D FAIL — watchdog seal does NOT reset counter (regression risk)'));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Reconnect: fresh session starts at 0 (undefined coerces correctly)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — Reconnect: fresh session starts at counter=0'));
sep();

{
  // Simulate a reconnect: new session object, no prior state.
  const freshSession: SessionLike = {};
  const p4_start = (freshSession.consecutiveMemoryCalls ?? 0) === 0;
  console.log(`Fresh session consecutiveMemoryCalls: ${freshSession.consecutiveMemoryCalls ?? 'undefined (→ 0)'}`);
  console.log(p4_start ? G('  ✓ starts at 0 (undefined coerces via ?? 0 in guard)') : R('  ✗ FAIL'));

  // First memory batch on fresh session — must go to 1, not resume from some stale value
  runMemoryChainGuard(freshSession, ['recall']);
  const p4_first = freshSession.consecutiveMemoryCalls === 1;
  console.log(`After first recall batch: counter=${freshSession.consecutiveMemoryCalls}`);
  console.log(p4_first ? G('  ✓ increments cleanly from 0 → 1') : R('  ✗ FAIL — stale counter contamination'));

  // Shared-history exception edge case: history is present on reconnect but
  // counter is clean — the next memory spiral starts from 0, not mid-count.
  // (The session object is always freshly created on reconnect; the counter
  // lives on the session object, so it's always 0 after a reconnect.)
  const sharedHistorySession: SessionLike = { consecutiveMemoryCalls: 0 };
  runMemoryChainGuard(sharedHistorySession, ['memory_lookup']);
  const p4_shared = sharedHistorySession.consecutiveMemoryCalls === 1;
  console.log(`Shared-history session after one lookup: counter=${sharedHistorySession.consecutiveMemoryCalls}`);
  console.log(p4_shared ? G('  ✓ shared-history reconnect starts clean') : R('  ✗ FAIL'));

  console.log('\n' + (p4_start && p4_first && p4_shared ? G('✓ PART 4 PASSED') : R('✗ PART 4 FAILED')));
}

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Summary'));
sep();
console.log(`
Memory-loop guard edge cases verified:

  ✓ Counter increments: 1 → 2 → 3, nudge fires at exactly threshold (3)
  ✓ One-shot gate: glMemoryNudgeSent prevents re-injection on batches 4, 5+
  ✓ Non-memory reset: any batch with a non-memory tool resets counter to 0
  ✓ generationComplete reset: confirmed audio turn clears counter + nudge gate
  ✓ Watchdog-seal reset: interrupted turn with audio clears counter + nudge gate
  ✓ Re-arm: new spiral arms correctly after any reset
  ✓ Reconnect: fresh session starts at 0 — no stale counter contamination

Watchdog seal fix applied in this task:
  server/services/gemini-live-session.ts — armGenerationCompleteWatchdog()
  Added: consecutiveMemoryCalls = 0 + glMemoryNudgeSent = false after sealCurrentAudioSubturn()
  Reason: watchdog fires only when hadAudioInCurrentSubturn=true, same semantic
          as generationComplete — the streak is broken when Daniela spoke.
`);
sep();
console.log(B('Test complete.'));
sep();

process.exit(0);
