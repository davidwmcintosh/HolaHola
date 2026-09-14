# Coordinator V2 Staged First-Host Enrollment

## Purpose

Replace fragile pasted PowerShell with a durable launcher command that safely creates the first real Windows host enrollment request.

## Authority order

The command must preserve the existing order:

1. Require an exact published-source authority.
2. Persist the RSA private key and exact enrollment retry authority with Windows CurrentUser DPAPI.
3. Submit one idempotent enrollment request with the initial-bootstrap header.
4. Clear bootstrap material only after a confirmed request response.
5. Wait for explicit founder approval.
6. Prove RSA possession.
7. Store the issued host credential with CurrentUser DPAPI.
8. Promote and acknowledge public artifacts.
9. Permit session creation only after acknowledgement.

The command does not weaken or bypass any server-side authority check.

## Interface

Add a named first-host enrollment command to `scripts/hola-coordinator.ps1`. The operator supplies the HTTPS endpoint and founder-approval URL. The bootstrap secret is accepted only from `COORDINATION_V2_HOST_BOOTSTRAP_SECRET`; it is never accepted as a command-line argument and is never printed.

The command emits only safe enrollment metadata: request ID, public-key fingerprint, request status, and non-sensitive persistence status.

## Durable local state

Before any network request, write one DPAPI-protected retry record atomically. It contains:

- The generated RSA private-key material.
- The exact serialized enrollment request body.
- The request idempotency key.
- The endpoint and public-key fingerprint.
- An optional server request ID after a response is confirmed.

Materialize the existing DPAPI-protected runtime private-key file from that retry record before submission. A retry must reuse the exact request bytes and request key; it must never generate a second identity after an ambiguous transport result.

If only one local file exists after interruption, recovery is driven from the complete retry record. A private-key file without retry authority fails closed because no exact request identity can be proven.

## Enrollment lifecycle

### Prepare and submit

On first invocation:

1. Validate Windows, the clean approved checkout, the HTTPS endpoint, the published-source preflight, and bootstrap-secret shape.
2. Generate a 2048-bit RSA key.
3. Construct the enrollment declaration with the existing canonical byte format.
4. Persist retry authority and runtime private-key material through CurrentUser DPAPI.
5. POST the exact body with `x-coordination-initial-bootstrap`.
6. Persist the returned request ID.
7. Clear the process environment value and clipboard.
8. Return safe metadata.

On retry:

1. Load and validate the protected retry record.
2. Restore the runtime private-key file if needed.
3. Reuse the exact body and request key.
4. Send the bootstrap header only while request creation is not confirmed.
5. Treat the server’s idempotent response as confirmation of the same request.

### Approve and complete

After the request is verified durably, the founder opens the existing approval page and approves it. A resume command loads the protected RSA key and request state, polls with the protected request key, signs the issued nonce using RSA-SHA256, submits proof, and stores the returned `v2h_…` credential with CurrentUser DPAPI without printing it.

The retry record is removed only after host credential persistence succeeds.

## Failure behavior

- A failure before DPAPI persistence causes no request.
- A failure after persistence but before a response is retryable with identical authority.
- A response-validation failure retains retry authority and bootstrap material.
- Bootstrap material is cleared only after the server confirms request creation or an idempotent replay.
- Founder rejection, expiry, malformed state, fingerprint mismatch, or proof failure stops explicitly.
- No error path prints request keys, private keys, bootstrap values, host tokens, nonce values, or signatures.

## Verification

Add regression coverage that proves:

- DPAPI retry persistence occurs before the network submission seam.
- An ambiguous transport retry reuses the exact request key, request bytes, RSA identity, and fingerprint.
- The bootstrap header is present for initial creation and absent after confirmed creation.
- Bootstrap clearing occurs only after confirmation.
- No host or host credential is created by request submission.
- Founder approval and valid RSA proof remain required.
- Host material is persisted before retry authority is removed.
- Existing post-enrollment promotion, acknowledgement, and session gates remain unchanged.

Run the focused enrollment tests, TypeScript typecheck, consolidated validation relevant to the launcher, and the system-health verifier before publication.

## Scope boundaries

Do not modify migration `0049`, database schema, source-promotion authority, founder authentication, host proof rules, promotion rules, acknowledgement rules, or session-creation authority. Do not inspect or modify separately owned work.