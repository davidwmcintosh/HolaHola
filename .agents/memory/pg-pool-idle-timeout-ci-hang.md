---
name: pg-pool idle timeout silently inflates CI wall time
description: How to detect and fix a DB-backed node:test/vitest file that adds minutes of unaccounted wall time with no individual test reporting it.
---

## Symptom

A DB-backed test file passes cleanly, every individual test reports a normal
small duration, but the file's own total wall time is minutes longer than the
sum of those durations. Nothing in the visible test output looks wrong —
this only shows up by explicitly comparing node:test's per-subtest
`duration_ms` (TAP output) against the final `# duration_ms` line, or by
timing the process externally (`time npx tsx --test ...`).

## Root cause

`server/db.ts`'s pool options set `idleTimeoutMillis: 120000` but not
`allowExitOnIdle`. In `pg-pool` (node_modules/pg-pool/index.js, `_release`),
both the idle-eviction timer and the idle client's own socket are only
`.unref()`'d when `allowExitOnIdle` is set. Without it, both are normal
referenced handles, so Node's event loop — and therefore `node --test`,
which waits for the loop to drain before exiting — stays alive until the
full idle timeout elapses, even though every actual assertion finished in
milliseconds. The gap is almost exactly `idleTimeoutMillis` (2 minutes) plus
small process overhead.

This only manifests when a test file actually runs a real query against the
shared `db`/`getSharedDb()` pool and then never calls `closeDbConnections()`
(server/db.ts). ~15+ existing DB-backed `*.test.ts` files already follow the
convention of an `after()` hook calling `closeDbConnections()` specifically
for this reason (e.g. test-coordination-ledger.test.ts); a file missing that
hook pays the idle-timeout tax on every run.

## Fix

Add a node:test `after()` (or vitest `afterAll()`) hook that calls
`closeDbConnections()` unconditionally — it's a safe no-op-ish call even when
no DB test in the file actually ran a query (the pool object always exists
because `server/db.ts` creates it at import time), so no gating on whether
DB tests were skipped is needed.

## Verification method

Don't trust that the fix "looks right" — prove it. Stand up a local
disposable Postgres (see local-disposable-postgres-sandbox.md), run the file
with `time npx tsx --test <file>` before and after the fix, and confirm wall
time drops to roughly the sum of per-test durations. This is how task #1490
confirmed a ~122s file dropped to <1s.
