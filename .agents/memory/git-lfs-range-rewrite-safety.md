---
name: Git LFS range rewrite safety
description: Safely replacing a GitHub-over-limit historical blob with an LFS pointer without rewriting the shared GitHub ancestry.
---

When an old ordinary Git blob must become an LFS pointer, do not trust a
branch-scoped `git lfs migrate import` to leave unrelated local refs alone.
Protect every original head first, then rewrite only the non-shared lineage
from the common ancestor. Preserve the original heads as backup refs and
rebuild the reconciliation merge on the unchanged GitHub head.

**Why:** The LFS migration command can rewrite backup and auxiliary refs in
the local repository even when a single branch was requested. Rewriting the
shared ancestor makes a normal non-force push diverge from GitHub.

**How to apply:** Identify the common ancestor, verify the exact source-byte
hash, replace only the known oversized blob in the `base..Replit-lineage`
range with its LFS pointer, scan the rewritten release for ordinary blobs over
GitHub's limit, run `git lfs fsck`, and only then create a new two-parent merge
with the current GitHub head before the guarded push.