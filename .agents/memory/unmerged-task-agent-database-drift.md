---
name: Unmerged task-agent database drift
description: Recovery rule for stalled task merges whose database changes may already be live even though their code is absent.
---

Before reconstructing or replacing a stalled task-agent implementation, inspect the live shared database schema and the migration ledger. Do not assume that an unmerged task left no production footprint.

**Why:** An isolated task remained visibly stuck in its merge state while its lifecycle enum, columns, indexes, and row backfill had already reached the shared development/production database. The corresponding application code was absent from the main checkout. Assuming a clean database led to an initially incompatible migration draft.

**How to apply:** Compare the current schema model with `information_schema`, PostgreSQL enum/index metadata, and `drizzle.__drizzle_migrations`. Adopt the existing live contract when it is coherent, and reconcile it through a reviewed idempotent migration. Never retry a generated migration blindly after a partial or unexplained failure.