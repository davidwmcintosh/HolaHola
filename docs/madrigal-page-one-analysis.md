# The Madrigal Page: A Complete Element-by-Element Analysis

**Source pages:** *See It and Say It in Spanish*, pp. 9–13 (Lesson 1, *ir*)  
**Purpose of this document:** Canonical design spec for every HolaHola Verb Unit page. Every element that appears on a Madrigal lesson page is here, in order, with its exact presentation, its pedagogical "how," and its "why." The goal is not to replicate Madrigal's print design — it is to understand the engineering decisions well enough to replicate the cognitive effect in a digital medium.

**The central principle:** The page layout is part of the pedagogy. Every lesson page in See It and Say It uses the same layout. The student's eye knows exactly where to look before they read a single word. By lesson 3, the visual shape of the page IS the learning ritual. Deviation from the layout is a distraction; consistency is a cognitive gift.

**The Vocabulary Cluster Principle (the deepest Madrigal rule):**
Each lesson page organizes around exactly two things: one verb and one vocabulary cluster. The verb is the constant. The cluster is the variety.

> voy al hotel / voy al banco / voy al restaurante / voy al teatro / voy al cine / voy al parque

The verb (`voy / va`) never changes across the entire lesson spread — not in the positive images, not in the negative section, not in the Q&A, not in the drill. What changes are the nouns: a cluster of places that share a semantic field (city destinations in Lesson 1, classroom objects in Lesson 3, family members in Lesson 5).

This means: the variety in a Madrigal lesson is **never verb variety**. It is always **noun variety within a cluster**. The student is not learning "here are six verbs"; they are learning "here is one verb applied to six members of a family" or "here is one verb applied to six rooms of a house." The verb bonds with the cluster through repetition. Both are acquired together.

**Why this distinction matters for generation:** When Claude generates `negativeItems`, `questionItems`, or `sentenceColumns`, the temptation is to introduce multiple verbs to "show variety." This is exactly wrong — it converts an acquisition exercise into a grammar survey. The noun changes; the verb never does.

---

## Before the Lesson Begins: The Book's Opening Move (pp. 1–8)

Madrigal doesn't open with grammar. She opens with a promise: "You already know Spanish." Pages 1–8 are entirely devoted to establishing confidence — cognates, pronunciation, the idea that the student is already further along than they think. By the time page 9 arrives, the student is relaxed, curious, and expecting success.

**HoloHola equivalent:** Daniela's opening session mirrors this. She speaks Spanish immediately, scaffolds English only when needed, and positions the student as already capable. The cognate awareness moment ("¿Hospital? That's Spanish.") serves the same function as Madrigal's confidence opening.

**Why this matters for layout:** When the student reaches page 9, they are in a state of low anxiety. The page layout must preserve that state. Nothing on the page should look hard, dense, or like a test.

---

## Page 9: The First Lesson Page

### Element 1 — The Anchor Block (top of page, two lines, large white space between them)

```
Voy,   I'm going.


Al,    to the.
```

**Exactly what appears:** Two short lines. "Voy" on the left, comma, then "I'm going." on the right. Large vertical space — nearly a third of the line height of the page. Then "Al" on the left, comma, then "to the." on the right.

**How:** Left-justified Spanish. Right-justified or inline English gloss. They are not sentences. They are not in a table or box. They are just… there, separated by white space.

**Why the space:** The white space is structural, not decorative. It forces the eye to register each item as a separate thing. The student's brain parses: "there is a verb (voy), and there is a function word (al)." If these were on adjacent lines with normal line spacing, the brain would read them together as a unit and miss the structure. The space says: *these are the pieces. They go together, but they are distinct pieces.*

**Why only two things:** Madrigal gives you the minimum viable decomposition of the sentence "Voy al hotel." The verb. The connector. Not the noun — the noun comes with the images. Not conjugation rules — those come from the drill. Just the two building blocks that make every sentence on the page work. More than two items here would overwhelm the anchor.

**Why the English gloss is inline:** The English is not a translation note or footnote — it is presented at equal visual weight, right next to the Spanish. This signals: the English and Spanish are equals. You are not translating; you are recognizing a pair. This is a subtle psychological move that positions the student as someone who *knows* the word, not someone who is *looking it up*.

