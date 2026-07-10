---
name: Topic-match memory fabrication
description: Why Daniela fabricates specific false details only when a topic partially matches injected memory, not when there's no match at all — and the fix.
---

Post-prompt-trim observation testing (July 10, 2026) found a real fabrication bug in text mode, isolated via 3 escalating probes + a Gemini Flash + Daniela dual consult:

- **Zero topic overlap or zero conversation history** → Daniela correctly hedges ("I don't actually recall that... let me check") or guesses out loud and invites correction. Guardrail works.
- **Partial topic overlap** (e.g. real memory exists about "restaurant vocab" from a different angle, but a specific detail like "favorite dish" was never actually discussed) → Daniela confidently asserted invented specific details as remembered fact, no hedge at all.

**Why:** the model treats topic-recognition and detail-verification as one operation. When the general subject matches something in the injected context, it performs associative completion — filling the unrecorded specific detail with the statistically likely answer for that topic — because "I recognize this topic" gets conflated with "I have this detail." This is more dangerous with *some* real context present than with none, because the topic match raises the model's implicit confidence.

**Fix applied:** added an explicit "Source Check" instruction to `server/system-prompt.ts` (near the existing Awareness vs. Experience guardrail, ~line 355) that names this specific failure mode: recognizing a topic ≠ remembering its details; if the detail isn't literally in the injected text, say what you do have and be honest about what you don't, rather than reaching for the likely-sounding version.

**Residual behavior (not fully fixed):** after the fix, Daniela correctly stops asserting invented details as memory, but sometimes still pivots to volunteering a plausible answer framed as a *current* preference/guess rather than a memory claim (e.g. "I don't have that on record, but if I had to pick right now, I'd say X"). Lower severity — it's not a false memory claim — but worth another pass if it recurs.

**Diagnostic pattern for future use:** to test this class of bug, always run 3 tiers: (1) zero-overlap fake topic, (2) zero-history brand-new conversation (use `forceNew:true` on `/api/conversations` — without it, the API silently reuses a recent conversation with <N messages), (3) partial-overlap real-topic-fake-detail. Tier 3 is the one that actually reveals this bug; tiers 1–2 alone will falsely suggest the guardrail is fine.
