/**
 * Language Segmenter Service
 * 
 * Segments text by language for TTS code-switching. Uses two detection methods:
 * 1. knownTargetWords (from bold markers in raw Gemini text) - primary, reliable
 * 2. Non-Latin script detection (Japanese, Korean, Chinese, etc.) - unambiguous fallback
 * 
 * Example: "Let's practice hermoso - it means beautiful"
 *   knownTargetWords: ["hermoso"]
 * → Segment 1: "Let's practice " (native: en)
 * → Segment 2: "hermoso" (target: es)
 * → Segment 3: " - it means beautiful" (native: en)
 */

export interface LanguageSegment {
  text: string;
  language: 'native' | 'target';
  isQuoted: boolean;
}

export interface SegmentationResult {
  segments: LanguageSegment[];
  hasCodeSwitching: boolean;
  targetLanguageWords: string[];
}

interface Detection {
  fullMatch: string;
  innerText: string;
  start: number;
  end: number;
  isQuoted: boolean;
}

/**
 * Extract bold-marked words from raw Gemini text.
 * These represent target language words that Gemini explicitly marked with **bold**.
 * This is the single source of truth for which words are target language.
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
 * Detect unquoted non-Latin script character sequences.
 * These are unambiguous - Japanese, Korean, Chinese, Hebrew, Arabic, etc.
 * can't be English, so we detect them without needing bold markers.
 */
