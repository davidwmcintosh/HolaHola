---
name: Chat capture two-boundary cursors
description: Why canonical DB projection and complete episode acknowledgement must advance independently.
---

Canonical chat persistence and complete rolling-episode acknowledgement use
separate monotonic boundaries. A recoverable episode projection failure may
delay acknowledgement, but it must never pin the canonical DB cursor or block
later exchanges.

**Why:** The episode helper can fail after the canonical conversation row has
already committed. Retrying from one shared cursor repeatedly finds the existing
row and wedges all later capture bytes. Advancing that cursor without a durable
mirror retry would instead lose the episode projection.

**How to apply:** Persist an idempotent episode-mirror outbox item before
advancing canonical progress. Advance acknowledgement only after ordered mirror
success. The only exception is an explicitly audited permanently invalid
destination: every source capture must be linked to its canonical row or named
as deliberately unresolved, and the original item, receipts, hashes, reason,
and operator must remain independently verifiable. Never infer this state from
a retry failure or retarget the item. Malformed, unaudited, or tampered
boundaries fail closed.