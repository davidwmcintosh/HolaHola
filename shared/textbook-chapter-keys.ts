/**
 * Canonical list of textbook chapter keys — single source of truth.
 *
 * This array drives:
 *   - server/services/daniela-function-registry.ts  — show_textbook_section enum
 *   - client/src/components/textbook-chapter-vocab-resolver.ts — coverage check
 *   - client/src/components/textbook-chapter-vocab.test.ts — CI guard
 *
 * When adding a new chapter:
 *   1. Add the key here.
 *   2. Add an extractor branch or GUST_CHAPTER_MAP entry in textbook-chapter-vocab-resolver.ts.
 *   3. The CI test will fail if step 2 is skipped — that is intentional.
 */
export const TEXTBOOK_CHAPTER_KEYS = [
  "ir-going-places",
  "tomar-i-took",
  "comprar-i-bought",
  "near-future-voy-a",
  "tener-i-have",
  "quiero-i-want",
  "ser-plurals-gender",
  "estar-locations",
  "hay",
  "puedo-ir",
  "gustar-me-gusta",
  "gustaria",
  "fui-i-went",
  "voy-a-infinitive",
  "va-a-third-person",
  "que-hizo",
  "tuvo-he-had",
  "le-indirect-object",
  "esta-he-is",
  "estudie-i-studied",
  "recibi-i-received",
  "compraba-imperfect",
  "tengo-catarro",
  "a-que-hora",
  "como-esta",
  "que-esta-haciendo",
  "me-levanto",
  "he-comprado",
  "lo-veo",
  "me-lo",
  "hable-formal-commands",
  "telling-time",
] as const;

export type TextbookChapterKey = (typeof TEXTBOOK_CHAPTER_KEYS)[number];
