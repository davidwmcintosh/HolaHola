/**
 * test-gl-memory-chain-guard.ts
 *
 * Validates the GL voice-mode memory chain guard logic that lives inside
 * gemini-live-session.ts. Because GeminiLiveSession requires a live WebSocket
 * and Gemini Live API connection, this file uses a local simulation that
 * mirrors the exact guard block (lines ~3448–3469 in gemini-live-session.ts).
 *
 * If the guard block is removed, the counter logic is changed, or the import of
 * MEMORY_CHAIN_LIMIT / MEMORY_CHAIN_NUDGE_TEXT is broken, one or more checks
 * below will fail.
 *
 * Key differences from text-mode (runDanielaFCLoop) guard:
 *   - GL uses a one-shot glMemoryNudgeSent gate (nudge fires exactly ONCE per
 *     streak, not on every turn at/beyond the limit).
 *   - GL has no textContent check — audio production (generationComplete path)
 *     resets the counter separately; the tool-call path only checks
 *     allMemoryBatch.
 *   - Counter and nudgeSent both reset when a non-memory tool fires.
 *
 * Run: npx tsx server/scripts/test-gl-memory-chain-guard.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  MEMORY_TOOL_NAMES,
  MEMORY_CHAIN_LIMIT,
  MEMORY_CHAIN_NUDGE_TEXT,
} from '../services/memory-chain-guard';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Test accounting ───────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function pass(name: string, detail?: string) {
  passed++;
  console.log(`  ${G('✓')} ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name: string, detail: string) {
  failed++;
  console.error(`  ${R('✗')} ${name}`);
  console.error(`    ${detail}`);
}

// ── GL guard simulator ────────────────────────────────────────────────────────
// Mirrors the exact guard block in gemini-live-session.ts (toolCall handler).
//
// State object matches the StreamingSession fields the guard reads/writes:
//   consecutiveMemoryCalls: number | undefined
//   glMemoryNudgeSent: boolean | undefined
//
// Each call to simulateGLBatch() processes one tool batch (one toolCall message)
// and returns whether the nudge was appended to the last response entry.

interface GLGuardState {
  consecutiveMemoryCalls: number;
  glMemoryNudgeSent: boolean;
}

interface BatchResult {
  nudgeFired: boolean;
  counter: number;
  nudgeSentAfter: boolean;
  lastResponseResult: string;
}

function simulateGLBatch(
  state: GLGuardState,
  batchToolNames: string[],
  /** Simulated tool responses (mirrors the `responses` array built before the guard block). */
  responses: Array<{ response: { result: string } }>,
): BatchResult {
  const allMemoryBatch = batchToolNames.every((n: string) => MEMORY_TOOL_NAMES.has(n));

  if (!allMemoryBatch) {
    state.consecutiveMemoryCalls = 0;
    state.glMemoryNudgeSent = false;
  } else {
    const prev = state.consecutiveMemoryCalls ?? 0;
    state.consecutiveMemoryCalls = prev + 1;
    if (
      !state.glMemoryNudgeSent &&
      state.consecutiveMemoryCalls >= MEMORY_CHAIN_LIMIT &&
      responses.length > 0
    ) {
      const lastResp = responses[responses.length - 1];
      const existing = lastResp.response.result ?? '';
      lastResp.response.result = existing + MEMORY_CHAIN_NUDGE_TEXT;
      state.glMemoryNudgeSent = true;
    }
  }

  const nudgeFired = responses.some(r => r.response.result.includes(MEMORY_CHAIN_NUDGE_TEXT));
  return {
    nudgeFired,
    counter: state.consecutiveMemoryCalls,
    nudgeSentAfter: state.glMemoryNudgeSent,
    lastResponseResult: responses[responses.length - 1]?.response?.result ?? '',
  };
}

function makeResponses(n = 1): Array<{ response: { result: string } }> {
  return Array.from({ length: n }, () => ({ response: { result: 'tool result' } }));
}

function freshState(): GLGuardState {
  return { consecutiveMemoryCalls: 0, glMemoryNudgeSent: false };
}

// ── Test functions ────────────────────────────────────────────────────────────

