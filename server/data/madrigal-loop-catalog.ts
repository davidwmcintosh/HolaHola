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

  // ─── Futur Proche (je vais + infinitif) ───────────────────────────────────
  {
    contentKey: 'je vais + infinitif',
    language: 'french',
    displayName: 'Le Futur Proche — Je vais + infinitif',
    unitType: 'verb',
    vocabTerms: ['je vais', 'elle va', 'aller', 'futur proche', 'near future', 'going to', 'je vais manger', 'je vais aller', 'elle va acheter', 'on va'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Je vais manger" — I am going to eat. "Elle va acheter" — she is going to buy. Futur proche = aller conjugated + infinitive. Say them: je vais manger, elle va acheter.',
        studentAction: 'Repeat je vais + infinitive and elle va + infinitive.',
        teacherHint: 'Futur proche is the most natural way to express future plans in spoken French. The construction mirrors Spanish ir a + infinitive and English going to + verb. Automaticity here is high-value.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a plan or intention. Read: Je vais + infinitif... / Elle va + infinitif...',
        studentAction: 'Read je vais / elle va + infinitive sentences with images.',
        teacherHint: 'Make sure students produce the full infinitive after je vais — not a conjugated form. Common error: je vais mange (missing infinitive).',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across the columns — who is going to do what? Build your sentence.',
        studentAction: 'Combine across columns rapidly.',
        teacherHint: 'Check that the infinitive stays in base form. The combinator drills the aller + infinitive automaticity for all subjects.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "Qu'est-ce que vous allez faire ce weekend? What are you going to do this weekend? Answer with je vais.",
        studentAction: 'Produce: Je vais + infinitive for a real weekend plan.',
        teacherHint: "Accept any accurate je vais + infinitive. Personalize and extend: et votre ami(e) — qu'est-ce qu'il/elle va faire? elicits elle va.",
      },
    ],
  },

  // ─── J'ai regardé — Le Présent Parfait (present perfect framing) ──────────
  {
    contentKey: 'i have watched french',
    language: 'french',
    displayName: "Le Présent Parfait — J'ai regardé / As-tu déjà...?",
    unitType: 'perfect',
    vocabTerms: ["j'ai regardé", "j'ai mangé", "j'ai vu", "as-tu déjà", "je n'ai jamais", 'présent parfait', 'present perfect', 'passé composé', 'have you ever', 'already', 'never', 'déjà', 'jamais'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"J\'ai regardé" means both "I watched" AND "I have watched." One form, two meanings in English. Déjà = already. Jamais = never. Say them: j\'ai regardé, j\'ai déjà vu, je n\'ai jamais mangé.',
        studentAction: "Repeat j'ai regardé, j'ai déjà vu, je n'ai jamais mangé.",
        teacherHint: "The insight here: French passé composé IS the present perfect. Students who have only seen it as preterite will have an 'aha' moment. As-tu déjà vu ce film? (Have you seen this film?) is the gateway to present perfect fluency.",
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: "Each image shows a life experience. Read: J'ai déjà... / Je n'ai jamais... Use the passé composé as present perfect.",
        studentAction: "Read j'ai déjà / je n'ai jamais + past participle with images.",
        teacherHint: "Highlight déjà (before the past participle in passé composé: j'ai DÉJÀ regardé) and jamais (je n'ai JAMAIS mangé). These adverbs slot between avoir and the participle — drill placement explicitly.",
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: "Scan the columns — have you ever done this? Build: As-tu déjà + past participle?",
        studentAction: 'Combine subject + ai/a + déjà/jamais + past participle rapidly.',
        teacherHint: "Column 1: j'ai déjà, je n'ai jamais, il a déjà. Column 2: regardé, mangé, vu, lu, voyagé, visité. This drill builds automatic placement of déjà/jamais between auxiliaire and participe.",
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: "As-tu déjà visité Paris? Answer with oui, j'ai déjà... OR non, je n'ai jamais...",
        studentAction: "Produce: Oui, j'ai déjà visité Paris. / Non, je n'ai jamais visité Paris.",
        teacherHint: "This is real conversational French — native speakers ask as-tu déjà + passé composé constantly. Accept both yes and no answers. Extend: et tes parents, ont-ils déjà visité Paris?",
      },
    ],
  },

];

