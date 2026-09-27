# Shared Agent Docs: DB-Canonical Storage for Multi-Hat Coordination

**Status:** Approved design pending written-spec review
**Owner:** Luca [Replit]
**Date:** 2026-09-21

## Problem

`.agents/memory/MEMORY.md` is edited directly as a git file by every hat
(Replit Agent, Claude Code, and any future hat) across every session. Git log
shows 88 commits in 60 days across 36+ separate sessions, and it has already
produced at least one real merge conflict requiring manual reconciliation.
Plain-file, whole-document git editing does not match this file's actual
access pattern: nearly every write is either "add one new bullet to the
index" or "add one new section to a topic file" — operations that are
conflict-free in principle but conflict-prone under whole-file git edits,
because two hats editing the same file in the same window can each start
from the same base revision.

`docs/shared-agent-instructions.md` and `docs/coordination-clients.md` are
lower-churn today (10 combined commits in 60 days, one merge conflict total)
but are in scope proactively: they are read by every hat as the canonical
source of shared behavior, so a bad silent edit there has a larger blast
radius than a memory-file conflict, even though it happens less often.

Separately: the repo's per-tool instruction-file layout has not kept pace
with how many tools now read a project's own convention file natively.
Verified via Anthropic's own changelog and docs during this design
conversation:

- Claude Code (`CLAUDE.md`) is the only major coding-agent CLI that does not
  read `AGENTS.md` by default when `CLAUDE.md` is present — it added a
  fallback (AGENTS.md read only when CLAUDE.md is absent) in version 2.1.277
  (September 2026), plus an older, version-independent `@path` import
  mechanism that works even where the fallback does not (Bedrock, Vertex,
  Foundry).
- `AGENTS.md` (OpenAI, August 2025) is natively read by Codex, Cursor,
  GitHub Copilot, and Google Antigravity (native since v1.20.3, March 2026).
- Gemini CLI defaults to `GEMINI.md` but can be configured to also recognize
  `AGENTS.md`.

Today this repo has only `CLAUDE.md` (Claude-Code-specific name) and no
`AGENTS.md`, so any of those other tools joining as a hat would see no
project instructions at all.

## Scope

In scope:

1. `.agents/memory/MEMORY.md` and every `.agents/memory/<topic>.md` file —
   become generated projections of new database tables.
2. `docs/shared-agent-instructions.md` and `docs/coordination-clients.md` —
   become ordinary `shared-spec` documents (`kind: architecture`), gaining a
   "live instruction document" direct-sync behavior on approval.
3. `CLAUDE.md` — shrinks to a single-line `@AGENTS.md` import.
4. `AGENTS.md` (new file) — holds the pointer content `CLAUDE.md` holds
   today (read `shared-agent-instructions.md` first, then `replit.md`),
   written as inline `@path` imports rather than plain markdown links.

Out of scope (unchanged):

- `replit.md` — read directly by the Replit platform from a fixed path;
  cannot be made DB-generated. Its existing pointer to
  `shared-agent-instructions.md` is untouched.
- Concurrent editing of application *code* — already handled by
  Gate3/coordination-v2/task-agent isolation; this design is about docs and
  memory only.
- Redesigning shared-spec's reviewer-assignment convention. The two
  instruction docs use whatever named-independent-reviewer process
  shared-spec documents already use today.
- `docs/claude-code-to-luca.md`, `docs/luca-to-claude-code.md`,
  `docs/alden-agent-handoff.md`, and other per-sender note channels — these
  are already append/reply logs with a different access pattern and are not
  touched by this design.

## Invariants

1. `.agents/memory/MEMORY.md` and its topic files are always a generated
   projection of database rows. No hat hand-edits these files directly.
2. Adding new content (a memory entry, a topic block) is always a
   conflict-free insert. Two hats acting in the same window never lose
   either one's contribution.
3. Editing existing content (a block's body, an entry's hook) requires the
   editor's known current version. An edit against a stale version is
   rejected and returns the current content — never silently overwritten.
4. `shared-agent-instructions.md` and `coordination-clients.md` still
   require an independent reviewer, distinct from the author, before an
   edit counts as decided — exactly like any other shared-spec architecture
   document today.
5. Every write path reports live, concrete evidence of other recent actors
   on the same file or topic — never only static boilerplate.
