ALTER TABLE "raw_replit_classification_revisions"
  ADD COLUMN IF NOT EXISTS "revision_key" varchar(255);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rrcr_revision_key"
  ON "raw_replit_classification_revisions" ("revision_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raw_replit_classification_projection_queue" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "revision_id" varchar NOT NULL REFERENCES "raw_replit_classification_revisions"("id"),
  "revision_key" varchar(255) NOT NULL,
  "source_sha256" varchar(64) NOT NULL,
  "episode_filename" varchar(255) NOT NULL,
  "marker" varchar(255) NOT NULL,
  "status" varchar(32) NOT NULL DEFAULT 'pending',
  "attempts" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "projected_at" timestamp,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rrcpq_revision_key"
  ON "raw_replit_classification_projection_queue" ("revision_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rrcpq_status"
  ON "raw_replit_classification_projection_queue" ("status", "updated_at");