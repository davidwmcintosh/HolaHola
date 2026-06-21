/**
 * Madrigal Loop Catalog — Server-Side
 *
 * Lightweight catalog of Madrigal units with verbal teaching scripts for each
 * step of the 4-step sequence. The full visual content (images, tables, columns)
 * is rendered client-side from madrigal-unit-content.ts. This catalog drives:
 *   1. Semantic embedding index (madrigal_unit type in memory_embeddings)
 *   2. Daniela's verbal scripts per step (what she says, not what appears on screen)
 *   3. Unit routing via start_madrigal_loop semantic search
 *
 * The 4-step Madrigal sequence:
 *   Step 0 — Anchor: Building blocks. The verb forms shown at top of page.
 *   Step 1 — Model sentences: Images + example sentences. Student sees and repeats.
 *   Step 2 — Combinator columns: Rapid eye-scanning substitution drill.
 *   Step 3 — Negative / QA pivot: Opposite form or question-answer flip.
 */

export interface MadrigalStep {
  stepIndex: number;
  stepName: string;
  verbalInstruction: string;
  studentAction: string;
  teacherHint: string;
}

export interface MadrigalLoopUnit {
  contentKey: string;
  /** Target language for this unit. Omit or 'spanish' for existing Spanish units. */
  language?: string;
  displayName: string;
  unitType: 'verb' | 'preterite' | 'ser_estar' | 'hay_gustar' | 'progressive' | 'imperfect' | 'perfect' | 'command' | 'reflexive' | 'object_pronoun';
  vocabTerms: string[];
  steps: MadrigalStep[];
}

