---
name: GL Tool-Driven State pattern
description: How to make Daniela hold a behavioral mode (teaching sequence, placement assessment) across multiple GL exchanges without drift
---

# GL Tool-Driven State Pattern

## The rule
GL cannot reliably hold "I am in mode X" intent across 8–12 exchanges via verbal instructions alone. The "helpful tutor" bias overrides mode instructions that were set earlier in the system prompt. The fix is Tool-Driven State: the entry tool returns the mode's protocol as its tool result (highest attention priority in GL), and the backend enforces state via session flags.

**Why:** Gemini architectural review (June 24, 2026) confirmed: GL prioritizes recent tool outputs in its attention head above earlier system prompt content. A tool result injecting "you are in assessment mode — do not correct errors" beats a system prompt instruction set 30 turns ago.

## How to apply

Three parts required:

1. **Entry tool** — calls `(session as any).modeFlag = { active: true, counter: 0 }` and stores the protocol as `(session as any).modeResult = { ... rules, instructions ... }`. The `buildContinuationResponse` returns this as the tool result so GL reads it as the highest-priority context.

2. **Exit tool** — checks `(session as any).modeFlag?.active`. If minimum counter not met, sets `(session as any).exitBlocked = true` and breaks without writing to DB. The `buildContinuationResponse` returns the blocking message. If counter OK, clears flag and proceeds.

3. **Minimum turn guard** — increment the counter each time the exit tool is called during mode. Block early exits with an explicit instruction: "You have had N exchanges. You need at least 8." This prevents GL's laziness trap (calling the exit tool after 3 exchanges).

## The "Silent Break" anti-pattern
When a handler silently breaks with no tool result, GL receives the default `{ result: 'done' }` and believes the tool succeeded. This is dangerous for visual tools (textbook page, whiteboard) — Daniela will reference content the student never saw. Always set a session flag and return a recovery instruction via `buildContinuationResponse`. The recovery instruction must include: "Do NOT tell the student the tool was blocked. Do NOT apologize. Simply ask a natural follow-up question."

## Turn counter must count real utterances, not tool calls
The minimum-turn guard for an assessment should check `assessmentTurnCount` (incremented in `_doFlushTranscripts` on real user utterance flush) NOT the number of times the exit tool was called. A well-behaved Daniela who calls `set_actfl_level` exactly once at turn 10 would have `exchangeCount = 1`, triggering a false block.

## Rubric injection format
The rubric tool result must be a prose-wrapped string, not bare `JSON.stringify(rubric)`. GL treats bare JSON as "data to summarize" and may narrate it. Pattern:
`"ASSESSMENT MODE NOW ACTIVE. These are your behavioral constraints...\n\n${JSON.stringify(rubric)}\n\nAcknowledge by starting the conversation naturally..."`

## Implemented examples

- **Chapter teaching**: `start_teaching_loop` (entry) → `advance_loop_step` (per exchange) → loop completes naturally. No exit guard needed (loop has built-in 4-step completion).
- **Placement assessment**: `start_placement_assessment` (entry, injects ACTFL rubric) → natural conversation → `set_actfl_level` (exit, guarded at <6 exchanges). Handler files: `native-fc-handlers.ts` lines ~4222 (entry) and ~4130 (exit guard).

## The "tools exist, procedure doesn't" anti-pattern
Daniela's knowledge gap is almost always: tools exist in tool_knowledge + registry, but no `tutor_procedure` fires when the student triggers the intent. Always check `tutor_procedures` for the relevant trigger before assuming the system is broken. If no procedure exists, add one — the procedure is what connects "student says X" to "Daniela calls the right tool."
