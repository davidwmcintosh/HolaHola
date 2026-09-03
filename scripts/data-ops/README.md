# Data Operations

One-off production data changes (deleting a duplicate account, backfilling
a column, merging records) that aren't schema migrations, run through the
exact same forced-process pipeline migrations use — see
`.agents/skills/data-ops/SKILL.md` for the full workflow, and
`scripts/run-data-ops.ts` for the runner.

## The one hard rule

**Every script here must be idempotent.** Check the state you care about
first; act only if it's still needed; report whether you actually did
anything. Unlike a drizzle migration (tracked automatically so re-running
is a safe no-op), a data-op script has no built-in tracking — idempotency
by construction is the substitute, and it's what makes it safe to leave a
script in this directory indefinitely instead of needing to remember to
delete or archive it after it's run once.

## Shape

```ts
import type { Pool } from '@neondatabase/serverless';
import type { DataOpResult } from '../run-data-ops';

export async function run(pool: Pool): Promise<DataOpResult> {
  const existing = await pool.query("SELECT 1 FROM users WHERE id = $1", ['some-id']);
  if (existing.rows.length === 0) {
    return { applied: false, detail: 'already gone, nothing to do' };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // ... the actual change, across whatever tables it needs ...
    await client.query('COMMIT');
    return { applied: true, detail: 'deleted the duplicate row and its 3 child rows' };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
```
