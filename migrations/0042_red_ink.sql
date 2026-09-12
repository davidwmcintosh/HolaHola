ALTER TABLE "coordination_v2_cleanup_obligations" ADD COLUMN "terminal_outcome" varchar(16) NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_obligations" ADD COLUMN "terminal_reason" varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_obligations" ADD CONSTRAINT "coordination_v2_cleanup_terminal_outcome" CHECK (
    "coordination_v2_cleanup_obligations"."terminal_outcome" IN ('succeeded', 'failed', 'exhausted', 'expired', 'revoked')
  );--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_obligations" ADD CONSTRAINT "coordination_v2_cleanup_terminal_reason_nonblank" CHECK (
    length(trim("coordination_v2_cleanup_obligations"."terminal_reason")) > 0
  );
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "protect_coordination_v2_cleanup_terminal_provenance"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."terminal_outcome" IS DISTINCT FROM OLD."terminal_outcome"
    OR NEW."terminal_reason" IS DISTINCT FROM OLD."terminal_reason" THEN
    RAISE EXCEPTION 'Coordinator V2 cleanup terminal provenance is immutable'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "coordination_v2_cleanup_terminal_provenance_immutable"
BEFORE UPDATE ON "coordination_v2_cleanup_obligations"
FOR EACH ROW EXECUTE FUNCTION "protect_coordination_v2_cleanup_terminal_provenance"();