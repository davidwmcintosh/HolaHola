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
