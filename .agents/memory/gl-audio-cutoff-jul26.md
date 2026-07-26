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

## Root cause confirmed (live test, July 26 2026)

Cutoff "So, let's" — log showed `Daniela thought (2048 chars)` = ~512 reasoning tokens at generationComplete. But GL reasons TWICE per turn when Archive Guardian fires a tool call: once before the tool call, once after receiving the tool result. Total reasoning: ~600-700 tokens. Audio for the response ≈ 375-500 tokens. Combined: ~975-1200 tokens > maxOutputTokens:1000.

**Actual root cause: `thinkingLevel: 'MEDIUM'`**, not `maxOutputTokens`.

MEDIUM mode consumes ~500+ reasoning tokens per turn. With two thinking phases (pre-tool + post-tool), the combined budget consistently hits the ceiling before audio finishes, regardless of where maxOutputTokens is set (unless set very high like 2500, which re-introduces monologues).

**Fourth fix applied:** `thinkingLevel: 'MEDIUM'` → `'LOW'`. LOW uses ~100-200 reasoning tokens per turn, leaving 800+ for audio (~32s). The system prompt, Archive Guardian grounding, and pre-session synthesis already provide the context she needs.

## Final configuration (July 26 2026 — Gemini-confirmed)

- `thinkingLevel: 'MEDIUM'` — restored (LOW reversed; reducing reasoning quality is wrong tradeoff)
- `maxOutputTokens: 2000` — raised from 1500 (Gemini: "1500 is tight for 139-tool session with reasoning")
- HIGH thinking evaluated and rejected: 1000-1200 reasoning tokens at HIGH → 300 left for audio at 1500 limit; also increases TTFT; conciseness is behavioral not computational

## How to apply
- Conciseness = behavioral constraint (system prompt + injection directives). Not a token budget problem.
- If cutoffs return: check `gl_usage_metadata` telemetry. candidatesTokenCount ≈ maxOutputTokens → raise ceiling.
- Do NOT raise maxOutputTokens beyond 2500 without testing (prior testing showed monologues at 2500).
- HIGH thinking requires 2500+ to function (1000-1200 reasoning tokens leave no room for audio at lower limits).
- MEDIUM + maxOutputTokens:2000 = safe for extended responses + full two-phase reasoning around tool calls.
