# Expired bootstrap recovery — implementation contract

## Authority and scope

Implements the approved policy in
`docs/superpowers/specs/2026-10-05-runtime-expired-bootstrap-recovery-design.md`.
Founder policy approval and its independent design review are recorded in
`2026-10-05-runtime-expired-bootstrap-recovery-approval.md`. The founder
subsequently authorized implementation in the main Replit window.

This document settles the implementation schema and crash contract. It does
not authorize publication, Windows execution, enrolled-host retry, credential
changes, or coordinator sessions. Implementation review is separate from
design approval; consultation alone is not a durable review decision.

## Evidence and custody

The new intake is consistency-only. It checks the complete existing shape
with `AllowExpired`, positive bounded lifetime, future-issued ceiling, exact
host/request binding, canonical payload digest, pinned public-key fingerprint,
and canonical base64 encoding of a 64-byte signature. It never describes this
as Ed25519 verification. Only a validated unchanged expiry at/before UTC
classifies a response as expired.

The request digest is SHA-256 of the canonical JSON **string** containing the
exact persisted request key, matching the existing server's `digest(key)`.
The former client check used raw UTF-8 and could not match the server. The
client now uses the server's existing convention; no protocol, schema, stored
request key, timestamp, signature, or historical record changes.

Recovery files are DPAPI CurrentUser JSON beneath the private bootstrap root.
Names are fixed prefixes plus the canonical request-key digest:

- Decision: `runtime-bootstrap-recovery-<digest>.dpapi`.
- Second-expiry observation: `runtime-bootstrap-expired-<digest>.dpapi`.
- Temporary files have a fresh GUID suffix and `.tmp`; they are never read
  as committed decisions.

Both schemas have exactly these properties:

| Property | Contract |
| --- | --- |
| `version` | `1` |
| `label` | Literal `unverified_expired_evidence` |
| `endpoint` | Exact active host endpoint |
| `oldRequestKey` | Exact old client UUID |
| `oldRequestDigest` | Canonical-string SHA-256 of that UUID |
| `originalEnvelope` | Entire original response, including issue ID, payload, millisecond strings, nonce, canonical digest, signature and key fingerprint |
| `installed` | Boolean copied from the validated pending state |
| `installedBaseline` | Null when false; complete independently proved installed envelope when true |
| `successorRequestKey` | One distinct client GUID for a decision; empty string for an observation |

Outer serialization may change whitespace/order, never canonical payload
values or signature strings. Canonical digest equality is checked after
DPAPI encrypt/decrypt round-trip and after journal reread. The canonicalizer
accepts null explicitly, since request state and first-install journals
contain nulls. Records are retained; no evidence pruning occurs.

Writes prove containment, private parent/path ACLs, and no reparse points,
use create-new temporary files and `Flush(true)`, and commit on the same
volume with non-replacing `File.Move` for create-once records or atomic
`File.Replace` for existing active state. Existing records are reused only
after exact full-record canonical equality, retaining their successor.

## Resume and bounded issuance

Before existing pending-issue handling, scan committed decision files.
Validate their schema, endpoint, host/request/evidence binding, and filename.
Match directly on exact old request key, or in reverse on exact successor.
More than one reverse parent fails `runtime_recovery_ambiguous`; corrupt,
conflicting or cross-endpoint records stop before issuance or cleanup.

A direct match completes the recorded active-key transition and counts as
this invocation's one rotation. A reverse match resumes that already active
key without spending another rotation. Saved successor issue evidence binds
to its active key/issue/host before old-stage cleanup.

The active transition writes the recorded key, empty issue ID, null manifest,
and cleared pending acknowledgement payload/signature durably before cleanup
or POST. It preserves host material, private key, persisted ack, and installed
manifest. Only the exact old stage may be removed, and only for an
uninstalled old generation. Cleanup failure stops; the successor remains
durable and reverse lookup retries cleanup.

There are at most two issue attempts in the newly added response path and at
most one key transition per invocation, including the existing saved-issue
branches. A second expired response gets a create-once observation with no
successor and stops `runtime_recovery_rotation_limit`. A later invocation may
create that generation's decision only against the same retained observation.
Transport failure never creates another key merely because issue ID is empty.

## Crash matrix

| Boundary | Durable evidence / restart |
| --- | --- |
| Before decision commit | Active old key is unchanged; temporary bytes grant no authority |
| Decision committed, old active | Direct lookup reuses its one successor and atomically commits active state |
| Successor active, before cleanup/POST | Reverse lookup rechecks cleanup and posts the exact active key |
| Server commits, response lost | Same-key replay; one successor issue, not renewal of the original |
| Successor issue saved | Validate saved binding, then existing install/ack path |
| State/journal mismatch or failed durable write | Stop; no issuance, stage cleanup or additional transition |
| Second expired response | Retain observation without successor; bounded stop |

An installed baseline is loaded separately from the installed manifest and
proved using the existing full-generation verifier with `AllowExpired`.
It is retained inline and independently re-proved after an empty-state resume.
Fresh equivalence, changed-generation staged installation, full signature,
Authenticode, artifact/source/membership, exact checkout, freshness and ack
checks remain unchanged. An expired response never supplies executable bytes.

## Verification and release stops

Local evidence:

- Actual-source structural and mutation tests are registered in the CI registry.
  They exercise removal of intake/bindings, create-once, persisted successor,
  rotation limit, installed proof, null handling and fresh signature/expiry.
- Linux PowerShell parser validates launcher and native helper fixture syntax.
  This is syntax evidence only, not Windows execution or DPAPI/ACL proof.
- The disposable real-PostgreSQL service test now creates/replays one distinct
  successor, verifies its signature/lifetime/count, checks historical rows are
  unchanged, and rechecks expired artifact/ack refusal. It never targets the
  shared application database.
- Typecheck passed before documentation-only work.

The Linux-only experimental pure-function run stalled in cmdlet loading and
was removed rather than reported as a pass or kept as hanging CI. Parser,
source checks and actual disposable service tests provide the local evidence.

The authored native helper fixture is deliberately partial: actual DPAPI
round-trip/create-once/resume, orphan temporary files, second-expiry observation,
binding/digest/signature-format/interval rejection, missing installed baseline,
and synthetic credential/ack preservation. It refuses ungated execution,
requires native PowerShell 5.1 and the exact clean published source, isolates
all state in a new temporary root, and uses only synthetic values.

**No native fixture has run.** The complete initializer/install/signature/
equivalence/ACL/reparse/crash-fault/mutex/diagnostic matrix remains in the
existing native verification task, not represented as covered by the partial
helper fixture or Linux checks.

Before any Windows execution, including synthetic native fixtures: fresh exact
reviewed source/application publication and fresh matching runtime publication
are founder-only gates. Reconciliation or later source edits invalidate
earlier exact-source receipts. Then validate on a disposable Windows target.
An enrolled-host retry requires separate authorization; initialization never
creates a coordinator session. No publication or Windows operation occurred.