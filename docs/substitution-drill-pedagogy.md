# Substitution Drill Pedagogy
**Source:** Madrigal's *See It and Say It in Spanish* / *Magic Key to Spanish*  
**Applies to:** `SentenceColumnGenerator`, micro-cycle prompt, all 27 Spanish 1 chapters, and any future language track that uses verb units.

---

## Core Principle: Maximum Permutations, Minimum Cognitive Load

The substitution drill is designed so the student can produce dozens of correct sentences with almost no mental effort. The mechanism:

1. **Fix a verb form.** Show it once. The student's brain locks onto it.
2. **Swap only the object.** Each new row is a new sentence — but the hard part (the verb) never changes.
3. **Then swap to the other verb form.** Same objects, same easy swap, but now "voy" becomes "va." New set of sentences, zero new concepts introduced.

The result is that the student says the form 8–10 times in a row — far more repetitions than a traditional drill — without ever feeling like they're doing rote memorization.

---

## Column Structure Rules

### Column 1 — Verb Forms (1–2 items only)

Use exactly the two forms the student needs most:

| Form | Spanish example | Why it matters |
|------|----------------|----------------|
| **yo** (first-person singular) | *voy, hablo, tengo* | "I do X" — the student's own voice |
| **él/ella** (third-person singular) | *va, habla, tiene* | "He/she does X" — also covers formal *usted* |

**Why not all six conjugations?** Spreading attention across six forms dilutes the repetitions. The student leaves remembering none of them strongly. Two forms × 8 objects = 16 firmly-wired sentences. Six forms × 8 objects = 48 weakly-remembered combinations.

The *tú* form (and plural forms) are introduced in a **later unit** as "one small change" — the student already knows the pattern, so the new form registers easily.

### Column 2 — Objects / Complements (5–8 items)

Each item must be semantically compatible with **every** verb form in Column 1. If "a pencil" doesn't work with *va* (he goes), it doesn't go in Column 2.

Good sources for Column 2 items:
- Places: *a la playa, al banco, a la biblioteca, a casa, al mercado*
- Activities: *mucho, bien, todos los días*
- Nouns that accept the verb: *español, inglés* (for *hablar*)

### Column 3 — Optional additional dimension

Only add a third column when it creates new meaningful variation AND every 3-way combination remains valid. This is rare. When in doubt, stay at two columns.

---

## The "One Small Change" Progression Across Units

This is the key to why the drill is so powerful across the 27-chapter arc:

```
Ch 6  → ir: voy / va      + destinations       (introduces the pattern)
Ch 7  → ir: vamos / van   + same destinations  (ONE change: we/they forms)
Ch 10 → tener: tengo / tiene + body parts      (new verb, same drill shape)
Ch 14 → querer: quiero / quiere + activities   (new verb, "want to" construction)
```

Each chapter the student encounters the same two-column layout. The *shape* is familiar. Only the content inside is new. This is what Madrigal calls "painless" acquisition — the student's cognitive effort goes entirely toward the new word, not toward understanding a new exercise format.

---

## What Makes a Bad Drill (Anti-Patterns)

| Anti-pattern | Why it fails |
|---|---|
| 5+ verb forms in Column 1 | Dilutes repetitions; student ends session uncertain of all forms |
| Different verbs mixed in Column 1 | Combinations break — "Yo hablo un lápiz" (I speak a pencil) |
| Objects that only work with some verbs | Student hits a nonsense sentence and loses trust in the material |
| More than 8 objects in Column 2 | Cognitive overload; student stops exploring |
| Column 3 added "just in case" | Creates invalid 3-way combos; adds confusion |

---

## Implementation Reference

**Prompt location:** `server/routes.ts` — search for `micro-cycle` endpoint  
**Frontend component:** `client/src/components/SentenceColumnGenerator.tsx`  
**Data shape:**
```typescript
interface SentenceColumn {
  label?: string;          // short header: "Verb Form", "Where?", "What?"
  items: ColumnItem[];     // 1-2 for verb column, 5-8 for object column
}
interface ColumnItem {
  text: string;            // Spanish text
  translation: string;     // English gloss
}
```

**Cache layer:** micro_cycle_data column in `textbook_lesson_content` table.  
Clear with: `UPDATE textbook_lesson_content SET micro_cycle_data = NULL WHERE language = 'spanish';`  
This forces Claude to regenerate with the current prompt on next load.

---

## Connection to the Broader Curriculum Design

From `curriculum-restructure-spanish1.md`:
> **Total cognitive load ≤ 20 distinct items — the "one sitting" rule.**

The substitution drill enforces this at the *exercise level*: Column 1 introduces at most 2 new items (the verb forms), Column 2 pulls from vocabulary the student already saw in the See It Say It section earlier in the same chapter. The drill recombines known material, it does not introduce new material.

This is why the drill comes **after** the vocabulary section, never before.
