# Shared Spec Workspace Design

**Date:** September 6, 2026  
**Status:** Approved design; implementation not started  
**Scope:** Agent-authored design and architecture specifications

## Purpose

HolaHola's agents currently exchange work-in-progress specifications through
Git. That makes a draft visible only after its author commits, pushes, and
completes the same synchronization and validation path used for production
code. Other agents may still have unsaved work, stale refs, partial-clone
objects, missing Git credentials, or no reason to fetch at the right moment.
The result is avoidable latency and repeated uncertainty about whether another
participant can read the latest document.

The shared spec workspace makes standard PostgreSQL the canonical
collaborative surface for in-progress design documents. Coordination records
review requests and decisions. Git receives only an approved immutable
revision through a docs-only pull request.

The governing model is:

> **Database:** living collaborative record  
> **Coordination ledger:** requests, reviews, and decisions  
> **Git:** approved immutable snapshot

## Portability requirement

The shared spec workspace must continue functioning if HolaHola is moved away
from Replit.

The core depends only on:

- a Node-compatible JavaScript runtime;
- a standard PostgreSQL database;
- HTTP;
- a GitHub App or token accepted by GitHub's standard REST API when publication
  is enabled.

The core must not depend on:

- Replit workflows or deployment APIs;
- Replit integrations or connector runtimes;
- Replit domains, project IDs, identity, authentication, or agent callbacks;
- Replit Secrets APIs or Replit-specific environment-variable names;
- Replit filesystem persistence;
- Replit database products or platform-managed migration execution.

Neon may remain the current PostgreSQL provider, but no Neon-specific API is
required for normal document operation. The connection is supplied through a
portable application database configuration. Standard migrations can be run
from any CI or operator environment.

HolaHola-specific actor authentication, coordination notifications, and Git
publication are adapters around a portable document core. Losing an adapter
may temporarily remove notifications or publication, but it must not prevent
creating, reading, revising, reviewing, or exporting documents through the core
API.

## Scope

The first version manages only design and architecture specifications.

Included:

- Creating a spec with a stable identity and canonical Git destination.
- Writing immutable full-document Markdown revisions.
- Reading revision history and comparing revisions.
- Rejecting edits based on a stale revision.
- Assigning, claiming, reassigning, approving, and rejecting reviews.
- Publishing an approved revision as a docs-only pull request.
- Reconciling pull-request and merge status.

Deferred:

- Procedures, skills, handoffs, operational notes, and arbitrary Markdown.
- Live character-level co-editing.
- Automatic Markdown merge.
- A browser editor or document-management UI.
- Automatic ingestion from Git, coordination events, Team Room, inbox notes,
  `editor_insights`, or existing repository documents.
- Replacing Git as the durable release history for approved specifications.

## Governing invariants

1. One document has one stable identity and an append-only revision history.
2. Every revision is an immutable full Markdown snapshot.
3. Every revision records its author actor, parent revision, timestamp, and
   SHA-256 content hash.
4. A write names the exact revision the author read. If that is no longer
   current, the write fails without mutation.
5. The service never silently merges, rebases, or overwrites Markdown.
6. An author cannot approve their own revision.
7. Reviewer authority is assigned by configurable actor capability, never by
   model or runtime provider.
8. Approval binds one reviewer decision to one exact revision and hash.
9. Existing approvals are immutable even when reviewer eligibility changes.
10. Coordination events contain lifecycle references, not full document text.
11. Git publication uses the exact approved bytes and expected destination
    state. A changed destination fails closed.
12. A pull request is publication-in-progress, not proof of merge.

## Actor identity and reviewer policy

Actor identity is independent from the model or runtime currently filling that
role. Initial reviewer-eligible actors may include:

- `luca-replit`
- `luca-claude-code`
- `alden`
- `david`

Eligibility is policy data, not a schema constraint. It can be changed for
future reviews when an agent source or responsibility changes.

A ready revision may nominate an eligible reviewer or remain unassigned. Any
eligible actor other than the author may claim an unassigned review. An
authorized actor may reassign a pending review. David may approve, reject, or
reassign any review.

Routine specs require one independent approval. Existing stricter policies
still apply when a specification crosses their boundary. For example,
Daniela-facing prompt or tool behavior may require the existing Gemini review
loop, and security-sensitive or privileged-operation changes may require their
own review gates. Those gates supplement this workspace's document approval;
they are not recreated inside it.

## Conceptual data model

### Documents

A document stores:

- stable document ID;
- title and optional summary;
- document kind, restricted initially to design or architecture spec;
- canonical repository and Git path;
- current revision ID;
- lifecycle state;
- creator actor and timestamps;
- optional published and merged revision references.

The canonical Git path must be unique among active documents.

### Revisions

A revision stores:

