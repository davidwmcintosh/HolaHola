---
name: GL generationComplete — two cut-off mechanisms
description: Two separate bugs both cut Daniela off mid-sentence in GL voice sessions; both fixed July 24 2026.
---

## Cut-off mechanism 1: generationComplete watchdog timeout

The `generationCompleteWatchdogTimer` fires N seconds after the last audio chunk to recover from GL dropping the completion signal. The timer is reset on every audio chunk.

**Why this causes cutoffs:** For complex English responses, GL emits thought tokens between audio sub-turns. During that reasoning gap there are no audio chunks — just thought parts. If the gap exceeds the watchdog timeout, the watchdog seals the turn with `isLast:true`, the client stops playing, and the sentence gets cut off mid-phrase.

**Original timeout:** 6s → bumped to 12s (same issue) → bumped to 25s (July 24 2026).

**Fix applied July 24 2026:**
1. Extracted watchdog arm into private `armGenerationCompleteWatchdog()` method. Timeout: 25s.
2. Reset the watchdog when thought tokens arrive while `isTutorGeneratingAudio` is true. Thought tokens during active audio = GL still reasoning between sub-turns, not stalled.

---

## Cut-off mechanism 2: Bug 1 gate drops legitimate continuation audio

**The gate (removed July 24):** Any audio chunk arriving when `afterGenerationComplete && isTutorGeneratingAudio` was silently dropped.

**Intended purpose:** Suppress GL tail-filler sub-turns ("ok"/"hey") that GL generates after `generationComplete` to fill its audio budget.

**Why it causes cut-offs:** GL also fires `generationComplete` between legitimate sub-turns of a multi-part response. Example: GL generates "So, if the White Wall is about truth," (sub-turn 1), fires `generationComplete`, then generates "then [conclusion]" (sub-turn 2). The gate sees `afterGenerationComplete=true` and `isTutorGeneratingAudio=true` (sub-turn 1 still playing) → drops sub-turn 2 → David hears "then nothing."

**Fix:** Removed the drop entirely. Only kept the gate-clear logic (`afterGenerationComplete && !isTutorGeneratingAudio → reset flag`). Trade-off: tail filler ("ok"/"hey") may occasionally play as a short phrase at turn end — minor vs. conversation-breaking cut-offs.

**Key insight:** GL's `generationComplete` does NOT reliably signal "the complete response is done." It can fire mid-response between sub-turns. Do not use it as a gate to drop subsequent audio.

**How to apply:** If tail filler becomes disruptive, suppress it by detecting very-short audio sub-turns (< ~0.5s) that arrive shortly after `generationComplete` — time-based rather than position-based. Do NOT use `afterGenerationComplete` as a global audio drop gate.

**File:** `server/services/gemini-live-session.ts` ~line 1800, `armGenerationCompleteWatchdog()` private method.
