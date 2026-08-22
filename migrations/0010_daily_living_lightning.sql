CREATE TYPE "public"."sophia_incident_category" AS ENUM('audio_input', 'audio_output', 'connection', 'tool_render', 'ui_sync', 'other');--> statement-breakpoint
CREATE TYPE "public"."sophia_incident_status" AS ENUM('detected', 'investigating', 'instructing', 'resolved', 'unresolved', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."sophia_incident_trigger" AS ENUM('daniela_referral', 'telemetry_auto');--> statement-breakpoint
CREATE TABLE "sophia_incidents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar NOT NULL,
	"student_id" varchar NOT NULL,
	"conversation_id" varchar,
	"trigger_source" "sophia_incident_trigger" NOT NULL,
	"category" "sophia_incident_category" NOT NULL,
	"status" "sophia_incident_status" DEFAULT 'detected' NOT NULL,
	"issue_description" text NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"resolution_steps_summary" text,
	"all_clear_sent_at" timestamp,
	"resolved_at" timestamp,
	"session_ended_unresolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sophia_messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" varchar NOT NULL,
	"role" varchar NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sophia_messages" ADD CONSTRAINT "sophia_messages_incident_id_sophia_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."sophia_incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sophia_incidents_session" ON "sophia_incidents" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_sophia_incidents_student" ON "sophia_incidents" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "idx_sophia_incidents_status" ON "sophia_incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_sophia_messages_incident" ON "sophia_messages" USING btree ("incident_id");