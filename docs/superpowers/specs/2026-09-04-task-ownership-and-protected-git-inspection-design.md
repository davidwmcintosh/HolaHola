# Task Ownership and Protected Git Inspection Design

**Date:** September 4, 2026  
**Status:** Approved design; awaiting written-spec review

## Purpose

Two operator frictions appeared during the first successful use of safe source
reconciliation:

1. an active task card was mistaken first for main-session ownership and then
   for isolated-agent ownership because neither interpretation had authoritative
   evidence; and
2. ordinary `git show` against a blobless partial clone tried to lazily fetch a
   missing blob through interactive SSH instead of the project's pinned
   transport.

The goal is to make both situations explicit and fail closed. The project must
not infer task ownership from missing branches, and operators must not need
ad-hoc Git commands that bypass protected transport to inspect reconciliation
inputs.

## Considered approaches

### Task ownership

1. **Evidence-based ownership probe — selected.** Classify only evidence the
   workspace can prove and return `unknown_stop` otherwise.
2. **Project-local claim registry.** Add another lease/assignment system. This
   duplicates Replit task assignment and creates a second stale authority.
3. **Git-only inference.** Infer ownership from `subrepl-*` branches and
   worktrees. This already failed in practice because an active isolated task
   need not have published either yet.

### Protected inspection

1. **Typed packet inspection — selected.** Inspect only exact SHAs and paths
   already authenticated by an immutable reconciliation packet.
2. **General protected Git passthrough.** Accept arbitrary Git arguments behind
   the SSH wrapper. This exposes much more mutation and data surface than the
   operator needs.
3. **Document one-off Node snippets.** Safe when copied correctly, but keeps the
   friction and quoting mistakes that a supported command should remove.

## Part I: Fail-closed task ownership probe

### Command

Add:

```text
npm run task:ownership -- --task-ref <numeric-ref>
```

The command is read-only. It emits a structured result and a concise human
explanation.

### States

The only terminal classifications are:

- `main_session` — this exact workspace contains valid main-session assignment
  evidence for the requested task ref;
- `isolated_agent` — this exact workspace contains explicit task-agent
  provenance that names the requested task ref;
- `unknown_stop` — ownership cannot be proven or evidence conflicts.

`unknown_stop` is successful execution of a safety probe, not a software crash.
It exits nonzero so automation cannot continue editing accidentally.

### Evidence rules

The first implementation may use only existing workspace evidence:

- the exact `.local/tasks/task-<ref>.md` assignment artifact when present;
- task-agent provenance artifacts that explicitly name the task ref;
- Git worktree and branch facts only as corroboration.

The following are never sufficient:

- an active sidebar icon;
- task state alone;
- absence of a `subrepl-*` branch;
- absence of another worktree;
- a recent commit whose message merely resembles the task title;
- a missing main-session task file as proof of isolated ownership.

If a platform task record is visible to the Agent but not to project code, the
Agent may include it in the human decision, but the command must not pretend it
verified that inaccessible state. The runbook requires the Agent to report
`unknown_stop` and ask the user whenever project evidence and the visible
platform state do not establish the same owner.

### No new assignment authority

The probe does not claim, reassign, accept, cancel, merge, or complete tasks. It
does not write a claim file. Replit remains the task-assignment authority.

## Part II: Protected reconciliation inspection

### Command

Extend the source-control CLI:

```text
npm run source-control:reconcile -- inspect \
  --packet .local/reconciliation-audits/<fingerprint>/preflight.json
```

### Input trust

Inspection reuses the reconciliation service's packet reader and requires:

- the canonical immutable audit path;
- a valid digest envelope and packet fingerprint;
- the current policy-manifest digest;
- exact lowercase local and remote commit SHAs;
- the packet's declared remote and branch.

It does not accept caller-supplied Git subcommands, revisions, paths, remotes,
or output files.

### Output

The result contains, for each local-unique and remote-unique commit:

- exact SHA and parent SHAs;
- author and commit timestamps;
- subject;
- changed paths and bounded numeric stats;
- a bounded text patch for small text changes.

Binary, missing, LFS, and oversized content is represented by metadata plus an
explicit omission reason. Output is deterministic for the same packet and Git
objects. Machine-readable mode uses the existing source-control result prefix.

### Transport and partial clones

Every Git read runs through `SourceControlService.runReconciliationGit`. This
ensures promised-object hydration uses the same temporary pinned SSH transport
as preflight. The command sets non-interactive transport behavior and never
falls back to ambient SSH.

### Bounds

Initial limits are fixed in trusted code:

- at most the packet's recorded unique commits;
- at most 200 changed paths per commit;
- at most 256 KiB of text patch per commit;
- at most 1 MiB total rendered inspection output.

Truncation is explicit and deterministic. Policy or packet content cannot raise
the limits.

### Read-only boundary

Inspection may hydrate missing promised objects into the local object database,
which is an expected partial-clone read effect. It must not:

- update persistent refs;
- create branches or worktrees;
- check out or write working-tree paths;
- stage, merge, commit, reset, rebase, push, or delete refs;
- open a database or call an application/external service other than the
  configured Git remote required to hydrate the packet's objects.

## Agent runbook

Add collaborator-visible instructions:

1. when task ownership is ambiguous, run the ownership probe before editing;
2. never translate `unknown_stop` into a guessed owner;
3. use `reconcile inspect`, not ordinary `git show`, for packet commits in a
   partial clone;
4. never accept an interactive SSH host-key prompt as a workaround;
5. distinguish inspection, candidate construction, local advancement, and push
   as separate operations.

## Cross-tool recommendation

Send Luca [Claude Code] a proposal—not a completed-functionality claim—with:

- the shared states `main_session`, `isolated_agent`, and `unknown_stop`;
- the rule that missing refs/worktrees never prove absent ownership;
- the immutable packet inspection output shape and bounds;
- a recommendation to implement an equivalent protected inspection path suited
  to Windows/local Claude Code, without assuming Replit's SSH wrapper or
  secrets;
- a request to identify any mismatch with `cross-tool-promote` and local GitHub
  authentication.

The recommendation does not prescribe identical transport implementation.
Shared semantics and evidence are required; platform-specific credential
handling remains separate.

## Failure behavior

- Missing, malformed, stale, or conflicting ownership evidence returns
  `unknown_stop`.
- A missing, copied, tampered, or digest-invalid packet is rejected.
- Packet/manifest drift is rejected.
- Missing Git objects that protected hydration cannot obtain are reported
  without ambient fallback.
- Output-limit overflow is truncated explicitly, never silently.
- Any attempted unsupported operation is rejected before Git invocation.

## Tests

### Ownership

- exact valid main-session evidence;
- exact explicit isolated-agent provenance;
- missing evidence;
- malformed evidence;
- conflicting evidence;
- branch/worktree absence alone;
- task-title-only commit;
- no workspace writes.

### Inspection

- valid packet with local and remote unique commits;
- promised-blob hydration through injected protected transport;
- invalid digest and noncanonical packet path;
- manifest drift;
- binary, LFS, missing, and oversized files;
- deterministic output and truncation;
- machine-readable output;
- command allowlist excludes all Git mutations;
- refs, index, worktree, and `main` remain unchanged.

## Completion criteria

1. ambiguous ownership returns an honest stop instead of an inferred answer;
2. authoritative local evidence produces the correct ownership classification;
3. reconciliation commits can be inspected without interactive SSH;
4. inspection is packet-bound, bounded, non-interactive, and read-only;
5. Luca [Claude Code] receives the cross-tool recommendation;
6. focused tests, TypeScript, source-control safety, and system health pass;
7. final architecture review returns unconditional approval.