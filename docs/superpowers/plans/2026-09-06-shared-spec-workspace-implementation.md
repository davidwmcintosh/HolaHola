# Shared Spec Workspace Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-06-shared-spec-workspace-design.md`  
**Scope:** Portable agent collaboration for design and architecture specs  
**Rule:** Complete and verify each phase before beginning the next.

## Phase 1 — Portable PostgreSQL schema

### Goal

Create the document, revision, review-policy, review, publication, and
publication-attempt records without introducing a Replit or Neon runtime
dependency.

### Files

- `shared/schema.ts`
- generated `migrations/*.sql`
- generated `migrations/meta/*`
- `server/scripts/verify-system-health.ts`
- new focused schema test under `server/scripts/`

### Steps

1. Add document-kind, document-state, review-state, publication-state, and
   reviewer-capability enums.
2. Add shared-spec document records with a unique canonical repository/path
   identity and current revision pointer. Enforce repository/path uniqueness at
   the database level for active documents.
3. Add insert-only full-content revisions with parent identity, author actor,
   request idempotency identity, and SHA-256 content hash.
4. Add reviewer policy records whose actor identifiers are application-owned
   strings rather than provider/runtime identities.
5. Add exact-revision reviews with requested, claimed, and decision actors.
6. Add publications and immutable attempt history.
7. Add constraints for nonempty content, valid hashes, unique idempotency
   identities, exact revision/review publication identity, and useful lookup
   indexes.
8. Generate and review a portable PostgreSQL migration. Do not add runtime DDL.
9. Prove the migration on an isolated disposable or Neon branch database.
10. Add read-only system-health checks for the new tables.

### Verification

- Fresh database applies the migration.
- Existing database migrates without modifying unrelated rows.
- Schema contains no Replit-specific columns, IDs, or extensions.
- `npm run typecheck`

## Phase 2 — Immutable document core

### Goal

Implement a portable service that knows nothing about HTTP, Replit,
coordination, or GitHub.

### Files

- new `server/services/shared-spec-core.ts`
- new focused service tests

### Interfaces

- `SharedSpecRepository`
- `ActorContext`
- create/list/show document
- append/read/compare revision
- mark revision ready
- assign/claim/reassign review
- approve/reject review
- export approved bytes

### Steps

1. Define repository and transaction interfaces around standard PostgreSQL
   semantics.
2. Implement SHA-256 hashing over exact UTF-8 Markdown bytes.
3. Implement document creation and first revision atomically.
4. Implement append with `baseRevisionId`, conditional current-revision
   advancement, and stale-write conflict response. Use a compare-and-swap
   update constrained by the expected current revision; zero updated rows
   aborts the transaction and returns conflict.
5. Bind idempotency keys to immutable request digests. Matching retries return
   the original result; mismatched reuse fails.
6. Implement exact-revision ready/review lifecycle.
7. Enforce independent reviewer eligibility and no self-approval.
8. Restrict reviewer-policy changes to actors with a separate policy-admin
   capability. Document authorship alone never grants policy authority.
9. Version policy records append-only and bind approval evidence to the policy
   version effective at decision time.
10. Preserve historical approvals when policy changes. Removing a reviewer's
    future eligibility never retroactively invalidates an immutable approval.
11. Export exact approved bytes without requiring a publication adapter.
12. Expose typed domain errors independent of Express or any hosting platform.

### Verification

- Concurrent writes yield one winner and one non-mutating conflict.
- Revision rows cannot be changed through service interfaces.
- Hashes match independently recomputed bytes.
- Self-approval and ineligible review fail closed.
- Reviewer replacement affects future decisions only.
- Only policy-admin actors can change reviewer eligibility.
- Historical approvals resolve against their recorded policy version.
- Approved-byte export works with notification and publication adapters absent.

## Phase 3 — Portable application adapters and actor API

### Goal

Expose the core through actor-authenticated HTTP and CLI interfaces while
keeping authentication replaceable.

### Files

- new `server/services/shared-spec-auth.ts`
- new `server/routes/shared-spec-routes.ts`
- route registration in the existing server
- new `server/scripts/shared-spec-cli.ts`
- focused route/auth/CLI tests

### Steps

1. Define an `ActorAuthenticator` interface that resolves credentials to actor
   ID and capabilities.
2. Implement the initial HolaHola adapter using existing actor-scoped
   coordination credentials.
3. Ensure the core receives only `ActorContext`; it must not import the
   coordination authenticator.
4. Add API routes for document, revision, comparison, review, approval, and
   approved-byte export operations.
5. Require stable idempotency keys for mutations.
6. Derive author/reviewer identity exclusively from authenticated context.
7. Add an agent-oriented CLI using ordinary base URL and bearer/actor
   configuration, with no Replit domain assumptions.
8. Return document ID, revision ID, hash, attribution, and state consistently.

### Verification

- Requests cannot forge author or reviewer identity.
- Alternate fake authenticator works without HolaHola coordination modules.
- CLI operates against an arbitrary HTTP base URL.
- Core and API tests pass with all `REPLIT_*` variables removed.

