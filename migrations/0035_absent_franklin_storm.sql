CREATE TYPE "public"."coordination_runtime_claim_event_kind" AS ENUM('acquired', 'renewed', 'expired', 'violated');--> statement-breakpoint
CREATE TYPE "public"."coordination_runtime_claim_status" AS ENUM('active', 'expired', 'completed', 'violated');--> statement-breakpoint
CREATE TYPE "public"."coordination_runtime_profile_status" AS ENUM('active', 'superseded', 'closed');--> statement-breakpoint
CREATE TABLE "coordination_runtime_claim_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"claim_id" varchar NOT NULL,
	"epoch" integer NOT NULL,
	"kind" "coordination_runtime_claim_event_kind" NOT NULL,
	"reason" text,
	"prior_claim_id" varchar,
	"occurred_at" timestamp NOT NULL,
	CONSTRAINT "coord_runtime_claim_event_epoch_positive" CHECK ("coordination_runtime_claim_events"."epoch" > 0)
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_claims" (
	"id" varchar PRIMARY KEY NOT NULL,
	"thread_id" varchar NOT NULL,
	"packet_id" varchar NOT NULL,
	"runtime_registration_id" varchar NOT NULL,
	"profile_id" varchar NOT NULL,
	"credential_id" varchar NOT NULL,
	"prior_claim_id" varchar,
	"epoch" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"status" "coordination_runtime_claim_status" NOT NULL,
	"terminal_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_claim_epoch_positive" CHECK ("coordination_runtime_claims"."epoch" > 0),
	CONSTRAINT "coord_runtime_claim_terminal_timestamp" CHECK ((status = 'active' AND terminal_at IS NULL) OR (status <> 'active' AND terminal_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_completions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"execution_id" varchar NOT NULL,
	"claim_id" varchar NOT NULL,
	"claim_epoch" integer NOT NULL,
	"evidence_digest" varchar(64) NOT NULL,
	"canonical_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_completion_evidence_digest_hex" CHECK ("coordination_runtime_completions"."evidence_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_executions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"claim_id" varchar NOT NULL,
	"claim_epoch" integer NOT NULL,
	"runtime_registration_id" varchar NOT NULL,
	"profile_id" varchar NOT NULL,
	"credential_id" varchar NOT NULL,
	"envelope" jsonb NOT NULL,
	"canonical_payload" jsonb NOT NULL,
	"execution_digest" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_execution_digest_hex" CHECK ("coordination_runtime_executions"."execution_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_idempotency" (
	"scope" varchar NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"payload_digest" varchar(64) NOT NULL,
	"result_kind" varchar NOT NULL,
	"result_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_idempotency_payload_digest_hex" CHECK ("coordination_runtime_idempotency"."payload_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_inbox_window_items" (
	"window_id" varchar,
	"item_id" varchar NOT NULL,
	"event_id" varchar NOT NULL,
	"thread_id" varchar NOT NULL,
	"task_id" varchar NOT NULL,
	"sequence" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"item_digest" varchar(64) NOT NULL,
	CONSTRAINT "coord_runtime_window_item_digest" CHECK ("coordination_runtime_inbox_window_items"."item_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_window_item_sequence_positive" CHECK ("coordination_runtime_inbox_window_items"."sequence" > 0)
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_inbox_windows" (
	"id" varchar PRIMARY KEY NOT NULL,
	"thread_id" varchar NOT NULL,
	"after_exclusive" integer NOT NULL,
	"through_inclusive" integer NOT NULL,
	"boundary_token" text NOT NULL,
	"ordered_item_ids" text[] NOT NULL,
	"boundary_digest" varchar(64) NOT NULL,
	"canonical_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_window_bounds" CHECK (after_exclusive < through_inclusive),
	CONSTRAINT "coord_runtime_window_digest_hex" CHECK ("coordination_runtime_inbox_windows"."boundary_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_window_item_ids_nonempty" CHECK (cardinality("coordination_runtime_inbox_windows"."ordered_item_ids") > 0)
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_interactions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"packet_id" varchar NOT NULL,
	"assignment_event_id" varchar NOT NULL,
	"assignment_task_id" varchar NOT NULL,
	"profile_id" varchar NOT NULL,
	"runtime_registration_id" varchar NOT NULL,
	"credential_id" varchar NOT NULL,
	"turn" integer NOT NULL,
	"attempt" integer NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	"response_digest" varchar(64) NOT NULL,
	"outcome" varchar(40) NOT NULL,
	"retry_lineage" varchar,
	"canonical_payload" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "coord_runtime_interaction_digests_hex" CHECK ("coordination_runtime_interactions"."request_digest" ~ '^[0-9a-f]{64}$' AND "coordination_runtime_interactions"."response_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_interaction_turn_attempt_bounds" CHECK ("coordination_runtime_interactions"."turn" BETWEEN 1 AND 4 AND "coordination_runtime_interactions"."attempt" BETWEEN 1 AND 2),
	CONSTRAINT "coord_runtime_interaction_outcome_allowed" CHECK ("coordination_runtime_interactions"."outcome" IN (
    'consumed', 'safety_blocked', 'refused', 'context_limit', 'interrupted',
    'empty_response', 'malformed_function_call', 'unsupported_provider_outcome',
    'retryable_provider_error', 'terminal_provider_error'
  ))
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_packets" (
	"id" varchar PRIMARY KEY NOT NULL,
	"profile_id" varchar NOT NULL,
	"runtime_registration_id" varchar NOT NULL,
	"version" integer NOT NULL,
	"assignment_event_id" varchar NOT NULL,
	"assignment_task_id" varchar NOT NULL,
	"assignment_thread_id" varchar NOT NULL,
	"assignment_author" varchar NOT NULL,
	"expected_sequence" integer NOT NULL,
	"supersedes_claim_id" varchar,
	"window_id" varchar NOT NULL,
	"window_digest" varchar(64) NOT NULL,
	"ordered_inbox_item_ids" text[] NOT NULL,
	"ordered_event_ids" text[] NOT NULL,
	"ordered_thread_ids" text[] NOT NULL,
	"inherited_payload" jsonb NOT NULL,
	"envelope" jsonb NOT NULL,
	"canonical_payload" jsonb NOT NULL,
	"digest" varchar(64) NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "coord_runtime_packet_digest_hex" CHECK ("coordination_runtime_packets"."digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_packet_window_digest_hex" CHECK ("coordination_runtime_packets"."window_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_packet_version_positive" CHECK ("coordination_runtime_packets"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_profiles" (
	"id" varchar PRIMARY KEY NOT NULL,
	"runtime_registration_id" varchar NOT NULL,
	"actor" varchar(80) NOT NULL,
	"capabilities" text[] NOT NULL,
	"provider" varchar(80) NOT NULL,
	"model" varchar(160) NOT NULL,
	"adapter_version" varchar(80) NOT NULL,
	"repository_label" varchar(160) NOT NULL,
	"worktree_label" varchar(160) NOT NULL,
	"worktree_realpath_digest" varchar(64) NOT NULL,
	"branch" varchar(255) NOT NULL,
	"starting_commit" varchar(64) NOT NULL,
	"status" "coordination_runtime_profile_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_profile_worktree_digest_hex" CHECK ("coordination_runtime_profiles"."worktree_realpath_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_profile_starting_commit_hex" CHECK ("coordination_runtime_profiles"."starting_commit" ~ '^[0-9a-f]{40}$|^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_receipts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"packet_id" varchar NOT NULL,
	"interaction_id" varchar NOT NULL,
	"runtime_registration_id" varchar NOT NULL,
	"profile_id" varchar NOT NULL,
	"packet_digest" varchar(64) NOT NULL,
	"outcome" varchar(40) NOT NULL,
	"canonical_envelope" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	CONSTRAINT "coord_runtime_receipt_packet_digest_hex" CHECK ("coordination_runtime_receipts"."packet_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_receipt_outcome_allowed" CHECK ("coordination_runtime_receipts"."outcome" IN (
    'consumed', 'safety_blocked', 'refused', 'context_limit', 'interrupted',
    'empty_response', 'malformed_function_call', 'unsupported_provider_outcome',
    'retryable_provider_error', 'terminal_provider_error'
  ))
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_verifications" (
	"id" varchar PRIMARY KEY NOT NULL,
	"completion_id" varchar NOT NULL,
	"verifier_actor" varchar NOT NULL,
	"verifier_runtime_registration_id" varchar NOT NULL,
	"evidence_digest" varchar(64) NOT NULL,
	"patch_digest" varchar(64),
	"decision" varchar(20) NOT NULL,
	"canonical_payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_verification_evidence_digest_hex" CHECK ("coordination_runtime_verifications"."evidence_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_verification_actor_allowed" CHECK ("coordination_runtime_verifications"."verifier_actor" IN ('luca-replit', 'luca-claude-code')),
	CONSTRAINT "coord_runtime_verification_decision_approved" CHECK ("coordination_runtime_verifications"."decision" = 'approved'),
	CONSTRAINT "coord_runtime_verification_patch_digest_hex" CHECK ("coordination_runtime_verifications"."patch_digest" IS NULL OR "coordination_runtime_verifications"."patch_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_claim_id_epoch" ON "coordination_runtime_claims" USING btree ("id","epoch");
--> statement-breakpoint
ALTER TABLE "coordination_runtime_claim_events" ADD CONSTRAINT "coordination_runtime_claim_events_claim_id_coordination_runtime_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."coordination_runtime_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_claim_events" ADD CONSTRAINT "coordination_runtime_claim_events_prior_claim_id_coordination_runtime_claims_id_fk" FOREIGN KEY ("prior_claim_id") REFERENCES "public"."coordination_runtime_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_claims" ADD CONSTRAINT "coordination_runtime_claims_thread_id_coordination_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."coordination_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_claims" ADD CONSTRAINT "coordination_runtime_claims_packet_id_coordination_runtime_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."coordination_runtime_packets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_claims" ADD CONSTRAINT "coordination_runtime_claims_runtime_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("runtime_registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_claims" ADD CONSTRAINT "coordination_runtime_claims_profile_id_coordination_runtime_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."coordination_runtime_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_claims" ADD CONSTRAINT "coordination_runtime_claims_credential_id_coordination_runtime_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."coordination_runtime_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_claims" ADD CONSTRAINT "coordination_runtime_claims_prior_claim_id_coordination_runtime_claims_id_fk" FOREIGN KEY ("prior_claim_id") REFERENCES "public"."coordination_runtime_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_completions" ADD CONSTRAINT "coordination_runtime_completions_execution_id_coordination_runtime_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."coordination_runtime_executions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_completions" ADD CONSTRAINT "coordination_runtime_completions_claim_id_coordination_runtime_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."coordination_runtime_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_completions" ADD CONSTRAINT "fk_coord_runtime_completion_claim_epoch" FOREIGN KEY ("claim_id","claim_epoch") REFERENCES "public"."coordination_runtime_claims"("id","epoch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_executions" ADD CONSTRAINT "coordination_runtime_executions_claim_id_coordination_runtime_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."coordination_runtime_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_executions" ADD CONSTRAINT "coordination_runtime_executions_runtime_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("runtime_registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_executions" ADD CONSTRAINT "coordination_runtime_executions_profile_id_coordination_runtime_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."coordination_runtime_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_executions" ADD CONSTRAINT "coordination_runtime_executions_credential_id_coordination_runtime_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."coordination_runtime_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_executions" ADD CONSTRAINT "fk_coord_runtime_execution_claim_epoch" FOREIGN KEY ("claim_id","claim_epoch") REFERENCES "public"."coordination_runtime_claims"("id","epoch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_inbox_window_items" ADD CONSTRAINT "coordination_runtime_inbox_window_items_thread_id_coordination_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."coordination_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_inbox_windows" ADD CONSTRAINT "coordination_runtime_inbox_windows_thread_id_coordination_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."coordination_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_interactions" ADD CONSTRAINT "coordination_runtime_interactions_packet_id_coordination_runtime_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."coordination_runtime_packets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_interactions" ADD CONSTRAINT "coordination_runtime_interactions_profile_id_coordination_runtime_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."coordination_runtime_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_interactions" ADD CONSTRAINT "coordination_runtime_interactions_runtime_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("runtime_registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_interactions" ADD CONSTRAINT "coordination_runtime_interactions_credential_id_coordination_runtime_credentials_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."coordination_runtime_credentials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_interactions" ADD CONSTRAINT "coordination_runtime_interactions_retry_lineage_coordination_runtime_interactions_id_fk" FOREIGN KEY ("retry_lineage") REFERENCES "public"."coordination_runtime_interactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_packets" ADD CONSTRAINT "coordination_runtime_packets_profile_id_coordination_runtime_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."coordination_runtime_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_packets" ADD CONSTRAINT "coordination_runtime_packets_runtime_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("runtime_registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_packets" ADD CONSTRAINT "coordination_runtime_packets_assignment_thread_id_coordination_threads_id_fk" FOREIGN KEY ("assignment_thread_id") REFERENCES "public"."coordination_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_packets" ADD CONSTRAINT "coordination_runtime_packets_window_id_coordination_runtime_inbox_windows_id_fk" FOREIGN KEY ("window_id") REFERENCES "public"."coordination_runtime_inbox_windows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_profiles" ADD CONSTRAINT "coordination_runtime_profiles_runtime_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("runtime_registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_receipts" ADD CONSTRAINT "coordination_runtime_receipts_packet_id_coordination_runtime_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."coordination_runtime_packets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_receipts" ADD CONSTRAINT "coordination_runtime_receipts_interaction_id_coordination_runtime_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."coordination_runtime_interactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_receipts" ADD CONSTRAINT "coordination_runtime_receipts_runtime_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("runtime_registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_receipts" ADD CONSTRAINT "coordination_runtime_receipts_profile_id_coordination_runtime_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."coordination_runtime_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_verifications" ADD CONSTRAINT "coordination_runtime_verifications_completion_id_coordination_runtime_completions_id_fk" FOREIGN KEY ("completion_id") REFERENCES "public"."coordination_runtime_completions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_verifications" ADD CONSTRAINT "coordination_runtime_verifications_verifier_runtime_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("verifier_runtime_registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_coord_runtime_claim_events_claim" ON "coordination_runtime_claim_events" USING btree ("claim_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_claim_active_thread" ON "coordination_runtime_claims" USING btree ("thread_id") WHERE status = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_claim_thread_epoch" ON "coordination_runtime_claims" USING btree ("thread_id","epoch");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_completion_execution" ON "coordination_runtime_completions" USING btree ("execution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_execution_claim_epoch" ON "coordination_runtime_executions" USING btree ("claim_id","claim_epoch");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_idempotency_scope_key" ON "coordination_runtime_idempotency" USING btree ("scope","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_window_item" ON "coordination_runtime_inbox_window_items" USING btree ("window_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_window_sequence" ON "coordination_runtime_inbox_window_items" USING btree ("window_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_source_item" ON "coordination_runtime_inbox_window_items" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_window_boundary" ON "coordination_runtime_inbox_windows" USING btree ("thread_id","through_inclusive","boundary_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_interaction_packet_slot" ON "coordination_runtime_interactions" USING btree ("packet_id","turn","attempt");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_interaction_assignment_slot" ON "coordination_runtime_interactions" USING btree ("assignment_event_id","assignment_task_id","turn","attempt");--> statement-breakpoint
CREATE INDEX "idx_coord_runtime_interactions_packet" ON "coordination_runtime_interactions" USING btree ("packet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_packet_assignment_version" ON "coordination_runtime_packets" USING btree ("assignment_event_id","version");--> statement-breakpoint
CREATE INDEX "idx_coord_runtime_packets_thread" ON "coordination_runtime_packets" USING btree ("assignment_thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_profiles_active_registration" ON "coordination_runtime_profiles" USING btree ("runtime_registration_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "idx_coord_runtime_profiles_actor" ON "coordination_runtime_profiles" USING btree ("actor");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_receipt_runtime_packet" ON "coordination_runtime_receipts" USING btree ("runtime_registration_id","packet_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_verification_completion" ON "coordination_runtime_verifications" USING btree ("completion_id");
--> statement-breakpoint
ALTER TABLE "coordination_runtime_packets"
  ADD CONSTRAINT "coordination_runtime_packets_supersedes_claim_id_fk"
  FOREIGN KEY ("supersedes_claim_id")
  REFERENCES "coordination_runtime_claims"("id")
  ON DELETE RESTRICT;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_coordination_runtime_profile_identity"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM coordination_runtime_registrations registration
    WHERE registration.id = NEW.runtime_registration_id
      AND registration.actor = NEW.actor
  ) THEN
    RAISE EXCEPTION 'runtime profile identity does not match registration'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_profiles_identity_guard"
BEFORE INSERT ON "coordination_runtime_profiles"
FOR EACH ROW EXECUTE FUNCTION "enforce_coordination_runtime_profile_identity"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_coordination_runtime_packet_chain"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM coordination_runtime_profiles profile
    JOIN coordination_runtime_inbox_windows frozen_window ON frozen_window.id = NEW.window_id
    WHERE profile.id = NEW.profile_id
      AND profile.runtime_registration_id = NEW.runtime_registration_id
      AND profile.actor = 'luca-gemini'
      AND profile.status = 'active'
      AND frozen_window.thread_id = NEW.assignment_thread_id
      AND frozen_window.boundary_digest = NEW.window_digest
  ) THEN
    RAISE EXCEPTION 'runtime packet identity or frozen window mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF (NEW.version = 1) <> (NEW.supersedes_claim_id IS NULL) THEN
    RAISE EXCEPTION 'runtime packet supersession/version mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.supersedes_claim_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM coordination_runtime_claims claim
    WHERE claim.id = NEW.supersedes_claim_id
      AND claim.thread_id = NEW.assignment_thread_id
      AND claim.status IN ('expired', 'violated')
      AND claim.terminal_at IS NOT NULL
      AND NEW.created_at >= claim.terminal_at
  ) THEN
    RAISE EXCEPTION 'runtime packet does not supersede terminal work'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_packets_chain_guard"
BEFORE INSERT ON "coordination_runtime_packets"
FOR EACH ROW EXECUTE FUNCTION "enforce_coordination_runtime_packet_chain"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_coordination_runtime_interaction_chain"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM coordination_runtime_packets packet
    JOIN coordination_runtime_credentials credential ON credential.id = NEW.credential_id
    WHERE packet.id = NEW.packet_id
      AND packet.assignment_event_id = NEW.assignment_event_id
      AND packet.assignment_task_id = NEW.assignment_task_id
      AND packet.profile_id = NEW.profile_id
      AND packet.runtime_registration_id = NEW.runtime_registration_id
      AND credential.runtime_id = NEW.runtime_registration_id
      AND credential.actor = 'luca-gemini'
  ) THEN
    RAISE EXCEPTION 'runtime interaction authority chain mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.attempt = 2 AND NOT EXISTS (
    SELECT 1
    FROM coordination_runtime_interactions prior
    WHERE prior.id = NEW.retry_lineage
      AND prior.assignment_event_id = NEW.assignment_event_id
      AND prior.assignment_task_id = NEW.assignment_task_id
      AND prior.turn = NEW.turn
      AND prior.attempt = 1
      AND prior.outcome = 'retryable_provider_error'
  ) THEN
    RAISE EXCEPTION 'runtime interaction retry lineage mismatch'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.attempt = 1 AND NEW.retry_lineage IS NOT NULL THEN
    RAISE EXCEPTION 'first runtime interaction attempt cannot have retry lineage'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_interactions_chain_guard"
BEFORE INSERT ON "coordination_runtime_interactions"
FOR EACH ROW EXECUTE FUNCTION "enforce_coordination_runtime_interaction_chain"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_coordination_runtime_receipt_chain"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM coordination_runtime_packets packet
    JOIN coordination_runtime_interactions interaction ON interaction.id = NEW.interaction_id
    WHERE packet.id = NEW.packet_id
      AND packet.digest = NEW.packet_digest
      AND packet.runtime_registration_id = NEW.runtime_registration_id
      AND packet.profile_id = NEW.profile_id
      AND interaction.packet_id = NEW.packet_id
      AND interaction.runtime_registration_id = NEW.runtime_registration_id
      AND interaction.profile_id = NEW.profile_id
      AND interaction.outcome = NEW.outcome
  ) THEN
    RAISE EXCEPTION 'runtime receipt evidence chain mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_receipts_chain_guard"
BEFORE INSERT ON "coordination_runtime_receipts"
FOR EACH ROW EXECUTE FUNCTION "enforce_coordination_runtime_receipt_chain"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_coordination_runtime_claim_chain"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM coordination_runtime_packets packet
      JOIN coordination_runtime_receipts receipt ON receipt.packet_id = packet.id
      JOIN coordination_runtime_credentials credential ON credential.id = NEW.credential_id
      WHERE packet.id = NEW.packet_id
        AND packet.assignment_thread_id = NEW.thread_id
        AND packet.runtime_registration_id = NEW.runtime_registration_id
        AND packet.profile_id = NEW.profile_id
        AND receipt.runtime_registration_id = NEW.runtime_registration_id
        AND receipt.profile_id = NEW.profile_id
        AND receipt.packet_digest = packet.digest
        AND receipt.outcome = 'consumed'
        AND credential.runtime_id = NEW.runtime_registration_id
        AND credential.actor = 'luca-gemini'
    ) THEN
      RAISE EXCEPTION 'runtime claim authority chain mismatch'
        USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF ROW(NEW.id, NEW.thread_id, NEW.packet_id, NEW.runtime_registration_id,
         NEW.profile_id, NEW.prior_claim_id, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.thread_id, OLD.packet_id, OLD.runtime_registration_id,
         OLD.profile_id, OLD.prior_claim_id, OLD.created_at) THEN
    RAISE EXCEPTION 'runtime claim immutable identity changed'
      USING ERRCODE = '23514';
  END IF;
  IF OLD.status <> 'active' THEN
    RAISE EXCEPTION 'terminal runtime claim cannot be mutated'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.status = 'active' THEN
    IF NEW.epoch <> OLD.epoch + 1
       OR NEW.expires_at < OLD.expires_at
       OR NEW.terminal_at IS NOT NULL THEN
      RAISE EXCEPTION 'invalid runtime claim renewal'
        USING ERRCODE = '23514';
    END IF;
  ELSE
    IF NEW.epoch <> OLD.epoch
       OR NEW.expires_at <> OLD.expires_at
       OR NEW.terminal_at IS NULL THEN
      RAISE EXCEPTION 'invalid runtime claim terminal transition'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_claims_chain_guard"
BEFORE INSERT OR UPDATE ON "coordination_runtime_claims"
FOR EACH ROW EXECUTE FUNCTION "enforce_coordination_runtime_claim_chain"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_coordination_runtime_execution_chain"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM coordination_runtime_claims claim
    WHERE claim.id = NEW.claim_id
      AND claim.epoch = NEW.claim_epoch
      AND claim.runtime_registration_id = NEW.runtime_registration_id
      AND claim.profile_id = NEW.profile_id
      AND claim.credential_id = NEW.credential_id
      AND claim.status = 'active'
  ) THEN
    RAISE EXCEPTION 'runtime execution authority chain mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_executions_chain_guard"
BEFORE INSERT ON "coordination_runtime_executions"
FOR EACH ROW EXECUTE FUNCTION "enforce_coordination_runtime_execution_chain"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_coordination_runtime_completion_chain"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM coordination_runtime_executions execution
    JOIN coordination_runtime_claims claim ON claim.id = execution.claim_id
    WHERE execution.id = NEW.execution_id
      AND execution.claim_id = NEW.claim_id
      AND execution.claim_epoch = NEW.claim_epoch
      AND claim.status = 'completed'
      AND claim.epoch = NEW.claim_epoch
  ) THEN
    RAISE EXCEPTION 'runtime completion authority chain mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_completions_chain_guard"
BEFORE INSERT ON "coordination_runtime_completions"
FOR EACH ROW EXECUTE FUNCTION "enforce_coordination_runtime_completion_chain"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_coordination_runtime_verification_chain"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM coordination_runtime_completions completion
    JOIN coordination_runtime_claims claim ON claim.id = completion.claim_id
    JOIN coordination_runtime_packets packet ON packet.id = claim.packet_id
    JOIN coordination_runtime_registrations verifier
      ON verifier.id = NEW.verifier_runtime_registration_id
    WHERE completion.id = NEW.completion_id
      AND completion.evidence_digest = NEW.evidence_digest
      AND verifier.actor = NEW.verifier_actor
      AND NEW.verifier_actor <> 'luca-gemini'
      AND NEW.verifier_actor <> packet.assignment_author
  ) THEN
    RAISE EXCEPTION 'runtime verification authority chain mismatch'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_verifications_chain_guard"
BEFORE INSERT ON "coordination_runtime_verifications"
FOR EACH ROW EXECUTE FUNCTION "enforce_coordination_runtime_verification_chain"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "reject_coordination_runtime_evidence_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'coordination runtime evidence is immutable: % on %', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_claim_events_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_claim_events"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_completions_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_completions"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_executions_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_executions"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_idempotency_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_idempotency"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_inbox_windows_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_inbox_windows"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_interactions_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_interactions"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_packets_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_packets"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_receipts_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_receipts"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_verifications_immutable"
BEFORE UPDATE OR DELETE ON "coordination_runtime_verifications"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_runtime_evidence_mutation"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "enforce_coordination_runtime_window_item_freeze"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'coordination runtime inbox evidence cannot be deleted'
      USING ERRCODE = '23514';
  END IF;
  IF OLD.window_id = '__open__'
     AND NEW.window_id <> '__open__'
     AND (to_jsonb(NEW) - 'window_id') = (to_jsonb(OLD) - 'window_id') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'coordination runtime frozen inbox evidence is immutable'
    USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_runtime_inbox_window_items_freeze_guard"
BEFORE UPDATE OR DELETE ON "coordination_runtime_inbox_window_items"
FOR EACH ROW EXECUTE FUNCTION "enforce_coordination_runtime_window_item_freeze"();