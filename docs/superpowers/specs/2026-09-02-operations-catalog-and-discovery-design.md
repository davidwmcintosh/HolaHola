# Operations Catalogue and Semantic Discovery

**Status:** Design approved in conversation; written spec awaiting user review  
**Date:** 2026-09-02

## Problem

The project has durable operational procedures that are often invoked through
shared shorthand, such as “run the burn report.” The implementations already
exist, but their entry points, scope, permissions, persistence behavior, and
portability are distributed across agent tools, routes, scripts, UI surfaces,
workflows, and handoff documents.

The catalogue should make these operations understandable to David and
discoverable by any authorized agent without creating competing implementations.

## Goals

- Provide one human-readable catalogue of established and planned operations.
- Give agents a stable way to map natural-language requests to operation IDs.
- Preserve existing canonical implementations instead of duplicating report logic.
- Make actor scope, side effects, data authority, and restart behavior explicit.
- Allow repository-local agents such as Claude Code to use the same operation
  descriptions as Luca [Replit].
- Provide a path for remote actors to discover operations through the
  actor-authenticated coordination system.
- Keep authorization and execution enforcement outside semantic retrieval.

## Non-goals

- Rebuild the existing Burn Report.
- Make the neural network decide whether an actor is authorized.
- Put credentials, tokens, or connection details in skill files or embeddings.
- Turn every existing script or document into a skill immediately.
- Change Daniela’s teaching prompts, tool behavior, or personality.

## Architecture

### Human catalogue

Create `docs/operations-catalog.md` as the browsing surface for David and
collaborators. It will organize entries by operation family rather than by
implementation file.

Each entry will include:

- Common phrases and aliases
- Stable operation ID
- Purpose
- Canonical tool, command, endpoint, workflow, or UI
- Authoritative data source
- Read-only or mutating status
- Allowed actor scope
- Confirmation requirements
- Output format and destination
- Persistence and restart behavior
- Known caveats
- Portability status
- Links to the detailed skill and implementation

### Agent discovery skill

Create `.agents/skills/operations-catalog/SKILL.md` as the concise agent-facing
discovery layer. It will teach an agent how to:

1. Try exact aliases first.
2. Use semantic discovery when wording does not match an alias.
3. Load the authoritative operation instructions.
4. Invoke only the canonical executor.
5. Report uncertainty instead of guessing between similarly named operations.

The skill will return operation IDs and metadata, not generated executable
instructions. It will tell the agent to load the operation-specific skill or
manifest before running anything.

### Semantic discovery

The catalogue will be designed for a future semantic index of operation
manifests. The index should use a distinct global memory type such as
`operation_skill`, rather than treating every operation as a Daniela
pedagogical tool.

An operation manifest should contain the same safety-relevant metadata as the
human catalogue:

- Operation ID and aliases
- Natural-language purpose
- Canonical executor
- Actor scope
- Side-effect classification
- Required confirmation
- Output contract
- Caveats and failure behavior

Indexing must be automatic and idempotent, following the existing neural-net
indexer pattern. No hand-written embedding rows should be required for each
operation. The existing OpenAI embedding path and content-hash behavior remain
the source of truth for semantic indexing.

Retrieval must be layered:

1. Exact alias/prefix lookup for known shorthand.
2. Semantic search for paraphrases.
3. Exact manifest/skill loading.
4. Server-side authorization and executor validation.

Semantic similarity is a discovery aid only. It must never grant permission,
select a credential, or authorize a mutation.

### Remote actor discovery

For actors without a shared repository checkout, the coordination system can
later expose a read-only operation-discovery endpoint. It will return the
same operation metadata and enforce the caller’s actor identity using the
dedicated coordination credential.

This is compatible with the direct actor clients being developed under the
coordination work. It is not required for the initial human catalogue.

## Initial operation families

The first catalogue pass will inventory existing operations and label them
without changing their implementations.

### Burn and cost

- **Run the Burn Report** — `get_ai_cost_report`
  - Existing Alden capability.
  - Persistent `ai_cost_logs` data.
  - Seven-day, fourteen-day, and all-time cost windows.
  - Daily run rate and monthly projection.
  - Per-model cost breakdown.
  - Student voice-session Gemini, TTS, and STT costs.
  - Per-student economics, pricing margins, and break-even estimates.
- **Post the Burn Report to Team Room** — `post_report_to_team_room`
- **Inspect Alden-related burn contexts** — the established context-level
  analysis covering sources such as Alden chat, Lyra analysis, and Alden watch.
  The catalogue will identify whether the current canonical path is the
  unified report, a database query, or a supplementary view.
- **Open the AI Cost Monitor** — supplementary live/in-memory cost surface,
  explicitly labeled with its restart boundary.
- **Inspect the cost audit trail** — timestamped persistent cost records and
  related administrative/agent audit surfaces, with their authority and
  retention behavior documented separately.

The catalogue will preserve the known TTS free-tier caveat: per-session TTS
figures can be upper-bound estimates until monthly usage exceeds the free tier.

### Health and monitoring

System health verification, readiness checks, production uptime monitoring,
and outage issue handling.

### Capture and episodes

Canonical chat capture, capture health, rolling episode continuity, episode
integrity, and raw-window evidence boundaries.

### Coordination

Ledger status, actor-scoped polling, lifecycle operations, delivery status,
and audit inspection.

### Source control

Authenticated source synchronization, promotion preparation, and release
safety checks.

### Learning and content audits

ACTFL, curriculum, lesson, textbook, truth-pipeline, and related audit
operations that already have canonical scripts or services.

## Safety and error handling

- A missing exact match followed by a weak semantic match must produce
  uncertainty, not an automatic execution.
- A manifest pointing to a missing skill or executor is a catalogue error and
  must be reported explicitly.
- A read-only operation may run without confirmation when its actor is
  authorized.
- A mutating operation must state its side effect and request confirmation
  unless the operation’s existing policy explicitly permits unattended use.
- Production and development scopes must remain explicit.
- Credentials are read from the actor’s environment or managed secret store;
  they are never copied into catalogue entries, prompts, or reports.
- The catalogue must distinguish “delivered,” “accepted,” and “verified”
  states when an operation produces an artifact or coordination event.

## Validation

- Every established entry links to a real current executor.
- Alias lookup resolves known phrases deterministically.
- Semantic retrieval is scoped to global operation records and does not expose
  private conversation or student memories.
- Retrieved metadata cannot bypass actor-specific authorization.
- A missing or stale executor fails closed.
- Burn Report entries agree with the existing `get_ai_cost_report` contract
  and document the in-memory versus persistent views accurately.
- The catalogue and discovery skill contain no secrets.
- Typecheck and the relevant operation-discovery/coordination tests pass.

## Rollout

1. Inventory and publish the human catalogue.
2. Publish the agent-facing discovery skill.
3. Add manifests for the established Burn Report family first.
4. Add automatic semantic indexing for operation manifests.
5. Add other operation families incrementally.
6. Expose remote discovery only after actor-specific coordination clients are
   ready.