6. A fixed "you are not alone" preamble sits at the top of every file a new
   hat is guaranteed to read first (`shared-agent-instructions.md`) and at
   the top of the regenerated `MEMORY.md`.
7. `CLAUDE.md` contains only a single-line `@AGENTS.md` import — never a
   second copy of the pointer content that could drift from `AGENTS.md`.
8. `AGENTS.md` references `shared-agent-instructions.md` and `replit.md` as
   inline `@path` imports (Claude Code's nested-import support, confirmed up
   to four hops), not plain markdown links, so
   `CLAUDE.md → @AGENTS.md → @replit.md` / `@shared-agent-instructions.md`
   guarantees automatic inclusion for Claude Code — closing a gap that
   exists in the current CLAUDE.md, which links to `replit.md` rather than
   importing it. Other AGENTS.md-reading tools read the same line as a
   plain file reference and act on it the way any agentic coding tool
   already reads a referenced file.
9. A "live instruction document" approval commits the working-tree file
   directly, skipping the PR-publication step ordinary shared-spec documents
   use. It still relies on this project's existing commit/promotion pipeline
   to actually land the commit — it is not a new push mechanism.

## Architecture

### Data model (new — memory only)

Three tables. `shared-agent-instructions.md` and `coordination-clients.md`
need no new schema; they reuse the existing shared-spec document/revision/
review tables.

- **`agent_memory_topics`** — registry of topic files: `id`, `slug` (unique,
  matches the filename `.agents/memory/<slug>.md`), `created_at`. Exists so
  an entry or block can't reference a typo'd, orphaned slug.
- **`agent_memory_entries`** — one row per `MEMORY.md` index bullet: `id`,
  `topic_slug` (FK to `agent_memory_topics.slug`), `title`, `hook`,
  `created_by_actor`, `created_at`, `version`, `deleted_at`,
  `deleted_by_actor`. Rendered in `created_at` order (insertion order),
  matching how the index has grown organically so far. A new entry is a
  plain insert. An edit requires the caller's known `version` (optimistic
  concurrency, same shape as shared-spec's `409 CONFLICT`). Removal is a
  soft delete (`deleted_at` set, row excluded from rendering) so "why did
  this disappear" stays answerable later, matching the memory system's own
  "merge duplicates, delete stale notes" hygiene guidance.
- **`agent_memory_topic_blocks`** — one row per section within a topic file:
  `id`, `topic_slug` (FK), `order_key` (sortable text; a fresh append gets a
  key after the current max, an insert-between computes a key between two
  neighbors — no renumbering, no two concurrent appends ever need to agree
  on the same key), `heading` (nullable), `body_markdown`, `author_actor`,
  `version`, `created_at`, `updated_at`, `deleted_at`, `deleted_by_actor`. A
  topic file's rendered content is the concatenation of its non-deleted
  blocks in `order_key` order. A brand-new topic is created implicitly by
  inserting its first block against a fresh `topic_slug`.

### Write path

One new CLI, `server/scripts/agent-memory-cli.ts` (sibling to
`shared-spec-cli.ts` and `source-control-cli.ts`), is the only sanctioned
writer for memory entries and blocks:

- `add-entry --title --topic-slug --hook --actor`
- `add-block --topic-slug [--heading] --body-file --actor [--after <block-id>]`
- `edit-entry --entry-id --base-version --hook --actor`
- `edit-block --block-id --base-version --body-file --actor`
- `remove-entry --entry-id --actor` / `remove-block --block-id --actor`
  (soft delete)
- `regenerate --topic-slug|--all` — re-render file(s) from current DB state
  on demand (the recovery path for the "regeneration failure" case in Error
  Handling below)

`--actor` is a self-reported hat identity (`luca-replit`, `luca-claude-code`,
`luca-gemini`, `luca-holahola`, …), consistent with how the existing
canonical-conversation-exchange path already uses a caller-supplied
`--source` flag. This is cooperative infrastructure, not an access-control
boundary — whoever can run shell commands in the checkout already has
filesystem write access to these files; the point of the schema is
conflict-avoidance between cooperating hats, not permission enforcement.

Every successful write does two things synchronously, in order:

1. Regenerates the affected file(s) from current DB rows and writes them to
   disk (the same "DB write, read back, render file" shape already proven
   for episode projection).
