---
name: Task state can go stale between reads
description: A project-task automatic_update line only reports what changed, and a task's own title/description text can be rewritten mid-flight by whoever is working it — neither absence-of-signal nor an earlier summary proves the current state.
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

**Related, separate failure mode:** a task's own title and description are
not static either. An `IN_PROGRESS` task lives in an isolated task-agent
environment and can rewrite its own scope as the agent learns more; a
main-Repl session can also append a "Status update" directly into the
description while unblocking a dependency. Re-checked a task on 2026-09-18
whose blocker had been summarized earlier in the same conversation (a
GitHub-push failure) — by the time of the re-check, the task's title and
body had been fully rewritten around a different, deeper problem it had
moved on to, with no trace of the original framing left. A conversation
summary (including your own compacted memory of "what task #N is about")
describes the task at the moment it was last read, not now.

**How to apply:** Before answering "what is blocking #N" or "what is #N
about," refetch the task's current title/description directly rather than
relying on an earlier read or a compacted summary of it, especially for
`IN_PROGRESS` tasks and especially across any gap in the conversation.
