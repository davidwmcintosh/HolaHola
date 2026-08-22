---
name: Guard-reset turnId type mismatch cut off real turns
description: Synthetic response_complete guard-resets use a string turnId; comparing it numerically against the real turn counter always evaluates false, letting them slip through and kill in-flight audio.
---

`sendGuardResetSignal()` (server) sends a synthetic `response_complete` with `turnId: "guard-reset-<timestamp>"` — a string — whenever it skips an utterance (dedup, rapid-fire, greeting-in-progress, in-flight overlap). The client's stale-turn guard compared `msg.turnId < currentTurnIdRef.current`, but a string `<` number comparison coerces to `NaN`, which is never `true` — so guard-resets were never recognized as stale and could hit a real turn's active audio playback, clearing `isProcessing` mid-response.

**Why:** any protocol field reused for two different purposes (numeric turn sequence vs. a tagged synthetic-event string) needs an explicit type/tag check before being used in ordering comparisons — implicit JS coercion will silently produce the wrong branch instead of erroring.

**How to apply:** when adding new synthetic/guard messages that share a field name with a real sequence/id field, check the value's shape explicitly (e.g. string prefix) before applying ordering logic like `<`/`>` to it. Fixed in `client/src/hooks/useStreamingVoice.ts` `handleResponseComplete` — guard-resets now only take effect when no real turn is in flight.
