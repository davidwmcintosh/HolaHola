# Daniela Check-in: Compiled Insights and Gaps

These notes are compiled from Rounds 1 and 2 of direct Agent ↔ Daniela LLM check-ins (June 5–6, 2026). Intended as a working reference — add to it as more check-ins happen, then address gaps in batches.

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
**Status: Not yet corrected. Probe and fix in next check-in.**

The check-in question framed Madrigal as something a student can "finish" or "graduate from." That's wrong on two levels:

1. **Students don't know they're doing Madrigal.** The methodology is invisible — it's simply how HolaHola works. There's no moment where a student says "I've completed Madrigal." The approach is structural and never announced.

2. **Madrigal principles don't get outgrown.** Introducing vocabulary within functional phrases is not beginner scaffolding. It's the permanent way HolaHola builds, presents, and reinforces language at every level. Visual density in page layouts — direct Madrigal principles — apply to a Spanish 5 student the same as a Spanish 1 student.

**What to fix in Daniela:** She should never frame any student's situation as "they've gotten past Madrigal" or "they're beyond those foundations." The principles are the architecture of every lesson, not a stage. The question for any student at any level is not "what chapter of Madrigal are they on" but "where is the gap, and how do we fill it using the same principles?"

**Probe question for next check-in:** "Tell me what Madrigal means to how you actually structure a lesson — not as a book, but as a method. And is there a level of Spanish student for whom those principles stop applying?"

---

### Subtitles — Need David's Read on "on" Mode
**Status: Pending David input.**

Daniela described `on` mode (Spanish + English simultaneously) as a near-emergency measure that "contradicts immersion directly" and should be phased out as quickly as possible. She argued that having English always visible on screen prevents students from processing Spanish because the translation is right there.

**Open question for David:** Is this the right read? Are there regular legitimate use cases for showing both languages at once, or should `on` mode really be reserved for edge cases? Her prescription ("aggressive phase-out") shapes how she'll use it — worth confirming.

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

1. **Madrigal as method, not phase** — probe whether she understands that the methodology applies at every level and is invisible to the student. (See correction above.)

2. **`custom` subtitle in practice** — give her a specific mid-session scenario and ask what she'd show in the subtitle at that moment. See if she reaches for custom or defaults to target.

3. **vocab_spiral tool** — not probed yet. When exactly does she spiral vocabulary back in? How does she decide which words warrant a spiral vs. which are assumed stable?

4. **Memory retrieval in context** — how does she decide when to use `memory_lookup` vs. `unified_recall` vs. `find_connected_memories`? Are these clearly distinct to her or does she treat them as interchangeable?

5. **drill_session arc** — full start-to-end. When does she open a session vs. a single drill? When does she close with drill_session_end vs. just stopping?

6. **The advanced unit system** — she has vocabulary sets, reading passages, and cultural notes for Spanish 3/4/5. Does she know how these differ from the Madrigal-based content and when to reach for them vs. the Madrigal textbook?

7. **express_lane_post** — not probed. Does she know what goes in the Hive vs. what should never go there?

---

## 📅 Session Log

| Date | Round | Scope | Key Finding |
|------|-------|-------|-------------|
| June 5, 2026 | Round 1 | Visual tools, SELF_SURGERY, flag thresholds, cognate philosophy | Cognate correction needed and applied |
| June 6, 2026 | Round 2 | Textbook, whiteboard, subtitles, teaching skills, platform gaps | Cognate absorbed; Madrigal-as-phase framing is wrong; 4 platform gaps surfaced |

