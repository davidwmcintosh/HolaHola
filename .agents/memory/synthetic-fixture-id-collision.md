## Synthetic fixture ID collision

A test fixture that hardcodes a "surely never real" identifier (a low, round,
or otherwise guessable number/title like "Episode 99") as a synthetic value is
making a bet that expires as the real system's content grows. It is not a
concurrency race — it is a deterministic collision once real content catches
up to the guessed value.

**Confirmed instance:** `server/scripts/test-rolling-sync-guard.ts` hardcodes
title "Episode 99" (and a fabricated UUID) as its fixture episode, assuming
that title could never be real. On 2026-09-26 a real, auto-synced episode
literally titled "Episode 99" was created in the shared dev database. Every
subsequent run of the test then failed with a Postgres duplicate-key error on
`idx_episode_title_arc_unique` — a unique constraint on `(arc_name, title)`,
not on `id` — so the test's own `ON CONFLICT (id) DO UPDATE` does not help:
the real row has a different id and the same (arc_name, title) pair.

**Why:** the constraint that actually fires is often not the one the test's
`ON CONFLICT` clause targets. A duplicate-key error naming a *different*
column pair than the one the fixture's upsert handles is a strong signal this
class of bug is in play, not a logic bug in the code under test.

**How to diagnose:** when a validation failure is a duplicate-key/unique-
constraint violation inside an otherwise-unrelated test:
1. Read the error detail for the exact conflicting columns and values.
2. Query the DB directly for a real row matching that exact hardcoded value
   (e.g. `SELECT id, title, tags, created_at FROM conversation_memories WHERE
   title = 'Episode 99'`) — don't assume the failure is transient or racy
   without checking.
3. Confirm zero import/reference coupling between the failing test file and
   whatever diff is under review (`grep` the test's own imports) — this is
   conclusive, not just suggestive, when the imports share nothing.
4. Do not delete the real colliding row to make the test pass — it is genuine
   content, not a test artifact. Treat the fixture's ID/title choice as the
   bug (out of scope to fix under an unrelated task) and cite the proof above
   as a pre-existing, unrelated, reproducible failure.

This is a distinct root-cause class from
`verification-suite-parallel-fixture-race.md` (two scripts racing on the same
mutable file at the same time). Here nothing is racing — one process, one run,
a value that was safe when the test was written and is no longer safe now.

