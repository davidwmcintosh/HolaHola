/**
 * madrigal-unit-content.ts
 * Hardcoded content transcribed directly from Madrigal's "See It and Say It in Spanish."
 * This is the canonical content source for HoloHola Verb Units.
 *
 * Content law: Never generate this content from AI. Every word, sentence, and
 * ordering was chosen by Madrigal for a specific pedagogical reason. The vocabulary
 * cluster, the positive/negative split, the Q&A vocabulary, and the drill columns
 * all work together. Changing one element breaks the chain.
 *
 * Each entry maps to one chapter (unit) in the Spanish 1 curriculum.
 * The chapterTitleKey is matched against the lowercased chapter title.
 */

import type { NegativeFormItem } from "@/components/NegativeFormSection";
import type { QuestionFormItem } from "@/components/QuestionFormSection";
import type { SentenceColumn } from "@/components/SentenceColumnGenerator";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MadrigalAnchorItem {
  spanish: string;
  english: string;
}

export interface MadrigalPositiveItem {
  word: string;
  sentence: string;
  translation: string;
  imageDescription: string;
}

export interface MadrigalVamosLine {
  sentence: string;
  translation: string;
}

export interface MadrigalVerbUnitContent {
  chapterTitleKey: string;
  anchor: MadrigalAnchorItem[];
  positiveItems: MadrigalPositiveItem[];
  vamos?: MadrigalVamosLine;
  negativeItems: NegativeFormItem[];
  questionItems: QuestionFormItem[];
  sentenceColumns: SentenceColumn[];
  patternLabel: string;
}

// ── Lesson 1: ir — Going Places (Madrigal pp. 9–13) ──────────────────────────
//
// Page 9:  Anchor block + 4 positive images (hotel / banco / garage / restaurante)
// Page 10: 4 negative images (club / teatro / cine / parque) + Vamos
// Page 12: Q&A exchange (banco / teatro / parque / cine)
// Page 13: Substitution drill — 2 verb forms × 8 places
//
// Why these 8 places? City destinations a beginner Spanish student would
// actually name. Each one is cognate-adjacent (teatro, restaurante, club) or
// one-syllable-simple (banco, cine, parque) — all instantly pronounceable.

const IR_GOING_PLACES: MadrigalVerbUnitContent = {
  chapterTitleKey: "ir",
  patternLabel: "Voy al ___ — I'm going to the ___",

  anchor: [
    { spanish: "Voy,", english: "I'm going." },
    { spanish: "Al,", english: "to the." },
  ],

  positiveItems: [
    {
      word: "hotel",
      sentence: "Voy al hotel.",
      translation: "I'm going to the hotel.",
      imageDescription: "a classic hotel building exterior",
    },
    {
      word: "banco",
      sentence: "Voy al banco.",
      translation: "I'm going to the bank.",
      imageDescription: "a bank building with columns",
    },
    {
      word: "garage",
      sentence: "Voy al garage.",
      translation: "I'm going to the garage.",
      imageDescription: "a car garage with open door",
    },
    {
      word: "restaurante",
      sentence: "Voy al restaurante.",
      translation: "I'm going to the restaurant.",
      imageDescription: "a restaurant exterior with sign",
    },
  ],

  negativeItems: [
    {
      imageWord: "club",
      negativePhrase: "No voy al club.",
      translation: "I'm not going to the club.",
    },
    {
      imageWord: "teatro",
      negativePhrase: "No voy al teatro.",
      translation: "I'm not going to the theater.",
    },
    {
      imageWord: "cine",
      negativePhrase: "No voy al cine.",
      translation: "I'm not going to the movies.",
    },
    {
      imageWord: "parque",
      negativePhrase: "No voy al parque.",
      translation: "I'm not going to the park.",
    },
  ],

  // Madrigal introduces vamos quietly — one line, no heading, no fanfare.
  // It appears at the bottom of the negative page, not as a new lesson.
  vamos: {
    sentence: "Vamos al club.",
    translation: "Let's go to the club.",
  },

  // Q&A uses the negative vocabulary (banco, teatro, parque, cine) — not the positive.
  // The question uses va (él/ella form). The answer uses voy (yo form).
  // Both the affirmative and negative answers are complete sentences — never "Sí" alone.
  questionItems: [
    {
      imageWord: "banco",
      question: "¿Va al banco?",
      questionTranslation: "Is he/she going to the bank?",
      affirmativeAnswer: "Sí, voy al banco.",
      affirmativeTranslation: "Yes, I'm going to the bank.",
      negativeAnswer: "No, no voy al banco.",
      negativeTranslation: "No, I'm not going to the bank.",
    },
    {
      imageWord: "teatro",
      question: "¿Va al teatro?",
      questionTranslation: "Is he/she going to the theater?",
      affirmativeAnswer: "Sí, voy al teatro.",
      affirmativeTranslation: "Yes, I'm going to the theater.",
      negativeAnswer: "No, no voy al teatro.",
      negativeTranslation: "No, I'm not going to the theater.",
    },
    {
      imageWord: "parque",
      question: "¿Va al parque?",
      questionTranslation: "Is he/she going to the park?",
      affirmativeAnswer: "Sí, voy al parque.",
      affirmativeTranslation: "Yes, I'm going to the park.",
      negativeAnswer: "No, no voy al parque.",
      negativeTranslation: "No, I'm not going to the park.",
    },
    {
      imageWord: "cine",
      question: "¿Va al cine?",
      questionTranslation: "Is he/she going to the movies?",
      affirmativeAnswer: "Sí, voy al cine.",
      affirmativeTranslation: "Yes, I'm going to the movies.",
      negativeAnswer: "No, no voy al cine.",
      negativeTranslation: "No, I'm not going to the movies.",
    },
  ],

  // Drill: 2 forms × 8 places (all 8 places introduced on pp. 9–10)
  // No column labels — the layout is self-explanatory (Madrigal decision).
  sentenceColumns: [
    {
      items: [
        { text: "voy al ___", translation: "I'm going to the ___" },
        { text: "va al ___", translation: "he / she is going to the ___" },
      ],
    },
    {
      items: [
        { text: "hotel", translation: "hotel" },
        { text: "banco", translation: "bank" },
        { text: "teatro", translation: "theater" },
        { text: "restaurante", translation: "restaurant" },
        { text: "parque", translation: "park" },
        { text: "cine", translation: "movies" },
        { text: "garage", translation: "garage" },
        { text: "club", translation: "club" },
      ],
    },
  ],
};

// ── Registry ──────────────────────────────────────────────────────────────────

const MADRIGAL_UNITS: MadrigalVerbUnitContent[] = [
  IR_GOING_PLACES,
];

/**
 * Returns hardcoded Madrigal content for a chapter if available.
 * Matches on the chapter title — case-insensitive, substring match on chapterTitleKey.
 */
export function getMadrigalContent(chapterTitle: string): MadrigalVerbUnitContent | null {
  const lower = chapterTitle.toLowerCase();
  return MADRIGAL_UNITS.find(u => lower.includes(u.chapterTitleKey)) ?? null;
}
