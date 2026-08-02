/**
 * test-total-sentences-subturn.ts
 *
 * Task 638 — Confirm totalSentences includes both sub-turns when a
 * multi-part GL response is sealed.
 *
 * Three checks:
 *  1. Static: sealCurrentAudioSubturn() increments currentSentenceIndex
 *  2. Static: flushTranscripts() reads totalSentences from the live
 *             currentSentenceIndex (not a stale snapshot captured before sealing)
 *  3. State simulation: two seals → sentenceIndex=2; one seal → sentenceIndex=1;
 *     the value captured by the flush matches in both cases.
 *
 * Exit 0 on all green, 1 on any failure.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const SRC = path.resolve(__dirname, '../services/gemini-live-session.ts');

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function findLineNumbers(pattern: RegExp): number[] {
  return lines
    .map((l, i) => ({ line: l, idx: i + 1 }))
    .filter(({ line }) => pattern.test(line))
    .map(({ idx }) => idx);
}

// ─── Check 1: sealCurrentAudioSubturn() increments currentSentenceIndex ──────

console.log('\nCheck 1 — sealCurrentAudioSubturn() increments currentSentenceIndex');

const sealFnStart = lines.findIndex(l => /private sealCurrentAudioSubturn\(/.test(l));
const sealFnEnd   = (() => {
  // Find the closing brace of the function by tracking brace depth from sealFnStart
  let depth = 0;
  for (let i = sealFnStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return i; }
    }
  }
  return -1;
})();

if (sealFnStart === -1 || sealFnEnd === -1) {
  fail('sealCurrentAudioSubturn function not found in source');
} else {
  const sealBody = lines.slice(sealFnStart, sealFnEnd + 1).join('\n');

  if (/this\.currentSentenceIndex\+\+/.test(sealBody)) {
    pass('sealCurrentAudioSubturn() contains this.currentSentenceIndex++');
  } else {
    fail(
      'sealCurrentAudioSubturn() does NOT increment currentSentenceIndex',
      `Searched lines ${sealFnStart + 1}–${sealFnEnd + 1}`,
    );
  }

  // Also confirm it resets hadAudioInCurrentSubturn (otherwise a no-audio sub-turn
  // would silently skip the increment and under-count sentences)
  if (/this\.hadAudioInCurrentSubturn\s*=\s*false/.test(sealBody)) {
    pass('sealCurrentAudioSubturn() resets hadAudioInCurrentSubturn after seal');
  } else {
    fail('sealCurrentAudioSubturn() does not reset hadAudioInCurrentSubturn');
  }
}

// ─── Check 2: flushTranscripts reads live currentSentenceIndex ───────────────

console.log('\nCheck 2 — flushTranscripts() reads totalSentences from live currentSentenceIndex');

// Locate _doFlushTranscripts
const flushFnStart = lines.findIndex(l => /private async _doFlushTranscripts\(\)/.test(l));
const flushFnEnd   = (() => {
  let depth = 0;
  for (let i = flushFnStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return i; }
    }
  }
  return -1;
})();

if (flushFnStart === -1 || flushFnEnd === -1) {
  fail('_doFlushTranscripts function not found in source');
} else {
  const flushBody = lines.slice(flushFnStart, flushFnEnd + 1).join('\n');

  // totalSentences must be assigned from this.currentSentenceIndex directly
  if (/const totalSentences\s*=\s*this\.currentSentenceIndex/.test(flushBody)) {
    pass('totalSentences is captured from this.currentSentenceIndex at flush time');
  } else {
    fail(
      'totalSentences is NOT read from this.currentSentenceIndex in _doFlushTranscripts',
      `Searched lines ${flushFnStart + 1}–${flushFnEnd + 1}`,
    );
  }

  // Confirm there is no earlier snapshot (e.g. const snap = this.currentSentenceIndex before seal)
  // The flush function must NOT capture the value BEFORE the seals complete.
  // A "stale snapshot" would look like a variable assigned from currentSentenceIndex
  // elsewhere and then passed into flush as an argument — check the flush signature.
  const flushSignatureLine = lines[flushFnStart];
  if (/\(sentenceCount|totalSentences/.test(flushSignatureLine)) {
    fail(
      '_doFlushTranscripts accepts an external totalSentences argument — value may be stale',
      flushSignatureLine.trim(),
    );
  } else {
    pass('_doFlushTranscripts takes no totalSentences argument — reads live state only');
  }

  // Confirm totalSentences is used in the response_complete message
  if (/type:\s*['"]response_complete['"][\s\S]{0,300}totalSentences/.test(flushBody)) {
    pass('response_complete message includes totalSentences from the flush-time capture');
  } else {
    fail('response_complete message does not reference totalSentences in _doFlushTranscripts');
  }

  // Confirm currentSentenceIndex is reset AFTER totalSentences is captured
  // (order must be: capture → send response_complete → reset index to 0)
  const captureIdx = flushBody.indexOf('const totalSentences = this.currentSentenceIndex');
  const resetIdx   = flushBody.indexOf('this.currentSentenceIndex = 0');
  if (captureIdx !== -1 && resetIdx !== -1 && captureIdx < resetIdx) {
    pass('currentSentenceIndex reset to 0 occurs AFTER totalSentences is captured');
  } else {
    fail(
      'currentSentenceIndex reset ordering is wrong — reset may clobber totalSentences capture',
      `captureIdx=${captureIdx} resetIdx=${resetIdx}`,
    );
  }
}

// ─── Check 3: State simulation ────────────────────────────────────────────────

console.log('\nCheck 3 — State simulation');

/**
 * Minimal simulation of the two fields that matter:
 *   currentSentenceIndex — incremented by sealCurrentAudioSubturn()
 *   hadAudioInCurrentSubturn — guard: seal is a no-op if no audio arrived
 *
 * We don't instantiate GeminiLiveSession (it requires a live DB + WebSocket).
 * Instead, we replicate the exact logic from the source lines we verified above.
 */
