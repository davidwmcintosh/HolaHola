# Coordinator V2 stable diagnostics

## Operator path and outcome

Start the lifecycle with:

```powershell
Invoke-HolaCoordinator -TaskRef <task reference>
```

Do not pass internal identifiers. Founder policy approval and the operator
launch are separate authorities. The command's safe outcome uses the catalog
below; exit `0` requires `succeeded` plus acknowledged cleanup.

The safe CLI states are `preparing`, `ready`, `running`, `waiting_for_host`,
`verifying`, `succeeded`, `failed`, `exhausted`, `expired`, `revoked`,
`cleanup_pending`, `preflight_failed`, `host_unavailable`, and
`invalid_request`.

The server's failure classifications are `resume_transport`,
`fresh_attempt_same_provider`, `fresh_attempt_next_provider`,
`terminal_failure`, and `cleanup_repair`. Completion is not a failure
classification.

The diagnostics projection does not change the existing Coordinator V2 HTTP
error contract. Existing routes may continue to return
the historical `{ error: { code } }` response.  Internal/operator diagnostics
can resolve that code with
`server/services/coordination-error-catalog.ts`.

## Contract

Every entry has:

- `phase`: the lifecycle authority that owns the failure;
- `retryClassification`: a bounded retry decision (`do_not_retry`,
  `retry_with_backoff`, `retry_after_reconciliation`,
  `operator_action_required`, or `repair_required`);
- `safeMessage`: a fixed operator-safe sentence, never an exception message,
  command, path, provider-native response, or stderr;
- `evidenceReferenceType`: the kind of durable evidence that may be linked;
  the reference itself is supplied by the evidence subsystem; and
- `provenance`: an optional allow-listed set of bounded identifiers and
  counters.  Unknown fields, control characters, secret-shaped keys/values,
  stderr, and oversized values are discarded.

`host_child_unclassified_exit` is the stable replacement for an unstructured
child result (for example, `child_exit_1`).  It may carry only the executable
role and bounded exit status as provenance.  Raw stderr remains evidence under
the host evidence policy and is not copied into a safe message or provenance.

`cleanup_required` means the original terminal outcome remains authoritative
while one or more terminal cleanup obligations still need repair.  It is not a
replacement for the original success/failure result.

Catalog codes preserve their source spelling. Service and authorization codes
are uppercase. Canonicalizer, registry, `cleanup_required`, and
`host_child_unclassified_exit` codes are lowercase. Consumers must compare the
exact catalog value rather than normalizing case.

## Cataloged codes

The following is the complete catalog.  The source module is authoritative;
this list is intentionally grouped by service family so code review can
compare it directly with the service error unions.

### Session

`SESSION_INVALID_REQUEST`, `SESSION_NOT_FOUND`, `SESSION_CONFLICT`,
`SESSION_POLICY_NOT_APPROVED`, `SESSION_POLICY_REVOKED`,
`SESSION_GRANT_NOT_FOUND`, `SESSION_GRANT_INVALID`, `SESSION_HOST_NOT_FOUND`,
`SESSION_HOST_INACTIVE`, `SESSION_PROVIDER_NOT_ALLOWED`,
`SESSION_DATABASE_UNAVAILABLE`, `SESSION_TRANSITION_REJECTED`,
`SESSION_REQUEST_REPLAY_CONFLICT`, `SESSION_RETRYABLE_DATABASE_CONFLICT`

### Attempt

`ATTEMPT_INVALID_REQUEST`, `ATTEMPT_NOT_FOUND`, `ATTEMPT_SESSION_NOT_FOUND`,
`ATTEMPT_SESSION_TERMINAL`, `ATTEMPT_PROVIDER_NOT_ALLOWED`,
`ATTEMPT_BUDGET_EXHAUSTED`, `ATTEMPT_PREVIOUS_INVALID`,
`ATTEMPT_TRANSITION_REJECTED`, `ATTEMPT_REQUEST_REPLAY_CONFLICT`,
`ATTEMPT_DATABASE_UNAVAILABLE`, `ATTEMPT_RETRYABLE_DATABASE_CONFLICT`

