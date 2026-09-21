---
name: Create-race parity with revise-race
description: A "create if not exists" path needs the same race protection as an existing CAS-append/revise path, and how to test that without real concurrency.
---

A check-then-insert "create new resource at this destination" branch is exposed to the same lost-race window a CAS-append/revise branch already guards against, even though it looks safe because "nothing exists yet." Two callers can both observe "not found" before either commits.

**Why:** Found in shared-spec's `shareDocument`: the revise branch was already CAS-protected and tested, but the sibling create branch had no guard at all, silently relying on the database's own unique index to reject the second insert — which surfaced as a raw, unclassified 500 instead of the same clean CONFLICT the revise branch gives. The identical pattern exists in the pre-existing `createDocument` method too (flagged as a follow-up, not fixed — out of scope for the task that found it).

**How to apply:**
1. Detect the specific failure by catching the real unique-constraint violation (walk a possible `.cause` chain checking `code === "23505" && constraint === <name>`), the idiom already established by `isCoordinationPreparationUniqueConflict` in `coordination-windows-generation.ts` and ~7 other files. Don't try to prevent the race with an extra application-level pre-check — that only shrinks the window without closing it.
2. Make an in-memory/fake repository throw the SAME low-level shape (`{code, constraint}`) a real Postgres violation carries for this scenario, rather than a nicer domain error. Otherwise the fake short-circuits before the recovery code ever runs, and the recovery path stays untested against the fake backend, only ever exercised in production.
3. To unit-test the recovery path without real concurrency: an in-memory repository that serializes transactions (one lock, one at a time) can never let two calls both observe "not found" the way real DB transactions can under read-committed isolation. Use a thin repository shim wrapping the fake: force its destination-lookup to return "not found" on the first-ever call (simulating the lost race) while a "winner" row is pre-seeded directly into the underlying fake, then force the insert to throw the low-level violation shape. The recovery code's own re-read then naturally sees the real winner.
