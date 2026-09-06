CREATE TYPE "public"."shared_spec_document_kind" AS ENUM('design', 'architecture');--> statement-breakpoint
CREATE TYPE "public"."shared_spec_document_state" AS ENUM('draft', 'ready_for_review', 'approved', 'published', 'merged', 'archived');--> statement-breakpoint
CREATE TYPE "public"."shared_spec_publication_state" AS ENUM('requested', 'creating', 'open', 'merged', 'closed', 'conflict', 'failed');--> statement-breakpoint
CREATE TYPE "public"."shared_spec_review_state" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shared_spec_reviewer_capability" AS ENUM('reviewer', 'policy_admin');--> statement-breakpoint
CREATE TABLE "shared_spec_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(300) NOT NULL,
	"summary" text,
	"kind" "shared_spec_document_kind" NOT NULL,
	"canonical_repository" varchar(255) NOT NULL,
	"canonical_path" varchar(1024) NOT NULL,
	"current_revision_id" varchar,
	"state" "shared_spec_document_state" DEFAULT 'draft' NOT NULL,
	"creator_actor" varchar(80) NOT NULL,
	"published_revision_id" varchar,
	"merged_revision_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_spec_documents_repository_nonempty" CHECK (length(trim("shared_spec_documents"."canonical_repository")) > 0),
	CONSTRAINT "shared_spec_documents_path_nonempty" CHECK (length(trim("shared_spec_documents"."canonical_path")) > 0)
);
--> statement-breakpoint
CREATE TABLE "shared_spec_idempotency_records" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(255) NOT NULL,
	"actor_id" varchar(80) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	"result_type" varchar(40) NOT NULL,
	"result_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_spec_idempotency_records_scope_nonempty" CHECK (length(trim("shared_spec_idempotency_records"."scope")) > 0),
	CONSTRAINT "shared_spec_idempotency_records_actor_nonempty" CHECK (length(trim("shared_spec_idempotency_records"."actor_id")) > 0),
	CONSTRAINT "shared_spec_idempotency_records_key_nonempty" CHECK (length(trim("shared_spec_idempotency_records"."idempotency_key")) > 0),
	CONSTRAINT "shared_spec_idempotency_records_request_digest_sha256" CHECK ("shared_spec_idempotency_records"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "shared_spec_idempotency_records_result_type_nonempty" CHECK (length(trim("shared_spec_idempotency_records"."result_type")) > 0),
	CONSTRAINT "shared_spec_idempotency_records_result_id_nonempty" CHECK (length(trim("shared_spec_idempotency_records"."result_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "shared_spec_publication_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"publication_id" varchar NOT NULL,
	"attempt_number" integer NOT NULL,
	"operation" varchar(80) NOT NULL,
	"outcome" varchar(40) NOT NULL,
	"request_metadata" jsonb,
	"response_metadata" jsonb,
	"error_detail" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_spec_publication_attempts_number_positive" CHECK ("shared_spec_publication_attempts"."attempt_number" > 0),
	CONSTRAINT "shared_spec_publication_attempts_operation_nonempty" CHECK (length(trim("shared_spec_publication_attempts"."operation")) > 0),
	CONSTRAINT "shared_spec_publication_attempts_outcome_nonempty" CHECK (length(trim("shared_spec_publication_attempts"."outcome")) > 0)
);
--> statement-breakpoint
CREATE TABLE "shared_spec_publications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"revision_id" varchar NOT NULL,
	"review_id" varchar NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"repository" varchar(255) NOT NULL,
	"base_ref" varchar(255) NOT NULL,
	"expected_base_commit" varchar(64) NOT NULL,
	"destination_path" varchar(1024) NOT NULL,
	"expected_destination_blob_hash" varchar(64),
	"expected_destination_absent" boolean DEFAULT false NOT NULL,
	"requested_by_actor" varchar(80) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	"branch_name" varchar(255),
	"pull_request_number" integer,
	"pull_request_url" text,
	"state" "shared_spec_publication_state" DEFAULT 'requested' NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"opened_at" timestamp,
	"merged_at" timestamp,
	"closed_at" timestamp,
	CONSTRAINT "shared_spec_publications_content_hash_sha256" CHECK ("shared_spec_publications"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "shared_spec_publications_request_digest_sha256" CHECK ("shared_spec_publications"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "shared_spec_publications_expected_base_commit_nonempty" CHECK (length(trim("shared_spec_publications"."expected_base_commit")) > 0),
	CONSTRAINT "shared_spec_publications_destination_expectation" CHECK (("shared_spec_publications"."expected_destination_absent" AND "shared_spec_publications"."expected_destination_blob_hash" IS NULL) OR (NOT "shared_spec_publications"."expected_destination_absent" AND "shared_spec_publications"."expected_destination_blob_hash" IS NOT NULL)),
	CONSTRAINT "shared_spec_publications_destination_blob_hash_sha256" CHECK ("shared_spec_publications"."expected_destination_blob_hash" IS NULL OR "shared_spec_publications"."expected_destination_blob_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "shared_spec_reviewer_policies" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"actor_id" varchar(80) NOT NULL,
	"capability" "shared_spec_reviewer_capability" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"document_kind" "shared_spec_document_kind",
	"boundary" varchar(120),
	"provenance" text NOT NULL,
	"effective_at" timestamp DEFAULT now() NOT NULL,
	"created_by_actor" varchar(80) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_spec_reviewer_policies_version_positive" CHECK ("shared_spec_reviewer_policies"."version" > 0),
	CONSTRAINT "shared_spec_reviewer_policies_actor_nonempty" CHECK (length(trim("shared_spec_reviewer_policies"."actor_id")) > 0),
	CONSTRAINT "shared_spec_reviewer_policies_provenance_nonempty" CHECK (length(trim("shared_spec_reviewer_policies"."provenance")) > 0)
);
--> statement-breakpoint
CREATE TABLE "shared_spec_reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"revision_id" varchar NOT NULL,
	"revision_content_hash" varchar(64) NOT NULL,
	"requested_by_actor" varchar(80) NOT NULL,
	"requested_reviewer_actor" varchar(80),
	"claimed_reviewer_actor" varchar(80),
	"decision_actor" varchar(80),
	"decision_policy_version_id" varchar,
	"decision_policy_version" integer,
	"decision_policy_actor_id" varchar(80),
	"decision_policy_capability" "shared_spec_reviewer_capability",
	"decision_policy_active" boolean,
	"decision_policy_document_kind" "shared_spec_document_kind",
	"decision_policy_effective_at" timestamp,
	"state" "shared_spec_review_state" DEFAULT 'pending' NOT NULL,
	"decision_rationale" text,
	"evidence_references" jsonb,
	"idempotency_key" varchar(160) NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"claimed_at" timestamp,
	"decided_at" timestamp,
	"cancelled_at" timestamp,
	CONSTRAINT "shared_spec_reviews_content_hash_sha256" CHECK ("shared_spec_reviews"."revision_content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "shared_spec_reviews_request_digest_sha256" CHECK ("shared_spec_reviews"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "shared_spec_reviews_decision_policy_snapshot" CHECK (
    ("shared_spec_reviews"."decision_policy_version_id" IS NULL
      AND "shared_spec_reviews"."decision_policy_version" IS NULL
      AND "shared_spec_reviews"."decision_policy_actor_id" IS NULL
      AND "shared_spec_reviews"."decision_policy_capability" IS NULL
      AND "shared_spec_reviews"."decision_policy_active" IS NULL
      AND "shared_spec_reviews"."decision_policy_effective_at" IS NULL)
    OR
    ("shared_spec_reviews"."decision_policy_version_id" IS NOT NULL
      AND "shared_spec_reviews"."decision_policy_version" > 0
      AND "shared_spec_reviews"."decision_policy_actor_id" IS NOT NULL
      AND "shared_spec_reviews"."decision_policy_capability" IS NOT NULL
      AND "shared_spec_reviews"."decision_policy_active" IS NOT NULL
      AND "shared_spec_reviews"."decision_policy_effective_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "shared_spec_revisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar NOT NULL,
	"parent_revision_id" varchar,
	"markdown" text NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"author_actor" varchar(80) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shared_spec_revisions_markdown_nonempty" CHECK (length("shared_spec_revisions"."markdown") > 0),
	CONSTRAINT "shared_spec_revisions_content_hash_sha256" CHECK ("shared_spec_revisions"."content_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "shared_spec_revisions_request_digest_sha256" CHECK ("shared_spec_revisions"."request_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "shared_spec_publication_attempts" ADD CONSTRAINT "shared_spec_publication_attempts_publication_id_shared_spec_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."shared_spec_publications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_spec_publications" ADD CONSTRAINT "shared_spec_publications_document_id_shared_spec_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."shared_spec_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_spec_publications" ADD CONSTRAINT "shared_spec_publications_revision_id_shared_spec_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."shared_spec_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_spec_publications" ADD CONSTRAINT "shared_spec_publications_review_id_shared_spec_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."shared_spec_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_spec_reviews" ADD CONSTRAINT "shared_spec_reviews_document_id_shared_spec_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."shared_spec_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_spec_reviews" ADD CONSTRAINT "shared_spec_reviews_revision_id_shared_spec_revisions_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."shared_spec_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_spec_reviews" ADD CONSTRAINT "shared_spec_reviews_decision_policy_version_id_shared_spec_reviewer_policies_id_fk" FOREIGN KEY ("decision_policy_version_id") REFERENCES "public"."shared_spec_reviewer_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_spec_revisions" ADD CONSTRAINT "shared_spec_revisions_document_id_shared_spec_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."shared_spec_documents"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
ALTER TABLE "shared_spec_revisions" ADD CONSTRAINT "shared_spec_revisions_parent_revision_id_shared_spec_revisions_id_fk" FOREIGN KEY ("parent_revision_id") REFERENCES "public"."shared_spec_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_spec_documents" ADD CONSTRAINT "shared_spec_documents_current_revision_id_shared_spec_revisions_id_fk" FOREIGN KEY ("current_revision_id") REFERENCES "public"."shared_spec_revisions"("id") ON DELETE no action ON UPDATE no action DEFERRABLE INITIALLY DEFERRED;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shared_spec_documents_active_destination" ON "shared_spec_documents" USING btree ("canonical_repository","canonical_path") WHERE "shared_spec_documents"."state" <> 'archived';--> statement-breakpoint
CREATE INDEX "idx_shared_spec_documents_current_revision" ON "shared_spec_documents" USING btree ("current_revision_id");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_documents_state_updated" ON "shared_spec_documents" USING btree ("state","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shared_spec_idempotency_records_scope_actor_key" ON "shared_spec_idempotency_records" USING btree ("scope","actor_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_idempotency_records_created" ON "shared_spec_idempotency_records" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shared_spec_publication_attempts_sequence" ON "shared_spec_publication_attempts" USING btree ("publication_id","attempt_number");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_publication_attempts_publication_created" ON "shared_spec_publication_attempts" USING btree ("publication_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shared_spec_publications_approved_revision" ON "shared_spec_publications" USING btree ("document_id","revision_id","review_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shared_spec_publications_idempotency" ON "shared_spec_publications" USING btree ("requested_by_actor","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_publications_state_updated" ON "shared_spec_publications" USING btree ("state","updated_at");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_publications_review" ON "shared_spec_publications" USING btree ("review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shared_spec_reviewer_policies_version" ON "shared_spec_reviewer_policies" USING btree ("version");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_reviewer_policies_lookup" ON "shared_spec_reviewer_policies" USING btree ("actor_id","capability","effective_at");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_reviewer_policies_effective" ON "shared_spec_reviewer_policies" USING btree ("effective_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shared_spec_reviews_revision" ON "shared_spec_reviews" USING btree ("document_id","revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shared_spec_reviews_idempotency" ON "shared_spec_reviews" USING btree ("document_id","requested_by_actor","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_reviews_pending" ON "shared_spec_reviews" USING btree ("state","requested_reviewer_actor","created_at");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_reviews_revision" ON "shared_spec_reviews" USING btree ("revision_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_shared_spec_revisions_idempotency" ON "shared_spec_revisions" USING btree ("document_id","author_actor","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_revisions_document_created" ON "shared_spec_revisions" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_shared_spec_revisions_parent" ON "shared_spec_revisions" USING btree ("parent_revision_id");--> statement-breakpoint
CREATE FUNCTION shared_spec_reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME
    USING ERRCODE = '55000';
END;
$$;--> statement-breakpoint
CREATE TRIGGER shared_spec_revisions_append_only
BEFORE UPDATE OR DELETE ON shared_spec_revisions
FOR EACH ROW EXECUTE FUNCTION shared_spec_reject_history_mutation();--> statement-breakpoint
CREATE TRIGGER shared_spec_reviewer_policies_append_only
BEFORE UPDATE OR DELETE ON shared_spec_reviewer_policies
FOR EACH ROW EXECUTE FUNCTION shared_spec_reject_history_mutation();--> statement-breakpoint
CREATE TRIGGER shared_spec_publication_attempts_append_only
BEFORE UPDATE OR DELETE ON shared_spec_publication_attempts
FOR EACH ROW EXECUTE FUNCTION shared_spec_reject_history_mutation();--> statement-breakpoint
CREATE FUNCTION shared_spec_reject_document_identity_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.summary IS DISTINCT FROM OLD.summary OR NEW.kind IS DISTINCT FROM OLD.kind
    OR NEW.canonical_repository IS DISTINCT FROM OLD.canonical_repository
    OR NEW.canonical_path IS DISTINCT FROM OLD.canonical_path
    OR NEW.creator_actor IS DISTINCT FROM OLD.creator_actor
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'shared_spec_documents identity/provenance is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER shared_spec_documents_identity_immutable
BEFORE UPDATE ON shared_spec_documents
FOR EACH ROW EXECUTE FUNCTION shared_spec_reject_document_identity_mutation();--> statement-breakpoint
CREATE FUNCTION shared_spec_reject_review_provenance_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.document_id IS DISTINCT FROM OLD.document_id
    OR NEW.revision_id IS DISTINCT FROM OLD.revision_id OR NEW.revision_content_hash IS DISTINCT FROM OLD.revision_content_hash
    OR NEW.requested_by_actor IS DISTINCT FROM OLD.requested_by_actor
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.request_digest IS DISTINCT FROM OLD.request_digest
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'shared_spec_reviews identity/provenance is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER shared_spec_reviews_provenance_immutable
BEFORE UPDATE ON shared_spec_reviews
FOR EACH ROW EXECUTE FUNCTION shared_spec_reject_review_provenance_mutation();--> statement-breakpoint
CREATE FUNCTION shared_spec_reject_publication_provenance_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.document_id IS DISTINCT FROM OLD.document_id
    OR NEW.revision_id IS DISTINCT FROM OLD.revision_id OR NEW.review_id IS DISTINCT FROM OLD.review_id
    OR NEW.content_hash IS DISTINCT FROM OLD.content_hash OR NEW.repository IS DISTINCT FROM OLD.repository
    OR NEW.base_ref IS DISTINCT FROM OLD.base_ref OR NEW.expected_base_commit IS DISTINCT FROM OLD.expected_base_commit
    OR NEW.destination_path IS DISTINCT FROM OLD.destination_path
    OR NEW.expected_destination_blob_hash IS DISTINCT FROM OLD.expected_destination_blob_hash
    OR NEW.expected_destination_absent IS DISTINCT FROM OLD.expected_destination_absent
    OR NEW.requested_by_actor IS DISTINCT FROM OLD.requested_by_actor
    OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.request_digest IS DISTINCT FROM OLD.request_digest
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'shared_spec_publications identity/provenance is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER shared_spec_publications_provenance_immutable
BEFORE UPDATE ON shared_spec_publications
FOR EACH ROW EXECUTE FUNCTION shared_spec_reject_publication_provenance_mutation();