function detectUnquotedNonLatin(text: string): Detection[] {
  const detections: Detection[] = [];
  
  const nonLatinPattern = new RegExp([
    '[\u3040-\u309F\u30A0-\u30FF]+',     // Japanese Hiragana + Katakana
    '[\u4E00-\u9FAF]+',                   // CJK Ideographs
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
    if (fullMatch.length < 1) continue;
    
    detections.push({
      fullMatch,
      innerText: fullMatch,
      start: match.index,
      end: match.index + fullMatch.length,
      isQuoted: false,
    });
  }
  
  return detections;
}

/**
 * Common target-language interjections/exclamations that tutors naturally use.
 * These words are frequently spoken as standalone reactions (e.g., "Perfecto!" or "Très bien!")
 * but Gemini may not bold-mark them since they're not being "taught" as vocabulary.
 * Without this, TTS defaults to English pronunciation for these words.
 */
const COMMON_INTERJECTIONS: Record<string, string[]> = {
  spanish: [
    'perfecto', 'exacto', 'excelente', 'fantástico', 'fantastico', 'maravilloso',
    'increíble', 'increible', 'correcto', 'genial', 'estupendo', 'fenomenal',
    'bravo', 'claro', 'bueno', 'vale', 'oye', 'mira', 'vamos', 'ándale', 'andale',
    'órale', 'orale', 'dale', 'venga', 'verdad', 'sí', 'si',
  ],
  french: [
    'parfait', 'excellent', 'magnifique', 'formidable', 'superbe', 'génial',
    'bravo', 'voilà', 'voila', 'exactement', 'absolument', 'merveilleux',
    'bien', 'oui', 'allez', 'courage', 'chapeau',
  ],
  german: [
    'perfekt', 'ausgezeichnet', 'wunderbar', 'fantastisch', 'genau', 'richtig',
    'toll', 'prima', 'klasse', 'super', 'bravo', 'jawohl', 'stimmt',
  ],
  italian: [
    'perfetto', 'esatto', 'eccellente', 'fantastico', 'meraviglioso', 'magnifico',
    'bravo', 'brava', 'benissimo', 'bellissimo', 'giusto', 'certo', 'bene',
    'allora', 'ecco', 'avanti', 'coraggio', 'complimenti', 'davvero',
  ],
  portuguese: [
    'perfeito', 'exato', 'excelente', 'fantástico', 'fantastico', 'maravilhoso',
    'incrível', 'incrivel', 'correto', 'ótimo', 'otimo', 'legal', 'beleza',
    'parabéns', 'parabens', 'isso', 'certo', 'verdade',
  ],
  japanese: [],
  korean: [],
  'mandarin chinese': [],
  mandarin: [],
  chinese: [],
  english: [],
  hebrew: [],
};

/**
 * Detect common target-language interjections in text.
 * Only matches words that appear at the very start of a sentence or as standalone words,
 * to avoid false positives in English contexts.
 */
function detectInterjections(text: string, targetLanguage: string): Detection[] {
  const langKey = targetLanguage.toLowerCase();
  const interjections = COMMON_INTERJECTIONS[langKey];
  if (!interjections || interjections.length === 0) return [];
  
  const interjectionSet = new Set(interjections);
  const detections: Detection[] = [];
  
  const sentenceStartPattern = /(?:^|[.!?]\s+)([¡¿]?[a-zA-ZÀ-ÿñÑáéíóúÁÉÍÓÚ]+[.!?,]?)/g;
  let match;
  while ((match = sentenceStartPattern.exec(text)) !== null) {
    const word = match[1];
    const normalized = word.toLowerCase().replace(/[^a-zA-ZÀ-ÿñÑáéíóúÁÉÍÓÚ]/g, '');
    if (normalized.length >= 2 && interjectionSet.has(normalized)) {
      const wordStart = match.index + match[0].indexOf(word);
      detections.push({
        fullMatch: word.replace(/[.,]$/, ''),
        innerText: word.replace(/[.,]$/, ''),
        start: wordStart,
        end: wordStart + word.replace(/[.,]$/, '').length,
        isQuoted: false,
      });
    }
  }
  
  return detections;
}

/**
 * Detect known target words in text by exact word matching.
 * Used when bold markers from raw Gemini text indicate target language words
 * but the cleaned display text has markers stripped.
 */
function detectKnownTargetWords(text: string, knownWords: string[]): Detection[] {
  if (!knownWords || knownWords.length === 0) return [];
  
  const detections: Detection[] = [];
  const knownSet = new Set(knownWords.map(w => w.toLowerCase().replace(/[^a-zA-ZÀ-ÿñÑ¿¡]/g, '')));
  
  console.log(`[TTS-LANG-DIAG] detectKnownTargetWords: looking for ${knownWords.length} words in text (${text.length} chars)`);
  console.log(`[TTS-LANG-DIAG] Known set: ${Array.from(knownSet).join(', ')}`);
  
  const wordPattern = /[¡¿]?[a-zA-ZÀ-ÿñÑ]+[?!]?/g;
  let match;
  while ((match = wordPattern.exec(text)) !== null) {
    const word = match[0];
    const normalized = word.toLowerCase().replace(/[^a-zA-ZÀ-ÿñÑ]/g, '');
    if (knownSet.has(normalized)) {
      detections.push({
        fullMatch: word,
        innerText: word,
        start: match.index,
        end: match.index + word.length,
        isQuoted: false,
      });
    }
  }
  
  console.log(`[TTS-LANG-DIAG] detectKnownTargetWords: found ${detections.length} matches: ${detections.map(d => d.innerText).join(', ')}`);
  
  return detections;
}

/**
 * Segment text into native and target language chunks.
 * 
 * @param text - The text to segment
 * @param nativeLanguage - The student's native language
 * @param targetLanguage - The student's target language
 * @param knownTargetWords - Words known to be target language (from bold markers in raw text)
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
  
  const nonLatinDetections = detectUnquotedNonLatin(text);
  const knownWordDetections = detectKnownTargetWords(text, knownTargetWords || []);
  const interjectionDetections = detectInterjections(text, targetLanguage);
  
  const allDetections = [...nonLatinDetections, ...knownWordDetections, ...interjectionDetections];
  allDetections.sort((a, b) => a.start - b.start);
  
  // Merge adjacent detections separated only by whitespace
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
  
  // Remove overlaps
  const mergedDetections: Detection[] = [];
  for (const det of allDetections) {
    const last = mergedDetections[mergedDetections.length - 1];
    if (!last || det.start >= last.end) {
      mergedDetections.push(det);
    }
  }
  
  if (mergedDetections.length === 0) {
    return {
      segments: [{ text, language: 'native', isQuoted: false }],
      hasCodeSwitching: false,
      targetLanguageWords: []
    };
  }
  
  let currentPos = 0;
  
  for (const detection of mergedDetections) {
    if (detection.start > currentPos) {
      const nativeText = text.slice(currentPos, detection.start);
      if (nativeText.length > 0) {
        segments.push({ text: nativeText, language: 'native', isQuoted: false });
      }
    }
    
    segments.push({ text: detection.innerText, language: 'target', isQuoted: true });
    targetLanguageWords.push(detection.innerText);
    
    currentPos = detection.end;
  }
  
  if (currentPos < text.length) {
    const remainingText = text.slice(currentPos);
    if (remainingText.length > 0) {
      segments.push({ text: remainingText, language: 'native', isQuoted: false });
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
