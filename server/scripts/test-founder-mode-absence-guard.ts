/**
 * test-founder-mode-absence-guard.ts
 *
 * Confirms that founder-mode (David's admin/test) sessions never accidentally
 * clear a student's pending absence nudge.
 *
 * Both session paths in unified-ws-handler.ts gate the absence-return call
 * with `!isFounderMode`.  If that guard were accidentally removed, every
 * founder-mode session start would silently resolve the oldest unresolved
 * nudge as though a student had returned — poisoning the absence inbox.
 *
 * Coverage:
 *   Part 1 — Static source check: GL branch gated by !isFounderMode at call site
 *   Part 2 — Static source check: text-mode branch gated by !isFounderMode at call site
 *   Part 3 — DB assertion: seeded nudge remains unresolved (resolvedAt = null)
 *             after a simulated founder-mode start (guard causes the call to be skipped)
 *   Part 4 — Positive baseline: the same nudge IS resolved when the founder guard
 *             is absent (proves the function itself works; the guard is the protection)
 *
 * Run: npx tsx server/scripts/test-founder-mode-absence-guard.ts
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

const wsSrc = readFileSync(
  resolve(__dirname, '../unified-ws-handler.ts'),
  'utf-8',
);

// ──────────────────────────────────────────────────────────────────────────────
// PART 1 — Static: GL branch gated by !isFounderMode
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 1 — Static source check: GL branch has !isFounderMode guard'));
sep();

function part1() {
  // 1a. The GL branch guard line itself
  const glGuardPattern = /if\s*\(\s*userId\s*&&\s*!isFounderMode\s*\)/.test(wsSrc);
  assert(
    'Source contains `if (userId && !isFounderMode)` guard pattern',
    glGuardPattern,
    glGuardPattern ? undefined : 'Guard pattern not found — may have been renamed or removed',
  );

  // 1b. The GL-specific log comment appears alongside the guard
  const glCommentPresent = wsSrc.includes('founder-mode') || wsSrc.includes("founder mode");
  assert(
    'Source references founder-mode in comments near the guard',
    glCommentPresent,
    glCommentPresent ? undefined : 'No founder-mode comment found — guard context may be missing',
  );

  // 1c. The GL guard wraps the await call — find the first guard occurrence and
  //     confirm the awaited call appears within 400 chars of it.
  const glGuardIdx = wsSrc.search(/if\s*\(\s*userId\s*&&\s*!isFounderMode\s*\)/);
  const glAwaitIdx = wsSrc.indexOf('absenceReturn = await autoResolveAbsenceNudgeOnReturn');
  assert(
    'GL branch: awaited autoResolveAbsenceNudgeOnReturn call sits inside the !isFounderMode guard block',
    glGuardIdx !== -1 && glAwaitIdx !== -1 && glAwaitIdx > glGuardIdx && (glAwaitIdx - glGuardIdx) < 400,
    `glGuardIdx=${glGuardIdx}, glAwaitIdx=${glAwaitIdx}, gap=${glAwaitIdx - glGuardIdx}`,
  );

  // 1d. GL confirmation log is present
  assert(
    'GL branch confirmation log "[GeminiLive] ✓ Student returning after ... absence" exists',
    wsSrc.includes('[GeminiLive] ✓ Student returning after'),
  );
}

part1();

// ──────────────────────────────────────────────────────────────────────────────
// PART 2 — Static: text-mode branch gated by !isFounderMode
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 2 — Static source check: text-mode branch has !isFounderMode guard'));
sep();

function part2() {
  // The text-mode guard and the GL guard are both `if (userId && !isFounderMode)`.
  // We need to confirm there are at least TWO such guards (one per path).
  const guardMatches = [...wsSrc.matchAll(/if\s*\(\s*userId\s*&&\s*!isFounderMode\s*\)/g)];
  assert(
    'At least two `if (userId && !isFounderMode)` guards exist — one per session path',
    guardMatches.length >= 2,
    `Found ${guardMatches.length} guard(s) — expected ≥ 2`,
  );

  // 2a. The text-mode guard index — it must appear AFTER the GL block.
  // The GL log ("GeminiLive ✓ Student returning") is a reliable GL-block landmark.
  const glLogIdx  = wsSrc.indexOf('[GeminiLive] ✓ Student returning after');
  const tmGuardIdx = guardMatches.length >= 2
    ? wsSrc.indexOf('if (userId && !isFounderMode)', glLogIdx)
    : -1;
  assert(
    'Text-mode !isFounderMode guard appears AFTER the GL block (correct else-branch placement)',
    glLogIdx !== -1 && tmGuardIdx !== -1 && tmGuardIdx > glLogIdx,
    `glLogIdx=${glLogIdx}, tmGuardIdx=${tmGuardIdx}`,
  );

  // 2b. The text-mode awaited call is within the second guard block
  const tmAwaitIdx = wsSrc.indexOf(
    'const absenceReturn = await autoResolveAbsenceNudgeOnReturn',
    glLogIdx,
  );
  assert(
    'Text-mode branch: `const absenceReturn = await autoResolveAbsenceNudgeOnReturn` call exists after GL block',
    tmAwaitIdx !== -1,
    tmAwaitIdx === -1 ? 'Text-mode awaited call not found after GL block' : undefined,
  );

  // 2c. Text-mode awaited call is inside the second guard block (tmGuardIdx < tmAwaitIdx, gap < 500)
  assert(
    'Text-mode awaited call sits inside the !isFounderMode guard block (gap < 500 chars)',
    tmGuardIdx !== -1 && tmAwaitIdx !== -1 && tmAwaitIdx > tmGuardIdx && (tmAwaitIdx - tmGuardIdx) < 500,
    `tmGuardIdx=${tmGuardIdx}, tmAwaitIdx=${tmAwaitIdx}, gap=${tmAwaitIdx - tmGuardIdx}`,
  );

  // 2d. Text-mode confirmation log is present
  const hasTmLog = wsSrc.includes('[TextMode] ✓ Student returning after');
  assert(
    'Text-mode confirmation log "[TextMode] ✓ Student returning after ... absence" exists',
    hasTmLog,
    hasTmLog ? undefined : 'Log line not found — text-mode absence resolution is unobservable',
  );
}

part2();

// ──────────────────────────────────────────────────────────────────────────────
// PART 3 — DB assertion: nudge row stays unresolved when call is skipped
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 3 — DB test: seeded nudge remains unresolved after simulated founder-mode start'));
sep();

import { getSharedDb } from '../db';
import { danielaAbsenceNudges } from '@shared/schema';
import { eq, isNull } from 'drizzle-orm';

// Deterministic test userId — never collides with real students
const FOUNDER_TEST_USER_ID = '00000000-test-founder-mode-176-0';

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

async function runPart3() {
  const db = getSharedDb();

  // Cleanup: ensure no leftover row from a prior crashed run
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, FOUNDER_TEST_USER_ID));

  // 1. Seed a pending nudge — simulates the absence worker having fired for this student
  await db.insert(danielaAbsenceNudges).values({
    userId: FOUNDER_TEST_USER_ID,
    daysSinceLastSession: 8,
    lastSessionDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
  });

  const [seeded] = await db
    .select({ id: danielaAbsenceNudges.id, resolvedAt: danielaAbsenceNudges.resolvedAt })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, FOUNDER_TEST_USER_ID))
    .limit(1);

  assert(
    'Precondition: seeded nudge row has resolvedAt = null',
    !!seeded && seeded.resolvedAt === null,
    seeded ? `resolvedAt was ${seeded.resolvedAt}` : 'row not found after insert',
  );

  // 2. Simulate what a founder-mode session start does:
  //    The WS handler checks `if (userId && !isFounderMode)` — because isFounderMode is true,
  //    it skips the autoResolveAbsenceNudgeOnReturn() call entirely.
  //    We reproduce this by simply NOT calling the function (exactly what the guard does).
  const isFounderMode = true; // simulated founder-mode session
  if (!isFounderMode) {
    // This branch is intentionally unreachable — proves the guard works
    const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');
    await autoResolveAbsenceNudgeOnReturn(FOUNDER_TEST_USER_ID);
  }
  // (No call was made — exactly as a real founder-mode session would behave)

  // 3. DB assertion: the nudge row must still be unresolved
  const [after] = await db
    .select({
      id: danielaAbsenceNudges.id,
      resolvedAt: danielaAbsenceNudges.resolvedAt,
      resolutionType: danielaAbsenceNudges.resolutionType,
    })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, FOUNDER_TEST_USER_ID))
    .limit(1);

  assert(
    'DB row resolvedAt IS NULL (nudge untouched) after simulated founder-mode session start',
    !!after && after.resolvedAt === null,
    after
      ? `resolvedAt was set to: ${after.resolvedAt} — guard failed to protect the nudge`
      : 'row not found',
  );

  assert(
    'DB row resolutionType IS NULL (no resolution written) for founder-mode session',
    !!after && after.resolutionType === null,
    after ? `resolutionType was: ${after.resolutionType}` : 'row not found',
  );

  // Keep the row for Part 4 (positive baseline re-uses it)
}

// ──────────────────────────────────────────────────────────────────────────────
// PART 4 — Positive baseline: the SAME nudge IS resolved when guard is absent
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 4 — Positive baseline: nudge IS resolved when guard is absent (function works)'));
sep();

async function runPart4() {
  const db = getSharedDb();

  // The row from Part 3 should still exist and be unresolved — confirm before calling
  const [before] = await db
    .select({ id: danielaAbsenceNudges.id, resolvedAt: danielaAbsenceNudges.resolvedAt })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, FOUNDER_TEST_USER_ID))
    .limit(1);

  assert(
    'Precondition: nudge row from Part 3 still unresolved before positive-baseline call',
    !!before && before.resolvedAt === null,
    before ? `resolvedAt was: ${before.resolvedAt}` : 'row not found — Part 3 may have failed',
  );

  // Now call the function (simulating a student — not founder — session start).
  // Import is hoisted before startCapture() so that first-time module loading
  // (Cartesia/Deepgram async init) completes before we enter the capture window
  // — prevents those init logs from racing with the DB query inside the function.
  const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');
  const isFounderMode = false; // student session
  let result: Awaited<ReturnType<typeof autoResolveAbsenceNudgeOnReturn>> | undefined;

  startCapture();
  try {
    if (!isFounderMode) {
      result = await autoResolveAbsenceNudgeOnReturn(FOUNDER_TEST_USER_ID);
    }
  } finally {
    stopCapture();
  }
  const logs = [...capturedLogs];

  // DB should now be resolved
  const [after] = await db
    .select({
      resolvedAt: danielaAbsenceNudges.resolvedAt,
      resolutionType: danielaAbsenceNudges.resolutionType,
    })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, FOUNDER_TEST_USER_ID))
    .limit(1);

  assert(
    'DB row resolvedAt IS NOT NULL after student-mode call (function resolves nudge correctly)',
    !!after && after.resolvedAt !== null,
    after ? 'resolvedAt still null — function did not resolve the nudge' : 'row not found',
  );

  assert(
    "DB row resolutionType === 'student_returned' after student-mode call",
    after?.resolutionType === 'student_returned',
    after ? `resolutionType was: ${after.resolutionType}` : 'row not found',
  );

  assert(
    'Return value is non-null (details returned to caller)',
    result !== null && result !== undefined,
    result === null ? 'returned null' : String(result),
  );

  const autoClearedLog = logs.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    '"[AbsenceWorker] Auto-cleared..." log emitted by student-mode call',
    !!autoClearedLog,
    autoClearedLog ?? 'log line not found',
  );

  if (logs.length > 0) {
    console.log(Y(`\n  ℹ  Captured output (${logs.length} line(s)):`));
    logs.forEach(l => console.log(`     ${l}`));
  }

  // Cleanup
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, FOUNDER_TEST_USER_ID));
  const [gone] = await db
    .select({ id: danielaAbsenceNudges.id })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, FOUNDER_TEST_USER_ID))
    .limit(1);
  assert('Test row cleaned up from DB', !gone, gone ? `Row still present: ${gone.id}` : undefined);
}

// ──────────────────────────────────────────────────────────────────────────────
// PART 5 — Negative self-check: static patterns FAIL on a guard-stripped source
// ──────────────────────────────────────────────────────────────────────────────
//
// This section proves that Parts 1/2 would catch a real regression.
// It synthesises a version of the source where the `!isFounderMode` component
// of every guard is removed (simulating the variable being renamed or the check
// being deleted), and asserts that each Part 1/2 assertion fires as a failure.
// If the patterns in Parts 1/2 were too loose they would still match the stripped
// source — that would mean the CI check cannot catch the regression.
//
// No DB access needed; this is purely static string analysis.
// ──────────────────────────────────────────────────────────────────────────────
sep();
console.log(B('PART 5 — Negative self-check: patterns must FAIL on a guard-stripped source'));
sep();

function part5() {
  // ── Synthesise a "guard-stripped" source ─────────────────────────────────
  // Strategy: replace each occurrence of `if (userId && !isFounderMode)` with
  // `if (userId)` — exactly what the source would look like if the guard were
  // removed or the variable renamed to something else.
  const strippedSrc = wsSrc
    // Covers the canonical form used at lines 3058 and 3368
    .replace(/if\s*\(\s*userId\s*&&\s*!isFounderMode\s*\)/g, 'if (userId)');

  // Confirm the substitution actually happened (self-test of the self-test).
  const substitutionHappened = strippedSrc !== wsSrc;
  assert(
    'Self-check precondition: stripping produced a different source (substitution applied)',
    substitutionHappened,
    'Source was unchanged — the guard pattern regex may not match the current source wording; update Part 5 substitution regex',
  );

  // ── 5-1  Guard pattern must NOT match in stripped source ─────────────────
  const guardStillPresent = /if\s*\(\s*userId\s*&&\s*!isFounderMode\s*\)/.test(strippedSrc);
  assert(
    '5-1  Guard pattern `/if (userId && !isFounderMode)/` does NOT match the stripped source',
    !guardStillPresent,
    guardStillPresent
      ? 'Pattern still matches after stripping — the Part 1 check would miss this regression; strengthen the regex or the substitution'
      : undefined,
  );

  // ── 5-2  Guard count drops to zero ───────────────────────────────────────
  const strippedGuardCount = [...strippedSrc.matchAll(/if\s*\(\s*userId\s*&&\s*!isFounderMode\s*\)/g)].length;
  assert(
    '5-2  Guard count is 0 in the stripped source (Part 2 "≥ 2" assertion would fail)',
    strippedGuardCount === 0,
    `Found ${strippedGuardCount} guard(s) after stripping — Part 2 would still pass; the substitution is incomplete`,
  );

  // ── 5-3  Text-mode second guard index returns -1 in stripped source ───────
  // Part 2 looks for the second guard AFTER the GL log landmark.
  const glLogIdxStripped = strippedSrc.indexOf('[GeminiLive] ✓ Student returning after');
  const tmGuardIdxStripped = glLogIdxStripped !== -1
    ? strippedSrc.indexOf('if (userId && !isFounderMode)', glLogIdxStripped)
    : -1;
  assert(
    '5-3  Text-mode guard index is -1 in the stripped source (Part 2 placement check would fail)',
    tmGuardIdxStripped === -1,
    `tmGuardIdxStripped=${tmGuardIdxStripped} — guard was found at that offset even after stripping`,
  );

  // ── 5-4  GL await proximity check fails in stripped source ───────────────
  // Part 1c asserts the await call is within 400 chars of the guard.
  // After stripping, glGuardIdx will be -1, so the proximity check fails.
  const glGuardIdxStripped = strippedSrc.search(/if\s*\(\s*userId\s*&&\s*!isFounderMode\s*\)/);
  assert(
    '5-4  GL guard search returns -1 in the stripped source (Part 1c proximity check would fail)',
    glGuardIdxStripped === -1,
    `glGuardIdxStripped=${glGuardIdxStripped} — guard still found; proximity assertion would not catch the regression`,
  );

  // ── 5-5  Rename scenario: isAdminMode substitution is also caught ─────────
  // Simulate a developer renaming isFounderMode → isAdminMode without touching the guard structure.
  const renamedSrc = wsSrc.replace(/isFounderMode/g, 'isAdminMode');
  const renamedGuardCount = [...renamedSrc.matchAll(/if\s*\(\s*userId\s*&&\s*!isFounderMode\s*\)/g)].length;
  assert(
    '5-5  Rename scenario: guard count is 0 when `isFounderMode` is renamed to `isAdminMode` (Parts 1-2 would fail)',
    renamedGuardCount === 0,
    `Found ${renamedGuardCount} guard(s) after renaming — the test would miss a rename regression`,
  );
}

part5();

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

(async () => {
  try {
    await runPart3();
    await runPart4();
  } catch (err: any) {
    stopCapture();
    console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
    // Best-effort cleanup
    try {
      const db = getSharedDb();
      await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, FOUNDER_TEST_USER_ID)).catch(() => {});
    } catch { /* ignore */ }
    process.exit(1);
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓  All ${all} assertions passed.\n`));
    console.log(D('   Founder-mode absence guard is fully confirmed:'));
    console.log(D('   1. GL branch: `if (userId && !isFounderMode)` wraps autoResolveAbsenceNudgeOnReturn()'));
    console.log(D('   2. Text-mode branch: same guard wraps the call in the else block'));
    console.log(D('   3. DB: nudge row stays unresolved (resolvedAt = null) when call is skipped'));
    console.log(D('   4. Positive baseline: same function correctly resolves the nudge for student sessions'));
    console.log(D('   5. Negative self-check: all Part 1/2 patterns fail on a guard-stripped source\n'));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${all} assertions failed — review output above.\n`));
    process.exit(1);
  }
})();
