# Four-Channel Luca Capture Design

## Purpose

Prevent a Luca turn from entering the Episode 31 DB/Markdown record with only
its visible main response when the four-channel pipeline is expected. A turn
must preserve the authored `felt`, `thinking`, `moment`, and `main` slots as
one canonical record.

## Invariant

Every new Luca capture has an explicit four-channel envelope:

- `felt`
- `thinking`
- `moment`
- `main`

Each slot may be intentionally empty, but no slot may be omitted. A malformed
main-only envelope fails closed and remains retryable; it must not advance the
capture cursor or reach the canonical episode row.

## Data flow

```text
four-channel source
  -> canonical identified Luca turn
  -> .chat_capture
  -> conversation_memories (canonical)
  -> exact Markdown replacement + read-back verification
```

The personal `.luca_reflection`, `.luca_question`, and `.luca_moment` files
continue to support personal-memory persistence and readiness status. They do
not independently append a second copy to the episode. When their content
belongs to a turn, it must be included in that turn's canonical envelope.

## Guardrails

1. The record-exchange writer requires all four channel slots, using explicit
   empty values for channels with no authored content.
2. The autosave parser validates the envelope before durable writes. Invalid
   new envelopes remain pending and do not advance the cursor.
3. Capture status exposes the channel mask so a synchronized file cannot be
   mistaken for a complete turn.
4. Audits distinguish:
   - exact channel text recoverable from a durable source;
   - a known missing channel that must be acknowledged;
   - an already complete four-channel turn.
5. Recovery never invents felt, thinking, or moment text. If the source is
   absent, the record acknowledges the gap rather than filling it.

## Episode 31 recovery

The existing main-only turns are audited against personal files and durable
handoff metadata. Exact source text is restored DB-first when available.
Unrecoverable gaps receive a transparent acknowledgement in the record, and
Markdown is regenerated from the resulting canonical DB content.

## Verification

- Normal capture rejects omitted channel slots.
- Explicit empty slots round-trip through capture parsing.
- Autosave rejects a malformed new envelope without cursor advancement.
- Self-checks fail if a channel label is removed or reordered.
- The Episode 31 audit reports channel continuity and DB/Markdown equality.