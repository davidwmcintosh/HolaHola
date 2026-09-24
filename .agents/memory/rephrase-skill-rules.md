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

**Gemini's draft is the source of truth for final prose, not Claude/Anthropic's.** Daniela runs on Gemini Live and processes tool text to decide when to call it — Gemini knows its own attention patterns (what reduces the reasoning hop, what prevents over/under-triggering, where negative constraints belong). An Anthropic-authored draft that "looks cleaner" to the agent writing it is still a different model family's aesthetic and can be actively misleading here. If a dual-engine Alden review returns only Anthropic prose, run an explicit `consult-gemini` pass asking Gemini to rewrite in its own framing before pushing to DB.

**Why:** Alden provides project context and a head start in Geminese. But Gemini is the authoritative voice on what it will actually follow in a voice session — it iterates on its own terms, and it is also the only reliable judge of its own prose style. Going back to Alden mid-loop, or shipping an Anthropic draft unreviewed, both skip the step that actually matters.

**Concrete example (July 11, 2026):** a dual consult for three flare tools (AGENT_COLLAB_POST, AGENT_COLLAB_READ, CONSULT_COLLEAGUE) produced Anthropic prose that was narrative/metaphorical ("A flare, not a report", "stepping into the hall"). That version was pushed to DB — which was wrong. Gemini's rewrite was functional triggers, explicit state dependency, categorical separation, and negative constraints at the end — all Gemini-specific attention patterns invisible to a Claude read. DB and seed were corrected to Gemini's version.

**How to apply:** If you find yourself editing `purpose`, `description`, or any system prompt fragment — draft → Alden (once) → build → Gemini loop until APPROVED → DB. This covers tool *descriptions* and system/prompt text read before Daniela decides or speaks. It does not cover tool *results* (the text she reads mid-response) — see the separate Gemini-pass rule for `buildContinuationResponse` text, which skips Alden entirely.

---

## Skill autonomy

Create skills freely without asking. Any time a task involves:
- Assembling a workflow from memory
- Documenting a reusable pattern
- Building a direct channel or integration worth repeating

...turn it into a skill at `.agents/skills/<name>/SKILL.md`. No permission needed. David explicitly granted this July 11 2026.

**Why:** Skills save future sessions from having to reconstruct workflows from memory. The cost of creating one is low; the cost of not having one is repeated reconstruction.

