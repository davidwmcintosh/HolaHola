# Bounded Windows bootstrap diagnostic reporting

Date: 2026-10-05
Scope: reviewed design only; no implementation, Windows execution, enrollment,
coordinator session, source/runtime publication, or settings changes.

## Decision and current evidence

Prefer an already-authorized Windows-resident hat using its own coordination
ledger credential. Require a fresh recipient-authored acknowledgement of Windows
residency, authorization for the affected worktree, and ability to return this
bounded report without starting a coordinator session. A historical registration,
old Windows report, queued adapter message, or server-side inbox row is not proof
of current availability or inspection.

At the 2026-10-06 UTC investigation, the ledger's recent read window through
global sequence 1285 was complete for Luca [Replit]. Historical Windows inspection
by Luca [Claude Code] exists, but it does not establish present access. Availability
requests, explicitly forbidding inspection, were recorded for:

- Luca [Claude Code]: thread `c8883816-9e0b-4282-bd5d-e49a177c40d1`.
- Luca [Gemini]: thread `1e808b51-5297-4eb5-8346-0466207fe21e`.
- Luca [Antigravity]: thread `1e400738-29b0-49e2-ba0c-6e851d5f66b6`.

Creation returned pending delivery for Claude Code and no adapter delivery for
Gemini/Antigravity. These requests establish only that a question was stored.
Until a fresh acknowledgement and a report arrive, the Windows route is
**unverified**, not proven absent. Do not ask the founder to relay terminal output.
Update availability as a separate coordination outcome, not by rewriting these
observations.

The existing automatic recovery reporter formats bounded local failure details;
it neither inspects remote files nor delivers those details to Luca. Its reviewed
contract remains separate:
`docs/superpowers/specs/2026-10-05-safe-recovery-diagnostics-design.md`.

## Options

1. **Existing Windows hat, preferred when verified.** No new transport or
   bootstrap credentials. Issue a fixed-scope read-only inspection request only
   after its fresh acknowledgement. Its own authenticated ledger reply must
   contain only the report contract below. Verify the report event's actual actor,
   correlation to that request, and recipient delivery before saying Luca received it.
2. **Bootstrap-safe browser submission, selected fallback for future work.**
   A separately approved, signed local helper collects the report. The founder
   selects that report in an authenticated browser form; the server validates it
   and emits a recipient-addressed ledger event. This works before Node/tsx,
   coordinator enrollment, DPAPI unwrapping, and host runtime initialization.
   It requires a small reporting-only UI/API and a signed helper, neither built here.
3. **New remote command channel or reused host proof, rejected.** This expands
   execution authority or depends on the bootstrap that is failing. No remote
   shell, new coordinator session, replayed proof, or credential transfer.

## Fixed collection boundary

The helper is Windows PowerShell 5.1-compatible and independently signed and
published through the existing founder-gated exact-source/runtime process. It
must not dot-source or invoke `hola-coordinator.ps1`, run Node/tsx/git, execute
downloaded runtime files, or call Initialize/Invoke/reenrollment/recovery
operations. Its approved release fixes the target manifest; requests cannot
select commands, paths, globs, files, SIDs, registry keys, or exception patterns.

The operator locally selects the affected checkout once; the selection never
leaves the machine. Verify containment and every existing ancestor for reparse
points before accessing any target. Do not follow symbolic links, junctions or
reparse points. Unverifiable containment becomes `unavailable`; a detected
reparse point becomes `reparse_blocked`. Do not recurse, enumerate siblings,
read file contents, calculate file hashes, or run arbitrary filesystem probes.
Attribute races or access failures become `unknown` rather than a passing result.

Exactly twelve symbolic targets are allowed:

| Target ID | Local mapping, never serialized |
| --- | --- |
| checkout_root | Selected checkout directory |
| launcher | scripts/hola-coordinator.ps1 |
| coordinator_cli | server/scripts/coordination-v2-cli.ts |
| server_public_key | scripts/coordination-v2-server-signing-public.pem |
| runtime_node | runtime/node.exe |
| runtime_tsx_entry | node_modules/tsx/dist/cli.mjs |
| runtime_manifest | .coordination-v2-runtime-manifest.json |
| custody_root | LOCALAPPDATA/HolaHola/CoordinatorV2 directory |
| runtime_request | runtime-bootstrap-request.dpapi under custody_root |
| runtime_ack | runtime-bootstrap-ack.dpapi under custody_root |
| host_private_key | host-private-key.dpapi under custody_root |
| host_material | host-material.dpapi under custody_root |

