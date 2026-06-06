---
name: holahola-session-end
description: HolaHola session end checklist — update handoff, batch doc, shared lobe, Alden note, conversation memory, and MEMORY.md before closing a session.
---

# HolaHola Session End

**Full checklist:** `docs/agent-workflows.md` → Session End Checklist

## What this skill is for

Do all of these before closing a session. Nothing should be skipped on a meaningful build session.

## The 6 steps (in order)

1. Update `docs/alden-agent-handoff.md` — "From Agent" section: what was built, decisions, unresolved, what Alden should know
2. Add to `docs/batch-doc-updates.md` — what was built, how it works, key files, user-facing instructions
3. Shared lobe insight (if warranted): `INSERT INTO editor_insights (id, category, title, content, importance, tags) VALUES (gen_random_uuid(), 'shared', 'Title', 'Content', 8, ARRAY['agent']) RETURNING id;`
4. Leave Alden a note if anything affects monitoring: `POST /api/agent/note` with `x-agent-token: $REPLIT_AGENT_TOKEN`
5. Save conversation memory (if meaningful): `POST /api/conversation-memories` — `content` must be verbatim transcript, NOT a summary
6. Update `.agents/memory/MEMORY.md` — one-line index entries for durable lessons only

## Critical reminders

- `conversation_memories.content` = **verbatim transcript** — never a summary or description
- Shared lobe only for facts that would still matter 6 months from now
- MEMORY.md entries must be derivable by topic, not conversation ID
