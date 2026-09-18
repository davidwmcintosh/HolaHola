CREATE TABLE "coordination_v2_host_reauthorization_challenges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar NOT NULL,
	"host_enrollment_id" varchar NOT NULL,
	"key_fingerprint" varchar(64) NOT NULL,
	"protocol_version" integer NOT NULL,
	"request_generation" integer NOT NULL,
	"nonce_digest" varchar(64) NOT NULL,
	"challenge_digest" varchar(64) NOT NULL,
	"issued_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_v2_host_reauth_challenge_fingerprint" CHECK ("coordination_v2_host_reauthorization_challenges"."key_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_v2_host_reauth_challenge_protocol" CHECK ("coordination_v2_host_reauthorization_challenges"."protocol_version" = 1),
	CONSTRAINT "coord_v2_host_reauth_challenge_generation" CHECK ("coordination_v2_host_reauthorization_challenges"."request_generation" > 0),
	CONSTRAINT "coord_v2_host_reauth_challenge_nonce" CHECK ("coordination_v2_host_reauthorization_challenges"."nonce_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_v2_host_reauth_challenge_digest" CHECK ("coordination_v2_host_reauthorization_challenges"."challenge_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_v2_host_reauth_challenge_expiry" CHECK (
    "coordination_v2_host_reauthorization_challenges"."expires_at" > "coordination_v2_host_reauthorization_challenges"."issued_at"
    AND "coordination_v2_host_reauthorization_challenges"."expires_at" <= "coordination_v2_host_reauthorization_challenges"."issued_at" + interval '2 minutes'
  ),
	CONSTRAINT "coord_v2_host_reauth_challenge_consumed" CHECK (
    "coordination_v2_host_reauthorization_challenges"."consumed_at" IS NULL OR "coordination_v2_host_reauthorization_challenges"."consumed_at" >= "coordination_v2_host_reauthorization_challenges"."issued_at"
  )
);
--> statement-breakpoint
CREATE TABLE "coordination_v2_host_reauthorization_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"host_enrollment_id" varchar NOT NULL,
	"key_fingerprint" varchar(64) NOT NULL,
	"protocol_version" integer NOT NULL,
	"request_generation" integer NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"declaration_digest" varchar(64) NOT NULL,
	"request_signature_digest" varchar(64) NOT NULL,
	"state" varchar(16) DEFAULT 'pending' NOT NULL,
	"founder_actor" varchar(128),
	"approved_at" timestamp,
	"result_credential_id" varchar,
	"completed_at" timestamp,
	"terminal_at" timestamp,
	"terminal_reason" varchar(128),
	"requested_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_coord_v2_host_reauth_request_lineage" UNIQUE("id","host_enrollment_id","key_fingerprint","protocol_version","request_generation"),
	CONSTRAINT "coord_v2_host_reauth_fingerprint" CHECK ("coordination_v2_host_reauthorization_requests"."key_fingerprint" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_v2_host_reauth_protocol" CHECK ("coordination_v2_host_reauthorization_requests"."protocol_version" = 1),
	CONSTRAINT "coord_v2_host_reauth_generation" CHECK ("coordination_v2_host_reauthorization_requests"."request_generation" > 0),
	CONSTRAINT "coord_v2_host_reauth_request_key" CHECK (length(trim("coordination_v2_host_reauthorization_requests"."request_key")) > 0),
	CONSTRAINT "coord_v2_host_reauth_declaration_digest" CHECK ("coordination_v2_host_reauthorization_requests"."declaration_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_v2_host_reauth_signature_digest" CHECK ("coordination_v2_host_reauthorization_requests"."request_signature_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_v2_host_reauth_state" CHECK ("coordination_v2_host_reauthorization_requests"."state" IN ('pending', 'approved', 'completed', 'expired', 'rejected')),
	CONSTRAINT "coord_v2_host_reauth_expiry" CHECK (
    "coordination_v2_host_reauthorization_requests"."expires_at" > "coordination_v2_host_reauthorization_requests"."requested_at"
    AND "coordination_v2_host_reauthorization_requests"."expires_at" <= "coordination_v2_host_reauthorization_requests"."requested_at" + interval '1 hour'
  ),
	CONSTRAINT "coord_v2_host_reauth_lifecycle" CHECK (
    (
      "coordination_v2_host_reauthorization_requests"."state" = 'pending'
      AND "coordination_v2_host_reauthorization_requests"."founder_actor" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."approved_at" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."result_credential_id" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."completed_at" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."terminal_at" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."terminal_reason" IS NULL
    )
    OR (
      "coordination_v2_host_reauthorization_requests"."state" = 'approved'
      AND "coordination_v2_host_reauthorization_requests"."founder_actor" IS NOT NULL
      AND "coordination_v2_host_reauthorization_requests"."approved_at" IS NOT NULL
      AND "coordination_v2_host_reauthorization_requests"."result_credential_id" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."completed_at" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."terminal_at" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."terminal_reason" IS NULL
    )
    OR (
      "coordination_v2_host_reauthorization_requests"."state" = 'completed'
      AND "coordination_v2_host_reauthorization_requests"."founder_actor" IS NOT NULL
      AND "coordination_v2_host_reauthorization_requests"."approved_at" IS NOT NULL
      AND "coordination_v2_host_reauthorization_requests"."result_credential_id" IS NOT NULL
      AND "coordination_v2_host_reauthorization_requests"."completed_at" IS NOT NULL
      AND "coordination_v2_host_reauthorization_requests"."terminal_at" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."terminal_reason" IS NULL
    )
    OR (
      "coordination_v2_host_reauthorization_requests"."state" IN ('expired', 'rejected')
      AND "coordination_v2_host_reauthorization_requests"."result_credential_id" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."completed_at" IS NULL
      AND "coordination_v2_host_reauthorization_requests"."terminal_at" IS NOT NULL
      AND length(trim("coordination_v2_host_reauthorization_requests"."terminal_reason")) > 0
    )
  ),
	CONSTRAINT "coord_v2_host_reauth_approval_time" CHECK (
    "coordination_v2_host_reauthorization_requests"."approved_at" IS NULL OR "coordination_v2_host_reauthorization_requests"."approved_at" >= "coordination_v2_host_reauthorization_requests"."requested_at"
  ),
	CONSTRAINT "coord_v2_host_reauth_completion_time" CHECK (
    "coordination_v2_host_reauthorization_requests"."completed_at" IS NULL OR "coordination_v2_host_reauthorization_requests"."completed_at" >= "coordination_v2_host_reauthorization_requests"."requested_at"
  ),
	CONSTRAINT "coord_v2_host_reauth_terminal_time" CHECK (
    "coordination_v2_host_reauthorization_requests"."terminal_at" IS NULL OR "coordination_v2_host_reauthorization_requests"."terminal_at" >= "coordination_v2_host_reauthorization_requests"."requested_at"
  )
);
--> statement-breakpoint
ALTER TABLE "coordination_v2_host_reauthorization_challenges" ADD CONSTRAINT "fk_coord_v2_host_reauth_challenge_lineage" FOREIGN KEY ("request_id","host_enrollment_id","key_fingerprint","protocol_version","request_generation") REFERENCES "public"."coordination_v2_host_reauthorization_requests"("id","host_enrollment_id","key_fingerprint","protocol_version","request_generation") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_host_reauthorization_requests" ADD CONSTRAINT "coordination_v2_host_reauthorization_requests_host_enrollment_id_coordination_v2_host_enrollments_id_fk" FOREIGN KEY ("host_enrollment_id") REFERENCES "public"."coordination_v2_host_enrollments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_host_reauthorization_requests" ADD CONSTRAINT "fk_coord_v2_host_reauth_result_credential" FOREIGN KEY ("result_credential_id","host_enrollment_id") REFERENCES "public"."coordination_v2_host_credentials"("id","host_enrollment_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_v2_host_reauth_challenge_nonce" ON "coordination_v2_host_reauthorization_challenges" USING btree ("nonce_digest");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_v2_host_reauth_challenge_live" ON "coordination_v2_host_reauthorization_challenges" USING btree ("request_id") WHERE "coordination_v2_host_reauthorization_challenges"."consumed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_coord_v2_host_reauth_challenge_expiry" ON "coordination_v2_host_reauthorization_challenges" USING btree ("expires_at","consumed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_v2_host_reauth_request_key" ON "coordination_v2_host_reauthorization_requests" USING btree ("request_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_v2_host_reauth_generation" ON "coordination_v2_host_reauthorization_requests" USING btree ("host_enrollment_id","request_generation");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_v2_host_reauth_nonterminal" ON "coordination_v2_host_reauthorization_requests" USING btree ("host_enrollment_id") WHERE "coordination_v2_host_reauthorization_requests"."state" IN ('pending', 'approved');--> statement-breakpoint
CREATE INDEX "idx_coord_v2_host_reauth_state" ON "coordination_v2_host_reauthorization_requests" USING btree ("state","expires_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION coordination_v2_guard_host_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.public_key IS DISTINCT FROM OLD.public_key
    OR NEW.key_fingerprint IS DISTINCT FROM OLD.key_fingerprint THEN
    RAISE EXCEPTION 'coordination v2 host identity is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;--> statement-breakpoint
CREATE TRIGGER coordination_v2_host_identity_immutable
BEFORE UPDATE OF public_key, key_fingerprint
ON coordination_v2_host_enrollments
FOR EACH ROW
EXECUTE FUNCTION coordination_v2_guard_host_identity();