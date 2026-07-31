/**
 * Regression test: three textbook chapters must resolve to vocab entries.
 *
 * Chapters under test:
 *   - estar-locations  (getSerContent("estar") → estar-statements / estar-expressions clusters)
 *   - puedo-ir         (getHayContent("puedo ir") → pairs with imageWord)
 *   - telling-time     (getGustContent("telling time") → pairs with imageWord)
 *
 * All three were added in Task 31.  Without this test a data-shape mismatch
 * could silently cause the panel to show "Chapter not available in preview."
 *
 * Run with:
 *   npx tsx --test client/src/components/textbook-chapter-vocab.test.ts
 *
 * Uses Node.js built-in test runner — no extra packages needed.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  getSerContent,
  getHayContent,
  getGustContent,
} from '@/data/madrigal-unit-content';

// ---------------------------------------------------------------------------
// Mirror of the three extraction paths in OverlayPanelContent.tsx
// getTextbookVocab() — keep in sync with the production function.
// ---------------------------------------------------------------------------

interface VocabEntry { word: string; description: string }

/** estar-locations branch */
function extractEstarLocations(): VocabEntry[] {
  const entries: VocabEntry[] = [];
  const c = getSerContent('estar') as any;
  if (!c) return entries;
  (c.clusters as any[]).forEach((cl: any) => {
    if (Array.isArray(cl.cards)) {
      cl.cards.forEach((card: any) => {
        if (card.imageWord) {
          entries.push({
            word: card.imageWord,
            description: card.translation || card.answerTranslation || '',
          });
        }
      });
    }
    if (Array.isArray(cl.genderPairs)) {
      cl.genderPairs.forEach((gp: any) => {
        if (gp.masculine) {
          entries.push({ word: gp.masculine.spanish, description: gp.masculine.english });
        }
      });
    }
    if (Array.isArray(cl.additionalItems)) {
      cl.additionalItems.forEach((item: any) => {
        if (item.spanish) entries.push({ word: item.spanish, description: item.english || '' });
      });
    }
  });
  return entries.filter(e => Boolean(e.word));
}

/** puedo-ir branch */
function extractPuedoIr(): VocabEntry[] {
  const entries: VocabEntry[] = [];
  const c = getHayContent('puedo ir') as any;
  if (!c) return entries;
  (c.clusters as any[]).forEach((cl: any) => {
    (cl.pairs as any[] || []).forEach((p: any) => {
      if (p.imageWord) {
        entries.push({
          word: p.imageWord,
          description: p.answerTranslation || p.questionTranslation || '',
        });
      }
    });
  });
  return entries.filter(e => Boolean(e.word));
}

/** telling-time branch (via GUST_CHAPTER_MAP → extractGustVocab) */
function extractTellingTime(): VocabEntry[] {
  const entries: VocabEntry[] = [];
  const c = getGustContent('telling time') as any;
  if (!c) return entries;
  (c.clusters as any[]).forEach((cl: any) => {
    (cl.pairs as any[] || []).forEach((p: any) => {
      if (p.imageWord) {
        entries.push({
          word: p.imageWord,
          description: p.answerTranslation || p.answer || '',
        });
      }
    });
  });
  return entries.filter(e => Boolean(e.word));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Textbook chapter vocab — three new chapters (Task 31)', () => {

  describe('estar-locations', () => {
    it('getSerContent("estar") resolves to a non-null unit', () => {
      const c = getSerContent('estar');
      assert.ok(c !== null, 'getSerContent("estar") returned null — chapter data is missing');
    });

    it('extractEstarLocations() returns at least one entry', () => {
      const entries = extractEstarLocations();
      assert.ok(
        entries.length > 0,
        `estar-locations produced 0 entries — panel would show "Chapter not available in preview."`,
      );
    });

    it('every estar-locations entry has a non-empty word field', () => {
      const entries = extractEstarLocations();
      for (const e of entries) {
        assert.ok(
          typeof e.word === 'string' && e.word.trim().length > 0,
          `Entry has empty word: ${JSON.stringify(e)}`,
        );
      }
    });
  });

  describe('puedo-ir', () => {
    it('getHayContent("puedo ir") resolves to a non-null unit', () => {
      const c = getHayContent('puedo ir');
      assert.ok(c !== null, 'getHayContent("puedo ir") returned null — chapter data is missing');
    });

    it('extractPuedoIr() returns at least one entry', () => {
      const entries = extractPuedoIr();
      assert.ok(
        entries.length > 0,
        `puedo-ir produced 0 entries — panel would show "Chapter not available in preview."`,
      );
    });

    it('every puedo-ir entry has a non-empty word field', () => {
      const entries = extractPuedoIr();
      for (const e of entries) {
        assert.ok(
          typeof e.word === 'string' && e.word.trim().length > 0,
          `Entry has empty word: ${JSON.stringify(e)}`,
        );
      }
    });
  });

  describe('telling-time', () => {
    it('getGustContent("telling time") resolves to a non-null unit', () => {
      const c = getGustContent('telling time');
      assert.ok(c !== null, 'getGustContent("telling time") returned null — chapter data is missing');
    });

    it('extractTellingTime() returns at least one entry', () => {
      const entries = extractTellingTime();
      assert.ok(
        entries.length > 0,
        `telling-time produced 0 entries — panel would show "Chapter not available in preview."`,
      );
    });

    it('every telling-time entry has a non-empty word field', () => {
      const entries = extractTellingTime();
      for (const e of entries) {
        assert.ok(
          typeof e.word === 'string' && e.word.trim().length > 0,
          `Entry has empty word: ${JSON.stringify(e)}`,
        );
      }
    });
  });
});
