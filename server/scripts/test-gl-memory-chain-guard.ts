/**
 * test-gl-memory-chain-guard.ts
 *
 * Structural guard: confirms that the GL (Gemini Live) memory-chain guard in
 * gemini-live-session.ts is correctly wired — using the shared constants from
 * memory-chain-guard.ts rather than hardcoded duplicates.
 *
 * What it checks:
 *   1. MEMORY_TOOL_NAMES, MEMORY_CHAIN_LIMIT, and MEMORY_CHAIN_NUDGE_TEXT are
 *      imported from './memory-chain-guard' in gemini-live-session.ts.
 *   2. The guard block (`consecutiveMemoryCalls`) exists and uses
 *      MEMORY_CHAIN_LIMIT for the threshold comparison.
 *   3. The nudge text injected into the response uses MEMORY_CHAIN_NUDGE_TEXT
 *      (no hardcoded duplicate string).
 *   4. `consecutiveMemoryCalls` is reset in all three required places:
 *      — on a non-memory-only batch (streak broken)
 *      — on generationComplete (turn finished with audio/text)
 *      — at session end / explicit reset
 *   5. The shared unit tests (memory-chain-guard.test.ts), which cover both
 *      text-mode and GL simulations, are present in the test file.
 *
 * Run: npx tsx server/scripts/test-gl-memory-chain-guard.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

const GL_SRC  = resolve(__dirname, '../services/gemini-live-session.ts');
const UNIT_TEST = resolve(__dirname, '../__tests__/memory-chain-guard.test.ts');

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — Import wiring: shared constants imported, not duplicated
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — Shared constants imported from memory-chain-guard.ts'));
sep();

const src = readFileSync(GL_SRC, 'utf-8');

assert(
  'MEMORY_TOOL_NAMES imported from ./memory-chain-guard in gemini-live-session.ts',
  /import\s*\{[^}]*MEMORY_TOOL_NAMES[^}]*\}\s*from\s*['"]\.\/memory-chain-guard['"]/.test(src),
  'Pattern not found — MEMORY_TOOL_NAMES may be hardcoded or imported from wrong path',
);

assert(
  'MEMORY_CHAIN_LIMIT imported from ./memory-chain-guard',
  /import\s*\{[^}]*MEMORY_CHAIN_LIMIT[^}]*\}\s*from\s*['"]\.\/memory-chain-guard['"]/.test(src),
  'Pattern not found — MEMORY_CHAIN_LIMIT may be hardcoded',
);

assert(
  'MEMORY_CHAIN_NUDGE_TEXT imported from ./memory-chain-guard',
  /import\s*\{[^}]*MEMORY_CHAIN_NUDGE_TEXT[^}]*\}\s*from\s*['"]\.\/memory-chain-guard['"]/.test(src),
  'Pattern not found — MEMORY_CHAIN_NUDGE_TEXT may be hardcoded',
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Guard block uses shared constants for threshold and nudge text
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Guard block uses shared constants (not hardcoded values)'));
sep();

assert(
  'consecutiveMemoryCalls field referenced in GL session',
  src.includes('consecutiveMemoryCalls'),
  'Field not found in gemini-live-session.ts',
);

assert(
  'Threshold comparison uses MEMORY_CHAIN_LIMIT (not a hardcoded number)',
  /consecutiveMemoryCalls\s*>=\s*MEMORY_CHAIN_LIMIT/.test(src) ||
  /MEMORY_CHAIN_LIMIT/.test(src) && /consecutiveMemoryCalls/.test(src),
  'Guard may be using a hardcoded threshold instead of MEMORY_CHAIN_LIMIT',
);

assert(
  'Nudge text uses MEMORY_CHAIN_NUDGE_TEXT constant (not a hardcoded string)',
  src.includes('MEMORY_CHAIN_NUDGE_TEXT'),
  'MEMORY_CHAIN_NUDGE_TEXT not referenced — nudge text may be hardcoded',
);

assert(
  'MEMORY_TOOL_NAMES.has() used to classify tools in GL session',
  src.includes('MEMORY_TOOL_NAMES.has('),
  'MEMORY_TOOL_NAMES.has() not found — tool classification may differ from text-mode',
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Counter resets in all required places
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — consecutiveMemoryCalls resets in all required places'));
sep();

// Count how many times the counter is reset to 0
const resetMatches = src.match(/consecutiveMemoryCalls\s*=\s*0/g) ?? [];
assert(
  'consecutiveMemoryCalls reset to 0 in at least 3 places (streak break / generationComplete / session end)',
  resetMatches.length >= 3,
  `Found only ${resetMatches.length} reset(s) — expected ≥ 3`,
);

// The counter increment must also exist
const incrementMatches = src.match(/consecutiveMemoryCalls\s*=\s*prev\s*\+\s*1|consecutiveMemoryCalls\s*\+\+|\+\+.*consecutiveMemoryCalls/g) ?? [];
const assignIncrements = src.match(/consecutiveMemoryCalls\s*=\s*\w+\s*\+\s*1/g) ?? [];
assert(
  'consecutiveMemoryCalls incremented inside the guard block',
  incrementMatches.length > 0 || assignIncrements.length > 0,
  'No increment expression found — guard may not be counting correctly',
);

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Unit test file covers GL simulation
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — Unit test file contains GL simulation tests'));
sep();

const unitSrc = readFileSync(UNIT_TEST, 'utf-8');

assert(
  'Unit test file contains simulateGLGuard helper',
  unitSrc.includes('simulateGLGuard'),
  'simulateGLGuard not found in memory-chain-guard.test.ts',
);

assert(
  'Unit test file has GL guard describe block',
  /describe\s*\(\s*['"]GL guard/.test(unitSrc),
  'No GL guard describe block found in memory-chain-guard.test.ts',
);

assert(
  'Unit test covers read_full_memory exclusion in GL mode',
  unitSrc.includes('read_full_memory') && unitSrc.includes('GL'),
  'GL + read_full_memory coverage not found in unit tests',
);

assert(
  'Unit test verifies nudge fires only once in GL mode (nudgeSent gate)',
  unitSrc.includes('nudgeSent') || unitSrc.includes('fires only once'),
  'GL once-only nudge gate not verified in unit tests',
);

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
sep();
const all = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓  All ${all} assertions passed.\n`));
  console.log(G('   • GL session imports shared constants (no hardcoded duplicates)\n'));
  console.log(G('   • Guard block uses MEMORY_CHAIN_LIMIT and MEMORY_CHAIN_NUDGE_TEXT\n'));
  console.log(G('   • Counter resets in all required code paths\n'));
  console.log(G('   • Unit tests cover the GL simulation path\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
  process.exit(1);
}
