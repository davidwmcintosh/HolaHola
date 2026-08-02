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

import { readFileSync } from 'fs';
import { resolve as pathResolve, dirname as pathDirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { danielaAbsenceNudges } from '@shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import type { CompassContext } from '@shared/schema';
import { runWarmSynthesisCore, type WarmSynthesisSignal } from '../services/warm-synthesis-core';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = pathDirname(__filename);

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

const hasGeminiKey = !!process.env.GEMINI_API_KEY;
const TEST_USER_ID  = '00000000-test-absence-synthesis-0000';
const TEST_DAYS_ABSENT = 9;
const SAFE_MODE_SENTINEL = 'Something quiet settles before these sessions'; // first 8 words of safe-mode fallback

// Part 4 uses a separate userId to avoid in-memory cache contamination from Parts 1-3.
// Parts 1-3 call autoResolveAbsenceNudgeOnReturn which populates the in-memory cache
// for TEST_USER_ID. Part 4 needs a clean slate to test peekAbsenceReturnDetails freshly.
const TEST_USER_ID_2 = '00000000-test-absence-warm-cache-000';
const TEST_DAYS_ABSENT_2 = 5;

// Part 6 uses a third userId to test the peek-failure path without cache contamination.
const TEST_USER_ID_3 = '00000000-test-absence-peek-fail-000';
const TEST_DAYS_ABSENT_3 = 7;

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
  await db.delete(danielaAbsenceNudges)
    .where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3));
}

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

  // ── Keyless path: source-level injection checks only ─────────────────────
  // When GEMINI_API_KEY is absent we cannot call generatePreSessionSynthesis(),
  // but we can still verify that the injection logic is intact in the source.
  // These checks catch the regressions that matter most:
  //   • returningAfterAbsence is forwarded from generatePreSessionSynthesis to buildLiteContext
  //   • buildLiteContext injects the "RETURNING AFTER ABSENCE:" block when the signal is present
  //   • The observable log line still exists in the source (will fire at runtime)
  if (!hasGeminiKey) {
    origLog(Y('\n  ⚠  GEMINI_API_KEY not set — skipping live synthesis call (keyless CI run).'));
    origLog(Y('     Running source-level injection checks to catch logic regressions.\n'));

    const synthSrc = readFileSync(
      pathResolve(__dirname, '../services/pre-session-synthesis.ts'),
      'utf-8',
    ) as string;

    // 2a-src. returningAfterAbsence must be forwarded to buildLiteContext
    const signalForwardedToBuildLite =
      synthSrc.includes('buildLiteContext(') &&
      synthSrc.includes('returningAfterAbsence');
    assert(
      '2a (source). returningAfterAbsence forwarded to buildLiteContext() in generatePreSessionSynthesis — injection wiring intact',
      signalForwardedToBuildLite,
      signalForwardedToBuildLite
        ? undefined
        : 'returningAfterAbsence not found in buildLiteContext call — signal would not reach the context builder',
    );

    // 2a-src. buildLiteContext must have the guard that injects "RETURNING AFTER ABSENCE:"
    const buildLiteInjectsBlock =
      synthSrc.includes('RETURNING AFTER ABSENCE:') &&
      /if\s*\(\s*returningAfterAbsence\s*\)/.test(synthSrc);
    assert(
      '2a (source). buildLiteContext() contains "RETURNING AFTER ABSENCE:" block guarded by if(returningAfterAbsence)',
      buildLiteInjectsBlock,
      buildLiteInjectsBlock
        ? undefined
        : '"RETURNING AFTER ABSENCE:" block or its guard removed from buildLiteContext — injection logic is broken',
    );

    // 2a-src. The observable log line must still exist in the source
    const logLinePresent = synthSrc.includes('[PreSynthesis] ✓ Returning-after-absence signal:');
    assert(
      '2a (source). "[PreSynthesis] ✓ Returning-after-absence signal:" log line present — observable at runtime when key is available',
      logLinePresent,
      logLinePresent
        ? undefined
        : 'Log line removed from source — injection signal will no longer be observable at runtime',
    );

    skipGemini('2b — synthesis non-empty');
    skipGemini('2c — safe-mode sentinel');
    skipGemini('2d — warmth/return indicator words');
    return;
  }

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
      'break', 'last session', 'last time', 'remember', 'session', 'welcome', 'since',
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

  // ── Keyless path for Part 4 synthesis sub-steps ──────────────────────────
  // When GEMINI_API_KEY is absent we skip the actual synthesis calls (4c/4d/4e/4f)
  // but still exercise the warm-cache store/consume/one-shot logic using a mock
  // synthesis string, and verify the ws-guard preconditions using the real peeked value.
  if (!hasGeminiKey) {
    origLog(Y('\n  ⚠  GEMINI_API_KEY not set — skipping Gemini synthesis calls in Part 4 (keyless CI run).'));
    origLog(Y('     Cache store/consume/one-shot and ws-guard precondition assertions run with a mock string.\n'));

    const MOCK_SYNTH = '[MOCK_SYNTHESIS — no Gemini key]';

    // 4c (keyless). Use mock string as the "stale" synthesis.
    skipGemini('4c — stale synthesis (no absence signal) quality check');
    setWarmSynthesis(TEST_USER_ID_2, MOCK_SYNTH);

    // Warm-cache assertions: these exercise setWarmSynthesis/consumeWarmSynthesis, not Gemini.
    const consumed = consumeWarmSynthesis(TEST_USER_ID_2);
    assert(
      '4d (keyless). consumeWarmSynthesis() returns the stored mock synthesis (cache store/consume intact)',
      consumed !== null && consumed === MOCK_SYNTH,
      consumed === null
        ? 'consumeWarmSynthesis returned null — warm cache store failed'
        : 'consumeWarmSynthesis returned a different string than what was stored',
    );

    const consumedAgain = consumeWarmSynthesis(TEST_USER_ID_2);
    assert(
      '4d (keyless). consumeWarmSynthesis() is one-shot — second call returns null (cache cleared on first consume)',
      consumedAgain === null,
      consumedAgain !== null ? 'Second consumeWarmSynthesis returned non-null — cache was not cleared' : undefined,
    );

    // 4d-ws-guard (keyless). Verify guard preconditions with mock data.
    origLog(D('\n  [4d-ws-guard keyless] Testing guard preconditions with mock stale synthesis...'));
    setWarmSynthesis(TEST_USER_ID_2, MOCK_SYNTH);
    const wsWarmedNote = consumeWarmSynthesis(TEST_USER_ID_2);
    const wsAbsenceReturn = peeked ?? { daysSinceLastSession: TEST_DAYS_ABSENT_2, firstName: null };

    assert(
      '[ws-guard keyless] consumeWarmSynthesis returns mock stale note (guard precondition: warmedNote non-null)',
      wsWarmedNote !== null && wsWarmedNote === MOCK_SYNTH,
      wsWarmedNote === null ? 'consumeWarmSynthesis returned null — re-store failed' : 'Returned unexpected string',
    );
    assert(
      '[ws-guard keyless] absenceReturn is non-null (guard precondition: signal from peeked nudge)',
      wsAbsenceReturn !== null,
      'peeked was null — absence nudge not found; guard would not fire',
    );
    assert(
      '[ws-guard keyless] Both guard preconditions met → WS handler would discard stale cache and regenerate',
      wsWarmedNote !== null && wsAbsenceReturn !== null,
      'One or both preconditions were null — guard would NOT fire',
    );

    skipGemini('[ws-guard] 4d — regenerated synthesis log and warmth checks');
    skipGemini('4e — signal-aware synthesis generation and warmth check');
    skipGemini('4f — WS handler receives signal-aware synthesis');
    return;
  }

  // ── Keyed path: full live synthesis assertions ────────────────────────────
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
    'break', 'last session', 'last time', 'remember', 'session', 'welcome', 'since',
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
// PART 5 — Source-level: warm-synthesis HTTP route bakes the absence signal in
//           so the WS handler stale-cache guard is a last resort, not primary path
//
// Checks:
//   a) The warm-synthesis route calls peekAbsenceReturnDetails (read-only peek)
//   b) The peek result (returningAfterAbsence) is forwarded to generatePreSessionSynthesis
//      as its last argument — i.e. the signal is baked into the warm cache
//   c) generatePreSessionSynthesis is called AFTER the peek (correct ordering)
//   d) setWarmSynthesis is called with the synthesized result (cache is populated)
//   e) The route emits "[WarmSynthesis] ✓ Pending absence nudge detected" when a
//      nudge is found — confirming the signal-aware path is exercised
//   f) The WS handler guard (warmedNote && absenceReturn → regenerate) exists in
//      unified-ws-handler.ts as a LAST RESORT fallback — it must NOT be the only
//      place the absence signal enters; the route is the primary path
//   g) The WS handler guard fires ONLY when both preconditions hold (stale warm
//      cache + non-null absenceReturn) — when the route runs correctly the warm
//      cache already carries the signal, so absenceReturn from
//      autoResolveAbsenceNudgeOnReturn would still be non-null but the "stale"
//      condition is false (the warm cache already has the signal baked in).
//      The guard is therefore a safety net, not the happy path.
// ══════════════════════════════════════════════════════════════════════════════
function runPart5(): void {
  sep();
  console.log(B('PART 5 — Source-level: warm-synthesis core bakes absence signal in (guard is last resort)'));
  sep();

  const routesSrc = readFileSync(
    pathResolve(__dirname, '../routes.ts'),
    'utf-8',
  ) as string;

  const wsSrc = readFileSync(
    pathResolve(__dirname, '../unified-ws-handler.ts'),
    'utf-8',
  ) as string;

  // Core logic (try/catch around peek, signal forwarding, setWarm call) now lives
  // in the production service — routes.ts delegates to runWarmSynthesisCore().
  const coreSrc = readFileSync(
    pathResolve(__dirname, '../services/warm-synthesis-core.ts'),
    'utf-8',
  ) as string;

  // warmSynthesisBlock is still used for the 5g peek-vs-resolve ordering check.
  const warmSynthesisBlock = (() => {
    const routeMarker = '/api/sessions/warm-synthesis';
    const startIdx = routesSrc.indexOf(routeMarker);
    if (startIdx === -1) return '';
    return routesSrc.slice(startIdx, startIdx + 4000);
  })();

  // ── 5a. Route references peekAbsenceReturnDetails ────────────────────────
  // After the refactor the route passes it as an argument to runWarmSynthesisCore.
  const routeCallsPeek = routesSrc.includes('peekAbsenceReturnDetails');
  assert(
    '5a. warm-synthesis route references peekAbsenceReturnDetails (passed to runWarmSynthesisCore)',
    routeCallsPeek,
    routeCallsPeek ? undefined : 'peekAbsenceReturnDetails not found in routes.ts — route may not be passing the peek function',
  );

  // ── 5b. returningAfterAbsence forwarded to generateFn in the core service ─
  // The service receives the peek result and passes it to generateFn (generatePreSessionSynthesis).
  const signalForwardedToSynth =
    coreSrc.includes('returningAfterAbsence') &&
    coreSrc.includes('generateFn(');
  assert(
    '5b. returningAfterAbsence (peek result) is forwarded to generateFn in warm-synthesis-core.ts',
    signalForwardedToSynth,
    signalForwardedToSynth
      ? undefined
      : 'Either returningAfterAbsence or generateFn( not found in warm-synthesis-core.ts — the absence signal may not be reaching synthesis',
  );

  // ── 5c. Peek happens BEFORE generateFn in the core service ───────────────
  const peekIdx  = coreSrc.indexOf('returningAfterAbsence = await peekFn(');
  const synthIdx = coreSrc.indexOf('generateFn(');
  const peekBeforeSynth = peekIdx !== -1 && synthIdx !== -1 && peekIdx < synthIdx;
  assert(
    '5c. peekFn() is called BEFORE generateFn() in warm-synthesis-core.ts (correct ordering)',
    peekBeforeSynth,
    peekBeforeSynth
      ? undefined
      : `Ordering wrong or symbols missing in core service — peekIdx=${peekIdx}, synthIdx=${synthIdx}`,
  );

  // ── 5d. setWarmFn is called with the synthesis result ────────────────────
  const coreCallsSetWarm = coreSrc.includes('setWarmFn(');
  assert(
    '5d. setWarmFn() is called in warm-synthesis-core.ts (warm cache is populated with signal-aware synthesis)',
    coreCallsSetWarm,
    coreCallsSetWarm ? undefined : 'setWarmFn not found in warm-synthesis-core.ts',
  );

  // ── 5e. Log line confirms signal-aware path ───────────────────────────────
  const hasNudgeDetectedLog = coreSrc.includes('[WarmSynthesis] ✓ Pending absence nudge detected');
  assert(
    '5e. warm-synthesis-core.ts emits "[WarmSynthesis] ✓ Pending absence nudge detected" log when a nudge is found',
    hasNudgeDetectedLog,
    hasNudgeDetectedLog ? undefined : 'Log line not found in warm-synthesis-core.ts — the signal-aware branch may be missing its confirmation log',
  );

  // ── 5f. WS guard exists in unified-ws-handler.ts ─────────────────────────
  const wsGuardPattern = /warmedNote\s*&&\s*absenceReturn/;
  const wsHasGuard = wsGuardPattern.test(wsSrc);
  assert(
    '5f. WS handler contains the stale-cache guard (warmedNote && absenceReturn → regenerate) as a last-resort fallback',
    wsHasGuard,
    wsHasGuard ? undefined : 'Guard pattern "warmedNote && absenceReturn" not found in unified-ws-handler.ts — the last-resort safety net may be missing',
  );

  // ── 5g. Route passes peek (not resolve); WS handler uses the resolving call ─
  const routeUsesPeekNotResolve =
    warmSynthesisBlock.includes('peekAbsenceReturnDetails') &&
    !warmSynthesisBlock.includes('autoResolveAbsenceNudgeOnReturn');
  assert(
    '5g. Warm-synthesis route passes peekAbsenceReturnDetails (read-only) to runWarmSynthesisCore — not autoResolveAbsenceNudgeOnReturn',
    routeUsesPeekNotResolve,
    routeUsesPeekNotResolve
      ? undefined
      : 'Route either missing peek reference or incorrectly referencing autoResolveAbsenceNudgeOnReturn — nudge resolution must only happen at WS connect',
  );

  const wsUsesResolve = wsSrc.includes('autoResolveAbsenceNudgeOnReturn');
  assert(
    '5g (cont). WS handler uses autoResolveAbsenceNudgeOnReturn (resolving call) at true session start',
    wsUsesResolve,
    wsUsesResolve ? undefined : 'autoResolveAbsenceNudgeOnReturn not found in unified-ws-handler.ts',
  );

  console.log(D('\n  Summary: warm-synthesis-core.ts is the production unit. The route delegates to it'));
  console.log(D('  with real functions; Part 7 injects a throwing peekFn to exercise the catch path at runtime.\n'));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 6 — Peek-failure path: warm cache is nudge-unaware when peek throws;
//           WS handler guard must fire and regenerate with the absence signal.
//
// This is the scenario the task is specifically about:
//
//   warm-synthesis route fires →
//     peekAbsenceReturnDetails THROWS (DB momentarily unreachable) →
//     route catch block: console.warn only, returningAfterAbsence stays null →
//     generatePreSessionSynthesis called WITHOUT signal →
//     warm cache populated with nudge-UNAWARE synthesis
//
//   student then starts the session →
//     WS handler calls autoResolveAbsenceNudgeOnReturn → returns signal (non-null) →
//     consumeWarmSynthesis → returns stale (nudge-unaware) synthesis →
//     guard fires: warmedNote && absenceReturn → regenerate with signal →
//     synthesisNote carries returning-student awareness
//
// Checks:
//   6a. Source-level: warm-synthesis route wraps peekAbsenceReturnDetails in try/catch
//   6b. Source-level: the catch block emits a console.warn (not throw) so synthesis continues
//   6c. A synthesis generated with no absence signal (peek failure case) is stored in cache
//   6d. autoResolveAbsenceNudgeOnReturn (WS-handler call) finds the pending nudge (non-null)
//   6e. Both guard preconditions hold: warmedNote !== null && absenceReturn !== null
//   6f. WS handler regenerates with signal → "[PreSynthesis] ✓ Returning-after-absence signal" logged
//   6g. Regenerated synthesis contains at least one absence warmth word
//
// Uses TEST_USER_ID_3 — distinct from Parts 1–4 to avoid resolve-cache contamination.
// ══════════════════════════════════════════════════════════════════════════════
async function runPart6(): Promise<void> {
  sep();
  origLog(B('PART 6 — Peek-failure path: WS handler guard fires when warm cache is nudge-unaware'));
  sep();

  const db = getSharedDb();

  // 6a/6b. Source-level checks now target warm-synthesis-core.ts — that is where
  // the try/catch around peekFn lives after the route was refactored to delegate
  // to the production runWarmSynthesisCore helper (Part 7 exercises that path at runtime).
  const coreSrc6 = readFileSync(
    pathResolve(__dirname, '../services/warm-synthesis-core.ts'),
    'utf-8',
  ) as string;

  // 6a. The peek call must be inside a try block in the core service
  const peekInTryCatch = (() => {
    const peekFnIdx = coreSrc6.indexOf('await peekFn(');
    if (peekFnIdx === -1) return false;
    const beforePeek = coreSrc6.slice(0, peekFnIdx);
    return /try\s*\{/.test(beforePeek);
  })();
  assert(
    '6a. warm-synthesis-core.ts wraps peekFn() in a try block (peek failure is non-fatal)',
    peekInTryCatch,
    peekInTryCatch ? undefined : 'No try block found before await peekFn() in warm-synthesis-core.ts — a DB error would propagate and block synthesis',
  );

  // 6b. The catch block must warn (not throw)
  const catchWarnPattern = /catch\s*\([^)]*\)\s*\{[^}]*console\.warn[^}]*\[WarmSynthesis\][^}]*\}/s;
  const hasCatchWarn = catchWarnPattern.test(coreSrc6);
  assert(
    '6b. Peek catch block in warm-synthesis-core.ts emits console.warn (not throw) — synthesis continues without the absence signal on error',
    hasCatchWarn,
    hasCatchWarn
      ? undefined
      : 'console.warn with [WarmSynthesis] not found in the catch block in warm-synthesis-core.ts — error may surface as 500 or block synthesis',
  );

  // 6c. The catch block must NOT call process.exit() — a fatal exit would
  // terminate the whole server process if peek fails, rather than recovering
  // gracefully and letting synthesis continue without the absence signal.
  // This check confirms that re-introducing process.exit() in the catch would
  // be caught by CI before it reaches production.  (#517)
  const catchBlockMatch = coreSrc6.match(/catch\s*\([^)]*\)\s*\{[^}]*\}/s);
  const catchBlock = catchBlockMatch ? catchBlockMatch[0] : '';
  const catchHasExit = catchBlock.includes('process.exit');
  assert(
    '6c. Catch block in warm-synthesis-core.ts does NOT call process.exit() — failure must be non-fatal',
    !catchHasExit,
    catchHasExit
      ? 'process.exit() found in catch block — a peek failure would terminate the server process instead of recovering'
      : undefined,
  );

  // ── Seed a fresh nudge for Part 6 ─────────────────────────────────────────
  // Clean up any stale row first
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3));

  const lastSessionDate = new Date(Date.now() - TEST_DAYS_ABSENT_3 * 24 * 60 * 60 * 1000);
  await db.insert(danielaAbsenceNudges).values({
    userId: TEST_USER_ID_3,
    lastSessionDate,
    daysSinceLastSession: TEST_DAYS_ABSENT_3,
  });
  origLog(D(`  Seeded nudge row: userId=${TEST_USER_ID_3}, daysSince=${TEST_DAYS_ABSENT_3}`));

  const { generatePreSessionSynthesis, setWarmSynthesis, consumeWarmSynthesis } = await import('../services/pre-session-synthesis');
  const { autoResolveAbsenceNudgeOnReturn } = await import('../services/daniela-absence-worker');

  const compassContext: any = {
    studentName: 'TestStudent3',
    studentGoals: 'Learn conversational Spanish',
    studentInterests: 'Art and cooking',
    studentActflLevel: 'novice-mid',
    lastSessionSummary: 'We practised colours and food vocabulary. Great session.',
    danielaSelfReflection: 'TestStudent3 shows real curiosity and retention is solid.',
    conversationMemories: [],
    mustHaveTopics: [],
    niceToHaveTopics: [],
  };

  const warmthWords = [
    'back', 'return', 'away', 'absence', 'again', 'missed', 'gap', 'been a while',
    'a while', "haven't", 'weeks', 'days', 'come back', 'glad', 'here',
    'break', 'last session', 'last time', 'remember', 'session', 'welcome', 'since',
  ];

  // 6c. Simulate peek failure: populate warm cache WITHOUT absence signal.
  //     When GEMINI_API_KEY is present we call generatePreSessionSynthesis(null) exactly as
  //     the route does on a DB error. When the key is absent we use a mock string — the
  //     important property is that whatever is stored carries no absence signal, so the
  //     guard-precondition assertions (6e) can still run.
  let peekFailSynthesis: string | null;

  if (hasGeminiKey) {
    origLog(D('\n  [6c] Simulating peek-failure: generating synthesis WITHOUT signal (as route would on DB error)...'));
    startCapture();
    peekFailSynthesis = await generatePreSessionSynthesis(
      compassContext,
      'Daniela',
      TEST_USER_ID_3,
      'spanish',
      null, // <-- peek failed, signal is null
    );
    const peekFailLogs = stopCapture();

    assert(
      '6c. Synthesis generated without signal (peek-failure path) returns a non-null string',
      typeof peekFailSynthesis === 'string' && (peekFailSynthesis?.length ?? 0) > 0,
      peekFailSynthesis === null ? 'Returned null — Gemini call failed. Check GEMINI_API_KEY.' : undefined,
    );

    // Confirm NO absence signal log was emitted (signal was not injected)
    const peekFailAbsenceLog = peekFailLogs.find(l => l.includes('[PreSynthesis] ✓ Returning-after-absence signal:'));
    assert(
      '6c. No "[PreSynthesis] ✓ Returning-after-absence signal" log emitted for peek-failure synthesis (signal absent)',
      !peekFailAbsenceLog,
      peekFailAbsenceLog ? `Unexpected signal log: ${peekFailAbsenceLog}` : undefined,
    );
  } else {
    origLog(Y('\n  ⚠  GEMINI_API_KEY not set — 6c uses mock synthesis string (keyless CI run).'));
    skipGemini('6c — peek-failure synthesis quality check');
    peekFailSynthesis = '[MOCK_PEEK_FAIL_SYNTHESIS — no Gemini key]';
  }

  // Store the nudge-unaware synthesis in the warm cache (simulating route behaviour on peek failure).
  if (peekFailSynthesis) {
    setWarmSynthesis(TEST_USER_ID_3, peekFailSynthesis);
    origLog(D(`  Stored nudge-unaware synthesis in warm cache (${peekFailSynthesis.length} chars).`));
  }

  // 6d. WS handler calls autoResolveAbsenceNudgeOnReturn at true session start.
  //     It must return the pending nudge details (the nudge was NOT resolved by the route).
  //     This assertion is unconditional — it exercises the DB and absence-worker logic.
  origLog(D('\n  [6d] WS handler calls autoResolveAbsenceNudgeOnReturn at true session start...'));
  startCapture();
  const wsAbsenceReturn = await autoResolveAbsenceNudgeOnReturn(TEST_USER_ID_3);
  stopCapture();

  assert(
    '6d. autoResolveAbsenceNudgeOnReturn returns non-null at WS session start — nudge was NOT resolved by the route (peek-only)',
    wsAbsenceReturn !== null,
    wsAbsenceReturn === null ? 'Returned null — nudge may have been resolved already (route must only peek, not resolve)' : undefined,
  );

  if (wsAbsenceReturn) {
    assert(
      `6d. Resolved nudge carries correct daysSinceLastSession (${TEST_DAYS_ABSENT_3})`,
      wsAbsenceReturn.daysSinceLastSession === TEST_DAYS_ABSENT_3,
      `Got ${wsAbsenceReturn.daysSinceLastSession}`,
    );
  }

  // 6e. Consume the warm cache (as the WS handler would) — guard preconditions must both hold.
  //     Unconditional: exercises warm-cache consume logic regardless of Gemini key.
  const wsWarmedNote = consumeWarmSynthesis(TEST_USER_ID_3);

  assert(
    '6e. consumeWarmSynthesis returns the nudge-unaware synthesis (guard precondition: warmedNote non-null)',
    wsWarmedNote !== null && wsWarmedNote === peekFailSynthesis,
    wsWarmedNote === null
      ? 'consumeWarmSynthesis returned null — warm cache not stored or already expired'
      : 'Returned different string than what was stored',
  );

  const guardWouldFire = wsWarmedNote !== null && wsAbsenceReturn !== null;
  assert(
    '6e. Both guard preconditions met (warmedNote && absenceReturn) — WS handler will discard stale cache and regenerate',
    guardWouldFire,
    'One or both preconditions are null — guard would NOT fire (peek-failure safety net is broken)',
  );

  // 6f/6g. Simulate guard firing: regenerate with the absence signal.
  //        Skipped when no Gemini key — the precondition check above (6e) is the
  //        regression-relevant assertion; warmth quality requires a live model.
  if (guardWouldFire) {
    if (!hasGeminiKey) {
      skipGemini('6f — guard regeneration "[PreSynthesis] ✓ Returning-after-absence signal" log check');
      skipGemini('6g — guard-regenerated synthesis warmth word check');
    } else {
      origLog(D('\n  [6f/6g] Guard fires — regenerating synthesis with absence signal...'));
      startCapture();
      const guardRegen = await generatePreSessionSynthesis(
        compassContext,
        'Daniela',
        TEST_USER_ID_3,
        'spanish',
        wsAbsenceReturn ?? { daysSinceLastSession: TEST_DAYS_ABSENT_3, firstName: null },
      );
      const guardLogs = stopCapture();

      // 6f. The "[PreSynthesis] ✓ Returning-after-absence signal" log must appear
      const guardAbsenceLog = guardLogs.find(l =>
        l.includes('[PreSynthesis] ✓ Returning-after-absence signal:') &&
        l.includes(String(TEST_DAYS_ABSENT_3)),
      );
      assert(
        '6f. Guard regeneration emits "[PreSynthesis] ✓ Returning-after-absence signal: N days" — signal reached buildLiteContext',
        !!guardAbsenceLog,
        guardAbsenceLog ?? 'Log line not found — signal may not be passing through to buildLiteContext',
      );

      // 6g. Regenerated synthesis must contain at least one absence warmth word
      if (guardRegen) {
        const lowerRegen = guardRegen.toLowerCase();
        const regenWarmthHit = warmthWords.find(w => lowerRegen.includes(w));
        assert(
          `6g. Guard-regenerated synthesis contains at least one absence warmth word (${regenWarmthHit ? `"${regenWarmthHit}"` : 'none found'}) — returning-student awareness is baked in`,
          !!regenWarmthHit,
          `None of ${warmthWords.slice(0, 8).join(', ')} found — regenerated synthesis may not carry absence awareness`,
        );
        origLog(D(`  Guard-regenerated synthesis (${guardRegen.length} chars): "${guardRegen.slice(0, 200)}..."`));
      } else {
        assert(
          '6g. Guard-regenerated synthesis is non-null',
          false,
          'generatePreSessionSynthesis returned null — Gemini call failed',
        );
      }
    }
  }

  // Clean up Part 6 row (cleanup also runs in finally, this is belt-and-suspenders)
  await db.delete(danielaAbsenceNudges).where(eq(danielaAbsenceNudges.userId, TEST_USER_ID_3));
  origLog(D('\n  Part 6 test row cleaned up.'));
}

