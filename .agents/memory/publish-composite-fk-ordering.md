---
name: Publish composite foreign-key ordering
description: Replit Publish dependency ordering for composite foreign keys that reference standalone unique indexes.
---

When a composite foreign key references a non-primary column pair, declare that
pair as a table-level PostgreSQL unique constraint in the Drizzle schema. A
standalone unique index may still be retained for compatibility, but it should
not be the only declared referenced-key authority.

**Why:** Replit Publish recomputes and may reorder a development-to-production
schema diff rather than executing the repository migration byte-for-byte. It can
attempt a foreign key before a standalone unique index, even when the canonical
migration orders them correctly. PostgreSQL then rejects the foreign key because
the referenced columns do not yet have a unique constraint or index.

**How to apply:** For new composite foreign keys, model the referenced pair with
`unique(...)` in the table definition before publishing. Generate and review the
migration, prove it on a disposable Neon branch, and apply it through the
canonical migration path. Never repair this with startup DDL or `db:push`.