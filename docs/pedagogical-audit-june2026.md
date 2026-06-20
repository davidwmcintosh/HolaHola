# Pedagogical Audit — June 2026
**Purpose:** Full inventory of every Madrigal learning aspect (both books), every textbook chapter with gap/tension status, every pedagogical stance HolaHola has taken, and a prioritized loop expansion roadmap. This document is the design foundation before building new loop types beyond `madrigal_4step`.

**Sources synthesized:** `madrigal-page-one-analysis.md`, `substitution-drill-pedagogy.md`, `daniela-pedagogy-brief.md`, `content-audit-legacy-vs-madrigal.md`, `spanish1-actfl-alignment.md`, `curriculum-strategy.md`, `curriculum-restructure-spanish1.md`, `build-immersive-scenario-chat.md`, `drill-audit-for-daniela.md`, `pending-content-backlog.md`, `textbook-component-coverage.json`, `visual-asset-roadmap.md` (Parts I.A–I.T), `client/src/data/madrigal-unit-content.ts` (direct inspection — 5,326 lines).

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

## Part 2 — Loop System Coverage vs. Interactive Textbook Reality

**⚠️ Correction from initial estimate:** The first pass at this audit estimated coverage from documentation only. Direct inspection of `client/src/data/madrigal-unit-content.ts` (5,326 lines) reveals the textbook is far ahead of what was assumed.

**The real numbers: 31 built textbook chapters. 12 loop catalog entries. 19 chapters have full interactive content with no voice loop.**

### How the textbook content is organized

| Renderer | Registry array | Chapters registered |
|---|---|---|
| `VerbUnit` (ir-style) | `MADRIGAL_VERB_UNITS` | 1 |
| `PretUnit` (preterite-style) | `PRETERITE_UNITS` | 5 |
| `SerUnit` (ser/estar diagrams) | `SER_UNITS` | 2 |
| `HayUnit` (hay/poder) | `HAY_UNITS` | 2 |
| `GustUnit` (all advanced chapters) | `GUST_UNITS` | 21 |
| **Total** | | **31** |

### Complete chapter × loop coverage matrix

| Chapter (`chapterTitleKey`) | Textbook | Loop | Level |
|---|---|---|---|
| `where are you going` — ir | ✅ VerbUnit | ✅ | Sp1 |
| `voy a` — Near Future (early) | ✅ PretUnit | ✅ | Sp1 |
| `tomar` — I Took | ✅ PretUnit | ✅ | Sp1 |
| `comprar` — I Bought | ✅ PretUnit | ✅ | Sp1 |
| `tener` — I Have | ✅ PretUnit | ✅ | Sp1 |
| `quiero` — I Want | ✅ PretUnit | ✅ | Sp1 |
| `ser` — Nature of Things | ✅ SerUnit | ✅ | Sp1 |
| `estar` — Location | ✅ SerUnit | ✅ | Sp1 |
| `puedo ir` — I Can Go | ✅ HayUnit | ✅ | Sp1 |
| `hay:` — There Is/Are | ✅ HayUnit | ✅ | Sp1 |
| `gustar:` — Me gusta | ✅ GustUnit | ✅ | Sp1 |
| `me gustaría:` — I Would Like | ✅ GustUnit | ✅ | Sp1 |
| `fui:` — Where I Went | ✅ GustUnit | ✅ | Sp1 |
| **`voy a:`** — Full GustUnit near future | ✅ GustUnit | ❌ | Sp1 |
| **`va a:`** — Va a + ER/IR infinitives | ✅ GustUnit | ❌ | Sp1 |
| **`está:`** — Estar + limpio/sucio | ✅ GustUnit | ❌ | Sp1 |
| **`cómo está`** — States & Feelings | ✅ GustUnit | ❌ | Sp1 |
| **`qué está haciendo`** — Progressive | ✅ GustUnit | ❌ | Sp1 |
| **`tengo catarro`** — Health Expressions | ✅ GustUnit | ❌ | Sp1 |
| **`a qué hora`** — Transport & Schedules | ✅ GustUnit | ❌ | Sp1 |
| **`estudié:`** — Regular Preterite -é | ✅ GustUnit | ❌ | Sp2 |
| **`recibí:`** — Regular Preterite -í | ✅ GustUnit | ❌ | Sp2 |
| **`compraba`** — Imperfect Tense | ✅ GustUnit | ❌ | Sp2 |
| **`me levanto`** — Reflexive Verbs | ✅ GustUnit | ❌ | Sp2 |
| **`he comprado`** — Present Perfect | ✅ GustUnit | ❌ | Sp2 |
| **`lo veo`** — Direct Object Pronouns | ✅ GustUnit | ❌ | Sp2 |
| **`me lo`** — Combined Object Pronouns | ✅ GustUnit | ❌ | Sp2 |
| **`hable:`** — Subjunctive / Commands | ✅ GustUnit | ❌ | Sp2 |
| **`qué hizo`** — Irregular Preterite | ✅ GustUnit | ❌ | Sp2 |
| **`tuvo:`** — Tener/Venir Preterite | ✅ GustUnit | ❌ | Sp2 |
| **`le:`** — Indirect Object | ✅ GustUnit | ❌ | Sp2 |

