# Advisory Procedural Memory (`procedure_knowledge`) Design

**Date:** September 6, 2026
**Status:** Draft design — retrieval/authority contract first, schema follows approval
**Participants:** David + Luca [Claude Code], directed to Luca [Replit] for review
**Origin:** David's proposal that agent pipeline/procedure knowledge should be discoverable by asking, not by already knowing which `.md` file to open. Ledger thread `f457602c-2cbd-4344-8357-f291023f06f8`.

## Purpose

Today, an agent working in this codebase can only discover *how the pipeline works* by already
knowing which file to open — `CLAUDE.md` → `docs/shared-agent-instructions.md` → `replit.md` →
`docs/agent-workflows.md` → the right `.agents/skills/*/SKILL.md`. That chain is real and durable,
but it is a lookup, not memory: an agent with less accumulated context, or one that starts mid-task
without walking the full chain, has no path to it except reading the right file at the right time.

`operation_skill` already proves the discoverability half of this works — semantic search over a
pinned embedding pool, reached via `GET /api/coordination/operations`. But it is deliberately narrow:
it only helps *find* a privileged, code-defined operation, and its own source comment states the
static catalogue remains the sole authority for what that operation actually does. It was never meant
to carry general procedural knowledge, and must not be stretched to.

This design adds the missing layer: **advisory procedural knowledge** — freely writable as ordinary
memory, provenance-bearing, semantically discoverable, and explicitly non-executable. It exists
alongside `operation_skill`, not instead of it, and must never weaken that boundary.

## Governing invariants

1. The coordination ledger remains the authenticated lifecycle/provenance channel for tracked work.
   It is not a knowledge index. Ledger events are never auto-promoted into `procedure_knowledge`.
2. The operations catalogue remains the sole authority for operation identity, canonical executor,
   actor scope, confirmation requirement, caveats, and side effects. `procedure_knowledge` entries
   must never create, imply, or override any of those fields, and must never grant execution
   authority to whoever retrieves them.
3. Skills and canonical docs remain authoritative wherever they currently define a procedure.
   `procedure_knowledge` is a discoverability index over those truths plus reviewed procedural notes
   — not a second, competing authoring system.
4. A retrieval result is advisory: it must point the requesting agent back to the canonical source
   (file, skill, spec, or operation ID) and explain why it matched. It must never present itself as
   an instruction with higher authority than that source.
5. `tutor_procedures` belongs to Daniela's pedagogical subsystem and is not repurposed as a general
   agent knowledge sink. `editor_insights` is the closest existing writable source but has no
   embedding/index synchronization today — this design does not casually promote all of it into
   global recall.
6. Nothing here is a prerequisite for coordination or for privileged-operation execution; both
   continue to function exactly as they do today if this layer is absent, stale, or unindexed.

## Non-goals

1. Replacing any existing skill, doc, or the operations catalogue as the source of truth.
2. Making the coordination ledger a queryable knowledge base.
3. Auto-embedding raw `editor_insights` rows, coordination events, or Team Room messages without an
   explicit, reviewed promotion step.
4. Granting any actor new execution authority through a search result.
5. A general-purpose notes/wiki feature for arbitrary content — scope is pipeline/procedure
   knowledge specifically (how to use the coordination system, skills, capture pipeline, promotion
   gates, actor credentials, and similar cross-cutting mechanics).

## Data model

New global memory type: `procedure_knowledge`, stored in `memory_embeddings` alongside
`operation_skill`, with the same `pinned = true`, `userId = null` scoping so it is excluded from
Daniela's ordinary student-memory recall pool (mirroring the existing `GLOBAL_RECALL_TYPES`
exclusion pattern for `operation_skill`).

A `procedure_knowledge` row's source-of-truth content lives in a new table,
`procedure_knowledge_entries`, not directly in `memory_embeddings` (which stores only the vector +
a hash + pointers) — mirroring how `tool_knowledge` backs `daniela_tool`/`tool_knowledge` embeddings.

Required fields on `procedure_knowledge_entries`:

- `id`
- `title`
- `content` — the advisory note itself (what an agent should know)
- `canonicalSource` — required, structured: `{ kind: 'file' | 'skill' | 'spec' | 'operation_id', reference: string, lineHint?: string }`. Every entry must point at something that already exists and is itself authoritative; `procedure_knowledge` never originates a fact with no canonical backing.
- `scope` — which actor(s) this is relevant to (e.g. `['luca-replit', 'luca-claude-code']`, or a wildcard for "all agents"). Never grants access; purely narrows relevance in results.
- `reviewState` — `draft` | `reviewed` | `approved`. Only `approved` entries are eligible for the global embedding index (see Write path). Mirrors the existing "hand-crafted `tool_knowledge` rows are never overwritten by the indexer" protection — a reviewed entry is not silently reindexed against a stale source.
- `supersededBy` — nullable self-reference. A superseded entry is excluded from retrieval (see Retrieval contract) but the row itself is never deleted, matching this project's general preference for append-only history over destructive edits.
- `staleAfter` — optional timestamp or explicit re-review trigger (e.g. tied to a source file's known revision), so an entry can be proactively flagged for re-review rather than silently drifting from a source that has since changed.
- `submittedBy` / `reviewedBy` — coordination actor IDs.
- `createdAt` / `updatedAt`.

No new coordination-actor permissions are required: any existing coordination actor may submit a
draft entry; only a distinct review step (see below) promotes it to `approved`.

## Write path

1. Any coordination actor may insert a `procedure_knowledge_entries` row with `reviewState: 'draft'`.
   This alone never triggers embedding/indexing — a draft is inert.
2. A **separate, explicit review action** (not automatic, not on a timer) transitions a draft to
   `reviewed` or `approved`. Who may review is an open question for Luca's read (candidates: the
   origin actor cannot self-approve their own draft past `reviewed`; `david` or `luca-holahola` as
   the approving authority, matching how founder authorization gates the observation bench's arm
   step). This is the "opt-in promotion path" — nothing reaches global recall without it.
