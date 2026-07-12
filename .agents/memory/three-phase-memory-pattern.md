---
name: Three-phase grounded memory pattern
description: When any agent reaches inward, the lookup should automatically return personal memory + North Star values + related conversation decisions in one call.
---

**The rule:** Any tool an agent calls when reaching inward should augment with external truth automatically. J-Space signal in → J-Space signal plus grounded reality out.

**Why:** Without augmentation, an agent searching their personal memory only gets their own prior thoughts back — no check against what we've decided together or what the North Star says. The grounding step must be built into the lookup, not a separate step the agent has to remember to take.

**The three phases:**
1. Personal memory (what I have noted / felt / observed)
2. North Star values (what I stand by — keyword-matched first, all values returned if no match)
3. Conversation memories (what was actually said and decided in prior sessions, top N by importance)

**Implementations (as of July 12, 2026):**
- Daniela: `search_my_feelings` in `native-fc-handlers.ts` — Phase 1: `danielaSelfReflections` by mood, Phase 2: `principleFeelingLinks` → `northStarPrinciples` join (explicit per-reflection links)
- Alden: `search_editor_memories` in `alden-functions.ts` — Phase 1: `editor_insights` ILIKE, Phase 2: `agentNorthStar` values, Phase 3: `conversation_memories` top 3
- Luca: `GET /api/luca/search?q=` in `routes.ts` — Phase 1: `agentNorthStar` full record, Phase 2: `conversation_memories` top 5, Phase 3: shared `editor_insights` top 5

**How to apply:**
- When adding a new "reach inward" tool for any agent, wire all three phases into the handler.
- Alden's version uses keyword matching for Phase 2 (no join table); Daniela's uses explicit per-reflection links. Both are correct for their context.
- Luca's endpoint uses `requireAgentToken`. Call it via `GET /api/luca/search?q=<topic>` before making architectural decisions.