const GERMAN_UNITS: MadrigalLoopUnit[] = [

  // ─── Gehen — Wohin gehst du? ──────────────────────────────────────────────
  {
    contentKey: 'where are you going german',
    language: 'german',
    displayName: 'Gehen — Ich gehe / Sie geht',
    unitType: 'verb',
    vocabTerms: ['ich gehe', 'sie geht', 'gehen', 'go', 'I go', 'she goes', 'wohin gehst du', 'zum', 'ins', 'going'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich gehe" — I go / I am going. "Sie geht" — she goes. The verb is gehen. Say them: ich gehe, sie geht.',
        studentAction: 'Repeat ich gehe and sie geht.',
        teacherHint: 'Gehen + zum/zur (to the) or ins (into the). Point out "ich gehe ins Kino" vs "ich gehe zum Markt". The preposition changes with the article.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a place someone is going. Read: Ich gehe zum Hotel. Ich gehe ins Restaurant. Your turn.',
        studentAction: 'Read each model sentence aloud using the image.',
        teacherHint: 'Drill zum (masculine/neuter dative) and zur (feminine dative) and ins (neuter accusative). High-frequency preposition set.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across the columns — who is going where? Build your sentence.',
        studentAction: 'Combine subject + gehen form + destination rapidly.',
        teacherHint: 'Watch for correct preposition choice. Prioritize fluency — correct zum/zur/ins as a brief note, not a full grammar stop.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Wohin gehst du heute? Where are you going today? Answer with ich gehe.',
        studentAction: 'Produce: Ich gehe + zum/zur/ins + destination.',
        teacherHint: 'Personalize freely. Any accurate ich gehe sentence works. Extend: und deine Freundin — wohin geht sie?',
      },
    ],
  },

  // ─── Nehmen — Ich habe genommen ──────────────────────────────────────────
  {
    contentKey: 'i took german',
    language: 'german',
    displayName: 'Nehmen — Ich habe genommen',
    unitType: 'preterite',
    vocabTerms: ['ich habe genommen', 'sie hat genommen', 'nehmen', 'take', 'took', 'genommen', 'Perfekt', 'strong verb', 'nimmt', 'ich nehme'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich habe genommen" — I took. "Genommen" is the past participle of nehmen. Haben is the auxiliary. Say: ich habe genommen.',
        studentAction: 'Repeat ich habe genommen.',
        teacherHint: 'Nehmen is a strong verb — irregular stem change: nimmt (present), genommen (past participle). Haben is the Perfekt auxiliary here.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone took or picked up. Read: Ich habe das Buch genommen. Your turn.',
        studentAction: 'Read each sentence, anchoring genommen to the image.',
        teacherHint: 'Emphasize that genommen goes to end of clause. The haben + participle frame is the core Perfekt pattern — reinforce it at every repetition.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who took what? Eyes across.',
        studentAction: 'Combine subject + habe/hat + object + genommen.',
        teacherHint: 'Reinforce end-position of genommen. Watch for students inserting it too early.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was hast du heute Morgen genommen? What did you take this morning? Answer with ich habe... genommen.',
        studentAction: 'Produce: Ich habe + object + genommen.',
        teacherHint: 'Good personal contexts: Ich habe den Bus genommen, Ich habe mein Handy genommen, Ich habe ein Brötchen genommen.',
      },
    ],
  },

  // ─── Kaufen — Ich habe gekauft ──────────────────────────────────────────
  {
    contentKey: 'i bought german',
    language: 'german',
    displayName: 'Kaufen — Ich habe gekauft',
    unitType: 'preterite',
    vocabTerms: ['ich habe gekauft', 'sie hat gekauft', 'kaufen', 'buy', 'bought', 'gekauft', 'einkaufen', 'im Laden', 'ich kaufe', 'wir kaufen'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich habe gekauft" — I bought. Kaufen is a regular weak verb — add ge- to the stem and -t: ge-kauf-t. Say: ich habe gekauft.',
        studentAction: 'Repeat ich habe gekauft.',
        teacherHint: 'Regular weak Perfekt pattern: ge + stem + t. Kaufen → gekauft. Contrast with genommen (strong). This regular pattern applies to hundreds of verbs.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a purchase. Read: Ich habe ein Buch gekauft. Ich habe Lebensmittel gekauft. Your turn.',
        studentAction: 'Read each sentence with image support.',
        teacherHint: 'Review article accusative if needed: ich habe einen/eine/ein + noun + gekauft. The accusative ending on masculine articles is a common error here.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who bought what?',
        studentAction: 'Combine subject + habe/hat + accusative object + gekauft.',
        teacherHint: 'Reinforce end-position of gekauft. Flag accusative article mismatches briefly.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was hast du zuletzt gekauft? What did you last buy? Answer with ich habe... gekauft.',
        studentAction: 'Produce: Ich habe + noun + gekauft.',
        teacherHint: 'Personalize: clothes, food, electronics all work. Any accurate Perfekt sentence is a win.',
      },
    ],
  },

  // ─── Werden + Infinitiv — Near Future preview ────────────────────────────
  {
    contentKey: 'i will german',
    language: 'german',
    displayName: 'Ich werde + Infinitiv — Futur Preview',
    unitType: 'verb',
    vocabTerms: ['ich werde', 'sie wird', 'werden', 'will', 'future', 'Futur I', 'ich werde gehen', 'ich werde kaufen', 'ich werde essen', 'wirst du'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich werde" + infinitive — I will. "Sie wird" — she will. Werden is the future auxiliary. Say: ich werde, sie wird.',
        studentAction: 'Repeat ich werde and sie wird.',
        teacherHint: 'Werden conjugates like a strong verb: ich werde, du wirst, er/sie wird. The infinitive goes to the end. This is Futur I — high-frequency in writing and formal speech.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a future plan. Read: Ich werde einkaufen. Ich werde arbeiten. Your turn.',
        studentAction: 'Read each model sentence, anchoring werden + infinitive to the image.',
        teacherHint: 'Reinforce end-position of the infinitive. "Ich werde morgen arbeiten" — the time word can move, but the infinitive stays at the end.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who will do what?',
        studentAction: 'Combine subject + werden form + infinitive at end.',
        teacherHint: 'Common error: inserting the infinitive right after werden. Keep drilling the end-position rule.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was wirst du morgen machen? What will you do tomorrow? Answer with ich werde.',
        studentAction: 'Produce: Ich werde + infinitive.',
        teacherHint: 'Accept any accurate ich werde + infinitive. Extend: und deine Familie — was werden sie machen?',
      },
    ],
  },

  // ─── Haben — Ich habe ────────────────────────────────────────────────────
  {
    contentKey: 'i have german',
    language: 'german',
    displayName: 'Haben — Ich habe / Sie hat',
    unitType: 'verb',
    vocabTerms: ['ich habe', 'sie hat', 'haben', 'have', 'I have', 'she has', 'hast du', 'wir haben', 'es hat', 'habt ihr'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich habe" — I have. "Sie hat" — she has. The verb is haben. Say them: ich habe, sie hat.',
        studentAction: 'Repeat ich habe and sie hat.',
        teacherHint: 'Haben is both content verb (to have) and Perfekt auxiliary. Getting these two forms automatic now pays off enormously — every Perfekt sentence needs haben or sein.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone has. Read: Ich habe ein Auto. Sie hat einen Hund. Your turn.',
        studentAction: 'Read each sentence with image support.',
        teacherHint: 'Flag accusative articles: ich habe einen Hund (masculine accusative → einen), ich habe ein Buch (neuter → ein), ich habe eine Katze (feminine → eine).',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who has what?',
        studentAction: 'Combine subject + habe/hat + accusative object.',
        teacherHint: 'Accusative article agreement is the main drill target here. Reinforce einen/eine/ein consistently.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was hast du zu Hause? What do you have at home? Answer with ich habe.',
        studentAction: 'Produce: Ich habe + noun.',
        teacherHint: 'Personalize freely. Any accurate haben sentence works. Good extension: was hat dein Freund?',
      },
    ],
  },

  // ─── Wollen — Ich will ────────────────────────────────────────────────────
  {
    contentKey: 'i want german',
    language: 'german',
    displayName: 'Wollen — Ich will / Sie will',
    unitType: 'verb',
    vocabTerms: ['ich will', 'sie will', 'wollen', 'want', 'I want', 'she wants', 'willst du', 'wir wollen', 'ich will gehen', 'ich will kaufen'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich will" — I want. "Sie will" — she wants. The verb is wollen — a modal verb. Say them: ich will, sie will.',
        studentAction: 'Repeat ich will and sie will.',
        teacherHint: 'Wollen is a modal verb — it changes the infinitive to end position. Ich will kaufen vs Ich kaufe. Same modal frame as können, müssen, sollen.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone wants to do. Read: Ich will ins Kino gehen. Sie will einkaufen. Your turn.',
        studentAction: 'Read each wollen + infinitive sentence aloud.',
        teacherHint: 'Reinforce infinitive at end. Wollen + infinitive is the frame — drill the end-position consistently.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who wants to do what?',
        studentAction: 'Combine subject + will/will + infinitive at end.',
        teacherHint: 'Modal + infinitive at end: the key German sentence structure rule. Reinforce at every repetition.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was willst du heute machen? What do you want to do today? Answer with ich will.',
        studentAction: 'Produce: Ich will + infinitive.',
        teacherHint: 'Accept any accurate wollen sentence. Extend: und was will dein Freund / deine Freundin machen?',
      },
    ],
  },

  // ─── Sein — Das Wesen der Dinge ─────────────────────────────────────────
  {
    contentKey: 'i am german',
    language: 'german',
    displayName: 'Sein — Das Wesen der Dinge (Ich bin / Sie ist)',
    unitType: 'ser_estar',
    vocabTerms: ['ich bin', 'sie ist', 'sein', 'am', 'is', 'I am', 'she is', 'das ist', 'er ist', 'sind'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich bin" — I am. "Sie ist" — she is. "Das ist" — that is. Sein is the verb to be. Say: ich bin, sie ist, das ist.',
        studentAction: 'Repeat ich bin, sie ist, das ist.',
        teacherHint: 'Sein covers identity, classification, and permanent traits. German uses only sein (unlike Spanish ser/estar distinction). The predicate adjective does NOT take an article or agreement ending after sein.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a classification or description. Read: Das ist ein Hund. Sie ist Lehrerin. Ich bin Student. Your turn.',
        studentAction: 'Read each model sentence with image.',
        teacherHint: 'Note professions with sein take NO article: Sie ist Ärztin (not eine Ärztin). Flag this — common error for English speakers.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — what/who is what?',
        studentAction: 'Combine subject + bin/ist/sind + predicate noun or adjective.',
        teacherHint: 'Mix professions (no article) and descriptions (adjective, no agreement needed after sein). Keep both in the drill.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was bist du von Beruf? What do you do for work or study? Answer with ich bin.',
        studentAction: 'Produce: Ich bin + profession or description.',
        teacherHint: 'Ich bin Schüler/Schülerin. Ich bin Student/Studentin. Ich bin ... — any accurate sein sentence is the goal.',
      },
    ],
  },

  // ─── Sein + Lokation — Wo bin ich? ────────────────────────────────────────
  {
    contentKey: 'where am i german',
    language: 'german',
    displayName: 'Sein + Lokation — Wo bin ich?',
    unitType: 'ser_estar',
    vocabTerms: ['ich bin in', 'sie ist bei', 'sein', 'location', 'where', 'wo bin ich', 'zu Hause', 'in der Schule', 'im Büro', 'auf dem Markt'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich bin in der Schule" — I am at school. "Sie ist zu Hause" — she is at home. Sein + location. Say: ich bin, wo bin ich?',
        studentAction: 'Repeat ich bin and the location phrase.',
        teacherHint: 'Location with sein uses dative prepositions: in + dative, bei + dative, auf + dative. Unlike identity sein (no case change on predicate), location takes dative case.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a place. Read: Ich bin in der Schule. Er ist im Büro. Your turn.',
        studentAction: 'Read each location + sein sentence.',
        teacherHint: 'Focus on the most common locations: zu Hause, in der Schule, im Büro, im Supermarkt, auf dem Marktplatz. Don\'t get lost in dative forms — keep the pace moving.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who is where?',
        studentAction: 'Combine subject + bin/ist + location.',
        teacherHint: 'Keep it high-frequency. The goal is automaticity on the most common location phrases, not exhaustive case drilling.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Wo bist du jetzt? Where are you right now? Answer with ich bin.',
        studentAction: 'Produce: Ich bin + location.',
        teacherHint: 'Personalize: Ich bin in der Schule / im Klassenzimmer / zu Hause. Accept any accurate answer.',
      },
    ],
  },

  // ─── Können — Ich kann ────────────────────────────────────────────────────
  {
    contentKey: 'i can german',
    language: 'german',
    displayName: 'Können — Ich kann / Sie kann',
    unitType: 'verb',
    vocabTerms: ['ich kann', 'sie kann', 'können', 'can', 'able', 'I can', 'she can', 'kannst du', 'wir können', 'ich kann schwimmen'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich kann" — I can. "Sie kann" — she can. Können is a modal verb. Say: ich kann, sie kann.',
        studentAction: 'Repeat ich kann and sie kann.',
        teacherHint: 'Können follows the modal pattern: infinitive at end. Ich kann Deutsch sprechen. Ich kann schwimmen. Modal + infinitive at end — reinforce the frame.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows an ability. Read: Ich kann schwimmen. Sie kann kochen. Ich kann Auto fahren. Your turn.',
        studentAction: 'Read each können sentence with image.',
        teacherHint: 'Rich vocabulary opportunity: fahren, schwimmen, kochen, singen, tanzen, schreiben — all work great here.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who can do what?',
        studentAction: 'Combine subject + kann + infinitive at end.',
        teacherHint: 'Modal + infinitive at end. The most important German sentence structure rule — this is the third modal drilling it. It should be becoming automatic.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was kannst du gut machen? What are you good at? Answer with ich kann.',
        studentAction: 'Produce: Ich kann + infinitive.',
        teacherHint: 'Personalize. Any accurate können + infinitive is the goal.',
      },
    ],
  },

  // ─── Das Infinitivmuster ─────────────────────────────────────────────────
  {
    contentKey: 'infinitive pattern german',
    language: 'german',
    displayName: 'Das Infinitivmuster — Modal + Infinitiv am Ende',
    unitType: 'verb',
    vocabTerms: ['infinitiv', 'modal', 'wollen', 'können', 'müssen', 'sollen', 'dürfen', 'verb at end', 'am Ende', 'Satzbau'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'The pattern: MODAL VERB + ... + INFINITIVE AT END. Ich will ... kaufen. Ich kann ... gehen. Say the pattern: modal, then infinitive at the end.',
        studentAction: 'Repeat the pattern: Ich will...(object)...kaufen.',
        teacherHint: 'This unit consolidates the modal + infinitive at end rule. Use it to review all modals learned so far: wollen, können. Preview: müssen, sollen, dürfen.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Complete the sentence — which infinitive goes at the end? Ich will ins Kino ___. Ich kann gut ___. Your turn.',
        studentAction: 'Complete each sentence by adding the correct infinitive at end.',
        teacherHint: 'This step is a gap-fill format. Students hear the modal + object, then must supply the infinitive. Good diagnostic of automaticity.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Eyes across all three columns: subject, modal, infinitive. Build the sentence.',
        studentAction: 'Combine subject + modal + infinitive to make a full sentence.',
        teacherHint: 'Mix all modals: wollen, können, müssen (preview). Keep pace fast — the goal is fluency in the frame, not new vocabulary.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was musst du morgen machen? What do you have to do tomorrow? Answer with ich muss.',
        studentAction: 'Produce: Ich muss + infinitive — previewing müssen.',
        teacherHint: 'Ich muss lernen / arbeiten / aufräumen. Accept any accurate müssen sentence. This previews the next modal.',
      },
    ],
  },

  // ─── Es gibt ─────────────────────────────────────────────────────────────
  {
    contentKey: 'there is german',
    language: 'german',
    displayName: 'Es gibt — There Is / There Are',
    unitType: 'hay_gustar',
    vocabTerms: ['es gibt', 'there is', 'there are', 'gibt es', 'es gibt kein', 'es gibt keine', 'in der Stadt', 'es gibt viele', 'es gibt einen'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Es gibt" — there is / there are. It never changes — always es gibt, whether singular or plural. Say: es gibt.',
        studentAction: 'Repeat es gibt.',
        teacherHint: 'Es gibt is invariable — no plural form. Es gibt einen Park / Es gibt viele Parks — same verb form. The following noun takes accusative case: es gibt einen/eine/ein.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something that exists in a place. Read: Es gibt einen Park in der Stadt. Es gibt viele Restaurants hier. Your turn.',
        studentAction: 'Read each es gibt sentence.',
        teacherHint: 'Accusative after es gibt: einen (masculine), eine (feminine), ein (neuter), keine (negative). Flag the accusative article but keep pace.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — what is there in each place?',
        studentAction: 'Combine es gibt + accusative noun + location.',
        teacherHint: 'Keep the location context varied: in meiner Stadt, in der Schule, im Park, hier. Helps students use es gibt naturally in descriptions.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was gibt es in deiner Stadt? What is there in your city? Answer with es gibt.',
        studentAction: 'Produce: Es gibt + noun + location.',
        teacherHint: 'Personalize. Es gibt es kein... / Es gibt keine... (negative) is a great extension.',
      },
    ],
  },

  // ─── Gefallen — Mir gefällt ───────────────────────────────────────────────
  {
    contentKey: 'i like german',
    language: 'german',
    displayName: 'Gefallen — Mir gefällt / Mir gefallen',
    unitType: 'hay_gustar',
    vocabTerms: ['mir gefällt', 'mir gefallen', 'gefallen', 'like', 'I like', 'mag ich', 'was gefällt dir', 'es gefällt mir', 'gefällt es dir', 'mögen'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Mir gefällt" — I like (singular thing). "Mir gefallen" — I like (plural things). Like gustar in Spanish — the subject is the thing liked, not the person. Say: mir gefällt, mir gefallen.',
        studentAction: 'Repeat mir gefällt and mir gefallen.',
        teacherHint: 'Gefallen works exactly like gustar: the grammatical subject is the thing liked, which is why it can be singular or plural. Mir gefällt das Buch / Mir gefallen die Bücher. This is the key structural concept.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something enjoyable. Read: Mir gefällt die Musik. Mir gefallen die Filme. Your turn.',
        studentAction: 'Read each gefallen sentence with image.',
        teacherHint: 'Gefällt (singular) vs gefallen (plural) — the verb agrees with the thing liked. Drill both forms. Mir → dative of ich.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — to whom does what appeal? Eyes across.',
        studentAction: 'Combine dative person (mir/dir/ihm/ihr) + gefällt/gefallen + noun.',
        teacherHint: 'Keep mir and dir in the drill. Optional extension: ihm/ihr for third person.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was gefällt dir in der Schule? What do you like at school? Answer with mir gefällt / mir gefallen.',
        studentAction: 'Produce a genuine mir gefällt / mir gefallen sentence.',
        teacherHint: 'Accept both singular and plural correctly matched. This is the core structural test of the unit.',
      },
    ],
  },

  // ─── Möchten — Ich möchte ─────────────────────────────────────────────────
  {
    contentKey: 'i would like german',
    language: 'german',
    displayName: 'Möchten — Ich möchte / Sie möchte',
    unitType: 'verb',
    vocabTerms: ['ich möchte', 'sie möchte', 'möchten', 'would like', 'conditional', 'gerne', 'ich möchte kaufen', 'ich möchte essen', 'bitte', 'Konjunktiv II'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich möchte" — I would like. It is the polite, conditional form. More polite than ich will. Say: ich möchte, sie möchte.',
        studentAction: 'Repeat ich möchte and sie möchte.',
        teacherHint: 'Möchten is technically Konjunktiv II of mögen, but it functions as a standalone polite modal. Contrast: ich will (I want — direct) vs ich möchte (I would like — polite). Highly useful for ordering food, making requests.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a polite request or wish. Read: Ich möchte einen Kaffee. Ich möchte bitte bezahlen. Your turn.',
        studentAction: 'Read each möchten sentence with image.',
        teacherHint: 'Great vocabulary context: restaurant, shopping, hotel. Ich möchte zahlen / ein Zimmer / eine Tasse Tee. High practical value.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — what would each person like?',
        studentAction: 'Combine subject + möchte + noun/infinitive.',
        teacherHint: 'Mix noun objects (ich möchte einen Kaffee) and infinitive completions (ich möchte kaufen). Both patterns are frequent.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was möchten Sie bestellen? What would you like to order? Answer with ich möchte.',
        studentAction: 'Produce a polite ich möchte sentence in a restaurant or service context.',
        teacherHint: 'Restaurant context works beautifully here. Extend: und was möchte Ihr Freund / Ihre Freundin?',
      },
    ],
  },

  // ─── Gehen im Perfekt — Ich bin gegangen ─────────────────────────────────
  {
    contentKey: 'i went german',
    language: 'german',
    displayName: 'Ich bin gegangen — Gehen im Perfekt',
    unitType: 'preterite',
    vocabTerms: ['ich bin gegangen', 'sie ist gegangen', 'sein auxiliary', 'gegangen', 'movement verbs', 'Perfekt with sein', 'ich bin gefahren', 'ich bin gelaufen', 'wohin bist du gegangen'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich bin gegangen" — I went. Movement verbs use SEIN as the Perfekt auxiliary, not haben. Say: ich bin gegangen, sie ist gegangen.',
        studentAction: 'Repeat ich bin gegangen and sie ist gegangen.',
        teacherHint: 'The sein/haben auxiliary split is the critical concept: verbs of motion and change-of-state use sein. Gehen → gegangen / fahren → gefahren / laufen → gelaufen. This is a paradigm shift from haben-based Perfekt.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a journey or movement. Read: Ich bin ins Kino gegangen. Sie ist nach Hause gegangen. Your turn.',
        studentAction: 'Read each sein + gegangen sentence with image.',
        teacherHint: 'Reinforce that sein replaces haben for movement. Students who say "ich habe gegangen" are applying the wrong auxiliary. This is one of the most drilled correction points in German.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who went where?',
        studentAction: 'Combine subject + bin/ist + destination + gegangen.',
        teacherHint: 'gegangen goes to the end. Contrast with ich habe + object + gekauft to keep the two patterns distinct.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Wohin bist du gestern gegangen? Where did you go yesterday? Answer with ich bin... gegangen.',
        studentAction: 'Produce: Ich bin + destination + gegangen.',
        teacherHint: 'Personalize. Any accurate sein + gegangen sentence. Extend with other sein-verbs if students are ready: Ich bin... gefahren / gelaufen.',
      },
    ],
  },

  // ─── Futur I — Ich werde gehen ────────────────────────────────────────────
  {
    contentKey: 'future i german',
    language: 'german',
    displayName: 'Futur I — Ich werde gehen',
    unitType: 'verb',
    vocabTerms: ['ich werde gehen', 'sie wird gehen', 'Futur I', 'werden', 'future tense', 'infinitiv am Ende', 'morgen', 'bald', 'nächste Woche', 'werden + Infinitiv'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: 'Futur I: werden + infinitive at end. "Ich werde gehen" — I will go. Say: ich werde gehen, sie wird gehen.',
        studentAction: 'Repeat ich werde gehen and sie wird gehen.',
        teacherHint: 'Futur I is formed with werden conjugated + infinitive at end. Contrast with the near-future preview from order 6 — now drilling full Futur I with motion verbs.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a future plan. Read: Ich werde ins Kino gehen. Sie wird morgen arbeiten. Your turn.',
        studentAction: 'Read each Futur I sentence with image.',
        teacherHint: 'Time expressions strengthen the future reading: morgen, bald, nächste Woche, am Wochenende. Use them in the model sentences.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — subject + werden + time/place + infinitive at end.',
        studentAction: 'Combine all three columns into a Futur I sentence.',
        teacherHint: 'Three-column combinator: subject / werden form / infinitive at end. Make sure infinitive stays at end.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was wirst du nächstes Wochenende machen? What will you do next weekend? Answer with ich werde.',
        studentAction: 'Produce: Ich werde + infinitive for a real plan.',
        teacherHint: 'Accept any accurate Futur I sentence. Extend: und was wird deine Familie machen?',
      },
    ],
  },

  // ─── 3. Person Futur — Sie wird gehen ────────────────────────────────────
  {
    contentKey: 'she will go german',
    language: 'german',
    displayName: 'Sie wird + Infinitiv — 3. Person Futur',
    unitType: 'verb',
    vocabTerms: ['sie wird', 'er wird', 'er wird gehen', 'sie wird kaufen', 'third person future', 'er/sie/es wird', 'werden', 'was wird er machen', 'narration'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Er wird" / "Sie wird" — he/she will. Third person Futur I. Say: er wird, sie wird.',
        studentAction: 'Repeat er wird and sie wird.',
        teacherHint: 'Third person singular wird is the same for er/sie/es — all three use wird. This unit builds third-person narration in the future: what will he/she do?',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Narrate what each person will do. Read: Er wird morgen arbeiten. Sie wird einkaufen gehen. Your turn.',
        studentAction: 'Read each third-person Futur I sentence.',
        teacherHint: 'Narration context: talking about friends, family, teachers. Was wird dein Lehrer morgen machen? Good conversational frame.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — what will each person do?',
        studentAction: 'Combine er/sie + wird + infinitive for narration.',
        teacherHint: 'Mix er and sie to prevent lockout on one pronoun. Keep the infinitive at end as the consistent frame.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was wird dein bester Freund am Wochenende machen? What will your best friend do this weekend? Answer with er/sie wird.',
        studentAction: 'Produce: Er/Sie wird + infinitive about a real person.',
        teacherHint: 'This personalizes the third-person narration. Any accurate wird + infinitive is the goal.',
      },
    ],
  },

  // ─── Machen im Perfekt — Was hat er gemacht? ─────────────────────────────
  {
    contentKey: 'what did he do german',
    language: 'german',
    displayName: 'Was hat er gemacht? — Machen im Perfekt',
    unitType: 'preterite',
    vocabTerms: ['was hat er gemacht', 'er hat gemacht', 'gemacht', 'machen', 'past question', 'was hast du gemacht', 'Perfekt question', 'er hat gegessen', 'er hat gespielt', 'narrate the past'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Was hat er gemacht?" — What did he do? "Er hat gemacht" — he did/made. Machen is a regular weak verb: ge-macht. Say: was hat er gemacht, er hat gemacht.',
        studentAction: 'Repeat was hat er gemacht and er hat gemacht.',
        teacherHint: 'This question frame is the workhorse of past-tense narration in German. Was hat er gemacht? opens up any Perfekt story. Machen → gemacht is the prototype weak Perfekt.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a past action. Ask and answer: Was hat er gemacht? — Er hat Fußball gespielt. Your turn.',
        studentAction: 'Read each Q-and-A pair in the past.',
        teacherHint: 'Use a variety of strong and weak past participles in the answers: gespielt, gegessen, gelesen, geschrieben — all answering was hat er/sie gemacht?',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who did what? Narrate from the columns.',
        studentAction: 'Combine er/sie hat + past participle from column.',
        teacherHint: 'Mix haben-Perfekt verbs here. This is a great review drill for all Perfekt learned so far.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was hat dein Lehrer / deine Lehrerin heute gemacht? Answer with er/sie hat... gemacht.',
        studentAction: 'Produce a third-person past-tense narration from real life.',
        teacherHint: 'Personalize freely. Any accurate Perfekt sentence in third person is the goal.',
      },
    ],
  },

  // ─── Haben im Präteritum — Er hatte ─────────────────────────────────────
  {
    contentKey: 'he had german',
    language: 'german',
    displayName: 'Er hatte — Haben im Präteritum',
    unitType: 'imperfect',
    vocabTerms: ['er hatte', 'sie hatte', 'ich hatte', 'Präteritum', 'imperfect', 'hatten', 'hatte keine', 'er hatte Hunger', 'er hatte Zeit', 'simple past'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Er hatte" — he had. This is the Präteritum (simple past) of haben. Very common in writing and narration. Say: er hatte, ich hatte.',
        studentAction: 'Repeat er hatte and ich hatte.',
        teacherHint: 'Haben and sein use Präteritum even in spoken German — unlike other verbs which use Perfekt in speech. Er hatte and war are the two most important Präteritum forms to master.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows something someone had in the past. Read: Er hatte Hunger. Sie hatte keine Zeit. Ich hatte Angst. Your turn.',
        studentAction: 'Read each hatte sentence with image.',
        teacherHint: 'Focus on feeling/state expressions: Hunger, Durst, Zeit, Angst, Glück, keine Lust. These are the highest-frequency hatte contexts.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who had what in the past?',
        studentAction: 'Combine subject + hatte + noun (state or object).',
        teacherHint: 'Mix positive and negative: er hatte Zeit / er hatte keine Zeit. The negative pattern keine + noun is essential.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Hattest du gestern Zeit? Did you have time yesterday? Answer with ich hatte / ich hatte keine.',
        studentAction: 'Produce: Ich hatte + noun / Ich hatte keine + noun.',
        teacherHint: 'Personalize. Any accurate hatte sentence — especially with feelings and states — is excellent.',
      },
    ],
  },

  // ─── Dativobjektpronomen — Ihm / Ihr ─────────────────────────────────────
  {
    contentKey: 'dative pronoun german',
    language: 'german',
    displayName: 'Ihm / Ihr — Dativobjektpronomen',
    unitType: 'object_pronoun',
    vocabTerms: ['ihm', 'ihr', 'ihnen', 'dative pronoun', 'indirect object', 'ich gebe ihm', 'ich schreibe ihr', 'wem', 'zu wem', 'to him to her'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ihm" — to him. "Ihr" — to her. These replace a dative noun (the indirect object). Say: ich gebe ihm, ich schreibe ihr.',
        studentAction: 'Repeat ihm and ihr in a sentence.',
        teacherHint: 'Ihm and ihr are dative pronouns — they replace "dem Mann/der Frau" etc. in the dative position. Compare to French lui: one form covers both genders in French; in German ihm=him, ihr=her.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows giving, writing, or speaking to someone. Read: Ich gebe ihm das Buch. Ich schreibe ihr eine Nachricht. Your turn.',
        studentAction: 'Read each ihm/ihr sentence with image.',
        teacherHint: 'Verbs that take dative: geben, schreiben, sagen, zeigen, helfen, danken. Drill the most common ones. The pronoun comes right after the conjugated verb.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who gives/writes/says what to whom?',
        studentAction: 'Combine verb + ihm/ihr + object.',
        teacherHint: 'Reinforce ihm (masculine/neuter dative) vs ihr (feminine dative). This distinction is the key learning. Mix the verbs for variety.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Wem hast du zuletzt eine Nachricht geschrieben? To whom did you last write a message? Answer with ich habe ihm/ihr geschrieben.',
        studentAction: 'Produce: Ich habe + ihm/ihr + geschrieben.',
        teacherHint: 'Personalize. Any accurate dative pronoun sentence. Extend: was hast du ihm/ihr gesagt?',
      },
    ],
  },

  // ─── Es ist sauber / Es ist schmutzig ────────────────────────────────────
  {
    contentKey: 'its clean dirty german',
    language: 'german',
    displayName: 'Es ist sauber / Es ist schmutzig — Beschreibungen',
    unitType: 'ser_estar',
    vocabTerms: ['es ist sauber', 'es ist schmutzig', 'sauber', 'schmutzig', 'ordentlich', 'unordentlich', 'ist das sauber', 'wie ist das Zimmer', 'description adjectives'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Es ist sauber" — it is clean. "Es ist schmutzig" — it is dirty. Say them as opposites: sauber, schmutzig.',
        studentAction: 'Repeat es ist sauber and es ist schmutzig.',
        teacherHint: 'This unit extends sein to adjective descriptions of things. Expand to ordentlich (tidy), unordentlich (messy), neu (new), alt (old), groß (big), klein (small).',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows a room or object. Describe it: Das Zimmer ist sauber. Der Tisch ist schmutzig. Your turn.',
        studentAction: 'Describe each image with sein + adjective.',
        teacherHint: 'Predicate adjective after sein takes NO inflection — Das Zimmer ist sauber (not sauberes). This is a critical rule. Flag any inflected predicative adjectives.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — describe items in the classroom or school.',
        studentAction: 'Combine noun subject + ist + adjective description.',
        teacherHint: 'Use classroom vocabulary as the nouns: das Klassenzimmer, der Schreibtisch, das Heft, die Tafel. Rich context for real-life description.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Wie ist dein Zimmer zu Hause — sauber oder schmutzig? How is your room at home? Answer honestly with es ist / mein Zimmer ist.',
        studentAction: 'Produce a personal description of a room or space.',
        teacherHint: 'Students love this question — it generates honest, personal answers. Accept any accurate sein + adjective sentence.',
      },
    ],
  },

  // ─── Lernen im Perfekt — Ich habe gelernt ────────────────────────────────
  {
    contentKey: 'i studied german',
    language: 'german',
    displayName: 'Ich habe gelernt — Lernen im Perfekt',
    unitType: 'preterite',
    vocabTerms: ['ich habe gelernt', 'sie hat gelernt', 'gelernt', 'lernen', 'studied', 'learned', 'Schule', '-er Verben Perfekt', 'ich habe gemacht', 'regular weak Perfekt'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich habe gelernt" — I studied / I learned. Lernen → gelernt. Regular weak Perfekt: ge + lern + t. Say: ich habe gelernt.',
        studentAction: 'Repeat ich habe gelernt.',
        teacherHint: 'This consolidates the regular weak Perfekt pattern (ge + stem + t) for -en verbs related to school and learning. Lernen / spielen / machen / kochen — all follow this pattern.',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows studying or learning. Read: Ich habe für den Test gelernt. Sie hat Gitarre gespielt. Your turn.',
        studentAction: 'Read each gelernt sentence with image.',
        teacherHint: 'School context works well: Ich habe Mathe gelernt / Deutsch gelernt / viel gelernt. Reinforce ge + stem + t pattern.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who studied what?',
        studentAction: 'Combine subject + habe/hat + subject studied + gelernt.',
        teacherHint: 'Mix school subjects: Mathematik, Deutsch, Geschichte, Biologie, Englisch. All take gelernt.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was hast du heute in der Schule gelernt? What did you learn in school today? Answer with ich habe... gelernt.',
        studentAction: 'Produce a genuine ich habe... gelernt sentence.',
        teacherHint: 'Personalize. Any school subject + gelernt works. Great daily reflection question.',
      },
    ],
  },

  // ─── Bekommen im Perfekt — Ich habe bekommen ──────────────────────────────
  {
    contentKey: 'i received german',
    language: 'german',
    displayName: 'Ich habe bekommen — Bekommen im Perfekt',
    unitType: 'preterite',
    vocabTerms: ['ich habe bekommen', 'sie hat bekommen', 'bekommen', 'received', 'got', 'ich habe eine E-Mail bekommen', 'ich habe ein Geschenk bekommen', 'irregular Perfekt', 'stark'],
    steps: [
      {
        stepIndex: 0,
        stepName: 'anchor',
        verbalInstruction: '"Ich habe bekommen" — I received / I got. Bekommen → bekommen (same form — separable prefix does not add ge-). Say: ich habe bekommen.',
        studentAction: 'Repeat ich habe bekommen.',
        teacherHint: 'Bekommen is a compound verb with prefix be-. Compound verbs with inseparable prefixes (be-, ver-, ent-, emp-, ge-, zer-) do NOT add ge- in the Perfekt. Bekommen → bekommen (not gebekommen).',
      },
      {
        stepIndex: 1,
        stepName: 'model_sentences',
        verbalInstruction: 'Each image shows receiving something. Read: Ich habe eine E-Mail bekommen. Sie hat ein Geschenk bekommen. Your turn.',
        studentAction: 'Read each bekommen sentence with image.',
        teacherHint: 'Good vocabulary: eine E-Mail, ein Brief, ein Paket, ein Geschenk, eine Nachricht, gute Noten. All common objects for bekommen.',
      },
      {
        stepIndex: 2,
        stepName: 'combinator',
        verbalInstruction: 'Column drill — who received what?',
        studentAction: 'Combine subject + habe/hat + accusative object + bekommen.',
        teacherHint: 'Reinforce no ge- prefix rule. If students say "gebekommen" — correct it clearly. This inseparable prefix rule covers many common verbs: verstehen, vergessen, erklären.',
      },
      {
        stepIndex: 3,
        stepName: 'qa_pivot',
        verbalInstruction: 'Was hast du heute bekommen? What did you receive today? Answer with ich habe... bekommen.',
        studentAction: 'Produce: Ich habe + object + bekommen.',
        teacherHint: 'Personalize. Ich habe eine gute Note bekommen / eine Nachricht bekommen. Any accurate sentence works.',
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

// ─────────────────────────────────────────────────────────────────────────────
// JAPANESE UNITS
// ─────────────────────────────────────────────────────────────────────────────

const JAPANESE_UNITS: MadrigalLoopUnit[] = [

  {
    contentKey: 'where are you going japanese',
    language: 'japanese',
    displayName: '行きます — どこに行きますか？',
    unitType: 'verb',
    vocabTerms: ['行きます', '行きません', 'いきます', 'ikimasu', 'I go', 'going', 'どこに', 'に', 'へ', 'hotel', 'school', 'restaurant'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"行きます" — I go / I am going. "どこに行きますか" — Where are you going? Say them: い・き・ます.', studentAction: 'Repeat 行きます and 行きません.', teacherHint: 'Introduce the に/へ particle for direction. 学校に行きます. Both に and へ work here — に is more common in modern speech.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a destination. Read: ホテルに行きます — I am going to the hotel. コンビニに行きます. Your turn.', studentAction: 'Read each sentence aloud, using the image as a hook.', teacherHint: 'Listen for the に particle after the destination. Students may want to say ホテルへ — accept it but model に.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Eyes across the columns — who is going where? Combine: subject + destination + に行きます.', studentAction: 'Build sentences rapidly from the columns.', teacherHint: 'Keep pace fast. Any correct に行きます sentence is a win at this stage.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'どこに行きますか？ — Where are you going? Answer with ～に行きます.', studentAction: 'Produce: [destination]に行きます.', teacherHint: 'Extend: 友達はどこに行きますか？ — push third-person 行きます (no change in polite form).' },
    ],
  },

  {
    contentKey: 'i took japanese',
    language: 'japanese',
    displayName: '取りました — 強い動詞の過去形',
    unitType: 'preterite',
    vocabTerms: ['取りました', 'とりました', 'torimashita', 'I took', 'た形', 'past tense', '取ります', '飲みました', '食べました', '見ました'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"取りました" — I took. The た-form is the Japanese past tense. 取ります → 取りました. Say it: と・り・ま・し・た.', studentAction: 'Repeat 取りました. Notice the ました ending.', teacherHint: '〜ます → 〜ました is the standard polite past pattern. All Group 1 verbs follow this. Students need to see it as a suffix swap.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images of past actions. 傘を取りました — I took the umbrella. タクシーを取りました. Read each one.', studentAction: 'Read the past-tense sentences using を particle for the object.', teacherHint: 'Introduce を as the object marker naturally here. Do not over-explain — let the pattern speak.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Mix subjects and objects — who took what? Use ました for everything.', studentAction: 'Combine subject + object + を + 取りました.', teacherHint: 'Consistent ました across subjects in polite form is the key insight. No conjugation changes for subject.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '何を取りましたか？ — What did you take? Answer with ～を取りました.', studentAction: 'Produce: [object]を取りました.', teacherHint: 'Personalize: 昨日何を取りましたか？ Keep it conversational.' },
    ],
  },

  {
    contentKey: 'i bought japanese',
    language: 'japanese',
    displayName: '買いました — 弱い動詞の過去形',
    unitType: 'preterite',
    vocabTerms: ['買いました', 'かいました', 'kaimashita', 'I bought', '買います', 'weak verb', '食べました', '飲みました', '読みました'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"買いました" — I bought. 買います → 買いました. The ます → ました swap again. Say it.', studentAction: 'Repeat 買いました and note the pattern.', teacherHint: 'This is the same ました suffix. Reinforce: ます = present/future, ました = past. Clean and consistent in polite speech.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images of things purchased. 本を買いました — I bought a book. 靴を買いました. Read each.', studentAction: 'Read shopping sentences with を + 買いました.', teacherHint: 'Natural context: shopping. High-frequency verbs nearby: 食べました, 飲みました, 読みました — all same pattern.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who bought what? Scan the columns fast.', studentAction: 'Build: [person] + [item]を + 買いました.', teacherHint: 'Mix subjects freely. Polite form stays identical regardless of person — that is the elegant simplicity here.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '何を買いましたか？ — What did you buy? Answer freely.', studentAction: 'Produce: [item]を買いました.', teacherHint: '昨日どこで買いましたか — layer in location question if ready.' },
    ],
  },

  {
    contentKey: 'i am going to japanese',
    language: 'japanese',
    displayName: '行くつもりです — 近未来 (Intent)',
    unitType: 'verb',
    vocabTerms: ['行くつもりです', 'つもりです', 'I plan to', 'near future', '〜するつもり', '行く', '食べるつもり', '勉強するつもり'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"行くつもりです" — I plan to go / I am going to go. つもりです attaches to the dictionary form. Say: い・く・つ・も・り・で・す.', studentAction: 'Repeat 行くつもりです.', teacherHint: 'Dictionary form + つもりです. This is intent. For immediate future, Japanese also uses ます-form; つもりです implies deliberate plan.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '東京に行くつもりです — I plan to go to Tokyo. 映画を見るつもりです. Read each.', studentAction: 'Read intent sentences with dictionary-form + つもりです.', teacherHint: 'Dictionary form before つもり: 行く, 食べる, 見る, 勉強する. Make sure students use dict. form, not ます-form.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What is each person planning to do? Combine freely.', studentAction: 'Build: [person] + [action-dict.form] + つもりです.', teacherHint: 'Check dictionary form throughout. する-compounds are common here: 勉強するつもり, 料理するつもり.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '週末何をするつもりですか？ — What are you planning to do this weekend?', studentAction: 'Produce: [activity]つもりです.', teacherHint: 'Natural question: この夏どこに行くつもりですか？ Let students express real plans.' },
    ],
  },

  {
    contentKey: 'i have japanese',
    language: 'japanese',
    displayName: '持っています — 所有 (Possession)',
    unitType: 'verb',
    vocabTerms: ['持っています', 'もっています', 'motteimasu', 'I have', 'possession', 'ある', 'あります', '～があります', 'have'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"持っています" — I have (I am holding/carrying). "～があります" — I have (existence). Two ways to have in Japanese. Say: も・っ・て・い・ます.', studentAction: 'Repeat 持っています and ～があります.', teacherHint: '持っています = carry/own (a physical thing you carry around). があります = own/there-exists. Overlap is fine — both are correct for many objects.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'かさを持っています — I have an umbrella. 犬がいます — I have a dog. Read each with its correct form.', studentAction: 'Read possession sentences distinguishing 持っています vs あります/います.', teacherHint: 'Animals and people → います. Objects → あります. Portable objects → 持っています. Quick rule of thumb.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What do these people have? Combine subject + object + possession form.', studentAction: 'Build possession sentences rapidly.', teacherHint: 'Accept both 持っています and があります for objects. Correct がいます for living things gently.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'ペットを持っていますか？ — Do you have a pet? Answer with 持っています or います.', studentAction: 'Produce: はい、[pet]がいます or いいえ、いません.', teacherHint: 'Flip to negative: 持っていません / いません. Perfect yes/no pair.' },
    ],
  },

  {
    contentKey: 'i want japanese',
    language: 'japanese',
    displayName: 'したいです — 願望 (Desire)',
    unitType: 'verb',
    vocabTerms: ['〜たいです', 'したいです', 'I want to', 'desire', '食べたい', '行きたい', 'want', '欲しいです', 'hoshii'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"食べたいです" — I want to eat. Verb stem + たいです. Say: た・べ・た・い・で・す.', studentAction: 'Repeat 食べたいです and 行きたいです.', teacherHint: 'Stem + たい. For Group 1: 飲む → 飲みたい. For Group 2: 食べる → 食べたい. Elegant: drop る, add たい.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'ピザを食べたいです — I want to eat pizza. 日本に行きたいです. Read each.', studentAction: 'Read desire sentences with stem + たいです.', teacherHint: '欲しいです is for nouns (I want a car — 車が欲しい). たい is for actions (I want to do). Important distinction.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person want to do? Scan and combine.', studentAction: 'Build: [person] + [verb-stem] + たいです.', teacherHint: 'Common mistakes: using ます-form before たい (飲みますたい ✗). Stem only: 飲みたい ✓.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '何が食べたいですか？ — What do you want to eat? Answer freely.', studentAction: 'Produce: [food/activity]たいです.', teacherHint: '今一番したいことは何ですか？ — stretch question for strong students.' },
    ],
  },

  {
    contentKey: 'i am identity japanese',
    language: 'japanese',
    displayName: 'です — 存在と性質 (Identity)',
    unitType: 'ser_estar',
    vocabTerms: ['です', 'desu', 'I am', 'identity', 'です', 'じゃないです', 'ではありません', '学生です', '日本人'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"私は学生です" — I am a student. です is the polite copula — it identifies what something is. Say: で・す.', studentAction: 'Repeat 私は学生です and 私は田中です.', teacherHint: 'は marks the topic. Noun + です = identity. This is the Japanese equivalent of "to be" for classification.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '私は先生です — I am a teacher. これは犬です — This is a dog. Read each statement.', studentAction: 'Read identity sentences with は + noun + です.', teacherHint: 'Contrast: です (affirmative) vs じゃないです / ではありません (negative). Both negatives are valid; じゃないです is conversational.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who is what? Match subjects with roles and identities.', studentAction: 'Build: [topic]は + [noun] + です.', teacherHint: 'Mix in じゃないです for variety. 私は医者じゃないです — I am not a doctor.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'あなたは学生ですか？ — Are you a student? Answer yes or no.', studentAction: 'Produce: はい、学生です / いいえ、学生じゃないです.', teacherHint: 'Yes/no question formed by adding か to です. Drill the minimal pair.' },
    ],
  },

  {
    contentKey: 'where am i japanese',
    language: 'japanese',
    displayName: 'どこにいますか — 場所 (Location)',
    unitType: 'ser_estar',
    vocabTerms: ['います', 'あります', 'どこに', 'location', 'に', 'school', 'house', 'いる', 'ある', 'います'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"学校にいます" — I am at school. います for living things, あります for objects/places. Say: に・い・ま・す.', studentAction: 'Repeat 学校にいます and 机の上にあります.', teacherHint: 'に marks location. います (animate) vs あります (inanimate location). Both describe where something/someone IS, not what it IS.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '図書館にいます — I am at the library. 本は机の上にあります. Read each.', studentAction: 'Read location sentences with に + います/あります.', teacherHint: 'Introduce positional nouns: 上 (above), 下 (below), 中 (inside), 前 (front), 後ろ (back). Common location vocab.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Where is each person or object? Combine rapidly.', studentAction: 'Build: [person/object] + は + [location]に + います/あります.', teacherHint: 'Common error: using います for objects. Correct kindly — point to the animate/inanimate rule.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'どこにいますか？ — Where are you? Answer with [場所]にいます.', studentAction: 'Produce: [location]にいます.', teacherHint: '今どこにいますか？ Let students describe their real location.' },
    ],
  },

  {
    contentKey: 'i can japanese',
    language: 'japanese',
    displayName: 'できます — 能力 (Ability)',
    unitType: 'verb',
    vocabTerms: ['できます', 'できません', 'dekimasu', 'I can', 'ability', '〜ができます', '泳げます', '話せます', 'potential form'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"日本語ができます" — I can speak Japanese. Noun + ができます = ability with a noun. Say: で・き・ま・す.', studentAction: 'Repeat 日本語ができます and 料理ができます.', teacherHint: 'Two patterns: noun + ができます (most common at this level) and potential verb form (話せます, 泳げます). Introduce both.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '泳ぐことができます — I can swim. ピアノが弾けます. Read each ability statement.', studentAction: 'Read ability sentences with ができます and potential forms.', teacherHint: 'こと + ができます = ability with a verb phrase. More formal. Potential form (〜える/られる) is more concise.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What can each person do? Combine subject + skill + ができます.', studentAction: 'Build ability sentences rapidly.', teacherHint: 'High-frequency: 日本語ができます, 料理ができます, 運転ができます. Drill these core phrases.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '何ができますか？ — What can you do? Answer with ～ができます.', studentAction: 'Produce: [skill]ができます.', teacherHint: '何が一番得意ですか？ — What are you best at? Stretch question.' },
    ],
  },

  {
    contentKey: 'the verb pattern japanese',
    language: 'japanese',
    displayName: 'ます形パターン — 動詞フレーム',
    unitType: 'verb',
    vocabTerms: ['ます', 'ません', 'ました', 'ませんでした', 'polite form', 'masu', 'verb group', 'Group 1', 'Group 2', '活用'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: 'The ます-frame: ます (present/future), ません (negative), ました (past), ませんでした (past negative). Say them all.', studentAction: 'Repeat all four ます-form conjugations.', teacherHint: 'This is the master frame. All polite-form verbs follow this pattern. Students who own this frame can handle any new verb.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '食べます、食べません、食べました、食べませんでした. Run through all four forms for each verb shown.', studentAction: 'Produce all four forms for each verb image.', teacherHint: 'Drill at least 5 verbs: 食べる, 飲む, 行く, 見る, 話す. Students must be automatic before moving on.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Mix times and polarities. Scan the columns — positive or negative, past or present?', studentAction: 'Combine subject + verb + ます-form ending rapidly.', teacherHint: 'Check the ending each time. Common error: ませんした (mixing patterns). Model: ませんでした.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '昨日、何を食べましたか？ — Answer in positive. 何を飲みませんでしたか？ — Answer in negative.', studentAction: 'Produce both positive and negative past-tense answers.', teacherHint: 'Mix present and past questions. Students need to select the correct form under communication pressure.' },
    ],
  },

  {
    contentKey: 'there is japanese',
    language: 'japanese',
    displayName: 'あります / います — 存在 (There Is)',
    unitType: 'hay_gustar',
    vocabTerms: ['あります', 'います', 'arimasu', 'imasu', 'there is', 'there are', 'existence', 'ない', 'いない', 'いません'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"本があります" — There is a book. "猫がいます" — There is a cat. が marks what exists. Inanimate → あります, animate → います.', studentAction: 'Repeat 本があります and 猫がいます.', teacherHint: 'が is the existence marker here, not は. Students will want to use は. Gently reinforce が with existence verbs.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '教室に机がたくさんあります — There are many desks in the classroom. 公園に子供がいます. Read each.', studentAction: 'Read existence sentences with location + に + subject + が + あります/います.', teacherHint: 'Full pattern: [location]に + [thing]が + あります/います. This covers spatial descriptions efficiently.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What is where? Combine location + thing + exists.', studentAction: 'Build existence sentences from the columns.', teacherHint: 'Negatives: ありません and いません. Drill both — useful immediately for real communication.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '家に何がありますか？ — What is in your house? Answer with ～があります.', studentAction: 'Produce: 家に[thing]があります.', teacherHint: 'Extend: 教室に誰がいますか？ — animate version with person as subject.' },
    ],
  },

  {
    contentKey: 'i like japanese',
    language: 'japanese',
    displayName: '～が好きです — 好み (Preference)',
    unitType: 'hay_gustar',
    vocabTerms: ['好きです', 'すきです', 'suki desu', 'I like', 'preference', 'が好き', '嫌いです', 'kirai', '大好きです'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"音楽が好きです" — I like music. が marks what you like. Say: が・す・き・で・す.', studentAction: 'Repeat 音楽が好きです and 映画が好きじゃないです.', teacherHint: 'Like Spanish gustar, the "liked thing" takes が here, not を. This is a key structural difference from English.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a preference. 猫が好きです — I like cats. 野菜が嫌いです — I dislike vegetables. Read each.', studentAction: 'Read preference sentences with が好きです and が嫌いです.', teacherHint: 'Spectrum: 大好きです (love) → 好きです (like) → 好きじゃないです (don\'t like) → 嫌いです (dislike/hate).' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person like or dislike? Scan the columns.', studentAction: 'Build: [person] + [thing]が + 好きです/嫌いです.', teacherHint: 'Push 大好きです for strong positives. Students enjoy expressing real preferences.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '何の音楽が好きですか？ — What kind of music do you like? Answer with ～が好きです.', studentAction: 'Produce a preference statement about something real.', teacherHint: '私は[X]が好きですが、[Y]はあまり好きじゃないです — contrast pair for advanced students.' },
    ],
  },

  {
    contentKey: 'i would like japanese',
    language: 'japanese',
    displayName: '～たいと思います — 丁寧な願望 (I Would Like)',
    unitType: 'verb',
    vocabTerms: ['〜たいと思います', 'ほしいです', 'polite desire', 'I would like', '〜たい', 'conditional', 'want politely'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"コーヒーをいただけますか" — Could I have coffee? "行きたいと思います" — I think I would like to go. Softer than たいです. Say them.', studentAction: 'Repeat 行きたいと思います and いただけますか.', teacherHint: '〜たいと思います is more polished than 〜たいです — adds conjecture distance, which in Japanese culture signals politeness. いただけますか is formal request.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Register shift: 食べたいです (casual) → 食べたいと思います (polite) → 食べていただけますか (formal). Read each pair.', studentAction: 'Read desire statements at different politeness levels.', teacherHint: 'Three-level register drill is the core insight here. Same meaning, rising formality.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What would each person like to do? Use the polite want form.', studentAction: 'Build: [person] + [action-stem] + たいと思います.', teacherHint: 'Situation-dependent: casual context → たいです, business/formal → たいと思います / いただけますか.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '来年何をしたいと思いますか？ — What would you like to do next year?', studentAction: 'Produce a polite desire statement about a real aspiration.', teacherHint: '日本に行きたいと思います — cue travelers. Connect to students\' actual goals.' },
    ],
  },

  {
    contentKey: 'i went japanese',
    language: 'japanese',
    displayName: '行きました — 過去の行動 (I Went)',
    unitType: 'preterite',
    vocabTerms: ['行きました', 'いきました', 'ikimashita', 'I went', 'past motion', '来ました', 'came', '帰りました', '旅行しました'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"行きました" — I went. 行きます → 行きました. The ました past again. Say it.', studentAction: 'Repeat 行きました and 来ました.', teacherHint: '行きました (went away from speaker), 来ました (came toward speaker), 帰りました (returned). This triplet is very high-frequency.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '東京に行きました — I went to Tokyo. 昨日学校に来ました. Read each past-motion sentence.', studentAction: 'Read past motion with に + 行きました/来ました.', teacherHint: 'Time words: 昨日 (yesterday), 先週 (last week), 先月 (last month). Natural context for past narration.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Where did each person go or come from? Mix destinations and directions.', studentAction: 'Build past-motion sentences with ました forms.', teacherHint: 'Contrast 行きました vs 来ました from the speaker\'s perspective — this is a key concept in Japanese.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '先週末どこに行きましたか？ — Where did you go last weekend?', studentAction: 'Produce: [time] + [place]に行きました.', teacherHint: '楽しかったですか？ — follow-up with 〜かった past adjective naturally.' },
    ],
  },

  {
    contentKey: 'he is going to japanese',
    language: 'japanese',
    displayName: '行くつもりです（3人称） — 彼は行くつもりです',
    unitType: 'verb',
    vocabTerms: ['行くつもりです', '3人称', 'third person', '彼は', '彼女は', 'narration', '〜するつもりです'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"彼は行くつもりです" — He plans to go. Same つもりです, now with 彼/彼女. Say it.', studentAction: 'Repeat 彼は行くつもりです and 彼女は勉強するつもりです.', teacherHint: 'Japanese polite form does not conjugate for person — つもりです is identical for all. The subject changes; the verb does not.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Narrative sentences about others\' plans. 田中さんは東京に行くつもりです. Read each.', studentAction: 'Read third-person intent sentences.', teacherHint: 'Introduce natural name usage: 田中さんは, 友達は, 兄は. More natural than 彼/彼女 in Japanese.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What are various people planning? Combine subjects and plans.', studentAction: 'Build third-person つもりです sentences.', teacherHint: 'No form changes — reinforce this. Students coming from European languages expect person agreement. Show they don\'t need it here.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'あなたの友達は今年何をするつもりですか？ — What does your friend plan to do this year?', studentAction: 'Produce a third-person intent sentence about someone real.', teacherHint: 'Personalization: discuss real classmates\' plans. Builds authentic output.' },
    ],
  },

  {
    contentKey: 'what did he do japanese',
    language: 'japanese',
    displayName: '何をしましたか — 過去の質問 (Past Questions)',
    unitType: 'preterite',
    vocabTerms: ['何をしましたか', '何をしましたか', 'what did he do', 'past question', '〜ましたか', 'question form', 'か particle'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"何をしましたか" — What did you/he do? か turns any ました sentence into a question. Say: な・に・を・し・ま・し・た・か.', studentAction: 'Repeat 何をしましたか and 何を食べましたか.', teacherHint: 'か is the question particle. Intonation rises slightly. No inversion — word order stays the same. Students love this simplicity.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Question and answer pairs. 何を食べましたか？ — カレーを食べました。Read and answer each pair.', studentAction: 'Read both the question and a natural answer.', teacherHint: 'Model natural answer: drop the subject if understood. 食べました (I ate it) — full sentences only when needed for clarity.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Rapid fire: ask what each person did. Combine 何を + [verb]ましたか.', studentAction: 'Build past-tense questions for different verbs.', teacherHint: 'Extend: いつ、どこで、どのように — layer in question words for richer narration.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '昨日何をしましたか？ — What did you do yesterday? Give a full answer.', studentAction: 'Produce a past narrative about yesterday.', teacherHint: '最初に〜をして、次に〜をして — connect past actions with sequential time markers.' },
    ],
  },

  {
    contentKey: 'he had japanese',
    language: 'japanese',
    displayName: '持っていました — 過去の所有 (He Had)',
    unitType: 'preterite',
    vocabTerms: ['持っていました', 'もっていました', 'he had', 'past possession', 'ありました', 'いました', 'past of aru'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"持っていました" — he had (was holding). 持っています → 持っていました. The past of ている progressive. Say it.', studentAction: 'Repeat 持っていました and ～がありました.', teacherHint: '持っていました (had/was carrying). ありました (there was / existed). Both are past forms used for "had" depending on context.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '彼は傘を持っていました — He had an umbrella. 昔、犬がいました — There was a dog once. Read each.', studentAction: 'Read past possession sentences.', teacherHint: 'Contrast present (持っています) vs past (持っていました). Show the ている → ていました shift clearly.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What did each person or place have in the past? Combine freely.', studentAction: 'Build past possession sentences.', teacherHint: '昔はよく〜がありました — nostalgic framing makes past possession feel natural and meaningful.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '子供の頃、何を持っていましたか？ — What did you have as a child?', studentAction: 'Produce: 子供の頃、[thing]を持っていました.', teacherHint: 'Personal childhood memories create strong memory hooks. Let students share authentically.' },
    ],
  },

  {
    contentKey: 'to him japanese',
    language: 'japanese',
    displayName: '彼に / 彼女に — 間接目的語 (To Him / To Her)',
    unitType: 'object_pronoun',
    vocabTerms: ['に', '彼に', '彼女に', 'dative', 'indirect object', 'に particle', 'あげます', 'くれます', 'もらいます'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"彼に本を渡しました" — I gave the book to him. に is the dative marker — it points to the recipient. Say: か・れ・に.', studentAction: 'Repeat 彼に and 彼女に with a giving verb.', teacherHint: 'に as dative: recipient, destination, time point — all に. This unit focuses on recipient sense. あげる (give upward), くれる (give to me), もらう (receive).' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '友達にプレゼントをあげました — I gave a present to my friend. 先生に手紙を書きました. Read each.', studentAction: 'Read indirect object sentences with recipient + に.', teacherHint: 'The give-receive triangle: あげます (I give to other), くれます (other gives to me), もらいます (I receive from other). Crucial and often confused.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who gave what to whom? Scan the columns and combine.', studentAction: 'Build: [giver] + [recipient]に + [thing]を + あげました/もらいました.', teacherHint: 'Drill the あげる/くれる contrast from the speaker\'s perspective. Real cultural content: giving is central in Japanese social life.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '最近誰かに何かをあげましたか？ — Did you give something to someone recently?', studentAction: 'Produce: [person]に[thing]をあげました.', teacherHint: 'Flip: 誰かに何かをもらいましたか？ — contrast both directions of the giving-receiving pair.' },
    ],
  },

  {
    contentKey: 'clean dirty japanese',
    language: 'japanese',
    displayName: 'きれいです / 汚いです — 形容詞 (Descriptions)',
    unitType: 'verb',
    vocabTerms: ['きれいです', '汚いです', 'kirei', 'kitanai', 'clean', 'dirty', 'adjective', 'い形容詞', 'な形容詞', 'description'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"きれいです" — It is clean / beautiful. "汚いです" — It is dirty. Two adjective types: い (汚い) and な (きれい). Say them.', studentAction: 'Repeat きれいです and 汚いです.', teacherHint: 'きれい looks like an い-adjective but is actually な-adjective: きれいな部屋. 汚い is a true い-adjective: 汚い部屋. This is a classic trick question.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'この部屋はきれいです — This room is clean. あの川は汚いです. Read descriptive sentences.', studentAction: 'Read descriptions with は + adjective + です.', teacherHint: 'Predicate adjective: [topic]は + adj + です. Attributive: adj + noun. Both patterns appear. Focus on predicate here.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Describe each scene — clean or dirty, beautiful or messy? Scan and produce.', studentAction: 'Build descriptive sentences with contrasting adjectives.', teacherHint: 'Extend with more い/な pairs: 大きい/小さい, 新しい/古い, 高い/安い, おいしい/まずい.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'あなたの部屋はきれいですか？ — Is your room clean? Answer honestly.', studentAction: 'Produce: 私の部屋は[adjective]です.', teacherHint: 'あまりきれいじゃないです — the hedged negative is natural and communicates personality. Model it.' },
    ],
  },

  {
    contentKey: 'i studied japanese',
    language: 'japanese',
    displayName: '勉強しました — する動詞の過去形 (I Studied)',
    unitType: 'preterite',
    vocabTerms: ['勉強しました', 'べんきょうしました', 'benkyou shimashita', 'I studied', 'suru verb', '〜しました', '運動しました', '料理しました'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"勉強しました" — I studied. する → しました. The する-verb class: noun + する. Say: べ・ん・き・ょ・う・し・ま・し・た.', studentAction: 'Repeat 勉強しました and 練習しました.', teacherHint: 'The する-compound class is huge: 勉強する, 運動する, 料理する, 仕事する, 掃除する. Once students own する→しました, they unlock all of them.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '3時間勉強しました — I studied for 3 hours. 毎朝運動します. Mix present and past する-verbs.', studentAction: 'Read する-verb sentences in context.', teacherHint: 'Duration with で? No — Japanese uses: [time]間 + verb. 3時間勉強しました (studied for 3 hours). No extra particle needed.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What did each person do (using する-verbs)? Combine rapidly.', studentAction: 'Build: [person] + [noun]を + しました.', teacherHint: 'Drill at minimum: 勉強・料理・掃除・運動・仕事・練習. These cover most daily activities.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '昨日何時間勉強しましたか？ — How many hours did you study yesterday?', studentAction: 'Produce: [N]時間勉強しました.', teacherHint: '何時間運動しましたか？ — extend to other する-verbs naturally.' },
    ],
  },

  {
    contentKey: 'i received japanese',
    language: 'japanese',
    displayName: 'もらいました — 受け取り (I Received)',
    unitType: 'preterite',
    vocabTerms: ['もらいました', 'moraimashita', 'I received', 'もらう', 'くれました', 'あげました', 'giving verbs', 'give receive'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"プレゼントをもらいました" — I received a present. もらう = receive (from someone\'s perspective). Say: も・ら・い・ま・し・た.', studentAction: 'Repeat もらいました and くれました.', teacherHint: 'Triangle review: あげました (I gave to other), くれました (other gave to me), もらいました (I received from other). The perspective shift is everything.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '友達に本をもらいました — I received a book from my friend. お母さんが手作りケーキをくれました. Read each.', studentAction: 'Read giving/receiving pairs focusing on speaker perspective.', teacherHint: 'に after giver with もらう: 友達に/から. Note: から is also acceptable. に is more traditional.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who received what from whom? Combine the giving triangle.', studentAction: 'Build giving/receiving sentences from all three perspectives.', teacherHint: 'Most important drill: same event from two perspectives — もらう vs くれる. Show both.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '誕生日に何をもらいましたか？ — What did you receive on your birthday?', studentAction: 'Produce: [giver]に[thing]をもらいました.', teacherHint: 'Cultural connection: gift-giving is highly ritualized in Japanese culture. Leverage this.' },
    ],
  },

  {
    contentKey: 'i will japanese',
    language: 'japanese',
    displayName: '〜でしょう / 〜と思います — 未来と推量 (Future)',
    unitType: 'verb',
    vocabTerms: ['でしょう', 'と思います', 'I will', 'future', 'conjecture', '〜ます (future)', '明日', '来週', '予定'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"明日行きます" = I will go tomorrow. "行くと思います" = I think I will go. "行くでしょう" = He will probably go. Say all three.', studentAction: 'Repeat all three future/conjecture forms.', teacherHint: 'Japanese uses present ます-form for scheduled future, と思います for personal intention, でしょう for prediction/conjecture. No dedicated future tense.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '来週テストがあります — There is a test next week. きっと雨が降るでしょう — It will probably rain. Read each.', studentAction: 'Read future and conjecture sentences.', teacherHint: 'でしょう signals the speaker\'s prediction/estimation. Native speakers use it constantly for weather, plans, and soft predictions.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Make predictions and plans. Use ます-form for scheduled events, でしょう for predictions.', studentAction: 'Build future statements distinguishing certainty levels.', teacherHint: 'Certainty scale: 来週行きます (certain plan) > 行くと思います (personal intention) > 行くでしょう (probable) > 行くかもしれません (possible).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '来年何をすると思いますか？ — What do you think you will do next year?', studentAction: 'Produce: [plan]と思います.', teacherHint: 'Mix と思います and でしょう for different kinds of predictions. Connect to real student goals.' },
    ],
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// KOREAN UNITS
// ─────────────────────────────────────────────────────────────────────────────

const KOREAN_UNITS: MadrigalLoopUnit[] = [

  {
    contentKey: 'where are you going korean',
    language: 'korean',
    displayName: '가요 — 어디에 가요?',
    unitType: 'verb',
    vocabTerms: ['가요', '가세요', 'I go', '어디에', '에', 'gayo', 'going', 'location particle', '학교에', '집에'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"가요" — I go / I am going. "어디에 가요?" — Where are you going? 에 marks the direction. Say: 가・요.', studentAction: 'Repeat 가요 and 어디에 가요?.', teacherHint: '에 as direction particle after destinations. 학교에 가요 (go to school). Contrast with 에서 (location of action) — keep it simple here, focus on direction.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '학교에 가요 — I go to school. 집에 가요 — I go home. Read each destination sentence.', studentAction: 'Read going sentences with destination + 에 가요.', teacherHint: 'High-frequency destinations: 학교, 집, 도서관, 슈퍼, 병원. All + 에 가요.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who is going where? Scan the columns and combine: subject + destination + 에 가요.', studentAction: 'Build destination sentences rapidly.', teacherHint: 'Polite form 가요 works for all persons without change. Students from European language backgrounds appreciate this.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '어디에 가요? — Where are you going? Answer with [destination]에 가요.', studentAction: 'Produce: [place]에 가요.', teacherHint: '친구는 어디에 가요? — third-person extension. No form change needed.' },
    ],
  },

  {
    contentKey: 'i took korean',
    language: 'korean',
    displayName: '가져갔어요 — 강한 과거형 (I Took)',
    unitType: 'preterite',
    vocabTerms: ['가져갔어요', 'I took', '았어요', '었어요', 'past tense', '갔어요', '먹었어요', '봤어요', 'irregular'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"가져갔어요" — I took. The past tense ending is -았어요 or -었어요. Say: 가・져・갔・어・요.', studentAction: 'Repeat 가져갔어요 and 봤어요.', teacherHint: 'The -았/었어요 past tense: 아/오 stems → 았어요; others → 었어요. 가져가다 is irregular (vowel contraction). Focus on the ending pattern.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '우산을 가져갔어요 — I took the umbrella. 버스를 탔어요 — I took the bus. Read each.', studentAction: 'Read past-tense sentences with 았/었어요.', teacherHint: '을/를 for direct objects. 우산을, 버스를. Reinforce object particle alongside the past-tense pattern.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who took what? Mix subjects and objects with the past form.', studentAction: 'Build: [person] + [object]을/를 + 가져갔어요 / 탔어요.', teacherHint: 'Keep pace fast. The key insight: past form ending is consistent across all polite-speech verbs.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '뭘 가져갔어요? — What did you take? Answer freely.', studentAction: 'Produce: [thing]을/를 가져갔어요.', teacherHint: '어디에서 가져갔어요? — layer in location particle for richer context.' },
    ],
  },

  {
    contentKey: 'i bought korean',
    language: 'korean',
    displayName: '샀어요 — 과거형 (I Bought)',
    unitType: 'preterite',
    vocabTerms: ['샀어요', 'sasseoyo', 'I bought', 'past', '사다', '먹었어요', '마셨어요', '읽었어요', '했어요'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"샀어요" — I bought. 사다 → 샀어요. ㅏ vowel contracts. Say: 샀・어・요.', studentAction: 'Repeat 샀어요 and 먹었어요.', teacherHint: '사다 → 샀어요 involves the ㅏ + 았 contraction to 샀. Point out the vowel merger. Common: 샀어요, 먹었어요, 마셨어요, 읽었어요.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '옷을 샀어요 — I bought clothes. 커피를 마셨어요. Read shopping and purchasing sentences.', studentAction: 'Read past purchase sentences with object + 을/를 + past verb.', teacherHint: 'Consistent pattern: object marker 을/를 + past-tense verb. Very high frequency in daily conversation.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What did each person buy or consume? Scan and combine rapidly.', studentAction: 'Build past-tense sentences with various purchase/consumption verbs.', teacherHint: 'Core set: 샀어요, 먹었어요, 마셨어요, 읽었어요, 봤어요. Drill these five thoroughly.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '어제 뭘 샀어요? — What did you buy yesterday?', studentAction: 'Produce: [item]을/를 샀어요.', teacherHint: '어디서 샀어요? — layer in 에서 location particle for where they bought it.' },
    ],
  },

  {
    contentKey: 'i am going to korean',
    language: 'korean',
    displayName: '갈 거예요 — 근미래 (I Am Going To)',
    unitType: 'verb',
    vocabTerms: ['갈 거예요', 'ㄹ/을 거예요', 'near future', 'I am going to', '먹을 거예요', '갈 거예요', 'intention', 'future'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"갈 거예요" — I am going to go. Verb stem + ㄹ 거예요 (after vowel) or 을 거예요 (after consonant). Say: 갈・거・예・요.', studentAction: 'Repeat 갈 거예요 and 먹을 거예요.', teacherHint: 'ㄹ 거예요 = vowel-ending stems (가다→ 갈, 오다→올). 을 거예요 = consonant-ending stems (먹다→먹을). This is the dominant future form.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '내일 서울에 갈 거예요 — I am going to go to Seoul tomorrow. 저녁에 피자를 먹을 거예요. Read each.', studentAction: 'Read near-future sentences with ㄹ/을 거예요.', teacherHint: 'Time words: 내일 (tomorrow), 이따가 (later), 다음 주 (next week). All work naturally with 거예요.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What are these people going to do? Combine subjects + plans.', studentAction: 'Build future sentences with ㄹ/을 거예요.', teacherHint: 'Check the vowel/consonant rule each time. Frequent error: 먹ㄹ 거예요 ✗. Correct: 먹을 거예요 ✓.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '이번 주말에 뭘 할 거예요? — What are you going to do this weekend?', studentAction: 'Produce: [activity]ㄹ/을 거예요.', teacherHint: 'Real weekend plans. Personalization anchors the grammar to memory.' },
    ],
  },

  {
    contentKey: 'i have korean',
    language: 'korean',
    displayName: '있어요 — 소유와 존재 (I Have / There Is)',
    unitType: 'verb',
    vocabTerms: ['있어요', '없어요', 'isseoyo', 'I have', 'there is', 'possession', 'existence', '가지고 있어요', '이/가 있어요'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"저는 개가 있어요" — I have a dog. "책이 있어요" — There is a book. 있어요 covers both possession and existence. Say: 있・어・요.', studentAction: 'Repeat 있어요 and 없어요.', teacherHint: '이/가 있어요 = possession OR existence. Context determines which. 없어요 = don\'t have / there isn\'t. Clean minimal pair.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '시간이 있어요 — I have time. 교실에 학생들이 있어요 — There are students in the classroom. Read each.', studentAction: 'Read possession and existence sentences.', teacherHint: 'Location: [place]에 + [thing]이/가 + 있어요. This covers both "I have" and "there is" in spatial contexts.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person have? What exists in each place? Combine.', studentAction: 'Build 있어요/없어요 sentences for possession and existence.', teacherHint: 'Push없어요 equally — it is extremely frequent in spoken Korean.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '지금 시간 있어요? — Do you have time right now?', studentAction: 'Produce: 네, 있어요 / 아니요, 없어요.', teacherHint: 'Casual vs polite: 있어? vs 있어요? Show both — students will hear both immediately.' },
    ],
  },

  {
    contentKey: 'i want korean',
    language: 'korean',
    displayName: '하고 싶어요 — 원망 (I Want)',
    unitType: 'verb',
    vocabTerms: ['하고 싶어요', '싶어요', 'I want to', 'desire', '고 싶어요', '먹고 싶어요', '가고 싶어요', 'want'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"먹고 싶어요" — I want to eat. Verb stem + 고 싶어요. Say: 먹・고・싶・어・요.', studentAction: 'Repeat 먹고 싶어요 and 가고 싶어요.', teacherHint: 'Verb stem + 고 싶어요 for any action desire. For noun desires: [noun]이/가 필요해요 (I need) or [noun]이 갖고 싶어요 (I want [noun]).' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '한국에 가고 싶어요 — I want to go to Korea. 삼겹살을 먹고 싶어요. Read desire sentences.', studentAction: 'Read want-sentences with stem + 고 싶어요.', teacherHint: 'Cultural context: Korean food, travel, and entertainment goals. Students love expressing real desires.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person want to do? Build from the columns.', studentAction: 'Combine subjects + desire verb + 고 싶어요.', teacherHint: 'Negative: 고 싶지 않아요. Softer: 고 싶어하다 (she wants — third person desire).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '뭘 먹고 싶어요? — What do you want to eat?', studentAction: 'Produce: [food]을/를 먹고 싶어요.', teacherHint: '제일 가고 싶은 나라가 어디예요? — stretch to travel desires.' },
    ],
  },

  {
    contentKey: 'i am identity korean',
    language: 'korean',
    displayName: '이에요 / 예요 — 정체성 (I Am)',
    unitType: 'ser_estar',
    vocabTerms: ['이에요', '예요', 'ieoyo', 'I am', 'identity', '학생이에요', '선생님이에요', '이/가 아니에요', 'copula'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"저는 학생이에요" — I am a student. 이에요 after consonants, 예요 after vowels. Say: 학생・이・에・요.', studentAction: 'Repeat 학생이에요 and 선생님이에요.', teacherHint: 'Rule: consonant-ending nouns → 이에요 (학생이에요). Vowel-ending nouns → 예요 (선생님이에요, 의사예요). Drill both endings side by side.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '저는 한국 사람이에요 — I am Korean. 이것은 책이에요 — This is a book. Read each identity statement.', studentAction: 'Read identity sentences with topic + 은/는 + noun + 이에요/예요.', teacherHint: '은/는 marks the topic. Subject vs topic distinction will develop over time — for now, just model the natural pattern.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who is what? Match people and roles with 이에요/예요.', studentAction: 'Build identity sentences rapidly, watching the consonant/vowel rule.', teacherHint: 'Negative: 이/가 아니에요. 저는 학생이 아니에요 — I am not a student. Drill the negation pair.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '뭐예요? — What is it? Point to something and ask/answer.', studentAction: 'Produce: [thing]이에요/예요.', teacherHint: '직업이 뭐예요? — What is your job? Very natural real-world question.' },
    ],
  },

  {
    contentKey: 'where am i korean',
    language: 'korean',
    displayName: '어디에 있어요? — 위치 (Location)',
    unitType: 'ser_estar',
    vocabTerms: ['어디에', '에 있어요', 'location', '에서', '학교에 있어요', 'where am I', '있어요', 'position words'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"학교에 있어요" — I am at school. 에 있어요 = location. Say: 에・있・어・요.', studentAction: 'Repeat 학교에 있어요 and 집에 있어요.', teacherHint: '에 있다 = location (where something IS). 에서 = action location (where something HAPPENS). Students confuse these — keep this unit on 에 있다 only.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '저는 도서관에 있어요 — I am at the library. 책상 위에 있어요 — It is on the desk. Read each.', studentAction: 'Read location sentences with positional nouns.', teacherHint: 'Positional nouns: 위 (top), 아래/밑 (bottom), 안 (inside), 밖 (outside), 옆 (side), 앞 (front), 뒤 (behind). High-frequency vocabulary.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Where is each person or object? Combine locations with 에 있어요.', studentAction: 'Build: [person/thing] + [location]에 + 있어요.', teacherHint: 'Extend to 없어요: 지금 집에 없어요 — I\'m not home. Equally important.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '지금 어디에 있어요? — Where are you right now?', studentAction: 'Produce: 지금 [place]에 있어요.', teacherHint: '화장실이 어디에 있어요? — Practical question every learner needs immediately.' },
    ],
  },

  {
    contentKey: 'i can korean',
    language: 'korean',
    displayName: '할 수 있어요 — 능력 (I Can)',
    unitType: 'verb',
    vocabTerms: ['할 수 있어요', 'ㄹ 수 있어요', 'ability', 'I can', '할 수 없어요', '수영할 수 있어요', '말할 수 있어요'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"한국어를 말할 수 있어요" — I can speak Korean. Verb stem + ㄹ 수 있어요. Say: 말・할・수・있・어・요.', studentAction: 'Repeat 말할 수 있어요 and 수영할 수 있어요.', teacherHint: 'ㄹ 수 있어요 = can. ㄹ 수 없어요 = cannot. The ㄹ suffix pattern: same as future, so students who know 거예요 have half the work done.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '저는 피아노를 칠 수 있어요 — I can play the piano. 수영을 못 해요. Read ability sentences.', studentAction: 'Read ability sentences with ㄹ 수 있어요 and 못.', teacherHint: '못 + verb = informal "can\'t": 못 해요, 못 먹어요. ㄹ 수 없어요 = more formal "cannot". Both are natural.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What can each person do? Build ability sentences rapidly.', studentAction: 'Combine subjects + abilities + ㄹ 수 있어요/없어요.', teacherHint: 'Encourage real self-disclosure: 저는 ___ㄹ 수 있어요 — authentic ability statements.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '한국어를 말할 수 있어요? — Can you speak Korean? (Engage the meta-question.)', studentAction: 'Produce: 네, 조금 말할 수 있어요 / 아직 잘 못 해요.', teacherHint: 'Amusingly self-referential question — students are literally demonstrating the answer.' },
    ],
  },

  {
    contentKey: 'the verb pattern korean',
    language: 'korean',
    displayName: '동사 형태 패턴 — 아/어요 틀',
    unitType: 'verb',
    vocabTerms: ['아요', '어요', '해요', 'present tense', 'polite ending', '았어요', '었어요', '겠어요', '시제'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: 'The 아/어요 frame: present (아/어요), past (았/었어요), future intent (ㄹ 거예요). Say each form for 먹다: 먹어요, 먹었어요, 먹을 거예요.', studentAction: 'Repeat all three tenses for 먹다, 가다, and 하다.', teacherHint: '하다 → 해요 (present), 했어요 (past), 할 거예요 (future). These three verbs cover the main conjugation patterns.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '매일 운동해요 / 어제 운동했어요 / 내일 운동할 거예요. Read all three tenses in sequence.', studentAction: 'Produce all three tense forms for each verb given.', teacherHint: 'Pairs of sentences across time frames build temporal fluency. Five verbs minimum: 가다, 먹다, 하다, 보다, 읽다.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Scan: past, present, or future? Combine tense + verb + context.', studentAction: 'Build sentences matching the correct tense to each time word.', teacherHint: 'Time word + tense matching: 어제/지난주 → 었어요. 지금/매일 → 어요. 내일/다음 주 → ㄹ 거예요.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '어제, 오늘, 내일 — 뭐 해요? Answer in three tenses for a real activity.', studentAction: 'Produce: 어제 ___했어요. 오늘 ___해요. 내일 ___할 거예요.', teacherHint: 'Three-tense narrative about real life. Strong fluency drill.' },
    ],
  },

  {
    contentKey: 'there is korean',
    language: 'korean',
    displayName: '있어요 / 없어요 — 존재 (There Is)',
    unitType: 'hay_gustar',
    vocabTerms: ['있어요', '없어요', 'there is', 'there are', 'existence', '이/가 있어요', 'location', '없어요'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"교실에 학생들이 있어요" — There are students in the classroom. 에 있어요 = exists in a place. Say it.', studentAction: 'Repeat 있어요 and 없어요 in location frames.', teacherHint: '[Location]에 + [subject]이/가 + 있어요. This frames both existence (there is) and possession (I have). Same structure.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '냉장고에 음식이 있어요 — There is food in the fridge. 지갑에 돈이 없어요. Read each.', studentAction: 'Read existence sentences with location + 에 있어요/없어요.', teacherHint: 'Practical household vocabulary: 냉장고, 지갑, 가방, 책상, 방. All very high frequency.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What exists where? Combine locations and objects.', studentAction: 'Build existence sentences rapidly.', teacherHint: 'Natural context: describing your room, bag, or fridge. Immediately useful.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '가방에 뭐 있어요? — What is in your bag?', studentAction: 'Produce: 가방에 [thing]이/가 있어요.', teacherHint: '지금 교실에 몇 명 있어요? — count people in the room. Highly engaging.' },
    ],
  },

  {
    contentKey: 'i like korean',
    language: 'korean',
    displayName: '좋아해요 — 선호 (I Like)',
    unitType: 'hay_gustar',
    vocabTerms: ['좋아해요', '싫어해요', 'I like', 'preference', '을/를 좋아해요', '좋아요', 'nice', 'favourite'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"음악을 좋아해요" — I like music. 을/를 marks what is liked. Say: 좋・아・해・요.', studentAction: 'Repeat 음악을 좋아해요 and 채소를 싫어해요.', teacherHint: 'Note: 좋아해요 (I like) vs 좋아요 (it is good/nice). Both from 좋다 but different usage. 좋아해요 = subjective preference. 좋아요 = objective quality.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '저는 K-pop을 정말 좋아해요 — I really like K-pop. 매운 음식을 싫어해요. Read preference sentences.', studentAction: 'Read preferences using 을/를 좋아해요/싫어해요.', teacherHint: 'Intensifiers: 정말/너무/엄청 좋아해요 (really/so/super like). 별로 안 좋아해요 (not really like). Students want this range.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person like or dislike? Build from the columns.', studentAction: 'Build preference sentences with 좋아해요/싫어해요.', teacherHint: 'K-culture content makes this unit particularly motivating for Korean learners.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '어떤 음악을 좋아해요? — What kind of music do you like?', studentAction: 'Produce: 저는 [genre/thing]을/를 좋아해요.', teacherHint: '제일 좋아하는 가수가 누구예요? — Favorite singer question, very engaging for K-pop learners.' },
    ],
  },

  {
    contentKey: 'i would like korean',
    language: 'korean',
    displayName: '원해요 — 정중한 희망 (I Would Like)',
    unitType: 'verb',
    vocabTerms: ['원해요', '주세요', 'I would like', 'polite desire', '고 싶어요', '을/를 주세요', 'please give me'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"커피 한 잔 주세요" — I would like a cup of coffee, please. 주세요 = please give me. Say: 주・세・요.', studentAction: 'Repeat 커피 주세요 and 좀 도와주세요.', teacherHint: '주세요 = please give. 주다 (give) + -세요 (polite imperative). Extremely high frequency — used in restaurants, shops, everywhere.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '메뉴판 주세요 — Please give me the menu. 조금 더 주세요 — A little more please. Read polite requests.', studentAction: 'Read polite request sentences with 주세요.', teacherHint: 'Socially critical frame: 주세요 is the most common polite request form. Compare 원해요 (want — more formal/written) for completeness.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What would each person like? Build polite requests.', studentAction: 'Build: [item] + 주세요.', teacherHint: 'Restaurant scenario: order food using 주세요. Makes it immediately real.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '뭘 드릴까요? — What can I get you? Answer with a 주세요 request.', studentAction: 'Produce: [item]을/를 주세요.', teacherHint: 'Role-play server/customer. Highly motivating and immediately useful.' },
    ],
  },

  {
    contentKey: 'i went korean',
    language: 'korean',
    displayName: '갔어요 — 과거 이동 (I Went)',
    unitType: 'preterite',
    vocabTerms: ['갔어요', 'gasseoyo', 'I went', 'past motion', '왔어요', '돌아왔어요', '여행했어요', '다녀왔어요'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"서울에 갔어요" — I went to Seoul. 가다 → 갔어요. Past of going. Say: 갔・어・요.', studentAction: 'Repeat 갔어요 and 왔어요.', teacherHint: '갔어요 (went away), 왔어요 (came here), 다녀왔어요 (went and came back). The three core motion verbs in past tense.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '지난 주말에 부산에 갔어요 — I went to Busan last weekend. 친구 집에 다녀왔어요. Read each.', studentAction: 'Read past motion sentences with time expressions.', teacherHint: 'Time expressions: 지난주 (last week), 어제 (yesterday), 지난달 (last month). Natural with past-tense motion verbs.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Where did each person go? Combine times and destinations.', studentAction: 'Build past-motion sentences with 갔어요/왔어요.', teacherHint: 'Extend to 다녀왔어요 — implies a round trip. Very common in Korean: 학교 다녀왔어요 (I\'m back from school).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '지난 방학에 어디에 갔어요? — Where did you go last vacation?', studentAction: 'Produce: [time]에 [place]에 갔어요.', teacherHint: '거기서 뭐 했어요? — follow up on what they did there. Chain past actions.' },
    ],
  },

  {
    contentKey: 'he is going to korean',
    language: 'korean',
    displayName: '갈 거예요 (3인칭) — He Is Going To',
    unitType: 'verb',
    vocabTerms: ['갈 거예요', '3인칭', 'third person', '그는', '그녀는', 'narration', '할 거예요'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"그 친구는 서울에 갈 거예요" — My friend is going to go to Seoul. Same 거예요 form regardless of person. Say it.', studentAction: 'Repeat 갈 거예요 with different subjects.', teacherHint: 'Korean verb form is the same for all persons in polite speech. This simplicity is a strength to highlight.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '선생님은 내일 일찍 오실 거예요 — The teacher is going to come early tomorrow. Read third-person future narrations.', studentAction: 'Read narration with 거예요 and named subjects.', teacherHint: '오실 거예요 uses the honorific -(으)시- for the teacher. Introduce honorifics naturally here without over-explaining.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What are these people going to do? Combine named subjects + plans.', studentAction: 'Build third-person future sentences.', teacherHint: 'Use real class members\' names if appropriate. Makes the exercise memorable and fun.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '내일 선생님은 뭘 할 거예요? — What is the teacher going to do tomorrow?', studentAction: 'Produce a creative third-person future sentence.', teacherHint: 'Open-ended: predictions about others are engaging and generate creative language.' },
    ],
  },

  {
    contentKey: 'what did he do korean',
    language: 'korean',
    displayName: '뭐 했어요? — 과거 질문 (What Did He Do?)',
    unitType: 'preterite',
    vocabTerms: ['뭐 했어요', 'what did he do', 'past question', '었어요', '했어요', '뭘', 'question words', '어디서', '언제'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"어제 뭐 했어요?" — What did you do yesterday? 했어요 is the past of 해요. Say: 뭐・했・어・요?', studentAction: 'Repeat 뭐 했어요? and 어디 갔어요?', teacherHint: 'Question words + past: 뭐 했어요 (what did), 어디 갔어요 (where did), 언제 왔어요 (when did). All same pattern.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Question and answer pairs. 어제 뭐 했어요? — 영화를 봤어요. Read and answer each pair.', studentAction: 'Produce both the question and a natural answer.', teacherHint: 'Encourage full answers but accept minimal: 영화요 (just "movies") is natural in fast speech.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Mix past question words — what, where, when, who. Build questions rapidly.', studentAction: 'Build past-tense Wh-questions for different verbs.', teacherHint: 'All Korean Wh-questions are SOV: 어제 어디서 밥을 먹었어요? (Where did you eat yesterday?) — time + location + object + verb.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '주말에 뭐 했어요? — What did you do on the weekend? Give a real answer.', studentAction: 'Produce a past narrative about the weekend.', teacherHint: '재미있었어요? — follow up with past adjective naturally.' },
    ],
  },

  {
    contentKey: 'he had korean',
    language: 'korean',
    displayName: '있었어요 — 과거 소유/존재 (He Had)',
    unitType: 'preterite',
    vocabTerms: ['있었어요', 'isseosseoyo', 'there was', 'he had', 'past of 있다', '없었어요', 'past existence'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"예전에 개가 있었어요" — There was a dog before / I had a dog. 있어요 → 있었어요. Past of existence. Say: 있・었・어・요.', studentAction: 'Repeat 있었어요 and 없었어요.', teacherHint: '있었어요 = past of 있어요. 없었어요 = past of 없어요. Simple past suffix application. Very high frequency in narration.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '예전에는 여기에 공원이 있었어요 — There used to be a park here. 어릴 때 고양이가 있었어요. Read each.', studentAction: 'Read past existence/possession sentences.', teacherHint: '예전에는, 어릴 때, 그때는 — time markers for "used to" sense. Natural Korean nostalgia framing.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What existed or was had in the past? Build past existence sentences.', studentAction: 'Combine past time + subject + 있었어요/없었어요.', teacherHint: 'Interesting cultural exercise: 옛날 한국에는 뭐가 있었어요? — historical existence questions.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '어릴 때 어떤 장난감이 있었어요? — What toys did you have as a child?', studentAction: 'Produce: 어릴 때 [toy]이/가 있었어요.', teacherHint: 'Childhood memories create strong emotional anchors. Highly effective vocabulary retention context.' },
    ],
  },

  {
    contentKey: 'to him korean',
    language: 'korean',
    displayName: '그에게 / 에게 — 간접목적어 (To Him / To Her)',
    unitType: 'object_pronoun',
    vocabTerms: ['에게', '한테', 'to him', 'to her', 'indirect object', 'dative', '드렸어요', '줬어요', '보냈어요'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"친구에게 선물을 줬어요" — I gave a gift to my friend. 에게/한테 = to (a person). Say: 에・게.', studentAction: 'Repeat 친구에게 줬어요 and 엄마한테 줬어요.', teacherHint: '에게 = written/formal. 한테 = spoken/casual. Both widely used. 에게서/한테서 = from (a person). Introduce from-to contrast.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '선생님께 꽃을 드렸어요 — I gave flowers to the teacher. 친구한테 문자를 보냈어요. Read indirect object sentences.', studentAction: 'Read giving/sending sentences with recipient particles.', teacherHint: '께 = honorific version of 에게. Used for teachers, elders, bosses. Reinforce the three levels: 한테 (casual), 에게 (formal), 께 (honorific).' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who gave or sent what to whom? Build giving sentences.', studentAction: 'Combine giver + recipient + 에게/한테 + object + 줬어요/보냈어요.', teacherHint: 'High-frequency verbs with 에게: 주다 (give), 보내다 (send), 말하다 (tell), 가르치다 (teach). Drill them all.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '최근에 누구에게 선물을 줬어요? — Did you give a gift to anyone recently?', studentAction: 'Produce: [person]에게/한테 [thing]을/를 줬어요.', teacherHint: 'Cultural note: 선물 culture in Korea is significant. Connect grammar to cultural insight.' },
    ],
  },

  {
    contentKey: 'clean dirty korean',
    language: 'korean',
    displayName: '깨끗해요 / 더러워요 — 묘사 (Clean / Dirty)',
    unitType: 'verb',
    vocabTerms: ['깨끗해요', '더러워요', 'clean', 'dirty', 'adjectives', '예뻐요', '크고', 'descriptive verbs', '형용사'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"깨끗해요" — It is clean. "더러워요" — It is dirty. Korean adjectives work like verbs. Say them.', studentAction: 'Repeat 깨끗해요 and 더러워요.', teacherHint: 'Korean descriptive adjectives conjugate like verbs: 깨끗하다 → 깨끗해요 (present), 깨끗했어요 (past). This is structurally different from European languages.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '이 방은 너무 더러워요 — This room is very dirty. 손이 깨끗해요? — Are your hands clean? Read descriptive sentences.', studentAction: 'Read and produce descriptive adjective sentences.', teacherHint: '너무 (too/very in spoken Korean), 정말 (really), 조금 (a little). Intensifiers immediately useful.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Describe each scene — clean, dirty, or something else? Scan the columns.', studentAction: 'Build descriptions with contrasting adjectives.', teacherHint: 'Extend pair: 크다/작다 (big/small), 새롭다/낡다 (new/old), 맛있다/맛없다 (delicious/tasteless). All same adjective-verb pattern.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '지금 방이 깨끗해요, 더러워요? — Is the room clean or dirty right now?', studentAction: 'Produce: 방이 [adj]어요.', teacherHint: 'Self-description: 저는 지금 피곤해요, 배고파요 — extend to personal states. Same structure.' },
    ],
  },

  {
    contentKey: 'i studied korean',
    language: 'korean',
    displayName: '공부했어요 — 하다 동사 (I Studied)',
    unitType: 'preterite',
    vocabTerms: ['공부했어요', '공부하다', 'I studied', 'hada verb', '했어요', '운동했어요', '요리했어요', '청소했어요'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"공부했어요" — I studied. 공부하다 → 공부했어요. 하다 → 했어요. The 하다 verb class. Say it.', studentAction: 'Repeat 공부했어요 and 운동했어요.', teacherHint: '하다 → 했어요 is the past of the most productive verb class in Korean. Once students own this, they unlock hundreds of Sino-Korean compound verbs.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '도서관에서 3시간 공부했어요 — I studied in the library for 3 hours. 오늘 아침에 운동했어요. Read 하다-verb sentences.', studentAction: 'Read 하다 past-tense sentences in context.', teacherHint: 'Duration: [N]시간 동안 or just [N]시간. Both work. 얼마나 공부했어요? (How long did you study?) Natural follow-up question.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What did each person do? Use 하다 verbs in the past.', studentAction: 'Combine activities + 했어요 rapidly.', teacherHint: 'Core 하다 verb set: 공부하다, 운동하다, 요리하다, 청소하다, 전화하다, 여행하다, 일하다. Students need these seven.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '어제 몇 시간 공부했어요? — How many hours did you study yesterday?', studentAction: 'Produce: [N]시간 공부했어요.', teacherHint: 'Extend: 이번 주에 뭐 했어요? — free past narration with 하다 verbs.' },
    ],
  },

  {
    contentKey: 'i received korean',
    language: 'korean',
    displayName: '받았어요 — 수령 (I Received)',
    unitType: 'preterite',
    vocabTerms: ['받았어요', 'badasseoyo', 'I received', '주다', '드리다', '받다', 'give receive', '선물'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"선물을 받았어요" — I received a gift. 받다 → 받았어요. Say: 받・았・어・요.', studentAction: 'Repeat 받았어요 and 줬어요.', teacherHint: '줬어요 (I gave) ↔ 받았어요 (I received). Classic pair. Drill both sides of the transaction.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '생일에 선물을 많이 받았어요 — I received many gifts on my birthday. 친구한테서 메시지를 받았어요. Read receiving sentences.', studentAction: 'Read receiving sentences with 에게서/한테서 (from a person).', teacherHint: '한테서/에게서 = from (a person). 에서 = from (a place). Students confuse these — drill the distinction here.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who received what from whom? Build receiving sentences.', studentAction: 'Combine giver + 한테서 + receiver + object + 받았어요.', teacherHint: 'Extend: 상을 받았어요 (received an award), 편지를 받았어요 (received a letter). Beyond just gifts.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '최근에 뭘 받았어요? — What did you receive recently?', studentAction: 'Produce: [person]한테서 [thing]을/를 받았어요.', teacherHint: '가장 기억에 남는 선물이 뭐예요? — most memorable gift. Deep personalization.' },
    ],
  },

  {
    contentKey: 'i will korean',
    language: 'korean',
    displayName: '할 거예요 — 미래와 의지 (I Will)',
    unitType: 'verb',
    vocabTerms: ['할 거예요', 'ㄹ/을 거예요', 'I will', 'future', '겠어요', 'intention', '결심', '약속'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"내년에 한국에 갈 거예요" — I will go to Korea next year. Also: 가겠어요 — I will go (stronger commitment). Say both.', studentAction: 'Repeat 갈 거예요 and 가겠어요.', teacherHint: '거예요 = neutral future/prediction. 겠어요 = speaker\'s strong will or conjecture. Both important. 겠어요 sounds more formal and resolute.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '열심히 공부하겠어요 — I will study hard (commitment). 내일 비가 올 거예요 — It will rain tomorrow (prediction). Read the contrast.', studentAction: 'Read future sentences distinguishing prediction vs commitment.', teacherHint: 'Context: weather/prediction → 거예요. Promise/resolution → 겠어요. Both naturally appear in daily speech.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Predictions and plans — which form fits? Build with 거예요 or 겠어요.', studentAction: 'Build future sentences matching context to form.', teacherHint: 'Practical: 도와드리겠어요 (I will help you) — service/formal contexts. 갈 거예요 (I will go) — casual planning.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '올해 목표가 뭐예요? — What is your goal this year? Answer with 겠어요 or 거예요.', studentAction: 'Produce a future commitment about a real goal.', teacherHint: '꼭 ___하겠어요 (I will definitely ___). Strong personal commitment frame. Memorable and meaningful.' },
    ],
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// MANDARIN UNITS
// ─────────────────────────────────────────────────────────────────────────────

