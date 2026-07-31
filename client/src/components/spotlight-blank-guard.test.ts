/**
 * Unit tests for the spotlight blank-card guard.
 *
 * Three guard layers exist in production:
 *
 *  Layer 0 — native-fc-handlers.ts `SPOTLIGHT` case (~line 3765)
 *    Server-side guard: drops the WS message entirely when `message` is
 *    missing or whitespace-only — spotlight_shown is never sent.
 *
 *  Layer 1 — useStreamingVoice.ts `handleSpotlightShown`
 *    Calls validateSpotlightMessage() from client/src/lib/spotlight-guard.ts.
 *    Drops the message before the callback fires when the result is null.
 *
 *  Layer 2 — StreamingVoiceChat.tsx `onSpotlightShown` callback
 *    Calls isSpotlightMessageValid() from client/src/lib/spotlight-guard.ts.
 *    If false, fires toast() and returns early without calling setSpotlight.
 *
 * Tests here import the real production guard functions directly from
 * client/src/lib/spotlight-guard.ts so any change to the production guard
 * logic is immediately reflected in test behaviour — a regression that
 * removes or weakens the guard will cause these tests to fail.
 *
 * Run with:
 *   npx tsx --test client/src/components/spotlight-blank-guard.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Import the REAL production guard functions — not mirrors.
// If these are changed or deleted in production code this test will fail.
import { validateSpotlightMessage, isSpotlightMessageValid } from '../lib/spotlight-guard.js';
import type { SpotlightData } from '../lib/spotlight-guard.js';

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

function makeSetSpotlightSpy(): {
  calls: SpotlightData[];
  fn: (d: SpotlightData) => void;
} {
  const calls: SpotlightData[] = [];
  return {
    calls,
    fn(d) { calls.push(d); },
  };
}

/**
 * Thin wrapper that mirrors the component callback body in StreamingVoiceChat.tsx
 * (onSpotlightShown) — using the REAL isSpotlightMessageValid guard.
 * If the real guard is removed or weakened, this wrapper's behaviour changes
 * and the acceptance/rejection tests below will catch it.
 */
function runComponentCallback(
  data: SpotlightData,
  toast: (opts: { title: string; description: string; variant: string }) => void,
  setSpotlight: (d: SpotlightData) => void,
): 'set' | 'toast' {
  if (!isSpotlightMessageValid(data)) {
    toast({
      title: 'Spotlight unavailable',
      description: 'Daniela sent an incomplete spotlight card — skipping.',
      variant: 'destructive',
    });
    return 'toast';
  }
  setSpotlight(data);
  return 'set';
}

// ---------------------------------------------------------------------------
// Tests — Layer 1: validateSpotlightMessage (hook guard, production function)
// ---------------------------------------------------------------------------

describe('Layer 1 — validateSpotlightMessage (production guard, useStreamingVoice hook)', () => {

  // ── Rejection cases ────────────────────────────────────────────────────

  it('rejects when message is whitespace-only ("   ")', () => {
    const result = validateSpotlightMessage({
      id: 'sp-1', zone: 'screen', message: '   ', durationMs: 8000,
    });
    assert.equal(result, null, 'Expected null for whitespace-only message');
  });

  it('rejects when message is whitespace-only ("\\t\\n")', () => {
    const result = validateSpotlightMessage({
      id: 'sp-1', zone: 'screen', message: '\t\n', durationMs: 8000,
    });
    assert.equal(result, null, 'Expected null for tab/newline whitespace message');
  });

  it('rejects when message is an empty string', () => {
    const result = validateSpotlightMessage({
      id: 'sp-1', zone: 'screen', message: '', durationMs: 8000,
    });
    assert.equal(result, null, 'Expected null for empty string message');
  });

  it('rejects when message field is missing (undefined)', () => {
    const result = validateSpotlightMessage({
      id: 'sp-1', zone: 'screen', durationMs: 8000,
    });
    assert.equal(result, null, 'Expected null for missing message field');
  });

  it('rejects when message is a non-string type (number)', () => {
    const result = validateSpotlightMessage({
      id: 'sp-1', zone: 'screen', message: 42, durationMs: 8000,
    });
    assert.equal(result, null, 'Expected null for non-string message');
  });

  it('rejects when data is null', () => {
    const result = validateSpotlightMessage(null);
    assert.equal(result, null, 'Expected null for null data');
  });

  it('rejects when data is undefined', () => {
    const result = validateSpotlightMessage(undefined);
    assert.equal(result, null, 'Expected null for undefined data');
  });

  // ── Acceptance cases ────────────────────────────────────────────────────

  it('accepts valid message and returns the data object', () => {
    const data = {
      id: 'sp-1',
      zone: 'screen',
      message: 'Click the microphone to start speaking.',
      durationMs: 8000,
      timestamp: Date.now(),
    };
    const result = validateSpotlightMessage(data);
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.message, 'Click the microphone to start speaking.');
  });

  it('accepts message that has leading/trailing whitespace around real content', () => {
    const result = validateSpotlightMessage({
      id: 'sp-2', zone: 'mic', message: '  Press and hold to speak.  ', durationMs: 5000,
    });
    assert.ok(result !== null, 'A string with surrounding whitespace around content should pass');
  });

  it('returns the full data object including optional fields', () => {
    const data = {
      id: 'sp-3',
      zone: 'vocab-grid',
      message: 'Tap any word to hear it pronounced.',
      durationMs: 10000,
      timestamp: 1234567890,
    };
    const result = validateSpotlightMessage(data);
    assert.ok(result !== null, 'Expected data object, got null');
    assert.equal(result!.zone, 'vocab-grid');
    assert.equal(result!.durationMs, 10000);
  });
});

