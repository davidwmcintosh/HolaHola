---
name: CI fixture canonical boundary
description: Rolling episode records must never serve as integration-test fixtures.
---

CI sentinels and synthetic dialogue are forbidden from the active rolling episode. A test that needs to exercise the DB-first episode path must create and clean up an isolated fixture record instead.

**Why:** Markdown-only test cleanup cannot repair a DB-first system: the canonical DB row retains the test text, and correct DB-to-Markdown replication makes the contamination reappear. “Safe to ignore” is not an acceptable record state.

**How to apply:** Keep a runtime refusal for CI sentinel payloads aimed at the current rolling target. Test fixture setup and teardown must operate on the DB row and its replica together, not trim Markdown after a live write. The trigger queue is also canonical in-flight state: tests must use an owned queue path for both writer and worker, and never clear the production queue.