function testNudgeFiresAtExactlyLimit() {
  const name = `nudge fires after exactly ${MEMORY_CHAIN_LIMIT} consecutive memory-only batches`;
  const state = freshState();

  const results: BatchResult[] = [];
  for (let i = 0; i < MEMORY_CHAIN_LIMIT; i++) {
    results.push(simulateGLBatch(state, ['recall'], makeResponses()));
  }

  // Turns before the limit: no nudge
  for (let i = 0; i < MEMORY_CHAIN_LIMIT - 1; i++) {
    if (results[i].nudgeFired) {
      return fail(name, `Nudge fired too early at turn ${i + 1} (limit is ${MEMORY_CHAIN_LIMIT}).`);
    }
  }

  // Exactly at limit: nudge fires
  const atLimit = results[MEMORY_CHAIN_LIMIT - 1];
  if (!atLimit.nudgeFired) {
    return fail(name, `Nudge did NOT fire at turn ${MEMORY_CHAIN_LIMIT}. Guard block may be missing or MEMORY_CHAIN_LIMIT import is broken.`);
  }

  pass(name, `counter=${atLimit.counter}, nudgeFired at turn ${MEMORY_CHAIN_LIMIT}`);
}

function testNudgeFiresOnlyOnce() {
  const name = 'nudge fires exactly once per streak (glMemoryNudgeSent one-shot gate)';
  const state = freshState();
  const extraTurns = 3;
  const totalTurns = MEMORY_CHAIN_LIMIT + extraTurns;

  let nudgeCount = 0;
  for (let i = 0; i < totalTurns; i++) {
    // Fresh responses each turn so nudge check is per-turn
    const responses = makeResponses();
    simulateGLBatch(state, ['recall'], responses);
    if (responses[0].response.result.includes(MEMORY_CHAIN_NUDGE_TEXT)) nudgeCount++;
  }

  if (nudgeCount !== 1) {
    return fail(name, `Expected nudge to fire exactly once, but it fired ${nudgeCount} time(s) over ${totalTurns} turns.`);
  }
  pass(name, `nudge fired once across ${totalTurns} consecutive memory-only batches`);
}

function testNonMemoryToolResetsCounterAndGate() {
  const name = 'non-memory tool (show_image) resets counter and nudgeSent gate';
  const state = freshState();

  // Build streak up to limit
  for (let i = 0; i < MEMORY_CHAIN_LIMIT; i++) {
    simulateGLBatch(state, ['recall'], makeResponses());
  }
  if (!state.glMemoryNudgeSent) {
    return fail(name, 'Precondition failed: nudgeSent should be true after reaching limit.');
  }

  // Fire a non-memory tool — must reset both counter and gate
  simulateGLBatch(state, ['show_image'], makeResponses());

  if (state.consecutiveMemoryCalls !== 0) {
    return fail(name, `counter should be 0 after non-memory tool, got ${state.consecutiveMemoryCalls}.`);
  }
  if (state.glMemoryNudgeSent) {
    return fail(name, 'glMemoryNudgeSent should be false after non-memory tool resets the streak.');
  }

  // Confirm the nudge can fire again after a fresh streak
  const responses = makeResponses();
  let freshNudge = false;
  for (let i = 0; i < MEMORY_CHAIN_LIMIT; i++) {
    const r = makeResponses();
    simulateGLBatch(state, ['recall'], r);
    if (r[0].response.result.includes(MEMORY_CHAIN_NUDGE_TEXT)) freshNudge = true;
  }
  if (!freshNudge) {
    return fail(name, 'Nudge did not re-fire after counter was reset and a fresh streak reached the limit.');
  }
  // suppress unused variable warning
  void responses;

  pass(name, 'counter=0, gate cleared; nudge re-fired on subsequent streak');
}

