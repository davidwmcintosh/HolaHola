---
name: Rolling replica cache coherence
description: Prevent partial cache state from reversing canonical DB-to-Markdown authority for rolling records.
---

# Rolling Replica Cache Coherence

**The rule:** A cached episode identity is not enough to choose a synchronization direction. If rolling status is unknown, re-read the canonical row and fail closed rather than treating Markdown as authoritative.

**Why:** DB-first writes can warm an identity cache before a filesystem watcher has loaded the row's tags. Defaulting that partial state to non-rolling allows a stale Markdown snapshot to enter a legacy Markdown→DB route, even though the rolling record is canonical in the database.

**How to apply:** Any sync path whose direction depends on canonical metadata must fetch that metadata when its cache entry is absent. For rolling records, read current DB content again at replica-write time and test the exact warm-ID/cold-status state, not only fully cold or fully warm caches.