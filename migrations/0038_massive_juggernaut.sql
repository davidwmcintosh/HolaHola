CREATE TABLE "coordination_runtime_tool_results" (
	"id" varchar PRIMARY KEY NOT NULL,
	"claim_id" varchar NOT NULL,
	"claim_epoch" integer NOT NULL,
	"interaction_id" varchar NOT NULL,
	"call_id" varchar NOT NULL,
	"runtime_registration_id" varchar NOT NULL,
	"profile_id" varchar NOT NULL,
	"credential_id" varchar NOT NULL,
	"validated_intent_digest" varchar(64) NOT NULL,
	"tool_name" varchar(80) NOT NULL,
	"outcome" varchar(20) NOT NULL,
	"canonical_payload" jsonb NOT NULL,
	"result_digest" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_tool_result_intent_digest_hex" CHECK ("coordination_runtime_tool_results"."validated_intent_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_tool_result_digest_hex" CHECK ("coordination_runtime_tool_results"."result_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_tool_result_outcome_allowed" CHECK ("coordination_runtime_tool_results"."outcome" IN ('succeeded', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "coordination_runtime_verifications" DROP CONSTRAINT "coord_runtime_verification_decision_approved";--> statement-breakpoint
ALTER TABLE "coordination_runtime_tool_results" ADD CONSTRAINT "coordination_runtime_tool_results_claim_id_coordination_runtime_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."coordination_runtime_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_tool_results" ADD CONSTRAINT "coordination_runtime_tool_results_interaction_id_coordination_runtime_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."coordination_runtime_interactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_tool_results" ADD CONSTRAINT "coordination_runtime_tool_results_runtime_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("runtime_registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_tool_results" ADD CONSTRAINT "coordination_runtime_tool_results_profile_id_coordination_runtime_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."coordination_runtime_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_tool_results" ADD CONSTRAINT "coordination_runtime_tool_results_credential_id_coordination_runtime_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."coordination_runtime_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_tool_results" ADD CONSTRAINT "fk_coord_runtime_tool_result_claim_epoch" FOREIGN KEY ("claim_id","claim_epoch") REFERENCES "public"."coordination_runtime_claims"("id","epoch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_tool_result_claim_epoch_interaction_call" ON "coordination_runtime_tool_results" USING btree ("claim_id","claim_epoch","interaction_id","call_id");--> statement-breakpoint
ALTER TABLE "coordination_runtime_verifications" ADD CONSTRAINT "coord_runtime_verification_decision_allowed" CHECK ("coordination_runtime_verifications"."decision" IN ('approved', 'rejected'));--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_tool_results_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_tool_results"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();