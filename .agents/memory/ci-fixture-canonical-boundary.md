---
name: CI fixture canonical boundary
description: Rolling episode records must never serve as integration-test fixtures.
---

CI sentinels and synthetic dialogue are forbidden from the active rolling episode. A test that needs to exercise the DB-first episode path must create and clean up an isolated fixture record instead.

**Why:** Markdown-only test cleanup cannot repair a DB-first system: the canonical DB row retains the test text, and correct DB-to-Markdown replication makes the contamination reappear. “Safe to ignore” is not an acceptable record state.

**How to apply:** Keep a runtime refusal for CI sentinel payloads aimed at the current rolling target. Test fixture setup and teardown must operate on the DB row and its replica together, not trim Markdown after a live write. The trigger queue is also canonical in-flight state: tests must use an owned queue path for both writer and worker, and never clear the production queue.

## Beyond runtime sentinels: content-loss guards too

The same boundary applies beyond runtime sentinel-writing: any mechanism that treats `docs/episode-<N>.md` paths as canonical must also exclude the established CI-fixture number ranges, or it will flag a fixture's normal create/delete lifecycle as real content change. Confirmed 2026-09-22 against a new git-diff content-loss guard (blocked two consecutive, otherwise-unrelated merges over `docs/episode-9993.md`) — task agents run in isolated environments, so nothing forces a commit to wait for another repl's background test to finish cleaning up its fixture file before `git add -A` sweeps it in. Fix pattern: exclude by number range (9993-9999, plus a 90000-99999 random range), not by hardcoding individual filenames, since new fixtures keep appearing in that same reserved space across test files.


## Reconciling independently-invented fixture conventions

A codebase can accumulate more than one independently-invented fixture-numbering convention for the same guarded directory (e.g. a 9900+ range used by one set of tests, plus an older bare low number like `docs/episode-99.md` used by another) — each written without awareness of the others. A guard's exclusion list fixed against only the most recently discovered convention still leaves the older one live and able to block a future merge.

**How to apply:** Before treating a fixture-exclusion fix as complete, grep for every test that writes to a real (non-temp-dir, non-`tmpdir()`) path under the guarded directory — not just the one currently failing — since each may use its own numbering scheme. Also check for sibling guards over the same directory: an exclusion added to one guard does not automatically apply to another guard with its own independent fixture-detection logic: sync them explicitly (share the constant, don't just parallel-author it) so they cannot drift apart again. Finally, watch the guard's own self-check: if its hermetic scenarios happen to reuse the exact number/path being newly excluded as an arbitrary stand-in for "a protected file," they silently stop testing anything once that number is excluded — the self-check still exits green because fewer assertions are actually exercising real code, not because more are passing. Confirm the self-check's assertion count and content after any exclusion-list change, and move affected scenarios to a still-protected number rather than letting the fix narrow what the self-check covers.


## Exclusion blast radius reaches consumer tests, not just the guard's own self-check

The blast radius of a fixture-number exclusion is not limited to the guard's own file. A completely separate consumer test elsewhere in the codebase (e.g. a git-sync integration test asserting that real content loss on a "protected" path gets blocked) can independently reuse the same number as its own arbitrary "pretend this is real protected content" stand-in. Unlike a guard's own self-check silently losing coverage, this shape fails loudly (a real assertion error) once the number is excluded -- which is easier to catch but only if something actually exercises that test, and easy to misdiagnose as unrelated since the failing file has no import relationship to the file that changed.

**How to apply:** After adding a number to a fixture-exclusion list, grep the *entire* codebase (not just the guard's own module) for that literal number/path to find every other test treating it as a stand-in for protected content, not just the guard's own self-check scenarios.

