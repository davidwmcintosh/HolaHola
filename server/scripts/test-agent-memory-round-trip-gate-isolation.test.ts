// Static self-check for scripts/neon-branch.ts's Neon migration-branch gate:
// proves the agent-memory round-trip PostgreSQL test stays isolated in its
// own solo `npx tsx --test` invocation, never re-bundled with ANY other test
// file -- not just the two known sibling agent-memory files.
//
// WHY THIS EXISTS
// ────────────────
// test-agent-memory-round-trip-postgres.test.ts snapshots the generated
// MEMORY.md, calls the *global* regenerateAll() (which re-renders from every
// topic/entry across the whole database, not just this file's own rows), and
// diffs the result byte-for-byte against the snapshot. If ANY other test file
// -- not only test-agent-memory-concurrent-write-postgres.test.ts or
// test-agent-memory-stale-version-postgres.test.ts, but literally any file
// that writes to the same database -- races in the same
// `npx tsx --test <a> <b> <c>` invocation (Node's test runner executes
// multiple files concurrently by default), that write can land inside the
// snapshot/regenerate window and false-fail the migration gate. See
// .agents/memory/agent-memory-round-trip-isolation.md for the confirmed
// failure mode. The fix was to give the round-trip file its own sequential
// gate step (scripts/neon-branch.ts, the two `if (!failureReason)` blocks
// around the agent-memory Postgres tests). Nothing stops a future edit from
// folding the round-trip file back into a multi-file invocation -- e.g.
// while "simplifying" the gate step count, or while adding some unrelated
// future test to the same command -- and silently reintroducing the flake.
// This file is that guard.
//
// The invariant checked below is deliberately an ALLOWLIST, not a denylist:
// the round-trip file's runCommand(...) must target that file and NOTHING
// else. Excluding only the two named siblings would leave a gap -- a future
// edit could bundle the round-trip file with some unrelated third test file
// and this check would stay green while the exact same race reappears.
//
// This is a pure text-invariant check against scripts/neon-branch.ts's
// source, in the same style as the sibling "still wires the ... gate env in
// cmdGate" checks in test-founder-task-ownership-postgres.test.ts and
// test-coordinator-v2-schema.test.ts, rather than an execution of the real
// gate -- the real gate provisions an actual ephemeral Neon branch and
// cannot run standalone here.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const GATE_SOURCE_PATH = "scripts/neon-branch.ts";

const ROUND_TRIP_FILE = "server/scripts/test-agent-memory-round-trip-postgres.test.ts";
const CONCURRENT_WRITE_FILE = "server/scripts/test-agent-memory-concurrent-write-postgres.test.ts";
const STALE_VERSION_FILE = "server/scripts/test-agent-memory-stale-version-postgres.test.ts";
const UNRELATED_FILE = "server/scripts/test-some-unrelated-postgres.test.ts";

/**
 * Extracts the single-quoted command-string literal passed as the first
 * argument to every `runCommand(...)` call in a neon-branch.ts-shaped gate
 * source, narrowed to the ones whose command string references the
 * round-trip test file.
 */
function findRoundTripCommandStrings(source: string): string[] {
  const callPattern = /runCommand\(\s*'([^']+)'/g;
  const matches: string[] = [];
  let call: RegExpExecArray | null;
  while ((call = callPattern.exec(source)) !== null) {
    if (call[1].includes(ROUND_TRIP_FILE)) {
      matches.push(call[1]);
    }
  }
  return matches;
}

/**
 * Extracts every whitespace-delimited `*.test.ts` path token from a
 * `npx tsx --test <fileA> <fileB> ...`-shaped command string -- i.e. the
 * actual list of file targets Node's test runner will load into one process
 * and execute concurrently.
 */
function extractTestFileTargets(command: string): string[] {
  return command.match(/\S+\.test\.ts/g) ?? [];
}

