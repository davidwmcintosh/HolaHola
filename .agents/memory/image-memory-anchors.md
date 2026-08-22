---
name: Image-memory visual anchors
description: How Daniela's generated images get linked to conversation memories — and the sourceConversationId bug that silently broke the join.
---

## How it works

`image_vision_cache.source_conversation_id` links each cached image to the conversation where it was shown. `enrichMemoriesWithImages()` in `neural-memory-search.ts` joins on this field and appends `[Archival visual from that session: X]` to any memory result that shares a conversation ID with a cached image.

Only `/api/media/` URLs enter the vision cache pipeline (`isAiGeneratedImage()` guard in `image-vision-service.ts`). Unsplash/Picsum URLs are rejected at that guard.

## The silent bug (fixed July 4, 2026)

`sourceConversationId` was defined on `MemorySearchResult` and populated for structured-fact results (line ~544), but **never set on conversation-domain results** (the block building results at line ~895–906). The enricher's `conversationIds` array was always empty for conversation searches, so the image join never ran.

**Fix:** Added `sourceConversationId: msg.conversationId ?? undefined` to the conversation result push in `searchMemory()`.

**Why it's easy to miss:** The enricher silently no-ops when `conversationIds.length === 0` — no error, no warning, just no anchors. Always verify with a test run after touching the result-building code.

## Result after fix

33/165 memories for "taxi" query carry anchors. 30/173 for "gato". The anchor text is the vision cache description (e.g. "taxi", "Scene background: tv newsroom", "gata") — richer descriptions produce more meaningful anchors.

## Testing pattern

Use `server/scripts/memory-image-test.ts` pattern: call `searchMemory()` directly, filter results for `[Archival visual`, count hits. If count = 0, check that `sourceConversationId` is populated on results AND that `image_vision_cache` has rows with matching `source_conversation_id`.
