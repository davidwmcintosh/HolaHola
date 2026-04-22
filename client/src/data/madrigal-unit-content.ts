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

// ── Registries ────────────────────────────────────────────────────────────────

const MADRIGAL_VERB_UNITS: MadrigalVerbUnitContent[] = [
  IR_GOING_PLACES,
];

const PRETERITE_UNITS: PreteriteUnitContent[] = [
  NEAR_FUTURE_VOY_A,
  TOMAR_I_TOOK,
  COMPRAR_I_BOUGHT,
  TENER_I_HAVE,
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
