CREATE TABLE "coordination_actor_feed_cursors" (
	"actor" varchar(80) PRIMARY KEY NOT NULL,
	"acknowledged_global_sequence" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
