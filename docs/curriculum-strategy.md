# HolaHola Curriculum Strategy
## Consolidated Reference Document

**Supersedes:** `interactive-textbook-spec.md`, `interactive-textbook.md`, `syllabus-template-kit.md`, `class-model-rethink.md`, `class-audit.md`  
**Last Updated:** March 20, 2026  
**Status:** Decisions made — all four open decisions in Section 4 closed March 20, 2026. Build work is unblocked.

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
| Infographics | `TextbookInfographics.tsx` — 1,079 lines, 15+ components, used in `ChapterIntroduction` and `TextbookChapterView` | Working for some lesson types; not all lesson types trigger an infographic. Two categories identified: scene/vocabulary (DALL-E image + text overlay) and grammar/structure (code-generated SVG). See Section 6 for strategy. |
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

## 4. Strategic Decisions — Closed March 20, 2026

All four decisions are now recorded. Build work is unblocked.

---

### Decision 1: Fix forward or rebuild the curriculum data?

**Decision: Option A + Option C hybrid — fix forward on the data layer, bypass on the content layer.**

The curriculum structure (unit names, lesson order, lesson types, lesson names) is treated as authoritative and kept as-is. The curriculum data fields (`required_vocabulary`, `objectives`, `required_grammar`) are treated as advisory, not authoritative. All primary student-facing content in the textbook layer is generated from lesson name + unit context alone — not from the data fields — bypassing quality issues in the underlying curriculum rows.

Targeted repairs continue in parallel: the audit script flags the worst lessons, and the single-lesson re-seed endpoint allows surgical fixes without full re-seeding. But re-seeding all 1,300 lessons is not planned unless a systematic data quality intervention is specifically decided.

*Rationale:* The build work from March 2026 (grammar cards, cultural cards, phonetic guides, word family cards) demonstrates this model in practice — all 9 language card sets generate from lesson title classification, with no dependency on `required_vocabulary` or `required_grammar` fields. The visual reference layer is the primary content surface.

---

### Decision 2: What is the textbook actually for?

**Decision: Option C — both coexist, different roles.**

- **Reading library** (OpenStax-based) = deep academic reference; the thing you read before class or when you want a comprehensive explanation of a grammar concept.
- **Interactive textbook** (curriculum-driven, `textbook_lesson_content` + visual reference cards) = lesson companion; what you review immediately before or after a voice session with Daniela; the chapter introduction visual cards (grammar/cultural/phonetic/word family) are the primary value.

The distinction should eventually be clear in the UI. The interactive textbook's value comes from its tight coupling to lesson progression — not from competing with the reading library on depth.

*Rationale:* The inline visual reference card system (grammar cards, cultural cards, phonetic guides, word family cards, canvas vocab) built across March 2026 only makes sense as a lesson companion. The READ modal has been removed (March 20, 2026) — all content is now rendered inline in `VisualLessonCard`, reinforcing the companion-not-reference model.

---

### Decision 3: What's the learning model for individual (non-school) users?

**Decision: Option A/D — Interactive textbook + voice, subscription model.**

The textbook IS a primary learning surface for individual learners, not just a supplemental reference. The model is:
- Students work through the interactive textbook (visual reference cards, grammar cards, cultural context, phonetic guides, word families) as structured self-study.
- Voice sessions with Daniela are the practice layer — applying what the textbook introduced.
- The subscription covers both textbook access and voice hours.

Schools retain structured classes (non-negotiable for state auditors). Individual learners get textbook + voice as a unified subscription.

*Rationale:* The build work across five sessions (infographics, grammar cards, cultural cards, phonetic guides, word families, canvas vocab — all 9 languages, all complete) constitutes a commitment to the textbook as a primary learning surface. Reversing to voice-only would invalidate this investment. The textbook visual reference system is the most differentiated asset HolaHola has relative to competitors — it should be central, not supplemental.

---

### Decision 4: Should Lyra be given expanded curriculum audit criteria?

**Decision: Yes — both curriculum audit criteria and component coverage monitoring.**

Lyra now has two new monitoring domains added March 20, 2026:

1. **Component Coverage analysis** — reads `docs/textbook-component-coverage.json` on every analysis run. Flags any language with missing or below-threshold card counts. All 9 languages currently show zero gaps (all complete). The manifest is the canonical coverage record; Lyra is the watchdog.

2. **Curriculum audit criteria (next step)** — the `server/scripts/curriculum-audit.ts` script should be wired into Lyra's monitoring loop as a `gatherCurriculumAuditData()` domain, analogous to the existing content audit domain. This would give Lyra visibility into objective/vocabulary mismatches, duplicate lessons within units, and vocabulary completeness. Not yet implemented — scheduled for the next Lyra expansion sprint.

