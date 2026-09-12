---
name: Historical provenance vs current authority
description: How to combine immutable state-transition evidence with fresh time-bounded authorization.
---

Historical state provenance and current action authority are separate,
simultaneously required proofs. Validate the historical transition against the
current state it produced, and validate the fresh authorization against the
action being attempted. Do not require the historical transition's expired
receipt to equal the fresh action receipt.

**Why:** A compatible replay correctly performs no new state transition. Making
it emit a replacement transition audit would falsify history, while requiring
the original receipt makes fresh time-bounded authorization impossible.

**How to apply:** For recovered runtime operations, keep the recovery audit
bound to the bundle, permitted lineage, and current recovered state. Separately
require a fresh active receipt for the new action's actor, scope, artifact, and
lease. Tests must use a real transition under authority A followed by the new
action under distinct authority B, and prove replay does not rewrite history.