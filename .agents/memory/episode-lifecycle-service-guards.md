---
name: Episode-lifecycle service guards
description: Two non-obvious constraints on server/services/episode-lifecycle-service.ts — side-effect parity for new episode-insertion call sites, and why its live 'rolling'-tag promotion should never be exercised against the shared prod DB even briefly.
---

## New episode-insertion call sites must mirror the fire-and-forget indexing side effects

`createEpisode()` fires three background side effects after a fresh insert (re-embed via `reembedConversationMemory`, `generateAgentBriefing()` refresh, `contextSyncService.scheduleNorthStarResync()`), copied from `POST /api/conversation-memories`'s own post-insert behavior so an episode created through a tool is discoverable by embedding search exactly like one created through the HTTP route.

**Why:** These three calls aren't enforced by any type or schema — they're a "do the same follow-up work as every other insertion path" convention with nothing stopping a new call site from silently skipping them. An episode inserted without them would still exist as a normal row but stay invisible to embedding-based search and agent-briefing content until some unrelated resync happened to catch it later.

**How to apply:** If you add a third code path that inserts a new row into the "HolaHola Episodes" arc (`entry_type='episode'`), mirror these three fire-and-forget calls (or route through `createEpisode()`/`startNextEpisode()` instead of inserting directly) rather than assuming the DB insert alone is sufficient.

## Never flip the live 'rolling' tag against the shared prod DB during testing, even briefly

`promoteRollingEpisode`/`startNextEpisode` atomically move the `rolling` tag from whichever episode holds it to a new target. There is exactly one "currently live" row at a time, and the always-on chat/team-room capture pipeline and autosave watcher all target whatever holds that tag right now.

**Why:** Verifying this path against the real target (flip to a disposable row, confirm, flip back) risks a concurrent real conversation write landing on the disposable row during the flip window and being lost when that row is cleaned up — a live production-data race, not a hypothetical. Applied Sep 26 2026 while adding Alden's `start_next_episode`/`get_current_episode` tools: verified the transaction logic via the existing unit-level regression test (which forces a rollback, never a real commit) plus a create-only test against a disposable, never-promoted row, and relied on the promote transaction being unchanged/copy-pasted logic rather than exercising it live.

**How to apply:** This generalizes beyond episodes to any "exactly one row/record is the live one" singleton pointer backed by a shared production DB with its own live writers. Verify such a swap's atomicity/rollback behavior with a forced-failure unit test and/or a disposable never-promoted fixture, not by actually flipping the real pointer during verification — even transiently, even with a planned restore.


## One sanctioned exception: the automated promote-success regression test

`server/scripts/test-episode-lifecycle-promote-success.ts` is a deliberate, narrow
exception to the "never, even briefly" rule above. It exists precisely because nothing
else exercises `promoteRollingEpisode()`'s actual committed success path (target gains
`rolling`+`rolling-protected`, previous row(s) demoted correctly) against a real database
-- the pre-existing bad-name test and `--self-check` only cover the not-found lookup and a
forced-rollback simulation that never commits.

**Why this is still safe enough to run automatically and repeatedly:** it follows the
"disposable target, forced-failure-safe, minimal window" recipe this file's own "How to
apply" line calls for -- adapted to a case where a live target is momentarily unavoidable:
promote a uniquely-titled disposable row, immediately restore the original in the very
next statement (only one intervening tag-state read, no logging/extra queries inside that
window), guarantee an emergency restore attempt via try/finally if anything between the two
calls throws, and verify restoration via an independent ground-truth read
(`getCurrentRollingEpisode()` plus a direct tag re-read on the fixture itself, never a
trusted return value) before doing anything further. Critically, the disposable row is
deleted ONLY once that independent confirmation succeeds -- if restoration can't be
confirmed, the fixture is deliberately left in place and the script fails loudly with a
manual-recovery command, because deleting it while it might still be the live rolling
pointer would destroy production capture data rather than just leave a cleanup chore. A
pre-run sweep also catches any orphan left by a prior crashed run (one that never reached
its own confirmation step), so a killed process can't leave a stale non-rolling row for
`detectRollingTagMisroute()` to misread as a real misroute on the next server restart.

**How to apply:** this specific test is the sanctioned exception -- it does not relax the
original rule for anything else. Manual/ad hoc verification of this function, or of any
other "exactly one row is the live one" singleton swap, should still avoid a live flip per
the original guidance above. If a similar singleton-swap function ever needs its own
committed-success regression test, copy this test's safety recipe -- minimal back-to-back
window with zero other work inside it, try/finally forced restore with a loud
manual-recovery command on failure, independent post-hoc ground-truth verification on both
the restored original AND the fixture itself, and deletion gated strictly behind that
confirmation -- rather than re-deriving it or skipping the safety work under time pressure.

