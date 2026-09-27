/**
 * Mutation guard for the live-instruction-document drift check inside
 * GitWorkingTreeLiveSyncProvider.syncExclusive() (shared-spec-live-sync.ts).
 *
 * Before writing an approved revision to disk, syncExclusive() hashes the
 * file already on disk and refuses (`{ state: "stale" }`) unless that hash
 * is one of the document's own recorded revision hashes
 * (`target.knownRevisionContentHashes`). Four regression tests exist to
 * protect this -- two in-process unit tests in shared-spec-live-sync.test.ts,
 * and two full-stack Postgres end-to-end tests in
 * test-shared-spec-live-instruction-document-postgres.test.ts -- but nothing
 * proved any of them would actually catch the guard silently rotting (e.g. a
 * future edit that turns the comparison into a no-op, or one that always
 * hands the guard an empty hash list).
 *
 * This script proves it, against TWO independent ways the guard could
 * silently break. They matter separately because each is invisible to one
 * of the two unit tests:
 *
 *   Scenario A -- the comparison becomes a no-op (e.g. an `if` accidentally
 *   hard-coded to false, or a future refactor that drops the check
 *   entirely). The guard NEVER refuses, so an ordinary out-of-band edit gets
 *   silently discarded. Caught by:
 *     - unit: "refuses to overwrite a path whose committed content is not a
 *       revision shared-spec has ever recorded for this document"
 *     - both end-to-end tests in
 *       test-shared-spec-live-instruction-document-postgres.test.ts
 *   NOT caught by the "allow" unit test below -- that test only proves a
 *   legitimate sync isn't wrongly blocked, so it stays green even when the
 *   block never fires at all.
 *
 *   Scenario B -- `knownRevisionContentHashes` is always treated as empty
 *   (e.g. a future edit that hardcodes `[]`, or drops the field somewhere on
 *   its way through an intermediate layer). The guard ALWAYS refuses once
 *   any content already exists on disk, even when that content is one of
 *   the document's own recorded revisions. Caught by:
 *     - unit: "allows syncing when the on-disk content matches an older
 *       revision this document already has on record"
 *   NOT caught by the "refuse" unit test or either end-to-end test -- all
 *   three already expect staleness for reasons unrelated to this mutation
 *   (their on-disk content genuinely isn't a recorded revision), so an
 *   always-stale guard still produces the right answer for the wrong
 *   reason. Only a genuinely-known-revision case can expose it.
 *
 * Mechanics
 * ---------
 * Every mutation is applied to a private shadow-tree sandbox copy of
 * shared-spec-live-sync.ts (see source-mutation-sandbox.ts) -- the real,
 * shared file is never written to, so a concurrently-running CI batch or
 * another manual test invocation sharing this working tree can never
 * observe a half-mutated copy (see
 * .agents/memory/mutation-guard-sandbox-isolation.md for the confirmed past
 * incident this pattern exists to prevent).
 *
 * The in-process unit-test half (shared-spec-live-sync.test.ts) needs no
 * database and always runs. The Postgres end-to-end half
 * (test-shared-spec-live-instruction-document-postgres.test.ts) only runs
 * when a disposable database is configured exactly like the underlying
 * tests themselves require (SHARED_SPEC_TEST_DATABASE_URL +
 * SHARED_SPEC_TEST_DATABASE_DISPOSABLE=1); it skips gracefully without one,
 * and hard-fails instead of silently skipping under the Neon migration gate
 * (SHARED_SPEC_REQUIRE_DATABASE_TESTS=1), where it is also wired into
 * scripts/neon-branch.ts's cmdGate() for real Postgres coverage.
 *
 * Usage:
 *   npx tsx server/scripts/test-shared-spec-live-sync-drift-guard-mutation.ts
 *   npx tsx server/scripts/test-shared-spec-live-sync-drift-guard-mutation.ts --self-check
 *
 * --self-check proves the sentinel text-match this script depends on to
 * locate the guard would itself fail loudly -- not silently no-op -- if a
 * future refactor ever moved the guard condition to different source text.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createShadowTreeSandbox } from "./source-mutation-sandbox";

const LIVE_SYNC_RELATIVE = "server/services/shared-spec-live-sync.ts";
const UNIT_TEST_RELATIVE = "server/services/shared-spec-live-sync.test.ts";
const E2E_TEST_RELATIVE = "server/scripts/test-shared-spec-live-instruction-document-postgres.test.ts";

/**
 * The exact guard condition in syncExclusive(). Must appear exactly once.
 *
 * Task 1617 extracted the inline `target.knownRevisionContentHashes.includes(hashSharedSpecMarkdown(existing))`
 * comparison into a shared `matchesKnownRevision()` helper (also reused by
 * the proactive live-instruction-document-drift-guard.ts), so the call site
 * now reads `matchesKnownRevision(existing, target.knownRevisionContentHashes)`
 * instead of the inline expression. Update this sentinel again if the call
 * site's exact text ever moves.
 */
