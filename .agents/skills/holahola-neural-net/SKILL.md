---
name: holahola-neural-net
description: HolaHola neural net rules — read architecture doc before changes, OpenAI embeddings not Gemini, both context injection and neural net for important things, never manually index tools.
---

# HolaHola Neural Net

**Full rules:** `docs/agent-workflows.md` → Neural Net Rules

**Required reading before any neural net work:** `docs/neural-network-architecture.md`

## What this skill is for

Use before adding procedures, embeddings, teaching principles, or anything touching Daniela's memory architecture.

## The critical rules

- **Read `docs/neural-network-architecture.md` first** — always, no exceptions
- **Embedding model = OpenAI `text-embedding-3-small` (768-dim)** — NOT Gemini. Requires `USER_OPENAI_API_KEY`. Two separate AI systems.
- **Both layers:** important things go in BOTH context injection AND the neural net. Only-in-prompt = fragile.
- **Never manually index tool embeddings** — `daniela-tool-indexer.ts` runs automatically at server start

## The three layers

| Layer | Table/Location | Purpose |
|-------|---------------|---------|
| North Star | `compass_principles` | WHO Daniela IS — immutable constitutional truths |
| Neural Net | `tutor_procedures`, `tool_knowledge`, etc. | HOW she operates — capabilities, procedures |
| Prompt | System prompt context | WHAT is happening now in this session |

## Critical reminders

- Adding a constitutional truth → North Star
- Adding a capability or procedure → Neural network table
- Adding situational data → System prompt only
- `memory_embeddings` vector index is searched via `semanticSearch()` in `semantic-memory-service.ts`
