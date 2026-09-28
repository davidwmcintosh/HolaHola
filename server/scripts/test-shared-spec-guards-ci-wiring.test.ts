// Regression coverage for task 1624: proves the two CI wiring points that
// give the shared-spec live-instruction-document mutation-guard scripts
// their teeth -- test-shared-spec-live-sync-drift-guard-mutation.ts (the
// pre-write drift guard) and test-shared-spec-live-sync-post-commit-guard-mutation.ts
// (the post-commit verification guard) -- cannot be silently dropped without
// a test noticing.
//
// Both scripts are wired into two independent places:
//   1. package.json's `test:shared-spec:guards` script -- a plain invocation
//      AND a `--self-check` invocation of each script, which is what makes
//      them run via `test:ci:guards` / GitHub Actions.
//   2. scripts/neon-branch.ts's cmdGate() -- a dedicated runCommand() step
//      for each script (with `branchEnv`), giving each script's end-to-end
//      Postgres half a real database on every migration-branch gate run.
//      See .agents/memory/ci-wiring-db-test-scripts.md ("sixth pattern") and
//      both scripts' own header comments -- their e2e half is Neon-gate-only,
//      so this runCommand() step is their only path to a real database
//      anywhere in CI.
//
// Neither wiring point had a regression test of its own before this file. A
// future edit that silently drops one of these lines (e.g. during a merge,
// or a well-intentioned cleanup of the guards script or the gate's
// runCommand sequence) would leave the corresponding mutation-guard script
// never executed again in CI, with no test failure to reveal it. Mirrors the
// established convention elsewhere in this codebase of pairing a wiring
// assertion with its own mutation self-check -- e.g.
// test-shared-spec-live-instruction-document-postgres.test.ts's "scripts/neon-branch.ts
// still wires the shared-spec live-instruction-document gate env in cmdGate"
// and test-agent-memory-round-trip-gate-isolation.test.ts's isolation check
// -- just applied here to these two mutation-guard scripts' own CI wiring
// rather than to the tests they in turn protect.
//
// This file is itself a pure static text-invariant check against
// package.json and scripts/neon-branch.ts's source, in the same style as
// those two siblings, rather than an execution of the real guards chain or
// gate -- both need either a git working-tree sandbox or an actual Neon
// branch and cannot run standalone here. No database is required.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PACKAGE_JSON_PATH = "package.json";
const GATE_SOURCE_PATH = "scripts/neon-branch.ts";

const DRIFT_GUARD_SCRIPT = "server/scripts/test-shared-spec-live-sync-drift-guard-mutation.ts";
const POST_COMMIT_GUARD_SCRIPT = "server/scripts/test-shared-spec-live-sync-post-commit-guard-mutation.ts";

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Part 1: package.json's test:shared-spec:guards script
// ---------------------------------------------------------------------------

/**
 * The real invariant: test:shared-spec:guards must invoke each mutation-guard
 * script as its own distinct `&&`-separated command, twice -- once plain,
 * once with `--self-check`. Splitting on `&&` and comparing exact trimmed
 * entries (rather than a substring search) is what makes the plain and
 * --self-check invocations distinguishable: a substring check for the plain
 * command would also match inside the --self-check command's own text, so it
 * could never actually prove the plain-only invocation survived a future
 * edit that deleted it.
 */
function assertGuardsScriptWired(guardsScript: string, label: string): void {
  const commands = guardsScript.split("&&").map((entry) => entry.trim());
  for (const script of [DRIFT_GUARD_SCRIPT, POST_COMMIT_GUARD_SCRIPT]) {
    assert.ok(
      commands.includes(`npx tsx ${script}`),
      `[${label}] test:shared-spec:guards must plainly invoke ${script} (found: ${JSON.stringify(commands)})`,
    );
    assert.ok(
      commands.includes(`npx tsx ${script} --self-check`),
      `[${label}] test:shared-spec:guards must invoke ${script} --self-check (found: ${JSON.stringify(commands)})`,
    );
  }
}