const GUARD_CONDITION = "existing !== undefined && !matchesKnownRevision(existing, target.knownRevisionContentHashes)";

/** Scenario B: simulates knownRevisionContentHashes being dropped/hardcoded empty on its way to the comparison. */
const MUTATION_B_REPLACEMENT = "existing !== undefined && !matchesKnownRevision(existing, [])";

const SELF_CHECK = process.argv.includes("--self-check");

function log(msg: string): void {
  console.log(`[shared-spec-live-sync-drift-guard-mutation] ${msg}`);
}

/**
 * Locates GUARD_CONDITION inside `source` and returns the mutated text, or
 * `null` if the expected text is missing -- a stale sentinel, meaning the
 * guard's own source has moved on and this script needs updating before it
 * can prove anything.
 */
function applyMutation(source: string, replacement: string): string | null {
  if (!source.includes(GUARD_CONDITION)) return null;
  return source.replace(GUARD_CONDITION, replacement);
}

interface Scenario {
  readonly key: string;
  readonly description: string;
  readonly replacement: string;
  readonly unitTestNamePattern: string;
  /** undefined when this scenario has no end-to-end-visible failure mode (see header). */
  readonly e2eTestNamePattern?: string;
}

const SCENARIO_A: Scenario = {
  key: "A",
  description: "content-hash comparison neutralized to a no-op (guard never refuses)",
  replacement: "false",
  unitTestNamePattern: "is not a revision shared-spec has ever recorded",
  e2eTestNamePattern:
    "reports staleness instead of silently discarding ordinary git commits|resync refuses to overwrite ordinary git commits",
};

const SCENARIO_B: Scenario = {
  key: "B",
  description: "knownRevisionContentHashes always treated as empty (guard always refuses)",
  replacement: MUTATION_B_REPLACEMENT,
  unitTestNamePattern: "matches an older revision this document already has on record",
  // Deliberately no e2eTestNamePattern -- see header comment for why neither
  // end-to-end test can expose this failure mode.
};

/**
 * Runs `npx tsx --test --test-name-pattern <pattern> <file>` and reports
 * whether the exit code matched `expectFailure`. Never throws; a mismatch is
 * reported and returned as `false` so callers can accumulate multiple
 * checks before deciding the overall exit code.
 */
function runTestCommand(testFile: string, namePattern: string, expectFailure: boolean): boolean {
  const label = expectFailure ? "expect FAIL" : "expect PASS";
  log(`  running (${label}): npx tsx --test --test-name-pattern "${namePattern}" ${testFile}`);
  let exitCode = 0;
  let output = "";
  try {
    output = execFileSync("npx", ["tsx", "--test", "--test-name-pattern", namePattern, testFile], {
      stdio: "pipe",
      encoding: "utf8",
      env: process.env,
    });
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    exitCode = e.status ?? 1;
    output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
  }

  const matched = expectFailure ? exitCode !== 0 : exitCode === 0;
  if (matched) {
    log(`  \u2713 ${label} -- confirmed (exit ${exitCode})`);
  } else {
    console.error(
      `  \u2717 ${
        expectFailure
          ? `expected a non-zero exit (the test should have failed) but got ${exitCode}`
          : `expected exit 0 but got ${exitCode}`
      }\n${output}`,
    );
  }
  return matched;
}

