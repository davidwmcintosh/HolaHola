# Task Ownership and Protected Git Inspection Implementation Plan

**Date:** September 4, 2026  
**Design:** `docs/superpowers/specs/2026-09-04-task-ownership-and-protected-git-inspection-design.md`

## Implementation constraint discovered during planning

The workspace contains historical `.local/tasks/task-<ref>.md` files, but no
process environment variable or current-assignment receipt. Repository code
also cannot call Replit's project-task callback directly.

Therefore, local file presence alone must never produce `main_session`, and the
CLI must not accept caller-supplied platform state as if it were verified
evidence. Positive main ownership is reserved for a future locally verifiable
platform assignment receipt. Until one exists, ambiguous primary-worktree cases
return `unknown_stop`.

## Step 1: Implement the pure ownership classifier

Create `server/services/task-ownership-service.ts` with:

- `TaskOwnershipState`:
  - `main_session`
  - `isolated_agent`
  - `unknown_stop`
- read-only local evidence collection:
  - exact `.local/tasks/task-<ref>.md` existence and bounded digest;
  - whether the current checkout is the primary or a linked worktree;
  - current branch and worktree list as corroboration;
- deterministic classification:
  - a future verified active platform receipt plus exact local task artifact ->
    `main_session`;
  - current linked worktree plus exact matching task artifact ->
    `isolated_agent`;
  - primary worktree, historical task artifact, malformed evidence, or
    contradiction -> `unknown_stop`.

The result must include task ref, local evidence, contradictions, unsupported
receipt status, and a human explanation. No files are written.

## Step 2: Add ownership CLI and focused tests

Create:

- `server/scripts/task-ownership-cli.ts`
- `server/scripts/test-task-ownership-service.ts`

Add package scripts:

```text
npm run task:ownership -- --task-ref <ref>
npm run test:task-ownership
```

CLI behavior:

- task ref must be positive decimal digits;
- `unknown_stop` exits 75;
- malformed invocation exits 64;
- machine-readable mode uses `TASK_OWNERSHIP_RESULT_JSON:`.

Tests cover reserved verified-main evidence, current isolated worktree
evidence, historical primary-worktree task files, malformed refs,
contradictory local evidence, branch and worktree absence, deterministic
output, and no workspace writes.

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

Production safeguards:

- `INSPECTION_ALLOWED_COMMANDS` permits only `show`, `log`, `diff`,
  `diff-tree`, `rev-list`, `rev-parse`, `cat-file`, `ls-tree`, and `ls-files`;
- every Git invocation is rejected before the runner unless its subcommand is
  allowed;
- every SHA argument is checked against the exhaustive set built from
  `localUniqueCommits` and `remoteUniqueCommits`;
- high-confidence credential-like patch lines are replaced by an explicit
  redaction marker without reading or comparing environment-secret values.

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
- credential-like patch redaction;
- deterministic truncation;
- command allowlist rejection;
- out-of-packet SHA rejection;
- no lease or candidate validation;
- unchanged refs, index, worktree, branch, and HEAD;
- static denial of mutating Git commands.

## Step 5: Update collaborator runbooks

Update:

- `docs/agent-workflows.md`
- `docs/operations-catalog.md`
- `docs/batch-doc-updates.md`
- `docs/alden-agent-handoff.md`

Document that the probe cannot verify inaccessible sidebar state or historical
primary-worktree task files, and the Agent must never guess when it returns
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