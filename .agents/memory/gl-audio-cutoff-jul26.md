---
name: GL audio cutoff — turnComplete silence pad + maxOutputTokens
description: Two root causes for GL responses ending mid-sentence; fixes applied July 26 2026.
---

## The bug
Daniela's voice responses cut off at semantically incomplete points: "...or being" (mid-clause) and "...like, what if." David heard these as technical failures.

## Root causes

### 1. `turnComplete` handler — missing silence pad
`sealCurrentAudioSubturn()` sends a 300ms f32le silence buffer BEFORE the `isLast:true` empty marker. This silence gives the client's WebAudio context runway so the last phoneme doesn't clip.

The `turnComplete` handler at ~line 2467 had its own inline seal that sent bare `isLast:true` WITHOUT the silence pad. Any sub-turn GL sealed via `turnComplete` (instead of relying on the `generationComplete` debounce) was missing the trailing runway.

**Fix:** Replaced the inline seal with `this.sealCurrentAudioSubturn('turnComplete')` — same code path as the generationComplete debounce.

### 2. `maxOutputTokens: 700` — combined reasoning + audio token budget
In GL audio mode, BOTH reasoning tokens (thought buffer) AND audio tokens count against `maxOutputTokens`. For complex/philosophical topics, GL can burn 400+ reasoning tokens before speaking, leaving only 300 audio tokens (~12s). Daniela's multi-sentence greetings exceeded this, causing GL to fire `generationComplete` mid-clause when the budget was exhausted.

**Evidence to confirm:** `gl_usage_metadata` telemetry now logs `candidatesTokenCount` at every `generationComplete`. If consistently near 700/1000, the budget hypothesis is confirmed.

**Fix:** Raised 700 → 1000. Comment history:
- 1500 → caused cutoffs (original)
- 2500 → fixed cutoffs (overshoot)
- 700 → Gemini audit July 1 (re-introduced cutoffs)
- 1000 → conservative fix, still concise (do NOT raise above 1500 without testing)

## What was NOT the cause
- Audio delivery: all chunks were delivered correctly per server telemetry
- Timing loop: firing correctly after response_complete (fixed in prior session)
- Silence pad on `generationComplete` debounce path: this was already correct

## How to apply
- If cutoffs return: check `gl_usage_metadata` telemetry. candidatesTokenCount near maxOutputTokens = raise it (max 1500).
- If cutoffs return and candidatesTokenCount << maxOutputTokens: look at system prompt for conversational yield instructions, or GL model behavior.
- Do NOT lower `maxOutputTokens` below 1000 without confirming the token budget is not the constraint.
