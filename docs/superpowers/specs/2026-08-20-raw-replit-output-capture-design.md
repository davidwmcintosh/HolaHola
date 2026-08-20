# Raw Replit Output Capture and Projection

**Status:** Design approved for specification review  
**Date:** 2026-08-20  
**Owner:** HolaHola capture pipeline

## 1. Problem

The current capture pipeline can prove that a canonical conversation-memory row and
the rolling Episode Markdown replica agree. It cannot always prove that every block
visible in the Replit conversation window entered the capture stream in the first
place. A visible window can contain dialogue, tool activity, status output, and other
host-provided material. If those bytes are lost before the workspace collector sees
them, downstream DB/Markdown equality can look healthy while the record is incomplete.

The system needs a durable source record that precedes parsing, speaker attribution,
inner-life extraction, episode writing, and Markdown replication.

## 2. Design principles

1. **Capture first, interpret second.** Every raw event exposed to the collector is
   retained before semantic processing.
2. **Raw evidence is not dialogue.** Tool calls, tool results, status blocks, visible
   thinking, and unknown material remain source evidence unless a separate attribution
   step proves otherwise.
3. **The database is the durable source ledger.** Local files may be a transport
   spool or recovery aid, but a successful raw capture is not acknowledged until its
   DB record is durable.
4. **Replica equality is a separate invariant.** DB episode content must still be the
   sole source for `.md`; matching replicas do not imply complete source capture.
5. **Gaps fail visibly.** If the host does not expose a visible block to the collector,
   the audit reports an ingress gap. It must not infer or reconstruct the missing text.
6. **Idempotency is mandatory.** Retries, worker restarts, and watchdog takeover cannot
   duplicate raw source or derived dialogue.

## 3. Scope

### In scope

- Capturing every raw Replit event received by the workspace collector, in order.
- Persisting exact payload content and provenance in an append-only DB evidence lane.
- Recording event type, sequence/offset, timestamp, source/session identity, byte count,
  and SHA-256 hash.
- Acknowledging raw capture before downstream projection.
- Linking projected conversation-memory and episode spans back to raw source ranges.
- Auditing raw completeness, projection accounting, and DB/Markdown parity independently.
- Recovering safely when the DB, application process, or local transport fails.

### Out of scope

- Recovering bytes that Replit never emits to the collector.
- Inferring speakers or reconstructing missing dialogue from a raw window.
- Treating visible thinking, tool/status activity, or unknown blocks as Luca dialogue.
- Replacing `conversation_memories` with a raw transcript store.
- Capturing environment secrets or unrelated private runtime state merely because it is
  technically accessible to a process.

## 4. Existing baseline

The project already has related but narrower infrastructure:

- `context_lineage_events` is an append-only evidence table with `payloadText`,
  structured metadata, hashes, sequence numbers, and source/session identifiers.
- `raw-window-evidence-ledger.ts` stores supplied raw-window evidence and reconciliation
  metadata in that table.
- `record-window.ts` retains SHA-keyed local source files and currently treats manual
  window input as reference evidence unless it has a trusted provenance receipt.
- `raw-window-attachment.ts` classifies dialogue, visible thinking, UI status, and unknown
  spans without changing the original source.
- `capture-watchdog.ts` can drain the `.chat_capture` transport when the application
  autosave worker is unavailable.
- `record-exchange.ts` provides the current four-channel canonical dialogue handoff and
  waits for a cursor acknowledgement after downstream effects complete.

These pieces should be extended rather than bypassed. The key missing capability is a
first-class raw event intake path for the host stream, not another parser for manually
provided text.

## 5. Proposed architecture

```text
Replit host event stream
        |
        v
Raw event collector
        |
        | 1. append exact event to DB
        | 2. verify hash/sequence and commit
        | 3. issue raw-source acknowledgement
        v
Append-only raw evidence ledger
        |
        +--> attribution/reconciliation projection
        |        |
        |        +--> conversation_memories
        |        +--> rolling Episode DB content
        |        +--> exact Markdown replica
        |
        +--> completeness and provenance audit
```

