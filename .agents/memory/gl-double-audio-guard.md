---
name: GL double audio — hasStudentInputSinceLastResponse guard
description: Spurious second GL generation on first student turn — root cause, guard implementation, and why it doesn't break multi-part continuations.
---

# GL Double Audio — hasStudentInputSinceLastResponse Guard

## The bug
On the first student exchange after the greeting, Daniela's response played in full then restarted verbatim from the beginning. Transcript showed the same text twice. Turn 3 was clean.

## Root cause
The "Bug 1 gate" was removed July 24 2026 to fix mid-sentence audio cutoffs (gate was blocking legitimate continuation sub-turns). That gate silently dropped GL audio that arrived after `generationComplete`. GL has a behavior — most pronounced on the first post-greeting student exchange — where it generates the same response twice (a second `modelTurn` stream arrives after the first completes). Before July 24 the second stream was silently dropped. After July 24 it reached the client, causing the audible double.

**Why:** The exact GL trigger for the second generation is not fully characterised (no sendClientContent call visible in server logs for that window). Most likely a GL-internal sub-turn repetition on the first student exchange after greeting setup.

## Fix
`hasStudentInputSinceLastResponse` boolean flag in `GeminiLiveSession`.

State machine:
- Starts `false`
- Set `true` when student PCM audio is forwarded to GL (real student speech)
- Set `true` on `interrupt()` (student actively barging in)
- Reset `false` when model audio STARTS (`isTutorGeneratingAudio` becomes true) — ready for the NEXT student turn
- Reset `false` on reconnect/ws close

Suppression guard in audio chunk handler (before Bug 1 gate comment):
```typescript
if (!this.isTutorGeneratingAudio && !this.greetingPhaseActive && !this.hasStudentInputSinceLastResponse) {
  console.warn('[GeminiLive] Spurious GL audio — no student input since last response; suppressing double-generation');
  continue;
}
```

## Why multi-part continuations are safe
Continuation sub-turns (legitimate) arrive while `isTutorGeneratingAudio = true` — the model is still in the middle of generating. The guard's first condition `!isTutorGeneratingAudio` is false → they pass through to the existing debounce-extension path (line ~1876). The guard only fires when the model is fully done speaking AND no student input has arrived — exactly the spurious-double scenario.

**Why:** If we entered the guard path, it means `isTutorGeneratingAudio` is false, meaning playback already ended and the mic gate is open. A legitimate continuation would never arrive in that state.

## Files changed
- `server/services/gemini-live-session.ts` — field declaration, 5 set/reset points, suppression guard

## Date
July 27 2026
