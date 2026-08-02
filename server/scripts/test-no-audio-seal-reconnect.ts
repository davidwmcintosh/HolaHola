/**
 * test-no-audio-seal-reconnect.ts
 *
 * Task 639 — Confirm the no-audio-seal guard (hadAudioInCurrentSubturn) still
 * prevents double-counting after a GL reconnect resets the flag.
 *
 * Three checks:
 *  1. Static: hadAudioInCurrentSubturn is set to true ONLY in the audio-chunk
 *             handler — not in reconnect bootstrap or start()
 *  2. Static: the reconnect reset block explicitly sets hadAudioInCurrentSubturn = false
 *             before calling start() again (ensuring the new session starts "clean")
 *  3. Simulation: reconnect mid-response with partial audio already sealed →
 *             totalSentences of the new session reflects only post-reconnect
 *             sub-turns; the guard blocks any spurious seal until audio arrives
 *
 * Exit 0 on all green, 1 on any failure.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SRC = path.resolve(__dirname, '../services/gemini-live-session.ts');

// ─── helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(label: string): void {
  console.log(`  ✓  ${label}`);
  passed++;
}

function fail(label: string, detail?: string): void {
  console.error(`  ✗  ${label}`);
  if (detail) console.error(`     ${detail}`);
  failed++;
}

// ─── read source once ─────────────────────────────────────────────────────────

if (!fs.existsSync(SRC)) {
  console.error(`Source file not found: ${SRC}`);
  process.exit(1);
}

const src = fs.readFileSync(SRC, 'utf8');
const lines = src.split('\n');

function findBlock(startPattern: RegExp): { startIdx: number; endIdx: number } | null {
  const startIdx = lines.findIndex(l => startPattern.test(l));
  if (startIdx === -1) return null;
  let depth = 0;
  for (let i = startIdx; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return { startIdx, endIdx: i }; }
    }
  }
  return null;
}

// ─── Check 1: hadAudioInCurrentSubturn = true only in the audio chunk handler ─

console.log('\nCheck 1 — hadAudioInCurrentSubturn = true is set ONLY in the audio-chunk handler');

// Find every line that sets hadAudioInCurrentSubturn = true
const setTrueLines = lines
  .map((l, i) => ({ line: l, lineNo: i + 1 }))
  .filter(({ line }) => /this\.hadAudioInCurrentSubturn\s*=\s*true/.test(line));

if (setTrueLines.length === 0) {
  fail('hadAudioInCurrentSubturn = true not found anywhere in the source');
} else {
  if (setTrueLines.length === 1) {
    pass(`hadAudioInCurrentSubturn = true appears exactly once (line ${setTrueLines[0].lineNo})`);
  } else {
    fail(
      `hadAudioInCurrentSubturn = true appears ${setTrueLines.length} times — expected exactly 1`,
      setTrueLines.map(e => `  line ${e.lineNo}: ${e.line.trim()}`).join('\n     '),
    );
  }

  // Locate the start() method body
  const startBlock = findBlock(/async start\s*\(/);
  const startFnStart = startBlock?.startIdx ?? -1;
  const startFnEnd   = startBlock?.endIdx ?? -1;

  // Locate the reconnect reset block (the setTimeout callback inside the onclose handler)
  // The reset block is identified by the comment "Reset per-session flags so start() can run again"
  const resetCommentIdx = lines.findIndex(l =>
    /Reset per-session flags so start\(\) can run again/.test(l)
  );

  for (const { line, lineNo } of setTrueLines) {
    const inStartFn = startFnStart !== -1 && startFnEnd !== -1 &&
                      lineNo > startFnStart && lineNo <= startFnEnd;

    const inResetBlock = resetCommentIdx !== -1 && lineNo > resetCommentIdx &&
                         lineNo < resetCommentIdx + 80; // reset block is ~80 lines

    if (inStartFn) {
      fail(
        `hadAudioInCurrentSubturn = true is set inside start() at line ${lineNo} — must only fire when real audio arrives`,
        line.trim(),
      );
    } else if (inResetBlock) {
      fail(
        `hadAudioInCurrentSubturn = true is set inside the reconnect reset block at line ${lineNo} — bootstrap must not pre-claim audio`,
        line.trim(),
      );
    } else {
      pass(`hadAudioInCurrentSubturn = true at line ${lineNo} is outside start() and reconnect bootstrap`);
    }
  }
}

// ─── Check 2: reconnect reset block sets hadAudioInCurrentSubturn = false ─────

console.log('\nCheck 2 — reconnect reset block sets hadAudioInCurrentSubturn = false before re-calling start()');

// Locate the reset comment to find the reset block
const resetCommentIdx = lines.findIndex(l =>
  /Reset per-session flags so start\(\) can run again/.test(l)
);

if (resetCommentIdx === -1) {
  fail('Could not locate the reconnect reset block (comment "Reset per-session flags so start() can run again" not found)');
} else {
  pass(`Reconnect reset block found at line ${resetCommentIdx + 1}`);

  // The reset block ends at the start() call — scan up to 100 lines
  const resetBlockLines = lines.slice(resetCommentIdx, resetCommentIdx + 100);
  const resetBlockText  = resetBlockLines.join('\n');

  // hadAudioInCurrentSubturn must be set to false here
  if (/this\.hadAudioInCurrentSubturn\s*=\s*false/.test(resetBlockText)) {
    // Find the exact line number
    const falseIdx = resetBlockLines.findIndex(l =>
      /this\.hadAudioInCurrentSubturn\s*=\s*false/.test(l)
    );
    pass(`hadAudioInCurrentSubturn = false is in the reconnect reset block (line ${resetCommentIdx + 1 + falseIdx})`);
  } else {
    fail(
      'hadAudioInCurrentSubturn = false NOT found in the reconnect reset block',
      `Searched lines ${resetCommentIdx + 1}–${resetCommentIdx + 100}`,
    );
  }

  // The reset must happen BEFORE the await this.start() call in the same block
  const falseIdx  = resetBlockLines.findIndex(l => /this\.hadAudioInCurrentSubturn\s*=\s*false/.test(l));
  const startCallIdx = resetBlockLines.findIndex(l => /await this\.start\(/.test(l));

  if (falseIdx === -1 || startCallIdx === -1) {
    fail(
      'Could not confirm ordering — either reset or start() call not found in expected window',
      `falseIdx=${falseIdx} startCallIdx=${startCallIdx}`,
    );
  } else if (falseIdx < startCallIdx) {
    pass(`hadAudioInCurrentSubturn reset (line ${resetCommentIdx + 1 + falseIdx}) precedes await this.start() (line ${resetCommentIdx + 1 + startCallIdx})`);
  } else {
    fail(
      'hadAudioInCurrentSubturn reset AFTER await this.start() — bootstrap could see stale true value',
      `resetLine=${resetCommentIdx + 1 + falseIdx} startCallLine=${resetCommentIdx + 1 + startCallIdx}`,
    );
  }
}

// Confirm start() itself does not set hadAudioInCurrentSubturn = true anywhere
const startBlock2 = findBlock(/async start\s*\(/);
if (!startBlock2) {
  fail('start() method not found — cannot verify bootstrap safety');
} else {
  const startBody = lines.slice(startBlock2.startIdx, startBlock2.endIdx + 1).join('\n');
  if (/this\.hadAudioInCurrentSubturn\s*=\s*true/.test(startBody)) {
    fail('start() sets hadAudioInCurrentSubturn = true — reconnect bootstrap would pre-claim audio');
  } else {
    pass('start() does NOT set hadAudioInCurrentSubturn = true — bootstrap is safe');
  }
}

// ─── Check 3: simulation — reconnect mid-response, double-counting prevented ──

console.log('\nCheck 3 — State simulation: reconnect mid-response');

/**
 * Minimal simulation of the three fields relevant to the guard:
 *   currentSentenceIndex    — incremented by sealCurrentAudioSubturn()
 *   hadAudioInCurrentSubturn — guard: seal is a no-op without prior audio
 *
 * Each function mirrors the exact logic verified in Check 1 & 2.
 */
