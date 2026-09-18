ALTER TABLE "coordination_runtime_tool_results" DROP CONSTRAINT "fk_coord_runtime_tool_result_claim_epoch";
--> statement-breakpoint
ALTER TABLE "coordination_runtime_tool_results" ADD COLUMN "claim_event_id" varchar NOT NULL;--> statement-breakpoint
ALTER TABLE "coordination_runtime_tool_results" ADD CONSTRAINT "coordination_runtime_tool_results_claim_event_id_coordination_runtime_claim_events_id_fk" FOREIGN KEY ("claim_event_id") REFERENCES "public"."coordination_runtime_claim_events"("id") ON DELETE no action ON UPDATE no action;