/**
 * Integration test: ORDER BY resolvedAt DESC enforced end-to-end via the real HTTP route.
 *
 * The in-memory tests in absence-history-filter.test.ts verify the sort logic
 * against a simulated list.  This file goes one level deeper:
 *
 *   1. Seeds three rows with distinct resolvedAt timestamps directly into the
 *      real database (inserted in OLDEST-FIRST order so a missing ORDER BY would
 *      return them in the wrong order).
 *   2. Imports absenceHistoryHandler — the actual exported handler from
 *      server/routes.ts that is wired to GET /api/admin/absence-nudges/history
 *      in production — and mounts it on a minimal Express app without auth
 *      middleware so the test can call it directly.
 *   3. Issues real HTTP GETs (using Node's built-in http module) and asserts:
 *        • HTTP 200 status code
 *        • the response body is newest-first (resolvedAt DESC)
 *        • the ?limit param is read from the query string and clamped correctly
 *        • the ?resolutionType param filters correctly
 *   4. Cleans up all seeded rows from the DB in the after() hook.
 *
 * Why this adds value over the in-memory tests:
 *   - Uses absenceHistoryHandler from routes.ts directly — any change to the
 *     handler's limit clamping, resolutionType parsing, or listResolvedNudges()
 *     call is automatically exercised here.
 *   - Exercises the real Drizzle .orderBy(desc(resolvedAt)) clause against the
 *     live database — a refactor that removes it will fail the ordering assertions.
 *
 * Run with:
 *   npx tsx --test server/__tests__/absence-history-order.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { getSharedDb } from '../db';
import { danielaAbsenceNudges } from '@shared/schema';
import { inArray } from 'drizzle-orm';

// Import the REAL route handler from its dedicated module.
// This is the same function registered as the production route in routes.ts:
//   app.get("/api/admin/absence-nudges/history", isAuthenticated, ..., absenceHistoryHandler)
// Any change to the handler's logic is automatically picked up by this test.
import { absenceHistoryHandler } from '../routes/absence-nudges-history';

// ── HTTP helper ───────────────────────────────────────────────────────────────

/**
 * Make an HTTP GET request and return { status, body }.
 * Captures the numeric HTTP status code so callers can assert 200 vs 500 etc.
 */
function httpGet(url: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let raw = '';
      res.on('data', (chunk: Buffer) => { raw += chunk.toString(); });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode ?? 0, body: JSON.parse(raw) });
        } catch (e) {
          reject(new Error(
            `Invalid JSON from ${url} (status ${res.statusCode}): ${raw.slice(0, 200)}`
          ));
        }
      });
    }).on('error', reject);
  });
}

/** Start an Express server on a random available port; return server + port. */
function startTestServer(app: express.Express): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(app);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      if (!addr || typeof addr === 'string') {
        reject(new Error('Could not determine test server port'));
        return;
      }
      resolve({ server: srv, port: addr.port });
    });
    srv.on('error', reject);
  });
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TEST_USER_PREFIX = 'test-order-184-';

// Three nudges seeded in OLDEST-FIRST order (ascending resolvedAt).
// A missing .orderBy(desc(resolvedAt)) in listResolvedNudges() would return
// them in insertion order — oldest first — causing the assertions to fail.
const SEED_ROWS = [
  {
    userId:         `${TEST_USER_PREFIX}alpha`,
    resolvedAt:     new Date('2026-07-28T09:00:00Z'),   // oldest
    resolutionType: 'dismissed' as const,
  },
  {
    userId:         `${TEST_USER_PREFIX}beta`,
    resolvedAt:     new Date('2026-07-28T11:00:00Z'),   // middle
    resolutionType: 'message_queued' as const,
  },
  {
    userId:         `${TEST_USER_PREFIX}gamma`,
    resolvedAt:     new Date('2026-07-28T14:00:00Z'),   // newest
    resolutionType: 'student_returned' as const,
  },
] as const;

// ── Test state ────────────────────────────────────────────────────────────────

let server: http.Server;
let baseUrl: string;
let seededIds: string[] = [];

// ── Setup / teardown ──────────────────────────────────────────────────────────

