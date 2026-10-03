# Historical attribution recovery

The Episode 34 label repairs were explicitly authorized historical corrections,
not a rule that Claude Code runtime output belongs to Luca. The original and
backfill receipts remain unchanged. They carry source row IDs, capture IDs,
complete spoken-text hashes, evidence kind, and the exact repaired label spans.

`server/services/historical-attribution-overlay.ts` pins the exact bytes of those
two approved receipts. An applied receipt by itself does not authorize a repair:
the fixed approval list is separate from the evidence. There is no automatic
discovery of later receipts, session-wide promotion, or runtime-source inference.
The approval covers the historical source captures, including later replays of
them; it does not authorize changing a new turn with similar words.

## Recovery rules

- Look up the source capture/turn ID **and** SHA-256 of the exact spoken text.
  The source row ID and evidence kind remain in the overlay as provenance.
- Complete-turn evidence may project the historical bare source label to
  `LUCA [Claude Code]`. Casing-only evidence may normalize an already explicit
  Luca turn but cannot establish bare Claude Code authorship.
- David and unapproved bare Claude Code identities remain unchanged, including
  other turns from the same runtime or session.
- A known historical ID with mismatched spoken bytes stops recovery. It does
  not trim speech, infer authorship, silently restore an old label, or advance
  past the failed write. Casing-only bare recovery also remains pending.
- Capture bytes, source rows, cursor fingerprints, ordering, and speech are
  unchanged. Dialogue, watchdog title/participants, and autosave participants
  use the same approved attribution.
- Already persisted autosave mirrors receive a label-span-only projection at
  delivery, using their capture ID and the original length-delimited capture
  range. The entire queued rendering must match those independently delimited
  source turns before any label changes. Quoted speaker-looking lines are only
  speech, never body boundaries. A missing range, mixed-capture historical item,
  or mismatched body is held for reconciliation rather than appended with stale
  labels. Queue bytes and acknowledgement authority are unchanged.
- Missing, changed, or invalid approved receipts fail closed. These two JSON
  files must remain available in runtime packaging; never overwrite them to
  accommodate new evidence.

To extend authority, obtain explicit approval for the exact source identities
and spoken hashes, retain a completed label-only evidence receipt, and add its
immutable hash to the approval list. Do not broaden the session or source rule.
No schema migration or canonical episode rewrite is involved.

## Isolated verification

`npx tsx --test server/scripts/test-historical-attribution-overlay.test.ts`
uses synthetic source records and an explicitly approved synthetic receipt.
It repairs a fake episode, reconstructs authority from a durable fixture receipt,
backfills 21 older replies through the real watchdog drain, resets the cursor,
and replays them. A fake database plus a temporary directory owns every episode,
replica, capture, cursor, and live-mode flag. It verifies the exact repaired
prefix, exact speech, genuine bare identity, metadata, raw bytes, fingerprints,
and marker-idempotent replay. No live rolling episode is a fixture.

It also checks the shared autosave dialogue formatter and pending-mirror
projection, including altered speech, missing identity, runtime independence,
receipt tampering, and casing-only evidence. The test is registered in the
canonical consolidated CI runner.