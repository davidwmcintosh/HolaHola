---
name: Source-control dirty-tree block requires a manual commit
description: SourceControlService.sync() never auto-commits; a dirty tracked tree is a hard stop until an actor commits.
---

`SourceControlService.syncLocked()` calls `isTrackedTreeClean()` before anything
else (fetching heads, checking ancestry, etc.). If the tracked tree has
uncommitted changes, it returns `state: 'dirty'` immediately and does nothing
further — it does not stage, commit, or stash on your behalf.

**Why:** confirmed by direct observation — two edited-but-uncommitted files sat
through a full app restart; the scheduler's `scheduler-startup` sync ran, hit
the dirty check, and returned the same blocked state on every subsequent poll
and wake-file nudge until an actor ran `git commit` from the shell. Only after
that did the next sync (triggered via the wake file) pick up the new commit
SHA and reach `state: 'synced'` with Replit and GitHub converged.

**How to apply:** if a sync-status file shows `state: 'dirty'` with error
"Uncommitted tracked files prevent automatic source synchronization", the fix
is to `git add`/`git commit` the dirty files yourself (normal git, current
`git config user.*` identity is fine — no special actor identity needed), then
either wait for the next poll or nudge `.local/source-control-wake` (any file
content matching `[a-z0-9][a-z0-9._-]{1,63}` is used as the sync actor label)
for an immediate retry. Do not expect the scheduler to resolve this on its
own. "Dirty often self-resolves within a poll or two" (an existing code
comment) describes an actor noticing and committing quickly, not the
scheduler auto-committing.
