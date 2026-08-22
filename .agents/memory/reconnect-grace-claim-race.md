---
name: Reconnect grace-claim race (duplicate connection vs. pending-reconnect store)
description: Why fast client reconnects after a hard network drop sometimes lost conversation continuity — a timing race between two independent safety mechanisms.
---

Two mechanisms in `server/unified-ws-handler.ts` both react to the same event (client reconnects for a conversationId that already has a live/stale connection) but were unaware of each other:

1. The "duplicate connection" guard (in the Socket.io connection setup) — fires when a NEW connection arrives while the OLD one's socket object still reports `OPEN` (true for a real network drop, since the server hasn't seen a FIN/RST yet). It only *schedules* the old socket's close 350ms later, to let mid-sentence audio finish.
2. The "pending reconnect" store — only runs from the OLD connection's own `close` handler, which doesn't fire until that scheduled close actually happens.

If the new connection's `start_session` is processed before the 350ms elapses (plausible — auth + setup can be faster), the pending-reconnect entry doesn't exist yet, so neither the client's `isReconnect` flag path nor the server's implicit-detection fallback have anything to key off, and the session starts cold — losing conversation continuity — while the OLD connection's grace entry gets stored late and later expires unclaimed.

**Why this matters generally:** any time two independent "connection replaced" handlers both key off the same close/lifecycle event but one of them delays intentionally (e.g. for graceful audio drain) and the other depends on that same event firing, a race window opens. The fix pattern was a synchronous cross-scope callback (registered per connection-id in a module-level Map) that the guard invokes immediately, instead of waiting on the delayed close.

**How to apply:** when adding any other "graceful replace" logic with an intentional delay, check whether something else assumes the delayed event has already happened.
