# Implementation Plan: Raw Replit Output Capture

## First delivery boundary

The Replit host does not expose a live chat-window API to this workspace. The first
delivery therefore captures every exact source event that reaches the current trusted
collector:

1. David’s exact message supplied to `record-exchange`;
2. the exact four-channel Luca output emitted by `record-exchange`;
3. existing retained raw-window evidence routed through `record-window`.

Browser-visible blocks that do not reach either collector remain an explicit host-ingress
gap. This delivery must never claim they were captured.

## Ordered steps

1. **Add dedicated raw evidence schema**
   - Define `raw_replit_capture_streams`, `raw_replit_capture_events`, and
     `raw_replit_projection_links` in `shared/schema.ts`.
   - Use defaults for all new required values so no backfill is needed.
   - Enforce one stream per canonical `turnId`/source key, ordered unique event
     sequences per stream, and idempotent projection links.

2. **Create DB-first raw capture repository**
   - Add `server/services/raw-replit-capture.ts`.
   - Accept a turn ID, source route, event list, and optional host metadata.
   - Hash exact UTF-8 payloads; insert/reuse the stream and its ordered events in one
     transaction; verify the persisted event count and hashes before returning.
   - Expose an explicit `capture-unavailable` result for test/recovery boundaries;
     never return success when durable storage failed.
   - Add a link function for the later `.chat_capture` projection range.

3. **Integrate the trusted `record-exchange` collector**
   - Persist David/Luca exact source events using the canonical inner-life `turnId`
     before writing either `.chat_capture` turn.
   - If raw persistence fails, do not append `.chat_capture` and return a non-zero
     error—no false canonical acknowledgement.
   - After the file append, link both raw events to the exact capture byte range and
     preserve the existing cursor acknowledgement behavior unchanged.
   - Treat the composed four-channel Luca envelope as the exact emitted Luca source;
     do not introduce a semantic parser at ingestion.

4. **Bring existing raw-window intake into the domain model**
   - Keep the current `context_lineage_events` evidence ledger for historical and
     compatibility audit events.
   - Have `persistRawWindowEvidence` also persist the exact source through the new
     raw-capture repository, keyed by its SHA-256 source identity.
   - Link the raw-window source as `evidence` or `unresolved`; do not alter its
     attribution rules or project it as dialogue.

5. **Surface status and audit facts**
   - Add a compact raw-capture summary to capture status: source durability,
     event/byte total, projection-link count, and explicit ingress capability.
   - Keep this separate from the existing raw-window reconciliation summary and
     from DB/Markdown parity.

6. **Test and validate**
   - Add hermetic repository tests for ordering, idempotent retry, mismatch rejection,
     raw-before-projection refusal, and link uniqueness.
   - Extend the `record-exchange` self-check with a test seam or fixture to prove raw
     persistence is attempted before `.chat_capture` append and failure blocks append.
   - Extend raw-window regression coverage to prove exact source persistence in the
     new evidence tables without changing dialogue attribution.
   - Run database push only after code and tests are ready; restart the application,
     run typecheck, focused regressions, system health, and an acknowledgement smoke
     test.

## Non-goals for this delivery

- Browser automation or scraping of Replit chat UI.
- Capture of host events not emitted to the workspace.
- Rewriting historical episodes.
- Changes to Daniela prompts, tools, or attribution behavior.