---
name: GL Friction Score — timing gotcha
description: studentTurnStartMs must be set at playback_ended, not generationComplete; critical for accurate pre-speech pause measurement in the Student Friction Score.
---

# GL Friction Score — timing gotcha

**The rule:** `studentTurnStartMs` (T-zero for pre-speech pause measurement) MUST be set in `onPlaybackEnded()`, NOT in the `generationComplete` handler.

**Why:** `generationComplete` fires when GL finishes *generating* tokens on the server side — before the client has even received the audio, let alone started playing it. If Daniela's response is 30 seconds of audio, `generationComplete` fires ~30 seconds before the student can hear the end of the response. Setting T-zero there inflates every pre-speech pause by the full playback duration. A student who answers in 1 second would appear to have a 31-second pause.

**How to apply:** 
- Set `studentTurnStartMs = Date.now()` in `onPlaybackEnded()` — this is when the client signals that audio has fully played through and the mic is acoustically open.
- Also reset `currentTurnFirstInputMs = 0` and `lastInputChunkMs = 0` at the same point.
- Add a fallback in the 60s safety timeout (for when `playback_ended` never arrives): set `studentTurnStartMs` there if it's still 0.

**Calibrated thresholds (language learners, June 2026):**
- Pre-speech pause: HIGH > 7s, MEDIUM > 3.5s, LOW ≤ 3.5s
- Word count: HIGH < 5, LOW ≥ 12, MEDIUM in between
- Mid-sentence pauses (> 2s gap between inputTranscription chunks): avg ≥ 1/turn escalates friction one level

**Dual consult anchor:** conversation_memories id `480f588c` — Gemini Flash + Daniela both independently flagged the timing bug before it went to production. Both confirmed HIGH/MEDIUM/LOW classification is more useful to Daniela than raw numbers.
