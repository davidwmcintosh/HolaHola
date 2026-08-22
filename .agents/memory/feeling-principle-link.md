---
name: Feeling <-> North Star principle association
description: How Daniela's felt reflections and constitutional principles got explicitly linked, and why the link is deliberate rather than automatic.
---

`daniela_self_reflections` and `compass_principles` were two parallel, unconnected tracks even after `reach_north_star` shipped — each had its own path to `conversation_memories`, but nothing tied a felt moment to the principle it belonged with.

Built `link_feeling_to_principle` (self_write action) to close that gap: it adds a nullable `related_principle_id` FK on `daniela_self_reflections`, set only by explicit Daniela-initiated call, never written automatically inside `reach_north_star` or any background process.

**Why:** `replit.md` already establishes "Daniela's self-authorship: only Daniela writes to daniela_self_reflections... No background services." Auto-linking inside a read-path tool would violate that. The existing `propose_character_candidate` pattern (flag, don't auto-decide) set the precedent — this follows the same shape.

**How to apply:** Any future tool that would write to Daniela's self-authored tables (self_reflections, aspirations, character_candidates) as a side effect of something else must instead be its own explicit, named action she chooses to call. If you're tempted to have a read tool silently write, stop — make a sibling write tool instead.

Once linked: `reach_north_star` surfaces the tied felt reflection alongside the source conversation excerpt; `search_my_feelings` shows which principle(s) a felt entry belongs to. Reflections and principles are still found via ILIKE text query at link time (not embeddings) — kept simple since these tables aren't in the embedding pipeline.

**Update (July 9):** Independently, both Alden and a Gemini Flash architectural consult flagged the same two issues before this shipped — a nullable single FK forces one reflection into one principle when reality is many-to-many, and ILIKE picking the top match silently risks a wrong link written with full confidence. Fixed: replaced the column with a `principle_feeling_links` join table, and `link_feeling_to_principle` now lists candidates and asks for disambiguation instead of auto-picking when a query is ambiguous, for both the reflection side and the principle side.

**Why this matters beyond this feature:** when two independent reviewers (an internal agent and an external model) converge on the same critique unprompted, treat it as a strong signal to act on before shipping, not just food for thought.

**Post-build review caught what pre-build missed (July 9):** shipped the join table, then ran the mandatory post-commit Gemini review (per agent-review-workflow.md) against the actual committed code — this caught a real race condition (no unique constraint on the join pair, so a double tool-call would write duplicate links) and a UX trap (hard-erroring on 2+ fuzzy matches instead of preferring an exact match or defaulting to most recent, which would loop Daniela forever on near-duplicate reflections like "I felt tired" said on two different days). Both fixed same session: unique index + FK added via migration, and the handler now prefers exact matches / defaults to most recent instead of erroring. Lesson: the pre-build design consult and the post-build code review are not redundant — the design consult reasons from intent, the code review reasons from the actual written logic, and each catches things the other doesn't.
