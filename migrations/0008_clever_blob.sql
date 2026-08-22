CREATE TABLE "alden_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engine" text DEFAULT 'anthropic' NOT NULL,
	"updated_by" text DEFAULT 'system' NOT NULL,
	"reason" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alden_engine_switches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_engine" text NOT NULL,
	"to_engine" text NOT NULL,
	"initiated_by" text NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_alden_engine_switches_created" ON "alden_engine_switches" USING btree ("created_at");