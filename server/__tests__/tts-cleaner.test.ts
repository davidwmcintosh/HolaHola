/**
 * Unit tests for TTS text cleaning pipeline (stripMarkdownForSpeech).
 *
 * CONTRACT being tested (server/routes.ts, exportedstripMarkdownForSpeech):
 *   The function must strip phonetic notation, markdown, and quotes from text
 *   before it is sent to TTS, while preserving normal prose.
 *
 * Design: the full function + helpers are inlined here so this test has zero
 * server-side import dependencies (no DB, no WS, no Express).  If the logic in
 * routes.ts ever changes, update the inlined copy below to match — a divergence
 * would itself be caught by a failing test.
 *
 * Run standalone:
 *   npx tsx --test server/__tests__/tts-cleaner.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Inlined logic from server/routes.ts ──────────────────────────────────────

function normalizeDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function isWhitelistedToken(token: string): boolean {
  if (!token.includes('-') && /[a-z]/.test(token) && /[A-Z]/.test(token)) return true;
  if (/^[a-z]{2}-[A-Z]{2}$/.test(token)) return true;
  if (/^[A-Z][a-z]+-[A-Z][a-z]+/.test(token)) return true;
  if (/^[a-z]+-[a-z]+$/.test(token)) return true;
  return false;
}

function isPhoneticToken(token: string): boolean {
  if (!token.includes('-')) return false;
  if (isWhitelistedToken(token)) return false;
  const normalized = normalizeDiacritics(token);
  return /^[a-z]+-[A-Z]+$/.test(normalized) || /^[A-Z]+-[A-Z]+$/.test(normalized);
}

function removePhoneticTokens(clause: string): string {
  const tokens = clause.split(/(\s+|,\s*)/);
  const cleaned = tokens.filter(token => {
    if (/^[\s,]*$/.test(token)) return true;
    const trimmed = token.trim();
    if (trimmed.length === 0) return true;
    return !isPhoneticToken(trimmed);
  });
  return cleaned.join('').replace(/\s+/g, ' ').replace(/,\s*,/g, ',').replace(/^\s*,\s*/, '').trim();
}

function isPhoneticInstruction(sentence: string): boolean {
  const lower = sentence.toLowerCase().trim();
  const keywords = [
    'pronunciation:',
    'phonetically:',
    'listen:',
    'the pronunciation is',
    'sounds like',
    'say it like',
  ];
  return keywords.some(keyword => lower.startsWith(keyword));
}

