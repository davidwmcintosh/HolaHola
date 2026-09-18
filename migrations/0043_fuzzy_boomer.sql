CREATE TABLE "coordination_v2_policy_audit_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_identity_id" varchar NOT NULL,
	"policy_version_id" varchar,
	"operator_grant_id" varchar,
	"actor_type" varchar(32) NOT NULL,
	"actor_id" varchar(128) NOT NULL,
	"action" varchar(64) NOT NULL,
	"request_key" varchar(128) NOT NULL,
	"request_digest" varchar(64) NOT NULL,
	"reason" text,
	"success" boolean NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_policy_audit_actor_type" CHECK ("coordination_v2_policy_audit_events"."actor_type" IN ('founder', 'operator', 'system')),
	CONSTRAINT "coordination_v2_policy_audit_actor_nonblank" CHECK (length(trim("coordination_v2_policy_audit_events"."actor_id")) > 0),
	CONSTRAINT "coordination_v2_policy_audit_action" CHECK ("coordination_v2_policy_audit_events"."action" IN (
    'draft_created', 'policy_approved', 'policy_rejected', 'policy_revoked',
    'grant_issued', 'grant_revoked', 'authorization_denied'
  )),
	CONSTRAINT "coordination_v2_policy_audit_request_nonblank" CHECK (length(trim("coordination_v2_policy_audit_events"."request_key")) > 0),
CONSTRAINT "coordination_v2_policy_audit_digest" CHECK ("coordination_v2_policy_audit_events"."request_digest" ~ '^[0-9a-f]{64}$'),
CONSTRAINT "coordination_v2_policy_audit_metadata_size" CHECK (length("coordination_v2_policy_audit_events"."metadata"::text) <= 16384),
CONSTRAINT "coordination_v2_policy_audit_action_shape" CHECK (
  (
    "coordination_v2_policy_audit_events"."action" IN ('draft_created', 'policy_approved', 'policy_rejected', 'policy_revoked')
    AND "coordination_v2_policy_audit_events"."policy_version_id" IS NOT NULL
    AND "coordination_v2_policy_audit_events"."operator_grant_id" IS NULL
    AND "coordination_v2_policy_audit_events"."actor_type" = 'founder'
    AND "coordination_v2_policy_audit_events"."success" = TRUE
  )
  OR (
    "coordination_v2_policy_audit_events"."action" IN ('grant_issued', 'grant_revoked')
    AND "coordination_v2_policy_audit_events"."policy_version_id" IS NULL
    AND "coordination_v2_policy_audit_events"."operator_grant_id" IS NOT NULL
    AND "coordination_v2_policy_audit_events"."actor_type" = 'founder'
    AND "coordination_v2_policy_audit_events"."success" = TRUE
  )
  OR (
    "coordination_v2_policy_audit_events"."action" = 'authorization_denied'
    AND "coordination_v2_policy_audit_events"."actor_type" = 'operator'
    AND "coordination_v2_policy_audit_events"."success" = FALSE
  )
)
);
--> statement-breakpoint
ALTER TABLE "coordination_v2_policy_audit_events" ADD CONSTRAINT "coordination_v2_policy_audit_events_policy_identity_id_coordination_v2_policy_identities_id_fk" FOREIGN KEY ("policy_identity_id") REFERENCES "public"."coordination_v2_policy_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_policy_audit_events" ADD CONSTRAINT "coordination_v2_policy_audit_events_policy_version_id_coordination_v2_policy_versions_id_fk" FOREIGN KEY ("policy_version_id") REFERENCES "public"."coordination_v2_policy_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_v2_policy_audit_events" ADD CONSTRAINT "coordination_v2_policy_audit_events_operator_grant_id_coordination_v2_operator_grants_id_fk" FOREIGN KEY ("operator_grant_id") REFERENCES "public"."coordination_v2_operator_grants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_policy_audit_request" ON "coordination_v2_policy_audit_events" USING btree ("policy_identity_id","action","request_key");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_policy_audit_version" ON "coordination_v2_policy_audit_events" USING btree ("policy_version_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_policy_audit_grant" ON "coordination_v2_policy_audit_events" USING btree ("operator_grant_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_v2_policy_audit_actor" ON "coordination_v2_policy_audit_events" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE OR REPLACE FUNCTION "validate_coordination_v2_policy_audit_provenance"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.policy_version_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM coordination_v2_policy_versions
    WHERE id = NEW.policy_version_id AND policy_identity_id = NEW.policy_identity_id
  ) THEN
    RAISE EXCEPTION 'Policy audit version does not belong to policy identity'
      USING ERRCODE = '23503';
  END IF;
  IF NEW.operator_grant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM coordination_v2_operator_grants
    WHERE id = NEW.operator_grant_id AND policy_identity_id = NEW.policy_identity_id
  ) THEN
    RAISE EXCEPTION 'Policy audit grant does not belong to policy identity'
      USING ERRCODE = '23503';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_v2_policy_audit_provenance"
BEFORE INSERT ON "coordination_v2_policy_audit_events"
FOR EACH ROW EXECUTE FUNCTION "validate_coordination_v2_policy_audit_provenance"();--> statement-breakpoint
CREATE OR REPLACE FUNCTION "protect_coordination_v2_policy_audit_events"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Coordinator V2 policy audit events are immutable'
    USING ERRCODE = '23514';
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_v2_policy_audit_events_immutable"
BEFORE UPDATE OR DELETE ON "coordination_v2_policy_audit_events"
FOR EACH ROW EXECUTE FUNCTION "protect_coordination_v2_policy_audit_events"();
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

  IF NEW."policy_identity_id" IS DISTINCT FROM OLD."policy_identity_id"
    OR NEW."version" IS DISTINCT FROM OLD."version"
    OR NEW."canonical_policy" IS DISTINCT FROM OLD."canonical_policy"
    OR NEW."policy_digest" IS DISTINCT FROM OLD."policy_digest"
    OR NEW."created_by" IS DISTINCT FROM OLD."created_by"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
    RAISE EXCEPTION 'Coordinator V2 policy provenance is immutable'
      USING ERRCODE = '23514';
  END IF;

  IF OLD."approval_state" = 'approved' THEN
    IF NEW."approval_state" <> 'revoked'
      OR NEW."approved_by" IS DISTINCT FROM OLD."approved_by"
      OR NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
      OR OLD."revoked_at" IS NOT NULL
      OR NEW."revoked_at" IS NULL THEN
      RAISE EXCEPTION 'approved Coordinator V2 policy versions may only transition once to revoked'
        USING ERRCODE = '23514';
    END IF;
  ELSIF OLD."approval_state" <> 'draft' THEN
    RAISE EXCEPTION 'rejected and revoked Coordinator V2 policy versions are immutable'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;