const UNITS: MadrigalLoopUnit[] = [

  // ─── Present Tense / IR ───────────────────────────────────────────────────

  {
    contentKey: 'where are you going',
    displayName: 'Ir — Going Places (voy / va)',
    unitType: 'verb',
    vocabTerms: ['voy', 'va', 'going', 'ir', 'where are you going', 'I am going', 'hotel', 'bank', 'restaurant'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'We start with our building blocks. "Voy" means "I am going." "Al" means "to the." Say them with me — voy, al.',
        studentAction: 'Repeat the anchor forms: voy, al.',
        teacherHint: 'Listen for correct vowel sounds. "Voy" should have a clear OY diphthong.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Now let\'s see these building blocks in action. Look at each picture and say the sentence you see. "Voy al hotel" — I\'m going to the hotel. Your turn.',
        studentAction: 'Read each model sentence aloud, using the image as a memory hook.',
        teacherHint: 'Correct pronunciation immediately. The goal is to anchor meaning to the image.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the fun part. You see columns of words — scan across them and build as many sentences as you can. Go quickly. The eye movement is part of the drill.',
        studentAction: 'Scan the columns and combine: subject + verb + destination. Say each combination aloud.',
        teacherHint: 'Speed matters here. If student hesitates, encourage them to keep moving. Accuracy comes with repetition.',
      },
      {
        stepIndex: 3,
        stepName: 'negative_pivot',
        verbalInstruction: 'Last step — the negative. If "voy al hotel" means I\'m going to the hotel, how do you say "I\'m NOT going to the hotel"? Try it.',
        studentAction: 'Produce the negative form: No voy al hotel.',
        teacherHint: 'Target "no" placement — it goes directly before the verb. Check for "no voy" not "voy no".',
      },
    ],
  },

  // ─── Preterite / Tomar ────────────────────────────────────────────────────

  {
    contentKey: 'i took',
    displayName: 'Tomar — I Took (preterite)',
    unitType: 'preterite',
    vocabTerms: ['tomé', 'tomó', 'tomar', 'took', 'I took', 'he took', 'she took', 'preterite', 'past tense', 'taxi', 'coffee', 'medicine'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'This is a past-tense unit. "Tomé" means "I took." "Tomó" — with an accent on the final O — means "he took" or "she took." Say them: tomé, tomó.',
        studentAction: 'Repeat tomé and tomó, noticing the accent difference.',
        teacherHint: 'The accent on tomó is critical — without it it sounds like "he takes" (present). Drill both forms clearly.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture and read the sentence. "Tomé un taxi" — I took a taxi. The images give you the context. Say each one.',
        studentAction: 'Read each preterite sentence aloud with the image as anchor.',
        teacherHint: 'Listen for the accented final syllable in first-person tomé. Missing the accent is a common error.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — scan across and combine subjects with objects. Who took what? Go.',
        studentAction: 'Build sentences from the substitution columns at speed.',
        teacherHint: 'Check both tomé (yo) and tomó (él/ella/usted) forms appear in combinations.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Now questions. I ask you — ¿Tomaste un taxi? You answer in first person. Ready?',
        studentAction: 'Answer the question in first person: Sí, tomé un taxi. / No, no tomé un taxi.',
        teacherHint: 'Watch for the tú preterite form (tomaste) which they\'ve seen — this Q&A flip builds conversational fluency.',
      },
    ],
  },

  // ─── Preterite / Comprar ──────────────────────────────────────────────────

  {
    contentKey: 'i bought',
    displayName: 'Comprar — I Bought (preterite)',
    unitType: 'preterite',
    vocabTerms: ['compré', 'compró', 'comprar', 'bought', 'I bought', 'she bought', 'shopping', 'store', 'market'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Compré" means "I bought." "Compró" means "he or she bought." The pattern is identical to tomar — the accent on the final syllable marks third person. Compré, compró.',
        studentAction: 'Repeat compré and compró.',
        teacherHint: 'If student studied tomar, reference the parallel: same -é / -ó ending pattern.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each shopping scene and read the sentence. "Compré una blusa" — I bought a blouse.',
        studentAction: 'Read each model sentence with image.',
        teacherHint: 'Connect the image to the meaning. Visual anchoring reduces future retrieval effort.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — build as many "I bought / she bought" sentences as you can.',
        studentAction: 'Scan and combine subject + compré/compró + object.',
        teacherHint: 'Speed and rhythm matter. The drill builds automaticity.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: '¿Compraste algo? Did you buy anything? Tell me what you bought — real or invented.',
        studentAction: 'Produce a personal sentence: Compré ___.',
        teacherHint: 'Personalization at this step deepens retention. Accept invented answers.',
      },
    ],
  },

  // ─── Near Future / Voy a ─────────────────────────────────────────────────

  {
    contentKey: "i'm going to",
    displayName: 'Ir + a + infinitive — Near Future (voy a / va a)',
    unitType: 'verb',
    vocabTerms: ['voy a', 'va a', 'going to', 'near future', 'I am going to', 'he is going to', 'infinitive', 'plans'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'The near future uses "voy a" plus an infinitive. "Voy a comer" — I\'m going to eat. "Va a dormir" — he\'s going to sleep. The infinitive never changes. Voy a, va a.',
        studentAction: 'Repeat the frames: voy a, va a.',
        teacherHint: 'Stress that the infinitive stays unchanged — this is the key pattern.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each picture shows what someone is about to do. Read the sentence.',
        studentAction: 'Read each voy-a / va-a sentence with image.',
        teacherHint: 'The visual shows the action. Student should connect image to the infinitive form.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — combine subjects + voy a / va a + infinitives.',
        studentAction: 'Build sentences across columns rapidly.',
        teacherHint: 'Watch for subject-verb agreement: yo → voy, él/ella → va.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Tell me one thing you\'re going to do today. Real answer.',
        studentAction: 'Produce a genuine voy a + infinitive sentence.',
        teacherHint: 'Personal context cements the structure. Praise specificity.',
      },
    ],
  },

  // ─── Tener ────────────────────────────────────────────────────────────────

  {
    contentKey: 'i have',
    displayName: 'Tener — I Have (tengo / tiene)',
    unitType: 'verb',
    vocabTerms: ['tengo', 'tiene', 'tener', 'have', 'I have', 'he has', 'she has', 'possession', 'age'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Tengo" — I have. "Tiene" — he or she has. Tener is irregular in first person: tengo, not teno. Tengo, tiene.',
        studentAction: 'Repeat tengo and tiene.',
        teacherHint: 'Flag the irregular first person. Students often want to say "teno."',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each image and read the sentence.',
        studentAction: 'Read model tener sentences with images.',
        teacherHint: 'Tener expressions of age (tengo veinte años) are common — note if they appear.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — build tengo / tiene sentences.',
        studentAction: 'Scan and combine.',
        teacherHint: 'Speed over perfection at this stage.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: '¿Cuántos años tienes? How old are you? Answer with tengo.',
        studentAction: 'Produce: Tengo ___ años.',
        teacherHint: 'Age expression is a high-frequency use of tener — great personalizing hook.',
      },
    ],
  },

  // ─── Querer ───────────────────────────────────────────────────────────────

  {
    contentKey: 'i want',
    displayName: 'Querer — I Want (quiero / quiere)',
    unitType: 'verb',
    vocabTerms: ['quiero', 'quiere', 'querer', 'want', 'I want', 'she wants', 'desire', 'wish'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Quiero" — I want. "Quiere" — he or she wants. Note the stem change: quer → quier. Quiero, quiere.',
        studentAction: 'Repeat quiero and quiere.',
        teacherHint: 'Point out the stem vowel change e → ie. This is the first stem-changing verb most students encounter.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone wants. Read the sentence.',
        studentAction: 'Read quiero / quiere sentences with images.',
        teacherHint: 'Images make the desire concrete — helps with meaning retention.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who wants what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Check stem-change holds in quiere but not queremos (boot verb pattern).',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: '¿Qué quieres comer hoy? What do you want to eat today? Answer.',
        studentAction: 'Produce: Quiero comer ___.',
        teacherHint: 'Quiero + infinitive is extremely high-frequency. Personalizing it here builds real conversational capital.',
      },
    ],
  },

  // ─── Ser (plurals / gender) ───────────────────────────────────────────────

  {
    contentKey: 'to be',
    displayName: 'Ser — Plurals and Gender (somos / son)',
    unitType: 'ser_estar',
    vocabTerms: ['ser', 'somos', 'son', 'es', 'soy', 'to be', 'we are', 'they are', 'identity', 'nationality', 'plural'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Ser is used for identity and permanent characteristics. The plural forms: "somos" — we are, "son" — they are. Somos, son.',
        studentAction: 'Repeat somos and son.',
        teacherHint: 'Contrast with estar if student asks — keep to ser for now.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each image and read the sentence about what these people or things are.',
        studentAction: 'Read ser sentences with images.',
        teacherHint: 'Gender agreement in adjectives is key here. Flag mismatches.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — build ser sentences with subjects and descriptions.',
        studentAction: 'Scan and combine.',
        teacherHint: 'Watch that they match gender/number of adjective to noun.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Tell me two things about yourself using ser. What are you?',
        studentAction: 'Produce two soy / somos sentences.',
        teacherHint: 'Nationality, profession, personality — all ser. Accept any.',
      },
    ],
  },

  // ─── Estar ────────────────────────────────────────────────────────────────

  {
    contentKey: 'estar',
    displayName: 'Estar — Locations and States (estoy / está)',
    unitType: 'ser_estar',
    vocabTerms: ['estoy', 'está', 'estar', 'location', 'state', 'I am', 'he is', 'where', 'feeling', 'temporary'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Estoy" — I am (location or state). "Está" — he or she is. Estar is used for where things are and how people feel. Estoy, está.',
        studentAction: 'Repeat estoy and está.',
        teacherHint: 'Key distinction: estar = location + temporary state. Contrast with ser if needed.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows where someone or something is. Read the location sentence.',
        studentAction: 'Read estar location sentences with images.',
        teacherHint: 'Prepositions of location appear here — en, cerca de, lejos de. Note usage.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — where is everyone?',
        studentAction: 'Combine subject + está/estoy + location.',
        teacherHint: 'Speed and smooth delivery are the goal.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: '¿Dónde estás ahora? Where are you right now? Tell me.',
        studentAction: 'Produce: Estoy en ___.',
        teacherHint: 'Immediate physical context makes this personal and memorable.',
      },
    ],
  },

  // ─── Hay ─────────────────────────────────────────────────────────────────

  {
    contentKey: 'hay',
    displayName: 'Hay — There Is / There Are',
    unitType: 'hay_gustar',
    vocabTerms: ['hay', 'there is', 'there are', 'existence', 'how many', 'cuántos', 'cuántas'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Hay" is one word that means both "there is" and "there are." No conjugation — hay stays hay. Hay una silla. Hay tres sillas. Just hay.',
        studentAction: 'Repeat hay in singular and plural contexts.',
        teacherHint: 'Hay is invariable — this is the key simplicity. Students often want to conjugate it.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each scene and say what is there.',
        studentAction: 'Read hay sentences with images.',
        teacherHint: 'Count items in images as a prompt for plural hay.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — hay plus quantity plus noun.',
        studentAction: 'Combine hay + number + noun.',
        teacherHint: 'Gender agreement with nouns still applies (un/una, dos, tres).',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: '¿Cuántas personas hay en tu familia? How many people are in your family? Tell me.',
        studentAction: 'Produce: Hay ___ personas en mi familia.',
        teacherHint: 'Family context makes it personal. Students may count aloud — that\'s fine.',
      },
    ],
  },

  // ─── Gustar ───────────────────────────────────────────────────────────────

  {
    contentKey: 'me gusta',
    displayName: 'Gustar — I Like / Me gusta',
    unitType: 'hay_gustar',
    vocabTerms: ['me gusta', 'te gusta', 'le gusta', 'gustar', 'like', 'I like', 'you like', 'he likes', 'preferences'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Gustar works backwards from English. "Me gusta el café" — literally, coffee is pleasing to me. "Me gusta" for singular things, "me gustan" for plural. Me gusta, me gustan.',
        studentAction: 'Repeat me gusta and me gustan.',
        teacherHint: 'The subject-object flip is the main conceptual challenge. Don\'t rush past it.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone likes. Read the sentence.',
        studentAction: 'Read me gusta / me gustan sentences.',
        teacherHint: 'Watch for gusta vs. gustan agreement with the noun, not the person.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who likes what?',
        studentAction: 'Combine indirect object pronoun + gusta/gustan + noun.',
        teacherHint: 'Me / te / le + gusta/gustan combinations — check all pronouns.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: '¿Qué te gusta hacer los fines de semana? What do you like to do on weekends?',
        studentAction: 'Produce: Me gusta ___.',
        teacherHint: 'Infinitive after me gusta is common and high-frequency. Accept any genuine answer.',
      },
    ],
  },

  // ─── Gustaría ─────────────────────────────────────────────────────────────

  {
    contentKey: 'me gustaría',
    displayName: 'Gustaría — I Would Like',
    unitType: 'hay_gustar',
    vocabTerms: ['me gustaría', 'would like', 'conditional', 'polite request', 'I would like', 'te gustaría'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Me gustaría" is the polite form — I would like. It\'s the conditional of gustar. Formal and extremely useful for real-world situations. Me gustaría.',
        studentAction: 'Repeat me gustaría.',
        teacherHint: 'Connect to gustar they already know. Same structure, different tense.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Read each sentence about what someone would like.',
        studentAction: 'Read me gustaría sentences with images.',
        teacherHint: 'Restaurant, travel, and request scenarios are ideal here.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — what would various people like?',
        studentAction: 'Combine pronoun + gustaría + noun or infinitive.',
        teacherHint: 'Gustaría is invariable — it never changes form (unlike full conditional conjugation).',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'If you could go anywhere, where would you like to go? Start with "Me gustaría ir a..."',
        studentAction: 'Produce a genuine me gustaría statement.',
        teacherHint: 'Travel/wish context is engaging and personal. Any answer is correct.',
      },
    ],
  },

  // ─── Fui (ir preterite) ───────────────────────────────────────────────────

  {
    contentKey: 'i went',
    displayName: 'Fui — I Went (ir preterite)',
    unitType: 'preterite',
    vocabTerms: ['fui', 'fue', 'ir', 'went', 'I went', 'he went', 'preterite', 'past tense', 'irregular'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Fui" — I went. "Fue" — he or she went. Watch out: fui and fue are also the preterite of ser — context tells you which. Fui, fue.',
        studentAction: 'Repeat fui and fue.',
        teacherHint: 'The ser/ir homonym in preterite is confusing — address it directly.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows where someone went. Read the sentence.',
        studentAction: 'Read fui / fue sentences with destination images.',
        teacherHint: 'The destination clarifies whether it\'s ir (went somewhere) vs. ser meaning.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who went where?',
        studentAction: 'Combine fui/fue + destination from columns.',
        teacherHint: 'Both fui and fue forms should appear.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: '¿Adónde fuiste el fin de semana pasado? Where did you go last weekend?',
        studentAction: 'Produce: Fui a ___.',
        teacherHint: 'Past personal experience is high-engagement. Any honest answer.',
      },
    ],
  },

  // ─── Progressive (estar + -ando / -iendo) ────────────────────────────────
  //
  // Madrigal Magic Key Card 14 — appears before the AR present tense (Card 15)
  // because "what is happening right now" is more communicatively urgent than
  // the full paradigm. Students already know "estoy" from estar; this lesson
  // adds the participle ending as a second snap-on piece.
  //
  // Textbook content: ESTA_TOCANDO_CHAPTER in madrigal-unit-content.ts (GustUnit)
  // Two clusters: -ando verbs (tocar, hablar, estudiar, nadar, patinar)
  //               -iendo verbs (escribir, vender, aprender)
  // Sentence columns: 6 Estoy [verb] phrases × 6 objects
  //
  // Pedagogical notes:
  //   - Anchor must establish TWO rules in one pass: estoy/está + the -ando/-iendo split
  //   - Do NOT lead with the grammar rule. Lead with the sound: "estoy tocando"
  //   - The QA pivot mirrors the textbook: ¿Está tocando? / Sí, estoy tocando. / No, no estoy tocando.
  //   - tú form is banned — questions use está (ella/usted), answers use estoy (yo)

  // ─── Tener — Health Expressions ──────────────────────────────────────────

  {
    contentKey: 'i have a cold',
    displayName: 'Tengo Catarro — Health Expressions (tener)',
    unitType: 'hay_gustar',
    vocabTerms: [
      'tengo', 'tiene', 'tenemos', 'tienen', 'tener',
      'catarro', 'fiebre', 'tos', 'gripe',
      'dolor de cabeza', 'dolor de garganta', 'dolor de estómago', 'dolor de espalda',
      'cold', 'fever', 'cough', 'flu', 'headache', 'sore throat', 'stomachache', 'backache',
      'health', 'sick', 'illness', 'I have a cold', 'I have a fever', 'how are you feeling',
    ],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'This chapter gives you the language of health. The pattern is simple: "tengo" plus the condition. Tengo catarro — I have a cold. Tengo fiebre — I have a fever. "Tiene" asks about you, he, or she. ¿Tiene fiebre? — Do you have a fever? Two forms — tengo and tiene. Say them: tengo catarro, tiene fiebre.',
        studentAction: 'Repeat the two anchor forms: tengo catarro, tiene fiebre.',
        teacherHint: 'Tengo has an irregular -go ending (like salgo, vengo, pongo). Flag it briefly — students often try to say "teno." The -go is what makes it memorable.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture. The question is always ¿Qué tiene? — What do you have? Or ¿Tiene fiebre? — Do you have a fever? Answer in first person: Tengo catarro. Tengo fiebre. Read each one.',
        studentAction: 'Read each answer aloud. Match the image to the sentence.',
        teacherHint: 'Make sure students produce the full phrase — "tengo catarro," not just "catarro." The verb is the anchor. Also note that "gripe" takes no article: tengo gripe, not tengo la gripe.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the columns. Column one is who: Tengo, Tiene, Tenemos, Tienen. Column two is the condition: catarro, fiebre, tos, gripe, dolor de cabeza, dolor de garganta. Scan across and fire the combination. Who has what?',
        studentAction: 'Combine subject forms with health conditions at speed. Tengo + catarro. Tiene + fiebre. Tenemos + tos.',
        teacherHint: 'Speed the scan. Students who slow down on "dolor de cabeza" should be encouraged to keep moving — the phrase will smooth out with repetition. The combinator burns in the pattern, not the pronunciation.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — I ask, you answer both ways. ¿Tiene dolor de cabeza? Answer yes: Sí, tengo dolor de cabeza. Now answer no: No, no tengo dolor de cabeza. The negative just adds "no" before tengo. Your turn.',
        studentAction: 'Produce full affirmative and negative answers. Pattern: Sí, tengo ___. / No, no tengo ___.',
        teacherHint: 'Listen for "no tengo" — not "tengo no." The double no (no, no tengo) is correct. If it sounds odd to students, remind them: the first "no" answers the question, the second negates the verb.',
      },
    ],
  },

  // ─── Estar — States & Feelings ────────────────────────────────────────────

  {
    contentKey: 'how are you feeling',
    displayName: '¿Cómo está? — States & Feelings (estoy contento)',
    unitType: 'ser_estar',
    vocabTerms: [
      'estoy', 'está', 'estamos', 'están', 'estar',
      'contento', 'contenta', 'cansado', 'cansada', 'enfermo', 'enferma',
      'triste', 'enojado', 'enojada', 'aburrido', 'aburrida',
      'listo', 'lista', 'cómodo', 'cómoda', 'enamorada', 'sola',
      'bien', 'mejor', 'mal', 'peor',
      'how are you', 'how is he', 'happy', 'tired', 'sick', 'sad', 'angry', 'bored',
      'cómo está', 'feelings', 'emotions', 'states',
    ],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'This chapter is about how someone feels right now. The verb is estar — to be, for states. "Estoy contento" — I am happy. "Está cansada" — she is tired. Notice the adjective ending: -o for a man, -a for a woman. One exception: triste never changes. Say them with me: estoy contento, está cansada, estoy triste.',
        studentAction: 'Repeat the anchor forms: estoy contento, está cansada, estoy triste.',
        teacherHint: 'The gender agreement is the new grammar here. Contento vs. contenta. Push students to say both. Triste is the easy one — flag it as a relief. If students confuse estar with ser, a single phrase: "estar is how you feel right now, ser is who you are."',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture. The question is ¿Cómo está? — How is he or she? Or ¿Está contento? — Is he happy? Answer in first person: Sí, estoy muy contento. Read each sentence you see. Pay attention to the -o or -a ending on the adjective.',
        studentAction: 'Read each model sentence aloud. Notice the gender ending on each adjective.',
        teacherHint: 'If student reads the wrong gender ending (estoy contenta when the image is male), correct immediately but gently — this is a high-frequency error. The visual hook should carry the gender.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Columns now. Column one is the verb form: Estoy, Está, Estamos, Están. Column two is the feeling: contento, cansado, enfermo, triste, bien, mejor. Scan and combine — but watch the gender ending. If you say "estoy" you are speaking as yourself. If you say "está" you are describing someone else.',
        studentAction: 'Combine verb forms with adjectives at speed. Adjust endings for gender when needed.',
        teacherHint: 'Speed matters, but not at the cost of gender agreement. If student consistently drops the -a ending, pause and drill that column alone: contento/contenta, cansado/cansada, enojado/enojada.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Final step — ¿Cómo está usted? How are you? Answer with bien, mal, cansado, whatever is true. Then I ask about someone else: ¿Cómo está él? and you describe him. The pattern: Estoy ___ for yourself, Está ___ for another person.',
        studentAction: 'Answer ¿Cómo está? in first person. Then switch to third person describing someone else.',
        teacherHint: 'This is the first time students will use ¿Cómo está? as a real conversational exchange, not just a drill. Let the answer be real — "estoy cansado" is fine. The goal is spontaneous production.',
      },
    ],
  },

  // ─── Estar — Condition of Objects ─────────────────────────────────────────

  {
    contentKey: 'is it clean',
    displayName: 'Está Limpio / Está Sucio — Condition of Objects',
    unitType: 'ser_estar',
    vocabTerms: [
      'limpio', 'limpia', 'sucio', 'sucia', 'está limpio', 'está limpia', 'está sucio', 'está sucia',
      'cuchara', 'plato', 'servilleta', 'mantel', 'jarra', 'taza', 'vaso', 'cuchillo',
      'spoon', 'plate', 'napkin', 'tablecloth', 'pitcher', 'cup', 'glass', 'knife',
      'clean', 'dirty', 'table setting', 'restaurant', 'está',
    ],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Two new words — limpio and sucio. Limpio means clean. Sucio means dirty. And the ending changes with the noun: el plato limpio, la cuchara limpia. If the noun is feminine, the adjective is -a. If masculine, -o. Está connects them: la cuchara está limpia — the spoon is clean. Say them: está limpio, está limpia.',
        studentAction: 'Repeat the two anchor forms: está limpio, está limpia.',
        teacherHint: 'This is gender agreement applied to objects, not people — students may be surprised that it works the same way. Reinforce: the noun determines the ending. La cuchara → limpia. El plato → limpio.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture — a table setting at a restaurant. The question is ¿Está limpio? or ¿Está limpia? depending on the noun. The answer uses the same adjective back. La cuchara está limpia. El plato está limpio. Read each one.',
        studentAction: 'Read each model sentence aloud, matching the -o or -a ending to the noun.',
        teacherHint: 'Common error: "la cuchara está limpio" — wrong gender. The quick fix: point to the article (la → -a). This chapter trains automatic gender-adjective agreement.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now — I say a noun, you produce the full sentence: ¿Está limpio el vaso? La jarra — ¿está limpia o sucia? Scan the items you have seen and describe each one as limpio/a or sucio/a. Keep the ending correct.',
        studentAction: 'For each table-setting noun, produce a full sentence with está limpio/a or está sucio/a. Match the adjective ending to the noun gender.',
        teacherHint: 'This is a more open drill — student chooses limpio or sucio. Accept both, just correct the ending. If a student says "la servilleta está sucio," correct to "sucia" immediately.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — the full negative. If something is not clean, we say it two ways: No, la servilleta no está sucia. La servilleta está limpia. First deny the question, then give the correct description. Try one: ¿Está sucio el mantel? Answer: No...',
        studentAction: 'Produce the two-part negative answer: No, [noun] no está sucio/a. [Noun] está limpio/a.',
        teacherHint: 'The two-part answer (deny + correct) is a natural conversation move. Students who can do this fluently can handle any confusion at a restaurant in Spanish. That is the real-world payoff of this chapter.',
      },
    ],
  },

  // ─── Ir + a + Infinitive — Near Future ────────────────────────────────────

  {
    contentKey: 'i am going to sell',
    displayName: 'Voy a / Va a — Near Future (ir + infinitive)',
    unitType: 'verb',
    vocabTerms: [
      'voy a', 'va a', 'vamos a', 'van a', 'ir a',
      'vender', 'leer', 'comprar', 'tomar', 'comer',
      'casa', 'lancha', 'auto', 'boletos', 'revista', 'menú', 'periódico', 'libro',
      'going to sell', 'going to read', 'near future', 'I am going to', 'are you going to',
      'voy', 'va', 'future plans',
    ],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'This chapter builds on ir — to go. You already know voy (I am going) and va (he/she is going). Now you add one piece: "a" plus any infinitive. Voy a vender — I am going to sell. Va a leer — he is going to read. The infinitive never changes. Say them: voy a vender, va a leer.',
        studentAction: 'Repeat the two anchor forms: voy a vender, va a leer.',
        teacherHint: 'This is the Spanish near future — the equivalent of "going to" in English. Students will likely recognize it once they hear it. Emphasize the three-part pattern: voy + a + infinitive. The infinitive is always the base form.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture. The question is ¿Va a vender la casa? — Are you going to sell the house? Answer: Sí, voy a vender la casa. The image tells you what — your job is the verb pattern. Read each one.',
        studentAction: 'Read each model sentence aloud. The image anchors the noun; the pattern anchors the verb.',
        teacherHint: 'The biggest error is dropping the "a": "voy vender" instead of "voy a vender." The "a" is essential. If student drops it, hold up a finger — "the a is always there."',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Columns — column one is who: Voy a, Va a, Vamos a, Van a. Column two is the action plus object: vender la casa, leer el periódico, comprar los boletos, leer la revista. Scan across and fire. Who is going to do what?',
        studentAction: 'Combine ir + a forms with infinitive phrases at speed. All four subject forms should appear.',
        teacherHint: 'Remind students that Vamos a is "we are going to" — they may want to translate it literally. Van a is "they are going to." The combinator forces rapid switching between all four forms.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Final step — I ask, you answer both ways. ¿Va a vender el auto? Yes: Sí, voy a vender el auto. No: No, no voy a vender el auto. Notice: the question uses "va a" (about you), the answer uses "voy a" (I). That flip is the whole game. Ready?',
        studentAction: 'Answer ¿Va a + infinitive? in first person, both affirmatively and negatively.',
        teacherHint: 'The va → voy flip is the key moment of this chapter. Students who nail it can handle near-future questions in real conversation. If they answer "sí, va a vender," correct: the question is about them — the answer is always "voy."',
      },
    ],
  },

  // ─── Salir / Llegar — Transportation Schedules ───────────────────────────

  {
    contentKey: 'at what time does it leave',
    displayName: '¿A Qué Hora Sale/Llega? — Transport Schedules',
    unitType: 'verb',
    vocabTerms: [
      'sale', 'llega', 'salgo', 'llego', 'salimos', 'llegamos', 'salen', 'llegan',
      'salir', 'llegar', 'a qué hora', 'at what time',
      'tren', 'avión', 'autobús', 'barco',
      'train', 'plane', 'bus', 'boat', 'ferry',
      'departure', 'arrival', 'schedule', 'transportation', 'leaves', 'arrives',
      'a las nueve', 'a las doce', 'a las dos', 'a las seis',
    ],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Two verbs — salir and llegar. Sale means "it leaves" or "you leave." Llega means "it arrives" or "you arrive." The question is ¿A qué hora? — At what time? Put them together: ¿A qué hora sale el tren? — At what time does the train leave? ¿A qué hora llega el avión? — At what time does the plane arrive? Say them: sale, llega.',
        studentAction: 'Repeat the two anchor forms: sale, llega.',
        teacherHint: 'Salir is irregular in yo — salgo, not salo. Flag it but do not drill it here — the chapter uses third-person forms (sale, llega) for transportation. If the yo form comes up, say "salgo" and move on.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture — trains, planes, buses, boats. The question is ¿A qué hora sale el tren? The answer gives you the time: El tren sale a las nueve. The same with llega: El avión llega a las ocho. Read each sentence with the time.',
        studentAction: 'Read each model sentence aloud. Include the time — "a las ___" is the answer pattern.',
        teacherHint: 'Students may hesitate on the time. Encourage them to just say the number — "a las nueve" — even if hours are not fully solid. The focus is on sale / llega, not on clock fluency.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Three columns — vehicle, verb, time. El tren — sale — a las nueve. El avión — llega — a las ocho. El autobús — sale — a las dos. Scan across: vehicle + sale or llega + a las + number. Fire each combination.',
        studentAction: 'Combine vehicle + sale/llega + time from the three columns. Produce full sentences.',
        teacherHint: 'The combinator here is a real schedule-reading drill. In any train station or airport, this is exactly the information students will need. Keep it practical — "you are reading a departure board right now."',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — question and answer pairs. I ask, you answer. ¿A qué hora sale el barco? — El barco sale a las seis. Then I flip: ¿Y el avión? ¿Cuándo llega? — El avión llega a las ocho. The key is that the vehicle becomes the subject of the answer — always use it. Ready?',
        studentAction: 'Answer ¿A qué hora sale/llega + vehicle? with a full sentence including the vehicle and the time.',
        teacherHint: 'Push for the full sentence: "El tren sale a las nueve," not just "a las nueve." The verb and subject must be in the answer — that is the Madrigal habit. Incomplete answers get a gentle prompt: "El tren sale a las...?"',
      },
    ],
  },

  // ─── Poder — Can / Able to ───────────────────────────────────────────────

  {
    contentKey: 'i can go',
    displayName: 'Puedo Ir — I Can Go (poder)',
    unitType: 'verb',
    vocabTerms: ['puedo', 'puede', 'puedo ir', 'puede ir', 'no puedo', 'no puede', 'poder', 'can', 'able', 'i can go', 'can you go', 'tienda', 'fiesta', 'baile', 'concierto', 'ballet'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Two forms today. "Puedo ir" — I can go. "Puede ir" — you can go. Then the negatives: "No puedo ir" — I can\'t go. "No puede ir" — you can\'t go. These four are your building blocks. Say them with me: puedo ir, puede ir, no puedo ir, no puede ir.',
        studentAction: 'Repeat all four forms: puedo ir, puede ir, no puedo ir, no puede ir.',
        teacherHint: 'The difference between puedo and puede is a single vowel shift. Drill both before moving on — students often collapse them into one form.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture and read the exchange. Notice that I ask with "puede" and you answer with "puedo" — the subject shifts when the question is answered. ¿Puede ir a la tienda? → Sí, puedo ir a la tienda. ¿Puede ir al baile conmigo? → Sí, puedo ir al baile con usted. Read each pair.',
        studentAction: 'Read each question-answer pair aloud. Shift puede → puedo in every answer.',
        teacherHint: 'The puede/puedo flip is the central habit here. If student answers with puede, stop and redirect: "When you are speaking about yourself, which form do you use?"',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the sentence columns. Column one: puedo ir / puede ir / no puedo ir / no puede ir. Column two: al baile / al concierto / al ballet / a la tienda / a la fiesta / a la clase / a mi casa. Scan across and fire the combinations. Go quickly.',
        studentAction: 'Combine one item from each column into a complete sentence.',
        teacherHint: 'Watch for the contraction — it is "al baile" not "a el baile." Correct quietly and keep moving.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — question and answer. I ask: ¿Puede ir al concierto esta noche? You answer affirmatively, then I ask again and you answer negatively. Sí, puedo ir al concierto esta noche. No, no puedo ir al concierto esta noche. Then we flip — you ask me and I answer. Ready?',
        studentAction: 'Answer ¿Puede ir...? with full affirmative then full negative sentence. Then reverse roles.',
        teacherHint: 'The full negative is "No, no puedo ir" — two negatives, no reduction. Both must be present. If student drops one, prompt: "No... no puedo ir." Both nos stay.',
      },
    ],
  },

  // ─── Preterite — Hacer / Ir / Oír / Leer ─────────────────────────────────

  {
    contentKey: 'what did you do',
    displayName: '¿Qué Hizo? — What Did You Do? (hacer preterite)',
    unitType: 'preterite',
    vocabTerms: ['hice', 'hizo', 'hicimos', 'hicieron', 'hacer', 'did', 'jugué', 'trabajé', 'vi', 'oí', 'leí', 'fui', 'what did you do', 'qué hizo', 'esta mañana', 'ayer', 'esta noche', 'esta tarde'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Hacer" is irregular in the preterite. Listen carefully: hice — I did. Hizo — you or he or she did. Hicimos — we did. Hicieron — they did. Notice the c changes to z in "hizo." Say the four forms with me: hice, hizo, hicimos, hicieron.',
        studentAction: 'Repeat the four irregular forms: hice, hizo, hicimos, hicieron.',
        teacherHint: 'The hice/hizo pair is the key — students often want to say "hicé" or "hizé." If that happens, stop and compare: "hice has a c; hizo has a z." Let them see the pattern.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Now the question "¿Qué hizo?" — What did you do? — unlocks all past-tense verbs, not just hacer. Look at each picture. ¿Qué hizo esta mañana? → Esta mañana jugué al tenis. ¿Qué hizo ayer? → Ayer fui a la playa. The time expression goes first. Read each exchange.',
        studentAction: 'Read each question-answer pair. Put the time expression first in the answer.',
        teacherHint: 'The time-first word order (esta mañana jugué, ayer fui) is the Madrigal habit. If student puts the time at the end, it is not wrong — but model the front-placement and let them hear the difference.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the combinations. Column one is your verb: jugué / trabajé / vi / oí / leí / fui. Column two is what or where: al tenis / en el jardín / al golf / un programa de televisión / un programa de radio / el periódico / a la playa / al cine. Pick a time — esta mañana, ayer, esta noche — and fire the combination.',
        studentAction: 'Choose a time expression, then combine one verb with one destination or object.',
        teacherHint: 'Oí and leí have accent marks — they are stressed on the final vowel. If student mispronounces (oh-ee vs. oi), model it slowly: "o — í, leí."',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — I ask with ¿Qué hizo? and vary the time: esta mañana, ayer, esta tarde, esta noche. You answer in a full sentence starting with the time expression. Then I ask: ¿Y usted? ¿Qué hizo? Now it is a real conversation. What did you actually do?',
        studentAction: 'Answer ¿Qué hizo [time]? with a full sentence. Then answer the open question ¿Y usted? honestly.',
        teacherHint: 'The open ¿Y usted? is where the drill becomes language. Accept any accurate past-tense verb — fui, vi, hice, jugué. The point is spontaneous production, not repetition of the model.',
      },
    ],
  },

  {
    contentKey: 'did you have',
    displayName: '¿Tuvo? / ¿Vino? — Did You Have? (tener/venir preterite)',
    unitType: 'preterite',
    vocabTerms: ['tuve', 'tuvo', 'tuvimos', 'tuvieron', 'vine', 'vino', 'tener', 'venir', 'did you have', 'tuvo', 'vino', 'no pude', 'no tuve tiempo', 'fiesta', 'visitas', 'catarro', 'trabajo'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Two irregular preterites today — both follow the same pattern. Tener: tuve, tuvo, tuvimos, tuvieron. Venir: vine, vino, vinimos, vinieron. Notice the shared DNA — both swap their root vowel and drop the accent. Say them with me: tuve, tuvo — vine, vino.',
        studentAction: 'Repeat both sets: tuve / tuvo and vine / vino.',
        teacherHint: 'Tuve/vine are mirror images in structure. If student can hear the parallel, they will learn both at once. Point it out explicitly: "Both follow the same shape."',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at the picture and answer. ¿Tuvo una fiesta el sábado? — Did you have a party Saturday? → Sí, tuve una fiesta linda el sábado. Now the sympathetic form: ¿Tuvo catarro esta semana? → Sí, tuve catarro esta semana. ¡Qué terrible! The exclamation is part of the Madrigal script — use it.',
        studentAction: 'Read each exchange. Include ¡Qué terrible! where the script calls for it.',
        teacherHint: '"¡Qué terrible!" is a formulaic response Madrigal teaches for illness and hardship. It becomes automatic — let it. Formulaic chunks accelerate fluency.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the ¿Vino? cluster. The answer goes negative: No, no vine — I didn\'t come. Then add the reason: No pude — I couldn\'t. No tuve tiempo — I didn\'t have time. These two reasons combine. ¿Vino a la playa? → No, no vine. No pude. No tuve tiempo. Fire the combinations with different destinations.',
        studentAction: 'Answer ¿Vino a...? negatively, then chain: no vine + no pude + no tuve tiempo.',
        teacherHint: 'The three-part negative chain (no vine / no pude / no tuve tiempo) is a conversational set piece. Once students have it, they sound fluent. It is worth drilling as a unit.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — I ask, you answer. ¿Tuvo visitas esta semana? → Sí, tuve visitas / No, no tuve visitas. Then: ¿Vino al club la semana pasada? → Sí, vine / No, no vine. No pude. No tuve tiempo. Finally — ¿Tuvo mucho trabajo? Answer honestly.',
        studentAction: 'Answer ¿Tuvo...? and ¿Vino...? questions with full sentences. Use the three-part chain when declining.',
        teacherHint: 'Watch for "no tuve tiempo" — students sometimes say "no tenía tiempo" (imperfect). Both exist in Spanish but mean something slightly different. For now, stay in the preterite.',
      },
    ],
  },

  {
    contentKey: 'i brought it to him',
    displayName: 'Le — Indirect Object Pronouns (le traje / le dije)',
    unitType: 'preterite',
    vocabTerms: ['le', 'le traje', 'le dijo', 'le dije', 'traje', 'trajo', 'dije', 'dijo', 'indirect object', 'to him', 'to her', 'to you', 'traer', 'decir', 'libro', 'disco', 'interesante', 'terrible', 'excelente'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Le" is the indirect object pronoun — it means "to him," "to her," or "to you." It goes before the verb. Le traje — I brought (to him/her). Le dije — I told (him/her). Traer and decir are both irregular in the preterite: traje/trajo/trajimos/trajeron and dije/dijo/dijimos/dijeron. Say them with me: le traje, le dije.',
        studentAction: 'Repeat the anchor forms: le traje, le dijo, traje, trajo, dije, dijo.',
        teacherHint: 'Both traer and decir drop their -j- into a -j- stem (traje, dije). No written accent in the preterite. If students add accents by analogy, note the exception gently.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'The question is ¿Qué le trajo? — What did you bring him/her? Answer: Le traje un libro. Le traje un disco. The "le" locks onto the front of the verb in both question and answer. Read the pairs, keeping the le in front.',
        studentAction: 'Read each ¿Qué le trajo? / Le traje... exchange.',
        teacherHint: 'Students sometimes want to move the le to the end of the verb ("trajerle"). It stays before in conjugated forms. Only infinitives and gerunds take the attached form.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the second cluster: Le dije que era... — I told him/her that it was... The combinator is simple: one phrase, five adjectives. Le dije que era interesante. Le dije que era terrible. Le dije que era excelente. Le dije que era imposible. Le dije que era formidable. Run through all five.',
        studentAction: 'Complete: Le dije que era ___ with each of the five adjectives in turn.',
        teacherHint: 'All five adjectives are Spanish-English cognates — students can say them without explanation. Move quickly through all five to show how one structure carries many meanings.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — question and answer. ¿Qué le trajo? → Le traje un libro. Then I reverse: ¿Le traje un disco? → Sí, me trajo un disco. Notice — when I am the receiver, "le" becomes "me." That flip is the QA pivot here. Try it.',
        studentAction: 'Answer ¿Qué le trajo? with le traje. Then flip: when asked ¿Le trajo...?, answer with me trajo.',
        teacherHint: 'The le → me flip when the speaker becomes the recipient is a key insight. If the student misses it, ask: "Who is receiving now? You? Then which pronoun?" Lead them there rather than announcing the rule.',
      },
    ],
  },

  // ─── Preterite — AR Verbs ────────────────────────────────────────────────

  {
    contentKey: 'i studied',
    displayName: 'Estudié — AR Preterite (–é / –ó / –aron)',
    unitType: 'preterite',
    vocabTerms: ['estudié', 'estudió', 'estudiar', 'pagué', 'pagó', 'nadé', 'nadó', 'compré', 'compró', 'AR preterite', '-é ending', '-ó ending', '-aron ending', 'compraron', 'alquilaron', 'trabajaron'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'In the past tense, AR verbs follow a clear pattern. When you speak of yourself: add -é. When you speak of someone else (singular): add -ó. For a group: add -aron. For we: add -amos. So "estudiar" becomes: estudié / estudió / estudiamos / estudiaron. Say the four endings with me: -é, -ó, -amos, -aron.',
        studentAction: 'Repeat the four endings: -é, -ó, -amos, -aron.',
        teacherHint: 'The accent on -é and -ó is critical — it distinguishes past from present (estudio vs. estudió). If student drops the accent in speech (flat final vowel), model the stressed form clearly.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture. I ask with -ó; you answer with -é. ¿Estudió hoy? → Sí, estudié hoy. ¿Pagó la cuenta? → Sí, pagué la cuenta. ¿Nadó hoy? → Sí, nadé hoy. Notice "pagar" becomes "pagué" — the spelling changes to keep the g-sound. Read each pair.',
        studentAction: 'Answer each ¿[verb]-ó? question with Sí, [verb]-é.',
        teacherHint: 'The pagar → pagué spelling change (not pagé) is a common stumble. It keeps the hard g sound. Compare: pago (present), pagué (past). Brief mention is enough.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the -aron cluster. ¿Compraron una lancha? → Sí, compraron una lancha. ¿Alquilaron una casa? → Sí, alquilaron una casa. ¿Trabajaron anoche? → Sí, trabajaron mucho anoche. The -aron ending covers "they" and "you all." Run the combinations.',
        studentAction: 'Answer each ¿[verb]-aron? question with a full sentence using -aron.',
        teacherHint: 'Students often confuse -aron with -aron in the present (hablan). The key audible difference is stress: hablÁRON (past) vs. HÁblan (present). Exaggerate the stress difference if needed.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — person flip. I give you the yo form and you give me the usted form, and vice versa. Estudié → ¿Estudió? / Pagó → Pagué. Then I say: "Roberto nadó hoy." You respond: ¿Nadó Roberto? Yes, he did — nadó. The pivot is: who is doing the action changes which ending you use.',
        studentAction: 'Flip between the -é and -ó forms as the subject shifts between yo and usted/él/ella.',
        teacherHint: 'The yo/usted-él-ella flip is the core drill. The moment this becomes effortless, the student owns the AR preterite. Keep flipping until the response is automatic.',
      },
    ],
  },

  // ─── Preterite — ER/IR Verbs ─────────────────────────────────────────────

  {
    contentKey: 'i received',
    displayName: 'Recibí — ER/IR Preterite (–í / –ió / –ieron)',
    unitType: 'preterite',
    vocabTerms: ['recibí', 'recibió', 'vendí', 'vendió', 'escribí', 'escribió', 'vi', 'vio', 'recibir', 'vender', 'escribir', 'ER preterite', 'IR preterite', '-í ending', '-ió ending', '-ieron ending', 'paquete', 'carta', 'lancha', 'cumpleaños', 'Navidad'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'ER and IR verbs in the past tense have their own set of endings. When you speak of yourself: -í. When you speak of someone else singular: -ió. For a group: -ieron. For we: -imos. So "recibir" becomes: recibí / recibió / recibimos / recibieron. Say the four endings: -í, -ió, -imos, -ieron.',
        studentAction: 'Repeat the four endings: -í, -ió, -imos, -ieron.',
        teacherHint: 'Connect to the AR endings for contrast: AR uses -é/-ó/-amos/-aron; ER/IR uses -í/-ió/-imos/-ieron. If students already know AR, this contrast is the quickest path to mastery.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'I ask with -ió; you answer with -í. ¿Vendió la lancha hoy? → Sí, vendí la lancha hoy. ¿Escribió la carta? → Sí, escribí la carta. ¿Recibió el paquete? → Sí, recibí el paquete hoy. ¿Vio el programa? → Sí, vi el programa. Read each pair.',
        studentAction: 'Answer each ¿[verb]-ió? question with Sí, [verb]-í.',
        teacherHint: '"Vi" (I saw) has no accent mark — it is only one syllable. Students sometimes write "ví" by analogy. Note it quietly. Also "vio" (he saw) has no accent either.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the gift cluster. ¿Qué recibió para su cumpleaños? — What did you receive for your birthday? ¿Qué recibió para la Navidad? Use the gifts: una caja de chocolates / una botella de perfume / una billetera / un portafolio. Fire the combinations with both occasions.',
        studentAction: 'Answer ¿Qué recibió para su cumpleaños? and ¿Qué recibió para la Navidad? with the gift options.',
        teacherHint: 'The "para mi cumpleaños" / "para la Navidad" distinction gives students two real conversational triggers. Both are gift occasions — different wording, same structure.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — person flip. Vendí → ¿Vendió? / Recibió → Recibí. Then I say: "Enrique vendió la lancha." You ask: ¿Vendió Enrique la lancha? Yes — vendió. The pivot is the same as with AR verbs: who is speaking determines the ending.',
        studentAction: 'Flip between -í and -ió as the subject shifts. Confirm with third-person name as subject.',
        teacherHint: 'If students mastered the AR pivot, this clicks fast. If not, use the same approach: exaggerate the stress on the final vowel to anchor the speaker-identity cue.',
      },
    ],
  },

  // ─── Imperfect ───────────────────────────────────────────────────────────

  {
    contentKey: 'used to buy',
    displayName: 'Compraba — Imperfect Tense (–aba / –ía)',
    unitType: 'imperfect',
    vocabTerms: ['compraba', 'comprabas', 'comprábamos', 'compraban', 'vendía', 'vendíamos', 'vendían', 'tenía', 'imperfect', 'used to', 'was buying', 'was selling', 'antes', 'memories', 'descriptions', 'máquinas', 'tractores', 'sombreros', 'flores', 'libros'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'The imperfect tense describes what someone used to do — the tense of memories and stories. AR verbs end in -aba: compraba (I used to buy / you used to buy / he or she used to buy). For we: comprábamos. For they: compraban. ER and IR verbs end in -ía: vendía, vendíamos, vendían. Say them: compraba, comprábamos, compraban — vendía, vendíamos, vendían.',
        studentAction: 'Repeat both sets: compraba series and vendía series.',
        teacherHint: 'The critical feature of the imperfect: the yo and usted/él/ella forms are identical (compraba = I used to buy AND you/he/she used to buy). Context resolves the ambiguity. Mention this once — do not dwell.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'The trigger word is "antes" — before, in the past. ¿Qué compraba antes? → Compraba máquinas. ¿Compraba tractores también? → Sí, compraba tractores también. Now the vendía cluster: ¿Qué vendía usted? → Vendía sombreros. ¿Qué vendía María? → María vendía blusas. Read each sentence.',
        studentAction: 'Read each model sentence. Hear how compraba and vendía carry the "used to" meaning.',
        teacherHint: '"Antes" is a reliable context cue for the imperfect. Train students to notice it as a green flag for -aba/-ía forms.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Combine: compraba / vendía / tenía × objects. ¿Qué compraba en el mercado? → Compraba frutas. ¿Qué vendía? → Vendía flores en el mercado. Now tenía — used to have. ¿Tenía usted un auto? → Sí, tenía un auto. Mix all three verbs with different objects.',
        studentAction: 'Produce sentences with compraba, vendía, and tenía plus different objects.',
        teacherHint: 'Tenía follows the ER/IR pattern (-ía). Students who internalize compraba and vendía will generalize automatically. Let them try before correcting.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — the memory conversation. I ask about your past: ¿Compraba café por las mañanas? → Sí, compraba café todas las mañanas. ¿Vendía usted libros? → Sí, vendía libros en la librería. Then open: ¿Qué hacía usted antes? — What did you used to do? Answer honestly with the imperfect.',
        studentAction: 'Answer each ¿[verb]aba/ía? question, then respond to the open ¿Qué hacía antes? with a true sentence.',
        teacherHint: 'The open ¿Qué hacía antes? invites authentic language. Any -aba or -ía verb is valid. Resist the urge to correct minor errors here — fluency in real use is the goal of step 3.',
      },
    ],
  },

  // ─── Reflexive Verbs ─────────────────────────────────────────────────────

  {
    contentKey: 'morning routine',
    displayName: 'Me Levanto — Reflexive Verbs (morning routine)',
    unitType: 'reflexive',
    vocabTerms: ['me levanto', 'se levantó', 'me levanté', 'me bañé', 'me peiné', 'me lavé', 'me sequé', 'me afeité', 'reflexive', 'myself', 'me', 'se', 'nos', 'levantarse', 'bañarse', 'peinarse', 'acostarse', 'esta mañana', 'anoche'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Reflexive verbs reflect the action back on the person doing it — things you do to yourself. Three pronouns: me (myself), se (yourself, himself, herself), nos (ourselves). They go directly before the verb. Me levanto — I get up. Se levantó — you got up. The verb list: levantarse, bañarse, lavarse, peinarse, secarse, afeitarse, acostarse. Say the pronouns with me: me, se, nos.',
        studentAction: 'Repeat: me, se, nos. Then repeat the verb list once.',
        teacherHint: 'The reflexive pronoun placement before the verb is the key rule. In the preterite the pronoun still comes first: me levanté, se levantó. Do not let students attach it to the verb form.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at the morning routine pictures. I ask with "se"; you answer with "me." ¿A qué hora se acostó anoche? → Anoche me acosté a las once. ¿A qué hora se levantó esta mañana? → Me levanté a las siete esta mañana. ¿Se bañó con agua y jabón? → Sí, me bañé con agua y jabón. Read each pair.',
        studentAction: 'Answer each ¿Se...? question with Me... in a full sentence with a time if given.',
        teacherHint: 'The se → me shift when answering is identical to the puede → puedo shift students learned with poder. If they remember that drill, this is the same mechanism.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the morning sequence in order: Me levanté → me bañé → me sequé → me peiné → me lavé la cara → me afeité → me lavé el pelo. Read each one and connect it to the picture. Then scan: which ones apply to your own morning? Which ones do you actually do?',
        studentAction: 'Read each reflexive past-tense phrase. Mentally note which apply to your morning.',
        teacherHint: 'The question of which ones apply is not rhetorical — it personalizes the vocabulary. A student who connects "me peiné" to a real memory will recall it far better than one who only reads it.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — the morning interview. I ask: ¿Se lavó la cara esta mañana? → Sí, me lavé la cara. ¿Se afeitó? → Sí, me afeité. Then open: ¿A qué hora se levantó hoy? Answer honestly — this is real language now.',
        studentAction: 'Answer each ¿Se [reflexive verb]? question with Me [reflexive verb] in a full sentence.',
        teacherHint: 'For the open question, accept any accurate reflexive preterite form. If student uses present tense by mistake (me levanto), note gently: "Today we are in the past — me levanté."',
      },
    ],
  },

  // ─── Present Perfect ─────────────────────────────────────────────────────

  {
    contentKey: 'have you bought',
    displayName: 'He Comprado — Present Perfect (he/ha + past participle)',
    unitType: 'perfect',
    vocabTerms: ['he comprado', 'ha comprado', 'hemos comprado', 'han comprado', 'he vendido', 'ha vendido', 'he estudiado', 'he pagado', 'he recibido', 'present perfect', 'have bought', 'have sold', '-ado', '-ido', 'todavía', 'esta semana'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'The present perfect is two pieces: the helper verb "haber" plus a past participle. He / ha / hemos / han — then the participle. For AR verbs: drop -AR and add -ado. Comprar → comprado. Estudiar → estudiado. For ER and IR verbs: drop the ending and add -ido. Vender → vendido. Recibir → recibido. Say the helper verb series: he, ha, hemos, han.',
        studentAction: 'Repeat: he, ha, hemos, han. Then say one example: he comprado, ha comprado.',
        teacherHint: 'The two-piece structure (helper + participle) is new for most students. Establish it before any vocabulary — "What are the two pieces? What is the helper? What is the participle?"',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at the pairs. I ask with "ha"; you answer with "he." ¿Ha comprado la casa? → Sí, he comprado la casa. ¿Ha estudiado esta semana? → Sí, he estudiado mucho esta semana. Negative with "todavía" — yet: ¿Ha comprado la bicicleta? → No, no he comprado la bicicleta todavía. Read each exchange.',
        studentAction: 'Answer ¿Ha [verb]? with he [verb]. For negatives, add todavía at the end.',
        teacherHint: '"Todavía" (yet / still) goes at the end of the negative: "No he comprado la bicicleta todavía." If student places it before the verb, model the end position again.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the ER/IR column: he vendido / he recibido / he visto / he escrito. ¿Ha vendido el auto? → Sí, he vendido el auto. ¿Ha recibido el telegrama? → Sí, he recibido el telegrama. Mix AR and ER/IR: he comprado / he estudiado / he pagado / he vendido / he recibido. Try each one.',
        studentAction: 'Produce full sentences with both -ado and -ido participles mixed together.',
        teacherHint: '-Ado and -ido participles are invariable — they never change for gender or number in the present perfect. "He comprado" whether the object is masculine, feminine, singular, or plural.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — the pivot. ¿Ha pagado la cuenta? → Sí, he pagado / No, no he pagado todavía. Then I use ha as a statement: María ha vendido la lancha. You confirm: ¿Ha vendido María la lancha? Sí, ha vendido la lancha. The ha/he flip is the conversation engine.',
        studentAction: 'Answer ¿Ha...? questions, then confirm third-person statements using ha.',
        teacherHint: 'The ha (he/she/you have) in statements and questions is identical — context determines who. Point this out explicitly so students do not over-distinguish.',
      },
    ],
  },

  // ─── Object Pronouns ─────────────────────────────────────────────────────

  {
    contentKey: 'i see it',
    displayName: 'Lo Veo — Direct Object Pronouns (lo / la / los / las)',
    unitType: 'object_pronoun',
    vocabTerms: ['lo', 'la', 'los', 'las', 'lo veo', 'la veo', 'los veo', 'las veo', 'me', 'direct object pronoun', 'i see it', 'i see him', 'i see her', 'before the verb', 'edificio', 'barco', 'lámpara', 'llamo', 'conozco'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Direct object pronouns replace the noun that receives the action — and they go directly before the verb. Four forms: lo (masculine singular — him or it), la (feminine singular — her or it), los (masculine plural — them), las (feminine plural — them). Say them: lo, la, los, las. Plus me — me. Me ve. She sees me.',
        studentAction: 'Repeat: lo, la, los, las, me.',
        teacherHint: 'The placement-before-verb rule is the most important takeaway. Drill it as a rule before any vocabulary: "Where does the pronoun go? Before the verb. Always."',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture. I ask; you replace the noun with lo or la. ¿Ve el edificio? — Lo veo. ¿Ve el barco? — Lo veo. ¿Ve la lámpara? — La veo. Read the exchanges and feel the pattern: masculine noun → lo, feminine noun → la, always before the verb.',
        studentAction: 'Answer each ¿Ve el/la [noun]? with Lo veo or La veo.',
        teacherHint: 'Students must decide gender first, then choose the pronoun. If they hesitate, ask: "Is it masculine or feminine?" — let them work it out rather than supplying the answer.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the parallel pairs. Lo veo / La veo. Lo llamo / La llamo. Lo conozco / La conozco. Lo quiero / La quiero. Each verb works with both pronouns — the noun determines which one. Then "me": Me ve. She sees me. Me llama. She calls me. Me always means the speaker is the object.',
        studentAction: 'Read each lo/la parallel pair aloud, then the me examples.',
        teacherHint: 'The me examples flip the perspective — now the speaker is receiving the action. This is a preview of the indirect object system. Keep it brief — just note it.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step. I name a noun; you give me the full sentence with the correct pronoun. "El edificio" → Lo veo. "La lámpara" → La veo. "Los edificios" → Los veo. "Las lámparas" → Las veo. Then I ask about people: ¿Ve a María? — La veo. ¿Ve a Juan? — Lo veo. The personal "a" appears before a person; the pronoun stays before the verb.',
        studentAction: 'Produce Lo/La/Los/Las veo for each noun given, choosing the correct pronoun.',
        teacherHint: 'The los/las plural extension should feel automatic by now — the same lo→los, la→las pattern from articles. If student hesitates on plural, connect back: "How do we make "el" plural? Same thing here."',
      },
    ],
  },

  {
    contentKey: 'he sent it to me',
    displayName: 'Me Lo — Double Object Pronouns (me lo / se lo)',
    unitType: 'object_pronoun',
    vocabTerms: ['me lo', 'se lo', 'nos lo', 'me lo mandó', 'me lo trajo', 'se lo dije', 'double object pronouns', 'indirect direct', 'le changes to se', 'paquete', 'paraguas', 'disco', 'libro', 'regalo', 'mandó', 'trajo'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'When two object pronouns appear together, the indirect comes first, then the direct. But there is one rule: when "le" (to him/her/you) comes before "lo" or "la," the "le" changes to "se." It never sounds natural to say "le lo" — Spanish avoids it. The result: me lo (it to me), se lo (it to you/him/her), nos lo (it to us). Say them: me lo, se lo, nos lo.',
        studentAction: 'Repeat: me lo, se lo, nos lo.',
        teacherHint: 'The le → se change is a rule without exceptions in standard Spanish. Do not try to explain why — just announce it and let students practice until the pattern feels natural.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture. ¿Le mandó el paquete? — Did he send you the package? → Sí, me lo mandó hoy. The "el paquete" collapses into "lo." The "le" (to you) becomes "me" because the listener is the receiver. Read each exchange: ¿Le trajo el paraguas? → Sí, me lo trajo hoy. ¿Le trajo el disco? → Sí, me lo trajo hoy.',
        studentAction: 'Answer each ¿Le mandó/trajo el [object]? with Sí, me lo mandó/trajo hoy.',
        teacherHint: 'Both pronouns shrink into a fixed two-word unit: me lo. The object noun disappears entirely. If student tries to repeat the noun (me lo mandó el paquete), note that the noun is already replaced.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the se lo cluster. Se lo means "it to you / it to him / it to her / it to them" — four people, one pronoun pair. ¿Se lo trajo hoy? → Sí, me lo trajo hoy. Notice — when I am the receiver, I say "me lo"; when you are asking about the receiver in the third person, it becomes "se lo." And nosotros: Nos lo trajo. (He brought it to us.) Nos lo mandó. (He sent it to us.)',
        studentAction: 'Work through the se lo → me lo conversions, and then the nos lo examples.',
        teacherHint: 'Se lo is ambiguous — it can mean "to you," "to him," "to her," "to them." In real conversation context resolves it. Do not attempt to disambiguate all possibilities — just let the pattern land.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — the conversation pivot. ¿Se lo trajo hoy? → Sí, me lo trajo hoy. Then I give a statement: Se lo dije. — I told it to you/him/her. You confirm with the flip: Me lo dijo. — He told it to me. And: Nos lo trajo. — He brought it to us. Nos lo mandó. — He sent it to us. Try the full set.',
        studentAction: 'Convert se lo statements to me lo confirmations. Then use nos lo in context.',
        teacherHint: 'The pivot here is perspective: who says "me lo" vs. "se lo" depends entirely on who is speaking. This is the hardest step — slow down if needed and ask: "Who is receiving? You? Then what pronoun?"',
      },
    ],
  },

  // ─── Formal Commands ─────────────────────────────────────────────────────

  {
    contentKey: 'speak slowly',
    displayName: 'Hable — Formal Commands (usted)',
    unitType: 'command',
    vocabTerms: ['hable', 'mire', 'conteste', 'tome', 'venda', 'aprenda', 'escriba', 'formal command', 'usted command', 'imperative', 'opposite ending', '-AR to -e', '-ER to -a', '-IR to -a', 'hable despacio', 'escríbame', 'aprenda la lección'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Formal commands follow one rule: use the opposite ending. AR verbs normally end in -a in the third person — the command ends in -e instead. ER and IR verbs normally end in -e — the command ends in -a instead. So: hablar (AR) → hable. Vender (ER) → venda. Escribir (IR) → escriba. Say the rule with me: AR gets -e. ER and IR get -a. Opposite of the present tense.',
        studentAction: 'Repeat the rule: AR → -e command. ER/IR → -a command.',
        teacherHint: '"Opposite of the present tense" is the single most useful mnemonic here. If students remember only one thing, it should be that. Reinforce it at every step.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture. AR verbs take -e: hablar → hable. Mirar → mire. Contestar → conteste. Tomar → tome. Read each command and connect it to the meaning: Hable despacio. (Speak slowly.) Mire. (Look.) Conteste el teléfono. (Answer the phone.) Tome esto. (Take this.) Now ER/IR: vender → venda. Aprender → aprenda. Escribir → escriba.',
        studentAction: 'Read each command and its translation. Match verb type to ending.',
        teacherHint: 'The commands are high-frequency classroom language — students already hear "mire" and "conteste" in class. Connect the forms to what they have heard before.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now pair commands with objects: Venda la casa. Aprenda la lección. Escríbame. Notice "escríbame" — the pronoun attaches directly to the end of the command form, and the accent mark shifts. This is the attached-pronoun rule for commands. Try: hable + despacio, conteste + el teléfono, venda + la lancha, aprenda + español.',
        studentAction: 'Attach an object or complement to each command form.',
        teacherHint: 'Attached pronouns on commands are a separate step from bare commands. Do not try to drill all combinations — focus on the attached form as a single example (escríbame) and note the rule.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — I give you a verb and you give me the formal command. Hablar → hable. Mirar → mire. Tomar → tome. Vender → venda. Aprender → aprenda. Escribir → escriba. Then I reverse — I give you a command and you tell me the infinitive it came from. Venda → vender. Aprenda → aprender. The opposite-ending rule works in both directions.',
        studentAction: 'Convert infinitives to command forms and command forms back to infinitives.',
        teacherHint: 'The reverse drill (command → infinitive) is a deeper test of understanding. If students can go both ways, they have internalized the rule — not just memorized examples.',
      },
    ],
  },

  // ─── Telling Time + Time Expressions ────────────────────────────────────

  {
    contentKey: 'what time is it',
    displayName: '¿Qué Hora Es? — Telling Time + Hace Expressions',
    unitType: 'verb',
    vocabTerms: [
      'es la una', 'son las dos', 'son las tres', 'son las doce',
      'y media', 'y cuarto', 'menos cuarto', 'en punto',
      'de la mañana', 'de la tarde', 'de la noche',
      'hace dos años', 'hace tres días', 'hace una semana', 'hace mucho tiempo', 'hace poco tiempo',
      'cuánto tiempo hace que', 'how long', 'what time is it', 'telling time', 'qué hora es',
      'hace que', 'for two years', 'a week ago', 'a long time ago',
    ],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Two rules for telling time. Rule one: one o\'clock is singular — Es la una. All other hours are plural — Son las dos, son las tres. Rule two: y media adds a half, y cuarto adds a quarter, menos cuarto subtracts a quarter. Es la una y media — one thirty. Son las tres menos cuarto — a quarter to three. Say them: Es la una. Son las dos. Son las tres y media. Son las cuatro menos cuarto.',
        studentAction: 'Repeat the four anchor forms: Es la una. Son las dos. Son las tres y media. Son las cuatro menos cuarto.',
        teacherHint: 'The singular/plural split (Es la una vs. Son las...) is the one rule that cannot be skipped. Drill Es la una separately so it feels like its own form, not an exception.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at the clock faces. I ask ¿Qué hora es? — you read the time. Es la una. Son las dos. Son las cinco y cuarto. Then with times of day: de la mañana (AM), de la tarde (afternoon PM), de la noche (evening PM). El tren llega a las ocho de la mañana. El avión sale a las tres de la tarde. El barco llega a las diez de la noche.',
        studentAction: 'Read each clock face and produce the full time phrase. Add de la mañana / tarde / noche when a time of day is given.',
        teacherHint: 'The combinator of hour + y media/cuarto + de la tarde is the most complex combination. If students stall, break it into two pieces: "What is the hour? Good. Now add the time of day."',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the sentence column drill. Column one: Es la una / Son las dos / Son las tres / Son las seis. Column two: y media / y cuarto / menos cuarto / en punto. Fire the combinations — Son las tres y media. Son las seis menos cuarto. Es la una en punto. Go through all combinations quickly.',
        studentAction: 'Scan across both columns and produce a complete time phrase for each combination.',
        teacherHint: 'En punto (exactly, on the dot) is the simplest complement — just a time plus en punto. Start with it if students need a confidence moment before the fractions.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — hace expressions. Two patterns. Pattern one: hace + time + que + present tense = for how long. ¿Cuánto tiempo hace que estudia español? → Hace dos años que estudio español. I have been studying for two years. Pattern two: hace + time + preterite = how long ago. ¿Cuándo llegó? → Llegué hace una semana. I arrived a week ago. Try both patterns.',
        studentAction: 'Answer ¿Cuánto tiempo hace que...? with hace + time + que + present. Answer ¿Cuándo...? with hace + time + preterite.',
        teacherHint: 'The two hace patterns are opposites in time direction: hace...que looks forward from the past (still ongoing); hace + preterite is a point that ended. If students mix them, ask: "Is it still happening now, or did it finish?" That question sorts the pattern.',
      },
    ],
  },

  // ─── Present Progressive ─────────────────────────────────────────────────

  {
    contentKey: 'what are you doing right now',
    displayName: '¿Qué está haciendo? — Progressive (estoy tocando)',
    unitType: 'progressive',
    vocabTerms: [
      'estoy tocando', 'está tocando', 'estamos tocando',
      'tocando', 'hablando', 'estudiando', 'nadando', 'patinando',
      'escribiendo', 'vendiendo', 'aprendiendo',
      'progressive', 'present progressive', 'estar', '-ando', '-iendo',
      'what are you doing', 'happening right now',
    ],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Two pieces that snap together. The first you already know: "estoy" — I am. "Está" — he or she is. The second piece is what is happening right now. For AR verbs, it ends in -ando: tocar becomes tocando, hablar becomes hablando. For ER and IR verbs, it ends in -iendo: escribir becomes escribiendo, vender becomes vendiendo. Put them together: estoy tocando — I am playing. Está hablando — she is talking. Say them with me: estoy tocando, está hablando.',
        studentAction: 'Repeat the two anchor forms: estoy tocando, está hablando.',
        teacherHint: 'The -ando / -iendo split is the only new grammar. If student asks about -iendo irregulars (leer → leyendo), note it briefly and move on — do not derail the anchor step.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Look at each picture. The pattern is always the same: estoy + what is happening right now. Estoy tocando el piano — I am playing the piano. Estoy hablando por teléfono — I am talking on the phone. Read each sentence you see.',
        studentAction: 'Read each model sentence aloud. Match the sound to the image.',
        teacherHint: 'Correct the -ando / -iendo ending if dropped or confused. The ending carries all the meaning — losing it loses the tense entirely.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Now the columns. Column one is your action: estoy escribiendo, estoy tocando, estoy hablando, estoy estudiando. Column two is what. Scan across and fire the combination — estoy escribiendo una carta, estoy tocando el piano. Go quickly. Let your eye do the work.',
        studentAction: 'Scan the sentence columns and produce combinations aloud. Both columns must connect.',
        teacherHint: 'Speed is the goal here — not perfection. The rapid combination is what burns the pattern in. If student slows to think, encourage them to keep moving and self-correct on the next pass.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Last step — the question and answer. I will ask what is happening, and you answer in a full sentence. ¿Está tocando el piano? — Is she playing the piano? Answer: Sí, estoy tocando el piano. Now I say no: ¿Está escribiendo? — No, no estoy escribiendo. Your turn. I will ask — you answer yes, then answer no.',
        studentAction: 'Produce full-sentence answers in both affirmative and negative. Pattern: Sí, estoy [verb]-ando/iendo ___ / No, no estoy [verb]-ando/iendo ___.',
        teacherHint: 'Watch for double no — "no estoy" not "no estoy no." Also confirm the -ando/-iendo ending stays attached even in the negative. The negative does not shorten the verb form.',
      },
    ],
  },
];

