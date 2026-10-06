# Safe enrollment diagnostics — reporting-only extension

## Approval and scope

The founder approved this reporting-only design and authorized work in the primary checkout on October 5, 2026. Independent shared-spec approval is required before implementation.

This extends the approved safe-recovery-diagnostics design to enrollment. The earlier decision to leave enrollment unchanged describes that earlier scope, not the scope of this extension.

## Contract

Replace the raw Get-HolaCoordinatorTransportFailureDetail implementation with an enrollment-specific allowlisted reporter. Keep all three enrollment call sites and their enrollment_transport failure code. Reuse the bounded recovery extraction mechanics through a private metadata helper with an explicit Enrollment/Recovery selector; retain the recovery wrapper and recovery allowlist unchanged. Never reflect exception messages, response text, arbitrary identifiers, URLs, secrets, key material or signatures.

Accept only typed HTTP statuses 400–599 (HttpStatusCode, Int32, Int64). Without a valid HTTP status, classify only typed WebException timeout, connectivity and TLS statuses; otherwise return TRANSPORT_UNKNOWN. With a valid HTTP status, parse at most 4096 UTF-16 characters, read legacy streams no farther than 4097 characters, and never parse oversized bodies. Accept only an object envelope with object error and string code found in a case-sensitive ordinal enrollment allowlist. Unknown or malformed data returns UNKNOWN_SERVER_ERROR; oversized data returns RESPONSE_TOO_LARGE; capture failures return DIAGNOSTIC_UNAVAILABLE.

Enrollment reason allowlist: V2_HOST_BOOTSTRAP_REQUIRED, V2_HOST_BOOTSTRAP_DENIED, V2_HOST_BOOTSTRAP_UNAVAILABLE, V2_HOST_BOOTSTRAP_CONSUMED, V2_HOST_FOUNDER_REQUIRED, V2_HOST_IDEMPOTENCY_CONFLICT, V2_HOST_REQUEST_NOT_FOUND, V2_HOST_REQUEST_EXPIRED, V2_HOST_REQUEST_TERMINAL, V2_HOST_CHALLENGE_INVALID, V2_HOST_CHALLENGE_EXPIRED, V2_HOST_PROOF_INVALID, V2_HOST_INVALID_REQUEST, V2_HOST_PROTOCOL_MISMATCH, V2_HOST_SOURCE_PROMOTION_REQUIRED and V2_HOST_DATABASE_UNAVAILABLE.

Each group has fixed enrollment-specific guidance: preserve local files and exact persisted requests; ask the founder about bootstrap, approval, conflicts, request/challenge status or version mismatch. Ambiguous transport outcomes require founder inspection before retry; guidance must not authorize proof replay, new requests, key replacement or bootstrap reissue. TLS guidance prohibits certificate/trust bypass.

## Alternatives

Raw-text redaction is rejected because unrecognized secrets remain disclosable. Three separate extraction implementations are rejected because bounds and legacy stream handling would drift. An explicit private selector plus separate ordinal guidance maps keeps the two public reporting contracts independent without duplicating extraction.

## Invariants and prohibited actions

No changes to enrollment declarations, bootstrap/founder gates, request persistence, signed bytes, exact retries, credentials, counters, sessions, authority or policy. No probes, credential erasure, key rotation, runtime/session initialization, Windows policy/trust changes, source/runtime publication or live-device actions.

## Verification and limits

Extend the synthetic diagnostics fixture to test all allowlisted enrollment reasons, unknown/case-mismatched/recovery-only codes, malformed envelopes/JSON/HTML, sentinel-bearing bodies/exceptions, typed/invalid statuses and transport exceptions, oversized direct/legacy-stream input, empty/failed streams, and the enrollment_transport failure prefix. Keep existing recovery tests. Update static guards for all three enrollment sites and shared bounded extraction. Keep diagnostics reached by the existing Windows CI fixture. Run local fixtures if a suitable PowerShell runtime is available, focused Node static checks, typecheck and system-health verification.

Synthetic legacy stream coverage is not native Windows PowerShell 5.1 success. Native verification requires its separately authorized Windows path after exact-byte founder-gated GitHub-to-Render source/runtime publication. No publication or Windows CI dispatch is authorized here.