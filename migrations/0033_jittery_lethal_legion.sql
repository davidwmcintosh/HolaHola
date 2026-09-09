CREATE TABLE "coordination_credential_audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"success" boolean NOT NULL,
	"runtime_id" varchar(120),
	"actor" varchar(80),
	"credential_id" varchar,
	"reason" varchar(160),
	"source_ip_hash" varchar(64),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_credentials" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"runtime_id" varchar(120) NOT NULL,
	"actor" varchar(80) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"capabilities" text[] NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"renewed_from_credential_id" varchar
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_registrations" (
	"id" varchar(120) PRIMARY KEY NOT NULL,
	"actor" varchar(80) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"bootstrap_hash" varchar(64) NOT NULL,
	"capabilities" text[] NOT NULL,
	"token_ttl_seconds" integer DEFAULT 900 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "coordination_runtime_credentials" ADD CONSTRAINT "coordination_runtime_credentials_runtime_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("runtime_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_coordination_credential_audit_runtime" ON "coordination_credential_audit_events" USING btree ("runtime_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_credential_audit_actor" ON "coordination_credential_audit_events" USING btree ("actor","created_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_credential_audit_failures" ON "coordination_credential_audit_events" USING btree ("success","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_runtime_token_hash" ON "coordination_runtime_credentials" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_coordination_runtime_credential_active" ON "coordination_runtime_credentials" USING btree ("runtime_id","expires_at","revoked_at");--> statement-breakpoint
CREATE INDEX "idx_coordination_runtime_credential_actor" ON "coordination_runtime_credentials" USING btree ("actor","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_runtime_bootstrap_hash" ON "coordination_runtime_registrations" USING btree ("bootstrap_hash");--> statement-breakpoint
CREATE INDEX "idx_coordination_runtime_actor" ON "coordination_runtime_registrations" USING btree ("actor","enabled");