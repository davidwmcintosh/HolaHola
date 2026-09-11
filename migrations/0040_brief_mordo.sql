CREATE TABLE "coordination_gate3_proof_grants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" varchar NOT NULL,
	"credential_id" varchar NOT NULL,
	"runtime_registration_id" varchar(120) NOT NULL,
	"profile_id" varchar NOT NULL,
	"actor" varchar(80) NOT NULL,
	"task_ref" varchar(128) NOT NULL,
	"artifact_sha256" varchar(64) NOT NULL,
	"context_digest" varchar(64) NOT NULL,
	"starting_commit" varchar(64) NOT NULL,
	"proof_payload_digest" varchar(64) NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_gate3_grant_actor" CHECK ("coordination_gate3_proof_grants"."actor" = 'luca-gemini'),
	CONSTRAINT "coordination_gate3_grant_task_ref" CHECK ("coordination_gate3_proof_grants"."task_ref" = '1448'),
	CONSTRAINT "coordination_gate3_grant_artifact_sha256" CHECK ("coordination_gate3_proof_grants"."artifact_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_gate3_grant_context_digest" CHECK ("coordination_gate3_proof_grants"."context_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_gate3_grant_starting_commit" CHECK ("coordination_gate3_proof_grants"."starting_commit" ~ '^[0-9a-f]{40}$|^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_gate3_grant_proof_digest" CHECK ("coordination_gate3_proof_grants"."proof_payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_gate3_grant_lifecycle" CHECK ("coordination_gate3_proof_grants"."expires_at" > "coordination_gate3_proof_grants"."issued_at" AND ("coordination_gate3_proof_grants"."revoked_at" IS NULL OR "coordination_gate3_proof_grants"."revoked_at" >= "coordination_gate3_proof_grants"."issued_at"))
);
--> statement-breakpoint
ALTER TABLE "coordination_gate3_proof_grants" ADD CONSTRAINT "coordination_gate3_proof_grants_receipt_id_task_ownership_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."task_ownership_receipts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_gate3_proof_grants" ADD CONSTRAINT "coordination_gate3_proof_grants_credential_id_coordination_runtime_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."coordination_runtime_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_gate3_proof_grants" ADD CONSTRAINT "coordination_gate3_proof_grants_runtime_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("runtime_registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_gate3_proof_grants" ADD CONSTRAINT "coordination_gate3_proof_grants_profile_id_coordination_runtime_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."coordination_runtime_profiles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_gate3_grant_bindings" ON "coordination_gate3_proof_grants" USING btree ("receipt_id","credential_id","runtime_registration_id","profile_id");--> statement-breakpoint
CREATE INDEX "idx_coordination_gate3_grants_credential" ON "coordination_gate3_proof_grants" USING btree ("credential_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_gate3_grants_runtime_profile" ON "coordination_gate3_proof_grants" USING btree ("runtime_registration_id","profile_id","expires_at");