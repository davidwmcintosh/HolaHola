CREATE TABLE "coordination_runtime_rotations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_runtime_id" varchar(120) NOT NULL,
	"replacement_runtime_id" varchar(120) NOT NULL,
	"actor" varchar(80) NOT NULL,
	"capabilities" text[] NOT NULL,
	"token_ttl_seconds" integer NOT NULL,
	"state" varchar(24) DEFAULT 'staged' NOT NULL,
	"ready_credential_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ready_at" timestamp,
	"completed_at" timestamp,
	"rolled_back_at" timestamp,
	CONSTRAINT "coordination_runtime_rotation_distinct_ids" CHECK ("coordination_runtime_rotations"."source_runtime_id" <> "coordination_runtime_rotations"."replacement_runtime_id"),
	CONSTRAINT "coordination_runtime_rotation_state" CHECK (
    "coordination_runtime_rotations"."state" IN ('staged', 'ready', 'completed', 'rolled_back')
  )
);
--> statement-breakpoint
ALTER TABLE "coordination_runtime_rotations" ADD CONSTRAINT "coordination_runtime_rotations_source_runtime_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("source_runtime_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_rotations" ADD CONSTRAINT "coordination_runtime_rotations_replacement_runtime_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("replacement_runtime_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_rotations" ADD CONSTRAINT "coordination_runtime_rotations_ready_credential_id_coordination_runtime_credentials_id_fk" FOREIGN KEY ("ready_credential_id") REFERENCES "public"."coordination_runtime_credentials"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_runtime_rotation_active_source" ON "coordination_runtime_rotations" USING btree ("source_runtime_id") WHERE "coordination_runtime_rotations"."state" IN ('staged', 'ready');--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_runtime_rotation_active_replacement" ON "coordination_runtime_rotations" USING btree ("replacement_runtime_id") WHERE "coordination_runtime_rotations"."state" IN ('staged', 'ready');--> statement-breakpoint
CREATE INDEX "idx_coordination_runtime_rotation_actor" ON "coordination_runtime_rotations" USING btree ("actor","created_at");