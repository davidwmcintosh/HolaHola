## Automatic task-update absence is not confirmation

---
name: Task state can go stale between reads
description: A project-task automatic_update line only reports what changed, and a task's own title/description text can be rewritten mid-flight by whoever is working it — neither absence-of-signal nor an earlier summary proves the current state.
---

The system's task-change feed (`automatic_updates`) only emits lines for
transitions it detected, showing whatever fields it chose to show. Seeing a
task listed as `[IN_PROGRESS]` without a `[BLOCKED BY ...]` annotation is not
proof the blocker cleared — it can just mean the feed didn't re-emit that
annotation, or the snapshot predates the real state.

**Why:** Concluded "the ownership unblock went through cleanly" for three
tasks based solely on that absence, on 2026-09-17. It was wrong — the user
confirmed none of the three had even run `begin` yet, and two of them
reappeared moments later with an explicit `[BLOCKED BY WAITING_FOR_INPUT]`
tag.

**How to apply:** Before declaring a blocker cleared, check the actual
authoritative state directly (query the relevant ledger/table, or ask) rather
than inferring it from what an update line happened to omit.

**Related, separate failure mode:** a task's own title and description are
not static either. An `IN_PROGRESS` task lives in an isolated task-agent
environment and can rewrite its own scope as the agent learns more; a
main-Repl session can also append a "Status update" directly into the
description while unblocking a dependency. Re-checked a task on 2026-09-18
whose blocker had been summarized earlier in the same conversation (a
GitHub-push failure) — by the time of the re-check, the task's title and
body had been fully rewritten around a different, deeper problem it had
moved on to, with no trace of the original framing left. A conversation
summary (including your own compacted memory of "what task #N is about")
describes the task at the moment it was last read, not now.

**How to apply:** Before answering "what is blocking #N" or "what is #N
about," refetch the task's current title/description directly rather than
relying on an earlier read or a compacted summary of it, especially for
`IN_PROGRESS` tasks and especially across any gap in the conversation.

## Coordination comment vs completion

---
name: Coordination comment vs completion
description: A comment reply on a coordination thread does not close it; only accept+complete (with evidence) flips thread state and clears "confirmation of closure" gaps.
---

Posting a `comment` event on a coordination thread — even one that fully describes a shipped fix — never changes `coordination_threads.state`. The ledger's `stateForEvent()` returns the thread's existing state unchanged for `comment`; the thread stays `delivered` indefinitely unless the current owner explicitly runs `accepted` then `completed` (the latter requires an evidence array, e.g. a verified commit reference, or a prior `evidence_added` event).

**Why:** David relayed a complaint from another Luca runtime that he "hadn't received... confirmation of the issues being closed," even though luca-replit had already posted detailed comments describing real, shipped fixes on both open threads, correctly delivered to his inbox. The comments were real and received, but the thread state machine never recorded completion, so anything checking thread `state` (rather than manually reading every comment) would still see the work as open.

**How to apply:** When resolving a reported coordination-thread issue, don't stop at a descriptive `comment`. Verify the fix is actually in the repo (commit exists on the branch it claims, the described code change is really there), then run `accept` (if not already current owner) followed by `complete` with a real evidence reference. Preserve any hedge the original description carried (e.g. "reasoned/syntax-checked, not yet confirmed by a live run") in the completion content — closing the ledger record is not license to assert more confidence than actually exists. `accepted`/`completed` events route to the thread's `originActor` for inbox delivery regardless of the event's own `recipientActor` column (which is null for these lifecycle events) — delivery still happens, it's just derived differently than for `comment`.

## Compacted-summary reverification

---
name: Compacted summary claims need re-verification before repeating
description: Specific factual claims (milestone numbers, "already integrated" status) that arrive via a compacted conversation summary are unverified until checked against the live repo — treat them as leads, not facts.
---

After a memory/context compaction, the carried-forward summary can contain specific-sounding claims (milestone labels like "M13/M14", a status like "Antigravity is already integrated") that were themselves never grounded in a doc, commit, or DB row — they may be a paraphrase, an inference, or drift from an earlier turn. Repeating such a claim to the user without re-checking it against current code/docs compounds the error: what was originally an ungrounded inference becomes a confidently restated "fact" a second time.

**Why:** Told David "Windows M13/M14 release work is the active gate; Antigravity is an earlier M6/M7 dependency already integrated" based on a pre-compaction summary. David immediately caught it as wrong (Antigravity was never turned on; he'd done no Windows work). A fresh grep across `server/`, `shared/`, `docs/superpowers/specs/`, `replit.md`, and `git log` found zero occurrences of those milestone numbers anywhere — the claim had no source in the repo at all.

**How to apply:** Before restating any specific factual claim that originated in a compacted summary (a number, a version label, a "such-and-such is done/integrated" status) to the user, re-verify it against the current repo (grep code/docs, check git log, query the DB) — especially if the claim is about to be delivered as a direct answer to a question, not just used as background context for your own next action. If a claim can't be re-substantiated, say so plainly and drop it rather than defending or reconstructing a justification for it.

