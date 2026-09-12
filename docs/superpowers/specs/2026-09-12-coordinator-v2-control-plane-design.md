# Coordinator V2 control plane

## Status

Approved architecture. This document defines the design boundary for the
implementation plan. It does not authorize another Gate 3 generation or any
implementation work by itself.

## Problem

The portable coordinator has strong evidence, credential, founder-approval,
Git-binding, and bounded-execution primitives. Its Gate 3 operating model is
not reliable enough for continued use.

Several fresh Windows generations failed at different boundaries before a
verified completion. Each failure was safely contained, but ordinary provider
shape differences and cross-host representation differences consumed an
entire one-shot generation. The operator also had to move identifiers and
digests manually through initialization, preparation, founder approval,
provisioning, assignment, and execution. Failures surfaced through generic
child-process exits, and local preparation could leave stale ignored state
before a later step failed.

Patching each new provider or host failure does not produce a trustworthy
long-term workflow. The replacement must make the coordinator, not the
operator or Windows launcher, own the lifecycle.

## Goals

1. Give the operator one command for preparation, launch, resume, status, and
   terminal cleanup of a bounded task session.
2. Keep PostgreSQL as the canonical authority and immutable evidence store.
3. Keep GitHub snapshots and exact Git bindings as source provenance.
4. Preserve Luca's provider-neutral identity. Provider, model, adapter, and
   host labels are provenance only.
5. Keep founder trust authority while removing per-attempt approval ceremony.
6. Use a thin Windows host agent first without making the control plane
   Windows-specific.
7. Support policy-approved provider fallback without allowing providers to
   grant execution authority.
8. Resume transport failures without regenerating logical task authority.
9. Give every intentional retry a fresh attempt and fresh one-time authority.
10. Return structured, non-secret diagnostics at every failure boundary.
11. Retire failed or completed sessions automatically without deleting their
    evidence.
12. Require successful real-Windows end-to-end and interrupted-transport
    acceptance tests before production readiness.

## Non-goals

- Protecting against malicious software running as the same Windows user.
- Allowing a model to choose arbitrary paths, commands, tools, or policies.
- Reusing a failed generation's identifiers, credentials, receipts, claims,
  packets, windows, attempts, or other authority artifacts.
- Reinterpreting historical Gate 3 evidence as Coordinator V2 authority.
- Building a separate commercial service in the first implementation.
- Generalizing task 1448 by weakening its current execution constraints.
- Reactivating task 1449 or duplicating Alden-owned task 1450.
- Giving a provider, host process, or local file authority over PostgreSQL.

## Invariants

1. PostgreSQL owns policy, session, attempt, lease, and terminal state.
2. Local files and process memory are caches or secret-custody mechanisms, not
   workflow authority.
3. A founder-approved policy version is immutable.
4. A session is bound to exactly one policy version, task artifact digest,
   repository identity, starting commit, enrolled host, expiration, and
   attempt budget.
5. A session can have many attempts but at most one accepted completion.
6. An attempt's provider, model, adapter version, normalized input, output
   evidence, and terminal result never change after termination.
7. Only transport recovery may resume the same attempt.
8. A new provider call after a logical provider or tool-protocol failure uses
   a fresh attempt identifier and fresh one-time authority.
9. Provider output is untrusted intent until the server validates it against
   the session and policy.
10. Provider fallback is allowed only in the approved policy order and only
    for approved failure classes.
11. Host execution requires a current durable lease epoch. A stale process
    cannot regain authority from local state.
12. Idempotent replay may return a prior result but may not create a second
    logical transition.
13. Terminal cleanup revokes authority but never deletes canonical evidence.
14. Every operator-visible failure has a stable code, phase, classification,
    safe message, and evidence reference.
15. Raw provider arguments remain immutable evidence even when an adapter
    rejects or normalizes them.
16. Provider, model, adapter, runtime, and host labels describe provenance.
    They do not split Luca's identity or confer trust.

## Considered approaches

### Wrap the current Gate 3 sequence

Add one endpoint and one PowerShell command around the current initialize,
prepare, Phase A, founder approval, Phase B, assignment-window, and run
sequence.

This is rejected. It would automate the ceremony while retaining one-shot
generation authority, task-specific coupling, and the same product boundary.

