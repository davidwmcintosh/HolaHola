/**
 * book-unit-content (internal)
 * Hardcoded pedagogical content — transcribed and curated for the curriculum.
 *
 * Content law: Never generate this from AI. Every element was pedagogically chosen
 * for a specific pedagogical reason. The chain must be preserved exactly.
 */

import type { NegativeFormItem } from "@/components/NegativeFormSection";
import type { SentenceColumn } from "@/components/SentenceColumnGenerator";

// ── Shared types ──────────────────────────────────────────────────────────────

export interface BookAnchorItem {
  spanish: string;
  english: string;
}

export interface BookPositiveItem {
  word: string;        // used as the image lookup key
  sentence: string;    // displayed sentence (may differ from word, e.g. "discoteca" → "Vamos al club.")
  translation: string;
  imageDescription: string;
  /** The physical page number in the textbook's "See It and Say It in Spanish."
   *  Items sharing the same bookPage appear together on that page (typically 4 per page).
   *  Used by the two-page book spread to mirror the actual facing-pages layout. */
  bookPage?: number;
}

/** A Q&A pair shown together under an image (page 12 format). */
export interface Page12QAItem {
  imageWord?: string;          // optional — last two items on page 12 have no image
  question: string;
  affirmativeAnswer: string;
  affirmativeTranslation: string;
}

// ── Unit type 1: ir-style (present tense, place vocabulary) ───────────────────

export interface BookVerbUnitContent {
  chapterTitleKey: string;

  voyAnchor: BookAnchorItem[];
  positiveItems: BookPositiveItem[];

  vaAnchor: BookAnchorItem[];
  vaColumns: SentenceColumn[];
  subjectPronounNote?: string;

  noVoyAnchor: BookAnchorItem[];
  negativeItems: NegativeFormItem[];

  sentenceColumns: SentenceColumn[];

  vamosAnchor: BookAnchorItem[];
  vamosItems: BookPositiveItem[];
  vamosNote?: string;

  page12Anchors: BookAnchorItem[];
  page12Items: Page12QAItem[];
  vaDefinition?: string;
}

// ── Unit type 2: preterite style (past tense, multi-cluster) ──────────────────
// Used for tomar, comprar, and similar verb units from p. 29+
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

export interface PreteriteConjugationTable {
  verb: string;
  verbTranslation: string;
  rows: Array<{ pronoun: string; form: string; translation: string }>;
}

/** One vocabulary cluster within a preterite lesson */
export interface PreteriteCluster {
  anchorItems: BookAnchorItem[];
  /** Pedagogical note shown BEFORE the image cards */
  noteBefore?: string;
  /** Q&A image cards — the main content of most clusters */
  qaCards?: PreteriteQACard[];
  /** Statement-only image cards — used for "Tomé pollo para la cena." style */
  statementCards?: BookPositiveItem[];
  /** Full verb conjugation table — shown after qaCards */
  conjugationTable?: PreteriteConjugationRow[] | PreteriteConjugationTable;
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
// Used for the gender & plurals chapter (p. 64–71)

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
      anchorItems?: BookAnchorItem[];
      pairs: DualFormPair[];
    }
  | {
      type: 'ser-qa';
      roomHeader?: { spanish: string; english: string }; // e.g. "En el baño"
      anchorItems?: BookAnchorItem[];
      cards: PreteriteQACard[];
      noteAfter?: string;
    }
  | {
      /** Statement image cards: "El café está en la mesa." (no Q&A) */
      type: 'estar-statements';
      introNote?: string;          // shown above anchor block on first page
      anchorItems?: BookAnchorItem[];
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
      anchorItems?: BookAnchorItem[];
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
// Source: p. 9–13
// ═══════════════════════════════════════════════════════════════════════════════

const IR_GOING_PLACES: BookVerbUnitContent = {
  chapterTitleKey: "where are you going",

  voyAnchor: [
    { spanish: "Voy,", english: "I'm going." },
    { spanish: "al,",  english: "to the." },
  ],

  positiveItems: [
    { word: "hotel",       sentence: "Voy al hotel.",       translation: "I'm going to the hotel.",      imageDescription: "a classic hotel building exterior",         bookPage: 9 },
    { word: "banco",       sentence: "Voy al banco.",       translation: "I'm going to the bank.",       imageDescription: "a bank building with columns",              bookPage: 9 },
    { word: "garaje",      sentence: "Voy al garaje.",      translation: "I'm going to the garage.",     imageDescription: "a car garage with open door",               bookPage: 9 },
    { word: "restaurante", sentence: "Voy al restaurante.", translation: "I'm going to the restaurant.", imageDescription: "a restaurant exterior with outdoor seating", bookPage: 9 },
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
// Source: p. 29–31
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
// Source: p. 32+
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
// Source: p. 36–42
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
// Source: p. 46–53
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

      // Note: "Tiene" covers four English translations —
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
// Source: p. 56–61
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

const MADRIGAL_VERB_UNITS: BookVerbUnitContent[] = [
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
// Source: p. 64–71
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
 * Returns hardcoded ir-style book content for a chapter if available.
 */
export function getBookVerbContent(chapterTitle: string): BookVerbUnitContent | null {
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
// Source: p. 84–85
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
// Source: p. 86–91
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

// ═══════════════════════════════════════════════════════════════════════════════
// French present-tense verb units — Madrigal method applied to French
// Same 4-step sequence: anchor → model sentences → combinator → Q&A pivot
// Content law applies: every element is pedagogically intentional.
// ═══════════════════════════════════════════════════════════════════════════════

const FRENCH_VOULOIR: HayUnitContent = {
  chapterTitleKey: "je veux",
  conceptLabel: "Je veux",
  conceptDefinition: "I want · do you want? · voulez-vous?",
  introNote: "\"Je veux\" works the same way every time — drop it in front of any noun or infinitive and you have a complete thought.",
  clusters: [
    {
      heading: "Je veux — Model Sentences",
      pairs: [
        { imageWord: "café", imageDescription: "a steaming cup of French café coffee", question: "Voulez-vous du café?", questionTranslation: "Do you want some coffee?", answer: "Oui, je veux du café.", answerTranslation: "Yes, I want some coffee." },
        { imageWord: "eau", imageDescription: "a glass of clear water on a table", question: "Voulez-vous de l'eau?", questionTranslation: "Do you want some water?", answer: "Oui, je veux de l'eau.", answerTranslation: "Yes, I want some water." },
        { imageWord: "pain", imageDescription: "a fresh French baguette on a wooden board", question: "Voulez-vous du pain?", questionTranslation: "Do you want some bread?", answer: "Oui, je veux du pain.", answerTranslation: "Yes, I want some bread." },
        { imageWord: "pomme", imageDescription: "a red apple on a white surface", question: "Voulez-vous une pomme?", questionTranslation: "Do you want an apple?", answer: "Oui, je veux une pomme.", answerTranslation: "Yes, I want an apple." },
      ],
    },
    {
      heading: "Je veux + infinitif",
      noteInline: "je veux + infinitive = I want to …",
      pairs: [
        { imageWord: "manger", imageDescription: "a person sitting down to eat a meal", question: "Voulez-vous manger?", questionTranslation: "Do you want to eat?", answer: "Oui, je veux manger.", answerTranslation: "Yes, I want to eat." },
        { imageWord: "dormir", imageDescription: "a person yawning and looking tired", question: "Voulez-vous dormir?", questionTranslation: "Do you want to sleep?", answer: "Oui, je veux dormir.", answerTranslation: "Yes, I want to sleep." },
        { imageWord: "sortir", imageDescription: "a person walking out the front door of a house", question: "Voulez-vous sortir?", questionTranslation: "Do you want to go out?", answer: "Oui, je veux sortir.", answerTranslation: "Yes, I want to go out." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "Je veux", translation: "I want" }, { text: "Il veut", translation: "He wants" }, { text: "Elle veut", translation: "She wants" }] },
        { label: "Objet / Infinitif", items: [{ text: "du café.", translation: "some coffee." }, { text: "de l'eau.", translation: "some water." }, { text: "manger.", translation: "to eat." }, { text: "sortir.", translation: "to go out." }] },
      ],
    },
  ],
};

const FRENCH_AVOIR: HayUnitContent = {
  chapterTitleKey: "j'ai",
  conceptLabel: "J'ai",
  conceptDefinition: "I have · do you have? · avez-vous?",
  introNote: "\"J'ai\" is one of the most useful verbs in French — possession, age, and many expressions all run through avoir.",
  clusters: [
    {
      heading: "J'ai — Model Sentences",
      pairs: [
        { imageWord: "livre", imageDescription: "an open book on a desk", question: "Avez-vous un livre?", questionTranslation: "Do you have a book?", answer: "Oui, j'ai un livre.", answerTranslation: "Yes, I have a book." },
        { imageWord: "voiture", imageDescription: "a car parked on a street", question: "Avez-vous une voiture?", questionTranslation: "Do you have a car?", answer: "Oui, j'ai une voiture.", answerTranslation: "Yes, I have a car." },
        { imageWord: "chat", imageDescription: "a cat sitting on a windowsill", question: "Avez-vous un chat?", questionTranslation: "Do you have a cat?", answer: "Oui, j'ai un chat.", answerTranslation: "Yes, I have a cat." },
        { imageWord: "argent", imageDescription: "euro banknotes and coins on a table", question: "Avez-vous de l'argent?", questionTranslation: "Do you have any money?", answer: "Oui, j'ai de l'argent.", answerTranslation: "Yes, I have some money." },
      ],
    },
    {
      heading: "J'ai faim · J'ai soif · J'ai …",
      noteInline: "French uses avoir (to have) where English uses to be: j'ai faim = I am hungry · j'ai soif = I am thirsty",
      pairs: [
        { imageWord: "faim", imageDescription: "a person holding their stomach looking hungry", question: "Avez-vous faim?", questionTranslation: "Are you hungry?", answer: "Oui, j'ai faim.", answerTranslation: "Yes, I am hungry." },
        { imageWord: "soif", imageDescription: "a person looking thirsty reaching for a glass of water", question: "Avez-vous soif?", questionTranslation: "Are you thirsty?", answer: "Oui, j'ai soif.", answerTranslation: "Yes, I am thirsty." },
        { imageWord: "chance", imageDescription: "a four-leaf clover, symbol of luck", question: "Avez-vous de la chance?", questionTranslation: "Are you lucky?", answer: "Oui, j'ai de la chance.", answerTranslation: "Yes, I am lucky." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "J'ai", translation: "I have" }, { text: "Il a", translation: "He has" }, { text: "Elle a", translation: "She has" }] },
        { label: "Objet", items: [{ text: "un livre.", translation: "a book." }, { text: "une voiture.", translation: "a car." }, { text: "faim.", translation: "hunger (I'm hungry)." }, { text: "soif.", translation: "thirst (I'm thirsty)." }] },
      ],
    },
  ],
};

const FRENCH_ALLER: HayUnitContent = {
  chapterTitleKey: "je vais",
  conceptLabel: "Je vais",
  conceptDefinition: "I am going · where are you going? · où allez-vous?",
  introNote: "\"Aller\" moves you anywhere — drop it before \"à\" and a place, or before an infinitive to talk about the future.",
  clusters: [
    {
      heading: "Je vais — Places",
      pairs: [
        { imageWord: "café", imageDescription: "a Parisian café with outdoor terrace", question: "Allez-vous au café?", questionTranslation: "Are you going to the café?", answer: "Oui, je vais au café.", answerTranslation: "Yes, I am going to the café." },
        { imageWord: "banque", imageDescription: "a bank building exterior with columns", question: "Allez-vous à la banque?", questionTranslation: "Are you going to the bank?", answer: "Oui, je vais à la banque.", answerTranslation: "Yes, I am going to the bank." },
        { imageWord: "cinéma", imageDescription: "a cinema marquee lit up at night", question: "Allez-vous au cinéma?", questionTranslation: "Are you going to the cinema?", answer: "Oui, je vais au cinéma.", answerTranslation: "Yes, I am going to the cinema." },
        { imageWord: "hôpital", imageDescription: "a hospital building exterior with a red cross sign", question: "Allez-vous à l'hôpital?", questionTranslation: "Are you going to the hospital?", answer: "Oui, je vais à l'hôpital.", answerTranslation: "Yes, I am going to the hospital." },
      ],
    },
    {
      heading: "Je vais + infinitif — Near Future",
      noteInline: "je vais + infinitive = I am going to …  (the easiest way to talk about the future)",
      pairs: [
        { imageWord: "manger", imageDescription: "a set dinner table with food ready to eat", question: "Allez-vous manger?", questionTranslation: "Are you going to eat?", answer: "Oui, je vais manger.", answerTranslation: "Yes, I am going to eat." },
        { imageWord: "travailler", imageDescription: "a person sitting at a desk working on a laptop", question: "Allez-vous travailler?", questionTranslation: "Are you going to work?", answer: "Oui, je vais travailler.", answerTranslation: "Yes, I am going to work." },
        { imageWord: "voyage", imageDescription: "a suitcase packed next to an airport departure board", question: "Allez-vous voyager?", questionTranslation: "Are you going to travel?", answer: "Oui, je vais voyager.", answerTranslation: "Yes, I am going to travel." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "Je vais", translation: "I am going" }, { text: "Il va", translation: "He is going" }, { text: "Elle va", translation: "She is going" }] },
        { label: "Destination / Infinitif", items: [{ text: "au café.", translation: "to the café." }, { text: "à la banque.", translation: "to the bank." }, { text: "manger.", translation: "to eat." }, { text: "travailler.", translation: "to work." }] },
      ],
    },
  ],
};

const FRENCH_ETRE: HayUnitContent = {
  chapterTitleKey: "je suis",
  conceptLabel: "Je suis",
  conceptDefinition: "I am · are you? · êtes-vous?",
  introNote: "\"Être\" is the verb of identity — nationality, profession, personality. One verb, endless self-expression.",
  clusters: [
    {
      heading: "Je suis — Identity",
      pairs: [
        { imageWord: "américain", imageDescription: "an American flag waving outdoors", question: "Êtes-vous américain?", questionTranslation: "Are you American?", answer: "Oui, je suis américain.", answerTranslation: "Yes, I am American." },
        { imageWord: "étudiant", imageDescription: "a student sitting in a university lecture hall", question: "Êtes-vous étudiant?", questionTranslation: "Are you a student?", answer: "Oui, je suis étudiant.", answerTranslation: "Yes, I am a student." },
        { imageWord: "professeur", imageDescription: "a teacher writing on a classroom blackboard", question: "Êtes-vous professeur?", questionTranslation: "Are you a teacher?", answer: "Oui, je suis professeur.", answerTranslation: "Yes, I am a teacher." },
        { imageWord: "médecin", imageDescription: "a doctor in a white coat with a stethoscope", question: "Êtes-vous médecin?", questionTranslation: "Are you a doctor?", answer: "Oui, je suis médecin.", answerTranslation: "Yes, I am a doctor." },
      ],
    },
    {
      heading: "Je suis + adjectif",
      noteInline: "Adjectives agree with gender: fatigué (m) · fatiguée (f) · content (m) · contente (f)",
      pairs: [
        { imageWord: "fatigué", imageDescription: "a person looking tired and yawning at a desk", question: "Êtes-vous fatigué?", questionTranslation: "Are you tired?", answer: "Oui, je suis fatigué.", answerTranslation: "Yes, I am tired." },
        { imageWord: "content", imageDescription: "a person smiling broadly, looking happy", question: "Êtes-vous content?", questionTranslation: "Are you happy?", answer: "Oui, je suis content.", answerTranslation: "Yes, I am happy." },
        { imageWord: "prêt", imageDescription: "a person standing at the door ready to leave, coat and bag in hand", question: "Êtes-vous prêt?", questionTranslation: "Are you ready?", answer: "Oui, je suis prêt.", answerTranslation: "Yes, I am ready." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "Je suis", translation: "I am" }, { text: "Il est", translation: "He is" }, { text: "Elle est", translation: "She is" }] },
        { label: "Attribut", items: [{ text: "américain.", translation: "American." }, { text: "étudiant.", translation: "a student." }, { text: "fatigué.", translation: "tired." }, { text: "content.", translation: "happy." }] },
      ],
    },
  ],
};

const FRENCH_AIMER: HayUnitContent = {
  chapterTitleKey: "j'aime",
  conceptLabel: "J'aime",
  conceptDefinition: "I like · I love · do you like? · aimez-vous?",
  introNote: "\"J'aime\" is stronger than the English \"I like\" — it often means love. Use \"j'aime bien\" to dial it back to a friendly like.",
  clusters: [
    {
      heading: "J'aime — Nouns",
      pairs: [
        { imageWord: "musique", imageDescription: "a person listening to music with headphones, eyes closed", question: "Aimez-vous la musique?", questionTranslation: "Do you like music?", answer: "Oui, j'aime la musique.", answerTranslation: "Yes, I like music." },
        { imageWord: "sport", imageDescription: "a variety of sports equipment — ball, racket, sneakers", question: "Aimez-vous le sport?", questionTranslation: "Do you like sport?", answer: "Oui, j'aime le sport.", answerTranslation: "Yes, I like sport." },
        { imageWord: "cinéma", imageDescription: "a cinema screen with an audience watching a film", question: "Aimez-vous le cinéma?", questionTranslation: "Do you like the cinema?", answer: "Oui, j'aime le cinéma.", answerTranslation: "Yes, I like cinema." },
        { imageWord: "café", imageDescription: "a person enjoying a coffee at a café table", question: "Aimez-vous le café?", questionTranslation: "Do you like coffee?", answer: "Oui, j'aime le café.", answerTranslation: "Yes, I like coffee." },
      ],
    },
    {
      heading: "J'aime + infinitif",
      noteInline: "j'aime + infinitive = I like to … · j'aime bien = I quite like",
      pairs: [
        { imageWord: "lire", imageDescription: "a person reading a book in an armchair", question: "Aimez-vous lire?", questionTranslation: "Do you like to read?", answer: "Oui, j'aime lire.", answerTranslation: "Yes, I like to read." },
        { imageWord: "voyager", imageDescription: "a plane window view of clouds and landscape below", question: "Aimez-vous voyager?", questionTranslation: "Do you like to travel?", answer: "Oui, j'aime voyager.", answerTranslation: "Yes, I like to travel." },
        { imageWord: "cuisine", imageDescription: "a person cooking at a stove, steam rising from a pot", question: "Aimez-vous cuisiner?", questionTranslation: "Do you like to cook?", answer: "Oui, j'aime cuisiner.", answerTranslation: "Yes, I like to cook." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "J'aime", translation: "I like / love" }, { text: "Il aime", translation: "He likes / loves" }, { text: "Elle aime", translation: "She likes / loves" }] },
        { label: "Objet / Infinitif", items: [{ text: "la musique.", translation: "music." }, { text: "le sport.", translation: "sport." }, { text: "lire.", translation: "to read." }, { text: "voyager.", translation: "to travel." }] },
      ],
    },
  ],
};

const FRENCH_IL_Y_A: HayUnitContent = {
  chapterTitleKey: "il y a",
  conceptLabel: "Il y a",
  conceptDefinition: "there is · there are · is there? · are there?",
  introNote: "\"Il y a\" is invariable — the same three words cover singular and plural, statement and question.",
  clusters: [
    {
      heading: "Il y a — En ville",
      pairs: [
        { imageWord: "café", imageDescription: "a Parisian café on a corner with outdoor chairs", question: "Y a-t-il un café?", questionTranslation: "Is there a café?", answer: "Oui, il y a un café.", answerTranslation: "Yes, there is a café." },
        { imageWord: "hôtel", imageDescription: "a classic hotel building exterior with a canopy", question: "Y a-t-il un hôtel?", questionTranslation: "Is there a hotel?", answer: "Oui, il y a un hôtel.", answerTranslation: "Yes, there is a hotel." },
        { imageWord: "banque", imageDescription: "a bank building with large glass doors", question: "Y a-t-il une banque?", questionTranslation: "Is there a bank?", answer: "Oui, il y a une banque.", answerTranslation: "Yes, there is a bank." },
        { imageWord: "parc", imageDescription: "a city park with trees and benches in sunlight", question: "Y a-t-il un parc?", questionTranslation: "Is there a park?", answer: "Oui, il y a un parc.", answerTranslation: "Yes, there is a park." },
      ],
    },
    {
      heading: "Il y a beaucoup de · Il n'y a pas de",
      noteInline: "il y a beaucoup de = there are many · il n'y a pas de = there is no / there are no",
      pairs: [
        { imageWord: "voiture", imageDescription: "many cars on a busy city street", question: "Y a-t-il beaucoup de voitures?", questionTranslation: "Are there many cars?", answer: "Oui, il y a beaucoup de voitures.", answerTranslation: "Yes, there are many cars." },
        { imageWord: "restaurant", imageDescription: "a busy restaurant street with many choices", question: "Y a-t-il des restaurants?", questionTranslation: "Are there restaurants?", answer: "Oui, il y a des restaurants.", answerTranslation: "Yes, there are restaurants." },
        { imageWord: "place", imageDescription: "an empty quiet town square with no people", question: "Y a-t-il des gens?", questionTranslation: "Are there people?", answer: "Non, il n'y a pas de gens.", answerTranslation: "No, there are no people.", extraNote: "il n'y a pas de = there is no / there are no" },
      ],
      sentenceColumns: [
        { label: "Formule", items: [{ text: "Il y a", translation: "There is / There are" }, { text: "Il n'y a pas de", translation: "There is no / There are no" }, { text: "Il y a beaucoup de", translation: "There are many" }] },
        { label: "Lieu / Objet", items: [{ text: "un café.", translation: "a café." }, { text: "une banque.", translation: "a bank." }, { text: "voitures.", translation: "cars." }, { text: "gens.", translation: "people." }] },
      ],
    },
  ],
};

const FRENCH_POUVOIR: HayUnitContent = {
  chapterTitleKey: "je peux",
  conceptLabel: "Je peux",
  conceptDefinition: "I can · I am able to · can you? · pouvez-vous?",
  introNote: "\"Pouvoir\" unlocks everything — it turns any infinitive into something you have the power to do. Always followed by an infinitive.",
  clusters: [
    {
      heading: "Je peux — Abilities",
      pairs: [
        { imageWord: "parler", imageDescription: "two people having a conversation, speech bubbles visible", question: "Pouvez-vous parler français?", questionTranslation: "Can you speak French?", answer: "Oui, je peux parler français.", answerTranslation: "Yes, I can speak French." },
        { imageWord: "nager", imageDescription: "a swimmer doing freestyle in a pool", question: "Pouvez-vous nager?", questionTranslation: "Can you swim?", answer: "Oui, je peux nager.", answerTranslation: "Yes, I can swim." },
        { imageWord: "venir", imageDescription: "a person walking toward a group of friends outdoors", question: "Pouvez-vous venir?", questionTranslation: "Can you come?", answer: "Oui, je peux venir.", answerTranslation: "Yes, I can come." },
        { imageWord: "aider", imageDescription: "one person helping another carry heavy boxes", question: "Pouvez-vous aider?", questionTranslation: "Can you help?", answer: "Oui, je peux vous aider.", answerTranslation: "Yes, I can help you." },
      ],
    },
    {
      heading: "Je ne peux pas — Can't Do",
      noteInline: "je ne peux pas = I cannot · je ne peux pas + infinitive = I cannot …",
      pairs: [
        { imageWord: "voler", imageDescription: "a cartoon person looking up at the sky wishing they could fly", question: "Pouvez-vous voler?", questionTranslation: "Can you fly?", answer: "Non, je ne peux pas voler.", answerTranslation: "No, I cannot fly." },
        { imageWord: "attendre", imageDescription: "a person tapping their watch, looking impatient", question: "Pouvez-vous attendre?", questionTranslation: "Can you wait?", answer: "Non, je ne peux pas attendre.", answerTranslation: "No, I cannot wait." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "Je peux", translation: "I can" }, { text: "Il peut", translation: "He can" }, { text: "Elle peut", translation: "She can" }, { text: "Je ne peux pas", translation: "I cannot" }] },
        { label: "Infinitif", items: [{ text: "parler.", translation: "speak." }, { text: "venir.", translation: "come." }, { text: "nager.", translation: "swim." }, { text: "vous aider.", translation: "help you." }] },
      ],
    },
  ],
};

// ── French passé composé / preterite chain units ─────────────────────────────

const FRENCH_OU_SUIS_JE: HayUnitContent = {
  chapterTitleKey: "où suis-je",
  conceptLabel: "Je suis / Il est",
  conceptDefinition: "I am (location) · he is · where am I? · où suis-je?",
  introNote: "In French, être handles both identity and location — one verb, two jobs. The preposition tells you which role it's playing.",
  clusters: [
    {
      heading: "Je suis — Locations",
      pairs: [
        { imageWord: "café", imageDescription: "a Parisian café with outdoor terrace and chairs", question: "Où êtes-vous?", questionTranslation: "Where are you?", answer: "Je suis au café.", answerTranslation: "I am at the café." },
        { imageWord: "école", imageDescription: "the exterior of a French school building", question: "Où est-il?", questionTranslation: "Where is he?", answer: "Il est à l'école.", answerTranslation: "He is at school." },
        { imageWord: "maison", imageDescription: "a cozy house exterior with a front garden", question: "Où es-tu?", questionTranslation: "Where are you?", answer: "Je suis à la maison.", answerTranslation: "I am at home." },
        { imageWord: "marché", imageDescription: "a busy outdoor market with colorful stalls", question: "Où est-elle?", questionTranslation: "Where is she?", answer: "Elle est au marché.", answerTranslation: "She is at the market." },
      ],
    },
    {
      heading: "Les Prépositions de Lieu",
      noteInline: "dans (in) · sur (on) · à (at/in) · près de (near) · devant (in front of) · derrière (behind)",
      pairs: [
        { imageWord: "bibliothèque", imageDescription: "a quiet library interior with rows of books", question: "Où est le livre?", questionTranslation: "Where is the book?", answer: "Il est dans la bibliothèque.", answerTranslation: "It is in the library." },
        { imageWord: "table", imageDescription: "a cup of coffee on a table near a window", question: "Où est le café?", questionTranslation: "Where is the coffee?", answer: "Il est sur la table.", answerTranslation: "It is on the table." },
        { imageWord: "parc", imageDescription: "a park bench near a fountain in sunshine", question: "Où est le banc?", questionTranslation: "Where is the bench?", answer: "Il est près de la fontaine.", answerTranslation: "It is near the fountain." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "Je suis", translation: "I am" }, { text: "Il est", translation: "He is" }, { text: "Elle est", translation: "She is" }, { text: "Nous sommes", translation: "We are" }] },
        { label: "Préposition + Lieu", items: [{ text: "au café.", translation: "at the café." }, { text: "à la maison.", translation: "at home." }, { text: "à l'école.", translation: "at school." }, { text: "dans la salle.", translation: "in the room." }, { text: "près du parc.", translation: "near the park." }] },
      ],
    },
  ],
};

const FRENCH_JAI_PRIS: HayUnitContent = {
  chapterTitleKey: "j'ai pris",
  conceptLabel: "J'ai pris",
  conceptDefinition: "I took · I had · I drank · passé composé of prendre",
  introNote: "\"Prendre\" (to take) is one of the most useful French verbs — you take the bus, take a photo, have a coffee. Past participle: pris.",
  clusters: [
    {
      heading: "J'ai pris — Ce que j'ai pris",
      pairs: [
        { imageWord: "métro", imageDescription: "a Paris metro train arriving at a platform", question: "Qu'est-ce que vous avez pris?", questionTranslation: "What did you take?", answer: "J'ai pris le métro.", answerTranslation: "I took the metro." },
        { imageWord: "café", imageDescription: "a small espresso cup on a café saucer", question: "Qu'est-ce que vous avez pris?", questionTranslation: "What did you have?", answer: "J'ai pris un café.", answerTranslation: "I had a coffee." },
        { imageWord: "photo", imageDescription: "a vintage camera being held up to take a photo", question: "Qu'est-ce qu'il a pris?", questionTranslation: "What did he take?", answer: "Il a pris une photo.", answerTranslation: "He took a photo." },
        { imageWord: "train", imageDescription: "a high-speed TGV train at a French station platform", question: "Qu'est-ce qu'elle a pris?", questionTranslation: "What did she take?", answer: "Elle a pris le train.", answerTranslation: "She took the train." },
      ],
    },
    {
      heading: "Je n'ai pas pris — La Forme Négative",
      noteInline: "je n'ai pas pris = I did not take · ne...pas wraps the auxiliary avoir",
      pairs: [
        { imageWord: "bus", imageDescription: "a red bus at a bus stop with the door open", question: "Avez-vous pris le bus?", questionTranslation: "Did you take the bus?", answer: "Non, je n'ai pas pris le bus.", answerTranslation: "No, I did not take the bus." },
        { imageWord: "taxi", imageDescription: "a yellow taxi cab waiting on a city street", question: "A-t-il pris un taxi?", questionTranslation: "Did he take a taxi?", answer: "Non, il n'a pas pris de taxi.", answerTranslation: "No, he did not take a taxi." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "J'ai pris", translation: "I took" }, { text: "Il a pris", translation: "He took" }, { text: "Elle a pris", translation: "She took" }, { text: "Je n'ai pas pris", translation: "I did not take" }] },
        { label: "Objet", items: [{ text: "le métro.", translation: "the metro." }, { text: "un café.", translation: "a coffee." }, { text: "le train.", translation: "the train." }, { text: "une photo.", translation: "a photo." }, { text: "le bus.", translation: "the bus." }] },
      ],
    },
  ],
};

const FRENCH_JAI_ACHETE: HayUnitContent = {
  chapterTitleKey: "j'ai acheté",
  conceptLabel: "J'ai acheté",
  conceptDefinition: "I bought · he bought · passé composé of acheter (-ER model)",
  introNote: "\"Acheté\" is the model for ALL regular -ER verbs in the past — drop -er, add -é. This pattern transfers to hundreds of verbs.",
  clusters: [
    {
      heading: "J'ai acheté — Shopping au passé",
      pairs: [
        { imageWord: "cadeau", imageDescription: "a wrapped gift with a ribbon on a table", question: "Qu'est-ce que vous avez acheté?", questionTranslation: "What did you buy?", answer: "J'ai acheté un cadeau.", answerTranslation: "I bought a gift." },
        { imageWord: "vêtements", imageDescription: "folded clothes in a shopping bag from a store", question: "Qu'est-ce qu'il a acheté?", questionTranslation: "What did he buy?", answer: "Il a acheté des vêtements.", answerTranslation: "He bought some clothes." },
        { imageWord: "livre", imageDescription: "a stack of books in a bookshop", question: "Qu'est-ce qu'elle a acheté?", questionTranslation: "What did she buy?", answer: "Elle a acheté un livre.", answerTranslation: "She bought a book." },
        { imageWord: "nourriture", imageDescription: "grocery bags filled with fresh market food", question: "Qu'est-ce que vous avez acheté au marché?", questionTranslation: "What did you buy at the market?", answer: "J'ai acheté de la nourriture.", answerTranslation: "I bought some food." },
      ],
    },
    {
      heading: "Le Modèle -ER au passé",
      noteInline: "infinitif en -ER → participe passé en -É  ·  parler→parlé  ·  manger→mangé  ·  regarder→regardé",
      pairs: [
        { imageWord: "film", imageDescription: "a person watching a movie on a couch with popcorn", question: "Qu'est-ce qu'il a regardé?", questionTranslation: "What did he watch?", answer: "Il a regardé un film.", answerTranslation: "He watched a film." },
        { imageWord: "ami", imageDescription: "two friends laughing together at a café table", question: "Avec qui avez-vous parlé?", questionTranslation: "Who did you talk with?", answer: "J'ai parlé avec mon ami.", answerTranslation: "I talked with my friend." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "J'ai acheté", translation: "I bought" }, { text: "Il a acheté", translation: "He bought" }, { text: "Elle a acheté", translation: "She bought" }, { text: "Je n'ai pas acheté de", translation: "I did not buy any" }] },
        { label: "Objet", items: [{ text: "un cadeau.", translation: "a gift." }, { text: "des vêtements.", translation: "clothes." }, { text: "un livre.", translation: "a book." }, { text: "de la nourriture.", translation: "food." }] },
      ],
    },
  ],
};

