---
name: GL ACTFL silence-duration ordering bug
description: session.studentActflLevel must be written before createGeminiLiveSession/start() — the greeting flow sets it too late and all fresh sessions fall back to the default silenceDurationMs tier.
---

## The Rule

Always write `session.studentActflLevel = resolvedActflLevel` right after `orchestrator.createSession()` and before `createGeminiLiveSession()` in `unified-ws-handler.ts`.

**Why:** `GeminiLiveSession.start()` reads `this.session.studentActflLevel` to build `realtimeInputConfig.automaticActivityDetection.silenceDurationMs`. The greeting flow (streaming-voice-orchestrator.ts) also sets `session.studentActflLevel`, but it runs AFTER GL connects — so without the early write, every fresh session falls back to the `5000ms` default regardless of the student's assessed ACTFL level (novice should get 6000ms).

**How to apply:** `resolvedActflLevel` is already fetched in the Phase 1 parallel DB lookups (line ~1571 in `unified-ws-handler.ts`). After `session = await orchestrator.createSession(...)`, add:
```typescript
if (session && resolvedActflLevel) {
  session.studentActflLevel = resolvedActflLevel;
}
```

The voice-override reconnect path (line ~4483) is NOT affected — by reconnect time the greeting has already run, so the level is already on the session object.

**Diagnostic:** A `[GeminiLive] realtimeInputConfig — studentActflLevel: X, silenceDurationMs: Y` log line was added to `gemini-live-session.ts` at the exact point where the config is built, so future sessions can be verified in server logs.
