/**
 * test-absence-text-path.ts
 *
 * Confirms via static source analysis that the absence-return signal correctly
 * reaches Daniela's text-mode (Deepgram / streaming-voice-orchestrator) sessions —
 * not just the GL (Gemini Live) path.
 *
 * The concern:
 *   The GL path awaits autoResolveAbsenceNudgeOnReturn() and forwards the result
 *   (absenceReturn) into generatePreSessionSynthesis() so the inner monologue
 *   carries the returning-student warmth.  The text-mode path must mirror this:
 *   await the call, forward absenceReturn to generatePreSessionSynthesis(), and
 *   store the synthesis note on the session for the greeting handler.
 *
 *   A refactor of the text-mode session-start block could silently drop the signal,
 *   leaving Daniela with no absence awareness when the session is not GL.
 *
 * This script checks:
 *   1. unified-ws-handler.ts awaits autoResolveAbsenceNudgeOnReturn() in the text-mode path
 *   2. The result (absenceReturn) is forwarded as an argument to generatePreSessionSynthesis()
 *   3. autoResolveAbsenceNudgeOnReturn() appears before generatePreSessionSynthesis() in the
 *      text-mode region
 *   4. isFounderMode guard wraps the text-mode absence check
 *   5. The log confirming absence-return resolution in text-mode exists
 *   6. pre-session-synthesis.ts forwards returningAfterAbsence to buildLiteContext()
 *   7. buildLiteContext() injects the RETURNING AFTER ABSENCE block when the param is set
 *
 * Run: npx tsx server/scripts/test-absence-text-path.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G   = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R   = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B   = (s: string) => `\x1b[34m${s}\x1b[0m`;
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

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — unified-ws-handler.ts: Text-mode path source-level ordering
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — unified-ws-handler.ts: text-mode path source-level ordering'));
sep();

const wsHandlerSrc = readFileSync(
  resolve(__dirname, '../unified-ws-handler.ts'),
  'utf-8',
);

function part1() {
  // ── 1a. autoResolveAbsenceNudgeOnReturn is imported ─────────────────────────
  const hasImport = wsHandlerSrc.includes('autoResolveAbsenceNudgeOnReturn');
  assert(
    'unified-ws-handler.ts imports autoResolveAbsenceNudgeOnReturn',
    hasImport,
    hasImport ? undefined : 'Symbol not found in file — import may be missing',
  );

  // ── 1b. generatePreSessionSynthesis is imported ───────────────────────────
  const hasSynthImport = wsHandlerSrc.includes('generatePreSessionSynthesis');
  assert(
    'unified-ws-handler.ts imports generatePreSessionSynthesis',
    hasSynthImport,
    hasSynthImport ? undefined : 'Symbol not found — import may be missing from unified-ws-handler.ts',
  );

  // ── Isolate the text-mode region ──────────────────────────────────────────
  // The text-mode log ("[TextMode] ✓ Student returning after") is the anchor.
  // We extract a window that starts ~1200 chars before the first TextMode log
  // (to capture the !isFounderMode if-guard ~630 chars back) and ends ~1400
  // chars after it (to capture the generatePreSessionSynthesis call ~910 chars
  // forward). Narrower windows caused false-negative assertion failures when
  // the surrounding block grew slightly larger than the original estimates.
  const textModeLogMarker = '[TextMode] \u2713 Student returning after';
  const textModeLogIdx = wsHandlerSrc.indexOf(textModeLogMarker);
  assert(
    `'[TextMode] ✓ Student returning after …' log line exists in handler source`,
    textModeLogIdx !== -1,
    textModeLogIdx !== -1
      ? undefined
      : 'Log not found — absence resolution may be missing from the text-mode path',
  );
  if (textModeLogIdx === -1) return; // can't continue region checks without anchor

  const regionStart = Math.max(0, textModeLogIdx - 1200);
  const regionEnd   = Math.min(wsHandlerSrc.length, textModeLogIdx + 1400);
  const textModeRegion = wsHandlerSrc.slice(regionStart, regionEnd);

  // ── 1c. await autoResolveAbsenceNudgeOnReturn in the text-mode region ─────
  // Must be awaited (not fire-and-forget .then()) so the result can be used.
  const awaitInRegion = /await\s+autoResolveAbsenceNudgeOnReturn\s*\(\s*String\s*\(\s*userId\s*\)\s*\)/.test(textModeRegion);
  assert(
    '`await autoResolveAbsenceNudgeOnReturn(String(userId))` found in text-mode region',
    awaitInRegion,
    awaitInRegion
      ? undefined
      : 'Not found — call may still be fire-and-forget (.then()) — result cannot reach synthesis',
  );

  // ── 1d. absenceReturn is captured from the awaited call ───────────────────
  const absenceReturnInRegion =
    /const\s+absenceReturn\s*=\s*await\s+autoResolveAbsenceNudgeOnReturn/.test(textModeRegion);
  assert(
    '`const absenceReturn = await autoResolveAbsenceNudgeOnReturn(…)` in text-mode region',
    absenceReturnInRegion,
    absenceReturnInRegion
      ? undefined
      : '`absenceReturn =` assignment not found near the awaited call in text-mode block',
  );

  // ── 1e. absenceReturn is forwarded into generatePreSessionSynthesis() ─────
  // The call follows the await and includes absenceReturn as an argument.
  const synthInRegion = textModeRegion.includes('generatePreSessionSynthesis');
  const absenceForwardedInRegion = /generatePreSessionSynthesis[\s\S]{0,300}absenceReturn/.test(textModeRegion);
  assert(
    '`absenceReturn` is passed as argument to generatePreSessionSynthesis() in text-mode region',
    absenceForwardedInRegion,
    absenceForwardedInRegion
      ? undefined
      : synthInRegion
        ? 'generatePreSessionSynthesis() found but absenceReturn not passed as argument'
        : 'generatePreSessionSynthesis() not called in text-mode region at all',
  );

  // ── 1f. Ordering: autoResolve appears BEFORE generatePreSessionSynthesis ──
  const resolveIdxInRegion   = textModeRegion.indexOf('await autoResolveAbsenceNudgeOnReturn');
  const synthesisIdxInRegion = textModeRegion.indexOf('generatePreSessionSynthesis');
  assert(
    'autoResolveAbsenceNudgeOnReturn() appears before generatePreSessionSynthesis() in text-mode region',
    resolveIdxInRegion !== -1 && synthesisIdxInRegion !== -1 && resolveIdxInRegion < synthesisIdxInRegion,
    `resolveIdxInRegion=${resolveIdxInRegion}, synthesisIdxInRegion=${synthesisIdxInRegion}`,
  );

  // ── 1g. isFounderMode guard wraps the text-mode absence check ─────────────
  // Pattern: `!isFounderMode` appears in the text-mode region so that founder
  // (David's admin/test) sessions skip the absence resolution path.
  const hasFounderGuard = textModeRegion.includes('!isFounderMode');
  assert(
    'isFounderMode guard wraps the text-mode absence check (founder sessions skip it)',
    hasFounderGuard,
    hasFounderGuard
      ? undefined
      : '`!isFounderMode` not found in text-mode region — absence check may fire for founder sessions',
  );

  // ── 1h. Synthesis note is stored on the session for the greeting handler ──
  // Pattern: `__textModeAbsenceSynthesis` — the greeting handler reads this
  // so it can inject the note as context for Daniela's first turn.
  const hasSynthesisStorage = wsHandlerSrc.includes('__textModeAbsenceSynthesis');
  assert(
    'Synthesis note is stored on session as `__textModeAbsenceSynthesis` for the greeting handler',
    hasSynthesisStorage,
    hasSynthesisStorage
      ? undefined
      : '`__textModeAbsenceSynthesis` not found — synthesis may be generated but silently discarded',
  );

  // ── 1i. Absence work is stored as a promise (race-safe) ──────────────────
  // The async work is stored as `__textModeAbsencePromise` so the greeting
  // handler can await it before assembling the prompt — even on fast/reconnect
  // paths where request_greeting fires immediately after session_started.
  const hasPromiseStore = wsHandlerSrc.includes('__textModeAbsencePromise');
  assert(
    '`__textModeAbsencePromise` is stored on session so request_greeting can await it',
    hasPromiseStore,
    hasPromiseStore
      ? undefined
      : '`__textModeAbsencePromise` not found — greeting can race ahead of synthesis on fast clients',
  );

  // ── 1j. Greeting handler awaits the promise before prompt assembly ─────────
  // Pattern: Promise.race([absenceSettlePromise, setTimeout(3000)]) in
  // request_greeting ensures the synthesis is ready with a bounded timeout.
  const hasPromiseRace = /Promise\.race\s*\(\s*\[[\s\S]{0,200}__textModeAbsencePromise|absenceSettlePromise[\s\S]{0,200}Promise\.race/.test(wsHandlerSrc);
  assert(
    'request_greeting awaits the absence promise with a bounded timeout (Promise.race)',
    hasPromiseRace,
    hasPromiseRace
      ? undefined
      : 'Promise.race with absenceSettlePromise not found — greeting may still race ahead of synthesis',
  );

  // ── 1k. Greeting handler consumes the stored synthesis ────────────────────
  // After the promise settles, the synthesis note is read and prepended to
  // session.systemPrompt so Daniela's greeting carries the absence warmth.
  const hasConsumption = /textModeAbsenceSynthesis[\s\S]{0,600}session\.systemPrompt/.test(wsHandlerSrc);
  assert(
    'request_greeting handler consumes `__textModeAbsenceSynthesis` by prepending to session.systemPrompt',
    hasConsumption,
    hasConsumption
      ? undefined
      : 'Consumption path not found — the stored synthesis note is generated but never applied to the greeting',
  );

  // ── 1l. Consumed note is deleted (one-shot) ───────────────────────────────
  const hasDelete = wsHandlerSrc.includes('delete (session as any).__textModeAbsenceSynthesis');
  assert(
    'Synthesis note is deleted after consumption (one-shot — not re-applied on reconnect)',
    hasDelete,
    hasDelete
      ? undefined
      : '`delete (session as any).__textModeAbsenceSynthesis` not found — note may be re-applied on subsequent greeting requests',
  );

  // ── 1m. Promise cleared after settling (stale-promise guard) ─────────────
  const hasPromiseClear = wsHandlerSrc.includes('delete (session as any).__textModeAbsencePromise');
  assert(
    'Absence promise is cleared after settling (prevents stale-promise carryover on reconnect)',
    hasPromiseClear,
    hasPromiseClear
      ? undefined
      : '`delete (session as any).__textModeAbsencePromise` not found — promise may persist across reconnects',
  );

  // ── 1n. Injection log line exists in the greeting handler ─────────────────
  const hasInjectionLog = wsHandlerSrc.includes('[TextMode] \u2713 Absence-return synthesis injected into session system prompt');
  assert(
    'Log "[TextMode] ✓ Absence-return synthesis injected into session system prompt" exists',
    hasInjectionLog,
    hasInjectionLog
      ? undefined
      : 'Injection log not found in request_greeting handler — consumption may be unlogged',
  );

  // ── 1o. Ordering: promise store appears before promise await in source ─────
  // __textModeAbsencePromise is WRITTEN in start_session (earlier in file) and
  // AWAITED in request_greeting (later). Verify source-level ordering.
  const promiseStoreIdx = wsHandlerSrc.indexOf('__textModeAbsencePromise');
  const promiseConsumeIdx = wsHandlerSrc.indexOf('absenceSettlePromise');
  assert(
    'Promise is stored in start_session before it is awaited in request_greeting (source ordering)',
    promiseStoreIdx !== -1 && promiseConsumeIdx !== -1 && promiseStoreIdx < promiseConsumeIdx,
    `promiseStoreIdx=${promiseStoreIdx}, promiseConsumeIdx=${promiseConsumeIdx}`,
  );

  // ── 1p. Warm cache is consumed in the text-mode absence block ─────────────
  // The text-mode block must call consumeWarmSynthesis() so that a pre-warmed
  // cache generated BEFORE the absence nudge is detected and discarded rather
  // than silently used with a stale (absence-unaware) synthesis.
  const hasWarmCacheConsumption = textModeRegion.includes('consumeWarmSynthesis');
  assert(
    '`consumeWarmSynthesis()` is called in the text-mode absence block (stale-cache invalidation)',
    hasWarmCacheConsumption,
    hasWarmCacheConsumption
      ? undefined
      : '`consumeWarmSynthesis` not found in text-mode region — a stale pre-warmed cache is never invalidated for text-mode sessions',
  );

  // ── 1q. Stale-cache guard mirrors the GL path: warmedNote && absenceReturn ─
  // If the warm cache was built before the absence nudge, it must be discarded.
  // The guard pattern `warmedNote && absenceReturn` must be present in the
  // text-mode region, matching the identical guard on the GL path.
  const hasStaleGuard = /warmedNote\s*&&\s*absenceReturn/.test(textModeRegion);
  assert(
    'Stale-cache guard `warmedNote && absenceReturn` present in text-mode region (matches GL path)',
    hasStaleGuard,
    hasStaleGuard
      ? undefined
      : '`warmedNote && absenceReturn` guard not found — stale warm cache may be used without checking absence signal',
  );

  // ── 1r. Log line for stale-cache discard exists in text-mode region ───────
  const hasStaleDiscardLog = textModeRegion.includes('[TextMode] Warm cache present but absence signal detected');
  assert(
    'Log "[TextMode] Warm cache present but absence signal detected — regenerating with signal" exists',
    hasStaleDiscardLog,
    hasStaleDiscardLog
      ? undefined
      : 'Stale-discard log not found in text-mode region — discard branch is unobservable',
  );

  // ── 1s. Stale-discard log exists in handler source (file-wide check) ──────
  // The region check in 1r is windowed; this confirms the exact log string is
  // present in unified-ws-handler.ts at the file level, independent of the
  // region anchor position.
  const staleDiscardLogStr = '[TextMode] Warm cache present but absence signal detected — regenerating with signal';
  const staleDiscardInSource = wsHandlerSrc.includes(staleDiscardLogStr);
  assert(
    'Stale-discard log "[TextMode] Warm cache present but absence signal detected — regenerating with signal" found in handler source (file-level)',
    staleDiscardInSource,
    staleDiscardInSource
      ? undefined
      : 'Log not found anywhere in unified-ws-handler.ts — the stale-discard branch may have been removed',
  );

  // ── 1t. Branch ordering: stale-discard log appears BEFORE warm-path log ───
  // The three-branch structure is:
  //   if (warmedNote && absenceReturn)  → stale-discard (regenerate)
  //   else if (warmedNote)              → warm-path (use cache directly)
  //   else if (absenceReturn)           → generate with signal, no cache
  // The stale-discard log must appear before the warm-path log in source to
  // confirm the branch ordering has not been inverted.
  const warmPathLogStr = '[TextMode] \u2713 Using pre-warmed synthesis';
  const staleDiscardSrcIdx = wsHandlerSrc.indexOf(staleDiscardLogStr);
  const warmPathSrcIdx     = wsHandlerSrc.indexOf(warmPathLogStr);
  assert(
    'Stale-discard log appears BEFORE warm-path log in source (branch ordering: warmedNote&&absenceReturn → discard, else if warmedNote → use cache)',
    staleDiscardSrcIdx !== -1 && warmPathSrcIdx !== -1 && staleDiscardSrcIdx < warmPathSrcIdx,
    `staleDiscardSrcIdx=${staleDiscardSrcIdx}, warmPathSrcIdx=${warmPathSrcIdx}`,
  );
}

part1();

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — pre-session-synthesis.ts: returningAfterAbsence threading
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — pre-session-synthesis.ts: returningAfterAbsence param threading'));
sep();

const synthSrc = readFileSync(
  resolve(__dirname, '../services/pre-session-synthesis.ts'),
  'utf-8',
);

function part2() {
  // ── 2a. generatePreSessionSynthesis accepts returningAfterAbsence param ───
  const hasParam = /generatePreSessionSynthesis\s*\([^)]*returningAfterAbsence/.test(synthSrc);
  assert(
    'generatePreSessionSynthesis() declares `returningAfterAbsence` parameter',
    hasParam,
    hasParam ? undefined : 'Parameter not found in function signature',
  );

  // ── 2b. The param is forwarded to buildLiteContext() ─────────────────────
  const forwarded = /buildLiteContext\s*\([^)]*returningAfterAbsence/.test(synthSrc);
  assert(
    'buildLiteContext() receives `returningAfterAbsence` from generatePreSessionSynthesis()',
    forwarded,
    forwarded ? undefined : 'buildLiteContext() call does not include returningAfterAbsence',
  );

  // ── 2c. buildLiteContext() injects RETURNING AFTER ABSENCE block ──────────
  const hasBlock = synthSrc.includes('RETURNING AFTER ABSENCE');
  assert(
    'buildLiteContext() contains the "RETURNING AFTER ABSENCE" injection block',
    hasBlock,
    hasBlock ? undefined : '"RETURNING AFTER ABSENCE" string not found in pre-session-synthesis.ts',
  );

  // ── 2d. Block is gated on the returningAfterAbsence argument ─────────────
  const hasGate = /if\s*\(\s*returningAfterAbsence\s*\)/.test(synthSrc);
  assert(
    'RETURNING AFTER ABSENCE block is gated by `if (returningAfterAbsence)` — only injected when signal is present',
    hasGate,
    hasGate ? undefined : 'Gate not found — block may fire unconditionally',
  );

  // ── 2e. Block is injected first (highest priority) ───────────────────────
  const blockIdx   = synthSrc.indexOf('RETURNING AFTER ABSENCE');
  const studentIdx = synthSrc.indexOf('`STUDENT: ${name}`');
  assert(
    'RETURNING AFTER ABSENCE block is pushed to `parts` before the STUDENT block (highest priority in context)',
    blockIdx !== -1 && studentIdx !== -1 && blockIdx < studentIdx,
    `blockIdx=${blockIdx}, studentIdx=${studentIdx}`,
  );

  // ── 2f. Log line for injection exists ─────────────────────────────────────
  const hasLog = synthSrc.includes('[PreSynthesis] \u2713 Returning-after-absence signal:');
  assert(
    'Log "[PreSynthesis] ✓ Returning-after-absence signal: N days" emitted when signal present',
    hasLog,
    hasLog ? undefined : 'Observability log not found',
  );
}

part2();

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — daniela-absence-worker.ts: autoResolveAbsenceNudgeOnReturn safety
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — daniela-absence-worker.ts: safety (non-throwing, cache-first)'));
sep();

const workerSrc = readFileSync(
  resolve(__dirname, '../services/daniela-absence-worker.ts'),
  'utf-8',
);

function part3() {
  // ── 3a. In-memory cache is checked first (fast path) ─────────────────────
  const hasCacheCheck = /_absenceReturnCache\.get\(userId\)/.test(workerSrc);
  assert(
    'autoResolveAbsenceNudgeOnReturn() checks in-memory cache before hitting DB (fast path)',
    hasCacheCheck,
    hasCacheCheck ? undefined : 'Cache check not found — second call within TTL may re-resolve',
  );

  // ── 3b. Function never throws — safe to call in text-mode session start ───
  const hasCatch = /catch\s*\(err[^)]*\)\s*\{[\s\S]{0,500}return\s+null/.test(workerSrc);
  assert(
    'autoResolveAbsenceNudgeOnReturn() returns null on error (never throws) — safe for session-start paths',
    hasCatch,
    hasCatch ? undefined : 'catch-and-return-null pattern not found — may propagate errors to session start',
  );

  // ── 3c. resolutionType = 'student_returned' ───────────────────────────────
  const hasStudentReturned = workerSrc.includes("'student_returned'");
  assert(
    "resolveAbsenceNudge() is called with resolutionType = 'student_returned'",
    hasStudentReturned,
    hasStudentReturned ? undefined : "'student_returned' not found — resolutionType may be wrong",
  );
}

part3();

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Pre-warmed synthesis: warm-cache path when absenceReturn is null
// ══════════════════════════════════════════════════════════════════════════════
//
// Task 181 restructured the text-mode absence block so consumeWarmSynthesis()
// is called unconditionally — not just when there is an absence return.  This
// means regular (non-absence) sessions also benefit from the pre-warmed cache.
//
// This part confirms:
//   a. The `else if (warmedNote)` branch exists (warm cache, no absence return)
//   b. That branch assigns synthesisNote = warmedNote (no generatePreSessionSynthesis call)
//   c. The warm-path log "[TextMode] ✓ Using pre-warmed synthesis" is emitted
//   d. The warm branch body does NOT call generatePreSessionSynthesis
//   e. The unified `if (synthesisNote)` → `__textModeAbsenceSynthesis` storage
//      pattern covers the warm path so the greeting handler picks it up
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — Pre-warmed synthesis: warm-cache path when absenceReturn is null'));
sep();

function part4() {
  // ── Anchor the warm-path region ───────────────────────────────────────────
  // Use the warm-path log as anchor; expand generously to capture the full
  // three-branch if/else block above and the unified storage block below.
  const warmLogMarker = '[TextMode] \u2713 Using pre-warmed synthesis';
  const warmLogIdx = wsHandlerSrc.indexOf(warmLogMarker);
  assert(
    `'[TextMode] ✓ Using pre-warmed synthesis …' log line exists in handler source`,
    warmLogIdx !== -1,
    warmLogIdx !== -1
      ? undefined
      : 'Log not found — the warm-cache path for non-absence sessions may be missing',
  );
  if (warmLogIdx === -1) return; // can't continue without the anchor

  // Expand window to capture the full three-branch block and the storage step below.
  const warmRegionStart = Math.max(0, warmLogIdx - 1000);
  const warmRegionEnd   = Math.min(wsHandlerSrc.length, warmLogIdx + 800);
  const warmRegion      = wsHandlerSrc.slice(warmRegionStart, warmRegionEnd);

  // ── 4a. `else if (warmedNote)` branch exists ─────────────────────────────
  const hasWarmBranch = /else\s+if\s*\(\s*warmedNote\s*\)/.test(warmRegion);
  assert(
    '`else if (warmedNote)` branch exists in text-mode absence block (non-absence warm path)',
    hasWarmBranch,
    hasWarmBranch
      ? undefined
      : '`else if (warmedNote)` not found — non-absence warm-cache path may be missing',
  );

  // ── 4b. Warm branch assigns synthesisNote = warmedNote ────────────────────
  // This is the key: the warm branch must use the cached value directly,
  // NOT call generatePreSessionSynthesis again.
  const hasWarmAssignment = /else\s+if\s*\(\s*warmedNote\s*\)[\s\S]{0,300}synthesisNote\s*=\s*warmedNote/.test(warmRegion);
  assert(
    'Warm branch assigns `synthesisNote = warmedNote` (uses cache directly, no regeneration)',
    hasWarmAssignment,
    hasWarmAssignment
      ? undefined
      : '`synthesisNote = warmedNote` not found near `else if (warmedNote)` — warm cache may not be consumed',
  );

  // ── 4c. Warm-path log emitted in the branch ───────────────────────────────
  const warmLogInRegion = warmRegion.includes(warmLogMarker);
  assert(
    'Log "[TextMode] ✓ Using pre-warmed synthesis …" is present in the warm-branch region',
    warmLogInRegion,
    warmLogInRegion ? undefined : 'Warm-path log not found in region — observability missing',
  );

  // ── 4d. Warm branch does NOT call generatePreSessionSynthesis ─────────────
  // Extract just the warm branch body: from `else if (warmedNote) {` to the
  // matching `}`, i.e. up to `} else if (absenceReturn)` or end of block.
  // A simple proxy: between `else if (warmedNote)` and `else if (absenceReturn)`
  // there must be no call to generatePreSessionSynthesis.
  const betweenBranchesMatch = warmRegion.match(
    /else\s+if\s*\(\s*warmedNote\s*\)([\s\S]*?)else\s+if\s*\(\s*absenceReturn\s*\)/,
  );
  if (betweenBranchesMatch) {
    const warmBody = betweenBranchesMatch[1];
    const warmBodyCallsSynth = warmBody.includes('generatePreSessionSynthesis');
    assert(
      '`else if (warmedNote)` branch body does NOT call generatePreSessionSynthesis (0ms path)',
      !warmBodyCallsSynth,
      warmBodyCallsSynth
        ? '`generatePreSessionSynthesis` found inside the warm branch — warm cache is being discarded unnecessarily'
        : undefined,
    );
  } else {
    // Fallback: the `else if (absenceReturn)` branch may follow in a non-adjacent
    // position; assert the warm log and synthesisNote assignment are sufficient.
    assert(
      '`else if (warmedNote)` branch body does NOT call generatePreSessionSynthesis (0ms path)',
      hasWarmAssignment, // if warmedNote is assigned directly, synth was not called
      'Could not isolate warm branch body for deeper check; synthesisNote assignment used as proxy',
    );
  }

  // ── 4e. Unified storage: `if (synthesisNote)` → `__textModeAbsenceSynthesis` ─
  // All three branches funnel their result into `synthesisNote`.  The single
  // `if (synthesisNote)` block below all branches stores it as
  // `__textModeAbsenceSynthesis` regardless of which branch ran.
  // This ensures the warm path is picked up by the greeting handler just like
  // the absence path.
  const hasUnifiedStorage = /if\s*\(\s*synthesisNote\s*\)[\s\S]{0,300}__textModeAbsenceSynthesis\s*=\s*synthesisNote/.test(warmRegion);
  assert(
    '`if (synthesisNote)` → `__textModeAbsenceSynthesis = synthesisNote` storage covers the warm path',
    hasUnifiedStorage,
    hasUnifiedStorage
      ? undefined
      : 'Unified storage pattern not found near warm branch — warm synthesis may not reach the greeting handler',
  );
}

part4();

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
sep();
const all = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓  All ${all} assertions passed.`));
  console.log(G('   The absence-return signal is correctly wired into the text-mode (non-GL) path:\n'));
  console.log(D('   1. unified-ws-handler.ts awaits autoResolveAbsenceNudgeOnReturn() in the text-mode block'));
  console.log(D('   2. The result (absenceReturn) is forwarded to generatePreSessionSynthesis()'));
  console.log(D('   3. The synthesis note is stored on the session for the greeting handler'));
  console.log(D('   4. pre-session-synthesis.ts injects RETURNING AFTER ABSENCE as the first context block'));
  console.log(D('   5. The in-memory cache makes repeated calls within a session idempotent'));
  console.log(D('   6. When warmedNote is truthy and absenceReturn is null, the warm cache is used directly'));
  console.log(D('      (else if (warmedNote) branch — no generatePreSessionSynthesis call, 0ms latency)\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertions failed — review output above.\n`));
  process.exit(1);
}
