---
name: processUnifiedRecall HTTP hardening
description: Which arms of processUnifiedRecall use HTTP transport vs WebSocket pool, and why — durable pattern for any future recall work.
---

## The rule

`processUnifiedRecall` (native-fc-handlers.ts) runs six arms in parallel via `Promise.all`. Under Neon WebSocket pool exhaustion, all six used to block/fail simultaneously.

**Arms that can use HTTP (getMonitoringDb):**
- Arm 3 — Express Lane (collaborationMessages): plain ILIKE SELECT, no pgvector
- Arm 4 hydration — plain SELECT-by-ID per hit, different tables per memoryType
- Arm 5 — conversation_memories: plain keyword/phrase SELECT
- Arm 6 — image memory: plain keyword SELECT

**Arms that must stay on WebSocket pool (pgvector required):**
- Arm 1 — searchMemory() — pgvector cosine similarity
- Arm 2 — searchConversationThreads() — pgvector cosine similarity
- Arm 4 semanticSearch() — pgvector cosine similarity

**Timeout rule:** Any arm that must use the WebSocket pool gets a `Promise.race([query, 1500ms reject])`. The arm's outer catch returns null, so the rejection never leaks to the outer Promise.all.

**Why:**
When the Neon serverless WebSocket pool drops under production load, Daniela's recall tools returned empty results across the board — she said "I don't know who Alden is." The fix splits arms by transport: HTTP arms continue functioning; pgvector arms fail-fast at 1500ms rather than hanging the entire Promise.all for 20+ seconds.

**How to apply:**
Any new recall arm that doesn't need pgvector should use `getMonitoringDb()`. Any new arm that does need pgvector needs a 1500ms `Promise.race` timeout.

## Arm 4 hydration dedup pattern

Arm 4 runs semantic hits through `Promise.all(dedupedHits.map(...))`. A **pre-dedup pass runs synchronously before the Promise.all** to prevent a race condition where two concurrent hits for the same conversation_memory both pass `seenConvMemIds.has()` before either adds to the Set.

```typescript
const seenConvMemIds = new Set<string>();
const dedupedHits = hits.filter(hit => {
  if (hit.memoryType === 'conversation_memory' || hit.memoryType === 'conversation_summary') {
    if (seenConvMemIds.has(hit.memoryId)) return false;
    seenConvMemIds.add(hit.memoryId);
    return true;
  } else if (hit.memoryType === 'conversation_chunk') {
    const convMemId = hit.memoryId.split(':chunk:')[0];  // normalize chunk ID to parent
    if (seenConvMemIds.has(convMemId)) return false;
    seenConvMemIds.add(convMemId);
    return true;
  }
  return true;
});
const hydratedLines = await Promise.all(dedupedHits.map(async (hit) => { ... }));
```

**session memory:** conversation_memories `3389ccb8-2bbf-42ae-a121-198f3fb83323`
