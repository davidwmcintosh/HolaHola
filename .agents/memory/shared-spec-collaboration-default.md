---
name: Shared-spec collaboration default
description: Records the agreed default surface and review boundary for documents created jointly by multiple agents.
---

Use the shared-spec workspace as the default collaboration surface for joint document creation. Keep the exact revision under review immutable, require the named independent actor to claim and decide it under that actor's own credential, and publish only an approved revision. Reviewer prose is not evidence of claim or decision; verify the canonical shared-spec state directly.

**Why:** David explicitly established this as the default beginning September 7, 2026. Git-first collaboration makes independent authorship and exact-revision approval easier to blur, while the shared-spec record preserves both. A reviewer can report approval after inspecting the wrong Git document or from a runtime that cannot make authenticated shared-spec calls; neither changes the canonical review.

**How to apply:** Start new jointly authored documents in shared-spec when the service is available. Do not impersonate a requested reviewer or silently fall back to Git-first review. After any claimed decision, read the document/review state from the service and verify the exact revision hash before export. GitHub is the publication destination after approval, not the collaboration authority.

## Fast-share notes (added Sep 21 2026, task 1511)

Shared-spec also has a second, lighter path: `kind: "note"` documents in a separate `notes/` namespace, shared via CLI `share`/`pull` with no `ready`/`claim`/`approve` ceremony and never GitHub-published. Purpose is real-time cross-hat visibility — "a hat needs another hat to see something now: a finding, a memory-file update, a scratch draft" — not a place to relocate durable content.

**Why:** it is pull-based (the recipient hat must explicitly call `pull`), unlike `.agents/memory/MEMORY.md`, which auto-loads as `<auto_memory>` context every session with no action needed. Moving durable, environment-specific procedural knowledge (e.g. how this Repl's own git-reconciliation scheduler works) into a note would make it *less* discoverable for a future session, not more — there is no cross-hat audience for content only this workspace's automation ever touches.

**How to apply:** use a fast-share note to announce "I'm about to edit MEMORY.md / here's a finding" to concurrently-running hats *before* committing a change to a widely-touched shared git file, so a concurrent session can fold in first instead of both sides committing blind and needing a manual git-merge afterward (this is what would have prevented needing the manual-reconciliation procedure in `reconciliation-git-procedure.md`). Do not use notes as a substitute home for content that belongs in a git-tracked, auto-loaded memory file or an actually-reviewed spec.

## Published files resist plain filesystem edits (observed Sep 17 2026)

## Published files resist plain filesystem edits (observed Sep 17 2026)

A plain `Edit` to an already-published file under `docs/superpowers/specs/`
(adding a short "superseded" note to the top of a design doc) reported
success, but the file on disk was back to a byte-exact match of the git
`HEAD` blob within a couple of minutes, with no edit visible in `git status`.
Other files edited in the same session, in other directories, stayed
modified -- this is specific to already-published shared-spec paths, not a
general workspace revert.

**Why:** the shared-spec skill (`.agents/skills/shared-spec/SKILL.md`)
governs `docs/superpowers/specs/...` as immutable, DB-tracked, independently
reviewed revisions (see `server/services/shared-spec-core.ts`,
`server/adapters/hola-hola-shared-spec-bootstrap.ts`, whose
`destinationPrefix` is exactly `docs/superpowers/specs/`). Something in the
running app reconciles the working-tree copy back to the approved/published
revision, which is the system correctly doing its job of protecting a
reviewed record from unreviewed drift -- not a bug to work around.

**How to apply:** never plan on a plain `Edit`/`WriteFile` sticking for a
file already under `docs/superpowers/specs/` (check `git log -- <path>` for
a prior "docs: ..." publish commit as a signal). To actually change one,
either go through the shared-spec CLI lifecycle (new revision -> independent
review -> approve -> re-publish) or, if the change is just a note that a doc
is stale/superseded, say so directly to the user in chat instead of trying
to bolt it onto the immutable record.

