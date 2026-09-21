---
name: Isolation-scope diffs need a pre-run baseline, not a clean-tree assumption
description: this repo has legitimate continuous background-worker writes to docs/*.md and docs/mailbox-ledgers/*.json; any script asserting "nothing else changed" must diff against a baseline snapshot taken at script start, not assert `git status --short` is empty.
---

# Isolation-scope diffs need a pre-run baseline

This repo has an always-on background process that periodically rewrites
docs/*.md and docs/mailbox-ledgers/*.json (commit messages like "Update
documentation and mailbox ledgers for communication exchange") as normal,
expected behavior — confirmed via `git log`, unrelated to any specific task.

Any script that needs to prove "only the files I intended changed" (a bounded
coding-runtime scope check, an isolation self-check, a CI guard) must snapshot
`git status --short` at the very start of the run and compute drift **beyond**
that baseline, not assert the working tree is or was clean. Asserting a
literal empty `git status --short` will false-positive on this repo's own
routine automation and misreport a scope violation that isn't one.

**Why:** hit directly while building the Gate 3 coding-runtime proof script
(2026-09-20) — an early version of the isolation check treated the
background writer's routine churn as a scope violation.

**How to apply:** any future "did anything unexpected change" check in this
repo needs a captured-at-start baseline diffed against the end state, never a
raw cleanliness assertion.
