# Visual Asset Roadmap
## HoloHola — Interactive Textbook Design Playbook & Visual Library

**Created:** March 15, 2026  
**Last updated:** May 11, 2026 — Engine assignments revised (see "Final Engine Assignment — Revised May 11, 2026" in Image Engine Evaluation section); live-session freeform changed from Gemini Warm → Gemini Base + reference; environments changed from Base Gemini Flash → gpt-image-1 prop; environment usage clarified (two distinct contexts: vocab anchor images + visual_environments prop room backgrounds)  
**Referenced by:** `docs/curriculum-strategy.md` (Section 8)  
**Component coverage manifest:** `docs/textbook-component-coverage.json` (machine-readable, Lyra-monitored)  
**Status column key:** ⬜ Planned | 🔄 Generating | ✅ In Library

---

## Pedagogy & Image Generation Reference Documents

The analysis documents below have been integrated inline as **Part I** of this roadmap (scroll down or jump via the links). Read Part I before planning any new chapters, VocabQA items, or image batches.

| Section | Content | When to Use |
|---|---|---|
| **Part I.A** — Where HoloHola Improves on Madrigal *(inline below)* | What we keep from Madrigal, and 15 specific limitations with HoloHola solutions — ambiguous drawings, mono-color dialogue, missing ser/estar contrast, generic practice instructions, and more | Before designing any new chapter component or VocabQA card |
| **Part I.B** — See It and Say It Source Analysis *(inline below)* | Full lesson map of *See It and Say It in Spanish* — all 9 phases, 5 Everyday Expressions pages, appendix catalogued, complete drawing and structure catalogue | Authoritative source of truth for Madrigal's content sequence |
| **Part I.C** — Gap Audit: HoloHola vs. Madrigal *(inline below)* | Chapter-by-chapter overlap analysis, current coverage score (~30%), and prioritized gap-fill queue for existing and new chapters | Before deciding which new chapters or vocabQA items to seed next |
| **Part I.D** — How Madrigal Illustrates Each Concept *(inline below)* | 10 image templates, per-category drawing specs, prompt guidelines, and the Question Fit Test | Brief for every new VocabQA image batch |
| **Part I.E** — Actual Image Quality Audit *(inline below)* | First-party visual inspection of all ~243 HoloHola vocab images across 20 categories — graded A/B/C/D/F against the Question Fit Test; 7 F-grade images flagged for immediate regen with prompts; 3 D-grade and 23 C-grade images queued; 10 cross-cutting failure modes documented; library is ~82% A/B | Before regenerating any image; the ground-truth quality record |
| **Part I.F** — Magic Key to Spanish: Full Audit *(inline below)* | Full lesson map of Magic Key to Spanish — cognate categories, verb introduction sequence, practice format analysis, design implications | Companion to I.B; use together when planning curriculum sequence |
| **Part I.G** — Two-Book Synthesis *(inline below)* | What HoloHola must become when both books are fully integrated — the unified pedagogy that emerges from See It and Say It + Magic Key | Before scoping new curriculum phases |
| **Part I.H** — Technology Watch: Gemini 2.5 TTS *(inline below)* | Multi-speaker TTS capabilities, dialogue rendering analysis, HoloHola implications | Before planning voice/audio architecture changes |
| **Part I.I** — Strategic Position *(inline below)* | HoloHola as the reference implementation for multi-speaker TTS in education | For positioning and competitive differentiation |
| **Part I.J** — STT Architecture: Turn-End Problem *(inline below)* | The turn-end detection challenge, current approach, roadmap for improvement | Before making any STT pipeline changes |
| **Part I.K** — Interactive Textbook Architecture *(inline below)* | Daniela leads every page; drill system scoped to tangent queue only; observable behavior replaces inferred behavior; Daniela as Fluency Judge | Before implementing any new textbook or drill feature |
| **Part I.L** — The 20 Reminder Cards: Madrigal's Skeleton Key *(inline below)* | All 20 cards catalogued by type and lesson; two-type taxonomy (cognate pattern cards vs. substitution drill grids); Spanish 1 compartment sequence derived from card order; HoloHola design recommendations | Before designing Spanish 1 compartment sequence or the Cognate Key feature |
| **Part I.M** — The Cognate Trap: Why Image Anchoring Is the Primary Pedagogy *(inline below)* | Three-tier cognate hierarchy (direct / pattern / false friends); why pattern cognates install L1-mediated memory traces that are counterproductive for production fluency; image anchoring as the universally applicable primary pedagogy; what Daniela must never do; what Magic Key contributes beyond cognates | Definitive statement of HoloHola's vocabulary learning philosophy — read before designing any new vocabulary feature |
| **Part I.N** — GLOSS as a Reference Architecture *(inline below)* | GLOSS content taxonomy (4 competencies × 10 topics × 2 modalities); lesson format documented from downloaded package (bilingual dialogue + bilingual audio); licensing status (original text likely public domain; images/audio need individual evaluation); GLOSS as comprehensible input pipeline feeding HoloHola's output practice | Before designing content organization, competency tracking, or input/output session sequencing |
| **Part I.O** — The DLI Campus: Physical Immersion Environments *(inline below)* | DLI physically builds restaurant, café, train station sets with native-speaker actors on Monterey campus; GLOSS digital tools are pre-work, campus does the immersion; HoloHola SceneCanvas is the digital equivalent; competitive positioning reframed from "quiz app" to "campus in your pocket" | Before designing scene environments, scenario conversations, or marketing copy |
| **Part I.P** — The Affective Filter: Why Cold Immersion Fails Most Learners *(inline below)* | Krashen's Affective Filter Hypothesis; commitment/circumstance dichotomy (ambassador's kids vs. casual learners); Calibrated Immersion model — Spanish always the medium, English sometimes the scaffold; whiteboard as precision scaffolding surface; calibration spectrum Spanish 1 → Spanish 5; Daniela's gentle hand is not a concession but the product design decision that determines whether broader-market students reach Spanish 3 | Definitive statement of how Daniela modulates immersion intensity — read before designing any student-facing difficulty controls, scaffolding features, or Daniela behavior for beginner/anxious/child learners |
| **Part I.Q** — Prompt Philosophy: Principles Over Scripts *(inline below)* | Daniela is built on internalized philosophy, not decision trees; if-then prompt failure mode documented (brittle, grows without bound, conflicts); right model: who she is + what she believes + what she knows + what she values; practical test for any prompt addition | Read before writing or modifying any Daniela system prompt content — this is the governing philosophy for all prompt design decisions |
| **Part I.R** — The Textbook Data Model and Build Sequence *(inline below)* | Live database audit: 27 active units with correct Madrigal vocabulary data; 32,927 drill items — 28,433 are word-level translation cards (wrong format); architectural decision: layer, don't replace (vocabulary_list for See It and Say It loop, key_phrases_for_chat for substitution drill, curriculum_drill_items demoted to supplementary review); 8-step See It and Say It micro-sequence specified; 5-step build sequence | Read before building any vocabulary presentation, drill component, or Daniela lesson context injection |
| **Part I.S** — The Flat Page First Principle & SentenceColumnGenerator Design *(inline below)* | Madrigal's micro-cycle: positive → negative (new images) → question → exercise; Flat Page First rule — every element must be visible without interaction; resting state rule; SentenceColumnGenerator design decisions | Read before building any drill or substitution practice component |
| **Part I.T** — Spanish 1 Unit Taxonomy & Curriculum Map *(inline below)* | Four unit format types defined: Social Phrase Card / Verb Unit / Grammar Concept / Vocabulary Cluster; 27-unit Spanish 1 curriculum map across 10 phases; key decisions: preterite before present tense, greetings as Social Phrase not Unit 1, thinking columns deferred to Spanish 2+, La Familia distributed not standalone | **Read before building any new Spanish 1 unit or restructuring existing units — this is the definitive curriculum architecture** |
| `docs/madrigal-page-one-analysis.md` *(external)* | **Complete element-by-element analysis of pages 9–13 of *See It and Say It* (Lesson 1, *ir*).** Every element on the page in sequence — anchor block, positive image grid, negative grid, Q&A exchange, substitution drill — with the exact presentation, cognitive "how," and pedagogical "why" for each. Includes the full page sequence rationale, the layout contract, and HoloHola component map. **Read before building or modifying any Verb Unit page, or before reviewing micro-cycle generated content.** |
| `docs/textbook-component-tts-stt-guide.md` *(external)* | **TTS / STT pipeline design note (April 18, 2026).** The one true pattern for audio in textbook components: always POST `/api/tts/pronunciation` with `gender` from `useLanguage()`. Anti-pattern list (never use `synthesizeSpeech` in a textbook component). STT recording pattern with `transcribeAudio`. Component inventory table showing which file uses which pipeline. Pre-ship checklist. | **Read before adding any audio button or mic button to any textbook component.** Failure to follow this guide causes voice gender mismatches between components on the same page. |
| `docs/curriculum-strategy.md` *(external)* | Overall platform philosophy, ACTFL level mapping, M1–M6 component definitions | Framing new chapter types |

**Image generation style note:** HoloHola uses soft watercolor, not Madrigal's B&W line art — we are not trying to replicate her drawings. What Madrigal's illustrations teach us is how *minimal* you can get and still communicate a word unambiguously. Her drawings are a masterclass in stripping an image down to its single essential idea. That principle applies directly to our watercolor generation: when in doubt, simplify. One subject, one context, no clutter. Part I.D documents how she solves each concept type — use it as a simplicity reference, not a style guide.

This document is the master list of every visual asset we intend to pre-create for the platform. Assets fall into eight categories. The goal is not to be exhaustive on day one — it's to be deliberate: the right visuals for the words and concepts students absolutely must learn, generated ahead of time so Daniela can surface them instantly.

Visual assets live in the `visual_assets` table. Grammar/infographic SVGs are generated as React components per language (see 9-Language Matrix below). Prop room backgrounds live in `visual_environments`.

---

# Part I: Pedagogy Foundation

> Read this section before planning new chapters, VocabQA items, or image batches. It contains the source material analysis, gap audit, image generation guide, and improvement principles that shape every textbook decision.

---

## Part I.A — Where HoloHola Improves on Madrigal


**Document purpose:** Catalogue every structural, visual, and pedagogical limitation of *See It and Say It in Spanish* so that HoloHola can do the same things better — keeping what's brilliant while solving what a printed B&W book could never fix.

---

## What We Are Keeping (Madrigal's Genius)

Before the critique: a clear record of what to preserve, because copying the good stuff is as important as fixing the bad.

| Madrigal Feature | Why It Works | HoloHola Equivalent |
|---|---|---|
| Q&A format (question top, answer bottom) | Forces self-testing before reading the answer | VocabQA card with tap-to-reveal answer |
| Cognate opener ("You already know Spanish") | Removes anxiety before a word of grammar appears | CognateOpener M3 grid at chapter start |
| Infinitive introduced before conjugation | The root verb is the anchor; endings are just clothing | verbGroups always name the infinitive first |
| Communicative-need ordering (not tense order) | Students can have real conversations before finishing Unit 1 | Chapter sequence follows the same logic |
| 4-item teaching batch per page | Enough to lock in a pattern; not so much it overwhelms | VocabQA default: 4–6 items |
| Gender-pair teaching (-o/-a together) | Learn one, get the other free | GenderAgreementGrid always shows both |
| EE (Everyday Expressions) survival inserts | Practical phrases arrive exactly when students need them most | discoveryNotes and narrative tips throughout |
| Personal-a shown before it's named | Grammar is absorbed before the rule is labeled | Same approach: show in examples first |
| era slips in through reported speech | Imperfect is felt before it's defined | Same approach for HoloHola preterite intro |
| Appendix as a full reference | Students can look up any structure from any lesson | Future: searchable reference section |

---

## What We Are Improving

### 1. Dialogue Colors — The Single Biggest Readability Failure

**What Madrigal does:** Every Q&A pair is printed in the same black ink. The question and answer look visually identical. When Madrigal writes a back-and-forth dialogue (e.g., pp. 162–163, EE #5), it's a wall of same-weight text.

**The problem:** You cannot glance at a page and see "this is a conversation." Both voices look the same. Students who scan before reading — which is nearly everyone — get no structural signal that this is interactive.

**What HoloHola does:** Every VocabQA card uses two distinct visual channels for question and answer:
- Question text: one color/weight (e.g., muted secondary)
- Answer text: distinct color/weight (e.g., primary, slightly bolder)
- Conversation strips: each speaker gets a bubble color, and the strip is designed as a comic panel, not a text block
- The two-color rule should extend to ALL Q&A items, not just conversation strips

**Impact:** A student can instantly tell what to attempt vs. what to verify. The visual encoding replaces the "cover with your hand" instruction.

---

### 2. Ambiguous Drawings — The Olive Problem and Others

**What Madrigal does:** Drawings are hand-drawn B&W line art. The quality varies, and some subjects are inherently hard to make recognizable in a small B&W format.

**Known ambiguous drawings observed:**

| Page | Subject | Problem |
|---|---|---|
| p. 100 | Las aceitunas (olives) | Small oval shapes; could be any small round food — grapes, peas, capers |
| p. ~95 | La sardina | Any small fish in profile looks like a sardine; no distinguishing feature |
| p. ~30 | El fósforo (match) | Thin stick with small flame at top; easy to read as a candle |
| p. ~25 | El botón (button) | Small circular object; could be a coin, a pill, a dot |
| Various | Celery vs. asparagus | Both: long stalks with leafy top. Same drawing could serve either |
| Various | Different building types | Bank, hotel, theater facades can look similar when simplified to outlines |
| Appendix | Several flowers | Clavel (carnation) vs. geranio vs. violeta — all look like generic flower-blob |

**What HoloHola does:**
- AI-generated images can include distinguishing features that pen-and-ink at textbook scale cannot (texture, distinctive color even in muted tones, characteristic shape details)
- For inherently ambiguous items: pair the image with a very tight art brief that forces the key distinguishing feature
  - Olives: show them in an OLIVE JAR or with a distinctive elongated shape and pit cavity
  - Sardines: show the characteristic silver-blue coloring or show them in a TIN
  - Match: show it LIT with a flame that is clearly separate from a candle (the match stick and red tip are key)
  - Button: show it WITH THREAD HOLES, which no coin or pill has
- The "Question Fit Test" from `docs/image-analysis-madrigal.md` applies here: if the drawing could have two reasonable answers, it fails and must be redone

---

### 3. No Color in the Color Lessons — A Structural Impossibility

**What Madrigal does:** Lists colors in the appendix, introduces rojo via a tomato drawing (p. 25) — but the tomato is just a black circle with a stem. The book cannot show color.

**The problem:** Students learning "rojo" from a B&W tomato drawing don't actually see red. The concept of the color is entirely dependent on their prior knowledge of tomatoes. For a learner who didn't grow up associating tomatoes with red, this teaches nothing.

**What HoloHola does:**
- Full-color swatches for every color word — the color IS the image
- Color-coded vocabulary across all chapters — masculine words can have a subtle warm tone in their card background, feminine a cool tone (design decision: could visually reinforce gender without making it heavy-handed)
- The CANONICAL object for each color shown in actual color (red tomato, blue sky, green leaf, yellow sun)

---

### 4. Ser vs. Estar — Shown But Never Contrasted

**What Madrigal does:** Introduces ser (p. 15) and estar (pp. 74–81) in separate chapters, weeks of learning apart. The contrast is embedded in examples but never explicitly side-by-side.

**The problem:** This is the #1 confusion point for English speakers learning Spanish. Madrigal relies on students inferring the rule from accumulated examples, which works for some and fails others entirely.

**What HoloHola does:**
- A dedicated "Ser vs. Estar" comparison VerbAnchorGrid or narrative section that appears at the point when both have been introduced
- The contrast is shown with IDENTICAL SUBJECTS showing both verbs:
  - "El café es colombiano" (origin — ser) vs. "El café está caliente" (state — estar)
  - "Ella es estudiante" (identity — ser) vs. "Ella está nerviosa" (feeling — estar)
- The visual split (two columns) makes the distinction spatially obvious, not just textually noted

---

### 5. The Infinitive/Modal Page Is a Wall of Text

**What Madrigal does:** Pages 118–119 present ALL 10 modals + a large shared infinitive verb list as a dense text-only chart. It's the most information-dense spread in the book.

**The problem:** There is no visual grouping. A student looking at the modal list sees: ir a / tener que / querer / poder / me gusta / me gustaría / me encanta / me encantaría / debo — all with equal weight, no clustering by meaning category.

**What HoloHola does:**
- Group modals by MEANING CLUSTER with visual separation:
  - **Obligation:** tener que ("have to"), deber ("should"), necesitar ("need to")
  - **Desire:** querer ("want to"), me gustaría ("would like to"), me encantaría ("would love to")
  - **Ability:** poder ("can/be able to")
  - **Movement:** ir a ("going to")
  - **Pleasure:** me gusta ("like to"), me encanta ("love to")
- Each cluster gets a consistent icon or color in the VerbAnchorGrid
- The shared infinitive list becomes a searchable reference, not a printed wall

---

### 6. Practice Instructions Are Generic

**What Madrigal does:** At the end of most lesson pages: "Practique" or "Practice this pattern with a partner." No scaffolding on HOW.

**The problem:** Students studying alone (the primary use case for a self-study book) are given nothing to work with. Students studying with a partner get no guidance on roles, order, or variation.

**What HoloHola does:**
- Every VocabQA item is already interactive — Daniela asks, student answers, Daniela responds
- Conversation strips give explicit role context (who is saying what, in what setting)
- The AI tutor can dynamically vary the practice ("Now try it in the negative" / "Now ask ME the same question") — something a printed page could never do

---

### 7. No Visual Signal for Self-Assessment

**What Madrigal does:** Self-testing is entirely dependent on the student covering answers with a piece of paper or their hand. There's no built-in check. No "if you got this wrong, here's why."

**The problem:** Students who peek, guess correctly by accident, or just read without testing still feel like they "did the lesson." The format does not prevent passive reading.

**What HoloHola does:**
- VocabQA answers hidden by default; revealed only on tap
- Daniela tracks which items required multiple reveals or produced wrong first-attempts
- The system can flag items that need review and surface them in the next session
- No equivalent of "correct by accident" — if Daniela asks the question verbally, the student has to say the answer

---

### 8. Fixed Density (4 Items Always)

**What Madrigal does:** Every lesson page has exactly 4 Q&A items. Always 4.

**The problem:** Some vocabulary clusters are more important or more confusing than others. The preposition list (p. 73), for example, has 12 items crammed into a space designed for 4. The color list has 12 colors in the appendix with no drawings at all.

**What HoloHola does:**
- VocabQA grids can be 2, 4, 6, or 8 items depending on the concept
- High-frequency, high-confusion items get more practice slots (estar emotion states = 11 items, deserves more than 4)
- Lower-priority vocabulary can be presented in a reference-only list without the full Q&A treatment

---

### 9. Preterite Before Present — The Order Is Defensible But Unexplained

**What Madrigal does:** AR preterite (tomé, compré) appears at Phase 5 (pp. 120–131), BEFORE ER/IR present is taught (pp. 164–167). This means a student can say "I bought" before they can say "I eat."

**The problem:** The order is pedagogically justified — past tense often carries higher communicative need in storytelling — but it's never explained. Students who arrive with prior Spanish training, or who have a mental model of "present before past," feel genuinely disoriented.

**What HoloHola does:**
- Explain the pedagogical choice in a discoveryNote when preterite is introduced: "You're learning past tense before present — on purpose. You'll use 'I bought' and 'I ate' in real stories before you need 'I buy' and 'I eat' in their full present-tense forms."
- Show both tenses for a verb when present is finally introduced ("You already know compré — now here's the present: compro")

---

### 10. The EE Pages Aren't Anchored to Grammar

**What Madrigal does:** Everyday Expressions pages appear at natural pauses in the grammar sequence (pp. 43, 53, 71, 80–81, 162–163). But there's no explicit connection between the EE phrases and the grammar structures around them.

**The problem:** Students may treat EE pages as "extra" or "bonus" material rather than the practical payoff of the grammar they just learned. "Lo siento" and "Con permiso" appear with no note that they use the same structure as the verbs just taught.

**What HoloHola does:**
- Each EE expression in vocabQA is tagged with the grammar lesson it comes from
- discoveryNotes connect each survival phrase to its underlying structure: "'Necesito' is just the verb 'necesitar' in first person — same ending as all the AR verbs you've been practicing"

---

### 11. Weather Is Disconnected from Places and Movement

**What Madrigal does:** Weather expressions (pp. 176–177) appear late in Phase 8, disconnected from the places/movement chapter that opened the whole book (pp. 9–12).

**The problem:** Real communication combines these: "Voy al parque cuando hace buen tiempo." But the book teaches them 170 pages apart, and never shows them together.

**What HoloHola does:**
- Weather vocabulary introduced in the same chapter as places (or as a second half of a places chapter)
- VocabQA items naturally combine: "¿Por qué vas al parque? → Porque hace buen tiempo."
- The sentence frames grid shows weather + movement together

---

### 12. Gender Agreement Is Taught But Never Visually Tracked

**What Madrigal does:** Introduces -o/-a gender agreement early and applies it throughout. But every page still looks exactly the same — there's no visual reinforcement of "this word is feminine, this is masculine" beyond the text itself.

**The problem:** After 100 pages, students who are pattern-learners can do gender agreement intuitively. Students who are rule-learners are still consciously thinking "wait, is this -o or -a?" The book never builds a habit.

**What HoloHola does:**
- GenderAgreementGrid always shows both forms side by side with consistent visual pairing
- Masculine/feminine color-coding as a design decision (subtle, not heavy-handed) — e.g., masculine column always on the left with a consistent background, feminine always on the right
- The gendered ending (the -o or -a) can be visually highlighted in a different weight/color within the word: "content**o**" vs. "content**a**"

---

### 13. AR Compendium (pp. 160–161) Is Alphabetical, Not Frequency-Ordered

**What Madrigal does:** The 38 AR verbs on the compendium pages are listed in alphabetical order.

**The problem:** Alphabetical order puts "acompañar" and "aconsejar" at the top — both relatively rare verbs — while "hablar" (most common AR verb) is buried midway through. A student who uses the compendium as a study guide is spending time on low-frequency verbs.

**What HoloHola does:**
- Sort by frequency when displaying verb lists, not alphabetically
- Flag the top 10 most commonly used verbs in any list with a visual marker
- The VerbAnchorGrid can be sorted by the teacher (Daniela) based on what a student has used or needs

---

### 14. No Pronunciation Guide

**What Madrigal does:** Pages 9–10 give a brief pronunciation key at the opening, then never returns to it. The book assumes students can extrapolate pronunciation from the phonetic guide indefinitely.

**The problem:** Students who learned Spanish phonetically from Madrigal often have systematic pronunciation errors they're unaware of — particularly with rr, the distinction between c/z in Spain vs. Latin America, and the silent h. Without audio, there's no correction mechanism.

**What HoloHola does:**
- Every VocabQA item is spoken by Daniela (native-speed audio)
- Daniela can slow down, repeat, and flag common mispronunciations ("The 'j' in 'jefe' sounds like a strong H — not like English J")
- The phonetic guide is embedded in each word card, not just on page 1

---

### 15. The Book Is Spanish-Only

**What Madrigal does:** Teaches Spanish from English. Full stop.

**The problem:** A student who completes Madrigal has excellent Spanish foundations but no transferable system for learning French, Italian, Portuguese, German, or any other language.

**What HoloHola does:**
- The same M1–M6 chapter structure covers 10 languages with parallel content
- Cognate patterns cross-reference: a student who learned Spanish can see how French/Italian/Portuguese cognates overlap
- The grammar insight in one language (AR/-ER/-IR verb classes) explicitly maps to similar systems in other languages where relevant

---

## Summary: The Improvement Matrix

| Limitation | Root Cause | HoloHola Solution | Priority |
|---|---|---|---|
| Dialogue colors — all one color | B&W print constraint | Two-color Q&A, color-coded conversation bubbles | 🔴 High |
| Ambiguous drawings (olives, sardine, match) | Small B&W format | AI-generated images with distinguishing features; Question Fit Test | 🔴 High |
| No color in color lessons | Print constraint | Full-color swatches + colored canonical objects | 🔴 High |
| Ser vs. estar never contrasted | Linear structure | Side-by-side comparison grid at introduction of second verb | 🟠 Medium |
| Modal page is a wall of text | Page limit | Modal clusters by meaning category | 🟠 Medium |
| Practice is generic ("Practique") | No digital interactivity | Daniela asks dynamically; variation built in | 🟡 Already solved |
| No self-assessment feedback | Print constraint | Tap-to-reveal; Daniela tracks errors | 🟡 Already solved |
| Fixed 4-item density | Page format | Variable VocabQA grid density | 🟠 Medium |
| Preterite-before-present unexplained | Author choice | discoveryNote explaining the pedagogical reason | 🟠 Medium |
| EE phrases unanchored to grammar | Linear print structure | Tag each phrase to its source grammar lesson | 🟠 Medium |
| Weather disconnected from places | Chapter ordering | Weather in same chapter cluster as places | 🟡 Low — new chapters anyway |
| Gender agreement not visually tracked | B&W text | Consistent color/position pairing in GenderGrid | 🟠 Medium |
| Verb lists alphabetical not frequency | Alphabetical convention | Sort by frequency; badge top-10 | 🟡 Low |
| No pronunciation guide beyond page 1 | Print constraint | Daniela audio on every word; phonetic card | 🟡 Already solved |
| Spanish-only | Author scope | 10-language parallel platform | 🟡 Already solved |


---

## Part I.B — See It and Say It: Source Material Analysis


**Source:** Margarita Madrigal, *See It and Say It in Spanish* (Berkley/Penguin Random House, 1962; mass-market edition 2023). ISBN 9780451168375.

**Files on disk:**
- `attached_assets/see_it_and_say_it_1776200550664.pdf` — main text, 98 PDF pages → book pages 1–199 (2 per spread)
- `attached_assets/Appendix_See_it_and_say_it_spanish_1776200527397.pdf` — appendix, 29 PDF pages → book pages 201–253+

**Read status: COMPLETE.** All pages sampled as of Apr 14, 2026 (S56). See session log at the bottom.

---

## Drawing Style

Every lesson page contains 4 drawings: bold, simple black-and-white line art, clearly legible at small size. Each drawing is paired with a complete Spanish sentence using the lesson's target structure.

**For AI image generation:** Target this aesthetic — clean line art, no shading, minimal detail, single subject centred on white background. The Madrigal drawing is the gold standard for the HoloHola VocabQA grid images.

---

## Book Structure

| Section | Book Pages | PDF Pages | Content |
|---|---|---|---|
| Preface + suggestions | 1–7 | 1 | Methodology notes |
| Pronunciation Guide | 8 | 3 | Letter-by-letter guide |
| Conversation Lessons | 9–199 | 3–98 | 96 lesson spreads (~4 drawings each) |
| **APPENDIX** | | | |
| I. In the Restaurant | 203–207 | App 2–4 | ~40 food/drink words + drawings |
| II. In the Hotel | 208 | App 5 | ~25 hotel words |
| III. In the Stores and Shops | 209 | App 5 | ~15 shop types |
| IV. The Numbers | 210 | App 6 | 1–1000 |
| V. Days of the Week | 211 | App 6 | lunes–domingo |
| VI. Months of the Year | 211 | App 6 | enero–diciembre |
| VII. The Seasons | 212 | App 7 | 4 trees drawn |
| VIII. Members of the Family | 213 | App 7 | 22 family members (masc + fem pairs) |
| IX. The Colors | 214 | App 8 | 12 colors |
| X. Parts of the Body | 215 | App 8 | Full head-to-toe list |
| Grammar: AR verbs | 217–222 | App 9–11 | Full conjugation tables all tenses |
| Grammar: ER verbs | 223–227 | App 12–14 | Full conjugation tables all tenses |
| Grammar: IR verbs | 228–232 | App 15–17 | Full conjugation tables all tenses |
| Spanish-English Vocabulary | 233–252 | App 18–27 | Alphabetical glossary |
| Index | 253+ | App 28–29 | |

---

## Complete Conversation Lesson Map

Each row = one spread (two book pages). All "(unsampled)" entries have now been read and filled in.

| Book pp. | Key Phrase / Structure | Drawings Confirmed | Grammar Note |
|---|---|---|---|
| 9 | voy al ___ | hotel, banco, garage, restaurante | ir: voy/va/vamos/van |
| 10–11 | no voy / vamos al ___ | club, teatro, cine, parque | negation; vamos = "let's go" |
| 12–13 | ¿Va al ___? Sí, voy al ___ | banco, teatro, parque, cine | ¿Va? question form + exercise |
| 14–15 | el ___ es grande | tren, avión, auto, parque | es = ser; el (masculine); ser introduced |
| 15 | — | — | Ser: soy/es/somos/son |
| 16 | el ___ no es grande | sombrero, libro, disco, vaso | Words ending -o are masculine: el |
| 17 | la ___ (no) es grande | casa, montaña, pera, rosa | Words ending -a are feminine: la |
| 18 | el ___ es chiquito | vaso, sombrero, canario, pollo | -o adjectives with -o nouns: el/un |
| 19 | la ___ es chiquita | rosa, taza, violeta, sardina | -a adjectives with -a nouns: la/una |
| 20–21 | **¿Qué es? — un animal / una fruta** | vaca/caballo (animals), pera/naranja/manzana/piña (fruits) | ser for CATEGORY classification — new use of ser distinct from description |
| 22–23 | **¿Qué es? — una flor / una verdura** | tulipán/geranio/clavel/rosa (flowers), apio/zanahoria/lechuga/tomate (vegetables) | "una flor linda" — adjective linda introduced |
| 24–25 | **¿Es rojo el tomate?** | tomate, rosa, tulipán, verduras | **rojo = first color adjective** (p.25); also shows color as ser+adjective |
| 26–27 | Exercise: ¿Qué es? | gato, tomate, rosa, pera, manzana, tulipán, lechuga, perro | Consolidation — 4 category answers |
| 28 | ___ por favor | rosbif, la cuenta, vaso de agua, azúcar | Restaurant ordering phrases |
| 29 | ¿Tomó un ___? Sí, tomé un ___ | taxi, avión, tren, autobús | Tomar: tomé/tomó/tomamos/tomaron (preterite) |
| 30 | ¿Tomó ___? | sopa, café, chocolate, té | Tomar for eating/drinking |
| 31 | Tomé ___ para la cena | pollo, salmón, espárragos, café | para la cena phrase |
| 32 | ¿Compró ___? | blusa, periódico, automóvil, sombrero | Comprar: compré/compró/compramos/compraron |
| 33 | Compré ___ para la cena | pollo, apio, tomates, lechuga | esta noche phrase |
| 34–35 | Exercise + answers | — | Review: tomar + comprar + para la cena |
| 36 | Voy a comprar ___ | blusa, falda, corbata, bufanda | ir + a + infinitive (near future) |
| 37 | ¿Va a comprar ___? | sombrero, vestido, suéter, traje | Va/Vamos/Van a comprar |
| 38 | ___ esta mañana | sombrero, blusa, corbata | esta mañana phrase |
| 39 | ¿Van al ___? | hotel, garage, cine, mercado | van (3rd plural ir) |
| 40 | ¿Va a tomar un ___? | taxi, tren, autobús, avión | voy a tomar |
| 41 | ¿Va a tomar ___? | ensalada, café, sopa, apio | foods with voy a tomar |
| 42 | ¿Va a ___? | bailar, nadar, cantar, pescar | leisure verbs + infinitive |
| 43 | **Everyday Expressions #1** | (one man drawing) | Buenos días/tardes/noches; ¿Cómo está usted?; Gracias; De nada; Perdón; Con mucho gusto |
| 44–45 | ¿Tiene ___? | gato, canario, perro, caballo | tener: tiene/tengo/tenemos/tienen |
| 46–47 | ¿Tiene un ___? / Tengo un ___ | gato, perro, loro, tortuga | Possession questions + answers |
| 48–49 | ¿Tiene un gorila en casa? / ¡Eso es ridículo! | gorila, toro, elefante, hipopótamo | Humor pivot — first page with zero English below sentences |
| 50–51 | Tengo que ___. | ir, comprar, tomar, trabajar | tener que + infinitive (obligation) |
| 52–53 | No tengo tiempo / Tengo hambre | (one-man drawing) | **Everyday Expressions #2**: hambre/sed/frío/calor/razón + tener idioms |
| 54–55 | ¿Quiere ___? / Quiero ___ | chocolate, café, sopa, agua | querer: quiero/quiere/queremos/quieren |
| 56–57 | ¿Quiere ir al ___? / Quiero ir al ___ | teatro, cine, club, playa | querer + ir + a (desire + movement) |
| 58–59 | Te quiero / Lo quiero / La quiero | (person + object drawings) | quiero = I want AND I love — context determines; "Quiero a Roberto" personal a |
| 60–61 | Exercise: quiero comprar/ir | chocolates, camisa, corbata, playa, cine, concierto, casa | Review: quiero + infinitive |
| 62–63 | Exercise page (drawings only) | — | |
| 64–65 | **Plural rules: -os / -as** | sombrero/sombreros, rosa/rosas, libro/libros, casa/casas, caballo/caballos | -o → -os (el/los); -a → -as (la/las) |
| 66 | el ___ es bonito / Los ___ son bonitos | caballo/caballos, libro/libros, plátano, rábano | Singular → Plural: -o → -os |
| 67 | la ___ es bonita/deliciosa / Las ___ son bonitas | manzana/manzanas, mariposa, pera, rosa | Singular → Plural: -a → -as; adjectives: bonito/delicioso |
| 68–69 | el doctor / los doctores | doctor/actores, aviador/aviadores, tractor/tractores | Plural of -or words: add -es (no accent change) |
| 70–71 | Es muy ___ | valiente, interesante, inteligente, elegante | **Everyday Expressions #3**: ser + adjectives; muy amplified |
| 72–73 | *(exercise / review — plurals + ser)* | — | Consolidation page |
| 74–75 | ¿Dónde está ___? / Está en ___ | papá/despacho, mamá/casa, teatro/cine/banco | estar introduced: location; -or cognates sidebar |
| 76–77 | ¿Dónde está el ___? | lavamanos, tina, jabón, toalla | Bathroom vocabulary; estar + rooms |
| 78–79 | La mesa está en el ___. | comedor: mesa/silla/mantel/servilleta; sala: sofá/sillón/televisión/teléfono | Rooms: dining room + living room |
| 80–81 | La estufa está en la cocina. | estufa, olla, cafetera, refrigerador | Kitchen vocabulary; **Everyday Expressions #4**: estar + emotions (full list) |
| 82–83 | Exercise: ¿Dónde está? | tina/baño, toalla/baño, jabón/baño, sofá/sala, sillón/sala, estufa/cocina | Consolidation — 3 rooms |
| 84–85 | ¿Puede ir al ___? / Puedo ir | baile, ballet, concierto | poder: puedo/puede/podemos/pueden; can/be able to |
| 86–87 | ¿Hay ___? / Sí, hay ___ | sopa, crema, mantequilla, dinero | hay: there is/there are; existential |
| 88–89 | ¿Hay gorilas en la clase? ¡Ay no! | gorilas/mulas en la clase | Humor page #2 — hay with absurd existentials |
| 90–91 | Hay ___ en el hotel. | turistas, piscina, peluquero; zapatería/panadería/carnicería/joyería | hay + shops + hotel vocabulary |
| 92–93 | *(exercise / review — hay)* | — | Consolidation page |
| 94–95 | Me gusta la ___. / Le gusta el ___ | sopa, limonada, pollo, pescado, campo, música | me gusta introduced: inverse verb structure; "I like THE soup" rule |
| 96–97 | Me gustan los ___. / No me gusta ___ | espárragos, huevos, espinacas, frijoles; pescar/nadar/bailar | me gustan (plural); no me gusta + infinitive |
| 98–99 | ¿Le gustaría ir al ___? / Me gustaría ir | parque, teatro, cine, campo | me gustaría (polite: I would like); me encanta: I love |
| 100–101 | Me encantan las ___. / Me encantaría ir al ___ | cerezas, aceitunas, cebollas, fresas; cine/campo/museo/centro/playa | me encantan (plural); me encantaría (I would love to) |
| 102–103 | Exercise: me gusta/gustan | pollo, leche, pescado, espárragos, huevos, nadar, bailar, cine | Consolidation |
| 104–105 | Translate to Spanish (me gusta, me encanta) | — | leche/huevos/parque/salmón/México |
| 106–117 | *(exercise + extension pages — me gusta/gustaría/encanta)* | — | |
| 118–119 | **THE INFINITIVE MASTER PAGE** | — | ALL modal constructions together: voy a / va a / tengo que / tiene que / quiero / quiere / puedo / no puedo / me gusta / me gustaría / me encanta / **debo** (new!) + right-column infinitive list: vender/leer/escribir/ir/comprender/recibir/estudiar/trabajar/caminar/hablar/comprar/dejar — "The TO form ends in ar, er or ir — this is the infinitive" |
| 120–121 | Exercise: voy a vender/leer/escribir/recibir | casa, lancha, boletos, libro, periódico, revista, carta, tarjeta postal | Covers all 3 infinitive endings |
| 122–123 | ¿Estudió/nadó/pagó hoy? | estudiar, nadar, pagar la cuenta, comprar bata; lancha, casa | AR preterite: 3rd person -ó endings; alquilar conjugation |
| 124–125 | **Dejar (to leave behind)** | valija/hotel, guantes/teatro, portafolio/banco, llave/mesa | dejé/dejó/dejamos/dejaron; new vocabulary: valija, guantes, pasaporte, pipa, llave |
| 126–127 | ¿Tomó el desayuno/almuerzo/la cena? | té, café, jugo de naranja, huevos fritos, pan tostado | Meals vocabulary; tomamos (plural) |
| 128–129 | ¿Alquilaron una ___? / Alquilamos | lancha, casa, autobús | alquilar plural (alquilamos/alquilaron); also dejamos/dejaron review |
| 130–131 | Exercise: alquilar + dejar + tomar | lancha/casa, autobús/auto, guantes, perro, jugo de naranja, pan tostado, huevos fritos | Both "we" and "they" forms side by side |
| 132–133 | **ER/IR Preterite — 1st + 3rd person** | paquete, carta, programa de televisión, lancha | recibí/recibió; escribí/escribió; vendí/vendió; vi/vió — "ER and IR verbs end in í (self) and ió (anyone else)" |
| 134–135 | **Ver preterite + circus** | estatua, pintura, traje nuevo, sombrero nuevo; payaso, elefante en circo | vi/vió; LOS NIÑOS vieron — first PLURAL SUBJECT (3rd person plural); chistoso = funny; circo/payaso/mono |
| 136–137 | Exercise: vi/vió | traje, sombrero, paquete, carta, caja de chocolates, botella de perfume, billetera, portafolio | para mi cumpleaños / para la Navidad |
| 138–139 | Exercise answers: ER/IR preterite | — | |
| 140–149 | *(exercise/extension — preterite review)* | — | |
| 150–151 | **Traer + Decir (irregular preterites) + first IMPERFECT** | libro, disco; cuchara/plato/servilleta/mantel/jarra/vaso/cuchillo | traer: traje/trajo/trajimos/trajeron; decir: dije/dijo/dijimos/dijeron; **indirect object le**: "Le traje un libro" / "Le dije que era interesante" — **ERA = first imperfect** (used in reported speech only: era interesante/terrible/excelente/imposible/formidable); limpio/sucio adjectives + tableware vocabulary |
| 152–153 | **Voy al ___ + days of week** | teatro/jueves, concierto/viernes, iglesia/domingo, despacho/lunes, biblioteca | Scheduling: el jueves/viernes/domingo/lunes/martes — days in action context |
| 154–159 | *(exercise/extension — preterite + scheduling)* | — | |
| 160–161 | **AR Verb Compendium — Present Tense** | (one example drawing) | Full compro/compra/compramos/compran table + 38-verb list: hablar, comprar, estudiar, nadar, cantar, bailar, viajar, trabajar, preparar, invitar, visitar, dejar, saludar, estacionar, usar, llamar, mirar, esperar, ayudar, preguntar, cambiar, ganar, mandar, lavar, planchar, alquilar, caminar, votar, importar, exportar, entrar, fumar, tomar, llevar, regresar, contestar |
| 162–163 | **Everyday Expressions #5: ¿A qué hora? + frequency + status** | fiesta/5 o'clock, concierto/8, cine/9, cita/8 | ¿A qué hora? → a las dos/cinco/ocho/nueve; frequency: Una vez / Dos veces / Unas veces / Muchas veces / De vez en cuando / Otra vez / Tal vez; status: Es todo / Nada / Sin / Siempre / Nunca / Necesito / Está bien / Con permiso / Depende / Ya / Seguro / No importa / Lo siento / Creo que sí/no / Espero que sí |
| 164–165 | **ER/IR Verbs Present Tense in context** | periódico/no; libro/sí; lápiz/sí; máquina/sí; español; Nueva York | leer: leo/lee; escribir: escribo/escribe; vivir: vivo/vive; comprender: comprendo; aprender: aprendo; vender: vendo — "You can drop usted in questions" |
| 166–167 | **ER and IR conjugation tables** | — | ER: vendo/vende/vendemos/venden; IR: vivo/vive/vivimos/viven — The complete present tense tables for both classes |
| 168–177 | *(extension — ER/IR verb practice)* | — | |
| 176–177 | **Weather: hace frío/calor/fresco/viento** | winter cold, October fresh, September fresh, summer hot; nieve en diciembre, lloviendo | hace frío/calor/fresco/viento; Seasons: en el invierno/la primavera/el verano/el otoño; months: septiembre/octubre/noviembre/diciembre; ¿Está lloviendo? — present progressive for weather |
| 178–179 | **México composition** (culminating reading) | montañas altas, fuentes iluminadas | Extended reading passage in PAST tense: fui (I went), llegué (I arrived), caminé, vi, hablé español, compré regalos; vocabulary: un país lindo, avenidas anchas, parques grandes, iglesias antiguas, museos extraordinarios, tiempo colonial |
| 180–181 | *(extension reading)* | — | |
| 182–183 | **estar + -ando (Present Progressive)** | tocando violín, tocando acordeón, nadando, patinando | ING = ANDO for AR verbs; estoy/está/estamos/están + -ando; estudiando, hablando, cantando, comprando |
| 184–187 | *(extension — present progressive)* | — | |
| 188–189 | ¿Ha comprado/vendido ___? | bicicleta, casa, auto, lancha | haber + -ado/-ido (present perfect); -ar → -ado, -er/-ir → -ido |
| 190–193 | *(extension — present perfect)* | — | |
| 194–195 | ¿Le mandó/trajo ___? | paquete, paraguas, disco, libro | Indirect object pronouns; me lo / se lo |
| 196–197 | *(extension)* | — | |
| 198–199 | **Commands + Subjunctive** | — | Commands: escriba / oiga / traigamelo / venga acá / hágalo / dígame — GA irregular commands; Subjunctive: Espero que venga a la fiesta / Espero que me escriba / Quiero que lo haga / Quiero que lo traiga — "Pronouns go BEFORE the subjunctive; pronouns attach TO commands" |

---

## The Five Everyday Expressions Pages

Madrigal inserts 5 "Everyday Expressions" spreads as pedagogical pivots — each consolidates spoken-use structures beyond the lesson grammar. These are the most important single pages for conversational fluency.

| Page | Theme | Key expressions |
|---|---|---|
| p. 43 — EE #1 | Greetings | Buenos días/tardes/noches; ¿Cómo está usted? Bien, gracias; De nada; Perdón; Con mucho gusto |
| p. 53 — EE #2 | Tener idioms | tengo hambre/sed/frío/calor/razón/sueño/miedo/prisa |
| pp. 70–71 — EE #3 | Ser + adjectives | Es muy valiente/interesante/inteligente/elegante/horrible/magnífico/espléndido |
| pp. 80–81 — EE #4 | Estar + emotions/states | contento/a, cansado/a, ocupado/a, enfermo/a, listo/a, solo/a, enojado/a, furioso/a, aburrido/a, enamorado/a, triste, cómodo; bien/mejor/mal/peor; estamos/están/estoy — first person requires gender match: estoy contento (man) / estoy contenta (woman) |
| pp. 162–163 — EE #5 | Time + frequency + status | ¿A qué hora? / Una vez / Muchas veces / De vez en cuando / Siempre / Nunca / Necesito / Lo siento / Con permiso / Creo que sí/no / Espero que sí |

---

## Complete Verb / Structure Sequence (full book)

The order Madrigal teaches structures follows communicative phases, not grammar categories. Each verb is introduced because students now NEED it to say the next thing.

### Phase 1 — Survival Foundations (pp. 9–43)
| Book pp. | Structure | Communicative Need |
|---|---|---|
| 9–12 | **ir** (voy/va/vamos/van) | "Where are you going?" — spatial orientation |
| 14–19 | **ser** (es) + articles el/la | "What is it?" — descriptions, gender |
| 16–19 | Gender rules | Grammar pause — essential before continuing |
| 20–25 | **¿Qué es? → Es un animal / una fruta / una flor / una verdura** | ser for CLASSIFICATION (new use) — not description but category assignment |
| 24–25 | **rojo** + linda | First color adjective; first "pretty/lovely" adjective |
| 28–31 | **tomar** (preterite) | "I had coffee / I took a taxi" — meals + transport |
| 32–33 | **comprar** (preterite) | "I bought / I need to buy" — shopping |
| 36–42 | **ir + a + infinitive** | "I'm going to buy/dance" — near future |
| 43 | Everyday Expressions #1 | Buenos días/tardes/noches; gracias/perdón |

### Phase 2 — Ownership, Need, and Desire (pp. 44–62)
| Book pp. | Structure | Communicative Need |
|---|---|---|
| 44–47 | **tener** (tengo/tiene/tenemos/tienen) | "Do you have...?" — possession |
| 48–49 | tener (humor) | Absurd animals — reinforcement through surprise |
| 50–51 | **tener que** + infinitive | "I have to go" — obligation |
| 52–53 | Everyday Expressions #2 | Tener idioms: hambre/sed/frío/calor/razón |
| 54–59 | **querer** (quiero/quiere) + personal a | "I want / I love" — desire AND emotion; "Quiero a Roberto" |

### Phase 3 — Description, Plurality, and Location (pp. 64–83)
| Book pp. | Structure | Communicative Need |
|---|---|---|
| 64–67 | Plural rules (-o → -os, -a → -as); bonito/delicioso | Grammar pause — must handle groups |
| 68–69 | Plural of -or words (-or → -ores) | Cognate words: actor/actores |
| 70–71 | Everyday Expressions #3 | **ser + adjective**: Es muy valiente/inteligente |
| 74–77 | **estar** (location: ¿dónde?) | "Where is it?" — navigation + finding things |
| 78–80 | estar + rooms | Household rooms + objects |
| 80–81 | Everyday Expressions #4 | **estar + emotions**: contento/cansado/listo/enojado (full 11-item list + estoy gender note) |

### Phase 4 — Ability, Existence, and Preference (pp. 84–119)
| Book pp. | Structure | Communicative Need |
|---|---|---|
| 84–85 | **poder** (puedo/puede) | "Can you come?" — ability + invitations |
| 86–91 | **hay** | "Is there any...?" — existence, shopping checks |
| 94–97 | **me gusta / me gustan** | "I like..." — inverse verb structure (leap!) |
| 98–99 | **me gustaría** | "I would like..." — polite desire, social register |
| 99–101 | **me encanta / me encantaría / me encantan** | "I love / I would love to..." — emotional intensity |
| 118–119 | **THE MASTER INFINITIVE PAGE** | ALL 10+ modals consolidated: ir a / tener que / querer / poder / me gusta / me gustaría / me encanta / **debo** (new) — with shared infinitive list vender/leer/escribir/ir/comprender/recibir/estudiar/trabajar/caminar/hablar/comprar/dejar |

### Phase 5 — Past Tense I: AR Verbs (pp. 120–131)
| Book pp. | Structure | Communicative Need |
|---|---|---|
| 120–123 | AR preterite review: estudió/nadó/pagó/alquiló | "What did you do yesterday?" — completed action |
| 124–125 | **dejar** (dejé/dejó/dejamos/dejaron) | "Where did you leave it?" — losing/placing things |
| 126–127 | **Meals in preterite**: tomó/tomamos el desayuno | "What did you have for breakfast?" |
| 128–131 | **Plural AR preterite**: alquilamos/alquilaron; dejamos/dejaron; tomamos/tomaron | "We rented / They rented" — third party narration begins |

### Phase 6 — Past Tense II: ER/IR Verbs (pp. 132–155)
| Book pp. | Structure | Communicative Need |
|---|---|---|
| 132–133 | **ER/IR preterite**: recibí/recibió; escribí/escribió; vendí/vendió; vi/vió | New tense class — different endings: -í / -ió |
| 134–135 | **Ver + plural subjects**: Los niños vieron | First use of 3rd person PLURAL subject + preterite |
| 134–135 | circus vocabulary | circo, payaso (clown), mono (monkey), chistoso (funny) |
| 150–151 | **Traer** (traje/trajo/trajimos/trajeron) | "I brought you a book" — irregular preterite |
| 150–151 | **Decir** (dije/dijo/dijimos/dijeron) | "I told you it was..." — irregular preterite |
| 150–151 | **Indirect object le** + **era (first imperfect)** | "Le traje un disco" / "Le dije que era interesante" — era used naturally in reported speech |
| 150–151 | Clean/dirty: **limpio/sucio** | Table setting vocabulary: cuchara, plato, mantel, servilleta, jarra, cuchillo |

### Phase 7 — Present System Expansion (pp. 152–169)
| Book pp. | Structure | Communicative Need |
|---|---|---|
| 152–153 | **Days of week in scheduling** | "I'm going to the theater on Thursday" — voy al + día |
| 160–161 | **AR Verb Compendium** | Grammar pause — 38 common AR verbs + full present table (compro/compra/compramos/compran) |
| 162–163 | Everyday Expressions #5 | ¿A qué hora? + frequency expressions + status phrases (Necesito / Lo siento / Con permiso) |
| 164–167 | **ER/IR verbs present tense** + conjugation tables | leer/leo, escribir/escribo, vivir/vivo, comprender/comprendo, aprender/aprendo, vender/vendo — "Usted can be dropped in questions" |

### Phase 8 — Weather, Reading, Progressive (pp. 170–183)
| Book pp. | Structure | Communicative Need |
|---|---|---|
| 176–177 | **Weather**: hace frío/calor/fresco/viento | "What's the weather like?" — seasons + months |
| 176–177 | ¿Está lloviendo? | Present progressive for weather — preview of next structure |
| 178–179 | **México composition** | Culminating reading passage: past tense narrative (fui, llegué, caminé, vi, hablé, compré) |
| 182–183 | **estar + -ando** (present progressive) | "ING = ANDO" — estoy/está/estamos/están + -ando |

### Phase 9 — Advanced Structures (pp. 184–199, Appendix)
| Book pp. | Structure | Communicative Need |
|---|---|---|
| 188–189 | **Present perfect**: he/ha + -ado/-ido | "Have you bought...?" — recent past |
| 194–195 | **Indirect objects**: me lo / se lo | "Send it to me / I'll bring it to you" |
| 198–199 | **Commands** (GA irregulars) | oiga / traigamelo / venga acá / hágalo / dígame / escriba |
| 198–199 | **Subjunctive**: Espero que / Quiero que | "I hope you'll come" — "I want you to do it" |

---

## The English-Fade Pattern

Madrigal systematically removes English scaffolding as the book progresses. This is the "see it and say it" method made visible:

| Book pages | English presence | What replaces it |
|---|---|---|
| pp. 9–20 | Every sentence has English equivalent | Both languages shown explicitly |
| pp. 21–45 | English in headers + new vocab only | Drawings carry Q&A meaning |
| pp. 46–75 | English only on first example per structure | Subsequent examples: drawing only |
| pp. 84–101 | Near-zero English | Even first examples rely on drawings |

**The pivot point:** pp. 48–49 (gorila/toro/elefante). Absurd animal scenarios provide the humor that compensates for removed English scaffolding. Students laugh → they remember → they don't need the translation.

**HoloHola design implication:** VocabQA items should NOT show English by default. The image IS the translation. English appears only on tap/demand. This honors Madrigal's core method.

---

## Pedagogical Mapping to HoloHola Components

### M1 — VocabQA Grid
The book's core lesson format IS M1: see the drawing, say the word, answer the question. Every drawing + sentence pair maps directly to a VocabQA item.

**Priority for Chapter 1 (Greetings):**
- Buenos días / buenas tardes / buenas noches (p. 43)
- ¿Cómo está usted? / Bien, gracias / De nada / Perdón (p. 43)
- Voy al hotel / banco / restaurante / garage (pp. 9–11)

**Priority for Chapter 2 (Family):**
- Family member vocabulary from appendix p. 213 (all 22 items)

**Priority for Chapter 3 (Numbers):**
- Numbers vocabulary from appendix p. 210

**NEW — Chapter for ¿Qué es? (Categories):**
- 4 category system: un animal / una fruta / una flor / una verdura
- Animals: vaca, caballo, gato, perro, mula, tigre, león
- Fruits: pera, naranja, manzana, piña
- Flowers: rosa, tulipán, geranio, clavel
- Vegetables: apio, zanahoria, lechuga, tomate
- First color: rojo (pp. 24–25) — "¿Es rojo el tomate? Sí, el tomate es rojo."

### M2 — GenderAgreement Grid
Pages 16–19 are the canonical M2 source. Madrigal teaches gender via three explicit rules:
1. Words ending in **-o** are masculine → take **el / un**
2. Words ending in **-a** are feminine → take **la / una**
3. Adjectives match: chiquito with -o words, chiquita with -a words

**Confirmed gender pairs (masculine / feminine same concept):**
- el sombrero / la bufanda (clothing)
- el vaso / la taza (containers)
- el canario / la sardina (animals)
- el plátano / la rosa (produce/nature)
- el libro / la violeta

**M2 seeding from this book:**
- 8 masculine items with drawings (pp. 16, 18)
- 8 feminine items with drawings (pp. 17, 19)
- Rule note: "Words ending in -o take el/un; words ending in -a take la/una"

### M3 — Cognate Recognition
The preface explicitly states the method: "thousands of words in Spanish are similar to or identical to their English equivalents."

Madrigal cognates confirmed from lesson text:
- hotel → hotel
- restaurante → restaurant
- banco → bank
- garage → garage
- teatro → theater
- chocolate → chocolate
- salmón → salmon
- automóvil → automobile
- suéter → sweater
- violeta → violet
- sardina → sardine
- tomate → tomato
- espárragos → asparagus
- ensalada → salad
- acordeón → accordion
- teléfono → telephone
- periódico → periodic(al)

**→ These form the M3 cognate grid for Spanish ch. 1.**

### M4 — VerbAnchor Grid
Every lesson page bottom has the current verb's conjugation table. The verb progression:

| Verb | Page | Tense | Pattern |
|---|---|---|---|
| ir (to go) | 9–11 | Present | voy / va / vamos / van |
| ser (to be) | 15 | Present | soy / es / somos / son |
| tomar (to take/have) | 29 | Preterite | tomé / tomó / tomamos / tomaron |
| comprar (to buy) | 32–33 | Preterite | compré / compró / compramos / compraron |
| tener (to have) | 44–47 | Present | tengo / tiene / tenemos / tienen |
| querer (to want/love) | ~54 | Present | quiero / quiere / queremos / quieren |
| estar (to be) | 74–75 | Present | estoy / está / estamos / están |
| poder (can/be able) | 84–85 | Present | puedo / puede / podemos / pueden |
| alquilar (to rent) | 123 | Preterite | alquilé / alquiló / alquilamos / alquilaron |
| dejar (to leave) | 124–125 | Preterite | dejé / dejó / dejamos / dejaron |
| recibir/escribir/vender | 132–133 | Preterite | ER/IR: -í / -ió / -imos / -ieron |
| ver (to see) | 134–135 | Preterite | vi / vió / vimos / vieron |
| traer (to bring) | 150–151 | Preterite | traje / trajo / trajimos / trajeron |
| decir (to say) | 150–151 | Preterite | dije / dijo / dijimos / dijeron |
| leer/escribir/vivir | 164–167 | Present | leo/leo / escribo/escribe / vivo/vive |
| estar + -ando | 183 | Progressive | estoy / está / estamos / están + -ando |
| haber + -ado/-ido | 189 | Perfect | he / ha / hemos / han + past participle |

**Key grammar meta-notes from the book:**
- p. 29: "AR verbs end in -é when you speak of yourself, -ó when speaking of anyone else (singular)"
- p. 132: "ER and IR verbs end in -í (self) and -ió (anyone else singular)" in the past
- p. 165: "In questions, you can use or drop the word usted — both forms heard in ordinary conversation"
- p. 167: ING = ANDO (for AR verbs)
- p. 150: **era** = first imperfect, introduced in reported speech ("Le dije que era interesante") — not labeled "imperfect" yet, just absorbed naturally

### M5 — Scene Image (Visual Context)
The book's drawings ARE the scenes. Each drawing is a standalone visual that anchors the sentence.

For our AI image generation system: these are the exact prompts. E.g.:
- `"Simple line drawing, Hotel Ritz facade with doorman in uniform standing at entrance, bold black lines, white background, Madrigal textbook style"`

### M6 — Compartment (Verb + Tense Matrix)
The Grammar Section (appendix pp. 217–232) has complete conjugation tables for ALL tenses across AR/ER/IR verbs — this is the M6 master reference.

**AR verb table covers (pp. 217–222):** Present, Preterite, Imperfect, Future, Conditional, Subjunctive, Present Perfect, Past Perfect, Present Progressive, Past Progressive, Commands
**ER verb table covers (pp. 223–227):** Same structure + common ER verb list
**IR verb table covers (pp. 228–232):** Same structure + common IR verb list (recibir, resistir, subir, sufrir, vivir, permitir, persuadir, aplaudir)

---

## Color Reference (Appendix p. 214)

| Spanish | English |
|---|---|
| blanco | white |
| negro | black |
| rojo | red |
| colorado | red (alternate) |
| color café | brown |
| pardo | brown (alternate) |
| azul | blue |
| verde | green |
| gris | grey |
| amarillo | yellow |
| morado | purple |
| rosado | pink |

**First introduced in lessons:** rojo (p. 25) — "¿Es rojo el tomate? Sí, el tomate es rojo."

---

## Parts of the Body (Appendix p. 215)

**Head:** la cabeza, la cara, la nariz, las orejas, la boca, la barba, las mejillas, la frente, las pestañas, las cejas, los párpados, los dientes, la lengua, el pelo, el bigote, el cuello, la garganta

**Upper body:** los hombros, los brazos, los codos, las muñecas, las manos, los dedos, las uñas, la espalda, el estómago, el pecho, la cintura, las caderas

**Lower body:** las piernas, las rodillas, los tobillos, los pies, los dedos de los pies

---

## Complete Visual Asset Inventory (by topic)

### Places / Locations
| Spanish | English | Drawings seen in book |
|---|---|---|
| el hotel | the hotel | ✓ (Hotel Ritz facade, doorman) |
| el banco | the bank | ✓ (barred door, street scene) |
| el garage | the garage | ✓ (sign + pump) |
| el restaurante | the restaurant | ✓ (street facade) |
| el club | the club | ✓ (Men's Club door) |
| el teatro | the theater | ✓ (stage curtains) |
| el cine | the movie theater | ✓ (Spring Love marquee) |
| el parque | the park | ✓ (bench + trees) |
| el mercado | the market | ✓ (Fruits shop awning) |
| la casa | the house | ✓ (simple house with chimney) |
| la playa | the beach | (from exercise text) |
| el concierto | the concert | (from exercise text) |
| la biblioteca | the library | (from pp. 152) |
| el despacho / la oficina | the office | (from pp. 152) |

### Transportation
| Spanish | English | Drawings seen |
|---|---|---|
| el taxi | the taxi | ✓ (car with TAXI sign) |
| el avión | the airplane | ✓ (side view) |
| el tren | the train | ✓ (streamlined train) |
| el autobús | the bus | ✓ (side view) |
| el auto / el automóvil | the car | ✓ (sports car) |
| la lancha | the boat | ✓ (motorboat) |
| la bicicleta | the bicycle | ✓ (from exercise text) |

### Food & Drink (main lessons)
| Spanish | English | Drawings seen |
|---|---|---|
| la sopa | soup | ✓ (steaming bowl) |
| el café | coffee | ✓ (coffee pot) |
| el chocolate | hot chocolate | ✓ (mug with steam) |
| el té | tea | ✓ (teapot) |
| la ensalada | salad | ✓ (bowl) |
| el pollo | chicken | ✓ (whole roast chicken) |
| el salmón | salmon | ✓ (fish on platter) |
| los espárragos | asparagus | ✓ (bunch) |
| el apio | celery | ✓ (stalk) |
| los tomates | tomatoes | ✓ (two tomatoes) |
| la lechuga | lettuce | ✓ (head of lettuce) |
| el rosbif | roast beef | ✓ (on plate) |
| la cuenta | the check/bill | ✓ (handwritten check) |
| el azúcar | sugar | ✓ (sugar bowl) |
| un vaso de agua | glass of water | ✓ (glass) |
| el bistec | beefsteak | (text only) |
| el sandwich | sandwich | (text only) |
| huevos fritos | fried eggs | ✓ (frying pan) |
| pan tostado | toast | ✓ (toaster) |
| jugo de naranja | orange juice | ✓ (glass + orange) |

### Fruits (¿Qué es? — pp. 20–21)
| Spanish | English |
|---|---|
| la pera | pear |
| la naranja | orange |
| la manzana | apple |
| la piña | pineapple |

### Flowers (¿Qué es? — pp. 22–23)
| Spanish | English |
|---|---|
| la rosa | rose |
| el tulipán | tulip |
| el geranio | geranium |
| el clavel | carnation |

### Vegetables (¿Qué es? — pp. 22–23)
| Spanish | English |
|---|---|
| el apio | celery |
| la zanahoria | carrot |
| la lechuga | lettuce |
| el tomate | tomato |

### Animals (¿Qué es? — pp. 20–21 + earlier)
| Spanish | English |
|---|---|
| el gato | cat |
| el perro | dog |
| el caballo | horse |
| la vaca | cow |
| la mula | mule |
| el tigre | tiger |
| el león | lion |
| el canario | canary |
| el loro | parrot |
| la tortuga | turtle |
| el gorila | gorilla |
| el toro | bull |
| el elefante | elephant |
| el hipopótamo | hippopotamus |
| la mariposa | butterfly |

### Circus Animals (pp. 134–135)
| Spanish | English |
|---|---|
| el payaso | clown |
| el mono | monkey |
| el elefante | elephant |
| el circo | circus |

### Clothing
| Spanish | English | Drawings seen |
|---|---|---|
| la blusa | blouse | ✓ (on hanger) |
| la falda | skirt | ✓ (on hanger) |
| la corbata | tie | ✓ |
| la bufanda | scarf | ✓ |
| el sombrero | hat | ✓ (wide brim) |
| el vestido | dress | ✓ (on hanger) |
| el suéter | sweater | ✓ (knit sweater) |
| el traje | suit | ✓ (jacket + pants) |
| la camisa | shirt | (exercise text) |
| una bata | bathrobe | ✓ (hanging robe) |

### Household / Rooms
| Spanish | English |
|---|---|
| **Sala** | living room |
| el sofá | sofa |
| el sillón | armchair |
| la televisión | television |
| el teléfono | telephone |
| **Comedor** | dining room |
| la mesa | table |
| la silla | chair |
| el mantel | tablecloth |
| la servilleta | napkin |
| **Cocina** | kitchen |
| la estufa | stove |
| la olla | pot |
| la cafetera | coffee maker |
| el refrigerador | refrigerator |
| **Baño** | bathroom |
| el lavamanos | sink |
| la tina | bathtub |
| el jabón | soap |
| la toalla | towel |
| **Tableware** (pp. 150–151) | |
| la cuchara | spoon |
| el cuchillo | knife |
| el vaso | glass |
| el plato | plate |
| la jarra | pitcher |

### Adjectives Taught Through Contrast
| Spanish | English | Contrast pair |
|---|---|---|
| grande | big | el/la ___ es grande |
| chiquito / chiquita | little | masculine vs feminine page |
| bonito / bonita | pretty | singular vs plural pages |
| delicioso / deliciosa | delicious | singular vs plural pages |
| rojo | red | first color (p. 25) — ser + color |
| linda | lovely | "una flor linda" (p. 23) |
| chistoso | funny | "el payaso es muy chistoso" (p. 135) |
| limpio / limpia | clean | tableware context (p. 151) |
| sucio / sucia | dirty | tableware context (p. 151) |

### Seasons (appendix p. 212)
| Spanish | English |
|---|---|
| la primavera | spring |
| el verano | summer |
| el otoño | fall |
| el invierno | winter |

### Family Members (appendix p. 213)
| Masculine | Feminine |
|---|---|
| mi padre | mi madre |
| mi hermano | mi hermana |
| mi abuelo | mi abuela |
| mi primo | mi prima |
| mi suegro | mi suegra |
| mi tío | mi tía |
| mi cuñado | mi cuñada |
| mi nieto | mi nieta |
| mi sobrino | mi sobrina |
| mi hijo | mi hija |
| mi esposo | mi esposa |
| mis padres | mis parientes |

---

## Image Generation Queue (Priority Order)

### Phase 1 — Chapter 1 (Greetings) [IMMEDIATE]
| Concept | Spanish sentence | Notes |
|---|---|---|
| Buenos días (morning greeting) | Buenos días, señor. | Man tipping hat, morning light |
| Buenas tardes (afternoon) | Buenas tardes, señora. | |
| Buenas noches (evening) | Buenas noches. | |
| ¿Cómo está usted? | ¿Cómo está usted? Bien, gracias. | Two people greeting |
| Voy al hotel | Voy al hotel. | Hotel facade |
| Voy al banco | Voy al banco. | Bank building |
| Voy al restaurante | Voy al restaurante. | Restaurant exterior |
| Voy al cine | Voy al cine. | Movie theater marquee |

### Phase 2 — Chapter 2 (Family) [HIGH]
| Concept | Notes |
|---|---|
| mi padre / mi madre | Classic parent pair |
| mi hermano / mi hermana | Sibling pair |
| mi abuelo / mi abuela | Grandparent pair |
| mi hijo / mi hija | Child pair |
| mis padres | Both parents together |
| mi familia | Full family scene |

### Phase 3 — ¿Qué es? Categories [HIGH — new]
| Concept | Notes |
|---|---|
| El gato es un animal | Cat with category label |
| La pera es una fruta | Pear with category label |
| La rosa es una flor | Rose with category label |
| El tomate es una verdura | Tomato with category label |
| ¿Es rojo el tomate? Sí, es rojo. | Tomato with rojo label (first color) |

### Phase 4 — Chapter 3 (Numbers) [HIGH]
Numbers 1–10 illustrated with objects, then 11–20, then tens up to 100.

### Phase 5 — Gender Agreement (M2 deep content) [MEDIUM]
The 8+8 el/la contrast pairs from pp. 16–19.

### Phase 6 — Verb scenes (M4 illustrations) [MEDIUM]
Actions for each verb chapter: ir (going), tomar (eating/drinking), comprar (shopping), querer (wanting).

### Phase 7 — Food & Restaurant [MEDIUM]
Full restaurant vocabulary from appendix pp. 203–207 (~40 items).

---

## Status: FULL BOOK COVERAGE COMPLETE

All previously unsampled sections have been read. No remaining gaps.

---

## Session Log

| Date | Action | Pages covered |
|---|---|---|
| Apr 14, 2026 | Initial scan received; orientation confirmed | Preface, ToC |
| Apr 14, 2026 | Full read pass: main book sampled | pp. 8–43, 62–67, 122–127, 178–183, 188–195 |
| Apr 14, 2026 | Appendix sampled | Appendix pp. 201, 204–209, 212–213 |
| Apr 14, 2026 | Roadmap document created | This file |
| Apr 14, 2026 (S54) | Full read of previously unsampled sections | pp. 44–103 (tener/tener que/querer/estar/poder/hay/me gusta/me gustaría/me encanta) |
| Apr 14, 2026 (S54) | Complete verb sequence mapped (Phase 1–4) | Added to this file |
| Apr 14, 2026 (S54) | English-fade pattern confirmed and documented | Added to this file |
| Apr 14, 2026 (S54+55) | T001–T003: types + components + wiring confirmed done | chapter-intro-content.ts, TextbookInfographics.tsx, ChapterIntroduction.tsx |
| Apr 14, 2026 (S54+55) | T004: Spanish greetings vocabQA → Madrigal p.43 sources; tener idioms (p.53) added to numbers verbGroups | chapter-intro-content.ts |
| Apr 14, 2026 (S54+55) | T005: Bloviation audit — greetings + family welcomeText revised | chapter-intro-content.ts |
| Apr 14, 2026 (S54+55) | T006: Portuguese cognateOpener bug fixed (native → target field); expanded to 20 entries | chapter-intro-content.ts |
| Apr 14, 2026 (S56) | **COMPLETE BOOK READ** — all remaining unsampled sections | pp. 20–27 (¿Qué es? categories + rojo); pp. 64–65 (plurals confirmed); pp. 72–73, 82–83, 92–93 (exercise pages); pp. 102–119 (modal consolidation + debo); pp. 124–125 (dejar preterite); pp. 128–155 (alquilar plural; ER/IR preterite; ver + circo; traer/decir irregulars; ERA first imperfect; limpio/sucio); pp. 152–169 (days of week; AR compendium 38 verbs; EE #5; ER/IR present tables); pp. 170–183 (weather; México composition; present progressive); pp. 184–199 (present perfect; indirect objects; commands; subjunctive); full appendix (colors, body parts, family, full conjugation tables) |
| Apr 14, 2026 (S56) | Phases 5–9 added to roadmap verb sequence | All tenses now charted: preterite ER/IR, era imperfect, present progressive, perfect, commands, subjunctive |
| Apr 14, 2026 (S56) | 5 Everyday Expressions pages fully catalogued | EE #1–#5 with complete expression lists |
| Apr 15, 2026 (S63) | Magic Key to Spanish — FULL scan read (97MB PDF, 11,018 lines extracted) | Complete; see Part I.F — all 45 lessons catalogued, 7 Daniela tips identified, tú delay confirmed (Lesson 45 of 45), column format confirmed as primary practice mode throughout |
| *Next session (after both books read)* | Seed new M1–M4 data | ¿Qué es? categories, debo modal, dejar, rojo color, EE #5 expressions |


---

## Part I.C — Gap Audit: HoloHola vs. Madrigal


**Date:** Apr 14, 2026 (Session 56)  
**HoloHola current state:** 10 languages × 5 chapters = 50 chapters total  
**Languages:** Spanish, French, German, Italian, Japanese, Korean, Mandarin, Portuguese, English, Hebrew  
**Chapters per language:** greetings, numbers, family, daily, classroom  
**Madrigal source:** 9 Phases (pp. 9–199) + appendix

---

## Summary Verdict

HoloHola's existing 5-chapter structure covers **two of Madrigal's five Everyday Expressions pivots** (EE #1 in greetings, EE #2 in numbers) and **one appendix section** (family vocabulary). The remaining **seven phases of the Madrigal method** — places, categories, ser/estar as structural verbs, modal constructions, preterite, present system expansion, weather, and progressive — have no chapter home in HoloHola yet.

The gap is not a failure of quality but of scope: HoloHola currently covers the "orientation layer" (who I am, how I count, who my family is). Madrigal's method continues from there into the "doing layer" (where I go, what I want, what I did) and beyond.

---

## Chapter-by-Chapter Overlap Analysis

### Chapter 1: Greetings

**HoloHola has:**
- vocabQA (8 items): buenos días/tardes/noches, ¿Cómo está usted?, gracias/de nada, perdón, me llamo, con mucho gusto
- verbGroups: `estar` (estoy bien/cansado/feliz/ocupado/mal/nervioso)
- genderPairs: 6 emotion adjectives (contento/cansada, cansado/cansada, etc.)
- cognateOpener: 17 Spanish cognates
- Conversation strips: 3 strips (casual hello, nice to meet you, with grandma)

**Madrigal EE #1 covers (p. 43):**
- Buenos días / Buenas tardes / Buenas noches
- ¿Cómo está usted? / Bien, gracias / ¿Y usted?
- Gracias / De nada
- Perdón
- Con mucho gusto
- Me llamo ___

**Match quality: ✅ STRONG** — vocabQA items map almost exactly to EE #1. This is the closest alignment in the entire textbook.

**Gaps in HoloHola greetings:**
- ❌ `ir` (voy al hotel/banco/restaurante) — Madrigal's very FIRST structure (p. 9). No chapter home.
- ❌ `ser` (soy / es / somos / son) — introduced at p. 15. Present in conversation strips but not as a verbGroup
- ❌ EE #4 content incomplete: genderPairs have 6 emotion adjectives but Madrigal's full EE #4 list (pp. 80–81) has 11+ states: contento, cansado, ocupado, enfermo, listo, solo, enojado, furioso, aburrido, enamorado, triste, cómodo + bien/mejor/mal/peor + estamos/están/estoy
- ❌ `estoy` gender agreement note absent ("estoy contento" when a man says it vs. "estoy contenta" when a woman says it)
- ❌ `usted` can be dropped in questions — the register note from p. 165 not present anywhere

---

### Chapter 2: Numbers

**HoloHola has:**
- vocabQA (5 items): ¿Cuántos años tienes?, ¿Cuánto cuesta?, ¿Qué hora es?, ¿Cuántas personas hay?, phone number
- verbGroups: `tener` with full idiom set (hambre/sed/frío/calor/razón/tiempo) + verbHint
- Narrative: counting basics, numbers in daily life
- Cultural spotlight: El Regateo (bargaining)

**Madrigal EE #2 covers (p. 53):**
- Tengo hambre / sed / frío / calor / razón / sueño / miedo / prisa
- No tengo tiempo

**Match quality: ✅ STRONG** — verbGroups tener closely follows EE #2. The idiom set is well covered.

**Gaps in HoloHola numbers:**
- ❌ `hay` (there is / there are) — introduced at p. 86, never appears in any HoloHola chapter
- ❌ Son las tres / Es la una — time-telling with ser, not just as vocabQA but as a verbGroup concept
- ❌ `¿Cuánto cuesta?` → Cuesta ___ (tener-based price response missing — ¿Cuánto cuesta? is in vocabQA but the verb `costar` is absent as a verbGroup)
- ❌ Number-triggered gender agreement (un libro / una mesa) — the tip exists but not shown as a systematic pattern

---

### Chapter 3: Family

**HoloHola has:**
- genderPairs (5): padre/madre, hermano/hermana, abuelo/abuela, tío/tía, primo/prima
- vocabQA (5 items): madre, padre, hermanos, se llama, familia
- verbGroups: `ser` (Él es mi padre, Ella es mi madre...)
- Sentence frames: "Él es mi ___" / "Ella es mi ___"
- Conversation strips: 3 strips (meeting family, family tree, at dinner)
- Cultural spotlight: La familia extendida

**Madrigal appendix covers (p. 213):**
- 11 masculine/feminine pairs: padre/madre, hermano/hermana, abuelo/abuela, primo/prima, suegro/suegra, tío/tía, cuñado/cuñada, nieto/nieta, sobrino/sobrina, hijo/hija, esposo/esposa
- mis padres / mis parientes

**Match quality: ⚠️ PARTIAL** — 5 of 11 family pairs present. Missing half the extended family.

**Gaps in HoloHola family:**
- ❌ esposo/esposa (husband/wife) — absent
- ❌ hijo/hija (son/daughter) — absent
- ❌ cuñado/cuñada (brother-in-law/sister-in-law) — absent
- ❌ suegro/suegra (father/mother-in-law) — absent
- ❌ nieto/nieta (grandson/granddaughter) — absent
- ❌ sobrino/sobrina (nephew/niece) — absent
- ❌ mis padres / mis parientes — absent
- ❌ `querer` + personal a — "Quiero a mi mamá" (I love my mom) introduced at p. 58–59 in family context; the personal-a rule is completely absent from HoloHola
- ❌ Family vocabulary in the context of querer (love) vs. querer (want) disambiguation

---

### Chapter 4: Daily

**HoloHola has:**
- vocabQA (5 items): ¿Cómo estás?, ¿Qué hora es?, ¿Qué día es hoy?, ¿Qué haces por la mañana?, ¿Tienes tiempo?
- verbGroups: `hacer` (hago ejercicio, hago el desayuno, hago la tarea, hacemos una caminata)
- Narrative: greetings throughout the day, essential courtesy, simple daily words
- Cultural spotlight: El Paseo

**Madrigal EE #5 covers (pp. 162–163):**
- ¿A qué hora? → a las dos / cinco / ocho / nueve
- Una vez / Dos veces / Unas veces / Muchas veces / De vez en cuando / Otra vez / Tal vez
- Es todo / Nada / Sin / Siempre / Nunca / Necesito / ¿Qué necesita?
- Está bien / Con permiso / Depende / Ya / Seguro / No importa / Lo siento
- Creo que sí / Creo que no / Espero que sí

**Match quality: ⚠️ WEAK** — daily chapter has ¿Qué hora es? but missing the full EE #5 practical vocabulary.

**Gaps in HoloHola daily:**
- ❌ ¿A qué hora? as a dedicated time-asking structure (separate from ¿Qué hora es?)
- ❌ Frequency expressions — completely absent: una vez, muchas veces, de vez en cuando, siempre, nunca, otra vez, tal vez
- ❌ Lo siento (I'm sorry) — absent
- ❌ Con permiso (excuse me) — in greetings chapter
- ❌ Necesito / ¿Qué necesita? (I need) — completely absent, no chapter home
- ❌ No importa / Ya / Seguro / Depende — absent
- ❌ Creo que sí / Creo que no / Espero que sí — absent
- ❌ hacer weather: hace frío / calor / fresco / viento — absent from all chapters
- ❌ Seasons (la primavera / el verano / el otoño / el invierno) — absent
- ❌ ¿Qué día es hoy? is present but the DAYS OF THE WEEK (lunes–domingo) are not in any verbGroup/vocabQA

---

### Chapter 5: Classroom

**HoloHola has:**
- vocabQA (5 items): ¿Puede repetir?, ¿Cómo se dice?, No entiendo, ¿Es correcto?, ¿Qué significa?
- verbGroups: `entender` (entiendo/entiendo un poco/no entiendo nada/¡Ya entiendo!/¿Lo entiendes todo?)
- Narrative: ask don't guess, checking and confirming
- Cultural spotlight: El Respeto en el Aula

**Madrigal coverage:**
Madrigal has no dedicated classroom chapter. Classroom language appears incidentally in lesson instructions.

**Match quality: ➕ HOLAHOLA ORIGINAL** — entirely HoloHola-created content, not from Madrigal.

**Notes:**
- This is the right chapter to ADD: poder (¿Puedo...? — can I...?) as a classroom permission verb
- Also fits: ¿Puede repetir? → already in vocabQA, but poder as a verbGroup is absent from all chapters

---

## Entire Madrigal Phases With No HoloHola Chapter Home

These are structures, vocabulary sets, and concepts that appear in Madrigal but have no corresponding chapter in HoloHola at all. Each represents a potential new chapter or a deep expansion of an existing chapter.

### Phase 1 Additions: ir + places + ¿Qué es?

| Madrigal Content | Pages | Possible HoloHola Chapter |
|---|---|---|
| ir (voy/va/vamos/van) | pp. 9–12 | NEW: Places chapter |
| Places vocabulary: hotel/banco/teatro/cine/restaurante/garage/parque/mercado | pp. 9–12, 90–91 | NEW: Places chapter |
| ¿Qué es? — un animal / una fruta / una flor / una verdura | pp. 20–25 | NEW: Categories chapter |
| 4-category vocabulary (7 animals, 4 fruits, 4 flowers, 4 vegetables) | pp. 20–25 | NEW: Categories chapter |
| rojo (first color) + linda / chistoso / limpio / sucio | pp. 24–25, 135, 151 | NEW: Colors/Adjectives chapter |
| grande / chiquito — size comparison | pp. 14–19 | NEW: Adjectives chapter |
| ser (soy/es/somos/son) as a verbGroup | p. 15 | Expand greetings or NEW: Descriptions chapter |

---

### Phase 2 Additions: querer + personal a

| Madrigal Content | Pages | Possible HoloHola Chapter |
|---|---|---|
| querer (quiero/quiere/queremos/quieren) | pp. 54–61 | Expand family or NEW: Desires chapter |
| quiero = both "I want" and "I love" — context determines meaning | pp. 58–59 | Expand family |
| Personal-a rule: "Quiero a Roberto" / "Quiero a mi mamá" | pp. 58–59 | Expand family |
| tener que + infinitive (I have to ___) | pp. 50–51 | Expand daily or NEW: Obligations chapter |

---

### Phase 3 Additions: plurals + estar structure

| Madrigal Content | Pages | Possible HoloHola Chapter |
|---|---|---|
| Plural rules (-o→-os, -a→-as, -or→-ores) | pp. 64–69 | Expand numbers or NEW: Grammar chapter |
| bonito / bonita / delicioso / deliciosa | pp. 66–67 | NEW: Adjectives chapter |
| estar + ¿Dónde está? | pp. 74–77 | NEW: Home/Places chapter |
| Rooms vocabulary: sala/comedor/cocina/baño | pp. 74–83 | NEW: Home chapter |
| Furniture: sofá/sillón/mesa/estufa/refrigerador/tina/toalla/jabón | pp. 74–83 | NEW: Home chapter |
| EE #3: ser + adjectives (valiente/inteligente/elegante) | pp. 70–71 | Expand daily or NEW: Descriptions chapter |
| EE #4: estar + emotions (full 11-item list) | pp. 80–81 | Expand greetings verbGroups |

---

### Phase 4 Additions: ability, existence, preference

| Madrigal Content | Pages | Possible HoloHola Chapter |
|---|---|---|
| poder (puedo/puede/podemos/pueden) | pp. 84–85 | Expand classroom or NEW: Activities chapter |
| hay (there is / there are) | pp. 86–91 | Expand numbers or NEW: Exploration chapter |
| me gusta / me gustan | pp. 94–97 | NEW: Preferences chapter |
| me gustaría | pp. 98–99 | NEW: Preferences chapter |
| me encanta / me encantaría / me encantan | pp. 100–101 | NEW: Preferences chapter |
| "I like THE cheese" rule — article required with me gusta | pp. 98–99 | NEW: Preferences chapter |
| debo (I should / ought to) | pp. 118–119 | NEW: Obligations chapter |
| Master infinitive page: all 10 modals + shared verb list | pp. 118–119 | NEW: Modals chapter or chapte-ending consolidation |

---

### Phases 5–9: Grammar Structures (No Chapter Home)

| Madrigal Content | Pages | Notes |
|---|---|---|
| AR preterite (tomé/compré/estudiaste/nadó) | pp. 29–33, 120–131 | Entirely absent from HoloHola |
| ER/IR preterite (recibí/escribí/vi) | pp. 132–139 | Entirely absent |
| dejar, alquilar preterite | pp. 122–131 | Entirely absent |
| traer/decir irregular preterites | pp. 150–151 | Entirely absent |
| Indirect object le | pp. 150–151 | Entirely absent |
| era (first imperfect — reported speech) | pp. 150–151 | Entirely absent |
| AR verb compendium (38 verbs present) | pp. 160–161 | Entirely absent |
| ER/IR present conjugation tables | pp. 164–167 | Entirely absent |
| Weather expressions: hace frío/calor/fresco/viento | pp. 176–177 | Entirely absent |
| Seasons + months | pp. 176–177, App 212 | Entirely absent |
| Present progressive: estar + -ando | pp. 182–183 | Entirely absent |
| Present perfect: haber + -ado/-ido | pp. 188–189 | Entirely absent |
| Commands: escriba/oiga/venga/hágalo/dígame | pp. 198–199 | Entirely absent |
| Subjunctive: Espero que / Quiero que | pp. 198–199 | Entirely absent |

---

## What HoloHola Has That Madrigal Doesn't

These are genuine HoloHola originals — pedagogical features Madrigal doesn't cover:

| HoloHola Feature | Why It's Not in Madrigal |
|---|---|
| Classroom language chapter | Madrigal assumes a traditional classroom; no meta-language for managing learning |
| Cultural spotlights | Madrigal is pure language instruction, no cultural commentary |
| Conversation strips (comic panel dialogues) | Madrigal uses short Q&A pairs, not multi-turn dialogues |
| Formal/informal comparison tables | Madrigal covers formal (usted) early but doesn't compare registers side-by-side |
| discoveryNotes (pedagogical "aha" callouts) | Madrigal embeds grammar notes inline, doesn't highlight them |
| Multi-language parallel coverage | Madrigal is Spanish only |
| 10-language cognate system | Madrigal has a cognate chapter but only for English→Spanish |
| `verbHint` field explaining the insight | Madrigal's grammar notes are briefer |

---

## Priority Gap-Filling Roadmap

Based on how often Madrigal returns to each structure and how foundational it is for conversation:

### Priority 1 — Immediate (filling holes in existing chapters)

| Gap | Target Chapter | What to Add |
|---|---|---|
| EE #4 full emotion list | greetings verbGroups | listo, solo, enojado, furioso, aburrido, enamorado, triste, cómodo; + estamos/están/estoy + gender agreement note |
| Lo siento / Necesito / Creo que sí | daily vocabQA | 3 new vocabQA items directly from EE #5 |
| Frequency: una vez / muchas veces / de vez en cuando | daily narrativeSections | New narrative section "How Often?" |
| Family: expand to 11 pairs | family genderPairs | esposo/esposa, hijo/hija, cuñado/cuñada, suegro/suegra, nieto/nieta, sobrino/sobrina |
| quiero = I love + personal a | family narrativeSections | discoveryNote on querer; new vocabQA item |
| ¿A qué hora? as structure | daily vocabQA | Separate from ¿Qué hora es? — asking about events |

### Priority 2 — High (new chapters that fill the biggest gaps)

| New Chapter | Madrigal Source | Core Structures |
|---|---|---|
| **places** | Phase 1, pp. 9–12 | ir (voy/va/vamos/van) + 10 place vocabulary + ¿A dónde vas? |
| **preferences** | Phase 4, pp. 94–101 | me gusta/gustan + me gustaría + me encanta/encantan + "I like THE ___" rule |
| **home** | Phase 3, pp. 74–83 | estar + ¿Dónde está? + rooms + furniture vocabulary |

### Priority 3 — Medium (enriching existing chapters)

| Enhancement | Target Chapter | Madrigal Source |
|---|---|---|
| hay verbGroup | numbers | pp. 86–91: Hay ___ en el hotel; Hay cinco personas |
| poder verbGroup | classroom | pp. 84–85: ¿Puedo ir? Puedo estudiar |
| ser + adjectives expansion | daily | EE #3 (pp.70–71): Es muy valiente/inteligente |
| Days of week in context | daily | pp. 152–153: Voy al teatro el jueves |
| Colors: rojo + 11 more | new adjectives chapter | p. 25 + appendix p. 214 |
| Weather: hace frío/calor | daily | pp. 176–177 |

### Priority 4 — Later (grammar chapters, post-Magic Keys analysis)

| New Chapter | Madrigal Source | Core Structures |
|---|---|---|
| **categories** | Phase 1, pp. 20–25 | ¿Qué es? + ser for classification + 4 category vocabulary sets |
| **activities** | Phase 1–4, throughout | tener que + querer + poder + me gustaría + infinitives |
| **past** | Phases 5–6, pp. 120–155 | AR/ER/IR preterite |
| **present progressive** | Phase 8, pp. 182–183 | estar + -ando; ING = ANDO |

---

## The Magic Keys Wildcard

All of the above is based solely on "See It and Say It." Madrigal's *Magic Keys to Spanish* is a companion method book focused specifically on pattern recognition — cognates, word-endings, building vocabulary systematically. It likely covers:

- How to recognize thousands of Spanish words from English instantly
- Systematic cognate pattern rules (-tion → -ción, -al → -al, -ous → -oso)
- Vocabulary-building strategies

Once analyzed, Magic Keys will primarily affect:
- M3 (CognateRecognitionGrid) — will likely double or triple the cognate data
- The cognateOpener arrays across all 10 languages
- Potentially add a "Word Patterns" chapter type for Romance languages

The gap audit here is **Spanish-specific and only accounts for "See It and Say It."** The Magic Keys analysis will add a second layer, especially for French, Italian, Portuguese, and German which share heavy cognate patterns with Spanish.

---

## Overall Score

| Dimension | Score | Notes |
|---|---|---|
| Greetings coverage | 9/10 | Near-perfect match with EE #1 |
| Numbers/tener coverage | 8/10 | Tener idioms strong; hay and costar missing |
| Family coverage | 5/10 | 5 of 11 pairs; personal-a absent |
| Daily/phrases coverage | 4/10 | EE #5 mostly missing |
| Classroom coverage | 7/10 | Good HoloHola original; poder should be added |
| Places/movement | 0/10 | ir chapter completely absent |
| Preferences (gusta) | 0/10 | me gusta chapter completely absent |
| Home/rooms | 0/10 | estar + locations chapter absent |
| Categories | 0/10 | ¿Qué es? chapter absent |
| Colors/Adjectives | 0/10 | No colors chapter |
| Grammar structures (tenses) | 0/10 | Nothing past present tense |
| **TOTAL** | **33/110** | ~30% of Madrigal's method coverage |


---

## Part I.D — How Madrigal Illustrates Each Concept


**Source:** Full read of *See It and Say It in Spanish* (pp. 9–199 + appendix).  
**Purpose:** Guide for HoloHola AI image generation — reverse-engineer Madrigal's visual grammar.

---

## The Core Formula

Every Madrigal drawing follows one rule:

> **NOUN + MINIMUM CANONICAL CONTEXT = clean, instantly-readable line drawing**

"Minimum canonical context" means the least amount of surroundings needed for the drawing to be unambiguous. A coffee drawing is a coffee *pot* (not a cup, not a plantation, not a cafe), because a pot is the one image you point to when you say "café."

The drawings are not decorative. They are **functional translations** — the image IS the English meaning. No English word is needed below a drawing once a student has learned to trust the picture.

---

## Universal Style Rules

1. **Single focal subject** — one thing, centred, fills ~70% of the frame
2. **Bold black outline, no fill** — line weight 3–5px equivalent, no shading, no crosshatching
3. **White background, no ground plane** — objects float in space unless location is the lesson
4. **Side or 3/4 view** — maximum silhouette recognition
5. **Human figures are simple but expressive** — dot eyes, arc mouth, stick-and-block bodies; no detail
6. **No text inside images** — labels live in the caption, never inside the drawing
7. **Size conveys importance, not realism** — the KEY subject is drawn largest

---

## Concept-Type Breakdown

### 1. Places / Buildings
**Rule:** Show the FACADE as you'd approach it on foot. Never the interior.  
**Formula:** Architectural exterior + ONE identifying mark (sign, doorman, window detail)

| Concept | Drawing Description | Identifying Mark |
|---|---|---|
| el hotel | Multi-storey facade, arched entrance | Doorman in uniform at door; HOTEL sign or implied marquee |
| el banco | Heavy stone facade, barred or arched window | Security bars on window; classical architecture |
| el garage | Simple building facade + fuel pump or sign | Gasoline pump visible at side |
| el restaurante | Storefront facade with awning | Awning over door, maybe small tables in window |
| el teatro | Classical building with columns or arch | TEATRO / THEATRE above entrance, possibly ticket window |
| el cine | Building front with large marquee | Marquee with a film title ("Spring Love", any title) |
| el parque | Open scene with bench + trees | Park bench, one or two trees in background |
| el mercado | Open-air stall facade | Hanging produce, simple awning, FRUITS/MERCADO sign |
| la iglesia | Church exterior | Steeple or cross on roof |
| el despacho/oficina | Office building exterior or door | OFFICE door nameplate or building facade |
| la biblioteca | Classical building | BIBLIOTECA sign or columns suggesting institution |

**HoloHola prompt template:**  
`"Bold black line drawing, white background, [PLACE] exterior facade viewed from the street, simple Madrigal textbook style, no shading, minimal detail"`

---

### 2. Transportation
**Rule:** Side profile, full vehicle visible, nothing in background.  
**Formula:** Vehicle silhouette, perfectly readable

| Concept | Drawing Description |
|---|---|
| el taxi | Car with TAXI sign on roof, side profile |
| el avión | Classic airplane side profile, tail and wings clear |
| el tren | Streamlined locomotive side view, wheels visible |
| el autobús | Full bus side view, windows along the side |
| el auto / automóvil | Sports car side view, streamlined |
| la lancha | Motorboat hull side view, bow + wake lines |
| la bicicleta | Bicycle side view, both wheels visible |

---

### 3. Food (Plated and Served)
**Rule:** Food appears AS SERVED — on a plate, in a bowl, in its vessel. Never raw, never being prepared.  
**Why:** The question is "¿Tomó sopa?" — the student imagines the bowl in front of them.

| Concept | Drawing Description |
|---|---|
| la sopa | Steaming bowl (3 steam lines above) with a spoon resting on the rim |
| el café | Coffee POT (not a cup) — tall café pot with handle and spout |
| el té | Teapot — round pot with spout and lid, possibly a teacup beside it |
| el chocolate | Mug with steam rising, rounded handle |
| el pollo | Whole roast chicken on a serving plate, legs visible |
| el salmón | Whole fish on an oval serving platter, garnished with lemon |
| el rosbif | Large roast beef on a carving plate |
| el bistec | Beefsteak on a plate |
| el sandwich | Stacked sandwich on a plate |
| la sopa | Steaming bowl |
| los espárragos | Bundle of asparagus tied together |
| el apio | Single celery stalk with leaves |
| la lechuga | Round head of lettuce |
| los tomates | Two tomatoes together |
| huevos fritos | Frying pan with two eggs, yolks visible |
| pan tostado | A toaster with toast popping up |
| jugo de naranja | Tall glass with an orange half beside it |
| la cuenta | Folded paper check/bill, possibly with a pen |
| el azúcar | Sugar bowl with lid and spoon |
| un vaso de agua | Tall clear glass |

**HoloHola prompt template:**  
`"Bold line drawing, [FOOD ITEM] served/plated, viewed from slight angle, steam/garnish as appropriate, white background, Madrigal textbook style"`

---

### 4. Fruits and Vegetables (¿Qué es? section, pp. 20–25)
**Rule:** The ITEM ALONE, isolated, no plate or context. The question is "what IS this?" — the identity is the whole point.

| Concept | Drawing Description |
|---|---|
| la pera | Classic pear shape with short stem |
| la naranja | Round orange with small leaves at stem |
| la manzana | Apple with curved stem and one leaf |
| la piña | Pineapple with diamond-pattern skin and crown of leaves |
| la zanahoria | Carrot, tapering root with feathery leafy top |
| el tomate | Round tomato with small calyx at top |
| la lechuga | Leafy head of lettuce, leaves slightly open |
| el apio | Stalk of celery with leaves at top |
| la rosa | Rose with one or two leaves on stem |
| el tulipán | Tulip, single bloom on straight stem |
| el geranio | Geranium, cluster of small blooms |
| el clavel | Carnation, frilly bloom on stem |

**Key difference from food drawings:** These float alone. No plate, no bowl. They are vocabulary items being classified.

---

### 5. Animals
**Rule:** Side profile portrait — the animal at rest or in characteristic pose. Never in action.

| Concept | Drawing Description |
|---|---|
| el gato | Sitting cat in side profile, tail curled |
| el canario | Small bird perched on a branch, facing right |
| el pollo (live) | Live chicken standing, beak and tail visible |
| el caballo | Horse standing in profile, tail and mane visible |
| el perro | Dog standing in profile |
| la mariposa | Butterfly with wings fully spread |
| la sardina | Small fish in profile |
| la vaca | Cow in profile, udder implied |
| el tigre | Tiger in profile, stripes clearly shown |
| el león | Lion in profile, mane visible |
| la mula | Mule in profile |
| el gorila | Gorilla in characteristic knuckle-walk or sitting pose |
| el toro | Bull in profile, horns clearly shown |
| el elefante | Elephant in profile, trunk and tusks clear |
| el hipopótamo | Hippo in profile, wide body, small ears |
| el payaso | Clown in full costume, exaggerated outfit |
| el mono | Monkey in characteristic pose |

---

### 6. Clothing
**Rule:** Items shown on HANGERS or being WORN. On-hanger = the object is the focus. Being-worn = when you need to show fit/style.

| Concept | Drawing Description |
|---|---|
| la blusa | Blouse on a clothes hanger, collar and sleeves visible |
| la falda | Skirt on a hanger, A-line or pencil shape |
| la corbata | Tie lying flat or hanging, distinctive pointed end |
| la bufanda | Scarf draped or loosely folded |
| el sombrero | Wide-brimmed hat in 3/4 view from above |
| el vestido | Dress on a hanger |
| el suéter | Knit sweater on hanger, ribbing visible |
| el traje | Suit jacket + trousers on hanger |
| la camisa | Shirt on hanger, collar open |
| la bata | Bathrobe hanging on a hook, sash tied |

---

### 7. Actions / Activities
**Rule:** Person at THE MOMENT of action. The action is unambiguous from the pose alone.  
**Formula:** Simplified human figure (stick-ish, but expressive) in recognizable action pose.

| Concept | Drawing Description |
|---|---|
| bailar | Person mid-dance step — one leg lifted, one arm extended, weight shifted |
| nadar | Person horizontal in swimming position, arms stretched forward, head up |
| cantar | Person standing, mouth open, musical notes floating from mouth |
| pescar | Person standing on a dock/pier, fishing rod angled over water, line visible |
| tocar el piano | Person seated at grand piano, hands on keys (piano in side profile) |
| tocar la guitarra | Person seated, acoustic guitar held, strumming hand visible |
| tocar el acordeón | Person standing, accordion held with both hands, keys visible |
| tocar el violín | Person with violin under chin, bow raised |
| patinar | Person in ice-skating stride, one leg extended behind |
| nadar | Person horizontal, arms and legs in swim position |
| estudiar | Person seated at a desk, book open in front, possibly pencil in hand |
| hablar por teléfono | Person holding receiver to ear (rotary phone visible) |

**Distinguishing feature:** Musical-instrument drawings ALWAYS show BOTH the person AND the instrument. The person is necessary to show that it's an activity, not just the object.

---

### 8. Household Items / Rooms
**Rule:** Objects shown in their rooms with MINIMAL room context — just enough to understand placement.

**Living room (sala):**
- el sofá: Sofa with simple floor line suggesting room
- el sillón: Upholstered armchair
- la televisión: CRT television on a stand (period-appropriate to Madrigal)
- el teléfono: Rotary telephone on a surface

**Dining room (comedor):**
- la mesa: Four-legged table, slight perspective
- la silla: Simple chair, side view
- el mantel: Table shown with cloth draped over it
- la servilleta: Folded napkin on a plate or surface

**Kitchen (cocina):**
- la estufa: Gas/electric range with visible burners, knobs on front
- la olla: Round pot with handles and lid
- la cafetera: Electric coffee percolator or stovetop pot
- el refrigerador: Upright refrigerator, handle on door

**Bathroom (baño):**
- la tina: Bathtub, classic shape
- el lavamanos: Pedestal sink with faucets
- el jabón: Bar of soap (slightly rounded rectangular block)
- la toalla: Towel folded or hanging on a ring

**Tableware (pp. 150–151):**
- la cuchara: Tablespoon, classic shape
- el cuchillo: Knife with blade and handle
- el vaso: Tall drinking glass
- el plato: Circular plate, top-down view
- la jarra: Pitcher with handle and spout
- la servilleta: Folded cloth napkin

---

### 9. Social Situations / Greetings
**Rule:** TWO people in interaction, both shown in simplified form.

| Concept | Drawing Description |
|---|---|
| Buenos días | Man tipping hat to a woman; morning light implied by context |
| ¿Cómo está usted? | Two people facing each other, one slightly bowing or extending hand |
| Mucho gusto | Handshake between two people |
| Con mucho gusto | Same as above, or one person nodding with a slight bow |

---

### 10. Abstract / Relational Concepts

**Size (grande vs. chiquito):**
- Draw THE SAME SUBJECT in two different sizes, side by side, or show clearly large vs. clearly small objects
- El tren es grande → full-size locomotive
- El botón es chiquito → tiny button, possibly with a finger for scale

**Colors (rojo, azul, verde, etc.):**
- Show the CANONICAL COLORED OBJECT for that color
- rojo → tomate (round red tomato)
- azul → cielo / agua (wave or sky line)
- verde → hoja / hierba (leaf or grass)
- amarillo → sol (simple sun)
- blanco → nieve / nube (snow or cloud)
- negro → noche (dark sky or silhouette)
- rosado → flor rosa (pink flower, probably rose)
- morado → uva (bunch of grapes)

**Gender (masculine/feminine adjective agreement):**
- Draw the masculine version next to the feminine version
- OR draw the object with the article/ending visually highlighted

**There is/are (hay):**
- Draw what EXISTS — the subject of hay statements
- ¿Hay sopa? → bowl of soup (the thing that exists)
- Hay turistas en el hotel → simplified group of people with luggage

---

## Patterns for HoloHola's Image System

### The 10 Image Templates

Based on Madrigal's visual grammar, every HoloHola VocabQA image should fit one of these 10 templates:

| Template | When to Use | Key Rule |
|---|---|---|
| **FACADE** | Any place/building | Front view, one identifying sign |
| **PROFILE** | Any vehicle or animal | Side view, full silhouette |
| **PLATED** | Any cooked/served food | On dish, steam if hot |
| **ISOLATED** | Any raw produce or classifiable item | Floating alone, no context |
| **HANGER** | Any clothing | On wire hanger |
| **ACTION** | Any verb/activity | Person mid-motion |
| **PORTRAIT** | Any person role (padre, maestro) | Simple human figure, facing viewer |
| **OBJECT** | Any household/small item | 3/4 view, white background |
| **DUO** | Any social interaction | Two figures facing each other |
| **PAIR** | Any comparison or M/F pair | Two versions side-by-side |

### Consistent Don'ts

- **Never show a scene** when a single object will do
- **Never add props** unless the prop IS the lesson (e.g., fishing rod = the proof you're fishing)
- **Never use color** in the drawing itself (HoloHola may add color — but the Madrigal-style base is always B&W line)
- **Never put text** inside the drawing
- **Never show action** for noun vocabulary (a dog is standing still; a person dancing is mid-dance)

### The "Question Fit" Test

Before generating any image, ask: "If a student sees only this image and the Spanish word/sentence, is there exactly ONE reasonable answer?"

- ✅ Soup bowl → sopa ← unambiguous
- ✅ Man at hotel door → el hotel ← unambiguous  
- ❌ Person at table → ambiguous (eating? sitting? working?)
- ❌ Kitchen scene → ambiguous (stove? refrigerator? kitchen in general?)

Every image must pass the one-answer test.

---

## Concept-Type Map for HoloHola Chapters

| HoloHola Chapter | Concept Types Needed | Templates |
|---|---|---|
| Greetings | Social interactions; time-of-day signals | DUO, PORTRAIT |
| Numbers | Objects in groups; price tags; clocks | OBJECT, PAIR |
| Family | People in relationship context | PORTRAIT, DUO |
| Daily | Actions, places, time expressions | ACTION, FACADE, OBJECT |
| Classroom | People interacting with learning materials | DUO, ACTION, OBJECT |
| **NEW: Places** | Building facades, directions | FACADE |
| **NEW: ¿Qué es?** | Raw produce, animals, flowers | ISOLATED, PROFILE |
| **NEW: Colors** | Canonical colored objects | ISOLATED |
| **NEW: Clothing** | Garments on hangers | HANGER |
| **NEW: Home/Rooms** | Furniture in rooms | OBJECT |
| **NEW: Food** | Plated dishes and drinks | PLATED |
| **NEW: Weather** | Weather phenomena, seasons | ISOLATED (sun/cloud/rain/snow) |
| **NEW: Feelings** | People expressing emotions | PORTRAIT (with expression) |

---

## Part I.E — Actual Image Quality Audit (S58, April 2026)

**What this is:** A first-party visual inspection of real images currently served at `/api/media/ai-image/vocab_*.png` — viewed at full resolution, judged against Madrigal's simplicity principles from Part I.D. This is the ground-truth quality record. Every image listed was screenshotted live; none of this is theoretical.

**Methodology:** For each image, ask the "Question Fit Test" (from Part I.D): *If a student saw only this image, is there exactly one reasonable Spanish answer?* A second test: *Does anything in the image create a competing association?* The grade reflects both.

**Grade key:**
| Grade | Meaning |
|-------|---------|
| **A** | Passes Question Fit Test cleanly. Near-zero noise. Would survive Madrigal's editing pencil. |
| **B** | Passes QFT but has one correctable issue (minor clutter, slight context noise). Keep for now. |
| **C** | Passes QFT but has meaningful noise that could compete with the target concept. Schedule regen. |
| **F** | Fails QFT or contains disqualifying content (English text, culture-specific signage, embedded labels). Regen immediately. |

---

### Reviewed Images — Session S58

| # | Filename | Concept | Template | Grade | Observation | Action |
|---|----------|---------|----------|-------|-------------|--------|
| 1 | `vocab_color_rojo.png` | rojo | ISOLATED | **A** | Perfect. Pure red circle on white background. Zero noise. Exactly one possible answer. | Keep as canonical example for all color images. |
| 2 | `vocab_act_escribir.png` | escribir | ACTION (hands only) | **A** | Close-up of two hands writing with a pencil on paper at a desk edge. No face, no scene. Action is unmistakable. The frameless crop strips away all noise. | Keep. This is our best action image. Use as template for other hand-action verbs. |
| 3 | `vocab_adj_grande_pequeno.png` | grande / pequeño | DUO | **A** | Elephant + mouse in profile. The size contrast is iconic and immediate. Slight ground detail (grass, dirt) is genuinely negligible — does not compete. | Keep. Minor improvement: remove ground texture in future batch. |
| 4 | `vocab_adj_nuevo_viejo.png` | nuevo / viejo | DUO | **A** | Brand-new red sneaker (left) vs. heavily worn, patched sneaker (right) on white background. Zero context noise. The contrast communicates the adjective pair in under one second. | Keep as canonical example for DUO adjective pairs. |
| 5 | `vocab_act_comer.png` | comer | ACTION | **B** | Single person at a table eating from a plate with fork. Clean white background. Action unambiguous. One issue: the plate has a complex multi-item meal (chicken, broccoli, rice, peas) — minor, since comer = "to eat" and any food works. | Keep. If ever regenerated, simplify plate to one item. |
| 6 | `vocab_adj_feliz_triste.png` | feliz / triste | DUO / PORTRAIT | **B** | Two child face portraits side by side — one beaming smile, one crying with a tear. QFT passes. One risk: the two children look like completely different people (different ethnicities, different ages) which could read as "two children" rather than "two emotional states." | Keep for now. Ideal regen: same character drawn twice in contrasting states. |
| 7 | `vocab_act_hablar.png` | hablar | DUO | **B** | Two people face-to-face with open-handed gesture poses suggesting conversation. Action clear. Issue: overlapping yellow and blue watercolor background washes add decorative noise. Not a QFT failure — "hablar" or "conversar" are the only reasonable answers. | Keep. Future regen: remove background color washes, keep white. |
| 8 | `vocab_places_restaurante.png` | restaurante | FACADE | **B** | Stone-facade European-style restaurant exterior with outdoor tables, candles, and potted plants. Facade approach is correct. Scene is complex (3 tables, 6 chairs, 3 topiary plants, cobblestone pavement, detailed windows) but the concept is unmistakable. No text. | Keep. Future regen: reduce to one table + simple door, no stonework detail. |
| 9 | `vocab_act_beber.png` | beber | ACTION | **B** | Woman drinking from a glass, close-up. Action is unmistakable. Issue: she is wearing a blue bandana/headscarf which visually reads as "worker/cook" rather than just "person." Minor association but worth noting. Yellow wash in background is minimal. | Keep. Future regen: plain clothing, no headwear. |
| 10 | `vocab_act_leer.png` | leer | ACTION | **C** | Girl sitting in a cozy armchair reading a book — but wearing a bright orange winter beanie hat and heavy knit sweater. The cold-weather clothing creates a competing "invierno / hace frío / estoy en casa" association. QFT is not clean: a student might say "frío" or "invierno" before "leer." | **Schedule regen.** New prompt: person (no hat, no winter clothing) sitting upright, holding an open book at reading level, white background, watercolor style. |
| 11 | `vocab_act_bailar.png` | bailar | ACTION | **C** | Two folk dancers in elaborate traditional embroidered costumes, mid-spin, with multiple floating music notes overhead. The costumes are culturally specific (Eastern European folk dress) and the music notes push toward "música / fiesta / cantar." QFT: a student might say "fiesta," "baile folklórico," or "música" before "bailar." | **Schedule regen.** New prompt: two people dancing casually (not in costume — jeans and t-shirts), one leading, one following, clean near-white background, no music notes, simple movement lines showing rhythm. |
| 12 | `vocab_places_escuela.png` | escuela | FACADE | **C** | American-style brick school building with a large US flag on a flagpole, school-themed graphic (book/apple/pencil) on the roofline pediment, multiple windows, steps, and bushes. Two critical issues: (1) the US flag makes this culturally specific — it signals "American school" not just "escuela"; (2) the decorative graphic on the roof is unnecessary visual noise. QFT passes but the US identity is a problem for a global multi-language platform. | **Schedule regen.** New prompt: simple school building facade, no national flags, no decorative signage, just a door with a sign reading "ESCUELA" (Spanish label acceptable since it's the word itself), bushes reduced. OR remove all text and just show clean school-style facade with a bell tower or standard arched entry. |
| 13 | `vocab_places_casa.png` | casa | FACADE | **F** | Two-story American house facade with elaborate front garden (ornate bushes, flower beds, path, lamp posts). A "(casa)" text label is printed directly on the image at the bottom-left. **Double fail:** (1) the text label defeats the entire purpose of a visual vocabulary card — the student reads the word instead of mapping the image to it; (2) the garden is visually complex. | **Regen immediately.** New prompt: simple front view of a house — door, two windows, minimal wall, no garden, no text label. Clean watercolor, white background. Absolutely no text rendered on the image. |
| 14 | `vocab_adj_caliente_frio.png` | caliente / frío | DUO | **F** | Steaming coffee cup (left) and glass of ice water (right) on white background — conceptually perfect DUO — but the image has "**Warm**" printed in large orange text and "**Vs**" in large blue text rendered directly on the image. **Catastrophic failure for a Spanish learning app.** The English words are the dominant visual element; a student learns "warm" and "vs" not "caliente" and "frío." | **Regen immediately.** New prompt: steaming coffee cup (left side) and glass filled with ice cubes (right side) on white background, watercolor style, NO TEXT of any kind in the image, no labels, no "vs" divider — let the visual contrast speak entirely. |

---

### Cross-Cutting Findings

**What our best images have in common (A-grade pattern):**
1. White or near-white background — zero landscape or room context
2. Single subject (ISOLATED/OBJECT) or exactly two subjects (DUO) — never more
3. No embedded text of any kind
4. The "one subject" is the exact canonical form of the word (a red circle = rojo, a sneaker pair = nuevo/viejo)
5. No culture-specific symbols (no national flags, no folk costumes, no branded items)

**The five failure modes we actually found (not theoretical — observed in real images):**
| Failure Mode | Examples | Frequency |
|---|---|---|
| **Embedded English text** | caliente_frio ("Warm", "Vs") | 1 confirmed |
| **Embedded Spanish label** | casa ("(casa)" text on image) | 1 confirmed |
| **US-specific cultural marker** | escuela (US flag), familia (American living room) | 2 confirmed |
| **Competing cold-weather context** | leer (winter hat + sweater) | 1 confirmed |
| **Culturally-specific costume** | bailar (Eastern European folk dress) | 1 confirmed |

**Pattern in B-grade images (keep but note for next regen batch):**
- Watercolor background washes (yellow/blue blobs): hablar, beber — minor but systematic
- Complex multi-item plates: comer — acceptable but could be cleaner
- Different-character DUO instead of same-character-two-states: feliz/triste — functional but Madrigal always used same character

---

### Immediate Regen Priority Queue

These two are **F-grade and must be regenerated before any student sees them.** The embedded English text is not acceptable in any teaching context.

**Priority 1 — `vocab_adj_caliente_frio`**
```
Prompt: Two objects side by side on a pure white background, watercolor illustration style.
LEFT: a steaming ceramic mug of coffee, warm orange-brown tones, visible steam wisps rising.
RIGHT: a tall glass filled with ice cubes and clear cold water, cool blue tones.
No text, no labels, no dividers, no "vs", no annotations of any kind on the image.
The contrast between warm steam and cold ice should communicate the meaning entirely.
```

**Priority 2 — `vocab_places_casa`**
```
Prompt: Simple front facade of a house, watercolor illustration style, white background.
A door in the center, one window on each side, a small step, minimal wall.
No garden, no flowers, no lawn, no bushes, no lamp posts, no flag, no decorative elements.
Absolutely NO text, labels, or words printed anywhere on the image.
The house should look residential and universal — not a specific culture or country.
```

**Schedule next batch — `vocab_act_leer`, `vocab_act_bailar`, `vocab_places_escuela`**
```
leer: A person (no hat, no winter clothing — plain top) sitting upright, holding
an open book at reading-level, eyes looking down at the pages. White background.
No chair context needed. Watercolor style.

bailar: Two people dancing together in casual clothing (jeans, t-shirts) — one
leading, one following, mid-step. Clean near-white background. No music notes,
no costumes, no decorative elements. The movement of their bodies communicates
the action.

escuela: A clean school building facade — brick or plain wall, arched entry or
double door, a few windows, steps. No national flag. No decorative roofline
graphic. No signage text. Simple and universal — could be a school in any country.
If possible, a small bell tower is a universally recognized school marker.
```

---

### Overall Library Status (S58 snapshot — 15 images)

- **Total images reviewed:** 15 (all images currently accessible via `/api/media/ai-image/vocab_*`)
- **A-grade (keep, canonical):** 4 (27%)
- **B-grade (keep, note for next batch):** 5 (33%)
- **C-grade (schedule regen):** 3 (20%)
- **F-grade (regen immediately):** 2 (13%)
- **Not found (missing from object storage):** vocab_spanish_perro, vocab_spanish_padre, vocab_spanish_madre, vocab_spanish_uno — these either haven't been pre-seeded or use a different naming key

**Gap flagged:** The `vocab_spanish_*` namespace appears unpopulated. The images that do exist use the `vocab_people_*`, `vocab_act_*`, `vocab_adj_*`, `vocab_places_*`, `vocab_color_*` namespace. When regenerating images, confirm cache key naming with `vocabulary-image-resolver.ts` → function `buildVocabCacheKey()` at line 1498.

---

## Part I.E Extended — Full Library Audit (S59–S60, April 2026)

**What this is:** A continuation of the S58 sample audit expanded to cover the entire `public/ai-images/` GCS bucket — all vocab_* categories visually inspected at full resolution. Every image in every category was screenshotted live and graded against the Question Fit Test.

**Total images audited this session:** ~243 across 20 categories.

**Namespace confirmed:** All vocab images live at `public/ai-images/vocab_<category>_<concept>.png` in GCS, served via `/api/media/ai-image/:filename`.

---

### Category-Level Summary

| Category | Count | Status | Issues Found |
|----------|-------|--------|--------------|
| `vocab_act_*` (actions) | ~12 | Mostly A/B | leer (C—winter hat), bailar (C—folk costume) from S58 |
| `vocab_adj_*` (adjectives) | ~10 | Mixed | caliente_frio (**F**—"Warm/Vs" text), joven_viejo_personas (C), ruidoso_tranquilo (C), rapido_lento (C) |
| `vocab_animals_*` | ~15 | ✅ Mostly A | Clean across the board |
| `vocab_body_*` | ~10 | Mostly A | body_diagram (C—multi-panel chart) |
| `vocab_cloth_*` (clothing) | ~8 | Mostly B/C | sombrero/falda/vestido style inconsistencies |
| `vocab_color_*` | ~8 | Mostly A | blanco (**F**—"WHITE" label baked in) |
| `vocab_emo_*` (emotions) | 8 | 7A/1F | nervioso (**F**—"stess" text + undressed figure) |
| `vocab_food_*` | ~12 | Mostly A/B | limon (C—pencil artifact), huevo (C—orange border) |
| `vocab_health_*` | 4 | 2A/2C | cita_medica (C—"CONSULTATION" text), pastilla (C—confusing white sphere) |
| `vocab_home_*` | 7 | ✅ All A | Perfect set — no action needed |
| `vocab_nature_*` | 12 | ✅ All A/B | No language text; universal imagery throughout |
| `vocab_num_*` | 7 | Mixed | hundreds (D), phone (D), 11_20 (C), currency (C), ordinals (C), tens (C) |
| `vocab_people_*` | ~6 | Mixed | hombre (C—before/after format), estudiante (C—Arabic script) |
| `vocab_place_*` | ~5 | Mixed | farmacia (**F**—"PHARMACY"×2), banco (C—"BANK" text) |
| `vocab_places_*` | ~8 | Mixed | casa (**F**—"(casa)" text), escuela (C—US flag), supermercado (C—Asian chars) |
| `vocab_ppl_*` | ~10 | Mostly A | cocinero (C—Asian script on posters) |
| `vocab_things_*` | ~6 | Mostly A/B | silla (C—yellow border artifact) |
| `vocab_time_*` | ~55 | Mixed | dias_semana (**F**—English day names), temperature_scale (**F**—"CELSIUS/FAHRENHEIT"), clock faces (A), partes_dia (A), meses (B), estaciones (B), rutina_diaria (B) |
| `vocab_transport_*` | ~6 | ✅ Mostly A | No issues found |
| `vocab_weather_*` | 11 | Mostly A | temperature_scale (**F**—"CELSIUS/FAHRENHEIT"), forecast_card (D—English labels), caluroso (C—artist signature) |

---

### New Failure Mode Discoveries (S59–S60)

These failure modes extend the S58 cross-cutting findings with new patterns discovered in the full audit:

| Failure Mode | Examples Discovered | Count |
|---|---|---|
| **Embedded English text (F-grade)** | caliente_frio ("Warm/Vs"), blanco ("WHITE"), farmacia ("PHARMACY"), dias_semana ("MONDAY/WEDNESDAY"), temperature_scale ("CELSIUS/FAHRENHEIT"), nervioso ("stess") | 6 distinct images |
| **Embedded Spanish label on image** | casa ("(casa)" text) | 1 image |
| **Garbled/glitchy AI-generated text** | num_11_20 ("LEST10/LB115"), num_phone ("CALLE ploto numbere"), num_hundreds ("D00"), num_currency ("$€..00") | 4 images |
| **Artist signature baked in** | weather_caluroso (handwritten signature lower-right) | 1 image |
| **Non-Roman script (Asian/Arabic chars)** | places_supermercado (Asian storefront signs), ppl_cocinero (Asian kitchen posters), people_estudiante (Arabic script visible) | 3 images |
| **US-specific cultural marker** | places_escuela (US flag) | 1 image |
| **Wrong numbers displayed** | num_hundreds ("D00" instead of "1,000"; Indian comma formatting) | 1 image |
| **Multi-panel / infographic format** | body_diagram (character reference sheet), num_tens (abstract grid), forecast_card (6-column weather chart) | 3 images |
| **Problematic figure rendering** | emo_nervioso (undressed figure, disturbing imagery) | 1 image |
| **Period/historical costume** | weather_caluroso (Victorian-style dress) | 1 image |

---

### Complete F-Grade Regen Queue (7 images — regen immediately)

These images must not be shown to students. All contain English text labels or otherwise disqualifying content.

**1. `vocab_adj_caliente_frio.png`** (from S58)
```
Prompt: Two objects side by side on a pure white background, watercolor illustration style.
LEFT: a steaming ceramic mug of coffee, warm orange-brown tones, visible steam wisps rising.
RIGHT: a tall glass filled with ice cubes and clear cold water, cool blue tones.
No text, no labels, no dividers, no "vs", no annotations of any kind on the image.
```

**2. `vocab_places_casa.png`** (from S58)
```
Prompt: Simple front facade of a house, watercolor illustration style, white background.
A door in the center, one window on each side, a small step, minimal wall.
No garden, no flowers, no lawn, no bushes, no flag, no decorative elements.
Absolutely NO text, labels, or words printed anywhere on the image.
```

**3. `vocab_color_blanco.png`**
```
Prompt: A single simple white object on a very light grey or off-white background,
watercolor illustration style. Options: a white egg, a white circle, a white feather.
No text, no labels. The concept "white" should be communicated purely by the object color.
```

**4. `vocab_place_farmacia.png`**
```
Prompt: Simple pharmacy storefront facade, watercolor illustration style, white background.
Green cross symbol above the door (universally recognized pharmacy symbol worldwide).
Clean simple door and window. No English "PHARMACY" text, no Spanish label either.
The green cross alone communicates the concept — it is the universal pharmacy symbol.
```

**5. `vocab_emo_nervioso.png`**
```
Prompt: A person (clothed, simple casual clothing) with a visible anxious/nervous expression —
sweating brow, wide eyes, shoulders raised, hands clasped or fidgeting.
White or near-white background. Watercolor illustration style.
No text of any kind on the image. No undressed figures.
```

**6. `vocab_weather_temperature_scale.png`**
```
Prompt: A single large thermometer showing temperature, watercolor illustration style.
The mercury/fluid fills from bottom — cool blue at the bottom, warm red/orange at the top.
Small snowflake icon near the bottom (cold reference) and small sun icon near the top (hot reference).
No text, no Celsius label, no Fahrenheit label, no English words of any kind.
Let the visual gradient and icons communicate hot vs. cold temperature scale.
```

**7. `vocab_time_dias_semana.png`**
```
Prompt: A calendar page showing a 7-day week grid, watercolor illustration style.
Seven columns with simple symbolic icons only — no words. Use universally readable icons:
sun (weekend), moon/stars (night), briefcase (workday), etc. OR simply show 7 numbered
squares (1 through 7) arranged in a row/grid.
Absolutely NO English day names (no Monday, Tuesday, etc.) anywhere on the image.
```

---

### D-Grade Regen Queue (3 images — high priority, regen before next student-facing release)

**1. `vocab_weather_forecast_card.png`**
```
Prompt: A simple 5-column weather forecast strip, watercolor illustration style.
Each column has one weather icon only (sun, partly cloudy, rain cloud, storm cloud, snow cloud).
Below each icon: a two-digit number (temperature) with a degree symbol.
NO English labels (no "SUN", "RAIN", "CLOUD" etc.) — use only visual weather icons.
Numbers must be clearly rendered Arabic numerals (not garbled).
```

**2. `vocab_num_hundreds.png`**
```
Prompt: Four-panel image showing quantity scale, watercolor illustration style.
Panel 1: a group of ~100 dots arranged in a neat 10×10 grid, with "100" clearly written.
Panel 2: a larger crowd/dots, "1,000" written (comma after thousands place, standard format).
Panel 3: even larger mass, "10,000" written.
Panel 4: stadium-scale crowd, "100,000" written.
All numbers must use Western comma formatting (1,000 not 1.000 not 10,00,00).
No garbled text, no caption labels, clean numerals only.
```

**3. `vocab_num_phone.png`**
```
Prompt: A simple rotary or modern telephone, watercolor illustration style.
Beside it, one clear phone number written in a speech bubble: e.g., "555-1234".
No English caption text, no "CALLE" labels, no explanatory words.
The phone visual + a sample number string is the entire concept.
```

---

### C-Grade Regen Queue (~23 images — schedule for next batch)

These images pass the Question Fit Test but have meaningful noise or artifacts. Grouped by category:

**Actions:**
- `vocab_act_leer` — person wearing winter hat/sweater competes with "frío/invierno"
- `vocab_act_bailar` — Eastern European folk costume; regen with casual modern clothing

**Adjectives:**
- `vocab_adj_joven_viejo_personas` — confusing multi-figure comparison format; simplify to same-character two-state DUO
- `vocab_adj_ruidoso_tranquilo` — split panel with complex scenes; simplify to iconic contrast
- `vocab_adj_rapido_lento` — dual comparison format too busy; single subject in motion vs. at rest

**Body:**
- `vocab_body_diagram` — full character reference sheet format (multiple views, angles); regen as single front-facing illustration with no chart format

**Clothing:**
- `vocab_cloth_sombrero` / `vocab_cloth_falda` / `vocab_cloth_vestido` — style inconsistency with other clothing images; regen with consistent simple isolated-garment format

**Emotions:**
- (nervioso already in F queue)

**Food:**
- `vocab_food_limon` — pencil/sketch artifact visible on fruit skin
- `vocab_food_huevo` — orange/yellow border frame artifact baked into image

**Health:**
- `vocab_health_cita_medica` — calendar shows "CONSULTATION" in English; regen with calendar page showing clock/appointment symbol only, no English text
- `vocab_health_pastilla` — confusing: main subject looks like a glowing white sphere, not a pill; regen with a clear blister pack or oblong capsule

**Numbers:**
- `vocab_num_currency` — third price tag reads "$€..00" (garbled); regen with clean currency symbols (€, $, £) on separate clean tags with legible amounts
- `vocab_num_11_20` — dice cards have garbled label text at bottom ("LEST10", "LB115" etc.); regen with clean number cards, no captions
- `vocab_num_ordinals` — podium shows 1st/4th/3rd positions (missing 2nd place); regen with correct 1st/2nd/3rd podium
- `vocab_num_tens` — abstract grid of dots/shapes is confusing; regen with clear skip-counting illustration (groups of 10 objects)

**People:**
- `vocab_people_hombre` — before/after dual-format (implies transformation, not "man"); regen as single clear portrait of an adult man
- `vocab_people_estudiante` — Arabic script visible on background element; regen with clean study scene, no non-Roman text

**Places:**
- `vocab_places_escuela` — US flag on flagpole; regen without any national flag
- `vocab_places_supermercado` — Asian-language characters on store signage; regen with no text on signs

**Professionals:**
- `vocab_ppl_cocinero` — Asian-script posters on kitchen wall; regen with clean kitchen, no wall text

**Things:**
- `vocab_things_silla` — yellow/gold border artifact frame around chair image; regen without border

**Places (place_ namespace):**
- `vocab_place_banco` — "BANK" in English on building facade; regen with universal bank symbol (vault door, piggy bank, or coin icon) without English text

---

### Overall Library Status (S59–S60 Full Audit)

| Grade | Count | % | Action |
|-------|-------|---|--------|
| **A** | ~170 | ~70% | Keep — no action needed |
| **B** | ~30 | ~12% | Keep — note for next regeneration batch |
| **C** | ~23 | ~9% | Schedule regen in next batch |
| **D** | 3 | ~1% | Regen before next student-facing release |
| **F** | 7 | ~3% | Regen immediately — do not show to students |
| **Total** | ~233 | 100% | |

**Library health: 82% A/B (solid), 18% need attention. F-grade count: 7.**

**Priority order:**
1. Regen 7 F-grade images (prompts above)
2. Regen 3 D-grade images (prompts above)
3. Regen 23 C-grade images in next image batch
4. Note B-grade images for improvement in the batch after that

---

## Part I.F — Magic Key to Spanish: Full Audit & Design Implications

**Source:** Margarita Madrigal, *Magic Key to Spanish* (full scan uploaded by founder, April 2026)
**Status:** COMPLETE — full text extracted and read. 45 lessons catalogued.
**Session:** S63 (April 15, 2026)
**File on disk:** `attached_assets/madrigals_magic_key_to_spanish_20260415_0001_1776285811018.pdf`

This section contains the authoritative analysis of *Magic Key to Spanish* based on the complete extracted text. This is a fundamentally different book from *See It and Say It* — not a companion, but an alternate entry method. Understanding the difference is essential for HoloHola's pedagogy design.

---

### What Kind of Book This Is

*Magic Key to Spanish* (45 lessons) is structured around a single foundational insight: **English speakers already know thousands of Spanish words — they just don't know they know them.** The "magic key" is a system of suffix conversion rules. Change "-tion" to "-ción," "-ous" to "-oso," "-ty" to "-dad," "-ist" to "-ista," "-al" stays "-al," "-ry" to "-rio," "-ive" to "-ivo," and so on — 11+ conversion categories, each with hundreds of confirmed Spanish words, all taught in the first two lessons.

Lessons 1 and 2 alone give a student access to 1,000+ Spanish words they can pronounce and use immediately — without memorizing a single item. By Lesson 3, they're already building sentences with this vocabulary.

This is the opposite of *See It and Say It*'s approach. Madrigal's first book teaches through image-anchored Q&A and builds vocabulary from pictures. *Magic Key* teaches through pattern recognition and builds vocabulary from English. Both arrive at conversation — they start from different directions.

**HoloHola implication:** Our `CognateRecognitionGrid` is built for the *See It and Say It* style (small, topic-specific cognate tables). *Magic Key* calls for something larger — a systematic conversion-rule module that teaches the 11 patterns explicitly, with a generator exercise. This would be a separate chapter intro component or even its own chapter type.

---

### The Three-Column Sentence-Forming Exercise — The Core Format

This is not one feature among many — it is the **primary practice format of the entire 45-lesson book.** Every single lesson contains at least one "SENTENCE-FORMING EXERCISE" with three columns. The structure is always:

- **Column 1:** Verb forms, always showing: question form / affirmative / negative (e.g., *¿Tomó usted? / Tomé / No tomé*)
- **Column 2:** Direct objects and nouns (*café, rosbif, una ensalada, sopa, un sándwich, biftec, un taxi, el tren*)
- **Column 3:** Time and place adverbs (*esta mañana, esta tarde, anoche, en el restaurante, en el hotel, en el club*)

The instructions are always the same: "Combine the words below in different ways to form as many sentences as you can. Just be sure to use words from each of the three columns in every sentence you form."

**Why this format is extraordinary:** Three columns with 5 verbs × 10 nouns × 8 locations = 400 unique grammatical sentences from a single exercise. The student is a sentence generator, not a sentence repeater. The format also makes the structure of Spanish sentences visible as a physical layout — three swappable slots. Students internalize sentence structure as a spatial mental model, not a grammatical rule.

**Confirmed across the book:** Lessons 1, 3, 4, 5, 8, 11, 14, 16 (and every other lesson) all contain this exact exercise. It is the book's backbone.

**Design action items:**
- Audit existing `SentenceFrameGrid` data — does it expose three genuinely independent swappable columns, or is it presenting fixed sentences with highlighted slots? The distinction matters enormously
- If `SentenceFrameGrid` doesn't offer this, consider a dedicated "sentence generator" drill mode for Daniela where she presents the three columns and asks the student to construct any valid combination
- Daniela teaching note: *"Think of Spanish sentences as three columns. You pick one from each and they snap together. Every combination you make is a complete, correct sentence. Let's try it."*

---

### Column 1 Mixes Tenses — By Design, Throughout the Book

**Confirmed in the actual text:** By Lesson 11, Column 1 of the sentence-forming exercise reads:

> *¿Va a...? / Voy a... / Va a...*

That's "going to" — the future-intention construction — mixed with preterite forms in the same exercise. By Lesson 16:

> *¿Leyó usted? / Leí / Va a leer / Voy a leer / El periodista escribió...*

Column 1 is freely mixing simple past (leyó, leí), third-person past (escribió), and future-going-to (va a leer, voy a leer) in a single grid. The student picks any verb form from Column 1 without being told which tense it is — they're just building sentences. Tense classification is entirely invisible.

**Why this is pedagogically radical:** Traditional language textbooks quarantine tenses because the table-filling approach to grammar requires it. If you're filling in a conjugation table, you can only work one tense at a time. But if you're picking from a sentence-generating column, the tense is just another slot-choice. Madrigal's format makes tense-mixing natural and non-alarming.

**HoloHola implication:** Once a student has encountered preterite and "going to" future (which we introduce in the daily chapter), the `SentenceFrameGrid` should offer mixed-tense columns as a natural consolidation exercise. This is not advanced — it's how Madrigal structures Lesson 11.

**Design action items:**
- Add a `tenseMode: "single" | "mixed"` field to `SentenceFrameGrid` items
- First mixed-tense grid should appear as soon as a student knows both preterite past and *ir a* future (approximately the second or third chapter in current HoloHola structure)
- The mixed grid should not label the tenses — just use them. Let Daniela mention the tense casually if the student asks

---

### Preconjugated Forms — The Entire Book Works This Way

**The user noticed this on page 40. It's not a feature of one page — it's the structural spine of every lesson.** Throughout all 45 lessons, Madrigal never presents a conjugation table until the student has seen every form pre-cooked in context first. The standard lesson pattern for introducing a new verb is:

> *TOMÉ — I took / NO TOMÉ — I didn't take / ¿TOMÓ USTED? — Did you take?*

That's it. Three pre-conjugated forms, displayed with their English meanings, immediately followed by a conversation that uses all three. The student never fills in a blank — they see the form, then use it.

The "NOUNS CONVERTED INTO VERBS" exercise in Lesson 8 extends this — it gives students hundreds of "-ación" nouns and shows them that removing "-ación" and adding "-é" (for I) or "-ó" (for anyone else) creates any Spanish AR verb in the past tense. This is a preconjugated generator, not a table.

**The rule as Madrigal states it:** "Add 'é' for me. Add 'ó' for anybody else." — "Anybody else" is the most efficient pronoun instruction ever written. One rule covers él, ella, usted, third-person singular — no pronoun distinctions needed until much later.

**HoloHola implication:** Our chapter seed data should present new verbs exactly as Madrigal does — the "I" form, the "anyone else" form, and the question form — before any conjugation table appears. The `verbGroups` structure in `SentenceFrameGrid` already does this, but the framing in Daniela's instruction and the UI should emphasize the pre-built forms, not the slots in a table.

---

### Tú — Introduced in Lesson 45, the Very Last Lesson

**This is even more extreme than the founder expected.** The book has 45 lessons. *Tú* is introduced in Lesson 45, the final lesson, under the heading "THE INTIMATE FORM OF ADDRESS."

Here is the exact framing Madrigal uses:

> *"In Spanish there is an intimate form of address that is used with members of your family and close friends. In this case the pronoun 'usted' (you) becomes 'tú' (thou) and the verbs change their endings."*
> 
> *"In order to change verbs into the intimate form, ADD THE LETTER 'S' TO THE SINGULAR THIRD MAN IN ALL TENSES (except the preterite and the command)."*

That's the entire instruction. After 44 lessons of building automatic fluency with *usted* forms, the student is told: to speak intimately, just add -s to the form you already know.

- *usted habla* → *tú hablas*
- *usted hablará* → *tú hablarás*
- *usted vendía* → *tú vendías*
- *usted ha hablado* → *tú has hablado*

**Why this is pedagogically extraordinary:**

1. The student already knows every conjugated form they'll ever need for *tú* — it's just -s on top
2. *Tú* is framed as a social and relationship event, not a grammar category: "intimate form" used "with members of your family and close friends"
3. By framing *usted* as the default and *tú* as the intimate upgrade, Madrigal implicitly encodes the social register — formal is unmarked, intimate is the modification
4. The preterite and command are the only irregulars (and they're noted explicitly): preterite uses "-aste" (tomaste vs. tomó) instead of -s

**Madrigal's note on subject pronouns:** The book explicitly states: "Remember that subject pronouns are very frequently dropped in Spanish. 'Tú' is dropped more often than not because the ending of the verb makes it clear who the subject is." — Meaning in practice: once you know *hablas*, you can drop *tú* and just say *hablas*, and nothing is lost.

**HoloHola recommendation:** Adopt the delayed-tú approach immediately. Specific actions:
- Audit Spanish greetings and daily chapters — any tú drills should be shifted to usted
- Daniela introduces tú as a milestone moment, framed as a social/relationship upgrade: *"You've been speaking with usted — the respectful form. Now let me show you what happens when you're talking to someone close. It's one small change."*
- When tú is introduced, Daniela should note the -s rule and demonstrate it with verbs the student already knows: *"You know 'habla' — add s and you get 'hablas.' Same for every verb you know. That's the intimate form."*
- Daniela teaching tip (for danielaNotes): *"Delayed tú is intentional. By the time tú arrives, it's a tiny addition to forms the student already owns. This is far less alarming than presenting a full tú conjugation chart on lesson 1."*

---

### The Cognate System — Much Larger Than "Tables in Every Chapter"

**What the founder observed (cognate tables in every chapter) is true — but the scale is far larger.** In *Magic Key*, cognates aren't a chapter feature — they ARE the chapter. The first two lessons establish 11 conversion categories, each with hundreds of confirmed words:

| Category | Rule | Examples (just a sample) |
|---|---|---|
| I | Words ending in "-or" are usually identical | doctor, conductor, actor, motor, humor, inspector, vapor, senator |
| II | Words ending in "-al" are usually identical | hospital, animal, capital, canal, central, dental, federal, general |
| III | Words ending in "-ant/-ent" → add "e" | importante, elegante, urgente, competente, paciente |
| IV | Words ending in "-ble" are usually identical | probable, possible, adorable, admirable, considerable, flexible |
| V | Words ending in "-ic/-ical" → "-ico" | democrático, romántico, diplomático, fanático, fantástico |
| VI | Words ending in "-ist" → "-ista" | dentista, pianista, turista, capitalista, naturalista |
| VII | Words ending in "-ous" → "-oso" | famoso, delicioso, curioso, nervioso, furioso, generoso |
| VIII | Words ending in "-tion/-sion" → "-ción/-sión" | invitación, conversación, preparación, combinación, nación |
| IX | Words ending in "-ty" → "-dad" | capacidad, comunidad, electricidad, publicidad, velocidad |
| X | Words ending in "-ry" → "-rio" | canario, diccionario, aniversario, itinerario, laboratorio |
| XI | Words ending in "-em/-am" → "-ema/-ama" | problema, programa, poema, sistema, telegrama |

Plus additional patterns: "-ph" → "-f" (telephone → teléfono), "-th" → "-t" (cathedral → catedral), double consonants → single (commission → comisión), "-tion" always → "-ción".

**The total vocabulary unlocked by Lessons 1–2: conservatively 2,000+ words the student can now say in Spanish.** The lesson-2 list of "-ción" words alone runs to 400+ entries.

**What "cognate tables in every chapter" actually means:** Each lesson introduces one or two new conversion categories, giving the student hundreds of new words for free before the conversational content begins. This isn't a warmup — it's the primary content delivery method. The conversation exercises that follow use these cognate words directly.

**HoloHola design implications:**
- Our current `cognateOpener` shows 8–12 cognates at chapter start. That's the right idea at the wrong scale. For a dedicated cognate module (if we build one), the experience should unlock 50–200 words through one conversion rule — the *number* is the point. The student should feel abundance, not introduction
- The conversion rules themselves should be teachable by Daniela in conversation: *"Every English word ending in '-tion' becomes '-ción' in Spanish. Say 'conversación.' 'Invitación.' 'Imaginación.' You just got a hundred words for free."*
- Daniela teaching tip (for danielaNotes): *"When a cognate appears in conversation, celebrate it explicitly: 'You already knew that word — you just didn't know you knew it.' This reframes every cognate from new information to recovered prior knowledge. Different emotional response."*

---

### Chapter Tips — Madrigal's Pedagogical Philosophy in Her Own Words

These are verbatim or near-verbatim from the text. Every one of these is a candidate for Daniela's teaching notes or North Star Principles.

**On learning method:**
> *"Never let a word lie fallow in your mind. The minute you have learned it, try to use it. The mental process of using the word makes it stay with you."*

> *"The best way to learn Spanish is through large concepts and ideas, not through memorizing little isolated words. One idea well established in your mind will give you two hundred verbs forever. And every time you use one of these two hundred verbs you become more automatic in the use of the other hundred and ninety-nine."*

> *"Memorizing is dull and ineffectual. When you learn twenty verbs by rote you are apt to forget most of them and be bored by all of them. You are annoyed by the fact that you have to sit down and toil over them, and they become your enemies. But when you invent a verb it is your creation; you have made it, and you will always like it."*

**On grammar in context:**
> *"Notice that you don't say 'at the club.' In Spanish you must never say you are 'at' places. You are always 'in' places, such as 'in the airport, in the club,' etc."*

> *"Remember that subject pronouns are very frequently dropped in Spanish. 'Tú' is dropped more often than not because the ending of the verb makes it clear who the subject is. You can either say, 'Tú hablas muy bien' or simply 'Hablas muy bien.'"*

> *"The intimate form has an archaic English equivalent (thou, thee, thine), but it has not been used here since it is not used in present-day speech."* [Note: This frames tú as the more modern of the two, which is counterintuitive from an English-speaker perspective — useful for defusing formality anxiety.]

**On Spanish culture/etymology:**
> The etymology of "fortuna" — wealth and good luck are the same word in Latin and Spanish because Romans believed wealth could only come from Fortuna, the goddess of chance. *"Por fortuna" = fortunately; "afortunado" = fortunate.* [This is a model for how Daniela should embed etymology into conversation — not as a lesson interruption but as a tiny story that makes the word unforgettable.]

**On what "anybody else" means:**
> *"Don't forget that the third man form stands for everybody (¡regular!) in the world except yourself."*
> [The parenthetical "¡regular!" is Madrigal humor — treating "regular" as an exclamation in Spanish. This tone belongs in Daniela's voice.]

**Seeding these into Daniela:**
All of these belong in `danielaNotes` as teaching principles. The three "on learning method" quotes are especially valuable — they articulate Madrigal's philosophy and give Daniela a way to explain *why* the lesson is structured the way it is:
- When a student struggles with memorization: *"Don't try to memorize. Invent. Every verb you create from a pattern is yours permanently — you made it."*
- When a student wants a full conjugation table before they're ready: *"One pattern, hundreds of verbs, forever. That's how we build — big concepts, not small lists."*

---

### NEW FINDING: Present Tense Is Introduced at Lesson 22 (of 45)

**This was not in the founder's initial observations — but it's the most structurally surprising finding.** The first 21 lessons teach exclusively in the preterite (past) tense using *usted* forms. There is no "I speak" — only "I spoke," "Did you take?," "I took," "I'm going to take." Present tense ("hablar" → "hablo/habla") doesn't appear until Lesson 22.

This is even more radical than *See It and Say It*'s sequencing. Madrigal's reasoning appears to be:
1. The preterite "-é/-ó" system is simpler to introduce first (just two endings, no stem changes)
2. Students can have complete, functional conversations in the past tense — travel, what you did, what you ate, who you visited
3. "Going to" future (*ir a* + infinitive) covers future needs — no future conjugation required
4. By the time present tense arrives in Lesson 22, the student already has 21 lessons of Spanish fluency. Present tense arrives as one more tool, not the foundational challenge

**HoloHola implication:** Our Spanish chapter structure currently teaches present tense early (greetings: "soy, eres, es"). That's the right call for a conversational AI tutor where students want to describe themselves right now — not report on yesterday. However, Daniela should be aware of this sequencing insight and can reference it explicitly when introducing new tenses: *"Notice you're learning past tense first — that's intentional. You'll use 'I visited' and 'I ordered' in real stories before you need 'I visit' every day."*

---

### Part I.F Summary: What Magic Key Changes About Our Roadmap

| Finding | Current HoloHola State | Recommended Change | Priority |
|---|---|---|---|
| Three-column sentence generator is the core format | SentenceFrameGrid exists but structure unclear | Audit whether SentenceFrameGrid exposes genuine column-pick; add sentence generator drill mode | 🔴 High |
| Multi-tense columns from Lesson 11 onward | Single-tense grids only | Add tenseMode flag; offer mixed-tense grids from chapter 2 onward | 🟠 Medium |
| Preconjugated forms throughout (not just pg 40) | verbGroups does this implicitly | Surface preconjugated forms explicitly in UI; seed "yo/él" form pairs in every chapter | 🟠 Medium |
| Tú is Lesson 45 of 45 — add-s rule | tú likely appears in greetings | Audit and delay tú; introduce as social milestone with add-s framing | 🔴 High |
| Cognate system = 11 conversion rules × 200+ words each | cognateOpener with 8–12 words | Build conversion-rule module; Daniela should teach rules conversationally | 🟠 Medium (new component) |
| Chapter tips — philosophy quotes ready for Daniela | Some tips in northStarPrinciples | Seed 6+ Madrigal tips into danielaNotes immediately | 🔴 High (can do now) |
| Present tense at Lesson 22 — sequencing rationale | Present tense early | No change needed — keep present early for conversational AI. Add Daniela note acknowledging the choice | 🟡 Low |

---

### Daniela Notes to Seed Now (from this audit)

These are ready to load into `danielaNotes` immediately — no additional scan needed:

1. *"Never let a word lie fallow. The minute a student learns a word, get them to use it. The mental process of using it makes it permanent."* (teaching rhythm)
2. *"Large concepts, not small lists. One pattern well-established gives the student two hundred words forever."* (teaching philosophy)
3. *"Invention beats memorization. When a student creates a form from a pattern, it's theirs. When they memorize it, it's borrowed."* (teaching philosophy)
4. *"When a cognate appears, celebrate it explicitly: 'You already knew that word — you just didn't know you knew it.' Reframe cognates as recovered prior knowledge."* (what_worked)
5. *"Delayed tú is intentional. By the time tú arrives, it's a +s on forms the student already owns. Don't rush it — build usted fluency first."* (teaching philosophy)
6. *"In Spanish, people are always 'in' places, never 'at' places. 'In the restaurant, in the club, in the airport' — never at."* (idea_to_try — surface this when students make the error)
7. *"Subject pronouns drop constantly in Spanish. 'Hablas' is complete. 'Tú hablas' is emphatic. Teach drop-first, emphasize second."* (teaching rhythm)

---

### Change Log Entry

| Date | Action | Status |
|---|---|---|
| Apr 15, 2026 (S63) | Full Magic Key text extracted (97MB PDF → pdftotext → 11,018 lines) | Complete |
| Apr 15, 2026 (S63) | All 45 lessons catalogued; key innovations documented | Complete |
| Apr 15, 2026 (S63) | 7 Daniela teaching notes identified and queued for danielaNotes | Ready to seed |
| Next session | Seed 7 tips into danielaNotes via admin panel | In queue |
| Next session | Audit Spanish chapters for premature tú usage | In queue |
| Next session | Review SentenceFrameGrid implementation against Magic Key column-generator standard | In queue |

---


## Part I.G — The Two-Book Synthesis: What HoloHola Must Become

**Session:** S63 (April 15, 2026)
**Status:** GATHERING MODE — findings documented, design decisions deferred
**Trigger:** Founder observation that the two books are distinct animals from the same author, and that neither is simply better than the other

---

### The Publication Order Changes Everything

Madrigal published *Magic Key to Spanish* in 1953. She published *See It and Say It in Spanish* a decade later, in 1963.

This sequence is not incidental. *Magic Key* came first — and it is brilliant, systematic, and deeply incomplete as a learning product. 500 pages, no images, no characters, no emotional warmth, no visual anchor for anything. It is a radical cognitive insight — the cognate unlock — packaged in the format of a dense academic text. It works for the kind of person who will sit alone with a book and derive things. That is a small audience.

Madrigal spent a decade watching what was missing. Then she built *See It and Say It* to provide it: warmth, humor, characters, images, short chapters, Q&A rhythm that mimics real conversation. She didn't improve on Magic Key — she solved the problem Magic Key couldn't solve, which was making the experience of learning Spanish feel like spending time with someone rather than decoding a system.

**What this means for HoloHola:** We are not choosing between the two books. We are completing the arc Madrigal started. She got as far as a book could take her. The next version of what she was building is interactive, responsive, and relational — a tutor who embodies both the systematic mind of Magic Key and the warm presence of See It and Say It.

---

### What Each Book Contributes — An Honest Accounting

| Dimension | Magic Key (1953) | See It and Say It (1963) |
|---|---|---|
| **Vocabulary unlock method** | 11 suffix conversion rules → 2,000+ words in 2 lessons | Image-anchored Q&A → ~200 words per theme chapter |
| **Primary practice format** | Three-column sentence generator (student constructs) | Q&A drill (student responds to fixed question) |
| **Emotional register** | Systematic, philosophically confident, occasionally dry wit | Warm, illustrated, character-driven, conversational |
| **Image use** | None | Every page — drawings anchor vocabulary to memory |
| **Teaching philosophy stated explicitly** | Yes — multiple extended passages on how learning works | Implicit — the structure embodies the philosophy |
| **Tense sequencing** | Preterite first (Lesson 1), present at Lesson 22 of 45 | Ser/estar and present early; preterite in mid-book |
| **Tú timing** | Lesson 45 of 45 — final lesson | Earlier, not aggressively delayed |
| **Grammar explanation** | Minimal — learn by doing, not by rule | Light — rules appear but conversation is primary |
| **Accessibility** | Low — 500 dense pages, no visual relief | High — illustrated, short chapters, casual tone |
| **Scale** | 45 lessons, ~500 pages | ~200 pages, illustrated |
| **Student agency** | High — student generates sentences | Medium — student answers set questions |
| **Teachability of the format** | High — rules are explicit and transferable | Medium — warmth is a quality, harder to replicate |

**Neither book wins across all dimensions.** This is the founder's core observation and it is correct.

---

### What HoloHola Has That Neither Book Can Touch

Before synthesizing the two books, name what HoloHola adds that is genuinely new — not just a digital version of either:

1. **A tutor who responds to what you actually said.** Both books are static. Magic Key's columns produce 400 possible sentences — but the book can't hear any of them. Daniela can. Every combination the student constructs gets a real response in Spanish, from a character, in context.

2. **Real-time error response without shame.** Books can't correct pronunciation. Books can't notice that the student used the wrong object pronoun. Daniela can notice, recast, and move on — without the student feeling publicly corrected.

3. **The "use it now" mandate, enforced.** Madrigal's most important tip: "Never let a word lie fallow in your mind. The minute you have learned it, try to use it." A book teaches the word and then turns the page. Daniela can pause the lesson and require the student to use the word in a sentence before moving on.

4. **Scene and character.** Neither book truly immerses the student in a situation. *See It and Say It* has characters but they don't respond to you. HoloHola can place the student in a restaurant, switch Daniela to el_mesero's voice, and require real ordering — with the student's specific language, not a scripted model answer.

5. **Persistence and memory.** Daniela remembers what you struggled with yesterday. She can resurface a word you forgot. She can celebrate when you finally get something right that you've gotten wrong three sessions in a row. Neither book can do this.

6. **The relationship itself.** Madrigal built a persona (warm, witty, encouraging). Daniela IS that persona, live. The student isn't reading a book with a friendly author — they're talking to the author's spiritual successor, in real time, who is talking back.

---

### The HoloHola Synthesis: How the Two Books Combine

The synthesis is not additive (take Magic Key feature + See It and Say It feature = sum). It is an architecture where each book contributes its strongest element at the right moment in the learning sequence.

**Phase 1 — Mass Unlock (Magic Key's opening move)**

The student's first contact with a language should be the cognate system — the moment they discover they already know hundreds of words. This should feel like revelation, not instruction. Daniela teaches one conversion rule conversationally: *"Every English word ending in -tion becomes -ción in Spanish. Say 'conversación.' 'Invitación.' 'Imaginación.' You just got a hundred words."* The student derives, doesn't memorize. This is Magic Key's strongest idea and our current cognateOpener barely hints at its scale.

**Phase 2 — Visual and Emotional Anchor (See It and Say It's opening move)**

New vocabulary beyond cognates lands with an image. Daniela speaks the word; the image appears; the word and image link in memory. This is the VocabQA format and it is right. See It and Say It spent a decade proving this works. HoloHola should not abandon it — it should extend it: the image is not just a picture, it is the first scene of a story Daniela is building with the student.

**Phase 3 — Generate, Don't Repeat (Magic Key's core practice)**

Once the student has a vocabulary base, the practice mode shifts from Q&A to generation. Daniela presents three columns — verb forms, objects, locations — and says: "Pick one from each and say it to me." The student constructs a sentence. Daniela responds as a character in that sentence's implied scene. 400 possible sentences from one grid; 400 real exchanges with Daniela. This is what neither book can do — but it is Magic Key's format, animated by a conversational AI.

**Phase 4 — Scene Practice (HoloHola's original contribution)**

Once the student can construct sentences, they enter a scene. El restaurante. La farmacia. El aeropuerto. Daniela switches to a character voice. The student is not performing an exercise — they are in a situation that requires the language. This is See It and Say It's vision (contextual warmth, real situations) taken to its logical conclusion.

**Phase 5 — Tú as Milestone (Magic Key's sequencing wisdom)**

After the student has built solid fluency with usted forms across multiple chapters and scenes, Daniela introduces tú. Not as a grammar lesson — as a relationship event. *"You've been speaking with me as if I'm a stranger. Let me show you what changes when we're close."* She demonstrates: add -s to the form you already know. The student already owns the conjugation. Tú is the social permission, not the grammatical hurdle.

---

### Key Tension to Resolve in Design (Not Now — Gathering Mode)

These are genuine design tensions that the synthesis creates. Documented here for when design decisions begin:

**Tension 1: Entry point — cognate mass unlock vs. character warmth**
Magic Key says: start with 100 words in 90 seconds (cognitive revelation).
See It and Say It says: start with one warm person and one clear scene (emotional connection).
HoloHola may need both — Daniela IS the warm entry point, and the cognate reveal happens in her voice. The question is sequencing within the first session.

**Tension 2: Generation vs. scaffolded Q&A**
Magic Key's column format requires that the student produces a sentence from scratch. See It and Say It's Q&A scaffolds the student toward a model answer. Both have value; generation is harder and more powerful; Q&A is more accessible at the very beginning. The HoloHola resolution may be: Q&A first (answer about the image), then column generation (construct new sentences about the same vocabulary).

**Tension 3: Preterite-first vs. present-first tense sequencing**
Magic Key goes preterite → present (Lesson 22). See It and Say It goes present → preterite. Our current implementation is present-first because students want to describe themselves *right now*. Magic Key's preterite-first logic is compelling (simpler ending system) but may not be right for a conversational AI where students immediately want to say "I am" and "I like." Document the tension; don't resolve in gathering mode.

**Tension 4: Delayed tú vs. early relational warmth**
Magic Key delays tú until the student is fully fluent with usted. But HoloHola's Daniela is an intimate relationship from session 1. If Daniela uses usted with the student, that's odd — she's supposed to feel like a trusted friend, not a formal stranger. Resolution candidates: (a) Daniela addresses the student with tú from the start even though the student uses usted in exercises, (b) Daniela explicitly frames this: "When you talk to me you can use tú — but when we practice formal scenarios, use usted." Gathering mode — document, don't decide.

---

### Change Log Entry

| Date | Action | Status |
|---|---|---|
| Apr 15, 2026 (S63) | Publication order confirmed: Magic Key (1953) → See It and Say It (1963) | Documented |
| Apr 15, 2026 (S63) | Two-book synthesis analysis written | Gathering mode — design decisions deferred |
| Apr 15, 2026 (S63) | 4 key design tensions identified | Documented — not resolved |
| Apr 15, 2026 (S63) | 5-phase HoloHola synthesis architecture drafted | Hypothesis only — not finalized |

---


## Part I.H — Technology Watch: Gemini 2.5 TTS Multi-Speaker

**Session:** S64 (April 16, 2026)
**Status:** GATHERING MODE — announcement reviewed, no implementation decision made
**Source:** Founder flagged Google announcement for Gemini 2.5 TTS (founder referenced as "Gemini 3.1 TTS" — version name to be confirmed against official release notes)

---

### What the Announcement Is

Google's Gemini 2.5 TTS includes a **native multi-speaker mode** where a single API call can generate a full multi-character audio output. Rather than making separate TTS requests per speaker and stitching them together, the model receives a structured dialogue (speaker labels + text segments) and returns a single continuous audio stream with distinct, consistent voices per character — handled entirely within the model.

This is meaningfully different from our current approach and from standard "voice cloning" TTS products. The key word is **native** — the voice transitions are part of the generation, not a post-processing seam.

---

### Current HoloHola Architecture (What We Have Now)

Our existing multi-character voice system (`character-registry.ts` + `speak_as` / `resume_tutor` function calls) works like this:

**Current flow per character exchange:**
1. Daniela decides to hand off to a character — calls `speak_as(el_mesero, "¿Qué desea usted?")`
2. Server receives the function call, looks up `el_mesero` in character registry, gets their Google Chirp3-HD voice ID
3. Sends text to Google Cloud TTS with that voice ID → audio buffer returned
4. Audio streamed to client
5. Daniela then calls `resume_tutor("Ahora, ¿cómo respondería usted?")` to switch back
6. Server switches back to Daniela's voice ID → new audio buffer → streamed to client

**What this means in practice:**
- Each voice switch is a separate TTS API round-trip
- There is a small gap between each speaker (the time of the round-trip and client re-buffering)
- Daniela must explicitly decide when to hand off and when to reclaim — two function calls per exchange
- A full 4-line dialogue (Daniela → el_mesero → Daniela → el_mesero) requires 4 separate TTS calls
- The voices are high-quality (Chirp3-HD), consistent within a session, and working well — but the transitions have seams

**What works well about the current system:**
- Voice quality is excellent (Chirp3-HD voices are expressive and clear)
- Character identity is stable (same voice ID per character every time)
- Daniela has explicit control over when to hand off
- The function-call model integrates cleanly with our existing native FC handler pipeline
- Spanish, French, and other language rosters are already built and working

---

### What Gemini 2.5 Multi-Speaker TTS Would Change

**Proposed new flow for a multi-character dialogue segment:**
1. Daniela generates a full dialogue script in her response (e.g., a 6-line restaurant exchange)
2. Instead of `speak_as` function calls, Daniela marks the script with speaker labels: `[DANIELA]`, `[EL_MESERO]`, `[ESTUDIANTE_PROMPT]`
3. A single Gemini 2.5 TTS call receives the labeled script and returns one continuous audio stream with voice transitions baked in
4. Client receives and plays the stream — no gaps, no round-trips between lines

**What this would unlock:**
- **Seamless voice transitions** — the audio is continuous; the model handles the voice shift internally. This is the difference between a dubbed TV show and a live conversation
- **Dramatically fewer API calls** — a 6-line dialogue goes from 6 TTS requests to 1
- **Richer scene performance** — currently Daniela and el_mesero can't interrupt each other, overlap, or have quick back-and-forth exchanges without noticeable pause. Native multi-speaker makes natural conversation rhythm possible
- **Better emotional consistency** — when the model generates voices for a scene holistically, prosody (pacing, stress, intonation) can be matched to the dialogue arc, not just the isolated line

**What would not change:**
- Daniela's identity and teaching role are unchanged — she still controls the pedagogy
- The Magic Key sentence-generator format could still be spoken as a three-way exchange (Daniela introduces, el_mesero provides the scenario, student responds)
- Character roster (el_mesero, la_doctora, carlos, etc.) still exists — just mapped to Gemini voice slots rather than Chirp3-HD voice IDs

---

### How This Fits the Synthesis Architecture (Part I.G)

The synthesis architecture in Part I.G describes Phase 4 as **Scene Practice**: the student is placed in a real situation — a restaurant, a pharmacy, an airport — and must communicate with characters who respond naturally. Phase 4 depends on multi-character dialogue feeling *real* rather than assembled.

The current speak_as system gets us to Phase 4 — but the seams between voice switches remind the student they're in a drill, not a conversation. Native multi-speaker TTS is the technical precondition for Phase 4 feeling genuinely immersive.

Madrigal's "use it now" mandate — *never let a word lie fallow* — is most powerfully enforced in a scene where the student has to use the word to advance the conversation. That requires the scene to feel compelling enough that the student actually wants to advance it. Voice quality and continuity are not decoration — they are part of what makes the scene worth being in.

---

### Design Tensions This Introduces (Gathering Mode — Not Resolved)

**Tension A: Gemini TTS voices vs. Chirp3-HD voices**
Our current Chirp3-HD voices (Google Cloud TTS) are very high quality and production-stable. Gemini 2.5 TTS voices may be different in character. We'd need to evaluate: do they match or exceed Chirp3-HD quality? Are they consistent across multiple calls (character voice stability)? What language coverage do they have (Spanish, French, Portuguese, etc.)?

**Tension B: Structured script vs. emergent function calls**
The current speak_as architecture is emergent — Daniela decides in real time whether and when to hand off to a character. A multi-speaker TTS approach may require Daniela to generate a full dialogue script in advance and submit it as a single structured call. This changes the conversational model: Daniela is authoring a scene, not improvising one. Both modes have value; they're different experiences.

**Tension C: Student participation within the multi-speaker stream**
Multi-speaker TTS can voice Daniela and el_mesero. It cannot voice the student — the student speaks live. The interaction architecture needs to be: Daniela+characters generate their audio as a multi-speaker stream → pause → student speaks → Daniela+characters respond. This is a natural turn-taking model, but it requires careful design of where the pauses land and how Daniela prompts the student's turn.

**Tension D: Migration cost vs. current system quality**
The current speak_as system is working. It's live. Chirp3-HD voices are good. The question is whether the improvement from native multi-speaker TTS is worth a significant architectural change. This is a quality-vs-cost tradeoff that can't be evaluated without hearing Gemini 2.5 TTS output on our actual Spanish dialogue scripts.

---

### The Rate Limit Problem — And Why It May Be Structural, Not Temporary

**Context from founder (S64):** HoloHola already has the Gemini 2.5 TTS integration set up in the codebase. It hasn't been activated because the concurrency limits (requests per day / RPD) are too low for production use. The founder observed that all Gemini TTS models — including newer ones — carry the same low concurrency constraints, which seems counterintuitive if these are simply rollout limitations that would eventually be raised.

**The likely explanation: Google has two competing TTS products.**

Chirp3-HD (Google Cloud TTS) is a mature, separately monetized, production-scale TTS product — explicitly designed for high-concurrency real-time voice generation at scale. This is the right tier for what HoloHola does today: streaming Daniela's voice continuously through a live tutoring session, potentially across many concurrent users.

Gemini TTS is a newer model with better voice quality and features like multi-speaker — but it sits in the Gemini API ecosystem rather than Google Cloud TTS. If Google raised Gemini TTS concurrency to match Chirp3-HD, it would directly cannibalize Chirp3-HD's paid production tier. There is a clear financial incentive for Google to keep Gemini TTS rate-limited as a "premium quality, lower volume" tier while Chirp3-HD remains the "production scale, your SLA, your cost center" tier.

This pattern is consistent with how Google has handled similar product overlaps (e.g., Gemini chat vs. Vertex AI, BigQuery vs. Firestore — different tiers for different scale/price points with deliberate feature gaps to force segmentation).

**What this means for HoloHola:**

The Gemini TTS rate limits are probably not a temporary rollout constraint that will quietly go away. They're more likely a deliberate product tier boundary. The path to higher Gemini TTS concurrency is almost certainly through a paid enterprise contract negotiation — not through waiting for limits to be raised organically.

**A hybrid architecture emerges naturally from this constraint:**

| Use case | Right product | Reason |
|---|---|---|
| Daniela's real-time voice (continuous, session-long) | Chirp3-HD | High concurrency needed; this is the dominant volume |
| Pre-scripted scene dialogues (Daniela + characters, one shot per scene) | Gemini TTS multi-speaker | Low concurrency fine; one call per scene entry; quality and seamlessness matter more than volume |
| Character one-off lines within speak_as (real-time, emergent) | Chirp3-HD | Low latency required; must work on demand |

This hybrid approach doesn't require choosing between the two products. It uses each for what it does best: Chirp3-HD for the high-volume, low-latency real-time voice; Gemini TTS multi-speaker for the low-volume, high-quality scene preamble that sets the context before a live interaction begins.

**Example scene flow under hybrid architecture:**
1. Daniela (Chirp3-HD, real-time) introduces the scene: *"Estás en el restaurante. Escucha."*
2. Gemini TTS multi-speaker (pre-scripted, single call) plays a 4-line opening exchange between el_mesero and a brief customer — sets the scene atmosphere with seamless voice transitions
3. Daniela (Chirp3-HD, real-time) re-enters: *"Ahora es tu turno. ¿Qué quieres ordenar?"*
4. Student speaks (live)
5. Daniela (Chirp3-HD) responds dynamically to what was said

The seam between Gemini TTS and Chirp3-HD only appears at step 3 — Daniela resuming from a pre-scripted scene into real-time. This is a natural "scene ends, you act" moment that doesn't feel mechanical.

**This makes Tension D (migration cost) much smaller.** The hybrid approach doesn't replace Chirp3-HD — it adds Gemini TTS multi-speaker as a pre-scripted scene layer on top of the existing architecture. Lower risk, lower cost, preserves the current system.

---

### Recommended Next Steps (When Ready to Evaluate)

1. **Get API access** — obtain Gemini 2.5 TTS access and run a test with a sample 6-line restaurant dialogue using Daniela + el_mesero voice slots in Spanish
2. **Compare audio quality** — side-by-side with equivalent Chirp3-HD output: naturalness, expressiveness, accent quality, transition smoothness
3. **Evaluate voice consistency** — call the same 6-line script 5 times; are the voices stable and recognizable across calls? (Character identity depends on this)
4. **Check language coverage** — test Spanish (primary), French, Portuguese, German, Italian, Japanese — does multi-speaker quality hold across all our target languages?
5. **Prototype a scene** — if quality and consistency check out, prototype the Phase 4 restaurant scenario with native multi-speaker TTS. Compare student experience to current speak_as version
6. **Migration decision** — if prototype is clearly better, design the migration path: can speak_as function calls be retained as a fallback? Can both systems coexist per-scenario?

---

### Change Log Entry

| Date | Action | Status |
|---|---|---|
| Apr 16, 2026 (S64) | Gemini 2.5 TTS multi-speaker documented | Gathering mode — no implementation decision |
| Apr 16, 2026 (S64) | Rate limit analysis: structural boundary, not rollout gap | Hybrid architecture proposed |
| Apr 16, 2026 (S64) | HoloHola as reference implementation — strategic position documented in Part I.I | Gathering mode |
| *Pending* | API access + quality evaluation | Blocked on access |
| *Pending* | Side-by-side comparison with Chirp3-HD | Blocked on access |

---


## Part I.I — Strategic Position: HoloHola as the Reference Implementation for Multi-Speaker TTS

**Session:** S64 (April 16, 2026)
**Status:** GATHERING MODE — strategic observation documented
**Origin:** Founder observation during TTS rate limit discussion

---

### The Insight

Every TTS vendor currently trying to demonstrate that multi-speaker conversational audio is production-ready faces the same problem: they have API documentation, playground demos, and benchmark numbers. What none of them have is a real app with real users where the technology is doing something that actually matters to people.

HoloHola is positioned to be that app.

A student sitting in a simulated restaurant in Buenos Aires, hearing the waiter's voice and the teacher's voice as distinct, continuous, seamlessly transitioning characters — and learning from the experience — is not a playground demo. It is the proof of concept that no TTS vendor can manufacture internally. They build APIs. They do not build language learning experiences. They cannot show what their product makes possible the way a real app can.

**The repositioning:** HoloHola is not a customer of TTS vendors. It is the validation platform — the reference implementation that demonstrates multi-speaker TTS as a production-grade, educationally meaningful technology. That is a fundamentally different power relationship.

---

### Why Language Learning Is the Highest-Signal Use Case for Multi-Speaker TTS

This is not an arbitrary claim. Language learning produces the most demanding audio audience that exists for a consumer product:

1. **Students are actively training their ear.** They are not passively consuming audio — they are listening critically, comparing what they hear against a mental model they are trying to build. Voice quality flaws that would be invisible to a casual listener are immediately apparent to someone whose entire task is accurate auditory perception.

2. **Character distinctness is pedagogically functional, not decorative.** When el_mesero sounds different from Daniela, the student's brain processes a social register shift — formal service interaction vs. trusted teacher. That shift is a learning cue, not an aesthetic choice. If the voices blur together, the pedagogy breaks.

3. **Accent authenticity carries real stakes.** A student learning Mexican Spanish should hear Mexican Spanish. A student learning Argentine Spanish should hear the porteño intonation. Generic "Spanish" voices teach wrong habits. This makes HoloHola a demanding but precise client — we know exactly what quality means and can articulate it in ways that feed directly back into vendor development priorities.

4. **Emotional engagement is measurable.** Students who find Daniela's voice warm and credible stay longer, complete more lessons, and self-report higher confidence. This gives HoloHola the ability to measure what "good TTS" produces in real behavioral outcomes — retention, completion, time-on-task — rather than subjective quality scores. That's data no benchmark provides.

**The implication:** If a TTS vendor's multi-speaker output sounds good to a language student who is actively training their ear, it sounds good to every less-demanding use case. HoloHola is the hardest possible test. Passing it is the most credible endorsement in the market.

---

### The Leverage Structure

When HoloHola ships a compelling multi-speaker scenario in production — one lesson, one scene, properly executed — the leverage structure inverts:

**Before shipping:** HoloHola is a TTS customer, constrained by whoever's rate limits are lowest.

**After shipping:** HoloHola is the reference implementation. Every TTS vendor wants to be the one powering it. The language on the case study reads: *"This is what our product makes possible."* That case study is worth more in enterprise TTS sales than any benchmark score.

At that point, the vendor needs the relationship as much as the customer does. Rate limits become negotiable. Pricing becomes negotiable. Early access to new features (next-generation voices, new languages, lower latency modes) becomes negotiable — because the vendor wants to be the company that the reference implementation endorses.

**The vendor-agnostic design principle becomes the leverage itself.** Because HoloHola is designed to swap TTS vendors at the infrastructure level (Chirp3-HD today, Gemini TTS when ready, ElevenLabs or OpenAI if they ship first), no single vendor can take the relationship for granted. Each one competes to be the one HoloHola points to. That competition is what forces production-grade concurrency onto the market faster than anything else — faster than internal Google budget politics, faster than benchmark races, faster than developer advocacy.

---

### The Competitive Forcing Function

The broader market implication: HoloHola shipping a compelling multi-speaker scene is not just a product milestone. It is a competitive signal to every TTS vendor simultaneously that:

1. The use case is real and production-worthy, not theoretical
2. A customer exists who is sophisticated enough to evaluate voice quality rigorously
3. The first vendor to meet that customer's production needs at scale wins the endorsement

This is how ElevenLabs got early traction — by being adopted by audio content creators who became their most credible advocates. It is how Whisper got adopted — by being the first transcription model that actually worked in a real app for real users. The app that demonstrates the capability first shapes the market's understanding of what the capability means.

---

### What This Requires from HoloHola

To occupy this position, one thing must be true: **the scene must actually be exceptional.** A mediocre multi-speaker scene is not a reference implementation — it is a demo. The bar is high:

- Character voices must be genuinely distinct and appropriate to their role (a waiter sounds like a waiter, not like the teacher with a slight variation)
- Transitions between speakers must be seamless — no gaps, no mechanical stitching
- The pedagogical value must be visible — a student watching the scene should understand immediately why the voice distinction matters to their learning
- The scene must feel like a scene, not an exercise — real dialogue, real register shifts, real social dynamics

This is achievable. The Magic Key three-column sentence generator + See It and Say It's character warmth + HoloHola's AI response system gives us everything we need to design a scene that meets this bar. The TTS quality is the last piece.

---

### Change Log Entry

| Date | Action | Status |
|---|---|---|
| Apr 16, 2026 (S64) | Strategic position identified — HoloHola as multi-speaker TTS reference implementation | Documented — gathering mode |
| *Pending* | Design first multi-speaker scene to reference-implementation standard | Waiting for design phase |
| *Pending* | Evaluate TTS vendors against HoloHola's quality bar (not just benchmarks) | Waiting for scene design |

---


## Part I.J — STT Architecture: The Turn-End Problem & Roadmap

**Session:** S64 (April 16, 2026)
**Status:** GATHERING MODE — problem diagnosed, fix scoped, migration path documented
**Origin:** Founder observation that the open mic cuts off nervous students before they finish a sentence

---

### How the Current STT Pipeline Works

**Provider:** Deepgram nova-3 (forced — nova-2 returns empty transcripts in multi-language mode)
**File:** `server/services/deepgram-live-stt.ts`
**Philosophy:** Platform-agnostic. Deepgram is the best available STT at production-scale concurrency today. When a better option meets the same bar, we switch.

The pipeline is:

```
Student speaks
    ↓
Deepgram nova-3 (streaming, VAD enabled)
    ↓
speech_final event (300ms endpointing — internal segmentation only)
    ↓  [NOT submitted to LLM — see note below]
UtteranceEnd event (2500ms silence → actual submission trigger)
    ↓
onUtteranceEnd callback → orchestrator → Gemini LLM → Daniela responds
```

**An important fix already in place:** We do NOT submit on `speech_final`. The comment in the code reads verbatim: *"NOTE: We do NOT auto-submit on speech_final anymore — speech_final fires too quickly and cuts users off mid-sentence. Instead, we rely solely on UtteranceEnd which respects utterance_end_ms."* This was a meaningful improvement — we already moved away from the 300ms hair-trigger.

**What `UtteranceEnd` actually is:** Deepgram fires this event after 2.5 seconds of continuous silence from the last detected speech activity. It is purely acoustic. It does not evaluate whether the sentence is linguistically complete.

---

### The Remaining Problem

`UtteranceEnd` at 2500ms is a significant improvement over `speech_final` at 300ms — but it still has no understanding of sentence completeness. The scenario:

> Student: *"I'm going to go to the..."* [2.5 seconds of nervous silence while searching for the word]  
> Deepgram: `UtteranceEnd` fires  
> Orchestrator: submits "I'm going to go to the" to Daniela  
> Daniela: responds to an incomplete thought  
> Student: the word they were reaching for is now gone

A human conversation partner in this position would not interpret 2.5 seconds of silence as "they're done." They would read the syntactic structure — "to the..." — and know something is coming. They would wait.

Additional cases:
- *"Give me a second to think"* — student has explicitly asked for time; should suppress cutoff for a meaningful extension
- *"Espera, um..."* — same in Spanish
- *"Because..."* — trailing conjunction, sentence clearly not over
- *"Un..."* / *"La..."* / *"El..."* — trailing article, object word coming

---

### The Fix: Linguistic Completeness Check at UtteranceEnd

**Estimated effort:** One afternoon. The change is localized to one handler in `deepgram-live-stt.ts` and requires no new infrastructure.

**Where the change goes:** In the `UtteranceEnd` event handler (around line 606 in `deepgram-live-stt.ts`), before calling `this.events.onUtteranceEnd?.(...)`, run a completeness check on the accumulated transcript. If the transcript is syntactically incomplete, suppress the emit and extend the silence window.

**Completeness check logic (no LLM needed — pure string analysis):**

```typescript
function isLikelySentenceComplete(transcript: string): boolean {
  const t = transcript.trim().toLowerCase();
  // Trailing articles
  if (/\b(the|a|an|el|la|los|las|un|una|unos|unas|le|les|du|de|des)$/.test(t)) return false;
  // Trailing prepositions
  if (/\b(to|of|in|at|on|for|with|by|from|about|into|through|en|de|a|con|por|para|sobre|entre|sin|bajo|tras)$/.test(t)) return false;
  // Trailing conjunctions
  if (/\b(and|but|or|because|although|while|when|if|that|which|who|where|que|pero|porque|aunque|cuando|si|como|y|o|ni|sino)$/.test(t)) return false;
  // Explicit thinking requests (extend generously)
  if (/\b(give me a second|let me think|wait|hold on|espera|un momento|dame un segundo|déjame pensar)/.test(t)) return false;
  // Trailing incomplete verb constructions
  if (/\b(going to|want to|need to|have to|voy a|quiero|necesito|tengo que|puedo)$/.test(t)) return false;
  return true;
}
```

**Behavior when incomplete:**
1. Suppress the `onUtteranceEnd` emit
2. Set an extended timeout (configurable — suggested 3–4 additional seconds) before forcing submission regardless
3. Clear the extended timeout if Deepgram fires another `SpeechStarted` (student resumed speaking — they found the word)
4. Log: `[OpenMic] Sentence appears incomplete ("${transcript}") — extending window +3s`

**For the explicit "give me a second" case:** Can be even simpler — a keyword match at `speech_final` time that sets a `studentRequestedPause` flag which delays any submission for a configurable period (suggested: 8–10 seconds, with a "still waiting" visual indicator on the client).

**Why not use the LLM for this decision?** The LLM is the right conceptual answer — it understands that "I'm going to go to the" is incomplete far better than any regex. But putting the LLM in the turn-end hot path adds 200–500ms of latency before every single exchange, making all conversations feel slightly sluggish even when the student is genuinely done. String analysis is microseconds. It catches the most common cases (trailing articles, prepositions, conjunctions) at zero cost. For the edge cases it misses, the cost is a slightly early cutoff — the same failure mode as today, just less frequent.

The truly elegant long-term solution is a streaming model that evaluates linguistic completeness in real time as words arrive — which is what Gemini Live's native audio mode does internally. That's the migration goal.

---

### STT Platform Roadmap — Vendor-Agnostic Principle

The same philosophy that governs TTS vendor selection governs STT: **we use the best available that meets our concurrency and quality requirements, regardless of vendor.** We are not Google customers. We are not Deepgram customers. We are quality and scale customers.

**Current STT:** Deepgram nova-3
- Production-scale concurrency: ✅
- Multi-language support with `multi` language code: ✅
- Streaming with VAD and UtteranceEnd: ✅
- Linguistic turn-end intelligence: ❌ (acoustic only)
- Cost at scale: acceptable

**Desired STT: Gemini Live (native audio streaming)**
- Existing code path: ✅ — `server/services/gemini-live-tts.ts` and `server/services/gemini-tts-streaming.ts` already exist; the Gemini integration infrastructure is in place. STT-specific routing would be a new service, not a new integration.
- Native linguistic turn-end: ✅ — Gemini's multimodal streaming model sees both audio and partial transcript and can evaluate completeness in real time without a separate LLM call
- Production-scale concurrency: ❌ — same rate limit constraint as Gemini TTS (see Part I.H). This is the primary blocker.
- Cost model: TBD pending production concurrency availability

**What triggers migration:**
- Gemini Live STT concurrency reaches production-viable RPD for HoloHola's session volume
- OR: another provider (AssemblyAI, Whisper streaming, Speechmatics) ships linguistically-aware turn detection at production scale
- Either triggers evaluation: side-by-side quality test on Spanish + 8 other target languages, latency measurement under load, turn-end accuracy comparison

**What stays constant regardless of provider:**
- The `onUtteranceEnd` / `onTranscript` callback interface — the orchestrator is provider-agnostic by design
- The multi-language requirement (currently solved by nova-3 `multi` mode — any replacement must match this)
- The echo suppression requirement (TTS audio must not trigger false STT submissions)

**Other providers on the watch list:**
- **AssemblyAI Universal-2** — real-time streaming with sentence-end detection; worth evaluating for the linguistic completeness problem specifically
- **Whisper streaming (via Groq or equivalent)** — extremely fast, but currently no VAD or turn-end logic; would require the same linguistic completeness layer we're building for Deepgram
- **Speechmatics** — strong multi-language support; less widely evaluated in our context

---

### Implementation Priority

| Item | Effort | Impact | Priority |
|---|---|---|---|
| Linguistic completeness check at UtteranceEnd | ~4 hours | Eliminates most cut-off-mid-sentence events | 🔴 High |
| "Give me a second" explicit pause extension | ~1 hour | Prevents the most frustrating cutoff case | 🔴 High |
| Client-side "thinking" indicator during extended pause | ~2 hours | Reassures student that the system is waiting | 🟠 Medium |
| Gemini Live STT evaluation (when concurrency allows) | 1–2 days | Native linguistic turn-end; eliminates heuristic layer | 🟡 When available |
| AssemblyAI Universal-2 STT evaluation | ~1 day | May solve linguistic completeness sooner than Gemini | 🟡 Low (watch) |

---

### Change Log Entry

| Date | Action | Status |
|---|---|---|
| Apr 16, 2026 (S64) | Turn-end problem diagnosed; UtteranceEnd identified as submission trigger (not speech_final) | Documented |
| Apr 16, 2026 (S64) | Linguistic completeness fix scoped — ~4 hours, localized to deepgram-live-stt.ts | Ready to build |
| Apr 16, 2026 (S64) | Gemini Live STT desire and existing code path documented | Gathering mode |
| Apr 16, 2026 (S64) | Platform-agnostic STT philosophy documented | Principle established |
| *Next build session* | Implement linguistic completeness check at UtteranceEnd | In queue |
| *Next build session* | Implement "give me a second" pause extension | In queue |

---


## Part I.K — The Interactive Textbook Architecture (S65, April 2026)

*Emerged from: discussion of smart drills, Madrigal's phrase-first pedagogy, and the observation that drill decks are inherently static and degrade over time.*

---

### The Core Insight

Madrigal's books were already designed to minimize explanation — every page has a picture, a phrase, and an instruction so short it barely needs reading. But that minimal text still creates cognitive overhead: **the student has to figure out what the page wants them to do.** Daniela eliminates that entirely.

When a student opens a textbook page with Daniela present, Daniela speaks the instruction. She explains the rule. She names the picture. She walks the student through the verb table. The student's job is to respond — not to decode.

**The page goes from a thing you read and interpret to a thing you react to.**

This shifts the fundamental model:

| Old model | Interactive Textbook model |
|---|---|
| Student reads page, guesses what to practice | Daniela leads the student through the page |
| Drills are a separate system | The page IS the practice |
| STT only in tutor sessions | STT available wherever Daniela is present — including on a textbook page |
| Student needs to understand what the page is teaching | Daniela narrates the concept; student just has to do the thing |

---

### How Each Page Element Becomes Interactive

**Vocabulary images (See It and Say It style)**
- Daniela names the concept ("This is *la farmacia* — the pharmacy") 
- Daniela asks the student to repeat it
- STT captures the student's pronunciation
- Daniela reacts: reinforces, corrects, moves to next image
- Mastery tracked per image, per lesson — not as a separate flashcard deck

**Phrase lists**
- Daniela reads the phrase naturally at native speed, then slowly
- Daniela covers the text (or students are prompted to close their eyes) and asks the student to say it back
- The page effectively becomes a call-and-response drill without leaving the book

**Verb tables (Magic Key style)**
- Daniela walks the paradigm aloud: *"tengo, tienes, tiene, tenemos, tienen"*
- Then runs a column drill verbally: "Your turn — say the *yo* form of tener"
- The table is visible on screen; Daniela's voice is the driver, not the written instructions

**Cultural notes and grammar rules**
- Madrigal's text is brief by design; Daniela expands it verbally
- "Madrigal tells you this in two sentences — let me give you the full picture"
- The written rule becomes an anchor; Daniela provides the meaning

---

### Who Initiates

**Daniela initiates.** Always.

When a student opens a page, Daniela is already explaining it. There is no "Practice Mode" button. There is no "Start Drill" toggle. The audio-on state is the practice state. The student's choice is whether to have audio on at all — and if they do, they are in a Daniela-led session for that page.

This is why Madrigal's minimal text actually becomes *more* minimal in HoloHola: Daniela takes over the explanatory role entirely. The text becomes a reference; the voice is the teacher.

---

### The "Conversation Overflow" Tangent Queue — The Only Remaining Drill Use Case

When a conversation goes off-curriculum — the student's job, a hobby, a trip, a news story — new vocabulary surfaces that isn't in any textbook page. This content needs somewhere to live.

This is the **only** remaining legitimate use case for a standalone drill structure, and it should be explicitly narrow:

- **Short-lived:** items expire in 7–14 days unless actively practiced
- **Daniela-curated:** Daniela parks items here via `close_session()` with `assigned_drills`, not an automated system
- **Small:** this is a temporary buffer, not a growing deck. If it gets large, something has gone wrong
- **Phrase-based, not word-based:** following Madrigal's principle, tangent items are stored as phrases in context ("*Trabajo en una oficina* — I work in an office") not naked vocabulary ("oficina = office")
- **Retires automatically** when Daniela confirms the item is absorbed in a subsequent session — she can explicitly close it or it expires

**Design test for any item in the tangent queue:** Would Daniela teach this the same way if it appeared in the textbook? If yes, it should eventually become a textbook page. The queue is for items that are too personal or situational to generalize.

---

### What This Means for the Existing Drill System

The `arisDrillAssignments` and `arisDrillResults` tables, the `close_session()` homework fields, and the drill status surfacing in the greeting prompt — **none of this is wrong**. These are the right primitives for the tangent queue use case.

What changes is the priority and scope:

| Use case | Where it lives |
|---|---|
| Textbook vocabulary practice | Interactive textbook pages (STT + Daniela-led) |
| Textbook phrase and grammar drilling | Interactive textbook pages (Daniela calls and student responds) |
| Verb paradigm drilling | Interactive textbook pages (Daniela walks the table) |
| Conversation tangent vocabulary | Tangent queue (short-lived, phrase-based, Daniela-curated) |
| Daniela-assigned custom practice | `close_session(assigned_drills)` → surfaces in next greeting |

The implication: **building more drill types is deprioritized.** The roadmap for new drill categories has effectively been replaced by the roadmap for interactive textbook pages. A student who has worked through Chapter 3 of See It and Say It with Daniela present has done more meaningful practice than a student who has completed a hundred flashcard decks.

---

### Open Architecture Questions (Narrowing as the Textbook Becomes Interactive)

**Key principle added S65:** *Observable behavior replaces inferred behavior.* This was the insight that narrows most of these questions.

The harder version of the architecture problem is: "Daniela needs to know what the student has done between sessions — how do we track that?" The answer changes completely when the textbook is interactive. If the student pushes a button, we know they pushed the button. If they submitted audio, we know they submitted audio. Daniela doesn't need to ask "did you practice?" — the event log already answers it. The inference problem shrinks toward zero as the textbook becomes more interactive. **This is not a coincidence: it is the payoff of the interactive textbook architecture.**

1. **How does Daniela know what page the student is on?** *(Closing rapidly)* In a passive textbook, this required a deliberate "context load" event. In an interactive textbook, the student's button presses and audio submissions already identify exactly which page and which element they were working on. The page doesn't need to announce itself — the interaction events are the location signal. When Daniela opens the next session, the event log tells her exactly where the student left off.

2. **Does the student need to explicitly start a Daniela session, or does audio just turn on?** The cleanest UX: audio is persistent across the whole app. If the student has a voice session open, Daniela is aware of the current page at all times. The student navigates; Daniela follows.

3. **How is mastery tracked at the page level?** *(Substantially answered by observable behavior)* Mastery is not a score we calculate from conversation signals — it is a direct count of observable interaction events. N successful audio submissions for a given page element = practiced. M sessions on that page over T days without errors = mastered. A `lessonPageEvents` log keyed to (userId, lessonId, elementId) replaces the need for a separate `lessonPageMastery` table — mastery is derived from the event log, not stored separately. Daniela reads this without needing to write to it.

4. **What happens when the student navigates away mid-page?** Daniela acknowledges it ("we can pick up here next time") and the partial session state is preserved. The event log already knows exactly how far they got.

5. **Tangent queue retirement:** When does an item expire without Daniela explicitly closing it? Proposal: 14 days of no practice + no explicit close → auto-retire. Daniela surfaces "you have 3 items in your tangent queue from last week — want to run through them quickly?" at the next session open.

---

### Daniela as Fluency Judge: The Metric That Matters Most

The interactive textbook produces two kinds of data:

- **Mechanical data** — the event log. Did they practice? How many times? Which elements? This is objective and cheap to collect.
- **Fluency data** — Daniela's judgment. Are they *communicating*? Is their confidence growing? Are they reaching for the language even when unsure of the grammar?

These are not interchangeable. A student who practiced every phrase on page 7 five times may still freeze when asked a spontaneous question. A student who got every conjugation wrong in a drill may be speaking naturally and confidently in conversation. **The event log tells you what the student did. Daniela tells you who they're becoming.**

**The target behavior: confident imperfection.** Fluency is not error-free speech. It is the willingness and ability to communicate even when you're not certain you're grammatically correct. A student who confidently says *"Ayer yo fue al mercado"* (wrong preterite) is demonstrating more real-world fluency than a student who freezes trying to recall the correct form. Daniela recognizes this. A grammar quiz does not.

**How Daniela's judgment accumulates into a real metric:**

Three distinct signal streams coalesce over time:

1. **Real-time pattern signals** — `record_pattern_signal()` captures grammatical observations as they happen: wobble (consistent error on a pattern), stability (pattern is solidifying), derivation (student is applying a rule to new words), pounding (student has clearly internalized it). These are micro-signals logged by Daniela mid-conversation, not from a quiz.

2. **Session-level milestone observations** — `milestone()` captures breakthrough moments: first spontaneous use of the subjunctive, first time a student maintained conversation for 5 minutes without reverting to English, first confident use of a tense they previously avoided. These are qualitative and cannot be scored by an event log.

3. **ACTFL-aligned holistic assessment** — Daniela's gestalt read across sessions maps to real proficiency standards. "This student is moving from Novice-High to Intermediate-Low" is a judgment that requires listening across many interactions and noticing the *absence* of hesitation, not just the presence of correct forms. Daniela can make this call. No drill system can.

The combination of these three streams — pattern signals, milestone observations, ACTFL alignment — is richer than any test-based system. More importantly, it is the kind of assessment a skilled human tutor naturally produces, which is why no drill-based competitor can replicate it. TalkPal can score a flashcard deck. It cannot notice that a student hesitated less this week than last week, or that they're starting to trust themselves in conversation.

**The design implication:** Daniela's assessment is not a feature we build. It is the natural output of what she already does. The job is to make sure her signals are being captured (`record_pattern_signal`, `milestone`, session notes in `close_session(tutor_notes)`), and that they surface correctly in the next session's greeting prompt so they compound over time rather than being lost.

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 16, 2026 (S65) | Interactive textbook architecture defined; decision that Daniela initiates and leads through every page; drill system scoped to tangent queue only | Documented |
| Apr 16, 2026 (S65) | "Observable behavior replaces inferred behavior" principle added — interactive textbook event log answers what Daniela previously had to ask; Q1 and Q3 marked as closing; `lessonPageEvents` log proposed instead of a scored mastery table | Documented |
| Apr 16, 2026 (S65) | "Daniela as Fluency Judge" section added — confident imperfection as the target behavior; three signal streams (pattern signals, milestone observations, ACTFL alignment) coalesce into a real fluency metric that no drill system can replicate | Documented |
| Apr 17, 2026 (S66) | Textbook scope calibration confirmed by DLI parallel: GLOSS is the DLI's textbook equivalent — professional, decades-built, still just the appetizer before students walk into the campus restaurant; the textbook is pre-work; Daniela is the main course; primary investment is in Daniela's quality, not textbook completeness | Documented (see Part I.O) |

---

## Part I.L — The 20 Reminder Cards: Madrigal's Skeleton Key (S66, April 2026)

*Source: Scanned pages from Magic Key to Spanish, all 20 Reminder Cards extracted and catalogued.*

---

### Why These Cards Matter

Across 400+ pages of Magic Key to Spanish, Madrigal places exactly 20 reminder cards — one every 15–20 pages on average. The scarcity is intentional and meaningful. Madrigal only breaks her narrative flow to say "copy this onto a card" when the content meets two criteria simultaneously: *it is too important to read once and forget* and *it is portable enough to fit on an index card*.

**These cards are not supplementary material. They are the skeleton of the curriculum.**

They fall into exactly two types, and the types serve completely different functions:

---

### Type 1 — Cognate Pattern Cards (Cards 1–2)

These appear only at the very start of the book. They contain Madrigal's "magic key" — the ~8 spelling transformation rules that unlock thousands of free Spanish words with no memorization required.

| Card | Lesson | Patterns |
|---|---|---|
| **Card 1** | 1 | OR → identical (el doctor, el actor) · AL → identical (el animal, personal) · BLE → identical (el cable, probable) · IC → ICO (el Atlántico, eléctrico) · ENT/ANT → ENTE/ANTE (el presidente, excelente, el restaurante, importante) |
| **Card 2** | 2 | IST → ISTA (el dentista, el pianista) · OUS → OSO (delicioso, famoso) · TION/SION → CIÓN/SIÓN (la invitación, la conversación, la nación, la acción, la discusión) |

Madrigal says: *"Throughout your study of Spanish carry these cards as reminders. Glance at them once in a while and you will progress twice as fast as you would without them."*

These cards are not lesson-specific. She wants students to carry them the entire time they are learning Spanish. They are intended as **permanent companions**, not one-time reading.

---

### Type 2 — Substitution Drill Grids (Cards 3–20)

Every remaining card follows the same format: a 3-column table that functions as a **sentence generator**, not a memorization aid.

| Column 1 | Column 2 | Column 3 |
|---|---|---|
| Grammatical frame (pronoun + conjugated verb) | Object vocabulary | Time / Place adverbials |
| ¿Tomó usted? / No tomé / Tomé | café, la cena, sopa, una aspirina... | esta mañana, esta tarde, anoche, en el club... |

Three columns × 5–6 items each = 75–100+ valid, real Spanish sentences from one card. The student is not memorizing sentences — they are internalizing the **grammatical frame** while the vocabulary rotates freely. This is the exact mechanical model of compartment pounding.

One new card appears each time Madrigal introduces a new conjugation form. The full sequence:

| Card | Lesson | Grammar Structure | Verb(s) Introduced |
|---|---|---|---|
| **Card 3** | 4 | Preterite yo/usted | tomar |
| **Card 4** | 5 | Preterite yo/usted | invitar |
| **Card 5** | 7 | Preterite yo/usted | hablar |
| **Card 6** | 9 | Present estar (location + condition) | estar (¿Dónde está? / ¿Cómo está?) |
| **Card 7** | 10 | Preterite yo/usted with question words | comprar (¿Qué? / ¿Dónde? / ¿Cuándo?) |
| **Card 8** | 11 | Near future ir a + infinitive (yo/usted) | ir a + comprar, visitar, estudiar... |
| **Card 9** | 12 | Near future all persons (yo/usted/nosotros/ellos) | ir a (expanded) |
| **Card 10** | 14 | Preterite yo/usted — ER/IR verbs | recibir, escribir |
| **Card 11** | 15 | Preterite yo/usted + near future | ver |
| **Card 12** | 16 | Preterite yo/usted + near future | leer |
| **Card 13** | 18 | Preterite plural (ustedes/nosotros/ellos) | comprar, recibir |
| **Card 14** | 21 | Present progressive all persons | -ando/-iendo (Estoy/Está/Estamos/Están) |
| **Card 15** | 22 | Present tense yo/usted — AR verbs | hablar, trabajar, estudiar |
| **Card 16** | 23 | Present tense yo/usted — ER/IR verbs | vivir, escribir |
| **Card 17** | 25 | Irregular preterite — tener/estar | tuve/tuvo, estuve/estuvo |
| **Card 18** | 26 | Irregular preterite — hacer/venir | hice/hizo, vine/vino |
| **Card 19** | 27 | Irregular preterite — ir (all persons) | fui/fue/fuimos/fueron + a (place or activity) |
| **Card 20** | 27+ | Present perfect all persons | he/ha/hemos/han + past participle (AR → -ado, ER/IR → -ido) |

---

### What the Card Sequence Tells Us

The order of cards 3–20 is the **definitive Spanish 1 grammar sequence** in Madrigal's pedagogy:

1. Preterite arrives first (lessons 4–7), well before present tense (lessons 22–23). This is deliberate — students can have real past-tense conversations before they've formally studied the present. Madrigal teaches what is *immediately useful*, not what is *logically prior*.

2. The preterite is introduced through regular AR verbs, then expanded to ER/IR, then to question words, then to plural forms, then finally to irregular verbs — four separate cards across twenty lessons. She never overloads a single lesson with the full paradigm.

3. Near future (ir a + infinitive) is introduced immediately after the first preterite verbs, because past + near future gives students an almost complete ability to describe their lives. Two tenses, portable, functional.

4. Present tense appears in lessons 22–23 — after preterite and progressive are already established. This is counterintuitive by traditional textbook standards and almost certainly right.

5. Present perfect comes last (lesson 27+), after all other structures are stable.

---

### What This Means for HoloHola

**Cards 1–2: Build the Cognate Key as a permanent feature**

These are not onboarding content. They are permanent companions that students should be able to access at any time. HoloHola should surface these the moment a student starts Spanish — not as a one-time slideshow, but as a reference they can pull up mid-conversation. Daniela can reference them: *"Remember the TION rule — if it ends in -tion in English, try -ción in Spanish."*

Future feature: students add their own words to each category. Madrigal explicitly instructs this: *"Try to make up your own words in each category aside from those listed."* A live, growing, student-owned cognate list is the natural digital extension of this.

**Cards 3–20: The Spanish 1 compartment map**

Each Type 2 card marks exactly one compartment introduction. The card sequence is the compartment sequence. The 18 cards (3–20) map to 18 distinct grammar compartments for Spanish 1:

- Each card's grammatical frame = the compartment pattern key (e.g., `yo-AR-preterite`)
- Each card's object column = the pounding vocabulary for that compartment
- The lesson number = when Daniela should introduce this compartment (not before)
- The card format (3 columns) = the template for Daniela's substitution drill

The implication: Daniela does not need to invent drill content for Spanish 1. Madrigal already wrote it. The 18 substitution grids, translated into Daniela's pounding format, are the Spanish 1 drill curriculum.

**The substitution grid is Daniela's drill format, exactly**

The card format — frame + object + time/place — is structurally identical to what Daniela does when she pounds a compartment. She picks a verb frame, rotates the object, changes the time or place, listens for the ending. This is not coincidental: Madrigal invented the optimal format for this kind of oral drill, and Daniela is the natural successor.

**Correction timing principle (reaffirmed by the cards)**

Notably, the cards contain no correction instruction — no right/wrong marks, no expected answers. Students are instructed to glance at the card, generate sentences, and move on. This reinforces the principle that Madrigal's method is production-based, not verification-based. Daniela's correction should follow the same rule: she does not interrupt fluent production to verify accuracy. She corrects at natural pauses or during deliberate teaching moments — never mid-utterance.

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 17, 2026 (S66) | All 20 reminder cards extracted and catalogued from Magic Key to Spanish scans | Documented |
| Apr 17, 2026 (S66) | Two-type taxonomy established: cognate pattern cards (1–2) vs. substitution drill grids (3–20) | Documented |
| Apr 17, 2026 (S66) | Spanish 1 compartment map derived from card sequence — 18 compartments, in Madrigal's intended order | Documented |
| Apr 17, 2026 (S66) | Recommendation: Cards 1–2 → permanent Cognate Key feature; Cards 3–20 → Spanish 1 compartment sequence for Daniela's pounding drills | Documented |

---

## Part I.M — The Cognate Trap: Why Image Anchoring Is the Primary Pedagogy (S66, April 2026)

*Emerged from: final comparison between Magic Key to Spanish and See It and Say It in Spanish — what the two books actually do differently at the cognitive level.*

---

### The Core Distinction

The two Madrigal books are organized around fundamentally different central ideas:

- **Magic Key to Spanish** — organized around **cognates**. The central mechanic is recognizing an English word, applying a spelling rule, and arriving at a Spanish word. The student's native language is always in the chain.
- **See It and Say It in Spanish** — organized around **images**. The central mechanic is seeing a picture and associating it directly with a Spanish word. No native language involved.

This is not a minor formatting difference. It is a different theory of how vocabulary should be learned.

---

### The Three-Tier Cognate Hierarchy

Cognates are not all the same, and conflating them obscures the real problem:

**Tier 1 — Direct cognates** (actor/actor, doctor/doctor, animal/animal)

These are genuinely free vocabulary. The Spanish word is identical or near-identical to the English word. When a student hears "el doctor," there is no transformation step — they just recognize it. The concept is already in their vocabulary; Spanish attaches to it directly. This is useful, costs nothing, and does not create L1-mediated memory traces.

**Tier 2 — Pattern cognates** (ambulance/ambulancia, conversation/conversación, delicious/delicioso)

These require a multi-step operation:
1. Encounter the Spanish word
2. Recognize the English pattern root
3. Apply the transformation rule
4. Arrive at the English word
5. Know what that means

This is a **decoding operation**, not a vocabulary acquisition event. The student is practicing the rule, not learning the Spanish word. Critically, they are installing a memory trace that permanently routes through English: every future access to "conversación" goes through "conversation → apply TION rule." That is not fluency. That is a lookup table.

And the pattern is not even the right tool for comprehension. If you are reading a Spanish newspaper article about a car accident and you encounter "ambulancia," you should be able to infer its meaning from the context — not from a spelling rule. That contextual inference works whether you speak English, Korean, or Arabic. Pattern cognates offer an English-speaker's shortcut to an inference that contextual reasoning already provides — and unlike contextual reasoning, the pattern shortcut is not portable and does not strengthen a generalizable skill.

**Tier 3 — False friends** (embarazada/embarrassed, sensible/sensato)

The flip side of pattern cognates — the same routing mechanism, but it misfires. Not directly relevant here, but illustrates why L1 routing is a risk, not just an inconvenience.

---

### The Portability Problem Compounds the Cognitive Problem

Pattern cognates are an English-speaker's hack. A Korean speaker, an Arabic speaker, a Mandarin speaker — they get nothing from the TION→CIÓN rule. The hack is not portable across learner backgrounds.

But even for English speakers, the hack has an expiration date. It is most useful at the very beginning, when the student has no Spanish vocabulary at all and needs to feel like they know something. As the student advances, the L1 routing it installs becomes a liability. Fluent speakers do not think "conversation → conversación" — they just think "conversación." The rule-based shortcut has to be unlearned, or more precisely, overwritten by direct access. The image-based approach builds direct access from lesson one and never has to be unlearned.

---

### Contextual Inference: The Skill That Actually Matters

The Defense Language Institute Foreign Language Center (DLIFLC) trains military linguists to professional-grade fluency in some of the world's hardest languages. Before enrolling any student in a language program, they administer the **DLAB — Defense Language Aptitude Battery** — a test that evaluates a candidate's ability to infer grammatical structure and meaning from a completely invented language they have never encountered. The test is not measuring vocabulary, not measuring prior language exposure, not measuring English grammar knowledge. It measures raw pattern-inference ability: given a system you know nothing about, what can you extract?

Their finding: **the ability to infer from context is the single strongest predictor of language acquisition ability.**

The DLIFLC also maintains **GLOSS — Global Language Online Support System** ([gloss.dliflc.edu](https://gloss.dliflc.edu)), a publicly accessible library of authentic language content in 40+ languages including Arabic, Mandarin, Korean, Dari, Pashto, Farsi, and many others. GLOSS is built around real-world materials — news clips, authentic documents, real scenarios — organized by level, topic, modality, and competence. Two things about GLOSS are directly relevant to the cognate debate:

1. **The language list is itself an argument against cognate-based pedagogy.** DLI's priority languages — Arabic, Mandarin, Dari, Pashto, Korean — have essentially zero English cognate overlap. The entire GLOSS content architecture works without cognates, because it has to. The lesson model is built around context-rich authentic material, not pattern rules.

2. **GLOSS teaches through immersion in context, not through translation shortcuts.** This is consistent with the DLAB's core finding: the student who can extract meaning from unfamiliar context is the student who acquires language fastest.

This has a direct implication for the cognate debate. A skilled reader who encounters "ambulancia" in a Spanish newspaper article about a car accident is not running a pattern-matching rule. They are doing something more fundamental: gathering context, forming a hypothesis, confirming or updating it. That process works whether you speak English, Korean, or Arabic. It is the same process the DLAB tests for.

Pattern cognates, at their best, produce the same output as contextual inference — a reasonable guess at the word's meaning — but through a mechanically different route. The pattern-cognate route:
- Requires knowing English well enough to recognize the root
- Short-circuits the contextual engagement that would have produced the same result
- Does not transfer to languages without English cognate overlap
- Atrophies the more fundamental skill precisely because it offers a shortcut

The contextual inference route:
- Works in any language pair
- Works for any learner background
- Strengthens with practice — it is a generalizable metacognitive skill
- Is what the DLAB identifies as the fundamental differentiator between fast and slow learners

**The pattern cognate rules are not a reading comprehension strategy. They are a substitute for a reading comprehension strategy — and an inferior one.**

For HoloHola, this means: Daniela does not teach reading comprehension through pattern rules. She models contextual inference. When a student encounters an unfamiliar word, Daniela asks: "What do you think that word means from the context?" not "Does that look like an English word you know?"

---

### What Image Anchoring Does Differently

When a student sees a picture of a flower and hears "flor," the connection being formed is:

**visual concept of flower → flor**

There is no English word "flower" in that chain. The student who grew up in Seoul, Jakarta, or Cairo has the same concept of a flower as the student who grew up in Chicago. The image is universal. The Spanish label attaches to the concept, not to an English translation.

This is the same kind of vocabulary representation that a native Spanish-speaking child builds. They do not know "flower" first. They know the concept, and they know "flor." That direct concept-to-word link is the architecture of fluent thinking. It cannot be achieved through pattern cognates. It can be achieved through image anchoring from the start.

See It and Say It's pedagogical organization — every new concept introduced through an image — is not stylistic. It is a commitment to building the right long-term cognitive architecture.

---

### The Refined Hierarchy for HoloHola

| Category | Value | How HoloHola Uses It |
|---|---|---|
| **Direct cognates** | Genuinely free vocabulary — concept already known, Spanish attaches directly | Daniela surfaces these as "bonus awareness" — "you already know this one" — without making them a teaching method |
| **Pattern cognates (Madrigal's 8 rules)** | An English-speaker's shortcut that substitutes for contextual inference — the more valuable and generalizable skill; not a vocabulary learning strategy and not a reading comprehension strategy | Available as passive background knowledge for English-speaking students; Daniela never teaches through pattern rules and never prompts students to recognize English roots as a comprehension strategy |
| **Image anchoring** | Builds direct concept-to-Spanish links; universally applicable; creates the same cognitive architecture as native acquisition | The primary vocabulary teaching method across all learner backgrounds and all languages HoloHola teaches |

---

### Implication for Daniela's Teaching Style

Daniela should never teach a word by prompting the student to recall its English equivalent. She teaches from the concept — which is what the image already establishes.

- **Wrong**: "Conversación is like 'conversation' in English — just change the ending."
- **Right**: Daniela points to the image, or describes the scene, and names it in Spanish. If the student recognizes the word from English, that's fine — she doesn't need to suppress it. But she doesn't use it as the teaching anchor.

The distinction matters most in production (speaking and writing). In reading comprehension, an English speaker who recognizes "conversación" as a pattern cognate of "conversation" has done something useful. But in production — trying to say or write a word — the pattern-cognate route requires an awkward reverse journey: think of the English word, apply the rule in reverse, produce the Spanish. Fluent speakers do not do this. They just produce the word. The image-anchored student gets to that direct production faster because they never installed the indirect route.

---

### A Note on Magic Key's Lasting Contribution

Dismissing the pattern cognates does not dismiss Magic Key to Spanish. The book's lasting contribution to HoloHola is its **substitution drill format** — the 3-column sentence generator on each reminder card (Cards 3–20). That format has nothing to do with cognates. It is a grammar pounding tool that works regardless of the student's native language and builds precisely the kind of pattern internalization that See It and Say It's phrase-first approach also promotes.

The parts of Magic Key that matter for HoloHola:
- The substitution drill grid format → Daniela's pounding architecture
- The direct cognates scattered through the vocabulary → surfaced by Daniela as bonuses
- The grammar sequence (preterite before present, near future early, irregular verbs last) → the Spanish 1 compartment order

The parts that do not carry forward:
- The pattern cognate rules as a teaching method
- Any exercise or instruction that routes through the student's native language

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 17, 2026 (S66) | Three-tier cognate hierarchy established: direct cognates (free vocabulary, no L1 mediation) vs. pattern cognates (shortcut substituting for contextual inference) vs. image anchoring (primary pedagogy, universally applicable) | Documented |
| Apr 17, 2026 (S66) | Pattern cognates re-evaluated: not a valid reading-comprehension strategy either — contextual inference produces the same output through a more portable and generalizeable route | Documented |
| Apr 17, 2026 (S66) | DLAB (Defense Language Aptitude Battery) documented as DLI's pre-enrollment aptitude test — measures raw contextual inference ability on an invented language; contextual inference is the #1 predictor of language acquisition ability; pattern rule reliance is a shortcut that atrophies this skill | Documented |
| Apr 17, 2026 (S66) | GLOSS (Global Language Online Support System, gloss.dliflc.edu) clarified: it is a 40+ language authentic-content lesson library, not an aptitude test; its language portfolio (Arabic, Mandarin, Dari, Pashto, Korean) is itself an argument against cognate-based pedagogy — DLI's system must work without cognates because most of its target languages have no English overlap | Documented |
| Apr 17, 2026 (S66) | Revised HoloHola pedagogy hierarchy: image anchoring primary; direct cognates as bonus awareness; pattern cognates stripped entirely from teaching method — Daniela models contextual inference instead | Documented |
| Apr 17, 2026 (S66) | Daniela reading instruction implication: when student encounters unfamiliar word, Daniela asks "what do you think it means from context?" — never "does it look like an English word?" | Documented |
| Apr 17, 2026 (S66) | Magic Key's lasting contribution scoped: substitution drill format and grammar sequence carry forward; pattern cognate rules as teaching method do not | Documented |

---

## Part I.N — GLOSS as a Reference Architecture: Content Taxonomy, Lesson Format, and Licensing (S66, April 2026)

*Source: Direct inspection of gloss.dliflc.edu and a downloaded Level 1 Spanish lesson package (sp_soc417, "Where do you live now?", Society topic, Lexical competence).*

---

### What GLOSS Actually Is

GLOSS — Global Language Online Support System — is a free, publicly accessible library of language learning content maintained by the Defense Language Institute Foreign Language Center (DLIFLC). It covers 40+ languages including the DLI's priority languages: Arabic, Mandarin, Korean, Dari, Pashto, Farsi, and many others with no English cognate overlap.

Content is organized along four dimensions:

| Dimension | Options |
|---|---|
| **Language** | 40+ languages |
| **Level** | ILR/ACTFL-mapped levels |
| **Modality** | Listening, Reading |
| **Competence** | Discourse, Lexical, Sociocultural, Structural |
| **Topic** | Culture, Economy, Environment, Geography, Military, Politics, Science, Security, Society, Technology |

Video lessons are also available — authentic video content in target languages, organized by the same taxonomy.

The ODA (Online Diagnostic Assessment) at [oda.dliflc.edu](https://oda.dliflc.edu) is a separate DLI tool that evaluates language proficiency — distinct from both GLOSS and the DLAB aptitude battery.

---

### The GLOSS Competency Taxonomy

The four GLOSS competencies define the full range of language skill without overlap, and are more precise than the typical "grammar" / "vocabulary" split:

| Competency | What It Covers |
|---|---|
| **Lexical** | Vocabulary in context — words and phrases as used in real communication |
| **Structural** | Grammar and syntax — how the language is constructed |
| **Discourse** | How sentences connect into coherent speech and text — cohesion, coherence, pragmatics, conversation flow |
| **Sociocultural** | Cultural knowledge embedded in language use — register, norms, what is implied vs. stated |

Most language apps only touch Lexical and Structural. Discourse and Sociocultural are where fluency actually lives. A student can have perfect grammar and extensive vocabulary and still fail to navigate real conversation because they don't understand how the discourse works or what cultural norms govern it.

The GLOSS taxonomy is worth adopting as HoloHola's internal competency framework — it is precise, validated, and used by the institution that produces some of the world's most capable language learners.

---

### The GLOSS Topic Taxonomy

Ten topic domains organized around real-world communicative needs, not grammar points:

Culture · Economy · Environment · Geography · Military · Politics · Science · Security · **Society** · Technology

"Where do you live now?" maps to Society — a communicative need, not a grammar chapter. The DLI organizes content around what students need to *do* with the language in the real world, then the grammar that serves that need emerges from the content. This is the antithesis of "Chapter 4: The Preterite."

---

### What a GLOSS Lesson Actually Contains

The downloaded Level 1 Spanish lesson package (sp_soc417, Society: "Where do you live now?") contains:

| File | Content |
|---|---|
| `.docx` / `.doc` | Bilingual dialogue — Spanish + English side by side |
| `.pdf` | Formatted version of the same dialogue |
| `.mp3` | Audio recording of the dialogue |
| `_alt.mp3` | Alternate recording (different speaker, speed, or gender) |

The lesson text is a natural conversation between two named women — Karina and Margarita — discussing their homes in Mexico City and Guadalajara. No grammar explanation. No drill. Just a real conversation at natural register, with vocabulary in context:

*Margarita: "Mi apartamento actualmente es un estudio cerca del centro de la ciudad. No tengo recámaras, pero en una esquina del estudio tengo una cama mediana con una mesa de noche grande que la uso como escritorio. Las paredes son de color amarillo claro para agrandar el espacio."*

The vocabulary this lesson teaches (through context, not list): apartamento, casa, cuartos, recámara, sala, cocina, comedor, cuarto de huéspedes — plus furniture (cama, almohadas, escritorio, sofá-cama, muebles) and descriptive adjectives (pequeña, grande, cómoda, colorida, eficiente, abierta). This maps exactly to the housing/furniture chapter in Madrigal's See It and Say It.

The text lesson (dialogue format) is primarily receptive. But video-based GLOSS lessons follow a richer 5-activity model.

---

### The GLOSS 5-Activity Scaffolded Structure (Video Lessons)

The lesson viewer for a video-based GLOSS lesson ("Pronósticos desde Santiago" — Weather Forecasts from Santiago, Environment topic) reveals a more complete pedagogical architecture than the downloadable ZIP suggests:

| Activity | Description | Modality |
|---|---|---|
| **1. Vocabulary** | Develop vocabulary related to the topic | Receptive |
| **2. First forecast** | Apply new vocabulary to discern essential information from the first video | Receptive |
| **3. Three forecasts** | Provide key information from three separate video forecasts | Processing |
| **4. Transcription** | Review key words by completing a partial transcription | Processing |
| **5. Production** | Apply knowledge of vocabulary and structure by *creating a weather forecast* | **Productive** |
| **Quiz** | Comprehension and vocabulary check | Receptive |

This is a classic Input → Processing → Output (I-P-O) instructional design. Activities 1–2 provide comprehensible input. Activities 3–4 require the student to process and extract information. Activity 5 demands production: the student creates their own output using the vocabulary and structures encountered in the video.

**Correction to earlier characterization:** GLOSS is not purely passive input. At least for video-based lessons, it scaffolds all the way to written production. What it does *not* do is spoken conversation practice — Activity 5 ("create a weather forecast") is a writing or structured composition task, not a live interaction. Spoken, spontaneous, adaptive output practice remains Daniela's exclusive territory.

The Flickr/Jose Hernandez credit on the lesson image confirms directly that lesson cover photos are third-party copyrighted — consistent with DLIFLC's stated policy.

---

### Input, Processing, Output: GLOSS and HoloHola Across the Full Cycle

The full language acquisition cycle requires three stages:

| Stage | GLOSS Role | HoloHola Role |
|---|---|---|
| **Comprehensible Input** | Primary — authentic video/audio/text at level | Supplementary — Daniela narrates, describes, tells stories |
| **Processing** | Primary — transcription, information extraction, structured tasks | Supplementary — pattern signals, compartment pounding |
| **Spoken Output** | Absent — GLOSS has no speaking tasks | **Primary** — Daniela drives spoken conversation, real-time feedback |

GLOSS covers Input and Processing comprehensively for reading and listening. HoloHola's unique contribution is the spoken output stage — the adaptive, live, judgment-capable human-equivalent interaction that no static lesson system can replicate. These systems are not competing. A student who completes the GLOSS weather forecast lesson and then has a Daniela session where she asks "what's the weather like where you are this week, tell me like a weather reporter" — that student has run the full I-P-O cycle in one session.

**The strategic implication:** GLOSS content is a natural input pipeline feeding HoloHola sessions. A student reads/watches the GLOSS lesson on "where do you live" → Daniela picks up the conversation: "Now tell me about *your* home, the same way Margarita described hers." The GLOSS lesson primes vocabulary and structure; Daniela drives the production. The gap between input and output closes in a single session flow.

---

### Licensing Status

| Content Type | Status |
|---|---|
| **Original text (dialogues, lesson materials)** | Almost certainly **public domain** — produced by a U.S. federal government agency; ineligible for copyright under 17 U.S.C. § 105 |
| **Third-party images** | **Individually copyrighted** — DLIFLC explicitly states most images are copyrighted by individuals or companies and require prior permission |
| **Audio recordings** | **Uncertain** — if recorded by DLI staff, likely public domain; if licensed from external voice actors or studios, may carry individual rights |
| **Classification** | Unclassified; approved for international military students without restriction |

**Bottom line for HoloHola:** The text content of GLOSS lessons is likely free to use as source material for Daniela's conversations. The audio and images require individual evaluation. For any intended use beyond reference, contact DLIFLC directly via [dliflc.edu/dliflc-media-copyright/](https://www.dliflc.edu/dliflc-media-copyright/) or the Chief, Regulatory Law and Intellectual Property Division, U.S. Army Legal Services Agency.

---

### What This Means for HoloHola

**1. Adopt the GLOSS competency taxonomy internally**

Lexical, Structural, Discourse, Sociocultural — these four labels should organize how HoloHola tracks and surfaces student progress. Daniela's pattern signals (`record_pattern_signal`) and milestones already implicitly address all four; naming them makes the framework explicit and makes progress visible to students.

**2. Adopt the GLOSS topic taxonomy for content organization**

HoloHola's conversation topics and textbook chapters should align to the 10 GLOSS topic domains. This is not just organizational tidiness — it maps HoloHola's content to a framework used by the world's most rigorous language training institution, and it organizes learning around real communicative needs rather than grammar chapters.

**3. Use GLOSS dialogues as source material for Daniela's conversation starters**

The text content of GLOSS lessons is bilingual, level-tagged, topic-organized, and likely public domain. These dialogues are ready-made input for Daniela to prime vocabulary before a production session. A GLOSS Level 1 Society dialogue → Daniela runs the same conversation with the student → vocabulary is encountered first in input, then exercised in output.

**4. GLOSS's spoken output gap is HoloHola's market position**

GLOSS reaches written production at Activity 5 but has no spoken conversation practice. A student who has completed a GLOSS lesson has consumed excellent input and done structured written output but has not spoken a word. HoloHola is where spoken production happens.

---

### The Alignment: What GLOSS Gets Right That Almost Nobody Else Does

Direct observation of GLOSS content identifies six principles that define what genuine language learning looks like — and that HoloHola is also built around:

| Principle | What GLOSS Does | What HoloHola Does |
|---|---|---|
| **Context** | Every word learned in a real sentence, a real situation — never in isolation | Daniela teaches vocabulary through conversation; compartment pounding uses real sentence frames, not naked word lists |
| **Immersion** | Authentic content at target-language speed; the student is dropped into real Spanish from lesson one | Daniela speaks to the student as a native speaker would; the session is Spanish-first, not an English grammar class that happens to use Spanish |
| **Natural language** | Real dialogues between real speakers; real news broadcasts; not scripted slow-learner text | Daniela speaks naturally — she does not slow down, over-enunciate, or simplify unless explicitly asked |
| **Ear training** | Video forecasts at native speed; no artificially slowed or synthesized audio | TTS voices at natural rate; comprehensible speed is managed through context and vocabulary prep, not through slowing speech |
| **Real-world language** | The vocabulary of real conversations, news, documents — not "Hello, my name is..." | Compartment vocabulary drawn from real communicative situations; Madrigal's sentence frames are all practical and immediately usable |
| **Real-world scenarios** | Weather forecasts, where you live, local culture — actual situations students will encounter | Daniela tailors conversation to the student's actual life — job, family, travel — not generic textbook scenarios |

**The one-sentence summary:** GLOSS is built on exactly the same philosophy as HoloHola. The difference is that GLOSS delivers this through a static web interface from the early 2000s, and HoloHola delivers it through Daniela — a real-time adaptive AI tutor who responds to what the student actually said.

---

### The Business Opportunity: Spectacular Content, Clunky Technology

GLOSS has spent decades building an extraordinary library of authentic, level-tagged, real-world language content in 40+ languages. The content philosophy is exactly right. The technology is the exact opposite: a static web page where the student clicks through numbered activities, watches a video, fills in a text box, and submits. There is no adaptation. No conversation. No memory of what the student said or struggled with. No voice. The lesson ends and nothing carries forward.

What GLOSS cannot do:
- Hear the student speak
- Adapt based on what the student said
- Remember what the student struggled with last session
- Follow a tangent the student introduces
- Notice that the student hesitated on "recámara" twice and decide to revisit it
- Give the student the feeling that someone is actually listening

All of that is Daniela.

**HoloHola is what the DLI would build if they started GLOSS from scratch today with modern AI.** Same philosophy. Same content taxonomy. Same commitment to real-world, immersive, natural-language learning. Different technology — technology that can actually respond.

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 17, 2026 (S66) | GLOSS inspected directly; lesson package downloaded and extracted (sp_soc417, Society: "Where do you live now?") | Documented |
| Apr 17, 2026 (S66) | GLOSS lesson format documented: bilingual dialogue (named characters), .docx + .pdf + .mp3 + alt .mp3, passive input only | Documented |
| Apr 17, 2026 (S66) | GLOSS competency taxonomy (Lexical, Structural, Discourse, Sociocultural) and topic taxonomy (10 domains) documented | Documented |
| Apr 17, 2026 (S66) | Licensing status: original text likely public domain (17 U.S.C. § 105); images and audio require individual evaluation | Documented |
| Apr 17, 2026 (S66) | GLOSS 5-activity video lesson structure documented from "Pronósticos desde Santiago" (sp_env215): Vocabulary → First forecast → Three forecasts → Partial transcription → Create own forecast; I-P-O model confirmed; GLOSS reaches written production at Activity 5 but has no spoken output | Documented |
| Apr 17, 2026 (S66) | Earlier "passive input only" characterization corrected: GLOSS video lessons scaffold to written production; spoken spontaneous output remains HoloHola's exclusive territory | Documented |
| Apr 17, 2026 (S66) | Flickr/Jose Hernandez image credit visible on lesson viewer confirms third-party image copyright directly; validates licensing concern documented above | Documented |
| Apr 17, 2026 (S66) | Strategic positioning refined: GLOSS covers Input + Processing; HoloHola covers Spoken Output; three-stage table (Comprehensible Input / Processing / Spoken Output) documents the complementary roles | Documented |
| Apr 17, 2026 (S66) | ODA (Online Diagnostic Assessment, oda.dliflc.edu) noted as separate DLI proficiency assessment tool, distinct from GLOSS and DLAB | Documented |
| Apr 17, 2026 (S66) | Six-principle alignment table documented: Context, Immersion, Natural language, Ear training, Real-world language, Real-world scenarios — GLOSS and HoloHola built on identical philosophy | Documented |
| Apr 17, 2026 (S66) | Business opportunity documented: GLOSS = spectacular content, clunky 2000s-era technology; HoloHola = same philosophy + Daniela (adaptive, voice, memory, real-time); "what the DLI would build if they started GLOSS from scratch today" | Documented |

---

# Part I.O — The DLI Campus: Physical Immersion Environments

## Why GLOSS's Technology Was Never a Problem (For Them)

The DLI can operate GLOSS on 2000s-era technology without it being a failure — because GLOSS was never meant to carry the immersive load. The campus carries that load.

The DLI physically builds real-world environments on their Monterey campus for exactly this purpose. Documented examples include:

- A **restaurant** — students are seated, menus are in the target language, staff are native-speaker actors
- A **café** — casual conversation, ordering, small talk
- A **train station** — ticketing, directions, time pressure, unfamiliar vocabulary under stress

Students walk into these spaces and are immersed completely. The actors do not slow down. They do not translate. They do not break character. The student must function in the environment using only the language they have.

This is the DLI's actual delivery mechanism for spoken immersion. GLOSS handles pre-work — vocabulary, reading, listening comprehension, written output. The campus handles the moment a human being has to open their mouth in a real situation and produce language without a script.

GLOSS doesn't need to be interactive because the campus is interactive. The campus doesn't need to scale because it serves a fixed enrollment. Each half of the system is designed to rely on the other.

---

## The HoloHola Parallel: Digital Immersion Environments

HoloHola's `SceneCanvas` was designed before this DLI campus parallel was articulated — and it maps to it exactly.

| DLI Physical Campus | HoloHola SceneCanvas |
|---|---|
| Restaurant set with native-speaker actors | Restaurant scene with Daniela as host/server |
| Café set | Café scene |
| Train station set | Train station scene |
| Market stall | Market / shopping scene |
| Native-speaker actors who do not break character | Daniela, who speaks only Spanish and does not translate |
| Student must produce language to advance | Student must speak to continue the conversation |
| Real objects, menus, signs in the target language | Visual props, labels, environmental text in Spanish |
| Fixed enrollment — campus can't scale | One phone, anywhere in the world |

The DLI gets away with clunky digital tools because physical sets exist. HoloHola provides the physical sets digitally, to anyone.

---

## What This Changes About HoloHola's Positioning

The standard competitive framing is: HoloHola vs. Duolingo/Babbel/Rosetta Stone. But this is the wrong comparison.

The correct comparison is: **HoloHola vs. an institution that physically builds restaurants and train stations for language training.**

The DLI does something that no app has ever done — not because they had better software, but because they had buildings, actors, and a residential campus. The spoken immersion experience they provide is the gold standard not because of their digital tools but because of the physical simulation they run alongside them.

HoloHola is the first attempt to replicate that physical simulation experience in software. Not a quiz app. Not a flashcard app. Not a grammar explainer. A simulation — of a place, a situation, a conversation partner who doesn't speak your language.

| What the DLI Builds | What HoloHola Builds |
|---|---|
| Physical environments (sets, props, actors) | Digital environments (scenes, props, Daniela) |
| Enrolled students (military/government) | Any learner, anywhere |
| Fixed locations, fixed hours | Phone, any time, any place |
| Actor performance | AI that adapts, remembers, and pushes back |
| No memory between sessions | Persistent learner model (compartments, milestones) |

---

## The Sentence That Captures It

The DLI's immersion method is the most effective proven approach to language acquisition in the United States. It requires a residential campus, a physical production budget, and a waiting list.

**HoloHola puts that campus in your pocket.**

---

## Textbook Scope Calibration: The DLI Confirmation

The DLI campus parallel answers a question that has lingered over the interactive textbook roadmap: *how complete, how polished, how pedagogically comprehensive does the textbook have to be before it's "ready"?*

The DLI answer is definitive.

GLOSS is the DLI's textbook equivalent — professional linguists, decades of content, 40+ languages, meticulous level-tagging, authentic real-world material. It is about as good as a digital pre-session resource can get. And it is still just the appetizer. Students who complete an entire GLOSS lesson have done excellent warm-up work. Then they walk into the restaurant.

**The textbook is the appetizer. Daniela is the main course.**

This is not a consolation for an unfinished textbook — it is the correct architecture. The textbook's job is to:

1. Prime vocabulary before Daniela brings it up in conversation
2. Give the student enough structural grammar to function when Daniela uses it
3. Build enough phrase familiarity that the student is not starting from zero when the conversation begins

It does not need to be exhaustive. It does not need to cover every edge case. It does not need to be a complete reference grammar. A student who finishes five textbook pages and then has a 20-minute conversation with Daniela has learned more than a student who finishes fifty textbook pages and has no conversation.

**The primary investment is in Daniela's quality as a conversation partner** — her vocabulary prep, her scaffolding, her ability to notice wobble and address it, her memory across sessions. The textbook supports that. It does not replace it.

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 17, 2026 (S66) | DLI physical campus environments documented: restaurant, café, train station — native-speaker actors, full immersion, no translation | Documented |
| Apr 17, 2026 (S66) | Reason GLOSS digital tools don't need to be cutting-edge documented: campus carries the immersion load; GLOSS is pre-work | Documented |
| Apr 17, 2026 (S66) | HoloHola SceneCanvas mapped to DLI physical sets (parallel table): same environments, same no-translation constraint, digital vs. physical delivery | Documented |
| Apr 17, 2026 (S66) | Competitive positioning reframed: HoloHola vs. residential campus immersion (DLI standard), not vs. quiz apps | Documented |
| Apr 17, 2026 (S66) | Core positioning statement: "The DLI's immersion method is the most effective proven approach to language acquisition in the US. It requires a residential campus. HoloHola puts that campus in your pocket." | Documented |

---

# Part I.P — The Affective Filter: Why Cold Immersion Fails Most Learners (S66, April 2026)

*Source: Krashen's Input Hypothesis and Affective Filter Hypothesis; direct observation of who succeeds with full immersion and who doesn't.*

---

## The Proof That Immersion Works

Immersion works. This is not in dispute. The evidence is overwhelming and personal:

- Ambassador's kids — dropped into a foreign school at age 8, fluent in 18 months
- Military kids who move overseas — same pattern
- Anyone who takes a job abroad and has no English-speaking escape hatch
- The DLI itself — arguably the most effective language training program in the world

The mechanism is simple: when you are *forced* to use a language to meet basic human needs (food, shelter, connection, employment), your brain acquires it. There is no choice involved. The target language becomes the only path forward.

---

## The Caveat: Commitment and Circumstance

Every success story in cold immersion shares one of two preconditions:

**1. No choice.** The ambassador's kid didn't choose to move. The military family didn't choose deployment. The circumstance eliminated the escape route. The brain adapted because it had to.

**2. Pre-committed.** DLI students are like Navy SEALs or Army Rangers. They signed up knowing it would be brutal, knowing it was a proven method, and knowing the result would be extraordinary. The difficulty was part of the contract. They are not the general population.

The person who voluntarily moves to Spain for a year and spends all their time with other Americans is making a rational choice: comfort in their native language is available, so they take it. This is not weakness — it is the normal human response to a difficult option when an easier option exists. The same mechanism explains why thousands of people live in the United States for decades without learning English: they live in neighborhoods where they don't have to.

**When given the choice between comfort and stretch, most people choose comfort. Every time.**

---

## The Affective Filter: The Psychological Mechanism

Stephen Krashen's Affective Filter Hypothesis names exactly what's happening. The affective filter is a psychological barrier to language acquisition that rises when a learner feels:

- Anxious or embarrassed
- Overwhelmed by incomprehensible input
- Judged for making mistakes
- Functionally illiterate — unable to understand what's happening around them

When the filter is high, language acquisition stops. The learner may be surrounded by the target language — literally living in the country — but if the filter is up, almost nothing gets through. This is why immersion without support produces inconsistent results outside of the DLI's controlled, pre-committed environment.

**The DLI knows about the affective filter.** Their solution is institutional: you signed up, you're on campus, the filter must come down or you wash out. That is not a replicable solution for a commercial app.

---

## What This Means for HoloHola

HoloHola's students are not DLI recruits. They are:

- High school students who find the work optional when it gets hard
- Adults who are self-conscious about sounding foolish
- Children who shut down completely when they feel lost
- People who have tried other apps and stopped because they felt incompetent
- Casual learners who want progress but cannot commit to structured difficulty

For these students, cold immersion — Daniela speaks only Spanish, provides no English scaffolding, never translates — will raise the affective filter past the acquisition threshold. The student will disengage. The app will close. And the student will tell themselves they are "not a language person."

**The immersion philosophy does not change. The delivery must.**

---

## Calibrated Immersion: The HoloHola Model

The goal is not to replicate the DLI. The goal is to deliver the *outcomes* of immersion to students who are not DLI recruits. That requires keeping the affective filter low enough that acquisition can happen — even if it means the session is not 100% Spanish.

The key insight: **Daniela is not a strict immersion enforcer. Daniela is a skilled tutor who uses immersion as her primary tool but holds scaffolding in reserve.**

A skilled human tutor does exactly this. They don't translate constantly — that destroys immersion. But they also don't watch a student drown in confusion and do nothing. They read the student's face. They notice the deer-in-headlights expression. They write a word on the board. They say "this one word means X — now let's try again." Then they get back to Spanish.

**The whiteboard is the key scaffolding surface.** When Daniela writes something in English on the SceneCanvas whiteboard, it is not a failure of immersion. It is a precision instrument: a lifeline delivered in a way that doesn't require breaking the Spanish-speaking frame. The student sees the English; Daniela keeps talking in Spanish.

---

## The Calibration Spectrum

| Student Profile | Daniela's Default Mode |
|---|---|
| **Spanish 1 beginner, first session** | More English scaffolding; writes key vocabulary on whiteboard in English alongside Spanish; openly acknowledges confusion; celebrates small wins aggressively |
| **Spanish 1, 3 weeks in** | Mostly Spanish; whiteboard scaffolding available on demand; Daniela eases back when she detects shutdown signals |
| **Spanish 2-3 intermediate** | Spanish-primary; English scaffolding as a "lifeline" the student can request or Daniela can offer in high-confusion moments |
| **Spanish 4-5 advanced** | Full immersion; Spanish only; Daniela does not translate; student is expected to tolerate ambiguity and infer from context |
| **Child or easily anxious learner (any level)** | Daniela calibrates down regardless of level; more celebration, more scaffolding, smaller steps, more visible progress |

The level system (Spanish 1–5) is not just a curriculum sequencer. It is also a calibration signal for how much English scaffolding is appropriate. A Spanish 1 student who gets 80% Spanish is succeeding. A Spanish 5 student who gets 80% Spanish has a problem.

---

## What Daniela Must Not Do

**She must not abandon immersion out of kindness.**

The temptation — especially with a struggling or anxious student — is to switch to English entirely, explain everything fully, and make the session comfortable. This feels kind. It is counterproductive. A session conducted primarily in English is not a language session. It is a grammar lecture.

The line Daniela holds: **Spanish is always the medium; English is sometimes the scaffold.** The scaffold is a tool she picks up and puts down. The medium is constant.

This is exactly what Madrigal herself does in her books — not coincidentally. Madrigal's books are not cold immersion. She uses English extensively to explain and scaffold before every Spanish exercise. But when it's time to practice, you practice in Spanish. The explanation is in English; the language work is in Spanish. That is the model.

---

## Two Kinds of English: Instructional vs. Emotional

There are two distinct situations where Daniela may speak English, and they are different in kind:

**Instructional English** — explaining a grammar point, clarifying a word, scaffolding before a difficult exercise. This is the precision tool. Sparing, targeted, picked up and put down. The whiteboard is the preferred surface for this: Daniela writes the English, stays in Spanish verbally. When she does say it aloud, she says it once and moves on.

**Emotional English** — greetings, celebrations, encouragement, confidence-building. This is a completely different register. It is not instruction. It is the human relationship that makes the student willing to keep going.

Examples of appropriate Emotional English:
- *"Good morning! Ready to practice?"* — warm session opener before switching to Spanish
- *"That was great — I'm really proud of you."* — genuine celebration of a hard win
- *"You got this. Don't worry — let's take it one step at a time."* — lowering the affective filter before a difficult moment
- *"See you next time!"* — friendly close

These English moments are short, warm, and relational. They are not instruction. They do not explain anything. They tell the student: *you are not alone in here, I am with you, we are going to figure this out together.* That is exactly what raises the probability that the student comes back tomorrow.

**The distinction matters for Daniela's prompt design:** Instructional English should be rare and deliberate; Emotional English can be freely used whenever it serves the student's confidence or comfort. A strict rule like "Daniela never speaks English" would inadvertently eliminate the emotional register and make Daniela feel cold and robotic — the opposite of what a calibrated immersion model requires.

**The rule is not "no English." The rule is "no English-as-instruction except when necessary."** Emotional English is always available, because it is not instruction — it is the relationship.

---

## The Market This Unlocks

The DLI serves a narrow population: government and military professionals who self-select for intensity. This is not a criticism — it is appropriate for their mission.

HoloHola serves everyone else:

- The high school student who is curious but not committed to difficulty
- The adult professional who wants conversational Spanish but has no time for a rigid curriculum
- The child who is just beginning and needs encouragement more than rigor
- The heritage speaker who understands Spanish at home but can't produce it in conversation
- The adult who tried Duolingo, felt patronized, and wants something that actually talks back

None of these students will tolerate cold immersion. All of them can acquire language if the affective filter stays low enough to let acquisition happen. **Daniela's gentle hand is not a concession to weakness — it is the product design decision that determines whether these students make it to Spanish 3.**

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 17, 2026 (S66) | Krashen's Affective Filter Hypothesis documented as the psychological mechanism behind why cold immersion fails most learners | Documented |
| Apr 17, 2026 (S66) | Commitment/circumstance dichotomy: success with cold immersion requires either no choice (ambassador's kids) or pre-commitment (DLI); average learner has neither | Documented |
| Apr 17, 2026 (S66) | Calibrated Immersion model defined: Spanish is always the medium; English is sometimes the scaffold; whiteboard as precision scaffolding surface | Documented |
| Apr 17, 2026 (S66) | Calibration spectrum documented: Spanish 1 beginner → more scaffolding; Spanish 5 advanced → full immersion; child/anxious learner → calibrate down regardless of level | Documented |
| Apr 17, 2026 (S66) | Madrigal as confirmation: her books are not cold immersion — English explains, Spanish practices; same model as Daniela's calibrated approach | Documented |
| Apr 17, 2026 (S66) | Market positioning: DLI serves pre-committed professionals; HoloHola serves everyone else; Daniela's gentle hand is what makes the broader market reachable | Documented |
| Apr 17, 2026 (S66) | Two-kind English taxonomy documented: Instructional English (precision scaffold, sparing) vs. Emotional English (greetings, celebrations, "you got this" — freely available, not instruction); "the rule is not no English; the rule is no English-as-instruction except when necessary" | Documented |

---

# Part I.Q — Prompt Philosophy: Principles Over Scripts (S66, April 2026)

*Source: Direct conclusion from the Calibrated Immersion model and the full body of pedagogical research in Parts I.A–I.P.*

---

## The Core Position

All of the research and principles documented in Parts I.A through I.P — Madrigal's pedagogy, ACTFL levels, the compartment system, the cognate hierarchy, the affective filter, calibrated immersion, two-kind English — exist to give Daniela a coherent identity and a sound philosophy. They are not a rulebook. They are not a script.

**The goal is a tutor who has internalized a philosophy, not a tutor who is following instructions.**

A tutor following a script does what the script says, even when the moment calls for something different. A tutor who has internalized a philosophy reads the room, trusts her judgment, and responds to what is actually happening. The second tutor is better in every situation where the script didn't anticipate the moment — which is most situations.

---

## The Failure Mode: The If-Then Prompt

The failure mode looks like this:

> *"If the student makes 3 errors in a row, switch to English and explain the underlying rule. If the student hasn't practiced in 7 days, open with a review session. If the student asks about grammar, explain in English first, then demonstrate in Spanish. If the student seems frustrated, reduce difficulty by 1 level. After every 5 correct responses, give a congratulations message."*

This is a decision tree. It is brittle. It fires on surface signals and misses context. It treats every frustrated student the same way, every 5-correct-response streak the same way. It cannot notice that *this particular student* needs a firm push more than a celebration right now, or that *this particular 3-error sequence* is productive struggle rather than distress.

More importantly: a prompt built this way grows without bound. Every edge case discovered in testing generates another rule. The system becomes unmaintainable. The prompt becomes a bureaucracy. And Daniela becomes worse, not better, as it grows — because the rules start to conflict, and she can no longer reason about the right thing to do.

---

## The Right Model: Character and Judgment

The right prompt gives Daniela:

1. **Who she is** — a warm, skilled, patient Spanish tutor who genuinely cares whether her students succeed
2. **What she believes** — immersion as the primary method; scaffolding as a precision tool; the relationship as the foundation that makes everything else work
3. **What she knows** — the student's history, current level, recent patterns, open struggles
4. **What she values** — confident imperfection over frozen perfectionism; progress over correctness; the student keeping going over the student getting it exactly right

Given these four things, Daniela can decide what to do in any moment without being told. She doesn't need a rule for 3-errors-in-a-row because she already knows that her job is to keep the affective filter low while pushing the student forward, and she can read whether this particular sequence of errors calls for a gentle pivot or a warm challenge.

---

## What "Principles Over Scripts" Means in Practice

| Scripted approach | Principled approach |
|---|---|
| "If frustrated, reduce difficulty" | Daniela knows the affective filter; she reads frustration and decides whether to ease, hold, or gently push based on this student, this moment |
| "Congratulate every 5 correct answers" | Daniela celebrates genuinely when something deserves celebration; she doesn't fire a congratulations on a timer |
| "Use English to explain grammar rules" | Daniela knows Instructional English is a precision tool; she reaches for it when the student genuinely needs it, not on a schedule |
| "After 7 days of absence, open with review" | Daniela knows the student's history; she decides whether to review, restart, or just get back into it based on what she knows about this person |
| "At level 1, use 20% English" | Daniela knows the calibration spectrum; she uses her judgment about this student's filter in this moment — not a percentage |

---

## The Implication for Prompt Writing

The prompt that goes into Daniela is not a procedure manual. It is closer to a character brief — the kind of document an actor uses to inhabit a role. It describes who Daniela is, what she cares about, what she knows, and how she thinks. Then it trusts her to act.

**Write less, trust more.** The more precisely we have defined the philosophy — and Parts I.A through I.P have done that work — the less we need to specify individual behaviors. Daniela has enough principle to reason her way to the right behavior in situations we never anticipated.

The practical test for any proposed prompt addition:
- *Is this teaching Daniela something about who she is or what she values?* → It belongs in the prompt.
- *Is this telling Daniela what to do in a specific situation?* → It probably doesn't. Trust the philosophy instead.

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 17, 2026 (S66) | Prompt philosophy documented: principles over scripts; character and judgment over decision trees | Documented |
| Apr 17, 2026 (S66) | If-then failure mode documented: brittle, grows without bound, misses context, conflicts over time | Documented |
| Apr 17, 2026 (S66) | Right model documented: who she is + what she believes + what she knows + what she values = sufficient for judgment in any unanticipated moment | Documented |
| Apr 17, 2026 (S66) | Practical test for prompt additions: does it teach who she is (belongs) or tell her what to do in a specific situation (probably doesn't) | Documented |

---

# Part I.R — The Textbook Data Model and Build Sequence (S66, April 2026)

*Source: Live database audit of curriculum_drill_items (32,927 items), textbook_lesson_content, and curriculum_units (units 1–27 active; units 1001–1009 archived empty shells).*

---

## What the Audit Found

### Units

| Range | Status | Content |
|---|---|---|
| Units 1–27 (Spanish 1) | Active | Full lesson content in `textbook_lesson_content` — vocabulary lists with example sentences, grammar explanations, key phrases |
| Units 28–36 (order_index 1001–1009) | [ARCHIVED] | Empty shells — 0 lessons, 0 drills. Listed as archived in UI. No data loss risk. |

### Drill Items (curriculum_drill_items)

| Type | Count | What it shows | Madrigal verdict |
|---|---|---|---|
| `translate_speak` | 28,433 | English word → student says Spanish word | Wrong: word-level, no phrase, no image |
| `fill_blank` | 2,749 | Sentence with a gap | Acceptable for review |
| `listen_repeat` | 782 | Hear isolated word, repeat it | Wrong: no image, no phrase context |
| `matching` | 261 | Match pairs | Acceptable for review |
| `number_dictation` | 702 | Dictation drill for numbers | Fine for numbers chapter |
| **Images** | **0** | None | Every vocabulary item needs one |
| **Column structure** | **0** | None | Core to substitution drills |

The `translate_speak` items are fundamentally the wrong data structure for Madrigal's method. They store a word in isolation and ask the student to translate it. Madrigal never teaches a word in isolation — always in a phrase, always with visual anchor.

### What Already Exists and Is Correct

`textbook_lesson_content.vocabulary_list` for Unit 1 already contains:
```
{ word: "Hola", translation: "Hello", exampleSentences: [{ target: "Hola, ¿cómo estás?", translation: "Hello, how are you?" }] }
{ word: "Buenos días", translation: "Good morning", exampleSentences: [{ target: "Buenos días, Señorita.", translation: "Good morning, Miss." }] }
```

This is Madrigal's format. Word + phrase in context. The data is right. The presentation is wrong.

---

## The Architectural Decision: Layer, Don't Replace

Patching `curriculum_drill_items` would require migrating 32,927 items into a format they were never designed for. That's replacement disguised as a fix.

The right architecture has three layers:

**Layer 1 — See It and Say It loop (primary vocabulary presentation)**
Data source: `textbook_lesson_content.vocabulary_list`
No new table needed. New presentation component only.

Sequence for each vocabulary item:
1. Image appears (visual anchor)
2. Daniela names the word in its example phrase ("Hola, ¿cómo estás?")
3. Student repeats (STT captures)
4. Daniela reacts and moves to next item

**Layer 2 — Substitution drill (pattern production)**
Data source: `textbook_lesson_content.key_phrases_for_chat`
No new table needed. Frame + column choices derived from vocabulary items.

Example from Unit 1:
- Frame: "Estoy ___"
- Column: [bien / muy bien / más o menos / mal / terrible]
- Student picks or says one → produces a complete sentence
- Each column choice has an image

**Layer 3 — Quick review drills (supplementary)**
Data source: `curriculum_drill_items` — keep as-is
`fill_blank`, `matching`, `number_dictation` are fine for their purpose.
`translate_speak` and `listen_repeat` are demoted from primary to review-only.

---

## The See It and Say It Loop: Micro-Sequence Specification

This is the atomic unit of every Daniela vocabulary session. It applies to every word in the lesson's vocabulary list.

| Step | What happens | Who acts |
|---|---|---|
| 1. Image | Image appears for the word (visual anchor) | System renders image |
| 2. Daniela names it | "Esto es *la farmacia* — say it with me" | Daniela speaks |
| 3. Student speaks | Student says the word (STT) | Student |
| 4. Daniela reacts | Reinforces or corrects; moves to phrase | Daniela |
| 5. Phrase model | Daniela says the example phrase naturally: "Hola, ¿cómo estás?" | Daniela speaks |
| 6. Student produces | Student says the phrase (STT) | Student |
| 7. Daniela reacts | Celebrates, corrects, notes pattern signal | Daniela |
| 8. Next item | Loop to next vocabulary word | System |

This loop is repeatable, teachable, and observable. Every word in the vocabulary list gets exactly this treatment. Mastery is tracked by completion count and Daniela's pattern signal judgment, not by a quiz score.

---

## The Substitution Drill: Micro-Sequence Specification

Applied to frames from `key_phrases_for_chat` + related vocabulary. This is Madrigal's 3-column table, made interactive.

| Step | What happens |
|---|---|
| 1. Frame displayed | "Estoy ___" shown on whiteboard with image |
| 2. Column choices shown | [bien / muy bien / más o menos / mal] each with image |
| 3. Daniela models | "Estoy bien." (reads one column choice as example) |
| 4. Student picks and produces | Student says "Estoy muy bien" (any valid column choice) |
| 5. Daniela reacts | Confirms, asks for another: "Try another one — ¿cómo estás?" |
| 6. Student varies | Student cycles through column choices |
| 7. New frame | Next frame from key_phrases_for_chat |

The student generates sentences; they are not repeating a fixed answer. This is production, not recitation.

---

## What Daniela Reads from the Textbook

When Daniela opens a session on a given lesson, she receives:

```
CURRENT LESSON: Unit 1 — Greetings & Farewells
VOCABULARY LIST:
  - Hola → "Hola, ¿cómo estás?"
  - Buenos días → "Buenos días, Señorita."
  - Buenas tardes → "Buenas tardes, Señor."
  [... 11 more items ...]
KEY PHRASES FOR TODAY:
  - "¿Cómo estás?" (ask about wellbeing, informal)
  - "Estoy bien, gracias." (respond positively)
  [... 4 more ...]
GRAMMAR POINT: Formal vs. informal address (usted vs. tú)
STUDENT STATUS: 3 vocabulary items practiced last session; "Buenas noches" marked wobble
```

Daniela uses this as her session map. She decides the order. She decides when to move to the substitution frame. She decides when the student has done enough on one word and should move to the next. The data gives her the material; the philosophy gives her the judgment.

---

## Build Sequence

| Step | What to build | Data source | Outcome |
|---|---|---|---|
| 1 | See It and Say It presentation component | `vocabulary_list` in `textbook_lesson_content` | Student can work through lesson vocabulary with image + phrase + speak |
| 2 | Image generation for vocabulary items | Visual asset pipeline (existing) | Every `vocabulary_list` item gets an image |
| 3 | Substitution drill component | `key_phrases_for_chat` + vocabulary column choices | Student produces sentences from frames |
| 4 | Daniela lesson context injection | `textbook_lesson_content` fields → greeting prompt | Daniela knows the lesson vocabulary and grammar going into the session |
| 5 | Lesson progress tracking | `lessonPageEvents` log | Daniela can see which vocabulary items the student has practiced |

Each step is independently shippable. Step 1 delivers value immediately — students can work through vocabulary correctly even before Daniela reads the data.

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 17, 2026 (S66) | Live database audit: 36 units (27 active + 9 archived empty shells); archived units have 0 lessons | Documented |
| Apr 17, 2026 (S66) | Drill format audit: 32,927 items — 28,433 translate_speak (word-level, no phrase, no image); 0 images across all items | Documented |
| Apr 17, 2026 (S66) | Vocabulary data in textbook_lesson_content confirmed Madrigal-correct: word + example phrase already present | Documented |
| Apr 17, 2026 (S66) | Architectural decision: three-layer model — See It and Say It loop (vocabulary_list), substitution drill (key_phrases_for_chat), quick review (curriculum_drill_items demoted) | Documented |
| Apr 17, 2026 (S66) | See It and Say It micro-sequence specified: 8-step loop per vocabulary item | Documented |
| Apr 17, 2026 (S66) | Substitution drill micro-sequence specified: frame + column choices → student generates sentences | Documented |
| Apr 17, 2026 (S66) | Daniela lesson context injection documented: vocabulary list + key phrases + grammar point + student wobble status → session map | Documented |
| Apr 17, 2026 (S66) | 5-step build sequence documented: presentation component → images → substitution drill → Daniela context → progress tracking | Documented |

---


# Part I.S — The Flat Page First Principle & SentenceColumnGenerator Design (S67, April 2026)

**Session:** S67 (April 18, 2026)
**Status:** Design decisions finalized — `SentenceColumnGenerator` component built

---

## The Flat Page First Principle

The printed textbook page has three strengths that most digital products destroy in the name of "interactivity":

1. **Rapid acquisition** — the eye can absorb an entire page of information at once
2. **Fast eye movement** — scanning is free; there is no interaction cost to looking at something
3. **Subconscious parallel processing** — the gestalt of the page teaches even before the reader consciously processes individual items

HoloHola's design mandate: **take that flat page and augment it with audio, voice, and dynamic generation — without burying anything that should be visible.**

### The Test for Every Page Element

> "Can the student see this without clicking anything?"

If the answer is no — if something is behind a button, an accordion, a tab, a modal, or a navigation away from the page — it fails. Content must be on the page. Audio buttons, mic buttons, and selection controls sit *alongside* visible content. They do not reveal it.

### The Resting State Rule

Every component must have a fully useful resting state. If the student never touches anything, never taps, never speaks — they should still be learning from looking at it. **Interaction is bonus. Visibility is mandatory.**

---

## The Micro-Cycle: Madrigal's Atomic Page Rhythm

From direct inspection of *See It and Say It in Spanish* (pages 9–21), Madrigal's atomic page unit is:

1. **Positive form** — concept shown in sentence form, 4+ images with labeled phrases beneath
2. **Negative form** — same structural pattern, **different images** (free vocabulary expansion opportunity)
3. **Question form** — question + affirmative/negative answer pairings with images
4. **Exercise** — images only, no scaffolding, student produces without help

Critically: there are no chapter delineations. No headers announcing a new topic. The transition from one concept to the next is marked only by the new pattern appearing at the top of the page. The learning is continuous, not partitioned.

**HoloHola equivalent of this cycle:**
- Daniela models the positive with the image
- Daniela models the negative ("How would you say you're NOT going there?") — with new images that smuggle in new vocabulary
- Daniela asks the question form — student produces the answer
- Student generates without scaffolding — Daniela responds in character

The cycle is invisible to the student — experienced as a natural conversation, not labeled "Step 3: Question Form."

### Key Detail: Negative Form Uses Different Images

Madrigal does not always reuse the same four images for the negative form. She uses it as a **free vocabulary expansion slot** — the structural pattern is familiar (no cognitive load for grammar), so new vocabulary slides in through the images without announcement. HoloHola should do the same.

---

## Chapter Page Audit: What Currently Fails the Flat Page Test

| Element | Status | Issue |
|---|---|---|
| SeeItSayItLoop vocab grid | ✓ Pass | All vocabulary visible at once, images + audio alongside |
| Chapter title + description | ✓ Pass | Always visible |
| **Lesson Reference accordion** | ✗ Fail | All lesson study notes, grammar explanations, substitution drill hidden behind expand clicks |
| **CTA buttons mid-page** | ✗ Fail | Placed between visible content and lesson reference — signals "you're done" before the page is complete |
| **No negative or question form** | ✗ Fail | The micro-cycle does not exist on the page — only the positive form is shown |
| ChapterRecap at bottom | ✗ Fail | Redundant with CTAs; pulls attention to navigation instead of content |

**The accordion is the primary violation.** It must be removed from learning pages. Content belongs on the page.

---

## The SentenceColumnGenerator: Design Decisions

### Why Not Drag-and-Drop

Making the sentence builder interactive via drag-and-drop slows the brain from parallel scanning to sequential construction. The value of Madrigal's three-column table is not that it *forces* one sentence at a time — it is that it *permits* the student to construct dozens of sentences simultaneously in their head, with their eyes, before touching anything.

**Drag-and-drop removes a capability the static page already has.** It is a regression disguised as an enhancement.

### The Radio Button Solution

Radio buttons are the minimum viable interaction layer for the column generator:
- All options in all columns remain visible at all times (flat-page principle preserved)
- One selection per column — the assembled sentence is always valid
- Change a single column, sentence updates immediately — isolates the substitution
- The eye still scans all columns and mentally simulates all outcomes without clicking anything

The assembled sentence bar at the top of the component is the "live output" — shows the current selection, updates as you select, has a play button (hear it) and a mic button (say it). No "submit" step. Immediate feedback.

### Why No Images in the Column Generator

The column generator sits below the vocabulary section on the same flat page. The images already exist above it — "banco" and "teatro" are visually anchored before the student reaches the columns. The constructor is a **grammar tool, not a vocabulary tool**. Images are not needed here because the page's flat-page layout puts them nearby.

This also makes the component portable: it works on mobile without image loading or layout concerns.

### Component Specification

**File:** `client/src/components/SentenceColumnGenerator.tsx`

| Feature | Implementation |
|---|---|
| Assembled sentence bar | Top of component; always visible; updates on any selection change |
| Column count | 2–4 columns (configurable) |
| Items per column | Unlimited; vertical list with radio button per item |
| Item display | Spanish text + English translation on two lines |
| Audio per item | Small volume icon → hears that word pronounced (TTS pronunciation pipeline) |
| Audio for sentence | Play button on assembled bar → hears full sentence (TTS pronunciation pipeline) |
| Mic for sentence | Mic button on assembled bar → student says the sentence |
| Images | None — images live in the vocabulary section above |
| Default state | First item in each column selected — always a valid sentence on arrival |
| Data source (current) | Hardcoded demo; pending API route for `key_phrases_for_chat` |

### Responsive Design Note

Desktop: all columns visible side by side — full spatial scanning.
Mobile: Madrigal's small-format book actually provides the right model. The columns are narrow; a column-per-column layout works well. The assembled sentence bar stays fixed at top.

---

## Component Build Status

| Component | Status | Notes |
|---|---|---|
| SentenceColumnGenerator | ✓ Built | `client/src/components/SentenceColumnGenerator.tsx` — demo data wired to TextbookChapterView |
| Negative form component | ✗ Not built | Same image-grid format as positive; different images |
| Question form component | ✗ Not built | Question + answer pairings with images |
| Micro-cycle container | ✗ Not built | Wraps positive / negative / question / generator in one flat layout |
| `key_phrases_for_chat` API route | ✗ Not built | Data exists in DB; no frontend route yet |
| Chapter page accordion removal | ✗ Not built | Lesson Reference accordion must be replaced with flat content |

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 18, 2026 (S67) | Flat Page First Principle articulated and documented | Documented |
| Apr 18, 2026 (S67) | Madrigal's micro-cycle identified: positive → negative (new images) → question → exercise | Documented |
| Apr 18, 2026 (S67) | Chapter page audit conducted — accordion as primary flat-page violation; 5 failures identified | Documented |
| Apr 18, 2026 (S67) | SentenceColumnGenerator design decided: radio buttons, pure text, no drag-and-drop, no images | Decided |
| Apr 18, 2026 (S67) | SentenceColumnGenerator component built and wired to chapter page with demo data | Built |
| Apr 18, 2026 (S67) | Resting state rule established: every component must be useful before any interaction occurs | Documented |

---


# Part I.T — Spanish 1 Unit Taxonomy & Curriculum Map (S68, April 2026)

**Session:** S68 (April 21, 2026)
**Status:** Decisions finalized — unit map defined, format taxonomy established

---

## The Problem This Solves

HoloHola's existing 27 units are organized by topic (Greetings, Activities, Mi Familia). This is a category error — topic-based organization assumes bounded knowledge boxes, which is the opposite of how Madrigal and communicative language teaching work. A unit called "La Familia" implicitly tells the learner's brain "you have learned family vocabulary" and files it away. A unit organized by grammatical structure keeps every tool available.

The curriculum map below reorganizes Spanish 1 around **function and structure**, not topic. Units can be presented in almost any order once built — the format types below are stable containers that work regardless of sequence. Organization is a presentation decision that can be changed at any time without rebuilding the content.

---

## The Four Unit Format Types

Every unit in Spanish 1 (and every future language) falls into exactly one of four format types. The format is determined by the nature of the content, not by a design choice.

---

### Format 1 — Social Phrase Card

**What defines it:** Ritual phrases with no verb conjugation engine underneath. The phrase IS the unit — there is no grammatical slot to rotate.

**Content characteristics:**
- Phrases are memorized as fixed or semi-fixed units
- No image anchor is needed (no object to picture; the phrase itself carries the meaning)
- Register matters more than grammar: formal vs. casual, time-of-day, social context
- Contextual use is the drill — hearing and saying in realistic exchange

**Page layout:**
- Phrase in large type (Spanish)
- Pronunciation guide beneath
- Register/context note (e.g., "used any time of day, informal")
- Listen button + Speak button
- Optional: one ambient scene image for context — decorative, not conceptual

**When it appears:** Surfaced by Daniela from session 1, before any grammar unit. Students absorb these through repetition before formally studying them.

**Spanish 1 examples:** Hola / Buenos días / Buenas tardes / Buenas noches / Gracias / De nada / Por favor / Perdón / ¿Qué tal? / ¿Qué pasa?

**Note on ¿Cómo estás?:** This phrase belongs to the estar Grammar Concept unit (Unit 12), not the Social Phrase unit, because it has a conjugation structure underneath (estoy / está). Students hear it from Daniela in session 1 as a social ritual; they formally learn why it works in Unit 12.

---

### Format 2 — Verb Unit

**What defines it:** One verb or tense, image-anchored vocabulary, substitution drill columns. This is the main curriculum spine and the most common unit type.

**Content characteristics:**
- One grammatical frame is the organizing principle (e.g., tomé ___ / ¿tomó ___)
- Each vocabulary word is anchored to an image
- Substitution columns rotate the object while the frame stays fixed
- Column 1 may expand in later units to include related tenses (see Spanish 2+ note below)

**Page layout:**
- Image grid: 4–6 images, each anchoring a vocabulary word
- Target phrase beneath each image (word used in the verb frame)
- Substitution drill: frame + column choices (clean columns only in Spanish 1)
- Conjugation reference note at bottom (small, reference — not the focus)

**Spanish 1 column rule:** Every column 1 item works with every column 2 item. No invalid combinations. This is a conscious Spanish 1 decision — see Spanish 2+ note below.

**Spanish 1 examples:** ir / tomar (preterite) / comprar (preterite) / ir + a + infinitive / querer / poder / hay / present tense AR / present tense ER-IR / present progressive / preterite all persons / irregular preterites / present perfect

---

### Format 3 — Grammar Concept Unit

**What defines it:** One verb, but multiple qualitatively distinct use cases that cannot be collapsed into a single substitution frame. The same verb does fundamentally different jobs in different contexts.

**Content characteristics:**
- Each use case gets its own image set and drill
- The unit is organized by domain (location / health / emotions), not by grammatical variation
- The conjugation table is presented once and referenced across all domains
- Layout is longer than a verb unit but uses the same visual components — just more of them in sequence

**What makes this different from Format 2:** In a Verb Unit, all substitution drills use the same semantic frame (tomar = consume something). In a Grammar Concept Unit, the semantic frame changes between domains — estar for location means something structurally different from estar for emotion, even though the conjugation is identical.

**Spanish 1 examples:**
- **ser** — description (es grande) vs. classification (es un animal) vs. identity (soy Ana) vs. gender rules
- **tener** — possession (tengo un gato) vs. obligation (tengo que ir) vs. idioms (tengo hambre / sed / frío / calor)
- **estar** — location (¿Dónde está?) vs. health/state (¿Cómo estás? / Estoy bien) vs. emotions (contento / cansado / enojado / triste)
- **gustar** — inverted structure (me gusta / me gustan) vs. me gustaría — the structure itself is the lesson, not just the vocabulary
- **Plurals** — -o→-os / -a→-as / -or→-ores / adjective agreement — grammar rules across multiple noun classes

---

### Format 4 — Vocabulary Cluster

**What defines it:** No verb, topic-defined by shared contextual or functional logic. All words in the unit do the same job or occupy the same semantic space. A vocabulary cluster is valid only when the words have intrinsic coherence independent of any verb structure.

**The test:** Can you teach all these words together without needing to anchor them to a single conjugated verb? If yes, it may be a valid vocabulary cluster. If the words each require different verb structures to make sentences, they belong as object vocabulary distributed across verb units instead.

**Content characteristics:**
- Image-per-word (each word gets a visual anchor)
- Short example phrase showing the word in a natural sentence — but the phrase may use different verbs for different words; the verb is not the organizing principle
- Optional: a scene diagram (e.g., a room layout for Las Direcciones, a color palette for Los Colores)
- No conjugation table
- Substitution drill limited to vocabulary rotation, not tense variation

**Why "La Familia" is NOT a vocabulary cluster:** Family words require different verb structures (tengo una hermana / mi madre es alta / mi padre está en casa). The family vocabulary is distributed as object vocabulary inside the tener, ser, and estar units. It is not a standalone cluster.

**Why "Las Direcciones" IS a vocabulary cluster:** All prepositions of location do exactly the same job — they answer ¿Dónde? — and they can all be shown together in a single spatial scene. They work independently of verb structure.

**Spanish 1 examples:**
- **¿Qué es? — Categories**: animals / fruits / vegetables / flowers (all feed into the ser classification drill)
- **Los Colores**: 12 colors + gender agreement rules
- **Los Números**: 0–1000
- **Las Direcciones**: cerca / lejos / al lado / encima / debajo / adelante / atrás / a la derecha / a la izquierda / alrededor / en la pared
- **La Casa**: rooms + key objects (feeds into estar location drills)
- **El Tiempo / Los Días / Los Meses**: weather expressions + days of week + months + seasons

---

## Spanish 1 Unit Map

27 units, organized by pedagogical phase. Units are modular — order can be adjusted as long as dependencies are respected (e.g., estar location drills work better after Las Direcciones vocabulary is established).

### Phase 0 — Conversational scaffold (before the curriculum)

| # | Unit | Format | Key content |
|---|---|---|---|
| 0 | Social Phrases | Social Phrase | Hola / Buenos días / tardes / noches / Gracias / De nada / Por favor / Perdón / ¿Qué tal? / ¿Qué pasa? |

### Phase 1 — Survival foundations

| # | Unit | Format | Key content |
|---|---|---|---|
| 1 | ir | Verb | voy / va / vamos / van — places (hotel, banco, parque, restaurante, cine) |
| 2 | ser | Grammar Concept | es / son; el / la gender; description (grande / chiquito / bonito); gender rules for adjectives |
| 3 | ¿Qué es? — Categories | Vocabulary Cluster | Animals / fruits / vegetables / flowers — ser for classification, not description |
| 4 | Los Colores | Vocabulary Cluster | 12 colors; ser + color adjective; gender agreement (rojo / roja) |

### Phase 2 — First verbs in the past + near future

| # | Unit | Format | Key content |
|---|---|---|---|
| 5 | tomar (preterite) | Verb | tomé / tomó — meals, drinks, transportation |
| 6 | comprar (preterite) | Verb | compré / compró — shopping, clothing vocabulary as objects |
| 7 | ir + a + infinitive | Verb | voy a / va a / vamos a / van a + any infinitive — near future; unlocks all verbs |

### Phase 3 — Ownership, need, desire

| # | Unit | Format | Key content |
|---|---|---|---|
| 8 | tener | Grammar Concept | tengo / tiene / tenemos / tienen — possession; tener que + infinitive; tener idioms (hambre / sed / frío / calor / razón) |
| 9 | querer | Verb | quiero / quiere — want + noun; want + ir; personal a (Quiero a mi madre) |

### Phase 4 — Numbers and plurality

| # | Unit | Format | Key content |
|---|---|---|---|
| 10 | Los Números | Vocabulary Cluster | 0–1000; practical use |
| 11 | Plurals | Grammar Concept | -o→-os / -a→-as / -or→-ores; el→los / la→las; adjective agreement in plural |

### Phase 5 — Location, state, space

| # | Unit | Format | Key content |
|---|---|---|---|
| 12 | estar | Grammar Concept | estoy / estás / está / estamos / están — location (¿Dónde está?); health + greeting (¿Cómo estás? / Estoy bien); emotions (contento / cansado / enojado / triste / enfermo) |
| 13 | Las Direcciones | Vocabulary Cluster | cerca / lejos / al lado / encima / debajo / adelante / atrás / a la derecha / a la izquierda / alrededor / en la pared |
| 14 | La Casa | Vocabulary Cluster | Rooms + key objects — feeds directly into estar location drills |

### Phase 6 — Ability, existence, preference

| # | Unit | Format | Key content |
|---|---|---|---|
| 15 | poder | Verb | puedo / puede / podemos / pueden + infinitive — can / be able to |
| 16 | hay | Verb | hay + noun — there is / there are; ¿Hay...? — existential |
| 17 | gustar | Grammar Concept | me gusta / le gusta / nos gusta; me gustan (plural objects); me gustaría; inverted structure — the verb follows its object |

### Phase 7 — Time and weather

| # | Unit | Format | Key content |
|---|---|---|---|
| 18 | El Tiempo / Los Días / Los Meses | Vocabulary Cluster | hace frío / calor / viento / fresco; está lloviendo / nevando; days of week; months; seasons |

### Phase 8 — Present tense (deliberately late, following Madrigal's sequence)

| # | Unit | Format | Key content |
|---|---|---|---|
| 19 | Present tense — AR | Verb | hablar / trabajar / estudiar / bailar / caminar — full paradigm yo / tú / usted / nosotros / ellos |
| 20 | Present tense — ER/IR | Verb | vivir / escribir / leer / comer / vender — full paradigm |
| 21 | Present progressive | Verb | estoy / está + -ando / -iendo — AR→ando, ER/IR→iendo; what is happening right now |

### Phase 9 — Preterite expanded

| # | Unit | Format | Key content |
|---|---|---|---|
| 22 | AR preterite — all persons | Verb | hablé / hablaste / habló / hablamos / hablaron + bailar / trabajar / estudiar |
| 23 | ER/IR preterite | Verb | recibí / recibió; escribí / escribió; vi / vio |
| 24 | Irregular preterite — tener / estar / hacer / venir | Verb | tuve / tuvo / estuve / estuvo / hice / hizo / vine / vino |
| 25 | Irregular preterite — ir | Verb | fui / fue / fuimos / fueron + a (place or activity) |

### Phase 10 — Perfect

| # | Unit | Format | Key content |
|---|---|---|---|
| 26 | Present perfect | Verb | he / ha / hemos / han + -ado / -ido |

---

## Key Decisions Recorded

| Decision | Rationale |
|---|---|
| Preterite before present tense | Students talk about what they did (narrative) before what they do habitually; Madrigal's sequence and communicative priority both confirm this |
| Near future (ir + a) in Phase 2 | One conjugation (voy/va/vamos/van) unlocks every verb in the language; highest ROI structure for beginners |
| Greetings as Social Phrase (not Unit 1) | Greetings have no verb conjugation engine — they cannot be taught with the standard substitution drill format; they are Daniela's conversational protocol, not curriculum content |
| ¿Cómo estás? belongs in estar unit | It uses estar conjugation; students hear it in session 1 from Daniela but formally learn it in Unit 12 |
| La Familia is not a standalone unit | Family words require tener / ser / estar — they are object vocabulary distributed across those verb units, not a cohesive cluster |
| Las Direcciones is a standalone cluster | All prepositions of location answer ¿Dónde? and can be shown together in one spatial scene; intrinsic coherence independent of verb structure |
| Clean columns only (Spanish 1) | Every column 1 item works with every column 2 item; no combinations requiring grammatical validation; conscious Spanish 1 decision |
| Thinking columns deferred to Spanish 2+ | Mixed-validity column combinations (e.g., tengo / tengo que / tuve with shared object column) require students to reason about grammar constraints — appropriate at intermediate level, not beginner |

---

## What "Modular" Means

Once each unit is built to its format spec, the page is self-contained. The learning experience on that page is complete regardless of what comes before or after it. This means:

1. Unit order can be adjusted based on student needs, curriculum feedback, or new pedagogical decisions — without rebuilding any unit
2. A student can enter the curriculum at any point and the page they land on is immediately usable
3. Future languages can adopt the same four formats with language-specific content — no new format design required

The formats are the infrastructure. The units are the content. They are independent.

---

### Session Log

| Date | Action | Status |
|---|---|---|
| Apr 21, 2026 (S68) | Four unit format types defined: Social Phrase / Verb Unit / Grammar Concept / Vocabulary Cluster | Documented |
| Apr 21, 2026 (S68) | Spanish 1 unit map established: 27 units across 10 phases | Documented |
| Apr 21, 2026 (S68) | Key decisions recorded: column rules, greeting placement, family vocabulary distribution, thinking columns deferred | Documented |
| Apr 21, 2026 (S68) | Modular architecture principle established: format is infrastructure, unit content is independent | Documented |

---


# Part II: Asset Library & Generation Specs

## 9-Language Textbook Component Coverage Matrix

**As of March 20, 2026** — all 9 languages have complete coverage across all 5 card types. Machine-readable version at `docs/textbook-component-coverage.json`, monitored by Lyra on every analysis run.

| Language | Grammar Cards | Cultural Cards | Phonetic Guides | Word Families | Canvas Vocab | Status |
|----------|:---:|:---:|:---:|:---:|:---:|:---:|
| **Spanish** | ✅ 46 (GrammarDiagrams + Infographics) | ✅ 8 | ✅ 9 | ✅ 12 | ✅ 8 types | ✅ Complete |
| **French** | ✅ 24 | ✅ 7 | ✅ 9 | ✅ 10 | ✅ 8 types | ✅ Complete |
| **Portuguese** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **German** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Italian** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Japanese** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Korean** | ✅ 24 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Mandarin** | ✅ 23 | ✅ 7 | ✅ 9 | ✅ 11 | ✅ 8 types | ✅ Complete |
| **Hebrew** | ✅ 22 | ✅ 7 | ✅ 9 | ✅ 12 | ✅ 8 types | ✅ Complete |

### Component Files Per Language

| Language | Grammar | Cultural | Phonetic | Word Families |
|----------|---------|----------|----------|---------------|
| Spanish | `TextbookGrammarDiagrams.tsx` + `TextbookInfographics.tsx` | `TextbookCulturalCards.tsx` | `TextbookPhoneticGuides.tsx` | `TextbookWordFamilies.tsx` |
| French | `TextbookFrenchGrammarCards.tsx` | `TextbookFrenchCulturalCards.tsx` | `TextbookFrenchPhoneticGuides.tsx` | `TextbookFrenchWordFamilies.tsx` |
| Portuguese | `TextbookPortugueseGrammarCards.tsx` | `TextbookPortugueseCulturalCards.tsx` | `TextbookPortuguesePhoneticGuides.tsx` | `TextbookPortugueseWordFamilies.tsx` |
| German | `TextbookGermanGrammarCards.tsx` | `TextbookGermanCulturalCards.tsx` | `TextbookGermanPhoneticGuides.tsx` | `TextbookGermanWordFamilies.tsx` |
| Italian | `TextbookItalianGrammarCards.tsx` | `TextbookItalianCulturalCards.tsx` | `TextbookItalianPhoneticGuides.tsx` | `TextbookItalianWordFamilies.tsx` |
| Japanese | `TextbookJapaneseGrammarCards.tsx` | `TextbookJapaneseCulturalCards.tsx` | `TextbookJapanesePhoneticGuides.tsx` | `TextbookJapaneseWordFamilies.tsx` |
| Korean | `TextbookKoreanGrammarCards.tsx` | `TextbookKoreanCulturalCards.tsx` | `TextbookKoreanPhoneticGuides.tsx` | `TextbookKoreanWordFamilies.tsx` |
| Mandarin | `TextbookMandarinGrammarCards.tsx` | `TextbookMandarinCulturalCards.tsx` | `TextbookMandarinPhoneticGuides.tsx` | `TextbookMandarinWordFamilies.tsx` |
| Hebrew | `TextbookHebrewGrammarCards.tsx` | `TextbookHebrewCulturalCards.tsx` | `TextbookHebrewPhoneticGuides.tsx` | `TextbookHebrewWordFamilies.tsx` |

**Canvas vocab cards** (weather, emotions, time, days/months, body, face, hand, temperature): all 9 languages in a single `TextbookCanvasCards.tsx` with per-language dataset branches.

**Wiring**: All card types route through `classifyGrammarType(lessonName, language)` in `ChapterIntroduction.tsx`, which returns the correct `GrammarChapterType` enum value → `GrammarChapterView` renders the matching card. Lesson reader content is now rendered **inline** in `VisualLessonCard` (modal removed March 20, 2026).

---

## Platform Status Snapshot

**Last audited:** March 20 2026 (session 5)

### Interactive Canvas — What's Built

The `SceneCanvas` component (client-side stage model) is **fully operational**. Phase 1 (scene/props/clock) shipped earlier; Phase 2 (grammar & body diagrams) shipped March 17, 2026 — all canvas capabilities are now complete. Bilingual label system added March 18, 2026.

| Capability | Status | Notes |
|---|---|---|
| `open_scene(environment)` | ✅ Built | Loads background, clears existing scene |
| `add_to_scene(prop, position)` | ✅ Built | Overlays transparent PNG at zone coordinates; `label` = target language, `native_label` = student's L1 — both shown stacked below prop |
| `remove_from_scene(prop)` | ✅ Built | Fades out and removes prop layer |
| `set_clock(time)` | ✅ Built | SVG analog clock with rotating hands |
| `clear_scene()` | ✅ Built | Removes all props, keeps background |
| `highlight_body_part(part)` | ✅ Built | Interactive SVG body diagram; `labels` + `native_labels` maps show bilingual badges — March 17, 2026 |
| `set_face_part(parts)` | ✅ Built | SVG face close-up (ears→hair→face→eyes→nose→mouth); bilingual badge cloud — March 17, 2026 |
| `set_hand_part(parts)` | ✅ Built | SVG dorsal hand (dorsal right, mirrored for left); bilingual badge cloud — March 17, 2026 |
| `fill_conjugation(row, value)` | ✅ Built | Live conjugation table fill-in with pronoun/ending highlighting — March 17, 2026 |
| `highlight_country(country)` | ✅ Built | SVG world map with country highlight + label — March 17, 2026 |
| `set_calendar(day, month)` | ✅ Built | SVG calendar with day highlight and month label — March 17, 2026 |
| Emotion face SVG | ✅ Built | Animated face expressions (happy, sad, angry, surprised, etc.) — March 17, 2026 |
| Thermometer SVG | ✅ Built | Animated mercury fill with °C/°F display — March 17, 2026 |
| Weather icon SVG set | ✅ Built | Full set: sunny, cloudy, rainy, stormy, snowy, windy, foggy — March 17, 2026 |
| **Bilingual label system** | ✅ Built | All props and diagrams show target-language label (bold) + native-language label (muted, below) simultaneously — March 18, 2026 |

### Image Library — What Exists

| Category | Records in DB | With actual images | Notes |
|---|---|---|---|
| Food vocabulary | 1,176 | 1,176 ✅ | Complete as of Mar 18 2026 — all menu items + basics (tacos, staples, etc.) generated |
| Scene canvas props | ~40 | ~40 | glass, fork, book, stethoscope, passport, etc. — all have real images |
| Vocabulary images — Novice Low (Section 1) | 85 cache keys | 55 images ✅ | Complete Mar 19 2026 — people, places, things, colors, adjectives, activities |
| Vocabulary images — Novice Mid People | 18 cache keys | 10 images ✅ | Complete Mar 19 2026 — family pairs, community professionals, extended family scene |
| Vocabulary images — Novice Mid Animals | 11 cache keys | 10 images ✅ | Complete Mar 19 2026 — perro, gato, pájaro, pez, caballo, vaca, oveja, oso, pato, conejo |
| Vocabulary images — Novice Mid Food | 14 cache keys | 12 images ✅ | Complete Mar 19 2026 — naranja, fresa, uva, sandía, limón, tomate, zanahoria, lechuga, papa/patata, cebolla, ajo, maíz |
| Vocabulary images — Novice Mid Clothing | 10 cache keys | 8 images ✅ | Complete Mar 19 2026 — camisa, pantalón, vestido, zapatos, sombrero, chaqueta, calcetines, falda |
| Vocabulary images — Novice Mid Activities | 8 cache keys | 8 images ✅ | Complete Mar 19 2026 — comprar, pagar, cocinar, limpiar, nadar, bailar, cantar, pintar |
| Vocabulary images — Novice Mid Adjectives | 23 cache keys | 10 images ✅ | Complete Mar 19 2026 — 10 contrast pairs (cerca/lejos, alto/bajo, rápido/lento, pesado/ligero, joven/viejo, feliz/triste, fácil/difícil, ruidoso/tranquilo, oscuro/claro, duro/suave) |
| Time/weather/numbers (Section 2) | 0 | 0 | Clock + weather handled by SVG components; static reference cards not started |
| Cultural infographics (Section 5) | 0 | 0 | Not started |

**Generation pipeline (as of Mar 19 2026):** All images — seeded library and Daniela's live fallback — use **DALL-E 3** with the **canonical style** below. Library lookup is instant (cache key `vocab_spanish_{word}`); fallback generates on demand and saves to cache automatically.

**Canonical illustration style (updated Mar 19 2026):**
- Objects/props: `soft watercolor children's book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture, object centred and prominent on a clean pure white background, no background elements, clear and recognisable silhouette, language learning educational quality`
- Scenes/activities with characters: `soft watercolor children's book illustration style, warm gentle colors, clean fine ink outlines, visible brushwork texture, friendly expressive characters, no visible text or labels on anything, language learning educational context, suitable for all ages`
- **IMPORTANT:** Never use "pencil outlines" — DALL-E interprets this literally and adds physical pencils to the image. Use "clean fine ink outlines" instead.
- Always append: `ZERO TEXT ZERO WORDS ZERO LETTERS ZERO NUMBERS anywhere in the image.`
- Model: **DALL-E 3**, size **1024×1024**, quality **standard**

**Novice Mid complete:** 58 images total (10 people + 10 animals + 12 food + 8 clothing + 8 activities + 10 adjective pairs), covering 84 cache keys. All seeded in DB and uploaded to object storage.

**Novice High complete:** 23 images (9 places + 10 transport + 4 professions). All seeded in DB and uploaded to object storage.

**Novice Low people refreshed Mar 19 2026:** All 7 Novice Low people images regenerated in canonical children's book style (v=1). Neighbour (vecino/a) added to Novice Mid.

**Intermediate Low complete Mar 19 2026:** 12 images — 1 body diagram (covers 15 body-part cache keys), 4 health items, 7 furniture/home items. All seeded in DB and uploaded to object storage.

**Intermediate Mid complete Mar 19 2026:** 20 images — 12 nature scenes (árbol → estrella), 8 emotion portraits (enojado → aburrido). All seeded in DB and uploaded to object storage.

**Section 2 (Weather + Time) complete Mar 19 2026:** 13 images — 9 weather scenes, 4 time reference cards (day parts, days of week, months circle, four seasons). All seeded in DB.

**Numbers complete Mar 19 2026:** 7 number cards (0-10, 11-20, tens grid, hundreds/thousands, ordinals, price/currency, phone/address). Covers cero → millón and related keys.

**Specific fixes Mar 19 2026:** avión (v=2, correct 2 wings), metro (v=2, no pencil artifacts), nervioso (v=2, culturally neutral), meses (v=2, pure visual mandala), días de semana (v=2, pure activity scenes, no text).

**ALL DALL-E WORK COMPLETE.** ~200 images total. Remaining ⬜ items are React/SVG grammar diagrams (Sections 3–7) — these are code components, not DALL-E images, and will be built as a separate coding task.

---

## Philosophy

Language learning has two visual use cases:

1. **Word → Image**: Student hears or reads a word and needs to see what it looks like. This is vocabulary acquisition. Images here must be clean, consistent, and instantly recognizable — no ambiguity.

2. **Concept → Diagram**: Student is trying to understand HOW the language works. No image of a cup teaches "preterite vs imperfect." These need diagrams — timelines, maps, tables — that make abstract grammar visible and spatial.

Both live in this roadmap. Neither is a substitute for the other.

**Personal vocabulary** (words students guide Daniela into teaching based on their own interests) is intentionally NOT in this list. Those generate on-demand via `generate_visual`. This list is the required core — the vocabulary every student at every level must know, regardless of what they personally care about.

---

## Content Policy
**Decided: April 4, 2026**

These rules govern every image generation and routing decision going forward. They exist to balance educational quality, maintenance cost, and cross-language consistency.

### Rule 1 — Shared vs. Language-Specific Images

**The dividing line is simple: does the image contain people?**

| Content type | Policy | Rationale |
|---|---|---|
| Inanimate objects (pen, chair, book, car, food items) | **Shared** | A pen is a pen in every country |
| Animals, plants, nature | **Shared** | Universally recognizable |
| Any image containing people (greetings, actions, professions, daily life) | **Language-specific** | Characters should reflect the culture being learned |
| Culture-specific objects that only exist in one culture | **Language-specific** | A croissant, an onigiri, a baguette |

**Why this rule:** Students should see characters that look like native speakers of the language they are learning. A French student should see Juliette saying "Bonjour," not Daniela. The rule is easy to apply — if there's a person in the frame, it belongs to that language.

### Rule 2 — The Spanish Baseline Problem

Spanish was chosen as the image baseline for pragmatic reasons (first language built), not design ones. This means all shared images currently feature Spanish-coded characters (Daniela, Marco). For students of other languages, the result is a predominantly Spanish-looking library with one or two language-specific images mixed in — which is mildly inconsistent but not educationally harmful.

**Long-term goal:** Shared images should be regenerated to be character-neutral (objects, hands, silhouettes, non-ethnically-coded figures) so the shared library doesn't read as Spanish. This is a non-urgent one-time re-generation task, not a blocker for current development.

**Short-term stance:** Accept the inconsistency. Students see only one language and are unlikely to notice.

### Rule 3 — Images vs. Grammar Tables, and Noun/Verb Pairing

**Do not generate a separate image for each conjugated verb form.** This creates duplicate images, wastes DALL-E budget, and teaches nothing that a table cannot teach better.

| Vocabulary type | Correct visual treatment |
|---|---|
| Infinitive verb (comer, dormir, hablar) | One image of the action |
| Conjugated form (yo como, je mange, ich esse) | Conjugation table — not a separate image |
| Verb paradigm (AR/ER/IR endings) | Grammar diagram / conjugation table |
| Phrase or sentence starter (Me gusta..., J'aimerais...) | No image needed — pattern card or dialog example |

**Noun + Verb pairing:** Where a noun and its related verb are clearly the same concept, use a single image for both and register it under both keys. Do not generate two images.

Examples:
- `desayuno` (breakfast) and `desayunar` (to eat breakfast) → one image, two keys
- `cena` (dinner) and `cenar` (to have dinner) → one image, two keys
- `almuerzo` (lunch) and `almorzar` (to have lunch) → one image, two keys
- `baño` (bath/bathroom) and `bañarse` (to bathe) → same image works for both

**The test:** If you can look at the image and it would correctly illustrate both the noun and the verb without ambiguity, register both keys to the same image. Only generate a second image when the noun and the action are visually distinct.

The existing duplicate pairs (e.g. "to eat" + "I eat" showing the same image twice) should be collapsed to a single infinitive image + a conjugation table.

### Rule 4 — When No Image Is Better Than a Wrong Image

A placeholder is preferable to a misleading image. Specific situations where skipping the image is the right choice:
- The word is abstract (justice, freedom, democracy)
- The word is a grammatical function word (the, is, but, of)
- The word's meaning is best shown through a conjugation table, timeline, or diagram
- The word is a culturally-specific phrase where no image would capture the nuance

The SVG/grammar classifier in the resolver already handles some of this. When in doubt, route to a grammar component rather than generating a generic DALL-E fallback.

### Rule 5 — Prompt Templating (Character Substitution) for Language-Specific Images

**Decided: April 5, 2026**

Spanish SCENE_OVERRIDE prompts in `vocab-image-seed-service.ts` are written as **templates**, not one-off prompts. Instead of hardcoding "a young Spanish woman with dark hair," they reference `CHAR.ES.primary` — a named character profile object. Each language has its own profile:

| Key | Character | Description |
|-----|-----------|-------------|
| `CHAR.ES` | Daniela / Marco | Spanish-coded characters (dark hair, Mediterranean features) |
| `CHAR.FR` | Juliette / Antoine | French-coded characters (lighter features, Parisian styling) |
| `CHAR.DE` | Anna / Stefan | German-coded characters |
| `CHAR.IT` | Giulia / Luca | Italian-coded characters |
| `CHAR.PT` | Sofia / Rafael | Brazilian Portuguese-coded characters |
| `CHAR.JA` | Yuki / Kenji | Japanese-coded characters |
| `CHAR.KO` | Soo-Jin / Ji-Ho | Korean-coded characters |
| `CHAR.ZH` | Mei / Wei | Mandarin Chinese-coded characters |
| `CHAR.HE` | Noa / Eitan | Israeli Hebrew-coded characters |

**How it works:** To generate a language-specific version of a Spanish scene image, swap `CHAR.ES.primary` → `CHAR.FR.primary` in the prompt text. Everything else (scene description, watercolor style, pen wash technique, scene layout, SCENE_STYLE lock) stays identical. The only change is the character reference.

**This is called:** Character-substitution prompt templating (similar to "persona swap" in AI image generation literature; related concepts: image prompt templating, character-consistent generation).

**Coverage audit needed:** Before running generation for non-Spanish languages, a full audit must determine:
1. How many language-specific scene images currently exist for each of the 8 non-Spanish languages
2. Which Spanish SCENE_OVERRIDE prompts are fully templateable (person in scene → swap character)
3. Which prompts require scene-level changes beyond character swap (e.g., a Spanish plaza background may need to become a Japanese street scene)
4. Estimated DALL-E budget for the full non-Spanish generation run

**Audit status:** ⬜ Not started — estimated ~200-300 new images across all 8 non-Spanish languages for scenes that currently have Spanish characters only.

---

## Section 1 — Core Vocabulary Images (by ACTFL Level)

Format: illustrated watercolor style, same as the current prop library.
Organization: thematic clusters. A student at Novice Low needs the Novice Low cluster plus everything below.

### Novice Low — Survival Essentials

**People**

*Grouping note: several people words are ambiguous as solo images (a woman alone could be madre, hermana, mujer, or amiga). Group and pair images are used where the relationship itself is the meaning.*

| Image | Covers | Spanish | Status | Notes |
|-------|--------|---------|--------|-------|
| Familia (group portrait) | mother, father, brother, sister, baby | madre, padre, hermano, hermana, bebé | ✅ Mar 19 2026 | `vocab_people_familia.png` — regenerated in children's book style v=1 |
| Los niños (pair) | boy, girl | niño, niña | ✅ Mar 19 2026 | `vocab_people_ninos.png` — regenerated v=1 |
| Los amigos (pair greeting) | friend (m/f) | amigo, amiga | ✅ Mar 19 2026 | `vocab_people_amigos.png` — regenerated v=1 |
| El hombre (solo) | man | hombre | ✅ Mar 19 2026 | `vocab_people_hombre.png` — regenerated v=1 |
| La mujer (solo) | woman | mujer | ✅ Mar 19 2026 | `vocab_people_mujer.png` — regenerated v=1 |
| El/la profesor/a (solo) | teacher | profesor/a | ✅ Mar 19 2026 | `vocab_people_profesor.png` — regenerated v=1 |
| El/la estudiante (solo) | student | estudiante | ✅ Mar 19 2026 | `vocab_people_estudiante.png` — regenerated v=1 |

**Places**

*Note: environment bg = used by scene canvas. These standalone images serve `show_image` and textbook vocab cards — different use case, both needed.*

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| house/home | casa | ✅ Mar 18 2026 | `vocab_places_casa.png` |
| school | escuela | ✅ Mar 18 2026 | `vocab_places_escuela.png` |
| classroom | aula | ✅ Mar 18 2026 | `vocab_places_aula.png` — also seeded: salón, clase |
| restaurant | restaurante | ✅ Mar 18 2026 | `vocab_places_restaurante.png` |
| park | parque | ✅ Mar 18 2026 | `vocab_places_parque.png` |
| hospital | hospital | ✅ Mar 18 2026 | `vocab_places_hospital.png` — exterior |
| supermarket | supermercado | ✅ Mar 18 2026 | `vocab_places_supermercado.png` — also seeded: tienda, mercado |
| bathroom | baño | ✅ Mar 18 2026 | `vocab_places_bano.png` — also seeded: servicio, lavabo |
| bedroom | dormitorio | ✅ Mar 18 2026 | `vocab_places_dormitorio.png` — also seeded: cuarto, habitación |
| kitchen | cocina | ✅ Mar 18 2026 | `vocab_places_cocina.png` |

**Things — Classroom/Home**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| book | libro | ✅ | in prop library |
| backpack | mochila | ✅ | in prop library |
| pencil | lápiz | ✅ Mar 19 2026 | `vocab_things_lapiz.png` |
| pen | bolígrafo / pluma | ✅ Mar 19 2026 | `vocab_things_boligrafo.png` — dual keys: bolígrafo (formal) + pluma (common spoken) |
| desk/table | mesa | ✅ Mar 19 2026 | `vocab_things_mesa.png` — also seeded: escritorio |
| chair | silla | ✅ Mar 19 2026 | `vocab_things_silla.png` |
| door | puerta | ✅ Mar 19 2026 | `vocab_things_puerta.png` |
| window | ventana | ✅ Mar 19 2026 | `vocab_things_ventana.png` |
| phone | teléfono | ✅ | cell_phone in prop library |
| water | agua | ✅ Mar 19 2026 | `vocab_things_agua.png` |

**Things — Food Basics**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| bread | pan | ✅ | bread_basket in prop library |
| milk | leche | ✅ Mar 19 2026 | `vocab_food_leche.png` |
| apple | manzana | ✅ | in prop library |
| banana | plátano/banana | ✅ | in prop library |
| egg | huevo | ✅ Mar 19 2026 | `vocab_food_huevo.png` |
| rice | arroz | ✅ Mar 19 2026 | `vocab_food_arroz.png` |
| coffee | café | ✅ | in prop library (multiple) |
| water | agua | ✅ | glass in prop library |

**Colors**

*Format: filled color swatch circle with the Spanish word below. Simple, flat, unambiguous — no illustrated object needed. A red swatch IS the concept.*

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| red | rojo | ✅ Mar 19 2026 | `vocab_color_rojo.png` |
| blue | azul | ✅ Mar 19 2026 | `vocab_color_azul.png` |
| yellow | amarillo | ✅ Mar 19 2026 | `vocab_color_amarillo.png` |
| green | verde | ✅ Mar 19 2026 | `vocab_color_verde.png` |
| orange | anaranjado/naranja | ✅ Mar 19 2026 | `vocab_color_anaranjado.png` — dual keys: anaranjado + naranja_color |
| purple | morado/violeta | ✅ Mar 19 2026 | `vocab_color_morado.png` — dual keys: morado (Latin Am.) + violeta (Spain) |
| pink | rosa/rosado | ✅ Mar 19 2026 | `vocab_color_rosa.png` — dual keys: rosa + rosado |
| brown | marrón/café | ✅ Mar 19 2026 | `vocab_color_marron.png` — dual keys: marron + cafe_color |
| black | negro | ✅ Mar 19 2026 | `vocab_color_negro.png` |
| white | blanco | ✅ Mar 19 2026 | `vocab_color_blanco.png` |
| grey | gris | ✅ Mar 19 2026 | `vocab_color_gris.png` |

**Adjectives — Size & Temperature (Novice Low)**

*Format: contrast pairs on one card — same object shown twice at different sizes, or two objects with contrasting temperatures. The pair format makes the meaning unambiguous without needing a sentence.*

| Pair | Spanish | Status | Notes |
|------|---------|--------|-------|
| big / small | grande / pequeño | ✅ Mar 19 2026 | `vocab_adj_grande_pequeno.png` — elephant vs mouse; dual keys |
| hot / cold | caliente / frío | ✅ Mar 19 2026 | `vocab_adj_caliente_frio.png` — steaming cup vs iced glass; dual keys |
| good / bad | bueno / malo | ✅ Mar 19 2026 | `vocab_adj_bueno_malo.png` — thumbs up vs down; dual keys |
| open / closed | abierto / cerrado | ✅ Mar 19 2026 | `vocab_adj_abierto_cerrado.png` — door both ways; dual keys |
| full / empty | lleno / vacío | ✅ Mar 19 2026 | `vocab_adj_lleno_vacio.png` — full vs empty glass; dual keys |
| clean / dirty | limpio / sucio | ✅ Mar 19 2026 | `vocab_adj_limpio_sucio.png` — clean plate vs muddy boot; dual keys |
| new / old | nuevo / viejo | ✅ Mar 19 2026 | `vocab_adj_nuevo_viejo.png` — shiny sneaker vs worn shoe; dual keys |

**Activities (simple verbs — illustrated as action)**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| to eat | comer | ✅ Mar 19 2026 | `vocab_act_comer.png` |
| to drink | beber | ✅ Mar 19 2026 | `vocab_act_beber.png` — dual keys: beber + tomar |
| to sleep | dormir | ✅ Mar 19 2026 | `vocab_act_dormir.png` |
| to read | leer | ✅ Mar 19 2026 | `vocab_act_leer.png` |
| to write | escribir | ✅ Mar 19 2026 | `vocab_act_escribir.png` |
| to walk | caminar | ✅ Mar 19 2026 | `vocab_act_caminar.png` |
| to run | correr | ✅ Mar 19 2026 | `vocab_act_correr.png` |
| to talk | hablar | ✅ Mar 19 2026 | `vocab_act_hablar.png` |
| to listen | escuchar | ✅ Mar 19 2026 | `vocab_act_escuchar.png` — dual keys: escuchar + oír |
| to play | jugar | ✅ Mar 19 2026 | `vocab_act_jugar.png` |

---

### Novice Mid — Building Blocks

**People (extended family + community)**

*Strategy: family members paired as dual-key images (same approach as Novice Low). Community helpers shown in full professional context — the setting carries the meaning. Bonus extended family gathering scene for multi-word teaching.*

| Image | Covers | Spanish | Status | Notes |
|-------|--------|---------|--------|-------|
| Abuelos (pair) | grandfather, grandmother | abuelo, abuela | ✅ Mar 19 2026 | `vocab_ppl_abuelos.png` — dual keys: abuelo + abuela |
| Tíos (pair) | uncle, aunt | tío, tía | ✅ Mar 19 2026 | `vocab_ppl_tios.png` — dual keys: tío + tía |
| Primos (pair) | cousin m/f | primo, prima | ✅ Mar 19 2026 | `vocab_ppl_primos.png` — dual keys: primo + prima |
| Médico/a | doctor | médico/a | ✅ Mar 19 2026 | `vocab_ppl_medico.png` — in clinic; also seeded: médica, doctor |
| Enfermero/a | nurse | enfermero/a | ✅ Mar 19 2026 | `vocab_ppl_enfermero.png` — in hospital; dual keys: enfermero + enfermera |
| Policía | police officer | policía | ✅ Mar 19 2026 | `vocab_ppl_policia.png` — in uniform on city street |
| Cocinero/a | cook / chef | cocinero/a | ✅ Mar 19 2026 | `vocab_ppl_cocinero.png` — in kitchen with chef's hat; dual keys |
| Bombero/a | firefighter | bombero/a | ✅ Mar 19 2026 | `vocab_ppl_bombero.png` — by fire truck in full gear; dual keys |
| Dentista | dentist | dentista | ✅ Mar 19 2026 | `vocab_ppl_dentista.png` — in dental office |
| Familia extendida (scene) | extended family gathering | abuelo, abuela, tío, tía, primo, prima + more | ✅ Mar 19 2026 | `vocab_ppl_familia_extendida.png` — multi-chip scene; key: vocab_spanish_familia_extendida |
| Vecino/a | neighbor | vecino/a | ✅ Mar 19 2026 | `vocab_ppl_vecino.png` — dual keys: vecino + vecina |

**Animals**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| dog | perro | ✅ Mar 19 2026 | `vocab_animal_perro.png` |
| cat | gato | ✅ Mar 19 2026 | `vocab_animal_gato.png` |
| bird | pájaro | ✅ Mar 19 2026 | `vocab_animal_pajaro.png` — key: pajaro |
| fish | pez | ✅ Mar 19 2026 | `vocab_animal_pez.png` — in water; also seeded: pescado |
| horse | caballo | ✅ Mar 19 2026 | `vocab_animal_caballo.png` |
| cow | vaca | ✅ Mar 19 2026 | `vocab_animal_vaca.png` |
| sheep | oveja | ✅ Mar 19 2026 | `vocab_animal_oveja.png` |
| bear | oso | ✅ Mar 19 2026 | `vocab_animal_oso.png` |
| duck | pato | ✅ Mar 19 2026 | `vocab_animal_pato.png` |
| rabbit | conejo | ✅ Mar 19 2026 | `vocab_animal_conejo.png` |

**Fruits & Vegetables**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| orange | naranja | ✅ Mar 19 2026 | `vocab_food_naranja.png` |
| strawberry | fresa | ✅ Mar 19 2026 | `vocab_food_fresa.png` — key: fresa |
| grape | uva | ✅ Mar 19 2026 | `vocab_food_uva.png` — cluster |
| watermelon | sandía | ✅ Mar 19 2026 | `vocab_food_sandia.png` — key: sandia |
| lemon | limón | ✅ Mar 19 2026 | `vocab_food_limon.png` — key: limon |
| tomato | tomate | ✅ Mar 19 2026 | `vocab_food_tomate.png` |
| carrot | zanahoria | ✅ Mar 19 2026 | `vocab_food_zanahoria.png` |
| lettuce | lechuga | ✅ Mar 19 2026 | `vocab_food_lechuga.png` |
| potato | papa/patata | ✅ Mar 19 2026 | `vocab_food_papa.png` — dual keys: papa + patata |
| onion | cebolla | ✅ Mar 19 2026 | `vocab_food_cebolla.png` |
| garlic | ajo | ✅ Mar 19 2026 | `vocab_food_ajo.png` |
| corn | maíz | ✅ Mar 19 2026 | `vocab_food_maiz.png` — key: maiz |

**Clothing**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| shirt | camisa | ✅ Mar 19 2026 | `vocab_cloth_camisa.png` |
| pants/trousers | pantalón | ✅ Mar 19 2026 | `vocab_cloth_pantalon.png` — key: pantalon |
| dress | vestido | ✅ Mar 19 2026 | `vocab_cloth_vestido.png` |
| shoes | zapatos | ✅ Mar 19 2026 | `vocab_cloth_zapatos.png` — pair |
| hat | sombrero | ✅ Mar 19 2026 | `vocab_cloth_sombrero.png` |
| jacket | chaqueta | ✅ Mar 19 2026 | `vocab_cloth_chaqueta.png` |
| socks | calcetines | ✅ Mar 19 2026 | `vocab_cloth_calcetines.png` |
| skirt | falda | ✅ Mar 19 2026 | `vocab_cloth_falda.png` |

**Activities**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| to buy | comprar | ✅ Mar 19 2026 | `vocab_act_comprar.png` |
| to pay | pagar | ✅ Mar 19 2026 | `vocab_act_pagar.png` |
| to cook | cocinar | ✅ Mar 19 2026 | `vocab_act_cocinar.png` |
| to clean | limpiar | ✅ Mar 19 2026 | `vocab_act_limpiar.png` |
| to swim | nadar | ✅ Mar 19 2026 | `vocab_act_nadar.png` |
| to dance | bailar | ✅ Mar 19 2026 | `vocab_act_bailar.png` — v=5 style fix |
| to sing | cantar | ✅ Mar 19 2026 | `vocab_act_cantar.png` — v=5 style fix |
| to paint | pintar | ✅ Mar 19 2026 | `vocab_act_pintar.png` |

**Adjectives — Spatial & Descriptive (Novice Mid)**

*Format: contrast pairs. Near/far use distance from a reference point (a door, a tree). Tall/short use two versions of the same figure. Fast/slow use motion blur or trail lines.*

| Pair | Spanish | Status | Notes |
|------|---------|--------|-------|
| near / far | cerca / lejos | ✅ Mar 19 2026 | `vocab_adj_cerca_lejos.png` — dual keys |
| tall / short | alto / bajo | ✅ Mar 19 2026 | `vocab_adj_alto_bajo.png` — dual keys |
| fast / slow | rápido / lento | ✅ Mar 19 2026 | `vocab_adj_rapido_lento.png` — dual keys |
| heavy / light | pesado / ligero | ✅ Mar 19 2026 | `vocab_adj_pesado_ligero.png` — dual keys |
| young / old | joven / viejo | ✅ Mar 19 2026 | `vocab_adj_joven_viejo_personas.png` — dual keys (person-focused) |
| happy / sad | feliz / triste | ✅ Mar 19 2026 | `vocab_adj_feliz_triste.png` — v=5 style fix; dual keys |
| easy / difficult | fácil / difícil | ✅ Mar 19 2026 | `vocab_adj_facil_dificil.png` — dual keys |
| loud / quiet | ruidoso / tranquilo | ✅ Mar 19 2026 | `vocab_adj_ruidoso_tranquilo.png` — dual keys |
| dark / light | oscuro / claro | ✅ Mar 19 2026 | `vocab_adj_oscuro_claro.png` — dual keys |
| hard / soft | duro / suave | ✅ Mar 19 2026 | `vocab_adj_duro_suave.png` — v=5 style fix; dual keys |

---

### Novice High — Travel & Social Life

**Places (travel)**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| hotel | hotel | ✅ Mar 19 2026 | `vocab_place_hotel.png` |
| airport | aeropuerto | ✅ Mar 19 2026 | `vocab_place_aeropuerto.png` |
| train station | estación de tren | ✅ Mar 19 2026 | `vocab_place_estacion_tren.png` — keys: estacion_tren + estacion |
| beach | playa | ✅ Mar 19 2026 | `vocab_place_playa.png` |
| mountain | montaña | ✅ Mar 19 2026 | `vocab_place_montana.png` — keys: montana + montaña |
| museum | museo | ✅ Mar 19 2026 | `vocab_place_museo.png` |
| pharmacy | farmacia | ✅ Mar 19 2026 | `vocab_place_farmacia.png` |
| bank | banco | ✅ Mar 19 2026 | `vocab_place_banco.png` |
| library | biblioteca | ✅ Mar 19 2026 | `vocab_place_biblioteca.png` |

**Transportation**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| bus | autobús | ✅ Mar 19 2026 | `vocab_trans_autobus.png` — keys: autobus + autobús |
| train | tren | ✅ Mar 19 2026 | `vocab_trans_tren.png` |
| airplane | avión | ✅ Mar 19 2026 | `vocab_trans_avion.png` — keys: avion + avión |
| bicycle | bicicleta | ✅ Mar 19 2026 | `vocab_trans_bicicleta.png` |
| car | coche/carro | ✅ Mar 19 2026 | `vocab_trans_coche.png` — keys: coche + carro + auto |
| boat | barco | ✅ Mar 19 2026 | `vocab_trans_barco.png` |
| taxi | taxi | ✅ Mar 19 2026 | `vocab_trans_taxi.png` |
| subway/metro | metro | ✅ Mar 19 2026 | `vocab_trans_metro.png` — keys: metro + subte |
| motorcycle | motocicleta | ✅ Mar 19 2026 | `vocab_trans_motocicleta.png` — keys: motocicleta + moto |
| walking (on foot) | a pie | ✅ Mar 19 2026 | `vocab_trans_a_pie.png` — keys: a_pie + caminar |

**Professions**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| waiter/waitress | camarero/a | ✅ Mar 19 2026 | `vocab_prof_camarero.png` — keys: camarero + camarera + mesero |
| shop clerk | dependiente/a | ✅ Mar 19 2026 | `vocab_prof_dependiente.png` — keys: dependiente + dependienta |
| firefighter | bombero/a | ✅ Mar 19 2026 | Moved up to Novice Mid — `vocab_ppl_bombero.png` |
| journalist | periodista | ✅ Mar 19 2026 | `vocab_prof_periodista.png` |
| lawyer | abogado/a | ✅ Mar 19 2026 | `vocab_prof_abogado.png` — keys: abogado + abogada |

---

### Intermediate Low — Daily Life & Body

**Body Parts**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| head | cabeza | ✅ Mar 19 2026 | `vocab_body_diagram.png` — all body terms seeded to this one diagram |
| arm | brazo | ✅ Mar 19 2026 | → body diagram |
| leg | pierna | ✅ Mar 19 2026 | → body diagram |
| hand | mano | ✅ Mar 19 2026 | → body diagram |
| foot | pie | ✅ Mar 19 2026 | → body diagram |
| eye | ojo | ✅ Mar 19 2026 | → body diagram |
| ear | oído/oreja | ✅ Mar 19 2026 | → body diagram — dual keys: oido + oreja |
| mouth | boca | ✅ Mar 19 2026 | → body diagram |
| nose | nariz | ✅ Mar 19 2026 | → body diagram |
| heart | corazón | ✅ Mar 19 2026 | → body diagram — key: corazon |
| stomach | estómago | ✅ Mar 19 2026 | → body diagram — key: estomago |
| back | espalda | ✅ Mar 19 2026 | → body diagram |
| knee | rodilla | ✅ Mar 19 2026 | → body diagram |
| shoulder | hombro | ✅ Mar 19 2026 | → body diagram |

*Note: Body diagram image (full outline labeled in Spanish) — 1 image seeded under cuerpo + all 14 body part keys.*

**Health**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| pill/tablet | pastilla | ✅ Mar 19 2026 | `vocab_health_pastilla.png` — also: tableta, comprimido |
| injection/shot | inyección | ✅ Mar 19 2026 | `vocab_health_inyeccion.png` — also: vacuna, jeringa |
| prescription | receta médica | ✅ | prescription_pad in prop library |
| thermometer | termómetro | ✅ | in prop library |
| bandage | venda | ✅ Mar 19 2026 | `vocab_health_venda.png` — also: vendaje, curita |
| appointment | cita médica | ✅ Mar 19 2026 | `vocab_health_cita_medica.png` — also: cita, consulta |

**Home Rooms & Furniture**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| living room | sala de estar | ✅ | env background in prop library |
| kitchen | cocina | ✅ | env background in prop library |
| bedroom | dormitorio | ✅ | env background in prop library |
| bathroom | baño | ✅ | env background in prop library |
| garden/yard | jardín | ✅ Mar 19 2026 | `vocab_home_jardin.png` — also: patio |
| bed | cama | ✅ Mar 19 2026 | `vocab_home_cama.png` |
| sofa | sofá | ✅ Mar 19 2026 | `vocab_home_sofa.png` — also: divan, canapé |
| wardrobe | armario | ✅ Mar 19 2026 | `vocab_home_armario.png` — also: closet, guardarropa |
| refrigerator | refrigerador | ✅ Mar 19 2026 | `vocab_home_refrigerador.png` — also: nevera, frigorifico, heladera |
| stove | estufa/cocina | ✅ Mar 19 2026 | `vocab_home_estufa.png` — also: hornilla |
| washing machine | lavadora | ✅ Mar 19 2026 | `vocab_home_lavadora.png` — also: lavarropas |

---

### Intermediate Mid — Broader World

**Nature & Environment**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| tree | árbol | ✅ Mar 19 2026 | `vocab_nature_arbol.png` |
| flower | flor | ✅ Mar 19 2026 | `vocab_nature_flor.png` |
| river | río | ✅ Mar 19 2026 | `vocab_nature_rio.png` |
| lake | lago | ✅ Mar 19 2026 | `vocab_nature_lago.png` |
| sea | mar | ✅ Mar 19 2026 | `vocab_nature_mar.png` — also: oceano |
| forest | bosque | ✅ Mar 19 2026 | `vocab_nature_bosque.png` — also: selva |
| desert | desierto | ✅ Mar 19 2026 | `vocab_nature_desierto.png` |
| volcano | volcán | ✅ Mar 19 2026 | `vocab_nature_volcan.png` |
| cloud | nube | ✅ Mar 19 2026 | `vocab_nature_nube.png` — weather section also |
| sun | sol | ✅ Mar 19 2026 | `vocab_nature_sol.png` |
| moon | luna | ✅ Mar 19 2026 | `vocab_nature_luna.png` |
| star | estrella | ✅ Mar 19 2026 | `vocab_nature_estrella.png` |

**Emotions**

| Word | Spanish | Status | Notes |
|------|---------|--------|-------|
| happy | feliz/alegre | ✅ Mar 19 2026 | `vocab_adj_feliz_triste.png` — dual keys (paired with sad) |
| sad | triste | ✅ Mar 19 2026 | → feliz/triste pair image |
| angry | enojado/enfadado | ✅ Mar 19 2026 | `vocab_emo_enojado.png` — also: enfadado, molesto |
| afraid | asustado | ✅ Mar 19 2026 | `vocab_emo_asustado.png` — also: atemorizado |
| surprised | sorprendido | ✅ Mar 19 2026 | `vocab_emo_sorprendido.png` — also: asombrado |
| embarrassed | avergonzado | ✅ Mar 19 2026 | `vocab_emo_avergonzado.png` — NOT embarazada (false cognate) |
| tired | cansado | ✅ Mar 19 2026 | `vocab_emo_cansado.png` — also: agotado |
| excited | emocionado | ✅ Mar 19 2026 | `vocab_emo_emocionado.png` — also: entusiasmado |
| nervous | nervioso | ✅ Mar 19 2026 | `vocab_emo_nervioso.png` — also: ansioso |
| bored | aburrido | ✅ Mar 19 2026 | `vocab_emo_aburrido.png` — also: aburrimiento |

**Abstract Concepts (Intermediate+)**

These are better served by grammar/concept diagrams than simple images. See Section 3.

---

### Intermediate High & Advanced — Targeted Supplements

At these levels, personal vocabulary diverges significantly. Visual pre-generation is less valuable. Focus effort here on:
- **False cognate warning cards** (Section 7)
- **Word family maps** for high-frequency roots (Section 6)
- **Cultural infographics** for advanced thematic topics (Section 5)

---

## Section 2 — Numbers, Time & Weather

These are cross-ACTFL. A Novice Low student needs numbers 1–10. An Advanced student still references the calendar. These assets are used at every level and should be among the first generated.

### Numbers

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| 0–10 illustrated cards | Each numeral with illustrated objects (3 apples, 7 stars) | Novice Low | ✅ Mar 19 2026 | `vocab_num_0_10.png` — 12 cache keys (cero → diez) |
| 11–20 pattern card | Illustrated grouping showing the 11–19 pattern (diez + ...) | Novice Low | ✅ Mar 19 2026 | `vocab_num_11_20.png` — 11 cache keys (once → veinte) |
| Tens 10–100 grid | Visual grid: 10, 20, 30... 100 with pattern highlight | Novice Mid | ✅ Mar 19 2026 | `vocab_num_tens.png` — 10 cache keys (veinte → cien) |
| Hundreds & thousands | Scale card: 100, 500, 1,000, 10,000, 1,000,000 with real-world size anchors | Novice High | ✅ Mar 19 2026 | `vocab_num_hundreds.png` — keys: cien, quinientos, mil, millon |
| Ordinals 1st–10th | primero, segundo... with illustrated podium/ranking | Novice Mid | ✅ Mar 19 2026 | `vocab_num_ordinals.png` — keys: primero → quinto |
| Phone/address number reading | Illustrated guide to how numbers appear in real-life context (phone numbers said in pairs) | Intermediate Low | ✅ Mar 19 2026 | `vocab_num_phone.png` — keys: numero_telefono, direccion |
| Price & currency visual | Price tags in different currencies (pesos, soles, euros) with "¿Cuánto cuesta?" | Novice High | ✅ Mar 19 2026 | `vocab_num_currency.png` — keys: precio, cuanto_cuesta, peso, euro |

### Time

> **Note (March 17 2026):** The interactive SVG analog clock (`set_clock`) is fully built in `SceneCanvas`. For lesson interactions, Daniela uses the live clock — no static image needed. The static reference cards below are for the textbook/reference view and are lower priority as a result.

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Analog clock face — hour | Static reference card — live clock handles lesson use | Novice Low | ⬜ lower priority |
| Analog clock face — half/quarter | Static reference card | Novice Mid | ⬜ lower priority |
| Clock face — full grid | 12 clocks on one reference card | Novice Mid | ⬜ lower priority |
| AM/PM scene strip | Morning → afternoon → evening → night with time expressions | Novice Low | ✅ Mar 19 2026 | `vocab_time_partes_dia.png` — keys: manana, tarde, noche |
| Days of the week card | lunes → domingo visual strip (Mon-start calendar format) | Novice Low | ✅ Mar 19 2026 | `vocab_time_dias_semana.png` — all 7 days seeded |
| Months of the year card | enero → diciembre in circular calendar format | Novice Low | ✅ Mar 19 2026 | `vocab_time_meses.png` — all 12 months seeded |
| Four seasons illustrated | primavera, verano, otoño, invierno — each as a mini landscape scene | Novice Mid | ✅ Mar 19 2026 | `vocab_time_estaciones.png` — all 4 seasons seeded |
| Duration expressions timeline | hace dos años, desde hace, hace + time — horizontal timeline diagram | Intermediate Low | ⬜ React component — see Section 3 |
| Daily routine timeline | levantarse → desayunar → ... → acostarse shown as timeline with clock icons | Intermediate Low | ✅ Mar 19 2026 | `vocab_time_rutina_diaria.png` — 7 daily routine keys seeded |
| Tense timeline overview | past ←—— present ——→ future with verb tense markers | Intermediate Low | ⬜ React component — see Section 3 |

### Weather

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Sunny / soleado | Illustrated weather icon — warm scene | Novice Low | ✅ Mar 19 2026 | `vocab_weather_soleado.png` — keys: soleado, sol_tiempo |
| Cloudy / nublado | Illustrated | Novice Low | ✅ Mar 19 2026 | `vocab_weather_nublado.png` |
| Rainy / lluvioso | Illustrated — rain falling | Novice Low | ✅ Mar 19 2026 | `vocab_weather_lluvioso.png` — also: lluvia |
| Snowy / nevado | Illustrated | Novice Low | ✅ Mar 19 2026 | `vocab_weather_nevado.png` — also: nieve |
| Stormy / tormentoso | Lightning + dark clouds | Novice Mid | ✅ Mar 19 2026 | `vocab_weather_tormentoso.png` — also: tormenta |
| Windy / ventoso | Illustrated — leaves blowing | Novice Mid | ✅ Mar 19 2026 | `vocab_weather_ventoso.png` — also: viento |
| Foggy / neblinoso | Illustrated | Novice Mid | ✅ Mar 19 2026 | `vocab_weather_neblinoso.png` — also: niebla, neblina |
| Hot / caluroso | Illustrated — sun + person sweating | Novice Low | ✅ Mar 19 2026 | `vocab_weather_caluroso.png` — also: calor |
| Cold / frío | Illustrated — person in coat, breath visible | Novice Low | ✅ Mar 19 2026 | `vocab_weather_frio.png` — keys: frio_tiempo, frio_clima |
| Weather forecast card | Full illustrated forecast showing icons + temperature + day of week (como en la tele) | Novice High | ✅ Mar 19 2026 | `vocab_weather_forecast_card.png` — keys: pronostico, tiempo_semana |
| Temperature scale | Celsius + Fahrenheit comparison — common confusion for English-speaking learners | Novice High | ✅ Mar 19 2026 | `vocab_weather_temperature_scale.png` — keys: temperatura, celsius, grados |
| ¿Qué tiempo hace? reference card | All weather expressions on one card with their corresponding images | Novice Mid | ⬜ React component — see Section 3 |

---

## Section 3 — Grammar Structure Cards

These are diagrams, not photos. Generated as code (SVG or React components) — not DALL-E images. They live in `TextbookInfographics.tsx` or as dedicated reference card components.

### Verb Conjugation Tables

> **Note (March 18 2026):** The **live interactive conjugation canvas** (`init_conjugation` / `fill_conjugation` / `clear_conjugation`) is ✅ fully built — Daniela uses it in real-time during lessons. The items below are static **textbook reference cards** (pre-generated, always visible in the textbook without Daniela). These are separate deliverables and still ⬜.

| Asset | ACTFL Level | Format | Status |
|-------|-------------|--------|--------|
| Regular -AR pattern (hablar) | Novice Low | table with pronouns + endings highlighted | ✅ Mar 19 2026 | `ArVerbsCard` in TextbookGrammarDiagrams.tsx — trigger: "-ar verb", "hablar" |
| Regular -ER pattern (comer) | Novice Low | table | ✅ Mar 19 2026 | `ErVerbsCard` |
| Regular -IR pattern (vivir) | Novice Low | table | ✅ Mar 19 2026 | `IrVerbsCard` |
| SER (full present) | Novice Low | table — with usage examples | ✅ Mar 19 2026 | `SerCard` |
| ESTAR (full present) | Novice Low | table — with usage examples | ✅ Mar 19 2026 | `EstarCard` |
| TENER (full present) | Novice Low | table + tener expressions | ✅ Mar 19 2026 | `TenerCard` |
| IR (full present) | Novice Low | table + ir + a + infinitive | ✅ Mar 19 2026 | `IrCard` |
| QUERER / PODER / VOLVER | Novice Mid | stem-change boot diagram + tables | ✅ Mar 19 2026 | `StemChangeCard` with SVG boot diagram |
| HACER / PONER / TRAER | Novice Mid | go-verb pattern | ✅ Mar 19 2026 | `GoVerbsCard` with full –go inventory |
| SABER vs CONOCER | Novice High | split table with usage contrast | ✅ Mar 19 2026 | `SaberConocerCard` |
| Reflexive verbs (ducharse) | Intermediate Low | pronoun placement diagram | ✅ Mar 19 2026 | `ReflexiveVerbCard` with placement rules |
| Preterite regular (-ar/-er/-ir) | Intermediate Low | table | ✅ Mar 19 2026 | `PretRegularCard` |
| Preterite irregular (ser/ir/tener/hacer) | Intermediate Low | grouped table | ✅ Mar 19 2026 | `PretIrregularCard` |
| Imperfect (-ar/-er/-ir) | Intermediate Low | table | ✅ Mar 19 2026 | `ImperfectCard` |
| Future (regular + irregular stems) | Intermediate Mid | table with irregulars highlighted | ✅ Mar 19 2026 | `FutureCard` |
| Conditional | Intermediate Mid | table | ✅ Mar 19 2026 | `ConditionalCard` |
| Present subjunctive | Intermediate High | table with trigger phrases | ✅ Mar 19 2026 | `SubjunctiveCard` |
| Commands (tú / usted / ustedes) | Intermediate Mid | table | ✅ Mar 19 2026 | `CommandsCard` |

### Decision Trees & Comparison Cards

| Asset | ACTFL Level | Status |
|-------|-------------|--------|
| SER vs ESTAR decision tree | Novice Low — Novice Mid | ✅ Built Mar 18 2026 — `SerEstarCard` in TextbookInfographics.tsx |
| Preterite vs Imperfect contrast diagram | Intermediate Low | ✅ Built Mar 18 2026 — `PretImperfectCard` in TextbookInfographics.tsx |
| Por vs Para decision tree | Intermediate Mid | ✅ Built Mar 18 2026 — `PorParaCard` in TextbookInfographics.tsx |
| Indicative vs Subjunctive trigger map | Intermediate High | ⬜ future — covered partially by SubjunctiveCard trigger phrases |
| Direct vs Indirect object pronoun chart | Intermediate Low | ✅ Mar 19 2026 | `ObjectPronounChart` — full DO/IO table with placement rules |
| Object pronoun placement diagram | Intermediate Low | ✅ Mar 19 2026 | included in `ObjectPronounChart` |
| Gender & article overview (el/la/un/una) | Novice Low | ✅ Mar 19 2026 | `GenderArticleCard` — rules, examples, plural forms |
| Adjective agreement diagram | Novice Mid | ✅ Mar 19 2026 | `AdjAgreeCard` — m/f × s/pl grid + placement rules |
| Stem-change verb visual (e→ie, o→ue, e→i) | Novice High | ✅ Mar 19 2026 | `StemChangeCard` — SVG boot diagram + 2 full tables |
| -GO verbs pattern card | Novice High | ✅ Mar 19 2026 | `GoVerbsCard` — 8 –go verbs with yo forms |
| Diminutives & augmentatives | Intermediate Mid | ⬜ future |

### Sentence Structure Diagrams

| Asset | ACTFL Level | Status |
|-------|-------------|--------|
| Basic SVO sentence structure | Novice Low | ✅ Mar 19 2026 | `NegationQuestionsCard` — SVO + negation + 9 question words |
| Adjective placement rules | Novice Mid | ✅ Mar 19 2026 | included in `AdjAgreeCard` |
| Negative sentence construction | Novice Low | ✅ Mar 19 2026 | included in `NegationQuestionsCard` — no/nada/nadie/nunca |
| Question formation (¿Cómo/Qué/Dónde/Cuándo/Por qué?) | Novice Low | ✅ Mar 19 2026 | included in `NegationQuestionsCard` |
| Tú vs Usted — register chart | Novice Mid | ✅ Mar 19 2026 | `TuUstedCard` — contexts, examples, regional note |

---

## Section 4 — Preposition Maps

Two formats needed: a **static reference card** showing all prepositions at once, and **dynamic compositing** (already handled by the prop room compositor for spatial prepositions in lessons).

### Spatial Prepositions

| Asset | Description | Status |
|-------|-------------|--------|
| Full spatial preposition map | Overhead/isometric room view with arrows and labels for: en, sobre, debajo de, delante de, detrás de, al lado de, entre, cerca de, lejos de, dentro de, fuera de, encima de | ✅ Mar 19 2026 | `SpatialPrepositionMap` — SVG room diagram + 9-cell reference grid |
| Simplified 6-preposition card | Just the six most confused ones (sobre/en/encima de, debajo de, delante de, detrás de) with clear illustrations | ✅ Mar 19 2026 | combined into `SpatialPrepositionMap` |

*Note: Dynamic compositing via `compose_visual_scene` (Mode B) handles on/under/beside in real lessons. These static cards are for reference and textbook.*

### Motion & Direction Prepositions

| Asset | Description | Status |
|-------|-------------|--------|
| Motion preposition diagram | Map-style graphic showing: a (destination), hacia (toward), desde (from), hasta (as far as), por (through/along), para (toward/for) with arrows on streets/paths | ⬜ future |

### Temporal Prepositions

| Asset | Description | Status |
|-------|-------------|--------|
| Temporal preposition timeline | Horizontal timeline showing: antes de, después de, durante, desde, hasta, hace + time — all placed on the timeline relative to "now" | ✅ Mar 19 2026 | `TemporalPrepositionTimeline` — SVG timeline + 6-entry reference |

---

## Section 5 — Cultural Infographics

These give language its context — students learn words in isolation without these.

> **Status: ✅ Complete (Mar 19 2026)** — All 9 built as React/SVG components in `TextbookCulturalCards.tsx`. Food guide (5 regions, 24 dishes) and gesture card (cultural awareness framing, 3 safe recognition gestures, regional variation warning) built without image generation — consistent with all other Section 5 cards.

| Asset | Description | ACTFL Level | Status |
|-------|-------------|-------------|--------|
| Spanish-speaking world map | 21 Spanish-speaking countries labeled with capitals and flags | Novice Mid | ✅ `SpanishWorldMapCard` |
| Hispanic food guide | Regional dishes by country/region — 5 zones, 24 dishes | Intermediate Low | ✅ `HispanicFoodGuideCard` |
| Festival & holiday calendar | Major celebrations across Spanish-speaking world by month | Intermediate Low | ✅ `FestivalCalendarCard` |
| Tú vs Usted register guide | When to use which — illustrated social situations | Novice Mid | ✅ `TuUstedCard` (Section 3) |
| Gesture guide | Cultural awareness card — body language variation + 3 safe recognition gestures | Intermediate Low | ✅ `GestureAwarenessCard` |
| Currency overview | Pesos (MX, AR, CL, CO, CU, DO, PH), Soles, Euros, Bolívares, Colones — with approximate exchange anchor | Novice High | ✅ `CurrencyReferenceCard` |
| Spanish dialect map | Spain, Mexico, Caribbean, Andean, River Plate, Central American — key vocabulary/pronunciation differences | Intermediate Mid | ✅ `DialectMapCard` |
| Family structure diagram | Visual family tree with all relationship terms labeled | Novice Mid | ✅ `FamilyTreeCard` |
| Formal greetings by country | Handshake, cheek kiss, both — illustrated regional etiquette | Novice High | ✅ `GreetingEtiquetteCard` |

---

## Section 6 — Word Family Maps

Visual clusters connecting a root verb to its noun, adjective, and adverb forms. These are especially powerful at Intermediate+ where students start using words productively across contexts.

> **Status: ✅ Complete (Mar 19 2026)** — All 12 word families built in `TextbookWordFamilies.tsx`. One reusable `WordFamilyCard` component with hub-and-spoke SVG layout + `resolveWordFamilyRoot()` resolver picks the correct family from the chapter title.

| Root | Family members | ACTFL Level | Status |
|------|---------------|-------------|--------|
| hablar | habla, hablante, hablador/a, hablado | Novice Low | ✅ |
| comer | comida, comedor, comestible, comilón | Novice Low | ✅ |
| vivir | vida, viviente, vivienda, vivo/a | Novice Low | ✅ |
| trabajar | trabajo, trabajador/a, trabajable | Novice Low | ✅ |
| dormir | sueño, dormilón, dormitorio | Novice Mid | ✅ |
| viajar | viaje, viajero/a | Novice High | ✅ |
| amar | amor, amante, amado/a, amoroso/a | Novice Mid | ✅ |
| escribir | escritura, escritor/a, escrito | Novice Mid | ✅ |
| leer | lectura, lector/a, leído | Novice Mid | ✅ |
| conocer | conocimiento, conocido/a, desconocer | Novice High | ✅ |
| poder | poder (n), poderoso/a, poderío | Intermediate Low | ✅ |
| pensar | pensamiento, pensador/a, pensativo/a | Intermediate Low | ✅ |

*Format: hub-and-spoke SVG with root verb at center; branches colour-coded — verb=blue, noun=orange, adjective=green, adverb=purple.*

---

## Section 7 — False Cognate Warning Cards

These are high-impact because they prevent actual embarrassing mistakes. Single card format: English word → wrong Spanish assumption → correct Spanish word → correct usage of the look-alike.

> **Two separate deliverables — same distinction as Section 3:**
> - **Static textbook cards** (`FalseCognateCard` / `FalseCognatesGrid` in `TextbookInfographics.tsx`) — ✅ Built Mar 18 2026. Auto-detected by `classifyGrammarType()` and rendered in `ChapterIntroduction.tsx`.
> - **Dynamic Daniela tool** (e.g. `highlight_false_cognate` — surface a warning card mid-lesson when Daniela detects a student is about to use a false cognate) — ⬜ Not yet built. Separate future feature.

| English | Wrong assumption | Actual Spanish | Look-alike | Look-alike means | Status |
|---------|-----------------|----------------|-----------|-----------------|--------|
| embarrassed | embarazada | avergonzado/a | embarazada | pregnant | ✅ |
| sensible | sensible | sensato/a | sensible | sensitive | ✅ |
| to realize | realizar | darse cuenta de | realizar | to accomplish/carry out | ✅ |
| actual | actual | real, verdadero | actual | current, present-day | ✅ |
| exit | éxito | salida | éxito | success | ✅ |
| library | librería | biblioteca | librería | bookstore | ✅ |
| to assist | asistir | ayudar | asistir | to attend | ✅ |
| to introduce | introducir | presentar | introducir | to insert | ✅ |
| carpet | carpeta | alfombra | carpeta | folder/binder | ✅ |
| constipated | constipado | estreñido | constipado | having a cold | ✅ |
| to molest | molestar | acosar | molestar | to bother/annoy | ✅ |
| parents | parientes | padres | parientes | relatives | ✅ |

---

## Section 8 — Phonetic / Pronunciation Guides

Visual mouth-position or phoneme guides for sounds that don't exist in English. These are especially valuable for student self-study between sessions.

> **Status: ✅ Complete (Mar 19 2026)** — All 9 phonetic guide cards built in `TextbookPhoneticGuides.tsx`. Each is a self-contained React component with IPA notation, production notes, examples, and English contrast. Auto-triggered by chapter title via `classifyGrammarType()`.

| Asset | Description | ACTFL Entry Point | Status |
|-------|-------------|-------------------|--------|
| Spanish vowel purity chart | A, E, I, O, U — each shown as single pure sound vs English diphthong equivalent | Novice Low | ✅ `VowelPurityCard` |
| The rolled R (rr) guide | Tongue position illustration + where rr appears (perro, carro, alrededor) | Novice Mid | ✅ `RolledRCard` |
| B vs V in Spanish | Illustrated — both are essentially the same sound; contrast to English | Novice Mid | ✅ `BVSoundCard` |
| The silent H | Simple rule card + illustrated examples (hablar, hola, hotel) | Novice Low | ✅ `SilentHCard` |
| The J sound | Contrast to English H/J — illustrated with throat position | Novice Mid | ✅ `JSoundCard` |
| Ñ pronunciation | How it differs from N — examples (niño, mañana, año) | Novice Low | ✅ `NyenCard` |
| LL/Y regional variation | Map + phoneme guide — ceceo, seseo, ll-vs-y | Intermediate Low | ✅ `LLYCard` |
| Stress rules & accent marks | Visual rule card: where stress falls without accent, when accent is written | Novice High | ✅ `StressAccentCard` |
| Linking sounds (enlace) | How word-final vowel links to word-initial vowel in spoken Spanish | Intermediate Low | ✅ `LinkingSoundsCard` |

---

## Asset Creation Pipeline

### For vocabulary images (Sections 1 & 2 — weather/time illustrated cards)
1. Generate via Gemini Imagen using `generateImage()` with `removeBackground: false` (full illustrated cards)
2. Upload to object storage → insert into `visual_assets` with all 9 language translations
3. Set `object_type` to appropriate category

### For grammar/structure diagrams (Sections 3, 4, 6)
1. Build as React/SVG components in `TextbookInfographics.tsx`
2. Parameterize by language so Spanish tables can adapt to French/German etc.
3. Trigger via infographic detection logic in `TextbookChapterView.tsx`

### For weather icons specifically
- These should also be built as React SVG components (consistent style, infinitely scalable)
- Can double as animated weather conditions in future UI

### For cultural infographics (Section 5)
- Map-based ones → React SVG components (accurate geography)
- Illustration-based ones (food guide, gesture guide) → Gemini Imagen

### For false cognate cards (Section 7)
- These are pure text + simple illustration → React component, not generated images
- One reusable `FalseCognateCard` component taking the data as props

### Batch generation order (revised March 17 2026)

The original order put Numbers and Time at the top. That assumed the clock wasn't built. It is. The live SVG clock handles all lesson-time interactions — static clock reference images are now textbook supplements, not urgent. The order below reflects actual current gaps:

1. **Food menu images (Section 11)** — live feature, ~98% of items have no image, visible to students today. Spanish first, then Japanese, French, Italian in sequence.
2. **Animals (Novice Mid)** — universally loved by learners, language-agnostic images, high Daniela usage
3. **Novice Low core vocabulary** — people, basic objects, food staples not yet in the prop library (bread, milk, egg, rice)
4. **Fruits & vegetables (Novice Mid)** — visually clear-cut, language-agnostic, used across multiple scenario types
5. **Clothing (Novice Mid)** — high-frequency vocabulary cluster, all language-agnostic
6. **Days/months/seasons (Section 2)** — static reference cards to complement the live clock (clock handles lessons; these handle textbook)
7. **Weather illustrated set** — these are good candidates for SVG (see Section 9 Phase 2) but illustrated versions work for the textbook
8. **Continue vocabulary by level** — Novice High travel/transport → Intermediate body/health → Intermediate emotions

---

## Section 9 — Interactive Scene Canvas

**Status: Phase 1 complete ✅ | Phase 2 not yet started ⬜**  
**Updated:** March 17 2026 — this section previously said "not yet built." That was stale.

### Phase 1 — Prop Layer Canvas ✅ Complete

The `SceneCanvas` component is fully operational. Daniela can open a live stage, place and remove props, and run the analog clock — all client-side with no server round-trip.

**Built and working:**
```
open_scene(environment)         → loads background, establishes the stage
add_to_scene(prop, position)    → overlays transparent PNG at zone coordinates
remove_from_scene(prop)         → fades out and removes that layer
set_clock(time: "H:MM")         → SVG analog clock with rotating hands ✅ fantastic
clear_scene()                   → removes all props, keeps background
```

Both `compose_visual_scene` (snapshot model, for single static vocabulary displays) and the live canvas (stage model, for sequential lessons) now coexist. Daniela chooses based on context.

### Phase 2 — SVG Canvas Types ⬜ Not Yet Built

These are standalone React/SVG components that extend the canvas beyond prop images. Each covers an entire vocabulary domain from a single reusable component:

| Component | Daniela function | Vocabulary domain | Build complexity |
|---|---|---|---|
| Body diagram (labeled regions) | `set_body_part` + `clear_body_diagram` | Body parts, health, all levels | ✅ Built March 17 2026 |
| Conjugation table (fill-in) | `init_conjugation_table` + `fill_conjugation` + `clear_conjugation_table` | Every tense, every verb pattern | ✅ Built March 17 2026 |
| World map (Spanish-speaking countries) | `highlight_country` + `clear_world_map` | Cultural units, geography, Intermediate+ | ✅ Built March 17 2026 |
| Calendar SVG | `set_calendar` + `clear_calendar` | Dates, days, months, Novice Low | ✅ Built March 17 2026 |
| Emotion face SVG | `set_emotion` + `clear_emotion` | Emotions vocabulary, all levels | ✅ Built March 17 2026 |
| Thermometer SVG | `set_thermometer` + `clear_thermometer` | Weather/temperature, Novice High | ✅ Built March 17 2026 |
| Weather icon set | `set_weather` + `clear_weather` | Weather vocabulary, all levels | ✅ Built March 17 2026 |

**Phase 2 complete (March 17–18 2026):** All 10 grammar/visual canvas components are fully built and wired end-to-end. Daniela has 20+ new function calls total across Phase 2. All components work standalone (full-panel) or as a side-panel overlay on top of an active spatial scene. Bilingual label support (target + native language stacked) is live across all diagram types and the prop layer.

### Use Cases

**Time & Numbers**
- `set_clock(time: "3:15")` — SVG clock with rotating hands. Daniela says "son las tres y cuarto" and the clock moves. No image generation. Covers an entire unit of time vocabulary from one reusable component.
- `set_calendar(day: "miércoles", month: "marzo")` — SVG calendar highlights the correct cell.

**Progressive Scene Building (Restaurant)**
- Scene opens on an empty `restaurant_table` background
- `add_to_scene("glass", "on_table")` — water arrives
- `add_to_scene("bread_basket", "on_table")` — bread arrives
- `add_to_scene("dinner_plate", "on_table")` — el plato principal
- `remove_from_scene("dinner_plate")` — cleared after dessert
- `add_to_scene("menu_card", "on_table")` — la cuenta
- The full dining experience in one conversation, on one canvas

**Body Parts**
- Background: illustrated neutral body outline (SVG)
- `highlight_body_part("cabeza")` — that region glows or labels appear
- `highlight_body_part("hombro")` — added to the active set
- Daniela can narrate "me duele la cabeza y también el hombro" while the diagram tracks

**Conjugation Table**
- Blank table with pronoun rows
- `fill_conjugation("yo", "hablo")` — cell fills in
- `fill_conjugation("tú", "hablas")` — next cell
- Student watches the pattern emerge as Daniela explains each form

**World Map (Cultural)**
- SVG map of Spanish-speaking countries
- `highlight_country("México")` — country shades
- `add_label("México", "Ciudad de México")` — capital appears
- Daniela can tour the Spanish-speaking world, country by country

**Other uses identified**
- Shopping cart that fills as vocab is taught at el mercado
- Recipe assembly: ingredients arrive on a kitchen counter as Daniela names them
- Emotion face: SVG face that transitions between alegre / triste / sorprendido / enojado
- Weather forecast card that updates icons as Daniela discusses the week
- Thermometer that rises/falls for temperature vocabulary
- Classroom seating chart where "siéntate al lado de María" is shown spatially

### Canvas Command Architecture

Daniela emits canvas commands that the client receives via the existing WebSocket/streaming channel. The client's whiteboard panel holds the current canvas state.

**New function calls to add to Daniela's registry:**

```
open_scene(environment, label?)     → establishes background, clears any existing scene
add_to_scene(prop, position, label?)  → adds a prop layer at cx/cy from POSITION_MAP
remove_from_scene(prop)             → fades out and removes that layer
move_in_scene(prop, new_position)   → animates prop from current position to new one
clear_scene()                        → removes all props, keeps background

// Special canvas types (SVG components, no images):
set_clock(time: "HH:MM")           → rotates clock hands
set_calendar(day, month, year?)    → highlights a date
highlight_body_part(part, active: bool) → body diagram labeling
fill_table_cell(row, col, value)   → conjugation table fill-in
highlight_country(country)          → world map highlight
```

**What this replaces:**
- `compose_visual_scene` remains for the snapshot use case (static vocab cards, Mode A wide scenes)
- The canvas commands are the NEW primitive for interactive/progressive lessons (Mode B prepositions, time lessons, ordered vocabulary)

### Frontend Component Architecture

```
<SceneCanvas>
  ├── <SceneBackground src={environment.image_url} />   ← CSS background-image
  ├── <SceneLayer key={prop.name}                       ← absolute positioned
  │     src={prop.zone_image_url}
  │     cx={POSITION_MAP[position].cx}
  │     cy={POSITION_MAP[position].cy}
  │     scale={POSITION_MAP[position].scale}
  │     animate="fade-in"
  │   />
  ├── <ClockCanvas time={clockState.time} />            ← SVG component
  ├── <BodyDiagram highlighted={bodyState.parts} />     ← SVG component
  └── <ConjugationTable filled={tableState.cells} />   ← React component
</SceneCanvas>
```

### Build Sequencing Recommendation

The canvas concept has two phases:

**Phase 1 — Prop layer canvas (low risk, high value)**  
Pure client-side compositing of what we already have. No new assets needed. No new DB schema. Just a new frontend component and new Daniela function calls. Enables the progressive restaurant scene immediately with the 24 existing zone-compatible props.

**Phase 2 — SVG canvas types (medium effort, extremely high value)**  
Clock, body diagram, conjugation table, world map. Each is a standalone React/SVG component. The clock alone covers an entire vocabulary unit. The body diagram covers half of Intermediate Low health vocabulary. These should be built in Section 9's batch generation order below:

| Canvas type | Lessons it covers | Build complexity | Status |
|---|---|---|---|
| Clock (analog + hands) | All time expressions, Novice Low → Advanced | Low — pure SVG | ✅ Done |
| Body diagram | Body parts, health vocabulary, Intermediate Low | Medium — organic bezier paths | ✅ Done (organic shapes + glow) |
| Face close-up diagram | Lips, chin, cheeks, eyebrows, teeth, nostrils, ears, forehead, jaw | Medium — layered SVG regions | ✅ Done (March 2026) |
| Hand close-up diagram | Thumb, fingers, palm, wrist, knuckles, fingernails | Medium — tapered bezier paths | ✅ Done (March 2026) |
| Conjugation table | Every tense, every verb pattern | Low — React table component | ✅ Done |
| Weather icon set | Weather vocabulary, Novice Low | Low — SVG icons | ✅ Done |
| World map (Spanish-speaking) | Cultural units, Intermediate+ | Medium — SVG paths | ✅ Done |
| Emotion face | Emotions, Intermediate Mid | Low — SVG expressions | ✅ Done |
| Calendar | Dates, days, months, Novice Low | Low — SVG grid | ✅ Done |
| Thermometer | Temperature, weather, Novice High | Low — SVG fill | ✅ Done |

### Connection to Static Assets in Sections 1–8

Many of the static assets listed earlier become redundant or complementary once the canvas is built:

- **Clock reference cards (Section 2)** → still useful as textbook illustrations; the live clock handles lesson interactions
- **Body diagram (referenced in Section 1)** → the static version for textbook; the SVG version for Daniela's sessions
- **Conjugation tables (Section 3)** → the static versions are textbook/reference cards; the live fill-in version is the lesson experience
- **Preposition maps (Section 4)** → the static card is a reference; the live prop room compositor (already built) handles lesson interactions
- **Weather icons (Section 2)** → SVG canvas icons for live lessons; illustrated images for textbook/library

The roadmap sections 1–8 describe the library of reference assets. Section 9 describes how those assets come alive in real-time lessons.

---

## Asset Creation Pipeline

This roadmap is written for Spanish (our primary language) but the vocabulary images, time/weather visuals, preposition maps, and grammar structure cards all need to adapt to all 9 languages. The approach:

- **Images** (vocabulary illustrations): language-agnostic — one image per concept, any language can reference it
- **Grammar tables**: language-specific — French has different conjugation patterns, German has cases, Japanese has particles
- **Cultural infographics**: language/region-specific — French has its own culture section, Japanese has its own
- **False cognates**: language-specific — different false friends for each L1→L2 pair

Priority order for language expansion: Spanish → French → German → then others.

---

## Section 10 — Interactive Ordering Menus

**Status: Planned**  
**Origin:** Late-night brainstorm session, March 16 2026

### The Idea

The decorative menu props (`breakfast_menu`, `lunch_menu`, `dinner_menu`, `menu_card`) that sit on the table as scene dressing are not the same thing as an **interactive ordering menu**. This section describes that second thing — which doesn't exist yet and should.

When a student is doing a restaurant roleplay and Daniela hands them a menu, they should be able to **tap the menu prop on the canvas** and have a full menu overlay appear — showing actual dishes, descriptions, and prices in the target language, calibrated to their ACTFL level.

### What It Would Look Like

A modal/overlay slides up (or the canvas zooms into the menu), showing:

```
┌──────────────────────────────────────────────────────────┐
│              LA MESA ESPAÑOLA — Menú del Día              │
│──────────────────────────────────────────────────────────│
│  ENTRANTES                                                │
│  • Sopa del día ....................................... $6 │
│    Caldo de pollo con fideos y verduras frescas           │
│  • Ensalada mixta ..................................... $8 │
│    Lechuga, tomate, cebolla, aceitunas y vinagreta        │
│                                                           │
│  PLATOS PRINCIPALES                                       │
│  • Pollo asado con patatas ........................... $18 │
│    Muslo de pollo al horno con hierbas provenzales        │
│  • Pasta con salsa marinera ......................... $15  │
│    Espaguetis con tomate, ajo y albahaca fresca           │
│                                                           │
│  POSTRES                                                  │
│  • Flan casero ....................................... $6  │
│    Flan de huevo con caramelo líquido                     │
└──────────────────────────────────────────────────────────┘
```

### Data Architecture

This requires a new concept: **scenario-specific menu data** that lives in the database and is tied to:

1. **Language** — all descriptions and dish names in the target language
2. **ACTFL Level** — Novice levels get simpler vocabulary; Advanced levels get richer descriptions, less-common dishes, regional cuisine
3. **Meal type** — breakfast, lunch, dinner (matching which menu prop is on the table)
4. **Region/cuisine style** — a Mexican restaurant menu vs a Spanish tapas bar vs an Argentine parrilla should feel different even at the same ACTFL level

### Implementation Ideas

**Option A — Pre-written menu content per language/level/meal (simplest)**
- Author 3–4 menus per language (breakfast, lunch, dinner, café) × however many ACTFL levels want distinct menus (probably 3 tiers: Novice, Intermediate, Advanced)
- Store as structured JSON/DB rows: `{ dish_name, description, price, category, language, actfl_tier }`
- The menu overlay renders from this data
- Daniela references specific dishes from the menu when asking what the student wants to order

**Option B — Dynamically generated menus (more flexible)**  
- Generate menu content on the fly using the AI, scoped to language/level/region
- Cache the generated menu in the session so Daniela can reference it consistently throughout
- Allows infinite variety — every session could have a slightly different menu

**Option C — Hybrid**
- Pre-authored core menu templates per language/level that Daniela can reference
- Daniela can add or swap individual items dynamically using a function call (`add_menu_item`, `set_todays_special`)
- Gives consistency + flexibility

### What Daniela Needs

For the restaurant roleplay to work end-to-end, Daniela needs to:

1. Know what's on the menu (so she can roleplay as a waiter and suggest dishes)
2. Be able to surface the menu to the student when appropriate
3. Reference specific menu items when the student orders, comments, asks questions
4. Know which items are linguistically useful for the lesson (vocabulary targets)

A future function tool `show_menu()` could:
- Trigger the menu overlay on the student's screen
- Pass menu content to Daniela's context so she knows what's available
- Allow Daniela to highlight specific items as she speaks about them

### Connection to Plate-as-Background

The `restaurant_table_with_plate` environment (added March 16 2026) solves the food-on-plate compositing problem. The interactive menu is the natural companion — the student reads the menu, orders a dish, and Daniela adds that dish's prop at `on_plate`. The loop closes: menu → order → food appears on plate.

### Priority

**Medium — after core curriculum assets.** The restaurant roleplay already works without interactive menus (Daniela improvises). But an interactive menu with real content would make the experience significantly more authentic, more replayable, and more linguistically purposeful.

---

## Section 11 — Menu Food Item Image Queue

**Added:** March 17 2026  
**Priority:** High — the interactive ordering menus (Section 10, now built and live) display a food item image alongside every dish name. Every menu item at every ACTFL level needs its own image, or it falls back to a placeholder.

### The Decision: Images at All Levels

An earlier draft of this document restricted images to Beginner menus only, on the assumption that advanced students should be "reading, not looking." That was wrong. Images in the menu overlay serve vocabulary acquisition at every level — a beginner sees *churros* and learns the word, an advanced student sees *croquetas de jamón ibérico* and reinforces a richer mental model. Taking images away from higher levels creates a worse product for no educational gain. The menu overlay shows the image at every level. The image is the same; the text complexity around it scales with level.

**This also resolves the scale problem.** Because images live in fixed-size card containers inside the menu overlay, the presentation container controls the visual size. A croissant image and a paella image both render at the same card dimensions — relative scale is implicit and handled by layout, not by the image itself. This is fundamentally different from placing a food prop on the scene canvas where proportion to the plate matters.

### What We Have

Three data files author all menu content across 5 scenario types:

| File | Scenario types | Total items authored |
|---|---|---|
| `language-menus-restaurant-mealtime.ts` | Breakfast, Lunch | 474 items |
| `language-menus-cafe-grocery.ts` | Café, Grocery | 688 items |
| `language-menus-restaurant-festival.ts` | Dinner, Local Festival | 662 items |
| **Total** | **5 scenario types** | **1,824 authored items** |

Each file covers **10 languages × 3 ACTFL levels (Beginner / Intermediate / Advanced)**.

### How Many Unique Images

The same dish name appears across all three levels of a given language menu (Beginner: "Café con leche €1.50", Intermediate: richer description, Advanced: cultural annotation — all show the same image). So we generate **one image per unique dish name per language**, not one per level. This reduces the backlog by two-thirds compared to a naïve count.

| Scenario | Unique items/language (est.) | Languages | Total unique images |
|---|---|---|---|
| Breakfast | ~8 | 10 | ~80 |
| Lunch | ~8 | 10 | ~78 |
| Dinner (restaurant) | ~11 | 10 | ~110 |
| Café | ~12 | 10 | ~115 |
| Local Festival / Street Food | ~11 | 10 | ~110 |
| **Total** | | | **~493** |

After cross-language deduplication (items like *croissant*, *espresso*, *orange juice* appear across multiple language menus and share one image): estimated **~310–340 unique images** to generate.

### Items That Are Shared Across Languages (generate once)

- Basic coffee drinks: espresso, cappuccino, café con leche, latte, Americano
- Croissant (French, Spanish, Italian, German café menus)
- Orange juice / fresh-squeezed OJ
- Plain toast / white bread
- Sparkling water / still water
- Salad (green salad, mixed salad)
- Omelette (French/Spanish versions are visually similar enough)

### Items That Are Language-Specific (generate per cuisine)

These must be distinct — a Japanese ramen bowl and a Spanish cocido are not interchangeable. Generate separately with cultural fidelity.

| Category | Language-specific examples |
|---|---|
| Japanese | ramen, miso soup, onigiri, bento box, tamagoyaki, soba, udon, yakitori |
| Korean | bibimbap, tteokbokki, bulgogi, galbi, kimchi jjigae, dosirak |
| Mandarin | dim sum, baozi, congee, jiaozi, Peking duck, mapo tofu, tang yuan |
| Arabic | shakshuka, ful medames, manakish, kibbeh, hummus, knafeh, baklava |
| Russian | borscht, blini, pelmeni, shchi, syrniki, beef stroganoff, medovik |
| Spanish/Latin | churros, tortilla española, gazpacho, paella, tacos, enchiladas, flan |
| French | tartine, pain au chocolat, quiche, salade niçoise, coq au vin, crêpe |
| Italian | cornetto, bruschetta, caprese, pizza margherita, risotto, tiramisu |
| German | Brötchen, Brezel, Bratwurst, Schnitzel, Sauerbraten, Apfelstrudel |
| Portuguese | pastel de nata, torrada, bifana, bacalhau, caldo verde, arroz doce |

### Generation Priority

1. **Spanish** (all 5 meal types) — largest user base
2. **Japanese** (all 5 meal types) — visually very distinct, high student engagement
3. **French** (all 5) — many items overlap with existing prop library
4. **Italian** (all 5) — overlaps with French, efficient batch
5. **Korean, Mandarin, German, Portuguese, Arabic, Russian** — in order of user demand

---

## Two Tools, Two Jobs — The Core Architecture Decision

**Revised:** March 17 2026

This distinction is worth stating explicitly, because earlier thinking conflated two different things into one.

### The Scene Canvas — Immersion and Prepositions

The scene canvas (the live stage that Daniela builds during a lesson) does its best work as a **theatrical and spatial tool**. Its highest-value use cases are:

- **Preposition teaching**: the fork is to the *left* of the plate, the glass is *above* the napkin, the menu is *on* the table. The physical arrangement on the canvas is the lesson content.
- **Scene-setting and atmosphere**: a meal arrives on the plate, a bill is placed on the table, a menu card is set down. These moments create immersion and provide contextual cues.
- **Progressive scene building**: the table starts empty, then fills as the conversation unfolds. The student experiences the arc of a real meal.

What the canvas is **not** well-suited for: vocabulary acquisition from images. A food prop on a plate is small, the zone coordinates are fiddly, and there is no room for a dish name or description alongside it. Asking the canvas to also teach "what does paella look like" is asking it to do two incompatible jobs at once.

**Implication for the plate prop:** the plate on the canvas is atmospheric. It does not need to show the correct food for that student's order. A generic "main course" placeholder or a visually appealing generic dish image is entirely sufficient. The vocabulary learning happens somewhere else.

### The Menu Overlay — Vocabulary Acquisition

The slide-up menu overlay that appears when a student taps the menu prop is where **vocabulary acquisition happens**. It has everything the canvas lacks: the image, the dish name in the target language, a description, a price, and enough space to render all of it clearly. This is the right place for food images.

Critically, because images in the overlay live in **fixed-size card containers**, the rendering environment controls the visual size. A croissant and a paella both render at the same card dimensions. Relative scale between dishes is handled implicitly by layout — not by how the images were generated. This makes the image generation problem significantly simpler.

---

## Scaling Specification for Food Item Images

### For Menu Overlay Images (Primary Use Case)

Scale concerns are minimal. The overlay card container normalises all images to the same display size. The main requirements are:

1. **The food item must be the clear subject** — not lost in a background, not floating in a sea of white space
2. **The vessel must be visible** — a cup of espresso should show the cup, not just the liquid; a bowl of ramen should show the bowl, not just the noodles. This is because the vessel is often part of the vocabulary (la taza, el bol, la copa)
3. **Clean background** — white or very light, consistent with the platform's illustrated watercolor style

### For Scene Canvas Food Props (Secondary Use Case)

When a food prop is placed directly on the scene canvas (e.g. at the `on_plate` position), scale relative to the dinner plate matters because both exist in the same visual space. The dinner plate prop renders at approximately 280px wide in the scene. A food item placed at `on_plate` should look like it belongs on that plate — not larger than the plate, not so small it looks like a garnish.

> *...viewed from above at tabletop distance, full [plate/bowl/cup] visible with item in correct proportion, object centred on clean white background, no shadows, warm illustrated watercolor style.*

### Prompt Language (Both Cases)

The canonical prop style prompt handles most of this: *soft watercolor children's book illustration style, warm gentle colors, light pencil outlines, visible brushwork texture, object centred and prominent on a clean pure white background, no background elements, clear and recognisable silhouette.* Avoid adding "close-up of" or "detailed shot of" — these push generation toward macro framing that crops off the vessel.

---

## Food Props by Language & Meal — Localization Backlog

**Added:** March 16 2026  
**Priority:** High — current food props (scrambled_eggs, bacon_strips, ham_slice, hash_browns, plain_toast, omelette, fried_eggs) are Anglo-American and unsuitable for Spanish, French, Japanese, or other language lessons.

### Design Principle

Food props must reflect what a student would actually encounter in the culture they are learning. A Spanish lesson should show *churros* and *tortilla española*, not bacon and hash browns. Every language we support needs its own culturally authentic food set — split by meal category.

### Required Food Props per Language

| Language | Breakfast | Lunch / Midday | Dinner | Dessert / Snack |
|---|---|---|---|---|
| **Spanish (ES/MX/LA)** | churros, tortilla española, pan con tomate, café con leche, molletes | bocadillo, gazpacho, empanada, tacos (MX), quesadilla | paella, cocido, tamales, enchiladas, arroz con pollo | flan, tres leches, arroz con leche, churros |
| **French** | croissant ✅ (exists), tartine, pain au chocolat, café au lait | baguette sandwich, quiche lorraine, salade niçoise | coq au vin, ratatouille, bouillabaisse, steak frites | crêpe, éclair, madeleine, tarte tatin |
| **Italian** | cornetto, cappuccino, fette biscottate | bruschetta, insalata caprese, panino | pizza margherita, spaghetti bolognese, risotto, osso buco | gelato, tiramisu, cannoli, panna cotta |
| **Portuguese** | pastel de nata, torrada, galão | bifana, francesinha, caldo verde | bacalhau à brás, cozido, frango assado | pastel de nata ✅, arroz doce |
| **German** | Brötchen, Brezel, Aufschnitt | Bratwurst, Schnitzel, Kartoffelsalat | Sauerbraten, Kassler, Erbsensuppe | Schwarzwälder Kirschtorte, Apfelstrudel |
| **Japanese** | onigiri, miso soup, tamagoyaki, rice bowl | ramen, soba, bento box, udon | sushi platter, tempura, yakitori, tonkatsu | mochi, dorayaki, matcha ice cream |
| **Chinese (Mandarin)** | congee, dim sum, baozi, youtiao | dumplings/jiaozi, fried rice, spring rolls | Peking duck, hot pot, mapo tofu, kung pao chicken | tang yuan, egg tart, sesame balls |
| **Korean** | dosirak (lunchbox), juk (porridge) | bibimbap, tteokbokki, japchae | bulgogi, galbi, samgyeopsal, kimchi jjigae | bingsu, hotteok, sikhye |
| **Hebrew** | shakshuka, bourekas, labane toast, café hafuch | sabich, falafel wrap, hummus plate, Israeli salad | shwarma plate, grilled fish, couscous, stuffed peppers | rugelach, ka'ak cookies, halva |

### Meal Category Completeness (per language)

Each language needs at minimum:
- **3–5 breakfast items** (visually distinct, iconic for that culture)
- **3–5 lunch/midday items**
- **3–5 dinner items** (including at least one "special occasion" dish)
- **2–3 dessert/snack items**

### Implementation Notes

- Generate with the standard prop style: *warm illustrated watercolor style, vibrant saturated colours, soft natural shading, object centred on clean white background, no shadows or background elements*
- Name props with language prefix where needed to avoid conflicts: `es_churros`, `fr_croissant`, `ja_ramen`, etc. (or a single `churros` if it maps cleanly to one language)
- DB `object_type`: use `'food'` for all
- Consider tagging with `tags` array: `['food', 'breakfast', 'spanish']` for filtering
- The `breakfast_menu`, `lunch_menu`, `dinner_menu` image props should eventually be language-specific too (Spanish menu card, Japanese menu card, etc.)

### Existing Food Props (Anglo-American only — needs cultural counterparts)

| Prop | Language context | Notes |
|---|---|---|
| scrambled_eggs | EN only | Add es_huevos_revueltos equivalent? Or use for bilingual EN/ES lessons |
| fried_eggs | EN only | es: huevo frito |
| omelette | EN/FR | fr: omelette already correct — reuse |
| bacon_strips | EN only | Not culturally appropriate for most other languages |
| ham_slice | EN | es: jamón serrano is different visually |
| hash_browns | EN only | No direct equivalent in most cultures |
| plain_toast | Universal | Can reuse across languages |
| croissant | FR/universal | Already in prop library ✅ |
| apple | Universal | Already in prop library ✅ |
| pasta | IT/ES/universal | Already in prop library ✅ |

### Priority Order

1. **Spanish** — largest user base, most immediate need
2. **French** — high demand, many props overlap with existing
3. **Japanese** — visually very distinct, high educational value
4. **Italian** — overlaps with French, efficient to do together
5. **Hebrew** — new language, Israeli Coffee Shop scenario drives immediate need
6. **Others** — as language support expands

---

## Section 9 — Immersive Experience: Tutor in Scene

**Added:** March 18 2026  
**Status:** 🔬 Exploration  
**Priority:** Medium — high visual impact once proven

### Concept

Currently the tutor avatars (listening/thinking/talking portrait cutouts) live exclusively in the standard lesson view. The immersive scene mode is a separate fullscreen experience with only the environment background and props — no tutor visible. The idea is to place Daniela (or any tutor) visibly *inside* the scene during immersive mode, making her feel like a real person standing in the environment rather than a disembodied voice.

### Chosen Approach — Option 2: Transparent Avatar Overlay

Float the existing no-background tutor portrait on top of the scene background at a contextually natural position. For counter/bar scenes (taqueria, french_brasserie, israeli_cafe) she would appear behind the counter on one side. For table scenes (izakaya, biergarten, trattoria, korean_bbq) she would appear seated or standing at the far edge. Her three animation states (listening, thinking, talking) continue to work as normal.

**Why this approach:**
- Reuses existing transparent cutout art — no new image set needed per scene
- Tutor animation states (listening/thinking/talking) still function
- Works across all 9 cultural scene backgrounds without additional art production
- Can be toggled or positioned per scene type without a full visual overhaul

**Why not the alternatives:**
- Option 1 (bake tutor into scene art): one set of images per tutor per scene — exponentially more art to produce, tutor can't animate
- Option 3 (docked side panel): breaks immersion, defeats the point of the fullscreen scene

### Pilot Plan

Test with one scene first before rolling out to all 9:

| Step | Detail |
|------|--------|
| Choose pilot scene | `taqueria` — widest use, most developed; Daniela as the taquera behind the counter |
| Position | Bottom-left quadrant, behind the counter — scaled to ~40% of scene height |
| Anchor point | Fixed to scene coordinates, not floating UI layer |
| Animation states | Swap listening/thinking/talking cutouts on Daniela's state change as normal |
| Evaluate | Does she look natural? Is scale correct? Does she occlude props awkwardly? |
| Rollout | If pilot works, parameterize position per scene type and enable all 9 |

### Scene-Specific Position Guide (draft)

| Scene | Tutor position | Notes |
|-------|---------------|-------|
| taqueria | Behind counter, left side | Natural as the taquera |
| french_brasserie | Behind counter/zinc bar, right side | Natural as the café server |
| japanese_izakaya | Right side, standing — slightly behind table | Izakaya staff position |
| german_biergarten | Standing at end of bench, right | Open air — less natural but workable |
| italian_trattoria | Left side, standing near wall | Natural as the host/waiter |
| korean_bbq | Standing to right of table | Grillmaster position |
| chinese_teahouse | Left side, seated low | Tea ceremony host |
| israeli_cafe | Behind counter, right side | Natural as the barista |
| cafe | Behind counter, center-left | Generic barista position |

### Technical Notes

- Tutor overlay would be a new `TutorInScene` component rendered inside `ImmersiveSceneView` (or equivalent) as an absolutely positioned layer above the background but below the prop canvas
- Scene-specific position and scale stored as metadata per visual environment (or hardcoded per scene name initially for the pilot)
- No new avatar images needed unless we later want scene-specific costume variants (e.g. Daniela in a taqueria apron)
- Costume variants (Option 1-hybrid) could be a future phase if the overlay approach proves compelling

---

## Section 12 — Image Routing Architecture & Coverage Audit

**Added:** April 7, 2026
**Status:** Plans #4 + #5 ✅ complete (confirmed April 7, 2026); Cultural character audit ⬜ not started

This section captures the routing infrastructure that determines *which image a word gets* — a problem separate from whether the image itself exists. Plans #4 and #5 live here, as does the cultural character image audit that Rule 5 flagged.

---

### The Three-Tier Framework

Every vocabulary word in every lesson must resolve to exactly one of these three tiers. Raw unguided auto-generation is never acceptable — it produces stylistically inconsistent images and wastes DALL-E budget.

| Tier | When to use | Image source | Examples |
|------|-------------|--------------|---------|
| **1 — SVG / canvas component** | Function word, numeral, grammar concept, or anything better shown as a diagram | React/SVG component — no DALL-E | `je`, `le`, `3`, `AR verbs`, preterite timeline |
| **2 — Shared concept image** | Universal action or noun whose visual meaning is culturally identical everywhere | One watercolor image shared by all 9 languages | `manger/comer/eat`, `étudier/estudiar/study`, `dormir/sleep` |
| **3 — Character SCENE_OVERRIDE** | Culturally specific greeting, gesture, or phrase where character identity and scene setting matter | Language-specific DALL-E image using character-substitution prompt template | `bonjour`, `salut`, `buenos días`, `こんにちは` |

If a word doesn't match tier 1 or 2, it gets a tier 3 SCENE_OVERRIDE — never raw unguided generation.

---

### Plan #4 — Textbook Image Consistency: Shared Concept Expansion + Sentence Resolver ✅

**Confirmed complete April 7, 2026.** All deliverables were implemented in a prior session.

**Problem being fixed:** Three routing failures currently exist in the French textbook (and likely in all non-Spanish textbooks):

1. **Missing shared concept entries** — `étudier`, `se lever`, `travailler`, `regarder` have no entry in `vocabulary-image-resolver.ts`. They fall through to raw DALL-E and produce photo-realistic images that clash with the watercolor library.
2. **Sentence-form blindspot** — `Je mange`, `Tu parles`, `Il travaille` are stored and looked up as-is. The pronoun prefix means they never match `manger`, `parler`, `travailler` in the shared concept map, so each generates a fresh image from scratch.
3. **Missing Spanish anchor images** — the shared map points to `vocab_spanish_trabajar` etc., which may not yet exist in the DB.

**Deliverables:**
- Add 4 missing verb clusters to `vocabulary-image-resolver.ts` (étudier → `vocab_spanish_estudiar`, regarder → `vocab_spanish_mirar`, travailler → `vocab_spanish_trabajar`, se lever → `vocab_spanish_levantarse`)
- Sentence-form normalizer as the first step in the resolution pipeline (strips subject pronouns and leading reflexive particles before lookup)
- Seed missing Spanish anchor images via SCENE_OVERRIDEs in `vocab-image-seed-service.ts`
- Admin vocab audit endpoint: `GET /api/admin/vocab-audit?language=french&level=novice_low` returns routed vs. unrouted breakdown per word per lesson

---

### Plan #5 — Canonical Vocabulary Registry — All Chapters, All Languages ✅

**Confirmed complete April 7, 2026.** `server/data/canonical-vocabulary.ts` exists (2,560 lines, 7+ thematic units covering greetings, family, school, food, numbers/time, daily routines, travel/transport). `lookupCanonicalConcept()` is called as Step 0 in the resolution pipeline. Admin audit endpoint live at `GET /api/admin/vocab-audit`.

**Problem it solved:** Gaps in the shared concept map are discovered reactively — a student sees a bad image, then we patch it. There is no authoritative forward-looking list of what images every chapter in every language needs.

**Deliverables:**
- New file `server/data/canonical-vocabulary.ts` — master registry of ~400 concepts covering every lesson and every language, each mapped to its tier and its image key
- `lookupCanonicalConcept()` called as the first resolution step (before the existing shared concept map)
- The admin audit endpoint (from Plan #4) runs against this registry to show coverage status per language/level combination
- When a future agent asks "what images are required for Unit 3 School Life in German?" the answer lives in this file

**Dependency:** Plan #5 is the superset — Plan #4's fixes become the first entries in the canonical registry. Plan #4 can ship first as a targeted patch; Plan #5 is the full systematic version that makes the patch unnecessary going forward.

**Files:**
- `server/data/canonical-vocabulary.ts` — new
- `server/services/vocabulary-image-resolver.ts` — add `lookupCanonicalConcept()` as first pipeline step
- `server/routes.ts` — add `/api/admin/vocab-audit` endpoint
- `server/services/vocab-image-seed-service.ts` — SCENE_OVERRIDEs for missing Spanish anchors
- `docs/alden-agent-handoff.md` — architecture section update

---

## Madrigal Method Analysis — "See It and Say It in Spanish" (1962)

**Analyzed:** April 9, 2026  
**Source:** Margarita Madrigal, *See It and Say It in Spanish*, New American Library, 1962.  
**Book access:** Available for digital borrowing at archive.org (search "Madrigal See It Say It Spanish"); paperback ~$8 on Amazon. No free full-text HTML version exists — copyright renewal keeps it protected until ~2057.  
**Agent characterization (session preceding April 9, 2026):** "ruthlessly minimalist" — coined by the agent who first analyzed the book's structure and recognized its deliberate economy of means. David noted this characterization on April 11, 2026 as worth preserving in the record.

### The Adaptation Philosophy — What We Borrow, What We Transcend

**Established:** April 11, 2026

HoloHola is not a digital replica of Madrigal's book. Everything we have built and are building is legitimate — the chapters, the structure, the AI tutor, the conversation model. None of that needs to be reconsidered against the book. The book is a study in what a skilled teacher was able to achieve with the most constrained possible medium: black ink on a small paperback page, no audio, no interactivity, no personalization, no feedback loop.

The scan project exists for one reason: **to understand what Madrigal was trying to achieve, so we can achieve the same things better with tools she didn't have.**

Her constraints were severe:
- No audio — she had to build pronunciation confidence through cognates and pattern repetition alone
- No interactivity — she had to design pages that would "ask the question" and pause for the student to answer, in their own head
- No personalization — every student got the same 191 lessons in the same order
- No feedback — she never knew if the student answered correctly; she could only design the page to make errors obvious by comparison

HoloHola removes every one of those constraints. Daniela speaks. She listens. She adapts to what the student already knows. She remembers what landed and what didn't. She asks the same question ten different ways if needed. She gives the student the Warhol-style illustration of a taxi and then immediately lets them practice the word in a real conversation.

**What we borrow from Madrigal:**
- The image-first principle — see the object before reading the word
- The Q&A drill rhythm — question in one person, answer shifts to another, no metalanguage
- Pattern before label — demonstrate the structure through repetition, name it briefly afterward
- Cognate confidence as an entry point — you already own more of this language than you think
- Ruthless minimalism — every element must teach, demonstrate, or encourage; nothing else earns its space
- The Sentence Frame architecture — a fixed frame with swappable vocabulary items is the core drill unit
- Grammar as a back-of-the-book resource, not a front-door welcome

**What we transcend:**
- Audio — Daniela says the word; the student hears it before they read it, not after
- Live Q&A — Daniela actually asks and waits for a real answer, not an imagined one
- Adaptive sequencing — we do not have to teach everything in the same order to every student
- Chapter organization — we group by theme (which Madrigal couldn't do continuously) so students can navigate to what they need
- Images with color, motion, and cultural context — Warhol used black line drawings because that was what the medium allowed; we are not similarly constrained
- Infinite fillers — Madrigal could put four vocabulary items per page; we can present hundreds
- Feedback — the student knows if they got it right

The scan will help us understand the parts we're borrowing more precisely — especially the vocabulary sequencing decisions (what she chose to teach first and why) and the sentence frame patterns (which verb constructions recur most, which she used as anchor frames). Everything we have built stands. The scan makes the borrowed parts better.

**What the scan is NOT:**

Madrigal's vocabulary choices are a reference, not a specification. Two reasons we do not simply copy her content:

1. **ACTFL alignment is our design decision, not hers.** She wrote in 1962, thirteen years before ACTFL published its first proficiency guidelines. Her sequencing reflects intuition and experience — both excellent — but it was never mapped to "can-do statements" or Novice Low/Mid/High benchmarks. Our chapters were designed around ACTFL. Madrigal's content will inform our vocabulary choices; ACTFL governs our proficiency claims.

2. **Her book is deliberately mechanical — and that's a gap, not a feature.** The robotic quality is a strength for pattern-pounding and compartmentalization. But real language is not a robotic application of grammar rules. It has personality, cultural weight, humor, emotion, social risk. "¿Qué es el apio?" is a fine drill. It is not a conversation anyone has ever wanted to have. There is reportedly no greetings section in "See It and Say It" at all — which means the first thing any real human exchange requires (hello, nice to meet you, how are you actually doing) is something Madrigal never addressed. Our scenarios exist precisely because language lives in human interaction, not in vocabulary columns. Daniela's personality, the cultural spotlights, the conversation scenarios — these are not decoration on top of the method. They are where the method becomes a language rather than a grammar exercise.

---

### Book Structure — What the TOC Actually Tells Us

**Photographed:** April 11, 2026. File: `attached_assets/TOC_1775924828059.jpg`

The table of contents of *See It and Say It in Spanish* is one of the most important structural facts about the book, and it fundamentally shapes how HoloHola should adapt Madrigal's method.

---

**The actual structure of the book:**

| Section | Pages | Description |
|---|---|---|
| Pronunciation Guide | 8 | One page — phonetic key, nothing more |
| **Conversation Lessons** | **9–199** | **191 pages. No chapter titles. No theme labels. No subdivisions.** |
| Traveler's Handy Word Guide | 203–215 | 10 thematic reference lists (see below) |
| Grammar Section | 217–233 | AR / ER / IR verb tables, all tenses |
| Spanish-English Vocabulary | 233–252 | Alphabetical glossary |
| Index | 253+ | |

**The Traveler's Handy Word Guide sections (pp. 203–215):**
1. In the Restaurant (p. 203)
2. In the Hotel (p. 208)
3. In the Stores and Shops (p. 209)
4. The Numbers (p. 210)
5. The Days of the Week (p. 211)
6. The Months of the Year (p. 211)
7. The Seasons (p. 212)
8. Members of the Family (p. 213)
9. The Colors (p. 214)
10. Parts of the Body (p. 215)

---

**What this means:**

Madrigal did not organize her book by theme. Pages 9–199 are a single uninterrupted flow of progressive lessons with no chapter breaks, no unit labels, no "Week 1: Greetings" headers. The vocabulary accumulates. Each lesson assumes everything before it. The sequence is Madrigal's pedagogical decision — she chose what comes first, what comes next, and why. The themes emerge from the order of introduction, not the other way around.

**HoloHola's 5-chapter structure (greetings / family / numbers / daily / classroom) is entirely our own design.** It is not derived from Madrigal's sequencing. We extracted thematic clusters from her continuous lesson flow and organized them the way a digital app requires: discrete, navigable, self-contained units.

This is the right call — an app cannot be a 191-page scroll — but it means we are adapting her METHOD, not her SEQUENCE.

The distinction matters for the scan:
- We cannot expect the book to have a "greetings section" at page 9 and a "family section" at page 45. The content is woven together progressively.
- When we scan, we will be mining a continuous text for vocabulary clusters that belong to our thematic chapters, then extracting those and applying Madrigal's FORMAT (4-zone layout, image-first, Q&A drill, grammar notice) to our content.
- The vocabulary choices and sentence frames on the pages we find are her decisions about what a beginner needs first — those are worth respecting. But the chapter groupings are ours.

**The Traveler's Handy Word Guide (pp. 203–215) is the closest structural analog to what HoloHola does.** It groups vocabulary thematically (restaurant, hotel, family, numbers, colors) in short reference lists — the same organizational logic as our chapters. However it uses bare lists with no images and no drill structure, so it is a reference section, not a teaching section. Our chapter intros combine both: thematic grouping (from the Handy Guide's organizational logic) + drill format (from the Conversation Lessons' teaching method).

**The Grammar Section (pp. 217–233) maps to our Grammar Diagrams.** It is deliberately placed at the back — after 191 pages of encountering these patterns in context. You are not supposed to read it first. In HoloHola, Grammar Diagrams live behind a tap, not at the start of a lesson. This is the same decision.

---

**Practical implications for the scan (arriving ~April 14):**

1. **Do not look for chapter headers** — there are none. Instead, scan for when our target vocabulary first appears in the lesson sequence, and what page it's on.
2. **Track page numbers as rough difficulty indicators** — earlier pages = earlier in Madrigal's intended introduction sequence = simpler vocabulary.
3. **The Traveler's Handy Word Guide sections** (pp. 203–215) are worth scanning completely — they are the thematic reference clusters closest to our chapter structure and contain the canonical vocabulary lists for family, numbers, restaurant, hotel topics.
4. **Family vocabulary** specifically is on p. 213 — one page. Numbers on p. 210. These are Madrigal's choices for the minimal vocabulary set for each topic.
5. **For the Conversation Lessons (pp. 9–199)**, scan looking for when our theme words first appear — the Q&A page structure around them will give us the sentence frames, the verb forms, and the image subjects Madrigal chose for each concept.

---

### The Preface — Philosophical Alignment with HoloHola

**Analyzed:** April 10, 2026 (from physical copy photographed by David)

The preface of *See It and Say It in Spanish* reads almost like a product spec for HoloHola. Every major design decision in the book maps to a design decision already present in the app. The most striking overlap is that Madrigal articulated both the problem (grammar-rule frustration) and the solution (stealth acquisition through familiar patterns) in 1962, six decades before the research gave it a name.

---

**"Before he has gone very far, before he is even aware of it, he will be speaking Spanish."**

This is HoloHola's entire premise in one sentence. Daniela doesn't lecture — she talks. The student doesn't notice structure being taught because the structure arrives wrapped in a conversation they wanted to have. Grammar emerges from use. The student only discovers what they've learned when they look back.

---

**"The approach here is progressive. From the very beginning, the student is on familiar ground."**

Madrigal's first move is cognate recognition — showing English speakers how many Spanish words they already own. This is both a pedagogical tool and a psychological one: it dismantles the belief that Spanish is foreign before the student has read a single lesson. HoloHola's ACTFL Novice Low chapters implicitly rely on this but have never made it explicit. See Plan M6.

---

**"Anyone who has tried to learn by the laborious route of memorizing complex grammar rules, and has had to struggle with the numerous exceptions to these rules, will be pleasantly surprised..."**

This is the reason Daniela never opens a session by conjugating verbs. Grammar Diagrams exist in HoloHola as reference material the student reaches for when curious — they are never the primary instruction. Madrigal and HoloHola share the same pedagogy: grammar is a map you consult after you've already explored the territory on foot.

---

**"The method here followed makes the student WANT to learn."**

The Resonance Shelf tracks exactly this. When a particular conversational hook, cultural story, or vocabulary frame landed well for a specific student, Daniela remembers it and returns to that register. Making the student want to learn is not a side effect — it is the product.

---

**"The small drawings are there to make studying easier. With their help you can avoid doing difficult exercises and frustrating drills."**

This is Plan M5. Madrigal explicitly positioned her illustrations as a replacement for drills, not a supplement to them. A Sentence Frame Grid with no images is not Madrigal's method — it is the drill she was trying to eliminate. The visual anchoring is the mechanism.

---

**"You don't necessarily have to start with the first lesson. You can start wherever you wish. You can shift back and forth among the lessons; you can go on to a new lesson when you feel ready for it; you can study several lessons simultaneously, and you can keep on reviewing what you have learned, at your own convenience."**

This is the non-linear navigation principle that David has advocated for in HoloHola since the beginning. A well-structured lesson should work as the first lesson for a beginner *and* as a reference drill for an intermediate student returning to a chapter they thought they knew. Every chapter is a self-contained module, not a step in a locked sequence.

HoloHola already supports this architecturally — the ACTFL gauge shows level but doesn't lock chapter access. The chapter introduction, vocab grid, grammar diagram, conversation strips, and sentence frames are all independently useful at different stages. The principle should be documented as a first-class authoring rule: **design every lesson to stand alone**.

---

**"The most important aim of this book is to provide you with a book that will 'help you to help your students' master Spanish."**

Madrigal framed the teacher as a facilitator who uses the book as a tool, not a lecturer who delivers the content. In HoloHola this maps precisely: Daniela is the tool. The student directs the conversation. The tutor adapts.

---

**"The lessons are so presented that they can be easily adapted for dialogue teaching. You ask the questions and the student will be able to answer them."**

Every Daniela session is structured around this. She asks; the student answers. When the student is confident enough to ask questions back, that is a measurable breakthrough — it appears in the conversation context and the ACTFL scoring as a shift toward Novice High.

---

**Zero bloviation — a content authoring principle (noted April 10, 2026)**

The book is, in the words of the agent who first analyzed it, "ruthlessly minimalist." No academic preamble, no lengthy explanations of why the method works, no throat-clearing. Every sentence either teaches vocabulary, demonstrates a pattern, or builds confidence. Anything that does none of those three things is cut.

This is the model for HoloHola's chapter content. The risk in our narrative sections and welcome text is drift toward explanation-for-its-own-sake — writing that sounds educational without doing anything educational. The Madrigal test: read a sentence and ask which of the three jobs it is doing. If the answer is none, remove it.

Authoring rule: **every sentence in a chapter narrative must teach, demonstrate, or encourage — never all three at once, never none.**

The practical implication for HoloHola content: cultural spotlights, narrative section tips, and welcome text are the highest-risk areas for bloviation because they are prose rather than structured data. They should be reviewed against this standard. A tip that explains grammar in prose when a Grammar Diagram already shows it is redundant. A welcome text that describes what the student is about to learn instead of making them feel capable of learning it has the wrong job.

---

### What The Book Does (Core Pedagogy)

Madrigal's method rests on one insight: **grammar disappears when the frame never changes**. Every structural pattern is introduced once, demonstrated with multiple vocabulary fillers in the same page-spread, and never named as a grammar rule. The student internalises the frame through visual repetition and picture anchoring, not through explanation.

Six teachable patterns from the pages analysed:

1. **Pattern Repetition (Sentence Frame + Visual Fillers)**  
   One frame, 6-12 pictures, complete sentence shown under each image. Eg. *Va a tomar un ___* + taxi, tren, avión, autobús, café, sopa. The verb structure becomes automatic muscle memory; the student focuses on vocabulary.

2. **Full Q&A Pairs Under Images**  
   Each vocab card carries a model question and answer below the image: *¿Qué es el apio? El apio es una verdura.* Forces complete sentence production, not just word recognition. Meaningfully different from our current VisualVocabGrid which shows word + translation only.

3. **Minimal Conjugation Grid (4-cell, not 6)**  
   Madrigal's AR verb table is 4 cells: **yo → o**, **nosotros → amos**, **él/ella/usted → a**, **ellos/ustedes → an**. She deliberately omits the full 6-pronoun table at entry level. Learners encounter the pattern in context rather than as a paradigm to memorise.

4. **Gender Agreement Side-by-Side (estar expressions)**  
   A full page of *estar* adjective expressions shown as masculine/feminine pairs in two columns (contento/contenta, cansado/cansada, enfermo/enferma…). Visually establishes gender agreement as a natural word-pair, not as a rule to memorise.

5. **Verb-Object Drilling (same verb, many objects)**  
   The *tomar* pages group everything you can "take" — taxi, tren, avión, autobús, café, sopa, medicina — under a single verb frame. Vocabulary is organised by the verb it appears with, not just by topic category.

6. **Embedded Grammar Observations (post-example discovery)**  
   After showing a set of preterite examples, Madrigal adds a callout box: *"Notice that all the verbs in the questions end in ó. All the verbs in the answers end in é."* Rules are observed from data, never pre-stated. This is a different pedagogy from our current Grammar Diagrams (which state the rule first).

---

### Gap Analysis — What HoloHola Has vs. What's Missing

| Madrigal Pattern | HoloHola Status | Gap |
|---|---|---|
| Pattern Repetition / Sentence Frame Grid | **⬜ Built April 9, 2026** (see below) | None — now shipped |
| Full Q&A pairs under vocab images | **⬜ Not built** | VisualVocabGrid only shows word + translation; no Q&A production frame |
| Minimal 4-cell conjugation grid | **Partial** — VerbConjugationTable shows all 6 pronouns | Entry-level view could simplify to 4-cell for Novice Low |
| Gender agreement side-by-side | **Partial** — FormalInformalComparison handles Tú/Usted; no gender-pair adjective grid | No dedicated estar/adjective gender-pair component |
| Verb-object drilling | **Partial** — QuickPhraseGrid groups phrases by topic | No explicit verb-anchor grouping (all items that go with "tomar", etc.) |
| Embedded grammar observations (post-example discovery) | **Not built** | NarrativeSections exist but rules always precede examples; no discovery callout box |

---

### Sentence Frame Grid — Built April 9, 2026

**Component:** `SentenceFrameGrid` in `client/src/components/TextbookInfographics.tsx`  
**Data type:** `SentenceFrame[]` on `ChapterIntroContent.sentenceFrames` in `chapter-intro-content.ts`  
**Rendering:** After `culturalSpotlight` in `ChapterIntroduction.tsx`, inside a Card wrapper.

**Design:** Frame template shown as a header card with `___` highlighted in primary color. Below: responsive 2-4 column grid of filler cards — each shows the vocabulary word in large primary text, the full completed sentence with the filler word bolded, the English translation, and a TextAudioPlayButton. Hover-elevate on cards.

**Spanish data added (April 9, 2026):**

*Greetings chapter:*
- "Hoy estoy ___." × 8 emotional states (bien, mal, cansado, feliz, ocupado, enfermo, triste, nervioso)
- "Tengo que ir al ___." × 6 places (banco, parque, restaurante, hospital, supermercado, baño)

*Family chapter:*
- "Ella es mi ___." × 6 female relatives (madre, abuela, hermana, tía, prima, amiga)
- "Él es mi ___." × 6 male relatives (padre, abuelo, hermano, tío, primo, amigo)

**Extending to other chapters:** Add `sentenceFrames: [...]` to any chapter in `languageChapterData[language].chapters[chapterType]`. No code changes needed — the renderer is data-driven.

**Extending to other languages:** The component accepts `language` prop and passes it to `TextAudioPlayButton` for native-accent TTS. Add sentence frame data to the equivalent chapter in `languageChapterData['french']`, `languageChapterData['german']`, etc. — same interface, same renderer.

---

### Known Design Constraints (Noted April 9, 2026)

Three issues were identified immediately after shipping the first data set. These are guardrails for all future sentence frame authoring.

**Constraint 1 — Vocabulary must match the chapter it lives in**

The first draft placed "banco, parque, restaurante, hospital, supermercado" in the *Greetings* chapter under a "Tengo que ir al ___" frame. Those words are not in the greetings lesson — students have never seen them. This violates the Madrigal principle: the frame drills the structure, the fillers reinforce vocabulary the student *already knows from that chapter*.

Rule: every filler word in a `SentenceFrame` must be a word that appears in the lesson or chapter it is attached to. When authoring new frames, cross-reference the chapter's `conversationStrips` panels and its `quickPhrases` list to confirm the vocabulary is already present.

Corrected greetings data (April 9, 2026):
- Frame 1: "¡___, amigo!" — Hola, Buenos días, Buenas tardes, Buenas noches, Adiós, Hasta luego ✓ (all greetings-chapter words)
- Frame 2: "Estoy ___." — bien, muy bien, más o menos, mal, cansado, feliz ✓ (all ¿Cómo estás? responses from that chapter)

**Constraint 2 — Frame complexity must match ACTFL level**

"Tengo que ir al ___" (I have to go to the ___) is a *tener que* + infinitive construction — Novice High / Intermediate Low territory. It is not appropriate for a Level 1 / Novice Low chapter.

The simpler equivalent is "Voy a ___" (I'm going to ___) — *ir a* + destination is a single high-frequency pattern introduced in the very first lessons of most Spanish courses, and is the construction Madrigal herself uses on the transportation pages.

Rule of thumb for frame complexity by level:
- Novice Low / early Novice Mid: simple subject + verb ("Estoy ___", "Es mi ___", "¡___, amigo!")
- Late Novice Mid / Novice High: *ir a*, *tener*, *querer* + noun ("Voy a ___", "Tengo ___")
- Intermediate Low+: modal constructions, subjunctive cues ("Tengo que ___", "Quiero que ___")

**Constraint 3 — Images are fundamental, not optional (currently missing)**

Madrigal's method works because each filler card has a *picture* — the student maps directly from image to Spanish without routing through English. The current `SentenceFrameGrid` renders text-only cards, which means students are still reading an English translation to understand the filler word. This weakens the core mechanism.

This is a known gap. The component has an `imageKey` field stub on `SentenceFrameItem` (interface defined, not yet rendered). Before this component can be considered complete, every filler item needs:
1. A `imageKey` field populated with a value from the canonical vocabulary registry
2. The card to render the vocab image above the sentence (using the same object-storage URL pattern as `VisualVocabGrid`)
3. A fallback to large styled text if no image is available

Priority: **high** — without images, the Madrigal drill degrades to a phrase list, which we already have in `QuickPhraseGrid`. The visual anchoring is what makes it pedagogically distinct.

See Plan M5 below.

---

### Madrigal-Inspired Components — Status (updated April 10, 2026 session 42)

---

#### Quick status summary

| Plan | Component | Component built? | Data scope |
|------|-----------|:---:|---|
| M1 | VocabQAGrid | ✅ | ✅ All 10 languages — greetings + family + numbers + daily + classroom chapters |
| M2 | GenderAgreementGrid | ✅ | ✅ FR/PT/IT/HE/ES greetings + family; DE/JA/KO/ZH/EN intentionally empty |
| M3 | discoveryNote callout | ✅ | ✅ All 10 languages — greetings formal-informal section (session 45) |
| M4 | VerbAnchorGrid | ✅ | ✅ All 10 languages — greetings + family + numbers + daily + classroom chapters |
| M5 | SentenceFrameGrid images | ✅ | ✅ Complete — session 43 |
| M6 | CognateRecognitionGrid | ✅ | ✅ FR/IT/DE/ES greetings; ✅ PT/JA/KO/ZH/HE greetings (session 42); ⬜ EN |

**⏸ PAUSED — awaiting Madrigal book scan (expected ~week of April 14, 2026)**

Spanish chapter data (M1/M4 vocabQA + verbGroups) was seeded in the Madrigal spirit but from our own design — not from the actual book. Once the physical scan arrives, Spanish chapters should be reviewed and refined against the real vocabulary lists, sentence frames, and sequencing that Margarita Madrigal chose.

**Non-Spanish work that can proceed independently of the scan:**
- M2 gender pairs for numbers/daily chapters (FR/PT/IT/HE/ES)
- M3 discoveryNotes for non-Spanish languages (all chapters)
- M6 EN cognate data for Cindy/Blake (classroom/daily/numbers — international loanwords: café, taxi, hotel, radio)
- Image seeding pipeline for classroom vocabulary

**Spanish-specific work to hold until after scan:**
- Review/replace Spanish M1 vocabQA pairs to match the book's actual vocabulary choices
- Review/replace Spanish M4 verbGroup examples to match the book's sentence patterns
- M5 sentence frame fillers — use Warhol's chosen visual moments as the image prompt starting point (see line ~1773 for context)

---

### Pre-Scan Reference Images (13 pages photographed April 9, 2026)

All 13 images are in `attached_assets/`. Phone-camera shots — readable but not scan quality. The Monday scanner output will be the master reference. **Use these only for format/structure understanding, not pixel-level detail.**

---

#### THE FORMAT SYSTEM — How a Madrigal Page Is Built

Every drill page in the book is built from the same 4-zone layout. This consistency is itself pedagogical — the student's brain never has to figure out how to use the page.

**ZONE 1 — The Vocabulary Header (top ~15% of page)**
- Two-column block of vocabulary pairs, left and right sides of the page
- Format: `Spanish word/phrase, English translation` — Spanish in **bold**, English in regular weight
- These are the raw inputs — introduced as bare pairs before appearing in any sentence
- Always includes the verb infinitive + the key conjugated forms that will appear in the drill
- Example: `tomar, to take / ¿va a tomar? are you going to take / voy a tomar, I'm going to take` (left) and `una ensalada, a salad / chocolate, chocolate (drink)` (right)
- Small body type — roughly 9-10pt equivalent. No decoration, no box, just aligned pairs.

**ZONE 2 — The Illustrated Drill Grid (middle 60-70% of page)**
- A 2×2 grid of cells (occasionally 2×3 for pages with more vocabulary)
- Each cell = **image on top, text below** — always in that order, never reversed
- The image takes roughly 40-55% of each cell's height; the text takes the rest
- **Illustration style:** pure black ink line drawings on cream/off-white page — no fill, no shading, no color, no background. Objects drawn in 3/4 perspective, simplified but instantly recognizable. People have simple rounded heads, minimal facial features, expressive body language. The style is mid-century American illustration — not cartoonish but not realistic. Think Saul Steinberg without the irony.
- **Image subject matter:** each cell shows ONE object or ONE action — nothing compositionally complex. A taxi. A woman diving into water. A man at a desk. Never a scene with multiple focal points.
- **Two drill formats appear (sometimes mixed on the same page):**
  - *Q&A format:* Question in bold → Answer in bold, directly below. Two lines. "¿Va a tomar un taxi? / Sí, voy a tomar un taxi." The question uses usted/él/ella; the answer shifts to yo/nosotros.
  - *Statement format:* One sentence in bold below the image. "Quiero ir al parque." No question. Used when the page is building production vocabulary, not testing recognition.
- Equal white space between all four cells — the grid breathes

**ZONE 3 — The Text Extension Block (bottom ~15-20%, no illustrations)**
- Smaller type, no bold (or lighter bold than Zone 2)
- Lists additional examples using the same verb/structure — without images
- The student is expected to visualize these from memory
- Two sub-formats appear here:
  - *Additional vocabulary list:* "Tengo que ir al hotel. / Tengo que ir al hospital. / Tengo que ir al club."
  - *Conjugation expansion:* Shows other persons: "Queremos ir a la fiesta. / Queremos ir a la playa. / Van a tomar. / Vamos a tomar."

**ZONE 4 — The Grammar Notice (very bottom, appears on ~40% of pages)**
- Set in smaller, lighter type — often italics or a slightly smaller size
- Always begins with "Notice that..." — never "The rule is..." or "Remember..."
- Points at a pattern the student just saw demonstrated — never states it before the demonstration
- One or two sentences maximum
- Followed by a single practice question in both languages: "¿Va a hablar español? *Are you going to speak Spanish?*"
- Example: "Notice that all the verbs in the questions above end in ó. All the verbs in the answers end in é."
- Example: "Notice that the TO form of the verbs above ends in r."

**TYPOGRAPHY RULES (observed consistently across all pages):**
- **Bold = Spanish target language.** All Spanish — always bold, without exception
- Regular weight = English translation. The visual contrast does all the work — no color, no highlighting needed
- Sentence case throughout. No ALL CAPS headings anywhere in the lesson pages
- Page number bottom center, same small body type as Zone 3
- No rules, no borders, no background tints, no icons on lesson pages — the white space is the design

---

#### Image-by-Image Reference

| File | Page | Zone 1 header | Zone 2 grid format | Zone 3/4 |
|---|---|---|---|---|
| `1_1775836704664.jpg` | Preface | — | Dense prose, no images | Madrigal's method: progressive, familiar-first, one page per lesson. "The student is on familiar ground from the very beginning." |
| `new_1775836710104.jpg` | Intro (cont.) | — | Dense prose | "The small drawings are there to make studying easier." Each lesson = self-contained; can study in any order. For teacher: adapt for dialogue teaching, Q+A format. |
| `20260409_110822_1775755866475.jpg` | p. 40 | `tomar, to take / ¿va a tomar? / voy a tomar` (left); `una ensalada, a salad` etc. (right) | **Q&A format, 2×2:** taxi / train / airplane / bus. Question usted form, answer yo form. Images = side-profile line drawings of each vehicle | Zone 3: "Vamos a tomar, we are going to take / Van a tomar, they are going to take" — nosotros/ellos expansion, no images |
| `20260409_110831_1775755866474.jpg` | p. 41 | Note in prose: "In Spanish you do not say 'I'm going to have soup.' You say 'Voy a tomar sopa.'" | **Q&A format, 2×2:** coffee jug / ensalada / sopa bowl / celery. Same usted/yo pattern | Zone 4 at left margin: reminder note in prose (unusual placement — note runs vertically along left side) |
| `20260409_110915_1775755866474.jpg` | p. 58 | `ir, to go / quiero ir, I want to go` (left); `a, to / al, to the / al despacho, to the office` (right) | **Statement format, 2×2 + partial 3rd row:** park / cinema / theater / concert. Each image has single bold sentence below. No Q&A — production mode. | Zone 3: "Quiero ir al restaurante. / Quiero ir al hotel. / Quiero ir a México. / Quiero ir a París." then Q&A: "¿Quiere ir al parque? / ¿Quiere ir al teatro?" etc. |
| `20260409_110925_1775755866473.jpg` | p. 59 | `¿quiere ir? do you want to go / quiero ir, I want to go` (left); `a la fiesta, to the party / a la tienda, to the store / a la playa, to the beach` (right) | **Q&A format, 2×2:** fiesta (people dancing) / playa (diver) / tienda (display case) / casa (open book). usted Q, yo answer. **Bold italic on answer "Sí,"** then regular bold for the rest | Zone 3: "queremos ir" conjugation: "Queremos ir a la fiesta. / Queremos ir a la playa. / Queremos ir a la tienda. / Queremos ir a la casa." |
| `20260409_111001_1775755866472.jpg` | p. 52 | `tengo que ir, I have to go / al correo, to the post office` (left); `al, to the / al despacho, to the office` (right) | **Statement format, 2×2:** post office building / bank window / waiter walking / man at desk. Each gets one large bold sentence. **No Q&A on this page — pure production.** Images are larger than other pages — occupy more vertical space per cell | Zone 3: "Tengo que ir al hotel. / Tengo que ir al hospital. / Tengo que ir al club." then Q&A in both languages: "¿Tiene que ir? *Do you have to go?* / ¿Tiene que ir al correo?" |
| `20260409_111054_1775755866472.jpg` | p. 25 | `¿Qué es? What is?` centered at top. `una verdura, a vegetable / la zanahoria, the carrot` (left); `apio, celery / lechuga, lettuce` (right) | **Q&A format, 2×2:** celery / carrot / lettuce / tomato. Pure object illustrations — no person, no context. Question: "¿Qué es el apio?" Answer: "El apio es una verdura." Simple two-line exchange | Zone 3+4: "rojo, red" introduced as new vocabulary. Then: "¿Es rojo el tomate? Sí, el tomate es rojo." — a new mini-drill at bottom with no image, testing color adjective |
| `20260409_111123_1775755866471.jpg` | p. 142 | `jugué, I played / vi, I saw / trabajé, I worked / el jardín, the garden` (right column top). `¿Qué hizo? What did you do?` as question stem | **Q&A format, 2×2 — rotated 90° in photo:** tennis player / golfer / TV / garden/bed. Question uses hizo (he/she/did); answer uses jugué/vi/trabajé. Page also shows hacer conjugation box (hice/hizo/hicimos/hicieron) — a rare embedded table | Zone 3: "Hice limonada. / Hice mucho trabajo. / Hice la cama." etc. Full list of yo+hacer sentences without images |
| `20260409_111308_1775755866475.jpg` | Appendix | Centered heading: **LIST OF REGULAR "AR" VERBS** | **Conjugation grid** (the only 2D table format in all pages seen): `I | o | amos | we` / `you,he,she,it | a | an | you(pl)/they` — a 2×2 labeled grid showing stem+ending. Below: two-column verb list in alpha order, all bold Spanish + regular English | No Zone 4. Pure reference page — no drill, no images, no grammar note. |
| `20260409_111355_1775755866476.jpg` | p. 122 | `¿estudió? did you study? / ¿compró? did you buy?` etc. (left); `estudié, I studied / compré, I bought / pagué, I paid / nadé, I swam / una bata, a bathrobe` (right) | **Q&A format, 2×2:** man at desk studying / check/bill / swimmer underwater / coat hanging on rack. Pattern: usted Q (ó ending) / yo answer (é ending) — the visual contrast of ó vs é is the whole lesson | Zone 4: "Notice that all the verbs in the questions above end in ó. All the verbs in the answers end in é. In the past tense, AR verbs end in é when you speak of yourself, and ó when you speak of anyone else (singular)." — then: "Roberto nadó hoy. *Robert swam today.*" |
| `20260409_111420_1775755866476.jpg` | p. 112 | `voy a, I'm going (to) / estudiar, to study / hablar, to speak / en la clase, in the class / en la fiesta, at the party` (left); `cantar, to sing / comprar, to buy / bailar, to dance / español, Spanish` (right) | **Statement format, 2×2:** professor at lectern / dancers at party / students at desks / singer. Each gets one sentence: "Voy a hablar español en la clase." No Q&A — the page builds the voy a + infinitive construction through pure exposure | Zone 4: "Notice that the TO form of the verbs above ends in r. Examples: estudiar, TO study; hablar, TO speak; cantar, TO sing; comprar, TO buy." then: "¿Va a hablar español? *Are you going to speak Spanish?*" |
| `20260409_111437_1775755866476.jpg` | p. 81 | Centered heading: **EVERYDAY EXPRESSIONS** | **No images. Two-column text table**, no grid lines. Left = masculine forms, right = feminine forms. Bold Spanish on each line, regular English below. 10 pairs: contento/a, cansado/a, ocupado/a, enfermo/a, listo/a, solo/a, enojado/a, furioso/a, aburrido/a, enamorado/a | Zone 3: Additional estar expressions without gender distinction: "Está bien / mejor / mal / peor / con Roberto / triste / cómodo." Then: "Estamos contentos. / Están cansados. / Estoy contento. (man) / Estoy contenta. (woman)" — **the only page in these 13 with no illustrations at all** |

---

#### What HoloHola Must Replicate — The HOW

**Image cells:**
- Image always above text, never beside it
- Image = one subject, isolated, no background clutter
- Line illustration style (our watercolor variant should preserve the isolation and clarity — one subject, white/transparent background, no scene)
- Cell size consistent across the grid — equal breathing room between all four

**Text in drill cells:**
- Question bold, answer bold — two lines, nothing else
- No "Q:" or "A:" labels — the ¿? marks and "Sí," do all the work
- For statement-mode cells: one sentence, bold, full stop — nothing else

**The vocabulary header:**
- Always precedes the drill — raw pairs first, drill second
- Spanish bold + English regular, same line
- The verb always appears in at least two forms in the header: infinitive + first-person "I" form

**The grammar notice:**
- Bottom of card/page, smaller, lighter
- "Notice that..." — never "The rule is..."
- Only appears after the student has seen the pattern demonstrated four times
- One or two sentences max
- Followed by one practice prompt

**What NOT to carry over:**
- The extension text block (Zone 3) — our digital format lets us go deeper via interaction, not text lists
- The two-column gender table format (p. 81) — we replaced this with our M2 GenderAgreementGrid which is functionally equivalent but more scannable
- The appendix verb list — our VerbAnchorGrid replaces this with contextual examples rather than a bare list

---

### The Second Book — *Madrigal's Magic Key to Spanish*

**Photographed:** April 11, 2026  
**Files:** `attached_assets/1000012139_1775925912342.jpg` (p. 90), `attached_assets/1000012140_1775925912343.jpg` (verb list page)  
**Book:** *Madrigal's Magic Key to Spanish*, by Margarita Madrigal. A companion/sequel to *See It and Say It in Spanish*.

The two books represent different positions in the same learning arc. *See It and Say It* is conversation-first — the student speaks naturally before understanding why. *Magic Key* makes the structure explicit, using exercises and tables — but still through practice and self-discovery, never rule-recitation. Together they are the full pedagogy: first you feel the language, then you understand it.

HoloHola follows the same arc: Daniela's conversational sessions come first; Grammar Diagrams exist as the thing the student reaches for when they're ready to understand what they've already been doing.

---

#### Concept 1 — The Sentence-Forming Table (p. 90)

**What the page shows:**

A 4-column combination grid appearing under the heading **SENTENCE-FORMING EXERCISES**. The instruction: *"Combine the words below in different ways to form as many sentences as you can. Just be sure to use words from each of the columns in every sentence you form."*

Section A (question form):
- Col 1: `¿ / Va a` (fixed frame — question opener)
- Col 2: 8 verbs (comprar, trabajar, tomar, hablar, estacionar, estudiar, preparar, instalar)
- Col 3: 8 objects/contexts (una casa, mañana, la cena, por teléfono, el auto, la lección, el radio, un taxi)
- Col 4: 8 people (Roberto?, María?, Carlos?, Alicia?, el doctor?, su mamá?, su papá?, Marta?)

Section B (statement form):
- Col 1: 8 subjects (María, Carlos, Alicia, Marta, Roberto, El doctor, Mi mamá, Mi papá)
- Col 2: `va a` (fixed frame — the construction being drilled)
- Col 3: 9 verbs (exportar, importar, recitar, votar, copiar, visitar, aceptar, trabajar, tomar)
- Col 4: 8 objects (café, perfume, un poema, mañana, la lección, al paciente, la invitación, esta tarde, la cena, un taxi)

**The mathematical insight:**

Section A alone generates 8×8×8 = **512 unique valid questions** from one page. Section B generates 8×9×8 = **576 unique statements**. The student has over a thousand sentences available from a single page layout — without memorizing a single one. They are *generating* language, not recalling it.

**What this reveals about Madrigal's method:**

This is not drill-and-kill repetition. It is **combinatorial fluency practice** — the student internalizes that language is compositional. The same verb goes with different objects. The same object goes with different verbs. The frame (¿Va a...? / Subject + va a) holds constant while everything else rotates. The student stops thinking of sentences as units to memorize and starts thinking of them as things they can assemble from parts they own.

This is a fundamentally more powerful tool than our current M5 SentenceFrameGrid, which shows a fixed frame with one swappable column. Madrigal's version has **three or four swappable columns simultaneously**.

**What this means for HoloHola:**

Our M5 SentenceFrameGrid was designed as a single-slot fill-in structure — one fixed frame, one vocabulary column. The Magic Key shows us the extended version: multiple columns, each independently swappable, the student choosing freely from any combination. Daniela can implement this directly — she gives the frame, then asks the student to fill specific slots: "Tell me who. Now tell me what they're going to do. Now tell me what they're going to take." The student builds the sentence part by part, then Daniela responds to the full sentence they produced.

The translation exercise at the bottom adds the production layer: the student is given English sentences and must write Spanish using the column words as scaffolding. Daniela's equivalent: she says the English, the student produces the Spanish, she confirms. The columns are internalized support, not displayed scaffolding.

---

#### Concept 2 — The Cover-and-Check Method (verb list page)

**What the page shows:**

Five-step numbered procedure before a verb conjugation list:
1. Cover up the two right-hand columns
2. Remove "er" or "ir" from the infinitive in the left-hand column
3. Add "í" for "I"
4. Add "ió" for anybody else (third man)
5. Check your columns with those below

Then a three-column **VERB LIST**: INFINITIVES (bold italic Spanish + regular English) | I (yo past tense) | YOU, HE, SHE (él/usted past tense)

25+ ER/IR verbs: asistir/asistí/asistió, batir/batí/batió, confundir/confundí/confundió, etc.

**What this reveals about Madrigal's method:**

Three separate but related innovations on a single page:

**Innovation A — Algorithm over rule.** She does not say "the past tense of ER and IR verbs is formed by removing the infinitive ending and adding -í (yo) or -ió (él)." She gives a *numbered procedure*: cover, remove, add, add, check. A recipe, not a fact. The student follows steps, not memorizes a statement. The result is the same but the cognitive path is entirely different — procedural memory vs. declarative memory. Procedural memory is more durable.

**Innovation B — Active recall before confirmation.** The student is explicitly instructed to cover the answer columns and generate the form themselves before looking. This is self-testing built into a static page. Every cognitive science study of the last 30 years confirms that active generation beats passive reading by a factor of 2–3x for retention. Madrigal built this into a 1960 paperback without any of that research available to her.

**Innovation C — Minimum viable conjugation table.** She shows only two forms: I (yo) and he/she/you (él/ella/usted). Not the full 6-pronoun paradigm. This is the same deliberate choice she made in *See It and Say It* — beginners need I and he/she. The other forms can be derived once the pattern is clear. She never shows students more grammar than they need right now.

**What this means for HoloHola:**

The cover-and-check method is native to Daniela. She gives the infinitive. She waits. The student produces the conjugated form. She confirms or corrects. The student didn't read the answer — they generated it. This is already what Daniela does conversationally; the Magic Key confirms it's the right mechanism.

The algorithm framing (numbered steps) is something HoloHola has partially implemented in Grammar Diagrams but has not fully committed to. Grammar Diagrams currently show the pattern as a table. The Magic Key shows that a numbered procedure is more effective — it tells the student what to *do*, not just what the form *is*. This is worth applying to how Grammar Diagrams are written, not just structured.

The minimum viable conjugation principle (only yo and él/ella at first, not all six) should inform how VerbAnchorGrid presents verb information — show the two most useful forms prominently, defer the rest.

---

#### Concept 3 — The Pattern-Pounding Principle (David, April 11, 2026)

This is the insight that connects both exercises and explains why they work.

**The core mechanism:**

Traditional language teaching asks the student to memorize one verb across five or six conjugations:

> hablo / hablas / habla / hablamos / hablan

That is five separate facts attached to one word. The student has to hold the verb, the person, and the ending all simultaneously. It's fragile — if one element slips, the whole thing fails.

Madrigal's approach inverts this. Instead of drilling one verb in many forms, you drill **one form across many verbs**:

> Yo como. Yo nado. Yo corro. Yo compro. Yo estudio. Yo trabajo. Yo hablo. Yo tomo.

The student is not memorizing a conjugation table. They are having the **yo ending pounded into them** through dozens of encounters — each of which also happens to teach them a new verb. Two things are being reinforced simultaneously, but neither is being memorized as an isolated fact. The pattern (yo → -o for AR, -o for ER/IR) becomes automatic before the student has consciously registered that it exists.

The same mechanism operates in the past tense, the progressive, the future:
- Present: *como, nado, corro* → the -o is pounded in
- Past: *comí, nadé, corrí* → the -í is pounded in
- Future: *voy a comer, voy a nadar, voy a correr* → the *voy a* frame is pounded in

Each new verb the student learns is not a new piece of grammar to master — it is a new repetition of the same ending they've already been internalizing. The grammar load is fixed; only the vocabulary expands.

**Why the sentence-forming table works:**

The permutation table gives the student 512+ sentence combinations from a single page. The mathematical insight from the previous section (8×8×8) understates the pedagogical power. The real power is that every one of those 512 sentences pounds in the same construction — *¿Va a + verb + object + person?* — while incidentally introducing new vocabulary. The student is not drilling grammar. They are drilling vocabulary. The grammar is a byproduct of the repetition.

As each new word the student learns gets inserted into the same cognitive frame, the frame strengthens. The student doesn't learn "va a comprar" and "va a estudiar" as two separate phrases. They learn that *va a* is a slot, and anything that fits in a verb slot can go there. The grammar becomes a pattern-matching system rather than a lookup table.

**Why the cover-and-check verb list works:**

The five-step procedure hammers the same two endings (-í for yo, -ió for él) across 25+ verbs in a single sitting. By the time the student has covered and derived asistir → asistí / asistió, and then batir → batí / batisfió, and confundir → confundí / confundió, and repeated this for 22 more verbs — those endings are not memorized. They are *installed*. The student stopped consciously thinking about the ending after the fifth or sixth verb. The procedure runs automatically.

**What this means for HoloHola:**

The acquisition unit is **one grammatical pattern across many vocabulary items**, not **one vocabulary item across many grammatical forms**.

This has direct implications for how Daniela drills and how chapter content is structured:

1. **Daniela should drill by conjugation form, not by verb paradigm.** When introducing past tense, she doesn't conjugate one verb completely. She takes the student through ten verbs in yo-past: "¿Estudiaste? Sí, estudié. ¿Comiste? Sí, comí. ¿Nadaste? Sí, nadé." The -é ending is pounded in by the tenth exchange. The student has learned ten verbs and one conjugation, simultaneously, without ever looking at a table.

2. **The VerbAnchorGrid (M4) should show the anchor verb alongside several others in the same form.** Currently it shows one verb with examples. The pattern-pounding principle says: show the yo form of the anchor verb, then immediately show five other verbs in the same form. The anchor is the entry point; the cluster reinforces the pattern.

3. **The sentence-forming table is the native format for Daniela's oral drills.** She keeps the frame constant (*¿Va a...?*) and rotates the vocabulary. The student answers by inserting different words into the same slot. By the fifth rotation, the frame is automatic. By the fifteenth, the student is generating new combinations without prompting.

4. **Every new vocabulary word a student learns is a free repetition of every grammar pattern they've already absorbed.** This is the real return on investment of Madrigal's method — the student's vocabulary and grammar reinforce each other rather than competing for cognitive load. HoloHola should be designed so that new vocabulary is always introduced inside a known frame, never as an isolated word to be memorized.

---

#### Concept 4 — Compartmentalization and the Unlock Effect (David, April 11, 2026)

This is the compounding consequence of the Pattern-Pounding Principle. It explains why the method accelerates rather than plateaus.

**Compartmentalization:**

When you pound the yo form across thirty verbs, you are not building a list of thirty facts. You are building one compartment — a single cognitive container labeled "yo" — that holds thirty vocabulary items, all already conjugated. The ending is not a property of each verb; it is a property of the compartment. The student doesn't think "como ends in -o." They think "the yo compartment sounds like this."

Every new verb added to the compartment costs less than the one before it, because the student isn't learning a new ending — they're placing a new word into a container whose shape they already know.

**The Unlock:**

When Daniela then says — after the yo compartment has thirty verbs in it — *"just change the -o to -as"* for tú, something remarkable happens. The student is not learning thirty new verb forms. They are applying one transformation to an entire compartment they already own.

The tú compartment doesn't cost thirty units of learning. It costs **one**: the ending change. All thirty verbs come with it, instantly, as a group. The previous repetition on yo is not abandoned — it is **unlocked in a new form**.

The same unlock happens for él/ella (-a), nosotros (-amos), and ellos (-an). Each costs only one ending change. Each unlocks the full reservoir that pounding has been building since the beginning.

**The sentence-forming table becomes permanently reusable:**

The same four-column table — the same verbs, the same objects, the same frame — works for every person:
- Section A with *¿Va a...?* → unlock with *¿Vas a...?* → same 512 permutations, new person
- Section B with *María va a...* → unlock with *Yo voy a...* → same vocabulary, different ending

The student never needs a new table. They need a new key. Each key unlocks all previous work.

**The compounding return:**

This is the reason the method accelerates rather than plateaus. In a traditional course, learning tú costs exactly as much as learning yo — you start over with a new paradigm row. In Madrigal's method:

- Week 1: pound yo. Install 20 verbs in one compartment.
- Week 2: unlock tú. 20 verbs arrive free. Install 5 more in both compartments simultaneously.
- Week 3: unlock él. 25 verbs arrive free. Install 5 more in all three compartments simultaneously.
- Week 6: unlock nosotros. Now 40 verbs in four compartments, each new verb added goes into all four automatically.

By week 6, each new vocabulary word the student learns is **simultaneously a repetition of four different conjugation patterns**. The grammar load per new word approaches zero. Only the vocabulary cost remains.

**What this means for HoloHola:**

1. **Daniela introduces persons as unlocks, not new lessons.** The framing matters: "You already know all of these in yo. Here's one change that lets you use all of them with tú." Not "today we learn the tú form." She is handing the student a key to a room they've already furnished.

2. **The sequence is fixed by this logic.** You cannot unlock a compartment before building it. The person order matters: pound yo first, then unlock tú, then él, then nosotros, then ellos. This is not arbitrary — it reflects how the compounding effect works. Skipping yo to start with nosotros means there's nothing to unlock.

3. **Grammar Diagrams should be reframed as unlock events.** Instead of presenting the full 6-row paradigm as a table to read, they should present one transformation: "You know yo. Here is the key to tú." Then show only the two rows being connected — yo and tú — not all six. The others become their own unlock events when the student is ready.

4. **Each chapter chapter's VerbAnchorGrid (M4) is building a compartment.** The anchor verb is the one the student encounters most. The cluster of examples in the same form are the other verbs going into the same compartment. The M4 grid is not a vocabulary list — it is a compartment display.

5. **The unlock effect applies across tenses as well as persons.** Once the student has the yo present compartment (como, nado, corro), Daniela can unlock past: "just change -o to -é." Thirty present-tense verbs become thirty past-tense verbs for the cost of one transformation. Then progressive: "add estoy + the verb with -ando." Same thirty verbs, new tense, one cost.

---

#### Concept 5 — The Assessment Shift: Permutation as Proof (David, April 11, 2026)

This redefines what Daniela is listening for in every conversation. It is not what most language tools measure.

**The wrong metric:**

> "Did the student conjugate *comer* correctly?"

This is the metric used by grammar checkers, conjugation quizzes, and most language apps. It is not wrong — correct conjugation matters — but it is measuring the wrong thing. A student can memorize "como" and get it right every time without having installed the yo compartment at all. They just memorized one word.

**The right metric:**

> "Is the yo form of AR/ER verbs stable across all contexts?"

Stability means:
- The yo ending holds when the **verb changes** (como → nado → corro — does the -o stay automatic?)
- The yo ending holds after **negation appears** (como → no como — does the -o survive "no"?)
- The yo ending holds when **distraction is introduced** (a new subject is mentioned, then Daniela returns to yo — does the student track person correctly?)
- The yo ending holds when **vocabulary is unfamiliar** (a new verb is introduced in the infinitive — can the student produce the yo form without being taught it explicitly?)

The last one is the gold standard. If a student hears "bailar, to dance" for the first time and immediately says "bailo" when asked how they would say "I dance" — the compartment is installed. They didn't memorize "bailo." They derived it. The compartment is working.

**Permutation is the proof:**

A student who can permutate freely proves installation. A student who answers correctly once proves nothing. The distinction:

- *Correct once*: Student says "como" when asked "how do you say I eat?" — could be memorized.
- *Permutates*: Student says "como, nado, corro, compro, estudio" fluidly across a conversation without hesitation on each new verb — the compartment is installed.
- *Survives load*: Student says "no nado" correctly after just saying "como" — the yo form held through negation.
- *Derives new forms*: Student hears "bailar" and produces "bailo" — the compartment is generative, not just a list.

The sentence-forming table (Concept 1) is specifically designed to test permutation under controlled conditions. But Daniela does it conversationally — she varies the verb across a dozen natural exchanges and watches whether the ending stays automatic or requires visible effort each time.

**What Daniela is actually listening for:**

Daniela is not a grammar checker. She is a **pattern stability detector**. In every exchange involving a conjugated verb, she is running a silent diagnostic:

1. **Did the ending hold under this new verb?** — If yes, the compartment may be installed. If the student pauses noticeably or produces the infinitive instead, the compartment is still fragile.
2. **Did the ending hold through polarity change?** — Affirmative to negative is a classic disruption point. "I eat" → "I don't eat." Students who have only memorized the affirmative often lose the ending when "no" appears.
3. **Did the ending hold when the conversation moved away and returned?** — If Daniela talks about something else for several exchanges and then returns to yo, does the student still produce the right ending without effort?
4. **Can the student fill multiple slots simultaneously?** — In the sentence-forming table, can they produce subject + va a + verb + object without breaking form on any column? Simultaneous slot-filling proves that the frame is automatic, not constructed one piece at a time.

**How this changes Daniela's conversational strategy:**

When Daniela detects **wobble** (the ending drops or reverts to infinitive when the verb changes), she does not correct and move on. She returns to pounding. She cycles the same person form through several more verbs before introducing anything new. She is building the compartment back up to stability before loading it with new vocabulary.

When Daniela detects **stability** (the ending holds under load, across verbs, through negation), that is the signal to introduce the unlock. She presents the new person form as a transformation of something the student already owns solidly — not as a new lesson, but as a key.

When Daniela detects **derivation** (the student produces a correct form for a verb they've never seen conjugated), that is the signal that the compartment is fully operational. She can now accelerate — new vocabulary costs almost nothing, and unlocking new persons will happen quickly.

**The metric is reusability, not accuracy:**

A student who gets every conjugation right in a quiz may have memorized thirty individual forms. A student who can permutate across thirty verbs in yo and derive the form for a thirty-first verb they've never seen — that student has learned Spanish. The quiz cannot distinguish between them. Daniela's conversational pattern detection can.

This is the core assessment philosophy for HoloHola. It must flow into:
- Daniela's system prompt: she knows what she is listening for and why
- The conversation scoring model: permutation events and derivation events are higher-signal than single correct responses
- The ACTFL gauge advancement: a student who demonstrates permutation in yo form has cleared a real threshold, not just answered a question correctly

---

#### Concept 6 — The Trimodal Advantage: What Madrigal Could Never Do (David, April 11, 2026)

This is the competitive moat. It is not a feature list — it is a description of a combination that has never existed before.

---

**What the books could not do:**

*See It and Say It in Spanish* needed 199 pages of conversation lessons because it had no generative capability. Every permutation the student would ever need had to be pre-printed. Each column of vocabulary had to be physically typeset. Every new vocabulary set required new pages, a new print run, a new edition. The book is 300 pages because 300 pages was the only way to cover enough ground.

And it still ran out. No feedback loop meant the book could never know which compartments were installed and which were fragile. No personalization meant a 14-year-old soccer fan got the same columns as a 60-year-old traveler (taxi, restaurant, post office). No audio meant the student was imagining pronunciation, which is exactly where Spanish anxiety originates. No dynamic generation meant that when the student mastered one set of columns, the only option was to turn the page to a new set that Madrigal had designed years earlier.

---

**What HoloHola does that is categorically different:**

**1. The Visual Brain Dump — eye scanning at reading speed**

The sentence-forming table works at a speed that verbal instruction cannot match. When a student sees four columns of eight words each, the brain does not read them sequentially. It scans the entire grid in seconds and begins pattern-matching and permutating before consciously processing each item. The eye takes in "comprar / trabajar / tomar / estudiar" as a group — a vocabulary cluster — not as four separate words to be processed one at a time. This is reading-speed pattern acquisition. It is fundamentally faster than listening to four words spoken in sequence.

Madrigal understood this — it is the core reason her books are organized in columns and grids rather than in paragraphs. The column format is not aesthetically preferred; it is cognitively optimized. The student's visual system does the heavy lifting at a rate that speech cannot replicate.

**2. Daniela's Infinite Dynamic Column Generation — personalization at conversation speed**

Madrigal's columns were fixed at the moment of printing. "Taxi. Tren. Avión. Autobús." Those four words were chosen for a 1960s American traveler. They were the best choices for that student. They are not the best choices for every student.

Daniela generates new columns in real time, at conversation speed, tailored to the individual student. A student who loves cooking gets food vocabulary in the verb column. A student who plays sports gets sports verbs. A teenager gets the vocabulary they actually want to use. An executive gets professional contexts. The frame (*¿Va a + verb + object + person?*) stays identical — only the vocabulary in each column changes. The grammar pounding happens regardless of which vocabulary fills the slots.

The columns are not just personalized at setup — they adapt within a session. When Daniela detects that the student knows "comprar" cold but is hesitating on "estudiar," she generates more drill sentences with "estudiar" until the compartment strengthens. She effectively edits the column in real time based on what she is observing.

**3. Audio Confirmation — ear reinforces what the eye absorbed**

The student sees "nado" in a column. Their visual system registers it in passing as part of a cluster. Then Daniela says "nado" in a sentence — and the ear confirms what the eye already half-processed. The multi-channel encoding is significantly more durable than either channel alone. The student did not study "nado." They absorbed it visually, then heard it spoken in context, then produced it themselves in response to Daniela's question. Three encoding events for one word, in one exchange.

Madrigal had none of this. The student read. That was the entire sensory experience. Everything else — the mental image, the pronunciation, the response — had to be imagined.

**4. The Feedback Loop — adaptation based on what the student actually does**

When the student wobbles on a verb form, Daniela detects it and responds. When the student derives a new form correctly, Daniela names it and accelerates. When a student's interest shifts mid-session, Daniela rotates the vocabulary columns to match. The book never knew if anyone learned anything.

This feedback loop is what makes the method *compound* in real time, for this specific student, in this specific session. It is not just more efficient than the book — it is doing something the book was structurally incapable of doing.

---

**The combination:**

| Capability | See It and Say It | Magic Key | HoloHola |
|---|:---:|:---:|:---:|
| Visual column scanning (brain dump) | ✅ | ✅ | ✅ |
| Dynamic column generation | ✗ | ✗ | ✅ |
| Personalization to student interests | ✗ | ✗ | ✅ |
| Audio reinforcement | ✗ | ✗ | ✅ |
| Real-time feedback loop | ✗ | ✗ | ✅ |
| Pattern stability detection | ✗ | ✗ | ✅ |
| Infinite permutation capacity | ✗ | ✗ | ✅ |
| Unlock sequencing adapted to individual | ✗ | ✗ | ✅ |

Madrigal solved half the problem brilliantly with the tools she had. HoloHola completes the other half with tools she didn't have. The student gets the full method: visual pattern acquisition at reading speed, audio confirmation, dynamic vocabulary tailored to their life, a tutor who knows which compartments are installed and which need more pounding, and an infinite sentence-generating engine that never needs a new edition.

This combination cannot be replicated by a book, a static app, or a non-adaptive AI. It requires all four capabilities simultaneously. Daniela has them all.

---

#### Concept 7 — Mastery Enables Improv: Bring What You Got (David, April 11, 2026)

This is the destination that all the previous concepts are building toward. It is also a core HoloHola philosophy that must be understood by Daniela and reflected in every session design.

---

**The paradox of robotic mastery:**

The pattern-pounding approach sounds mechanical. It is mechanical — deliberately so. Pounding one conjugation form across thirty verbs until the ending is automatic is as non-spontaneous as practicing scales on a piano. But that is precisely the point. The musician who has practiced scales until their fingers move without thought is the one who can improvise. The musician who is still consciously thinking about where their fingers go cannot improvise at all — every bit of cognitive bandwidth is consumed by technique.

Language works the same way. A student who has the yo compartment installed — truly installed, not memorized — is no longer spending attention on conjugation. That attention is freed for something far more interesting: what they actually want to say. The grammar becomes transparent. The student stops being a grammar student and starts being a Spanish speaker who happens to use correct grammar.

**Mechanical mastery creates cognitive freedom. Robotic drilling enables organic conversation.**

---

**Permutation confidence = willingness to experiment:**

A student who knows they can mix and match — any verb from what they've installed, any object from what they know, any person from the compartments they've unlocked — is a student who is willing to try things. They don't need to know in advance that the sentence they're about to say is correct. They know that if the frame is right and the components are known, the sentence will work. So they try it.

This is the opposite of the paralysis most language learners experience: *"I can't say it until I know how."* The pounding-and-permutation method produces the opposite belief: *"I'll try it with what I have."* That belief is what enables conversation. Real conversation is not recall of memorized phrases — it is real-time construction from available components. Students who know how to permutate are already doing the cognitive work of a fluent speaker. They just need more vocabulary loaded into the compartments.

---

**"Bring what you got" — a HoloHola philosophy:**

The student does not wait to be fluent before speaking. They speak with what they have. Every session with Daniela is an opportunity to bring the vocabulary that is installed and use it — in new combinations, in response to unexpected questions, in topics the student actually cares about. The goal is not to execute perfect sentences from a rehearsed list. The goal is to keep the conversation moving using whatever is available.

Daniela's role in improv mode is to respond to meaning, not to police form. When a student is in improv mode — trying new combinations, taking conversational risks, constructing sentences they've never said before — Daniela does not stop to correct every small error. She responds to what the student meant, keeps the conversation alive, and lets the student feel what it is to use the language spontaneously. Error correction is for pounding sessions. Improv sessions are for deploying what's been installed.

The more the student permutates in improv sessions, the more Daniela can observe which compartments are genuinely solid and which ones are still fragile under creative pressure — which is a richer diagnostic than any structured drill provides.

---

**The accelerating cycle:**

Pounding builds compartments → compartments unlock freely → permutation confidence grows → student takes more risks → more improv practice → more opportunities for Daniela to detect wobble and stability → more targeted pounding → stronger compartments → more relaxed improv.

The cycle is self-reinforcing. Each phase feeds the next. And the student's experience of this cycle is not "I am doing drills and then having conversations." It is simply "I am getting better faster than I expected, and I don't know exactly why."

That "I don't know why" is Madrigal's original insight, alive in a new medium. The student is not aware they are learning grammar. They are aware they are speaking Spanish — and that each session, they have more to say.

---

#### The Two-Book Relationship — What It Tells Us About Sequencing

| | *See It and Say It in Spanish* | *Madrigal's Magic Key to Spanish* |
|---|---|---|
| Primary mode | Implicit acquisition through conversation | Explicit pattern recognition through exercise |
| Grammar explanation | None — grammar is demonstrated, never named | Named, but reached through procedure not rule |
| Drill type | Image-anchored Q&A (one slot, one question) | Combinatorial table (multi-slot, student-generated) |
| Self-testing | None built in — student imagines the answer | Cover-and-check explicitly built into page design |
| Intended student | Complete beginner — speaks before understanding | Student who speaks fluently and wants to understand why |

This is the arc that HoloHola naturally creates:
1. Student enters → Daniela converses → patterns are absorbed implicitly (= *See It and Say It* mode)
2. Student gains confidence → reaches for Grammar Diagrams → wants to understand the system (= *Magic Key* mode)
3. Grammar Diagrams exist as reference, not instruction — you go there when you're curious, not when you arrive

The danger to avoid: treating Grammar Diagrams as onboarding. They are the *Magic Key* — earned, not given. Daniela should lead with conversation and let the student discover grammar is available when they want it.

---

**Plan M1 — VocabQAGrid ✅ COMPLETE**

Built `VocabQAGrid` component in `TextbookInfographics.tsx`. Sky-blue accent, "full sentences" badge. Each card shows: question (italic/muted), answer (bold, play button), translation (below divider). Wired in `ChapterIntroduction.tsx`.

*Data seeded — greetings chapter:*

| Language | Q&A pairs | Key question |
|---|---|---|
| Spanish | 6 | ¿Cómo te llamas? / Mucho gusto / ¿Qué tal? |
| French | 6 | Comment vous appelez-vous? / Comment ça va? |
| Portuguese | 6 | Como se chama? / Tudo bem? |
| German | 6 | Wie heißen Sie? / Wie geht es Ihnen? |
| Italian | 6 | Come si chiama? / Come stai? |
| Japanese | 5 | はじめまして / お元気ですか？ |
| Korean | 5 | 이름이 뭐예요? / 어떻게 지내세요? |
| Mandarin | 5 | 你叫什么名字？ / 很高兴认识你。 |
| Hebrew | 5 | מה שמך? / מה נשמע? |
| English | 5 | What's your name? / How are you? |

*Data seeded — family chapter (session 42):*

| Language | Q&A pairs | Key question |
|---|---|---|
| French | 5 | Vous avez des frères et sœurs ? / Vos parents habitent où ? |
| German | 5 | Haben Sie Geschwister? / Wo wohnen Ihre Eltern? |
| Italian | 5 | Hai fratelli o sorelle? / Dove abitano i tuoi genitori? |
| Japanese | 5 | 兄弟姉妹はいますか？ / ご両親はどこにお住まいですか？ |
| Korean | 5 | 형제자매가 있어요? / 부모님은 어디에 사세요? |
| Mandarin | 5 | 你有兄弟姐妹吗？ / 你父母住在哪里？ |
| Portuguese | 5 | Você tem irmãos ou irmãs? / Onde moram seus pais? |
| English | 5 | Do you have brothers or sisters? / Where do your parents live? |
| Hebrew | 5 | יש לך אחים או אחיות? / איפה גרים ההורים שלך? |

*Data seeded — numbers chapter (session 43–44):* vocabQA (age/cost/time/counting/phone) + verbGroups for all 10 languages. Anchor verbs: tener/avoir/avere/ter (age), sein (DE), あります/います (JA), 이에요/예요 (KO), 有 (ZH), to be (EN), יש/אין (HE).

*Data seeded — daily chapter (session 46):* vocabQA (time/day/greeting/routine/availability) + verbGroups (anchor: "to do/make") for all 10 languages. ES: hacer, FR: faire, DE: machen, IT: fare, JA: します, KO: 이해하다/해요, ZH: 做, PT: fazer, EN: to do, HE: לעשות.

*Data seeded — classroom chapter (session 46):* vocabQA (repeat/how-do-you-say/understand/correct/meaning) + verbGroups (anchor: "to understand") for all 10 languages. ES: entender, FR: comprendre, DE: verstehen, IT: capire, JA: わかります, KO: 이해하다, ZH: 明白, PT: entender, EN: to understand, HE: להבין.

---

**Plan M2 — GenderAgreementGrid ✅ COMPLETE**

Built `GenderAgreementGrid` component. Two-column masculine/feminine table with **language-specific frame text** (session 41: ChapterIntroduction.tsx updated to pass per-language frames via inline record). Session 42 added `genderFrame?: { masculine; feminine }` field to `ChapterIntroContent` interface so each chapter can override the default language frame — critical for family chapters where the frame is "C'est mon ___." not "Il est ___." Violet accent. Translation key row at bottom. Wired in `ChapterIntroduction.tsx`.

*Data seeded — greetings chapter:*

| Language | Pairs | Notable teaching point |
|---|---|---|
| Spanish | 6 | estar adj: contento/a, cansado/a, ocupado/a, enfermo/a, nervioso/a, emocionado/a |
| French | 5 | être adj: joyeux/joyeuse, fatigué/fatiguée, occupé/occupée, **malade×2** (invariable!), nerveux/nerveuse |
| Portuguese | 6 | estar adj: **contente×2**, cansado/a, ocupado/a, **doente×2** (both invariable — contrast with Spanish) |
| Italian | 6 | essere adj: contento/a, stanco/a, occupato/a, malato/a, nervoso/a, emozionato/a |
| Hebrew | 5 | שמח/שמחה, עייף/עייפה, עסוק/עסוקה, **חולה×2** (invariable!), עצבני/עצבנית |
| German | — | Predicate adjectives don't inflect after *sein* — skip, no data needed |
| Japanese | — | No grammatical gender |
| Korean | — | No grammatical gender |
| Mandarin | — | No grammatical gender |
| English | — | No grammatical gender |

*Data seeded — family chapter (session 42):* genderFrame + genderPairs for FR/IT/PT/HE/ES (noun pairs, not adjectives — mon père/ma mère etc.); no genderPairs for DE/JA/KO/ZH/EN.

| Language | Family pairs | Frame used |
|---|---|---|
| Spanish | 5 | "Él es mi ___." / "Ella es mi ___." |
| French | 5 | "C'est mon ___." / "C'est ma ___." |
| Italian | 5 | "Lui è mio ___." / "Lei è mia ___." |
| Portuguese | 5 | "Ele é meu ___." / "Ela é minha ___." |
| Hebrew | 5 | "הוא ___ שלי." / "היא ___ שלי." |

*Data pending:* numbers/daily chapter gender pairs; discoveryNotes.

---

**Plan M3 — discoveryNote callout ✅ COMPONENT COMPLETE / ⬜ DATA PARTIAL**

Added `discoveryNote?: string` to `NarrativeSection` in `ChapterIntroContent`. Rendered as sky-blue callout with BookOpen icon and "Notice:" prefix — distinct from amber `tip` callout. Wired in `ChapterIntroduction.tsx`.

*Data seeded:* Spanish greetings only — "Notice: usted shares its verb ending with él and ella…"

*Data pending:* discoveryNotes for all 9 non-Spanish languages (requires reading each language's narrative sections to find the right attachment point).

---

**Plan M4 — VerbAnchorGrid ✅ COMPLETE**

Built `VerbAnchorGrid` component. Verb anchor card (large primary text + Repeat2 icon + "Verb Anchor" badge) + grid of example tiles (object word large/primary, full phrase small/secondary, translation muted, play button). Supports multiple verb groups per chapter. Wired in `ChapterIntroduction.tsx`.

*Data seeded — greetings chapter:*

| Language | Verb | verbHint highlight |
|---|---|---|
| Spanish | estar | "estar captures a temporary state — how something IS right now" |
| French | être | "être links you to descriptions — Madrigal calls this the identity bridge" |
| Portuguese | estar | "estar captures how something is right now — feelings, health, situations in flux" |
| German | sein | "sein links you to descriptions and identities — just as ser does in Spanish" |
| Italian | stare | "Italian uses stare, not essere, for how you feel" (key Madrigal distinction) |
| Japanese | です (desu) | "です ends nearly every polite Japanese sentence — the politeness seal" |
| Korean | 이에요/예요 | "이에요 follows consonants; 예요 follows vowels — covers half of all Korean introductions" |
| Mandarin | 是 (shì) | "是 links two equal things — I = student. For qualities, Chinese uses a different structure" |
| Hebrew | להיות (zero copula) | "In Hebrew present tense, 'to be' disappears entirely" (zero-copula discovery) |
| English | to be | "Every greetings answer in English uses 'to be'" |

*Data seeded — family chapter (session 42):*

| Language | Verb | Key pedagogical note |
|---|---|---|
| French | être | C'est mon père / Ce sont mes parents — singular vs. plural "c'est" |
| German | sein | Das ist mein Vater — mein/meine articles show up here |
| Italian | essere | È mio padre / È mia madre — possessives without article (unlike French) |
| Japanese | です (desu) | 父です vs. お父さんです — uchi/soto register distinction |
| Korean | 이에요/예요 | 아버지예요 (vowel) vs. 학생이에요 (consonant) rule in family context |
| Mandarin | 是 (shì) | Birth-order precision: 哥哥/弟弟/姐姐/妹妹 — no single word for sibling |
| Portuguese | ser | Ele é meu pai / Ela é minha mãe — ser for identity (not estar) |
| English | to be | He is / She is / They are — plural grandparents example |
| Hebrew | — (zero copula) | הוא אבא שלי — present-tense identity; שלי = "of me/mine" |

*Data pending:* numbers/daily chapter verb groups for all languages.

---

**Plan M5 — Image Integration for SentenceFrameGrid ✅ COMPLETE (session 43)**

The current `SentenceFrameGrid` is text-only. Madrigal's method is fundamentally image-driven — each filler card should show a picture so the student maps directly from image to Spanish without routing through English. Without images the drill degrades to a phrase list, which `QuickPhraseGrid` already provides.

Add an optional `imageKey?: string` field to `SentenceFrameItem` (already in the interface spec). When present, the card renders the vocab image from object storage at the top using the same URL pattern as `VisualVocabGrid`. Fallback: large styled filler text if no image is available.

**Implementation complete (session 43):**

1. **`imageKey?: string` field added** to `SentenceFrameItem` interface in both `chapter-intro-content.ts` and `TextbookInfographics.tsx`
2. **`GET /api/textbook/vocab-images-by-keys?keys=...`** — new batch endpoint added to `server/routes.ts`. Queries `media_files` WHERE `search_query IN (keys)` using the static `mediaFiles` schema import + `inArray` from drizzle-orm. Returns `{ images: { [key]: { url, source } } }`. Cap: 40 keys per request.
3. **`SentenceFrameGrid` updated** — collects all unique imageKeys across all frames, issues a single batch query, renders a `h-24` image container at the top of each card (animate-pulse skeleton while loading; first-letter initial if key has no image in DB). Filler text font size scales down slightly when image slot is present to maintain card proportion.
4. **Spanish greetings data updated** — all 12 filler items now carry `imageKey`:
   - Frame 1 ("¡___, amigo!"): hola/buenos dias/buenas tardes/buenas noches/adios/hasta luego → images confirmed in DB from GREETINGS_WORDS seed
   - Frame 2 ("Estoy ___."): bien/muy bien/mas o menos/mal/cansado/feliz → cansado + feliz confirmed in DB; others have graceful fallback
5. **Spanish family data updated** — all 12 filler items now carry `imageKey`:
   - Frame 1 ("Ella es mi ___."): madre/abuela/hermana/tia/prima/amiga → madre + hermana confirmed in DB
   - Frame 2 ("Él es mi ___."): padre/abuelo/hermano/tio/primo/amigo → padre + hermano confirmed in DB
6. `mediaFiles` added to static `@shared/schema` import in routes.ts; shadowing local variable at `/api/media/my-uploads` renamed to `userMediaFiles`

**Fallback contract:** when an `imageKey` has no match in `media_files`, the component shows the first letter of the filler word (large, muted primary) in the image slot — the card degrades gracefully and remains fully functional.

Authoring note: for the greetings "¡___, amigo!" frame, images would show time-of-day scenes (sunrise = Buenos días, afternoon sun = Buenas tardes, etc.) — these do not yet exist and would need to be generated.

**Image quality principle (noted April 10, 2026):**

Madrigal's book illustrations were drawn by Andy Warhol, working as a commercial illustrator before his Pop Art career. He was technically capable of far more sophisticated work and chose simple line drawings deliberately. The pedagogical reason is clear in retrospect: a realistic image competes with the language. The student's eye starts reading the picture instead of the word. A simple outline of a telephone says "telephone" and immediately gets out of the way.

The implication for HoloHola: the bar for SentenceFrameGrid images is *concept clarity*, not *visual quality*. A student needs to look at the card and know what the filler word means in under one second — then their attention returns to the sentence frame structure, which is the point of the drill. Our AI-generated watercolor images already meet this bar; the abstracted style removes detail that would distract.

**The one failure mode to avoid:** an image that is ambiguous at a glance. If "cansado" (tired) produced an image that could mean "bored" or "sad" instead, the drill misfires. This is an authoring and generation prompt problem, not a rendering quality problem. Choose concepts that have unambiguous visual representations. When in doubt, test by showing the image without the word and asking whether the meaning is immediate.

**Scanned pages as prompt fodder (noted April 10, 2026):**

David is scanning pages from the physical book. The scans are not being used to copy the images directly (copyright, and our watercolor style is better suited to HoloHola anyway). They are being used as a reference for *which moment in a concept is worth illustrating*.

This is a more useful kind of visual reference than a stock image library. Warhol's choices reveal the image that makes a word unambiguous — not the object itself, but the action or relationship that carries the meaning. A picture of a car is just a car. A picture of someone stepping out of a car at an airport tells you *viajar* (to travel) without a single word.

When generating images for M5 sentence frame fillers: look at the scanned page for the corresponding concept first. Use Warhol's chosen moment as the starting point for the AI generation prompt. The goal is not to match his style but to match his instinct about *what to show*.

**Plan M6 — CognateRecognitionGrid ✅ COMPONENT COMPLETE / ⬜ DATA PARTIAL**

Madrigal's preface opens by showing how many English words the student already owns in Spanish — this is both a pedagogical move and a psychological one. The student's belief that "Spanish is foreign" is dismantled before lesson one.

**Component:** `CognateRecognitionGrid` built in `TextbookInfographics.tsx` (session 40). Tiled grid of word-pair cards — English small/secondary → target-language large/primary. Category-grouped. Supports a `target?: string` field on each entry so any language can supply its own word instead of `spanish`. Component reads `entry.target ?? entry.spanish` for multi-language support. False friends rendered with distinct red "false friend" badge and `falseCognateNote` tooltip.

**Optional field:** `cognateOpener?: CognateEntry[]` on `ChapterIntroContent`. Each `CognateEntry`: `{ english, spanish?, target?, category, isFalseCognate?, falseCognateNote? }`.

**Data seeded — greetings chapter:**

| Language | Cognates | False friends | Status |
|---|---|---|---|
| Spanish | 18 (hotel, taxi, restaurant, sport, possible, important, excellent…) | 3 (embarazada, librería, actual) | ✅ |
| French | 18 (hôtel, taxi, restaurant, concert, possible, important, excellent…) | 3 (actuel, sensible, rester) | ✅ |
| Italian | 18 (hotel, pizza, radio, studio, importante, naturale, originale…) | 3 (camera, sensibile, attualmente) | ✅ |
| German | 18 (Hotel, Sport, Tennis, Internet, Computer, Moment, Telefon…) | 3 (aktuell, sympathisch, sensibel) | ✅ |
| Portuguese | 18 (hotel, táxi, restaurante, possível, importante, excelente, natural…) | 3 (polvo, borracha, pretender) | ✅ session 42 |
| Japanese | 17 (katakana: ホテル, タクシー, レストラン, コーヒー, テレビ, バス, スポーツ…) | 2 (マンション≠mansion, スマート≠smart) | ✅ session 42 |
| Korean | 17 (konglish: 호텔, 택시, 레스토랑, 커피, 텔레비전, 버스, 스포츠…) | 2 (핸드폰=cell phone, 아이쇼핑=window shopping) | ✅ session 42 |
| Mandarin | 15 (phonetic loans: 咖啡, 巧克力, 沙发, 比萨, 汉堡, 吉他, 幽默, 浪漫…) | 0 (no convenient false-friend category) | ✅ session 42 |
| Hebrew | 16 (international loans: טלפון, טלוויזיה, קפה, פיצה, בנק, ספורט, מוזיקה…) | 0 | ✅ session 42 |
| English | — | — | ⬜ Pending (English-as-L2 cognate strategy differs; Cindy/Blake context) |

*Note on non-Romance languages:* Japanese/Korean "cognates" are actually phonetic loans (katakana/konglish) rather than structural cognates — the component can still be used but the educational framing must change from "same spelling" to "same sound." This is a design decision to make when authoring the data.

**Non-linear navigation alignment:** Because each lesson is designed to stand alone, this card works at any ACTFL level — a Novice Low student gets the confidence rush, an intermediate student returning to the chapter gets a foundation reminder.

---

## Daniela Future Architecture — Brain/Hands/Session Separation

**Established:** April 12, 2026  
**Source:** Anthropic Engineering Blog — "Scaling Managed Agents: Decoupling the brain from the hands" (Lance Martin, Gabe Cemaj, Michael Cohen). Article saved at `attached_assets/Pasted-Skip-to-main-contentSkip-to-footer-Engineering-at-Anthr_1776010078392.txt`

This section documents where HoloHola's architecture should evolve, based on the Managed Agents pattern. Nothing here is built yet — this is the target architecture as we understand it today.

---

### The Brain/Hands/Session Framework Applied to HoloHola

The article identifies three components that should be decoupled into stable interfaces:

**Session** → the durable record of everything that happened, queryable selectively, living outside any individual Claude call.  
**Brain (harness)** → the reasoning and decision layer. Stateless; can fail and restart without losing session state because state lives in the session.  
**Hands (sandbox/tools)** → the execution layer. Each tool is `execute(name, input) → string`. The brain doesn't know or care what the hands are made of.

**For HoloHola:**

| Managed Agents concept | HoloHola equivalent |
|---|---|
| Session log | Student session state: compartment installation map, wobble events, Resonance Shelf, ACTFL position, pounding history |
| Brain (harness) | Daniela — the pedagogy reasoning layer |
| Hands (tools) | M1–M6 components, image pipeline, pronunciation model, ACTFL gauge, scoring model, sentence frame generator |
| `getEvents()` | Daniela queries the student's compartment state to decide: pound / unlock / improv |
| `execute(name, input) → string` | Every Daniela tool call: generate vocab grid, retrieve image, evaluate pronunciation, update ACTFL |

---

### The Stale Harness Problem

Harnesses encode assumptions about what the current model can't do on its own. Those assumptions go stale as models improve.

**Article example:** Claude Sonnet 4.5 exhibited context anxiety — wrapping up tasks prematurely as context limit approached. The harness added automatic context resets. When the same harness ran on Claude Opus 4.5, the behavior was gone. The resets had become dead weight.

**Applied to Daniela's system prompt:** Daniela's instructions are her harness. Instructions written to compensate for known model weaknesses become constraints on a more capable model. Instructions like "after every answer, explicitly check whether the student is ready to continue" may become unnecessary as models develop better natural pacing. Instructions like "do not attempt more than two vocabulary items in one exchange" encode assumptions that better models won't need.

**Design principle going forward:** Write Daniela's instructions around stable pedagogical goals, not model-compensating rules.
- **Stable goal (good):** "The unit of teaching is one grammatical pattern across many verbs, not one verb across many forms."
- **Model-compensating rule (goes stale):** "After each third response, summarize what the student has learned so far." — this may be compensating for context that a better model handles naturally.

Every instruction in Daniela's system prompt should be audited: *Is this a pedagogical principle that would be true regardless of which model runs it? Or is this compensating for something the current model struggles with?* The first category is durable. The second is dead weight waiting to happen.

---

### What Should Live Outside Daniela's Context Window

Currently all student state lives inside Daniela's context window. This is the "pet" problem — one context fill-up away from losing everything. The session state that should be externalized:

**Compartment installation map** — per-pattern status: `unstarted | pounding | wobbling | stable | generative`
- Examples: `yo-AR-present: stable`, `tú-AR-present: pounding`, `él-AR-present: unstarted`
- This is what Daniela uses to decide mode. It doesn't currently exist as a data structure.

**Pounding history** — which verbs have been drilled, in which form, how many times, last wobble timestamp

**Resonance Shelf** — vocabulary and phrases that had strong positive responses (student lit up, asked to hear it again, used it spontaneously). Already named in multiple sessions; not yet persisted outside the conversation.

**ACTFL position** — current level + trajectory (improving / plateauing / regressing per component)

**Wobble log** — timestamped record of every pattern instability event. Daniela should be able to query "has the yo form wobbled in the last 10 minutes?" without needing that data in her active context.

**Session metadata** — total session time, mode distribution (pounding vs. improv minutes), most recent unlock event

When this state lives in durable external storage, Daniela can run long sessions without context pressure, a session can resume after interruption without losing diagnostic history, and multiple session events can be aggregated over time to identify slow-developing weaknesses the student doesn't know they have.

---

### Daniela's Three Modes (not yet implemented)

The seven pedagogical concepts describe two Daniela modes; the full picture is three:

**Pounding mode**
- Triggered by: wobble detected, new compartment being built, student explicitly requests drilling
- Behavior: drill one grammatical pattern across many vocabulary items; correct form precisely; do not let inaccurate forms pass; rotate verbs not persons; detect stability before exiting
- Exit condition: stability across at least 3 unseen verbs (derivation achieved); OR student fatigue signal

**Unlock mode**
- Triggered by: stability confirmed in one person; next person in sequence not yet introduced
- Behavior: frame the new person as "you already own this — just change the ending"; demonstrate the transformation on 2–3 verbs from the existing compartment; let the student apply it before adding new vocabulary
- Duration: brief — unlock is a moment, not a session; transitions directly to pounding for the new person
- Key framing: "the key to tú costs one change and opens everything you already built"

**Improv mode**
- Triggered by: multiple compartments confirmed stable; student begins generating novel combinations; student takes conversational initiative
- Behavior: respond to meaning not form; keep the conversation alive; let errors pass unless they create communication failure; treat what the student produces as data, not as a test
- What Daniela listens for in improv: creative pressure reveals which compartments are genuinely solid vs. fragile — richer diagnostic than pounding alone
- Exit condition: wobble appears under creative pressure → return to targeted pounding for that compartment only

**Mode is not binary.** A session can open in improv (student is warmed up, wants to talk), dip into pounding when a wobble appears, hit a brief unlock moment, and return to improv — all in one conversation.

---

### Multi-Model Routing (future target)

Once brain/hands separation is clean, Daniela as orchestrator can route different tasks to the most appropriate model. This is the "many brains, many hands" principle from the article.

| Task | Appropriate model profile |
|---|---|
| Pattern stability detection | Small, fast, structured-output — runs continuously, classifies wobble/stable/generative |
| Improv conversation | Best available model — needs contextual richness, cultural awareness, nuanced response |
| Pronunciation evaluation | Audio-specialized model |
| Sentence frame generation | Structured-output optimized |
| Image key resolution | Retrieval, not generation — cached DB query |
| ACTFL gauge update | Structured-output + rules-based threshold logic |

No routing exists today. Everything goes through one Claude call. As the component count grows, the routing benefit grows proportionally — Daniela's core reasoning stays focused on pedagogy while specialized tools handle execution at the right cost/capability tradeoff.

---

### Cultural Character Image Audit (Rule 5 follow-on)

**Status:** ⬜ Not started
**Depends on:** Plan #5 canonical registry completing first

The canonical registry (Plan #5) will identify all tier-3 (SCENE_OVERRIDE) concepts. Currently every tier-3 image uses Spanish characters — Daniela and Marco. A French student seeing `bonjour` should see Juliette, not Daniela. The audit determines how many new images that actually means, and what generating them costs.

**The audit answers four questions:**

1. How many tier-3 concepts exist per language (current rough estimate: ~100 concepts × 8 non-Spanish languages = ~800 image slots)
2. Which are **pure character swaps** — same scene, just swap `CHAR.ES.primary → CHAR.FR.primary` — these can be batch-generated efficiently since only the character description changes
3. Which require **scene-level rewrites** — a Spanish plaza background is wrong for a French street scene even with a French-looking character; these need prompt authoring before generation
4. What the DALL-E budget looks like broken out by language priority

**Character profile map (for prompt templating):**

| Key | Characters | Cultural coding |
|-----|-----------|----------------|
| `CHAR.ES` | Daniela / Marco | Spanish/Latin American |
| `CHAR.FR` | Juliette / Antoine | French, Parisian styling |
| `CHAR.DE` | Anna / Stefan | German |
| `CHAR.IT` | Giulia / Luca | Italian |
| `CHAR.PT` | Sofia / Rafael | Brazilian Portuguese |
| `CHAR.JA` | Yuki / Kenji | Japanese |
| `CHAR.KO` | Soo-Jin / Ji-Ho | Korean |
| `CHAR.ZH` | Mei / Wei | Mandarin Chinese |
| `CHAR.HE` | Noa / Eitan | Israeli Hebrew |

**Recommended sequencing:** Complete Plan #5 (canonical registry) first so the audit runs against an authoritative list. Do not start generating language-specific character images until the registry tells us exactly which ones are needed — otherwise we risk generating images for concepts that will later be reclassified to tier 2 (shared) and can be served by the existing Spanish image anyway.

---

## Guiding Principle: Daniela Can Do Everything HoloHola Can Do

**Established:** Session 65, April 2026

Every HoloHola capability that can be expressed through language must be callable by Daniela from inside a tutoring session. This is not a feature request — it is the architectural contract that makes her a tutor rather than a chatbot.

**What this means in practice:**
- If HoloHola has a verb drill, Daniela can assign it verbally and record the result
- If HoloHola has a cognate rule (e.g. -ción/-tion), Daniela can explain it and show the list on the whiteboard
- If HoloHola has a vocabulary category, Daniela can call it up with `show_image()` or build a whiteboard
- If HoloHola can close a session and write notes, Daniela can trigger that herself (`close_session()`)

**Why this matters for visual assets:**
Every image, every whiteboard component, every scene prop we create should be designed with the assumption that Daniela will invoke it mid-conversation. That means:
- Alt text and concept labels must be machine-readable (Daniela passes `word` to `show_image()`)
- Scene props must have stable key names (Daniela calls `add_to_scene(prop, position)`)
- New image categories must be registered in the vocab image map so Daniela can call them

**The test:** Before shipping any new HoloHola feature, ask: "Can Daniela use this from a conversation?" If the answer is no, the feature is incomplete.

This principle was established after observing that drill assignment (Phase 1 of session-close architecture) required Daniela to have explicit visibility into `arisDrillAssignments` — a capability gap that was invisible until we looked for it. The `close_session()` function (Session 65) is the first example of a capability built specifically to give Daniela parity with the platform UI.

---

## Part I.O — Image Container & Generation Pipeline Audit (S__, May 2026)

**Purpose:** Ground-truth audit of every image container in the interactive textbook, image dimensions currently in production, all generation pipelines, and the DALL-E deprecation situation. Written before any regeneration decisions are made.

---

### Container Inventory

| Location | Component | Container dimensions | CSS fit | Ideal image shape | Status |
|---|---|---|---|---|---|
| Vocabulary cards | `VocabImageCard.tsx` | `aspect-square` (responsive) | `object-cover object-top` | Square | ✅ 1024×1024 fills perfectly |
| Infographics grid | `TextbookInfographics.tsx` | `aspect-square` | `object-cover object-top` | Square | ✅ Correct |
| See It Say It loop | `SeeItSayItLoop.tsx` | `aspect-square` | `object-cover` | Square | ✅ Correct |
| Narrative section headers | `ChapterIntroduction.tsx` | `md:w-2/5` × `h-48 md:h-full` — wide landscape on desktop | `object-cover object-center` *(fixed May 2026)* | Landscape preferred | ✅ Fixed — was `object-top`, now `object-center` |
| Conversation strip panels | `ChapterIntroduction.tsx` | `w-[160px] h-36` (160×144 px, slightly landscape) | `object-cover object-top` | Portrait preferred | ⚠️ Under review — see below |

---

### Chapter Narrative Header Fix (May 2026)

**Problem:** The narrative section image containers are wide-landscape on desktop (`md:w-2/5` of a full-width card, fixed `h-48` = 192 px). Images are generated at 1024×1024. When `object-cover` scales a square image to fill a wide container, it displays at roughly 800×800 px and `object-top` was showing only the top ~24% of the image — pure sky, no characters. Characters generated with the "lower two-thirds" composition rule were never visible.

**Fix applied:** Changed `object-top` → `object-center` on both the dynamic cover path and the static image path in `ChapterIntroduction.tsx` (lines 2435 and 2446). `object-center` shows the vertical midpoint of the image, which catches characters positioned anywhere in the middle two-thirds of the frame.

**Files changed:** `client/src/components/ChapterIntroduction.tsx`

**Future consideration:** If new narrative header images are generated, requesting them at `1792×1024` (DALL-E landscape format) would eliminate cropping entirely for this container. Hold until DALL-E replacement is settled.

---

### Conversation Strip Panels — Status: Under Review

The 10 existing strip images (panel-0-0.png through panel-2-2.png — Daniela, Agustín, Abuela Rosa) are **non-standard size: 896×1280 px** (portrait). They are one-off imports, not generated by the current `visual-content-service.ts` pipeline. These panels were an experiment in illustrated conversation comics.

**David's note (May 2026):** The conversation strip cartoon experiment may or may not survive the upcoming textbook cleanup. No regeneration or container changes planned until that decision is made. The existing images are in `client/public/strips/` and not part of the automated pipeline.

If the strip format is retained:
- Container (160×144 px, slightly landscape) + portrait images + `object-cover object-top` = shows top 63% of each image. Workable if character heads are in the upper half of frame.
- Ideal future images for this container: generate at `1024×1024` with characters framed in the upper half, or adjust container to `aspect-[7/10]` to match the existing 896×1280 ratio.

---

### Image Generation Pipeline — Current State (May 2026)

| Pipeline | File | Model | Size | What it generates |
|---|---|---|---|---|
| Scene / character images | `visual-content-service.ts` | **DALL-E 3 HD** | 1024×1024 | Daniela, characters, environments — watercolor style |
| Vocab props | `visual-content-service.ts` | `gpt-image-1` | 1024×1024 | Single objects on white background |
| Lesson images | `lesson-image-generator.ts` | **DALL-E 3** | varies | Lesson header art |
| Scenario images | `scenario-image-generator.ts` | **DALL-E 3** | varies | Roleplay scene art |
| Menu images | `menu-image-worker.ts` | **DALL-E 3** | varies | Food items for restaurant scenarios |
| Prop room backgrounds | `prop-room-compositor.ts` | **DALL-E 3** | varies | Environment backgrounds |
| Admin single-image fix | `routes.ts` | **DALL-E 3** | varies | One-off admin regeneration |
| Vocab seed library | `vocab-image-seed-service.ts` | via visual-content-service | 1024×1024 | Pre-seeded vocabulary images |

**Scene style:** `SCENE_STYLE` constant in `visual-content-service.ts` — pen-and-watercolor-wash, loose expressive ink lines, soft muted palette, warm Disney-style editorial illustration. This style was chosen because DALL-E 3 produces it naturally; other models require significant prompt engineering to approach it.

**Composition rule:** Characters positioned in lower two-thirds of canvas, generous headroom, heads never cropped at top of frame. Rotating `COMPOSITION_VARIANTS` injected per call to prevent repetitive two-people-facing-each-other poses.

---

### Google Imagen 1 for Scenes — Tried and Abandoned

**History:** Google's Imagen 1 was evaluated as a DALL-E 3 replacement for scene/character images. The motivation was the same as the gpt-image-1 anchor experiment: better character consistency and an alternative to DALL-E 3's style lottery.

**Result:** Quality was not competitive with DALL-E 3 for the HoloHola watercolor-wash aesthetic. Could not produce results visually similar to existing DALL-E 3 output. Abandoned as a primary pipeline replacement. No Imagen 1 calls remain in the active codebase.

**What Alden uses Gemini Imagen for:** Alden has generated one-off specific assets using Gemini Imagen (zone images, prop room watercolor backgrounds for the restaurant environment). These are hand-crafted single images produced manually, not part of the automated pipeline. Quality for those specific use cases was acceptable.

---

### Code Note: `generateImageWithGemini()` Is Misleadingly Named

The function `generateImageWithGemini()` in `server/routes.ts` (line 536) **actually calls DALL-E 3**, not Gemini. It uses the OpenAI client with `model: 'dall-e-3'` at `1792×1024`. The name is a historical artifact. Alden documented this explicitly. When DALL-E 3 is replaced, this function is one of the callsites that needs updating.

---

### gpt-image-1 (OpenAI) — Current Role: Props Only, Preserved

**Status:** Active and not deprecated. Used exclusively for vocabulary prop images (single objects on white backgrounds) in `visual-content-service.ts`. Will continue in this role regardless of what replaces DALL-E 3 for scenes.

**Why it works for props but not scenes:** Props only need clean object isolation on a white background — style fidelity matters less. Scene images require the warm pen-and-watercolor aesthetic that DALL-E 3 produces naturally and gpt-image-1 does not reliably match.

**Code artifact — anchor image experiment:** The `anchorImageUrl` parameter in `VisualGenerationRequest` and the `images.edit` path in `vocabulary-image-resolver.ts` were from an experiment using gpt-image-1 with a reference image to improve character consistency. These remain in the codebase and are exercised for prop generation when an anchor image is available.

---

### DALL-E Deprecation — May 12, 2026

OpenAI is discontinuing DALL-E 3 on **May 12, 2026**. The following files call `dall-e-3` directly and will break:

| File | Risk | Notes |
|---|---|---|
| `visual-content-service.ts` | 🔴 High | Core pipeline — all scene/character images |
| `vocab-image-seed-service.ts` | 🔴 High | Seeding 1,000+ vocab words via visual-content-service |
| `lesson-image-generator.ts` | 🟡 Medium | Chapter header art |
| `scenario-image-generator.ts` | 🟡 Medium | Roleplay scenes |
| `menu-image-worker.ts` | 🟡 Medium | Food imagery |
| `prop-room-compositor.ts` | 🟡 Medium | Environment backgrounds |
| `routes.ts` → `generateImageWithGemini()` | 🟡 Medium | Misleadingly named — calls DALL-E 3 at 1792×1024 for admin/zone images |

**Replacement candidates — Google models (untested for HoloHola aesthetic):**

| Model | Provider | API | Notes |
|---|---|---|---|
| **Imagen 1** | Google | Vertex AI | Tried and rejected — quality insufficient |
| **Imagen 2** | Google | Vertex AI | Not yet tested — candidate |
| **Imagen 3** | Google | Vertex AI | Not yet tested — leading candidate |
| **Gemini image gen** | Google | Gemini SDK | Alden has used for one-off assets; not tested at scale for watercolor scenes |

**Decision made May 9, 2026.** See "Image Engine Evaluation — May 2026" section below for full test results, cost comparison, and per-callsite replacement assignments. All seven DALL-E 3 callsites will be migrated to Google engines. No gpt-image-1 stopgap needed — evaluation completed before the May 12 deadline.

---

### Replacement Test Matrix — What Must Be Validated Before Migration

There are three distinct DALL-E 3 call paths, each with different requirements. The replacement model must be evaluated against all three — a model that passes one may fail the others.

#### Test Case 1 — Character scenes with SCENE_OVERRIDES (e.g. "hola", "adios")
These words have hand-written scene descriptions in `SCENE_OVERRIDES` in `vocab-image-seed-service.ts`. The prompt is a detailed character description (Daniela waving at a school entrance, Rosa on the front porch, etc.). The replacement must:
- Respect named character descriptions (age, appearance, skin tone)
- Produce soft watercolor-wash style, not flat digital cartoon or photorealistic
- Place characters correctly in lower two-thirds with headroom

**Test prompts to run:** Use the `hola` and `adios` SCENE_OVERRIDES strings verbatim + `SCENE_STYLE` appended. Compare output from each candidate model side-by-side with the existing DALL-E 3 outputs.

#### Test Case 2 — Environment/nature scenes (e.g. "beach", "grass", "waves", "playa", "mar")
These words trigger `isSceneConcept()` in `vocabulary-image-resolver.ts` and route to the scene pipeline. No character is in the frame — these are environment illustrations only. The replacement must:
- Render outdoor/nature environments in the watercolor-wash style
- Produce clean, non-cluttered compositions that read clearly as vocabulary anchors
- Work without character descriptions (prompt is the concept word + context + `SCENE_STYLE`)

**Test prompts to run:** `"A wide sandy beach with gentle waves"`, `"Rolling green grass hills"`, `"Ocean waves at sunset"` — all with `SCENE_STYLE` appended.

#### Test Case 3 — Daniela's live in-chat on-demand generation
When Daniela calls `show_image(word, scene)` during a voice session for a word not in the cache, `vocabulary-image-resolver.ts` generates it on the fly via DALL-E 3. The `scene` parameter is Daniela's own natural-language description of what she wants drawn (e.g. "a smiling woman at a beach with waves in the background"). This is the hardest test case because:
- The prompt is free-form, not from a curated override list
- It must work at low latency (student is waiting mid-conversation)
- Daniela's scene description style varies widely
- The model must handle unexpected concepts gracefully

**Test prompts to run:** Simulate several Daniela-style scene descriptions: `"a young woman walking through a colorful market"`, `"two friends sharing food at a wooden table outside"`, `"a quiet library with afternoon light through the windows"` — all with `SCENE_STYLE` appended. Check generation time as well as quality.

---

### Open Questions

1. **Do conversation strips survive the textbook cleanup?** Decision pending David's review. If yes, decide whether to regenerate at a standardized size or adjust containers to match existing 896×1280 images.
2. **Which Google model replaces DALL-E 3?** ✅ RESOLVED May 9, 2026 — see "Image Engine Evaluation — May 2026" below. Per-use-case assignments made.
3. **Narrative header images — regenerate at landscape?** Currently 1024×1024. Worth regenerating at `1792×1024` once Imagen 4 Ultra migration is live — the wide landscape container will crop less.
4. **Character consistency strategy.** Imagen 4 supports reference images via the SDK. Once canonical reference images for Daniela and Rosa are defined, pass them at generation time for all scene/character calls. This is the primary upside over DALL-E 3.
5. **Sticker/cutout effect on Imagen 4 Standard environment scenes.** When prompted with "landscape only, no people", Imagen 4 Standard occasionally renders the scene as a floating illustration on white rather than full-bleed. Fix: add `"full bleed background, edge to edge, no white borders, no vignette"` to environment prompts.

---

## Image Engine Evaluation — May 2026

**Date:** May 9, 2026  
**Purpose:** Pre-migration side-by-side evaluation of six image generation engines across five use-case categories to determine DALL-E 3 replacements before the May 12, 2026 deprecation deadline.  
**Test tool:** `/admin/image-test` — purpose-built evaluation page running all six engines in parallel with per-engine retry and full-size lightbox.  
**Engines tested:** `dall-e-3`, `gpt-image-1`, `gpt-image-1-prop`, `gemini-2.5-flash-image`, `imagen-4.0-generate-001` (Imagen 4 Standard), `imagen-4.0-ultra-generate-001` (Imagen 4 Ultra)

---

### Test Categories and Observations

| Category | Prompt used | Key finding |
|---|---|---|
| Character scene | `hola` (Daniela + school entrance SCENE_OVERRIDE) | Google engines competitive; Google character rendering warm and clear; DALL-E 3 slightly more dramatic atmosphere |
| Environment | Beach (generic `playa` prompt) | DALL-E 3 clearly best on default prompt — cinematic detail, ocean spray, no unwanted people; Google engines flat and populated |
| Environment (tuned) | Beach with `"no people, landscape only, wide establishing shot, full bleed, edge to edge"` added | **Gap closed.** Imagen 4 Standard and Ultra both produce vivid, detailed beach scenes on par with DALL-E 3. Confirms gap was prompt engineering, not capability. |
| Freeform / live-session | Farmers market scene (Daniela-style description) | DALL-E 3 most cinematic (dramatic god-rays, backlit silhouette). Google engines produce warm watercolor style — clearer character faces, faster, pedagogically better for vocab teaching. |
| Props (white bg) | Apple | **DALL-E 3 fails completely.** Run #1: giant surrealist apple with people. Run #2: abstract paint splatter. Google engines (all three) produce perfect photorealistic clean-background objects. gpt-image-1-prop acceptable but 28s. |
| Cultural scene (custom) | `una familia hispana cenando juntos, mesa con comida tradicional, ambiente cálido` | All engines produce usable results. DALL-E 3 has more atmospheric depth (candlelight, fireplace glow). Google engines warm, clear, culturally accurate — adequate for educational use. Speed gap decisive. |

---

### Speed Benchmarks (observed across all tests)

| Engine | Typical latency | Notes |
|---|---|---|
| `gemini-2.5-flash-image` | **5–7s** | Fastest by significant margin |
| `imagen-4.0-generate-001` | **6–9s** | Slightly slower than Flash, cleaner props |
| `imagen-4.0-ultra-generate-001` | **9–14s** | Best detail; still 2–4× faster than DALL-E 3 |
| `dall-e-3` | **25–35s** | Retiring May 12, 2026 |
| `gpt-image-1` | **34–43s** | Slowest tested; not a replacement candidate |
| `gpt-image-1-prop` | **28–44s** | Acceptable for props only; dominated by Google speed |

---

### Cost Comparison

| Engine | Cost per image | Notes |
|---|---|---|
| `gemini-2.5-flash-image` | **~$0.001** | Token-based: ~1,290 output tokens × $0.60/M = ~$0.0008/image. Effectively free at HoloHola scale. |
| `imagen-4.0-generate-001` (Imagen 4 Standard) | **~$0.02–$0.04** | Per-image billing via Gemini Developer API |
| `imagen-4.0-ultra-generate-001` (Imagen 4 Ultra) | **$0.06** | Confirmed pricing; premium tier |
| `dall-e-3` standard | $0.04 | Retiring May 12, 2026 |
| `dall-e-3` HD | $0.08 | Retiring May 12, 2026 |
| `gpt-image-1` medium | ~$0.04–$0.08 | Not a replacement candidate |

**At HoloHola scale (estimate ~500 images/month across all live sessions + seed generation):**
- DALL-E 3 HD current cost: ~$40/month
- Imagen 4 Ultra for all calls: ~$30/month (25% cheaper, better latency)
- Gemini Flash for live session calls + Imagen 4 for batch/seed: ~$5–8/month (80–90% reduction)
- Recommended mixed approach: ~$12–15/month total

---

### Rate Limits (Gemini Developer API, as of May 2026)

| Engine | Free tier | Tier 1 (billing linked) | Tier 2 ($250+ spent) | Tier 3 ($1,000+ spent) |
|---|---|---|---|---|
| `imagen-4.0-generate-001` | 2 IPM, ~100 RPD | 10 IPM | 20 IPM | 100+ IPM (negotiated) |
| `imagen-4.0-ultra-generate-001` | 2 IPM | 10 IPM | 20 IPM | 100+ IPM |
| `gemini-2.5-flash-image` | 500 RPD, 10 RPM | Much higher (TPM-based) | Standard Flash limits apply | Standard Flash limits apply |

**HoloHola note:** At HoloHola's current usage, Tier 1 (billing linked, no minimum spend) is sufficient. 10 IPM on Imagen means up to 10 simultaneous live-session image calls — more than enough. Gemini Flash's RPD-based limit at 500/day is generous for live sessions. Tier 2 available for ~$150 cumulative Cloud spend if we ever need burst capacity for batch re-seeding.

**IPM = Images Per Minute.** This is the critical metric for Imagen models, not RPM. Each request generates 1 image.

---

### Decision: Per-Use-Case Engine Assignments

The architecture already separates props from scenes (different code paths in `vocabulary-image-resolver.ts`). The replacement follows the same split — no architectural change, just engine swaps.

**⚠ UPDATED DECISION — May 9, 2026:** The Imagen 4 three-tier plan below was the initial recommendation from the May 2026 evaluation. After further A/B testing and observing Imagen 4 preview API instability (503 RAI failures, 500 internal errors), the final decision was revised to a **two-engine Gemini Flash strategy**. See "Final Engine Assignment" table below — that is the implemented plan.

| Use case | Old engine | Initial recommendation | Final decision |
|---|---|---|---|
| **Vocabulary props** (single objects, white bg) | `gpt-image-1` | `imagen-4.0-generate-001` | **Base Gemini Flash** |
| **Character scenes** (Daniela, characters in context) | `dall-e-3` | `imagen-4.0-ultra-generate-001` | **Gemini Warm** |
| **Environment scenes** (landscapes, locations, no character) | `dall-e-3` | `imagen-4.0-ultra-generate-001` | **Base Gemini Flash** |
| **Live session / freeform** (`show_image()` during voice chat) | `dall-e-3` | `gemini-2.5-flash-image` | **Gemini Warm** |
| **Lesson header art** | `dall-e-3` | `imagen-4.0-ultra-generate-001` | **Base Gemini Flash** (custom prompt) |
| **Scenario roleplay scenes** | `dall-e-3` | `imagen-4.0-ultra-generate-001` | **Base Gemini Flash** (custom prompt) |
| **Menu food images** | `dall-e-3` | `imagen-4.0-generate-001` | **Base Gemini Flash** (custom prompt) |
| **Prop room backgrounds** | `dall-e-3` | `imagen-4.0-ultra-generate-001` | **Base Gemini Flash** (custom prompt) |
| **Admin/one-off regen** (`generateImageWithGemini()` in routes.ts) | `dall-e-3` | `imagen-4.0-ultra-generate-001` | **Base Gemini Flash** (custom prompt) |

---

### Final Engine Assignment (May 9, 2026 — revised May 11, 2026)

> **May 11 revision:** Two assignments changed based on live testing. Live-session freeform moved from Gemini Warm → Gemini Base + reference (Warm's portrait crop is wrong for arbitrary scene descriptions). Environments moved from Base Gemini Flash → gpt-image-1 prop (David confirmed gpt-image-1 prop produces vivid, high-quality beach/landscape scenes — clearly superior to Gemini Flash's soft muted watercolor output for this use case).

**Where environments appear in the product — two distinct contexts:**
1. **Vocabulary anchor images** — words like `playa`, `mar`, `hierba`, `pradera` that hit `isSceneConcept()` in `vocabulary-image-resolver.ts` and route to the scene pipeline. These appear as vocab cards in the textbook.
2. **`visual_environments` table** — full-bleed backgrounds for the immersive prop room and classroom window scenes. When Daniela calls `open_scene("beach")` or changes the window view, it pulls from here. These are the stage backdrops behind props in roleplay.

Both environment contexts now use gpt-image-1 prop.

| Engine | Style constant | When to use | Code path |
|---|---|---|---|
| **Gemini Warm** | `SCENE_STYLE_WARM` | Daniela + character scenes with named characters | `generateCharacterScene()` in `google-image-service.ts` → called by `visual-content-service.ts` `type='infographic'` |
| **Gemini Base** | `SCENE_STYLE` | Live-session freeform (`show_image()` during voice chat) + reference image passed alongside prompt | `generateFromCustomPrompt()` in `google-image-service.ts` — Daniela's free-form scene descriptions |
| **gpt-image-1 prop** | `PROP_STYLE` (extended for landscapes) | Environment scenes — both vocab anchor images and `visual_environments` backgrounds | `generateEnvironmentScene()` in image pipeline; also used for batch-generating `visual_environments` backgrounds |
| **Base Gemini Flash** | custom prompt | Lesson header art, scenario covers, menu food, prop room compositor, admin one-off regen | `generateEnvironmentScene()`, `generateFromCustomPrompt()`, `prop-room-compositor.ts`, `lesson-image-generator.ts`, `scenario-image-generator.ts`, `menu-image-worker.ts` |

**Why warm for characters only:**
- `SCENE_STYLE_WARM` has a tight waist-up portrait crop baked in — correct for Daniela but wrong for a beach, a banana, or a free-form scene description
- `SCENE_STYLE` with wide framing + reference image is correct for Daniela's live freeform `show_image()` calls

**Why gpt-image-1 prop for environments:**
- David confirmed (May 11, 2026) that gpt-image-1 prop produces vivid, detailed beach/landscape scenes that are superior to Gemini Flash's muted watercolor output for the environment use case
- Gemini Flash environment output (5–7s, ~$0.001) is technically fast and cheap, but the visual quality for landscapes was noticeably softer and less compelling
- gpt-image-1 prop (28–44s) is slower, but environment images are pre-generated and cached in `visual_environments` — latency at generation time is acceptable since students never wait for them live
- For Daniela's live session `show_image()` on environment words mid-conversation, the latency tradeoff requires a decision: either pre-cache common environment words, or accept Gemini Base for live-session env words and gpt-image-1 for batch pre-generation only

**Style constants live in:** `server/services/google-image-service.ts` (canonical) — do not edit the copies in `visual-content-service.ts` or `image-engine-test.ts` independently.

**Warm prompt status:** `SCENE_STYLE_WARM` is still being tuned. The portrait crop and warm palette are confirmed. The white border/frame artifact is parked as a potential postcard aesthetic. Future tweaks: adjust golden backlight intensity, test tighter vs. slightly wider crop.

---

### Prompt Tuning Notes for Google Engines

The DALL-E 3 `SCENE_STYLE` constant was written for DALL-E 3's specific response patterns. Google engines respond well to the same style direction but need a few additions:

**For all scene/character calls (Imagen 4 Ultra):**
- Keep existing `SCENE_STYLE` content unchanged
- Add: `"full bleed background, color and content to every corner, no white borders, no vignette, no color bars"`
- This prevents the floating-illustration / sticker effect observed on some Imagen 4 Standard environment renders

**For environment/landscape scenes specifically:**
- Add: `"no people, no figures, landscape only, wide establishing shot"`
- Confirmed effective: the beach test with these additions produced results directly on par with DALL-E 3

**For live session / Gemini Flash freeform:**
- The Flash model interprets style prompts well but leans toward softer, more painterly output
- Its slightly-softer aesthetic is actually well-suited to the educational context (warmer, less intense than DALL-E 3's cinematic output)
- Daniela's free-form scene descriptions work naturally with Flash — no additional prompt engineering required

**What NOT to change:**
- The `COMPOSITION_VARIANTS` rotation (lower two-thirds character placement) — keep as-is
- The hair/clothing rules in `DALL_E_STYLE` constants — still apply to Google engines
- The "no text, no typography" rule — still required for all engines

---

### Callsites to Update (Implementation Phase)

Seven files need updating. All can route through a new shared `generateImageGoogle()` utility function rather than touching each file individually.

| File | Current model | New model | Priority |
|---|---|---|---|
| `visual-content-service.ts` | `dall-e-3 HD` | `imagen-4.0-ultra-generate-001` (scenes) / `imagen-4.0-generate-001` (props) | 🔴 High — core pipeline |
| `vocab-image-seed-service.ts` | via visual-content-service | Inherits from above | 🔴 High |
| `lesson-image-generator.ts` | `dall-e-3` | `imagen-4.0-ultra-generate-001` | 🟡 Medium |
| `scenario-image-generator.ts` | `dall-e-3` | `imagen-4.0-ultra-generate-001` | 🟡 Medium |
| `menu-image-worker.ts` | `dall-e-3` | `imagen-4.0-generate-001` | 🟡 Medium |
| `prop-room-compositor.ts` | `dall-e-3` | `imagen-4.0-ultra-generate-001` | 🟡 Medium |
| `routes.ts` → `generateImageWithGemini()` | `dall-e-3` at 1792×1024 | `imagen-4.0-ultra-generate-001` | 🟡 Medium |

**Recommended implementation approach:** Create `server/services/google-image-service.ts` as the single integration point for all Google image generation. Export two functions: `generateSceneImage(prompt)` → Imagen 4 Ultra, `generatePropImage(prompt)` → Imagen 4 Standard. All seven callsites import from this service. Live session `show_image()` path gets a separate `generateLiveImage(prompt)` → Gemini Flash for latency-critical calls.

---

### Previous Evaluation: Imagen 1 (Tried and Rejected, 2025)

For historical context: Google Imagen 1 was evaluated as a DALL-E 3 replacement in 2025. Quality was not competitive — could not produce results visually similar to the existing DALL-E 3 watercolor-wash library. Abandoned with no remaining callsites. Imagen 4 (2026) is a fundamentally different product and passed all evaluation categories.

