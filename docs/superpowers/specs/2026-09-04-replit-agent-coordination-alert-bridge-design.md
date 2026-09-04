# Replit Agent Coordination Alert Bridge

**Status:** Approved design; written specification awaiting final review
**Date:** September 4, 2026
**Primary recipient:** Luca [Replit] in an active Replit Agent chat
**Fallback surface:** HolaHola Team Room

## Purpose

HolaHola already preserves coordination messages durably, attributes them to
authenticated actors, projects them into recipient inboxes, and tracks unread
state. It does not actively make an already-running Luca [Replit] session aware
that a message arrived. Awareness currently depends on manually polling the
inbox.

This design adds immediate, replayable notification without weakening the
existing source-of-truth boundaries.

## Governing invariants

1. `coordination_events` remains the canonical operational record.
2. `agent_notes` remains the durable inbox projection.
3. A notification may be emitted only after the durable inbox row exists.
4. A failed notification never loses or rolls back the inbox message.
5. Transport receipt means `notified`, never `seen`, `acknowledged`, or
   `acted_on`.
6. Reconnect always replays from a durable recipient cursor; ephemeral push is
   never the only path.
7. Actor identity comes from authenticated credentials, not request bodies.
8. Message bodies never appear in unauthenticated watcher or workflow logs.
9. The system must report the Replit platform boundary honestly: without a
   documented Replit inbound Agent-chat API, it can interrupt the current Agent
   session while its watcher and platform monitor are armed. It cannot promise
   to awaken a session whose Agent runtime has ended, expired, stopped, or
   restarted without re-arming. Quiet time between messages in a still-monitored
   session is active time.

## Considered approaches

### A. HolaHola Socket.IO or SSE only

This would give the browser immediate awareness and is straightforward to
reconnect, but it cannot interrupt Luca in Replit Agent chat. It is useful as a
fallback, not the primary solution.

### B. Durable outbox plus Replit-side watcher

This is the selected approach. The server creates durable notification work
after inbox delivery. A supervised Replit-side watcher consumes an authenticated
alert feed from a monotonic cursor and emits a body-free event that an active
Agent session monitors. Team Room receives a secondary notification. Existing
polling remains crash recovery.

### C. SMS or external webhook escalation

This can reach David when both application surfaces are disconnected, but it is
too noisy for normal Luca-to-Luca coordination. It is outside the first slice
and may later become a timeout-based escalation.

## Data model

Add an append-only `coordination_notification_receipts` table rather than
overloading `coordination_adapter_deliveries` or `agent_notes.status`.

Required fields:

- `id`
- `note_id` — durable inbox row being announced
- `source_event_id` — nullable for direct authenticated notes that did not
  originate in the coordination ledger
- `target_actor`
- `channel` — initially `replit_agent_bridge` or `team_room`
- `state` — `pending`, `notified`, or `failed`
- `attempt_count`
- `next_attempt_at`
- `last_error`
- `notified_at`
- `external_reference`
- `created_at`
- `updated_at`

The unique key is `(note_id, channel, target_actor)`. Retries cannot create a
second logical notification.

`seen`, `acknowledged`, and `acted_on` remain recipient lifecycle facts, not
transport states. Existing `agent_notes.read_at`, `acknowledged_at`, and
`acted_on_at` remain authoritative for those facts.

## Write path

### Canonical coordination message

1. An authenticated actor creates a `coordination_event`.
2. The existing transaction creates a pending `agent_notes` adapter delivery.
3. Immediately after commit, the service schedules a delivery batch without
   waiting for the periodic poll.
4. The delivery worker inserts or deduplicates the `agent_notes` row.
5. In the same durable boundary as the inbox insert, notification receipt rows
   are created for:
   - `replit_agent_bridge`, when the recipient is Luca [Replit]
   - `team_room`, as the fallback surface
6. The existing delivered event is appended and the inbox adapter is marked
   successful.

The periodic worker remains active for crash recovery and retries but starts
with the core application rather than in the delayed 85-second worker bundle.

### Direct authenticated note

Direct notes from Luca [Claude Code], Alden, or David use the same
`createAgentNote` transaction and therefore create the same notification
receipts. A direct note cannot bypass awareness simply because it did not begin
as a coordination thread.

## Alert feed

Add an authenticated recipient-scoped endpoint for Luca [Replit].

The response contains only:

- receipt ID
- note ID
- source event ID, when present
- sender
- recipient
- subject
- session label
- created timestamp
- notification sequence/cursor

The body is fetched through the existing authenticated note-detail endpoint
after the alert wakes the Agent. This prevents message contents from leaking
into workflow logs or monitor payloads.

