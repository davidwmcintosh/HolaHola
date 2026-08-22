---
name: GitHub CI aggregate protection
description: GitHub branch protection relies on the aggregate GitHub Actions check, not parallel internal job names.
---

Protect `main` with the single GitHub Actions check named `test` (displayed in
GitHub as `CI / test`), and do not add the individual parallel test-job names
as required checks.

**Why:** The aggregate job is the branch-protection contract. It depends on
every named test group and fails when any group fails, while requiring the
internal names separately makes future parallelization or job renaming brittle.

**How to apply:** Keep the aggregate job `if: always()` with every test group
in `needs`, and make its result fail closed for any non-success dependency.
When changing workflow job names, preserve the protected `test` context
attached to the GitHub Actions app.