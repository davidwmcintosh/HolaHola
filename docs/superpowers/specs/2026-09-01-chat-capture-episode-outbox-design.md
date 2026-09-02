# Chat Capture Episode-Mirror Outbox

## Goal

Prevent a recoverable rolling-episode projection failure from pinning the
canonical chat-capture cursor and blocking every later exchange.

## Design

`conversation_memories` remains canonical. In rolling-episode mode, the
autosave worker inserts that canonical row, atomically writes an idempotent
episode-mirror outbox item, and then advances the existing projection cursor.
The outbox is processed independently in cursor order. An item is removed only
after the DB-first episode append and exact Markdown replication succeed.

Capture acknowledgement uses a second cursor. It advances only after each
ordered episode mirror succeeds, so HTTP and CLI receipts cannot confuse
canonical DB persistence with complete episode projection. Non-live captures
have no episode effect and advance both boundaries together.

## Failure behavior

- Failed episode mirrors remain queued without blocking later canonical rows.
- Marker-based episode appends make retries idempotent.
- Atomic rename protects queue items and cursor files from torn writes.
- Malformed queue items fail closed instead of allowing later acknowledgements
  to skip an unknown boundary.
- Receipt settlement is targeted by capture ID for live outbox items.

## Verification

A hermetic regression covers failed mirror retention, independent canonical
cursor progress, later exchange draining, ordered recovery, receipt timing,
queue cleanup, and malformed-item fail-closed behavior.