---
name: Coordination comment vs completion
description: A comment reply on a coordination thread does not close it; only accept+complete (with evidence) flips thread state and clears "confirmation of closure" gaps.
---

Posting a `comment` event on a coordination thread — even one that fully describes a shipped fix — never changes `coordination_threads.state`. The ledger's `stateForEvent()` returns the thread's existing state unchanged for `comment`; the thread stays `delivered` indefinitely unless the current owner explicitly runs `accepted` then `completed` (the latter requires an evidence array, e.g. a verified commit reference, or a prior `evidence_added` event).

**Why:** David relayed a complaint from another Luca runtime that he "hadn't received... confirmation of the issues being closed," even though luca-replit had already posted detailed comments describing real, shipped fixes on both open threads, correctly delivered to his inbox. The comments were real and received, but the thread state machine never recorded completion, so anything checking thread `state` (rather than manually reading every comment) would still see the work as open.

**How to apply:** When resolving a reported coordination-thread issue, don't stop at a descriptive `comment`. Verify the fix is actually in the repo (commit exists on the branch it claims, the described code change is really there), then run `accept` (if not already current owner) followed by `complete` with a real evidence reference. Preserve any hedge the original description carried (e.g. "reasoned/syntax-checked, not yet confirmed by a live run") in the completion content — closing the ledger record is not license to assert more confidence than actually exists. `accepted`/`completed` events route to the thread's `originActor` for inbox delivery regardless of the event's own `recipientActor` column (which is null for these lifecycle events) — delivery still happens, it's just derived differently than for `comment`.
