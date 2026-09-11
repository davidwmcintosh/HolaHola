# Antigravity Safe Provisioning Implementation Plan

**Date:** September 10, 2026  
**Design:** `docs/superpowers/specs/2026-09-10-antigravity-safe-provisioning-design.md`

## Implementation constraints

- PostgreSQL remains canonical.
- `luca-gemini` remains the actor; `luca-gemini-antigravity-primary` is a runtime provenance label.
- The Windows execution host must not receive a fixed Luca actor token.
- Bootstrap and broker credential values must not appear in chat, stdout, command arguments, logs, repository files, `.env` files, or evidence receipts.
- The bootstrap originates in the runtime-specific 1Password item. Only its SHA-256 leaves the Windows process during preparation.
- No work-authorizing action may occur before a fresh founder-approved ownership proof succeeds.
- The exact task starting commit is resolved only after this implementation completes protected promotion.
- Do not claim adversarial Windows host containment.

## Step 1: Lock bootstrap-digest registration behavior with tests

Extend `server/scripts/test-coordination-credential-broker.test.ts` with failing tests for an operator-only prehashed registration path:

- accepts a lowercase SHA-256 verifier without receiving plaintext;
- preserves existing runtime ID, actor, capability, TTL, audit, and uniqueness rules;
- permits the original bootstrap to exchange exactly once;
- rejects the stored digest when it is presented as the bootstrap;
- rejects uppercase, short, long, and non-hex digests;
- returns an existing byte-compatible registration on an identical retry;
- rejects a retry that conflicts on actor, display name, capability order/content, TTL, or digest;
- never includes the verifier or any credential value in audit metadata or errors.

Keep the existing server-generated bootstrap tests unchanged.

## Step 2: Add operator-only prehashed broker registration

Update `server/services/coordination-credential-broker.ts`:

- extract shared runtime-registration validation;
- add a narrowly named registration function that accepts `bootstrapSha256`;
- store the validated digest directly as `bootstrapHash`;
- perform compatible-retry detection under a transaction and row lock;
- append non-secret audit evidence for created, replayed, and rejected registration attempts;
- return only registration metadata, never a bootstrap or digest;
- leave `registerCoordinationRuntime` and public bootstrap exchange behavior intact.

No public HTTP endpoint accepts a prehashed verifier. The function is callable only by trusted operator-side code.

## Step 3: Define and test the public provisioning bundle

Create `server/services/antigravity-provisioning-bundle.ts` and focused tests.

The module owns:

- the exact Gate 3 runtime ID, actor, capability allowlist, TTL, provider, model, adapter version, repository label, worktree label, and branch;
- canonical JSON serialization and bundle SHA-256;
- strict lowercase-hex validation for all digests and commits;
- Ed25519 public-key/fingerprint consistency;
- task ref `1448`;
- exact final starting-commit equality across task, profile, and bundle fields;
- rejection of unknown fields and secret-shaped fields;
- explicit redaction-safe error types.

The public bundle contains no bootstrap, access token, fixed actor token, private key, or secret reference.

## Step 4: Add the Windows preparation path

Create:

- an approved task #1448 artifact template with a single final-starting-commit placeholder;
- `server/scripts/prepare-antigravity-provisioning.ts`;
- focused hermetic tests using temporary Git worktrees and injected environment maps.

The preparation command:

1. verifies it runs from `C:\Users\David\HolaHola-antigravity` or an explicit test root;
2. verifies a clean linked worktree on `luca/gemini-experiment`;
3. verifies `HEAD` equals the fetched GitHub `main` commit supplied through a non-secret option;
4. materializes `.local/tasks/task-1448.md` from the checked-in template with that exact commit;
5. creates or loads task #1448's local Ed25519 ownership key;
6. reads `COORDINATION_RUNTIME_BOOTSTRAP_TOKEN` only from its injected environment;
7. fails if any fixed Gemini actor-token variable is present;
8. validates the broker bootstrap format and hashes it in memory;
9. emits only the canonical public provisioning bundle.

The command must not perform network calls, register anything, submit a challenge, or write credential values. Tests capture stdout/stderr and assert that seeded secret sentinels never appear.

## Step 5: Add two-phase trusted operator provisioning

Create `server/scripts/provision-antigravity-runtime.ts` with two explicit phases.

### Phase A: submit challenge

