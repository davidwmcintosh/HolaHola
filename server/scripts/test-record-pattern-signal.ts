/**
 * test-record-pattern-signal.ts
 *
 * Confirms that the RECORD_PATTERN_SIGNAL tool handler correctly writes rows to
 * both `compartment_events` and `compartment_installation` for all four event types.
 *
 * The concern: the handler calls storage.logCompartmentEvent + storage.upsertCompartment /
 * storage.updateCompartmentStatus in a fire-and-forget async block. A DB constraint
 * violation, enum mismatch, or wrong column mapping would fail silently — Daniela's
 * compartment map would stay blank with no visible error.
 *
 * What this script tests:
 *   1. logCompartmentEvent inserts a row in compartment_events for each of the 4 event types
 *   2. upsertCompartment creates a new row in compartment_installation on first encounter
 *   3. updateCompartmentStatus updates counters and status on subsequent encounters
 *   4. getCompartment reads back the correct status after each update
 *   5. getCompartmentEvents returns the full event log in descending order
 *   6. Clean-up: test rows removed from both tables after assertions pass
 *
 * Run: npx tsx server/scripts/test-record-pattern-signal.ts
 */

import { storage } from '../storage';
import { getSharedDb } from '../db';
import { compartmentEvents, compartmentInstallation, users } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const G   = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B   = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y   = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n      ${R('→')} ${detail}` : ''}`);
    failed++;
  }
}