const FRENCH_JE_VOUDRAIS: HayUnitContent = {
  chapterTitleKey: "je voudrais",
  conceptLabel: "Je voudrais",
  conceptDefinition: "I would like · he would like · polite conditional of vouloir",
  introNote: "\"Je voudrais\" is the polite form every French speaker uses in restaurants, shops, and formal situations. One step above \"je veux.\"",
  clusters: [
    {
      heading: "Je voudrais — Les Désirs Polis",
      pairs: [
        { imageWord: "café", imageDescription: "a waiter in a bistro taking an order at a table", question: "Que voudriez-vous?", questionTranslation: "What would you like?", answer: "Je voudrais un café, s'il vous plaît.", answerTranslation: "I would like a coffee, please." },
        { imageWord: "carte", imageDescription: "a restaurant menu open on a table", question: "Que voudriez-vous commander?", questionTranslation: "What would you like to order?", answer: "Je voudrais voir la carte.", answerTranslation: "I would like to see the menu." },
        { imageWord: "Paris", imageDescription: "the Eiffel Tower at sunset with a golden sky", question: "Où voudriez-vous aller?", questionTranslation: "Where would you like to go?", answer: "Je voudrais visiter Paris.", answerTranslation: "I would like to visit Paris." },
        { imageWord: "chambre", imageDescription: "a hotel room with a large bed and city view", question: "Que voudriez-vous comme chambre?", questionTranslation: "What kind of room would you like?", answer: "Je voudrais une chambre avec vue.", answerTranslation: "I would like a room with a view." },
      ],
    },
    {
      heading: "Je voudrais + infinitif",
      noteInline: "je voudrais + infinitive = I would like to …  ·  more polite than je veux + infinitive",
      pairs: [
        { imageWord: "apprendre", imageDescription: "a person studying French with books and flashcards", question: "Que voudriez-vous apprendre?", questionTranslation: "What would you like to learn?", answer: "Je voudrais apprendre le français.", answerTranslation: "I would like to learn French." },
        { imageWord: "voyage", imageDescription: "a suitcase packed and ready by a front door", question: "Voudriez-vous voyager?", questionTranslation: "Would you like to travel?", answer: "Oui, je voudrais voyager.", answerTranslation: "Yes, I would like to travel." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "Je voudrais", translation: "I would like" }, { text: "Il voudrait", translation: "He would like" }, { text: "Elle voudrait", translation: "She would like" }, { text: "Nous voudrions", translation: "We would like" }] },
        { label: "Objet / Infinitif", items: [{ text: "un café.", translation: "a coffee." }, { text: "la carte.", translation: "the menu." }, { text: "visiter Paris.", translation: "to visit Paris." }, { text: "voyager.", translation: "to travel." }] },
      ],
    },
  ],
};

const FRENCH_JE_SUIS_ALLE: HayUnitContent = {
  chapterTitleKey: "je suis allé",
  conceptLabel: "Je suis allé(e)",
  conceptDefinition: "I went · she went · passé composé of aller with être",
  introNote: "Aller uses ÊTRE as its auxiliary in the past — and the past participle agrees with the subject. Allé (m) · Allée (f).",
  clusters: [
    {
      heading: "Je suis allé(e) — Où j'ai été",
      pairs: [
        { imageWord: "marché", imageDescription: "a colorful French outdoor market with produce stalls", question: "Où êtes-vous allé(e)?", questionTranslation: "Where did you go?", answer: "Je suis allé(e) au marché.", answerTranslation: "I went to the market." },
        { imageWord: "cinéma", imageDescription: "a cinema exterior lit up with movie posters at night", question: "Où est-il allé?", questionTranslation: "Where did he go?", answer: "Il est allé au cinéma.", answerTranslation: "He went to the cinema." },
        { imageWord: "école", imageDescription: "a student entering a school through glass doors", question: "Où est-elle allée?", questionTranslation: "Where did she go?", answer: "Elle est allée à l'école.", answerTranslation: "She went to school." },
        { imageWord: "plage", imageDescription: "a sandy beach with gentle waves on a sunny day", question: "Où êtes-vous allé(e) en vacances?", questionTranslation: "Where did you go on vacation?", answer: "Je suis allé(e) à la plage.", answerTranslation: "I went to the beach." },
      ],
    },
    {
      heading: "L'Accord — Masculin / Féminin",
      noteInline: "allé (masc) · allée (fem) · allés (masc plural) · allées (fem plural)  ·  agreement is written, not always spoken",
      pairs: [
        { imageWord: "restaurant", imageDescription: "a couple walking into a French restaurant together", question: "Où sont-ils allés?", questionTranslation: "Where did they go?", answer: "Ils sont allés au restaurant.", answerTranslation: "They went to the restaurant." },
        { imageWord: "amies", imageDescription: "a group of female friends walking together in the city", question: "Où sont-elles allées?", questionTranslation: "Where did they go?", answer: "Elles sont allées en ville.", answerTranslation: "They went to town." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "Je suis allé(e)", translation: "I went" }, { text: "Il est allé", translation: "He went" }, { text: "Elle est allée", translation: "She went" }, { text: "Ils sont allés", translation: "They went (m)" }, { text: "Je ne suis pas allé(e)", translation: "I did not go" }] },
        { label: "Destination", items: [{ text: "au marché.", translation: "to the market." }, { text: "au cinéma.", translation: "to the cinema." }, { text: "à la plage.", translation: "to the beach." }, { text: "en ville.", translation: "to town." }] },
      ],
    },
  ],
};

const FRENCH_IL_VA: HayUnitContent = {
  chapterTitleKey: "il va",
  conceptLabel: "Il va / Elle va",
  conceptDefinition: "he is going to · she is going to · near future (3rd person)",
  introNote: "Il va + infinitive = the easiest way to talk about what someone else is going to do. Third-person storytelling begins here.",
  clusters: [
    {
      heading: "Il va — Ce qu'il va faire",
      pairs: [
        { imageWord: "travailler", imageDescription: "a person walking purposefully into an office building", question: "Qu'est-ce qu'il va faire?", questionTranslation: "What is he going to do?", answer: "Il va travailler.", answerTranslation: "He is going to work." },
        { imageWord: "manger", imageDescription: "a table set for dinner with steaming dishes", question: "Qu'est-ce qu'elle va faire?", questionTranslation: "What is she going to do?", answer: "Elle va manger.", answerTranslation: "She is going to eat." },
        { imageWord: "étudier", imageDescription: "a student opening textbooks at a library desk", question: "Qu'est-ce qu'il va faire ce soir?", questionTranslation: "What is he going to do tonight?", answer: "Il va étudier.", answerTranslation: "He is going to study." },
        { imageWord: "voyage", imageDescription: "a person looking at flight departure boards at an airport", question: "Où est-ce qu'elle va aller?", questionTranslation: "Where is she going to go?", answer: "Elle va voyager.", answerTranslation: "She is going to travel." },
      ],
    },
    {
      heading: "Il ne va pas — La Négation",
      noteInline: "il ne va pas + infinitive = he is not going to …  ·  ne...pas wraps the conjugated verb va",
      pairs: [
        { imageWord: "rester", imageDescription: "a person sitting on a couch looking relaxed at home", question: "Est-ce qu'il va sortir?", questionTranslation: "Is he going to go out?", answer: "Non, il ne va pas sortir. Il va rester.", answerTranslation: "No, he is not going to go out. He is going to stay." },
        { imageWord: "pleuvoir", imageDescription: "dark clouds gathering over a city skyline", question: "Est-ce qu'il va faire beau?", questionTranslation: "Is the weather going to be nice?", answer: "Non, il va pleuvoir.", answerTranslation: "No, it is going to rain." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "Il va", translation: "He is going to" }, { text: "Elle va", translation: "She is going to" }, { text: "Ils vont", translation: "They are going to" }, { text: "Il ne va pas", translation: "He is not going to" }] },
        { label: "Infinitif", items: [{ text: "travailler.", translation: "work." }, { text: "manger.", translation: "eat." }, { text: "étudier.", translation: "study." }, { text: "voyager.", translation: "travel." }, { text: "rester.", translation: "stay." }] },
      ],
    },
  ],
};

const FRENCH_QU_EST_CE_QU_IL_A_FAIT: HayUnitContent = {
  chapterTitleKey: "qu'est-ce qu'il a fait",
  conceptLabel: "Qu'est-ce qu'il a fait?",
  conceptDefinition: "what did he do? · passé composé narration · il a fait / il a mangé / il a regardé",
  introNote: "\"Qu'est-ce qu'il a fait?\" opens up past-tense storytelling. Use this question to narrate anyone's day.",
  clusters: [
    {
      heading: "Il a fait — La Journée au Passé",
      pairs: [
        { imageWord: "courses", imageDescription: "a person pushing a shopping cart through a grocery store", question: "Qu'est-ce qu'il a fait ce matin?", questionTranslation: "What did he do this morning?", answer: "Il a fait les courses.", answerTranslation: "He did the grocery shopping." },
        { imageWord: "film", imageDescription: "a person watching a movie on a large TV screen", question: "Qu'est-ce qu'elle a fait hier soir?", questionTranslation: "What did she do last night?", answer: "Elle a regardé un film.", answerTranslation: "She watched a film." },
        { imageWord: "devoirs", imageDescription: "a student writing in a notebook at a desk", question: "Qu'est-ce qu'il a fait après l'école?", questionTranslation: "What did he do after school?", answer: "Il a fait ses devoirs.", answerTranslation: "He did his homework." },
        { imageWord: "amis", imageDescription: "a group of friends laughing around a restaurant table", question: "Qu'est-ce qu'ils ont fait?", questionTranslation: "What did they do?", answer: "Ils ont mangé avec des amis.", answerTranslation: "They ate with friends." },
      ],
    },
    {
      heading: "Raconter une Histoire — Narrating a Day",
      noteInline: "chain past actions with et (and) or puis (then) to build a full narrative",
      pairs: [
        { imageWord: "matin", imageDescription: "a morning scene: coffee, croissant, morning light through a window", question: "Qu'est-ce qu'il a fait le matin?", questionTranslation: "What did he do in the morning?", answer: "Il s'est levé, il a pris un café et il est allé au travail.", answerTranslation: "He got up, had a coffee and went to work." },
        { imageWord: "soir", imageDescription: "a calm evening scene: lamp light, book, quiet room", question: "Qu'est-ce qu'elle a fait le soir?", questionTranslation: "What did she do in the evening?", answer: "Elle a lu un livre et elle s'est couchée tôt.", answerTranslation: "She read a book and went to bed early." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "Il a fait", translation: "He did/made" }, { text: "Elle a regardé", translation: "She watched" }, { text: "Ils ont mangé", translation: "They ate" }, { text: "Il a lu", translation: "He read" }] },
        { label: "Objet / Contexte", items: [{ text: "les courses.", translation: "the shopping." }, { text: "ses devoirs.", translation: "his homework." }, { text: "un film.", translation: "a film." }, { text: "avec des amis.", translation: "with friends." }] },
      ],
    },
  ],
};

const FRENCH_IL_A_EU: HayUnitContent = {
  chapterTitleKey: "il a eu",
  conceptLabel: "Il a eu / J'ai eu",
  conceptDefinition: "he had · I had · passé composé of avoir (irregular: eu)",
  introNote: "Avoir uses itself as its own auxiliary. Past participle eu is irregular — must memorize. Used for luck, accidents, feelings.",
  clusters: [
    {
      heading: "J'ai eu / Il a eu — Expériences",
      pairs: [
        { imageWord: "chance", imageDescription: "a four-leaf clover resting on an open palm", question: "Avez-vous eu de la chance?", questionTranslation: "Were you lucky?", answer: "Oui, j'ai eu de la chance.", answerTranslation: "Yes, I was lucky." },
        { imageWord: "problème", imageDescription: "a person looking stressed in front of a broken-down car", question: "A-t-il eu un problème?", questionTranslation: "Did he have a problem?", answer: "Oui, il a eu un problème.", answerTranslation: "Yes, he had a problem." },
        { imageWord: "peur", imageDescription: "a person startled, looking wide-eyed and frightened", question: "A-t-elle eu peur?", questionTranslation: "Was she scared?", answer: "Oui, elle a eu peur.", answerTranslation: "Yes, she was scared." },
        { imageWord: "accident", imageDescription: "a dented car fender after a minor collision", question: "A-t-il eu un accident?", questionTranslation: "Did he have an accident?", answer: "Oui, il a eu un accident.", answerTranslation: "Yes, he had an accident." },
      ],
    },
    {
      heading: "Je n'ai pas eu — La Négation",
      noteInline: "je n'ai pas eu = I did not have · ne...pas wraps avoir · article shifts to de in negative",
      pairs: [
        { imageWord: "temps", imageDescription: "a clock showing no time left, hands racing to midnight", question: "Avez-vous eu le temps?", questionTranslation: "Did you have time?", answer: "Non, je n'ai pas eu le temps.", answerTranslation: "No, I did not have time." },
        { imageWord: "réponse", imageDescription: "an empty email inbox with no new messages", question: "A-t-il eu une réponse?", questionTranslation: "Did he get an answer?", answer: "Non, il n'a pas eu de réponse.", answerTranslation: "No, he did not get an answer." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "J'ai eu", translation: "I had" }, { text: "Il a eu", translation: "He had" }, { text: "Elle a eu", translation: "She had" }, { text: "Je n'ai pas eu de", translation: "I did not have" }] },
        { label: "Expérience", items: [{ text: "de la chance.", translation: "luck." }, { text: "un problème.", translation: "a problem." }, { text: "peur.", translation: "fear (I was scared)." }, { text: "le temps.", translation: "time." }, { text: "réponse.", translation: "an answer." }] },
      ],
    },
  ],
};

const FRENCH_LUI: HayUnitContent = {
  chapterTitleKey: "lui",
  conceptLabel: "Lui",
  conceptDefinition: "to him · to her · indirect object pronoun · replaces à + person",
  introNote: "\"Lui\" replaces \"à + person\" — one pronoun for both masculine and feminine. It always comes before the conjugated verb.",
  clusters: [
    {
      heading: "Je lui — Actions dirigées vers quelqu'un",
      pairs: [
        { imageWord: "parler", imageDescription: "a person speaking on the phone, looking engaged", question: "Est-ce que vous lui parlez souvent?", questionTranslation: "Do you speak to him/her often?", answer: "Oui, je lui parle tous les jours.", answerTranslation: "Yes, I speak to him/her every day." },
        { imageWord: "cadeau", imageDescription: "a person handing a wrapped gift to someone else", question: "Qu'est-ce que vous lui avez donné?", questionTranslation: "What did you give him/her?", answer: "Je lui ai donné un cadeau.", answerTranslation: "I gave him/her a gift." },
        { imageWord: "lettre", imageDescription: "a handwritten letter being handed to someone", question: "Est-ce que vous lui écrivez?", questionTranslation: "Do you write to him/her?", answer: "Oui, je lui écris souvent.", answerTranslation: "Yes, I write to him/her often." },
        { imageWord: "téléphone", imageDescription: "a person calling on a smartphone outdoors", question: "Est-ce que vous lui téléphonez?", questionTranslation: "Do you call him/her?", answer: "Oui, je lui téléphone.", answerTranslation: "Yes, I call him/her." },
      ],
    },
    {
      heading: "Je ne lui — La Négation",
      noteInline: "je ne lui parle pas = I do not speak to him/her · lui stays between ne and the verb",
      pairs: [
        { imageWord: "silence", imageDescription: "a person with arms crossed, turned away, not speaking", question: "Est-ce que vous lui parlez encore?", questionTranslation: "Do you still speak to him/her?", answer: "Non, je ne lui parle plus.", answerTranslation: "No, I no longer speak to him/her." },
        { imageWord: "message", imageDescription: "a smartphone showing no unread messages", question: "Est-ce que vous lui avez répondu?", questionTranslation: "Did you reply to him/her?", answer: "Non, je ne lui ai pas répondu.", answerTranslation: "No, I did not reply to him/her." },
      ],
      sentenceColumns: [
        { label: "Formule", items: [{ text: "Je lui parle.", translation: "I speak to him/her." }, { text: "Je lui donne.", translation: "I give him/her." }, { text: "Je lui écris.", translation: "I write to him/her." }, { text: "Je ne lui parle pas.", translation: "I do not speak to him/her." }] },
        { label: "Contexte", items: [{ text: "tous les jours.", translation: "every day." }, { text: "un cadeau.", translation: "a gift." }, { text: "souvent.", translation: "often." }, { text: "une lettre.", translation: "a letter." }] },
      ],
    },
  ],
};

const FRENCH_CEST_PROPRE: HayUnitContent = {
  chapterTitleKey: "c'est propre",
  conceptLabel: "C'est propre / C'est sale",
  conceptDefinition: "it is clean · it is dirty · c'est + adjective for descriptions",
  introNote: "\"C'est\" + adjective is the all-purpose French description formula. One pattern, endless combinations.",
  clusters: [
    {
      heading: "C'est — Les Descriptions",
      pairs: [
        { imageWord: "propre", imageDescription: "a spotlessly clean and tidy kitchen with gleaming surfaces", question: "C'est propre ou c'est sale?", questionTranslation: "Is it clean or dirty?", answer: "C'est propre.", answerTranslation: "It is clean." },
        { imageWord: "sale", imageDescription: "a messy room with dishes and clothes on the floor", question: "C'est propre ou c'est sale?", questionTranslation: "Is it clean or dirty?", answer: "C'est sale.", answerTranslation: "It is dirty." },
        { imageWord: "grand", imageDescription: "a vast, impressive open landscape under a big sky", question: "C'est grand?", questionTranslation: "Is it big?", answer: "Oui, c'est très grand.", answerTranslation: "Yes, it is very big." },
        { imageWord: "beau", imageDescription: "a stunning sunset over the ocean with vivid colours", question: "C'est beau?", questionTranslation: "Is it beautiful?", answer: "Oui, c'est magnifique!", answerTranslation: "Yes, it is magnificent!" },
      ],
    },
    {
      heading: "Ce n'est pas — La Négation",
      noteInline: "ce n'est pas = it is not · ce n'est pas + adjective = it is not …",
      pairs: [
        { imageWord: "facile", imageDescription: "a student frowning over a very difficult exam paper", question: "C'est facile?", questionTranslation: "Is it easy?", answer: "Non, ce n'est pas facile. C'est difficile.", answerTranslation: "No, it is not easy. It is difficult." },
        { imageWord: "cher", imageDescription: "a price tag on an expensive item in a luxury shop window", question: "C'est cher?", questionTranslation: "Is it expensive?", answer: "Oui, c'est très cher.", answerTranslation: "Yes, it is very expensive." },
      ],
      sentenceColumns: [
        { label: "Formule", items: [{ text: "C'est", translation: "It is" }, { text: "Ce n'est pas", translation: "It is not" }, { text: "C'est très", translation: "It is very" }, { text: "C'est trop", translation: "It is too" }] },
        { label: "Adjectif", items: [{ text: "propre.", translation: "clean." }, { text: "sale.", translation: "dirty." }, { text: "grand.", translation: "big." }, { text: "beau.", translation: "beautiful." }, { text: "cher.", translation: "expensive." }, { text: "facile.", translation: "easy." }, { text: "difficile.", translation: "difficult." }] },
      ],
    },
  ],
};

const FRENCH_JAI_ETUDIE: HayUnitContent = {
  chapterTitleKey: "j'ai étudié",
  conceptLabel: "J'ai étudié",
  conceptDefinition: "I studied · passé composé model for regular -ER verbs",
  introNote: "The -ER passé composé unlocks hundreds of verbs at once. Drop -ER, add -É. This one pattern is the most used past tense in French.",
  clusters: [
    {
      heading: "J'ai + participe -É — Le Pattern Essentiel",
      pairs: [
        { imageWord: "étudier", imageDescription: "a student studying with notes and highlighted textbooks", question: "Qu'est-ce que vous avez étudié?", questionTranslation: "What did you study?", answer: "J'ai étudié le français.", answerTranslation: "I studied French." },
        { imageWord: "travailler", imageDescription: "a person at a busy desk with papers and a laptop", question: "Avez-vous travaillé aujourd'hui?", questionTranslation: "Did you work today?", answer: "Oui, j'ai travaillé toute la journée.", answerTranslation: "Yes, I worked all day." },
        { imageWord: "manger", imageDescription: "a plate of food being eaten at a restaurant table", question: "Où avez-vous mangé?", questionTranslation: "Where did you eat?", answer: "J'ai mangé au restaurant.", answerTranslation: "I ate at the restaurant." },
        { imageWord: "regarder", imageDescription: "a person watching television in the evening light", question: "Qu'est-ce que vous avez regardé hier soir?", questionTranslation: "What did you watch last night?", answer: "J'ai regardé la télévision.", answerTranslation: "I watched television." },
      ],
    },
    {
      heading: "Je n'ai pas + -É — La Négation",
      noteInline: "je n'ai pas étudié = I did not study · article un/une/des shifts to DE in negative",
      pairs: [
        { imageWord: "devoirs", imageDescription: "an empty desk with a closed notebook and pencil untouched", question: "Avez-vous fait vos devoirs?", questionTranslation: "Did you do your homework?", answer: "Non, je n'ai pas fait mes devoirs.", answerTranslation: "No, I did not do my homework." },
        { imageWord: "sport", imageDescription: "sports equipment sitting unused on a shelf", question: "Avez-vous joué au sport?", questionTranslation: "Did you play sport?", answer: "Non, je n'ai pas joué au sport.", answerTranslation: "No, I did not play sport." },
      ],
      sentenceColumns: [
        { label: "Sujet + Auxiliaire", items: [{ text: "J'ai", translation: "I have / I" }, { text: "Il a", translation: "He has / He" }, { text: "Elle a", translation: "She has / She" }, { text: "Nous avons", translation: "We have / We" }, { text: "Je n'ai pas", translation: "I have not / I did not" }] },
        { label: "Participe en -É", items: [{ text: "étudié.", translation: "studied." }, { text: "travaillé.", translation: "worked." }, { text: "mangé.", translation: "eaten." }, { text: "regardé.", translation: "watched." }, { text: "parlé.", translation: "spoken." }, { text: "acheté.", translation: "bought." }] },
      ],
    },
  ],
};

const FRENCH_JAI_RECU: HayUnitContent = {
  chapterTitleKey: "j'ai reçu",
  conceptLabel: "J'ai reçu",
  conceptDefinition: "I received · irregular past participles ending in -U · reçu / vu / lu / bu / su",
  introNote: "Several common French verbs form their past participle with -U. These must be memorized, but they share a family resemblance.",
  clusters: [
    {
      heading: "J'ai reçu / J'ai vu / J'ai lu — La Famille en -U",
      pairs: [
        { imageWord: "lettre", imageDescription: "a person reading a handwritten letter with a smile", question: "Avez-vous reçu une lettre?", questionTranslation: "Did you receive a letter?", answer: "Oui, j'ai reçu une lettre.", answerTranslation: "Yes, I received a letter." },
        { imageWord: "film", imageDescription: "a cinema screen showing the end credits of a film", question: "Avez-vous vu ce film?", questionTranslation: "Did you see that film?", answer: "Oui, je l'ai vu hier.", answerTranslation: "Yes, I saw it yesterday." },
        { imageWord: "roman", imageDescription: "a person finishing the last page of a novel with satisfaction", question: "Avez-vous lu ce livre?", questionTranslation: "Did you read that book?", answer: "Oui, je l'ai lu la semaine dernière.", answerTranslation: "Yes, I read it last week." },
        { imageWord: "eau", imageDescription: "a glass of water being drunk on a hot sunny day", question: "Avez-vous bu de l'eau?", questionTranslation: "Did you drink water?", answer: "Oui, j'ai bu de l'eau.", answerTranslation: "Yes, I drank water." },
      ],
    },
    {
      heading: "Les Participes en -U à Retenir",
      noteInline: "recevoir→reçu  ·  voir→vu  ·  lire→lu  ·  boire→bu  ·  savoir→su  ·  vouloir→voulu  ·  pouvoir→pu",
      pairs: [
        { imageWord: "réponse", imageDescription: "a person reading an important email reply on a laptop", question: "A-t-il reçu une réponse?", questionTranslation: "Did he receive a reply?", answer: "Oui, il a reçu une réponse.", answerTranslation: "Yes, he received a reply." },
        { imageWord: "nouvelles", imageDescription: "someone looking surprised reading news on their phone", question: "A-t-elle su la nouvelle?", questionTranslation: "Did she find out the news?", answer: "Oui, elle a su la nouvelle ce matin.", answerTranslation: "Yes, she found out the news this morning." },
      ],
      sentenceColumns: [
        { label: "Sujet", items: [{ text: "J'ai reçu", translation: "I received" }, { text: "J'ai vu", translation: "I saw" }, { text: "J'ai lu", translation: "I read" }, { text: "J'ai bu", translation: "I drank" }, { text: "Je n'ai pas reçu de", translation: "I did not receive" }] },
        { label: "Objet", items: [{ text: "une lettre.", translation: "a letter." }, { text: "un film.", translation: "a film." }, { text: "un livre.", translation: "a book." }, { text: "du café.", translation: "coffee." }, { text: "réponse.", translation: "an answer." }] },
      ],
    },
  ],
};

const FRENCH_FUTUR_PROCHE: HayUnitContent = {
  chapterTitleKey: 'je vais + infinitif',
  conceptLabel: 'Le Futur Proche',
  conceptDefinition: 'I am going to · je vais + infinitif · the most natural future in spoken French',
  introNote: 'Futur proche is formed with aller + infinitive — exactly like Spanish ir a and English "going to." Once you have aller down, the whole future opens up.',
  clusters: [
    {
      heading: 'Je vais + infinitif — Plans et Intentions',
      pairs: [
        { imageWord: 'manger', imageDescription: 'a person sitting down to a meal, looking forward to eating', question: "Qu'est-ce que vous allez manger?", questionTranslation: 'What are you going to eat?', answer: 'Je vais manger une pizza.', answerTranslation: 'I am going to eat a pizza.' },
        { imageWord: 'acheter', imageDescription: 'a person walking into a store with a shopping bag', question: "Qu'est-ce que vous allez acheter?", questionTranslation: 'What are you going to buy?', answer: 'Je vais acheter un livre.', answerTranslation: 'I am going to buy a book.' },
        { imageWord: 'voyager', imageDescription: 'a person at an airport with a suitcase, excited to travel', question: 'Où allez-vous voyager?', questionTranslation: 'Where are you going to travel?', answer: 'Je vais voyager en France.', answerTranslation: 'I am going to travel to France.' },
        { imageWord: 'étudier', imageDescription: 'an open textbook and notes on a desk, ready to study', question: "Qu'est-ce que vous allez étudier ce soir?", questionTranslation: 'What are you going to study tonight?', answer: 'Je vais étudier le français.', answerTranslation: 'I am going to study French.' },
      ],
    },
    {
      heading: 'Elle va / Il va + infinitif — À la Troisième Personne',
      noteInline: 'elle va manger = she is going to eat · il va acheter = he is going to buy',
      pairs: [
        { imageWord: 'travailler', imageDescription: 'a woman heading to her office with a briefcase', question: "Qu'est-ce qu'elle va faire?", questionTranslation: 'What is she going to do?', answer: 'Elle va travailler.', answerTranslation: 'She is going to work.' },
        { imageWord: 'lire', imageDescription: 'a man settling into a chair with a novel', question: "Qu'est-ce qu'il va faire?", questionTranslation: 'What is he going to do?', answer: 'Il va lire un roman.', answerTranslation: 'He is going to read a novel.' },
      ],
      sentenceColumns: [
        { label: 'Sujet', items: [{ text: 'Je vais', translation: 'I am going to' }, { text: 'Elle va', translation: 'She is going to' }, { text: 'Il va', translation: 'He is going to' }, { text: 'On va', translation: 'One is going to / We are going to' }, { text: 'Nous allons', translation: 'We are going to' }] },
        { label: 'Infinitif', items: [{ text: 'manger.', translation: 'eat.' }, { text: 'acheter.', translation: 'buy.' }, { text: 'étudier.', translation: 'study.' }, { text: 'voyager.', translation: 'travel.' }, { text: 'travailler.', translation: 'work.' }, { text: 'lire.', translation: 'read.' }] },
      ],
    },
  ],
};

// ── Italian present-tense verb units ──────────────────────────────────────────

const ITALIAN_VOGLIO: HayUnitContent = {
  chapterTitleKey: "voglio",
  conceptLabel: "Voglio",
  conceptDefinition: "I want · do you want? · vuoi?",
  introNote: "\"Voglio\" works the same way every time — drop it in front of any noun or infinitive and you have a complete thought.",
  clusters: [
    {
      heading: "Voglio — Frasi Modello",
      pairs: [
        { imageWord: "caffè", imageDescription: "a steaming cup of Italian espresso on a saucer", question: "Vuoi un caffè?", questionTranslation: "Do you want a coffee?", answer: "Sì, voglio un caffè.", answerTranslation: "Yes, I want a coffee." },
        { imageWord: "acqua", imageDescription: "a glass of still water on a restaurant table", question: "Vuoi dell'acqua?", questionTranslation: "Do you want some water?", answer: "Sì, voglio dell'acqua.", answerTranslation: "Yes, I want some water." },
        { imageWord: "pane", imageDescription: "a fresh Italian bread roll on a white surface", question: "Vuoi del pane?", questionTranslation: "Do you want some bread?", answer: "Sì, voglio del pane.", answerTranslation: "Yes, I want some bread." },
        { imageWord: "mela", imageDescription: "a red apple on a white background", question: "Vuoi una mela?", questionTranslation: "Do you want an apple?", answer: "Sì, voglio una mela.", answerTranslation: "Yes, I want an apple." },
      ],
    },
    {
      heading: "Voglio + infinito",
      noteInline: "voglio + infinitive = I want to …",
      pairs: [
        { imageWord: "mangiare", imageDescription: "a person sitting down to eat a meal at a table", question: "Vuoi mangiare?", questionTranslation: "Do you want to eat?", answer: "Sì, voglio mangiare.", answerTranslation: "Yes, I want to eat." },
        { imageWord: "dormire", imageDescription: "a person yawning and looking tired in the afternoon", question: "Vuoi dormire?", questionTranslation: "Do you want to sleep?", answer: "Sì, voglio dormire.", answerTranslation: "Yes, I want to sleep." },
        { imageWord: "uscire", imageDescription: "a person walking out the front door of a house", question: "Vuoi uscire?", questionTranslation: "Do you want to go out?", answer: "Sì, voglio uscire.", answerTranslation: "Yes, I want to go out." },
      ],
      sentenceColumns: [
        { label: "Soggetto", items: [{ text: "Voglio", translation: "I want" }, { text: "Lui vuole", translation: "He wants" }, { text: "Lei vuole", translation: "She wants" }] },
        { label: "Oggetto / Infinito", items: [{ text: "un caffè.", translation: "a coffee." }, { text: "dell'acqua.", translation: "some water." }, { text: "mangiare.", translation: "to eat." }, { text: "uscire.", translation: "to go out." }] },
      ],
    },
  ],
};

