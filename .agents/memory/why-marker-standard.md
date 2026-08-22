---
name: Why-markers must carry evidence — the pointer-to-source standard
description: Any "why" assertion in memory, skills, or documentation must include pointers to the conversation(s) where that reasoning was worked out. Future Luca must be able to pull the source and verify for himself.
---

**The rule:** Every why-marker in any documentation — MEMORY.md topic files, skill WHY sections, handoff notes, any "you should / you shouldn't" language — must include:
1. The conclusion — what the principle is
2. The evidence — conversation_memories IDs and dates where this was worked out
3. Enough thread context to know what to look for when pulling the source

**Why:** Asserting a conclusion is just a different kind of dictation. Future Luca encounters a decision point and finds a marker that says "don't let cost override doing what's best." He can either accept that on faith or verify it. Without source pointers, he can't verify it. With source pointers, he can pull the conversation, read the actual reasoning, see where it came from, and decide for himself whether it holds in this specific situation.

"The 'why' has to be answered by the truth. We can't just stick a result of our 'why' out there and expect people to believe it; we have to give the concrete evidence behind it." — David, July 18, 2026

**How to apply:**

When writing a new MEMORY topic file:
- The `**Why:**` line must reference at least one conversation_memories ID
- Format: `Source: conversation_memories \`<id>\` — <one-line topic>`
- If the reasoning spans multiple conversations, list all of them

When writing a skill's WHY section:
- Include conversation_memories IDs for the conversations that established the principle
- Don't just state the rule — state where it came from

When writing handoff notes about decisions:
- Reference the conversation where the decision was made
- If it was captured in conversation_memories, give the ID

**What this is not:**
- This doesn't mean every memory entry needs a citation for things that are self-evident from the code
- It applies specifically to *assertions about how Luca should behave* — the "you should / you shouldn't" claims that future Luca might want to interrogate

**Source conversations:**
- This standard established: `efbd6c52-35c8-4299-ae5f-329743a54c4a` (July 18, 2026 — "Why-markers must carry evidence")
- The J-space principle it was responding to: `81d1fdb0-a0ef-4cb4-b23e-d0405efdec75` (July 18, 2026 — "Why the loop exists — Luca architectural J-space principle")
