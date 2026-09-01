---
name: Autoscale startup schema gates
description: Why autoscale cold starts must verify schema read-only instead of running idempotent DDL before listening.
---

Application cold starts must not issue database DDL before binding the HTTP
port. Schema changes belong in reviewed migration artifacts; startup may perform
a read-only, fail-closed assertion that required tables and columns exist.

**Why:** PostgreSQL `ALTER TABLE ... IF NOT EXISTS` still requests a strong
table lock. On an actively used shared database, an otherwise harmless cold
start can wait behind unrelated activity until the autoscale readiness window
expires, even when the schema is already complete.

**How to apply:** For any pre-listen schema invariant, query the catalog
read-only and abort with an actionable migration error when it is incomplete.
Keep security-critical data-integrity checks fail-closed, but move actual DDL to
the reviewed migration pipeline.