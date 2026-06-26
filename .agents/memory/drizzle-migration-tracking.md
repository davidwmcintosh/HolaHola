---
name: Drizzle migration tracking table location
description: Where drizzle-kit migrate tracks applied migrations and how to stamp a baseline so migrate doesn't re-run existing tables.
---

**Table:** `drizzle.__drizzle_migrations` — lives in the `drizzle` schema, NOT `public`.

**Columns:** `id SERIAL PRIMARY KEY`, `hash TEXT NOT NULL`, `created_at BIGINT`

**Skip logic:** The migrator fetches the row with the highest `created_at` and skips any migration whose `folderMillis <= lastDbMigration.created_at`. It does NOT compare hashes to decide whether to skip — the timestamp is the gate.

**Stamping a baseline (one-time, when switching from db:push to migrate):**
```js
await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
await client.query(`CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (id SERIAL PRIMARY KEY, hash TEXT NOT NULL, created_at BIGINT)`);
const hash = createHash('sha256').update(fs.readFileSync('migrations/0000_baseline.sql', 'utf8')).digest('hex');
const folderMillis = <value from migrations/meta/_journal.json entries[0].when>;
await client.query(`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)`, [hash, folderMillis]);
```

**Why folderMillis matters:** The `when` field in `_journal.json` is what Drizzle uses as `created_at`. The stamp must use the exact same value or the comparison fails.

**Connection:** `drizzle.config.ts` uses `DATABASE_URL`. App code uses `NEON_SHARED_DATABASE_URL`. Both point to the same Neon DB. Cannot edit `drizzle.config.ts` per project rules.
