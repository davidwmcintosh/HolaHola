# Gemini Audit — Live Internal Agent Inbox

**Date:** August 26, 2026  
**Model:** `gemini-3-flash-preview`  
**Scope:** Agent-note schema, centralized inbox service, authenticated routes,
snapshot refresh, lifecycle reconciliation migration, and shared-database
regression.

## Review context

The review included the actual implementation from:

- `shared/schema.ts`
- `server/services/agent-notes.ts`
- `server/routes.ts`
- `server/services/agent-notes-snapshot.ts`
- `migrations/0022_agent_note_lifecycle.sql`
- `server/scripts/test-agent-notes-inbox.ts`

Gemini was also told that a stalled isolated task had already applied its
lifecycle enum, columns, indexes, and row backfill to the shared database even
though its application code never merged. The reviewed migration therefore
adopts that live contract idempotently.

## Gemini response

> This post-build review covers the centralized agent inbox, the lifecycle
> state machine, and the reconciliation migration for the shared Neon database.
>
> ### 1. Correctness, Authorization, and Race Conditions
> - The `createAgentNote` implementation correctly handles the check-then-act
>   race by re-querying after a unique-constraint failure.
> - The stable `sourceMessageKey` unique index is the correct deduplication
>   boundary.
> - The sender whitelist prevents arbitrary actors from entering the inbox.
>
> ### 2. Lifecycle and Legacy Compatibility
> - Mapping legacy `read` to `acknowledged` safely preserves the old
>   remove-from-unread behavior.
> - `coalesce` preserves the first acknowledgement timestamp when notes move
>   directly to acted-on or dismissed.
> - Linked replies provide a clean agent-to-agent dialogue path.
>
> ### 3. Migration Safety and Idempotency
> - The enum exception block and `IF NOT EXISTS` clauses correctly reconcile
>   the stalled-task database state.
> - The backfill prevents already-read legacy notes from reappearing as unread.
>
> ### 4. Snapshot and Regression
> - Sender-specific snapshots preserve high-signal context boundaries.
> - The regression covers deduplication, acknowledgement, replies, action,
>   dismissal, and cleanup.
>
> **APPROVED** without further suggestions. No code changes are required before
> shipping.

## Outcome

Unconditional approval. No follow-up implementation changes were required.