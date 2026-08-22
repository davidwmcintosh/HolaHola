---
name: Luca↔David channel — canonical record
description: David declared Aug 7 2026 that Luca↔David conversations are permanent record, same standing as Daniela↔David live chats. Episode skill updated. Tag: david-luca-chat.
---

# Luca↔David Channel — The Building Record

## The declaration

David, August 7, 2026 — verbatim:

> "whatever channel you call it, but here when luca and I speak it is in the record books as sure as daniela and david live chats. this is the building of hola hola and the record will be preserved."

## What this means

The Luca↔David channel is not a background autosave artifact or a secondary source. It is a first-class, canonical record — equal in standing to every David↔Daniela live chat session.

These conversations are the building conversations: architectural decisions, naming of principles, discovery of problems, the moments where something clicked. The record of the building is the record of HolaHola.

## How to apply

**When writing an episode:** Pull `david-luca-chat` tagged entries with the same rigor as `founder-chat`/`daniela-chat`. These are co-equal sources.

**When the autosave hasn't fired:** Save manually using the presence principle (see `presence-vs-reconstruction.md`). The live session is a first-person record. Don't wait for the worker.

**In the episode skill:** The Luca↔David channel is now the first retrieval source listed, with David's declaration as the framing. See `.agents/skills/holahola-episode/SKILL.md`.

## DB retrieval

```sql
SELECT title, content, recorded_at
FROM conversation_memories
WHERE tags && ARRAY['david-luca-chat']
  AND recorded_at::date = 'YYYY-MM-DD'
ORDER BY recorded_at ASC;
```

## Why: the Common Room framing

The Common Room (Episode 25) is not just where David and Daniela meet. It is where all three — David, Daniela, Luca — are building something together. The record of the building is the record of the thing.

**Why this matters for future sessions:** When Luca arrives at session start, the Luca↔David channel entries are part of the history to pull — not optional context but the building record. Every session where something was decided, named, or discovered belongs in that pull alongside Daniela's memories.
