# Automatic safe recovery diagnostics

Date: 2026-10-05
Scope: founder-approved automatic recovery-only reporting; local preparation, not publication or native rollout.

## Design

Replace the four recovery HTTP diagnostic call sites with a read-only error-context formatter. Keep enrollment reporting unchanged. Emit only bounded HTTP status, a case-sensitive allowlisted reason and fixed guidance. Never reflect raw response/exception text, arbitrary codes, URLs, request IDs/keys, nonce, fingerprint, signatures, tokens or decrypted/key contents.

A structured error.code is accepted only alongside a typed HTTP failure status (400–599), as an allowlisted V2_HOST code. Parse at most 4096 UTF-16 characters. Legacy Windows response-stream fallback reads no more than 4097 characters; an oversized body is never parsed. Unknown/malformed envelopes yield UNKNOWN_SERVER_ERROR; capture failure yields DIAGNOSTIC_UNAVAILABLE. Typed WebException metadata may distinguish timeout, connectivity and TLS failure without using exception text.

A public recovery wrapper calls the unchanged internal lifecycle. Known local failure codes receive fixed guidance. Existing bounded HTTP details are accepted only when they exactly match a recomputed allowlisted report. Unexpected local exceptions become host_recovery_failed with fixed guidance; raw CLR/PowerShell text is never rethrown. Parameter binding and script-loading policy errors occur outside this wrapper and are not claimed to be handled. Success/status return shapes, founder approval, signed request bytes, generation handling and DPAPI writes remain unchanged.

Guidance never authorizes a new request, proof replay, deletion, key replacement or policy bypass. Pending/conflicting requests and stale generations direct the operator to the founder while preserving files. Ambiguous transport results direct the operator to the existing recovery flow, never manual proof replay. TLS guidance prohibits trust/certificate bypass.

## Verification plan and limits

Add synthetic secret-sentinel cases covering recognized/unknown/case-mismatched and malformed codes, malformed JSON/HTML, oversized bodies, legacy response streams, stream capture failure, invalid HTTP metadata, typed transport exceptions, preservation of known local/HTTP codes and sanitized unexpected local failures. Wire the diagnostics script through the existing Windows reauthorization CI entry point. Preserve the lifecycle fixture and exact retry checks; adjust its deliberate injected-crash expectation to the new sanitized local failure code. Source guards prove every recovery HTTP site uses the reporter and enrollment still uses its existing helper. Run focused Node checks, typecheck, system-health verification and diff checks.

Real Windows PowerShell 5.1 execution remains required and must not be inferred from source checks or another PowerShell version. No actual Windows commands, live credential/host operations, publication, Windows policy/trust changes, sessions or runtime initialization are part of this preparation. Enrollment's legacy raw diagnostic helper remains out of scope. Changes require fresh exact-byte founder-gated shared GitHub-to-Render source/runtime publication before native rollout.
