CREATE TABLE "coordination_v2_task_artifacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_ref" varchar(32) NOT NULL,
	"artifact_base64" text NOT NULL,
	"task_artifact_sha256" varchar(64) NOT NULL,
	"repository_identity" varchar(512) NOT NULL,
	"starting_commit" varchar(64) NOT NULL,
	"published_by" varchar(128) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coordination_v2_task_artifact_ref_format" CHECK ("coordination_v2_task_artifacts"."task_ref" ~ '^[1-9][0-9]*$'),
	CONSTRAINT "coordination_v2_task_artifact_sha" CHECK ("coordination_v2_task_artifacts"."task_artifact_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_task_artifact_commit" CHECK ("coordination_v2_task_artifacts"."starting_commit" ~ '^[0-9a-f]{40}$|^[0-9a-f]{64}$'),
	CONSTRAINT "coordination_v2_task_artifact_repo_nonblank" CHECK (length(trim("coordination_v2_task_artifacts"."repository_identity")) > 0),
	CONSTRAINT "coordination_v2_task_artifact_publisher_nonblank" CHECK (length(trim("coordination_v2_task_artifacts"."published_by")) > 0),
	CONSTRAINT "coordination_v2_task_artifact_base64_nonblank" CHECK (length("coordination_v2_task_artifacts"."artifact_base64") > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_coordination_v2_task_artifact_ref" ON "coordination_v2_task_artifacts" USING btree ("task_ref");