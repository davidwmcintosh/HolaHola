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

5. **Fixed (was: deterministic, reproducible bug) — `test-coordination-credential-rotation.test.ts` (run via `npm run test:coordination-ledger:run`, not part of `test-all-consolidated-ci.sh` itself).** "runtime bootstrap rotation drains safely..." and "rollback wins a race with replacement readiness..." used to fail: re-exchanging a source runtime's original bootstrap after `completeCoordinationRuntimeReplacement()` or `rollbackCoordinationRuntimeReplacement()` returned `invalid_bootstrap` instead of the expected `bootstrap_already_consumed`. Same single-slot `bootstrapHash` tombstone limitation already documented in `coordination-bootstrap-reissue-tombstone.md` for the `reissue` path, shown to also reach the rotation-complete/rollback revoke path. **Fixed Sep 24 2026 (task 1578):** `attemptGraceBootstrapReexchange` in `coordination-credential-broker.ts` now checks the tombstone match before checking whether grace re-issue is still applicable, so a since-retired/revoked registration reports `bootstrap_already_consumed` instead of `invalid_bootstrap`. Both tests pass; verified against a disposable Postgres (120/120 in the full suite) and confirmed present on `main-repl/main`. If this exact symptom resurfaces, it is a new regression, not this same pre-existing bug — do not cite this entry to excuse it.

**Scope note:** this test file is wired into `npm run test:coordination-ledger:run`, a separate DB-backed suite from `test-all-consolidated-ci.sh`'s groups.


## Also applies to: npm run test:coordination-ledger (merged topic)

Merged from the former standalone topic `coordination-ledger-preexisting-failures` — same
lesson (verify a pre-existing-failure claim against current HEAD before blaming your own diff)
applied to `npm run test:coordination-ledger` (`scripts/run-coordination-ledger-local.mjs`)
instead of `test-all-consolidated-ci.sh`. This suite spins up a disposable local Postgres and is
not part of `npm test`, `run-validation-suite.sh`, or `test-all-consolidated-ci.sh` — none of
those canonical steps touch the coordination-credential-broker/rotation/actor-client test files,
so a failure here is invisible to the standard validation/CI gate and must be checked by running
the disposable-DB harness directly.

### Known pre-existing failures (as of Sep 24 2026)

A clean checkout (confirmed via `git stash`) fails 7 of the ~100 tests in this suite, in two
unrelated clusters:

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

### Correction: also breaks the standard validation gate

The `test-coordination-actor-clients.test.ts` failures above are not confined to the optional
`test:coordination-ledger` harness. The same root cause (a bootstrap-token format/length guard
added in `coordination-actor-client.ts` requiring `COORDINATION_RUNTIME_BOOTSTRAP_TOKEN` to be
exactly 46 characters) also fails all 3 tests in
`server/scripts/test-coordination-cli-credential-persistence-e2e.test.ts` — and that file runs
inside the `Application test suite` step of `server/scripts/run-validation-suite.sh`, which IS
part of the standard `markTaskComplete` validation gate. So this bug currently fails standard
validation for every task, not just callers of the disposable-DB harness.