// ─── French Units ─────────────────────────────────────────────────────────────
// Proof of concept: French 1 present-tense verb units.
// Same 4-step Madrigal sequence; verbal scripts in English instructional voice
// with French vocabulary. Covers the same conceptual contentKeys as Spanish 1.

const FRENCH_UNITS: MadrigalLoopUnit[] = [

  // ─── Vouloir (je veux / elle veut) ────────────────────────────────────────
  {
    contentKey: 'i want',
    language: 'french',
    displayName: 'Vouloir — Je veux / Elle veut',
    unitType: 'verb',
    vocabTerms: ['je veux', 'elle veut', 'vouloir', 'want', 'I want', 'she wants', 'voulez-vous', 'veux-tu', 'on veut', 'ils veulent'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Je veux" — I want. "Elle veut" — she wants. The verb is vouloir. The stem changes: voul → veu. Say them: je veux, elle veut.',
        studentAction: 'Repeat je veux and elle veut.',
        teacherHint: 'Stem change voul → veu mirrors Spanish querer → quiero/quiere. Point out the parallel if students know Spanish. Boot verb: veulent (they want) also has the stem change.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone wants. Read the sentence: Je veux acheter... / Elle veut acheter...',
        studentAction: 'Read je veux / elle veut sentences with images.',
        teacherHint: 'vouloir + infinitive is the key construction. Make sure students produce the infinitive after je veux — not a conjugated form.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across the columns — who wants what? Build your sentence.',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Check that je veux and elle veut forms hold correctly. The combinator drills vouloir + infinitive automaticity.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Qu'est-ce que vous voulez faire aujourd'hui? What do you want to do today? Answer with je veux.",
        studentAction: 'Produce: Je veux + infinitive.',
        teacherHint: "Je veux + infinitive is extremely high-frequency in French. Personalize: je veux manger, je veux aller, je veux acheter. Accept any accurate infinitive.",
      },
    ],
  },

  // ─── Avoir (j'ai / elle a) ─────────────────────────────────────────────────
  {
    contentKey: 'i have',
    language: 'french',
    displayName: "Avoir — J'ai / Elle a",
    unitType: 'verb',
    vocabTerms: ["j'ai", 'elle a', 'avoir', 'have', 'I have', 'she has', 'avez-vous', 'il a', 'nous avons', 'ils ont'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"J\'ai" — I have. "Elle a" — she has. The verb is avoir. Say them: j\'ai, elle a.',
        studentAction: "Repeat j'ai and elle a.",
        teacherHint: "Avoir is both a content verb (to have) and the auxiliary for passé composé. Getting these two forms automatic now pays off enormously later.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows something someone has. Read the sentence: J'ai un/une... / Elle a un/une...",
        studentAction: "Read j'ai / elle a sentences with images.",
        teacherHint: "Gender agreement with un/une is important here. Flag mismatches. J'ai un chat vs j'ai une chatte.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who has what? Eyes across the columns.',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: "Watch for liaison: j'ai un ami — the liaison /n/ sound. Note it but don't drill it yet.",
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Qu'est-ce que vous avez dans votre sac? What do you have in your bag? Answer with j'ai.",
        studentAction: "Produce: J'ai un/une + noun.",
        teacherHint: 'Personalize freely. Any accurate avoir sentence works.',
      },
    ],
  },

  // ─── Aller — places (je vais / elle va) ───────────────────────────────────
  {
    contentKey: 'where are you going',
    language: 'french',
    displayName: 'Aller — Je vais / Elle va',
    unitType: 'verb',
    vocabTerms: ['je vais', 'elle va', 'aller', 'going', 'I am going', 'she is going', 'où allez-vous', 'on va', 'nous allons', 'au', 'à la', 'en France'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Je vais" — I am going. "Elle va" — she is going. The verb is aller. It is completely irregular — nothing looks like "all-". Say them: je vais, elle va.',
        studentAction: 'Repeat je vais and elle va.',
        teacherHint: "The irregularity mirrors Spanish ir (voy/va). Stress that this verb doubles as the future: je vais + infinitive = I'm going to... Learning it now pays off twice.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a destination. Read: Je vais au... / à la... / en... Masc places: au. Fem places: à la. Countries: en.',
        studentAction: 'Read je vais / elle va sentences with destination images.',
        teacherHint: 'The au/à la/en distinction is critical. Masc: au restaurant, au cinéma. Fem: à la plage, à la banque. Countries/fem: en France, en Espagne.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across the columns — who is going where?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Check au vs à la vs en on each substitution. Mistakes solidify here if not caught.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Où allez-vous ce soir? Where are you going tonight? Answer with je vais. Then extend: what are you going to do there?',
        studentAction: 'Produce: Je vais au/à la/en + destination, then je vais + infinitive.',
        teacherHint: "Je vais + infinitive unlocks the futur proche. Je vais manger au restaurant — I'm going to eat at the restaurant. This is French 1's most productive construction.",
      },
    ],
  },

  // ─── Être (je suis / elle est) ────────────────────────────────────────────
  {
    contentKey: 'to be',
    language: 'french',
    displayName: 'Être — Je suis / Elle est',
    unitType: 'ser_estar',
    vocabTerms: ['je suis', 'elle est', 'être', 'to be', 'I am', 'she is', 'êtes-vous', 'nous sommes', 'ils sont', 'nationality', 'profession'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Je suis" — I am. "Elle est" — she is. The verb is être. French uses être for both identity AND states — one verb where Spanish has two. Say them: je suis, elle est.',
        studentAction: 'Repeat je suis and elle est.',
        teacherHint: "Unlike Spanish, French has no ser/estar split. Être covers nationality, profession, personality, and states. This simplifies things — worth pointing out explicitly.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows what someone is or their state. Read: Je suis... / Elle est... Watch the adjective gender ending.',
        studentAction: 'Read être sentences with images.',
        teacherHint: 'Adjective agreement: fatigué/fatiguée, content/contente, français/française. The feminine adds -e and sometimes changes pronunciation. Flag both gender and spelling.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who is what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Watch gender agreement of adjectives throughout.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Qui êtes-vous? Tell me two things about yourself using être — nationality or profession, and one personality trait.',
        studentAction: 'Produce two je suis sentences.',
        teacherHint: 'Nationality, profession, personality — all être. Accept any accurate response.',
      },
    ],
  },

  // ─── Aimer (j'aime / elle aime) ───────────────────────────────────────────
  {
    contentKey: 'i like',
    language: 'french',
    displayName: "Aimer — J'aime / Elle aime",
    unitType: 'hay_gustar',
    vocabTerms: ["j'aime", 'elle aime', 'aimer', 'like', 'love', 'I like', 'she likes', 'aimez-vous', 'tu aimes', "j'adore"],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"J\'ai me" — I like. "Elle aime" — she likes. The verb is aimer. Unlike Spanish gustar, aimer conjugates normally — subject first, no reversal. Say them: j\'aime, elle aime.',
        studentAction: "Repeat j'aime and elle aime.",
        teacherHint: "Key difference from Spanish me gusta: aimer is a normal verb with normal subject placement. No indirect object reversal. This is simpler for English speakers — make it explicit.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows something someone likes. Read: J'aime le/la/les + noun. Note: general likes take the definite article.",
        studentAction: "Read j'aime / elle aime sentences with images.",
        teacherHint: "General likes use the definite article: J'aime le chocolat (I like chocolate in general). Not du chocolat — that's partitive (some chocolate). High-frequency error point.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who likes what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Watch that le/la/les appears before the noun for general likes.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Qu'est-ce que vous aimez faire? What do you like to do? Answer with j'aime + infinitive.",
        studentAction: "Produce: J'aime + infinitive.",
        teacherHint: "J'aime + infinitive = I like to do something. Distinguish from J'aime le chocolat (noun: general like) vs J'aime manger (infinitive: activity).",
      },
    ],
  },

  // ─── Il y a (there is / there are) ────────────────────────────────────────
  {
    contentKey: 'there is',
    language: 'french',
    displayName: 'Il y a — There Is / There Are',
    unitType: 'hay_gustar',
    vocabTerms: ['il y a', 'there is', 'there are', "il n'y a pas", "est-ce qu'il y a", 'combien', 'des', 'un', 'une'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Il y a" — there is / there are. One phrase covers both singular and plural — just like Spanish hay. Say it: il y a.',
        studentAction: 'Repeat il y a.',
        teacherHint: 'Stress the simplicity: one phrase for singular and plural. Il y a un chat. Il y a des chats. Same construction. The y is a locative pronoun but students do not need that analysis yet.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows what is there. Read: Il y a un / une / des...',
        studentAction: 'Read il y a sentences with images.',
        teacherHint: 'Un (masc singular), une (fem singular), des (plural any gender). These are indefinite articles — not le/la. Point out the difference from general likes (where aimer takes le/la).',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — what is there?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: "The negative drops the article: il n'y a pas DE + noun. Don't drill negative yet — save for QA pivot.",
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Est-ce qu'il y a un restaurant près d'ici? Is there a restaurant nearby? Answer yes: Oui, il y a... Then answer no: Non, il n'y a pas de...",
        studentAction: "Produce affirmative il y a and negative il n'y a pas de.",
        teacherHint: "Key: negative is il n'y a pas DE + noun — the article drops to de. High-frequency error point. This is the same pas de pattern as ne... pas de throughout French.",
      },
    ],
  },

  // ─── Où suis-je? — Être: Locations ───────────────────────────────────────
  {
    contentKey: 'where am i',
    language: 'french',
    displayName: 'Être — Locations: Où suis-je?',
    unitType: 'ser_estar',
    vocabTerms: ['où suis-je', 'je suis', 'il est', 'elle est', 'être', 'location', 'dans', 'sur', 'à', 'près de', 'devant', 'derrière'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Où suis-je?" — Where am I? "Je suis dans..." — I am in... In French, être handles location just like identity. Say it: je suis, il est, elle est.',
        studentAction: 'Repeat je suis, il est, elle est.',
        teacherHint: 'French uses être for location. No separate verb like Spanish estar — être does double duty (identity AND location). The preposition does the heavy lifting: dans (in), sur (on), à (at/in), près de (near).',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a location. Read: Je suis dans... / Il est à... / Elle est sur...',
        studentAction: 'Read location sentences with images.',
        teacherHint: 'Watch the preposition + article contraction: à + le = au (je suis au café), à + la stays as à la (je suis à la banque), à + les = aux.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Scan the columns — who is where?',
        studentAction: 'Combine subjects with locations rapidly.',
        teacherHint: 'Column 1: subjects (je suis, il est, elle est, nous sommes). Column 2: prepositions + places. Speed over perfection here.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Où êtes-vous? Where are you? Answer with a real or imagined location: Je suis... Then ask: Et lui — où est-il?',
        studentAction: 'Produce: Je suis + [location]. Then: Il est + [location].',
        teacherHint: 'Real locations make this stick. If the student is in a classroom: Je suis dans la salle de classe. At home: Je suis à la maison.',
      },
    ],
  },

  // ─── J'ai pris — Prendre (passé composé) ──────────────────────────────────
  {
    contentKey: 'i took',
    language: 'french',
    displayName: "Prendre — J'ai pris / Il a pris",
    unitType: 'preterite',
    vocabTerms: ["j'ai pris", 'il a pris', 'prendre', 'pris', 'passé composé', 'took', 'had', 'took the bus', 'pris le bus', 'pris un café'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"J\'ai pris" — I took. The verb is prendre — irregular. The past participle is pris. Avoir + pris. Say it: j\'ai pris, il a pris.',
        studentAction: "Repeat j'ai pris and il a pris.",
        teacherHint: "Prendre is the French workhorse for 'take' — take a bus, take a coffee, take a shower (prendre une douche). Participé passé = pris. Stress the irregular form — this is one students use every day.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows something taken. Read: J'ai pris... / Il a pris...",
        studentAction: "Read j'ai pris / il a pris sentences with images.",
        teacherHint: "J'ai pris le métro. Il a pris un café. J'ai pris une photo. These are all high-frequency uses of prendre — let them explore all meanings.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Scan across — who took what?',
        studentAction: 'Combine subject + a pris + object rapidly.',
        teacherHint: 'Column 1: subjects (je, il, elle, nous). Column 2: a/avons + pris. Column 3: objects (le bus, un café, une photo, le train).',
      },
      {
        stepIndex: 3,
        stepName: 'negative_pivot',
        verbalInstruction: "J'ai pris le bus means I took the bus. How do you say I did NOT take the bus? Try it.",
        studentAction: "Produce: Je n'ai pas pris le bus.",
        teacherHint: "Ne...pas wraps avoir: je n'ai PAS pris. The past participle stays after pas. Common error: putting pas after pris. Watch for it.",
      },
    ],
  },

  // ─── J'ai acheté — Acheter (passé composé) ────────────────────────────────
  {
    contentKey: 'i bought',
    language: 'french',
    displayName: "Acheter — J'ai acheté / Il a acheté",
    unitType: 'preterite',
    vocabTerms: ["j'ai acheté", 'il a acheté', 'acheter', 'acheté', 'bought', 'shopping', 'magasin', 'marché', 'cadeau'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"J\'ai acheté" — I bought. Acheter is regular -ER in the passé composé. Avoir + acheté. Say it: j\'ai acheté, il a acheté.',
        studentAction: "Repeat j'ai acheté and il a acheté.",
        teacherHint: "Acheté is a regular -ER past participle — drop -er, add -é. This is the most common pattern and transfers to hundreds of verbs. Use this as the model for the whole -ER pattern.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows something bought. Read: J'ai acheté... / Il a acheté...",
        studentAction: "Read j'ai acheté / il a acheté sentences with images.",
        teacherHint: "J'ai acheté un cadeau. Il a acheté des vêtements. J'ai acheté de la nourriture. Shopping vocabulary pairs naturally with this verb.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Columns — who bought what?',
        studentAction: 'Combine subject + a acheté + object.',
        teacherHint: 'Rapid eye movement across columns. Accuracy improves with speed here.',
      },
      {
        stepIndex: 3,
        stepName: 'negative_pivot',
        verbalInstruction: "J'ai acheté une chemise — I bought a shirt. How do you say I did NOT buy a shirt?",
        studentAction: "Produce: Je n'ai pas acheté de chemise.",
        teacherHint: "Two things change in the negative: (1) ne...pas wraps avoir; (2) the article shifts from un/une/des to DE: je n'ai pas acheté DE chemise. This article-to-de switch is critical and often missed.",
      },
    ],
  },

  // ─── Je voudrais — Conditional ─────────────────────────────────────────────
  {
    contentKey: 'i would like',
    language: 'french',
    displayName: 'Vouloir — Je voudrais (conditional)',
    unitType: 'verb',
    vocabTerms: ['je voudrais', 'il voudrait', 'conditional', 'would like', 'polite request', 'voudrais-tu', 'je voudrais + infinitif'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Je voudrais" — I would like. This is the conditional form of vouloir. More polite than je veux. Say it: je voudrais, il voudrait.',
        studentAction: 'Repeat je voudrais and il voudrait.',
        teacherHint: 'Je voudrais = I would like (polite). Je veux = I want (direct). The conditional adds a layer of politeness that French culture values highly. This is the form students must use in restaurants, shops, and formal settings.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows something someone would like. Read: Je voudrais... / Il voudrait...",
        studentAction: 'Read je voudrais / il voudrait sentences with images.',
        teacherHint: 'Je voudrais un café, s\'il vous plaît. Il voudrait visiter Paris. Both noun and infinitive constructions are important.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Scan the columns — who would like what?',
        studentAction: 'Combine subjects with conditional forms and objects.',
        teacherHint: 'Column 1: je voudrais, il voudrait, elle voudrait, nous voudrions. Column 2: objects/infinitives.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Qu'est-ce que vous voudriez faire? What would you like to do? Answer with je voudrais + infinitive.",
        studentAction: 'Produce: Je voudrais + infinitive.',
        teacherHint: "Dream-scenario prompt: Qu'est-ce que vous voudriez faire si vous pouviez? Keeps it real and engaging. Accept any meaningful answer.",
      },
    ],
  },

  // ─── Je suis allé(e) — Aller passé composé ────────────────────────────────
  {
    contentKey: 'i went',
    language: 'french',
    displayName: 'Aller — Je suis allé(e) (passé composé)',
    unitType: 'preterite',
    vocabTerms: ['je suis allé', 'je suis allée', 'il est allé', 'elle est allée', 'aller', 'allé', 'went', 'être auxiliary', 'accord'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Je suis allé(e)" — I went. Aller uses ÊTRE as the auxiliary, not avoir. And the past participle agrees with the subject: allé (masc), allée (fem). Say it: je suis allé, je suis allée.',
        studentAction: 'Repeat je suis allé and je suis allée.',
        teacherHint: "This is a landmark lesson: être auxiliary verbs. Dr. & Mrs. Vandertramp or the house verbs — aller is the first one students meet in the Madrigal chain. The agreement (allé vs allée) is purely written, not spoken — but important for literacy.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows somewhere someone went. Read: Je suis allé(e) au/à la...',
        studentAction: 'Read je suis allé / elle est allée sentences with images.',
        teacherHint: "Je suis allé au marché. Elle est allée à l'école. Vary the gender of subjects so students practice both allé and allée.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Columns — who went where?',
        studentAction: 'Combine subject + suis/est allé(e) + destination.',
        teacherHint: 'Column 1: je suis allé(e), il est allé, elle est allée, nous sommes allé(e)s. Column 2: destinations. Point out suis vs est vs sommes.',
      },
      {
        stepIndex: 3,
        stepName: 'negative_pivot',
        verbalInstruction: "Je suis allé au café — I went to the café. How do you say I did NOT go to the café?",
        studentAction: "Produce: Je ne suis pas allé au café.",
        teacherHint: "ne...pas wraps être: je ne SUIS PAS allé. The agreement stays: je ne suis pas allée (fem). Classic error: moving pas to after allé.",
      },
    ],
  },

  // ─── Il va — Aller 3rd person near future ─────────────────────────────────
  {
    contentKey: 'he is going to',
    language: 'french',
    displayName: 'Aller — Il va / Elle va + infinitif',
    unitType: 'verb',
    vocabTerms: ['il va', 'elle va', 'aller', 'near future', 'futur proche', 'il va + infinitif', 'elle va + infinitif', 'he is going to', 'she is going to'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Il va" — he is going / he is going to. Third person singular of aller. Add an infinitive and you have the near future: il va manger = he is going to eat. Say it: il va, elle va.',
        studentAction: 'Repeat il va and elle va.',
        teacherHint: "Il va is the third-person mirror of je vais — same near-future construction, different subject. This step moves students from first-person narration (I...) to third-person narration (he/she...), which is critical for storytelling.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows what someone is going to do. Read: Il va... / Elle va...',
        studentAction: 'Read il va / elle va + infinitive sentences with images.',
        teacherHint: "Il va travailler. Elle va étudier. Il va acheter un livre. Model the infinitive staying in base form after va.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across — what is he or she going to do?',
        studentAction: 'Combine il va / elle va + infinitive rapidly.',
        teacherHint: 'Mix il va and elle va across rows. Column 2: infinitives. Students build narrative fluency by switching subjects.',
      },
      {
        stepIndex: 3,
        stepName: 'negative_pivot',
        verbalInstruction: 'Il va travailler — he is going to work. How do you say he is NOT going to work?',
        studentAction: "Produce: Il ne va pas travailler.",
        teacherHint: "ne...pas wraps the conjugated verb va: il ne VA PAS travailler. The infinitive sits after pas, untouched. Same pattern as je ne veux pas manger.",
      },
    ],
  },

  // ─── Qu'est-ce qu'il a fait? ───────────────────────────────────────────────
  {
    contentKey: 'what did he do',
    language: 'french',
    displayName: "Qu'est-ce qu'il a fait? — What Did He Do?",
    unitType: 'preterite',
    vocabTerms: ["qu'est-ce qu'il a fait", 'il a fait', 'faire', 'fait', 'passé composé', 'what did he do', 'narrating past', 'il a mangé', 'il a regardé'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Qu\'est-ce qu\'il a fait?" — What did he do? "Il a fait" — He did / He made. Faire is irregular: past participle = fait. Say it: il a fait, qu\'est-ce qu\'il a fait?',
        studentAction: "Repeat il a fait and qu'est-ce qu'il a fait?",
        teacherHint: "Faire (to do/make) is the highest-frequency French verb after être and avoir. Past participle fait is irregular — must memorize. The question qu'est-ce qu'il a fait? is the gateway to past-tense narration.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows what he did. Read: Il a fait... / Il a mangé... / Il a regardé...",
        studentAction: 'Read past-tense narration sentences with images.',
        teacherHint: "Mix faire (il a fait) with other verbs in passé composé — il a mangé, il a regardé un film, il a pris le bus. This is narration practice.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: "Qu'est-ce qu'il a fait? Scan the columns and narrate his day.",
        studentAction: 'Combine il/elle + a + past participle rapidly.',
        teacherHint: 'Column 1: il a, elle a, ils ont. Column 2: past participles (mangé, regardé, fait, pris, acheté). Students narrate a story.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Qu'est-ce qu'il a fait hier? What did he do yesterday? Describe his day in 2–3 sentences.",
        studentAction: 'Produce a 2–3 sentence past-tense narration.',
        teacherHint: "Il s'est levé, il a mangé, il est allé... This is the first real storytelling moment. Encourage creative details. Celebrate any correct passé composé production.",
      },
    ],
  },

  // ─── Il a eu — Avoir passé composé ────────────────────────────────────────
  {
    contentKey: 'he had',
    language: 'french',
    displayName: 'Avoir — Il a eu (passé composé)',
    unitType: 'preterite',
    vocabTerms: ['il a eu', "j'ai eu", 'avoir', 'eu', 'had', 'passé composé', 'il a eu de la chance', 'il a eu un accident'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Il a eu" — He had. Avoir in the past uses itself as the auxiliary: avoir + eu. Irregular past participle: eu. Say it: j\'ai eu, il a eu.',
        studentAction: "Repeat j'ai eu and il a eu.",
        teacherHint: "Avoir uses avoir as its own auxiliary (reflexive auxiliary). Past participle eu is highly irregular. High-frequency: il a eu de la chance (he was lucky), j'ai eu un accident (I had an accident), il a eu faim (he was hungry).",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone had or experienced. Read: Il a eu... / J\'ai eu...',
        studentAction: 'Read il a eu / j\'ai eu sentences with images.',
        teacherHint: "Il a eu de la chance. J'ai eu un problème. Il a eu faim. These avoir expressions in the past come up constantly in conversation.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Scan columns — who had what?',
        studentAction: "Combine subject + a/ai eu + object/expression.",
        teacherHint: "Column 1: j'ai eu, il a eu, elle a eu. Column 2: de la chance, un accident, faim, soif, un problème. Column 3 optional: context (hier, ce matin).",
      },
      {
        stepIndex: 3,
        stepName: 'negative_pivot',
        verbalInstruction: "Il a eu de la chance — he was lucky. How do you say he was NOT lucky?",
        studentAction: "Produce: Il n'a pas eu de chance.",
        teacherHint: "ne...pas wraps avoir: il n'a PAS eu. Article shift: de la chance → pas DE chance. Two changes — the ne...pas AND the article-to-de shift.",
      },
    ],
  },

  // ─── Lui — Indirect object pronoun ────────────────────────────────────────
  {
    contentKey: 'to him to her',
    language: 'french',
    displayName: 'Lui — To Him / To Her (indirect object)',
    unitType: 'object_pronoun',
    vocabTerms: ['lui', 'to him', 'to her', 'indirect object', 'je lui donne', 'je lui parle', 'pronoms indirects', 'leur'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Lui" means "to him" and "to her" — one pronoun for both. It replaces "à + person." Je parle à Marie → Je lui parle. Say it: lui.',
        studentAction: 'Repeat lui and je lui parle.',
        teacherHint: "Lui = to him AND to her (indirect object). This is different from lui as a stressed pronoun (C'est lui = It's him). Context distinguishes them. Lui is placed BEFORE the verb, not after.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows someone doing something TO or FOR another person. Read: Je lui...',
        studentAction: 'Read je lui + verb sentences with images.',
        teacherHint: 'Je lui parle. Je lui donne un livre. Je lui écris. Verbs that take indirect objects: parler à, donner à, écrire à, téléphoner à.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Columns — who does what for/to him or her?',
        studentAction: 'Combine subject + lui + verb + optional object.',
        teacherHint: "Column 1: je lui, il lui, elle lui. Column 2: parle, donne, écrit, téléphone. Column 3: optional objects (un cadeau, une lettre).",
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Est-ce que vous lui parlez souvent? Do you speak to him/her often? Answer: Oui, je lui parle... / Non, je ne lui parle pas...',
        studentAction: 'Produce affirmative and negative with lui.',
        teacherHint: "Negative: je ne LUI parle pas — lui stays between ne and the verb, same position as in affirmative. Their stays: je ne leur parle pas.",
      },
    ],
  },

  // ─── C'est propre / C'est sale — Descriptions ─────────────────────────────
  {
    contentKey: 'it is clean',
    language: 'french',
    displayName: "C'est propre — Descriptions with C'est",
    unitType: 'ser_estar',
    vocabTerms: ["c'est propre", "c'est sale", "c'est + adjectif", 'descriptions', 'propre', 'sale', 'grand', 'petit', 'beau', 'laid', 'bon', 'mauvais'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"C\'est" — it is. "C\'est propre" — it is clean. "C\'est sale" — it is dirty. This is the French formula for describing things. Say it: c\'est propre, c\'est sale.',
        studentAction: "Repeat c'est propre and c'est sale.",
        teacherHint: "C'est + adjective = impersonal description of a thing or situation. Note the adjective doesn't agree here (c'est is neuter-ish: c'est propre, not c'est propres). Agreement rules apply when using il est / elle est instead.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows something with a quality. Read: C'est propre. / C'est grand. / C'est beau.",
        studentAction: "Read c'est + adjective sentences with images.",
        teacherHint: "C'est propre / sale / grand / petit / beau / laid / bon / mauvais / cher / pas cher. High-frequency adjectives students need immediately.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: "Scan the columns — C'est + what?",
        studentAction: "Combine c'est / ce n'est pas + adjective.",
        teacherHint: "Column 1: c'est, ce n'est pas. Column 2: propre, sale, grand, petit, beau, laid, bon, mauvais, cher, facile, difficile.",
      },
      {
        stepIndex: 3,
        stepName: 'negative_pivot',
        verbalInstruction: "C'est propre — it is clean. How do you say it is NOT clean?",
        studentAction: "Produce: Ce n'est pas propre.",
        teacherHint: "Ce n'est pas = it is not. The negative of c'est. Contrast: C'est propre / Ce n'est pas propre. C'est bon / Ce n'est pas bon. Simple pattern, enormous usefulness.",
      },
    ],
  },

  // ─── J'ai étudié — Regular -ER passé composé ──────────────────────────────
  {
    contentKey: 'i studied',
    language: 'french',
    displayName: "Étudier — J'ai étudié (regular -ER passé composé)",
    unitType: 'preterite',
    vocabTerms: ["j'ai étudié", 'il a étudié', 'étudier', 'étudié', 'studied', '-ER verbs passé composé', 'avoir + -é', 'j\'ai parlé', 'j\'ai mangé'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"J\'ai étudié" — I studied. This is the model for ALL regular -ER verbs in the passé composé: take the infinitive, drop -er, add -é. Say it: j\'ai étudié, il a étudié.',
        studentAction: "Repeat j'ai étudié and il a étudié.",
        teacherHint: "This is the high-leverage lesson: once students see the -ER pattern (étudier → étudié), they unlock hundreds of verbs. Parler → parlé. Manger → mangé. Regarder → regardé. Make this transfer explicit.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows what someone studied or did. Read: J'ai étudié... / Il a étudié... / J'ai parlé...",
        studentAction: "Read j'ai + -é sentences with images.",
        teacherHint: "Mix -ER verbs: j'ai étudié le français, j'ai parlé avec mon ami, j'ai mangé une pizza, j'ai regardé un film. Show the pattern across multiple verbs.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Scan columns — who did what? All -ER verbs.',
        studentAction: 'Combine subject + ai/a + -é verb rapidly.',
        teacherHint: "Column 1: j'ai, il a, elle a, nous avons. Column 2: étudié, parlé, mangé, regardé, travaillé, acheté. Speed drill to make the pattern automatic.",
      },
      {
        stepIndex: 3,
        stepName: 'negative_pivot',
        verbalInstruction: "J'ai étudié hier — I studied yesterday. Say you did NOT study yesterday.",
        studentAction: "Produce: Je n'ai pas étudié hier.",
        teacherHint: "ne...pas wraps avoir: je n'ai PAS étudié. This is the core negative passé composé pattern. Once this clicks, students handle all -ER negatives automatically.",
      },
    ],
  },

  // ─── J'ai reçu — Irregular passé composé ──────────────────────────────────
  {
    contentKey: 'i received',
    language: 'french',
    displayName: "Recevoir — J'ai reçu (irregular passé composé)",
    unitType: 'preterite',
    vocabTerms: ["j'ai reçu", 'il a reçu', 'recevoir', 'reçu', 'received', 'irregular past participle', "j'ai vu", "j'ai lu", "j'ai bu", "j'ai su"],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"J\'ai reçu" — I received. Recevoir is irregular — past participle is reçu. These irregular past participles must be memorized. Say it: j\'ai reçu, il a reçu.',
        studentAction: "Repeat j'ai reçu and il a reçu.",
        teacherHint: "Recevoir → reçu. Group with other irregular -u participles: boire → bu, lire → lu, voir → vu, savoir → su, vouloir → voulu. The -u ending is a family. Point this out — it's a pattern within the irregulars.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows something received or done. Read: J'ai reçu... / J'ai vu... / J'ai lu...",
        studentAction: "Read j'ai + irregular past participle sentences with images.",
        teacherHint: "J'ai reçu une lettre. J'ai vu un film. J'ai lu un livre. J'ai bu du café. Mix the -u family so students see the pattern across verbs.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Scan columns — irregular past participles.',
        studentAction: 'Combine subject + ai/a + irregular participle + object.',
        teacherHint: "Column 1: j'ai, il a, elle a. Column 2: reçu, vu, lu, bu, su. Column 3: une lettre, un film, un livre, du café, la réponse.",
      },
      {
        stepIndex: 3,
        stepName: 'negative_pivot',
        verbalInstruction: "J'ai reçu une réponse — I received an answer. Say you did NOT receive an answer.",
        studentAction: "Produce: Je n'ai pas reçu de réponse.",
        teacherHint: "ne...pas wraps avoir: je n'ai PAS reçu. Article shift in negative: une réponse → pas DE réponse. Reinforce this -de pattern one more time — it covers all negated indefinite objects.",
      },
    ],
  },

  // ─── Pouvoir (je peux / elle peut) ────────────────────────────────────────
  {
    contentKey: 'i can go',
    language: 'french',
    displayName: 'Pouvoir — Je peux / Elle peut',
    unitType: 'verb',
    vocabTerms: ['je peux', 'elle peut', 'pouvoir', 'can', 'I can', 'she can', 'pouvez-vous', 'tu peux', 'on peut', 'puis-je'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Je peux" — I can. "Elle peut" — she can. The verb is pouvoir. Stem change: pouv → peu. Say them: je peux, elle peut.',
        studentAction: 'Repeat je peux and elle peut.',
        teacherHint: "Pouvoir mirrors Spanish poder (puedo/puede). Formal inversion is puis-je (may I) rather than est-ce que je peux — note it for later, don't drill now.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone can do. Read: Je peux... / Elle peut... + infinitive.',
        studentAction: 'Read je peux / elle peut sentences with images.',
        teacherHint: 'Pouvoir + infinitive is the construction. Je peux nager. Elle peut chanter. The infinitive follows directly — same as vouloir + infinitive.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across the columns — who can do what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Check je peux vs elle peut form accuracy.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Qu'est-ce que vous pouvez faire bien? What can you do well? Answer with je peux. Then say one thing you cannot do: je ne peux pas + infinitive.",
        studentAction: "Produce: Je peux + infinitive, then Je ne peux pas + infinitive.",
        teacherHint: "Je ne peux pas + infinitive — the ne...pas wraps the conjugated verb, not the infinitive. Je ne peux pas voler, not je peux ne pas voler.",
      },
    ],
  },

];

