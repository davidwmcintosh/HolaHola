---
name: Replit executeSql vs Neon DB
description: executeSql({ environment: "production" }) hits Replit's abandoned managed DB, not the app's Neon DB — always returns empty/wrong data for this project.
---

# Replit executeSql vs the App's Neon DB

## The rule
`executeSql({ environment: "production" })` (and the dev equivalent) connects through Replit's **own managed PostgreSQL**, not through the app's `NEON_SHARED_DATABASE_URL`. For this project, Replit's managed DB is empty and abandoned — all data lives in Neon.

**Why:**  
HolaHola migrated away from Replit's managed PostgreSQL months ago. The app uses `NEON_SHARED_DATABASE_URL` exclusively (`server/db.ts` line ~45). The Replit database tool has no knowledge of this — it probes its own system DB, which was severed. Result: `executeSql` always returns 0 rows for any production table query.

**How to apply:**  
- Never use `executeSql` to check whether production data exists — it will lie.  
- To verify production data, use `node -e "..."` with `require('pg')` and `process.env.NEON_SHARED_DATABASE_URL` directly, or check the running server logs.  
- To monitor the live conversation from dev, use `node server/scripts/monitor-founder-chat.js` (plain pg, no server imports).
- Replit's pre-publish schema-diff check also compares its own managed
  development/production databases, not the shared Neon database. Treat that
  report as a separate publishing-system concern; verify Neon migrations with
  the project's Neon gate and integrity checks.

## Split-view confirmation (Aug 6 2026)
Both dev and prod have `NEON_SHARED_DATABASE_URL` set as a shared secret. Both environments connect to the **same single Neon DB**. The split-view model (David+Daniela on prod, Luca coding on dev) works right now with no config changes needed.

## Publish-bound writer compatibility

When a shared Neon migration introduces a fail-closed writer contract, the
published image must be promoted in the same operational window. A healthy
development process does not update production, and an old production image can
be correctly blocked by the new database invariant.

**Why:** Migration activation once preceded the compatible production publish.
Recipient-less writes still worked, while explicit-recipient writes rolled back
at commit until the new image was published.

**How to apply:** After the Neon gate and real migration, publish the compatible
image promptly, health-check the production URL, and run the guarded mutation
against production before inviting another runtime to use it. Never weaken the
database guard to accommodate a stale image.
