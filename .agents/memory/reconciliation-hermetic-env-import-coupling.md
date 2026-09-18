---
name: Reconciliation self-check must not import DB/app modules
description: validateCandidate's subprocess env is deliberately stripped of DB credentials/secrets; any eager top-level import that touches server/db.ts breaks the self-check for every future reconciliation, not just the current diff.
---

`source-reconciliation-service.ts`'s default `validateCandidate` runs `test-source-reconciliation-service.ts` (and `tsc`) in a subprocess with a deliberately minimal env (`PATH`, `HOME`, `CI`, `NODE_ENV`, `GIT_TERMINAL_PROMPT` only) — no DB credentials, no secrets. This is intentional defense-in-depth, separate from the main sync/prepare path's `commandEnv()`, which does inherit the full environment.

A plain (non-type-only) `import { SourceControlService } from './source-control-service'` in `source-reconciliation-service.ts` — used only for its TypeScript type and as a default-construction fallback — still executes `source-control-service.ts`'s full module body at load time, including `import { db } from '../db'`. `server/db.ts` throws eagerly at import time if `NEON_SHARED_DATABASE_URL` is missing. Result: the self-check fails with a DB fatal error under the stripped env, for literally any candidate, regardless of what's actually being reconciled — the failure has nothing to do with the diff being validated. The candidate-outcome audit JSON only records the generic wrapper error, not the real per-command stderr, so this failure mode is invisible from the audit trail alone; reproduce it directly instead.

Fix pattern: `import type` for the type-only need, plus a lazy `await import('./source-control-service')` inside an async accessor, constructed only when no `sourceControl` stub was injected (tests always inject one, so the dynamic import never fires under test).

**Why:** this failure mode is silent and non-obvious from the error alone (looks like a missing-env-var problem with the whole app, not an import-coupling problem in one file) and will recur if anyone adds another eager value-import of an app/DB-touching module to this file or its dependencies.

**How to apply:** before adding any new top-level import to `source-reconciliation-service.ts`, ask whether it's a real runtime dependency or only needed for typing/optional default construction. If the latter, use `import type` plus a lazy dynamic import. Verify by running the self-check under an explicitly stripped env, not just a normal shell invocation (a normal run inherits full env and won't catch this): `env -i PATH="$PATH" HOME=<tmp-dir> CI=1 NODE_ENV=test GIT_TERMINAL_PROMPT=0 node_modules/.bin/tsx server/scripts/test-source-reconciliation-service.ts`.
