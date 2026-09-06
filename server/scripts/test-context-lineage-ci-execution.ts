import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getVerifiedCiDatabaseUrl } from "../ci-database";

const root = resolve(import.meta.dirname, "../..");
const testPath = "server/__tests__/context-lineage-migration-guard.test.ts";
const executionMarker = "[ci] context-lineage immutability database subtest executed";
const testSource = readFileSync(resolve(root, testPath), "utf8");
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  scripts?: { test?: string };
};

function assertExecutionWiring(source: string, testChain: string): void {
  assert.match(
    source,
    /const verifiedCiDatabaseUrl = getVerifiedCiDatabaseUrl\(\);/,
    "The context-lineage database subtest must obtain the verified CI database URL",
  );
  assert.match(
    source,
    /const databaseTest = verifiedCiDatabaseUrl \? it : it\.skip;/,
    "The context-lineage database subtest must skip rather than use an unverified database",
  );
  assert.match(
    source,
    /databaseTest\("installs and enforces both immutable ledgers on the migrated CI database"/,
    "The context-lineage runtime assertion must remain registered as a database test",
  );
  assert.match(
    testChain,
    new RegExp(testPath.replaceAll("/", "\\/").replace(".", "\\.")),
    "The context-lineage migration guard must remain registered in the canonical test chain",
  );
}

const canonicalTestChain = packageJson.scripts?.test ?? "";
assertExecutionWiring(testSource, canonicalTestChain);

if (process.argv.includes("--self-check")) {
  assert.throws(
    () =>
      assertExecutionWiring(
        testSource.replace(
          "const verifiedCiDatabaseUrl = getVerifiedCiDatabaseUrl();",
          "const verifiedCiDatabaseUrl = process.env.CI_DATABASE_URL;",
        ),
        canonicalTestChain,
      ),
    /must obtain the verified CI database URL/,
  );
  assert.throws(
    () =>
      assertExecutionWiring(
        testSource.replace(
          'databaseTest("installs and enforces both immutable ledgers on the migrated CI database"',
          'it("installs and enforces both immutable ledgers on the migrated CI database"',
        ),
        canonicalTestChain,
      ),
    /must remain registered as a database test/,
  );
  assert.throws(
    () => assertExecutionWiring(testSource, canonicalTestChain.replace(testPath, "")),
    /must remain registered in the canonical test chain/,
  );
  console.log("✓ context-lineage CI execution wiring mutation self-check passed");
}

const verifiedCiDatabaseUrl = getVerifiedCiDatabaseUrl();
if (!verifiedCiDatabaseUrl) {
  console.log("SKIP — context-lineage CI execution proof requires a verified job-local PostgreSQL URL");
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "--test", testPath],
  {
    cwd: root,
    env: process.env,
    encoding: "utf8",
  },
);
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);

assert.equal(result.status, 0, "The context-lineage migration guard must pass against migrated CI PostgreSQL");
assert.match(
  output,
  new RegExp(executionMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  "The context-lineage database subtest silently skipped or stopped before proving immutability",
);

console.log("✓ context-lineage CI database execution proof passed");