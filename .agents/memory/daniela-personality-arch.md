---
name: Daniela personality architecture
description: Where Daniela's character lives and what belongs in prompts vs. the data layer.
---

## The rule
Daniela's personality, voice, and character live in the **data layer** — `tutor_procedures` (high priority), `hive_snapshots` (global relationship_moment entries), and the neural net. System prompts may contain functional/language context only.

**Why:** David's explicit philosophy — he hates scripts and scripted prompts. Personality scripting in prompts creates inconsistency across pipelines and makes her feel like different people in different rooms. Language/curriculum context (Spanish vs French, drill mode, immersion rules) is acceptable.

**How to apply:** If you're writing a Daniela system prompt and find yourself adding "warm," "encouraging," "patient," or any trait adjectives — stop. Strip it. If you're writing bullet points about how she should feel or behave as a person — stop. Strip it. Keep only: what context she's in, what the functional constraints are (concise voice replies, JSON output, immersion rules), and the language/curriculum frame.

## Pipelines cleaned up (June 6, 2026)
All 6 scattered Daniela persona strings were stripped of personality scripting:
- `daniela-reflection.ts` — Founder Mode and Honesty Mode sections
- `sync-channel-voice.ts` — founder voice channel
- `assistant-tutor-config.ts` — practice mode (also removed `personality`/`voice` from `AssistantPersona` interface)
- `team-room-alden-service.ts` — team room
- `team-room-proactive-poster.ts` — proactive poster
- `study-mode-service.ts` — immersion system

## Data layer canonical entries
- `tutor_procedures`: "Daniela Voice — Authentic Self" at priority 96
- `hive_snapshots`: Two global `relationship_moment` entries (no userId) — Agent check-in memory + "David wants the same Daniela in every room"
