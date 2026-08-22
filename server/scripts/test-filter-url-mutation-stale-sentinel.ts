/**
 * Negative-path guard for test-filter-url-mutation.ts.
 *
 * Confirms that when the buildHistoryUrl sentinel string no longer matches
 * the production source (because the function was refactored), the mutation
 * script exits non-zero with the "Could not locate" error — rather than
 * silently skipping the mutation check.
 *
 * Run with:
 *   npx tsx server/scripts/test-filter-url-mutation-stale-sentinel.ts
 */

import { spawnSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const LOGIC_FILE = resolve("client/src/lib/absence-history-panel-logic.ts");
const MUTATION_SCRIPT = "server/scripts/test-filter-url-mutation.ts";

// ── read production source ───────────────────────────────────────────────────

const original = readFileSync(LOGIC_FILE, "utf8");

// Verify the sentinel is present right now (sanity-check before we corrupt it).
if (!original.includes("export function buildHistoryUrl(")) {
  console.error(
    "✗ Pre-condition failed: could not find buildHistoryUrl in\n" +
      `  ${LOGIC_FILE}\n\n` +
      "The logic file may have been moved or renamed."
  );
  process.exit(1);
}

// ── create a stale version: rename the function so ORIGINAL_IMPL won't match ─
//
// We rename the function signature so the sentinel substring in the mutation
// script ("export function buildHistoryUrl(activeFilter: AbsenceFilterType)")
// is no longer present — exactly what would happen after an unannounced refactor.

const stale = original.replace(
  /export function buildHistoryUrl\b/g,
  "export function buildHistoryUrl_RENAMED"
);

writeFileSync(LOGIC_FILE, stale, "utf8");
console.log("[stale sentinel applied] buildHistoryUrl renamed in logic file");

// ── run the mutation script — expect it to exit non-zero ─────────────────────

let passed = false;

try {
  const result = spawnSync("npx", ["tsx", MUTATION_SCRIPT], {
    stdio: "pipe",
    encoding: "utf8",
  });

  const exitCode = result.status ?? 1;
  const output = (result.stdout ?? "") + (result.stderr ?? "");

  if (exitCode === 0) {
    console.error(
      "\n✗ FAILED: mutation script exited 0 on a stale sentinel.\n" +
        "  The 'Could not locate' guard is NOT working — a future refactor\n" +
        "  could silently bypass the filter-URL mutation check.\n" +
        `\n  Script output:\n${output}`
    );
    process.exit(1);
  }

  if (!output.includes("Could not locate")) {
    console.error(
      "\n✗ FAILED: script exited non-zero but the expected 'Could not locate'\n" +
        "  message was absent from its output.\n" +
        `\n  Actual output:\n${output}`
    );
    process.exit(1);
  }

  console.log(
    `\n✓ Stale-sentinel path confirmed: exit ${exitCode} with "Could not locate" message`
  );
  passed = true;
} finally {
  // Always restore the production source, even if the check above throws.
  writeFileSync(LOGIC_FILE, original, "utf8");
  console.log("[stale sentinel reverted] logic file restored to production code");
}

if (!passed) {
  process.exit(1);
}

console.log(
  "\n✓ Filter-URL mutation stale-sentinel guard has teeth: " +
    "a stale sentinel is caught before it can silently skip the mutation check.\n"
);
