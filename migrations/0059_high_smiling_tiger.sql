CREATE TABLE "agent_memory_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_slug" varchar(120) NOT NULL,
	"title" varchar(200) NOT NULL,
	"hook" varchar(220) NOT NULL,
	"created_by_actor" varchar(80) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_actor" varchar(80),
	CONSTRAINT "agent_memory_entries_title_nonempty" CHECK (length(trim("agent_memory_entries"."title")) > 0),
	CONSTRAINT "agent_memory_entries_hook_nonempty" CHECK (length(trim("agent_memory_entries"."hook")) > 0),
	CONSTRAINT "agent_memory_entries_version_positive" CHECK ("agent_memory_entries"."version" > 0),
	CONSTRAINT "agent_memory_entries_delete_pairing" CHECK (("agent_memory_entries"."deleted_at" IS NULL AND "agent_memory_entries"."deleted_by_actor" IS NULL) OR ("agent_memory_entries"."deleted_at" IS NOT NULL AND "agent_memory_entries"."deleted_by_actor" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "agent_memory_topic_blocks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_slug" varchar(120) NOT NULL,
	"order_key" varchar(200) NOT NULL,
	"heading" varchar(200),
	"body_markdown" text NOT NULL,
	"author_actor" varchar(80) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_actor" varchar(80),
	CONSTRAINT "uq_agent_memory_topic_blocks_order" UNIQUE("topic_slug","order_key"),
	CONSTRAINT "agent_memory_topic_blocks_order_key_nonempty" CHECK (length(trim("agent_memory_topic_blocks"."order_key")) > 0),
	CONSTRAINT "agent_memory_topic_blocks_body_nonempty" CHECK (length("agent_memory_topic_blocks"."body_markdown") > 0),
	CONSTRAINT "agent_memory_topic_blocks_version_positive" CHECK ("agent_memory_topic_blocks"."version" > 0),
	CONSTRAINT "agent_memory_topic_blocks_delete_pairing" CHECK (("agent_memory_topic_blocks"."deleted_at" IS NULL AND "agent_memory_topic_blocks"."deleted_by_actor" IS NULL) OR ("agent_memory_topic_blocks"."deleted_at" IS NOT NULL AND "agent_memory_topic_blocks"."deleted_by_actor" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "agent_memory_topics" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(120) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_agent_memory_topics_slug" UNIQUE("slug"),
	CONSTRAINT "agent_memory_topics_slug_nonempty" CHECK (length(trim("agent_memory_topics"."slug")) > 0)
);
--> statement-breakpoint
ALTER TABLE "agent_memory_entries" ADD CONSTRAINT "agent_memory_entries_topic_slug_agent_memory_topics_slug_fk" FOREIGN KEY ("topic_slug") REFERENCES "public"."agent_memory_topics"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memory_topic_blocks" ADD CONSTRAINT "agent_memory_topic_blocks_topic_slug_agent_memory_topics_slug_fk" FOREIGN KEY ("topic_slug") REFERENCES "public"."agent_memory_topics"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agent_memory_entries_topic" ON "agent_memory_entries" USING btree ("topic_slug");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_entries_rendering" ON "agent_memory_entries" USING btree ("deleted_at","created_at");--> statement-breakpoint
CREATE INDEX "idx_agent_memory_topic_blocks_rendering" ON "agent_memory_topic_blocks" USING btree ("topic_slug","deleted_at","order_key");