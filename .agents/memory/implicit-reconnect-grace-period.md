---
name: Implicit reconnect — grace period cancellation bug
description: Root cause and fix for context loss when client reconnects without isReconnect:true flag.
---

The concurrent session guard in `start_session` (unified-ws-handler.ts) was **cancelling the grace-period timer** for a user's pending reconnect whenever any non-reconnect `start_session` arrived — even if it was for the **same conversationId**. This meant: page navigation during a broadcast mode UI transition, app backgrounded, or any reason `lastSessionConfig` was cleared → client sends `isReconnect: false` → guard fires → grace period destroyed → `claimPendingReconnect` never called → Daniela gets a fresh context.

**The fix (June 2026):** Added implicit reconnect promotion in unified-ws-handler.ts, before the concurrent session guard:

```ts
if (!isReconnectSO && conversationId) {
  const implicitPending = pendingReconnectSessions.get(conversationId);
  if (implicitPending && implicitPending.userId === String(userId)) {
    isReconnectSO = true;  // promote — client lost flag, server knows it's a reconnect
  }
}
```

Also changed `const isReconnectSO` → `let isReconnectSO` to allow promotion.

In the concurrent guard's timer cancellation loop, added `&& convId !== conversationId` so a same-conversation reconnect is never cancelled by that loop (it would already be promoted above, making that block unreachable for it anyway).

**Why:** `pendingReconnectSessions` is keyed by conversationId — if an entry exists for this exact conversationId + userId, the server has objective evidence of a recent drop. The client's `isReconnect` flag is advisory; the server-side state is authoritative.

**How to apply:** Applies to unified-ws-handler.ts `start_session` handler only. After a server restart, `hydratePendingReconnectsFromDb()` repopulates the in-memory map so this also works across restarts.
