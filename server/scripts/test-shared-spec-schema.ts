import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const schemaPath = resolve(root, "shared/schema.ts");
const migrationPath = resolve(root, "migrations/0030_shared_spec_workspace.sql");
const corePath = resolve(root, "server/services/shared-spec-core.ts");

async function main() {
  const [schema, migration, core] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readFile(migrationPath, "utf8"),
    readFile(corePath, "utf8"),
  ]);

  for (const table of [
    "shared_spec_documents",
    "shared_spec_revisions",
    "shared_spec_reviewer_policies",
    "shared_spec_reviews",
    "shared_spec_publications",
    "shared_spec_publication_attempts",
    "shared_spec_idempotency_records",
  ]) {
    assert.match(schema, new RegExp(`pgTable\\("${table}"`), `${table} must remain in the Drizzle schema`);
    assert.match(migration, new RegExp(`CREATE TABLE "${table}"`), `${table} must remain in the migration`);
  }

  for (const enumName of [
    "shared_spec_document_kind",
    "shared_spec_document_state",
    "shared_spec_review_state",
    "shared_spec_publication_state",
    "shared_spec_reviewer_capability",
  ]) {
    assert.match(migration, new RegExp(`CREATE TYPE "public"\\."${enumName}"`), `${enumName} enum is missing`);
  }
  assert.match(
    migration,
    /CREATE TYPE "public"\."shared_spec_document_kind" AS ENUM\('design', 'architecture'\)/,
    "document kinds must be the portable design/architecture contract",
  );
  assert.match(
    migration,
    /CREATE TYPE "public"\."shared_spec_reviewer_capability" AS ENUM\('reviewer', 'policy_admin'\)/,
    "policy administration capability must be policy_admin everywhere",
  );
  assert.match(core, /SharedSpecDocumentKind = "design" \| "architecture"/, "core must use design/architecture kinds");
  assert.match(core, /ReviewerCapability = "reviewer" \| "policy_admin"/, "core must use policy_admin capability");
  assert.doesNotMatch(core, /policy-admin/, "core must not retain a second policy-admin capability spelling");

  assert.match(
    migration,
    /CREATE UNIQUE INDEX "uq_shared_spec_documents_active_destination"[\s\S]*WHERE "shared_spec_documents"\."state" <> 'archived'/,
    "active documents must have a unique canonical repository/path",
  );
  assert.match(migration, /shared_spec_revisions_content_hash_sha256/, "revision hashes must be constrained");
  assert.match(migration, /shared_spec_revisions_request_digest_sha256/, "revision request provenance must be constrained");
  assert.match(migration, /shared_spec_reviews_request_digest_sha256/, "review request provenance must be constrained");
  assert.match(migration, /shared_spec_publications_destination_expectation/, "publication destination expectation must be constrained");
  assert.match(
    migration,
    /shared_spec_documents_current_revision_id_shared_spec_revisions_id_fk" FOREIGN KEY[^;]+DEFERRABLE INITIALLY DEFERRED/,
    "the document current-revision FK must permit atomic first revision insertion",
  );
  assert.match(
    migration,
    /shared_spec_revisions_document_id_shared_spec_documents_id_fk" FOREIGN KEY[^;]+DEFERRABLE INITIALLY DEFERRED/,
    "the revision document FK must permit atomic first revision insertion",
  );
  assert.match(
    migration,
    /"version" integer NOT NULL[\s\S]*uq_shared_spec_reviewer_policies_version/,
    "reviewer policy versions must be unique and monotonic",
  );
  assert.match(
    migration,
    /shared_spec_reviews_decision_policy_version_id_shared_spec_reviewer_policies_id_fk/,
    "review decisions must retain their exact policy-version identity",
  );
  for (const column of [
    "decision_policy_version",
    "decision_policy_actor_id",
    "decision_policy_capability",
    "decision_policy_active",
    "decision_policy_effective_at",
  ]) {
    assert.match(migration, new RegExp(`"${column}"`), `${column} snapshot is required`);
  }
  assert.match(
    migration,
    /shared_spec_reviews_decision_policy_snapshot/,
    "review policy snapshots must be complete when present",
  );
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "uq_shared_spec_idempotency_records_scope_actor_key"[\s\S]*\("scope","actor_id","idempotency_key"\)/,
    "durable idempotency must be unique by scope, actor, and key",
  );
  for (const constraint of [
    "shared_spec_idempotency_records_scope_nonempty",
    "shared_spec_idempotency_records_actor_nonempty",
    "shared_spec_idempotency_records_key_nonempty",
    "shared_spec_idempotency_records_request_digest_sha256",
    "shared_spec_idempotency_records_result_type_nonempty",
    "shared_spec_idempotency_records_result_id_nonempty",
  ]) {
    assert.match(migration, new RegExp(constraint), `${constraint} is required for durable idempotency`);
  }

  for (const trigger of [
    "shared_spec_revisions_append_only",
    "shared_spec_reviewer_policies_append_only",
    "shared_spec_publication_attempts_append_only",
    "shared_spec_documents_identity_immutable",
    "shared_spec_reviews_provenance_immutable",
    "shared_spec_publications_provenance_immutable",
  ]) {
    assert.match(migration, new RegExp(`CREATE TRIGGER ${trigger}`), `${trigger} must prevent history rewrites`);
  }
  for (const fn of [
    "shared_spec_reject_document_identity_mutation",
    "shared_spec_reject_review_provenance_mutation",
    "shared_spec_reject_publication_provenance_mutation",
  ]) assert.match(migration, new RegExp(`CREATE FUNCTION ${fn}`), `${fn} must protect lifecycle tables`);

  console.log("Shared-spec schema and migration checks passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});