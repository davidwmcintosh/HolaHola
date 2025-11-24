/**
 * Smart Phrase Detection for Language Learning
 * 
 * Handles flexible word counting for multi-word expressions that function as single units.
 * Example: "Buenos dias" is two words but represents one greeting concept for beginners.
 */

/**
 * Common multi-word phrases that count as single conceptual units
 * Organized by language for easy maintenance
 */
const PHRASE_UNITS: Record<string, string[]> = {
  spanish: [
    // Greetings (time-based)
    'buenos dias',
    'buenas tardes',
    'buenas noches',
    // Common phrases
    'por favor',
    'de nada',
    'muchas gracias',
    'lo siento',
    'hasta luego',
    'hasta mañana',
    'me llamo',
    'mucho gusto',
    'no sé',
    'qué tal',
    'cómo estás',
    'cómo está',
    // Questions
    'cuántos años',
    'de dónde',
    'a dónde',
    'por qué',
  ],
  french: [
    // Greetings
    'bonjour monsieur',
    'bonjour madame',
    'bonne journée',
    'bonne soirée',
    'bonne nuit',
    // Common phrases
    's\'il vous plaît',
    's\'il te plaît',
    'de rien',
    'je m\'appelle',
    'comment allez-vous',
    'comment vas-tu',
    'ça va',
    'très bien',
    'pas mal',
    // Questions
    'd\'où viens-tu',
    'quel âge',
    'où est',
  ],
  german: [
    // Greetings
    'guten morgen',
    'guten tag',
    'guten abend',
    'gute nacht',
    // Common phrases
    'bitte schön',
    'danke schön',
    'vielen dank',
    'es tut mir leid',
    'auf wiedersehen',
    'bis später',
    'ich heiße',
    'wie geht\'s',
    'wie heißt du',
    // Questions
    'wie alt',
    'woher kommst',
    'wo ist',
  ],
  italian: [
    // Greetings
    'buon giorno',
    'buona sera',
    'buona notte',
    // Common phrases
    'per favore',
    'grazie mille',
    'di niente',
    'mi scusi',
    'mi chiamo',
    'come stai',
    'come sta',
    'molto bene',
    // Questions
    'quanti anni',
    'di dove',
    'dov\'è',
  ],
  portuguese: [
    // Greetings
    'bom dia',
    'boa tarde',
    'boa noite',
    // Common phrases
    'por favor',
    'muito obrigado',
    'muito obrigada',
    'de nada',
    'com licença',
    'me chamo',
    'tudo bem',
    'muito bem',
    // Questions
    'quantos anos',
    'de onde',
    'onde está',
  ],
  japanese: [
    // Note: Japanese phrases are romanized for consistency with text input
    // Common greetings and phrases
    'arigatou gozaimasu',
    'domo arigatou',
    'sumimasen',
    'gomen nasai',
    'oyasumi nasai',
    'ohayou gozaimasu',
    'konnichiwa',
    'konbanwa',
    'hajimemashite',
    'yoroshiku onegaishimasu',
  ],
  mandarin: [
    // Note: Mandarin phrases using pinyin
    'ni hao',
    'zai jian',
    'xie xie',
    'bu ke qi',
    'dui bu qi',
    'wan an',
    'zao shang hao',
    'ni hao ma',
    'wo jiao',
  ],
  korean: [
    // Common Korean phrases (romanized)
    'annyeong haseyo',
    'kamsahamnida',
    'joeseonghamnida',
    'annyeonghi gaseyo',
    'annyeonghi gyeseyo',
  ],
  english: [
    // Common multi-word expressions for reference
    'thank you',
    'good morning',
    'good afternoon',
    'good evening',
    'good night',
    'you\'re welcome',
    'excuse me',
    'i\'m sorry',
    'how are you',
    'nice to meet you',
  ],
};

