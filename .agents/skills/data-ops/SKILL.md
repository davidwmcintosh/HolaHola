---
name: data-ops
description: Generalizes the schema-migration gate to arbitrary production data changes — write an idempotent script, prove it on a disposable Neon branch, then it applies to production automatically as part of the normal promote. Tool: scripts/run-data-ops.ts.
---

# Data Operations

**Full rationale:** the same reasoning as `.agents/skills/holahola-schema/SKILL.md`
and `cross-tool-promote.yml`'s own header comment — a gate that clones
production, applies the change for real, and runs the full test suite
against it is a stronger trust boundary than a human re-approving an
agent's own analysis after the fact. Schema migrations already work this
way (`db:branch -- gate`, then `cross-tool-promote` applies automatically).
This extends the identical shape to non-schema data changes: deleting a
duplicate account, backfilling a column, merging two records — anything
that isn't a `drizzle-kit` migration but still needs to touch the one
shared production database safely.

## What this is for

Use whenever you need to change production *data* (not schema) as part of
landing a change — the kind of thing that used to mean a human manually
running a hand-written script against `NEON_SHARED_DATABASE_URL` with no
gate at all. That pattern is retired; every such change now goes through
the same forced process a migration does.

## The steps

1. **Write the script** in `scripts/data-ops/<name>.ts`, exporting
   `async function run(pool): Promise<{ applied: boolean; detail: string }>`.
   See `scripts/data-ops/README.md` for the exact shape and the one hard
   rule: **it must be idempotent**. Check the state it cares about first,
   act only if still needed, and say so in the returned `detail` either way.
2. **Test it locally against a disposable branch first**, same as any
   other change: `npm run db:branch -- create <name>`, point
   `NEON_SHARED_DATABASE_URL` at the pooled string it prints, then
   `npx tsx --env-file-if-exists=.env scripts/run-data-ops.ts` and confirm
   it does what you expect. Run it a second time against the same branch
   to prove the idempotency claim isn't just asserted — a script that
   isn't actually safe to re-run hasn't been tested, it's been hoped about.
3. **Commit the script and push through the normal promote flow**
   (`.agents/skills/cross-tool-promote/SKILL.md`). The gate
   (`npm run db:branch -- gate`) runs every script in `scripts/data-ops/`
   against its own disposable production clone as part of the same pass
   that validates migrations and the test suite.
4. **On a gate pass, it applies to real production automatically** — the
   same promote step that applies gate-approved migrations also runs
   `scripts/run-data-ops.ts` against production's real direct connection,
   before the code that may depend on the change lands.
5. **Leave the script in place.** There is no "applied" folder to move it
   to and no bookkeeping step — idempotency is what makes it safe for the
   script to run again on every future promote and correctly no-op.

## Why no separate secret, no separate credential

Identical reasoning to the migration step: the production connection is
resolved fresh each run via `scripts/neon-branch.ts connection-string
production`, using the `NEON_API_KEY` / `NEON_PROJECT_ID` secrets already
present in the promote workflow — never a dedicated secret, never a
connection string handed to or held by the calling agent directly.

## Reminders

- **Idempotent, not "runs once."** A script that assumes it has never run
  before, or that errors on a second run instead of cleanly no-op'ing, does
  not meet the bar — fix it before it ever reaches the gate.
- A script that legitimately needs a real transaction should acquire its
  own client via `pool.connect()` and manage `BEGIN`/`COMMIT`/`ROLLBACK`
  itself — the runner does not wrap each script in a transaction for you.
- If a script needs to know row counts, foreign-key references, or
  anything else about current state before deciding what to do, query for
  it — never assume, the same discipline `neon-branch.ts` already applies
  to connection strings and database names.
