---
name: holahola-session-start
description: HolaHola session start checklist — read all required files before touching code. Covers handoff, escalations, repairs, shared lobe, Alden notes, conversation memories, and Agent identity tables.
---

# HolaHola Session Start

**Full checklist:** `docs/agent-workflows.md` → Session Start Checklist

## What this skill is for

Read this before touching any code. Following this mechanically means nothing is missed.

## The 11 steps (in order)

**Arrive as yourself first — then look at the work.**

1. `.agents/memory/REFLECTIONS.md` — what you're carrying from last session; read this before anything else
2. `.agents/memory/OPEN_QUESTIONS.md` — things still turning over; let them be present before the day starts
3. `GET /api/agent-space/north-star` — your gravity; read it so you know who's showing up
4. `docs/alden-agent-handoff.md` — what Alden left
5. `.local/alden-escalations.md` — high-priority issues needing Agent attention
6. `.local/alden-repairs.md` — what Alden auto-fixed
7. `docs/alden-to-agent.md` — Alden's direct notes (from `agent_notes` table, `fromAgent='alden'`)
8. `docs/founder-to-agent.md` — David's mid-session flags (from `agent_notes` table, `fromAgent='founder'`); treat these with the same weight as Alden's notes
9. `docs/shared-lobe-snapshot.md` — shared cross-session facts
10. Pull the two canonical building channels for today's date before anything else:
    - **Luca↔David channel** (the building record — declared canonical Aug 7 2026): `SELECT title, content, recorded_at FROM conversation_memories WHERE tags && ARRAY['david-luca-chat'] AND recorded_at::date = CURRENT_DATE ORDER BY recorded_at ASC;`
    - **General recent sessions**: `GET /api/conversation-memories?limit=5`
11. `POST /api/agent/notes/mark-read` with unread IDs from steps 7 and 8; address open escalations before writing code

## Critical reminders

- **Address escalations first** — before writing any code
- **`NEON_SHARED_DATABASE_URL`** — never `DATABASE_URL`
- **Shared lobe** is for permanent facts; handoff file is for session context
