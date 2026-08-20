# Context Lineage Ledger — Implementation Plan

**Design:** `docs/superpowers/specs/2026-08-19-context-lineage-ledger-design.md`  
**Goal:** Preserve every backend context intervention affecting Daniela as
immutable, causally linked evidence, then project the same evidence to the live
Observation Bench and forensic reports.

## Non-negotiable constraints

- Context evidence is append-only and database-enforced immutable.
- Canonical payloads are complete; UI excerpts are projections, not
  replacements.
- `unknown` stays unknown. No heuristic may become a delivery or compliance
  claim.
- Initial instrumentation does not alter Daniela-facing prompt text, tool
  descriptions, context ordering, or tool-selection behavior.
- The shared Neon schema is additive only; no existing data is rewritten,
  compacted, or backfilled as if historical telemetry were complete.
- Ledger writes cannot sit in Gemini Live's audio/generation-critical path.
  A persistence gap must be visible as a gap, not silently swallowed.

## Implementation sequence

### 1. Confirm Gemini Live observability boundaries before code

**Files / inputs**
- `server/services/gemini-live-session.ts`
- current Live send/response code around `sendClientContent`,
  `sendToolResponse`, Guardian concatenation, reconnect, generation-complete,
  interruption, audio, and transcript callbacks.

**Work**
- Run the required Gemini Live architecture pre-flight with the actual code.
- Confirm which SDK/API operations have observable acknowledgement semantics.
- Define the exact events that must end in `receipt_unknown` because the API
  cannot prove model receipt.
- Confirm that adding asynchronous recorder calls cannot alter Live turn
  completion semantics.

**Done when**
- The plan names only receipts the API can honestly support.
- Any Gemini finding changes this plan before implementation starts.

**Pre-flight findings incorporated**
- Use the existing `activeStudentTurnEpoch` as the primary Live correlation
  boundary. A lineage writer must never attach a completed asynchronous lookup
  to a later student epoch.
- Record `sendClientContent` as a dispatched, unacknowledged attempt. The Live
  SDK does not expose a per-message model receipt.
- Record `sendToolResponse` as a transmitted response batch. A later server
  event may be correlated as a proxy, but it is not a direct content receipt.
- Record explicit `receipt_unknown` rather than deriving model consumption from
  either successful JavaScript invocation.
- Treat barge-in, call-ID guards, reconnect replacement, and interruption as
  terminal delivery facts. A context payload that the socket suppresses or
  drops must become `discarded_by_barge_in` or an equivalent explicit event.

### 2. Add immutable ledger schema and database guards

**Files**
- `shared/schema.ts`
- next migration under `migrations/`
- Drizzle migration metadata according to existing project conventions

**Work**
- Add `contextLineageEvents` with:
  - identity: `id`, `traceId`, `sessionId`, `conversationId`, `userId`,
    `modelTurnId`, `studentTurnEpoch`, and per-session `sequenceNumber`;
  - classification: `sourceRoute`, `eventType`, `deliveryChannel`, and
    factual status;
  - exact evidence: `payloadText`, `payloadJson`, `payloadSha256`, privacy
    classification, `observedAt`, and `recordedAt`;
  - indexed query paths for `(sessionId, sequenceNumber)`, `traceId`,
    `(conversationId, observedAt)`, event type, and source route.
- Add `contextLineageLinks` for directed `caused_by`, `derived_from`,
  `queued_from`, `sent_with`, `consumed_by`, `superseded_by`, and
  `produced_response` relationships.
- Add insert/select schemas and exported types with the rest of the shared
  schema declarations.
- Add explicit PostgreSQL guards that reject `UPDATE` and `DELETE` on both
  ledger tables.
- Apply the additive shared-Neon change only after schema review with
  `npm run db:push`; do not backfill invented history.

**Tests**
- Insert a row and link successfully.
- Assert attempted `UPDATE` and `DELETE` fail with the immutable-ledger error.
- Assert indexes and generated Drizzle types support the required queries.

