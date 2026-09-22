/**
 * Negative-path guard for test-filter-url-mutation.ts.
 *
 * Confirms that when the buildHistoryUrl sentinel string no longer matches
 * the production source (because the function was refactored), the mutation
 * script exits non-zero with the "Could not locate" error — rather than
 * silently skipping the mutation check.
 *
 * Like test-filter-url-mutation.ts, this NEVER mutates the real, shared
 * `client/src/lib/absence-history-panel-logic.ts` file on disk — it stages
 * the "stale" (renamed-function) content inside its own private sandbox copy
 * and points test-filter-url-mutation.ts at that sandbox via env vars, so a
 * concurrently-running CI batch or another test run sharing this working
 * tree can never observe the renamed function (see filter-url-mutation-fixture.ts
 * for why that in-place mutation was unsafe — Task #1519).
 *
 * Run with:
 *   npx tsx server/scripts/test-filter-url-mutation-stale-sentinel.ts
 */

import { spawnSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import {
  CANONICAL_LOGIC_FILE_PATH,
  createFilterUrlMutationSandbox,
} from "./filter-url-mutation-fixture";

const MUTATION_SCRIPT = "server/scripts/test-filter-url-mutation.ts";

// ── stage a private sandbox copy — the real files are never touched ──────────

const sandbox = createFilterUrlMutationSandbox("filter-url-mutation-stale-sentinel-");

let passed = false;

try {
  const original = readFileSync(sandbox.logicFile, "utf8");

  // Sanity-check before we corrupt the sandbox copy.
  if (!original.includes("export function buildHistoryUrl(")) {
    console.error(
      "✗ Pre-condition failed: could not find buildHistoryUrl in\n" +
        `  ${CANONICAL_LOGIC_FILE_PATH}\n\n` +
        "The logic file may have been moved or renamed.",
    );
    process.exitCode = 1;
  } else {
    // ── create a stale version: rename the function so ORIGINAL_IMPL won't match ─
    //
    // We rename the function signature so the sentinel substring in the
    // mutation script ("export function buildHistoryUrl(activeFilter: AbsenceFilterType)")
    // is no longer present — exactly what would happen after an unannounced refactor.

    const stale = original.replace(
      /export function buildHistoryUrl\b/g,
      "export function buildHistoryUrl_RENAMED",
    );

    writeFileSync(sandbox.logicFile, stale, "utf8");
    console.log("[stale sentinel applied] buildHistoryUrl renamed in sandbox logic file");

    // ── run the mutation script against the stale sandbox — expect non-zero ────

    const result = spawnSync("npx", ["tsx", MUTATION_SCRIPT], {
      stdio: "pipe",
      encoding: "utf8",
      env: {
        ...process.env,
        FILTER_URL_MUTATION_LOGIC_FILE: sandbox.logicFile,
        FILTER_URL_MUTATION_TEST_FILE: sandbox.testFile,
      },
    });

    const exitCode = result.status ?? 1;
    const output = (result.stdout ?? "") + (result.stderr ?? "");

    if (exitCode === 0) {
      console.error(
        "\n✗ FAILED: mutation script exited 0 on a stale sentinel.\n" +
          "  The 'Could not locate' guard is NOT working — a future refactor\n" +
          "  could silently bypass the filter-URL mutation check.\n" +
          `\n  Script output:\n${output}`,
      );
      process.exitCode = 1;
    } else if (!output.includes("Could not locate")) {
      console.error(
        "\n✗ FAILED: script exited non-zero but the expected 'Could not locate'\n" +
          "  message was absent from its output.\n" +
          `\n  Actual output:\n${output}`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `\n✓ Stale-sentinel path confirmed: exit ${exitCode} with "Could not locate" message`,
      );
      passed = true;
    }
  }
} finally {
  // The sandbox is a private disposable copy — nothing to restore on the real
  // file, just remove the temp directory.
  sandbox.cleanup();
  console.log("[stale sentinel sandbox cleaned up]");
}

if (passed) {
  console.log(
    "\n✓ Filter-URL mutation stale-sentinel guard has teeth: " +
      "a stale sentinel is caught before it can silently skip the mutation check.\n",
  );
} else if (!process.exitCode) {
  process.exitCode = 1;
}
