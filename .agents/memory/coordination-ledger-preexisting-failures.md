## Known pre-existing failures

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


## Correction: also breaks the standard validation gate

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
bug and cite `skip_validation_reason` with proof, not chase a phantom regression in
their own diff.

**How to apply:** if `run-validation-suite.sh` fails at `[ci:test N/157] ... npx tsx
--test server/scripts/test-coordination-cli-credential-persistence-e2e.test.ts` with
a "must be exactly 46 characters" error, this could be this same known bug — but
verify on your own checkout first (see the later correction below: this has already
been reported as both reproducing and non-reproducing depending on exact commit).


## Correction: does not reproduce on main as of commit cbec01c

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


## Re-confirmed still reproducing on this checkout -- status is commit-dependent

Re-ran `npx tsx --test server/scripts/test-coordination-cli-credential-persistence-e2e.test.ts`
directly on this checkout's own `HEAD` (commit `1d3505f`, branch `main`, tree otherwise clean)
on Sep 24 2026, after the "does not reproduce on `main`" correction above had already been
written. All 3 tests still failed with the identical "must be exactly 46 characters" error the
very first note described — this checkout's `fakeBootstrapToken()`/`VALID_BOOTSTRAP_TOKEN`
fixtures do not yet generate 46-character tokens, contradicting the specific claim that commit
`cbec01c` already fixed them.

**Why:** this is not evidence that either earlier note was written carelessly — both cite
verifiable, checkable specifics (exact commit SHA, exact fixture output, exact pass counts).
The most consistent explanation is that this checkout's branch has not yet incorporated whatever
commit fixed the fixtures (this session separately hit a `TRANSIENT_FETCH` failure rebasing onto
the shared upstream around the same window), i.e. "main" was a genuinely different tree at
different points for different sessions, not a single stable target.

**How to apply:** treat every prior claim in this topic (including this one) as scoped to the
exact commit it names, not as a durable fact about "main" in general. Before citing this bug as
a `skip_validation_reason`, always re-run
`npx tsx --test server/scripts/test-coordination-cli-credential-persistence-e2e.test.ts` yourself
on your own current `HEAD` first. If it passes, this bug has been fixed upstream since and does
not apply to you — don't cite it. If it still fails, quote your own exact commit SHA and error
text rather than relying on any commit named in this file, since those may already be stale by
the time you read this.