test("package.json's test:shared-spec:guards still invokes both shared-spec mutation-guard scripts, plain and --self-check", () => {
  const packageJson = JSON.parse(readFileSync(PACKAGE_JSON_PATH, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const guardsScript = packageJson.scripts?.["test:shared-spec:guards"] ?? "";
  assert.ok(guardsScript.length > 0, "package.json must define a non-empty test:shared-spec:guards script");
  assertGuardsScriptWired(guardsScript, "real package.json");
});

// Mirrors the real script (see package.json) closely enough to exercise
// assertGuardsScriptWired realistically, so the regressions below start from
// a fixture that genuinely passes before each is mutated -- proving the
// mutations, not a pre-broken fixture, are what triggers the failure.
const FIXTURE_GUARDS_SCRIPT =
  "npx tsx server/scripts/test-shared-spec-schema.ts && " +
  "npx tsx server/scripts/test-shared-spec-publication-safety.ts && " +
  "npx tsx server/scripts/test-shared-spec-portability.ts && " +
  `npx tsx ${DRIFT_GUARD_SCRIPT} && ` +
  `npx tsx ${DRIFT_GUARD_SCRIPT} --self-check && ` +
  "npx tsx server/scripts/check-live-instruction-document-drift.ts --self-check && " +
  `npx tsx ${POST_COMMIT_GUARD_SCRIPT} && ` +
  `npx tsx ${POST_COMMIT_GUARD_SCRIPT} --self-check`;

/** Removes exactly one `&&`-separated command, verifying there was exactly one to remove. */
function dropCommand(guardsScript: string, commandToRemove: string): string {
  const commands = guardsScript.split("&&").map((entry) => entry.trim());
  const withoutCommand = commands.filter((entry) => entry !== commandToRemove);
  assert.equal(
    withoutCommand.length,
    commands.length - 1,
    `expected to drop exactly one command matching ${JSON.stringify(commandToRemove)}, found ${commands.length - withoutCommand.length}`,
  );
  return withoutCommand.join(" && ");
}

test("the test:shared-spec:guards wiring check fails when an invocation is silently dropped", () => {
  // Sanity: the fixture itself must pass before mutating it, or the
  // regressions below would prove nothing.
  assert.doesNotThrow(() => assertGuardsScriptWired(FIXTURE_GUARDS_SCRIPT, "fixture"));

  const regressions: Array<[string, string, string]> = [
    ["drift-guard plain invocation dropped", dropCommand(FIXTURE_GUARDS_SCRIPT, `npx tsx ${DRIFT_GUARD_SCRIPT}`), DRIFT_GUARD_SCRIPT],
    ["drift-guard --self-check invocation dropped", dropCommand(FIXTURE_GUARDS_SCRIPT, `npx tsx ${DRIFT_GUARD_SCRIPT} --self-check`), DRIFT_GUARD_SCRIPT],
    ["post-commit-guard plain invocation dropped", dropCommand(FIXTURE_GUARDS_SCRIPT, `npx tsx ${POST_COMMIT_GUARD_SCRIPT}`), POST_COMMIT_GUARD_SCRIPT],
    ["post-commit-guard --self-check invocation dropped", dropCommand(FIXTURE_GUARDS_SCRIPT, `npx tsx ${POST_COMMIT_GUARD_SCRIPT} --self-check`), POST_COMMIT_GUARD_SCRIPT],
  ];

  for (const [label, regressedScript, expectedScriptInMessage] of regressions) {
    assert.throws(
      () => assertGuardsScriptWired(regressedScript, label),
      (error: unknown) => error instanceof Error && error.message.includes(expectedScriptInMessage),
      `test:shared-spec:guards wiring check failed to catch: ${label}`,
    );
  }
});

test("the test:shared-spec:guards wiring check does not fire on a legitimate reordering or additional guard commands", () => {
  // Guards against a vacuous or over-strict check: reordering the existing
  // commands, or a future edit that appends a brand-new unrelated guard
  // script to the chain, must never make this check fail.
  const reorderedWithExtra =
    `npx tsx ${POST_COMMIT_GUARD_SCRIPT} --self-check && ` +
    `npx tsx ${POST_COMMIT_GUARD_SCRIPT} && ` +
    "npx tsx server/scripts/test-shared-spec-portability.ts && " +
    "npx tsx server/scripts/some-future-guard.ts && " +
    `npx tsx ${DRIFT_GUARD_SCRIPT} --self-check && ` +
    `npx tsx ${DRIFT_GUARD_SCRIPT} && ` +
    "npx tsx server/scripts/test-shared-spec-schema.ts";
  assert.doesNotThrow(() => assertGuardsScriptWired(reorderedWithExtra, "reordered with extra"));
});

// ---------------------------------------------------------------------------
// Part 2: scripts/neon-branch.ts's cmdGate()
// ---------------------------------------------------------------------------

/**
 * Isolates cmdGate()'s body from the rest of scripts/neon-branch.ts. cmdGate
 * is immediately followed by `main()` in the real file, so the text between
 * the two function signatures is exactly cmdGate's body -- simpler and less
 * fragile than brace-counting through cmdGate's many template literals and
 * nested object/callback braces.
 */
function extractCmdGateBody(source: string): string {
  const startMarker = "async function cmdGate(";
  const endMarker = "\nasync function main()";
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  assert.ok(
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx,
    "could not isolate cmdGate()'s body from scripts/neon-branch.ts -- has the function been renamed or moved relative to main()?",
  );
  return source.slice(startIdx, endIdx);
}

/**
 * The real invariant: cmdGate() contains a runCommand() call whose command
 * string is exactly `npx tsx <script>`, immediately followed by `branchEnv`
 * as the second argument -- i.e. a real dedicated gate step for that script,
 * not just an incidental mention of its file path in a comment or log line.
 */
function assertGateWiresRunCommand(cmdGateBody: string, label: string): void {
  for (const script of [DRIFT_GUARD_SCRIPT, POST_COMMIT_GUARD_SCRIPT]) {
    const pattern = new RegExp(`runCommand\\(\\s*'npx tsx ${escapeForRegExp(script)}',\\s*branchEnv,`);
    assert.match(
      cmdGateBody,
      pattern,
      `[${label}] cmdGate() must contain a runCommand('npx tsx ${script}', branchEnv, ...) step`,
    );
  }
}

test("scripts/neon-branch.ts's cmdGate() still contains a runCommand() step for each shared-spec mutation-guard script", () => {
  const source = readFileSync(GATE_SOURCE_PATH, "utf8");
  const cmdGateBody = extractCmdGateBody(source);
  assertGateWiresRunCommand(cmdGateBody, "real cmdGate() body");
});

// Mirrors the shape of the real cmdGate() steps (see scripts/neon-branch.ts)
// closely enough to exercise assertGateWiresRunCommand realistically,
// without reproducing the whole function.
function fixtureCmdGateBody(includeDrift: boolean, includePostCommit: boolean): string {
  const driftStep = `
  if (!failureReason) {
    console.log('[gate] Running shared-spec live-instruction-document drift-guard mutation proof against the branch...');
    const sharedSpecDriftGuardMutation = await runCommand(
      'npx tsx ${DRIFT_GUARD_SCRIPT}',
      branchEnv,
    );
    if (sharedSpecDriftGuardMutation.code !== 0) {
      failureReason = \`shared-spec live-instruction-document drift-guard mutation proof exited \${sharedSpecDriftGuardMutation.code}\`;
    }
  }`;
  const postCommitStep = `
  if (!failureReason) {
    console.log('[gate] Running shared-spec live-instruction-document post-commit-guard mutation proof against the branch...');
    const sharedSpecPostCommitGuardMutation = await runCommand(
      'npx tsx ${POST_COMMIT_GUARD_SCRIPT}',
      branchEnv,
    );
    if (sharedSpecPostCommitGuardMutation.code !== 0) {
      failureReason = \`shared-spec live-instruction-document post-commit-guard mutation proof exited \${sharedSpecPostCommitGuardMutation.code}\`;
    }
  }`;
  return [includeDrift ? driftStep : "", includePostCommit ? postCommitStep : ""].join("\n");
}

test("the cmdGate() wiring check fails when a runCommand() step is silently dropped", () => {
  // Sanity: the fixture itself must pass before mutating it.
  assert.doesNotThrow(() => assertGateWiresRunCommand(fixtureCmdGateBody(true, true), "fixture"));

  assert.throws(
    () => assertGateWiresRunCommand(fixtureCmdGateBody(false, true), "drift step dropped"),
    (error: unknown) => error instanceof Error && error.message.includes(DRIFT_GUARD_SCRIPT),
    "cmdGate() wiring check failed to catch a dropped drift-guard runCommand() step",
  );
  assert.throws(
    () => assertGateWiresRunCommand(fixtureCmdGateBody(true, false), "post-commit step dropped"),
    (error: unknown) => error instanceof Error && error.message.includes(POST_COMMIT_GUARD_SCRIPT),
    "cmdGate() wiring check failed to catch a dropped post-commit-guard runCommand() step",
  );
});

test("the cmdGate() wiring check does not fire on a legitimate reordering of the two runCommand() steps", () => {
  // Guards against an order-sensitive check: swapping which step comes first
  // must never make this check fail.
  const reordered = fixtureCmdGateBody(false, true) + "\n" + fixtureCmdGateBody(true, false);
  assert.doesNotThrow(() => assertGateWiresRunCommand(reordered, "reordered"));
});
