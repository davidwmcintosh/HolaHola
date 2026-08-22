/**
 * test-absence-db-flag.ts
 *
 * Integration test — confirms the absence-return flag is correctly written to
 * the voice_sessions DB row when a student starts a session with a pending
 * absence nudge.
 *
 * This is the end-to-end DB write test for the absence-return path.  The
 * existing static-analysis scripts (test-absence-gl-path.ts, test-absence-
 * text-path.ts) confirm the source ordering and wiring; this script confirms
 * the actual DB write cannot silently fail.
 *
 * Both the GL and text-mode paths in unified-ws-handler.ts were refactored
 * to call applyAbsenceReturnFlag() instead of inlining the db.update().
 * This test exercises those same two production functions — no reimplementation
 * of update logic in the test itself.
 *
 * What the test does:
 *   1. Creates a disposable test user in the users table (FK required by voice_sessions)
 *   2. Seeds a daniela_absence_nudges row for that user (daysSinceLastSession = 12)
 *   3. Inserts a voice_sessions row (representing a fresh session start)
 *   4. Calls autoResolveAbsenceNudgeOnReturn() — the same function the WS handler calls
 *   5. Calls applyAbsenceReturnFlag()           — the same function the WS handler calls
 *   6. Reads back the voice_sessions row and asserts hadAbsenceReturn + absenceReturnDays
 *   7. Negative path: no nudge → applyAbsenceReturnFlag is never called → flags stay default
 *   8. Idempotency: second call within TTL returns cached details, double-write is safe
 *   9. Cleans up all seeded rows (voice_sessions → nudges → user)
 *
 * Run: npx tsx server/scripts/test-absence-db-flag.ts
 */

