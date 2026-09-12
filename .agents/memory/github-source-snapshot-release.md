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

Replit Publish and GitHub source promotion are separate proofs. A successful
deployment can create a clean local publication commit while GitHub `main` and
the working branch remain unchanged.

**Why:** Treating a healthy deployment as proof of source availability can send
another host to initialize against a commit it cannot fetch.

**How to apply:** Verify deployment metadata and GitHub refs independently. If
the reviewed local lineage is absent remotely, publish a non-force snapshot
branch from the verified GitHub head, prove its tree hash exactly matches the
reviewed local tree, then pass that branch through the existing protected
promotion gate before any downstream host binds authority to the commit.