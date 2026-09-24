A narrow follow-up task (e.g. "route X's diagnostic banners to stderr") can already be fully implemented by the time it's assigned, if whoever built the feature that motivated it (a sibling task) fixed it proactively in the same commit. Symptom: the target file already matches the task's "done looks like" description, `git status` is clean, and MEMORY.md already has a dated entry for the exact fix.

**Why:** this project generates many small, narrow follow-up tasks (e.g. "Confirm X still works", "Make Y safe to pipe") off of larger implementation tasks. An agent implementing the larger task sometimes does the right thing proactively and folds the follow-up's fix into the same commit, before the follow-up task is even dispatched to an agent. Confirmed Sep 24 2026 on task 1585 ("route server/db.ts's stdout banners to stderr"): already fixed in the same commit that added the coordination-runtime-status CLI (task 1582).

**How to apply:**
1. Before implementing, read the target file(s) directly — if they already match "done looks like," don't assume the task description is stale noise; verify properly rather than skipping the task.
2. `git log --oneline` / `git show <commit> -- <file>` to confirm the exact change is already on HEAD (not a leftover uncommitted edit from someone else's working tree) and check whether the commit message or Replit-Task-Id references a sibling task.
3. Prove the behavior directly (e.g. run the affected CLI/script and inspect real output) rather than trusting the diff alone.
4. If confirmed, call markTaskComplete with `drift_reason` explaining no code change was needed and citing the sibling commit — do not reimplement or force a redundant diff just to have something to commit.

