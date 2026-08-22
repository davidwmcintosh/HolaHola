/**
 * book-unit-content.ts
 * Re-export shim — components import from here; source data lives in the
 * internal file. Keeping the two separate lets us rename the public surface
 * without touching the large data file's path.
 */
export type {
  BookAnchorItem,
  BookPositiveItem,
  BookVerbUnitContent,
  Page12QAItem,
  PreteriteQACard,
  PreteriteConjugationRow,
  PreteriteCluster,
  PreteriteUnitContent,
  DualFormPair,
  SerCluster,
  SerUnitContent,
  HayQandAPair,
  HayVocabCluster,
  HayUnitContent,
  GustVocabCluster,
  GustUnitContent,
} from "./madrigal-unit-content";

export {
  getBookVerbContent,
  getPreteriteContent,
  getSerContent,
  getHayContent,
  getGustContent,
} from "./madrigal-unit-content";
