---
name: EmbedIndexer OOM pattern
description: Server heap grows to ~4GB at startup from background workers; indexer boot runs trigger OOM; fix is no boot run.
---

# EmbedIndexer OOM Pattern

## The Rule
The `startMemoryEmbeddingIndexer()` function must NOT have a boot run (setTimeout). Rely entirely on the `setInterval` (2h periodic runs) for indexing.

**Why:** The server heap grows to ~4GB within 5 minutes of startup from all background workers running concurrently (TeamRoom AutoSave processing 355-message rooms, Wren Security audits, AgentBriefing, ToolIndexer 162-tool pipeline, etc.). Any additional allocation during this window fails with OOM. The GC log captured `299127ms: Mark-Compact 4063MB → 4063MB, mu=0.015` — near-zero GC efficiency at 5 minutes. The indexer boot run (even with lazy content loading, even at 120s) triggers the final allocation that crashes the process.

**How to apply:** If a boot run is ever re-introduced, it must fire no earlier than 10 minutes (600s) and must include a heap size check before running. The `NODE_OPTIONS=--max-old-space-size` should be raised if more headroom is needed.

## Background: what was fixed in the indexer

Arm A was fetching ALL 200 conversation_memories WITH full content (no NOT EXISTS filter). Some entries are 146KB+ (Team Room transcripts). This caused a 4GB+ RAM spike from bulk fetch alone.

Fixes applied (June 2026):
1. **NOT EXISTS filter** on Arm A — only fetches the ~55 unindexed conversations (not all 8870)
2. **Lazy content loading** — `IndexTarget.contentLoader?: () => Promise<string>` — Arm A stores IDs only; content is fetched one-at-a-time in `runIndexer()` before each embedding call
3. **Sequential processing** for lazy-loaded batches — no parallel content loading (would defeat the memory benefit)
4. **Arm C per-conversation fetch** — IDs only in the scan query; content fetched individually per conversation
5. **Boot run removed** — see above

## Chunk ID format
`{conversationMemoryId}:chunk:{n}` — stored in `memory_id` column (varchar 100). Stable and parseable. Used for NOT EXISTS check on `:chunk:0` to detect un-chunked conversations.
