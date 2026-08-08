-- episode_order: explicit sort position overriding created_at for arc traversal.
-- 0 = prequel, 1..N = numbered episodes, NULL = unordered (sort to end by created_at).
-- IF NOT EXISTS makes this idempotent on databases where db:push already applied the column.
ALTER TABLE "conversation_memories" ADD COLUMN IF NOT EXISTS "episode_order" integer;

-- Backfill: prequel episode
UPDATE "conversation_memories"
SET episode_order = 0
WHERE id = 'dd8cf439-867d-47f5-999c-a1a10c3a88d5'
  AND episode_order IS NULL;

-- Backfill: numbered episodes (Episode 1 through Episode 26) — extract number from title.
-- Matches titles beginning with "Episode N" (integer) followed by any character or end of string.
-- Multiple rows sharing the same episode number (e.g., alternate versions of Episode 1) all
-- receive the same episode_order value and are further sorted by created_at ASC.
UPDATE "conversation_memories"
SET episode_order = (regexp_match(title, '^Episode (\d+)'))[1]::integer
WHERE (entry_type = 'episode' OR arc_name = 'HolaHola Episodes')
  AND title ~ '^Episode \d+'
  AND episode_order IS NULL;
