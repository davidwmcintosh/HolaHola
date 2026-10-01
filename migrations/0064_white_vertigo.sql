CREATE TYPE "public"."runtime_onboarding_challenge_purpose" AS ENUM('enroll', 'recover');--> statement-breakpoint
CREATE TYPE "public"."runtime_onboarding_client_type" AS ENUM('mcp-stdio', 'openai-http', 'http-cli');--> statement-breakpoint
CREATE TYPE "public"."runtime_onboarding_state" AS ENUM('prepared', 'requested', 'approved', 'denied', 'cancelled', 'expired', 'enrolled', 'revoked');--> statement-breakpoint
CREATE TABLE "coordination_runtime_onboarding_challenges" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" varchar(120) NOT NULL,
	"purpose" "runtime_onboarding_challenge_purpose" NOT NULL,
	"nonce" varchar(128) NOT NULL,
	"nonce_hash" varchar(64) NOT NULL,
	"endpoint" varchar(512) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"consumed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_onboarding_challenge_nonce_format" CHECK ("coordination_runtime_onboarding_challenges"."nonce" ~ '^[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "coord_runtime_onboarding_challenge_nonce_hash_sha256" CHECK ("coordination_runtime_onboarding_challenges"."nonce_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coord_runtime_onboarding_challenge_endpoint_nonempty" CHECK (length(trim("coordination_runtime_onboarding_challenges"."endpoint")) > 0),
	CONSTRAINT "coord_runtime_onboarding_challenge_expiry_after_create" CHECK ("coordination_runtime_onboarding_challenges"."expires_at" > "coordination_runtime_onboarding_challenges"."created_at")
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_onboarding_invitations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" varchar(80) NOT NULL,
	"runtime_id" varchar(120) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"capabilities" text[] NOT NULL,
	"provider" varchar(40),
	"model" varchar(80),
	"client_type" "runtime_onboarding_client_type" DEFAULT 'mcp-stdio' NOT NULL,
	"prepared_by_actor" varchar(80) NOT NULL,
	"state" "runtime_onboarding_state" DEFAULT 'prepared' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"cancelled_at" timestamp,
	"completed_at" timestamp,
	"completed_request_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coord_runtime_onboarding_invite_runtime_nonempty" CHECK (length(trim("coordination_runtime_onboarding_invitations"."runtime_id")) > 0),
	CONSTRAINT "coord_runtime_onboarding_invite_display_nonempty" CHECK (length(trim("coordination_runtime_onboarding_invitations"."display_name")) > 0),
	CONSTRAINT "coord_runtime_onboarding_invite_capabilities_nonempty" CHECK (cardinality("coordination_runtime_onboarding_invitations"."capabilities") > 0),
	CONSTRAINT "coord_runtime_onboarding_invite_expiry_after_create" CHECK ("coordination_runtime_onboarding_invitations"."expires_at" > "coordination_runtime_onboarding_invitations"."created_at")
);
--> statement-breakpoint
CREATE TABLE "coordination_runtime_onboarding_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invitation_id" varchar(120) NOT NULL,
	"actor" varchar(80) NOT NULL,
	"runtime_id" varchar(120) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"capabilities" text[] NOT NULL,
	"provider" varchar(40),
	"model" varchar(80),
	"public_key_pem" text NOT NULL,
	"key_fingerprint" varchar(64) NOT NULL,
	"verification_code" varchar(32) NOT NULL,
	"state" "runtime_onboarding_state" DEFAULT 'requested' NOT NULL,
	"decision_actor" varchar(80),
	"decision_at" timestamp,
	"registration_id" varchar(120),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "coord_runtime_onboarding_request_key_nonempty" CHECK (length(trim("coordination_runtime_onboarding_requests"."public_key_pem")) > 0),
	CONSTRAINT "coord_runtime_onboarding_request_fingerprint_sha256" CHECK ("coordination_runtime_onboarding_requests"."key_fingerprint" ~ '^SHA256:[A-Za-z0-9+/]{43}$'),
	CONSTRAINT "coord_runtime_onboarding_request_verification_code" CHECK ("coordination_runtime_onboarding_requests"."verification_code" ~ '^[0-9]{6}$'),
	CONSTRAINT "coord_runtime_onboarding_request_expiry_after_create" CHECK ("coordination_runtime_onboarding_requests"."expires_at" > "coordination_runtime_onboarding_requests"."created_at"),
	CONSTRAINT "coord_runtime_onboarding_request_decision_pairing" CHECK (
    ("coordination_runtime_onboarding_requests"."decision_actor" IS NULL AND "coordination_runtime_onboarding_requests"."decision_at" IS NULL)
    OR ("coordination_runtime_onboarding_requests"."decision_actor" IS NOT NULL AND "coordination_runtime_onboarding_requests"."decision_at" IS NOT NULL)
  ),
	CONSTRAINT "coord_runtime_onboarding_request_registration_state" CHECK (
    ("coordination_runtime_onboarding_requests"."registration_id" IS NULL AND "coordination_runtime_onboarding_requests"."state" <> 'enrolled' AND "coordination_runtime_onboarding_requests"."state" <> 'revoked')
    OR ("coordination_runtime_onboarding_requests"."registration_id" IS NOT NULL AND "coordination_runtime_onboarding_requests"."state" IN ('enrolled', 'revoked'))
  )
);
--> statement-breakpoint
ALTER TABLE "coordination_runtime_onboarding_challenges" ADD CONSTRAINT "coordination_runtime_onboarding_challenges_request_id_coordination_runtime_onboarding_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."coordination_runtime_onboarding_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_onboarding_requests" ADD CONSTRAINT "coordination_runtime_onboarding_requests_invitation_id_coordination_runtime_onboarding_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."coordination_runtime_onboarding_invitations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coordination_runtime_onboarding_requests" ADD CONSTRAINT "coordination_runtime_onboarding_requests_registration_id_coordination_runtime_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "public"."coordination_runtime_registrations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_coord_runtime_onboarding_challenge_request_expiry" ON "coordination_runtime_onboarding_challenges" USING btree ("request_id","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_onboarding_challenge_nonce_hash" ON "coordination_runtime_onboarding_challenges" USING btree ("nonce_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_onboarding_invite_runtime" ON "coordination_runtime_onboarding_invitations" USING btree ("runtime_id");--> statement-breakpoint
CREATE INDEX "idx_coord_runtime_onboarding_invite_state_expiry" ON "coordination_runtime_onboarding_invitations" USING btree ("state","expires_at");--> statement-breakpoint
CREATE INDEX "idx_coord_runtime_onboarding_invite_actor_created" ON "coordination_runtime_onboarding_invitations" USING btree ("actor","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_onboarding_request_invite" ON "coordination_runtime_onboarding_requests" USING btree ("invitation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coord_runtime_onboarding_request_fingerprint" ON "coordination_runtime_onboarding_requests" USING btree ("key_fingerprint");--> statement-breakpoint
CREATE INDEX "idx_coord_runtime_onboarding_request_state_expiry" ON "coordination_runtime_onboarding_requests" USING btree ("state","expires_at");--> statement-breakpoint
CREATE INDEX "idx_coord_runtime_onboarding_request_runtime" ON "coordination_runtime_onboarding_requests" USING btree ("runtime_id","created_at");