*Rationale:* Lyra caught zero of the 442 flags identified in the March 2026 manual audit. The component coverage domain closes the gap for textbook content completeness. The curriculum audit domain would close the gap for data quality. Both are necessary.

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
| Mar 2026 | Spanish visual reference cards (grammar, cultural, phonetic, word family) | Done — `TextbookGrammarDiagrams.tsx` + `TextbookInfographics.tsx` + `TextbookCulturalCards.tsx` + `TextbookPhoneticGuides.tsx` + `TextbookWordFamilies.tsx`; 46 grammar + 8 cultural + 9 phonetic + 12 word family cards; wired into `ChapterIntroduction.tsx` |
| Mar 2026 | French visual reference cards (all 4 types) | Done — 24 grammar + 7 cultural + 9 phonetic + 10 word family cards |
| Mar 2026 | Portuguese visual reference cards (all 4 types) | Done — 22 grammar + 7 cultural + 9 phonetic + 11 word family cards |
| Mar 2026 | German, Italian, Japanese, Korean, Mandarin, Hebrew visual reference cards | Done — each: 22–24 grammar + 7 cultural + 9 phonetic + 11–12 word family cards |
| Mar 2026 | Canvas vocab Portuguese (all 8 types) | Done — weather/emotions/time/days/body/face/hand/temperature datasets added to `TextbookCanvasCards.tsx`; all 9 languages in one shared file |
| Mar 2026 | classifyGrammarType() 9-language routing + GrammarChapterType enum | Done — `ChapterIntroduction.tsx` classifies any lesson name for any language into the correct card type; 200+ enum values across all 9 languages |
| Mar 20, 2026 | READ modal removed — inline content in VisualLessonCard | Done — `InlineLessonContent` renders `GrammarChapterView` + AI prose inline; `TextbookLessonReader` modal removed from `TextbookChapterView.tsx` |
| Mar 20, 2026 | Coverage manifest created — `docs/textbook-component-coverage.json` | Done — machine-readable 9-language × 5-card-type coverage with Lyra alert thresholds |
| Mar 20, 2026 | Lyra component coverage domain added | Done — `gatherComponentCoverageData()` + `generateComponentCoverageInsights()` wired into `runFullAnalysis()`; reads manifest; flags gaps; stale Spanish-only intro insight removed |
| Mar 20, 2026 | Strategic decisions 1–4 closed | Done — all four open decisions recorded in Section 4 of this document |

---

## 6. Current Status and Next Priorities

**As of March 20, 2026.** All major visual reference card work is complete. The four previous build-blocking recommendations are resolved.

### Resolved Since Last Review

1. ~~**Answer Decision 3 first**~~ — **Done.** Decision 3 closed: textbook + voice is the learning model for individuals. Textbook is a primary surface.

2. ~~**Infographic approach — start small**~~ — **Done at scale.** All 9 languages have complete visual reference card libraries (grammar, cultural, phonetic, word family, canvas vocab). Grammar/structure visual approach (React components, not images) is confirmed as the right pattern and is now live for all languages.

3. ~~**Give Lyra the audit criteria**~~ — **Partially done.** Lyra monitors component coverage (all 9 languages via manifest). Curriculum data quality audit criteria (objective/vocabulary mismatches, duplicate lessons) still needs to be wired into Lyra's monitoring loop — the script exists, it just needs a `gatherCurriculumAuditData()` domain.

4. ~~**Don't seed until Decision 1 is resolved**~~ — **Decision 1 closed.** Bypass model confirmed: generate from lesson title, not curriculum data fields. New seeding should use this model.

### Active Next Priorities

1. **Wire curriculum audit into Lyra.** `server/scripts/curriculum-audit.ts` exists. Lyra needs a `gatherCurriculumAuditData()` domain that runs this logic on her monitoring cycle. Missing 442 real content issues is the highest-severity monitoring gap.

2. **Fix the drill launcher in the textbook.** "Start Drill" logs to console and doesn't navigate. Lyra's UX audit flagged this — it's a broken feature that degrades the textbook-as-primary-surface model.

3. **Pass chapter context to Daniela from the textbook.** When a student clicks "Practice with Daniela" after a textbook chapter, Daniela receives no context about what they studied. Wiring lesson context into the `/chat` navigation is the highest-leverage personalization improvement available.

4. **Asian language production drills.** Translate/speak drills for Japanese, Korean, Mandarin still lack romaji/pinyin/hangeul phonetic aids in their prompts. Daniela specifically flagged this in the January 2026 drill audit.

