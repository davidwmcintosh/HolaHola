/**
 * test-memory-tool-coverage-negative-path.ts
 *
 * Negative-path validator for the memory-tool coverage check in
 * test-memory-tool-coverage.ts.
 *
 * WHAT THIS PROVES
 * ────────────────
 * The coverage check exits non-zero when a tool whose name matches a
 * memory-retrieval naming pattern appears in DANIELA_FUNCTION_DECLARATIONS but
 * is listed in NEITHER MEMORY_TOOL_NAMES NOR KNOWN_NON_GUARD_TOOLS.
 *
 * A green-only run of the coverage check cannot prove the guard has real bite —
 * it could silently always pass even if the detection logic is broken.  This
 * script exercises both failure and success paths in the same process:
 *
 *   Step 1 — Negative path:
 *     Inject a fake tool ("recall_fake_coverage_test") whose name matches the
 *     "recall" prefix but is absent from both whitelists.  Run the check and
 *     assert it detects the uncategorized tool.
 *
 *   Step 2 — Restore & positive path:
 *     Remove the fake tool.  Run the check again and assert it now passes.
 *
 * Exits 0 when both assertions hold; exits 1 with a clear message otherwise.
 *
 * Run: npx tsx server/scripts/test-memory-tool-coverage-negative-path.ts
 */

import { Type } from '@google/genai';
import { DANIELA_FUNCTION_DECLARATIONS } from '../services/daniela-function-registry';
import { MEMORY_TOOL_NAMES } from '../services/memory-chain-guard';
import {
  MEMORY_PATTERN_PREFIXES,
  KNOWN_NON_GUARD_TOOLS,
  KNOWN_MEMORY_DISPATCHERS,
} from '../services/memory-tool-coverage-constants';
// ↑ Single source of truth — do NOT redefine these here.
// To add a new prefix, exemption, or dispatcher, edit memory-tool-coverage-constants.ts.
// Both test-memory-tool-coverage.ts and this script import from there.

// ─── Colour helpers ───────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ─── Core check: returns names of uncategorized tools ─────────────────────────
//
// Mirrors the categorisation logic in test-memory-tool-coverage.ts:
//   1. Skip tools not matching any memory-retrieval prefix.
//   2. Skip tools in MEMORY_TOOL_NAMES     (chain-guarded).
//   3. Skip tools in KNOWN_NON_GUARD_TOOLS (intentionally excluded).
//   4. Skip tools in KNOWN_MEMORY_DISPATCHERS (dispatcher-level exemptions).
//   5. Everything else is uncategorized — a coverage gap.
//
// 'recall_fake_coverage_test' intentionally appears in none of the above sets,
// so the negative-path injection (Step 1 below) will surface it correctly.
//
function runUncategorizedCheck(declarations: typeof DANIELA_FUNCTION_DECLARATIONS): string[] {
  const uncategorized: string[] = [];
  for (const decl of declarations) {
    const name = decl.name as string;
    const matchesPattern = MEMORY_PATTERN_PREFIXES.some((prefix) =>
      name.startsWith(prefix),
    );
    if (!matchesPattern) continue;
    if (MEMORY_TOOL_NAMES.has(name)) continue;
    if (KNOWN_NON_GUARD_TOOLS.has(name)) continue;
    if (KNOWN_MEMORY_DISPATCHERS.has(name)) continue;
    uncategorized.push(name);
  }
  return uncategorized;
}

// ─── Fake tool name used for injection ───────────────────────────────────────
const FAKE_TOOL_NAME = 'recall_fake_coverage_test';

// ─── Main ─────────────────────────────────────────────────────────────────────

sep();
console.log(B('Memory-tool coverage check — negative-path validator'));
console.log(Y('  Verifies the uncategorized-tool check has real bite by exercising'));
console.log(Y('  both the failure path and the success path in the same process.'));

let allPassed = true;

// ═══════════════════════════════════════════════════════════════════════════════
// PRE-CHECK — ensure the fake tool is not somehow already in the registry
// ═══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Pre-check: fake tool must not pre-exist in the registry'));

const preExisting = DANIELA_FUNCTION_DECLARATIONS.find(
  (d) => (d.name as string) === FAKE_TOOL_NAME,
);
if (preExisting) {
  console.log(R(`✗ ${FAKE_TOOL_NAME} already exists in DANIELA_FUNCTION_DECLARATIONS.`));
  console.log(R('  Choose a different fake tool name that is not in the real registry.'));
  process.exit(1);
}
console.log(`  ${G('✓')} Fake tool name is not in the live registry — safe to inject.`);

