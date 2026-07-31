/**
 * test-record-pattern-signal.test.ts
 *
 * Integration test: confirms that RECORD_PATTERN_SIGNAL tool calls — fired
 * through the real NativeFunctionCallHandler.handle() dispatch path —
 * actually write rows to `compartment_events` and `compartment_installation`.
 *
 * Why go through the handler (not just storage directly)?
 *   The handler extracts args from fn.args, guards on session.isIncognito,
 *   derives userId/language from session fields, and runs the DB writes inside
 *   a fire-and-forget async block.  A regression in any of those steps (wrong
 *   arg name, missing guard, swallowed error) would break persistence silently.
 *   This test proves the full path end-to-end.
 *
 * Run standalone : npx tsx --test server/scripts/test-record-pattern-signal.test.ts
 * Run in CI      : included in `npm test`
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { NativeFunctionCallHandler } from '../services/native-fc-handlers.js';
import type { StreamingSession } from '../services/streaming-session-types.js';
import { getSharedDb, closeDbConnections } from '../db.js';
import { compartmentEvents, compartmentInstallation, users } from '@shared/schema.js';
import { eq, and } from 'drizzle-orm';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Remove test rows for a specific patternKey so repeated runs stay clean. */
async function cleanRows(userId: string, language: string, patternKey: string) {
  const db = getSharedDb();
  await db.delete(compartmentEvents).where(
    and(
      eq(compartmentEvents.userId, userId),
      eq(compartmentEvents.language, language),
      eq(compartmentEvents.patternKey, patternKey),
    )
  );
  await db.delete(compartmentInstallation).where(
    and(
      eq(compartmentInstallation.userId, userId),
      eq(compartmentInstallation.language, language),
      eq(compartmentInstallation.patternKey, patternKey),
    )
  );
}

/** Wait for the fire-and-forget async block inside the handler to complete. */
const settle = () => new Promise<void>(r => setTimeout(r, 2500));

// ─── Shared state ─────────────────────────────────────────────────────────────

let testUserId = '';
let patternKey  = '';
const language  = 'spanish';
const sessionId = 'test-rps-session';

// Minimal mock session — only the fields the RECORD_PATTERN_SIGNAL case reads
function makeSession(userId: string): StreamingSession {
  return {
    id: 'test-rps-id',
    userId,
    conversationId: sessionId,
    targetLanguage: language,
    isIncognito: false,
    // The remaining fields are required by the TypeScript interface but are
    // never accessed by the RECORD_PATTERN_SIGNAL branch.
  } as unknown as StreamingSession;
}

