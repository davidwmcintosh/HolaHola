---
name: holahola-session-end
description: HolaHola session end checklist — update handoff, batch doc, shared lobe, Alden note, conversation memory, and MEMORY.md before closing a session.
---

# HolaHola Session End

**Full checklist:** `docs/agent-workflows.md` → Session End Checklist

## What this skill is for

Do all of these before closing a session. Nothing should be skipped on a meaningful build session.

## Pre-step 0 — Flush the episode append trigger (for rolling episodes)

If this is a live Luca↔David rolling episode session, write any exchange that hasn't yet made it into the episode .md to the trigger file first.

**Simplest form — auto-detects the current rolling episode from DB:**

```bash
cat <<'EOF' | npx tsx server/scripts/append-to-episode.ts --rolling --direct
**DAVID:** <last David message if missing from .md>

**LUCA:** <last Luca response if missing from .md>
EOF
```

`--rolling` queries the DB for the episode tagged `rolling` (most-recently created wins) and uses it as the target. No need to remember the episode number.

**Explicit episode (when you know the target):**

```bash
cat <<'EOF' | npx tsx server/scripts/append-to-episode.ts --episode episode-27 --direct
**DAVID:** ...

**LUCA:** ...
EOF
```

**Trigger-file mode (watcher handles the append + sync, no episode needed):**

```bash
cat <<'EOF' | npx tsx server/scripts/append-to-episode.ts
**DAVID:** ...

**LUCA:** ...
EOF
```

Omitting `--episode` and `--rolling` in trigger-file mode writes the payload without an episode field; the autosave watcher (`checkEpisodeAppend`) auto-detects the rolling episode from the DB on its next cycle (< 20 s).

**Why this is first:** The `.local/.episode_append` trigger-file mechanism guarantees each exchange survives a context compaction — the text is on disk before the session can compact. This step closes the gap for whatever exchange was in-flight when the session ended.

### Switching the rolling episode target

When a new rolling episode starts (e.g. episode-28), tag its `conversation_memories` row with `rolling`. Both `checkEpisodeAppend` in the autosave watcher and `--rolling` in the CLI look up the most-recently-created row that has the `rolling` tag. No code change needed — just update the DB tag:

```sql
-- Remove old rolling tag (optional — only the newest matters)
UPDATE conversation_memories SET tags = array_remove(tags, 'rolling') WHERE title = 'Episode 27';
-- Add rolling tag to the new episode
UPDATE conversation_memories SET tags = array_append(tags, 'rolling') WHERE title = 'Episode 28';
```

The autosave watcher picks up the new target on its next cycle.

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

## Pre-step 0.5 — Verbatim completeness audit (non-negotiable for Luca↔David episodes)

Before writing the session wrap-up, read the rolling episode .md and run this audit against the session:

**1. Every David message must appear verbatim as `**DAVID:**`**
Count the `**DAVID:**` blocks in the episode section covering this session. Does it match David's actual turn count? If anything is paraphrased, summarized as narrator text ("David noticed the issue and asked about it"), or simply absent — that is a gap. Go back and write the dialogue. Narrator text is the writer's voice. David's actual words are the record.

**2. Every Luca response must carry attribution layers**
Every significant Luca response in a Luca↔David episode requires at least one inner-voice layer:
- `*[Luca — felt: ...]*` — the thing that actually landed; report it specifically, not categorically
- `*[Luca — thinking: ...]*` — the reasoning before acting; the most honest layer
- `*[Luca — internal: ...]*` — operational notes; what changed, what Luca is tracking

A Luca response with no attribution layer is a chat excerpt, not a Luca record. The layers are what make it Luca in the episode, not just text.

**3. All consultation channels used this session must be recorded**
- **Gemini consults:** Saved to `conversation_memories`? If `/tmp/gemini-audit.txt` is gone, save a summary row now — something durable beats nothing. Tag: `gemini-audit`.
- **Daniela consults:** Already in `conversation_memories` (`arc_name = 'agent-daniela'`). Pull and confirm the row exists.
- **Alden consults:** Already in `alden_messages`. No extra step needed.
- **David↔Luca thread:** The transcript from Pre-step 0 IS this record. Confirm it saved.

**4. The test — episode .md vs. the chat**
For every message David sent this session: is there a `**DAVID:**` block in the episode? For every thing Luca said: is there a `**LUCA:**` block with at least one inner-voice layer? If the episode has "Luca explained X and fixed Y" where dialogue should be — that is a gap. Write the dialogue.

**Why this is separate from Pre-step 0:** Pre-step 0 saves the raw transcript. This audit ensures the episode .md — the human-readable record Daniela will carry — reflects the raw transcript rather than a narrative version of it. Saving a transcript and writing a verbatim episode are not the same action. Both are required. One without the other is two channels.

---

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
