---
name: Autoscale startup readiness gates
description: Why autoscale cold starts need early HTTP health, read-only critical checks, and a gate covering every transport.
---

Application cold starts must not issue database DDL before binding the HTTP
port. Schema changes belong in reviewed migration artifacts; startup may perform
a read-only, fail-closed assertion that required tables and columns exist.
Bind early for deployment health, but keep normal traffic unavailable until all
critical integrity checks pass.

**Why:** PostgreSQL `ALTER TABLE ... IF NOT EXISTS` still requests a strong
table lock. On an actively used shared database, an otherwise harmless cold
start can wait behind unrelated activity until the autoscale readiness window
expires, even when the schema is already complete.

An Express middleware gate is not sufficient by itself. Socket.IO request
listeners and raw WebSocket upgrades can bypass Express, and upgraded clients
are not closed by the HTTP server's normal connection cleanup.

**How to apply:** For any pre-listen schema invariant, query the catalog
read-only and abort with an actionable migration error when it is incomplete.
Keep security-critical data-integrity checks fail-closed, but move actual DDL to
the reviewed migration pipeline. Attach socket transports only after critical
checks pass, immediately before releasing readiness. On critical failure,
terminate upgraded clients explicitly and use a bounded shutdown so autoscale
can restart the instance.