# HolaHola Curriculum Strategy
## Consolidated Reference Document

**Supersedes:** `interactive-textbook-spec.md`, `interactive-textbook.md`, `syllabus-template-kit.md`, `class-model-rethink.md`, `class-audit.md`  
**Last Updated:** March 11, 2026  
**Status:** In Review — no active build work should start until decisions in Section 4 are made.

---

## 1. What Exists Today (Honest Inventory)

### What's Built and Working

| Component | Status | Notes |
|-----------|--------|-------|
| 9-language curriculum (5 levels each) | Working | 45 curriculum paths, 1,300 lessons |
| Voice sessions with Daniela | Core product, working well | The thing users actually come for |
| Interactive Textbook page | Built, underutilized | Reading library with chapter nav |
| textbook_lesson_content | Seeded for all 1,300 lessons | March 2026 bulk seed complete |
| Drills (listen/repeat, translate/speak, etc.) | 187K+ drills, working | Coverage is wide but shallow |
| OER enrichment pipeline | Built, ran once | Limited real-world impact (see Section 2) |
| Pronunciation drills (numbers) | 513 intermediate drills added Jan 2026 | Good expansion |
| Lyra (AI curriculum reviewer) | Exists, monitoring | Has not caught major quality issues |
| Curriculum audit script | Built March 2026 | `server/scripts/curriculum-audit.ts` |

### What's Partially Built

| Component | Status | Gap |
|-----------|--------|-----|
| Rhythm drills | `RhythmDrill.tsx` now wired into `VisualLessonCard` in `TextbookChapterView` — shows as inline "Rhythm Practice" toggle for vocabulary/drill lessons that have drills | Auto-collapses on 70%+ score; pronunciation eval is still mocked (no real STT scoring pipeline) |
| Infographics | `TextbookInfographics.tsx` — 1,079 lines, 15+ components, used in `ChapterIntroduction` and `TextbookChapterView` | Working for some lesson types; not all lesson types trigger an infographic |
| Chapter Recap | `ChapterRecap.tsx` exists and is imported in `TextbookChapterView` | Built — verify content quality in practice |
| Mind map integration with textbook | Planned, not connected | Textbook progress doesn't flow to mind map nodes |
| Visual assets library | Designed in spec | `curriculum_assets` table never created; no asset pipeline exists |
| Whiteboard ↔ textbook connection | `TextbookWhiteboardBridge.tsx` exists, imported nowhere | Component built, not wired into any page |
| Recommendation queue (Daniela → student) | `danielaRecommendations` table + storage methods exist | No student-facing UI to surface these recommendations |
| Session compass (pacing service) | `session-compass-service.ts` exists — gives Daniela clock, syllabus visibility, pacing context | Backend service only; no student-visible roadmap widget |

### What's Not Started Despite Being In Specs

**Curriculum/textbook:**
- Asian language production drills (translate/speak in Japanese/Korean/Mandarin)
- Prosody/shadowing drills
- Teacher content authoring for textbook
- Offline access

**Voice session experience:**
- Confidence check-ins mid-session (tap-to-rate after activities) — student-facing; `alden-checkin-service.ts` is founder-focused and does not cover this
- Student-visible session roadmap widget — `session-compass-service.ts` gives Daniela pacing context but there is no UI widget the student sees
- Daniela referencing teacher commitments/promises during sessions

**Class management:**
- UI for teachers to choose bundle vs custom class when creating
- Audit of which existing classes should be converted to bundles
- Adaptive recommendation engine (remediation / reinforcement / acceleration based on time tracking)
- Premium upsell flow for optional_premium tier content
- "Challenge Moments" style descriptions in lesson previews

---

## 2. What the March 2026 Audit Found

### The Source Enrichment Was Largely Ineffective

We ran an OER enrichment pipeline (Wiktionary + Tatoeba + Wikivoyage) against all 1,300 lessons. Results across Spanish (representative of all languages):

| Source | Hit rate | Why low |
|--------|----------|---------|
| Wiktionary | 1% | Confirmed existing words; didn't add missing content |
| Tatoeba | 4% | Only useful for concrete vocabulary lessons |
| Wikivoyage | 0% | Only useful for travel/location topics |

