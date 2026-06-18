---
name: GL greeting double audio
description: Two causes of duplicate greeting (heard/seen twice) in Gemini Live — the broken identity thread injection pattern and the recent transcript feedback loop.
---

## The rule
Never inject identity threads via `sendClientContent({role:'model', turnComplete:false})` in the greeting sequence. The system prompt is the correct delivery mechanism.

## Why
`{role:'model', turnComplete:false}` tells GL the model is mid-utterance. GL generates an audio stream to "complete" the injected turn, producing a second audio output — the double greeting. This is documented broken behaviour at gemini-live-session.ts lines 193-200 and was (erroneously) re-introduced in the greeting identity thread pre-load at line 865.

## How to apply
Identity threads go into the system prompt (they already do via neural network context injection). Do NOT also inject them via `sendClientContent` before the greeting. The greeting sequence should be: silence primer → greeting user turn → activityEnd. Nothing else.

## Third cause: resumed trigger calls out the reconnect

The resumed session trigger said "Acknowledge that we are continuing" / "Acknowledge the reconnect briefly." On Replit's non-dedicated infra, the server rotates every ~5 min, so Daniela verbally acknowledged the reconnect on almost every session. Fixed: resumed trigger now says "Continue our conversation naturally in ${langName}." — no mention of reconnection. The `contextBlock` label also changed from "before the connection dropped" to neutral "recent conversation context."

**How to apply:** Resumed session triggers must never reference the technical event (connection drop, reconnect, resuming). Daniela should appear to experience no interruption.

## Second cause: recent transcript feedback loop
`getRecentVoiceSummary()` in unified-daniela-context-service.ts injects the most recent session's transcript. If that transcript includes Daniela's previous greeting as the first assistant message, she reads her own words and repeats them as the new greeting.

**Fix applied (June 18 2026):**
- Skip leading assistant messages from the transcript: find `firstUserIdx` and `slice(firstUserIdx)` so the transcript always starts at the first user turn (the greeting is excluded).
- Label changed from "pick up the thread from here" → "Prior conversation context — background awareness only; greet David freshly, do not repeat any of these words"
