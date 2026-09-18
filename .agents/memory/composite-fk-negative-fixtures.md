---
name: Composite-FK negative fixtures
description: How to make PostgreSQL composite-lineage rejection tests deterministic when unique indexes can fire first.
---

For each intended composite foreign-key mismatch, create a fresh valid parent
lineage and fresh uniqueness dimensions, then alter exactly one child lineage
field. Do not reuse a host/request or host/release pair already consumed by a
successful child row.

**Why:** PostgreSQL may enforce a unique index before the composite foreign key.
A test expecting `23503` can instead receive a correct `23505`, which proves
only that the fixture collided with an earlier row.

**How to apply:** In negative database tests for lineage-bound evidence, keep
host fingerprints, requests, releases, manifests, and successful child pairs
distinct across cases. Assert the exact SQLSTATE only after those preempting
constraints are isolated.