CREATE TYPE "public"."coordination_delivery_status" AS ENUM('pending', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."coordination_event_type" AS ENUM('created', 'delivered', 'accepted', 'progress', 'evidence_added', 'blocked', 'completed', 'outcome_acknowledged', 'reopened', 'reassigned', 'comment');--> statement-breakpoint
CREATE TYPE "public"."coordination_thread_state" AS ENUM('created', 'delivered', 'accepted', 'in_progress', 'blocked', 'completed', 'outcome_acknowledged', 'reopened', 'reassigned');--> statement-breakpoint
CREATE TABLE "coordination_adapter_deliveries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" varchar NOT NULL,
	"adapter_name" varchar(80) NOT NULL,
	"target_actor" varchar(80) NOT NULL,
	"status" "coordination_delivery_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"last_error" text,
	"delivered_at" timestamp,
	"external_reference" varchar(255),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_sequence" bigserial NOT NULL,
	"thread_id" varchar NOT NULL,
	"sequence" integer NOT NULL,
	"actor" varchar(80) NOT NULL,
	"recipient_actor" varchar(80),
	"event_type" "coordination_event_type" NOT NULL,
	"content" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"causal_parent_event_id" varchar,
	"idempotency_key" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_threads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(300) NOT NULL,
	"description" text NOT NULL,
	"origin_actor" varchar(80) NOT NULL,
	"intended_recipient" varchar(80) NOT NULL,
	"current_owner" varchar(80),
	"priority" varchar(20) DEFAULT 'normal' NOT NULL,
	"state" "coordination_thread_state" DEFAULT 'created' NOT NULL,
	"latest_sequence" integer DEFAULT 0 NOT NULL,
	"latest_global_sequence" bigint DEFAULT 0 NOT NULL,
	"source_reference" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coordination_adapter_deliveries" ADD CONSTRAINT "coordination_adapter_deliveries_event_id_coordination_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."coordination_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_events" ADD CONSTRAINT "coordination_events_thread_id_coordination_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."coordination_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coordination_delivery_dedupe" ON "coordination_adapter_deliveries" USING btree ("event_id","adapter_name","target_actor");--> statement-breakpoint
CREATE INDEX "idx_coordination_delivery_retry" ON "coordination_adapter_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coordination_events_thread_sequence" ON "coordination_events" USING btree ("thread_id","sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coordination_events_idempotency" ON "coordination_events" USING btree ("actor","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coordination_events_global_sequence" ON "coordination_events" USING btree ("global_sequence");--> statement-breakpoint
CREATE INDEX "idx_coordination_events_thread_created" ON "coordination_events" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_events_actor_created" ON "coordination_events" USING btree ("actor","created_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_threads_origin" ON "coordination_threads" USING btree ("origin_actor","updated_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_threads_recipient" ON "coordination_threads" USING btree ("intended_recipient","updated_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_threads_owner" ON "coordination_threads" USING btree ("current_owner","updated_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_threads_state" ON "coordination_threads" USING btree ("state","updated_at");