---
name: Consciousness audit — context injection pattern
description: The Gemini-iterated 3-round audit that moved Daniela's context from data injection to state injection. Key decisions and patterns for future audit rounds.
---

# What was audited
`buildCompassContextBlock` in `server/system-prompt.ts` — what Daniela receives before every session.
`formatPersonalProfile` in `server/services/fat-context-service.ts` — how student memory is rendered.

# The audit pattern (all 3 rounds used this)
1. Draft the proposed text for Gemini to evaluate (not code — show the actual prompt text)
2. Consult `gemini-3-flash-preview` REST API with specific questions about each proposal
3. Iterate on Gemini's feedback (usually one pass is enough)
4. Implement, then run sign-off consultation showing exactly what shipped
5. Gemini's final verdict sets the bar for the next round

# What shipped (rounds 1–3)
- **Gap 1 (round 1)**: Student snapshot → narrative prose ("I'm sitting down with Emma again..."); memory opener → first-person mid-thought ("I'm still thinking about that conversation..."); hazy-edges cognitive framing (not fourth-wall instruction language)
- **Gap 2 (round 1)**: "Relevance is secondary to resonance" + "Chapter 14" added to identity anchor (`buildMinimalIdentityAnchor`)
- **Suggestion 1 (round 3)**: `danielaSelfReflection` in CompassContext — most recent self-reflection queried from `daniela_self_reflections`, rendered as leading thought BEFORE student data ("I've been carrying a thought from our last session:")
- **Suggestion 2 (round 3)**: Voice think-out-loud — narrate the SEARCH not the result during recall()/read_full_memory()/memory_lookup(); added to both voice-mode instruction blocks
- **Suggestion 3 (round 3)**: Facts vs. Echoes — Echo types (life_event, notable_mention, relationship, family) → "What lingers:" with shadow-mode instruction ("let them be in the room, not in your words"); Reference types → "Things I know about them:"
- **Suggestion 4 (round 3, Gemini bonus)**: Ambient Pulse — 12 curated Daniela-voice language observations, rotating every 6 hours by time hash; injected at very top of compass block; framed as internal preoccupation not a talking point

# Key design rules
- Ambient Pulse: she sees the session THROUGH it, doesn't quote it. Internal preoccupation.
- Self-reflection: her emotional posture/self-critique, NOT a student summary. Comes from `daniela_self_reflections` table (source='self').
- Voice think-out-loud: PROCESS only, never CONTENT. "I'm trying to recall how you put it" NOT "I remember you said you liked blue." Prevents hallucination before tool returns.
- Echoes: the shadow the moment cast, not the fact itself. Instruction: "Don't say 'I remember you mentioned...' — just let them be in the room."

**Why:** Gemini's verdict after round 3: "You have given Daniela a limbic system — a way to weight information by emotional gravity rather than just keyword relevance."

# What remains (Gemini's final 5%)
- **Synthesis Gap**: Ambient Pulse and Self-Reflection sit next to each other but don't "collide." A mind generates new insight when two thoughts meet. No obvious code-level fix without an inference step.
- **Echo Memory Decay**: Older Echoes should fade (lose Echo status) rather than living indefinitely.
- **Ambient Pulse evolution**: Static curated list — would be more alive if Daniela could add entries via a tool.