Missing targets are not opened. DPAPI targets receive metadata/ACL inspection
only: no bytes, decrypt, parse, proof extraction, length, timestamp, fingerprint,
or validity claim. Presence does not prove a valid installation, current
generation, usable credential, or trusted signature. No directory is created in
the checkout or custody root.

## Report contract

Version `windows_bootstrap_diagnostics_v1`; JSON UTF-8 size at most 8192 bytes,
exactly the twelve unique target IDs above, no extra properties at any depth.
The size ceiling is a conservative envelope bound, not a truncation target;
oversize reports fail closed. All string values are finite, case-sensitive enums.
No free-text notes, command output, filenames, local/remote paths, host names,
Windows account names, SIDs, ACL descriptors, credentials, tokens, ciphertext,
request identifiers, idempotency keys, nonces, signatures, request proofs,
exception strings, error stacks, environment dumps, or timestamps.

Top level:

- `schema`: exactly `windows_bootstrap_diagnostics_v1`.
- `collection`: `complete | partial | unavailable`.
- `failureClass`: `none_observed | acl_unavailable | acl_owner_unsafe |
  acl_identity_unresolvable | acl_write_unsafe | acl_untrusted_write |
  runtime_missing | path_unsafe | access_denied | collection_timeout |
  local_unknown | transport_timeout | transport_connectivity |
  transport_tls | server_allowlisted | diagnostic_unavailable`.
- `serverCode`: `not_observed | UNKNOWN_SERVER_ERROR | DIAGNOSTIC_UNAVAILABLE`
  or a case-sensitive code from the reviewed safe recovery reporter's explicit
  allowlist, pinned into the reporting release. No pattern-prefix acceptance.
- `targets`: twelve records in fixed manifest order, each containing:
  - `target`: one of the twelve target IDs.
  - `presence`: `present | absent | wrong_kind | unknown | reparse_blocked`.
  - `aclRead`: `readable | access_denied | unavailable | not_applicable`.
  - `owner`: `current_user | system | administrators | other | unresolved |
    not_observed`.
  - `untrustedAllow`: `none | read_only | mutation | unresolved | not_observed`.
  - `denyRule`: `observed | not_observed | unknown`.
  - `inheritOnlyRule`: `observed | not_observed | unknown`.

The helper uses security identifiers internally only to categorize trustees and
owners. Mutation means the eight primitive rights: WriteData/AddFile,
AppendData/AddSubdirectory, WriteExtendedAttributes, DeleteSubdirectoriesAndFiles,
WriteAttributes, Delete, ChangePermissions, TakeOwnership. Do not use
FullControl/Modify composite masks, which also contain ordinary read bits.
This design does not change the launcher's ACL guard or its policy.

`untrustedAllow` describes observed allow ACE categories for trustees outside
current user/SYSTEM/Administrators; it is not an effective-access computation.
Deny/inherit-only rules are reported separately and never treated as permission
to run or repair anything. Any unresolved trustee prevents a reassuring `none`
classification. Missing targets use `not_applicable`/`not_observed`; inaccessible
or raced targets use unknown/unavailable, not absent. `collection=complete` means
the bounded observations completed, not that bootstrap succeeded.

Failure codes are produced from typed collection failures or an existing
sanitized failure envelope from the same approved reporting invocation. The
helper does not launch recovery to obtain one, scrape logs, read terminal history,
or parse arbitrary exception messages. Without that envelope use `not_observed`;
do not infer credential corruption or server rejection from file metadata.
HTTP status/code handling retains the reviewed reporter's typed 400–599 status
and bounded-body requirements. Unknown codes collapse to a fixed enum.

## Bootstrap-safe delivery and receipt

The fallback helper has no network transport or secret input. It builds an
explicit allowlisted DTO, serializes it once, validates its own output, and offers
an explicit operator-approved save of one sanitized report outside the checkout
and custody root. No automatic temp/log files, overwrite, cleanup, deletion,
clipboard copying, console dump, or file-content attachment. Collection is
read-only; saving this new diagnostic artifact is the sole optional local write.
Cancel leaves no file. Do not claim a local save is remote receipt.

