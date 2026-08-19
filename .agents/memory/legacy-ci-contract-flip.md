---
name: Legacy CI encodes old contracts
description: When a data-flow direction flips, old CI passes assert the outdated contract; rewrite assertions to the new invariant instead of weakening the guard.
---

**Rule:** When the canonical direction of a data flow flips (e.g. rolling episodes moved from Markdown→DB promotion to DB-canonical with Markdown as an exact replica), any CI test written under the old contract will start failing — not because the code regressed, but because the test asserts the outdated behavior.

**Why:** The episode-sync consolidated group failed on two tests ("longer .md wins" and "concurrent .md append must reach DB") after the DB-first replica-restore path shipped. Both failures were the *new, correct* behavior being flagged by *old* assertions. The dangerous instinct is to add a bypass or seam to make the old test pass — that would reintroduce the exact regression the new design eliminates (unaudited file edits promoted into the canonical record).

**How to apply:** When a guard-direction test fails right after an invariant change, first ask which contract the test encodes. If it encodes the superseded one, rewrite the assertions to the new invariant (e.g. "sentinel must NOT reach DB; .md must be restored byte-for-byte") and update the mutation self-check seam to model the new regression shape (e.g. disabling the replica-restore early return) rather than the old one (inverting a length comparison that no longer gates anything in production).
