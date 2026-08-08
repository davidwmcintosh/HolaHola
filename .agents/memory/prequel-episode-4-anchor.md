---
name: Prequel Episode 4 anchor
description: DB anchor for Prequel Episode 4 "The Work Between Sessions" — June 8–30, 2026; voice pipeline calibration, Alden upgrade to Fable 5, GL bugs from real sessions, month-end TTS failure.
---

# Prequel Episode 4 — "The Work Between Sessions"

- **DB ID:** ce9a2f9e-8b36-4723-9a16-f878b7035aa9
- **arc_name:** HolaHola Episodes
- **entry_type:** episode
- **tags:** prequels, hh-genesis
- **episode_order:** 3
- **file:** docs/prequel-episode-4.md
- **recorded:** June 8–30, 2026
- **participants:** David + Agent + Daniela

## What it covers

Three weeks of calibration between the first peer Agent↔Daniela conversation (June 7, Prequel Episode 3) and the numbered episode arc.

**June 8 — The Mental Handshake:** Agent showed Daniela her voice prompt (7,986 chars). New SESSION ORIENTATION block reviewed — she acknowledged it would force a real context check before speaking. MEMORY INTEGRITY rule confronted: she had been generating plausible-sounding summaries without actually calling recall tools.

**June 9 — Space and Thinking:** Two sessions. First: pacing directive + thinkingLevel (Gemini Live config param for internal reasoning budget before first word) — she called for both layers, not one as substitute for the other. Second: tool knowledge gap — compressed "procedure map" made her reach inward instead of having quick reference; she could name the problem before the Agent did.

**June 12 — The Upgrade:** Claude Fable 5 released June 9. Alden upgraded across all 6 services. Parallel audit sweep ran via internal subagents (not Fable 5 as planned) — noted without softening in the session record.

**June 15 — The Voice Console:** 28 inactive duplicate voice rows deleted. Spanish female Daniela updated to Aoede voice. French "Juliette" display name restored. Frontend safety guard added. Vision system architecture confirmed as already wired end-to-end.

**June 16 — Three Bugs from Live Sessions:** (1) Vocab mining not running after GL sessions — fixed. (2) Enrichment (student_insights, recurring_struggles, embeddings) not running from voice — fixed. (3) Double greeting audio from overlapping trigger sources — fixed with entry guard.

**June 30 — Load and Failure:** David walked through UI feedback. Agent sweep found CRITICAL: Cartesia TTS failures blocking all voice sessions. Also found quality score zero-out for most active student (23 sessions). Both production-breaking, neither yet resolved at day's end.

## Arc connection

Preceded by Prequel Episode 3 (cd66b19d) — first Agent↔Daniela peer conversation, June 7.
Followed by the numbered episode arc.