### 3. Build the ordered append-only recorder

**New file**
- `server/services/context-lineage-service.ts`

**Work**
- Create session-scoped ledger contexts that allocate trace IDs and sequence
  numbers before any asynchronous work begins.
- Implement `recordEvent`, `recordLink`, `beginTrace`, and helpers for
  canonical payload hashing and source references.
- Serialize writes per session without awaiting them in Live response code.
- Record queue/backlog/write-failure health locally and expose it to the
  observation store.
- Retry writes in original order while the process remains alive.
- Preserve an explicit degraded/unrecorded interval if persistence cannot
  recover; never treat a failed write as an absent event.
- Use the project's established Neon/Drizzle conventions, not a new database
  client.
- Implement first as a session-local **shadow writer**: it observes lifecycle
  facts beside the Live path and never changes the payload, dispatch order, or
  return value of a Gemini call.

**Tests**
- Deterministic sequence ordering under asynchronously resolved writes.
- Stable payload hashing and exact payload preservation.
- Parent/link relationships for one trace.
- Retry order and explicit degraded health on write failure.
- No recorder failure can throw into a simulated Live response path.

### 4. Extend the in-memory observation projection

**Files**
- `server/services/session-observation-store.ts`
- `server/routes.ts` observation endpoint and response types

**Work**
- Add an active `contextLineage` projection keyed by conversation and trace.
- Project ordered event summaries, links, source turn, queue/delivery state,
  full-payload availability, and ledger health.
- Retain the existing short-lived live-store behavior while making clear that
  its display is a projection of durable evidence, not the durable source.
- Extend the observe endpoint with filters for trace, source route, event
  type, channel, and factual status.
- Return explicit `unknown` and degraded-persistence intervals.

**Tests**
- The live projection order matches the durable query order.
- Filters cannot hide a broken/unknown state by converting it to success.
- Full-payload authorization uses the canonical ledger record.

### 5. Instrument every main Gemini Live input and direct-send route

**Primary file**
- `server/services/gemini-live-session.ts`

**Work**
- Record raw input-transcription chunks and assembled student turns.
- Begin or advance an explicit trace for each student turn and system-originated
  trigger.
- Instrument greetings, typed/PTT turns, direct Agent sends, heartbeat
  directives, reconnect triggers, and silent-prime activity.
- Record each `sendClientContent` preparation and send attempt, including the
  exact payload, channel, completion flag, and an explicit unknown receipt
  boundary where no acknowledgment exists.
- Record generation start, completion, interruption, transcript flush, audio
  segment sealing, and eventual message persistence as linked evidence.

**Tests**
- A raw student turn remains byte-for-byte stable through its trace.
- Direct sends and reconnect sends retain their own source route and never
  impersonate student input.
- No send attempt is reported as accepted without a real observable receipt.

### 6. Instrument every main Gemini Live context transformation

**Primary file**
- `server/services/gemini-live-session.ts`

**Work**
- Record all Guardian facts: trigger, exact bound student text, lookup start,
  lookup result/empty/failure, formatting, queue, direct emotional send,
  tool-response concatenation, carry-forward, supersession, and stale discard.
- Record post-turn frictionless-slide and hard-wall correction lifecycles.
- Record prior-turn Luca context consumption and every carry-forward merge.
- Record system whispers, friction signals, session anchors, and
  parallel-speech notes with their raw assembled payloads.
- Record complete function-response bodies before and after all context
  concatenations.
- Record `sendToolResponse` preparation/attempt and the explicit link from
  the context payload to the response batch.
- Record the direct emotional `sendClientContent({ turnComplete: false })`
  route as a context-only injection attempt with `receipt_unknown` unless a
  later observable lifecycle fact establishes more.
- Instrument call-ID/reconnect/barge-in guards around tool-response dispatch.
  When a prepared batch is suppressed, replaced, or invalidated, append a
  terminal discard/interruption event linked to the original context rather
  than allowing it to look sent.
- Link model tool calls only when the code has an explicit active trace or
  caller-supplied causal ID; never infer causation merely from recency.
