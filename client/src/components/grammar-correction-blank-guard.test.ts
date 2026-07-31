/**
 * Unit tests for the grammar-correction blank-card guard.
 *
 * Two guard layers exist in production:
 *
 *  Layer 1 — useStreamingVoice.ts `handleGrammarFlagShown` (~line 1550)
 *    Drops the message before the callback fires when `original` or `corrected`
 *    is missing or whitespace-only.
 *
 *  Layer 2 — StreamingVoiceChat.tsx `onGrammarFlagShown` (~line 1243)
 *    Secondary guard: if a whitespace-only value somehow reaches the component
 *    callback, it calls toast() and returns early without calling setGrammarFlag.
 *
 * Both layers are tested here using extracted standalone functions that mirror
 * the production logic verbatim.  If the component guard changes, update the
 * mirror below to match.
 *
 * Run with:
 *   npx tsx --test client/src/components/grammar-correction-blank-guard.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mirror of Layer 1 — useStreamingVoice.ts handleGrammarFlagShown
// Verbatim port of the guard.
// ---------------------------------------------------------------------------

interface GrammarFlagData {
  id?: string;
  original: string;
  corrected: string;
  explanation: string;
  ruleLabel?: string;
  timestamp?: number;
}

/**
 * Mirrors the hook-level guard in useStreamingVoice.ts.
 * Returns the data object when valid, or null when the message is rejected.
 */
function hookGuard(
  message: { type: string; timestamp: number; data: any },
): GrammarFlagData | null {
  if (!message.data) return null;
  const d = message.data;
  if (
    !d.original  || typeof d.original  !== 'string' || !d.original.trim() ||
    !d.corrected || typeof d.corrected !== 'string' || !d.corrected.trim()
  ) {
    return null; // malformed — drop
  }
  return d as GrammarFlagData;
}

