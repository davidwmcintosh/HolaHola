---
name: Drizzle sql tag cannot bind a raw array for ::text[]
description: db.execute(sql`...`) via drizzle-orm's sql tag does not accept a raw JS array parameter for a ::text[] cast the way postgres.js's own tagged template does; build a Postgres array-literal string instead.
---

## The problem

postgres.js's own tagged-template client (`` db`INSERT ... VALUES (${jsArray}::text[])` ``) serializes a JS array directly into a Postgres array literal. Drizzle-orm's `sql` tag used with `db.execute(sql\`...\`)` (via `getSharedDb()`/`getUserDb()` — both Drizzle instances, per `server/db.ts`) does not do this: a raw JS array bound this way does not cast to `text[]` correctly.

## How to apply

Build the array as a Postgres array-literal STRING and interpolate that string with the `::text[]` cast, instead of interpolating the array itself:

```ts
function pgTextArrayLiteral(values: string[]): string {
  return `{${values.map(v => `"${v.replace(/"/g, '\\"')}"`).join(',')}}`;
}
// ...
await db.execute(sql`INSERT INTO t (col) VALUES (${pgTextArrayLiteral(['a', 'b'])}::text[])`);
```

This pattern already existed in `agent-session-autosave.ts` (`participantsArray`) before being reused in `save-transcript-now.ts`'s chat-capture participants fix (Sep 2026). Scripts using the raw postgres.js tag directly (e.g. `capture-watchdog.ts`'s `` db`...` ``) don't need this — they can bind a JS array to `::text[]` natively.