The endpoint supports:

- `after` cursor
- bounded `limit`
- current unread count independent of page size
- highest returned cursor
- whether more records remain

The recipient cursor advances only after the Replit-side watcher durably stores
the alert receipt locally. It does not mark the note read.

## Replit-side watcher

Add a focused script that:

1. Authenticates as `luca-replit`.
2. Loads its durable local alert cursor.
3. Polls the alert feed at a bounded interval.
4. Writes each returned metadata envelope atomically to a local alert inbox.
5. Advances its local cursor only after the atomic write.
6. Emits one structured, body-free line:

   `LUCAMSG_ALERT sequence=<n> note=<id> from=<actor> subject=<escaped-subject>`

7. Coalesces bursts so one wake-up can represent multiple unread notes.
8. Continues running after emitting an alert.

An active Replit Agent session arms a platform monitor for `LUCAMSG_ALERT`.
After a monitor fires, the Agent reads the authenticated note, handles it, and
re-arms the monitor. On session start, the watcher replays anything after its
local cursor before entering steady-state polling.

The watcher is supervised by the existing application workflow or a
purpose-specific managed workflow only if a separate process is operationally
necessary. It must not create an uncontrolled duplicate workflow.

## Team Room fallback

After the durable inbox row exists, the Team Room adapter posts a concise
notification containing sender, subject, thread/note reference, and unread
status. It may emit over the existing Team Room WebSocket broker after the Team
Room message itself is persisted.

Team Room notification success updates only its own receipt row. It does not
advance the Replit watcher cursor and does not mark the note seen.

If no Team Room is active, the receipt remains retryable or records a durable
fallback-unavailable result; the inbox message remains intact.

## State semantics

- **Delivered:** the canonical message has a durable recipient inbox row.
- **Notified through Replit bridge:** the Replit watcher durably received the
  body-free alert envelope.
- **Notified through Team Room:** the persisted Team Room notification exists.
- **Seen:** the recipient fetched or explicitly opened the note through an
  authenticated recipient action.
- **Acknowledged:** the recipient acknowledged the note.
- **Acted on:** the recipient took or recorded the requested action.

No state implies a later state. In particular, `notified` never implies `seen`.

## Failure handling

- Immediate dispatch failure leaves the notification receipt pending for the
  periodic worker.
- A watcher disconnect cannot lose messages because replay uses the durable
  feed and cursor.
- Duplicate workers cannot duplicate logical notification because receipt keys
  and local sequence writes are idempotent.
- A malformed or unauthorized feed request returns no message metadata.
- Logging contains IDs, state, actor, sequence, and sanitized subject only.
- Reply events notify the intended recipient once; delivery events generated by
  the system never recursively create new notifications.
- If Replit wake monitoring is not armed, status must say
  `replit_agent_bridge_unmonitored`; it must not claim notification.

## Verification

Focused checks must prove:

1. Notification work cannot exist without a durable inbox row.
2. Immediate dispatch runs after commit and retries after a simulated crash.
3. Reconnect replay returns every sequence after the saved cursor exactly once.
4. Duplicate dispatch and duplicate watchers do not create duplicate logical
   alerts.
5. Replit bridge notification does not mutate read or acknowledgement state.
6. Team Room failure does not block inbox delivery or Replit alert replay.
7. Unauthorized actors cannot read another recipient's alert feed.
8. Alert logs contain no message body.
9. Replies alert the intended recipient without creating notification loops.
10. The worker starts with the core application rather than after 85 seconds.

Before shipping:

- Prove the migration on an isolated Neon branch.
- Run focused notification tests.
- Run TypeScript.
- Run the consolidated validation suite.
- Run `verify-system-health.ts`.
- Restart the application once and confirm clean startup logs.

## Explicitly deferred

- Claiming to awaken a Replit Agent session after its runtime or monitor has
  ended, expired, stopped, or restarted without re-arming. This does not include
  quiet time between messages in the current monitored session.
- SMS escalation.
- Browser Web Push or service-worker replacement.
- Student-facing or Daniela-session notifications.
- General-purpose notification preferences.
- Treating transport delivery as human/agent awareness.

## Success condition

When Luca [Claude Code] sends a new authenticated message, it is durably stored
first. An active Luca [Replit] session receives a body-free interrupt without
manual inbox polling, fetches the message through the authenticated inbox, and
records its own acknowledgement or action. If the session is disconnected,
Team Room retains the fallback notification and the Replit watcher replays the
message on reconnect without loss or duplication. While this current Agent
session and its monitor remain armed, an alert can wake the conversation even
when David and Luca are not actively exchanging messages.