# Coordinator V2 Runtime Release Batched Artifact Append

## Context

The first runtime-release publication held its database transaction open across
authenticated GitHub, package, and object-storage verification. The approved
two-phase correction moved all external verification before the append
transaction.

The first production request through that correction still failed closed with
`V2_RUNTIME_DATABASE_UNAVAILABLE` after 33.704 seconds. Direct shared-Neon
queries proved that it wrote zero release rows and zero artifact rows.

A no-write diagnostic using the real current source, provenance, and 61 object
checks reached the transaction boundary in 15.817 seconds. A second no-write
diagnostic completed Phase 1 and the transaction's source, current-source, and
replay reads in 13.183 seconds. The remaining production work performs one
release insert followed by 61 sequential artifact inserts over the Neon
WebSocket transport. Those round trips are the remaining production-scale
bottleneck.

## Chosen Design

Keep the approved two-phase publication boundary and existing interactive
transaction. Change only artifact persistence:

1. Phase 1 continues to validate the request, authenticate source and package
   provenance, and independently hash every declared object without a
   transaction.
2. Phase 2 continues to open a short transaction, re-read the requested and
   current source promotion, reject drift, compute the release digest from the
   transaction-fetched source, and perform complete exact-replay validation.
3. A new release continues to use one release-row insert.
4. All artifact rows are inserted by one parameterized set-based SQL statement
   inside the same transaction, rather than one statement per artifact.
5. The transaction returns success only after both the release row and the
   complete artifact set have been inserted.

The set-based statement will receive a JSON array containing server-generated
artifact IDs and the already normalized artifact fields. PostgreSQL will expand
that bounded parameter with `jsonb_to_recordset` and insert the rows in one
operation. Request values will not be interpolated into SQL text.

## Atomicity and Failure Behavior

The release and artifact inserts remain in one transaction. If the set-based
artifact insert rejects any row or inserts fewer rows than expected, the
service throws and the transaction rolls back the release row.

The artifact count is bounded by the existing validator. Duplicate destinations
and invalid roles, paths, digests, lengths, media types, and Authenticode flags
remain rejected before Phase 1.

The unique release-digest constraint remains the concurrency arbiter. An
identical concurrent loser may recover only from SQLSTATE `23505` on
`uq_coordination_v2_runtime_release_digest`, followed by the existing second
short transaction that proves current source and complete persisted
release/artifact equivalence. No `ON CONFLICT` shortcut will replace that
proof.

## Diagnostics

The publication route will log a bounded, sanitized failure record for unknown
errors. It will include:

- the publication phase;
- elapsed milliseconds;
- error names, codes, constraint names, and messages from a bounded cause
  chain.

It will not log the request body, artifact list, object keys, authentication
state, cookies, headers, database URL, or credentials. Client responses remain
the existing stable error codes.

## Authority Boundary

This change permits only founder-authenticated publication of one immutable
runtime release. It does not enroll a host, issue a bootstrap manifest, create
a task or session, grant a lease, or permit execution.

The failed request created no partial authority. Windows initialization and
`Invoke-HolaCoordinator` remain blocked until a release is published and
independently verified.

## Verification

Focused tests must prove:

- external verification still completes before the transaction;
- a new release uses one release insert and one artifact insert regardless of
  artifact count;
- the artifact statement is parameterized and inserts the exact normalized
  set;
- artifact insertion failure rolls back the release;
- inserted-row count mismatch fails closed;
- exact replay and exact uniqueness-race recovery remain unchanged;
- bounded logging reports phase and error-chain metadata without payload data.

The implementation must pass the focused service and HTTP suites, Windows
static checks, typecheck, project checks, system health, independent
architecture review, protected promotion, publication, and direct shared-Neon
postconditions before another founder retry.