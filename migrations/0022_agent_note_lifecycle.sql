DO $$ BEGIN
	CREATE TYPE "public"."agent_note_status" AS ENUM('unread', 'acknowledged', 'acted_on', 'dismissed');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER TABLE "agent_notes" ADD COLUMN IF NOT EXISTS "status" "agent_note_status" DEFAULT 'unread' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_notes" ADD COLUMN IF NOT EXISTS "acknowledged_at" timestamp;--> statement-breakpoint
ALTER TABLE "agent_notes" ADD COLUMN IF NOT EXISTS "acted_on_at" timestamp;--> statement-breakpoint
ALTER TABLE "agent_notes" ADD COLUMN IF NOT EXISTS "dismissed_at" timestamp;--> statement-breakpoint
ALTER TABLE "agent_notes" ADD COLUMN IF NOT EXISTS "in_reply_to_id" varchar(255);--> statement-breakpoint
ALTER TABLE "agent_notes" ADD COLUMN IF NOT EXISTS "source_message_key" varchar(255);--> statement-breakpoint
UPDATE "agent_notes"
SET
	"status" = 'acknowledged',
	"acknowledged_at" = COALESCE("acknowledged_at", "read_at")
WHERE "read_at" IS NOT NULL AND "status" = 'unread';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_notes_inbox" ON "agent_notes" USING btree ("to_agent","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_agent_notes_source_message_key" ON "agent_notes" USING btree ("source_message_key");