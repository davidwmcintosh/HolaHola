---
name: holahola-session-end
description: HolaHola session end checklist — update handoff, batch doc, shared lobe, Alden note, conversation memory, and MEMORY.md before closing a session.
---

# HolaHola Session End

**Full checklist:** `docs/agent-workflows.md` → Session End Checklist

## What this skill is for

Do all of these before closing a session. Nothing should be skipped on a meaningful build session.

## Pre-step 0 — Flush the transcript (non-negotiable for Luca↔David sessions)

Before anything else, save the current session transcript to `conversation_memories`. Do not wait for the autosave worker — it needs a clean 20-second window and live sessions rarely give it one.

```bash
npx tsx server/scripts/save-transcript-now.ts --context "session end — [brief topic]"
```

This writes a `david-luca-chat`-tagged, verbatim `entry_type='conversation'` row. Record the printed cursor info. If the script reports "No new turns since last save", the periodic autosave already caught everything and you can proceed.

**Why this is first:** The holahola-session-end checklist exists partly to write the session wrap-up. Step 5 requires the verbatim transcript as its source. If the transcript isn't saved before you start writing, you are writing from memory — reconstruction, not presence. Save it first, then write from the saved record.

## Pre-step — Read the full day before writing anything

Pull today's conversation_memories and read the full `content` field of each entry — not just the summaries:

```
GET /api/conversation-memories?limit=10
```

The periodic autosave captures have verbatim turn-by-turn records. They give context the scratchpad misses: exact moments decisions were made, what David actually said, symmetries between early-session events and late-session builds. Write the wrap-up from this picture, not from memory alone.

Established as a standing practice July 11, 2026.

## Step 0 — Run the system verifier first (non-negotiable)

Before anything else:

```
npx tsx server/scripts/verify-system-health.ts
```

Zero red failures required. Yellow warnings must be reviewed. **Do not proceed to steps 1–6 if failures exist — fix them first.** This is the gate that prevents "marked done but missing tables / unwired workers / incomplete curriculum."

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
- The verifier in Step 0 is not optional — it exists because tasks have been marked done with missing DB tables, unwired workers, and incomplete curriculum. Show your work.
