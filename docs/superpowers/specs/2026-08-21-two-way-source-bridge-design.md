# Two-Way Source Bridge: Replit and Owner GitHub

## Status

Approved design. Production promotion remains an explicit action.

## Problem

HolaHola uses Replit as the production host and also uses Claude Code outside
Replit for development. Replit's internal project Git/checkpoint system and the
owner-controlled GitHub repository are separate systems. A change can therefore
be safely committed in one system while the other silently becomes stale.

The existing GitHub scripts protect individual pushes and pulls, but they are
not connected to every Replit task merge or to a persistent receive path for
Claude Code changes.

## Goals

1. Every committed change accepted into Replit's `main` reaches the owner's
   GitHub `main` automatically.
2. Every committed change pushed by Claude Code to GitHub `main` is received
   automatically into Replit's `main`.
3. Replit validates received source and makes it clearly ready for promotion.
4. Production publication remains a separate, deliberate Replit action.
5. No source change is silently overwritten, force-pushed, auto-merged across
   divergence, or hidden by a failed sync.
6. Temporary GitHub or Replit outages result in retryable, visible state rather
   than lost work.
7. The bridge works with Replit's existing task-agent merge process and with
   ordinary Claude Code Git pushes.

## Non-goals

- Pushing half-finished uncommitted editor changes to GitHub.
- Automatically publishing every GitHub change to production.
- Replacing Replit's native checkpoints or task-agent history.
- Storing Daniela's runtime database or episode data in GitHub.
- Force-rewriting either owner's active `main` branch.

## Source roles

GitHub `main` is the owner-controlled source bridge. Replit `main` is the
production-ready checkout. They should normally point to the same commit, but
they may temporarily differ in two intentional states:

- Replit is ahead while a newly accepted Replit commit is being pushed.
- Replit is at a received GitHub commit marked `ready_to_promote` while David
  has not yet published it.

Both sides must remain ordinary Git histories. The original Replit and GitHub
histories remain protected by the reconciliation/archive process.

## Architecture

### 1. One guarded bridge coordinator

Create one idempotent coordinator around the existing SSH and ancestry
guards. It owns the source-sync state machine and is the only automation
allowed to mutate the Replit checkout for source synchronization.

The coordinator will:

- acquire an exclusive repository lock before inspecting or mutating refs;
- fetch GitHub before every direction decision;
- compare commit ancestry before pushing or fast-forwarding;
- never stage or commit a dirty worktree;
- push only ordinary fast-forward commits to GitHub;
- receive GitHub only with `git merge --ff-only`;
- record the observed local SHA, GitHub SHA, state, attempt time, and error;
- retry transient transport failures with bounded backoff;
- leave an actionable pending/error status when a retry cannot complete.

The current `sync-to-github.sh` and `sync-from-github.sh` remain the reviewed
low-level safety primitives. The coordinator must not weaken their existing
GitHub-ahead, divergence, dirty-tree, or no-force behavior.

### 2. Replit-to-GitHub path

After a successful Replit task merge or other accepted commit to `main`, the
bridge invokes a committed-only push path:

```text
Replit task/accepted commit
        ↓
bridge lock + fetch GitHub
        ↓
GitHub ancestor check
        ↓
ordinary non-force push
        ↓
state = synced
```

The bridge must not call the existing auto-commit behavior while an editor or
Agent has a dirty worktree. A failed push leaves the Replit commit intact,
records the failure, and schedules a retry. It does not mark the source as
synced until a subsequent fetch proves that GitHub contains the exact commit.

The Replit post-merge path will trigger an immediate attempt. A small,
purpose-specific Replit bridge workflow will retry pending pushes and inspect
the two-way state periodically so that an outage or process restart cannot
silently strand a committed Replit change.

### 3. GitHub-to-Replit path

The same bridge workflow polls GitHub using the repository deploy key. When
GitHub is ahead and Replit's worktree is clean, it fast-forwards Replit `main`
and runs source validation:

```text
Claude Code commits and pushes GitHub main
        ↓
bridge fetches GitHub
        ↓
clean-tree + fast-forward checks
        ↓
Replit main fast-forwards
        ↓
typecheck and required source checks
        ↓
state = ready_to_promote
```