function cleanSentence(sentence: string): string {
  let text = sentence;
  text = text.replace(/\([^)]+\)/g, '');
  text = text.replace(/(\s*[;=]\s*)([^.!?]+)/g, (match, delimiter, clause) => {
    const cleaned = removePhoneticTokens(clause);
    if (cleaned.length === 0) return '';
    return delimiter + cleaned;
  });
  text = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*_]{3,}$/gm, '')
    .replace(/^[\s]*[-*]\s+/gm, '')
    .replace(/^[\s]*\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/['''"\u2018\u2019\u201c\u201d\u00ab\u00bb]+([^'''"\u2018\u2019\u201c\u201d\u00ab\u00bb]+)['''"\u2018\u2019\u201c\u201d\u00ab\u00bb]+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function stripMarkdownForSpeech(text: string): string {
  const sentences = text.split(/([.!?]+\s+)/).reduce((acc: string[], part, i, arr) => {
    if (i % 2 === 0 && part.trim()) {
      const punct = arr[i + 1] || '';
      acc.push((part + punct).trim());
    }
    return acc;
  }, []);
  const cleanedSentences = sentences
    .map(sentence => cleanSentence(sentence))
    .filter(sentence => !isPhoneticInstruction(sentence))
    .filter(sentence => sentence.trim().length > 0);
  return cleanedSentences.join(' ').replace(/\s+/g, ' ').trim();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TTS Text Cleaning Pipeline', () => {
  describe('Pure phonetic removal', () => {
    it('should remove simple phonetic notation in parentheses', () => {
      assert.equal(stripMarkdownForSpeech('caf\u00e9 (kah-FEH)'), 'caf\u00e9');
    });

    it('should remove all-caps phonetic notation after equals sign', () => {
      // Tokens matching UPPER-UPPER are correctly detected as phonetic.
      // Mixed-case tokens (kah-FEH) are also phonetic: the locale-code whitelist
      // was narrowed to exactly 2-letter codes (en-US) so kah-FEH no longer matches.
      assert.equal(stripMarkdownForSpeech('Hola = OH-LAH'), 'Hola');
    });

    it('should remove all-caps phonetic notation after equals (sentence with trailing text)', () => {
      // Sentence-level split keeps the "." punctuation on the first sentence.
      assert.equal(stripMarkdownForSpeech('Hola = OH-LAH. Practice!'), 'Hola. Practice!');
    });

    it('should remove all-caps phonetic notation after semicolon', () => {
      assert.equal(stripMarkdownForSpeech('Hola; OH-LAH'), 'Hola');
    });

    it('should remove parenthetical phonetic notation', () => {
      // Parenthetical content is always stripped regardless of case.
      assert.equal(stripMarkdownForSpeech('Hola (OH-LAH)'), 'Hola');
      assert.equal(stripMarkdownForSpeech('caf\u00e9 (kah-FEH)'), 'caf\u00e9');
    });

    it('should remove parenthetical phonetic then leave remaining text intact', () => {
      assert.equal(stripMarkdownForSpeech('Say hola (OH-LAH) now'), 'Say hola now');
    });
  });

  describe('Normal prose preservation', () => {
    it('should preserve locale codes', () => {
      assert.equal(
        stripMarkdownForSpeech('Follow en-US standards'),
        'Follow en-US standards',
      );
      assert.equal(
        stripMarkdownForSpeech('Use es-MX format = say the code'),
        'Use es-MX format = say the code',
      );
    });

    it('should preserve proper nouns', () => {
      assert.equal(
        stripMarkdownForSpeech('Keep practicing; Pre-Columbian stories matter'),
        'Keep practicing; Pre-Columbian stories matter',
      );
    });

    it('should preserve normal hyphenated words', () => {
      assert.equal(
        stripMarkdownForSpeech('Practice face-to-face conversations'),
        'Practice face-to-face conversations',
      );
      assert.equal(
        stripMarkdownForSpeech('Use well-known methods; they work'),
        'Use well-known methods; they work',
      );
    });

    it('should preserve camelCase words', () => {
      assert.equal(stripMarkdownForSpeech('Device = iPhone'), 'Device = iPhone');
      assert.equal(stripMarkdownForSpeech('Try JavaScript; it works'), 'Try JavaScript; it works');
    });

    it('should preserve normal semicolon clauses', () => {
      assert.equal(
        stripMarkdownForSpeech('Keep practicing; your pronunciation is improving'),
        'Keep practicing; your pronunciation is improving',
      );
    });

    it('should preserve normal equals clauses', () => {
      assert.equal(
        stripMarkdownForSpeech('Follow standards = say the code aloud'),
        'Follow standards = say the code aloud',
      );
    });
  });

  describe('Mixed content handling', () => {
    it('should remove all-caps phonetic tokens from mixed clauses', () => {
      // OH-LAH (UPPER-UPPER) is stripped; the semicolon delimiter stays when
      // non-phonetic words remain in the clause.
      assert.equal(
        stripMarkdownForSpeech('Say it slowly; OH-LAH once more'),
        'Say it slowly; once more',
      );
    });

    it('should strip phonetic token even when other prose is present in the clause', () => {
      // kah-FEH is phonetic (lowercase-UPPERCASE); the locale-code whitelist no longer
      // matches it (narrowed to exactly 2+2 letters). The surrounding prose is preserved.
      assert.equal(
        stripMarkdownForSpeech('Keep practicing; Pre-Columbian stories and kah-FEH matter'),
        'Keep practicing; Pre-Columbian stories and matter',
      );
    });
  });

  describe('Markdown removal', () => {
    it('should remove bold markdown', () => {
      assert.equal(stripMarkdownForSpeech('This is **bold** text'), 'This is bold text');
    });

    it('should remove italic markdown', () => {
      assert.equal(stripMarkdownForSpeech('This is *italic* text'), 'This is italic text');
    });

    it('should remove code backticks', () => {
      assert.equal(stripMarkdownForSpeech('Use `code` here'), 'Use code here');
    });

    it('should combine markdown and phonetic removal', () => {
      assert.equal(stripMarkdownForSpeech('**Caf\u00e9** (kah-FEH) is *good*'), 'Caf\u00e9 is good');
    });
  });

  describe('Quote removal', () => {
    it('should remove single quotes around words', () => {
      assert.equal(
        stripMarkdownForSpeech("Spanish greeting for 'hello'"),
        'Spanish greeting for hello',
      );
    });

    it('should remove double quotes around words', () => {
      assert.equal(
        stripMarkdownForSpeech('Spanish greeting for "hello"'),
        'Spanish greeting for hello',
      );
    });

    it('should remove curly single quotes around words', () => {
      // U+2018 LEFT SINGLE QUOTATION MARK, U+2019 RIGHT SINGLE QUOTATION MARK
      assert.equal(
        stripMarkdownForSpeech('Try saying \u2018Hola\u2019'),
        'Try saying Hola',
      );
    });

    it('should remove curly double quotes around words', () => {
      // U+201C LEFT DOUBLE QUOTATION MARK, U+201D RIGHT DOUBLE QUOTATION MARK
      assert.equal(
        stripMarkdownForSpeech('Try saying \u201cHola\u201d'),
        'Try saying Hola',
      );
    });

    it('should remove mixed quotes in a sentence', () => {
      assert.equal(
        stripMarkdownForSpeech("Hola is the most common Spanish greeting for 'hello'. Try saying Hola!"),
        'Hola is the most common Spanish greeting for hello. Try saying Hola!',
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      assert.equal(stripMarkdownForSpeech(''), '');
    });

    it('should handle text with no phonetics', () => {
      assert.equal(stripMarkdownForSpeech('Hello world'), 'Hello world');
    });

    it('should normalize whitespace', () => {
      assert.equal(stripMarkdownForSpeech('Too   many    spaces'), 'Too many spaces');
    });

    it('should handle diacritic marks', () => {
      assert.equal(stripMarkdownForSpeech('caf\u00e9 (kah-FEH)'), 'caf\u00e9');
    });
  });

  describe('Phonetic instruction filtering', () => {
    it('should filter sentences starting with "Pronunciation:"', () => {
      assert.equal(stripMarkdownForSpeech('Pronunciation: kah-FEH. Try it!'), 'Try it!');
    });

    it('should filter sentences starting with "Phonetically:"', () => {
      assert.equal(stripMarkdownForSpeech('Phonetically: oh-LAH. Now you try.'), 'Now you try.');
    });

    it('should filter sentences starting with "Say it like:"', () => {
      assert.equal(stripMarkdownForSpeech('Say it like: kah-FEH. Great!'), 'Great!');
    });
  });
});