## Phase 4 — Optional coordination notification adapter

### Goal

Notify reviewers and authors without making coordination availability part of
document correctness.

### Files

- new `server/services/shared-spec-notifications.ts`
- HolaHola coordination adapter
- focused notification tests

### Steps

1. Define a `SharedSpecNotificationSink` interface.
2. Emit identity-only events for review requests, decisions, publication
   conflicts, and merge outcomes.
3. Use recipient-delivered coordination operations for messages that another
   actor must receive.
4. Never include full Markdown in a coordination payload.
5. Persist notification state separately from the document transaction.
6. Make failures visible and retryable without rolling back successful core
   document transitions.
7. Classify notification failures as transient or permanent and persist the
   last failure independently from document state.
8. Provide a no-op sink for portable standalone operation.

### Verification

- No event contains document content.
- A disabled or failing sink does not block create/edit/review/approve/export.
- Delivery state is never confused with seen or acknowledged state.
- Retries do not duplicate effective notifications.

## Phase 5 — Constrained GitHub pull-request publisher

### Goal

Publish one approved revision through standard GitHub APIs without local Git,
Replit integrations, or caller-selected execution behavior.

### Files

- new `server/services/shared-spec-publication.ts`
- new `server/services/github-spec-publisher.ts`
- publication API/CLI operations
- focused fake-GitHub tests and static safety guard

### Steps

1. Define a replaceable `SpecPublicationProvider` interface.
2. Implement a narrow GitHub REST adapter accepting a standard GitHub App
   installation token or host-provided token.
3. Configure one allowed repository, base ref, and
   `docs/superpowers/specs/` destination namespace server-side.
4. Reject caller-provided repositories, commands, credentials, arbitrary
   branches, path traversal, encoded separators, symlinks, and non-spec paths.
5. Recompute approved revision hash before publication.
6. Resolve and pin expected base commit and destination blob/absence.
7. Create a deterministic docs-only branch and write exactly one approved file.
8. Open or recover one pull request identified by publication metadata.
9. On retry, reconcile deterministic branch/PR markers before creating
   anything.
10. Treat database and GitHub state as independently uncertain after every
    network boundary. Insert-only attempt records preserve requests,
    responses, timeouts, and errors. A retry checks the database and then
    revalidates deterministic GitHub branch/PR markers before creating.
11. If GitHub may have accepted a request whose response was lost, never mark
    it failed-and-recreate blindly; reconcile remote state first.
12. Record base/path conflicts without overwriting.
13. Reconcile open, merged, and closed states separately.
14. Verify merged path bytes and hash before recording merged.

### Verification

- Exact approved bytes are the only changed blob.
- Base or destination drift blocks publication.
- Timeout/retry cannot create a second effective pull request.
- A simulated lost-success response is recovered from deterministic GitHub
  state without creating a second branch or pull request.
- GitHub failure leaves a retryable approved publication.
- Pull-request creation never records merge.
- Static guard proves no shell Git, deploy key, Actions dispatch, Replit
  connector, arbitrary repository, or direct-main push.
- A fake standards-compliant GitHub HTTP server passes the adapter contract.

## Phase 6 — Registration, documentation, and real cross-agent proof

### Goal

Make the capability discoverable, continuously checked, and proven through one
real collaboration.

### Files

- `package.json`
- `scripts/run-ci-test-steps.mjs`
- `server/scripts/run-validation-suite.sh`
- `server/scripts/test-all-consolidated-ci.sh`
- `docs/coordination-clients.md`
- `docs/agent-workflows.md`
- `docs/batch-doc-updates.md`
- `docs/alden-agent-handoff.md`

### Steps

1. Register focused schema, core, auth, notification, publication, and
   portability checks in existing CI groups.
2. Add a mutation self-check proving the stale-write guard and no-self-approval
   checks cannot silently disappear.
3. Document the shared-spec CLI workflow and Git graduation boundary.
4. Document adapter replacement and non-Replit deployment requirements.
5. Run one real draft between two different agent runtimes.
6. Intentionally produce and reconcile one stale edit.
7. Have an independent eligible actor approve the exact revision.
8. Publish a docs-only pull request.
9. Verify merged Git bytes equal the approved database revision.
10. Record evidence and any portability gaps found during the proof.

### Final verification

- Focused shared-spec suites
- `npm run typecheck`
- relevant consolidated CI group
- migration proof on an isolated database
- `npx tsx server/scripts/verify-system-health.ts`
- core test process with Replit-specific variables absent
- final architectural review

## Delivery boundaries

- Do not broaden the MVP beyond design and architecture specs.
- Do not store full drafts in the coordination ledger.
- Do not make GitHub or notifications prerequisites for core drafting/review.
- Do not require individual agents to possess Git credentials.
- Do not introduce Replit-specific dependencies into the core or portable API.
- Do not automatically merge pull requests or push directly to main.
- Do not start a later phase while an earlier phase's invariants are unproven.