/**
 * Normalize text for phrase matching (lowercase, trim, normalize unicode)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .replace(/['']/g, '\'') // Normalize apostrophes
    .replace(/\s+/g, ' '); // Normalize whitespace
}

/**
 * Check if text matches a phrase unit for the given language
 * Returns the phrase if matched, null otherwise
 */
export function matchesPhraseUnit(text: string, language: string): string | null {
  const normalizedText = normalizeText(text);
  const languagePhrases = PHRASE_UNITS[language.toLowerCase()] || [];
  
  for (const phrase of languagePhrases) {
    const normalizedPhrase = normalizeText(phrase);
    if (normalizedText === normalizedPhrase) {
      return phrase; // Return original phrase (not normalized)
    }
  }
  
  return null;
}

/**
 * Count conceptual units in text (accounting for phrase units)
 * 
 * Examples:
 * - "Hola" → 1 unit (single word)
 * - "Buenos dias" → 1 unit (phrase unit)
 * - "Hola buenos dias" → 2 units (word + phrase unit)
 * - "Tengo quince años" → 3 units (no phrase units)
 * 
 * @param text - The text to analyze
 * @param language - The language being learned
 * @returns Number of conceptual units
 */
export function countConceptualUnits(text: string, language: string): number {
  const normalizedText = normalizeText(text);
  
  // Check if entire text is a phrase unit
  const matchedPhrase = matchesPhraseUnit(normalizedText, language);
  if (matchedPhrase) {
    return 1;
  }
  
  // If not a single phrase unit, count words normally
  // This is intentionally simple - complex parsing would require NLP
  const words = normalizedText.split(/\s+/).filter(w => w.length > 0);
  return words.length;
}

/**
 * Validate if user followed "one unit rule" for beginners
 * Returns validation result with helpful feedback
 */
export interface UnitValidationResult {
  isValid: boolean;
  unitCount: number;
  message: string;
  matchedPhrase?: string; // If text matched a known phrase unit
}

export function validateOneUnitRule(
  text: string, 
  language: string,
  difficultyLevel: string = 'beginner'
): UnitValidationResult {
  // One unit rule only applies to beginners
  if (difficultyLevel !== 'beginner') {
    return {
      isValid: true,
      unitCount: countConceptualUnits(text, language),
      message: 'One unit rule not enforced for this difficulty level',
    };
  }
  
  const normalizedText = normalizeText(text);
  const matchedPhrase = matchesPhraseUnit(normalizedText, language);
  const unitCount = countConceptualUnits(normalizedText, language);
  
  if (unitCount === 1) {
    if (matchedPhrase) {
      return {
        isValid: true,
        unitCount: 1,
        message: `Perfect! "${text}" is a common phrase - that counts as one unit!`,
        matchedPhrase,
      };
    }
    return {
      isValid: true,
      unitCount: 1,
      message: `Good! You said exactly one word.`,
    };
  }
  
  // User said too many units
  const words = normalizedText.split(/\s+/).filter(w => w.length > 0);
  return {
    isValid: false,
    unitCount,
    message: `You said ${words.length} words (${unitCount} conceptual units). For beginners, try saying just ONE word or common phrase like "Buenos dias"!`,
  };
}

/**
 * Get all phrase units for a language (for UI/teaching purposes)
 */
export function getPhraseUnitsForLanguage(language: string): string[] {
  return PHRASE_UNITS[language.toLowerCase()] || [];
}

/**
 * Add custom phrase units at runtime (for admin/teacher customization)
 */
export function addCustomPhraseUnit(language: string, phrase: string): void {
  const lang = language.toLowerCase();
  if (!PHRASE_UNITS[lang]) {
    PHRASE_UNITS[lang] = [];
  }
  
  const normalized = normalizeText(phrase);
  const exists = PHRASE_UNITS[lang].some(p => normalizeText(p) === normalized);
  
  if (!exists) {
    PHRASE_UNITS[lang].push(phrase);
  }
}
