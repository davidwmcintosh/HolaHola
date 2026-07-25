---
name: GL generationComplete — three cut-off mechanisms
description: Three separate bugs all cut Daniela off mid-sentence in GL voice sessions; all fixed July 24-25 2026.
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

---

## Cut-off mechanism 3: premature seal from immediate generationComplete handler (July 25 2026)

**The bug:** The `generationComplete` handler immediately sealed the current audio sub-turn by sending a 300ms silence pad + `isLast:true`. But GL sometimes fires `generationComplete` while audio for the current sub-turn is still in-flight over the network. The seal would arrive at the client BEFORE the remaining audio chunks, so everything after the first word of the final question ("What's", "That's") was ignored by the client (sentence already marked ended).

**Symptom:** Consistent cut-offs at the START of Daniela's final question — "What's [next]?", "That's [what]", "What does 'pretty close' feel like" — always after the first word or two of the last sentence.

**Fix applied July 25 2026:**
1. Replaced immediate seal with a 200ms debounced `generationCompleteSealTimer`.
2. Audio chunk handler: if more audio arrives while the debounce is pending AND `afterGenerationComplete=true` AND `isTutorGeneratingAudio=true`, cancel and restart the debounce from 0ms. This allows in-flight chunks to land before the seal fires.
3. Extracted seal logic into `sealCurrentAudioSubturn(label)` private method — used by debounce timer, watchdog, and watchdog handler to avoid code duplication.
4. `generationCompleteSealTimer` cleared in `stop()` to prevent leaks.

**Why 200ms wasn't enough — the real root cause (July 25 2026):**
The debounce only prevents early sealing when audio arrives WITHIN the window. But GL sometimes takes 300-700ms to flush its last audio chunks after firing `generationComplete`. When those late chunks arrived after the 200ms seal:
1. `sealCurrentAudioSubturn()` fired → sent `isLast:true` for sentenceIndex N → incremented to N+1
2. `flushTranscripts()` ran → captured `totalSentences = N+1` → reset `currentSentenceIndex = 0` → sent `response_complete` with `totalSentences: N+1`
3. Late GL audio arrived → sent to client with NEW sentenceIndex N+1... but `response_complete` had already told the client `totalSentences = N+1` meaning only sentences 0..N were expected
4. The client's PCM player dropped sentence N+1 audio as unexpected → last word/clause silently cut

**Fix (July 25 2026):** Debounce bumped from 200ms → 800ms in both the initial `generationComplete` handler and the audio-chunk extension path. 800ms gives GL 4-8× the typical network RTT to flush in-flight audio before the seal fires.

**Extension condition also fixed:** Changed `this.generationCompleteSealTimer` guard to `(this.generationCompleteSealTimer || !this.isFlushInProgress)` — handles the rare case where a late chunk arrives after the timer fired but before `flushTranscripts()` sends `response_complete`. The extended timer re-seals and re-flushes correctly because `isFlushInProgress` prevents double-flush.

**How to apply:** Any time GL fires `generationComplete` and you need to seal: use the debounced path (800ms), not an immediate send. The 25s watchdog is the absolute safety net.

**File:** `server/services/gemini-live-session.ts` — `sealCurrentAudioSubturn()`, `generationCompleteSealTimer`, audio chunk handler ~line 1862.
