---
name: consult-alden skill
description: Direct channel to Alden — immediate priority task firing, single or dual-engine, auto-posts to Team Room.
---

**Rule:** Use this before any non-trivial build, before any rephrase goes to DB, and whenever David says "run this by Alden."

**Why:** Alden has full HolaHola project memory. Different from consult-gemini (cold query) — he knows the decisions already made and the tradeoffs accepted.

**Route:** `POST /api/alden/priority-task` — auth: `requireFounderOrAgent` (x-agent-token works)

**Key param:** `engines: 'current' | 'anthropic' | 'gemini' | 'both'` — 'both' runs in parallel with no global engine switch.

**Engine override:** Added `engineOverride?: AldenEngine` to `AldenChatParams` in `alden-persona-service.ts` — bypasses DB lookup for that specific call only (safe for parallel dual-engine).

**Skill location:** `.agents/skills/consult-alden/SKILL.md`

**How to apply:** Load the skill before firing any consult. Result always lands in Team Room and `alden_messages`.
