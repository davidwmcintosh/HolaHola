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
 * Detect unquoted non-Latin script character sequences.
 * These are unambiguous - they can't be English, so we can detect them without quotes.
 * 
 * This catches cases like: "Please try to say ありがとう when thanking someone"
 * where the Japanese word isn't quoted but should still be pronounced correctly.
 * 
 * Supports: Japanese, Korean, Chinese, Hebrew, Arabic, Russian, Hindi, Thai, Greek
 */
function detectUnquotedNonLatin(text: string): Detection[] {
  const detections: Detection[] = [];
  
  // Pattern for consecutive non-Latin characters
  // Each range represents a distinct writing system that's unambiguously not English
  const nonLatinPattern = new RegExp([
    '[\u3040-\u309F\u30A0-\u30FF]+',     // Japanese Hiragana + Katakana
    '[\u4E00-\u9FAF]+',                   // CJK Ideographs (Chinese/Japanese Kanji)
    '[\uAC00-\uD7AF]+',                   // Korean Hangul
    '[\u0590-\u05FF]+',                   // Hebrew
    '[\u0600-\u06FF]+',                   // Arabic
    '[\u0400-\u04FF]+',                   // Cyrillic (Russian, etc.)
    '[\u0900-\u097F]+',                   // Devanagari (Hindi)
    '[\u0E00-\u0E7F]+',                   // Thai
    '[\u0370-\u03FF]+',                   // Greek
  ].join('|'), 'g');
  
  let match;
  while ((match = nonLatinPattern.exec(text)) !== null) {
    const fullMatch = match[0];
    
    // Skip very short matches (single character might be punctuation)
    if (fullMatch.length < 1) continue;
    
    detections.push({
      fullMatch,
      innerText: fullMatch,
      start: match.index,
      end: match.index + fullMatch.length,
      isQuoted: false, // Not quoted, detected by character pattern
    });
  }
  
  return detections;
}

const LATIN_SCRIPT_LANGUAGES = new Set([
  'spanish', 'french', 'german', 'italian', 'portuguese',
]);

/**
 * Detect Latin-script target language phrases by diacritics and special punctuation.
 * 
 * For languages like Spanish that share the Latin alphabet with English,
 * quoted/emphasized detection isn't enough. This function detects:
 * - ¿...? Spanish question patterns
 * - ¡...! Spanish exclamation patterns
 * - Clusters of words containing target-language diacritics
 * 
 * Example: "let's warm up. ¿Cómo te sientes hoy?"
 * → Detects "¿Cómo te sientes hoy?" as a Spanish segment
 */
