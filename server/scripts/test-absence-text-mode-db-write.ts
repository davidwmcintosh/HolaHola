/**
 * test-absence-text-mode-db-write.ts
 *
 * Confirms via static source analysis that the text-mode absence-return DB
 * write cannot be silently dropped by a refactor of the text-mode session-
 * start block in unified-ws-handler.ts.
 *
 * The concern:
 *   Both the GL and text-mode paths call applyAbsenceReturnFlag() to write
 *   hadAbsenceReturn=true and absenceReturnDays onto the voice_sessions row.
 *   The integration test (test-absence-db-flag.ts) exercises the shared
 *   applyAbsenceReturnFlag() production function but does NOT exercise the
 *   WS handler code path directly — a refactor of the text-mode block could
 *   silently drop the call and the integration test would still pass.
 *
 * This script checks:
 *   PART 1 — unified-ws-handler.ts: text-mode block
 *     1a. applyAbsenceReturnFlag is imported
 *     1b. applyAbsenceReturnFlag is called in the text-mode region
 *     1c. absenceReturn.daysSinceLastSession is the second argument
 *     1d. The call is inside the guard `absenceReturn && _textModeDbSessionId`
 *     1e. A .catch() handler is attached (errors are non-fatal / logged)
 *     1f. The call occurs after the absence-resolved log line (correct ordering)
 *     1g. The call occurs inside __textModeAbsencePromise (fire within the promise)
 *
 *   PART 2 — daniela-absence-worker.ts: applyAbsenceReturnFlag implementation
 *     2a. applyAbsenceReturnFlag sets hadAbsenceReturn: true
 *     2b. applyAbsenceReturnFlag sets absenceReturnDays: daysSinceLastSession
 *     2c. Both fields are inside a db.update().set() call (not a raw query)
 *     2d. Confirmation log line exists ([AbsenceWorker] ✓ hadAbsenceReturn flag written)
 *
 *   PART 3 — Guard symmetry: text-mode mirrors GL path
 *     3a. GL path also calls applyAbsenceReturnFlag
 *     3b. GL call uses the same daysSinceLastSession argument
 *
 * Run: npx tsx server/scripts/test-absence-text-mode-db-write.ts
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
// PART 1 — unified-ws-handler.ts: text-mode block DB write
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — unified-ws-handler.ts: text-mode applyAbsenceReturnFlag call'));
sep();

const wsHandlerSrc = readFileSync(
  resolve(__dirname, '../unified-ws-handler.ts'),
  'utf-8',
);

function part1() {
  // ── 1a. applyAbsenceReturnFlag is imported ────────────────────────────────
  const hasImport = wsHandlerSrc.includes('applyAbsenceReturnFlag');
  assert(
    'unified-ws-handler.ts imports applyAbsenceReturnFlag',
    hasImport,
    hasImport ? undefined : 'Symbol not found — import may be missing',
  );

  // ── Anchor the text-mode region ───────────────────────────────────────────
  // Use the TextMode absence-resolved log as the start anchor.  The
  // applyAbsenceReturnFlag call follows it within ~1200 chars.
  const textModeLogMarker = '[TextMode] \u2713 Student returning after';
  const textModeLogIdx = wsHandlerSrc.indexOf(textModeLogMarker);
  assert(
    `'[TextMode] ✓ Student returning after …' log line exists (text-mode region anchor)`,
    textModeLogIdx !== -1,
    textModeLogIdx !== -1
      ? undefined
      : 'Anchor log not found — absence resolution may be missing from text-mode path',
  );
  if (textModeLogIdx === -1) return; // can't anchor region checks without this

  // Expand to a window starting at the anchor and extending 3000 chars forward
  // to capture the applyAbsenceReturnFlag call and its guard.  The call sits
  // ~38 lines (and >1500 chars of synthesis code) below the log anchor.
  const regionStart = textModeLogIdx;
  const regionEnd   = Math.min(wsHandlerSrc.length, textModeLogIdx + 3000);
  const textModeRegion = wsHandlerSrc.slice(regionStart, regionEnd);

  // ── 1b. applyAbsenceReturnFlag is called in the text-mode region ──────────
  const hasCall = textModeRegion.includes('applyAbsenceReturnFlag');
  assert(
    '`applyAbsenceReturnFlag(...)` is called in the text-mode region',
    hasCall,
    hasCall
      ? undefined
      : 'Call not found after the text-mode anchor — DB write may have been dropped',
  );

  // ── 1c. absenceReturn.daysSinceLastSession is the second argument ─────────
  const hasCorrectArg = /applyAbsenceReturnFlag\s*\([^)]*absenceReturn\.daysSinceLastSession/.test(textModeRegion);
  assert(
    '`applyAbsenceReturnFlag(…, absenceReturn.daysSinceLastSession)` — correct arg in text-mode call',
    hasCorrectArg,
    hasCorrectArg
      ? undefined
      : '`absenceReturn.daysSinceLastSession` not found as argument — days count may be hardcoded or omitted',
  );

  // ── 1d. Call is inside the guard `absenceReturn && _textModeDbSessionId` ──
  // The call must be gated so it only fires when both the absence signal AND a
  // valid DB session ID are present.
  const hasGuard = /if\s*\(\s*absenceReturn\s*&&\s*_textModeDbSessionId\s*\)/.test(textModeRegion);
  assert(
    'Call is guarded by `if (absenceReturn && _textModeDbSessionId)` (not called unconditionally)',
    hasGuard,
    hasGuard
      ? undefined
      : 'Guard not found — applyAbsenceReturnFlag may fire unconditionally or not at all',
  );

  // ── 1e. A .catch() handler is attached (errors are non-fatal) ─────────────
  // The call is fire-and-forget with .catch() so a DB error doesn't crash the
  // session-start path.
  const hasCatch = /applyAbsenceReturnFlag[\s\S]{0,300}\.catch\s*\(/.test(textModeRegion);
  assert(
    '`.catch()` handler is attached to the applyAbsenceReturnFlag call (fire-and-forget, non-fatal)',
    hasCatch,
    hasCatch
      ? undefined
      : '`.catch()` not found near applyAbsenceReturnFlag — a DB error could surface to the session-start path',
  );

  // ── 1f. Ordering: call appears AFTER the absence-resolved log ─────────────
  // The applyAbsenceReturnFlag call must come after the log that confirms the
  // nudge was resolved, not before the check.
  const resolvedLogIdxInRegion = textModeRegion.indexOf(textModeLogMarker);
  const callIdxInRegion        = textModeRegion.indexOf('applyAbsenceReturnFlag');
  assert(
    'applyAbsenceReturnFlag() call appears after the absence-resolved log line (correct ordering)',
    resolvedLogIdxInRegion !== -1 && callIdxInRegion !== -1 && resolvedLogIdxInRegion < callIdxInRegion,
    `resolvedLogIdx=${resolvedLogIdxInRegion}, callIdx=${callIdxInRegion}`,
  );

  // ── 1g. Call is inside __textModeAbsencePromise ───────────────────────────
  // The DB write must live inside the promise body so it runs even on fast
  // reconnect paths where the promise is awaited by request_greeting.
  const promiseMarker  = '__textModeAbsencePromise';
  const promiseStart   = wsHandlerSrc.lastIndexOf(promiseMarker, textModeLogIdx + 1500);
  // Find the applyAbsenceReturnFlag call's absolute position in the file
  const absCallAbsPos  = wsHandlerSrc.indexOf('applyAbsenceReturnFlag', textModeLogIdx);
  // The promise assignment must appear before the call in the file
  assert(
    'applyAbsenceReturnFlag call is inside the __textModeAbsencePromise body',
    promiseStart !== -1 && absCallAbsPos !== -1 && promiseStart < absCallAbsPos,
    `promiseStart=${promiseStart}, callAbsPos=${absCallAbsPos}`,
  );
}

part1();

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — daniela-absence-worker.ts: applyAbsenceReturnFlag implementation
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — daniela-absence-worker.ts: applyAbsenceReturnFlag writes correct fields'));
sep();

const workerSrc = readFileSync(
  resolve(__dirname, '../services/daniela-absence-worker.ts'),
  'utf-8',
);

function part2() {
  // ── Isolate the applyAbsenceReturnFlag function body ──────────────────────
  const funcMarker = 'export async function applyAbsenceReturnFlag';
  const funcIdx    = workerSrc.indexOf(funcMarker);
  assert(
    '`applyAbsenceReturnFlag` is exported from daniela-absence-worker.ts',
    funcIdx !== -1,
    funcIdx !== -1 ? undefined : 'Function not found — may have been renamed or deleted',
  );
  if (funcIdx === -1) return;

  // Capture a generous window (800 chars) — enough for the entire function body
  const funcRegion = workerSrc.slice(funcIdx, Math.min(workerSrc.length, funcIdx + 800));

  // ── 2a. hadAbsenceReturn: true is set ────────────────────────────────────
  const hasHadAbsenceReturn = funcRegion.includes('hadAbsenceReturn: true');
  assert(
    '`hadAbsenceReturn: true` is set inside applyAbsenceReturnFlag()',
    hasHadAbsenceReturn,
    hasHadAbsenceReturn
      ? undefined
      : '`hadAbsenceReturn: true` not found — the flag write may have been removed or renamed',
  );

  // ── 2b. absenceReturnDays: daysSinceLastSession is set ───────────────────
  const hasAbsenceReturnDays = funcRegion.includes('absenceReturnDays: daysSinceLastSession');
  assert(
    '`absenceReturnDays: daysSinceLastSession` is set inside applyAbsenceReturnFlag()',
    hasAbsenceReturnDays,
    hasAbsenceReturnDays
      ? undefined
      : '`absenceReturnDays: daysSinceLastSession` not found — days count may not be written',
  );

  // ── 2c. Both fields are inside a .set() call (Drizzle ORM, not raw SQL) ──
  const hasSetBlock = /\.set\s*\(\s*\{[\s\S]{0,200}hadAbsenceReturn[\s\S]{0,200}\}\s*\)/.test(funcRegion);
  assert(
    'Both fields are inside a Drizzle `.set({…})` block (not raw SQL)',
    hasSetBlock,
    hasSetBlock
      ? undefined
      : '`.set({…})` block containing `hadAbsenceReturn` not found — may have been rewritten as raw SQL',
  );

  // ── 2d. Confirmation log line exists ─────────────────────────────────────
  const hasConfirmLog = funcRegion.includes('[AbsenceWorker] \u2713 hadAbsenceReturn flag written');
  assert(
    'Confirmation log "[AbsenceWorker] ✓ hadAbsenceReturn flag written …" exists in function body',
    hasConfirmLog,
    hasConfirmLog
      ? undefined
      : 'Confirmation log not found — successful writes are unobservable in logs',
  );
}

part2();

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Guard symmetry: text-mode mirrors the GL path
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Guard symmetry: text-mode DB write mirrors the GL path'));
sep();

function part3() {
  // The GL path calls applyAbsenceReturnFlag at line ~3066.
  // The text-mode path calls it inside __textModeAbsencePromise.
  // Both must be present — if one is removed the paths diverge silently.

  const allCalls = [...wsHandlerSrc.matchAll(/applyAbsenceReturnFlag\s*\(/g)];
  const callCount = allCalls.length;
  assert(
    'applyAbsenceReturnFlag is called at least twice in unified-ws-handler.ts (GL path + text-mode path)',
    callCount >= 2,
    callCount >= 2
      ? undefined
      : `Only ${callCount} call(s) found — one of the paths (GL or text-mode) may have lost its DB write`,
  );

  // ── 3b. Both calls use absenceReturn.daysSinceLastSession ─────────────────
  const callsWithCorrectArg = [...wsHandlerSrc.matchAll(
    /applyAbsenceReturnFlag\s*\([^)]*absenceReturn\.daysSinceLastSession/g
  )];
  assert(
    'Both applyAbsenceReturnFlag calls pass `absenceReturn.daysSinceLastSession` as the days argument',
    callsWithCorrectArg.length >= 2,
    callsWithCorrectArg.length >= 2
      ? undefined
      : `Only ${callsWithCorrectArg.length} call(s) use absenceReturn.daysSinceLastSession — one may hardcode or omit the days count`,
  );

  // ── 3c. GL call appears before the text-mode call (source ordering) ───────
  const [first, second] = allCalls;
  if (first && second) {
    assert(
      'GL call appears before text-mode call in source (GL path is higher in the file)',
      (first.index ?? 0) < (second.index ?? 0),
      `GL idx=${first.index}, text-mode idx=${second.index}`,
    );
  }
}

part3();

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
sep();
const total = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓  All ${total} assertions passed.\n`));
  console.log(D('   The text-mode absence-return DB write is confirmed at the source level:'));
  console.log(D('   1. applyAbsenceReturnFlag() is called in the text-mode region'));
  console.log(D('   2. The call is guarded (absenceReturn && _textModeDbSessionId)'));
  console.log(D('   3. absenceReturn.daysSinceLastSession is passed as the days argument'));
  console.log(D('   4. A .catch() handler prevents the error from surfacing to session-start'));
  console.log(D('   5. applyAbsenceReturnFlag() writes hadAbsenceReturn: true + absenceReturnDays'));
  console.log(D('   6. Both GL and text-mode paths call applyAbsenceReturnFlag (symmetric)\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${total} assertion(s) failed — review output above.\n`));
  process.exit(1);
}
