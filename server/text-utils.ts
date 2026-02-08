/**
 * Utility functions for text processing
 * 
 * REFACTOR NOTES (December 2025):
 * Simplified from multi-pass defensive extraction to principled bold-only approach.
 * 
 * REMOVED FEATURES (may be reintroduced if problems arise):
 * - PASS 3: Common foreign word list (COMMON_SHORT_FOREIGN_WORDS) - caused ambiguity
 * - PASS 4: Multi-word phrase matching fallback - position tracking was buggy
 * - ENGLISH_FILTER blocklist - no longer needed with principled extraction
 * - Position-based segment tracking with overlap detection - overcomplicated
 * - expandToPhrase() helper - relied on COMMON_PHRASES patterns
 * 
 * KEPT FEATURES:
 * - PASS 1: Bold marker extraction (**word**) - primary method, trusts AI marking
 * - PASS 2: Foreign character detection (¡, ¿, ñ, á, é, etc.) - unambiguous backup
 * - Parenthetical content removal - prevents English translations leaking
 * - Emotion tag stripping - removes (friendly), (curious) etc.
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
 * APPROACH: Principled bold-only extraction
 * 1. Trust the AI to bold-mark foreign words (per system prompt)
 * 2. Use foreign character detection as unambiguous backup
 * 3. No "common word" guessing - if AI didn't mark it, don't include it
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
  
  // CRITICAL: Remove ALL parenthetical content early
  // This catches English translations like (Good morning.), (Hello!), (Perfect!)
  // Must happen BEFORE bold extraction to prevent English leaking into target text
  let prevInput = '';
  while (cleanedInput !== prevInput) {
    prevInput = cleanedInput;
    cleanedInput = cleanedInput.replace(/\([^()]*\)/g, ' ');
  }
  cleanedInput = cleanedInput.replace(/\s+/g, ' ').trim();
  
  // Strip TRULY dangling bold markers from sentence splits
  // Only strip opening ** at start if there's no matching ** later
  // Only strip closing ** at end if there's no matching ** earlier
  // This prevents destroying valid **word** pairs at text boundaries
  const countStars = (s: string) => (s.match(/\*\*/g) || []).length;
  const starCount = countStars(cleanedInput);
  
  if (starCount % 2 !== 0) {
    // Odd number of ** markers means there's a dangling one
    if (/^["']?\*\*\s*[^*]/.test(cleanedInput) && !cleanedInput.match(/^["']?\*\*[^*]+\*\*/)) {
      // Starts with ** but doesn't have a matching close nearby - strip it
      cleanedInput = cleanedInput.replace(/^["']?\*\*\s*/, '');
    }
    if (/[^*]\s*\*\*["']?$/.test(cleanedInput) && !cleanedInput.match(/\*\*[^*]+\*\*["']?$/)) {
      // Ends with ** but doesn't have a matching open nearby - strip it
      cleanedInput = cleanedInput.replace(/\s*\*\*["']?$/, '');
    }
  }
  cleanedInput = cleanedInput.trim();

  // Collect extracted words (simple Set-based deduplication, no position tracking)
  const extractedWords: string[] = [];
  const seenNormalized = new Set<string>();
  
  function addWord(word: string): void {
    const trimmed = word.trim();
    if (!trimmed) return;
    // Normalize for comparison: lowercase AND strip trailing/leading punctuation
    // This prevents "días" and "días?" from being treated as different words
    const normalized = trimmed.toLowerCase().replace(new RegExp('^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$', 'gu'), '');
    if (normalized && !seenNormalized.has(normalized)) {
      seenNormalized.add(normalized);
      extractedWords.push(trimmed);
    }
  }
  
  // PASS 1: Extract bold-marked phrases (**word**)
  // This is the PRIMARY method - we trust the AI to mark foreign words
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let match;
  while ((match = boldPattern.exec(cleanedInput)) !== null) {
    const boldText = match[1].trim();
    // Add all words from the bold phrase
    boldText.split(/\s+/).forEach(word => addWord(word));
  }
  
  // Create a plain text version for secondary detection (strip bold markers)
  const plainText = cleanedInput.replace(/\*\*/g, '');
  
  // PASS 2: Extract words with UNAMBIGUOUS foreign characters
  // Only characters that are definitely not English: ¡, ¿, ñ, accented vowels, etc.
  // This catches words the AI might have forgotten to bold-mark
  const foreignCharPattern = /[¡¿ñáéíóúàâçèêëîïôùûüäöüß]/i;
  const wordBoundaryPattern = /[¡¿!?]?[a-zA-ZÀ-ÿñÑ0-9]+[!?]?/g;
  let wordMatch;
  while ((wordMatch = wordBoundaryPattern.exec(plainText)) !== null) {
    const word = wordMatch[0];
    if (foreignCharPattern.test(word)) {
      addWord(word);
    }
  }
  
  // PASS 3: Extract complete ¿...? and ¡...! phrases (Spanish questions/exclamations)
  // These are unambiguous target language markers - ALL words inside are target language
  // e.g., "¿Cómo te sientes hoy?" → extracts "Cómo", "te", "sientes", "hoy"
  const invertedPhrasePattern = /[¿¡]([^.!?\n]*?)[?!]/g;
  let phraseMatch;
  while ((phraseMatch = invertedPhrasePattern.exec(plainText)) !== null) {
    const phraseInner = phraseMatch[1].trim();
    if (phraseInner.length >= 2) {
      phraseInner.split(/\s+/).forEach(word => addWord(word));
    }
  }
  
  // Return collected words in order found
  if (extractedWords.length > 0) {
    return extractedWords.join(' ');
  }
  
  // No foreign language content detected
  return '';
}

/**
 * Result from target language extraction with word mapping for karaoke highlighting
 */
export interface TargetLanguageExtractionResult {
  targetText: string;                    // The extracted target language text
  wordMapping: Map<number, number>;      // Maps fullTextWordIndex -> targetTextWordIndex
}

/**
 * Extracts target language text from display text with word position mapping
 * This enables karaoke highlighting in Target subtitle mode by knowing which
 * word indices from the full text correspond to words in the target text
 * 
 * SIMPLIFIED APPROACH:
 * - No English filter blocklist (was causing bugs with position tracking)
 * - Direct word matching between display and target text
 * - Trusts extractTargetLanguageText to return only foreign words
 * 
 * Example:
 *   displayText: "Let's learn the word Hola which means hello"
 *   Returns: {
 *     targetText: "Hola",
 *     wordMapping: Map { 4 => 0 }  // "Hola" is word 4 in full, word 0 in target
 *   }
 * 
 * @param displayText - The cleaned display text (no markdown, no emotion tags)
 * @param rawText - The raw text with **bold** markers (optional, for primary extraction)
 * @returns Target text and word index mapping
 */
export function extractTargetLanguageWithMapping(
  displayText: string,
  rawText?: string
): TargetLanguageExtractionResult {
  const result: TargetLanguageExtractionResult = {
    targetText: '',
    wordMapping: new Map<number, number>(),
  };
  
  if (!displayText) return result;
  
  // Get the target language text using existing extraction
  let targetText = rawText 
    ? extractTargetLanguageText(rawText) 
    : extractTargetLanguageText(displayText);
  
  if (!targetText) return result;
  
  // Clean any residual markers from target text
  // This catches edge cases where ** markers or quotes weren't fully stripped
  targetText = targetText
    .replace(/\*\*/g, '')           // Remove any remaining bold markers
    .replace(/^["'""'']+|["'""'']+$/g, '')  // Remove leading/trailing quotes
    .replace(/["'""'']\s*$/g, '')   // Remove trailing quote followed by space
    .replace(/^\s*["'""'']/g, '')   // Remove leading quote
    .trim();
  
  if (!targetText) return result;
  
  result.targetText = targetText;
  
  // Split both texts into words for mapping
  const displayWords = displayText.split(/\s+/).filter(w => w.length > 0);
  const targetWordsArray = targetText.split(/\s+/).filter(w => w.length > 0);
  
  if (displayWords.length === 0 || targetWordsArray.length === 0) {
    return result;
  }
  
  // Build word mapping: for each target word, find its position in display text
  // Use a greedy matching approach that handles repeated words
  let targetWordIndex = 0;
  
  for (let displayIndex = 0; displayIndex < displayWords.length && targetWordIndex < targetWordsArray.length; displayIndex++) {
    const displayWord = normalizeWordForComparison(displayWords[displayIndex]);
    const targetWord = normalizeWordForComparison(targetWordsArray[targetWordIndex]);
    
    if (displayWord === targetWord) {
      result.wordMapping.set(displayIndex, targetWordIndex);
      targetWordIndex++;
    }
  }
  
  // Log mapping for debugging
  if (result.wordMapping.size > 0) {
    const mappingStr = Array.from(result.wordMapping.entries())
      .map(([full, target]) => `${full}=>${target}`)
      .join(', ');
    console.log(`[TargetExtraction] Mapping: ${mappingStr} (${displayWords.length} display -> ${result.wordMapping.size} target)`);
  } else if (targetWordsArray.length > 0) {
    // Log when we have target words but no mapping (useful for debugging)
    console.log(`[TargetExtraction] WARNING: ${targetWordsArray.length} target words but no mapping found`);
    console.log(`[TargetExtraction] Target: "${targetText}"`);
    console.log(`[TargetExtraction] Display: "${displayText.substring(0, 100)}..."`);
  }
  
  return result;
}

/**
 * Normalize a word for comparison (lowercase, remove punctuation at edges)
 */
function normalizeWordForComparison(word: string): string {
  return word
    .toLowerCase()
    .replace(new RegExp('^[^\\p{L}\\p{N}]+|[^\\p{L}\\p{N}]+$', 'gu'), ''); // Remove leading/trailing non-letter/number
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

/**
 * Detects the predominant language of text for TTS synthesis.
 * This is critical for Japanese/Korean/Chinese voices speaking English text.
 * 
 * When a Japanese voice is configured but the text is mostly English,
 * we should tell Cartesia to use 'en' language code so pronunciation is correct.
 * The voice character is preserved, but pronunciation rules switch appropriately.
 * 
 * @param text - The text to analyze
 * @param targetLanguage - The session's target language (e.g., 'japanese')
 * @returns The language to use for TTS (e.g., 'english' or 'japanese')
 */
export function detectTextLanguageForTTS(text: string, targetLanguage: string): string {
  if (!text || text.length < 3) return targetLanguage;
  
  // For non-Latin script languages, use character-based detection
  const cjkPattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\uAC00-\uD7AF]/g;
  const hebrewPattern = /[\u0590-\u05FF]/g;
  const arabicPattern = /[\u0600-\u06FF]/g;
  const cyrillicPattern = /[\u0400-\u04FF]/g;
  const devanagariPattern = /[\u0900-\u097F]/g;
  const thaiPattern = /[\u0E00-\u0E7F]/g;
  const greekPattern = /[\u0370-\u03FF]/g;
  const latinPattern = /[a-zA-Z]/g;
  
  const cjkCount = (text.match(cjkPattern) || []).length;
  const hebrewCount = (text.match(hebrewPattern) || []).length;
  const arabicCount = (text.match(arabicPattern) || []).length;
  const cyrillicCount = (text.match(cyrillicPattern) || []).length;
  const devanagariCount = (text.match(devanagariPattern) || []).length;
  const thaiCount = (text.match(thaiPattern) || []).length;
  const greekCount = (text.match(greekPattern) || []).length;
  const latinCount = (text.match(latinPattern) || []).length;
  
  const nonLatinCount = cjkCount + hebrewCount + arabicCount + cyrillicCount + devanagariCount + thaiCount + greekCount;
  const totalChars = nonLatinCount + latinCount;
  
  if (totalChars === 0) return targetLanguage;
  
  const latinRatio = latinCount / totalChars;
  
  // If text has significant non-Latin characters, use target language
  if (nonLatinCount > 0 && latinRatio <= 0.7) {
    return targetLanguage;
  }
  
  // For Latin-script text, default to English TTS.
  // The word-by-word segmenter handles all code-switching detection upstream,
  // so this function only needs to pick a sensible default for the whole chunk.
  // English is the right choice: if the segmenter didn't detect target language
  // markers, the text looks like native language and should sound like it.
  return 'english';
}
