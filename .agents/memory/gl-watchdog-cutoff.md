---
name: GL generationComplete watchdog — inter-chunk cutoff
description: watchdog fires after N seconds of no audio chunks, sealing turn prematurely mid-sentence; fixed by bumping to 25s + resetting on thought tokens
---

The `generationCompleteWatchdogTimer` fires N seconds after the last audio chunk to recover from GL dropping the completion signal. The timer is reset on every audio chunk.

**Why this causes cutoffs:** For complex English responses (heavy reasoning, long sentences), GL emits thought tokens between audio sub-turns. During that reasoning gap there are no audio chunks — just thought parts. If the gap exceeds the watchdog timeout, the watchdog seals the turn with `isLast:true`, the client stops playing, and the sentence gets cut off mid-phrase.

**Original timeout:** 6s → bumped to 12s (same issue) → bumped to 25s (July 24 2026).

**Fix applied July 24 2026:**
1. Extracted watchdog arm into private `armGenerationCompleteWatchdog()` method. Timeout: 25s.
2. Reset the watchdog when thought tokens arrive while `isTutorGeneratingAudio` is true. Thought tokens during active audio = GL still reasoning between sub-turns, not stalled.

**How to apply:** If cutoffs resume, check `[GeminiLive] generationComplete watchdog fired` in server logs. If it's firing for inter-chunk pauses rather than true stalls, bump the timeout further or add more signal sources (e.g. audio transcript parts) to the watchdog reset.

**File:** `server/services/gemini-live-session.ts` — `armGenerationCompleteWatchdog()` private method.
