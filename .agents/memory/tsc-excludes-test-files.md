## Rule

This project's `tsconfig.json` excludes `**/*.test.ts` from the TypeScript program used by `npm run typecheck` / `tsc --noEmit`.

**Why:** a clean typecheck after editing a shared type (e.g. adding a required field to a credential or principal type) does not mean existing test fixtures were updated to match — an old test fixture missing the new required field compiles "clean" only because the compiler never looks at it, then fails (or silently exercises the wrong code path) only at runtime.

**How to apply:** after changing a shared type used by both production code and test fixtures, actually run the affected `*.test.ts` files (not just `tsc --noEmit`) to confirm fixtures were updated too. A clean typecheck is not proof that test files still compile correctly against a changed interface.


## Sharpest case: a rebase can hide this inside one shared test file

## Sharpest case: a rebase can hide this inside one shared test file

If your change alters a function's return contract (e.g. throw-on-failure becomes
a discriminated-union return) and you rebase onto a branch that concurrently added
new test cases to the *same* shared test file, git's line-based merge can combine
both edits with zero conflict markers when the new cases sit in a different region
of the file than your own edits. A clean, conflict-free rebase proves nothing here:
the newly-added cases were written against the old contract and are now wrong, and
nothing in the rebase mechanics flags it — it compiles clean (tsc skips test files,
per the rule above) and only fails at actual test-run time, sometimes several
assertions in if the wrong one only trips under a specific code path.

**How to apply:** after any rebase that resolves without conflicts in a shared test
file, and especially when your own change altered a function's return contract,
grep that whole file (not just your diff) for other call sites using the old
contract shape before trusting a clean rebase. Run the full test file, not just a
mutation/self-check subset of it — a partial run can pass while a
not-yet-exercised assertion downstream is still wrong.

