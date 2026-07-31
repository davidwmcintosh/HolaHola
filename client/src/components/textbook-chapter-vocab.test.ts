/**
 * CI guard: every chapter key in TEXTBOOK_CHAPTER_KEYS (the canonical invocation
 * surface used by show_textbook_section in daniela-function-registry.ts) must
 * resolve to at least one vocab entry through getTextbookVocab().
 *
 * How this catches regressions:
 *   - A developer adds a new key to TEXTBOOK_CHAPTER_KEYS (shared/textbook-chapter-keys.ts).
 *   - They forget to add an extractor branch or GUST_CHAPTER_MAP entry in
 *     textbook-chapter-vocab-resolver.ts.
 *   - This test fails on that key before the change can merge.
 *
 * The test is anchored to the canonical invocation surface (the shared constant),
 * not to the resolver's internal KNOWN_CHAPTER_KEYS, so it catches drift between
 * the two independently-maintained lists.
 *
 * Run with:
 *   npx tsx --test client/src/components/textbook-chapter-vocab.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TEXTBOOK_CHAPTER_KEYS } from '@shared/textbook-chapter-keys';
import {
  getTextbookVocab,
  KNOWN_CHAPTER_KEYS,
} from '@/components/textbook-chapter-vocab-resolver';

// ---------------------------------------------------------------------------
// Parity guard — canonical invocation surface vs. resolver coverage.
//
// This is the drift check: if a key is added to the function registry (via
// TEXTBOOK_CHAPTER_KEYS) but forgotten in the resolver, the set diff fails.
// ---------------------------------------------------------------------------

describe('Textbook chapter vocab — canonical ↔ resolver parity', () => {

  it('TEXTBOOK_CHAPTER_KEYS is non-empty', () => {
    assert.ok(TEXTBOOK_CHAPTER_KEYS.length > 0, 'Canonical key list must not be empty');
  });

  it('every canonical key is present in KNOWN_CHAPTER_KEYS (no un-wired registry keys)', () => {
    const missing = TEXTBOOK_CHAPTER_KEYS.filter((k) => !KNOWN_CHAPTER_KEYS.has(k));
    assert.deepEqual(
      missing,
      [],
      `These keys are in TEXTBOOK_CHAPTER_KEYS (the show_textbook_section enum) but have ` +
        `no extractor in textbook-chapter-vocab-resolver.ts. Add a branch or GUST_CHAPTER_MAP ` +
        `entry for each: ${missing.join(', ')}`,
    );
  });

  it('every resolver key is present in TEXTBOOK_CHAPTER_KEYS (no orphan extractors)', () => {
    const orphans = [...KNOWN_CHAPTER_KEYS].filter(
      (k) => !(TEXTBOOK_CHAPTER_KEYS as readonly string[]).includes(k),
    );
    assert.deepEqual(
      orphans,
      [],
      `These keys have an extractor in the resolver but are absent from ` +
        `TEXTBOOK_CHAPTER_KEYS. Either add them to shared/textbook-chapter-keys.ts ` +
        `or remove the dead extractor: ${orphans.join(', ')}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Coverage guard — every canonical key resolves to ≥1 vocab entry.
//
// Iterates TEXTBOOK_CHAPTER_KEYS (the canonical surface) so a newly added key
// that passes parity but has a broken extractor is still caught.
// ---------------------------------------------------------------------------

describe('Textbook chapter vocab — every canonical chapter resolves to entries', () => {

  it('canonical key list is non-empty', () => {
    assert.ok(TEXTBOOK_CHAPTER_KEYS.length > 0, 'Canonical key list must not be empty');
  });

  for (const key of TEXTBOOK_CHAPTER_KEYS) {
    it(`"${key}" returns at least one vocab entry`, () => {
      const entries = getTextbookVocab(key);
      assert.ok(
        entries.length > 0,
        `Chapter key "${key}" resolved to 0 entries — the panel would show ` +
          `"Chapter not available in preview." Add a branch in getTextbookVocab() ` +
          `or an entry in GUST_CHAPTER_MAP in textbook-chapter-vocab-resolver.ts.`,
      );
    });

    it(`"${key}" — every entry has a non-empty word field`, () => {
      const entries = getTextbookVocab(key);
      for (const e of entries) {
        assert.ok(
          typeof e.word === 'string' && e.word.trim().length > 0,
          `Chapter "${key}" produced an entry with an empty word: ${JSON.stringify(e)}`,
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Allowlist integrity — an unrecognized key returns 0 entries (dev warn fires).
// ---------------------------------------------------------------------------

describe('Textbook chapter vocab — unrecognized key behaviour', () => {

  it('an unrecognized chapter key is absent from TEXTBOOK_CHAPTER_KEYS', () => {
    assert.ok(
      !(TEXTBOOK_CHAPTER_KEYS as readonly string[]).includes('unknown-chapter-xyz'),
      'Fake key should not appear in the canonical key list',
    );
  });

  it('an unrecognized chapter key returns 0 entries (triggering the dev warn path)', () => {
    const entries = getTextbookVocab('unknown-chapter-xyz');
    assert.strictEqual(
      entries.length,
      0,
      'An unrecognized key must return 0 entries so the console.warn fires in dev mode',
    );
  });
});
