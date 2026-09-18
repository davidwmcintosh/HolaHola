# Coordinator V2 Host Credential Reauthorization

**Date:** September 16, 2026
**Status:** Approved design; implementation and protected publication pending

## Incident

The founder-approved Windows host enrollment remained active, but its
`host:transport` credential expired after 24 hours. The existing renewal route
requires that credential to still be valid. The runtime initializer therefore
reached the runtime-issue endpoint with an expired credential and received HTTP
401.

The failed call created no runtime-bootstrap issue, acknowledgement, artifact
download, task, session, attempt, lease, operation, or execution authority. The
host enrollment and its DPAPI-protected RSA private key remain valid.

This exposed an authority dead end: expiry correctly removes transport
authority, but the current protocol has no founder-approved way to issue a new
credential for the same enrolled host key.

## Decision

Recover an expired host credential through a dedicated, durable
reauthorization lifecycle for the existing host enrollment.

Possession of the existing private key is necessary but not sufficient. A
founder must approve each reauthorization request. The expired token grants no
authority and is never accepted as renewal authority.

The host enrollment is not revoked, replaced, or duplicated. The old credential
remains unchanged as historical evidence. Successful reauthorization appends a
new credential for the same enrollment.

## Alternatives

### Dedicated reauthorization records — selected

Identity creation and credential recovery remain separate lifecycles. Dedicated
request and challenge records make founder approval, key proof, expiry, replay
protection, and credential issuance independently auditable.

### Extend first-enrollment records — rejected

This would combine identity creation with recovery of an existing identity.
Shared states and completion logic would make replay behavior, uniqueness, and
historical interpretation harder to verify.

### Accept an expired token and RSA proof — rejected

This would make credential expiry ineffective. It also would not implement the
required founder-reapproval boundary.

Lengthening the credential lifetime is not recovery and does not address an
already expired credential.

## Invariants

1. An expired credential never authenticates renewal, runtime bootstrap, or
   execution.
2. A fresh credential requires both founder approval of the exact request and
   proof of the existing enrolled private key.
3. Reauthorization preserves the existing host-enrollment ID, public key,
   fingerprint, protocol version, and capabilities.
4. The enrollment must be active at request submission, founder approval,
   challenge issuance, and final completion.
5. The enrolled public key and fingerprint are immutable.
6. One founder approval can issue at most one credential.
7. A challenge is bound to one request, enrollment, fingerprint, protocol
   version, and attempt generation; it is short-lived and single-use.
8. The expired credential remains unchanged. A successful completion appends a
   new 24-hour `host:transport` credential.
9. Reauthorization cannot create or mutate a runtime release, runtime-bootstrap
   issue or acknowledgement, policy, task, session, attempt, lease, work claim,
   operation, provider request, or execution record.
10. Reauthorization never starts runtime initialization or task execution.
11. Windows local credential replacement is atomic and DPAPI-protected.
12. The recovery flow emits only closed-set, bounded diagnostics and never
    prints tokens, private keys, request keys, nonces, signatures, or decrypted
    DPAPI content.

## Durable Data

### Reauthorization requests

Add a dedicated `coordination_v2_host_reauthorization_requests` table with:

- immutable request ID and host-generated request key;
- exact host-enrollment ID, key fingerprint, protocol version, and request
  generation;
- canonical declaration digest and host-signature digest;
- state constrained to `pending`, `approved`, `completed`, `expired`, or
  `rejected`;
- requested, expiry, approval, completion, and terminal timestamps;
- approving founder actor when approved;
- resulting credential ID only after successful completion;
- creation timestamp.

The request expires one hour after creation. Expired requests cannot be
approved, challenged, or completed.

The database enforces:

- global uniqueness of the request key;
- a positive integer request generation and uniqueness of each
  host-enrollment/request-generation pair;
- one nonterminal request per host enrollment;
- exact state/timestamp consistency;
- exact protocol version `1`;
- 64-character lowercase hexadecimal digests;
- a composite lineage key covering the request, enrollment, fingerprint,
  protocol, and generation.

An idempotent submission with the same request key and exact canonical
declaration returns the existing request. Reuse with different bytes fails
closed.

### Reauthorization challenges

Add a dedicated `coordination_v2_host_reauthorization_challenges` table with:

- immutable challenge ID;
- composite foreign-key lineage to the exact reauthorization request;
- nonce digest, never plaintext nonce;
- exact host-enrollment ID, fingerprint, protocol version, and request
  generation;
- issued, expiry, consumed, and creation timestamps.

The challenge expires two minutes after issuance. The database enforces one
unconsumed challenge per request and global uniqueness of the nonce digest.

The nonce itself is returned once over TLS. Only its digest is persisted.

### Enrollment immutability

