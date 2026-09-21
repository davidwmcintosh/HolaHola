# Shared Agent Docs: DB-Canonical Storage Implementation Plan

**Design:** `docs/superpowers/specs/2026-09-21-shared-docs-db-canonical-design.md`
**Scope:** Move `.agents/memory/` to DB-generated files; make the two shared
instruction docs live-sync shared-spec documents; add `AGENTS.md`; shrink
`CLAUDE.md`.
**Rule:** Complete and verify each phase before beginning the next.

## Constraints (carried over from the design's invariants)

- No write path may silently drop a concurrent writer's row. New content is
  always an insert.
- Every edit to existing content is an explicit compare-and-swap against a
  caller-supplied version — never last-write-wins.
- `shared-agent-instructions.md` and `coordination-clients.md` require an
  independent reviewer for every revision *after* the migration's revision 1.
  Auto-approval is a one-time migration action, never a general shared-spec
  capability.
- The live-instruction-document commit step stages and commits only its own
  single target path — never a blanket `git add -A`.
- `CLAUDE.md` must never regain a second copy of the pointer content.
- Once Phase 4 lands, nobody hand-edits `MEMORY.md` or a topic file again —
  `agent-memory-cli.ts` is the only writer.

## Phase 1 — Database schema

### Goal

Create `agent_memory_topics`, `agent_memory_entries`, and
`agent_memory_topic_blocks` exactly as specified, provable on a disposable
branch before touching shared Neon.

### Files

- `shared/schema.ts`
- generated `migrations/*.sql` + `migrations/meta/*`
- new focused schema test under `server/scripts/`

### Steps

1. Add `agent_memory_topics`: `id`, `slug` (unique), `created_at`.
2. Add `agent_memory_entries`: `id`, `topic_slug` (FK → `agent_memory_topics.slug`),
   `title`, `hook`, `created_by_actor`, `created_at`, `version`, `deleted_at`,
   `deleted_by_actor`.
3. Add `agent_memory_topic_blocks`: `id`, `topic_slug` (FK), `order_key`
   (sortable text), `heading` (nullable), `body_markdown`, `author_actor`,
   `version`, `created_at`, `updated_at`, `deleted_at`, `deleted_by_actor`.
4. Generate the migration with `npx drizzle-kit generate`; review the SQL —
   it must contain only these three new tables and their FK/uniqueness
   constraints, no unrelated DDL.
5. Prove it with `npm run db:branch -- gate` before it ever touches shared
   Neon; apply with `npx drizzle-kit migrate` only after the gate reports
   `READY_TO_PROMOTE`.

### Verification

- Fresh database applies the migration; existing database migrates without
  touching unrelated tables.
- A row referencing a nonexistent `topic_slug` is rejected at the DB level.
- `npm run typecheck`.

## Phase 2 — Core memory service

### Goal

A portable service holding all read/write/render logic, with no CLI or HTTP
surface yet.

### Files

- new `server/services/agent-memory-core.ts`
- new focused service tests

### Steps

1. Topic resolution: inserting a block against an unknown `topic_slug`
   creates the topic implicitly (first-block-creates-topic, per design).
2. `addEntry` — plain insert, `version = 1`.
3. `addBlock` — compute `order_key`: appending gets a key sorting after the
   current max; inserting after a given block computes a lexicographic
   midpoint key between two neighbors. No existing row's `order_key` is ever
   rewritten by another insert.
4. `editEntry` / `editBlock` — reuse the exact compare-and-swap technique
   already proven in `shared-spec-core.ts`'s revision-append path: update
   constrained by the caller's expected current `version`; zero updated rows
   means conflict — return current content + version, do not overwrite.
5. `removeEntry` / `removeBlock` — soft delete (`deleted_at`,
   `deleted_by_actor`); excluded from rendering, not from the table.
6. Render `MEMORY.md`: fixed "you are not alone" preamble paragraph, then
   non-deleted entries in `created_at` order, one bullet each.
7. Render `<slug>.md`: non-deleted blocks in `order_key` order, concatenated
   (heading + body where a heading exists).
8. Recent-activity evidence query: distinct `author_actor`/`created_by_actor`
   values on the same topic or entry within a rolling 24h window, excluding
   the calling actor.
9. Every write does, synchronously and in order: (a) the DB write, (b)
   regenerate and write the affected file(s) to disk, (c) return the evidence
   from step 8 for the caller to print. A failure at (b) after a successful
   (a) must throw loudly — never leave DB and file silently inconsistent.

### Verification

