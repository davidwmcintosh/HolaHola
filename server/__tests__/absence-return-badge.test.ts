/**
 * Confirms the 'Returned after N days' absence-return badge is correctly wired
 * end-to-end through the production code:
 *
 *   schema.ts                  — hadAbsenceReturn / absenceReturnDays columns exist
 *   daniela-absence-worker.ts  — autoResolveAbsenceNudgeOnReturn exports + returns daysSinceLastSession
 *   unified-ws-handler.ts      — GL path and text-mode path write the badge fields to voice_sessions
 *   routes.ts                  — GET /api/usage/sessions selects both fields into the response
 *
 * Strategy: static source analysis of real production files.
 * Each assertion reads the actual source on disk and fails if the production code
 * drifts from the contract (field renamed, write removed, guard dropped, etc.).
 * This is the same approach used by test-absence-gl-path.ts and
 * test-absence-text-path.ts in this codebase.
 *
 * Run with:
 *   npx tsx --test server/__tests__/absence-return-badge.test.ts
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '../..');

// ── Load production source files once ─────────────────────────────────────────

let wsSrc: string;
let routesSrc: string;
let schemaSrc: string;
let workerSrc: string;

before(() => {
  wsSrc     = readFileSync(resolve(root, 'server/unified-ws-handler.ts'), 'utf-8');
  routesSrc = readFileSync(resolve(root, 'server/routes.ts'), 'utf-8');
  schemaSrc = readFileSync(resolve(root, 'shared/schema.ts'), 'utf-8');
  workerSrc = readFileSync(resolve(root, 'server/services/daniela-absence-worker.ts'), 'utf-8');
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extract a window around the FIRST occurrence of `anchor` in `src`.
 * `before` chars before the anchor, `after` chars after it.
 * Returns '' when the anchor is not found.
 */
function regionAround(src: string, anchor: string, before = 600, after = 600): string {
  const idx = src.indexOf(anchor);
  if (idx === -1) return '';
  return src.slice(Math.max(0, idx - before), Math.min(src.length, idx + anchor.length + after));
}

// ═══════════════════════════════════════════════════════════════════════════════
// PART 1 — shared/schema.ts: voiceSessions table has both badge columns
// ═══════════════════════════════════════════════════════════════════════════════

