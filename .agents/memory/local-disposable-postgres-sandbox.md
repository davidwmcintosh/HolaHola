---
name: Local disposable Postgres in the Replit sandbox
description: How to stand up a real throwaway Postgres instance in this container to prove DB-backed CI tests actually pass, without waiting on GitHub Actions.
---

Postgres 16.x binaries are already available via the nix store (find them with e.g.
`find /nix/store -maxdepth 1 -iname '*postgresql-16.1*'` then use `<store-path>/bin/`).
This makes it possible to fully replicate GitHub Actions' `test-unit`/`test-guards`
local-Postgres-service setup (`postgresql://postgres:postgres@127.0.0.1:5432/<db>`,
`CI=true`) for manual verification instead of waiting on a real CI run.

**Quirk:** starting Postgres with `pg_ctl -D <datadir> ... start` (which
daemonizes/detaches the postmaster) *inside a normal foreground ShellExec call*
does not survive past that call — the server logs a clean "database system was
shut down" and is gone by the next call, even though `pg_ctl` itself reported
"server started" successfully. The sandbox appears to tear down the whole process
group when a foreground shell call completes, regardless of the child's own
detachment.

**Fix:** launch Postgres itself (not `pg_ctl`) as a genuine backgrounded task:
ShellExec with `run_in_background: true` running
`postgres -D <datadir> -p <port> -k /tmp -h 127.0.0.1` directly. Then use a
separate foreground call (or `Monitor` on the background task's log for "ready to
accept connections") to `createdb`, run `drizzle-kit migrate` (point
`NEON_SHARED_DATABASE_URL` at the instance), and run the target test file with
`CI=true CI_DATABASE_URL=... NEON_SHARED_DATABASE_URL=...` (all three must satisfy
`server/ci-database.ts`'s `getVerifiedCiDatabaseUrl` gate: loopback host, and
`NEON_SHARED_DATABASE_URL` exactly equal to `CI_DATABASE_URL`). Tear down with
`ShellKill` on the background task (or a clean `pg_ctl ... stop` first) and remove
the scratch data directory.

## The teardown quirk is general, not pg_ctl-specific

**Generalization:** the same process-group teardown hits any child backgrounded with `nohup ... &` (or `disown`) inside an otherwise-foreground ShellExec call, not just `pg_ctl`. E.g. `nohup npm run db:branch -- gate > log 2>&1 &` inside a foreground call looked like it started (prints its first few lines, the wrapping shell command completes and returns cleanly), but the actual `tsx`/`node` process is gone by the next call — no error, no crash log, just silence and zero further log growth. The tell: `ps aux` shows no matching process at all (not even a zombie) after a foreground call that *appeared* to background something has returned. **Always use ShellExec's own `run_in_background: true` for anything that must outlive the current call** — never rely on `nohup`/`disown`/`setsid` inside a normal call to survive. If a Neon-branch-gate (or similar) job dies this way mid-run, check `neon-branch.ts list` for an orphaned `test/migration-*` branch and delete it before retrying — the gate's own cleanup step never got to run.

## Omitting CI=true fails silently, not loudly

**Silent-fallback pitfall:** setting `CI_DATABASE_URL` and `NEON_SHARED_DATABASE_URL` to a local disposable instance without also setting `CI=true` does not fail loudly. `server/db.ts`'s `getDb()` only routes through the plain `pg` driver when `server/ci-database.ts`'s `getVerifiedCiDatabaseUrl()` returns a value, which requires `CI==='true'` **and** `NEON_SHARED_DATABASE_URL===CI_DATABASE_URL` together — both conditions, not just a matching URL. Omit `CI=true` and it silently falls through to the `@neondatabase/serverless` driver, which speaks a different wire protocol than plain Postgres and produces an unrelated-looking, mismatched error shape (e.g. a driver-specific error a caller's FK-violation-detection code doesn't recognize) instead of a clean connection failure — looking exactly like a cascade of application-level test failures. Always set all three (`CI=true`, `CI_DATABASE_URL`, matching `NEON_SHARED_DATABASE_URL`) together when manually reproducing CI's local-Postgres path; a failure that looks like a real regression is worth re-checking against this gate before trusting it.


## Check for an existing local-DB test harness before hand-rolling one

Before manually following the initdb/postgres/createdb/migrate recipe above,
check `package.json` for a `test:*-local`-style script (e.g.
`test:coordination-ledger`, backed by `scripts/run-coordination-ledger-local.mjs`)
-- several test families already have a one-shot script that stands up a
disposable local Postgres, applies migrations, seeds fixtures, runs the full
relevant test suite (including any CI self-checks), and tears everything
down automatically. These scripts spawn Postgres directly as a real child
process (not `pg_ctl`/`nohup` in a foreground shell), so launch them with
your own shell tool's true background-task support rather than a trailing
`&`, and don't assume they need the manual-recipe workaround above -- that
quirk is about how *you* invoke a long-running command, not something the
script itself does or doesn't handle. Prefer an existing script like this
over the manual recipe whenever one matches the area under test; fall back
to the manual recipe only where no such harness exists.


## Testing one file outside a harness's fixed list: copy the wrapper, keep it in-tree

A harness like `run-coordination-ledger-local.mjs` hardcodes its final test
invocation (e.g. `npm run test:coordination-ledger:run`, itself a fixed
file list in `package.json`) — it does not forward extra file arguments. To
verify a *different* file that shares the same DB setup/migrations but isn't
in that list (e.g. a sibling `test-*.test.ts` not wired into the same
`package.json` script), copy the harness `.mjs` file and replace only its
final `run(...)` line with a direct `npx tsx --test <your-file>` call.

**Quirk:** the copy must live somewhere inside the project tree (repo root or
below), not `/tmp`. Node's ESM resolver looks for `node_modules` starting from
the *importing file's own path* upward, not from `cwd` — a copy saved to
`/tmp/foo.mjs` and run with `cwd` set to the project root still fails with
`ERR_MODULE_NOT_FOUND` on the harness's own dependencies (e.g. `pg`), because
`/tmp` has no `node_modules` ancestor. Save the copy at the project root (e.g.
`./run-<name>-local.tmp.mjs`), run it, then delete it immediately after —
whether it passed or failed — so it never lands in a commit.