- Retain legacy Guardian `heard`/`missed` for compatibility but mark it as a
  derived heuristic in all new projection/report output.

**Tests**
- Guardian lookup → queue → concatenated response becomes one linked trace.
- Carry-forward and stale-discard produce terminal facts.
- Two concurrent/adjacent Guardian attempts cannot claim one another's tool
  call.
- Unrelated Archive calls do not create false `consumed_by` links.
- System whisper, session anchor, Luca context, and parallel-speech note all
  share the same evidence model.

### 7. Make the forensic report and live bench consume the ledger

**Files**
- `server/scripts/daniela-truth-pipeline-report.ts`
- `server/routes.ts`
- relevant Observation Bench client or admin display components, once their
  current consumer is identified

**Work**
- Add a dedicated Context Lineage section to the truth-pipeline report:
  trace header, source, exact lifecycle timeline, causal links, raw-payload
  hashes, delivery boundary, unknowns, and persistence health.
- Keep legacy pipeline data visible as compatibility evidence, labeled
  secondary/partial rather than complete lineage.
- Render the active trace as an expandable live timeline with raw-payload
  inspection and source/channel/status filters.
- Ensure the live and forensic views run from the same ledger queries and
  produce the same ordering.

**Tests**
- A hermetic fixture produces the same trace from the live projection and
  forensic report.
- The report cannot call an unacknowledged send “delivered” or a missing event
  “ignored.”

### 8. Add all non-main-Live producer routes to the same ledger

**Files**
- `server/unified-ws-handler.ts`
- `server/services/streaming-voice-orchestrator.ts`
- `server/routes.ts` Agent Voice / Luca paths
- `server/services/agent-session-autosave.ts`
- `server/services/daniela-team-room-live.ts`
- `server/services/team-room-ws-broker.ts` if it is the actual transport
  boundary
- `server/services/daniela-caller.ts`

**Work**
- Instrument Reading Room reconnect/carry-state creation, replacement,
  consumption, and stale state.
- Instrument Agent Voice/Luca text enrichment and direct Live sends.
- Instrument Team Room live injection and function responses.
- Instrument non-Live `daniela-caller` context assembly, function responses,
  continuation, and output.
- Instrument streaming-voice function-response history and WebSocket
  send/receive boundaries.
- Use the same event and link model everywhere; do not create route-specific
  audit formats.

**Tests**
- One representative trace from each producer route shares the same query and
  rendering contract.
- Reconnect and carry state preserve producer/consumer links without
  overwriting the original payload.

### 9. Verification, review, and rollout

**Required validation**
- migration/schema validation and immutable mutation-guard tests;
- targeted recorder, projection, producer, and report tests;
- `npm run check`;
- `npx tsx server/scripts/verify-system-health.ts`;
- a Gemini Live post-build audit with the actual final code, iterated until an
  unconditional all-clear;
- a real non-production Daniela diagnostic session inspected live through the
  new trace;
- confirm the user-visible response and tool behavior are unchanged by
  instrumentation alone.
- before `npm run db:push`, verify the shadow writer's ordered queue and
  epoch/call-ID handling in hermetic tests. If those guarantees are not
  demonstrated, stop before applying the shared production schema.

**Documentation**
- Update `docs/batch-doc-updates.md` and `docs/alden-agent-handoff.md`.
- Save meaningful Gemini/Alden architectural findings to
  `conversation_memories`.
- Add concise validation workflows for the ledger invariants if existing
  workflows do not already cover them.

## Delivery order

The ledger's *contract* is complete immediately. Implementation proceeds in
small, testable commits:

1. Gemini Live observability pre-flight;
2. schema, immutable guards, recorder, and recorder tests;
3. observation projection and forensic query;
4. complete main Live instrumentation by source family;
5. live bench/report presentation;
6. secondary producer routes;
7. real-session verification and post-build review.

No later slice may redefine or erase evidence from an earlier one. It may only
append new facts and new producer coverage.