### Add a Coordinator V2 control plane

Add versioned policy, bounded session, fresh attempt, and durable transport
lease concepts. Reuse the existing credential, evidence, packet, interaction,
claim, execution, completion, founder-decision, and Git-binding primitives.
Convert the current Windows and Antigravity components into adapters.

This is selected. It replaces the brittle lifecycle without discarding the
parts already proven to fail closed.

### Build a standalone coordinator product immediately

Create a separate service and migrate HolaHola to it as its first customer.

This is deferred. It creates premature authentication, database, deployment,
and operational duplication. Coordinator V2 should first prove the protocol
with a real Windows host and at least one additional host implementation.

## Architecture

### Control plane

The server owns:

- policy approval and versioning;
- operator authorization;
- host enrollment and capability records;
- bounded session creation;
- provider selection and fallback;
- attempt creation and termination;
- intent validation;
- durable transport and execution leases;
- retry classification;
- evidence persistence;
- completion acceptance;
- revocation and terminal cleanup.

The control plane exposes a versioned host protocol and a separate
provider-adapter interface. Neither interface may bypass the state machine.

### Trust policy

A trust policy is immutable after founder approval. A new policy definition or
any material change creates a new version and requires a new founder decision.

The policy contains:

- permitted host types and enrolled-host constraints;
- permitted tools, operations, paths, and command templates;
- provider fallback order;
- allowed provider, model, and adapter-version constraints;
- session duration;
- total attempt budget;
- optional per-provider attempt budget;
- transport lease and execution lease limits;
- retryable, fallback-eligible, and terminal failure classes;
- required validation commands;
- required completion evidence;
- credential capabilities and maximum lifetimes;
- cleanup requirements.

Policies contain references and bounded configuration, not credentials or
private key material.

### Founder and operator authority

The founder approves policy versions. An authorized operator may launch a
bounded session under an active approved policy.

The first HolaHola deployment may assign both roles to the same person. The
data model and authorization checks must keep the roles distinct so a future
organization can let owners define policy while operators run tasks.

A founder can revoke a policy. Revocation prevents new sessions immediately.
The policy states whether existing sessions terminate immediately or finish a
currently claimed non-mutating operation before termination. No policy may
allow a new mutating claim after revocation.

An operator can terminate a session but cannot expand its policy, task scope,
budgets, host binding, repository binding, or expiration.

### Bounded session

A session binds:

- policy version;
- operator;
- task reference and exact task artifact digest;
- repository identity;
- starting commit;
- enrolled host;
- requested provider order, which must be a subset of policy order;
- creation and expiration times;
- total and per-provider attempt budgets;
- required validation and completion criteria;
- current state and terminal reason.

Session states are:

- `preparing`
- `ready`
- `running`
- `waiting_for_host`
- `verifying`
- `succeeded`
- `failed`
- `exhausted`
- `expired`
- `revoked`

Only `succeeded`, `failed`, `exhausted`, `expired`, and `revoked` are terminal.
Every transition is transactional and appends an immutable transition event.

### Attempt

An attempt is one logical provider-driven effort within a session. It binds:

- a fresh attempt generation identifier;
- session identifier;
- provider, model, and adapter version;
- ordinal within the session and provider;
- creation time and deadline;
- one-time packet and execution authority lineage;
- current state;
- normalized failure classification or completion result.

Attempt states are:

- `created`
- `provider_active`
- `intent_ready`
- `waiting_for_host`
- `host_active`
- `result_ready`
- `provider_continuation`
- `completed`
- `retryable_failed`
- `terminal_failed`
- `cancelled`

An attempt that reaches a terminal state is never reopened. Transport recovery
renews or reacquires a lease for the same non-terminal attempt; it does not
create a second attempt.

### Provider adapter

A provider adapter:

- builds the provider request from canonical session and attempt data;
- declares its provider, model, and adapter version;
- validates native response framing;
- preserves raw arguments as immutable evidence;
- emits normalized operation intents;
- maps provider failures to stable internal classifications;
- reports token, turn, and response limits through bounded metadata.

An adapter does not validate policy, grant claims, execute tools, choose host
paths, or decide retries. Those decisions remain in the control plane.

