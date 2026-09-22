## Coordination-runtime claim() guard redundancy

---
name: coordination-runtime claim() fresh_consumption_required guard redundancy
description: claim()'s two independent fresh_consumption_required checks overlap for the same-packet-reuse scenario; removing either alone is silently compensated by the other.
---

`claim()` in `server/services/coordination-runtime.ts` enforces `fresh_consumption_required` through two separate checks:

1. Reclaim guard: any packet/receipt that already has *any* prior claim (`priorPacketClaims.length > 0`) is rejected outright.
2. Supersession guard: a replacement packet whose evidence doesn't properly follow the latest terminal claim for the thread (wrong `supersedesClaimId`, or timestamps predating the terminal claim) is rejected.

For the "reclaim the same packet after a violation" scenario (the regression test added for task 1448, "execution envelope violation is recoverable only through a fresh superseding packet"), these two checks fully overlap: removing either one alone still leaves the test passing, because the other independently produces the same `fresh_consumption_required` code. Confirmed by direct mutation testing (task 1501). For this exact reuse case the overlap is structural, not a coincidence of test data — a reused original packet's `createdAt` always predates the terminal claim's `terminalAt`, so the supersession guard's `packet.createdAt < latestPriorClaim.terminalAt` clause is always true when guard 1 is the one that got deleted.

**Why this matters:** a future refactor that deletes *only one* of these two checks would not be caught by any existing test in the repo (verified as of task 1501, Sep 2026). Only removing both together breaks the regression test.

**How to apply:** when touching either guard, don't rely on the existing envelope-violation-recovery test to prove the other guard still matters on its own — it can't distinguish "guard 1 removed" from "guard 1 and 2 both fine." A dedicated test isolating each guard (e.g. a supersession-guard violation using a packet/receipt that was never itself claimed, so guard 1 doesn't fire) would need new fixture construction, not just removing an assertion. See follow-up task proposed under task 1501 (title mentions "both halves of the violated-claim reclaim guard") if it's still open.

## Create-race parity with revise-race

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

