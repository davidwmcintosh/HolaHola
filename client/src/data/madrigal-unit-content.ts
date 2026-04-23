/**
 * madrigal-unit-content.ts
 * Hardcoded content transcribed directly from Madrigal's "See It and Say It in Spanish."
 *
 * Content law: Never generate this from AI. Every element was chosen by Madrigal
 * for a specific pedagogical reason. The chain must be preserved exactly.
 */

import type { NegativeFormItem } from "@/components/NegativeFormSection";
import type { SentenceColumn } from "@/components/SentenceColumnGenerator";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface MadrigalAnchorItem {
  spanish: string;
  english: string;
}

export interface MadrigalPositiveItem {
  word: string;        // used as the image lookup key
  sentence: string;    // displayed sentence (may differ from word, e.g. "discoteca" → "Vamos al club.")
  translation: string;
  imageDescription: string;
}

/** A Q&A pair shown together under an image (page 12 format). */
export interface Page12QAItem {
  imageWord?: string;          // optional — last two items on page 12 have no image
  question: string;
  affirmativeAnswer: string;
  affirmativeTranslation: string;
}

// ── Unit type 1: ir-style (present tense, place vocabulary) ───────────────────

export interface MadrigalVerbUnitContent {
  chapterTitleKey: string;

  voyAnchor: MadrigalAnchorItem[];
  positiveItems: MadrigalPositiveItem[];

  vaAnchor: MadrigalAnchorItem[];
  vaColumns: SentenceColumn[];
  subjectPronounNote?: string;

  noVoyAnchor: MadrigalAnchorItem[];
  negativeItems: NegativeFormItem[];

  sentenceColumns: SentenceColumn[];

  vamosAnchor: MadrigalAnchorItem[];
  vamosItems: MadrigalPositiveItem[];
  vamosNote?: string;

  page12Anchors: MadrigalAnchorItem[];
  page12Items: Page12QAItem[];
  vaDefinition?: string;
}

// ── Unit type 2: preterite style (past tense, multi-cluster) ──────────────────
// Used for tomar, comprar, and similar verb units from Madrigal pp. 29+
//
// Each verb lesson has 2-3 vocabulary clusters.
// Each cluster has: anchor, Q&A image cards or statement cards, optional
// conjugation table, optional sentence former, optional notes.

/** One Q&A image card (¿Tomó un taxi? / Sí, tomé un taxi.) */
export interface PreteriteQACard {
  imageWord: string;
  question: string;
  questionTranslation: string;
  answer: string;
  answerTranslation: string;
  /** Optional hint for image generation when cache misses occur */
  imageDescription?: string;
}

/** One conjugation row (Tomé / I took) */
export interface PreteriteConjugationRow {
  form: string;
  meaning: string;
}

/** One vocabulary cluster within a preterite lesson */
export interface PreteriteCluster {
  anchorItems: MadrigalAnchorItem[];
  /** Pedagogical note shown BEFORE the image cards */
  noteBefore?: string;
  /** Q&A image cards — the main content of most clusters */
  qaCards?: PreteriteQACard[];
  /** Statement-only image cards — used for "Tomé pollo para la cena." style */
  statementCards?: MadrigalPositiveItem[];
  /** Full verb conjugation table — shown after qaCards */
  conjugationTable?: PreteriteConjugationRow[];
  /** Sentence-former columns — shown after conjugation table */
  sentenceColumns?: SentenceColumn[];
  /** Pedagogical note shown AFTER the cards/drills */
  noteAfter?: string;
}

export interface PreteriteUnitContent {
  /** Substring matched against chapter title (case-insensitive) */
  chapterTitleKey: string;
  clusters: PreteriteCluster[];
}

// ── Unit type 3: Ser-style (gender, number, ser verb) ─────────────────────────
// Used for the gender & plurals chapter (Madrigal pp. 64–71)

/** One image card showing both singular and plural forms of the same noun */
export interface DualFormPair {
  imageWord: string;
  imageDescription?: string;
  leftLabel: string;       // e.g. "El sombrero" or "El caballo es bonito."
  leftTranslation: string;
  rightLabel: string;      // e.g. "Los sombreros" or "Los caballos son bonitos."
  rightTranslation: string;
}

export type SerCluster =
  | {
      type: 'article-pairs';
      articleSingular: string; // "el" or "la"
      articlePlural: string;   // "los" or "las"
      pluralRule: string;
      pairs: DualFormPair[];
      footerNote: string;
    }
  | {
      type: 'es-son-sentences';
      anchorItems?: MadrigalAnchorItem[];
      pairs: DualFormPair[];
    }
  | {
      type: 'ser-qa';
      roomHeader?: { spanish: string; english: string }; // e.g. "En el baño"
      anchorItems?: MadrigalAnchorItem[];
      cards: PreteriteQACard[];
      noteAfter?: string;
    }
  | {
      /** Statement image cards: "El café está en la mesa." (no Q&A) */
      type: 'estar-statements';
      introNote?: string;          // shown above anchor block on first page
      anchorItems?: MadrigalAnchorItem[];
      cards: { imageWord: string; imageDescription?: string; statement: string; translation: string }[];
    }
  | {
      /** Estar conjugation table + sentence combinator */
      type: 'estar-conj';
      rows: { conjugated: string; translation: string }[];
      questionForm: string;       // "¿Está?"
      questionTranslation: string;
      combinatorLeft: string;     // "¿Dónde está..."
      combinatorWords: { spanish: string; english: string }[];
    }
  | {
      /** Word chip list (cognates, vocabulary) */
      type: 'word-chips';
      note: string;
      words: string[];
    }
  | {
      /** Estar adjective expressions in M/F columns + neutral additions */
      type: 'estar-expressions';
      genderPairs: {
        masculine: { spanish: string; english: string };
        feminine?: { spanish: string; english: string };
      }[];
      additionalItems: { spanish: string; english: string }[];
    }
  | {
      type: 'consonant-plural';
      pluralRule: string;
      imagePairs: DualFormPair[];
      wordList: { singular: string; plural: string }[];
      wordListNote: string;
      alWords?: string[];
    }
  | {
      type: 'adjective-expressions';
      anchorItems?: MadrigalAnchorItem[];
      adjectives: { singular: string; plural: string; english: string }[];
      expressions: { spanish: string; english: string }[];
    };

export interface SerUnitContent {
  chapterTitleKey: string;
  clusters: SerCluster[];
}

// ── Unit type 4: Hay-style (existential / puedo ir — Q&A image clusters) ──────
// Used for "Hay" (there is/are) and "Puedo ir" (I can go) chapters.

/** One Q&A image card (¿Hay café? / Sí, hay café.) */
export interface HayQandAPair {
  imageWord?: string;
  imageDescription?: string;
  question: string;
  questionTranslation: string;
  answer: string;
  answerTranslation: string;
  /** Additional sentence shown below the answer (e.g. "Es muy bonita.") */
  extraNote?: string;
}

/** One vocabulary cluster within a Hay-style lesson */
export interface HayVocabCluster {
  heading?: string;
  /** Pedagogical note displayed above cards */
  noteInline?: string;
  pairs: HayQandAPair[];
  /** Optional sentence-former columns shown at the bottom of the cluster */
  sentenceColumns?: SentenceColumn[];
  /** Short note shown after the cards */
  noteAfter?: string;
}