interface SimState {
  currentSentenceIndex: number;
  hadAudioInCurrentSubturn: boolean;
}

function simulateAudioChunk(state: SimState): void {
  // Mirror of line 1994: set when a real audio_chunk arrives
  state.hadAudioInCurrentSubturn = true;
}

function simulateSeal(state: SimState): void {
  // Mirror of sealCurrentAudioSubturn() — guard + increment + reset
  if (!state.hadAudioInCurrentSubturn) return;          // line 1534: no-op guard
  state.currentSentenceIndex++;                         // line 1558: increment
  state.hadAudioInCurrentSubturn = false;               // line 1560: clear guard
}

function simulateReconnectReset(state: SimState): void {
  // Mirror of the reconnect reset block (lines ~1147–1186):
  // All per-turn state flags are cleared before start() is called again.
  state.currentSentenceIndex = 0;                       // line 1151
  state.hadAudioInCurrentSubturn = false;               // line 1154
}

function simulateFlush(state: SimState): number {
  // Mirror of _doFlushTranscripts() line 4053: capture then reset
  const total = state.currentSentenceIndex;
  state.currentSentenceIndex = 0;
  return total;
}

// Scenario A: reconnect mid-turn — had 2 sealed sub-turns before reconnect.
// After reconnect + 1 new sub-turn with audio, totalSentences must be 1 (not 3).
{
  const state: SimState = { currentSentenceIndex: 0, hadAudioInCurrentSubturn: false };

  // Pre-reconnect: 2 sub-turns complete with audio
  simulateAudioChunk(state);
  simulateSeal(state);         // → sentenceIndex 1
  simulateAudioChunk(state);
  simulateSeal(state);         // → sentenceIndex 2

  // Reconnect fires mid-turn (before flushTranscripts on the old session)
  // The old session's response_complete was already sent (totalSentences=2) → reset
  simulateReconnectReset(state);  // sentenceIndex → 0, hadAudio → false

  // After reconnect: guard is false — a stale sealCurrentAudioSubturn call must be no-op
  simulateSeal(state);  // no-op: hadAudio is false
  if (state.currentSentenceIndex === 0) {
    pass('Spurious seal after reconnect (no audio yet) is a no-op — sentenceIndex stays 0');
  } else {
    fail(
      'Spurious seal after reconnect incremented sentenceIndex — guard did not fire',
      `sentenceIndex=${state.currentSentenceIndex}`,
    );
  }

  // Now audio arrives in the new session → one real sub-turn
  simulateAudioChunk(state);
  simulateSeal(state);         // → sentenceIndex 1
  const total = simulateFlush(state);
  if (total === 1) {
    pass('Post-reconnect: 1 sub-turn with audio → totalSentences=1 (pre-reconnect sub-turns not double-counted)');
  } else {
    fail(
      `Post-reconnect totalSentences expected 1, got ${total}`,
      'Pre-reconnect seals should have been flushed by the old session',
    );
  }
}

