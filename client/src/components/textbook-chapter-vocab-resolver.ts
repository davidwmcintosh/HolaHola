/**
 * textbook-chapter-vocab-resolver.ts
 *
 * Non-React module: exports the chapter-key dispatch table and the
 * getTextbookVocab() resolver so they can be imported by both
 * OverlayPanelContent.tsx and the CI test suite.
 *
 * Adding a new textbook chapter:
 *   1. If the chapter uses Gust/Madrigal content — add an entry to GUST_CHAPTER_MAP.
 *   2. If it needs a custom extractor — add an `else if` branch in getTextbookVocab()
 *      AND add the key to INLINE_CHAPTER_KEYS below.
 *   3. The test suite will catch a missing mapping automatically: every key in
 *      KNOWN_CHAPTER_KEYS must resolve to ≥1 vocab entry or CI fails.
 */

import {
  getBookVerbContent,
  getPreteriteContent,
  getSerContent,
  getHayContent,
  getGustContent,
} from "@/data/madrigal-unit-content";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VocabEntry {
  word: string;
  description: string;
}

// ── GUST chapter map ──────────────────────────────────────────────────────────
// Maps UI chapter keys → Gust/Madrigal content lookup keys.

export const GUST_CHAPTER_MAP: Record<string, string> = {
  "gustar-me-gusta":        "gustar:",
  "gustaria":               "me gustaría:",
  "fui-i-went":             "fui:",
  "voy-a-infinitive":       "voy a:",
  "va-a-third-person":      "va a:",
  "que-hizo":               "qué hizo",
  "tuvo-he-had":            "tuvo:",
  "le-indirect-object":     "le:",
  "esta-he-is":             "está:",
  "estudie-i-studied":      "estudié:",
  "recibi-i-received":      "recibí:",
  "compraba-imperfect":     "compraba",
  "tengo-catarro":          "tengo catarro",
  "a-que-hora":             "a qué hora",
  "como-esta":              "cómo está",
  "que-esta-haciendo":      "qué está haciendo",
  "me-levanto":             "me levanto",
  "he-comprado":            "he comprado",
  "lo-veo":                 "lo veo",
  "me-lo":                  "me lo",
  "hable-formal-commands":  "hable:",
  "telling-time":           "telling time",
};

// ── Inline extractor keys ─────────────────────────────────────────────────────
// Must stay in sync with the if/else chain in getTextbookVocab() below.

const INLINE_CHAPTER_KEYS: ReadonlyArray<string> = [
  "ir-going-places",
  "tomar-i-took",
  "comprar-i-bought",
  "near-future-voy-a",
  "tener-i-have",
  "quiero-i-want",
  "ser-plurals-gender",
  "hay",
  "puedo-ir",
  "estar-locations",
];

// ── Complete known-chapter registry ───────────────────────────────────────────
// Every key that should resolve to ≥1 vocab entry.
// The CI test iterates this set and fails on any key that returns 0 entries.

export const KNOWN_CHAPTER_KEYS: ReadonlySet<string> = new Set([
  ...INLINE_CHAPTER_KEYS,
  ...Object.keys(GUST_CHAPTER_MAP),
]);

// ── Internal helpers ──────────────────────────────────────────────────────────

function extractGustVocab(lookupKey: string): VocabEntry[] {
  const c = getGustContent(lookupKey) as any;
  if (!c) return [];
  const entries: VocabEntry[] = [];
  (c.clusters as any[]).forEach((cl: any) => {
    const pairs: any[] = cl.pairs || [];
    pairs.forEach((p: any) => {
      if (p.imageWord) {
        entries.push({ word: p.imageWord, description: p.answerTranslation || p.answer || "" });
      }
    });
  });
  return entries.filter((e) => Boolean(e.word));
}

// ── Public resolver ───────────────────────────────────────────────────────────

/**
 * Returns the vocab entries for a textbook chapter.
 *
 * In non-production builds, logs a console.warn when 0 entries are returned so
 * a missing extractor or GUST_CHAPTER_MAP entry is immediately visible during
 * development. The CI test is the primary prevention; the warn is secondary
 * diagnostics.
 */
