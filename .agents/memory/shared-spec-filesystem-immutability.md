---
name: shared-spec files resist plain filesystem edits
description: docs/superpowers/specs/*.md files that have already gone through the shared-spec create→review→approve→publish lifecycle get silently reverted if you edit them with a plain file write.
---

# shared-spec files resist plain filesystem edits

Observed directly (Sep 17 2026): a plain `Edit` to an already-published file
under `docs/superpowers/specs/` (adding a short "superseded" note to the top
of a design doc) reported success, but the file on disk was back to a
byte-exact match of the git `HEAD` blob within a couple of minutes, with no
edit visible in `git status`. Other files edited in the same session, in
other directories, stayed modified — this is specific to already-published
shared-spec paths, not a general workspace revert.

**Why:** the shared-spec skill (`.agents/skills/shared-spec/SKILL.md`)
governs `docs/superpowers/specs/...` as immutable, DB-tracked, independently
reviewed revisions (see `server/services/shared-spec-core.ts`,
`server/adapters/hola-hola-shared-spec-bootstrap.ts`, whose
`destinationPrefix` is exactly `docs/superpowers/specs/`). Something in the
running app reconciles the working-tree copy back to the approved/published
revision, which is the system correctly doing its job of protecting a
reviewed record from unreviewed drift — not a bug to work around.

**How to apply:** never plan on a plain `Edit`/`WriteFile` sticking for a
file already under `docs/superpowers/specs/` (check `git log -- <path>` for
a prior "docs: ..." publish commit as a signal). To actually change one,
either go through the shared-spec CLI lifecycle (new revision → independent
review → approve → re-publish) or, if the change is just a note that a doc
is stale/superseded, say so directly to the user in chat instead of trying
to bolt it onto the immutable record.
