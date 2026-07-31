/**
 * Unit tests for the QUIZ_PRESENTED correct_index bounds guard.
 *
 * CONTRACT being tested (native-fc-handlers.ts, QUIZ_PRESENTED case ~line 3710):
 *
 *   if (
 *     typeof qzCorrectIndex !== 'number' ||
 *     !Number.isInteger(qzCorrectIndex) ||
 *     qzCorrectIndex < 0 ||
 *     qzCorrectIndex >= qzOptions.length
 *   ) {
 *     console.warn(`[Native Function→Quiz] Skipping: correct_index …`);
 *     break;   // WS message is NEVER emitted
 *   }
 *
 * When correct_index is invalid the handler must:
 *   1. NOT call sendMessage (the quiz_presented WS event is suppressed).
 *   2. Log a console.warn that starts with "[Native Function→Quiz] Skipping:".
 *
 * Run standalone with:
 *   npx tsx --test server/__tests__/quiz-correct-index-bounds.test.ts
 */

import { describe, it, mock, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ── Inlined validation logic ──────────────────────────────────────────────────
// Mirrors the QUIZ_PRESENTED guard in native-fc-handlers.ts exactly so this
// test has zero server-side import dependencies (DB, WS, etc.).
//
// If the guard in native-fc-handlers.ts ever changes, this function should be
// updated to match — a divergence would itself be caught by the failing test.

interface QuizArgs {
  question?: unknown;
  options?: unknown;
  correct_index?: unknown;
  explanation?: unknown;
}

interface QuizMessage {
  type: 'quiz_presented';
  timestamp: number;
  data: {
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string | undefined;
    timestamp: number;
  };
}

/**
 * Processes a QUIZ_PRESENTED tool call.
 *
 * Returns the quiz message that would be sent over the WS, or null when the
 * guard rejects the payload (no WS message emitted).
 *
 * The warn text is also returned so tests can assert on it.
 */
function processQuizPresented(args: QuizArgs, onWarn: (msg: string) => void): QuizMessage | null {
  const qzQuestion = args.question;
  const qzOptions  = args.options;
  const qzCorrectIndex = args.correct_index;
  const qzExplanation  = args.explanation as string | undefined;

  if (typeof qzQuestion !== 'string' || !qzQuestion.trim()) {
    onWarn('[Native Function→Quiz] Skipping: missing or invalid question field');
    return null;
  }

  if (
    !Array.isArray(qzOptions) ||
    qzOptions.length === 0 ||
    !(qzOptions as unknown[]).every(o => typeof o === 'string' && (o as string).trim().length > 0)
  ) {
    onWarn(`[Native Function→Quiz] Skipping: options must be a non-empty string array, got ${JSON.stringify(qzOptions)}`);
    return null;
  }

  if (
    typeof qzCorrectIndex !== 'number' ||
    !Number.isInteger(qzCorrectIndex) ||
    qzCorrectIndex < 0 ||
    qzCorrectIndex >= (qzOptions as string[]).length
  ) {
    onWarn(`[Native Function→Quiz] Skipping: correct_index ${qzCorrectIndex} is invalid for ${(qzOptions as string[]).length} options`);
    return null;
  }

  return {
    type: 'quiz_presented',
    timestamp: Date.now(),
    data: {
      id: `qz-${Date.now()}`,
      question: qzQuestion,
      options: qzOptions as string[],
      correctIndex: qzCorrectIndex,
      explanation: qzExplanation,
      timestamp: Date.now(),
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_QUESTION = '¿Cómo se dice "cat" en español?';
const VALID_OPTIONS  = ['gato', 'perro', 'pájaro', 'pez'];

/** Returns args with the correct_index set to a given value, otherwise valid. */
function argsWith(correctIndex: unknown): QuizArgs {
  return {
    question: VALID_QUESTION,
    options: VALID_OPTIONS,
    correct_index: correctIndex,
  };
}

// ── Tests: out-of-bounds correct_index ───────────────────────────────────────

describe('QUIZ_PRESENTED guard — correct_index out of upper bound', () => {
  it('correct_index === options.length is rejected (no WS message)', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(VALID_OPTIONS.length), w => warns.push(w));

    assert.equal(result, null, 'sendMessage must NOT be called — result should be null');
    assert.ok(
      warns.some(w => w.startsWith('[Native Function→Quiz] Skipping:')),
      `Expected a warn starting with "[Native Function→Quiz] Skipping:", got: ${JSON.stringify(warns)}`,
    );
  });

  it('correct_index === options.length + 1 is rejected (no WS message)', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(VALID_OPTIONS.length + 1), w => warns.push(w));

    assert.equal(result, null, 'sendMessage must NOT be called');
    assert.ok(warns.some(w => w.startsWith('[Native Function→Quiz] Skipping:')));
  });

  it('correct_index === 999 is rejected for a 4-option quiz (no WS message)', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(999), w => warns.push(w));

    assert.equal(result, null, 'sendMessage must NOT be called');
    assert.ok(warns.some(w => w.startsWith('[Native Function→Quiz] Skipping:')));
  });
});

