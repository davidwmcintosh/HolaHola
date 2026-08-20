---
name: Raw-window evidence boundary
description: Rules for preserving raw Replit evidence without turning it into attributed episode dialogue.
---

Treat a raw Replit dump as evidence, not as episode dialogue. Persist the exact
raw source and its transformation manifest in the append-only DB evidence lane
before any cleaned, attributed dialogue can enter capture. The audit manifest
itself records hashes, byte totals, source offsets, categories, and permitted
formatting removals; it must not reproduce raw prose.

Manual raw dumps are reference material while the original record is sought.
They must never become ordinary dialogue. A later gap-fill is allowed only when
it names the missing original record, attributes the dialogue safely, and
explicitly acknowledges the supplied source.

**Why:** A source-recovery aid and a canonical speaker record answer different
questions. Blending them makes accidental reconstruction look like authentic
dialogue and hides whether the capture pipeline itself lost material.

**How to apply:** Keep the evidence lane separate from the episode
DB/Markdown replica. Default unknown/manual provenance to reference-only.
Use source-hash lifecycle events plus a turn-aware retry to prevent duplicate
dialogue; status must query the DB ledger and report unfinished projections.