# Coordinator V2 Runtime Release Two-Phase Publication

## Context

The first founder-authenticated publication attempt for the Windows runtime
release returned `V2_RUNTIME_DATABASE_UNAVAILABLE` after approximately 30
seconds. Production startup, migrations, and Neon warmup were healthy, and the
failed request wrote no runtime-release row.

The publication service currently opens a database transaction before it:

1. resolves an authenticated GitHub source snapshot;
2. verifies Node release signature evidence;
3. downloads and verifies the locked npm runtime closure; and
4. streams and hashes every runtime object.

Those external operations can outlive the database session while it is idle in
the transaction. The next SQL statement then fails. Increasing a timeout would
retain the unsafe transaction boundary and would not bound future network or
object-storage latency.

## Chosen Design

Runtime release publication will use two phases.

### Phase 1: External verification without a transaction

The service will:

1. normalize and validate the request;
2. read the requested published source-promotion row;
3. read the latest published source promotion and require the requested row to
   be current;
4. preserve an exact source snapshot containing every field used by provenance
   and release-digest derivation;
5. derive authenticated source and package provenance from that snapshot; and
6. stream and hash every declared runtime object, requiring exact byte length
   and digest.

No runtime-release or artifact row is written in this phase. Provenance or
object-verification failure ends the request before a write transaction begins.

### Phase 2: Short atomic append transaction

After external verification succeeds, the service will open one short database
transaction and:

1. re-read the requested source promotion by ID and require it to remain
   published;
2. re-read the latest published source promotion;
3. require the transaction-fetched row to remain current and to exactly equal
   the source snapshot used by Phase 1 for repository identity, promoted
   commit, exact tree, publication reference, protected validation identity,
   and canonical record digest;
4. compute the release digest from the transaction-fetched source plus the
   already-verified artifacts, source members, and provenance digest;
5. perform the existing exact idempotency check;
6. insert the runtime release and all artifact rows atomically; and
7. return the created release, or the exact existing release for an identical
   replay.

The source snapshot comparison is fail-closed even though source-promotion rows
are append-only. If a newer published source promotion appears during Phase 1,
the final transaction refuses the stale request.

## Object Evidence Boundary

Runtime objects are content-addressed by declared SHA-256 and are independently
streamed and hashed in Phase 1. Moving that verification outside the database
transaction does not make object storage authoritative.

A mutation after Phase 1 cannot change the release digest or persisted object
digest. Bootstrap issue and artifact paths retain their independent object
checks and must fail closed if current bytes no longer match the immutable
release metadata. Publication does not assume that a prior object check makes
future reads trustworthy.

## Concurrency and Idempotency

The unique release-digest constraint remains the final concurrency arbiter.
The transaction must preserve the existing exact-replay behavior. If concurrent
identical requests race at insertion, the loser may return the winner only
after re-reading and proving complete persisted equivalence. It must not expose
an unclassified database conflict.

Requests whose source, artifact set, source members, or provenance differ
produce different release digests or fail validation. The change adds no
mutable release state.

## Error Handling

The service fails without opening a write transaction when:

- the requested source promotion is absent, unpublished, or not current;
- authenticated source or package provenance fails;
- a runtime object is missing or has the wrong size or digest; or
- request structure is invalid.

The final transaction fails and rolls back without a partial release when:

- the source promotion disappears, changes, becomes unpublished, or is no
  longer current;
- exact replay evidence differs;
- a uniqueness conflict cannot be proven to be an identical replay; or
- any release or artifact insert fails.

Unexpected database exceptions may continue to use the route's generic
database-unavailable response, but the service's expected authority failures
retain specific Coordinator V2 error codes.

## Authority Boundary

This change permits only founder-authenticated publication of immutable runtime
release evidence. It does not enroll a host, issue a bootstrap manifest, create
a task or session, grant a lease, or permit execution. All later authority
boundaries remain unchanged.

## Verification

Focused tests must prove:

- external provenance and object verification run before the transaction;
- provenance or object failure opens no write transaction and writes no row;
- source-current drift between phases fails closed;
- source-field drift between phases fails closed;
- release digest inputs come from the transaction-fetched source;
- exact replay remains idempotent;
- concurrent identical insertion resolves only through exact persisted
  equivalence;
- failed release or artifact insertion rolls back atomically; and
- later object mutation is rejected by the existing bootstrap read checks.

The implementation must then pass the runtime-bootstrap focused suites,
Coordinator V2 aggregate checks, typecheck, project checks, system health, and
independent architecture review before protected promotion preparation.