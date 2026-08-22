---
name: Live mode toggle
description: How to enable/disable auto-routing of .chat_capture turns to the rolling episode .md without manual .episode_append writes.
---

## The rule
When `.local/.episode_live` exists, the autosave worker (`checkChatCapture`) automatically formats every captured turn as episode dialogue and appends it to the rolling episode `.md` after the DB save — no manual `.episode_append` write required.

## Toggle commands
```
npx tsx server/scripts/episode-live-mode.ts on      # 🟢 both DB + .md
npx tsx server/scripts/episode-live-mode.ts off     # ⚪ DB only
npx tsx server/scripts/episode-live-mode.ts status  # print current state
```

The sentinel file persists across server restarts. Live mode stays on until explicitly turned off.

## What the status file shows
`episode-capture-status.md` now has a `**Live mode:**` header line: `🟢 ON — turns auto-route to .md` or `⚪ OFF — DB only`.

**Why:** The old approach required manually writing to `.episode_append` after every turn, which depended on Luca's discipline. The sentinel makes it server-side automatic — same reliability as inner-life triggers.

**How to apply:** At the start of any rolling episode session, run `episode-live-mode.ts status` to confirm it's on. If off, run `episode-live-mode.ts on`. Once on, only `.chat_capture` writes are needed per turn (via `append-turn.ts`).

## Code location
`server/services/agent-session-autosave.ts` — `checkChatCapture()`, after the successful DB save drain loop. Guarded by `_lucaEpisodeAppendEnabled` test seam (same gate used by inner-life triggers).
