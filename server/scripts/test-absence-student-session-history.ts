/**
 * test-absence-student-session-history.ts
 *
 * Confirms via static source analysis that the "↩ Returned after N days" badge
 * is fully wired in the student's own session history view
 * (SessionHistory.tsx → /api/usage/sessions → getRecentSessions).
 *
 * The concern:
 *   Task #155 added hadAbsenceReturn / absenceReturnDays to the voice_sessions schema
 *   and rendered the badge in both the admin CommandCenter table AND the student-facing
 *   SessionHistory.tsx.  If someone refactors /api/usage/sessions to project only
 *   specific columns, or removes the badge from the student view, the indicator would
 *   silently disappear for students.
 *
 * This script checks:
 *   PART 1 — shared/schema.ts  : hadAbsenceReturn and absenceReturnDays columns exist
 *   PART 2 — usage-service.ts  : getRecentSessions uses bare .select() (all columns)
 *   PART 3 — routes.ts         : /api/usage/sessions calls getRecentSessions and
 *                                forwards the result directly as { sessions }
 *   PART 4 — SessionHistory.tsx: VoiceSession interface declares both fields
 *   PART 5 — SessionHistory.tsx: badge JSX renders when hadAbsenceReturn is truthy
 *
 * Run: npx tsx server/scripts/test-absence-student-session-history.ts
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

// ──────────────────────────────────────────────────────────────────────────────
// Load source files
// ──────────────────────────────────────────────────────────────────────────────
const schemaSrc       = readFileSync(resolve(__dirname, '../../shared/schema.ts'), 'utf-8');
const usageServiceSrc = readFileSync(resolve(__dirname, '../services/usage-service.ts'), 'utf-8');
const routesSrc       = readFileSync(resolve(__dirname, '../routes.ts'), 'utf-8');
const sessionHistorySrc = readFileSync(
  resolve(__dirname, '../../client/src/components/SessionHistory.tsx'),
  'utf-8',
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — shared/schema.ts: column definitions
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — shared/schema.ts: hadAbsenceReturn + absenceReturnDays columns'));
sep();

function part1() {
  assert(
    'hadAbsenceReturn column defined in schema',
    schemaSrc.includes('hadAbsenceReturn'),
    'Look for hadAbsenceReturn in shared/schema.ts voiceSessions table',
  );

  assert(
    'had_absence_return DB column name present',
    schemaSrc.includes('had_absence_return'),
    'Column should be had_absence_return (snake_case) in schema',
  );

  assert(
    'absenceReturnDays column defined in schema',
    schemaSrc.includes('absenceReturnDays'),
    'Look for absenceReturnDays in shared/schema.ts voiceSessions table',
  );

  assert(
    'absence_return_days DB column name present',
    schemaSrc.includes('absence_return_days'),
    'Column should be absence_return_days (snake_case) in schema',
  );
}
part1();

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — usage-service.ts: getRecentSessions returns all columns
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — usage-service.ts: getRecentSessions uses bare SELECT *'));
sep();

function part2() {
  // getRecentSessions must exist
  assert(
    'getRecentSessions method is defined',
    usageServiceSrc.includes('async getRecentSessions'),
    'Method not found in usage-service.ts',
  );

  // Extract the getRecentSessions method body (roughly between the method signature and the next async method)
  const getRecentIdx = usageServiceSrc.indexOf('async getRecentSessions');
  const nextMethodIdx = usageServiceSrc.indexOf('async ', getRecentIdx + 1);
  const methodBody = getRecentIdx >= 0
    ? usageServiceSrc.slice(getRecentIdx, nextMethodIdx > 0 ? nextMethodIdx : undefined)
    : '';

  // Must use .select() with no arguments (returns all columns)
  const hasBareSelect = /\.select\(\s*\)/.test(methodBody);
  assert(
    'getRecentSessions uses .select() with no column filter',
    hasBareSelect,
    'A column-filtered .select({...}) would silently drop hadAbsenceReturn from the result',
  );

  // Must query voiceSessions table
  assert(
    'getRecentSessions queries voiceSessions table',
    methodBody.includes('voiceSessions'),
    'Query target not found in getRecentSessions body',
  );

  // Must order by startedAt descending
  assert(
    'getRecentSessions orders by startedAt desc',
    methodBody.includes('startedAt'),
    'ORDER BY startedAt not found in getRecentSessions body',
  );
}
part2();

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — routes.ts: /api/usage/sessions calls getRecentSessions
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — routes.ts: /api/usage/sessions route wiring'));
sep();

function part3() {
  // Route must exist
  assert(
    "GET /api/usage/sessions route is registered",
    routesSrc.includes("'/api/usage/sessions'") || routesSrc.includes('"/api/usage/sessions"'),
    "Route not found in routes.ts",
  );

  // Extract the route handler block
  const routeIdx = routesSrc.indexOf('/api/usage/sessions');
  const blockSlice = routesSrc.slice(routeIdx, routeIdx + 600);

  // Must call getRecentSessions
  assert(
    'Route calls usageService.getRecentSessions',
    blockSlice.includes('getRecentSessions'),
    'Route does not call getRecentSessions — result may not include hadAbsenceReturn',
  );

  // Must forward result as { sessions }
  assert(
    'Route responds with { sessions } wrapping the getRecentSessions result',
    blockSlice.includes('{ sessions }'),
    'Route must respond with res.json({ sessions }) so the client receives the array',
  );
}
part3();

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — SessionHistory.tsx: VoiceSession interface declares both fields
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — SessionHistory.tsx: VoiceSession interface shape'));
sep();

function part4() {
  // hadAbsenceReturn field in the interface
  const hasHadField = /hadAbsenceReturn\s*\??\s*:/.test(sessionHistorySrc);
  assert(
    'VoiceSession interface declares hadAbsenceReturn',
    hasHadField,
    'Field missing from VoiceSession interface in SessionHistory.tsx',
  );

  // absenceReturnDays field in the interface
  const hasDaysField = /absenceReturnDays\s*\??\s*:/.test(sessionHistorySrc);
  assert(
    'VoiceSession interface declares absenceReturnDays',
    hasDaysField,
    'Field missing from VoiceSession interface in SessionHistory.tsx',
  );
}
part4();

// ══════════════════════════════════════════════════════════════════════════════
// PART 5 — SessionHistory.tsx: badge JSX renders when hadAbsenceReturn is truthy
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 5 — SessionHistory.tsx: badge JSX is present'));
sep();

function part5() {
  // Conditional render on hadAbsenceReturn
  assert(
    'Badge renders conditionally on session.hadAbsenceReturn',
    sessionHistorySrc.includes('session.hadAbsenceReturn'),
    'No conditional render on hadAbsenceReturn found in SessionHistory.tsx',
  );

  // Displays "Returned after"
  assert(
    'Badge text includes "Returned after"',
    sessionHistorySrc.includes('Returned after'),
    '"Returned after" text not found — badge copy may have changed',
  );

  // Reads absenceReturnDays for the day count
  assert(
    'Badge reads session.absenceReturnDays for the day count',
    sessionHistorySrc.includes('session.absenceReturnDays'),
    'absenceReturnDays not referenced in the badge render — day count would always show "?"',
  );

  // Uses the return arrow glyph (↩)
  assert(
    'Badge uses ↩ return arrow glyph',
    sessionHistorySrc.includes('↩'),
    '↩ arrow not found in SessionHistory.tsx — badge may be styled differently than planned',
  );

  // Badge is inside the session list item (not just any stray comment)
  const badgeIdx = sessionHistorySrc.indexOf('session.hadAbsenceReturn');
  const surroundingHtml = sessionHistorySrc.slice(Math.max(0, badgeIdx - 200), badgeIdx + 400);
  assert(
    'Badge is inside a <span> inside the session item',
    surroundingHtml.includes('<span'),
    'Badge does not appear inside a <span> — check render structure',
  );
}
part5();

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
sep();
const total = passed + failed;
console.log(`\n  Results: ${G(String(passed))} passed, ${failed > 0 ? R(String(failed)) : String(failed)} failed  (${total} checks)`);

if (failed === 0) {
  console.log(`\n  ${G('✓ ALL CHECKS PASSED')}`);
  console.log(D('  The student-facing "↩ Returned after N days" badge pipeline is fully wired:'));
  console.log(D('  schema → service (SELECT *) → route → VoiceSession interface → JSX badge'));
} else {
  console.log(`\n  ${R('✗ SOME CHECKS FAILED')} — review the items above`);
  process.exit(1);
}
