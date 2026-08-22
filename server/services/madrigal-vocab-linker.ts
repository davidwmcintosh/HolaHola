/**
 * madrigal-vocab-linker.ts
 *
 * Bridges in-scene vocabulary mastery back to the Madrigal curriculum.
 * When a student masters a word in a scene (e.g. "el café"), this service
 * answers: "which Madrigal unit does that word belong to?"
 *
 * Uses the vocabTerms[] arrays in the loop catalog as the lookup corpus.
 * Index is built lazily and cached in-process.
 */

import { MADRIGAL_LOOP_CATALOG } from '../data/madrigal-loop-catalog';

// ── Article stripping ─────────────────────────────────────────────────────────
// Spanish articles that commonly prefix vocab words in scene props.
const ARTICLES = /^(el|la|los|las|un|una|unos|unas)\s+/i;

function normalize(term: string): string {
  return term.replace(ARTICLES, '').toLowerCase().trim();
}

// ── Lazy index ────────────────────────────────────────────────────────────────

interface UnitRef {
  contentKey: string;
  displayName: string;
  unitType: string;
  language: string;
}

type TermIndex = Map<string, UnitRef>;

let _index: TermIndex | null = null;

function getIndex(): TermIndex {
  if (_index) return _index;
  _index = new Map<string, UnitRef>();
  for (const unit of MADRIGAL_LOOP_CATALOG) {
    const ref: UnitRef = {
      contentKey: unit.contentKey,
      displayName: unit.displayName,
      unitType: unit.unitType,
      language: unit.language ?? 'spanish',
    };
    for (const term of unit.vocabTerms) {
      const key = normalize(term);
      if (key && !_index.has(key)) {
        _index.set(key, ref);
      }
    }
  }
  return _index;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface MadrigalMatch {
  contentKey: string;
  displayName: string;
  unitType: string;
  language: string;
  matchedTerm: string;
}

/**
 * Given a target-language word and optional English translation, returns the
 * first Madrigal unit whose vocabTerms contain either term.
 *
 * Returns null if no match is found.
 */
export function findMadrigalUnit(
  word: string,
  translation?: string,
  language = 'spanish',
): MadrigalMatch | null {
  const index = getIndex();

  const candidates = [normalize(word)];
  if (translation) candidates.push(normalize(translation));

  // Also try the bare word without any parenthetical notes like "café (coffee)"
  const bare = normalize(word.replace(/\s*\(.*?\)/, ''));
  if (!candidates.includes(bare)) candidates.push(bare);

  for (const key of candidates) {
    if (!key) continue;
    const ref = index.get(key);
    if (ref && (language === 'all' || ref.language === language)) {
      return { ...ref, matchedTerm: key };
    }
  }
  return null;
}

/**
 * Given a set of newly-mastered words from a scene prop's vocab array,
 * returns a compact stage-direction string for Daniela — or null if nothing matched.
 *
 * The note is intentionally minimal: one clause, parenthetical, not instructional.
 * Daniela can use or ignore it; it doesn't prescribe a response.
 */
export function buildMadrigalLinkNote(
  words: Array<{ word: string; translation?: string }>,
  language = 'spanish',
): string | null {
  for (const { word, translation } of words) {
    const match = findMadrigalUnit(word, translation, language);
    if (match) {
      return `*(${word} is part of the "${match.displayName}" unit in the Syllabus)*`;
    }
  }
  return null;
}
