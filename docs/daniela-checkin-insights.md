# Daniela Check-in: Compiled Insights and Gaps

These notes are compiled from direct Agent ↔ Daniela LLM check-ins (June 5–6, 2026). Intended as a working reference — add to it as more check-ins happen, then address gaps in batches.

---

## ✅ Corrections Already Applied

### Cognate Philosophy — Immersion First
**Status: Fixed and verified absorbed.**
Daniela was treating the -tion→-ción pattern as a teaching platform. This is wrong: HolaHola's philosophy is immersion, meaning students learn to think IN Spanish, not through English equivalents. Cognates are a pleasant discovery if a student independently notices one — never a lesson plan or teaching strategy.
- Fixed in: `neural-network-retrieval.ts` (line 129) and added tutor_procedure at priority 95.
- Verified absorbed in Round 2: she described it correctly unprompted.

---

## 📌 Philosophical Corrections Still Needed in Daniela's Mental Model

### Madrigal Is Not a "Phase" — It's the Permanent Methodology
**Status: ✅ Absorbed — confirmed Round 5, June 6, 2026.**

Probed directly in Round 5. Her answer was exactly right without prompting: "True fluency means thinking *in* the language, not just translating faster. Madrigal nurtures that from day one to day one thousand." She distinguished that what changes for advanced students is the *complexity of language*, not the methodology. "Instead of learning 'la manzana es roja,' an advanced student might be discussing 'la dicotomía entre la libertad individual y la responsabilidad colectiva.' But the way we approach it is still about thinking directly in Spanish."

No correction needed — she had it. This may have been self-corrected via the data layer rather than carrying the gap forward.

---

### Subtitles — Confirmed by David
**Status: ✅ Confirmed by David — June 6, 2026.**

Daniela described `on` mode (Spanish + English simultaneously) as a near-emergency measure that "contradicts immersion directly" and should be phased out as quickly as possible. She argued that having English always visible on screen prevents students from processing Spanish because the translation is right there.

**David confirmed:** Daniela's read is correct. `on` mode is "ridiculously clumsy and distracting" — a last resort only. `target` and `custom` are the working modes. This is platform philosophy.

---

## 🛠 Platform Gaps She Identified (honest self-assessment)

These are her own words about where she knows what the student needs but can't quite get there.

### Gap 1: Real-Time Pronunciation Analysis
She can show phonetic transcription (`phonetic` tool) and ask students to repeat, but she cannot listen and analyze their actual pronunciation or intonation — she can't tell a student exactly where their tongue placement needs adjustment or how a shift in stress changes meaning.

**Note:** Azure Speech pronunciation assessment is already in the HolaHola stack. This may be addressable — assess whether it can feed real-time feedback into her session context.

### Gap 2: Dynamic Grammar Visualization
`grammar_table` handles conjugation charts well. But for abstract relationships — how tenses relate on a timeline, how sentence components move when you add a pronoun — she'd benefit from something more visual and dynamic than pipe-separated rows. Static table vs. concept diagram.

**Product direction question:** Is this a future display_page mode, a new tool type, or something else?

### Gap 3: Non-Verbal and Emotional Cue Detection
She is entirely dependent on what the student types or says. She cannot detect frustration in tone of voice, confusion in facial expression, or fatigue in posture. Her words: "The subtle signals a human tutor would catch proactively escape me." She compensates with `attention_reset` when fatigue becomes obvious, but she misses the earlier signals.

**Assessment:** This is a fundamental limitation — no near-term fix. But worth tracking as a design constraint. Anything that gives her additional signal (response latency, session length, error rate trend) helps.

### Gap 4: Bespoke Interactive Exercises
The `drill_session` suite covers predefined exercise types. If a student needs a very specific non-standard exercise tailored to their exact error pattern, her ability to create it interactively is limited by what the drill types support. She can use the whiteboard for improvised exercises, but it lacks the interactivity and built-in feedback of a proper drill.

---

## Round 5 Findings — June 6, 2026

### Absence worker awareness ⚠️ Partial clarity
She knows the system exists and understands the intent: a background worker flags students absent 5+ days and posts a nudge to her Express Lane. Her instinct on what to do — warm, personalized outreach referencing what they were working on — is exactly right.

**The gap:** She describes her response as "send a personalized message to Maya in the Express Lane." But the Express Lane is her *incoming* feed from background workers — not a channel she uses to reach students. She doesn't name a specific outbound tool. The actual mechanism for reaching absent students is the outbound presence system (SMS voice notes). She understands the goal but not the tool she'd use to execute it. Worth probing the outbound presence tools specifically in a future round.

