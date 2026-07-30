/**
 * test-absence-return-synthesis.ts
 *
 * Confirms that when a student returns after a real absence nudge:
 *
 *   1. autoResolveAbsenceNudgeOnReturn() resolves the nudge and returns
 *      the return details (daysSinceLastSession, firstName).
 *
 *   2. The "RETURNING AFTER ABSENCE" block is injected into the lite context
 *      passed to generatePreSessionSynthesis() — confirmed via the log line
 *      "[PreSynthesis] ✓ Returning-after-absence signal: N days".
 *
 *   3. generatePreSessionSynthesis() produces a non-empty paragraph (i.e. the
 *      injection path is not broken and the synthesis model can complete).
 *
 *   4. The synthesis text passes a basic warmth/return heuristic: it should
 *      not be the generic safe-mode fallback paragraph that fires when the
 *      Gemini call fails entirely.
 *
 * The test seeds a real daniela_absence_nudges row, exercises the live
 * Gemini generateContent path, then cleans up.
 *
 * Run: npx tsx server/scripts/test-absence-return-synthesis.ts
 */

import { getSharedDb } from '../db';
import { danielaAbsenceNudges } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { CompassContext } from '@shared/schema';

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const D = (s: string) => `\x1b[2m${s}\x1b[0m`;
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
// Fake userId — must not exist in the users table (no FK on daniela_absence_nudges).
// Uses a sentinel prefix so accidental DB rows are obviously test artefacts.
const TEST_USER_ID  = '00000000-test-absence-synthesis-0000';
const TEST_DAYS_ABSENT = 9;
const SAFE_MODE_SENTINEL = 'Something quiet settles before these sessions'; // first 8 words of safe-mode fallback

// ── Log capture helpers ───────────────────────────────────────────────────────
const capturedLogs: string[] = [];
const origLog  = console.log;
const origWarn = console.warn;
const origError = console.error;

function startCapture() {
  capturedLogs.length = 0;
  console.log   = (...args: any[]) => {
    const line = args.map(String).join(' ');
    capturedLogs.push(line);
  };
  console.warn  = (...args: any[]) => {
    capturedLogs.push('[WARN] ' + args.map(String).join(' '));
  };
  console.error = (...args: any[]) => {
    capturedLogs.push('[ERROR] ' + args.map(String).join(' '));
  };
}
function stopCapture(): string[] {
  console.log   = origLog;
  console.warn  = origWarn;
  console.error = origError;
  return [...capturedLogs];
}

