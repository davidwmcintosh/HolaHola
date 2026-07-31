/**
 * test-classroom-exclusion-expanded-negative-path.ts
 *
 * Negative-path validation for the classroom-exclusion drift check covering the
 * four tools added to CLASSROOM_BLOCKED_EXEMPTIONS in Task #222:
 *
 *   • search_my_history
 *   • recall_what_i_shared
 *   • read_my_curiosities
 *   • recall_express_lane_image
 *
 * WHAT THIS PROVES
 * ────────────────
 * The CLASSROOM_BLOCKED_EXEMPTIONS check in test-memory-tool-coverage.ts asserts
 * that each of these tools stays in GL_EXCLUDED_TOOLS.  But a green-only run
 * cannot tell us whether the guard has real bite — it might always pass even if
 * GL_EXCLUDED_TOOLS is wrong.
 *
 * For each of the four tools this script:
 *   1. (Negative path) Removes the tool from GL_EXCLUDED_TOOLS in-process,
 *      runs the drift check, and asserts it detects the drift.
 *   2. (Restore) Adds the tool back.
 *   3. (Positive path) Runs the drift check again and asserts it now passes.
 *
 * No permanent registry change is made — all mutations are in-process only.
 * Exits 0 when every assertion holds; exits 1 with a clear message otherwise.
 *
 * Run: npx tsx server/scripts/test-classroom-exclusion-expanded-negative-path.ts
 */

import { GL_EXCLUDED_TOOLS } from '../services/daniela-function-registry';
// CLASSROOM_BLOCKED_EXEMPTIONS is the single source of truth — shared with
// test-memory-tool-coverage.ts so the two scripts cannot silently drift apart.
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

// ─── Tools under test ─────────────────────────────────────────────────────────
// These are the four tools added to CLASSROOM_BLOCKED_EXEMPTIONS alongside
// read_full_memory. Each one must individually cause the drift check to fire
// when removed from GL_EXCLUDED_TOOLS.
const TOOLS_UNDER_TEST: string[] = [
  'search_my_history',
  'recall_what_i_shared',
  'read_my_curiosities',
  'recall_express_lane_image',
];

// ─── Preflight: verify all four tools are actually in GL_EXCLUDED_TOOLS ───────
sep();
console.log(B('Classroom-exclusion drift check — expanded negative-path validator'));
console.log(Y('  Covers four newly-guarded tools: search_my_history, recall_what_i_shared,'));
console.log(Y('  read_my_curiosities, recall_express_lane_image.'));
console.log(Y('  Verifies the drift check fires on removal and clears on restore,'));
console.log(Y('  one tool at a time, without permanently changing the registry.'));

let allPassed = true;

sep();
console.log(B('Preflight — all four tools must be present in GL_EXCLUDED_TOOLS'));

let preflightOk = true;
for (const tool of TOOLS_UNDER_TEST) {
  if (GL_EXCLUDED_TOOLS.has(tool)) {
    console.log(`  ${G('✓')} ${tool}  (present — test can proceed)`);
  } else {
    console.log(R(`  ✗ ${tool}  — NOT in GL_EXCLUDED_TOOLS; drift has already occurred.`));
    console.log(R(`    Fix: add ${tool} back to GL_EXCLUDED_TOOLS in daniela-function-registry.ts`));
    preflightOk = false;
    allPassed = false;
  }
}

if (!preflightOk) {
  sep();
  console.log(R('PREFLIGHT FAILED — one or more tools are already missing from GL_EXCLUDED_TOOLS.'));
  console.log(R('Cannot run negative-path tests against an already-drifted registry.'));
  process.exit(1);
}

// ─── Per-tool negative / restore / positive cycle ─────────────────────────────

for (const toolName of TOOLS_UNDER_TEST) {
  sep();
  console.log(B(`Testing: ${toolName}`));

  // ── Step 1: Negative path ──────────────────────────────────────────────────
  console.log(B(`  Step 1 — Negative path: ${toolName} removed from GL_EXCLUDED_TOOLS`));
  console.log(Y('    Expected: drift check detects the missing entry and reports FAIL.'));

  GL_EXCLUDED_TOOLS.delete(toolName);

  const driftAfterRemoval = runClassroomExclusionCheck();

  if (driftAfterRemoval.includes(toolName)) {
    console.log(`\n    ${G('✓')} Drift check correctly detected ${toolName} as missing.`);
    console.log(G('    NEGATIVE PATH PASSED — the guard fires when it should.'));
  } else {
    console.log(`\n    ${R(`✗ Drift check did NOT detect ${toolName} as missing.`)}`);
    console.log(R('    NEGATIVE PATH FAILED — the guard is silently broken.'));
    console.log(Y('    This means the classroom-exclusion check in test-memory-tool-coverage.ts'));
    console.log(Y(`    would pass even when ${toolName} is absent from GL_EXCLUDED_TOOLS.`));
    allPassed = false;
  }

  // ── Step 2: Restore ────────────────────────────────────────────────────────
  console.log('');
  console.log(B(`  Step 2 — Restore: adding ${toolName} back to GL_EXCLUDED_TOOLS`));

  GL_EXCLUDED_TOOLS.add(toolName);
  console.log(`    ${G(`✓ ${toolName} restored.`)}`);

  // ── Step 3: Positive path ──────────────────────────────────────────────────
  console.log(B(`  Step 3 — Positive path: ${toolName} present in GL_EXCLUDED_TOOLS`));
  console.log(Y('    Expected: drift check finds no drift for this tool.'));

  const driftAfterRestore = runClassroomExclusionCheck();

  if (!driftAfterRestore.includes(toolName)) {
    console.log(`\n    ${G('✓')} Drift check correctly reports no drift for this tool.`);
    console.log(G('    POSITIVE PATH PASSED — the guard clears when it should.'));
  } else {
    console.log(`\n    ${R(`✗ Drift check still reports ${toolName} as drifted after restore.`)}`);
    console.log(R('    POSITIVE PATH FAILED — the guard did not clear after restore.'));
    console.log(Y('    Check that GL_EXCLUDED_TOOLS is correctly exported and mutable.'));
    allPassed = false;
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
sep();
if (allPassed) {
  console.log(G('ALL PATHS PASSED'));
  console.log(G('  The classroom-exclusion drift check has confirmed bite for all four tools:'));
  for (const tool of TOOLS_UNDER_TEST) {
    console.log(G(`    • ${tool}`));
  }
  console.log(G('  Each fires on drift and clears on restore.'));
  console.log('');
} else {
  console.log(R('ONE OR MORE PATHS FAILED — see ✗ lines above.'));
  process.exit(1);
}
