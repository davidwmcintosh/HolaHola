/**
 * sms-unknown-user-404.test.ts
 *
 * Confirms that POST /api/admin/test-voice-sms returns 404 for an unknown
 * userId and never inserts a row into daniela_outbound_queue.
 *
 * The test exercises the REAL handler from
 * server/routes/test-voice-sms-handler.ts (the same module used by routes.ts)
 * mounted in a minimal Express app with:
 *   - auth middleware bypassed (not under test)
 *   - storage.getUser() returning undefined  (unknown user)
 *   - insertQueue spy that throws if called  (must NOT be called)
 *   - deliverSms spy that throws if called   (must NOT be called)
 *
 * If the guard in buildTestVoiceSmsHandler() is removed or bypassed, the
 * insertQueue spy fires, the test throws, and CI fails.
 *
 * Run with:
 *   npx tsx --test server/__tests__/sms-unknown-user-404.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

import { buildTestVoiceSmsHandler } from '../routes/test-voice-sms-handler.js';

// ── Spy factories ─────────────────────────────────────────────────────────────

function insertQueueSpy(): { called: boolean; fn: (...args: any[]) => never } {
  const state = { called: false };
  return {
    called: false,
    fn(..._args: any[]): never {
      state.called = true;
      throw new Error(
        'insertQueue must NOT be called when the user does not exist — ' +
        '404 guard in buildTestVoiceSmsHandler() has been bypassed.',
      );
    },
  };
}

function deliverSmsSpy(): { fn: (...args: any[]) => never } {
  return {
    fn(..._args: any[]): never {
      throw new Error(
        'deliverSms must NOT be called when the user does not exist.',
      );
    },
  };
}

// ── Test app builder ──────────────────────────────────────────────────────────

function buildTestApp(overrides: {
  getUserResult: undefined | null | { id: string };
  insertQueueFn: (...args: any[]) => any;
  deliverSmsFn: (...args: any[]) => any;
}) {
  const app = express();
  app.use(express.json());

  app.post(
    '/api/admin/test-voice-sms',
    buildTestVoiceSmsHandler({
      storage: {
        getUser: async (_id: string) => overrides.getUserResult,
      },
      insertQueue: overrides.insertQueueFn,
      deliverSms: overrides.deliverSmsFn,
      appUrl: 'https://test.example.com',
    }),
  );

  return app;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function postJson(
  url: string,
  body: Record<string, unknown>,
): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: Number(parsed.port),
        path: parsed.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (resp) => {
        let raw = '';
        resp.on('data', (chunk) => { raw += chunk; });
        resp.on('end', () => {
          try {
            resolve({ status: resp.statusCode ?? 0, body: JSON.parse(raw) });
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;
let queueSpy: ReturnType<typeof insertQueueSpy>;
let deliverSpy: ReturnType<typeof deliverSmsSpy>;

before(async () => {
  queueSpy = insertQueueSpy();
  deliverSpy = deliverSmsSpy();

  const app = buildTestApp({
    getUserResult: undefined,   // ← unknown user: storage returns nothing
    insertQueueFn: queueSpy.fn,
    deliverSmsFn: deliverSpy.fn,
  });

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as { port: number };
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/admin/test-voice-sms — unknown userId', () => {

  it('returns HTTP 404 for a non-existent userId', async () => {
    const { status } = await postJson(`${baseUrl}/api/admin/test-voice-sms`, {
      userId: 'no-such-user-xxxxxxxx',
    });
    assert.equal(
      status,
      404,
      `Expected 404 for an unknown userId, got ${status}. ` +
      'The user-existence guard in buildTestVoiceSmsHandler() may have been removed.',
    );
  });

  it('response body contains a meaningful error message', async () => {
    const { body } = await postJson(`${baseUrl}/api/admin/test-voice-sms`, {
      userId: 'no-such-user-xxxxxxxx',
    });
    assert.ok(
      typeof body.error === 'string' && body.error.length > 0,
      `Expected a non-empty error string in the response body, got: ${JSON.stringify(body)}`,
    );
    assert.ok(
      body.error.toLowerCase().includes('no user found') ||
        body.error.toLowerCase().includes('not found') ||
        body.error.toLowerCase().includes('unknown'),
      `Error message should describe the missing user. Got: "${body.error}"`,
    );
  });

  it('does not insert a row into daniela_outbound_queue for an unknown userId', async () => {
    // The insertQueue spy throws if called.  A 404 response here means the spy
    // was NOT called — the guard returned before reaching the insert.
    const { status } = await postJson(`${baseUrl}/api/admin/test-voice-sms`, {
      userId: 'another-unknown-user-yyyyyyyy',
    });
    assert.equal(
      status,
      404,
      'Expected 404 — the queue insert must not have been reached for an unknown user.',
    );
  });

  it('returns 400 (not 404) when userId is missing entirely', async () => {
    const { status } = await postJson(`${baseUrl}/api/admin/test-voice-sms`, {
      message: 'Hello',
    });
    assert.equal(
      status,
      400,
      `Expected 400 when userId is absent, got ${status}.`,
    );
  });

});

// ── Positive-path: known user does NOT get a 404 ─────────────────────────────

describe('POST /api/admin/test-voice-sms — known userId (positive path)', () => {

  it('returns 200 when storage resolves to a real user', async () => {
    const knownApp = buildTestApp({
      getUserResult: { id: 'user-abc-123' },
      insertQueueFn: async (_userId: string, _content: string) => ({
        id: 'queue-row-id-001',
      }),
      deliverSmsFn: async () => ({ smsSent: false, deliveryNote: 'Twilio not configured' }),
    });

    const knownServer = await new Promise<http.Server>((resolve) => {
      const s = knownApp.listen(0, '127.0.0.1', () => resolve(s));
    });

    const addr = knownServer.address() as { port: number };
    const url = `http://127.0.0.1:${addr.port}`;

    try {
      const { status, body } = await postJson(`${url}/api/admin/test-voice-sms`, {
        userId: 'user-abc-123',
      });
      assert.equal(
        status,
        200,
        `Expected 200 for a known userId, got ${status}. Body: ${JSON.stringify(body)}`,
      );
      assert.ok(
        typeof body.queueId === 'string',
        'Response should contain a queueId for a successful insert.',
      );
    } finally {
      await new Promise<void>((resolve, reject) =>
        knownServer.close((err) => (err ? reject(err) : resolve())),
      );
    }
  });

});
