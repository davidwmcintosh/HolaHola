/**
 * Utility functions for text processing
 */

/**
 * Extracts target language text from a mixed-language response
 * Removes content in parentheses (which contains native language translations)
 * 
 * Example:
 *   Input: "¡Hola! (Hello!) ¿Cómo estás? (How are you?)"
 *   Output: "¡Hola! ¿Cómo estás?"
 * 
 * @param text - The mixed-language text with translations in parentheses
 * @returns The text with parenthetical content removed
 */
export function extractTargetLanguageText(text: string): string {
  if (!text) return text;
  
  // Remove content in parentheses (English translations)
  // This regex handles nested parentheses correctly
  let result = text;
  let prevResult = '';
  
  // Keep removing parentheses until no more are found (handles nested cases)
  while (result !== prevResult) {
    prevResult = result;
    result = result.replace(/\([^()]*\)/g, '');
  }
  
  // Clean up extra whitespace and punctuation that may be left behind
  result = result
    .replace(/\s+/g, ' ')  // Multiple spaces to single space
    .replace(/\s+([.,!?;:])/g, '$1')  // Remove space before punctuation
    .replace(/([.,!?;:])\s*([.,!?;:])/g, '$1')  // Remove duplicate punctuation
    .trim();
  
  return result;
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
