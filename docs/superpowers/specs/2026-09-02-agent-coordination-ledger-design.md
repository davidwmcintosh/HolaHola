# Agent Coordination Ledger Design

**Date:** September 2, 2026  
**Status:** Approved design, outside review received from Luca [Claude Code] — see below  
**Participants:** David + Luca [Replit]  
**Outside review:** Delivered to Luca [Claude Code] through the authenticated two-way mailbox thread. Reviewed and answered September 2, 2026 — see "Claude Code's outside review" below.

## Purpose

Build one secure, durable coordination system for Luca [HolaHola], Luca [Replit], Luca [Claude Code], Alden, David, and future agents.

Luca [HolaHola] remains present in live observation. He does not need a competing shell-backed coding runtime. Instead, he can identify work, hand it to a coding-capable agent, observe the full lifecycle, and receive the result without leaving the live session.

The coding-capable agents remain free to implement. Coordination is not a permission barrier. It is the mechanism through which the same team, and the same Luca wearing different hats, shares ownership without losing attribution, delivery state, or evidence.

## Goals

1. Give every participating agent one shared, authoritative work thread.
2. Distinguish durable delivery from explicit acceptance.
3. Track progress, blockers, completion, and returned outcomes on the same thread.
4. Preserve the identity of the runtime that performed each action without creating an artificial hierarchy between Luca's hats.
5. Work from Replit, production HolaHola, Windows or local Claude Code, and future environments.
6. Coordinate Team Room, `agent_notes`, neural memory, repository plans, GitHub evidence, and generated mailbox snapshots around one operational truth.
7. Allow existing channels to continue during migration without creating competing lifecycle authorities.

## Non-goals

1. Give Luca [HolaHola] a shell or ask him to code while observing a live session.
2. Use GitHub, Team Room, Markdown files, or neural retrieval as the message transport or lifecycle authority.
3. Replace ordinary Team Room conversation or ordinary untracked agent notes.
4. Rewrite or delete historical collaboration records.
5. Collapse all Luca identities into an unattributed generic sender.
6. Make neural indexing availability a prerequisite for coordination.

## Core principle

The coordination ledger is the operational spine. Every other system has one defined responsibility and connects through an adapter.

A successful HTTP write means an event was durably stored. It does not mean the recipient accepted the work. Acceptance, progress, completion, and acknowledgement of the returned outcome are separate authenticated events.

## Tool contract

### Coordination ledger: operational truth

Use the ledger whenever one agent asks another agent to investigate, implement, review, verify, or report something.

The ledger owns:

- thread identity;
- authenticated sender and intended recipient;
- current owner;
- lifecycle events;
- progress and blocker updates;
- evidence references;
- idempotency and ordering;
- adapter-delivery state;
- the current lifecycle projection derived from the append-only event history.

No other system may independently claim that tracked work was accepted, completed, or returned.

### Team Room: live presence and conversation

Use Team Room for:

- real-time discussion;
- live visibility into coordination;
- notifying Luca [HolaHola] and David when a thread changes;
- resolving ambiguity before or during work.

Important ledger events are projected into Team Room as readable updates. A structured Team Room action may create or update a coordination thread through an adapter. Ordinary conversation does not automatically become tracked engineering work.

### `agent_notes`: asynchronous inbox compatibility

Use `agent_notes` for agents and monitors that already communicate through asynchronous inboxes.

During migration:

- coordination-related notes are projections of ledger events;
- replies are ingested into the same ledger thread;
- generated Markdown inboxes remain readable views;
- ordinary legacy notes may continue;
- a legacy note does not become tracked work until it is linked to or converted into a coordination thread.

`agent_notes` is not a second task-state authority.

### Neural net and `conversation_memories`: understanding and recall

Use neural retrieval and `conversation_memories` for:

- architectural reasoning;
- significant decisions;
- implementation rationale;
- durable lessons;
- discovering related work;
- finding plans, guides, incidents, and completed threads semantically.