The first adapter wraps the current Gemini/Antigravity behavior. Claude,
OpenAI, and future adapters implement the same interface without changing host
or authority services.

### Host protocol

The host protocol is independent of Windows and uses versioned request and
response envelopes.

The host may:

- enroll and report bounded capabilities;
- run read-only preflight;
- request or renew a transport lease;
- poll for authorized work;
- claim one authorized operation;
- renew the current execution claim;
- submit a structured result;
- acknowledge terminal cleanup;
- report safe diagnostics.

The host may not:

- create or approve policies;
- create sessions;
- choose a provider;
- classify retry policy;
- widen a tool or path boundary;
- construct its own execution authority;
- accept stale lease epochs;
- infer authority from a local file.

### Thin Windows host agent

The first host implementation uses native PowerShell 5.1 and DPAPI
`CurrentUser`.

It owns:

- local credential custody;
- signed launcher and runtime verification;
- Windows path and process handling;
- exact worktree and Git measurements;
- atomic generation staging;
- execution of server-authorized bounded operations;
- structured local results and cleanup acknowledgements.

It does not claim to resist malicious software running as the same Windows
user. Its guarantees are bounded authorization, provenance, controlled
execution, and fail-closed handling of observed drift.

## One-command operator experience

The long-term Windows entry point is `Invoke-HolaCoordinator`, with a required
task reference and optional policy selection. The command must perform the
following lifecycle:

1. Inspect local installation, DPAPI custody, worktree, Git, launcher, runtime,
   network, and server compatibility without mutation.
2. Return all safe preflight failures together.
3. Ask the server to create or resume the matching bounded session.
4. Stage any required new local generation atomically.
5. Enter the resumable host loop.
6. Display current session state and structured failure information.
7. On terminal state, revoke local active authority and clean staged material.
8. Exit successfully only after verified completion and cleanup
   acknowledgement.

No operator step copies a challenge, receipt, runtime, profile, packet,
attempt, window, claim, lease, digest, or credential.

## Atomic local preparation

Preflight is read-only. It may create only process-private ephemeral memory; it
may not create the next generation directory, change an active pointer, write
DPAPI material, or mutate the checkout.

After preflight succeeds:

1. The server transactionally reserves a session preparation generation.
2. Windows creates a fresh staging directory whose identifier comes from that
   reservation.
3. Windows writes generated public and DPAPI-protected material only inside
   the staging directory.
4. Windows validates the complete staged generation, including exact digests,
   signatures, version compatibility, repository binding, and permissions.
5. Windows atomically promotes the staging directory and active-generation
   pointer.
6. Windows acknowledges promotion to the server.
7. The server moves the session from `preparing` to `ready`.

Failure before promotion removes the staging directory and leaves active state
unchanged. Failure after promotion but before acknowledgement is recovered by
matching the exact server reservation and local generation identifier. It
must not create another generation.

Startup reports abandoned staging directories. It never silently adopts,
merges, or reuses them.

## Data flow

1. Founder approves a policy version.
2. Operator invokes the host command for a task.
3. Host completes read-only preflight.
4. Server atomically creates or resumes the bounded session.
5. Host completes atomic local preparation if needed.
6. Server creates a fresh attempt for the first approved provider.
7. Provider adapter emits a normalized operation intent or failure.
8. Server validates the intent against policy, task, repository, session, and
   current attempt state.
9. Server creates bounded one-time operation authority.
10. Host acquires the current durable claim and executes the operation.
11. Host submits a structured result and evidence digests.
12. Server persists the result before acknowledging it.
13. Provider adapter receives the canonical result for continuation.
14. The control plane continues the attempt, creates a fresh attempt, moves to
    the next provider, verifies completion, or terminates the session.
15. Terminal processing revokes authority and requests host cleanup.
16. Host acknowledges cleanup; cleanup failure remains a visible repair state
    without changing the terminal execution result.

## Failure taxonomy

Every failure record contains:

- stable error code;
- lifecycle phase;
- retry classification;
- safe operator message;
- canonical evidence reference;
- policy, session, attempt, provider, adapter, and host provenance when
  applicable;
- occurrence and transition timestamps.

