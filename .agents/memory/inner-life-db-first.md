---
name: Inner-life DB-first pipeline
description: All inner-life channels (felt/thinking/moment) must write to the episode DB row first; the .md is derived from DB, never written independently for content.
---

## Rule
All three inner-life channels (felt → `checkLucaReflection`, thinking → `checkLucaQuestion`, moment → `checkLucaMoment`) write through `appendInnerLifeToEpisodeDb()`, not `appendExchangeToEpisode()`.

**Why:** The DB `conversation_memories.content` field is the authoritative record. The `.md` is derived verbatim from it. Writing to the `.md` independently creates a split record: the `.md` has content the DB doesn't, and the DB embedding is stale. David's architecture: DB first, then `.md` reflects from DB.

**How to apply:**
- Any new inner-life channel must call `appendInnerLifeToEpisodeDb(text, episodeFilename)` not `appendExchangeToEpisode()`.
- `appendInnerLifeToEpisodeDb` does: (1) UPDATEs `conversation_memories.content || text`, (2) reads updated content from DB, (3) writes to `.md` from that read, (4) schedules re-embed.
- The startup gap check (Phase 2, inner-life patch) was removed — with DB-first in place there is no gap to patch.
- The `_lucaEpisodeAppendEnabled` test seam was removed alongside the wrong path. The live-mode dialogue append in `checkChatCapture` uses `_autoCaptureEpisodeEnabled` instead.

## Confirmed working
Log signature on a successful inner-life write:
```
[AgentAutosave] Luca reflection saved: title: ...
[AgentAutosave] Inner-life DB-first append: +N chars → episode-30.md
[AgentAutosave] docs/ event (change): episode-30.md — scheduling episode sync.
[conversation_memory] <id> → RE-EMBEDDED
```
