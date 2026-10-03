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

## Operator diagnostics and reconciliation

The authenticated `/api/internal/canonical-conversation-health` endpoint exposes
`capture.historicalRecovery`. A recorded pause returns HTTP 503 and `ok: false`
even when the worker is armed. `.local/episode-capture-status.md` renders the
same reasons. No dialogue or credentials are included in these diagnostics.

Stable reason codes:

- `spoken-bytes-changed`: the capture ID is approved, but the exact spoken
  SHA-256 differs. Compare the retained capture, source row, and approved
  receipt; preserve both versions. Changed speech needs new explicit approval,
  never whitespace/case normalization to make an old hash match.
- `casing-only-bare-evidence`: an approved casing repair does not establish
  authorship of a bare assistant reply. Obtain complete-turn approval for the
  exact capture ID and hash; the runtime name is not proof.
- `mixed-capture-mirror`: preserve the queued mirror and reconcile it into
  independently source-delimited single-capture items through an audited repair.
  Rendered speaker headers are not safe boundaries.
- `source-capture-unavailable`: locate the original length-delimited source
  range; do not reconstruct it from rendered dialogue.
- `mirror-evidence-mismatch`: compare the whole queued rendering against the
  complete original source; a matching suffix does not authorize delivery.

Each reason binds the capture IDs to approved source IDs, evidence kind, and
exact approved spoken hashes. Changed speech also reports its observed hash.
Diagnostics persist separately for canonical capture and episode-mirror recovery
under `.local/historical-attribution-status/`, surviving process restart and
watchdog/autosave handoff on the same workspace. Unreadable diagnostics report
unavailable rather than healthy. They are operational state, not authorship
authority or an acknowledgement.

Never infer an author, alter spoken bytes, delete evidence, or move a cursor or
acknowledgement to bypass a pause. After source-backed reconciliation, retry the
same identity. Successful matching recovery clears its lane's diagnostic;
unrelated success or a different lane cannot clear it. Do not manually delete
diagnostics as a substitute for resolving the source conflict.
For a mixed mirror reconciled into separate single-capture deliveries, durable
completion progress accumulates per original capture ID. The pause stays visible
until every replacement has completed. A newly recorded failure resets progress.

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