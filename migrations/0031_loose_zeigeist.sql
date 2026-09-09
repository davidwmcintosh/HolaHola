CREATE TYPE "public"."coordination_inbox_activation_state" AS ENUM('preparing', 'ready', 'active');--> statement-breakpoint
CREATE TABLE "coordination_inbox_activation" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"schema_version" integer NOT NULL,
	"recipient_rule_version" integer NOT NULL,
	"state" "coordination_inbox_activation_state" DEFAULT 'preparing' NOT NULL,
	"backfill_cutoff_global_sequence" bigint,
	"completion_evidence" jsonb,
	"activated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_inbox_cursors" (
	"recipient_actor" varchar(80) PRIMARY KEY NOT NULL,
	"acknowledged_event_global_sequence" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_inbox_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_actor" varchar(80) NOT NULL,
	"coordination_event_id" varchar NOT NULL,
	"coordination_thread_id" varchar NOT NULL,
	"event_global_sequence" bigint NOT NULL,
	"sender_actor" varchar(80) NOT NULL,
	"message_kind" "coordination_event_type" NOT NULL,
	"source_reference_snapshot" jsonb,
	"source_correlation_key" varchar(1000),
	"recipient_rule_version" integer NOT NULL,
	"backfilled" boolean DEFAULT false NOT NULL,
	"backfill_provenance" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coordination_inbox_items" ADD CONSTRAINT "coordination_inbox_items_coordination_event_id_coordination_events_id_fk" FOREIGN KEY ("coordination_event_id") REFERENCES "public"."coordination_events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_inbox_items" ADD CONSTRAINT "coordination_inbox_items_coordination_thread_id_coordination_threads_id_fk" FOREIGN KEY ("coordination_thread_id") REFERENCES "public"."coordination_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_coordination_inbox_recipient_event" ON "coordination_inbox_items" USING btree ("recipient_actor","coordination_event_id");--> statement-breakpoint
CREATE INDEX "idx_coordination_inbox_recipient_sequence" ON "coordination_inbox_items" USING btree ("recipient_actor","event_global_sequence","id");--> statement-breakpoint
CREATE INDEX "idx_coordination_inbox_recipient_correlation" ON "coordination_inbox_items" USING btree ("recipient_actor","source_correlation_key","event_global_sequence");--> statement-breakpoint
INSERT INTO "coordination_inbox_activation" (
	"id",
	"schema_version",
	"recipient_rule_version",
	"state",
	"completion_evidence"
) VALUES (
	'canonical',
	1,
	1,
	'preparing',
	'{"migration":"0031_loose_zeigeist","status":"schema_created"}'::jsonb
);