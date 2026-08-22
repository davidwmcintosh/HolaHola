CREATE TABLE IF NOT EXISTS "raw_replit_classification_revisions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "raw_event_id" varchar NOT NULL REFERENCES "raw_replit_capture_events"("id"),
  "source_sha256" varchar(64) NOT NULL,
  "classification" varchar(96) NOT NULL,
  "attribution" jsonb,
  "reason" text NOT NULL,
  "revised_by" varchar(128) NOT NULL,
  "recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rrcr_event_time"
  ON "raw_replit_classification_revisions" ("raw_event_id", "recorded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rrcr_source_time"
  ON "raw_replit_classification_revisions" ("source_sha256", "recorded_at");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "reject_raw_replit_classification_revision_mutation"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'raw Replit classification revisions are append-only: % is not permitted', TG_OP;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "raw_replit_classification_revisions_immutable"
  ON "raw_replit_classification_revisions";
CREATE TRIGGER "raw_replit_classification_revisions_immutable"
BEFORE UPDATE OR DELETE ON "raw_replit_classification_revisions"
FOR EACH ROW EXECUTE FUNCTION "reject_raw_replit_classification_revision_mutation"();