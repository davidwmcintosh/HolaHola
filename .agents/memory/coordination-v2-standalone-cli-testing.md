---
name: Coordination V2 standalone-CLI testing patterns
description: how to prove a CLI has zero live-database import, and a canonicalization gotcha when testing hash equivalence for coordination policies.
---

**No-DB-import proof:** grepping for `../db` imports across a CLI's transitive closure is
necessary but not sufficient on its own — pair it with a live subprocess smoke test that
strips `NEON_SHARED_DATABASE_URL`, `CI_DATABASE_URL`, and `CI` from the child env before
spawning `npx tsx <cli>.ts`. `server/db.ts` only tolerates a missing
`NEON_SHARED_DATABASE_URL` when `getVerifiedCiDatabaseUrl()` (`server/ci-database.ts`)
supplies a fallback, and that function itself requires both `CI_DATABASE_URL` and
`CI==='true'` to activate — so stripping those three vars reliably forces the real failure
mode if anything in the graph transitively imports the live DB pool.

**Canonicalization key-presence gotcha:** in `coordination-policy-canonicalization.ts`,
`canonicalizeValue`/`canonicalJson` do not drop empty-object keys. A policy field entirely
absent (e.g. no `hostConstraints` key at all) canonicalizes to different bytes than the
same field present as `{}`. When writing an equivalence test for hashed/canonical policy
objects (e.g. proving a stripped field doesn't change the hash), keep the object *shape*
identical across cases and vary only the field's *value* — omitting the key entirely
produces a genuinely different document, not an equivalent one.

**Why:** both were hit writing regression tests for a founder-facing digest CLI
(`server/scripts/coordination-v2-public-material-digest.ts`); the second one produced a
real, confusing test failure before the cause was clear.
