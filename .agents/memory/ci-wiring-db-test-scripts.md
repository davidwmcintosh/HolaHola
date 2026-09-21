---
name: Wiring new DB-backed tests into CI
description: Where to register a new *.test.ts file so it actually runs with real database coverage, not just text-visible in a script.
---

There are at least three separate places a DB-backed test file can be referenced in
this repo, and they serve different purposes -- adding a file to the wrong one gives
false confidence (it "runs" but its persistence tests always self-skip):

- `scripts/run-ci-test-steps.mjs` — splices extra commands into the parsed
  `package.json` `scripts.test` chain. This is the one that actually gets exercised
  by both `npm run test:ci` (used by `run-validation-suite.sh`'s "Application test
  suite" check) and GitHub Actions' `test-unit`/`test-guards` jobs, both of which
  provision a real local Postgres 16 service with `CI=true` +
  `CI_DATABASE_URL`/`NEON_SHARED_DATABASE_URL` pointed at it. This is the right
  place to add a new DB-backed test file so it gets real database coverage
  automatically.
- `server/scripts/run-validation-suite.sh` — also worth adding an explicit named
  `run_check "..." npx tsx --test <file>` line here (in addition to the splice
  above), matching the existing convention where a file like
  `coordination-v2-runtime-bootstrap-service.test.ts` appears in both places. This
  script has no Postgres service of its own in Replit's sandbox, so DB-backed tests
  self-skip when run this way alone — the value here is per-check visibility in the
  registered "Validation suite", not DB coverage.
- `server/scripts/test-all-consolidated-ci.sh`'s `group_body_workflow_safety` — do
  NOT add new DB-backed test files here by default. This group is specifically for
  guards that used to consume individual Replit workflow slots before being
  consolidated; it has no Postgres service backing it either (confirmed by grep for
  `CI_DATABASE_URL`), so anything added here never gets real DB coverage.
- `scripts/neon-branch.ts` — a separate "migration-branch gate" that provisions a
  real ephemeral Neon branch and forces specific `<PREFIX>_REQUIRE_DATABASE_TESTS=1`
  + `<PREFIX>_TEST_DATABASE_URL`/`_DISPOSABLE=1` env vars for an explicit allowlist
  of test files (grep the file for `REQUIRE_DATABASE_TESTS` to see the current
  list). A new DB-backed test file following the disposable-database pattern is NOT
  automatically covered by this gate — it must be added to the allowlist separately
  if migration-branch verification should exercise it too. This is a distinct
  verification axis from the CI-aggregation wiring above. Concretely: the
  "allowlist" is not a data list to append to, it's a hardcoded env-var block
  inside `cmdGate()`'s body (`branchEnv.<PREFIX>_TEST_DATABASE_URL = directUrl`,
  etc.) plus a hardcoded `runCommand('npx tsx --test <file>', branchEnv)` call
  with its own failure check — adding coverage means editing that function.

**The two DB-test patterns are mutually exclusive coverage axes, not layers:**
`cmdGate()` does `delete branchEnv.CI` before running anything (including its own
trailing `npm run test:ci:unit/guards/episodes` calls), specifically so
`run-ci-test-steps.mjs`'s `assertSafeCiDatabaseConfiguration()` doesn't reject a
real Neon URL for not being a localhost `CI_DATABASE_URL`. The practical effect:
a test gated on `getVerifiedCiDatabaseUrl()` (checks `CI==='true'`) always
self-skips inside `db:branch -- gate`, even if it's spliced into
`run-ci-test-steps.mjs` and even though `gate` does call `npm run test:ci:unit`.
Conversely, `.github/workflows/ci.yml` only ever sets `CI_DATABASE_URL` — never
any `<PREFIX>_TEST_DATABASE_URL` — so a dedicated-env-var-pattern test merely
spliced into `run-ci-test-steps.mjs` (without also being hardcoded into
`cmdGate()`) silently skips under GitHub Actions too, since only `gate` ever sets
`<PREFIX>_REQUIRE_DATABASE_TESTS=1`. A test file needs the dedicated-var check
(hard-fail when its own `_REQUIRE_DATABASE_TESTS=1`, else return undefined) to
get real Neon-branch-gate coverage, and separately needs to be reachable via
`getVerifiedCiDatabaseUrl()` to get real GitHub-Actions coverage — one pattern
alone gives you exactly one of the two, never both, and "it's in the splice list"
is not evidence it runs for real under the gate.

**Neither shell script is reachable from GitHub Actions at all:** grepping
`.github/workflows/*.yml` for `run-validation-suite` or
`test-all-consolidated-ci` returns nothing — `ci.yml` only calls `npm run
test:ci:unit` / `test:ci:guards` / `test:ci:episodes`, which are thin
wrappers around `scripts/run-ci-test-steps.mjs --group=...`. So
`run-validation-suite.sh` and `test-all-consolidated-ci.sh` are both
Replit-only, on-demand workflows (manually triggered, or run as part of this
project's own task-completion validation) — a test file registered only in
one or both of them is *not* covered by GitHub's automatic push/PR CI.
Confirming true "runs on every push with no manual trigger" coverage
requires adding the file to `scripts/run-ci-test-steps.mjs` specifically.

**Verifying a `run-ci-test-steps.mjs` splice edit without running anything:** the
script computes and validates all `GROUPS` ranges (throwing "CI test groups must
cover the canonical test command chain contiguously" on a mistake) *before*
checking whether the requested `--group=` value is valid. So running
`node scripts/run-ci-test-steps.mjs --group=<bogus-value>` exercises the full
splice + group-boundary + contiguous-coverage validation and then cleanly throws
"Unknown CI test group" without spawning a single test command — a safe,
side-effect-free way to confirm a splice edit didn't break the grouping.
