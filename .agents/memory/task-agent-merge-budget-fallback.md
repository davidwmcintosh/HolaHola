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

**Generalization — open-ended scope can diverge, not just overlap:** the fallback above assumes a from-scratch reconstruction covers the same ground as the stuck task-agent's real work. That holds for precisely-specified tasks (add this one field, gate this one named check) but not for open-ended/exploratory ones (e.g. "find and gate other live external actions X could still trigger"). Reconstructing #1470 from scratch produced a narrow, one-call-site fix (Cartesia dictionary mutations); the actual stuck task-agent had already implemented and tested a completely non-overlapping seven-call-site fix (Neon branch, cross-tool-promote GitHub Actions dispatch, S3 reconciliation-archive, source-control-cli.ts, SourcePromotionService+route) with no mention of Cartesia at all. Both independently satisfied the literal task title; neither was wrong; they just didn't cover the same files. The mismatch only surfaced because the user later pasted the task-agent's own completion summary and it named files absent from `grep`-ing the guard's actual call sites on main. Before treating a from-scratch reconstruction of an open-ended task as equivalent to "the task is done," check whether the stuck agent's own completion report (or any other visible trace of its actual diff) names the same files; if it names different files, the reconstruction under-covers the task and both sets of changes are likely still needed.