Add database enforcement that an enrollment's public key and key fingerprint
cannot change after insertion. Existing service behavior already treats them as
identity material; the database must enforce that invariant independently.

## Canonical Signed Values

All signed declarations use the existing Coordinator V2 canonical JSON
serializer. Signatures use RSA-SHA256 with the already enrolled key.

The initial reauthorization declaration contains only:

- kind `host_credential_reauthorization`;
- correlation/request key;
- issued and expiry timestamps;
- protocol version `1`;
- host ID;
- host-enrollment ID;
- enrolled key fingerprint;
- request generation.

The server rejects unknown fields, missing fields, noncanonical values, future
protocol versions, declarations outside their bounded time window, and any
signature not verified by the public key already stored on the named active
enrollment.

The challenge proof signs a canonical value containing:

- kind `host_credential_reauthorization_challenge`;
- request ID and request key;
- challenge ID and nonce;
- host-enrollment ID;
- key fingerprint;
- protocol version `1`;
- request generation;
- challenge issue and expiry timestamps.

No field may be supplied by the server from a different request or inferred
from mutable client state during completion.

## Server Flow

### 1. Submit request

The host submits the canonical declaration, signature, and public identifiers
to a rate-limited public reauthorization-request endpoint.

In one transaction, the service:

1. validates the exact request shape and time bounds;
2. resolves the exact active enrollment;
3. checks host ID, enrollment ID, fingerprint, protocol, and capabilities;
4. verifies the declaration signature against the enrolled public key;
5. enforces one nonterminal request for the enrollment;
6. appends the one-hour request.

The expired token is not required and is not inspected for authority.

### 2. Founder review and approval

An authenticated founder page displays only bounded, non-secret request
metadata: host identity, enrollment identity, fingerprint, protocol,
capabilities, request time, expiry, and declaration digest.

Founder approval locks and revalidates the request and enrollment. It fails if
the request is expired or terminal, if the enrollment is not active, or if any
identity binding changed. Approval records the founder actor and timestamp.

### 3. Poll and issue challenge

The host polls with the request ID and request key.

Before issuing a challenge, the service rechecks:

- exact request-key binding;
- approved, nonterminal, unexpired request;
- active enrollment;
- exact immutable fingerprint and protocol version;
- absence of another unconsumed challenge.

The server generates a cryptographically random nonce, persists only its digest
with a two-minute expiry, and returns the nonce once.

If an unconsumed, unexpired challenge already exists, the server does not
disclose its nonce again. The host creates a new request only after the prior
request becomes terminal; it never guesses or reuses a nonce.

### 4. Complete proof and issue credential

The host signs the canonical challenge value and submits the exact proof.

One database transaction locks the request, challenge, and enrollment, then
revalidates:

- request ID, request key, generation, and composite lineage;
- founder approval;
- request and challenge expiry;
- nonterminal request and unconsumed challenge;
- active, unchanged enrollment;
- exact key fingerprint and protocol version;
- nonce digest;
- RSA signature.

Only after every check passes, the transaction:

1. appends one new 24-hour `host:transport` credential for the same enrollment;
2. consumes the challenge;
3. completes the request;
4. records the resulting credential ID.

Concurrent completion can produce only one credential. A replay returns a
closed-set terminal/replay error and never returns the credential token again.

The fresh access token is returned only in the first successful proof response.
The server never stores or logs its plaintext value.

## Windows Flow

Add an explicit command:

```powershell
Restore-HolaCoordinatorHostCredential `
  -Endpoint 'https://getholahola.com'
