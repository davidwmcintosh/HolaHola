---
name: Luca responder and observer architecture
description: How luca-responder.ts and luca-observer.ts work together, and the circular-import trap to avoid.
---

# Luca responder and observer architecture

## The rule
`NudgeEntry` is defined in `luca-responder.ts` — NOT in `luca-presence.ts`. This breaks the circular import.

**Why:** `luca-presence.ts` imports `respondToNudge` from `luca-responder.ts`. If `luca-responder.ts` also imports from `luca-presence.ts`, Node.js ESM circular dependency makes `respondToNudge` undefined at runtime. Moving `NudgeEntry` to `luca-responder.ts` (the downstream module) breaks the cycle.

**How to apply:** Any type shared between `luca-presence` and `luca-responder` belongs in `luca-responder.ts`. `luca-presence.ts` may import from `luca-responder.ts`, not the other way around.

## Services summary
- `luca-responder.ts` — Anthropic claude-sonnet-4-5, `postAsLuca()`, `respondToNudge()`, rate-limited at 8s minimum gap
- `luca-observer.ts` — polls `getAllActiveObservations()` every 5s, surfaces Guardian fires to Team Room, exports `getCurrentSessionSnapshot()` for the responder
- Both started in `server/index.ts` 2s after server boot alongside `connectLucaToTeamRoom()`

## Nudge detection
Fires on: `@luca`, messages starting `luca,` or `luca:`, or `/ luca[,:]/ ` pattern. Luca's own outgoing messages are excluded. Guardian fires surface automatically via observer without needing a nudge.