function disposableDatabaseUrl(): string | undefined {
  const url = process.env.SHARED_SPEC_TEST_DATABASE_URL;
  if (!url) {
    if (process.env.SHARED_SPEC_REQUIRE_DATABASE_TESTS === "1") {
      throw new Error(
        "SHARED_SPEC_TEST_DATABASE_URL is required by the migration gate -- the end-to-end drift-guard mutation proof must not silently skip here.",
      );
    }
    return undefined;
  }
  if (process.env.SHARED_SPEC_TEST_DATABASE_DISPOSABLE !== "1") {
    throw new Error("SHARED_SPEC_TEST_DATABASE_DISPOSABLE=1 is required alongside SHARED_SPEC_TEST_DATABASE_URL");
  }
  return url;
}

/**
 * Mutated sandbox (expect the target test(s) to fail) followed by a fresh,
 * unmutated sandbox running the exact same command (expect it to pass) --
 * the second half rules out a test-name-pattern typo that silently matches
 * zero tests, or a test that is broken independently of this guard.
 */
function proveScenario(scenario: Scenario, targets: string[], testFileRelative: string, namePattern: string): boolean {
  const mutatedSandbox = createShadowTreeSandbox(targets);
  let mutatedOk: boolean;
  try {
    const original = readFileSync(mutatedSandbox.files[LIVE_SYNC_RELATIVE], "utf8");
    const mutated = applyMutation(original, scenario.replacement);
    if (mutated === null) {
      console.error(
        `\u2717 STALE SENTINEL: could not locate the expected guard condition in ${LIVE_SYNC_RELATIVE}.\n` +
          `  Looking for: ${GUARD_CONDITION}\n` +
          `  The guard's source may have been refactored -- update GUARD_CONDITION in this script.`,
      );
      return false;
    }
    writeFileSync(mutatedSandbox.files[LIVE_SYNC_RELATIVE], mutated, "utf8");
    mutatedOk = runTestCommand(mutatedSandbox.files[testFileRelative], namePattern, /* expectFailure */ true);
  } finally {
    mutatedSandbox.cleanup();
  }
  if (!mutatedOk) return false;

  const cleanSandbox = createShadowTreeSandbox(targets);
  try {
    return runTestCommand(cleanSandbox.files[testFileRelative], namePattern, /* expectFailure */ false);
  } finally {
    cleanSandbox.cleanup();
  }
}

function runUnitScenario(scenario: Scenario): boolean {
  console.log(`\n=== Scenario ${scenario.key}: ${scenario.description} (unit test) ===`);
  return proveScenario(scenario, [LIVE_SYNC_RELATIVE, UNIT_TEST_RELATIVE], UNIT_TEST_RELATIVE, scenario.unitTestNamePattern);
}

function runE2eScenario(scenario: Scenario): boolean {
  if (!scenario.e2eTestNamePattern) return true;

  const url = disposableDatabaseUrl();
  if (!url) {
    console.log(
      `\n=== Scenario ${scenario.key}: end-to-end Postgres proof SKIPPED ` +
        `(set SHARED_SPEC_TEST_DATABASE_URL + SHARED_SPEC_TEST_DATABASE_DISPOSABLE=1 to run it locally; ` +
        `scripts/neon-branch.ts's cmdGate() already does this on every migration-branch gate run) ===`,
    );
    return true;
  }

  console.log(`\n=== Scenario ${scenario.key}: ${scenario.description} (end-to-end Postgres) ===`);
  return proveScenario(scenario, [LIVE_SYNC_RELATIVE, E2E_TEST_RELATIVE], E2E_TEST_RELATIVE, scenario.e2eTestNamePattern);
}

