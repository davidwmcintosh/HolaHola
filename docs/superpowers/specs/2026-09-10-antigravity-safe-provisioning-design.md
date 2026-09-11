# Antigravity Safe Provisioning Design

**Date:** 2026-09-10  
**Status:** Approved design
**Scope:** Gate 3 provisioning for task #1448

## 1. Purpose

Provision `luca-gemini-antigravity-primary` on the operator-approved Windows worktree without placing a fixed Luca credential on that host and without exposing a bootstrap or broker credential through chat, stdout, command arguments, logs, repository files, `.env` files, or evidence receipts.

The operator remains the trust root. PostgreSQL remains canonical. The runtime label records provenance and capabilities; it does not create a separate identity or trust rank.

## 2. Current gap

The existing ownership CLI combines three actions:

1. reading and hashing the local task artifact;
2. generating the local ownership key;
3. submitting the challenge with a fixed actor credential.

The existing runtime-registration CLI generates a one-time bootstrap on the server and prints it to stdout.

Those paths cannot satisfy Gate 3 because the Windows execution host must not receive `COORDINATION_LUCA_GEMINI_CODE_TOKEN`, and the bootstrap must not pass through terminal output or manual copy.

The approved Windows worktree is:

- path: `C:\Users\David\HolaHola-antigravity`;
- branch: `luca/gemini-experiment`;
- pre-provisioning baseline: `5a2fbbf813597b93ffc03fbf2fd9977f4915e17f`.

The exact execution starting commit is the GitHub `main` commit produced by the
protected promotion of this safe-provisioning implementation. The worktree must
be clean at that exact final commit before preparation begins. The task
artifact, public provisioning bundle, coding-runtime profile, and execution
envelope all bind that same SHA.

## 3. Chosen approach

The bootstrap originates inside the Antigravity runtime's dedicated 1Password item. Windows reads it only through 1Password process injection. A preparation command computes its digest in memory and emits only non-secret provisioning material.

The public provisioning bundle contains:

- runtime ID;
- actor;
- requested capability allowlist;
- token TTL;
- task ref;
- task-artifact SHA-256;
- ownership public key;
- ownership-key fingerprint;
- bootstrap SHA-256;
- worktree realpath digest;
- branch;
- starting commit;
- provider, model, and adapter version;
- a canonical bundle digest.

The bundle never contains the bootstrap, an access token, a fixed actor token, or the ownership private key.

Replit uses existing server-side authority to submit the ownership challenge and register the runtime from the reviewed public bundle. The broker stores the supplied bootstrap digest exactly as the verifier for the future one-time exchange; it does not receive or recover the plaintext bootstrap during registration.

## 4. Authority and ordering

The required sequence is:

1. Complete protected promotion of the safe-provisioning implementation and record the exact synchronized GitHub `main` commit.
2. Fast-forward the clean Windows worktree to that required starting commit.
3. Create and review the exact task #1448 artifact in `.local/tasks/task-1448.md`, substituting that final commit into the approved local template.
4. Generate or reuse task #1448's local ownership key in that worktree.
5. Create the bootstrap in the runtime-specific 1Password item.
6. Run the Windows preparation command under 1Password injection and export only the public provisioning bundle.
7. Replit validates the bundle and submits the ownership challenge.
8. The founder approves the challenge, including the exact task digest, actor, and ownership-key binding.
9. Replit registers the runtime with the bootstrap digest and creates its coding-runtime profile from the same reviewed bundle.
10. Antigravity starts under 1Password injection and exchanges the original bootstrap for a short-lived broker credential.
11. Antigravity signs the server nonce with the Windows-held ownership private key and proves the active founder-approved receipt.
12. Only after proof succeeds may the runtime fetch, consume, claim, or execute task #1448.

Challenge approval precedes runtime registration in the operator flow. Cryptographic ownership proof follows short-lived credential exchange because the proof endpoint itself requires authenticated actor provenance. Proof still precedes every work-authorizing action.

Runtime registration alone grants no task authority. Founder approval alone grants no execution authority. Both the broker credential and fresh ownership proof are required.

## 5. Bootstrap digest rules

The Windows preparation command must validate the injected bootstrap before hashing it:

- it must use the broker bootstrap format and minimum entropy already required by the broker;
- it must never print, serialize, persist, or include the value in an exception;
- it must clear its in-process reference after computing the digest as far as the runtime permits;
- it must emit lowercase SHA-256 only.

The registration path accepts a digest only from the trusted operator-side provisioning command. The public runtime exchange endpoint continues to accept plaintext bootstrap input only through its protected header and hashes that input before comparison.

A caller that submits the stored digest as though it were the bootstrap produces `SHA256(digest)`, not the stored `SHA256(bootstrap)`, and must fail. No endpoint may accept the digest as an exchange credential.