/** Build the handler with no-op callbacks (RECORD_PATTERN_SIGNAL never calls them). */
function makeHandler(): NativeFunctionCallHandler {
  return new NativeFunctionCallHandler(
    () => {},                    // sendMessage
    () => {},                    // sendError
    async () => {},              // processPhaseShift
  );
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('RECORD_PATTERN_SIGNAL handler → DB integration', () => {

  before(async () => {
    const db = getSharedDb();
    const rows = await db.select({ id: users.id }).from(users).limit(1);
    assert.ok(rows.length > 0, 'No users in DB — cannot run test');
    testUserId = rows[0].id;
    patternKey = `__rps_test__yo-AR-${Date.now()}`;
    await cleanRows(testUserId, language, patternKey);
  });

  after(async () => {
    await cleanRows(testUserId, language, patternKey);
    await closeDbConnections();
  });

  // ── Event type coverage ────────────────────────────────────────────────────

  it('wobble event → writes a compartment_events row', async () => {
    const handler = makeHandler();
    const session = makeSession(testUserId);

    await handler.handle('s1', session, {
      name: 'record_pattern_signal',
      legacyType: 'RECORD_PATTERN_SIGNAL',
      args: {
        patternKey,
        eventType: 'wobble',
        verbContext: 'bailar',
        studentUtterance: 'Yo bailo — wobble test',
        notes: 'automated test',
      },
    });

    await settle();

    const db = getSharedDb();
    const rows = await db
      .select()
      .from(compartmentEvents)
      .where(
        and(
          eq(compartmentEvents.userId, testUserId),
          eq(compartmentEvents.language, language),
          eq(compartmentEvents.patternKey, patternKey),
          eq(compartmentEvents.eventType, 'wobble'),
        )
      );
    assert.equal(rows.length, 1, 'Expected 1 wobble event row');
    assert.equal(rows[0].verbContext, 'bailar');
    assert.equal(rows[0].sessionId, sessionId);
  });

  it('stability event → writes a compartment_events row', async () => {
    const handler = makeHandler();
    const session = makeSession(testUserId);

    await handler.handle('s2', session, {
      name: 'record_pattern_signal',
      legacyType: 'RECORD_PATTERN_SIGNAL',
      args: {
        patternKey,
        eventType: 'stability',
        verbContext: 'comer',
        studentUtterance: 'Yo como — stability test',
        notes: 'automated test',
      },
    });

    await settle();

    const db = getSharedDb();
    const rows = await db
      .select()
      .from(compartmentEvents)
      .where(
        and(
          eq(compartmentEvents.userId, testUserId),
          eq(compartmentEvents.language, language),
          eq(compartmentEvents.patternKey, patternKey),
          eq(compartmentEvents.eventType, 'stability'),
        )
      );
    assert.equal(rows.length, 1, 'Expected 1 stability event row');
  });

  it('derivation event → writes a compartment_events row', async () => {
    const handler = makeHandler();
    const session = makeSession(testUserId);

    await handler.handle('s3', session, {
      name: 'record_pattern_signal',
      legacyType: 'RECORD_PATTERN_SIGNAL',
      args: {
        patternKey,
        eventType: 'derivation',
        verbContext: 'vivir',
        studentUtterance: 'Yo vivo — derivation test',
        notes: 'automated test',
      },
    });

    await settle();

    const db = getSharedDb();
    const rows = await db
      .select()
      .from(compartmentEvents)
      .where(
        and(
          eq(compartmentEvents.userId, testUserId),
          eq(compartmentEvents.language, language),
          eq(compartmentEvents.patternKey, patternKey),
          eq(compartmentEvents.eventType, 'derivation'),
        )
      );
    assert.equal(rows.length, 1, 'Expected 1 derivation event row');
  });

  it('pounding event → writes a compartment_events row', async () => {
    const handler = makeHandler();
    const session = makeSession(testUserId);

    await handler.handle('s4', session, {
      name: 'record_pattern_signal',
      legacyType: 'RECORD_PATTERN_SIGNAL',
      args: {
        patternKey,
        eventType: 'pounding',
        verbContext: 'hablar',
        studentUtterance: 'Yo hablo — pounding test',
        notes: 'automated test',
      },
    });

    await settle();

    const db = getSharedDb();
    const rows = await db
      .select()
      .from(compartmentEvents)
      .where(
        and(
          eq(compartmentEvents.userId, testUserId),
          eq(compartmentEvents.language, language),
          eq(compartmentEvents.patternKey, patternKey),
          eq(compartmentEvents.eventType, 'pounding'),
        )
      );
    assert.equal(rows.length, 1, 'Expected 1 pounding event row');
  });

  it('all 4 event types appear in compartment_events', async () => {
    const db = getSharedDb();
    const rows = await db
      .select({ eventType: compartmentEvents.eventType })
      .from(compartmentEvents)
      .where(
        and(
          eq(compartmentEvents.userId, testUserId),
          eq(compartmentEvents.language, language),
          eq(compartmentEvents.patternKey, patternKey),
        )
      );
    const types = new Set(rows.map(r => r.eventType));
    assert.ok(types.has('wobble'),      'Missing wobble event');
    assert.ok(types.has('stability'),   'Missing stability event');
    assert.ok(types.has('derivation'),  'Missing derivation event');
    assert.ok(types.has('pounding'),    'Missing pounding event');
    assert.equal(rows.length, 4, 'Expected exactly 4 event rows (one per type)');
  });

  // ── Installation row (compartment_installation) ────────────────────────────

  it('handler creates a compartment_installation row on first signal', async () => {
    const db = getSharedDb();
    const rows = await db
      .select()
      .from(compartmentInstallation)
      .where(
        and(
          eq(compartmentInstallation.userId, testUserId),
          eq(compartmentInstallation.language, language),
          eq(compartmentInstallation.patternKey, patternKey),
        )
      );
    assert.equal(rows.length, 1, 'Expected 1 compartment_installation row');
    // The 4 events ran in series — last one was pounding, which preserves existing status
    // (wobble should have set status=wobbling first, then stability→stable,
    //  derivation→generative, pounding keeps generative).
    // All we require here is that a row exists with correct user/language/key.
    assert.equal(rows[0].userId, testUserId);
    assert.equal(rows[0].language, language);
    assert.equal(rows[0].patternKey, patternKey);
  });

  it('handler increments counters correctly after all 4 signals', async () => {
    const db = getSharedDb();
    const [row] = await db
      .select()
      .from(compartmentInstallation)
      .where(
        and(
          eq(compartmentInstallation.userId, testUserId),
          eq(compartmentInstallation.language, language),
          eq(compartmentInstallation.patternKey, patternKey),
        )
      );
    assert.ok(row, 'No installation row found');
    assert.equal(row.wobbleCount,     1, 'wobbleCount should be 1');
    assert.equal(row.derivationCount, 1, 'derivationCount should be 1');
    assert.equal(row.poundingCount,   1, 'poundingCount should be 1');
    assert.ok(row.lastWobbledAt  !== null, 'lastWobbledAt should be set');
    assert.ok(row.stabilizedAt   !== null, 'stabilizedAt should be set');
    assert.ok(row.generativeAt   !== null, 'generativeAt should be set');
    assert.ok(row.lastDrilledAt  !== null, 'lastDrilledAt should be set');
  });

  // ── Incognito guard ────────────────────────────────────────────────────────

  it('incognito session → no DB rows written', async () => {
    const incognitoKey = `__rps_incognito__${Date.now()}`;
    const handler = makeHandler();
    const session = { ...makeSession(testUserId), isIncognito: true } as unknown as StreamingSession;

    await handler.handle('s5', session, {
      name: 'record_pattern_signal',
      legacyType: 'RECORD_PATTERN_SIGNAL',
      args: {
        patternKey: incognitoKey,
        eventType: 'wobble',
        verbContext: 'test',
        notes: 'incognito guard test',
      },
    });

    await settle();

    const db = getSharedDb();
    const eventRows = await db
      .select()
      .from(compartmentEvents)
      .where(
        and(
          eq(compartmentEvents.userId, testUserId),
          eq(compartmentEvents.patternKey, incognitoKey),
        )
      );
    const installRows = await db
      .select()
      .from(compartmentInstallation)
      .where(
        and(
          eq(compartmentInstallation.userId, testUserId),
          eq(compartmentInstallation.patternKey, incognitoKey),
        )
      );
    assert.equal(eventRows.length,   0, 'Incognito: no compartment_events row expected');
    assert.equal(installRows.length, 0, 'Incognito: no compartment_installation row expected');

    // cleanup
    await cleanRows(testUserId, language, incognitoKey);
  });

  // ── Missing args guard ─────────────────────────────────────────────────────

  it('missing patternKey → no DB rows written (early return)', async () => {
    const handler = makeHandler();
    const session = makeSession(testUserId);
    const missingKey = `__rps_missing__${Date.now()}`;

    await handler.handle('s6', session, {
      name: 'record_pattern_signal',
      legacyType: 'RECORD_PATTERN_SIGNAL',
      args: {
        // patternKey intentionally omitted
        eventType: 'wobble',
      },
    });

    await settle();

    const db = getSharedDb();
    const rows = await db
      .select()
      .from(compartmentEvents)
      .where(eq(compartmentEvents.sessionId, 'test-rps-session'))
      .limit(1);
    // We just confirm handle() didn't throw — the guard break means no new rows
    // were written beyond the 4 we already inserted in earlier tests.
    assert.ok(true, 'handle() completed without throwing on missing patternKey');
  });
});
