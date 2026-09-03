---
name: Divergent migration reconciliation
description: How to reconcile independently numbered migrations after both were already applied to the shared database.
---

When divergent branches contain colliding migration sequence numbers and the shared database has already applied both branches, preserve every applied SQL file byte-for-byte. Linearize only filenames, journal positions, and snapshot ancestry, then rebuild each snapshot so it includes all earlier changes from both branches.

**Why:** The migration ledger records content hashes and timestamps. Replacing or combining already-applied SQL can leave live ledger entries with no matching source artifact, while choosing one branch's snapshot chain silently omits the other branch's schema.

**How to apply:** Query the live migration ledger first, match each recorded hash to an exact SQL file, inspect the live schema, assign a collision-free chronological sequence, and rebuild the snapshot chain cumulatively. Prove the result on a disposable production clone before merging.