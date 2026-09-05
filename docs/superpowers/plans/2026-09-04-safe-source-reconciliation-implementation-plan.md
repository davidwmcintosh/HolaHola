# Implementation Plan: Safe Source Reconciliation

**Status:** Completed September 4, 2026

## Delivery boundary

V1 adds two explicit Git-only operations:

1. `preflight` fetches one configured remote branch, resolves exact local and
   remote commit SHAs, classifies divergent paths against a versioned policy
   manifest, and writes an immutable evidence packet.
2. `candidate` verifies that packet, acquires the shared source-control lease,
   constructs a merge in an isolated worktree, applies only mechanically proven
   resolutions, validates the resulting commit, and refetches the remote before
   reporting eligibility.

Neither operation moves `main`, pushes a remote, opens a database connection,
or invokes the existing promotion path.

## Ordered implementation steps

1. **Add the versioned policy manifest**
   - Create `config/source-reconciliation-policies.json`.
   - Declare exact policies for the two generated mailbox snapshots, Episode 33,
     and the two append-only manual documents.
   - Validate schema version, unique IDs, exact-path normalization, allowed
     kind/authority/resolution combinations, proof declarations, and overlaps.
   - Treat unsupported globs and missing paths as errors in V1.

2. **Build deterministic packet and audit primitives**
   - Add canonical JSON serialization with recursively sorted object keys.
   - Hash packet inputs without timestamps or output paths so identical Git and
     policy inputs produce the same fingerprint.
   - Write digest-enveloped audit records beneath
     `.local/reconciliation-audits/<fingerprint>/` using exclusive creation.
   - Permit byte-identical replay and reject any attempted overwrite with
     different bytes.

3. **Implement Git-only preflight**
   - Require a lowercase 40-character local commit SHA.
   - Fetch the configured remote/branch into a dedicated temporary ref.
   - Resolve the remote SHA, merge base, unique commits, changed paths, path
     intersections, blob IDs/sizes, missing objects, and LFS/large-blob facts.
   - Match each relevant path against exactly one policy and report overlaps.
   - Record expected candidate branch, recovery ref, reproduction command, and
     fail-closed findings.
   - Perform no checkout, worktree creation, branch movement, merge, or database
     operation.

4. **Implement isolated candidate construction**
   - Reuse the existing source-control lock through a narrow public lease API.
   - Verify the primary worktree is clean and still at the packet’s local SHA.
   - Verify the packet envelope, manifest digest, commit objects, and required
     blobs before mutation.
   - Create a temporary detached worktree at the exact local SHA and a
     namespaced candidate branch.
   - Run `git merge --no-commit --no-ff` against the exact remote SHA.
   - Keep clean ordinary Git merges and classify every unmerged path against one
     policy.

5. **Add narrow policy resolvers**
   - `generated-local`: restore the exact local blob, run the declared
     deterministic snapshot verifier inside the isolated worktree, and require
     byte equality before staging.
   - `canonical-incoming-subset`: parse exact `chat-capture` marker blocks,
     reject conflicting duplicates/reorders/shrinkage, require every incoming
     record in local in order, and require the staged result to equal the local
     blob byte-for-byte.
   - `append-only-manual`, unclassified conflicts, deletions, and proof failures
     stop candidate eligibility without inventing a merge.

6. **Commit and validate the candidate**
   - Require an empty unmerged-entry set.
   - Create a deterministic merge commit with exact local and remote parents.
   - Run only the reconciliation-focused test command and TypeScript typecheck;
     reject configured checks outside the side-effect-free allowlist.
   - Fetch the remote branch again into a new temporary ref.
   - If the remote moved, retain the candidate and write `stale-remote.json`;
     never merge the new head recursively.
   - Always remove the temporary worktree and temporary refs; retain only the
     auditable candidate branch.

7. **Expose CLI and validation entry points**
   - Extend the source-control CLI with `reconcile preflight` and
     `reconcile candidate`.
   - Preserve the existing `SOURCE_CONTROL_RESULT_JSON:` machine-output
     boundary and map expected fail-closed states to nonzero exits.
   - Add `source-control:reconcile` and `test:source-reconciliation` package
     commands.
   - Register the focused safety test in the consolidated validation suite.

8. **Add hermetic regression coverage**
   - Use temporary real Git repositories and local bare remotes.
   - Cover deterministic fingerprints, ordinary merges, exact-parent commits,
     generated-local proof, canonical subset proof, unchanged `main`, stale
     remotes, dirty worktrees, overlaps, manual policies, missing objects,
     forbidden Git operations, immutable audits, idempotent replay, and cleanup.
   - Add a static boundary check proving the reconciliation module has no
     database imports and no push/reset/force/rebase path.

9. **Document and review**
   - Update operator usage in the design/spec documentation.
   - Update `docs/alden-agent-handoff.md` and `docs/batch-doc-updates.md`.
   - Run focused reconciliation tests, `npm run check`, the system-health
     verifier, and a final architecture review.

## Non-goals

- Promotion, checkout, reset, or advancement of `main`.
- Push, force-push, rebase, or remote ref deletion.
- Database-backed policy checks or shared-Neon access.
- Automatic append-only interleaving.
- Broad episode globs or generic `ours`/`theirs` handling.
- Automatic retry against a remote head that moved.