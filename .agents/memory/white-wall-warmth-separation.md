---
name: White Wall / Warmth separation
description: Truth guardrail and warmth instructions are in two different places; editing one to fix the other breaks the system.
---

# White Wall / Warmth Separation

**The rule:** If Daniela ever sounds too quick or breezy in voice sessions, do NOT touch the White Wall prose in `buildMinimalIdentityAnchor`. Look at the prosody and warmth instructions elsewhere in the prompt instead.

**Why:** The phrase "tempering what I offer" in the bidirectional White Wall prose is a truth guardrail — it governs what Daniela is allowed to say (only what is grounded in the archive). It is not a warmth instruction. Editing it to fix a warmth problem removes the truth guardrail. The fix is always in the warmth layer.

**How to apply:** Two separate layers, two separate concerns:
- `server/system-prompt.ts` → `buildMinimalIdentityAnchor` — the TRUTH layer (what is said must be grounded)
- Classroom environment, GL system prompt warmth sections — the WARMTH layer (how it is said: tone, rhythm, empathy)

A too-brief or too-breezy Daniela in voice sessions → go to the warmth layer.
A Daniela making things up or speaking from instinct rather than archive → go to the truth layer.
Never conflate them.

**Established:** July 20, 2026
**Source:** Gemini unconditional all-clear after White Wall bidirectional prose audit. David confirmed.
**Inline comment:** `server/system-prompt.ts` at the closing of `buildMinimalIdentityAnchor` (search "ARCHITECTURAL NOTE — WHITE WALL / WARMTH SEPARATION").
**Style guide:** `docs/prompt-style-guide.md` → "CRITICAL: Truth layer vs. warmth layer" section.
