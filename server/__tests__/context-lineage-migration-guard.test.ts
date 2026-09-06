/**
 * Structural guard for the immutable-ledger migration.
 *
 * The database-level behaviour is verified after the additive migration is
 * applied. This hermetic test ensures future edits cannot quietly remove the
 * UPDATE/DELETE trigger while leaving the application shadow writer intact.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, "../..");
const migration = readFileSync(
  resolve(root, "migrations/0017_context_lineage_ledger.sql"),
  "utf8",
);
const journal = JSON.parse(
  readFileSync(resolve(root, "migrations/meta/_journal.json"), "utf8"),
) as {
  entries: Array<{ idx: number; when: number; tag: string }>;
};
const ciWorkflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");

describe("context lineage migration", () => {
  it("is part of the standard Drizzle migration ledger in chronological order", () => {
    const lineageIndex = journal.entries.findIndex(
      (entry) => entry.tag === "0017_context_lineage_ledger",
    );
    assert.ok(lineageIndex > 0, "context-lineage migration must be journaled");
    assert.ok(lineageIndex < journal.entries.length - 1);
    assert.ok(journal.entries[lineageIndex - 1].when < journal.entries[lineageIndex].when);
    assert.ok(journal.entries[lineageIndex].when < journal.entries[lineageIndex + 1].when);
    assert.equal(
      journal.entries.filter((entry) => entry.tag === "0017_context_lineage_ledger").length,
      1,
      "context-lineage migration must have exactly one ledger entry",
    );
  });

  it("does not rely on the dedicated apply script in CI", () => {
    assert.doesNotMatch(
      ciWorkflow,
      /npx tsx server\/scripts\/apply-context-lineage-ledger\.ts/,
    );
  });

  it("creates dedicated events and links rather than extending operational telemetry", () => {
    assert.match(migration, /CREATE TABLE IF NOT EXISTS "context_lineage_events"/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS "context_lineage_links"/);
    assert.doesNotMatch(migration, /ALTER TABLE "voice_pipeline_events"/);
  });

  it("protects both canonical tables from UPDATE and DELETE", () => {
    const triggerStatements = migration.match(
      /CREATE TRIGGER "context_lineage_(?:events|links)_immutable"[\s\S]*?EXECUTE FUNCTION "reject_context_lineage_mutation"\(\);/g,
    ) ?? [];
    assert.equal(triggerStatements.length, 2);
    for (const statement of triggerStatements) {
      assert.match(statement, /BEFORE UPDATE OR DELETE/);
    }
    assert.match(migration, /context lineage ledger is immutable/);
  });

  it("retains the exact-payload and causal-link columns required for forensic reconstruction", () => {
    assert.match(migration, /"payload_text" text/);
    assert.match(migration, /"payload_json" jsonb/);
    assert.match(migration, /"payload_sha256" varchar\(64\)/);
    assert.match(migration, /"from_event_id" varchar NOT NULL REFERENCES "context_lineage_events"/);
    assert.match(migration, /"to_event_id" varchar NOT NULL REFERENCES "context_lineage_events"/);
  });
});