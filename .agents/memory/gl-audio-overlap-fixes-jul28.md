---
name: GL audio overlap — three fixes July 28
description: Three GL audio bugs fixed July 28 2026: isGreetingTurn guard, allLatencyHeavy over-gate, and new-turn progressiveScheduledTime overlap + buffering→idle playback_ended gap.
---

## Fix 1 — Greeting audio cutoff (isGreetingTurn guard)
**Problem:** `greetingPhaseActive` cleared at the FIRST audio chunk. GL's real greeting pattern: speak a few words → call tools → continue. By the time tools fired, `greetingPhaseActive` was gone → `gl_audio_reset` killed the greeting mid-sentence.
**Fix:** New private `isGreetingTurn` boolean that lives for the ENTIRE greeting generation (cleared only at `generationComplete`, `interrupted`, and both watchdog timeouts). The `gl_audio_reset` guard at the tool-call handler checks `isGreetingTurn` instead of `greetingPhaseActive`.
**File:** `server/services/gemini-live-session.ts`

## Fix 2 — Mid-sentence turn cutoff (allLatencyHeavy over-gate)
**Problem:** The parallel-speech guard required BOTH `allLatencyHeavy` (every tool in PARALLEL_SPEECH_TOOLS) AND `hasSubstantialAck` (≥3 pre-tool words). Daniela commonly batches `[memory_review, update_session_phase, admin_session]` — fast bookkeeping tools not in PARALLEL_SPEECH_TOOLS → `allLatencyHeavy = false` → `gl_audio_reset` fired → mid-sentence cutoff.
**Fix:** Changed condition to `hasSubstantialAck` alone. If Daniela has spoken ≥3 words, preserve audio regardless of tool type. The whisper injection after tools return prevents GL from re-speaking pre-tool words for any tool type.
**Why `allLatencyHeavy` was wrong:** It was meant to avoid double-speech when fast tools return and GL immediately generates new audio, but the whisper handles that for all tools.
**File:** `server/services/gemini-live-session.ts` (the `if (hadAudioInCurrentSubturn)` block in the tool-call handler)

## Fix 3a — New-turn audio overlap (progressiveScheduledTime reset)
**Problem:** When `isNewTurnStarting` fires (sentenceIndex=0 after `processing_pending`+`resetForNewTurn()`), `progressiveScheduledTime` was hard-reset to `ctx.currentTime + 0.4`. If the previous turn's WebAudio sources were still scheduled to play (they are fire-and-forget; `sentenceSchedule.clear()` doesn't cancel them), the new turn's audio started into the MIDDLE of the old turn's playback — overlap.
**Fix:** `progressiveScheduledTime = Math.max(this.progressiveScheduledTime, ctx.currentTime + 0.4)` — preserves the old schedule if it's still in the future, only resets when past it.
**File:** `client/src/lib/audioUtils.ts` in the `isNewTurnStarting` block of `enqueueProgressivePcmChunk`

## Fix 3b — Multi-sub-turn playback_ended never emitting
**Problem:** For two-sub-turn GL responses, state machine went `playing → buffering → idle`. The `playback_ended` telemetry event (which lifts the mic gate) was gated on `prevState === 'playing'`. Since prevState was `'buffering'` at the final idle transition, `playback_ended` was NEVER emitted → mic gate relied on 60-second safety timeout → David couldn't speak for 60s after multi-sub-turn responses.
**Fix:** Changed condition to `prevState === 'playing' || prevState === 'buffering'` so `playback_ended` emits from either transition.
**Why buffering:** sentence 1's first chunk calls `setState('buffering')` (new sentence within same turn). The loop doesn't re-call `startUnifiedTimingLoop()` (wasPlayingBeforeThisChunk=true), so state stays buffering until idle.
**File:** `client/src/lib/audioUtils.ts` in `setState()` method
