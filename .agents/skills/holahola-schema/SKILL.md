---
name: holahola-schema
description: HolaHola schema change rules — update shared/schema.ts, generate + review a migration, prove it on a Neon branch, then apply for real.
---

# HolaHola Schema Changes

**Full rules:** `docs/agent-workflows.md` → Schema Change Rules
**Branching tool:** `.agents/skills/neon-branch/SKILL.md`

## What this skill is for

Use whenever modifying the database schema. One shared database means changes are live immediately in both environments — there is no separate dev/prod database to experiment against, which is why step 3 below exists.

## The steps

1. **Update `shared/schema.ts` first** — this is the source of truth
2. **Run `npx drizzle-kit generate`**, review the generated SQL in `migrations/`
3. **Run `npm run db:branch -- gate`** — proves the migration on a disposable Neon branch (applies it, runs the CI test groups against it) before it's real. Deletes the branch either way; never touches the shared database itself.
4. **Only on a `READY_TO_PROMOTE` pass, run `npx drizzle-kit migrate`** — applies to the shared Neon database
5. **Backfill existing rows** if adding non-nullable columns without a default
6. **Document** in the session-end handoff: what changed, why, any backfill done

## Critical reminders

- **`npm run db:push` / `drizzle-kit push` is forbidden** — it bypasses the migration artifact and the gate, applying directly to the shared prod DB with no review step. If you see it mentioned anywhere else, that's stale; this is the current rule.
- **One shared database** — dev and production share the same Neon instance via `NEON_SHARED_DATABASE_URL`
- Drizzle array columns: use `.array()` as a method — `text().array()` not `array(text())`
- Never use `DATABASE_URL` — always `NEON_SHARED_DATABASE_URL`
- Need an isolated database for something that isn't a formal migration (a seed script, a data experiment)? Use `npm run db:branch -- create <name>` instead of running it against the shared DB — see `.agents/skills/neon-branch/SKILL.md`.
