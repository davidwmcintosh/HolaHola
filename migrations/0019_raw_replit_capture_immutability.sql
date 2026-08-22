-- Raw collector evidence is append-only. Existing rows predate byte-level
-- storage, so their UTF-8 reconstruction is preserved but explicitly marked
-- non-exact; all future writer paths provide the authoritative byte buffer.

ALTER TABLE "raw_replit_capture_events"
  ADD COLUMN IF NOT EXISTS "payload_bytes" bytea;
--> statement-breakpoint
ALTER TABLE "raw_replit_capture_events"
  ADD COLUMN IF NOT EXISTS "payload_bytes_exact" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "raw_replit_capture_events"
SET
  "payload_bytes" = convert_to("payload_text", 'UTF8'),
  "payload_bytes_exact" = false
WHERE "payload_bytes" IS NULL;
--> statement-breakpoint
ALTER TABLE "raw_replit_capture_events"
  ALTER COLUMN "payload_bytes" SET NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "reject_raw_replit_capture_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'raw Replit capture ledger is immutable: % is not permitted on %',
    TG_OP,
    TG_TABLE_NAME;
END;
$$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "raw_replit_capture_streams_immutable"
  ON "raw_replit_capture_streams";
CREATE TRIGGER "raw_replit_capture_streams_immutable"
BEFORE UPDATE OR DELETE ON "raw_replit_capture_streams"
FOR EACH ROW
EXECUTE FUNCTION "reject_raw_replit_capture_mutation"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "raw_replit_capture_events_immutable"
  ON "raw_replit_capture_events";
CREATE TRIGGER "raw_replit_capture_events_immutable"
BEFORE UPDATE OR DELETE ON "raw_replit_capture_events"
FOR EACH ROW
EXECUTE FUNCTION "reject_raw_replit_capture_mutation"();
--> statement-breakpoint
DROP TRIGGER IF EXISTS "raw_replit_projection_links_immutable"
  ON "raw_replit_projection_links";
CREATE TRIGGER "raw_replit_projection_links_immutable"
BEFORE UPDATE OR DELETE ON "raw_replit_projection_links"
FOR EACH ROW
EXECUTE FUNCTION "reject_raw_replit_capture_mutation"();