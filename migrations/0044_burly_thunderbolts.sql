-- Legacy rows receive deterministic, collision-safe synthetic provenance keys.
UPDATE "coordination_v2_session_events"
SET "request_key" = 'legacy-session-' || "id"::text
WHERE "request_key" IS NULL;--> statement-breakpoint
UPDATE "coordination_v2_attempt_events"
SET "request_key" = 'legacy-attempt-' || "id"::text
WHERE "request_key" IS NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_attempt_events" ALTER COLUMN "request_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_session_events" ALTER COLUMN "request_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_attempt_events" ADD CONSTRAINT "coordination_v2_attempt_event_request_nonblank" CHECK (length(trim("coordination_v2_attempt_events"."request_key")) > 0);--> statement-breakpoint
ALTER TABLE "coordination_v2_session_events" ADD CONSTRAINT "coordination_v2_session_event_request_nonblank" CHECK (length(trim("coordination_v2_session_events"."request_key")) > 0);
--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_obligations" ADD COLUMN "operation_receipts" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_v2_cleanup_obligations" ADD CONSTRAINT "coordination_v2_cleanup_operation_receipts_size" CHECK (length("coordination_v2_cleanup_obligations"."operation_receipts"::text) <= 16384);