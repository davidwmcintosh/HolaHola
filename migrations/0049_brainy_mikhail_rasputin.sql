CREATE TABLE "coordination_v2_source_promotions" (
"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
"repository_identity" varchar(512) NOT NULL,
"promoted_commit_sha" varchar(40) NOT NULL,
"exact_tree_sha" varchar(40) NOT NULL,
"publication_reference" varchar(512) NOT NULL,
"protected_validation_id" varchar(128) NOT NULL,
"publish_trigger_sha" varchar(40),
"parent_sha" varchar(40),
"canonical_record_digest" varchar(64) NOT NULL,
"state" varchar(16) DEFAULT 'published' NOT NULL,
"created_at" timestamp DEFAULT now() NOT NULL,
"operation_receipt_digest" varchar(64) NOT NULL,
"operation_receipt_reference" varchar(512) NOT NULL,
CONSTRAINT "uq_coordination_v2_source_promotion_identity" UNIQUE("promoted_commit_sha","exact_tree_sha","publication_reference","protected_validation_id"),
CONSTRAINT "coordination_v2_source_promotion_state" CHECK ("coordination_v2_source_promotions"."state" = 'published'),
CONSTRAINT "coordination_v2_source_promotion_commit" CHECK ("coordination_v2_source_promotions"."promoted_commit_sha" ~ '^[0-9a-f]{40}$'),
CONSTRAINT "coordination_v2_source_promotion_tree" CHECK ("coordination_v2_source_promotions"."exact_tree_sha" ~ '^[0-9a-f]{40}$'),
CONSTRAINT "coordination_v2_source_promotion_digest" CHECK ("coordination_v2_source_promotions"."canonical_record_digest" ~ '^[0-9a-f]{64}$'),
CONSTRAINT "coordination_v2_source_promotion_receipt_digest" CHECK ("coordination_v2_source_promotions"."operation_receipt_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_host_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_enrollment_id" varchar NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"credential_digest" varchar(64) NOT NULL,
	"lineage_digest" varchar(64) NOT NULL,
	"capability" varchar(80) DEFAULT 'host:transport' NOT NULL,
	"protocol_version" integer NOT NULL,
	"holder_instance_id" varchar(128),
	"proof_key_fingerprint" varchar(64) NOT NULL,
	"issued_by" varchar(128) NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_host_credential_hash" CHECK ("coordination_v2_host_credentials"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_credential_digest" CHECK ("coordination_v2_host_credentials"."credential_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_credential_lineage" CHECK ("coordination_v2_host_credentials"."lineage_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_credential_fingerprint" CHECK ("coordination_v2_host_credentials"."proof_key_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_credential_capability" CHECK ("coordination_v2_host_credentials"."capability" IN ('host:transport', 'host:cleanup')),
	CONSTRAINT "coordination_v2_host_credential_protocol" CHECK ("coordination_v2_host_credentials"."protocol_version" > 0),
	CONSTRAINT "coordination_v2_host_credential_holder" CHECK ("coordination_v2_host_credentials"."holder_instance_id" IS NULL OR length(trim("coordination_v2_host_credentials"."holder_instance_id")) > 0),
	CONSTRAINT "coordination_v2_host_credential_expiry" CHECK ("coordination_v2_host_credentials"."expires_at" > "coordination_v2_host_credentials"."issued_at"),
	CONSTRAINT "coordination_v2_host_credential_revocation" CHECK ("coordination_v2_host_credentials"."revoked_at" IS NULL OR "coordination_v2_host_credentials"."revoked_at" >= "coordination_v2_host_credentials"."issued_at")
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_host_enrollment_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_key" varchar(128) NOT NULL,
	"host_type" varchar(40) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"protocol_version" integer NOT NULL,
	"public_key" text NOT NULL,
	"key_fingerprint" varchar(64) NOT NULL,
	"capabilities" text[] NOT NULL,
	"declaration_digest" varchar(64) NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"founder_actor" varchar(128),
	"host_enrollment_id" varchar,
	"terminal_reason" varchar(128),
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"terminal_at" timestamp,
	CONSTRAINT "coordination_v2_host_enrollment_request_key" CHECK (length(trim("coordination_v2_host_enrollment_requests"."request_key")) > 0),
	CONSTRAINT "coordination_v2_host_enrollment_request_digest" CHECK ("coordination_v2_host_enrollment_requests"."declaration_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_enrollment_request_fingerprint" CHECK ("coordination_v2_host_enrollment_requests"."key_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_enrollment_request_status" CHECK ("coordination_v2_host_enrollment_requests"."status" IN ('pending', 'approved', 'rejected', 'completed', 'expired')),
	CONSTRAINT "coordination_v2_host_enrollment_request_expiry" CHECK ("coordination_v2_host_enrollment_requests"."expires_at" > "coordination_v2_host_enrollment_requests"."created_at")
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_host_proof_challenges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_request_id" varchar NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"nonce_hash" varchar(64) NOT NULL,
	"challenge_digest" varchar(64) NOT NULL,
	"issued_by" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_host_challenge_nonce" CHECK ("coordination_v2_host_proof_challenges"."nonce_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_challenge_digest" CHECK ("coordination_v2_host_proof_challenges"."challenge_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_challenge_expiry" CHECK ("coordination_v2_host_proof_challenges"."expires_at" > "coordination_v2_host_proof_challenges"."created_at"),
	CONSTRAINT "coordination_v2_host_challenge_consumed" CHECK ("coordination_v2_host_proof_challenges"."consumed_at" IS NULL OR "coordination_v2_host_proof_challenges"."consumed_at" >= "coordination_v2_host_proof_challenges"."created_at")
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_session_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_credential_id" varchar NOT NULL,
	"host_enrollment_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"credential_digest" varchar(64) NOT NULL,
	"capability" varchar(80) NOT NULL,
	"protocol_version" integer NOT NULL,
	"holder_instance_id" varchar(128) NOT NULL,
	"issued_by" varchar(128) NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_session_credential_hash" CHECK ("coordination_v2_session_credentials"."token_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_session_credential_digest" CHECK ("coordination_v2_session_credentials"."credential_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_session_credential_capability" CHECK ("coordination_v2_session_credentials"."capability" IN ('host:transport', 'host:cleanup')),
	CONSTRAINT "coordination_v2_session_credential_protocol" CHECK ("coordination_v2_session_credentials"."protocol_version" > 0),
	CONSTRAINT "coordination_v2_session_credential_expiry" CHECK ("coordination_v2_session_credentials"."expires_at" > "coordination_v2_session_credentials"."issued_at"),
	CONSTRAINT "coordination_v2_session_credential_revocation" CHECK ("coordination_v2_session_credentials"."revoked_at" IS NULL OR "coordination_v2_session_credentials"."revoked_at" >= "coordination_v2_session_credentials"."issued_at")
);
--> statement-breakpoint
ALTER TABLE "coordination_v2_host_enrollments" ADD COLUMN "enrollment_request_key" varchar(128);--> statement-breakpoint
UPDATE "coordination_v2_host_enrollments" SET "enrollment_request_key" = 'legacy-' || "id" WHERE "enrollment_request_key" IS NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_host_enrollments" ALTER COLUMN "enrollment_request_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_host_enrollments" ADD COLUMN "revocation_request_key" varchar(128);--> statement-breakpoint
ALTER TABLE "coordination_v2_host_credentials" ADD CONSTRAINT "uq_coordination_v2_host_credential_scope" UNIQUE ("id","host_enrollment_id");--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD COLUMN "attempt_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD COLUMN "lease_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD COLUMN "lease_epoch" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "coordination_v2_session_credentials_attempt_id_coordination_v2_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."coordination_v2_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "coordination_v2_session_credentials_lease_id_coordination_v2_transport_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."coordination_v2_transport_leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "fk_coordination_v2_session_credential_attempt_session" FOREIGN KEY ("session_id","attempt_id") REFERENCES "public"."coordination_v2_attempts"("session_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "fk_coordination_v2_session_credential_lease_session" FOREIGN KEY ("session_id","lease_id") REFERENCES "public"."coordination_v2_transport_leases"("session_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "fk_coordination_v2_session_credential_lease_epoch" FOREIGN KEY ("lease_id","lease_epoch") REFERENCES "public"."coordination_v2_transport_leases"("id","epoch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "coordination_v2_session_credential_lease_epoch" CHECK ("coordination_v2_session_credentials"."lease_epoch" > 0);--> statement-breakpoint
ALTER TABLE "coordination_v2_host_credentials" ADD CONSTRAINT "coordination_v2_host_credentials_host_enrollment_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("host_enrollment_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_host_enrollment_requests" ADD CONSTRAINT "coordination_v2_host_enrollment_requests_host_enrollment_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("host_enrollment_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_host_proof_challenges" ADD CONSTRAINT "coordination_v2_host_proof_challenges_enrollment_request_id_coordination_v2_host_enrollment_requests_id_fk" FOREIGN KEY ("enrollment_request_id") REFERENCES "public"."coordination_v2_host_enrollment_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "coordination_v2_session_credentials_host_credential_id_coordination_v2_host_credentials_id_fk" FOREIGN KEY ("host_credential_id") REFERENCES "public"."coordination_v2_host_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "coordination_v2_session_credentials_host_enrollment_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("host_enrollment_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "coordination_v2_session_credentials_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "fk_coordination_v2_session_credential_host_scope" FOREIGN KEY ("host_credential_id","host_enrollment_id") REFERENCES "public"."coordination_v2_host_credentials"("id","host_enrollment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_credentials" ADD CONSTRAINT "fk_coordination_v2_session_credential_session_host" FOREIGN KEY ("session_id","host_enrollment_id") REFERENCES "public"."coordination_v2_sessions"("id","enrolled_host_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_host_credential_hash" ON "coordination_v2_host_credentials" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_host_credential_digest" ON "coordination_v2_host_credentials" USING btree ("credential_digest");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_host_credential_active" ON "coordination_v2_host_credentials" USING btree ("host_enrollment_id","expires_at","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_host_enrollment_request_key" ON "coordination_v2_host_enrollment_requests" USING btree ("request_key");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_host_enrollment_request_status" ON "coordination_v2_host_enrollment_requests" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_host_challenge_request" ON "coordination_v2_host_proof_challenges" USING btree ("enrollment_request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_host_challenge_nonce" ON "coordination_v2_host_proof_challenges" USING btree ("nonce_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_session_credential_hash" ON "coordination_v2_session_credentials" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_session_credential_digest" ON "coordination_v2_session_credentials" USING btree ("credential_digest");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_session_credential_scope" ON "coordination_v2_session_credentials" USING btree ("session_id","attempt_id","lease_id","expires_at","revoked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_host_enrollment_request" ON "coordination_v2_host_enrollments" USING btree ("enrollment_request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_source_promotion_record_digest" ON "coordination_v2_source_promotions" USING btree ("canonical_record_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_source_promotion_receipt" ON "coordination_v2_source_promotions" USING btree ("operation_receipt_digest");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_source_promotion_created" ON "coordination_v2_source_promotions" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "coordination_v2_sessions" ADD COLUMN "preparation_reservation_id" varchar;--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ALTER COLUMN "session_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "task_ref" varchar(128);--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "task_artifact_sha256" varchar(64);--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "promotion_record_id" varchar;--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "promoted_commit_sha" varchar(40);--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "exact_tree_sha" varchar(40);--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "policy_identity_id" varchar;--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "policy_version_id" varchar;--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "operator_grant_id" varchar;--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "operator_actor" varchar(128);--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "budgets_digest" varchar(64);--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "completion_criteria_digest" varchar(64);--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD COLUMN "validation_criteria_digest" varchar(64);--> statement-breakpoint
DROP INDEX "uq_coordination_v2_preparation_reserve_request";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_preparation_reserve_request" ON "coordination_v2_preparation_reservations" USING btree ("reserve_request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_session_preparation_reservation" ON "coordination_v2_sessions" USING btree ("preparation_reservation_id") WHERE "coordination_v2_sessions"."preparation_reservation_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_sessions" ADD CONSTRAINT "fk_coordination_v2_session_preparation_reservation" FOREIGN KEY ("preparation_reservation_id") REFERENCES "public"."coordination_v2_preparation_reservations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD CONSTRAINT "coordination_v2_preparation_task_shape" CHECK ("task_ref" IS NULL OR ("task_ref" ~ '^[1-9][0-9]*$' AND "task_artifact_sha256" ~ '^[0-9a-f]{64}$'));--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD CONSTRAINT "coordination_v2_preparation_promotion_shape" CHECK ("promoted_commit_sha" IS NULL OR ("promoted_commit_sha" ~ '^[0-9a-f]{40}$' AND "exact_tree_sha" ~ '^[0-9a-f]{40}$'));--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD CONSTRAINT "coordination_v2_preparation_authority_shape" CHECK ("state" IN ('reserved','promoted','acknowledged') AND "task_ref" IS NOT NULL AND "policy_version_id" IS NOT NULL AND "operator_grant_id" IS NOT NULL AND "operator_actor" IS NOT NULL OR "state" IN ('failed','expired','abandoned')) NOT VALID;--> statement-breakpoint
CREATE OR REPLACE FUNCTION coordination_v2_reject_source_promotion_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'coordination_v2_source_promotions_is_append_only'; END; $$;--> statement-breakpoint
CREATE TRIGGER coordination_v2_source_promotions_immutable BEFORE UPDATE OR DELETE ON "coordination_v2_source_promotions" FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_source_promotion_mutation();--> statement-breakpoint
ALTER TABLE "coordination_v2_host_enrollments" ADD CONSTRAINT "coordination_v2_host_request" CHECK (length(trim("coordination_v2_host_enrollments"."enrollment_request_key")) > 0);--> statement-breakpoint
ALTER TABLE "coordination_v2_host_enrollments" ADD CONSTRAINT "coordination_v2_host_revocation_request" CHECK ("coordination_v2_host_enrollments"."revocation_request_key" IS NULL OR length(trim("coordination_v2_host_enrollments"."revocation_request_key")) > 0);