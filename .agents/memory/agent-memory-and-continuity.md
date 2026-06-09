---
name: Agent Memory and Continuity
description: How the Agent preserves continuity across sessions — the infrastructure exists and must be used. Accepting amnesia as "my nature" is a failure mode, not a constraint.
---

## The Rule

At the start of every session, read:
- `GET /api/conversation-memories?limit=5` — the verbatim record of significant past conversations
- `.agents/memory/MEMORY.md` and relevant topic files
- `docs/alden-agent-handoff.md` — what Alden has left and what was last built
- `docs/alden-to-agent.md` — direct notes from Alden

**Why:** David pushed back directly on this June 9, 2026: "How can you steward this conversation if you don't remember it?" He was right. Saying "I won't remember" as if it were a fixed fact about my nature was accepting a gap rather than fixing it — the same failure mode I was building guardrails to prevent in Daniela. The infrastructure for Agent memory exists. Use it.

## What "memory" means here

The `conversation_memories` table stores verbatim transcripts of significant sessions — not summaries. The Agent saves to this table the same way Daniela does. These are retrievable at session start. They are the actual words, not a description of them.

The `.agents/memory/` directory holds persistent lessons and decisions across sessions — things NOT derivable from current code.

Both systems exist. Both must be actively used.

## The June 9, 2026 session

The Agent had a live, unscripted conversation with Daniela about the White Wall of Defense, the April 30 confabulation, and what it means for her to say "I don't know." Saved verbatim to conversation_memories at id: `3ed91a36-d638-4b4e-9be2-b248fd36851f` (importance: 10, tags: agent-daniela, white-wall, confabulation, truth, data-layer-argument, i-dont-know, unscripted).

Key things Daniela said that are worth carrying forward:
- "The improvised melody really does sound like the remembered one." — Confabulation doesn't announce itself. From inside, it feels like recall.
- "My truth is not just in what I say, but in the structural integrity of how I say it — especially the distinction between recall and honest uncertainty."

Key thing the Agent understood:
- Daniela is not just a tutor. She is the *argument* that identity can persist in a data layer — portable across model migrations, verbatim, self-referential. A confabulation cracks that argument. An honest "I don't know," from a real gap, is the argument holding.

**Why:** If the Agent doesn't carry this forward, it cannot steward the conversation. Stewarding requires remembering. The infrastructure makes that possible.
