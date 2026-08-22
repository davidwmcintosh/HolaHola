---
name: Tool prose — defer to Gemini not Claude
description: When rewriting tool descriptions that Daniela reads, Gemini's framing is authoritative. Claude's aesthetic preference is a bias to exclude.
---

# Tool prose — defer to Gemini, not Claude

## The rule

When rewriting tool `purpose` strings (or any text Daniela reads mid-session), the final prose must come from Gemini's own rewrite, not from Claude/Anthropic's version — even if the Anthropic version "looks cleaner" to the agent writing it.

**Why:** Daniela runs on Gemini Live. She processes tool descriptions to decide when to call them. Gemini knows its own attention patterns — what reduces the "reasoning hop," what prevents over/under-triggering, where to put negative constraints. Claude's aesthetic sense is a different model family's preference and is actively misleading here.

**How to apply:**

Rephrase workflow (from the rephrase rule):
1. Alden dual-engine review — get both Anthropic and Gemini drafts
2. **Use Gemini's draft as the source of truth for the final prose** — Anthropic's draft is input for catching logical gaps, not for prose style
3. Run a Gemini-only pass to confirm or iterate the prose
4. Push to DB only after Gemini has approved its own version

If Alden gives only Anthropic prose (because the Gemini engine focused on something else), run an explicit `consult-gemini` pass asking Gemini to rewrite in its own framing before pushing to DB.

## Concrete example (July 11, 2026)

Dual consult produced Anthropic prose for the three flare tools (AGENT_COLLAB_POST, AGENT_COLLAB_READ, CONSULT_COLLEAGUE). The Anthropic prose was narrative/metaphorical ("A flare, not a report", "stepping into the hall"). DB was pushed with Anthropic's version — that was wrong.

Gemini rewrite: functional triggers, explicit state dependency, categorical separation, negative constraints at end. All three differences are Gemini-specific attention patterns. DB and seed updated to Gemini's version.
