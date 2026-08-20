-- Durable collector-visible Replit source. This is deliberately separate from
-- conversation_memories: raw evidence is retained before attribution or
-- canonical episode projection.

CREATE TABLE IF NOT EXISTS "raw_replit_capture_streams" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "source_key" varchar(255) NOT NULL,
  "source_route" varchar(96) NOT NULL,
  "status" varchar(32) DEFAULT 'open' NOT NULL,
  "expected_event_count" integer DEFAULT 0 NOT NULL,
  "persisted_event_count" integer DEFAULT 0 NOT NULL,
  "persisted_byte_count" integer DEFAULT 0 NOT NULL,
  "aggregate_sha256" varchar(64),
  "metadata" jsonb,
  "privacy_classification" varchar(32) DEFAULT 'private-evidence' NOT NULL,
  "opened_at" timestamp DEFAULT now() NOT NULL,
  "last_observed_at" timestamp DEFAULT now() NOT NULL,
  "closed_at" timestamp,
  "recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raw_replit_capture_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stream_id" varchar NOT NULL
    REFERENCES "raw_replit_capture_streams"("id"),
  "sequence_number" integer NOT NULL,
  "event_type" varchar(96) NOT NULL,
  "payload_text" text NOT NULL,
  "payload_byte_count" integer NOT NULL,
  "payload_sha256" varchar(64) NOT NULL,
  "idempotency_key" varchar(255) NOT NULL,
  "metadata" jsonb,
  "observed_at" timestamp NOT NULL,
  "recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "raw_replit_projection_links" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "stream_id" varchar NOT NULL
    REFERENCES "raw_replit_capture_streams"("id"),
  "raw_event_id" varchar NOT NULL
    REFERENCES "raw_replit_capture_events"("id"),
  "target_kind" varchar(64) NOT NULL,
  "target_key" varchar(255) NOT NULL,
  "disposition" varchar(32) NOT NULL,
  "capture_start_byte_offset" integer,
  "capture_end_byte_offset" integer,
  "metadata" jsonb,
  "observed_at" timestamp NOT NULL,
  "recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rrcs_source_key"
  ON "raw_replit_capture_streams" ("source_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rrcs_route_time"
  ON "raw_replit_capture_streams" ("source_route", "recorded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rrcs_status_time"
  ON "raw_replit_capture_streams" ("status", "last_observed_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rrce_stream_sequence"
  ON "raw_replit_capture_events" ("stream_id", "sequence_number");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rrce_stream_idempotency"
  ON "raw_replit_capture_events" ("stream_id", "idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rrce_stream_recorded"
  ON "raw_replit_capture_events" ("stream_id", "recorded_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rrce_payload_hash"
  ON "raw_replit_capture_events" ("payload_sha256");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_rrpl_event_target"
  ON "raw_replit_projection_links" ("raw_event_id", "target_kind", "target_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_rrpl_stream_target"
  ON "raw_replit_projection_links" ("stream_id", "target_kind", "target_key");