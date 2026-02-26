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

## Open Questions for Next Session

1. What should the platform be called? (The school needs a name)
2. Which subject for the first POC tutor — biology, chemistry, or something else?
3. What is the tutor persona for that subject — name, personality, teaching style?
4. What does "competency" look like for that subject (the ACTFL equivalent)?
