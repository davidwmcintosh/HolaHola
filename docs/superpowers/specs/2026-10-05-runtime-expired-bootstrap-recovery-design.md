# Windows runtime initializer: expired replay with no saved issue ID

## Status, scope, and approval stops

Design only. Prepared separately from
`docs/superpowers/specs/2026-10-05-runtime-timestamp-replay-repair-design.md`.
Independent approval must bind this exact shared-spec revision and content hash.
Founder approval of the recovery policy is a separate prerequisite before any
implementation. Ownership permission to prepare this design is not policy
approval. This document authorizes no runtime issuance, production-record
repair, publication, Windows execution, or coordinator session creation.

Deliverable: reviewed recovery policy, implementation contract, synthetic test
plan, and release stops. Executable changes and test execution belong to a
subsequent approved implementation task.

## Observed failure and existing boundaries

In `scripts/hola-coordinator.ps1`, `Initialize-HolaCoordinatorRuntime` persists
the request key before POST. If the server commits its issue but the client
cannot save the response, local `issueId` remains empty. On retry the same
host/request pair replays the original issue. The response is passed to
`Assert-RuntimeManifestShape` without `AllowExpired` before its ID is saved.
An expired replay therefore fails before either existing saved-issue expiry
branch can run. This is a source-proven failure class, not a claim that a
particular operator's key has been correlated to a production row.

The timestamp repair restores the original canonical payload by matching the
immutable database digest. It does not make the old issue live. Artifact
access and acknowledgement still enforce database expiry. The client must not
adjust timestamps, renew the old issue, or download from it.

The current Ed25519 verifier runs a fixed inline script using Node only after
the executable's Authenticode and manifest hash checks. A first-install client
cannot assume an independently trusted Node is present. Shape validation,
canonical digest comparison, HTTPS, and host-authenticated request transport
must NOT be described as verification of the returned Ed25519 signature.

## Alternatives and recommended policy

1. **Evidence-only checkpoint, then bounded client-managed generation rotation
   (recommended).** Retain the expired envelope and old binding under DPAPI;
   persist one successor key before sending it. Request a new issue through
   the existing host-authenticated endpoint. No server protocol/schema change.
2. **Fail closed without automatic recovery.** Preserve the current stop;
   separately design a native pre-runtime signature verifier or authenticated
   expiry-status protocol before allowing rotation. Stronger authenticity
   evidence for discard, but does not resolve this initializer's loop now.
3. **Operator state deletion, supplied replacement keys, or extending expiry
   (rejected).** Loses custody/idempotency evidence or changes signed authority.

The founder decision is whether a structurally valid, request-bound, canonical
digest-consistent but not yet signature-verified expired reply may justify
discarding a request generation and obtaining fresh evidence. It never
justifies installing, acknowledging, trusting, or executing anything.

A well-formed invalid signature on that expired reply may at most cause a
bounded new authenticated issue request. This is an explicit availability /
issue-volume tradeoff, not a signature-verification exception. Invalid
signatures on any fresh installation manifest must still fail the existing
verifier. If that discard tradeoff is not approved, use alternative 2; do not
silently introduce a verifier, new trust root, or server recovery endpoint.

## Evidence intake contract

Only the empty-`issueId` response path is added by this design. Existing
saved-issue handling remains subject to its existing checks; do not use this
change to relax or broadly rewrite those branches.

Before recording an expired replay:

- Hold the existing per-SID bootstrap mutex; pass enrollment-host, approved
  worktree, no-reparse, SID ACL, DPAPI state shape, endpoint, unexpired host
  credential, and RSA host-key checks.
- Use the unchanged HTTPS endpoint and host-authenticated POST with the
  already-persisted request key, no redirects and no endpoint substitution.