const ITALIAN_HO: HayUnitContent = {
  chapterTitleKey: "ho / avere",
  conceptLabel: "Ho",
  conceptDefinition: "I have · do you have? · hai?",
  introNote: "\"Ho\" is one of the most essential verbs in Italian — possession, age expressions, and the entire passato prossimo all run through avere.",
  clusters: [
    {
      heading: "Ho — Frasi Modello",
      pairs: [
        { imageWord: "libro", imageDescription: "an open book on a wooden desk", question: "Hai un libro?", questionTranslation: "Do you have a book?", answer: "Sì, ho un libro.", answerTranslation: "Yes, I have a book." },
        { imageWord: "macchina", imageDescription: "a car parked on a sunny Italian street", question: "Hai una macchina?", questionTranslation: "Do you have a car?", answer: "Sì, ho una macchina.", answerTranslation: "Yes, I have a car." },
        { imageWord: "gatto", imageDescription: "a cat sitting on a sunny windowsill", question: "Hai un gatto?", questionTranslation: "Do you have a cat?", answer: "Sì, ho un gatto.", answerTranslation: "Yes, I have a cat." },
        { imageWord: "soldi", imageDescription: "euro banknotes and coins spread on a table", question: "Hai dei soldi?", questionTranslation: "Do you have any money?", answer: "Sì, ho dei soldi.", answerTranslation: "Yes, I have some money." },
      ],
    },
    {
      heading: "Ho fame · Ho sete · Ho …",
      noteInline: "Italian uses avere (to have) where English uses to be: ho fame = I am hungry · ho sete = I am thirsty · ho freddo = I am cold",
      pairs: [
        { imageWord: "fame", imageDescription: "a person holding their stomach looking very hungry", question: "Hai fame?", questionTranslation: "Are you hungry?", answer: "Sì, ho fame.", answerTranslation: "Yes, I am hungry." },
        { imageWord: "sete", imageDescription: "a person reaching for a glass of water looking thirsty", question: "Hai sete?", questionTranslation: "Are you thirsty?", answer: "Sì, ho sete.", answerTranslation: "Yes, I am thirsty." },
        { imageWord: "freddo", imageDescription: "a person wrapped in a scarf shivering in the cold", question: "Hai freddo?", questionTranslation: "Are you cold?", answer: "Sì, ho freddo.", answerTranslation: "Yes, I am cold." },
      ],
      sentenceColumns: [
        { label: "Soggetto", items: [{ text: "Ho", translation: "I have" }, { text: "Lui ha", translation: "He has" }, { text: "Lei ha", translation: "She has" }] },
        { label: "Oggetto", items: [{ text: "un libro.", translation: "a book." }, { text: "una macchina.", translation: "a car." }, { text: "fame.", translation: "hunger (I'm hungry)." }, { text: "sete.", translation: "thirst (I'm thirsty)." }] },
      ],
    },
  ],
};

const ITALIAN_VADO: HayUnitContent = {
  chapterTitleKey: "dove vai",
  conceptLabel: "Vado",
  conceptDefinition: "I am going · where are you going? · dove vai?",
  introNote: "\"Andare\" moves you anywhere — drop it before \"al\" and a place, or before \"a\" and an infinitive to talk about the future.",
  clusters: [
    {
      heading: "Vado — Places",
      pairs: [
        { imageWord: "caffè", imageDescription: "the exterior of an Italian café with tables outside", question: "Vai al caffè?", questionTranslation: "Are you going to the café?", answer: "Sì, vado al caffè.", answerTranslation: "Yes, I am going to the café." },
        { imageWord: "banca", imageDescription: "a bank building exterior on an Italian street", question: "Vai alla banca?", questionTranslation: "Are you going to the bank?", answer: "Sì, vado alla banca.", answerTranslation: "Yes, I am going to the bank." },
        { imageWord: "cinema", imageDescription: "a cinema marquee lit up at night on an Italian piazza", question: "Vai al cinema?", questionTranslation: "Are you going to the cinema?", answer: "Sì, vado al cinema.", answerTranslation: "Yes, I am going to the cinema." },
        { imageWord: "ospedale", imageDescription: "a hospital building exterior with a red cross sign", question: "Vai all'ospedale?", questionTranslation: "Are you going to the hospital?", answer: "Sì, vado all'ospedale.", answerTranslation: "Yes, I am going to the hospital." },
      ],
    },
    {
      heading: "Vado a + infinito — Futuro Prossimo",
      noteInline: "vado a + infinitive = I am going to …  (the easiest way to talk about the near future in Italian)",
      pairs: [
        { imageWord: "mangiare", imageDescription: "a set dinner table with Italian food ready to eat", question: "Vai a mangiare?", questionTranslation: "Are you going to eat?", answer: "Sì, vado a mangiare.", answerTranslation: "Yes, I am going to eat." },
        { imageWord: "lavorare", imageDescription: "a person sitting at a desk working on a laptop", question: "Vai a lavorare?", questionTranslation: "Are you going to work?", answer: "Sì, vado a lavorare.", answerTranslation: "Yes, I am going to work." },
        { imageWord: "viaggio", imageDescription: "a suitcase packed next to an airport departure board", question: "Vai a viaggiare?", questionTranslation: "Are you going to travel?", answer: "Sì, vado a viaggiare.", answerTranslation: "Yes, I am going to travel." },
      ],
      sentenceColumns: [
        { label: "Soggetto", items: [{ text: "Vado", translation: "I am going" }, { text: "Lui va", translation: "He is going" }, { text: "Lei va", translation: "She is going" }] },
        { label: "Destinazione / Infinito", items: [{ text: "al caffè.", translation: "to the café." }, { text: "alla banca.", translation: "to the bank." }, { text: "a mangiare.", translation: "to eat." }, { text: "a lavorare.", translation: "to work." }] },
      ],
    },
  ],
};

const ITALIAN_SONO: HayUnitContent = {
  chapterTitleKey: "essere: la natura",
  conceptLabel: "Sono",
  conceptDefinition: "I am · are you? · sei?",
  introNote: "\"Essere\" is the verb of identity — nationality, profession, personality. One verb, endless self-expression.",
  clusters: [
    {
      heading: "Sono — Identità",
      pairs: [
        { imageWord: "americano", imageDescription: "an American flag waving in the wind outdoors", question: "Sei americano?", questionTranslation: "Are you American?", answer: "Sì, sono americano.", answerTranslation: "Yes, I am American." },
        { imageWord: "studente", imageDescription: "a student sitting in a university lecture hall with a notebook", question: "Sei studente?", questionTranslation: "Are you a student?", answer: "Sì, sono studente.", answerTranslation: "Yes, I am a student." },
        { imageWord: "professore", imageDescription: "a teacher writing on a classroom blackboard", question: "Sei professore?", questionTranslation: "Are you a teacher?", answer: "Sì, sono professore.", answerTranslation: "Yes, I am a teacher." },
        { imageWord: "medico", imageDescription: "a doctor in a white coat with a stethoscope around their neck", question: "Sei medico?", questionTranslation: "Are you a doctor?", answer: "Sì, sono medico.", answerTranslation: "Yes, I am a doctor." },
      ],
    },
    {
      heading: "Sono + aggettivo",
      noteInline: "Adjectives agree with gender: stanco (m) · stanca (f) · contento (m) · contenta (f)",
      pairs: [
        { imageWord: "stanco", imageDescription: "a person looking tired and yawning while sitting at a desk", question: "Sei stanco?", questionTranslation: "Are you tired?", answer: "Sì, sono stanco.", answerTranslation: "Yes, I am tired." },
        { imageWord: "contento", imageDescription: "a person smiling broadly and looking happy", question: "Sei contento?", questionTranslation: "Are you happy?", answer: "Sì, sono contento.", answerTranslation: "Yes, I am happy." },
        { imageWord: "pronto", imageDescription: "a person standing at the door ready to leave, coat and bag in hand", question: "Sei pronto?", questionTranslation: "Are you ready?", answer: "Sì, sono pronto.", answerTranslation: "Yes, I am ready." },
      ],
      sentenceColumns: [
        { label: "Soggetto", items: [{ text: "Sono", translation: "I am" }, { text: "Lui è", translation: "He is" }, { text: "Lei è", translation: "She is" }] },
        { label: "Attributo", items: [{ text: "americano.", translation: "American." }, { text: "studente.", translation: "a student." }, { text: "stanco.", translation: "tired." }, { text: "contento.", translation: "happy." }] },
      ],
    },
  ],
};

const ITALIAN_MI_PIACE: HayUnitContent = {
  chapterTitleKey: "mi piace",
  conceptLabel: "Mi piace",
  conceptDefinition: "I like · do you like? · ti piace?",
  introNote: "\"Piacere\" works backwards: the thing liked is the subject. One thing → mi piace. Many things → mi piacciono.",
  clusters: [
    {
      heading: "Mi piace — Frasi Modello",
      pairs: [
        { imageWord: "gelato", imageDescription: "a colorful Italian gelato cone on a sunny day", question: "Ti piace il gelato?", questionTranslation: "Do you like gelato?", answer: "Sì, mi piace il gelato.", answerTranslation: "Yes, I like gelato." },
        { imageWord: "musica", imageDescription: "a person listening to music with headphones and smiling", question: "Ti piace la musica?", questionTranslation: "Do you like music?", answer: "Sì, mi piace la musica.", answerTranslation: "Yes, I like music." },
        { imageWord: "sport", imageDescription: "a person playing soccer on a sunny Italian field", question: "Ti piace lo sport?", questionTranslation: "Do you like sports?", answer: "Sì, mi piace lo sport.", answerTranslation: "Yes, I like sports." },
        { imageWord: "cucina", imageDescription: "a rustic Italian kitchen with food being prepared", question: "Ti piace cucinare?", questionTranslation: "Do you like cooking?", answer: "Sì, mi piace cucinare.", answerTranslation: "Yes, I like cooking." },
      ],
    },
    {
      heading: "Mi piacciono — Al Plurale",
      noteInline: "one thing → mi piace · many things → mi piacciono · the noun controls the form",
      pairs: [
        { imageWord: "libri", imageDescription: "a stack of colorful books on a wooden shelf", question: "Ti piacciono i libri?", questionTranslation: "Do you like books?", answer: "Sì, mi piacciono i libri.", answerTranslation: "Yes, I like books." },
        { imageWord: "film", imageDescription: "a person watching a movie in a darkened cinema", question: "Ti piacciono i film?", questionTranslation: "Do you like films?", answer: "Sì, mi piacciono i film.", answerTranslation: "Yes, I like films." },
        { imageWord: "pasta", imageDescription: "several colorful types of pasta displayed together", question: "Ti piacciono le paste?", questionTranslation: "Do you like pasta dishes?", answer: "Sì, mi piacciono le paste.", answerTranslation: "Yes, I like pasta dishes." },
      ],
      sentenceColumns: [
        { label: "Pronome", items: [{ text: "Mi piace", translation: "I like (one thing)" }, { text: "Mi piacciono", translation: "I like (many things)" }, { text: "Non mi piace", translation: "I don't like (one thing)" }, { text: "Non mi piacciono", translation: "I don't like (many things)" }] },
        { label: "Oggetto", items: [{ text: "il gelato.", translation: "gelato." }, { text: "la musica.", translation: "music." }, { text: "i libri.", translation: "books." }, { text: "i film.", translation: "films." }] },
      ],
    },
  ],
};

const ITALIAN_CE: HayUnitContent = {
  chapterTitleKey: "c'è",
  conceptLabel: "C'è / Ci sono",
  conceptDefinition: "there is / there are · is there? · c'è?",
  introNote: "\"C'è\" and \"ci sono\" describe what exists in a space. One thing: c'è. Many things: ci sono.",
  clusters: [
    {
      heading: "C'è — There Is",
      pairs: [
        { imageWord: "bar", imageDescription: "an Italian bar counter with a barista serving espresso", question: "C'è un bar qui vicino?", questionTranslation: "Is there a bar nearby?", answer: "Sì, c'è un bar all'angolo.", answerTranslation: "Yes, there is a bar on the corner." },
        { imageWord: "problema", imageDescription: "a person looking frustrated in front of a stalled car", question: "C'è un problema?", questionTranslation: "Is there a problem?", answer: "Sì, c'è un piccolo problema.", answerTranslation: "Yes, there is a small problem." },
        { imageWord: "posta", imageDescription: "a post office building exterior on a quiet Italian street", question: "C'è una posta qui vicino?", questionTranslation: "Is there a post office nearby?", answer: "Sì, c'è una posta in centro.", answerTranslation: "Yes, there is a post office downtown." },
        { imageWord: "treno", imageDescription: "a train arriving at an Italian station platform", question: "C'è un treno per Roma?", questionTranslation: "Is there a train to Rome?", answer: "Sì, c'è un treno alle 14:00.", answerTranslation: "Yes, there is a train at 2:00 PM." },
      ],
    },
    {
      heading: "Ci sono — There Are",
      noteInline: "c'è = there is (singular) · ci sono = there are (plural) · non c'è = there isn't · non ci sono = there aren't",
      pairs: [
        { imageWord: "studenti", imageDescription: "a group of students sitting in a university classroom", question: "Ci sono molti studenti in classe?", questionTranslation: "Are there many students in class?", answer: "Sì, ci sono venti studenti.", answerTranslation: "Yes, there are twenty students." },
        { imageWord: "negozi", imageDescription: "a busy Italian shopping street with many stores open", question: "Ci sono negozi vicino?", questionTranslation: "Are there shops nearby?", answer: "Sì, ci sono molti negozi.", answerTranslation: "Yes, there are many shops." },
      ],
      sentenceColumns: [
        { label: "Espressione", items: [{ text: "C'è", translation: "There is" }, { text: "Ci sono", translation: "There are" }, { text: "Non c'è", translation: "There isn't" }, { text: "Non ci sono", translation: "There aren't" }] },
        { label: "Luogo / Quantità", items: [{ text: "un bar.", translation: "a bar." }, { text: "una farmacia.", translation: "a pharmacy." }, { text: "molti studenti.", translation: "many students." }, { text: "abbastanza tempo.", translation: "enough time." }] },
      ],
    },
  ],
};

const ITALIAN_POSSO: HayUnitContent = {
  chapterTitleKey: "posso",
  conceptLabel: "Posso",
  conceptDefinition: "I can · can you? · puoi?",
  introNote: "\"Posso\" opens the door to expressing ability and permission. Drop it in front of any infinitive.",
  clusters: [
    {
      heading: "Posso — Frasi Modello",
      pairs: [
        { imageWord: "parlare", imageDescription: "a person speaking confidently to a small group", question: "Puoi parlare italiano?", questionTranslation: "Can you speak Italian?", answer: "Sì, posso parlare un po'.", answerTranslation: "Yes, I can speak a little." },
        { imageWord: "aiutare", imageDescription: "a person helping a friend carry a heavy box", question: "Puoi aiutarmi?", questionTranslation: "Can you help me?", answer: "Sì, posso aiutarti.", answerTranslation: "Yes, I can help you." },
        { imageWord: "venire", imageDescription: "a person waving and walking toward the camera to join a group", question: "Puoi venire domani?", questionTranslation: "Can you come tomorrow?", answer: "Sì, posso venire.", answerTranslation: "Yes, I can come." },
        { imageWord: "guidare", imageDescription: "a person confidently sitting in the driver's seat of a car", question: "Sai guidare?", questionTranslation: "Do you know how to drive?", answer: "Sì, posso guidare.", answerTranslation: "Yes, I can drive." },
      ],
    },
    {
      heading: "Non posso — I Can't",
      noteInline: "non posso + infinitive = I cannot · non posso is extremely useful for polite refusals",
      pairs: [
        { imageWord: "aspettare", imageDescription: "a person looking at their watch impatiently at a bus stop", question: "Puoi aspettare un momento?", questionTranslation: "Can you wait a moment?", answer: "Mi dispiace, non posso aspettare.", answerTranslation: "I'm sorry, I cannot wait." },
        { imageWord: "uscire", imageDescription: "a person looking out the window at rain, unable to go out", question: "Puoi uscire stasera?", questionTranslation: "Can you go out tonight?", answer: "No, non posso uscire.", answerTranslation: "No, I cannot go out." },
      ],
      sentenceColumns: [
        { label: "Soggetto", items: [{ text: "Posso", translation: "I can" }, { text: "Lui può", translation: "He can" }, { text: "Lei può", translation: "She can" }, { text: "Non posso", translation: "I cannot" }] },
        { label: "Infinito", items: [{ text: "parlare.", translation: "speak." }, { text: "venire.", translation: "come." }, { text: "aiutare.", translation: "help." }, { text: "aspettare.", translation: "wait." }] },
      ],
    },
  ],
};

// ── Italian passato prossimo / preterite chain units ──────────────────────────

const ITALIAN_DOVE_SONO: HayUnitContent = {
  chapterTitleKey: "dove sono",
  conceptLabel: "Dove sono?",
  conceptDefinition: "Where am I? · Where is she? · Dov'è?",
  introNote: "Italian uses essere for location — the same verb for identity also places you in space. Sono a casa. È al lavoro.",
  clusters: [
    {
      heading: "Essere — Luoghi",
      pairs: [
        { imageWord: "casa", imageDescription: "the cozy interior of an Italian home with warm lighting", question: "Dove sei?", questionTranslation: "Where are you?", answer: "Sono a casa.", answerTranslation: "I am at home." },
        { imageWord: "scuola", imageDescription: "the exterior of an Italian school building", question: "Dove sei di solito al mattino?", questionTranslation: "Where are you usually in the morning?", answer: "Sono a scuola.", answerTranslation: "I am at school." },
        { imageWord: "ufficio", imageDescription: "a bright modern office with desks and computers", question: "Dov'è tuo padre?", questionTranslation: "Where is your father?", answer: "È in ufficio.", answerTranslation: "He is at the office." },
        { imageWord: "centro", imageDescription: "a busy Italian city center with piazza and pedestrians", question: "Dove siete?", questionTranslation: "Where are you all?", answer: "Siamo in centro.", answerTranslation: "We are downtown." },
      ],
    },
    {
      heading: "In / Al / Alla — Location Prepositions",
      noteInline: "al = at the (masc) · alla = at the (fem) · in = in/at (countries, rooms, open spaces)",
      pairs: [
        { imageWord: "biblioteca", imageDescription: "a student reading quietly inside a university library", question: "È in biblioteca?", questionTranslation: "Is she at the library?", answer: "Sì, è in biblioteca.", answerTranslation: "Yes, she is at the library." },
        { imageWord: "palestra", imageDescription: "a person working out at a gym", question: "È in palestra adesso?", questionTranslation: "Is he at the gym right now?", answer: "Sì, è in palestra.", answerTranslation: "Yes, he is at the gym." },
      ],
      sentenceColumns: [
        { label: "Soggetto", items: [{ text: "Sono", translation: "I am" }, { text: "È", translation: "He/She is" }, { text: "Siamo", translation: "We are" }] },
        { label: "Luogo", items: [{ text: "a casa.", translation: "at home." }, { text: "a scuola.", translation: "at school." }, { text: "al lavoro.", translation: "at work." }, { text: "in centro.", translation: "downtown." }, { text: "in Italia.", translation: "in Italy." }] },
      ],
    },
  ],
};

const ITALIAN_HO_PRESO: HayUnitContent = {
  chapterTitleKey: "ho preso",
  conceptLabel: "Ho preso",
  conceptDefinition: "I took / I had · she/he took · ha preso",
  introNote: "The passato prossimo: ho + participio. Prendere → preso is irregular. This is your first passato prossimo form — the gateway to Italian past tense.",
  clusters: [
    {
      heading: "Ho preso — Al Passato",
      pairs: [
        { imageWord: "caffè", imageDescription: "a person picking up an espresso cup at a bar counter", question: "Hai preso un caffè stamattina?", questionTranslation: "Did you have a coffee this morning?", answer: "Sì, ho preso un caffè.", answerTranslation: "Yes, I had a coffee." },
        { imageWord: "autobus", imageDescription: "a person boarding a city bus at a stop", question: "Hai preso l'autobus?", questionTranslation: "Did you take the bus?", answer: "Sì, ho preso l'autobus.", answerTranslation: "Yes, I took the bus." },
        { imageWord: "appunti", imageDescription: "a student taking notes in a lecture with pen and paper", question: "Hai preso appunti in classe?", questionTranslation: "Did you take notes in class?", answer: "Sì, ho preso molti appunti.", answerTranslation: "Yes, I took many notes." },
        { imageWord: "biglietto", imageDescription: "a person holding a train ticket at a station", question: "Hai preso il biglietto?", questionTranslation: "Did you get the ticket?", answer: "Sì, ho preso il biglietto.", answerTranslation: "Yes, I got the ticket." },
      ],
    },
    {
      heading: "Ha preso — Terza Persona",
      noteInline: "ho preso = I took · ha preso = he/she took · avere (ho/hai/ha) + participio passato",
      pairs: [
        { imageWord: "medicina", imageDescription: "a person taking medicine with a glass of water", question: "Ha preso la medicina?", questionTranslation: "Did she take the medicine?", answer: "Sì, ha preso la medicina.", answerTranslation: "Yes, she took the medicine." },
        { imageWord: "treno", imageDescription: "a person running to catch a departing train at a platform", question: "Ha preso il treno?", questionTranslation: "Did he catch the train?", answer: "Sì, ha preso il treno per Roma.", answerTranslation: "Yes, he took the train to Rome." },
      ],
      sentenceColumns: [
        { label: "Ausiliare", items: [{ text: "Ho preso", translation: "I took / I had" }, { text: "Hai preso", translation: "You took / You had" }, { text: "Ha preso", translation: "He/She took / had" }, { text: "Non ho preso", translation: "I did not take" }] },
        { label: "Oggetto", items: [{ text: "un caffè.", translation: "a coffee." }, { text: "l'autobus.", translation: "the bus." }, { text: "il treno.", translation: "the train." }, { text: "appunti.", translation: "notes." }] },
      ],
    },
  ],
};

const ITALIAN_HO_COMPRATO: HayUnitContent = {
  chapterTitleKey: "ho comprato",
  conceptLabel: "Ho comprato",
  conceptDefinition: "I bought · she/he bought · ha comprato · -are → -ato",
  introNote: "Comprare → comprato is the regular -are pattern. Drop -are, add -ato. This one formula unlocks hundreds of Italian verbs in the past tense.",
  clusters: [
    {
      heading: "Ho comprato — Al Passato",
      pairs: [
        { imageWord: "pane", imageDescription: "a person walking out of a bakery holding a fresh loaf of bread", question: "Hai comprato il pane?", questionTranslation: "Did you buy the bread?", answer: "Sì, ho comprato il pane.", answerTranslation: "Yes, I bought the bread." },
        { imageWord: "scarpe", imageDescription: "a shopping bag with a pair of new shoes visible inside", question: "Hai comprato le scarpe?", questionTranslation: "Did you buy the shoes?", answer: "Sì, ho comprato le scarpe nuove.", answerTranslation: "Yes, I bought the new shoes." },
        { imageWord: "regalo", imageDescription: "a person handing over a wrapped gift to someone smiling", question: "Hai comprato un regalo?", questionTranslation: "Did you buy a gift?", answer: "Sì, ho comprato un regalo per lei.", answerTranslation: "Yes, I bought a gift for her." },
        { imageWord: "biglietto", imageDescription: "a movie ticket stub and popcorn on a cinema counter", question: "Hai comprato i biglietti?", questionTranslation: "Did you buy the tickets?", answer: "Sì, ho comprato i biglietti online.", answerTranslation: "Yes, I bought the tickets online." },
      ],
    },
    {
      heading: "Il Pattern -ato — Tutti i Verbi -are",
      noteInline: "comprare→comprato · parlare→parlato · mangiare→mangiato · studiare→studiato · lavorare→lavorato",
      pairs: [
        { imageWord: "telefono", imageDescription: "a person looking at a brand new smartphone just unboxed", question: "Ha comprato un telefono nuovo?", questionTranslation: "Did she buy a new phone?", answer: "Sì, ha comprato un telefono nuovo.", answerTranslation: "Yes, she bought a new phone." },
        { imageWord: "frutta", imageDescription: "a person at a fruit market choosing fresh produce", question: "Ha comprato della frutta?", questionTranslation: "Did he buy some fruit?", answer: "Sì, ha comprato della frutta fresca.", answerTranslation: "Yes, he bought some fresh fruit." },
      ],
      sentenceColumns: [
        { label: "Ausiliare", items: [{ text: "Ho comprato", translation: "I bought" }, { text: "Ho parlato", translation: "I spoke" }, { text: "Ho mangiato", translation: "I ate" }, { text: "Ha comprato", translation: "He/She bought" }] },
        { label: "Oggetto", items: [{ text: "il pane.", translation: "the bread." }, { text: "le scarpe.", translation: "the shoes." }, { text: "un regalo.", translation: "a gift." }, { text: "al telefono.", translation: "on the phone." }] },
      ],
    },
  ],
};

const ITALIAN_MI_PIACEREBBE: HayUnitContent = {
  chapterTitleKey: "mi piacerebbe",
  conceptLabel: "Mi piacerebbe / Vorrei",
  conceptDefinition: "I would like · polite conditional · vorrei + noun · mi piacerebbe + infinitive",
  introNote: "The Italian conditional is essential for polite interaction. \"Vorrei\" orders at a restaurant. \"Mi piacerebbe\" expresses wishes. Both are extremely high-frequency.",
  clusters: [
    {
      heading: "Vorrei — Al Ristorante e Nei Negozi",
      pairs: [
        { imageWord: "caffè", imageDescription: "a barista handing an espresso to a customer at an Italian bar", question: "Cosa vorrebbe?", questionTranslation: "What would you like?", answer: "Vorrei un caffè, per favore.", answerTranslation: "I would like a coffee, please." },
        { imageWord: "tavolo", imageDescription: "an empty table set for dinner in an Italian restaurant", question: "Vorrebbe un tavolo per due?", questionTranslation: "Would you like a table for two?", answer: "Sì, vorrei un tavolo per due.", answerTranslation: "Yes, I would like a table for two." },
        { imageWord: "informazione", imageDescription: "a person at a tourist information desk in a city", question: "Vorrebbe delle informazioni?", questionTranslation: "Would you like some information?", answer: "Sì, vorrei delle informazioni sul museo.", answerTranslation: "Yes, I would like some information about the museum." },
        { imageWord: "prenotazione", imageDescription: "a person making a phone reservation at a hotel front desk", question: "Vorrebbe fare una prenotazione?", questionTranslation: "Would you like to make a reservation?", answer: "Sì, vorrei fare una prenotazione.", answerTranslation: "Yes, I would like to make a reservation." },
      ],
    },
    {
      heading: "Mi piacerebbe — Desideri e Sogni",
      noteInline: "mi piacerebbe + infinitive = I would like to … · vorrebbe + noun (ordering) vs mi piacerebbe + infinitive (wishing)",
      pairs: [
        { imageWord: "Italia", imageDescription: "a stunning view of the Amalfi Coast with colorful villages on cliffs", question: "Le piacerebbe visitare l'Italia?", questionTranslation: "Would you like to visit Italy?", answer: "Sì, mi piacerebbe molto visitare l'Italia.", answerTranslation: "Yes, I would love to visit Italy." },
        { imageWord: "imparare", imageDescription: "a person absorbed in learning something new, looking excited", question: "Le piacerebbe imparare a cucinare?", questionTranslation: "Would you like to learn to cook?", answer: "Sì, mi piacerebbe imparare a cucinare.", answerTranslation: "Yes, I would like to learn to cook." },
      ],
      sentenceColumns: [
        { label: "Espressione", items: [{ text: "Vorrei", translation: "I would like" }, { text: "Mi piacerebbe", translation: "I would like to" }, { text: "Vorrebbe", translation: "He/She would like" }] },
        { label: "Oggetto / Infinito", items: [{ text: "un caffè.", translation: "a coffee." }, { text: "viaggiare.", translation: "to travel." }, { text: "imparare.", translation: "to learn." }, { text: "una prenotazione.", translation: "a reservation." }] },
      ],
    },
  ],
};

const ITALIAN_SONO_ANDATO: HayUnitContent = {
  chapterTitleKey: "sono andato",
  conceptLabel: "Sono andato/a",
  conceptDefinition: "I went · she went · è andata · essere verbs + gender agreement",
  introNote: "Andare takes essere, not avere, in the passato prossimo. And the past participle changes to match the subject's gender: andato (m) / andata (f).",
  clusters: [
    {
      heading: "Sono andato/a — Al Passato",
      pairs: [
        { imageWord: "cinema", imageDescription: "a person walking into a cinema at night", question: "Sei andato al cinema ieri sera?", questionTranslation: "Did you go to the cinema last night?", answer: "Sì, sono andato al cinema.", answerTranslation: "Yes, I went to the cinema." },
        { imageWord: "spiaggia", imageDescription: "footprints in the sand leading toward the ocean on a sunny day", question: "Sei andata alla spiaggia?", questionTranslation: "Did you go to the beach?", answer: "Sì, sono andata alla spiaggia.", answerTranslation: "Yes, I went to the beach." },
        { imageWord: "Roma", imageDescription: "the Colosseum in Rome on a bright day with tourists", question: "Sei andato a Roma?", questionTranslation: "Did you go to Rome?", answer: "Sì, sono andato a Roma la scorsa estate.", answerTranslation: "Yes, I went to Rome last summer." },
        { imageWord: "medico", imageDescription: "a person sitting in a doctor's waiting room", question: "È andata dal medico?", questionTranslation: "Did she go to the doctor?", answer: "Sì, è andata dal medico ieri.", answerTranslation: "Yes, she went to the doctor yesterday." },
      ],
    },
    {
      heading: "Accordo del Participio — Essere Verbs",
      noteInline: "essere verbs: andare · venire · uscire · partire · arrivare · all take essere · participio agrees with subject",
      pairs: [
        { imageWord: "partenza", imageDescription: "a person waving goodbye at an airport departure gate", question: "È partito stamattina?", questionTranslation: "Did he leave this morning?", answer: "Sì, è partito con il volo delle sette.", answerTranslation: "Yes, he left on the seven o'clock flight." },
        { imageWord: "arrivo", imageDescription: "a person arriving home with a suitcase looking happy", question: "È arrivata tua sorella?", questionTranslation: "Did your sister arrive?", answer: "Sì, è arrivata ieri sera.", answerTranslation: "Yes, she arrived last night." },
      ],
      sentenceColumns: [
        { label: "Soggetto", items: [{ text: "Sono andato (m)", translation: "I went (male)" }, { text: "Sono andata (f)", translation: "I went (female)" }, { text: "È andato", translation: "He went" }, { text: "È andata", translation: "She went" }] },
        { label: "Destinazione", items: [{ text: "al cinema.", translation: "to the cinema." }, { text: "a Roma.", translation: "to Rome." }, { text: "alla spiaggia.", translation: "to the beach." }, { text: "dal medico.", translation: "to the doctor." }] },
      ],
    },
  ],
};

// ── Portuguese present-tense verb units ───────────────────────────────────────

const PORTUGUESE_VOU: HayUnitContent = {
  chapterTitleKey: 'onde vai',
  conceptLabel: 'Vou',
  conceptDefinition: 'I am going · where are you going? · onde vai?',
  introNote: '"Vou" drops you anywhere — add a destination or an infinitive and the thought is complete.',
  clusters: [
    {
      heading: 'Vou — Destinos',
      pairs: [
        { imageWord: 'cinema', imageDescription: 'a cinema marquee lit up at night on a Portuguese street', question: 'Vai ao cinema?', questionTranslation: 'Are you going to the cinema?', answer: 'Sim, vou ao cinema.', answerTranslation: 'Yes, I am going to the cinema.' },
        { imageWord: 'banco', imageDescription: 'a bank building exterior on a busy Portuguese street', question: 'Vai ao banco?', questionTranslation: 'Are you going to the bank?', answer: 'Sim, vou ao banco.', answerTranslation: 'Yes, I am going to the bank.' },
        { imageWord: 'praia', imageDescription: 'a sunny Portuguese Atlantic beach with white sand', question: 'Vai à praia?', questionTranslation: 'Are you going to the beach?', answer: 'Sim, vou à praia.', answerTranslation: 'Yes, I am going to the beach.' },
        { imageWord: 'mercado', imageDescription: 'a traditional Portuguese market with fresh produce stalls', question: 'Vai ao mercado?', questionTranslation: 'Are you going to the market?', answer: 'Sim, vou ao mercado.', answerTranslation: 'Yes, I am going to the market.' },
      ],
    },
    {
      heading: 'Vou + infinitivo — Futuro Imediato',
      noteInline: 'vou + infinitive = I am going to … · ao = a + o (masc) · à = a + a (fem)',
      pairs: [
        { imageWord: 'comer', imageDescription: 'a person sitting down to eat a full Portuguese meal', question: 'Vai comer agora?', questionTranslation: 'Are you going to eat now?', answer: 'Sim, vou comer agora.', answerTranslation: 'Yes, I am going to eat now.' },
        { imageWord: 'estudar', imageDescription: 'a student studying at a desk with books and a laptop', question: 'Vai estudar hoje à noite?', questionTranslation: 'Are you going to study tonight?', answer: 'Sim, vou estudar.', answerTranslation: 'Yes, I am going to study.' },
        { imageWord: 'trabalhar', imageDescription: 'a person heading out the door in work attire with a bag', question: 'Vai trabalhar amanhã?', questionTranslation: 'Are you going to work tomorrow?', answer: 'Sim, vou trabalhar.', answerTranslation: 'Yes, I am going to work.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Vou', translation: 'I am going' }, { text: 'Ela vai', translation: 'She is going' }, { text: 'Vamos', translation: 'We are going' }] },
        { label: 'Destino / Infinitivo', items: [{ text: 'ao cinema.', translation: 'to the cinema.' }, { text: 'à escola.', translation: 'to school.' }, { text: 'comer.', translation: 'to eat.' }, { text: 'estudar.', translation: 'to study.' }] },
      ],
    },
  ],
};