const MANDARIN_UNITS: MadrigalLoopUnit[] = [

  {
    contentKey: 'where are you going mandarin',
    language: 'mandarin',
    displayName: '我去 — 你去哪儿？(Where Are You Going?)',
    unitType: 'verb',
    vocabTerms: ['去', '我去', 'qù', 'I go', 'going', '去哪儿', '去哪里', '到', '校', '家'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我去" — I go. "你去哪儿？" — Where are you going? 去 is the verb; destination follows directly. Say: qù.', studentAction: 'Repeat 我去 and 你去哪儿?.', teacherHint: 'SVO order: 我 + 去 + 学校 (I go to school). No preposition needed — destination comes after 去. This is elegantly simple.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我去学校 — I am going to school. 他去图书馆 — He goes to the library. Read each destination sentence.', studentAction: 'Read going sentences with subject + 去 + destination.', teacherHint: 'No articles (a/the), no direction prepositions. Just subject + 去 + place. Celebrate this simplicity.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Eyes across the columns — who is going where? Combine quickly.', studentAction: 'Build: subject + 去 + destination.', teacherHint: 'Introduce 去不去 (go or not go) as a question form: 你去不去图书馆？ Affirmative-negative question pattern.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你去哪儿？ — Where are you going? Answer with 我去＋destination.', studentAction: 'Produce: 我去[place].', teacherHint: 'Extend: 他去哪儿了？(Where did he go? 了 marks past) — natural follow-on.' },
    ],
  },

  {
    contentKey: 'i took mandarin',
    language: 'mandarin',
    displayName: '我拿了 — 完成体 了 (I Took)',
    unitType: 'preterite',
    vocabTerms: ['拿了', '了', 'le', 'completed action', '我拿了', 'aspect marker', '吃了', '买了', '看了'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我拿了" — I took (it). 了 marks a completed action — not past tense per se, but completion. Say: ná le.', studentAction: 'Repeat 我拿了 and 他吃了.', teacherHint: '了 is an aspect marker, not a tense marker. It signals completion. Students from European languages will want to call it "past tense" — acknowledge the overlap but note the difference.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我拿了一把伞 — I took an umbrella. 他买了一本书. Read completed-action sentences.', studentAction: 'Read sentences with verb + 了 + object.', teacherHint: 'When there is an object: verb + 了 + object (我买了书). 了 sits between verb and object, not at the end. Common error: 我买书了 ✗ (when object is present without quantifier).' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who took or bought what? Use 了 for completed actions.', studentAction: 'Build: subject + verb + 了 + object.', teacherHint: 'Negation: 没(有) + verb (NO 了). 我没买 — I didn\'t buy. 了 disappears with negation.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你拿了什么？ — What did you take? Answer with 我拿了＋object.', studentAction: 'Produce: 我拿了[thing].', teacherHint: '了 question: 你去了吗？ — Did you go? (sentence-final 了 for a different but overlapping function). Note both uses exist.' },
    ],
  },

  {
    contentKey: 'i bought mandarin',
    language: 'mandarin',
    displayName: '我买了 — 买 的过去 (I Bought)',
    unitType: 'preterite',
    vocabTerms: ['买了', '我买了', 'mǎi le', 'I bought', '买', 'shopping', '卖', '花了', '钱'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我买了" — I bought. 买 (mǎi) = buy. Same 了 completion pattern. Say: mǎi le.', studentAction: 'Repeat 我买了 and 我卖了.', teacherHint: '买 (mǎi, buy) vs 卖 (mài, sell) — tonal minimal pair. Third tone vs fourth tone. High-frequency confusion pair. Drill both.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我买了一件衣服 — I bought a piece of clothing. 她买了很多东西. Read shopping sentences.', studentAction: 'Read purchase sentences with measure words + 了.', teacherHint: 'Introduce measure words: 一件 (clothes), 一本 (book), 一个 (general). Students need the most common: 一个, 一本, 一件, 一杯, 一张.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What did each person buy? Combine with measure words.', studentAction: 'Build: subject + 买了 + measure word + noun.', teacherHint: 'Keep it simple: one measure word type per item. Don\'t over-drill measure words here — introduce naturally.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你买了什么？ — What did you buy? Answer with a real purchase.', studentAction: 'Produce: 我买了[measure word + item].', teacherHint: '你花了多少钱？ — How much did you spend? 花 (huā) = to spend. Natural shopping follow-up.' },
    ],
  },

  {
    contentKey: 'i am going to mandarin',
    language: 'mandarin',
    displayName: '我打算去 — 近未来 (I Am Going To)',
    unitType: 'verb',
    vocabTerms: ['打算', '要', '我要去', '我打算', 'plan to', 'near future', '准备', '快要', '即将'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我要去" — I am going to go. "我打算去" — I plan to go. 要 = immediate intent; 打算 = deliberate plan. Say both.', studentAction: 'Repeat 我要去 and 我打算去.', teacherHint: '要 (yào) = want to / going to (immediate). 打算 (dǎsuàn) = plan to (deliberate). Both very high frequency. 快要 = about to (imminence).' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我要去超市 — I am going to the supermarket. 我打算明年去中国. Read intent sentences.', studentAction: 'Read near-future sentences with 要 and 打算.', teacherHint: 'Temporal markers reinforce meaning: 明天 + 要 (tomorrow going to), 这个周末 + 打算 (this weekend plan to). Calendar words before the subject typically.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What is each person going to do? Combine with 要 or 打算.', studentAction: 'Build near-future sentences choosing the right intent marker.', teacherHint: 'Context clue: immediate future → 要. Planned future → 打算. Let students practice choosing.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你打算这个周末做什么？ — What do you plan to do this weekend?', studentAction: 'Produce: 我打算 + [activity].', teacherHint: '我要 + [activity] for more spontaneous plans. Both natural in context.' },
    ],
  },

  {
    contentKey: 'i have mandarin',
    language: 'mandarin',
    displayName: '我有 — 所有 (I Have)',
    unitType: 'verb',
    vocabTerms: ['有', '没有', 'yǒu', 'I have', 'possession', '我有', '他有', '有没有', 'do you have'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我有一只猫" — I have a cat. 有 = have / there is. 没有 = don\'t have / there isn\'t. Say: yǒu, méiyǒu.', studentAction: 'Repeat 我有 and 我没有.', teacherHint: '有 covers both possession (I have) and existence (there is). 有没有 = do you have / is there. Two birds, one character.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '你有没有笔？ — Do you have a pen? 我有，谢谢. Read possession exchanges.', studentAction: 'Read 有 sentences in question-answer pairs.', teacherHint: '有没有 = affirmative-negative question for 有. Always produces yes/no: 有 or 没有.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who has what? Build possession sentences rapidly.', studentAction: 'Combine: subject + 有/没有 + [measure word] + noun.', teacherHint: 'Push the question form: subject + 有没有 + object. Drill both question and answer.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你有哥哥或姐姐吗？ — Do you have an older brother or sister? Answer truthfully.', studentAction: 'Produce: 我有/没有 [family member].', teacherHint: 'Family context: 我有一个弟弟 — I have a younger brother. Personalized and memorable.' },
    ],
  },

  {
    contentKey: 'i want mandarin',
    language: 'mandarin',
    displayName: '我想要 — 愿望 (I Want)',
    unitType: 'verb',
    vocabTerms: ['想', '想要', '要', 'xiǎng', 'I want', 'desire', '我想吃', '我想去', 'want to'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我想吃饺子" — I want to eat dumplings. 想 + verb = want to do. Say: xiǎng.', studentAction: 'Repeat 我想吃 and 我想去.', teacherHint: '想 + verb (I want to do something). 想 + noun/想要 + noun (I want [thing]). Both patterns are essential.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我想学中文 — I want to learn Chinese. 她想要一杯茶. Read desire sentences.', studentAction: 'Read want sentences with 想 + verb and 想要 + noun.', teacherHint: 'Meta-moment: 我想学中文 — point out this IS the sentence about what they are already doing. Motivating.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person want to do or have? Combine freely.', studentAction: 'Build desire sentences using both 想 and 想要.', teacherHint: 'Contrast 想 (softer desire) vs 要 (stronger intent). 我想去 (I want to go) vs 我要去 (I\'m going to go).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你最想去哪个国家？ — Which country do you most want to visit?', studentAction: 'Produce: 我最想去[country].', teacherHint: '为什么？ — follow up with 因为...。 Extend into reasoning.' },
    ],
  },

  {
    contentKey: 'i am identity mandarin',
    language: 'mandarin',
    displayName: '我是 — 身份 (I Am — Identity)',
    unitType: 'ser_estar',
    vocabTerms: ['是', '不是', 'shì', 'I am', 'identity', '我是学生', '是不是', 'copula', 'classification'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我是学生" — I am a student. 是 is the copula for identity. Say: shì.', studentAction: 'Repeat 我是学生 and 他是老师.', teacherHint: '是 = identity/classification. NOT used with adjectives (❌ 我是高). Adjectives stand alone as predicates: 我很高 (I am tall). Critical distinction.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我是中国人吗？ — Am I Chinese? 不，我不是中国人. Read identity Q&A pairs.', studentAction: 'Read identity statements and their negations.', teacherHint: '是不是 = is it or not (A-not-A question). 是…吗 = yes/no question. Both natural. Negation: 不是 (not 没是).' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who is what role or identity? Match and build rapidly.', studentAction: 'Build: subject + 是 + identity noun.', teacherHint: 'Push the contrast: 是 for nouns/roles. Adjectives go alone: 她很聪明 (she is smart), not 她是聪明.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你是哪国人？ — Where are you from? (Literally: You are which country person?)', studentAction: 'Produce: 我是[nationality]人.', teacherHint: 'Cultural breadth: 我是美国人, 我是台湾人, 我是加拿大人. Celebrate diversity in the classroom.' },
    ],
  },

  {
    contentKey: 'where am i mandarin',
    language: 'mandarin',
    displayName: '我在哪里？ — 位置 (Where Am I?)',
    unitType: 'ser_estar',
    vocabTerms: ['在', '我在', 'zài', 'location', 'where am I', '在哪里', '在哪儿', 'position words', '上面', '里面'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我在学校" — I am at school. 在 = location. Say: zài.', studentAction: 'Repeat 我在学校 and 他在家.', teacherHint: '在 for location. Do NOT use 是 for location. 我在图书馆 ✓. 我是图书馆 ✗. This is the key structural rule students must internalize.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '猫在桌子上 — The cat is on the table. 书在包里. Read location sentences with position words.', studentAction: 'Read location sentences using position words (上, 里, 下, 前, 后).', teacherHint: 'Position words: 上 (on/above), 下 (under), 里 (inside), 外 (outside), 前 (front), 后 (back), 旁边 (next to). Very high frequency.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Where is each person or object? Combine locations.', studentAction: 'Build: subject + 在 + [location] + [position word].', teacherHint: 'Full pattern: 书在桌子上 (book is on the table) = [thing] + 在 + [reference point] + [position word]. Very useful for daily description.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你现在在哪里？ — Where are you right now?', studentAction: 'Produce: 我在[place].', teacherHint: '钥匙在哪里？ — Where are my keys? High-stakes practical question that generates real use.' },
    ],
  },

  {
    contentKey: 'i can mandarin',
    language: 'mandarin',
    displayName: '我能 / 我可以 — 能力 (I Can)',
    unitType: 'verb',
    vocabTerms: ['能', '可以', 'néng', 'kěyǐ', 'I can', 'ability', '会', 'skill', '不能', '不可以'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我能游泳" — I can swim (physical ability). "我会说中文" — I can speak Chinese (learned skill). Two ways to say can. Say both.', studentAction: 'Repeat 我能 and 我会 in sentences.', teacherHint: 'Three modals: 能 (ability/permission in context), 可以 (permission/possibility), 会 (learned skill). All translate as "can" in English. Most important: 会 for language/skill ability.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '你会说日语吗？ — Can you speak Japanese? 我不会. 我可以进来吗？ — Can I come in? Read ability and permission sentences.', studentAction: 'Read ability and permission contexts distinguishing the three modals.', teacherHint: '会 = skill (learned). 能 = physically capable. 可以 = permitted/allowed. Students only need this rough map now — nuance comes with exposure.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who can do what? Match modals to contexts in the columns.', studentAction: 'Build ability sentences with 会/能/可以 in appropriate contexts.', teacherHint: 'When in doubt: 会 for skills (speaking, cooking, driving). 可以 for requests. 能 for physical capacity.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你会什么？ — What can you do? (What skills do you have?)', studentAction: 'Produce: 我会[skill].', teacherHint: '你会几种语言？ — How many languages can you speak? Always engaging meta-question.' },
    ],
  },

  {
    contentKey: 'the verb pattern mandarin',
    language: 'mandarin',
    displayName: '动词形式 — 时态标记 (Aspect Markers)',
    unitType: 'verb',
    vocabTerms: ['了', '过', '着', '在', 'aspect markers', 'completion', 'experience', 'ongoing', '时态'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: 'Three aspect markers: 了 (completed), 过 (experienced), 着 (ongoing state). Say each: le, guò, zhe.', studentAction: 'Repeat 了, 过, 着 with example sentences.', teacherHint: 'Mandarin marks aspect, not tense. 我吃了 (ate — done). 我吃过 (have eaten before — experience). 他睡着了 (fell asleep — resulting state). These are the three core aspects.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我去过北京 — I have been to Beijing (before). 我去了北京 — I went to Beijing (completed). Read contrast pairs.', studentAction: 'Distinguish 了 (this specific time) vs 过 (ever/before) in context.', teacherHint: '去了 = went (specific trip). 去过 = have been (experience). This is a genuinely useful distinction — don\'t gloss over it.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Which marker fits? Past completion, past experience, or ongoing state? Build from the columns.', studentAction: 'Build sentences choosing the correct aspect marker for context.', teacherHint: 'Negation rule: 没(有) negates both 了 and 过. 没去 (didn\'t go). 没去过 (have never been).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你去过中国吗？ — Have you ever been to China? Answer with 去过 or 没去过.', studentAction: 'Produce: 我去过/没去过[place].', teacherHint: 'The 过 frame for travel experience is incredibly practical: 去过, 吃过, 看过, 喝过. Drill all four.' },
    ],
  },

  {
    contentKey: 'there is mandarin',
    language: 'mandarin',
    displayName: '有 / 没有 — 存在 (There Is / There Isn\'t)',
    unitType: 'hay_gustar',
    vocabTerms: ['有', '没有', 'yǒu', 'méiyǒu', 'there is', 'existence', '有没有', '哪里有', 'location'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"这里有一家餐馆" — There is a restaurant here. 有 = exist. 没有 = don\'t exist. Say both.', studentAction: 'Repeat 这里有 and 这里没有.', teacherHint: 'Existence: [location] + 有 + [thing]. 教室里有桌子 (there are desks in the classroom). Natural SVO once location is established.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '冰箱里有没有牛奶？ — Is there milk in the fridge? 有一点儿. Read existence questions and answers.', studentAction: 'Read existence Q&A pairs with 有 and 没有.', teacherHint: 'Quantity: 有一点儿 (a little), 有很多 (a lot), 有一些 (some). Natural quantifier set.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What is in each location? Build existence sentences from the columns.', studentAction: 'Build: [location] + 有/没有 + [thing].', teacherHint: 'Locations: 冰箱里 (in the fridge), 包里 (in the bag), 街上 (on the street), 房间里 (in the room). Common preposition + noun combos.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你们班有多少学生？ — How many students are in your class?', studentAction: 'Produce: 我们班有[number]个学生.', teacherHint: '附近有没有咖啡店？ — Is there a coffee shop nearby? Extremely practical question.' },
    ],
  },

  {
    contentKey: 'i like mandarin',
    language: 'mandarin',
    displayName: '我喜欢 — 喜好 (I Like)',
    unitType: 'hay_gustar',
    vocabTerms: ['喜欢', '不喜欢', 'xǐhuān', 'I like', 'preference', '最喜欢', '喜欢做', 'love', '讨厌'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我喜欢音乐" — I like music. 喜欢 + noun or verb phrase. Say: xǐ-huān.', studentAction: 'Repeat 我喜欢音乐 and 我不喜欢蔬菜.', teacherHint: '喜欢 + noun (I like music). 喜欢 + verb (I like eating). Unlike Spanish gustar, no subject-object inversion — standard SVO with 喜欢 as the verb.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我最喜欢吃四川菜 — I like Sichuan food most. 我不太喜欢冷天气. Read preference statements.', studentAction: 'Read preference sentences with degree adverbs.', teacherHint: '最喜欢 (like most/favorite), 很喜欢 (like a lot), 不太喜欢 (don\'t really like), 不喜欢 (don\'t like), 讨厌 (can\'t stand). Five-level preference scale.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person like or dislike? Build preference statements.', studentAction: 'Build: subject + degree + 喜欢 + noun/verb.', teacherHint: 'Cultural richness: 喜欢听音乐, 喜欢打篮球, 喜欢看电影. Activity preferences create natural conversation.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你最喜欢哪种音乐？ — What type of music do you like most?', studentAction: 'Produce: 我最喜欢[genre/type].', teacherHint: '你喜欢做什么？ — What do you like to do? Open-ended personality question.' },
    ],
  },

  {
    contentKey: 'i would like mandarin',
    language: 'mandarin',
    displayName: '我想 — 礼貌愿望 (I Would Like)',
    unitType: 'verb',
    vocabTerms: ['想', '想要', 'qǐng', 'I would like', '我想点', '请给我', 'polite request', '麻烦您'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我想要一杯咖啡" — I would like a cup of coffee. 我想要 is the polite desire form. Say: wǒ xiǎng yào.', studentAction: 'Repeat 我想要 and 请给我.', teacherHint: '想 alone = want (neutral). 想要 = would like (slightly more formal/polite). 请 + request = most polite: 请给我一杯水. All three patterns are useful.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我想点一碗面 — I would like to order a bowl of noodles. 麻烦您给我菜单. Read restaurant-style polite requests.', studentAction: 'Read polite requests in restaurant/service contexts.', teacherHint: '麻烦您 (sorry to trouble you) is a polite opener. 请 is shorter and direct. Both are socially smooth.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What would each person like to order or request? Build polite requests.', studentAction: 'Build: 我想要/请给我 + [measure word] + [item].', teacherHint: 'Measure words review: 一杯 (cup), 一碗 (bowl), 一份 (portion), 一张 (flat thing). Restaurant context makes them natural.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '您想要什么？ — What would you like? (Roleplay: server asking customer.)', studentAction: 'Produce: 我想要[item], 谢谢.', teacherHint: 'Full restaurant roleplay: server asks 您点什么？, student responds with 我想要... This is immediately practical.' },
    ],
  },

  {
    contentKey: 'i went mandarin',
    language: 'mandarin',
    displayName: '我去了 — 过去行动 (I Went)',
    unitType: 'preterite',
    vocabTerms: ['去了', '我去了', 'I went', '了', 'past', '来了', '回来了', '昨天', '上周'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我去了北京" — I went to Beijing. 去 + 了 = went (completed motion). Say it.', studentAction: 'Repeat 我去了 and 他来了.', teacherHint: '去了 = went away (and arrived). 来了 = came (arrived here). 回来了 = came back. The three past motion verbs all very frequent.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '上周我去了上海 — Last week I went to Shanghai. 朋友昨天来了. Read past motion with time expressions.', studentAction: 'Read past-motion sentences with time words.', teacherHint: 'Time words naturally mark past: 昨天 (yesterday), 上周 (last week), 上个月 (last month). They are not required with 了 but clarify when.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Where did each person go? Combine time + destination + 去了.', studentAction: 'Build past-motion sentences freely.', teacherHint: 'Negation: 我没去 (I didn\'t go). Note: NO 了 with 没. Students commonly make the error of adding 了 after 没.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '上个周末你去哪儿了？ — Where did you go last weekend?', studentAction: 'Produce: 我去了[place].', teacherHint: '你怎么去的？ — How did you get there? 我坐地铁去的 — 的 structure for manner/means. Natural extension.' },
    ],
  },

  {
    contentKey: 'he is going to mandarin',
    language: 'mandarin',
    displayName: '他要去 — 第三人称未来 (He Is Going To)',
    unitType: 'verb',
    vocabTerms: ['他要去', '要', 'third person', '他', '她', 'narration', '打算', '计划'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"他要去图书馆" — He is going to go to the library. 要 works identically for all persons. Say it.', studentAction: 'Repeat 他要去 and 她打算去.', teacherHint: 'No person agreement — 要/打算 is the same for all subjects. This universality is a gift to language learners from European traditions.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我的朋友要去日本留学 — My friend is going to study abroad in Japan. 老师打算布置新作业. Read third-person future narrations.', studentAction: 'Read future narration about others.', teacherHint: '留学 (study abroad), 旅行 (travel), 工作 (work) — common life goals. Third-person narration about real people creates engagement.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What are these people going to do? Build narrations with named subjects.', studentAction: 'Combine names + 要/打算 + action.', teacherHint: 'Introduce topic comments: 我朋友呢，他要... The topic-comment structure is natural here.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你的家人打算这个假期做什么？ — What are your family members planning to do this holiday?', studentAction: 'Produce: 我[family member]要/打算[activity].', teacherHint: 'Family members as subjects: 我妈妈, 我爸爸, 我弟弟. Natural third-person narration context.' },
    ],
  },

  {
    contentKey: 'what did he do mandarin',
    language: 'mandarin',
    displayName: '他做了什么？ — 过去问句 (What Did He Do?)',
    unitType: 'preterite',
    vocabTerms: ['做了什么', '他做了什么', 'what did he do', '什么', 'question word', '吗', '吧', '过去问句'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"他做了什么？" — What did he do? 什么 stays in object position. Mandarin question words do not move. Say: tā zuò le shénme.', studentAction: 'Repeat 他做了什么？ and 你买了什么？', teacherHint: 'Mandarin question words stay in their original position — no inversion. 他做了什么 = He did WHAT? Same word order as a statement. Students from English often move the question word incorrectly.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '你去了哪里？— Where did you go? 他买了什么？ Read past-tense question pairs.', studentAction: 'Read past questions with different question words in object position.', teacherHint: '哪里/哪儿 (where), 什么 (what), 谁 (who), 怎么 (how), 为什么 (why). All stay in their expected positions.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Create past-tense questions for different verbs and question words.', studentAction: 'Build: subject + verb + 了 + question word (in object position).', teacherHint: 'Extend to 怎么: 你怎么去了？ (How did you get there?). How-questions are very common and this frame handles them.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你昨天做了什么？ — What did you do yesterday? Give a real answer.', studentAction: 'Produce a past narrative about yesterday using 了.', teacherHint: '然后呢？ — And then? Push for sequential narration with 然后 (then), 之后 (after that).' },
    ],
  },

  {
    contentKey: 'he had mandarin',
    language: 'mandarin',
    displayName: '他有过 / 他有 — 过去所有 (He Had)',
    unitType: 'preterite',
    vocabTerms: ['有过', '以前有', 'he had', 'past possession', '以前', '那时候', '曾经', 'used to have'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"他以前有一只狗" — He used to have a dog. 以前有 = used to have. 有过 = has had (experience). Say both.', studentAction: 'Repeat 他以前有 and 他有过.', teacherHint: 'No past tense morphology needed. Time words carry the meaning: 以前 (before/used to), 那时候 (at that time), 曾经 (once/used to — literary). Students need all three.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '她以前有很多朋友 — She used to have many friends. 我曾经有过一辆自行车. Read past possession with time markers.', studentAction: 'Read past possession sentences with time adverbs.', teacherHint: '曾经 + verb phrase + 过 is a literary combination. Very natural in story-telling and narratives.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What did these people own in the past? Use 以前 and 曾经.', studentAction: 'Build past possession sentences with time markers.', teacherHint: 'Nostalgic frame: 小时候我有... (When I was little I had...). Strong memory hook.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你小时候有什么玩具？ — What toys did you have as a child?', studentAction: 'Produce: 我小时候有[toy].', teacherHint: '你们以前有不同的梦想吗？ — Did you used to have different dreams? Reflective stretch question.' },
    ],
  },

  {
    contentKey: 'to him mandarin',
    language: 'mandarin',
    displayName: '给他 / 给她 — 间接宾语 (To Him / To Her)',
    unitType: 'object_pronoun',
    vocabTerms: ['给', 'gěi', 'to him', 'to her', 'indirect object', '给他', '给她', '告诉', '送给'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我给他一本书" — I give him a book. 给 = give to. Say: gěi.', studentAction: 'Repeat 我给他一本书 and 她给我打电话.', teacherHint: '给 as preposition: [subject] + 给 + [recipient] + [action/thing]. Also as verb: 我给你 (I give you). Same character, two functions.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '她告诉我一个秘密 — She told me a secret. 我发给他一条消息. Read giving/telling sentences.', studentAction: 'Read indirect object sentences with 给 and communication verbs.', teacherHint: '告诉 (tell), 发 (send), 寄 (mail), 还 (return) — all naturally take 给 + recipient. Drill the verb set alongside 给.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who gave or told what to whom? Combine from the columns.', studentAction: 'Build: subject + 给 + recipient + verb/thing.', teacherHint: '送给 (give as a gift) is a compound that is very natural: 我送给他一件礼物. Introduce it as a high-frequency collocation.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你最近给朋友发消息了吗？ — Did you message a friend recently?', studentAction: 'Produce: 我给[person]发了[type of message].', teacherHint: '你给谁买过礼物？ — Who have you bought a gift for? Personalizes the indirect object frame.' },
    ],
  },

  {
    contentKey: 'clean dirty mandarin',
    language: 'mandarin',
    displayName: '干净 / 脏 — 描述 (Clean / Dirty)',
    unitType: 'verb',
    vocabTerms: ['干净', '脏', 'gānjìng', 'zāng', 'clean', 'dirty', 'adjective predicate', '很', '不太', 'description'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"干净" — clean. "脏" — dirty. Adjectives are predicates — no 是 needed. 这里很干净. Say: gānjìng, zāng.', studentAction: 'Repeat 干净 and 脏 in predicate position.', teacherHint: 'Adjective predicate: [subject] + 很 + adj (no 是). The 很 is required but often nearly unstressed. ❌ 这里是干净 ✓ 这里很干净. Drill the no-是 rule.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '这件衣服很干净 — This piece of clothing is very clean. 那个厕所真的很脏. Read descriptive sentences.', studentAction: 'Read adjective predicate sentences with degree adverbs.', teacherHint: 'Degree spectrum: 非常 (extremely), 很 (very), 比较 (relatively), 有点儿 (a little), 不太 (not very), 不 (not). Natural grading system.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Describe each scene — clean or dirty, and how much? Scan the columns.', studentAction: 'Build descriptions with adjective predicates and degree adverbs.', teacherHint: 'More adjective pairs: 大/小 (big/small), 新/旧 (new/old), 贵/便宜 (expensive/cheap), 好/坏 (good/bad). All same frame.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你的房间干净吗？ — Is your room clean? Answer with degree adverb.', studentAction: 'Produce: 我的房间[degree]+干净/有点儿脏.', teacherHint: 'Honest self-assessment often produces funny, memorable sentences. Let students be real.' },
    ],
  },

  {
    contentKey: 'i studied mandarin',
    language: 'mandarin',
    displayName: '我学习了 — 过去学习 (I Studied)',
    unitType: 'preterite',
    vocabTerms: ['学习了', '学了', '我学习了', 'I studied', '了', '工作了', '睡觉了', '运动了', 'verb + 了'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我学习了三个小时" — I studied for three hours. 了 marks completion. Say: wǒ xuéxí le.', studentAction: 'Repeat 我学习了 and 我工作了.', teacherHint: 'Duration: verb + 了 + duration + verb (reduplicated) OR just verb + 了 + time. 我学习了三个小时. High frequency: 了 + time duration.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我昨晚学习了很久 — I studied for a long time last night. 他刚才运动了. Read past-action sentences with duration.', studentAction: 'Read 了 sentences with time duration expressions.', teacherHint: '刚才 (just now), 昨晚 (last night), 前几天 (a few days ago). Natural time expressions that anchor 了 in the past.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What did each person do and for how long? Combine verb + 了 + duration.', studentAction: 'Build: subject + verb + 了 + [duration/object].', teacherHint: 'Duration collocations: 学了很久 (studied for a long time), 睡了八个小时 (slept for eight hours). Very natural.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你昨天学了几个小时中文？ — How many hours of Chinese did you study yesterday?', studentAction: 'Produce: 我学了[N]个小时中文.', teacherHint: '你觉得够吗？ — Do you think that was enough? Natural conversational follow-up.' },
    ],
  },

  {
    contentKey: 'i received mandarin',
    language: 'mandarin',
    displayName: '我收到了 — 结果补语 (I Received)',
    unitType: 'preterite',
    vocabTerms: ['收到了', '收到', 'shōudào le', 'I received', 'resultative complement', '到', '买到了', '找到了'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我收到了一封信" — I received a letter. 收到 = receive (collect + arrive). 到 is a resultative complement. Say: shōu dào le.', studentAction: 'Repeat 收到了 and 买到了.', teacherHint: 'Resultative complements: verb + 到/好/完/到/上... = [do] + [result]. 收到 = successfully received. 买到 = successfully bought. 找到 = successfully found. 到 = arrival/attainment of result.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '我找到了我的钥匙 — I found my keys (successfully). 她买到了折扣票. Read resultative complement sentences.', studentAction: 'Read verb + resultative complement sentences.', teacherHint: 'The most common resultative complements: 到 (attained), 好 (done well), 完 (finished), 见 (saw/perceived), 懂 (understood). Introduce 到 first as the most frequent.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Did each person successfully [do] something? Build with resultative complements.', studentAction: 'Build: subject + verb + 到/好/完 + 了 + object.', teacherHint: 'Negative: 没找到 (didn\'t find), 没收到 (didn\'t receive). Drops 了. Very natural failure reports.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你收到我发的消息了吗？ — Did you receive the message I sent?', studentAction: 'Produce: 收到了 / 没收到.', teacherHint: '你找到你的手机了吗？ — Did you find your phone? Super practical resultative context.' },
    ],
  },

  {
    contentKey: 'i will mandarin',
    language: 'mandarin',
    displayName: '我会 — 未来与预测 (I Will)',
    unitType: 'verb',
    vocabTerms: ['会', '将会', 'huì', 'I will', 'future', 'prediction', '将来', '以后', '明年会'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"我会去" — I will go. 会 = will (prediction/likelihood) + can (skill). Same character, both meanings. Say: huì.', studentAction: 'Repeat 我会去 and 明天会下雨.', teacherHint: '会 for future/prediction: 明天会下雨 (it will rain tomorrow). 会 for ability: 我会游泳 (I can swim). Context distinguishes them. Focus on prediction use here.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: '他以后会成功的 — He will succeed in the future. 这件事会变好的. Read future prediction sentences.', studentAction: 'Read 会 + future prediction sentences.', teacherHint: '的 at sentence end softens and adds assurance: 会好的 (it will be okay). Very comforting phrase. Note the 的 function here.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Make predictions about the future. Use 会 for likelihood.', studentAction: 'Build: subject + 会 + verb phrase [+ 的].', teacherHint: '将来 (in the future), 以后 (later/after), 明年 (next year). Pair with 会 for clear future framing.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: '你觉得你以后会做什么工作？ — What job do you think you will do in the future?', studentAction: 'Produce: 我觉得我以后会[profession/activity].', teacherHint: '为什么？ — always follow up with reason. 因为我喜欢... Connects desire grammar with future grammar.' },
    ],
  },

];