- Two CAS edits against the same stale version: one succeeds, one returns
  conflict with unchanged stored content.
- Inserting between two blocks produces a key strictly between its
  neighbors' keys; neither neighbor's key changes.
- Soft-deleted rows never appear in rendered output but remain queryable.
- Forcing a render failure after a successful insert throws rather than
  returning success.

## Phase 3 — `agent-memory-cli.ts`

### Goal

The one sanctioned writer surface, sibling to `shared-spec-cli.ts` and
`source-control-cli.ts`.

### Files

- new `server/scripts/agent-memory-cli.ts`

### Steps

1. Implement `add-entry`, `add-block`, `edit-entry`, `edit-block`,
   `remove-entry`, `remove-block`, and `regenerate --topic-slug|--all`
   exactly as named in the design.
2. `--actor` is a required, self-reported hat identity (`luca-replit`,
   `luca-claude-code`, `luca-gemini`, `luca-holahola`, …), matching the
   existing `--source` convention on the canonical-conversation-exchange
   path.
3. On success, print the regenerated file path(s) and the live evidence line
   ("N other actor(s) … touched this in the last 24h") from Phase 2 step 8 —
   never only static text.
4. On a stale-version rejection or a regeneration failure, exit non-zero
   with the current content/version (for staleness) or the explicit error
   (for regeneration) — no partial, silently-successful exit.

### Verification

- Each subcommand round-trips against a disposable database.
- `regenerate --all` reproduces every current file from DB state alone.

## Phase 4 — Day-one migration and seeding

### Goal

Move today's `.agents/memory/*.md` content into the new tables losslessly,
proving it on a disposable branch first.

### Files

- new one-off `server/scripts/migrate-agent-memory-to-db.ts`

### Steps

