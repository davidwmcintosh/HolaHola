# Task Ownership and Protected Git Inspection Implementation Plan

**Date:** September 4, 2026  
**Design:** `docs/superpowers/specs/2026-09-04-task-ownership-and-protected-git-inspection-design.md`

## Implementation constraint discovered during planning

The workspace contains historical `.local/tasks/task-<ref>.md` files, but no
process environment variable or current-assignment receipt. Repository code
also cannot call Replit's project-task callback directly.

Therefore, local file presence alone must never produce `main_session`. The
Agent workflow must first read the exact task through Replit's project-task
interface and pass its canonical state to the read-only probe. The probe labels
that value as caller-supplied platform evidence and cross-checks it against
workspace evidence. If the state is omitted, malformed, not active, or
contradictory, the result is `unknown_stop`.

## Step 1: Implement the pure ownership classifier

Create `server/services/task-ownership-service.ts` with:

- `TaskOwnershipState`:
  - `main_session`
  - `isolated_agent`
  - `unknown_stop`
- exact active platform-state parsing:
  - `MAIN_PENDING`, `MAIN_IN_PROGRESS`, `MAIN_IMPLEMENTED`
  - `PENDING`, `IN_PROGRESS`, `IMPLEMENTED`, `MERGING`, `QUEUED`
- read-only local evidence collection:
  - exact `.local/tasks/task-<ref>.md` existence and bounded digest;
  - current branch;
  - worktree list;
  - exact task-ref occurrences in explicit task-agent provenance files, if a
    supported provenance location is found;
- deterministic classification:
  - active `MAIN_*` plus exact local task artifact -> `main_session`;
  - active isolated state plus explicit matching isolated provenance ->
    `isolated_agent`;
  - active isolated state without local provenance may still report
    `isolated_agent` because the platform state itself distinguishes isolated
    execution, while clearly marking local corroboration absent;
  - missing platform state, historical/non-active state, malformed evidence,
    or contradiction -> `unknown_stop`.

The result must include task ref, platform state and source label, local
evidence, contradictions, and a human explanation. No files are written.

## Step 2: Add ownership CLI and focused tests

Create:

- `server/scripts/task-ownership-cli.ts`
- `server/scripts/test-task-ownership-service.ts`

Add package scripts:

```text
npm run task:ownership -- --task-ref <ref> --platform-state <canonical-state>
npm run test:task-ownership
```

CLI behavior:

- task ref must be positive decimal digits;
- canonical platform state is required for a positive ownership result;
- `unknown_stop` exits 75;
- malformed invocation exits 64;
- machine-readable mode uses `TASK_OWNERSHIP_RESULT_JSON:`.

Tests cover valid main evidence, isolated platform state, omitted state,
historical state, malformed ref/state, contradictory local evidence, branch and
worktree absence, deterministic output, and no workspace writes.

## Step 3: Implement packet-bound reconciliation inspection

Extend `server/services/source-reconciliation-service.ts` with an `inspect`
method and narrow inspection result types.

The method:

1. reads the packet through the existing canonical `readPacket` guard;
2. rechecks the policy-manifest digest;
3. verifies the exact packet commits are still available;
4. inspects only `localUniqueCommits` and `remoteUniqueCommits`;
5. invokes a fixed allowlist of Git reads through the injected protected
   reconciliation runner;
6. parses commit headers, parents, paths, numeric stats, and bounded patches;
7. represents binary, LFS, missing, and truncated content explicitly;
8. returns deterministic structured output;
9. does not acquire the mutation lease, write audit files, create refs or
   worktrees, or run candidate validation.

Trusted limits:

- 200 paths per commit;
- 256 KiB patch per commit;
- 1 MiB aggregate serialized output.

## Step 4: Wire inspection CLI and extend reconciliation tests

Update `server/scripts/source-control-cli.ts`:

```text
npm run source-control:reconcile -- inspect --packet <canonical-preflight>
```

Extend `server/scripts/test-source-reconciliation-service.ts` to cover:

- valid divergent packet inspection;
- copied/tampered packet rejection;
- manifest drift;
- injected protected runner use;
- promised-object hydration failure;
- binary and oversized omission;
- deterministic truncation;
- no lease or candidate validation;
- unchanged refs, index, worktree, branch, and HEAD;
- static denial of mutating Git commands.

## Step 5: Update collaborator runbooks

Update:

- `docs/agent-workflows.md`
- `docs/operations-catalog.md`
- `docs/batch-doc-updates.md`
- `docs/alden-agent-handoff.md`

Document that the Agent must query the exact task state first, pass the
canonical state to the probe, and never guess when the result is
`unknown_stop`. Document `reconcile inspect` as the only supported packet-commit
inspection path in a partial clone.

## Step 6: Cross-tool review

Read Luca [Claude Code]'s response if it arrives. Incorporate compatible
semantic or Windows-authentication feedback without copying Replit-specific
credentials or transport implementation.

## Step 7: Validate and review

Run:

```text
npm run test:task-ownership
npm run test:source-reconciliation
npm run test:source-bridge
npm run typecheck
npx tsx server/scripts/verify-system-health.ts
```

Then send the actual implementation and test evidence to Alden for final
dual-engine review. Iterate until the architectural review is unconditional.

## Commit structure

1. Implementation plan.
2. Ownership probe, tests, and package scripts.
3. Protected inspection, tests, and CLI wiring.
4. Runbook and handoff documentation.
5. Any review-driven corrections.