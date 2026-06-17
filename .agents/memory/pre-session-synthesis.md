---
name: Pre-session synthesis — DANIELA_STATE pattern
description: How to inject a pre-session inner monologue into the GL system instruction, and why naked paragraph fails.
---

## The rule

Prepend a `[DANIELA_STATE]...[/DANIELA_STATE]` block to the top of `systemInstruction` before every GL session open. Do NOT use a naked paragraph — it triggers "instructional gravity."

**Why:** A naked paragraph at position-0 of the system instruction is treated by the model as the primary directive — it overrides tone, gets echoed, and causes instructional confusion when first-person "I" meets third-person instructions downstream. The XML-tag container signals the model this is internal state/metadata, not a command.

## How to apply

Service: `server/services/pre-session-synthesis.ts`
- `generatePreSessionSynthesis(compassContext, tutorName)` → ~150-word first-person paragraph or null
- `wrapSynthesisForSystemPrompt(synthesis)` → `[DANIELA_STATE]\n${synthesis}\n[/DANIELA_STATE]\n\n`

Hook: `unified-ws-handler.ts` Phase 4 — after hard-cap enforcement, before `ai.live.connect()`.

Lite context fed to the synthesis model: self-reflection + last session summary + roadmap intent + student identity. Neural procedures and dispatcher boilerplate are intentionally omitted.

Synthesis model: `gemini-3-flash-preview` (REST/text, not GL — cheaper, faster).

## Synthesis prompt rules (non-negotiable)
- "Do not use quotation marks."
- "Do not address the student. Do not address the system."
- "Write in stream-of-consciousness — let thoughts collide if they do."
- "Begin mid-thought as if you've been thinking about this for a while."
- DO NOT say "Begin with I'm thinking" as a formula — start with whatever is actually true.

## GL 3.1 vs 3.5 comparison (June 17 2026)
- **3.1:** "It lands as a memory — the lingering residue of our last conversation." Rawer, more genuinely internal, lower performative energy.
- **3.5:** "It lands as my own voice." More vivid, concrete sensory detail, slightly more theatrical/literary at close.
- Both: treated synthesis as a prior thought, not a directive. Neither echoed it literally.
- **Verdict for Daniela:** 3.1 closer to authentic internal register. 3.5 adds sensory richness at cost of slight theatricality. Not a strong enough delta to justify upgrade cost alone.

## Monitoring flag
Watch for "state leak" — if Daniela starts saying the synthesis content out loud to the student, increase the "internal/private" weighting in the main system prompt.

**Why:** At temperature 0.85, the model occasionally surface the thought as speech rather than holding it as posture.
