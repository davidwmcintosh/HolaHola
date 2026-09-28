---
name: Source-control stall detection
description: Generic failure-count/staleness-age stall detection plus dual-channel alerting for a background sync loop, and why per-state special-casing isn't needed.
---

A background sync/reconciliation loop that writes its own status snapshot (state,
consecutiveFailures, lastSuccessfulSyncAt) needs a staleness check that runs
independently of the loop's own success/failure path. A wedged run (hung
subprocess, stuck lock) simply stops calling its own status-writing code, so
nothing inside that codepath ever gets a chance to notice it has gone stale.
Something outside it — a separate timer tick reading the last known snapshot
against the current wall clock — has to own that check.

Detecting a stall generically (consecutiveFailures crossing a threshold OR
lastSuccessfulSyncAt aging past a threshold) rather than special-casing which
specific state is currently failing (dirty tree, lock contention, diverged
history, a plain command failure, etc.) is both simpler and naturally avoids
false positives: every one of those states already increments the same
counter, but a couple of them alone — the "clears within a poll or two"
cases — never crosses a threshold sized comfortably above that noise floor.
No per-state allowlist/blocklist to maintain as new failure states get added.

One notification channel is usually not enough for an alert meant to be seen
promptly rather than eventually. An ephemeral chat-style channel needs someone
to have that page open at the right moment; a durable per-recipient
notification/inbox row persists as unread until someone actually looks.
Firing into both closes the real gap — the failure mode in the incident that
motivated this (a sync pipeline stuck "diverged" for ~2.5 days / ~120
consecutive failed attempts before anyone noticed) was never "no alert
exists", it was "the only signal lived in a state file nobody was looking
at".

Dedup the alert per stall *episode*, not per check: fire once on the
transition into "stalled" via a flag persisted alongside the status snapshot,
clear that flag on the next real success, and allow a fresh alert next time a
new episode crosses the threshold. Deduping with an in-memory-only key
(e.g. `${consecutiveFailures}:${lastSuccessfulSyncAt}`) works well
specifically for a read-only backstop check that must never itself
read-modify-write the status file — that avoids racing the loop's own
status-writing code on an unlucky timing window.

