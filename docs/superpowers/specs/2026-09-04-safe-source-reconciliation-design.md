# Safe Source Reconciliation Design

**Date:** September 4, 2026  
**Status:** Approved direction; written specification awaiting final review  
**Scope:** GitHub-to-Replit divergence preflight and isolated candidate construction

## Problem

HolaHola's source-control coordinator correctly refuses divergent histories. That
fail-closed boundary protected canonical records, but the exceptional
reconciliation on September 4 required repeated manual work:

- inventory both histories;
- identify files changed on both sides;
- distinguish generated snapshots from canonical records;
- prove that the incoming Episode 33 was already a subset of Replit's record;
- preserve independent append-only handoff sections;
- create and retain a recovery branch;
- temporarily hydrate missing partial-clone blobs;
- notice that GitHub advanced again while validation was running; and
- repeat post-merge and validation work against the new head.

The goal is not to make divergence silently mergeable. The goal is to automate
the evidence gathering and only construct an isolated candidate when every
special-path decision is mechanically proven safe.

## Considered approaches

### A. Read-only report only

Generate an exact reconciliation packet, but require an operator to create every
merge.

This is the lowest-risk change, but it leaves substantial repetitive work in the
path even when all conflicts have already been classified by explicit policy.

### B. Isolated candidate with a narrow safe-policy resolver — selected

Generate the packet, create a temporary candidate branch/worktree, and resolve
only conflict classes whose safety can be proven from immutable Git inputs and a
reviewed policy manifest. Never move `main` or push a remote.

This removes routine intervention while preserving the existing fail-closed
promotion boundary.

### C. General automatic divergent-history reconciliation

Automatically merge append-only documents, canonical records, generated
artifacts, migrations, and ordinary code, then promote on passing tests.

This has too many ambiguous authority and data-safety decisions for a first
version. It is explicitly out of scope.

## Safety invariants

1. `main` is never checked out, reset, merged, or advanced by reconciliation.
2. No remote ref is pushed, deleted, or force-updated.
3. V1 opens no database connection. It cannot read or write shared Neon.
4. Both local and remote inputs are exact immutable commit SHAs.
5. The remote is fetched before analysis and fetched again before candidate
   eligibility is reported.
6. A moved remote makes the candidate stale; it never causes an implicit retry
   against different bytes.
7. Every special path must match exactly one versioned policy.
8. An unclassified conflict, deletion, reorder, missing blob, policy overlap, or
   failed proof stops candidate construction.
9. Generated paths are not assumed disposable because of their names. Their
   authority and resolution behavior must be declared explicitly.
10. Canonical records are never resolved by generic `ours` or `theirs`.
11. All Git object hydration is read-only and uses the configured source remote;
    temporary transport overrides must be restored even after failure.
12. Candidate creation and promotion remain separate operations.

## Architecture

### 1. Versioned reconciliation policy manifest

Add a single version-controlled manifest under
`config/source-reconciliation-policies.json`.

Each entry contains:

- a unique policy ID;
- exact path or constrained glob;
- path kind;
- authority;
- allowed candidate resolution;
- proof requirements;
- optional deterministic regeneration command; and
- required focused validation checks.

Initial path kinds:

#### `generated-local`

The file is a generated projection whose authoritative state is rebuilt on
Replit. A conflict may keep the local bytes only when:

- the exact path is declared;
- local and remote input SHAs match the preflight packet;
- the policy explicitly says `keep-local-in-candidate`;
- the candidate report records the discarded remote blob SHA; and
- a declared regeneration/freshness check passes before eligibility.

The first policies cover:

- `docs/claude-code-to-luca.md`
- `docs/luca-to-claude-code.md`

If deterministic regeneration or freshness cannot be proven from the current
project tooling, the resolver stops instead of keeping local.

#### `canonical-incoming-subset`

The local file is a canonical or authoritative replica. A conflict may keep the
local bytes only when all of these pass:

