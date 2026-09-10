# Task-Agent Ownership Bootstrap Repair

**Status:** Approved design pending written-spec review  
**Owner:** Luca [Replit]  
**Date:** 2026-09-10

## Problem

The task ownership probe currently treats a linked Git worktree as proof that a
matching task artifact belongs to an isolated task agent. Replit guarantees that
task agents work in isolated project copies, but it does not guarantee that
those copies use Git linked-worktree metadata. A valid isolated task copy may
therefore contain a normal `.git` directory and be misclassified as the primary
worktree.

The probe must not solve this by trusting `.local/tasks/task-<ref>.md` alone.
Historical task artifacts can remain in the real primary checkout, so the task
file proves task-to-work correspondence but not active ownership.

## Invariants

1. Replit remains the task-assignment authority.
2. The project may verify assignment evidence but must not manufacture a new
   assignment.
3. Historical task files in the real primary checkout never authorize work.
4. Git checkout shape is corroborating evidence, not durable actor identity.
5. Missing, expired, mismatched, replayed, or contradictory evidence returns
   `unknown_stop`.
6. Ownership evidence gathering is read-only and may run before authorization.
7. No implementation may depend on an undocumented platform signal without
   first observing that signal in a real isolated task environment.

## Phase 1: Read-Only Environment Diagnostic

Launch a minimal task agent whose only purpose is to report ownership evidence.
It must not edit source files, install packages, change configuration, claim
another task, or create a Git worktree.

The diagnostic records:

- whether `.git` is a directory, linked-worktree file, absent, or malformed;
- the exact task artifact path, size, and SHA-256 digest;
- names, but not secret values, of task- or agent-related environment variables;
- non-secret stable Repl, workspace, or environment identifiers exposed by the
  platform;
- the corresponding identifiers observed in the main Repl for comparison.

Secret values, credentials, tokens, cookies, and private environment contents
must never be printed or persisted.

The diagnostic result is evidence, not authority. Its purpose is to determine
whether Replit exposes a stable task-agent-specific identifier that the real
main checkout cannot present.

## Phase 2: Founder-Attested Assignment Receipt

Phase 1 proved that Replit exposes no task-specific identity to project code.
The founder therefore supplies the missing authority bridge explicitly.

### Challenge creation

The requesting process generates an Ed25519 keypair. The private key is written
mode `0600` under `/tmp`, never inside the workspace, database, logs, or chat.
The process submits:

- task reference;
- exact task-artifact SHA-256 digest;
- intended actor;
- public key and fingerprint;
- a server-issued cryptographically random nonce;
- an optional workspace-context digest shown only as corroborating context.

Challenge creation grants no ownership. Pending challenges expire quickly and
cannot be renewed or approved more than once.

### Founder approval

A founder-authenticated browser UI lists pending challenges and displays the
task reference, task title when available, artifact digest, public-key
fingerprint, creation/expiry times, and workspace context.

The UI states the exact boundary: the founder is authorizing the process holding
this private key to perform the named task. This does not independently prove
that Replit provisioned a particular sandbox.

Only an authenticated founder browser session may approve, reject, or revoke.
Coordination tokens, runtime credentials, API keys shared with task copies, and
task agents themselves cannot exercise founder approval authority.

### Receipt and proof

Approval creates one immutable receipt linked by a foreign key to exactly one
challenge. The receipt binds:

- challenge ID and receipt ID;
- task reference and task-artifact digest;
- intended actor and public key;
- approval identity and timestamp;
- issuance and expiry timestamps;
- receipt version and canonical payload digest.

Only one live receipt may exist per task. Approving a replacement atomically
revokes the prior active receipt and records immutable revocation evidence.
Receipts have a short bounded lifetime and cannot renew silently.

For each ownership proof, the server issues a fresh one-time nonce. The process
signs canonical bytes containing the nonce and every receipt-bound field. The
verifier checks the signature, canonical payload digest, challenge-to-receipt
foreign key, task artifact, actor, expiry, revocation, and contradictory main
evidence. Successful verification atomically consumes the nonce and records an
immutable attempt result.

The private key proves continuity of the exact process the founder authorized.
Copying a receipt without the private key grants nothing. Losing `/tmp` state
through restart or reprovisioning fails closed and requires a new founder
approval.

### Classifier rule

The classifier may return `isolated_agent` only when:

1. the exact task artifact is present and valid;
2. an active founder-approved receipt names the same task, artifact, actor, and
   public key;
3. the requester proves possession with a fresh one-time nonce;
4. the receipt is active and unexpired;
5. no verified main-session receipt or other contradictory evidence exists.

Git checkout kind and workspace-context digests remain evidence but cannot
independently authorize or reject a valid founder-attested assignment.

## Security Boundary

The founder-attested receipt proves that the human founder authorized the
process holding a particular private key for one task. It does not independently
attest to Replit's sandbox provisioning. Replit continues to provide task-copy
isolation; the founder approval bridges the task UI and the project verifier.

The project must not replace missing platform authority with:

- task state visible only in chat;
- branch naming;
- a normal-versus-linked `.git` distinction;
- the task artifact alone;
- a project-generated workspace nonce without founder approval and key proof;
- an operator flag that any agent could invoke.

## Compatibility

Existing positive main-session receipts remain valid only in the real primary
checkout. Existing linked-worktree evidence remains corroborating context but is
no longer sufficient by itself.

No task lifecycle, assignment, cancellation, merge, credential, or publication
authority moves into the ownership probe.

## Failure Handling

- Unavailable receipt endpoint: `unknown_stop`.
- Missing or malformed challenge, receipt, nonce, or signature: `unknown_stop`.
- Wrong task, actor, public key, or artifact digest: `unknown_stop`.
- Expired or revoked receipt: `unknown_stop`.
- Main and isolated evidence both present: `unknown_stop` with contradiction.
- Consumed, replayed, or mismatched nonce: `unknown_stop`.
- Lost private key: `unknown_stop`; no silent rebinding.

Errors must distinguish unavailable evidence from contradictory evidence while
remaining nonzero for automation.

## Verification

Phase 1 produced sanitized evidence from the main Repl and two real task-agent
copies. Both task copies appeared as primary Git worktrees and exposed no
task-specific platform identity.

Phase 2 tests must prove:

- founder-approved process with matching key proof returns `isolated_agent`;
- the real main checkout with a historical task artifact returns
  `unknown_stop`;
- a copied receipt without its private key returns `unknown_stop`;
- wrong task reference, artifact digest, public key, or actor returns
  `unknown_stop`;
- expired, revoked, malformed, and replayed receipts or nonces return
  `unknown_stop`;
- one challenge cannot create two receipts;
- only one active receipt may exist per task;
- replacement approval revokes the prior receipt atomically;
- coordination tokens and task credentials cannot approve, reject, or revoke;
- conflicting main and isolated receipts return `unknown_stop`;
- Git checkout shape alone cannot authorize isolated ownership;
- private keys never enter the workspace, database, logs, or API responses;
- proof attempts and founder decisions are immutable and idempotent;
- the probe does not write workspace or task-state data.

The repair is complete only after a newly launched bounded Gemini-runtime task
passes the ownership probe before its first edit and again before completion.
