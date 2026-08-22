/**
 * test-absence-gl-path.ts
 *
 * Confirms via static source analysis that the absence-return signal correctly
 * reaches Daniela's GL (live voice) session greeting — not just text-mode synthesis.
 *
 * The concern:
 *   generatePreSessionSynthesis() receives the RETURNING AFTER ABSENCE block and
 *   produces a warm inner monologue (confirmed by test-absence-return-synthesis.ts).
 *   But the [DANIELA_STATE] paragraph only reaches the GL session if the WS handler
 *   actually awaits autoResolveAbsenceNudgeOnReturn() BEFORE calling synthesis, and
 *   passes the result through, BEFORE ai.live.connect() opens.
 *
 * If the GL session opens before autoResolveAbsenceNudgeOnReturn resolves, or if the
 * return details are not threaded through to the synthesis call, the absence context
 * is silently missing from the live session.
 *
 * This script checks:
 *   1. unified-ws-handler.ts awaits autoResolveAbsenceNudgeOnReturn() in the GL path
 *   2. The result (absenceReturn) is forwarded as the final arg of generatePreSessionSynthesis()
 *   3. generatePreSessionSynthesis() is called BEFORE geminiLiveSession.start()
 *   4. The [DANIELA_STATE] synthesis is prepended to geminiLiveSystemPrompt before GL opens
 *   5. pre-session-synthesis.ts forwards returningAfterAbsence to buildLiteContext()
 *   6. buildLiteContext() injects the RETURNING AFTER ABSENCE block when the param is set
 *
 * Run: npx tsx server/scripts/test-absence-gl-path.ts
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

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — unified-ws-handler.ts: GL path source ordering
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — unified-ws-handler.ts: GL path source-level ordering'));
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

  // ── 1b. It is called with await (not fire-and-forget) in the GL block ────────
  // The pattern: await autoResolveAbsenceNudgeOnReturn(... ) in the GL path.
  // The orchestrator also fires it fire-and-forget; we want the awaited GL call.
  const awaitPattern = /await\s+autoResolveAbsenceNudgeOnReturn\s*\(\s*String\s*\(\s*userId\s*\)\s*\)/;
  const hasAwait = awaitPattern.test(wsHandlerSrc);
  assert(
    '`await autoResolveAbsenceNudgeOnReturn(String(userId))` found in handler source',
    hasAwait,
    hasAwait ? undefined : 'Call site not found or is not awaited — check for regression',
  );

  // ── 1c. absenceReturn variable is declared and assigned from the call ─────────
  const absenceReturnDecl = /let\s+absenceReturn\s*[^;]*=\s*null/.test(wsHandlerSrc) ||
                            /absenceReturn\s*=\s*await\s+autoResolveAbsenceNudgeOnReturn/.test(wsHandlerSrc);
  assert(
    '`absenceReturn` is declared and assigned from autoResolveAbsenceNudgeOnReturn()',
    absenceReturnDecl,
    absenceReturnDecl ? undefined : '`absenceReturn =` assignment not found near the awaited call',
  );

  // ── 1d. absenceReturn is forwarded into generatePreSessionSynthesis() ─────────
  // The call may span args with nested parens (e.g. String(userId)), so we can't
  // use [^)]* to capture the arg list. Instead look for the two tokens close together.
  const absenceForwarded = /generatePreSessionSynthesis[\s\S]{0,300}absenceReturn\s*\)/.test(wsHandlerSrc);
  assert(
    '`absenceReturn` is passed as argument to generatePreSessionSynthesis()',
    absenceForwarded,
    absenceForwarded ? undefined : 'generatePreSessionSynthesis() call site does not include `absenceReturn`',
  );

  // ── 1e. Ordering: autoResolve appears BEFORE generatePreSessionSynthesis ──────
  const resolveIdx    = wsHandlerSrc.indexOf('await autoResolveAbsenceNudgeOnReturn');
  const synthesisIdx  = wsHandlerSrc.indexOf('generatePreSessionSynthesis(');
  assert(
    'autoResolveAbsenceNudgeOnReturn() appears before generatePreSessionSynthesis() in source',
    resolveIdx !== -1 && synthesisIdx !== -1 && resolveIdx < synthesisIdx,
    `resolveIdx=${resolveIdx}, synthesisIdx=${synthesisIdx}`,
  );

  // ── 1f. Synthesis is prepended to geminiLiveSystemPrompt ─────────────────────
  // The pattern: geminiLiveSystemPrompt = wrapped + geminiLiveSystemPrompt
  // (synthesis node is prepended, not appended, so it lands before all else)
  const prependPattern = /geminiLiveSystemPrompt\s*=\s*wrapped\s*\+\s*geminiLiveSystemPrompt/.test(wsHandlerSrc);
  assert(
    'Synthesis (wrapped) is PREPENDED to geminiLiveSystemPrompt (not appended)',
    prependPattern,
    prependPattern ? undefined : 'Prepend assignment not found — synthesis position may have changed',
  );

  // ── 1g. Ordering: generatePreSessionSynthesis appears BEFORE geminiLiveSession.start ─
  // geminiLiveSession.start() is the call that opens the actual GL WebSocket.
  const startIdx = wsHandlerSrc.indexOf('geminiLiveSession.start(');
  assert(
    'generatePreSessionSynthesis() appears before geminiLiveSession.start() in source',
    synthesisIdx !== -1 && startIdx !== -1 && synthesisIdx < startIdx,
    `synthesisIdx=${synthesisIdx}, startIdx=${startIdx}`,
  );

  // ── 1h. Ordering: autoResolve appears BEFORE geminiLiveSession.start ──────────
  assert(
    'autoResolveAbsenceNudgeOnReturn() appears before geminiLiveSession.start() in source',
    resolveIdx !== -1 && startIdx !== -1 && resolveIdx < startIdx,
    `resolveIdx=${resolveIdx}, startIdx=${startIdx}`,
  );

  // ── 1i. The log confirming absence-return injection in GL path ─────────────────
  const hasGLLog = wsHandlerSrc.includes('[GeminiLive] ✓ Student returning after');
  assert(
    'Log "[GeminiLive] ✓ Student returning after N day(s)" exists in the GL path',
    hasGLLog,
    hasGLLog ? undefined : 'Observability log not found — injection may be unlogged',
  );

  // ── 1j. Founder-mode guard: absence check is skipped for founder sessions ──────
  // Founder sessions are David's admin/test sessions; absence signal is irrelevant.
  // Pattern: `if (userId && !isFounderMode) { ... autoResolveAbsenceNudgeOnReturn`
  const hasFounderGuard = /!isFounderMode[\s\S]{0,300}autoResolveAbsenceNudgeOnReturn|autoResolveAbsenceNudgeOnReturn[\s\S]{0,200}!isFounderMode/.test(wsHandlerSrc);
  assert(
    'isFounderMode guard wraps the absence-return check (founder sessions skip it)',
    hasFounderGuard,
    hasFounderGuard ? undefined : 'Guard not found — absence check may fire for founder (David) sessions',
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
  // ── 2a. generatePreSessionSynthesis accepts returningAfterAbsence param ───────
  const hasParam = /generatePreSessionSynthesis\s*\([^)]*returningAfterAbsence/.test(synthSrc);
  assert(
    'generatePreSessionSynthesis() declares `returningAfterAbsence` parameter',
    hasParam,
    hasParam ? undefined : 'Parameter not found in function signature',
  );

  // ── 2b. The param is forwarded to buildLiteContext() ─────────────────────────
  const forwarded = /buildLiteContext\s*\([^)]*returningAfterAbsence/.test(synthSrc);
  assert(
    'buildLiteContext() receives `returningAfterAbsence` from generatePreSessionSynthesis()',
    forwarded,
    forwarded ? undefined : 'buildLiteContext() call does not include returningAfterAbsence',
  );

  // ── 2c. buildLiteContext() injects RETURNING AFTER ABSENCE block ──────────────
  const hasBlock = synthSrc.includes('RETURNING AFTER ABSENCE');
  assert(
    'buildLiteContext() contains the "RETURNING AFTER ABSENCE" injection block',
    hasBlock,
    hasBlock ? undefined : '"RETURNING AFTER ABSENCE" string not found in pre-session-synthesis.ts',
  );

  // ── 2d. Block is gated on the returningAfterAbsence argument ─────────────────
  // Pattern: `if (returningAfterAbsence) {` guards the injection
  const hasGate = /if\s*\(\s*returningAfterAbsence\s*\)/.test(synthSrc);
  assert(
    'RETURNING AFTER ABSENCE block is gated by `if (returningAfterAbsence)` — only injected when signal is present',
    hasGate,
    hasGate ? undefined : 'Gate not found — block may fire unconditionally',
  );

  // ── 2e. Block is injected first (highest priority) ───────────────────────────
  // The block should appear in buildLiteContext BEFORE the STUDENT: line so the
  // synthesis model's inner monologue opens with the right register.
  const blockIdx   = synthSrc.indexOf('RETURNING AFTER ABSENCE');
  const studentIdx = synthSrc.indexOf('`STUDENT: ${name}`');
  assert(
    'RETURNING AFTER ABSENCE block is pushed to `parts` before the STUDENT block (highest priority in context)',
    blockIdx !== -1 && studentIdx !== -1 && blockIdx < studentIdx,
    `blockIdx=${blockIdx}, studentIdx=${studentIdx}`,
  );

  // ── 2f. The log line for injection exists ─────────────────────────────────────
  const hasLog = synthSrc.includes('[PreSynthesis] ✓ Returning-after-absence signal:');
  assert(
    'Log "[PreSynthesis] ✓ Returning-after-absence signal: N days" emitted when signal present',
    hasLog,
    hasLog ? undefined : 'Observability log not found',
  );

  // ── 2g. Warm-synthesis cache note in handler ──────────────────────────────────
  // The handler checks the warm cache first; the comment now acknowledges that
  // the warm-synthesis route also carries the returning-student signal.
  const wsCacheComment = wsHandlerSrc.includes('warm cache carries the returning-student') ||
                         wsHandlerSrc.includes('absence nudge') && wsHandlerSrc.includes('warm');
  assert(
    'WS handler comment acknowledges warm-synthesis cache carries the returning-student signal',
    wsCacheComment,
    wsCacheComment ? undefined : 'Comment not found — warm-cache / absence interaction may be undocumented',
  );
}

part2();

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — daniela-absence-worker.ts: autoResolveAbsenceNudgeOnReturn structure
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — daniela-absence-worker.ts: autoResolveAbsenceNudgeOnReturn structure'));
sep();

const workerSrc = readFileSync(
  resolve(__dirname, '../services/daniela-absence-worker.ts'),
  'utf-8',
);

function part3() {
  // ── 3a. In-memory cache is checked first (fast path) ─────────────────────────
  const hasCacheCheck = /_absenceReturnCache\.get\(userId\)/.test(workerSrc);
  assert(
    'autoResolveAbsenceNudgeOnReturn() checks in-memory cache before hitting DB',
    hasCacheCheck,
    hasCacheCheck ? undefined : 'Cache check not found — second call within TTL may re-resolve',
  );

  // ── 3b. DB guard: return null immediately if no pending nudge ─────────────────
  const hasGuard = /if\s*\(\s*!pending\s*\)\s*return\s+null\s*;/.test(workerSrc);
  assert(
    'Guard `if (!pending) return null;` present — no-op in the common (no-nudge) case',
    hasGuard,
    hasGuard ? undefined : 'Guard missing — DB update may run even when no nudge exists',
  );

  // ── 3c. Cache is written BEFORE Express Lane post (ensures second caller gets details) ─
  const cacheSetIdx   = workerSrc.indexOf('_absenceReturnCache.set(userId');
  const expressLaneIdx = workerSrc.indexOf('STUDENT RETURNED');
  assert(
    'In-memory cache is written before Express Lane post (race-safe for fast reconnects)',
    cacheSetIdx !== -1 && expressLaneIdx !== -1 && cacheSetIdx < expressLaneIdx,
    `cacheSetIdx=${cacheSetIdx}, expressLaneIdx=${expressLaneIdx}`,
  );

  // ── 3d. resolutionType = 'student_returned' (not 'dismissed') ────────────────
  const hasStudentReturned = workerSrc.includes("'student_returned'");
  assert(
    "resolveAbsenceNudge() is called with resolutionType = 'student_returned'",
    hasStudentReturned,
    hasStudentReturned ? undefined : "'student_returned' not found — resolutionType may be wrong",
  );

  // ── 3e. Function never throws — safe to call on every session start ───────────
  // The outer try/catch + `return null` at the bottom ensures no uncaught rejection.
  // The catch block contains a console.warn before the return, so we allow up to 500 chars.
  const hasCatch = /catch\s*\(err[^)]*\)\s*\{[\s\S]{0,500}return\s+null/.test(workerSrc);
  assert(
    'autoResolveAbsenceNudgeOnReturn() returns null on error (never throws) — safe for session-start paths',
    hasCatch,
    hasCatch ? undefined : 'catch-and-return-null pattern not found — may propagate errors to session start',
  );
}

part3();

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — GL warm-only branch (warmedNote truthy, absenceReturn null)
//
// When the student starts a normal (non-return) GL session the pre-warm cache
// may already contain a fresh synthesis note. The GL handler must use it
// directly — no unnecessary generatePreSessionSynthesis() call — and still
// forward the note into the GL session context.
//
// GL branch structure (unified-ws-handler.ts):
//   Branch 1 (stale-discard): warmedNote && absenceReturn → regenerate
//   Branch 2 (warm-only):     else + warmedNote truthy   → use warm note (??  short-circuits)
//   Branch 3 (cold):          else + warmedNote null     → await generatePreSessionSynthesis()
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — GL warm-only branch: no regeneration when no absence return'));
sep();

function part4() {
  // ── 4a. Stale-discard guard exists: `warmedNote && absenceReturn` ─────────────
  // This is the gate that separates branch 1 from branches 2+3. Without it the
  // warm note would be used even when the absence signal was present (stale data).
  const hasStaleDiscardGuard = /warmedNote\s*&&\s*absenceReturn/.test(wsHandlerSrc);
  assert(
    'GL block has stale-discard guard: `warmedNote && absenceReturn` (branch 1 gate)',
    hasStaleDiscardGuard,
    hasStaleDiscardGuard ? undefined : '`warmedNote && absenceReturn` guard not found — stale warm note may slip past',
  );

  // ── 4b. Nullish-coalescing pattern in the else branch ───────────────────────
  // Pattern: `synthesisNote = warmedNote\n?? await generatePreSessionSynthesis`
  // When warmedNote is truthy (branch 2), the right-hand side is never evaluated —
  // generatePreSessionSynthesis() is NOT called. This is the short-circuit guarantee.
  const hasNullishCoalesce = /warmedNote\s*\n?\s*\?\?\s*await\s+generatePreSessionSynthesis/.test(wsHandlerSrc);
  assert(
    'GL else-branch uses `warmedNote ?? await generatePreSessionSynthesis(...)` — warm note short-circuits the generate call',
    hasNullishCoalesce,
    hasNullishCoalesce ? undefined : 'Nullish-coalescing pattern not found — warm-only path may re-call generatePreSessionSynthesis unnecessarily',
  );

  // ── 4c. Warm-path log exists ─────────────────────────────────────────────────
  // Must emit: `[GeminiLive] ✓ Using pre-warmed synthesis (N chars) — 0ms latency`
  const hasWarmLog = wsHandlerSrc.includes('[GeminiLive] ✓ Using pre-warmed synthesis');
  assert(
    'Warm-path log "[GeminiLive] ✓ Using pre-warmed synthesis" emitted in GL block',
    hasWarmLog,
    hasWarmLog ? undefined : 'Warm-path observability log missing from GL handler',
  );

  // ── 4d. Warm-path log is inside `if (warmedNote)` guard (not unconditional) ──
  // The log must only fire when the warm cache was actually used (branch 2),
  // not when generatePreSessionSynthesis() was called instead (branch 3).
  const warmLogGuarded = /if\s*\(\s*warmedNote\s*\)[\s\S]{0,300}\[GeminiLive\].*Using pre-warmed synthesis/.test(wsHandlerSrc);
  assert(
    'Warm-path log is inside `if (warmedNote)` guard — does not fire for cold-path sessions',
    warmLogGuarded,
    warmLogGuarded ? undefined : 'Log guard missing — cold-path sessions may log a false warm-hit',
  );

  // ── 4e. synthesisNote is the shared variable for both branches ───────────────
  // Both branch 1 (stale-discard) and branch 2 (warm-only) assign to the same
  // `synthesisNote` local variable so the forwarding code below is path-agnostic.
  const hasSynthesisNoteVar = /let\s+synthesisNote\s*:\s*string\s*\|\s*null/.test(wsHandlerSrc) ||
                               /let\s+synthesisNote\b/.test(wsHandlerSrc);
  assert(
    '`synthesisNote` is declared as a shared output variable covering all GL synthesis branches',
    hasSynthesisNoteVar,
    hasSynthesisNoteVar ? undefined : '`let synthesisNote` declaration not found — branch isolation may prevent forwarding',
  );

  // ── 4f. Warm note is forwarded into GL via wrapSynthesisForSystemPrompt ───────
  // After the if/else block, `if (synthesisNote)` wraps and prepends regardless
  // of which branch populated it — the warm-only branch is not a dead end.
  const hasSynthesisForward = wsHandlerSrc.includes('wrapSynthesisForSystemPrompt(synthesisNote)');
  assert(
    '`synthesisNote` is forwarded into GL via wrapSynthesisForSystemPrompt(synthesisNote)',
    hasSynthesisForward,
    hasSynthesisForward ? undefined : 'Forwarding call not found — warm note may not reach the GL session context',
  );

  // ── 4g. Forwarding log confirms warm note reached GL system prompt ────────────
  // `[GeminiLive] ✓ Pre-session synthesis prepended` fires after wrapSynthesisForSystemPrompt,
  // confirming the note (whether warm or freshly generated) landed in the prompt.
  const hasPrependLog = wsHandlerSrc.includes('[GeminiLive] ✓ Pre-session synthesis prepended');
  assert(
    'Log "[GeminiLive] ✓ Pre-session synthesis prepended" confirms forwarding reached geminiLiveSystemPrompt',
    hasPrependLog,
    hasPrependLog ? undefined : 'Prepend confirmation log missing — cannot verify warm note reached GL session',
  );

  // ── 4h. Warm-only branch is structurally in the else of the stale-discard if ──
  // The stale-discard guard and the warm-only log must appear in the correct order:
  // guard fires first (decides whether to discard), warm log fires in the else path.
  const staleDiscardIdx = wsHandlerSrc.indexOf('warmedNote && absenceReturn');
  const warmLogIdx      = wsHandlerSrc.indexOf('[GeminiLive] ✓ Using pre-warmed synthesis');
  assert(
    'Stale-discard guard appears before warm-path log in source (branch 1 gate then branch 2 body)',
    staleDiscardIdx !== -1 && warmLogIdx !== -1 && staleDiscardIdx < warmLogIdx,
    `staleDiscardIdx=${staleDiscardIdx}, warmLogIdx=${warmLogIdx}`,
  );

  // ── 4i. Stale-discard branch emits its regeneration log ───────────────────────
  // When branch 1 fires (warmedNote && absenceReturn), it must log:
  // "[GeminiLive] Warm cache present but absence signal detected — regenerating with signal"
  // Without this log the discard path is invisible in production observability.
  const staleDiscardLog = '[GeminiLive] Warm cache present but absence signal detected — regenerating with signal';
  const hasStaleDiscardLog = wsHandlerSrc.includes(staleDiscardLog);
  assert(
    'Stale-discard branch emits log: "[GeminiLive] Warm cache present but absence signal detected — regenerating with signal"',
    hasStaleDiscardLog,
    hasStaleDiscardLog ? undefined : 'Stale-discard regeneration log not found — the branch may exist but be invisible in observability',
  );

  // ── 4j. Stale-discard log appears BEFORE warm-path log in source ──────────────
  // Branch 1 (stale-discard, regenerates) must appear before branch 2 (warm-only,
  // uses cache) in the if/else chain — this ordering proves branch 1 is the first
  // guard and branch 2 is the fallthrough path.
  const staleDiscardLogIdx = wsHandlerSrc.indexOf(staleDiscardLog);
  assert(
    'Stale-discard log appears before warm-path log in source (branch 1 fires before branch 2 in the if/else)',
    staleDiscardLogIdx !== -1 && warmLogIdx !== -1 && staleDiscardLogIdx < warmLogIdx,
    `staleDiscardLogIdx=${staleDiscardLogIdx}, warmLogIdx=${warmLogIdx}`,
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
  console.log(G('   The absence-return signal is correctly wired into the GL live-voice path:\n'));
  console.log(D('   1. unified-ws-handler.ts awaits autoResolveAbsenceNudgeOnReturn() before synthesis'));
  console.log(D('   2. The result (absenceReturn) is forwarded to generatePreSessionSynthesis()'));
  console.log(D('   3. Synthesis is prepended to geminiLiveSystemPrompt before geminiLiveSession.start()'));
  console.log(D('   4. pre-session-synthesis.ts injects RETURNING AFTER ABSENCE as the first context block'));
  console.log(D('   5. The in-memory cache makes the second call (orchestrator fire-and-forget) idempotent'));
  console.log(D('   6. GL warm-only branch uses pre-warmed note directly (no regeneration) and forwards it\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertions failed — review output above.\n`));
  process.exit(1);
}
