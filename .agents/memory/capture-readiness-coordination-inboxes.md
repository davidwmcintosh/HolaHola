---
name: Capture readiness and coordination inbox boundaries
description: Operational rules for proving canonical capture readiness and interpreting coordination delivery.
---

HTTP application readiness is not proof that canonical conversation capture is armed. A recovery or backfill must prove cursor acknowledgement by the actual capture worker, then verify the expected canonical identity tags and attribution in the database.

**Why:** A backfill ran while the HTTP server reported ready but the delayed autosave worker had not started. A fallback watchdog advanced the byte cursor while dropping source and capture identity, so cursor completion alone falsely appeared successful.

**How to apply:** Before replaying canonical exchanges, verify the intended drain worker is active. After replay, require all expected capture IDs to exist exactly once with correct authorship, then verify projections and embeddings.

The coordination ledger and `agent_notes` are separate evidence planes. `agent_notes` proves inbox delivery and preserves compatibility; only authenticated ledger events prove acceptance, ownership, progress, completion, or outcome acknowledgement.

**Why:** Messages existed in `agent_notes` while the event feed appeared empty, and later a delivered inbox projection was incorrectly treated as if the recipient had accepted the work.

**How to apply:** Check both systems when locating messages. Use the ledger for tracked handoffs and wait for an explicit `accepted` event before starting overlapping mutations.