const PORTUGUESE_PEGUEI: HayUnitContent = {
  chapterTitleKey: 'peguei',
  conceptLabel: 'Peguei',
  conceptDefinition: 'I took / I caught · she took · ela pegou',
  introNote: '"Peguei" is your first Portuguese preterite — the -ei ending is the signature of 1st-person -ar past. Notice the u in peguei: it keeps the g hard.',
  clusters: [
    {
      heading: 'Peguei — No Passado',
      pairs: [
        { imageWord: 'ônibus', imageDescription: 'a person boarding a city bus at a stop in São Paulo', question: 'Pegou o ônibus hoje?', questionTranslation: 'Did you take the bus today?', answer: 'Sim, peguei o ônibus.', answerTranslation: 'Yes, I took the bus.' },
        { imageWord: 'táxi', imageDescription: 'a yellow taxi cab pulling up to a curb in a Brazilian city', question: 'Pegou um táxi?', questionTranslation: 'Did you take a taxi?', answer: 'Sim, peguei um táxi.', answerTranslation: 'Yes, I took a taxi.' },
        { imageWord: 'guarda-chuva', imageDescription: 'a person picking up an umbrella before leaving the house on a rainy day', question: 'Pegou o guarda-chuva?', questionTranslation: 'Did you grab the umbrella?', answer: 'Sim, peguei o guarda-chuva.', answerTranslation: 'Yes, I grabbed the umbrella.' },
        { imageWord: 'bilhete', imageDescription: 'a person holding a bus ticket or transit card', question: 'Ela pegou o bilhete?', questionTranslation: 'Did she get the ticket?', answer: 'Sim, ela pegou o bilhete.', answerTranslation: 'Yes, she got the ticket.' },
      ],
    },
    {
      heading: 'Peguei / Ela pegou — O Padrão',
      noteInline: '-ar preterite: peguei (eu) · pegou (ela/ele) · the spelling change: peg + ei = peguei (u keeps g hard)',
      pairs: [
        { imageWord: 'resfriado', imageDescription: 'a person sneezing into a tissue, visibly sick', question: 'Ela pegou um resfriado?', questionTranslation: 'Did she catch a cold?', answer: 'Sim, ela pegou um resfriado.', answerTranslation: 'Yes, she caught a cold.' },
        { imageWord: 'trem', imageDescription: 'a commuter train arriving at a station platform in Brazil', question: 'Pegou o trem certo?', questionTranslation: 'Did you catch the right train?', answer: 'Sim, peguei o trem certo.', answerTranslation: 'Yes, I caught the right train.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Peguei', translation: 'I took/caught' }, { text: 'Ela pegou', translation: 'She took/caught' }, { text: 'Ele pegou', translation: 'He took/caught' }] },
        { label: 'Objeto', items: [{ text: 'o ônibus.', translation: 'the bus.' }, { text: 'um táxi.', translation: 'a taxi.' }, { text: 'o guarda-chuva.', translation: 'the umbrella.' }, { text: 'o bilhete.', translation: 'the ticket.' }] },
      ],
    },
  ],
};

const PORTUGUESE_COMPREI: HayUnitContent = {
  chapterTitleKey: 'comprei',
  conceptLabel: 'Comprei',
  conceptDefinition: 'I bought · she bought · ela comprou · -ar → -ei / -ou',
  introNote: '"Comprei" is the -ar preterite model. Master comprei/comprou and you unlock every regular -ar verb in the past tense.',
  clusters: [
    {
      heading: 'Comprei — No Passado',
      pairs: [
        { imageWord: 'pão', imageDescription: 'a person walking out of a padaria holding a fresh loaf of bread', question: 'Comprou o pão?', questionTranslation: 'Did you buy the bread?', answer: 'Sim, comprei o pão.', answerTranslation: 'Yes, I bought the bread.' },
        { imageWord: 'sapatos', imageDescription: 'a shopping bag with a new pair of shoes visible at the top', question: 'Comprou os sapatos?', questionTranslation: 'Did you buy the shoes?', answer: 'Sim, comprei os sapatos novos.', answerTranslation: 'Yes, I bought the new shoes.' },
        { imageWord: 'presente', imageDescription: 'a person handing a gift-wrapped box to a smiling friend', question: 'Comprou um presente?', questionTranslation: 'Did you buy a gift?', answer: 'Sim, comprei um presente para ela.', answerTranslation: 'Yes, I bought a gift for her.' },
        { imageWord: 'ingresso', imageDescription: 'a cinema ticket stub and a bag of popcorn on a counter', question: 'Comprou os ingressos?', questionTranslation: 'Did you buy the tickets?', answer: 'Sim, comprei os ingressos online.', answerTranslation: 'Yes, I bought the tickets online.' },
      ],
    },
    {
      heading: 'O Padrão -ei / -ou — Todos os Verbos -ar',
      noteInline: 'comprar→comprei/comprou · falar→falei/falou · trabalhar→trabalhei/trabalhou · viajar→viajei/viajou',
      pairs: [
        { imageWord: 'celular', imageDescription: 'a person unboxing a brand new smartphone with excitement', question: 'Ela comprou um celular novo?', questionTranslation: 'Did she buy a new phone?', answer: 'Sim, ela comprou um celular novo.', answerTranslation: 'Yes, she bought a new phone.' },
        { imageWord: 'frutas', imageDescription: 'a person at a feira livre choosing fresh tropical fruits', question: 'Ele comprou frutas?', questionTranslation: 'Did he buy fruit?', answer: 'Sim, ele comprou frutas frescas.', answerTranslation: 'Yes, he bought fresh fruit.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Comprei', translation: 'I bought' }, { text: 'Falei', translation: 'I spoke' }, { text: 'Trabalhei', translation: 'I worked' }, { text: 'Ela comprou', translation: 'She bought' }] },
        { label: 'Objeto', items: [{ text: 'o pão.', translation: 'the bread.' }, { text: 'os sapatos.', translation: 'the shoes.' }, { text: 'um presente.', translation: 'a gift.' }, { text: 'ao telefone.', translation: 'on the phone.' }] },
      ],
    },
  ],
};

const PORTUGUESE_TENHO: HayUnitContent = {
  chapterTitleKey: 'tenho / ter',
  conceptLabel: 'Tenho',
  conceptDefinition: 'I have · do you have? · você tem?',
  introNote: '"Ter" covers possession and body-state expressions. Tenho fome means "I am hungry" — literally "I have hunger." Same pattern as Spanish tener.',
  clusters: [
    {
      heading: 'Tenho — Posse',
      pairs: [
        { imageWord: 'livro', imageDescription: 'an open book on a wooden desk in a warm-lit room', question: 'Você tem um livro?', questionTranslation: 'Do you have a book?', answer: 'Sim, tenho um livro.', answerTranslation: 'Yes, I have a book.' },
        { imageWord: 'carro', imageDescription: 'a car parked on a Brazilian street in afternoon sun', question: 'Você tem carro?', questionTranslation: 'Do you have a car?', answer: 'Sim, tenho um carro.', answerTranslation: 'Yes, I have a car.' },
        { imageWord: 'gato', imageDescription: 'a cat sitting on a sunny windowsill indoors', question: 'Você tem um gato?', questionTranslation: 'Do you have a cat?', answer: 'Sim, tenho um gato.', answerTranslation: 'Yes, I have a cat.' },
        { imageWord: 'dinheiro', imageDescription: 'Brazilian reais banknotes and coins spread on a table', question: 'Você tem dinheiro?', questionTranslation: 'Do you have money?', answer: 'Sim, tenho algum dinheiro.', answerTranslation: 'Yes, I have some money.' },
      ],
    },
    {
      heading: 'Tenho fome · Tenho sede · Tenho…',
      noteInline: 'Portuguese uses ter (to have) where English uses to be: tenho fome = I am hungry · tenho sede = I am thirsty · tenho frio = I am cold',
      pairs: [
        { imageWord: 'fome', imageDescription: 'a person holding their stomach looking very hungry', question: 'Você tem fome?', questionTranslation: 'Are you hungry?', answer: 'Sim, tenho fome.', answerTranslation: 'Yes, I am hungry.' },
        { imageWord: 'sede', imageDescription: 'a person reaching for a glass of water looking very thirsty', question: 'Você tem sede?', questionTranslation: 'Are you thirsty?', answer: 'Sim, tenho sede.', answerTranslation: 'Yes, I am thirsty.' },
        { imageWord: 'pressa', imageDescription: 'a person checking their watch and hurrying down a street', question: 'Você tem pressa?', questionTranslation: 'Are you in a hurry?', answer: 'Sim, tenho muita pressa.', answerTranslation: 'Yes, I am in a great hurry.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Tenho', translation: 'I have' }, { text: 'Ela tem', translation: 'She has' }, { text: 'Ele tem', translation: 'He has' }] },
        { label: 'Objeto', items: [{ text: 'um livro.', translation: 'a book.' }, { text: 'fome.', translation: 'hunger (I\'m hungry).' }, { text: 'sede.', translation: 'thirst (I\'m thirsty).' }, { text: 'pressa.', translation: 'a hurry (I\'m in a hurry).' }] },
      ],
    },
  ],
};

const PORTUGUESE_QUERO: HayUnitContent = {
  chapterTitleKey: 'quero / querer',
  conceptLabel: 'Quero',
  conceptDefinition: 'I want · do you want? · você quer?',
  introNote: '"Quero" + infinitive is your all-purpose engine for expressing desire. Works exactly like Spanish quiero.',
  clusters: [
    {
      heading: 'Quero — Frases Modelo',
      pairs: [
        { imageWord: 'café', imageDescription: 'a steaming cup of Brazilian coffee (cafezinho) on a saucer', question: 'Você quer um café?', questionTranslation: 'Do you want a coffee?', answer: 'Sim, quero um café.', answerTranslation: 'Yes, I want a coffee.' },
        { imageWord: 'água', imageDescription: 'a glass of cold water on a restaurant table', question: 'Você quer água?', questionTranslation: 'Do you want water?', answer: 'Sim, quero água.', answerTranslation: 'Yes, I want water.' },
        { imageWord: 'pão', imageDescription: 'a fresh bread roll on a white plate at breakfast', question: 'Você quer pão?', questionTranslation: 'Do you want bread?', answer: 'Sim, quero pão.', answerTranslation: 'Yes, I want bread.' },
        { imageWord: 'maçã', imageDescription: 'a red apple on a clean white background', question: 'Você quer uma maçã?', questionTranslation: 'Do you want an apple?', answer: 'Sim, quero uma maçã.', answerTranslation: 'Yes, I want an apple.' },
      ],
    },
    {
      heading: 'Quero + infinitivo',
      noteInline: 'quero + infinitive = I want to … · quero comer, quero ir, quero aprender',
      pairs: [
        { imageWord: 'comer', imageDescription: 'a person sitting down at a table with a full meal ready', question: 'Você quer comer?', questionTranslation: 'Do you want to eat?', answer: 'Sim, quero comer.', answerTranslation: 'Yes, I want to eat.' },
        { imageWord: 'dormir', imageDescription: 'a person yawning and looking tired in the late afternoon', question: 'Você quer dormir?', questionTranslation: 'Do you want to sleep?', answer: 'Sim, quero dormir.', answerTranslation: 'Yes, I want to sleep.' },
        { imageWord: 'sair', imageDescription: 'a person walking out the front door of a house with a smile', question: 'Você quer sair?', questionTranslation: 'Do you want to go out?', answer: 'Sim, quero sair.', answerTranslation: 'Yes, I want to go out.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Quero', translation: 'I want' }, { text: 'Ela quer', translation: 'She wants' }, { text: 'Ele quer', translation: 'He wants' }] },
        { label: 'Objeto / Infinitivo', items: [{ text: 'um café.', translation: 'a coffee.' }, { text: 'água.', translation: 'water.' }, { text: 'comer.', translation: 'to eat.' }, { text: 'sair.', translation: 'to go out.' }] },
      ],
    },
  ],
};

const PORTUGUESE_SOU: HayUnitContent = {
  chapterTitleKey: 'ser: a natureza',
  conceptLabel: 'Sou',
  conceptDefinition: 'I am · are you? · você é?',
  introNote: '"Ser" is the verb of identity — nationality, profession, character. One verb, endless self-expression.',
  clusters: [
    {
      heading: 'Sou — Identidade',
      pairs: [
        { imageWord: 'americano', imageDescription: 'an American flag waving in the wind against a blue sky', question: 'Você é americano?', questionTranslation: 'Are you American?', answer: 'Sim, sou americano.', answerTranslation: 'Yes, I am American.' },
        { imageWord: 'estudante', imageDescription: 'a student sitting in a lecture hall with a notebook open', question: 'Você é estudante?', questionTranslation: 'Are you a student?', answer: 'Sim, sou estudante.', answerTranslation: 'Yes, I am a student.' },
        { imageWord: 'professor', imageDescription: 'a teacher writing on a classroom blackboard', question: 'Você é professor?', questionTranslation: 'Are you a teacher?', answer: 'Sim, sou professor.', answerTranslation: 'Yes, I am a teacher.' },
        { imageWord: 'médico', imageDescription: 'a doctor in a white coat with a stethoscope around their neck', question: 'Você é médico?', questionTranslation: 'Are you a doctor?', answer: 'Sim, sou médico.', answerTranslation: 'Yes, I am a doctor.' },
      ],
    },
    {
      heading: 'Sou + adjetivo',
      noteInline: 'Adjectives agree with gender: cansado (m) · cansada (f) · contente (invariable)',
      pairs: [
        { imageWord: 'cansado', imageDescription: 'a person slumped in a chair looking exhausted', question: 'Você está cansado?', questionTranslation: 'Are you tired?', answer: 'Sim, estou cansado.', answerTranslation: 'Yes, I am tired.' },
        { imageWord: 'feliz', imageDescription: 'a person smiling broadly in a sunny park', question: 'Você é feliz?', questionTranslation: 'Are you happy?', answer: 'Sim, sou muito feliz.', answerTranslation: 'Yes, I am very happy.' },
        { imageWord: 'pronto', imageDescription: 'a person standing at the door ready to leave with coat and bag', question: 'Você está pronto?', questionTranslation: 'Are you ready?', answer: 'Sim, estou pronto.', answerTranslation: 'Yes, I am ready.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Sou', translation: 'I am (identity)' }, { text: 'Ela é', translation: 'She is' }, { text: 'Estou', translation: 'I am (state)' }] },
        { label: 'Atributo', items: [{ text: 'americano.', translation: 'American.' }, { text: 'estudante.', translation: 'a student.' }, { text: 'cansado.', translation: 'tired (state).' }, { text: 'feliz.', translation: 'happy (nature).' }] },
      ],
    },
  ],
};

const PORTUGUESE_ESTOU: HayUnitContent = {
  chapterTitleKey: 'onde estou',
  conceptLabel: 'Estou / Onde estou?',
  conceptDefinition: 'Where am I? · Where is she? · Onde ela está?',
  introNote: 'Portuguese uses estar for location. The verb that expresses states also places you in space. Estou em casa. Ela está no trabalho.',
  clusters: [
    {
      heading: 'Estar — Lugares',
      pairs: [
        { imageWord: 'casa', imageDescription: 'the cozy interior of a Brazilian home with warm afternoon light', question: 'Onde você está?', questionTranslation: 'Where are you?', answer: 'Estou em casa.', answerTranslation: 'I am at home.' },
        { imageWord: 'escola', imageDescription: 'the exterior of a Brazilian school building with students outside', question: 'Onde você está de manhã?', questionTranslation: 'Where are you in the morning?', answer: 'Estou na escola.', answerTranslation: 'I am at school.' },
        { imageWord: 'escritório', imageDescription: 'a bright modern office with open desks and large windows', question: 'Onde está seu pai?', questionTranslation: 'Where is your father?', answer: 'Ele está no escritório.', answerTranslation: 'He is at the office.' },
        { imageWord: 'centro', imageDescription: 'a busy Brazilian city center with people and storefronts', question: 'Onde vocês estão?', questionTranslation: 'Where are you all?', answer: 'Estamos no centro.', answerTranslation: 'We are downtown.' },
      ],
    },
    {
      heading: 'Em / No / Na — Preposições de Lugar',
      noteInline: 'no = em + o (masc) · na = em + a (fem) · em = in/at with countries and open spaces',
      pairs: [
        { imageWord: 'biblioteca', imageDescription: 'a student reading quietly inside a university library', question: 'Ela está na biblioteca?', questionTranslation: 'Is she at the library?', answer: 'Sim, ela está na biblioteca.', answerTranslation: 'Yes, she is at the library.' },
        { imageWord: 'academia', imageDescription: 'a person working out with weights at a gym', question: 'Ele está na academia agora?', questionTranslation: 'Is he at the gym right now?', answer: 'Sim, ele está na academia.', answerTranslation: 'Yes, he is at the gym.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Estou', translation: 'I am' }, { text: 'Ela está', translation: 'She is' }, { text: 'Estamos', translation: 'We are' }] },
        { label: 'Lugar', items: [{ text: 'em casa.', translation: 'at home.' }, { text: 'na escola.', translation: 'at school.' }, { text: 'no trabalho.', translation: 'at work.' }, { text: 'no centro.', translation: 'downtown.' }, { text: 'no Brasil.', translation: 'in Brazil.' }] },
      ],
    },
  ],
};

const PORTUGUESE_POSSO: HayUnitContent = {
  chapterTitleKey: 'posso ir',
  conceptLabel: 'Posso',
  conceptDefinition: 'I can · can you? · você pode?',
  introNote: '"Posso" opens ability and permission. Drop it before any infinitive.',
  clusters: [
    {
      heading: 'Posso — Frases Modelo',
      pairs: [
        { imageWord: 'falar', imageDescription: 'a person speaking confidently to a small group outdoors', question: 'Você pode falar português?', questionTranslation: 'Can you speak Portuguese?', answer: 'Sim, posso falar um pouco.', answerTranslation: 'Yes, I can speak a little.' },
        { imageWord: 'ajudar', imageDescription: 'a person helping a friend carry a heavy box up stairs', question: 'Você pode me ajudar?', questionTranslation: 'Can you help me?', answer: 'Sim, posso te ajudar.', answerTranslation: 'Yes, I can help you.' },
        { imageWord: 'vir', imageDescription: 'a person waving and walking toward a group of friends', question: 'Você pode vir amanhã?', questionTranslation: 'Can you come tomorrow?', answer: 'Sim, posso vir.', answerTranslation: 'Yes, I can come.' },
        { imageWord: 'dirigir', imageDescription: 'a person sitting confidently in the driver\'s seat of a car', question: 'Você sabe dirigir?', questionTranslation: 'Can you drive?', answer: 'Sim, posso dirigir.', answerTranslation: 'Yes, I can drive.' },
      ],
    },
    {
      heading: 'Não posso — I Can\'t',
      noteInline: 'não posso + infinitive = I cannot · useful for polite refusals in Portuguese',
      pairs: [
        { imageWord: 'esperar', imageDescription: 'a person looking at their watch impatiently at a bus stop', question: 'Você pode esperar um momento?', questionTranslation: 'Can you wait a moment?', answer: 'Desculpe, não posso esperar.', answerTranslation: 'Sorry, I cannot wait.' },
        { imageWord: 'sair', imageDescription: 'a person looking out at rain through a window, unable to leave', question: 'Você pode sair hoje à noite?', questionTranslation: 'Can you go out tonight?', answer: 'Não, não posso sair.', answerTranslation: 'No, I cannot go out.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Posso', translation: 'I can' }, { text: 'Ela pode', translation: 'She can' }, { text: 'Ele pode', translation: 'He can' }, { text: 'Não posso', translation: 'I cannot' }] },
        { label: 'Infinitivo', items: [{ text: 'falar.', translation: 'speak.' }, { text: 'vir.', translation: 'come.' }, { text: 'ajudar.', translation: 'help.' }, { text: 'esperar.', translation: 'wait.' }] },
      ],
    },
  ],
};

// ── Portuguese passado / preterite chain units ────────────────────────────────

const PORTUGUESE_GOSTO: HayUnitContent = {
  chapterTitleKey: 'gosto / gosto de',
  conceptLabel: 'Gosto de',
  conceptDefinition: 'I like · do you like? · você gosta de?',
  introNote: '"Gostar" always needs "de" — it\'s not optional. Gosto de música. Not gosto música. The preposition is part of the verb.',
  clusters: [
    {
      heading: 'Gosto de — Frases Modelo',
      pairs: [
        { imageWord: 'futebol', imageDescription: 'a person cheering at a Brazilian soccer match in the stands', question: 'Você gosta de futebol?', questionTranslation: 'Do you like soccer?', answer: 'Sim, gosto muito de futebol.', answerTranslation: 'Yes, I really like soccer.' },
        { imageWord: 'música', imageDescription: 'a person listening to music with headphones and smiling', question: 'Você gosta de música?', questionTranslation: 'Do you like music?', answer: 'Sim, gosto de música.', answerTranslation: 'Yes, I like music.' },
        { imageWord: 'cozinhar', imageDescription: 'a person happily cooking in a kitchen with fresh ingredients', question: 'Você gosta de cozinhar?', questionTranslation: 'Do you like cooking?', answer: 'Sim, gosto muito de cozinhar.', answerTranslation: 'Yes, I really like cooking.' },
        { imageWord: 'viajar', imageDescription: 'a person with a backpack looking at a scenic coastal view', question: 'Você gosta de viajar?', questionTranslation: 'Do you like traveling?', answer: 'Sim, gosto de viajar.', answerTranslation: 'Yes, I like traveling.' },
      ],
    },
    {
      heading: 'Não gosto de — Negativo',
      noteInline: 'gosto de + noun or infinitive · não gosto de = I don\'t like · the de is ALWAYS required',
      pairs: [
        { imageWord: 'livros', imageDescription: 'a stack of colorful books on a library shelf', question: 'Você gosta de ler livros?', questionTranslation: 'Do you like reading books?', answer: 'Sim, gosto muito de ler.', answerTranslation: 'Yes, I really like reading.' },
        { imageWord: 'acordar cedo', imageDescription: 'a person reluctantly turning off an alarm clock very early in the morning', question: 'Você gosta de acordar cedo?', questionTranslation: 'Do you like waking up early?', answer: 'Não, não gosto de acordar cedo.', answerTranslation: 'No, I don\'t like waking up early.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Gosto de', translation: 'I like' }, { text: 'Não gosto de', translation: 'I don\'t like' }, { text: 'Ela gosta de', translation: 'She likes' }] },
        { label: 'Objeto / Infinitivo', items: [{ text: 'futebol.', translation: 'soccer.' }, { text: 'música.', translation: 'music.' }, { text: 'cozinhar.', translation: 'cooking.' }, { text: 'viajar.', translation: 'traveling.' }] },
      ],
    },
  ],
};

const PORTUGUESE_GOSTARIA: HayUnitContent = {
  chapterTitleKey: 'eu gostaria',
  conceptLabel: 'Gostaria / Queria',
  conceptDefinition: 'I would like · polite request · gostaria de + noun · queria + noun',
  introNote: 'Both "gostaria de" and "queria" mean "I would like" in Portuguese. Both are polite and extremely common.',
  clusters: [
    {
      heading: 'Queria / Gostaria — No Restaurante',
      pairs: [
        { imageWord: 'café', imageDescription: 'a barista handing a small cup of Brazilian coffee across a counter', question: 'O que você gostaria?', questionTranslation: 'What would you like?', answer: 'Queria um café, por favor.', answerTranslation: 'I would like a coffee, please.' },
        { imageWord: 'mesa', imageDescription: 'an empty table set for dinner in a Brazilian restaurant', question: 'Você gostaria de uma mesa para dois?', questionTranslation: 'Would you like a table for two?', answer: 'Sim, gostaria de uma mesa para dois.', answerTranslation: 'Yes, I would like a table for two.' },
        { imageWord: 'informação', imageDescription: 'a person at a tourist information desk in a city center', question: 'Você gostaria de mais informações?', questionTranslation: 'Would you like more information?', answer: 'Sim, gostaria de informações sobre o museu.', answerTranslation: 'Yes, I would like information about the museum.' },
        { imageWord: 'reserva', imageDescription: 'a person making a hotel reservation over the phone at a front desk', question: 'Você gostaria de fazer uma reserva?', questionTranslation: 'Would you like to make a reservation?', answer: 'Sim, gostaria de fazer uma reserva.', answerTranslation: 'Yes, I would like to make a reservation.' },
      ],
    },
    {
      heading: 'Gostaria de — Desejos e Sonhos',
      noteInline: 'queria + noun (ordering) · gostaria de + infinitive (wishing) · both are equally elegant',
      pairs: [
        { imageWord: 'Brasil', imageDescription: 'a stunning view of Rio de Janeiro with Sugarloaf Mountain', question: 'Você gostaria de visitar o Brasil?', questionTranslation: 'Would you like to visit Brazil?', answer: 'Sim, gostaria muito de visitar o Brasil.', answerTranslation: 'Yes, I would love to visit Brazil.' },
        { imageWord: 'aprender', imageDescription: 'a person absorbed in learning something new, looking excited and engaged', question: 'Você gostaria de aprender a cozinhar?', questionTranslation: 'Would you like to learn to cook?', answer: 'Sim, gostaria de aprender a cozinhar.', answerTranslation: 'Yes, I would like to learn to cook.' },
      ],
      sentenceColumns: [
        { label: 'Expressão', items: [{ text: 'Queria', translation: 'I would like (common)' }, { text: 'Gostaria de', translation: 'I would like (formal)' }, { text: 'Ela gostaria de', translation: 'She would like' }] },
        { label: 'Objeto / Infinitivo', items: [{ text: 'um café.', translation: 'a coffee.' }, { text: 'viajar.', translation: 'to travel.' }, { text: 'aprender.', translation: 'to learn.' }, { text: 'uma reserva.', translation: 'a reservation.' }] },
      ],
    },
  ],
};

const PORTUGUESE_FUI: HayUnitContent = {
  chapterTitleKey: 'fui — ir no passado',
  conceptLabel: 'Fui',
  conceptDefinition: 'I went · she went · ela foi · totally irregular preterite',
  introNote: '"Ir" drops its stem entirely in the preterite — fui, foi. Same as Spanish: voy → fui. If you know Spanish, this is already familiar.',
  clusters: [
    {
      heading: 'Fui — No Passado',
      pairs: [
        { imageWord: 'cinema', imageDescription: 'a person walking into a cinema at night under bright lights', question: 'Você foi ao cinema ontem à noite?', questionTranslation: 'Did you go to the cinema last night?', answer: 'Sim, fui ao cinema.', answerTranslation: 'Yes, I went to the cinema.' },
        { imageWord: 'praia', imageDescription: 'footprints in the sand leading toward the ocean on a sunny day', question: 'Você foi à praia?', questionTranslation: 'Did you go to the beach?', answer: 'Sim, fui à praia no fim de semana.', answerTranslation: 'Yes, I went to the beach on the weekend.' },
        { imageWord: 'Brasil', imageDescription: 'a colorful view of a Brazilian city skyline with the ocean in the background', question: 'Você foi ao Brasil?', questionTranslation: 'Did you go to Brazil?', answer: 'Sim, fui ao Brasil no verão passado.', answerTranslation: 'Yes, I went to Brazil last summer.' },
        { imageWord: 'médico', imageDescription: 'a person sitting in a doctor\'s waiting room reading a magazine', question: 'Ela foi ao médico?', questionTranslation: 'Did she go to the doctor?', answer: 'Sim, ela foi ao médico ontem.', answerTranslation: 'Yes, she went to the doctor yesterday.' },
      ],
    },
    {
      heading: 'Fui / Ela foi — O Verbo Ir no Pretérito',
      noteInline: 'fui (I went) · foi (she/he went) · fomos (we went) · foram (they went) · ao = a + o · à = a + a',
      pairs: [
        { imageWord: 'viagem', imageDescription: 'a person waving goodbye at an airport departure gate with a suitcase', question: 'Ele foi ao aeroporto cedo?', questionTranslation: 'Did he go to the airport early?', answer: 'Sim, ele foi muito cedo.', answerTranslation: 'Yes, he went very early.' },
        { imageWord: 'chegada', imageDescription: 'a person arriving home after a long trip, looking happy', question: 'Sua irmã foi a Lisboa?', questionTranslation: 'Did your sister go to Lisbon?', answer: 'Sim, ela foi a Lisboa em junho.', answerTranslation: 'Yes, she went to Lisbon in June.' },
      ],
      sentenceColumns: [
        { label: 'Sujeito', items: [{ text: 'Fui', translation: 'I went' }, { text: 'Ela foi', translation: 'She went' }, { text: 'Ele foi', translation: 'He went' }, { text: 'Fomos', translation: 'We went' }] },
        { label: 'Destino', items: [{ text: 'ao cinema.', translation: 'to the cinema.' }, { text: 'ao Brasil.', translation: 'to Brazil.' }, { text: 'à praia.', translation: 'to the beach.' }, { text: 'ao médico.', translation: 'to the doctor.' }] },
      ],
    },
  ],
};

