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
  word: string;
  sentence: string;
  translation: string;
  imageDescription: string;
}

/** Just a question + translation, shown under an image. No answer visible yet. */
export interface VaQuestionItem {
  imageWord: string;
  question: string;
  questionTranslation: string;
}

/** A Q&A pair shown together under an image (page 12 format). */
export interface Page12QAItem {
  imageWord?: string;          // no image for the last two items on page 12
  question: string;
  affirmativeAnswer: string;
  affirmativeTranslation: string;
}

// ── Full verb unit content type ───────────────────────────────────────────────

export interface MadrigalVerbUnitContent {
  chapterTitleKey: string;

  // ── Page 9: Voy section ──────────────────────────────────────────────────
  // Anchor on one line: "Voy,  I'm going.   al,  to the."
  voyAnchor: MadrigalAnchorItem[];
  // 4 images: hotel / banco / garaje / restaurante  →  "Voy al ___."
  positiveItems: MadrigalPositiveItem[];
  // 4 images: club / teatro / cine / parque  →  "No voy al ___."
  negativeItems: NegativeFormItem[];

  // ── ¿Va? question section ────────────────────────────────────────────────
  // Anchor: "¿Va?  Are you going?"
  vaAnchor: MadrigalAnchorItem[];
  // 4 images using the SAME places as positive  →  "¿Va al ___?"
  vaQuestions: VaQuestionItem[];
  // Note: "In Spanish, you generally drop subject pronouns."
  subjectPronounNote?: string;
  // Anchor: "No, no voy...  No, I'm not going.   al,  to the."
  noAnswerAnchor: MadrigalAnchorItem[];
  // 4 images with negative answers  →  "No, no voy al ___."
  negativeAnswerItems: NegativeFormItem[];

  // ── Substitution drill ───────────────────────────────────────────────────
  // Column 1: 8 verb forms  |  Column 2: 8 places
  sentenceColumns: SentenceColumn[];

  // ── Vamos page ───────────────────────────────────────────────────────────
  // Anchor: "Vamos,  Let's go.   al,  to the."
  vamosAnchor: MadrigalAnchorItem[];
  // 4 images  →  "Vamos al ___."
  vamosItems: MadrigalPositiveItem[];
  // Note: "Vamos means both 'Let's go' and 'We are going.'"
  vamosNote?: string;

  // ── Page 12: Full Q&A ────────────────────────────────────────────────────
  // 4-item anchor on one line: ¿Va? / al / Voy / Sí
  page12Anchors: MadrigalAnchorItem[];
  // 4 Q&A pairs (first 2 have images, last 2 do not)
  page12Items: Page12QAItem[];
  // Grammar reference at end of page 12
  vaDefinition?: string;
}

// ── Chapter 23: Where Are You Going? (ir — to go) ─────────────────────────────
//
// Source: Madrigal pp. 9–13
//
// Page 9:  Anchor (Voy + al) → 4 positive (hotel/banco/garaje/restaurante) →
//          4 negative (club/teatro/cine/parque)
// Page 10: ¿Va? anchor → 4 questions (same places as positive) → subject pronoun note →
//          "No, no voy..." anchor → 4 negative-answer pictures
//          Substitution drill: 8 verb forms × 8 places
// Next pg: Vamos anchor → 4 Vamos pictures → note about vamos dual meaning
// Page 12: 4-item anchor (¿Va?/al/Voy/Sí) → 4 Q&A picture pairs →
//          2 Q&A without pictures → Va: definition