### Cleanup

`CLEANUP_INVALID_REQUEST`, `CLEANUP_NOT_FOUND`, `CLEANUP_SESSION_NOT_FOUND`,
`CLEANUP_REPLAY_CONFLICT`, `CLEANUP_TRANSITION_REJECTED`,
`CLEANUP_RECEIPTS_EXHAUSTED`, `CLEANUP_DATABASE_UNAVAILABLE`,
`cleanup_required`

### Lifecycle and authorization

`LIFECYCLE_INVALID_REQUEST`, `LIFECYCLE_TASK_UNSUPPORTED`,
`LIFECYCLE_POLICY_UNAVAILABLE`, `LIFECYCLE_HOST_UNAVAILABLE`,
`LIFECYCLE_PROVIDER_UNAVAILABLE`, `LIFECYCLE_DATABASE_UNAVAILABLE`,
`LIFECYCLE_TRANSITION_REJECTED`, `LIFECYCLE_SESSION_NOT_FOUND`,
`LIFECYCLE_ACTOR_MISMATCH`, `LIFECYCLE_GRANT_INVALID`,
`LIFECYCLE_POLICY_INVALID`, `LIFECYCLE_HOST_INVALID`,
`LIFECYCLE_SESSION_EXPIRED`, `LIFECYCLE_ACTION_DENIED`,
`COORDINATION_INVALID_COMMAND`, `COORDINATION_DATABASE_UNAVAILABLE`

Session status projection errors are cataloged as lifecycle diagnostics:
`STATUS_INVALID_REQUEST`, `STATUS_NOT_FOUND`, `STATUS_NOT_AUTHORIZED`,
`STATUS_DATABASE_UNAVAILABLE`

### Transport lease

`LEASE_INVALID_REQUEST`, `LEASE_NOT_FOUND`, `LEASE_CONFLICT`,
`LEASE_STALE_EPOCH`, `LEASE_EXPIRED`, `LEASE_HOST_MISMATCH`,
`LEASE_HOLDER_MISMATCH`, `LEASE_AUTHORIZATION_DENIED`,
`LEASE_SESSION_TERMINAL`, `LEASE_REPLAY_CONFLICT`,
`LEASE_RECONCILIATION_LIMIT`, `LEASE_DATABASE_UNAVAILABLE`

### Host protocol and operation

`HOST_PROTOCOL_UNKNOWN_VERSION`, `HOST_PROTOCOL_UNKNOWN_KIND`,
`HOST_PROTOCOL_EXTRA_FIELDS`, `HOST_PROTOCOL_MISSING_FIELD`,
`HOST_PROTOCOL_INVALID_FIELD`, `HOST_PROTOCOL_BYTES_EXCEEDED`,
`HOST_PROTOCOL_DIGEST_MISMATCH`, `HOST_PROTOCOL_EXPIRED`,
`HOST_PROTOCOL_FUTURE_SKEW`, `HOST_PROTOCOL_BINDING_MISMATCH`,
`HOST_PROTOCOL_UNSAFE_DIAGNOSTICS`, `HOST_ENROLLMENT_INVALID_DECLARATION`,
`HOST_ENROLLMENT_INCOMPATIBLE`, `HOST_OPERATION_INVALID_ENVELOPE`,
`HOST_OPERATION_BINDING_MISMATCH`, `HOST_OPERATION_NOT_AUTHORIZED`,
`host_child_unclassified_exit`

### Host custody and authentication

