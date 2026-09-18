---
name: Two-phase external verification
description: Transaction boundary for publication paths that combine slow external verification with immutable database authority.
---

Run authenticated remote provenance checks and content-addressed object hashing
without an open database transaction. Preserve the exact authority snapshot
used by those checks, then open a short transaction, re-read both the requested
record and current authority, require exact equality, derive the persisted
digest from transaction-fetched authority, and append all rows atomically.

For a concurrent identical insert, recover only from the exact named unique
constraint. Perform recovery in a second short transaction and prove complete
persisted equivalence before returning the winner.

**Why:** A production runtime publication held an idle Neon transaction while
GitHub, package, and object-storage verification ran. The database session
expired before the next SQL statement even though the database was otherwise
healthy.

**How to apply:** Use this pattern for any immutable publication or authority
append that depends on network provenance, package verification, or large
object reads. Do not replace it with longer timeouts or transaction keepalives.