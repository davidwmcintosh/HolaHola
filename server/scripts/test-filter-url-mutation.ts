/**
 * Mutation guard for buildHistoryUrl in absence-history-panel-logic.ts.
 *
 * Confirms the filter-button test suite (absence-history-panel-filters.test.ts)
 * catches a regression in the fetch URL construction:
 *
 *   1. Mutate buildHistoryUrl to always return the bare URL (drops ?resolutionType=)
 *   2. Run the test suite — expect it to EXIT NON-ZERO (tests must fail)
 *   3. Revert the mutation
 *   4. Run the test suite again — expect it to EXIT ZERO (tests must pass)
 *
 * Run with:
 *   npx tsx server/scripts/test-filter-url-mutation.ts
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const LOGIC_FILE = resolve(
  "client/src/lib/absence-history-panel-logic.ts"
);

const TEST_CMD =
  "npx tsx --test client/src/components/absence-history-panel-filters.test.ts";

// ── helpers ──────────────────────────────────────────────────────────────────

function run(label: string, expectFailure: boolean): void {
  console.log(`\n▶ ${label}`);
  console.log(`  cmd : ${TEST_CMD}`);
  console.log(`  want: ${expectFailure ? "NON-ZERO exit (tests fail)" : "ZERO exit (tests pass)"}`);

  let exitCode = 0;
  try {
    execSync(TEST_CMD, { stdio: "inherit" });
  } catch (err: unknown) {
    exitCode = (err as { status?: number }).status ?? 1;
  }

  const passed = expectFailure ? exitCode !== 0 : exitCode === 0;

  if (!passed) {
    const msg = expectFailure
      ? `ERROR: expected non-zero exit after mutation but got ${exitCode} (tests did NOT catch the regression!)`
      : `ERROR: expected zero exit after revert but got ${exitCode} (tests are broken on clean code!)`;
    console.error(`\n✗ ${msg}`);
    process.exit(1);
  }

  console.log(`\n✓ ${label} — confirmed (exit ${exitCode})`);
}

// ── read original source ─────────────────────────────────────────────────────

const original = readFileSync(LOGIC_FILE, "utf8");

// ── mutation: drop the ?resolutionType= query param branch ───────────────────
//
// Replace the real implementation with one that always returns the bare URL.
// This is the exact regression we are guarding against.

const ORIGINAL_IMPL = `export function buildHistoryUrl(activeFilter: AbsenceFilterType): string {
  return activeFilter === "all"
    ? "/api/admin/absence-nudges/history"
    : \`/api/admin/absence-nudges/history?resolutionType=\${activeFilter}\`;
}`;

const MUTATED_IMPL = `export function buildHistoryUrl(activeFilter: AbsenceFilterType): string {
  // MUTATION: always return bare URL — resolutionType param intentionally dropped
  return "/api/admin/absence-nudges/history";
}`;

if (!original.includes(ORIGINAL_IMPL)) {
  console.error(
    "✗ Could not locate the expected buildHistoryUrl implementation in\n" +
      `  ${LOGIC_FILE}\n\n` +
      "The source may have changed; update ORIGINAL_IMPL in this script."
  );
  process.exit(1);
}

// ── phase 1: mutate + run (expect failure) ───────────────────────────────────

writeFileSync(LOGIC_FILE, original.replace(ORIGINAL_IMPL, MUTATED_IMPL), "utf8");
console.log("\n[mutation applied] buildHistoryUrl now always returns the bare URL");

try {
  run("Mutated code — tests MUST fail", /* expectFailure */ true);
} finally {
  // Always revert, even if the check above throws.
  writeFileSync(LOGIC_FILE, original, "utf8");
  console.log("\n[mutation reverted] buildHistoryUrl restored to production code");
}

// ── phase 2: clean code + run (expect success) ───────────────────────────────

run("Clean code — tests MUST pass", /* expectFailure */ false);

console.log("\n✓ Filter-URL mutation guard confirmed: the CI check has teeth.\n");
