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

### Windows credential recovery clock preflight

`Restore-HolaCoordinatorHostCredential -Endpoint <approved HTTPS endpoint>`
now runs a read-only clock preflight after validating the stored endpoint and
before decrypting the enrolled private key, retiring a draft, or persisting a
new request. To inspect only the clock (without reading DPAPI custody), use:

```powershell
Get-HolaCoordinatorClockPreflight -Endpoint <approved HTTPS endpoint>
```

Use the endpoint from the approved recovery setup, not a public NTP reference.
The check performs at most three unauthenticated HTTPS GETs to
`/api/coordination/v2/host/recovery-clock`. Each has a two-second total
response/read deadline, a 512-byte body cap, no redirects, ordinary TLS
verification, and no caching. A separate read-only Windows Time service query
has a one-second child-process deadline. Scheduling overhead can add time;
there are no retries beyond these three samples.

The report contains only `clock`, local-minus-server `offsetMs`,
`uncertaintyMs`, `validSamples`, `timeService`, and
`correctionCommand=not_run`. Positive offset means the Windows host is ahead.
No raw responses, exception text, machine names, keys, tokens, request bodies,
or identifiers are reported.

The threshold is **not** a general “acceptable Windows skew” constant.
The signed recovery context rejects `issuedAt > server now` (zero future
allowance) and `expiresAt <= server now`, with at most a two-minute lifetime.
The diagnostic endpoint publishes that same service-owned TTL. Each sample
uses midpoint local UTC minus server UTC, with uncertainty equal to half the
monotonic round-trip duration plus both local wall-clock quantization errors
(the Windows default 64-Hz cadence, 15.625 ms each), server millisecond
resolution, and observed wall/monotonic duration disagreement. Disagreement
greater than both local quantization errors makes the sample unknown.
Different TTLs or nonoverlapping sample intervals are unknown; classification
uses the conservative union of all three intervals, not just the best sample.

- `ahead`: the entire interval is greater than zero. Recovery stops with
  `host_recovery_clock_out_of_window` before custody changes.
- `behind`: the entire interval is at or below minus the context TTL.
  Recovery stops at the same boundary.
- `within_window`: all three intervals lie strictly above minus the TTL and
  at or below zero. This is a measurement, **not** proof of healthy ongoing
  synchronization or a guarantee the later signed request will pass.
- `unknown`: a missing, malformed, oversized, slow, inconsistent, or failed
  sample, or an interval overlapping a boundary. Unknown is explicitly
  advisory, never healthy; recovery retains its existing behavior and the
  server remains authoritative. An older server without the endpoint is
  unknown, not evidence of alignment.

`timeService=stopped` can coexist with a small measured offset. A running
service does not prove alignment. No resync is attempted; `not_run` is neither
success nor failure. If an operator separately runs a correction with founder
approval, record its outcome separately from independent offset measurements
and service status. Do not infer a successful correction from later recovery
acceptance.

The verified incident involved a host about 1.5 seconds ahead: declaration
validation failed during the signed recovery-context lookup **before a local
request existed**. Later independent alignment samples and successful recovery
with unchanged source did not prove why the offset disappeared. The resync
command reported failure and a stopped service. Do not dump decrypted requests,
clear DPAPI, reset generations, backdate declarations, or relax server checks
to diagnose this case. Ask the founder before any manual clock correction.

**Publication gate:** development tests are hermetic synthetic PowerShell
fixtures, not LITTLENEMO tests. Before any real-host testing, follow the exact
source/runtime sequence in the Windows compatibility design: commit/push exact
source, prepare/verify fresh source promotion, stop for founder source
publication, prepare/verify fresh runtime release, stop for founder runtime
publication, then fast-forward the host to that exact commit and verify its
tree. Never reuse a release for different bytes. Founder approval is also
required before completing a replacement-credential request. No real host,
credential, or session is changed by development validation.

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

### V2 host credential failure

An enrollment request expires and its proof challenge is single-use and
short-lived. On expiry, replay, or proof failure, do not retry a nonce or copy
a credential from another host. Founder revocation invalidates the enrollment,
all renewable host credentials, descendant session credentials, leases, and
claims. Register a fresh device key through the founder approval boundary;
legacy actor/runtime credentials and Gate 3 material are never a recovery path.

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

### Read-only clock preflight before Windows credential recovery

Before sending a signed recovery-context or reauthorization declaration, inspect
Windows time-service status and measure clock offset. For LITTLENEMO, the
following reference was reachable; elsewhere use an approved reachable NTP
reference rather than changing the configured time source:

```powershell
w32tm /query /status
w32tm /stripchart /computer:time.windows.com /samples:5 /dataonly
```

These commands do not adjust the clock or configure the time service.
Read both results independently: a stopped or unsynchronized service does not
prove the current clock offset, and a small measured offset does not prove
ongoing synchronization. A failed measurement is unknown, not a passing check.
For stripchart, a negative offset means the local clock is ahead of the reference.
HTTP Date headers alone are not a precise offset measurement.

The server rejects recovery declarations issued in its future. On October 5,
2026, LITTLENEMO received `V2_HOST_REAUTH_DECLARATION_INVALID` before any local
request was saved while independent NTP samples showed it about 1.5 seconds
ahead. The unchanged client and server accepted the retry after samples showed
the offset had disappeared. The attempted resync reported failure and a stopped
service; this does not establish what corrected the clock or that synchronization
will continue.

If a clock adjustment is needed, obtain explicit approval and keep any elevated
time-service work separate from the original recovery window. Do not automatically
resync, change time servers or service configuration, broaden timestamp acceptance,
clear DPAPI state, or re-enroll the host. Re-measure before one bounded retry, then
stop at the existing founder-approval boundary.

## Historical Gate 3 boundary

Gate 3 receipts, windows, challenges, claims, digests, bootstrap exchanges, and
test logs remain historical evidence only. They cannot authorize recovery,
transport resume, fallback, cleanup, or real-Windows acceptance under V2.
