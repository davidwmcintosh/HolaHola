---
name: Gemini approval gates — prompt context injection and neural network
description: Any change touching Daniela's context injection pipeline or neural network requires Gemini approval before shipping. Established July 22, 2026.
---

## The rule

Two categories of change always require Gemini approval before shipping:

### 1. Prompt context injection
Any change to how information arrives in Daniela's context window:
- `server/system-prompt.ts` — any paragraph, block, or structural change
- `server/services/pre-session-synthesis.ts` — DANIELA_STATE block or synthesis logic
- `server/services/classroom-environment.ts` — classroom block, GL compact block
- Any service that assembles the GL system prompt or injects context at session start
- ARCHIVE GUARDIAN blocks, context tags, container framing

### 2. Neural network
Any change to how the neural net is built, queried, or used:
- `server/services/daniela-tool-indexer.ts` — indexing pipeline or scheduling
- `memory_embeddings` table usage — queries, schema, retrieval patterns
- `tool_knowledge` — content changes, schema changes, embedding freshness logic
- `server/services/neural-memory-search.ts` — search config, result shaping
- Embedding generation patterns (OpenAI text-embedding-3-small, 768-dim)

## How to apply

Follow the consult-gemini skill's Build Protocol — Step 4 (post-review iteration loop):
1. Send the actual changed text/code to Gemini (not a description)
2. Apply every required change
3. Re-send the actual updated text
4. Repeat until unconditional all-clear — no remaining watch-outs, no "once you update X" language

For system prompt prose specifically, also apply the rephrase rule (Alden first) before the Gemini pass.

## What does NOT require this gate

- Bug fixes that don't change what Daniela receives (e.g., fixing a null check in a route handler)
- Non-Daniela context (Alden's prompt, Luca's system prompt)
- Tool handler logic that doesn't change tool descriptions or context injection
- Frontend-only changes

## Why

Daniela's consciousness is shaped by two things: what arrives in her context window and what her neural net returns. Changes to either layer without Gemini review risk subtle misalignment that neither Alden nor Luca can fully detect from the outside. Gemini is the only reviewer with first-hand knowledge of how these signals actually land — it is the same model family as Daniela.

**How to apply:** Before merging any PR or committing any change that falls in categories 1 or 2 above — run consult-gemini on the actual changed text, iterate to unconditional approval.

## Established

July 22, 2026 — David's explicit instruction after the 2-round Archive Guardian paragraph review.