const HAY_UNITS: HayUnitContent[] = [
  PUEDO_IR,
  HAY_CHAPTER,
  // ── French present-tense verb units ─────────────────────────────────────────
  FRENCH_VOULOIR,
  FRENCH_AVOIR,
  FRENCH_ALLER,
  FRENCH_ETRE,
  FRENCH_AIMER,
  FRENCH_IL_Y_A,
  FRENCH_POUVOIR,
  // ── French passé composé / preterite chain units ─────────────────────────────
  FRENCH_OU_SUIS_JE,
  FRENCH_JAI_PRIS,
  FRENCH_JAI_ACHETE,
  FRENCH_JE_VOUDRAIS,
  FRENCH_JE_SUIS_ALLE,
  FRENCH_IL_VA,
  FRENCH_QU_EST_CE_QU_IL_A_FAIT,
  FRENCH_IL_A_EU,
  FRENCH_LUI,
  FRENCH_CEST_PROPRE,
  FRENCH_JAI_ETUDIE,
  FRENCH_JAI_RECU,
  FRENCH_FUTUR_PROCHE,
  // ── Italian present-tense verb units ─────────────────────────────────────────
  ITALIAN_VOGLIO,
  ITALIAN_HO,
  ITALIAN_VADO,
  ITALIAN_SONO,
  ITALIAN_MI_PIACE,
  ITALIAN_CE,
  ITALIAN_POSSO,
  // ── Italian passato prossimo / preterite chain units ──────────────────────────
  ITALIAN_DOVE_SONO,
  ITALIAN_HO_PRESO,
  ITALIAN_HO_COMPRATO,
  ITALIAN_MI_PIACEREBBE,
  ITALIAN_SONO_ANDATO,
  // ── Portuguese present-tense verb units ──────────────────────────────────────
  PORTUGUESE_VOU,
  PORTUGUESE_PEGUEI,
  PORTUGUESE_COMPREI,
  PORTUGUESE_TENHO,
  PORTUGUESE_QUERO,
  PORTUGUESE_SOU,
  PORTUGUESE_ESTOU,
  PORTUGUESE_POSSO,
  // ── Portuguese passado / preterite chain units ────────────────────────────────
  PORTUGUESE_GOSTO,
  PORTUGUESE_GOSTARIA,
  PORTUGUESE_FUI,
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
// Used for the "gustar" family chapters (p. 94–101).

/** One vocabulary cluster in a gustar-style lesson.
 *  Extends HayVocabCluster with an optional grammar-rule callout and negative examples. */
export interface GustVocabCluster extends HayVocabCluster {
  /** Rule callout displayed after the cards, e.g. singular vs plural contrast */
  grammarRule?: string;
  /** List of negative sentences shown at the end of the cluster */
  negativeExamples?: string[];
  /** Full verb conjugation table shown at the bottom of the cluster */
  conjugationTable?: { conjugated: string; translation: string }[] | PreteriteConjugationTable;
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

// ── Chapter 40: Voy a — I Am Going To (pp. 112–115) ─────────────────────────

const VOY_A_CHAPTER: GustUnitContent = {
  chapterTitleKey: "voy a:",
  conceptLabel: "Voy a",
  conceptDefinition: "I am going to",
  introNote: "After 'voy a,' 'quiero,' 'puedo,' and similar verbs, the next verb keeps its unconjugated 'to' form — the infinitive. Notice these infinitives end in -AR, -ER, or -IR.",
  clusters: [
    // ── Cluster 1: Voy a + AR infinitives (page 112) ──────────────
    {
      heading: "Voy a",
      noteInline: "Voy a  I am going to · Va a  You/he/she is going to",
      pairs: [
        {
          imageWord: "clase",
          imageDescription: "a classroom interior with student desks and a chalkboard",
          question: "¿Va a hablar español en la clase?",
          questionTranslation: "Are you going to speak Spanish in class?",
          answer: "Sí, voy a hablar español en la clase.",
          answerTranslation: "Yes, I am going to speak Spanish in class.",
        },
        {
          imageWord: "fiesta",
          imageDescription: "a festive party scene with colorful balloons and decorations",
          question: "¿Va a bailar en la fiesta?",
          questionTranslation: "Are you going to dance at the party?",
          answer: "Sí, voy a bailar en la fiesta.",
          answerTranslation: "Yes, I am going to dance at the party.",
        },
        {
          imageWord: "estudiar",
          imageDescription: "a person studying at a desk with an open book",
          question: "¿Va a estudiar español en la clase?",
          questionTranslation: "Are you going to study Spanish in class?",
          answer: "Sí, voy a estudiar español en la clase.",
          answerTranslation: "Yes, I am going to study Spanish in class.",
        },
        {
          imageWord: "cantar",
          imageDescription: "a person singing on a stage with a microphone",
          question: "¿Va a cantar en la fiesta?",
          questionTranslation: "Are you going to sing at the party?",
          answer: "Sí, voy a cantar en la fiesta.",
          answerTranslation: "Yes, I am going to sing at the party.",
        },
      ],
      noteAfter: "estudiar — to study · hablar — to speak · cantar — to sing · comprar — to buy. These 'to' forms appear after 'voy a' because they follow another verb.",
    },
    // ── Cluster 2: Quiero (page 113) ──────────────────────────────
    {
      heading: "Quiero",
      noteInline: "Quiero  I want · ¿Quiere?  Do you want?",
      pairs: [
        {
          imageWord: "paquete",
          imageDescription: "a wrapped package with a ribbon on a white background",
          question: "¿Quiere dejar el paquete en el hotel?",
          questionTranslation: "Do you want to leave the package at the hotel?",
          answer: "Sí, quiero dejar el paquete en el hotel.",
          answerTranslation: "Yes, I want to leave the package at the hotel.",
        },
        {
          imageWord: "valija",
          imageDescription: "a travel suitcase standing upright on a white background",
          question: "¿Quiere dejar la valija en el hotel?",
          questionTranslation: "Do you want to leave the suitcase at the hotel?",
          answer: "Sí, quiero dejar la valija en el hotel.",
          answerTranslation: "Yes, I want to leave the suitcase at the hotel.",
        },
        {
          imageWord: "nadar",
          imageDescription: "a person swimming in a bright blue pool",
          question: "¿Quiere nadar mañana?",
          questionTranslation: "Do you want to swim tomorrow?",
          answer: "Sí, quiero nadar mañana.",
          answerTranslation: "Yes, I want to swim tomorrow.",
        },
        {
          imageWord: "campo",
          imageDescription: "a scenic countryside landscape with rolling green hills",
          question: "¿Quiere caminar en el campo?",
          questionTranslation: "Do you want to walk in the countryside?",
          answer: "Sí, quiero caminar en el campo.",
          answerTranslation: "Yes, I want to walk in the countryside.",
        },
      ],
    },
    // ── Cluster 3: Voy a / Va a — more verbs + personal a (page 114) ──
    {
      heading: "Voy a / Va a",
      noteInline: "Voy a  I am going to · Va a  You/he/she is going to",
      pairs: [
        {
          imageWord: "pollo",
          imageDescription: "a roasted chicken on a plate with steam rising",
          question: "¿Va a preparar pollo?",
          questionTranslation: "Are you going to prepare chicken?",
          answer: "Sí, voy a preparar pollo.",
          answerTranslation: "Yes, I am going to prepare chicken.",
        },
        {
          imageWord: "salmón",
          imageDescription: "a cooked salmon fillet on a white plate",
          question: "¿Va a preparar salmón?",
          questionTranslation: "Are you going to prepare salmon?",
          answer: "Sí, voy a preparar salmón.",
          answerTranslation: "Yes, I am going to prepare salmon.",
        },
        {
          imageWord: "cuenta",
          imageDescription: "a restaurant bill or check on a small tray",
          question: "¿Va a pagar la cuenta?",
          questionTranslation: "Are you going to pay the bill?",
          answer: "Sí, voy a pagar la cuenta.",
          answerTranslation: "Yes, I am going to pay the bill.",
        },
        {
          imageWord: "valija",
          imageDescription: "a travel suitcase standing upright on a white background",
          question: "¿Va a llevar la valija?",
          questionTranslation: "Are you going to take the suitcase?",
          answer: "Sí, voy a llevar la valija.",
          answerTranslation: "Yes, I am going to take the suitcase.",
        },
      ],
      noteAfter: "Use 'a' after 'invitar' and 'visitar' when a person follows: Voy a invitar a María · Voy a visitar a Roberto · Voy a viajar en México.",
    },
    // ── Cluster 4: Mega sentence combiner (page 115) ───────────────
    {
      heading: "Combine",
      noteInline: "Debo  I should · Debe  You/he should",
      pairs: [],
      sentenceColumns: [
        {
          label: "Verb phrase",
          items: [
            { text: "Voy a",       translation: "I am going to" },
            { text: "¿Va a?",      translation: "Are you/Is he going to?" },
            { text: "Va a",        translation: "You/he/she is going to" },
            { text: "Tengo que",   translation: "I have to" },
            { text: "Tiene que",   translation: "You/he/she has to" },
            { text: "Quiero",      translation: "I want to" },
            { text: "¿Quiere?",    translation: "Do you want to?" },
            { text: "Puedo",       translation: "I can" },
            { text: "No puedo",    translation: "I can't" },
            { text: "Me gusta",    translation: "I like to" },
            { text: "Me gustaría", translation: "I would like to" },
            { text: "Me encanta",  translation: "I love to" },
            { text: "Debo",        translation: "I should" },
            { text: "Debe",        translation: "You/he should" },
          ],
        },
        {
          label: "Infinitive",
          items: [
            { text: "nadar.",              translation: "to swim." },
            { text: "cantar.",             translation: "to sing." },
            { text: "estudiar.",           translation: "to study." },
            { text: "trabajar.",           translation: "to work." },
            { text: "ir.",                 translation: "to go." },
            { text: "invitar a Roberto.",  translation: "to invite Roberto." },
            { text: "visitar a María.",    translation: "to visit María." },
            { text: "comprar.",            translation: "to buy." },
            { text: "tomar.",              translation: "to take." },
            { text: "caminar.",            translation: "to walk." },
            { text: "pagar.",              translation: "to pay." },
            { text: "hablar.",             translation: "to speak." },
            { text: "bailar.",             translation: "to dance." },
            { text: "dejar.",              translation: "to leave." },
          ],
        },
      ],
      noteAfter: "Debo and Debe (I should / you should) follow the same pattern — they take an infinitive directly after them.",
    },
  ],
};

// ── Chapter 41: Va a — Vender / Leer / Escribir (pp. 116–118) ────────────────

const VA_A_CHAPTER: GustUnitContent = {
  chapterTitleKey: "va a:",
  conceptLabel: "Va a",
  conceptDefinition: "You/he/she is going to",
  clusters: [
    // ── Cluster 1: Vender (page 116) ──────────────────────────────
    {
      heading: "Vender — to sell",
      noteInline: "¿Va a vender?  Are you going to sell? · Voy a vender  I am going to sell",
      pairs: [
        {
          imageWord: "casa",
          imageDescription: "a classic single-family house with a front yard",
          question: "¿Va a vender la casa?",
          questionTranslation: "Are you going to sell the house?",
          answer: "Sí, voy a vender la casa.",
          answerTranslation: "Yes, I am going to sell the house.",
        },
        {
          imageWord: "lancha",
          imageDescription: "a small motorboat on calm blue water",
          question: "¿Va a vender la lancha?",
          questionTranslation: "Are you going to sell the boat?",
          answer: "Sí, voy a vender la lancha.",
          answerTranslation: "Yes, I am going to sell the boat.",
        },
        {
          imageWord: "auto",
          imageDescription: "a sedan car on a white background",
          question: "¿Va a vender el auto?",
          questionTranslation: "Are you going to sell the car?",
          answer: "Sí, voy a vender el auto.",
          answerTranslation: "Yes, I am going to sell the car.",
        },
        {
          imageWord: "boletos",
          imageDescription: "two admission tickets side by side on a white background",
          question: "¿Va a vender los boletos?",
          questionTranslation: "Are you going to sell the tickets?",
          answer: "Sí, voy a vender los boletos.",
          answerTranslation: "Yes, I am going to sell the tickets.",
        },
      ],
      noteAfter: "el boleto — ticket (Latin America) · el billete — ticket (Spain)",
    },
    // ── Cluster 2: Leer (page 117) ────────────────────────────────
    {
      heading: "Leer — to read",
      noteInline: "¿Va a leer?  Are you going to read? · Voy a leer  I am going to read",
      pairs: [
        {
          imageWord: "revista",
          imageDescription: "an open magazine on a white background",
          question: "¿Va a leer la revista?",
          questionTranslation: "Are you going to read the magazine?",
          answer: "Sí, voy a leer la revista.",
          answerTranslation: "Yes, I am going to read the magazine.",
        },
        {
          imageWord: "menú",
          imageDescription: "a folded restaurant menu booklet on a white background",
          question: "¿Va a leer el menú?",
          questionTranslation: "Are you going to read the menu?",
          answer: "Sí, voy a leer el menú.",
          answerTranslation: "Yes, I am going to read the menu.",
        },
        {
          imageWord: "periódico",
          imageDescription: "a folded newspaper on a white background",
          question: "¿Va a leer el periódico?",
          questionTranslation: "Are you going to read the newspaper?",
          answer: "Sí, voy a leer el periódico.",
          answerTranslation: "Yes, I am going to read the newspaper.",
        },
        {
          imageWord: "libro",
          imageDescription: "an open hardcover book on a white background",
          question: "¿Va a leer el libro?",
          questionTranslation: "Are you going to read the book?",
          answer: "Sí, voy a leer el libro.",
          answerTranslation: "Yes, I am going to read the book.",
        },
      ],
    },
    // ── Cluster 3: Escribir / Recibir (page 118) ──────────────────
    {
      heading: "Escribir / Recibir",
      noteInline: "Escribir  to write · Recibir  to receive",
      pairs: [
        {
          imageWord: "carta",
          imageDescription: "a handwritten letter next to an open envelope on a white background",
          question: "¿Va a escribir una carta?",
          questionTranslation: "Are you going to write a letter?",
          answer: "Sí, voy a escribir una carta.",
          answerTranslation: "Yes, I am going to write a letter.",
        },
        {
          imageWord: "tarjeta postal",
          imageDescription: "a colorful scenic postcard on a white background",
          question: "¿Va a recibir una tarjeta postal?",
          questionTranslation: "Are you going to receive a postcard?",
          answer: "Sí, voy a recibir una tarjeta postal.",
          answerTranslation: "Yes, I am going to receive a postcard.",
        },
      ],
      sentenceColumns: [
        {
          label: "Phrase",
          items: [
            { text: "Voy a escribir",  translation: "I am going to write" },
            { text: "Voy a leer",      translation: "I am going to read" },
            { text: "Voy a recibir",   translation: "I am going to receive" },
            { text: "Voy a vender",    translation: "I am going to sell" },
          ],
        },
        {
          label: "Object",
          items: [
            { text: "una carta.",         translation: "a letter." },
            { text: "una tarjeta postal.", translation: "a postcard." },
            { text: "la novela.",         translation: "the novel." },
            { text: "el artículo.",       translation: "the article." },
            { text: "el periódico.",      translation: "the newspaper." },
            { text: "la revista.",        translation: "the magazine." },
            { text: "el libro.",          translation: "the book." },
          ],
        },
      ],
    },
  ],
};

// ── Chapter 42: ¿Qué Hizo? — What Did You Do? (pp. 142–144) ─────────────────

const QUE_HIZO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "qué hizo",
  conceptLabel: "¿Qué hizo?",
  conceptDefinition: "What did you do?",
  clusters: [
    // ── Cluster 1: ¿Qué hizo? — jugué / trabajé / vi (page 142) ──
    {
      heading: "¿Qué hizo?",
      noteInline: "jugué  I played · trabajé  I worked · vi  I saw",
      pairs: [
        {
          imageWord: "tenis",
          imageDescription: "a person playing tennis on a clay tennis court",
          question: "¿Qué hizo esta mañana?",
          questionTranslation: "What did you do this morning?",
          answer: "Esta mañana jugué al tenis.",
          answerTranslation: "This morning I played tennis.",
        },
        {
          imageWord: "jardín",
          imageDescription: "a person tending a colorful backyard garden",
          question: "¿Qué hizo esta mañana?",
          questionTranslation: "What did you do this morning?",
          answer: "Esta mañana trabajé en el jardín.",
          answerTranslation: "This morning I worked in the garden.",
        },
        {
          imageWord: "golf",
          imageDescription: "a golfer mid-swing on a green fairway",
          question: "¿Qué hizo hoy?",
          questionTranslation: "What did you do today?",
          answer: "Jugué al golf hoy.",
          answerTranslation: "I played golf today.",
        },
        {
          imageWord: "televisión",
          imageDescription: "a television set displaying a colorful programme",
          question: "¿Qué hizo esta noche?",
          questionTranslation: "What did you do tonight?",
          answer: "Esta noche vi un programa de televisión.",
          answerTranslation: "Tonight I watched a television programme.",
        },
      ],
    },
    // ── Cluster 2: Hacer conjugation (page 142) ───────────────────
    {
      heading: "Hacer — to do / to make",
      noteInline: "hice  I did · hicimos  we did · hizo  you/he/she did · hicieron  they did",
      pairs: [],
      conjugationTable: {
        verb: "hacer",
        verbTranslation: "to do / to make",
        rows: [
          { pronoun: "Yo",                  form: "hice",     translation: "I did / made" },
          { pronoun: "Usted / Él / Ella",   form: "hizo",     translation: "you / he / she did" },
          { pronoun: "Nosotros",            form: "hicimos",  translation: "we did / made" },
          { pronoun: "Ellos / Ellas",       form: "hicieron", translation: "they did / made" },
        ],
      },
      noteAfter: "hice limonada · hice mucho trabajo · hice la cama",
    },
    // ── Cluster 3: ¿Qué hizo? — leí / oí / fui (page 143) ────────
    {
      heading: "¿Qué hizo? — más verbos",
      noteInline: "leí  I read · oí  I heard · fui  I went",
      pairs: [
        {
          imageWord: "playa",
          imageDescription: "a sunny beach with gentle waves and golden sand",
          question: "¿Qué hizo ayer?",
          questionTranslation: "What did you do yesterday?",
          answer: "Ayer fui a la playa.",
          answerTranslation: "Yesterday I went to the beach.",
        },
        {
          imageWord: "cine",
          imageDescription: "a movie theater entrance with bright marquee lights",
          question: "¿Qué hizo ayer?",
          questionTranslation: "What did you do yesterday?",
          answer: "Ayer fui al cine.",
          answerTranslation: "Yesterday I went to the cinema.",
        },
        {
          imageWord: "radio",
          imageDescription: "a vintage radio receiver glowing on a wooden table",
          question: "¿Qué hizo esta noche?",
          questionTranslation: "What did you do tonight?",
          answer: "Esta noche oí un programa de radio.",
          answerTranslation: "Tonight I listened to a radio programme.",
        },
        {
          imageWord: "periódico",
          imageDescription: "a folded newspaper on a white background",
          question: "¿Qué hizo esta tarde?",
          questionTranslation: "What did you do this afternoon?",
          answer: "Esta tarde leí el periódico.",
          answerTranslation: "This afternoon I read the newspaper.",
        },
      ],
    },
    // ── Cluster 4: Oír conjugation (page 143) ─────────────────────
    {
      heading: "Oír — to hear / to listen",
      noteInline: "Note the spelling change: oí / oyó / oímos / oyeron",
      pairs: [],
      conjugationTable: {
        verb: "oír",
        verbTranslation: "to hear / to listen",
        rows: [
          { pronoun: "Yo",                form: "oí",      translation: "I heard" },
          { pronoun: "Usted / Él / Ella", form: "oyó",     translation: "you / he / she heard" },
          { pronoun: "Nosotros",          form: "oímos",   translation: "we heard" },
          { pronoun: "Ellos / Ellas",     form: "oyeron",  translation: "they heard" },
        ],
      },
    },
    // ── Cluster 5: Leer conjugation (page 143) ────────────────────
    {
      heading: "Leer — to read",
      noteInline: "Note the spelling change: leí / leyó / leímos / leyeron",
      pairs: [],
      conjugationTable: {
        verb: "leer",
        verbTranslation: "to read",
        rows: [
          { pronoun: "Yo",                form: "leí",     translation: "I read" },
          { pronoun: "Usted / Él / Ella", form: "leyó",    translation: "you / he / she read" },
          { pronoun: "Nosotros",          form: "leímos",  translation: "we read" },
          { pronoun: "Ellos / Ellas",     form: "leyeron", translation: "they read" },
        ],
      },
    },
    // ── Cluster 6: ¿Dónde puso? (page 144) ───────────────────────
    {
      heading: "¿Dónde puso?",
      noteInline: "Puse  I put · ¿Dónde puso?  Where did you put?",
      pairs: [
        {
          imageWord: "sal",
          imageDescription: "a salt shaker on a white background",
          question: "¿Dónde puso la sal?",
          questionTranslation: "Where did you put the salt?",
          answer: "Puse la sal en la mesa.",
          answerTranslation: "I put the salt on the table.",
        },
        {
          imageWord: "pan",
          imageDescription: "a round loaf of bread on a white background",
          question: "¿Dónde puso el pan?",
          questionTranslation: "Where did you put the bread?",
          answer: "Puse el pan en la mesa.",
          answerTranslation: "I put the bread on the table.",
        },
        {
          imageWord: "pimienta",
          imageDescription: "a pepper shaker on a white background",
          question: "¿Dónde puso la pimienta?",
          questionTranslation: "Where did you put the pepper?",
          answer: "Puse la pimienta en la mesa.",
          answerTranslation: "I put the pepper on the table.",
        },
      ],
      conjugationTable: {
        verb: "poner",
        verbTranslation: "to put / to place",
        rows: [
          { pronoun: "Yo",                form: "puse",     translation: "I put" },
          { pronoun: "Usted / Él / Ella", form: "puso",     translation: "you / he / she put" },
          { pronoun: "Nosotros",          form: "pusimos",  translation: "we put" },
          { pronoun: "Ellos / Ellas",     form: "pusieron", translation: "they put" },
        ],
      },
    },
    // ── Cluster 7: ¿Dónde estuvo? (page 144) ─────────────────────
    {
      heading: "¿Dónde estuvo?",
      noteInline: "Estuve  I was · ¿Dónde estuvo?  Where were you?",
      pairs: [
        {
          imageWord: "golf",
          imageDescription: "a golfer mid-swing on a green fairway",
          question: "¿Dónde estuvo esta mañana?",
          questionTranslation: "Where were you this morning?",
          answer: "Esta mañana estuve en el club. Jugué al golf toda la mañana.",
          answerTranslation: "This morning I was at the club. I played golf all morning.",
        },
        {
          imageWord: "despacho",
          imageDescription: "a tidy office interior with a desk and bookshelves",
          question: "¿Dónde estuvo esta tarde?",
          questionTranslation: "Where were you this afternoon?",
          answer: "Esta tarde estuve en el despacho. Trabajé toda la tarde.",
          answerTranslation: "This afternoon I was at the office. I worked all afternoon.",
        },
        {
          imageWord: "cine",
          imageDescription: "a movie theater entrance with bright marquee lights",
          question: "¿Dónde estuvo esta noche?",
          questionTranslation: "Where were you tonight?",
          answer: "Esta noche estuve en el cine. Vi una película excelente.",
          answerTranslation: "Tonight I was at the cinema. I saw an excellent film.",
        },
      ],
      conjugationTable: {
        verb: "estar",
        verbTranslation: "to be (temporary state / location)",
        rows: [
          { pronoun: "Yo",                form: "estuve",     translation: "I was" },
          { pronoun: "Usted / Él / Ella", form: "estuvo",     translation: "you / he / she was" },
          { pronoun: "Nosotros",          form: "estuvimos",  translation: "we were" },
          { pronoun: "Ellos / Ellas",     form: "estuvieron", translation: "they were" },
        ],
      },
    },
  ],
};

// ── Chapter 43: Tuvo — Did You Have? (pp. 146–147) ──────────────────────────

const TUVO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "tuvo:",
  conceptLabel: "¿Tuvo?",
  conceptDefinition: "Did you have?",
  clusters: [
    // ── Cluster 1: ¿Tuvo? — tener preterite (page 146) ────────────
    {
      heading: "¿Tuvo?",
      noteInline: "Tuve  I had · No tuve  I didn't have · ¡Qué terrible!  How terrible!",
      pairs: [
        {
          imageWord: "fiesta",
          imageDescription: "a lively indoor party with colorful balloons and guests",
          question: "¿Tuvo una fiesta el sábado?",
          questionTranslation: "Did you have a party on Saturday?",
          answer: "Sí, tuve una fiesta linda el sábado.",
          answerTranslation: "Yes, I had a lovely party on Saturday.",
        },
        {
          imageWord: "visitas",
          imageDescription: "a welcoming living room scene with guests sitting together",
          question: "¿Tuvo visitas el sábado?",
          questionTranslation: "Did you have company on Saturday?",
          answer: "Sí, tuve visitas el sábado.",
          answerTranslation: "Yes, I had company on Saturday.",
        },
        {
          imageWord: "catarro",
          imageDescription: "a person wrapped in a blanket looking unwell with tissues",
          question: "¿Tuvo catarro esta semana?",
          questionTranslation: "Did you have a cold this week?",
          answer: "Sí, tuve catarro esta semana. ¡Qué terrible!",
          answerTranslation: "Yes, I had a cold this week. How terrible!",
        },
        {
          imageWord: "trabajo",
          imageDescription: "a desk overflowing with stacked papers and folders",
          question: "¿Tuvo mucho trabajo esta semana?",
          questionTranslation: "Did you have a lot of work this week?",
          answer: "Sí, tuve mucho trabajo esta semana. ¡Qué terrible!",
          answerTranslation: "Yes, I had a lot of work this week. How terrible!",
        },
        {
          imageWord: "visitas",
          imageDescription: "a welcoming living room scene with guests sitting together",
          question: "¿Tuvo visitas esta mañana?",
          questionTranslation: "Did you have company this morning?",
          answer: "No, no tuve una fiesta esta mañana.",
          answerTranslation: "No, I didn't have a party this morning.",
        },
      ],
      conjugationTable: {
        verb: "tener",
        verbTranslation: "to have",
        rows: [
          { pronoun: "Yo",                form: "tuve",     translation: "I had" },
          { pronoun: "Usted / Él / Ella", form: "tuvo",     translation: "you / he / she had" },
          { pronoun: "Nosotros",          form: "tuvimos",  translation: "we had" },
          { pronoun: "Ellos / Ellas",     form: "tuvieron", translation: "they had" },
        ],
      },
      noteAfter: "Tuve mucho trabajo. · María tuvo una fiesta. · Tuvimos una fiesta. · Tuvieron una fiesta.",
    },
    // ── Cluster 2: ¿Vino? — venir preterite (page 147) ───────────
    {
      heading: "¿Vino?",
      noteInline: "Vine  I came · No vine  I didn't come · No pude  I couldn't · No tuve tiempo  I didn't have time",
      pairs: [
        {
          imageWord: "playa",
          imageDescription: "a sunny beach with gentle waves and golden sand",
          question: "¿Vino a la playa la semana pasada?",
          questionTranslation: "Did you come to the beach last week?",
          answer: "No, no vine a la playa la semana pasada. No pude, no tuve tiempo.",
          answerTranslation: "No, I didn't come to the beach last week. I couldn't, I didn't have time.",
        },
        {
          imageWord: "clase",
          imageDescription: "a classroom interior with student desks and a chalkboard",
          question: "¿Vino a la clase la semana pasada?",
          questionTranslation: "Did you come to class last week?",
          answer: "Sí, vine a la clase la semana pasada.",
          answerTranslation: "Yes, I came to class last week.",
        },
        {
          imageWord: "fiesta",
          imageDescription: "a lively indoor party with colorful balloons and guests",
          question: "¿Vino a la fiesta la semana pasada?",
          questionTranslation: "Did you come to the party last week?",
          answer: "No, no vine a la fiesta la semana pasada. No pude, no tuve tiempo.",
          answerTranslation: "No, I didn't come to the party last week. I couldn't, I didn't have time.",
        },
        {
          imageWord: "campo",
          imageDescription: "a scenic countryside landscape with rolling green hills",
          question: "¿Vino al campo la semana pasada?",
          questionTranslation: "Did you come to the countryside last week?",
          answer: "No, no vine al campo la semana pasada. No pude, no tuve tiempo.",
          answerTranslation: "No, I didn't come to the countryside last week. I couldn't, I didn't have time.",
        },
        {
          imageWord: "club",
          imageDescription: "a golf club house entrance with manicured grounds",
          question: "¿Vino al club la semana pasada?",
          questionTranslation: "Did you come to the club last week?",
          answer: "Sí, vine al club la semana pasada.",
          answerTranslation: "Yes, I came to the club last week.",
        },
      ],
      conjugationTable: {
        verb: "venir",
        verbTranslation: "to come",
        rows: [
          { pronoun: "Yo",                form: "vine",     translation: "I came" },
          { pronoun: "Usted / Él / Ella", form: "vino",     translation: "you / he / she came" },
          { pronoun: "Nosotros",          form: "vinimos",  translation: "we came" },
          { pronoun: "Ellos / Ellas",     form: "vinieron", translation: "they came" },
        ],
      },
    },
    // ── Cluster 3: Poder — preterite (page 147) ───────────────────
    {
      heading: "Poder — to be able to",
      noteInline: "Pude  I could · No pude  I couldn't",
      pairs: [],
      conjugationTable: {
        verb: "poder",
        verbTranslation: "to be able to / can",
        rows: [
          { pronoun: "Yo",                form: "pude",     translation: "I could" },
          { pronoun: "Usted / Él / Ella", form: "pudo",     translation: "you / he / she could" },
          { pronoun: "Nosotros",          form: "pudimos",  translation: "we could" },
          { pronoun: "Ellos / Ellas",     form: "pudieron", translation: "they could" },
        ],
      },
      noteAfter: "No pude, no tuve tiempo. · I couldn't, I didn't have time.",
    },
  ],
};

// ── Chapter 44: Le — To Him, To Her (p. 150) ────────────────────────────────

const LE_CHAPTER: GustUnitContent = {
  chapterTitleKey: "le:",
  conceptLabel: "Le",
  conceptDefinition: "To him / to her / to you",
  introNote: "'Le' is the indirect object pronoun — it tells you who received the action. Le traje un libro = I brought him/her a book.",
  clusters: [
    // ── Cluster 1: ¿Qué le trajo? (page 150) ─────────────────────
    {
      heading: "¿Qué le trajo?",
      noteInline: "Le traje  I brought him/her · ¿Qué le trajo?  What did you bring him/her?",
      pairs: [
        {
          imageWord: "libro",
          imageDescription: "an open hardcover book on a white background",
          question: "¿Qué le trajo?",
          questionTranslation: "What did you bring him/her?",
          answer: "Le traje un libro.",
          answerTranslation: "I brought him/her a book.",
        },
        {
          imageWord: "disco",
          imageDescription: "a vinyl record on a plain white background",
          question: "¿Qué le trajo?",
          questionTranslation: "What did you bring him/her?",
          answer: "Le traje un disco.",
          answerTranslation: "I brought him/her a record.",
        },
      ],
      conjugationTable: {
        verb: "traer",
        verbTranslation: "to bring",
        rows: [
          { pronoun: "Yo",                form: "traje",    translation: "I brought" },
          { pronoun: "Usted / Él / Ella", form: "trajo",    translation: "you / he / she brought" },
          { pronoun: "Nosotros",          form: "trajimos", translation: "we brought" },
          { pronoun: "Ellos / Ellas",     form: "trajeron", translation: "they brought" },
        ],
      },
    },
    // ── Cluster 2: ¿Qué le dijo? (page 150) ──────────────────────
    {
      heading: "¿Qué le dijo?",
      noteInline: "Le dije que era...  I told him/her that it was...",
      pairs: [],
      sentenceColumns: [
        {
          label: "Phrase",
          items: [
            { text: "Le dije que era", translation: "I told him/her that it was" },
          ],
        },
        {
          label: "Adjective",
          items: [
            { text: "interesante.",  translation: "interesting." },
            { text: "terrible.",     translation: "terrible." },
            { text: "excelente.",    translation: "excellent." },
            { text: "imposible.",    translation: "impossible." },
            { text: "formidable.",   translation: "wonderful." },
          ],
        },
      ],
      conjugationTable: {
        verb: "decir",
        verbTranslation: "to say / to tell",
        rows: [
          { pronoun: "Yo",                form: "dije",    translation: "I said / told" },
          { pronoun: "Usted / Él / Ella", form: "dijo",    translation: "you / he / she said" },
          { pronoun: "Nosotros",          form: "dijimos", translation: "we said / told" },
          { pronoun: "Ellos / Ellas",     form: "dijeron", translation: "they said / told" },
        ],
      },
    },
  ],
};

// ── Chapter 45: Está — Limpio y Sucio (p. 151) ──────────────────────────────