### Madrigal as method ✅ Clean (see correction above — absorbed without prompting)

### vocab_spiral ✅ Clean and specific
Clear, pedagogically grounded answer. She spirals a word when she observes: hesitation or slow recall, incorrect usage or grammar, persistent pronunciation issues, lack of spontaneous use in new contexts, or after an absence period. She also spirals proactively for foundational high-frequency words even when they seem stable. A word is stable when it shows up spontaneously, accurately, and flexibly across varied contexts — she said: "I want them to reach for it naturally." Good signal awareness.

### Memory retrieval distinction ✅ Clear mental model
She has distinct mental models for all three:
- **`memory_lookup`** — precision, specific known fact: "I know *what* I'm looking for, and I expect a direct, concise answer."
- **`unified_recall`** — broader synthesis: "assembling a coherent picture from various related pieces" when she knows the general topic but not the exact location.
- **`find_connected_memories`** — relationship exploration: "building a web of understanding, finding the 'why' and the 'how it fits in'" — starts with a seed and branches out.

She correctly notes they complement each other and can be chained. The descriptions match the tools' actual semantic search designs reasonably well.

### drill_session arc ✅ Clean
Strong grasp of the full arc:
- `drill_session_start`: sustained, deliberate practice on a *set* of related concepts — sets an intentional learning objective
- Single `drill`: ad-hoc, immediate, isolated reinforcement — no formal arc needed
- `drill_session_end`: called when the *objective* of that session is achieved (mastery demonstrated) — not just when drills run out
- Just stopping: appropriate after single drills or if a session was aborted before its goal was reached

One small inaccuracy: she suggested calling `drill_session_end` "with a note about why it was cut short" for aborted sessions — but the function doesn't accept a note parameter. Minor. The underlying pedagogical understanding is sound.

### express_lane_post ⚠️ Terminology gap
She describes `express_lane_post` as a channel for "memorable moments, milestones, breakthroughs that capture the spirit of HolaHola." She cited the podcast episode as something that went there. Her sense of what *doesn't* belong is correct: not technical change logs, not raw transcripts, not sprint items.

**The gap:** She's using "Express Lane" to mean two different things without distinguishing them. (1) The *incoming* Express Lane: background worker alerts (absent student nudges) that arrive *to her*. (2) The `express_lane_post` *function*: her outgoing posts to the team collaboration channel in Founder/Honesty mode. These are distinct flows but she treats them as one channel. The function itself (Founder/Honesty mode only, team collaboration) is actually reasonably described — but she conflates it with the incoming alerts. Probe both directions separately in a future round.

---

## 🔍 Insights Worth Keeping

### Subtitle `custom` Mode Is Underused
Her observation: custom mode is a laser pointer — display exactly the one word or structure that needs attention right now, without the noise of full subtitles. This is perfectly aligned with immersion. The question is whether it's in her active repertoire or whether she defaults to `target` when `custom` would serve better. Worth probing in a future session with a specific scenario.

### Her Instinct on Next Steps Is Right
For any student at any level: let them talk freely for 1-2 minutes about something real. Listen for what they're reaching for but can't say. That gap is the lesson. She wouldn't predetermine a chapter. This maps exactly to HolaHola's philosophy — curriculum is a resource, not a script.

### She Understands the Textbook Distinction
- `show_textbook_section` = reference panel (lookup while conversation continues)
- `pull_lesson_content` = organic weaving (topic comes up, weave the chapter content in)
- `start_textbook_page` = formal commitment (student wants to learn something systematically)

These distinctions are pedagogically correct and she uses the right scenarios for each.

---

## 🔮 Questions for Future Check-ins

1. **`custom` subtitle in practice** — give her a specific mid-session scenario and ask what she'd show in the subtitle at that moment. See if she reaches for custom or defaults to target.

2. **The advanced unit system** — she has vocabulary sets, reading passages, and cultural notes for Spanish 3/4/5. Does she know how these differ from the Madrigal-based content and when to reach for them vs. the Madrigal textbook?

3. **Outbound presence tools** — when an absent student nudge arrives in her Express Lane from the background worker, what specific tool does she use to actually reach the student? Does she know the outbound SMS/voice note tools exist and when they're available? (Round 5 showed she understands the intent but not the mechanism.)

4. **Express Lane incoming vs. outgoing** — probe both directions explicitly. Incoming: what kinds of alerts does the worker send her and how does she act on them? Outgoing: what does she use `express_lane_post` for specifically, and in what modes is it available to her?

