---
name: esbuild isMain guard — bundle collapse
description: import.meta.url equals process.argv[1] for every module inside an esbuild bundle; the standard isMain check always fires at server boot.
---

## The rule

Never use `import.meta.url.endsWith(process.argv[1])` (or `===`) as a "am I the main script?" guard in any file that is or could be imported by the server bundle.

**Why:** esbuild merges all source files into one `dist/index.js`. Inside that bundle, every module's `import.meta.url` is `file:///…/dist/index.js` — the same value as `process.argv[1]`. The check is always `true`, so any top-level `if (isMain) { … process.exit() … }` block fires at server boot as an async IIFE, then kills the process when it finishes (exit 0 on success, exit 1 on failure).

**How it manifested:** `populate-principle-embeddings.ts` was killing the production server ~1–2 min after every boot. Logs showed "command finished successfully with exit code 0" (Neon WS query succeeded → `process.exit(0)`) or "exit status 1" (Neon WS dropped mid-query → catch → `process.exit(1)`). The server appeared to start and serve briefly, then die in a restart loop.

## Correct pattern

Check the **actual filename** in `process.argv[1]`, not `import.meta.url`:

```ts
// Safe — works both with tsx (source path) and node dist/index.js (bundle path)
const isMain = Boolean(process.argv[1]?.includes('my-script-name'));
```

- `npx tsx server/scripts/my-script-name.ts` → `argv[1]` contains the filename ✓
- `node dist/index.js` → `argv[1]` is `dist/index.js` ✗ → `isMain` false ✓

`reembed-memory.ts` already uses this pattern (`argv[1]?.endsWith('reembed-memory.ts')`).

## How to apply

Any script in `server/scripts/` that (a) exports a function AND (b) is dynamically imported by `server/index.ts` or `server/routes.ts` must use the `argv[1]?.includes(...)` form, NOT `import.meta.url`. Scripts that are CLI-only (never imported by the server) are still affected by the bundle collapse if esbuild touches them, so prefer the argv form everywhere.