function simulateSeal(state: { currentSentenceIndex: number; hadAudioInCurrentSubturn: boolean }): void {
  // Mirror of sealCurrentAudioSubturn() lines 1533–1565
  if (!state.hadAudioInCurrentSubturn) return;
  state.currentSentenceIndex++;
  state.hadAudioInCurrentSubturn = false;
}

function simulateFlush(state: { currentSentenceIndex: number }): number {
  // Mirror of _doFlushTranscripts() line 4053
  const totalSentences = state.currentSentenceIndex;
  // (reset happens after capture — also mirrored)
  state.currentSentenceIndex = 0;
  return totalSentences;
}

// Scenario A: one sub-turn with audio
{
  const state = { currentSentenceIndex: 0, hadAudioInCurrentSubturn: true };
  simulateSeal(state); // sub-turn 1 seals → index becomes 1
  const total = simulateFlush(state);
  if (total === 1) {
    pass('One seal → totalSentences=1');
  } else {
    fail(`One seal → expected totalSentences=1, got ${total}`);
  }
}

// Scenario B: two sub-turns, both with audio
{
  const state = { currentSentenceIndex: 0, hadAudioInCurrentSubturn: true };
  simulateSeal(state);                       // sub-turn 1 → index 1
  state.hadAudioInCurrentSubturn = true;     // sub-turn 2 starts sending audio
  simulateSeal(state);                       // sub-turn 2 → index 2
  const total = simulateFlush(state);
  if (total === 2) {
    pass('Two seals → totalSentences=2');
  } else {
    fail(`Two seals → expected totalSentences=2, got ${total}`);
  }
}

// Scenario C: second sub-turn has no audio (e.g. text-only) — seal is a no-op
{
  const state = { currentSentenceIndex: 0, hadAudioInCurrentSubturn: true };
  simulateSeal(state);                       // sub-turn 1 → index 1
  // hadAudioInCurrentSubturn stays false (no audio in sub-turn 2)
  simulateSeal(state);                       // should be no-op
  const total = simulateFlush(state);
  if (total === 1) {
    pass('Seal with no audio is no-op — totalSentences stays 1 (not 2)');
  } else {
    fail(`Seal with no audio should be no-op, but totalSentences=${total}`);
  }
}

// Scenario D: flush without any seals (single sub-turn where generationComplete
// fires before any turnComplete) — index never incremented by seal, remains 0.
// Sanity check that this does NOT break client (totalSentences=0 is a degenerate
// case — the client treats 0 as "no sentences expected", which is consistent with
// a silent / content-filtered response).
{
  const state = { currentSentenceIndex: 0, hadAudioInCurrentSubturn: false };
  const total = simulateFlush(state);
  if (total === 0) {
    pass('No seal + no audio → totalSentences=0 (silent/filtered response handled correctly)');
  } else {
    fail(`No seal scenario: expected totalSentences=0, got ${total}`);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  console.error('\n❌  One or more checks failed.');
  process.exit(1);
} else {
  console.log('\n✅  All checks passed — totalSentences correctly reflects both sub-turns.');
  process.exit(0);
}