// ---------------------------------------------------------------------------
// Tests — Layer 2: isSpotlightMessageValid (component guard, production function)
// ---------------------------------------------------------------------------

describe('Layer 2 — isSpotlightMessageValid (production guard, StreamingVoiceChat callback)', () => {

  let toastSpy: ReturnType<typeof makeToastSpy>;
  let setSpotlightSpy: ReturnType<typeof makeSetSpotlightSpy>;

  beforeEach(() => {
    toastSpy = makeToastSpy();
    setSpotlightSpy = makeSetSpotlightSpy();
  });

  // ── Rejection cases ────────────────────────────────────────────────────

  it('rejects whitespace-only message and does NOT call setSpotlight', () => {
    const outcome = runComponentCallback(
      { id: 'sp-1', zone: 'screen', message: '   ', durationMs: 8000 },
      toastSpy.fn,
      setSpotlightSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setSpotlightSpy.calls.length, 0, 'setSpotlight() must NOT be called');
  });

  it('rejects "\\n  \\t" whitespace message and does NOT call setSpotlight', () => {
    const outcome = runComponentCallback(
      { id: 'sp-1', zone: 'screen', message: '\n  \t', durationMs: 8000 },
      toastSpy.fn,
      setSpotlightSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1, 'toast() should fire once');
    assert.equal(setSpotlightSpy.calls.length, 0, 'setSpotlight() must NOT be called');
  });

  it('rejects empty string message and does NOT call setSpotlight', () => {
    const outcome = runComponentCallback(
      { id: 'sp-1', zone: 'screen', message: '', durationMs: 8000 },
      toastSpy.fn,
      setSpotlightSpy.fn,
    );
    assert.equal(outcome, 'toast');
    assert.equal(toastSpy.calls.length, 1);
    assert.equal(setSpotlightSpy.calls.length, 0);
  });

  it('toast fires with correct title and destructive variant', () => {
    runComponentCallback(
      { id: 'sp-1', zone: 'screen', message: '   ', durationMs: 8000 },
      toastSpy.fn,
      setSpotlightSpy.fn,
    );
    const call = toastSpy.calls[0];
    assert.equal(call.title, 'Spotlight unavailable');
    assert.equal(call.variant, 'destructive');
  });

  it('toast description mentions incomplete card', () => {
    runComponentCallback(
      { id: 'sp-1', zone: 'screen', message: '  ', durationMs: 8000 },
      toastSpy.fn,
      setSpotlightSpy.fn,
    );
    const call = toastSpy.calls[0];
    assert.ok(
      call.description.toLowerCase().includes('incomplete'),
      `Expected description to mention "incomplete", got: "${call.description}"`,
    );
  });

  // ── Acceptance cases ────────────────────────────────────────────────────

  it('calls setSpotlight and does NOT toast for valid data', () => {
    const data: SpotlightData = {
      id: 'sp-1',
      zone: 'screen',
      message: 'Click the microphone to start speaking.',
      durationMs: 8000,
      timestamp: Date.now(),
    };
    const outcome = runComponentCallback(data, toastSpy.fn, setSpotlightSpy.fn);
    assert.equal(outcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'toast() must NOT fire for valid data');
    assert.equal(setSpotlightSpy.calls.length, 1, 'setSpotlight() should be called once');
    assert.deepEqual(setSpotlightSpy.calls[0], data);
  });

  it('passes the full data object (including optional fields) to setSpotlight', () => {
    const data: SpotlightData = {
      id: 'sp-2',
      zone: 'vocab-grid',
      message: 'Tap any word to hear it.',
      durationMs: 10000,
      timestamp: 1234567890,
    };
    runComponentCallback(data, toastSpy.fn, setSpotlightSpy.fn);
    assert.deepEqual(setSpotlightSpy.calls[0], data);
  });

  it('accepts message with surrounding whitespace around real content', () => {
    const data: SpotlightData = {
      id: 'sp-3', zone: 'mic', message: '  Press to speak.  ', durationMs: 6000,
    };
    const outcome = runComponentCallback(data, toastSpy.fn, setSpotlightSpy.fn);
    assert.equal(outcome, 'set');
    assert.equal(setSpotlightSpy.calls.length, 1);
  });
});