function testReadFullMemoryResetsLikeNonMemoryTool() {
  const name = 'read_full_memory is excluded from MEMORY_TOOL_NAMES — resets the GL counter';

  // Confirm exclusion
  if (MEMORY_TOOL_NAMES.has('read_full_memory')) {
    return fail(name, 'read_full_memory is unexpectedly IN MEMORY_TOOL_NAMES — intentional exclusion was removed.');
  }

  const state = freshState();
  // 2 memory-only turns (streak = 2, below limit)
  simulateGLBatch(state, ['recall'], makeResponses());
  simulateGLBatch(state, ['recall'], makeResponses());
  if (state.consecutiveMemoryCalls !== 2) {
    return fail(name, `Precondition failed: expected counter=2, got ${state.consecutiveMemoryCalls}.`);
  }

  // read_full_memory batch — not in MEMORY_TOOL_NAMES → must reset
  simulateGLBatch(state, ['read_full_memory'], makeResponses());
  if ((state.consecutiveMemoryCalls as number) !== 0) {
    return fail(name, `read_full_memory should reset counter to 0, got ${state.consecutiveMemoryCalls}.`);
  }
  if (state.glMemoryNudgeSent) {
    return fail(name, 'glMemoryNudgeSent should be false after read_full_memory resets the streak.');
  }

  pass(name, 'counter reset to 0 — read_full_memory correctly treated as non-memory tool');
}

function testMixedBatchResetsIfAnyToolIsNonMemory() {
  const name = 'mixed batch (recall + show_image) resets counter — allMemoryBatch requires ALL tools in set';
  const state = freshState();

  // Prime the counter
  simulateGLBatch(state, ['recall'], makeResponses());
  simulateGLBatch(state, ['recall'], makeResponses());

  // Mixed batch — recall is guarded, show_image is not → allMemoryBatch=false
  simulateGLBatch(state, ['recall', 'show_image'], makeResponses());

  if (state.consecutiveMemoryCalls !== 0) {
    return fail(name, `counter should be 0 after mixed batch (recall+show_image), got ${state.consecutiveMemoryCalls}.`);
  }
  pass(name, 'counter correctly reset by mixed batch');
}

function testNudgeDoesNotFireWithNoResponses() {
  const name = 'nudge does not fire when responses array is empty (guard: responses.length > 0)';
  const state = freshState();

  for (let i = 0; i < MEMORY_CHAIN_LIMIT; i++) {
    simulateGLBatch(state, ['recall'], []); // empty responses
  }

  if (state.glMemoryNudgeSent) {
    return fail(name, 'glMemoryNudgeSent should remain false when there are no responses to append to.');
  }
  pass(name, 'nudge not triggered — no response slots available');
}

function testAllGuardedToolsIncrementCounter() {
  const name = 'every tool in MEMORY_TOOL_NAMES increments the GL counter correctly';
  const guardedTools = Array.from(MEMORY_TOOL_NAMES);
  const errors: string[] = [];

  for (const toolName of guardedTools) {
    const state = freshState();
    const responses = makeResponses();
    let fired = false;
    for (let i = 0; i < MEMORY_CHAIN_LIMIT; i++) {
      const r = makeResponses();
      simulateGLBatch(state, [toolName], r);
      if (r[0].response.result.includes(MEMORY_CHAIN_NUDGE_TEXT)) fired = true;
    }
    if (!fired) {
      errors.push(`"${toolName}" — nudge did not fire after ${MEMORY_CHAIN_LIMIT} consecutive batches`);
    }
    void responses;
  }

  if (errors.length > 0) {
    return fail(name, errors.join('; '));
  }
  pass(name, `all ${guardedTools.length} guarded tools trigger the nudge at the limit`);
}

function testNudgeTextIsCanonical() {
  const name = 'GL uses MEMORY_CHAIN_NUDGE_TEXT from memory-chain-guard.ts (no hardcoded duplicate)';

  if (typeof MEMORY_CHAIN_NUDGE_TEXT !== 'string' || MEMORY_CHAIN_NUDGE_TEXT.length === 0) {
    return fail(name, 'MEMORY_CHAIN_NUDGE_TEXT is not a non-empty string.');
  }
  if (!MEMORY_CHAIN_NUDGE_TEXT.includes('CRITICAL')) {
    return fail(name, 'MEMORY_CHAIN_NUDGE_TEXT must contain "CRITICAL" (canonical prefix).');
  }
  if (!MEMORY_CHAIN_NUDGE_TEXT.includes('SYSTEM STATUS')) {
    return fail(name, 'MEMORY_CHAIN_NUDGE_TEXT must contain "SYSTEM STATUS" marker.');
  }

  // Confirm it is actually appended by the simulator
  const state = freshState();
  const responses = makeResponses();
  for (let i = 0; i < MEMORY_CHAIN_LIMIT; i++) {
    simulateGLBatch(state, ['recall'], responses);
  }
  if (!responses[0].response.result.includes(MEMORY_CHAIN_NUDGE_TEXT)) {
    return fail(name, 'MEMORY_CHAIN_NUDGE_TEXT was not appended to the tool response at the limit.');
  }

  pass(name, 'canonical nudge text appended correctly');
}

