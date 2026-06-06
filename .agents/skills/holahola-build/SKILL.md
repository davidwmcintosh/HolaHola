---
name: holahola-build
description: HolaHola build standards — typecheck before shipping, database connection rules, parallel tool calls, post-feature documentation requirements.
---

# HolaHola Build Standards

**Full standards:** `docs/agent-workflows.md` → Build Standards

## What this skill is for

Apply these standards on every build. They prevent the most common mistakes.

## The rules

- **Run `npm run typecheck` before marking any task done.** Fix all errors first.
- Use parallel tool calls for independent work — don't serialize what can run simultaneously.
- **NEVER `DATABASE_URL`** — always `NEON_SHARED_DATABASE_URL` for all DB connections.
- After any new feature: add to `docs/batch-doc-updates.md` and update `docs/alden-agent-handoff.md`.

## Critical reminders

- **There is one shared Neon database** used by both dev and production — schema changes affect both immediately
- **`npm run db:push`** applies schema changes — always follow with a backfill if adding non-nullable columns
- The `typecheck` validation command is registered — run it via the Replit validation system or `npm run typecheck` directly