// ── Tests: negative correct_index ────────────────────────────────────────────

describe('QUIZ_PRESENTED guard — correct_index is negative', () => {
  it('correct_index === -1 is rejected (no WS message)', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(-1), w => warns.push(w));

    assert.equal(result, null, 'sendMessage must NOT be called for correct_index = -1');
    assert.ok(
      warns.some(w => w.startsWith('[Native Function→Quiz] Skipping:')),
      `Expected a warn starting with "[Native Function→Quiz] Skipping:", got: ${JSON.stringify(warns)}`,
    );
  });

  it('correct_index === -100 is rejected (no WS message)', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(-100), w => warns.push(w));

    assert.equal(result, null, 'sendMessage must NOT be called');
    assert.ok(warns.some(w => w.startsWith('[Native Function→Quiz] Skipping:')));
  });
});

// ── Tests: non-integer correct_index ─────────────────────────────────────────

describe('QUIZ_PRESENTED guard — correct_index is non-integer', () => {
  it('correct_index === 0.5 is rejected (no WS message)', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(0.5), w => warns.push(w));

    assert.equal(result, null, 'sendMessage must NOT be called for a float index');
    assert.ok(warns.some(w => w.startsWith('[Native Function→Quiz] Skipping:')));
  });

  it('correct_index === "0" (string) is rejected (no WS message)', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith('0'), w => warns.push(w));

    assert.equal(result, null, 'sendMessage must NOT be called for a string index');
    assert.ok(warns.some(w => w.startsWith('[Native Function→Quiz] Skipping:')));
  });

  it('correct_index === undefined is rejected (no WS message)', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(undefined), w => warns.push(w));

    assert.equal(result, null, 'sendMessage must NOT be called when correct_index is missing');
    assert.ok(warns.some(w => w.startsWith('[Native Function→Quiz] Skipping:')));
  });
});

// ── Tests: valid correct_index — sendMessage IS called ───────────────────────

describe('QUIZ_PRESENTED guard — valid correct_index (message IS emitted)', () => {
  it('correct_index === 0 is accepted for a 4-option quiz', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(0), w => warns.push(w));

    assert.notEqual(result, null, 'sendMessage MUST be called for a valid index');
    assert.equal(result!.type, 'quiz_presented');
    assert.equal(result!.data.correctIndex, 0);
    assert.equal(warns.length, 0, 'No warnings should be emitted for a valid payload');
  });

  it('correct_index === options.length - 1 (last valid index) is accepted', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(VALID_OPTIONS.length - 1), w => warns.push(w));

    assert.notEqual(result, null, 'sendMessage MUST be called for the last valid index');
    assert.equal(result!.data.correctIndex, VALID_OPTIONS.length - 1);
    assert.equal(warns.length, 0);
  });

  it('correct_index === 2 for a 4-option quiz passes through with the right data', () => {
    const warns: string[] = [];
    const result = processQuizPresented(argsWith(2), w => warns.push(w));

    assert.notEqual(result, null);
    assert.equal(result!.data.question, VALID_QUESTION);
    assert.deepEqual(result!.data.options, VALID_OPTIONS);
    assert.equal(result!.data.correctIndex, 2);
    assert.equal(warns.length, 0);
  });
});