export function getTextbookVocab(chapterKey: string): VocabEntry[] {
  const entries: VocabEntry[] = [];

  if (chapterKey === "ir-going-places") {
    const c = getBookVerbContent("where are you going");
    if (c) c.positiveItems.forEach((i) => entries.push({ word: i.word, description: i.translation }));
  } else if (chapterKey === "tomar-i-took") {
    const c = getPreteriteContent("tomar");
    if (c) c.clusters.forEach((cl) => (cl.qaCards || []).forEach((card) => entries.push({ word: card.imageWord, description: card.answerTranslation })));
  } else if (chapterKey === "comprar-i-bought") {
    const c = getPreteriteContent("comprar");
    if (c) c.clusters.forEach((cl) => (cl.qaCards || []).forEach((card) => entries.push({ word: card.imageWord, description: card.answerTranslation })));
  } else if (chapterKey === "near-future-voy-a") {
    const c = getPreteriteContent("voy a");
    if (c) c.clusters.forEach((cl: any) => {
      // cluster 0 has statementCards (word/translation); clusters 1+ have qaCards (imageWord/answerTranslation)
      (cl.statementCards || []).forEach((card: any) => entries.push({ word: card.word, description: card.translation || "" }));
      (cl.qaCards || []).forEach((card: any) => entries.push({ word: card.imageWord, description: card.answerTranslation || "" }));
    });
  } else if (chapterKey === "tener-i-have") {
    const c = getPreteriteContent("tener");
    if (c) c.clusters.forEach((cl) => (cl.qaCards || []).forEach((card) => entries.push({ word: card.imageWord, description: card.answerTranslation })));
  } else if (chapterKey === "quiero-i-want") {
    const c = getPreteriteContent("quiero");
    if (c) c.clusters.forEach((cl) => (cl.qaCards || []).forEach((card) => entries.push({ word: card.imageWord, description: card.answerTranslation })));
  } else if (chapterKey === "ser-plurals-gender") {
    const c = getSerContent("ser");
    if (c) {
      (c.clusters as any[]).forEach((cl: any) => {
        // article-pairs and es-son-sentences clusters: pairs use imageWord + leftTranslation
        if (Array.isArray(cl.pairs)) {
          cl.pairs.forEach((p: any) =>
            entries.push({
              word: p.imageWord || p.singular || p.word || "",
              description: p.leftTranslation || p.singularTranslation || p.translation || "",
            })
          );
        }
        // imagePairs in consonant-plural clusters
        if (Array.isArray(cl.imagePairs)) {
          cl.imagePairs.forEach((p: any) =>
            entries.push({
              word: p.imageWord || p.singular || p.word || "",
              description: p.leftTranslation || p.singularTranslation || p.translation || "",
            })
          );
        }
      });
    }
  } else if (chapterKey === "hay") {
    const c = getHayContent("hay:") as any;
    if (c) {
      const clusters: any[] = c.clusters || [];
      clusters.forEach((cl: any) => {
        // hay pairs: { imageWord, answerTranslation, ... }
        const pairs: any[] = cl.pairs || [];
        pairs.forEach((p: any) =>
          entries.push({
            word: p.imageWord || p.word || "",
            description: p.answerTranslation || p.translation || "",
          })
        );
      });
    }
  } else if (chapterKey === "puedo-ir") {
    const c = getHayContent("puedo ir") as any;
    if (c) {
      const clusters: any[] = c.clusters || [];
      clusters.forEach((cl: any) => {
        const pairs: any[] = cl.pairs || [];
        pairs.forEach((p: any) => {
          if (p.imageWord) {
            entries.push({ word: p.imageWord, description: p.answerTranslation || p.questionTranslation || "" });
          }
        });
      });
    }
  } else if (chapterKey === "estar-locations") {
    const c = getSerContent("estar") as any;
    if (c) {
      (c.clusters as any[]).forEach((cl: any) => {
        if (Array.isArray(cl.cards)) {
          cl.cards.forEach((card: any) => {
            if (card.imageWord) {
              entries.push({
                word: card.imageWord,
                description: card.translation || card.answerTranslation || "",
              });
            }
          });
        }
        if (Array.isArray(cl.genderPairs)) {
          cl.genderPairs.forEach((gp: any) => {
            if (gp.masculine) entries.push({ word: gp.masculine.spanish, description: gp.masculine.english });
          });
        }
        if (Array.isArray(cl.additionalItems)) {
          cl.additionalItems.forEach((item: any) => {
            if (item.spanish) entries.push({ word: item.spanish, description: item.english || "" });
          });
        }
      });
    }
  }

  // Gust chapter family — covers all Madrigal chapters not handled above
  const gustLookup = GUST_CHAPTER_MAP[chapterKey];
  if (gustLookup) {
    return extractGustVocab(gustLookup);
  }

  const result = entries.filter((e) => Boolean(e.word));

  if (process.env.NODE_ENV !== "production" && result.length === 0) {
    console.warn(
      `[textbook] getTextbookVocab("${chapterKey}") returned 0 entries. ` +
        `Add a branch in getTextbookVocab() or an entry in GUST_CHAPTER_MAP ` +
        `so the panel doesn't silently show "Chapter not available in preview."`
    );
  }

  return result;
}
