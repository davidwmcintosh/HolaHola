# Antigravity Generation-Specific Runtime Design

## Status

Approved in conversation on September 11, 2026. This specification must receive
user review before implementation.

## Problem

Gate 3 task 1448 previously used the stable runtime registration ID
`luca-gemini-antigravity-primary`. The first Windows execution consumed its
bootstrap authority and left an immutable packet tied to that runtime and its
active profile. A later, founder-approved provisioning bundle correctly failed
closed:

- its promoted starting commit differed from the old active profile; and
- recovery under the same runtime ID was barred because packet history exists.

The packet cannot be assumed spent. Packet existence without a consumed receipt
and terminal claim is not evidence that the packet is unusable. The coordinator
must not attach fresh authority to that history, delete it, or invent a manual
database transition.

## Decision

Each fresh Antigravity bootstrap generation receives a distinct runtime
registration ID. Luca remains one actor, `luca-gemini`; the runtime ID remains
only a provenance and capability label.

The old registration, profile, bootstrap-consumption audit, packet, assignment,
window, receipt, claim, execution, and completion evidence remain unchanged.
The new generation cannot reuse any identifier or authority from that graph.

## Generation ID

The runtime ID is derived deterministically from the public bootstrap digest:

```text
luca-gemini-antigravity-<first 24 lowercase hex characters of bootstrapSha256>
```

The 24-character suffix carries 96 bits of collision resistance. The full
bootstrap digest remains bound into the public bundle and its digest.

The derivation is owned by one shared helper. Callers cannot supply an arbitrary
runtime ID. Bundle creation computes the ID; bundle validation recomputes it and
requires exact equality.

The derivation uses only the SHA-256 digest of the DPAPI-protected bootstrap.
The bootstrap value itself never leaves the Windows process boundary and never
appears in arguments, output, files, logs, receipts, or chat.

## Public Bundle and Founder Approval

All existing fixed Gate 3 fields remain fixed:

- actor and task;
- credential and runtime capabilities;
- token TTL;
- repository, worktree, branch, provider, model, and adapter;
- starting commit and task artifact digest;
- public key and key fingerprint;
- bootstrap digest and worktree realpath digest.

`runtimeId` becomes a derived field rather than a static field. It remains part
of the canonical bundle digest. The founder challenge and receipt therefore
approve the exact generated runtime ID indirectly through the bundle digest,
along with the task artifact, actor, key, and other provenance.

Any mismatch among the derived ID, bootstrap digest, bundle digest, challenge,
receipt, profile, or registration fails closed.

## Phase B Registration

Phase B creates a new runtime registration and active profile for the generation.
It does not invoke same-runtime bootstrap recovery and does not modify the old
registration or profile.

The profile ID remains derived from the full public bundle digest. A Phase B
retry with the same bundle and approved challenge may converge on the exact same
registration and profile only when every stored field matches. A collision with
different bytes fails closed.

Phase B records a successful generation-provisioning audit event containing only
non-secret evidence:

- runtime and profile IDs;
- challenge and receipt IDs;
- actor and task;
- artifact, key-fingerprint, bundle, bootstrap, worktree, and starting-commit
  digests or identifiers;
- registration outcome.

The audit event does not contain a bootstrap token, private key, credential, or
bearer value.

## Assignment and Current Authority

Assignment/window creation receives the exact validated public bundle and uses
`bundle.runtimeId`; it does not use the former static `primary` ID.

Before creating current authority it requires, in one PostgreSQL transaction:

- the exact founder-approved challenge and active receipt;
- the exact generation-provisioning audit event;
- one enabled, non-revoked registration matching the bundle;
- one active profile matching the bundle and derived profile ID;
- no live runtime credential;
- no live proof grant;
- no packet history for the new generation;
- no partial assignment event for the requested attempt.

Historical provenance and current assignment authority remain separate:
historical rows prove how the generation was provisioned; the fresh assignment,
window, proof grant, credential, and packet authorize only the bounded action.

## Route and Proof-Grant Enforcement

Hardcoded comparisons to `luca-gemini-antigravity-primary` are replaced only on
Gate 3 paths with exact generation validation:

