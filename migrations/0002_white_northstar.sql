CREATE TABLE "student_milestones" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" varchar NOT NULL,
	"language" varchar DEFAULT 'spanish' NOT NULL,
	"milestone_key" varchar NOT NULL,
	"success_count" integer DEFAULT 0,
	"distinct_days" integer DEFAULT 0,
	"last_evidence_date_str" varchar,
	"unlocked_at" timestamp,
	"last_evidence_at" timestamp,
	"evidence_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_student_milestones_student" ON "student_milestones" USING btree ("student_id","language");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_student_milestones_unique" ON "student_milestones" USING btree ("student_id","language","milestone_key");