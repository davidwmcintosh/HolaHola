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


## Correction: the promote-success regression test is not a safe automatic exception

`server/scripts/test-episode-lifecycle-promote-success.ts` was written to close a real gap —
nothing else exercises `promoteRollingEpisode()`'s actual committed success path (target
gains `rolling`+`rolling-protected`, previous row(s) demoted correctly) against a real
database. It follows a careful recipe: promote a uniquely-titled disposable row, restore the
original in the very next statement with nothing else inside that window, try/finally
emergency restore, and independent ground-truth re-reads before ever deleting the disposable
fixture. That recipe was previously judged here as "safe enough to run automatically and
repeatedly" against the shared database. That judgment was wrong and has been reversed.

**Why:** the recipe only protects the *tag pointer* — it proves the original row is tagged
'rolling' again and the disposable row is not, before deleting the disposable row. It does
not protect the disposable row's *content* from a real write landing on it during the flip.
At least one real consumer of "the current rolling episode" does not perform a fresh per-write
DB lookup: it caches the rolling episode name in process memory for a fixed TTL measured in
tens of seconds. If that cache happens to refresh during the test's brief flip, real writes
keep targeting the disposable row's filename for the rest of that TTL — long after the test's
own tag-based restoration check has already passed and the disposable row has been deleted. A
confirmed-successful test run and a silently lost real conversation turn are not mutually
exclusive.

**How to apply:** a "promote disposable, restore immediately, verify by re-reading" recipe is
still the right shape for proving a singleton-tag swap's transaction logic — but it only
closes the risk window its own statements span. Before treating any such test as safe for
unattended, repeated execution against a shared production database, check every real
consumer of the value being swapped for its own caching/TTL behavior, not just the row being
flipped — a consumer whose cache outlives the flip turns a sub-second risk window into one as
long as that cache's TTL. This test is now disabled from automatic validation/CI (see the
run_check comment in run-validation-suite.sh and the matching entry in
scripts/run-ci-test-steps.mjs) and is manual-only: run it deliberately, during a quiet period,
when verifying changes to promoteRollingEpisode() itself.

