# Gate 3 Same-Runtime Bootstrap Recovery

## Context

The bounded Windows Gate 3 launcher stores one bootstrap with DPAPI `CurrentUser`.
Its `run` action consumes that bootstrap before attempting coordinator work and
removes the local credential state whether the child succeeds or fails. This is
intentional: uncertain credential state must never be retried.

The first genuine run exchanged the bootstrap successfully and obtained a valid
ownership proof. The proof grant inherited an approved challenge with only about
three minutes remaining, while the bounded driver requires at least ten minutes
and thirty seconds. The driver correctly stopped before creating a runtime
packet, and the launcher correctly removed the local bootstrap.

A fresh Windows bootstrap and fresh founder-approved public bundle could not be
registered because the fixed runtime ID still named the consumed bootstrap
digest. Existing runtime rotation requires a distinct replacement runtime ID,
but Gate 3 binds execution to the fixed runtime
`luca-gemini-antigravity-primary`.

## Goal

Allow a founder-approved fresh bootstrap to recover the same fixed Gate 3
runtime after a fail-closed local consumption, without weakening one-time
consumption, changing Luca's runtime identity, bypassing the canonical
coordinator, or granting execution while prior authority remains live.

## Non-goals

- Do not recover or reveal a consumed plaintext bootstrap.
- Do not permit a request-supplied runtime, actor, profile, task, artifact, or
  repository binding.
- Do not create a generation-suffixed runtime identity.
- Do not replace the general source-to-replacement runtime rotation protocol.
- Do not authorize recovery while a credential, grant, packet, interaction,
  consumption lease, or execution claim remains live.
- Do not change task 1448's Windows assignment, allowed file, test command,
  patch limit, time limit, no-commit rule, or independent-verification rule.
- Do not claim protection from malicious software running as the same Windows
  user.

## Chosen approach

Add a trusted, founder-authorized same-runtime bootstrap recovery path. It is
available only inside Antigravity Phase B and receives only the validated
public bootstrap SHA-256, never the plaintext bootstrap.

The bootstrap is credential custody state. Replacing its public digest after a
failed one-time run does not create a new actor or execution profile. The fixed
runtime ID and existing matching profile are preserved.

## Authorization order

Phase B must acquire the relevant transaction locks and validate the fresh
founder challenge and receipt before it attempts registration or recovery.
Validation covers:

- challenge state and expiry;
- receipt state, expiry, and revocation;
- task reference;
- actor and intended actor;
- artifact SHA-256;
- public key and key fingerprint;
- complete public-bundle context digest.

No registration or bootstrap mutation may occur before this validation passes.

## Recovery preconditions

Recovery is allowed only when all of the following are true under one
transaction:

1. The fixed registration exists, is enabled, and is not revoked.
2. Registration actor, display name, capabilities, and token TTL match the
   public bundle exactly.
3. The existing active profile matches provider, model, adapter version,
   runtime capabilities, repository label, worktree label, normalized worktree
   digest, branch, and starting commit exactly.
4. The new bootstrap digest is lowercase SHA-256 and is not assigned to another
   runtime.
5. No unexpired, non-revoked broker credential exists for the runtime.
6. No unexpired ownership grant exists for the runtime and profile.
7. No unresolved runtime packet, unconsumed interaction authority, active
   consumption lease, or execution claim exists for the runtime.
8. The current stored bootstrap digest differs from the new approved digest.

An exact replay of an already-installed digest remains the existing idempotent
replay path. Any metadata mismatch remains a conflict.

## Locking and atomicity

The transaction acquires PostgreSQL advisory locks for:

- the fixed runtime ID;
- the current bootstrap digest;
- the proposed bootstrap digest.

It locks the registration, profile, founder challenge, and receipt rows before
evaluating recovery preconditions. Authority checks and the bootstrap update
occur in the same transaction. A failed check or concurrent state change rolls
back the entire operation.

## Atomic effect

Successful recovery:

- replaces only the registration's bootstrap digest and the registration
  timestamps needed to represent the new one-time bootstrap;
- preserves runtime ID, actor, capabilities, token TTL, and execution profile;
- leaves prior expired credentials and grants immutable;
- records a durable successful recovery audit containing the old and new public
  digests, challenge ID, receipt ID, bundle digest, and recovery reason;