1. Parse `MEMORY.md`'s index bullets (`- [Title](topic.md) — hook`) into
   `agent_memory_entries` rows, one per bullet, preserving file order as
   insertion order (so `created_at` ordering matches today's index order).
2. For each referenced `.agents/memory/<slug>.md`, create the topic (if not
   already created by step 1) and insert **one block** containing that
   file's entire current body verbatim — no re-splitting into finer blocks
   at migration time.
3. Run the migration against a disposable Neon branch first; regenerate the
   files from the freshly-seeded DB and diff against the pre-migration git
   versions — the only allowed difference is the new preamble. Any content
   loss or reordering fails this step.
4. Only after that diff is clean, run the migration for real against shared
   Neon, regenerate the real files, and commit them as the migration's
   landing commit.

### Verification

- Post-migration `git diff` on `MEMORY.md` and every topic file shows only
  the added preamble — no bullet or topic-file body is lost, reordered, or
  altered.

## Phase 5 — Live-instruction-document direct sync

### Goal

Add the `liveInstructionDocument` flag and its approve-time behavior without
adding a second push mechanism or risking a repo-wide dirty-tree block.

### Files

- `shared/schema.ts` (new `liveInstructionDocument` boolean column, default
  `false`, on the shared-spec document table)
- new `server/services/shared-spec-live-sync.ts` (keeps `shared-spec-core.ts`
  free of direct git/filesystem side effects, matching the existing
  core-vs-adapter split used for notifications and publication)
- `server/services/shared-spec-core.ts` (call the new adapter from `approve`)
- `server/scripts/shared-spec-cli.ts` (new `--live-instruction-document` flag
  on `create`, and a new `resync` command)

### Steps

1. Migration for the new column; default `false` so every existing document
   is unaffected.
2. In `approve`, after the existing DB-level approval transition, if the
   document's `liveInstructionDocument` is `true`: write the approved
   revision's exact markdown bytes to the document's tracked path, then run
   `git add <path>` and `git commit -m "shared-spec: approve <title> rev
   <n>"` scoped to that single path only — never `git add -A`. A pathspec
   commit succeeds regardless of unrelated dirty files elsewhere in the
   tree; it does not depend on or trigger the separate GitHub-push
   scheduler's whole-tree-clean requirement.
3. Recompute the written file's hash and compare against the approved
   revision's hash before reporting success.
4. If the commit step fails (the target path itself is already
   uncommitted-dirty from an unrelated hand edit, most likely), the shared-
   spec approval still stands at the DB level — do not roll it back — but
   the document's working-tree sync status is reported as stale, with the
   failure logged explicitly.
5. Add `resync --id <document-id>`: re-reads the current approved revision,
   re-writes the tracked file, and re-attempts the same isolated commit.
   Idempotent — safe to run whether or not the previous attempt partially
   succeeded.
6. `create --live-instruction-document` sets the flag at document creation
   only; there is no path to flip it on an existing ordinary document as
   part of this phase.

### Verification

- Approving a flagged document updates the tracked file and creates no PR.
- Approving an unflagged document is byte-for-byte unchanged from today
  (PR-based `publications` flow, no direct working-tree write).
- A forced commit failure (dirty target file) leaves the DB approval intact
  and reports staleness rather than silently claiming a synced state.
- `resync` recovers a deliberately-desynced working-tree file to match the
  current approved revision.

### Status: complete

Implemented as designed, with one file-placement deviation and two bugs
caught by the phase's own tests before landing:

- Deviation: the sync call in step 2 is made from `shared-spec-routes.ts`
  (the `approve` route handler, plus the new `resync` route), not from
  `shared-spec-core.ts`. Core stays free of any Git/filesystem adapter,
  matching how `SpecPublicationProvider` is already kept out of core.
- Bug found and fixed: `git commit -m ... -- <path>` alone fails with
  "pathspec did not match any file(s) known to git" the first time a given
  path is ever synced. Step 2's `git add <path>` is required, not optional —
  see `.agents/memory/git-pathspec-commit-needs-add.md`.
- Bug found and fixed: `SharedSpecCore.shareDocument()`'s document literal
  didn't set `liveInstructionDocument`, caught by `npm run typecheck` once
  the field became required. Fast-share notes are hardcoded to
  `liveInstructionDocument: false` — they never go through review/approval.

Landed in commit `6510fa6`.

## Phase 6 — Onboard the two instruction documents

### Goal

`shared-agent-instructions.md` and `coordination-clients.md` become
shared-spec documents without a behavior change on day one.

### Files

- one-off use of `shared-spec-cli.ts create` (no new source beyond Phase 5's
  `--live-instruction-document` flag)

### Steps

1. Prepend the fixed "you are not alone" preamble to
   `shared-agent-instructions.md`'s content, above "Runtime credentials".
2. Create both documents (`kind: architecture`,
   `--live-instruction-document`) with that content (current content for
   `coordination-clients.md`, preamble-prepended content for
   `shared-agent-instructions.md`) as revision 1.
3. Mark revision 1 approved directly via a one-off migration script/SQL
   action — not by adding a general "skip review" capability to
   `shared-spec-core.ts` or the CLI. This is a one-time status-quo capture;
   every revision after it goes through the normal independent-reviewer
   ceremony.

### Verification

- Both documents exist in shared-spec with an approved revision 1 whose
  content matches (plus the preamble) what was already tracked in git.
- Attempting a second revision without a distinct reviewer still fails,
  proving the ceremony wasn't accidentally weakened.

### Status: complete

Implemented as designed, with two real deviations from the plan's stated
assumptions and one bug caught before it reached the shared database:

- Deviation: the plan assumed "no new source beyond Phase 5's
  `--live-instruction-document` flag," but `canonicalSpecPathPattern`
  rejected both `docs/shared-agent-instructions.md` and
  `docs/coordination-clients.md` outright — only
  `docs/superpowers/specs/*.md` was ever a valid `createDocument` path for a
  non-note document. Fixed with an exact-path allowlist
  (`liveInstructionDocumentPaths` in `shared-spec-core.ts`), gated on
  `liveInstructionDocument: true`, not a `docs/**` wildcard — an ordinary
  architecture document still needs the specs/ namespace. Covered by three
  new tests in `shared-spec-core.test.ts`.
- Deviation: a live-instruction document's stored `repository` must match
  `SHARED_SPEC_GITHUB_REPOSITORY` exactly, or `GitWorkingTreeLiveSyncProvider`
  refuses to ever sync it (its `expectedRepository` cross-check, added in
  Phase 5). Both documents were created with `davidwmcintosh/HolaHola` for
  this reason, not the `HolaHola-Development/HolaHola` value used by two
  newer non-live-instruction documents already in shared-spec.
- Bug found and fixed before landing: the one-off seeding script's first run
  reused one literal idempotency key across both documents'
  `createDocument()` calls. Idempotency scope is `(operation, actorId, key)`
  only — it does not include a request digest until *after* a collision is
  detected — so the second, differently-shaped request on the same key
  surfaced as "Idempotency key was reused with a different request" instead
  of creating a second document. Fixed by deriving the key from `gitPath`.
  The first document had already committed successfully by that point; the
  script's own SKIP-if-`findByDestination`-finds-one guard made the second
  run pick up cleanly instead of double-creating it. See
  `.agents/memory/idempotency-key-scope-granularity.md`.
- Revision 1's approval was written directly via a one-off script
  (`server/scripts/seed-live-instruction-documents.ts`, kept permanently as
  a historical record, safe to re-run) that calls the real
  `SharedSpecCore.createDocument()` for document + revision 1, then opens
  its own repository transaction to insert one `shared_spec_reviews` row
  (`state: 'approved'`, all `decisionPolicy*` snapshot fields left `NULL` —
  the valid branch of that table's check constraint — since no real
  reviewer-policy evaluation occurred) and flip the document to `approved`.
  `markRevisionReady`/`claimReview`/`decideReview` and the CLI were not
  touched.
- Verified: a script run against the live shared database confirmed both
  documents' current revision is `approved`, has a matching approved review,
  and `exportApprovedBytes()` returns bytes byte-for-byte identical to the
  git-tracked file (preamble included for `shared-agent-instructions.md`).
  The "second revision without a distinct reviewer still fails" property was
  *not* re-tested live against these two freshly-seeded documents — doing so
  would have left a permanent extra draft revision and an orphaned pending
  review on production rows to prove something that is entirely
  repository-agnostic business logic inside `SharedSpecCore` (identical
  whether backed by Postgres or the in-memory test double). It is proven
  instead by the untouched `markRevisionReady`/`claimReview`/`decideReview`
  code plus the pre-existing passing test "authors cannot claim or approve
  their own revision."

Landed in commit `2c6e125`.

## Phase 7 — `AGENTS.md` and `CLAUDE.md`

### Goal

Close the missing-AGENTS.md gap and make Claude Code's inclusion of
`replit.md` and `shared-agent-instructions.md` automatic.

### Files

- new `AGENTS.md`
- `CLAUDE.md`

### Steps

1. Write `AGENTS.md` with both pointers as inline `@path` imports, e.g.
   "Read @docs/shared-agent-instructions.md first — the durable source for
   cross-interface agent behavior. Then read @replit.md for this project's
   architecture, operating commands, and safety constraints." — natural
   prose that is simultaneously a valid Claude Code import.
2. Replace `CLAUDE.md`'s body with a short heading and the single line
   `@AGENTS.md`.

### Verification

- `AGENTS.md` and `CLAUDE.md` contain no duplicated pointer content between
  them.
- Byte-level check only — actual import resolution can only be confirmed by
  a real Claude Code session on its next run; note this limit rather than
  claiming a verification this plan can't perform.

## Phase 8 — Testing, CI wiring, final verification

### Files

- new `server/scripts/test-agent-memory-*-postgres.test.ts` files (concurrent
  write, stale-version guard, round-trip, live-instruction-document sync)
- `scripts/run-ci-test-steps.mjs` (splice list)
- `server/scripts/run-validation-suite.sh` (matching named `run_check` lines)
- `scripts/neon-branch.ts` (`REQUIRE_DATABASE_TESTS` allowlist)

### Steps

1. Concurrent-write test: two processes call `add-entry`/`add-block` against
   the same topic at the same time; assert both rows exist and both appear
   in the regenerated file.
2. Stale-version guard test: `edit-block` with an intentionally-old
   `--base-version`; assert non-zero exit and unchanged stored content.
3. Round-trip test: CLI write → read generated file → parse → diff against
   DB rows, byte-for-byte for managed sections.
4. Live-instruction-document test: approving a flagged document updates the
   tracked file and creates no PR; approving an unflagged one is unchanged.
5. Wire every new DB-backed test file into `run-ci-test-steps.mjs`'s splice
   list (real CI coverage), add matching named checks to
   `run-validation-suite.sh` (per-check visibility), and add them to
   `neon-branch.ts`'s `REQUIRE_DATABASE_TESTS` allowlist (disposable-branch
   gate coverage) — three separate registrations, per this project's own
   CI-wiring convention.
6. Run `npm run typecheck` and `npx tsx server/scripts/verify-system-health.ts`.
   Restart the app workflow once and inspect logs if any touched file
   (`shared-spec-core.ts` especially) is part of the normal server boot
   path.
7. Re-run the existing shared-spec test suite in full — Phase 5 edits a
   shared, critical file; confirm no regression in the ordinary
   (non-live-instruction-document) approval/publication path.
8. Obtain Alden's unconditional final review of the actual schema,
   migration, service, CLI, and test diffs before considering this done.

### Verification

- No new test or typecheck failure; existing shared-spec tests still pass.
- System health reports zero red failures.
- Alden reports no remaining required change.