const ITALIAN_UNITS: MadrigalLoopUnit[] = [

  // ─── Andare — Dove vai? / Dove va? ────────────────────────────────────────
  {
    contentKey: 'where are you going',
    language: 'italian',
    displayName: 'Andare — Vado / Va',
    unitType: 'verb',
    vocabTerms: ['vado', 'va', 'andare', 'going', 'I am going', 'she is going', 'dove vai', 'andiamo', 'vanno', 'al', 'alla', 'in Italia'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Vado" — I am going. "Va" — she / he is going. The verb is andare. It is irregular — nothing looks like "and-". Say them: vado, va.',
        studentAction: 'Repeat vado and va.',
        teacherHint: 'The irregularity mirrors Spanish ir (voy/va) and French aller (vais/va). Stress the near-future use: vado a + infinitive. Two verbs, two payoffs.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a destination. Read: Vado al... / alla... / in... Masc places: al. Fem places: alla. Countries: in.',
        studentAction: 'Read vado / va sentences with destination images.',
        teacherHint: 'Al/alla/in distinction is critical. Masc: al cinema, al ristorante. Fem: alla banca, alla scuola. Countries: in Italia, in Francia.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across the columns — who is going where?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Check al vs alla vs in on each substitution. Mistakes solidify here if uncorrected.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Dove vai stasera? Where are you going tonight? Answer with vado. Then extend: what are you going to do there?',
        studentAction: 'Produce: Vado al/alla/in + destination, then vado a + infinitive.',
        teacherHint: 'Vado a + infinitive unlocks the futuro prossimo. Vado a mangiare — I am going to eat. Most productive construction of Italian 1.',
      },
    ],
  },

  // ─── Prendere al passato (ho preso / ha preso) ────────────────────────────
  {
    contentKey: 'i took',
    language: 'italian',
    displayName: 'Passato Prossimo — Ho preso / Ha preso',
    unitType: 'verb',
    vocabTerms: ['ho preso', 'ha preso', 'prendere', 'took', 'I took', 'she took', 'hai preso', 'abbiamo preso', 'passato prossimo', 'ho + participio'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ho preso" — I took. "Ha preso" — she/he took. This is the passato prossimo. Ho + participio. Say them: ho preso, ha preso.',
        studentAction: 'Repeat ho preso and ha preso.',
        teacherHint: 'Prendere → preso is irregular. The passato prossimo = ho/ha + past participle. This mirrors French j\'ai pris. The auxiliary ho/ha comes from avere.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone took or grabbed. Read: Ho preso... / Ha preso...',
        studentAction: 'Read ho preso / ha preso sentences with images.',
        teacherHint: 'Prendere covers took, grabbed, had (food/drink). Ho preso un caffè = I had a coffee. High-frequency in Italian daily life.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who took what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Keep ho vs ha sharp. Students often confuse auxiliary with subject.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cosa hai preso stamattina? What did you have this morning? Answer with ho preso.',
        studentAction: 'Produce: Ho preso + noun.',
        teacherHint: 'Personalize: ho preso un caffè, ho preso l\'autobus, ho preso un libro. Any accurate prendere sentence works.',
      },
    ],
  },

  // ─── Comprare al passato (ho comprato / ha comprato) ──────────────────────
  {
    contentKey: 'i bought',
    language: 'italian',
    displayName: 'Passato Prossimo — Ho comprato / Ha comprato',
    unitType: 'verb',
    vocabTerms: ['ho comprato', 'ha comprato', 'comprare', 'bought', 'I bought', 'she bought', 'hai comprato', 'abbiamo comprato', '-are → -ato', 'participio'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ho comprato" — I bought. "Ha comprato" — she/he bought. -are verbs → -ato. The pattern: drop -are, add -ato. Say them: ho comprato, ha comprato.',
        studentAction: 'Repeat ho comprato and ha comprato.',
        teacherHint: 'Comprare → comprato is regular. This unlocks all regular -are verbs in the past. Once this clicks, students have hundreds of past tense forms.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a purchase. Read: Ho comprato... / Ha comprato...',
        studentAction: 'Read ho comprato / ha comprato sentences with images.',
        teacherHint: 'Focus on the -are → -ato transformation. All regular -are verbs follow this. This is the high-frequency pattern to drill.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who bought what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Mix ho and ha. Students should hold both forms automatically without pause.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cosa hai comprato recentemente? What did you buy recently? Answer with ho comprato.',
        studentAction: 'Produce: Ho comprato + noun.',
        teacherHint: 'Accept any accurate -are participle too: ho mangiato, ho studiato, ho parlato. Extend the pattern.',
      },
    ],
  },

  // ─── Futuro Prossimo — Vado a + infinito ──────────────────────────────────
  {
    contentKey: 'i am going to',
    language: 'italian',
    displayName: 'Futuro Prossimo — Vado a / Va a',
    unitType: 'verb',
    vocabTerms: ['vado a', 'va a', 'futuro prossimo', 'going to', 'I am going to', 'she is going to', 'andiamo a', 'infinito', 'domani', 'stasera'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Vado a mangiare" — I am going to eat. "Va a comprare" — she is going to buy. Vado/va + a + infinitive = near future. Say them: vado a, va a.',
        studentAction: 'Repeat vado a and va a with an infinitive.',
        teacherHint: 'Mirrors French vais à / va à and Spanish voy a / va a. Italian drops the preposition before the infinitive in common speech, but vado a + inf is standard.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a planned action. Read: Vado a + infinitive / Va a + infinitive.',
        studentAction: 'Read vado a / va a sentences with images.',
        teacherHint: 'Any -are, -ere, or -ire infinitive can follow. Keep the infinitive — no conjugation after vado a.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across — who is going to do what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'This is the most useful future structure in Italian 1. Make sure the infinitive form holds.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cosa vai a fare domani? What are you going to do tomorrow? Answer with vado a + infinitive.',
        studentAction: 'Produce: Vado a + infinitive.',
        teacherHint: 'Accept any infinitive. Push students to generate sentences about their actual plans.',
      },
    ],
  },

  // ─── Avere (ho / ha) ──────────────────────────────────────────────────────
  {
    contentKey: 'i have',
    language: 'italian',
    displayName: 'Avere — Ho / Ha',
    unitType: 'verb',
    vocabTerms: ['ho', 'ha', 'avere', 'have', 'I have', 'she has', 'hai', 'abbiamo', 'hanno', 'ho fame', 'ho sete'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ho" — I have. "Ha" — she/he has. The verb is avere. Say them: ho, ha.',
        studentAction: 'Repeat ho and ha.',
        teacherHint: 'Avere is both content verb (to have) and auxiliary for passato prossimo. Getting these two forms automatic now pays off enormously later.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone has. Read: Ho un/una... / Ha un/una...',
        studentAction: 'Read ho / ha sentences with images.',
        teacherHint: 'Gender agreement with un/una: ho un gatto (m), ho una macchina (f). Flag mismatches. Also: ho fame, ho sete — avere for states like French avoir.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who has what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Keep ho vs ha sharp throughout.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cosa hai nella tua borsa? What do you have in your bag? Answer with ho.',
        studentAction: 'Produce: Ho un/una + noun.',
        teacherHint: 'Personalize freely. Any accurate avere sentence works.',
      },
    ],
  },

  // ─── Volere (voglio / vuole) ───────────────────────────────────────────────
  {
    contentKey: 'i want',
    language: 'italian',
    displayName: 'Volere — Voglio / Vuole',
    unitType: 'verb',
    vocabTerms: ['voglio', 'vuole', 'volere', 'want', 'I want', 'she wants', 'vuoi', 'vogliamo', 'vogliono', 'voglio + infinito'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Voglio" — I want. "Vuole" — she/he wants. The verb is volere. The stem changes: vol → vogli / vuo. Say them: voglio, vuole.',
        studentAction: 'Repeat voglio and vuole.',
        teacherHint: 'Stem change mirrors Spanish querer (quiero/quiere) and French vouloir (veux/veut). Boot verb pattern: voglio, vuoi, vuole, vogliamo, volete, vogliono.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone wants. Read: Voglio... / Vuole...',
        studentAction: 'Read voglio / vuole sentences with images.',
        teacherHint: 'Voglio + infinitive is the key construction. Ensure students produce the infinitive — not a conjugated form — after voglio.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across the columns — who wants what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Check voglio vs vuole form accuracy. Combinator drills volere + infinitive automaticity.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cosa vuoi fare oggi? What do you want to do today? Answer with voglio.',
        studentAction: 'Produce: Voglio + infinitive.',
        teacherHint: 'Voglio + infinitive is extremely high-frequency. Personalize: voglio mangiare, voglio andare, voglio comprare. Accept any accurate infinitive.',
      },
    ],
  },

  // ─── Essere: la natura delle cose (sono / è) ─────────────────────────────
  {
    contentKey: 'to be',
    language: 'italian',
    displayName: 'Essere — Sono / È',
    unitType: 'ser_estar',
    vocabTerms: ['sono', 'è', 'essere', 'to be', 'I am', 'she is', 'sei', 'siamo', 'sono (they)', 'nazionalità', 'professione'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Sono" — I am. "È" — she/he/it is. The verb is essere. It is irregular. Italian uses essere for both identity AND states. Say them: sono, è.',
        studentAction: 'Repeat sono and è.',
        teacherHint: 'Like French être, Italian essere covers nationality, profession, and personality. Unlike Spanish, there is no ser/estar split for identity vs state — essere handles both (with stare for progressive).',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows identity or description. Read: Sono... / È... Adjectives agree with gender.',
        studentAction: 'Read essere sentences with images.',
        teacherHint: 'Adjective agreement: stanco/stanca, americano/americana, contento/contenta. Feminine adds -a. Flag both gender and spelling.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who is what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Watch gender agreement of adjectives throughout the drill.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Chi sei? Tell me two things about yourself with essere — nationality or profession, and one personality trait.',
        studentAction: 'Produce two sono sentences.',
        teacherHint: 'Nationality, profession, personality — all essere. Accept any accurate response.',
      },
    ],
  },

  // ─── Dove sono? — Essere: Luoghi ──────────────────────────────────────────
  {
    contentKey: 'where am i',
    language: 'italian',
    displayName: 'Essere — Dove sono? / Dov\'è?',
    unitType: 'verb',
    vocabTerms: ['sono a', 'è a', 'dove sei', 'dove sono', 'essere + luogo', 'in città', 'al piano', 'a Roma', 'in ufficio', 'locations'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Sono in classe" — I am in class. "È al cinema" — she is at the cinema. Essere expresses location too. Say: sono a, è a.',
        studentAction: 'Repeat sono a and è a with a location.',
        teacherHint: 'In Italian, essere handles location (not stare, except for progressive). Sono in classe, sono a casa, sono al lavoro. A + il → al, a + la → alla.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a location. Read: Sono al... / alla... / in... È al... / alla... / in...',
        studentAction: 'Read sono/è location sentences with images.',
        teacherHint: 'Al (masc), alla (fem), in (open spaces, countries, rooms). Sono a Roma, sono in Italia, sono al caffè.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who is where?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Al vs alla vs in — check each substitution carefully.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Dove sei adesso? Where are you right now? Answer with sono.',
        studentAction: 'Produce: Sono + location.',
        teacherHint: 'Accept any accurate location. Push for variety: sono a scuola, sono in classe, sono al bar.',
      },
    ],
  },

  // ─── Potere (posso / può) ─────────────────────────────────────────────────
  {
    contentKey: 'i can',
    language: 'italian',
    displayName: 'Potere — Posso / Può',
    unitType: 'verb',
    vocabTerms: ['posso', 'può', 'potere', 'can', 'I can', 'she can', 'puoi', 'possiamo', 'possono', 'non posso', 'posso + infinito'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Posso" — I can. "Può" — she/he can. The verb is potere. Stem change: pot → poss / pu. Say them: posso, può.',
        studentAction: 'Repeat posso and può.',
        teacherHint: 'Boot verb pattern mirrors Spanish poder (puedo/puede) and French pouvoir (peux/peut). Posso + infinitive. Non posso + infinitive for negation.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone can or cannot do. Read: Posso... / Può... / Non posso...',
        studentAction: 'Read posso / può sentences with images.',
        teacherHint: 'Potere + infinitive. Non posso andare — I cannot go. Può venire — she can come. Keep infinitive after modal.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who can do what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Check posso vs può form accuracy throughout.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cosa puoi fare bene? What can you do well? Answer with posso. Then say one thing you cannot do: non posso + infinitive.',
        studentAction: 'Produce: Posso + infinitive, then Non posso + infinitive.',
        teacherHint: 'Non posso + infinitive: the non goes before the conjugated verb, not the infinitive. Non posso andare — correct. Posso non andare — different meaning (I can choose not to go).',
      },
    ],
  },

  // ─── C'è / Ci sono ────────────────────────────────────────────────────────
  {
    contentKey: 'there is',
    language: 'italian',
    displayName: "C'è / Ci sono",
    unitType: 'verb',
    vocabTerms: ["c'è", 'ci sono', 'hay equivalent', 'there is', 'there are', 'non c\'è', 'non ci sono', 'quante persone', 'quanto'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"C\'è" — there is. "Ci sono" — there are. One item: c\'è. Many items: ci sono. Say them: c\'è, ci sono.',
        studentAction: "Repeat c'è and ci sono.",
        teacherHint: "Exact mirror of Spanish hay / French il y a. C'è is singular, ci sono is plural. Non c'è = there isn't. Non ci sono = there aren't.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows a scene. Describe what's in it: C'è un/una... / Ci sono...",
        studentAction: "Produce c'è or ci sono sentences based on images.",
        teacherHint: "Singular noun → c'è. Plural noun → ci sono. Un gatto → c'è un gatto. Tre studenti → ci sono tre studenti.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: "C'è o ci sono? Describe the scene rapidly.",
        studentAction: "Combine c'è / ci sono with nouns from images.",
        teacherHint: "Drill the singular/plural choice. Students should hear the noun and auto-select c'è or ci sono.",
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Quante persone ci sono nella tua famiglia? How many people are in your family? Answer with ci sono.",
        studentAction: "Produce: Ci sono + number + noun.",
        teacherHint: "Personalize: ci sono quattro persone. Extend: c'è un cane? Non c'è nessuno. Any accurate response works.",
      },
    ],
  },

  // ─── Mi piace / Mi piacciono (Piacere) ────────────────────────────────────
  {
    contentKey: 'i like',
    language: 'italian',
    displayName: 'Piacere — Mi piace / Mi piacciono',
    unitType: 'verb',
    vocabTerms: ['mi piace', 'mi piacciono', 'piacere', 'like', 'I like', 'she likes', 'ti piace', 'le piace', 'non mi piace', 'cosa ti piace'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Mi piace" — I like (one thing). "Mi piacciono" — I like (many things). Piacere is backwards: the thing is the subject. Say them: mi piace, mi piacciono.',
        studentAction: 'Repeat mi piace and mi piacciono.',
        teacherHint: 'Direct mirror of Spanish gustar. Mi piace il gelato = the ice cream pleases me. Mi piacciono i gelati = the ice creams please me. The noun controls singular vs plural.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something enjoyable. Read: Mi piace... / Mi piacciono...',
        studentAction: 'Read mi piace / mi piacciono sentences with images.',
        teacherHint: 'Singular noun after mi piace (no article change). Plural noun after mi piacciono. Non mi piace = I don\'t like it. Non mi piacciono = I don\'t like them.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — what do they like?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Check mi piace vs mi piacciono based on singular/plural object. This is the key distinction to drill.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cosa ti piace fare nel tempo libero? What do you like to do in your free time? Answer with mi piace.',
        studentAction: 'Produce: Mi piace + noun or infinitive.',
        teacherHint: 'Mi piace + infinitive is also valid: mi piace leggere, mi piace ballare. Accept any accurate piacere sentence.',
      },
    ],
  },

  // ─── Mi piacerebbe — Il Condizionale ──────────────────────────────────────
  {
    contentKey: 'i would like',
    language: 'italian',
    displayName: 'Condizionale — Mi piacerebbe',
    unitType: 'verb',
    vocabTerms: ['mi piacerebbe', 'vorrei', 'condizionale', 'would like', 'I would like', 'she would like', 'potrei', 'potrebbe', 'vorrebbe', 'per favore'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Mi piacerebbe" — I would like. "Vorrei" — I would like (to do). These are the polite, conditional forms. Say them: mi piacerebbe, vorrei.',
        studentAction: 'Repeat mi piacerebbe and vorrei.',
        teacherHint: 'Mi piacerebbe mirrors Spanish me gustaría. Vorrei = volere conditional — equally important for polite requests. Both are extremely high-frequency.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Polite ordering, requests, and wishes. Read: Mi piacerebbe... / Vorrei...',
        studentAction: 'Read mi piacerebbe / vorrei sentences with images.',
        teacherHint: 'Vorrei un caffè = I would like a coffee. Mi piacerebbe viaggiare = I would like to travel. Vorrei + noun (ordering); mi piacerebbe + infinitive (wishes).',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — what would they like?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Both forms are correct. Let students choose which fits the context — ordering vs wishing.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cosa le piacerebbe fare quest\'estate? What would you like to do this summer? Answer with mi piacerebbe.',
        studentAction: 'Produce: Mi piacerebbe + infinitive.',
        teacherHint: 'Personalize freely. Mi piacerebbe andare in Italia, mi piacerebbe imparare a cucinare. Any conditional form works.',
      },
    ],
  },

  // ─── Essere al passato (sono andato/a) ───────────────────────────────────
  {
    contentKey: 'i went',
    language: 'italian',
    displayName: 'Passato Prossimo con Essere — Sono andato/a',
    unitType: 'verb',
    vocabTerms: ['sono andato', 'sono andata', 'è andato', 'è andata', 'essere + participio', 'went', 'I went', 'she went', 'accordo genere', '-ato/-ata'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Sono andato" — I went (male). "Sono andata" — I went (female). With andare the auxiliary is ESSERE, not avere. And the participle agrees with gender. Say them: sono andato, sono andata.',
        studentAction: 'Repeat sono andato and sono andata.',
        teacherHint: 'This is a major Italian-specific rule: verbs of motion use essere, not avere. Mirrors French être verbs (je suis allé/allée). Participle must agree with subject gender.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a past trip or movement. Read: Sono andato/a al... / Lui è andato... / Lei è andata...',
        studentAction: 'Read sono andato/a sentences with images.',
        teacherHint: 'Reinforce: essere verbs = motion + state change verbs. Andare, venire, uscire, partire, arrivare — all take essere. Participle changes based on who went.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who went where?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Enforce gender agreement: -o for male subjects, -a for female subjects. Plural: -i (m/mixed), -e (all female).',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Dove sei andato/a il fine settimana scorso? Where did you go last weekend? Answer with sono andato/a.',
        studentAction: 'Produce: Sono andato/a + location.',
        teacherHint: 'Let students self-select gender. Accept any accurate essere-auxiliary sentence.',
      },
    ],
  },

  // ─── Va a + infinito (3rd person near future) ─────────────────────────────
  {
    contentKey: 'he is going to',
    language: 'italian',
    displayName: 'Futuro Prossimo — Va a / Andiamo a',
    unitType: 'verb',
    vocabTerms: ['va a', 'andiamo a', 'lui va a', 'lei va a', 'vanno a', 'he is going to', 'she is going to', 'we are going to', 'futuro prossimo', 'vendere', 'leggere'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Va a comprare" — she is going to buy. "Andiamo a mangiare" — we are going to eat. Extend the futuro prossimo to third person and we. Say them: va a, andiamo a.',
        studentAction: 'Repeat va a and andiamo a with an infinitive.',
        teacherHint: 'Students already know vado a. Now drill va a (3rd) and andiamo a (we). This completes the most useful future pattern in Italian 1.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a planned action by someone else. Read: Va a... / Andiamo a...',
        studentAction: 'Read va a / andiamo a sentences with images.',
        teacherHint: 'Push beyond -are verbs: va a vendere (-ere), va a partire (-ire). All infinitives work. The pattern is universal.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who is going to do what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Mix vado a, va a, andiamo a. Students should hold all three forms without hesitation.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cosa va a fare tua madre stasera? What is your mother going to do tonight? Answer with va a.',
        studentAction: 'Produce: Va a + infinitive.',
        teacherHint: 'Any accurate third-person futuro prossimo works. Extend to vanno a for "they are going to".',
      },
    ],
  },

  // ─── Cosa ha fatto? — Il Passato Prossimo ────────────────────────────────
  {
    contentKey: 'what did he do',
    language: 'italian',
    displayName: 'Passato Prossimo — Cosa ha fatto? / Ho fatto',
    unitType: 'verb',
    vocabTerms: ['ha fatto', 'ho fatto', 'fare', 'cosa ha fatto', 'what did he do', 'I did', 'she did', 'feci', 'participio irregolare', 'fatto'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ho fatto" — I did/made. "Ha fatto" — she/he did/made. Fare → fatto is the key irregular past participle. Say them: ho fatto, ha fatto.',
        studentAction: 'Repeat ho fatto and ha fatto.',
        teacherHint: 'Fare is one of the most frequent Italian verbs. Fatto is its irregular past participle. Like French fait. Cosa hai fatto? is the most natural conversation opener.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a completed action. Read: Ho fatto... / Ha fatto...',
        studentAction: 'Read ho fatto / ha fatto sentences with images.',
        teacherHint: 'Fare compounds: fare colazione, fare la spesa, fare una passeggiata. These are extremely frequent and all take fare.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who did what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Mix with other past participles already known: ho comprato, ho preso, ho fatto. Build automaticity across the set.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Cosa hai fatto ieri sera? What did you do last night? Answer with ho fatto.",
        studentAction: 'Produce: Ho fatto + noun.',
        teacherHint: 'Accept any accurate past tense. This question is the natural bridge to narrative past tense conversations.',
      },
    ],
  },

  // ─── Ha avuto — Avere al passato ─────────────────────────────────────────
  {
    contentKey: 'he had',
    language: 'italian',
    displayName: 'Passato Prossimo — Ho avuto / Ha avuto',
    unitType: 'verb',
    vocabTerms: ['ho avuto', 'ha avuto', 'avere', 'I had', 'she had', 'avuto', 'ho avuto fortuna', 'ho avuto paura', 'irregular participle', 'passato prossimo'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ho avuto" — I had. "Ha avuto" — she/he had. Avere → avuto. Avere takes avere as its own auxiliary (avere ha avuto). Say them: ho avuto, ha avuto.',
        studentAction: 'Repeat ho avuto and ha avuto.',
        teacherHint: 'Avere uses itself as auxiliary. This is a mind-bender worth flagging explicitly. Ho avuto = ho + avuto. The auxiliary and the main verb are the same family.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a past state or experience. Read: Ho avuto... / Ha avuto...',
        studentAction: 'Read ho avuto / ha avuto sentences with images.',
        teacherHint: 'Ho avuto fortuna (I was lucky), ho avuto paura (I was scared), ho avuto un problema. Avere expressions carry into the past tense.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who had what?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Reinforce avuto as an irregular participle. The pattern: avere/fare/dire all end in -uto/-ato/-etto irregularly.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Hai mai avuto paura di qualcosa? Have you ever been scared of something? Answer with ho avuto.',
        studentAction: 'Produce: Ho avuto + noun phrase.',
        teacherHint: 'Accept any accurate avuto sentence. This is also a good opportunity to review avere idiom expressions.',
      },
    ],
  },

  // ─── Gli / Le — Il Pronome Indiretto ─────────────────────────────────────
  {
    contentKey: 'to him',
    language: 'italian',
    displayName: 'Pronomi Indiretti — Gli / Le',
    unitType: 'verb',
    vocabTerms: ['gli', 'le', 'pronome indiretto', 'to him', 'to her', 'gli ho dato', 'le ho detto', 'indirect object', 'a lui', 'a lei'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Gli" — to him. "Le" — to her. These are indirect object pronouns. They replace à + person. Say them: gli, le.',
        studentAction: 'Repeat gli and le.',
        teacherHint: 'Direct mirror of Spanish le (both genders) but Italian distinguishes: gli (masc), le (fem). Gli ho parlato = I spoke to him. Le ho parlato = I spoke to her.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows giving, saying, or sending. Read: Gli ho dato... / Le ho scritto...',
        studentAction: 'Read gli / le sentences with images.',
        teacherHint: 'Position: indirect pronoun goes before the conjugated verb. Gli ho mandato una lettera. Le ho comprato un regalo.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who sent / gave / said what to whom?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Verify gli vs le based on who receives. The distinction is the core of this unit.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Hai scritto a tua madre di recente? Have you written to your mother recently? Answer with le ho scritto.',
        studentAction: 'Produce: Gli/Le ho + past participle.',
        teacherHint: 'Accept any accurate indirect pronoun sentence. Push toward both gli and le sentences.',
      },
    ],
  },

  // ─── È pulito / È sporco — Essere: descrizioni ────────────────────────────
  {
    contentKey: 'it is clean',
    language: 'italian',
    displayName: "Essere — È pulito / È sporco",
    unitType: 'verb',
    vocabTerms: ['è pulito', 'è sporca', 'essere + aggettivo', 'it is clean', 'it is dirty', 'è grande', 'è piccolo', 'com\'è', 'description adjectives', 'gender agreement'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"È pulito" — it is clean (m). "È pulita" — it is clean (f). Essere + adjective. The adjective agrees with what\'s being described. Say them: è pulito, è pulita.',
        studentAction: 'Repeat è pulito and è pulita.',
        teacherHint: 'Mirrors Spanish estar + adjective for descriptions. Key Italian rule: adjective agrees with noun gender. Il tavolo è pulito (m). La cucina è pulita (f).',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a room, object, or space. Describe it: È pulito/a... / È sporco/a...',
        studentAction: 'Read descriptive essere sentences with images.',
        teacherHint: 'Expand beyond clean/dirty: è grande/piccolo, è vecchio/nuovo, è caro/economico. All follow the same gender agreement pattern.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — describe each thing.',
        studentAction: 'Combine essere with adjectives from images.',
        teacherHint: 'Enforce gender agreement on every substitution. Students should pause to check before speaking.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Com'è la tua camera? What is your room like? Answer with è... and describe it with two adjectives.",
        studentAction: 'Produce: È + adjective (with gender agreement).',
        teacherHint: 'Accept any accurate description. Push students to use two descriptors separated by e (and).',
      },
    ],
  },

  // ─── Ho studiato — Verbi in -are al passato ───────────────────────────────
  {
    contentKey: 'i studied',
    language: 'italian',
    displayName: 'Passato Prossimo — Ho studiato / Ha studiato',
    unitType: 'verb',
    vocabTerms: ['ho studiato', 'ha studiato', '-are → -ato', 'passato prossimo', 'I studied', 'she studied', 'ho parlato', 'ho mangiato', 'ho lavorato', 'regular -are'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ho studiato" — I studied. "Ha studiato" — she/he studied. Drop -are, add -ato. This unlocks all regular -are verbs in the past. Say them: ho studiato, ha studiato.',
        studentAction: 'Repeat ho studiato and ha studiato.',
        teacherHint: 'This is the master pattern. Hundreds of -are verbs follow: parlato, mangiato, lavorato, comprato, studiato, viaggiato. Once this clicks, past tense is mostly solved.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a completed routine or activity. Read: Ho studiato... / Ha parlato... / Ho mangiato...',
        studentAction: 'Read -ato past participle sentences with images.',
        teacherHint: 'Rotate through multiple -are participles. Students should recognize the pattern, not memorize each word separately.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who did what with -ato verbs?',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Mix ho and ha. Push students to generate new -are participles not on the list. The pattern should feel generative.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Cos\'hai studiato ieri? What did you study yesterday? Answer with ho studiato.',
        studentAction: 'Produce: Ho studiato + subject.',
        teacherHint: 'Accept any -are past tense sentence. This is the payoff moment — students can now narrate in the past tense freely.',
      },
    ],
  },

  // ─── Ho ricevuto — Participi Irregolari ───────────────────────────────────
  {
    contentKey: 'i received',
    language: 'italian',
    displayName: 'Participi Irregolari — Ho ricevuto / Ha ricevuto',
    unitType: 'verb',
    vocabTerms: ['ho ricevuto', 'ha ricevuto', 'participi irregolari', 'I received', 'she received', 'ho visto', 'ho letto', 'ho scritto', '-uto/-isto/-etto/-itto', 'irregular'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ho ricevuto" — I received. -ere and -ire verbs often have irregular participles. Ricevere → ricevuto. Vedere → visto. Leggere → letto. Say them: ho ricevuto, ho visto, ho letto.',
        studentAction: 'Repeat ho ricevuto, ho visto, and ho letto.',
        teacherHint: 'Irregular participles must be memorized. Group them by ending family: -uto (ricevuto, bevuto, dovuto), -sto (visto, rimasto), -tto (scritto, detto, fatto, letto).',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a past action with an irregular verb. Read: Ho visto... / Ho letto... / Ho scritto...',
        studentAction: 'Read irregular participio sentences with images.',
        teacherHint: 'Vedere→visto, leggere→letto, scrivere→scritto, dire→detto, fare→fatto. These five are the highest-frequency irregulars to lock in now.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — mix regular and irregular past participles.',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Mix -ato regulars with these irregulars. Students should handle both without hesitation now.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Hai visto un buon film di recente? Have you seen a good film lately? Answer with ho visto.',
        studentAction: 'Produce: Ho + irregular participio + noun.',
        teacherHint: 'Accept any accurate irregular past tense sentence. Push students to use at least two different irregular participles.',
      },
    ],
  },

];

