/**
 * test-replit-attribution-discipline.ts
 *
 * CI check: the rolling episode must contain LUCA [Replit]: entries in
 * reasonable proportion to DAVID: entries.
 *
 * The Replit window channel has no auto-capture mechanism — Luca must
 * write the preamble text into the episode every turn.  This check fails
 * loudly when the discipline breaks down: when entries stop appearing while
 * David keeps writing, or when any entry is present but empty.
 *
 * Checks:
 *  1. Episode file exists and is non-empty.
 *  2. At least one LUCA [Replit]: entry exists.
 *  3. No LUCA [Replit]: entry is empty (label-only line).
 *  4. Ratio: LUCA [Replit]: count >= DAVID: count / 10
 *     (minimum: one Luca Replit entry per 10 David entries — loose enough
 *      for turns where Luca is doing background tool work, tight enough to
 *      catch sessions where the discipline has silently stopped).
 *  5. Self-check: stripping all LUCA [Replit]: lines causes the ratio check
 *     to fail (guard is not vacuously passing).
 *
 * Exit 0 = pass, exit 1 = fail.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EPISODE_PATH = join(process.cwd(), 'docs', 'episode-27.md');

// One LUCA [Replit]: entry per N DAVID: entries is the minimum acceptable ratio.
const MIN_RATIO_DENOMINATOR = 10;

// ---------------------------------------------------------------------------
// Minimal harness
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? `\n    ${detail}` : ''}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------

function extractLabelLines(content: string, label: string): string[] {
  // Episode format: **LABEL:** text  — the colon lives INSIDE the bold markers.
  // Raw text: **LABEL:** so the closing ** follows the colon, not precedes it.
  const re = new RegExp(`^\\*\\*${label}:\\*\\*(.*)$`, 'gm');
  const matches: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    matches.push(m[1].trim()); // capture the text after the label
  }
  return matches;
}

// ---------------------------------------------------------------------------
// Load episode
// ---------------------------------------------------------------------------

console.log('\nReplit Attribution Discipline CI\n');
console.log(`  Episode: ${EPISODE_PATH}`);

// ---------------------------------------------------------------------------
// Check 1: file exists
// ---------------------------------------------------------------------------

console.log('\nCheck 1: episode file exists');
assert(existsSync(EPISODE_PATH), 'episode-27.md exists');

const content = existsSync(EPISODE_PATH)
  ? readFileSync(EPISODE_PATH, 'utf-8')
  : '';

assert(content.length > 0, 'episode-27.md is non-empty');

// ---------------------------------------------------------------------------
// Check 2: at least one LUCA [Replit]: entry
// ---------------------------------------------------------------------------

console.log('\nCheck 2: at least one LUCA [Replit]: entry exists');

const lucaReplitTexts = extractLabelLines(content, 'LUCA \\[Replit\\]');
const davidTexts      = extractLabelLines(content, 'DAVID');

console.log(`  Found ${lucaReplitTexts.length} LUCA [Replit]: entries`);
console.log(`  Found ${davidTexts.length} DAVID: entries`);

assert(
  lucaReplitTexts.length >= 1,
  'at least one LUCA [Replit]: entry present',
  `Got ${lucaReplitTexts.length} — discipline may have stopped`,
);

// ---------------------------------------------------------------------------
// Check 3: no empty LUCA [Replit]: entries
// ---------------------------------------------------------------------------

console.log('\nCheck 3: no LUCA [Replit]: entry is empty');

const emptyEntries = lucaReplitTexts.filter(t => t.length === 0);
assert(
  emptyEntries.length === 0,
  'all LUCA [Replit]: entries have non-empty text',
  `${emptyEntries.length} empty entries found`,
);

// ---------------------------------------------------------------------------
// Check 4: proportionality
// ---------------------------------------------------------------------------

console.log('\nCheck 4: LUCA [Replit]: / DAVID: ratio >= 1 / 10');

if (davidTexts.length === 0) {
  assert(true, 'ratio check skipped (no DAVID: entries yet)');
} else {
  const minExpected = Math.max(1, Math.floor(davidTexts.length / MIN_RATIO_DENOMINATOR));
  assert(
    lucaReplitTexts.length >= minExpected,
    `ratio satisfied: ${lucaReplitTexts.length} LUCA [Replit]: >= ${minExpected} (1/${MIN_RATIO_DENOMINATOR} of ${davidTexts.length} DAVID:)`,
    `Only ${lucaReplitTexts.length} LUCA [Replit]: entries for ${davidTexts.length} DAVID: — expected at least ${minExpected}`,
  );
}

// ---------------------------------------------------------------------------
// Check 5: self-check — stripping all LUCA [Replit]: lines causes ratio to fail
// ---------------------------------------------------------------------------

console.log('\nCheck 5: self-check — stripped content fails ratio check');

const strippedContent = content
  .split('\n')
  .filter(line => !line.startsWith('**LUCA [Replit]:**'))
  .join('\n');

const strippedLuca  = extractLabelLines(strippedContent, 'LUCA \\[Replit\\]');
const strippedDavid = extractLabelLines(strippedContent, 'DAVID');

const selfCheckMinExpected = strippedDavid.length > 0
  ? Math.max(1, Math.floor(strippedDavid.length / MIN_RATIO_DENOMINATOR))
  : 1;

const strippedFails = strippedLuca.length < selfCheckMinExpected || strippedLuca.length === 0;

assert(
  strippedFails,
  'stripped episode fails the ratio check (guard is not vacuously passing)',
  `Stripped count: ${strippedLuca.length}, needed: ${selfCheckMinExpected}`,
);

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(62)}`);
if (failed > 0) {
  console.error(`\n[FAIL] ${failed} check(s) failed — Replit attribution discipline broken.`);
  process.exit(1);
}
console.log(`\n[PASS] All ${passed} checks passed.`);
console.log(`       ${lucaReplitTexts.length} LUCA [Replit]: entries, ${davidTexts.length} DAVID: entries.`);
process.exit(0);
