# Coordinator V2 policy reference

## Operator path

The normal operator action is:

```powershell
Invoke-HolaCoordinator -TaskRef <task reference>
```

This command launches against an already approved policy. It does not create,
approve, amend, or broaden policy. `-Policy` may select an already approved
policy; it is not an approval mechanism.

## Founder approval is separate from launch

A policy begins in `draft`. Only authenticated founder authority may approve
the exact immutable policy version. An approved version may be revoked but may
not be edited, re-approved after revocation, or silently replaced by launch
input.

An operator grant is also required. It binds the allowed operator, policy,
actions, scope, and expiry. Possessing a host credential or knowing an internal
identifier does not replace either founder approval or the operator grant.

The launch fails closed if the selected policy is absent, not approved,
revoked, incompatible with the task or host, outside the grant, or unavailable
because PostgreSQL cannot prove its state.

## Server-owned policy decisions

The approved policy controls:

- provider subset and order;
- allowed models and adapter versions;
- per-provider and aggregate attempt budgets;
- retry and fallback limits;
- approved tools;
- approved repositories, paths, and commands;
- preparation, session, lease, and operation durations;
- compatible host declarations;
- evidence and cleanup obligations.

The host and operator cannot override these values. The server chooses the
provider and model for each attempt and decides whether the next action is a
transport resume, same-provider fresh attempt, next-provider fallback, terminal
failure, or cleanup repair.

## Policy lifecycle

| State | Meaning |
| --- | --- |
| `draft` | Mutable proposal with no execution authority. |
| `approved` | Immutable founder-approved version eligible for a matching grant and session. |
| `revoked` | Permanently non-authorizing for new work; active sessions must follow the server's revocation rules. |

Policy mutations use stable idempotency keys. Reusing a key with different
bytes is a conflict, not an update.

## Canonical policy and authorization diagnostics

Policy and grant failures use the stable catalog in
[Coordinator V2 stable diagnostics](coordination-v2-error-codes.md), including:

- `POLICY_INVALID`, `POLICY_NOT_FOUND`, `POLICY_VERSION_NOT_FOUND`;
- `POLICY_ALREADY_APPROVED`, `POLICY_ALREADY_REJECTED`,
  `POLICY_ALREADY_REVOKED`, `POLICY_NOT_DRAFT`, `POLICY_NOT_APPROVED`;
- `POLICY_IDENTITY_REVOKED`, `FOUNDER_REQUIRED`,
  `FOUNDER_DECISION_REQUIRED`;
- `OPERATOR_REQUIRED`, `OPERATOR_GRANT_NOT_FOUND`,
  `OPERATOR_GRANT_EXPIRED`, `OPERATOR_GRANT_REVOKED`;
- `OPERATOR_GRANT_SCOPE_DENIED`, `OPERATOR_GRANT_ACTION_DENIED`,
  `OPERATOR_GRANT_POLICY_DENIED`, `OPERATOR_GRANT_ALREADY_REVOKED`,
  `OPERATOR_GRANT_INVALID`;
- `IDEMPOTENCY_CONFLICT`, `POLICY_DATABASE_UNAVAILABLE`.

Canonicalization also rejects unknown, secret-shaped, invalid, or
policy-disallowed fields using the lowercase validation codes listed in the
diagnostics catalog.

## Identifiers and provenance

Policy, version, grant, session, preparation, attempt, lease, host, claim,
receipt, challenge, digest, and evidence identifiers are internal server data.
Operators may inspect them through authorized diagnostics, but must never copy
them into another launch or manually transfer them between hosts.

Provider/model/adapter and host/repository/Git provenance belong to one
execution lineage. They identify how and where Luca performed the work; they do
not divide Luca's identity by runtime or provider.

## Computing hostConstraints.windowsPublicMaterialDigest before authoring

A Windows-host policy pins `hostConstraints.windowsPublicMaterialDigest` to the
exact SHA-256 the server requires at preparation time
(`issueCoordinationV2PreparationEnvelope`). Guessing it produces a bare
`V2_PREPARATION_PUBLIC_DIGEST_MISMATCH` with no further detail. Compute it
offline first:

```bash
npx tsx server/scripts/coordination-v2-public-material-digest.ts \
  --task-ref <task reference> \
  --promoted-commit-sha <40-hex commit sha of the published source promotion> \
  --exact-tree-sha <40-hex tree sha of that same promotion> \
  --policy <path to the policy JSON you intend to submit>
```

This reuses the same task-artifact resolution and public-config hashing the
server applies at preparation time, so the printed digest is exactly the value
the server will require. No live database connection is used. Any value (or no
value) already at `hostConstraints.windowsPublicMaterialDigest` in the policy
file is ignored — it is stripped before hashing precisely so it can never be an
input to its own hash.

End-to-end sequence:

1. **Compute** — run the command above; it prints the real
   `windowsPublicMaterialDigest`.
2. **Author** — put that value in `hostConstraints.windowsPublicMaterialDigest`
   and submit the policy with `createPolicyDraft`.
3. **Approve** — a founder approves the exact policy version.
4. **Grant** — issue an operator grant for that approved policy so an operator
   can launch a session against it.

`promotedCommitSha` and `exactTreeSha` identify the published source promotion
(`coordinationV2SourcePromotions`, state `published`) the policy will run
against. They are not derivable from a local checkout alone, so they remain
required, explicit inputs. Run the command with `--help` for the full flag
reference.

## Windows and historical limits

The current Windows credential is protected with DPAPI `CurrentUser`, so only
the same Windows user may use the prepared local credential. This does not
defend against malicious software already running as that user.

Legacy Gate 3 policy challenges, receipts, grants, windows, and test evidence
are historical only. They cannot satisfy V2 founder approval, an operator
grant, host authority, or fresh real-Windows acceptance.

Cancelled legacy activation work remains cancelled. Separately owned work
remains untouched and supplies no V2 authority.
