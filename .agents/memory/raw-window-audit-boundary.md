---
name: Raw-window audit boundary
description: Rules for separating Replit-source transformation audits from manual reference dumps.
---

Treat a raw Replit dump as input to a transformation audit, not as episode
content. Persist the audit before cleaned, attributed dialogue enters the
capture-to-DB path. The audit records hashes, byte totals, source offsets,
categories, and explicitly permitted formatting removal reasons; it must not
store a second copy of raw prose or dialogue.

David-provided/manual raw dumps are reference material while the original
record is sought. They must never become ordinary dialogue. A later gap-fill is
allowed only when it names the missing original record, attributes the dialogue
safely, and explicitly says David supplied the cut-and-paste.

**Why:** A source-recovery aid and a canonical speaker record answer different
questions. Blending them makes accidental reconstruction look like authentic
dialogue and hides whether the capture pipeline itself lost material.

**How to apply:** Keep raw source files and audit manifests outside the episode
DB/Markdown record. When reviewing a new intake route, default unknown/manual
provenance to reference-only and require an explicit, auditable path before it
can write cleaned dialogue into capture.