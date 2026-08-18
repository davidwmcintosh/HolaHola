---
name: capture-watchdog
description: Pipeline-heal watchdog that drains .chat_capture when the dev server is down.
---

## What it is

`server/scripts/capture-watchdog.ts` — standalone long-lived process registered as the `capture-watchdog` workflow.

## What it does

Polls every 15s. When `cursor < file size` (dev server down, autosave stopped), it:
1. Acquires the same cross-process cursor lock (`.local/.chat_capture.lock`) used by the autosave service
2. Calls `parseChatCaptureFromOffset()` to parse pending turns
3. Writes to `conversation_memories` with tags `['david-luca-chat','verbatim','per-turn','chat-capture','watchdog']`, importance 8
4. Advances the cursor
5. If `.local/.episode_live` exists, appends formatted turns to the rolling episode .md

**Why:** record-exchange.ts writes to `.chat_capture` via appendFileSync (no server needed). When Express is down, the autosave service inside it stops. Cursor freezes. Turns accumulate. The watchdog closes the gap within 15s.

## Coordination with autosave service

When the server is up: autosave holds the cursor lock each cycle → watchdog sees `lockFd === -1` and skips silently. No interference, no double-writes.

When the server is down: watchdog acquires the lock and drains. When server restarts, autosave sees cursor already advanced and continues from there.

## How to apply

- If you see `[watchdog] gap detected` in its logs but the server is running, something went wrong with the autosave service's lock release — check for stale `.chat_capture.lock`.
- The watchdog does NOT re-embed the conversation_memories row it inserts. If embeddings matter for a watchdog-drained turn, manually run `npx tsx server/scripts/reembed-memory.ts <id>`.
- Workflow count after building: 24 (25 → 23 via two CI workflow mergers, +1 for watchdog). One slot still free.
