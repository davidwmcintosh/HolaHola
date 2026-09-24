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


## A task-agent's verification claim needs checking independently of its merge status

Checking whether a stalled task-agent's fix actually reached main is not the same as checking whether its own reported verification (specific test names, pass/fail counts) is accurate. Both can be wrong independently of whether the underlying source change is correct.

**Why:** A task-agent reported a fix as "complete, verified, and committed on main" with two named previously-failing tests now passing. The commit was never merged (confirmed via `git merge-base --is-ancestor`). Porting the same source diff by hand and running the actual test file it named produced the opposite result: the two tests it claimed now passed instead newly failed, because those tests carried an explicit code comment documenting the pre-fix behavior as the deliberate, intentional contract. Direct investigation showed the source fix was correct and the invariant really was meant to change -- but the test file's assertions and comments had never been updated to match, whether by the task-agent or in whatever it actually verified against. The fix and the test file each needed independent judgment; neither the "committed" claim nor the "tests pass" claim could be trusted at face value, even though the underlying fix turned out to be right.

**How to apply:** After reconstructing a stalled task-agent's fix, re-run the exact tests it named against the real, current test files -- do not assume its reported pass/fail outcome describes a state that still exists (or ever existed as described). If a test fails with a comment explicitly documenting the old behavior as intentional, that is a signal the invariant was deliberately meant to flip (matching the task's own goal), not that the fix is wrong -- update the stale assertion and its comment together, the same way `legacy-ci-contract-flip.md` describes, rather than reverting the fix or leaving the port half-verified.

