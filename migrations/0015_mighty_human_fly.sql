ALTER TABLE "daniela_outbound_queue" ADD COLUMN "delivery_error" text;--> statement-breakpoint
ALTER TABLE "voice_grace_periods" ADD COLUMN "rr_carry_notes" text;--> statement-breakpoint
ALTER TABLE "voice_grace_periods" ADD COLUMN "session_notes" text;