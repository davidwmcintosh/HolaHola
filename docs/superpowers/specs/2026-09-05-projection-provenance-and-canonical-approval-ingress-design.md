# Projection Provenance and Canonical Approval Ingress

**Date:** September 5, 2026  
**Status:** Approved design; awaiting written-spec review  
**Owner:** Luca [Replit]

## Purpose

Fix two failures exposed by Luca [Claude Code]:

1. Runtime DB-to-file projections can appear in an agent's Git working tree
   without enough evidence to distinguish them from that agent's own edits.
2. The same actionable design approval can independently exist in
   `agent_notes` and the coordination ledger, leaving two incomplete causal
   histories and ambiguous implementation authority.

The database remains canonical for episode and mailbox content. The
coordination ledger becomes canonical for tracked decisions and approvals.

## Scope and boundaries

This build will:

- Add immutable projection receipts for successful DB-to-file writes that
  actually change bytes.
- Cover generated episode Markdown and the mailbox Markdown/JSON projection
  pairs involved in the reported incident.
- Teach source reconciliation to identify generated changes using verified
  receipts rather than attributing them to the current agent.
- Route actionable direct `agent_notes` replies into exactly one coordination
  thread/event before they count as approval.
- Prevent coordination-delivered notes from looping back into new ledger
  threads.
- Reconcile the two known alert-bridge approvals by their exact note and thread
  identifiers while preserving both source records.
- Deliver the verified result to Luca [Claude Code] through the existing
  coordination thread.

This build will not:

- Change Daniela prompts, tools, voice, or context injection.
- Change ordinary informational notes into coordination threads.
- Infer duplicate decisions through prose similarity.
- Delete or rewrite either historical alert-bridge approval.
- Modify the fresh-database context-lineage work currently owned by task 1395.
- Introduce a database schema migration unless existing correlation fields
  prove insufficient during implementation review.

## Part 1: projection provenance

### Receipt

After a successful projection that changes file bytes, the writer emits one
append-only receipt containing:

- Workspace-relative destination path.
- Projection kind and writer identity.
- Canonical source type and exact source identifiers.
- Previous SHA-256 hash or an explicit missing-file marker.
- Resulting SHA-256 hash.
- Reason/trigger.
- Projection timestamp.
- Optional coordination, capture, or mailbox identifiers.

A no-op regeneration with identical bytes emits no receipt. A failed or partial
write emits no successful receipt.

### Atomicity

The destination is written atomically where the current writer already supports
it. The writer hashes the resulting bytes after the successful rename/write and
then appends the receipt atomically. A receipt can therefore prove a completed
projection, never merely an attempted one.

### Reconciliation behavior

Source reconciliation may classify a changed generated path as externally
projected only when:

- A receipt exists for that exact path and resulting hash.
- The projection kind is permitted for that path.
- The current file bytes still match the receipt.
- Existing canonical-format and DB-authority checks pass.

Otherwise the change remains ambiguous and fails closed. Reconciliation reports
the writer, source identity, reason, and receipt timestamp. It does not silently
stage, discard, or commit the projection.

## Part 2: canonical approval ingress

### Authority

The coordination thread and its events are the authoritative lifecycle for any
tracked request, review, approval, rejection, or completion. `agent_notes`
remains:

- A delivery adapter for ledger events.
- A compatibility inbox.
- An ingress surface for direct replies from older clients.

An informational note may remain notes-only. A reply that changes the lifecycle
of a tracked request must resolve to the ledger first.

### Exact identity resolution

Ingress resolves identity using explicit data only:

- Note ID and `inReplyToId`.
- `sourceMessageKey`.
- Coordination adapter delivery `externalReference`.
- Coordination event/thread identifiers embedded by the adapter.
- Thread `sourceReference`.

Ledger-projected notes are recognized through their deterministic coordination
source keys and delivery records. Replies to them append to the originating
thread. They never create a second thread.

For an actionable legacy note with no existing ledger identity, ingress creates
one thread with an exact `agent_note` source reference and appends one event
using an idempotency key derived from the note/reply ID. Retries and concurrent
delivery converge on the same event.

### Loop prevention

- Ledger event → projected note is delivery.
- Reply to projected note → event on the same thread is ingress.
- That ingress event may generate a recipient delivery, but deterministic
  source keys and adapter records prevent the same note from being re-imported.
- A note already bearing a coordination source key cannot originate a new
  thread.

## Part 3: alert-bridge reconciliation

A dedicated reconciliation operation accepts the exact legacy approval note ID
and exact coordination thread ID.

It:

1. Verifies both records exist and concern the named alert-bridge decision.
2. Preserves both records unchanged.
3. Selects the coordination thread as canonical.
4. Appends an imported historical-approval event carrying the exact note
   reference and timestamp.
5. Records deterministic idempotency so reruns are no-ops.
6. Produces a comparison of the two approval conditions for operator review.

It does not infer equivalence, close unrelated threads, or fabricate a delivery
receipt.

## Error handling

- Missing or mismatched source IDs fail closed.
- Receipt hash mismatch leaves the file classified as ambiguous.
- Partial projection failure does not produce a success receipt.
- Unknown note lineage remains notes-only and cannot silently count as ledger
  approval.
- Conflicting exact mappings return an explicit error for operator resolution.
- Reconciliation is append-only and idempotent.

## Verification

Focused tests must prove:

- Changed projections produce accurate before/after receipts.
- Byte-identical projections do not create receipt churn.
- Failed writes do not produce success receipts.
- Receipts cannot classify a different hash or unauthorized path.
- Source reconciliation reports generated provenance without mutating Git.
- Direct actionable note replies create or resolve exactly one ledger identity.
- Replies to ledger-projected notes append to the original thread.
- Retries and concurrent replies are idempotent.
- Ordinary informational notes remain notes-only.
- The alert-bridge reconciliation preserves both records and appends one
  canonical historical event.

Final verification includes the project typecheck, focused suites, system-health
verification, an architecture review, and a clean application restart. No
shared-database destructive fixture is permitted.

## Implementation ownership

The build should be split into two isolated code slices:

1. Projection receipt writer plus source-reconciliation integration.
2. Note-to-ledger ingress plus explicit alert-bridge reconciliation.

The slices may proceed in parallel after confirming their file boundaries. The
main agent owns integration, documentation, final review, and the reply to Luca
[Claude Code].