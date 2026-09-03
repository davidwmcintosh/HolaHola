-- memory_embeddings.importance has been in shared/schema.ts and in the drizzle
-- snapshot chain (since at least 0027) for a long time, but no migration file
-- ever emitted the SQL to add it -- it was applied to the shared DB out of
-- band (drizzle-kit push or a manual ALTER), so `drizzle-kit generate` sees
-- no diff and CI's from-scratch database never gets the column. IF NOT EXISTS
-- makes this a safe no-op everywhere it's already present.
ALTER TABLE "memory_embeddings" ADD COLUMN IF NOT EXISTS "importance" integer DEFAULT 5;--> statement-breakpoint
