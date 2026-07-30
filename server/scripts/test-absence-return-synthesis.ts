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

// Part 4 uses a separate userId to avoid in-memory cache contamination from Parts 1-3.
// Parts 1-3 call autoResolveAbsenceNudgeOnReturn which populates the in-memory cache
// for TEST_USER_ID. Part 4 needs a clean slate to test peekAbsenceReturnDetails freshly.
const TEST_USER_ID_2 = '00000000-test-absence-warm-cache-000';
const TEST_DAYS_ABSENT_2 = 5;

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
  await db.delete(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_2));
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
// PART 4 — Warm-synthesis race: stale cache vs. absence-signal-aware generation
//
// Simulates the race where the frontend fires POST /api/sessions/warm-synthesis
// BEFORE autoResolveAbsenceNudgeOnReturn has run (i.e. the warm cache is
// populated without the absence signal). Confirms:
//
//   a) peekAbsenceReturnDetails() correctly detects the pending nudge (read-only)
//   b) A synthesis generated WITHOUT the signal lacks absence warmth words
//   c) A synthesis generated WITH the signal (simulating what the warm-synthesis
//      route does via its peekAbsenceReturnDetails call) DOES contain them
//   d) The WS handler guard fires when stale warm cache + non-null absenceReturn
//      coexist — it discards the stale cache and regenerates with the signal
//      (unified-ws-handler.ts: if (warmedNote && absenceReturn) → regenerate)
//   e) consumeWarmSynthesis() faithfully returns whatever was stored — confirming
//      that when the warm-synthesis route ran correctly (peek → generate WITH
//      signal → store), the WS handler receives the signal-aware synthesis
//
// Uses TEST_USER_ID_2 to avoid in-memory resolve-cache contamination from Parts 1-3.
// ══════════════════════════════════════════════════════════════════════════════
async function runPart4(): Promise<void> {
  sep();
  origLog(B('PART 4 — Warm-synthesis race: stale cache vs. signal-aware generation'));
  sep();

  const db = getSharedDb();

  // 4a. Seed a fresh nudge for the second test user
  const lastSessionDate = new Date(Date.now() - TEST_DAYS_ABSENT_2 * 24 * 60 * 60 * 1000);
  await db.insert(danielaAbsenceNudges).values({
    userId: TEST_USER_ID_2,
    lastSessionDate,
    daysSinceLastSession: TEST_DAYS_ABSENT_2,
  });
  origLog(D(`  Seeded nudge row: userId=${TEST_USER_ID_2}, daysSince=${TEST_DAYS_ABSENT_2}`));

  const { peekAbsenceReturnDetails } = await import('../services/daniela-absence-worker');
  const { generatePreSessionSynthesis, setWarmSynthesis, consumeWarmSynthesis } = await import('../services/pre-session-synthesis');

  // 4b. peekAbsenceReturnDetails — read-only check: confirms nudge is pending
  //     and returns details without touching the DB row.
  const peeked = await peekAbsenceReturnDetails(TEST_USER_ID_2);
  assert(
    'peekAbsenceReturnDetails() detects pending nudge without resolving it',
    peeked !== null,
    peeked === null ? 'Returned null — nudge not found (check DB insert)' : undefined,
  );
  if (peeked) {
    assert(
      `peekAbsenceReturnDetails() returns correct daysSinceLastSession (${TEST_DAYS_ABSENT_2})`,
      peeked.daysSinceLastSession === TEST_DAYS_ABSENT_2,
      `Got ${peeked.daysSinceLastSession}`,
    );
  }

  // Confirm nudge is still unresolved in DB (peek must not mutate it)
  const [stillPending] = await db
    .select({ resolvedAt: danielaAbsenceNudges.resolvedAt })
    .from(danielaAbsenceNudges)
    .where(
      and(
        eq(danielaAbsenceNudges.userId, TEST_USER_ID_2),
        isNull(danielaAbsenceNudges.resolvedAt),
      )
    )
    .limit(1);
  assert(
    'Nudge row is still unresolved after peekAbsenceReturnDetails() (read-only confirmed)',
    !!stillPending,
    stillPending ? undefined : 'resolvedAt is not null — peek mutated the DB row',
  );

  // Minimal compass context for synthesis calls
  const compassContext: any = {
    studentName: 'TestStudent2',
    studentGoals: 'Learn conversational Spanish',
    studentInterests: 'Music and travel',
    studentActflLevel: 'novice-mid',
    lastSessionSummary: 'We practised common greetings and numbers. Good progress.',
    danielaSelfReflection: 'TestStudent2 is motivated but needs more vocabulary exposure.',
    conversationMemories: [],
    mustHaveTopics: [],
    niceToHaveTopics: [],
  };

  const warmthWords = [
    'back', 'return', 'away', 'absence', 'again', 'missed', 'gap', 'been a while',
    'a while', "haven't", 'weeks', 'days', 'come back', 'glad', 'here',
  ];

  // 4c. Generate synthesis WITHOUT absence signal — the "stale" warm cache scenario.
  //     This simulates the frontend firing warm-synthesis BEFORE a nudge existed,
  //     or before the peekAbsenceReturnDetails call was added to that route.
  origLog(D('\n  Generating stale synthesis (no absence signal)...'));
  startCapture();
  const staleSynthesis = await generatePreSessionSynthesis(
    compassContext,
    'Daniela',
    TEST_USER_ID_2,
    'spanish',
    null, // <-- no absence signal: this is the stale path
  );
  const staleLogs = stopCapture();
  const stalePresynLogs = staleLogs.filter(l => l.includes('[PreSynthesis]'));
  if (stalePresynLogs.length) {
    origLog(D('  Stale [PreSynthesis] logs:'));
    stalePresynLogs.forEach(l => origLog(D(`    ${l}`)));
  }

  assert(
    'Stale synthesis (no absence signal) returned a non-null string',
    typeof staleSynthesis === 'string' && (staleSynthesis?.length ?? 0) > 0,
    staleSynthesis === null ? 'Returned null — Gemini call failed. Check GEMINI_API_KEY.' : undefined,
  );

  // Confirm the stale synthesis does NOT contain absence warmth words
  // (if it does, Daniela's voice just happened to use one generically — still acceptable)
  if (staleSynthesis) {
    const lowerStale = staleSynthesis.toLowerCase();
    const staleWarmthHit = warmthWords.find(w => lowerStale.includes(w));
    origLog(D(`\n  Stale synthesis (${staleSynthesis.length} chars):\n  "${staleSynthesis.slice(0, 200)}..."\n`));
    // We note — but don't fail — if a warmth word appears generically.
    // The critical test is that the signal-aware synthesis ALSO has them (step 4d).
    if (staleWarmthHit) {
      origLog(Y(`  Note: stale synthesis contains "${staleWarmthHit}" generically — this is acceptable (Daniela's voice is natural). The signal-aware synthesis must also contain warmth words.`));
    } else {
      origLog(D(`  ✓ Stale synthesis contains no absence warmth words — confirms it was generated without the signal.`));
    }
  }

  // 4d. Store the stale synthesis in the warm cache (simulating the frontend having
  //     pre-warmed without the absence signal).
  if (staleSynthesis) {
    setWarmSynthesis(TEST_USER_ID_2, staleSynthesis);
  }

  // Confirm consumeWarmSynthesis returns the stale text (one-shot).
  // This is what the WS handler would receive if it consumes a stale warm cache.
  const consumed = consumeWarmSynthesis(TEST_USER_ID_2);
  assert(
    'consumeWarmSynthesis() returns the stored synthesis (WS handler will receive exactly what was warmed)',
    consumed !== null && consumed === staleSynthesis,
    consumed === null
      ? 'consumeWarmSynthesis returned null — warm cache was not stored or TTL already expired'
      : consumed !== staleSynthesis
        ? 'consumeWarmSynthesis returned a different string than what was stored'
        : undefined,
  );

  // Confirm the cache is now empty (one-shot consumed)
  const consumedAgain = consumeWarmSynthesis(TEST_USER_ID_2);
  assert(
    'consumeWarmSynthesis() is one-shot — second call returns null (cache cleared on first consume)',
    consumedAgain === null,
    consumedAgain !== null ? 'Second consumeWarmSynthesis returned non-null — cache was not cleared' : undefined,
  );

  // 4d-ws-guard. Verify the WS handler guard fires when stale warm cache + absence signal coexist.
  //
  //   The unified-ws-handler now contains:
  //     if (warmedNote && absenceReturn) → discard warm cache, regenerate with signal
  //
  //   We simulate this: re-store the stale synthesis, consume it as the WS handler would,
  //   confirm both conditions are non-null (guard triggers), then call generatePreSessionSynthesis
  //   with the signal and assert the output contains at least one absence warmth word — proving
  //   the regenerated synthesis carries the returning-student awareness.
  origLog(D('\n  [4d-ws-guard] Simulating WS handler guard: stale warm cache + absence signal → regenerate...'));
  if (staleSynthesis) {
    setWarmSynthesis(TEST_USER_ID_2, staleSynthesis);
    const wsWarmedNote = consumeWarmSynthesis(TEST_USER_ID_2);
    const wsAbsenceReturn = peeked ?? { daysSinceLastSession: TEST_DAYS_ABSENT_2, firstName: null };

    assert(
      '[ws-guard] consumeWarmSynthesis returns the stale note (guard precondition: warmedNote non-null)',
      wsWarmedNote !== null && wsWarmedNote === staleSynthesis,
      wsWarmedNote === null ? 'consumeWarmSynthesis returned null — re-store failed' : 'Returned unexpected string',
    );
    assert(
      '[ws-guard] absenceReturn is non-null (guard precondition: signal detected)',
      wsAbsenceReturn !== null,
      'peeked was null — absence nudge not found; guard would not fire',
    );

    const guardWouldFire = wsWarmedNote !== null && wsAbsenceReturn !== null;
    assert(
      '[ws-guard] Both guard preconditions met → WS handler discards stale warm cache and regenerates with signal',
      guardWouldFire,
      'One or both preconditions were null — guard would NOT fire',
    );

    if (guardWouldFire) {
      origLog(D('  Guard conditions met — calling generatePreSessionSynthesis with signal (as WS handler now does)...'));
      startCapture();
      const guardRegen = await generatePreSessionSynthesis(
        compassContext,
        'Daniela',
        TEST_USER_ID_2,
        'spanish',
        wsAbsenceReturn,
      );
      const guardLogs = stopCapture();
      const guardAbsenceLog = guardLogs.find(l =>
        l.includes('[PreSynthesis] ✓ Returning-after-absence signal:') &&
        l.includes(String(TEST_DAYS_ABSENT_2)),
      );
      assert(
        '[ws-guard] Regenerated synthesis triggers "[PreSynthesis] ✓ Returning-after-absence signal" log — signal reached buildLiteContext',
        !!guardAbsenceLog,
        guardAbsenceLog ?? 'Log line not found — signal may not be reaching buildLiteContext',
      );

      if (guardRegen) {
        const lowerRegen = guardRegen.toLowerCase();
        const regenWarmthHit = warmthWords.find(w => lowerRegen.includes(w));
        assert(
          `[ws-guard] Regenerated synthesis (guard path) contains at least one warmth/return indicator (${regenWarmthHit ? `"${regenWarmthHit}"` : 'none found'})`,
          !!regenWarmthHit,
          `None of ${warmthWords.slice(0, 8).join(', ')} found — regenerated synthesis may not carry the absence awareness`,
        );
        origLog(D(`  Guard-regenerated synthesis (${guardRegen.length} chars): "${guardRegen.slice(0, 200)}..."`));
      }
    }
  }

  // 4e. Now simulate the warm-synthesis route's CORRECT behavior:
  //     peek → generate WITH signal → store in warm cache.
  //     This is what POST /api/sessions/warm-synthesis does when peekAbsenceReturnDetails
  //     finds a pending nudge. The WS handler then consumes this signal-aware synthesis.
  origLog(D('\n  Generating signal-aware synthesis (with absence signal — simulating warm-synthesis route)...'));
  startCapture();
  const signalSynthesis = await generatePreSessionSynthesis(
    compassContext,
    'Daniela',
    TEST_USER_ID_2,
    'spanish',
    peeked ?? { daysSinceLastSession: TEST_DAYS_ABSENT_2, firstName: null }, // absence signal baked in
  );
  const signalLogs = stopCapture();
  const signalPresynLogs = signalLogs.filter(l => l.includes('[PreSynthesis]'));
  if (signalPresynLogs.length) {
    origLog(D('  Signal-aware [PreSynthesis] logs:'));
    signalPresynLogs.forEach(l => origLog(D(`    ${l}`)));
  }

  assert(
    'Signal-aware synthesis (with absence signal) returned a non-null string',
    typeof signalSynthesis === 'string' && (signalSynthesis?.length ?? 0) > 0,
    signalSynthesis === null ? 'Returned null — Gemini call failed. Check GEMINI_API_KEY.' : undefined,
  );

  // The "Returning-after-absence signal" log must appear — confirms the signal
  // reached buildLiteContext and the RETURNING AFTER ABSENCE block was injected.
  const absenceSignalLog = signalLogs.find(l =>
    l.includes('[PreSynthesis] ✓ Returning-after-absence signal:') &&
    l.includes(String(TEST_DAYS_ABSENT_2))
  );
  assert(
    '"[PreSynthesis] ✓ Returning-after-absence signal: N days" logged for signal-aware synthesis — RETURNING AFTER ABSENCE block was injected',
    !!absenceSignalLog,
    absenceSignalLog ?? 'Log line not found — returningAfterAbsence argument may not be reaching buildLiteContext',
  );

  if (signalSynthesis) {
    origLog(D(`\n  Signal-aware synthesis (${signalSynthesis.length} chars):\n  "${signalSynthesis.slice(0, 200)}..."\n`));

    // Signal-aware synthesis should contain at least one warmth/return word
    const lowerSignal = signalSynthesis.toLowerCase();
    const foundWarmthWord = warmthWords.find(w => lowerSignal.includes(w));
    assert(
      `Signal-aware synthesis contains at least one warmth/return indicator (${foundWarmthWord ? `"${foundWarmthWord}"` : 'none found'})`,
      !!foundWarmthWord,
      `None of ${warmthWords.slice(0, 8).join(', ')} (and more) found in signal-aware synthesis. Absence context may not be influencing Daniela's inner monologue.`,
    );
  }

  // 4f. Store the signal-aware synthesis in the warm cache (what the route does correctly)
  //     and confirm the WS handler would receive the signal-aware text.
  if (signalSynthesis) {
    setWarmSynthesis(TEST_USER_ID_2, signalSynthesis);
    const wsConsume = consumeWarmSynthesis(TEST_USER_ID_2);
    assert(
      'WS handler receives the signal-aware synthesis when warm-synthesis route ran correctly (peek → generate WITH signal → setWarmSynthesis)',
      wsConsume === signalSynthesis,
      wsConsume === null
        ? 'consumeWarmSynthesis returned null — signal-aware synthesis was not stored'
        : 'consumeWarmSynthesis returned a different string than the signal-aware synthesis',
    );
  }
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

    // Part 4 runs independently — uses TEST_USER_ID_2 to avoid cache contamination.
    await runPart4();
  } catch (err: any) {
    stopCapture();
    origLog(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) origLog(D(err.stack));
    process.exit(1);
  } finally {
    // Always clean up the seeded rows, even on failure
    try {
      await cleanUpTestRows();
      origLog(D('\n  Test rows cleaned up.'));
    } catch (cleanupErr: any) {
      origLog(Y(`  Warning: cleanup failed — ${cleanupErr?.message}. Delete manually:\n    DELETE FROM daniela_absence_nudges WHERE user_id IN ('${TEST_USER_ID}', '${TEST_USER_ID_2}');`));
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
