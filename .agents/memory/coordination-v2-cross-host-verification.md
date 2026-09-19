---
name: Coordination V2 cross-host verification lessons
description: Ten hard-won gotchas from building authority-sensitive cross-host coordination — canonical bytes, idempotency, races, provider echoes, EOL text edits, publication markers, provenance vs authority, transaction boundaries, and production Git source verification.
---

## Cross-host artifact digests


Cross-host execution authority must define one canonical byte representation
before approval instead of trusting repository blobs or target-host checkout
bytes. Normalize every permitted transport representation, apply every
deterministic substitution, encode once, and use those exact canonical bytes
for hashing, writing, persistence, and replay.

**Why:** One Windows Gate 3 run failed because the producer substituted a
starting-commit placeholder while the server hashed the raw template. A second
failed because Windows materialized CRLF and Replit materialized LF. Both hosts
were internally consistent, but target-specific bytes could not represent one
portable authority artifact.

**How to apply:** Specify accepted input encodings and line endings, reject
ambiguous forms, normalize to one canonical format, enforce substitution
cardinality and size bounds, then bind all authority records to the resulting
bytes. Treat Git attributes only as defense-in-depth. Integration tests need a
separately authored canonical oracle with fixed bytes and digest; deriving the
expected value from the live input can let producer and oracle drift together.

## Immutable challenge attempt IDs


For immutable authorization challenges, do not use the stable payload digest as
the entire idempotency key. Include an explicit non-secret attempt generation.
Retries reuse the same attempt ID; a new intentional attempt uses a new ID.

**Why:** A bundle-only key made an expired immutable founder challenge occupy
the only key forever, so the same approved bundle could never receive fresh
authority.

**How to apply:** Keep the signed or approved payload unchanged, require a
bounded public attempt ID at the creation boundary, and compose both into the
idempotency key. Test same-attempt convergence and new-attempt freshness after
expiry while proving old evidence is unchanged.

## Canonical projection race


Any service that turns a canonical ledger event into a second projection must
validate the complete persisted thread, event, and payload after the ledger
create call and before writing the projection. A precheck is not sufficient.

**Why:** An independent writer that does not share the service's advisory lock
can insert the same idempotency key between the precheck and create call. An
idempotent helper may then return that incompatible existing record. Projecting
from it without full validation turns a race winner into unintended authority.

**How to apply:** Treat the persisted ledger result as untrusted until every
fixed and input-derived binding is checked. Build the projection from that
validated persisted result, not from a parallel local payload, and test the
between-precheck-and-create race explicitly.

## Bounded assignment baseline deltas


A bounded coding assignment must identify the exact missing behavior relative to
the promoted starting commit. If the focused test is already green, the artifact
must say so and explain why baseline success is not completion.

**Why:** A one-time, founder-approved generation can correctly run a green test
and stop without editing when the assignment broadly describes coverage that
mostly already exists. The coordinator should still refuse to attest an empty
patch, but the credential and approval cycle have then been consumed without
proving execution.

**How to apply:** Before provisioning, compare the assignment against the exact
promoted target. Name the missing operation, principal relationship, expected
result, and assertions that must remain. Add a static artifact guard for those
behavioral needles. Never force success with a formatting-only patch.

## Fixed-target provider echoes


An empty object schema does not guarantee a provider will return an empty
argument object. A model may repeat a prominent fixed path from the prompt.
Treat an exact repetition as provider syntax noise only when the host executor
still derives the target internally. Never expose or honor model-selected path
authority.

**Why:** A real one-shot cross-host run failed closed when the provider repeated
the correct fixed read target despite an empty declaration. The first tolerance
draft also showed that spreading an argument array can silently turn `[]` into
`{}`, erasing malformed evidence and widening acceptance.

**How to apply:** Keep fixed-target tool schemas empty. Accept only a plain empty
object or one exact allowlisted echo, reject all other keys, values, arrays,
nulls, and prototypes, preserve the received shape before normalization, and
make the executor ignore the echo in favor of its internal target.

## Cross-host exact text replacement


Exact replacement is a logical-text operation only after every participant's
line endings have been validated. Classify source and replacement text as LF,
CRLF, or no-EOL; reject mixed endings and lone carriage returns; compare in
canonical LF space; require exactly one overlapping-aware match; then serialize
using the source file's original style.

**Why:** A Windows checkout can expose CRLF bytes while a model returns the
same visible snippet with LF. Raw byte matching then rejects a legitimate
bounded edit even though path and content authority are correct. Prompting the
model to preserve line endings is not a deterministic boundary.

**How to apply:** Use this rule in fixed-target or otherwise bounded text
executors. Preserve raw provider arguments in immutable interaction evidence,
store only strict non-sensitive normalization metadata in execution results,
and prove every rejection leaves source bytes unchanged.

## Publication-marker status race


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

Marker recognition intentionally does not gate on the previous operational
`state` (e.g. `synced`/`failed`/`dirty`) — evidence (unexpired timestamps,
valid manifest, freshly re-authenticated marker parent/tree/subject) is the
recovery key, not what the last sync happened to write. A
`previous.state === 'ready_to_promote'` guard here looks like a safety
improvement but breaks intended, tested recovery from a transient non-ready
state; check whether the test suite already codifies the opposite expectation
before trusting a hypothetical negative case over it.

Evidence persistence must still distinguish *pending* from *terminal*: once a
candidate has been recorded as promoted, that completion is itself evidence
and must exclude the candidate from future "still pending" recognition, or a
later sync can re-arm an already-finished promotion and a repeat record
attempt collides with the append's own uniqueness guarantee. Any field used
to mark terminal completion needs the same persistence discipline as the
pending-candidate evidence (survive incidental non-terminal writes) and must
be reset when a genuinely new candidate generation begins — otherwise a fresh
candidate can inherit a prior generation's completion marker.

## Historical provenance vs current authority


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

## Two-phase external verification


Run authenticated remote provenance checks and content-addressed object hashing
without an open database transaction. Preserve the exact authority snapshot
used by those checks, then open a short transaction, re-read both the requested
record and current authority, require exact equality, derive the persisted
digest from transaction-fetched authority, and append all rows atomically.

For a concurrent identical insert, recover only from the exact named unique
constraint. Perform recovery in a second short transaction and prove complete
persisted equivalence before returning the winner.

**Why:** A production runtime publication held an idle Neon transaction while
GitHub, package, and object-storage verification ran. The database session
expired before the next SQL statement even though the database was otherwise
healthy.

**How to apply:** Use this pattern for any immutable publication or authority
append that depends on network provenance, package verification, or large
object reads. Do not replace it with longer timeouts or transaction keepalives.

## Production Git source authority


Production source verification must use one authenticated remote snapshot of
the exact attested commit. Do not use deployment-local `.git`, deployed file
bytes, branches, tags, tree equivalence, split tree/blob reads, or HTTPS that
silently bypasses a pinned SSH transport.

**Why:** The first founder-authenticated Coordinator V2 runtime-release request
failed safely because Replit publish images intentionally omit `.git`. Review
also showed that test dependency injection and transport normalization can
accidentally become authority bypasses unless excluded from the publication
boundary.

**How to apply:** When production must bind generated or uploaded artifacts to
source, fetch the exact commit through the protected remote transport, verify
the received commit and tree, read the closed bounded blob set from that same
snapshot, and test the real materialization mechanism plus success/failure
cleanup hermetically.
