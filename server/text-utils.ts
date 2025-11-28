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

  // Extract text between ** markers (foreign language phrases)
  const boldPattern = /\*\*([^*]+)\*\*/g;
  const matches: string[] = [];
  let match;
  
  while ((match = boldPattern.exec(cleanedInput)) !== null) {
    const boldText = match[1].trim();
    // Try to expand single-word bold text to full phrase if applicable
    const expanded = expandToPhrase(boldText, cleanedInput);
    matches.push(expanded);
  }
  
  // If we found bold-marked phrases, return them (possibly expanded)
  if (matches.length > 0) {
    // Deduplicate in case the same phrase was expanded multiple times
    const unique = Array.from(new Set(matches));
    return unique.join(' ');
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
  
  // Comprehensive English word exclusion list
  // These words are common in language learning contexts but are NOT target language
  const ENGLISH_EXCLUSIONS = new Set([
    // Connectors and filler words
    'but', 'and', 'so', 'or', 'also', 'now', 'then', 'here', 'today', 'okay', 'ok',
    'well', 'great', 'good', 'nice', 'right', 'sure', 'yes', 'no', 'perfect', 'exactly',
    'correct', 'wonderful', 'excellent', 'fantastic', 'amazing', 'awesome',
    // Time-related words (commonly confused with Spanish tardes/noches)
    'morning', 'afternoon', 'evening', 'night', 'noon', 'sunset', 'sunrise', 'midnight',
    'early', 'late', 'until', 'from', 'about', 'around',
    // Learning/teaching context words
    'learn', 'say', 'try', 'practice', 'speak', 'word', 'phrase', 'expression',
    'means', 'meaning', 'used', 'using', 'give', 'another', 'very', 'useful',
    'pronounced', 'beautifully', 'start', 'lets', 'how', 'what', 'when', 'where',
    'important', 'remember', 'note', 'notice', 'keep', 'mind', // added: instruction words
    // Common verbs and pronouns
    'is', 'its', 'it', 'that', 'this', 'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on',
    'you', 'your', 'we', 'our', 'they', 'their', 'he', 'she', 'his', 'her',
    'can', 'could', 'will', 'would', 'should', 'was', 'were', 'are', 'be', 'been',
    // Greetings and praise (English versions)
    'hello', 'hi', 'hey', 'bye', 'goodbye', 'thank', 'thanks', 'please', 'welcome',
    'david', 'friend', 'sir', 'madam', // names/titles
  ]);
  
  // PRIORITY 1: Check for multi-word phrases FIRST (before accent filtering can split them)
  // Uses COMMON_PHRASES defined at the top of the function
  const foundPhrases: { phrase: string; index: number }[] = [];
  for (const { pattern, replacement } of COMMON_PHRASES) {
    pattern.lastIndex = 0; // Reset regex state
    let phraseMatch;
    while ((phraseMatch = pattern.exec(cleanedText)) !== null) {
      foundPhrases.push({ phrase: replacement, index: phraseMatch.index });
    }
  }
  
  if (foundPhrases.length > 0) {
    foundPhrases.sort((a, b) => a.index - b.index);
    return foundPhrases.map(p => p.phrase).join(' ');
  }
  
  // Clean up residual English words and punctuation
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')
    .replace(/^[,.\s!?]+|[,.\s]+$/g, '')  // Trim leading/trailing punctuation
    .trim();
  
  // Filter out English words from cleaned text
  const wordsAfterCleaning = cleanedText.split(/\s+/).filter(w => w.length > 0);
  const nonEnglishWords = wordsAfterCleaning.filter(word => {
    const normalized = word.toLowerCase().replace(/[^a-záéíóúàâçèêëîïôùûüäöüñß]/gi, '');
    return normalized.length > 0 && !ENGLISH_EXCLUSIONS.has(normalized);
  });
  
  // If all words were English, no target content
  if (nonEnglishWords.length === 0) {
    return '';
  }
  
  cleanedText = nonEnglishWords.join(' ');
  
  // PRIORITY 2: Extract words with foreign characters (accents, special chars)
  const words = cleanedText.split(/\s+/);
  const foreignWords = words.filter(word => foreignCharPattern.test(word));
  
  if (foreignWords.length > 0) {
    return foreignWords.join(' ');
  }
  
  // PRIORITY 3: Use language detection ONLY on text with non-ASCII characters
  // This prevents false positives on English text that franc misidentifies
  // If no foreign characters, skip language detection entirely
  const hasNonAscii = /[^\x00-\x7F]/.test(cleanedText);
  const hasForeignPunctuation = /[¡¿«»„""''‹›]/.test(cleanedText);
  
  if ((hasNonAscii || hasForeignPunctuation) && cleanedText.length >= 6 && nonEnglishWords.length >= 1) {
    try {
      const detectedLang = franc(cleanedText, { minLength: 3 });
      if (TARGET_LANGUAGE_CODES.has(detectedLang)) {
        return cleanedText;
      }
    } catch (e) {
      // franc detection failed, continue
    }
  }
  
  // PRIORITY 4: Check for single common foreign words
  const COMMON_SHORT_FOREIGN_WORDS = new Set([
    // Spanish (single words only - phrases handled above)
    'hola', 'gracias', 'adios', 'adiós', 'vamos', 'claro', 'bueno', 'vale', 'perfecto',
    'señor', 'señora', 'amigo', 'amiga', 'sí', 'por', 'favor',
    // French
    'bonjour', 'merci', 'salut', 'parfait', 'voila', 'voilà', 'madame', 'monsieur', 'oui',
    // German
    'danke', 'bitte', 'genau', 'prima', 'toll', 'ja', 'nein',
    // Italian
    'ciao', 'prego', 'bravo', 'bene', 'perfetto', 'buongiorno', 'buonasera',
    // Portuguese
    'obrigado', 'obrigada', 'tchau', 'olá', 'sim',
    // Japanese romanized
    'arigatou', 'sugoi', 'kawaii', 'ganbatte', 'konnichiwa', 'ohayou',
    // Korean romanized
    'annyeong', 'gomawo', 'daebak', 'annyeonghaseyo',
    // Mandarin romanized
    'xiexie', 'nihao', 'haode', 'zaijian',
  ]);
  
  // Match all words in the text that are in our foreign word set
  // Use word boundary regex to find words and preserve their order
  const wordPattern = new RegExp('\\b[\\p{L}]+\\b', 'gu');
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
  const targetText = rawText 
    ? extractTargetLanguageText(rawText) 
    : extractTargetLanguageText(displayText);
  
  if (!targetText) return result;
  
  result.targetText = targetText;
  
  // Split both texts into words for mapping
  const displayWords = displayText.split(/\s+/).filter(w => w.length > 0);
  const targetWords = targetText.split(/\s+/).filter(w => w.length > 0);
  
  if (displayWords.length === 0 || targetWords.length === 0) {
    return result;
  }
  
  // Build word mapping: for each target word, find its position in display text
  // Use a greedy matching approach that handles repeated words
  let targetWordIndex = 0;
  
  for (let displayIndex = 0; displayIndex < displayWords.length && targetWordIndex < targetWords.length; displayIndex++) {
    const displayWord = normalizeWordForComparison(displayWords[displayIndex]);
    const targetWord = normalizeWordForComparison(targetWords[targetWordIndex]);
    
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
    console.log(`[TargetExtraction] Mapping: ${mappingStr} (${displayWords.length} display -> ${targetWords.length} target)`);
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