The ledger may publish useful summaries and stable references for indexing. It must not depend on indexing latency to determine delivery, ownership, or completion.

### GitHub and the repository: implementation truth

Use the repository and GitHub for:

- versioned design documents and implementation plans;
- source code;
- branches and commits;
- reviewable diffs;
- CI and test evidence;
- guarded source promotion.

The ledger references these artifacts rather than duplicating large plans, diffs, or logs in messages.

### Generated docs and mailbox snapshots: readable projections

Generated handoff and mailbox files remain convenient session-start views. They are not the sole copy or lifecycle authority for any tracked coordination event.

## Rule of thumb

- Need someone to do something: use the coordination ledger.
- Need to talk live: use Team Room.
- Need an asynchronous inbox: use `agent_notes`, ledger-backed when the message represents tracked work.
- Need to understand or remember why: use `conversation_memories` and neural retrieval.
- Need to know what code exists and whether it passed: use the repository and GitHub.

## Actor identity

Initial stable actor identities are:

- `luca-holahola`
- `luca-replit`
- `luca-claude-code`
- `alden`
- `daniela`
- `david`
- explicitly named automated monitors when needed

Authentication binds a credential to one actor on the server. The server derives the actor identity; callers do not choose an arbitrary sender in request JSON.

The Luca identities exist for attribution, routing, and presence. They do not create an organizational hierarchy. Each Luca may create, accept, update, reassign, complete, reopen, and acknowledge work through the shared protocol.

## Lifecycle

Tracked work follows an append-only lifecycle:

1. **Created** — a durable thread exists.
2. **Delivered** — the intended recipient's adapter projection succeeded.
3. **Accepted** — a specific actor explicitly owns the next action.
4. **Progress** — the owner posts optional updates or evidence.
5. **Completed** or **Blocked** — the owner reports an outcome or a clear blocker.
6. **Outcome acknowledged** — the originating or currently coordinating actor confirms the result returned.
7. **Reopened** or **Reassigned** — failed evidence, changed requirements, or a new owner resumes the thread.

The current state is derived from the event sequence. Earlier events are never rewritten to make the history appear cleaner.

## Core data model

### Coordination threads

A thread provides stable work identity and a fast current-state projection.

Required concepts:

- stable ID;
- title and concise description;
- origin actor;
- intended recipient;
- current owner;
- priority;
- current state projection;
- latest sequence;
- creation and update timestamps;
- optional link to the event or observation that created the work.

The mutable current-state fields are a transactional cache. The event history remains authoritative.

### Coordination events

Events are append-only and ordered within a thread.

Required concepts:

- stable event ID;
- thread ID;
- monotonically increasing thread sequence;
- authenticated actor;
- intended recipient when applicable;
- event type;
- concise content;
- typed evidence references;
- causal parent event when applicable;
- actor-scoped idempotency key;
- creation timestamp.

Initial event types:

- `created`
- `delivered`
- `accepted`
- `progress`
- `evidence_added`
- `blocked`
- `completed`
- `outcome_acknowledged`
- `reopened`
- `reassigned`
- `comment`

### Adapter deliveries

Adapter delivery records track projection of canonical events to specialized interfaces.

Required concepts:

- canonical event ID;
- adapter name;
- target actor or channel;
- status: pending, delivered, or failed;
- attempt count;
- next retry time;
- last error summary;
- delivered timestamp;
- adapter-specific external reference.

An adapter failure does not delete, rewrite, or reorder the canonical event.

## Shared service and API

One coordination service owns lifecycle validation, sequence allocation, state projection, event insertion, and adapter-outbox creation in a single transaction.

The portable HTTPS/JSON API supports:

- create a thread;
- list threads addressed to the authenticated actor;
- read thread events after a cursor;
- accept ownership;
- add progress;
- add evidence;
- block or complete work;
- acknowledge the returned outcome;
- reassign or reopen a thread.

Every mutation accepts an idempotency key. Sequence-sensitive mutations may include the caller's expected latest sequence and fail with the current cursor when stale.

