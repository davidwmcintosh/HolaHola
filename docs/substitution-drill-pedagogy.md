# Substitution Drill Pedagogy
**Source:** Madrigal's *See It and Say It in Spanish* / *Magic Key to Spanish*  
**Applies to:** `SentenceColumnGenerator`, micro-cycle prompt, all 27 Spanish 1 chapters, and any future language track that uses verb units.

---

## The Central Insight: The Eye Does the Work

The substitution drill is not a fill-in-the-blank exercise. It is not a quiz. It is a **visual perception engine**.

When a student looks at the grid, their brain automatically scans across columns and assembles sentences. This happens without conscious effort — the same way the brain reads a multiplication table and produces products without performing arithmetic. The student's visual cortex is doing the permutation work. The student just experiences the language.

This is why Madrigal's books look the way they do. The page is not decorated — it is engineered. Every word is placed to maximize the number of correct sentences the brain generates per second of looking at the page.

**HolaHola's job is to replicate that on screen.** The `SentenceColumnGenerator` is only a delivery vehicle. The quality of the content inside the columns — its simplicity, its coherence, its single-dimensionality — is what determines whether the drill works.

---

## Core Principle: Maximum Permutations, Minimum Cognitive Load

The mechanism in three steps:

1. **Fix a verb form.** One word in Column 1. The student's brain locks onto it.
2. **Vary only the object.** Each row in Column 2 produces a new sentence — the hard part never changes. The brain fires each sentence as an eye-scan, not a thought.
3. **Then introduce one small change.** A second verb form in Column 1 (or in the next chapter). Same Column 2, new Column 1 item. The student now has twice as many sentences from the same visual pass, with zero new concepts introduced.

The result: 2 verb forms × 7 objects = **14 sentences per eye-scan**. The student says each verb form 7 times without it feeling like repetition.

---

## Column Design Rules

### Column 1 — Verb Forms (1–2 items only)

**The single hardest rule: only one verb, only its two essential forms.**

| Form | Example | Why |
|------|---------|-----|
| **yo** (1st person singular) | *voy, hablo, tengo* | The student's own voice — "I do X" |
| **él/ella** (3rd person singular) | *va, habla, tiene* | Describes others; also covers formal *usted* |

**Why not all six conjugations?**
Traditional textbook instinct says "teach the whole paradigm." That instinct is wrong here. Spreading attention across 6 forms means the eye has to travel further, the brain has to hold more in working memory, and the student leaves having weakly processed 48 combinations instead of deeply processing 14. The *tú* form and plural forms belong in a later chapter as "one small change" — by then the student already owns the pattern.

**Column 1 must be visually short.** If it is long, it stops feeling like a fixed anchor and starts feeling like another list to learn.

### Column 2 — Objects / Complements (5–8 items)

This column does the heavy lifting. It generates the permutations.

Rules:
- Every item must be semantically compatible with **every** verb form in Column 1. No exceptions. One broken combination destroys the student's trust in the material.
- Items should vary along **one dimension only** — all places, OR all time expressions, OR all objects the verb can take. Do not mix categories (e.g., don't put "a la playa" and "mucho" in the same column — one is a destination, one is a manner adverb; the brain can't scan them as equivalent alternatives).
- Items should be **visually distinct** at a glance — different lengths, different starting letters help. The eye distinguishes them effortlessly.
- 5–8 items is the sweet spot. Fewer than 5 is not enough permutations. More than 8 and the column becomes a list to read, not a column to scan.

Good Column 2 examples:
- For *ir* (to go): *a la playa / al banco / a la biblioteca / al mercado / a casa / al restaurante* — all destinations, grammatically parallel, visually scannable
- For *hablar* (to speak): *español / inglés / francés / mucho / bien / todos los días* — things/ways one can speak
- For *tener* (to have): *hambre / sed / frío / calor / miedo / sueño* — idiom body-state nouns, all take *tener*

### Column 3 — Optional third dimension

Only valid when:
1. A third dimension is part of the chapter's core vocabulary AND
2. Every 3-way combination (col1 × col2 × col3) produces a correct, meaningful sentence

