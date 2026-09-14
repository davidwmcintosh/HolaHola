# Coordinator V2 First-Host Bootstrap Design

**Date:** 2026-09-14  
**Status:** Approved design; implementation pending  
**Review:** Alden Anthropic and Gemini approved with no pending changes

## Goal

Authorize exactly one initial Windows-host enrollment request with a
high-entropy one-time secret. The bootstrap must not create a host or durable
host credential by itself. Founder approval and host proof of private-key
possession remain separate mandatory steps.

## Constraints

- Corrected source must be published and recorded in
  `coordination_v2_source_promotions` before bootstrap authority is installed or
  used.
- The bootstrap secret is held only in the Replit secret
  `COORDINATION_V2_HOST_BOOTSTRAP_SECRET` and handed to the intended Windows
  host.
- Plaintext or hashed bootstrap material is never stored in PostgreSQL,
  committed files, logs, errors, or API responses.
- No bootstrap table or migration is added.
- Legacy actor, runtime, Gate 3, and broker credentials cannot authorize this
  boundary.
- The first pending enrollment request consumes bootstrap authority. It does
  not enroll or approve the host.

## API

`POST /api/coordination/v2/host-enrollment-requests` accepts the existing
enrollment declaration fields and reads the optional
`x-coordination-initial-bootstrap` header.

The route passes the header value to the host-auth service. It does not use the
existing presence-only bootstrap middleware.

## Transaction and Authority Order

Declaration, RSA public-key parsing, and fingerprint derivation happen before
the transaction as fail-fast input validation. The authority decision happens
inside one PostgreSQL transaction:

1. Acquire
   `pg_advisory_xact_lock(hashtextextended('coordination-v2:first-host-bootstrap', 0))`.
2. Read any enrollment request with the same `requestKey`.
   - Same declaration digest returns the original request idempotently.
   - A different declaration returns the existing idempotency conflict.
3. Count host enrollments and enrollment requests.
4. If one or more hosts exist, insert through the normal post-bootstrap
   enrollment-request flow. Founder approval is still required.
5. If no host exists but another enrollment request exists, reject the new
   request because bootstrap authority has already been consumed.
6. If no host or request exists:
   - require at least one published source-promotion row;
   - require the configured bootstrap secret;
   - require a bounded bootstrap header;
   - compare SHA-256 digests of configured and supplied values with
     `timingSafeEqual`;
   - insert exactly one pending enrollment request.
7. Transaction commit durably consumes bootstrap authority through the
   existence of that request row. The advisory lock releases automatically.

Concurrent requests with the same request key converge on the same row.
Concurrent requests with different keys have one winner; later transactions
observe the existing request and fail closed.

## Error Contract

- Missing bootstrap header while the database is at the initial boundary:
  `V2_HOST_BOOTSTRAP_REQUIRED` (`401`).
- Wrong bootstrap value: `V2_HOST_BOOTSTRAP_DENIED` (`403`).
- Missing server-side bootstrap configuration or database failure:
  `V2_HOST_BOOTSTRAP_UNAVAILABLE` (`503`).
- A different request after initial bootstrap consumption but before host
  completion: `V2_HOST_BOOTSTRAP_CONSUMED` (`409`).
- No published source authority: `V2_HOST_SOURCE_PROMOTION_REQUIRED` (`409`).
- Existing request-key conflicts retain `V2_HOST_IDEMPOTENCY_CONFLICT` (`409`).

Errors expose only codes. They never include configured or supplied secret
bytes.

## Secret Lifecycle

Generate 32 random bytes and encode them as Base64URL. Install the value in
Replit Secrets only after the corrected source commit is:

1. committed;
2. pushed to GitHub;
3. explicitly published through Replit;
4. recorded as a published V2 source-promotion row.

The same value is handed only to the intended Windows host. The server cannot
delete its own Replit secret, so durable database state enforces one-time use:
after the first request commits, the value can never authorize another initial
request. The secret should still be removed from Replit Secrets after the host
ceremony completes.

## First-Host Ceremony

1. Windows host generates its RSA key pair locally.
2. Host submits its declaration, public JWK, fingerprint, request key, and the
   one-time bootstrap header.
3. Founder reviews and approves the pending request.
4. Host polls for a nonce challenge.
5. Host signs the nonce with its private key and submits the proof.
6. Server creates the active host enrollment and a short-lived host credential.
7. Host receives the plaintext access token once and stores it with Windows
   DPAPI. PostgreSQL stores only the token hash and lineage.
8. Verify the host can request signed preflight material without creating a
   coordination session.

## Tests

The focused test suite must prove:

- missing and wrong bootstrap values fail;
- missing server configuration fails closed;
- no source promotion prevents initial request creation;
- the secret never appears in database rows, errors, or logs;
- same-key retries are idempotent;
- a different second request is rejected before first-host completion;
- two concurrent first requests produce one durable winner;
- later host requests use the existing founder-approval flow without bootstrap;
- bootstrap creates no host or credential;
- founder approval and RSA proof remain mandatory;
- all existing V2 authority, fault-injection, disposable-PostgreSQL, typecheck,
  system-health, and startup checks remain green.

## Recovery

If bootstrap fails before the first request commits, correct the configuration
and retry with the same request key and secret. If the first request commits but
the ceremony does not complete, resume that exact request; do not create a new
bootstrap request. Founder rejection or expiry requires an explicit recovery
decision because the one-time bootstrap has already been consumed.