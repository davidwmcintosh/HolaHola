ALTER TYPE "public"."coordination_event_type" ADD VALUE 'steward_comment';--> statement-breakpoint
ALTER TABLE "coordination_runtime_registrations" ADD COLUMN "provider" varchar(40);--> statement-breakpoint
ALTER TABLE "coordination_runtime_registrations" ADD COLUMN "model" varchar(80);