## Unmerged task-agent database drift

---
name: Unmerged task-agent database drift
description: Recovery rule for stalled task merges whose database changes may already be live even though their code is absent.
---

Before reconstructing or replacing a stalled task-agent implementation, inspect the live shared database schema and the migration ledger. Do not assume that an unmerged task left no production footprint.

**Why:** An isolated task remained visibly stuck in its merge state while its lifecycle enum, columns, indexes, and row backfill had already reached the shared development/production database. The corresponding application code was absent from the main checkout. Assuming a clean database led to an initially incompatible migration draft.

**How to apply:** Compare the current schema model with `information_schema`, PostgreSQL enum/index metadata, and `drizzle.__drizzle_migrations`. Adopt the existing live contract when it is coherent, and reconcile it through a reviewed idempotent migration. Never retry a generated migration blindly after a partial or unexplained failure.

## Task-agent merge budget fallback

---
name: Task-agent merge budget fallback
description: How to respond when a completed task-agent change repeatedly cannot merge despite no visible concurrent work.
---

Treat a repeated `MERGE_BUDGET_EXHAUSTED` result as an unavailable delivery
path, not evidence that the underlying fix is optional.

**Why:** Replit documents background-task concurrency but does not document the
merge-budget status or a reliable reset interval. A completed isolated change
can remain unapplied after long waits even when no other task is visibly
running.

**How to apply:** Do not ask the user to keep retrying or judge conflicts. For a
critical fix, inspect the current main workspace, reconstruct the smallest
verified change directly there, and close the task only after focused
validation. Keep the blocked task until the replacement is proven.

## Open-ended scope can diverge, not just overlap

**Generalization — open-ended scope can diverge, not just overlap:** the fallback above assumes a from-scratch reconstruction covers the same ground as the stuck task-agent's real work. That holds for precisely-specified tasks (add this one field, gate this one named check) but not for open-ended/exploratory ones (e.g. "find and gate other live external actions X could still trigger"). In one case, reconstructing an open-ended task from scratch produced a narrow, one-call-site fix; the actual stuck task-agent had already implemented and tested a completely non-overlapping multi-call-site fix touching entirely different files, with no overlap at all. Both independently satisfied the literal task title; neither was wrong; they just didn't cover the same ground. The mismatch only surfaced because the user later pasted the task-agent's own completion summary and it named files absent from the reconstruction's own diff. Before treating a from-scratch reconstruction of an open-ended task as equivalent to "the task is done," check whether the stuck agent's own completion report (or any other visible trace of its actual diff) names the same files; if it names different files, the reconstruction under-covers the task and both sets of changes are likely still needed.


## Stuck-merge task record can be stale bookkeeping, not missing code

## Stuck-merge task record can be stale bookkeeping, not missing code

Before reconstructing a fix for a task stuck in `MERGING` (any `blockedBy`
reason, e.g. `WAITING_FOR_LOCK`), check whether the code is already committed
and passing on main. A stuck task-tracking record does not reliably mean the
implementation is absent.

**Why:** A task showed `MERGING` / `blockedBy: WAITING_FOR_LOCK` for 4+ hours
with nothing else visible in the merge queue holding the lock — indistinguishable
from a genuinely missing implementation if you only look at the task metadata.
But `git log -- <relevant files>` showed a commit whose message matched the
task's own title, already landed on main a day earlier, and re-running the
file's own self-check/regression test against current HEAD passed cleanly.
The platform task record was stale/redundant bookkeeping, not a true signal
that work was missing.

**How to apply:** before reconstructing anything for a stuck-merge task, run
`git log --oneline -- <relevant files>` looking for a commit matching the
task's title or description, and actually execute any existing test/self-check
for that code path against current HEAD. Only reconstruct if that check
genuinely fails or the code is genuinely absent. This is the mirror image of
"Unmerged task-agent database drift" above (DB already live despite code
missing) — check the live artifact (git history + a real test run), never
infer completeness or absence from the task-tracking display state alone.

