---
name: Local/GitHub main can diverge outside the normal sync path
description: a branch merged directly into GitHub main (bypassing the scheduler's own push) creates true two-sided divergence; the status file, not git's own remote-tracking ref, is the source of truth.
---

Local Replit `main` and GitHub `main` are not guaranteed to stay fast-forward-compatible just because the in-process scheduler usually keeps them in sync. If some other path lands commits on GitHub's `main` directly (e.g. a separate branch merged there outside the scheduler's own push), while local Replit also gained its own unpushed commit(s) in the meantime, the result is genuine two-sided divergence: neither side is an ancestor of the other.

**Why:** hit this live — one unpushed local commit plus a merge commit that had landed on GitHub `main` bringing in an unrelated branch's changes. `.local/source-bridge-status.json` correctly reported `state: "diverged"` with `error: "... explicit reconciliation is required"` and refused to auto-merge.

**How to apply:** check `.local/source-bridge-status.json`'s `state`/`error` fields before assuming a commit will sync cleanly — don't infer sync health from git's own `origin/...` remote-tracking ref (it can be stale or point at an unrelated/unauthenticated remote entirely; see reconciliation-service-auth-gap.md). A "diverged" state is designed to require deliberate reconciliation (the `source-control:reconcile preflight` → `candidate` pipeline), not a plain push — don't force-push or hand-merge around it. `git merge-tree <merge-base> <local> <remote>` is a safe, read-only way to check whether the eventual merge would actually conflict before deciding how to proceed.
