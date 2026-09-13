---
name: PostgreSQL lease clocks
description: Why durable lease expiry decisions require an advancing database-owned clock.
---

Use an advancing PostgreSQL wall clock for lease issue, renewal, expiry, and
takeover decisions. Do not use a transaction-start timestamp for elapsed-time
authority.

**Why:** PostgreSQL transaction timestamps are fixed at transaction start.
Concurrent setup or test operations can therefore make “now” older than a
recently persisted lease boundary, producing contradictory expiry behavior
even though every value came from the database.

**How to apply:** Any database-authoritative timeout or lease transition that
depends on elapsed time should obtain the advancing clock inside the locked
transaction and derive expiry from that same value.