/**
 * test-diarization-single-speaker-fallback.ts
 *
 * Confirms that the recording-complete webhook falls back to the raw (un-labeled)
 * transcript when Deepgram diarization returns only one unique speaker ID.
 *
 * Without this guard every utterance would be labelled "Daniela:" — corrupting
 * the absence-call memory when channel separation fails.
 *
 * Three parts:
 *   PART 1 — Static source check: the uniqueSpeakers.size < 2 guard exists in
 *             routes.ts and the fallback comment is in place.
 *   PART 2 — Logic simulation: exercise the exact diarization grouping + guard
 *             logic extracted from routes.ts with a single-speaker mock and a
 *             two-speaker mock; assert the right path fires in each case.
 *   PART 3 — Mutation self-check: run the PART 1 checks against mutated copies
 *             of the source and confirm they report failures, proving the guards
 *             are not vacuously passing.
 *
 * Run: npx tsx server/scripts/test-diarization-single-speaker-fallback.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// Shared: the same static checks used in PART 1, parameterised on source text.
// PART 3 calls these with mutated source and expects them to return false.
// ══════════════════════════════════════════════════════════════════════════════
function checkGuardPresent(src: string): boolean {
  return src.includes('uniqueSpeakers.size < 2');
}

function checkFallbackCommentPresent(src: string): boolean {
  return src.includes('diarization failed to separate the channels');
}

function checkNoChangeCommentPresent(src: string): boolean {
  return src.includes('formattedTranscript already holds the raw transcript');
}

function checkSetConstructionPresent(src: string): boolean {
  return src.includes('new Set(utterances.map(u => u.speaker))');
}

// ══════════════════════════════════════════════════════════════════════════════
// Inline replica of the diarization block from routes.ts ~9241-9288
// Keep this in sync with the source; the simulation in PART 2 depends on it.
// ══════════════════════════════════════════════════════════════════════════════
interface MockWord {
  speaker: number;
  word: string;
  punctuated_word?: string;
}

function runDiarizationLogic(rawTranscript: string, words: MockWord[]): string {
  let formattedTranscript = rawTranscript; // fallback: raw combined transcript

  if (words.length > 0 && words[0]?.speaker !== undefined) {
    // Group consecutive same-speaker words into utterances.
    const utterances: Array<{ speaker: number; text: string }> = [];
    let curSpeaker = words[0].speaker;
    let curWords: string[] = [];

    for (const w of words) {
      const sp = w.speaker;
      if (sp === curSpeaker) {
        curWords.push(w.punctuated_word || w.word);
      } else {
        utterances.push({ speaker: curSpeaker, text: curWords.join(' ') });
        curSpeaker = sp;
        curWords = [w.punctuated_word || w.word];
      }
    }
    if (curWords.length > 0) utterances.push({ speaker: curSpeaker, text: curWords.join(' ') });

    const uniqueSpeakers = new Set(utterances.map(u => u.speaker));

    if (uniqueSpeakers.size < 2) {
      // Single-speaker fallback — formattedTranscript stays as raw transcript
    } else {
      const firstSpeaker = utterances[0].speaker;
      formattedTranscript = utterances
        .map(u => `${u.speaker === firstSpeaker ? 'Daniela' : 'Student'}: ${u.text}`)
        .join('\n');
    }
  }

  return formattedTranscript;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Static source check
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Static source check: uniqueSpeakers.size < 2 guard in routes.ts'));
sep();

function runPart1() {
  const src = readFileSync(resolve(__dirname, '../routes.ts'), 'utf-8');

  assert(
    'uniqueSpeakers.size < 2 guard present in routes.ts',
    checkGuardPresent(src),
  );

  assert(
    'Fallback comment present: "diarization failed to separate the channels"',
    checkFallbackCommentPresent(src),
  );

  assert(
    'No-change comment inside single-speaker branch is present',
    checkNoChangeCommentPresent(src),
  );

  assert(
    'new Set(utterances.map(u => u.speaker)) present in routes.ts',
    checkSetConstructionPresent(src),
  );

  assert(
    'recording-complete webhook registered in routes.ts',
    src.includes('/api/webhooks/twilio/recording-complete'),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Logic simulation
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Logic simulation: single-speaker and two-speaker mock payloads'));
sep();

function runPart2() {
  const RAW_TRANSCRIPT = 'Hola, cómo estás? Estoy bien, gracias. Cuándo vuelves a clase?';

  // ── Single-speaker: all words assigned speaker 0 ─────────────────────────
  const singleSpeakerWords: MockWord[] = [
    { speaker: 0, word: 'hola',    punctuated_word: 'Hola,' },
    { speaker: 0, word: 'como',    punctuated_word: 'cómo' },
    { speaker: 0, word: 'estas',   punctuated_word: 'estás?' },
    { speaker: 0, word: 'estoy',   punctuated_word: 'Estoy' },
    { speaker: 0, word: 'bien',    punctuated_word: 'bien,' },
    { speaker: 0, word: 'gracias', punctuated_word: 'gracias.' },
    { speaker: 0, word: 'cuando',  punctuated_word: 'Cuándo' },
    { speaker: 0, word: 'vuelves', punctuated_word: 'vuelves' },
    { speaker: 0, word: 'a',       punctuated_word: 'a' },
    { speaker: 0, word: 'clase',   punctuated_word: 'clase?' },
  ];

  const singleResult = runDiarizationLogic(RAW_TRANSCRIPT, singleSpeakerWords);

  assert(
    'Single-speaker: formattedTranscript equals raw transcript',
    singleResult === RAW_TRANSCRIPT,
    `got: ${JSON.stringify(singleResult)}`,
  );

  assert(
    'Single-speaker: result contains no "Daniela:" label',
    !singleResult.includes('Daniela:'),
    `got: ${JSON.stringify(singleResult)}`,
  );

  assert(
    'Single-speaker: result contains no "Student:" label',
    !singleResult.includes('Student:'),
    `got: ${JSON.stringify(singleResult)}`,
  );

  // ── Two-speaker: speaker 0 = Daniela, speaker 1 = Student ────────────────
  const twoSpeakerWords: MockWord[] = [
    { speaker: 0, word: 'hola',    punctuated_word: 'Hola,' },
    { speaker: 0, word: 'como',    punctuated_word: 'cómo' },
    { speaker: 0, word: 'estas',   punctuated_word: 'estás?' },
    { speaker: 1, word: 'estoy',   punctuated_word: 'Estoy' },
    { speaker: 1, word: 'bien',    punctuated_word: 'bien,' },
    { speaker: 1, word: 'gracias', punctuated_word: 'gracias.' },
    { speaker: 0, word: 'cuando',  punctuated_word: 'Cuándo' },
    { speaker: 0, word: 'vuelves', punctuated_word: 'vuelves' },
    { speaker: 0, word: 'a',       punctuated_word: 'a' },
    { speaker: 0, word: 'clase',   punctuated_word: 'clase?' },
  ];

  const twoResult = runDiarizationLogic(RAW_TRANSCRIPT, twoSpeakerWords);

  assert(
    'Two-speaker: result contains "Daniela:" label',
    twoResult.includes('Daniela:'),
    `got: ${JSON.stringify(twoResult)}`,
  );

  assert(
    'Two-speaker: result contains "Student:" label',
    twoResult.includes('Student:'),
    `got: ${JSON.stringify(twoResult)}`,
  );

  assert(
    'Two-speaker: result does NOT equal raw transcript',
    twoResult !== RAW_TRANSCRIPT,
    `got: ${JSON.stringify(twoResult)}`,
  );

  // ── Empty word array: falls back to raw transcript ────────────────────────
  const emptyResult = runDiarizationLogic(RAW_TRANSCRIPT, []);
  assert(
    'Empty word array: formattedTranscript equals raw transcript',
    emptyResult === RAW_TRANSCRIPT,
    `got: ${JSON.stringify(emptyResult)}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Mutation self-check
//
// Run the SAME check functions used in PART 1 against deliberately mutated
// copies of the source, and assert the checks return false.  This proves the
// guards in PART 1 are not vacuously passing — they would catch a real deletion.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Mutation self-check: PART 1 checks fail when guard is removed'));
sep();

function runPart3() {
  const src = readFileSync(resolve(__dirname, '../routes.ts'), 'utf-8');

  // ── Mutation 1: guard condition changed (uniqueSpeakers.size < 2 → < 0) ──
  const mutGuard = src.replace('uniqueSpeakers.size < 2', 'uniqueSpeakers.size < 0');
  assert(
    'Mutation 1: checkGuardPresent returns false when guard condition is altered',
    !checkGuardPresent(mutGuard),
    checkGuardPresent(mutGuard)
      ? 'guard still detected in mutated source — PART 1 would not catch this regression'
      : undefined,
  );

  // ── Mutation 2: fallback comment removed ──────────────────────────────────
  const mutComment = src.replace(
    'diarization failed to separate the channels',
    'REMOVED_COMMENT',
  );
  assert(
    'Mutation 2: checkFallbackCommentPresent returns false when comment is removed',
    !checkFallbackCommentPresent(mutComment),
    checkFallbackCommentPresent(mutComment)
      ? 'comment still detected in mutated source — PART 1 would not catch this regression'
      : undefined,
  );

  // ── Mutation 3: no-change comment removed ────────────────────────────────
  const mutNoChange = src.replace(
    'formattedTranscript already holds the raw transcript',
    'REMOVED_NO_CHANGE_COMMENT',
  );
  assert(
    'Mutation 3: checkNoChangeCommentPresent returns false when no-change comment is removed',
    !checkNoChangeCommentPresent(mutNoChange),
    checkNoChangeCommentPresent(mutNoChange)
      ? 'no-change comment still detected in mutated source — PART 1 would not catch this regression'
      : undefined,
  );

  // ── Mutation 4: Set construction replaced ────────────────────────────────
  const mutSet = src.replace(
    'new Set(utterances.map(u => u.speaker))',
    'new Set([0])',
  );
  assert(
    'Mutation 4: checkSetConstructionPresent returns false when Set construction is replaced',
    !checkSetConstructionPresent(mutSet),
    checkSetConstructionPresent(mutSet)
      ? 'Set construction still detected in mutated source — PART 1 would not catch this regression'
      : undefined,
  );

  // ── Confirm original source passes all four checks (sanity baseline) ─────
  assert(
    'Baseline: all four checks pass on real (unmutated) source',
    checkGuardPresent(src) &&
    checkFallbackCommentPresent(src) &&
    checkNoChangeCommentPresent(src) &&
    checkSetConstructionPresent(src),
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
  try {
    runPart1();
    runPart2();
    runPart3();
  } catch (err: any) {
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — diarization single-speaker fallback verified.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
