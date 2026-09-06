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
const verifiedCiDatabaseUrl = getVerifiedCiDatabaseUrl();

if (!verifiedCiDatabaseUrl) {
  console.log(
    "[context-lineage-self-check] SKIP: requires CI=true and a verified job-local CI_DATABASE_URL",
  );
  process.exit(0);
}

const fixtureRoot = mkdtempSync(join(tmpdir(), "context-lineage-migration-"));
const fixtureMigrations = join(fixtureRoot, "migrations");
const fixtureConfig = join(fixtureRoot, "drizzle.config.ts");
const databaseName = `context_lineage_mutant_${randomUUID().replaceAll("-", "")}`;
const adminUrl = new URL(verifiedCiDatabaseUrl);
adminUrl.pathname = "/postgres";
const fixtureUrl = new URL(verifiedCiDatabaseUrl);
fixtureUrl.pathname = `/${databaseName}`;
const admin = new Client({ connectionString: adminUrl.toString() });
let adminConnected = false;

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

try {
  cpSync(resolve(root, "migrations"), fixtureMigrations, { recursive: true });
  const fixtureMigrationPath = join(
    fixtureMigrations,
    "0017_context_lineage_ledger.sql",
  );
  const canonicalMigrationPath = resolve(
    root,
    "migrations/0017_context_lineage_ledger.sql",
  );
  const canonicalMigration = readFileSync(canonicalMigrationPath, "utf8");
  const missingLinksTrigger = /CREATE TRIGGER "context_lineage_links_immutable"\nBEFORE UPDATE OR DELETE ON "context_lineage_links"\nFOR EACH ROW\nEXECUTE FUNCTION "reject_context_lineage_mutation"\(\);\n?/;
  const fixtureMigration = canonicalMigration.replace(missingLinksTrigger, "");
  assert.notEqual(
    fixtureMigration,
    canonicalMigration,
    "self-check fixture must remove the links immutability trigger",
  );
  assert.doesNotMatch(fixtureMigration, /CREATE TRIGGER "context_lineage_links_immutable"/);
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

  await admin.connect();
  adminConnected = true;
  await admin.query(`CREATE DATABASE "${databaseName}"`);

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
    "database-backed guard unexpectedly passed with the links immutability trigger missing",
  );
  assert.match(
    guardResult.output,
    /context_lineage_links_immutable/,
    `guard must fail for the deliberately missing trigger:\n${guardResult.output}`,
  );
  assert.equal(
    readFileSync(canonicalMigrationPath, "utf8"),
    canonicalMigration,
    "canonical migration changed during the disposable self-check",
  );

  console.log(
    "[context-lineage-self-check] PASS: the fresh-database guard rejects a migration missing one immutability trigger",
  );
} finally {
  if (adminConnected) {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [databaseName],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  }
  if (adminConnected) {
    await admin.end().catch(() => undefined);
  }
  rmSync(fixtureRoot, { recursive: true, force: true });
}