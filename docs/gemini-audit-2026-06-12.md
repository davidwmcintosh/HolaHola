# Gemini Self-Audit — June 12, 2026

**Model used for audit:** gemini-3.1-pro-preview  
**Auditing:** What we send to Gemini 3.1 Flash Live (voice) and Gemini 2.5 Flash (text)  
**Perspective:** Same-generation Gemini reviewing its own session config, context injection, formatting, and tool declarations  
**Script:** `scripts/gemini-audit.ts` (run on demand; no production files modified by this script)

---

## Target 1: Gemini Live Session Config

> "Your configuration is currently fighting against Flash's strengths. You are compounding latency at the VAD, tool-evaluation, and reasoning layers, and then trying to mask that latency with prompt engineering."

### 1. VAD — silenceDurationMs:2500 + END_SENSITIVITY_LOW
**Finding: Too conservative. Recommend 1500ms max.**

Every time the user finishes speaking, Flash sits idle for 2.5 seconds before beginning processing. In voice UX, 2.5 seconds feels like a dropped call. END_SENSITIVITY_LOW combined with this means any background noise (sigh, paper shuffle, static) resets the timer indefinitely — the student's audio context window bloats with noise tokens.

*Recommendation:* Pull back to 1500ms and raise end sensitivity to MEDIUM. If a learner pauses longer than 1.5s, it is natural for a tutor to step in and offer a prompt. The original escalation (800 → 1500 → 2500) was solving for mid-sentence pauses, but 2500ms overshoots — 1500ms with MEDIUM handles those better.

### 2. thinkingConfig HIGH in a voice session
**Finding: Hostile to voice UX. Recommend MEDIUM or disable.**

"HIGH thinking" in 3.1 means allocating a larger compute budget for latent reasoning *before* emitting the first audio token. In text this is fine. In voice, audio streaming cannot begin until the reasoning block resolves, adding significant TTFT latency. The main reason HIGH seems to help here is parsing the 130-tool declaration list — meaning the real fix is pruning tools (see Target 4), not compensating with a reasoning budget.

*Recommendation:* Drop to MEDIUM. Or disable and verify voice quality is unchanged — Flash is highly capable at language tutoring on base settings.

### 3. Accent directive position (appended at END of system prompt)
**Finding: END position is correct, but the text-level prompt is counterproductive.**

Recency bias in attention heads means terminal instructions carry high weight — so END is mathematically right. However: `speechConfig` (`languageCode: 'es-ES'`, `voiceName: 'Aoede'`) already guarantees a Castilian *acoustic* accent. Telling Flash to additionally "speak with a Castilian accent" in text causes it to alter text generation to prove compliance — Daniela will over-index on regionalisms (*vosotros*, *guay*, *vale*) to an unnatural degree.

*Recommendation:* Remove the text-level accent directive. Let speechConfig handle the acoustic accent entirely.

### 4. VOICE_PACING directive ("verbal bridges")
**Finding: Remove it. Does not work as intended; becomes robotic.**

Flash does not stream audio asynchronously while thinking. A directive to say "hmm, let me think about that" causes Flash to literally generate those words and synthesize them before every response. It does not buy processing time — it just prepends filler words to every turn. After a few exchanges it sounds robotic and repetitive.

*Recommendation:* Delete VOICE_PACING directive. Fix latency at VAD and tool levels instead. Use client-side UI state for a "thinking" indicator if needed.

### 5. ~130 tool declarations per session
**Finding: Quality drops off a cliff around 30-40 complex tools.**

With 130 tools, Flash must evaluate function signatures on every turn. Consequences: (1) drastic TTFT increase from evaluation overhead, (2) Flash gravitates to a familiar cluster of 10-15 tools and implicitly ignores the rest unless cornered, (3) hallucinated merges — Flash starts mixing parameters from adjacent tools (e.g., passing `emotion` from `voice_adjust` into `speak_as`).

*Recommendation:* Dynamic tool loading keyed to session phase. See Target 4.

### 6. responseModalities AUDIO-only + outputAudioTranscription
**Finding: Correct workaround, but two blind spots worth knowing.**

(1) Mid-session context injection: without TEXT modality, there is no clean way to inject silent system updates (e.g., "the student just navigated to Module 4"). All inputs must be audio or tool responses. (2) Transcription mismatch: `outputAudioTranscription` captures text Flash sent to TTS, not the acoustic output. If TTS drops a syllable, the DB transcript won't match what the student heard.

*No immediate fix — both are platform limitations.*

---

## Target 2: Context Injection Ordering

> "As the model receiving this payload inside a real-time, low-latency Gemini Live voice session: **this ordering and composition will degrade my performance.** You are feeding me a massive, poorly ordered text file that buries the most critical information and pads the prompt with irrelevant noise."

### 1. Position weighting — "Lost in the Middle"
Attention follows a U-curve: highest at the absolute top (core identity) and absolute bottom (immediate context closest to next generation). The dead zone is the middle.