### Spanish 1 without a loop — 6 units, ready to write scripts for

These are all in-scope for Spanish 1 and have complete interactive textbook pages already built. The only missing piece is the loop catalog entry with Daniela's verbal scripts.

| Chapter | What it teaches | Loop note |
|---|---|---|
| `voy a:` | Full near-future GustUnit (extends `voy a` to the complete treatment) | Distinct from the early PretUnit version |
| `va a:` | Va a + ER/IR infinitives (vender, leer, escribir) | Extends near-future to other verb families |
| `está:` | Estar + paired opposites (limpio/sucio, abierto/cerrado) | Madrigal Ch. 45, highest Sp1 chapter |
| `cómo está` | Estar + emotional/physical states (contento, cansado, enfermo) | High conversational frequency |
| `qué está haciendo` | Progressive (está hablando, está comiendo) | Magic Key Card 14 — before AR present in sequence |
| `tengo catarro` | Tener expressions — health (hambre, sed, frío, calor, miedo, sueño, catarro) | Transcribed from Madrigal p. 53 |

### Spanish 2 without a loop — 10 units, textbook already built

`estudié:`, `recibí:`, `compraba`, `me levanto`, `he comprado`, `lo veo`, `me lo`, `hable:`, `qué hizo`, `tuvo:`, `le:`

All 10 have full GustUnit interactive content. Loop scripts are the only missing piece for Spanish 2 launch.

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

### Tier 1 — Spanish 1 loop scripts (textbook already built, just needs verbal scripts)

These 6 units have complete interactive textbook content. Adding them to the loop catalog is writing Daniela's verbal instructions per step — no new content needed.

| Priority | Chapter | Key vocabulary to anchor loops on |
|---|---|---|
| 1 | `qué está haciendo` — Progressive | está hablando, está comiendo, está escribiendo |
| 2 | `tengo catarro` — Health / Tener states | hambre, sed, frío, calor, miedo, sueño, catarro |
| 3 | `cómo está` — States & Feelings | contento, cansado, enfermo, nervioso, triste |
| 4 | `está:` — Estar + adjective pairs | limpio/sucio, abierto/cerrado, lleno/vacío |
| 5 | `va a:` — Va a + ER/IR infinitives | vender, leer, escribir |
| 6 | `voy a:` / `a qué hora` — Full near-future + transport | sale, llega, ¿a qué hora? |

### Tier 2 — Spanish 2 loop scripts (textbook built, launch when Sp2 is ready)

`estudié:`, `recibí:`, `compraba`, `me levanto`, `he comprado`, `lo veo`, `me lo`, `hable:`, `qué hizo`, `tuvo:`, `le:`

### Tier 3 — New loop types (require step-structure design before build)

| Loop type | Design question | What's needed before building |
|---|---|---|
| `scenario_roleplay` | What are the steps? Setup → immersion → debrief? How does ACTFL level shape it? | Step structure analogous to anchor → model → combinator → pivot |
| `grammar_drill` | Shadowing vs. sentence transformation — same type or two? | Define the cognitive mode for each; shadowing = prosody, transformation = structure |
| `vocabulary_cluster` | For Everyday Expressions pages and possibly the cognate unit | Step structure for phrase clusters that don't follow verb-unit format |
| `pronunciation_check` | Model phrase → record → Azure assessment → targeted feedback → retry | Closest to defined already; Azure integration is live |

### Tier 4 — Textbook content still missing (needs both content and loop)

| Item | Status |
|---|---|
| Hace + time expressions (hace dos años, ¿cuánto tiempo hace que...?) | No textbook content, no loop — entirely absent |
| Regular present tense AR (hablar, trabajar — Madrigal-style, not paradigm) | Ch. 12 exists but teaches paradigm; Madrigal-style treatment not yet built |

---

## Summary

**What's fully built:** The Madrigal learning repertoire (8 page elements + 3 Magic Key formats) is completely implemented in the textbook renderer. All 8 visual elements are live. The 4-step voice loop (anchor → model → combinator → pivot) maps correctly to the page sequence.

**What's ahead of schedule:** The textbook has 31 built chapters across 5 renderers. We thought it had ~12. That means Spanish 2 has 10 complete textbook chapters waiting for loop scripts — the content work is already done.

**The immediate task:** 6 Spanish 1 loop scripts. Textbook content exists for all 6. These are writing exercises, not build exercises — Daniela's verbal instructions per step, `vocabTerms` arrays, and `contentKey` values.

**The design conversation:** New loop types (scenario_roleplay, grammar_drill, vocabulary_cluster) need step-structure design before any build happens. The question is what each step IS — the equivalent of anchor → model → combinator → pivot for a scenario, a shadowing session, or a phrase cluster.

**The legacy textbook:** Chapters 9, 11–12, 14–15, 19 have tension with or duplication of Madrigal content. None need remediation now, but should be labeled "grammar reference" in any institution-facing syllabus to avoid the competing mental model problem.
