/**
 * Unit tests for the grammar correction card blank-render guard.
 *
 * Two guard layers exist in production:
 *
 *  Layer 1 — useStreamingVoice.ts `handleGrammarFlagShown` (~line 1562)
 *    Drops the message before the callback fires when original, corrected, or
 *    explanation is missing or whitespace-only.
 *
 *  Layer 2 — StreamingVoiceChat.tsx `onGrammarFlagShown` (~line 1248)
 *    Secondary guard: if a whitespace-only value somehow reaches the component
 *    callback, it calls toast() and returns early without calling setGrammarFlag.
 *
 * Both layers are tested here using extracted standalone functions that mirror
 * the production logic verbatim.  If either guard changes, update the mirror
 * below to match.
 *
 * Run with:
 *   npx tsx --test client/src/components/grammar-correction-blank-guard.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrammarFlagData {
  id?: string;
  original: string;
  corrected: string;
  explanation: string;
  ruleLabel?: string;
  timestamp?: number;
}

// ---------------------------------------------------------------------------
// Mirror of Layer 1 — useStreamingVoice.ts handleGrammarFlagShown
// Verbatim port of the guard logic.
// ---------------------------------------------------------------------------

/**
 * Mirrors the hook-level guard in useStreamingVoice.ts.
 * Returns the data object when valid, or null when the message is rejected.
 */
function hookGuard(
  message: { type: string; timestamp: number; data: any },
): GrammarFlagData | null {
  if (!message.data) return null;
  const d = message.data;
  if (!d.original || typeof d.original !== 'string' || !d.original.trim() ||
      !d.corrected || typeof d.corrected !== 'string' || !d.corrected.trim() ||
      !d.explanation || typeof d.explanation !== 'string' || !d.explanation.trim()) {
    return null; // malformed — drop
  }
  return d as GrammarFlagData;
}

// ---------------------------------------------------------------------------
// Mirror of Layer 2 — StreamingVoiceChat.tsx onGrammarFlagShown callback
// Verbatim port of the guard logic.
// ---------------------------------------------------------------------------

/**
 * Mirrors the component-level guard in StreamingVoiceChat.tsx.
 *
 * @returns 'set'   when setGrammarFlag would be called
 * @returns 'toast' when the toast fires and the card is NOT set
 */