2. Prints live evidence of recent concurrent activity, e.g.:

   ```
   Wrote block a7f3 to topic "chat-capture-pipeline".
   Note: 2 other actor(s) (luca-gemini, luca-claude-code) touched this
   topic in the last 24h.
   ```

   computed by querying for distinct `author_actor`/`created_by_actor`
   values on that topic (or entry) with a timestamp inside a rolling 24h
   window, excluding the calling actor.

`shared-agent-instructions.md` and `coordination-clients.md` keep using the
existing `shared-spec-cli.ts` (`revision`, `ready`, `claim`, `approve`) — no
new CLI surface for them. The only new behavior is described next.

### Live-instruction-document direct sync

Shared-spec's publication path today creates a GitHub PR rather than
touching the tracked working-tree file — correct for a spec meant for human
PR review, wrong for a file every hat treats as live operating truth on
every session start. This design adds a `liveInstructionDocument: true` flag
on a document (set for exactly these two documents), checked at `approve`
time:

- **Flag set:** on approval, the revision's markdown is written directly to
  the document's tracked path and committed to the working tree — the exact
  same commit step any other agent-authored file change already goes
  through (still subject to the existing task-ownership, dirty-tree, and
  promotion rules documented in `shared-agent-instructions.md`). No PR is
  opened. The change reaches other checkouts the same way any other
  agent-committed file already does today; this design does not add a new
  push or sync mechanism.
- **Flag unset (default):** unchanged — approval leaves the existing
  PR-based `publications` flow exactly as documented in the shared-spec
  skill, for ordinary design/architecture documents including this one.

### The "you are not alone" reminder

Two things, not one:

- **Static, fixed preamble** — a short paragraph at the very top of
  `shared-agent-instructions.md` (above "Runtime credentials") and at the
  top of the regenerated `MEMORY.md`, stating plainly that other hats may be
  active concurrently, that these files are generated, and that the CLI is
  the only sanctioned way to change them. Fixed text, not templated, so it
  reads identically regardless of which file a hat happens to open first.
- **Dynamic, evidence-based reminder** — the live "N other actor(s) touched
  this in the last 24h" line printed on every write (see Write Path above).
  This is deliberately not static boilerplate: it names real actors and a
  real recent window, so it can't be skimmed past as decoration the way a
  fixed warning can.

### File inventory after this change

`AGENTS.md`'s body states its two pointers as inline `@path` imports —
`@docs/shared-agent-instructions.md` and `@replit.md` — following Anthropic's
own documented inline-import style (e.g. "See `@README` for project
overview"). Claude Code resolves both transitively through its existing
`CLAUDE.md → @AGENTS.md` import (2 hops total, inside the documented 4-hop
limit), so its inclusion of `shared-agent-instructions.md` and `replit.md`
becomes automatic rather than dependent on the model choosing to follow a
link. Every other AGENTS.md-reading tool reads the identical line as a plain
file reference and acts on it as an ordinary next read, the same way it
already would for any other referenced file.

| File | Mechanism | Notes |
|---|---|---|
| `.agents/memory/MEMORY.md` | Generated from `agent_memory_entries` | Never hand-edited |
| `.agents/memory/<slug>.md` | Generated from `agent_memory_topic_blocks` | Never hand-edited |
| `docs/shared-agent-instructions.md` | shared-spec, `kind: architecture`, live-instruction-document | Reviewed; direct-sync on approval |
| `docs/coordination-clients.md` | shared-spec, `kind: architecture`, live-instruction-document | Reviewed; direct-sync on approval |
| `CLAUDE.md` | Plain git file, single line: `@AGENTS.md` | Static; not DB-generated |
| `AGENTS.md` (new) | Plain git file, pointer content | Static; not DB-generated; read natively by Codex, Cursor, Copilot, Antigravity, and Claude Code |
| `replit.md` | Unchanged | Read directly by the Replit platform from a fixed path |

## Migration / seeding (day one)

1. Create `agent_memory_topics` from the current `.agents/memory/*.md`
   filenames.
2. Parse the current `MEMORY.md` index lines into `agent_memory_entries`
   rows (one bullet = one row), preserving order as `created_at`.
3. Seed `agent_memory_topic_blocks` with **one block per existing topic
   file**, containing that file's entire current body verbatim. This keeps
   the migration itself simple and lossless; splitting a topic into finer
   blocks happens naturally later, only when someone actually appends a new
   section to it.
4. Create `shared-agent-instructions.md` and `coordination-clients.md` as
   new shared-spec documents with their current file content as revision 1,
   marked `liveInstructionDocument: true`. Revision 1 is auto-approved as a
   status-quo capture (no behavior change), so the review ceremony first
   applies starting with the next real edit.
5. Create `AGENTS.md` with the pointer content, writing the
   `shared-agent-instructions.md` and `replit.md` references as inline
   `@path` imports rather than plain markdown links. Replace `CLAUDE.md`'s
   body with the single line `@AGENTS.md` (kept under a short
   human-readable heading, matching Anthropic's own documented example
   format).

## Error handling

- **Stale-version edit** (`edit-entry`/`edit-block`): rejected, current
  content and version printed, non-zero exit, no partial write.
- **Regeneration failure after a successful DB write**: the CLI fails
  loudly (non-zero exit, explicit error) rather than leaving the DB and the
  file silently inconsistent. `regenerate` exists specifically to re-render
  any file from current DB state on demand as the recovery path.
- **Direct-sync commit failure** (e.g. dirty working tree) for a
  live-instruction document: the shared-spec approval itself still
  succeeds — the DB-level source of truth is not blocked by a filesystem
  problem — but the service reports the working-tree file as stale relative
  to the approved revision rather than silently claiming success. A
  `resync` operation forces the working-tree file back to the current
  approved revision on demand.
- **Out-of-band drift on a live-instruction document's path** (ordinary git
  commits landed on `gitPath` without going through the review ceremony,
  so the working tree no longer matches any revision shared-spec has
  recorded): `approve` and `resync` both refuse and report staleness
  instead of silently overwriting the drifted content — see the
  "Live-instruction-document drift" addendum below for the full incident,
  the guard's exact rule, and the recovery procedure.

