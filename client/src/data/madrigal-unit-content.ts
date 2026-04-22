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

// ── Full verb unit content type ───────────────────────────────────────────────

export interface MadrigalVerbUnitContent {
  chapterTitleKey: string;

  // ── Page 9: Voy section ──────────────────────────────────────────────────
  // Same-line anchor: "Voy,  I'm going.   al,  to the."
  voyAnchor: MadrigalAnchorItem[];
  // 4 images: hotel / banco / garaje / restaurante  →  "Voy al ___."
  positiveItems: MadrigalPositiveItem[];

  // ── ¿Va? section: 2-column substitution (goes between positive and negative)
  // Anchor: "¿Va?  Are you going?"
  vaAnchor: MadrigalAnchorItem[];
  // 2-column drill: "¿Va al" | hotel / banco / garaje / restaurante
  vaColumns: SentenceColumn[];
  subjectPronounNote?: string;

  // ── No voy section ───────────────────────────────────────────────────────
  // Anchor: "No voy,  I'm not going.   al,  to the."
  noVoyAnchor: MadrigalAnchorItem[];
  // 4 images using the SAME places as positive  →  "No voy al ___."
  negativeItems: NegativeFormItem[];

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
// Page 9:  Anchor (Voy + al) → 4 positive (hotel/banco/garaje/restaurante)
// ---
// ¿Va? anchor → 2-column drill (¿Va al | hotel/banco/garaje/restaurante) → note
// ---
// No voy anchor → 4 negative (same 4 places) → substitution drill (8 forms × 8 places)
// ---
// Vamos anchor → 4 Vamos pictures → note about dual meaning
// ---
// Page 12: 4-item anchor (¿Va?/al/Voy/Sí) → 4 Q&A pairs → Va: definition

const IR_GOING_PLACES: MadrigalVerbUnitContent = {
  chapterTitleKey: "where are you going",

  // Page 9: Voy ─────────────────────────────────────────────────────────────

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

  // ¿Va? section ─────────────────────────────────────────────────────────────
  // Uses same 4 places as positive — the question introduces Va via familiar vocabulary

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

  // No voy section ───────────────────────────────────────────────────────────
  // Same 4 places as positive — introduces the negative form of the same vocabulary

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

  // Substitution drill ───────────────────────────────────────────────────────
  // Column 1: 8 verb forms  |  Column 2: 8 places (all vocabulary from this chapter)

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
    { word: "restaurante", sentence: "Vamos al restaurante.", translation: "Let's go to the restaurant.", imageDescription: "a restaurant exterior with outdoor seating" },
    // "discoteca" as the image lookup key so we get a nightclub, not a caveman club
    { word: "discoteca",   sentence: "Vamos al club.",        translation: "Let's go to the club.",       imageDescription: "a nightclub or social club exterior at night" },
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
