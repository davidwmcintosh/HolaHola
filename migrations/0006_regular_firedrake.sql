CREATE TABLE "principle_feeling_links" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"reflection_id" varchar NOT NULL,
	"principle_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_self_reflections_principle";--> statement-breakpoint
ALTER TABLE "principle_feeling_links" ADD CONSTRAINT "principle_feeling_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "principle_feeling_links" ADD CONSTRAINT "principle_feeling_links_reflection_id_daniela_self_reflections_id_fk" FOREIGN KEY ("reflection_id") REFERENCES "public"."daniela_self_reflections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_principle_feeling_links_user" ON "principle_feeling_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_principle_feeling_links_reflection" ON "principle_feeling_links" USING btree ("reflection_id");--> statement-breakpoint
CREATE INDEX "idx_principle_feeling_links_principle" ON "principle_feeling_links" USING btree ("principle_id");--> statement-breakpoint
ALTER TABLE "daniela_self_reflections" DROP COLUMN "related_principle_id";