function componentGuard(
  data: GrammarFlagData,
  toast: (opts: { title: string; description: string; variant: string }) => void,
  setGrammarFlag: (d: GrammarFlagData) => void,
): 'set' | 'toast' {
  if (!data.original || !data.original.trim() || !data.corrected || !data.corrected.trim() || !data.explanation || !data.explanation.trim()) {
    toast({
      title: 'Grammar correction unavailable',
      description: 'Daniela sent an incomplete grammar correction card — skipping.',
      variant: 'destructive',
    });
    return 'toast';
  }
  setGrammarFlag(data);
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

function makeSetFlagSpy(): {
  calls: GrammarFlagData[];
  fn: (d: GrammarFlagData) => void;
} {
  const calls: GrammarFlagData[] = [];
  return {
    calls,
    fn(d) { calls.push(d); },
  };
}

function validData(overrides: Partial<GrammarFlagData> = {}): GrammarFlagData {
  return {
    id: 'gf-1',
    original: 'yo soy estudiante',
    corrected: 'yo soy un estudiante',
    explanation: 'Use the indefinite article "un" before a profession or role.',
    ruleLabel: 'Articles',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests — Layer 1 (hook guard)
// ---------------------------------------------------------------------------

describe('Layer 1 — useStreamingVoice hook guard (handleGrammarFlagShown)', () => {

  // ── Rejection cases ────────────────────────────────────────────────────

  it('rejects when original is whitespace-only ("   ")', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: '   ', corrected: 'yo soy un estudiante', explanation: 'Use article.' },
    });
    assert.equal(result, null, 'Expected null for whitespace-only original');
  });

  it('rejects when corrected is whitespace-only ("\\t\\n")', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'yo soy estudiante', corrected: '\t\n', explanation: 'Use article.' },
    });
    assert.equal(result, null, 'Expected null for whitespace-only corrected');
  });

  it('rejects when explanation is whitespace-only ("  ")', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'yo soy estudiante', corrected: 'yo soy un estudiante', explanation: '  ' },
    });
    assert.equal(result, null, 'Expected null for whitespace-only explanation');
  });

  it('rejects when original is an empty string', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: '', corrected: 'yo soy un estudiante', explanation: 'Use article.' },
    });
    assert.equal(result, null, 'Expected null for empty original');
  });

  it('rejects when corrected is an empty string', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'yo soy estudiante', corrected: '', explanation: 'Use article.' },
    });
    assert.equal(result, null, 'Expected null for empty corrected');
  });

  it('rejects when explanation is an empty string', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'yo soy estudiante', corrected: 'yo soy un estudiante', explanation: '' },
    });
    assert.equal(result, null, 'Expected null for empty explanation');
  });

  it('rejects when original is missing (undefined)', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { corrected: 'yo soy un estudiante', explanation: 'Use article.' } as any,
    });
    assert.equal(result, null, 'Expected null for missing original');
  });

  it('rejects when corrected is missing (undefined)', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'yo soy estudiante', explanation: 'Use article.' } as any,
    });
    assert.equal(result, null, 'Expected null for missing corrected');
  });

  it('rejects when explanation is missing (undefined)', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'yo soy estudiante', corrected: 'yo soy un estudiante' } as any,
    });
    assert.equal(result, null, 'Expected null for missing explanation');
  });

  it('rejects when data is null', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: null as any,
    });
    assert.equal(result, null, 'Expected null for null data');
  });

  it('rejects when original is a non-string type (number)', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 42 as any, corrected: 'yo soy un estudiante', explanation: 'Use article.' },
    });
    assert.equal(result, null, 'Expected null for non-string original');
  });

  it('rejects when all three required fields are whitespace-only', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: '  ', corrected: '  ', explanation: '  ' },
    });
    assert.equal(result, null, 'Expected null for all whitespace-only fields');
  });

  // ── Acceptance cases ────────────────────────────────────────────────────

  it('accepts valid original, corrected, and explanation, returning the data object', () => {
    const data = validData();
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.original, 'yo soy estudiante');
    assert.equal(result!.corrected, 'yo soy un estudiante');
    assert.equal(result!.explanation, 'Use the indefinite article "un" before a profession or role.');
  });

  it('accepts data with optional fields (ruleLabel, id, timestamp)', () => {
    const data = validData({ ruleLabel: 'Articles', id: 'gf-99' });
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.ruleLabel, 'Articles');
  });

  it('accepts fields that have leading/trailing whitespace around real content', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: {
        original: '  yo soy estudiante  ',
        corrected: '  yo soy un estudiante  ',
        explanation: '  Use article.  ',
      },
    });
    assert.ok(result !== null, 'Fields with surrounding whitespace around real content should pass');
  });
});

// ---------------------------------------------------------------------------
// Tests — Layer 2 (component callback guard)
// ---------------------------------------------------------------------------

