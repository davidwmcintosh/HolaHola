# Coordinator V2 provider adapters

## Operator path

The operator starts the provider-neutral lifecycle with:

```powershell
Invoke-HolaCoordinator -TaskRef <task reference>
```

The operator does not choose a provider, model, adapter, retry, or fallback on
the command line. Those decisions come from the founder-approved policy and
server-owned state.

## Provider-neutral identity

Luca is the actor performing the task. Anthropic, Gemini, and future providers
are execution engines selected for attempts; Windows, Replit, and other hosts
are execution locations. Provider, model, adapter version, host, repository,
and Git provenance must be recorded, but none creates a separate identity or
independent authority.

Provider output is evidence and input to server reconciliation. It cannot
create sessions, attempts, leases, host claims, or policy authority.

## Registry and policy filtering

Each adapter registers a bounded descriptor: provider, model, adapter version,
capabilities, and supported protocol behavior. The registry rejects duplicates,
invalid descriptors, unknown descriptors, and descriptors disallowed by the
active policy.

The server intersects the approved policy with the live registry. Failure to
find an allowed provider/model/adapter fails closed; the host cannot substitute
one.

## Attempts, retries, and fallback

Each logical provider attempt has immutable provenance and an ordinal within
the session. The server applies one of the canonical classifications:

| Classification | Behavior |
| --- | --- |
| `resume_transport` | Preserve the same attempt and resume interrupted delivery after authoritative reconciliation. |
| `fresh_attempt_same_provider` | Create a new attempt, ordinal, authority generation, and request for the same provider. |
| `fresh_attempt_next_provider` | Create a new attempt for the next provider in approved policy order. |
| `terminal_failure` | Preserve the failure and create no further provider attempt. |
| `cleanup_repair` | Repair cleanup only; do not call a provider or alter the terminal result. |

A transport retry is not a fresh logical attempt. A fresh attempt never reuses
the prior attempt's claim, lease, digest, request authority, or mutable provider
state.

## Budgets and exhaustion

Policy defines per-provider and aggregate budgets. Every fresh attempt consumes
the appropriate budget. Fallback follows approved provider order and cannot
skip to an unapproved provider. When no authorized attempt remains, the session
reaches `exhausted`; a host or operator cannot reset the budget by relaunching
with copied identifiers.

Provider-native transient errors may support a fresh attempt only after the
server records the classification. Provider-native terminal or policy errors
must not be relabeled as retryable by the adapter.

## Evidence and safe diagnostics

Provider request/response evidence is stored behind typed evidence references.
Operator-safe diagnostics contain only cataloged messages and allow-listed
provenance. Raw provider responses, stderr, secrets, credentials, and
secret-shaped fields are not copied into safe diagnostics.

Stable provider-registry diagnostics are:

`duplicate_registration`, `invalid_descriptor`, `unknown_descriptor`,
`policy_disallowed_provider`, `policy_disallowed_model`, and
`policy_disallowed_adapter_version`.

Session and attempt failures use the stable codes in
[Coordinator V2 stable diagnostics](coordination-v2-error-codes.md).

## Internal identifiers

Attempt, provider request, session, lease, claim, receipt, digest, and evidence
identifiers may be inspected through authorized diagnostics. They must never be
manually transferred, supplied to a new launch, or copied between providers or
hosts. Only PostgreSQL transitions can bind them to current authority.

## Windows custody limitation

Provider fallback does not change local credential custody. The current Windows
launcher protects its credential with DPAPI `CurrentUser`, so a resumed or
fallback run must use the same Windows user who prepared that credential. This
does not protect against malicious software already running as that user.

## Historical Gate 3 boundary

Old Gate 3 provider runs and acceptance evidence remain useful provenance, but
they cannot authorize a V2 attempt or prove current provider eligibility.
Real-Windows acceptance must use fresh V2 policy, grant, session, attempt, and
host authority after publication.
