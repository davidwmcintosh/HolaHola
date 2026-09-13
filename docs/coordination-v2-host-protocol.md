# Coordinator V2 host protocol

## Operator path

From the approved Windows worktree, after policy approval, operator grant, host
enrollment, and local credential preparation:

```powershell
Invoke-HolaCoordinator -TaskRef <task reference>
```

The operator does not initialize a session manually and does not supply
preparation, session, attempt, lease, claim, operation, receipt, digest,
provider, path, command, or credential identifiers.

## Host role

The Windows host is a transport and fixed-action executor. It:

1. validates Windows, PowerShell 5.1, the approved worktree, Node/tsx paths,
   script paths, local ACLs, and reparse-point restrictions;
2. decrypts the local credential only in memory with DPAPI `CurrentUser`;
3. asks the server for opaque preparation or execution work;
4. validates protocol version, kind, size, time, digest, and binding;
5. claims work under the exact enrolled host, transport lease, lease epoch, and
   holder instance;
6. runs only the fixed approved child role;
7. returns a bound result and safe diagnostics;
8. journals uncertain local effects and reconciles before any retry;
9. attempts cleanup after every terminal result.

It cannot choose provider, model, adapter, retry, fallback, policy, tool, path,
command, or budget. Server state is intentionally opaque.

## Envelope binding

Protocol envelopes bind:

- protocol version and message kind;
- policy version;
- session;
- enrolled host;
- transport lease;
- lease epoch;
- holder instance;
- operation;
- attempt and operation digest where applicable;
- issued and expiry times.

Unknown versions, kinds, fields, oversized payloads, unsafe diagnostics,
expired/future-skewed messages, digest mismatches, and binding mismatches fail
closed.

A newer lease epoch supersedes older authority. A stale holder, claim, or
result cannot mutate the active generation.

## Enrollment and compatibility

Enrollment records the host's declared operating system, PowerShell/runtime
capabilities, adapter/protocol support, and approved execution boundary.
Compatibility is checked by the server before work is offered and again by the
host before execution.

Repository, Git commit, worktree, host, lease, holder, provider, model, and
adapter provenance are evidence for one Luca execution lineage. Host or
provider changes do not create a different Luca.

## Local execution and uncertain effects

The host journal is written before and after a fixed child action. If the
process restarts after an effect may have occurred but before acknowledgement,
the host must reconcile the authoritative operation. It must not replay the
child merely because the acknowledgement was lost.

Complete request retries reuse the same request key and envelope so the server
can converge idempotently. Individual database mutations are never retried by
the host.

Unrecognized child output is projected as `host_child_unclassified_exit` with
only the executable role and a bounded signed 32-bit exit status. Raw stderr
belongs in restricted evidence, never in an operator-safe diagnostic.

## Terminal and cleanup behavior

The host exit mapping is:

| Outcome | Exit |
| --- | ---: |
| `succeeded` with cleanup acknowledged | `0` |
| `failed`, `exhausted`, `expired`, `revoked` | `1` |
| `cleanup_pending` | `75` |
| `preflight_failed` | `78` |
| `host_unavailable` | `69` |
| `invalid_request` | `64` |

Cleanup failure never rewrites the original terminal result. A successful
session without cleanup acknowledgement is exposed as `cleanup_pending`, not
as exit `0`.

## Stable protocol diagnostics

Protocol validation uses:

`HOST_PROTOCOL_UNKNOWN_VERSION`, `HOST_PROTOCOL_UNKNOWN_KIND`,
`HOST_PROTOCOL_EXTRA_FIELDS`, `HOST_PROTOCOL_MISSING_FIELD`,
`HOST_PROTOCOL_INVALID_FIELD`, `HOST_PROTOCOL_BYTES_EXCEEDED`,
`HOST_PROTOCOL_DIGEST_MISMATCH`, `HOST_PROTOCOL_EXPIRED`,
`HOST_PROTOCOL_FUTURE_SKEW`, `HOST_PROTOCOL_BINDING_MISMATCH`,
`HOST_PROTOCOL_UNSAFE_DIAGNOSTICS`,
`HOST_ENROLLMENT_INVALID_DECLARATION`, `HOST_ENROLLMENT_INCOMPATIBLE`,
`HOST_OPERATION_INVALID_ENVELOPE`, `HOST_OPERATION_BINDING_MISMATCH`,
`HOST_OPERATION_NOT_AUTHORIZED`, and `host_child_unclassified_exit`.

See [Coordinator V2 stable diagnostics](coordination-v2-error-codes.md) for the
full catalog and retry classifications.

## Windows custody limitation

The protected credential and fixed local paths are scoped to the Windows user
who prepared them. Another Windows user cannot use that DPAPI ciphertext.
Malicious software already running as the same user remains inside this trust
boundary. Linux tests verify source and protocol behavior but cannot prove that
DPAPI, Windows ACLs, or PowerShell 5.1 behaved correctly on a real host.

## Historical evidence boundary

Old Gate 3 bootstrap ciphertext, receipts, challenges, claims, windows,
digests, grants, and acceptance logs are retained only as historical evidence.
They cannot be transferred into a V2 envelope or used to authorize a V2 host
operation. Real-Windows authority is created fresh only after the reviewed
implementation is promoted and production is verified.
