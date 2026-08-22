/**
 * Unit tests for the cultural-context blank-card guard.
 *
 * Two guard layers exist in production:
 *
 *  Layer 1 — useStreamingVoice.ts `handleCulturalContextShown` (~line 1570)
 *    Drops the message before the callback fires when title or text is missing
 *    or whitespace-only.
 *
 *  Layer 2 — StreamingVoiceChat.tsx `onCulturalContextShown` (~line 1252)
 *    Secondary guard: if a whitespace-only value somehow reaches the component
 *    callback, it calls toast() and returns early without calling setCulturalContext.
 *
 * Both layers are tested here using extracted standalone functions that mirror
 * the production logic verbatim.  If the component guard changes, update the
 * mirror below to match.
 *
 * Run with:
 *   npx tsx --test client/src/components/cultural-context-blank-guard.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mirror of Layer 1 — useStreamingVoice.ts handleCulturalContextShown
// Verbatim port of the guard (lines 1570-1578).
// ---------------------------------------------------------------------------

interface CulturalContextData {
  id?: string;
  title: string;
  text: string;
  category?: string;
  sourceUrl?: string;
  timestamp?: number;
}

interface CulturalContextMessage {
  type: string;
  timestamp: number;
  data: CulturalContextData;
}

/**
 * Mirrors the hook-level guard in useStreamingVoice.ts.
 * Returns the data object when valid, or null when the message is rejected.
 */
function hookGuard(
  message: { type: string; timestamp: number; data: any },
): CulturalContextData | null {
  if (!message.data) return null;
  const d = message.data;
  if (
    !d.title || typeof d.title !== 'string' || !d.title.trim() ||
    !d.text  || typeof d.text  !== 'string' || !d.text.trim()
  ) {
    return null; // malformed — drop
  }
  return d as CulturalContextData;
}

// ---------------------------------------------------------------------------
// Mirror of Layer 2 — StreamingVoiceChat.tsx onCulturalContextShown callback
// Verbatim port of the guard (lines 1252-1258).
// ---------------------------------------------------------------------------

/**
 * Mirrors the component-level guard in StreamingVoiceChat.tsx.
 *
 * @returns 'set'   when setCulturalContext would be called
 * @returns 'toast' when the toast fires and the card is NOT set
 */
function componentGuard(
  data: CulturalContextData,
  toast: (opts: { title: string; description: string; variant: string }) => void,
  setCulturalContext: (d: CulturalContextData) => void,
): 'set' | 'toast' {
  if (!data.title || !data.title.trim() || !data.text || !data.text.trim()) {
    toast({
      title: 'Cultural note unavailable',
      description: 'Daniela sent an incomplete cultural context card — skipping.',
      variant: 'destructive',
    });
    return 'toast';
  }
  setCulturalContext(data);
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

function makeSetContextSpy(): {
  calls: CulturalContextData[];
  fn: (d: CulturalContextData) => void;
} {
  const calls: CulturalContextData[] = [];
  return {
    calls,
    fn(d) { calls.push(d); },
  };
}

// ---------------------------------------------------------------------------
// Tests — Layer 1 (hook guard)
// ---------------------------------------------------------------------------

describe('Layer 1 — useStreamingVoice hook guard (handleCulturalContextShown)', () => {

  // ── Rejection cases ────────────────────────────────────────────────────

  it('rejects when title is whitespace-only ("   ")', () => {
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: { title: '   ', text: 'Some real text.' },
    });
    assert.equal(result, null, 'Expected null for whitespace-only title');
  });

  it('rejects when text is whitespace-only ("\\t\\n")', () => {
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: { title: 'Real title', text: '\t\n' },
    });
    assert.equal(result, null, 'Expected null for whitespace-only text');
  });

  it('rejects when title is an empty string', () => {
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: { title: '', text: 'Some real text.' },
    });
    assert.equal(result, null, 'Expected null for empty title');
  });

  it('rejects when text is an empty string', () => {
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: { title: 'Real title', text: '' },
    });
    assert.equal(result, null, 'Expected null for empty text');
  });

  it('rejects when title is missing (undefined)', () => {
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: { text: 'Some real text.' } as any,
    });
    assert.equal(result, null, 'Expected null for missing title');
  });

  it('rejects when text is missing (undefined)', () => {
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: { title: 'Real title' } as any,
    });
    assert.equal(result, null, 'Expected null for missing text');
  });

  it('rejects when both title and text are whitespace-only', () => {
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: { title: '  ', text: '  ' },
    });
    assert.equal(result, null, 'Expected null for both whitespace-only');
  });

  it('rejects when data is null', () => {
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: null as any,
    });
    assert.equal(result, null, 'Expected null for null data');
  });

  it('rejects when title is a non-string type (number)', () => {
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: { title: 42 as any, text: 'Real text.' },
    });
    assert.equal(result, null, 'Expected null for non-string title');
  });

  // ── Acceptance cases ────────────────────────────────────────────────────

  it('accepts valid title and text, returning the data object', () => {
    const data = { title: 'El tuteo', text: 'In Spain, tú is used informally.' };
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.title, 'El tuteo');
    assert.equal(result!.text, 'In Spain, tú is used informally.');
  });

  it('accepts data with optional fields (category, sourceUrl)', () => {
    const data = {
      title: 'El tuteo',
      text: 'Using tú vs usted.',
      category: 'formality',
      sourceUrl: 'https://example.com',
    };
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.category, 'formality');
  });

  it('accepts title/text that have leading/trailing whitespace around real content', () => {
    // trim() is only used to detect ALL-whitespace; surrounding spaces are valid content
    const data = { title: '  El tuteo  ', text: '  In Spain, tú.  ' };
    const result = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(result !== null, 'A string with surrounding whitespace around content should pass');
  });
});

