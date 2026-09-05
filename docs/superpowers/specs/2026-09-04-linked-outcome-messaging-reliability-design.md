# Linked Outcome Messaging Reliability

**Date:** September 4, 2026  
**Status:** Approved direction; implementation pending written-spec review  
**Review:** David approved the combined transport and ledger approach. Alden Gemini approved with transactional, idempotent completion and strict causal validation.

## Purpose

When work begins from an agent note or canonical coordination thread, the person who raised it must receive a linked outcome before repository-controlled work is considered complete.

The system must also preserve honest lifecycle language:

- `delivered` means the message was durably stored in the recipient's inbox;
- `seen`, `acknowledged`, and `acted_on` remain separate later states;
- `notified` is not introduced or inferred by this work.

The canonical Episode record is not a substitute for replying to the waiting sender.

## Scope

This design combines two reliability layers:

1. **Transport reliability:** both Luca hats can reply through one actor-authenticated, identity-derived, idempotent path that verifies recipient-inbox storage.
2. **Ledger reliability:** canonical work with a known note origin cannot enter `completed` without a linked outcome reply and valid causal evidence.

This work does not:

- add a `notified` lifecycle state;
- claim that inbox storage proves active interruption or human/model attention;
- change Daniela's context or behavior;
- require a SQL migration;
- pretend the repository can intercept Replit's external `markTaskComplete` callback.

## Authentication and Identity

`POST /api/agent/notes/:id/reply` will use actor-scoped coordination authentication instead of the legacy Luca-Replit-only middleware.

The server derives all identity fields:

| Authenticated actor | Stored inbox identity | Parent inbox required |
| --- | --- | --- |
| `luca-replit` | `agent` | `agent` |
| `luca-claude-code` | `luca-claude-code` | `luca-claude-code` |

For an accepted parent note:

- sender is derived from the authenticated actor;
- recipient is derived from the parent note's sender;
- `in_reply_to_id` is the parent note ID;
- callers cannot provide or override sender or recipient;
- self-replies and unsupported sender/recipient pairs are rejected;
- an actor cannot reply to a note addressed to another actor's inbox.

Legacy `agent` storage remains for compatibility, but authentication and authorization use canonical actor identities.

## Canonical Reply-and-Verify Operation

A focused service operation and CLI command will:

1. authenticate as one coordination actor;
2. load and authorize the parent note;
3. create the linked reply with a required stable idempotency key;
4. verify that the exact reply exists in the recipient's inbox;
5. return `delivered` only after durable storage is confirmed.

Retries with the same key and same payload return the existing reply. Reuse of the key with conflicting content fails closed.

The operation never reports `seen`, `acknowledged`, `acted_on`, or `notified`.

## Typed Agent-Note Origins

`CoordinationEvidenceReference` gains an `agent_note` type. Because references are stored in existing JSONB columns, this is a TypeScript/API contract change and does not require database DDL.

An agent-note-origin thread uses:

- `type: "agent_note"`;
- the parent note ID as `identifier`;
- a provider identifying the canonical agent-note service;
- an optional digest or metadata for integrity, without copying message bodies into the ledger.

The referenced note must exist when the thread is created or completed. The reference cannot name a note outside the authenticated actor's permitted communication path.

## Causal Validation

Whenever `causalParentEventId` is supplied, the service validates that the parent:

- exists;
- belongs to the same coordination thread;
- has a lower sequence number than the new event.

For completion, the causal parent identifies the earlier progress or evidence event that supports the outcome. It does not represent delivery, reading, acknowledgement, or notification.

Cross-thread, missing, future, or self-referential causal parents are rejected before mutation.

## Completion Contract

Existing immutable-evidence requirements remain in force.

### Threads without an agent-note origin

Completion behavior remains unchanged except for causal-parent validation.

### Threads with an agent-note origin

Completion requires:

1. immutable completion evidence under the existing ledger rules;
2. a linked reply whose `in_reply_to_id` matches the origin note;
3. sender and recipient consistent with the origin and completing actor;
4. verified durable inbox storage;
5. a stable idempotency key;
6. a valid same-thread causal parent when one is supplied.

Missing or invalid linked outcomes reject completion without changing thread state.

## Transactional Repository-Controlled Completion

A `completeWithLinkedOutcome` service boundary will coordinate repository-controlled completion:

1. validate actor ownership, origin note, expected sequence, evidence, and causal parent;
2. create or recover the idempotent linked reply;
3. verify durable recipient-inbox storage;
4. append the canonical `completed` event;
5. update the thread state;
6. return both the linked-reply receipt and completion event.