export interface HayUnitContent {
  /** Substring matched against chapter title (case-insensitive) */
  chapterTitleKey: string;
  /** Large headline word or phrase, e.g. "Hay" or "Puedo ir" */
  conceptLabel: string;
  /** Meaning shown below the headline, e.g. "there is / there are / is there? / are there?" */
  conceptDefinition: string;
  /** Pedagogical note displayed after the concept header */
  introNote?: string;
  clusters: HayVocabCluster[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter 23: Where Are You Going? (ir — to go)
// Source: Madrigal pp. 9–13
// ═══════════════════════════════════════════════════════════════════════════════

const IR_GOING_PLACES: MadrigalVerbUnitContent = {
  chapterTitleKey: "where are you going",

  voyAnchor: [
    { spanish: "Voy,", english: "I'm going." },
    { spanish: "al,",  english: "to the." },
  ],

  positiveItems: [
    { word: "hotel",       sentence: "Voy al hotel.",       translation: "I'm going to the hotel.",      imageDescription: "a classic hotel building exterior" },
    { word: "banco",       sentence: "Voy al banco.",       translation: "I'm going to the bank.",       imageDescription: "a bank building with columns" },
    { word: "garaje",      sentence: "Voy al garaje.",      translation: "I'm going to the garage.",     imageDescription: "a car garage with open door" },
    { word: "restaurante", sentence: "Voy al restaurante.", translation: "I'm going to the restaurant.", imageDescription: "a restaurant exterior with outdoor seating" },
  ],

  vaAnchor: [
    { spanish: "¿Va?", english: "Are you going?" },
  ],

  vaColumns: [
    {
      items: [
        { text: "¿Va al", translation: "Are you going to the" },
      ],
    },
    {
      items: [
        { text: "hotel?",       translation: "hotel?" },
        { text: "banco?",       translation: "bank?" },
        { text: "garaje?",      translation: "garage?" },
        { text: "restaurante?", translation: "restaurant?" },
      ],
    },
  ],

  subjectPronounNote: "In Spanish, you generally drop subject pronouns (I, you, we, they, etc.).",

  noVoyAnchor: [
    { spanish: "No voy,", english: "I'm not going." },
    { spanish: "al,",     english: "to the." },
  ],

  negativeItems: [
    { imageWord: "hotel",       negativePhrase: "No voy al hotel.",       translation: "I'm not going to the hotel." },
    { imageWord: "banco",       negativePhrase: "No voy al banco.",       translation: "I'm not going to the bank." },
    { imageWord: "garaje",      negativePhrase: "No voy al garaje.",      translation: "I'm not going to the garage." },
    { imageWord: "restaurante", negativePhrase: "No voy al restaurante.", translation: "I'm not going to the restaurant." },
  ],

  sentenceColumns: [
    {
      items: [
        { text: "voy al",      translation: "I'm going to the" },
        { text: "va al",       translation: "he / she / you are going to the" },
        { text: "vamos al",    translation: "we're going to the" },
        { text: "van al",      translation: "they / you all are going to the" },
        { text: "no voy al",   translation: "I'm not going to the" },
        { text: "no va al",    translation: "he / she / you aren't going to the" },
        { text: "no vamos al", translation: "we're not going to the" },
        { text: "no van al",   translation: "they / you all aren't going to the" },
      ],
    },
    {
      items: [
        { text: "hotel",       translation: "hotel" },
        { text: "banco",       translation: "bank" },
        { text: "teatro",      translation: "theater" },
        { text: "restaurante", translation: "restaurant" },
        { text: "parque",      translation: "park" },
        { text: "cine",        translation: "movies" },
        { text: "garaje",      translation: "garage" },
        { text: "club",        translation: "club" },
      ],
    },
  ],

  vamosAnchor: [
    { spanish: "Vamos,", english: "Let's go." },
    { spanish: "al,",    english: "to the." },
  ],

  vamosItems: [
    { word: "hotel",       sentence: "Vamos al hotel.",       translation: "Let's go to the hotel.",      imageDescription: "a classic hotel building exterior" },
    { word: "banco",       sentence: "Vamos al banco.",       translation: "Let's go to the bank.",       imageDescription: "a bank building with columns" },
    { word: "restaurante", sentence: "Vamos al restaurante.", translation: "Let's go to the restaurant.", imageDescription: "a restaurant exterior with outdoor seating" },
    { word: "discoteca",   sentence: "Vamos al club.",        translation: "Let's go to the club.",       imageDescription: "a nightclub or social club exterior at night" },
  ],

  vamosNote: "\"Vamos\" means both \"Let's go\" and \"We are going.\"",

  page12Anchors: [
    { spanish: "¿Va?",  english: "Are you going?" },
    { spanish: "al,",   english: "to the." },
    { spanish: "Voy,",  english: "I'm going." },
    { spanish: "Sí,",   english: "Yes." },
  ],

  page12Items: [
    { imageWord: "banco",  question: "¿Va al banco?",  affirmativeAnswer: "Sí, voy al banco.",  affirmativeTranslation: "Yes, I'm going to the bank." },
    { imageWord: "parque", question: "¿Va al parque?", affirmativeAnswer: "Sí, voy al parque.", affirmativeTranslation: "Yes, I'm going to the park." },
    {                      question: "¿Va al hotel?",  affirmativeAnswer: "Sí, voy al hotel.",  affirmativeTranslation: "Yes, I'm going to the hotel." },
    {                      question: "¿Va al club?",   affirmativeAnswer: "Sí, voy al club.",   affirmativeTranslation: "Yes, I'm going to the club." },
  ],

  vaDefinition: "Va: You are going · He is going · She is going · It is going\n¿Va?: Are you going? · Is he going? · Is she going? · Is it going?",
};

// ═══════════════════════════════════════════════════════════════════════════════
// Tomar: I Took (preterite)
// Source: Madrigal pp. 29–31
//
// Three vocabulary clusters:
//   1. Transportation (taxi / avión / tren / autobús)
//   2. Food & drink (sopa / café / chocolate / té) + note about tomar = eat/drink
//   3. Para la cena — dinner items (pollo / salmón / espárragos / café)
// ═══════════════════════════════════════════════════════════════════════════════

const TOMAR_I_TOOK: PreteriteUnitContent = {
  chapterTitleKey: "tomar",

  clusters: [
    // ── Cluster 1: Transportation ────────────────────────────────────────────
    {
      anchorItems: [
        { spanish: "Tomé,",   english: "I took." },
        { spanish: "¿Tomó?",  english: "Did you take?" },
        { spanish: "Sí,",     english: "Yes." },
        { spanish: "Un,",     english: "A, an." },
      ],

      qaCards: [
        { imageWord: "taxi",    question: "¿Tomó un taxi?",    questionTranslation: "Did you take a taxi?",  answer: "Sí, tomé un taxi.",    answerTranslation: "Yes, I took a taxi." },
        { imageWord: "avión",   question: "¿Tomó un avión?",   questionTranslation: "Did you take a plane?", answer: "Sí, tomé un avión.",   answerTranslation: "Yes, I took a plane." },
        { imageWord: "tren",    question: "¿Tomó un tren?",    questionTranslation: "Did you take a train?", answer: "Sí, tomé un tren.",    answerTranslation: "Yes, I took a train." },
        { imageWord: "autobús", question: "¿Tomó un autobús?", questionTranslation: "Did you take a bus?",   answer: "Sí, tomé un autobús.", answerTranslation: "Yes, I took a bus." },
      ],

      conjugationTable: [
        { form: "Tomar",    meaning: "to take" },
        { form: "Tomé",     meaning: "I took" },
        { form: "Tomó",     meaning: "you took · he took · she took" },
        { form: "¿Tomó?",   meaning: "did you take?" },
        { form: "Tomamos",  meaning: "we took" },
        { form: "Tomaron",  meaning: "they took" },
      ],

      sentenceColumns: [
        {
          items: [
            { text: "Tomé",    translation: "I took" },
            { text: "Tomó",    translation: "you / he / she took" },
            { text: "¿Tomó?",  translation: "did you take?" },
            { text: "Tomamos", translation: "we took" },
            { text: "Tomaron", translation: "they took" },
          ],
        },
        {
          items: [
            { text: "un tren",    translation: "a train" },
            { text: "un taxi",    translation: "a taxi" },
            { text: "un autobús", translation: "a bus" },
          ],
        },
      ],
    },

    // ── Cluster 2: Food & drink ───────────────────────────────────────────────
    {
      anchorItems: [
        { spanish: "Tomé,",   english: "I took." },
        { spanish: "¿Tomó?",  english: "Did you take?" },
        { spanish: "Sí,",     english: "Yes." },
        { spanish: "Un,",     english: "A, an." },
      ],

      noteBefore: "In Spanish, we also use the verb tomar (to take) to express eating and drinking. We say, \"I took soup\" (tomé sopa) instead of \"I had soup.\"",

      qaCards: [
        { imageWord: "sopa",       question: "¿Tomó sopa?",       questionTranslation: "Did you have soup?",      answer: "Sí, tomé sopa.",       answerTranslation: "Yes, I had soup." },
        { imageWord: "café",       question: "¿Tomó café?",       questionTranslation: "Did you have coffee?",    answer: "Sí, tomé café.",       answerTranslation: "Yes, I had coffee." },
        { imageWord: "chocolate",  question: "¿Tomó chocolate?",  questionTranslation: "Did you have chocolate?", answer: "Sí, tomé chocolate.",  answerTranslation: "Yes, I had chocolate." },
        { imageWord: "té",         question: "¿Tomó té?",         questionTranslation: "Did you have tea?",       answer: "Sí, tomé té.",         answerTranslation: "Yes, I had tea." },
      ],

      sentenceColumns: [
        {
          items: [
            { text: "Tomé",   translation: "I took / had" },
            { text: "Tomó",   translation: "you / he / she took" },
            { text: "¿Tomó?", translation: "did you take / have?" },
          ],
        },
        {
          items: [
            { text: "roast beef",   translation: "roast beef" },
            { text: "bistec",       translation: "steak" },
            { text: "un sándwich",  translation: "a sandwich" },
            { text: "salmón",       translation: "salmon" },
          ],
        },
      ],
    },

    // ── Cluster 3: Para la cena ───────────────────────────────────────────────
    {
      anchorItems: [
        { spanish: "Tomé,",        english: "I took." },
        { spanish: "para cenar,",  english: "for dinner, for supper." },
        { spanish: "la cena,",     english: "the dinner." },
        { spanish: "para,",        english: "for." },
      ],

      statementCards: [
        { word: "pollo",      sentence: "Tomé pollo para la cena.",      translation: "I had chicken for dinner.",    imageDescription: "a roasted chicken on a plate" },
        { word: "salmón",     sentence: "Tomé salmón para la cena.",     translation: "I had salmon for dinner.",     imageDescription: "a grilled salmon fillet on a plate" },
        { word: "espárragos", sentence: "Tomé espárragos para la cena.", translation: "I had asparagus for dinner.",  imageDescription: "fresh asparagus stalks on a plate" },
        { word: "café",       sentence: "Tomé café para la cena.",       translation: "I had coffee for dinner.",     imageDescription: "a cup of coffee on a saucer" },
      ],

      noteAfter: "Remember: use tomé to express eating and drinking. Tomé té. (I had tea.) Tomé la cena. (I had dinner.)",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Comprar: I Bought (preterite)
// Source: Madrigal pp. 32+
//
// Two vocabulary clusters:
//   1. Shopping items (blusa / periódico / automóvil / sombrero)
//   2. Para la cena — grocery items (pollo / apio / tomates / lechuga)
// ═══════════════════════════════════════════════════════════════════════════════

const COMPRAR_I_BOUGHT: PreteriteUnitContent = {
  chapterTitleKey: "comprar",

  clusters: [
    // ── Cluster 1: Shopping items ─────────────────────────────────────────────
    {
      anchorItems: [
        { spanish: "Compré,",       english: "I bought." },
        { spanish: "el periódico,", english: "the newspaper." },
        { spanish: "¿Compró?",      english: "did you buy?" },
        { spanish: "una blusa,",    english: "a blouse." },
      ],

      qaCards: [
        { imageWord: "blusa",      question: "¿Compró una blusa?",      questionTranslation: "Did you buy a blouse?",     answer: "Sí, compré una blusa.",      answerTranslation: "Yes, I bought a blouse." },
        { imageWord: "periódico",  question: "¿Compró el periódico?",   questionTranslation: "Did you buy the newspaper?",answer: "Sí, compré el periódico.",   answerTranslation: "Yes, I bought the newspaper." },
        { imageWord: "automóvil",  question: "¿Compró un automóvil?",   questionTranslation: "Did you buy a car?",        answer: "Sí, compré un automóvil.",   answerTranslation: "Yes, I bought a car." },
        { imageWord: "sombrero",   question: "¿Compró un sombrero?",    questionTranslation: "Did you buy a hat?",        answer: "Sí, compré un sombrero.",    answerTranslation: "Yes, I bought a hat." },
      ],

      conjugationTable: [
        { form: "Comprar",   meaning: "to buy" },
        { form: "Compré",    meaning: "I bought" },
        { form: "Compró",    meaning: "you bought · he bought · she bought" },
        { form: "¿Compró?",  meaning: "did you buy?" },
        { form: "Compramos", meaning: "we bought" },
        { form: "Compraron", meaning: "they bought" },
      ],

      sentenceColumns: [
        {
          items: [
            { text: "Compré",    translation: "I bought" },
            { text: "Compró",    translation: "you / he / she bought" },
            { text: "¿Compró?",  translation: "did you buy?" },
            { text: "Compramos", translation: "we bought" },
            { text: "Compraron", translation: "they bought" },
          ],
        },
        {
          items: [
            { text: "café",          translation: "coffee" },
            { text: "una blusa",     translation: "a blouse" },
            { text: "el periódico",  translation: "the newspaper" },
            { text: "un auto",       translation: "a car" },
          ],
        },
      ],
    },

    // ── Cluster 2: Para la cena ───────────────────────────────────────────────
    {
      anchorItems: [
        { spanish: "Compré,",        english: "I bought." },
        { spanish: "para,",          english: "for." },
        { spanish: "para la cena,",  english: "for dinner, for supper." },
        { spanish: "¿Compró?",       english: "did you buy?" },
      ],

      qaCards: [
        { imageWord: "pollo",    question: "¿Compró un pollo para la cena?",   questionTranslation: "Did you buy a chicken for dinner?",  answer: "Sí, compré un pollo para la cena.",   answerTranslation: "Yes, I bought a chicken for dinner." },
        { imageWord: "apio",     question: "¿Compró apio para la cena?",       questionTranslation: "Did you buy celery for dinner?",     answer: "Sí, compré apio para la cena.",       answerTranslation: "Yes, I bought celery for dinner." },
        { imageWord: "tomates",  question: "¿Compró tomates para la cena?",    questionTranslation: "Did you buy tomatoes for dinner?",   answer: "Sí, compré tomates para la cena.",    answerTranslation: "Yes, I bought tomatoes for dinner." },
        { imageWord: "lechuga",  question: "¿Compró lechuga para la cena?",    questionTranslation: "Did you buy lettuce for dinner?",    answer: "Sí, compré lechuga para la cena.",    answerTranslation: "Yes, I bought lettuce for dinner." },
      ],

      noteAfter: "Esta noche: Tonight\nCompraré tomates para la cena esta noche. (I will buy tomatoes for dinner tonight.)\nCompraré lechuga para la cena esta noche. (I will buy lettuce for dinner tonight.)",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Near Future: Voy a + Infinitive
// Source: Madrigal pp. 36–42
//
// Seven vocabulary clusters across six pages:
//   1. Voy a comprar — clothing (statement grid + combinator)
//   2. ¿Va a comprar? Q&A + conjugation table
//   3. Esta mañana — Q&A with time expression
//   4. ¿Van al mercado? — third-person plural
//   5. Voy a tomar — transportation
//   6. Voy a tomar — food (with "tomar = to have" note)
//   7. Activity verbs: nadar, cantar, bailar, pescar (page 42)
// ═══════════════════════════════════════════════════════════════════════════════

const NEAR_FUTURE_VOY_A: PreteriteUnitContent = {
  chapterTitleKey: "voy a",

  clusters: [
    // ── Cluster 1: voy a comprar — clothing (pp. 36) ──────────────────────────
    {
      anchorItems: [
        { spanish: "Voy a comprar,", english: "I'm going to buy." },
        { spanish: "Una,",           english: "A or an." },
        { spanish: "Una bufanda,",   english: "A scarf." },
      ],

      statementCards: [
        { word: "blusa",   sentence: "Voy a comprar una blusa.",   translation: "I'm going to buy a blouse.",  imageDescription: "a woman's blouse on a hanger" },
        { word: "falda",   sentence: "Voy a comprar una falda.",   translation: "I'm going to buy a skirt.",   imageDescription: "a skirt on a hanger" },
        { word: "bufanda", sentence: "Voy a comprar una bufanda.", translation: "I'm going to buy a scarf.",   imageDescription: "a colorful wool scarf" },
        { word: "corbata", sentence: "Voy a comprar una corbata.", translation: "I'm going to buy a tie.",     imageDescription: "a dress necktie" },
      ],

      sentenceColumns: [
        {
          items: [
            { text: "¿Va a comprar", translation: "Are you going to buy" },
          ],
        },
        {
          items: [
            { text: "una blusa?",   translation: "a blouse?" },
            { text: "una corbata?", translation: "a tie?" },
            { text: "una falda?",   translation: "a skirt?" },
            { text: "una bufanda?", translation: "a scarf?" },
          ],
        },
      ],
    },

    // ── Cluster 2: ¿Va a comprar? Q&A + conjugation table (pp. 37) ───────────
    {
      anchorItems: [],

      qaCards: [
        { imageWord: "sombrero", question: "¿Va a comprar un sombrero?", questionTranslation: "Are you going to buy a hat?",    answer: "Sí, voy a comprar.", answerTranslation: "Yes, I'm going to buy." },
        { imageWord: "blusa",    question: "¿Va a comprar una blusa?",   questionTranslation: "Are you going to buy a blouse?", answer: "Sí, voy a comprar.", answerTranslation: "Yes, I'm going to buy." },
        { imageWord: "corbata",  question: "¿Va a comprar una corbata?", questionTranslation: "Are you going to buy a tie?",    answer: "Sí, voy a comprar.", answerTranslation: "Yes, I'm going to buy." },
        { imageWord: "falda",    question: "¿Va a comprar una falda?",   questionTranslation: "Are you going to buy a skirt?",  answer: "Sí, voy a comprar.", answerTranslation: "Yes, I'm going to buy." },
      ],

      conjugationTable: [
        { form: "Voy a comprar",   meaning: "I'm going to buy" },
        { form: "Va a comprar",    meaning: "Are you going to buy? · He is going to buy" },
        { form: "Vamos a comprar", meaning: "We are going to buy" },
        { form: "Van a comprar",   meaning: "They are going to buy" },
      ],
    },

    // ── Cluster 3: esta mañana — Q&A with time expression (pp. 38) ───────────
    {
      anchorItems: [
        { spanish: "Esta mañana,", english: "This morning." },
      ],

      qaCards: [
        { imageWord: "sombrero", question: "¿Va a comprar un sombrero esta mañana?", questionTranslation: "Are you going to buy a hat this morning?",     answer: "Sí, voy a comprar un sombrero esta mañana.", answerTranslation: "Yes, I'm going to buy a hat this morning." },
        { imageWord: "blusa",    question: "¿Va a comprar una blusa esta mañana?",   questionTranslation: "Are you going to buy a blouse this morning?",  answer: "Sí, voy a comprar una blusa esta mañana.",   answerTranslation: "Yes, I'm going to buy a blouse this morning." },
        { imageWord: "corbata",  question: "¿Va a comprar una corbata esta mañana?", questionTranslation: "Are you going to buy a tie this morning?",     answer: "Sí, voy a comprar una corbata esta mañana.", answerTranslation: "Yes, I'm going to buy a tie this morning." },
      ],
    },

    // ── Cluster 4: ¿Van al mercado? — third-person plural (pp. 39) ───────────
    {
      anchorItems: [
        { spanish: "¿Van... al mercado?", english: "Are they going to the market?" },
        { spanish: "Van al...",           english: "They are going to the..." },
      ],

      qaCards: [
        { imageWord: "hotel",   question: "¿Van al hotel?",   questionTranslation: "Are they going to the hotel?",   answer: "Sí, van al hotel.",   answerTranslation: "Yes, they're going to the hotel." },
        { imageWord: "garaje",  question: "¿Van al garaje?",  questionTranslation: "Are they going to the garage?",  answer: "Sí, van al garaje.",  answerTranslation: "Yes, they're going to the garage." },
        { imageWord: "cine",    question: "¿Van al cine?",    questionTranslation: "Are they going to the cinema?",  answer: "Sí, van al cine.",    answerTranslation: "Yes, they're going to the cinema." },
        { imageWord: "mercado", question: "¿Van al mercado?", questionTranslation: "Are they going to the market?",  answer: "Sí, van al mercado.", answerTranslation: "Yes, they're going to the market." },
      ],
    },

    // ── Cluster 5: voy a tomar — transportation (pp. 40) ─────────────────────
    {
      anchorItems: [
        { spanish: "¿Va a tomar?", english: "Are you going to take?" },
        { spanish: "Voy a tomar,", english: "I'm going to take." },
      ],

      qaCards: [
        { imageWord: "taxi",    question: "¿Va a tomar un taxi?",    questionTranslation: "Are you going to take a taxi?",  answer: "Sí, voy a tomar un taxi.",    answerTranslation: "Yes, I'm going to take a taxi." },
        { imageWord: "tren",    question: "¿Va a tomar un tren?",    questionTranslation: "Are you going to take a train?", answer: "Sí, voy a tomar un tren.",    answerTranslation: "Yes, I'm going to take a train." },
        { imageWord: "autobús", question: "¿Va a tomar un autobús?", questionTranslation: "Are you going to take a bus?",   answer: "Sí, voy a tomar un autobús.", answerTranslation: "Yes, I'm going to take a bus." },
        { imageWord: "avión",   question: "¿Va a tomar un avión?",   questionTranslation: "Are you going to take a plane?", answer: "Sí, voy a tomar un avión.",   answerTranslation: "Yes, I'm going to take a plane." },
      ],
    },

    // ── Cluster 6: voy a tomar — food (pp. 41) ────────────────────────────────
    {
      anchorItems: [
        { spanish: "¿Va a tomar?",  english: "Are you going to have?" },
        { spanish: "Una ensalada,", english: "A salad." },
        { spanish: "Chocolate,",    english: "Chocolate." },
        { spanish: "Pollo,",        english: "Chicken." },
      ],

      noteBefore: "In Spanish, we use tomar (to take) to express eating and drinking. Instead of \"I'm going to have soup,\" we say \"Voy a tomar sopa.\"",

      qaCards: [
        { imageWord: "ensalada", question: "¿Va a tomar una ensalada?", questionTranslation: "Are you going to have a salad?",  answer: "Sí, voy a tomar una ensalada.", answerTranslation: "Yes, I'm going to have a salad." },
        { imageWord: "café",     question: "¿Va a tomar café?",         questionTranslation: "Are you going to have coffee?",   answer: "Sí, voy a tomar café.",         answerTranslation: "Yes, I'm going to have coffee." },
        { imageWord: "apio",     question: "¿Va a tomar apio?",         questionTranslation: "Are you going to have celery?",   answer: "Sí, voy a tomar apio.",         answerTranslation: "Yes, I'm going to have celery." },
        { imageWord: "sopa",     question: "¿Va a tomar sopa?",         questionTranslation: "Are you going to have soup?",     answer: "Sí, voy a tomar sopa.",         answerTranslation: "Yes, I'm going to have soup." },
      ],
    },

    // ── Cluster 7: activity verbs — page 42 ───────────────────────────────────
    //
    // New verbs: nadar, cantar, bailar, pescar.
    // Q&A drill, then a 3-column combinator: ¿Va a [verb] esta noche?
    {
      anchorItems: [
        { spanish: "Nadar,",  english: "To swim." },
        { spanish: "Cantar,", english: "To sing." },
        { spanish: "Bailar,", english: "To dance." },
        { spanish: "Pescar,", english: "To fish." },
      ],

      qaCards: [
        { imageWord: "bailar", question: "¿Va a bailar?", questionTranslation: "Are you going to dance?", answer: "Sí, voy a bailar.", answerTranslation: "Yes, I'm going to dance." },
        { imageWord: "nadar",  question: "¿Va a nadar?",  questionTranslation: "Are you going to swim?",  answer: "Sí, voy a nadar.",  answerTranslation: "Yes, I'm going to swim." },
        { imageWord: "cantar", question: "¿Va a cantar?", questionTranslation: "Are you going to sing?",  answer: "Sí, voy a cantar.", answerTranslation: "Yes, I'm going to sing." },
        { imageWord: "pescar", question: "¿Va a pescar?", questionTranslation: "Are you going to fish?",  answer: "Sí, voy a pescar.", answerTranslation: "Yes, I'm going to fish." },
      ],

      // 3-column combinator: ¿Va a [verb] esta noche?
      sentenceColumns: [
        {
          items: [
            { text: "¿Va a", translation: "Are you going to" },
          ],
        },
        {
          items: [
            { text: "bailar", translation: "dance" },
            { text: "nadar",  translation: "swim" },
            { text: "cantar", translation: "sing" },
            { text: "pescar", translation: "fish" },
          ],
        },
        {
          items: [
            { text: "esta noche?", translation: "tonight?" },
          ],
        },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Tener: I Have
// Source: Madrigal pp. 46–53
//
// Seven vocabulary clusters:
//   1. ¿Tiene? basic possession — auto/bicicleta/guitarra/fonógrafo (p. 46)
//   2. Tiene + vocabulary — mantequilla/azúcar/discos/libros (p. 47)
//   3. En casa — humorous negative Q&A (pp. 48–49)
//   4. Tengo que comprar — statement cards (p. 50)
//   5. ¿Tiene que comprar? — Q&A (p. 51)
//   6. Tengo que ir — places + sentence combinator (p. 52)
//   7. Everyday expressions (p. 53)
// ═══════════════════════════════════════════════════════════════════════════════

const TENER_I_HAVE: PreteriteUnitContent = {
  chapterTitleKey: "tener",

  clusters: [
    // ── Cluster 1: ¿Tiene? basic possession (p. 46) ───────────────────────────
    {
      anchorItems: [
        { spanish: "¿Tiene?",  english: "Have you?" },
        { spanish: "Un, Una,", english: "A, an." },
        { spanish: "Tengo,",   english: "I have." },
        { spanish: "Sí,",      english: "Yes." },
      ],

      qaCards: [
        { imageWord: "auto",      question: "¿Tiene un auto?",       questionTranslation: "Do you have a car?",        answer: "Sí, tengo un auto.",       answerTranslation: "Yes, I have a car." },
        { imageWord: "bicicleta", question: "¿Tiene una bicicleta?", questionTranslation: "Do you have a bicycle?",    answer: "Sí, tengo una bicicleta.", answerTranslation: "Yes, I have a bicycle." },
        { imageWord: "guitarra",  question: "¿Tiene una guitarra?",  questionTranslation: "Do you have a guitar?",     answer: "Sí, tengo una guitarra.",  answerTranslation: "Yes, I have a guitar." },
        { imageWord: "fonógrafo", question: "¿Tiene un fonógrafo?",  questionTranslation: "Do you have a phonograph?", answer: "Sí, tengo un fonógrafo.",  answerTranslation: "Yes, I have a phonograph." },
      ],

      conjugationTable: [
        { form: "Tener",   meaning: "to have" },
        { form: "Tengo",   meaning: "I have" },
        { form: "Tenemos", meaning: "we have" },
        { form: "¿Tiene?", meaning: "have you?" },
        { form: "Tienen",  meaning: "they have" },
        { form: "Tiene",   meaning: "he has · she has · you have" },
      ],
    },

    // ── Cluster 2: Tiene — vocabulary + forms (p. 47) ────────────────────────
    {
      anchorItems: [
        { spanish: "Mantequilla,",   english: "Butter." },
        { spanish: "Azúcar,",        english: "Sugar." },
        { spanish: "Muchos discos,", english: "Many records." },
        { spanish: "Muchos libros,", english: "Many books." },
      ],

      statementCards: [
        { word: "discos", sentence: "Tiene muchos discos.", translation: "He has many records.", imageDescription: "a collection of vinyl records" },
        { word: "libros", sentence: "Tiene muchos libros.", translation: "He has many books.",   imageDescription: "a large stack of books" },
      ],

      // Madrigal shows that "Tiene" covers four English translations —
      // and "¿Tiene?" covers the same four as questions.
      conjugationTable: [
        { form: "Tiene",   meaning: "you have · he has · she has · it has" },
        { form: "¿Tiene?", meaning: "Have you? · Has he? · Has she? · Has it?" },
      ],
    },

    // ── Cluster 3: En casa — humorous negative Q&A (pp. 48–49) ──────────────
    {
      anchorItems: [
        { spanish: "En casa,",         english: "At home." },
        { spanish: "Por fortuna,",     english: "Fortunately." },
        { spanish: "Eso es terrible,", english: "That is terrible." },
      ],

      noteBefore: "¡Caramba! — Good gracious! / For goodness' sake! In this section we practice the negative with some very surprising situations.",

      qaCards: [
        { imageWord: "gorila",    question: "¿Tiene un gorila en casa?",     questionTranslation: "Do you have a gorilla at home?",   answer: "¡Caramba, no! ¡Es ridículo! No tengo un gorila en casa.",                             answerTranslation: "Good gracious, no! That's ridiculous! I don't have a gorilla at home." },
        { imageWord: "toro",      question: "¿Tiene un toro en casa?",       questionTranslation: "Do you have a bull at home?",       answer: "¡No! ¡Es absolutamente ridículo! No tengo un toro en casa.",                          answerTranslation: "No! That's absolutely ridiculous! I don't have a bull at home." },
        { imageWord: "elefante",  question: "¿Tiene un elefante en casa?",   questionTranslation: "Do you have an elephant at home?", answer: "¡Caramba, no! ¡Es absolutamente ridículo! No tengo un elefante en casa. ¡No es posible!", answerTranslation: "Good gracious, no! Absolutely ridiculous! I don't have an elephant at home. It's impossible!" },
        { imageWord: "león",      question: "¿Tiene un león en casa?",       questionTranslation: "Do you have a lion at home?",       answer: "¡Caramba! ¡Eso es terrible! No tengo un león en casa.",                               answerTranslation: "Good gracious! That's terrible! I don't have a lion at home." },
        { imageWord: "rata",      question: "¿Tiene una rata en casa?",      questionTranslation: "Do you have a rat at home?",        answer: "¡Eso es terrible! No tengo una rata en casa.",                                        answerTranslation: "That's terrible! I don't have a rat at home." },
        { imageWord: "serpiente", question: "¿Tiene una serpiente en casa?", questionTranslation: "Do you have a snake at home?",      answer: "¡Caramba! ¡Eso es terrible! No tengo una serpiente en casa.",                         answerTranslation: "Good gracious! That's terrible! I don't have a snake at home." },
      ],

      noteAfter: "Eso es ridículo. — That is ridiculous.\nEso es absolutamente ridículo. — That is absolutely ridiculous.",
    },

    // ── Cluster 4: Tengo que comprar — statement cards (p. 50) ───────────────
    {
      anchorItems: [
        { spanish: "Tengo que comprar,", english: "I have to buy." },
        { spanish: "Un, Una,",           english: "A, an." },
      ],

      statementCards: [
        { word: "silla",    sentence: "Tengo que comprar una silla.",  translation: "I have to buy a chair.",   imageDescription: "a simple wooden chair" },
        { word: "jabón",    sentence: "Tengo que comprar jabón.",      translation: "I have to buy soap.",      imageDescription: "a bar of soap" },
        { word: "cortinas", sentence: "Tengo que comprar cortinas.",   translation: "I have to buy curtains.",  imageDescription: "window curtains" },
        { word: "camisa",   sentence: "Tengo que comprar una camisa.", translation: "I have to buy a shirt.",   imageDescription: "a button-up shirt" },
      ],

      noteAfter: "Tenemos que comprar — We have to buy\nTenemos que comprar café.\nTenemos que comprar un auto.",
    },

    // ── Cluster 5: ¿Tiene que comprar? Q&A (p. 51) ───────────────────────────
    {
      anchorItems: [
        { spanish: "Huevos,",             english: "Eggs." },
        { spanish: "¿Tiene que comprar?", english: "Do you have to buy?" },
        { spanish: "Tengo que comprar,",  english: "I have to buy." },
      ],

      qaCards: [
        { imageWord: "auto",    question: "¿Tiene que comprar un auto?",     questionTranslation: "Do you have to buy a car?",   answer: "Sí, tengo que comprar un auto.",     answerTranslation: "Yes, I have to buy a car." },
        { imageWord: "jabón",   question: "¿Tiene que comprar jabón?",       questionTranslation: "Do you have to buy soap?",    answer: "Sí, tengo que comprar jabón.",       answerTranslation: "Yes, I have to buy soap." },
        { imageWord: "huevos",  question: "¿Tiene que comprar huevos?",      questionTranslation: "Do you have to buy eggs?",    answer: "Sí, tengo que comprar huevos.",      answerTranslation: "Yes, I have to buy eggs." },
        { imageWord: "lámpara", question: "¿Tiene que comprar una lámpara?", questionTranslation: "Do you have to buy a lamp?",  answer: "Sí, tengo que comprar una lámpara.", answerTranslation: "Yes, I have to buy a lamp." },
      ],
    },

    // ── Cluster 6: Tengo que ir — places + sentence combinator (p. 52) ───────
    {
      anchorItems: [
        { spanish: "Tengo que ir,",    english: "I have to go." },
        { spanish: "Al,",              english: "To the." },
        { spanish: "Al correo,",       english: "To the post office." },
        { spanish: "Al despacho,",     english: "To the office." },
      ],

      statementCards: [
        { word: "correo",      sentence: "Tengo que ir al correo.",      translation: "I have to go to the post office.", imageDescription: "a post office building" },
        { word: "banco",       sentence: "Tengo que ir al banco.",       translation: "I have to go to the bank.",        imageDescription: "a bank building exterior" },
        { word: "restaurante", sentence: "Tengo que ir al restaurante.", translation: "I have to go to the restaurant.",  imageDescription: "a restaurant exterior" },
        { word: "despacho",    sentence: "Tengo que ir al despacho.",    translation: "I have to go to the office.",      imageDescription: "an office building" },
      ],

      sentenceColumns: [
        {
          items: [
            { text: "Tengo que ir", translation: "I have to go" },
          ],
        },
        {
          items: [
            { text: "al hotel.",       translation: "to the hotel." },
            { text: "al hospital.",    translation: "to the hospital." },
            { text: "al club.",        translation: "to the club." },
            { text: "al correo.",      translation: "to the post office." },
            { text: "al banco.",       translation: "to the bank." },
            { text: "al restaurante.", translation: "to the restaurant." },
          ],
        },
      ],
    },

    // ── Cluster 7: Everyday expressions (p. 53) ──────────────────────────────
    {
      anchorItems: [
        { spanish: "Tengo tiempo,",             english: "I have time." },
        { spanish: "No tengo tiempo,",          english: "I don't have time." },
        { spanish: "Tengo visitas,",            english: "I have company." },
        { spanish: "Tengo catarro,",            english: "I have a cold." },
        { spanish: "Tengo hambre,",             english: "I'm hungry." },
        { spanish: "Tengo sed,",                english: "I'm thirsty." },
        { spanish: "Tengo frío,",               english: "I'm cold." },
        { spanish: "Tengo calor,",              english: "I'm warm." },
        { spanish: "Tengo dolor de cabeza,",    english: "I have a headache." },
        { spanish: "Tiene razón,",              english: "You are right." },
        { spanish: "¿Qué tiene?,",              english: "What's wrong? / What have you got?" },
        { spanish: "¿Cuántos años tiene?,",     english: "How old are you?" },
        { spanish: "Alberto tiene cinco años,", english: "Albert is five years old." },
      ],

      conjugationTable: [
        { form: "Tengo",   meaning: "I have" },
        { form: "Tiene",   meaning: "you have · he has · she has" },
        { form: "Tenemos", meaning: "we have" },
        { form: "Tienen",  meaning: "they have" },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Quiero: I Want
// Source: Madrigal pp. 56–61
//
// Six vocabulary clusters:
//   1. Quiero comprar — 4 statement cards + conjugation table + combiner (p. 56)
//   2. ¿Quiere comprar? — Q&A + Quiere forms (p. 57)
//   3. Quiero ir al — 4 statement cards + 2-col combiner (p. 58)
//   4. ¿Quiere ir a la? — Q&A + Queremos ir combiner (p. 59)
//   5. Te quiero — love expressions (p. 60)
//   6. ¿Quieres ___ mañana? — Q&A with activity verbs (p. 61)
// ═══════════════════════════════════════════════════════════════════════════════

const QUIERO_I_WANT: PreteriteUnitContent = {
  chapterTitleKey: "quiero",

  clusters: [
    // ── Cluster 1: Quiero comprar — statement cards + conjugation + combiner (p. 56) ──
    {
      anchorItems: [
        { spanish: "Comprar,",        english: "To buy." },
        { spanish: "Quiero comprar,", english: "I want to buy." },
        { spanish: "Un, Una,",        english: "A, an." },
      ],

      statementCards: [
        { word: "auto",       sentence: "Quiero comprar un auto.",        translation: "I want to buy a car.",      imageDescription: "a car" },
        { word: "bicicleta",  sentence: "Quiero comprar una bicicleta.",  translation: "I want to buy a bicycle.",  imageDescription: "a bicycle" },
        { word: "falda",      sentence: "Quiero comprar una falda.",      translation: "I want to buy a skirt.",    imageDescription: "a skirt" },
        { word: "blusa",      sentence: "Quiero comprar una blusa.",      translation: "I want to buy a blouse.",   imageDescription: "a blouse" },
      ],

      conjugationTable: [
        { form: "Querer",   meaning: "to want" },
        { form: "Quiero",   meaning: "I want" },
        { form: "Quieres",  meaning: "you want" },
        { form: "¿Quiere?", meaning: "do you want?" },
        { form: "Queremos", meaning: "we want" },
        { form: "Quieren",  meaning: "they want" },
      ],

      sentenceColumns: [
        {
          items: [
            { text: "Quiere comprar", translation: "He/she wants to buy" },
          ],
        },
        {
          items: [
            { text: "una pipa.",  translation: "a pipe." },
            { text: "una falda.", translation: "a skirt." },
            { text: "una blusa.", translation: "a blouse." },
          ],
        },
      ],
    },

    // ── Cluster 2: ¿Quiere comprar? Q&A + Quiere forms (p. 57) ──────────────
    {
      anchorItems: [
        { spanish: "Una,",             english: "A, an." },
        { spanish: "¿Quiere comprar?", english: "Do you want to buy?" },
        { spanish: "Quiero comprar,",  english: "I want to buy." },
      ],

      qaCards: [
        { imageWord: "chocolates", question: "¿Quiere comprar chocolates?",  questionTranslation: "Do you want to buy chocolates?", answer: "Sí, quiero comprar chocolates.",  answerTranslation: "Yes, I want to buy chocolates.", imageDescription: "assorted chocolates in an open box, no people" },
        { imageWord: "peras",      question: "¿Quiere comprar peras?",       questionTranslation: "Do you want to buy pears?",       answer: "Sí, quiero comprar peras.",       answerTranslation: "Yes, I want to buy pears." },
        { imageWord: "corbata",    question: "¿Quiere comprar una corbata?", questionTranslation: "Do you want to buy a tie?",       answer: "Sí, quiero comprar una corbata.", answerTranslation: "Yes, I want to buy a tie." },
        { imageWord: "camisa",     question: "¿Quiere comprar una camisa?",  questionTranslation: "Do you want to buy a shirt?",     answer: "Sí, quiero comprar una camisa.",  answerTranslation: "Yes, I want to buy a shirt." },
      ],

      conjugationTable: [
        { form: "Quiere",   meaning: "you want · he wants · she wants · it wants" },
        { form: "¿Quiere?", meaning: "Do you want? · Does he want? · Does she want?" },
      ],

      noteAfter: "Alberto quiere comprar un auto. — Albert wants to buy a car.",
    },

    // ── Cluster 3: Quiero ir al — statement cards + 2-col combiner (p. 58) ───
    {
      anchorItems: [
        { spanish: "Ir,",        english: "To go." },
        { spanish: "Quiero ir,", english: "I want to go." },
        { spanish: "Al,",        english: "To the." },
      ],

      statementCards: [
        { word: "parque",    sentence: "Quiero ir al parque.",    translation: "I want to go to the park.",    imageDescription: "a sunny public park with benches and trees, no people" },
        { word: "cine",      sentence: "Quiero ir al cine.",      translation: "I want to go to the movies.",  imageDescription: "exterior facade of a movie cinema building with a marquee sign, no people" },
        { word: "concierto", sentence: "Quiero ir al concierto.", translation: "I want to go to the concert.", imageDescription: "interior of a concert hall with seats and a stage, no people" },
        { word: "teatro",    sentence: "Quiero ir al teatro.",    translation: "I want to go to the theater.", imageDescription: "exterior of a grand theater building at night, no people" },
      ],

      sentenceColumns: [
        {
          items: [
            { text: "Quiero ir", translation: "I want to go" },
            { text: "Quiere ir", translation: "He/she wants to go" },
          ],
        },
        {
          items: [
            { text: "al restaurante.", translation: "to the restaurant." },
            { text: "al hotel.",       translation: "to the hotel." },
            { text: "a México.",       translation: "to Mexico." },
            { text: "a París.",        translation: "to Paris." },
            { text: "al cine.",        translation: "to the movies." },
            { text: "al concierto.",   translation: "to the concert." },
          ],
        },
      ],
    },

    // ── Cluster 4: ¿Quiere ir a la? Q&A + Queremos ir combiner (p. 59) ───────
    {
      anchorItems: [
        { spanish: "¿Quiere ir?,",  english: "Do you want to go?" },
        { spanish: "Quiero ir,",    english: "I want to go." },
        { spanish: "A la fiesta,",  english: "To the party." },
        { spanish: "A la tienda,",  english: "To the store." },
        { spanish: "A la playa,",   english: "To the beach." },
      ],

      qaCards: [
        { imageWord: "fiesta", question: "¿Quiere ir a la fiesta?", questionTranslation: "Do you want to go to the party?", answer: "Sí, quiero ir a la fiesta.", answerTranslation: "Yes, I want to go to the party." },
        { imageWord: "playa",  question: "¿Quiere ir a la playa?",  questionTranslation: "Do you want to go to the beach?", answer: "Sí, quiero ir a la playa.",  answerTranslation: "Yes, I want to go to the beach." },
        { imageWord: "tienda", question: "¿Quiere ir a la tienda?", questionTranslation: "Do you want to go to the store?", answer: "Sí, quiero ir a la tienda.", answerTranslation: "Yes, I want to go to the store." },
        { imageWord: "casa",   question: "¿Quiere ir a la casa?",   questionTranslation: "Do you want to go home?",         answer: "Sí, quiero ir a la casa.",   answerTranslation: "Yes, I want to go home." },
      ],

      sentenceColumns: [
        {
          items: [
            { text: "Queremos ir", translation: "We want to go" },
          ],
        },
        {
          items: [
            { text: "a la fiesta.", translation: "to the party." },
            { text: "a la playa.",  translation: "to the beach." },
            { text: "a la tienda.", translation: "to the store." },
            { text: "a la casa.",   translation: "home." },
          ],
        },
      ],
    },

    // ── Cluster 5: Te quiero — love expressions (p. 60) ──────────────────────
    {
      noteBefore: "Quiero means both 'I want' and 'I love.' When naming a specific person, use quiero a: Quiero a mi mamá.",

      anchorItems: [
        { spanish: "Quiero,",              english: "I want. / I love." },
        { spanish: "Te quiero,",           english: "I love you." },
        { spanish: "Lo quiero,",           english: "I love him." },
        { spanish: "La quiero,",           english: "I love her." },
        { spanish: "Te quiero mucho,",     english: "I love you very much." },
        { spanish: "Te quiero muchísimo,", english: "I love you very, very much." },
        { spanish: "Quiero a Roberto,",    english: "I love Robert." },
        { spanish: "Quiero a María,",      english: "I love Mary." },
        { spanish: "Quiero a mi mamá,",    english: "I love my mother." },
        { spanish: "Quiero a mi papá,",    english: "I love my father." },
      ],
    },

    // ── Cluster 6: ¿Quieres ___ mañana? — activity Q&A (p. 61) ──────────────
    {
      anchorItems: [
        { spanish: "¿Quiere dormir?,", english: "Do you want to sleep?" },
        { spanish: "Mañana,",          english: "Tomorrow." },
      ],

      qaCards: [
        { imageWord: "nadar",    question: "¿Quiere nadar mañana?",    questionTranslation: "Do you want to swim tomorrow?",  answer: "Sí, quiero nadar mañana.",    answerTranslation: "Yes, I want to swim tomorrow." },
        { imageWord: "dormir",   question: "¿Quiere dormir mañana?",   questionTranslation: "Do you want to sleep tomorrow?", answer: "Sí, quiero dormir mañana.",   answerTranslation: "Yes, I want to sleep tomorrow." },
        { imageWord: "estudiar", question: "¿Quiere estudiar mañana?", questionTranslation: "Do you want to study tomorrow?", answer: "Sí, quiero estudiar mañana.", answerTranslation: "Yes, I want to study tomorrow." },
        { imageWord: "pescar",   question: "¿Quiere pescar mañana?",   questionTranslation: "Do you want to fish tomorrow?",  answer: "Sí, quiero pescar mañana.",   answerTranslation: "Yes, I want to fish tomorrow." },
      ],
    },
  ],
};

// ── Registries ────────────────────────────────────────────────────────────────

const MADRIGAL_VERB_UNITS: MadrigalVerbUnitContent[] = [
  IR_GOING_PLACES,
];

const PRETERITE_UNITS: PreteriteUnitContent[] = [
  NEAR_FUTURE_VOY_A,
  TOMAR_I_TOOK,
  COMPRAR_I_BOUGHT,
  TENER_I_HAVE,
  QUIERO_I_WANT,
];

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter 33: Ser — Gender & Plurals
// Source: Madrigal pp. 64–71
// ═══════════════════════════════════════════════════════════════════════════════

const SER_PLURALS_GENDER: SerUnitContent = {
  chapterTitleKey: 'ser',
  clusters: [
    // ─── p64: El / Los (masculine singular/plural) ──────────────────────────
    {
      type: 'article-pairs',
      articleSingular: 'el',
      articlePlural: 'los',
      pluralRule: 'To form the plural of a word that ends in a vowel, add the letter S.',
      pairs: [
        { imageWord: 'sombrero', imageDescription: 'a wide-brimmed sombrero hat', leftLabel: 'El sombrero', leftTranslation: 'the hat', rightLabel: 'Los sombreros', rightTranslation: 'the hats' },
        { imageWord: 'libro', imageDescription: 'a book', leftLabel: 'El libro', leftTranslation: 'the book', rightLabel: 'Los libros', rightTranslation: 'the books' },
        { imageWord: 'caballo', imageDescription: 'a horse', leftLabel: 'El caballo', leftTranslation: 'the horse', rightLabel: 'Los caballos', rightTranslation: 'the horses' },
        { imageWord: 'perro', imageDescription: 'a dog', leftLabel: 'El perro', leftTranslation: 'the dog', rightLabel: 'Los perros', rightTranslation: 'the dogs' },
      ],
      footerNote: 'Words that end in O are masculine and take the articles el and los.',
    },
    // ─── p65: La / Las (feminine singular/plural) ───────────────────────────
    {
      type: 'article-pairs',
      articleSingular: 'la',
      articlePlural: 'las',
      pluralRule: 'To form the plural of a word that ends in a vowel, add the letter S.',
      pairs: [
        { imageWord: 'perra', imageDescription: 'a female dog', leftLabel: 'La perra', leftTranslation: 'the dog (f)', rightLabel: 'Las perras', rightTranslation: 'the dogs (f)' },
        { imageWord: 'casa', imageDescription: 'a house', leftLabel: 'La casa', leftTranslation: 'the house', rightLabel: 'Las casas', rightTranslation: 'the houses' },
        { imageWord: 'rosa', imageDescription: 'a red rose', leftLabel: 'La rosa', leftTranslation: 'the rose', rightLabel: 'Las rosas', rightTranslation: 'the roses' },
        { imageWord: 'blusa', imageDescription: 'a blouse', leftLabel: 'La blusa', leftTranslation: 'the blouse', rightLabel: 'Las blusas', rightTranslation: 'the blouses' },
      ],
      footerNote: 'Words that end in A are feminine and take the articles la and las.',
    },
    // ─── p66: Masculine es/son sentences ────────────────────────────────────
    {
      type: 'es-son-sentences',
      anchorItems: [
        { spanish: 'bonito', english: 'pretty (m)' },
        { spanish: 'bonitos', english: 'pretty (m. pl.)' },
        { spanish: 'delicioso', english: 'delicious (m)' },
        { spanish: 'deliciosos', english: 'delicious (m. pl.)' },
        { spanish: 'rábano', english: 'radish' },
        { spanish: 'plátano', english: 'banana' },
        { spanish: 'es', english: 'is' },
        { spanish: 'son', english: 'are' },
      ],
      pairs: [
        { imageWord: 'caballo', imageDescription: 'a horse', leftLabel: 'El caballo es bonito.', leftTranslation: 'The horse is pretty.', rightLabel: 'Los caballos son bonitos.', rightTranslation: 'The horses are pretty.' },
        { imageWord: 'libro', imageDescription: 'a book', leftLabel: 'El libro es bonito.', leftTranslation: 'The book is pretty.', rightLabel: 'Los libros son bonitos.', rightTranslation: 'The books are pretty.' },
        { imageWord: 'plátano', imageDescription: 'a banana', leftLabel: 'El plátano es delicioso.', leftTranslation: 'The banana is delicious.', rightLabel: 'Los plátanos son deliciosos.', rightTranslation: 'The bananas are delicious.' },
        { imageWord: 'rábano', imageDescription: 'a radish', leftLabel: 'El rábano es delicioso.', leftTranslation: 'The radish is delicious.', rightLabel: 'Los rábanos son deliciosos.', rightTranslation: 'The radishes are delicious.' },
      ],
    },
    // ─── p67: Feminine es/son sentences ─────────────────────────────────────
    {
      type: 'es-son-sentences',
      anchorItems: [
        { spanish: 'bonita', english: 'pretty (f)' },
        { spanish: 'bonitas', english: 'pretty (f. pl.)' },
        { spanish: 'deliciosa', english: 'delicious (f)' },
        { spanish: 'deliciosas', english: 'delicious (f. pl.)' },
      ],
      pairs: [
        { imageWord: 'manzana', imageDescription: 'an apple', leftLabel: 'La manzana es deliciosa.', leftTranslation: 'The apple is delicious.', rightLabel: 'Las manzanas son deliciosas.', rightTranslation: 'The apples are delicious.' },
        { imageWord: 'mariposa', imageDescription: 'a butterfly', leftLabel: 'La mariposa es bonita.', leftTranslation: 'The butterfly is pretty.', rightLabel: 'Las mariposas son bonitas.', rightTranslation: 'The butterflies are pretty.' },
        { imageWord: 'perra', imageDescription: 'a female dog', leftLabel: 'La perra es bonita.', leftTranslation: 'The dog is pretty.', rightLabel: 'Las perras son bonitas.', rightTranslation: 'The dogs are pretty.' },
        { imageWord: 'rosa', imageDescription: 'a red rose', leftLabel: 'La rosa es bonita.', leftTranslation: 'The rose is pretty.', rightLabel: 'Las rosas son bonitas.', rightTranslation: 'The roses are pretty.' },
      ],
    },
    // ─── p68: ¿Son...? Q&A ───────────────────────────────────────────────────
    {
      type: 'ser-qa',
      cards: [
        { imageWord: 'vestido', imageDescription: 'a dress', question: '¿Son bonitos los vestidos?', questionTranslation: 'Are the dresses pretty?', answer: 'Sí, los vestidos son bonitos.', answerTranslation: 'Yes, the dresses are pretty.' },
        { imageWord: 'falda', imageDescription: 'a skirt', question: '¿Son bonitas las faldas?', questionTranslation: 'Are the skirts pretty?', answer: 'Sí, las faldas son bonitas.', answerTranslation: 'Yes, the skirts are pretty.' },
        { imageWord: 'corbata', imageDescription: 'a necktie', question: '¿Son bonitas las corbatas?', questionTranslation: 'Are the ties pretty?', answer: 'Sí, las corbatas son bonitas.', answerTranslation: 'Yes, the ties are pretty.' },
      ],
    },
    // ─── p69: Consonant plurals (add -es) ────────────────────────────────────
    {
      type: 'consonant-plural',
      pluralRule: 'To form the plural of words that end in a consonant, add es.',
      imagePairs: [
        { imageWord: 'doctor', imageDescription: 'a doctor in a white coat', leftLabel: 'El Doctor', leftTranslation: 'the doctor', rightLabel: 'Los Doctores', rightTranslation: 'the doctors' },
        { imageWord: 'flor', imageDescription: 'a flower', leftLabel: 'La Flor', leftTranslation: 'the flower', rightLabel: 'Las Flores', rightTranslation: 'the flowers' },
      ],
      wordList: [
        { singular: 'El animal', plural: 'Los animales' },
        { singular: 'El metal', plural: 'Los metales' },
        { singular: 'El cereal', plural: 'Los cereales' },
        { singular: 'El actor', plural: 'Los actores' },
        { singular: 'La invitación', plural: 'Las invitaciones' },
      ],
      wordListNote: 'Most words which end in "al" are alike in Spanish and English.',
      alWords: ['el animal', 'el hospital', 'natural', 'final', 'capital', 'central', 'personal', 'local', 'rural', 'plural', 'el canal', 'federal'],
    },
    // ─── p70: ¿Es muy...? Q&A ────────────────────────────────────────────────
    {
      type: 'ser-qa',
      anchorItems: [
        { spanish: 'Ay, sí', english: 'Oh yes!' },
        { spanish: 'Muy', english: 'Very' },
      ],
      cards: [
        { imageWord: 'torero', imageDescription: 'a Spanish bullfighter in traditional costume', question: '¿Es valiente el Torero?', questionTranslation: 'Is the bullfighter brave?', answer: 'Ay, sí, el Torero es muy valiente.', answerTranslation: 'Oh yes, the bullfighter is very brave.' },
        { imageWord: 'torero', imageDescription: 'a Spanish bullfighter in traditional costume', question: '¿Es romántico el Torero?', questionTranslation: 'Is the bullfighter romantic?', answer: 'Sí, el Torero es muy romántico.', answerTranslation: 'Yes, the bullfighter is very romantic.' },
        { imageWord: 'toro', imageDescription: 'a bull', question: '¿Es valiente el Toro?', questionTranslation: 'Is the bull brave?', answer: 'Sí, el Toro es muy valiente.', answerTranslation: 'Yes, the bull is very brave.' },
        { imageWord: 'dentista', imageDescription: 'a dentist treating a nervous patient', question: '¿Es valiente el paciente del dentista?', questionTranslation: "Is the dentist's patient brave?", answer: 'Ay, sí, el paciente del dentista es muy valiente.', answerTranslation: "Oh yes, the dentist's patient is very brave." },
      ],
      noteAfter: "Vamos a los toros. — Let's go to the bullfight!",
    },
    // ─── p71: Es/Son adjective pairs + expressions ───────────────────────────
    {
      type: 'adjective-expressions',
      anchorItems: [
        { spanish: 'es', english: 'is / it is' },
        { spanish: 'son', english: 'are / they are' },
      ],
      adjectives: [
        { singular: 'importante', plural: 'importantes', english: 'important' },
        { singular: 'terrible', plural: 'terribles', english: 'terrible' },
        { singular: 'fantástico', plural: 'fantásticos', english: 'fantastic' },
        { singular: 'bueno', plural: 'buenos', english: 'good' },
        { singular: 'malo', plural: 'malos', english: 'bad' },
        { singular: 'interesante', plural: 'interesantes', english: 'interesting' },
        { singular: 'formidable', plural: 'formidables', english: 'formidable' },
      ],
      expressions: [
        { spanish: '¡Eso es!', english: "That's it!" },
        { spanish: '¡Claro!', english: 'Of course!' },
        { spanish: '¡Cómo no!', english: 'Of course!' },
        { spanish: '¡Por supuesto!', english: 'Of course!' },
        { spanish: '¡Ya lo creo!', english: 'Now I believe it!' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter 34: I Am: Estar — Locations & Expressions
// Source: pp. 74–81 (estar, ¿Dónde está?, rooms, expressions)
// ═══════════════════════════════════════════════════════════════════════════════

const ESTAR_LOCATIONS: SerUnitContent = {
  chapterTitleKey: 'estar',
  clusters: [
    // ─── p74: Table items (statement cards) ─────────────────────────────────
    {
      type: 'estar-statements',
      introNote: 'Use estar when you want to say where someone or something is.',
      anchorItems: [
        { spanish: 'Está', english: 'is (located)' },
        { spanish: 'en', english: 'in, on, at' },
        { spanish: 'la mesa', english: 'the table' },
      ],
      cards: [
        { imageWord: 'café', imageDescription: 'a cup of coffee on a table', statement: 'El café está en la mesa.', translation: 'The coffee is on the table.' },
        { imageWord: 'crema', imageDescription: 'a small pitcher of cream', statement: 'La crema está en la mesa.', translation: 'The cream is on the table.' },
        { imageWord: 'plato', imageDescription: 'a dinner plate', statement: 'El plato está en la mesa.', translation: 'The plate is on the table.' },
        { imageWord: 'vaso', imageDescription: 'a drinking glass', statement: 'El vaso está en la mesa.', translation: 'The glass is on the table.' },
      ],
    },
    // ─── p74: Estar conjugation + sentence combinator ───────────────────────
    {
      type: 'estar-conj',
      rows: [
        { conjugated: 'Estoy', translation: 'I am' },
        { conjugated: 'Estamos', translation: 'we are' },
        { conjugated: 'Está', translation: 'you are / he is / she is / it is' },
        { conjugated: 'Están', translation: 'they are' },
      ],
      questionForm: '¿Está?',
      questionTranslation: 'Are you? Is he? Is she? Is it?',
      combinatorLeft: '¿Dónde está',
      combinatorWords: [
        { spanish: 'el café?', english: 'the coffee?' },
        { spanish: 'la crema?', english: 'the cream?' },
        { spanish: 'el plato?', english: 'the plate?' },
        { spanish: 'el vaso?', english: 'the glass?' },
      ],
    },
    // ─── p75: Professions at locations (statement cards) ────────────────────
    {
      type: 'estar-statements',
      anchorItems: [
        { spanish: 'En', english: 'in, on, at' },
      ],
      cards: [
        { imageWord: 'doctor', imageDescription: 'a doctor in a hospital', statement: 'El doctor está en el hospital.', translation: 'The doctor is in the hospital.' },
        { imageWord: 'actor', imageDescription: 'an actor performing on a stage in a theater', statement: 'El actor está en el teatro.', translation: 'The actor is in the theater.' },
        { imageWord: 'conductor', imageDescription: 'a train conductor', statement: 'El conductor está en el tren.', translation: 'The conductor is on the train.' },
        { imageWord: 'tenor', imageDescription: 'a tenor singer performing in an opera', statement: 'El tenor está en la ópera.', translation: 'The tenor is in the opera.' },
      ],
    },
    // ─── p75: -or cognate words ──────────────────────────────────────────────
    {
      type: 'word-chips',
      note: 'Most words which end in "-or" are alike in Spanish and English.',
      words: ['el actor', 'el tractor', 'el color', 'el reflector', 'vigor', 'exterior', 'favor', 'el director', 'humor', 'error'],
    },
    // ─── p76: People at places (Q&A) ────────────────────────────────────────
    {
      type: 'ser-qa',
      anchorItems: [
        { spanish: '¿Dónde está?', english: 'Where is?' },
        { spanish: 'en casa', english: 'at home' },
        { spanish: 'en el despacho', english: 'at the office' },
      ],
      cards: [
        { imageWord: 'despacho', imageDescription: 'a home office desk', question: '¿Dónde está papá?', questionTranslation: 'Where is Dad?', answer: 'Papá está en el despacho.', answerTranslation: 'Dad is at the office.' },
        { imageWord: 'casa', imageDescription: 'a house', question: '¿Dónde está mamá?', questionTranslation: 'Where is Mom?', answer: 'Mamá está en casa.', answerTranslation: 'Mom is at home.' },
        { imageWord: 'cine', imageDescription: 'a movie theater', question: '¿Dónde está Roberto?', questionTranslation: 'Where is Roberto?', answer: 'Roberto está en el cine.', answerTranslation: 'Roberto is at the movies.' },
        { imageWord: 'banco', imageDescription: 'a bank building', question: '¿Dónde está Alberto?', questionTranslation: 'Where is Alberto?', answer: 'Alberto está en el banco.', answerTranslation: 'Alberto is at the bank.' },
      ],
      noteAfter: 'Roberto está en el restaurante. — María está en el club. — Daniel está en México.',
    },
    // ─── p77: Bathroom (Q&A with room header) ────────────────────────────────
    {
      type: 'ser-qa',
      roomHeader: { spanish: 'En el baño', english: 'in the bathroom' },
      anchorItems: [
        { spanish: 'La toalla', english: 'the towel' },
      ],
      cards: [
        { imageWord: 'lavamanos', imageDescription: 'a bathroom sink', question: '¿Dónde está el lavamanos?', questionTranslation: 'Where is the sink?', answer: 'El lavamanos está en el baño.', answerTranslation: 'The sink is in the bathroom.' },
        { imageWord: 'tina', imageDescription: 'a bathtub', question: '¿Dónde está la tina?', questionTranslation: 'Where is the bathtub?', answer: 'La tina está en el baño.', answerTranslation: 'The bathtub is in the bathroom.' },
        { imageWord: 'jabón', imageDescription: 'a bar of soap', question: '¿Dónde está el jabón?', questionTranslation: 'Where is the soap?', answer: 'El jabón está en el baño.', answerTranslation: 'The soap is in the bathroom.' },
        { imageWord: 'toalla', imageDescription: 'a folded bath towel', question: '¿Dónde está la toalla?', questionTranslation: 'Where is the towel?', answer: 'La toalla está en el baño.', answerTranslation: 'The towel is in the bathroom.' },
      ],
    },
    // ─── p78: Dining room (Q&A with room header) ─────────────────────────────
    {
      type: 'ser-qa',
      roomHeader: { spanish: 'En el comedor', english: 'in the dining room' },
      anchorItems: [
        { spanish: 'La servilleta', english: 'the napkin' },
        { spanish: 'El mantel', english: 'the tablecloth' },
      ],
      cards: [
        { imageWord: 'mesa', imageDescription: 'a dining table', question: '¿Dónde está la mesa?', questionTranslation: 'Where is the table?', answer: 'La mesa está en el comedor.', answerTranslation: 'The table is in the dining room.' },
        { imageWord: 'silla', imageDescription: 'a dining chair', question: '¿Dónde está la silla?', questionTranslation: 'Where is the chair?', answer: 'La silla está en el comedor.', answerTranslation: 'The chair is in the dining room.' },
        { imageWord: 'mantel', imageDescription: 'a tablecloth on a dining table', question: '¿Dónde está el mantel?', questionTranslation: 'Where is the tablecloth?', answer: 'El mantel está en el comedor.', answerTranslation: 'The tablecloth is in the dining room.' },
        { imageWord: 'servilleta', imageDescription: 'a folded cloth napkin', question: '¿Dónde está la servilleta?', questionTranslation: 'Where is the napkin?', answer: 'La servilleta está en la mesa.', answerTranslation: 'The napkin is on the table.' },
      ],
    },
    // ─── p79: Living room (Q&A with room header) ─────────────────────────────
    {
      type: 'ser-qa',
      roomHeader: { spanish: 'En la sala', english: 'in the living room' },
      anchorItems: [
        { spanish: 'El sillón', english: 'the armchair' },
      ],
      cards: [
        { imageWord: 'sofá', imageDescription: 'a living room sofa', question: '¿Dónde está el sofá?', questionTranslation: 'Where is the sofa?', answer: 'El sofá está en la sala.', answerTranslation: 'The sofa is in the living room.' },
        { imageWord: 'sillón', imageDescription: 'an armchair', question: '¿Dónde está el sillón?', questionTranslation: 'Where is the armchair?', answer: 'El sillón está en la sala.', answerTranslation: 'The armchair is in the living room.' },
        { imageWord: 'televisión', imageDescription: 'a television set', question: '¿Dónde está la televisión?', questionTranslation: 'Where is the television?', answer: 'La televisión está en la sala.', answerTranslation: 'The television is in the living room.' },
        { imageWord: 'teléfono', imageDescription: 'a telephone', question: '¿Dónde está el teléfono?', questionTranslation: 'Where is the telephone?', answer: 'El teléfono está en la sala.', answerTranslation: 'The telephone is in the living room.' },
      ],
      noteAfter: 'Roberto está en la sala.',
    },
    // ─── p80: Kitchen (Q&A with room header) ─────────────────────────────────
    {
      type: 'ser-qa',
      roomHeader: { spanish: 'En la cocina', english: 'in the kitchen' },
      anchorItems: [
        { spanish: 'La olla', english: 'the pot' },
        { spanish: 'La cafetera', english: 'the coffee maker' },
        { spanish: 'La estufa', english: 'the stove' },
      ],
      cards: [
        { imageWord: 'estufa', imageDescription: 'a kitchen stove', question: '¿Dónde está la estufa?', questionTranslation: 'Where is the stove?', answer: 'La estufa está en la cocina.', answerTranslation: 'The stove is in the kitchen.' },
        { imageWord: 'olla', imageDescription: 'a cooking pot on a stove', question: '¿Dónde está la olla?', questionTranslation: 'Where is the pot?', answer: 'La olla está en la estufa.', answerTranslation: 'The pot is on the stove.' },
        { imageWord: 'cafetera', imageDescription: 'a coffee maker', question: '¿Dónde está la cafetera?', questionTranslation: 'Where is the coffee maker?', answer: 'La cafetera está en la cocina.', answerTranslation: 'The coffee maker is in the kitchen.' },
        { imageWord: 'refrigerador', imageDescription: 'a refrigerator', question: '¿Dónde está el refrigerador?', questionTranslation: 'Where is the refrigerator?', answer: 'El refrigerador está en la cocina.', answerTranslation: 'The refrigerator is in the kitchen.' },
      ],
      noteAfter: 'Mamá está en la cocina.',
    },
    // ─── p81: Everyday expressions with estar ────────────────────────────────
    {
      type: 'estar-expressions',
      genderPairs: [
        { masculine: { spanish: 'Está contento', english: 'he is happy' }, feminine: { spanish: 'Está contenta', english: 'she is happy' } },
        { masculine: { spanish: 'Está cansado', english: 'he is tired' }, feminine: { spanish: 'Está cansada', english: 'she is tired' } },
        { masculine: { spanish: 'Está ocupado', english: 'he is busy' }, feminine: { spanish: 'Está ocupada', english: 'she is busy' } },
        { masculine: { spanish: 'Está enfermo', english: 'he is sick' }, feminine: { spanish: 'Está enferma', english: 'she is sick' } },
        { masculine: { spanish: 'Está listo', english: 'he is ready' } },
        { masculine: { spanish: 'Está solo', english: 'he is alone' } },
        { masculine: { spanish: 'Está enojado', english: 'he is angry' } },
        { masculine: { spanish: 'Está furioso', english: 'he is furious' } },
        { masculine: { spanish: 'Está aburrido', english: 'he is bored' } },
        { masculine: { spanish: 'Está enamorado', english: 'he is in love' } },
      ],
      additionalItems: [
        { spanish: 'Está bien', english: "it's all right" },
        { spanish: 'Está mejor', english: 'he/she is better' },
        { spanish: 'Está mal', english: 'he/she is ill' },
        { spanish: 'Está peor', english: 'he/she is worse' },
        { spanish: 'Está con Huberto', english: 'he/she is with Huberto' },
        { spanish: 'Está triste', english: 'he/she is sad' },
        { spanish: 'Estamos contentos', english: 'we are happy' },
        { spanish: 'Están cansados', english: 'they are tired' },
        { spanish: 'Estoy contento', english: 'I am happy (m)' },
        { spanish: 'Estoy contenta', english: 'I am happy (f)' },
        { spanish: 'Está cómodo', english: 'he/she is comfortable' },
      ],
    },
  ],
};

const SER_UNITS: SerUnitContent[] = [
  SER_PLURALS_GENDER,
  ESTAR_LOCATIONS,
];

/**
 * Returns hardcoded ir-style Madrigal content for a chapter if available.
 */
export function getMadrigalContent(chapterTitle: string): MadrigalVerbUnitContent | null {
  const lower = chapterTitle.toLowerCase();
  return MADRIGAL_VERB_UNITS.find(u => lower.includes(u.chapterTitleKey)) ?? null;
}

/**
 * Returns hardcoded preterite-style content for a chapter if available.
 */
export function getPreteriteContent(chapterTitle: string): PreteriteUnitContent | null {
  const lower = chapterTitle.toLowerCase();
  return PRETERITE_UNITS.find(u => lower.includes(u.chapterTitleKey)) ?? null;
}

/**
 * Returns hardcoded ser-style content for a chapter if available.
 */
export function getSerContent(chapterTitle: string): SerUnitContent | null {
  const lower = chapterTitle.toLowerCase();
  return SER_UNITS.find(u => lower.includes(u.chapterTitleKey)) ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter 35: I Can Go — Puedo ir
// Source: Madrigal pp. 84–85
// ═══════════════════════════════════════════════════════════════════════════════

const PUEDO_IR: HayUnitContent = {
  chapterTitleKey: "puedo ir",
  conceptLabel: "Puedo ir",
  conceptDefinition: "I can go · Can you go?",
  introNote: "\"Puedo ir\" = I can go. \"Puede ir\" = you can go (formal). This is the polite form throughout.",

  clusters: [
    {
      // Page 84: Places
      noteInline: "Puedo ir  I can go · Puede ir  you can go · a mi casa  to my house · a su casa  to your house",
      pairs: [
        {
          imageWord: "tienda",
          question: "¿Puede ir a la tienda?",
          questionTranslation: "Can you go to the store?",
          answer: "Sí, puedo ir a la tienda.",
          answerTranslation: "Yes, I can go to the store.",
        },
        {
          imageWord: "fiesta",
          question: "¿Puede ir a la fiesta?",
          questionTranslation: "Can you go to the party?",
          answer: "Sí, puedo ir a la fiesta.",
          answerTranslation: "Yes, I can go to the party.",
        },
        {
          imageWord: "casa",
          imageDescription: "a house exterior, front door visible",
          question: "¿Puede ir a mi casa?",
          questionTranslation: "Can you come to my house?",
          answer: "Sí, puedo ir a su casa.",
          answerTranslation: "Yes, I can go to your house.",
        },
        {
          imageWord: "clase",
          imageDescription: "a classroom with desks and a chalkboard, no people",
          question: "¿Puede ir a la clase?",
          questionTranslation: "Can you go to class?",
          answer: "Sí, puedo ir a la clase.",
          answerTranslation: "Yes, I can go to class.",
        },
      ],
      noteAfter: "No puedo ir a la fiesta. — I can't go to the party.",
    },
    {
      // Page 85: Evening events
      heading: "Esta noche",
      noteInline: "esta noche  tonight · conmigo  with me · con usted  with you (formal)",
      pairs: [
        {
          imageWord: "baile",
          imageDescription: "two people elegantly dancing at a ballroom event",
          question: "¿Puede ir al baile conmigo?",
          questionTranslation: "Can you go to the dance with me?",
          answer: "Sí, puedo ir al baile con usted.",
          answerTranslation: "Yes, I can go to the dance with you.",
        },
        {
          imageWord: "concierto",
          imageDescription: "interior of a concert hall with a lit stage, no people",
          question: "¿Puede ir al concierto esta noche?",
          questionTranslation: "Can you go to the concert tonight?",
          answer: "Sí, puedo ir al concierto esta noche.",
          answerTranslation: "Yes, I can go to the concert tonight.",
        },
        {
          imageWord: "ballet",
          imageDescription: "ballet dancers on a stage, classical performance",
          question: "¿Puede ir al ballet esta noche?",
          questionTranslation: "Can you go to the ballet tonight?",
          answer: "Sí, puedo ir al ballet con usted.",
          answerTranslation: "Yes, I can go to the ballet with you.",
        },
      ],
      sentenceColumns: [
        {
          label: "Subject",
          items: [
            { text: "puedo ir",    translation: "I can go" },
            { text: "puede ir",    translation: "you can go" },
            { text: "no puedo ir", translation: "I can't go" },
            { text: "no puede ir", translation: "you can't go" },
          ],
        },
        {
          label: "Destination",
          items: [
            { text: "al baile",     translation: "to the dance" },
            { text: "al concierto", translation: "to the concert" },
            { text: "al ballet",    translation: "to the ballet" },
            { text: "a la tienda",  translation: "to the store" },
            { text: "a la fiesta",  translation: "to the party" },
            { text: "a la clase",   translation: "to class" },
            { text: "a mi casa",    translation: "to my house" },
          ],
        },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter 36: Hay — There Is / There Are
// Source: Madrigal pp. 86–91
// ═══════════════════════════════════════════════════════════════════════════════

const HAY_CHAPTER: HayUnitContent = {
  chapterTitleKey: "hay:",
  conceptLabel: "Hay",
  conceptDefinition: "there is · there are · is there? · are there?",
  introNote: "One word covers it all. \"Hay café\" can mean \"There is coffee\" or \"Is there any coffee?\" — context makes the meaning clear.",

  clusters: [
    {
      // Page 86: Basic food/drink items
      pairs: [
        {
          imageWord: "café",
          question: "¿Hay café?",
          questionTranslation: "Is there any coffee?",
          answer: "Sí, hay café.",
          answerTranslation: "Yes, there is coffee.",
        },
        {
          imageWord: "sopa",
          question: "¿Hay sopa?",
          questionTranslation: "Is there any soup?",
          answer: "Sí, hay sopa.",
          answerTranslation: "Yes, there is soup.",
        },
        {
          imageWord: "chocolate",
          imageDescription: "a steaming cup of hot chocolate",
          question: "¿Hay chocolate?",
          questionTranslation: "Is there any chocolate?",
          answer: "Sí, hay chocolate.",
          answerTranslation: "Yes, there is chocolate.",
        },
        {
          imageWord: "té",
          question: "¿Hay té?",
          questionTranslation: "Is there any tea?",
          answer: "Sí, hay té.",
          answerTranslation: "Yes, there is tea.",
        },
      ],
    },
    {
      // Page 87: At the store and bank
      heading: "En la tienda y en el banco",
      noteInline: "en la tienda  in the store · mucho dinero  a lot of money · y  and",
      pairs: [
        {
          imageWord: "dinero",
          imageDescription: "stacks of paper money and coins on a bank counter",
          question: "¿Hay mucho dinero en el banco?",
          questionTranslation: "Is there a lot of money in the bank?",
          answer: "Sí, hay mucho dinero en el banco.",
          answerTranslation: "Yes, there is a lot of money in the bank.",
        },
        {
          imageWord: "blusa",
          imageDescription: "a blouse and a skirt hanging on store clothing racks",
          question: "¿Hay blusas y faldas en la tienda?",
          questionTranslation: "Are there blouses and skirts in the store?",
          answer: "Sí, hay blusas y faldas en la tienda.",
          answerTranslation: "Yes, there are blouses and skirts in the store.",
        },
        {
          imageWord: "gasolina",
          imageDescription: "a gas station with fuel pumps, exterior view",
          question: "¿Hay gasolina en la estación de gasolina?",
          questionTranslation: "Is there gas at the gas station?",
          answer: "Sí, hay gasolina en la estación de gasolina.",
          answerTranslation: "Yes, there is gas at the gas station.",
        },
      ],
    },
    {
      // Page 88: muchos / muchas — market items
      heading: "muchos · muchas",
      noteInline: "muchos = many (masculine plural) · muchas = many (feminine plural)",
      pairs: [
        {
          imageWord: "calcetines",
          imageDescription: "a display of many colorful socks in a store",
          question: "¿Hay muchos calcetines en la tienda?",
          questionTranslation: "Are there many socks in the store?",
          answer: "Sí, hay muchos calcetines en la tienda.",
          answerTranslation: "Yes, there are many socks in the store.",
        },
        {
          imageWord: "zapatos",
          imageDescription: "rows of shoes displayed in a store",
          question: "¿Hay muchas medias en la tienda?",
          questionTranslation: "Are there many stockings in the store?",
          answer: "Sí, hay muchas medias en la tienda.",
          answerTranslation: "Yes, there are many stockings in the store.",
        },
        {
          imageWord: "naranja",
          imageDescription: "many oranges piled on a market stall",
          question: "¿Hay muchas naranjas en el mercado?",
          questionTranslation: "Are there many oranges at the market?",
          answer: "Sí, hay muchas naranjas en el mercado.",
          answerTranslation: "Yes, there are many oranges at the market.",
        },
        {
          imageWord: "plátano",
          imageDescription: "bunches of bananas on a market stand",
          question: "¿Hay muchos plátanos en el mercado?",
          questionTranslation: "Are there many bananas at the market?",
          answer: "Sí, hay muchos plátanos en el mercado.",
          answerTranslation: "Yes, there are many bananas at the market.",
        },
      ],
    },
    {
      // Page 89: No hay + humor
      heading: "No hay",
      noteInline: "No hay = there isn't / there aren't",
      pairs: [
        {
          imageWord: "gorila",
          imageDescription: "a cartoon-style gorilla sitting in an empty classroom, absurd scene",
          question: "¿Hay gorilas en la clase?",
          questionTranslation: "Are there gorillas in the class?",
          answer: "No hay gorilas en la clase.",
          answerTranslation: "There are no gorillas in the class.",
          extraNote: "Eso es absolutamente ridículo. — That is absolutely ridiculous.",
        },
        {
          imageWord: "estudiante",
          imageDescription: "students sitting at desks in a classroom",
          question: "¿Hay estudiantes en la clase?",
          questionTranslation: "Are there students in the class?",
          answer: "Sí, hay estudiantes en la clase.",
          answerTranslation: "Yes, there are students in the class.",
        },
      ],
      noteAfter: "¡Eso es absolutamente ridículo! — That is absolutely ridiculous!",
    },
    {
      // Page 90: En el hotel
      heading: "En el hotel",
      noteInline: "muchos turistas  many tourists · una piscina  a swimming pool · muy bonita  very pretty · un peluquero  a barber",
      pairs: [
        {
          imageWord: "turistas",
          imageDescription: "a group of tourists with luggage in a hotel lobby",
          question: "¿Hay turistas en el hotel?",
          questionTranslation: "Are there tourists at the hotel?",
          answer: "Sí, hay muchos turistas en el hotel.",
          answerTranslation: "Yes, there are many tourists at the hotel.",
          extraNote: "Hay turistas americanos, italianos, mexicanos, etc.",
        },
        {
          imageWord: "piscina",
          imageDescription: "a beautiful outdoor swimming pool at a hotel resort",
          question: "¿Hay una piscina en el hotel?",
          questionTranslation: "Is there a swimming pool at the hotel?",
          answer: "Sí, hay una piscina en el hotel. Es muy bonita.",
          answerTranslation: "Yes, there is a swimming pool at the hotel. It's very pretty.",
        },
        {
          imageWord: "peluquero",
          imageDescription: "a barber chair and barber tools in a professional barbershop",
          question: "¿Hay un peluquero en el hotel?",
          questionTranslation: "Is there a barber at the hotel?",
          answer: "Sí, hay un peluquero excelente en el hotel.",
          answerTranslation: "Yes, there is an excellent barber at the hotel.",
        },
      ],
      noteAfter: "¿Qué hay? — What is there? / What's up?",
    },
    {
      // Page 91: Las tiendas — store vocabulary
      heading: "Las tiendas",
      noteInline: "la zapatería  shoe store · la panadería  bakery · la carnicería  butcher shop · la joyería  jewelry shop",
      pairs: [
        {
          imageWord: "zapatos",
          imageDescription: "shoes displayed in a shoe store",
          question: "¿Hay zapatos en la zapatería?",
          questionTranslation: "Are there shoes in the shoe store?",
          answer: "Sí, hay zapatos en la zapatería.",
          answerTranslation: "Yes, there are shoes in the shoe store.",
        },
        {
          imageWord: "pan",
          imageDescription: "loaves of fresh bread in a bakery display",
          question: "¿Hay pan en la panadería?",
          questionTranslation: "Is there bread in the bakery?",
          answer: "Sí, hay pan en la panadería.",
          answerTranslation: "Yes, there is bread in the bakery.",
        },
        {
          imageWord: "carne",
          imageDescription: "cuts of fresh meat in a butcher shop display case",
          question: "¿Hay carne en la carnicería?",
          questionTranslation: "Is there meat in the butcher shop?",
          answer: "Sí, hay carne en la carnicería.",
          answerTranslation: "Yes, there is meat in the butcher shop.",
        },
        {
          imageWord: "joyas",
          imageDescription: "rings, necklaces and bracelets in a jewelry store display case",
          question: "¿Hay joyas en la joyería?",
          questionTranslation: "Is there jewelry in the jewelry store?",
          answer: "Sí, hay joyas en la joyería.",
          answerTranslation: "Yes, there is jewelry in the jewelry store.",
        },
      ],
      sentenceColumns: [
        {
          label: "Quantity",
          items: [
            { text: "¿Hay muchos",  translation: "Are there many (m)" },
            { text: "¿Hay muchas",  translation: "Are there many (f)" },
            { text: "Sí, hay muchos",  translation: "Yes, there are many (m)" },
            { text: "Sí, hay muchas",  translation: "Yes, there are many (f)" },
          ],
        },
        {
          label: "Item",
          items: [
            { text: "zapatos",    translation: "shoes" },
            { text: "joyas",      translation: "jewelry" },
            { text: "calcetines", translation: "socks" },
            { text: "naranjas",   translation: "oranges" },
            { text: "plátanos",   translation: "bananas" },
            { text: "blusas",     translation: "blouses" },
          ],
        },
        {
          label: "Location",
          items: [
            { text: "en la zapatería?", translation: "in the shoe store?" },
            { text: "en la joyería?",   translation: "in the jewelry store?" },
            { text: "en la tienda?",    translation: "in the store?" },
            { text: "en el mercado?",   translation: "at the market?" },
          ],
        },
      ],
      noteAfter: "muchos (many) — use with masculine nouns · muchas (many) — use with feminine nouns",
    },
  ],
};

const HAY_UNITS: HayUnitContent[] = [
  PUEDO_IR,
  HAY_CHAPTER,
];

/**
 * Returns hardcoded Hay-style content for a chapter if available.
 * Covers "Puedo ir" and "Hay" chapters.
 */
export function getHayContent(chapterTitle: string): HayUnitContent | null {
  const lower = chapterTitle.toLowerCase();
  return HAY_UNITS.find(u => lower.includes(u.chapterTitleKey)) ?? null;
}

// ── Unit type 5: Gust-style (gustar / gustaría / encanta / encantaría) ─────────
// Used for the "gustar" family chapters (Madrigal pp. 94–101).

/** One vocabulary cluster in a gustar-style lesson.
 *  Extends HayVocabCluster with an optional grammar-rule callout and negative examples. */
export interface GustVocabCluster extends HayVocabCluster {
  /** Rule callout displayed after the cards, e.g. singular vs plural contrast */
  grammarRule?: string;
  /** List of negative sentences shown at the end of the cluster */
  negativeExamples?: string[];
  /** Full verb conjugation table shown at the bottom of the cluster */
  conjugationTable?: { conjugated: string; translation: string }[];
}

export interface GustUnitContent {
  /** Substring matched against chapter title (case-insensitive) */
  chapterTitleKey: string;
  /** Large headline word or phrase, e.g. "Me gusta" */
  conceptLabel: string;
  /** Meaning shown below the headline */
  conceptDefinition: string;
  /** Pedagogical note displayed after the concept header */
  introNote?: string;
  clusters: GustVocabCluster[];
}

// ── Chapter 37: Gustar — Me gusta / Me gustan (pp. 94–97) ─────────────────────

const GUSTAR_CHAPTER: GustUnitContent = {
  chapterTitleKey: "gustar:",
  conceptLabel: "Me gusta",
  conceptDefinition: "I like · it pleases me",
  introNote: "Notice that in Spanish you don't say 'I like soup.' You must say 'I like the soup.' It is necessary to add 'the' before a noun.",
  clusters: [
    // ── Cluster 1: Me gusta (singular foods) ──────────────────────
    {
      heading: "Me gusta",
      noteInline: "Me gusta  I like · ¿Le gusta?  Do you like?",
      pairs: [
        {
          imageWord: "sopa",
          imageDescription: "a steaming bowl of soup on a white background",
          question: "¿Le gusta la sopa?",
          questionTranslation: "Do you like the soup?",
          answer: "Sí, me gusta mucho la sopa.",
          answerTranslation: "Yes, I like the soup a lot.",
        },
        {
          imageWord: "limonada",
          imageDescription: "a glass of lemonade with ice and lemon on a white background",
          question: "¿Le gusta la limonada?",
          questionTranslation: "Do you like the lemonade?",
          answer: "Sí, me gusta mucho la limonada.",
          answerTranslation: "Yes, I like the lemonade a lot.",
        },
        {
          imageWord: "queso",
          imageDescription: "a wedge of yellow cheese on a white background",
          question: "¿Le gusta el queso?",
          questionTranslation: "Do you like the cheese?",
          answer: "Sí, me gusta mucho el queso.",
          answerTranslation: "Yes, I like the cheese a lot.",
        },
        {
          imageWord: "leche",
          imageDescription: "a glass of milk on a white background",
          question: "¿Le gusta la leche?",
          questionTranslation: "Do you like the milk?",
          answer: "Sí, me gusta mucho la leche.",
          answerTranslation: "Yes, I like the milk a lot.",
        },
      ],
      sentenceColumns: [
        {
          label: "Question",
          items: [
            { text: "¿Le gusta", translation: "Do you like" },
          ],
        },
        {
          label: "Item",
          items: [
            { text: "el campo?",   translation: "the countryside?" },
            { text: "la música?",  translation: "music?" },
            { text: "México?",     translation: "Mexico?" },
            { text: "Acapulco?",   translation: "Acapulco?" },
            { text: "el arroz?",   translation: "rice?" },
            { text: "el pollo?",   translation: "chicken?" },
            { text: "el pescado?", translation: "fish?" },
          ],
        },
      ],
    },
    // ── Cluster 2: Me gustan (plural foods) ───────────────────────
    {
      heading: "Me gustan",
      noteInline: "Me gustan  I like (plural) · ¿Le gustan?  Do you like (plural)?",
      pairs: [
        {
          imageWord: "espárragos",
          imageDescription: "a bundle of fresh green asparagus on a white background",
          question: "¿Le gustan los espárragos?",
          questionTranslation: "Do you like the asparagus?",
          answer: "Sí, me gustan los espárragos.",
          answerTranslation: "Yes, I like the asparagus.",
        },
        {
          imageWord: "huevos",
          imageDescription: "three white eggs on a white background",
          question: "¿Le gustan los huevos?",
          questionTranslation: "Do you like the eggs?",
          answer: "Sí, me gustan los huevos.",
          answerTranslation: "Yes, I like the eggs.",
        },
        {
          imageWord: "frijoles",
          imageDescription: "a pile of black beans on a white background",
          question: "¿Le gustan los frijoles?",
          questionTranslation: "Do you like the beans?",
          answer: "Sí, me gustan los frijoles.",
          answerTranslation: "Yes, I like the beans.",
        },
        {
          imageWord: "espinacas",
          imageDescription: "a handful of fresh spinach leaves on a white background",
          question: "¿Le gustan las espinacas?",
          questionTranslation: "Do you like the spinach?",
          answer: "Sí, me gustan las espinacas.",
          answerTranslation: "Yes, I like the spinach.",
        },
      ],
      grammarRule: "Use me gusta when what you like is singular · Use me gustan when what you like is plural · Me gusta la rosa / Me gustan las rosas",
    },
    // ── Cluster 3: Gustar + infinitive ────────────────────────────
    {
      heading: "Gustar + infinitive",
      noteInline: "Me gusta  I like · ¿Le gusta?  Do you like?",
      pairs: [
        {
          imageWord: "nadar",
          imageDescription: "a person swimming in a bright blue pool",
          question: "¿Le gusta nadar?",
          questionTranslation: "Do you like to swim?",
          answer: "Sí, me gusta nadar.",
          answerTranslation: "Yes, I like to swim.",
        },
        {
          imageWord: "pescar",
          imageDescription: "a person fishing with a rod at a lake",
          question: "¿Le gusta pescar?",
          questionTranslation: "Do you like to fish?",
          answer: "Sí, me gusta pescar.",
          answerTranslation: "Yes, I like to fish.",
        },
        {
          imageWord: "bailar",
          imageDescription: "a person dancing with arms raised",
          question: "¿Le gusta bailar?",
          questionTranslation: "Do you like to dance?",
          answer: "Sí, me gusta bailar.",
          answerTranslation: "Yes, I like to dance.",
        },
        {
          imageWord: "estudiar",
          imageDescription: "a person studying at a desk with an open book",
          question: "¿Le gusta estudiar?",
          questionTranslation: "Do you like to study?",
          answer: "Sí, me gusta estudiar.",
          answerTranslation: "Yes, I like to study.",
        },
      ],
      negativeExamples: [
        "No me gusta pescar.",
        "No me gusta nadar.",
        "No me gusta bailar.",
      ],
    },
  ],
};

// ── Chapter 38: Me gustaría — I Would Like (pp. 98–101) ──────────────────────

const GUSTARIA_CHAPTER: GustUnitContent = {
  chapterTitleKey: "me gustaría:",
  conceptLabel: "Me gustaría",
  conceptDefinition: "I would like · I would love",
  clusters: [
    // ── Cluster 1: Me gustaría ir ──────────────────────────────────
    {
      heading: "Me gustaría ir",
      noteInline: "Me gustaría ir  I would like to go · ¿Le gustaría ir?  Would you like to go?",
      pairs: [
        {
          imageWord: "parque",
          imageDescription: "a sunny park with green trees and a bench",
          question: "¿Le gustaría ir al parque?",
          questionTranslation: "Would you like to go to the park?",
          answer: "Sí, me gustaría ir al parque.",
          answerTranslation: "Yes, I would like to go to the park.",
        },
        {
          imageWord: "teatro",
          imageDescription: "the interior of an elegant theater with red curtains",
          question: "¿Le gustaría ir al teatro?",
          questionTranslation: "Would you like to go to the theater?",
          answer: "Sí, me gustaría ir al teatro.",
          answerTranslation: "Yes, I would like to go to the theater.",
        },
        {
          imageWord: "cine",
          imageDescription: "the exterior of a movie theater at night with bright marquee lights",
          question: "¿Le gustaría ir al cine?",
          questionTranslation: "Would you like to go to the movies?",
          answer: "Sí, me gustaría ir al cine.",
          answerTranslation: "Yes, I would like to go to the movies.",
        },
        {
          imageWord: "campo",
          imageDescription: "a scenic countryside landscape with rolling green hills",
          question: "¿Le gustaría ir al campo?",
          questionTranslation: "Would you like to go to the countryside?",
          answer: "Sí, me gustaría ir al campo.",
          answerTranslation: "Yes, I would like to go to the countryside.",
        },
      ],
      sentenceColumns: [
        {
          label: "Phrase",
          items: [
            { text: "¿Le gustaría ir",   translation: "Would you like to go" },
            { text: "Me gustaría ir",    translation: "I would like to go" },
            { text: "Me gustaría nadar.", translation: "I would like to swim." },
            { text: "Me gustaría estudiar español.", translation: "I would like to study Spanish." },
          ],
        },
        {
          label: "Location",
          items: [
            { text: "al parque?",  translation: "to the park?" },
            { text: "al cine?",    translation: "to the movies?" },
            { text: "al teatro?",  translation: "to the theater?" },
            { text: "al campo?",   translation: "to the countryside?" },
          ],
        },
      ],
    },
    // ── Cluster 2: Me encanta (singular) ──────────────────────────
    {
      heading: "Me encanta",
      noteInline: "Me encanta  I love · it enchants me",
      pairs: [
        {
          imageWord: "salmón",
          imageDescription: "a cooked salmon fillet on a white plate",
          question: "¿Le encanta el salmón?",
          questionTranslation: "Do you love the salmon?",
          answer: "Sí, me encanta el salmón.",
          answerTranslation: "Yes, I love the salmon.",
        },
        {
          imageWord: "pavo",
          imageDescription: "a roasted turkey on a white plate",
          question: "¿Le encanta el pavo?",
          questionTranslation: "Do you love the turkey?",
          answer: "Sí, me encanta el pavo.",
          answerTranslation: "Yes, I love the turkey.",
        },
      ],
      sentenceColumns: [
        {
          label: "Phrase",
          items: [
            { text: "Me encanta", translation: "I love" },
          ],
        },
        {
          label: "Item",
          items: [
            { text: "el queso.",      translation: "the cheese." },
            { text: "el tocino.",     translation: "the bacon." },
            { text: "el café.",       translation: "the coffee." },
            { text: "el chocolate.", translation: "the chocolate." },
            { text: "el salmón.",     translation: "the salmon." },
            { text: "el pavo.",       translation: "the turkey." },
            { text: "México.",        translation: "Mexico." },
            { text: "Costa Rica.",    translation: "Costa Rica." },
            { text: "Caracas.",       translation: "Caracas." },
          ],
        },
      ],
      noteAfter: "In Spanish, you must add 'the' before whatever food you love. You say 'I love the cheese' — never 'I love cheese.'",
    },
    // ── Cluster 3: Me encantan (plural) ───────────────────────────
    {
      heading: "Me encantan",
      noteInline: "Me encantan  I love (plural)",
      pairs: [
        {
          imageWord: "fresas",
          imageDescription: "a handful of fresh red strawberries on a white background",
          question: "¿Le encantan las fresas?",
          questionTranslation: "Do you love the strawberries?",
          answer: "Sí, me encantan las fresas.",
          answerTranslation: "Yes, I love the strawberries.",
        },
        {
          imageWord: "cerezas",
          imageDescription: "a cluster of ripe dark red cherries on a white background",
          question: "¿Le encantan las cerezas?",
          questionTranslation: "Do you love the cherries?",
          answer: "Sí, me encantan las cerezas.",
          answerTranslation: "Yes, I love the cherries.",
        },
        {
          imageWord: "cebollas",
          imageDescription: "two white onions on a white background",
          question: "¿Le encantan las cebollas?",
          questionTranslation: "Do you love the onions?",
          answer: "Sí, me encantan las cebollas.",
          answerTranslation: "Yes, I love the onions.",
        },
        {
          imageWord: "aceitunas",
          imageDescription: "a small bowl of green olives on a white background",
          question: "¿Le encantan las aceitunas?",
          questionTranslation: "Do you love the olives?",
          answer: "Sí, me encantan las aceitunas.",
          answerTranslation: "Yes, I love the olives.",
        },
      ],
      grammarRule: "Use me encanta for singular items · Use me encantan for plural items · Me encanta el chocolate / Me encantan las cebollas",
    },
    // ── Cluster 4: Me encantaría ir ───────────────────────────────
    {
      heading: "Me encantaría ir",
      noteInline: "Me encantaría ir  I would love to go",
      pairs: [
        {
          imageWord: "museo",
          imageDescription: "the exterior of a grand museum building",
          question: "¿Le encantaría ir al museo?",
          questionTranslation: "Would you love to go to the museum?",
          answer: "Sí, me encantaría ir al museo.",
          answerTranslation: "Yes, I would love to go to the museum.",
        },
        {
          imageWord: "playa",
          imageDescription: "a beautiful sandy beach with gentle waves",
          question: "¿Le encantaría ir a la playa?",
          questionTranslation: "Would you love to go to the beach?",
          answer: "Sí, me encantaría ir a la playa.",
          answerTranslation: "Yes, I would love to go to the beach.",
        },
      ],
      sentenceColumns: [
        {
          label: "Phrase",
          items: [
            { text: "Me encantaría ir", translation: "I would love to go" },
          ],
        },
        {
          label: "Destination",
          items: [
            { text: "al museo.",       translation: "to the museum." },
            { text: "al centro.",      translation: "downtown." },
            { text: "al club.",        translation: "to the club." },
            { text: "a Venezuela.",    translation: "to Venezuela." },
            { text: "a Buenos Aires.", translation: "to Buenos Aires." },
            { text: "al ballet.",      translation: "to the ballet." },
            { text: "al teatro.",      translation: "to the theater." },
            { text: "a nadar.",        translation: "swimming." },
            { text: "a la playa.",     translation: "to the beach." },
            { text: "al cine.",        translation: "to the movies." },
            { text: "al campo.",       translation: "to the countryside." },
          ],
        },
      ],
      noteAfter: "¿Le gustaría ir al cine?  Would you like to go to the movies? · Sí, me encantaría ir al cine.  Yes, I would love to go to the movies.",
    },
  ],
};

// ── Chapter 39: Fui — Where I Went (pp. 106–109) ─────────────────────────────

const FUI_CHAPTER: GustUnitContent = {
  chapterTitleKey: "fui:",
  conceptLabel: "Fui",
  conceptDefinition: "I went",
  clusters: [
    // ── Cluster 1: Fui + destinations (page 106) ──────────────────
    {
      heading: "Fui",
      noteInline: "Fui  I went",
      pairs: [
        {
          imageWord: "iglesia",
          imageDescription: "a white stone church with a bell tower on a sunny day",
          question: "¿Fue a la iglesia el domingo?",
          questionTranslation: "Did you go to church on Sunday?",
          answer: "Sí, fui a la iglesia el domingo.",
          answerTranslation: "Yes, I went to church on Sunday.",
        },
        {
          imageWord: "museo",
          imageDescription: "the grand exterior of a classical museum building",
          question: "¿Fue al museo el sábado?",
          questionTranslation: "Did you go to the museum on Saturday?",
          answer: "Sí, fui al museo el sábado.",
          answerTranslation: "Yes, I went to the museum on Saturday.",
        },
        {
          imageWord: "concierto",
          imageDescription: "a concert stage with bright spotlights and a crowd",
          question: "¿Fue al concierto el domingo?",
          questionTranslation: "Did you go to the concert on Sunday?",
          answer: "Sí, fui al concierto el domingo.",
          answerTranslation: "Yes, I went to the concert on Sunday.",
        },
        {
          imageWord: "tienda",
          imageDescription: "the entrance of a small shop with a display window",
          question: "¿Fue a la tienda?",
          questionTranslation: "Did you go to the store?",
          answer: "Sí, fui a la tienda.",
          answerTranslation: "Yes, I went to the store.",
        },
      ],
      sentenceColumns: [
        {
          label: "Verb",
          items: [
            { text: "Fui", translation: "I went" },
          ],
        },
        {
          label: "Destination",
          items: [
            { text: "al club.",         translation: "to the club." },
            { text: "al hotel.",        translation: "to the hotel." },
            { text: "al restaurante.",  translation: "to the restaurant." },
            { text: "al cine.",         translation: "to the movies." },
            { text: "al banco.",        translation: "to the bank." },
            { text: "a la iglesia.",    translation: "to church." },
            { text: "al museo.",        translation: "to the museum." },
            { text: "al concierto.",    translation: "to the concert." },
            { text: "a la tienda.",     translation: "to the store." },
            { text: "al teatro.",       translation: "to the theater." },
          ],
        },
      ],
    },
    // ── Cluster 2: ¿Fue? / Fui Q&A + third person (page 107) ─────
    {
      heading: "¿Fue? / Fui",
      noteInline: "¿Fue?  Did you go? · Fue  You/he/she went · Fui  I went",
      pairs: [
        {
          imageWord: "cine",
          imageDescription: "the exterior of a movie theater with a bright marquee at night",
          question: "¿Fue al cine?",
          questionTranslation: "Did you go to the movies?",
          answer: "Sí, fui al cine.",
          answerTranslation: "Yes, I went to the movies.",
        },
        {
          imageWord: "banco",
          imageDescription: "the exterior of a bank building with glass doors",
          question: "¿Fue al banco?",
          questionTranslation: "Did you go to the bank?",
          answer: "Sí, fui al banco.",
          answerTranslation: "Yes, I went to the bank.",
        },
        {
          imageWord: "fiesta",
          imageDescription: "a festive party scene with colorful decorations and balloons",
          question: "¿Fue a la fiesta?",
          questionTranslation: "Did you go to the party?",
          answer: "Sí, fui a la fiesta.",
          answerTranslation: "Yes, I went to the party.",
        },
        {
          imageWord: "restaurante",
          imageDescription: "a cozy restaurant interior with tables and candles",
          question: "¿Fue al restaurante?",
          questionTranslation: "Did you go to the restaurant?",
          answer: "Sí, fui al restaurante.",
          answerTranslation: "Yes, I went to the restaurant.",
        },
      ],
      sentenceColumns: [
        {
          label: "Subject",
          items: [
            { text: "María",        translation: "María" },
            { text: "Roberto",      translation: "Roberto" },
            { text: "El doctor",    translation: "The doctor" },
            { text: "El estudiante", translation: "The student" },
          ],
        },
        {
          label: "Action",
          items: [
            { text: "fue al cine.",    translation: "went to the movies." },
            { text: "fue a la fiesta.", translation: "went to the party." },
            { text: "fue al banco.",   translation: "went to the bank." },
            { text: "fue al teatro.",  translation: "went to the theater." },
          ],
        },
      ],
    },
    // ── Cluster 3: Modifiers — esta mañana / en taxi / en avión (pp. 108–109) ──
    {
      heading: "Modifiers",
      noteInline: "No fui  I didn't go · esta mañana  this morning · en taxi  by taxi · en avión  by plane",
      pairs: [
        {
          imageWord: "despacho",
          imageDescription: "the interior of a professional office with a desk and computer",
          question: "¿Fue al despacho esta mañana?",
          questionTranslation: "Did you go to the office this morning?",
          answer: "Sí, fui al despacho esta mañana.",
          answerTranslation: "Yes, I went to the office this morning.",
        },
        {
          imageWord: "taxi",
          imageDescription: "a yellow taxi cab on a city street",
          question: "¿Fue al despacho en taxi?",
          questionTranslation: "Did you go to the office by taxi?",
          answer: "Sí, fui al despacho en taxi.",
          answerTranslation: "Yes, I went to the office by taxi.",
        },
        {
          imageWord: "avión",
          imageDescription: "a commercial airplane in flight against a clear blue sky",
          question: "¿Fue al circo con Roberto?",
          questionTranslation: "Did you go to the circus with Roberto?",
          answer: "Sí, fui al circo con Roberto.",
          answerTranslation: "Yes, I went to the circus with Roberto.",
        },
        {
          imageWord: "circo",
          imageDescription: "a colorful circus tent with pennant flags",
          question: "¿Fue al circo en taxi?",
          questionTranslation: "Did you go to the circus by taxi?",
          answer: "Sí, fui al circo en taxi.",
          answerTranslation: "Yes, I went to the circus by taxi.",
        },
      ],
      negativeExamples: [
        "No fui al despacho en avión. ¡Eso es ridículo!",
        "No fui al circo en avión.",
        "No fui al circo esta mañana.",
      ],
    },
    // ── Cluster 4: Full conjugation table (page 109) ───────────────
    {
      heading: "Ir — Preterite",
      noteInline: "Fui  I went · Fue  You/he/she went · Fuimos  We went · Fueron  They went",
      pairs: [],
      conjugationTable: [
        { conjugated: "Fui",    translation: "I went" },
        { conjugated: "Fue",    translation: "You/he/she/it went" },
        { conjugated: "Fuimos", translation: "We went" },
        { conjugated: "Fueron", translation: "They went" },
      ],
    },
  ],
};

const GUST_UNITS: GustUnitContent[] = [
  GUSTAR_CHAPTER,
  GUSTARIA_CHAPTER,
  FUI_CHAPTER,
];

/**
 * Returns hardcoded Gust-style content for a chapter if available.
 * Covers "Gustar: Me gusta / Me gustan" and "Me gustaría: I Would Like" chapters.
 */
export function getGustContent(chapterTitle: string): GustUnitContent | null {
  const lower = chapterTitle.toLowerCase();
  return GUST_UNITS.find(u => lower.includes(u.chapterTitleKey)) ?? null;
}
