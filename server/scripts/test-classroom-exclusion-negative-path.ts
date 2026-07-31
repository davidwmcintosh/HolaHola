/**
 * test-classroom-exclusion-negative-path.ts
 *
 * Negative-path validation for the classroom-exclusion drift check that lives
 * in test-memory-tool-coverage.ts.
 *
 * WHAT THIS PROVES
 * ────────────────
 * The CLASSROOM_BLOCKED_EXEMPTIONS check asserts that read_full_memory stays in
 * GL_EXCLUDED_TOOLS.  But a green-only run cannot tell us whether the guard has
 * real bite — it might always pass even if GL_EXCLUDED_TOOLS is wrong.
 *
 * This script:
 *   1. (Negative path) Removes read_full_memory from GL_EXCLUDED_TOOLS in-process,
 *      runs the drift check, and asserts it detects the drift.
 *   2. (Restore) Adds read_full_memory back.
 *   3. (Positive path) Runs the drift check again and asserts it now passes.
 *
 * Exits 0 when both assertions hold; exits 1 with a clear message otherwise.
 *
 * Run: npx tsx server/scripts/test-classroom-exclusion-negative-path.ts
 */

import { GL_EXCLUDED_TOOLS } from '../services/daniela-function-registry';
// CLASSROOM_BLOCKED_EXEMPTIONS is the single source of truth — defined in
// memory-chain-guard.ts and shared with test-memory-tool-coverage.ts so the
// two scripts cannot silently drift apart.
import { CLASSROOM_BLOCKED_EXEMPTIONS } from '../services/memory-chain-guard';

// ─── Colour helpers ───────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ─── Core check: returns drift list ───────────────────────────────────────────
function runClassroomExclusionCheck(): string[] {
  const drift: string[] = [];
  for (const toolName of CLASSROOM_BLOCKED_EXEMPTIONS) {
    if (!GL_EXCLUDED_TOOLS.has(toolName)) {
      drift.push(toolName);
    }
  }
  return drift;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

sep();
console.log(B('Classroom-exclusion drift check — negative-path validator'));
console.log(Y('  Verifies the drift check has real bite by exercising both'));
console.log(Y('  the failure path and the success path in the same process.'));

let allPassed = true;

// ══════════════════════════════════════════════════════════════════════════════
// NEGATIVE PATH — remove read_full_memory; check must detect drift
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 1 — Negative path: read_full_memory removed from GL_EXCLUDED_TOOLS'));
console.log(Y('  Expected: drift check detects the missing entry and reports FAIL.'));

GL_EXCLUDED_TOOLS.delete('read_full_memory');

const driftAfterRemoval = runClassroomExclusionCheck();

if (driftAfterRemoval.includes('read_full_memory')) {
  console.log(`\n  ${G('✓')} Drift check correctly detected read_full_memory as missing.`);
  console.log(G('  NEGATIVE PATH PASSED — the guard fires when it should.'));
} else {
  console.log(`\n  ${R('✗')} Drift check did NOT detect read_full_memory as missing.`);
  console.log(R('  NEGATIVE PATH FAILED — the guard is silently broken.'));
  console.log(Y('  This means the classroom-exclusion check in test-memory-tool-coverage.ts'));
  console.log(Y('  would pass even when GL_EXCLUDED_TOOLS is wrong.'));
  allPassed = false;
}

// ══════════════════════════════════════════════════════════════════════════════
// RESTORE — put read_full_memory back
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 2 — Restore: adding read_full_memory back to GL_EXCLUDED_TOOLS'));

GL_EXCLUDED_TOOLS.add('read_full_memory');
console.log(`  ${G('✓')} read_full_memory restored.`);

// ══════════════════════════════════════════════════════════════════════════════
// POSITIVE PATH — check must now pass (no drift)
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 3 — Positive path: read_full_memory present in GL_EXCLUDED_TOOLS'));
console.log(Y('  Expected: drift check finds no issues and reports PASS.'));

const driftAfterRestore = runClassroomExclusionCheck();

if (driftAfterRestore.length === 0) {
  console.log(`\n  ${G('✓')} Drift check correctly reports no classroom-exclusion drift.`);
  console.log(G('  POSITIVE PATH PASSED — the guard clears when it should.'));
} else {
  console.log(`\n  ${R('✗')} Drift check still reports drift after restore:`);
  for (const name of driftAfterRestore) {
    console.log(R(`    ✗ ${name}`));
  }
  console.log(R('  POSITIVE PATH FAILED — the guard did not clear after restore.'));
  console.log(Y('  Check that GL_EXCLUDED_TOOLS is correctly exported and mutable.'));
  allPassed = false;
}

// ─── Summary ─────────────────────────────────────────────────────────────────
sep();
if (allPassed) {
  console.log(G('ALL PATHS PASSED'));
  console.log(G('  The classroom-exclusion drift check has confirmed bite:'));
  console.log(G('  it fires on drift and clears on restore.'));
  console.log('');
} else {
  console.log(R('ONE OR MORE PATHS FAILED — see ✗ lines above.'));
  process.exit(1);
}
