---
name: Node test runner nested-subtest context reentrancy
description: Calling the outer context.test() from inside one of its own still-pending subtest callbacks produces a confusing hang-like failure that is not a database or infrastructure problem.
---

## Rule

When a `node:test` subtest callback needs its own nested subtests, declare
that callback with its own context parameter (e.g. `async (t) => { ... }`)
and call `t.test(...)` for its children. Never call the outer/ancestor
`context.test()` reentrantly from inside one of that same context's own
still-pending subtest callbacks — that misuse is easy to introduce by
copy-pasting a sibling `context.test(...)` call one indentation level too
deep.

**Why:** Node's test runner does not error clearly on this misuse. Instead it
surfaces later as `cancelledByParent` / "Promise resolution is still pending
but the event loop has already resolved" on the outer subtest and its later
siblings, with reported durations that look exactly like a multi-minute hang.
This is a pure test-authoring bug, not a sign of a stuck query, a poisoned
connection pool, or a slow disposable database branch — confirmed by a
standalone single-shot repro against the identical database and pool (a
deliberately-failing insert followed by two plain selects) that completed in
under 200ms. Chasing the database/pool as the cause first cost significant
debugging time before the actual mis-nested `context.test()` call was found.

**How to apply:** Any time you write (or review) a node:test file with
subtests-of-subtests — e.g., two CAS-conflict checks nested inside a
"created successfully" test — audit that every `context.test(...)` call
uses the context parameter belonging to its own immediate parent callback,
never a captured outer one. If a DB-backed test file reports a suspiciously
round-number stall (multiples of a pool's `idleTimeoutMillis`, e.g. ~120s)
on a subtest that also declares further nested subtests, check this before
suspecting the database.
