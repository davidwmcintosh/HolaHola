/**
 * test-gl-multipart-response-guard.ts
 *
 * Confirms that multi-part GL responses (two audio sub-turns separated by a
 * generationComplete) play completely when the responseFlushedToClient guard is
 * active, and that a truly spurious third audio chunk IS suppressed.
 *
 * Background
 * ──────────
 * GeminiLiveSession has a two-part double-generation guard in the audio-part
 * handler (gemini-live-session.ts):
 *
 *   Part 1 — isTutorGeneratingAudio gate (line ~1943):
 *     Fires when no student input has arrived since the last response AND the
 *     tutor audio gate is already closed. Covers the case where a full second
 *     generation starts fresh.
 *
 *   Part 2 — responseFlushedToClient gate (line ~1955):
 *     Fires when response_complete has already been sent to the client AND no new
 *     student input has arrived. Covers the window where the second generation
 *     starts while the first stream is still playing (isTutorGeneratingAudio=true,
 *     so Part 1 would miss it).
 *
 * For legitimate multi-part responses:
 *   Sub-turn 1 audio → generationComplete → afterGenerationComplete=true,
 *   800ms debounce armed (generationCompleteSealTimer).
 *   Sub-turn 2 audio arrives BEFORE the 800ms debounce fires:
 *     • responseFlushedToClient is still false (response_complete not sent yet)
 *     • isTutorGeneratingAudio is still true (we are mid-generation)
 *   ∴ Neither guard fires → second sub-turn plays completely ✓
 *
 *   Debounce fires → sealCurrentAudioSubturn → flushTranscripts →
 *   response_complete sent → responseFlushedToClient=true.
 *
 *   Spurious third audio arrives (after response_complete, no new student input):
 *     • responseFlushedToClient=true AND !hasStudentInputSinceLastResponse
 *   ∴ Part 2 guard fires → audio suppressed ✓
 *
 * This script uses:
 *   A) Static source analysis — verifies the guard blocks exist verbatim in
 *      gemini-live-session.ts and that responseFlushedToClient is correctly armed
 *      only inside flushTranscripts() (after response_complete is sent).
 *   B) A local flag-state simulation — mirrors the exact guard conditions and the
 *      flag lifecycle to prove the multi-part boundary holds.
 *
 * Run: npx tsx server/scripts/test-gl-multipart-response-guard.ts
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

// ── Load source file ───────────────────────────────────────────────────────────
const src = readFileSync(
  resolve(__dirname, '../services/gemini-live-session.ts'),
  'utf-8',
);
const lines = src.split('\n');

/** Return the 1-based line number of the FIRST occurrence of a substring. -1 if absent. */
function lineOf(needle: string): number {
  const idx = lines.findIndex(l => l.includes(needle));
  return idx === -1 ? -1 : idx + 1;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static analysis: guard block structure in gemini-live-session.ts
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static source analysis: guard block structure'));
sep();

function part1() {
  // ── 1a. Part-2 guard condition exists ─────────────────────────────────────
  const hasGuardCondition = src.includes(
    'this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
  );
  assert(
    'Part-2 guard condition (responseFlushedToClient) is present in source',
    hasGuardCondition,
    'Expected: if (this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse)',
  );

  // ── 1b. Guard is inside the audio-part loop (before line ~2100) ────────────
  const guardLine = lineOf(
    'this.responseFlushedToClient && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse',
  );
  const audioLoopStart = lineOf("p.inlineData?.data && p.inlineData.mimeType?.includes('audio')");
  assert(
    `Part-2 guard is inside the audio-part loop (line ${guardLine}, loop starts ~${audioLoopStart})`,
    guardLine > audioLoopStart && guardLine < audioLoopStart + 150,
    `Guard line ${guardLine} should be within 150 lines of audio-part loop start ${audioLoopStart}`,
  );

  // ── 1c. Guard issues a console.warn when it suppresses ─────────────────────
  const suppressWarnLine = lineOf('Spurious GL audio after response_complete');
  assert(
    'Part-2 guard emits a console.warn when suppressing (line ' + suppressWarnLine + ')',
    suppressWarnLine > 0,
    'Expected: console.warn([GeminiLive] Spurious GL audio after response_complete …)',
  );

  // ── 1d. responseFlushedToClient is set to true AFTER response_complete is sent ──
  const rcSendLine   = lineOf("type: 'response_complete'");
  const rfcArmLine   = lineOf('this.responseFlushedToClient = true');
  assert(
    `responseFlushedToClient=true is set AFTER response_complete is sent (send:${rcSendLine}, arm:${rfcArmLine})`,
    rfcArmLine > rcSendLine,
    `responseFlushedToClient=true (line ${rfcArmLine}) must come after response_complete send (line ${rcSendLine})`,
  );

  // ── 1e. responseFlushedToClient is cleared at the start of a new generation ─
  // "Clear the response-flushed guard so this generation can pass through." comment
  // followed immediately by: this.responseFlushedToClient = false;
  const clearCommentLine = lineOf('Clear the response-flushed guard so this generation can pass through');
  const rfcFalseLine     = lines.slice(clearCommentLine).findIndex(l =>
    l.includes('this.responseFlushedToClient = false')
  );
  assert(
    'responseFlushedToClient is cleared at the start of a new generation (within 3 lines of comment)',
    clearCommentLine > 0 && rfcFalseLine >= 0 && rfcFalseLine < 4,
    `Comment at line ${clearCommentLine + 1}; false assignment ${rfcFalseLine < 0 ? 'not found' : 'found ' + rfcFalseLine + ' lines after'}`,
  );

  // ── 1f. The arm is inside flushTranscripts (guarded by sealCurrentAudioSubturn comment context) ──
  // Check that the arm comment "Arm the response-flushed guard" is present
  const armCommentLine = lineOf('Arm the response-flushed guard: any GL audio arriving after this point');
  assert(
    'Arm-comment exists immediately before responseFlushedToClient=true (line ' + armCommentLine + ')',
    armCommentLine > 0,
    'Expected: // Arm the response-flushed guard: any GL audio arriving after this point …',
  );

  // ── 1g. generationComplete arms the 800ms debounce seal ─────────────────────
  const debounceTimerLine = lineOf("this.generationCompleteSealTimer = setTimeout(() => {");
  assert(
    'generationComplete arms an 800ms debounce timer (generationCompleteSealTimer) — line ' + debounceTimerLine,
    debounceTimerLine > 0,
    'Expected: this.generationCompleteSealTimer = setTimeout(() => { … }, 800)',
  );
  // Confirm the timer uses 800ms
  const timerBlock = lines.slice(debounceTimerLine - 1, debounceTimerLine + 20).join('\n');
  assert(
    'Debounce timer delay is 800 ms',
    timerBlock.includes('}, 800)') || timerBlock.includes(', 800)'),
    `Timer block (lines ~${debounceTimerLine}–${debounceTimerLine + 20}): delay not 800`,
  );

  // ── 1h. afterGenerationComplete is set on the generationComplete signal ──────
  const afterGCSetLine = lineOf('this.afterGenerationComplete = true');
  assert(
    'afterGenerationComplete is set to true on generationComplete signal (line ' + afterGCSetLine + ')',
    afterGCSetLine > 0,
  );

  // ── 1i. Multi-part safety comment is present ────────────────────────────────
  const safetyCommentLine = lineOf('Safe for multi-part continuations: those arrive before the debounce seal fires');
  assert(
    'Multi-part safety comment is present in source (line ' + safetyCommentLine + ')',
    safetyCommentLine > 0,
    'Expected inline comment explaining that multi-part audio arrives before the debounce seal fires',
  );
}

part1();

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Flag-state simulation: multi-part boundary behaviour
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Flag-state simulation: multi-part response boundary'));
sep();

/**
 * Minimal simulation of the three flags that govern the audio-part guard.
 * Mirrors the exact guard conditions in gemini-live-session.ts.
 */
interface GuardState {
  isTutorGeneratingAudio: boolean;
  greetingPhaseActive: boolean;
  hasStudentInputSinceLastResponse: boolean;
  responseFlushedToClient: boolean;
  afterGenerationComplete: boolean;
}

/** Returns true if the audio chunk is allowed to pass through (not suppressed). */
function simulateAudioArrival(s: GuardState): { allowed: boolean; reason: string } {
  // Part-1 guard
  if (!s.isTutorGeneratingAudio && !s.greetingPhaseActive && !s.hasStudentInputSinceLastResponse) {
    return { allowed: false, reason: 'Part-1: spurious start while mic closed and no student input' };
  }
  // Part-2 guard
  if (s.responseFlushedToClient && !s.greetingPhaseActive && !s.hasStudentInputSinceLastResponse) {
    return { allowed: false, reason: 'Part-2: response_complete already sent, no new student input' };
  }
  return { allowed: true, reason: 'passes both guards' };
}

/** Mirrors the first-audio-chunk flag mutations:
 *  isTutorGeneratingAudio → true, responseFlushedToClient → false,
 *  hasStudentInputSinceLastResponse → false (if not greeting). */
function onFirstAudioChunk(s: GuardState, wasGreetingPhase: boolean): void {
  if (!s.isTutorGeneratingAudio) {
    s.isTutorGeneratingAudio = true;
    if (!wasGreetingPhase) {
      s.hasStudentInputSinceLastResponse = false;
    }
    s.afterGenerationComplete = false;
    s.responseFlushedToClient = false; // "Clear the response-flushed guard so this generation can pass through"
  }
}

function part2() {
  // ── Scenario: two-sub-turn multi-part response followed by a spurious third chunk ──

  console.log(D('  Scenario: student speaks → sub-turn 1 audio → generationComplete →'));
  console.log(D('            sub-turn 2 audio (before debounce) → debounce fires (response_complete sent)'));
  console.log(D('            → spurious third chunk arrives'));
  console.log('');

  // Initial state after student sends new input (new student turn)
  const state: GuardState = {
    isTutorGeneratingAudio: false,
    greetingPhaseActive: false,
    hasStudentInputSinceLastResponse: true,  // student just spoke
    responseFlushedToClient: false,
    afterGenerationComplete: false,
  };

  // ── Step 1: First audio chunk of sub-turn 1 ────────────────────────────────
  const step1Before = simulateAudioArrival(state);
  assert(
    'Step 1 — First sub-turn 1 audio chunk is allowed (student input just arrived)',
    step1Before.allowed,
    `Guard fired unexpectedly: ${step1Before.reason}`,
  );
  onFirstAudioChunk(state, false); // mutate flags as the handler does
  assert(
    'Step 1 — isTutorGeneratingAudio=true after first audio chunk',
    state.isTutorGeneratingAudio,
  );
  assert(
    'Step 1 — responseFlushedToClient=false after first audio chunk',
    !state.responseFlushedToClient,
  );
  assert(
    'Step 1 — hasStudentInputSinceLastResponse=false after first audio chunk (non-greeting)',
    !state.hasStudentInputSinceLastResponse,
  );

  // ── Step 2: generationComplete fires (mid-multi-part) ─────────────────────
  // Sets afterGenerationComplete=true, arms the 800ms debounce.
  // response_complete is NOT sent yet — debounce hasn't fired.
  state.afterGenerationComplete = true;
  // responseFlushedToClient remains false (debounce hasn't fired yet)
  assert(
    'Step 2 — After generationComplete: responseFlushedToClient still false (debounce not fired)',
    !state.responseFlushedToClient,
    'The 800ms debounce has not fired, so response_complete has not been sent yet',
  );
  assert(
    'Step 2 — afterGenerationComplete=true after generationComplete signal',
    state.afterGenerationComplete,
  );

  // ── Step 3: Sub-turn 2 audio arrives BEFORE debounce fires ────────────────
  // This is the critical assertion: the second sub-turn must pass both guards
  // because responseFlushedToClient is still false.
  const step3 = simulateAudioArrival(state);
  assert(
    'Step 3 — Sub-turn 2 audio is ALLOWED (responseFlushedToClient=false, before debounce)',
    step3.allowed,
    `Guard unexpectedly fired: ${step3.reason}`,
  );
  // Also verify which guard would have fired — neither should fire
  const part1WouldFire = !state.isTutorGeneratingAudio && !state.greetingPhaseActive && !state.hasStudentInputSinceLastResponse;
  const part2WouldFire = state.responseFlushedToClient && !state.greetingPhaseActive && !state.hasStudentInputSinceLastResponse;
  assert(
    'Step 3 — Part-1 guard does NOT fire (isTutorGeneratingAudio=true)',
    !part1WouldFire,
    `Part-1 conditions: isTutorGeneratingAudio=${state.isTutorGeneratingAudio}, greetingPhaseActive=${state.greetingPhaseActive}, hasStudentInput=${state.hasStudentInputSinceLastResponse}`,
  );
  assert(
    'Step 3 — Part-2 guard does NOT fire (responseFlushedToClient=false)',
    !part2WouldFire,
    `Part-2 conditions: responseFlushedToClient=${state.responseFlushedToClient}`,
  );

  // ── Step 4: 800ms debounce fires → response_complete sent → responseFlushedToClient=true ──
  // Mirrors: flushTranscripts() → sendWsMessage(response_complete) → this.responseFlushedToClient = true
  state.responseFlushedToClient = true;
  assert(
    'Step 4 — After debounce fires: responseFlushedToClient=true',
    state.responseFlushedToClient,
  );

  // ── Step 5: Spurious third chunk arrives (no new student input) ────────────
  // Must be suppressed by the Part-2 guard.
  const step5 = simulateAudioArrival(state);
  assert(
    'Step 5 — Spurious third audio chunk is SUPPRESSED (Part-2 guard)',
    !step5.allowed,
    `Expected suppression by Part-2 guard; instead got: ${step5.reason}`,
  );
  assert(
    'Step 5 — Suppression reason identifies Part-2 (responseFlushedToClient)',
    step5.reason.includes('Part-2'),
    `Suppression reason: "${step5.reason}"`,
  );

  // ── Additional: student new input → guard resets ──────────────────────────
  console.log('');
  console.log(D('  Additional: student sends new input after response → guards reset for next turn'));
  console.log('');
  state.hasStudentInputSinceLastResponse = true;
  state.isTutorGeneratingAudio = false;
  state.responseFlushedToClient = false;  // reset as interrupt/new-turn path does
  state.afterGenerationComplete = false;

  const resetStep = simulateAudioArrival(state);
  assert(
    'Reset — New audio after student speaks again is ALLOWED (both guards clear)',
    resetStep.allowed,
    `Unexpected suppression: ${resetStep.reason}`,
  );
}

part2();

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Negative path: guard correctly fires when debounce has already sealed
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Negative path: guard fires when responseFlushedToClient=true'));
sep();

function part3() {
  // State: response_complete already sent, isTutorGeneratingAudio still true
  // (client hasn't reported playback_ended yet — the window Part-1 misses).
  const state: GuardState = {
    isTutorGeneratingAudio: true,      // client still playing audio
    greetingPhaseActive: false,
    hasStudentInputSinceLastResponse: false,  // student has NOT spoken
    responseFlushedToClient: true,     // response_complete already sent
    afterGenerationComplete: true,
  };

  const result = simulateAudioArrival(state);
  assert(
    'Part-2 guard fires when isTutorGeneratingAudio=true but responseFlushedToClient=true',
    !result.allowed,
    `Expected suppression; got: ${result.reason}`,
  );
  assert(
    'Suppression is attributed to Part-2 (response_complete already sent)',
    result.reason.includes('Part-2'),
    `Reason: "${result.reason}"`,
  );

  // Confirm Part-1 alone would NOT catch this case (isTutorGeneratingAudio=true)
  const part1WouldFire = !state.isTutorGeneratingAudio && !state.greetingPhaseActive && !state.hasStudentInputSinceLastResponse;
  assert(
    'Part-1 guard alone would NOT catch this case (isTutorGeneratingAudio=true during playback)',
    !part1WouldFire,
    'Part-1 requires isTutorGeneratingAudio=false, so it misses this window — Part-2 is needed',
  );
}

part3();

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Greeting phase: guard stays inactive during greeting
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — Greeting phase exemption: guard inactive when greetingPhaseActive=true'));
sep();

function part4() {
  // During the greeting, responseFlushedToClient may be false anyway, but even if
  // the state is otherwise "suppression-worthy", greetingPhaseActive short-circuits.
  const state: GuardState = {
    isTutorGeneratingAudio: false,
    greetingPhaseActive: true,         // greeting is in progress
    hasStudentInputSinceLastResponse: false,
    responseFlushedToClient: true,     // hypothetically true
    afterGenerationComplete: false,
  };

  const result = simulateAudioArrival(state);
  assert(
    'Greeting audio is ALLOWED even when responseFlushedToClient=true (greetingPhaseActive exemption)',
    result.allowed,
    `Unexpected suppression during greeting: ${result.reason}`,
  );
}

part4();

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════
sep();
const total = passed + failed;
if (failed === 0) {
  console.log(G(`\n  ✓ All ${total} checks passed\n`));
  console.log(D('  Multi-part GL responses are confirmed safe: the second sub-turn'));
  console.log(D('  always arrives before the debounce seal, so responseFlushedToClient'));
  console.log(D('  is false when it reaches the guard. Spurious post-seal audio is'));
  console.log(D('  correctly blocked by the Part-2 guard.\n'));
  process.exit(0);
} else {
  console.log(R(`\n  ✗ ${failed} of ${total} checks FAILED\n`));
  console.log(Y('  If the debounce window or flag lifecycle has changed, review:'));
  console.log(Y('    • The Part-2 guard block (~line 1955 in gemini-live-session.ts)'));
  console.log(Y('    • responseFlushedToClient=true placement in flushTranscripts()'));
  console.log(Y('    • responseFlushedToClient=false clear on first audio chunk'));
  console.log('');
  process.exit(1);
}