// ── Cleanup helper ────────────────────────────────────────────────────────────
async function cleanUpTestRows(): Promise<void> {
  const db = getSharedDb();
  await db.delete(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Seed a nudge row and confirm autoResolveAbsenceNudgeOnReturn works
// ══════════════════════════════════════════════════════════════════════════════
async function runPart1(): Promise<{ daysSinceLastSession: number; firstName: string | null } | null> {
  sep();
  console.log(B('PART 1 — Seed nudge row + autoResolveAbsenceNudgeOnReturn()'));
  sep();

  const db = getSharedDb();

  // 1a. Clean up any leftover row from a prior run
  await cleanUpTestRows();

  // 1b. Seed the nudge row
  const lastSessionDate = new Date(Date.now() - TEST_DAYS_ABSENT * 24 * 60 * 60 * 1000);
  await db.insert(danielaAbsenceNudges).values({
    userId: TEST_USER_ID,
    lastSessionDate,
    daysSinceLastSession: TEST_DAYS_ABSENT,
  });
  console.log(D(`  Seeded nudge row: userId=${TEST_USER_ID}, daysSince=${TEST_DAYS_ABSENT}`));

  // 1c. Confirm it is pending
  const [seeded] = await db
    .select({ id: danielaAbsenceNudges.id, resolvedAt: danielaAbsenceNudges.resolvedAt })
    .from(danielaAbsenceNudges)
    .where(
      and(
        eq(danielaAbsenceNudges.userId, TEST_USER_ID),
        isNull(danielaAbsenceNudges.resolvedAt),
      )
    )
    .limit(1);
  assert('Precondition: nudge row seeded and unresolved', !!seeded,
    seeded ? undefined : 'Insert appears to have silently failed');

  // 1d. Call the function under test
  const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');
  startCapture();
  const returnDetails = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID);
  const logs1 = stopCapture();

  // 1e. Returned value assertions
  assert(
    'autoResolveAbsenceNudgeOnReturn() returns non-null for a student with a pending nudge',
    returnDetails !== null,
    returnDetails === null ? 'Returned null — no pending nudge found (unexpected)' : undefined,
  );

  if (returnDetails) {
    assert(
      `Returned daysSinceLastSession matches seeded value (${TEST_DAYS_ABSENT})`,
      returnDetails.daysSinceLastSession === TEST_DAYS_ABSENT,
      `Got ${returnDetails.daysSinceLastSession}`,
    );
  }

  // 1f. Log assertions
  const autoClearedLog = logs1.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    '"[AbsenceWorker] Auto-cleared..." log emitted',
    !!autoClearedLog,
    autoClearedLog ?? 'Not found in captured logs',
  );

  const resolveLog = logs1.find(l =>
    l.includes('[AbsenceWorker] Nudge resolved') &&
    l.includes(TEST_USER_ID)
  );
  assert(
    '"[AbsenceWorker] Nudge resolved" log emitted for the test user',
    !!resolveLog,
    resolveLog ?? 'Not found in captured logs',
  );

  // 1g. DB state: nudge must now be resolved
  const [resolved] = await db
    .select({ resolvedAt: danielaAbsenceNudges.resolvedAt, resolutionType: danielaAbsenceNudges.resolutionType })
    .from(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID))
    .limit(1);

  assert(
    'Nudge row is resolved in DB after auto-clear',
    !!resolved?.resolvedAt,
    resolved ? `resolvedAt is still null` : 'Row not found',
  );

  return returnDetails;
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — generatePreSessionSynthesis injects the RETURNING AFTER ABSENCE block
// ══════════════════════════════════════════════════════════════════════════════
async function runPart2(returnDetails: { daysSinceLastSession: number; firstName: string | null }): Promise<void> {
  sep();
  console.log(B('PART 2 — generatePreSessionSynthesis() with returning-student signal'));
  sep();

  const { generatePreSessionSynthesis } = await import('../services/pre-session-synthesis');

  // Minimal compass context — enough to give the synthesis model something to work with.
  const compassContext: CompassContext = {
    studentName: 'TestStudent',
    studentGoals: 'Learn conversational Spanish',
    studentInterests: 'Travel and food',
    studentActflLevel: 'novice-mid',
    lastSessionSummary: 'We practised ordering food in a restaurant. TestStudent did well with menu vocabulary.',
    danielaSelfReflection: 'TestStudent was engaged and made real progress with food vocabulary last time.',
    conversationMemories: [],
    mustHaveTopics: [],
    niceToHaveTopics: [],
  } as unknown as CompassContext;

  origLog(D(`  Calling generatePreSessionSynthesis with ${returnDetails.daysSinceLastSession}-day absence signal...`));

  startCapture();
  const synthesis = await generatePreSessionSynthesis(
    compassContext,
    'Daniela',
    TEST_USER_ID,
    'spanish',
    returnDetails,
  );
  const logs2 = stopCapture();

  // Print a sample of captured logs for visibility
  const presynLogs = logs2.filter(l => l.includes('[PreSynthesis]'));
  if (presynLogs.length) {
    origLog(D(`\n  Captured [PreSynthesis] logs:`));
    presynLogs.forEach(l => origLog(D(`    ${l}`)));
  }

  // 2a. The injection signal must appear in the logs
  const absenceSignalLog = logs2.find(l =>
    l.includes('[PreSynthesis] ✓ Returning-after-absence signal:') &&
    l.includes(String(returnDetails.daysSinceLastSession))
  );
  assert(
    '"[PreSynthesis] ✓ Returning-after-absence signal: N days" logged — RETURNING AFTER ABSENCE block was injected into the lite context',
    !!absenceSignalLog,
    absenceSignalLog ?? 'Log line not found. The returningAfterAbsence argument may not have been passed through.',
  );

  // 2b. Synthesis must be non-null (Gemini call completed)
  assert(
    'generatePreSessionSynthesis() returned a non-null, non-empty string',
    typeof synthesis === 'string' && synthesis.length > 0,
    synthesis === null ? 'Returned null (Gemini call failed or returned empty)' : undefined,
  );

  if (synthesis) {
    origLog(D(`\n  Synthesis output (${synthesis.length} chars):\n`));
    origLog(`  "${synthesis}"\n`);

    // 2c. Safe-mode fallback detection — if Gemini failed, we get the hardcoded sentinel
    const isSafeModeOutput = synthesis.startsWith(SAFE_MODE_SENTINEL);
    assert(
      'Synthesis is NOT the generic safe-mode fallback (Gemini call succeeded)',
      !isSafeModeOutput,
      isSafeModeOutput
        ? 'Synthesis matched the safe-mode sentinel — the Gemini call likely failed. Check GEMINI_API_KEY.'
        : undefined,
    );

    // 2d. Warmth heuristic — the paragraph should not be completely devoid of
    //     temporal or relational warmth words that signal a real inner monologue.
    //     This is intentionally loose: Daniela's voice is varied. We just confirm
    //     it isn't a generic boilerplate paragraph with no session-specific content.
    const warmthWords = [
      'back', 'return', 'away', 'absence', 'again', 'time', 'missed', 'gap', 'been a while',
      'a while', 'haven\'t', 'weeks', 'days', 'come back', 'glad', 'here',
    ];
    const lowerSynth = synthesis.toLowerCase();
    const foundWarmthWord = warmthWords.find(w => lowerSynth.includes(w));
    assert(
      `Synthesis contains at least one warmth/return indicator word (${foundWarmthWord ? `"${foundWarmthWord}"` : 'none found'})`,
      !!foundWarmthWord,
      `None of the expected warmth indicators found. Synthesis may not reflect the absence context. Checked: ${warmthWords.slice(0, 8).join(', ')} (and more).`,
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Idempotency: calling autoResolveAbsenceNudgeOnReturn again returns
//          cached details within the 2-minute TTL window (no double-clear)
// ══════════════════════════════════════════════════════════════════════════════
async function runPart3(): Promise<void> {
  sep();
  console.log(B('PART 3 — In-memory cache: second call within TTL returns cached details'));
  sep();

  const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');

  startCapture();
  const cached = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID);
  const logs3 = stopCapture();

  assert(
    'Second call returns non-null details from the in-memory cache',
    cached !== null,
    'Expected cached details but got null — cache may have been cleared or TTL too short',
  );

  if (cached) {
    assert(
      `Cached daysSinceLastSession still matches seeded value (${TEST_DAYS_ABSENT})`,
      cached.daysSinceLastSession === TEST_DAYS_ABSENT,
      `Got ${cached.daysSinceLastSession}`,
    );
  }

  // The second call should NOT emit a second "Auto-cleared" log (already resolved)
  const secondAutoClear = logs3.find(l => l.includes('[AbsenceWorker] Auto-cleared'));
  assert(
    'Second call does NOT re-emit the "Auto-cleared" log (cache hit, not a re-resolve)',
    !secondAutoClear,
    secondAutoClear ?? 'Unexpected: second auto-clear log appeared — nudge may have been resolved twice',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
(async () => {
  origLog(B('\ntest-absence-return-synthesis — Verifying Daniela\'s greeting reflects returning students\n'));

  try {
    const returnDetails = await runPart1();

    if (returnDetails) {
      await runPart2(returnDetails);
      await runPart3();
    } else {
      origLog(R('\nPart 1 did not return details — skipping Parts 2 and 3.\n'));
      failed++;
    }
  } catch (err: any) {
    stopCapture();
    origLog(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) origLog(D(err.stack));
    process.exit(1);
  } finally {
    // Always clean up the seeded row, even on failure
    try {
      await cleanUpTestRows();
      origLog(D('\n  Test row cleaned up.'));
    } catch (cleanupErr: any) {
      origLog(Y(`  Warning: cleanup failed — ${cleanupErr?.message}. Delete manually: DELETE FROM daniela_absence_nudges WHERE user_id = '${TEST_USER_ID}';`));
    }
  }

  sep();
  const all = passed + failed;
  if (failed === 0) {
    origLog(G(`\n✓  All ${all} assertions passed — Daniela's greeting correctly reflects a returning student.\n`));
    process.exit(0);
  } else {
    origLog(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
    process.exit(1);
  }
})();
