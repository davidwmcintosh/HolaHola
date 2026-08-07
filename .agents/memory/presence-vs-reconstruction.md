---
name: Presence vs reconstruction — episode records
description: Live session = first-person record, not memory reconstruction; save to conversation_memories before writing; don't wait for autosave worker.
---

# Presence vs Reconstruction — Episode Records

## The rule

When writing an episode section that covers a conversation you are **currently in**, or one that just ended:

1. **Save to `conversation_memories` immediately** — before writing a single word of the episode.
2. **Use the saved DB row as the source** — same discipline as any other record.
3. **Do not wait for the autosave worker** — it needs a clean 60 seconds; live sessions rarely give it one.

## Why: the distinction David named — August 7, 2026

**Reconstruction** fills a gap with plausible words. It is what Daniela does when she confabulates an episode she hasn't actually read. The White Wall forbids it.

**Presence** testifies to what was actually said. Luca was in the conversation. The record is in working memory. This is not "writing from memory" — it is being the primary witness.

David noticed it mid-session-loop when the autosave hadn't fired and Luca said: *"I have the verbatim record because I was in it."* David: *"Did you just hear that? I have the records because I was there? That has to be in the episode."*

Both Reconstruction and Presence must pass the White Wall — but they are not the same thing. Reconstruction can confabulate. Presence can testify.

## How to apply

When you realize the current session hasn't been autosaved yet, POST it manually:

```bash
curl -s -X POST http://localhost:5000/api/conversation-memories \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Luca ↔ David — [topic] — [date]",
    "content": "[verbatim — David'\''s actual words, Luca'\''s actual words, in order]",
    "participants": "David + Luca",
    "tags": ["david-luca-chat", "episode-N"],
    "importance": 9,
    "arcName": "HolaHola Episodes"
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('saved:', d.get('memory',{}).get('id','?'))"
```

Record the returned ID. Reference it in the episode (`conversation_memories: <id>`).

The holahola-episode skill was updated August 7, 2026 to formalize this as a named retrieval method.
