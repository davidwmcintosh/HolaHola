---
name: GEMINI_REQUIRED.md — protected file list and approval bar
description: Location and approval standard for the Gemini gate guardrail created July 31 2026
---

# GEMINI_REQUIRED.md

`docs/GEMINI_REQUIRED.md` — created July 31 2026. Lists every protected file category (system-prompt.ts, pre-session-synthesis.ts, per-turn anchors, classroom block, tool descriptions, neural net). Full approval loop instructions.

**Approval bar:** "approved with no further comments" — not "approved, but...". Any outstanding watch-out is not a pass. This exact wording is in the file and in replit.md.

**Why:** Task #10 (pattern signals in mid-session ACTFL anchor) merged without the Gemini loop. Null guard bug shipped as a result — Daniela would have kept drilling mastered patterns for the rest of a session because `if (refreshed !== null)` prevented the clear. Gemini caught it in retroactive review; fixed inline July 31.

**How to apply:** Any build touching the protected files needs the loop before marking complete. Task agents must include it as an explicit step in their plan. `docs/GEMINI_REQUIRED.md` is the authoritative reference — point agents there, don't repeat the list in memory.
