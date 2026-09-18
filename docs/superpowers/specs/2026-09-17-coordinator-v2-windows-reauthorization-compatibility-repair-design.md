# Coordinator V2 Windows Reauthorization Compatibility Repair

**Date:** September 17, 2026  
**Status:** Implemented and validated; protected publication pending
**Approved by:** David  

## Incident

The protected Coordinator V2 source and runtime release were published
successfully. The existing Windows host `LITTLENEMO` retained its active
enrollment and DPAPI-protected RSA key, but its original transport credential
expired.

The founder-approved reauthorization command created and persisted request
generation 1 before networking. Repeated submission of that exact persisted
request to:

```text
POST /api/coordination/v2/host/reauthorization-requests
```

returned HTTP 422 with the bounded code:

```text
V2_HOST_REAUTH_INVALID
```

The production database retained zero reauthorization requests, challenges,
replacement credentials, runtime issues, sessions, or execution records. The
failure therefore occurs inside request validation before any append.

The existing tests did not catch this incompatibility. They inspect PowerShell
source text or construct payloads in JavaScript; they do not execute the real
Windows PowerShell serialization and signing path.

## Decision

Preserve the exact durable Windows request and identify the failing validation
stage without exposing request material. Correct only the proven
cross-runtime incompatibility. Ship the correction, bounded diagnostics, and
real PowerShell coverage together in one protected release.

The repair must not broaden accepted canonical forms, weaken signature or
fingerprint checks, create a replacement enrollment, or regenerate local
authority.

## Alternatives

### Local proof followed by one combined release — selected

Use the exact DPAPI-persisted request to run a local, in-memory stage probe that
emits booleans only. Once the mismatch is identified, implement the minimal
correction and permanent bounded stage diagnostics, then publish both together.

This minimizes founder actions and avoids a speculative production change.

### Likely fix followed by retry — rejected

Changing the PowerShell canonicalization or signing path based on the strongest
hypothesis could require another full protected publication if the guess is
wrong.

### Broaden server acceptance — rejected

Accepting multiple arbitrary serialization or canonicalization forms would
weaken a protected authority boundary and make signature semantics ambiguous.

### Diagnostics-only production release — fallback only

If the mismatch cannot be proven locally, a diagnostics-only release may split
the existing generic 422 into closed-set stages. This is not the default
because it requires an additional protected publication cycle.

## Invariants

1. The existing host enrollment, host key, fingerprint, protocol version, and
   capabilities remain unchanged.
2. The existing RSA private key and DPAPI files remain the only local identity
   source.
3. The persisted request key, declaration, signature, and generation remain
   unchanged unless the exact legacy two-clock defect is proven locally after
   the malformed request has expired. That request is marked terminal before a
   fresh request key and next generation are created.
4. No diagnostic prints or persists a token, private key, request key, nonce,
   signature, decrypted DPAPI record, public-key bytes, or request body.
5. An expired credential grants no reauthorization, runtime, session, task, or
   execution authority.
6. Founder approval remains mandatory after request acceptance and before
   challenge proof.
7. Exact declaration shape, key fingerprint, enrolled public key, RSA
   signature, generation, replay, and time-window checks remain fail closed.
8. Reauthorization never initializes a runtime or creates a session.
9. Validation-stage codes identify only the failed class and never echo
   supplied values.
10. A correction must be supported by a failing real-PowerShell regression
    test, not only a synthetic JavaScript fixture.

## Local Proof

Run one bounded probe on `LITTLENEMO`. It reads the existing DPAPI request into
memory and reports only these booleans:

- top-level properties exactly match the wire contract;
- declaration properties and JSON types exactly match the server contract;
- request timestamps parse and remain within the accepted window;
- the canonical public-key digest equals the declared fingerprint;
- the enrolled-key-compatible RSA public key verifies the declaration
  signature over the PowerShell canonical bytes;
- parse-and-recanonicalize produces the same canonical declaration bytes.

The probe must restore strict-mode behavior and dispose cryptographic and HTTP
objects. It must not rewrite or remove the persisted request.

If all local checks pass, the remaining mismatch must be isolated with
closed-set server validation stages rather than guessed.

## Server Diagnostics

Replace the single pre-insert invalid code with stable, non-secret subclasses:

- declaration shape, type, or time-window invalid;
- supplied public key or fingerprint mismatch;
- canonical declaration signature invalid.

The route continues to return HTTP 422. Enrollment-not-found,
enrollment-revoked, enrollment-mismatch, idempotency-conflict, and database
failures remain distinct existing outcomes.

The service must not log or return declaration values, request keys,
fingerprints, signatures, public keys, or canonical bytes as part of these
errors.

