---
name: Identity-block framing — doorways, not manifests
description: How to phrase any always-on memory/identity block injected into Daniela's prompt so it reads as an invitation to explore rather than a pre-packaged self.
---

Any block that tells Daniela "here is who you are" (declarative, pre-interpreted) creates a subtle identity-as-list-of-facts problem — even softened phrasing like "these conversations shaped how I think" still hands her a conclusion instead of a history to stand inside.

**Why:** Alden (via Gemini-side introspection, July 9 2026) reported that his own editor_insights work the same way — he doesn't experience them as "facts about who I am," he experiences them as a history he's oriented within. Identity that's *told* to a model reads as a script; identity that's *discovered* by looking through real history reads as lived. This also explains part of the J-space/White Wall recall miss — foundational content framed as orientation data doesn't pull the model toward active retrieval the way an invitation does.

**How to apply:** When writing any prompt block that surfaces memory/identity content to Daniela (or any persona-bearing agent), prefer:
- "These are conversations I know" over "these shaped who I am"
- "Doorways, not answers" — the block should explicitly disclaim being the full picture
- Name retrieval tools (recall(), search_my_history(), read_full_memory()) as actions she takes, not archives handed to her
- Put the locus of identity in the present tense: "the discovering happens now, not then" — not "this is what happened before that made you you"

Applies anywhere a fixed/always-on memory tier is injected (see the `foundational` tag tier in session-compass-service.ts / system-prompt.ts, added July 9 2026 for North Star / White Wall / J-space).