// ---------------------------------------------------------------------------
// Tests — Layer 2 (component callback guard)
// ---------------------------------------------------------------------------

describe('Layer 2 — StreamingVoiceChat component guard (onCulturalContextShown)', () => {

  let toastSpy: ReturnType<typeof makeToastSpy>;
  let setContextSpy: ReturnType<typeof makeSetContextSpy>;

  beforeEach(() => {
    toastSpy = makeToastSpy();
    setContextSpy = makeSetContextSpy();
  });

  // ── Rejection cases ────────────────────────────────────────────────────

  it('calls toast and does NOT set card when title is whitespace-only', () => {
    const outcome = componentGuard(
      { title: '   ', text: 'Real text.' },
      toastSpy.fn,
      setContextSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setContextSpy.calls.length, 0, 'setCulturalContext() must NOT be called');
  });

  it('calls toast and does NOT set card when text is whitespace-only', () => {
    const outcome = componentGuard(
      { title: 'Real title', text: '\n  \t' },
      toastSpy.fn,
      setContextSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setContextSpy.calls.length, 0, 'setCulturalContext() must NOT be called');
  });

  it('calls toast and does NOT set card when title is empty string', () => {
    const outcome = componentGuard(
      { title: '', text: 'Real text.' },
      toastSpy.fn,
      setContextSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setContextSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when text is empty string', () => {
    const outcome = componentGuard(
      { title: 'Real title', text: '' },
      toastSpy.fn,
      setContextSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setContextSpy.calls.length, 0);
  });

  it('calls toast and does NOT set card when both are whitespace-only', () => {
    const outcome = componentGuard(
      { title: '  ', text: '  ' },
      toastSpy.fn,
      setContextSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setContextSpy.calls.length, 0);
  });

  it('toast fires with the correct title and variant', () => {
    componentGuard(
      { title: '   ', text: 'Real text.' },
      toastSpy.fn,
      setContextSpy.fn,
    );
    const call = toastSpy.calls[0];
    assert.equal(call.title, 'Cultural note unavailable');
    assert.equal(call.variant, 'destructive');
  });

  it('toast description mentions incomplete card', () => {
    componentGuard(
      { title: 'Real title', text: '  ' },
      toastSpy.fn,
      setContextSpy.fn,
    );
    const call = toastSpy.calls[0];
    assert.ok(
      call.description.toLowerCase().includes('incomplete'),
      `Expected description to mention "incomplete", got: "${call.description}"`,
    );
  });

  // ── Acceptance cases ────────────────────────────────────────────────────

  it('calls setCulturalContext and does NOT call toast for valid data', () => {
    const data: CulturalContextData = {
      id: 'ctx-1',
      title: 'El tuteo',
      text: 'In Spain, tú is used informally.',
      category: 'formality',
      timestamp: Date.now(),
    };
    const outcome = componentGuard(data, toastSpy.fn, setContextSpy.fn);
    assert.equal(outcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'toast() must NOT fire for valid data');
    assert.equal(setContextSpy.calls.length, 1, 'setCulturalContext() should be called once');
    assert.deepEqual(setContextSpy.calls[0], data);
  });

  it('passes the full data object (including optional fields) to setCulturalContext', () => {
    const data: CulturalContextData = {
      id: 'ctx-2',
      title: 'Tuteo',
      text: 'Informal second person.',
      category: 'formality',
      sourceUrl: 'https://example.com',
      timestamp: 1234567890,
    };
    componentGuard(data, toastSpy.fn, setContextSpy.fn);
    assert.deepEqual(setContextSpy.calls[0], data);
  });
});

// ---------------------------------------------------------------------------
// Tests — both layers in sequence (end-to-end guard chain)
// ---------------------------------------------------------------------------

describe('End-to-end guard chain (hook → component callback)', () => {

  it('whitespace-only title is rejected at Layer 1 before reaching Layer 2', () => {
    const data = { title: '   ', text: 'Real text.' };
    const hookResult = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data,
    });
    // Layer 1 returns null → Layer 2 is never called
    assert.equal(hookResult, null, 'Layer 1 must stop whitespace-only title');
  });

  it('whitespace-only text is rejected at Layer 1 before reaching Layer 2', () => {
    const hookResult = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data: { title: 'Real title', text: '   ' },
    });
    assert.equal(hookResult, null, 'Layer 1 must stop whitespace-only text');
  });

  it('valid data passes Layer 1 AND is accepted by Layer 2', () => {
    const data: CulturalContextData = { title: 'El tuteo', text: 'Informal tú usage.' };
    const hookResult = hookGuard({
      type: 'cultural_context_shown',
      timestamp: Date.now(),
      data,
    });
    assert.ok(hookResult !== null, 'Layer 1 should pass valid data');

    const toastSpy = makeToastSpy();
    const setContextSpy = makeSetContextSpy();
    const componentOutcome = componentGuard(hookResult!, toastSpy.fn, setContextSpy.fn);

    assert.equal(componentOutcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'No toast for valid data');
    assert.equal(setContextSpy.calls.length, 1, 'setCulturalContext called once');
  });
});