## Testing

- Concurrent-write check: two actors (separate processes) call
  `add-entry`/`add-block` against the same topic at the same time; assert
  both rows exist in the DB and both appear in the regenerated file. Proves
  invariant 2 (no lost update).
- Stale-version guard check: attempt `edit-block` with an intentionally-old
  `--base-version`; assert non-zero exit and unchanged stored content.
  Proves invariant 3.
- Round-trip check: write via the CLI, read the generated file back, parse
  it, and diff against current DB rows — must match byte-for-byte for the
  managed sections.
- Live-instruction-document check: approving a revision on a document
  flagged `liveInstructionDocument: true` updates the tracked working-tree
  file and creates no PR; approving an ordinary (unflagged) document behaves
  exactly as today (PR, no direct working-tree write).
- Live-instruction-document drift check: approve rev1, commit an out-of-band
  git change to the same path outside shared-spec entirely, then approve
  rev2 (built on rev1) — assert the sync reports `state: "stale"` and the
  drifted content on disk is untouched; same assertion for `resync`. See the
  "Live-instruction-document drift" addendum below.
- All DB-writing tests run against a disposable Neon branch
  (`npm run db:branch`), never the shared dev/prod database, per this
  project's existing disposable-database testing convention. Wire new test
  scripts into consolidated CI through `run-ci-test-steps.mjs`'s splice
  list, not by hand-editing `test-all-consolidated-ci.sh` directly.

## Multi-hat coordination guarantees (traceability)

Mapping the firm requirement behind this design — full support for
concurrent multi-LLM editing, with unmissable, explicit reminders that no
new agent can skip — to the concrete mechanism that satisfies it:

| Requirement | Mechanism |
|---|---|
| Concurrent edits from different hats must not silently lose work | Per-row inserts for new content (append-only, no shared base to conflict on); optimistic-concurrency version check for edits (conflict is detected and surfaced, never silently overwritten) |
| Cross-cutting shared instructions need a second set of eyes | `shared-agent-instructions.md` / `coordination-clients.md` go through the existing shared-spec independent-review ceremony, unchanged |
| Reminder must be explicit and hard to miss | Fixed preamble at the top of the two guaranteed-read files (`shared-agent-instructions.md`, generated `MEMORY.md`) |
| Reminder must reflect real, current coordination state, not generic caution | Every write prints concrete, live evidence — which other actors, how many, how recently — not static text alone |
| The non-obvious required step (never hand-edit) must be stated where it will be read | Stated in the preamble itself and in `shared-agent-instructions.md`, the file every hat already reads first |

## Live-instruction-document drift (addendum, 2026-09-27)