// ---------------------------------------------------------------------------
// Mirror of Layer 2 — StreamingVoiceChat.tsx onGrammarFlagShown callback
// Verbatim port of the guard.
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
  if (!data.original || !data.original.trim() || !data.corrected || !data.corrected.trim()) {
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

// ---------------------------------------------------------------------------
// Tests — Layer 1 (hook guard)
// ---------------------------------------------------------------------------

describe('Layer 1 — useStreamingVoice hook guard (handleGrammarFlagShown)', () => {

  // ── Rejection cases ────────────────────────────────────────────────────

  it('rejects when original is whitespace-only ("   ")', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: '   ', corrected: 'Yo fui al mercado.', explanation: 'Use pretérito indefinido.' },
    });
    assert.equal(result, null, 'Expected null for whitespace-only original');
  });

  it('rejects when corrected is whitespace-only ("\\t\\n")', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'Yo iba al mercado.', corrected: '\t\n', explanation: 'Use pretérito indefinido.' },
    });
    assert.equal(result, null, 'Expected null for whitespace-only corrected');
  });

  it('rejects when original is an empty string', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: '', corrected: 'Yo fui al mercado.', explanation: 'Use pretérito indefinido.' },
    });
    assert.equal(result, null, 'Expected null for empty original');
  });

  it('rejects when corrected is an empty string', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'Yo iba al mercado.', corrected: '', explanation: 'Use pretérito indefinido.' },
    });
    assert.equal(result, null, 'Expected null for empty corrected');
  });

  it('rejects when original is missing (undefined)', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { corrected: 'Yo fui al mercado.', explanation: 'Use pretérito indefinido.' } as any,
    });
    assert.equal(result, null, 'Expected null for missing original');
  });

  it('rejects when corrected is missing (undefined)', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'Yo iba al mercado.', explanation: 'Use pretérito indefinido.' } as any,
    });
    assert.equal(result, null, 'Expected null for missing corrected');
  });

  it('rejects when both original and corrected are whitespace-only', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: '  ', corrected: '  ', explanation: 'Some explanation.' },
    });
    assert.equal(result, null, 'Expected null for both whitespace-only');
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
      data: { original: 42 as any, corrected: 'Yo fui al mercado.', explanation: 'Use pretérito indefinido.' },
    });
    assert.equal(result, null, 'Expected null for non-string original');
  });

  it('rejects when corrected is a non-string type (number)', () => {
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'Yo iba al mercado.', corrected: 99 as any, explanation: 'Use pretérito indefinido.' },
    });
    assert.equal(result, null, 'Expected null for non-string corrected');
  });

  // ── Acceptance cases ────────────────────────────────────────────────────

  it('accepts valid original and corrected, returning the data object', () => {
    const data = {
      original: 'Yo iba al mercado.',
      corrected: 'Yo fui al mercado.',
      explanation: 'Use pretérito indefinido for completed past actions.',
    };
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.original, 'Yo iba al mercado.');
    assert.equal(result!.corrected, 'Yo fui al mercado.');
  });

  it('accepts data with optional fields (ruleLabel, id)', () => {
    const data = {
      id: 'gf-1',
      original: 'Yo iba al mercado.',
      corrected: 'Yo fui al mercado.',
      explanation: 'Use pretérito indefinido.',
      ruleLabel: 'Preterite vs. Imperfect',
    };
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.ruleLabel, 'Preterite vs. Imperfect');
  });

  it('accepts original/corrected that have leading/trailing whitespace around real content', () => {
    const data = {
      original: '  Yo iba al mercado.  ',
      corrected: '  Yo fui al mercado.  ',
      explanation: 'Use pretérito indefinido.',
    };
    const result = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'A string with surrounding whitespace around content should pass');
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
      { original: '   ', corrected: 'Yo fui al mercado.', explanation: 'Use pretérito indefinido.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setFlagSpy.calls.length, 0, 'setGrammarFlag() must NOT be called');
  });

  it('calls toast and does NOT set card when corrected is whitespace-only', () => {
    const outcome = componentGuard(
      { original: 'Yo iba al mercado.', corrected: '\n  \t', explanation: 'Use pretérito indefinido.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setFlagSpy.calls.length, 0, 'setGrammarFlag() must NOT be called');
  });

  it('calls toast and does NOT set card when original is empty string', () => {
    const outcome = componentGuard(
      { original: '', corrected: 'Yo fui al mercado.', explanation: 'Use pretérito indefinido.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setFlagSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when corrected is empty string', () => {
    const outcome = componentGuard(
      { original: 'Yo iba al mercado.', corrected: '', explanation: 'Use pretérito indefinido.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setFlagSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when both are whitespace-only', () => {
    const outcome = componentGuard(
      { original: '  ', corrected: '  ', explanation: 'Some explanation.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setFlagSpy.calls.length, 0);
  });

  it('toast fires with the correct title and variant', () => {
    componentGuard(
      { original: '   ', corrected: 'Yo fui al mercado.', explanation: 'Use pretérito indefinido.' },
      toastSpy.fn,
      setFlagSpy.fn,
    );
    const call = toastSpy.calls[0];
    assert.equal(call.title, 'Grammar correction unavailable');
    assert.equal(call.variant, 'destructive');
  });

  it('toast description mentions incomplete card', () => {
    componentGuard(
      { original: 'Yo iba al mercado.', corrected: '  ', explanation: 'Use pretérito indefinido.' },
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
    const data: GrammarFlagData = {
      id: 'gf-1',
      original: 'Yo iba al mercado.',
      corrected: 'Yo fui al mercado.',
      explanation: 'Use pretérito indefinido for completed past actions.',
      ruleLabel: 'Preterite vs. Imperfect',
      timestamp: Date.now(),
    };
    const outcome = componentGuard(data, toastSpy.fn, setFlagSpy.fn);
    assert.equal(outcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'toast() must NOT fire for valid data');
    assert.equal(setFlagSpy.calls.length, 1, 'setGrammarFlag() should be called once');
    assert.deepEqual(setFlagSpy.calls[0], data);
  });

  it('passes the full data object (including optional fields) to setGrammarFlag', () => {
    const data: GrammarFlagData = {
      id: 'gf-2',
      original: 'Yo iba al mercado.',
      corrected: 'Yo fui al mercado.',
      explanation: 'Use pretérito indefinido.',
      ruleLabel: 'Preterite vs. Imperfect',
      timestamp: 1234567890,
    };
    componentGuard(data, toastSpy.fn, setFlagSpy.fn);
    assert.deepEqual(setFlagSpy.calls[0], data);
  });
});

// ---------------------------------------------------------------------------
// Tests — both layers in sequence (end-to-end guard chain)
// ---------------------------------------------------------------------------

describe('End-to-end guard chain (hook → component callback)', () => {

  it('whitespace-only original is rejected at Layer 1 before reaching Layer 2', () => {
    const data = { original: '   ', corrected: 'Yo fui al mercado.', explanation: 'Use pretérito indefinido.' };
    const hookResult = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data,
    });
    // Layer 1 returns null → Layer 2 is never called
    assert.equal(hookResult, null, 'Layer 1 must stop whitespace-only original');
  });

  it('whitespace-only corrected is rejected at Layer 1 before reaching Layer 2', () => {
    const hookResult = hookGuard({
      type: 'grammar_flag_shown',
      timestamp: Date.now(),
      data: { original: 'Yo iba al mercado.', corrected: '   ', explanation: 'Use pretérito indefinido.' },
    });
    assert.equal(hookResult, null, 'Layer 1 must stop whitespace-only corrected');
  });

  it('valid data passes Layer 1 AND is accepted by Layer 2', () => {
    const data: GrammarFlagData = {
      original: 'Yo iba al mercado.',
      corrected: 'Yo fui al mercado.',
      explanation: 'Use pretérito indefinido for completed past actions.',
    };
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
