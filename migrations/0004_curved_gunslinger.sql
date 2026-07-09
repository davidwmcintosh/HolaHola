CREATE TABLE "daniela_character_candidates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"statement" text NOT NULL,
	"reasoning" text NOT NULL,
	"source_context" text,
	"conversation_id" varchar,
	"mood_at_time" varchar(100),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reviewed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "daniela_character_candidates" ADD CONSTRAINT "daniela_character_candidates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_character_candidates_user" ON "daniela_character_candidates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_character_candidates_status" ON "daniela_character_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_character_candidates_created" ON "daniela_character_candidates" USING btree ("created_at");