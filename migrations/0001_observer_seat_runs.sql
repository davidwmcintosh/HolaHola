CREATE TABLE "observer_seat_runs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scenario_label" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'es-ES' NOT NULL,
	"prompt_text" text DEFAULT '' NOT NULL,
	"transcript" text DEFAULT '' NOT NULL,
	"tool_calls_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visual_events_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"coverage_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"audio_duration_s" real DEFAULT 0 NOT NULL,
	"audio_url" text,
	"grade" text DEFAULT 'FAIL' NOT NULL
);