- the runtime ID must equal the shared derivation from the founder-approved
  bundle;
- the authenticated principal must match that exact registration;
- the active profile must match that exact registration and bundle;
- the actor must be `luca-gemini`;
- the assignment task must be `1448`;
- packet, claim, execution, and completion records must retain the same runtime
  and profile bindings.

A prefix match alone is never authority. A valid-looking generation ID without
the matching bundle, challenge, receipt, profile, and assignment remains
unauthorized.

The old `primary` runtime cannot use new generation authority. A new generation
cannot claim or execute an old packet.

## Windows Boundary

Windows continues to:

- use PowerShell 5.1 and native DPAPI `CurrentUser`;
- validate a clean approved worktree at the exact promoted commit;
- contain no fixed coordination credential;
- execute only the fixed approved logical command;
- edit only `server/scripts/test-coordination-runtime.test.ts` during the bounded
  run;
- create no production commit.

After the source repair is promoted, the operator preserves stale public bundles
and task artifacts in quarantine, initializes a fresh DPAPI credential, and
generates a new public bundle. Prior bootstrap, bundle, challenge, receipt,
assignment, window, packet, claim, and execution identifiers are never reused.

No claim is made against malicious software running as the same Windows user.

## Failure Handling

- Existing runtime ID: exact replay is allowed only for an identical generation;
  any field mismatch fails.
- Existing profile mismatch: fail.
- Existing packet for the new generation: fail.
- Missing or mismatched provisioning audit: fail.
- Expired, revoked, or mismatched founder receipt: fail.
- Live credential or proof grant before assignment creation: fail.
- Runtime/profile mismatch at consumption, claim, execution, or completion:
  `consumption_not_authorized` or the existing stricter route error.
- Partial transaction failure: PostgreSQL rolls back the entire mutation.

No repair path deletes or rewrites historical evidence.

## Test Plan

Focused tests must prove:

1. Runtime IDs are deterministically derived from the public bootstrap digest.
2. Arbitrary, malformed, uppercase, truncated, or mismatched generation IDs fail.
3. Two generations for `luca-gemini` coexist with distinct registrations and
   profiles.
4. The prior runtime, profile, and packet remain byte-for-byte unchanged.
5. A new generation cannot consume, claim, execute, or complete an old packet.
6. Old-runtime/new-profile and new-runtime/old-profile combinations fail.
7. Both same-runtime/different-profile claim cases still return exactly
   `consumption_not_authorized`.
8. Phase B retries converge only for the identical approved generation.
9. Assignment creation requires exact generation-provisioning evidence and no
   live credential, grant, or packet.
10. The Windows launcher still reports the exact logical command and uses the
    fixed Windows command processor adapter.
11. Windows still runs exactly
    `npx tsx server/scripts/test-coordination-runtime.test.ts`.
12. No bootstrap or credential material appears in output, logs, arguments,
    bundles, task artifacts, audit metadata, or receipts.

Verification includes the focused coordinator suites, disposable PostgreSQL
tests, TypeScript, build, system health, consolidated CI, registered validation,
independent architecture review, dual Alden review, protected GitHub promotion,
deployment health, and an exact GitHub-main check before Windows initialization.

## Non-Goals

- No installer or coordinator productization; task 1449 remains cancelled.
- No schema migration.
- No generic packet-abandonment or packet-terminalization feature.
- No weakening of same-runtime recovery checks.
- No deletion, mutation, or reassignment of prior runtime evidence.
- No broader multi-task Antigravity authorization.

## Acceptance

The repair is complete only when:

1. the new source is reviewed, validated, promoted, and deployed;
2. Windows binds a fresh DPAPI bootstrap to that exact promoted commit;
3. a fresh founder-approved Phase A/Phase B cycle creates a distinct generation;
4. a fresh assignment and window report `ANTIGRAVITY_GATE3_READY`;
5. the bounded Windows launcher runs exactly once;
6. packet, consumption, diff, exact test, claim, execution, completion, cleanup,
   no-secret, and independent cross-hat evidence all pass; and
7. the old and new provenance graphs remain separate and queryable.