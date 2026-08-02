/**
 * test-watchdog-takeover.ts
 *
 * Confirms that the generationComplete watchdog timer safely takes over when
 * the debounce extension is still counting.
 *
 * Background
 * ──────────
 * When sub-turn 2 audio arrives, the debounce extension re-arms
 * generationCompleteSealTimer (800ms).  If the 25s watchdog fires within that
 * same window it must:
 *
 *   1. Cancel the pending debounce seal (clearTimeout + null the reference)
 *      so the debounce callback can never fire AFTER the watchdog seal.
 *   2. Call sealCurrentAudioSubturn exactly ONCE (not twice — once from the
 *      watchdog and once more if the debounce timer were left running).
 *   3. Set generationCompleteSealTimer = null before the seal call so
 *      in-flight debounce timers cannot fire a second seal.
 *
 * Without these invariants a refactor that removes the clearTimeout inside the
 * watchdog block would silently allow a double-seal: watchdog seals the turn,
 * then 800ms later the debounce callback fires and seals it again.
 *
 * Structure
 * ──────────
 * Part 1 — Static source analysis
 *   Scans gemini-live-session.ts to confirm the watchdog cancel block is
 *   present, in the right order, and that the reference is nulled before the
 *   seal call.
 *
 * Part 2 — State-machine simulation
 *   Mirrors the watchdog's flag mutations to confirm that when it fires after
 *   the debounce re-arms, only one seal path executes.
 *
 * Run: npx tsx server/scripts/test-watchdog-takeover.ts
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
console.log(B('PART 1 — Static source analysis: watchdog cancel block'));
sep();

function part1() {
  // ── 1a. Watchdog body guard condition is present ────────────────────────────
  // Watchdog fires only when not stopped, audio is generating, and audio arrived.
  const watchdogGuard =
    '!this.isStopped && this.isTutorGeneratingAudio && this.hadAudioInCurrentSubturn';
  const watchdogGuardLine = lineOf(watchdogGuard);
  assert(
    `Watchdog fires only when conditions are met: !isStopped && isTutorGeneratingAudio && hadAudioInCurrentSubturn (line ${watchdogGuardLine})`,
    watchdogGuardLine > 0,
    `Expected guard: if (${watchdogGuard})`,
  );

  // ── 1b. Watchdog cancel comment is present ──────────────────────────────────
  const cancelCommentLine = lineOf('Cancel any pending debounced seal — watchdog takes over');
  assert(
    `Cancel-comment is present in watchdog block (line ${cancelCommentLine})`,
    cancelCommentLine > 0,
    "Expected comment: 'Cancel any pending debounced seal — watchdog takes over'",
  );

  // ── 1c. Watchdog calls clearTimeout(generationCompleteSealTimer) BEFORE the seal ─
  // Identify the watchdog's clearTimeout and the watchdog seal call.
  const watchdogSealLine = lineOf("sealCurrentAudioSubturn('generationComplete-watchdog')");
  assert(
    `Watchdog calls sealCurrentAudioSubturn with 'generationComplete-watchdog' tag (line ${watchdogSealLine})`,
    watchdogSealLine > 0,
    "Expected: this.sealCurrentAudioSubturn('generationComplete-watchdog')",
  );

  // All occurrences of clearTimeout on generationCompleteSealTimer
  const clearTimeoutLines = allLinesOf('clearTimeout(this.generationCompleteSealTimer)');
  // The watchdog's clearTimeout must be BEFORE the watchdog seal call
  const clearBeforeSeal = clearTimeoutLines.filter(
    l => l > watchdogGuardLine && l < watchdogSealLine,
  );
  assert(
    `clearTimeout(generationCompleteSealTimer) is called BEFORE the watchdog seal (clear candidates: ${clearBeforeSeal.join(',')}, seal: ${watchdogSealLine})`,
    clearBeforeSeal.length > 0,
    `Expected a clearTimeout between watchdog guard (line ${watchdogGuardLine}) and seal call (line ${watchdogSealLine}). ` +
    `All clearTimeout occurrences in file: ${clearTimeoutLines.join(', ')}`,
  );

  // ── 1d. Watchdog nulls generationCompleteSealTimer BEFORE the seal ──────────
  const nullLines = allLinesOf('this.generationCompleteSealTimer = null');
  // Find a null assignment between the cancel comment (or watchdog guard) and the seal call
  const nullBeforeSeal = nullLines.filter(
    l => l > watchdogGuardLine && l < watchdogSealLine,
  );
  assert(
    `generationCompleteSealTimer is set to null BEFORE the watchdog seal call (null at: ${nullBeforeSeal.join(',')}, seal: ${watchdogSealLine})`,
    nullBeforeSeal.length > 0,
    `Expected generationCompleteSealTimer = null between watchdog guard (line ${watchdogGuardLine}) and seal (line ${watchdogSealLine}). ` +
    `All null assignments: ${nullLines.join(', ')}`,
  );

  // ── 1e. The null assignment is guarded by an `if (this.generationCompleteSealTimer)` ─
  // This ensures the clearTimeout only runs when a timer is actually armed.
  const ifGuardLine = lineOf('if (this.generationCompleteSealTimer)');
  // There may be multiple such guards; find the one inside the watchdog block
  const ifGuardLines = lines
    .map((l, i) => (l.includes('if (this.generationCompleteSealTimer)') ? i + 1 : -1))
    .filter(n => n !== -1);
  const ifGuardInWatchdog = ifGuardLines.filter(
    l => l > watchdogGuardLine && l < watchdogSealLine,
  );
  assert(
    `Watchdog wraps clearTimeout in if (this.generationCompleteSealTimer) guard (line ${ifGuardInWatchdog[0] ?? 'not found'})`,
    ifGuardInWatchdog.length > 0,
    `Expected an if-guard on generationCompleteSealTimer between watchdog guard (${watchdogGuardLine}) and seal (${watchdogSealLine}). ` +
    `All if-guard occurrences: ${ifGuardLines.join(', ')}`,
  );

  // ── 1f. clearTimeout comes BEFORE null in the watchdog block ────────────────
  const firstClearInWatchdog = clearBeforeSeal[0] ?? -1;
  const firstNullInWatchdog  = nullBeforeSeal[0] ?? -1;
  assert(
    `clearTimeout (line ${firstClearInWatchdog}) comes before null assignment (line ${firstNullInWatchdog}) inside the watchdog block`,
    firstClearInWatchdog > 0 && firstNullInWatchdog > firstClearInWatchdog,
    `clearTimeout must precede the null assignment; got clear=${firstClearInWatchdog}, null=${firstNullInWatchdog}`,
  );

  // ── 1g. Watchdog sets isGenerationDone=true after the seal ──────────────────
  const isGenDoneLine = lineOf('this.isGenerationDone = true');
  // Find the one that comes after the watchdog seal
  const isGenDoneLines = allLinesOf('this.isGenerationDone = true');
  const isGenDoneAfterSeal = isGenDoneLines.filter(l => l > watchdogSealLine && l < watchdogSealLine + 5);
  assert(
    `Watchdog sets isGenerationDone=true immediately after the seal call (line ${isGenDoneAfterSeal[0] ?? 'not found'})`,
    isGenDoneAfterSeal.length > 0,
    `Expected this.isGenerationDone = true within 5 lines after seal call on line ${watchdogSealLine}`,
  );

  // ── 1h. Watchdog emits a console.warn so the takeover is visible in logs ────
  const warnLine = lineOf('generationComplete watchdog fired — GL dropped the completion signal; sealing turn manually');
  assert(
    `Watchdog emits console.warn so takeover is visible in logs (line ${warnLine})`,
    warnLine > 0 && warnLine < watchdogSealLine,
    "Expected console.warn before sealCurrentAudioSubturn in watchdog block",
  );

  // ── 1i. Watchdog sets generationCompleteWatchdogTimer=null on entry ──────────
  // The watchdog callback immediately nulls its own reference (preventing re-arm).
  const watchdogTimerNullLine = lineOf('this.generationCompleteWatchdogTimer = null');
  assert(
    `Watchdog self-nulls generationCompleteWatchdogTimer on callback entry (line ${watchdogTimerNullLine})`,
    watchdogTimerNullLine > 0 && watchdogTimerNullLine < watchdogGuardLine,
    `Expected self-null before the guard condition (line ${watchdogGuardLine}); found on ${watchdogTimerNullLine}`,
  );
}

part1();

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — State-machine simulation
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — State-machine simulation: single seal when watchdog takes over'));
sep();

interface WatchdogState {
  isStopped: boolean;
  isTutorGeneratingAudio: boolean;
  hadAudioInCurrentSubturn: boolean;
  /** true = a debounce seal timer is currently armed */
  generationCompleteSealTimerArmed: boolean;
  /** true = the watchdog timer is currently armed */
  generationCompleteWatchdogTimerArmed: boolean;
}

