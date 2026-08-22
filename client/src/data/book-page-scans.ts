/**
 * book-page-scans.ts
 * Re-export shim — components import from here; source data lives in the
 * internal file. Keeps the public import surface free of internal naming.
 */
export type { BookPageType, BookPageScan } from "./madrigal-page-scans";

export {
  BOOK_PAGE_SCANS,
  BOOK_APPENDIX_SCANS,
  getBookScanUrl,
  getBookPageMeta,
  findPageForVocab,
  getLeftPageCount,
} from "./madrigal-page-scans";