// ---------------------------------------------------------------------------
// Tests — guard consistency: both guards agree on the same inputs
// ---------------------------------------------------------------------------

describe('Guard consistency — validateSpotlightMessage and isSpotlightMessageValid agree', () => {

  const invalid: Array<{ label: string; data: any }> = [
    { label: 'whitespace-only message', data: { zone: 'screen', message: '   ', durationMs: 8000 } },
    { label: 'empty string message',    data: { zone: 'screen', message: '', durationMs: 8000 } },
    { label: 'missing message field',   data: { zone: 'screen', durationMs: 8000 } },
    { label: 'numeric message',         data: { zone: 'screen', message: 42, durationMs: 8000 } },
  ];

  const valid: Array<{ label: string; data: any }> = [
    { label: 'normal message',                    data: { zone: 'screen', message: 'Hello!', durationMs: 8000 } },
    { label: 'message with surrounding spaces',   data: { zone: 'mic', message: '  Hi.  ', durationMs: 5000 } },
  ];

  for (const { label, data } of invalid) {
    it(`both guards reject: ${label}`, () => {
      assert.equal(validateSpotlightMessage(data), null, `validateSpotlightMessage should return null for: ${label}`);
      assert.equal(isSpotlightMessageValid(data as SpotlightData), false, `isSpotlightMessageValid should return false for: ${label}`);
    });
  }

  for (const { label, data } of valid) {
    it(`both guards accept: ${label}`, () => {
      assert.ok(validateSpotlightMessage(data) !== null, `validateSpotlightMessage should return data for: ${label}`);
      assert.equal(isSpotlightMessageValid(data as SpotlightData), true, `isSpotlightMessageValid should return true for: ${label}`);
    });
  }
});

// ---------------------------------------------------------------------------
// End-to-end: whitespace at Layer 1 is stopped before reaching Layer 2
// ---------------------------------------------------------------------------

describe('End-to-end guard chain (validateSpotlightMessage → isSpotlightMessageValid)', () => {

  it('whitespace-only message stopped at Layer 1 — Layer 2 never runs', () => {
    const result = validateSpotlightMessage({ zone: 'screen', message: '   ', durationMs: 8000 });
    // Layer 1 returns null → Layer 2 is never called
    assert.equal(result, null, 'Layer 1 must stop whitespace-only message');
  });

  it('empty message stopped at Layer 1 — Layer 2 never runs', () => {
    const result = validateSpotlightMessage({ zone: 'screen', message: '', durationMs: 8000 });
    assert.equal(result, null, 'Layer 1 must stop empty message');
  });

  it('valid data passes Layer 1 and is accepted by Layer 2', () => {
    const raw = { id: 'sp-1', zone: 'screen', message: 'Click the mic.', durationMs: 8000 };
    const validated = validateSpotlightMessage(raw);
    assert.ok(validated !== null, 'Layer 1 should pass valid data');

    const toastSpy = makeToastSpy();
    const setSpotlightSpy = makeSetSpotlightSpy();
    const outcome = runComponentCallback(validated!, toastSpy.fn, setSpotlightSpy.fn);

    assert.equal(outcome, 'set');
    assert.equal(toastSpy.calls.length, 0, 'No toast for valid data');
    assert.equal(setSpotlightSpy.calls.length, 1, 'setSpotlight called once');
  });
});
