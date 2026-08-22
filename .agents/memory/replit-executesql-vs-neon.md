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

## Split-view confirmation (Aug 6 2026)
Both dev and prod have `NEON_SHARED_DATABASE_URL` set as a shared secret. Both environments connect to the **same single Neon DB**. The split-view model (David+Daniela on prod, Luca coding on dev) works right now with no config changes needed.
