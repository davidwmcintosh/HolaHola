/**
 * test-absence-return-guard.ts
 *
 * Verifies that autoResolveAbsenceNudgeOnReturn() is a complete no-op when
 * the student has no pending absence nudge in the DB.
 *
 * Specifically confirms:
 *   1. No "[AbsenceWorker] Auto-cleared..." message is logged  ← the primary guard
 *   2. No Express Lane note is posted (founderCollabWSBroker.addAndBroadcastMessage is not called)
 *   3. resolveAbsenceNudge is not called (no DB update for a non-existent nudge)
 *
 * Run: npx tsx server/scripts/test-absence-return-guard.ts
 */

import { getSharedDb } from '../db';
import { danielaAbsenceNudges, collaborationMessages } from '@shared/schema';
import { eq, isNull, isNotNull, and, gte } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Guard path: no pending nudge → immediate return, no side-effects
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — No-op guard when no pending nudge exists'));
sep();

// Capture all console output during the call
const capturedLogs: string[] = [];
const origLog  = console.log;
const origWarn = console.warn;

function startCapture() {
  capturedLogs.length = 0;
  console.log  = (...args: any[]) => { capturedLogs.push(args.map(String).join(' ')); };
  console.warn = (...args: any[]) => { capturedLogs.push('[WARN] ' + args.map(String).join(' ')); };
}
function stopCapture() {
  console.log  = origLog;
  console.warn = origWarn;
}

// Use a deterministic fake userId that will never have a nudge row
const GHOST_USER_ID = '00000000-test-no-nudge-0000';

