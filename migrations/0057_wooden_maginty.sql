CREATE TABLE "release_cutover_attestations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"decision_ref" varchar(128) NOT NULL,
	"captured_by_actor_id" varchar(32) NOT NULL,
	"targets" jsonb NOT NULL,
	"commit_sha" varchar(40) NOT NULL,
	"source_context_sha256" varchar(64) NOT NULL,
	"reason" text NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"state" varchar(16) DEFAULT 'active' NOT NULL,
	"invalidated_at" timestamp,
	"invalidated_by_actor_id" varchar(32),
	"invalidation_reason" text,
	"consumed_at" timestamp,
	"consumed_by_actor_id" varchar(32),
	"consumed_for_action" text,
	CONSTRAINT "release_cutover_attestation_decision_ref" CHECK (
    length(trim("release_cutover_attestations"."decision_ref")) > 0 AND length("release_cutover_attestations"."decision_ref") <= 128
  ),
	CONSTRAINT "release_cutover_attestation_captured_by_nonblank" CHECK (length(trim("release_cutover_attestations"."captured_by_actor_id")) > 0),
	CONSTRAINT "release_cutover_attestation_commit" CHECK ("release_cutover_attestations"."commit_sha" ~ '^[0-9a-f]{40}$'),
	CONSTRAINT "release_cutover_attestation_source_digest" CHECK ("release_cutover_attestations"."source_context_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "release_cutover_attestation_reason_bounded" CHECK (
    length(trim("release_cutover_attestations"."reason")) > 0 AND length("release_cutover_attestations"."reason") <= 4000
  ),
	CONSTRAINT "release_cutover_attestation_state" CHECK ("release_cutover_attestations"."state" IN ('active', 'invalidated', 'consumed')),
	CONSTRAINT "release_cutover_attestation_targets_shape" CHECK (
    jsonb_typeof("release_cutover_attestations"."targets") = 'array'
    AND jsonb_array_length(
      CASE WHEN jsonb_typeof("release_cutover_attestations"."targets") = 'array' THEN "release_cutover_attestations"."targets" ELSE '[]'::jsonb END
    ) BETWEEN 1 AND 8
  ),
	CONSTRAINT "release_cutover_attestation_expiry_bounds" CHECK (
    "release_cutover_attestations"."expires_at" > "release_cutover_attestations"."captured_at"
    AND "release_cutover_attestations"."expires_at" <= "release_cutover_attestations"."captured_at" + interval '24 hours'
  ),
	CONSTRAINT "release_cutover_attestation_invalidation_consistency" CHECK (
    ("release_cutover_attestations"."state" = 'invalidated') = (
      "release_cutover_attestations"."invalidated_at" IS NOT NULL
      AND "release_cutover_attestations"."invalidated_by_actor_id" IS NOT NULL
      AND length(trim("release_cutover_attestations"."invalidation_reason")) > 0
    )
  ),
	CONSTRAINT "release_cutover_attestation_consumption_consistency" CHECK (
    ("release_cutover_attestations"."state" = 'consumed') = (
      "release_cutover_attestations"."consumed_at" IS NOT NULL
      AND "release_cutover_attestations"."consumed_by_actor_id" IS NOT NULL
      AND length(trim("release_cutover_attestations"."consumed_for_action")) > 0
    )
  ),
	CONSTRAINT "release_cutover_attestation_invalidated_after_captured" CHECK (
    "release_cutover_attestations"."invalidated_at" IS NULL OR "release_cutover_attestations"."invalidated_at" >= "release_cutover_attestations"."captured_at"
  ),
	CONSTRAINT "release_cutover_attestation_consumed_after_captured" CHECK (
    "release_cutover_attestations"."consumed_at" IS NULL OR "release_cutover_attestations"."consumed_at" >= "release_cutover_attestations"."captured_at"
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_release_cutover_attestation_active_decision" ON "release_cutover_attestations" USING btree ("decision_ref") WHERE "release_cutover_attestations"."state" = 'active';--> statement-breakpoint
CREATE INDEX "idx_release_cutover_attestation_expiry" ON "release_cutover_attestations" USING btree ("expires_at","state");