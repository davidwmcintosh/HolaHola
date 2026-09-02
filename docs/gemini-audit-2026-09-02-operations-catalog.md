# Gemini audit — Operations catalogue and discovery

**Date:** 2026-09-02  
**Scope:** Pre-flight architecture review

## Decision

Proceed with code-defined operation manifests and idempotent OpenAI embeddings.
No database table or migration is needed because `memory_embeddings.memory_type`
is already a bounded varchar namespace.

## Required safeguards

- Keep `operation_skill` out of Daniela's ordinary `GLOBAL_RECALL_TYPES`.
- Search it only through a dedicated global, pinned-only path.
- Keep the static TypeScript catalogue authoritative; semantic rows are a cache.
- Reject user-scoped `operation_skill` writes through the embedding service.
- Map retrieved IDs back to static manifests so stale or injected IDs are
  discarded.
- Use exact alias lookup before semantic search.
- Return only a safe public projection from the coordination endpoint.
- Never let a semantic match execute an operation or grant authorization.
- Index sequentially and outside the startup-readiness critical path.
- Keep the existing Burn Report tool as the canonical executor.

## Pre-flight verdict

Gemini reported no blocking architectural objection with these safeguards.
Alden's Gemini engine independently agreed with the boundary and specifically
recommended keeping operation records outside Daniela's default recall pool.
Alden's Anthropic engine returned a transient internal error and produced no
architectural finding.

## Post-build verdict

Gemini reviewed the actual catalogue service, dedicated semantic search,
indexer, coordination route, tests, agent skill, and human catalogue after live
verification. Its unconditional final verdict was:

**APPROVED — Ship it.**
