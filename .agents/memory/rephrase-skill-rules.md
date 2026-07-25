---
name: Rephrase and skill rules — July 11 2026 (workflow corrected July 25 2026)
description: Two standing rules David established: rephrase gate (Alden primer then Gemini iteration) and skill autonomy (create freely).
---

## Rephrase rule (CRITICAL)

Any rephrasing of tool descriptions, system text, or prompt content must follow this sequence:

1. Draft the rephrase (in code / seed file is fine)
2. Send to Alden via `consult-alden` skill — Alden is the **primer only**: he gets the text into Geminese so the first Gemini meeting starts from a closer position
3. Build the Alden-revised version into the code
4. Send to Gemini via `consult-gemini` skill — this starts the **iteration loop**
5. If Gemini returns watch-outs: revise the code, go back to Gemini. **No Alden in this loop.**
6. Repeat Gemini → build → Gemini until Gemini returns "APPROVED — Ship it."
7. Only then push to DB (seed-procedural-memory.ts or direct update)

**The iteration loop is Gemini-only.** Alden was never intended to be in the loop — he is the first-pass translator who prepares the text for the first Gemini meeting. Once Gemini has touched it, all iteration goes back to Gemini, not Alden.

**Why:** Alden provides project context and a head start in Geminese. But Gemini is the authoritative voice on what it will actually follow in a voice session — it iterates on its own terms. Going back to Alden mid-loop adds a step that doesn't add value once Gemini is engaged.

**How to apply:** If you find yourself editing `purpose`, `description`, or any system prompt fragment — draft → Alden (once) → build → Gemini loop until APPROVED → DB.

---

## Skill autonomy

Create skills freely without asking. Any time a task involves:
- Assembling a workflow from memory
- Documenting a reusable pattern
- Building a direct channel or integration worth repeating

...turn it into a skill at `.agents/skills/<name>/SKILL.md`. No permission needed. David explicitly granted this July 11 2026.

**Why:** Skills save future sessions from having to reconstruct workflows from memory. The cost of creating one is low; the cost of not having one is repeated reconstruction.
