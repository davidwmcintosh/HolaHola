/**
 * book-page-scans (internal)
 *
 * Page-by-page registry for the "See It and Say It in Spanish" book.
 * Scans live in Object Storage; this file is the metadata layer that connects
 * page numbers to vocabulary, chapter keys, and pedagogical context.
 *
 * CONTENT LAW: Fill in only what is directly observed on the page scan.
 * Never infer or generate descriptions — always transcribe from the actual page.
 *
 * Book structure (98 pages total):
 *   pp.  1–8   Front matter (cover, dedication, pronunciation guide)
 *   pp.  9–13  Chapter 1  — ir: Where Are You Going? (Voy al…)
 *   pp. 14–28  Chapter 2  — Preterite: Tomar, Comprar
 *   pp. 29–43  Chapter 3  — Future: Voy a…
 *   pp. 44–63  Chapter 4  — Tener, Quiero
 *   pp. 64–71  Chapter 5  — Ser: Gender & Plurals
 *   pp. 72–85  Chapter 6  — Estar, Puedo Ir
 *   pp. 86–98  Back matter / review
 */

export type BookPageType =
  | "cover"
  | "dedication"
  | "toc"
  | "pronunciation"
  | "intro"
  | "vocab"         // image-card vocabulary page ("Voy al…" style)
  | "anchor"        // anchor phrase / grammar focus page
  | "drill"         // sentence-former / pattern drill
  | "conjugation"   // conjugation table
  | "qa"            // Q&A image card page ("¿Va al…?" style)
  | "review"        // review / summary exercises
  | "appendix"
  | "blank"
  | "unknown";

export interface BookPageScan {
  /** 1-based page number in the book */
  pageNumber: number;
  pageType: BookPageType;
  /** Short plain-English description of what's on the page */
  description?: string;
  /** Matches chapterTitleKey in book-unit-content */
  chapterKey?: string;
  /** Left-page number in the physical spread (so we know this page's partner) */
  spreadWith?: number;
  /** Vocab words that appear on this page — used for book-page-aware splits */
  vocabulary?: string[];
  /** True once the metadata has been verified against an actual scan */
  verified?: boolean;
}

// ── Known page annotations ────────────────────────────────────────────────────
// Verified: pages 9 (from existing transcription in book-unit-content)
// Everything else is a stub; fill in as you review each scan.

export const BOOK_PAGE_SCANS: BookPageScan[] = [
  // ── Front matter ──────────────────────────────────────────────────────────
  { pageNumber: 1,  pageType: "cover",        description: "Front cover" },
  { pageNumber: 2,  pageType: "dedication",   description: "Dedication / copyright page" },
  { pageNumber: 3,  pageType: "toc",          description: "Table of contents" },
  { pageNumber: 4,  pageType: "toc",          description: "Table of contents (continued)" },
  { pageNumber: 5,  pageType: "pronunciation",description: "Pronunciation guide" },
  { pageNumber: 6,  pageType: "pronunciation",description: "Pronunciation guide (continued)" },
  { pageNumber: 7,  pageType: "intro",        description: "Introduction" },
  { pageNumber: 8,  pageType: "intro",        description: "Introduction (continued)" },

  // ── Chapter 1: ir — Where Are You Going? (pp. 9–13) ──────────────────────
  {
    pageNumber: 9,
    pageType: "vocab",
    chapterKey: "where are you going",
    spreadWith: 10,
    description: "Voy al... (hotel, banco, garaje, restaurante) — 4 image cards",
    vocabulary: ["hotel", "banco", "garaje", "restaurante"],
    verified: true,
  },
  {
    pageNumber: 10,
    pageType: "anchor",
    chapterKey: "where are you going",
    spreadWith: 9,
    description: "¿Va? anchor + sentence-former columns",
  },
  {
    pageNumber: 11,
    pageType: "drill",
    chapterKey: "where are you going",
    description: "No voy al… negative form + sentence-former",
  },
  {
    pageNumber: 12,
    pageType: "qa",
    chapterKey: "where are you going",
    description: "¿Va al…? Q&A practice (banco, parque, hotel, club)",
    vocabulary: ["banco", "parque", "hotel", "discoteca"],
  },
  {
    pageNumber: 13,
    pageType: "drill",
    chapterKey: "where are you going",
    description: "Vamos al… (let's go) + sentence-former",
    vocabulary: ["hotel", "banco", "restaurante", "discoteca"],
  },
];

// ── Appendix registry (29 pages) ──────────────────────────────────────────────
export const BOOK_APPENDIX_SCANS: BookPageScan[] = [
  { pageNumber: 1, pageType: "unknown", description: "To be identified" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns the API URL that serves the scan image for a given page. */
export function getBookScanUrl(pageNumber: number, book: "main" | "appendix" = "main"): string {
  return `/api/book/page-scan/${book}/${pageNumber}`;
}

/** Looks up the metadata for a given page, or returns a stub if not yet annotated. */
export function getBookPageMeta(
  pageNumber: number,
  book: "main" | "appendix" = "main"
): BookPageScan {
  const registry = book === "main" ? BOOK_PAGE_SCANS : BOOK_APPENDIX_SCANS;
  return (
    registry.find((p) => p.pageNumber === pageNumber) ?? {
      pageNumber,
      pageType: "unknown",
    }
  );
}

/**
 * Given a list of vocabulary words, find the book page they appear on.
 * Returns the first matching page that contains ALL the given words.
 */
export function findPageForVocab(words: string[]): BookPageScan | null {
  const lower = words.map((w) => w.toLowerCase());
  return (
    BOOK_PAGE_SCANS.find(
      (p) => p.vocabulary && lower.every((w) => p.vocabulary!.map((v) => v.toLowerCase()).includes(w))
    ) ?? null
  );
}

/**
 * For a given chapter key and a list of vocab words, compute how many
 * items should appear on the LEFT page of the two-page spread.
 *
 * If the page boundary is known from scan data, use it.
 * Otherwise fall back to Math.ceil(n / 2).
 */
export function getLeftPageCount(chapterKey: string, vocabWords: string[]): number {
  // Find pages in this chapter
  const chapterPages = BOOK_PAGE_SCANS.filter(
    (p) => p.chapterKey === chapterKey && p.vocabulary && p.vocabulary.length > 0
  );
  if (chapterPages.length === 0) {
    return Math.ceil(vocabWords.length / 2);
  }

  // Find the first (lowest page number) vocab page
  const firstPage = chapterPages.reduce((a, b) => (a.pageNumber < b.pageNumber ? a : b));
  return firstPage.vocabulary?.length ?? Math.ceil(vocabWords.length / 2);
}
