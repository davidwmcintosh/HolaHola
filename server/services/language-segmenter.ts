/**
 * Language Segmenter Service
 * 
 * Detects code-switching in tutor responses and segments text by language.
 * Enables Cartesia to pronounce target-language words correctly by using
 * language-specific TTS chunks with the same context_id for prosody continuity.
 * 
 * Example: "Let's practice hermoso - it means beautiful"
 * → Segment 1: "Let's practice " (native: en)
 * → Segment 2: "hermoso" (target: es) 
 * → Segment 3: " - it means beautiful" (native: en)
 */

export interface LanguageSegment {
  text: string;
  language: 'native' | 'target';
  isQuoted: boolean;  // Whether this was detected via quotes/emphasis
}

export interface SegmentationResult {
  segments: LanguageSegment[];
  hasCodeSwitching: boolean;
  targetLanguageWords: string[];
}

/**
 * Patterns that indicate vocabulary/target-language words:
 * - Quoted words: "hermoso", 'hermoso', «hermoso»
 * - Emphasized patterns: *hermoso*
 */
const VOCABULARY_PATTERNS = [
  { pattern: /"([^"]+)"/g, type: 'double-quote' },
  { pattern: /«([^»]+)»/g, type: 'guillemet' },
  { pattern: /„([^"]+)"/g, type: 'german-quote' },
  { pattern: /「([^」]+)」/g, type: 'cjk-quote' },
  { pattern: /『([^』]+)』/g, type: 'cjk-quote-alt' },
  { pattern: /\*([^*]+)\*/g, type: 'emphasis' },
];

/**
 * Language-specific character patterns for detection
 */
const LANGUAGE_PATTERNS: Record<string, RegExp> = {
  spanish: /[áéíóúüñ¿¡]/i,
  french: /[àâäéèêëïîôùûüÿœæç]/i,
  german: /[äöüß]/i,
  italian: /[àèéìòù]/i,
  portuguese: /[áàâãéêíóôõúç]/i,
  japanese: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/,
  korean: /[\uAC00-\uD7AF\u1100-\u11FF]/,
  hebrew: /[\u0590-\u05FF]/,
  mandarin: /[\u4E00-\u9FFF]/,
  arabic: /[\u0600-\u06FF]/,
  russian: /[\u0400-\u04FF]/,
  hindi: /[\u0900-\u097F]/,
};

/**
 * Common English words to exclude from foreign word detection
 */
const COMMON_ENGLISH_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'of', 'to', 'in', 'on', 'at',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'can', 'this', 'that', 'these', 'those', 'it', 'its', "it's", 'i', 'you',
  'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your',
  'his', 'our', 'their', 'what', 'which', 'who', 'whom', 'when', 'where',
  'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 'just', 'also', 'now', 'here', 'there', 'then', 'if',
  'because', 'as', 'until', 'while', 'about', 'after', 'before', 'from',
  'up', 'down', 'out', 'off', 'over', 'under', 'again', 'further',
  'once', 'during', 'through', 'between', 'into', 'against', 'with',
  'let', 'lets', "let's", 'practice', 'say', 'repeat', 'try', 'means',
  'word', 'phrase', 'sentence', 'beautiful', 'good', 'great', 'nice',
  'yes', 'no', 'ok', 'okay', 'right', 'well', 'now', 'today', 'tomorrow',
]);

interface Detection {
  fullMatch: string;
  innerText: string;
  start: number;
  end: number;
  isQuoted: boolean;
}

/**
 * Detect potential target-language words based on quotes/emphasis patterns.
 */
function detectQuotedVocabulary(text: string): Detection[] {
  const detections: Detection[] = [];
  
  for (const { pattern } of VOCABULARY_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const fullMatch = match[0];
      const innerText = match[1];
      
      // Skip very short matches or empty
      if (!innerText || innerText.trim().length < 2) continue;
      
      // Skip if it looks like an English phrase (more than 3 words)
      const wordCount = innerText.trim().split(/\s+/).length;
      if (wordCount > 3) continue;
      
      detections.push({
        fullMatch,
        innerText: innerText.trim(),
        start: match.index,
        end: match.index + fullMatch.length,
        isQuoted: true,
      });
    }
  }
  
  // Sort by position and remove overlaps
  detections.sort((a, b) => a.start - b.start);
  const filtered: Detection[] = [];
  for (const det of detections) {
    const last = filtered[filtered.length - 1];
    if (!last || det.start >= last.end) {
      filtered.push(det);
    }
  }
  
  return filtered;
}

/**
 * Check if a word/phrase looks like it's in the target language.
 */