**HoloHola equivalent:** The `patternLabel` field. Displayed at the top of the Verb Unit page, before any images, before any Q&A, before the drill. The format should mirror Madrigal's anchor: two or three items, large text, generous white space between them, Spanish on one side and English on the other. Not a sentence. Components.

---

### Element 2 — The Image Grid with Positive Sentences (lower half of p. 9)

```
[hotel image]      [banco image]
Voy al hotel.      Voy al banco.

[garage image]     [restaurante image]
Voy al garage.     Voy al restaurante.
```

**Exactly what appears:** A 2×2 grid (four images). Each image is a simple line drawing — instantly identifiable, no background clutter. Beneath each image: a complete sentence in Spanish. No English translation beneath the sentences. The English from the anchor (Voy = I'm going, Al = to the) is enough; the images carry the nouns.

**How:** Images first, sentence second. The image is large enough to fill the cell. The sentence is short enough to read in one glance. Two columns, two rows.

**Why 4 images, not 6 or 8:** Four is the Madrigal sweet spot throughout the book. It establishes the pattern (you see it three times before you read the fourth and already know what it will say) without overwhelming working memory. At 6 items, the student starts *studying* rather than *absorbing*. At 2, there is not enough repetition to wire in the pattern.

**Why the images are so simple:** Each image depicts one thing. Madrigal's drawings are famously minimal — a rectangle with a door and a sign for "hotel," a box shape for "banco." The drawing cannot be about anything except the word. If the hotel drawing showed a street scene, part of the student's attention goes to the street. The simplicity focuses 100% of visual attention on the referent of the noun. HoloHola's watercolor images must be equally ruthless: one subject, no background story.

**Why no English beneath the sentences:** The student has the English for "voy" and "al" from the anchor. The image IS the noun. Putting an English translation under "Voy al hotel." would be redundant — and worse, it would introduce a translation step. The student's eye should go: *[image of hotel] → Voy al hotel.* Not: *[image of hotel] → "hotel" → Voy al hotel. → "I'm going to the hotel."* Every extra step in that chain creates a habit of translating rather than thinking in Spanish.

**Why the same sentence frame on every card:** "Voy al ___." appears four times. This is not lazy design. It is intentional. The verb form and connector pound in through exact repetition while only the noun changes. The student reads "Voy al" three times before they finish the grid; by the fourth card they have already said it before their eye reaches the text.

**HoloHola equivalent:** The `See It Say It` image loop — the image grid at the top of the Verb Unit. Each card: image, Spanish phrase, audio button. Four cards minimum. The phrase must use the same sentence frame for every card on this section of the page. The noun changes; the frame is constant.

---

## Pages 10–11: The Negative and the First Conjugation Expansion

### Element 3 — The Negative Page (p. 10)

```
[club image]       [teatro image]
No voy al club.    No voy al teatro.

[cine image]       [parque image]
No voy al cine.    No voy al parque.
```

**Exactly what appears:** A new 2×2 grid. Different images — not the same four places from page 9. "No" added to the beginning of the sentence. Same structure otherwise.

**Why new images:** This is the most important design decision on this spread. If Madrigal had used the same hotel, banco, garage, restaurante images with "no" added, the student would unconsciously tag those four images as "positive" and these four as "negative." By switching to a fresh set of places (club, teatro, cine, parque), she signals: the "no" goes with the *sentence*, not with the *place*. The pattern is `No voy al ___` and it works with any place. The images are interchangeable. The structure is what's being learned.

**Why negative before question:** Madrigal introduces the negative before the question form. The reason is cognitive load sequencing. The negative is a minimal addition to what the student already knows — one word added to the front of a sentence they can already say. The question form (`¿Va al banco?`) requires a new conjugation (`va` instead of `voy`) and a new intonation pattern. The negative is simpler, so it arrives first.

**HoloHola equivalent:** The `negativeItems` array. The image words must be different from the vocabulary used in the positive image grid above. The student should be able to look at the negative section and see fresh vocabulary — not the same images "marked negative."

---

### Element 4 — Vamos (bottom of p. 10 or top of p. 11)

```
Vamos al club.     Let's go to the club.
```

**Exactly what appears:** A single line. "Vamos al club." on the left with its English gloss. Not a full grid — just one example.

**Why vamos appears here:** Vamos ("we go" / "let's go") is introduced at the bottom of the negatives page as a single quiet addition, not a new lesson. The student already knows `voy` (I go) and has just seen `no voy`. Adding `vamos` here is a one-word vocabulary expansion, not a tense lesson. The conjugation is new but the context (same places, same `al` connector) is completely familiar.

**Why it's not emphasized:** No image. No grid. No section break. Just a line. Madrigal doesn't say "here is a new verb form." She says nothing. She just uses it. The student absorbs it the same way children absorb "let's go" before they know what "let's" means grammatically.

**HoloHola implication:** When `vamos` is first introduced in the content data, it should appear as a quiet addition — perhaps at the bottom of the image grid area, not in a new section with a heading. The first time it appears, it is not the point of the page; it is one of the building blocks, used in passing.

---

## Pages 12–13: Question, Answer, Exercise

### Element 5 — The Question and Answer Exchange (p. 12)

```
¿Va al banco?
Sí, voy al banco.
No, no voy al banco.
```

Then repeated for teatro, parque, cine — the same four places from the negative page.

**Exactly what appears:** Three lines, stacked. A question. An affirmative answer. A negative answer. No images in this section — the vocabulary was established earlier; images are no longer needed.

**Why `va` in the question, `voy` in the answer:** This is the first time the student sees two different conjugations of the same verb on the same "page." But notice: they already know `voy` (from p. 9) and have seen `va` at the end of the prior section. The question/answer exchange is not teaching the conjugations — it is showing them in natural conversational use. The student doesn't learn "va = third person singular"; they learn "¿Va al banco? → Sí, voy al banco." as a conversational unit.

**Why the full sentence answer, not just "Sí":** Madrigal always requires a complete sentence answer: "Sí, voy al banco." — not "Sí" or "Sí, al banco." The reason is reinforcement. Every answer is another repetition of the sentence frame. The student says the complete structure one more time. A one-word answer would miss the repetition opportunity.

**Why "No, no voy" (double no):** The double negative is standard Spanish — "No, I'm not going" is "No, no voy," not "No voy." Madrigal introduces it here, in context, without explanation. The student absorbs the double-no pattern from the example before they know it is a rule.

**HoloHola equivalent:** The `questionItems` array. Question uses él/ella form (not tú — Decision 5, April 2026). Answer uses yo form. Both must be complete sentences. Follows the same vocabulary as the negative section (places already seen in the image grid). No images needed in this section.

---

### Element 6 — The Exercise / Substitution Drill (p. 13)

```
           │  al hotel
           │  al banco
voy al ___  ←  al teatro
           │  al restaurante
va al ___   │  al parque
           │  al cine
           │  al garage
           │  al club
```

(Exact typesetting varies — Madrigal's original uses a two-column layout with the verb forms stacked on the left and the objects listed on the right.)

**Exactly what appears:** Two verb forms in Column 1 (voy / va). Eight places in Column 2. No labels on the columns. No instructions. The layout is self-explanatory: pick one from the left, pick one from the right, read a sentence.

**Why it comes last:** By the time the student reaches the exercise, they have seen `voy al hotel` on the positive page, `no voy al cine` on the negative page, `¿Va al banco? / Sí, voy al banco.` on the Q&A page. The substitution drill is not teaching the structure — it is confirming and ingraining what the student already knows. It is the synthesis step, not the introduction step.

**Why no labels:** "Column 1" and "Column 2" are not written anywhere. Neither is "Verb Form" or "Place." No instructions say "combine one from the left with one from the right." The layout makes it self-evident. Any label would add a cognitive layer — the student would read the label before reading the content. Madrigal strips everything that is not the content itself.

**Why only 2 verb forms in Column 1:** See the full analysis in `docs/substitution-drill-pedagogy.md`. Short version: 2 forms × 8 places = 16 combinations the eye generates in one scan. 6 forms × 8 places = 48 combinations the brain has to evaluate one by one. Column 1 must be the fixed anchor; it must be short enough to feel fixed.

**Why 8 places in Column 2:** Pages 9–13 have introduced hotel, banco, garage, restaurante, club, teatro, cine, parque — exactly eight places. The drill recombines the vocabulary the student already saw in the image grids. It does not introduce new places. Every item in Column 2 is a word the student has already seen with an image.

**HoloHola equivalent:** The `sentenceColumns` array and `SentenceColumnGenerator` component. Full rules in `docs/substitution-drill-pedagogy.md`.

---

## The Full Page Sequence: Why This Order Is Not Negotiable

```
ANCHOR          →  POSITIVE IMAGES  →  NEGATIVE (new images)  →  Q&A  →  DRILL
"Voy / Al"         4 places              4 new places             Sí/No    Eye scan
[components]       [sentences]          [sentences]               [exchange] [synthesis]
Cognitive load:
  minimal          low                   low                       medium    none
Student state:
  "I see           "I know this"        "I still know this        "I can     "I already
  the pieces"                            with 'no'"                say it"    own this"
```

The sequence is a confidence ramp. Each section asks slightly more of the student, but only after the previous section has fully established the pattern. The student never hits a wall — they hit a small step, already holding everything they need to climb it.

**Reversing the order breaks the system.** The drill cannot come before the images because the student doesn't know the vocabulary yet. The Q&A cannot come before the negative because the student hasn't heard `va` yet. The negative cannot come before the positive because you can't negate a pattern you don't own yet.

---

## The Layout Contract: What Every Page Promises the Student

After two or three lessons, the student knows exactly what to expect when they open a new page:

| Position on page | What is here | Student's eye goes to |
|---|---|---|
| Top — two lines, wide spacing | The anchor (components) | First — to get oriented |
| Below anchor — 2×2 grid | Positive image sentences | Second — to confirm the pattern |
| Next spread — 2×2 grid | Negative sentences (new vocab) | Third — "I know what this will be" |
| Next page — stacked trio | Q&A exchange | Fourth — "I know how to answer this" |
| Last — two-column grid | Substitution drill | Fifth — "I'm just confirming what I own" |

This predictability is not a design compromise — it is a core feature. The more familiar the layout, the less effort the eye spends navigating and the more effort it can give to the content. By lesson 5, the student is effectively fluent in the *format* of the page. All cognitive resources are available for the language.

**The HoloHola mandate:** Every Verb Unit page must follow this sequence in this order. The component types may evolve. The visual design will differ from B&W line art. But the sequence — anchor → positive images → negative → Q&A → drill — must be invariant.

---

## HoloHola Component Map

| Madrigal page element | HoloHola field / component | File |
|---|---|---|
| Anchor block (Voy / Al) | `patternLabel` | Displayed at top of `VerbUnit` |
| Positive image grid (4 items) | `See It Say It` loop (vocabulary_list) | `VerbUnit.tsx` image section |
| Negative sentences (new images) | `negativeItems` | `VerbUnit.tsx` negative section |
| Q&A exchange (3 lines × 4 items) | `questionItems` | `VerbUnit.tsx` Q&A section |
| Substitution drill columns | `sentenceColumns` | `SentenceColumnGenerator.tsx` |
| Content data source | `key_phrases_for_chat` (via micro-cycle prompt) | `server/routes.ts` |

---

## What This Document Is Not

This is not a style guide. HoloHola does not replicate Madrigal's B&W line art, her typeface, her exact 2×2 grid. The visual design is ours — soft watercolor, color, audio, digital interaction.

This is a cognitive engineering reference. The decisions documented here — the white space, the 4-item limit, the negative-before-question sequence, the unlabeled drill columns, the exact same sentence frame repeated across all image cards — are not aesthetic choices. They are decisions about how the brain processes new language. They are the reason the book works. We are implementing the same cognitive engineering in a different medium.

---

## Related Documents

- `docs/substitution-drill-pedagogy.md` — Deep dive on the substitution drill columns (Part 4 only)
- `docs/curriculum-strategy.md` — Decision 5 (no tú form); Decision 6 (preterite before present)
- `docs/visual-asset-roadmap.md` Part I.T — Four unit format types and 27-unit curriculum map
- `docs/visual-asset-roadmap.md` Part I.B — Full lesson map of See It and Say It (all 9 phases)
- `docs/visual-asset-roadmap.md` Part I.S — Flat Page First principle and SentenceColumnGenerator design
- `docs/textbook-component-tts-stt-guide.md` — Audio implementation for all textbook components
