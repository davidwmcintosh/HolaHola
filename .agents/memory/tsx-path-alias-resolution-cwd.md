---
name: tsx path alias resolution depends on spawn cwd
description: A spawned `npx tsx <file>` process fails to resolve this project's `@shared/*` (and similar) TS path aliases when its `cwd` is outside the checkout, even though the file being run lives inside it.
---

## The quirk

`npx tsx <path-to-file>` resolves TS path aliases (e.g. `@shared/schema` ->
`shared/schema.ts`) by walking up from the spawned process's **cwd** to find
the nearest `tsconfig.json`, not from the location of the file actually being
executed. A hermetic test driver spawned with `cwd` pointed at an isolated
temp directory (the common pattern for proving path-portability code, e.g.
`HOLAHOLA_WORKSPACE_ROOT`-style tests) will throw
`ERR_MODULE_NOT_FOUND: Cannot find package '@shared/...'` at import time,
even though the driver file itself sits inside the real checkout and would
import fine if run directly.

**Why:** discovered building a portability regression test that spawned a
driver with `cwd: tempRoot` to prove a service resolves paths via an env var
instead of `process.cwd()`. The driver imported a module that (transitively)
imports `@shared/schema`, and the spawn failed purely from the cwd change --
nothing to do with the code under test.

**How to apply:** when spawning `npx tsx` for a hermetic driver/self-check
test, keep `cwd` at the real repo root so tsx's tsconfig discovery works
normally. Pass whatever "pretend you're elsewhere" signal the code under test
actually reads (e.g. `HOLAHOLA_WORKSPACE_ROOT`) through `env` instead --
`resolveWorkspaceRoot`-style helpers treat an absolute env value as
authoritative regardless of cwd, so this fully preserves the test's intent.
Reserve a cwd change for tests that specifically need to prove cwd-based
fallback behavior itself (and in that case, keep the imports in the spawned
file free of path-aliased modules).
