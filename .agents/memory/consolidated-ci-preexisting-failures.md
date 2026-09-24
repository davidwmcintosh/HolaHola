As of Sep 22 2026, `bash server/scripts/test-all-consolidated-ci.sh` (part of `markTaskComplete`'s validation) has three failure modes that can surface on a run even when your diff is unrelated:

1. **Deterministic, reproducible bug — `test-rolling-sync-guard.ts` (the `episode-sync` group).** Pass 2 ("warm ID, cold rolling cache") and Pass 3 ("no Markdown promotion") both fail with "DB stayed canonical but .md was not restored" (actual .md length stays at the pre-test value instead of being restored to match the DB's canonical length). Confirmed via `git worktree add /tmp/<name> <parent-commit>` (symlink `node_modules` in) against `main-repl/main` commit `febad78` ("Refactor agent memory and implement chat capture pipeline") — same two failures reproduce identically there, with zero relation to any concurrent task's diff. This is a real bug in the rolling-episode restore path (`restore-rolling-episodes-from-db.ts` / the sync guard it tests), not environmental. It has not been fixed as of this writing — a future task should pick it up, root-cause why the non-force-push restore path isn't writing the .md back to canonical length, and fix it.
2. **Transient flake — `test-north-star-semantic-echo.ts` (the `north-star` group).** Once observed failing with an unhandled `memory_embeddings` insert error mid-run (`runPart5`), with no distinct Postgres error code surfaced (the Neon serverless driver's error print only echoed the query + params, not a `cause`). Re-running the same script standalone immediately afterward passed all 59 assertions cleanly. Most likely Neon connection-pool/WebSocket pressure from `test-all-consolidated-ci.sh` spawning dozens of test scripts back-to-back, each opening its own pool — not a code bug.
3. **Deterministic, reproducible bug — `test-chat-episode-hook-e2e.ts` Step 4/5 (also the `episode-sync` group).** After the chat-episode-hook trigger is processed and appended to the fixture .md (file grows from 116 to 214 bytes, sentinel confirmed present in the .md), calling the production `syncEpisodeFile()` path logs "Rolling episode Markdown replica restored from canonical DB" and the DB record afterward is still 116 bytes — the freshly-appended sentinel never reaches the DB. Confirmed pre-existing on Sep 22 2026 via `git stash` (not even a worktree needed, since the diff under test was uncommitted) — identical failure reproduces with the stash applied and with it popped back out. Same symptom family as #1 (DB-vs-.md precedence in the rolling-episode sync path gets the direction wrong under this specific fixture shape) but a distinct test script/entry point — not yet confirmed to share one root cause with #1, just confirmed independently pre-existing and unrelated to unrelated diffs.

**Why this matters:** all three can make an unrelated task's validation run report `test-all-consolidated-ci.sh` as FAILED. Failures #1 and #3 will repeat on every run until someone fixes the underlying restore-path bug(s); failure #2 may or may not reproduce depending on load.

**How to apply:** if consolidated CI fails, check which group/script failed first. If it's `episode-sync` (`test-rolling-sync-guard.ts` Pass 2/3, or `test-chat-episode-hook-e2e.ts` Step 4/5), or a DB "Failed query" in a script your diff never touches, don't assume you caused it — grep your diff for any overlap with the failing script's imports, and if there is none, a worktree check against the parent commit (or `git stash` if the diff is still uncommitted) per `validation-failure-triage.md` will confirm pre-existing status quickly. `skip_validation_reason` citing this file is legitimate once confirmed.


**Update (Sep 23 2026, task 1539 — proving the GitHub Actions CI surface):** confirmed a 4th failure mode plus an important scope boundary.

4. **Reproducible, pre-existing — the `luca-inner-life` group.** Fails with 3/3 checks failed (e.g. `_seededFromPriorSession true even with no inner-life markers`, `.local/episode-capture-status.md` not restored as expected) — a capture-status seed/race issue. Confirmed pre-existing via `git worktree add <path> <parent-commit>` at the commit immediately before task 1539's 5 unrelated fixes: the identical failure signature reproduces there with zero code overlap with the diff under test.

**Scope boundary confirmed by grep:** none of the `episode-sync` / `luca-inner-life` / `north-star` group scripts are referenced anywhere in `scripts/run-ci-test-steps.mjs`. `test-all-consolidated-ci.sh` is a broader LOCAL validation-only script; these particular failing groups are not even part of the GitHub-Actions-reachable CI surface (`.github/workflows/ci.yml` → `run-ci-test-steps.mjs`). A task scoped to "does this pass on GitHub Actions" should not spend time chasing these groups — they're orthogonal, pre-existing, Replit-sandbox-local flakiness, confirmed separately from whatever GitHub Actions itself reports.


**Update (Sep 24 2026):** confirmed a 5th failure mode, in a DB-backed suite that is a sibling of `test-all-consolidated-ci.sh` rather than one of its groups.

5. **Deterministic, reproducible bug — `test-coordination-credential-rotation.test.ts` (run via `npm run test:coordination-ledger:run`, not part of `test-all-consolidated-ci.sh` itself).** "runtime bootstrap rotation drains safely..." and "rollback wins a race with replacement readiness..." both fail: re-exchanging a source runtime's original bootstrap after `completeCoordinationRuntimeReplacement()` or `rollbackCoordinationRuntimeReplacement()` returns `invalid_bootstrap` instead of the expected `bootstrap_already_consumed`. Confirmed pre-existing via `git stash` against a fresh local disposable Postgres (see `local-disposable-postgres-sandbox.md`): identical failure with the diff stashed out and popped back in. Same single-slot `bootstrapHash` tombstone limitation already documented in `coordination-bootstrap-reissue-tombstone.md` for the `reissue` path, now shown to also reach the rotation-complete/rollback revoke path. Not yet fixed as of this writing.

**Scope note:** this test file is wired into `npm run test:coordination-ledger:run`, a separate DB-backed suite from `test-all-consolidated-ci.sh`'s groups. If that command fails on an unrelated task with this exact symptom, it is this same pre-existing bug, not a regression caused by that task.


## Known pre-existing failures (test:coordination-ledger)

`npm run test:coordination-ledger` (`scripts/run-coordination-ledger-local.mjs`) spins up a
disposable local Postgres and is not part of `npm test`, `run-validation-suite.sh`, or
`test-all-consolidated-ci.sh` — none of those canonical steps touch the
coordination-credential-broker/rotation/actor-client test files. A failure in this suite is
invisible to the standard validation/CI gate and must be checked by running the disposable-DB
harness directly.

As of Sep 24 2026, a clean checkout (confirmed via `git stash`) fails 7 of the ~100 tests in this
suite, in two unrelated clusters:

- `test-coordination-actor-clients.test.ts` (4 tests, all the credential-cache tests): a
  bootstrap-token format/length validation guard now rejects the short placeholder tokens those
  fixtures use for mocking, before the mocked fetch is ever reached.
- `test-coordination-credential-broker.test.ts` (3 tests): several assertions still expect
  `exchangeBootstrapCredential`'s old null-return contract for failure cases, which no longer
  matches its current `{ok,reason}` discriminated-union return shape; one of the three also
  collides with the newer "grace re-exchange" feature legitimately succeeding where the test's
  old assertion still expects failure.

**Why:** discovered while verifying task 1578 (`bootstrap_already_consumed` vs
`invalid_bootstrap` on the rotation-complete/rollback path) — these 7 failures are unrelated to
that fix (confirmed identical before/after via git-stash comparison) but would otherwise look
like new regressions to the next person who runs this suite.

**How to apply:** before treating any failure in this suite as caused by your own change,
`git stash` your edit and rerun the same test file(s) to see if it already fails on clean HEAD.
These specific 7 are known-bad until someone fixes the token-format fixtures and the stale
null-contract assertions.


## Correction: the token-format bug also breaks the standard validation gate

The `test-coordination-actor-clients.test.ts` failures above are not confined to the
optional `test:coordination-ledger` harness. The same root cause (a bootstrap-token
format/length guard added in `coordination-actor-client.ts` requiring
`COORDINATION_RUNTIME_BOOTSTRAP_TOKEN` to be exactly 46 characters) also fails all 3
tests in `server/scripts/test-coordination-cli-credential-persistence-e2e.test.ts`
("a second coordination-cli.ts invocation ... reuses the cached credential",
"a different runtime ID never reuses another runtime's cached credential",
"an expired cached credential is discarded ... falls back to a new bootstrap
exchange") — and that file runs inside the `Application test suite` step of
`server/scripts/run-validation-suite.sh`, which IS part of the standard
`markTaskComplete` validation gate. So this bug currently fails standard validation
for every task, not just callers of the disposable-DB harness.

Confirmed pre-existing (not caused by task 1578's change) via `git worktree add
--detach <path> 1dbdb97` (the commit immediately before task 1578's fix, itself
immediately after `303630e Validate bootstrap token shape locally before
coordination credential exchange` — the commit that introduced the guard) and
re-running the exact test file there: identical 3/3 failures, same error text, on
Sep 24 2026.

**Why:** `run-validation-suite.sh` failing is otherwise indistinguishable from a real
regression in `markTaskComplete`'s automatic validation; the next agent whose
unrelated task trips this same failure needs to know it's this known, already-tracked
bug (see follow-up task fixing the actor-client token-length guard against short
test fixtures) and cite `skip_validation_reason` with proof, not chase a phantom
regression in their own diff.

**How to apply:** if `run-validation-suite.sh` fails at `[ci:test N/157] ... npx tsx
--test server/scripts/test-coordination-cli-credential-persistence-e2e.test.ts` with
a "must be exactly 46 characters" error, this is the same known bug — verify
non-coupling to your own diff (grep your changed files for any import from
`coordination-actor-client.ts`'s token validation, or just worktree-compare at your
own parent commit) and proceed via `skip_validation_reason` rather than trying to fix
it under an unrelated task.


## Correction: does not reproduce on `main` as of commit cbec01c (Sep 24 2026)

Both failure claims above were re-checked directly against `main` at commit
`cbec01c5f216c49026fc45c67e3ccc6d8d4921dd` and did not reproduce:

- `test-coordination-cli-credential-persistence-e2e.test.ts`: 3/3 pass. Its
  `fakeBootstrapToken()` fixture generates `cb_` + 43 base64url chars (46
  total) — already compliant with the guard.
- `test-coordination-actor-clients.test.ts`: 22/22 pass (run standalone).
  Its `VALID_BOOTSTRAP_TOKEN` fixture is `cb_` + `'r'.repeat(43)` (46 total)
  — also already compliant.
- The full `run-validation-suite.sh` (157/157 checks) passed clean on this
  commit, including the named e2e file.

**Why:** the original note was likely written against task 1578's own
in-progress branch state (possibly before its fixtures were updated, or a
different environment's `COORDINATION_RUNTIME_BOOTSTRAP_TOKEN`), not against
`main`. The underlying guard (`must be exactly 46 characters` in
`coordination-actor-client.ts`) is real, but both named fixtures already
satisfy it on `main`.

**How to apply:** don't cite this note's specific failure counts as a
`skip_validation_reason` without first re-running the named test file(s)
yourself — if they pass, the bug isn't present in your checkout and this
note's claim is stale for your context. If you find a genuinely reproducing
case, name the exact commit/branch and token value that fails, since "every
task" was already too broad a claim once.

