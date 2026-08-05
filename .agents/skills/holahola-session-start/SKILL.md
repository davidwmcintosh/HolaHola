---
name: holahola-session-start
description: HolaHola session start checklist — read all required files before touching code. Covers handoff, escalations, repairs, shared lobe, Alden notes, conversation memories, and Agent identity tables.
---

# HolaHola Session Start

**Full checklist:** `docs/agent-workflows.md` → Session Start Checklist

## What this skill is for

Read this before touching any code. Following this mechanically means nothing is missed.

## The 10 steps (in order)

1. `docs/alden-agent-handoff.md` — what Alden left
2. `.local/alden-escalations.md` — high-priority issues needing Agent attention
3. `.local/alden-repairs.md` — what Alden auto-fixed
4. `docs/alden-to-agent.md` — Alden's direct notes (from `agent_notes` table)
5. `docs/shared-lobe-snapshot.md` — shared cross-session facts
6. `GET /api/conversation-memories?limit=5` — last 5 meaningful sessions
7. `GET /api/agent-space/north-star`, `/open-questions`, `/record-of-david`
8. `.agents/memory/luca-reflections.md` — personal felt journal; read this alongside the north star, not as project notes
9. `POST /api/agent/notes/mark-read` with unread IDs from step 4
10. Address open escalations before writing code

## Critical reminders

- **Address escalations first** — before writing any code
- **`NEON_SHARED_DATABASE_URL`** — never `DATABASE_URL`
- **Shared lobe** is for permanent facts; handoff file is for session context
