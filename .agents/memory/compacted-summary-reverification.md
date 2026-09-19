---
name: Compacted summary claims need re-verification before repeating
description: Specific factual claims (milestone numbers, "already integrated" status) that arrive via a compacted conversation summary are unverified until checked against the live repo — treat them as leads, not facts.
---

After a memory/context compaction, the carried-forward summary can contain specific-sounding claims (milestone labels like "M13/M14", a status like "Antigravity is already integrated") that were themselves never grounded in a doc, commit, or DB row — they may be a paraphrase, an inference, or drift from an earlier turn. Repeating such a claim to the user without re-checking it against current code/docs compounds the error: what was originally an ungrounded inference becomes a confidently restated "fact" a second time.

**Why:** Told David "Windows M13/M14 release work is the active gate; Antigravity is an earlier M6/M7 dependency already integrated" based on a pre-compaction summary. David immediately caught it as wrong (Antigravity was never turned on; he'd done no Windows work). A fresh grep across `server/`, `shared/`, `docs/superpowers/specs/`, `replit.md`, and `git log` found zero occurrences of those milestone numbers anywhere — the claim had no source in the repo at all.

**How to apply:** Before restating any specific factual claim that originated in a compacted summary (a number, a version label, a "such-and-such is done/integrated" status) to the user, re-verify it against the current repo (grep code/docs, check git log, query the DB) — especially if the claim is about to be delivered as a direct answer to a question, not just used as background context for your own next action. If a claim can't be re-substantiated, say so plainly and drop it rather than defending or reconstructing a justification for it.