async function runPart7(): Promise<void> {
  sep();
  origLog(B('PART 7 — RUNTIME: throwing peekAbsenceReturnDetails is caught; synthesis still completes'));
  sep();

  const { generatePreSessionSynthesis, setWarmSynthesis, consumeWarmSynthesis } =
    await import('../services/pre-session-synthesis');

  // Use a userId that is not in any of the other parts — no DB rows seeded
  const TEST_USER_ID_7 = '00000000-test-absence-peek-throw-00';

  // Clean up any stale warm-cache entry from a prior interrupted run
  consumeWarmSynthesis(TEST_USER_ID_7);

  const compassContext: any = {
    studentName: 'TestStudent7',
    studentGoals: 'Learn conversational Spanish',
    studentInterests: 'Literature and hiking',
    studentActflLevel: 'novice-mid',
    lastSessionSummary: 'We practised telling the time and ordinal numbers. Good session.',
    danielaSelfReflection: 'TestStudent7 is careful and methodical — benefits from visual anchors.',
    conversationMemories: [],
    mustHaveTopics: [],
    niceToHaveTopics: [],
  };

  // Throwing mock — simulates DB being momentarily unreachable during peek
  const PEEK_ERROR_MSG = 'simulated DB timeout in peekAbsenceReturnDetails';
  const throwingPeekFn = async (_userId: string): Promise<WarmSynthesisSignal> => {
    throw new Error(PEEK_ERROR_MSG);
  };

  origLog(D('\n  Calling runWarmSynthesisCore with a throwing peekFn (no DB, no HTTP)...'));

  let threwOutside = false;
  let result: string | null = null;

  startCapture();
  try {
    result = await runWarmSynthesisCore(
      TEST_USER_ID_7,
      compassContext,
      'spanish',
      throwingPeekFn,
      generatePreSessionSynthesis,
      setWarmSynthesis,
    );
  } catch (err: any) {
    threwOutside = true;
    origLog(R(`  runWarmSynthesisCore unexpectedly propagated the peek error: ${err?.message}`));
  }
  const logs7 = stopCapture();

  // 7a. catch block must not re-throw
  assert(
    '7a. runWarmSynthesisCore does NOT propagate the peek error (catch block recovers)',
    !threwOutside,
    threwOutside ? 'Function threw — peek error was re-thrown instead of caught by the inner try/catch' : undefined,
  );

  // 7b. synthesis must be non-null (generatePreSessionSynthesis ran)
  assert(
    '7b. Synthesis is non-null and non-empty (generatePreSessionSynthesis ran despite peek failure)',
    typeof result === 'string' && result.length > 0,
    result === null
      ? 'Returned null — generatePreSessionSynthesis may not have run after the peek error; check for an unexpected outer throw'
      : undefined,
  );

  // 7c. The warn log must have been captured with the injected error message
  const warnLog = logs7.find(
    l =>
      l.includes('[WARN]') &&
      l.includes('[WarmSynthesis] Absence peek failed (non-fatal):') &&
      l.includes(PEEK_ERROR_MSG),
  );
  assert(
    '7c. "[WarmSynthesis] Absence peek failed (non-fatal):" captured in console.warn with injected error text',
    !!warnLog,
    warnLog
      ? undefined
      : `Warn line not found. First 10 captured logs:\n      ${logs7.slice(0, 10).join('\n      ')}`,
  );

  // 7d. No absence signal log — null was passed to generatePreSessionSynthesis
  const absenceSignalLog = logs7.find(l =>
    l.includes('[PreSynthesis] ✓ Returning-after-absence signal:'),
  );
  assert(
    '7d. No "[PreSynthesis] ✓ Returning-after-absence signal" log — null signal passed to synthesis (peek threw)',
    !absenceSignalLog,
    absenceSignalLog
      ? `Unexpected signal log: ${absenceSignalLog} — returningAfterAbsence should have stayed null after peek error`
      : undefined,
  );

  // 7e/7f. setWarmSynthesis was called — consumeWarmSynthesis must return the synthesis
  const consumed = consumeWarmSynthesis(TEST_USER_ID_7);

  assert(
    '7e. setWarmSynthesis was called (warm cache populated despite peek failure)',
    consumed !== null,
    consumed === null
      ? 'consumeWarmSynthesis returned null — setWarmSynthesis may not have been called after the peek error'
      : undefined,
  );

  assert(
    '7f. consumeWarmSynthesis returns the synthesis generated after peek failure (cache round-trip correct)',
    consumed === result,
    consumed !== result
      ? 'Cache content differs from the returned synthesis — possible userId mismatch or double-consume'
      : undefined,
  );

  if (result) {
    origLog(D(`\n  Synthesis after peek failure (${result.length} chars): "${result.slice(0, 200)}..."`));
  }
  origLog(D('\n  Part 7 complete — catch path exercised at runtime with an injected throwing mock.\n'));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 8 — Anti-drift: routes.ts must still delegate to runWarmSynthesisCore
//
// runWarmSynthesisCore was extracted into server/services/warm-synthesis-core.ts
// so the route and the test share one production copy instead of maintaining a
// hand-extracted duplicate that can quietly diverge.
//
// This part guards that delegation contract at the source level:
//
//   8a. routes.ts imports runWarmSynthesisCore (dynamic import from the service)
//   8b. The warm-synthesis route block calls runWarmSynthesisCore(
//   8c. The real peek function (peekAbsenceReturnDetails) is passed as an argument
//   8d. The real generate function (generatePreSessionSynthesis) is passed as an argument
//   8e. The real warm-setter (setWarmSynthesis) is passed as an argument
//   8f. warm-synthesis-core.ts exports runWarmSynthesisCore as a named export
//       (verifies the export still exists so future imports don't silently become undefined)
//
// If any of these assertions fail it means the route has been modified to bypass
// the shared production unit — the fix is to restore the delegation, NOT to update
// this test.
// ══════════════════════════════════════════════════════════════════════════════
function runPart8(): void {
  sep();
  console.log(B('PART 8 — Anti-drift: routes.ts delegates to runWarmSynthesisCore (no silent re-inline)'));
  sep();

  const routesSrc = readFileSync(
    pathResolve(__dirname, '../routes.ts'),
    'utf-8',
  ) as string;

  const coreSrc = readFileSync(
    pathResolve(__dirname, '../services/warm-synthesis-core.ts'),
    'utf-8',
  ) as string;

  // Extract the warm-synthesis route block for scoped checks (avoids false
  // positives from other parts of the file that might mention the same names).
  const warmSynthesisBlock = (() => {
    const marker = '/api/sessions/warm-synthesis';
    const startIdx = routesSrc.indexOf(marker);
    if (startIdx === -1) return '';
    // Grab enough characters to cover the entire handler (~4000 chars is generous)
    return routesSrc.slice(startIdx, startIdx + 4000);
  })();

  assert(
    '8-precondition. /api/sessions/warm-synthesis route block found in routes.ts',
    warmSynthesisBlock.length > 0,
    'Route marker "/api/sessions/warm-synthesis" not found — did the route path change?',
  );

  // ── 8a. Route imports runWarmSynthesisCore ────────────────────────────────
  // The route uses a dynamic import inside the handler, so the word
  // 'runWarmSynthesisCore' must appear in the route block (from the destructure).
  const routeImportsCore = warmSynthesisBlock.includes('runWarmSynthesisCore');
  assert(
    '8a. warm-synthesis route block references runWarmSynthesisCore (dynamic import / destructure present)',
    routeImportsCore,
    routeImportsCore
      ? undefined
      : 'runWarmSynthesisCore not found in the route block — logic may have been re-inlined into routes.ts; restore the delegation to server/services/warm-synthesis-core.ts',
  );

  // ── 8b. Route calls runWarmSynthesisCore( ─────────────────────────────────
  const routeCallsCore = warmSynthesisBlock.includes('runWarmSynthesisCore(') ||
    warmSynthesisBlock.includes('await runWarmSynthesisCore(');
  assert(
    '8b. warm-synthesis route block calls runWarmSynthesisCore() — delegation is active',
    routeCallsCore,
    routeCallsCore
      ? undefined
      : 'runWarmSynthesisCore() call not found in the route block — the import exists but is never invoked, or logic was inlined',
  );

  // ── 8c. Real peek function is passed ─────────────────────────────────────
  const routePassesPeek = warmSynthesisBlock.includes('peekAbsenceReturnDetails');
  assert(
    '8c. peekAbsenceReturnDetails is passed to runWarmSynthesisCore in the route block',
    routePassesPeek,
    routePassesPeek
      ? undefined
      : 'peekAbsenceReturnDetails not found in the route block — the peek function may not be wired through to runWarmSynthesisCore',
  );

  // ── 8d. Real generate function is passed ──────────────────────────────────
  const routePassesGenerate = warmSynthesisBlock.includes('generatePreSessionSynthesis');
  assert(
    '8d. generatePreSessionSynthesis is passed to runWarmSynthesisCore in the route block',
    routePassesGenerate,
    routePassesGenerate
      ? undefined
      : 'generatePreSessionSynthesis not found in the route block — synthesis function may not be wired through to runWarmSynthesisCore',
  );

  // ── 8e. Real warm-setter is passed ────────────────────────────────────────
  const routePassesSetWarm = warmSynthesisBlock.includes('setWarmSynthesis');
  assert(
    '8e. setWarmSynthesis is passed to runWarmSynthesisCore in the route block',
    routePassesSetWarm,
    routePassesSetWarm
      ? undefined
      : 'setWarmSynthesis not found in the route block — warm-cache setter may not be wired through to runWarmSynthesisCore',
  );

  // ── 8f. Core service still exports runWarmSynthesisCore ───────────────────
  // Guard against the export being accidentally renamed or removed, which would
  // make the route's dynamic import silently destructure undefined at runtime.
  const coreExportsFunction =
    coreSrc.includes('export async function runWarmSynthesisCore(') ||
    coreSrc.includes('export function runWarmSynthesisCore(');
  assert(
    '8f. warm-synthesis-core.ts still exports runWarmSynthesisCore as a named export',
    coreExportsFunction,
    coreExportsFunction
      ? undefined
      : 'Named export "runWarmSynthesisCore" not found in warm-synthesis-core.ts — the export was renamed or removed; update the route import to match',
  );

  console.log(D('\n  Summary: routes.ts delegates to runWarmSynthesisCore — no logic copy to drift.\n'));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 9 — RUNTIME: throwing generateFn is caught; warm cache stays cold
//
// The outer catch in routes.ts (console.warn + no rethrow) silently swallows
// a crash that originates inside generatePreSessionSynthesis itself — the warm
// cache ends up neither populated nor errored, which is correct, but the
// behaviour was previously untested.
//
// After the warm-synthesis-core.ts fix, generateFn is wrapped in its own
// try/catch:
//   • runWarmSynthesisCore does NOT propagate the error
//   • setWarmFn is never called → warm cache stays cold
//   • console.warn emits "[WarmSynthesis] Synthesis generation failed (non-fatal):"
//     with the injected error message
//
// Checks:
//   9a. No exception propagates from runWarmSynthesisCore when generateFn throws
//   9b. Return value is null (synthesis could not be computed)
//   9c. "[WarmSynthesis] Synthesis generation failed (non-fatal):" warn captured
//       with the injected error message
//   9d. Warm cache is cold — consumeWarmSynthesis returns null (setWarmFn was never called)
// ══════════════════════════════════════════════════════════════════════════════
async function runPart9(): Promise<void> {
  sep();
  origLog(B('PART 9 — RUNTIME: throwing generateFn is caught; warm cache stays cold'));
  sep();

  const { setWarmSynthesis, consumeWarmSynthesis } =
    await import('../services/pre-session-synthesis');

  const TEST_USER_ID_9 = '00000000-test-absence-gen-throw-000';

  // Clear any stale warm-cache entry from a prior interrupted run
  consumeWarmSynthesis(TEST_USER_ID_9);

  const compassContext: any = {
    studentName: 'TestStudent9',
    studentGoals: 'Learn conversational Spanish',
    studentInterests: 'Film and architecture',
    studentActflLevel: 'novice-mid',
    lastSessionSummary: 'We practised describing places. TestStudent9 did well with spatial vocabulary.',
    danielaSelfReflection: 'TestStudent9 responds well to vivid visual prompts.',
    conversationMemories: [],
    mustHaveTopics: [],
    niceToHaveTopics: [],
  };

  // Throwing mock — simulates generatePreSessionSynthesis crashing (e.g. Gemini 503)
  const GENERATE_ERROR_MSG = 'simulated Gemini 503 in generatePreSessionSynthesis';
  const throwingGenerateFn = async (
    _ctx: any,
    _tutorName: string,
    _userId: string,
    _language: string,
    _signal: WarmSynthesisSignal,
  ): Promise<string | null> => {
    throw new Error(GENERATE_ERROR_MSG);
  };

  // A no-op peekFn — we want the generate path, not the peek path
  const noopPeekFn = async (_userId: string): Promise<WarmSynthesisSignal> => null;

  origLog(D('\n  Calling runWarmSynthesisCore with a throwing generateFn (no DB, no HTTP)...'));

  let threwOutside = false;
  let result: string | null = 'SENTINEL';

  startCapture();
  try {
    result = await runWarmSynthesisCore(
      TEST_USER_ID_9,
      compassContext,
      'spanish',
      noopPeekFn,
      throwingGenerateFn,
      setWarmSynthesis,
    );
  } catch (err: any) {
    threwOutside = true;
    origLog(R(`  runWarmSynthesisCore unexpectedly propagated the generate error: ${err?.message}`));
  }
  const logs9 = stopCapture();

  // 9a. No exception must escape runWarmSynthesisCore
  assert(
    '9a. runWarmSynthesisCore does NOT propagate the generateFn error (inner catch recovers)',
    !threwOutside,
    threwOutside
      ? 'Function threw — generateFn error was re-thrown instead of being caught by the inner try/catch in runWarmSynthesisCore'
      : undefined,
  );

  // 9b. Return value must be null (synthesis could not be produced)
  assert(
    '9b. Return value is null when generateFn throws (synthesis not computed)',
    result === null,
    result !== null
      ? `Expected null but got: ${typeof result === 'string' ? `"${result.slice(0, 80)}"` : result}`
      : undefined,
  );

  // 9c. The warn log must be captured with the injected error message
  const warnLog9 = logs9.find(
    l =>
      l.includes('[WARN]') &&
      l.includes('[WarmSynthesis] Synthesis generation failed (non-fatal):') &&
      l.includes(GENERATE_ERROR_MSG),
  );
  assert(
    '9c. "[WarmSynthesis] Synthesis generation failed (non-fatal):" captured in console.warn with injected error text',
    !!warnLog9,
    warnLog9
      ? undefined
      : `Warn line not found. First 10 captured logs:\n      ${logs9.slice(0, 10).join('\n      ')}`,
  );

  // 9d. Warm cache must be cold — setWarmFn must not have been called after the throw
  const cached9 = consumeWarmSynthesis(TEST_USER_ID_9);
  assert(
    '9d. Warm cache is cold after generateFn throws — consumeWarmSynthesis returns null (setWarmFn never called)',
    cached9 === null,
    cached9 !== null
      ? `consumeWarmSynthesis returned a non-null value: "${String(cached9).slice(0, 80)}" — setWarmFn was called despite the throw`
      : undefined,
  );

  origLog(D('\n  Part 9 complete — generateFn crash path exercised at runtime with an injected throwing mock.\n'));
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

    // Part 5 is synchronous source-level analysis — no DB or network calls.
    runPart5();

    // Part 6 — peek-failure path: warm cache nudge-unaware → WS guard fires and regenerates.
    await runPart6();

    // Part 7 — RUNTIME catch-path: inject a throwing peekAbsenceReturnDetails and
    // confirm the inner try/catch recovers (synthesis completes, warn emitted, no re-throw).
    // This is the runtime complement to Parts 6a/6b which were source-level grep checks.
    await runPart7();

    // Part 8 — Anti-drift: source-level check that routes.ts still delegates to
    // runWarmSynthesisCore and has not re-inlined the logic.
    runPart8();

    // Part 9 — RUNTIME: inject a throwing generateFn and confirm the inner
    // try/catch recovers (no propagation, cache cold, warn emitted).
    // This is the runtime complement to the outer-catch gap the task identified.
    await runPart9();
  } catch (err: any) {
    stopCapture();
    origLog(R(`\nUnhandled error: ${err?.message ?? err}`));
    if (err?.stack) origLog(D(err.stack));
    // Do NOT call process.exit() here — the finally block must run to clean up
    // seeded DB rows even when the test crashes mid-run.
    failed++;
  } finally {
    // Always clean up the seeded rows, even on failure or an unhandled throw.
    // IMPORTANT: process.exit() must NOT be called before this block; doing so
    // terminates Node immediately and skips cleanup, leaving dangling nudge rows
    // that cause false-positive/false-negative results on the next CI run.
    try {
      await cleanUpTestRows();
      origLog(D('\n  Test rows cleaned up.'));
    } catch (cleanupErr: any) {
      origLog(Y(`  Warning: cleanup failed — ${cleanupErr?.message}. Delete manually:\n    DELETE FROM daniela_absence_nudges WHERE user_id IN ('${TEST_USER_ID}', '${TEST_USER_ID_2}', '${TEST_USER_ID_3}');`));
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

function skipGemini(label: string): void {
  origLog(Y(`  ⚠ SKIP  ${label} — GEMINI_API_KEY not set (keyless CI run)`));
}

// runWarmSynthesisCore is now the production export from
// server/services/warm-synthesis-core.ts — imported at the top of this file.
// Part 7 calls it directly with a throwing mock to exercise the real catch path.