- Validate the complete envelope/payload/artifact/source-member shape using
  evidence-only `AllowExpired`. All other shape constraints remain enforced:
  issue and release IDs, timestamp parsing, positive lifetime, five-minute
  maximum lifetime, future-issued ceiling, paths, roles, counts, and sizes.
  Reject malformed dates or invalid intervals rather than inferring expiry
  from any thrown error.
- Independently compare `hostKeyFingerprint` with the local RSA fingerprint,
  and `requestKeyDigest` with SHA-256 of the exact persisted key before any
  checkpoint or rotation. No invented host enrollment ID: the response ID is
  retained as an unverified claim; installation's existing verifier/server
  checks continue enforcing the actual enrolled host.
- Compute the canonical payload digest and require equality with
  `canonicalResponseDigest`. Validate signature encoding and pinned-key
  fingerprint format/consistency without claiming cryptographic verification.
  A digest is consistency evidence, not authenticity.
- Classify as expired only when all the above pass and its unchanged
  `expiresAt` is at or before the local UTC clock. Re-check freshness at all
  existing later installation boundaries. Do not change Windows clock policy.

Do not catch `runtime_manifest_expired` generically: that failure can also mean
an invalid interval or future-issued time. Fresh responses follow the normal
path. Malformed, wrong-host, wrong-request, wrong-digest, wrong-key-fingerprint,
transport, and DPAPI failures stop without rotation.

## Durable evidence and successor transaction

Use a narrowly scoped DPAPI CurrentUser recovery journal under the existing
private bootstrap root. The exact schema and fail-safe codes must be settled
in the approved implementation review; no plaintext audit file or evidence
pruning is allowed by this policy.

Each record binds: endpoint, old request key and digest, original issue ID,
complete original response envelope, prior installed flag, any separately
proved installed baseline, and a single client-generated successor request key.
It labels the original envelope `unverified_expired_evidence`, not trusted or
installed. Preserve payload values, millisecond strings, nonce, signature,
key fingerprint, and canonical digest exactly. JSON serialization may change
outer whitespace/key order, never canonical payload bytes or signature
strings. Recompute the canonical digest after DPAPI round-trip.

Create the record atomically with a fresh GUID successor before altering active
request state or issuing a successor POST. Retain it after successful recovery.
Use a safe fixed journal namespace and validated digest/UUID names, not
server-controlled paths. Preserve no-reparse, SID ACL, containment, atomic
write, and fsync checks. Journal creation must be create-once: an existing
record may be reused only after exact old-binding/evidence comparisons.
Conflicting, corrupt, cross-endpoint, or ambiguous records fail closed.

Then atomically save active request state with that recorded successor key,
empty `issueId`, null manifest, and cleared pending acknowledgement payload and
signature. Do not clear `host-material.dpapi`, `host-private-key.dpapi`,
`runtime-bootstrap-ack.dpapi`, or the installed manifest. All changes are
client-managed, never a manual cache-clear instruction or operator-supplied key.

Recovery must read its journal before accepting active pending state:

| Crash boundary | Required restart behavior |
| --- | --- |
| Before journal commit | Retry the old durable request; never send an unpersisted successor |
| Journal durable, old active key still present | Reuse the recorded successor; finish active-state transition |
| Successor active key durable, before POST | POST that exact successor |
| Server commits successor, response lost | Replay the same successor; never mint another merely because `issueId` is empty |
| Successor issue saved, before install or ack | Resume normal durable installation/ack handling |
| Conflicting journal/state or failed write | Stop without network issuance, stage deletion, or further rotation |

At most one request-generation rotation per initializer invocation, including
any rotation already performed by the existing saved-issue branches. The new
path may POST the original key and, following a successful durable transition,
POST one successor. If that successor is also expired, retain its response as
non-authoritative evidence and stop with a clear retry diagnostic. A later
invocation may recover that different expired generation, but must never
generate two different successors for the same old generation.

No unbounded loop, recursive initializer call, sleep-until-success behavior,
or automatic background issue creation. Successor network failure preserves
the new pending key for exact retry. Error reports must not expose tokens,
private keys, request keys, DPAPI plaintext, or raw envelopes.