function assertOk(condition: boolean, label: string): boolean {
  if (condition) {
    log(`  \u2713 ${label}`);
  } else {
    console.error(`  \u2717 ${label}`);
  }
  return condition;
}

/**
 * Proves the sentinel-detection logic itself has teeth: applying a mutation
 * to source that no longer contains GUARD_CONDITION must report `null`
 * (never silently produce an unchanged "mutated" copy), and applying a
 * mutation to the real, current source must actually change it.
 */
function runSelfCheck(): boolean {
  console.log("\n=== --self-check: proving the sentinel detection itself has teeth ===");
  const real = readFileSync(LIVE_SYNC_RELATIVE, "utf8");
  let ok = true;

  if (!real.includes(GUARD_CONDITION)) {
    console.error(
      `\u2717 Precondition failed: ${LIVE_SYNC_RELATIVE} no longer contains the expected guard condition at all -- ` +
        "every scenario in this script would already report a stale sentinel; fix GUARD_CONDITION before trusting anything else here.",
    );
    return false;
  }
  ok = assertOk(true, "precondition: real source currently contains the expected guard condition") && ok;

  // A version of the source where the guard has already been refactored to
  // different text -- exactly what a future rename/refactor would look
  // like. Both scenarios must refuse to apply against it.
  const staleSource = real.replace(
    GUARD_CONDITION,
    "existing !== undefined && !matchesKnownRevisionRENAMED(existing, target.knownRevisionContentHashes)",
  );
  ok = assertOk(staleSource !== real, "constructed a stale-sentinel fixture by renaming the guard condition") && ok;
  ok =
    assertOk(
      applyMutation(staleSource, SCENARIO_A.replacement) === null,
      "Scenario A mutation on a stale/renamed source reports the sentinel as missing instead of silently applying",
    ) && ok;
  ok =
    assertOk(
      applyMutation(staleSource, SCENARIO_B.replacement) === null,
      "Scenario B mutation on a stale/renamed source reports the sentinel as missing instead of silently applying",
    ) && ok;

  // Applying the mutation to the real, current source must actually change
  // it -- ruling out a replacement string that happens to equal the
  // original, which would let every "expect FAIL" run above pass on
  // unmutated code for the wrong reason.
  const mutatedA = applyMutation(real, SCENARIO_A.replacement);
  ok =
    assertOk(
      mutatedA !== null && mutatedA !== real && mutatedA.includes("if (false) {"),
      "Scenario A mutation actually changes the real source's guard condition to `false`",
    ) && ok;

  const mutatedB = applyMutation(real, SCENARIO_B.replacement);
  ok =
    assertOk(
      mutatedB !== null && mutatedB !== real && mutatedB.includes("matchesKnownRevision(existing, [])"),
      "Scenario B mutation actually changes the real source's comparison to an always-empty array",
    ) && ok;

  return ok;
}

function main(): void {
  if (SELF_CHECK) {
    const ok = runSelfCheck();
    if (ok) {
      console.log(
        "\n\u2713 Sentinel self-check passed: a stale guard-condition sentinel is caught, and the real source mutates as expected.\n",
      );
    } else {
      console.error("\n\u2717 FAILED: the sentinel-detection logic does not have teeth -- see above.\n");
    }
    process.exitCode = ok ? 0 : 1;
    return;
  }

  let allOk = true;
  for (const scenario of [SCENARIO_A, SCENARIO_B]) {
    if (!runUnitScenario(scenario)) allOk = false;
    if (!runE2eScenario(scenario)) allOk = false;
  }

  if (allOk) {
    console.log(
      "\n\u2713 Live-instruction-document drift guard mutation proof confirmed: the regression tests have teeth.\n",
    );
  } else {
    console.error(
      "\n\u2717 FAILED: at least one drift-guard regression test would NOT catch a silently broken content-hash check. See above.\n",
    );
  }
  process.exitCode = allOk ? 0 : 1;
}

main();