```

The command accepts no host ID, enrollment ID, fingerprint, key path, token,
request ID, nonce, URL path, task, policy, provider, runtime path, executable,
or destination argument. It derives identity and paths from the approved
launcher root and existing DPAPI material.

The command:

1. performs the existing approved-root, no-reparse, SID owner, and ACL checks;
2. reads the existing endpoint, expired token, and RSA key from CurrentUser
   DPAPI storage without printing them;
3. derives the public key and fingerprint and requires an exact active
   enrollment match;
4. persists the random request key and request state through DPAPI before the
   first network call;
5. submits idempotently and prints only the founder approval URL plus bounded
   request metadata;
6. polls only when the operator explicitly runs the command again after founder
   approval, reusing the exact persisted request;
7. signs the returned challenge;
8. atomically writes a complete new `host-material.dpapi` containing exactly
   `endpoint`, `accessToken`, and `expiresAt`;
9. rereads and validates the new material before removing the recovery request
   state.

Old two-field host material is accepted only as input to reauthorization. It is
never patched in place. The repaired runtime initializer rejects every
two-field material record with a bounded
`host_credential_reauthorization_required` error; it does not need another
network request to infer expiry. New three-field material must contain a
parseable future `expiresAt`.

Loss of the final HTTP response does not authorize a blind repeat. Because the
token is returned only once, an ambiguous completion is terminal and requires
founder review of the durable request before a new recovery generation.

The command never calls `Initialize-HolaCoordinatorRuntime` or
`Invoke-HolaCoordinator`.

## API Boundaries

Add four isolated routes:

```text
POST /api/coordination/v2/host/reauthorization-requests
POST /api/coordination/v2/host/reauthorization-requests/:id/approve
GET  /api/coordination/v2/host/reauthorization-requests/:id/status
POST /api/coordination/v2/host/reauthorization-requests/:id/proof
```

Only the approval route uses the authenticated founder session. Submission,
status, and proof use request-specific signed/keyed protocol material and strict
rate limits; they do not accept legacy actor, runtime, Gate 3, bootstrap, or
session credentials.

The founder approval page is:

```text
GET /coordination/v2/host-reauthorization-approval?requestId=<id>
```

It uses the same founder authentication as other founder-only administrative
actions and changes state only through the founder-authenticated POST route.

## Failure and Recovery

- Invalid shapes, signatures, fingerprints, protocol versions, or enrollment
  states fail closed before writes.
- A database failure returns a bounded unavailable code and does not partially
  advance state.
- An expired request becomes terminal and cannot be reopened.
- Observing an expired challenge terminalizes its request in the same
  transaction. It cannot be replaced under that approved request. The host
  starts a new request generation and obtains fresh founder approval.
- A revoked enrollment can never be reauthorized.
- Duplicate pending requests return the exact existing request only when the
  request key and canonical declaration match; otherwise they fail as a
  conflict.
- Local persistence happens before network progression. A retry resumes only
  the exact persisted generation.
- Reauthorization success does not imply runtime-bootstrap success and does not
  permit execution.

## Verification

### Static and service tests

Verify:

- exact request and challenge property sets;
- canonical declaration and challenge bindings;
- request expiry of one hour;
- challenge expiry of two minutes;
- protocol version `1`;
- immutable enrollment public key and fingerprint;
- one nonterminal request per enrollment;
- one unconsumed challenge per request;
- active enrollment checks at every transition;
- founder-only approval;
- invalid, revoked, changed, or mismatched host rejection;
- old expired token has no authority role;
- closed-set errors and secret-safe logs.

### PostgreSQL and concurrency tests

On a verified disposable Neon branch, prove:

- migration constraints and composite foreign keys;
- idempotent exact replay and conflicting replay rejection;
- concurrent request submission cannot create two pending requests;
- concurrent challenge issuance cannot create two live challenges;
- concurrent proof completion appends exactly one credential;
- challenge replay cannot return or append another credential;
- request/challenge expiry uses an advancing PostgreSQL clock;
- unrelated host, credential, and authority rows remain unchanged.

### Windows tests

On Windows PowerShell, prove:

- old two-field DPAPI material enters only reauthorization;
- new material is a complete atomic three-field replacement;
- failure before replacement preserves the old material;
- failure after replacement can validate and resume from the new material;
- owner-string SID translation, ACL, reparse, and approved-root checks remain
  fail-closed;
- no secret appears in stdout, stderr, transcripts, or server logs.

### Authority-isolation tests

For every failure and success path, compare exact before/after counts and
identities for:

- runtime releases, revocations, bootstrap issues, and acknowledgements;
- policies and grants;
- tasks, sessions, attempts, leases, and work claims;
- operations, provider requests, and execution journals.

Reauthorization may add only its request/challenge records and, after successful
proof, one host credential.

## Publication and Operational Sequence

1. Implement schema, services, routes, launcher behavior, and tests.
2. Generate and review the migration.
3. Prove the migration and concurrency behavior on a disposable Neon branch.
4. Run focused tests, typecheck, consolidated validation, and system health.
5. Obtain unconditional dual-engine Alden approval of the final diff.
6. Prepare, publish, and independently verify a new protected source promotion.
7. Publish exactly one runtime release bound to that promotion and independently
   verify its immutable rows.
8. On Windows, check out and verify the exact commit, tree, source hashes, ACLs,
   owner SID, and absence of reparse points.
9. Run the explicit reauthorization request command once.
10. Approve that exact request in the founder-authenticated production browser.
11. Run the explicit command once more to complete proof and atomic local
    replacement.
12. Independently verify one new credential, completed reauthorization, and
    zero runtime issues, acknowledgements, tasks, sessions, attempts, or leases.
13. Separately authorize exactly one runtime initializer call.
14. Independently verify one acknowledgement and zero task/session authority.
15. Only then permit exactly one explicit `Invoke-HolaCoordinator`.

The failed initializer call is never retried. Any future initializer is a new,
explicitly authorized operation after a fresh credential and a new protected
runtime release have both been independently verified.