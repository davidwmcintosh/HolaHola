# Development Source-Control Control Plane

**Date:** 2026-08-27
**Status:** Approved design; implementation in progress

## Goal

Make one TypeScript source-control coordinator the only project-supported
owner of development-checkout and GitHub synchronization mutations. This
controls development source only. Production publishing remains an explicit,
manual Replit Publish action.

The migration must preserve the safety behavior already established by the
source bridge while removing parallel mutation entry points.

## Invariants

The coordinator must fail closed unless all of the following are true:

- The checkout is on the configured development branch and has no tracked
  uncommitted changes.
- GitHub is fetched before a direction is selected.
- Both exact heads are known and ancestry is verified.
- Only fast-forward receive and push operations are permitted.
- Divergence, unavailable shallow ancestry, invalid credentials, stale
  candidates, and changed heads stop the operation without source mutation.
- The validation manifest is versioned, complete, bound to the exact candidate
  SHA, and cryptographically self-consistent.
- A crash-safe cross-process lock serializes scheduler, API, and post-merge
  operations.
- Operational status is written atomically and distinguishes healthy,
  readiness, contention, retryable failure, hard failure, stale candidates,
  and ambiguous restart outcomes.
- No path stages, commits, resets, force-pushes, or creates merge commits.
- SSH key material exists only in a restrictive temporary file and is removed
  after the operation without being logged.

## Architecture

### Git transport

`source-control-git-transport.ts` owns fixed-argument `git` execution,
fetching, exact-head inspection, ancestry checks, fast-forward receive, and
non-force push. It receives a validated workspace root and uses the protected
SSH transport helper without placing secrets in command arguments.

The transport has no operation-specific policy and does not expose arbitrary
shell execution. Its typed outcomes preserve command failure, invalid
credentials, incomplete history, and remote-race distinctions.

### Source-control coordinator

`source-control-service.ts` owns the lifecycle policy currently spread across
the bridge and promotion service:

1. Acquire the shared lock.
2. Inspect and fetch both heads.
3. Refuse dirty or unsupported repository state.
4. Decide equal, Replit-ahead, GitHub-ahead, or divergent state.
5. Perform only the permitted fast-forward mutation.
6. Re-fetch and prove the expected exact head.
7. Run and persist the fixed validation manifest for received source.
8. Persist typed status and actor-attributed durable operation records.

Promotion preparation, exact-SHA publication recording, and request replay use
the same coordinator and lock. The coordinator never publishes to Replit.

### API and scheduler

The existing authenticated source-promotion API calls the coordinator
directly. A development-only sync endpoint and in-process scheduler use the
same service. The scheduler has one active run at a time, wakes after a
post-merge event, handles startup/shutdown, and is not activated in production.

Post-merge requests a best-effort control-plane wake-up after its existing
reviewed setup steps. It does not execute a mutating shell bridge.

### Compatibility boundary

Legacy shell commands remain available only as read-only diagnostics or
fail-closed migration notices. `source-bridge.sh`, `sync-to-github.sh`,
`sync-from-github.sh`, package scripts, and supervisor callers cannot provide a
second mutation path. The old supervisor workflow is removed from the active
development lifecycle before the new scheduler is enabled.

## Data flow and failure handling

Every mutating request receives a durable actor, idempotency hash, payload
digest, boot identity, timestamps, outcome, exact candidate SHA, and bounded
diagnostic output. Replays return the original terminal result. A request found
running under a different boot is marked ambiguous and is never retried
silently.

Status writes use temporary files followed by atomic rename. Lock contention is
reported as retryable rather than treated as success. A failed validation or
post-validation head change prevents promotion readiness. Production
publication is recorded only after an operator supplies the exact SHA and
explicitly attests that Replit Publish completed.

## Migration sequence

1. Add mutation-boundary regression coverage and inventory all callers.
2. Implement the typed Git transport and shared coordinator alongside the
   existing bridge.
3. Port direction, history, validation, promotion, retry, and restart rules.
4. Switch API operations and the scheduler to the coordinator.
5. Migrate post-merge, `.replit`, package scripts, and legacy callers.
6. Make direct shell mutation attempts fail closed.
7. Run isolated fixture tests for all repository states and direct bypasses.
8. Remove the old mutator from the active lifecycle only after all gates pass.

Each step remains reversible until the final lifecycle cutover. Existing
source-bridge tests remain as compatibility evidence during the transition,
while new coordinator fixtures become the authority for the replacement.

## Verification

Before completion, run typecheck, production build, source-control fixture and
adversarial bypass tests, canonical unit/guard/episode CI, system health, an
independent architecture review, and the final Gemini review. Any unrelated
pre-existing validation failure must be reported explicitly rather than
silently weakening a check.

## Scope boundary

This design does not automate Replit Publish, change branch-protection policy,
create or rewrite Git history, migrate the application database, or protect
against a person who independently has unrestricted shell access and GitHub
credentials.