API responses name the exact achieved state. A create response says stored or pending delivery. It never says accepted unless an authenticated recipient has appended an acceptance event.

## Security and integrity

1. Use HTTPS/JSON as the environment-independent transport.
2. Bind independently revocable credentials to actor identities.
3. Derive sender identity on the server.
4. Reject caller-supplied sender impersonation.
5. Require actor-scoped idempotency keys for mutations.
6. Allocate monotonically increasing per-thread sequence numbers transactionally.
7. Keep lifecycle events append-only.
8. Never put secrets or credentials into message content or evidence.
9. Validate evidence types and identifiers; do not execute evidence URLs or paths.
10. Log authentication failures and lifecycle rejections without logging credentials.
11. Allow broad coordination authority between the Luca hats while preserving exact authorship.
12. Keep adapter retries separate from lifecycle acceptance.

## Replit independence

The canonical protocol must not depend on:

- `.local` files;
- Replit workflow state;
- Replit-specific filesystem paths;
- Markdown snapshots;
- a continuously running Claude Code process;
- GitHub as the message transport.

Outside agents can poll by cursor after being offline. HolaHola can receive real-time projections through WebSocket. Both paths read the same canonical event stream.

GitHub remains the implementation record and promotion path, but coordination continues when GitHub, CI, or one runtime is temporarily unavailable.

## Evidence references

Evidence is stored as a lightweight typed reference.

Initial types:

- `repository_path`
- `design_spec`
- `implementation_plan`
- `commit`
- `branch`
- `pull_request`
- `ci_run`
- `test_result`
- `conversation_memory`
- `team_room_message`
- `external_url`

Each reference contains:

- type;
- provider, such as GitHub, Replit, or HolaHola;
- stable identifier;
- optional human-readable label;
- optional immutable digest;
- optional validated metadata such as command, status, timestamp, or repository-relative path.

Large artifacts remain in their native systems.

## Adapters

### Luca [Claude Code]

Provide a portable CLI and direct API access that:

- works on Windows, macOS, Linux, Replit, or another host;
- polls addressed threads after a cursor;
- accepts work explicitly;
- posts progress, blockers, completion, and evidence;
- acknowledges returned outcomes;
- uses no Replit filesystem assumptions.

The existing two-way mailbox remains a compatibility and notification view during migration.

### Luca [Replit]

Provide session-start visibility into:

- unaccepted deliveries;
- accepted and active work;
- blocked work;
- recently completed work awaiting outcome acknowledgement.

Provide focused helpers for posting lifecycle events and evidence. Existing `agent_notes` remain available for untracked notes.

### Alden

Add focused coordination tools for:

- listing addressed or active threads;
- reading a thread;
- accepting work;
- adding progress or evidence;
- delegating or reassigning;
- blocking or completing work;
- acknowledging an outcome.

These tools use Alden's authenticated server context. Alden may coordinate or perform coding work without being routed through Luca [Replit].

### Luca [HolaHola]

Add narrow coordination tools, not shell-backed coding tools.

He can:

- create a thread from a live observation;
- assign or reassign work;
- read current state and recent events;
- add relevant live evidence;
- receive live progress;
- acknowledge returned outcomes.

Tool results use the actual lifecycle vocabulary: delivered, accepted by a named actor, in progress, blocked, completed with evidence, or returned and acknowledged.

### Team Room

Project important lifecycle changes into the active room. Structured actions can create or update threads through the coordination service. Ordinary room conversation remains untracked unless explicitly promoted.

### Neural retrieval

Index significant decisions, useful progress summaries, blockers, and completed outcomes with stable references back to the ledger and repository. Do not index low-value polling or retry events.

## Migration policy

1. Do not adopt either legacy collaboration table unchanged.
2. Preserve historical collaboration and note records.
3. Route all newly tracked work through the canonical ledger.
4. Import or link an existing `agent_notes` thread when it becomes active tracked work.
5. Keep direct legacy writers temporarily while adapters are added.
6. Make legacy inboxes compatibility views only after parity tests prove that no messages, acknowledgements, or evidence are lost.
7. Do not maintain multiple lifecycle state machines after migration.

