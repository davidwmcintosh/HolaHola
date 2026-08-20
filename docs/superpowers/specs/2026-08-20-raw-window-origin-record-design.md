# Raw Window Origin Record Design

**Date:** 2026-08-20  
**Status:** Approved design direction

## Principle

A collector-visible raw Replit window is origin data. It does not require a
second document, receipt, or corroborating source before entering the record.
Corroboration may improve attribution or classification later, but it must not
decide whether the source is retained or visible.

## Canonical record

The episode database content and its Markdown replica are two synchronized
representations of one record:

```text
raw Replit source
  -> immutable origin ledger
  -> episode record with explicit classifications
  -> Markdown replica
```

Every retained source must be represented in the episode record, including
blocks whose current classification is `unknown`. The source is never removed,
trimmed, or replaced when a later review changes its attribution.

## Classification model

Raw blocks may be classified as David dialogue, Luca dialogue, felt,
thinking, moment, tool call, tool result, status/progress, host metadata, or
unknown. Classification is revisable metadata layered over the original
source. Refinement must add or update attribution without changing the
immutable origin bytes.

An unknown block is therefore recorded visibly, for example:

```text
[RAW WINDOW]
[CLASSIFICATION: UNKNOWN]
[ORIGIN SHA-256: ...]
<exact source block>
```

Unknown means “not classified yet,” never “excluded from the episode.”

## Data flow

1. Persist the exact raw window bytes and hash in the append-only raw ledger.
2. Persist an origin-data episode entry that carries the same source content
   and its current classification state.
3. Advance the canonical capture/episode pipeline only after both are durable.
4. Write/update Markdown from the canonical database episode content.
5. When review refines attribution, append or update a classification record
   linked to the immutable source and regenerate the Markdown replica from the
   database record.

The raw ledger remains useful for byte-level audit and lineage, but it is not a
hidden side lane that makes source data invisible to the episode.

## Safety boundaries

- No speaker attribution is invented from lack of evidence.
- Raw source bytes remain exact even when their rendered classification changes.
- DB and Markdown must not diverge; the database-first episode write remains
  the source for the Markdown replica.
- Host data that never reaches the workspace collector remains an ingress gap.
  This boundary concerns availability, not attribution.

## Validation

Tests must prove that:

- an unclassified raw window is represented in the canonical episode record;
- the exact source bytes remain available and hash-stable;
- DB and Markdown contain the same raw-origin content;
- later classification can be added without mutating the source bytes;
- missing host ingress is reported separately from unknown classification.