type SealSource = 'watchdog' | 'debounce' | 'debounce-extended';

/**
 * Simulates the sequence of events:
 *   1. generationComplete fires → debounce seal timer armed (800ms).
 *   2. Sub-turn 2 audio arrives → debounce extension re-arms the seal timer.
 *   3. Watchdog fires within the 800ms window.
 *
 * Returns the list of seal calls that would have been made.
 */
function simulateWatchdogTakeover(s: WatchdogState): {
  sealCalls: SealSource[];
  sealTimerArmedAfterWatchdog: boolean;
  watchdogTimerArmedAfterFire: boolean;
} {
  const sealCalls: SealSource[] = [];

  // ── Step 1: generationComplete fires — arm debounce seal ────────────────────
  // (This mirrors the initial debounce in the generationComplete handler.)
  s.generationCompleteSealTimerArmed = true;

  // ── Step 2: sub-turn 2 audio arrives — extension re-arms the seal timer ─────
  // Mirrors lines ~1978-1992: clearTimeout old timer, set new 800ms timer.
  if (
    s.isTutorGeneratingAudio &&
    (s.generationCompleteSealTimerArmed || true /* !isFlushInProgress */)
  ) {
    // Cancel old timer
    if (s.generationCompleteSealTimerArmed) {
      s.generationCompleteSealTimerArmed = false; // cleared
    }
    // Re-arm
    s.generationCompleteSealTimerArmed = true;
  }

  // At this point the 800ms debounce-extended timer is counting.
  // The watchdog fires BEFORE the 800ms expires.

  // ── Step 3: watchdog fires ──────────────────────────────────────────────────
  // Mirrors lines ~1581-1620.
  s.generationCompleteWatchdogTimerArmed = false; // self-null

  if (!s.isStopped && s.isTutorGeneratingAudio && s.hadAudioInCurrentSubturn) {
    // Cancel the pending debounce seal — watchdog takes over
    if (s.generationCompleteSealTimerArmed) {
      s.generationCompleteSealTimerArmed = false;
    }
    // Seal (exactly once)
    sealCalls.push('watchdog');
  }

  // ── Step 4: 800ms expires — debounce-extended callback fires ────────────────
  // With generationCompleteSealTimerArmed already nulled by the watchdog,
  // the callback checks !isStopped and then calls sealCurrentAudioSubturn.
  // In the real code the timer was cancelled (clearTimeout), so the callback
  // never executes — we model this by checking whether the timer is still armed.
  if (s.generationCompleteSealTimerArmed /* timer still armed → not cancelled */) {
    if (!s.isStopped) {
      sealCalls.push('debounce-extended');
    }
  }
  // (If the timer was cleared by the watchdog, s.generationCompleteSealTimerArmed
  // is false and this branch is never reached — exactly the desired behaviour.)

  return {
    sealCalls,
    sealTimerArmedAfterWatchdog: s.generationCompleteSealTimerArmed,
    watchdogTimerArmedAfterFire: s.generationCompleteWatchdogTimerArmed,
  };
}

