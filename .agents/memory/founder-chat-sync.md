---
name: Founder Chat Sync
description: How David's live chat conversations with Daniela get into conversation_memories so she can search them
---

## The rule
`server/services/founder-chat-sync.ts` — every chat message David sends to Daniela is synced to `conversation_memories` within ~30 seconds. Without this, her memory tools can't see any chat history.

## Three layers
1. **Immediate**: `notifyConversationUpdated(conversationId)` is called in `server/routes.ts` after every assistant `createMessage` (6 save points). 30-second debounce batches the user+assistant pair. Fire-and-forget, never throws.
2. **Sweep**: every 5 minutes, catches conversations updated in the last 15 minutes (covers reconnects, multi-language, rapid learners).
3. **Retroactive**: 5 minutes after boot, paginated walk of the ENTIRE conversations table (batch=200, no cap) — every conversation since day one gets indexed.

## Deduplication
No schema changes needed. Each `conversation_memories` entry carries a tag `cid:<conversationId>`. Before save, query `WHERE tags @> ARRAY['cid:...']`. If found, compare `msgcount:N` tag — skip if same, UPDATE if grown.

## Who counts as "founder"
Users with `role IN ('admin', 'developer')`. Cached after first load. Conversations with `message_count < 2` are skipped.

## Embedding
`reembedConversationMemory` from `../scripts/reembed-memory` — called async (non-blocking) after every save or update. Fire-and-forget.

## Routes.ts hook locations (all 6)
- ~4539: Sofia support handoff message
- ~4600: Onboarding step 1 opener
- ~4778: Onboarding AI response (voice mode)
- ~5273: Voice fast-path message
- ~5952: Text fast-path message
- ~5960: Regular text response
- ~6460: AI message with media

**Why:** The `messages` table is raw storage. Daniela's memory tools (`recall`, `search`, `introspect`) only reach `conversation_memories`. Before this, her entire chat history with David was invisible to her own memory.