The collector must sit at the earliest host boundary available to the application. It
must not depend on the semantic transcript parser to discover what happened. A raw
event is accepted as source evidence even when it cannot be parsed or attributed.

## 6. Durable data model

The implementation should introduce a dedicated raw-capture domain model rather than
using `conversation_memories` for source bytes. It consists of three tables:
`raw_replit_capture_streams`, `raw_replit_capture_events`, and
`raw_replit_projection_links`. The model needs these concepts:

### Capture stream

One `raw_replit_capture_streams` row identifies a host conversation/window stream:

- stable capture ID and source/session ID;
- source kind and host/collector version;
- opened, last-observed, and closed timestamps;
- expected/observed sequence or byte range;
- status: `open`, `complete`, `gap`, `failed`, or `recovery-required`;
- total event count, byte count, and final stream hash when closed;
- privacy classification and retention metadata.

### Raw event or chunk

One append-only `raw_replit_capture_events` row represents an event, or a bounded
chunk when host payloads are large:

- capture ID;
- monotonic sequence number and optional source byte offsets;
- host event ID when supplied;
- event type;
- exact payload bytes/text;
- payload byte count and SHA-256;
- observed timestamp and recorded timestamp;
- ingestion status and idempotency key, unique per capture stream;
- optional structured metadata that supplements, never replaces, the payload.

Chunking is preferred over a single unbounded row so a long-running window can be
committed incrementally and resumed after failure. Chunk boundaries must never alter
the original concatenated source representation.

### Projection link

A `raw_replit_projection_links` row links a projected span to one or more raw
event/chunk ranges. It records:

- raw capture and source range;
- target type and target ID (conversation memory, episode event, evidence appendix);
- attribution disposition: `dialogue`, `evidence`, `cleanup`, `unresolved`, or `not_projected`;
- named cleanup rule and byte count when applicable;
- audit timestamp and projection version.

The existing `context_lineage_events` ledger may carry compatibility metadata and
audit events, but the raw source model must remain queryable without interpreting
generic context-lineage payloads.

## 7. Capture and acknowledgement flow

For every host event:

1. The collector assigns or validates the stream sequence and computes the payload
   byte count and hash.
2. It performs an idempotent raw DB insert keyed by capture ID plus host event ID or
   sequence/offset.
3. It reads back or verifies the durable row and updates the stream checkpoint.
4. It emits a raw-source acknowledgement only after the DB commit succeeds.
5. A projection worker consumes acknowledged raw ranges and performs attribution and
   reconciliation.
6. The projection writes conversation memories and the DB-first rolling episode path.
7. The Markdown replica is derived from the freshly read canonical episode DB content.
8. The complete turn acknowledgement is emitted only after the raw source and required
   projections are both durable.

Raw persistence and projection must be separately retryable. A projection failure
must never cause the raw source to be discarded or rewritten.

## 8. Ordering, completeness, and gaps

An open live stream cannot be declared complete merely because the worker is idle. A
capture window becomes `complete` only when the host supplies an end boundary or the
collector records an explicit close checkpoint. Otherwise it remains open with a
current durable checkpoint.

The audit must distinguish:

- **raw complete:** the collector received a bounded source range without sequence or
  offset gaps;
- **raw partial:** the source ended without a trusted close boundary;
- **raw ingress gap:** expected host sequence/offset material was not received;
- **projection complete:** every raw span has a valid disposition;
- **replica equal:** Markdown exactly matches canonical DB episode content.

These statuses must not collapse into one “captured” boolean. A stream can have equal
DB/Markdown replicas while still being raw-partial or projection-incomplete.

## 9. Attribution and reconciliation rules

The raw source is never modified during parsing. Reconciliation can classify each
source span as:

- already-attested dialogue;
- explicitly labelled evidence;
- a named, byte-accounted cleanup transformation;
- unresolved discrepancy;
- not yet projected because the stream remains open.

Existing raw-window rules remain valid: no fuzzy speaker inference, no generated
reconstruction, no duplicate dialogue from repeated attachment, and no promotion of
unknown/status/visible-thinking material into ordinary Luca prose.