This is rare. When in doubt: do not add Column 3. A clean 2-column drill beats a broken 3-column drill every time.

---

## The "One Small Change" Progression Across 27 Chapters

The drill compound-interests across the curriculum. Each chapter the student encounters the same two-column layout. The shape is familiar; only the content is new. Cognitive effort goes entirely toward the new vocabulary, never toward understanding a new exercise format.

```
Ch 6  → ir: "voy" / "va"         + destinations     (introduces the drill pattern)
Ch 7  → ir: "vamos" / "van"      + same destinations (ONE change: plural forms, same objects)
Ch 10 → tener: "tengo" / "tiene" + body-state nouns  (new verb, same drill shape)
Ch 14 → querer: "quiero" / "quiere" + activities     (new verb, "want to" construction)
Ch 18 → gustar: "me gusta" / "le gusta" + nouns      (new structure, same familiar drill shape)
```

Each step: the eye-scan machinery is already trained. Only the words inside it are new.

---

## What Breaks the Drill (Anti-Patterns)

| Anti-pattern | What the student experiences | Why it's fatal |
|---|---|---|
| 5+ verb forms in Column 1 | Eye has to travel back and forth; brain loses the "fixed anchor" | Dilutes repetitions; forms are not wired in |
| Multiple semantically different verbs mixed in Column 1 | "Yo hablo un lápiz" (I speak a pencil) — nonsense sentence | Student loses trust; brain stops auto-scanning |
| Mixed categories in Column 2 | Eye can't scan smoothly; brain must evaluate each combination | Converts passive eye-scan into active cognitive work — defeats the purpose |
| Objects that only work with some verb forms | Broken combinations appear; student must check each one | Activates checking/filtering mode; kills the scan |
| Subtly different items that look similar | Eye conflates them; no new permutation registered | The brain skips right over them |
| Column 3 added speculatively | Exponential combinations; many are invalid | Student hits a bad sentence early and stops exploring |

---

## What Claude Must NOT Do

Claude's default pedagogy is to survey verb paradigms. Given a vocabulary list about travel and a verb like *ir*, it will be tempted to generate:

```
Column 1: yo voy / tú vas / él va / nosotros vamos / vosotros vais / ellos van
Column 2: a la playa / al banco
```

This is the wrong direction. It puts maximum cognitive load (6 unfamiliar forms) in Column 1 and minimum variation (2 objects) in Column 2. The brain cannot scan it — it has to study it. The student sees a conjugation table with a tiny column attached.

The correct direction:

```
Column 1: voy / va               ← 2 forms only, both already introduced
Column 2: a la playa / al banco / a la biblioteca / al mercado / a casa / al restaurante / a la escuela
```

The brain generates 14 sentences from a single glance. The verb forms are pounded in through context, not memorization.

---

## Implementation Reference

**Prompt location:** `server/routes.ts` → `GET /api/textbook/micro-cycle/:lessonId`  
**Frontend component:** `client/src/components/SentenceColumnGenerator.tsx`  

**Data shape:**
```typescript
interface SentenceColumn {
  label?: string;    // "Verb Form" | "Where?" | "What?" | "How?" — one-word dimension name
  items: ColumnItem[];
}
interface ColumnItem {
  text: string;        // Spanish text shown to student
  translation: string; // English gloss shown below
}
// Column 1: 1–2 items. Column 2: 5–8 items. Column 3: 4–6 items (if used).
```

**Cache layer:** `micro_cycle_data` column in `textbook_lesson_content`.  
Clear to force regeneration:
```sql
UPDATE textbook_lesson_content SET micro_cycle_data = NULL WHERE language = 'spanish';
```

---

## Connection to the Broader Curriculum Design

From `curriculum-restructure-spanish1.md`:
> **Total cognitive load ≤ 20 distinct items — the "one sitting" rule.**

The substitution drill enforces this at the exercise level. Column 1 introduces at most 2 items (verb forms the student has already seen in the See It Say It section). Column 2 recombines vocabulary already presented earlier in the same chapter. The drill is a recombination exercise, not an introduction exercise. This is why it comes **after** vocabulary, never before.