/**
 * The actual invariant under test: exactly one runCommand(...) invocation
 * references the round-trip file, and that invocation's full file-target
 * list is the round-trip file ALONE -- never the round-trip file plus any
 * other test file, known sibling or otherwise. Throws on violation so the
 * same logic can be exercised against both the real gate source (must pass)
 * and synthetic regressed sources (must fail) below -- that dual exercise is
 * what proves this check has real bite instead of being vacuously true.
 */
function assertRoundTripIsolated(source: string, label: string): void {
  const roundTripCommands = findRoundTripCommandStrings(source);
  assert.equal(
    roundTripCommands.length,
    1,
    `[${label}] expected exactly one runCommand(...) invocation referencing ${ROUND_TRIP_FILE}, found ${roundTripCommands.length}`,
  );
  const [command] = roundTripCommands;
  const targets = extractTestFileTargets(command);
  assert.deepEqual(
    targets,
    [ROUND_TRIP_FILE],
    `[${label}] the round-trip test's runCommand invocation must target exactly [${ROUND_TRIP_FILE}] and nothing else, found ${JSON.stringify(targets)} -- bundling ANY other file (not just the two known siblings) into the same "npx tsx --test" invocation re-introduces the race described in .agents/memory/agent-memory-round-trip-isolation.md`,
  );
}

test("scripts/neon-branch.ts keeps the agent-memory round-trip test in its own solo runCommand invocation", () => {
  const source = readFileSync(GATE_SOURCE_PATH, "utf8");
  assertRoundTripIsolated(source, "real gate source");
});

test("the round-trip isolation check fails when a future edit re-merges the round-trip test into any other file's command", () => {
  // Simulates the exact regression this file exists to catch: a future edit
  // folds the round-trip test back into the same `npx tsx --test` invocation
  // as one or both siblings (e.g. while "simplifying" the gate step count),
  // OR bundles it with a completely unrelated future test file. The
  // allowlist shape of assertRoundTripIsolated must catch all four cases,
  // not just the two named siblings.
  const regressions: Array<[string, string]> = [
    [
      "merged with both siblings",
      `const t = await runCommand(\n  'npx tsx --test ${CONCURRENT_WRITE_FILE} ${STALE_VERSION_FILE} ${ROUND_TRIP_FILE}',\n  branchEnv,\n);`,
    ],
    [
      "merged with concurrent-write only",
      `const t = await runCommand(\n  'npx tsx --test ${CONCURRENT_WRITE_FILE} ${ROUND_TRIP_FILE}',\n  branchEnv,\n);`,
    ],
    [
      "merged with stale-version only",
      `const t = await runCommand(\n  'npx tsx --test ${ROUND_TRIP_FILE} ${STALE_VERSION_FILE}',\n  branchEnv,\n);`,
    ],
    [
      "merged with a completely unrelated third file (not one of the two named siblings)",
      `const t = await runCommand(\n  'npx tsx --test ${UNRELATED_FILE} ${ROUND_TRIP_FILE}',\n  branchEnv,\n);`,
    ],
  ];

  for (const [label, regressedSource] of regressions) {
    assert.throws(
      () => assertRoundTripIsolated(regressedSource, label),
      (error: unknown) => error instanceof Error && /must target exactly/.test(error.message),
      `round-trip isolation check failed to catch a re-merged gate command: ${label}`,
    );
  }
});

test("the round-trip isolation check does not fire on the legitimate concurrent-write/stale-version pairing", () => {
  // Guards against a vacuous or over-broad check: bundling the two OTHER
  // agent-memory files together (without the round-trip file) is exactly
  // today's real, intentional gate step and must stay allowed.
  const legitimateSource = `
    const agentMemoryPostgresTests = await runCommand(
      'npx tsx --test ${CONCURRENT_WRITE_FILE} ${STALE_VERSION_FILE}',
      branchEnv,
    );
    const agentMemoryRoundTripTest = await runCommand(
      'npx tsx --test ${ROUND_TRIP_FILE}',
      branchEnv,
    );
  `;
  assert.doesNotThrow(() => assertRoundTripIsolated(legitimateSource, "legitimate pairing"));
});