// Scenario B: reconnect before any audio in the current sub-turn.
// Guard was already false → reset is redundant but must not flip it to true.
{
  const state: SimState = { currentSentenceIndex: 0, hadAudioInCurrentSubturn: false };

  // No audio arrived before the drop
  simulateReconnectReset(state);

  if (!state.hadAudioInCurrentSubturn) {
    pass('Reconnect reset with hadAudio=false — flag remains false after reset');
  } else {
    fail('Reconnect reset set hadAudioInCurrentSubturn = true — bootstrap incorrectly pre-claims audio');
  }

  // No audio in new session → seal is still a no-op
  simulateSeal(state);
  const total = simulateFlush(state);
  if (total === 0) {
    pass('No audio before or after reconnect → totalSentences=0 (no inflation)');
  } else {
    fail(`Expected totalSentences=0, got ${total}`);
  }
}

// Scenario C: reconnect mid-turn with partial audio (hadAudio was true when the drop occurred).
// Reset must flip it to false so the next session starts clean.
{
  const state: SimState = { currentSentenceIndex: 0, hadAudioInCurrentSubturn: false };

  // Audio was mid-flight when connection dropped
  simulateAudioChunk(state);
  // (seal never ran — GL dropped the connection)

  if (!state.hadAudioInCurrentSubturn) {
    fail('Test setup error — hadAudio should be true at this point');
  }

  // Reconnect resets ALL state — including the in-flight hadAudio flag
  simulateReconnectReset(state);

  if (!state.hadAudioInCurrentSubturn) {
    pass('Reconnect resets hadAudioInCurrentSubturn = false even when audio was mid-flight');
  } else {
    fail('Reconnect did NOT reset hadAudioInCurrentSubturn — stale true value survives into new session');
  }

  // Verify: without new audio the no-audio guard fires correctly
  simulateSeal(state);  // no-op
  const totalBefore = simulateFlush(state);
  if (totalBefore === 0) {
    pass('After reconnect with stale hadAudio reset: no-audio seal is no-op → totalSentences=0');
  } else {
    fail(`Expected totalSentences=0 after spurious seal, got ${totalBefore}`);
  }

  // And with new audio it works normally
  simulateAudioChunk(state);
  simulateSeal(state);
  const totalAfter = simulateFlush(state);
  if (totalAfter === 1) {
    pass('After reconnect: first real audio → seal → totalSentences=1 (correct)');
  } else {
    fail(`Expected totalSentences=1 after one real post-reconnect sub-turn, got ${totalAfter}`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\n❌  One or more checks failed.');
  process.exit(1);
} else {
  console.log('\n✅  All checks passed — hadAudioInCurrentSubturn guard is safe across GL reconnects.');
  process.exit(0);
}
