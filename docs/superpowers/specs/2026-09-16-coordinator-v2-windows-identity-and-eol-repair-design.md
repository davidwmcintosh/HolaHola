# Coordinator V2 Windows Identity and EOL Repair

**Date:** September 16, 2026  
**Status:** Approved design; implementation pending founder review

## Incident

The first Windows runtime initialization attempt stopped before runtime download
or acknowledgement with:

```text
hola_coordinator_acl_identity_unresolvable
```

The approved worktree and host enrollment were valid. Windows PowerShell
returned the ACL owner as an account-name string, while
`Convert-ToSidValue` assumed every non-`SecurityIdentifier` value exposed an
`IdentityReference.Translate` method.

The same Windows checkout also exposed a second boundary defect. Git kept the
worktree clean while converting the three runtime-manifest source members from
LF to CRLF. Their local byte digests therefore differed from the protected
remote snapshot and immutable runtime release.

No runtime artifact was downloaded or installed. No bootstrap issue or
acknowledgement was written.

## Invariants

1. ACL validation remains fail-closed.
2. The allowed owner and writer SID sets do not change.
3. Unresolvable, malformed, or unsupported identities still produce only
   `hola_coordinator_acl_identity_unresolvable`.
4. The three source members bound into the runtime manifest have identical
   bytes on Linux and Windows clean checkouts.
5. The existing immutable runtime release is never modified or reused for this
   corrected launcher.
6. Windows initialization remains restricted to
   `C:\Users\David\HolaHola-CoordinatorV2`.
7. Initialization cannot create a task, session, lease, operation, or
   coordinator invocation.

## Repair

### ACL identity conversion

`Convert-ToSidValue` will dispatch by input type:

- return the value of a `SecurityIdentifier` directly;
- for a string beginning with `S-1-`, construct a
  `SecurityIdentifier` and return its normalized value;
- for any other string, construct an `NTAccount`, translate it to a
  `SecurityIdentifier`, and return the SID value;
- for any other `IdentityReference`, use its existing `Translate` method.

All conversion remains inside the existing `try/catch`. Any constructor or
translation failure uses the existing fail-safe error. The repair does not
accept an identity as trusted; it only converts the identity to the SID that
the unchanged ACL policy evaluates.

### Cross-host source bytes

Add repository attributes that force LF checkout bytes for:

```text
scripts/hola-coordinator.ps1
scripts/coordination-v2-server-signing-public.pem
server/scripts/coordination-v2-cli.ts
```

These are the complete runtime source-member set. Their hashes must match the
protected remote snapshot on every host.

## Verification

1. Extend the Windows runtime-bootstrap static CI test to require:
   - the string SID constructor branch;
   - the account-name `NTAccount` translation branch;
   - the unchanged catch-to-fail-safe behavior;
   - all three LF attribute rules.
2. Run the focused runtime service, route, PostgreSQL, static, and self-check
   tests.
3. Run typecheck, the consolidated validation suite, and system health.
4. Obtain unconditional dual-engine Alden approval of the final diff.
5. Prepare, publish, and independently verify a new protected source
   promotion.
6. Publish exactly one newly authorized runtime release bound to that source
   promotion and independently verify its immutable rows.
7. On Windows, check out the new protected commit and verify:
   - clean worktree;
   - exact commit and tree;
   - exact hashes for all three source members;
   - `Convert-ToSidValue (Get-Acl $approvedRoot).Owner` resolves to the current
     user, SYSTEM, or Administrators SID.
8. Only after those checks pass, run one
   `Initialize-HolaCoordinatorRuntime`.
9. Independently verify one acknowledgement and zero task sessions before
   authorizing any explicit `Invoke-HolaCoordinator`.

## Publication Consequence

The prior runtime release remains immutable evidence of the original source
but is unusable for this Windows initialization because its source-member
digests bind the defective launcher and incomplete checkout policy. The repair
requires a new commit, protected validation, publication marker, source
promotion, and runtime release. No database schema change is required.