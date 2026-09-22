---
name: CI fixture canonical boundary
description: Rolling episode records must never serve as integration-test fixtures.
---

CI sentinels and synthetic dialogue are forbidden from the active rolling episode. A test that needs to exercise the DB-first episode path must create and clean up an isolated fixture record instead.

**Why:** Markdown-only test cleanup cannot repair a DB-first system: the canonical DB row retains the test text, and correct DB-to-Markdown replication makes the contamination reappear. “Safe to ignore” is not an acceptable record state.

**How to apply:** Keep a runtime refusal for CI sentinel payloads aimed at the current rolling target. Test fixture setup and teardown must operate on the DB row and its replica together, not trim Markdown after a live write. The trigger queue is also canonical in-flight state: tests must use an owned queue path for both writer and worker, and never clear the production queue.

## Beyond runtime sentinels: content-loss guards too

The same boundary applies beyond runtime sentinel-writing: any mechanism that treats `docs/episode-<N>.md` paths as canonical must also exclude the established CI-fixture number ranges, or it will flag a fixture's normal create/delete lifecycle as real content change. Confirmed 2026-09-22 against a new git-diff content-loss guard (blocked two consecutive, otherwise-unrelated merges over `docs/episode-9993.md`) — task agents run in isolated environments, so nothing forces a commit to wait for another repl's background test to finish cleaning up its fixture file before `git add -A` sweeps it in. Fix pattern: exclude by number range (9993-9999, plus a 90000-99999 random range), not by hardcoding individual filenames, since new fixtures keep appearing in that same reserved space across test files.