const IR_GOING_PLACES: MadrigalVerbUnitContent = {
  chapterTitleKey: "where are you going",

  // Page 9 ──────────────────────────────────────────────────────────────────

  voyAnchor: [
    { spanish: "Voy,", english: "I'm going." },
    { spanish: "al,", english: "to the." },
  ],

  positiveItems: [
    { word: "hotel",       sentence: "Voy al hotel.",       translation: "I'm going to the hotel.",      imageDescription: "a classic hotel building exterior" },
    { word: "banco",       sentence: "Voy al banco.",       translation: "I'm going to the bank.",       imageDescription: "a bank building with columns" },
    { word: "garaje",      sentence: "Voy al garaje.",      translation: "I'm going to the garage.",     imageDescription: "a car garage with open door" },
    { word: "restaurante", sentence: "Voy al restaurante.", translation: "I'm going to the restaurant.", imageDescription: "a restaurant exterior with sign" },
  ],

  negativeItems: [
    { imageWord: "club",        negativePhrase: "No voy al club.",        translation: "I'm not going to the club." },
    { imageWord: "teatro",      negativePhrase: "No voy al teatro.",      translation: "I'm not going to the theater." },
    { imageWord: "cine",        negativePhrase: "No voy al cine.",        translation: "I'm not going to the movies." },
    { imageWord: "parque",      negativePhrase: "No voy al parque.",      translation: "I'm not going to the park." },
  ],

  // ¿Va? section ─────────────────────────────────────────────────────────────

  vaAnchor: [
    { spanish: "¿Va?", english: "Are you going?" },
  ],

  // Same 4 places as positiveItems — the question introduces Va using familiar vocabulary
  vaQuestions: [
    { imageWord: "hotel",       question: "¿Va al hotel?",       questionTranslation: "Are you going to the hotel?" },
    { imageWord: "banco",       question: "¿Va al banco?",       questionTranslation: "Are you going to the bank?" },
    { imageWord: "garaje",      question: "¿Va al garaje?",      questionTranslation: "Are you going to the garage?" },
    { imageWord: "restaurante", question: "¿Va al restaurante?", questionTranslation: "Are you going to the restaurant?" },
  ],

  subjectPronounNote: "In Spanish, you generally drop subject pronouns (I, you, we, they, etc.).",

  noAnswerAnchor: [
    { spanish: "No, no voy...", english: "No, I'm not going..." },
    { spanish: "al,",           english: "to the." },
  ],

  negativeAnswerItems: [
    { imageWord: "hotel",       negativePhrase: "No, no voy al hotel.",       translation: "No, I'm not going to the hotel." },
    { imageWord: "banco",       negativePhrase: "No, no voy al banco.",       translation: "No, I'm not going to the bank." },
    { imageWord: "garaje",      negativePhrase: "No, no voy al garaje.",      translation: "No, I'm not going to the garage." },
    { imageWord: "restaurante", negativePhrase: "No, no voy al restaurante.", translation: "No, I'm not going to the restaurant." },
  ],

  // Substitution drill ───────────────────────────────────────────────────────
  // Column 1: 8 verb forms  |  Column 2: 8 places

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

  // Vamos page ───────────────────────────────────────────────────────────────

  vamosAnchor: [
    { spanish: "Vamos,", english: "Let's go." },
    { spanish: "al,",    english: "to the." },
  ],

  vamosItems: [
    { word: "hotel",       sentence: "Vamos al hotel.",       translation: "Let's go to the hotel.",      imageDescription: "a classic hotel building exterior" },
    { word: "banco",       sentence: "Vamos al banco.",       translation: "Let's go to the bank.",       imageDescription: "a bank building with columns" },
    { word: "restaurante", sentence: "Vamos al restaurante.", translation: "Let's go to the restaurant.", imageDescription: "a restaurant exterior with sign" },
    { word: "club",        sentence: "Vamos al club.",        translation: "Let's go to the club.",       imageDescription: "a nightclub or social club exterior" },
  ],

  vamosNote: "\"Vamos\" means both \"Let's go\" and \"We are going.\"",

  // Page 12: Full Q&A ────────────────────────────────────────────────────────

  page12Anchors: [
    { spanish: "¿Va?",  english: "Are you going?" },
    { spanish: "al,",   english: "to the." },
    { spanish: "Voy,",  english: "I'm going." },
    { spanish: "Sí,",   english: "Yes." },
  ],

  // First 2 items have images; last 2 do not (Madrigal pp. 12)
  page12Items: [
    { imageWord: "banco",  question: "¿Va al banco?",  affirmativeAnswer: "Sí, voy al banco.",  affirmativeTranslation: "Yes, I'm going to the bank." },
    { imageWord: "parque", question: "¿Va al parque?", affirmativeAnswer: "Sí, voy al parque.", affirmativeTranslation: "Yes, I'm going to the park." },
    {                      question: "¿Va al hotel?",  affirmativeAnswer: "Sí, voy al hotel.",  affirmativeTranslation: "Yes, I'm going to the hotel." },
    {                      question: "¿Va al club?",   affirmativeAnswer: "Sí, voy al club.",   affirmativeTranslation: "Yes, I'm going to the club." },
  ],

  vaDefinition: "Va: You are going · He is going · She is going · It is going\n¿Va?: Are you going? · Is he going? · Is she going? · Is it going?",
};

// ── Registry ──────────────────────────────────────────────────────────────────

const MADRIGAL_UNITS: MadrigalVerbUnitContent[] = [
  IR_GOING_PLACES,
];

/**
 * Returns hardcoded Madrigal content for a chapter if available.
 * Matches on the chapter title — case-insensitive substring match on chapterTitleKey.
 */
export function getMadrigalContent(chapterTitle: string): MadrigalVerbUnitContent | null {
  const lower = chapterTitle.toLowerCase();
  return MADRIGAL_UNITS.find(u => lower.includes(u.chapterTitleKey)) ?? null;
}