Confirmed pre-existing (not caused by task 1578's change) via `git worktree add --detach <path>
1dbdb97` (the commit immediately before task 1578's fix) and re-running the exact test file
there: identical 3/3 failures, same error text, on Sep 24 2026.

**Why:** `run-validation-suite.sh` failing is otherwise indistinguishable from a real regression
in `markTaskComplete`'s automatic validation; the next agent whose unrelated task trips this same
failure needs to know it's this known, already-tracked bug and cite `skip_validation_reason` with
proof, not chase a phantom regression in their own diff.

**How to apply:** if `run-validation-suite.sh` fails at
`test-coordination-cli-credential-persistence-e2e.test.ts` with a "must be exactly 46 characters"
error, this could be this same known bug — but verify on your own checkout first (see the later
corrections below: this has already been reported as both reproducing and non-reproducing
depending on exact commit).

### Correction: does not reproduce on main as of commit cbec01c

Both failure claims above were re-checked directly against `main` at commit
`cbec01c5f216c49026fc45c67e3ccc6d8d4921dd` and did not reproduce: both named test files' fixtures
(`fakeBootstrapToken()` and `VALID_BOOTSTRAP_TOKEN`) already generate/use 46-character tokens,
and the full `run-validation-suite.sh` (157/157 checks) passed clean on this commit.

**Why:** the original note was likely written against task 1578's own in-progress branch state,
not against `main`. The underlying guard is real, but both named fixtures already satisfied it on
`main`.

**How to apply:** don't cite this note's specific failure counts as a `skip_validation_reason`
without first re-running the named test file(s) yourself — if they pass, the bug isn't present in
your checkout and this note's claim is stale for your context.

### Re-confirmed still reproducing on this checkout — status is commit-dependent

Re-ran `npx tsx --test server/scripts/test-coordination-cli-credential-persistence-e2e.test.ts`
directly on a later checkout's own `HEAD` (commit `1d3505f`, branch `main`, tree otherwise clean)
on Sep 24 2026, after the "does not reproduce on `main`" correction above had already been
written. All 3 tests still failed with the identical "must be exactly 46 characters" error.

**Why:** this is not evidence that either earlier note was written carelessly — both cite
verifiable, checkable specifics (exact commit SHA, exact fixture output, exact pass counts). The
most consistent explanation is that "main" was a genuinely different tree at different points for
different sessions, not a single stable target.

**How to apply:** treat every claim in this topic (including this one) as scoped to the exact
commit it names, not as a durable fact about "main" in general. Before citing any of these as a
`skip_validation_reason`, always re-run the named test file(s) yourself on your own current
`HEAD` first and quote your own exact commit SHA and error text.

### Correction: a distinct, unrelated 8th failure — stale fixed-actor-list fixture (Sep 25 2026)

`server/middleware/coordination-auth.test.ts`'s "actor names cannot self-authorize by using a
luca prefix" test hardcodes the expected list of enumerated Luca actors, and does not include
`luca-antigravity` — a hat that `shared/schema.ts` and `server/middleware/coordination-auth.ts`
already define as a real, committed actor (added before this session started). This is a distinct
failure cluster from the two above (different file, different root cause: a stale hardcoded
expected-value list rather than a bootstrap-token format guard).

Confirmed unrelated to any in-session diff via `git status --short` (the only tracked change was
a single unrelated test file) and `git log`/`grep` showing `luca-antigravity` already committed
in `shared/schema.ts` and `coordination-auth.ts` ahead of this session.

**Why:** a fixed-enumeration test fixture goes stale exactly when a new actor/hat is legitimately
added elsewhere, the same shape of bug `trust-list-extension-on-rebase.md` documents for
production fail-closed guards — here it hits a test assertion instead.

**How to apply:** if this suite fails on `coordination-auth.test.ts`'s actor-enumeration test
with a `luca-antigravity` (or any other hat added after this note was written) diff, this is the
same known gap — the fixture's expected list needs updating to match the live actor registry, not
your own change.


### Correction: episode-sync flake reproduces reliably inside the full suite, and a distinct git-tracking hazard can compound it (Sep 25 2026)

Re-confirmed failure mode #1 (`test-rolling-sync-guard.ts` Pass 2/3, "DB stayed canonical but .md was not restored") on task 1592: it failed 3/3 times when `test-all-consolidated-ci.sh` ran as part of full `markTaskComplete` validation, but passed with 0 failures every time it was run standalone on the identical tree. Inside the full suite this is not a rare fluke — don't burn multiple `markTaskComplete` retries hoping it self-resolves; one standalone-pass confirmation is enough to call it pre-existing and move to `skip_validation_reason`.

Separately, this test's scratch fixture path (`docs/episode-99.md`) is disposable synthetic content but is NOT gitignored — if it is ever accidentally swept into a real commit by an unrelated change (confirmed: happened via a real feature commit whose author had this leftover fixture on disk at commit time), every later run's `cleanup()` unconditionally `unlinkSync`s it, and the next `server/scripts/detect-episode-dialogue-loss.ts` scan (part of `run-validation-suite.sh`) reports a false-positive content-loss finding for a real, git-tracked path disappearing.

**Why:** a test using a git-tracked path as disposable scratch space is incompatible with a git-history-based content-loss detector — the detector cannot distinguish "test cleanup deleted a file it doesn't own" from "real content vanished," and correctly treats any tracked file's disappearance as suspicious.

**How to apply:** if the dialogue-loss detector flags `docs/episode-99.md` specifically, verify its content is placeholder text (not real dialogue), then `git checkout <last-good-commit> -- docs/episode-99.md` to restore it — the detector explicitly treats content present again at the tip as "self-healed by a later commit; not blocking." This is a recurring risk, not a one-time fix: the path can be re-orphaned by the next `test-rolling-sync-guard.ts` run. A durable fix (gitignoring the path or having the test stop using a tracked path) is out of scope for a narrow task and belongs in a dedicated follow-up.