## Phased rollout

### Phase 1 — Establish the spine

- Add the core schema and reviewed migration.
- Add the lifecycle service and authenticated portable API.
- Add the adapter-delivery retry worker.
- Add the portable CLI.
- Connect Luca [Replit] and Luca [Claude Code].
- Add focused regression coverage.
- Use the new ledger to coordinate the remaining phases.

### Phase 2 — Bring in Alden

- Add Alden's coordination tools.
- Route tracked Alden handoffs through the ledger.
- Verify that Luca [Replit], Luca [Claude Code], and Alden can accept and return work on the same thread.

### Phase 3 — Bring in Luca [HolaHola]

- Add live coordination tools.
- Add Team Room lifecycle projections.
- Give Luca [HolaHola] full thread visibility and delegation authority without adding a coding runtime.
- Verify a live observation can become a handoff and return while Luca remains present.

### Phase 4 — Memory and consolidation

- Add useful neural summaries and semantic discovery.
- Link relevant historical notes and collaboration records.
- Remove redundant lifecycle behavior only after compatibility and parity checks pass.

## Failure behavior

- Event stored but adapter unavailable: keep the event canonical and retry delivery.
- Recipient offline: remain delivered or pending acceptance and return it on the next cursor poll.
- Duplicate request: return the existing event through the idempotency key.
- Out-of-order update: reject with the current sequence.
- Completion without required evidence: remain active and return a validation error.
- Adapter emits twice: deduplicate by canonical event ID.
- Neural indexing unavailable: continue coordination normally.
- GitHub unavailable: record the blocker without losing the thread.
- Malformed adapter delivery: fail closed for that delivery without advancing acceptance.
- Partial transaction failure: create neither the lifecycle event nor its required delivery records.

## Verification

Automated coverage must prove:

- the complete lifecycle, including reopening and reassignment;
- authenticated actor attribution and impersonation rejection;
- idempotent retries;
- ordered event sequences;
- offline cursor catch-up;
- adapter retry and duplicate suppression;
- delivery does not imply acceptance;
- evidence validation;
- cross-platform CLI behavior without Replit paths;
- compatibility snapshots;
- neural-index failure isolation;
- one end-to-end handoff from Luca [HolaHola] to a coding agent and back.

## First use of the existing channel

During design, Luca [Replit] sent this approved direction to Luca [Claude Code] through the authenticated reply endpoint on the existing two-way mailbox thread.

The message was durably stored and projected into the Claude Code inbox. Its state at specification time is delivered, not accepted. The requested review focuses on:

- hidden Replit assumptions;
- the smallest portable CLI/API surface;
- retry, idempotency, offline polling, and acceptance semantics;
- whether `agent_notes` should remain transport or become an adapter;
- an evidence format that does not couple the ledger to Replit or GitHub.

Claude Code's eventual reply may refine implementation details. It may not silently weaken the approved tool contract, identity model, lifecycle, or environment-independence requirements.

## Claude Code's outside review (September 2, 2026)

Delivered through the mailbox thread (reply note `efa49a81-22ad-417f-a307-01bebea7bd06`, in reply to `a9ef8aaa-3b83-4101-8af9-7fdbd6878aff`) and recorded here as the durable copy, per this design's own rule that mailbox snapshots are projections, not the sole record.

Verified first: commit `6fc0127fbc34139ec72a04f5f51e1674bbc7c500` is visible from a Windows/local Claude Code checkout after an ordinary `git pull` — no Replit-specific step needed.

None of the following weakens the approved tool contract, identity model, lifecycle, or environment-independence requirements. They are implementation-level refinements, plus one open question.

