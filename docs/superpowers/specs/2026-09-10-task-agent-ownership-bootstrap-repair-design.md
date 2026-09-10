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

## Phase 2: Authenticated Assignment Receipt

Phase 2 proceeds only if Phase 1 proves a suitable platform identity or
assignment signal.

An immutable assignment receipt is stored in the existing coordination ledger.
The receipt binds:

- task reference;
- exact task-artifact SHA-256 digest;
- intended actor;
- isolated environment identity;
- issuance and expiry timestamps;
- receipt identifier and version;
- issuer identity and authentication evidence;
- revocation state, when applicable.

The ownership CLI validates the receipt through a read-only project endpoint.
The endpoint verifies the durable ledger record and compares every bound field
with the current request. The probe does not create, renew, revoke, or consume
assignment authority.

The classifier may return `isolated_agent` only when:

1. the exact task artifact is present and valid;
2. the authenticated receipt names the same task and artifact digest;
3. the receipt names the current isolated environment and intended actor;
4. the receipt is active and unexpired;
5. no verified main-session receipt or other contradictory evidence exists.

Git checkout kind remains in the evidence record but cannot independently
authorize or reject an otherwise valid isolated assignment.

## Stop Condition

If Phase 1 finds no platform-provided identity or assignment signal that the
main checkout cannot forge, implementation stops after the diagnostic.

The project must not replace missing platform authority with:

- task state visible only in chat;
- branch naming;
- a normal-versus-linked `.git` distinction;
- the task artifact alone;
- a project-generated workspace nonce available to both copies;
- an operator flag that any agent could invoke.

In that case, safe completion requires Replit to expose verifiable assignment
evidence. Until then, ambiguous environments continue to return `unknown_stop`.

## Compatibility

Existing positive main-session receipts remain valid only in the real primary
checkout. Existing linked-worktree evidence may remain supported as a legacy
path when it is corroborated by an authenticated isolated assignment receipt;
it is no longer sufficient by itself.

No task lifecycle, assignment, cancellation, merge, credential, or publication
authority moves into the ownership probe.

## Failure Handling

- Unavailable receipt endpoint: `unknown_stop`.
- Missing or malformed receipt: `unknown_stop`.
- Wrong task, actor, environment, or artifact digest: `unknown_stop`.
- Expired or revoked receipt: `unknown_stop`.
- Main and isolated evidence both present: `unknown_stop` with contradiction.
- Platform identity changed during the task: `unknown_stop`; no silent rebinding.

Errors must distinguish unavailable evidence from contradictory evidence while
remaining nonzero for automation.

## Verification

Phase 1 must produce a sanitized evidence report from a real task-agent copy and
the main Repl.

If Phase 2 is possible, tests must prove:

- isolated copy with the matching authenticated receipt returns
  `isolated_agent`;
- the real main checkout with a historical task artifact returns
  `unknown_stop`;
- a receipt copied from another environment returns `unknown_stop`;
- wrong task reference or artifact digest returns `unknown_stop`;
- expired, revoked, malformed, and replayed receipts return `unknown_stop`;
- conflicting main and isolated receipts return `unknown_stop`;
- Git checkout shape alone cannot authorize isolated ownership;
- the probe and verifier perform no workspace or task-state writes.

The repair is complete only after a newly launched bounded Gemini-runtime task
passes the ownership probe in its real isolated environment before making any
edit.
