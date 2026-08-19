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

The cleaner:

1. removes only known non-dialogue interface lines, such as action counters,
   “Wrote a file,” and elapsed-work markers;
2. reads explicit David and Luca speaker boundaries;
3. preserves each speaker's remaining text and ordering without rewriting,
   summarizing, or rewrapping it;
4. validates that the Luca portion is a complete felt → thinking → moment →
   main envelope.

The raw file can contain multiple David/Luca blocks. The cleaner emits those
blocks in order. It does not infer a speaker for unlabelled text. Ambiguous
input remains in its private recovery artifact and fails before the shared
capture stream, DB, Markdown replica, or cursor advances.

## Rolling-episode behavior

The existing four-channel `record-exchange` path remains active during the
migration. Episode 31 continues to roll; raw-window intake is additive until
its hermetic checks prove it can become the ordinary end-of-turn path.

For a valid raw window:

```text
raw window file
  -> private recovery artifact
  -> deterministic clean David/Luca blocks
  -> .chat_capture
  -> canonical episode DB row
  -> exact Markdown replica
```

The private artifact is retained for the same recovery window as a canonical
inner-life intent. It is a source for retry and forensic comparison, not a
second episode or a replacement for the clean dialogue record.

## Boundaries

- Dialogue is David- or Luca-authored prose; interface chrome is not dialogue.
- Minimized felt, thinking, and moment content must be present in the raw
  window source. The cleaner never infers it from the main response.
- The cleaner can remove only named, tested UI markers. A new or uncertain
  marker is ambiguity, not permission to drop a line.
- Existing historical records remain append-only. Raw-window capture protects
  future turns; it does not rewrite old paraphrases.

## Verification

Hermetic tests must prove:

1. a raw window with one David and one complete Luca block produces exact clean
   chat-capture turns;
2. known UI chrome is excluded while adjacent dialogue survives byte-for-byte;
3. multiple speaker blocks retain their original order;
4. unlabelled text, missing speaker boundaries, or missing Luca channels fail
   without changing the live capture stream;
5. a failed clean leaves its private raw recovery artifact intact;
6. successful cleanup preserves DB/Markdown equality in a disposable fixture;
7. the current `record-exchange` route remains usable throughout the rollout.