- every stable incoming record ID is present exactly once locally;
- no incoming stable ID maps to different content locally;
- incoming record order is preserved locally;
- the incoming byte sequence is either an exact substring of local or each
  parsed stable record is byte-identical;
- local has no deletion relative to the declared canonical baseline; and
- the final candidate file is byte-identical to the local input blob.

The initial policy may cover only the current rolling episode path obtained from
a reviewed repository configuration. It must not use a broad
`docs/episode-*.md` auto-resolution rule.

#### `append-only-manual`

The file is append-only, but its entries do not yet have machine-stable IDs.
Preflight explains the disjoint sections, but candidate construction stops for
operator resolution.

The first policies cover:

- `docs/alden-agent-handoff.md`
- `docs/batch-doc-updates.md`

Automatic append-only interleaving is deferred until these formats have stable,
validated entry IDs.

#### `ordinary`

Ordinary source files use Git's normal three-way merge. A clean merge is
accepted in the candidate. A conflict stops unless another exact policy governs
the path.

### 2. Read-only preflight packet

Add a focused reconciliation service and expose it through the existing
source-control CLI:

```text
npm run source-control:reconcile -- preflight \
  --local-ref <full-sha> \
  --remote origin \
  --remote-branch main
```

The command refuses symbolic or omitted local input after resolving it. Its
packet contains:

- schema and manifest versions;
- exact local and fetched remote SHAs;
- merge base;
- commits unique to each side;
- changed paths on each side;
- changed-path intersection;
- blob SHAs and sizes;
- missing/promised object status;
- large-blob and LFS findings;
- matching special-path policy;
- policy overlap or uncovered-conflict failures;
- required recovery refs;
- expected candidate branch name;
- deterministic packet fingerprint; and
- reproduction command.

The JSON packet is written before candidate construction. A concise human report
is printed from the same object.

Preflight performs no checkout, branch update, working-tree write, database
operation, migration, or remote mutation.

### 3. Immutable local audit records

Reconciliation writes content-addressed records beneath:

```text
.local/reconciliation-audits/<fingerprint>/
```

Records are split rather than mutated:

- `preflight.json` — immutable inputs and analysis;
- `candidate-intent.json` — intended branch/worktree and allowed resolutions;
- `candidate-outcome.json` — final Git SHAs, resolutions, failures, and checks;
- `stale-remote.json` — present only when the second fetch changed the remote.

Each record includes its own SHA-256 digest envelope. Existing bytes may be
reread but never overwritten with different content.

These records are operational evidence and remain outside Git. The packet
fingerprint, not a random run ID, provides idempotency for identical inputs.

### 4. Isolated candidate builder

Candidate construction is a separate command:

```text
npm run source-control:reconcile -- candidate \
  --packet <path-to-preflight.json>
```

The builder:

1. acquires the existing source-control mutation lease;
2. verifies a clean primary worktree;
3. verifies the packet and manifest digests;
4. verifies both exact commit objects and required blobs;
5. creates a namespaced temporary worktree from the exact local SHA;
6. creates `reconcile/candidate-<fingerprint>`;
7. runs Git's ordinary three-way merge without committing;
8. classifies every conflict against exactly one manifest policy;
9. applies only proven `generated-local` or
   `canonical-incoming-subset` resolutions;
10. stops on every other conflict;
11. verifies the resulting index contains no unmerged entries;
12. creates a candidate merge commit with both exact parents;
13. writes the immutable candidate outcome; and
14. removes the temporary worktree while retaining the candidate branch.

Failure leaves `main` unchanged. A partially created candidate branch is either
absent or points to an auditable commit whose outcome is explicitly ineligible.

The builder is idempotent: the same packet either reproduces the same candidate
tree and commit metadata policy or reports a byte-level mismatch.

### 5. Candidate validation and remote stability

V1 candidate construction runs only side-effect-free checks needed to prove the
resolver:

- manifest validation;
- Git object and parent verification;
- no-unmerged-entry check;
- protected-path byte proofs;
- generated-path regeneration/freshness checks;
- TypeScript typecheck; and
- focused source-reconciliation tests.