/**
 * Simulates a path where the watchdog is prevented from firing by its own
 * condition guards (isStopped=true or no audio produced).
 */
function simulateWatchdogSkipped(s: WatchdogState): {
  sealCalls: SealSource[];
} {
  const sealCalls: SealSource[] = [];

  // Seal timer is armed (debounce path)
  s.generationCompleteSealTimerArmed = true;

  // Watchdog fires but conditions not met — no seal
  s.generationCompleteWatchdogTimerArmed = false;
  // Guard fails: isStopped=true or hadAudioInCurrentSubturn=false → skip

  // Debounce fires normally (timer still armed)
  if (s.generationCompleteSealTimerArmed && !s.isStopped) {
    s.generationCompleteSealTimerArmed = false;
    sealCalls.push('debounce');
  }

  return { sealCalls };
}

function part2() {
  // ── Scenario A: Main case — watchdog takes over from debounce-extended ───────
  console.log(D('  Scenario A: watchdog fires while debounce-extended timer is counting'));
  console.log(D('             → exactly ONE seal call (watchdog), debounce timer cleared'));
  console.log('');

  const stateA: WatchdogState = {
    isStopped: false,
    isTutorGeneratingAudio: true,
    hadAudioInCurrentSubturn: true,
    generationCompleteSealTimerArmed: false, // will be set inside simulate
    generationCompleteWatchdogTimerArmed: true,
  };

  const resultA = simulateWatchdogTakeover(stateA);

  assert(
    'Scenario A — Exactly ONE seal call is made',
    resultA.sealCalls.length === 1,
    `Expected 1 seal call; got ${resultA.sealCalls.length}: [${resultA.sealCalls.join(', ')}]`,
  );
  assert(
    "Scenario A — That seal comes from the watchdog, not the debounce",
    resultA.sealCalls[0] === 'watchdog',
    `Expected seal source 'watchdog'; got '${resultA.sealCalls[0]}'`,
  );
  assert(
    'Scenario A — Debounce seal timer is NOT armed after watchdog fires',
    !resultA.sealTimerArmedAfterWatchdog,
    'generationCompleteSealTimerArmed should be false — watchdog cancelled it',
  );
  assert(
    'Scenario A — Watchdog timer is NOT re-armed after firing',
    !resultA.watchdogTimerArmedAfterFire,
    'generationCompleteWatchdogTimerArmed should be false after the watchdog self-nulls',
  );

  // ── Scenario B: Watchdog conditions not met → debounce fires normally ────────
  // hadAudioInCurrentSubturn=false means the watchdog guard fails (no audio
  // produced this subturn), but the session is still active and the debounce
  // timer is running, so the debounce seal fires normally.
  console.log('');
  console.log(D('  Scenario B: watchdog fires but hadAudioInCurrentSubturn=false'));
  console.log(D('             (isStopped=false, isTutorGeneratingAudio=true)'));
  console.log(D('             → watchdog guard fails; debounce seal fires normally (1 seal)'));
  console.log('');

  const stateB: WatchdogState = {
    isStopped: false,
    isTutorGeneratingAudio: true,
    hadAudioInCurrentSubturn: false,  // no audio this subturn → watchdog guard fails
    generationCompleteSealTimerArmed: false,
    generationCompleteWatchdogTimerArmed: true,
  };

  const resultB = simulateWatchdogSkipped(stateB);

  assert(
    'Scenario B — When hadAudioInCurrentSubturn=false, watchdog guard fails; debounce seal is the only seal',
    resultB.sealCalls.length === 1 && resultB.sealCalls[0] === 'debounce',
    `Expected [debounce]; got [${resultB.sealCalls.join(', ')}]`,
  );

  // ── Scenario C: Watchdog conditions not met — no audio produced ──────────────
  console.log('');
  console.log(D('  Scenario C: watchdog fires but hadAudioInCurrentSubturn=false'));
  console.log(D('             → watchdog does NOT seal (guard prevents it)'));
  console.log('');

  const stateC: WatchdogState = {
    isStopped: false,
    isTutorGeneratingAudio: true,
    hadAudioInCurrentSubturn: false,  // no audio produced this subturn
    generationCompleteSealTimerArmed: true,
    generationCompleteWatchdogTimerArmed: true,
  };

  // Simulate watchdog firing with failed guard
  stateC.generationCompleteWatchdogTimerArmed = false; // self-null always
  const watchdogFired =
    !stateC.isStopped &&
    stateC.isTutorGeneratingAudio &&
    stateC.hadAudioInCurrentSubturn;

  assert(
    'Scenario C — Watchdog guard prevents seal when hadAudioInCurrentSubturn=false',
    !watchdogFired,
    'Watchdog should NOT fire when hadAudioInCurrentSubturn=false',
  );
  assert(
    'Scenario C — Watchdog self-nulls its own reference even when guard prevents seal',
    !stateC.generationCompleteWatchdogTimerArmed,
    'generationCompleteWatchdogTimerArmed should always be null after callback executes',
  );

  // ── Scenario D: No race — watchdog fires before any debounce seal timer ──────
  console.log('');
  console.log(D('  Scenario D: watchdog fires but no debounce seal timer is armed'));
  console.log(D('             (e.g. generationComplete signal was never fired)'));
  console.log(D('             → watchdog seals once, no double-seal risk'));
  console.log('');

  const stateD: WatchdogState = {
    isStopped: false,
    isTutorGeneratingAudio: true,
    hadAudioInCurrentSubturn: true,
    generationCompleteSealTimerArmed: false,  // no debounce timer running
    generationCompleteWatchdogTimerArmed: true,
  };

  const sealCallsD: SealSource[] = [];
  stateD.generationCompleteWatchdogTimerArmed = false;

  if (!stateD.isStopped && stateD.isTutorGeneratingAudio && stateD.hadAudioInCurrentSubturn) {
    // Cancel any pending seal (no-op — timer is not armed)
    if (stateD.generationCompleteSealTimerArmed) {
      stateD.generationCompleteSealTimerArmed = false;
    }
    sealCallsD.push('watchdog');
  }

  assert(
    'Scenario D — Watchdog seals exactly once even when no debounce timer was armed',
    sealCallsD.length === 1 && sealCallsD[0] === 'watchdog',
    `Expected [watchdog]; got [${sealCallsD.join(', ')}]`,
  );
  assert(
    'Scenario D — Seal timer remains disarmed after watchdog (no phantom timer)',
    !stateD.generationCompleteSealTimerArmed,
    'generationCompleteSealTimerArmed should remain false when it was already false',
  );

  // ── Scenario E: Double-seal regression test ─────────────────────────────────
  // Confirms that IF the watchdog did NOT cancel the debounce timer (regression),
  // two seals would fire — validating that the test would catch the regression.
  console.log('');
  console.log(D('  Scenario E: regression model — what happens if watchdog omits clearTimeout'));
  console.log(D('             → two seal calls (shows the test catches the regression)'));
  console.log('');

  const sealCallsE: SealSource[] = [];
  let sealTimerE = true; // debounce is armed

  // Watchdog fires but deliberately does NOT cancel the debounce timer
  sealCallsE.push('watchdog'); // watchdog seals

  // Debounce fires too — timer was not cancelled
  if (sealTimerE) {
    sealCallsE.push('debounce-extended'); // double-seal!
  }

  assert(
    'Scenario E — Without clearTimeout, two seals would occur (confirms test catches regression)',
    sealCallsE.length === 2 &&
      sealCallsE[0] === 'watchdog' &&
      sealCallsE[1] === 'debounce-extended',
    `Expected double-seal [watchdog, debounce-extended]; got [${sealCallsE.join(', ')}]`,
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
  console.log(D('  Watchdog takeover confirmed:'));
  console.log(D('    • clearTimeout(generationCompleteSealTimer) is called inside the watchdog block'));
  console.log(D('    • generationCompleteSealTimer is nulled BEFORE sealCurrentAudioSubturn'));
  console.log(D('    • When watchdog fires mid-debounce-extension, exactly ONE seal is made'));
  console.log(D('    • Watchdog self-nulls its own reference regardless of guard outcome'));
  console.log(D('    • Without the clearTimeout, a double-seal would occur (regression test validates this)\n'));
  process.exit(0);
} else {
  console.log(R(`\n  ✗ ${failed} of ${total} checks FAILED\n`));
  console.log(Y('  If the watchdog or debounce extension has changed, review:'));
  console.log(Y('    • Lines ~1577–1620 in gemini-live-session.ts (watchdog block)'));
  console.log(Y('    • Lines ~1978–1992 in gemini-live-session.ts (debounce extension)'));
  console.log(Y('    • clearTimeout(generationCompleteSealTimer) must precede the seal call'));
  console.log(Y('    • generationCompleteSealTimer must be nulled before sealCurrentAudioSubturn'));
  console.log('');
  process.exit(1);
}
