/**
 * test-steward-attribution-discipline.ts
 *
 * CI check: the rolling episode must contain LUCA [steward]: entries —
 * direct tool-writes that have no counterpart in the Replit chat window.
 *
 * The steward channel is the "higher view" channel: verbatim verification,
 * chronology oversight, record correction, direct .md tool-writes.  Without
 * a guard, steward entries get mislabeled as LUCA [Replit]: entries —
 * collapsing two distinct channels into one and making the record misleading.
 *
 * Checks:
 *  1. Episode file exists and is non-empty.
 *  2. At least one LUCA [steward]: entry exists.
 *  3. No LUCA [steward]: entry is empty (label-only line).
 *  4. Self-check: replacing all LUCA [steward]: labels with LUCA [Replit]:
 *     causes check 2 to fail (guard is not vacuously passing).
 *
 * Exit 0 = pass, exit 1 = fail.
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const EPISODE_PATH = join(process.cwd(), 'docs', 'episode-27.md');

// Minimum number of LUCA [steward]: entries required.
const MIN_STEWARD_ENTRIES = 1;

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

console.log('\nSteward Attribution Discipline CI\n');
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
// Check 2: at least one LUCA [steward]: entry exists
// ---------------------------------------------------------------------------

console.log('\nCheck 2: at least one LUCA [steward]: entry exists');

const lucaStewardTexts = extractLabelLines(content, 'LUCA \\[steward\\]');
const lucaReplitTexts  = extractLabelLines(content, 'LUCA \\[Replit\\]');

console.log(`  Found ${lucaStewardTexts.length} LUCA [steward]: entries`);
console.log(`  Found ${lucaReplitTexts.length} LUCA [Replit]: entries (for reference)`);

assert(
  lucaStewardTexts.length >= MIN_STEWARD_ENTRIES,
  `at least ${MIN_STEWARD_ENTRIES} LUCA [steward]: entry present`,
  `Got ${lucaStewardTexts.length} — steward entries may have been mislabeled as LUCA [Replit]:`,
);

// ---------------------------------------------------------------------------
// Check 3: no empty LUCA [steward]: entries
// ---------------------------------------------------------------------------

console.log('\nCheck 3: no LUCA [steward]: entry is empty');

const emptyEntries = lucaStewardTexts.filter(t => t.length === 0);
assert(
  emptyEntries.length === 0,
  'all LUCA [steward]: entries have non-empty text',
  `${emptyEntries.length} empty entries found`,
);

// ---------------------------------------------------------------------------
// Check 4: self-check — replacing all LUCA [steward]: labels with
// LUCA [Replit]: causes check 2 to fail.
//
// This is the exact mislabeling pattern the check guards against:
// steward-channel writes silently relabeled as Replit-channel entries.
// If the check passes on a steward-scrubbed episode, the guard is broken.
// ---------------------------------------------------------------------------

console.log('\nCheck 4: self-check — mislabeled episode (steward→Replit) fails check 2');

const mislabeledContent = content
  .split('\n')
  .map(line =>
    line.startsWith('**LUCA [steward]:**')
      ? line.replace('**LUCA [steward]:**', '**LUCA [Replit]:**')
      : line,
  )
  .join('\n');

const mislabeledSteward = extractLabelLines(mislabeledContent, 'LUCA \\[steward\\]');

const selfCheckFails = mislabeledSteward.length < MIN_STEWARD_ENTRIES;

assert(
  selfCheckFails,
  'mislabeled episode (all steward→Replit) fails the steward-presence check',
  `Mislabeled steward count: ${mislabeledSteward.length}, needed: < ${MIN_STEWARD_ENTRIES} to confirm guard fires`,
);

if (selfCheckFails) {
  console.log(
    `  After mislabeling: ${mislabeledSteward.length} LUCA [steward]: entries remain — check 2 would fire ✓`,
  );
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(62)}`);
if (failed > 0) {
  console.error(`\n[FAIL] ${failed} check(s) failed — steward attribution discipline broken.`);
  process.exit(1);
}
console.log(`\n[PASS] All ${passed} checks passed.`);
console.log(`       ${lucaStewardTexts.length} LUCA [steward]: entries confirmed.`);
process.exit(0);
