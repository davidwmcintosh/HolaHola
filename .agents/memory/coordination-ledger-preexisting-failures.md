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

