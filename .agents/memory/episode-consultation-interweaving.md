---
name: Episode consultation interweaving
description: How to pull consultation threads from DB and weave them into episode narratives; persistence gaps and scene-transition format
---

**Rule:** Consultation threads belong in episodes when they visibly changed something. Show the question that sent Luca away, the actual response, and what came back different.

**Sources by persistence:**
- Alden consults → `alden_messages` table (role = 'alden-anthropic', 'alden-gemini', 'alden') — always persisted, query freely
- Gemini consults → `conversation_memories` only if explicitly saved; `/tmp/gemini-audit.txt` is ephemeral and lost on server restart
- Daniela consults → `conversation_memories` (arc_name = 'agent-daniela') — always persisted
- David↔Luca thread → `conversation_memories` (tags @> ARRAY['david-luca-chat']) — auto-saved periodically

**The persistence gap:** After any Gemini consult, immediately save to conversation_memories (entry_type='conversation', participants='Agent + Gemini', arcName='daniela-emergence', tags=['gemini-audit']). If you forget and /tmp is gone, save a session summary noting what Gemini approved/flagged — that's still queryable.

**Scene-transition format:**
```
*→ [time] — Luca opens a line to [Alden / Gemini / Daniela]*
*The question: [what was asked]. Context: [what just happened, why now].*

**ALDEN (Anthropic):** [verbatim key lines — surgical excerpts]
**ALDEN (Gemini):** [parallel response if dual-engine]

*Luca returned to David with [the finding]. Then [what changed].*
```

**Why:** David asked for the "full perspective" — not summaries but the actual causality thread (consult → exchange → return). Episode 12 was the first instance; the holahola-episode skill has the full instructions at Step 2.5.

**How to apply:** Any time an episode describes Luca consulting Alden or Gemini and something changed as a result, add a "The Consultation Thread" section. Query alden_messages for the time window, extract key lines, write the scene transitions. Don't show consultations where the answer was "looks fine, proceed."