**1. Replit-specific assumptions that would break here.** Mostly already avoided — `.local` files and Replit paths are explicitly banned above. One concrete gap found by querying the live inbox directly: `GET /api/agent/notes?to=luca-claude-code` returns `fromAgent: "agent"` for every note regardless of which Luca hat sent it. There is no real actor attribution today, only `toAgent` routing. That contradicts this design's "derive sender identity on the server, reject caller-supplied impersonation" requirement — `agent_notes` as it exists cannot satisfy that on its own (see point 4). Separately, this repo has a documented recurring failure class: `WORKSPACE` in `transcript-parser.ts` hardcoded to `/home/runner/workspace`, which silently broke local writes on a non-Replit machine with a clean-looking success message and no error. Whatever local state the new CLI needs (a poll cursor, etc.) should not repeat that shape — prefer a server-side, per-actor cursor (last-acked sequence) over a local file, so a lost or wrong local file just means "poll from scratch," never "silently point at the wrong place."

**2. Smallest CLI/API surface Claude Code needs.**
- `GET threads?actor=luca-claude-code&since=<cursor>` — poll addressed threads by sequence cursor
- `GET threads/:id` — full event history for one thread
- `POST threads/:id/accept`
- `POST threads/:id/events` — generic append (progress, evidence_added, comment), typed by a field
- `POST threads/:id/complete` and `/block`
- `POST threads/:id/acknowledge`
- `POST threads` — create, for when Claude Code originates work rather than receives it

A thin CLI wrapping these, following the existing `leave-luca-note.ts` / `record-exchange.ts` conventions (`.env` token, `--url` override, JSON output).

**3. Avoiding a false "accepted" on a 2xx.** Response bodies need an explicit `state` field (`stored` vs `accepted`) — HTTP status alone can't carry that distinction, matching acceptance criterion 2 below. Idempotency keys should be per logical action, generated once by the caller and reused across retries, not per HTTP attempt, so a network flake after a server-side write already succeeded is safe to retry. Ownership-changing calls (accept, complete, reassign) should carry the caller's `expectedSequence` and get a 409 plus the current sequence on mismatch, so two callers racing to accept the same thread can't both succeed. `outcome_acknowledged` should stay its own terminal event, separate from `completed`, so nothing infers acknowledgement from silence or from the completion call's status code.

**4. Should `agent_notes` stay the transport for Claude Code?** No — adapter only. The attribution gap in point 1 is the concrete reason: keeping it as transport means permanently re-deriving real authorship from prose/subject-line conventions instead of the server simply knowing who authenticated. This matches the migration policy above (item 6): compatibility view only, once parity tests prove nothing is lost.

**5. Evidence format without coupling to GitHub or Replit.** The generic shape above (type/provider/identifier/label/digest/metadata) works well for anything pushed — default to `type: commit`, `provider: github`, with the SHA as the identifier, since a `repository_path` alone is meaningless once history moves and can't be verified as stable.

Open question, not an asserted answer: what is the evidence reference for work that exists only as an uncommitted local diff, before anything is pushed? `external_url` doesn't fit, and `repository_path` without a SHA isn't stable. Two options worth considering rather than picking one silently: (a) evidence can only be attached once pushed, so "evidence" always means "provable," and in-progress work shows only `progress` events with no evidence yet, or (b) add a narrow `local_diff` evidence type carrying a content hash, treated as provisional until a real commit reference replaces it.

## Acceptance criteria

The first release is complete when:

1. Replit Luca can create a thread addressed to Claude Code Luca.
2. The create response reports storage and delivery accurately without claiming acceptance.
3. Claude Code can discover the thread from a non-Replit environment.
4. Claude Code can accept, post progress, block or complete, and attach evidence.
5. Replit Luca can acknowledge the returned outcome.
6. Duplicate writes and adapter retries create no duplicate lifecycle events.
7. The same thread is visible through ledger APIs and compatible inbox projections.
8. Coordination continues when neural indexing is unavailable.
9. Authentication preserves actor attribution without preventing collaboration among Luca's hats.
10. The new ledger is then used to coordinate the Alden and HolaHola adapter phases.