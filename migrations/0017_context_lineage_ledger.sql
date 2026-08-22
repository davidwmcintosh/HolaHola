-- Immutable context evidence for Daniela's Live and non-Live context routes.
-- This migration is additive: it creates new tables only and does not infer
-- missing history from voice_pipeline_events or rewrite any existing record.

CREATE TABLE IF NOT EXISTS "context_lineage_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trace_id" varchar NOT NULL,
  "session_id" varchar NOT NULL,
  "conversation_id" varchar,
  "user_id" varchar,
  "model_turn_id" varchar,
  "student_turn_epoch" integer,
  "sequence_number" integer NOT NULL,
  "source_route" varchar(96) NOT NULL,
  "event_type" varchar(96) NOT NULL,
  "delivery_channel" varchar(64),
  "delivery_status" varchar(32) DEFAULT 'observed' NOT NULL,
  "payload_text" text,
  "payload_json" jsonb,
  "payload_sha256" varchar(64),
  "privacy_classification" varchar(32) DEFAULT 'diagnostic' NOT NULL,
  "observed_at" timestamp NOT NULL,
  "recorded_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "context_lineage_events_session_sequence_unique"
    UNIQUE ("session_id", "sequence_number")
);

CREATE INDEX IF NOT EXISTS "idx_cle_trace"
  ON "context_lineage_events" ("trace_id");
CREATE INDEX IF NOT EXISTS "idx_cle_conversation_time"
  ON "context_lineage_events" ("conversation_id", "observed_at");
CREATE INDEX IF NOT EXISTS "idx_cle_event_type"
  ON "context_lineage_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_cle_source_route"
  ON "context_lineage_events" ("source_route");

CREATE TABLE IF NOT EXISTS "context_lineage_links" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "trace_id" varchar NOT NULL,
  "session_id" varchar NOT NULL,
  "from_event_id" varchar NOT NULL REFERENCES "context_lineage_events"("id"),
  "to_event_id" varchar NOT NULL REFERENCES "context_lineage_events"("id"),
  "link_type" varchar(64) NOT NULL,
  "metadata" jsonb,
  "observed_at" timestamp NOT NULL,
  "recorded_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_cll_trace"
  ON "context_lineage_links" ("trace_id");
CREATE INDEX IF NOT EXISTS "idx_cll_from"
  ON "context_lineage_links" ("from_event_id");
CREATE INDEX IF NOT EXISTS "idx_cll_to"
  ON "context_lineage_links" ("to_event_id");

-- Append-only is a database invariant, not an application convention. Facts
-- can receive later links and projections; their canonical rows cannot change.
CREATE OR REPLACE FUNCTION "reject_context_lineage_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'context lineage ledger is immutable: % is not permitted on %',
    TG_OP,
    TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS "context_lineage_events_immutable"
  ON "context_lineage_events";
CREATE TRIGGER "context_lineage_events_immutable"
BEFORE UPDATE OR DELETE ON "context_lineage_events"
FOR EACH ROW
EXECUTE FUNCTION "reject_context_lineage_mutation"();

DROP TRIGGER IF EXISTS "context_lineage_links_immutable"
  ON "context_lineage_links";
CREATE TRIGGER "context_lineage_links_immutable"
BEFORE UPDATE OR DELETE ON "context_lineage_links"
FOR EACH ROW
EXECUTE FUNCTION "reject_context_lineage_mutation"();