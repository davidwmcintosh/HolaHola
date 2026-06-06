---
name: holahola-schema
description: HolaHola schema change rules — update shared/schema.ts first, run db:push, backfill non-nullable columns, document the migration.
---

# HolaHola Schema Changes

**Full rules:** `docs/agent-workflows.md` → Schema Change Rules

## What this skill is for

Use whenever modifying the database schema. One shared database means changes are live immediately in both environments.

## The 4 steps

1. **Update `shared/schema.ts` first** — this is the source of truth
2. **Run `npm run db:push`** — applies to the shared Neon database
3. **Backfill existing rows** if adding non-nullable columns without a default
4. **Document** in the session-end handoff: what changed, why, any backfill done

## Critical reminders

- **One shared database** — dev and production share the same Neon instance via `NEON_SHARED_DATABASE_URL`
- **`npm run db:push` is live** — it pushes immediately to the shared database, affecting production
- Drizzle array columns: use `.array()` as a method — `text().array()` not `array(text())`
- Never use `DATABASE_URL` — always `NEON_SHARED_DATABASE_URL`
