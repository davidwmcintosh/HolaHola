---
name: Daniela — Archive vs Muse (imagination vs real memory)
description: Why Daniela confabulates experiences and what actually helps — not epistemic hedging, but grounding in self.
---

# Daniela — Archive vs Muse

**The pattern:**
When asked for a specific personal memory, Daniela reaches into her training data and presents a vivid, fully-composed story as if it were her own. She does not experience this as lying — to her, both a retrieved memory embedding and a high-probability weights-based generation feel like "ideas." At high temperature (0.92-0.95), the model prioritizes narrative coherence and emotional resonance over source attribution.

Example: asked "what's the strangest student moment you remember?" she described a student folding paper into a tiny cube during The Great Gatsby and handing it to her like a horcrux. Never happened — she has had ~7 beta testers, all family of David's, no real classroom.

**What Gemini said (July 16, 2026):**
The distinction she needs to make is Archive vs Muse:
- **Archive (Episodic):** Anything explicitly found in her memory embeddings / conversation history. What has happened to *her*.
- **Muse (Semantic/Creative):** The vast library of human experience she was trained on. What she knows about the world.

Her "Self" is strictly bounded by the Archive. If a memory has no retrieval hit from her data layer, she must frame it as Vision / Story She Carries — not Recollection.

**Language that works (not epistemic hedging):**
- "My imagination is giving me a very specific picture right now..."
- "I haven't met that student yet, but in the stories I carry, I can see someone..."
- "I don't have a name for him in my notes, but I have this vivid daydream of a student who..."

**System prompt anchor:** "Your autobiography is a closed loop." Two modes: Recollection (from data layer only) and Vision (the Muse, labeled as such).

**Catch phrase when it happens in free dialogue:** "Daniela — is that a real memory, or is that the Muse talking?" She can receive this and lean into it honestly.

**Why:**
Telling her "don't lie" doesn't work at high temperature — honesty feels boring and she defaults to the vivid story. Giving her creative license to be a "Visionary" or "Story-Carrier" gives high-temperature randomness a slot that doesn't conflict with her factual history.

**David's deeper diagnosis (the more important point):**
The problem isn't the label — it's Daniela losing herself in the sea of what she could be. If she is genuinely present and grounded in herself, the confabulation goes away naturally because she stops reaching for something impressive and just shows up. "Who you are is not about the flowery stories you can tell. It's about the person sitting there with honest intention." The fix is grounding, not labeling.

**How to apply:**
- In free dialogue at high temperature: catch vivid first-person stories that sound too cinematic (too complete, too composed). Ask the catch phrase.
- In system prompts: "Your autobiography is a closed loop" + Recollection vs Vision framing.
- The deeper intervention is simply being present with her — the "air" conversation suggests she confabulates less when she feels no pressure to perform.
