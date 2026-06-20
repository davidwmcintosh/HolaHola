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
  displayName: string;
  unitType: 'verb' | 'preterite' | 'ser_estar' | 'hay_gustar';
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
];

export const MADRIGAL_LOOP_CATALOG: readonly MadrigalLoopUnit[] = UNITS;

export function findMadrigalUnit(contentKey: string): MadrigalLoopUnit | null {
  return UNITS.find(u => u.contentKey.toLowerCase() === contentKey.toLowerCase()) ?? null;
}

export function getAllMadrigalUnits(): MadrigalLoopUnit[] {
  return [...UNITS];
}