function detectLatinScriptTargetPhrases(
  text: string,
  targetLanguage: string
): Detection[] {
  const detections: Detection[] = [];
  const targetLower = targetLanguage.toLowerCase();
  
  if (!LATIN_SCRIPT_LANGUAGES.has(targetLower)) return detections;
  
  const targetPattern = LANGUAGE_PATTERNS[targetLower];
  if (!targetPattern) return detections;
  
  // PASS A: Detect ¿...? and ¡...! patterns (Spanish-specific)
  if (targetLower === 'spanish') {
    const spanishPhrasePattern = /[¿¡][^.!?\n]*?[?!]/g;
    let match;
    while ((match = spanishPhrasePattern.exec(text)) !== null) {
      const phrase = match[0].trim();
      if (phrase.length >= 3) {
        detections.push({
          fullMatch: phrase,
          innerText: phrase,
          start: match.index,
          end: match.index + match[0].length,
          isQuoted: false,
        });
      }
    }
  }
  
  // PASS B: Detect word clusters with target-language diacritics
  // Find words with diacritics, then expand to include surrounding non-English words
  const words = text.split(/(\s+)/);
  let pos = 0;
  let clusterStart = -1;
  let clusterEnd = -1;
  let clusterTextStart = -1;
  let clusterTextEnd = -1;
  let consecutiveNonDiacritic = 0;
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordStart = pos;
    const wordEnd = pos + word.length;
    pos = wordEnd;
    
    if (/^\s+$/.test(word)) continue;
    
    const hasDiacritics = targetPattern.test(word);
    const isCommonEnglish = COMMON_ENGLISH_WORDS.has(word.toLowerCase().replace(/[^a-zA-Z]/g, ''));
    
    if (hasDiacritics) {
      if (clusterStart === -1) {
        clusterStart = i;
        clusterTextStart = wordStart;
      }
      clusterEnd = i;
      clusterTextEnd = wordEnd;
      consecutiveNonDiacritic = 0;
    } else if (clusterStart !== -1) {
      consecutiveNonDiacritic++;
      if (!isCommonEnglish || consecutiveNonDiacritic > 2) {
        // End cluster - too many non-diacritic words or a clearly English word
        // But include short connector words (te, de, el, la, en, con, por, sin, mi, tu, su, un, una, los, las, nos)
        const cleanWord = word.toLowerCase().replace(/[^a-zA-ZáéíóúüñÀ-ÿ]/g, '');
        const isSpanishConnector = /^(te|de|el|la|en|con|por|sin|mi|tu|su|un|una|los|las|nos|que|al|del|es|se|le|lo|me|ya|si|no|y|o|a)$/.test(cleanWord);
        
        if (isSpanishConnector && consecutiveNonDiacritic <= 2) {
          clusterEnd = i;
          clusterTextEnd = wordEnd;
        } else {
          // Emit cluster
          const clusterText = text.slice(clusterTextStart, clusterTextEnd).trim();
          if (clusterText.length >= 3) {
            detections.push({
              fullMatch: clusterText,
              innerText: clusterText,
              start: clusterTextStart,
              end: clusterTextEnd,
              isQuoted: false,
            });
          }
          clusterStart = -1;
          clusterEnd = -1;
          consecutiveNonDiacritic = 0;
        }
      } else {
        // Short connector word within a diacritic cluster - tentatively include
        clusterEnd = i;
        clusterTextEnd = wordEnd;
      }
    }
  }
  
  // Emit final cluster if any
  if (clusterStart !== -1) {
    const clusterText = text.slice(clusterTextStart, clusterTextEnd).trim();
    if (clusterText.length >= 3) {
      detections.push({
        fullMatch: clusterText,
        innerText: clusterText,
        start: clusterTextStart,
        end: clusterTextEnd,
        isQuoted: false,
      });
    }
  }
  
  return detections;
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
  
  // Check for target language-specific characters (diacritics, non-Latin script)
  const targetPattern = LANGUAGE_PATTERNS[targetLanguage.toLowerCase()];
  if (targetPattern && targetPattern.test(text)) {
    return true;
  }
  
  // For Latin-script target languages (Spanish, French, etc.):
  // If the quoted word has NO target-language diacritics/markers, it's likely
  // just an English word in quotes - don't switch TTS language for it.
  // Words like "role", "plan", "time" in quotes should stay native TTS.
  if (LATIN_SCRIPT_LANGUAGES.has(targetLanguage.toLowerCase())) {
    return false;
  }
  
  // For non-Latin-script languages (Japanese, Korean, Chinese, Hebrew, etc.):
  // Quoted words without their script characters are likely native language
  return false;
}

/**
 * Extract bold-marked words from raw Gemini text.
 * These represent target language words that Gemini explicitly marked.
 * Used to provide hints to the segmenter when bold markers are stripped from display text.
 */
export function extractBoldMarkedWords(rawText: string): string[] {
  if (!rawText) return [];
  const boldPattern = /\*\*([^*]+)\*\*/g;
  const words: string[] = [];
  let match;
  while ((match = boldPattern.exec(rawText)) !== null) {
    const phrase = match[1].trim();
    if (phrase.length >= 2) {
      words.push(...phrase.split(/\s+/).filter(w => w.length > 0));
    }
  }
  return words;
}

/**
 * Detect known target words in cleaned text by exact word matching.
 * Used when bold markers from raw Gemini text indicate target language words
 * but the cleaned display text has markers stripped.
 */