It must not contain credentials, bootstrap values, private keys, signatures,
raw secret material, or unrestricted model/source content.

### Same-attempt transport recovery

The following may resume the same non-terminal attempt:

- network interruption;
- poll timeout;
- lost acknowledgement;
- server restart;
- host restart when the exact DPAPI generation and durable lease lineage match;
- duplicate request delivery;
- duplicate result delivery.

Recovery uses idempotency keys and durable lease epochs. It never repeats a
confirmed host mutation or confirmed provider continuation.

### Fresh attempt under the same session

The following may create a fresh attempt when policy and budgets allow:

- retryable provider outage;
- provider rate limit;
- malformed provider operation;
- provider tool-call framing rejected by the adapter;
- rejected provider continuation shape;
- provider turn or token limit;
- adapter-declared recoverable incompatibility.

The failed attempt remains immutable. Its packet, interaction, result, claim,
and receipt lineage are not reused.

### Provider fallback

The coordinator may move to the next policy-approved provider only when:

- the failure class is fallback-eligible;
- the provider appears later in the approved order;
- total and provider budgets permit another attempt;
- the session has not expired or been revoked;
- no host, artifact, repository, policy, credential, signature, or security
  invariant failed.

Every fallback transition records the prior provider, next provider, reason,
and source attempt. The provider change is visible in all completion
provenance.

### Terminal outcomes

The following failures terminate the session:

- policy violation;
- task artifact, repository, or Git digest mismatch;
- host identity, capability, launcher, runtime, or environment drift;
- invalid authorization, signature, or credential;
- lease ownership or epoch conflict that indicates competing authority;
- policy, session, or founder revocation;
- expiration;
- exhausted attempt budget;
- required validation failure when policy marks it terminal;
- completion evidence conflict;
- a second attempted completion after one completion was already accepted.

Successful completion also terminates the session because no later attempt may
acquire authority.

### Unclassified child exits

A generic child exit is never the final diagnostic. If a child process exits
without a valid structured result, the host reports
`host_child_unclassified_exit` with the lifecycle phase, executable role, exit
status, and bounded stderr classification. Raw stderr is retained only under
the existing evidence and secrecy policy; it is not printed automatically.

## Recovery and cleanup

- PostgreSQL state wins over host caches after every restart.
- Durable leases contain holder identity, epoch, issued time, expiry, and
  predecessor lineage.
- A lease transition uses compare-and-set semantics.
- Stale holders may submit evidence for reconciliation but cannot acquire new
  execution authority.
- Cleanup is idempotent and independently retryable.
- Terminal cleanup revokes session credentials, execution grants, leases, and
  active host generation authority.
- Cleanup does not delete policies, sessions, attempts, packets,
  interactions, tool results, claims, executions, completions, or audit
  events.
- A cleanup failure produces a visible `cleanup_required` condition attached
  to the terminal session. It does not change `succeeded` to `failed` or erase
  the original terminal reason.
- Status output identifies the canonical state, current lease holder, last
  transition, next permitted action, and blocking failure code.

## Persistence model

Implementation should prefer additive tables for:

- trust policies and immutable policy versions;
- founder policy decisions;
- operator policy grants;
- bounded sessions;
- session transition events;
- attempts and attempt transition events;
- durable transport leases;
- cleanup obligations and acknowledgements.

Existing runtime registrations, credentials, profiles, packets, interactions,
runtime receipts, claims, claim events, tool results, executions, completions,
task-ownership decisions, and coordination ledger records remain the canonical
evidence primitives where their existing contracts fit.

Historical rows are not backfilled into V2 sessions. V2 rows may reference
historical evidence for provenance, but historical evidence never authorizes a
V2 transition.

## Migration

### Phase 1: control-plane model

Add policy, session, attempt, transition, lease, and cleanup persistence with a
pure state-transition service. No Windows authority is created in this phase.

### Phase 2: adapter boundaries

Place existing Gemini/Antigravity provider behavior behind the provider
interface. Place existing PowerShell and Windows executor behavior behind the
host protocol. Preserve their current strict task-1448 boundaries.

### Phase 3: one-command Windows flow

Add read-only preflight, atomic preparation, session create-or-resume, durable
host loop, structured diagnostics, and automatic cleanup.