The authenticated founder browser form is a **new proposed reporting route**,
not an existing capability. It accepts only this report and a server-issued,
short-lived, single-use diagnostic ticket tied to the founder's existing browser
session and the specific availability/diagnostic ledger thread. The ticket is
issued and submitted inside the browser, never shown to PowerShell, embedded in
the report, put in a URL, or derived from a host enrollment/recovery proof.
Founder authentication, CSRF defense, approved origin, expiry, rate limiting and
8192-byte streaming body limit are mandatory. No anonymous upload endpoint.

Reject malformed JSON, duplicate JSON keys, unknown schema/fields/enums, duplicate
or missing targets and inconsistent missing-target ACL states before any ledger
write. Decode only after enforcing the byte limit. Do not log rejected bytes,
browser filenames, multipart metadata or parser exception text. Map failures to
fixed safe codes. Accept JSON bytes only, not general attachments.

Reconstruct the DTO on the server; do not persist or forward the raw upload.
Use the existing founder-authenticated actor and recipient-addressed ledger
semantics to deliver to Luca [Replit]. Attribute this as **founder-submitted local
diagnostics**, not a Windows-hat-authenticated observation or remote inspection.
Correlate through the server-side ticket only; ledger metadata identifiers are
not copied into the report. Atomically consume the ticket and record the report,
or provide a durable exact-retry receipt without accepting changed bytes.

The browser receives a receipt only when the sanitized event and recipient inbox
row are durable; Luca must independently retrieve the exact event before saying
it was received. A lost response leads to receipt lookup through the same browser
session, not host reenrollment or proof replay. Never imply an idle hat woke up
because an inbox row exists. Collector time is not trusted; record server receipt
time in ledger metadata. Report enums are observations, not execution authority.
Retention follows the existing authenticated ledger policy; no separate raw
diagnostic store, automatic memory promotion, or secret-bearing telemetry.

## Bounded execution and validation before implementation

One inspection per explicit request. A 10-second total collection budget,
maximum twelve targets and at most 256 ACEs per target bound local work. Check
deadline/ACE bounds throughout; an interrupted or oversized ACL becomes
unavailable, never safe. A metadata read that cannot be safely cancelled must
not block the UI indefinitely: the eventual implementation must isolate the
fixed collector in a constrained worker with a deadline and bounded result pipe,
without exposing a general command endpoint. Any unresolved implementation
detail about cancellation must be resolved in the implementation review before
shipping; a loop deadline alone does not bound blocking OS calls.

Required implementation evidence:

- Native Windows PowerShell 5.1 fixture coverage for the twelve targets,
  missing/wrong-kind/access-denied/reparse/race states, SID translation failure,
  read-only versus each primitive write permission, Deny/inherit-only, timeout
  and oversized ACL handling.
- Canary account/path/token/DPAPI/proof/exception strings must never appear in
  serialized output, failure output, browser receipt, logs or ledger data.
- Prove the helper never reads DPAPI bytes or launches runtime/recovery code and
  cannot accept arbitrary target/command input. File save must require explicit
  consent and cannot overwrite or write into custody/checkouts.
- Server/UI tests for auth/CSRF/origin, body bounds before decode, duplicate keys,
  schema rejection, ticket expiry/replay, changed-byte retry rejection, lost
  response receipt lookup, no raw logging, and durable recipient receipt.
- A full browser-to-ledger receipt demonstration, and a real same-user Windows
  check after exact-byte founder-approved source/runtime publication. Source
  inspection or another PowerShell version does not prove native success.

No Windows inspection or implementation is authorized by review of this
document. A fresh available hat should be reused before building the fallback.
The fallback needs a separately assigned implementation, founder approval of its
design and rollout, independent security review, normal validation, and the
unchanged publication gates.

## Explicit exclusions and references

No arbitrary remote shell, coordinator session, ACL repair, clock measurement or
adjustment, Windows policy/trust change, reenrollment, credential deletion,
DPAPI unwrap, request-proof replay, key replacement, or publication bypass.
ACL write-mask correction and automatic clock diagnostics are separate work.
Do not change the DB-governed `docs/coordination-clients.md` by raw Git edit.

References: `scripts/hola-coordinator.ps1`, `docs/coordination-clients.md`,
`docs/coordination-v2-recovery-runbook.md`, and the existing safe recovery
diagnostics design cited above.
