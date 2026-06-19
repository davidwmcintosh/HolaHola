---
name: GL greeting double audio
description: Two causes of duplicate greeting (heard/seen twice) in Gemini Live — the broken identity thread injection pattern and the recent transcript feedback loop.
---

## The rule
Two separate patterns cause double audio — never combine `sendClientContent(turnComplete:true)` with `activityEnd` in sequence, and never inject identity threads via `{role:'model', turnComplete:false}`.

## Fourth cause: activityEnd after sendClientContent(turnComplete:true) — June 19 2026
Sending `sendRealtimeInput({ activityEnd: {} })` immediately AFTER `sendClientContent({ ..., turnComplete: true })` creates two turn-end signals. GL generates a first response to the completed text turn, then a second response when `activityEnd` arrives (GL treats it as the end of a new turn). The fix: remove `activityEnd` entirely from the greeting sequence — `turnComplete:true` is sufficient.

## Fifth cause: missing DB imports crash setupComplete handler — June 19 2026
`getSharedDb` and `sql` were imported in the greeting-trigger setup path but not at the top of `gemini-live-session.ts`. Every time `handleServerMessage` hit `setupComplete`, the `ReferenceError` crashed before the greeting trigger fired. David heard ringing forever with no greeting. Fix: ensure `getSharedDb` is imported from `../db` and `sql` from `drizzle-orm` at the top of the file, not assumed to be in scope.

## Sixth cause: GL internal monologue leaking to transcript — June 19 2026
After audio generation ends, GL sometimes outputs text-only `modelTurn.parts` — its own planning notes (e.g. "The user has initiated Honesty Mode. I've responded warmly..."). These were forwarded to the client as `response_text` and shown in the subtitle/transcript UI. Fix: pre-scan `modelTurn.parts` for audio before processing — if `messageHasAudio=false` AND `hadAudioInCurrentSubturn=false`, suppress text parts (log server-side, never send to client).

## How to apply
The greeting sequence must be exactly: silence primer (realtimeInput audio) → greeting text turn (sendClientContent, turnComplete:true). No activityEnd. No {role:'model'} turns. Nothing else.

## The rule (original)
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