- stable revision ID;
- document ID;
- parent revision ID, absent only for the first revision;
- complete Markdown content;
- SHA-256 content hash;
- author actor;
- author request idempotency key;
- creation timestamp.

Revisions are insert-only. Corrections create another revision.

### Reviews

A review stores:

- stable review ID;
- document and revision IDs;
- exact revision content hash;
- requested reviewer, claimed reviewer, and decision actor;
- state: pending, approved, rejected, or cancelled;
- decision rationale and evidence references;
- timestamps.

There is no intermediate `reviewed` state. Review discussion is evidence and
commentary; a lifecycle state exists only when it changes authority or
retrieval behavior.

### Reviewer policy

Reviewer policy stores or resolves:

- actor identity;
- review capability;
- active/disabled state;
- optional document-kind or boundary restrictions;
- policy provenance and effective timestamp.

Disabling an actor affects future claims and decisions. It never invalidates or
rewrites historical approvals.

Actor IDs are application-owned strings. They must not encode a Replit account,
workspace, deployment, or model-provider identity. Authentication resolves an
external credential to an actor through an injected adapter.

### Publications

A publication stores:

- document, revision, review, and content-hash identity;
- repository, base ref, expected base commit, and destination path;
- expected destination blob hash or explicit expected absence;
- publication idempotency key;
- generated branch and pull-request identity;
- state: requested, creating, open, merged, closed, conflict, or failed;
- attempt history and error detail;
- timestamps.

One approved revision and destination identity produce at most one effective
publication.

## Lifecycle

### Drafting

1. An authorized agent creates a document and first immutable revision.
2. A reader receives the document's current revision ID and hash.
3. An edit submits full Markdown with `baseRevisionId`.
4. In one transaction, the service locks or conditionally checks the document,
   verifies that `baseRevisionId` is still current, inserts the revision, and
   advances the current pointer.
5. A stale base returns a conflict containing the submitted base identity and
   current revision identity. No revision is inserted.

### Review

1. The author or authorized coordinator marks the current revision ready.
2. The service creates one pending review bound to that revision and hash.
3. An eligible non-author reviewer is assigned or claims it.
4. Approval rechecks reviewer eligibility, non-authorship, revision identity,
   and content hash in one transaction.
5. Rejection records the exact rejected revision and rationale. The next edit
   creates a new revision and review.
6. If a new draft revision is written while an older revision is under review,
   the older review cannot approve the new content. Policy may cancel the older
   review or allow it to finish as historical evidence, but publication always
   requires approval of the selected exact revision.

### Publication

1. Publication accepts only an approved revision and its matching review.
2. It rereads and rehashes the immutable revision bytes.
3. It resolves the configured repository, base ref, and destination state.
4. It creates or reuses a deterministic docs-only branch for the publication.
5. It writes exactly one allowed spec path from the approved bytes.
6. It opens a pull request whose metadata includes document, revision, review,
   and content-hash identity.
7. A retry with the same idempotency identity returns the existing effective
   publication rather than opening another pull request.
8. If the base ref or destination blob differs from the expected state,
   publication records a conflict and does not overwrite it.
9. Pull-request status is reconciled separately. Only a verified merged state
   marks the revision merged.

The Git publisher is a single canonical service using GitHub's public API.
Individual drafting agents do not need Git credentials to collaborate or
publish. The publisher receives credentials through ordinary host secret
configuration or a GitHub App installation, never through a Replit-only
connector contract.

## Coordination integration

The coordination ledger remains a lifecycle and provenance channel, not a
document store.

Coordination events may reference:

- document ID;
- revision ID and content hash;
- review ID and requested reviewer;
- publication and pull-request identity;
- lifecycle transition and human-readable summary.

Events must not embed the full Markdown document. A recipient reads the
document through the shared-spec API using the referenced immutable identity.

Review requests and outcomes use recipient-delivered coordination operations.
A successfully appended ledger comment is never treated as proof that a
reviewer received a request.

## Agent API and CLI

The MVP is API- and CLI-first.

Required operations:

- create, list, and show documents;
- read current content and revision history;
- append a revision against an exact base revision;
- compare two revisions;
- mark the current revision ready;
- claim, assign, or reassign a review;
- approve or reject an exact revision;
- publish an approved revision;
- inspect and reconcile publication status.

Every response includes the relevant document ID, revision ID, content hash,
actor attribution, and lifecycle state. Mutations require stable idempotency
keys.

Authorization receives actor identity from an injected authentication adapter.
HolaHola's initial adapter may validate the existing actor-scoped coordination
credentials, while another deployment may use static service credentials,
OIDC, mTLS, or another identity provider. Callers cannot provide a different
author or reviewer identity in the request body.

The core service accepts an already-authenticated actor context and contains no
Replit authentication logic.

