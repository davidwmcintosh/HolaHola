---
name: Publication-marker status race
description: Safe recovery and durable behavior when scheduler synchronization follows an explicit Replit publication marker.
---

After a prepared source candidate is explicitly published, Replit may create a
same-tree child commit named `Published your App`. A scheduler sync can move
both source heads to that marker and overwrite the operational state even while
the original candidate, expiry, and complete validation manifest remain valid.

The validated parent remains source authority. The child commit is only the
publication trigger and must be proved locally and through the authenticated
remote by exact SHA, parent, tree, and subject.

For immediate recovery, restore promotion readiness only when the original
candidate and its exact unexpired validation evidence are intact. Do not extend
the original preparation time or expiry. The unchanged record path must still
prove clean state, authenticated parent and marker evidence, exact composite
publication reference, final-state stability, immutable receipt, and database
append.

**Why:** A scheduler sync replaced `ready_to_promote` with `synced` immediately
after a valid publication marker was pushed. No authority evidence was lost,
but the record operation was blocked before its substantive proofs.

**How to apply:** Preserve marker-backed readiness in the source-control state
machine. Never promote the marker merely because its tree matches, and never
repair the race by weakening the record gate or refreshing validation expiry.
When authenticated immutable proofs are resolved with Git fetch in one checkout,
serialize operations that read shared `FETCH_HEAD`; concurrent fetches can
replace each other's proof even when both requested commits are valid.