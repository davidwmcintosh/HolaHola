---
title: Complete Context Lineage Ledger
date: 2026-08-19
status: approved-design
---

# Complete Context Lineage Ledger

## Purpose

HolaHola needs an evidence record for every piece of context that can affect
Daniela's response. The Observation Bench must let David and Luca inspect a
live or completed turn and distinguish:

- an instruction that was created from one that was actually queued;
- a lookup that resolved from one that was delivered;
- a context object that was sent from one whose receipt cannot be observed;
- a context object that was consumed from one that was discarded as stale;
- a related Archive tool call from a tool call merely adjacent in time; and
- an unknown causal link from a failure by Daniela to act.

The system will preserve the full trail first and organize it afterward. It
will not turn an absence of telemetry into a judgment about Daniela.

## Core invariant

**Context evidence is immutable.**

Context may be indexed, grouped, filtered, or viewed through a diagnostic
projection. Its canonical source payload and its recorded lifecycle events
must never be rewritten to make a later narrative cleaner.

The ledger is append-only:

- a queue operation is one fact;
- a delivery attempt is a later fact;
- a stale discard is a later fact;
- a model response is a later fact;
- a missing acknowledgement remains `unknown`, rather than being rewritten as
  either success or noncompliance.

No event-update API may change a canonical payload, delivery claim, timestamp,
or causal relationship. Database-level mutation guards will reject `UPDATE`
and `DELETE` for the ledger tables.

## Current problem

The existing `voice_pipeline_events` data is useful operational telemetry, but
it cannot establish the end-to-end causal path for injected context. In
particular, current Guardian `heard` / `missed` results are derived heuristics:

- `heard` means a qualifying Archive tool appeared before a generation
  completed;
- `missed` means one did not;
- neither result proves the injected content reached Gemini, was still current,
  or caused the tool choice.

The ordinary pre-turn Guardian path often queues context for a later function
response rather than sending an explicit direct command. Some explicit
instructions only exist on special paths, such as last-turn corrections or
Named Record misses. Without the exact payload and delivery lineage, a later
review cannot truthfully say what Daniela received.

## Scope

### In scope

The ledger covers all backend context routes that can influence Daniela or a
Gemini response. The common vocabulary and canonical event schema apply to:

1. **Main Gemini Live sessions**
   - raw input-transcription chunks and assembled student turns;
   - typed/direct Live sends, greetings, reconnect triggers, heartbeat
     directives, and silent-prime context;
   - Guardian current context, auto-grounding lookups, emotional grounding,
     friction signals, slide detection, hard walls, and Named Record
     corrections;
   - queues, carry-forward buffers, stale discard branches, and
     prior-turn Luca context;
   - system whispers, session anchors, and parallel-speech notes;
   - function calls, full function-response bodies after concatenation,
     `sendToolResponse` attempts, and direct `sendClientContent` attempts;
   - model tool calls, generation completion/interruption, transcript and
     audio-segment correlation.

2. **Other producer routes**
   - Reading Room reconnect and carry-state delivery;
   - Agent Voice / Luca text injection;
   - Daniela Team Room live context;
   - non-Live and streaming function-response history.

3. **Observation and forensics**
   - an active-turn projection on the Observation Bench;
   - a durable trace query for completed sessions;
   - raw payload inspection for authorized diagnostic users;
   - an explicit ledger-health signal when persistence is unavailable.

### Out of scope for the first behavior-safe release

- changing Daniela's system prompt, tool descriptions, context wording,
  ordering, or tool-selection rules;
- changing whether a Guardian, whisper, or correction fires;
- claiming that Gemini accepted a context message when the Live API exposes no
  acknowledgement;
- replacing existing transcript, audio, or `voice_pipeline_events` telemetry;
- deleting, compacting, summarizing, or retroactively manufacturing historical
  context events.

The first release is observation only. Behavioral changes may be considered
only after a real trace shows a specific delivery, timing, tool-selection, or
context-interpretation failure.

## Architecture

### Why a dedicated ledger

