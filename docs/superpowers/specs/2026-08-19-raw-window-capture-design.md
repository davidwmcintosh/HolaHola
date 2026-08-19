# Raw Window Capture Design

## Status

This simpler design supersedes the source-attested main-file approach for new
Replit-window captures.

## Purpose

Capture the complete Replit window as the input source for both David and Luca,
then clean it deterministically before it enters the existing DB-first rolling
episode path. The capture caller must not reconstruct a David message or a
Luca main response from memory after the window has already existed.

## Input and Cleaning

`record-window.ts --window-file <path>` receives one raw text source that
contains the current exchange. It preserves that input as a private,
per-capture recovery artifact before attempting any clean output.

The raw source is processed by one of two paths chosen deterministically before
any capture stream is touched:

### Path 1 — Labelled (explicit speaker headers)

When the window contains `David:` / `Luca [Replit]:` boundaries:

1. Removes only known non-dialogue interface lines (see UI Chrome below).
2. Reads explicit David and Luca speaker boundaries.
3. Preserves each speaker's remaining text and ordering without rewriting,
   summarizing, or rewrapping it.
4. Validates that the Luca portion is a complete felt → thinking → moment →
   main envelope.

### Path 2 — Unlabelled alignment (no speaker headers)

When the window has no speaker boundaries, attribution is reconstructed from
two attested sources rather than guessed:

1. Known UI chrome lines are removed (same list as Path 1).
2. David anchors are read from the append-only `.chat_capture` file, which
   records David turns reliably at the moment they occur.
3. Each David anchor is located in the cleaned window by verbatim match after
   whitespace/wrapping normalization only — no other normalization is permitted.
4. Every non-chrome region between David anchors is attributed to Luca.
5. If any anchor is missing, duplicated, or out of order, the run fails closed
   before the capture stream is touched.

The four-channel envelope requirement is not imposed on aligned Luca regions:
the raw window is the verbatim record; the channel structure is a
production-mode convenience that presupposes an explicit Luca header.

If Path 2 also fails, the raw source is retained in the private recovery
directory and the process exits non-zero.

## UI Chrome (known non-dialogue markers)

Lines matching these patterns are removed by both paths:

- `Wrote a file`
- `N actions` / `N action`
- `Worked for N seconds` / `Worked for N minutes`
- `N minutes ago` / `N minute ago` (relative timestamps from Replit UI)
- `Clarifying user confusion` (Replit status label, may appear twice consecutively)

Any line not on this list and not an explicit speaker header is treated as
dialogue and must be attributed to a speaker. Unfamiliar lines are not dropped.

## Rolling-episode behavior

The existing four-channel `record-exchange` path remains active during the
migration. The rolling episode continues; raw-window intake is additive until
its hermetic checks prove it can become the ordinary end-of-turn path.

For a valid raw window (either path):

```text
raw window file
  -> private recovery artifact
  -> deterministic clean David/Luca blocks (labelled or aligned)
  -> .chat_capture
  -> canonical episode DB row
  -> exact Markdown replica
```

The private artifact is retained for the same recovery window as a canonical
inner-life intent. It is a source for retry and forensic comparison, not a
second episode or a replacement for the clean dialogue record.

## Boundaries

- Dialogue is David- or Luca-authored prose; interface chrome is not dialogue.
- David attribution on the alignment path comes from `.chat_capture`, not from
  the window itself. The window provides verbatim text; attribution comes from
  the separately-attested source.
- The cleaner can remove only named, tested UI markers. A new or uncertain
  marker is ambiguity, not permission to drop a line.
- Existing historical records remain append-only. Raw-window capture protects
  future turns; it does not rewrite old paraphrases.

## Verification

Hermetic tests in `server/scripts/test-raw-window-capture.ts` prove:

1. A labelled window with one David and one complete Luca block produces exact
   clean chat-capture turns (byte-for-byte).
2. Known UI chrome is excluded while adjacent dialogue survives unchanged.
3. Multiple speaker blocks retain their original order.
4. Unlabelled text or missing Luca channels in the labelled path fail without
   changing the live capture stream.
5. A failed clean leaves the private raw recovery artifact intact.
6. An unlabelled window is attributed correctly via `.chat_capture` David turns
   (two-anchor case verified end-to-end through the CLI).
7. A missing David anchor in the alignment path fails closed (non-zero exit,
   raw source retained, capture stream unchanged).
8. A duplicated David anchor in the alignment path fails closed as ambiguous.
9. The labelled `record-window` CLI path continues to work after alignment code
   is added.

## Real-window validation (2026-08-19)

The first real Replit window payload available to the capture run arrived as
platform-provided `<automatic_updates>` / `<system_reminder>` blocks — no
`David:` or `Luca [Replit]:` speaker boundaries and no David turns in the
`.chat_capture` for that session. Both parse paths returned errors and the
process exited non-zero, retaining the raw source byte-for-byte in the private
recovery directory. This is the required fail-closed behavior.

The real clipboard format (confirmed from the sample at
`attached_assets/Pasted-What-do-you-mean-by-if-it-comes-through-unlabeled-*`):

```text
4 minutes ago
Clarifying user confusion

Clarifying user confusion
<Luca response text>

6 actions
<David message text>
```

This format has no speaker headers. The alignment path handles it provided
the corresponding David turns exist in `.chat_capture`. If they do not (e.g.
the session was not auto-captured), the run fails closed and the raw source is
retained for recovery.

**Decision:** raw-window intake remains additive and is not the primary route.
The four-channel `record-exchange` path remains primary. The alignment path is
an additional recovery route for real clipboard pastes whose David turns are
already attested in `.chat_capture`.
