CREATE TABLE "coordination_v2_runtime_bootstrap_acknowledgements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_enrollment_id" varchar NOT NULL,
	"runtime_release_id" varchar NOT NULL,
	"issue_id" varchar NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"manifest_digest" varchar(64) NOT NULL,
	"local_evidence_digest" varchar(64) NOT NULL,
	"acknowledgement_digest" varchar(64) NOT NULL,
	"host_signature_digest" varchar(64) NOT NULL,
	"acknowledged_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_runtime_ack_manifest_digest" CHECK ("coordination_v2_runtime_bootstrap_acknowledgements"."manifest_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_ack_evidence_digest" CHECK ("coordination_v2_runtime_bootstrap_acknowledgements"."local_evidence_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_ack_digest" CHECK ("coordination_v2_runtime_bootstrap_acknowledgements"."acknowledgement_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_ack_signature_digest" CHECK ("coordination_v2_runtime_bootstrap_acknowledgements"."host_signature_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_runtime_bootstrap_issues" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_enrollment_id" varchar NOT NULL,
	"runtime_release_id" varchar NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	"manifest_digest" varchar(64) NOT NULL,
	"issued_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_runtime_issue_request_digest" CHECK ("coordination_v2_runtime_bootstrap_issues"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_issue_manifest_digest" CHECK ("coordination_v2_runtime_bootstrap_issues"."manifest_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_issue_expiry" CHECK (
    "coordination_v2_runtime_bootstrap_issues"."expires_at" > "coordination_v2_runtime_bootstrap_issues"."issued_at"
    AND "coordination_v2_runtime_bootstrap_issues"."expires_at" <= "coordination_v2_runtime_bootstrap_issues"."issued_at" + interval '5 minutes'
  ),
  CONSTRAINT "uq_coordination_v2_runtime_issue_lineage"
    UNIQUE ("id", "host_enrollment_id", "runtime_release_id", "request_key", "manifest_digest")
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_runtime_release_artifacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runtime_release_id" varchar NOT NULL,
	"role" varchar(48) NOT NULL,
	"fixed_destination" varchar(512) NOT NULL,
	"object_key" varchar(1024) NOT NULL,
	"object_digest" varchar(64) NOT NULL,
	"byte_length" bigint NOT NULL,
	"media_type" varchar(128) NOT NULL,
	"requires_authenticode" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_runtime_artifact_role" CHECK ("coordination_v2_runtime_release_artifacts"."role" IN ('node_executable', 'tsx_runtime_module')),
	CONSTRAINT "coordination_v2_runtime_artifact_digest" CHECK ("coordination_v2_runtime_release_artifacts"."object_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_artifact_length" CHECK ("coordination_v2_runtime_release_artifacts"."byte_length" > 0 AND "coordination_v2_runtime_release_artifacts"."byte_length" <= 268435456),
	CONSTRAINT "coordination_v2_runtime_artifact_object_key" CHECK ("coordination_v2_runtime_release_artifacts"."object_key" ~ '^coordination-v2/runtime/[0-9a-f]{64}/[A-Za-z0-9._-]+$')
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_runtime_release_revocations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runtime_release_id" varchar NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"reason_code" varchar(128) NOT NULL,
	"revoked_by" varchar(128) NOT NULL,
	"revoked_at" timestamp NOT NULL,
	"canonical_record_digest" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_runtime_revocation_reason" CHECK ("coordination_v2_runtime_release_revocations"."reason_code" ~ '^[A-Z0-9_]{1,128}$'),
	CONSTRAINT "coordination_v2_runtime_revocation_digest" CHECK ("coordination_v2_runtime_release_revocations"."canonical_record_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_runtime_releases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_version" integer NOT NULL,
	"source_promotion_id" varchar NOT NULL,
	"repository_identity" varchar(512) NOT NULL,
	"promoted_commit_sha" varchar(40) NOT NULL,
	"exact_tree_sha" varchar(40) NOT NULL,
	"publication_reference" varchar(512) NOT NULL,
	"protected_validation_id" varchar(128) NOT NULL,
	"source_promotion_record_digest" varchar(64) NOT NULL,
	"release_digest" varchar(64) NOT NULL,
	"manifest_template_digest" varchar(64) NOT NULL,
	"node_version" varchar(32) NOT NULL,
	"node_release_keyring_commit" varchar(40) NOT NULL,
	"node_release_keyring_digest" varchar(64) NOT NULL,
	"node_shasums_digest" varchar(64) NOT NULL,
	"node_signature_digest" varchar(64) NOT NULL,
	"node_signer_fingerprint" varchar(40) NOT NULL,
	"lockfile_digest" varchar(64) NOT NULL,
	"runtime_closure_digest" varchar(64) NOT NULL,
	"provenance_digest" varchar(64) NOT NULL,
	"source_members" jsonb NOT NULL,
	"published_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_runtime_release_protocol" CHECK ("coordination_v2_runtime_releases"."protocol_version" = 1),
	CONSTRAINT "coordination_v2_runtime_release_commit" CHECK ("coordination_v2_runtime_releases"."promoted_commit_sha" ~ '^[0-9a-f]{40}$'),
	CONSTRAINT "coordination_v2_runtime_release_tree" CHECK ("coordination_v2_runtime_releases"."exact_tree_sha" ~ '^[0-9a-f]{40}$'),
	CONSTRAINT "coordination_v2_runtime_release_source_digest" CHECK ("coordination_v2_runtime_releases"."source_promotion_record_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_release_digest" CHECK ("coordination_v2_runtime_releases"."release_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_manifest_template_digest" CHECK ("coordination_v2_runtime_releases"."manifest_template_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_release_node_version" CHECK (length(trim("coordination_v2_runtime_releases"."node_version")) > 0),
	CONSTRAINT "coordination_v2_runtime_release_node_keyring_commit" CHECK ("coordination_v2_runtime_releases"."node_release_keyring_commit" ~ '^[0-9a-f]{40}$'),
	CONSTRAINT "coordination_v2_runtime_release_node_keyring_digest" CHECK ("coordination_v2_runtime_releases"."node_release_keyring_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_release_node_shasums_digest" CHECK ("coordination_v2_runtime_releases"."node_shasums_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_release_node_signature_digest" CHECK ("coordination_v2_runtime_releases"."node_signature_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_release_node_signer_fingerprint" CHECK ("coordination_v2_runtime_releases"."node_signer_fingerprint" ~ '^[0-9A-F]{40}$'),
	CONSTRAINT "coordination_v2_runtime_release_lockfile_digest" CHECK ("coordination_v2_runtime_releases"."lockfile_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_release_runtime_closure_digest" CHECK ("coordination_v2_runtime_releases"."runtime_closure_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_release_provenance_digest" CHECK ("coordination_v2_runtime_releases"."provenance_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_runtime_release_source_members" CHECK (
    jsonb_typeof("coordination_v2_runtime_releases"."source_members") = 'array'
    AND jsonb_array_length(
      CASE
        WHEN jsonb_typeof("coordination_v2_runtime_releases"."source_members") = 'array' THEN "coordination_v2_runtime_releases"."source_members"
        ELSE '[]'::jsonb
      END
    ) > 0
  )
);
--> statement-breakpoint
ALTER TABLE "coordination_v2_runtime_bootstrap_issues" ADD CONSTRAINT "coordination_v2_runtime_bootstrap_issues_host_enrollment_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("host_enrollment_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_runtime_bootstrap_issues" ADD CONSTRAINT "coordination_v2_runtime_bootstrap_issues_runtime_release_id_coordination_v2_runtime_releases_id_fk" FOREIGN KEY ("runtime_release_id") REFERENCES "public"."coordination_v2_runtime_releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_runtime_bootstrap_acknowledgements" ADD CONSTRAINT "fk_coordination_v2_runtime_ack_issue_lineage" FOREIGN KEY ("issue_id","host_enrollment_id","runtime_release_id","request_key","manifest_digest") REFERENCES "public"."coordination_v2_runtime_bootstrap_issues"("id","host_enrollment_id","runtime_release_id","request_key","manifest_digest") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_runtime_release_artifacts" ADD CONSTRAINT "coordination_v2_runtime_release_artifacts_runtime_release_id_coordination_v2_runtime_releases_id_fk" FOREIGN KEY ("runtime_release_id") REFERENCES "public"."coordination_v2_runtime_releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_runtime_release_revocations" ADD CONSTRAINT "coordination_v2_runtime_release_revocations_runtime_release_id_coordination_v2_runtime_releases_id_fk" FOREIGN KEY ("runtime_release_id") REFERENCES "public"."coordination_v2_runtime_releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_runtime_releases" ADD CONSTRAINT "coordination_v2_runtime_releases_source_promotion_id_coordination_v2_source_promotions_id_fk" FOREIGN KEY ("source_promotion_id") REFERENCES "public"."coordination_v2_source_promotions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_ack_request" ON "coordination_v2_runtime_bootstrap_acknowledgements" USING btree ("host_enrollment_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_ack_release" ON "coordination_v2_runtime_bootstrap_acknowledgements" USING btree ("host_enrollment_id","runtime_release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_issue_request" ON "coordination_v2_runtime_bootstrap_issues" USING btree ("host_enrollment_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_issue_manifest" ON "coordination_v2_runtime_bootstrap_issues" USING btree ("manifest_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_artifact_destination" ON "coordination_v2_runtime_release_artifacts" USING btree ("runtime_release_id","fixed_destination");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_artifact_object" ON "coordination_v2_runtime_release_artifacts" USING btree ("runtime_release_id","object_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_revocation_release" ON "coordination_v2_runtime_release_revocations" USING btree ("runtime_release_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_revocation_request" ON "coordination_v2_runtime_release_revocations" USING btree ("request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_runtime_release_digest" ON "coordination_v2_runtime_releases" USING btree ("release_digest");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_runtime_release_published" ON "coordination_v2_runtime_releases" USING btree ("published_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION coordination_v2_reject_runtime_evidence_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'coordination_v2_runtime_evidence_is_append_only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER coordination_v2_runtime_releases_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_releases"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();--> statement-breakpoint
CREATE TRIGGER coordination_v2_runtime_release_artifacts_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_release_artifacts"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();--> statement-breakpoint
CREATE TRIGGER coordination_v2_runtime_bootstrap_issues_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_bootstrap_issues"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();--> statement-breakpoint
CREATE TRIGGER coordination_v2_runtime_bootstrap_acknowledgements_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_bootstrap_acknowledgements"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();--> statement-breakpoint
CREATE TRIGGER coordination_v2_runtime_release_revocations_immutable
  BEFORE UPDATE OR DELETE ON "coordination_v2_runtime_release_revocations"
  FOR EACH ROW EXECUTE FUNCTION coordination_v2_reject_runtime_evidence_mutation();