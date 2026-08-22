---
name: Graceful shutdown drain window
description: How the server handles SIGTERM to avoid killing active voice sessions on deploy
---

The core problem: publishing (Cloud Run SIGTERM) was killing all active GL voice sessions instantly.

**Root cause of production OOM crash loop (July 7, 2026):**
`scheduleMadrigalIndexing(0)` in `server/index.ts` was overriding the default 90s delay, firing the MadrigalIndexer + ToolIndexer + EmbedIndexer simultaneously at boot. Heap hit 2033 MB → OOM crash → restart loop. Fix: remove the `0` argument so the 90s default applies.

**Graceful shutdown architecture (server/index.ts):**
1. `server.close()` — stop accepting new HTTP connections
2. `io.of('/voice').fetchSockets()` — count active voice clients
3. `io.of('/voice').emit('server_restarting', ...)` — notify them
4. `await sleep(25s)` if clients active, `sleep(2s)` if none — drain window
5. Flush telemetry, close DB pools, `process.exit(0)`

**Client handling (streamingVoiceClient.ts):**
- Socket.io `server_restarting` event: wait 5s (audio drain), then `socket.disconnect()`
- Emits `'server_restarting'` up the EventEmitter chain (added to `StreamingEventType` union)

**UI handling (useStreamingVoice.ts + StreamingVoiceChat.tsx):**
- `serverRestarting: boolean` added to `StreamingVoiceState` interface
- `useEffect` in StreamingVoiceChat shows "HolaHola is updating" toast on flip

**Why it works:**
Cloud Run gives 30s from SIGTERM before SIGKILL. We use 25s for active sessions (5s buffer for cleanup). The 5s client-side delay + 25s server-side window means buffered audio can finish playing before the socket dies.

**Key constraint:** GL sessions do NOT survive server restarts — after reconnect, Daniela starts fresh. The drain window minimizes disruption but can't preserve GL context across a deploy.
