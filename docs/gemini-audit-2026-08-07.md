# Gemini Audit — Task #694: reach_north_star Recent Echo expansion
**Date:** August 7, 2026  
**Auditor:** Gemini 3-flash-preview (two rounds)  
**Protected files touched:** `server/services/daniela-function-registry.ts`  
**Verdict:** APPROVED — "Ship it."

---

## What was reviewed

Task #694 expanded `reach_north_star` (Daniela's constitutional grounding tool) to surface two archive layers alongside the matched principle:
1. **The Founding Moment** — the `sourceConversationId` conversation where the principle was first proved true (existing, renamed)
2. **A Recent Echo** — a second `conversation_memories` row found via `arcName` exact match or `title ilike %principleTitle%`, ordered most-recent-first

`neural-network-sync.ts` was also updated to export `associatedMemories` stubs (principleId + memoryId + title) so the neural net knows archive linkages exist per principle.

The tool description was updated to match the new capability.

---

## Round 1 — Issues found

**CRITICAL (per Gemini):** Missing `userId` filter on echo search — risk of cross-user data leak.  
→ *Resolved via architectural clarification: `conversation_memories` has no `userId` column. It is a shared system table (episodes, philosophy, architecture sessions with David). Student session memories do not live here. No per-student data can leak. Comment added to code documenting this so future maintainers don't add an incorrect userId filter.*

**STABILITY:** `length > 3` guard insufficient — short titles like "Voice" or "Warm" would produce noisy `ilike` matches.  
→ *Fixed: guard increased to `length > 5`.*

**HONESTY:** Tool description over-promised — said "the founding story" and "a recent echo" unconditionally, but 21 of 31 active principles currently have no `sourceConversationId`.  
→ *Fixed: description now reads "and where the record exists — the founding story that first proved it true, and a recent echo..."*

---

## Round 2 — Fixes confirmed

Gemini reviewed the three fixes and issued unconditional approval.

**On privacy:** "Your clarification that `conversation_memories` is a shared system table effectively nullifies the cross-tenant data leak risk. Adding the comment is the correct move to prevent a future developer from breaking the tool."

**On noise guard:** "The `> 5` guard is a solid heuristic... For a production release, this is a safe and acceptable fail-closed approach." Minor note logged: `arcName` exact match could eventually be split from the `ilike` guard so short-title principles still get arc matches. Accepted tradeoff for now.

**On tool description:** "'Where the record exists' is the key. This prevents the LLM from entering a loop of confusion if it receives a result without a story."

**Verdict:** "The critical risks (Privacy and Noise) have been addressed through architectural clarification and defensive coding. The tool is now honest about its data availability. APPROVED. Ship it."

---

## Accepted tradeoffs (documented per GEMINI_REQUIRED.md)

| Tradeoff | Decision |
|---|---|
| `desc(createdAt)` for echo ordering | No importance score in schema; recency is best available proxy. Accepted. |
| 300/350 char truncation | Brevity serves constitutional grounding better than narrative walls. Accepted. |
| `arcName` must exact-match `principleTitle` | Functions as a forcing function for consistent tagging. Accepted. |
| Redundant `not` import (cosmetic) | No correctness risk. Left for normal cleanup. Accepted. |

---

## Files changed post-audit

- `server/services/native-fc-handlers.ts` — length guard `> 3` → `> 5`; cleaner query structure; privacy comment added
- `server/services/daniela-function-registry.ts` — tool description softened with "where the record exists"