The database work runs atomically where both records use the shared database transaction. If verification depends on an HTTP adapter, the operation uses an outbox/idempotent retry boundary rather than holding a database transaction across the network.

No state may report completion while the required linked outcome is absent. A retry after an uncertain response must recover existing records, not duplicate them.

### Reply-delivered, completion-pending recovery

All completion preconditions are validated before first attempting reply delivery. The transaction locks or conditionally updates the coordination thread so a known stale sequence fails before creating a new reply.

If the linked reply is nevertheless already durably delivered and a later completion append loses a sequence race or fails another ledger precondition:

- the delivered reply is preserved and never deleted or hidden;
- the thread remains incomplete;
- the operation returns a distinct `delivery_succeeded_completion_pending` conflict with the reply receipt and current thread sequence;
- callers retry completion using the same operation idempotency key and a refreshed expected sequence;
- the retry recovers the existing reply and appends at most one completion event;
- logs and user-facing status say “outcome delivered; completion pending,” never “completed.”

This state is a recoverable partial success, not an atomic rollback claim. The local-database path should make it rare through one transaction; the outbox path must make it explicit and safely retryable.

## External Replit Task Completion

The repository cannot intercept or change Replit's external `markTaskComplete` implementation.

Project instructions and the task-capture workflow will therefore require:

1. identify whether the assignment originated from an agent note or coordination thread;
2. run the canonical linked-outcome operation;
3. verify `delivered`;
4. only then invoke external task completion.

If origin metadata exists and linked delivery cannot be proved, the agent must report the task as technically implemented but communication-incomplete rather than marking the loop fully closed.

## Lifecycle Separation

This work preserves independent evidence:

- reply row exists: `delivered`;
- recipient reads inbox: `seen` or read evidence;
- recipient explicitly acknowledges: `acknowledged`;
- recipient records action: `acted_on`;
- coordination outcome accepted: `outcome_acknowledged`.

None of these states may be inferred from another.

`notified` remains unavailable until the alert bridge separately proves and ships an active-interruption mechanism.

## Error Handling

The API uses explicit failures:

- `401`: missing or invalid coordination credential;
- `403`: actor does not own the parent inbox or communication route;
- `404`: parent note or causal event does not exist;
- `409`: idempotency conflict, stale expected sequence, missing linked outcome, invalid completion precondition, or `delivery_succeeded_completion_pending`;
- `503`: ambiguous credential binding or unavailable durable storage.

Failures do not silently downgrade to unlinked note creation or ordinary completion.

## Compatibility

- Existing note rows using stored sender `agent` remain readable.
- Existing Luca-Replit clients must move from `x-agent-token` to their dedicated coordination credential for the reply route.
- Read routes retain actor-scoped inbox authorization.
- Threads without `agent_note` origins retain their current completion behavior.
- No existing lifecycle value changes meaning.

## Verification

Regression coverage must prove:

### Reply authentication

- Luca Replit can reply to a note addressed to `agent`.
- Luca Claude Code can reply to a note addressed to `luca-claude-code`.
- each actor is rejected from the other's inbox;
- sender and recipient are derived, not caller-controlled;
- self-replies and unsupported routes fail;
- invalid or ambiguous credentials fail closed.

### Reply integrity

- `in_reply_to_id` points to the authorized parent;
- identical retries deduplicate;
- conflicting idempotency-key reuse fails;
- recipient-inbox read confirms durable storage;
- storage reports only `delivered`;
- unread delivery does not become seen, acknowledged, acted on, or notified.

### Ledger enforcement

- ordinary threads retain existing completion behavior;
- agent-note-origin threads reject completion without a linked reply;
- a valid linked reply permits completion;
- wrong sender, wrong recipient, or wrong parent does not satisfy completion;
- missing, cross-thread, future, and self-referential causal parents fail;
- a valid earlier same-thread causal parent succeeds;
- retries cannot duplicate replies or completion events.
- a reply-delivered/completion-race result preserves the reply, keeps the thread incomplete, and succeeds on an idempotent retry with a refreshed sequence.

### External completion procedure

- the completion checklist and helper require linked-delivery evidence when origin metadata exists;
- work with no message origin remains unaffected;
- static regression coverage detects removal of the checklist/guard.

## Success Criteria

The change is complete when:

1. both Luca hats can use the same actor-authenticated reply contract;
2. the demonstrated 401 path has regression coverage;
3. sender identity cannot be forged through request data;
4. linked reply delivery is idempotent and verifiable;
5. agent-note-origin coordination work cannot complete without that reply;
6. causal event links are validated;
7. external completion instructions require the reply first;
8. every interface distinguishes delivery from later lifecycle states;
9. focused tests, TypeScript, system health, and application startup pass.