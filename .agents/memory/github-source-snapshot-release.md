---
name: GitHub source snapshot release
description: How to preserve a complete current tree when historic Replit blobs cannot be pushed to GitHub without rewriting history.
---

When GitHub rejects an old ordinary Git blob larger than its hard limit, adding
an LFS pointer in a new commit does not make the original merge graph
pushable. If preserving both commit graphs and a non-force release are
simultaneously required, stop and obtain explicit approval before choosing a
source-snapshot release.

**Why:** GitHub evaluates every reachable ordinary blob in the pushed history.
Rewriting old commits to LFS changes commit identities and requires a
force-push; retaining those commits in a normal merge still carries the
rejected blob.

**How to apply:** Protect both original heads with annotated local tags and
retain the reviewed two-parent merge behind another protected tag. From the
verified GitHub head, create one ordinary fast-forward snapshot commit whose
tree matches the reviewed current source. Verify current large assets are LFS
pointers, run `git lfs fsck`, prove no new ordinary blob reaches GitHub's
limit, then use the existing guarded non-force push. Refresh the local
tracking ref through the verified deploy-key transport afterward.