function looksLikeTargetLanguage(
  text: string,
  targetLanguage: string,
  nativeLanguage: string
): boolean {
  const lower = text.toLowerCase().trim();
  
  // Skip if it's a common English word (when native is English)
  if (nativeLanguage.toLowerCase() === 'english') {
    const words = lower.split(/\s+/);
    if (words.length === 1 && COMMON_ENGLISH_WORDS.has(words[0])) {
      return false;
    }
  }
  
  // Check for target language-specific characters
  const targetPattern = LANGUAGE_PATTERNS[targetLanguage.toLowerCase()];
  if (targetPattern && targetPattern.test(text)) {
    return true;
  }
  
  // For languages without special characters, use heuristics
  // If quoted and not obviously English, assume it's target language
  return true;
}

/**
 * Segment text into native and target language chunks.
 * 
 * @param text - The text to segment
 * @param nativeLanguage - The student's native language (tutor's explanation language)
 * @param targetLanguage - The student's target language (what they're learning)
 * @returns Segmentation result with language-tagged chunks
 */
export function segmentByLanguage(
  text: string,
  nativeLanguage: string,
  targetLanguage: string
): SegmentationResult {
  const segments: LanguageSegment[] = [];
  const targetLanguageWords: string[] = [];
  
  // Detect quoted vocabulary
  const detections = detectQuotedVocabulary(text);
  
  // Filter to only keep likely target language words
  const targetDetections = detections.filter(d => 
    looksLikeTargetLanguage(d.innerText, targetLanguage, nativeLanguage)
  );
  
  // If no target language detected, return single native segment
  if (targetDetections.length === 0) {
    return {
      segments: [{ text, language: 'native', isQuoted: false }],
      hasCodeSwitching: false,
      targetLanguageWords: []
    };
  }
  
  // Build segments around detected target-language words
  let currentPos = 0;
  
  for (const detection of targetDetections) {
    // Add native segment before this detection (including the opening quote)
    if (detection.start > currentPos) {
      const nativeText = text.slice(currentPos, detection.start);
      if (nativeText.length > 0) {
        segments.push({
          text: nativeText,
          language: 'native',
          isQuoted: false,
        });
      }
    }
    
    // Add target language segment (just the inner text, spoken in target language)
    segments.push({
      text: detection.innerText,
      language: 'target',
      isQuoted: true,
    });
    targetLanguageWords.push(detection.innerText);
    
    currentPos = detection.end;
  }
  
  // Add remaining native text
  if (currentPos < text.length) {
    const remainingText = text.slice(currentPos);
    if (remainingText.length > 0) {
      segments.push({
        text: remainingText,
        language: 'native',
        isQuoted: false,
      });
    }
  }
  
  return {
    segments,
    hasCodeSwitching: targetLanguageWords.length > 0,
    targetLanguageWords
  };
}

/**
 * Cartesia language code mapping
 */
const CARTESIA_LANGUAGE_CODES: Record<string, string> = {
  'english': 'en',
  'spanish': 'es',
  'french': 'fr',
  'german': 'de',
  'italian': 'it',
  'portuguese': 'pt',
  'japanese': 'ja',
  'korean': 'ko',
  'mandarin': 'zh',
  'mandarin chinese': 'zh',
  'chinese': 'zh',
  'hebrew': 'he',
  'arabic': 'ar',
  'russian': 'ru',
  'hindi': 'hi',
};

/**
 * Get Cartesia language code for a language name.
 */
export function getLanguageCode(language: string): string {
  return CARTESIA_LANGUAGE_CODES[language.toLowerCase()] || 'en';
}

/**
 * Convert segments to Cartesia-ready chunks with language codes.
 */
export function segmentsToCartesiaChunks(
  segments: LanguageSegment[],
  nativeLanguage: string,
  targetLanguage: string
): Array<{ text: string; languageCode: string; isQuoted: boolean }> {
  const nativeCode = getLanguageCode(nativeLanguage);
  const targetCode = getLanguageCode(targetLanguage);
  
  return segments.map(segment => ({
    text: segment.text,
    languageCode: segment.language === 'native' ? nativeCode : targetCode,
    isQuoted: segment.isQuoted,
  }));
}

/**
 * Debug helper: Log segmentation results
 */
export function logSegmentation(result: SegmentationResult, nativeLanguage: string, targetLanguage: string): void {
  if (!result.hasCodeSwitching) {
    console.log('[Language Segmenter] No code-switching detected');
    return;
  }
  
  console.log(`[Language Segmenter] Detected ${result.targetLanguageWords.length} target language words:`);
  console.log(`  Target words: ${result.targetLanguageWords.join(', ')}`);
  console.log(`  Segments:`);
  for (const seg of result.segments) {
    const lang = seg.language === 'native' ? nativeLanguage : targetLanguage;
    console.log(`    [${lang}] "${seg.text.substring(0, 40)}${seg.text.length > 40 ? '...' : ''}"`);
  }
}