// ─────────────────────────────────────────────────────────────────────────────
// ENGLISH (ESL) UNITS
// ─────────────────────────────────────────────────────────────────────────────

const ENGLISH_UNITS: MadrigalLoopUnit[] = [

  {
    contentKey: 'where are you going english',
    language: 'english',
    displayName: 'I Go — Going Places',
    unitType: 'verb',
    vocabTerms: ['I go', 'she goes', 'go', 'going', 'where are you going', 'to', 'I am going to', 'destination', 'hotel', 'school'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I go" — I go (simple present). "I am going" — I am going right now. "Where are you going?" Say them.', studentAction: 'Repeat I go, I am going, and Where are you going?', teacherHint: 'Three forms of going: simple (I go — routine), progressive (I am going — now), question (Where are you going?). All high frequency.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'I am going to the hotel. She goes to school every day. Read each destination sentence aloud.', studentAction: 'Read going sentences using the correct form.', teacherHint: 'Preposition: to + destination. I go TO school (not I go school). The preposition is obligatory in English — drill it consistently.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Scan the columns — who is going where? Build: subject + am/is/are going to + destination.', studentAction: 'Combine going sentences rapidly.', teacherHint: 'Subject-verb agreement with be: I am going, she is going, we are going. Three forms of "be" — drill all three.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Where are you going after class today? Answer with I am going to...', studentAction: 'Produce: I am going to [destination].', teacherHint: 'Where does she go every morning? — third-person: she goes. Notice the -s ending. Drill the contrast.' },
    ],
  },

  {
    contentKey: 'i took english',
    language: 'english',
    displayName: 'I Took — Simple Past (Irregular)',
    unitType: 'preterite',
    vocabTerms: ['I took', 'took', 'take', 'simple past', 'irregular', 'she took', 'past tense', 'yesterday', 'last week'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I took" — I took (past of take). Take → took. This is an irregular verb. Say: took.', studentAction: 'Repeat I took and She took.', teacherHint: 'take → took is a strong irregular. The pattern: take/took/taken. For now focus on took (simple past). No -ed ending — that is the key point.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'I took the bus to school yesterday. She took a photo. Read each past sentence.', studentAction: 'Read past sentences with took and time words.', teacherHint: 'Time words that signal past: yesterday, last week, this morning, an hour ago. Any of these automatically puts us in simple past.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who took what? Combine: subject + took + object.', studentAction: 'Build past sentences with took.', teacherHint: 'Negation: did not take / didn\'t take. Note: infinitive after did (I didn\'t take — NOT I didn\'t took). Common error.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'What did you take to school today? Answer: I took...', studentAction: 'Produce: I took [item] to school.', teacherHint: 'What did she take? — third-person question. Note: Did she take... (question form uses did + infinitive).' },
    ],
  },

  {
    contentKey: 'i bought english',
    language: 'english',
    displayName: 'I Bought — Simple Past',
    unitType: 'preterite',
    vocabTerms: ['I bought', 'bought', 'buy', 'past tense', 'irregular', 'shopping', 'yesterday', '-ed pattern'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I bought" — I bought (past of buy). Buy → bought. Another irregular. Say: bought.', studentAction: 'Repeat I bought and She bought.', teacherHint: 'buy → bought is another strong irregular. Group these for memory: buy/bought, bring/brought, think/thought — the -ought family.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'I bought a new phone last week. She bought groceries this morning. Read each shopping sentence.', studentAction: 'Read past sentences with bought and real contexts.', teacherHint: 'Object always follows bought: I bought [thing]. Preposition optional: I bought it at the store. Natural context: shopping trip.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who bought what? Scan and combine rapidly.', studentAction: 'Build: subject + bought + object.', teacherHint: 'Mix in other common irregular pasts alongside bought: bought, saw, ate, went, got. Reinforce the irregular past family.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'What did you buy recently? Answer: I bought...', studentAction: 'Produce: I bought [item] at/from [place].', teacherHint: 'Where did you buy it? — layer in place prepositional phrase for richer sentences.' },
    ],
  },

  {
    contentKey: 'i am going to english',
    language: 'english',
    displayName: "I'm Going To — Near Future",
    unitType: 'verb',
    vocabTerms: ["I'm going to", 'going to', 'near future', 'be + going to', 'plan', 'will', "she's going to", 'intention'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I\'m going to go" — I am going to go (near future). Be + going to + infinitive. Say: I\'m going to.', studentAction: "Repeat I'm going to and She's going to.", teacherHint: 'be + going to = planned/intended future. Am/is/are going to — agreement with subject. Most common future in spoken English.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: "I'm going to study tonight. She's going to call her friend. Read each future sentence.", studentAction: 'Read going-to future sentences with plans.', teacherHint: 'Contrast: will (spontaneous decision now) vs going to (pre-planned). I\'ll help (right now). I\'m going to study (already decided). Both important.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What are these people going to do? Combine subjects and plans.', studentAction: "Build: subject + am/is/are going to + verb.", teacherHint: 'Common error: I going to go (missing am). Require the be verb every time.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: "What are you going to do this weekend? Answer: I'm going to...", studentAction: "Produce: I'm going to [activity] this weekend.", teacherHint: "What is she going to do? — third-person: She's going to... Watch the contraction." },
    ],
  },

  {
    contentKey: 'i have english',
    language: 'english',
    displayName: 'I Have — Possession',
    unitType: 'verb',
    vocabTerms: ['I have', 'she has', 'have', 'has', 'possession', "I don't have", "she doesn't have", 'do you have'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I have a dog." — I have (possession). "She has a cat." — has for third person. Say both.', studentAction: 'Repeat I have and She has.', teacherHint: 'Have → has for he/she/it. The third-person -s rule. Very high frequency error to catch: She have ✗ → She has ✓.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'I have two brothers. He has a big house. Read possession sentences.', studentAction: 'Read possession sentences with have/has.', teacherHint: 'Questions: Do you have...? Does she have...? The do/does subject-auxiliary is critical. Do you have time? — extremely common.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who has what? Combine subjects with possessions.', studentAction: 'Build: subject + have/has + [number/article] + noun.', teacherHint: 'Negative: I don\'t have, She doesn\'t have. The don\'t/doesn\'t pair. Drill all four: have, has, don\'t have, doesn\'t have.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Do you have any siblings? Answer: I have... / I don\'t have...', studentAction: 'Produce: I have [number] brothers/sisters. OR I don\'t have any.', teacherHint: "Does she have a pet? — third-person question. Does she have / doesn't she have. Model both forms." },
    ],
  },

  {
    contentKey: 'i want english',
    language: 'english',
    displayName: 'I Want — Expressing Desires',
    unitType: 'verb',
    vocabTerms: ['I want', 'I want to', 'want', 'desire', 'I would like', "she wants", 'want + noun', 'want to + verb'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I want a coffee." — want + noun. "I want to go." — want to + verb. Two patterns. Say them.', studentAction: 'Repeat I want a coffee and I want to go.', teacherHint: 'Want + noun (I want a coffee) vs want to + infinitive (I want to sleep). Both patterns are essential and very frequent.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'She wants to visit France. He wants a new phone. Read desire sentences.', studentAction: 'Read want sentences with correct third-person wants.', teacherHint: 'She wants (not she want). Third-person -s is a persistent English ESL challenge. Address it consistently.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person want to do or have? Combine from the columns.', studentAction: 'Build want sentences using want + noun and want to + verb.', teacherHint: 'Polite upgrade: I would like = polite version of I want. Introduce here as a register note.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'What do you want to do after school? Answer: I want to...', studentAction: 'Produce: I want to [activity].', teacherHint: "What does she want to do? — third-person: She wants to. Drill the -s thoroughly." },
    ],
  },

  {
    contentKey: 'i am identity english',
    language: 'english',
    displayName: 'I Am — Identity (To Be)',
    unitType: 'ser_estar',
    vocabTerms: ['I am', 'she is', 'they are', 'to be', 'am/is/are', 'identity', "I'm a student", 'am not', "isn't"],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I am a student." To be = am/is/are for identity. Say: I am, she is, they are.', studentAction: 'Repeat all three forms: I am, she is, they are.', teacherHint: 'To be: am (I), is (he/she/it), are (you/we/they). Six-cell agreement chart is the core knowledge. Students confuse is/are constantly.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'She is a teacher. They are students. I am from Mexico. Read identity sentences.', studentAction: 'Read identity sentences matching subject with am/is/are.', teacherHint: 'Questions: Am I? Is she? Are they? — subject-auxiliary inversion. Short answers: Yes, she is. No, they are not.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Match people with their identities and roles. Use am/is/are correctly.', studentAction: 'Build identity sentences with correct to-be agreement.', teacherHint: 'Negation: am not, is not (isn\'t), are not (aren\'t). Contractions are more natural in speech.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'What are you? (Job, student, athlete?) Answer: I am a...', studentAction: 'Produce: I am a [role/identity].', teacherHint: 'Where are you from? — very natural follow-up. I am from [place]. Same to-be structure.' },
    ],
  },

  {
    contentKey: 'where am i english',
    language: 'english',
    displayName: 'Where Am I? — Location (To Be)',
    unitType: 'ser_estar',
    vocabTerms: ['I am at', 'she is in', 'location', 'to be + location', 'at/in/on', 'where are you?', 'at school', 'in the park'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I am at school." — location with to be + preposition. Say: I am at, she is in, they are on.', studentAction: 'Repeat I am at school, She is in the kitchen, They are on the bus.', teacherHint: 'Location prepositions with to be: at (specific point/institution), in (enclosed space), on (surface/vehicle). High-frequency trio.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'The book is on the table. I am in the classroom. She is at the gym. Read location sentences.', studentAction: 'Read location sentences choosing at/in/on correctly.', teacherHint: 'Key distinctions: at the store (activity location), in the store (physically inside), on the bus (vehicle). Context drives choice.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Where is each person or object? Combine with the correct preposition.', studentAction: 'Build: subject + am/is/are + at/in/on + location.', teacherHint: 'Very common questions: Where are you? Where is she? Full answer: I am at + place.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Where are you right now? Answer: I am in/at...', studentAction: 'Produce: I am [in/at] [location].', teacherHint: 'Where is your phone? — object location: It is on/in/at... Common and practical.' },
    ],
  },

  {
    contentKey: 'i can english',
    language: 'english',
    displayName: 'I Can — Expressing Ability',
    unitType: 'verb',
    vocabTerms: ['I can', 'can', 'ability', "I can't", 'cannot', 'can she?', 'can you?', 'infinitive after can'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I can swim." — I can + infinitive. No -s. Say: I can swim, She can cook, They can drive.', studentAction: 'Repeat I can swim, She can cook, They can drive.', teacherHint: 'Can + infinitive — NO subject agreement, NO -s. She can (not she cans). This is a key difference from regular verbs.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'She can speak three languages. I cannot drive yet. Read ability sentences.', studentAction: 'Read ability sentences with can/cannot.', teacherHint: 'Can/cannot/can\'t. Questions: Can you...? Can she...? No do/does needed with modals. Another key English rule.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What can each person do? Combine subjects and abilities.', studentAction: 'Build: subject + can/cannot + infinitive.', teacherHint: 'Real abilities: Can you cook? Can she drive? Do you play tennis? (Without can = do you know how to). Both are natural.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Can you speak any other languages? Answer: I can... / I cannot...', studentAction: 'Produce: I can speak [language]. OR I can only speak English so far.', teacherHint: 'What can you do that your friend cannot? — contrastive ability pair. Engaging.' },
    ],
  },

  {
    contentKey: 'the verb pattern english',
    language: 'english',
    displayName: 'The Infinitive Pattern',
    unitType: 'verb',
    vocabTerms: ['infinitive', 'to + verb', 'modal + verb', 'want to', 'have to', 'need to', 'going to', 'able to'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: 'The infinitive = to + verb base form. I want TO go. I need TO study. I have TO work. Say each.', studentAction: 'Repeat want to, need to, have to, going to.', teacherHint: 'The infinitive frame is the most productive pattern in English: modal/semi-modal + infinitive. Once students own to + verb, they unlock dozens of structures.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'I need to call my mom. She wants to travel. He has to work tomorrow. Read each infinitive sentence.', studentAction: 'Read sentences with different semi-modals + infinitive.', teacherHint: 'Semi-modals: want to, need to, have to, going to, able to, used to. All high-frequency. All take the base form infinitive after to.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person need, want, or have to do? Combine from the columns.', studentAction: 'Build: subject + semi-modal + to + verb.', teacherHint: 'Negation varies: I don\'t want to go. She doesn\'t need to work. He doesn\'t have to stay. The do-support pattern.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'What do you need to do this week? Answer: I need to...', studentAction: 'Produce: I need to [verb] this week.', teacherHint: 'What do you want to do but have to wait for? — contrasts want to vs have to. Generates real self-expression.' },
    ],
  },

  {
    contentKey: 'there is english',
    language: 'english',
    displayName: 'There Is / There Are',
    unitType: 'hay_gustar',
    vocabTerms: ['there is', 'there are', 'there is a', 'there are some', "there isn't", "there aren't", 'how many are there'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"There is a park near here." — there is (singular). "There are many restaurants." — there are (plural). Say both.', studentAction: 'Repeat There is a park and There are many restaurants.', teacherHint: 'There is + singular noun. There are + plural noun. Agreement rule. Very common error: There is many books ✗ → There are many books ✓.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'There is a coffee shop on the corner. There are three students in the hall. Read existence sentences.', studentAction: 'Read existence sentences with there is/are.', teacherHint: 'Questions: Is there a...? Are there any...? Inversion: Is there → Yes, there is. Are there → Yes, there are.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What is or are in each location? Combine: There is/are + [number/article] + noun.', studentAction: 'Build existence sentences from the columns.', teacherHint: 'Quantifiers: There is a (one), some (unspecified positive amount), no (zero). There are two, many, several, a few. Build the full quantifier set.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Is there a supermarket near your home? Answer: Yes, there is... / No, there is not...', studentAction: 'Produce: There is/are [thing] near my home.', teacherHint: 'How many students are there in this class? — count the room. Practical and engaging.' },
    ],
  },

  {
    contentKey: 'i like english',
    language: 'english',
    displayName: 'I Like — Expressing Preferences',
    unitType: 'hay_gustar',
    vocabTerms: ['I like', 'I love', "I don't like", 'preference', 'like + noun', 'like + -ing', "she likes", 'enjoy'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I like music." — like + noun. "I like swimming." — like + -ing. Say both.', studentAction: 'Repeat I like music and I like swimming.', teacherHint: 'Like + noun OR like + gerund (-ing). Both are correct. I like to swim is also correct. For now: like + noun and like + -ing.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'She likes hiking and cooking. He doesn\'t like cold weather. Read preference sentences.', studentAction: 'Read preference sentences with third-person likes.', teacherHint: 'She likes (not she like). Third-person -s again. Also: I love (stronger), I enjoy, I don\'t mind, I don\'t like, I hate (scale).' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What does each person like or not like? Build preference statements.', studentAction: 'Build: subject + like/love/don\'t like + noun/gerund.', teacherHint: 'Genre: I like rock music. I don\'t like pop. Expressing musical taste is immediately engaging and generates natural output.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'What kind of music do you like? Answer: I like...', studentAction: 'Produce: I like [genre/type].', teacherHint: 'Do you like cooking or eating? — gerund pair. Both like + gerund forms are natural question choices.' },
    ],
  },

  {
    contentKey: 'i would like english',
    language: 'english',
    displayName: 'I Would Like — Polite Requests',
    unitType: 'verb',
    vocabTerms: ["I'd like", 'I would like', 'would like', 'polite request', 'could I have', 'may I have', "I'd like to"],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I would like a coffee." — more polite than I want. "I\'d like to go." — contracted form. Say both.', studentAction: "Repeat I would like and I'd like.", teacherHint: "Would like = polite form of want. Always use would like (not will like). I'd = I would (contraction). Very common in English customer service and social contexts." },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: "I'd like a table for two, please. Could I have the menu? Read polite request sentences.", studentAction: 'Read polite requests in restaurant and service contexts.', teacherHint: "Register: I'd like (standard polite), Could I have (softer request), May I have (formal/careful). All extremely common in English-speaking service contexts." },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: "What would each person like? Build polite requests.", studentAction: "Build: I'd like + [article/measure] + noun OR I'd like to + verb.", teacherHint: 'Restaurant phrases: I\'d like to order... / Could I have the check? / I\'ll have the... — all natural service English.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: "What would you like to drink? Answer: I'd like...", studentAction: "Produce: I'd like [drink/item], please.", teacherHint: 'Roleplay: server asks, student orders. Highly practical and immediately motivating.' },
    ],
  },

  {
    contentKey: 'i went english',
    language: 'english',
    displayName: 'I Went — Simple Past (Irregular Go)',
    unitType: 'preterite',
    vocabTerms: ['I went', 'went', 'go', 'simple past', 'irregular', 'past motion', 'yesterday', 'last weekend'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I went to the store yesterday." — go → went. Completely irregular. Say: went.', studentAction: 'Repeat I went and She went.', teacherHint: 'go → went is completely irregular — no pattern with go at all. Must be memorized. One of the most common verbs in English.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'We went to the beach last summer. She went to a concert last night. Read past motion sentences.', studentAction: 'Read went sentences with time expressions.', teacherHint: 'Common time expressions for went: yesterday, last night, last week, this morning, a year ago. All signal simple past.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Where did each person go? Combine with went + destination.', studentAction: 'Build: subject + went + to + [destination].', teacherHint: 'Questions: Where did you go? — did + infinitive (go, not went). I went... ✓. Where did you went ✗. The did-support rule with infinitive.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Where did you go last weekend? Answer: I went to...', studentAction: 'Produce: I went to [place] last weekend.', teacherHint: 'Did you have a good time? — past of have: had. Natural follow-up.' },
    ],
  },

  {
    contentKey: 'he is going to english',
    language: 'english',
    displayName: 'He Is Going To — Future (3rd Person)',
    unitType: 'verb',
    vocabTerms: ["he's going to", "she's going to", 'third person future', 'narration', 'going to', 'is going to', 'plan'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"He is going to study tonight." — third-person future with be + going to. Say: He\'s going to, She\'s going to.', studentAction: "Repeat He's going to study and She's going to call.", teacherHint: "He is going to → He's going to. Contraction is natural in speech. Third-person: is going to (not am going to). Agreement with is." },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: "She's going to visit her parents. He's going to start a new job. Read third-person future narrations.", studentAction: 'Read third-person going-to future sentences.', teacherHint: "He's going to... vs He will... Subtle: going to = already decided. Will = deciding now. Both natural in third-person narration." },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What are these people going to do? Build third-person future sentences.', studentAction: "Build: he/she/they + is/are going to + infinitive.", teacherHint: "They are going to → They're going to. All three contractions: I'm, he's, they're. All going to." },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: "What is your best friend going to do next year? Answer: She's going to / He's going to...", studentAction: "Produce: [name] is going to [activity].", teacherHint: 'Real person, real plan. Authentic output using known facts about someone real.' },
    ],
  },

  {
    contentKey: 'what did he do english',
    language: 'english',
    displayName: 'What Did He Do? — Past Questions',
    unitType: 'preterite',
    vocabTerms: ['what did he do', 'did', 'past question', 'did + infinitive', 'where did', 'when did', 'auxiliary did'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"What did he do?" — past question with DID + infinitive. Did + base verb (not past form). Say: What did he do?', studentAction: 'Repeat What did he do? and Where did she go?', teacherHint: 'Question formation: Did + subject + infinitive. NOT What did he did? The infinitive after did is critical. This is the most common error in English past-tense questions.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'What did you eat for breakfast? Where did she go last night? Read and answer question pairs.', studentAction: 'Read past questions and produce answers.', teacherHint: 'Short answers: Yes, I did. No, she didn\'t. Full answers use the past form: I ate toast. She went to the gym.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build past questions using what/where/when/why + did + subject + infinitive.', studentAction: 'Combine question words with did + infinitive for different verbs.', teacherHint: 'Question word + did + subject + base verb: When did he arrive? Why did she leave? How did you get there? All follow the same formula.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'What did you do yesterday morning? Give a real answer.', studentAction: 'Produce: I [past verb] in the morning.', teacherHint: 'Ask a follow-up: Who did you talk to? — builds a mini narrative. Chain past questions naturally.' },
    ],
  },

  {
    contentKey: 'he had english',
    language: 'english',
    displayName: 'He Had — Past of Have',
    unitType: 'preterite',
    vocabTerms: ['had', 'he had', 'past of have', 'irregular', 'have/had', 'she had', 'used to have', 'possession in past'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"He had a dog." — have → had (past, all persons). I had, she had, they had. All the same. Say: had.', studentAction: 'Repeat He had and She had and I had.', teacherHint: 'Have → had for all persons — no agreement variation in the past. This is a welcome simplification students appreciate.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'She had a red car in 2020. They had a big party last month. Read past possession sentences.', studentAction: 'Read past possession sentences with had.', teacherHint: 'Questions: Did you have...? Did he have...? (do-support, not had-inversion). What did she have? ✓. What had she? ✗ (in simple past context).' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What did each person have in the past? Combine with had.', studentAction: 'Build: subject + had + [article] + noun.', teacherHint: 'Used to have: She used to have a cat (but she doesn\'t anymore). Useful extension for past habits vs past facts.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Did you have a pet when you were little? Answer: I had... / I didn\'t have...', studentAction: 'Produce: I had/didn\'t have [thing] when I was young.', teacherHint: 'What did you have for lunch yesterday? — practical daily life question. High frequency.' },
    ],
  },

  {
    contentKey: 'to him english',
    language: 'english',
    displayName: 'To Him / To Her — Indirect Object Pronouns',
    unitType: 'object_pronoun',
    vocabTerms: ['to him', 'to her', 'to them', 'indirect object', 'me/him/her/us/them', 'give to', 'tell her', 'show him'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I gave it to him." — to him is the indirect object pronoun. Me, him, her, us, them. Say the set.', studentAction: 'Repeat the pronoun set: me, him, her, us, them.', teacherHint: 'Subject pronouns (I/he/she) vs object pronouns (me/him/her). To me, to him, to her, to us, to them. All after to or in object position.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'She gave the book to me. I told him the news. He showed us the photos. Read indirect object sentences.', studentAction: 'Read sentences with indirect object pronouns.', teacherHint: 'Two patterns: I gave it to him (prep + pronoun) OR I gave him it (pronoun before object). Both natural. Second requires no "to": I gave him the book.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who gave/told/showed what to whom? Combine from the columns.', studentAction: 'Build: subject + verb + object + to + pronoun.', teacherHint: 'High-frequency verbs with indirect objects: give, tell, show, send, lend, teach. Drill all six with the object pronoun set.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Who did you give your last gift to? Answer: I gave it to...', studentAction: 'Produce: I gave [thing] to [person/pronoun].', teacherHint: 'Who did she tell? — question with indirect object. She told me. She told him. Short, clear answers.' },
    ],
  },

  {
    contentKey: 'clean dirty english',
    language: 'english',
    displayName: "It's Clean / It's Dirty — Adjective Descriptions",
    unitType: 'verb',
    vocabTerms: ["it's clean", "it's dirty", 'adjective predicate', 'to be + adjective', 'describing things', 'very', 'a little', 'not very'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"It\'s clean." — to be + adjective. "It\'s dirty." Say both and add: very clean, a little dirty.', studentAction: "Repeat It's clean, It's dirty, It's very clean, It's a little dirty.", teacherHint: 'To be + adjective for predicate description. Clean vs dirty is a classic contrastive pair. Degree adverbs (very, quite, a little, not very) build range immediately.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'The kitchen is very clean. The bathroom is not very clean. Read descriptive sentences.', studentAction: 'Read descriptions with degree adverbs.', teacherHint: 'Degree scale: extremely → very → quite → fairly → a little → not very. Teach this spectrum as a useful resource.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Describe each place or thing — how clean or dirty? Use degree adverbs.', studentAction: 'Build: [subject] + is/are + [degree] + adjective.', teacherHint: 'Extend pair list: new/old, big/small, loud/quiet, fast/slow, hot/cold. All same to-be + adjective frame.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Is your room clean or messy right now? Answer honestly.', studentAction: "Produce: My room is [degree] [adjective] right now.", teacherHint: 'Personal description often generates humor and authentic language. Let students be real.' },
    ],
  },

  {
    contentKey: 'i studied english',
    language: 'english',
    displayName: 'I Studied — Regular Past (-ed)',
    unitType: 'preterite',
    vocabTerms: ['studied', '-ed past', 'I studied', 'regular past', 'walked', 'worked', 'played', 'watched', 'cleaned'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I studied." — study → studied. The -ed suffix makes the past. All regular verbs follow this. Say: studied, worked, played.', studentAction: 'Repeat studied, worked, played, watched.', teacherHint: 'Regular past: verb + -ed. Spelling rules: study → studied (y→ied), stop → stopped (double final consonant). These two rules cover most cases.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'She studied all night. We played soccer yesterday. He worked from home last week. Read regular past sentences.', studentAction: 'Read -ed past sentences in context.', teacherHint: 'Pronunciation of -ed: /t/ after voiceless sounds (worked, walked), /d/ after voiced (played, studied), /ɪd/ after t/d (wanted, needed). Important for listening.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'What did each person do in the past? Build with -ed verbs.', studentAction: 'Combine subjects and regular past verbs rapidly.', teacherHint: 'Core regular past verbs: study, work, play, watch, clean, visit, cook, call, talk, listen. Students need to own these ten.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'How long did you study last night? Answer: I studied for...', studentAction: 'Produce: I studied for [time] last night.', teacherHint: 'What else did you do last night? — open past narration with regular verbs. Chain multiple -ed verbs.' },
    ],
  },

  {
    contentKey: 'i received english',
    language: 'english',
    displayName: 'I Received — Irregular Past',
    unitType: 'preterite',
    vocabTerms: ['received', 'got', 'irregular past', 'I received', 'I got', 'get/got', 'see/saw', 'know/knew', 'past list'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I received a letter." — regular past. "I got a message." — get → got, irregular. Say both.', studentAction: 'Repeat I received and I got.', teacherHint: 'Receive is actually regular (received = -ed). But get → got is the more colloquial equivalent. Learn both — received in writing, got in speech.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'I got a text from my friend. She received a scholarship. He saw a great movie. Read irregular past sentences.', studentAction: 'Read irregular past sentences mixing different verb forms.', teacherHint: 'Build the irregular past inventory: get/got, see/saw, know/knew, think/thought, bring/brought, find/found, tell/told, make/made.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Mix regular and irregular past verbs. Scan and combine.', studentAction: 'Build sentences using both -ed and irregular past forms.', teacherHint: 'Sorting drill: regular (-ed) vs irregular (change). Students who can reliably sort these two classes are making strong progress.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Did you get any good news recently? Answer: Yes, I got... / No, I didn\'t get...', studentAction: 'Produce: I got [news/thing] recently.', teacherHint: 'What news did you receive this week? — formal version. Both versions are real English.' },
    ],
  },

  {
    contentKey: 'i will english',
    language: 'english',
    displayName: 'I Will — Simple Future',
    unitType: 'verb',
    vocabTerms: ['I will', "I'll", 'will', 'future', 'promise', 'prediction', 'offer', "won't", 'will + infinitive'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"I will help you." — will + infinitive. "I\'ll call you later." — contracted I\'ll. Say both.', studentAction: "Repeat I will help and I'll call.", teacherHint: "Will + infinitive for future decisions made NOW (I'll have the pasta), promises (I'll call you), and predictions (It will rain). The spontaneous-decision use is key." },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: "She'll be here at 8. It won't take long. I'll help you with that. Read will sentences.", studentAction: "Read will sentences noting different uses.", teacherHint: "Won't = will not (negative contraction). I won't be late. She won't forget. The contraction is dominant in spoken English." },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Make promises, predictions, and spontaneous offers using will.', studentAction: "Build: subject + will/won't + infinitive.", teacherHint: "Questions: Will you help me? → Yes, I will. / No, I won't. The yes/no pair. Will you = request or question about future. Very common." },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: "What will you do if you have free time tomorrow? Answer: I'll...", studentAction: "Produce: I'll [activity] if I have time.", teacherHint: "I'll + verb (spontaneous plan). Compare with I'm going to (pre-planned). Both are real answers to future questions." },
    ],
  },

];

