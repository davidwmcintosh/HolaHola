---
name: Blobless partial-clone commits
description: Safe local commit recovery when a blobless checkout cannot authenticate to its promisor remote.
---

In a `blob:none` partial clone, an ordinary diff or commit may try to fetch promised parent blobs. If the promisor remote is temporarily unavailable, do not change the remote, discard the staged work, or treat the fetch failure as a code failure. After independently verifying the working tree, stage it and write the tree with missing promised objects allowed; create the commit from that tree and update the branch atomically against the expected old head.

**Why:** A fully verified reconciliation bundle could be staged, but ordinary `git commit` failed while trying to materialize old blobs over an unavailable SSH route. The current index already contained the complete intended tree, and an atomic low-level commit preserved it without rewriting history or weakening validation.

**How to apply:** First scan for conflict markers and secrets, run the relevant tests, and confirm there is no Git lock. Then use `git write-tree --missing-ok`, `git commit-tree` with the current head as parent, and `git update-ref` with the old head as the expected value. Never use this to bypass unresolved conflicts, hooks that enforce project policy, or a concurrently advancing branch.