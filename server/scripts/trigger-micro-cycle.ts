import Anthropic from '@anthropic-ai/sdk';
import { getUserDb } from '../db';
import { sql as drizzleSql } from 'drizzle-orm';

const LESSON_ID = '6281ad64-3a48-4a54-ac5f-e30e9794894a';
const LANGUAGE = 'spanish';

async function run() {
  const db = getUserDb();
  const row = await db.execute(
    drizzleSql`SELECT key_phrases_for_chat, vocabulary_list FROM textbook_lesson_content WHERE lesson_id = ${LESSON_ID} AND language = ${LANGUAGE} LIMIT 1`
  );
  const contentRow = row.rows[0];
  if (!contentRow) { console.error('Lesson not found'); process.exit(1); }

  const keyPhrases = (contentRow.key_phrases_for_chat ?? []) as any[];
  const vocabList = (contentRow.vocabulary_list ?? []) as any[];

  console.log(`Lesson: ${LESSON_ID}`);
  console.log(`Vocab items: ${vocabList.length}, Key phrases: ${keyPhrases.length}`);
  console.log('Calling Claude...');

  const anthropic = new Anthropic();
  const prompt = `You are generating micro-cycle practice data for HolaHola, an AI-powered language learning app.
Language: ${LANGUAGE}

════════════════════════════════════════════════════════════════
HOLAHOLA PEDAGOGY — READ THIS BEFORE GENERATING ANYTHING
(This is not generic language-teaching context. It overrides every
textbook-derived instinct you have about how drills should work.)
════════════════════════════════════════════════════════════════

OUR LEARNING MODEL (from product audits, Jan–Apr 2026):
The textbook is not the learning event. It is rapid preparation for the
real learning event — a voice session with Daniela, the AI tutor.
Students absorb a pattern quickly from the textbook (scan, hear it, see it)
then go USE it in conversation. The drill lives between those two stages:
after passive vocabulary recognition, before active production in speech.
If the drill requires the student to think hard, it has failed — it should
lower anxiety and build confidence, making them ready for real conversation.

CORE PHILOSOPHY — "Confident Imperfection":
Language acquisition happens when a student risks speaking before they are
certain. Our drills must be designed so that EVERY choice feels safe.
No wrong answers. No combinations that embarrass. No gotchas.
The student who picks any item from any column should produce something
they could say to a native speaker today. If any combination produces
a nonsense or awkward sentence, the drill is broken.

THE RECOGNITION → DRILL → PRODUCTION SEQUENCE (from curriculum audit):
  1. Vocabulary list (See It Say It section) — passive recognition
  2. THIS DRILL — semi-active pattern absorption (the stage you are generating)
  3. Voice session with Daniela — active production / real use
The drill recombines vocabulary the student ALREADY SAW in step 1.
It never introduces new vocabulary. It converts recognition into readiness.

WHAT WE KNOW FAILS (from January 2026 drill audit and March 2026 curriculum audit):
  ✗ "Wide but not deep" — 87% of our drills were listen/repeat (novice audio only).
    The substitution drill adds the depth that was missing.
  ✗ fill_blank drills test recognition, not production. They don't build fluency.
  ✗ Drills that survey full verb paradigms (all 6 conjugations) spread attention
    thin. Students leave remembering none of the forms strongly.
  ✗ Abstract or academic items in Column 2 break the visual scan —
    "en términos generales" doesn't scan; "a la playa" does.
  ✗ Content generated from stale curriculum data fields (required_vocabulary,
    required_grammar) often inherits data quality problems. Generate from
    the lesson vocabulary list and key phrases provided below — trust those,
    not memorized textbook paradigms.

Vocabulary list (up to first 10 items):
${JSON.stringify(vocabList.slice(0, 10), null, 2)}

Key conversation phrases:
${JSON.stringify(keyPhrases, null, 2)}

Generate a JSON object with exactly these fields:

════════════════════════════════════════════════════════════════
THE COMPLETE MADRIGAL PAGE STRUCTURE
Every page in "See It and Say It" / "Magic Key to Spanish" follows
the same four-part format. The four fields below map directly to it.
════════════════════════════════════════════════════════════════

PART 1 (top of the page) — THE ANCHOR
"Voy, I'm going."     "Al, to the."
Two or three building blocks. Widely spaced. Nothing else.
The reader sees the grammatical components before they see any sentences.
The space between them is structural — it lets the eye perceive both
the pieces AND the assembled whole. This is the "Voy / Al" moment.

PART 2 — REPETITION WITH IMAGES (→ negativeItems)
The anchor's components are combined with images of concrete nouns —
but using DIFFERENT nouns than the positive vocabulary grid above.
"No voy al club." [image of a club]. "No voy al teatro." [image of a theater].
Madrigal uses fresh images for the negative section, not the same ones
from the positive grid. The verb form is what stays fixed; both the noun
AND the polarity can vary. The student sees: the pattern works everywhere.

PART 3 — REPETITION WITH QUESTION AND ANSWER (→ questionItems)
"¿Va Pedro al banco?" / "Sí, yo voy al banco." / "No, no voy al banco."
The question uses the ÉL/ELLA form (asking about a named third person).
The answer uses the YO form (student responds in their own voice).
IMPORTANT: NO TÚ FORM. The tú form is eliminated from this curriculum
until explicitly reintroduced. Él/ella questions produce the YO answer
just as naturally as tú questions did — "¿Va Pedro?" → "Yo voy."

PART 4 — GENERAL REPETITION / SUBSTITUTION COLUMNS (→ sentenceColumns)
"voy / va" in Column 1 × many destinations in Column 2.
The eye scans. The brain fires sentences. No conscious effort.

════════════════════════════════════════════════════════════════
Now generate each part:
════════════════════════════════════════════════════════════════

1. "patternLabel" — a short string showing the anchor pattern at the top
   of the lesson page. Format: the 2–3 building block forms separated by " / "
   CRITICAL: NO TÚ FORM anywhere in patternLabel. Use yo / él forms only.
   Example: "Voy / Va / No voy"  or  "Tengo / Tiene / No tengo"
   WRONG: "Voy / No voy / ¿Vas?"  — "¿Vas?" is tú form. Do not use.
   WRONG: "Tengo / No tengo / ¿Tienes?" — "¿Tienes?" is tú form. Do not use.
   This is what the student sees FIRST — the pieces before the whole.
   Keep it minimal. Madrigal's anchors are never more than 3 items.

2. "negativeItems" — PART 2: Repetition with images (4–5 items)
   { "imageWord": string, "negativePhrase": string, "translation": string }

   ── HOW TO GENERATE (Madrigal image repetition rules) ──────────────

   ★ THE ONE RULE THAT OVERRIDES EVERYTHING ELSE ★
   Every single negativePhrase must use THE SAME VERB as the patternLabel.
   The verb NEVER changes across negativeItems. The NOUN changes. Not the verb.

   If patternLabel is "Hablo / Habla / No hablo":
     CORRECT: "No hablo en la escuela." / "No hablo con el profesor." / "No hablo en clase."
     WRONG:   "No compro el libro." (compro is a different verb — forbidden)
     WRONG:   "No escucho música."  (escucho is a different verb — forbidden)
     WRONG:   "No trabajo aquí."    (trabajo is a different verb — forbidden)

   The reason: This section is a pounding machine. The verb hammers in through
   repetition while the noun varies. If the verb changes, the pounding stops.
   You have introduced grammar study instead of pattern absorption.

   Even if the vocabulary list contains multiple verbs — pick ONE. The verb
   in the patternLabel is the one. Use it in every negativePhrase. Every one.

   • imageWord: a bare, concrete, imageable noun from the vocabulary list.
     No articles. No adjectives. The word that an image would depict.
     GOOD: "escuela", "profesor", "lápiz"   BAD: "español" (a language, not drawable)
     BAD: "mucho" (an adverb, not drawable)   BAD: "bien" (not drawable)
   • negativePhrase: always uses the YO form — "No hablo..." not "No habla..."
     The student is always speaking in their own voice.
   • Each item uses a DIFFERENT NOUN — ideally nouns from the vocabulary list.
     Prefer the concrete classroom nouns: escuela, profesor, estudiante, clase.
   • 4–5 items total. Never more.

3. "questionItems" — PART 3: Repetition with question and answer (4 items)
   { "imageWord": string, "question": string, "questionTranslation": string,
     "affirmativeAnswer": string, "affirmativeTranslation": string,
     "negativeAnswer": string, "negativeTranslation": string }

   ── HOW TO GENERATE (Madrigal Q&A rules) ──────────────────────────

   ★ SAME RULE AS NEGATIVEITEMS: ONE VERB, USED IN ALL 4 QUESTIONS ★
   The verb in the question is the same verb as the patternLabel. Every question.
   The NOUN changes — the person, the place, the object. The VERB never changes.

   If patternLabel is "Hablo / Habla / No hablo":
     CORRECT: "¿Habla María en la escuela?"  / "¿Habla Pedro con el profesor?"
     WRONG:   "¿Estudia Pedro inglés?"  (estudia is a different verb — forbidden)
     WRONG:   "¿Trabaja Ana en la escuela?" (trabaja is different — forbidden)
     WRONG:   "¿Necesita Carlos un lápiz?"  (necesita is different — forbidden)

   Madrigal's Q&A pages use one verb per spread: "¿Va al banco?" / "¿Va al teatro?"
   The place changes. The verb is "va" every time. The student hears the same form
   over and over until it is automatic.

   CRITICAL — NO TÚ FORM anywhere. The question uses ÉL / ELLA only:
     "¿Habla María en la escuela?"     NOT "¿Hablas en la escuela?"
   The student answers in the YO form — their own voice:
     "Sí, yo hablo en la escuela."     / "No, no hablo en la escuela."
   Use different names across the 4 items: Pedro, María, Carlos, Ana.

   • affirmativeAnswer: YO form, complete sentence — "Sí, yo hablo en la escuela."
   • negativeAnswer: complete sentence with double no — "No, no hablo en la escuela."
   • imageWord: bare concrete noun from the question. Must be imageable.
     Use: "escuela", "profesor", "clase", "lápiz", "libro"
   • Use a different vocabulary NOUN for each of the 4 items.
     The verb is fixed. Only the noun varies.

4. "sentenceColumns" — PART 4: General repetition / substitution columns
   { "label": string, "items": [{ "text": string, "translation": string }] }

   ── THE VOCABULARY CLUSTER PRINCIPLE ──────────────────────────────

   ★ THE VOCABULARY CLUSTER PRINCIPLE ★
   Column 2 is NOT variety for variety's sake. It is the lesson's vocabulary cluster —
   the set of nouns/phrases that share a semantic field and pair naturally with the verb.

   This lesson is about classroom language. The vocabulary cluster = classroom nouns:
   la escuela, el profesor, la profesora, el estudiante, la clase.
   Use THESE as Column 2. They are the cluster. "Hablo / Habla" bonds with this cluster.

   Column 2 must be ONE semantic dimension: all classroom places/people.
   Do NOT mix: classroom nouns + manner adverbs (mucho, bien) — different dimensions.
   Do NOT mix: nouns + time phrases — different dimensions.

   Column 1: "hablo" / "habla" (the two essential forms only)
   Column 2: the classroom nouns that work with hablar — en la escuela / en la clase /
             con el profesor / con la estudiante / con el estudiante

   ── COLUMN LABELS — use question words ───────────────────────────
   Labels: "Where?" / "What?" / "How?" / "With whom?"
   Not: "Destinations" / "Objects" / "Verb Forms"

   ── COLUMN 1 (1–2 items ONLY) ─────────────────────────────────────
   yo form + él/ella form. That is all.
   NEVER all 6 conjugations. NEVER mix verbs. 2 forms maximum.

   ── COLUMN 2 (5–8 items) ──────────────────────────────────────────
   Every item works with EVERY Column 1 form. One semantic dimension.
   Concrete, imageable. Ordered by frequency of use. From vocabulary list.

Return ONLY valid JSON, no markdown, no explanation.`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content[0] as any).text.trim();
  const cleaned = raw.startsWith('```') ? raw.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '') : raw;
  const data = JSON.parse(cleaned);

  console.log('\n=== GENERATED OUTPUT ===');
  console.log(JSON.stringify(data, null, 2));

  await db.execute(
    drizzleSql`UPDATE textbook_lesson_content SET micro_cycle_data = ${JSON.stringify(data)}::jsonb WHERE lesson_id = ${LESSON_ID} AND language = ${LANGUAGE}`
  );
  console.log('\n✓ Saved to DB');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
