---
name: holahola-add-tool
description: HolaHola add-tool pipeline — 3 steps to add a Daniela tool, with automatic 3-layer indexing (daniela_tool embedding, tool_knowledge row, tool_knowledge embedding) at next server start.
---

# HolaHola — Adding a Daniela Tool

**Full pipeline:** `docs/agent-workflows.md` → Adding a Daniela Tool

## What this skill is for

Use whenever adding a new tool to Daniela's function registry. Only 3 steps needed — everything else is automatic.

## The 3 steps

1. **Add to `DANIELA_FUNCTION_REGISTRY`** in `server/services/daniela-function-registry.ts`
   - Define `legacyType` (ALL_CAPS_SNAKE), `declaration` (name, description, parametersJsonSchema), `buildContinuationResponse`
   - Write a rich description — the indexer uses it for the neural net embedding and tool_knowledge row

2. **Add handler case** in `server/services/native-fc-handlers.ts`
   - Match on `fn.legacyType` in the main switch
   - Store results in `session.yourResultsField` for `buildContinuationResponse` to read

3. **Decide GL exclusion** — if visual-only or no voice utility, add `legacyType` to `GL_EXCLUDED_TOOLS` in `streaming-voice-orchestrator.ts`

## What happens automatically (next server start, +100s)

| Layer | What gets created |
|-------|------------------|
| Layer 1 | `daniela_tool` embedding in `memory_embeddings` (pinned, global) |
| Layer 2 | `tool_knowledge` row (purpose, syntax, bestUsedFor — auto-derived from declaration) |
| Layer 3 | `tool_knowledge` embedding in `memory_embeddings` (semantic search of toolkit) |

All idempotent — safe to re-run. Hand-crafted `tool_knowledge` rows are never overwritten.

## Critical reminders

- **Never manually index** — the indexer handles all 3 layers automatically
- **Never manually insert `tool_knowledge` rows** for new tools — same reason
- `buildContinuationResponse` must clear any session state it reads (set to `undefined`) to prevent stale data on the next turn
- GL_EXCLUDED_TOOLS = tools that Gemini Live should not call (visual-only tools, or tools that crash in voice context)