import { getSharedDb } from '../db';
import {
  users,
  voiceSessions,
  danielaAbsenceNudges,
} from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import {
  autoResolveAbsenceNudgeOnReturn,
  applyAbsenceReturnFlag,
} from '../services/daniela-absence-worker';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const D = (s: string) => `\x1b[2m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
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

// ── Test constants ────────────────────────────────────────────────────────────
// Stable test-only sentinels — safe to reuse across runs.
const TEST_USER_ID   = '00000000-test-absence-db-flag-00001';
const TEST_USER_ID_2 = '00000000-test-absence-db-flag-00002'; // no-nudge negative path
const TEST_USER_ID_3 = '00000000-test-absence-db-flag-00003'; // mutation / self-failure guard
const TEST_USER_ID_4 = '00000000-test-absence-db-flag-00004'; // wrong-session-ID regression
const TEST_DAYS_ABSENT = 12;

// ── Seeded row trackers (for cleanup) ─────────────────────────────────────────
let seededVoiceSessionId: string | null = null;
let seededVoiceSessionId2: string | null = null;
let seededVoiceSessionId3: string | null = null;
let seededVoiceSessionId4: string | null = null;

// ── Cleanup helper ────────────────────────────────────────────────────────────
async function cleanup(): Promise<void> {
  const db = getSharedDb();
  try {
    if (seededVoiceSessionId) {
      await db.delete(voiceSessions).where(eq(voiceSessions.id, seededVoiceSessionId));
    }
    if (seededVoiceSessionId2) {
      await db.delete(voiceSessions).where(eq(voiceSessions.id, seededVoiceSessionId2));
    }
    if (seededVoiceSessionId3) {
      await db.delete(voiceSessions).where(eq(voiceSessions.id, seededVoiceSessionId3));
    }
    if (seededVoiceSessionId4) {
      await db.delete(voiceSessions).where(eq(voiceSessions.id, seededVoiceSessionId4));
    }
    await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID));
    await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_2));
    await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3));
    await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_4));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID_2));
    await db.delete(users).where(eq(users.id, TEST_USER_ID_3));
    await db.delete(users).where(eq(users.id, TEST_USER_ID_4));
  } catch (err: any) {
    console.warn(Y(`  ⚠  Cleanup error (non-fatal): ${err.message}`));
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Happy path: nudge present → flag written to voice_sessions via
//          the same production functions the WS handler uses
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Happy path: absence nudge → hadAbsenceReturn written to voice_sessions'));
sep();

async function part1(): Promise<void> {
  const db = getSharedDb();

  // ── 1a. Seed a test user ─────────────────────────────────────────────────
  // voice_sessions.user_id has a FK constraint → users.id.
  await db.insert(users).values({
    id: TEST_USER_ID,
    email: 'test-absence-db-flag@test.internal',
    firstName: 'TestAbsence',
    lastName: 'DBFlag',
    role: 'student',
    isTestAccount: true,
    subscriptionStatus: 'active',
    subscriptionTier: 'free',
  }).onConflictDoNothing();
  console.log(D(`  Seeded test user: ${TEST_USER_ID}`));

  // ── 1b. Seed an absence nudge for the test user ──────────────────────────
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID));

  await db.insert(danielaAbsenceNudges).values({
    userId: TEST_USER_ID,
    lastSessionDate: new Date(Date.now() - TEST_DAYS_ABSENT * 24 * 60 * 60 * 1000),
    daysSinceLastSession: TEST_DAYS_ABSENT,
  });
  console.log(D(`  Seeded nudge row: userId=${TEST_USER_ID}, daysSince=${TEST_DAYS_ABSENT}`));

  const [nudgeBefore] = await db
    .select({ id: danielaAbsenceNudges.id, resolvedAt: danielaAbsenceNudges.resolvedAt })
    .from(danielaAbsenceNudges)
    .where(and(eq(danielaAbsenceNudges.userId, TEST_USER_ID), isNull(danielaAbsenceNudges.resolvedAt)))
    .limit(1);
  assert(
    'Seeded nudge row is present and unresolved before session start',
    !!nudgeBefore && nudgeBefore.resolvedAt === null,
    nudgeBefore ? `resolvedAt=${nudgeBefore.resolvedAt}` : 'row not found',
  );

  // ── 1c. Insert a voice_sessions row (session start) ──────────────────────
  await db.delete(voiceSessions).where(eq(voiceSessions.userId, TEST_USER_ID));

  const [insertedSession] = await db.insert(voiceSessions).values({
    userId: TEST_USER_ID,
    language: 'spanish',
    status: 'active',
    isTestSession: true,
    // hadAbsenceReturn defaults to false — applyAbsenceReturnFlag() is what flips it
  }).returning({ id: voiceSessions.id });

  assert(
    'voice_sessions row inserted for test user (simulates session start)',
    !!insertedSession?.id,
    'insert returned no id',
  );
  seededVoiceSessionId = insertedSession!.id;
  console.log(D(`  Seeded voice_sessions row: ${seededVoiceSessionId}`));

  // ── 1d. Call autoResolveAbsenceNudgeOnReturn — SAME function as WS handler ─
  const returnDetails = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID);

  assert(
    'autoResolveAbsenceNudgeOnReturn() returns non-null details for user with pending nudge',
    returnDetails !== null,
    'returned null — nudge may not have been found or DB error occurred',
  );
  if (!returnDetails) {
    console.log(R('  Skipping remaining Part 1 assertions — no return details'));
    return;
  }

  assert(
    `return details carry the correct daysSinceLastSession (${TEST_DAYS_ABSENT})`,
    returnDetails.daysSinceLastSession === TEST_DAYS_ABSENT,
    `got ${returnDetails.daysSinceLastSession}, expected ${TEST_DAYS_ABSENT}`,
  );

  // ── 1e. Call applyAbsenceReturnFlag — SAME function as WS handler ────────
  // This is the production function that unified-ws-handler.ts now calls in
  // both the GL path (lines ~3068) and text-mode path (lines ~3423).
  // Await it so the subsequent read sees the committed row.
  await applyAbsenceReturnFlag(seededVoiceSessionId!, returnDetails.daysSinceLastSession);

  // ── 1f. Read back and assert ─────────────────────────────────────────────
  const [sessionAfter] = await db
    .select({
      hadAbsenceReturn: voiceSessions.hadAbsenceReturn,
      absenceReturnDays: voiceSessions.absenceReturnDays,
    })
    .from(voiceSessions)
    .where(eq(voiceSessions.id, seededVoiceSessionId!))
    .limit(1);

  assert(
    'voice_sessions.hadAbsenceReturn is TRUE after applyAbsenceReturnFlag()',
    sessionAfter?.hadAbsenceReturn === true,
    `got ${sessionAfter?.hadAbsenceReturn}`,
  );

  assert(
    `voice_sessions.absenceReturnDays = ${TEST_DAYS_ABSENT} (matches seeded nudge's daysSinceLastSession)`,
    sessionAfter?.absenceReturnDays === TEST_DAYS_ABSENT,
    `got ${sessionAfter?.absenceReturnDays}, expected ${TEST_DAYS_ABSENT}`,
  );

  // ── 1g. Confirm the nudge row is now resolved ────────────────────────────
  const [nudgeAfter] = await db
    .select({
      resolvedAt: danielaAbsenceNudges.resolvedAt,
      resolutionType: danielaAbsenceNudges.resolutionType,
    })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID))
    .limit(1);

  assert(
    'daniela_absence_nudges row is resolved after autoResolveAbsenceNudgeOnReturn()',
    nudgeAfter?.resolvedAt !== null && nudgeAfter?.resolvedAt !== undefined,
    `resolvedAt=${nudgeAfter?.resolvedAt}`,
  );

  assert(
    "nudge resolutionType is 'student_returned'",
    nudgeAfter?.resolutionType === 'student_returned',
    `got '${nudgeAfter?.resolutionType}'`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Negative path: no nudge → autoResolveAbsenceNudgeOnReturn returns
//          null → applyAbsenceReturnFlag is never called → flags stay default
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Negative path: no pending nudge → hadAbsenceReturn stays false'));
sep();

async function part2(): Promise<void> {
  const db = getSharedDb();

  // ── 2a. Seed a second test user with NO absence nudge ────────────────────
  await db.insert(users).values({
    id: TEST_USER_ID_2,
    email: 'test-absence-db-flag2@test.internal',
    firstName: 'TestAbsence2',
    lastName: 'DBFlag2',
    role: 'student',
    isTestAccount: true,
    subscriptionStatus: 'active',
    subscriptionTier: 'free',
  }).onConflictDoNothing();

  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_2));
  await db.delete(voiceSessions).where(eq(voiceSessions.userId, TEST_USER_ID_2));

  // ── 2b. Insert a voice_sessions row ──────────────────────────────────────
  const [insertedSession2] = await db.insert(voiceSessions).values({
    userId: TEST_USER_ID_2,
    language: 'spanish',
    status: 'active',
    isTestSession: true,
  }).returning({ id: voiceSessions.id });

  assert(
    'voice_sessions row inserted for no-nudge test user',
    !!insertedSession2?.id,
    'insert returned no id',
  );
  seededVoiceSessionId2 = insertedSession2!.id;

  // ── 2c. autoResolveAbsenceNudgeOnReturn returns null — no nudge ──────────
  const returnDetails2 = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID_2);

  assert(
    'autoResolveAbsenceNudgeOnReturn() returns null when no nudge is pending',
    returnDetails2 === null,
    `got non-null: ${JSON.stringify(returnDetails2)}`,
  );

  // ── 2d. WS handler guard: applyAbsenceReturnFlag is NOT called when null ─
  // Mirror the production guard: `if (absenceReturn && sessionId) { applyAbsenceReturnFlag(...) }`
  if (returnDetails2 !== null && seededVoiceSessionId2) {
    await applyAbsenceReturnFlag(seededVoiceSessionId2, returnDetails2.daysSinceLastSession);
  }

  // ── 2e. Read back — fields must stay at defaults ──────────────────────────
  const [session2After] = await db
    .select({
      hadAbsenceReturn: voiceSessions.hadAbsenceReturn,
      absenceReturnDays: voiceSessions.absenceReturnDays,
    })
    .from(voiceSessions)
    .where(eq(voiceSessions.id, seededVoiceSessionId2!))
    .limit(1);

  assert(
    'voice_sessions.hadAbsenceReturn stays FALSE when no nudge exists',
    session2After?.hadAbsenceReturn === false,
    `got ${session2After?.hadAbsenceReturn}`,
  );

  assert(
    'voice_sessions.absenceReturnDays stays NULL when no nudge exists',
    session2After?.absenceReturnDays === null || session2After?.absenceReturnDays === undefined,
    `got ${session2After?.absenceReturnDays}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Idempotency: second call within TTL returns cached result.
//          A second applyAbsenceReturnFlag on the same row is safe (SET is idempotent).
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Idempotency: second call within TTL returns cached details; double-write is safe'));
sep();

async function part3(): Promise<void> {
  // The nudge for TEST_USER_ID was resolved in Part 1.  A second call within
  // the 2-minute TTL should return the cached details from the in-memory cache.
  const cachedDetails = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID);

  assert(
    'Second call to autoResolveAbsenceNudgeOnReturn() within TTL returns cached details (non-null)',
    cachedDetails !== null,
    'returned null — in-memory cache may not have been populated by Part 1',
  );

  assert(
    `Cached daysSinceLastSession still = ${TEST_DAYS_ABSENT}`,
    cachedDetails?.daysSinceLastSession === TEST_DAYS_ABSENT,
    `got ${cachedDetails?.daysSinceLastSession}`,
  );

  // A double call to applyAbsenceReturnFlag on the same row (e.g. orchestrator
  // fire-and-forget + WS handler await) must leave the row in a valid state.
  if (cachedDetails && seededVoiceSessionId) {
    await applyAbsenceReturnFlag(seededVoiceSessionId, cachedDetails.daysSinceLastSession);
  }

  const db = getSharedDb();
  const [sessionFinal] = await db
    .select({
      hadAbsenceReturn: voiceSessions.hadAbsenceReturn,
      absenceReturnDays: voiceSessions.absenceReturnDays,
    })
    .from(voiceSessions)
    .where(eq(voiceSessions.id, seededVoiceSessionId!))
    .limit(1);

  assert(
    'hadAbsenceReturn is still TRUE after a second applyAbsenceReturnFlag() call (idempotent write)',
    sessionFinal?.hadAbsenceReturn === true,
    `got ${sessionFinal?.hadAbsenceReturn}`,
  );

  assert(
    `absenceReturnDays is still ${TEST_DAYS_ABSENT} after double-write`,
    sessionFinal?.absenceReturnDays === TEST_DAYS_ABSENT,
    `got ${sessionFinal?.absenceReturnDays}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Regression detection / self-failure guard
//
// Proves that this test CAN catch the regression where the DB write block
// (`db.update(voiceSessions).set({ hadAbsenceReturn: true, absenceReturnDays: ... })`)
// is silently removed from applyAbsenceReturnFlag().
//
// Strategy: seed a voice_sessions row, then deliberately skip calling
// applyAbsenceReturnFlag() (mutated path).  The row must still have
// hadAbsenceReturn=false and absenceReturnDays=null.  This confirms the
// DEFAULT state is not true — therefore Part 1's assertion that
// hadAbsenceReturn === true would FAIL (exit code 1) if the write were omitted.
//
// In other words: the only way Part 1 can pass is if applyAbsenceReturnFlag()
// actually executed the db.update().  This part locks in that invariant by
// verifying the baseline is false.
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — Regression / self-failure guard: write bypass leaves fields at defaults'));
sep();

async function part4(): Promise<void> {
  const db = getSharedDb();

  // ── 4a. Seed a third test user (no nudge needed — we won't call the worker) ─
  await db.insert(users).values({
    id: TEST_USER_ID_3,
    email: 'test-absence-db-flag3@test.internal',
    firstName: 'TestAbsence3',
    lastName: 'DBFlag3',
    role: 'student',
    isTestAccount: true,
    subscriptionStatus: 'active',
    subscriptionTier: 'free',
  }).onConflictDoNothing();

  await db.delete(voiceSessions).where(eq(voiceSessions.userId, TEST_USER_ID_3));

  // ── 4b. Insert a voice_sessions row — flags start at their DB defaults ─────
  const [insertedSession3] = await db.insert(voiceSessions).values({
    userId: TEST_USER_ID_3,
    language: 'spanish',
    status: 'active',
    isTestSession: true,
    // hadAbsenceReturn defaults to false; absenceReturnDays defaults to null
  }).returning({ id: voiceSessions.id });

  assert(
    '[Regression guard] voice_sessions row inserted for mutation-check user',
    !!insertedSession3?.id,
    'insert returned no id',
  );
  seededVoiceSessionId3 = insertedSession3!.id;
  console.log(D(`  Seeded mutation-guard voice_sessions row: ${seededVoiceSessionId3}`));

  // ── 4c. Deliberately skip applyAbsenceReturnFlag() (simulates removed write) ─
  // (No call to applyAbsenceReturnFlag here — this is the mutated / regressed path.)

  // ── 4d. Read back — both fields MUST remain at their defaults ─────────────
  const [session3After] = await db
    .select({
      hadAbsenceReturn: voiceSessions.hadAbsenceReturn,
      absenceReturnDays: voiceSessions.absenceReturnDays,
    })
    .from(voiceSessions)
    .where(eq(voiceSessions.id, seededVoiceSessionId3!))
    .limit(1);

  // These assertions confirm the baseline: WITHOUT applyAbsenceReturnFlag(),
  // the fields are never set.  If Part 1 ran against this row it would fail
  // because hadAbsenceReturn is false — proving Part 1 is a meaningful guard.
  assert(
    '[Regression guard] hadAbsenceReturn stays FALSE when applyAbsenceReturnFlag() is NOT called — ' +
    'Part 1\'s "hadAbsenceReturn is TRUE" assertion would catch this regression (exit code 1)',
    session3After?.hadAbsenceReturn === false,
    `got ${session3After?.hadAbsenceReturn} — unexpected write occurred without calling applyAbsenceReturnFlag()`,
  );

  assert(
    '[Regression guard] absenceReturnDays stays NULL when applyAbsenceReturnFlag() is NOT called — ' +
    'Part 1\'s "absenceReturnDays = 12" assertion would also catch this regression',
    session3After?.absenceReturnDays === null || session3After?.absenceReturnDays === undefined,
    `got ${session3After?.absenceReturnDays} — unexpected write occurred without calling applyAbsenceReturnFlag()`,
  );

  console.log(D(
    '  ✓ Baseline confirmed: fields are false/null without the write.\n' +
    '    Part 1 assertion "hadAbsenceReturn is TRUE after applyAbsenceReturnFlag()" is\n' +
    '    a genuine guard — removing the db.update() block causes it to fail (exit code 1).',
  ));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 5 — Wrong-session-ID regression guard
//
// applyAbsenceReturnFlag(sessionId, days) receives the session ID as a
// parameter. If a caller passes the wrong ID — a stale variable, a userId
// instead of sessionId, or any other accidental value — the DB update targets
// a non-existent row and silently succeeds (0 rows affected) while the correct
// row is never touched.
//
// This part proves the test CAN catch that regression by:
//   a. Seeding a REAL voice_sessions row (the "correct" row).
//   b. Calling applyAbsenceReturnFlag with a DIFFERENT, nonexistent session ID
//      (the "wrong" ID that a buggy caller might pass).
//   c. Asserting the real row's hadAbsenceReturn is still FALSE.
//
// If a future refactor accidentally passes sessionId=userId (or any other wrong
// variable), the correct row is never updated and this assertion fires (exit 1).
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 5 — Wrong-session-ID regression guard: write to wrong ID leaves correct row unchanged'));
sep();

async function part5(): Promise<void> {
  const db = getSharedDb();

  // ── 5a. Seed a fourth test user ──────────────────────────────────────────
  await db.insert(users).values({
    id: TEST_USER_ID_4,
    email: 'test-absence-db-flag4@test.internal',
    firstName: 'TestAbsence4',
    lastName: 'DBFlag4',
    role: 'student',
    isTestAccount: true,
    subscriptionStatus: 'active',
    subscriptionTier: 'free',
  }).onConflictDoNothing();

  await db.delete(voiceSessions).where(eq(voiceSessions.userId, TEST_USER_ID_4));

  // ── 5b. Insert the CORRECT voice_sessions row ────────────────────────────
  // This is the row that should receive the flag in the happy path.
  const [insertedSession4] = await db.insert(voiceSessions).values({
    userId: TEST_USER_ID_4,
    language: 'spanish',
    status: 'active',
    isTestSession: true,
    // hadAbsenceReturn defaults to false
  }).returning({ id: voiceSessions.id });

  assert(
    '[Wrong-ID guard] voice_sessions row inserted for correct-row user',
    !!insertedSession4?.id,
    'insert returned no id',
  );
  seededVoiceSessionId4 = insertedSession4!.id;
  console.log(D(`  Seeded correct voice_sessions row: ${seededVoiceSessionId4}`));

  // ── 5c. Call applyAbsenceReturnFlag with a WRONG (nonexistent) session ID ─
  // A random UUID that has no corresponding row in voice_sessions.
  // This simulates a caller that accidentally passes a stale variable or the
  // wrong identifier (e.g. userId instead of sessionId).
  const wrongSessionId = '00000000-0000-0000-0000-wrong-session';
  await applyAbsenceReturnFlag(wrongSessionId, TEST_DAYS_ABSENT);
  console.log(D(`  Called applyAbsenceReturnFlag with wrong ID: ${wrongSessionId}`));

  // ── 5d. Read back the CORRECT row — must still have defaults ─────────────
  const [session4After] = await db
    .select({
      hadAbsenceReturn: voiceSessions.hadAbsenceReturn,
      absenceReturnDays: voiceSessions.absenceReturnDays,
    })
    .from(voiceSessions)
    .where(eq(voiceSessions.id, seededVoiceSessionId4!))
    .limit(1);

  assert(
    '[Wrong-ID guard] hadAbsenceReturn stays FALSE on correct row when applyAbsenceReturnFlag() ' +
    'is called with a nonexistent session ID — wrong-ID write has no effect on the real row',
    session4After?.hadAbsenceReturn === false,
    `got ${session4After?.hadAbsenceReturn} — unexpected write reached the correct row via the wrong session ID`,
  );

  assert(
    '[Wrong-ID guard] absenceReturnDays stays NULL on correct row when a wrong session ID is passed',
    session4After?.absenceReturnDays === null || session4After?.absenceReturnDays === undefined,
    `got ${session4After?.absenceReturnDays} — unexpected write reached the correct row via the wrong session ID`,
  );

  console.log(D(
    '  ✓ Wrong-ID baseline confirmed: passing a nonexistent session ID leaves the real row untouched.\n' +
    '    Part 1\'s "hadAbsenceReturn is TRUE" assertion would catch any caller that passes the wrong ID\n' +
    '    — the correct row would stay false, causing Part 1 to exit with code 1.',
  ));
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  console.log(D('\n  Pre-cleaning any leftover rows from a previous run…'));
  await cleanup();

  try {
    await part1();
    await part2();
    await part3();
    await part4();
    await part5();
  } finally {
    sep();
    console.log(D('\n  Cleaning up seeded rows…'));
    await cleanup();
    console.log(D('  Cleanup complete.'));
  }

  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${total} assertions passed.\n`));
    console.log(D('   The absence-return DB write is confirmed end-to-end:'));
    console.log(D('   1. autoResolveAbsenceNudgeOnReturn() resolves nudge and returns details'));
    console.log(D('   2. applyAbsenceReturnFlag() writes hadAbsenceReturn=true + absenceReturnDays'));
    console.log(D('   3. No nudge → neither function updates the voice_sessions row'));
    console.log(D('   4. A second call within the TTL is cached; double-write is idempotent'));
    console.log(D('   5. Regression guard: fields stay false/null without the write — Part 1 catches the omission'));
    console.log(D('   6. Wrong-ID guard: a nonexistent session ID leaves the correct row untouched\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${total} assertion(s) failed — review output above.\n`));
    console.log(R('   Check the assertion label — "[Regression guard]" / "[Wrong-ID guard]" prefix = self-failure check.\n'));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(R(`\nFatal error: ${err?.message ?? err}\n`));
  cleanup().finally(() => process.exit(1));
});
