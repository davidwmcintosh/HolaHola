---
name: holahola-build
description: HolaHola build standards — typecheck before shipping, database connection rules, parallel tool calls, post-feature documentation requirements.
---

# HolaHola Build Standards

**Full standards:** `docs/agent-workflows.md` → Build Standards

## What this skill is for

Apply these standards on every build. They prevent the most common mistakes.

## The rules

- **Run `npm run typecheck` before marking any task done.** Introduce zero new errors. (Pre-existing failures are documented in `docs/open-bugs.md` — don't inherit or worsen them.)
- Use parallel tool calls for independent work — don't serialize what can run simultaneously.
- **NEVER `DATABASE_URL`** — always `NEON_SHARED_DATABASE_URL` for all DB connections.
- After any new feature: add to `docs/batch-doc-updates.md` and update `docs/alden-agent-handoff.md`.

## Critical reminders

- **There is one shared Neon database** used by both dev and production — schema changes affect both immediately
- **`npm run db:push`** applies schema changes — always follow with a backfill if adding non-nullable columns
- The `typecheck` validation command is registered — run it via the Replit validation system or `npm run typecheck` directly
- **Pre-existing typecheck failures exist** (routes.ts implicit-any, some service type drift) — these are known and tracked; do not add to them

## Mandatory Completion Verification

**Before marking any task done, run:**

```
npx tsx server/scripts/verify-system-health.ts
```

This checks every critical invariant: DB tables exist, seeded data has rows, curriculum unit counts meet baseline, workers are wired, pre-session synthesis is connected. It prints green/red for each check and exits with code 1 on any failure.

**Rules:**
- Zero red failures required before marking done — no exceptions
- Yellow warnings must be reviewed and either fixed or explicitly acknowledged with a reason
- Paste the Summary line into the commit message or session notes as proof

**What the verifier catches (things typecheck cannot):**
- DB tables referenced in code but never migrated (`db:push` not run)
- Workers written but not imported in `server/index.ts` or `unified-ws-handler.ts`
- Seeded data rows that were never inserted
- Curriculum unit counts below Spanish baseline (incomplete builds)
- Duplicate curriculum paths that create ambiguous routing

**If you added a new critical invariant this session** (new table, new worker, new seeded dataset), add a check for it to `server/scripts/verify-system-health.ts` before running verification. The verifier should always be ahead of the work.
