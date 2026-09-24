## CLI stdout/stderr diagnostic separation

Any script under `server/scripts/` that advertises a `--json` (or otherwise
machine-parsed stdout) contract must keep stdout limited to that payload.
`server/db.ts` is imported by nearly every script in this repo and used to log
its `[DB] ...` banners (patch applied, database configured, pool initialized,
pool closed) via `console.log` — i.e. stdout — both as a module-import side
effect and from `closeDbConnections()`. That silently broke every `--json` CLI
built on top of it: `JSON.parse(child.stdout)` would fail or need to
pre-filter `[DB]`-prefixed lines first.

**Why:** stdout is the data channel; stderr is the diagnostics channel. A
shared module has no way to know whether its caller is a human-facing script
or a `--json` CLI being spawned and parsed by another process, so it must
default to stderr for anything that isn't the actual advertised output.

**Fixed (Sep 24 2026):** all four `[DB]` banners in `server/db.ts` now use
`console.error`, with an inline comment at each call site stating the
contract this protects. Confirmed via repo-wide grep that nothing depended on
these banners appearing specifically on stdout.

**How to apply:**
1. When adding a new CLI with a `--json` mode, test it by spawning the real
   compiled/invoked command and calling `JSON.parse(result.stdout)` directly
   — never pre-filter known "noisy" prefixes before parsing. A test that
   strips lines before asserting is very likely masking a real contract
   violation instead of proving the contract holds.
2. When adding a new `console.log` to a shared module under `server/` (`db.ts`
   and similar always-imported files), ask whether every possible caller is
   fine with that text landing on stdout. If the module can be imported by a
   CLI script, default to `console.error` for anything that is a diagnostic
   banner rather than the script's actual output.

