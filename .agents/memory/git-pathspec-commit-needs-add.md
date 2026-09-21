---
name: Git pathspec-scoped commit needs add first
description: git commit -- <path> alone fails on a never-tracked new path; git add -- <path> must run first even for a single-path scoped commit.
---

A commit scoped to one path via `git commit -m "..." -- <path>` only succeeds
if `<path>` is already known to git (tracked, or already staged). For a path
that has never existed in the repository before, it fails with:

    error: pathspec '<path>' did not match any file(s) known to git

**Why:** `git commit -- <pathspec>` performs a "partial commit" of the
worktree state of already-tracked paths matching the pathspec; it is not
equivalent to `git add -- <pathspec> && git commit -- <pathspec>` and does not
pick up a brand-new untracked file. This is easy to miss when writing or
reviewing "commit exactly this one path, never `git add -A`" logic, because
it works fine once the path exists from a prior commit and only breaks on the
very first write to that path — exactly the case a first-sync/bootstrap path
is most likely to hit and least likely to get manually re-tested against.

**How to apply:** any code that converges a single tracked path to new
content and commits it in isolation (working-tree live-sync, scoped
publishers, reconciliation writers) must run `git add -- <path>` immediately
before `git commit -m "..." -- <path>`, even though the commit is already
pathspec-scoped. `git add -- <path>` stages only that one path and stays safe
regardless of what else is staged elsewhere; it never becomes `git add -A`.
Only a test that runs the sync against a brand-new path in a fresh repo
catches this — a test fixture that starts from a repo where the path already
exists from a prior commit will not.

