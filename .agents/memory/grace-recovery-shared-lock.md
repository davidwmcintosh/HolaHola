A "grace recovery" path that mints a replacement credential/token/lease upon
seeing "nothing has used the old one yet" races against the normal path that
is about to mark the old one used. Checking-then-minting is not atomic against
checking-then-marking-used unless both take the *same* lock.

Two conditions are both required to close this, not just one:
1. The path that marks something "used" (first authentication, first
   consumption) must take the identical serialization primitive (e.g. the
   same `pg_advisory_xact_lock` key) that the grace/recovery path already
   holds while deciding eligibility -- otherwise they interleave and both can
   commit as valid.
2. The grace/recovery path must revoke/invalidate whatever it supersedes at
   the moment it succeeds, not just mint a new one alongside it -- otherwise
   even with #1, a live-but-not-yet-used old credential can still surface
   later and be legitimately used, defeating the single-winner guarantee.

**Why:** found via code review on the HolaHola coordination-credential-broker
bootstrap grace re-exchange: the grace path checked `lastUsedAt IS NULL`
under an advisory lock, but the normal "mark used on first authentication"
path did not take that same lock and was not transactional, so a credential's
first use and a concurrent grace re-exchange could both succeed, leaving two
simultaneously-valid credentials for one runtime.

**How to apply:** whenever adding a "recover without re-provisioning" /
"grace window" / "at-most-once with a forgiving retry" mechanism anywhere
(bootstrap tokens, idempotency keys, lease takeover, single-use links),
check both conditions above before considering it race-safe. A test that
merely calls the two paths sequentially will not catch this -- prove it with
a deterministic interleaving test that pauses one transaction mid-flight
(e.g. via a test-only hook right after the lock is acquired) and asserts the
other side blocks on the same lock, then observes the correct loser outcome.

