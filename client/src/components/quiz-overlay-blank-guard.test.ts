/**
 * Unit tests for the quiz overlay blank-render guard.
 *
 * Two guard layers exist in production:
 *
 *  Layer 1 — streamingVoiceClient.ts `quiz_presented` WS message handler
 *    Emits the `quizPresented` event without inspecting fields — the raw
 *    event is forwarded as-is, so this layer adds no filtering.
 *
 *  Layer 2 — StreamingVoiceChat.tsx `onQuizPresented` callback (~line 1248)
 *    Drops the event when question is not a non-empty string, options is not
 *    a non-empty string array with all non-empty strings, or correctIndex is
 *    not a valid integer index.  Calls toast() and returns without calling
 *    setActiveQuiz().
 *
 *  Layer 3 — StreamingVoiceChat.tsx JSX render guard (~line 4257)
 *    Defence-in-depth: even if activeQuiz were somehow set with malformed
 *    data, the overlay won't mount.  Checks:
 *      typeof question === 'string' && question.trim().length > 0 &&
 *      Array.isArray(options) && options.length > 0
 *
 * Both layers are tested here using extracted standalone functions that
 * mirror the production logic verbatim.  If the production guard changes,
 * update the mirror below to match.
 *
 * Run with:
 *   npx tsx --test client/src/components/quiz-overlay-blank-guard.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface QuizData {
  id?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  timestamp?: number;
}

// ---------------------------------------------------------------------------
// Mirror of Layer 2 — StreamingVoiceChat.tsx onQuizPresented callback
// Verbatim port of the guard (lines 1248-1258).
// ---------------------------------------------------------------------------

/**
 * Mirrors the component-level guard in StreamingVoiceChat.tsx.
 *
 * @returns 'set'   when setActiveQuiz would be called (valid payload)
 * @returns 'toast' when the toast fires and activeQuiz is NOT updated
 */
function componentGuard(
  data: any,
  toast: (opts: { title: string; description: string; variant: string }) => void,
  setActiveQuiz: (d: QuizData & { selectedIndex: undefined; showResult: false }) => void,
): 'set' | 'toast' {
  if (
    typeof data.question !== 'string' || !data.question.trim() ||
    !Array.isArray(data.options) || data.options.length === 0 ||
    !data.options.every((o: unknown) => typeof o === 'string' && (o as string).trim().length > 0) ||
    typeof data.correctIndex !== 'number' || !Number.isInteger(data.correctIndex) ||
    data.correctIndex < 0 || data.correctIndex >= data.options.length
  ) {
    toast({
      title: 'Quiz unavailable',
      description: 'Daniela sent an incomplete quiz — skipping.',
      variant: 'destructive',
    });
    return 'toast';
  }
  setActiveQuiz({ ...data, selectedIndex: undefined, showResult: false });
  return 'set';
}

// ---------------------------------------------------------------------------
// Mirror of Layer 3 — JSX render guard in StreamingVoiceChat.tsx (~line 4257)
// Verbatim port of the condition added to the {activeQuiz && ...} expression.
// ---------------------------------------------------------------------------

/**
 * Returns true when the overlay WOULD render (all guard conditions pass).
 * Returns false when the overlay is suppressed.
 */