describe('shared/schema.ts — voiceSessions badge columns', () => {
  it('hadAbsenceReturn is declared as a boolean column with the correct DB name', () => {
    // Matches: hadAbsenceReturn: boolean("had_absence_return")
    const hasCol = /hadAbsenceReturn\s*:\s*boolean\s*\(\s*["']had_absence_return["']/.test(schemaSrc);
    assert.ok(hasCol,
      'hadAbsenceReturn column not found in voiceSessions — schema may have been renamed or dropped');
  });

  it('absenceReturnDays is declared as an integer column with the correct DB name', () => {
    // Matches: absenceReturnDays: integer("absence_return_days")
    const hasCol = /absenceReturnDays\s*:\s*integer\s*\(\s*["']absence_return_days["']/.test(schemaSrc);
    assert.ok(hasCol,
      'absenceReturnDays column not found in voiceSessions — schema may have been renamed or dropped');
  });

  it('hadAbsenceReturn defaults to false (not null — always present in every session row)', () => {
    // Matches: hadAbsenceReturn: boolean("had_absence_return").default(false)
    const hasDefault = /hadAbsenceReturn\s*:\s*boolean\s*\([^)]+\)\.default\s*\(\s*false\s*\)/.test(schemaSrc);
    assert.ok(hasDefault,
      'hadAbsenceReturn must have .default(false) so every session row carries this field without a nullable gap');
  });

  it('both badge columns appear in the same voiceSessions block (not in separate tables)', () => {
    // Extract the region around hadAbsenceReturn and confirm absenceReturnDays is within 200 chars.
    const region = regionAround(schemaSrc, 'hadAbsenceReturn', 0, 200);
    assert.ok(region.includes('absenceReturnDays'),
      'absenceReturnDays was not found within 200 chars of hadAbsenceReturn — they may be in different table blocks');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 2 — daniela-absence-worker.ts: autoResolveAbsenceNudgeOnReturn contract
// ═══════════════════════════════════════════════════════════════════════════════

describe('daniela-absence-worker.ts — autoResolveAbsenceNudgeOnReturn contract', () => {
  // Use the full `export async function` prefix so the anchor is the function definition
  // itself, not an earlier comment that also contains the function name.
  const FN_ANCHOR = 'export async function autoResolveAbsenceNudgeOnReturn';

  it('autoResolveAbsenceNudgeOnReturn is exported', () => {
    assert.ok(workerSrc.includes(FN_ANCHOR),
      'autoResolveAbsenceNudgeOnReturn must be exported — the WS handler imports it directly');
  });

  it("resolves the nudge row with resolutionType = 'student_returned' (not dismissed)", () => {
    // Look within 2000 chars of the function definition.
    // Gap measured: ~1296 chars from function start to the resolveAbsenceNudge call.
    const region = regionAround(workerSrc, FN_ANCHOR, 0, 2000);
    const hasResolution = region.includes("'student_returned'");
    assert.ok(hasResolution,
      "autoResolveAbsenceNudgeOnReturn must call resolveAbsenceNudge with 'student_returned' — " +
      "the history view uses this type to render 'Student returned' badge");
  });

  it('return value includes daysSinceLastSession (the field the WS handler reads for absenceReturnDays)', () => {
    // The function builds AbsenceReturnDetails: { daysSinceLastSession, firstName }
    // The WS handler then writes: absenceReturnDays: absenceReturn.daysSinceLastSession
    // If this field name is renamed in the worker, the badge write silently becomes undefined.
    const region = regionAround(workerSrc, FN_ANCHOR, 0, 2000);
    const hasDaysField = region.includes('daysSinceLastSession');
    assert.ok(hasDaysField,
      'daysSinceLastSession not found in autoResolveAbsenceNudgeOnReturn body — badge write will be undefined if renamed');
  });

  it('never throws — has outer try/catch that returns null on error (safe for every session start)', () => {
    // Extract the full function body by slicing from the function anchor to the next `\nexport `
    // so we always cover the closing catch block regardless of function length.
    const fnStart = workerSrc.indexOf(FN_ANCHOR);
    const afterFn = workerSrc.slice(fnStart);
    const nextExport = afterFn.indexOf('\nexport ', 1);
    const fnBody = nextExport > 0 ? afterFn.slice(0, nextExport) : afterFn.slice(0, 8000);
    // Outer catch returns null so session start always continues even when DB is down.
    const hasSafeCatch = /catch\s*\([^)]*\)[\s\S]{0,600}return\s+null/.test(fnBody);
    assert.ok(hasSafeCatch,
      'autoResolveAbsenceNudgeOnReturn must return null on any error — a thrown exception here aborts session start');
  });

  it('uses in-memory cache so a second call within TTL is idempotent (no double-resolve)', () => {
    const hasCache = workerSrc.includes('_absenceReturnCache');
    assert.ok(hasCache,
      '_absenceReturnCache not found — the idempotent cache preventing double-resolution is missing');
  });

  it('AbsenceReturnDetails interface is exported (WS handler uses it for typing)', () => {
    const hasInterface = /export\s+interface\s+AbsenceReturnDetails/.test(workerSrc);
    assert.ok(hasInterface,
      'AbsenceReturnDetails interface must be exported — the WS handler type-references it');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 3 — unified-ws-handler.ts: GL path writes badge fields to voice_sessions
// ═══════════════════════════════════════════════════════════════════════════════

describe('unified-ws-handler.ts — GL path badge write', () => {
  // The GL path logs this line right before the badge write.
  // The Unicode ✓ matches the actual source character.
  const GL_LOG = '[GeminiLive] \u2713 Student returning after';

  // Measured gap: ~494 chars from anchor to hadAbsenceReturn: true.
  // Window of 800 after the anchor provides comfortable headroom.
  const GL_AFTER = 800;

  it('GL path log line exists — confirms the GL absence-return code block is present', () => {
    assert.ok(wsSrc.includes(GL_LOG),
      `'${GL_LOG}' not found in unified-ws-handler.ts — GL path absence block may have been removed`);
  });

  it('GL path calls applyAbsenceReturnFlag() to write badge fields to voice_sessions', () => {
    // The db.update() with hadAbsenceReturn/absenceReturnDays was extracted into
    // applyAbsenceReturnFlag() in daniela-absence-worker.ts so that both the WS
    // handler and integration tests call the same production function.
    const region = regionAround(wsSrc, GL_LOG, 100, GL_AFTER);
    assert.ok(region.includes('applyAbsenceReturnFlag'),
      'applyAbsenceReturnFlag not found within the GL path — badge write may have been removed; check daniela-absence-worker.ts export and unified-ws-handler.ts import');
  });

  it('GL path passes absenceReturn.daysSinceLastSession to applyAbsenceReturnFlag', () => {
    const region = regionAround(wsSrc, GL_LOG, 100, GL_AFTER);
    assert.ok(region.includes('absenceReturn.daysSinceLastSession'),
      'absenceReturn.daysSinceLastSession not found in GL path — badge day count will not be set');
  });

  it('GL path badge write passes daysSinceLastSession inside the applyAbsenceReturnFlag() call', () => {
    const region = regionAround(wsSrc, GL_LOG, 100, GL_AFTER);
    // Match the actual call: applyAbsenceReturnFlag(dbSessionId, absenceReturn.daysSinceLastSession)
    // Use a regex so we don't confuse the arg with the earlier log-line occurrence of daysSinceLastSession.
    const hasCall = /applyAbsenceReturnFlag\s*\([^)]*absenceReturn\.daysSinceLastSession[^)]*\)/.test(region);
    assert.ok(hasCall,
      'applyAbsenceReturnFlag(..., absenceReturn.daysSinceLastSession) not found in GL path — badge day count will not be set');
  });

  it('GL path awaits autoResolveAbsenceNudgeOnReturn (not fire-and-forget)', () => {
    const region = regionAround(wsSrc, GL_LOG, 600, 200);
    const hasAwait = /await\s+autoResolveAbsenceNudgeOnReturn\s*\(\s*String\s*\(\s*userId\s*\)\s*\)/.test(region);
    assert.ok(hasAwait,
      'GL path must await autoResolveAbsenceNudgeOnReturn — ' +
      'fire-and-forget means the result cannot be forwarded to synthesis before GL opens');
  });

  it('GL path DB write is gated on absenceReturn being non-null (not unconditional)', () => {
    const region = regionAround(wsSrc, GL_LOG, 200, GL_AFTER);
    // Pattern: if (absenceReturn) { ... applyAbsenceReturnFlag(...)
    // Confirms the write only fires when a pending nudge was actually resolved.
    const absenceGateIdx = region.indexOf('if (absenceReturn)');
    const fnIdx          = region.indexOf('applyAbsenceReturnFlag');
    assert.ok(absenceGateIdx !== -1,
      'GL path badge write must be inside an `if (absenceReturn)` block — ' +
      'otherwise every session sets hadAbsenceReturn=true unconditionally');
    assert.ok(fnIdx > absenceGateIdx,
      'applyAbsenceReturnFlag must appear after the `if (absenceReturn)` guard, not before it');
  });

  it('GL path skips absence resolution for founder-mode sessions (!isFounderMode guard)', () => {
    const region = regionAround(wsSrc, GL_LOG, 900, 200);
    assert.ok(region.includes('!isFounderMode'),
      '!isFounderMode guard not found before GL path absence resolution — ' +
      'founder admin sessions would incorrectly trigger the student-return flow');
  });

  it('GL path DB write is non-blocking (.catch() so a failed write never aborts the session)', () => {
    const region = regionAround(wsSrc, GL_LOG, 100, GL_AFTER + 200);
    const hasCatch = /applyAbsenceReturnFlag[\s\S]{0,400}\.catch\s*\(/.test(region);
    assert.ok(hasCatch,
      'GL path DB write must use .catch() (fire-and-forget) — ' +
      'a failed write should never propagate and abort session start');
  });

  it('unified-ws-handler.ts imports autoResolveAbsenceNudgeOnReturn from daniela-absence-worker', () => {
    const hasImport = /import\s*\{[^}]*autoResolveAbsenceNudgeOnReturn[^}]*\}\s*from\s*['"]\.\/services\/daniela-absence-worker['"]/.test(wsSrc);
    assert.ok(hasImport,
      'autoResolveAbsenceNudgeOnReturn must be imported from daniela-absence-worker — without this import the call is undefined');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 4 — unified-ws-handler.ts: text-mode path writes badge fields
// ═══════════════════════════════════════════════════════════════════════════════

describe('unified-ws-handler.ts — text-mode path badge write', () => {
  const TEXT_LOG = '[TextMode] \u2713 Student returning after';

  // Text-mode writes the DB update after the synthesis block — further from the log
  // anchor than GL. Measured gap: 2662 chars from anchor to hadAbsenceReturn: true.
  // Use 2800 to provide comfortable headroom.
  const TEXT_AFTER = 2800;

  it('text-mode path log line exists — confirms the text-mode absence-return block is present', () => {
    assert.ok(wsSrc.includes(TEXT_LOG),
      `'${TEXT_LOG}' not found in unified-ws-handler.ts — text-mode path absence block may have been removed`);
  });

  it('text-mode path calls applyAbsenceReturnFlag() to write badge fields to voice_sessions', () => {
    const region = regionAround(wsSrc, TEXT_LOG, 100, TEXT_AFTER);
    assert.ok(region.includes('applyAbsenceReturnFlag'),
      'applyAbsenceReturnFlag not found in text-mode path — badge write may have been removed; check daniela-absence-worker.ts export and unified-ws-handler.ts import');
  });

  it('text-mode path passes absenceReturn.daysSinceLastSession to applyAbsenceReturnFlag', () => {
    const region = regionAround(wsSrc, TEXT_LOG, 100, TEXT_AFTER);
    assert.ok(region.includes('absenceReturn.daysSinceLastSession'),
      'absenceReturn.daysSinceLastSession not found in text-mode path — badge day count will not be set');
  });

  it('text-mode path awaits autoResolveAbsenceNudgeOnReturn', () => {
    const region = regionAround(wsSrc, TEXT_LOG, 700, 200);
    const hasAwait = /await\s+autoResolveAbsenceNudgeOnReturn\s*\(\s*String\s*\(\s*userId\s*\)\s*\)/.test(region);
    assert.ok(hasAwait,
      'text-mode path must await autoResolveAbsenceNudgeOnReturn — ' +
      'without await the absenceReturn result is a Promise and the DB write is skipped');
  });

  it('text-mode path skips absence resolution for founder-mode sessions (!isFounderMode guard)', () => {
    const region = regionAround(wsSrc, TEXT_LOG, 900, 200);
    assert.ok(region.includes('!isFounderMode'),
      '!isFounderMode guard not found before text-mode absence resolution — ' +
      'founder sessions would incorrectly resolve student-return nudges');
  });

  it('text-mode path DB write is gated on absenceReturn being non-null', () => {
    const region = regionAround(wsSrc, TEXT_LOG, 100, TEXT_AFTER);
    // Text-mode pattern: if (absenceReturn && _textModeDbSessionId) { ... hadAbsenceReturn: true ... }
    // Confirms the write only fires when a pending nudge was actually resolved.
    const hasGate = /if\s*\(\s*absenceReturn\b/.test(region);
    assert.ok(hasGate,
      'text-mode DB write must be gated on absenceReturn — ' +
      'otherwise every text-mode session sets hadAbsenceReturn=true');
  });

  it('text-mode path DB write is non-blocking (.catch() so a failed write never aborts the session)', () => {
    const region = regionAround(wsSrc, TEXT_LOG, 100, TEXT_AFTER + 200);
    const hasCatch = /applyAbsenceReturnFlag[\s\S]{0,500}\.catch\s*\(/.test(region);
    assert.ok(hasCatch,
      'text-mode path DB write must use .catch() — a failed write should never abort session start');
  });

  it('GL and text-mode paths each have an independent absence write (both session modes covered)', () => {
    // The db.update() was extracted into applyAbsenceReturnFlag() in daniela-absence-worker.ts.
    // Both the GL and text-mode paths call it. Count call sites in unified-ws-handler.ts.
    const writeCount = (wsSrc.match(/applyAbsenceReturnFlag\s*\(/g) ?? []).length;
    assert.ok(writeCount >= 2,
      `Expected ≥2 applyAbsenceReturnFlag() call sites (GL + text-mode), found ${writeCount} — one session mode may be missing the badge write`);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 5 — routes.ts: GET /api/usage/sessions includes badge fields in response
// ═══════════════════════════════════════════════════════════════════════════════

describe('routes.ts — GET /api/usage/sessions response shape', () => {
  // The route is registered at line ~1631 but the select is at line ~17061 —
  // a gap of >650 KB. Use the badge field itself as the anchor for region tests,
  // and a global includes() check for the primary presence assertion.

  it('/api/usage/sessions route is registered in routes.ts', () => {
    assert.ok(routesSrc.includes('/api/usage/sessions'),
      '/api/usage/sessions not found in routes.ts — route may have been renamed or removed');
  });

  it('route selects hadAbsenceReturn from voiceSessions into the response', () => {
    // Global check — no region needed; this pattern is unique to the usage/sessions select.
    const hasField = routesSrc.includes('hadAbsenceReturn: voiceSessions.hadAbsenceReturn');
    assert.ok(hasField,
      'hadAbsenceReturn: voiceSessions.hadAbsenceReturn not found in routes.ts — field missing from API response');
  });

  it('route selects absenceReturnDays from voiceSessions into the response', () => {
    const hasField = routesSrc.includes('absenceReturnDays: voiceSessions.absenceReturnDays');
    assert.ok(hasField,
      'absenceReturnDays: voiceSessions.absenceReturnDays not found in routes.ts — field missing from API response');
  });

  it('both badge fields appear in the same select() block (not in separate unrelated queries)', () => {
    // Anchor on hadAbsenceReturn itself; absenceReturnDays is on the very next line (~60 chars later).
    const region = regionAround(routesSrc, 'hadAbsenceReturn: voiceSessions.hadAbsenceReturn', 0, 120);
    assert.ok(region.includes('absenceReturnDays: voiceSessions.absenceReturnDays'),
      'absenceReturnDays not found within 120 chars of hadAbsenceReturn in routes.ts — they may be in different query objects');
  });

  it('select block joins voiceSessions with users table (student name returned alongside badge fields)', () => {
    // The join is a few hundred chars after the select's from() call.
    // Anchor on hadAbsenceReturn and look 600 chars forward for the join.
    const region = regionAround(routesSrc, 'hadAbsenceReturn: voiceSessions.hadAbsenceReturn', 0, 600);
    const hasJoin = region.includes('leftJoin') || region.includes('innerJoin');
    assert.ok(hasJoin,
      'No join found near /api/usage/sessions select — student name and badge fields may not be in the same row');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PART 6 — Cross-cutting: field name consistency across the full stack
// ═══════════════════════════════════════════════════════════════════════════════

describe('field name consistency — same names across schema, handler, and route', () => {
  it('hadAbsenceReturn appears in schema, worker, and routes (handler delegates to applyAbsenceReturnFlag)', () => {
    // The WS handler was refactored to call applyAbsenceReturnFlag() so the field
    // name assignment lives in daniela-absence-worker.ts, not unified-ws-handler.ts.
    assert.ok(schemaSrc.includes('hadAbsenceReturn'),   'missing in shared/schema.ts');
    assert.ok(workerSrc.includes('hadAbsenceReturn'),   'missing in daniela-absence-worker.ts — applyAbsenceReturnFlag() must set this field');
    assert.ok(routesSrc.includes('hadAbsenceReturn'),   'missing in routes.ts');
  });

  it('absenceReturnDays appears in schema, worker, and routes (handler delegates to applyAbsenceReturnFlag)', () => {
    assert.ok(schemaSrc.includes('absenceReturnDays'),  'missing in shared/schema.ts');
    assert.ok(workerSrc.includes('absenceReturnDays'),  'missing in daniela-absence-worker.ts — applyAbsenceReturnFlag() must set this field');
    assert.ok(routesSrc.includes('absenceReturnDays'),  'missing in routes.ts');
  });

  it('WS handler calls applyAbsenceReturnFlag with absenceReturn.daysSinceLastSession (matching worker return field)', () => {
    // worker:  return { daysSinceLastSession: ..., firstName }
    // handler: applyAbsenceReturnFlag(sessionId, absenceReturn.daysSinceLastSession)
    // If the worker renames daysSinceLastSession the handler passes undefined silently.
    assert.ok(workerSrc.includes('daysSinceLastSession'),
      'daysSinceLastSession not found in daniela-absence-worker.ts — the WS handler passes absenceReturn.daysSinceLastSession');
    assert.ok(wsSrc.includes('absenceReturn.daysSinceLastSession'),
      'absenceReturn.daysSinceLastSession not found in unified-ws-handler.ts — handler must pass this field to applyAbsenceReturnFlag');
    assert.ok(wsSrc.includes('applyAbsenceReturnFlag'),
      'applyAbsenceReturnFlag not imported/called in unified-ws-handler.ts — badge writes have been removed');
  });

  it('DB column had_absence_return matches Drizzle camelCase field hadAbsenceReturn', () => {
    assert.ok(/boolean\s*\(\s*["']had_absence_return["']/.test(schemaSrc),
      'DB column name had_absence_return not found — Drizzle field hadAbsenceReturn maps to this DB column');
  });

  it('DB column absence_return_days matches Drizzle camelCase field absenceReturnDays', () => {
    assert.ok(/integer\s*\(\s*["']absence_return_days["']/.test(schemaSrc),
      'DB column name absence_return_days not found — Drizzle field absenceReturnDays maps to this DB column');
  });

  it('the worker function is imported into the WS handler (not just defined elsewhere)', () => {
    // Confirms the import binding actually exists — without it the call would be undefined at runtime.
    const hasImport = /import\s*\{[^}]*autoResolveAbsenceNudgeOnReturn[^}]*\}/.test(wsSrc);
    assert.ok(hasImport,
      'autoResolveAbsenceNudgeOnReturn is not in any import statement in unified-ws-handler.ts');
  });
});
