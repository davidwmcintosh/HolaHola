---
name: Disposable database test boundary
description: Safety rule for regression tests whose production paths write database records.
---

Any regression test that can write database state must fail closed unless the process has positively verified a disposable, job-local database. Local and Replit runs without that proof may keep static and in-memory coverage, but must not reach the persistence path. Full persistence coverage belongs in CI with an isolated database.

**Why:** Best-effort cleanup did not protect shared Neon. Interrupted or failed tests left synthetic coordination projections and hundreds of identical scratchpad memories behind. A cleanup hook is recovery logic, not an isolation boundary.

**How to apply:** Before adding or extending a DB-writing test, use the project’s verified CI database contract. Guard the whole mutating setup/test/teardown path, preserve full coverage in isolated CI, and add a check that detects removal of the guard.