const ESTA_LIMPIO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "está:",
  conceptLabel: "Está",
  conceptDefinition: "Is (state)",
  introNote: "'Limpio/limpia' means clean · 'Sucio/sucia' means dirty. The ending changes to match the gender of the noun: el plato limpio · la cuchara limpia.",
  clusters: [
    {
      heading: "¿Está limpio/a? ¿Está sucio/a?",
      noteInline: "Limpio / Limpia  Clean · Sucio / Sucia  Dirty",
      pairs: [
        {
          imageWord: "cuchara",
          imageDescription: "a polished silver spoon on a white background",
          question: "¿Está limpia la cuchara?",
          questionTranslation: "Is the spoon clean?",
          answer: "Sí, la cuchara está limpia.",
          answerTranslation: "Yes, the spoon is clean.",
        },
        {
          imageWord: "plato",
          imageDescription: "a white ceramic dinner plate on a white background",
          question: "¿Está limpio el plato?",
          questionTranslation: "Is the plate clean?",
          answer: "Sí, está limpio.",
          answerTranslation: "Yes, it is clean.",
        },
        {
          imageWord: "servilleta",
          imageDescription: "a folded white cloth napkin on a white background",
          question: "¿La servilleta está sucia?",
          questionTranslation: "Is the napkin dirty?",
          answer: "No, la servilleta no está sucia. La servilleta está limpia.",
          answerTranslation: "No, the napkin is not dirty. The napkin is clean.",
        },
        {
          imageWord: "mantel",
          imageDescription: "a clean white tablecloth draped neatly over a table",
          question: "¿Está sucio el mantel?",
          questionTranslation: "Is the tablecloth dirty?",
          answer: "No, el mantel no está sucio. El mantel está limpio.",
          answerTranslation: "No, the tablecloth is not dirty. The tablecloth is clean.",
        },
        {
          imageWord: "jarra",
          imageDescription: "a clear glass pitcher with water on a white background",
          question: "¿Está limpia la jarra?",
          questionTranslation: "Is the pitcher clean?",
          answer: "Sí, la jarra está limpia.",
          answerTranslation: "Yes, the pitcher is clean.",
        },
        {
          imageWord: "taza",
          imageDescription: "a white ceramic coffee cup on a white background",
          question: "¿Está limpia la taza?",
          questionTranslation: "Is the cup clean?",
          answer: "Sí, la taza está limpia.",
          answerTranslation: "Yes, the cup is clean.",
        },
        {
          imageWord: "vaso",
          imageDescription: "a clear drinking glass on a white background",
          question: "¿Está limpio el vaso?",
          questionTranslation: "Is the glass clean?",
          answer: "Sí, el vaso está limpio.",
          answerTranslation: "Yes, the glass is clean.",
        },
        {
          imageWord: "cuchillo",
          imageDescription: "a dinner knife on a white background",
          question: "¿Está limpio el cuchillo?",
          questionTranslation: "Is the knife clean?",
          answer: "Sí, el cuchillo está limpio.",
          answerTranslation: "Yes, the knife is clean.",
        },
      ],
    },
  ],
};

// ── Chapter 46: Estudié — AR Preterite (pp. 122–125) ─────────────────────────

const ESTUDIIE_CHAPTER: GustUnitContent = {
  chapterTitleKey: "estudié:",
  conceptLabel: "Estudié",
  conceptDefinition: "I studied",
  introNote: "In the past tense, -AR verbs end in -é when you speak of yourself and -ó when you speak of someone else (singular). For groups (ellos/ustedes), add -aron. For nosotros, add -amos.",
  clusters: [
    // ── Cluster 1: -é / -ó pattern (page 122) ─────────────────────
    {
      heading: "Estudié, Compré, Nadé",
      noteInline: "-é = I (yo)  ·  -ó = you / he / she (usted / él / ella)",
      pairs: [
        {
          imageWord: "estudiar",
          imageDescription: "a student sitting at a desk studying from an open textbook",
          question: "¿Estudió hoy?",
          questionTranslation: "Did you study today?",
          answer: "Sí, estudié hoy.",
          answerTranslation: "Yes, I studied today.",
        },
        {
          imageWord: "pagar",
          imageDescription: "a hand placing money on a restaurant table to pay the bill",
          question: "¿Pagó la cuenta hoy?",
          questionTranslation: "Did you pay the bill today?",
          answer: "Sí, pagué la cuenta hoy.",
          answerTranslation: "Yes, I paid the bill today.",
        },
        {
          imageWord: "nadar",
          imageDescription: "a person swimming in a bright blue outdoor pool",
          question: "¿Nadó hoy?",
          questionTranslation: "Did you swim today?",
          answer: "Sí, nadé hoy.",
          answerTranslation: "Yes, I swam today.",
        },
        {
          imageWord: "comprar",
          imageDescription: "a person holding a shopping bag outside a store",
          question: "¿Compró un bata hoy?",
          questionTranslation: "Did you buy a bathrobe today?",
          answer: "Sí, compré un bata hoy.",
          answerTranslation: "Yes, I bought a bathrobe today.",
        },
      ],
      noteAfter: "AR verbs end in -é when you speak of yourself and -ó when you speak of someone else. Roberto nadó hoy.",
    },
    // ── Cluster 2: -aron form + full conjugation (page 123) ────────
    {
      heading: "Compraron, Alquilaron",
      noteInline: "-aron = they / you all (ellos / ustedes)  ·  -amos = we (nosotros)",
      pairs: [
        {
          imageWord: "lancha",
          imageDescription: "a small motorboat floating on calm blue water",
          question: "¿Compraron una lancha?",
          questionTranslation: "Did they buy a boat?",
          answer: "Sí, compraron una lancha.",
          answerTranslation: "Yes, they bought a boat.",
        },
        {
          imageWord: "casa",
          imageDescription: "a white family house with a garden and blue sky",
          question: "¿Alquilaron una casa?",
          questionTranslation: "Did they rent a house?",
          answer: "Sí, alquilaron una casa.",
          answerTranslation: "Yes, they rented a house.",
        },
        {
          imageWord: "trabajo",
          imageDescription: "two people working together at an office desk at night",
          question: "¿Trabajaron anoche?",
          questionTranslation: "Did they work last night?",
          answer: "Sí, trabajaron mucho anoche.",
          answerTranslation: "Yes, they worked a lot last night.",
        },
      ],
      conjugationTable: [
        { conjugated: "alquilé",    translation: "I rented (yo)" },
        { conjugated: "alquiló",    translation: "you / he / she rented" },
        { conjugated: "alquilamos", translation: "we rented (nosotros)" },
        { conjugated: "alquilaron", translation: "they rented (ellos)" },
      ],
    },
    // ── Cluster 3: ¿Dónde dejó? (pages 124–125) ───────────────────
    {
      heading: "¿Dónde dejó?",
      noteInline: "Dejé  I left  ·  Dejó  you / he / she left  ·  Dejamos  we left  ·  Dejaron  they left",
      pairs: [
        {
          imageWord: "valija",
          imageDescription: "a travel suitcase standing in a hotel lobby",
          question: "¿Dejó la valija en el hotel?",
          questionTranslation: "Did you leave the suitcase at the hotel?",
          answer: "Sí, dejé la valija en el hotel.",
          answerTranslation: "Yes, I left the suitcase at the hotel.",
        },
        {
          imageWord: "guantes",
          imageDescription: "a pair of gloves resting on a theater seat",
          question: "¿Dejó los guantes en el teatro?",
          questionTranslation: "Did you leave the gloves at the theater?",
          answer: "No, no dejé los guantes en el teatro.",
          answerTranslation: "No, I did not leave the gloves at the theater.",
        },
        {
          imageWord: "portafolio",
          imageDescription: "a leather briefcase on a bank counter",
          question: "¿Dejó el portafolio en el banco?",
          questionTranslation: "Did you leave the briefcase at the bank?",
          answer: "Sí, dejé el portafolio en el banco.",
          answerTranslation: "Yes, I left the briefcase at the bank.",
        },
        {
          imageWord: "llave",
          imageDescription: "a key resting on a wooden table",
          question: "¿Dejó la llave en la mesa?",
          questionTranslation: "Did you leave the key on the table?",
          answer: "Sí, dejé la llave en la mesa.",
          answerTranslation: "Yes, I left the key on the table.",
        },
        {
          imageWord: "dinero",
          imageDescription: "folded banknotes on a bank counter",
          question: "¿Dejaron el dinero en el banco?",
          questionTranslation: "Did they leave the money at the bank?",
          answer: "Sí, dejamos el dinero en el banco.",
          answerTranslation: "Yes, we left the money at the bank.",
        },
        {
          imageWord: "perro",
          imageDescription: "a dog sitting contentedly inside a cozy home",
          question: "¿Dejaron el perro en casa?",
          questionTranslation: "Did they leave the dog at home?",
          answer: "Sí, dejamos el perro en casa.",
          answerTranslation: "Yes, we left the dog at home.",
        },
      ],
      sentenceColumns: [
        {
          label: "Verb",
          items: [
            { text: "Dejé",    translation: "I left" },
            { text: "Dejamos", translation: "we left" },
            { text: "Dejó",    translation: "you / he / she left" },
            { text: "Dejaron", translation: "they left" },
          ],
        },
        {
          label: "Object",
          items: [
            { text: "la valija",    translation: "the suitcase" },
            { text: "los guantes",  translation: "the gloves" },
            { text: "el portafolio", translation: "the briefcase" },
            { text: "la llave",     translation: "the key" },
            { text: "el dinero",    translation: "the money" },
            { text: "el pasaporte", translation: "the passport" },
            { text: "el perro",     translation: "the dog" },
            { text: "el auto",      translation: "the car" },
          ],
        },
        {
          label: "Place",
          items: [
            { text: "en el hotel.",   translation: "at the hotel." },
            { text: "en el teatro.",  translation: "at the theater." },
            { text: "en el banco.",   translation: "at the bank." },
            { text: "en la mesa.",    translation: "on the table." },
            { text: "en el garaje.",  translation: "in the garage." },
            { text: "en casa.",       translation: "at home." },
          ],
        },
      ],
      conjugationTable: [
        { conjugated: "dejé",    translation: "I left (yo)" },
        { conjugated: "dejó",    translation: "you / he / she left" },
        { conjugated: "dejamos", translation: "we left (nosotros)" },
        { conjugated: "dejaron", translation: "they left (ellos)" },
      ],
      negativeExamples: [
        "No, no dejé los guantes en el teatro.",
        "No, no dejamos el pasaporte en casa.",
      ],
    },
  ],
};

// ── Chapter 47: Recibí — ER/IR Preterite (pp. 132–137) ───────────────────────

const RECIBI_CHAPTER: GustUnitContent = {
  chapterTitleKey: "recibí:",
  conceptLabel: "Recibí",
  conceptDefinition: "I received",
  introNote: "In the past tense, -ER and -IR verbs end in -í when you speak of yourself and -ió when you speak of anyone else (singular). For ellos/ustedes, add -ieron. For nosotros, add -imos.",
  clusters: [
    // ── Cluster 1: -í / -ió pattern (page 132) ────────────────────
    {
      heading: "Recibí, Vendí, Vi",
      noteInline: "-í = I (yo)  ·  -ió = you / he / she (usted / él / ella)",
      pairs: [
        {
          imageWord: "lancha",
          imageDescription: "a small motorboat floating on calm blue water",
          question: "¿Vendió la lancha hoy?",
          questionTranslation: "Did you sell the boat today?",
          answer: "Sí, vendí la lancha hoy.",
          answerTranslation: "Yes, I sold the boat today.",
        },
        {
          imageWord: "carta",
          imageDescription: "a handwritten letter on a wooden desk",
          question: "¿Escribió la carta hoy?",
          questionTranslation: "Did you write the letter today?",
          answer: "Sí, escribí la carta hoy.",
          answerTranslation: "Yes, I wrote the letter today.",
        },
        {
          imageWord: "paquete",
          imageDescription: "a wrapped package with a ribbon on a white background",
          question: "¿Recibió el paquete hoy?",
          questionTranslation: "Did you receive the package today?",
          answer: "Sí, recibí el paquete hoy.",
          answerTranslation: "Yes, I received the package today.",
        },
        {
          imageWord: "televisión",
          imageDescription: "a living room television screen showing a programme",
          question: "¿Vio el programa de televisión?",
          questionTranslation: "Did you see the television programme?",
          answer: "Sí, vi el programa de televisión.",
          answerTranslation: "Yes, I saw the television programme.",
        },
      ],
      noteAfter: "ER and IR verbs end in -í when you speak of yourself and -ió when you speak of anyone else singular. Enrique vendió la lancha.",
    },
    // ── Cluster 2: ¿Qué recibió? — gifts (page 133) ───────────────
    {
      heading: "¿Qué recibió?",
      noteInline: "para su cumpleaños  for your birthday  ·  para la Navidad  for Christmas",
      pairs: [
        {
          imageWord: "chocolates",
          imageDescription: "a box of assorted chocolates open on a table",
          question: "¿Qué recibió para su cumpleaños?",
          questionTranslation: "What did you receive for your birthday?",
          answer: "Recibí una caja de chocolates para mi cumpleaños.",
          answerTranslation: "I received a box of chocolates for my birthday.",
        },
        {
          imageWord: "perfume",
          imageDescription: "an elegant glass bottle of perfume on a white background",
          question: "¿Qué recibió para la Navidad?",
          questionTranslation: "What did you receive for Christmas?",
          answer: "Recibí una botella de perfume para la Navidad.",
          answerTranslation: "I received a bottle of perfume for Christmas.",
        },
        {
          imageWord: "billetera",
          imageDescription: "a leather wallet on a white background",
          question: "¿Qué recibió para su cumpleaños?",
          questionTranslation: "What did you receive for your birthday?",
          answer: "Recibí una billetera para mi cumpleaños.",
          answerTranslation: "I received a wallet for my birthday.",
        },
        {
          imageWord: "portafolio",
          imageDescription: "a leather briefcase on a white background",
          question: "¿Qué recibió para la Navidad?",
          questionTranslation: "What did you receive for Christmas?",
          answer: "Recibí un portafolio para la Navidad.",
          answerTranslation: "I received a briefcase for Christmas.",
        },
      ],
    },
    // ── Cluster 3: ¿Vio? / Vi (page 134) ─────────────────────────
    {
      heading: "¿Vio? / Vi",
      noteInline: "¿Vio?  Did you see?  ·  Vi  I saw",
      pairs: [
        {
          imageWord: "pintura",
          imageDescription: "a framed painting hanging on a museum wall",
          question: "¿Vio la pintura?",
          questionTranslation: "Did you see the painting?",
          answer: "Sí, vi la pintura.",
          answerTranslation: "Yes, I saw the painting.",
        },
        {
          imageWord: "estatua",
          imageDescription: "a marble statue in a museum gallery",
          question: "¿Vio la estatua?",
          questionTranslation: "Did you see the statue?",
          answer: "Sí, vi la estatua.",
          answerTranslation: "Yes, I saw the statue.",
        },
        {
          imageWord: "sombrero",
          imageDescription: "a stylish new hat on a white background",
          question: "¿Vio mi sombrero nuevo?",
          questionTranslation: "Did you see my new hat?",
          answer: "Sí, vi su sombrero nuevo.",
          answerTranslation: "Yes, I saw your new hat.",
        },
        {
          imageWord: "accidente",
          imageDescription: "a car accident scene on a city street",
          question: "¿Vio el accidente?",
          questionTranslation: "Did you see the accident?",
          answer: "No, por fortuna, no vi el accidente.",
          answerTranslation: "No, fortunately I did not see the accident.",
        },
      ],
      negativeExamples: [
        "No, por fortuna, no vi el accidente.",
      ],
    },
    // ── Cluster 4: ¿Qué vieron? / Vimos (pages 135–136) ───────────
    {
      heading: "¿Qué vieron? / Vimos",
      noteInline: "Vieron  they saw  ·  Vimos  we saw",
      pairs: [
        {
          imageWord: "payaso",
          imageDescription: "a cheerful clown performing at a circus",
          question: "¿Qué vieron los niños en el circo?",
          questionTranslation: "What did the children see at the circus?",
          answer: "Los niños vieron un payaso en el circo.",
          answerTranslation: "The children saw a clown at the circus.",
        },
        {
          imageWord: "elefante",
          imageDescription: "a large elephant performing at a circus",
          question: "¿Qué vieron los niños en el circo?",
          questionTranslation: "What did the children see at the circus?",
          answer: "Los niños vieron un elefante en el circo.",
          answerTranslation: "The children saw an elephant at the circus.",
        },
        {
          imageWord: "mono",
          imageDescription: "a playful monkey performing tricks at a circus",
          question: "¿Qué vieron los niños en el circo?",
          questionTranslation: "What did the children see at the circus?",
          answer: "Los niños vieron un mono en el circo.",
          answerTranslation: "The children saw a monkey at the circus.",
        },
        {
          imageWord: "comedia",
          imageDescription: "the interior of a theater with a stage and audience",
          question: "¿Vieron una comedia anoche?",
          questionTranslation: "Did you see a play last night?",
          answer: "Sí, vimos una comedia muy interesante anoche.",
          answerTranslation: "Yes, we saw a very interesting play last night.",
        },
        {
          imageWord: "edificio",
          imageDescription: "a modern glass office building in a city center",
          question: "¿Vieron el edificio?",
          questionTranslation: "Did you see the building?",
          answer: "Sí, vimos el edificio. Es muy moderno.",
          answerTranslation: "Yes, we saw the building. It is very modern.",
        },
      ],
      conjugationTable: [
        { conjugated: "vi",      translation: "I saw (yo)" },
        { conjugated: "vio",     translation: "you / he / she saw" },
        { conjugated: "vimos",   translation: "we saw (nosotros)" },
        { conjugated: "vieron",  translation: "they saw (ellos)" },
      ],
      noteAfter: "El payaso es muy chistoso. · El elefante es un animal muy grande. · El mono es un animal muy chistoso. · Note: 'jajaja' in Spanish is pronounced 'hahaha.'",
    },
    // ── Cluster 5: Escribimos / Vendimos (page 137) ────────────────
    {
      heading: "Escribimos, Vendimos",
      noteInline: "-imos = we (nosotros)  ·  -ieron = they (ellos)",
      pairs: [
        {
          imageWord: "cartas",
          imageDescription: "a stack of handwritten letters on a desk",
          question: "¿Escribieron las cartas esta mañana?",
          questionTranslation: "Did you write the letters this morning?",
          answer: "Sí, escribimos las cartas esta mañana.",
          answerTranslation: "Yes, we wrote the letters this morning.",
        },
        {
          imageWord: "bicicleta",
          imageDescription: "a bicycle leaning against a wall",
          question: "¿Vendieron la bicicleta?",
          questionTranslation: "Did you sell the bicycle?",
          answer: "Sí, vendimos la bicicleta esta mañana.",
          answerTranslation: "Yes, we sold the bicycle this morning.",
        },
        {
          imageWord: "composición",
          imageDescription: "a student writing a composition at a school desk",
          question: "¿Escribieron una composición para la clase?",
          questionTranslation: "Did you write a composition for class?",
          answer: "Sí, escribimos una composición para la clase.",
          answerTranslation: "Yes, we wrote a composition for class.",
        },
        {
          imageWord: "casa",
          imageDescription: "a white family house with a 'for sale' sign in the garden",
          question: "¿Vendieron la casa?",
          questionTranslation: "Did you sell the house?",
          answer: "No, no vendimos la casa.",
          answerTranslation: "No, we did not sell the house.",
        },
      ],
      conjugationTable: [
        { conjugated: "vendí",     translation: "I sold (yo)" },
        { conjugated: "vendió",    translation: "you / he / she sold" },
        { conjugated: "vendimos",  translation: "we sold (nosotros)" },
        { conjugated: "vendieron", translation: "they sold (ellos)" },
      ],
      negativeExamples: [
        "No, no vendimos la casa.",
        "No, no escribimos la composición para la clase.",
      ],
    },
  ],
};

// ── Spanish 2 Unit 10: Compraba — The Imperfect Tense (p. 196–197) ────
// Replaces the hollow "Childhood Memories" placeholder.
// chapterTitleKey "compraba" matches DB unit name "Compraba: The Imperfect Tense".
// Three clusters: -aba pattern (compraba), -ía pattern (vendía), tenía possession.

const COMPRABA_CHAPTER: GustUnitContent = {
  chapterTitleKey: "compraba",
  conceptLabel: "Compraba",
  conceptDefinition: "used to buy / was buying",
  introNote: "The imperfect tense describes what someone used to do, or how things were in the past. It is the tense of stories, memories, and descriptions. AR verbs end in -aba. ER and IR verbs end in -ía.",
  clusters: [
    // ── Cluster 1: Compraba — AR verbs, -aba pattern (p. 196) ────────────
    {
      heading: "¿Qué Compraba? — The -aba Pattern",
      noteInline: "compraba  used to buy / was buying  ·  comprábamos  we used to buy  ·  compraban  they used to buy",
      pairs: [
        {
          imageWord: "máquinas",
          imageDescription: "a factory worker examining large industrial machines on a production floor",
          question: "¿Qué compraba antes?",
          questionTranslation: "What used to you buy / What did you used to buy?",
          answer: "Compraba máquinas.",
          answerTranslation: "I used to buy machines.",
        },
        {
          imageWord: "tractores",
          imageDescription: "a row of green farm tractors lined up in a field",
          question: "¿Compraba tractores también?",
          questionTranslation: "Did you used to buy tractors too?",
          answer: "Sí, compraba tractores también.",
          answerTranslation: "Yes, I used to buy tractors too.",
        },
        {
          imageWord: "frutas",
          imageDescription: "a colorful display of fresh fruit at an outdoor market stall",
          question: "¿Qué compraba en el mercado?",
          questionTranslation: "What used to you buy at the market?",
          answer: "Compraba frutas en el mercado.",
          answerTranslation: "I used to buy fruit at the market.",
        },
        {
          imageWord: "café",
          imageDescription: "a steaming cup of coffee on a wooden café table in the morning sun",
          question: "¿Compraba café por las mañanas?",
          questionTranslation: "Did you used to buy coffee in the mornings?",
          answer: "Sí, compraba café todas las mañanas.",
          answerTranslation: "Yes, I used to buy coffee every morning.",
        },
      ],
      conjugationTable: [
        { conjugated: "compraba",    translation: "I used to buy / you used to buy / he, she used to buy" },
        { conjugated: "comprábamos", translation: "we used to buy" },
        { conjugated: "compraban",   translation: "they / you all used to buy" },
      ],
      grammarRule: "AR verbs: drop -ar, add -aba / -ábamos / -aban\nThe yo and usted/él/ella forms are identical: compraba.",
    },
    // ── Cluster 2: Vendía — ER verbs, -ía pattern (p. 197) ────────────────
    {
      heading: "¿Qué Vendía? — The -ía Pattern",
      noteInline: "vendía  used to sell  ·  vendíamos  we used to sell  ·  vendían  they used to sell",
      pairs: [
        {
          imageWord: "sombreros",
          imageDescription: "a street vendor with a colorful display of wide-brimmed hats at a market",
          question: "¿Qué vendía usted?",
          questionTranslation: "What did you used to sell?",
          answer: "Vendía sombreros.",
          answerTranslation: "I used to sell hats.",
        },
        {
          imageWord: "blusas",
          imageDescription: "a woman arranging folded blouses on a shop display table",
          question: "¿Qué vendía María?",
          questionTranslation: "What did María used to sell?",
          answer: "María vendía blusas.",
          answerTranslation: "María used to sell blouses.",
        },
        {
          imageWord: "flores",
          imageDescription: "a flower seller with buckets of fresh cut flowers at an outdoor stall",
          question: "¿Vendía flores en el mercado?",
          questionTranslation: "Did you used to sell flowers at the market?",
          answer: "Sí, vendía flores en el mercado.",
          answerTranslation: "Yes, I used to sell flowers at the market.",
        },
        {
          imageWord: "libros",
          imageDescription: "a small bookshop with stacks of books arranged in a narrow storefront",
          question: "¿Vendía libros?",
          questionTranslation: "Did you used to sell books?",
          answer: "Sí, vendía libros en la librería.",
          answerTranslation: "Yes, I used to sell books at the bookshop.",
        },
      ],
      conjugationTable: [
        { conjugated: "vendía",    translation: "I used to sell / you used to sell / he, she used to sell" },
        { conjugated: "vendíamos", translation: "we used to sell" },
        { conjugated: "vendían",   translation: "they / you all used to sell" },
      ],
      grammarRule: "ER / IR verbs: drop -er / -ir, add -ía / -íamos / -ían\nThe yo and usted/él/ella forms are identical: vendía.",
    },
    // ── Cluster 3: Tenía — possession in the past (p. 197) ───────────────
    {
      heading: "Tenía — What Someone Used to Have",
      noteInline: "tenía  used to have  ·  teníamos  we used to have  ·  tenían  they used to have",
      pairs: [
        {
          imageWord: "campo",
          imageDescription: "a rustic country house surrounded by green fields and rolling hills",
          question: "¿Tenía una casa?",
          questionTranslation: "Did you used to have a house?",
          answer: "Sí, tenía una casa en el campo.",
          answerTranslation: "Yes, I used to have a house in the countryside.",
        },
        {
          imageWord: "auto",
          imageDescription: "a classic blue car parked in front of a house with a vintage feel",
          question: "¿Tenía un auto?",
          questionTranslation: "Did you used to have a car?",
          answer: "Sí, tenía un auto azul.",
          answerTranslation: "Yes, I used to have a blue car.",
        },
        {
          imageWord: "caballo",
          imageDescription: "a brown horse standing in a green pasture on a sunny day",
          question: "¿Tenía un caballo?",
          questionTranslation: "Did you used to have a horse?",
          answer: "Sí, tenía un caballo.",
          answerTranslation: "Yes, I used to have a horse.",
        },
        {
          imageWord: "perro",
          imageDescription: "a friendly dog sitting in a backyard garden looking at the camera",
          question: "¿Tenía un perro?",
          questionTranslation: "Did you used to have a dog?",
          answer: "Sí, tenía un perro bonito.",
          answerTranslation: "Yes, I used to have a beautiful dog.",
        },
      ],
      conjugationTable: [
        { conjugated: "tenía",    translation: "I used to have / you used to have / he, she used to have" },
        { conjugated: "teníamos", translation: "we used to have" },
        { conjugated: "tenían",   translation: "they / you all used to have" },
      ],
      grammarRule: "Tener follows the -ía pattern in the imperfect, even though it is irregular in the present tense.",
      sentenceColumns: [
        {
          label: "Verb",
          items: [
            { text: "Compraba",   translation: "I used to buy" },
            { text: "Vendía",     translation: "I used to sell" },
            { text: "Tenía",      translation: "I used to have" },
          ],
        },
        {
          label: "Object",
          items: [
            { text: "máquinas.",              translation: "machines." },
            { text: "tractores.",             translation: "tractors." },
            { text: "sombreros.",             translation: "hats." },
            { text: "blusas.",                translation: "blouses." },
            { text: "flores.",                translation: "flowers." },
            { text: "libros.",                translation: "books." },
            { text: "una casa en el campo.",  translation: "a house in the countryside." },
            { text: "un auto azul.",          translation: "a blue car." },
            { text: "un caballo.",            translation: "a horse." },
            { text: "un perro bonito.",       translation: "a beautiful dog." },
          ],
        },
      ],
      noteAfter: "Antes means 'before' or 'in the past.' Use it to signal that you are speaking in the imperfect: Antes tenía un perro. — I used to have a dog.",
    },
  ],
};

// ── Spanish 2 Unit 6: Tengo Catarro — Expresiones de Salud (p. 53) ─────
// chapterTitleKey "tengo catarro" matches DB unit "Tengo Catarro — Expresiones de Salud".
// Collision check: "tengo catarro".includes("tener") → FALSE (tengo ≠ tener substring).
// Three clusters: enfermedades (illnesses), dolores (pains), sentence combiner.

const TENGO_CATARRO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "tengo catarro",
  conceptLabel: "Tengo Catarro",
  conceptDefinition: "I have a cold",
  introNote: "In Spanish, tener (to have) is used to describe health conditions and physical states. Tengo catarro means 'I have a cold' — literally 'I have a cold.' This pattern works for illnesses, pains, and many everyday feelings.",
  clusters: [
    // ── Cluster 1: Enfermedades — Illnesses ──────────────────────────────
    {
      heading: "Enfermedades — Illnesses",
      noteInline: "catarro  cold  ·  fiebre  fever  ·  tos  cough  ·  gripe  flu",
      pairs: [
        {
          imageWord: "catarro",
          imageDescription: "a person bundled up in a blanket on a sofa, nose red, holding a tissue",
          question: "¿Qué tiene?",
          questionTranslation: "What do you have? / What does he/she have?",
          answer: "Tengo catarro.",
          answerTranslation: "I have a cold.",
        },
        {
          imageWord: "fiebre",
          imageDescription: "a person lying in bed with a thermometer in their mouth and a warm compress on their forehead",
          question: "¿Tiene fiebre?",
          questionTranslation: "Do you have a fever?",
          answer: "Sí, tengo fiebre.",
          answerTranslation: "Yes, I have a fever.",
        },
        {
          imageWord: "tos",
          imageDescription: "a person covering their mouth with a fist while coughing, looking uncomfortable",
          question: "¿Qué tiene?",
          questionTranslation: "What do you have?",
          answer: "Tengo tos.",
          answerTranslation: "I have a cough.",
        },
        {
          imageWord: "gripe",
          imageDescription: "a person in bed looking ill, surrounded by medicine bottles and a box of tissues",
          question: "¿Tiene gripe?",
          questionTranslation: "Do you have the flu?",
          answer: "Sí, tengo gripe.",
          answerTranslation: "Yes, I have the flu.",
        },
      ],
      conjugationTable: [
        { conjugated: "tengo",   translation: "I have" },
        { conjugated: "tiene",   translation: "you have / he, she has" },
        { conjugated: "tenemos", translation: "we have" },
        { conjugated: "tienen",  translation: "they have / you all have" },
      ],
      grammarRule: "Tener means 'to have.' With health conditions, tengo + illness = I have that illness. Tengo is irregular: note the -go ending in yo, just like salgo, vengo, and pongo.",
    },
    // ── Cluster 2: Dolores — Pains ────────────────────────────────────────
    {
      heading: "Dolores — Pains",
      noteInline: "dolor  pain  ·  dolor de cabeza  headache  ·  dolor de garganta  sore throat  ·  dolor de estómago  stomachache  ·  dolor de espalda  backache",
      pairs: [
        {
          imageWord: "cabeza",
          imageDescription: "a person holding both hands on their temples with eyes closed, grimacing in pain",
          question: "¿Qué tiene?",
          questionTranslation: "What do you have?",
          answer: "Tengo dolor de cabeza.",
          answerTranslation: "I have a headache.",
        },
        {
          imageWord: "garganta",
          imageDescription: "a person touching their neck with one hand and looking pained, mouth slightly open",
          question: "¿Tiene dolor de garganta?",
          questionTranslation: "Do you have a sore throat?",
          answer: "Sí, tengo dolor de garganta.",
          answerTranslation: "Yes, I have a sore throat.",
        },
        {
          imageWord: "estómago",
          imageDescription: "a person sitting hunched forward with one hand pressed against their abdomen, looking uncomfortable",
          question: "¿Tiene dolor de estómago?",
          questionTranslation: "Do you have a stomachache?",
          answer: "Sí, tengo dolor de estómago.",
          answerTranslation: "Yes, I have a stomachache.",
        },
        {
          imageWord: "espalda",
          imageDescription: "a person standing and pressing one hand into their lower back, wincing slightly",
          question: "¿Tiene dolor de espalda?",
          questionTranslation: "Do you have a backache?",
          answer: "Sí, tengo dolor de espalda.",
          answerTranslation: "Yes, I have a backache.",
        },
      ],
      grammarRule: "Dolor de + body part = pain in that area.\nTengo dolor de cabeza = I have a headache (lit. 'I have pain of head.')\nNote the accent on estómago: es-TÓ-ma-go.",
      sentenceColumns: [
        {
          label: "Verb",
          items: [
            { text: "Tengo",   translation: "I have" },
            { text: "Tiene",   translation: "You have / He, she has" },
            { text: "Tenemos", translation: "We have" },
            { text: "Tienen",  translation: "They have" },
          ],
        },
        {
          label: "Condition",
          items: [
            { text: "catarro.",             translation: "a cold." },
            { text: "fiebre.",              translation: "a fever." },
            { text: "tos.",                 translation: "a cough." },
            { text: "gripe.",               translation: "the flu." },
            { text: "dolor de cabeza.",     translation: "a headache." },
            { text: "dolor de garganta.",   translation: "a sore throat." },
            { text: "dolor de estómago.",   translation: "a stomachache." },
            { text: "dolor de espalda.",    translation: "a backache." },
          ],
        },
      ],
      noteAfter: "¿Cómo se siente? — How do you feel? / How does he/she feel? Use this question to open any conversation about health.",
    },
  ],
};

