# Antigravity Phase A Attempt IDs

## Problem

Antigravity Phase A currently derives its challenge idempotency key only from
the approved public bundle digest. Task-ownership challenges are immutable, so
an expired challenge permanently occupies that key. Submitting the unchanged
approved bundle returns the expired challenge instead of creating fresh founder
authority.

## Goal

Allow a fresh founder challenge for the same approved bundle while preserving
safe retry convergence within one operator attempt.

## Chosen design

Phase A requires an explicit, non-secret operator attempt ID:

```text
--attempt-id <UUID>
```

The attempt ID remains outside the public bundle. It does not alter the bundle
digest, task artifact digest, Windows state, bootstrap, runtime profile, or
Phase B receipt bindings.

Phase A derives its task-ownership idempotency key from:

```text
antigravity:<bundleDigest>:<attemptId>
```

The operator generates a new UUID for each intentional challenge attempt and
retains it for command retries. The CLI returns the normalized attempt ID with
the challenge result.

## Validation and failure behavior

- Phase A rejects a missing attempt ID with a stable non-secret error.
- The attempt ID must be a canonical lowercase UUID string.
- Invalid or oversized values fail before challenge creation.
- The attempt ID is safe to print and audit; it grants no authority.
- Existing immutable challenge and decision evidence is never updated or
  deleted to make room for a new attempt.

## Idempotency behavior

- Same bundle plus same attempt ID returns the same challenge.
- Same bundle plus a new attempt ID creates a new challenge, even if a prior
  challenge for that bundle expired.
- Reusing one attempt ID with different request bindings remains an
  idempotency conflict in the founder service.
- Phase B continues to accept only the selected challenge ID and unchanged
  public bundle. The attempt ID has no Phase B authority.

## Scope

Change only:

- the Phase A function signature and result;
- Phase A CLI argument parsing;
- focused provisioning tests;
- operator documentation that shows the Phase A command.

Do not change:

- the Windows launcher or bounded task artifact;
- public bundle schema or bytes;
- bootstrap storage or exchange;
- database schema;
- founder decision routes;
- Phase B recovery, registration, or receipt validation;
- task 1448 execution constraints.

## Verification

Focused tests must prove:

1. a missing or malformed attempt ID is rejected before challenge creation;
2. same bundle plus same attempt ID converges on one challenge;
3. same bundle plus a different attempt ID creates a distinct fresh challenge;
4. the new challenge retains the exact artifact, key, actor, and bundle-context
   bindings;
5. existing Phase B recovery tests remain green.

Run TypeScript, the focused disposable PostgreSQL broker/provisioning suite,
and system health. Review the actual final diff with Alden and an independent
architecture reviewer before committing the implementation.