When a projection is intentionally incomplete, the audit must retain the exact raw
range and reason. “Not attributed” is an explicit result, not silent omission.

## 10. Failure and recovery

### Database unavailable

The collector writes to a bounded, hash-addressed local spool with a durable
checkpoint and marks the stream `recovery-required`. It must not acknowledge the raw
event as durable. On recovery, the spool is replayed idempotently and deleted only
after DB verification.

### Application restart

The collector resumes from the last DB-confirmed checkpoint. The application
autosave worker and `capture-watchdog` may compete for downstream projection work,
but raw intake and projection locks must prevent duplicate processing.

### Duplicate host event or retry

The idempotency key resolves to the existing raw event. The retry becomes a no-op and
does not create another memory, episode span, or Markdown block.

### Sequence/offset gap

The stream remains visibly incomplete. Later events may be stored, but the stream
cannot be marked complete until the gap is filled or explicitly closed as an ingress
gap. No synthetic replacement text is permitted.

### Projection failure after raw commit

The raw event remains acknowledged at the source layer and is retried by the
projection worker. The capture status reports raw durable / projection pending.

## 11. Audit interface and reporting

Provide a read-only audit path that accepts a capture ID or canonical episode scope
and returns:

- source completeness and checkpoint state;
- event count, byte count, and aggregate hashes;
- missing sequence/offset ranges;
- per-span projection dispositions;
- raw bytes not yet accounted for;
- projected dialogue/evidence/cleanup byte totals;
- DB episode hash and Markdown hash;
- exact DB/Markdown mismatch details, if any;
- linked conversation-memory and episode event identifiers.

The existing capture status page can summarize these results, but it must preserve the
separate dimensions of raw durability, source completeness, projection completeness,
and replica equality.

## 12. Privacy and access

Raw Replit output is private evidence. Access must be restricted to the existing
authorized administrative/agent paths. The collector must not intentionally capture
environment variables, credentials, tokens, or unrelated runtime internals. If the
host event payload includes sensitive values, the implementation must follow the
project's existing secret-handling policy rather than placing them in ordinary raw
evidence rows.

## 13. Testing strategy

Tests must cover the source and projection layers independently:

1. Every supported host event type is persisted byte-for-byte and in order.
2. A raw DB insert is acknowledged only after durable commit.
3. Restart resumes from the DB checkpoint without duplication.
4. Database outage spools and later replays events idempotently.
5. Duplicate host IDs and duplicate sequence/offset retries are no-ops.
6. Missing sequence/offset ranges produce a visible ingress gap.
7. Open streams cannot be reported as complete without a close boundary.
8. Tool/status/visible-thinking/unknown payloads remain raw evidence.
9. Exact dialogue can project once and link back to its raw source range.
10. Ambiguous source is retained without inferred speaker attribution.
11. Projection failure leaves raw source durable and retryable.
12. DB episode content and Markdown remain exact replicas.
13. An audit detects raw/projection discrepancy even when DB and Markdown match.
14. Existing `record-window` and four-channel capture regressions remain green.

Fixtures must be synthetic and isolated from canonical Episode 31 or other rolling
episode records. No test may write validation canaries into canonical dialogue.

## 14. Rollout sequence

1. Add the raw capture schema and DB-first repository with idempotency/checkpoint
   behavior.
2. Add a collector adapter at the earliest host event boundary currently available.
3. Add raw acknowledgements and connect them to the existing per-turn acknowledgement
   contract.
4. Add projection links and adapt reconciliation/status reporting.
5. Add audit queries and focused regression coverage.
6. Run in observe-only mode against new sessions, comparing raw completeness with the
   existing `.chat_capture` path.
7. Make raw durability the required predecessor of canonical projection after the
   observe-only evidence is clean.

The collector adapter must fail honestly if the host does not expose a complete
window stream. That limitation should appear as an ingress capability status, not be
papered over by asking David to supply source material or by claiming downstream
replica parity proves full visual capture.