`V2_HOST_FOUNDER_REQUIRED`, `V2_HOST_INVALID_REQUEST`,
`V2_HOST_ENROLLMENT_NOT_FOUND`, `V2_HOST_ENROLLMENT_REVOKED`,
`V2_HOST_REQUEST_NOT_FOUND`, `V2_HOST_REQUEST_EXPIRED`,
`V2_HOST_REQUEST_TERMINAL`, `V2_HOST_CHALLENGE_INVALID`,
`V2_HOST_CHALLENGE_EXPIRED`, `V2_HOST_PROOF_INVALID`,
`V2_HOST_CREDENTIAL_INVALID`,
`V2_HOST_CREDENTIAL_EXPIRED`, `V2_HOST_CREDENTIAL_REVOKED`,
`V2_HOST_CREDENTIAL_SCOPE_DENIED`, `V2_HOST_PROTOCOL_MISMATCH`,
`V2_HOST_IDEMPOTENCY_CONFLICT`, `V2_HOST_DATABASE_UNAVAILABLE`,
`V2_HOST_CREDENTIAL_REQUIRED`

### Preparation and task metadata

`PREPARATION_INVALID_REQUEST`, `PREPARATION_NOT_FOUND`,
`PREPARATION_CONFLICT`, `PREPARATION_REPLAY_CONFLICT`,
`PREPARATION_AUTHORIZATION_DENIED`, `PREPARATION_EXPIRED`,
`PREPARATION_INVALID_TRANSITION`, `PREPARATION_DATABASE_UNAVAILABLE`,
`TASK_METADATA_INVALID_REQUEST`, `TASK_METADATA_UNSUPPORTED`

### Policy and grants

`POLICY_INVALID`, `POLICY_NOT_FOUND`, `POLICY_VERSION_NOT_FOUND`,
`POLICY_IDENTITY_REVOKED`, `POLICY_ALREADY_APPROVED`,
`POLICY_ALREADY_REJECTED`, `POLICY_ALREADY_REVOKED`, `POLICY_NOT_DRAFT`,
`POLICY_NOT_APPROVED`, `FOUNDER_REQUIRED`, `FOUNDER_DECISION_REQUIRED`,
`IDEMPOTENCY_CONFLICT`, `OPERATOR_REQUIRED`, `OPERATOR_GRANT_NOT_FOUND`,
`OPERATOR_GRANT_EXPIRED`, `OPERATOR_GRANT_REVOKED`,
`OPERATOR_GRANT_SCOPE_DENIED`, `OPERATOR_GRANT_ACTION_DENIED`,
`OPERATOR_GRANT_POLICY_DENIED`, `OPERATOR_GRANT_ALREADY_REVOKED`,
`OPERATOR_GRANT_INVALID`, `POLICY_DATABASE_UNAVAILABLE`

The policy canonicalizer's stable validation codes are also cataloged:

`policy_not_object`, `policy_unknown_field`, `policy_secret_field`,
`policy_invalid_string`, `policy_invalid_array`, `policy_invalid_map`,
`policy_invalid_provider_order`, `policy_invalid_tool`, `policy_invalid_path`,
`policy_invalid_command`, `policy_invalid_duration`, `policy_invalid_budget`,
`policy_provider_budget_mismatch`

### Provider registry

`duplicate_registration`, `invalid_descriptor`, `unknown_descriptor`,
`policy_disallowed_provider`, `policy_disallowed_model`,
`policy_disallowed_adapter_version`

## Compatibility and evidence boundary

Catalog lookup is additive and does not alter route status selection or any
public code.  A diagnostic is safe to display by default.  Evidence references
are typed pointers only; they do not inline evidence contents.  In particular,
raw host stderr is never accepted as a catalog message or provenance value.
Evidence retention and cleanup are independent: cleanup may be retried while
session events and evidence counts remain durable.

Internal IDs may appear only as bounded, allow-listed provenance or typed
evidence references. They are inspectable but never transferable into another
launch or host. Provider and host provenance describe one Luca execution
lineage, not separate identities.

The current Windows credential uses DPAPI `CurrentUser` and is limited to the
same Windows user who prepared it. Historical Gate 3 errors and evidence remain
non-authorizing for Coordinator V2.
