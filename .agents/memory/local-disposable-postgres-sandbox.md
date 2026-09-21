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

## Omitting CI=true fails silently, not loudly

**Silent-fallback pitfall:** setting `CI_DATABASE_URL` and `NEON_SHARED_DATABASE_URL` to a local disposable instance without also setting `CI=true` does not fail loudly. `server/db.ts`'s `getDb()` only routes through the plain `pg` driver when `server/ci-database.ts`'s `getVerifiedCiDatabaseUrl()` returns a value, which requires `CI==='true'` **and** `NEON_SHARED_DATABASE_URL===CI_DATABASE_URL` together — both conditions, not just a matching URL. Omit `CI=true` and it silently falls through to the `@neondatabase/serverless` driver, which speaks a different wire protocol than plain Postgres and produces an unrelated-looking, mismatched error shape (e.g. a driver-specific error a caller's FK-violation-detection code doesn't recognize) instead of a clean connection failure — looking exactly like a cascade of application-level test failures. Always set all three (`CI=true`, `CI_DATABASE_URL`, matching `NEON_SHARED_DATABASE_URL`) together when manually reproducing CI's local-Postgres path; a failure that looks like a real regression is worth re-checking against this gate before trusting it.

