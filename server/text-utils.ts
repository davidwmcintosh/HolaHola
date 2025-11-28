/**
 * Utility functions for text processing
 */

import { franc } from 'franc-min';

// Supported target languages mapped to franc ISO 639-3 codes
const TARGET_LANGUAGE_CODES = new Set([
  'spa', // Spanish
  'fra', // French  
  'deu', // German
  'ita', // Italian
  'por', // Portuguese
  'jpn', // Japanese
  'kor', // Korean
  'cmn', // Mandarin Chinese
  'arb', // Arabic
]);

/**
 * Extracts target language text from a mixed-language response
 * The AI marks foreign language words with **bold** markers
 * 
 * For "target" subtitle mode, we only want to show the foreign language phrases
 * 
 * Example:
 *   Input: "Let's learn the word **Hola** which means hello."
 *   Output: "Hola"
 * 
 *   Input: "Say **Buenos días** to greet someone in the morning."
 *   Output: "Buenos días"
 * 
 * @param text - The mixed-language text with target language in **bold**
 * @returns Only the foreign language phrases (extracted from **markers**)
 */
export function extractTargetLanguageText(text: string): string {
  if (!text) return '';
  
  // Extract text between ** markers (foreign language phrases)
  const boldPattern = /\*\*([^*]+)\*\*/g;
  const matches: string[] = [];
  let match;
  
  while ((match = boldPattern.exec(text)) !== null) {
    matches.push(match[1].trim());
  }
  
  // If we found bold-marked phrases, return them joined
  if (matches.length > 0) {
    return matches.join(' ');
  }
  
  // Fallback 1: Extract only words containing foreign characters
  // Common patterns: Spanish ¡¿ñáéíóú, French àâçéèêëîïôùûü, etc.
  const foreignCharPattern = /[¡¿ñáéíóúàâçéèêëîïôùûüäöüß]/i;
  
  // First remove parenthetical content (English translations)
  let cleanedText = text;
  let prevText = '';
  while (cleanedText !== prevText) {
    prevText = cleanedText;
    cleanedText = cleanedText.replace(/\([^()]*\)/g, '');
  }
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  
  // Split into words and extract only those with foreign characters
  const words = cleanedText.split(/\s+/);
  const foreignWords = words.filter(word => foreignCharPattern.test(word));
  
  if (foreignWords.length > 0) {
    return foreignWords.join(' ');
  }
  
  // Fallback 2: Use language detection on the cleaned text
  // If franc detects a target language, return the whole cleaned text
  // This handles cases like "Practicar ahora mismo" without accents or bold
  if (cleanedText.length >= 5) {
    try {
      // Use lower minLength for better short-text detection
      const detectedLang = franc(cleanedText, { minLength: 3 });
      if (TARGET_LANGUAGE_CODES.has(detectedLang)) {
        // The text is in a target language, return it
        return cleanedText;
      }
    } catch (e) {
      // franc detection failed, continue to return empty
    }
  }
  
  // Fallback 3: Check for common short foreign words (unambiguous only)
  // This catches brief utterances like "Gracias", "Hola", "Ciao" when franc fails
  const COMMON_SHORT_FOREIGN_WORDS = [
    // Spanish
    'hola', 'gracias', 'adios', 'vamos', 'claro', 'bueno', 'vale', 'perfecto',
    // French
    'bonjour', 'merci', 'salut', 'parfait', 'voila', 
    // German
    'danke', 'bitte', 'genau', 'prima', 'toll',
    // Italian
    'ciao', 'prego', 'bravo', 'bene', 'perfetto',
    // Portuguese
    'obrigado', 'obrigada', 'tchau',
    // Japanese romanized
    'arigatou', 'sugoi', 'kawaii', 'ganbatte',
    // Korean romanized
    'annyeong', 'gomawo', 'daebak',
    // Mandarin romanized
    'xiexie', 'nihao', 'haode',
  ];
  
  const lowerCleaned = cleanedText.toLowerCase().trim();
  for (const word of COMMON_SHORT_FOREIGN_WORDS) {
    if (lowerCleaned === word || lowerCleaned.startsWith(word + ' ') || lowerCleaned.endsWith(' ' + word)) {
      return cleanedText;
    }
  }
  
  // No foreign language content detected
  return '';
}

/**
 * Determines if text contains significant target language content
 * Used to decide if target_language_text should be stored
 * 
 * @param text - The extracted target language text
 * @returns True if the text has meaningful content (not just punctuation/whitespace)
 */
export function hasSignificantTargetLanguageContent(text: string): boolean {
  if (!text) return false;
  
  // Check if there's at least one word (letters) in the text
  const hasWords = /[a-zA-ZÀ-ÿÑñ¡¿]/.test(text);
  
  // Must have at least 2 characters and actual words
  return text.length >= 2 && hasWords;
}