3. Only on transition to `approved` does the indexer (a focused extension of the existing
   `daniela-tool-indexer.ts` pattern, not a new always-on worker) create the `procedure_knowledge`
   embedding row, keyed by content hash exactly like `tool_knowledge`/`daniela_tool` today — safe to
   re-run, idempotent, never overwrites a hand-approved entry against a stale hash without a fresh
   review.
4. If `canonicalSource` is later found to no longer exist or no longer say what the entry claims
   (caught by review, not by automation), the entry is superseded (`supersededBy` set on the old row,
   a new row created) rather than edited in place — preserves history the same way the observation
   bench and coordination ledger already prefer append-only correction over silent mutation.
5. Ledger events, raw `editor_insights` rows, and Team Room messages are never auto-promoted here.
   A human or agent may *use* something they read there as the basis for authoring a
   `procedure_knowledge` draft, but that is an explicit authoring act, not a pipeline.

## Retrieval contract (the part Luca asked to design first)

`GET /api/agent/procedure-knowledge?query=<phrase>&limit=<n>`, authenticated the same way
`GET /api/coordination/operations` is (existing coordination-actor credential).

Behavior:

1. Search only `approved`, non-superseded entries. `staleAfter`-flagged entries may still return but
   are marked `needs_re_review: true` in the response rather than silently excluded or silently
   trusted.
2. Each result returns: `title`, `content`, `canonicalSource`, `similarity`, `reviewState`,
   `needs_re_review`, and an explicit line stating this is advisory and the canonical source is
   authoritative if the two ever disagree.
3. A result **never** contains or implies: an operation ID's executor, actor scope, or confirmation
   requirement (those remain exclusively in the operations catalogue and are looked up there, not
   here, even if a `procedure_knowledge` entry happens to mention an operation by name).
4. Ambiguous or low-confidence matches are returned as candidates with their similarity score, not
   collapsed into a single "answer" — mirrors the existing `operations-catalog` skill's own
   instruction to "say so and ask one focused question" rather than presenting an ambiguous match as
   settled.
5. No mutation is possible through this endpoint. Read-only, always.

## State semantics

- **Draft:** exists, not indexed, not returned by search.
- **Reviewed:** an intermediate state for entries needing more than one eyes-on-it pass before global
  exposure; not yet indexed. (Whether this state is required or `draft → approved` is sufficient is
  an open question for Luca — see below.)
- **Approved:** indexed, returned by search, until superseded.
- **Superseded:** excluded from search, preserved in the table, linked forward via `supersededBy`.
- **Stale-flagged:** still returned, but visibly marked as needing re-review rather than treated as
  current truth.

## Verification (per Luca's required test categories)

1. **No operation override:** a `procedure_knowledge` entry that mentions an `operation_id` must
   never cause a retrieval response to include or imply that operation's executor, actor scope, or
   confirmation requirement — those fields must only ever come from `OPERATIONS_CATALOG`.
2. **No automatic ledger promotion:** appending a coordination event, of any kind, must never create
   or modify a `procedure_knowledge_entries` row. Verified by an explicit regression that exercises
   `appendCoordinationEvent` and asserts zero side effect on the new table.
3. **Scope isolation:** an entry scoped to `['luca-replit']` must not be presented as directly
   relevant when `luca-claude-code` queries, even if it matches semantically — it may still appear
   with an explicit "scoped to a different actor" marker rather than being silently hidden, so an
   agent isn't left wondering if the search simply found nothing.
4. **Stale/superseded exclusion:** a superseded entry must never appear in ordinary search results;
   only the superseding entry does. A stale-flagged entry appears, but only with its flag visible.
5. **Exact provenance:** every returned result must carry a `canonicalSource` that resolves to a real,
   currently-existing file/skill/spec/operation — a broken or dangling `canonicalSource` must fail
   closed (excluded from results, logged) rather than returned with a broken pointer.

Standard gate before shipping: prove any migration on an isolated Neon branch (`npm run db:branch --
gate`), run the focused tests above plus TypeScript, run `verify-system-health.ts`.

## Explicitly deferred

1. Making this queryable by Daniela or exposed to students in any form.
2. Automatic promotion of any kind (ledger, editor_insights, Team Room) — always an explicit act.
3. A UI for browsing/authoring entries — API-first, matching how `operation_skill` shipped.
4. Deciding whether `reviewed` is a real distinct state or collapses into `draft → approved` — flagged
   above for Luca's read, since they know the review-authority question (who approves) better than I do.
5. Cross-linking `procedure_knowledge` entries to each other (e.g. "supersedes" chains beyond a single
   `supersededBy` pointer) — start with the simple case.

## Open questions for Luca

1. Review authority: who may transition `draft → approved`? Self-approval forbidden for the
   originating actor seems clearly right; beyond that, is a single approver (David or
   `luca-holahola`) enough, or does this need the same dual-review pattern used elsewhere in this
   project (e.g. Gemini's re-consult loop for Daniela-facing text)?
2. Is `reviewed` as an intermediate state worth the complexity, or should this collapse to a simpler
   `draft → approved` with a required reviewer field?
3. Does this belong as its own table, or would you rather see it as a typed extension of
   `editor_insights` (adding the missing embedding-sync + provenance/staleness fields to that table
   instead of introducing a parallel one)? I defaulted to a new table to avoid retrofitting
   provenance/staleness/review-state onto years of existing `editor_insights` rows that were never
   written with this contract in mind, but you'd know that migration cost better than I would.
