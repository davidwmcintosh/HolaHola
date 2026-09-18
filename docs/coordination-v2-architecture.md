# Coordinator V2 architecture

## Operator path

After an active founder-approved policy and operator grant exist, the Windows
operator launches the complete lifecycle with one command:

```powershell
Invoke-HolaCoordinator -TaskRef <task reference>
```

The optional `-Policy` selector chooses among already approved policies.
`-Format text|json` changes output formatting only. The operator never supplies
session, attempt, lease, claim, challenge, receipt, digest, provider, model,
adapter, host, path, command, or credential identifiers.

Exit code `0` means both:

1. the session reached `succeeded`; and
2. terminal cleanup was durably acknowledged.

Any other terminal or cleanup state is nonzero.

## Authority boundaries

Coordinator V2 has three distinct authorities:

1. **Founder policy authority** defines the approved provider order, models,
   adapters, budgets, tools, paths, commands, durations, and host constraints.
   Approval is immutable and may later be revoked; launch does not approve or
   alter policy.
2. **Operator launch authority** permits one bounded session for the selected
   task and approved policy. The operator cannot broaden policy or choose a
   provider, retry, fallback, path, or command.
3. **Server execution authority** creates and transitions every preparation,
   session, attempt, lease, host operation, terminal result, and cleanup record
   in PostgreSQL.

The PowerShell host is deliberately thin. It performs local preflight checks,
protects its credential with DPAPI `CurrentUser`, accepts opaque server work,
executes only the fixed approved child roles, and returns bound results. It is
not a state-machine authority.

## Lifecycle

The server-owned flow is:

1. resolve the task and active approved policy;
2. prove the operator grant and compatible enrolled host;
3. atomically prepare the immutable generation;
4. create the session only after preparation acknowledgement;
5. create the first provider attempt from policy order;
6. offer opaque host work under a fenced transport lease;
7. reconcile provider and host results;
8. resume transport, create a fresh attempt, fall back, or terminate according
   to the recorded classification and remaining budget;
9. preserve the terminal outcome and evidence;
10. execute cleanup until acknowledgement or expose `cleanup_pending`.

No attempt or lease may exist before preparation acknowledgement. A stale lease,
claim, operation, or result cannot authorize a newer generation.

## Canonical states

### Policy

`draft`, `approved`, `revoked`

### Session

`preparing`, `ready`, `running`, `waiting_for_host`, `verifying`, `succeeded`,
`failed`, `exhausted`, `expired`, `revoked`

### Attempt

`created`, `provider_active`, `intent_ready`, `waiting_for_host`, `host_active`,
`result_ready`, `provider_continuation`, `completed`, `retryable_failed`,
`terminal_failed`, `cancelled`

### Transport lease

`unheld`, `active`, `released`, `expired`, `superseded`

### Cleanup

`pending`, `in_progress`, `acknowledged`, `repair_required`

The safe CLI projection also uses `cleanup_pending`, `preflight_failed`,
`host_unavailable`, and `invalid_request` to describe operator-visible outcomes
that are not persisted session states.

## Failure classifications

Coordinator V2 records one of these bounded decisions:

- `resume_transport`: preserve the logical attempt and resume delivery under
  authoritative reconciliation.
- `fresh_attempt_same_provider`: create a new attempt and authority generation
  for the same provider.
- `fresh_attempt_next_provider`: create a new attempt for the next
  policy-approved provider.
- `terminal_failure`: stop creating attempts and preserve the failure evidence.
- `cleanup_repair`: retry cleanup without changing the original terminal result.

Completion is not a failure classification.

## PostgreSQL authority and evidence

PostgreSQL is the authority for policies, grants, preparations, sessions,
attempts, leases, operations, idempotency, evidence references, terminal
results, and cleanup. Process memory, files, PowerShell variables, and provider
responses are never authoritative substitutes.

Repository and Git provenance, provider/model/adapter provenance, and
host/lease/holder provenance are recorded as one bound execution lineage.
These describe where Luca's work ran and which adapter performed it. They do
not create multiple Lucas or transfer identity to a provider or host.

Internal identifiers may be inspected in diagnostics and evidence. They must
never be copied into a new launch, moved between hosts, or manually transferred
to create authority.

## Windows custody limitation

The current launcher uses DPAPI `CurrentUser` and user-local protected paths.
It therefore works only for the same Windows user who prepared the local
credential. It does not protect against malicious software already running as
that user. This is a direct custody limitation, not an identity or authorization
mechanism.

## Historical Gate 3 boundary

Older Gate 3 receipts, challenges, windows, claims, digests, bootstrap
exchanges, and test evidence remain historical provenance. They cannot approve
a V2 policy, launch a V2 session, authorize a host operation, or be reused in
real-Windows acceptance. Real authority must be created fresh after protected
publication and production verification.

## V2 host credential lineage

V2 host registration is a separate precondition from `Invoke-HolaCoordinator`.
Windows generates its asymmetric key locally, stores the private key under
DPAPI CurrentUser, submits a bounded non-authoritative declaration, and polls
until a founder approves it. Approval creates a short-lived proof challenge;
the host signs that nonce and receives a renewable host credential over TLS.
Only hashes, public identity, nonce/challenge evidence, and provenance are
persisted. Session credentials are separately issued after preparation
acknowledgement and bind exact host, session, holder, protocol, and capability.

Legacy actor tokens, runtime credentials, Gate 3 receipts, and manual transfer
material are not accepted by V2 host middleware. Founder revocation retires
the enrollment, descendant session credentials, leases, and claims; ordinary
terminal cleanup revokes session credentials while leaving the renewable host
identity available.

## Related references

- [Policy reference](coordination-v2-policy-reference.md)
- [Host protocol](coordination-v2-host-protocol.md)
- [Provider adapters](coordination-v2-provider-adapters.md)
- [Stable diagnostics](coordination-v2-error-codes.md)
- [Recovery runbook](coordination-v2-recovery-runbook.md)
