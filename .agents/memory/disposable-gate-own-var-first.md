---
name: Disposable-DB test gates must check their own var first
description: Why a disposableTarget()-style gate must read its own dedicated *_TEST_DATABASE_URL before the ambient NEON_SHARED_DATABASE_URL, and the two safe shapes for the check.
---

Many `*.test.ts` files in this repo use a `disposableTarget()`-style helper so a
Postgres-writing test only runs against a Neon branch that `scripts/neon-branch.ts`'s
migration gate provisioned and marked disposable, never against the app's own
database. `NEON_SHARED_DATABASE_URL` is the ambient var holding the app's own
database connection — it is truthy in essentially every normal dev shell, well
outside any gate.

**The bug shape:** `disposableTarget()` reads `NEON_SHARED_DATABASE_URL` first and
branches on its presence/absence (`if (!url) { ...maybe throw...; return undefined }`).
Because that var is *always* set in a normal dev shell, the function always falls
through past the "am I even inside a gate" check and into the disposable/forbidden
verification branch — which then throws a confusing `"..._DISPOSABLE=1 is required"`
or similar error instead of skipping cleanly, any time someone runs the file
directly (`npx tsx --test <file>`) outside the gate.

**The fix — two safe shapes, both seen in this repo:**
1. **Own-var-first:** read the file's own dedicated gate var (e.g.
   `COORDINATOR_V2_TEST_DATABASE_URL`, `FOUNDER_TASK_OWNERSHIP_TEST_DATABASE_URL`)
   as the primary `url`/presence check, and throw-if-required only in that branch.
   Cross-check `NEON_SHARED_DATABASE_URL === url` as a *secondary* condition further
   down, not as the entry gate.
2. **Early-return:** immediately `return undefined` (no throw) whenever the file's
   `*_REQUIRE_DATABASE_TESTS` flag isn't `'1'`/`"1"`, before any other check runs —
   safe even if `NEON_SHARED_DATABASE_URL` is read first, because presence of that
   ambient var alone can never trigger the throwing branch.

**Why:** this exact bug was found and fixed independently at least seven times
across this repo's Coordinator V2 / founder-task-ownership / release-cutover-
attestation test families — it is the default mistake, not an edge case, whenever
someone writes a new disposable-DB gate by copying an existing `NEON_SHARED_DATABASE_URL`-first
example instead of an own-var-first or early-return one.

**How to apply:** when adding or reviewing any `disposableTarget()`-style gate,
grep the function for which var is checked in the first `if`. If it's the ambient
`NEON_SHARED_DATABASE_URL`/`CI_DATABASE_URL`-style var and the branch can throw,
run the file directly with that var set (simulating a normal dev/CI shell) and
every gate-specific var unset — a clean skip is required, a thrown error is the bug.
Also add a self-check test in the same file that reads its own source
(`readFileSync(fileURLToPath(import.meta.url), ...)`) and asserts the fail-closed
`_REQUIRE_DATABASE_TESTS === '1'` branch and `_FORBIDDEN_SHARED_URL` check are both
still present, so a future edit can't silently regress the guard.
