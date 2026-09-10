CREATE TABLE "task_ownership_challenges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_ref" varchar(128) NOT NULL,
	"artifact_sha256" varchar(64) NOT NULL,
	"intended_actor" varchar(128) NOT NULL,
	"coordination_actor" varchar(128) NOT NULL,
	"public_key" text NOT NULL,
	"key_fingerprint" varchar(128) NOT NULL,
	"context_digest" varchar(128),
	"server_nonce" varchar(128) NOT NULL,
	"status" varchar(16) DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"decided_at" timestamp,
	"idempotency_key" varchar(128) NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	CONSTRAINT "task_ownership_challenge_task_ref" CHECK ("task_ownership_challenges"."task_ref" ~ '^[1-9][0-9]*$'),
	CONSTRAINT "task_ownership_challenge_artifact_sha256" CHECK ("task_ownership_challenges"."artifact_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "task_ownership_challenge_fingerprint_sha256" CHECK ("task_ownership_challenges"."key_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "task_ownership_challenge_context_digest" CHECK ("task_ownership_challenges"."context_digest" IS NULL OR "task_ownership_challenges"."context_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "task_ownership_challenge_request_digest" CHECK ("task_ownership_challenges"."request_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "task_ownership_challenge_actor_match" CHECK ("task_ownership_challenges"."intended_actor" = "task_ownership_challenges"."coordination_actor"),
	CONSTRAINT "task_ownership_challenge_status" CHECK ("task_ownership_challenges"."status" IN ('pending','approved','rejected','expired')),
	CONSTRAINT "task_ownership_challenge_lifecycle" CHECK ("task_ownership_challenges"."expires_at" > "task_ownership_challenges"."created_at" AND (("task_ownership_challenges"."status" = 'pending' AND "task_ownership_challenges"."decided_at" IS NULL) OR ("task_ownership_challenges"."status" <> 'pending' AND "task_ownership_challenges"."decided_at" IS NOT NULL)))
);
--> statement-breakpoint
CREATE TABLE "task_ownership_decision_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" varchar NOT NULL,
	"receipt_id" varchar,
	"decision" varchar(16) NOT NULL,
	"actor_id" varchar NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_ownership_decision_event_decision" CHECK ("task_ownership_decision_events"."decision" IN ('approved','rejected','revoked','expired')),
	CONSTRAINT "task_ownership_decision_event_actor" CHECK (length(trim("task_ownership_decision_events"."actor_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "task_ownership_proof_attempts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce_id" varchar NOT NULL,
	"receipt_id" varchar NOT NULL,
	"success" boolean NOT NULL,
	"error_code" varchar(64),
	"payload_digest" varchar(128),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_ownership_proof_attempt_outcome" CHECK (("task_ownership_proof_attempts"."success" AND "task_ownership_proof_attempts"."error_code" IS NULL) OR (NOT "task_ownership_proof_attempts"."success" AND "task_ownership_proof_attempts"."error_code" IS NOT NULL)),
	CONSTRAINT "task_ownership_proof_attempt_digest" CHECK ("task_ownership_proof_attempts"."payload_digest" IS NULL OR "task_ownership_proof_attempts"."payload_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "task_ownership_proof_nonces" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" varchar NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "task_ownership_proof_nonce_lifecycle" CHECK ("task_ownership_proof_nonces"."expires_at" > "task_ownership_proof_nonces"."created_at" AND ("task_ownership_proof_nonces"."consumed_at" IS NULL OR "task_ownership_proof_nonces"."consumed_at" >= "task_ownership_proof_nonces"."created_at"))
);
--> statement-breakpoint
CREATE TABLE "task_ownership_receipts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" varchar NOT NULL,
	"task_ref" varchar(128) NOT NULL,
	"artifact_sha256" varchar(64) NOT NULL,
	"intended_actor" varchar(128) NOT NULL,
	"public_key" text NOT NULL,
	"key_fingerprint" varchar(128) NOT NULL,
	"context_digest" varchar(128),
	"approved_by" varchar NOT NULL,
	"approved_at" timestamp DEFAULT now() NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"payload_digest" varchar(128) NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "task_ownership_receipt_task_ref" CHECK ("task_ownership_receipts"."task_ref" ~ '^[1-9][0-9]*$'),
	CONSTRAINT "task_ownership_receipt_artifact_sha256" CHECK ("task_ownership_receipts"."artifact_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "task_ownership_receipt_fingerprint_sha256" CHECK ("task_ownership_receipts"."key_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "task_ownership_receipt_context_digest" CHECK ("task_ownership_receipts"."context_digest" IS NULL OR "task_ownership_receipts"."context_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "task_ownership_receipt_payload_digest" CHECK ("task_ownership_receipts"."payload_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "task_ownership_receipt_version" CHECK ("task_ownership_receipts"."version" = 1),
	CONSTRAINT "task_ownership_receipt_status" CHECK ("task_ownership_receipts"."status" IN ('active','revoked','expired')),
	CONSTRAINT "task_ownership_receipt_lifecycle" CHECK ("task_ownership_receipts"."expires_at" > "task_ownership_receipts"."issued_at" AND (("task_ownership_receipts"."status" = 'active' AND "task_ownership_receipts"."revoked_at" IS NULL) OR ("task_ownership_receipts"."status" <> 'active' AND "task_ownership_receipts"."revoked_at" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "task_ownership_decision_events" ADD CONSTRAINT "task_ownership_decision_events_challenge_id_task_ownership_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."task_ownership_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_ownership_decision_events" ADD CONSTRAINT "task_ownership_decision_events_receipt_id_task_ownership_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."task_ownership_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_ownership_proof_attempts" ADD CONSTRAINT "task_ownership_proof_attempts_nonce_id_task_ownership_proof_nonces_id_fk" FOREIGN KEY ("nonce_id") REFERENCES "public"."task_ownership_proof_nonces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_ownership_proof_attempts" ADD CONSTRAINT "task_ownership_proof_attempts_receipt_id_task_ownership_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."task_ownership_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_ownership_proof_nonces" ADD CONSTRAINT "task_ownership_proof_nonces_receipt_id_task_ownership_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."task_ownership_receipts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_ownership_receipts" ADD CONSTRAINT "task_ownership_receipts_challenge_id_task_ownership_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."task_ownership_challenges"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_ownership_challenge_nonce" ON "task_ownership_challenges" USING btree ("server_nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_ownership_challenge_idempotency" ON "task_ownership_challenges" USING btree ("coordination_actor","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_task_ownership_challenge_status" ON "task_ownership_challenges" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_ownership_proof_nonce" ON "task_ownership_proof_nonces" USING btree ("nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_ownership_receipt_challenge" ON "task_ownership_receipts" USING btree ("challenge_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_task_ownership_active_task" ON "task_ownership_receipts" USING btree ("task_ref") WHERE "task_ownership_receipts"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_task_ownership_receipt_task" ON "task_ownership_receipts" USING btree ("task_ref","status");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION reject_task_ownership_evidence_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'task ownership evidence is immutable' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER task_ownership_decisions_immutable
BEFORE UPDATE OR DELETE ON task_ownership_decision_events
FOR EACH ROW EXECUTE FUNCTION reject_task_ownership_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER task_ownership_attempts_immutable
BEFORE UPDATE OR DELETE ON task_ownership_proof_attempts
FOR EACH ROW EXECUTE FUNCTION reject_task_ownership_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER task_ownership_challenges_no_delete
BEFORE DELETE ON task_ownership_challenges
FOR EACH ROW EXECUTE FUNCTION reject_task_ownership_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER task_ownership_receipts_no_delete
BEFORE DELETE ON task_ownership_receipts
FOR EACH ROW EXECUTE FUNCTION reject_task_ownership_evidence_mutation();
--> statement-breakpoint
CREATE TRIGGER task_ownership_nonces_no_delete
BEFORE DELETE ON task_ownership_proof_nonces
FOR EACH ROW EXECUTE FUNCTION reject_task_ownership_evidence_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_task_ownership_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'task_ownership_challenges' THEN
    IF OLD.status <> 'pending'
       OR NEW.status NOT IN ('approved', 'rejected', 'expired')
       OR NEW.decided_at IS NULL THEN
      RAISE EXCEPTION 'invalid task ownership challenge transition' USING ERRCODE = '23514';
    END IF;
    IF ROW(
      NEW.id, NEW.task_ref, NEW.artifact_sha256, NEW.intended_actor,
      NEW.coordination_actor, NEW.public_key, NEW.key_fingerprint,
      NEW.context_digest, NEW.server_nonce, NEW.expires_at, NEW.created_at,
      NEW.idempotency_key, NEW.request_digest
    ) IS DISTINCT FROM ROW(
      OLD.id, OLD.task_ref, OLD.artifact_sha256, OLD.intended_actor,
      OLD.coordination_actor, OLD.public_key, OLD.key_fingerprint,
      OLD.context_digest, OLD.server_nonce, OLD.expires_at, OLD.created_at,
      OLD.idempotency_key, OLD.request_digest
    ) THEN
      RAISE EXCEPTION 'task ownership challenge provenance is immutable' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'task_ownership_receipts' THEN
    IF OLD.status <> 'active'
       OR NEW.status NOT IN ('revoked', 'expired')
       OR NEW.revoked_at IS NULL THEN
      RAISE EXCEPTION 'invalid task ownership receipt transition' USING ERRCODE = '23514';
    END IF;
    IF ROW(
      NEW.id, NEW.challenge_id, NEW.task_ref, NEW.artifact_sha256,
      NEW.intended_actor, NEW.public_key, NEW.key_fingerprint,
      NEW.context_digest, NEW.approved_by, NEW.approved_at, NEW.issued_at,
      NEW.expires_at, NEW.version, NEW.payload_digest
    ) IS DISTINCT FROM ROW(
      OLD.id, OLD.challenge_id, OLD.task_ref, OLD.artifact_sha256,
      OLD.intended_actor, OLD.public_key, OLD.key_fingerprint,
      OLD.context_digest, OLD.approved_by, OLD.approved_at, OLD.issued_at,
      OLD.expires_at, OLD.version, OLD.payload_digest
    ) THEN
      RAISE EXCEPTION 'task ownership receipt provenance is immutable' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'task_ownership_proof_nonces' THEN
    IF OLD.consumed_at IS NOT NULL OR NEW.consumed_at IS NULL THEN
      RAISE EXCEPTION 'invalid task ownership nonce transition' USING ERRCODE = '23514';
    END IF;
    IF ROW(NEW.id, NEW.receipt_id, NEW.nonce, NEW.expires_at, NEW.created_at)
       IS DISTINCT FROM
       ROW(OLD.id, OLD.receipt_id, OLD.nonce, OLD.expires_at, OLD.created_at) THEN
      RAISE EXCEPTION 'task ownership nonce provenance is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER task_ownership_challenge_transition
BEFORE UPDATE ON task_ownership_challenges
FOR EACH ROW EXECUTE FUNCTION enforce_task_ownership_transition();
--> statement-breakpoint
CREATE TRIGGER task_ownership_receipt_transition
BEFORE UPDATE ON task_ownership_receipts
FOR EACH ROW EXECUTE FUNCTION enforce_task_ownership_transition();
--> statement-breakpoint
CREATE TRIGGER task_ownership_nonce_transition
BEFORE UPDATE ON task_ownership_proof_nonces
FOR EACH ROW EXECUTE FUNCTION enforce_task_ownership_transition();