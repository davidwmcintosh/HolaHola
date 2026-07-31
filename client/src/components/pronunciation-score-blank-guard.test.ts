/**
 * Unit tests for the pronunciation score card blank-render guard.
 *
 * Two guard layers exist in production:
 *
 *  Layer 1 — useStreamingVoice.ts `handlePronunciationScoreShown` (~line 1544)
 *    Drops the message before the callback fires when phrase is missing/whitespace-only,
 *    wordScores is missing/empty, or overallScore is not a number.
 *
 *  Layer 2 — StreamingVoiceChat.tsx `onPronunciationScoreShown` (~line 1225)
 *    Secondary guard: if malformed data somehow reaches the component callback,
 *    it calls toast() and returns early without calling setPronunciationScore.
 *
 * Both layers are tested here using extracted standalone functions that mirror
 * the production logic verbatim.  If either guard changes, update the mirror
 * below to match.
 *
 * Run with:
 *   npx tsx --test client/src/components/pronunciation-score-blank-guard.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WordScore {
  word: string;
  score: number;
  tip?: string;
}

interface PronunciationScoreData {
  id?: string;
  phrase: string;
  wordScores: WordScore[];
  overallScore: number;
  encouragement?: string;
  timestamp?: number;
}

// ---------------------------------------------------------------------------
// Mirror of Layer 1 — useStreamingVoice.ts handlePronunciationScoreShown
// Verbatim port of the guard logic.
// ---------------------------------------------------------------------------

/**
 * Mirrors the hook-level guard in useStreamingVoice.ts.
 * Returns the data object when valid, or null when the message is rejected.
 * Whitespace-only encouragement is stripped (set to undefined) rather than
 * causing a card drop, since encouragement is optional.
 */
function hookGuard(
  message: { type: string; timestamp: number; data: any },
): PronunciationScoreData | null {
  if (!message.data) return null;
  let d = message.data;
  if (
    typeof d.phrase !== 'string' || !d.phrase.trim() ||
    !Array.isArray(d.wordScores) || d.wordScores.length === 0 ||
    typeof d.overallScore !== 'number'
  ) {
    return null; // malformed — drop
  }
  // Sanitize optional encouragement
  if (typeof d.encouragement === 'string' && !d.encouragement.trim()) {
    d = { ...d, encouragement: undefined };
  }
  return d as PronunciationScoreData;
}

// ---------------------------------------------------------------------------
// Mirror of Layer 2 — StreamingVoiceChat.tsx onPronunciationScoreShown callback
// Verbatim port of the guard logic.
// ---------------------------------------------------------------------------

/**
 * Mirrors the component-level guard in StreamingVoiceChat.tsx.
 *
 * @returns 'set'   when setPronunciationScore would be called
 * @returns 'toast' when the toast fires and the card is NOT set
 */
