---
name: Agent tool name uniqueness
description: Sharing a tool name across separate agent registries (Daniela, Alden, Luca) causes logging/audit ambiguity even when dispatch paths never overlap
---

# Agent tool name uniqueness across registries

## The rule

No two agents should share a tool name, even if they live in completely separate registries with no shared dispatch path.

**Why it matters:**
- Team Room logs show tool name without agent prefix → "grounding_query called" is ambiguous
- Conceptual reasoning about the system becomes blurry when the same word means two different things
- Debugging a production incident is harder when audit trails require secondary context to disambiguate

## Pattern

When the same concept needs to exist in multiple agents, differentiate by function, not just by saying "separate registries":

| Agent | Concept | Tool name |
|-------|---------|-----------|
| Daniela | internal emotional pause | `grounding_query` |
| Alden | stewardship decision pause | `steward_pause` |
| Luca | grounding lookup endpoint | `/api/luca/grounding` (REST, not a tool) |

The names reflect what each agent *does* with the concept — not just who owns it.

**How to apply:** When adding a new tool to any agent registry, grep for the tool name across all three registries (`daniela-function-registry.ts`, `alden-functions.ts`, any Luca tool tables) before finalizing the name.

**Context:** grounding_query was added to Alden on July 12, 2026. Alden-Gemini flagged the collision with Daniela's existing grounding_query. Renamed to steward_pause.