5. **Shadowing/prosody drills.** Zero built. Highest-impact pronunciation gap across all levels.

6. **Run the curriculum audit, triage manually.** The 414 flagged objective mismatches need a human to separate real problems from false positives. Estimate: 30–50 genuinely broken lessons in Spanish 1-2 that actual users see.

---

## 8. Visual Asset Roadmap

**Full document:** `docs/visual-asset-roadmap.md` (updated March 20, 2026 — includes 9-language coverage matrix)  
**Component coverage manifest:** `docs/textbook-component-coverage.json` (machine-readable, Lyra-monitored)

**Status as of March 20, 2026:** The visual reference card system (the core of the textbook-as-primary-surface model) is complete for all 9 languages. All four types of reference cards — grammar cards, cultural cards, phonetic guides, and word family cards — are wired and rendering for Spanish, French, Portuguese, German, Italian, Japanese, Korean, Mandarin, and Hebrew. Canvas vocab cards (8 types) are complete for all 9 languages.

The roadmap's original eight asset categories remain as the longer-term content roadmap, but the in-code component system is now the primary delivery mechanism:

1. **Core vocabulary images** — concrete nouns and verbs by ACTFL level. Canvas vocab cards cover thematic clusters (weather, emotions, time, days/months, body parts, face, hands, temperature) for all 9 languages — this is the implemented version of this category.

2. **Numbers, time & weather** — canvas vocab cards cover time and weather for all 9 languages. Illustrated watercolor image generation for these concepts is still in the roadmap for the `visual_assets` table.

3. **Grammar structure cards** — complete for all 9 languages. Grammar cards are React/SVG components (not images), rendering conjugation tables, tense comparisons, ser/estar/être/sein decision trees, pitch accent charts, tonal guides, etc. per language.

4. **Preposition maps** — included within the grammar card library for applicable languages. Deep preposition maps (multi-scenario, animated) remain a future extension.

5. **Cultural infographics** — complete for all 9 languages. Cultural cards cover script introductions, world/region maps, gesture guides, festival calendars, formality registers, regional food guides, currency overviews per language.

6. **Word family maps** — complete for all 9 languages. Word family cards show branching root → noun/verb/adjective/adverb forms with example sentences.

7. **False cognate warning cards** — not yet built as a distinct card type. Could be added as a 6th card type in the existing system.

8. **Phonetic/pronunciation guides** — complete for all 9 languages. Phonetic guide cards cover vowel purity, consonant rules, pitch/tone systems, stress patterns, romanization systems (romaji, pinyin, romanization) per language.

### Batch generation order
1. Numbers 0–20 (illustrated)
2. Time — clocks, days, months, seasons
3. Weather set — all illustrated icons + reference card
4. Novice Low vocabulary — people, places, things, activities
5. Grammar diagrams — SER/ESTAR/TENER + core decision trees
6. Preposition maps
7. Continue vocabulary by level (Novice Mid → Novice High → Intermediate)

### Interactive Scene Canvas (Section 9 of roadmap)
A planned architectural evolution from snapshot compositing (server returns one flat JPEG) to a live stage (client holds a persistent background, Daniela adds/removes/moves prop layers and SVG components in real time). Key examples: a blank SVG clock whose hands Daniela rotates to show any time without regenerating an image; a restaurant table that accumulates items across an entire dining lesson (water → bread → main → dessert → la cuenta) on one persistent canvas; a body diagram Daniela annotates part by part. The infrastructure is ~60% already there — `zone_image_url` transparent PNGs + `POSITION_MAP` percentages are exactly the coordinate system CSS absolute positioning uses. The missing piece is a frontend `SceneCanvas` component. See Section 9 of the roadmap for full architecture, use cases, and build sequencing.

### Personal vocabulary (not in this list)
Words students guide Daniela into teaching based on personal interests are intentionally excluded. Those generate on-demand via `generate_visual`. This roadmap covers only the required core that every student at a given level must learn.

---

## 9. Archived Docs (Superseded)

These files can be deleted or kept for reference. Their content has been consolidated here:

- `docs/interactive-textbook-spec.md` — Functional spec, phases 1-3 complete, remaining work captured in Section 1 above
- `docs/interactive-textbook.md` — Architecture doc + drill audit findings, captured above
- `docs/syllabus-template-kit.md` — Label conventions and bundle creation API, implemented and stable, no open items
- `docs/class-model-rethink.md` — Decision framework captured in Decision 3 above
- `docs/class-audit.md` — December 2025 discussion session; architecture principles (WHAT vs HOW, brain map invariant), bundle system, content tiers, and unified labels all captured in Section 3b; remaining action items captured in Section 1 (What's Not Started)
