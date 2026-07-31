/**
 * HTTP integration tests for the absence-nudges history endpoint — limit param clamping.
 *
 * PURPOSE
 * -------
 * The unit tests in absence-history-filter.test.ts exercise the inline `parseLimit`
 * helper directly.  Those tests cannot catch a future change that bypasses parseInt
 * at the route layer (e.g. switching to a Zod coerce schema) because they never touch
 * the actual Express route handler.
 *
 * These tests import the REAL route handler from
 * server/routes/absence-nudges-history.ts (the same module used by routes.ts) and
 * mount it in a minimal Express app.  Auth middleware is bypassed — the only thing
 * swapped out is the DB call (listResolvedNudges), which is replaced by a mock that
 * returns exactly as many rows as the handler requests.
 *
 * Because the limit-parsing expression lives in the real handler module, any change
 * there (e.g. parseInt → parseFloat) will produce the wrong row count and fail these
 * tests — which is exactly the regression they are designed to detect.
 *
 * CONTRACT being tested:
 *   1. GET /api/admin/absence-nudges/history?limit=99.9
 *      → parseInt("99.9", 10) truncates to 99; handler requests 99 rows; response ≤ 100.
 *   2. GET /api/admin/absence-nudges/history?limit=200.9
 *      → parseInt("200.9", 10) truncates to 200; Math.min caps to 100; response = 100.
 *
 * Run with:
 *   npx tsx --test server/__tests__/absence-history-limit-http.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';

// ── Import the REAL handler from the production route module ─────────────────
//
// buildAbsenceHistoryHandler() accepts an optional listNudges override so tests
// can inject a mock without touching the limit-parsing logic inside the handler.
// The limit-parsing expression (parseInt / Math.min / Math.max) is unchanged.

import { buildAbsenceHistoryHandler } from '../routes/absence-nudges-history.js';

// ── Mock listResolvedNudges ───────────────────────────────────────────────────
//
// Returns exactly `limit` fake rows.  Because the mock is dumb (no clamping of
// its own), the response body row count directly reflects what the real handler
// computed and passed to the DB layer.  If the handler ever stops clamping
// correctly, the assertion on response length will catch it.

async function mockListResolvedNudges(limit: number) {
  return Array.from({ length: limit }, (_, i) => ({
    nudgeId: `nudge-${i + 1}`,
    userId: `user-${i + 1}`,
  }));
}

// ── Minimal Express app ───────────────────────────────────────────────────────
//
// Auth middleware is intentionally omitted — we are testing the limit-clamping
// behaviour of the handler, not the authentication layer.

function buildTestApp() {
  const app = express();
  // Mount the REAL handler with the mock DB dependency injected.
  app.get(
    '/api/admin/absence-nudges/history',
    buildAbsenceHistoryHandler(mockListResolvedNudges),
  );
  return app;
}

// ── HTTP helper ───────────────────────────────────────────────────────────────

function getJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    http.get(url, (resp) => {
      let raw = '';
      resp.on('data', (chunk) => { raw += chunk; });
      resp.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ── Test lifecycle ────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;

before(async () => {
  const app = buildTestApp();
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
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

// ── Float-limit tests ─────────────────────────────────────────────────────────

describe('absence-nudges history — float limit via real HTTP route handler', () => {
  it('limit=99.9 → parseInt truncates to 99; handler passes 99 to DB; response ≤ 100 rows', async () => {
    const body = await getJson(`${baseUrl}/api/admin/absence-nudges/history?limit=99.9`);
    assert.ok(Array.isArray(body.history), 'response.history must be an array');
    assert.ok(
      body.history.length <= 100,
      `Expected ≤ 100 rows, got ${body.history.length}`,
    );
    assert.equal(
      body.history.length,
      99,
      `parseInt("99.9", 10) === 99; handler must pass 99 to the DB layer (got ${body.history.length})`,
    );
  });

  it('limit=200.9 → parseInt truncates to 200, Math.min caps to 100; handler passes 100 to DB', async () => {
    const body = await getJson(`${baseUrl}/api/admin/absence-nudges/history?limit=200.9`);
    assert.ok(Array.isArray(body.history), 'response.history must be an array');
    assert.ok(
      body.history.length <= 100,
      `Expected ≤ 100 rows, got ${body.history.length}`,
    );
    assert.equal(
      body.history.length,
      100,
      `parseInt("200.9", 10) === 200 → capped to 100; handler must pass 100 to the DB layer (got ${body.history.length})`,
    );
  });
});

// ── Integer-limit sanity checks ───────────────────────────────────────────────

describe('absence-nudges history — integer limit sanity checks via real HTTP route handler', () => {
  it('limit=50 → handler passes 50 to DB; response has exactly 50 rows', async () => {
    const body = await getJson(`${baseUrl}/api/admin/absence-nudges/history?limit=50`);
    assert.equal(body.history.length, 50);
  });

  it('limit=200 → capped at 100; handler passes 100 to DB', async () => {
    const body = await getJson(`${baseUrl}/api/admin/absence-nudges/history?limit=200`);
    assert.equal(body.history.length, 100);
  });

  it('no limit param → default 20; handler passes 20 to DB', async () => {
    const body = await getJson(`${baseUrl}/api/admin/absence-nudges/history`);
    assert.equal(body.history.length, 20);
  });
});
