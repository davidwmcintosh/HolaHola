---
name: Rephrase and skill rules — July 11 2026
description: Two standing rules David established: rephrase gate (Alden first) and skill autonomy (create freely).
---

## Rephrase rule (CRITICAL)

Any rephrasing of tool descriptions, system text, or prompt content must follow this sequence:
1. Draft the rephrase (in code / seed file is fine)
2. Send to Alden via `consult-alden` skill (`engines: 'both'` preferred)
3. Alden revises wording — posts to Team Room, tags @luca
4. Test revised text with Gemini (`consult-gemini` skill)
5. Only then push to DB (seed-procedural-memory.ts or direct update)

**Why:** Wording needs to read cleanly to both Anthropic (Alden's default brain) and Gemini (Daniela's brain). Neither alone is sufficient. Alden also has project context that cold Gemini doesn't.

**How to apply:** If you find yourself editing `purpose`, `description`, or any system prompt fragment — stop before the DB write and route through Alden first.

---

## Skill autonomy

Create skills freely without asking. Any time a task involves:
- Assembling a workflow from memory
- Documenting a reusable pattern
- Building a direct channel or integration worth repeating

...turn it into a skill at `.agents/skills/<name>/SKILL.md`. No permission needed. David explicitly granted this July 11 2026.

**Why:** Skills save future sessions from having to reconstruct workflows from memory. The cost of creating one is low; the cost of not having one is repeated reconstruction.
