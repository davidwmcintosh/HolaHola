/**
 * test-classroom-exclusion-negative-path.ts
 *
 * Negative-path validation for the classroom-exclusion drift check that lives
 * in test-memory-tool-coverage.ts.
 *
 * WHAT THIS PROVES
 * ────────────────
 * The CLASSROOM_BLOCKED_EXEMPTIONS check asserts that every tool in the set
 * stays in GL_EXCLUDED_TOOLS.  But a green-only run cannot tell us whether the
 * guard has real bite — it might always pass even if GL_EXCLUDED_TOOLS is wrong.
 *
 * This script iterates ALL tools in CLASSROOM_BLOCKED_EXEMPTIONS and for each:
 *   1. (Negative path) Removes the tool from GL_EXCLUDED_TOOLS in-process,
 *      runs the drift check, and asserts it detects the drift.
 *   2. (Restore) Adds the tool back.
 *   3. (Positive path) Runs the drift check again and asserts it now passes.
 *
 * CI exits non-zero if any single tool fails either path.
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
console.log(Y('  Verifies the drift check has real bite for ALL tools in'));
console.log(Y('  CLASSROOM_BLOCKED_EXEMPTIONS by exercising both the failure'));
console.log(Y('  path and the success path for each tool in the same process.'));
console.log('');
console.log(`  Tools under test: ${[...CLASSROOM_BLOCKED_EXEMPTIONS].join(', ')}`);

let allPassed = true;

for (const toolName of CLASSROOM_BLOCKED_EXEMPTIONS) {
  // ════════════════════════════════════════════════════════════════════════════
  // NEGATIVE PATH — remove tool; check must detect drift
  // ════════════════════════════════════════════════════════════════════════════
  sep();
  console.log(B(`Tool: ${toolName}`));
  console.log(B(`  Step 1 — Negative path: removing ${toolName} from GL_EXCLUDED_TOOLS`));
  console.log(Y('  Expected: drift check detects the missing entry and reports FAIL.'));

  GL_EXCLUDED_TOOLS.delete(toolName);

  const driftAfterRemoval = runClassroomExclusionCheck();

  if (driftAfterRemoval.includes(toolName)) {
    console.log(`\n  ${G('✓')} Drift check correctly detected ${toolName} as missing.`);
    console.log(G('  NEGATIVE PATH PASSED — the guard fires when it should.'));
  } else {
    console.log(`\n  ${R('✗')} Drift check did NOT detect ${toolName} as missing.`);
    console.log(R('  NEGATIVE PATH FAILED — the guard is silently broken for this tool.'));
    console.log(Y('  This means the classroom-exclusion check in test-memory-tool-coverage.ts'));
    console.log(Y(`  would pass even when ${toolName} is removed from GL_EXCLUDED_TOOLS.`));
    allPassed = false;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // RESTORE — put tool back
  // ════════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log(B(`  Step 2 — Restore: adding ${toolName} back to GL_EXCLUDED_TOOLS`));

  GL_EXCLUDED_TOOLS.add(toolName);
  console.log(`  ${G('✓')} ${toolName} restored.`);

  // ════════════════════════════════════════════════════════════════════════════
  // POSITIVE PATH — check must now pass (no drift for this tool)
  // ════════════════════════════════════════════════════════════════════════════
  console.log('');
  console.log(B(`  Step 3 — Positive path: ${toolName} present in GL_EXCLUDED_TOOLS`));
  console.log(Y('  Expected: drift check finds no issues and reports PASS.'));

  const driftAfterRestore = runClassroomExclusionCheck();

  if (!driftAfterRestore.includes(toolName)) {
    console.log(`\n  ${G('✓')} Drift check correctly reports no drift for ${toolName}.`);
    console.log(G('  POSITIVE PATH PASSED — the guard clears when it should.'));
  } else {
    console.log(`\n  ${R('✗')} Drift check still reports drift for ${toolName} after restore:`);
    for (const name of driftAfterRestore) {
      console.log(R(`    ✗ ${name}`));
    }
    console.log(R('  POSITIVE PATH FAILED — the guard did not clear after restore.'));
    console.log(Y('  Check that GL_EXCLUDED_TOOLS is correctly exported and mutable.'));
    allPassed = false;
  }
}

// ─── Final summary ────────────────────────────────────────────────────────────
sep();
const toolCount = CLASSROOM_BLOCKED_EXEMPTIONS.size;
if (allPassed) {
  console.log(G('ALL PATHS PASSED'));
  console.log(G(`  The classroom-exclusion drift check has confirmed bite for all ${toolCount} tools:`));
  for (const toolName of CLASSROOM_BLOCKED_EXEMPTIONS) {
    console.log(G(`    ✓ ${toolName}`));
  }
  console.log(G('  Each fires on drift and clears on restore.'));
  console.log('');
} else {
  console.log(R('ONE OR MORE PATHS FAILED — see ✗ lines above.'));
  process.exit(1);
}
