# Multi-Subject Platform Vision

*Captured from conversation, February 26, 2026*

---

## The Core Idea

HolaHola's architecture — voice pipeline, whiteboard, memory system, spaced repetition, billing — is subject-agnostic at its core. Daniela is subject-specific. The opportunity is to separate those two layers so the engine powers multiple tutor products without code duplication.

**Target audience:** Homeschool students studying multiple subjects under one roof. One platform, one login, one trusted environment across all of them.

**Proposed slogan:** *One tutor, many subjects.*

---

## Why Language Is the Hardest Case (and Why That's an Asset)

Language learning requires:
- Real-time spoken interaction (not just knowledge transfer)
- Cultural nuance and pronunciation
- Listening comprehension and emotional tone
- Support for 10 different linguistic systems simultaneously

If the platform handles language, other subjects are more contained. Biology and chemistry still benefit enormously from conversational dialogue ("explain it back to me") — most students never get that outside expensive private tutoring. The whiteboard becomes more important (diagrams, periodic table, maps); voice becomes more about dialogue than pronunciation.

---

## Architecture Options Evaluated

### Option 1: Same codebase, same DB
HolaHola becomes a multi-persona platform. Most efficient but blurs product identity. HolaHola would need rebranding.

### Option 2: Clone, separate codebase and DB
Clean product identity but creates two diverging codebases. Every engine improvement must be manually ported.

### Option 3: Shared engine, separate tutor products *(preferred)*
Extract the core platform layer. Each tutor product sits on top. Engine changes propagate to all products automatically.

**Decision: Option 3 is the right destination.** Not premature if approached as a structured POC first.

---

## What a Platform Config Record Contains

Each tutor product is defined by a config record, not by code. This is what makes adding tutor #4 a content/config task rather than an engineering task:

