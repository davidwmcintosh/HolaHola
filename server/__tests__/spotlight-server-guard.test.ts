/**
 * Server-side spotlight guard tests.
 *
 * The SPOTLIGHT case in native-fc-handlers.ts (~line 3761) contains a
 * whitespace guard that prevents `spotlight_shown` WS messages from being sent
 * when the `message` argument is missing, non-string, or whitespace-only:
 *
 *   if (!spMessage || typeof spMessage !== 'string' || !spMessage.trim()) {
 *     console.warn('[Native Function→Spotlight] missing or empty message — skipping');
 *     break;
 *   }
 *
 * These tests exercise the REAL `NativeFunctionCallHandler.handle()` method
 * directly so that removing or weakening this guard causes the tests to fail.
 *
 * Run with:
 *   npx tsx --test server/__tests__/spotlight-server-guard.test.ts
 */

import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';

import { NativeFunctionCallHandler } from '../services/native-fc-handlers';
import { closeDbConnections } from '../db';

// ── Teardown — close any DB connections opened by transitive imports ──────────
// Importing native-fc-handlers.ts pulls in modules with long-lived handles
// (DB pool, Deepgram, etc.) that prevent natural process exit. Close them here
// so the test runner can exit cleanly with the correct exit code.
after(async () => {
  await closeDbConnections();
  process.exit(process.exitCode ?? 0);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

type SendMessageCall = { ws: unknown; message: unknown };

function makeSendMessageSpy(): {
  calls: SendMessageCall[];
  fn: (ws: unknown, message: unknown) => void;
} {
  const calls: SendMessageCall[] = [];
  return {
    calls,
    fn(ws, message) { calls.push({ ws, message }); },
  };
}

/**
 * Build the minimal StreamingSession-compatible object required by the SPOTLIGHT
 * handler path.
 *
 * - `isIncognito: true` skips the brainHealthTelemetry.logToolCall() call
 *   (which would attempt a real DB insert).
 * - `conversationId: undefined` skips the observeToolCall() call (in-memory
 *   only, but avoids any side effects).
 * - `ws: {}` is the WebSocket stub — sendMessage receives it as the first arg.
 */
function buildMinimalSession(): any {
  return {
    id: 'test-session',
    userId: 'test-user',
    targetLanguage: 'es',
    conversationId: undefined,
    isIncognito: true,
    ws: {},
    accumulatedBoldWords: [],
  };
}

function buildHandler(sendMessageSpy: (ws: unknown, message: unknown) => void): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(
    sendMessageSpy,
    /* sendError */ () => {},
    /* processPhaseShift */ async () => {},
  );
}

function spotlightCall(messageArg: unknown): { name: string; legacyType: string; args: Record<string, unknown> } {
  return {
    name: 'show_spotlight',
    legacyType: 'SPOTLIGHT',
    args: messageArg === undefined
      ? { zone: 'screen', duration_ms: 8000 }
      : { zone: 'screen', message: messageArg, duration_ms: 8000 },
  };
}

// ── Tests: whitespace guard blocks sendMessage ────────────────────────────────

describe('Layer 0 — SPOTLIGHT server guard (NativeFunctionCallHandler)', () => {

  describe('rejects invalid messages — sendMessage must NOT be called', () => {

    it('whitespace-only message ("   ") → sendMessage not called', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall('   ') as any);
      assert.equal(spy.calls.length, 0, 'sendMessage must not fire for whitespace-only message');
    });

    it('whitespace-only message ("\\t\\n") → sendMessage not called', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall('\t\n') as any);
      assert.equal(spy.calls.length, 0, 'sendMessage must not fire for tab/newline message');
    });

    it('empty string ("") → sendMessage not called', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall('') as any);
      assert.equal(spy.calls.length, 0, 'sendMessage must not fire for empty string message');
    });

    it('missing message field (undefined) → sendMessage not called', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall(undefined) as any);
      assert.equal(spy.calls.length, 0, 'sendMessage must not fire when message is absent');
    });

    it('numeric message (42) → sendMessage not called', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall(42) as any);
      assert.equal(spy.calls.length, 0, 'sendMessage must not fire for non-string message');
    });

    it('null message → sendMessage not called', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall(null) as any);
      assert.equal(spy.calls.length, 0, 'sendMessage must not fire for null message');
    });

  });

  describe('accepts valid messages — sendMessage IS called with spotlight_shown payload', () => {

    it('valid message → sendMessage called once', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall('Click the microphone to start.') as any);
      assert.equal(spy.calls.length, 1, 'sendMessage must be called exactly once for a valid message');
    });

    it('valid message → sendMessage receives type: "spotlight_shown"', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall('Tap any word to hear it.') as any);
      const msg = spy.calls[0].message as any;
      assert.equal(msg.type, 'spotlight_shown', 'WS message type must be "spotlight_shown"');
    });

    it('valid message → payload contains the message string', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      const text = 'Press and hold to speak.';
      await handler.handle('sid', buildMinimalSession(), spotlightCall(text) as any);
      const msg = spy.calls[0].message as any;
      assert.equal(msg.data.message, text, 'payload.data.message must match the input string');
    });

    it('valid message → payload contains the zone', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall('Hello!') as any);
      const msg = spy.calls[0].message as any;
      assert.equal(msg.data.zone, 'screen', 'payload.data.zone must match the input zone');
    });

    it('valid message → payload contains durationMs', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall('Ready?') as any);
      const msg = spy.calls[0].message as any;
      assert.equal(msg.data.durationMs, 8000, 'payload.data.durationMs must equal duration_ms arg (8000)');
    });

    it('valid message → payload contains an id field', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      await handler.handle('sid', buildMinimalSession(), spotlightCall('Go!') as any);
      const msg = spy.calls[0].message as any;
      assert.ok(typeof msg.data.id === 'string' && msg.data.id.length > 0, 'payload.data.id must be a non-empty string');
    });

    it('message with surrounding whitespace around real content → sendMessage called', async () => {
      const spy = makeSendMessageSpy();
      const handler = buildHandler(spy.fn);
      // Surrounding whitespace: trim() would be truthy, guard should pass.
      await handler.handle('sid', buildMinimalSession(), spotlightCall('  Click the mic.  ') as any);
      assert.equal(spy.calls.length, 1, 'sendMessage must fire when content is surrounded by whitespace');
    });

  });

});