function componentGuard(
  data: any,
  toast: (opts: { title: string; description: string; variant: string }) => void,
  setPronunciationScore: (d: PronunciationScoreData) => void,
): 'set' | 'toast' {
  if (
    !data ||
    typeof data.phrase !== 'string' || !data.phrase.trim() ||
    !Array.isArray(data.wordScores) || data.wordScores.length === 0 ||
    typeof data.overallScore !== 'number'
  ) {
    toast({
      title: 'Pronunciation feedback is temporarily unavailable',
      description: 'Scoring data could not be displayed right now.',
      variant: 'destructive',
    });
    return 'toast';
  }
  // Sanitize optional encouragement
  const sanitizedData = (typeof data.encouragement === 'string' && !data.encouragement.trim())
    ? { ...data, encouragement: undefined }
    : data;
  setPronunciationScore(sanitizedData as PronunciationScoreData);
  return 'set';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToastSpy(): {
  calls: Array<{ title: string; description: string; variant: string }>;
  fn: (opts: { title: string; description: string; variant: string }) => void;
} {
  const calls: Array<{ title: string; description: string; variant: string }> = [];
  return {
    calls,
    fn(opts) { calls.push(opts); },
  };
}

function makeSetScoreSpy(): {
  calls: PronunciationScoreData[];
  fn: (d: PronunciationScoreData) => void;
} {
  const calls: PronunciationScoreData[] = [];
  return {
    calls,
    fn(d) { calls.push(d); },
  };
}

function validData(overrides: Partial<PronunciationScoreData> = {}): PronunciationScoreData {
  return {
    id: 'ps-1',
    phrase: 'Buenos días',
    wordScores: [
      { word: 'Buenos', score: 92 },
      { word: 'días', score: 78, tip: 'Stress the accent' },
    ],
    overallScore: 85,
    encouragement: 'Great job!',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — Layer 1 (hook guard)
// ---------------------------------------------------------------------------

describe('Layer 1 — useStreamingVoice hook guard (handlePronunciationScoreShown)', () => {

  // ── Rejection cases ────────────────────────────────────────────────────

  it('rejects when phrase is whitespace-only ("   ")', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: '   ', wordScores: [{ word: 'hola', score: 80 }], overallScore: 80 },
    });
    assert.equal(result, null, 'Expected null for whitespace-only phrase');
  });

  it('rejects when phrase is an empty string', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: '', wordScores: [{ word: 'hola', score: 80 }], overallScore: 80 },
    });
    assert.equal(result, null, 'Expected null for empty phrase');
  });

  it('rejects when phrase is missing (undefined)', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { wordScores: [{ word: 'hola', score: 80 }], overallScore: 80 } as any,
    });
    assert.equal(result, null, 'Expected null for missing phrase');
  });

  it('rejects when phrase is a non-string type (number)', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: 42 as any, wordScores: [{ word: 'hola', score: 80 }], overallScore: 80 },
    });
    assert.equal(result, null, 'Expected null for non-string phrase');
  });

  it('rejects when wordScores is an empty array', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: 'Buenos días', wordScores: [], overallScore: 80 },
    });
    assert.equal(result, null, 'Expected null for empty wordScores array');
  });

  it('rejects when wordScores is missing (undefined)', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: 'Buenos días', overallScore: 80 } as any,
    });
    assert.equal(result, null, 'Expected null for missing wordScores');
  });

  it('rejects when wordScores is not an array (object)', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: 'Buenos días', wordScores: {} as any, overallScore: 80 },
    });
    assert.equal(result, null, 'Expected null for non-array wordScores');
  });

  it('rejects when overallScore is missing', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: 'Buenos días', wordScores: [{ word: 'hola', score: 80 }] } as any,
    });
    assert.equal(result, null, 'Expected null for missing overallScore');
  });

  it('rejects when overallScore is a string instead of number', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: 'Buenos días', wordScores: [{ word: 'hola', score: 80 }], overallScore: '80' as any },
    });
    assert.equal(result, null, 'Expected null for string overallScore');
  });

  it('rejects when data is null', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: null as any,
    });
    assert.equal(result, null, 'Expected null for null data');
  });

  // ── Acceptance cases ────────────────────────────────────────────────────

  it('accepts valid phrase, wordScores, and overallScore', () => {
    const data = validData();
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.phrase, 'Buenos días');
    assert.equal(result!.wordScores.length, 2);
    assert.equal(result!.overallScore, 85);
  });

  it('accepts phrase with surrounding whitespace around real content', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: '  Buenos días  ', wordScores: [{ word: 'Buenos', score: 90 }], overallScore: 90 },
    });
    assert.ok(result !== null, 'Phrase with surrounding spaces around content should pass');
  });

  it('accepts data with optional fields (encouragement, id, timestamp)', () => {
    const data = validData({ encouragement: '¡Excelente!', id: 'ps-99' });
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.encouragement, '¡Excelente!');
  });

  it('strips whitespace-only encouragement so the card does not render a blank section', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: 'Buenos días', wordScores: [{ word: 'Buenos', score: 90 }], overallScore: 90, encouragement: '   ' },
    });
    assert.ok(result !== null, 'Card should still be shown');
    assert.equal(result!.encouragement, undefined, 'Whitespace-only encouragement must be stripped');
  });

  it('keeps valid encouragement string unchanged', () => {
    const result = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: 'Buenos días', wordScores: [{ word: 'Buenos', score: 90 }], overallScore: 90, encouragement: '¡Muy bien!' },
    });
    assert.ok(result !== null);
    assert.equal(result!.encouragement, '¡Muy bien!');
  });
});

// ---------------------------------------------------------------------------
// Tests — Layer 2 (component callback guard)
// ---------------------------------------------------------------------------