async function runPart1() {
  // Confirm precondition: the ghost user truly has no pending nudge
  const db = getSharedDb();
  const [existingNudge] = await db
    .select({ id: danielaAbsenceNudges.id })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, GHOST_USER_ID))
    .limit(1);

  assert('Precondition: ghost user has no nudge row in DB', !existingNudge,
    existingNudge ? `Found unexpected row: ${existingNudge.id}` : undefined);

  // Call the function under test with captured output
  startCapture();
  const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');
  await autoResolveAbsenceNudgeOnReturn(GHOST_USER_ID);
  stopCapture();

  // Restore for clean output from here on
  const logs = [...capturedLogs];

  // Primary assertion: the "[AbsenceWorker] Auto-cleared..." line must NOT appear
  const autoClearedLog = logs.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    'No "[AbsenceWorker] Auto-cleared..." log emitted for student with no nudge',
    !autoClearedLog,
    autoClearedLog,
  );

  // Express Lane post must NOT appear in logs
  const expressLaneLog = logs.find(l => l.includes('[STUDENT RETURNED]'));
  assert(
    'No "[STUDENT RETURNED]" Express Lane note posted',
    !expressLaneLog,
    expressLaneLog,
  );

  // No warning about a failed Express Lane post either — that would mean it tried
  const expressLaneFailed = logs.find(l => l.includes('Failed to post return note'));
  assert(
    'No "Failed to post return note" warning (function would not have attempted it)',
    !expressLaneFailed,
    expressLaneFailed,
  );

  // No resolve log either
  const resolveLog = logs.find(l => l.includes('[AbsenceWorker] Nudge resolved'));
  assert(
    'No "Nudge resolved" log (resolveAbsenceNudge was not called)',
    !resolveLog,
    resolveLog,
  );

  // Confirm the ghost user still has no nudge row after the call
  const [afterNudge] = await db
    .select({ id: danielaAbsenceNudges.id })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, GHOST_USER_ID))
    .limit(1);

  assert('No nudge row created in DB (function wrote nothing)', !afterNudge,
    afterNudge ? `Unexpected row after call: ${afterNudge.id}` : undefined);

  if (logs.length > 0) {
    console.log(Y(`\n  ℹ  Captured output (${logs.length} line(s)):`));
    logs.forEach(l => console.log(`     ${l}`));
  } else {
    console.log(G('\n  ℹ  No output captured — function was completely silent (expected).'));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Structural guard review (static, no DB needed)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Structural guard review (source-level check)'));
sep();

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

function runPart2() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = dirname(__filename);
  const src = readFileSync(
    resolve(__dirname, '../services/daniela-absence-worker.ts'),
    'utf-8',
  );

  // The guard line must exist: `if (!pending) return null;`
  const hasGuard = /if\s*\(\s*!pending\s*\)\s*return\s+null\s*;/.test(src);
  assert(
    'Source contains `if (!pending) return null;` guard before any side-effects',
    hasGuard,
  );

  // The Express Lane post block must be INSIDE the `if (pending)` branch —
  // i.e., it appears AFTER the guard.  Simplest check: guard offset < post offset.
  const guardIdx = src.search(/if\s*\(\s*!pending\s*\)\s*return\s+null\s*;/);
  const expressLaneIdx = src.indexOf('STUDENT RETURNED');
  assert(
    'Express Lane post code appears after the guard (cannot be reached when no nudge)',
    guardIdx !== -1 && expressLaneIdx !== -1 && guardIdx < expressLaneIdx,
    `guardIdx=${guardIdx}, expressLaneIdx=${expressLaneIdx}`,
  );

  // `resolveAbsenceNudge` call also appears after the guard
  const resolveIdx = src.indexOf('await resolveAbsenceNudge(userId');
  assert(
    '`resolveAbsenceNudge` call appears after the guard',
    guardIdx !== -1 && resolveIdx !== -1 && guardIdx < resolveIdx,
    `guardIdx=${guardIdx}, resolveIdx=${resolveIdx}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Positive path: pending nudge exists → resolves it, logs it
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Positive path: nudge IS pending → gets cleared and logged'));
sep();

// Separate deterministic userId — guaranteed to have a seeded row for this test
const TEST_RETURN_USER_ID = '00000000-test-has-nudge-0000';

async function runPart3() {
  const db = getSharedDb();

  // ── Cleanup helper: ensure no leftover row from a prior crashed run ─────────
  await db
    .delete(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_RETURN_USER_ID));

  // ── 1. Seed a pending nudge row ─────────────────────────────────────────────
  await db.insert(danielaAbsenceNudges).values({
    userId: TEST_RETURN_USER_ID,
    daysSinceLastSession: 7,
    lastSessionDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  });

  // Confirm it landed with resolvedAt = null
  const [seeded] = await db
    .select({ id: danielaAbsenceNudges.id, resolvedAt: danielaAbsenceNudges.resolvedAt })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_RETURN_USER_ID))
    .limit(1);

  assert('Precondition: seeded nudge row has resolvedAt = null', !!seeded && seeded.resolvedAt === null,
    seeded ? `resolvedAt was ${seeded.resolvedAt}` : 'row not found');

  // ── 2. Call the function under test with captured output ────────────────────
  const callStartedAt = new Date();
  startCapture();
  let result: Awaited<ReturnType<typeof import('../services/daniela-absence-worker').autoResolveAbsenceNudgeOnReturn>> | undefined;
  try {
    const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');
    result = await autoResolveAbsenceNudgeOnReturn(TEST_RETURN_USER_ID);
  } finally {
    stopCapture();
  }
  const logs = [...capturedLogs];

  // ── 3. Assert the DB row is now resolved ────────────────────────────────────
  const [after] = await db
    .select({
      id: danielaAbsenceNudges.id,
      resolvedAt: danielaAbsenceNudges.resolvedAt,
      resolutionType: danielaAbsenceNudges.resolutionType,
    })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_RETURN_USER_ID))
    .limit(1);

  assert(
    'DB row resolvedAt IS NOT NULL after autoResolveAbsenceNudgeOnReturn()',
    !!after && after.resolvedAt !== null,
    after ? `resolvedAt is still null` : 'row not found',
  );

  assert(
    'DB row resolutionType === "student_returned" (not "dismissed")',
    after?.resolutionType === 'student_returned',
    after ? `resolutionType was: ${after.resolutionType}` : 'row not found',
  );

  // ── 4. Assert the "[AbsenceWorker] Auto-cleared..." log was emitted ─────────
  const autoClearedLog = logs.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    '"[AbsenceWorker] Auto-cleared..." log was emitted',
    !!autoClearedLog,
    autoClearedLog ?? 'log line not found in captured output',
  );

  // ── 5. Assert Express Lane note IS persisted in collaboration_messages ───────
  // Query for a message written after the call started, whose metadata carries
  // the expected absentUserId and event tag that the worker embeds.
  const expressLaneMessages = await db
    .select({
      id: collaborationMessages.id,
      content: collaborationMessages.content,
      metadata: collaborationMessages.metadata,
    })
    .from(collaborationMessages)
    .where(
      and(
        gte(collaborationMessages.createdAt, callStartedAt),
        sql`${collaborationMessages.metadata}->>'absentUserId' = ${TEST_RETURN_USER_ID}`,
        sql`${collaborationMessages.metadata}->>'event' = 'student_returned'`,
      ),
    )
    .limit(5);

  assert(
    'Express Lane note persisted in collaboration_messages with correct absentUserId + event metadata',
    expressLaneMessages.length > 0,
    expressLaneMessages.length === 0 ? 'no matching row found in collaboration_messages' : undefined,
  );

  if (expressLaneMessages.length > 0) {
    const contentOk = expressLaneMessages[0].content.includes('[STUDENT RETURNED]');
    assert(
      'Express Lane note content contains "[STUDENT RETURNED]"',
      contentOk,
      contentOk ? undefined : `content was: ${expressLaneMessages[0].content.slice(0, 120)}`,
    );
  }

  // ── 6. Assert the function returned non-null details ───────────────────────
  assert(
    'Return value is non-null (details object returned)',
    result !== null && result !== undefined,
    result === null ? 'returned null' : String(result),
  );

  if (logs.length > 0) {
    console.log(Y(`\n  ℹ  Captured output (${logs.length} line(s)):`));
    logs.forEach(l => console.log(`     ${l}`));
  }

  // ── Cleanup: delete the test row ────────────────────────────────────────────
  await db
    .delete(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_RETURN_USER_ID));

  const [gone] = await db
    .select({ id: danielaAbsenceNudges.id })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_RETURN_USER_ID))
    .limit(1);

  assert('Test row cleaned up from DB', !gone, gone ? `Row still present: ${gone.id}` : undefined);
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

(async () => {
  try {
    await runPart1();
    runPart2();
    await runPart3();
  } catch (err: any) {
    stopCapture();
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    // Best-effort cleanup on crash
    try {
      const db = getSharedDb();
      await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_RETURN_USER_ID));
    } catch { /* ignore */ }
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed — no-op guard and positive return path both verified.\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