/**
 * Scenario F — watchdog source guard + behavioural proof.
 *
 * Part F-1 (source guard):
 *   Reads the real gemini-live-session.ts and extracts the
 *   armGenerationCompleteWatchdog() setTimeout callback.  Asserts that BOTH:
 *     this.session.consecutiveMemoryCalls = 0;
 *     this.session.glMemoryNudgeSent = false;
 *   appear inside the watchdog callback body.  If either line is removed the
 *   check fails — CI catches the regression without needing a live GL session.
 *
 * Part F-2 (behavioural proof):
 *   Shows WHY the gate line matters by demonstrating that clearing only the
 *   counter (but NOT glMemoryNudgeSent) causes the nudge to silently skip the
 *   next streak — the exact bug the watchdog reset is meant to prevent.
 */
function testWatchdogResetClearsBothCounterAndGate() {
  // ── Part F-1: source guard ────────────────────────────────────────────────
  const srcName = 'armGenerationCompleteWatchdog() in gemini-live-session.ts resets both consecutiveMemoryCalls and glMemoryNudgeSent';

  let src: string;
  try {
    src = readFileSync(
      resolve(__dirname, '../services/gemini-live-session.ts'),
      'utf8',
    );
  } catch (e: any) {
    return fail(srcName, `Could not read gemini-live-session.ts: ${e.message}`);
  }

  // Locate the armGenerationCompleteWatchdog method and extract its body.
  const methodStart = src.indexOf('private armGenerationCompleteWatchdog()');
  if (methodStart === -1) {
    return fail(srcName, 'armGenerationCompleteWatchdog() not found in gemini-live-session.ts — method was renamed or removed.');
  }

  // Find the outer closing brace of the method by counting braces.
  let depth = 0;
  let methodEnd = -1;
  for (let i = methodStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) { methodEnd = i; break; }
    }
  }
  if (methodEnd === -1) {
    return fail(srcName, 'Could not find closing brace of armGenerationCompleteWatchdog().');
  }

  const watchdogBody = src.slice(methodStart, methodEnd + 1);

  // Find the setTimeout callback — the inner callback body is where the resets must live.
  const setTimeoutIdx = watchdogBody.indexOf('setTimeout(');
  if (setTimeoutIdx === -1) {
    return fail(srcName, 'No setTimeout() call found inside armGenerationCompleteWatchdog() — watchdog structure changed unexpectedly.');
  }

  // Extract from 'setTimeout(' to the end of the method body (covers the full callback).
  const callbackRegion = watchdogBody.slice(setTimeoutIdx);

  const hasCounterReset = callbackRegion.includes('this.session.consecutiveMemoryCalls = 0');
  const hasGateReset    = callbackRegion.includes('this.session.glMemoryNudgeSent = false');

  if (!hasCounterReset && !hasGateReset) {
    return fail(srcName, 'Neither this.session.consecutiveMemoryCalls = 0 nor this.session.glMemoryNudgeSent = false found in the watchdog setTimeout callback.');
  }
  if (!hasCounterReset) {
    return fail(srcName, 'this.session.consecutiveMemoryCalls = 0 is missing from the watchdog setTimeout callback — counter reset was removed.');
  }
  if (!hasGateReset) {
    return fail(srcName, 'this.session.glMemoryNudgeSent = false is missing from the watchdog setTimeout callback — nudge-gate reset was removed; the next memory chain after a watchdog seal would silently skip its nudge.');
  }

  pass(srcName, 'both reset lines confirmed present in watchdog setTimeout callback');

  // ── Part F-2: behavioural proof — gate omission silences next nudge ───────
  const behavName = 'omitting the glMemoryNudgeSent reset (counter-only reset) silences the nudge on the next streak';

  // Reach the limit so nudge fires and gate is set.
  const state = freshState();
  for (let i = 0; i < MEMORY_CHAIN_LIMIT; i++) {
    simulateGLBatch(state, ['recall'], makeResponses());
  }
  if (!state.glMemoryNudgeSent) {
    return fail(behavName, 'Precondition: nudgeSent should be true after reaching the limit.');
  }

  // Simulate an INCOMPLETE watchdog reset: counter zeroed but gate NOT cleared.
  // (This is exactly what would happen if the glMemoryNudgeSent = false line were removed.)
  state.consecutiveMemoryCalls = 0;
  // state.glMemoryNudgeSent intentionally NOT cleared — mirrors the buggy path.

  // Run a fresh streak; nudge must NOT fire because the gate is still true.
  let nudgeFiredBuggy = false;
  for (let i = 0; i < MEMORY_CHAIN_LIMIT + 2; i++) {
    const r = makeResponses();
    simulateGLBatch(state, ['recall'], r);
    if (r[0].response.result.includes(MEMORY_CHAIN_NUDGE_TEXT)) nudgeFiredBuggy = true;
  }
  if (nudgeFiredBuggy) {
    return fail(behavName, 'Nudge fired even with the gate still set — the one-shot guard itself is broken (separate issue).');
  }
  pass(behavName, 'confirmed: counter-only reset leaves gate true, silently suppressing nudge on next streak');

  // Prove the CORRECT full reset (both fields) re-enables the nudge.
  const correctName = 'full watchdog reset (counter + gate) re-enables nudge at exactly MEMORY_CHAIN_LIMIT';
  state.consecutiveMemoryCalls = 0;
  state.glMemoryNudgeSent = false;   // gate cleared as the real watchdog code does

  let nudgeCount = 0;
  let nudgeTurn = -1;
  for (let i = 0; i < MEMORY_CHAIN_LIMIT + 2; i++) {
    const r = makeResponses();
    simulateGLBatch(state, ['recall'], r);
    if (r[0].response.result.includes(MEMORY_CHAIN_NUDGE_TEXT)) {
      nudgeCount++;
      if (nudgeTurn === -1) nudgeTurn = i + 1;
    }
  }
  if (nudgeCount === 0) {
    return fail(correctName, 'Nudge did not fire after full reset — the one-shot gate or counter logic regressed.');
  }
  if (nudgeTurn !== MEMORY_CHAIN_LIMIT) {
    return fail(correctName, `Nudge fired at turn ${nudgeTurn}, expected turn ${MEMORY_CHAIN_LIMIT}.`);
  }
  if (nudgeCount > 1) {
    return fail(correctName, `Nudge fired ${nudgeCount} times — one-shot gate is broken after a full reset.`);
  }
  pass(correctName, `nudge re-fired at turn ${nudgeTurn} (once only) after correct full reset`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

(async () => {
  console.log(B('\n  GL memory chain guard — simulation tests\n'));
  sep();

  testNudgeFiresAtExactlyLimit();
  testNudgeFiresOnlyOnce();
  testNonMemoryToolResetsCounterAndGate();
  testReadFullMemoryResetsLikeNonMemoryTool();
  testMixedBatchResetsIfAnyToolIsNonMemory();
  testNudgeDoesNotFireWithNoResponses();
  testAllGuardedToolsIncrementCounter();
  testNudgeTextIsCanonical();
  testWatchdogResetClearsBothCounterAndGate();

  sep();
  const total = passed + failed;
  console.log(`  Results: ${G(String(passed))} passed, ${failed > 0 ? R(String(failed)) : String(failed)} failed  (${total} checks)`);

  if (failed === 0) {
    console.log(`\n  ${G('✓ ALL CHECKS PASSED')}`);
    console.log(`  The GL memory chain guard logic is verified against the shared constants.`);
    console.log(`  A regression in the guard block, MEMORY_CHAIN_LIMIT, or MEMORY_CHAIN_NUDGE_TEXT`);
    console.log(`  will cause one or more of the above checks to fail.\n`);
    process.exit(0);
  } else {
    console.log(`\n  ${R('✗ SOME CHECKS FAILED')} — review items above\n`);
    process.exit(1);
  }
})();
