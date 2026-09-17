---
name: Automatic task-update absence is not confirmation
description: A project-task automatic_update line only reports what changed; the absence of a blockedBy annotation does not prove a prior blocker cleared.
---

The system's task-change feed (`automatic_updates`) only emits lines for
transitions it detected, showing whatever fields it chose to show. Seeing a
task listed as `[IN_PROGRESS]` without a `[BLOCKED BY ...]` annotation is not
proof the blocker cleared — it can just mean the feed didn't re-emit that
annotation, or the snapshot predates the real state.

**Why:** Concluded "the ownership unblock went through cleanly" for three
tasks based solely on that absence, on 2026-09-17. It was wrong — the user
confirmed none of the three had even run `begin` yet, and two of them
reappeared moments later with an explicit `[BLOCKED BY WAITING_FOR_INPUT]`
tag.

**How to apply:** Before declaring a blocker cleared, check the actual
authoritative state directly (query the relevant ledger/table, or ask) rather
than inferring it from what an update line happened to omit.
