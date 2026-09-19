---
name: Verification suite parallel fixture race
description: running validation-suite.sh and consolidated-ci.sh (or the Neon gate's own test:ci matrix) concurrently risks racing on shared mutable docs/ fixtures.
---

Several of this project's named verification scripts (`run-validation-suite.sh`,
`test-all-consolidated-ci.sh`) include self-checks that temporarily mutate real
shared working-tree files (e.g. `docs/episode-28.md`) and restore them before
exiting — `test-all-consolidated-ci.sh` even ends with an explicit
`git checkout -- docs/` cleanup for exactly this reason. Both scripts contain
overlapping groups that touch the same episode/session fixture files.

**Why:** running two such scripts as separate processes at the same time is a
real race, not a hypothetical one — a `git diff` taken mid-run can show
thousands of changed lines in a file neither script intends to leave dirty,
because one script's mutation window overlapped the other's read or self-check.
It resolved itself once the first script's own cleanup ran, but a different
interleaving could have let one script observe the other's half-written
mutation and report a false failure, or vice versa.

**How to apply:** prefer running `run-validation-suite.sh`,
`test-all-consolidated-ci.sh`, and the disposable-Postgres-branch gate
(`scripts/neon-branch.ts gate`, which also runs the full `npm run test:ci`
matrix) sequentially rather than concurrently. If they must overlap, treat a
mid-run `git diff --stat` surprise in `docs/` as a likely transient race, not
proof of corruption — confirm by re-checking `git status --porcelain -- docs/`
and line counts once all runs finish, before concluding anything is actually
broken.