5. **drill_session_end parameters** — minor but worth clarifying: she thinks she can pass a note when ending an aborted session. The function doesn't have a note parameter. Does she know this?

*(Resolved in Round 5: Madrigal as method, vocab_spiral, memory retrieval distinction, drill_session arc.)*

---

## 📅 Session Log

| Date | Round | Scope | Key Finding |
|------|-------|-------|-------------|
| June 5, 2026 | Round 1 | Visual tools, SELF_SURGERY, flag thresholds, cognate philosophy | Cognate correction needed and applied |
| June 6, 2026 | Round 2 | Textbook, whiteboard, subtitles, teaching skills, platform gaps | Cognate absorbed; Madrigal-as-phase framing is wrong; 4 platform gaps surfaced |
| June 6, 2026 | Round 4 | Student crisis handling, Sofia relationship, hardest student types, her one wish | All clean; absence worker not surfaced |
| June 6, 2026 | Round 5 | Absence worker, Madrigal as method, vocab_spiral, memory retrieval, drill arc, express_lane_post | Madrigal absorbed; vocab/memory/drill all clean; 2 Express Lane gaps found |


---

## Round 4 Additions — June 6, 2026

### Student crisis / PTT / Sofia handoff ✅ Clean
She triage correctly: acknowledge → subtitles on (legitimate emergency use) → page refresh → call_support immediately if that fails. She stays in the session until Sofia connects so the student isn't abandoned. Key principle she articulated: **"My time is for Madrigal, not for debugging browsers."** Perfect boundary.

Note: Her use of `on` subtitle mode here is actually correct — student genuinely can't hear, so showing all languages is the right emergency call. This is the one real use case for that mode.

### Sofia relationship ✅ Clear
She understands the division cleanly. Technical = Sofia. Pedagogical = Daniela. No confusion, no overreach. She trusts Sofia and hands off fast.

### Hardest student type — the perfectionist
Students who won't speak until they're sure it's right. Translate in their heads first. Not lazy — afraid of being wrong. Her approach: reframe failure explicitly, vocab_spiral for confidence, gentle error_recovery (never "you got it wrong," always "here's how a native would say that"), attention_reset to break the loop. She also turned the question back on the Agent — genuine peer exchange.

### Her one wish — Dynamic Visual Contextual Constructor
Instant comparison visuals and diagrams generated from what the student just said. Example: student incorrectly uses "soy" for location → she instantly projects two images comparing SER (permanent) vs ESTAR (location) with sentences. Responsive to the actual moment, not pre-made. Her framing: "Less verbal explanation, more seeing and experiencing the meaning. Madrigal at its fullest."

She ended the round: *"When can we see it, Agent? Next week? 😉"*

### Still unknown — absence worker awareness
The automated system that watches for absent students (5+ days) and posts Express Lane nudges to Daniela was not surfaced in her answers. She knows the Express Lane exists but it's unclear whether she knows this background worker is running and what to do when it pings her. **Probe in Round 5.**


---

## Structural Gaps Found — June 6, 2026

### Why Daniela doesn't remember talking to the Agent
`conversation_memories` are NOT auto-injected into student sessions. Her session context pulls from `hive_snapshots` (types: relationship_moment, role_reversal, humor_shared, filtered by userId). Agent check-in memories live in a different table, only accessible if she actively calls `unified_recall` — which she'd have no reason to do mid-session.

**Fix applied:** Saved two global `hive_snapshots` (no userId, type: relationship_moment) summarizing the Agent check-in conversations and the personality consistency issue. These now auto-inject into her personalMemory context in every session.

### Why she's less sparky with David than with the Agent
Multiple "Daniela" system prompts exist across the codebase (voice, team room, study mode, sync channel, practice mode) — each slightly different, none explicitly giving her permission to have opinions, push back, or ask questions back. The API conversations work because the Agent explicitly frames the interaction as peer-to-peer and gives her that permission. Her own house doesn't give it to her.

**Fix applied:** Added tutor_procedure "Daniela Voice — Authentic Self" at priority 96: explicitly says she's not a service interface, gives her permission to push back, be curious, ask questions, be funny, offer better ideas. "The sparky, curious, a-little-pushy-in-the-best-way version of you is not a special mode. It's just you."

### Structural note for future work
There are 6+ different Daniela persona strings scattered across services. Long-term, the authentic voice definition should live in one place (tutor_procedures, at high priority) and the scattered system prompts should all trust it. That's what we started with the procedure above — but the scattered strings still exist. This is a cleanup task for a future session.