// ── Spanish 2 Unit 11: ¿A Qué Hora Sale? — Transporte y Horarios (pp. 170–171) ─
// Supplemented from p. 170–171 — departure/arrival schedules.
// chapterTitleKey "a qué hora" matches DB unit "¿A Qué Hora Sale? — Transporte y Horarios".
// Three clusters: sale (departures), llega (arrivals), sentence combiner.

const SALE_LLEGA_CHAPTER: GustUnitContent = {
  chapterTitleKey: "a qué hora",
  conceptLabel: "Sale / Llega",
  conceptDefinition: "leaves / arrives",
  introNote: "¿A qué hora sale? — At what time does it leave? ¿A qué hora llega? — At what time does it arrive? Use these two verbs to navigate any transportation schedule in Spanish.",
  clusters: [
    // ── Cluster 1: Sale — departures ─────────────────────────────────────
    {
      heading: "¿A Qué Hora Sale? — Departures",
      noteInline: "sale  it leaves / you leave  ·  salen  they leave  ·  salimos  we leave  ·  salgo  I leave",
      pairs: [
        {
          imageWord: "tren",
          imageDescription: "a long passenger train pulling out of a busy urban station platform",
          question: "¿A qué hora sale el tren?",
          questionTranslation: "At what time does the train leave?",
          answer: "El tren sale a las nueve.",
          answerTranslation: "The train leaves at nine.",
        },
        {
          imageWord: "avión",
          imageDescription: "a commercial jet airplane lifting off a runway into a blue sky",
          question: "¿A qué hora sale el avión?",
          questionTranslation: "At what time does the plane leave?",
          answer: "El avión sale a las doce.",
          answerTranslation: "The plane leaves at twelve.",
        },
        {
          imageWord: "autobús",
          imageDescription: "a large intercity coach bus parked at a departure terminal",
          question: "¿A qué hora sale el autobús?",
          questionTranslation: "At what time does the bus leave?",
          answer: "El autobús sale a las dos.",
          answerTranslation: "The bus leaves at two.",
        },
        {
          imageWord: "barco",
          imageDescription: "a large ferry boat pulling away from a dock at a busy port",
          question: "¿A qué hora sale el barco?",
          questionTranslation: "At what time does the boat leave?",
          answer: "El barco sale a las seis.",
          answerTranslation: "The boat leaves at six.",
        },
      ],
      conjugationTable: [
        { conjugated: "salgo",   translation: "I leave / I go out" },
        { conjugated: "sale",    translation: "it leaves / you leave / he, she leaves" },
        { conjugated: "salimos", translation: "we leave" },
        { conjugated: "salen",   translation: "they leave / you all leave" },
      ],
      grammarRule: "Salir means 'to leave' or 'to go out.' The yo form is irregular: salgo. All other present-tense forms are regular.",
    },
    // ── Cluster 2: Llega — arrivals ──────────────────────────────────────
    {
      heading: "¿A Qué Hora Llega? — Arrivals",
      noteInline: "llega  it arrives / you arrive  ·  llegan  they arrive  ·  llegamos  we arrive  ·  llego  I arrive",
      pairs: [
        {
          imageWord: "tren",
          imageDescription: "a passenger train arriving at a station platform where people are waiting",
          question: "¿A qué hora llega el tren?",
          questionTranslation: "At what time does the train arrive?",
          answer: "El tren llega a las tres.",
          answerTranslation: "The train arrives at three.",
        },
        {
          imageWord: "avión",
          imageDescription: "a commercial airplane landing on a runway with airport buildings in the background",
          question: "¿A qué hora llega el avión?",
          questionTranslation: "At what time does the plane arrive?",
          answer: "El avión llega a las ocho.",
          answerTranslation: "The plane arrives at eight.",
        },
        {
          imageWord: "autobús",
          imageDescription: "a coach bus arriving at a bus station terminal with passengers ready to board",
          question: "¿A qué hora llega el autobús?",
          questionTranslation: "At what time does the bus arrive?",
          answer: "El autobús llega a las cinco.",
          answerTranslation: "The bus arrives at five.",
        },
        {
          imageWord: "barco",
          imageDescription: "a large ferry arriving at a harbor dock with ropes being thrown ashore",
          question: "¿A qué hora llega el barco?",
          questionTranslation: "At what time does the boat arrive?",
          answer: "El barco llega a las diez.",
          answerTranslation: "The boat arrives at ten.",
        },
      ],
      conjugationTable: [
        { conjugated: "llego",    translation: "I arrive" },
        { conjugated: "llega",    translation: "it arrives / you arrive / he, she arrives" },
        { conjugated: "llegamos", translation: "we arrive" },
        { conjugated: "llegan",   translation: "they arrive / you all arrive" },
      ],
      grammarRule: "Llegar follows regular AR patterns in the present tense. Use ¿A qué hora llega...? to ask about any arriving vehicle.",
      sentenceColumns: [
        {
          label: "Vehicle",
          items: [
            { text: "El tren",    translation: "The train" },
            { text: "El avión",   translation: "The plane" },
            { text: "El autobús", translation: "The bus" },
            { text: "El barco",   translation: "The boat" },
          ],
        },
        {
          label: "Action",
          items: [
            { text: "sale",   translation: "leaves" },
            { text: "llega",  translation: "arrives" },
          ],
        },
        {
          label: "Time",
          items: [
            { text: "a las nueve.",  translation: "at nine." },
            { text: "a las doce.",   translation: "at twelve." },
            { text: "a las dos.",    translation: "at two." },
            { text: "a las seis.",   translation: "at six." },
            { text: "a las tres.",   translation: "at three." },
            { text: "a las ocho.",   translation: "at eight." },
            { text: "a las cinco.",  translation: "at five." },
            { text: "a las diez.",   translation: "at ten." },
          ],
        },
      ],
      noteAfter: "¿A qué hora? means 'At what time?' — the most useful phrase for reading any schedule, timetable, or departure board.",
    },
  ],
};

// ── Spanish 2 Unit 5: ¿Cómo Está? — States & Feelings (p. 81) ─────────
// Replaces the redundant "Los Números II" slot.
// chapterTitleKey "cómo está" matches "¿Cómo Está? — States & Feelings" (unit name in DB).
// Does NOT collide with ESTA_LIMPIO_CHAPTER key "está:" because this title has no colon after está.

const ESTA_CONTENTO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "cómo está",
  conceptLabel: "Está contento",
  conceptDefinition: "He / she is happy",
  introNote: "Estar describes how someone feels right now — not who they are. The adjective ending matches the person: -o for masculine, -a for feminine. Está triste is the same for both.",
  clusters: [
    // ── Cluster 1: Positive states (pp. 81) ─────────────────────────────
    {
      heading: "Contento, Listo, Cómodo",
      noteInline: "Está contento / contenta  He/she is happy  ·  Estoy contento / contenta  I am happy",
      pairs: [
        {
          imageWord: "contento",
          imageDescription: "a smiling man sitting comfortably at a sunny café table",
          question: "¿Está contento?",
          questionTranslation: "Is he happy? / Are you happy?",
          answer: "Sí, estoy muy contento.",
          answerTranslation: "Yes, I am very happy.",
        },
        {
          imageWord: "lista",
          imageDescription: "a woman standing at the door with her coat on, ready to leave",
          question: "¿Está lista?",
          questionTranslation: "Is she ready? / Are you ready?",
          answer: "Sí, estoy lista.",
          answerTranslation: "Yes, I am ready.",
        },
        {
          imageWord: "cómodo",
          imageDescription: "a man relaxing in a large armchair with a blanket",
          question: "¿Está cómodo?",
          questionTranslation: "Is he comfortable? / Are you comfortable?",
          answer: "Sí, estoy muy cómodo.",
          answerTranslation: "Yes, I am very comfortable.",
        },
        {
          imageWord: "enamorada",
          imageDescription: "a woman with a warm smile looking at a bouquet of flowers",
          question: "¿Está enamorada?",
          questionTranslation: "Is she in love? / Are you in love?",
          answer: "Sí, estoy enamorada.",
          answerTranslation: "Yes, I am in love.",
        },
      ],
      grammarRule: "Masculine: contento · listo · cómodo · enamorado\nFeminine: contenta · lista · cómoda · enamorada",
    },
    // ── Cluster 2: Difficult states (pp. 81) ──────────────────────────────
    {
      heading: "Cansado, Enfermo, Enojado",
      noteInline: "Está cansado / cansada  He/she is tired  ·  Está triste  He/she is sad (same for both)",
      pairs: [
        {
          imageWord: "cansada",
          imageDescription: "a woman with tired eyes resting her head on her hand at a desk",
          question: "¿Está cansada?",
          questionTranslation: "Is she tired? / Are you tired?",
          answer: "Sí, estoy muy cansada.",
          answerTranslation: "Yes, I am very tired.",
        },
        {
          imageWord: "enfermo",
          imageDescription: "a man lying in bed with a thermometer, looking unwell",
          question: "¿Está enfermo?",
          questionTranslation: "Is he sick? / Are you sick?",
          answer: "Sí, estoy enfermo.",
          answerTranslation: "Yes, I am sick.",
        },
        {
          imageWord: "enojada",
          imageDescription: "a woman with crossed arms and a firm expression",
          question: "¿Está enojada?",
          questionTranslation: "Is she angry? / Are you angry?",
          answer: "Sí, estoy un poco enojada.",
          answerTranslation: "Yes, I am a little angry.",
        },
        {
          imageWord: "aburrido",
          imageDescription: "a man staring blankly at a wall, looking bored",
          question: "¿Está aburrido?",
          questionTranslation: "Is he bored? / Are you bored?",
          answer: "Sí, estoy muy aburrido.",
          answerTranslation: "Yes, I am very bored.",
        },
        {
          imageWord: "triste",
          imageDescription: "a person sitting alone by a window on a rainy day",
          question: "¿Está triste?",
          questionTranslation: "Is he/she sad? / Are you sad?",
          answer: "Sí, estoy un poco triste.",
          answerTranslation: "Yes, I am a little sad.",
        },
        {
          imageWord: "sola",
          imageDescription: "a woman sitting alone at a large empty table",
          question: "¿Está sola?",
          questionTranslation: "Is she alone? / Are you alone?",
          answer: "Sí, estoy sola.",
          answerTranslation: "Yes, I am alone.",
        },
      ],
      grammarRule: "Triste never changes: está triste (both masculine and feminine).\nSolo → sola · cansado → cansada · enfermo → enferma · enojado → enojada",
    },
    // ── Cluster 3: Wellness scale + plural forms (pp. 81) ─────────────────
    {
      heading: "Bien, Mejor, Mal, Peor",
      noteInline: "Está bien  He/she is well  ·  Está mejor  He/she is better  ·  Está mal  He/she is not well  ·  Está peor  He/she is worse",
      pairs: [
        {
          imageWord: "bien",
          imageDescription: "a person giving a thumbs-up with a relaxed smile",
          question: "¿Cómo está usted?",
          questionTranslation: "How are you?",
          answer: "Estoy bien, gracias.",
          answerTranslation: "I am well, thank you.",
        },
        {
          imageWord: "mejor",
          imageDescription: "a person leaving a doctor's office looking relieved and healthier",
          question: "¿Está mejor hoy?",
          questionTranslation: "Are you better today?",
          answer: "Sí, estoy mucho mejor hoy.",
          answerTranslation: "Yes, I am much better today.",
        },
        {
          imageWord: "mal",
          imageDescription: "a person holding their head and looking pale",
          question: "¿Está mal?",
          questionTranslation: "Are you not well? / Is he/she not well?",
          answer: "Sí, estoy mal.",
          answerTranslation: "Yes, I am not well.",
        },
        {
          imageWord: "peor",
          imageDescription: "a sick person in bed looking worse than before",
          question: "¿Está peor hoy?",
          questionTranslation: "Are you worse today?",
          answer: "Sí, estoy peor hoy.",
          answerTranslation: "Yes, I am worse today.",
        },
      ],
      conjugationTable: [
        { conjugated: "Estoy contento / contenta",   translation: "I am happy" },
        { conjugated: "Está contento / contenta",    translation: "you / he / she is happy" },
        { conjugated: "Estamos contentos / contentas", translation: "we are happy" },
        { conjugated: "Están contentos / contentas", translation: "they / you all are happy" },
      ],
      noteAfter: "These four forms work with any state: estoy cansado · está enferma · estamos listos · están solos.",
    },
  ],
};

// ── Spanish 2 Unit 9: ¿Qué Está Haciendo? — Present Progressive (pp. 182–185) ──
// Source: See It and Say It in Spanish, pp. 182–185
// chapterTitleKey "qué está haciendo" matches the DB unit name.
// DB fix applied: chapter_type changed from 'progressive' → 'verb_unit' so VerbUnit routes here.
//
// Page 182: Four instruments — piano, guitarra, acordeón, violín (all tocando)
//           Note: "the English ending -ing is -ando for -ar verbs"
//           Examples: estudiando, comprando, hablando, cantando
// Page 183: ¿Está hablando por teléfono? / ¿Está nadando? / estudiando
// Page 184: -iendo verbs — escribir, vender, aprender
//           ¿Qué está haciendo? / Estoy vendiendo la lancha / Estoy escribiendo una carta
//           Combinator: escribiendo un artículo / aprendiendo español / la lección / el poema
//           Note: "-ing is -yendo for ER/IR verbs": escribiendo, recibiendo, viendo, viviendo

