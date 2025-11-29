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
  
  // CRITICAL: Remove ALL parenthetical content early
  // This catches English translations like (Good morning.), (Hello!), (Perfect!)
  // Must happen BEFORE bold extraction to prevent English leaking into target text
  let prevInput = '';
  while (cleanedInput !== prevInput) {
    prevInput = cleanedInput;
    cleanedInput = cleanedInput.replace(/\([^()]*\)/g, ' ');
  }
  cleanedInput = cleanedInput.replace(/\s+/g, ' ').trim();
  
  // Also strip dangling bold markers from sentence splits (e.g., "** at start or ** at end)
  // These occur when Gemini's bold markers span across sentence boundaries
  cleanedInput = cleanedInput
    .replace(/^["']?\*\*\s*/g, '')  // Remove dangling "** or '** at start
    .replace(/\s*\*\*["']?$/g, '')  // Remove dangling **" or **' at end
    .trim();
  
  // Common multi-word foreign phrases - defined early for phrase expansion
  // These must be matched as complete units, not split by accent filtering
  const COMMON_PHRASES = [
    // Spanish greetings (must match as complete phrases)
    { pattern: /buenos\s+d[ií]as/gi, replacement: 'Buenos días' },
    { pattern: /buenas\s+tardes/gi, replacement: 'Buenas tardes' },
    { pattern: /buenas\s+noches/gi, replacement: 'Buenas noches' },
    { pattern: /muy\s+bien/gi, replacement: 'Muy bien' },
    { pattern: /muchas\s+gracias/gi, replacement: 'Muchas gracias' },
    { pattern: /hasta\s+luego/gi, replacement: 'Hasta luego' },
    { pattern: /hasta\s+ma[ñn]ana/gi, replacement: 'Hasta mañana' },
    { pattern: /por\s+favor/gi, replacement: 'Por favor' },
    { pattern: /de\s+nada/gi, replacement: 'De nada' },
    { pattern: /lo\s+siento/gi, replacement: 'Lo siento' },
    // French
    { pattern: /bonne\s+nuit/gi, replacement: 'Bonne nuit' },
    { pattern: /bonne\s+journ[ée]e/gi, replacement: 'Bonne journée' },
    { pattern: /merci\s+beaucoup/gi, replacement: 'Merci beaucoup' },
    { pattern: /s'?il\s+vous\s+pla[iî]t/gi, replacement: "S'il vous plaît" },
    // German
    { pattern: /guten\s+morgen/gi, replacement: 'Guten Morgen' },
    { pattern: /guten\s+tag/gi, replacement: 'Guten Tag' },
    { pattern: /guten\s+abend/gi, replacement: 'Guten Abend' },
    { pattern: /gute\s+nacht/gi, replacement: 'Gute Nacht' },
    // Italian
    { pattern: /buona\s+sera/gi, replacement: 'Buona sera' },
    { pattern: /buona\s+notte/gi, replacement: 'Buona notte' },
    { pattern: /buon\s+giorno/gi, replacement: 'Buon giorno' },
  ];

  // Helper function to expand a word to its full phrase if it's part of one
  function expandToPhrase(word: string, fullText: string): string {
    const wordLower = word.toLowerCase();
    for (const { pattern, replacement } of COMMON_PHRASES) {
      pattern.lastIndex = 0;
      if (pattern.test(fullText)) {
        // Check if this word is part of this phrase
        const phraseWords = replacement.toLowerCase().split(/\s+/);
        if (phraseWords.includes(wordLower)) {
          return replacement;
        }
      }
    }
    return word;
  }

  // UNIFIED COLLECTION: Gather ALL foreign language segments with positions
  // This prevents early returns from missing non-bold Spanish words
  interface Segment { text: string; startIndex: number; endIndex: number; }
  const segments: Segment[] = [];
  const coveredRanges: Array<[number, number]> = [];
  
  // Helper to check if a range overlaps with already covered ranges
  function isOverlapping(start: number, end: number): boolean {
    return coveredRanges.some(([s, e]) => !(end <= s || start >= e));
  }
  
  // Helper to add segment if not overlapping
  function addSegment(text: string, start: number, end: number): void {
    if (!isOverlapping(start, end)) {
      segments.push({ text, startIndex: start, endIndex: end });
      coveredRanges.push([start, end]);
    }
  }
  
  // PASS 1: Extract bold-marked phrases (**word**)
  const boldPattern = /\*\*([^*]+)\*\*/g;
  let match;
  while ((match = boldPattern.exec(cleanedInput)) !== null) {
    const boldText = match[1].trim();
    const expanded = expandToPhrase(boldText, cleanedInput);
    addSegment(expanded, match.index, match.index + match[0].length);
  }
  
  // Create a plain text version for subsequent detection (strip bold markers)
  const plainText = cleanedInput.replace(/\*\*/g, '');
  
  // PASS 2: Extract words with foreign characters (accents, ñ, ¡¿, etc.)
  const foreignCharPattern = /[¡¿ñáéíóúàâçéèêëîïôùûüäöüß]/i;
  // Using explicit character classes instead of Unicode properties for ES5 compatibility
  const wordBoundaryPattern = /[a-zA-ZÀ-ÿñÑ¡¿0-9]+/g;
  let wordMatch;
  while ((wordMatch = wordBoundaryPattern.exec(plainText)) !== null) {
    const word = wordMatch[0];
    if (foreignCharPattern.test(word)) {
      // Find approximate position in original text
      const approxStart = wordMatch.index;
      addSegment(word, approxStart, approxStart + word.length);
    }
  }
  
  // PASS 3: Check for common foreign words that don't have accent marks
  const COMMON_SHORT_FOREIGN_WORDS = new Set([
    // Spanish exclamatory/praise words
    'maravilloso', 'excelente', 'estupendo', 'genial', 'fenomenal', 
    'magnifico', 'brillante', 'fabuloso', 'sensacional', 'impresionante',
    // Spanish greetings and basics
    'hola', 'gracias', 'adios', 'vamos', 'claro', 'bueno', 'vale', 'perfecto',
    'amigo', 'amiga', 'por', 'favor',
    // French
    'bonjour', 'merci', 'salut', 'parfait', 'voila', 'madame', 'monsieur', 'oui',
    'magnifique', 'formidable', 'superbe',
    // German  
    'danke', 'bitte', 'genau', 'prima', 'toll', 'ja', 'nein', 'wunderbar',
    // Italian
    'ciao', 'prego', 'bravo', 'bene', 'perfetto', 'buongiorno', 'buonasera', 'bellissimo',
    // Portuguese
    'obrigado', 'obrigada', 'tchau', 'sim', 'maravilhoso',
  ]);
  
  wordBoundaryPattern.lastIndex = 0;
  while ((wordMatch = wordBoundaryPattern.exec(plainText)) !== null) {
    const word = wordMatch[0];
    const normalized = word.toLowerCase().replace(/[^a-záéíóúàâçèêëîïôùûüäöüñß]/gi, '');
    if (COMMON_SHORT_FOREIGN_WORDS.has(normalized)) {
      const approxStart = wordMatch.index;
      addSegment(word, approxStart, approxStart + word.length);
    }
  }
  
  // PASS 4: Check for multi-word phrases
  for (const { pattern, replacement } of COMMON_PHRASES) {
    pattern.lastIndex = 0;
    let phraseMatch;
    while ((phraseMatch = pattern.exec(plainText)) !== null) {
      addSegment(replacement, phraseMatch.index, phraseMatch.index + phraseMatch[0].length);
    }
  }
  
  // Sort segments by position and deduplicate
  if (segments.length > 0) {
    segments.sort((a, b) => a.startIndex - b.startIndex);
    // Return unique segment texts in order
    const seen = new Set<string>();
    const result = segments
      .filter(s => {
        const lower = s.text.toLowerCase();
        if (seen.has(lower)) return false;
        seen.add(lower);
        return true;
      })
      .map(s => s.text);
    
    if (result.length > 0) {
      return result.join(' ');
    }
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
  
  // Filter out common English words that may have leaked through
  const ENGLISH_FILTER = new Set([
    'respond', 'with', 'that', 'was', 'great', 'you', 'got', 'the', 'and',
    'or', 'a', 'an', 'to', 'for', 'is', 'it', 'in', 'on', 'of', 'can', 'try',
    'saying', 'say', 'said', 'lets', 'now', 'your', 'i', 'we', 'they', 'this', 'how',
    'excellent', 'perfect', 'wonderful', 'amazing', 'fantastic', 'beautiful',
    'david', 'just', 'right', 'good', 'job', 'nice', 'work', 'well', 'done',
    'remember', 'means', 'mean', 'english', 'spanish', 'french', 'german',
    'italian', 'portuguese', 'japanese', 'korean', 'chinese', 'arabic'
  ]);
  
  const targetWords = targetText.split(/\s+/).filter(w => w.length > 0);
  const filteredWords = targetWords.filter(word => {
    // Strip punctuation to get the core word for checking
    const stripped = word.replace(/^[^a-zA-ZÀ-ÿ]+|[^a-zA-ZÀ-ÿ]+$/g, '');
    const normalized = stripped.toLowerCase();
    
    // Check for actual foreign characters (not just punctuation)
    // Foreign chars: accented letters, ñ, inverted punctuation ¡¿, etc.
    const hasForeignChars = /[À-ÿñ¡¿]/.test(stripped);
    
    // Keep if it has genuine foreign characters OR isn't in English filter
    return hasForeignChars || !ENGLISH_FILTER.has(normalized);
  });
  
  targetText = filteredWords.join(' ').trim();
  
  if (!targetText) return result;
  
  result.targetText = targetText;
  
  // Split both texts into words for mapping
  const displayWords = displayText.split(/\s+/).filter(w => w.length > 0);
  const targetWordsForMapping = targetText.split(/\s+/).filter(w => w.length > 0);
  
  if (displayWords.length === 0 || targetWordsForMapping.length === 0) {
    return result;
  }
  
  // Build word mapping: for each target word, find its position in display text
  // Use a greedy matching approach that handles repeated words
  let targetWordIndex = 0;
  
  for (let displayIndex = 0; displayIndex < displayWords.length && targetWordIndex < targetWordsForMapping.length; displayIndex++) {
    const displayWord = normalizeWordForComparison(displayWords[displayIndex]);
    const targetWord = normalizeWordForComparison(targetWordsForMapping[targetWordIndex]);
    
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
    console.log(`[TargetExtraction] Mapping: ${mappingStr} (${displayWords.length} display -> ${targetWordsForMapping.length} target)`);
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
