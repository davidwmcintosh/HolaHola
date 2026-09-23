---
name: Validation-suite ↔ CI parity guard design
description: Non-obvious decisions behind cross-referencing run-validation-suite.sh's run_check lines against run-ci-test-steps.mjs's reachable command set (task #1538).
---

Built to stop the recurring class of bug where a `run_check` line in
`server/scripts/run-validation-suite.sh` has no matching entry in
`scripts/run-ci-test-steps.mjs`, so GitHub CI never runs it (three prior
rounds each found one instance by manual audit before this guard existed).

**Match granularity is (file path + trailing `--flag` tokens), not the whole
`run_check` line.** `run-ci-test-steps.mjs`'s splice list already fragments
a multi-file `run_check` line (e.g. `npx tsx --test file-a.ts file-b.ts`)
into separate single-file command strings. Matching whole-line text would
false-positive on every one of those. Extract every `path.ext (--flag)*`
token instead and treat each as an independent required/reachable entry.

**`npm run <name>` must be resolved generically against the full
`package.json` scripts map, not just the 4 named chains mentioned in the
task.** `run-validation-suite.sh` invokes several other composite scripts
(`npm run test:source-bridge`, `test:github-release-safety`, etc.) that
themselves fan out to the real file invocations. Do a fixed-point global
replace using the whole `scripts` map (bounded iteration count for safety),
leaving anything unresolvable as literal text rather than throwing --
being lenient here avoids scope creep into general npm-script integrity
checking.

**The harness file itself must be carved out.** `scripts/run-ci-test-steps.mjs`
is what DEFINES the reachable set (`npm run test:ci` → `node
scripts/run-ci-test-steps.mjs`). It must never be treated as a member of
either the required or reachable set, or the "Application test suite"
`run_check` line permanently self-flags as missing.

**Plain regex text scanning is sufficient — no AST or shell parsing
needed.** Global regex matching for `npm run X` and `path.ext (--flag)*`
works correctly regardless of `bash -c '...'` wrapping or `&&` chaining,
because it never needs to know where one command ends and another begins —
only whether a given file+flags token appears anywhere in the text blob.

**Direction is intentionally one-way**: required (validation-suite) ⊆
reachable (CI). The reverse — a check reachable from CI but no longer
referenced by any `run_check` line, meaning local `bash
server/scripts/run-validation-suite.sh` runs give no signal on it — is a
real but distinct gap, deliberately left out of this guard and filed as a
separate follow-up (task #1540) rather than folded in.

**The allowlist lives as a plain module-level `Set` in the guard's own
source file** (`REPLIT_ONLY_ALLOWLIST` in
`server/scripts/test-validation-suite-ci-parity.ts`), not an external config
file or env var — the task's explicit intent was that adding an exception
always means editing this script directly, so it can't happen silently.