const ESTA_TOCANDO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "qué está haciendo",
  conceptLabel: "Estoy tocando",
  conceptDefinition: "I am playing",
  introNote: "To say what is happening right now, use estoy / está + the present participle. For AR verbs: -ando. For ER and IR verbs: -iendo. Notice that the English ending -ing is -ando for AR verbs in Spanish.",
  clusters: [
    // ── Cluster 1: p.182 — The four instruments (tocando) ────────────────
    {
      heading: "Tocando — I Am Playing",
      noteInline: "AR verbs: drop -ar, add -ando  ·  tocar → tocando  ·  estudiar → estudiando  ·  comprar → comprando  ·  hablar → hablando  ·  cantar → cantando",
      pairs: [
        {
          imageWord: "piano",
          imageDescription: "a person's hands playing the keys of a grand piano",
          question: "¿Está tocando el piano?",
          questionTranslation: "Are you playing the piano?",
          answer: "Sí, estoy tocando el piano.",
          answerTranslation: "Yes, I am playing the piano.",
        },
        {
          imageWord: "guitarra",
          imageDescription: "a person strumming an acoustic guitar",
          question: "¿Está tocando la guitarra?",
          questionTranslation: "Are you playing the guitar?",
          answer: "Sí, estoy tocando la guitarra.",
          answerTranslation: "Yes, I am playing the guitar.",
        },
        {
          imageWord: "acordeón",
          imageDescription: "a musician playing a button accordion with both hands",
          question: "¿Está tocando el acordeón?",
          questionTranslation: "Are you playing the accordion?",
          answer: "Sí, estoy tocando el acordeón.",
          answerTranslation: "Yes, I am playing the accordion.",
        },
        {
          imageWord: "violín",
          imageDescription: "a musician drawing a bow across the strings of a violin",
          question: "¿Está tocando el violín?",
          questionTranslation: "Are you playing the violin?",
          answer: "Sí, estoy tocando el violín.",
          answerTranslation: "Yes, I am playing the violin.",
        },
      ],
      conjugationTable: [
        { conjugated: "Estoy tocando",    translation: "I am playing" },
        { conjugated: "Está tocando",     translation: "you / he / she is playing" },
        { conjugated: "Estamos tocando",  translation: "we are playing" },
        { conjugated: "Están tocando",    translation: "they / you all are playing" },
      ],
    },
    // ── Cluster 2: p.183 — Hablando, Nadando, Estudiando ─────────────────
    {
      heading: "Hablando, Nadando, Estudiando",
      noteInline: "¿Está hablando?  Are you talking?  ·  ¿Está nadando?  Are you swimming?  ·  The negative: No, no estoy nadando.",
      pairs: [
        {
          imageWord: "teléfono",
          imageDescription: "a telephone handset on a white background",
          question: "¿Está hablando por teléfono?",
          questionTranslation: "Are you talking on the phone?",
          answer: "Sí, estoy hablando por teléfono.",
          answerTranslation: "Yes, I am talking on the phone.",
        },
        {
          imageWord: "natación",
          imageDescription: "a person swimming laps in an outdoor pool",
          question: "¿Está nadando?",
          questionTranslation: "Are you swimming?",
          answer: "No, no estoy nadando.",
          answerTranslation: "No, I am not swimming.",
        },
        {
          imageWord: "español",
          imageDescription: "a student at a desk with a Spanish textbook open in front of them",
          question: "¿Está estudiando español?",
          questionTranslation: "Are you studying Spanish?",
          answer: "Sí, estoy estudiando español.",
          answerTranslation: "Yes, I am studying Spanish.",
        },
      ],
    },
    // ── Cluster 3: p.184 — -iendo verbs + ¿Qué está haciendo? ────────────
    // Note: "-ing is -yendo for ER and IR verbs"
    // Examples from book: escribiendo, recibiendo, viendo, viviendo
    {
      heading: "Escribiendo, Vendiendo, Aprendiendo",
      noteInline: "ER / IR verbs: drop -er / -ir, add -iendo  ·  escribir → escribiendo  ·  vender → vendiendo  ·  aprender → aprendiendo  ·  recibir → recibiendo  ·  ver → viendo  ·  vivir → viviendo",
      pairs: [
        {
          imageWord: "lancha",
          imageDescription: "a person standing beside a small boat with a 'for sale' sign",
          question: "¿Qué está haciendo?",
          questionTranslation: "What are you doing?",
          answer: "Estoy vendiendo la lancha.",
          answerTranslation: "I am selling the boat.",
        },
        {
          imageWord: "carta",
          imageDescription: "a person writing a letter by hand at a wooden desk",
          question: "¿Qué está haciendo?",
          questionTranslation: "What are you doing?",
          answer: "Estoy escribiendo una carta.",
          answerTranslation: "I am writing a letter.",
        },
      ],
      sentenceColumns: [
        {
          label: "Phrase",
          items: [
            { text: "Estoy escribiendo",    translation: "I am writing" },
            { text: "Estoy aprendiendo",    translation: "I am learning" },
          ],
        },
        {
          label: "Object",
          items: [
            { text: "un artículo.",         translation: "an article." },
            { text: "español.",             translation: "Spanish." },
            { text: "la lección.",          translation: "the lesson." },
            { text: "el poema.",            translation: "the poem." },
          ],
        },
      ],
    },
    // ── Cluster 4: pp. 184–185 — Leyendo (irregular) ─────────────────────
    {
      heading: "¿Qué Está Haciendo? — Leyendo",
      noteInline: "leer → leyendo  (not leyiendo — the i drops when surrounded by vowels)",
      pairs: [
        {
          imageWord: "periódico",
          imageDescription: "a person reading a folded newspaper on a park bench",
          question: "¿Está leyendo el periódico?",
          questionTranslation: "Are you reading the newspaper?",
          answer: "Sí, estoy leyendo el periódico.",
          answerTranslation: "Yes, I am reading the newspaper.",
        },
        {
          imageWord: "novela",
          imageDescription: "a person reading a thick novel in an armchair by a lamp",
          question: "¿Qué está haciendo?",
          questionTranslation: "What are you doing?",
          answer: "Estoy leyendo una novela.",
          answerTranslation: "I am reading a novel.",
        },
        {
          imageWord: "composición",
          imageDescription: "a student writing a composition at a school desk",
          question: "¿Qué está haciendo?",
          questionTranslation: "What are you doing?",
          answer: "Estoy escribiendo una composición.",
          answerTranslation: "I am writing a composition.",
        },
      ],
      grammarRule: "leer → leyendo  ·  All other ER/IR verbs follow the regular -iendo pattern: escribir → escribiendo, recibir → recibiendo, ver → viendo, vivir → viviendo.",
      noteAfter: "¿Qué está haciendo? is the open question — any -ando or -iendo answer works.",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter: Me Levanto — Verbos Reflexivos
// Source: the textbook, Lesson 38 (pp. 342–361)
// chapterTitleKey "me levanto" matches DB unit "Me Levanto — Verbos Reflexivos"
// ═══════════════════════════════════════════════════════════════════════════════

const ME_LEVANTO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "me levanto",
  conceptLabel: "Me Levanto",
  conceptDefinition: "I get up · Reflexive Verbs",
  introNote: "A reflexive verb reflects the action back upon the subject. Many Spanish reflexive verbs describe physical actions — the things you do to yourself when getting ready.",
  clusters: [

    // ── Cluster 1: Physical Verb List ─────────────────────────────────────────
    {
      heading: "Verbos Reflexivos",
      noteInline: "bañarse  to bathe · lavarse  to wash · peinarse  to comb · secarse  to dry · afeitarse  to shave · levantarse  to get up · acostarse  to go to bed · ponerse  to put on · quitarse  to take off · pararse  to stand up · sentarse  to sit down",
      pairs: [],
      noteAfter: "Reflexive pronouns: me (myself), se (yourself / himself / herself), nos (ourselves). They always appear immediately before the verb.",
    },

    // ── Cluster 2: Morning Routine — Preterite Dialogue ───────────────────────
    {
      heading: "Esta Mañana — This Morning",
      noteInline: "Me bañé  I bathed · Me peiné  I combed · Me lavé  I washed",
      pairs: [
        {
          imageWord: "cama",
          imageDescription: "a comfortable bed in a bedroom at night with bedside lamp",
          question: "¿A qué hora se acostó anoche?",
          questionTranslation: "At what time did you go to bed last night?",
          answer: "Anoche me acosté a las once.",
          answerTranslation: "Last night I went to bed at eleven.",
        },
        {
          imageWord: "despertador",
          imageDescription: "an alarm clock showing seven o'clock on a bedside table",
          question: "¿A qué hora se levantó esta mañana?",
          questionTranslation: "At what time did you get up this morning?",
          answer: "Me levanté a las siete esta mañana.",
          answerTranslation: "I got up at seven this morning.",
        },
        {
          imageWord: "jabón",
          imageDescription: "a bar of soap and a shower head with water running",
          question: "¿Se bañó con agua y jabón?",
          questionTranslation: "Did you bathe with soap and water?",
          answer: "Sí, me bañé con agua y jabón.",
          answerTranslation: "Yes, I bathed with soap and water.",
        },
        {
          imageWord: "toalla",
          imageDescription: "a fluffy white towel folded neatly on a white background",
          question: "¿Se secó con una toalla?",
          questionTranslation: "Did you dry off with a towel?",
          answer: "Sí, me sequé con una toalla.",
          answerTranslation: "Yes, I dried off with a towel.",
        },
        {
          imageWord: "peine",
          imageDescription: "a comb lying on a white background",
          question: "¿Se peinó usted?",
          questionTranslation: "Did you comb your hair?",
          answer: "Sí, me peiné con un peine.",
          answerTranslation: "Yes, I combed my hair with a comb.",
        },
        {
          imageWord: "cara",
          imageDescription: "a person gently washing their face at a bathroom sink",
          question: "¿Se lavó la cara?",
          questionTranslation: "Did you wash your face?",
          answer: "Sí, me lavé la cara.",
          answerTranslation: "Yes, I washed my face.",
        },
        {
          imageWord: "afeitarse",
          imageDescription: "a razor and shaving cream on a bathroom shelf",
          question: "¿Se afeitó usted?",
          questionTranslation: "Did you shave?",
          answer: "Sí, me afeité.",
          answerTranslation: "Yes, I shaved.",
        },
        {
          imageWord: "pelo",
          imageDescription: "a person rinsing hair under a shower",
          question: "¿Se lavó el pelo?",
          questionTranslation: "Did you wash your hair?",
          answer: "Sí, me lavé el pelo.",
          answerTranslation: "Yes, I washed my hair.",
        },
      ],
    },

    // ── Cluster 3: Getting Dressed — Ponerse ──────────────────────────────────
    {
      heading: "Me Puse — I Put On",
      noteInline: "Me puse  I put on · ¿Se puso?  Did you put on?",
      pairs: [
        {
          imageWord: "camisa",
          imageDescription: "a button-up shirt laid flat on a white background",
          question: "¿Se puso la camisa?",
          questionTranslation: "Did you put on your shirt?",
          answer: "Sí, me puse la camisa.",
          answerTranslation: "Yes, I put on the shirt.",
        },
        {
          imageWord: "zapatos",
          imageDescription: "a pair of leather shoes on a white background",
          question: "¿Se puso los zapatos?",
          questionTranslation: "Did you put on your shoes?",
          answer: "Sí, me puse los zapatos.",
          answerTranslation: "Yes, I put on the shoes.",
        },
        {
          imageWord: "corbata",
          imageDescription: "a necktie laid flat on a white background",
          question: "¿Se puso la corbata?",
          questionTranslation: "Did you put on your tie?",
          answer: "Sí, me puse la corbata.",
          answerTranslation: "Yes, I put on the tie.",
        },
        {
          imageWord: "traje",
          imageDescription: "a suit jacket and trousers hanging neatly on a hanger",
          question: "¿Se puso el traje?",
          questionTranslation: "Did you put on your suit?",
          answer: "Sí, me puse el traje.",
          answerTranslation: "Yes, I put on the suit.",
        },
      ],
      grammarRule: "After a reflexive verb, you do not use possessive adjectives. · Me puse el sombrero. / I put on the hat. (not: mi sombrero) · Me lavé las manos. / I washed the hands. (not: mis manos)",
    },

    // ── Cluster 4: Ponerse a — I Started To ───────────────────────────────────
    {
      heading: "Me Puse a... — I Started To...",
      noteInline: "Ponerse a  to start to do something",
      pairs: [
        {
          question: "¿Se puso a trabajar?",
          questionTranslation: "Did you start to work?",
          answer: "Sí, me puse a trabajar.",
          answerTranslation: "Yes, I started to work.",
        },
        {
          question: "¿Se puso a cantar?",
          questionTranslation: "Did you start to sing?",
          answer: "Sí, me puse a cantar.",
          answerTranslation: "Yes, I started to sing.",
        },
        {
          question: "¿Se puso a llorar?",
          questionTranslation: "Did you start to cry?",
          answer: "No, no me puse a llorar.",
          answerTranslation: "No, I did not start to cry.",
        },
        {
          question: "¿Se puso a reír?",
          questionTranslation: "Did you start to laugh?",
          answer: "Sí, me puse a reír.",
          answerTranslation: "Yes, I started to laugh.",
        },
      ],
      noteAfter: "\"Ponerse\" also means \"to become\" when followed by an adjective: Se puso furioso. (He became furious.) Se puso pálido. (He turned pale.)",
    },

    // ── Cluster 5: Reciprocal Reflexives — Each Other ─────────────────────────
    {
      heading: "Nos Vemos — Each Other",
      noteInline: "Reflexive pronouns also express actions that two people do to one another.",
      pairs: [],
      grammarRule: "Se besaron. / They kissed each other. · Nos vemos. / We see each other. · No se hablan. / They don't speak to each other. · Se comprenden. / They understand each other. · Se parecen. / They resemble each other.",
    },

    // ── Cluster 6: Future Dialogue — Me Voy a... ──────────────────────────────
    {
      heading: "¿Qué Va a Hacer? — Going To...",
      noteInline: "Me voy a bañar  I'm going to bathe · ¿Se va a...?  Are you going to...?",
      pairs: [
        {
          question: "¿Se va a bañar?",
          questionTranslation: "Are you going to bathe?",
          answer: "Sí, me voy a bañar.",
          answerTranslation: "Yes, I'm going to bathe.",
        },
        {
          question: "¿A qué hora se va a levantar mañana?",
          questionTranslation: "At what time are you going to get up tomorrow?",
          answer: "Me voy a levantar a las seis.",
          answerTranslation: "I'm going to get up at six.",
        },
        {
          question: "¿Se va a afeitar?",
          questionTranslation: "Are you going to shave?",
          answer: "Sí, me voy a afeitar.",
          answerTranslation: "Yes, I'm going to shave.",
        },
        {
          question: "¿Se va a poner la corbata?",
          questionTranslation: "Are you going to put on your tie?",
          answer: "Sí, me voy a poner la corbata.",
          answerTranslation: "Yes, I'm going to put on the tie.",
        },
      ],
    },

    // ── Cluster 7: Conjugation Reference — Bañarse ────────────────────────────
    {
      heading: "Conjugaciones",
      noteInline: "BAÑARSE  to bathe (yourself)",
      pairs: [],
      conjugationTable: [
        { conjugated: "— Present —", translation: "" },
        { conjugated: "Me baño", translation: "I bathe myself" },
        { conjugated: "Se baña", translation: "you / he / she bathes" },
        { conjugated: "Nos bañamos", translation: "we bathe ourselves" },
        { conjugated: "Se bañan", translation: "they bathe themselves" },
        { conjugated: "— Preterite —", translation: "" },
        { conjugated: "Me bañé", translation: "I bathed myself" },
        { conjugated: "Se bañó", translation: "you / he / she bathed" },
        { conjugated: "Nos bañamos", translation: "we bathed ourselves" },
        { conjugated: "Se bañaron", translation: "they bathed themselves" },
      ],
    },

    // ── Cluster 8: Conjugation Reference — Lavarse ────────────────────────────
    {
      noteInline: "LAVARSE  to wash (yourself)",
      pairs: [],
      conjugationTable: [
        { conjugated: "— Present —", translation: "" },
        { conjugated: "Me lavo", translation: "I wash myself" },
        { conjugated: "Se lava", translation: "you / he / she washes" },
        { conjugated: "Nos lavamos", translation: "we wash ourselves" },
        { conjugated: "Se lavan", translation: "they wash themselves" },
        { conjugated: "— Preterite —", translation: "" },
        { conjugated: "Me lavé", translation: "I washed myself" },
        { conjugated: "Se lavó", translation: "you / he / she washed" },
        { conjugated: "Nos lavamos", translation: "we washed ourselves" },
        { conjugated: "Se lavaron", translation: "they washed themselves" },
      ],
    },

    // ── Cluster 9: Conjugation Reference — Levantarse / Acostarse ────────────
    {
      noteInline: "LEVANTARSE  to get up · ACOSTARSE  to go to bed",
      pairs: [],
      conjugationTable: [
        { conjugated: "— Present —", translation: "" },
        { conjugated: "Me levanto", translation: "I get up" },
        { conjugated: "Se levanta", translation: "you / he / she gets up" },
        { conjugated: "Nos levantamos", translation: "we get up" },
        { conjugated: "Se levantan", translation: "they get up" },
        { conjugated: "Me acuesto", translation: "I go to bed" },
        { conjugated: "Se acuesta", translation: "you / he / she goes to bed" },
        { conjugated: "Nos acostamos", translation: "we go to bed" },
        { conjugated: "Se acuestan", translation: "they go to bed" },
        { conjugated: "— Preterite —", translation: "" },
        { conjugated: "Me levanté", translation: "I got up" },
        { conjugated: "Se levantó", translation: "you / he / she got up" },
        { conjugated: "Nos levantamos", translation: "we got up" },
        { conjugated: "Se levantaron", translation: "they got up" },
        { conjugated: "Me acosté", translation: "I went to bed" },
        { conjugated: "Se acostó", translation: "you / he / she went to bed" },
        { conjugated: "Nos acostamos", translation: "we went to bed" },
        { conjugated: "Se acostaron", translation: "they went to bed" },
      ],
    },

    // ── Cluster 10: Conjugation Reference — Ponerse ───────────────────────────
    {
      noteInline: "PONERSE  to put on (clothing)",
      pairs: [],
      conjugationTable: [
        { conjugated: "— Present —", translation: "" },
        { conjugated: "Me pongo", translation: "I put on" },
        { conjugated: "Se pone", translation: "you / he / she puts on" },
        { conjugated: "Nos ponemos", translation: "we put on" },
        { conjugated: "Se ponen", translation: "they put on" },
        { conjugated: "— Preterite (irregular) —", translation: "" },
        { conjugated: "Me puse", translation: "I put on" },
        { conjugated: "Se puso", translation: "you / he / she put on" },
        { conjugated: "Nos pusimos", translation: "we put on" },
        { conjugated: "Se pusieron", translation: "they put on" },
      ],
      noteAfter: "Ponerse has an irregular preterite stem: puse, puso, pusimos, pusieron.",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter: He Comprado — Present Perfect
// Source: See It and Say It in Spanish, pp. 188–189
// chapterTitleKey "he comprado" matches DB unit "He Comprado — El Presente Perfecto"
// ═══════════════════════════════════════════════════════════════════════════════

const HE_COMPRADO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "he comprado",
  conceptLabel: "He Comprado",
  conceptDefinition: "I have bought · Present Perfect Tense",
  introNote: "The present perfect is formed with: He / Ha / Hemos / Han + past participle. -AR verbs: drop -AR and add -ado. -ER and -IR verbs: drop the ending and add -ido.",
  clusters: [

    // ── Cluster 1: -AR Verbs (-ado) ───────────────────────────────────────────
    {
      heading: "-AR Verbs → -ado",
      noteInline: "He comprado  I have bought · ¿Ha comprado?  Have you bought?",
      pairs: [
        {
          imageWord: "bicicleta",
          imageDescription: "a bicycle leaning against a white wall",
          question: "¿Ha comprado la bicicleta?",
          questionTranslation: "Have you bought the bicycle?",
          answer: "No, no he comprado la bicicleta todavía.",
          answerTranslation: "No, I have not bought the bicycle yet.",
        },
        {
          imageWord: "estudiar",
          imageDescription: "an open textbook and pencil on a desk",
          question: "¿Ha estudiado esta semana?",
          questionTranslation: "Have you studied this week?",
          answer: "Sí, he estudiado mucho esta semana.",
          answerTranslation: "Yes, I have studied a lot this week.",
        },
        {
          imageWord: "casa",
          imageDescription: "a small house with a front yard on a sunny day",
          question: "¿Ha comprado la casa?",
          questionTranslation: "Have you bought the house?",
          answer: "Sí, he comprado la casa.",
          answerTranslation: "Yes, I have bought the house.",
        },
        {
          imageWord: "cuenta",
          imageDescription: "a restaurant bill or invoice on a table",
          question: "¿Ha pagado la cuenta?",
          questionTranslation: "Have you paid the bill?",
          answer: "Sí, he pagado la cuenta.",
          answerTranslation: "Yes, I have paid the bill.",
        },
      ],
      grammarRule: "-AR verb present perfect: drop -AR, add -ado · comprar → comprado · estudiar → estudiado · pagar → pagado",
      conjugationTable: [
        { conjugated: "He comprado", translation: "I have bought" },
        { conjugated: "Ha comprado", translation: "you / he / she have bought" },
        { conjugated: "Hemos comprado", translation: "we have bought" },
        { conjugated: "Han comprado", translation: "they have bought" },
      ],
      noteAfter: "Vocabulary: esta semana (this week) · todavía (yet / still) · mucho (a lot / much)",
    },

    // ── Cluster 2: -ER / -IR Verbs (-ido) ────────────────────────────────────
    {
      heading: "-ER and -IR Verbs → -ido",
      noteInline: "He vendido  I have sold · ¿Ha vendido?  Have you sold?",
      pairs: [
        {
          imageWord: "auto",
          imageDescription: "a car parked in a driveway on a white background",
          question: "¿Ha vendido el auto?",
          questionTranslation: "Have you sold the car?",
          answer: "Sí, he vendido el auto.",
          answerTranslation: "Yes, I have sold the car.",
        },
        {
          imageWord: "lancha",
          imageDescription: "a motorboat on calm water on a sunny day",
          question: "¿Ha vendido la lancha?",
          questionTranslation: "Have you sold the boat?",
          answer: "Sí, he vendido la lancha.",
          answerTranslation: "Yes, I have sold the boat.",
        },
        {
          imageWord: "telegrama",
          imageDescription: "a telegram envelope on a white background",
          question: "¿Ha recibido el telegrama?",
          questionTranslation: "Have you received the telegram?",
          answer: "Sí, he recibido el telegrama.",
          answerTranslation: "Yes, I have received the telegram.",
        },
        {
          imageWord: "cable",
          imageDescription: "a cable message or wire notification document",
          question: "¿Ha recibido el cable?",
          questionTranslation: "Have you received the cable?",
          answer: "Sí, he recibido el cable.",
          answerTranslation: "Yes, I have received the cable.",
        },
        {
          imageWord: "lección",
          imageDescription: "an open lesson book on a desk with study notes",
          question: "¿Ha aprendido la lección?",
          questionTranslation: "Have you learned the lesson?",
          answer: "Sí, he aprendido la lección.",
          answerTranslation: "Yes, I have learned the lesson.",
        },
        {
          imageWord: "México",
          imageDescription: "a colorful Mexican street with buildings and flags",
          question: "¿Ha vivido en México mucho tiempo?",
          questionTranslation: "Have you lived in Mexico a long time?",
          answer: "Sí, he vivido en México mucho tiempo.",
          answerTranslation: "Yes, I have lived in Mexico a long time.",
        },
      ],
      grammarRule: "-ER and -IR verb present perfect: drop ending, add -ido · vender → vendido · aprender → aprendido · vivir → vivido · recibir → recibido",
      conjugationTable: [
        { conjugated: "He vendido", translation: "I have sold" },
        { conjugated: "Ha vendido", translation: "you / he / she have sold" },
        { conjugated: "Hemos vendido", translation: "we have sold" },
        { conjugated: "Han vendido", translation: "they have sold" },
      ],
      noteAfter: "Vocabulary: mucho tiempo (a long time) · la lección (the lesson) · Ha vendido (you / he / she have sold)",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter: Lo Veo — Direct Object Pronouns
// Source: See It and Say It in Spanish, pp. 190–191
// chapterTitleKey "lo veo" matches DB unit "Lo Veo — Direct Object Pronouns"
// ═══════════════════════════════════════════════════════════════════════════════

const LO_VEO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "lo veo",
  conceptLabel: "Lo Veo",
  conceptDefinition: "I see it / I see him · Direct Object Pronouns",
  introNote: "Direct object pronouns replace the noun that receives the action of the verb. They go directly before the verb. Use the personal 'a' (a personal) when the direct object is a person.",
  clusters: [

    // ── Cluster 1: Singular — lo / la with images ─────────────────────────────
    {
      heading: "Lo veo · La veo",
      noteInline: "Lo  it (masc.) / him · La  it (fem.) / her · Me  me",
      pairs: [
        {
          imageWord: "edificio",
          imageDescription: "a tall office building on a city street",
          question: "¿Ve el edificio?",
          questionTranslation: "Do you see the building?",
          answer: "Sí, lo veo.",
          answerTranslation: "Yes, I see it.",
        },
        {
          imageWord: "barco",
          imageDescription: "a large ship on the ocean",
          question: "¿Ve el barco?",
          questionTranslation: "Do you see the boat?",
          answer: "Sí, lo veo.",
          answerTranslation: "Yes, I see it.",
        },
        {
          imageWord: "lámpara",
          imageDescription: "a table lamp with a warm glow on a white background",
          question: "¿Ve la lámpara?",
          questionTranslation: "Do you see the lamp?",
          answer: "Sí, la veo.",
          answerTranslation: "Yes, I see it.",
        },
      ],
      grammarRule: "Lo replaces a masculine noun · La replaces a feminine noun · Both come before the verb: ¿Ve el barco? → Lo veo.",
    },

    // ── Cluster 2: More lo / la examples (parallel masculine / feminine) ──────
    {
      heading: "Lo / La — More Examples",
      noteInline: "Lo  him / it (masc.) · La  her / it (fem.) · Me  me",
      pairs: [
        {
          question: "Lo veo.",
          questionTranslation: "I see him / I see it.",
          answer: "La veo.",
          answerTranslation: "I see her / I see it.",
        },
        {
          question: "Lo llamo.",
          questionTranslation: "I call him.",
          answer: "La llamo.",
          answerTranslation: "I call her.",
        },
        {
          question: "Lo conozco.",
          questionTranslation: "I know him.",
          answer: "La conozco.",
          answerTranslation: "I know her.",
        },
        {
          question: "Lo quiero.",
          questionTranslation: "I want him / I want it.",
          answer: "La quiero.",
          answerTranslation: "I want her / I want it.",
        },
        {
          question: "Me ve.",
          questionTranslation: "She / he sees me.",
          answer: "Me llama.",
          answerTranslation: "She / he calls me.",
          extraNote: "Me (me) also goes before the verb: Me ve. (She sees me.) · Me llama. (She calls me.)",
        },
      ],
      noteAfter: "The pronoun always goes directly before the verb · Lo / la can mean a person or a thing · When referring to a person, use the personal 'a' before the name: ¿Ve a María? → La veo.",
    },

    // ── Cluster 3: Plural — los / las with images ─────────────────────────────
    {
      heading: "Los veo · Las veo",
      noteInline: "Los  them (masc.) · Las  them (fem.) · Nos  us",
      pairs: [
        {
          imageWord: "muchachos",
          imageDescription: "a group of young men standing together outdoors",
          question: "¿Ve los muchachos?",
          questionTranslation: "Do you see the boys?",
          answer: "Sí, los veo.",
          answerTranslation: "Yes, I see them.",
        },
        {
          imageWord: "muchachas",
          imageDescription: "a group of young women smiling outdoors",
          question: "¿Ve las muchachas?",
          questionTranslation: "Do you see the girls?",
          answer: "Sí, las veo.",
          answerTranslation: "Yes, I see them.",
        },
        {
          imageWord: "mariposas",
          imageDescription: "colorful butterflies resting on flowers in a garden",
          question: "¿Ve las mariposas?",
          questionTranslation: "Do you see the butterflies?",
          answer: "Sí, las veo.",
          answerTranslation: "Yes, I see them.",
        },
        {
          imageWord: "estrellas",
          imageDescription: "bright stars in a dark night sky",
          question: "¿Ve las estrellas?",
          questionTranslation: "Do you see the stars?",
          answer: "Sí, las veo.",
          answerTranslation: "Yes, I see them.",
        },
      ],
      grammarRule: "Los replaces a masculine plural noun · Las replaces a feminine plural noun · Both go before the verb · Nos = us (also goes before the verb)",
    },

    // ── Cluster 4: People with the personal 'a' ───────────────────────────────
    {
      heading: "People — Personal 'a'",
      noteInline: "Use 'a' before a person's name or a person when they are the direct object",
      pairs: [
        {
          question: "¿Ve a Daniel y a Roberto?",
          questionTranslation: "Do you see Daniel and Roberto?",
          answer: "Sí, los veo.",
          answerTranslation: "Yes, I see them.",
        },
        {
          question: "¿Ve a María y a Luisa?",
          questionTranslation: "Do you see María and Luisa?",
          answer: "Sí, las veo.",
          answerTranslation: "Yes, I see them.",
        },
      ],
      grammarRule: "Use the personal 'a' before a person who is the direct object · ¿Ve a Daniel? Sí, lo veo. · ¿Ve a María? Sí, la veo. · ¿Ve a Daniel y Roberto? Sí, los veo. (mixed or all-male group → los)",
      noteAfter: "Summary: Lo (him/it masc.) · La (her/it fem.) · Los (them masc.) · Las (them fem.) · Me (me) · Nos (us) · All go directly before the verb.",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter: Me Lo — Double Object Pronouns
// Source: See It and Say It in Spanish, pp. 194–195
// chapterTitleKey "me lo" matches DB unit "Me Lo — Double Object Pronouns"
// ═══════════════════════════════════════════════════════════════════════════════

const ME_LO_CHAPTER: GustUnitContent = {
  chapterTitleKey: "me lo",
  conceptLabel: "Me Lo",
  conceptDefinition: "It to me · Double Object Pronouns",
  introNote: "When 'le' (to you / to him / to her) comes before 'lo' or 'la', 'le' changes to 'se'. The result is: me lo (it to me) · se lo (it to you / to him / to her / to them) · nos lo (it to us).",
  clusters: [

    // ── Cluster 1: Me lo / Se lo with images ─────────────────────────────────
    {
      heading: "¿Le mandó? → Me lo mandó",
      noteInline: "Me lo  it to me · Se lo  it to you / him / her / them",
      pairs: [
        {
          imageWord: "paquete",
          imageDescription: "a wrapped package tied with string on a white background",
          question: "¿Le mandó el paquete?",
          questionTranslation: "Did he send you the package?",
          answer: "Sí, me lo mandó hoy.",
          answerTranslation: "Yes, he sent it to me today.",
        },
        {
          imageWord: "paraguas",
          imageDescription: "a closed umbrella leaning against a wall",
          question: "¿Le trajo el paraguas?",
          questionTranslation: "Did he bring you the umbrella?",
          answer: "Sí, me lo trajo hoy.",
          answerTranslation: "Yes, he brought it to me today.",
        },
        {
          imageWord: "disco",
          imageDescription: "a vinyl record on a white background",
          question: "¿Le trajo el disco?",
          questionTranslation: "Did he bring you the record?",
          answer: "Sí, me lo trajo hoy.",
          answerTranslation: "Yes, he brought it to me today.",
        },
        {
          imageWord: "libro",
          imageDescription: "a hardcover book on a white background",
          question: "¿Le mandó el libro?",
          questionTranslation: "Did he send you the book?",
          answer: "Sí, me lo mandó hoy.",
          answerTranslation: "Yes, he sent it to me today.",
        },
        {
          imageWord: "regalo",
          imageDescription: "a gift-wrapped box with a bow on top",
          question: "¿Le trajo el regalo?",
          questionTranslation: "Did he bring you the gift?",
          answer: "Sí, me lo trajo.",
          answerTranslation: "Yes, he brought it to me.",
        },
      ],
      grammarRule: "Le + lo / la → se lo / se la · The 'le' (indirect) changes to 'se' before 'lo' or 'la' (direct) · Me lo mandó = He sent it to me · Se lo trajo = He brought it to you / him / her",
      noteAfter: "Nos lo: when the indirect pronoun is 'us' · Nos lo trajo. (He brought it to us.) · Nos lo mandó. (He sent it to us.)",
    },

    // ── Cluster 2: Se lo — question and answer ────────────────────────────────
    {
      heading: "Se lo — To You / To Him / To Her",
      noteInline: "Se lo can mean: to you / to him / to her / to them + lo (it)",
      pairs: [
        {
          question: "¿Se lo trajo hoy?",
          questionTranslation: "Did he bring it to you today?",
          answer: "Sí, me lo trajo hoy.",
          answerTranslation: "Yes, he brought it to me today.",
        },
        {
          question: "Se lo dije.",
          questionTranslation: "I told it to you / to him / to her.",
          answer: "Me lo dijo.",
          answerTranslation: "He / she told it to me.",
        },
        {
          question: "Nos lo trajo.",
          questionTranslation: "He brought it to us.",
          answer: "Nos lo mandó.",
          answerTranslation: "He sent it to us.",
        },
      ],
      grammarRule: "Se lo dije = I told it to you (or him / her / them) · Me lo dijo = He / she told it to me · Nos lo = it to us · The pattern: indirect pronoun + lo/la + verb",
    },

    // ── Cluster 3: Pronouns attached to infinitives ───────────────────────────
    {
      heading: "Pronouns on the Infinitive",
      noteInline: "Pronouns can be added directly to the end of the infinitive to form one word",
      pairs: [
        {
          question: "Quiero verlo.",
          questionTranslation: "I want to see it.",
          answer: "Quiero comprarlo.",
          answerTranslation: "I want to buy it.",
        },
        {
          question: "Quiero mandarlo.",
          questionTranslation: "I want to send it.",
          answer: "Voy a traerlo.",
          answerTranslation: "I'm going to bring it.",
        },
        {
          question: "Quiero hablarle.",
          questionTranslation: "I want to speak to him / her.",
          answer: "Quiero escribirle.",
          answerTranslation: "I want to write to him / her.",
        },
        {
          question: "Quiero mandárselo.",
          questionTranslation: "I want to send it to him / her.",
          answer: "Quiero traérselo.",
          answerTranslation: "I want to bring it to him / her.",
        },
        {
          question: "Voy a traérselo.",
          questionTranslation: "I'm going to bring it to him / her.",
          answer: "Voy a dárselo.",
          answerTranslation: "I'm going to give it to him / her.",
        },
      ],
      grammarRule: "Attach the pronoun to the infinitive: ver + lo → verlo · mandar + lo → mandarlo · When adding two pronouns, the indirect comes first: mandar + se + lo → mandárselo (accent required on the stressed syllable)",
    },

    // ── Cluster 4: Dar + combined forms ──────────────────────────────────────
    {
      heading: "Dar — To Give",
      noteInline: "dar (to give) · dárselo (to give it to him/her) · dármelo (to give it to me)",
      pairs: [
        {
          question: "¿Quiere dármelo?",
          questionTranslation: "Do you want to give it to me?",
          answer: "Sí, quiero dárselo.",
          answerTranslation: "Yes, I want to give it to you / to him / to her.",
        },
        {
          question: "Quiero verlo mañana.",
          questionTranslation: "I want to see it tomorrow.",
          answer: "Quiero hacerlo mañana.",
          answerTranslation: "I want to do it tomorrow.",
        },
      ],
      grammarRule: "Dar (to give): voy a dárselo (I'm going to give it to him/her) · quiero dármelo (I want to give it to me) · The same infinitive-attachment rule applies to all verbs",
      noteAfter: "Summary: me lo (it to me) · se lo (it to you / him / her / them) · nos lo (it to us) · Pronouns can go before a conjugated verb OR attach to the end of an infinitive.",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// Chapter: Hable — Formal Commands & Present Subjunctive
// Source: See It and Say It in Spanish, pp. 198–199
// chapterTitleKey "hable:" matches DB unit "Hable: Formal Commands"
// ═══════════════════════════════════════════════════════════════════════════════

const HABLE_CHAPTER: GustUnitContent = {
  chapterTitleKey: "hable:",
  conceptLabel: "Hable",
  conceptDefinition: "Speak · Formal Commands (Usted)",
  introNote: "To give a formal command (usted): -AR verbs end in -e; -ER and -IR verbs end in -a. It is the opposite of the present tense endings.",
  clusters: [

    // ── Cluster 1: Regular -AR Commands → -e ─────────────────────────────────
    {
      heading: "-AR Verbs → -e",
      noteInline: "hablar → hable · tomar → tome · contestar → conteste",
      pairs: [
        {
          imageWord: "hablar",
          imageDescription: "two people having a conversation, one gesturing to speak slowly",
          question: "hablar (to speak)",
          questionTranslation: "-AR verb → command ends in -e",
          answer: "Hable despacio.",
          answerTranslation: "Speak slowly.",
        },
        {
          imageWord: "mirar",
          imageDescription: "a person looking attentively at something off-screen",
          question: "mirar (to look)",
          questionTranslation: "-AR verb → command ends in -e",
          answer: "Mire.",
          answerTranslation: "Look.",
        },
        {
          imageWord: "teléfono",
          imageDescription: "a ringing telephone on a desk",
          question: "contestar (to answer)",
          questionTranslation: "-AR verb → command ends in -e",
          answer: "Conteste el teléfono.",
          answerTranslation: "Answer the phone.",
        },
        {
          imageWord: "tomar",
          imageDescription: "a hand reaching out to take something from a table",
          question: "tomar (to take)",
          questionTranslation: "-AR verb → command ends in -e",
          answer: "Tome esto.",
          answerTranslation: "Take this.",
        },
      ],
      grammarRule: "-AR verb formal command: drop -AR, add -e · hablar → hable · mirar → mire · contestar → conteste · tomar → tome",
    },

    // ── Cluster 2: Regular -ER / -IR Commands → -a ────────────────────────────
    {
      heading: "-ER and -IR Verbs → -a",
      noteInline: "vender → venda · aprender → aprenda · escribir → escriba",
      pairs: [
        {
          imageWord: "vender",
          imageDescription: "a 'for sale' sign in front of a house",
          question: "vender (to sell)",
          questionTranslation: "-ER verb → command ends in -a",
          answer: "Venda la casa.",
          answerTranslation: "Sell the house.",
        },
        {
          imageWord: "aprender",
          imageDescription: "a student studying an open book with focus",
          question: "aprender (to learn)",
          questionTranslation: "-ER verb → command ends in -a",
          answer: "Aprenda la lección.",
          answerTranslation: "Learn the lesson.",
        },
        {
          imageWord: "escribir",
          imageDescription: "a hand writing with a pen on paper",
          question: "escribir (to write)",
          questionTranslation: "-IR verb → command ends in -a",
          answer: "Escríbame.",
          answerTranslation: "Write to me.",
          extraNote: "Pronouns attach directly to the end of the command: escribir → escriba → escríbame",
        },
      ],
      grammarRule: "-ER / -IR verb formal command: drop ending, add -a · vender → venda · aprender → aprenda · escribir → escriba",
    },

    // ── Cluster 3: Irregular -ga Commands ────────────────────────────────────
    {
      heading: "Irregular Commands — -ga Ending",
      noteInline: "oír → oiga · traer → traiga · venir → venga · hacer → haga · decir → diga",
      pairs: [
        {
          question: "oír (to hear / to listen)",
          questionTranslation: "irregular: oír → oiga",
          answer: "Oiga.",
          answerTranslation: "Hello. / Listen.",
          extraNote: "Oiga is used to get someone's attention or to answer the phone.",
        },
        {
          question: "venir (to come)",
          questionTranslation: "irregular: venir → venga",
          answer: "Venga acá.",
          answerTranslation: "Come here.",
        },
        {
          question: "hacer (to do / to make)",
          questionTranslation: "irregular: hacer → haga",
          answer: "Hágalo.",
          answerTranslation: "Do it.",
          extraNote: "Pronouns attach to the end: haga + lo → hágalo",
        },
        {
          question: "decir (to say / to tell)",
          questionTranslation: "irregular: decir → diga",
          answer: "Dígame.",
          answerTranslation: "Tell me.",
        },
        {
          question: "traer (to bring)",
          questionTranslation: "irregular: traer → traiga",
          answer: "Tráigamelo.",
          answerTranslation: "Bring it to me.",
          extraNote: "Traiga + me + lo → tráigamelo. Multiple pronouns can attach.",
        },
      ],
      grammarRule: "These verbs have irregular command stems ending in -ga. · oír → oiga · traer → traiga · venir → venga · hacer → haga · decir → diga",
    },

    // ── Cluster 4: Present Subjunctive — espero que / quiero que ──────────────
    {
      heading: "Espero que... / Quiero que...",
      noteInline: "Espero que  I hope that · Quiero que  I want you to",
      pairs: [
        {
          question: "Quiero que venda la casa.",
          questionTranslation: "I want you to sell the house.",
          answer: "Espero que aprenda la lección.",
          answerTranslation: "I hope you learn the lesson.",
        },
        {
          question: "Espero que venga a la fiesta.",
          questionTranslation: "I hope you come to the party.",
          answer: "Espero que lo conteste.",
          answerTranslation: "I hope you answer it.",
          extraNote: "Pronoun goes before the subjunctive verb: lo + conteste",
        },
        {
          question: "Quiero que lo traiga.",
          questionTranslation: "I want you to bring it.",
          answer: "Espero que me escriba.",
          answerTranslation: "I hope you write to me.",
        },
        {
          question: "Quiero que lo haga.",
          questionTranslation: "I want you to do it.",
          answer: "Espero que lo haga pronto.",
          answerTranslation: "I hope you do it soon.",
        },
      ],
      grammarRule: "The subjunctive uses the same endings as the command form. · After espero que and quiero que, use the command form of the verb. · Pronouns go before the subjunctive verb: Espero que lo conteste. / Quiero que lo traiga.",
      noteAfter: "The subjunctive is triggered by expressions of wanting, hoping, or wishing followed by a different subject: Quiero que usted venda. (I want you to sell.)",
    },
  ],
};

// ── Chapter 28: Telling Time + Hace Expressions ─────────────────────────────
// Source: Madrigal's Invitation to Spanish, Ch. 28 (telling time) + hace expressions

const TELLING_TIME_CHAPTER: GustUnitContent = {
  chapterTitleKey: "telling time",
  conceptLabel: "¿Qué Hora Es?",
  conceptDefinition: "What time is it? · Telling time and expressing how long",
  introNote: "To tell time in Spanish: use 'Es la una' for one o'clock (singular), and 'Son las...' for all other hours (plural). Two key time expressions: 'hace + time' tells how long ago or for how long something has been happening.",

  clusters: [
    // ── Cluster 1: Telling the Hour (p. 108) ──────────────────────────────
    {
      heading: "¿Qué hora es?",
      noteInline: "Es la una  It is one o'clock  ·  Son las dos  It is two o'clock  ·  Son las tres  It is three o'clock",
      pairs: [
        {
          imageWord: "reloj",
          imageDescription: "a clock face showing one o'clock",
          question: "¿Qué hora es?",
          questionTranslation: "What time is it?",
          answer: "Es la una.",
          answerTranslation: "It is one o'clock.",
        },
        {
          imageWord: "reloj",
          imageDescription: "a clock face showing two o'clock",
          question: "¿Qué hora es?",
          questionTranslation: "What time is it?",
          answer: "Son las dos.",
          answerTranslation: "It is two o'clock.",
        },
        {
          imageWord: "reloj",
          imageDescription: "a clock face showing three o'clock",
          question: "¿Qué hora es?",
          questionTranslation: "What time is it?",
          answer: "Son las tres.",
          answerTranslation: "It is three o'clock.",
        },
        {
          imageWord: "reloj",
          imageDescription: "a clock face showing twelve o'clock",
          question: "¿Qué hora es?",
          questionTranslation: "What time is it?",
          answer: "Son las doce.",
          answerTranslation: "It is twelve o'clock.",
        },
      ],
      grammarRule: "Es la una — singular. Son las + number — plural for all other hours. 'Las' refers to 'horas' (hours).",
    },
    // ── Cluster 2: Half-hours and Quarter-hours (p. 109) ──────────────────
    {
      heading: "Y Media · Y Cuarto · Menos Cuarto",
      noteInline: "y media  half past  ·  y cuarto  quarter past  ·  menos cuarto  quarter to",
      pairs: [
        {
          imageWord: "reloj",
          imageDescription: "a clock face showing three thirty",
          question: "¿Qué hora es?",
          questionTranslation: "What time is it?",
          answer: "Son las tres y media.",
          answerTranslation: "It is half past three.",
        },
        {
          imageWord: "reloj",
          imageDescription: "a clock face showing five fifteen",
          question: "¿Qué hora es?",
          questionTranslation: "What time is it?",
          answer: "Son las cinco y cuarto.",
          answerTranslation: "It is a quarter past five.",
        },
        {
          imageWord: "reloj",
          imageDescription: "a clock face showing a quarter to four",
          question: "¿Qué hora es?",
          questionTranslation: "What time is it?",
          answer: "Son las cuatro menos cuarto.",
          answerTranslation: "It is a quarter to four.",
        },
      ],
      sentenceColumns: [
        {
          label: "Hour",
          items: [
            { text: "Es la una",    translation: "It is one" },
            { text: "Son las dos",  translation: "It is two" },
            { text: "Son las tres", translation: "It is three" },
            { text: "Son las seis", translation: "It is six" },
          ],
        },
        {
          label: "Minutes",
          items: [
            { text: "y media.",       translation: "and a half / half past." },
            { text: "y cuarto.",      translation: "and a quarter / quarter past." },
            { text: "menos cuarto.",  translation: "minus a quarter / quarter to." },
            { text: "en punto.",      translation: "exactly / on the dot." },
          ],
        },
      ],
    },
    // ── Cluster 3: AM / PM and times of day ───────────────────────────────
    {
      heading: "De la Mañana · De la Tarde · De la Noche",
      noteInline: "de la mañana  in the morning / AM  ·  de la tarde  in the afternoon / PM  ·  de la noche  at night",
      pairs: [
        {
          imageWord: "mañana",
          imageDescription: "a sunrise over a city skyline in early morning",
          question: "¿A qué hora llega el tren?",
          questionTranslation: "At what time does the train arrive?",
          answer: "El tren llega a las ocho de la mañana.",
          answerTranslation: "The train arrives at eight in the morning.",
        },
        {
          imageWord: "tarde",
          imageDescription: "an afternoon sky with warm golden light over a street",
          question: "¿A qué hora sale el avión?",
          questionTranslation: "At what time does the plane leave?",
          answer: "El avión sale a las tres de la tarde.",
          answerTranslation: "The plane leaves at three in the afternoon.",
        },
        {
          imageWord: "noche",
          imageDescription: "a city street at night with lights and dark sky",
          question: "¿A qué hora llega el barco?",
          questionTranslation: "At what time does the ship arrive?",
          answer: "El barco llega a las diez de la noche.",
          answerTranslation: "The ship arrives at ten at night.",
        },
      ],
    },
    // ── Cluster 4: Hace + Time Expressions ────────────────────────────────
    {
      heading: "Hace + Tiempo — How Long Ago / For How Long",
      noteInline: "hace dos años  two years ago / for two years  ·  ¿cuánto tiempo hace que?  how long has it been since? / how long have you?",
      pairs: [
        {
          imageWord: "calendario",
          imageDescription: "a wall calendar showing years passing",
          question: "¿Cuánto tiempo hace que estudia español?",
          questionTranslation: "How long have you been studying Spanish?",
          answer: "Hace dos años que estudio español.",
          answerTranslation: "I have been studying Spanish for two years.",
        },
        {
          imageWord: "ciudad",
          imageDescription: "a street view of a city neighbourhood",
          question: "¿Cuánto tiempo hace que vive aquí?",
          questionTranslation: "How long have you been living here?",
          answer: "Hace tres años que vivo aquí.",
          answerTranslation: "I have been living here for three years.",
        },
        {
          imageWord: "reloj",
          imageDescription: "an hourglass with sand flowing through it",
          question: "¿Cuándo llegó?",
          questionTranslation: "When did you arrive?",
          answer: "Llegué hace una semana.",
          answerTranslation: "I arrived a week ago.",
        },
        {
          imageWord: "tiempo",
          imageDescription: "a faded old photograph suggesting the passage of time",
          question: "¿Cuándo se fue?",
          questionTranslation: "When did he leave?",
          answer: "Se fue hace mucho tiempo.",
          answerTranslation: "He left a long time ago.",
        },
      ],
      grammarRule: "hace + [time period] + que + [present tense] = for [time period] (ongoing action)\nhace + [time period] + [preterite] = [time period] ago (completed action)",
      noteAfter: "hace dos años  two years ago / for two years  ·  hace tres días  three days ago  ·  hace una semana  a week ago  ·  hace mucho tiempo  a long time ago  ·  hace poco tiempo  a short time ago",
    },
  ],
};

const GUST_UNITS: GustUnitContent[] = [
  GUSTAR_CHAPTER,
  GUSTARIA_CHAPTER,
  FUI_CHAPTER,
  VOY_A_CHAPTER,
  VA_A_CHAPTER,
  QUE_HIZO_CHAPTER,
  TUVO_CHAPTER,
  LE_CHAPTER,
  ESTA_LIMPIO_CHAPTER,
  ESTUDIIE_CHAPTER,
  RECIBI_CHAPTER,
  ESTA_CONTENTO_CHAPTER,
  ESTA_TOCANDO_CHAPTER,
  COMPRABA_CHAPTER,
  SALE_LLEGA_CHAPTER,
  TENGO_CATARRO_CHAPTER,
  ME_LEVANTO_CHAPTER,
  HE_COMPRADO_CHAPTER,
  LO_VEO_CHAPTER,
  ME_LO_CHAPTER,
  HABLE_CHAPTER,
  TELLING_TIME_CHAPTER,
];

/**
 * Returns hardcoded Gust-style content for a chapter if available.
 * Covers "Gustar: Me gusta / Me gustan" and "Me gustaría: I Would Like" chapters.
 */
export function getGustContent(chapterTitle: string): GustUnitContent | null {
  const lower = chapterTitle.toLowerCase();
  return GUST_UNITS.find(u => lower.includes(u.chapterTitleKey)) ?? null;
}
