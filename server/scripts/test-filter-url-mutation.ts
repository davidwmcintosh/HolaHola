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
 * The mutation NEVER touches the real, shared source file on disk. It runs
 * entirely inside a private temp-directory sandbox copy (see
 * filter-url-mutation-fixture.ts) so a concurrently-running CI batch, another
 * `npm test` invocation, or another `gate` run sharing this working tree can
 * never observe a half-mutated file. That in-place mutation of the shared
 * file was the confirmed root cause of an intermittent "fetch URL
 * construction" failure inside full CI batches (Task #1519).
 *
 * Run with:
 *   npx tsx server/scripts/test-filter-url-mutation.ts
 *
 * For the stale-sentinel negative-path guard
 * (test-filter-url-mutation-stale-sentinel.ts), this script also accepts an
 * already-prepared sandbox via env vars so both scripts share the exact same
 * sandboxing mechanics instead of duplicating them:
 *   FILTER_URL_MUTATION_LOGIC_FILE / FILTER_URL_MUTATION_TEST_FILE
 * When both are set, this script mutates/restores that given logic file in
 * place (it is already a disposable sandbox copy owned by the caller)
 * instead of creating and cleaning up its own sandbox.
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import {
  CANONICAL_LOGIC_FILE_PATH,
  createFilterUrlMutationSandbox,
} from "./filter-url-mutation-fixture";

// ── resolve which logic/test files to operate on ─────────────────────────────

const overrideLogicFile = process.env.FILTER_URL_MUTATION_LOGIC_FILE;
const overrideTestFile = process.env.FILTER_URL_MUTATION_TEST_FILE;

if (Boolean(overrideLogicFile) !== Boolean(overrideTestFile)) {
  console.error(
    "✗ FILTER_URL_MUTATION_LOGIC_FILE and FILTER_URL_MUTATION_TEST_FILE must both be set together.",
  );
  process.exit(1);
}

let LOGIC_FILE: string;
let TEST_FILE: string;
let ownedSandboxCleanup: (() => void) | null = null;

if (overrideLogicFile && overrideTestFile) {
  LOGIC_FILE = overrideLogicFile;
  TEST_FILE = overrideTestFile;
} else {
  const sandbox = createFilterUrlMutationSandbox("filter-url-mutation-");
  LOGIC_FILE = sandbox.logicFile;
  TEST_FILE = sandbox.testFile;
  ownedSandboxCleanup = sandbox.cleanup;
}

const TEST_CMD = `npx tsx --test ${TEST_FILE}`;

// ── helpers ──────────────────────────────────────────────────────────────────

// Returns whether the run matched expectations, rather than exiting the
// process directly -- process.exit() would skip the sandbox cleanup below
// (finally blocks never run once process.exit() is called mid-stack).
function run(label: string, expectFailure: boolean): boolean {
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
    return false;
  }

  console.log(`\n✓ ${label} — confirmed (exit ${exitCode})`);
  return true;
}

// ── read the sandbox copy's current source ───────────────────────────────────

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

let exitCode = 0;

if (!original.includes(ORIGINAL_IMPL)) {
  console.error(
    "✗ Could not locate the expected buildHistoryUrl implementation in\n" +
      `  ${CANONICAL_LOGIC_FILE_PATH}\n\n` +
      "The source may have changed; update ORIGINAL_IMPL in this script.",
  );
  exitCode = 1;
} else {
  // ── phase 1: mutate + run (expect failure) ─────────────────────────────────

  writeFileSync(LOGIC_FILE, original.replace(ORIGINAL_IMPL, MUTATED_IMPL), "utf8");
  console.log("\n[mutation applied] buildHistoryUrl now always returns the bare URL");

  let mutatedPassed: boolean;
  try {
    mutatedPassed = run("Mutated code — tests MUST fail", /* expectFailure */ true);
  } finally {
    // Always revert the sandbox copy, even if the check above throws. This
    // never touches the real file, so there is nothing for another process
    // to observe either way -- but we still keep the sandbox itself clean
    // between phase 1 and phase 2.
    writeFileSync(LOGIC_FILE, original, "utf8");
    console.log("\n[mutation reverted] buildHistoryUrl restored to production code");
  }

  if (!mutatedPassed) {
    exitCode = 1;
  } else {
    // ── phase 2: clean code + run (expect success) ─────────────────────────

    const cleanPassed = run("Clean code — tests MUST pass", /* expectFailure */ false);
    if (!cleanPassed) {
      exitCode = 1;
    } else {
      console.log("\n✓ Filter-URL mutation guard confirmed: the CI check has teeth.\n");
    }
  }
}

// Clean up before exiting so a failure path can never leak the sandbox dir,
// and set process.exitCode instead of calling process.exit() so this cleanup
// (and any pending stdout writes) is never skipped.
ownedSandboxCleanup?.();
process.exitCode = exitCode;
