CREATE TABLE "coordination_v2_transport_lease_receipts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"operation" varchar(24) NOT NULL,
	"actor_id" varchar(128) NOT NULL,
	"enrolled_host_id" varchar NOT NULL,
	"command_digest" varchar(64) NOT NULL,
	"response_snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_transport_lease_receipt_request_nonblank" CHECK (length(trim("coordination_v2_transport_lease_receipts"."request_key")) > 0),
	CONSTRAINT "coordination_v2_transport_lease_receipt_actor_nonblank" CHECK (length(trim("coordination_v2_transport_lease_receipts"."actor_id")) > 0),
	CONSTRAINT "coordination_v2_transport_lease_receipt_operation" CHECK (
    "coordination_v2_transport_lease_receipts"."operation" IN ('acquire', 'renew', 'release', 'expire', 'takeover', 'poll', 'claim', 'result', 'ack', 'cleanup')
  ),
	CONSTRAINT "coordination_v2_transport_lease_receipt_digest" CHECK ("coordination_v2_transport_lease_receipts"."command_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_transport_lease_receipt_snapshot_size" CHECK (length("coordination_v2_transport_lease_receipts"."response_snapshot"::text) <= 32768)
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_transport_lease_reconciliations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"lease_id" varchar,
	"enrolled_host_id" varchar NOT NULL,
	"holder_instance_id" varchar(128) NOT NULL,
	"epoch" integer NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"evidence_digest" varchar(64) NOT NULL,
	"evidence" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_transport_lease_reconciliation_epoch" CHECK ("coordination_v2_transport_lease_reconciliations"."epoch" > 0),
	CONSTRAINT "coordination_v2_transport_lease_reconciliation_request_nonblank" CHECK (length(trim("coordination_v2_transport_lease_reconciliations"."request_key")) > 0),
	CONSTRAINT "coordination_v2_transport_lease_reconciliation_holder_nonblank" CHECK (length(trim("coordination_v2_transport_lease_reconciliations"."holder_instance_id")) > 0),
	CONSTRAINT "coordination_v2_transport_lease_reconciliation_digest" CHECK ("coordination_v2_transport_lease_reconciliations"."evidence_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_transport_lease_reconciliation_size" CHECK (length("coordination_v2_transport_lease_reconciliations"."evidence"::text) <= 8192)
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_transport_work_claims" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"attempt_id" varchar NOT NULL,
	"lease_id" varchar NOT NULL,
	"enrolled_host_id" varchar NOT NULL,
	"holder_instance_id" varchar(128) NOT NULL,
	"epoch" integer NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"command_digest" varchar(64) NOT NULL,
	"state" varchar(16) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"terminal_at" timestamp,
	CONSTRAINT "coordination_v2_transport_work_claim_epoch" CHECK ("coordination_v2_transport_work_claims"."epoch" > 0),
	CONSTRAINT "coordination_v2_transport_work_claim_state" CHECK ("coordination_v2_transport_work_claims"."state" IN ('active', 'completed', 'expired')),
	CONSTRAINT "coordination_v2_transport_work_claim_lifecycle" CHECK (
    ("coordination_v2_transport_work_claims"."state" = 'active' AND "coordination_v2_transport_work_claims"."terminal_at" IS NULL)
    OR ("coordination_v2_transport_work_claims"."state" IN ('completed', 'expired') AND "coordination_v2_transport_work_claims"."terminal_at" IS NOT NULL)
  ),
	CONSTRAINT "coordination_v2_transport_work_claim_digest" CHECK ("coordination_v2_transport_work_claims"."command_digest" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_transport_work_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"attempt_id" varchar NOT NULL,
	"claim_id" varchar NOT NULL,
	"lease_id" varchar NOT NULL,
	"enrolled_host_id" varchar NOT NULL,
	"holder_instance_id" varchar(128) NOT NULL,
	"epoch" integer NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"result_digest" varchar(64) NOT NULL,
	"result" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_transport_work_result_epoch" CHECK ("coordination_v2_transport_work_results"."epoch" > 0),
	CONSTRAINT "coordination_v2_transport_work_result_digest" CHECK ("coordination_v2_transport_work_results"."result_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_transport_work_result_size" CHECK (length("coordination_v2_transport_work_results"."result"::text) <= 32768)
);
--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD COLUMN "actor_id" varchar(128);--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD COLUMN "holder_instance_id" varchar(128);--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD COLUMN "transport_lease_id" varchar;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD COLUMN "transport_lease_epoch" integer;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD COLUMN "command_digest" varchar(64) DEFAULT repeat('0', 64) NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD COLUMN "response_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_attempt_session_id" ON "coordination_v2_attempts" USING btree ("session_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_cleanup_id_session" ON "coordination_v2_cleanup_obligations" USING btree ("id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_lease_session_id" ON "coordination_v2_transport_leases" USING btree ("session_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_lease_id_epoch" ON "coordination_v2_transport_leases" USING btree ("id","epoch");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_lease_id_host" ON "coordination_v2_transport_leases" USING btree ("id","enrolled_host_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_transport_work_claim_provenance" ON "coordination_v2_transport_work_claims" USING btree ("id","session_id","attempt_id","lease_id","epoch");--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_lease_receipts" ADD CONSTRAINT "coordination_v2_transport_lease_receipts_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_lease_receipts" ADD CONSTRAINT "coordination_v2_transport_lease_receipts_enrolled_host_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("enrolled_host_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_lease_reconciliations" ADD CONSTRAINT "coordination_v2_transport_lease_reconciliations_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_lease_reconciliations" ADD CONSTRAINT "coordination_v2_transport_lease_reconciliations_lease_id_coordination_v2_transport_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."coordination_v2_transport_leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_lease_reconciliations" ADD CONSTRAINT "coordination_v2_transport_lease_reconciliations_enrolled_host_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("enrolled_host_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_claims" ADD CONSTRAINT "coordination_v2_transport_work_claims_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_claims" ADD CONSTRAINT "coordination_v2_transport_work_claims_attempt_id_coordination_v2_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."coordination_v2_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_claims" ADD CONSTRAINT "coordination_v2_transport_work_claims_lease_id_coordination_v2_transport_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."coordination_v2_transport_leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_claims" ADD CONSTRAINT "coordination_v2_transport_work_claims_enrolled_host_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("enrolled_host_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_claims" ADD CONSTRAINT "fk_coordination_v2_work_claim_attempt_session" FOREIGN KEY ("session_id","attempt_id") REFERENCES "public"."coordination_v2_attempts"("session_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_claims" ADD CONSTRAINT "fk_coordination_v2_work_claim_lease_session" FOREIGN KEY ("session_id","lease_id") REFERENCES "public"."coordination_v2_transport_leases"("session_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_claims" ADD CONSTRAINT "fk_coordination_v2_work_claim_lease_host" FOREIGN KEY ("lease_id","enrolled_host_id") REFERENCES "public"."coordination_v2_transport_leases"("id","enrolled_host_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_claims" ADD CONSTRAINT "fk_coordination_v2_work_claim_lease_epoch" FOREIGN KEY ("lease_id","epoch") REFERENCES "public"."coordination_v2_transport_leases"("id","epoch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_results" ADD CONSTRAINT "coordination_v2_transport_work_results_session_id_coordination_v2_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."coordination_v2_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_results" ADD CONSTRAINT "coordination_v2_transport_work_results_attempt_id_coordination_v2_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."coordination_v2_attempts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_results" ADD CONSTRAINT "coordination_v2_transport_work_results_claim_id_coordination_v2_transport_work_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."coordination_v2_transport_work_claims"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_results" ADD CONSTRAINT "coordination_v2_transport_work_results_lease_id_coordination_v2_transport_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."coordination_v2_transport_leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_results" ADD CONSTRAINT "coordination_v2_transport_work_results_enrolled_host_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("enrolled_host_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_results" ADD CONSTRAINT "fk_coordination_v2_work_result_claim_provenance" FOREIGN KEY ("claim_id","session_id","attempt_id","lease_id","epoch") REFERENCES "public"."coordination_v2_transport_work_claims"("id","session_id","attempt_id","lease_id","epoch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_results" ADD CONSTRAINT "fk_coordination_v2_work_result_attempt_session" FOREIGN KEY ("session_id","attempt_id") REFERENCES "public"."coordination_v2_attempts"("session_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_results" ADD CONSTRAINT "fk_coordination_v2_work_result_lease_session" FOREIGN KEY ("session_id","lease_id") REFERENCES "public"."coordination_v2_transport_leases"("session_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_transport_work_results" ADD CONSTRAINT "fk_coordination_v2_work_result_lease_host" FOREIGN KEY ("lease_id","enrolled_host_id") REFERENCES "public"."coordination_v2_transport_leases"("id","enrolled_host_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_transport_lease_receipt_request" ON "coordination_v2_transport_lease_receipts" USING btree ("session_id","request_key");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_transport_lease_receipt_session" ON "coordination_v2_transport_lease_receipts" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_transport_lease_reconciliation_request" ON "coordination_v2_transport_lease_reconciliations" USING btree ("session_id","request_key");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_transport_lease_reconciliation_session" ON "coordination_v2_transport_lease_reconciliations" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_transport_work_claim_request" ON "coordination_v2_transport_work_claims" USING btree ("session_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_transport_work_claim_active_attempt" ON "coordination_v2_transport_work_claims" USING btree ("attempt_id") WHERE "coordination_v2_transport_work_claims"."state" = 'active';--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_transport_work_claim_session" ON "coordination_v2_transport_work_claims" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_transport_work_result_request" ON "coordination_v2_transport_work_results" USING btree ("session_id","request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_transport_work_result_claim" ON "coordination_v2_transport_work_results" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_transport_work_result_attempt" ON "coordination_v2_transport_work_results" USING btree ("attempt_id","created_at");--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "coordination_v2_cleanup_acknowledgements_transport_lease_id_coordination_v2_transport_leases_id_fk" FOREIGN KEY ("transport_lease_id") REFERENCES "public"."coordination_v2_transport_leases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "fk_coordination_v2_cleanup_ack_obligation_session" FOREIGN KEY ("obligation_id","session_id") REFERENCES "public"."coordination_v2_cleanup_obligations"("id","session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "fk_coordination_v2_cleanup_ack_lease_session" FOREIGN KEY ("transport_lease_id","session_id") REFERENCES "public"."coordination_v2_transport_leases"("id","session_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "fk_coordination_v2_cleanup_ack_lease_epoch" FOREIGN KEY ("transport_lease_id","transport_lease_epoch") REFERENCES "public"."coordination_v2_transport_leases"("id","epoch") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "fk_coordination_v2_cleanup_ack_lease_host" FOREIGN KEY ("transport_lease_id","enrolled_host_id") REFERENCES "public"."coordination_v2_transport_leases"("id","enrolled_host_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "coordination_v2_cleanup_ack_command_digest" CHECK ("coordination_v2_cleanup_acknowledgements"."command_digest" ~ '^[0-9a-f]{64}$');--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "coordination_v2_cleanup_ack_snapshot_size" CHECK (length("coordination_v2_cleanup_acknowledgements"."response_snapshot"::text) <= 32768);--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "coordination_v2_cleanup_ack_actor_nonblank" CHECK (
    "coordination_v2_cleanup_acknowledgements"."actor_id" IS NULL OR length(trim("coordination_v2_cleanup_acknowledgements"."actor_id")) > 0
  );--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "coordination_v2_cleanup_ack_holder_nonblank" CHECK (
    "coordination_v2_cleanup_acknowledgements"."holder_instance_id" IS NULL OR length(trim("coordination_v2_cleanup_acknowledgements"."holder_instance_id")) > 0
  );--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_acknowledgements" ADD CONSTRAINT "coordination_v2_cleanup_ack_m5_provenance" CHECK (
    ("coordination_v2_cleanup_acknowledgements"."command_digest" = repeat('0', 64)
      AND "coordination_v2_cleanup_acknowledgements"."actor_id" IS NULL
      AND "coordination_v2_cleanup_acknowledgements"."holder_instance_id" IS NULL
      AND "coordination_v2_cleanup_acknowledgements"."transport_lease_id" IS NULL
      AND "coordination_v2_cleanup_acknowledgements"."transport_lease_epoch" IS NULL)
    OR ("coordination_v2_cleanup_acknowledgements"."command_digest" <> repeat('0', 64)
      AND "coordination_v2_cleanup_acknowledgements"."actor_id" IS NOT NULL
      AND "coordination_v2_cleanup_acknowledgements"."holder_instance_id" IS NOT NULL
      AND "coordination_v2_cleanup_acknowledgements"."transport_lease_id" IS NOT NULL
      AND "coordination_v2_cleanup_acknowledgements"."transport_lease_epoch" IS NOT NULL)
  );
--> statement-breakpoint
CREATE OR REPLACE FUNCTION coordination_v2_validate_cleanup_ack_host()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE expected_host varchar;
BEGIN
  IF NEW.enrolled_host_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT enrolled_host_id INTO expected_host
    FROM coordination_v2_sessions
    WHERE id = NEW.session_id;
  IF expected_host IS NULL OR expected_host <> NEW.enrolled_host_id THEN
    RAISE EXCEPTION 'cleanup acknowledgement host does not match session enrollment'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER coordination_v2_cleanup_ack_host_provenance
BEFORE INSERT OR UPDATE ON coordination_v2_cleanup_acknowledgements
FOR EACH ROW EXECUTE FUNCTION coordination_v2_validate_cleanup_ack_host();