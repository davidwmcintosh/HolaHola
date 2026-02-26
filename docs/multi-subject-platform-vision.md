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

## Open Questions

1. What should the platform be called? (The school needs a name)
2. Which tutor goes first in the POC — Gene, Evelyn, Clio, or Marcus?