async function assertAsync(label: string, fn: () => Promise<boolean>, detailFn?: () => string) {
  try {
    const ok = await fn();
    assert(label, ok, ok ? undefined : detailFn?.());
  } catch (err: any) {
    console.log(`  ${R('✗')} ${label}\n      ${R('→')} threw: ${err.message}`);
    failed++;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getTestUserId(): Promise<string> {
  const db = getSharedDb();
  // Prefer an existing test account; fall back to any user.
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .limit(1);
  if (!rows.length) throw new Error('No users in DB — cannot run test');
  return rows[0].id;
}

async function cleanupTestRows(userId: string, language: string, patternKey: string) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log(B('\n╔══════════════════════════════════════════════════════════════╗'));
  console.log(B('║        test-record-pattern-signal                            ║'));
  console.log(B('║  Verifies compartment DB writes for all 4 signal event types ║'));
  console.log(B('╚══════════════════════════════════════════════════════════════╝'));

  const userId   = await getTestUserId();
  const language = 'spanish';
  const patternKey = `__test__yo-AR-present-${Date.now()}`;
  const sessionId = 'test-session-' + Date.now();

  console.log(Y(`\n  Test user  : ${userId}`));
  console.log(Y(`  Pattern key: ${patternKey}`));

  // Pre-clean any stale rows from a previous interrupted run
  await cleanupTestRows(userId, language, patternKey);

  // ════════════════════════════════════════════════════════════════════════════
  // PART 1 — logCompartmentEvent: all four event types
  // ════════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 1 — logCompartmentEvent (compartment_events table)'));

  const eventTypes = ['wobble', 'stability', 'derivation', 'pounding'] as const;
  const insertedEventIds: string[] = [];

  for (const eventType of eventTypes) {
    await assertAsync(`INSERT ${eventType} event → returns a row with matching fields`, async () => {
      const event = await storage.logCompartmentEvent({
        userId,
        language,
        patternKey,
        eventType,
        verbContext:       `bailar (${eventType} test)`,
        studentUtterance:  `Yo bailo — ${eventType} test`,
        sessionId,
        notes:             `Automated test for event type ${eventType}`,
      });
      if (!event || !event.id) return false;
      if (event.userId       !== userId)     return false;
      if (event.language     !== language)   return false;
      if (event.patternKey   !== patternKey) return false;
      if (event.eventType    !== eventType)  return false;
      insertedEventIds.push(event.id);
      return true;
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PART 2 — getCompartmentEvents: verify all 4 events are readable
  // ════════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 2 — getCompartmentEvents (read-back of all 4 events)'));

  await assertAsync('getCompartmentEvents returns 4 rows for test pattern', async () => {
    const events = await storage.getCompartmentEvents(userId, language, patternKey, 10);
    return events.length === 4;
  }, () => 'Expected 4 event rows after inserting one of each type');

  await assertAsync('All 4 event types present in read-back', async () => {
    const events = await storage.getCompartmentEvents(userId, language, patternKey, 10);
    const types = new Set(events.map(e => e.eventType));
    return eventTypes.every(t => types.has(t));
  }, () => 'One or more event types missing from DB read-back');

  // ════════════════════════════════════════════════════════════════════════════
  // PART 3 — upsertCompartment: first encounter creates the installation row
  // ════════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 3 — upsertCompartment (compartment_installation — first write)'));

  await assertAsync('getCompartment returns undefined before first upsert', async () => {
    const row = await storage.getCompartment(userId, language, patternKey);
    return row === undefined;
  });

  const now = new Date();
  await assertAsync('upsertCompartment creates row with status=wobbling', async () => {
    const row = await storage.upsertCompartment({
      userId,
      language,
      patternKey,
      status:         'wobbling',
      poundingCount:  0,
      wobbleCount:    1,
      derivationCount: 0,
      lastWobbledAt:  now,
      stabilizedAt:   null,
      generativeAt:   null,
      lastDrilledAt:  now,
    });
    return row !== undefined && row.status === 'wobbling' && row.wobbleCount === 1;
  }, () => 'upsertCompartment did not return a row with status=wobbling');

  await assertAsync('getCompartment returns the new installation row', async () => {
    const row = await storage.getCompartment(userId, language, patternKey);
    return row !== undefined && row.status === 'wobbling';
  }, () => 'getCompartment returned undefined or wrong status after upsert');

  // ════════════════════════════════════════════════════════════════════════════
  // PART 4 — updateCompartmentStatus: subsequent signals update counters
  // ════════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 4 — updateCompartmentStatus (compartment_installation — updates)'));

  await assertAsync('stability signal → status becomes stable, stabilizedAt set', async () => {
    const stabilizedAt = new Date();
    const row = await storage.updateCompartmentStatus(userId, language, patternKey, {
      status: 'stable',
      lastDrilledAt: stabilizedAt,
      stabilizedAt,
    });
    return row !== undefined && row.status === 'stable' && row.stabilizedAt !== null;
  }, () => 'updateCompartmentStatus did not return stable row');

  await assertAsync('derivation signal → status becomes generative, derivationCount=1', async () => {
    const generativeAt = new Date();
    const row = await storage.updateCompartmentStatus(userId, language, patternKey, {
      status: 'generative',
      derivationCount: 1,
      generativeAt,
      lastDrilledAt: generativeAt,
    });
    return row !== undefined && row.status === 'generative' && (row.derivationCount ?? 0) === 1;
  }, () => 'updateCompartmentStatus did not return generative row with derivationCount=1');

  await assertAsync('pounding signal → poundingCount increments to 1', async () => {
    const now2 = new Date();
    const row = await storage.updateCompartmentStatus(userId, language, patternKey, {
      poundingCount: 1,
      lastDrilledAt: now2,
    });
    return row !== undefined && (row.poundingCount ?? 0) === 1;
  }, () => 'updateCompartmentStatus did not increment poundingCount');

  await assertAsync('getCompartment reflects final state (generative, poundingCount=1)', async () => {
    const row = await storage.getCompartment(userId, language, patternKey);
    return (
      row !== undefined &&
      row.status === 'generative' &&
      (row.poundingCount ?? 0) === 1 &&
      (row.derivationCount ?? 0) === 1 &&
      row.stabilizedAt !== null &&
      row.generativeAt !== null
    );
  }, () => 'Final compartment state does not match expected values');

  // ════════════════════════════════════════════════════════════════════════════
  // PART 5 — upsertCompartment idempotency (conflict resolution)
  // ════════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 5 — upsertCompartment idempotency (ON CONFLICT DO UPDATE)'));

  await assertAsync('Second upsert with status=wobbling does not throw', async () => {
    const row = await storage.upsertCompartment({
      userId,
      language,
      patternKey,
      status:         'wobbling',
      poundingCount:  5,
      wobbleCount:    3,
      derivationCount: 0,
      lastWobbledAt:  new Date(),
      stabilizedAt:   null,
      generativeAt:   null,
      lastDrilledAt:  new Date(),
    });
    // Should update the existing row, not throw a duplicate-key error
    return row !== undefined && row.poundingCount === 5;
  }, () => 'upsertCompartment threw on second call (conflict resolution broken)');

  // ════════════════════════════════════════════════════════════════════════════
  // PART 6 — Cleanup
  // ════════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B('PART 6 — Cleanup (removing test rows)'));

  try {
    await cleanupTestRows(userId, language, patternKey);
    console.log(`  ${G('✓')} Test rows deleted from compartment_events and compartment_installation`);
  } catch (err: any) {
    console.log(`  ${Y('!')} Cleanup warning: ${err.message}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Summary
  // ════════════════════════════════════════════════════════════════════════════
  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`\n  All ${total} checks passed ✓`));
    console.log(G('  compartment_events and compartment_installation writes are wired correctly.\n'));
  } else {
    console.log(R(`\n  ${failed} / ${total} checks FAILED ✗`));
    console.log(R('  Pattern signal writes are broken — check enum values and DB constraints.\n'));
    process.exit(1);
  }
}

run().catch(err => {
  console.error(R('\nFatal error: ' + err.message));
  console.error(err.stack);
  process.exit(1);
});