Checks that may write to shared Neon are forbidden in this command. Broader
application eligibility uses the existing candidate validation system and, for
database-writing tests, a disposable Neon branch.

Immediately before reporting the candidate as eligible:

1. fetch the remote branch again into a dedicated temporary ref;
2. compare it with the packet's remote SHA;
3. if different, write `stale-remote.json`;
4. retain the candidate for evidence but mark it `stale_remote`; and
5. print the old SHA, new SHA, and exact command for a new preflight.

There is no automatic recursive merge against the new remote head.

### 6. Promotion boundary

Reconciliation does not promote.

The existing promotion path must independently require:

- exact candidate SHA;
- unexpired validation manifest;
- both expected merge parents;
- unchanged remote SHA;
- no failed or missing required checks; and
- explicit operator action.

Publishing Replit history to GitHub remains a separate decision and command.

## Failure reporting

Machine and human output distinguish at least:

- `safe_fast_forward` — no divergent candidate required;
- `candidate_ready`;
- `candidate_conflicts_manual`;
- `candidate_stale_remote`;
- `protected_path_proof_failed`;
- `generated_regeneration_failed`;
- `policy_overlap`;
- `unclassified_conflict`;
- `missing_git_object`;
- `history_incomplete`;
- `dirty_primary_worktree`;
- `lease_contended`; and
- `transport_failure`.

Each failure identifies the path, policy, expected proof, observed evidence, and
next safe action. No generic retry loop hides the reason.

## Testing

Focused tests use temporary Git repositories and no application database.

Required positive cases:

- identical inputs produce identical packet fingerprints;
- a clean ordinary merge creates an isolated candidate;
- a declared generated snapshot keeps local only when its freshness proof
  passes;
- a canonical incoming subset keeps the byte-identical local file;
- the candidate commit has the exact local and remote parents;
- `main` remains byte- and ref-identical; and
- a stable second remote fetch reports `candidate_ready`.

Required negative and mutation cases:

- omitted or moving local ref;
- dirty primary worktree;
- missing promised blob;
- overlapping manifest policies;
- unclassified conflict;
- canonical ID missing locally;
- duplicate canonical ID;
- same canonical ID with different content;
- reordered incoming canonical records;
- local canonical shrinkage;
- failed generated freshness/regeneration;
- append-only file without stable IDs;
- remote moving before eligibility;
- candidate code attempting any database access;
- attempted remote push/reset/force operation; and
- mutation of any resolver guard makes its corresponding self-check fail.

The test harness also proves temporary worktrees, refs, remotes, and transport
configuration are restored after failure.

## Delivery sequence

1. Add and validate the policy-manifest schema.
2. Implement Git-only preflight and deterministic packet fingerprinting.
3. Add immutable local audit writing.
4. Implement isolated ordinary candidate construction.
5. Add generated-local proof and resolution.
6. Add canonical-incoming-subset parser, proofs, and resolution.
7. Add second-fetch remote stability handling.
8. Connect side-effect-free focused validation.
9. Add status output and operational documentation.
10. Update the handoff and batch documentation.

## Deferred work

- Automatic append-only interleaving before stable entry IDs exist.
- Automatic promotion or movement of `main`.
- Automatic push to GitHub.
- Force push, rebase, history rewrite, or large-blob rewriting.
- Multi-remote or multi-branch reconciliation.
- Database-backed reconciliation policy.
- Production migration or data-operation execution.
- Broad `merge=ours` expansion.
- CI-triggered automatic reconciliation.

## Acceptance criteria

The feature is complete when an operator can run preflight against a deliberate
divergence and either:

1. receive an isolated, validated candidate whose only conflict resolutions are
   backed by explicit passing policy proofs; or
2. receive a precise fail-closed report identifying every manual decision.

In both outcomes, `main`, the remote, shared Neon, and canonical source records
remain unchanged.