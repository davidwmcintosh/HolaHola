# Coordinator V2 recovery runbook

## First action

Run the same operator command:

```powershell
Invoke-HolaCoordinator -TaskRef <task reference>
```

Do not repair a run by copying a session, attempt, lease, claim, challenge,
receipt, digest, provider request, or host-operation identifier into a command.
The CLI rejects internal identifiers. Recovery starts from the task reference
and optional approved policy selector; the server reconciles durable state.

## Read the safe outcome

The command reports one of:

`preparing`, `ready`, `running`, `waiting_for_host`, `verifying`, `succeeded`,
`failed`, `exhausted`, `expired`, `revoked`, `cleanup_pending`,
`preflight_failed`, `host_unavailable`, or `invalid_request`.

Use the stable diagnostic code, phase, retry classification, safe message, and
typed evidence reference. Do not use raw stderr or provider text as an authority
decision.

## Recovery classification

### `resume_transport`

Use when delivery was interrupted but the logical attempt remains valid.
Reconciliation must prove the current attempt, operation, lease generation, and
holder. The server may issue a new transport lease epoch while preserving the
attempt ID, ordinal, and provider ordinal.

Never reopen a terminal attempt.

### `fresh_attempt_same_provider`

Use when the prior attempt ended retryably and policy budget allows another
attempt with the same provider. The server creates a fresh attempt and
authority generation. Nothing from the prior attempt is manually transferred.

### `fresh_attempt_next_provider`

Use when policy allows fallback and the next provider in approved order is
available. The server creates a fresh attempt with immutable provider, model,
and adapter provenance. The host does not select the fallback.

### `terminal_failure`

No more logical attempts may be created. Preserve the session, attempts,
events, evidence references, host journal, and diagnostics. A new operator
launch does not convert those records into authority.

### `cleanup_repair`

The original terminal success or failure remains authoritative. Retry only the
pending cleanup obligations. Cleanup acknowledgement is required before a
successful command may exit `0`.

## Common recovery cases

### Preparation response lost

Retry the complete preparation request with the same idempotency key only when
it is the exact same generation and payload. The server returns the durable
result if promotion already committed. A different payload requires a fresh
idempotency key and generation.

No session, attempt, or lease exists before preparation acknowledgement.

### Host disconnect or restart

The durable transport lease, epoch, holder, and operation determine recovery;
process-local timers do not. After lease expiry, an authorized host may take
over with a higher epoch. Stale renewals and stale results are rejected.

### Child effect may have happened

Read the host execution journal and reconcile the authoritative operation. Do
not rerun the child merely because the response was lost. If the effect cannot
be classified safely, fail closed as `host_unavailable` and retain evidence.

### Provider response lost

Reconcile the current attempt and provider request. Resume transport only if the
attempt remains nonterminal. Otherwise create a fresh policy-authorized attempt
or stop according to the recorded classification and budget.

### Cleanup failed

The cleanup record moves to `repair_required` with classification
`cleanup_repair`. Return it to `pending` through the cleanup service and retry.
Never rewrite or delete the original terminal result or immutable evidence.

### Policy, grant, or host revoked

Stop new authority immediately. Follow server transitions for any active work
and cleanup. Do not substitute an older policy, grant, host receipt, or Gate 3
artifact.

## Evidence checklist

Before declaring recovery complete, verify durable evidence for:

- founder-approved policy version and active operator grant;
- task and immutable preparation generation;
- session and every logical attempt;
- provider, model, and adapter version;
- enrolled host, lease ID, epoch, and holder;
- repository, worktree, and exact Git commit;
- operation claims, bound results, and uncertain-effect reconciliation;
- terminal outcome;
- cleanup acknowledgement and authority revocation.

Identifiers in this evidence are inspectable, not transferable.

## Windows limitation

DPAPI uses `CurrentUser`. Recovery requiring the local protected credential must
run as the same Windows user who prepared it. This does not protect against
malicious software already running as that user. If local custody cannot be
proved, stop with `preflight_failed` or `host_unavailable`; do not move the
ciphertext or recreate authority from historical evidence.

## Historical Gate 3 boundary

Gate 3 receipts, windows, challenges, claims, digests, bootstrap exchanges, and
test logs remain historical evidence only. They cannot authorize recovery,
transport resume, fallback, cleanup, or real-Windows acceptance under V2.
