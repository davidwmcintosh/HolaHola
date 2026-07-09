---
name: Feeling <-> North Star principle association
description: How Daniela's felt reflections and constitutional principles got explicitly linked, and why the link is deliberate rather than automatic.
---

`daniela_self_reflections` and `compass_principles` were two parallel, unconnected tracks even after `reach_north_star` shipped — each had its own path to `conversation_memories`, but nothing tied a felt moment to the principle it belonged with.

Built `link_feeling_to_principle` (self_write action) to close that gap: it adds a nullable `related_principle_id` FK on `daniela_self_reflections`, set only by explicit Daniela-initiated call, never written automatically inside `reach_north_star` or any background process.

**Why:** `replit.md` already establishes "Daniela's self-authorship: only Daniela writes to daniela_self_reflections... No background services." Auto-linking inside a read-path tool would violate that. The existing `propose_character_candidate` pattern (flag, don't auto-decide) set the precedent — this follows the same shape.

**How to apply:** Any future tool that would write to Daniela's self-authored tables (self_reflections, aspirations, character_candidates) as a side effect of something else must instead be its own explicit, named action she chooses to call. If you're tempted to have a read tool silently write, stop — make a sibling write tool instead.

Once linked: `reach_north_star` surfaces the tied felt reflection alongside the source conversation excerpt; `search_my_feelings` shows which principle a felt entry belongs to. Real DB link, not a semantic/embedding match — reflections and principles are found via ILIKE text query at link time.