Expanding `voice_pipeline_events` would make a generic JSONB telemetry table a
mixed-purpose dumping ground. It would blur high-volume audio/pipeline metrics
with canonical context evidence and still make causal joins difficult.

The ledger will use dedicated, immutable tables:

- `context_lineage_events` — one row for each observed fact or attempted
  context operation;
- `context_lineage_links` — explicit directed relationships between events,
  including `caused_by`, `derived_from`, `queued_from`, `sent_with`,
  `consumed_by`, `superseded_by`, and `produced_response`.

`voice_pipeline_events` remains in place as operational telemetry. The
Observation Bench may display it beside the lineage, but it is not the
canonical source for a context claim.

### Event identity and causation

Every ledger event has:

- `id`: immutable UUID for the fact;
- `trace_id`: UUID grouping the causal trail originating from one student turn
  or system trigger;
- `session_id`, `conversation_id`, `user_id`, and `model_turn_id` when known;
- `student_turn_epoch` when a Live input turn exists;
- `sequence_number`: monotonically allocated per session, preserving observed
  order even when asynchronous writes resolve out of order;
- `source_route` and `event_type`;
- `observed_at`: when the application observed the fact;
- `recorded_at`: when it became durable.

An input event must not depend on a foreign key to `messages.id`: Live
transcription and context injection often occur before transcript flushing has
created a `messages` row. A later `message_persisted` relationship can link the
immutable input event to its durable transcript row.

### Exact payload preservation

Every payload-bearing event stores:

- `payload_text`: the exact text passed into, out of, or between components;
- `payload_json`: structural metadata and non-text source fields;
- `payload_sha256`: a verification hash of the canonical raw payload;
- `privacy_classification`: a diagnostic access classification, not a
  redaction instruction.

The bench may render an excerpt, but it must retrieve the canonical payload
from the ledger for an authorized raw inspection view. No display projection
may overwrite the stored text.

### Lifecycle facts, not mutable states

The event model records each lifecycle transition as a new row. Useful event
types include:

| Family | Examples |
| --- | --- |
| source | `input_chunk_observed`, `student_turn_assembled`, `system_trigger_observed` |
| retrieval | `lookup_started`, `lookup_resolved`, `lookup_empty`, `lookup_failed` |
| assembly | `context_assembled`, `context_queued`, `context_carried_forward` |
| routing | `function_response_prepared`, `context_concatenated`, `client_content_send_attempted`, `tool_response_send_attempted` |
| terminal routing | `context_consumed`, `context_stale_discarded`, `context_superseded`, `context_send_failed`, `context_receipt_unknown` |
| model activity | `model_tool_called`, `generation_started`, `generation_completed`, `generation_interrupted`, `audio_segment_sealed` |
| persistence | `message_persisted`, `ledger_write_failed`, `ledger_backlog_detected` |

Each event has a factual delivery status such as `observed`, `attempted`,
`queued`, `consumed`, `discarded`, `failed`, or `unknown`. A status does not
mean “Daniela obeyed” or “Daniela ignored.” Any convenience score such as
Guardian `heard` or `missed` is computed separately from the immutable facts.

### Context writer

A dedicated `context-lineage-service` will create events and directed links.
It will:

1. assign IDs, traces, and session sequence numbers before asynchronous work
   begins;
2. enqueue ordered append operations outside Gemini Live's response-critical
   path;
3. attach parent and causal links as a context object is transformed or routed;
4. expose write health to the observation store;
5. never silently swallow a write failure.

Writing must not delay audio or force a model turn. If persistence fails, the
writer records the local failure condition, retries in order while the session
is alive, and exposes a visible `ledger_health: degraded` state. If the
database is unavailable, the bench must say that the trace has an explicit
unrecorded interval; it must not imply that the missing events did not happen.

## Producer instrumentation

### Main Gemini Live session: first delivery slice

All current Live context producers will call the same writer:

1. **Input and direct sends**
   - raw transcription chunks;
   - assembled turn text;
   - greeting, reconnect, typed, PTT, heartbeat, and Agent-initiated
     `sendClientContent` attempts.