before(async () => {
  const db = getSharedDb();

  // Insert in oldest-first order. Without ORDER BY the DB returns them this way.
  for (const row of SEED_ROWS) {
    const [inserted] = await db
      .insert(danielaAbsenceNudges)
      .values({
        userId:               row.userId,
        daysSinceLastSession: 7,
        lastSessionDate:      new Date('2026-07-21T00:00:00Z'),
        resolvedAt:           row.resolvedAt,
        resolutionType:       row.resolutionType,
      })
      .returning({ id: danielaAbsenceNudges.id });
    seededIds.push(inserted.id);
  }

  // Mount the REAL handler from routes.ts — no auth middleware so the test
  // can call it directly.  The handler itself (limit clamping, resolutionType
  // validation, listResolvedNudges() call) is unchanged.
  const app = express();
  app.get('/api/admin/absence-nudges/history', absenceHistoryHandler);

  const result = await startTestServer(app);
  server = result.server;
  baseUrl = `http://127.0.0.1:${result.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );

  if (seededIds.length > 0) {
    const db = getSharedDb();
    await db.delete(danielaAbsenceNudges).where(inArray(danielaAbsenceNudges.id, seededIds));
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Extract only rows seeded by this test run from the full response array. */
function extractTestRows(
  history: Array<{ nudgeId: string; resolvedAt: string; resolutionType?: string | null }>
) {
  const ids = new Set(seededIds);
  return history.filter(row => ids.has(row.nudgeId));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/admin/absence-nudges/history — ORDER BY resolvedAt DESC via real HTTP route', () => {

  // ── Basic contract ─────────────────────────────────────────────────────────

  it('route responds with HTTP 200', async () => {
    const { status } = await httpGet(`${baseUrl}/api/admin/absence-nudges/history`);
    assert.equal(status, 200, `Expected HTTP 200; got ${status}`);
  });

  it('response body contains a history array', async () => {
    const { body } = await httpGet(`${baseUrl}/api/admin/absence-nudges/history`);
    assert.ok(Array.isArray((body as any).history),
      `Expected body.history to be an array; got ${JSON.stringify(body).slice(0, 200)}`);
  });

  it('response includes all three seeded rows', async () => {
    const { status, body } = await httpGet(`${baseUrl}/api/admin/absence-nudges/history?limit=100`);
    assert.equal(status, 200);
    const rows = extractTestRows((body as any).history);
    assert.equal(rows.length, 3,
      `Expected 3 seeded rows; got ${rows.length}. ` +
      `IDs in response: ${(body as any).history.map((r: any) => r.nudgeId).join(', ')}`);
  });

  // ── ORDER BY correctness ───────────────────────────────────────────────────
  //
  // Rows were inserted oldest-first (alpha 09:00, beta 11:00, gamma 14:00).
  // With .orderBy(desc(resolvedAt)), output must be gamma → beta → alpha.
  // Removing .orderBy() from listResolvedNudges() causes these assertions to fail.

  it('first test row is gamma (newest, 14:00) — not alpha (oldest, 09:00)', async () => {
    const { status, body } = await httpGet(`${baseUrl}/api/admin/absence-nudges/history?limit=100`);
    assert.equal(status, 200);
    const rows = extractTestRows((body as any).history);
    assert.equal(rows.length, 3, 'Expected 3 test rows');

    const firstResolved = new Date(rows[0].resolvedAt).getTime();
    const gammaExpected = new Date('2026-07-28T14:00:00Z').getTime();
    assert.equal(firstResolved, gammaExpected,
      `First row resolvedAt must be 14:00 (gamma, newest). Got ${rows[0].resolvedAt}. ` +
      `Rows were inserted oldest-first — a missing ORDER BY would put alpha (09:00) first.`);
  });

  it('test rows are in strict newest-first order (each resolvedAt >= the next)', async () => {
    const { status, body } = await httpGet(`${baseUrl}/api/admin/absence-nudges/history?limit=100`);
    assert.equal(status, 200);
    const rows = extractTestRows((body as any).history);
    assert.equal(rows.length, 3, 'Expected 3 test rows');

    for (let i = 1; i < rows.length; i++) {
      const prev = new Date(rows[i - 1].resolvedAt).getTime();
      const curr = new Date(rows[i].resolvedAt).getTime();
      assert.ok(prev >= curr,
        `Row ${i - 1} (${rows[i - 1].resolvedAt}) must be >= row ${i} (${rows[i].resolvedAt}). ` +
        `ORDER BY resolvedAt DESC not enforced.`);
    }
  });

  it('last test row is alpha (oldest, 09:00)', async () => {
    const { status, body } = await httpGet(`${baseUrl}/api/admin/absence-nudges/history?limit=100`);
    assert.equal(status, 200);
    const rows = extractTestRows((body as any).history);
    assert.equal(rows.length, 3, 'Expected 3 test rows');

    const lastResolved = new Date(rows[rows.length - 1].resolvedAt).getTime();
    const alphaExpected = new Date('2026-07-28T09:00:00Z').getTime();
    assert.equal(lastResolved, alphaExpected,
      `Last row resolvedAt must be 09:00 (alpha, oldest). Got ${rows[rows.length - 1].resolvedAt}.`);
  });

  // ── ?limit query param ─────────────────────────────────────────────────────
  //
  // The handler (from routes.ts) reads req.query.limit and clamps it:
  //   Math.min(Math.max(Number.isFinite(parseInt(raw)) ? parseInt(raw) : 20, 1), 100)
  // These tests confirm the query param reaches the real handler.

  it('?limit=1 caps the response to 1 row', async () => {
    const { status, body } = await httpGet(`${baseUrl}/api/admin/absence-nudges/history?limit=1`);
    assert.equal(status, 200);
    assert.ok((body as any).history.length <= 1,
      `Expected at most 1 row with ?limit=1; got ${(body as any).history.length}`);
  });

  it('?limit=2 caps the response to 2 rows', async () => {
    const { status, body } = await httpGet(`${baseUrl}/api/admin/absence-nudges/history?limit=2`);
    assert.equal(status, 200);
    assert.ok((body as any).history.length <= 2,
      `Expected at most 2 rows with ?limit=2; got ${(body as any).history.length}`);
  });

  it('?limit=200 is clamped to 100 — oversized limit never reaches the DB unbounded', async () => {
    const { status, body } = await httpGet(`${baseUrl}/api/admin/absence-nudges/history?limit=200`);
    assert.equal(status, 200);
    assert.ok((body as any).history.length <= 100,
      `Expected at most 100 rows with ?limit=200; got ${(body as any).history.length}`);
  });

  // ── ?resolutionType query param ────────────────────────────────────────────
  //
  // The handler validates resolutionType against a VALID_TYPES whitelist and
  // passes it to listResolvedNudges() which adds a WHERE clause.

  it('?resolutionType=dismissed returns only the dismissed test row', async () => {
    const { status, body } = await httpGet(
      `${baseUrl}/api/admin/absence-nudges/history?limit=100&resolutionType=dismissed`
    );
    assert.equal(status, 200);
    const rows = extractTestRows((body as any).history);
    assert.equal(rows.length, 1, `Expected 1 dismissed test row; got ${rows.length}`);
    assert.equal(rows[0].resolutionType, 'dismissed');
  });

  it('?resolutionType=student_returned returns only the student_returned test row', async () => {
    const { status, body } = await httpGet(
      `${baseUrl}/api/admin/absence-nudges/history?limit=100&resolutionType=student_returned`
    );
    assert.equal(status, 200);
    const rows = extractTestRows((body as any).history);
    assert.equal(rows.length, 1, `Expected 1 student_returned test row; got ${rows.length}`);
    assert.equal(rows[0].resolutionType, 'student_returned');
  });

  it('ordering still holds under an explicit large limit with no filter', async () => {
    const { status, body } = await httpGet(
      `${baseUrl}/api/admin/absence-nudges/history?limit=100`
    );
    assert.equal(status, 200);
    const rows = extractTestRows((body as any).history);
    assert.equal(rows.length, 3, 'Expected 3 test rows');

    const firstResolved = new Date(rows[0].resolvedAt).getTime();
    const lastResolved  = new Date(rows[rows.length - 1].resolvedAt).getTime();
    assert.ok(firstResolved > lastResolved,
      `First row (${rows[0].resolvedAt}) must be newer than last (${rows[rows.length - 1].resolvedAt}).`);
  });
});
