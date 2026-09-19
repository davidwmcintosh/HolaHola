---
name: process.exit() inside try skips the enclosing finally
description: Node's process.exit() terminates immediately without unwinding the call stack, so a finally block meant to clean up a test fixture never runs — causing cross-run state pollution in later invocations.
---

## The problem

`process.exit(code)` inside a `try { ... } finally { cleanup() }` block does NOT trigger the `finally` block. Node terminates the process immediately rather than unwinding the stack like a thrown error would. Any script that reports a failure via `process.exit(1)` from inside a guarded block — instead of `throw` — skips its own cleanup on that path.

## Why this matters

`test-rolling-sync-guard.ts` (episode-sync fixture, ID `99000000-0000-4000-8000-000000000099`) hits this: several of its failure branches call `process.exit(1)` directly instead of throwing, inside a `try` whose `finally` deletes the test DB row and removes the test `.md` file. When one of those branches fires, the DB row and `docs/episode-99.md` are left behind. The NEXT run of the same test (or a related one sharing the fixture ID) then starts from that dirty state instead of a clean one, and can fail a completely different assertion than the original run — making the failure look nondeterministic/unrelated when it is actually inherited leftover state from an earlier failed run.

## How to apply

- When diagnosing a confusing or seemingly-unrelated CI failure in a script using a fixed fixture ID/file, check whether an earlier run could have exited via `process.exit()` from inside a try/finally and left that fixture dirty. Reset the fixture (delete the DB row by its hardcoded ID, remove the stray file) and re-run in isolation before concluding the failure reflects a real code regression.
- When writing new test scripts with this shape, prefer `throw new Error(...)` over `process.exit(1)` inside guarded setup/assertion code so `finally` cleanup always runs; reserve `process.exit()` for the top-level final result after cleanup has already completed.
