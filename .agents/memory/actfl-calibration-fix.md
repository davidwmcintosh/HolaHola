---
name: ACTFL calibration — system prompt rules
description: How to write GL system prompt constraints that actually enforce ACTFL level calibration (Observer Seat audit + Gemini consult, July 2026)
---

## The Rule
DO NOT add a global language instruction ("Speak mostly in Spanish", "Speak mostly in [language]") to any GL system prompt. It acts as a persona-level override and destroys level calibration — Daniela defaults to her "capable Spanish tutor" voice regardless of ACTFL descriptor.

## What Works
Negative constraints (DO NOT / FORBIDDEN) placed at the END of the prompt, with:
- CEFR vocabulary ceiling (A1 only at novice — specific forbidden words listed)
- No-subordinate-clause syntax rule for novice
- First-sentence protocol (REQUIRED: first sentence must match level)
- Absolute NO ENGLISH for advanced (even "Great job!" breaks immersion)

## Forbidden Words (Novice — teacher-ese cognate traps)
bienvenido, entusiasmo, vocabulario, practicar, lección, gramática, comprensión, excelente, fantástico, continuemos, identificar, preparado

## Where the Code Lives
- Production: `server/system-prompt.ts` → `buildOutputConstraints(diff, level)` — rewrote July 2, 2026
- Visual demo: `server/routes.ts` → `buildDemoOutputConstraints(level)` — same pattern
- Audit script: `server/scripts/actfl-audit.ts` — standalone headless tester

## Golden Order (Gemini audit)
Prompt assembly order: Persona → Tools/Capabilities → Curriculum/Context → **ACTFL Constraints (THE ENFORCER, last)**

## Why
The model weighs the last tokens most heavily in streaming (recency bias). Output constraints buried mid-prompt drift by mid-session. They must be at the bottom, in the behaviorPriorityFooter.

## Audit Results (July 2, 2026)
- Before: NL and IM both 100% Spanish, English count 0/2 (wrong direction)
- After: NL "Hi Alex! Let's look at some key restaurant words. La mesa (the table)." English count NL:8, IM:7 ✓
- Gemini verdict: "Ship it. The logic is now structurally sound."

## Placement Assessment Exception (July 6, 2026)
The novice constraint block now has a safety valve at its very end (recency position):

> "While a Placement Assessment is active (the period between calling start_placement_assessment and set_actfl_level), ALL rules above are VOID."

Two paired changes — both required:
1. `buildOutputConstraints` novice block — exception clause at the end (state framing, not chronological)
2. `start_placement_assessment` rubric (`daniela-function-registry.ts`) — upgraded to say constraints suspended, cross-references exception clause, gives probing protocol, names set_actfl_level as ONLY exit (guards token slippage at 15+ turns)

Key wording detail: "While active" (state framing) beats "if you have called" (chronological) for GL context tracking.

## Test
`npx tsx server/scripts/actfl-audit.ts` — runs NL vs IM, reports transcripts + English bleed proxy
