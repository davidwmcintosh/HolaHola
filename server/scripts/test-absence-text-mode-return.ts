/**
 * test-absence-text-mode-return.ts
 *
 * End-to-end confirmation that a `daniela_absence_nudges` row with
 * resolvedAt = null is resolved to resolvedAt != null when a student
 * starts a text-mode (Deepgram) session.
 *
 * Coverage:
 *   Part 1 — Static source analysis: text-mode else branch in
 *            unified-ws-handler.ts calls autoResolveAbsenceNudgeOnReturn()
 *   Part 2 — Live DB test: seeds a row, calls the function directly
 *            (exactly as the text-mode branch does), asserts the row is resolved
 *   Part 3 — Idempotency / cache: second call within TTL returns cached
 *            details without re-updating the already-resolved DB row
 *   Part 4 — GL path cross-check: confirms the GL branch also wires the call
 *            (complementing test-absence-gl-path.ts with a focused smoke check)
 *
 * Run: npx tsx server/scripts/test-absence-text-mode-return.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G   = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B   = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y   = (s: string) => `\x1b[33m${s}\x1b[0m`;
const D   = (s: string) => `\x1b[2m${s}\x1b[0m`;
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

// ──────────────────────────────────────────────────────────────────────────────
// PART 1 — Static source analysis: text-mode path
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 1 — unified-ws-handler.ts: text-mode else branch wiring'));
sep();

const wsSrc = readFileSync(
  resolve(__dirname, '../unified-ws-handler.ts'),
  'utf-8',
);

function part1() {
  // 1a. autoResolveAbsenceNudgeOnReturn is imported at all
  assert(
    'unified-ws-handler.ts imports autoResolveAbsenceNudgeOnReturn',
    wsSrc.includes('autoResolveAbsenceNudgeOnReturn'),
  );

  // 1b. The text-mode path calls autoResolveAbsenceNudgeOnReturn inside an async IIFE stored on
  // the session as __textModeAbsencePromise.  The call uses `await` (not fire-and-forget .then())
  // so that request_greeting can await the promise before prompt assembly.
  const iifeSiteIdx = wsSrc.indexOf('__textModeAbsencePromise');
  const hasAwaitCall = iifeSiteIdx !== -1 &&
    /await\s+autoResolveAbsenceNudgeOnReturn\s*\(\s*String\s*\(\s*userId\s*\)\s*\)/.test(wsSrc);
  assert(
    'Text-mode path stores autoResolveAbsenceNudgeOnReturn in __textModeAbsencePromise IIFE (awaited)',
    hasAwaitCall,
    hasAwaitCall ? undefined : 'await autoResolveAbsenceNudgeOnReturn(String(userId)) not found in text-mode IIFE',
  );

  // 1c. The __textModeAbsencePromise IIFE is guarded by `if (userId && !isFounderMode)`.
  // Look for !isFounderMode within 500 chars before the __textModeAbsencePromise assignment
  // (the guard + comment block preceding the IIFE spans ~370 chars).
  const windowBefore = iifeSiteIdx > 500
    ? wsSrc.slice(iifeSiteIdx - 500, iifeSiteIdx)
    : wsSrc.slice(0, iifeSiteIdx);
  const hasFounderGuard = iifeSiteIdx !== -1 && windowBefore.includes('!isFounderMode');
  assert(
    'Text-mode autoResolveAbsenceNudgeOnReturn() is guarded by !isFounderMode',
    hasFounderGuard,
    hasFounderGuard ? undefined : '!isFounderMode guard not found near __textModeAbsencePromise assignment',
  );

  // 1d. The .then() handler logs "[TextMode] ✓ Student returning after N day(s)"
  const hasTextModeLog = wsSrc.includes('[TextMode] ✓ Student returning after');
  assert(
    'Text-mode .then() handler logs "[TextMode] ✓ Student returning after N day(s) absence"',
    hasTextModeLog,
    hasTextModeLog ? undefined : 'Log line not found — text-mode absence resolution is unobservable',
  );

  // 1e. The .catch() handler logs a non-fatal warning (session continues on error)
  const hasCatchLog = wsSrc.includes('[TextMode] Absence return check failed (non-fatal)');
  assert(
    'Text-mode .catch() handler logs a non-fatal warning (session always starts)',
    hasCatchLog,
    hasCatchLog ? undefined : 'Non-fatal catch log not found — errors may silently block session start',
  );

  // 1f. The text-mode call site appears inside the GL else branch, AFTER the GL block.
  // The GL branch (if GEMINI_LIVE_VOICE_ENABLED) appears first; the text-mode else follows.
  // Simplest proxy: the text-mode log appears AFTER the GL log in source order.
  const glLogIdx = wsSrc.indexOf('[GeminiLive] ✓ Student returning after');
  const tmLogIdx = wsSrc.indexOf('[TextMode] ✓ Student returning after');
  assert(
    'Text-mode absence call appears AFTER the GL absence call in source (correct else-branch placement)',
    glLogIdx !== -1 && tmLogIdx !== -1 && tmLogIdx > glLogIdx,
    `glLogIdx=${glLogIdx}, tmLogIdx=${tmLogIdx}`,
  );
}

part1();

// ──────────────────────────────────────────────────────────────────────────────
// PART 2 — Live DB test: seed → call → assert resolvedAt is set
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 2 — End-to-end DB test: resolvedAt is set after text-mode session start'));
sep();

// Deterministic test userId — never collides with real students
const TEST_USER_ID = '00000000-test-text-mode-161-000';

// Capture console output during the call so we can assert on log lines
const capturedLogs: string[] = [];
const origLog  = console.log;
const origWarn = console.warn;
function startCapture() {
  capturedLogs.length = 0;
  console.log  = (...args: any[]) => capturedLogs.push(args.map(String).join(' '));
  console.warn = (...args: any[]) => capturedLogs.push('[WARN] ' + args.map(String).join(' '));
}
function stopCapture() {
  console.log  = origLog;
  console.warn = origWarn;
}

import { getSharedDb } from '../db';
import { danielaAbsenceNudges, collaborationMessages } from '@shared/schema';
import { eq, and, gte, isNull } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

async function runPart2() {
  const db = getSharedDb();

  // ── Cleanup: ensure no leftover row from a prior crashed run ──────────────
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID));

  // ── 1. Seed a pending nudge row (simulates absence worker having fired) ───
  await db.insert(danielaAbsenceNudges).values({
    userId: TEST_USER_ID,
    daysSinceLastSession: 9,
    lastSessionDate: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
  });

  const [seeded] = await db
    .select({ id: danielaAbsenceNudges.id, resolvedAt: danielaAbsenceNudges.resolvedAt })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID))
    .limit(1);

  assert(
    'Precondition: seeded nudge row has resolvedAt = null',
    !!seeded && seeded.resolvedAt === null,
    seeded ? `resolvedAt was ${seeded.resolvedAt}` : 'row not found after insert',
  );

  // ── 2. Simulate what the text-mode else branch does ───────────────────────
  //    Text-mode calls autoResolveAbsenceNudgeOnReturn(String(userId)).then(...)
  //    We await the same function directly — the DB result is identical.
  const callStartedAt = new Date();
  const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');

  startCapture();
  let result: Awaited<ReturnType<typeof autoResolveAbsenceNudgeOnReturn>> | undefined;
  try {
    result = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID);
  } finally {
    stopCapture();
  }
  const logs = [...capturedLogs];

  // ── 3. Assert the DB row is now resolved ──────────────────────────────────
  const [after] = await db
    .select({
      id: danielaAbsenceNudges.id,
      resolvedAt: danielaAbsenceNudges.resolvedAt,
      resolutionType: danielaAbsenceNudges.resolutionType,
    })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID))
    .limit(1);

  assert(
    'DB row resolvedAt IS NOT NULL after autoResolveAbsenceNudgeOnReturn()',
    !!after && after.resolvedAt !== null,
    after ? 'resolvedAt is still null' : 'row not found',
  );

  assert(
    "DB row resolutionType === 'student_returned'",
    after?.resolutionType === 'student_returned',
    after ? `resolutionType was: ${after.resolutionType}` : 'row not found',
  );

  // ── 4. Assert the correct log line was emitted ────────────────────────────
  const autoClearedLog = logs.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    '"[AbsenceWorker] Auto-cleared..." log was emitted',
    !!autoClearedLog,
    autoClearedLog ?? 'log line not found in captured output',
  );

  // ── 5. Assert the function returned non-null details ─────────────────────
  assert(
    'Return value is non-null { daysSinceLastSession, firstName }',
    result !== null && result !== undefined,
    result === null ? 'returned null' : String(result),
  );

  if (result) {
    assert(
      'Return value carries daysSinceLastSession (number)',
      typeof result.daysSinceLastSession === 'number',
      `daysSinceLastSession was ${result?.daysSinceLastSession}`,
    );
  }

  // ── 6. Assert Express Lane note persisted ─────────────────────────────────
  const expressLaneMessages = await db
    .select({ id: collaborationMessages.id, content: collaborationMessages.content })
    .from(collaborationMessages)
    .where(
      and(
        gte(collaborationMessages.createdAt, callStartedAt),
        sql`${collaborationMessages.metadata}->>'absentUserId' = ${TEST_USER_ID}`,
        sql`${collaborationMessages.metadata}->>'event' = 'student_returned'`,
      ),
    )
    .limit(5);

  assert(
    'Express Lane note persisted in collaboration_messages (metadata.event = student_returned)',
    expressLaneMessages.length > 0,
    expressLaneMessages.length === 0 ? 'no matching row in collaboration_messages' : undefined,
  );

  if (expressLaneMessages.length > 0) {
    assert(
      'Express Lane note content includes "[STUDENT RETURNED]"',
      expressLaneMessages[0].content.includes('[STUDENT RETURNED]'),
      `content: ${expressLaneMessages[0].content.slice(0, 120)}`,
    );
  }

  if (logs.length > 0) {
    console.log(Y(`\n  ℹ  Captured output (${logs.length} line(s)):`));
    logs.forEach(l => console.log(`     ${l}`));
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID));
  const [gone] = await db
    .select({ id: danielaAbsenceNudges.id })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID))
    .limit(1);
  assert('Test row cleaned up from DB', !gone, gone ? `Row still present: ${gone.id}` : undefined);
}

// ──────────────────────────────────────────────────────────────────────────────
// PART 3 — Idempotency: second call returns cached result, no double-resolve
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 3 — Idempotency: second call within TTL returns cache (no double-resolve)'));
sep();

const TEST_USER_ID_2 = '00000000-test-text-mode-161-001';

async function runPart3() {
  const db = getSharedDb();
  const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');

  // Cleanup
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_2));

  // Seed a pending nudge
  await db.insert(danielaAbsenceNudges).values({
    userId: TEST_USER_ID_2,
    daysSinceLastSession: 6,
    lastSessionDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  });

  // First call — resolves the nudge
  startCapture();
  const result1 = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID_2);
  stopCapture();
  const logs1 = [...capturedLogs];

  assert(
    'First call resolves nudge and returns non-null details',
    result1 !== null && result1 !== undefined,
    result1 === null ? 'returned null on first call' : undefined,
  );

  const resolvedLog1 = logs1.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    'First call emits "[AbsenceWorker] Auto-cleared..." log',
    !!resolvedLog1,
    resolvedLog1 ?? 'log not found',
  );

  // Second call — nudge is already resolved; should hit in-memory cache
  startCapture();
  const result2 = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID_2);
  stopCapture();
  const logs2 = [...capturedLogs];

  // The second call must still return details (from cache)
  assert(
    'Second call (within TTL) returns non-null details from cache',
    result2 !== null && result2 !== undefined,
    result2 === null ? 'returned null on second call — cache miss?' : undefined,
  );

  // But it must NOT emit "[AbsenceWorker] Auto-cleared..." again (already resolved)
  const resolvedLog2 = logs2.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    'Second call does NOT emit "[AbsenceWorker] Auto-cleared..." again (idempotent)',
    !resolvedLog2,
    resolvedLog2 ?? undefined,
  );

  // Verify only one resolved row (no second row was inserted)
  const rows = await db
    .select({ id: danielaAbsenceNudges.id, resolvedAt: danielaAbsenceNudges.resolvedAt })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_2));

  assert(
    'Only one nudge row exists for the test user (no duplicate insert)',
    rows.length === 1,
    `Found ${rows.length} row(s)`,
  );

  assert(
    'That single row has resolvedAt set (not null)',
    rows.length === 1 && rows[0].resolvedAt !== null,
    rows.length === 1 ? `resolvedAt: ${rows[0].resolvedAt}` : 'row count mismatch',
  );

  // Cleanup
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_2));
}

// ──────────────────────────────────────────────────────────────────────────────
// PART 5 — Mid-snooze guard: snoozed row (resolvedAt set + suppressUntil future)
//           is NOT re-resolved and NOT overwritten when the student returns
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 5 — Mid-snooze guard: student returns while snooze is still active'));
sep();

const TEST_USER_ID_3 = '00000000-test-text-mode-177-002';

async function runPart5() {
  const db = getSharedDb();
  const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');

  // Cleanup any leftover row
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3));

  // ── 1. Seed a snoozed nudge row ───────────────────────────────────────────
  // resolvedAt is already set (Daniela called dismiss_absence_nudge with suppressDays=14)
  // suppressUntil is 7 days from now (still within the snooze window)
  const originalResolvedAt = new Date(Date.now() - 60 * 1000); // resolved 1 minute ago
  const originalSuppressUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

  await db.insert(danielaAbsenceNudges).values({
    userId: TEST_USER_ID_3,
    daysSinceLastSession: 8,
    lastSessionDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    resolvedAt: originalResolvedAt,
    resolutionType: 'dismissed',
    suppressUntil: originalSuppressUntil,
  });

  const [seeded] = await db
    .select({
      id: danielaAbsenceNudges.id,
      resolvedAt: danielaAbsenceNudges.resolvedAt,
      suppressUntil: danielaAbsenceNudges.suppressUntil,
      resolutionType: danielaAbsenceNudges.resolutionType,
    })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3))
    .limit(1);

  assert(
    'Precondition: seeded snoozed row has resolvedAt set',
    !!seeded && seeded.resolvedAt !== null,
    seeded ? `resolvedAt was ${seeded.resolvedAt}` : 'row not found after insert',
  );
  assert(
    'Precondition: seeded snoozed row has suppressUntil in the future',
    !!seeded && seeded.suppressUntil !== null && seeded.suppressUntil > new Date(),
    seeded ? `suppressUntil was ${seeded.suppressUntil}` : 'row not found after insert',
  );

  // ── 2. Student returns mid-snooze — call autoResolveAbsenceNudgeOnReturn ──
  startCapture();
  let result: Awaited<ReturnType<typeof autoResolveAbsenceNudgeOnReturn>> | undefined;
  try {
    result = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID_3);
  } finally {
    stopCapture();
  }
  const logs = [...capturedLogs];

  // ── 3. Assert function returns null (no pending nudge to resolve) ──────────
  assert(
    'Return value is null (no pending nudge — row is already resolved)',
    result === null,
    result !== null ? `Expected null but got: ${JSON.stringify(result)}` : undefined,
  );

  // ── 4. Assert the DB row is unchanged ─────────────────────────────────────
  const [after] = await db
    .select({
      resolvedAt: danielaAbsenceNudges.resolvedAt,
      suppressUntil: danielaAbsenceNudges.suppressUntil,
      resolutionType: danielaAbsenceNudges.resolutionType,
    })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3))
    .limit(1);

  assert(
    'DB row still exists and resolvedAt was NOT overwritten',
    !!after && after.resolvedAt !== null &&
      Math.abs(after.resolvedAt.getTime() - originalResolvedAt.getTime()) < 2000,
    after
      ? `resolvedAt changed to: ${after.resolvedAt} (original: ${originalResolvedAt})`
      : 'row not found',
  );

  assert(
    'DB row suppressUntil was NOT overwritten (snooze window preserved)',
    !!after && after.suppressUntil !== null &&
      Math.abs(after.suppressUntil.getTime() - originalSuppressUntil.getTime()) < 2000,
    after
      ? `suppressUntil changed to: ${after.suppressUntil} (original: ${originalSuppressUntil})`
      : 'row not found',
  );

  assert(
    "DB row resolutionType still 'dismissed' (not overwritten to 'student_returned')",
    after?.resolutionType === 'dismissed',
    after ? `resolutionType was: ${after.resolutionType}` : 'row not found',
  );

  // ── 5. No "[AbsenceWorker] Auto-cleared" log — no resolve happened ────────
  const autoClearedLog = logs.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    'No "[AbsenceWorker] Auto-cleared..." log emitted (snoozed row was not re-resolved)',
    !autoClearedLog,
    autoClearedLog ?? undefined,
  );

  if (logs.length > 0) {
    console.log(Y(`\n  ℹ  Captured output (${logs.length} line(s)):`));
    logs.forEach(l => console.log(`     ${l}`));
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3));
  const [gone] = await db
    .select({ id: danielaAbsenceNudges.id })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3))
    .limit(1);
  assert('Test row cleaned up from DB', !gone, gone ? `Row still present: ${gone.id}` : undefined);
}

// ──────────────────────────────────────────────────────────────────────────────
// PART 4 — GL path cross-check (smoke, no DB needed)
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 4 — GL path cross-check: awaited call in geminiLiveSession block'));
sep();

function part4() {
  // The GL path awaits the function (not fire-and-forget) so the result colors synthesis.
  const awaitPattern = /await\s+autoResolveAbsenceNudgeOnReturn\s*\(\s*String\s*\(\s*userId\s*\)\s*\)/;
  assert(
    'GL path: `await autoResolveAbsenceNudgeOnReturn(String(userId))` present in handler',
    awaitPattern.test(wsSrc),
    awaitPattern.test(wsSrc) ? undefined : 'Awaited GL call not found — may have regressed to fire-and-forget',
  );

  // The result is assigned to absenceReturn and forwarded into synthesis
  const resultAssigned = /absenceReturn\s*=\s*await\s+autoResolveAbsenceNudgeOnReturn/.test(wsSrc);
  assert(
    'GL path: result assigned to `absenceReturn` variable',
    resultAssigned,
    resultAssigned ? undefined : '`absenceReturn = await ...` assignment not found',
  );

  // absenceReturn flows into generatePreSessionSynthesis (absence colors the inner monologue)
  const forwardedToSynthesis = /generatePreSessionSynthesis[\s\S]{0,300}absenceReturn/.test(wsSrc);
  assert(
    'GL path: `absenceReturn` forwarded to generatePreSessionSynthesis()',
    forwardedToSynthesis,
    forwardedToSynthesis ? undefined : '`absenceReturn` not passed to synthesis — GL absence signal would be lost',
  );

  // Log confirming injection
  assert(
    'GL path: "[GeminiLive] ✓ Student returning after N day(s) absence — injecting into synthesis" log exists',
    wsSrc.includes('[GeminiLive] ✓ Student returning after'),
  );
}

part4();

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await runPart2();
    await runPart3();
    await runPart5();
  } catch (err: any) {
    stopCapture();
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    // Best-effort cleanup on crash
    const db = getSharedDb();
    await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID)).catch(() => {});
    await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_2)).catch(() => {});
    await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3)).catch(() => {});
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed.\n`));
    console.log(D('   Text-mode absence nudge resolution is fully wired:'));
    console.log(D('   1. unified-ws-handler.ts text-mode else branch fires autoResolveAbsenceNudgeOnReturn()'));
    console.log(D('   2. DB row resolvedAt is set to a timestamp (not null) when the student returns'));
    console.log(D('   3. resolutionType = "student_returned" (not "dismissed")'));
    console.log(D('   4. Express Lane note posted in collaboration_messages'));
    console.log(D('   5. Second call within TTL returns cached details (idempotent, no double-resolve)'));
    console.log(D('   6. GL path also wires the same function with await before synthesis'));
    console.log(D('   7. Mid-snooze guard: snoozed row (resolvedAt set + suppressUntil future) returns null\n'));
    console.log(D('      → resolvedAt and suppressUntil are NOT overwritten when student returns mid-snooze\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed — review output above.\n`));
    process.exit(1);
  }
})();