- read the public bundle from a bounded file or standard input;
- validate its canonical digest and all fixed Gate 3 fields;
- create the ownership challenge through the existing founder-task-ownership service using server-held `luca-gemini` authority;
- write only challenge ID, task digest, key fingerprint, bundle digest, and expiry.

This phase creates no runtime registration or profile.

### Phase B: register after founder approval

- reread and validate the identical public bundle;
- fetch the named challenge and require approved status plus exact task, actor, artifact, public-key, and fingerprint equality;
- require an active, unexpired receipt;
- call the prehashed broker-registration function;
- create the coding-runtime profile using the exact bundle fields;
- make an identical retry safe and reject conflicts;
- write only non-secret record IDs, digests, and statuses.

Tests prove that pending, rejected, expired, revoked, mismatched, or substituted challenges cannot register a runtime.

## Step 6: Make ownership proof broker-native

Update the task-ownership client and the Antigravity runtime driver:

- allow an already-issued short-lived broker credential to authenticate nonce issuance and proof;
- do not read or fall back to `COORDINATION_LUCA_GEMINI_CODE_TOKEN` in the Gate 3 path;
- exchange the 1Password-injected bootstrap first;
- prove the active receipt with the Windows-held Ed25519 key;
- gate packet fetch, consumption, claim, model call, file write, command execution, completion, and evidence on successful proof;
- fail startup if a fixed Gemini actor-token variable is present.

Keep legacy compatibility for established non-Gate-3 callers, with regression coverage showing the new driver cannot select it.

## Step 7: Add end-to-end hermetic and disposable-PostgreSQL proof

Extend the focused runtime suites to cover:

- final-HEAD task materialization and digest binding;
- public-bundle canonicalization and tamper rejection;
- challenge-before-registration ordering;
- founder approval before registration;
- bootstrap exchange before ownership proof;
- ownership proof before every work-authorizing operation;
- bootstrap replay and pass-the-hash rejection;
- stale receipt, wrong key, wrong artifact, wrong actor, wrong runtime, wrong profile, and wrong starting commit;
- no credential leakage through stdout, stderr, errors, audit metadata, tool results, or receipts;
- identical retry recovery after interruption;
- conflicting retry fail-closed behavior.

Run the full disposable PostgreSQL coordination suite after focused tests.

## Step 8: Review and documentation

Update:

- `docs/coordination-clients.md`;
- `docs/antigravity-gate3-runbook.md`;
- `docs/batch-doc-updates.md`;
- `docs/alden-agent-handoff.md`.

Deprecate the manual stdout-copy procedure for Gate 3 without changing unrelated established runtime instructions.

Send the actual implementation and tests to Alden's Anthropic and Gemini engines. Apply every required change and repeat review until both return unconditional approval.

## Step 9: Validate and promote

Run:

```text
npm run typecheck
npx tsx server/scripts/verify-system-health.ts
bash server/scripts/run-validation-suite.sh
bash server/scripts/test-all-consolidated-ci.sh
```

Run the protected `cross-tool-promote` workflow from `luca/gate3-antigravity-runtime`. Require exact final `SYNCED`, then confirm GitHub `main` equals the promoted implementation commit.

That synchronized commit becomes task #1448's exact starting commit.

## Step 10: Provision and execute task #1448

On Windows:

1. fetch GitHub `main`;
2. move the clean `luca/gemini-experiment` worktree to the exact synchronized commit;
3. create the Antigravity-only 1Password item;
4. run preparation under `op run`;
5. inspect the generated task artifact and public bundle.

On Replit:

1. submit the challenge from the public bundle;
2. wait for founder approval;
3. register the runtime and profile from the same bundle.

On Windows:

1. start Antigravity under `op run`;
2. exchange bootstrap;
3. prove ownership;
4. execute the bounded task;
5. preserve immutable evidence.

From a separate Luca runtime hat:

1. inspect the exact assignment and envelope;
2. verify the diff and path bounds;
3. rerun the exact focused test;
4. confirm no secret or out-of-scope byte entered the patch;
5. record an immutable approve or reject decision.

Only after independent approval may an authorized publisher commit or publish the task output.

## Commit structure

1. Approved design correction and implementation plan.
2. Broker prehashed-registration behavior and tests.
3. Provisioning bundle, Windows preparation, and tests.
4. Two-phase operator provisioning and tests.
5. Broker-native ownership proof and Gate 3 ordering tests.
6. Runbook and handoff updates.
7. Review-driven corrections.
8. Protected-promotion evidence update.