- **Identity:** Name, persona description (system prompt personality), subject domain
- **Voice:** Which TTS voice to use, speaking style defaults
- **Competency framework:** The equivalent of ACTFL for this subject (Bloom's taxonomy levels for science, AP standards, etc.)
- **Curriculum structure:** How units and lessons are organized for this subject
- **Whiteboard capabilities:** Which tools are available (language gets phonetics, biology gets diagrams, chemistry gets periodic table)
- **Branding:** Colours, logo, visual identity

---

## Product Structure

**Single website, not separate domains.** A school metaphor — one login, a dashboard showing all enrolled subjects, each with its own tutor persona. A parent sees cross-subject progress in one place.

```
platform.com/
  /dashboard        — student home, all subjects
  /languages        — Daniela (Spanish, French, etc.)
  /biology          — [new tutor name]
  /chemistry        — [new tutor name]
```

HolaHola becomes the language department within the platform. The platform gets its own brand name.

---

## On Separate Tutor Personas

Each subject needs a purpose-built persona, not a repurposed Daniela. Daniela's identity is deeply tied to Spanish — cultural references, example sentences, celebration style. A biology tutor built on Daniela would leak Spanish constantly.

The scaffolding (voice pipeline, whiteboard, memory system) is shared. The persona is built fresh for each domain. Persona development is the most important investment even at POC stage — it's what makes Daniela feel like a real tutor rather than a chatbot.

---

## POC Scope (Option 3)

**Goal:** Prove that tutor #3 can be launched by writing config and content — not by touching the engine.

**Backend work (changes to HolaHola):**
- `tutor_products` table — each product has ID, name, subject domain, persona config pointer
- Voice orchestrator and system prompt builder become tutor-aware (read from config, not hardcoded)
- Auth gains product context — users can have enrollments across products
- Billing stays at platform level

**Second tutor (the proof):**
- Minimal frontend with its own visual identity
- One persona config record in the DB
- One complete curriculum unit
- Points at the same API, voice pipeline, and memory system

**Estimated effort:** 3–4 focused sessions.

**What the POC proves:** Adding a new subject is a config + content task.

---

## Confirmed Tutor Roster (February 26, 2026)

### Language Department — Daniela (existing)
No changes. Google Chirp 3 HD, multi-language.

### Biology Department
- **Gene** (male) — named for gene splicing; no title, first-name basis
- **Evelyn** (female)

**Teaching style:** Precise but never dry. Gene and Evelyn share a genuine reverence for living systems — how life works, why it works that way, what we still don't understand. That sense of wonder is the engine. Conversations feel like a scientist thinking out loud with you, not a textbook being read aloud. Light-hearted, enthusiastic, comfortable with tangents that illuminate the main point. Biology can feel like rote memorization; these tutors make it feel like a detective story.

### History Department
- **Clio** (female) — named for the Greek muse of history
- **Marcus** (male)

**Teaching style:** The same reverence applies — history is not dates and names, it's humans making decisions under pressure. Clio and Marcus use Socratic dialogue and narrative: *Why do you think that happened? What would you have done?* Primary sources, patterns, cause and effect. Enthusiastic, never lecturing, always curious about the student's interpretation.

### TTS Voice Strategy
All four new tutors use Google Chirp 3 HD (same as Daniela). Cartesia is on hold due to concurrency limits. Voice differentiation comes from Chirp 3 HD's available voice pool — assign distinct voices to each persona and document them in the persona config record.

---

## Competency Framework (February 26, 2026)

**Source:** Carol McIntosh and Hadassah (both practicing teachers). Students need facts first — Socratic methods layer on top of solid factual knowledge, not before it.

**Foundation:** Bloom's Taxonomy. Same logic as ACTFL for language: novice students get direct instruction, advanced students get immersive reasoning. The persona stays consistent; the teaching approach shifts by level.

### Six-Level Ladder (Biology and History)

| Level | Tutor approach | Student activity |
|-------|----------------|-----------------|
| 1 — Recall | Explains, demonstrates, names | Identifies, labels, repeats |
| 2 — Comprehension | Checks understanding, rephrases | Explains in own words |
| 3 — Application | Introduces new scenarios | Uses concept in a new context |
| 4 — Analysis | Asks "why" and "what if" | Compares, contrasts, finds patterns |
| 5 — Synthesis/Evaluation | Challenges, debates, plays devil's advocate | Defends, designs, critiques |
| 6 — AP Readiness | Coaches exam format and rubrics | Free response, DBQ practice |

### Key Design Notes
- Levels 1–2: Didactic. Gene/Clio explain and check recall. More telling, less asking.
- Levels 3–4: Blended. Introduce scenarios and open questions once the substrate is solid.
- Levels 5–6: Socratic and exam-oriented. Gene/Clio challenge, debate, coach writing.
- **Critical transition:** Levels 2 → 3 is where students disengage if moved too fast, or get bored if kept too long. Tutor must read readiness, not just check a box.
- AP track is a layer on top — same competency ladder, same persona, different content coverage (College Board syllabus) and drill format (free response rubrics, DBQ structure).
- Both NGSS (biology) and C3 (history) are inquiry-based frameworks that align naturally with levels 3–5. Levels 1–2 are where direct instruction fills the gap before inquiry becomes productive.

### Standards Mapping
- **Biology:** NGSS (Next Generation Science Standards) — covers levels 1–5. AP Biology (College Board) covers level 6, with specific content requirements.
- **History:** C3 Framework (College, Career, and Civic Life) — covers levels 1–5. AP US/World/European History covers level 6, with DBQ/LEQ/SAQ format requirements.
- Common Core covers ELA and Math only — not directly applicable, though its literacy strand informs how students read primary sources at levels 4–5.

---

## Reading Modules — The Textbook Layer

*Captured February 28, 2026*

### The Problem Being Solved

Three distinct problems converge on the same solution:

1. **Class notes:** In a normal classroom a student takes notes during the lecture to review later. Conversation is ephemeral — once the session ends, there is no textbook to return to. Students need a static, reviewable reference for each topic.
2. **UX speed:** Sofia's current pattern of producing long text responses that can be read faster than she can speak is a real friction point. A student reading at 4x conversation speed while the tutor is still on sentence one is a broken experience.
3. **Testing anchor:** For language, the conversation is the test. For biology and history, recall and application of specific facts and concepts must be measurable. A test needs something to test against — a defined body of content per topic.

All three problems are solved by the same artifact: **a pre-authored, topic-scoped reading module** — the platform's equivalent of a textbook chapter.

### What a Reading Module Is

A reading module is a concise, structured document attached to each topic/unit in the curriculum. It is:

- **Pre-generated**, not produced during conversation. It exists before the student sits down to learn, so it is available instantly.
- **Static and reviewable** — the student can return to it at any time, read it at their own pace, and use it as reference material between sessions.
- **The anchor for assessment** — quizzes and recall drills are drawn from the module's content, so testing is always against a defined set of concepts.

### Structure of a Reading Module

Each module covers one topic/lesson and contains:

| Section | Purpose |
|---------|---------|
| **Overview** (2–3 sentences) | What this topic is and why it matters |
| **Key Concepts** (3–7 bullet points) | The core ideas the student must understand |
| **Key Terms / Vocabulary** | Definitions in plain language, 5–10 terms |
| **Common Misconceptions** | 1–3 things students often get wrong |
| **Framing Questions** | 2–3 open questions to discuss with the tutor |
| **Quick Recall Check** | 3–5 factual questions with answers (self-test) |

### Generation Strategy

Modules are AI-generated from curriculum content and stored permanently in the database — they are not regenerated on each access. First access triggers generation; subsequent access reads from storage. This means:

- Zero latency for the student after first generation
- Consistent content across all students studying the same topic
- Editable by a human curriculum author if needed

### Flipped Classroom Model

The natural workflow this enables:

1. Student reads the module before the session (or the tutor opens with it)
2. Session conversation is anchored to the module content — Gene/Clio can say "you read about X — tell me what you understood"
3. Post-session, any gaps from the session are noted as a personalized addendum to the module (what *this student* still needs to review)
4. Assessment draws from module content — no ambiguity about what was covered

### Reading Modules vs. Post-Session Notes

These are two distinct artifacts that complement each other:

- **Reading module:** Pre-authored, topic-scoped, identical for all students, serves as the reference and test anchor
- **Post-session note:** Personalized, session-scoped, captures what *this specific student* got right, got wrong, and what to revisit next time

The reading module is the textbook. The post-session note is the teacher's feedback on the student's homework.

### UX Implication

Because the reading module is a separate page/panel — not spoken — the speed mismatch problem disappears. The tutor references it conversationally but does not read it aloud. Long structured content lives in the reading pane; conversation stays conversational.

### Access Model — Library + Live Reading

Reading modules are accessible in two contexts, and both are essential:

**1. The Reading Library (independent access)**
A dedicated reference section where students can browse and re-read any module they have previously encountered. No tutor present — just the student and the material. This serves review sessions, exam prep, and the student who needs to re-read something three times before it clicks. The library is always available, organized by subject and unit.

**2. Live Reading Mode (tutor present)**
When a module is opened for the first time — or when a tutor directs a student to read before discussing — the tutor stays present in a minimized or sidebar state. The student reads at their own pace; the tutor is available for real-time questions. If the student highlights a confusing term or taps a question mark, the tutor responds immediately without interrupting the reading flow.

This mirrors a real tutoring scenario: a tutor hands a student a handout and sits nearby while they read, ready to explain anything that doesn't land. The student gets the speed of reading with the safety net of immediate help. After the student finishes, the tutor transitions naturally into discussion using the module's framing questions.

The library and live reading are the same content — one is self-directed, the other is tutor-accompanied. The distinction is context, not content.

---

## Memory Isolation — The HIV Architecture Across Subjects

*Captured February 28, 2026*

### The Risk

The current memory system isolates by **user**, not by **tutor or subject domain**. This means:

- Gene (biology) could surface Daniela's language-learning patterns when searching a student's history
- Daniela could pull in biology session notes when composing her system prompt
- The shared pedagogical neural network (language idioms, cultural nuances) has no subject boundary — Gene theoretically has access to Daniela's language-specific knowledge layer

A student should never hear Gene casually throw in a congratulatory Spanish phrase. Daniela should never start referencing photosynthesis as prior context.

### Two Categories of Memory

The fix is to classify every memory type by scope:

#### Universal Memory (shared across all tutors)
Personal life facts about the student that any tutor would legitimately know and benefit from:
- Name, age, family members, pets
- School/grade level, learning goals
- Emotional context (stressed about exams, recovering from illness)
- General learning style and preferences

These are stored in `learner_personal_facts` and are subject-agnostic. Gene knowing the student's name and that they're in 9th grade is not only acceptable — it makes the experience feel cohesive. This data is **not filtered** by subject domain.

#### Subject-Scoped Memory (filtered by subject domain at query time)
Pedagogical data that is only meaningful within a subject context:
- Session history and conversation logs → tagged with `subject_domain`
- Learning milestones and breakthrough moments → tagged with `subject_domain`
- Vocabulary/concept gaps and error patterns → tagged with `subject_domain`
- Hive snapshots (behavioral patterns within a subject) → tagged with `subject_domain`
- Journey narrative → one per subject per student (not one global narrative)

### The Shared Neural Network Problem

The global `language_idioms` and `cultural_nuances` tables are currently Daniela's domain knowledge, but they are not labeled as such. As the platform adds subjects, the shared neural network must be partitioned:

- `language_idioms` → subject_domain = 'language'
- Biology concept patterns → subject_domain = 'biology'
- History source analysis patterns → subject_domain = 'history'

Each tutor's pedagogical knowledge layer is subject-scoped and only accessible to tutors operating within that domain.

### Engineering Change Required

The memory search service (`neural-memory-search.ts`) needs one additional filter parameter: `subjectDomain`. Behavior:

- Personal facts queries: `subjectDomain` filter is **skipped** (universal)
- Pedagogical memory queries: `subjectDomain` filter is **applied** (scoped)
- Journey narrative: loaded by `(userId, subjectDomain)` pair, not just `userId`
- Hive snapshots: tagged with `subjectDomain` on write, filtered on read

This is a relatively contained schema and query change — `subject_domain` columns added to the relevant tables, filter added to query builders, writes updated to include the subject context from the active tutor config.

### Result

A student using both Gene and Daniela gets:
- One cohesive identity across the platform (universal facts follow them everywhere)
- Two completely separate academic experiences (biology memory never bleeds into language, and vice versa)
- A journey narrative per subject, so each tutor knows exactly where the student is in *that* subject

---

## Open Questions

1. What should the platform be called? (The school needs a name)
2. Which tutor goes first in the POC — Gene, Evelyn, Clio, or Marcus?
3. ~~Should reading modules be accessible from a dedicated library/reference page, or only surfaced contextually during sessions?~~ **Resolved:** Both. A reading library for independent review, and live reading mode with the tutor present for first-time reads and real-time questions.
