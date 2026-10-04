## CAS guard testing needs a real-Postgres race test

Adding a new compare-and-set (CAS) guard to `SharedSpecTransaction` (the pattern
`compareAndSetCurrentRevision` established for revisions, and
`compareAndSetReviewClaim` now follows for review claims) needs two separate
tests, not one:

1. An in-memory domain test in `shared-spec-core.test.ts` proving the
   domain-level contract (exactly one caller wins, the loser gets a clean
   `SharedSpecDomainError`, the row never shows a mixed/overwritten state).
2. A dedicated real-Postgres test proving the CAS guard itself closes a
   genuine cross-transaction race.

**Why:** `InMemorySharedSpecRepository`'s `transaction()` fully serializes by
design (see its own class comment), so two "concurrent" calls in an in-memory
test never actually interleave — the loser is always rejected by the calling
method's own pre-check (e.g. `claimReview`'s `review.claimedReviewerActorId`
check) before it ever reaches the new CAS method. The in-memory test can pass
100% of the time even if the CAS guard itself is missing entirely or
implemented as a no-op — it is not evidence the guard works, only that the
domain contract is intended. Proven directly on task 1662: stashing/reverting
just the CAS guard's implementation (keeping the pre-check) left the in-memory
test green while a real-Postgres equivalent correctly failed with two
fulfilled claims and a silently overwritten winner.

**How to apply:** when adding or reviewing a new CAS guard on this
repository's dual in-memory/Postgres implementation pattern, require a real
disposable-Postgres test file (mirror
`server/scripts/test-shared-spec-review-claim-race-postgres.test.ts`'s
`disposableTarget()` gate and `getVerifiedCiDatabaseUrl()`-first pattern) that
actually races `Promise.allSettled` calls against a live database, and prove
the guard has teeth by temporarily reverting just the CAS method and
confirming that specific test then fails. Wire the new file into both
`scripts/run-ci-test-steps.mjs` and `server/scripts/run-validation-suite.sh`
next to its sibling shared-spec Postgres tests -- no extra gate wiring is
needed since `scripts/neon-branch.ts`'s `cmdGate()` already sets the generic
`SHARED_SPEC_TEST_DATABASE_*` env vars for any file using this pattern.


## Force overlapping database reads

CAS race tests must force both transactions to observe the same original state before either writes. Starting two promises together does not establish overlapping database reads.

**Why:** A CI runner can serialize the reads enough for both operations to succeed legitimately when sequential reassignment is allowed. Treating that scheduling outcome as a failed CAS produces a false release blocker; allowing two successes instead would weaken the actual stale-write invariant.

**How to apply:** Use a bounded, test-only barrier after real database reads, then require exactly one successful compare-and-set and one clean conflict. Keep real PostgreSQL coverage and production guards unchanged.