## Installed state, staging, and unchanged installation gates

For `installed=false`, the expired reply cannot authorize a download, verifier
executable, installed-manifest write, acknowledgement, or credential issuance.
Only after the evidence journal and active successor are durable may cleanup
remove that exact old issue's staging directory, using the existing private
path/ACL/no-reparse checks. No deletion of other stages or installed files.
Cleanup failure stops; retry uses the durable successor and rechecks cleanup.

For `installed=true` with an empty issue ID (possible after an installed
generation's earlier rotation), the replay is not the installed baseline.
Load and independently prove the actual installed manifest using the existing
`Assert-FullyInstalledRuntimeGeneration -AllowExpired` path and all its
signature, artifact, source, checkout HEAD/tree, ACL, and membership checks.
Persist its binding in the journal; re-prove it after restart before reuse.
Missing/corrupt installed evidence fails closed. Never treat the boolean,
journal label, or expired replay as proof of installation.

On a fresh successor reply, preserve the existing equivalence policy:
release ID/digest, source promotion ID/digest, repository identity, published
commit/tree, publication/validation references, artifact list, and source
members must match the independently proved installed baseline to reuse it.
Issue ID, request digest, nonce, issue times, and signature are issue-specific,
not generation equivalence fields. If evidence differs, perform the normal
clean staged installation; retain the old installed evidence until normal
commit boundaries. Do not weaken source-current or release-age/revocation
checks to make an old generation reusable.

Both fresh installation and reuse must retain all existing fresh-manifest
expiry checks, Authenticode publisher trust, pinned Ed25519 signature
verification, artifact hash/size/role/membership checks, exact source-member
hashes, exact checkout HEAD/tree, private-path ACL and reparse checks, host /
request binding, and authenticated acknowledgement/status semantics.
Evidence-only `AllowExpired` cannot flow into a fresh install/ack path.
Neither downloaded expired Node nor staged JavaScript is executed for recovery.
Do not widen PowerShell execution policy, trusted publishers, allowed signers,
ACLs, endpoints, or credentials. Initialization never creates a coordinator
session and does not call `Invoke-HolaCoordinator`.

Server expiry remains authoritative for access/acknowledgement. The old issue
row's digest, timestamps, request key, host, release, and acknowledgement state
are unchanged. A successor is a new issue with its own normal expiry, not
renewal of the old issue. New issuance may correctly fail because the active
release is too old, revoked, unavailable, or source-stale; recovery is not
permission to bypass that refusal.

## Verification required after policy approval

No runtime tests have been run for this design-only deliverable.

### Synthetic native Windows fixtures

Use a disposable Windows user/worktree and synthetic credentials/keys only.
Exercise the actual supported native PowerShell / DPAPI / filesystem behavior,
not a Linux text scan described as Windows proof. Do not copy enrolled
production DPAPI files, tokens, request keys, issue IDs, or signed records into
fixtures. Redirect endpoint/state roots through a test-only harness; fail
closed if a production endpoint, real credential path, or live actor is used.
Never disable or mock away the boundary being asserted.

Required cases:

- Empty issue ID plus expired synthetic replay: original canonical payload
  survives checkpoint; one successor is durable before POST; no expired
  artifact fetch/Node execution/install/ack/session call.
- Empty issue ID plus fresh reply: no rotation; normal installation path.
- Both installed flags; valid installed proof/equivalent fresh evidence,
  changed generation, missing manifest, corrupt installed artifact/source,
  invalid signature, stale checkout, invalid ACL and reparse paths.
- Every crash boundary above, atomic-write failure, stage-cleanup failure,
  journal mismatch, repeated retry, response loss after server commit, and
  concurrent invocation blocked by the existing mutex.
- Invalid interval / maximum lifetime / future-issued / malformed timestamp
  is not misclassified as expired. Wrong host fingerprint, request digest,
  canonical digest, envelope shape, key fingerprint, and signature encoding
  stop before rotation. Include Unicode canonicalization round-trip.
- A well-formed invalid expired signature remains unverified evidence and
  cannot authorize anything; a well-formed invalid fresh signature rejects.
- Second expired response halts without a second rotation. Failure/restart
  uses the recorded successor; no operator identifier or clearing needed.
- Host material/key and existing ack remain byte-identical; old envelope
  contents remain exact; only normal successful install changes installed
  files. Diagnostics remain redacted.

### Disposable PostgreSQL / actual service path

Extend `server/scripts/test-coordination-v2-runtime-bootstrap-postgres.test.ts`
behind its verified disposable-target gate. Never use the shared application
database. An unavailable disposable target is a reported skip, not a pass.

Create synthetic host/release/issues through the actual transaction/driver
path. Simulate a response lost after commit, expire the old synthetic issue,
then replay the same host/key. After timestamp repair the returned canonical
payload must match the immutable historical digest. Repeated replay leaves
old issue count/binding/timestamps/digest unchanged.

Issue once for the journal's persisted successor; replay it and prove exactly
one distinct successor issue with the same host and normal release checks.
Verify old issue artifact access and acknowledgement still reject using
original DB expiry, even when whole-second signed evidence differs from
fractional DB timestamps. Verify tampering, cross-host/request attempts,
revocation, stale source/release, and release-age limits still fail closed.
No coordinator session rows or reauthorization changes are created by tests.

### Mutation checks and implementation verification

Prove focused tests fail when the expired intake path is removed, host/request
checks are bypassed, journal-before-rotation or persist-before-POST is removed,
successor reuse is replaced with another GUID, bounded rotation is removed,
old staged bytes enter installation, installed proof is skipped, or fresh
signature/expiry checks are bypassed. Test fail-safe outcomes as well as
successful recovery; no mutation test touches canonical/live evidence.

Register tests through the established CI registry; run focused coverage,
typecheck, disposable-DB gate, and native synthetic Windows fixtures. Record
source bytes, platform, pass/fail/skip evidence honestly. Linux validation
cannot substitute for DPAPI/ACL/native Windows results.

## Exact-source and runtime publication sequence

This design's review is distinct from implementation review. The server
timestamp repair must also be validated and published for the target
application before exercising this recovery against it; otherwise replay may
still fail before expiry handling. This is a dependency, not authorization to
implement or publish that repair here.

After founder policy approval and separately authorized implementation:

1. Independently review implementation and synthetic fixtures against the
   approved policy; validate on disposable targets without live credentials.
2. Commit/promote exact reviewed source through the protected source-control
   path. Prepare and verify fresh exact-source GitHub-to-Render evidence.
3. Stop for the founder-only actual source/application publication, then
   verify/record that exact published commit and healthy target.
4. Prepare and verify a fresh runtime release for those same source bytes and
   artifacts. Stop for founder-only runtime publication; verify its exact
   release/source binding. Old source/runtime receipts cannot be reused.
5. Only after both publication gates, bring the intended Windows checkout to
   the exact published commit and verify its tree, launcher/source hashes,
   pinned key, trust data, and runtime binding. No changed launcher may be
   exercised on Windows before these gates, including native synthetic fixture
   execution; arrange fixture validation after publication on a disposable
   Windows target before touching an enrolled host.
6. Obtain separate authorization for an enrolled-host retry. Re-run only
   `Initialize-HolaCoordinatorRuntime` with the existing endpoint and durable
   state; verify runtime without creating a session. No manual credential or
   request-file deletion, invented key, policy bypass, or `Invoke-HolaCoordinator`.

If validation changes any source bytes, or reconciliation changes the commit,
repeat fresh exact-source and runtime gates before any subsequent Windows
execution. Publication does not equal policy approval, implementation
approval, native test proof, enrolled-host retry permission, or session
creation permission.