describe('Layer 2 — StreamingVoiceChat component guard (onGrammarFlagShown)', () => {

  let toastSpy: ReturnType<typeof makeToastSpy>;
  let setFlagSpy: ReturnType<typeof makeSetFlagSpy>;

  beforeEach(() => {
    toastSpy = makeToastSpy();
    setFlagSpy = makeSetFlagSpy();
  });

  // ── Rejection cases ────────────────────────────────────────────────────

  it('calls toast and does NOT set card when original is whitespace-only', () => {
    const outcome = componentGuard(
      { original: '   ', corrected: 'yo soy un estudiante', explanation: 'Use article.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setFlagSpy.calls.length, 0, 'setGrammarFlag() must NOT be called');
  });

  it('calls toast and does NOT set card when corrected is whitespace-only', () => {
    const outcome = componentGuard(
      { original: 'yo soy estudiante', corrected: '\n  \t', explanation: 'Use article.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setFlagSpy.calls.length, 0, 'setGrammarFlag() must NOT be called');
  });

  it('calls toast and does NOT set card when explanation is whitespace-only', () => {
    const outcome = componentGuard(
      { original: 'yo soy estudiante', corrected: 'yo soy un estudiante', explanation: '   ' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setFlagSpy.calls.length, 0, 'setGrammarFlag() must NOT be called');
  });

  it('calls toast and does NOT set card when original is empty string', () => {
    const outcome = componentGuard(
      { original: '', corrected: 'yo soy un estudiante', explanation: 'Use article.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setFlagSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when corrected is empty string', () => {
    const outcome = componentGuard(
      { original: 'yo soy estudiante', corrected: '', explanation: 'Use article.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setFlagSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when explanation is empty string', () => {
    const outcome = componentGuard(
      { original: 'yo soy estudiante', corrected: 'yo soy un estudiante', explanation: '' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setFlagSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when all three required fields are whitespace-only', () => {
    const outcome = componentGuard(
      { original: '  ', corrected: '  ', explanation: '  ' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setFlagSpy.calls.length, 0);
  });

  it('toast fires with the correct title and variant', () => {
    componentGuard(
      { original: '   ', corrected: 'yo soy un estudiante', explanation: 'Use article.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    const call = toastSpy.calls[0];
    assert.equal(call.title, 'Grammar correction unavailable');
    assert.equal(call.variant, 'destructive');
  });

  it('toast description mentions incomplete card', () => {
    componentGuard(
      { original: 'yo soy estudiante', corrected: '  ', explanation: 'Use article.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    const call = toastSpy.calls[0];
    assert.ok(
      call.description.toLowerCase().includes('incomplete'),
      `Expected description to mention "incomplete", got: "${call.description}"`,
    );
  });

  // ── Acceptance cases ────────────────────────────────────────────────────

  it('calls setGrammarFlag and does NOT call toast for valid data', () => {
    const data = validData();
    const outcome = componentGuard(data, toastSpy.fn, setFlagSpy.fn);
    assert.equal(outcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'toast() must NOT fire for valid data');
    assert.equal(setFlagSpy.calls.length, 1, 'setGrammarFlag() should be called once');
    assert.deepEqual(setFlagSpy.calls[0], data);
  });

  it('passes the full data object (including optional fields) to setGrammarFlag', () => {
    const data = validData({ ruleLabel: 'Articles', id: 'gf-42', timestamp: 1234567890 });
    componentGuard(data, toastSpy.fn, setFlagSpy.fn);
    assert.deepEqual(setFlagSpy.calls[0], data);
  });
});

// ---------------------------------------------------------------------------
// Tests — both layers in sequence (end-to-end guard chain)
// ---------------------------------------------------------------------------

describe('End-to-end guard chain (hook → component callback)', () => {

  it('whitespace-only original is rejected at Layer 1 before reaching Layer 2', () => {
    const hookResult = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: '   ', corrected: 'yo soy un estudiante', explanation: 'Use article.' },
    });
    assert.equal(hookResult, null, 'Layer 1 must stop whitespace-only original');
  });

  it('whitespace-only corrected is rejected at Layer 1 before reaching Layer 2', () => {
    const hookResult = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'yo soy estudiante', corrected: '   ', explanation: 'Use article.' },
    });
    assert.equal(hookResult, null, 'Layer 1 must stop whitespace-only corrected');
  });

  it('whitespace-only explanation is rejected at Layer 1 before reaching Layer 2', () => {
    const hookResult = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'yo soy estudiante', corrected: 'yo soy un estudiante', explanation: '   ' },
    });
    assert.equal(hookResult, null, 'Layer 1 must stop whitespace-only explanation');
  });

  it('valid data passes Layer 1 AND is accepted by Layer 2', () => {
    const data = validData();
    const hookResult = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(hookResult !== null, 'Layer 1 should pass valid data');

    const toastSpy = makeToastSpy();
    const setFlagSpy = makeSetFlagSpy();
    const componentOutcome = componentGuard(hookResult!, toastSpy.fn, setFlagSpy.fn);

    assert.equal(componentOutcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'No toast for valid data');
    assert.equal(setFlagSpy.calls.length, 1, 'setGrammarFlag called once');
  });
});