describe('Layer 2 — StreamingVoiceChat component guard (onPronunciationScoreShown)', () => {

  let toastSpy: ReturnType<typeof makeToastSpy>;
  let setScoreSpy: ReturnType<typeof makeSetScoreSpy>;

  beforeEach(() => {
    toastSpy = makeToastSpy();
    setScoreSpy = makeSetScoreSpy();
  });

  // ── Rejection cases ────────────────────────────────────────────────────

  it('calls toast and does NOT set card when phrase is whitespace-only', () => {
    const outcome = componentGuard(
      { phrase: '   ', wordScores: [{ word: 'hola', score: 80 }], overallScore: 80 },
      toastSpy.fn,
      setScoreSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setScoreSpy.calls.length, 0, 'setPronunciationScore() must NOT be called');
  });

  it('calls toast and does NOT set card when phrase is empty string', () => {
    const outcome = componentGuard(
      { phrase: '', wordScores: [{ word: 'hola', score: 80 }], overallScore: 80 },
      toastSpy.fn,
      setScoreSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setScoreSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when wordScores is empty array', () => {
    const outcome = componentGuard(
      { phrase: 'Buenos días', wordScores: [], overallScore: 80 },
      toastSpy.fn,
      setScoreSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setScoreSpy.calls.length, 0, 'setPronunciationScore() must NOT be called');
  });

  it('calls toast and does NOT set card when wordScores is missing', () => {
    const outcome = componentGuard(
      { phrase: 'Buenos días', overallScore: 80 } as any,
      toastSpy.fn,
      setScoreSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setScoreSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when data is null', () => {
    const outcome = componentGuard(
      null,
      toastSpy.fn,
      setScoreSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setScoreSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when overallScore is missing', () => {
    const outcome = componentGuard(
      { phrase: 'Buenos días', wordScores: [{ word: 'Buenos', score: 90 }] } as any,
      toastSpy.fn,
      setScoreSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setScoreSpy.calls.length, 0);
  });

  it('toast fires with the correct title and variant', () => {
    componentGuard(
      { phrase: '   ', wordScores: [{ word: 'hola', score: 80 }], overallScore: 80 },
      toastSpy.fn,
      setScoreSpy.fn,
    );
    const call = toastSpy.calls[0];
    assert.equal(call.title, 'Pronunciation feedback is temporarily unavailable');
    assert.equal(call.variant, 'destructive');
  });

  // ── Acceptance cases ────────────────────────────────────────────────────

  it('calls setPronunciationScore and does NOT call toast for valid data', () => {
    const data = validData();
    const outcome = componentGuard(data, toastSpy.fn, setScoreSpy.fn);
    assert.equal(outcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'toast() must NOT fire for valid data');
    assert.equal(setScoreSpy.calls.length, 1, 'setPronunciationScore() should be called once');
    assert.deepEqual(setScoreSpy.calls[0], data);
  });

  it('passes the full data object (including optional fields) to setPronunciationScore', () => {
    const data = validData({ encouragement: 'Keep it up!', id: 'ps-42' });
    componentGuard(data, toastSpy.fn, setScoreSpy.fn);
    assert.deepEqual(setScoreSpy.calls[0], data);
  });

  it('strips whitespace-only encouragement before calling setPronunciationScore', () => {
    const data = validData({ encouragement: '\t  \n' });
    const outcome = componentGuard(data, toastSpy.fn, setScoreSpy.fn);
    assert.equal(outcome, 'set', 'Card should still be shown');
    assert.equal(toastSpy.calls.length, 0, 'No toast for this case');
    assert.equal(setScoreSpy.calls[0].encouragement, undefined, 'Whitespace-only encouragement must be stripped');
  });

  it('keeps a valid encouragement string unchanged', () => {
    const data = validData({ encouragement: '¡Buen trabajo!' });
    componentGuard(data, toastSpy.fn, setScoreSpy.fn);
    assert.equal(setScoreSpy.calls[0].encouragement, '¡Buen trabajo!');
  });
});

// ---------------------------------------------------------------------------
// Tests — both layers in sequence (end-to-end guard chain)
// ---------------------------------------------------------------------------

describe('End-to-end guard chain (hook → component callback)', () => {

  it('whitespace-only phrase is rejected at Layer 1 before reaching Layer 2', () => {
    const hookResult = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: '   ', wordScores: [{ word: 'hola', score: 80 }], overallScore: 80 },
    });
    assert.equal(hookResult, null, 'Layer 1 must stop whitespace-only phrase');
  });

  it('empty wordScores is rejected at Layer 1 before reaching Layer 2', () => {
    const hookResult = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data: { phrase: 'Buenos días', wordScores: [], overallScore: 80 },
    });
    assert.equal(hookResult, null, 'Layer 1 must stop empty wordScores array');
  });

  it('valid data passes Layer 1 AND is accepted by Layer 2', () => {
    const data = validData();
    const hookResult = hookGuard({
      type: 'pronunciation_score_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(hookResult !== null, 'Layer 1 should pass valid data');

    const toastSpy = makeToastSpy();
    const setScoreSpy = makeSetScoreSpy();
    const outcome = componentGuard(hookResult!, toastSpy.fn, setScoreSpy.fn);

    assert.equal(outcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'No toast for valid data');
    assert.equal(setScoreSpy.calls.length, 1, 'setPronunciationScore called once');
  });
});
