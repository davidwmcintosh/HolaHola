# Coordinator V2 Host Credential Reauthorization Implementation Plan

**Date:** September 16, 2026
**Design:** `docs/superpowers/specs/2026-09-16-coordinator-v2-host-credential-reauthorization-design.md`

## Goal

Restore transport authority for the same active Windows host after its
24-hour credential expires, while preserving credential expiry as a real
boundary and requiring founder approval plus proof of the enrolled private key.

## Constraints

- Never accept an expired token as authentication or renewal authority.
- Preserve the existing host enrollment, public key, fingerprint, protocol,
  capabilities, and historical credential rows.
- Reauthorization may write only its request/challenge rows and one new host
  credential after successful proof.
- Do not create a runtime issue, acknowledgement, task, session, attempt, lease,
  work claim, operation, provider request, or execution record.
- Do not retry the consumed Windows initializer call.
- Apply no schema change to shared Neon before the disposable branch gate
  reports `READY_TO_PROMOTE`.
- Do not publish, reauthorize Windows, initialize the runtime, or invoke a task
  until each preceding evidence gate is independently verified.

## Step 1: Add the schema source of truth

### Files

- `shared/schema.ts`

### Work

Add dedicated reauthorization request and challenge tables with:

- exact enrollment/fingerprint/protocol/generation lineage;
- one-hour request and two-minute challenge bounds;
- one nonterminal request per enrollment;
- one unconsumed challenge per request;
- exact state/timestamp and digest checks;
- composite foreign keys preventing cross-request substitution;
- resulting credential linkage only after completion.

Add database enforcement that enrolled public keys and fingerprints cannot be
changed after insertion. Export the inferred row types.

### Gate

- Existing enrollment and credential columns are not repurposed.
- No default or backfill changes historical rows.
- The new tables cannot reference mismatched enrollment/request generations.

## Step 2: Generate, review, and prove the migration

### Files

- generated migration after `migrations/0053_chief_lady_ursula.sql`
- matching `migrations/meta/` snapshot and journal entries
- focused Coordinator V2 PostgreSQL regression test

### Work

Run `npx drizzle-kit generate` only after the schema is complete. Review the
generated SQL for exact tables, constraints, indexes, foreign keys, and
immutability enforcement.

Add disposable-database proofs for:

- duplicate and mismatched lineage rejection;
- one live request and one live challenge;
- request/challenge expiry constraints;
- public-key/fingerprint update rejection;
- concurrent proof completion producing exactly one credential;
- unrelated-row preservation and transaction rollback.

Run `npm run db:branch -- gate`. Apply the migration to shared Neon with
`npx drizzle-kit migrate` only after `READY_TO_PROMOTE`.

### Gate

- Prior migrations remain byte-identical.
- The disposable branch is deleted after the gate.
- Shared Neon receives the reviewed migration exactly once.

## Step 3: Implement the isolated server lifecycle

### Files

- `server/services/coordination-v2-host-auth-service.ts`
- `server/routes/coordination-v2-host-admin-routes.ts`
- focused service and route tests

### Work

Implement four isolated operations:

1. signed request submission for an exact active enrollment;
2. founder-authenticated approval;
3. request-key polling and single-use challenge issuance;
4. transactional challenge completion and new credential issuance.

Use existing canonical JSON, RSA verification, founder middleware, strict rate
limits, error taxonomy, and credential construction patterns. Persist only
nonce/signature digests where plaintext evidence is unnecessary.

The final transaction must lock and revalidate request, challenge, and
enrollment before appending one 24-hour `host:transport` credential and
terminalizing the request/challenge.

### Gate

- Expired tokens are absent from every authority decision.
- Founder approval is required and bound to the exact request.
- Unknown fields, protocol drift, signature mismatch, expiry, revocation,
  replay, and concurrency fail closed.
- Tests prove zero imports/calls/writes across runtime and execution authority
  boundaries.

## Step 4: Implement the Windows recovery command

### Files

- `scripts/hola-coordinator.ps1`
- PowerShell contract/static/self-check tests

### Work

Add:

```powershell
Restore-HolaCoordinatorHostCredential `
  -Endpoint 'https://getholahola.com'
```

The command must:

- derive all identity and paths from the approved launcher root;
- reuse the existing DPAPI-protected RSA key;
- persist a recovery request generation before networking;
- submit and resume only the exact persisted generation;
- print only bounded approval metadata;
- sign the approved server challenge;
- atomically replace legacy two-field host material with exact three-field
  material containing `endpoint`, `accessToken`, and `expiresAt`;
- reread and verify the replacement before clearing recovery state.

Update runtime initialization to reject legacy two-field material locally with
`host_credential_reauthorization_required`. Do not auto-run recovery,
initialization, or invocation.

### Gate

- No token, key, request key, nonce, signature, or decrypted DPAPI content can
  reach stdout/stderr.
- ACL, SID-owner, reparse, root, and endpoint checks remain fail-closed.
- Ambiguous completion never causes blind credential issuance or initializer
  retry.

## Step 5: Run complete validation and independent review

### Commands

```bash
npm run typecheck
bash server/scripts/run-validation-suite.sh
bash server/scripts/test-all-consolidated-ci.sh
npx tsx server/scripts/verify-system-health.ts
```

### Work

Register focused tests in the consolidated validation path. Run the focused
service, route, PostgreSQL, static, HTTP, and self-check tests before the full
suite. Restart the application once after the complete code/migration batch and
inspect workflow and browser logs.

Submit the actual final diff to both Alden engines. Apply every required change
and repeat review until both return unconditional approval.

### Gate

- No new typecheck or validation failure.
- System health has zero red failures.
- Application starts cleanly.
- Both Alden engines report no remaining required change.

## Step 6: Protected publication and Windows recovery

### Work

1. Prepare and verify a new protected source promotion.
2. Publish and independently verify the exact source commit/tree.
3. Publish exactly one runtime release with source-member hashes derived from
   that exact promoted commit.
4. Verify immutable release rows, artifacts, source members, and zero authority
   side effects.
5. On Windows, verify exact checkout/tree/hashes/ACL/SID/reparse state.
6. Run one explicit recovery-request command.
7. Approve that exact request in the founder-authenticated production browser.
8. Run one explicit recovery-completion command.
9. Independently verify the completed request, one new credential, and zero
   runtime/task/session authority.
10. Separately authorize exactly one new initializer call.
11. Independently verify one acknowledgement and zero task/session authority.
12. Only then permit exactly one explicit `Invoke-HolaCoordinator`.

### Gate

- Every founder action is explicit and single-use.
- No consumed command is rerun after ambiguous or failed transport.
- Each stage is independently verified before the next stage is authorized.