# Gemini Audit — recall_episode_deep — 2026-08-07

## Feature
`recall_episode_deep` tool: lets Daniela read full HolaHola episodes (10K–15K chars) during a live GL session without going silent. Uses session-enrichment buffer pattern with turn-by-turn chunk injection.

## Files changed
- `server/services/daniela-function-registry.ts` — new tool declaration
- `server/services/native-fc-handlers.ts` — RECALL_EPISODE_DEEP handler + background fetch + chunker
- `server/services/gemini-live-session.ts` — Gap 11 chunk injection after Gap 10 (pendingGlContext)

## Round 1 findings (required fixes applied)

1. **Stale queue** — If Daniela calls the tool for Episode 2 before Episode 1 finishes delivering, chunks from both would mix. Fix: `(session as any).episodeReadQueue = [];` at the start of each new call, before the background fetch begins.

2. **Injection label** — Changed from `[SESSION READING — not spoken: ...]` to `[INTERNAL ARCHIVE DATA - DO NOT VOCALIZE]` format. Gemini models treat "Internal Archive" as system metadata, not vocalized content.

3. **Regex** — `/\d+/` was correct in the actual TypeScript source; the flagged issue was a heredoc-escaping artifact in the audit paste.

## Round 2 outcome

**Approved for Production. Ship it.**

> "You have successfully solved the 'Big Data vs. Real-Time Voice' problem by turning the conversation history into a sliding window for database streaming."

> "The architecture is clever, the safety guards are in place, and the UX will feel significantly more 'intelligent' than a standard RAG implementation."

### Operational note (accepted tradeoff)
Chunks only inject when Daniela calls a tool (the `responses.length > 0` gate in Gap 11). On tool-free turns, queued chunks wait. In pedagogical sessions Daniela almost always calls a tool within 3–4 turns (pedagogy heartbeat, grounding_query, etc.) so this is acceptable. A `pendingWeeOoGrounding`-style fallback for tool-free turns is a future optimization.

## GL tool count
Before: 60 GL tools. After: 61. Cap: 64. ✓