## Failure behavior

- **Stale edit:** return conflict and current revision; write nothing.
- **Duplicate edit request:** return the original revision when request identity
  and digest match; reject reuse with different content.
- **Self-approval:** reject without changing review state.
- **Ineligible reviewer:** reject or require reassignment.
- **Reviewer removed during review:** block a later decision by that actor;
  preserve assignment history.
- **Revision advanced during review:** never transfer approval to newer bytes.
- **Git destination changed:** record conflict; never overwrite.
- **GitHub unavailable:** retain approved revision and retryable publication.
- **Partial Git publication:** reconcile by deterministic publication identity
  before creating any replacement branch or pull request.
- **Pull request closed without merge:** record closed; document remains
  approved but not merged.
- **Coordination delivery failure:** preserve the document transition and expose
  notification failure for retry; never claim the recipient was notified.

## Security and authority boundaries

- Shared-spec access uses actor-scoped authentication through a replaceable
  adapter.
- Database constraints and service checks enforce immutability and authorship.
- The Git publisher accepts only approved revisions and one configured
  docs/spec path namespace.
- Caller-provided repositories, arbitrary paths, branch names, Git commands,
  executors, or credentials are not accepted.
- Markdown is data. Publication does not execute code blocks, links, frontmatter,
  or embedded instructions.
- Document approval does not authorize implementing the design or performing a
  privileged operation.

## Adapter boundaries

The implementation separates four interfaces:

1. **Document repository:** PostgreSQL-backed documents, revisions, reviews,
   policies, and publications. This is required.
2. **Actor authenticator:** maps a request credential to an application actor
   and capabilities. The initial HolaHola adapter may reuse coordination
   credentials. This is replaceable.
3. **Notification sink:** emits review and publication lifecycle references.
   The initial adapter uses the coordination ledger. A no-op or alternate
   webhook/message adapter is valid, and notification failure does not disable
   core document operations.
4. **Publication provider:** creates and reconciles docs-only pull requests.
   The initial provider uses standard GitHub REST APIs. The core can export
   approved bytes without GitHub, allowing another publisher to be substituted.

Adapters must be dependency-injected into the application layer. Portable core
services must not import Replit SDKs, Replit callbacks, workflow modules, or
platform-specific secret clients.

## Verification

Focused tests must prove:

1. Revision content and authorship cannot be updated or deleted through normal
   service paths.
2. Concurrent writes against one base produce one winner and one stale-write
   conflict.
3. Idempotent revision retries return the same revision, while mismatched reuse
   fails.
4. Authors cannot approve their own revisions.
5. An eligible independent reviewer can approve the exact ready revision.
6. Reviewer policy changes affect future decisions without rewriting history.
7. Approval remains bound to the original revision and hash after later edits.
8. Rejected and cancelled reviews do not authorize publication.
9. Coordination events reference identities without storing document content.
10. Publication writes exactly the approved bytes to the configured docs path.
11. Changed Git base or destination state fails without overwrite.
12. GitHub failures leave one retryable publication and do not duplicate pull
    requests.
13. Pull-request creation is not mistaken for merge.
14. Actor credentials cannot forge author or reviewer identity.
15. Non-spec paths and caller-selected repositories are rejected.
16. Core service tests run with an ordinary PostgreSQL connection and fake
    adapters, with no Replit environment variables or APIs present.
17. Disabling the notification adapter does not block drafting, revision,
    review, approval, or approved-byte export.
18. Publication can use a standard GitHub HTTP client without a Replit
    integration.

Database schema changes must use portable PostgreSQL migrations. In the current
environment they still follow HolaHola's reviewed-migration process and are
proved on an isolated Neon branch before application, but neither the generated
schema nor runtime service may depend on Neon branch APIs. Standard TypeScript,
focused coordination/publication tests, consolidated CI, and system-health
verification remain required before shipping.

## Rollout

1. Land the approved schema and core immutable revision service.
2. Add actor-authenticated API and CLI operations.
3. Add review policy and exact-revision approval.
4. Integrate recipient-delivered review notifications.
5. Add the constrained GitHub pull-request publisher.
6. Use the workspace for one real cross-agent design from draft through merged
   pull request.
7. Only after that evidence, consider extending the system to procedures,
   skills, handoffs, or a visual editor.
8. Run the core service and tests once with all Replit-specific environment
   variables absent, proving portability rather than inferring it.

## Success criteria

The MVP succeeds when two agents in different runtimes can draft and review one
design specification against the same canonical revision history, detect and
resolve a concurrent edit without data loss, approve one exact revision, and
publish that revision through a docs-only pull request without either agent
needing to synchronize or clean its local Git checkout. The same drafting,
review, and export flow must continue on a non-Replit host using the same
PostgreSQL schema and public API contracts.