## 6. Task artifact authority

Task #1448's local artifact is part of the founder-approved authorization, not an informal convenience file.

The artifact must state:

- the exact bounded objective;
- allowed and forbidden paths;
- the exact starting commit and branch;
- the maximum one changed file and 40 KiB patch;
- the ten-minute wall-clock, four logical model-turn, and eight API-attempt limits;
- the allowed read-only Git commands, one declared write target, and exact focused test command;
- no commit, publish, deployment, shared-database mutation, secret access, or undeclared network use;
- independent cross-hat verification requirements.

The ownership challenge binds the artifact digest, task ref, `luca-gemini` actor, public key, and key fingerprint. Any artifact-byte change requires a new challenge and founder decision.

## 7. Components

### 7.1 Windows preparation command

A non-network preparation mode:

- verifies the worktree path, clean state, branch, and starting commit;
- reads and hashes the local task artifact;
- creates or loads the task-scoped ownership key;
- reads the bootstrap only from the injected environment;
- validates and hashes the bootstrap;
- emits the public provisioning bundle and nothing secret.

It fails closed before emitting a bundle if any invariant is wrong.

### 7.2 Operator registration command

A Replit-side command:

- reads a public bundle from a file or standard input;
- validates its schema and canonical digest;
- requires the exact approved runtime ID, actor, capabilities, branch, starting commit, provider, model, and adapter version;
- submits the task-ownership challenge with server-held actor authority;
- registers the broker runtime using the supplied bootstrap digest;
- creates the coding-runtime profile;
- reports only non-secret IDs, digests, and statuses.

It must not accept a plaintext bootstrap.

The operation must be retry-safe. Duplicate calls with the identical bundle return the existing compatible records. A conflicting runtime registration, challenge, or profile fails closed.

### 7.3 Broker registration service

Add an operator-only registration variant that accepts a validated bootstrap digest. It shares the existing registration invariants for actor, capability allowlist, TTL, runtime uniqueness, audit, and revocation.

The existing server-generated bootstrap path remains available for already-approved operator workflows but is not used by Gate 3.

### 7.4 Broker-backed ownership client

The Antigravity ownership proof path authenticates with the short-lived broker access credential. It must not require or fall back to a fixed actor token.

Legacy fixed-token compatibility may remain for other established callers, but the Gate 3 driver must fail if the fixed Gemini token is present on the execution host.

## 8. Failure behavior

Provisioning and execution fail closed when:

- the worktree is dirty, on the wrong branch, or at the wrong commit;
- the task artifact is missing, not a regular file, or changes after preparation;
- the bootstrap is missing, malformed, or below the required entropy;
- the public bundle digest is invalid;
- actor, runtime ID, capabilities, provider, model, or adapter version differ from the approved values;
- an existing registration or profile conflicts with the bundle;
- the founder receipt is missing, rejected, revoked, expired, or bound to different bytes or key material;
- bootstrap exchange fails or is replayed;
- ownership proof is absent or signed by a different key;
- a fixed Gemini actor token is present on the Windows host;
- any execution-envelope limit or command/path policy is violated.

Failures may record non-secret status and audit evidence. They must not include credential values or secret-bearing request headers.

## 9. Verification

Hermetic coverage must prove:

1. Windows preparation emits the expected public bundle and no secret value.
2. Wrong branch, wrong commit, dirty worktree, missing artifact, malformed bootstrap, and mismatched key fingerprint fail.
3. Hash-based registration creates a broker registration that the original bootstrap can exchange exactly once.
4. Supplying the bootstrap digest to the exchange endpoint fails.
5. Duplicate identical provisioning is retry-safe; conflicting provisioning fails.
6. Broker credentials can submit the ownership proof without a fixed actor token.
7. A fixed Gemini actor token on the execution host causes Gate 3 startup to fail.
8. Expired prior receipts cannot authorize the task.
9. No inbox fetch, consumption receipt, execution claim, model call, write, or command occurs before ownership proof.
10. Existing broker registration, renewal, revocation, rotation, and fixed-token compatibility tests remain green.

Before publication, run focused tests, the disposable PostgreSQL coordination suite, TypeScript, system health, and the protected promotion workflow. The protected workflow must finish with exact `SYNCED`.

## 10. Non-goals

This change does not:

- claim adversarial Windows host containment;
- add a new canonical actor;
- treat runtime labels as separate identities or trust levels;
- replace PostgreSQL authority;
- grant publication, deployment, database, policy, observation, or administrative capability;
- put 1Password service-account credentials in Replit;
- create a general secret-distribution system;
- weaken the independent cross-hat verification requirement;
- complete or publish task #1448 merely because provisioning succeeds.