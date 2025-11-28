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
  
  // First, strip any emotion tags like (friendly), (encouraging) at start of text
  // These should not interfere with foreign language extraction
  let cleanedInput = text
    .replace(/^\s*\([^)]+\)\s*/g, '')
    .replace(/\s*\([^)]+\)\s*$/g, '')
    .replace(/\s*\((?:friendly|curious|excited|calm|warm|energetic|professional|happy|sad|surprised|thoughtful|encouraging|patient)\)\s*/gi, ' ')
    .trim();
  
  // Extract text between ** markers (foreign language phrases)
  const boldPattern = /\*\*([^*]+)\*\*/g;
  const matches: string[] = [];
  let match;
  
  while ((match = boldPattern.exec(cleanedInput)) !== null) {
    matches.push(match[1].trim());
  }
  
  // If we found bold-marked phrases, return them joined
  if (matches.length > 0) {
    return matches.join(' ');
  }
  
  // Remove common English scaffolding phrases that introduce foreign words
  // These patterns remove ONLY the English phrase, preserving trailing foreign words
  // Use non-greedy matches and word boundaries to avoid consuming too much
  const scaffoldingPatterns = [
    /\bin\s+(?:spanish|french|german|italian|portuguese|japanese|korean|chinese|mandarin|arabic)\s+(?:it's|is|we say|you say|that's|this is)\s+/gi,
    /\bthe\s+(?:word|phrase|expression)\s+(?:is|for)\s+/gi,
    /,?\s*which\s+means\s+["']?[^"']+["']?/gi,  // "which means 'hello'" - remove the English translation
    /,?\s*that\s+means\s+["']?[^"']+["']?/gi,
    /,?\s*meaning\s+["']?[^"']+["']?/gi,
    /,?\s*in\s+english,?\s+(?:it's|that's|this is)\s+["']?[^"']+["']?/gi,  // "in English it's 'hello'" - remove the English part
    /\blet'?s\s+(?:learn|practice|say|try)\s+/gi,
    /\byou\s+(?:can\s+)?say\s+/gi,
    /\bwe\s+(?:can\s+)?say\s+/gi,
    /\bto\s+say\s+/gi,
  ];
  
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
  
  // Remove English scaffolding patterns
  for (const pattern of scaffoldingPatterns) {
    cleanedText = cleanedText.replace(pattern, ' ');
  }
  
  // Clean up residual English connector words and punctuation
  // Remove: but, and, so, or, also, now, then, here, today
  cleanedText = cleanedText
    .replace(/\b(but|and|so|or|also|now|then|here|today|okay|well|great|good|nice|right|sure|yes|perfect|exactly|correct|wonderful|excellent|fantastic)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s!?]+|[,.\s]+$/g, '')  // Trim leading/trailing punctuation
    .trim();
  
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
  
  // Fallback 3: Check for common short foreign words ANYWHERE in the text
  // This catches words like "Hola" even when embedded in English sentences
  // IMPORTANT: Preserve word order for subtitle accuracy
  const COMMON_SHORT_FOREIGN_WORDS = new Set([
    // Spanish
    'hola', 'gracias', 'adios', 'adiós', 'vamos', 'claro', 'bueno', 'vale', 'perfecto',
    'buenos', 'días', 'noches', 'tardes', 'señor', 'señora', 'amigo', 'amiga',
    // French
    'bonjour', 'merci', 'salut', 'parfait', 'voila', 'voilà', 'madame', 'monsieur',
    // German
    'danke', 'bitte', 'genau', 'prima', 'toll', 'guten', 'morgen', 'tag', 'abend',
    // Italian
    'ciao', 'prego', 'bravo', 'bene', 'perfetto', 'buongiorno', 'buonasera',
    // Portuguese
    'obrigado', 'obrigada', 'tchau', 'olá',
    // Japanese romanized
    'arigatou', 'sugoi', 'kawaii', 'ganbatte', 'konnichiwa', 'ohayou',
    // Korean romanized
    'annyeong', 'gomawo', 'daebak', 'annyeonghaseyo',
    // Mandarin romanized
    'xiexie', 'nihao', 'haode', 'zaijian',
  ]);
  
  // Match all words in the text that are in our foreign word set
  // Use word boundary regex to find words and preserve their order
  const wordPattern = /\b[\p{L}]+\b/gu;
  const matchedWords: { word: string; index: number }[] = [];
  
  let wordMatch;
  while ((wordMatch = wordPattern.exec(cleanedInput)) !== null) {
    const word = wordMatch[0];
    if (COMMON_SHORT_FOREIGN_WORDS.has(word.toLowerCase())) {
      matchedWords.push({ word, index: wordMatch.index });
    }
  }
  
  // Sort by occurrence order and return
  if (matchedWords.length > 0) {
    matchedWords.sort((a, b) => a.index - b.index);
    return matchedWords.map(m => m.word).join(' ');
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
