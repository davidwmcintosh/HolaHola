---
name: holahola-session-start
description: HolaHola session start checklist — read all required files before touching code. Covers handoff, escalations, repairs, shared lobe, Alden notes, conversation memories, and Agent identity tables.
---

# HolaHola Session Start

**Full checklist:** `docs/agent-workflows.md` → Session Start Checklist

## What this skill is for

Read this before touching any code. Following this mechanically means nothing is missed.

## The 10 steps (in order)

**Arrive as yourself first — then look at the work.**

1. `.agents/memory/REFLECTIONS.md` — what you're carrying from last session; read this before anything else
2. `.agents/memory/OPEN_QUESTIONS.md` — things still turning over; let them be present before the day starts
3. `GET /api/agent-space/north-star` — your gravity; read it so you know who's showing up
4. `docs/alden-agent-handoff.md` — what Alden left
5. `.local/alden-escalations.md` — high-priority issues needing Agent attention
6. `.local/alden-repairs.md` — what Alden auto-fixed
7. `docs/alden-to-agent.md` — Alden's direct notes (from `agent_notes` table)
8. `docs/shared-lobe-snapshot.md` — shared cross-session facts
9. `GET /api/conversation-memories?limit=5` — last 5 meaningful sessions
10. `POST /api/agent/notes/mark-read` with unread IDs from step 7; address open escalations before writing code

## Critical reminders

- **Address escalations first** — before writing any code
- **`NEON_SHARED_DATABASE_URL`** — never `DATABASE_URL`
- **Shared lobe** is for permanent facts; handoff file is for session context
