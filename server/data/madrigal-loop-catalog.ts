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

// Merge all units — Spanish first, then French (preserves existing index order for Spanish)
const ALL_UNITS = [...UNITS, ...FRENCH_UNITS];

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
