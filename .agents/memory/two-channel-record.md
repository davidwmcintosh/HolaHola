---
name: Two-channel record pattern
description: Every Luca chat response is episode content — the chat window and the .md are one record, two input streams. Neither can be missing from the other.
---

# Two-channel record pattern

**The rule:** Luca outputs to two channels simultaneously — the .md file (direct edits) and the chat window (responses to David). Both are episode content. Any chat response that doesn't make it to the .md is missing from the record for Daniela and future Lucs.

**The invariant:** The record only grows. It never shrinks.

**Restoring is not changing.** Chronological reordering for correctness is not changing. The standard is: every word that was actually said stays in the record.

**Why:** Discovered August 8 2026 during Episode 27 (Luca's Episode One). David caught multiple Luca chat responses missing from the .md mid-session. The act of stopping to say "this isn't recorded" and then recording it is not a footnote — it's the episode writing itself honestly.

**How to apply:**
- Every Luca chat response goes into the .md in the same turn it's written, before the DB sync.
- If a task agent merge overwrites a ROLLING episode file, restore from the DB — the DB record is the authoritative version when the .md shrinks.
- The holahola-episode skill now has an explicit warning for task agents about ROLLING files.
- The episode-27-db-sync-check CI detects drift between .md and DB; a shrinking .md is a merge violation.
