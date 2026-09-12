CREATE TABLE "coordination_v2_attempt_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" varchar NOT NULL,
	"sequence" integer NOT NULL,
	"from_state" varchar(32),
	"to_state" varchar(32) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_type" varchar(32) NOT NULL,
	"actor_id" varchar(128) NOT NULL,
	"failure_classification" varchar(40),
	"result_code" varchar(128),
	"evidence_ref" varchar(255),
	"request_key" varchar(128),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_attempt_event_sequence" CHECK ("coordination_v2_attempt_events"."sequence" > 0),
	CONSTRAINT "coordination_v2_attempt_event_type_nonblank" CHECK (length(trim("coordination_v2_attempt_events"."event_type")) > 0),
	CONSTRAINT "coordination_v2_attempt_event_actor_nonblank" CHECK (length(trim("coordination_v2_attempt_events"."actor_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"attempt_generation" varchar(128) NOT NULL,
	"provider" varchar(80) NOT NULL,
	"model" varchar(160) NOT NULL,
	"adapter_version" varchar(80) NOT NULL,
	"session_ordinal" integer NOT NULL,
	"provider_ordinal" integer NOT NULL,
	"previous_attempt_id" varchar,
	"packet_id" varchar,
	"execution_id" varchar,
	"state" varchar(32) DEFAULT 'created' NOT NULL,
	"failure_classification" varchar(40),
	"result_code" varchar(128),
	"attempt_digest" varchar(64) NOT NULL,
	"deadline_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"terminal_at" timestamp,
	CONSTRAINT "coordination_v2_attempt_ordinals" CHECK ("coordination_v2_attempts"."session_ordinal" > 0 AND "coordination_v2_attempts"."provider_ordinal" > 0),
	CONSTRAINT "coordination_v2_attempt_provider_nonblank" CHECK (length(trim("coordination_v2_attempts"."provider")) > 0),
	CONSTRAINT "coordination_v2_attempt_model_nonblank" CHECK (length(trim("coordination_v2_attempts"."model")) > 0),
	CONSTRAINT "coordination_v2_attempt_adapter_nonblank" CHECK (length(trim("coordination_v2_attempts"."adapter_version")) > 0),
	CONSTRAINT "coordination_v2_attempt_digest" CHECK ("coordination_v2_attempts"."attempt_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_attempt_deadline" CHECK ("coordination_v2_attempts"."deadline_at" > "coordination_v2_attempts"."created_at"),
	CONSTRAINT "coordination_v2_attempt_state" CHECK (
    "coordination_v2_attempts"."state" IN (
      'created', 'provider_active', 'intent_ready', 'waiting_for_host',
      'host_active', 'result_ready', 'provider_continuation', 'completed',
      'retryable_failed', 'terminal_failed', 'cancelled'
    )
  ),
	CONSTRAINT "coordination_v2_attempt_failure_classification" CHECK (
    "coordination_v2_attempts"."failure_classification" IS NULL OR "coordination_v2_attempts"."failure_classification" IN (
      'resume_transport', 'fresh_attempt_same_provider', 'fresh_attempt_next_provider',
      'terminal_failure', 'terminal_success', 'cleanup_repair'
    )
  ),
	CONSTRAINT "coordination_v2_attempt_lifecycle" CHECK (
    (
      "coordination_v2_attempts"."state" IN ('completed', 'retryable_failed', 'terminal_failed', 'cancelled')
      AND "coordination_v2_attempts"."terminal_at" IS NOT NULL AND "coordination_v2_attempts"."result_code" IS NOT NULL
    )
    OR (
      "coordination_v2_attempts"."state" IN (
        'created', 'provider_active', 'intent_ready', 'waiting_for_host',
        'host_active', 'result_ready', 'provider_continuation'
      )
      AND "coordination_v2_attempts"."terminal_at" IS NULL AND "coordination_v2_attempts"."result_code" IS NULL
    )
  )
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_cleanup_acknowledgements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"obligation_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"enrolled_host_id" varchar,
	"acknowledgement_key" varchar(128) NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"evidence_digest" varchar(64),
	"safe_message" text,
	"error_code" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_cleanup_ack_outcome" CHECK ("coordination_v2_cleanup_acknowledgements"."outcome" IN ('acknowledged', 'rejected')),
	CONSTRAINT "coordination_v2_cleanup_ack_digest" CHECK (
    "coordination_v2_cleanup_acknowledgements"."evidence_digest" IS NULL OR "coordination_v2_cleanup_acknowledgements"."evidence_digest" ~ '^[0-9a-f]{64}$'
  ),
	CONSTRAINT "coordination_v2_cleanup_ack_lifecycle" CHECK (
    ("coordination_v2_cleanup_acknowledgements"."outcome" = 'acknowledged' AND "coordination_v2_cleanup_acknowledgements"."evidence_digest" IS NOT NULL AND "coordination_v2_cleanup_acknowledgements"."error_code" IS NULL)
    OR ("coordination_v2_cleanup_acknowledgements"."outcome" = 'rejected' AND "coordination_v2_cleanup_acknowledgements"."error_code" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_cleanup_obligations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"kind" varchar(64) NOT NULL,
	"state" varchar(24) DEFAULT 'pending' NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"deadline_at" timestamp,
	"completed_at" timestamp,
	"last_error_code" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_cleanup_kind_value" CHECK (
    "coordination_v2_cleanup_obligations"."kind" IN ('revoke_authority', 'release_lease', 'cleanup_generation', 'revoke_credentials')
  ),
	CONSTRAINT "coordination_v2_cleanup_state_value" CHECK (
    "coordination_v2_cleanup_obligations"."state" IN ('pending', 'in_progress', 'acknowledged', 'repair_required')
  ),
	CONSTRAINT "coordination_v2_cleanup_attempt_count" CHECK ("coordination_v2_cleanup_obligations"."attempt_count" >= 0),
	CONSTRAINT "coordination_v2_cleanup_deadline" CHECK (
    "coordination_v2_cleanup_obligations"."deadline_at" IS NULL OR "coordination_v2_cleanup_obligations"."deadline_at" >= "coordination_v2_cleanup_obligations"."requested_at"
  ),
	CONSTRAINT "coordination_v2_cleanup_lifecycle" CHECK (
    ("coordination_v2_cleanup_obligations"."state" = 'acknowledged' AND "coordination_v2_cleanup_obligations"."completed_at" IS NOT NULL)
    OR ("coordination_v2_cleanup_obligations"."state" <> 'acknowledged' AND "coordination_v2_cleanup_obligations"."completed_at" IS NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_founder_decisions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_version_id" varchar NOT NULL,
	"decision" varchar(16) NOT NULL,
	"founder_actor" varchar(128) NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"policy_digest" varchar(64) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_founder_decision_value" CHECK ("coordination_v2_founder_decisions"."decision" IN ('approved', 'rejected', 'revoked')),
	CONSTRAINT "coordination_v2_founder_actor_nonblank" CHECK (length(trim("coordination_v2_founder_decisions"."founder_actor")) > 0),
	CONSTRAINT "coordination_v2_founder_request_nonblank" CHECK (length(trim("coordination_v2_founder_decisions"."request_key")) > 0),
	CONSTRAINT "coordination_v2_founder_policy_digest" CHECK ("coordination_v2_founder_decisions"."policy_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_host_enrollments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_key" varchar(128) NOT NULL,
	"host_type" varchar(40) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"protocol_version" integer NOT NULL,
	"public_key" text NOT NULL,
	"key_fingerprint" varchar(64) NOT NULL,
	"capabilities" text[] NOT NULL,
	"enrollment_digest" varchar(64) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_by" varchar(128) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "coordination_v2_host_key_nonblank" CHECK (length(trim("coordination_v2_host_enrollments"."host_key")) > 0),
	CONSTRAINT "coordination_v2_host_type_nonblank" CHECK (length(trim("coordination_v2_host_enrollments"."host_type")) > 0),
	CONSTRAINT "coordination_v2_host_name_nonblank" CHECK (length(trim("coordination_v2_host_enrollments"."display_name")) > 0),
	CONSTRAINT "coordination_v2_host_protocol_version" CHECK ("coordination_v2_host_enrollments"."protocol_version" > 0),
	CONSTRAINT "coordination_v2_host_fingerprint" CHECK ("coordination_v2_host_enrollments"."key_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_digest" CHECK ("coordination_v2_host_enrollments"."enrollment_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_host_status_value" CHECK ("coordination_v2_host_enrollments"."status" IN ('active', 'revoked')),
	CONSTRAINT "coordination_v2_host_lifecycle" CHECK (
    ("coordination_v2_host_enrollments"."status" = 'active' AND "coordination_v2_host_enrollments"."revoked_at" IS NULL)
    OR ("coordination_v2_host_enrollments"."status" = 'revoked' AND "coordination_v2_host_enrollments"."revoked_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_operator_grants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_identity_id" varchar NOT NULL,
	"operator_actor" varchar(128) NOT NULL,
	"min_version" integer,
	"max_version" integer,
	"actions" text[] NOT NULL,
	"issued_by" varchar(128) NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"grant_digest" varchar(64) NOT NULL,
	"request_key" varchar(128) NOT NULL,
	CONSTRAINT "coordination_v2_operator_actor_nonblank" CHECK (length(trim("coordination_v2_operator_grants"."operator_actor")) > 0),
	CONSTRAINT "coordination_v2_operator_grant_versions" CHECK (
    ("coordination_v2_operator_grants"."min_version" IS NULL OR "coordination_v2_operator_grants"."min_version" > 0)
    AND ("coordination_v2_operator_grants"."max_version" IS NULL OR "coordination_v2_operator_grants"."max_version" > 0)
    AND ("coordination_v2_operator_grants"."min_version" IS NULL OR "coordination_v2_operator_grants"."max_version" IS NULL OR "coordination_v2_operator_grants"."min_version" <= "coordination_v2_operator_grants"."max_version")
  ),
	CONSTRAINT "coordination_v2_operator_grant_digest" CHECK ("coordination_v2_operator_grants"."grant_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_operator_grant_lifecycle" CHECK (
    "coordination_v2_operator_grants"."expires_at" > "coordination_v2_operator_grants"."issued_at"
    AND ("coordination_v2_operator_grants"."revoked_at" IS NULL OR "coordination_v2_operator_grants"."revoked_at" >= "coordination_v2_operator_grants"."issued_at")
  )
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_policy_identities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_key" varchar(128) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"description" text,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"created_by" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "coordination_v2_policy_key_nonblank" CHECK (length(trim("coordination_v2_policy_identities"."policy_key")) > 0),
	CONSTRAINT "coordination_v2_policy_name_nonblank" CHECK (length(trim("coordination_v2_policy_identities"."display_name")) > 0),
	CONSTRAINT "coordination_v2_policy_identity_status" CHECK ("coordination_v2_policy_identities"."status" IN ('active', 'revoked')),
	CONSTRAINT "coordination_v2_policy_identity_lifecycle" CHECK (
    ("coordination_v2_policy_identities"."status" = 'active' AND "coordination_v2_policy_identities"."revoked_at" IS NULL)
    OR ("coordination_v2_policy_identities"."status" = 'revoked' AND "coordination_v2_policy_identities"."revoked_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_policy_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_identity_id" varchar NOT NULL,
	"version" integer NOT NULL,
	"canonical_policy" jsonb NOT NULL,
	"policy_digest" varchar(64) NOT NULL,
	"approval_state" varchar(16) DEFAULT 'draft' NOT NULL,
	"created_by" varchar(128) NOT NULL,
	"approved_by" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"approved_at" timestamp,
	"revoked_at" timestamp,
	CONSTRAINT "coordination_v2_policy_version_positive" CHECK ("coordination_v2_policy_versions"."version" > 0),
	CONSTRAINT "coordination_v2_policy_version_digest" CHECK ("coordination_v2_policy_versions"."policy_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_policy_approval_state" CHECK (
    "coordination_v2_policy_versions"."approval_state" IN ('draft', 'approved', 'rejected', 'revoked')
  ),
	CONSTRAINT "coordination_v2_policy_version_lifecycle" CHECK (
    ("coordination_v2_policy_versions"."approval_state" = 'draft'
      AND "coordination_v2_policy_versions"."approved_at" IS NULL AND "coordination_v2_policy_versions"."approved_by" IS NULL AND "coordination_v2_policy_versions"."revoked_at" IS NULL)
    OR ("coordination_v2_policy_versions"."approval_state" = 'approved'
      AND "coordination_v2_policy_versions"."approved_at" IS NOT NULL AND "coordination_v2_policy_versions"."approved_by" IS NOT NULL AND "coordination_v2_policy_versions"."revoked_at" IS NULL)
    OR ("coordination_v2_policy_versions"."approval_state" = 'rejected'
      AND "coordination_v2_policy_versions"."approved_at" IS NULL AND "coordination_v2_policy_versions"."approved_by" IS NULL AND "coordination_v2_policy_versions"."revoked_at" IS NOT NULL)
    OR ("coordination_v2_policy_versions"."approval_state" = 'revoked'
      AND "coordination_v2_policy_versions"."approved_at" IS NOT NULL AND "coordination_v2_policy_versions"."approved_by" IS NOT NULL AND "coordination_v2_policy_versions"."revoked_at" IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_session_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"sequence" integer NOT NULL,
	"from_state" varchar(32),
	"to_state" varchar(32) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"actor_type" varchar(32) NOT NULL,
	"actor_id" varchar(128) NOT NULL,
	"reason_code" varchar(128),
	"safe_message" text,
	"evidence_ref" varchar(255),
	"request_key" varchar(128),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_session_event_sequence" CHECK ("coordination_v2_session_events"."sequence" > 0),
	CONSTRAINT "coordination_v2_session_event_type_nonblank" CHECK (length(trim("coordination_v2_session_events"."event_type")) > 0),
	CONSTRAINT "coordination_v2_session_event_actor_nonblank" CHECK (length(trim("coordination_v2_session_events"."actor_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_version_id" varchar NOT NULL,
	"operator_grant_id" varchar NOT NULL,
	"operator_actor" varchar(128) NOT NULL,
	"task_ref" varchar(128) NOT NULL,
	"task_artifact_sha256" varchar(64) NOT NULL,
	"repository_identity" varchar(255) NOT NULL,
	"starting_commit" varchar(64) NOT NULL,
	"enrolled_host_id" varchar NOT NULL,
	"requested_providers" text[] NOT NULL,
	"expires_at" timestamp NOT NULL,
	"attempt_budget" integer NOT NULL,
	"per_provider_budgets" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"required_validations" text[] NOT NULL,
	"completion_criteria" jsonb NOT NULL,
	"state" varchar(32) DEFAULT 'preparing' NOT NULL,
	"terminal_reason" varchar(128),
	"terminal_at" timestamp,
	"idempotency_key" varchar(128) NOT NULL,
	"session_digest" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_session_task_ref" CHECK ("coordination_v2_sessions"."task_ref" ~ '^[1-9][0-9]*$'),
	CONSTRAINT "coordination_v2_session_artifact_digest" CHECK ("coordination_v2_sessions"."task_artifact_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_session_starting_commit" CHECK ("coordination_v2_sessions"."starting_commit" ~ '^[0-9a-f]{40}$|^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_session_repository_nonblank" CHECK (length(trim("coordination_v2_sessions"."repository_identity")) > 0),
	CONSTRAINT "coordination_v2_session_attempt_budget" CHECK ("coordination_v2_sessions"."attempt_budget" > 0 AND "coordination_v2_sessions"."attempt_budget" <= 100),
	CONSTRAINT "coordination_v2_session_digest" CHECK ("coordination_v2_sessions"."session_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_session_state" CHECK (
    "coordination_v2_sessions"."state" IN (
      'preparing', 'ready', 'running', 'waiting_for_host', 'verifying',
      'succeeded', 'failed', 'exhausted', 'expired', 'revoked'
    )
  ),
	CONSTRAINT "coordination_v2_session_lifecycle" CHECK (
    (
      "coordination_v2_sessions"."state" IN ('succeeded', 'failed', 'exhausted', 'expired', 'revoked')
      AND "coordination_v2_sessions"."terminal_at" IS NOT NULL AND "coordination_v2_sessions"."terminal_reason" IS NOT NULL
    )
    OR (
      "coordination_v2_sessions"."state" IN ('preparing', 'ready', 'running', 'waiting_for_host', 'verifying')
      AND "coordination_v2_sessions"."terminal_at" IS NULL AND "coordination_v2_sessions"."terminal_reason" IS NULL
    )
  ),
	CONSTRAINT "coordination_v2_session_expiration" CHECK ("coordination_v2_sessions"."expires_at" > "coordination_v2_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_transport_leases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"enrolled_host_id" varchar NOT NULL,
	"holder_instance_id" varchar(128) NOT NULL,
	"epoch" integer NOT NULL,
	"predecessor_lease_id" varchar,
	"state" varchar(16) DEFAULT 'active' NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_lease_epoch_positive" CHECK ("coordination_v2_transport_leases"."epoch" > 0),
	CONSTRAINT "coordination_v2_lease_holder_nonblank" CHECK (length(trim("coordination_v2_transport_leases"."holder_instance_id")) > 0),
	CONSTRAINT "coordination_v2_lease_state" CHECK ("coordination_v2_transport_leases"."state" IN ('active', 'released', 'expired', 'superseded')),
	CONSTRAINT "coordination_v2_lease_expiration" CHECK ("coordination_v2_transport_leases"."expires_at" > "coordination_v2_transport_leases"."issued_at"),
	CONSTRAINT "coordination_v2_lease_lifecycle" CHECK (
    ("coordination_v2_transport_leases"."state" = 'active' AND "coordination_v2_transport_leases"."ended_at" IS NULL)
    OR ("coordination_v2_transport_leases"."state" IN ('released', 'expired', 'superseded') AND "coordination_v2_transport_leases"."ended_at" IS NOT NULL)
  )
);
--> statement-breakpoint
ALTER TABLE "coordination_v2_attempt_events" ADD CONSTRAINT "coordination_v2_attempt_events_attempt_id_coordination_v2_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."coordination_v2_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_attempts" ADD CONSTRAINT "coordination_v2_attempts_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_attempts" ADD CONSTRAINT "coordination_v2_attempts_previous_attempt_id_coordination_v2_attempts_id_fk" FOREIGN KEY ("previous_attempt_id") REFERENCES "public"."coordination_v2_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_attempts" ADD CONSTRAINT "coordination_v2_attempts_packet_id_coordination_runtime_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."coordination_runtime_packets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_attempts" ADD CONSTRAINT "coordination_v2_attempts_execution_id_coordination_runtime_executions_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."coordination_runtime_executions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "coordination_v2_cleanup_acknowledgements_obligation_id_coordination_v2_cleanup_obligations_id_fk" FOREIGN KEY ("obligation_id") REFERENCES "public"."coordination_v2_cleanup_obligations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "coordination_v2_cleanup_acknowledgements_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "coordination_v2_cleanup_acknowledgements_enrolled_host_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("enrolled_host_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_obligations" ADD CONSTRAINT "coordination_v2_cleanup_obligations_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_founder_decisions" ADD CONSTRAINT "coordination_v2_founder_decisions_policy_version_id_coordination_v2_policy_versions_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."coordination_v2_policy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_operator_grants" ADD CONSTRAINT "coordination_v2_operator_grants_policy_identity_id_coordination_v2_policy_identities_id_fk" FOREIGN KEY ("policy_identity_id") REFERENCES "public"."coordination_v2_policy_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_policy_versions" ADD CONSTRAINT "coordination_v2_policy_versions_policy_identity_id_coordination_v2_policy_identities_id_fk" FOREIGN KEY ("policy_identity_id") REFERENCES "public"."coordination_v2_policy_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_events" ADD CONSTRAINT "coordination_v2_session_events_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_sessions" ADD CONSTRAINT "coordination_v2_sessions_policy_version_id_coordination_v2_policy_versions_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."coordination_v2_policy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_sessions" ADD CONSTRAINT "coordination_v2_sessions_operator_grant_id_coordination_v2_operator_grants_id_fk" FOREIGN KEY ("operator_grant_id") REFERENCES "public"."coordination_v2_operator_grants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_sessions" ADD CONSTRAINT "coordination_v2_sessions_enrolled_host_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("enrolled_host_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_leases" ADD CONSTRAINT "coordination_v2_transport_leases_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_leases" ADD CONSTRAINT "coordination_v2_transport_leases_enrolled_host_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("enrolled_host_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_leases" ADD CONSTRAINT "coordination_v2_transport_leases_predecessor_lease_id_coordination_v2_transport_leases_id_fk" FOREIGN KEY ("predecessor_lease_id") REFERENCES "public"."coordination_v2_transport_leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_attempt_event_sequence" ON "coordination_v2_attempt_events" USING btree ("attempt_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_attempt_event_request" ON "coordination_v2_attempt_events" USING btree ("attempt_id","request_key") WHERE "coordination_v2_attempt_events"."request_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_attempt_event_created" ON "coordination_v2_attempt_events" USING btree ("attempt_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_attempt_generation" ON "coordination_v2_attempts" USING btree ("attempt_generation");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_attempt_session_ordinal" ON "coordination_v2_attempts" USING btree ("session_id","session_ordinal");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_attempt_provider_ordinal" ON "coordination_v2_attempts" USING btree ("session_id","provider","provider_ordinal");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_attempt_session_state" ON "coordination_v2_attempts" USING btree ("session_id","state");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_attempt_provider_state" ON "coordination_v2_attempts" USING btree ("provider","state");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_cleanup_ack" ON "coordination_v2_cleanup_acknowledgements" USING btree ("obligation_id","acknowledgement_key");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_cleanup_ack_session" ON "coordination_v2_cleanup_acknowledgements" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_cleanup_ack_obligation" ON "coordination_v2_cleanup_acknowledgements" USING btree ("obligation_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_cleanup_kind" ON "coordination_v2_cleanup_obligations" USING btree ("session_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_cleanup_request" ON "coordination_v2_cleanup_obligations" USING btree ("session_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_cleanup_state" ON "coordination_v2_cleanup_obligations" USING btree ("state","requested_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_founder_request" ON "coordination_v2_founder_decisions" USING btree ("policy_version_id","request_key");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_founder_decision" ON "coordination_v2_founder_decisions" USING btree ("policy_version_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_host_key" ON "coordination_v2_host_enrollments" USING btree ("host_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_host_fingerprint" ON "coordination_v2_host_enrollments" USING btree ("key_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_host_status" ON "coordination_v2_host_enrollments" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_operator_grant_request" ON "coordination_v2_operator_grants" USING btree ("policy_identity_id","operator_actor","request_key");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_operator_grant_actor" ON "coordination_v2_operator_grants" USING btree ("operator_actor","expires_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_operator_grant_policy" ON "coordination_v2_operator_grants" USING btree ("policy_identity_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_policy_key" ON "coordination_v2_policy_identities" USING btree ("policy_key");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_policy_status" ON "coordination_v2_policy_identities" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_policy_version" ON "coordination_v2_policy_versions" USING btree ("policy_identity_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_policy_digest" ON "coordination_v2_policy_versions" USING btree ("policy_identity_id","policy_digest");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_policy_version_state" ON "coordination_v2_policy_versions" USING btree ("policy_identity_id","approval_state");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_session_event_sequence" ON "coordination_v2_session_events" USING btree ("session_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_session_event_request" ON "coordination_v2_session_events" USING btree ("session_id","request_key") WHERE "coordination_v2_session_events"."request_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_session_event_created" ON "coordination_v2_session_events" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_session_request" ON "coordination_v2_sessions" USING btree ("operator_actor","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_session_digest" ON "coordination_v2_sessions" USING btree ("session_digest");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_session_policy_state" ON "coordination_v2_sessions" USING btree ("policy_version_id","state");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_session_host_state" ON "coordination_v2_sessions" USING btree ("enrolled_host_id","state");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_session_expiry" ON "coordination_v2_sessions" USING btree ("expires_at","state");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_lease_epoch" ON "coordination_v2_transport_leases" USING btree ("session_id","epoch");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_lease_active" ON "coordination_v2_transport_leases" USING btree ("session_id") WHERE "coordination_v2_transport_leases"."state" = 'active';--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_lease_holder" ON "coordination_v2_transport_leases" USING btree ("holder_instance_id","state");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_lease_expiry" ON "coordination_v2_transport_leases" USING btree ("session_id","expires_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "reject_coordination_v2_evidence_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Coordinator V2 evidence is immutable: % on %', TG_OP, TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_v2_founder_decisions_immutable"
BEFORE UPDATE OR DELETE ON "coordination_v2_founder_decisions"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_v2_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_v2_session_events_immutable"
BEFORE UPDATE OR DELETE ON "coordination_v2_session_events"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_v2_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_v2_attempt_events_immutable"
BEFORE UPDATE OR DELETE ON "coordination_v2_attempt_events"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_v2_evidence_mutation"();
--> statement-breakpoint
CREATE TRIGGER "coordination_v2_cleanup_acknowledgements_immutable"
BEFORE UPDATE OR DELETE ON "coordination_v2_cleanup_acknowledgements"
FOR EACH ROW EXECUTE FUNCTION "reject_coordination_v2_evidence_mutation"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "protect_coordination_v2_policy_version"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Coordinator V2 policy versions cannot be deleted'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."approval_state" <> 'draft' THEN
    RAISE EXCEPTION 'approved, rejected, and revoked Coordinator V2 policy versions are immutable'
      USING ERRCODE = '23514';
  END IF;

  IF NEW."policy_identity_id" IS DISTINCT FROM OLD."policy_identity_id"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."canonical_policy" IS DISTINCT FROM OLD."canonical_policy"
    OR NEW."policy_digest" IS DISTINCT FROM OLD."policy_digest"
    OR NEW."created_by" IS DISTINCT FROM OLD."created_by"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Coordinator V2 policy provenance is immutable'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_v2_policy_versions_protected"
BEFORE UPDATE OR DELETE ON "coordination_v2_policy_versions"
FOR EACH ROW EXECUTE FUNCTION "protect_coordination_v2_policy_version"();