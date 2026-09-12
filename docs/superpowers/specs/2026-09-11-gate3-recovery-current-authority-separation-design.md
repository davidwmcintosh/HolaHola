# Gate 3 Recovery Provenance and Current Authority Separation

**Date:** September 11, 2026  
**Status:** Approved for implementation  
**Scope:** Correct one impossible authority coupling in the task-1448 assignment/window producer

## Observed failure

After the assignment/window producer was published:

1. A fresh Phase A attempt created a new task-1448 founder challenge for the
   unchanged approved Antigravity bundle.
2. The founder approved that challenge, creating a fresh active receipt.
3. Phase B returned `replayed`, as expected, because the previously recovered
   bootstrap registration already matched the unchanged bundle.
4. The trusted assignment/window producer failed closed with
   `gate3_assignment_window_recovery_lineage_missing`.

The failed producer transaction created no assignment, runtime inbox item,
frozen window, or success audit. It did not read or consume the Windows
bootstrap.

## Root cause

The producer currently requires the latest successful
`runtime_bootstrap_recovered` audit to name the same receipt and challenge
presented for the new assignment.

That equality cannot hold in the approved continuation:

- the recovery audit is historical evidence from the earlier bootstrap state
  transition;
- the new receipt and challenge are fresh, time-bounded founder authority for
  the current assignment;
- a compatible Phase B replay does not perform another recovery and therefore
  must not write another recovery audit.

The existing check incorrectly treats historical recovery provenance and
current assignment authority as one record.

## Decision

Treat recovery provenance and current founder authority as orthogonal,
simultaneously required proofs.

### Historical recovery proof

The producer continues to require the latest successful
`runtime_bootstrap_recovered` audit for the fixed runtime. It must prove:

- the approved bundle digest;
- a string old-bootstrap digest;
- a string new-bootstrap digest;
- a recovery lineage of `audited_consumption` or
  `legacy_issued_credential`;
- the new-bootstrap digest equals the current runtime registration bootstrap
  hash.

The historical audit's receipt and challenge IDs remain preserved as audit
context, but they are not required to equal the current assignment receipt and
challenge.

### Current authority proof

Independently, the producer continues to require the supplied current receipt
and its challenge to prove:

- active, unrevoked receipt status;
- approved, unexpired challenge status;
- more than ten minutes thirty seconds of receipt life;
- exact task `1448`;
- exact `luca-gemini` actor binding;
- exact artifact digest;
- exact public key and key fingerprint;
- exact approved bundle-context digest.

All existing runtime, profile, live-credential, live-grant, packet-history,
idempotency, canonical-event, projection, window, and corruption checks remain
unchanged.

## Rejected alternatives

### Write another recovery audit during Phase B replay

Rejected. A compatible replay performs no bootstrap transition. Recording it as
`runtime_bootstrap_recovered` would make the audit trail false and permit
unbounded duplicate recovery records for an unchanged registration.

### Reuse the historical recovery receipt

Rejected. The historical receipt may be expired or revoked, and reusing it
would defeat the explicit fresh-founder-authority requirement for the bounded
Windows execution.

## Implementation boundary

The production change is limited to removing the current receipt/challenge ID
equality from the historical recovery-lineage predicate.

No schema, route, Phase A behavior, Phase B mutation behavior, runtime
credential behavior, public bundle, Windows launcher, task artifact, or task
1449 behavior changes.

## Verification

The disposable PostgreSQL suite must add a regression proving:

1. Recovery is recorded under receipt A/challenge A.
2. A distinct fresh receipt B/challenge B is approved for the same exact
   task, actor, artifact, key, fingerprint, and bundle.
3. Phase B's compatible state is represented without another recovery.
4. The producer accepts receipt B and atomically creates the assignment,
   canonical projection, and frozen window.

Existing cases must continue proving that creation fails closed for:

- missing recovery;
- wrong bundle digest;
- malformed recovery digests;
- invalid recovery lineage;
- recovered-bootstrap/current-registration drift;
- missing, expired, revoked, mismatched, or insufficient-life current
  authority;
- live credentials or grants;
- packet history;
- partial or corrupt attempts;
- canonical/runtime divergence;
- rollback and concurrency boundaries.

TypeScript, `git diff --check`, the fresh disposable PostgreSQL suite, system
health, and the registered Validation suite must pass. The final implementation
requires unconditional Alden Anthropic, Alden Gemini, and independent
architecture approval before commit and republish.

## Operational continuation

The current receipt is not preserved across implementation and publication.
After the corrected producer is committed and republished:

1. Create a new Phase A attempt for the unchanged public bundle.
2. Obtain fresh founder approval.
3. Require Phase B status `replayed`.
4. Run the corrected trusted assignment/window producer with a new assignment
   attempt UUID.
5. Only after successful atomic creation, verify Windows readiness and continue
   the exact bounded task-1448 run.

Task 1449 remains cancelled.