If the Replit worktree is dirty, the bridge defers the receive operation and
reports the exact reason. If histories diverge, it stops and reports the two
heads. It never creates an implicit merge and never resets Replit backward.

The bridge must not pull into a worktree while another bridge operation is in
progress. The lock and clean-tree check are both required; either one alone is
insufficient.

### 4. Explicit Replit promotion

Receiving source and publishing production are separate actions.

The bridge will expose a promotion command/status flow that:

1. confirms Replit `main` is clean;
2. confirms it is the exact fetched GitHub commit;
3. runs the required validation;
4. records the candidate commit SHA and validation result;
5. stops in `ready_to_promote` until David invokes the explicit Replit
   promote/deploy action;
6. records the promoted commit after Replit reports success.

The deployment-specific command or UI integration will use Replit's supported
deployment path rather than inventing a second deployment mechanism. A
promotion failure must not move either source branch backward.

## State model

The bridge status is machine-readable and also has a concise human-readable
summary:

| State | Meaning | Required behavior |
|---|---|---|
| `synced` | Replit and GitHub contain the same commit | Continue polling |
| `replit_ahead` | Replit has committed work not yet on GitHub | Retry guarded push |
| `github_ahead` | GitHub has work not yet received by Replit | Receive if clean |
| `ready_to_promote` | Replit received and validated GitHub source | Wait for explicit promotion |
| `dirty` | Uncommitted Replit files prevent safe receive | Defer and report |
| `diverged` | Neither head is an ancestor of the other | Stop and require reconciliation |
| `retrying` | A temporary transport or validation failure is being retried | Preserve both heads |
| `failed` | Bounded retries were exhausted | Alert with repair command |

The status file is local operational state and must not become part of the
application source history. The status must include enough information to
answer “which commit is where?” without inspecting transient logs.

## Failure and safety rules

- A GitHub-ahead or divergent check occurs before every Replit push.
- A clean worktree is required before any automatic GitHub-to-Replit receive.
- A dirty Replit worktree is never auto-staged or auto-committed by the bridge.
- A normal Git push remains the final race-condition safety gate.
- Failed pushes and pulls preserve the source commit and remain retryable.
- A stale lock is recoverable only after confirming no bridge process is alive.
- The deploy key remains in Replit Secrets and is materialized only in the
  existing protected temporary SSH setup.
- No GitHub token, private key, or credential is written to a tracked file.
- Production promotion is blocked unless source and validation status identify
  one exact candidate commit.

## Workflow integration

The implementation will add one purpose-specific source-bridge workflow rather
than hiding a long-running Git process inside the application server. The
existing application workflow remains responsible for serving the app.

The Replit post-merge hook will request an immediate bridge pass after the
existing safety and restoration checks. The bridge workflow will provide
periodic retry and GitHub receive behavior. Both entry points use the same
lock and coordinator, so simultaneous triggers serialize safely.

The documented Claude Code workflow will be:

```text
git fetch GitHub
make and validate changes
git push GitHub main
wait for Replit bridge receive + validation
invoke explicit Replit promote/deploy when ready
```

## Testing and acceptance

The implementation is complete only when these checks pass:

1. A clean Replit-ahead fixture pushes to a bare GitHub remote and ends with
   equal heads.
2. A GitHub-ahead fixture fast-forwards Replit without creating a merge.
3. A dirty Replit fixture defers receive without changing files or refs.
4. A divergent fixture refuses both directions and records both SHAs.
5. A GitHub race during push is rejected without losing the local commit.
6. A temporary transport failure retries and eventually reaches `synced`.
7. An exhausted retry reaches `failed` with an actionable status.
8. Two simultaneous coordinator invocations serialize through one lock.
9. A dirty worktree is never auto-committed by the bridge.
10. Promotion refuses a stale, dirty, divergent, or unvalidated candidate.
11. A successful promotion records the exact deployed commit.
12. Existing sync guard tests, typecheck, and relevant application checks
    remain green.
13. A final live check proves `git rev-parse main` equals the fetched GitHub
    `main` after source synchronization.

## Initial migration

Before enabling the recurring bridge, push the currently pending Replit
archive commit and verify equality. Then enable the coordinator in a clean
workspace and observe at least one complete Replit-to-GitHub cycle and one
GitHub-to-Replit receive cycle before treating the bridge as operational.