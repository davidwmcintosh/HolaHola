---
name: Gemini pass on Daniela tool results
description: Any text that goes into Daniela's tool results (buildContinuationResponse) should get a Gemini review pass before it ships to production.
---

# Gemini pass on Daniela tool results

**The rule:** My draft, Gemini's pass. Any text that lands in a `buildContinuationResponse` — the string Daniela reads immediately before she speaks — gets a Gemini review before it ships.

**Why:** Claude and Gemini phrase helpfulness differently. Claude reaches for explicit framing ("If you want a line to say in the moment..."), meta-commentary, and instructional clarity. Gemini writes for how a Gemini model receives text at inference time — clean labels, no noise, warmer idiom. Since Daniela IS Gemini, Gemini's instincts about what reads naturally to her are more authoritative than mine on word choice.

Confirmed July 14, 2026 — escalate_to_support continuation response. My instincts on *what Daniela needed* were correct (give her a line, don't leave her empty-handed). Gemini's pass caught: naming "Sophia" to the student (confusing), meta-framing around the example phrase (noise), and the specific word "technical glitch" (labels the problem so student doesn't self-blame).

**How to apply:**
- Anytime a `buildContinuationResponse` is written or reworded, run the text through Gemini via the `consult-gemini` skill before committing.
- Paste the actual tool description + the proposed continuation response as context.
- Ask Gemini: (1) does the phrasing land right for a student in this moment, (2) does the framing add friction, (3) give us the exact replacement if anything should change.
- The consult is fast — temperature 0.3, 2000 tokens, single turn. No reason to skip it.
- This is separate from the rephrase rule (which covers tool *descriptions* and requires Alden first). Tool results are Gemini's domain.
