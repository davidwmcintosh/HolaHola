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
  unitType: 'verb' | 'preterite' | 'ser_estar' | 'hay_gustar' | 'progressive';
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

export const MADRIGAL_LOOP_CATALOG: readonly MadrigalLoopUnit[] = UNITS;

export function findMadrigalUnit(contentKey: string): MadrigalLoopUnit | null {
  return UNITS.find(u => u.contentKey.toLowerCase() === contentKey.toLowerCase()) ?? null;
}

export function getAllMadrigalUnits(): MadrigalLoopUnit[] {
  return [...UNITS];
}
