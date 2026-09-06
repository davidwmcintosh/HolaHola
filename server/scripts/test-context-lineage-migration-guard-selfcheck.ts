import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { Client } from "pg";
import { getVerifiedCiDatabaseUrl } from "../ci-database";

const root = resolve(import.meta.dirname, "../..");
const selfCheckPath = resolve(
  root,
  "server/scripts/test-context-lineage-migration-guard-selfcheck.ts",
);
const verifiedCiDatabaseUrl = getVerifiedCiDatabaseUrl();

if (!verifiedCiDatabaseUrl) {
  console.log(
    "[context-lineage-self-check] SKIP: requires CI=true and a verified job-local CI_DATABASE_URL",
  );
  process.exit(0);
}

const adminUrl = new URL(verifiedCiDatabaseUrl);
adminUrl.pathname = "/postgres";
const admin = new Client({ connectionString: adminUrl.toString() });
let adminConnected = false;
const canonicalMigrationPath = resolve(
  root,
  "migrations/0017_context_lineage_ledger.sql",
);
const canonicalMigration = readFileSync(canonicalMigrationPath, "utf8");
const triggerTargets = ["events", "links"] as const;
const injectedFailureDatabaseName =
  process.env.CONTEXT_LINEAGE_INJECT_FAILURE_DATABASE;
const injectedFailureTarget = process.env
  .CONTEXT_LINEAGE_INJECT_FAILURE_TARGET as
  (typeof triggerTargets)[number] | undefined;
const cleanupMutationRun =
  process.env.CONTEXT_LINEAGE_CLEANUP_MUTATION_RUN === "true";
const crashProofDatabaseName = process.env.CONTEXT_LINEAGE_CRASH_PROOF_DATABASE;

function run(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ code: number | null; output: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("error", rejectRun);
    child.on("close", (code) => resolveRun({ code, output }));
  });
}

