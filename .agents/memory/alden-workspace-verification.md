---
name: Alden workspace verification
description: How to handle an Alden-side response that fails or claims edits without a trustworthy review.
---

An Alden priority-task response is not evidence that the workspace is unchanged
or that its claimed edits are correct. After any ambiguous, failed, or
incomplete Alden response, inspect `git status` and the actual diff before
preserving, replacing, or discarding changes.

**Why:** A failed response can still leave uncommitted workspace edits, and a
claimed policy update may be malformed or contradict an already confirmed
project rule.

**How to apply:** Treat the repository state as the source of truth. Restore a
known-good baseline first when a generated edit is malformed, then apply only
the intended narrow changes and validate them normally.