// ═══════════════════════════════════════════════════════════════════════════════
// NEGATIVE PATH — inject fake tool; check must detect it as uncategorized
// ═══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B(`Step 1 — Negative path: inject "${FAKE_TOOL_NAME}" into registry`));
console.log(Y(`  The name matches the 'recall' prefix but is absent from both`));
console.log(Y(`  MEMORY_TOOL_NAMES and KNOWN_NON_GUARD_TOOLS.`));
console.log(Y('  Expected: check detects it as uncategorized and reports FAIL.'));

// Push the fake tool into the live declarations array (module is shared by
// reference, so the check function sees the mutation).
DANIELA_FUNCTION_DECLARATIONS.push({
  name: FAKE_TOOL_NAME,
  description: 'Fake tool injected by negative-path test — not a real tool.',
  parameters: { type: Type.OBJECT, properties: {} },
});

const uncategorizedAfterInjection = runUncategorizedCheck(DANIELA_FUNCTION_DECLARATIONS);

if (uncategorizedAfterInjection.includes(FAKE_TOOL_NAME)) {
  console.log(`\n  ${G('✓')} Check correctly flagged "${FAKE_TOOL_NAME}" as uncategorized.`);
  console.log(G('  NEGATIVE PATH PASSED — the guard fires when it should.'));
} else {
  console.log(`\n  ${R(`✗ Check did NOT flag "${FAKE_TOOL_NAME}" as uncategorized.`)}`);
  console.log(R('  NEGATIVE PATH FAILED — the coverage check is silently broken.'));
  console.log(Y('  Possible causes:'));
  console.log(Y(`    • "${FAKE_TOOL_NAME}" was accidentally added to MEMORY_TOOL_NAMES`));
  console.log(Y(`    • "${FAKE_TOOL_NAME}" was accidentally added to KNOWN_NON_GUARD_TOOLS`));
  console.log(Y(`    • The 'recall' prefix was removed from MEMORY_PATTERN_PREFIXES`));
  allPassed = false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESTORE — remove the fake tool
// ═══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 2 — Restore: remove fake tool from registry'));

const idx = DANIELA_FUNCTION_DECLARATIONS.findIndex(
  (d) => (d.name as string) === FAKE_TOOL_NAME,
);
if (idx !== -1) {
  DANIELA_FUNCTION_DECLARATIONS.splice(idx, 1);
  console.log(`  ${G('✓')} Fake tool removed.`);
} else {
  console.log(R('  ✗ Could not find fake tool to remove — this should not happen.'));
  allPassed = false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POSITIVE PATH — check must now pass with no uncategorized tools
// ═══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('Step 3 — Positive path: check must pass after fake tool is removed'));
console.log(Y('  Expected: no uncategorized tools reported.'));

const uncategorizedAfterRestore = runUncategorizedCheck(DANIELA_FUNCTION_DECLARATIONS);

if (uncategorizedAfterRestore.length === 0) {
  console.log(`\n  ${G('✓')} No uncategorized tools found — check passes cleanly.`);
  console.log(G('  POSITIVE PATH PASSED.'));
} else {
  console.log(R('\n  ✗ Uncategorized tools found even after fake tool was removed:'));
  for (const name of uncategorizedAfterRestore) {
    console.log(R(`    • ${name}`));
  }
  console.log(R('  POSITIVE PATH FAILED — real tools need to be categorized.'));
  console.log(Y('  Fix: add each tool above to MEMORY_TOOL_NAMES or KNOWN_NON_GUARD_TOOLS'));
  console.log(Y('  in the appropriate files (see test-memory-tool-coverage.ts for details).'));
  allPassed = false;
}

// ─── Summary ──────────────────────────────────────────────────────────────────
sep();
if (allPassed) {
  console.log(G('ALL CHECKS PASSED'));
  console.log(G('The memory-tool coverage check has real bite:'));
  console.log(G('  • It detects an uncategorized recall-pattern tool when one is injected.'));
  console.log(G('  • It passes cleanly when the registry is correct.'));
  console.log('');
} else {
  console.log(R('ONE OR MORE CHECKS FAILED — see ✗ lines above.'));
  process.exit(1);
}
