import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync("shared/schema.ts", "utf8");
const migration = readFileSync("migrations/0041_unknown_beyonder.sql", "utf8");
const followupMigration = readFileSync("migrations/0042_red_ink.sql", "utf8");

const tables = [
  "coordination_v2_host_enrollments",
  "coordination_v2_policy_identities",
  "coordination_v2_policy_versions",
  "coordination_v2_founder_decisions",
  "coordination_v2_operator_grants",
  "coordination_v2_sessions",
  "coordination_v2_session_events",
  "coordination_v2_attempts",
  "coordination_v2_attempt_events",
  "coordination_v2_transport_leases",
  "coordination_v2_cleanup_obligations",
  "coordination_v2_cleanup_acknowledgements",
] as const;

test("Coordinator V2 schema and migration contain the complete persistence model", () => {
  for (const table of tables) {
    assert.match(schema, new RegExp(`pgTable\\("${table}"`), `${table} missing from schema`);
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`), `${table} missing from migration`);
  }
});

test("Coordinator V2 lifecycle checks use the canonical state vocabulary", () => {
  for (const state of [
    "preparing", "ready", "running", "waiting_for_host", "verifying",
    "succeeded", "failed", "exhausted", "expired", "revoked",
    "created", "provider_active", "intent_ready", "host_active",
    "result_ready", "provider_continuation", "completed",
    "retryable_failed", "terminal_failed", "cancelled",
  ]) {
    assert(migration.includes(`'${state}'`), `missing lifecycle state ${state}`);
  }
  assert.match(
    migration,
    /"state" IN \('active', 'released', 'expired', 'superseded'\)/,
    "transport lease states drifted",
  );
});

test("Coordinator V2 authority indexes include active-lease and immutable-digest guards", () => {
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "uq_coordination_v2_lease_active"[\s\S]*WHERE .*"state" = 'active'/,
  );
  assert.match(migration, /CREATE UNIQUE INDEX "uq_coordination_v2_session_digest"/);
  assert.match(migration, /CREATE UNIQUE INDEX "uq_coordination_v2_attempt_generation"/);
  assert.match(migration, /CREATE UNIQUE INDEX "uq_coordination_v2_policy_version"/);
});

test("Coordinator V2 historical evidence and decided policies are protected", () => {
  for (const trigger of [
    "coordination_v2_founder_decisions_immutable",
    "coordination_v2_session_events_immutable",
    "coordination_v2_attempt_events_immutable",
    "coordination_v2_cleanup_acknowledgements_immutable",
    "coordination_v2_policy_versions_protected",
  ]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER "${trigger}"`), `${trigger} missing`);
  }
  assert.match(migration, /IF OLD\."approval_state" <> 'draft'/);
  assert.match(migration, /Coordinator V2 policy provenance is immutable/);
});

test("cleanup obligations persist immutable terminal session outcomes", () => {
  assert.match(schema, /terminalOutcome: varchar\("terminal_outcome"/);
  assert.match(schema, /terminalReason: varchar\("terminal_reason"/);
  assert.match(followupMigration, /ADD COLUMN "terminal_outcome"/);
  assert.match(followupMigration, /ADD COLUMN "terminal_reason"/);
  assert.match(followupMigration, /coordination_v2_cleanup_terminal_outcome/);
  assert.match(followupMigration, /coordination_v2_cleanup_terminal_provenance_immutable/);
});

test("Coordinator V2 relationships fail closed with restrictive foreign keys", () => {
  const foreignKeys = migration.match(/FOREIGN KEY \([^)]+\)[^;]+;/g) ?? [];
  assert(foreignKeys.length >= 19, "expected all V2 foreign keys");
  for (const foreignKey of foreignKeys) {
    assert.match(foreignKey, /ON DELETE restrict/);
  }
});