**Current state:** Most critical immediate data (Student Snapshot Section 5, Recent Voice Sessions Section 6) sits in the dead zone. Low-priority data (Hive, Neural Net, TOC) occupies the valuable bottom position.

### 2. Pedagogy doc — 40,000+ tokens at Section 2
**Finding: Critical architectural error.**

Dropping 40k+ tokens at Section 2 creates a massive attention black hole. Everything in Sections 3–8 gets pushed deep into the dead zone. By the time Flash reads the student snapshot (Section 5), attention weights are severely diluted.

*Recommendation:* (1) Load into a **Cached Content** block. (2) Move to the middle of the prompt as reference material, not the top.

### 3. Identity before student data
Currently Sections 1-4 (Daniela's identity) appear before Sections 5-6 (who the student is). In a tutoring session, reading 40,000 words about the Madrigal method before knowing the student's name, ACTFL level, or what we discussed last time, is wrong.

### 4. Static neural net context (Section 9)
The semantic search uses a static query — same results every session regardless of conversation. It occupies premium late-prompt real estate. If it is static, it belongs in the pedagogy doc. If it cannot be made dynamic, remove it from voice entirely.

### 5. Irrelevant sections for voice (Express Lane, Hive State)
Sections 7 (Express Lane) and 8 (Hive State) are developer/collaboration metadata. In a voice session with a student, they add token latency and dilute Daniela's persona.

*Recommendation: Cut both from voice sessions.*

### Recommended ordering for voice sessions

**TOP — Who am I and who are you? (High attention)**
1. `presenceDoc` — Daniela's current mood/state
2. `studentSnapshot` — ACTFL level, struggles, facts
3. `journeyContext` — Long-term arc of what we are doing together

**MIDDLE — Reference library (Low attention / ideal for Cached Content)**
4. `pedagogyDocContext` (40k — load via Cached Content API)
5. `courseTOC` (cleaned of UUIDs)
6. `curriculumContext`

**BOTTOM — Immediate reality (Highest attention / recency bias)**
7. `textbookReadingContext` — What the student just read
8. `recentVoiceSummary` — What we talked about last time
9. `growthMemory` + `personalMemory` — Daniela's recent reflections, right before she speaks

**Remove from voice:** `expressLaneContext`, `hiveContext`, `neuralNetworkContext` (unless query is made dynamic)

---

## Target 3: System Prompt Section Formatting

> "You are currently formatting a machine-readable system prompt as if it were a human-readable 1990s bulletin board."

### 1. === section delimiters
**Finding: Visual noise, mechanically weak.**

A string of `=====` compresses to a few tokens but lacks structural strictness. In a 40k-token prompt, attention has to loosely associate the top `===` with the bottom `===`. Much harder to isolate context than with hierarchical structures like XML.

### 2. Emoji in headers
**Finding: Neutral, slight token bloat. Not useful in voice.**

Emojis do not increase the semantic weight of a section. In voice, they are just extra tokens processed and discarded as irrelevant to audio output. They are useful for the developer reading the code — not for the model.

### 3. Inline meta-commentary `[This is your own orientation — use it to arrive grounded...]`
**Finding: Blurs context vs. instruction. Causes instruction drift.**

Embedding instructions inside context blocks forces constant processing-mode switching between "reading passive data" and "updating active behavioral constraints." Instructions on *how* to use the data should appear *before* the data, not embedded inside it.

### 4. Section title parentheticals
**Finding: Mostly clutter.**

- `(auto-updated every 30min)` — The model has no continuous sense of time between turns. Meaningless without a current timestamp.
- `(Full brief + key roadmap source sections. Read this to evaluate...)` — Behavioral instructions in a title parenthetical weaken the instruction. Titles should declare what the data *is*; separate instructions should say what to *do*.

### Recommended format: XML with separated instructions/data

Drop ASCII formatting. Use XML tags — Gemini models are heavily trained to parse XML for tool use, system instructions, and context isolation. XML provides strict, unambiguous bounding boxes around large text blocks.

```xml
<section name="student_context">
  <instructions>
    Use this to arrive grounded. Incorporate these facts naturally into conversation.
  </instructions>
  <data>
    ACTFL Level: Intermediate Mid
    - Personal fact 1
    - Personal fact 2
  </data>
</section>

<section name="pedagogy_foundation">
  <instructions>
    Evaluate the student's input against the 8 seeded principles below.
  </instructions>
  <data>
    [Cached content block — 40k tokens]
  </data>
</section>
```

Benefits: absolute section boundaries, instructions cleanly separated from data, strips visual noise, saves tokens.

---

## Target 4: Tool Declarations

> "When you give a model 130+ tools and expect it to manage conversational flow, vocal inflections, long-term memory, and UI state simultaneously, every byte of ambiguity costs you latency and reliability."

### 1. Ambiguous overlaps
- **`log_struggle` vs `syllabus_progress {status: struggling}`:** No clear boundary between a localized syntax struggle and a syllabus topic failure. Model will pick one at random or call both redundantly.
- **`phase_shift {to: drill}` vs `trigger_drill`:** If moving the student into a drill, unclear whether to call one, the other, or both.

### 2. `actfl_update` vs `set_actfl_level`
Descriptions distinguish "incremental" vs "baseline" — semantically okay — but implementation is flawed:
- `set_actfl_level` enforces an enum for `level`. `actfl_update` only asks for `level: string`. At inference, `actfl_update` will produce hallucinated format strings ("Novice-Low" vs "novice_low").
- Both names contain `actfl` + an update verb — high collision risk in a 130-tool list.

*Fix:* Add the same enum to `actfl_update.level`. Rename to `log_actfl_progress` and `finalize_actfl_placement`.

### 3. `speak_as` / `resume_tutor` pattern
**Finding: Highly brittle in live voice.**

State management using explicit toggle tools breaks under interruption. If the student interrupts mid-character turn, the next turn may omit `resume_tutor`, continue the character voice, or call `resume_tutor` but generate character-register text anyway.

*Fix:* Single-turn scoped tool: `speak_character_line(character_id, text, voice_gender)`. When the turn ends, the system prompt re-establishes Daniela automatically. Do not make the model manually toggle its core persona on and off.

### 4. The `text` parameter convention
**Finding: Detrimental to voice latency and response quality.**

For Flash Live to stream audio quickly, it needs raw text tokens immediately. Wrapping dialogue inside JSON arguments delays TTS synthesis until the schema parses. When the attention mechanism is simultaneously constructing JSON schema, evaluating enums, AND writing dialogue, the dialogue degrades to terse/generic responses ("Okay, let me check.").

Also: `phase_shift` has `text` described as required in the description but omitted from the `required` array — unpredictable behavior.

*Fix:* Decouple speech from action. Let Flash speak naturally in standard text generation and emit tool calls as non-blocking parallel events. Remove `text` from `voice_adjust`, `check_student_credits`, `phase_shift`.

### 5. Tool count degradation
**Quality drops sharply around 30-40 complex tools.** With 130:
1. Tool schemas consume too much attention — Daniela's persona nuance degrades
2. Flash gravitates to a familiar cluster of 10-15 tools and ignores the rest
3. Parameter hallucination — Flash mixes args from adjacent tools (passing `emotion` from `voice_adjust` into `speak_as`)

### 6. Additional overlaps
- `show_vocabulary_image` vs `add_whiteboard_item`: both push visual content to the student's screen — unclear when to use which
- `save_personal_fact` + `log_struggle` often need to fire together — model will typically only pick one

### Consolidation recommendations
1. **Dynamic tool loading:** 15 global tools always active; phase-specific tools swap in on `phase_shift` trigger
2. **Decouple speech from action:** Remove `text` from tool schemas; speech is generated naturally
3. **Merge:** `log_struggle` + `syllabus_progress` → `update_student_profile(aspect, status, evidence)`
4. **Merge:** `show_vocabulary_image` + `add_whiteboard_item` → `update_screen(display_type, content)`
5. **Fix:** Add enum constraint to `actfl_update.level`; rename both ACTFL tools

---

## Summary — Priority Actions

| Priority | Finding | Location |
|----------|---------|----------|
| HIGH | Remove VOICE_PACING directive — causes robotic filler, doesn't help latency | gemini-live-session.ts |
| HIGH | Drop thinkingConfig to MEDIUM — HIGH is hostile to voice TTFT | gemini-live-session.ts |
| HIGH | Reduce silenceDurationMs 2500→1500, END_SENSITIVITY→MEDIUM | gemini-live-session.ts |
| HIGH | Reorder context: student data TOP + BOTTOM, pedagogy in middle | unified-daniela-context-service.ts |
| HIGH | Remove expressLaneContext + hiveContext from voice sessions | unified-daniela-context-service.ts |
| HIGH | Fix `actfl_update.level` — add enum (currently just `string`, hallucination risk) | daniela-function-registry.ts |
| HIGH | Fix `speak_as`/`resume_tutor` → single-call `speak_character_line` | daniela-function-registry.ts |
| MEDIUM | Remove accent text directive — speechConfig already handles acoustic accent | gemini-live-session.ts |
| MEDIUM | Replace === section delimiters with XML tags | unified-daniela-context-service.ts |
| MEDIUM | Decouple `text` from tool schemas — speech should be generated naturally | daniela-function-registry.ts |
| MEDIUM | Clarify `phase_shift` vs `trigger_drill` boundary in descriptions | daniela-function-registry.ts |
| MEDIUM | Clarify `log_struggle` vs `syllabus_progress {status:struggling}` boundary | daniela-function-registry.ts |
| LOW | Dynamic tool loading by phase (architectural — large effort) | architecture |
| LOW | Load pedagogy doc via Cached Content API | unified-daniela-context-service.ts |
| LOW | Make neural net query dynamic per-session conversation context | unified-daniela-context-service.ts |

*No production files were modified by this audit. Apply fixes individually with testing.*

---

*Generated by `scripts/gemini-audit.ts` — gemini-3.1-pro-preview — June 12, 2026*