function detectKnownTargetWords(text: string, knownWords: string[]): Detection[] {
  if (!knownWords || knownWords.length === 0) return [];
  
  const detections: Detection[] = [];
  const knownSet = new Set(knownWords.map(w => w.toLowerCase().replace(/[^a-zA-ZÀ-ÿñÑ¿¡]/g, '')));
  
  const wordPattern = /[¡¿]?[a-zA-ZÀ-ÿñÑ]+[?!]?/g;
  let match;
  while ((match = wordPattern.exec(text)) !== null) {
    const word = match[0];
    const normalized = word.toLowerCase().replace(/[^a-zA-ZÀ-ÿñÑ]/g, '');
    if (knownSet.has(normalized) && !COMMON_ENGLISH_WORDS.has(normalized)) {
      detections.push({
        fullMatch: word,
        innerText: word,
        start: match.index,
        end: match.index + word.length,
        isQuoted: false,
      });
    }
  }
  
  return detections;
}

/**
 * Segment text into native and target language chunks.
 * 
 * @param text - The text to segment
 * @param nativeLanguage - The student's native language (tutor's explanation language)
 * @param targetLanguage - The student's target language (what they're learning)
 * @param knownTargetWords - Optional list of words known to be target language (from bold markers in raw text)
 * @returns Segmentation result with language-tagged chunks
 */
export function segmentByLanguage(
  text: string,
  nativeLanguage: string,
  targetLanguage: string,
  knownTargetWords?: string[]
): SegmentationResult {
  const segments: LanguageSegment[] = [];
  const targetLanguageWords: string[] = [];
  
  // Detect quoted vocabulary (e.g., *Gracias*, "hermoso")
  const quotedDetections = detectQuotedVocabulary(text);
  
  // Detect unquoted non-Latin characters (Japanese, Korean, Chinese, Hebrew, Arabic, Russian, etc.)
  // These are unambiguous and don't need quotes
  const nonLatinDetections = detectUnquotedNonLatin(text);
  
  // Detect Latin-script target language phrases by diacritics (¿...?, diacritic clusters)
  // This catches Spanish/French/etc. phrases that aren't quoted
  const latinScriptDetections = detectLatinScriptTargetPhrases(text, targetLanguage);
  
  // Detect known target words from bold markers (stripped from display text but extracted from raw)
  const knownWordDetections = detectKnownTargetWords(text, knownTargetWords || []);
  
  // Merge all detection types
  const allDetections = [...quotedDetections, ...nonLatinDetections, ...latinScriptDetections, ...knownWordDetections];
  
  // Sort by position first
  allDetections.sort((a, b) => a.start - b.start);
  
  // Merge adjacent detections separated only by whitespace into single segments
  // This prevents "buenos" + " " + "días" from becoming 3 separate TTS calls
  for (let i = allDetections.length - 1; i > 0; i--) {
    const prev = allDetections[i - 1];
    const curr = allDetections[i];
    const between = text.slice(prev.end, curr.start);
    if (/^\s+$/.test(between)) {
      prev.fullMatch = text.slice(prev.start, curr.end);
      prev.innerText = text.slice(prev.start, curr.end);
      prev.end = curr.end;
      allDetections.splice(i, 1);
    }
  }
  const mergedDetections: Detection[] = [];
  for (const det of allDetections) {
    const last = mergedDetections[mergedDetections.length - 1];
    if (!last || det.start >= last.end) {
      mergedDetections.push(det);
    }
  }
  
  // Filter to only keep likely target language words
  // - Non-quoted detections (CJK, diacritic clusters, ¿...? patterns) are trusted directly
  // - Quoted detections go through looksLikeTargetLanguage check
  const targetDetections = mergedDetections.filter(d => 
    !d.isQuoted || looksLikeTargetLanguage(d.innerText, targetLanguage, nativeLanguage)
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
  // Full language names
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
  // Short codes (passthrough)
  'en': 'en',
  'es': 'es',
  'fr': 'fr',
  'de': 'de',
  'it': 'it',
  'pt': 'pt',
  'ja': 'ja',
  'ko': 'ko',
  'zh': 'zh',
  'he': 'he',
  'ar': 'ar',
  'ru': 'ru',
  'hi': 'hi',
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
