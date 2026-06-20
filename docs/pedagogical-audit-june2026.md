# Pedagogical Audit — June 2026
**Purpose:** Full inventory of every Madrigal learning aspect (both books), every textbook chapter with gap/tension status, every pedagogical stance HolaHola has taken, and a prioritized loop expansion roadmap. This document is the design foundation before building new loop types beyond `madrigal_4step`.

**Sources synthesized:** `madrigal-page-one-analysis.md`, `substitution-drill-pedagogy.md`, `daniela-pedagogy-brief.md`, `content-audit-legacy-vs-madrigal.md`, `spanish1-actfl-alignment.md`, `curriculum-strategy.md`, `curriculum-restructure-spanish1.md`, `build-immersive-scenario-chat.md`, `drill-audit-for-daniela.md`, `pending-content-backlog.md`, `textbook-component-coverage.json`, `visual-asset-roadmap.md` (Parts I.A–I.T).

---

## Part 1 — The Complete Madrigal Learning Repertoire

Every distinct learning mode from both books. Column 3 is HolaHola's current implementation status.

### From *See It and Say It in Spanish*

| Element | What it is | HolaHola status |
|---|---|---|
| **Confidence opener** | Pages 1–8: cognates, "you already know Spanish," no grammar, low anxiety entry | `ChapterIntroduction.tsx` cognateOpener ✅ |
| **Anchor block** | 2–3 building blocks, widely spaced, Spanish + English inline, not sentences — components | `patternLabel` field ✅ |
| **See It Say It image loop** | 4 positive images, same sentence frame throughout, no English under images | `positiveItems` ✅ |
| **¿Va? sentence former** | 2-column drill inserted between positive and negative — introduces `va` before Q&A (HolaHola addition) | `vaColumns` + `SentenceColumnGenerator` ✅ |
| **Negative section** | Same images + `No` prepended — negative before question (simpler step first) | `negativeItems` ✅ |
| **Vamos** | Single quiet line, no section break — absorbed the way children absorb "let's go" | `vamosItems` ✅ |
| **Q&A exchange** | ¿Va al X? / Sí, voy al X. / No, no voy al X. — él/ella asks, yo answers, full sentence required | `page12Items` ✅ |
| **Substitution drill** | 2 verb forms × 5–8 objects — eye scans, brain fires, no conscious effort | `sentenceColumns` + `SentenceColumnGenerator` ✅ |
| **Everyday Expressions pages** | 5 discrete pages of survival/idiomatic phrases (restaurant, greetings, tener states, etc.) | Partially in legacy Chs. 1, 17–18; transcribed to backlog ⚠️ |

**The full HolaHola scroll sequence:**
```
ANCHOR → SEE IT SAY IT → ¿VA? DRILL → NEGATIVE → SUBST. DRILL → VAMOS → Q&A
```
All 8 elements above are present in the textbook renderer. The 4-step loop (madrigal_4step) drives the voice session over this same sequence.

---

### From *Magic Key to Spanish*

