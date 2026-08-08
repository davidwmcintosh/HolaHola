# Gemini Audit — Task #794: recall_episode_deep read_next / after_episode_id
**Date:** August 8, 2026  
**Auditor:** Gemini 3-flash-preview (one round)  
**Protected files touched:** `server/services/daniela-function-registry.ts`  
**Verdict:** APPROVED.

## What was reviewed

Two new parameters added to `recall_episode_deep` tool to support sequential arc traversal:

1. **`read_next` (boolean)** — when true, automatically fetches the next episode in arc order (by `created_at ASC`) after the last episode delivered in the session. First call starts from the very first episode; each subsequent call advances by one. Session state (`lastDeliveredEpisodeId`) tracks position.

2. **`after_episode_id` (string, optional)** — fetches the episode immediately after the specified `conversation_memories` ID. Useful for resuming a reading chain from a known position rather than relying on session state.

3. **`required[]` changed from `['title']` to `[]`** — title is no longer required because `read_next: true` is a valid call without a title.

4. **Tool description updated** — WHEN TO USE bullet added; READ NEXT MODE section added explaining the chaining pattern, starting position, and position reporting via the stub header.

## Gemini findings

- **READ NEXT MODE wording: Clear.** Gemini Flash handles state-based iterator patterns well. The description correctly separates the two navigation modes (title lookup vs. sequential chaining).
- **Empty required[] — no-args risk: Low.** A no-args call would fall through to the backend's "no title, no read_next, no after_episode_id" guard which returns an explicit error stub rather than silently fetching something unintended.
- **Note from Gemini:** Suggested clarifying that `after_episode_id` must be provided when `read_next` is true. **Already handled:** the implementation uses session-tracked `lastDeliveredEpisodeId` as the anchor when no `after_episode_id` is passed, and starts from the first episode when no anchor exists at all. The description correctly documents this ("On the first call with read_next: true, starts from the very first episode").
- **No recency-bias or prompt-cap risk** — the description addition is modest (one section) and describes a purely navigational feature with no change to what gets injected into Daniela's context.

## Files changed

- `server/services/daniela-function-registry.ts` — `recall_episode_deep` tool description, parameters, required[]
- `server/services/native-fc-handlers.ts` — `RECALL_EPISODE_DEEP` handler: read_next mode, after_episode_id mode, session state tracking (`lastDeliveredEpisodeId`), stub text for both modes
