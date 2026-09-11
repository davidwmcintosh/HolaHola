---
name: GitHub workflow dispatch source
description: Why a workflow repair must already be on default main before workflow_dispatch can use it.
---

GitHub `workflow_dispatch` resolves the workflow definition from the
repository's default branch. A corrected workflow file that exists only on the
candidate branch cannot repair or unblock dispatch of that same workflow.

**Why:** A protected-promotion workflow repair on a feature branch was
invisible to `workflow_dispatch`; dispatch continued to use the older
definition on `main`.

**How to apply:** When a dispatch workflow itself is broken, land the workflow
repair on default `main` through an already-working approved path first. Only
then dispatch candidate-branch work that depends on the repaired definition.