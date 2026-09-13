CREATE TABLE "coordination_v2_preparation_reservations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"enrolled_host_id" varchar NOT NULL,
	"generation_id" varchar(128) NOT NULL,
	"reservation_digest" varchar(64) NOT NULL,
	"public_material_digest" varchar(64) NOT NULL,
	"protocol_version" integer NOT NULL,
	"repository_identity" varchar(255) NOT NULL,
	"branch" varchar(255) NOT NULL,
	"starting_commit" varchar(64) NOT NULL,
	"state" varchar(16) DEFAULT 'reserved' NOT NULL,
	"reserve_request_key" varchar(128) NOT NULL,
	"reserve_command_digest" varchar(64) NOT NULL,
	"acknowledgement_request_key" varchar(128),
	"ack_command_digest" varchar(64),
	"safe_promotion_evidence_digest" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"promoted_at" timestamp,
	"acknowledged_at" timestamp,
	"expired_at" timestamp,
	"failed_at" timestamp,
	"abandoned_at" timestamp,
	"failure_code" varchar(128),
	"abandon_code" varchar(128),
	CONSTRAINT "coordination_v2_preparation_protocol_version" CHECK ("coordination_v2_preparation_reservations"."protocol_version" = 1),
	CONSTRAINT "coordination_v2_preparation_generation_nonblank" CHECK (length(trim("coordination_v2_preparation_reservations"."generation_id")) > 0),
	CONSTRAINT "coordination_v2_preparation_repository_nonblank" CHECK (length(trim("coordination_v2_preparation_reservations"."repository_identity")) > 0),
	CONSTRAINT "coordination_v2_preparation_branch" CHECK (length(trim("coordination_v2_preparation_reservations"."branch")) > 0 AND "coordination_v2_preparation_reservations"."branch" !~ '[[:cntrl:]]'),
	CONSTRAINT "coordination_v2_preparation_starting_commit" CHECK ("coordination_v2_preparation_reservations"."starting_commit" ~ '^[0-9a-f]{40}$|^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_preparation_reservation_digest" CHECK ("coordination_v2_preparation_reservations"."reservation_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_preparation_public_digest" CHECK ("coordination_v2_preparation_reservations"."public_material_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_preparation_reserve_digest" CHECK ("coordination_v2_preparation_reservations"."reserve_command_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_preparation_ack_digest" CHECK ("coordination_v2_preparation_reservations"."ack_command_digest" IS NULL OR "coordination_v2_preparation_reservations"."ack_command_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_preparation_evidence_digest" CHECK ("coordination_v2_preparation_reservations"."safe_promotion_evidence_digest" IS NULL OR "coordination_v2_preparation_reservations"."safe_promotion_evidence_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_preparation_request_key" CHECK (length(trim("coordination_v2_preparation_reservations"."reserve_request_key")) > 0 AND "coordination_v2_preparation_reservations"."reserve_request_key" !~ '[[:cntrl:]]'),
	CONSTRAINT "coordination_v2_preparation_ack_key" CHECK ("coordination_v2_preparation_reservations"."acknowledgement_request_key" IS NULL OR (length(trim("coordination_v2_preparation_reservations"."acknowledgement_request_key")) > 0 AND "coordination_v2_preparation_reservations"."acknowledgement_request_key" !~ '[[:cntrl:]]')),
	CONSTRAINT "coordination_v2_preparation_expiry" CHECK ("coordination_v2_preparation_reservations"."expires_at" > "coordination_v2_preparation_reservations"."created_at"),
	CONSTRAINT "coordination_v2_preparation_state" CHECK ("coordination_v2_preparation_reservations"."state" IN ('reserved', 'promoted', 'acknowledged', 'failed', 'expired', 'abandoned')),
	CONSTRAINT "coordination_v2_preparation_failure_code" CHECK (
    ("coordination_v2_preparation_reservations"."failure_code" IS NULL OR (length(trim("coordination_v2_preparation_reservations"."failure_code")) > 0 AND "coordination_v2_preparation_reservations"."failure_code" !~ '[[:cntrl:]]'))
    AND ("coordination_v2_preparation_reservations"."abandon_code" IS NULL OR (length(trim("coordination_v2_preparation_reservations"."abandon_code")) > 0 AND "coordination_v2_preparation_reservations"."abandon_code" !~ '[[:cntrl:]]'))
  ),
	CONSTRAINT "coordination_v2_preparation_lifecycle" CHECK (
    ("coordination_v2_preparation_reservations"."state" = 'reserved'
      AND "coordination_v2_preparation_reservations"."promoted_at" IS NULL AND "coordination_v2_preparation_reservations"."acknowledged_at" IS NULL
      AND "coordination_v2_preparation_reservations"."expired_at" IS NULL AND "coordination_v2_preparation_reservations"."failed_at" IS NULL AND "coordination_v2_preparation_reservations"."abandoned_at" IS NULL
      AND "coordination_v2_preparation_reservations"."acknowledgement_request_key" IS NULL AND "coordination_v2_preparation_reservations"."ack_command_digest" IS NULL
      AND "coordination_v2_preparation_reservations"."safe_promotion_evidence_digest" IS NULL AND "coordination_v2_preparation_reservations"."failure_code" IS NULL AND "coordination_v2_preparation_reservations"."abandon_code" IS NULL)
    OR ("coordination_v2_preparation_reservations"."state" = 'promoted'
      AND "coordination_v2_preparation_reservations"."promoted_at" IS NOT NULL AND "coordination_v2_preparation_reservations"."acknowledged_at" IS NULL
      AND "coordination_v2_preparation_reservations"."expired_at" IS NULL AND "coordination_v2_preparation_reservations"."failed_at" IS NULL AND "coordination_v2_preparation_reservations"."abandoned_at" IS NULL
      AND "coordination_v2_preparation_reservations"."acknowledgement_request_key" IS NULL AND "coordination_v2_preparation_reservations"."ack_command_digest" IS NULL
      AND "coordination_v2_preparation_reservations"."safe_promotion_evidence_digest" IS NOT NULL AND "coordination_v2_preparation_reservations"."failure_code" IS NULL AND "coordination_v2_preparation_reservations"."abandon_code" IS NULL)
    OR ("coordination_v2_preparation_reservations"."state" = 'acknowledged'
      AND "coordination_v2_preparation_reservations"."promoted_at" IS NOT NULL AND "coordination_v2_preparation_reservations"."acknowledged_at" IS NOT NULL
      AND "coordination_v2_preparation_reservations"."expired_at" IS NULL AND "coordination_v2_preparation_reservations"."failed_at" IS NULL AND "coordination_v2_preparation_reservations"."abandoned_at" IS NULL
      AND "coordination_v2_preparation_reservations"."acknowledgement_request_key" IS NOT NULL AND "coordination_v2_preparation_reservations"."ack_command_digest" IS NOT NULL
      AND "coordination_v2_preparation_reservations"."safe_promotion_evidence_digest" IS NOT NULL AND "coordination_v2_preparation_reservations"."failure_code" IS NULL AND "coordination_v2_preparation_reservations"."abandon_code" IS NULL)
    OR ("coordination_v2_preparation_reservations"."state" = 'failed'
      AND "coordination_v2_preparation_reservations"."expired_at" IS NULL AND "coordination_v2_preparation_reservations"."failed_at" IS NOT NULL AND "coordination_v2_preparation_reservations"."acknowledged_at" IS NULL
      AND "coordination_v2_preparation_reservations"."abandoned_at" IS NULL AND "coordination_v2_preparation_reservations"."failure_code" IS NOT NULL AND "coordination_v2_preparation_reservations"."abandon_code" IS NULL)
    OR ("coordination_v2_preparation_reservations"."state" = 'expired'
      AND "coordination_v2_preparation_reservations"."expired_at" IS NOT NULL AND "coordination_v2_preparation_reservations"."failed_at" IS NULL AND "coordination_v2_preparation_reservations"."acknowledged_at" IS NULL
      AND "coordination_v2_preparation_reservations"."abandoned_at" IS NULL AND "coordination_v2_preparation_reservations"."failure_code" IS NULL AND "coordination_v2_preparation_reservations"."abandon_code" IS NULL)
    OR ("coordination_v2_preparation_reservations"."state" = 'abandoned'
      AND "coordination_v2_preparation_reservations"."expired_at" IS NULL AND "coordination_v2_preparation_reservations"."abandoned_at" IS NOT NULL AND "coordination_v2_preparation_reservations"."acknowledged_at" IS NULL
      AND "coordination_v2_preparation_reservations"."failure_code" IS NULL AND "coordination_v2_preparation_reservations"."abandon_code" IS NOT NULL)
  ),
	CONSTRAINT "coordination_v2_preparation_timestamp_order" CHECK (
    ("coordination_v2_preparation_reservations"."promoted_at" IS NULL OR "coordination_v2_preparation_reservations"."promoted_at" >= "coordination_v2_preparation_reservations"."created_at")
    AND ("coordination_v2_preparation_reservations"."acknowledged_at" IS NULL OR ("coordination_v2_preparation_reservations"."promoted_at" IS NOT NULL AND "coordination_v2_preparation_reservations"."acknowledged_at" >= "coordination_v2_preparation_reservations"."promoted_at"))
    AND ("coordination_v2_preparation_reservations"."failed_at" IS NULL OR "coordination_v2_preparation_reservations"."failed_at" >= "coordination_v2_preparation_reservations"."created_at")
    AND ("coordination_v2_preparation_reservations"."expired_at" IS NULL OR "coordination_v2_preparation_reservations"."expired_at" >= "coordination_v2_preparation_reservations"."created_at")
    AND ("coordination_v2_preparation_reservations"."abandoned_at" IS NULL OR "coordination_v2_preparation_reservations"."abandoned_at" >= "coordination_v2_preparation_reservations"."created_at")
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_session_host_binding" ON "coordination_v2_sessions" USING btree ("id","enrolled_host_id");--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD CONSTRAINT "coordination_v2_preparation_reservations_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD CONSTRAINT "coordination_v2_preparation_reservations_enrolled_host_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("enrolled_host_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_preparation_reservations" ADD CONSTRAINT "fk_coordination_v2_preparation_session_host" FOREIGN KEY ("session_id","enrolled_host_id") REFERENCES "public"."coordination_v2_sessions"("id","enrolled_host_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_preparation_generation" ON "coordination_v2_preparation_reservations" USING btree ("generation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_preparation_reserve_request" ON "coordination_v2_preparation_reservations" USING btree ("session_id","reserve_request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_preparation_ack_request" ON "coordination_v2_preparation_reservations" USING btree ("session_id","acknowledgement_request_key") WHERE "coordination_v2_preparation_reservations"."acknowledgement_request_key" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_preparation_active_session" ON "coordination_v2_preparation_reservations" USING btree ("session_id") WHERE "coordination_v2_preparation_reservations"."state" IN ('reserved', 'promoted');--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_preparation_host_state" ON "coordination_v2_preparation_reservations" USING btree ("enrolled_host_id","state");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_preparation_expiry" ON "coordination_v2_preparation_reservations" USING btree ("expires_at","state");--> statement-breakpoint
-- Custom durability guard: this trigger is intentionally stricter than the
-- generated Drizzle checks and is represented by the migration SQL itself.
CREATE OR REPLACE FUNCTION coordination_v2_preparation_reservation_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'preparation reservation deletion is forbidden' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.state IN ('acknowledged', 'failed', 'expired', 'abandoned') THEN
      RAISE EXCEPTION 'terminal preparation reservation is immutable' USING ERRCODE = '23514';
    END IF;
    IF OLD.session_id <> NEW.session_id OR OLD.enrolled_host_id <> NEW.enrolled_host_id
      OR OLD.generation_id <> NEW.generation_id
      OR OLD.reservation_digest <> NEW.reservation_digest
      OR OLD.public_material_digest <> NEW.public_material_digest
      OR OLD.protocol_version <> NEW.protocol_version
      OR OLD.repository_identity <> NEW.repository_identity
      OR OLD.branch <> NEW.branch
      OR OLD.starting_commit <> NEW.starting_commit
      OR OLD.reserve_request_key <> NEW.reserve_request_key
      OR OLD.reserve_command_digest <> NEW.reserve_command_digest
      OR OLD.created_at <> NEW.created_at OR OLD.expires_at <> NEW.expires_at THEN
      RAISE EXCEPTION 'preparation reservation identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF NOT (
      (OLD.state = 'reserved' AND NEW.state IN ('reserved', 'promoted', 'failed', 'expired', 'abandoned'))
       OR (OLD.state = 'promoted' AND NEW.state IN ('promoted', 'acknowledged', 'failed', 'abandoned'))
    ) THEN
      RAISE EXCEPTION 'invalid preparation reservation transition' USING ERRCODE = '23514';
    END IF;
    IF OLD.state = 'promoted'
      AND (OLD.promoted_at IS DISTINCT FROM NEW.promoted_at
        OR OLD.safe_promotion_evidence_digest IS DISTINCT FROM NEW.safe_promotion_evidence_digest) THEN
      RAISE EXCEPTION 'promoted preparation evidence is immutable' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER coordination_v2_preparation_reservation_guard
BEFORE UPDATE OR DELETE ON coordination_v2_preparation_reservations
FOR EACH ROW EXECUTE FUNCTION coordination_v2_preparation_reservation_guard();