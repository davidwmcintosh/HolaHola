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