async function proveMissingTriggerFails(
  target: (typeof triggerTargets)[number],
): Promise<void> {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "context-lineage-migration-"));
  const fixtureMigrations = join(fixtureRoot, "migrations");
  const fixtureConfig = join(fixtureRoot, "drizzle.config.ts");
  const databaseName =
    injectedFailureDatabaseName ??
    `context_lineage_${target}_mutant_${randomUUID().replaceAll("-", "")}`;
  const fixtureUrl = new URL(verifiedCiDatabaseUrl!);
  fixtureUrl.pathname = `/${databaseName}`;
  let databaseCreated = false;

  try {
    cpSync(resolve(root, "migrations"), fixtureMigrations, { recursive: true });
    const fixtureMigrationPath = join(
      fixtureMigrations,
      "0017_context_lineage_ledger.sql",
    );
    const triggerName = `context_lineage_${target}_immutable`;
    const missingTrigger = new RegExp(
      `CREATE TRIGGER "${triggerName}"\\n` +
        `BEFORE UPDATE OR DELETE ON "context_lineage_${target}"\\n` +
        'FOR EACH ROW\\nEXECUTE FUNCTION "reject_context_lineage_mutation"\\(\\);\\n?',
    );
    const fixtureMigration = canonicalMigration.replace(missingTrigger, "");
    assert.notEqual(
      fixtureMigration,
      canonicalMigration,
      `self-check fixture must remove the ${target} immutability trigger`,
    );
    assert.doesNotMatch(
      fixtureMigration,
      new RegExp(`CREATE TRIGGER "${triggerName}"`),
    );
    assert.equal(
      readFileSync(canonicalMigrationPath, "utf8"),
      canonicalMigration,
      "self-check must never alter the canonical migration",
    );
    writeFileSync(fixtureMigrationPath, fixtureMigration);
    writeFileSync(
      fixtureConfig,
      `export default {
  out: ${JSON.stringify(fixtureMigrations)},
  schema: ${JSON.stringify(resolve(root, "shared/schema.ts"))},
  dialect: "postgresql",
  dbCredentials: { url: process.env.NEON_SHARED_DATABASE_URL },
};
`,
    );

    await admin.query(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    if (injectedFailureDatabaseName) {
      throw new Error("controlled post-create failure");
    }

    const fixtureEnv = {
      ...process.env,
      CI: "true",
      CI_DATABASE_URL: fixtureUrl.toString(),
      NEON_SHARED_DATABASE_URL: fixtureUrl.toString(),
    };
    const migrationResult = await run(
      resolve(root, "node_modules/.bin/drizzle-kit"),
      ["migrate", "--config", fixtureConfig],
      fixtureEnv,
    );
    assert.equal(
      migrationResult.code,
      0,
      `mutated disposable migration must install successfully:\n${migrationResult.output}`,
    );

    const guardResult = await run(
      resolve(root, "node_modules/.bin/tsx"),
      ["--test", "server/__tests__/context-lineage-migration-guard.test.ts"],
      fixtureEnv,
    );
    assert.notEqual(
      guardResult.code,
      0,
      `database-backed guard unexpectedly passed with the ${target} immutability trigger missing`,
    );
    assert.match(
      guardResult.output,
      new RegExp(triggerName),
      `guard must fail for the deliberately missing ${target} trigger:\n${guardResult.output}`,
    );
    assert.equal(
      readFileSync(canonicalMigrationPath, "utf8"),
      canonicalMigration,
      "canonical migration changed during the disposable self-check",
    );
  } finally {
    if (databaseCreated) {
      await admin.query(
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [databaseName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    }
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

async function proveCleanupAfterInjectedFailure(): Promise<void> {
  const crashDatabaseName =
    crashProofDatabaseName ??
    `context_lineage_cleanup_${randomUUID().replaceAll("-", "")}`;
  const crashResult = await run(
    resolve(root, "node_modules/.bin/tsx"),
    [selfCheckPath],
    {
      ...process.env,
      CONTEXT_LINEAGE_INJECT_FAILURE_DATABASE: crashDatabaseName,
      CONTEXT_LINEAGE_INJECT_FAILURE_TARGET: "events",
    },
  );
  assert.notEqual(
    crashResult.code,
    0,
    "controlled post-create failure must fail the child check",
  );
  assert.match(
    crashResult.output,
    /controlled post-create failure/,
    `child check must fail at the injected post-create point:\n${crashResult.output}`,
  );

  const cleanupResult = await admin.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [crashDatabaseName],
  );
  assert.equal(
    cleanupResult.rows[0]?.exists,
    false,
    `disposable database ${crashDatabaseName} survived the controlled failure`,
  );
}

async function proveCleanupPostconditionCatchesMissingDrop(): Promise<void> {
  const originalSource = readFileSync(selfCheckPath);
  const originalText = originalSource.toString("utf8");
  const dropNeedle =
    '      await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);';
  const dropMutation =
    "      // Mutation proof: deliberately leave the crash database behind.";
  const cleanupFunctionStart = originalText.indexOf(
    "async function proveMissingTriggerFails(",
  );
  const cleanupFunctionEnd = originalText.indexOf(
    "async function proveCleanupAfterInjectedFailure(",
  );
  assert.ok(
    cleanupFunctionStart >= 0 && cleanupFunctionEnd > cleanupFunctionStart,
    "cleanup mutation must locate the crash-path function boundary",
  );
  const cleanupFunction = originalText.slice(
    cleanupFunctionStart,
    cleanupFunctionEnd,
  );
  const occurrences = cleanupFunction.split(dropNeedle).length - 1;
  assert.equal(
    occurrences,
    1,
    "cleanup mutation must match exactly one crash-path DROP DATABASE statement",
  );

  const mutantText =
    originalText.slice(0, cleanupFunctionStart) +
    cleanupFunction.replace(dropNeedle, dropMutation) +
    originalText.slice(cleanupFunctionEnd);
  const mutantDatabaseName = `context_lineage_cleanup_mutant_${randomUUID().replaceAll("-", "")}`;
  let mutantDatabaseExists = false;

  try {
    writeFileSync(selfCheckPath, mutantText);
    const mutantResult = await run(
      resolve(root, "node_modules/.bin/tsx"),
      [selfCheckPath],
      {
        ...process.env,
        CONTEXT_LINEAGE_CLEANUP_MUTATION_RUN: "true",
        CONTEXT_LINEAGE_CRASH_PROOF_DATABASE: mutantDatabaseName,
      },
    );
    assert.notEqual(
      mutantResult.code,
      0,
      "self-check unexpectedly passed after DROP DATABASE cleanup was disabled",
    );
    assert.match(
      mutantResult.output,
      new RegExp(
        `disposable database ${mutantDatabaseName} survived the controlled failure`,
      ),
      `self-check must fail specifically because the crash database survived:\n${mutantResult.output}`,
    );

    const existenceResult = await admin.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [mutantDatabaseName],
    );
    mutantDatabaseExists = existenceResult.rows[0]?.exists === true;
    assert.equal(
      mutantDatabaseExists,
      true,
      "mutation proof failure must correspond to a real leftover job-local database",
    );
  } finally {
    writeFileSync(selfCheckPath, originalSource);
    assert.deepEqual(
      readFileSync(selfCheckPath),
      originalSource,
      "self-check source was not restored byte-for-byte after cleanup mutation",
    );
    const cleanupExistenceResult = await admin.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [mutantDatabaseName],
    );
    mutantDatabaseExists = cleanupExistenceResult.rows[0]?.exists === true;
    if (mutantDatabaseExists) {
      await admin.query(
        `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
         WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [mutantDatabaseName],
      );
      await admin.query(`DROP DATABASE IF EXISTS "${mutantDatabaseName}"`);
    }
  }
}

try {
  await admin.connect();
  adminConnected = true;
  if (!injectedFailureDatabaseName) {
    await proveCleanupAfterInjectedFailure();
    if (!cleanupMutationRun) {
      await proveCleanupPostconditionCatchesMissingDrop();
    }
  }
  const targetsToCheck = injectedFailureTarget
    ? [injectedFailureTarget]
    : triggerTargets;
  for (const target of targetsToCheck) {
    await proveMissingTriggerFails(target);
  }

  if (!injectedFailureDatabaseName) {
    console.log(
      "[context-lineage-self-check] PASS: crash cleanup removes its disposable database, its postcondition rejects disabled removal, and the fresh-database guard independently rejects either missing immutability trigger",
    );
  }
} finally {
  if (adminConnected) {
    await admin.end().catch(() => undefined);
  }
}
