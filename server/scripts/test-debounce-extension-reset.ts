/**
 * test-debounce-extension-reset.ts
 *
 * Confirms that the debounce-extension path in gemini-live-session.ts correctly
 * resets the seal timer when sub-turn 2 audio arrives mid-seal.
 *
 * Background
 * ──────────
 * After generationComplete fires between legitimate multi-part sub-turns, the
 * 800ms debounce seal timer is armed.  When sub-turn 2 audio arrives BEFORE the
 * timer fires (afterGenerationComplete=true, isTutorGeneratingAudio=true):
 *
 *   1. clearTimeout must cancel the old timer so the OLD seal doesn't fire early.
 *   2. A NEW timer must be re-armed so the response is still eventually sealed.
 *   3. The path must NOT fire when isTutorGeneratingAudio=false — that's the
 *      new-turn reset path (genuinely new generation, not a continuation).
 *
 * Without these invariants, a refactor that drops the clearTimeout or changes the
 * guard condition would silently reintroduce mid-clause audio cutoff (Bug 1 regression).
 *
 * Structure
 * ──────────
 * Part 1 — Static source analysis
 *   Scans gemini-live-session.ts to confirm the exact guard condition, clearTimeout
 *   call, and re-arm assignment are present and in the right relative order.
 *
 * Part 2 — State-machine simulation
 *   Mirrors the flag mutations from the extension path and the new-turn reset path
 *   to confirm each scenario routes to the correct branch.
 *
 * Run: npx tsx server/scripts/test-debounce-extension-reset.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── Colour helpers ─────────────────────────────────────────────────────────────
const G   = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B   = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y   = (s: string) => `\x1b[33m${s}\x1b[0m`;
const D   = (s: string) => `\x1b[2m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n      ${R('→')} ${detail}` : ''}`);
    failed++;
  }
}

// ── Load source ────────────────────────────────────────────────────────────────
const src = readFileSync(
  resolve(__dirname, '../services/gemini-live-session.ts'),
  'utf-8',
);
const lines = src.split('\n');

/** 1-based line number of the first occurrence of needle. -1 if absent. */
function lineOf(needle: string): number {
  const idx = lines.findIndex(l => l.includes(needle));
  return idx === -1 ? -1 : idx + 1;
}

