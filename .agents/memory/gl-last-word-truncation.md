---
name: GL last-word audio truncation fix
description: GL closes its PCM audio budget before the final word's phonemes complete; fix pattern for generationComplete seal + client endCtxTime ordering.
---

GL (Gemini Live) truncates the last audio chunk at turn end. Confirmed in session f494b134: the word " empty." arrived as 5120 bytes f32le = 1280 float32 samples = **53ms at 24kHz** — far too short for any recognizable word.

**Why it happens:** GL's internal audio budget closes before the final phoneme of the last word is fully generated. The `generationComplete` signal fires and the PCM stream stops mid-word. This is a known GL API behaviour, not a pipeline bug.

**Fix 1 — Server-side tail padding (`server/services/gemini-live-session.ts`):**
In the `generationComplete` seal block (and watchdog seal), before sending the empty `isLast: true` marker, send a **300ms f32le silence chunk** (`Buffer.alloc(tailSilenceSamples * 4, 0)` with `isLast: false`). This advances `progressiveScheduledTime` on the client by 300ms, ensuring the truncated fragment has runway in the AudioContext before any state transitions (playback_ended, mic gate, avatar transition).

Do NOT apply this to the `turnComplete` path — that fires between sub-turns and adding 300ms there would create audible inter-sentence gaps.

**Fix 2 — Client-side `endCtxTime` ordering (`client/src/lib/audioUtils.ts`, empty-chunk isLast handler ~line 939):**
`entry.endCtxTime` was set to `startCtxTime + totalDuration` BEFORE the 300ms trailing silence was added to `progressiveScheduledTime`. The timing loop uses `endCtxTime` as the sentence-end boundary — setting it early could fire `playback_ended` while the trailing silence was still in the queue, opening the mic gate prematurely. Fix: schedule trailing silence first, then set `entry.endCtxTime = this.progressiveScheduledTime` (which now includes silence).

**Net result per GL turn:** truncated last word + 300ms server silence + 300ms client trailing silence = 600ms of total runway after the last phoneme.

**Why:** 53ms is physiologically too short to be a recognizable word. Even with trailing silence, the truncated fragment is inaudible. The server-side pad ensures the client AudioContext doesn't transition away from the audio before those 53ms finish playing. The endCtxTime fix prevents premature mic-gate opening that could cause echo into GL.

**How to apply:** Any time GL audio truncation is suspected at turn end, check: (1) last chunk size in logs (`dataLen`), (2) `generationComplete` seal path in gemini-live-session.ts has the tail-pad chunk before the empty isLast marker, (3) client empty-chunk handler sets endCtxTime after progressive scheduled time update.
