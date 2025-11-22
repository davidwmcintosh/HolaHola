import { describe, it, expect } from 'vitest';
import { stripMarkdownForSpeech } from '../routes';

/**
 * Unit tests for TTS text cleaning pipeline
 * Tests phonetic detection and clause removal logic
 */

describe('TTS Text Cleaning Pipeline', () => {
  describe('Pure phonetic removal', () => {
    it('should remove simple phonetic notation in parentheses', () => {
      expect(stripMarkdownForSpeech('café (kah-FEH)')).toBe('café');
    });

    it('should remove phonetic notation after equals sign', () => {
      expect(stripMarkdownForSpeech('Café = kah-FEH')).toBe('Café');
    });

    it('should remove multi-word phonetic notation after equals', () => {
      expect(stripMarkdownForSpeech('Café, por favor = kah-FEH, por fah-VOR')).toBe('Café, por favor');
    });

    it('should remove phonetic notation after semicolon', () => {
      expect(stripMarkdownForSpeech('Coffee, please; kah-FEH, por fah-VOR')).toBe('Coffee, please');
    });

    it('should remove all-caps phonetic notation', () => {
      expect(stripMarkdownForSpeech('Hola; OH-LAH')).toBe('Hola');
    });

    it('should handle multiple phonetic patterns', () => {
      expect(stripMarkdownForSpeech('Say hola (OH-LAH); kah-FEH = café')).toBe('Say hola');
    });
  });

  describe('Normal prose preservation', () => {
    it('should preserve locale codes', () => {
      expect(stripMarkdownForSpeech('Follow en-US standards')).toBe('Follow en-US standards');
      expect(stripMarkdownForSpeech('Use es-MX format = say the code')).toBe('Use es-MX format = say the code');
    });

    it('should preserve proper nouns', () => {
      expect(stripMarkdownForSpeech('Keep practicing; Pre-Columbian stories matter')).toBe('Keep practicing; Pre-Columbian stories matter');
    });

    it('should preserve normal hyphenated words', () => {
      expect(stripMarkdownForSpeech('Practice face-to-face conversations')).toBe('Practice face-to-face conversations');
      expect(stripMarkdownForSpeech('Use well-known methods; they work')).toBe('Use well-known methods; they work');
    });

    it('should preserve camelCase words', () => {
      expect(stripMarkdownForSpeech('Device = iPhone')).toBe('Device = iPhone');
      expect(stripMarkdownForSpeech('Try JavaScript; it works')).toBe('Try JavaScript; it works');
    });

    it('should preserve normal semicolon clauses', () => {
      expect(stripMarkdownForSpeech('Keep practicing; your pronunciation is improving')).toBe('Keep practicing; your pronunciation is improving');
    });

    it('should preserve normal equals clauses', () => {
      expect(stripMarkdownForSpeech('Follow standards = say the code aloud')).toBe('Follow standards = say the code aloud');
    });
  });

  describe('Mixed content handling', () => {
    it('should remove phonetic clauses from mixed sentences', () => {
      expect(stripMarkdownForSpeech('Say it slowly; kah-FEH once more')).toBe('Say it slowly once more');
    });

    it('should preserve prose when phonetic ratio is low', () => {
      expect(stripMarkdownForSpeech('Keep practicing; Pre-Columbian stories and kah-FEH matter')).toBe('Keep practicing; Pre-Columbian stories and kah-FEH matter');
    });
  });

  describe('Markdown removal', () => {
    it('should remove bold markdown', () => {
      expect(stripMarkdownForSpeech('This is **bold** text')).toBe('This is bold text');
    });

    it('should remove italic markdown', () => {
      expect(stripMarkdownForSpeech('This is *italic* text')).toBe('This is italic text');
    });

    it('should remove code backticks', () => {
      expect(stripMarkdownForSpeech('Use `code` here')).toBe('Use code here');
    });

    it('should combine markdown and phonetic removal', () => {
      expect(stripMarkdownForSpeech('**Café** (kah-FEH) is *good*')).toBe('Café is good');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string', () => {
      expect(stripMarkdownForSpeech('')).toBe('');
    });

    it('should handle text with no phonetics', () => {
      expect(stripMarkdownForSpeech('Hello world')).toBe('Hello world');
    });

    it('should normalize whitespace', () => {
      expect(stripMarkdownForSpeech('Too   many    spaces')).toBe('Too many spaces');
    });

    it('should handle diacritic marks', () => {
      expect(stripMarkdownForSpeech('café (kah-FEH)')).toBe('café');
    });
  });

  describe('Phonetic instruction filtering', () => {
    it('should filter sentences starting with "Pronunciation:"', () => {
      expect(stripMarkdownForSpeech('Pronunciation: kah-FEH. Try it!')).toBe('Try it!');
    });

    it('should filter sentences starting with "Phonetically:"', () => {
      expect(stripMarkdownForSpeech('Phonetically: oh-LAH. Now you try.')).toBe('Now you try.');
    });

    it('should filter sentences starting with "Say it like:"', () => {
      expect(stripMarkdownForSpeech('Say it like: kah-FEH. Great!')).toBe('Great!');
    });
  });
});