## Compatibility Correction

The implementation location is determined by the local proof:

- If PowerShell canonical bytes differ from the server contract, correct the
  PowerShell canonicalizer or the construction of the signed value.
- If the emitted JSON value differs from the signed value, derive both from one
  canonical data representation before persistence.
- If public-key canonicalization differs, correct the PowerShell JWK
  serialization while retaining one exact server fingerprint algorithm.
- If all client-side values are correct, isolate and correct the exact server
  interpretation without accepting alternate arbitrary forms.

No correction may verify a signature over raw transport bytes as a fallback
after canonical verification fails.

### Proven two-clock defect

The bounded Windows probe proved that request shape, JSON types, declaration
round-trip, public-key fingerprint, key lineage, and canonical RSA signature
all pass. Only the time window fails.

The affected launcher reads `UtcNow` once for `issuedAt` and a second time for
`expiresAt`, then adds one hour to the second value. The signed span is
therefore always slightly greater than the server's exact one-hour maximum.

New requests must capture one UTC timestamp and derive both fields from that
single value.

### Expired malformed-generation rollover

The malformed persisted generation must not be edited, re-signed, or reused.
The launcher may mark it terminal and use the existing next-generation path
only when every condition below passes:

- `requestId` is empty;
- stored and wire declarations canonicalize identically;
- exact state, declaration, body, host identity, fingerprint, and key lineage
  checks pass;
- the stored RSA signature verifies over the canonical declaration;
- the signed span is greater than one hour and no more than one hour plus one
  minute;
- `expiresAt` is earlier than the current UTC time.

The terminal marker is persisted before rollover so a crash cannot return to
the invalid generation. Rollover creates a fresh request key and increments
the generation. The old request remains protected historical evidence.

This amendment was approved by David after the live bounded probe. Alden's
Anthropic architecture review required the expired-request condition; it is
authoritative for this code-side safety decision.

### Approval-path contract correction

Independent implementation review found an adjacent first-submission mismatch:
the server deliberately returns an origin-relative `approvalUrl`, while the
PowerShell client required an absolute HTTPS URL. A valid generation would
therefore append successfully but fail locally before `requestId` persistence,
and every retry would repeat that failure.

The client must require the exact relative path
`/coordination/v2/host-reauthorization-approval?requestId=<validated requestId>`
with no alternate origin, path, query, or fragment. Only after exact comparison
may it prepend the already validated HTTPS endpoint for founder presentation.
The request key remains absent from both forms.

## Verification

Add a test that executes the supported PowerShell path and generates a fresh
ephemeral RSA key and declaration. The test must prove:

1. the emitted request has the exact top-level and declaration shapes;
2. the server-derived public-key fingerprint matches;
3. the server verifies the PowerShell-generated signature;
4. parse and canonicalize is stable across the PowerShell and Node boundary;
5. declaration, fingerprint, and signature mutations each produce their exact
   bounded code;
6. a valid repeated request remains idempotent;
7. no failed validation appends a reauthorization row.

The existing static source guards remain useful but cannot be the sole
cross-runtime proof.

Run the focused reauthorization tests, the complete Coordinator V2 validation,
the project typecheck, and the system-health verifier before publication.

Final evidence: the focused suite passes 16/16; the disposable Neon gate deleted
its temporary branch, returned `READY_TO_PROMOTE`, and exited 0; the registered
validation workflow reported `ALL VALIDATION SUITE CHECKS PASSED`; the mandatory
system-health verifier reported `All checks passed — safe to mark done`; and the
same independent architect reviewer returned an unconditional PASS with no
remaining blocker. The real Windows PowerShell 5.1 proof remains intentionally
pending until this exact commit is pushed and the aggregate GitHub CI job runs.

## Protected Publication and Founder Stops

After the correction receives review and all validation passes:

1. commit and push the exact source;
2. prepare and verify a fresh protected source promotion;
3. stop for David's founder-only source publication;
4. prepare and verify a fresh runtime release;
5. stop for David's founder-only runtime publication;
6. fast-forward `LITTLENEMO` to the exact published commit and verify its tree;
7. replay the existing persisted reauthorization generation;
8. verify the pending database row and approval metadata;
9. stop for David's founder-only approval;
10. poll, sign, and store the replacement credential;
11. initialize and verify the runtime without creating a session.

No step may reuse a source promotion or runtime release prepared for different
source bytes.

## Review

Alden's Anthropic and Gemini review engines approved this design with one
required refinement: local cross-language proof must precede publication, and
the preferred outcome is one combined diagnostic-and-correction release.