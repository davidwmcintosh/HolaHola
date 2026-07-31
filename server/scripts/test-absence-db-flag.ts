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
const TEST_DAYS_ABSENT = 12;

// ── Seeded row trackers (for cleanup) ─────────────────────────────────────────
let seededVoiceSessionId: string | null = null;
let seededVoiceSessionId2: string | null = null;

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
    await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID));
    await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_2));
    await db.delete(users).where(eq(users.id, TEST_USER_ID));
    await db.delete(users).where(eq(users.id, TEST_USER_ID_2));
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
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main(): Promise<void> {
  console.log(D('\n  Pre-cleaning any leftover rows from a previous run…'));
  await cleanup();

  try {
    await part1();
    await part2();
    await part3();
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
    console.log(D('   4. A second call within the TTL is cached; double-write is idempotent\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${total} assertion(s) failed — review output above.\n`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(R(`\nFatal error: ${err?.message ?? err}\n`));
  cleanup().finally(() => process.exit(1));
});