| Element | What it is | HolaHola status |
|---|---|---|
| **Cognate pattern cards** (Cards 1–2) | 8 suffix mapping rules (-tion→-ción, -ous→-oso, -ist→-ista, etc.) — 2,000+ free words | `cognateOpener` in chapter intro ✅ (Decision 8: whether to promote to dedicated unit — still open) |
| **3-column substitution drill** (Cards 3–20) | verb phrase × objects × time/place — the full Magic Key practice format, 3-way permutation | `sentenceColumns` supports 3 columns ✅ (rarely used — data doesn't always have a valid 3rd dimension) |
| **Question/negative drill format** | ¿Tomó usted...? / No, no tomé... — formal question leads, yo negative follows | `questionItems` / `page12Items` ✅ |
| **45-lesson verb sequence** | Canonical Madrigal ordering: tomar → comprar → ir+a → estar → gustar → progressive → AR present → irregular preterites → present perfect | 27-unit roadmap follows this order ✅ |

**The key Magic Key confirmation:** `tú` does not appear until Lesson 45 of 45. HolaHola's Decision 5 (no tú form until explicitly reintroduced) is directly endorsed by Madrigal's own sequencing.

---

## Part 2 — Loop System Coverage vs. Full Madrigal Roadmap

The 12 current units in `madrigal-loop-catalog.ts` map against the full 27-unit roadmap. Coverage status below.

### ✅ Covered by current loops (12 units)

| Unit | Loop contentKey | Madrigal source |
|---|---|---|
| ir — Going Places | `where are you going` | See It and Say It, Lesson 1 |
| ir + a + inf — Near Future | `i am going to` | Magic Key Cards 8–9 |
| tomar — I Took | `i took` | Magic Key Card 3 |
| comprar — I Bought | `i bought` | Magic Key Card 7 |
| tener — I Have | `i have` | See It and Say It, Lesson 4 |
| querer — I Want | `i want` | See It and Say It, Lesson 6 |
| ser — Nature of Things | `what something is` | See It and Say It, Lesson 7 |
| estar — Location | `where something is` | Magic Key Card 6 |
| poder + ir — I Can Go | `i can go` | See It and Say It, Lesson 8 |
| hay — There Is/Are | `there is` | See It and Say It (hay section) |
| gustar — I Like / They Like | `i like` | See It and Say It, Lesson 9 |
| fui — Where I Went | `where i went` | See It and Say It (fui section) |

---

### ❌ Gap: Madrigal content not yet in any loop

These are not "missing chapters" — they exist in the book and belong in the loop system.

| Gap | Madrigal source | Priority | Notes |
|---|---|---|---|
| **Progressive tense** (estoy hablando / está comiendo) | Magic Key Card 14 | 🔴 High | Before present tense AR in Madrigal's sequence; frequent in real conversation |
| **Tener expressions** (hambre, sed, frío, calor, miedo, sueño) | See It and Say It p. 53 | 🔴 High | Transcribed in backlog; not yet a loop unit |
| **Estar + adjective states** (limpio/sucio, cansado, etc.) | Ch. 45; Magic Key | 🟡 Medium | Ch. 45 exists but no loop entry |
| **Regular present tense AR** (hablar, trabajar — Madrigal-style) | Magic Key Card 15 | 🟡 Medium | Philosophical tension with Ch. 12; must be introduced Madrigal-way (vocabulary items, not paradigm) |
| **Hace + time expressions** (hace dos años, hace mucho tiempo) | Magic Key late lessons | 🟡 Medium | Entirely missing from both textbook and loops |
| **Everyday Expressions clusters** (restaurant survival, greetings expansions) | See It and Say It pp. 28, 43, 53+ | 🟡 Medium | Transcribed to backlog; could become a `vocabulary_cluster` loop type |
| **Vez time expressions** (una vez, muchas veces, otra vez) | Madrigal p. 162 | 🟡 Medium | Transcribed to backlog; candidate for preterite sentence combiners |
| **Irregular preterites** (hizo, dijo, trajo, puso) | Magic Key Cards 17–19 | 🔵 Spanish 2 | Assigned to Spanish 2; Chs. 42–43 |
| **Indirect object / le** | Magic Key late; Ch. 44 | 🔵 Spanish 2 | Assigned to Spanish 2 |
| **Present perfect** (he comido) | Magic Key Card 20 | 🔵 Spanish 2 | Last in Madrigal's sequence |

---

## Part 3 — Textbook Chapters by Status

Full classification of all 45 chapters. Madrigal backbone chapters are the authoritative spine. Legacy chapters are evaluated on uniqueness vs. tension.

### Legacy chapters — No Madrigal equivalent → KEEP

These cover topics Madrigal doesn't address with a full chapter. No tension with the method.

| Ch | Topic | Loop needed? |
|---|---|---|
| 1 | Social Phrases | No — conversational, not verb-unit |
| 2 | Meeting People | No |
| 3 | Classroom Survival | No |
| 4 | Daily Activities | Possibly (hablar, vivir could become loop units) |
| 5 | Los Números | No |
| 6 | Telling Time | No (but vez expressions → fold in from backlog) |
| 7 | Birthdays & Dates | No |
| 8 | Family Members | No |
| 10 | School Supplies | No |
| 13 | Spanish School Culture | No — cultural |
| 17 | Food & Dining | No (vocabulary chapter) |
| 18 | At the Restaurant | No (survival phrases → fold in from backlog) |
| 20 | Los Colores | No |
| 21 | Shopping | No |
| 22 | Reading & Writing | No |
| 24 | Las Direcciones | No |
| 25 | Travel Vocabulary | No |
| 26 | El Tiempo | No |
| 27 | At the Hotel | No |

### Legacy chapters — With tension or duplication ⚠️

| Ch | Issue | Recommendation |
|---|---|---|
| **9** — Ser: Describing | Overlaps Ch. 33 (Madrigal ser). Different framing — Ch. 9 teaches adjectives traditionally; Ch. 33 follows Madrigal. | Label Ch. 9 "grammar reference," Ch. 33 is the primary instruction |
| **11** — School Subjects | Introduces gustar before Ch. 37 (the authoritative Madrigal chapter), using non-Madrigal framing | Flag in syllabus as "preview" — does not conflict if student knows Ch. 37 is the definitive version |
| **12** — Present Tense AR | Teaches full -o/-as/-a/-amos/-an paradigm. Madrigal deliberately avoids this — she treats high-frequency forms as vocabulary items, not endings. | Most significant tension point. Label "grammar reference" not "primary instruction." New loop units for AR verbs should follow Madrigal-style (vocabulary-first, not paradigm). |
| **14** — Hobbies | Uses me gusta for activities before Ch. 37, non-Madrigal framing | Same as Ch. 11 — preview, not conflict |
| **15** — Sports & Abilities | Introduces poder before Ch. 35 (HayUnit), non-Madrigal framing | Same — preview |
| **16** — Weekend Plans | Introduces voy a before Ch. 40 (GustUnit, full development), less developed | Ch. 30 and Ch. 16 both predate the GustUnit renderer. Ch. 40 is authoritative. |
| **19** — Stem-Changing Verbs | Grammar paradigm chapter (o→ue, e→ie). Tension with vocabulary-first approach. | Label "grammar reference." Stem-changers (quiero, puedo) should be learned as vocabulary, with grammar note as supplement. |

### Madrigal backbone chapters — all loop-eligible, tracking below

| Ch | Title | Loop status |
|---|---|---|
| 23 | Where Are You Going? (ir) | ✅ Loop: `where are you going` |
| 28 | I Took: Tomar | ✅ Loop: `i took` |
| 29 | I Bought: Comprar | ✅ Loop: `i bought` |
| 30 | Voy a (early version) | ✅ Loop: `i am going to` (Ch. 40 is authoritative) |
| 31 | I Have: Tener | ✅ Loop: `i have` |
| 32 | I Want: Quiero | ✅ Loop: `i want` |
| 33 | Ser: Nature of Things | ✅ Loop: `what something is` |
| 34 | Estar: Location | ✅ Loop: `where something is` |
| 35 | I Can Go: Puedo ir | ✅ Loop: `i can go` |
| 36 | Hay | ✅ Loop: `there is` |
| 37 | Gustar: Me gusta | ✅ Loop: `i like` |
| 38 | Me gustaría | ❌ No loop — `i would like` not yet catalogued |
| 39 | Fui: Where I Went | ✅ Loop: `where i went` |
| 40 | Voy a (full GustUnit) | ✅ Loop: `i am going to` |
| 41 | Va a: Vender/Leer/Escribir | ❌ No loop — ER/IR infinitives with voy a not yet catalogued |
| 42 | ¿Qué Hizo? (irregular pret.) | 🔵 Spanish 2 |
| 43 | Tuvo (tener/venir pret.) | 🔵 Spanish 2 |
| 44 | Le (indirect object) | 🔵 Spanish 2 |
| 45 | Está: Limpio y Sucio | ❌ No loop — estar + adjective states not yet catalogued |

---

## Part 4 — All Pedagogical Stances (Complete Inventory)

Every design decision that should constrain how new loop types are built.

### Sequencing decisions
1. **Preterite before present tense** — students tell stories before they describe habits. Communicative need drives sequence. (Decision 6, curriculum-strategy.md)
2. **usted before tú** — formal before intimate. tú banned from all instruction until explicitly introduced. (Decision 5, April 2026; confirmed by Magic Key Lesson 45)
3. **Negative before question** — adding "no" to a known sentence is simpler than learning a new conjugation.
4. **Progressive before AR present** — Magic Key Card 14 before Card 15. Estar + -ando/-iendo before the full AR paradigm.
5. **ser and estar treated separately** — contrasted only after both are individually solid.
6. **Spanish 1 boundary = Ch. 47 / Madrigal p. 137.** Chapters 42–44 (irregular preterites, indirect objects) are Spanish 2.
7. **ACTFL mapping:** Novice Low (1–8), Novice Mid (9–22), Novice High (23–47).

### Cognitive engineering decisions
8. **One verb per drill section.** The verb form is the fixed anchor; the noun varies within a semantic cluster. Mixing verbs destroys the scan. (Vocabulary Cluster Principle)
9. **Same sentence frame across all image cards.** The verb pounds in through exact repetition while only the noun changes.
10. **4 images per section** — Madrigal's sweet spot. More than 4 = studying, not absorbing.
11. **Column 1: 2 verb forms only** (yo + él/ella). Never the full paradigm. 2×8 = 16 sentences per scan.
12. **Column 2: 5–8 items, one dimension, concrete, imageable, from chapter vocabulary.** No new vocabulary in the drill.
13. **él/ella asks, yo answers.** Eliminates the tú confusion before tú is formally introduced.
14. **Complete sentence answers always.** Never just "Sí." Each answer repeats the sentence frame.
15. **Double no** (No, no voy) introduced in context without explanation — absorbed as pattern.
16. **20 distinct items maximum per lesson** — the "one sitting" rule. Textbook must be scannable, not dense.
17. **4-step confidence ramp:** anchor → model sentences → combinator → negative/QA pivot. Order is invariant.

### Vocabulary and image decisions
18. **Image is the anchor, not translation.** New words arrive inside a sentence alongside an image. No English beneath the image card sentences.
19. **Cognates are an unlock, not the learning.** Pattern cognates (-tion→-ción) install L1-mediated memory traces. Image anchoring is universally primary.
20. **Never let a word lie fallow.** Any word taught must immediately be used in a real exchange.
21. **Content law:** All Spanish sentences, Q&A pairs, and paradigms must come from Madrigal's books, never AI-generated.
22. **Images: one subject, no background story.** The drawing cannot be about anything except the word.

### Affective and relational decisions
23. **Affective filter is the mechanism.** Cold immersion fails most learners. Anxiety = acquisition stops.
24. **Two types of English:** Instructional (sparing, targeted; whiteboard preferred) and Emotional (freely available — warm relationship). Spanish is always the medium.
25. **Confident imperfection over halting perfection.** Every drill combination produces a correct sentence. The student experiences succeeding before speaking freely.
26. **The relationship is the retention mechanism.** The student who feels seen returns tomorrow. Technical accuracy is secondary.

### Textbook architecture decisions
27. **Textbook = pre-work, Daniela = main course.** The DLI parallel: GLOSS is the textbook equivalent — decades-built, still just the appetizer.
28. **Scan-and-go model.** "READ" modal removed. Textbook must be compact, not a reference manual.
29. **Daniela leads every textbook page.** She is the Fluency Judge. Observable behavior replaces inferred behavior.
30. **Cognate opener placement:** Currently at chapter intro layer. Decision 8 (curriculum-strategy.md) is open: promote to dedicated `vocabulary_cluster` unit or keep at intro.

---

## Part 5 — What Doesn't Exist Yet (Design Questions Before Building)

These are the items that require a design conversation before building, not just content addition.

### A. Loop types not yet designed
The current `loopType` enum has `madrigal_4step`, `scenario_roleplay`, `grammar_drill`, `pronunciation_check`. None except `madrigal_4step` has a defined structure.

**Scenario roleplay loop** — What does it look like?
- The scenario system design (`build-immersive-scenario-chat.md`) describes a triple-pane layout: Daniela as storyteller, student in a real situation (coffee shop, airport, pharmacy), characters responding naturally.
- How does a scenario loop differ from `madrigal_4step`? It presumably has setup → immersion → debrief rather than anchor → model → combinator → pivot. The step structure needs to be designed.
- ACTFL staging: Novice scenario = survival phrases + gestures; Advanced scenario = negotiation + repair.

**Grammar drill loop** — What does it look like?
- Drill audit data: 187k+ drills; 87% audio-based for novices. Missing: shadowing drills, sentence transformation drills.
- Shadowing = student repeats at native speed, matching prosody. This is a different cognitive mode from the substitution drill.
- Sentence transformation = student takes a statement and converts it (positive → negative → question). Maps directly to Madrigal's page sequence but as a verbal exercise.

**Pronunciation check loop** — What does it look like?
- Distinct from a drill. Azure Speech Assessment is already integrated. A pronunciation loop might be: model phrase → student records → assessment → targeted feedback → retry.

### B. The cognate unit decision (Decision 8 — still open)
Should the cognate opener (currently at chapter intro) become a dedicated `vocabulary_cluster` loop type? If yes, what are its steps? If no, how does it surface in Daniela's sessions beyond the intro?

### C. The Ch. 12 question (philosophical)
Regular present tense AR — does HolaHola teach it Madrigal-style (vocabulary-first: hablar, trabajar as individually learned forms like voy) or does it acknowledge the paradigm as a grammar reference layer that students will encounter in other contexts? This shapes whether `regular_present_ar` becomes a `madrigal_4step` loop or a `grammar_drill` loop.

### D. Everyday Expressions — format decision
Madrigal's 5 expression pages (restaurant survival, greetings, tener states, time expressions) are transcribed in the backlog. They don't follow the verb-unit format — they're clusters of idiomatic phrases. Do they become `vocabulary_cluster` loops? And what are a vocabulary cluster loop's steps?

---

## Part 6 — Prioritized Build Queue

In Madrigal's sequence order. All are `madrigal_4step` compatible unless otherwise noted.

| Priority | Unit | Type | What's needed |
|---|---|---|---|
| 1 | **Progressive tense** (estoy hablando / está comiendo) | `madrigal_4step` | Loop entry + textbook content; appears in Magic Key before AR present |
| 2 | **Tener expressions** (hambre, sed, frío, calor, miedo, sueño) | `madrigal_4step` | Content transcribed in backlog; needs loop entry |
| 3 | **Me gustaría** (I would like) | `madrigal_4step` | Ch. 38 exists; no loop entry |
| 4 | **Va a + ER/IR infinitives** (vender, leer, escribir) | `madrigal_4step` | Ch. 41 exists; no loop entry |
| 5 | **Estar + adjective states** (limpio/sucio, cansado, etc.) | `madrigal_4step` | Ch. 45 exists; no loop entry |
| 6 | **Hace + time** (hace dos años, ¿cuánto tiempo hace que...?) | `madrigal_4step` | Entirely missing from textbook and loops |
| 7 | **Everyday Expressions clusters** | `vocabulary_cluster` ❓ | Requires format design before build |
| 8 | **Cognate unit** | `vocabulary_cluster` ❓ | Decision 8 still open |
| 9 | **Scenario roleplay** | `scenario_roleplay` ❓ | Requires step-structure design before build |
| 10 | **Shadowing drills** | `grammar_drill` ❓ | Requires format design before build |

---

## Summary

The Madrigal learning repertoire is 8 elements from See It and Say It + 3 format types from Magic Key. HolaHola implements all 8 page elements in the textbook renderer and the 4-step voice loop. The 12 current loop units cover the first two-thirds of the Madrigal verb sequence.

**The remaining third** — progressive, tener states, me gustaría, va a + ER/IR, estar + states, hace + time — are all `madrigal_4step` compatible and can be built without any format design work.

**The new loop types** (scenario_roleplay, grammar_drill, vocabulary_cluster, pronunciation_check) require format design before build. Each needs a defined step structure analogous to anchor → model → combinator → pivot.

**The textbook gap** is primarily in legacy chapters 9, 11–12, 14–15, 19 which either duplicate Madrigal content (9, 15) or create philosophical tension (12, 19). None need immediate remediation, but the framing should be clear in any institution-facing syllabus.