- returns explicit provisioning status `recovered`.

The audit must not contain plaintext bootstrap material, access tokens, local
credential paths, environment values, or receipts containing secrets.

The first successful server-side bootstrap exchange is also one-time. Under
the same runtime and digest advisory locks, it atomically replaces the approved
public bootstrap digest with a deterministic consumed tombstone derived from
the runtime ID and approved digest before issuing the broker credential. It
records a `runtime_bootstrap_consumed` audit event containing only the approved
digest and consumed tombstone. Concurrent exchanges therefore have exactly one
winner. Phase B recognizes that exact tombstone as an idempotent replay of the
already-consumed bundle without restoring exchange authority.

Recovery normally requires the current tombstone to match the latest durable
consumption audit. The one pre-tombstone Gate 3 registration has a bounded
compatibility path: an exact matching registration and profile, historical
issued credential, no prior same-runtime recovery, no live credential or grant,
and no packet history. Its recovery audit is explicitly labeled
`legacy_issued_credential`; all later recoveries use audited tombstone lineage.

## Failure behavior

Recovery fails closed with a stable non-secret reason for:

- missing, expired, revoked, or mismatched founder authority;
- live credential or grant;
- active or unresolved runtime work;
- revoked or disabled registration;
- registration or profile metadata mismatch;
- bootstrap digest reuse by another runtime;
- concurrent recovery loss.

The Windows bootstrap remains locally present after a Phase B failure because
the launcher has not run. The operator may diagnose the public failure and
retry Phase B only when the same approved transaction is provably idempotent.

## Tests

Focused tests must cover:

1. Recovery succeeds after the prior credential expires and no packet was
   created.
2. Recovery preserves the runtime ID and existing profile ID.
3. A recovered bootstrap exchanges exactly once.
4. Missing, expired, revoked, or mismatched founder approval is rejected before
   registration mutation.
5. Live credentials and live grants each block recovery.
6. Unresolved packet, interaction authority, consumption lease, and execution
   claim each block recovery.
7. Registration and profile metadata mismatches block recovery.
8. Disabled or revoked registration blocks recovery.
9. A digest assigned to another runtime blocks recovery.
10. Concurrent recoveries have one winner and one fail-closed or compatible
    replay outcome without mixed state.
11. Existing first-registration and same-digest replay behavior remains
    unchanged.
12. Phase B reports `created`, `replayed`, or `recovered` accurately.

The focused broker and Antigravity provisioning tests run before the project
typecheck and system-health validation. Existing Gate 3 tests must remain
green.

## Operational continuation

After the recovery implementation is reviewed and deployed:

1. Create a new founder challenge because the challenge used to discover this
   defect may expire during implementation.
2. Approve the exact new public-bundle bindings.
3. Run Phase B and require status `recovered`.
4. Create a fresh task 1448 assignment event and frozen runtime inbox window.
5. Confirm Windows is `READY`, the worktree is clean, and `HEAD` is the approved
   starting commit.
6. Run the fixed launcher exactly once with enough founder-grant lease
   remaining.
7. Do not claim task execution until packet, consumption, diff, focused-test,
   claim, and cleanup evidence exists.
8. Require independent cross-hat verification before claiming Gate 3 complete.

## Implementation verification — September 11, 2026

The final implementation confines bootstrap replacement to founder-validated
Antigravity Phase B. Generic broker registration has no recovery authority.
Runtime and source/destination digest locks use a consistent order, exact
registration and active-profile metadata are preserved, receipt context is
bound to the complete bundle digest, and any packet history blocks recovery.
Because interactions and claims require packets and executions require claims,
the packet-history guard strictly subsumes all downstream work-authority state.

A fresh disposable PostgreSQL database passed all four focused credential
broker/provisioning tests with zero skips. Coverage includes live credential
and grant rejection, immutable packet-history rejection, unconsumed-state
rejection, tombstone ownership collision, old-digest audit lineage, disabled
replay rejection, and concurrent exactly-once exchange. TypeScript and system
health passed. Alden's Anthropic and Gemini reviewers and the independent
architecture reviewer all returned unconditional approval.