// ─── Hebrew Verb Chain Units ───────────────────────────────────────────────────
const HEBREW_UNITS: MadrigalLoopUnit[] = [

  // ─── הולך/הולכת — Where Are You Going? ───────────────────────────────────
  {
    contentKey: 'where are you going hebrew',
    language: 'hebrew',
    displayName: 'הולך/הולכת — לאן אתה הולך?',
    unitType: 'verb',
    vocabTerms: ['הולך', 'הולכת', 'ללכת', 'לאן', 'going', 'I am going', 'she is going', 'הוא הולך', 'היא הולכת', 'אנחנו הולכים'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"הולך" — I am going (masculine). "הולכת" — I am going (feminine). The verb is ללכת. Hebrew present tense is gendered. Say: אני הולך / אני הולכת.', studentAction: 'Repeat אני הולך and אני הולכת.', teacherHint: 'Hebrew present tense has four forms: m.sg, f.sg, m.pl, f.pl. Start with the singular pair. The masc/fem distinction is foundational — establish it clearly now.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a place. Read: אני הולך ל… / אני הולכת ל… — the ל preposition means "to."', studentAction: 'Read אני הולך ל / אני הולכת ל sentences with place images.', teacherHint: 'ל before a place: אני הולך לבית הספר, לסופרמרקט, לים. Flag: definite nouns need ל + ה merged into לְ or just ל before the definite article.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who is going where? Match subject to destination.', studentAction: 'Combine: subject + הולך/הולכת + ל + destination.', teacherHint: 'Check gender agreement: a female student uses הולכת. Mix in הוא הולך / היא הולכת for 3rd person. Watch for students defaulting to the masculine form regardless of their gender.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'לאן אתה/את הולך/הולכת אחרי הלימודים? Where are you going after school? Answer with אני הולך/הולכת ל…', studentAction: 'Produce: אני הולך/הולכת ל + destination.', teacherHint: 'Personalize. Any accurate destination works. If students can name it in Hebrew — great. If they code-switch, help them find the Hebrew word.' },
    ],
  },

  // ─── לקחתי — I Took ────────────────────────────────────────────────────────
  {
    contentKey: 'i took hebrew',
    language: 'hebrew',
    displayName: 'לקחתי — I Took',
    unitType: 'verb',
    vocabTerms: ['לקחתי', 'לקח', 'לקחה', 'לקחנו', 'לקחת', 'לקחו', 'took', 'I took', 'he took', 'she took'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"לקחתי" — I took. "הוא לקח" — he took. The root is ל-ק-ח. Hebrew past tense is personal suffix-based, not gender-inflected in 1st person. Say: לקחתי, הוא לקח, היא לקחה.', studentAction: 'Repeat לקחתי, הוא לקח, היא לקחה.', teacherHint: 'Pa\'al past: 1st person singular is -תי suffix for all roots. The 3rd person masc/fem split (לקח/לקחה) is important. This root is "strong" — no weak letters.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows something taken. Read: לקחתי את ה…  — את marks the direct object.', studentAction: 'Read לקחתי sentences noting את before definite objects.', teacherHint: 'את is the definite direct object marker — one of Hebrew\'s most important function words. לקחתי ספר (indefinite, no את) vs לקחתי את הספר (definite, needs את). Establish the rule now.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build: subject + past form + את + object. Mix persons and genders.', studentAction: 'Combine across columns rapidly.', teacherHint: 'לקחתי, לקחת, הוא לקח, היא לקחה — four high-frequency forms. The -תי/-תְ/-ה pattern is the Pa\'al past paradigm.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה לקחת הבוקר? What did you take this morning? Answer: לקחתי את ה…', studentAction: 'Produce: לקחתי את ה + object.', teacherHint: 'Accept any accurate answer. Reward use of את with definite objects.' },
    ],
  },

  // ─── קניתי — I Bought ──────────────────────────────────────────────────────
  {
    contentKey: 'i bought hebrew',
    language: 'hebrew',
    displayName: 'קניתי — I Bought',
    unitType: 'verb',
    vocabTerms: ['קניתי', 'קנה', 'קנתה', 'קנינו', 'לקנות', 'bought', 'I bought', 'he bought', 'she bought', 'קנית'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"קניתי" — I bought. "הוא קנה" — he bought. "היא קנתה" — she bought. Root ק-נ-ה — a weak root (final ה). Say: קניתי, הוא קנה, היא קנתה.', studentAction: 'Repeat קניתי, הוא קנה, היא קנתה.', teacherHint: 'Roots ending in ה are "weak" — the final ה drops in some forms. קנה (he bought) vs קנתה (she bought). The -תה ending for f.sg past is the pattern.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show things bought. Read: קניתי את ה… / הוא קנה…', studentAction: 'Read קניתי sentences with shopping images.', teacherHint: 'Reinforce את with definite objects. קניתי ספר (I bought a book — indefinite) vs קניתי את הספר (I bought the book — definite). Both are correct in different contexts.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who bought what? Combine subject + past form + object.', studentAction: 'Build shopping sentences in past tense.', teacherHint: 'Check: קניתי, קנית, הוא קנה, היא קנתה, קנינו. This root models all weak-ה Pa\'al verbs: ראה, שתה, עשה follow the same pattern.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה קנית אחרון? What did you buy last? Answer: קניתי…', studentAction: 'Produce: קניתי + (את ה) + object.', teacherHint: 'Celebrate creativity. Any purchase works. Ensure they use the correct personal suffix.' },
    ],
  },

  // ─── הולך ל + שם פועל — I Am Going To ────────────────────────────────────
  {
    contentKey: 'i am going to hebrew',
    language: 'hebrew',
    displayName: 'הולך ל + שם פועל — I Am Going To',
    unitType: 'verb',
    vocabTerms: ['הולך לאכול', 'הולך לקנות', 'הולך ללמוד', 'הולכת לישון', 'going to', 'near future', 'infinitive', 'שם פועל', 'לאכול', 'ללמוד'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: 'Hebrew near future: הולך/הולכת + ל + infinitive. "אני הולך לאכול" — I am going to eat. The infinitive starts with ל. Say: אני הולך לאכול.', studentAction: 'Repeat אני הולך לאכול and אני הולכת לאכול.', teacherHint: 'Hebrew infinitives (שמות פועל) begin with ל: לאכול, לקנות, ללמוד. The going-to future uses the same הולך/הולכת that students already know from Unit 1 — make that connection explicit.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Each image shows a planned activity. Read: אני הולך/הולכת + ל + infinitive.', studentAction: 'Read near-future sentences with action images.', teacherHint: 'Drill the infinitive list: לאכול (to eat), לשתות (to drink), לקנות (to buy), ללמוד (to study), לישון (to sleep), ללכת (to go). These are the 6 most useful infinitives.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who is going to do what? Combine: subject + הולך/הולכת + ל + infinitive.', studentAction: 'Build plans using the near-future structure.', teacherHint: 'Gender discipline: female students use הולכת. Check that the infinitive follows ל directly. No conjugation of the second verb — it stays in infinitive form.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה אתה/את הולך/הולכת לעשות הערב? What are you going to do tonight? Answer: אני הולך/הולכת ל…', studentAction: 'Produce: אני הולך/הולכת + ל + infinitive.', teacherHint: 'Highly personalizable. This structure is the backbone of everyday Hebrew planning language.' },
    ],
  },

  // ─── יש לי — I Have ────────────────────────────────────────────────────────
  {
    contentKey: 'i have hebrew',
    language: 'hebrew',
    displayName: 'יש לי — I Have',
    unitType: 'verb',
    vocabTerms: ['יש לי', 'אין לי', 'יש לו', 'יש לה', 'יש', 'אין', 'I have', 'I do not have', 'he has', 'she has'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"יש לי" — I have (literally: there-is to-me). "אין לי" — I do not have. Hebrew has no verb "to have" — instead יש/אין + ל + pronoun. Say: יש לי, אין לי.', studentAction: 'Repeat יש לי and אין לי.', teacherHint: 'This is a major structural difference from English. יש = existence/presence. יש לי = it exists to me = I have. אין = absence. יש לי כלב. אין לי חתול. The ל preposition carries the possessor.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show owned things. Read: יש לי… / אין לי…', studentAction: 'Read יש לי / אין לי sentences with possession images.', teacherHint: 'Extend to other persons: יש לו (he has), יש לה (she has), יש לנו (we have). The ל suffix changes: לי, לך, לו, לה, לנו, לכם, להם. Focus on לי and לו/לה for now.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who has what? Build: יש/אין + ל + person + object.', studentAction: 'Combine possession sentences rapidly.', teacherHint: 'יש לי / אין לי contrast is the core. Also drill the question form: יש לך…? Do you have a…? Answer: כן, יש לי / לא, אין לי.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'יש לך אח או אחות? Do you have a brother or sister? Answer: כן, יש לי… / לא, אין לי…', studentAction: 'Produce: כן יש לי / לא אין לי + noun.', teacherHint: 'Personal, memorable. Extend to יש לי שני אחים (I have two brothers) for students who want more.' },
    ],
  },

  // ─── אני רוצה — I Want ─────────────────────────────────────────────────────
  {
    contentKey: 'i want hebrew',
    language: 'hebrew',
    displayName: 'אני רוצה — I Want',
    unitType: 'verb',
    vocabTerms: ['אני רוצה', 'אני רוצה לאכול', 'הוא רוצה', 'היא רוצה', 'רצה', 'רוצה', 'want', 'I want', 'he wants', 'she wants'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"אני רוצה" — I want (masculine). "אני רוצה" — also used by females (same form! — present participle-style). But formally: m=רוצה, f=רוצה — same spelling, same pronunciation. Root ר-צ-ה. Say: אני רוצה.', studentAction: 'Repeat אני רוצה. Then: אני רוצה לאכול.', teacherHint: 'רוצה is the same for m.sg and f.sg in modern spoken Hebrew. The formal f.sg is רוצָה vs רוֹצֶה in nikud, but in unpointed text and speech they are identical. No need to drill distinction here.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show desired things. Read: אני רוצה + noun or + ל + infinitive.', studentAction: 'Read אני רוצה sentences.', teacherHint: 'Two patterns: (1) רוצה + noun: אני רוצה מים (I want water); (2) רוצה + ל + infinitive: אני רוצה לאכול (I want to eat). Drill both.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who wants what? Build: subject + רוצה + noun or infinitive.', studentAction: 'Combine desire sentences rapidly.', teacherHint: 'הוא רוצה, היא רוצה, אנחנו רוצים (we want — note plural form). The plural adds -ים: רוצים (m.pl), רוצות (f.pl).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה אתה/את רוצה לעשות בסוף השבוע? What do you want to do this weekend? Answer: אני רוצה ל…', studentAction: 'Produce: אני רוצה + ל + infinitive.', teacherHint: 'Highly productive. Any accurate answer works. The construction רוצה + ל + infinitive is one of the 5 most common Hebrew spoken patterns.' },
    ],
  },

  // ─── אני — זהות — I Am (Identity) ────────────────────────────────────────
  {
    contentKey: 'i am identity hebrew',
    language: 'hebrew',
    displayName: 'אני — זהות — I Am',
    unitType: 'verb',
    vocabTerms: ['אני', 'הוא', 'היא', 'סטודנט', 'סטודנטית', 'מורה', 'identity', 'I am', 'he is', 'she is', 'nominal sentence'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: 'Hebrew identity sentences have NO verb: "אני סטודנט" — I (am a) student. No word for "am." The subject pronoun + noun is the complete sentence. Say: אני סטודנט / אני סטודנטית.', studentAction: 'Repeat אני סטודנט and אני סטודנטית.', teacherHint: 'The zero-copula in present tense is fundamental to Hebrew. "Nominal sentence" (משפט שמני). Only in past/future is the verb להיות used. Present tense: pronoun + noun/adjective. This surprises English speakers — lean into it.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show professions and identities. Read: אני ___. הוא ___. היא ___.', studentAction: 'Read identity sentences without a verb.', teacherHint: 'Professions in Hebrew are gender-marked: מורה/מורה (teacher — same!), סטודנט/סטודנטית, רופא/רופאה, עורך-דין/עורכת-דין. Focus on common ones.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who is what? Combine pronoun + profession/identity noun.', studentAction: 'Build: אני/הוא/היא + identity noun.', teacherHint: 'Adding adjectives: אני סטודנט טוב (I am a good student). No verb still. The adjective follows the noun and agrees in gender: טוב/טובה.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מי אתה/את? Who are you? Answer: אני + your identity.', studentAction: 'Produce: אני + name/identity/profession.', teacherHint: 'אני [name]. אני סטודנט/ית. אני אמריקאי/ת. All are valid. The zero-copula should now feel natural.' },
    ],
  },

  // ─── איפה אני? — Where Am I? ──────────────────────────────────────────────
  {
    contentKey: 'where am i hebrew',
    language: 'hebrew',
    displayName: 'איפה אני? — Where Am I?',
    unitType: 'verb',
    vocabTerms: ['איפה', 'נמצא', 'נמצאת', 'בבית', 'בבית הספר', 'where', 'located', 'I am at', 'he is at', 'location'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"איפה אני?" — Where am I? Location uses the verb נמצא/נמצאת (located, to be found). "אני נמצא ב…" — I am at / I am in. The prefix ב means "in/at." Say: אני נמצא בבית הספר.', studentAction: 'Repeat אני נמצא / אני נמצאת + ב + location.', teacherHint: 'נמצא (m) / נמצאת (f) is the present participle of the verb למצוא/להימצא. In informal speech "אני ב…" (I am at) is common without נמצא. Teach the full form first.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show locations. Read: אני נמצא/נמצאת ב + location.', studentAction: 'Read location sentences.', teacherHint: 'Common locations: בבית (at home), בבית הספר (at school), בסופרמרקט (at the supermarket), בפארק (at the park), בחוף הים (at the beach). The ב preposition merges with definite article: ב + ה = בְּ.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Who is where? Combine: subject + נמצא/נמצאת + ב + location.', studentAction: 'Build location sentences rapidly.', teacherHint: '3rd person: הוא נמצא / היא נמצאת. Question form: איפה הוא נמצא? The question word איפה moves to the front.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'איפה אתה/את נמצא/נמצאת עכשיו? Where are you right now? Answer: אני נמצא/נמצאת ב…', studentAction: 'Produce: אני נמצא/נמצאת ב + current location.', teacherHint: 'The answer is obvious — they are in class. Then pivot: ואחרי הלימודים, איפה תהיה? (And after school, where will you be?) — preview the future tense.' },
    ],
  },

  // ─── אני יכול/יכולה — I Can ───────────────────────────────────────────────
  {
    contentKey: 'i can hebrew',
    language: 'hebrew',
    displayName: 'אני יכול/יכולה — I Can',
    unitType: 'verb',
    vocabTerms: ['אני יכול', 'אני יכולה', 'לא יכול', 'יכול לרוץ', 'יכולה לדבר', 'can', 'I can', 'I cannot', 'ability', 'יכולת'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"אני יכול" — I can (masculine). "אני יכולה" — I can (feminine). Root י-כ-ל. Followed by ל + infinitive. Say: אני יכול לדבר / אני יכולה לדבר עברית.', studentAction: 'Repeat אני יכול לדבר and אני יכולה לדבר.', teacherHint: 'Unlike רוצה (same for m/f), יכול (m) and יכולה (f) are distinct. This is a perfect opportunity to reinforce the gender distinction. יכול + ל + infinitive is the ability construction.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show skills and abilities. Read: אני יכול/יכולה ל…', studentAction: 'Read ability sentences.', teacherHint: 'Useful ability verbs: לרוץ (run), לשחות (swim), לנגן בגיטרה (play guitar), לדבר ספרדית (speak Spanish), לבשל (cook). Negation: אני לא יכול/יכולה ל…' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who can do what? Build ability sentences.', studentAction: 'Combine: subject + יכול/יכולה + ל + infinitive.', teacherHint: '3rd person: הוא יכול / היא יכולה. Plural: הם יכולים / הן יכולות. Keep focus on singular for now.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה אתה/את יכול/יכולה לעשות טוב מאוד? What can you do really well? Answer: אני יכול/יכולה ל…', studentAction: 'Produce: אני יכול/יכולה + ל + skill infinitive.', teacherHint: 'Personalize freely. מאוד (very much/really) is a useful adverb to add. Celebrate genuine skills.' },
    ],
  },

  // ─── מבנה הפועל — The Verb Pattern ───────────────────────────────────────
  {
    contentKey: 'the verb pattern hebrew',
    language: 'hebrew',
    displayName: 'מבנה הפועל — בניין קל',
    unitType: 'verb',
    vocabTerms: ['בניין', 'שורש', 'פעל', 'קל', 'binyan', 'root', 'Pa\'al', 'verb pattern', 'קוטל', 'כותב'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: 'Hebrew verbs are built from 3-letter roots placed into patterns called בניינים (binyanim). The most common is בניין קל (Pa\'al). Root כ-ת-ב (write): כותב (writing), כתב (wrote), יכתוב (will write). One root → many words.', studentAction: 'Repeat: כ-ת-ב → כותב → כתב → יכתוב.', teacherHint: 'This meta-unit teaches the system itself. Students who understand roots and patterns can decode new words. The root system is uniquely Hebrew/Semitic. Use כ-ת-ב as the model — it\'s clean, common, and all forms are regular.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'See how the root ל-מ-ד (learn/study) works in Pa\'al: לומד (learning), למד (learned), ילמד (will learn). Same root, different patterns.', studentAction: 'Identify the root in: לומד, למדתי, ילמד.', teacherHint: 'ל-מ-ד is strategically chosen because students already know למדתי (I studied) from the chain. Connect new meta-knowledge to what they already know.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Given these roots, identify the Pa\'al present form: ש-מ-ע (hear), ד-ב-ר (speak), א-כ-ל (eat).', studentAction: 'Produce present tense Pa\'al: שומע, מדבר, אוכל.', teacherHint: 'Pa\'al present pattern: CoCeC for m.sg (כוֹתֵב, שׁוֹמֵעַ, אוֹכֵל). The vowel pattern o-e is the Pa\'al present signature. Note: some roots have quirks (א-כ-ל → אוכל, not *אָכֵל).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'You know the root ד-ב-ר (speak). How do you say "I spoke" and "I will speak"? Try to predict from the pattern.', studentAction: 'Predict: דיברתי (I spoke), אדבר (I will speak).', teacherHint: 'דיברתי is actually Pi\'el, not Pa\'al — a great teaching moment about binyan differences. אדבר is Pa\'al future. The awareness of patterns helps students guess and remember.' },
    ],
  },

  // ─── יש — There Is ────────────────────────────────────────────────────────
  {
    contentKey: 'there is hebrew',
    language: 'hebrew',
    displayName: 'יש — יש / אין',
    unitType: 'verb',
    vocabTerms: ['יש', 'אין', 'יש כאן', 'אין שם', 'there is', 'there are', 'there is no', 'existence', 'יש בעיה', 'אין בעיה'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"יש" — there is / there are. "אין" — there is no / there are no. These are the Hebrew existential words. They work for both singular and plural. Say: יש כאן כלב. אין כאן חתול.', studentAction: 'Repeat: יש כאן כלב. אין כאן חתול.', teacherHint: 'יש/אין for existence is conceptually different from יש לי/אין לי for possession — though the same words. Existence: יש מסעדה ברחוב (There is a restaurant on the street). Possession: יש לי מסעדה (I have a restaurant). Context clarifies.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show rooms and places. Read: יש + noun + ב + location. Or: אין + noun + ב + location.', studentAction: 'Read existence sentences.', teacherHint: 'יש ספה בסלון (There is a sofa in the living room). אין מחשב בחדר השינה (There is no computer in the bedroom). The location follows the noun.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — what is or is not in these places? Build יש/אין sentences.', studentAction: 'Combine: יש/אין + noun + ב + location.', teacherHint: 'Spoken Hebrew often drops ב + location and just says יש מסעדה here. Both are correct. The question form: ?יש פה…? (Is there… here?) takes rising intonation.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'יש לך שיעורי בית היום? Do you have homework today? Or: יש מסעדה טובה ליד ביתך? Answer with יש or אין.', studentAction: 'Produce: כן יש / לא אין + detail.', teacherHint: 'These two uses — possession (יש לך) and existence (יש מסעדה) — show the range of יש/אין. Students who master both are thinking in Hebrew.' },
    ],
  },

  // ─── אני אוהב — I Like ────────────────────────────────────────────────────
  {
    contentKey: 'i like hebrew',
    language: 'hebrew',
    displayName: 'אני אוהב/אוהבת — I Like',
    unitType: 'verb',
    vocabTerms: ['אני אוהב', 'אני אוהבת', 'לא אוהב', 'אוהב לשחק', 'I like', 'I love', 'I don\'t like', 'אהב', 'preference', 'likes'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"אני אוהב" — I like/love (masculine). "אני אוהבת" — I like/love (feminine). Root א-ה-ב. Used for both "like" and "love" — context determines which. Say: אני אוהב מוזיקה. אני אוהבת לשחות.', studentAction: 'Repeat: אני אוהב + noun. אני אוהבת + ל + infinitive.', teacherHint: 'Unlike Spanish (gustar uses indirect object), Hebrew אהב works like English love/like. אני אוהב פיצה — I love pizza. The m/f distinction (אוהב/אוהבת) matters here — reinforce it.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show favorite things and activities. Read: אני אוהב/אוהבת + noun or + ל + infinitive.', studentAction: 'Read preference sentences.', teacherHint: 'Two patterns: (1) אוהב + noun: אני אוהב ספורט; (2) אוהב + ל + infinitive: אני אוהב לשחק כדורגל. The infinitive after ל is the verbal preference form.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who likes what? Build preference sentences.', studentAction: 'Combine: subject + אוהב/אוהבת + object or infinitive.', teacherHint: 'Negation: אני לא אוהב… (I don\'t like…). The לא precedes the verb, not the noun. Very clean negation structure in Hebrew.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה אתה/את הכי אוהב/אוהבת לעשות? What do you like to do most? Answer: אני הכי אוהב/אוהבת ל…', studentAction: 'Produce: אני הכי אוהב/אוהבת + ל + infinitive.', teacherHint: 'הכי (most/best) is the Hebrew superlative adverb. אני הכי אוהב לשחות. A natural, personalized sentence.' },
    ],
  },

  // ─── הייתי רוצה — I Would Like ────────────────────────────────────────────
  {
    contentKey: 'i would like hebrew',
    language: 'hebrew',
    displayName: 'הייתי רוצה — I Would Like',
    unitType: 'verb',
    vocabTerms: ['הייתי רוצה', 'היה רוצה', 'היינו רוצים', 'I would like', 'polite request', 'conditional', 'הייתי מעדיף', 'אפשר', 'בבקשה'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"הייתי רוצה" — I would like. Literally: "I was wanting" — past of להיות + רוצה. This is the polite request form. Used in restaurants, shops, formal situations. Say: הייתי רוצה קפה, בבקשה.', studentAction: 'Repeat: הייתי רוצה קפה בבקשה.', teacherHint: 'Hebrew conditional/polite request: הייתי רוצה (I would like) = past of להיות + present participle. Less formal alternatives: אפשר לקבל…? (May I have?) is also very common in Israeli Hebrew. Teach both.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show polite ordering/requesting situations. Read: הייתי רוצה + noun or ל + infinitive.', studentAction: 'Read polite request sentences.', teacherHint: 'Restaurant: הייתי רוצה את התפריט (I would like the menu). Shop: הייתי רוצה לנסות (I would like to try). Phone: הייתי רוצה לדבר עם… (I would like to speak with…).' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Polite request drill — what would each person like? Build: subject past-form + רוצה/רוצה + request.', studentAction: 'Combine polite request sentences.', teacherHint: 'הוא היה רוצה (he would like), היא הייתה רוצה (she would like). The להיות past agrees in gender: הייתי (I, m/f), היה (he), הייתה (she), היינו (we).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'You are in an Israeli café. Order politely using הייתי רוצה.', studentAction: 'Produce a restaurant order using הייתי רוצה.', teacherHint: 'Cultural note: Israelis often use אפשר + noun/infinitive (Is it possible to have?) as the polite register rather than הייתי רוצה. Both are correct. Real-world awareness.' },
    ],
  },

  // ─── הלכתי — I Went ────────────────────────────────────────────────────────
  {
    contentKey: 'i went hebrew',
    language: 'hebrew',
    displayName: 'הלכתי — I Went',
    unitType: 'verb',
    vocabTerms: ['הלכתי', 'הלך', 'הלכה', 'הלכנו', 'went', 'I went', 'he went', 'she went', 'where did you go', 'לאן הלכת'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"הלכתי" — I went. Root ה-ל-כ — an irregular/weak root. Past tense: הלכתי, הלכת, הלך, הלכה, הלכנו. Say: הלכתי לבית הספר.', studentAction: 'Repeat: הלכתי, הלך, הלכה.', teacherHint: 'ה-ל-כ is a Pe-He root (starts with ה). In Pa\'al past it behaves regularly: הלכתי/הלכת/הלך/הלכה/הלכנו/הלכתם/הלכו. The present form הולך (going) is a separate pattern — connect them: going NOW vs went.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show past destinations. Read: הלכתי ל… / הוא הלך ל…', studentAction: 'Read past-tense going sentences.', teacherHint: 'Connect to Unit 1 (הולך ל) — same verb, different tense. הולך = going now, הלכתי = went. Students see the tense shift. לאן הלכת אתמול? Where did you go yesterday?' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who went where yesterday? Combine past forms with destinations.', studentAction: 'Build: subject + past form of הלך + ל + destination.', teacherHint: 'Time markers: אתמול (yesterday), בשבוע שעבר (last week), בבוקר (in the morning). Adding time markers makes the past tense more natural and contextual.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'לאן הלכת אחרי הלימודים אתמול? Where did you go after school yesterday? Answer: הלכתי ל…', studentAction: 'Produce: הלכתי ל + past destination.', teacherHint: 'Personal and authentic. Accept any honest answer. The contrast present/past (הולך/הלכתי) is now established.' },
    ],
  },

  // ─── הוא הולך ל — He Is Going To ─────────────────────────────────────────
  {
    contentKey: 'he is going to hebrew',
    language: 'hebrew',
    displayName: 'הוא הולך ל — He Is Going To',
    unitType: 'verb',
    vocabTerms: ['הוא הולך ל', 'היא הולכת ל', 'הם הולכים ל', 'he is going to', 'she is going to', 'they are going to', '3rd person', 'near future'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: 'Near future in 3rd person: "הוא הולך ל…" — he is going to… "היא הולכת ל…" — she is going to… Same structure as Unit 4 but now for 3rd person. Say: הוא הולך לקנות. היא הולכת ללמוד.', studentAction: 'Repeat: הוא הולך ל and היא הולכת ל + infinitive.', teacherHint: 'Review Unit 4 (I am going to) and extend to 3rd person. The gender distinction הולך/הולכת applies. Add plural: הם הולכים ל (they are going to). High-frequency pattern for narrating others\' plans.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show 3rd-person future plans. Read: הוא/היא הולך/הולכת ל + infinitive.', studentAction: 'Read 3rd-person near-future sentences.', teacherHint: 'Vary the subject: הוא, היא, דני, שרה, המורה. All use הולך (m) or הולכת (f) + ל + infinitive. Watch for students applying 1st-person form by mistake.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Build plans for various people using הולך/הולכת ל.', studentAction: 'Combine: name/pronoun + הולך/הולכת + ל + infinitive.', teacherHint: 'Narrative mode: describe what a classmate is going to do this weekend. שרה הולכת לטייל. דני הולך לשחות.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה המורה הולכת לעשות מחר? What is the teacher going to do tomorrow? Answer in 3rd person.', studentAction: 'Produce: ה + name/title + הולך/הולכת + ל + infinitive.', teacherHint: 'Playful personalization — students can make up the teacher\'s plans. Laughs reinforce the pattern.' },
    ],
  },

  // ─── מה הוא עשה? — What Did He Do? ──────────────────────────────────────
  {
    contentKey: 'what did he do hebrew',
    language: 'hebrew',
    displayName: 'מה הוא עשה? — What Did He Do?',
    unitType: 'verb',
    vocabTerms: ['מה הוא עשה', 'עשה', 'עשתה', 'עשיתי', 'did', 'what did', 'past question', 'מה עשית', 'לעשות', 'made/did'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"מה הוא עשה?" — What did he do? Root ע-ש-ה (another weak root, final ה). Past: עשיתי (I did), עשה (he did), עשתה (she did). These are very high frequency. Say: מה עשית? / עשיתי שיעורי בית.', studentAction: 'Repeat: מה עשית? עשיתי + action.', teacherHint: 'ע-ש-ה is one of the 10 most frequent Hebrew verbs. Irregular weak ה root: עשה/עשתה/עשיתי. The question מה עשית? is a daily conversational staple. Master this question-answer pair.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show completed actions. Read question and answer: מה הוא עשה? — הוא עשה/קנה/הלך…', studentAction: 'Read past-tense action Q&A pairs.', teacherHint: 'The question תבנית: מה + subject + past verb? The answer: subject + past verb + object/location. Mix עשה with other known past verbs (הלך, לקח, קנה) for fluency building.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — what did each person do? Build past-tense answers.', studentAction: 'Combine: subject + past verb + object.', teacherHint: 'Good time to review all past verbs learned: לקחתי, קניתי, הלכתי, עשיתי. Four high-frequency Pa\'al past roots now in repertoire.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה עשית אתמול בערב? What did you do yesterday evening? Answer: עשיתי…', studentAction: 'Produce: עשיתי + past activity.', teacherHint: 'Highly natural. Any evening activity works. Students can chain verbs: עשיתי שיעורים ואחר כך ראיתי טלוויזיה (I did homework and then watched TV).' },
    ],
  },

  // ─── היה לו — He Had ──────────────────────────────────────────────────────
  {
    contentKey: 'he had hebrew',
    language: 'hebrew',
    displayName: 'היה לו — He Had',
    unitType: 'verb',
    vocabTerms: ['היה לו', 'היה לה', 'היה לי', 'לא היה לי', 'had', 'he had', 'she had', 'I had', 'past of יש לי', 'היה'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"היה לי" — I had. "היה לו" — he had. "היה לה" — she had. This is the past of יש לי — using past tense of להיות. היה (m past) / הייתה (f past). Say: היה לי כלב. לא היה לה זמן.', studentAction: 'Repeat: היה לי, היה לו, היה לה.', teacherHint: 'Connect to Unit 5 (יש לי = I have). Past: היה לי. Future: יהיה לי. The same ל-preposition system, now with להיות in past tense. היה = m.sg past of להיות. הייתה = f.sg past.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show past possessions. Read: היה/הייתה לי/לו/לה + noun.', studentAction: 'Read past possession sentences.', teacherHint: 'The agreement quirk: היה/הייתה agrees with the POSSESSED THING, not the possessor! היה לי כלב (I had a dog — כלב is masculine). הייתה לי חתולה (I had a (female) cat — חתולה is feminine). This is subtle but important.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who had what? Build past possession sentences.', studentAction: 'Combine: היה/הייתה + ל + person + noun.', teacherHint: 'The gender-agreement-with-noun rule will catch students — acknowledge the difficulty. לא היה לי (I didn\'t have) for negation. Very natural: לא היה לי מספיק זמן (I didn\'t have enough time).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'What did you have when you were little that you don\'t have now? Use: היה לי / הייתה לי.', studentAction: 'Produce: כשהייתי קטן/קטנה, היה לי / הייתה לי…', teacherHint: 'כשהייתי קטן/קטנה (when I was little). Emotional memory + past tense = strong retention. Students share pets, toys, childhood possessions.' },
    ],
  },

  // ─── לו/לה — To Him/To Her ────────────────────────────────────────────────
  {
    contentKey: 'to him hebrew',
    language: 'hebrew',
    displayName: 'לו / לה — To Him / To Her',
    unitType: 'verb',
    vocabTerms: ['לו', 'לה', 'לי', 'לך', 'לנו', 'to him', 'to her', 'to me', 'indirect object', 'prepositional pronoun', 'נתתי לו'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"לו" — to him / for him. "לה" — to her / for her. In Hebrew, ל absorbs pronouns: לי (to me), לך (to you), לו (to him), לה (to her), לנו (to us). These are prepositional pronouns. Say: נתתי לו ספר. שלחתי לה הודעה.', studentAction: 'Repeat: נתתי לו and שלחתי לה.', teacherHint: 'The ל prepositional pronoun series: לי/לך/לו/לה/לנו/לכם/להם. These combine the preposition ל with the pronoun into one word. They express "to/for + person" as the indirect object.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show giving/sending actions. Read: נתתי/שלחתי/אמרתי + לו/לה + object.', studentAction: 'Read indirect object sentences with לו/לה.', teacherHint: 'Core verbs with indirect objects: נתן (give), שלח (send), אמר (say/tell), הראה (show), קנה (buy for). Pattern: verb + ל + person + (object). "נתתי לה מתנה" — I gave her a gift.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who gave/sent what to whom? Build: verb + לו/לה + object.', studentAction: 'Combine indirect object sentences.', teacherHint: 'Double objects: נתתי לו את הספר (I gave him the book) — לו (indirect) + את הספר (direct). The indirect precedes the direct in Hebrew.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'For whom did you last buy a gift? Use: קניתי ל… מתנה.', studentAction: 'Produce: קניתי + ל + person pronoun + מתנה.', teacherHint: 'Natural and memorable. Then extend: מה קניתם לו/לה? (What did you buy him/her?) — question with indirect object pronoun.' },
    ],
  },

  // ─── נקי/מלוכלך — Clean/Dirty ────────────────────────────────────────────
  {
    contentKey: 'clean dirty hebrew',
    language: 'hebrew',
    displayName: 'נקי / מלוכלך — תיאורים',
    unitType: 'verb',
    vocabTerms: ['נקי', 'מלוכלך', 'נקייה', 'מלוכלכת', 'גדול', 'קטן', 'clean', 'dirty', 'adjective agreement', 'gender', 'descriptions'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"נקי" — clean (m). "נקייה" — clean (f). "מלוכלך" — dirty (m). "מלוכלכת" — dirty (f). Hebrew adjectives agree in gender and number with their nouns. Say: הכלב נקי. הכלבה נקייה.', studentAction: 'Repeat: נקי/נקייה, מלוכלך/מלוכלכת.', teacherHint: 'Gender agreement is the foundation of Hebrew adjectives. m.sg = base form; f.sg = usually +ה or +ת suffix. Adjective follows the noun it describes. הכיתה נקייה. החדר מלוכלך.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show clean and dirty things. Read: ה + noun + adjective (m or f based on noun gender).', studentAction: 'Read descriptive sentences, selecting correct m/f adjective form.', teacherHint: 'Common adjective pairs: גדול/גדולה (big), קטן/קטנה (small), חדש/חדשה (new), ישן/ישנה (old), יפה/יפה (beautiful — same!), מהיר/מהירה (fast). Build a working adjective vocabulary.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — describe the nouns with correct adjective gender agreement.', studentAction: 'Build: ה + noun + adjective (correctly gendered).', teacherHint: 'Noun gender in Hebrew: most nouns ending in ה or ת are feminine. Others are masculine. Some must be memorized. Common f. nouns: עיר (city), מדינה (country), כיתה (classroom), בעיה (problem).' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'Describe your room or your bag using two adjectives. Use: ה + noun + adjective.', studentAction: 'Produce two adjective descriptions with correct gender agreement.', teacherHint: 'Personal context makes agreement memorable. הצבע/המחשב/הכיתה שלי + adjective. The possessive שלי (mine) adds naturalness.' },
    ],
  },

  // ─── למדתי — I Studied ────────────────────────────────────────────────────
  {
    contentKey: 'i studied hebrew',
    language: 'hebrew',
    displayName: 'למדתי — I Studied',
    unitType: 'verb',
    vocabTerms: ['למדתי', 'למד', 'למדה', 'למדנו', 'I studied', 'he studied', 'she studied', 'studied', 'regular Pa\'al past', 'לומד'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"למדתי" — I studied. Root ל-מ-ד. Regular Pa\'al past: למדתי, למדת, למד, למדה, למדנו. All first-person past verbs in Pa\'al end in -תי. Say: למדתי עברית כל השנה.', studentAction: 'Repeat: למדתי, למד, למדה.', teacherHint: 'ל-מ-ד is a regular Pa\'al root — perfect for modeling the full past paradigm: למדתי/למדת/למד/למדה/למדנו/למדתם/למדו. Students already know this root from the "verb pattern" unit. Now they see its past forms.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show learning and studying contexts. Read: למדתי + subject / time phrase.', studentAction: 'Read study sentences in past tense.', teacherHint: 'Collocations: למדתי עברית (studied Hebrew), למדתי לנסוע (learned to drive), למדנו על (we learned about). The verb accepts both direct objects and ל + infinitive.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who studied what? Build Pa\'al past sentences with ל-מ-ד.', studentAction: 'Combine: subject + past form + subject matter.', teacherHint: 'Extend to similar roots: כתבתי (I wrote), שמעתי (I heard), ישבתי (I sat). All Pa\'al regular past. Once students have ל-מ-ד solid, they can transfer the pattern.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה למדת השנה שלא ידעת לפני? What did you learn this year that you didn\'t know before? Answer: למדתי…', studentAction: 'Produce: למדתי + what was learned.', teacherHint: 'Metacognitive prompt. Hebrew learning included! למדתי עברית. Celebrate growth.' },
    ],
  },

  // ─── קיבלתי — I Received ──────────────────────────────────────────────────
  {
    contentKey: 'i received hebrew',
    language: 'hebrew',
    displayName: 'קיבלתי — I Received',
    unitType: 'verb',
    vocabTerms: ['קיבלתי', 'קיבל', 'קיבלה', 'קיבלנו', 'received', 'I received', 'I got', 'he received', 'Pi\'el', 'Pi\'el past'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: '"קיבלתי" — I received / I got. Root ק-ב-ל. This is Pi\'el binyan (intensive pattern), not Pa\'al. Pi\'el past: קיבלתי, קיבלת, קיבל, קיבלה, קיבלנו. Middle root letter is doubled. Say: קיבלתי הודעה. קיבל ציון טוב.', studentAction: 'Repeat: קיבלתי, קיבל, קיבלה.', teacherHint: 'Brief Pi\'el introduction — the middle root letter ב is doubled (geminate): קיבֵּל. Pi\'el often has intensive or transitive meaning. קיבל (receive), דיבר (spoke), שיחק (played). Students don\'t need full Pi\'el paradigm yet — just recognize the pattern.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show receiving things. Read: קיבלתי + object. Note the doubled middle letter.', studentAction: 'Read receiving sentences.', teacherHint: 'Common uses: קיבלתי מתנה (I received a gift), קיבל ציון (got a grade), קיבלנו חדשות (we received news). Contrast Pa\'al (לקח — took) vs Pi\'el (קיבל — received): taking vs being given.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who received what? Build: subject + Pi\'el past + object.', studentAction: 'Combine receiving sentences.', teacherHint: 'The Pi\'el past paradigm mirrors Pa\'al past for the suffixes: -תי/-ת/-/-ה/-נו/-תם/-ו. Only the stem changes. Students who know Pa\'al past can transfer the suffixes directly.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה קיבלת ביום הולדת שלך? What did you receive for your birthday? Answer: קיבלתי…', studentAction: 'Produce: קיבלתי + birthday gift.', teacherHint: 'Personal and positive memory. ביום הולדת שלי (on my birthday). Emotionally charged contexts improve retention.' },
    ],
  },

  // ─── אני אלך — I Will ─────────────────────────────────────────────────────
  {
    contentKey: 'i will hebrew',
    language: 'hebrew',
    displayName: 'אני אלך — עתיד',
    unitType: 'verb',
    vocabTerms: ['אלך', 'אקנה', 'ילמד', 'תלמד', 'נלך', 'future tense', 'עתיד', 'I will', 'he will', 'she will'],
    steps: [
      { stepIndex: 0, stepName: 'anchor', verbalInstruction: 'Hebrew future tense (עתיד) uses prefix conjugation. "אני אלך" — I will go. "הוא ילך" — he will go. Prefixes: א (I), ת (you m/she), י (he), נ (we), ת+ו (you pl/they). Say: אלך, ילך, תלך.', studentAction: 'Repeat: אלך, ילך, תלך, נלך.', teacherHint: 'The future prefix set (א/ת/י/נ/ת+ו) is consistent across all binyanim. Learning it once transfers everywhere. הלך root in future: אלך/תלך/ילך/תלך/נלך/תלכו/ילכו. The prefix+root+suffix system.' },
      { stepIndex: 1, stepName: 'model_sentences', verbalInstruction: 'Images show future plans. Read: אני אלך ל… / הוא ילמד… / אנחנו נקנה…', studentAction: 'Read future tense sentences from multiple roots.', teacherHint: 'Common future forms students should acquire: אלך (I will go), אקנה (I will buy), אלמד (I will study), אדבר (I will speak), אכתוב (I will write). The א- prefix + root in future pattern is immediately usable.' },
      { stepIndex: 2, stepName: 'combinator', verbalInstruction: 'Column drill — who will do what? Build future tense sentences.', studentAction: 'Combine: subject + future form + object/destination.', teacherHint: 'Compare all three tenses for הלך: הולך (going-now), הלכתי (went), אלך (will go). The tense panorama in Hebrew is now visible. Three-way contrast drill is very powerful at this stage.' },
      { stepIndex: 3, stepName: 'qa_pivot', verbalInstruction: 'מה תעשה/תעשי מחר? What will you do tomorrow? Answer: מחר אני א…', studentAction: 'Produce: מחר אני א + future verb + plan.', teacherHint: 'Productive and planful. מחר (tomorrow) as a time anchor. Any accurate future sentence works. Students now have present, past, and future — the core tense triad in Hebrew.' },
    ],
  },

];

// Merge all units — Spanish first, then French, Italian, Portuguese, German, Japanese, Korean, Mandarin, English, Hebrew
const ALL_UNITS = [...UNITS, ...FRENCH_UNITS, ...GERMAN_UNITS, ...ITALIAN_UNITS, ...PORTUGUESE_UNITS, ...JAPANESE_UNITS, ...KOREAN_UNITS, ...MANDARIN_UNITS, ...ENGLISH_UNITS, ...HEBREW_UNITS];

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