function renderGuard(quiz: any): boolean {
  if (!quiz) return false;
  return (
    typeof quiz.question === 'string' &&
    quiz.question.trim().length > 0 &&
    Array.isArray(quiz.options) &&
    quiz.options.length > 0
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToastSpy() {
  const calls: Array<{ title: string; description: string; variant: string }> = [];
  return {
    calls,
    fn(opts: { title: string; description: string; variant: string }) {
      calls.push(opts);
    },
  };
}

function makeSetQuizSpy() {
  const calls: Array<QuizData & { selectedIndex: undefined; showResult: false }> = [];
  return {
    calls,
    fn(d: QuizData & { selectedIndex: undefined; showResult: false }) {
      calls.push(d);
    },
  };
}

const VALID_QUESTION = '¿Cómo se dice "cat" en español?';
const VALID_OPTIONS  = ['gato', 'perro', 'pájaro', 'pez'];

function validData(overrides: Partial<QuizData> = {}): QuizData {
  return {
    id: 'qz-test',
    question: VALID_QUESTION,
    options: VALID_OPTIONS,
    correctIndex: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — Layer 2: component callback guard (onQuizPresented)
// ---------------------------------------------------------------------------

describe('Layer 2 — StreamingVoiceChat component guard (onQuizPresented)', () => {

  let toastSpy: ReturnType<typeof makeToastSpy>;
  let setQuizSpy: ReturnType<typeof makeSetQuizSpy>;

  beforeEach(() => {
    toastSpy = makeToastSpy();
    setQuizSpy = makeSetQuizSpy();
  });

  // ── question rejections ──────────────────────────────────────────────────

  it('rejects when question is an empty string — toast fires, quiz NOT set', () => {
    const outcome = componentGuard(
      validData({ question: '' }),
      toastSpy.fn, setQuizSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setQuizSpy.calls.length, 0, 'setActiveQuiz() must NOT be called');
  });

  it('rejects when question is whitespace-only ("   ")', () => {
    const outcome = componentGuard(
      validData({ question: '   ' }),
      toastSpy.fn, setQuizSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when question is undefined', () => {
    const data = { ...validData(), question: undefined };
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when question is a number (non-string)', () => {
    const data = { ...validData(), question: 42 };
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  // ── options rejections ───────────────────────────────────────────────────

  it('rejects when options is an empty array', () => {
    const outcome = componentGuard(
      validData({ options: [] }),
      toastSpy.fn, setQuizSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when options is not an array (string)', () => {
    const data = { ...validData(), options: 'gato,perro' };
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when options is null', () => {
    const data = { ...validData(), options: null };
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when options contains a non-string element', () => {
    const data = { ...validData(), options: [42, 'valid'] };
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when options contains an empty string', () => {
    const data = { ...validData(), options: ['gato', ''] };
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when options contains a whitespace-only string', () => {
    const data = { ...validData(), options: ['gato', '   '] };
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  // ── correctIndex rejections ──────────────────────────────────────────────

  it('rejects when correctIndex is out of upper bound (=== options.length)', () => {
    const outcome = componentGuard(
      validData({ correctIndex: VALID_OPTIONS.length }),
      toastSpy.fn, setQuizSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when correctIndex is negative (-1)', () => {
    const outcome = componentGuard(
      validData({ correctIndex: -1 }),
      toastSpy.fn, setQuizSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when correctIndex is a float (0.5)', () => {
    const outcome = componentGuard(
      validData({ correctIndex: 0.5 }),
      toastSpy.fn, setQuizSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when correctIndex is a string ("0")', () => {
    const data = { ...validData(), correctIndex: '0' };
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  it('rejects when correctIndex is undefined', () => {
    const data = { ...validData(), correctIndex: undefined };
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);
  });

  // ── toast content ────────────────────────────────────────────────────────

  it('toast fires with title "Quiz unavailable" and variant "destructive"', () => {
    componentGuard(validData({ question: '' }), toastSpy.fn, setQuizSpy.fn);
    const call = toastSpy.calls[0];
    assert.equal(call.title, 'Quiz unavailable');
    assert.equal(call.variant, 'destructive');
  });

  it('toast description mentions incomplete quiz', () => {
    componentGuard(validData({ options: [] }), toastSpy.fn, setQuizSpy.fn);
    const call = toastSpy.calls[0];
    assert.ok(
      call.description.toLowerCase().includes('incomplete'),
      `Expected description to mention "incomplete", got: "${call.description}"`,
    );
  });

  // ── acceptance cases ─────────────────────────────────────────────────────

  it('accepts valid payload — setActiveQuiz called, no toast', () => {
    const data = validData({ correctIndex: 2 });
    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'toast() must NOT fire for valid data');
    assert.equal(setQuizSpy.calls.length, 1, 'setActiveQuiz() should be called once');
    assert.equal(setQuizSpy.calls[0].question, VALID_QUESTION);
    assert.deepEqual(setQuizSpy.calls[0].options, VALID_OPTIONS);
    assert.equal(setQuizSpy.calls[0].correctIndex, 2);
    assert.equal(setQuizSpy.calls[0].selectedIndex, undefined);
    assert.equal(setQuizSpy.calls[0].showResult, false);
  });

  it('accepts correctIndex === 0 (first option)', () => {
    const outcome = componentGuard(validData({ correctIndex: 0 }), toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'set');
    assert.equal(setQuizSpy.calls[0].correctIndex, 0);
  });

  it('accepts correctIndex === options.length - 1 (last option)', () => {
    const outcome = componentGuard(
      validData({ correctIndex: VALID_OPTIONS.length - 1 }),
      toastSpy.fn, setQuizSpy.fn,
    );
    assert.equal(outcome, 'set');
    assert.equal(setQuizSpy.calls[0].correctIndex, VALID_OPTIONS.length - 1);
  });
});

// ---------------------------------------------------------------------------
// Tests — Layer 3: JSX render guard
// ---------------------------------------------------------------------------

describe('Layer 3 — JSX render guard (blank-overlay prevention)', () => {

  // ── suppression cases ────────────────────────────────────────────────────

  it('suppresses render when quiz is null', () => {
    assert.equal(renderGuard(null), false, 'Overlay must not mount when quiz is null');
  });

  it('suppresses render when question is an empty string', () => {
    const quiz = { question: '', options: VALID_OPTIONS, correctIndex: 0 };
    assert.equal(renderGuard(quiz), false, 'Overlay must not mount with empty question');
  });

  it('suppresses render when question is whitespace-only', () => {
    const quiz = { question: '   ', options: VALID_OPTIONS, correctIndex: 0 };
    assert.equal(renderGuard(quiz), false, 'Overlay must not mount with whitespace-only question');
  });

  it('suppresses render when question is undefined', () => {
    const quiz = { question: undefined, options: VALID_OPTIONS, correctIndex: 0 };
    assert.equal(renderGuard(quiz), false);
  });

  it('suppresses render when question is a number', () => {
    const quiz = { question: 42, options: VALID_OPTIONS, correctIndex: 0 };
    assert.equal(renderGuard(quiz), false);
  });

  it('suppresses render when options is an empty array', () => {
    const quiz = { question: VALID_QUESTION, options: [], correctIndex: 0 };
    assert.equal(renderGuard(quiz), false, 'Overlay must not mount with empty options');
  });

  it('suppresses render when options is not an array (string)', () => {
    const quiz = { question: VALID_QUESTION, options: 'gato,perro', correctIndex: 0 };
    assert.equal(renderGuard(quiz), false);
  });

  it('suppresses render when options is null', () => {
    const quiz = { question: VALID_QUESTION, options: null, correctIndex: 0 };
    assert.equal(renderGuard(quiz), false);
  });

  it('suppresses render when options is undefined', () => {
    const quiz = { question: VALID_QUESTION, options: undefined, correctIndex: 0 };
    assert.equal(renderGuard(quiz), false);
  });

  // ── render-allowed cases ─────────────────────────────────────────────────

  it('allows render for a fully valid quiz', () => {
    const quiz = { question: VALID_QUESTION, options: VALID_OPTIONS, correctIndex: 0 };
    assert.equal(renderGuard(quiz), true, 'Overlay SHOULD mount for a valid quiz');
  });

  it('allows render when question has surrounding whitespace around real content', () => {
    // trim() is only used to detect ALL-whitespace; padding around real text is valid
    const quiz = { question: '  ¿Cómo se dice "cat"?  ', options: VALID_OPTIONS, correctIndex: 1 };
    assert.equal(renderGuard(quiz), true, 'Surrounding whitespace around real content should pass');
  });

  it('allows render with a two-option quiz', () => {
    const quiz = { question: 'True or false?', options: ['True', 'False'], correctIndex: 1 };
    assert.equal(renderGuard(quiz), true);
  });
});

// ---------------------------------------------------------------------------
// Tests — both layers in sequence (end-to-end guard chain)
// ---------------------------------------------------------------------------

describe('End-to-end guard chain (component callback → render guard)', () => {

  it('empty question is blocked at Layer 2 before it can reach Layer 3', () => {
    const toastSpy = makeToastSpy();
    const setQuizSpy = makeSetQuizSpy();

    const outcome = componentGuard(
      validData({ question: '' }),
      toastSpy.fn, setQuizSpy.fn,
    );
    // Layer 2 fired toast and returned 'toast' — setActiveQuiz never called
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0, 'setActiveQuiz must NOT be called');

    // Layer 3 would also suppress it, but it never receives the data
    const wouldRender = renderGuard({ question: '', options: VALID_OPTIONS, correctIndex: 0 });
    assert.equal(wouldRender, false, 'Layer 3 would also catch it as a safety net');
  });

  it('empty options array is blocked at Layer 2 before it can reach Layer 3', () => {
    const toastSpy = makeToastSpy();
    const setQuizSpy = makeSetQuizSpy();

    const outcome = componentGuard(
      validData({ options: [] }),
      toastSpy.fn, setQuizSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(setQuizSpy.calls.length, 0);

    // Layer 3 also suppresses empty options
    const wouldRender = renderGuard({ question: VALID_QUESTION, options: [], correctIndex: 0 });
    assert.equal(wouldRender, false, 'Layer 3 also catches empty options');
  });

  it('valid data passes Layer 2 AND Layer 3 renders the overlay', () => {
    const toastSpy = makeToastSpy();
    const setQuizSpy = makeSetQuizSpy();
    const data = validData({ correctIndex: 1 });

    const outcome = componentGuard(data, toastSpy.fn, setQuizSpy.fn);
    assert.equal(outcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'No toast for valid data');
    assert.equal(setQuizSpy.calls.length, 1, 'setActiveQuiz called once');

    // The state that setActiveQuiz would write should also pass Layer 3
    const activeQuiz = setQuizSpy.calls[0];
    assert.equal(renderGuard(activeQuiz), true, 'Layer 3 must allow render for valid data');
  });
});
