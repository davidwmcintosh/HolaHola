/**
 * Structural guard for the immutable-ledger migration.
 *
 * The database-level behaviour is verified after the additive migration is
 * applied. This hermetic test ensures future edits cannot quietly remove the
 * UPDATE/DELETE trigger while leaving the application shadow writer intact.
 */
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { getVerifiedCiDatabaseUrl } from "../ci-database";

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
const verifiedCiDatabaseUrl = getVerifiedCiDatabaseUrl();
const databaseTest = verifiedCiDatabaseUrl ? it : it.skip;
export const CONTEXT_LINEAGE_DATABASE_EXECUTION_MARKER =
  "[ci] context-lineage immutability database subtest executed";

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
    assert.match(
      ciWorkflow,
      /npx tsx server\/scripts\/test-context-lineage-ci-execution\.ts/,
      "CI must prove the database subtest executed after applying standard migrations",
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

  databaseTest("installs and enforces both immutable ledgers on the migrated CI database", async () => {
    assert.ok(verifiedCiDatabaseUrl, "database test requires a verified job-local PostgreSQL URL");
    const client = new Client({ connectionString: verifiedCiDatabaseUrl });
    await client.connect();

    try {
      const tables = await client.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('context_lineage_events', 'context_lineage_links')
        ORDER BY table_name
      `);
      assert.deepEqual(
        tables.rows.map(({ table_name }) => table_name),
        ["context_lineage_events", "context_lineage_links"],
      );

      const triggers = await client.query<{ trigger_name: string }>(`
        SELECT trigger.tgname AS trigger_name
        FROM pg_catalog.pg_trigger AS trigger
        JOIN pg_catalog.pg_class AS target ON target.oid = trigger.tgrelid
        JOIN pg_catalog.pg_namespace AS schema ON schema.oid = target.relnamespace
        WHERE schema.nspname = 'public'
          AND NOT trigger.tgisinternal
          AND trigger.tgname IN (
            'context_lineage_events_immutable',
            'context_lineage_links_immutable'
          )
        ORDER BY trigger.tgname
      `);
      assert.deepEqual(
        triggers.rows.map(({ trigger_name }) => trigger_name),
        ["context_lineage_events_immutable", "context_lineage_links_immutable"],
      );

      const runId = randomUUID();
      const firstEventId = randomUUID();
      const secondEventId = randomUUID();
      const linkId = randomUUID();
      await client.query(
        `INSERT INTO context_lineage_events
          (id, trace_id, session_id, sequence_number, source_route, event_type, observed_at)
         VALUES ($1, $2, $3, 1, 'ci-migration-guard', 'fixture-start', NOW()),
                ($4, $2, $3, 2, 'ci-migration-guard', 'fixture-end', NOW())`,
        [firstEventId, `ci-trace:${runId}`, `ci-session:${runId}`, secondEventId],
      );
      await client.query(
        `INSERT INTO context_lineage_links
          (id, trace_id, session_id, from_event_id, to_event_id, link_type, observed_at)
         VALUES ($1, $2, $3, $4, $5, 'caused', NOW())`,
        [linkId, `ci-trace:${runId}`, `ci-session:${runId}`, firstEventId, secondEventId],
      );

      await assert.rejects(
        client.query(
          "UPDATE context_lineage_events SET event_type = 'tampered' WHERE id = $1",
          [firstEventId],
        ),
        /context lineage ledger is immutable: UPDATE is not permitted on context_lineage_events/,
      );
      await assert.rejects(
        client.query("DELETE FROM context_lineage_events WHERE id = $1", [firstEventId]),
        /context lineage ledger is immutable: DELETE is not permitted on context_lineage_events/,
      );
      await assert.rejects(
        client.query(
          "UPDATE context_lineage_links SET link_type = 'tampered' WHERE id = $1",
          [linkId],
        ),
        /context lineage ledger is immutable: UPDATE is not permitted on context_lineage_links/,
      );
      await assert.rejects(
        client.query("DELETE FROM context_lineage_links WHERE id = $1", [linkId]),
        /context lineage ledger is immutable: DELETE is not permitted on context_lineage_links/,
      );
      console.log(CONTEXT_LINEAGE_DATABASE_EXECUTION_MARKER);
    } finally {
      await client.end();
    }
  });
});
