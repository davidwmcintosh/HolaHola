---
name: neon-branch
description: Use a Neon branch instead of the shared database for coding/testing sandboxes, and to prove a schema migration safe before it goes live. Tool: scripts/neon-branch.ts.
---

# Neon Branching

**Full design & rationale:** `docs/superpowers/specs/2026-08-30-neon-branch-migration-workflow-design.md`

## What this skill is for

Use whenever you need an isolated Postgres database instead of the live shared one — schema experiments, seed/backfill scripts, running the app against realistic data, or validating a pending migration. This works identically from Claude Code, Replit, Cursor, or any other tool: it's one script, `scripts/neon-branch.ts`, callable via `npm run db:branch -- <subcommand>`.

## The rule this exists to enforce

`NEON_SHARED_DATABASE_URL` is the one live database for both dev and prod — real conversations, real memory, continuity that must never fork. Never point exploratory code, seed scripts, or an unvalidated migration at it directly. Branches give you the isolation of a separate dev database without actually having one — each branch starts from production's real current state, not a hand-maintained fixture that drifts.

Branches are ephemeral by default — create one when you need it, delete it when you're done. A single long-lived reused branch goes stale and defeats the point (this is why the old static `Neon_Test_DB` was retired).

## Two flows

**Sandbox** — starting real coding work that needs its own database:
```bash
npm run db:branch -- create <name> [--parent production] [--expires-at 14d] [--schema-only]
```
Prints a pooled and a direct (unpooled) connection string. Point your environment's `NEON_SHARED_DATABASE_URL` at the **pooled** one for that session only — never overwrite `.env` without saying so first. Name the branch after the git branch/feature it's for. Delete it when that work merges or is abandoned:
```bash
npm run db:branch -- delete <name>
```
Use `--schema-only` instead of a normal branch when you need structure but the data itself is sensitive.

**Migration gate** — after `drizzle-kit generate` and human review of the SQL, before the real `drizzle-kit migrate`:
```bash
npm run db:branch -- gate
```
Creates a disposable branch off `production`, applies the pending migration to it, runs `test:ci:unit` / `test:ci:guards` / `test:ci:episodes` against it, deletes the branch regardless of outcome, and prints `READY_TO_PROMOTE` or the exact failing step. Only run the real `npx drizzle-kit migrate` after a pass — this script never touches the shared database itself. Full step-by-step: `.agents/skills/holahola-schema/SKILL.md`.

## Other commands

- `npm run db:branch -- list` — see current branches and their state.
- `npm run db:branch -- connection-string <name> [--pooled]` — re-fetch a branch's connection string later.

## Reminders

- Migrations need the **direct** (unpooled) connection string, never the pooled one — `gate` already handles this for you.
- The default/production branch can never be deleted through this tool, by design — don't try to work around it.
- Database and role names are always resolved from the branch's actual database list, matched against the real app database name — never assumed. If that resolution fails, the tool refuses rather than guessing.