/** All 1-based line numbers that contain needle. */
function allLinesOf(needle: string): number[] {
  return lines
    .map((l, i) => (l.includes(needle) ? i + 1 : -1))
    .filter(n => n !== -1);
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static source analysis
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static source analysis: debounce extension block'));
sep();

function part1() {
  // ── 1a. Extension guard condition is present ────────────────────────────────
  // afterGenerationComplete=true AND isTutorGeneratingAudio=true → extension path
  const extensionGuard =
    'this.afterGenerationComplete && this.isTutorGeneratingAudio';
  const extensionGuardLine = lineOf(extensionGuard);
  assert(
    `Extension guard condition is present in source (line ${extensionGuardLine})`,
    extensionGuardLine > 0,
    `Expected: if (${extensionGuard} && ...)`,
  );

  // ── 1b. New-turn reset guard condition is present ───────────────────────────
  // afterGenerationComplete=true AND isTutorGeneratingAudio=false → reset path
  const resetGuard =
    'this.afterGenerationComplete && !this.isTutorGeneratingAudio';
  const resetGuardLine = lineOf(resetGuard);
  assert(
    `New-turn reset guard condition is present in source (line ${resetGuardLine})`,
    resetGuardLine > 0,
    `Expected: if (${resetGuard})`,
  );

  // ── 1c. Extension path calls clearTimeout BEFORE re-arming the timer ────────
  // The clearTimeout MUST be inside the extension block itself — between the
  // extension guard (`extensionGuardLine`) and the setTimeout re-arm
  // (`setTimeoutLine`).  Occurrences in other branches (e.g. the new-turn reset
  // at line 1971, the watchdog at line 1590, or stop() at line 1718) all appear
  // before extensionGuardLine, so they will NOT satisfy this check.
  // This means removing only the extension-block clearTimeout causes a failure
  // even while those other-branch calls still exist — giving mutation-sensitivity.
  const clearTimeoutLines = allLinesOf('clearTimeout(this.generationCompleteSealTimer)');
  const setTimeoutLine    = lineOf('this.generationCompleteSealTimer = setTimeout(() => {');

  // Scope: strictly inside the extension block = after the extension guard, before the re-arm.
  const clearInsideExtension = clearTimeoutLines.filter(
    l => l > extensionGuardLine && l < setTimeoutLine,
  );
  assert(
    `clearTimeout(generationCompleteSealTimer) is called INSIDE the extension block, before the re-arm (guard:${extensionGuardLine}, clear:${clearInsideExtension.join(',')}, setTimeout:${setTimeoutLine})`,
    clearInsideExtension.length > 0,
    `No clearTimeout found between extension guard (line ${extensionGuardLine}) and setTimeout re-arm (line ${setTimeoutLine}). ` +
    `All clearTimeout occurrences in file: ${clearTimeoutLines.join(', ')}`,
  );

  // ── 1d. Extension path re-arms with setTimeout ──────────────────────────────
  assert(
    `generationCompleteSealTimer is re-armed via setTimeout in the extension path (line ${setTimeoutLine})`,
    setTimeoutLine > 0,
    'Expected: this.generationCompleteSealTimer = setTimeout(() => { … }, 800)',
  );

  // ── 1e. Extension setTimeout uses 800ms delay ───────────────────────────────
  // Grab a few lines around the setTimeout to find the }, 800) close.
  const timerBlock = lines.slice(setTimeoutLine - 1, setTimeoutLine + 15).join('\n');
  assert(
    'Extension debounce timer delay is 800 ms',
    timerBlock.includes('}, 800)') || timerBlock.includes(', 800)'),
    `Did not find "}, 800)" in block starting at line ${setTimeoutLine}`,
  );

  // ── 1f. Extension path self-nulls generationCompleteSealTimer on fire ───────
  // Inside the callback the timer should null itself before calling sealCurrentAudioSubturn.
  // Use allLinesOf to find the instance inside the callback (not the first global occurrence).
  const selfNullLines = allLinesOf('this.generationCompleteSealTimer = null');
  const selfNullInCallback = selfNullLines.find(l => l > setTimeoutLine && l < setTimeoutLine + 10);
  assert(
    `Timer self-nulls (generationCompleteSealTimer = null) inside the callback (found at ${selfNullInCallback ?? 'not found'})`,
    selfNullInCallback !== undefined,
    `Expected self-null within 10 lines after setTimeout on line ${setTimeoutLine}; candidates: ${selfNullLines.join(', ')}`,
  );

  // ── 1g. Extension path calls sealCurrentAudioSubturn ────────────────────────
  const sealLine = lineOf("sealCurrentAudioSubturn('generationComplete-debounce-extended')");
  assert(
    `Extension callback calls sealCurrentAudioSubturn with 'generationComplete-debounce-extended' tag (line ${sealLine})`,
    sealLine > setTimeoutLine && sealLine < setTimeoutLine + 15,
    `Expected sealCurrentAudioSubturn call within 15 lines after setTimeout on line ${setTimeoutLine}; found on ${sealLine}`,
  );

  // ── 1h. Extension path emits a console.log deferral message ─────────────────
  // The log fires AFTER the setTimeout block closes (}, 800)) — the whole callback
  // body sits between the assignment and the closing paren, so allow up to 15 lines.
  const deferLogLine = lineOf('generationComplete seal deferred — audio still arriving after premature generationComplete');
  assert(
    `Extension path emits deferral log message (line ${deferLogLine})`,
    deferLogLine > 0 && deferLogLine > setTimeoutLine && deferLogLine < setTimeoutLine + 15,
    `Expected deferral log within 15 lines after setTimeout re-arm at line ${setTimeoutLine}; found on ${deferLogLine}`,
  );

  // ── 1i. New-turn reset path nulls the timer (cancels pending seal) ───────────
  // The reset path must clear the seal timer — it's a new turn, not a continuation.
  const resetClearLines = allLinesOf('clearTimeout(this.generationCompleteSealTimer)');
  const resetSealNullLine = lines.findIndex((l, i) =>
    i >= resetGuardLine &&  // search from the reset guard onward
    i < (extensionGuardLine > 0 ? extensionGuardLine : resetGuardLine + 20) &&
    l.includes('this.generationCompleteSealTimer = null')
  );
  assert(
    `New-turn reset path sets generationCompleteSealTimer = null (found at ${resetSealNullLine + 1})`,
    resetSealNullLine >= 0,
    `Expected generationCompleteSealTimer = null in the new-turn reset block (after line ${resetGuardLine})`,
  );

  // ── 1j. Extension guard comes AFTER the new-turn reset guard ────────────────
  // Code ordering: new-turn reset (isTutorGeneratingAudio=false) is checked first,
  // then the extension path (isTutorGeneratingAudio=true). Ensures they are mutually exclusive.
  assert(
    `Extension guard (line ${extensionGuardLine}) comes AFTER new-turn reset guard (line ${resetGuardLine})`,
    extensionGuardLine > resetGuardLine,
    `Expected new-turn reset (line ${resetGuardLine}) to precede extension path (line ${extensionGuardLine})`,
  );
}

part1();

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — State-machine simulation
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — State-machine simulation: which path fires for each scenario'));
sep();

/**
 * Minimal simulation of the flag state relevant to the debounce extension.
 */
interface DebounceState {
  afterGenerationComplete: boolean;
  isTutorGeneratingAudio: boolean;
  generationCompleteSealTimerArmed: boolean; // simulates timer being armed
  isFlushInProgress: boolean;
}

type PathResult = 'extension' | 'new-turn-reset' | 'neither';

/**
 * Mirrors the guard logic from gemini-live-session.ts lines ~1966–1992.
 * Returns which path fires and whether the timer is cleared + re-armed.
 */
function simulateAudioArrivalDebounce(s: DebounceState): {
  path: PathResult;
  timerCleared: boolean;
  timerReArmed: boolean;
} {
  let timerCleared = false;
  let timerReArmed = false;
  let path: PathResult = 'neither';

  // New-turn reset: afterGenerationComplete=true AND isTutorGeneratingAudio=false
  if (s.afterGenerationComplete && !s.isTutorGeneratingAudio) {
    path = 'new-turn-reset';
    s.afterGenerationComplete = false;
    if (s.generationCompleteSealTimerArmed) {
      timerCleared = true;
      s.generationCompleteSealTimerArmed = false;
    }
    return { path, timerCleared, timerReArmed };
  }

  // Extension path: afterGenerationComplete=true AND isTutorGeneratingAudio=true
  // (plus guard: timer armed OR flush not in progress)
  if (
    s.afterGenerationComplete &&
    s.isTutorGeneratingAudio &&
    (s.generationCompleteSealTimerArmed || !s.isFlushInProgress)
  ) {
    path = 'extension';
    if (s.generationCompleteSealTimerArmed) {
      timerCleared = true;
      s.generationCompleteSealTimerArmed = false;
    }
    // Re-arm
    s.generationCompleteSealTimerArmed = true;
    timerReArmed = true;
    return { path, timerCleared, timerReArmed };
  }

  return { path, timerCleared, timerReArmed };
}

function part2() {
  // ── Scenario A: Sub-turn 2 audio mid-seal (the main case) ──────────────────
  console.log(D('  Scenario A: sub-turn 2 arrives while seal timer is armed'));
  console.log(D('             (afterGenerationComplete=true, isTutorGeneratingAudio=true, timer armed)'));
  console.log('');

  const stateA: DebounceState = {
    afterGenerationComplete: true,
    isTutorGeneratingAudio: true,
    generationCompleteSealTimerArmed: true,   // old timer is running
    isFlushInProgress: false,
  };

  const resultA = simulateAudioArrivalDebounce(stateA);

  assert(
    'Scenario A — Extension path fires (not new-turn reset)',
    resultA.path === 'extension',
    `Expected path='extension'; got '${resultA.path}'`,
  );
  assert(
    'Scenario A — Old timer is cleared (clearTimeout called)',
    resultA.timerCleared,
    'Expected timerCleared=true — the old 800ms timer must be cancelled before re-arming',
  );
  assert(
    'Scenario A — New timer is re-armed (setTimeout called)',
    resultA.timerReArmed,
    'Expected timerReArmed=true — a fresh 800ms seal timer must be scheduled',
  );
  assert(
    'Scenario A — Timer is armed after the call (seal will still fire)',
    stateA.generationCompleteSealTimerArmed,
    'State machine should show timer still active after re-arm',
  );

  // ── Scenario B: Sub-turn 2 arrives but no prior timer (first sub-turn case) ─
  console.log('');
  console.log(D('  Scenario B: sub-turn 2 arrives, no prior timer (first continuation)'));
  console.log(D('             (afterGenerationComplete=true, isTutorGeneratingAudio=true, timer NOT armed)'));
  console.log('');

  const stateB: DebounceState = {
    afterGenerationComplete: true,
    isTutorGeneratingAudio: true,
    generationCompleteSealTimerArmed: false,  // no existing timer
    isFlushInProgress: false,
  };

  const resultB = simulateAudioArrivalDebounce(stateB);

  assert(
    'Scenario B — Extension path fires (no prior timer is fine — guard allows it when flush not in progress)',
    resultB.path === 'extension',
    `Expected path='extension'; got '${resultB.path}'`,
  );
  assert(
    'Scenario B — No spurious clearTimeout (timer was not armed)',
    !resultB.timerCleared,
    'timerCleared should be false when no timer was running',
  );
  assert(
    'Scenario B — New timer is re-armed regardless',
    resultB.timerReArmed,
    'Expected timerReArmed=true — seal must be scheduled even when no old timer existed',
  );

  // ── Scenario C: New generation after playback_ended (isTutorGeneratingAudio=false) ─
  console.log('');
  console.log(D('  Scenario C: new turn starts (afterGenerationComplete=true, isTutorGeneratingAudio=false)'));
  console.log(D('             → new-turn reset path, NOT extension path'));
  console.log('');

  const stateC: DebounceState = {
    afterGenerationComplete: true,
    isTutorGeneratingAudio: false,            // playback_ended cleared the gate
    generationCompleteSealTimerArmed: true,   // stale timer from old turn
    isFlushInProgress: false,
  };

  const resultC = simulateAudioArrivalDebounce(stateC);

  assert(
    'Scenario C — New-turn reset path fires (NOT extension)',
    resultC.path === 'new-turn-reset',
    `Expected path='new-turn-reset'; got '${resultC.path}'`,
  );
  assert(
    'Scenario C — Stale timer IS cleared (new turn, old seal no longer relevant)',
    resultC.timerCleared,
    'Expected timerCleared=true — stale timer from prior generationComplete must be cancelled',
  );
  assert(
    'Scenario C — Timer is NOT re-armed (extension debounce should not fire)',
    !resultC.timerReArmed,
    'timerReArmed should be false on the new-turn reset path',
  );
  assert(
    'Scenario C — afterGenerationComplete is reset to false (ready for next turn)',
    !stateC.afterGenerationComplete,
    'afterGenerationComplete should be cleared by the new-turn reset path',
  );

  // ── Scenario D: afterGenerationComplete=false — neither path fires ──────────
  console.log('');
  console.log(D('  Scenario D: normal audio mid-turn (afterGenerationComplete=false)'));
  console.log(D('             → neither debounce path fires'));
  console.log('');

  const stateD: DebounceState = {
    afterGenerationComplete: false,           // generation not complete yet
    isTutorGeneratingAudio: true,
    generationCompleteSealTimerArmed: false,
    isFlushInProgress: false,
  };

  const resultD = simulateAudioArrivalDebounce(stateD);

  assert(
    'Scenario D — Neither debounce path fires (mid-turn normal audio)',
    resultD.path === 'neither',
    `Expected path='neither'; got '${resultD.path}'`,
  );
  assert(
    'Scenario D — No timer cleared or re-armed',
    !resultD.timerCleared && !resultD.timerReArmed,
    `timerCleared=${resultD.timerCleared}, timerReArmed=${resultD.timerReArmed}`,
  );

  // ── Scenario E: extension path blocked when flush is in progress (no prior timer) ─
  console.log('');
  console.log(D('  Scenario E: continuation arrives while flush is already in progress'));
  console.log(D('             (afterGenerationComplete=true, isTutorGeneratingAudio=true, isFlushInProgress=true, no timer)'));
  console.log(D('             → guard blocks re-arm (avoids double-flush race)'));
  console.log('');

  const stateE: DebounceState = {
    afterGenerationComplete: true,
    isTutorGeneratingAudio: true,
    generationCompleteSealTimerArmed: false,  // no timer
    isFlushInProgress: true,                  // flush already running
  };

  const resultE = simulateAudioArrivalDebounce(stateE);

  assert(
    'Scenario E — Extension path does NOT fire when flush is in progress and no prior timer',
    resultE.path === 'neither',
    `Expected path='neither' (flush-in-progress guard blocks re-arm); got '${resultE.path}'`,
  );
}

part2();

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════
sep();
const total = passed + failed;
if (failed === 0) {
  console.log(G(`\n  ✓ All ${total} checks passed\n`));
  console.log(D('  Debounce-extension path confirmed:'));
  console.log(D('    • clearTimeout cancels the old 800ms seal timer'));
  console.log(D('    • setTimeout re-arms a fresh 800ms seal so the turn is still eventually sealed'));
  console.log(D('    • Guard fires only when afterGenerationComplete=true AND isTutorGeneratingAudio=true'));
  console.log(D('    • isTutorGeneratingAudio=false routes to new-turn reset (not extension)\n'));
  process.exit(0);
} else {
  console.log(R(`\n  ✗ ${failed} of ${total} checks FAILED\n`));
  console.log(Y('  If the debounce extension or new-turn reset has changed, review:'));
  console.log(Y('    • Lines ~1966–1992 in gemini-live-session.ts'));
  console.log(Y('    • The clearTimeout guard in the extension block (must precede setTimeout)'));
  console.log(Y('    • The guard condition: afterGenerationComplete && isTutorGeneratingAudio'));
  console.log('');
  process.exit(1);
}