Task 1612 found that the Day-One assumption in "Migration / seeding" step 4 —
"the review ceremony first applies starting with the next real edit" — did
not hold in practice for either live-instruction document. Recording what
happened, what changed, and what is and isn't guaranteed going forward.

**What happened.** Between the Sep 21 2026 seeding and Sep 27 2026, both
`docs/shared-agent-instructions.md` and `docs/coordination-clients.md`
continued to receive ordinary git commits — the same way any other file in
this repo changes — without ever going through
`shared-spec-cli.ts`'s `revision` / `ready` / `claim` / `approve` sequence.
`coordination-clients.md` alone took 11 such commits between Sep 21 and Sep
25. Because `approve` and `resync` only knew how to compare "the working-tree
file" against "the revision being approved," and had no way to notice that
the working tree had already moved past every revision shared-spec had ever
recorded, shared-spec's own idea of each document's "current" (approved)
revision fell arbitrarily far behind the real file. Nothing in the system
detected this: the two files kept working normally for every hat reading
them directly off disk, and the drift was only visible by directly querying
`shared_spec_documents` / `shared_spec_revisions` and diffing against git.

**Why this was dangerous.** Had anyone completed a legitimate
revision→ready→claim→approve cycle on either document — proposing a real,
independently-reviewed edit built on that stale approved base — approving it
would have committed that revision's content directly over the current file
(`GitWorkingTreeLiveSyncProvider`, per "Live-instruction-document direct
sync" above), silently discarding every ordinary commit made since the Sep
21 seed. No conflict, no warning: from shared-spec's point of view those
intervening commits never happened.

**Fix, part 1 — a standing safeguard.** `GitWorkingTreeLiveSyncProvider`
(`server/services/shared-spec-live-sync.ts`) now takes a
`knownRevisionContentHashes` list (every content hash shared-spec has ever
recorded for the document, from `core.listRevisions()`) alongside the
revision it's asked to sync. Before writing, it hashes whatever is currently
on disk at `gitPath`; if that hash isn't a member of the known set (and the
path isn't simply absent), it refuses with `{ state: "stale", reason: "..." }`
instead of overwriting — the same result shape already used for a dirty
working tree. Both call sites that can write a live-instruction document —
`approve` and the `/resync` route handler, in
`server/routes/shared-spec-routes.ts` — pass this list, so both are covered.
This is a standing, permanent guard: it runs on every future approve/resync,
not just once.

**Fix, part 2 — reconciling the actual drift.** A standing safeguard alone
would have left both documents permanently blocked: their recorded revisions
would never again match the real file, so every future legitimate approve or
resync would refuse forever. `server/scripts/reconcile-live-instruction-document-drift.ts`
closes that gap using the same status-quo-capture bypass
`seed-live-instruction-documents.ts` used on Day One — append a revision
holding the file's actual current content, then write an already-`approved`
review and flip the document to `approved` directly in one repository
transaction, never through a general "auto-approve" CLI/HTTP capability. It
is idempotent (a document whose current revision already matches its git
file is left untouched) and refuses to touch a document mid-review
(`ready_for_review` state). It was run against the real shared database on
2026-09-27: both documents' current revisions now match their git files
byte-for-byte, and both are in the `approved` state. **This is the recovery
procedure** if the safeguard above ever reports drift again on either
document: re-run this script (or a new one following the same pattern) to
re-capture current reality as a fresh approved revision before retrying the
review that was refused.

**Decision — the ceremony is not a hard gate on these two files.** Given
actual practice since Sep 21 has been plain git commits, not the
review ceremony, this design's implicit assumption that the ceremony would
be the normal way these files change is corrected here rather than left as a
silent inconsistency: the shared-spec review ceremony for
`shared-agent-instructions.md` and `coordination-clients.md` is available and
is the right tool when someone wants a deliberate, standalone documentation
change that specifically wants independent review — but it is not a
mandatory gate on every edit. Most edits to these files land as an incidental part of unrelated
application work (a task that changes coordination behavior and updates the
reference doc in the same commit), and requiring a separate cross-hat review
cycle for each of those would not match how this project's single-session
task-agent workflow actually operates. What *is* now guaranteed, regardless
of which path an edit takes, is invariant 3's spirit for these two files
specifically: an edit proposed through shared-spec can never silently
discard a plain git commit it didn't know about, because the safeguard above
refuses instead. Plain git commits remain free to keep happening exactly as
they have.
