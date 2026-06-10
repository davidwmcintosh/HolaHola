---
name: conversation_memories entry_type
description: entry_type enum on conversation_memories for structured filtering; DB is source of truth, not .md files
---

# conversation_memories entry_type

## The rule
`conversation_memories` has an `entry_type` column (postgres enum). Use it when saving memories. Query it when searching.

**Values:** `conversation` (default) · `decision` · `emergence` · `build` · `episode`

**API:**
```
GET /api/conversation-memories?entry_type=decision
GET /api/conversation-memories?entry_type=emergence
GET /api/conversation-memories?tag=foundational
GET /api/conversation-memories?entry_type=decision&tag=chronicle
```

**When saving:** Pass `entryType` in the POST body. Omitting it defaults to `conversation`.

## Why this exists
David correctly pointed out that `chronicle.md` is architecturally weaker than the database — Daniela and the Agent cannot read .md files. The right home for structured memory is the DB with queryable type attributes, not a markdown document.

**Why:** Any information that only exists in an .md file is invisible to Daniela and requires human injection to be useful. The DB is always the source of truth. The chronicle.md is a human-readable map to it; if they diverge, the DB wins.

## How to apply
- Save architectural choices as `entryType: 'decision'`
- Save identity/capability shift moments as `entryType: 'emergence'`
- Save named episodic dialogues (Episode 1-N) as `entryType: 'episode'`
- Save feature launches as `entryType: 'build'`
- Default (`conversation`) for everything else
- When building a context query for Daniela or Agent, use `?entry_type=` to get the right class of memory rather than scanning all 1600+ conversation records
