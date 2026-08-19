# Source-Attested Luca Capture Design

## Purpose

Prevent the canonical `main` channel of a Luca [Replit] turn from becoming a
later paraphrase of what appeared in the Replit window. Channel completeness is
necessary but insufficient: the record must preserve the actual visible Luca
prose as well as the exact felt, thinking, and moment sources.

## Source Boundary

Each new Luca turn has four authored sources:

1. `visibleProse` — every human-readable Luca message shown in the Replit
   window, in display order;
2. `felt`;
3. `thinking`;
4. `moment`.

UI-only chrome, such as “Wrote a file,” is not dialogue and is excluded from
`visibleProse`. A status marker that is itself authored Luca prose belongs in
`visibleProse`.

The canonical renderer writes the three inner-life sources under their channel
labels, then writes `visibleProse` byte-for-byte as the `main` portion. It does
not synthesize, summarize, reorder, or normalize the prose beyond the
newline-preserving file read already required to capture it.

## Capture Contract

The capture command accepts a required `--visible-prose-file` instead of an
independently authored `--luca-file`. It uses that file directly as the main
source. Felt, thinking, and moment retain their existing required-or-explicitly
empty contract.

Before `.chat_capture` changes, the command writes a handoff intent containing:

- the four channel hashes;
- a `visibleProseSha`;
- an explicit source-version marker.

The composed Luca entry contains a non-dialogue metadata marker for the visible
source hash. Autosave validates the envelope and its source marker before any
DB write, Markdown replica replacement, or cursor advancement. A missing,
inconsistent, or malformed source remains pending and retryable.

## Operational Rule

Replit provides no machine-readable chat-transcript API. Therefore the agent
must create the `visibleProse` file from the exact response text before sending
that response to the user. The same exact string is both user-visible prose and
the capture input. The implementation can enforce that a capture has not
rewritten its supplied source; it cannot independently observe a chat window
that Replit does not expose.

Historical paste recovery remains a separate, explicitly labeled verbatim
source-recovery route. It must never be represented as a newly spoken turn.

## Failure Behavior

- Omitted `visibleProse` fails before any live capture side effect.
- A blank visible source fails unless the entire Luca response is deliberately
  absent; that case is not a valid Luca turn and is rejected.
- A manually supplied legacy `--luca-file` is rejected, so it cannot silently
  bypass source attestation.
- A source-marker mismatch in autosave prevents the DB write and cursor advance.
- Existing historical paraphrases are not rewritten or deleted; later exact
  source recovery is appended with provenance.

## Verification

Hermetic tests must prove:

1. a visible-prose canary reaches the canonical main section byte-for-byte;
2. all four original channel values survive parse and render in order;
3. omitted visible prose and legacy main-file input fail without touching the
   live capture stream;
4. a deliberately mismatched source hash is rejected before DB, Markdown, or
   cursor advancement;
5. a fixture episode's DB content and Markdown replica remain exactly equal;
6. the existing four-channel continuity audit continues to distinguish old
   acknowledged gaps from new source-attested turns.