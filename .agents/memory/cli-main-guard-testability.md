---
name: CLI script main-guard for testability
description: an unguarded top-level CLI entrypoint call breaks import-based unit testing of the same file
---

Rule: any script that is both a CLI entrypoint (`main().catch(...)` invoked unconditionally at the bottom of the file) and an importable module (because a test file imports its exported functions) must guard the CLI dispatch behind an entrypoint check, e.g. `if (basename(process.argv[1] ?? '') === '<script-name>.ts') { main().catch(...) }`.

**Why:** `node --test` (or any test runner) imports the file to reach its exports, but that import also executes top-level code. An unconditional `main()` call then parses the *test runner's own* argv as if it were the script's CLI subcommand, falls into the `default:`/usage branch, and sets `process.exitCode = 1`. That persists to real process exit even though every individual test assertion reported "ok" — the failure only shows up as a confusing file-level "not ok" / exit 1 with a clean subtest list above it.

**How to apply:** before assuming a genuine bug when a `node --test` run shows all subtests passing but the file/process still exits non-zero, check whether the source file has an unconditional bottom-of-file `main().catch(...)`. Add the entrypoint guard with `node:path`'s `basename` if it's missing, matching whichever sibling script in the same codebase already has it right.
