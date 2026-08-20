import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { splitSqlStatements } from "../scripts/apply-context-lineage-ledger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "../..");
const source = readFileSync(
  resolve(root, "server/scripts/apply-context-lineage-ledger.ts"),
  "utf8",
);

describe("context lineage schema apply script", () => {
  it("uses the HTTP monitoring database and verifies both tables and triggers", () => {
    assert.match(source, /getMonitoringDb/);
    assert.match(source, /table_count/);
    assert.match(source, /trigger_count/);
    assert.match(source, /context_lineage_events_immutable/);
    assert.match(source, /context_lineage_links_immutable/);
  });

  it("keeps function-body semicolons intact while splitting migration statements", () => {
    assert.match(source, /inDollarQuote/);
    assert.match(source, /char === ";" && !inSingleQuote && !inDoubleQuote && !inDollarQuote/);
  });

  it("does not let an apostrophe in a SQL comment collapse the migration into one command", () => {
    const migration = readFileSync(
      resolve(root, "migrations/0017_context_lineage_ledger.sql"),
      "utf8",
    );
    const statements = splitSqlStatements(migration);
    assert.ok(statements.length > 10, "migration must be sent as individually prepared statements");
    assert.ok(
      statements.some((statement) => statement.includes('CREATE OR REPLACE FUNCTION "reject_context_lineage_mutation"')),
      "the PL/pgSQL function must remain one statement despite internal semicolons",
    );
  });

  it("only applies when the exact script filename is executed, never when a test imports it", () => {
    assert.match(
      source,
      /basename\(process\.argv\[1\] \?\? ""\) === "apply-context-lineage-ledger\.ts"/,
    );
    assert.doesNotMatch(source, /process\.argv\[1\]\?\.includes\("apply-context-lineage-ledger"\)/);
  });
});