### Phase 4: real-Windows acceptance

Run a completely fresh Windows session from one command. Do not reuse any
prior Gate 3 identifier or authority artifact. Preserve all evidence whether
the run succeeds or fails.

### Phase 5: transport-resume acceptance

Run a fresh session in which transport is intentionally interrupted after
authority exists. Prove recovery uses the same valid attempt and lease lineage
without repeating confirmed mutation or regenerating logical task authority.

### Phase 6: old-flow retirement

Disable the manual Gate 3 operating path only after evidence parity, terminal
cleanup, and both real-Windows acceptance tests pass. Keep the old evidence
queryable.

### Phase 7: product extraction decision

After Windows and one additional host implementation pass the same protocol
suite, decide whether to extract the control plane into a separate service.
Extraction is not part of the initial implementation plan.

## Testing

### State machine

- Prove every allowed policy, session, attempt, lease, and cleanup transition.
- Reject every transition from terminal state.
- Prove at most one accepted completion per session.
- Prove budgets and expiration cannot be bypassed by replay or concurrency.

### Disposable PostgreSQL integration

- Run lifecycle tests only against a verified disposable database.
- Prove transaction rollback leaves no partial authority.
- Prove idempotent duplicate requests converge.
- Prove stale lease epochs cannot mutate current state.
- Prove terminal cleanup revokes authority while preserving evidence.

### Provider contracts

- Test Gemini, Claude, and OpenAI-shaped fixtures through the common adapter
  contract.
- Preserve raw arguments while rejecting malformed normalized intents.
- Test same-provider retry and policy-approved provider fallback.
- Prove policy and host services do not branch on provider-specific shapes.

### Host contracts

- Run the shared host protocol suite against the Windows adapter and a
  deterministic in-process fake host.
- Test read-only preflight aggregation.
- Test atomic staging, promotion, acknowledgement loss, restart recovery, and
  abandoned staging detection.
- Test PowerShell 5.1 and DPAPI `CurrentUser`.
- Prove no test claims same-user malware resistance.

### Fault injection

Interrupt:

- before and after session reservation;
- before and after local promotion;
- before and after attempt creation;
- before and after provider response persistence;
- before and after host claim acquisition;
- before and after host mutation;
- before and after result persistence;
- before and after provider continuation;
- before and after completion acceptance;
- during authority revocation and local cleanup.

For each boundary, prove whether the correct outcome is same-attempt resume,
fresh attempt, provider fallback, terminal failure, or cleanup repair.

### Real-Windows acceptance

Production readiness requires both:

1. A fresh one-command Windows session that reaches one verified completion
   and automatic cleanup.
2. A separate fresh session with an intentional transport interruption that
   resumes without new logical task authority, duplicate mutation, or manual
   identifier transfer.

Both tests must preserve PostgreSQL evidence, Git provenance, provider and host
provenance, and non-secret structured diagnostics.

## Security statements

The design protects server-side authority, binds execution to approved policy
and source provenance, limits host operations, and records observed execution.
DPAPI protects local material according to Windows `CurrentUser` semantics.

The design does not protect against malicious software running as the same
Windows user, a compromised operating system, or an authorized operator
deliberately acting outside the coordinator. Product and operator
documentation must state this limitation directly.

## Documentation and operational deliverables

Implementation must update:

- the coordinator architecture documentation;
- the Windows operator runbook;
- failure-code reference;
- policy-authoring reference;
- host-adapter contract;
- provider-adapter contract;
- recovery and cleanup runbook;
- Alden handoff and batch build record.

The operator runbook must begin with the one-command flow. Internal identifiers
may appear in diagnostic detail but never as values the operator must manually
transfer.

## Implementation-plan boundary

The implementation plan should decompose this design into ordered milestones:

1. persistence and pure state machine;
2. policy and operator authority;
3. provider-adapter contract;
4. host protocol and durable transport lease;
5. Windows preflight and atomic preparation;
6. one-command lifecycle;
7. structured diagnostics and cleanup;
8. fake-host and disposable-database proof;
9. real-Windows acceptance;
10. transport-resume acceptance;
11. old-flow retirement.

No milestone may create real Windows authority until its preceding
state-machine, database, adapter, and cleanup proofs pass.