**Root reason:** ~70% of our lesson types (Grammar Spotlights, Let's Chat conversations, Practice Time drills, Culture Corners) don't map to anything these databases contain. The enrichment validated content that was already there rather than adding new content.

### The Textbook Seeding Added Content But Didn't Fix Core Problems

The 1,300-lesson textbook seed (8.5 hours, completed overnight) correctly generated introduction text, vocabulary lists, grammar explanations, and reading passages for every lesson. But:

- It generated FROM whatever was in the curriculum lessons. If the curriculum data was wrong or incomplete, the textbook content inherits that wrongness.
- Example: "Practice Time: Numbers 0-20" had vocabulary only for 0-10 (eleven through twenty missing). The seed faithfully produced a lesson about numbers that didn't teach numbers 11-20. Fixed manually March 2026.
- This pattern likely exists across the curriculum at unknown scale.

### Audit: Known Issues Across All 1,300 Lessons

Run `npx tsx server/scripts/curriculum-audit.ts` for live results. As of March 2026:

| Issue type | Count | Notes |
|------------|-------|-------|
| Objective/vocabulary mismatches | ~414 flagged | Many are false positives from word "ten" in objectives; real count unknown |
| Near-duplicate drills in same unit | 27 | Mandarin 2 has the most — "Let's Chat" lessons with same English prefix |
| Missing textbook content | 1 (Los Números, now fixed) | Run audit again to verify zero |
| Weak drills (<5 vocab items) | 0 flagged | Audit threshold may be wrong |

### Lyra Missed All of This

Lyra runs content audits every 12 hours. She found 0 content quality issues in her most recent run while the March 2026 manual audit found 442 total flags. This is a gap in Lyra's audit criteria — she checks for stale/empty/missing ACTFL metadata but not for objective-vocabulary alignment or duplicate lesson content.

### Drill Audit: Daniela's Jan 19, 2026 Review

Full thread in `docs/drill-audit-for-daniela.md`. Daniela reviewed the then-current drill inventory and gave five prioritized recommendations. This is where we stand on each as of March 2026:

**Priority 1 — Level Up Numbers** ✅ Done  
Two scripts built and run: `add-intermediate-number-drills.ts` and `add-advanced-number-drills.ts`. Result: 279 drills at intermediate_low + 234 at intermediate_mid across all 9 languages (513 total). Numbers 21–1000+ are now covered.

**Priority 2 — Asian Production Drills (translate_speak with phonetic aids)** ⚠️ Half done  
`boost-drill-variety.ts` (Jan 26) ran and added `translate_speak` drills for Japanese, Korean, and Mandarin. But Daniela specifically asked for romaji/pinyin/hangeul phonetic training aids embedded in the drill prompts to help production. The script generates standard prompts without them. Better than zero, not the designed solution.

**Priority 3 — Prosody/Shadowing Drills** ❌ Not started  
No shadowing drill type was ever created. No database entries. The concept exists only in the audit doc. This is the highest-impact gap that touches the non-numbers curriculum.

**Secondary — Matching Drill Expansion** ⚠️ Partially done  
Daniela flagged matching at 155 drills as insufficient (she said 300+ minimum). Currently at 285. Closer, but `boost-drill-variety.ts` didn't fully close it.

**Secondary — Sentence Transformation (Advanced)** ❌ Not started  
Daniela requested transformation drills for level 4–5 learners as a bridge to production fluency. Zero built.

**RhythmDrill Component Status** — previously built but unattached  
`RhythmDrill.tsx` was clearly built in response to Daniela's numbers-rhythm concept. As of March 2026, it is now wired into `VisualLessonCard` in `TextbookChapterView` for vocabulary and drill lesson types. It renders inline when a section has drills, with a "Rhythm Practice" toggle button. Auto-collapses when the student scores ≥70%. The pronunciation evaluation inside is still mocked — real STT scoring would require connecting to the Deepgram pipeline.

---

## 3. The Core Problem (Stated Plainly)

The curriculum was built top-down: structure first (units, lesson types, lesson names), then content filled in (vocabulary, objectives), then enrichment attempted on top. Each layer assumed the layer below was solid.

**It wasn't.** The vocabulary lists are inconsistent. Objectives don't always match content. Lesson types that sound different (Let's Chat: Airport vs Let's Chat: Hotel) can be nearly identical in structure. No human reviewed the 1,300 lessons before seeding textbook content into all of them.

The result is a large, complete-looking curriculum that has real quality gaps distributed unevenly and invisibly across it.

**The enrichment, seeding, and Lyra were all treatments applied to a patient without a diagnosis first.**

---

## 3b. Architecture Principles That Are Working (Keep These)

These are settled decisions from December 2025 that are implemented and should not be revisited.

### WHAT vs HOW

The syllabus is a **student-facing comfort tool** (WHAT). It shows students what they'll learn in language that feels inviting and human. It does not prescribe how Daniela teaches.

Daniela's neural network handles HOW — when and how to deploy drills, which tools to use, how to adapt mid-session. All pedagogical methodology lives there, not in the syllabus.

This means: syllabus items should never name specific drill types or tool invocations. They describe topics, not techniques.

### Brain Map and Linear Syllabus View Must Not Diverge

Both views are driven from the same underlying bundle-aware data model. If they show different progress states, something is broken. This is an invariant, not a preference.

### Content Requirement Tiers

Every lesson has a `requirementTier` field:

| Tier | Meaning | Can skip? | Fee? |
|------|---------|-----------|------|
| `required` | Core lesson, must complete to progress | No | Included |
| `recommended` | Suggested reinforcement (extra drills, practice) | Yes | Included |
| `optional_premium` | Extra help for students who want more | Yes | Additional fee |

### Bundle System

A bundle = one conversation lesson paired with a linked drill lesson, created together and linked via `bundleId` and `linkedDrillLessonId`. Built December 2025 with idempotent management script at `server/scripts/bundle-management.ts`.

Use cases by institution:

| Institution | Class type |
|-------------|-----------|
| ASU (conversation lab) | Conversation-only custom class |
| High school supplement | Conversation-only custom class |
| Self-directed learner | Bundle-based (conversation + linked drill) |
| Corporate training | Custom mix of bundles |

### Unified Label System (Implemented Dec 2025)

All three views (Syllabus, Mind Map, Activity Pills) use consistent terminology:

| Content Type | Syllabus prefix | Mind Map lobe | Activity pill |
|-------------|-----------------|---------------|---------------|
| Conversation | `Let's Chat:` | Chat! | Chat |
| Drill/Practice | `Practice Time:` | Practice! | Practice |
| Vocabulary | `New Words:` | Words! | Memorize |
| Culture | `Culture Corner:` | Culture! | Culture |
| Grammar | `Grammar Spotlight:` | Grammar! | — |

426 lessons across 17 curricula were transformed to this format in December 2025.

---

## 4. Strategic Decisions That Need to Be Made

These questions are unresolved. No build work should start until they're answered.

### Decision 1: Fix forward or rebuild the curriculum data?

**Option A — Fix forward (targeted repairs)**  
Run the audit, triage the real issues, fix the worst lessons manually or with targeted re-seeding. Accept that some lessons will remain imperfect. Prioritize Spanish 1-2 since that's where real users are.

*Pro:* Fast. Keeps all 1,300 lessons.  
*Con:* Doesn't address systemic issues. We'll keep finding new problems.

**Option B — Rebuild curriculum data from source**  
For each lesson, go back to first principles: what should a student learn here, what vocabulary does that require, what grammar does it use? Generate vocabulary lists and objectives from scratch using a better prompt, with human review of a sample.

*Pro:* Fixes the root cause. Content quality becomes reliable.  
*Con:* Slow. Requires either significant AI compute or human review time.

**Option C — Accept the curriculum as reference structure, not content**  
Stop treating `required_vocabulary`, `objectives`, and `required_grammar` as authoritative. Use them only for structure (unit names, lesson order, lesson types). Generate all student-facing content purely from the textbook layer using lesson name + unit context as the only prompt input.

*Pro:* Bypasses the bad curriculum data entirely for student-facing content.  
*Con:* Requires re-seeding all 1,300 textbook lessons with better prompts. Loses whatever good data the curriculum has.

---

### Decision 2: What is the textbook actually for?

Right now we have two overlapping things:
- The **reading library** (OpenStax-based modules, generated on demand per topic click)
- The **interactive textbook** (curriculum-driven, lesson-by-lesson, `textbook_lesson_content` table)

These are not the same thing and serve different purposes, but students and the team have not always been clear on the distinction.

**Option A — Reading library is the textbook**  
The OpenStax-powered reading library IS the textbook. It's comprehensive, sources-backed, and generates on demand. Remove or de-emphasize the curriculum-driven textbook. Focus investment on making reading library chapters better.

**Option B — Curriculum textbook is the textbook**  
The `textbook_lesson_content` table is the authoritative textbook. The reading library is supplemental academic reading. Invest in making curriculum textbook content higher quality.

**Option C — They serve different roles, both stay**  
Reading library = deep academic reference (like a textbook you'd read before class)  
Curriculum textbook = lesson companion (what you review right before/after a voice session)  
These are complementary; make the distinction clear in the UI.

---

### Decision 3: What's the learning model for individual (non-school) users?

From `class-model-rethink.md`, this was unresolved as of January 2026 and remains unresolved:

| Option | Model | What you sell |
|--------|-------|---------------|
| A | Interactive textbook + flexible voice | Textbook access + voice hours |
| B | HolaHola public classes (recreate 27) | Class enrollment + voice hours |
| C | Voice only, no textbook/classes | Voice hour packages |
| D | Textbook + voice, no public classes | Subscription for both |

Schools need structured classes (non-negotiable for auditors/state standards). The question is only about individual learners. **This decision drives everything else** — infographics, rhythm drills, visual assets, chapter recaps only matter if the textbook is the primary learning surface for individuals.

---

### Decision 4: Should Lyra be given curriculum audit criteria?

Lyra currently checks:
- Stale content (not recently generated)
- Empty content fields
- Missing ACTFL metadata

Lyra does NOT check:
- Objective/vocabulary alignment
- Duplicate lessons within units
- Source hit rates
- Vocabulary completeness relative to objectives

Should we update Lyra's audit criteria to catch these? The audit script exists — it just needs to be plugged into Lyra's monitoring loop.

---

## 5. What Was Decided and Completed (History)

| Date | Decision | Outcome |
|------|----------|---------|
| Dec 2025 | Bundle data model | Done — `bundleId`, `linkedDrillLessonId`, `requirementTier`, `commitments` fields added to curriculum schema |
| Dec 2025 | Shared progress API | Done — brain map and linear view consume same data; Daniela's observations included |
| Dec 2025 | Bundle management script | Done — `server/scripts/bundle-management.ts` (idempotent) |
| Dec 2025 | Unified label system | Done — 426 lessons across 17 curricula transformed; mind map lobes and activity pills aligned |
| Dec 2025 | Time tracking display | Done — estimated vs actual time per unit visible |
| Dec 2025 | Skip/mark-complete for non-required content | Done — `requirementTier` drives UI behavior |
| Jan 2026 | Add 513 intermediate number drills | Done — numbers 21-1000+ added across all 9 languages |
| Jan 2026 | Build Interactive Textbook page | Done — chapter nav and reading modules working |
| Jan 2026 | Syllabus template kit (engaging labels) | Done — auto-prefills implemented in lesson creator |
| Feb 2026 | OER enrichment pipeline (Wiktionary/Tatoeba/Wikivoyage) | Done — ran on 1,300 lessons; limited real-world impact |
| Mar 2026 | Bulk textbook seed all 1,300 lessons | Done — all seeded overnight |
| Mar 2026 | Curriculum audit script | Done — `server/scripts/curriculum-audit.ts` |
| Mar 2026 | Single-lesson re-seed endpoint | Done — `POST /api/internal/textbook/seed-lesson` |
| Mar 2026 | Fix Los Números 0-10 → 0-20 | Done — re-seeded with correct vocabulary |
| Mar 2026 | Wire RhythmDrill into textbook | Done — `RhythmDrill` renders inline in `VisualLessonCard` for vocabulary/drill lessons; toggle button, auto-collapse on ≥70% score; STT scoring still mocked |
| Mar 2026 | Drill audit findings added to curriculum-strategy.md | Done — Daniela's Jan 19 recommendations tracked with current status; two open gaps (shadowing, sentence transformation) documented |

---

## 6. Recommendations Before Next Build Sprint

1. **Run the audit, triage manually.** The 414 flagged objective mismatches need a human to separate real problems from false positives. Realistic estimate: 30-50 genuinely broken lessons in Spanish 1-2 that students actually see.

2. **Answer Decision 3 (learning model) first.** Everything else — infographics, rhythm drills, visual assets — only makes sense once you know whether individuals learn through the textbook or through voice sessions. Building infographics for a textbook that might not be the primary surface is wasted effort.

3. **Give Lyra the audit criteria.** Once decisions are made, Lyra should be catching objective/vocabulary mismatches automatically. The audit script can become her curriculum health check.

4. **Don't start a new seeding project** until the curriculum data quality question (Decision 1) is resolved. Another seeding run on broken input produces better-looking broken output.

---

## 7. Archived Docs (Superseded)

These files can be deleted or kept for reference. Their content has been consolidated here:

- `docs/interactive-textbook-spec.md` — Functional spec, phases 1-3 complete, remaining work captured in Section 1 above
- `docs/interactive-textbook.md` — Architecture doc + drill audit findings, captured above
- `docs/syllabus-template-kit.md` — Label conventions and bundle creation API, implemented and stable, no open items
- `docs/class-model-rethink.md` — Decision framework captured in Decision 3 above
- `docs/class-audit.md` — December 2025 discussion session; architecture principles (WHAT vs HOW, brain map invariant), bundle system, content tiers, and unified labels all captured in Section 3b; remaining action items captured in Section 1 (What's Not Started)
