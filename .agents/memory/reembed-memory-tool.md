---
name: Manual memory re-embed tool
description: How to refresh stale embeddings after editing a conversation_memories row directly (e.g. verbatim episode backfills)
---

The periodic embedding indexer (`memory-embedding-indexer.ts`, 2h `setInterval`) only embeds `conversation_memories` rows that have **no existing embedding at all** — it checks `NOT EXISTS` on `memory_embeddings`, not content hash vs. current content. This means editing a row's content after its embeddings were first generated (e.g. backfilling a verbatim exchange via a direct `pg` Client UPDATE) leaves stale embeddings in place indefinitely; the indexer will never pick up the change on its own.

**How to apply:** after any direct-SQL edit to a `conversation_memories` row's `content`/`summary`/`title`, run:

```
npx tsx server/scripts/reembed-memory.ts <memoryId> [<memoryId> ...]
```

This refreshes all three search arms (full-content, summary anchor, verbatim chunks) and cleans up orphaned chunks. It's idempotent — `generateAndStoreEmbedding()` skips any arm whose content hash already matches, so re-running costs nothing when nothing changed.

Also fixed alongside this: `splitIntoChunks()` in `memory-embedding-indexer.ts` had a latent infinite-loop bug when the turn-header snap logic could cause the chunk cursor to not advance, leading to unbounded chunk growth and an OOM crash on long transcripts. Guarded so the cursor always advances forward.