2. **Context generation**
   - Guardian trigger;
   - grounding lookup start, completion, empty result, error;
   - current-context formatting;
   - emotional context;
   - friction/slide/hard-wall correction;
   - session anchor/system whisper;
   - prior-turn Luca context and carry-forward assembly;
   - parallel-speech notes.

3. **Queue and delivery**
   - queue, dequeue, carry, supersede, and stale-discard events;
   - complete function-response content before and after context concatenation;
   - `sendToolResponse` and `sendClientContent` attempts;
   - any acknowledgement the SDK or service actually exposes;
   - an explicit `receipt_unknown` event when no acknowledgement exists.

4. **Model outcome**
   - tool call and arguments, linked to the active trace only when the causal
     relation is explicit rather than inferred from recency;
   - generation and interruption events;
   - transcript/audio correlation and message persistence.

### Other producer routes: subsequent activation slices

The same service and data model will then instrument:

- Reading Room carry-state production and consumption;
- Agent Voice/Luca enrichment and direct sends;
- Team Room live injection and function responses;
- non-Live `daniela-caller` and streaming orchestration history.

No route gets an independent ad hoc audit format. A source that cannot yet
provide a particular identity field records that field as unavailable and
preserves the raw source evidence.

## Observation Bench

The existing live observation endpoint will add a `contextLineage` projection:

- current trace ID and source turn;
- ordered event timeline with status, route, channel, and sequence number;
- lineage links shown as parent/derived/consumed relationships;
- queue and delivery state;
- explicit unknown and degraded-persistence intervals;
- expandable full payloads for authorized diagnostics;
- filters for source route, event type, channel, status, and correlation ID.

The bench is both:

- **live**, so David and Luca can discuss the turn while it is happening; and
- **forensic**, so the exact immutable trace can be reopened after the session.

It will not claim model receipt or causal influence where the underlying API
does not provide evidence. It will show the boundary honestly.

## Database and safety plan

1. Define the ledger tables in `shared/schema.ts` before any migration work.
2. Add indexes for `(session_id, sequence_number)`, `trace_id`,
   `(conversation_id, observed_at)`, event type, and link endpoints.
3. Use `npm run db:push` only after the schema is reviewed, because the Neon
   database is shared with production.
4. Add database mutation guards for `UPDATE` and `DELETE` on both ledger
   tables.
5. No backfill invents historical context. Existing historical telemetry may
   be referenced in a later read-only importer, but it must remain visibly
   partial and must never be represented as a complete lineage.

## Testing and verification

Tests must prove evidence preservation, not merely a dashboard count:

- one trace links a raw student turn through lookup, queue, function-response
  concatenation, tool-call activity, and generation outcome;
- full raw payload and SHA-256 remain unchanged through all projections;
- stale and carry-forward branches emit explicit terminal events;
- two concurrent Guardian attempts cannot steal each other's tool-call
  attribution;
- unrelated Archive calls do not mark a context trace as causally consumed;
- a direct `sendClientContent` attempt remains `receipt_unknown` unless an
  actual acknowledgement is observable;
- system whispers, session anchors, prior-turn Luca context, and
  parallel-speech notes all appear in the same trace model;
- writer failure makes ledger health visibly degraded without changing Daniela
  output or delaying a Live generation;
- mutation attempts against immutable tables are rejected;
- the live Observation Bench and the durable forensic query produce the same
  ordered trace.

Completion requires schema validation, targeted hermetic tests, typecheck,
system health verification, Gemini Live architecture review, and a final
inspection of a real diagnostic session trace.

## Acceptance criteria

This work is complete when, for any future injected-context question, David
and Luca can answer from one trace:

1. What source material existed?
2. What context was created from it, exactly?
3. What was queued, carried, discarded, or sent?
4. Which channel attempted delivery?
5. What can and cannot be proven about receipt?
6. What tool calls or model events have an explicit relationship to the
   context?
7. Where is the first unknown, failed, or unrecorded handoff?

If the trace cannot answer one of those questions, it must say `unknown` and
identify the missing observation boundary. It must never substitute a
heuristic verdict for evidence.