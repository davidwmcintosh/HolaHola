---
name: Drizzle sql tag — dynamic import required in handlers
description: Top-level sql import from drizzle-orm does not work with getSharedDb().execute() in route handlers; must use dynamic import inside the handler.
---

The top-level `import { sql } from 'drizzle-orm'` at the module head produces a SQL template tag object that is NOT compatible with `getSharedDb().execute()` in route handlers. The call silently fails with a "Failed query" error (params are empty; the query text is shown but never runs).

**Why:** The drizzle `sql` tagged template literal creates a `SQL` object. The Neon pooled connection's `.execute()` expects the SQL object to come from the same import chain that was used to configure the DB pool. When imported statically at the top of a large file like `routes.ts`, the binding breaks in this specific combination.

**How to apply:** Inside any route handler that needs raw SQL via `getSharedDb()`, use:

```ts
const { sql: rawSql } = await import('drizzle-orm');
const obsDb = getSharedDb();
const rows = await obsDb.execute(rawSql`SELECT ... FROM ... WHERE id = ${someId}`);
```

The dynamic import resolves to the same module — no performance concern. The pattern already appears in many handlers throughout `routes.ts`; match it rather than inventing a new approach. The row accessor pattern also varies by driver: try `(result as any).rows?.[0] ?? (result as any)[0] ?? null`.

**Why this matters:** The top-level `sql` import looks identical and TypeScript doesn't catch the mismatch. The error ("Failed query: ... params: ") looks like a DB connectivity problem but is actually an import binding issue. Wasted 2 debugging cycles on this in the observation bench build (July 18, 2026).
