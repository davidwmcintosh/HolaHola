## Rule

This project's `tsconfig.json` excludes `**/*.test.ts` from the TypeScript program used by `npm run typecheck` / `tsc --noEmit`.

**Why:** a clean typecheck after editing a shared type (e.g. adding a required field to a credential or principal type) does not mean existing test fixtures were updated to match — an old test fixture missing the new required field compiles "clean" only because the compiler never looks at it, then fails (or silently exercises the wrong code path) only at runtime.

**How to apply:** after changing a shared type used by both production code and test fixtures, actually run the affected `*.test.ts` files (not just `tsc --noEmit`) to confirm fixtures were updated too. A clean typecheck is not proof that test files still compile correctly against a changed interface.

