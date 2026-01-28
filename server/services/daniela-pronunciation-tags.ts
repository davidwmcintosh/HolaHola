/**
 * Daniela's Pronunciation Tag System
 * 
 * Gives Daniela simple, powerful control over pronunciation without complex detection.
 * She can mark words with language tags like [es:casa] or [fr:bonjour] and the system
 * converts them to Cartesia inline phonemes.
 * 
 * Philosophy: "Give Daniela the simplest but powerful tools, and let her paint."
 */

import { MFA_IPA_PRONUNCIATIONS } from './tts-service';

/**
 * Language code to full language name mapping
 */
const LANGUAGE_CODE_MAP: Record<string, string> = {
  'es': 'spanish',
  'spanish': 'spanish',
  'fr': 'french',
  'french': 'french',
  'de': 'german',
  'german': 'german',
  'it': 'italian',
  'italian': 'italian',
  'pt': 'portuguese',
  'portuguese': 'portuguese',
  'ja': 'japanese',
  'japanese': 'japanese',
  'ko': 'korean',
  'korean': 'korean',
  'zh': 'mandarin',
  'mandarin': 'mandarin',
  'chinese': 'mandarin',
  'he': 'hebrew',
  'hebrew': 'hebrew',
};

/**
 * Result of processing pronunciation tags
 */
export interface PronunciationTagResult {
  processedText: string;
  tagsFound: number;
  conversions: Array<{
    original: string;
    language: string;
    word: string;
    phonemes: string | null;
  }>;
}

/**
 * Parse and convert Daniela's pronunciation tags to Cartesia phonemes.
 * 
 * Tag format: [lang:word] or [lang:multi word phrase]
 * Examples:
 *   - [es:casa] → <<k|a|s|a>>
 *   - [fr:bonjour] → <<b|ɔ̃|ʒ|u|ʁ>>
 *   - [es:buenos días] → <<b|w|e|n|o|s|ð|i|a|s>>
 * 
 * If no phoneme mapping exists, the word is kept as-is (untagged).
 */
export function processPronunciationTags(text: string): PronunciationTagResult {
  const conversions: PronunciationTagResult['conversions'] = [];
  
  // Match [lang:word] or [lang:multi word phrase]
  // lang can be 2-letter code (es, fr) or full name (spanish, french)
  const tagPattern = /\[([a-zA-Z]{2,10}):([^\]]+)\]/g;
  
  const processedText = text.replace(tagPattern, (match, langCode, word) => {
    const normalizedLang = LANGUAGE_CODE_MAP[langCode.toLowerCase()];
    
    if (!normalizedLang) {
      // Unknown language code - keep original without brackets
      conversions.push({
        original: match,
        language: langCode,
        word: word,
        phonemes: null,
      });
      console.log(`[Pronunciation Tags] Unknown language "${langCode}" for "${word}" - keeping as text`);
      return word;
    }
    
    const pronunciations = MFA_IPA_PRONUNCIATIONS[normalizedLang];
    if (!pronunciations) {
      // No pronunciation dictionary for this language
      conversions.push({
        original: match,
        language: normalizedLang,
        word: word,
        phonemes: null,
      });
      console.log(`[Pronunciation Tags] No dictionary for ${normalizedLang} - keeping "${word}" as text`);
      return word;
    }
    
    // Look up phonemes (try exact match first, then lowercase)
    const phonemes = pronunciations[word] || pronunciations[word.toLowerCase()];
    
    if (phonemes) {
      conversions.push({
        original: match,
        language: normalizedLang,
        word: word,
        phonemes: phonemes,
      });
      console.log(`[Pronunciation Tags] [${langCode}:${word}] → <<${phonemes}>>`);
      return `<<${phonemes}>>`;
    }
    
    // No phoneme mapping found - keep word without brackets
    conversions.push({
      original: match,
      language: normalizedLang,
      word: word,
      phonemes: null,
    });
    console.log(`[Pronunciation Tags] No phonemes for "${word}" in ${normalizedLang} - keeping as text`);
    return word;
  });
  
  return {
    processedText,
    tagsFound: conversions.length,
    conversions,
  };
}

/**
 * Check if text contains any pronunciation tags
 */
export function hasPronunciationTags(text: string): boolean {
  const tagPattern = /\[([a-zA-Z]{2,10}):([^\]]+)\]/;
  return tagPattern.test(text);
}

/**
 * Get list of supported language codes
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_CODE_MAP);
}

/**
 * Check if a language has phoneme support
 */
export function hasPhonemeSupport(langCode: string): boolean {
  const normalizedLang = LANGUAGE_CODE_MAP[langCode.toLowerCase()];
  return normalizedLang ? !!MFA_IPA_PRONUNCIATIONS[normalizedLang] : false;
}