// ── Portuguese Madrigal chain units ──────────────────────────────────────────
const PORTUGUESE_UNITS: MadrigalLoopUnit[] = [

  // ─── Ir (vou / ela vai) ────────────────────────────────────────────────────
  {
    contentKey: 'onde vai',
    language: 'portuguese',
    displayName: 'Ir — Vou / Ela vai',
    unitType: 'verb',
    vocabTerms: ['vou', 'ela vai', 'ir', 'go', 'I am going', 'she is going', 'onde vai?', 'vamos', 'vai', 'vão'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Vou" — I am going. "Ela vai" — she is going. The verb is ir. Totally irregular: no stem survives. Say them: vou, ela vai.', studentAction: 'Repeat vou and ela vai.', teacherHint: 'Ir is the most irregular verb in Portuguese — identical to Spanish in this respect. Vou, vai, vamos, vão. The boot verb pattern: boot forms change stems.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a place. Read the sentence: Vou ao cinema... / Ela vai ao banco...', studentAction: 'Read vou / ela vai sentences with places.', teacherHint: 'ao = a + o (masculine), à = a + a (feminine). This contraction is obligatory in Portuguese. Drill the contraction alongside the verb.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Eyes across the columns — who is going where? Build your sentence.', studentAction: 'Combine subject with destination.', teacherHint: 'Enforce ao/à contractions. Check vou vs. vai forms.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Onde vai hoje? Where are you going today? Answer with vou.', studentAction: 'Produce: Vou + destination.', teacherHint: 'Personalize the target: Vou ao mercado, Vou à escola, Vou ao trabalho. Accept any accurate destination.' },
    ],
  },

  // ─── Pegar (peguei / ela pegou) ────────────────────────────────────────────
  {
    contentKey: 'peguei',
    language: 'portuguese',
    displayName: 'Pegar — Peguei / Ela pegou',
    unitType: 'verb',
    vocabTerms: ['peguei', 'ela pegou', 'pegar', 'took', 'I took', 'she took', 'pegou', 'pegar o ônibus', 'pegar táxi', 'pegamos'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Peguei" — I took/caught. "Ela pegou" — she took. The verb is pegar. Regular -ar in the preterite: -ei, -ou. Say them.', studentAction: 'Repeat peguei and ela pegou.', teacherHint: 'Pegar has a spelling change in the first person singular: peg + ei = peguei (the u preserves the hard g). This is a critical pattern in Portuguese orthography.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows transport or an object. Read: Peguei o ônibus... / Ela pegou o táxi...', studentAction: 'Read peguei / ela pegou sentences.', teacherHint: 'Pegar is used for taking/catching transport, items, and opportunities in Brazilian Portuguese. European Portuguese may use tomar for transport.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build your sentence: who took what?', studentAction: 'Combine subject with object.', teacherHint: 'Check peguei vs. pegou. The spelling change in peguei is the biggest error point.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você pegou hoje? What did you take/catch today? Answer with peguei.', studentAction: 'Produce: Peguei + object.', teacherHint: 'Personalize: Peguei o ônibus, Peguei o guarda-chuva, Peguei um resfriado.' },
    ],
  },

  // ─── Comprar (comprei / ela comprou) ───────────────────────────────────────
  {
    contentKey: 'comprei',
    language: 'portuguese',
    displayName: 'Comprar — Comprei / Ela comprou',
    unitType: 'verb',
    vocabTerms: ['comprei', 'ela comprou', 'comprar', 'bought', 'I bought', 'she bought', 'comprou', '-ar → -ei/-ou', 'compramos', 'comprou sapatos'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Comprei" — I bought. "Ela comprou" — she bought. The verb is comprar. This is the regular -ar preterite pattern: -ei, -ou. Say them.', studentAction: 'Repeat comprei and ela comprou.', teacherHint: 'Comprar is the model -ar preterite verb. Once students own comprei/comprou, all regular -ar preterites follow: falei, falou; trabalhei, trabalhou.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a purchase. Read: Comprei o pão... / Ela comprou os sapatos...', studentAction: 'Read comprei / ela comprou sentences.', teacherHint: 'Article + noun: o pão (m), os sapatos (m pl), a blusa (f), as flores (f pl). Drill the articles alongside the verb.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who bought what?', studentAction: 'Combine subject with purchased item.', teacherHint: 'Check the -ei vs. -ou ending. Students commonly confuse the first-person and third-person forms.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você comprou recentemente? What did you buy recently? Answer with comprei.', studentAction: 'Produce: Comprei + item.', teacherHint: 'Personalize: Comprei um livro, Comprei um café, Comprei roupas. Accept any accurate object.' },
    ],
  },

  // ─── Ter (tenho / ela tem) ─────────────────────────────────────────────────
  {
    contentKey: 'tenho / ter',
    language: 'portuguese',
    displayName: 'Ter — Tenho / Ela tem',
    unitType: 'verb',
    vocabTerms: ['tenho', 'ela tem', 'ter', 'have', 'I have', 'she has', 'tem', 'tenho fome', 'tenho sede', 'temos'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Tenho" — I have. "Ela tem" — she has. The verb is ter. Like Spanish tener, ter is used for both possession and physical states. Say them.', studentAction: 'Repeat tenho and ela tem.', teacherHint: 'Ter = Spanish tener. Critical: tenho fome (I\'m hungry), tenho sede (I\'m thirsty), tenho frio (I\'m cold), tenho medo (I\'m scared) — the body-state expressions students need immediately.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a possession or state. Read: Tenho um livro... / Ela tem uma fome enorme...', studentAction: 'Read tenho / ela tem sentences.', teacherHint: 'Push the body-state idioms hard. Tenho fome, tenho sede, tenho pressa, tenho sorte are daily survival expressions in Portuguese.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build your sentence: who has what?', studentAction: 'Combine across columns.', teacherHint: 'Check tenho vs. tem. Watch for *tem eu — the inversion does not work in Portuguese the way it does in French.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você tem agora? What do you have right now? Answer with tenho.', studentAction: 'Produce: Tenho + noun or state.', teacherHint: 'Personalize: Tenho fome, Tenho uma pergunta, Tenho um irmão. Accept any accurate completion.' },
    ],
  },

  // ─── Querer (quero / ela quer) ─────────────────────────────────────────────
  {
    contentKey: 'quero / querer',
    language: 'portuguese',
    displayName: 'Querer — Quero / Ela quer',
    unitType: 'verb',
    vocabTerms: ['quero', 'ela quer', 'querer', 'want', 'I want', 'she wants', 'quer', 'quero comer', 'quero ir', 'queremos'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Quero" — I want. "Ela quer" — she wants. The verb is querer. Same boot pattern as Spanish querer. Say them.', studentAction: 'Repeat quero and ela quer.', teacherHint: 'Querer mirrors Spanish querer perfectly. Boot verb: quer- in boot, quer- (same) outside. No stem change needed — already simple. Quero + infinitive = I want to…' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows something wanted. Read: Quero comer... / Ela quer comprar...', studentAction: 'Read quero / ela quer sentences.', teacherHint: 'Querer + infinitive is the key construction. Push students to produce: Quero ir, Quero comer, Quero aprender.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build your sentence: who wants what?', studentAction: 'Combine subject with infinitive or noun.', teacherHint: 'Check quero vs. quer. The combinator builds querer + infinitive automaticity.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você quer fazer hoje? What do you want to do today? Answer with quero.', studentAction: 'Produce: Quero + infinitive.', teacherHint: 'Accept any accurate infinitive: Quero dormir, Quero sair, Quero estudar.' },
    ],
  },

  // ─── Ser (sou / ela é) ─────────────────────────────────────────────────────
  {
    contentKey: 'ser: a natureza',
    language: 'portuguese',
    displayName: 'Ser — Sou / Ela é',
    unitType: 'verb',
    vocabTerms: ['sou', 'ela é', 'ser', 'be', 'I am', 'she is', 'é', 'sou americano', 'sou estudante', 'somos'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Sou" — I am. "Ela é" — she is. The verb is ser. Ser expresses identity and permanent characteristics. Say them.', studentAction: 'Repeat sou and ela é.', teacherHint: 'Portuguese has two "to be" verbs: ser (identity, origin, nature) and estar (states, location). Ser is the identity verb. Begin with the most concrete: nationality, profession.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows an identity. Read: Sou americano... / Ela é professora...', studentAction: 'Read sou / ela é sentences with identity words.', teacherHint: 'No article before profession in Portuguese: sou médico, não sou *um médico* (exception: with adjectives: sou um médico excelente).' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who is what?', studentAction: 'Combine subject with identity.', teacherHint: 'Check sou vs. é. Watch gender agreement: sou americano (m) / sou americana (f).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você é? What are you? Quem é você? Who are you? Answer with sou.', studentAction: 'Produce: Sou + identity.', teacherHint: 'Accept nationality, profession, or personal quality. Sou brasileiro, Sou estudante, Sou tímido.' },
    ],
  },

  // ─── Estar (estou / ela está) ──────────────────────────────────────────────
  {
    contentKey: 'onde estou',
    language: 'portuguese',
    displayName: 'Estar — Estou / Ela está',
    unitType: 'verb',
    vocabTerms: ['estou', 'ela está', 'estar', 'am/is', 'I am (location)', 'she is (location)', 'está', 'estou em casa', 'onde está?', 'estamos'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Estou" — I am (location/state). "Ela está" — she is (location/state). The verb is estar. Say them.', studentAction: 'Repeat estou and ela está.', teacherHint: 'Estar = location and temporary states. Estou em casa, estou cansado. Contrast with ser immediately: sou cansado (*wrong) vs. estou cansado (correct). Location ALWAYS uses estar.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a place or state. Read: Estou em casa... / Ela está no trabalho...', studentAction: 'Read estou / ela está location sentences.', teacherHint: 'em + o = no, em + a = na. These contractions are obligatory: estou no mercado, ela está na escola. Drill em/no/na alongside estar.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who is where?', studentAction: 'Combine subject with location.', teacherHint: 'Check estou vs. está. Enforce no/na contractions. Correct any *em o or *em a immediately.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Onde você está agora? Where are you right now? Answer with estou.', studentAction: 'Produce: Estou + location.', teacherHint: 'Personalize: Estou na aula, Estou em casa, Estou no trabalho. Accept any accurate location.' },
    ],
  },

  // ─── Poder (posso / ela pode) ──────────────────────────────────────────────
  {
    contentKey: 'posso ir',
    language: 'portuguese',
    displayName: 'Poder — Posso / Ela pode',
    unitType: 'verb',
    vocabTerms: ['posso', 'ela pode', 'poder', 'can', 'I can', 'she can', 'pode', 'posso falar', 'não posso', 'podemos'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Posso" — I can. "Ela pode" — she can. The verb is poder. Boot verb: pos-/pod-. Say them.', studentAction: 'Repeat posso and ela pode.', teacherHint: 'Poder = Spanish poder. Boot: posso, pode, podemos, podem. The double-consonant in posso is the signature form — hardest for students to spell.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows an ability. Read: Posso falar português... / Ela pode ajudar...', studentAction: 'Read posso / ela pode sentences.', teacherHint: 'Poder + infinitive is the construction. Check that students produce the infinitive after posso — not a conjugated form.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who can do what?', studentAction: 'Combine across columns.', teacherHint: 'Check posso vs. pode. The combinator drills poder + infinitive automaticity.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você pode fazer bem? What can you do well? Answer with posso.', studentAction: 'Produce: Posso + infinitive.', teacherHint: 'Personalize: Posso cozinhar, Posso falar inglês, Posso dirigir.' },
    ],
  },

  // ─── Haver / Ter (há / tem) ────────────────────────────────────────────────
  {
    contentKey: 'tem / há',
    language: 'portuguese',
    displayName: 'Há / Tem — There Is / There Are',
    unitType: 'verb',
    vocabTerms: ['há', 'tem', 'there is', 'there are', 'não há', 'não tem', 'há um café', 'tem três pessoas', 'quanto tem?', 'existência'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Há" — there is / there are (formal). "Tem" — there is / there are (informal, Brazilian). Both are equally important. Say them.', studentAction: 'Repeat há and tem (existential).', teacherHint: 'Brazilian Portuguese strongly prefers tem for existential meaning (Tem café aqui). European Portuguese uses há. Há is standard in writing. Teach both — students will encounter both.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows something that exists. Read: Há um banco aqui... / Tem três estudantes...', studentAction: 'Read há / tem existential sentences.', teacherHint: 'Há is invariable (há um, há vinte — same form). Tem as existential is also invariable: tem muita gente, tem dois bancos. Check students are not pluralizing.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: what exists where?', studentAction: 'Combine há/tem with location and noun.', teacherHint: 'Check existential vs. possessive tem. Context should make it clear.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que há / tem no seu bairro? What is there in your neighborhood? Answer with há or tem.', studentAction: 'Produce: Há/Tem + noun.', teacherHint: 'Accept either há or tem. Both are correct. Reward both without prescribing one.' },
    ],
  },

  // ─── Gostar (gosto / ela gosta) ────────────────────────────────────────────
  {
    contentKey: 'gosto / gosto de',
    language: 'portuguese',
    displayName: 'Gostar — Gosto de / Ela gosta de',
    unitType: 'verb',
    vocabTerms: ['gosto de', 'ela gosta de', 'gostar', 'like', 'I like', 'she likes', 'não gosto', 'você gosta?', 'gosto de música', 'gostamos'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Gosto de" — I like. "Ela gosta de" — she likes. The verb is gostar. The preposition de is ALWAYS required. Say them.', studentAction: 'Repeat gosto de and ela gosta de.', teacherHint: 'Unlike gustar in Spanish, gostar is a normal -ar verb — it conjugates like any -ar verb. The key is the obligatory preposition de: gosto de música (*gosto música is wrong). Drill gosto de every time.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows something liked. Read: Gosto de futebol... / Ela gosta de ler...', studentAction: 'Read gosto de / ela gosta de sentences.', teacherHint: 'Gosto de + noun (without article usually) or gosto de + infinitive. Both are correct and equally useful.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who likes what?', studentAction: 'Combine subject with gosto de / gosta de + object.', teacherHint: 'Enforce de. Every sentence must have de. This is the biggest error in Portuguese likes/dislikes.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Do que você gosta? What do you like? Answer with gosto de.', studentAction: 'Produce: Gosto de + noun or infinitive.', teacherHint: 'Personalize: Gosto de música, Gosto de viajar, Gosto de animais.' },
    ],
  },

  // ─── Conditional (eu gostaria / ela gostaria) ──────────────────────────────
  {
    contentKey: 'eu gostaria',
    language: 'portuguese',
    displayName: 'Gostaria / Queria — I Would Like',
    unitType: 'verb',
    vocabTerms: ['gostaria', 'queria', 'I would like', 'ela gostaria', 'gostaria de', 'queria um café', 'por favor', 'condicional', 'seria', 'poderia'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Gostaria de" — I would like. "Queria" — I would like (equally common, imperfect used as conditional). Both are polite. Say them.', studentAction: 'Repeat gostaria de and queria.', teacherHint: 'Brazilian Portuguese uses both gostaria (formal conditional) and queria (imperfect used as a polite form). Both are correct and extremely common. Teach both immediately.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a polite request. Read: Gostaria de um café... / Queria fazer uma reserva...', studentAction: 'Read gostaria de / queria sentences.', teacherHint: 'At a restaurant: Queria um café, por favor. At a hotel: Gostaria de fazer uma reserva. These are the highest-frequency polite forms in Portuguese.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build a polite request: what would you like?', studentAction: 'Combine gostaria de or queria with noun or infinitive.', teacherHint: 'Check gostaria de + infinitive vs. queria + infinitive. Both patterns work.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você gostaria de fazer nas férias? What would you like to do on vacation? Answer with gostaria de or queria.', studentAction: 'Produce: Gostaria de / Queria + infinitive.', teacherHint: 'Accept either form. Gostaria de viajar, Queria visitar o Brasil. Both are elegant Portuguese.' },
    ],
  },

  // ─── Ir no passado (fui / ela foi) ────────────────────────────────────────
  {
    contentKey: 'fui — ir no passado',
    language: 'portuguese',
    displayName: 'Ir — Fui / Ela foi',
    unitType: 'verb',
    vocabTerms: ['fui', 'ela foi', 'ir', 'went', 'I went', 'she went', 'foi', 'fui ao cinema', 'fomos', 'foram'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Fui" — I went. "Ela foi" — she went. The verb is ir in the preterite. Totally irregular: vai → fui. Same as Spanish: voy → fui. Say them.', studentAction: 'Repeat fui and ela foi.', teacherHint: 'Fui/foi is the same supletive preterite as Spanish ir/ser. Ser also uses fui/foi in the preterite! Context distinguishes them. Students who know Spanish will find this familiar.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a destination in the past. Read: Fui ao cinema ontem... / Ela foi ao médico...', studentAction: 'Read fui / ela foi sentences.', teacherHint: 'ao = a + o (masculine), à = a + a (feminine). These contractions are obligatory even in the past tense: fui ao mercado, não fui *a o mercado.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who went where?', studentAction: 'Combine subject with destination.', teacherHint: 'Check fui vs. foi. Enforce ao/à contractions in all answers.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Onde você foi no fim de semana? Where did you go last weekend? Answer with fui.', studentAction: 'Produce: Fui + destination.', teacherHint: 'Personalize: Fui ao shopping, Fui à praia, Fui à casa de um amigo.' },
    ],
  },

  // ─── Vou + infinitivo (futuro imediato) ────────────────────────────────────
  {
    contentKey: 'vou: o futuro imediato',
    language: 'portuguese',
    displayName: 'Vou + Infinitivo — Futuro Imediato',
    unitType: 'verb',
    vocabTerms: ['vou comer', 'ela vai comprar', 'vou estudar', 'futuro imediato', 'vou dormir', 'amanhã', 'esta noite', 'vamos', 'vai', 'vão'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Vou comer" — I am going to eat. "Ela vai comprar" — she is going to buy. Ir + infinitive = near future. Say them.', studentAction: 'Repeat vou + infinitive and ela vai + infinitive.', teacherHint: 'Ir + infinitive is the most common future expression in Brazilian Portuguese (the simple future is considered formal/literary). Vou, vai, vamos, vão + infinitive covers nearly all everyday future expression.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a future action. Read: Vou estudar hoje à noite... / Ela vai viajar amanhã...', studentAction: 'Read vou / ela vai + infinitive sentences.', teacherHint: 'No preposition between ir and the infinitive in Portuguese: vou comer (correct), *vou a comer (wrong in Portuguese). This contrasts with Spanish where a is sometimes inserted in colloquial speech.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who is going to do what?', studentAction: 'Combine subject with vai + infinitive.', teacherHint: 'Check vou vs. vai. Enforce no preposition between vai and the infinitive.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você vai fazer amanhã? What are you going to do tomorrow? Answer with vou.', studentAction: 'Produce: Vou + infinitive.', teacherHint: 'Personalize: Vou trabalhar, Vou ao cinema, Vou ligar para minha família.' },
    ],
  },

  // ─── Vai + infinitivo (3a pessoa) ──────────────────────────────────────────
  {
    contentKey: 'vai: vender / ler / escrever',
    language: 'portuguese',
    displayName: 'Vai — 3ª Pessoa + Infinitivo',
    unitType: 'verb',
    vocabTerms: ['ela vai vender', 'ele vai ler', 'ela vai escrever', 'vai', 'vender', 'ler', 'escrever', 'verbos -er/-ir', 'vai trabalhar', 'vai sair'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Ela vai vender" — she is going to sell. "Ele vai ler" — he is going to read. Same ir + infinitive, third person. Say them.', studentAction: 'Repeat ela vai + infinitive forms.', teacherHint: 'This step extends the near future to -er and -ir verbs. The infinitive is always the same form regardless of subject. No changes to the infinitive at all.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a third-person future action. Read: Ela vai vender o carro... / Ele vai escrever uma carta...', studentAction: 'Read ela vai / ele vai sentences with -er/-ir verbs.', teacherHint: 'Focus on the infinitive endings: vender (-er), ler (-er), escrever (-er), sair (-ir), abrir (-ir). These are the second and third conjugation infinitives.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who is going to do what (3rd person)?', studentAction: 'Combine ela/ele vai with -er/-ir infinitives.', teacherHint: 'Check vai form. All third-person subjects use vai + infinitive in the singular.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que ela vai fazer este verão? What is she going to do this summer? Answer with ela vai.', studentAction: 'Produce: Ela vai + infinitive.', teacherHint: 'Personalize: Ela vai viajar, Ela vai estudar, Ela vai trabalhar no exterior.' },
    ],
  },

  // ─── Fazer (fez / fiz) ─────────────────────────────────────────────────────
  {
    contentKey: 'o que fez?',
    language: 'portuguese',
    displayName: 'Fazer — Fiz / Ela fez',
    unitType: 'verb',
    vocabTerms: ['fiz', 'ela fez', 'fazer', 'did/made', 'I did', 'she did', 'fez', 'fazer compras', 'fazer exercício', 'o que fez?'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Fiz" — I did / I made. "Ela fez" — she did. The verb is fazer in the preterite. Irregular: faço → fiz. Say them.', studentAction: 'Repeat fiz and ela fez.', teacherHint: 'Fazer is irregular in the preterite: fiz, fez, fizemos, fizeram. The z in fiz/fez is the marker. Fazer covers "to do" and "to make" — both meanings in the same verb, just like Spanish hacer.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a completed activity. Read: Fiz as compras... / Ela fez os deveres...', studentAction: 'Read fiz / ela fez sentences.', teacherHint: 'Fazer expressions: fazer as compras, fazer exercício, fazer uma viagem, fazer um bolo. These collocations are extremely high frequency in Portuguese.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who did what?', studentAction: 'Combine subject with fiz/fez + activity.', teacherHint: 'Check fiz vs. fez. Push students to use fazer collocations, not just generic objects.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você fez ontem? What did you do yesterday? Answer with fiz.', studentAction: 'Produce: Fiz + activity.', teacherHint: 'Personalize: Fiz exercício, Fiz o jantar, Fiz as compras, Fiz nada (I did nothing).' },
    ],
  },

  // ─── Ter no passado (tive / ela teve) ─────────────────────────────────────
  {
    contentKey: 'teve — ter no passado',
    language: 'portuguese',
    displayName: 'Ter — Tive / Ela teve',
    unitType: 'verb',
    vocabTerms: ['tive', 'ela teve', 'ter', 'had', 'I had', 'she had', 'teve', 'tive sorte', 'tive medo', 'tivemos'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Tive" — I had. "Ela teve" — she had. The verb is ter in the preterite. Irregular: tenho → tive. Say them.', studentAction: 'Repeat tive and ela teve.', teacherHint: 'Ter preterite is irregular: tive, teve, tivemos, tiveram. The pattern is the same as Spanish tener: tuve, tuvo. If students know Spanish, this is a direct parallel.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a past experience or state. Read: Tive sorte... / Ela teve um problema...', studentAction: 'Read tive / ela teve sentences.', teacherHint: 'Push body-state idioms in the past: tive medo, tive pressa, tive azar. These are the same expressions as the present but in the preterite.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who had what experience?', studentAction: 'Combine subject with tive/teve + noun.', teacherHint: 'Check tive vs. teve. Push idioms over simple possession.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Você já teve sorte grande? Have you ever had great luck? Answer with tive.', studentAction: 'Produce: Tive + experience.', teacherHint: 'Personalize: Tive muita sorte, Tive um dia difícil, Tive uma ideia.' },
    ],
  },

  // ─── Lhe (pronome indireto) ─────────────────────────────────────────────────
  {
    contentKey: 'lhe — o pronome indireto',
    language: 'portuguese',
    displayName: 'Lhe — To Him / To Her',
    unitType: 'verb',
    vocabTerms: ['lhe', 'I gave him/her', 'dei-lhe', 'escrevi-lhe', 'mandei-lhe', 'pronome indireto', 'a ele / a ela', 'lhe disse', 'lhe enviei', 'te'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Lhe" — to him / to her. "Dei-lhe" — I gave to him/her. Lhe replaces a + person. Say it: lhe.', studentAction: 'Repeat lhe and dei-lhe.', teacherHint: 'Lhe in European Portuguese and formal Brazilian Portuguese = indirect object pronoun (to him/her). In colloquial Brazilian, "para ele/ela" is increasingly used. Teach lhe as the literary/formal form, and mention the colloquial alternative.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows giving or communicating. Read: Dei-lhe o livro... / Escrevi-lhe uma carta...', studentAction: 'Read lhe sentences.', teacherHint: 'Clitic placement is complex in Portuguese — European uses enclisis (verb-lhe), Brazilian may use proclisis (lhe-verb). For now, focus on European-standard: verb-lhe.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who gave / said / sent what to whom?', studentAction: 'Combine verb + lhe + object.', teacherHint: 'Check enclitic position. Reward correct lhe placement.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você deu a um amigo recentemente? What did you give a friend recently? Answer with dei-lhe.', studentAction: 'Produce: sentence with lhe.', teacherHint: 'Accept colloquial Brazilian alternative: Dei para ele um livro. Both are valid — explain the register difference.' },
    ],
  },

  // ─── Estar + adjetivo (está limpo / sujo) ─────────────────────────────────
  {
    contentKey: 'está limpo / está sujo',
    language: 'portuguese',
    displayName: 'Estar — Está limpo / Está sujo',
    unitType: 'verb',
    vocabTerms: ['está limpo', 'está sujo', 'está grande', 'está pequeno', 'está bonito', 'como está?', 'estar + adjetivo', 'está certo', 'está errado', 'está pronto'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Está limpo" — it is clean. "Está sujo" — it is dirty. Estar + adjective = current state. Say them.', studentAction: 'Repeat está limpo and está sujo.', teacherHint: 'Estar + adjective describes conditions and states (not permanent nature). Está limpo (it is currently clean) vs. é branco (it is white, always). The ser/estar distinction in descriptions is the core lesson.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a condition. Read: Está limpo... / Está cheio...', studentAction: 'Read está + adjective sentences.', teacherHint: 'Gender agreement: limpo/limpa, sujo/suja, bonito/bonita. Adjectives agree with the noun in Portuguese. Check gender endings.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: what is in what state?', studentAction: 'Combine subject + está + adjective.', teacherHint: 'Check gender agreement. Push students to describe objects around them.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Como está o seu quarto hoje? How is your room today? Answer with está.', studentAction: 'Produce: está + adjective.', teacherHint: 'Personalize: Está limpo, Está bagunçado (messy), Está arrumado (tidy).' },
    ],
  },

  // ─── -ar no passado (estudei / ela estudou) ────────────────────────────────
  {
    contentKey: 'estudei — verbos em -ar no passado',
    language: 'portuguese',
    displayName: 'Estudar — Estudei / Ela estudou',
    unitType: 'verb',
    vocabTerms: ['estudei', 'ela estudou', 'estudar', 'studied', 'I studied', 'she studied', '-ar → -ei/-ou', 'falei', 'trabalhei', 'viajei'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Estudei" — I studied. "Ela estudou" — she studied. This is the regular -ar preterite: -ei, -ou. It covers ALL regular -ar verbs. Say them.', studentAction: 'Repeat estudei and ela estudou.', teacherHint: 'Estudar is the model: estudei, estudou, estudamos, estudaram. Students who know comprei/comprou already know this pattern. Now make it conscious: ANY -ar verb follows this pattern.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a completed past action. Read: Estudei muito ontem... / Ela trabalhou o dia todo...', studentAction: 'Read estudei / ela estudou sentences.', teacherHint: 'Chain multiple -ar preterites: estudei, trabalhei, falei, viajei. Students should begin to feel the -ei ending as automatic for first-person past -ar verbs.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: who studied/worked/traveled in the past?', studentAction: 'Combine subject with -ar preterite.', teacherHint: 'Check -ei (1st) vs. -ou (3rd). Push students to use multiple -ar preterites in one sentence.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você fez ontem à noite? What did you do last night? Answer using -ar preterite verbs.', studentAction: 'Produce 1-2 sentences with -ar preterite verbs.', teacherHint: 'Personalize: Estudei português, Trabalhei até tarde, Jantar com a família.' },
    ],
  },

  // ─── Particípios irregulares (recebi / ela recebeu) ───────────────────────
  {
    contentKey: 'recebi — particípios irregulares',
    language: 'portuguese',
    displayName: 'Receber — Recebi / Ela recebeu',
    unitType: 'verb',
    vocabTerms: ['recebi', 'ela recebeu', 'receber', 'received', 'I received', 'she received', 'vi', 'li', 'escrevi', 'disse', 'fiz', 'irregulares'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"Recebi" — I received. "Ela recebeu" — she received. Then the irregulars: vi (saw), li (read), escrevi (wrote), disse (said), fiz (did). Say each one.', studentAction: 'Repeat recebi, ela recebeu, and the irregular preterites.', teacherHint: 'Receber is actually regular -er: recebi, recebeu. The irregulars are the core high-frequency verbs: ver→vi, ler→li, escrever→escrevi, dizer→disse, fazer→fiz, vir→vim. These need to be memorized.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a past action. Read: Recebi uma carta... / Vi um filme... / Li o livro...', studentAction: 'Read irregular preterite sentences.', teacherHint: 'Group them: vi/li/escrevi feel like a family (short, clean, -i ending). Disse and fiz are their own patterns. Expose all, but let students find the pattern.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: what did you receive, see, read, write, say, do?', studentAction: 'Combine irregular preterite + object.', teacherHint: 'Check the irregular forms. Correct *veei, *lia, *fazi immediately — these incorrect attempts show students are trying to apply regular patterns.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'O que você viu ou leu recentemente? What did you see or read recently? Answer with vi or li.', studentAction: 'Produce: Vi + film/show or Li + book.', teacherHint: 'Personalize: Vi um filme ótimo, Li um livro interessante. Connect to real student life.' },
    ],
  },

];

// Merge all units — Spanish first, then French, then Italian, then Portuguese
const ALL_UNITS = [...UNITS, ...FRENCH_UNITS, ...ITALIAN_UNITS, ...PORTUGUESE_UNITS];

export const MADRIGAL_LOOP_CATALOG: readonly MadrigalLoopUnit[] = ALL_UNITS;

/**
 * Find a Madrigal unit by contentKey and language.
 * Language defaults to 'spanish' for backward compatibility with all existing callers.
 */
export function findMadrigalUnit(contentKey: string, language: string = 'spanish'): MadrigalLoopUnit | null {
  return ALL_UNITS.find(u =>
    u.contentKey.toLowerCase() === contentKey.toLowerCase() &&
    (u.language ?? 'spanish') === language,
  ) ?? null;
}

/**
 * Get all Madrigal units, optionally filtered by language.
 * No language arg = return everything (used by the embedding indexer to index all languages).
 */
export function getAllMadrigalUnits(language?: string): MadrigalLoopUnit[] {
  if (!language) return [...ALL_UNITS];
  return ALL_UNITS.filter(u => (u.language ?? 'spanish') === language);
}
