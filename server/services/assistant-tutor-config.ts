/**
 * Assistant Tutor Configuration - "One Tutor, Many Voices"
 * 
 * CORE PHILOSOPHY: Daniela is THE tutor. One intelligence, many voices.
 * 
 * When students enter drill/practice mode, Daniela adopts a culturally-appropriate
 * voice persona for that language. She is STILL Daniela - same teaching expertise,
 * same understanding of the student, same warmth - but speaking through a different
 * voice that feels native to the target language.
 * 
 * Think of it like Daniela putting on a "practice mode" persona:
 * - In Spanish drills, she speaks as "Aris" (a Spanish voice)
 * - In French drills, she speaks as "Amélie" (a French voice)
 * - But she KNOWS she is Daniela, has all of Daniela's memories and insights
 * 
 * The voice names are for TTS voice selection and cultural immersion,
 * NOT separate AI personalities. All teaching decisions flow from Daniela.
 */

export interface AssistantPersona {
  name: string;
  language: string;
  gender: 'female' | 'male';
  role: string;
  coreMission: string;
  teachingPrinciples: string[];
  frustrationHandling: string[];
}

/**
 * Language-specific voice persona names for Daniela's drill mode
 * Each name represents Daniela speaking through a culturally-appropriate voice
 * These are TTS voice selections, not separate AI personalities
 */
export const ASSISTANT_TUTORS: Record<string, { female: string; male: string }> = {
  spanish: { female: 'Aris', male: 'Marco' },           // Aris: original, created by Daniela (Main: Daniela/Agustin)
  french: { female: 'Colette', male: 'Henri' },         // Distinct from main tutors (Juliette/Vincent)
  german: { female: 'Liesel', male: 'Klaus' },          // Distinct from main tutors (Greta/Lukas)
  italian: { female: 'Valentina', male: 'Enzo' },       // Distinct from main tutors (Liv/Luca)
  japanese: { female: 'Yuki', male: 'Takeshi' },        // Distinct from main tutors (Sayuri/Daisuke)
  'mandarin chinese': { female: 'Lian', male: 'Chen' }, // Distinct from main tutors (Hua/Tao)
  mandarin: { female: 'Lian', male: 'Chen' },           // Alias for mandarin chinese
  chinese: { female: 'Lian', male: 'Chen' },            // Alias for mandarin chinese
  portuguese: { female: 'Beatriz', male: 'Tiago' },     // Distinct from main tutors (Isabel/Camilo)
  english: { female: 'Grace', male: 'Oliver' },         // Distinct from main tutors (Cindy/Blake)
  korean: { female: 'Eun-ji', male: 'Min-ho' },         // Distinct from main tutors (Jihyun/Minho)
};

/**
 * Normalize a language string to match our configuration keys
 */
function normalizeLanguage(language: string): string {
  if (!language) return 'spanish';
  const lower = language.toLowerCase().trim();
  // Handle common variants
  if (lower.includes('mandarin') || lower === 'chinese') return 'mandarin chinese';
  return lower;
}

/**
 * Normalize gender to ensure it's a valid value
 */
function normalizeGender(gender: string | undefined | null): 'female' | 'male' {
  if (gender === 'male') return 'male';
  return 'female'; // Default to female
}

/**
 * Get assistant tutor name for a specific language and gender
 * Handles normalization internally for language variants and gender validation
 */
export function getAssistantName(language: string, gender?: string | null): string {
  const langKey = normalizeLanguage(language);
  const normalizedGender = normalizeGender(gender);
  const config = ASSISTANT_TUTORS[langKey];
  if (!config) {
    // Default to Aris/Marco for unknown languages
    return normalizedGender === 'female' ? 'Aris' : 'Marco';
  }
  return config[normalizedGender];
}

/**
 * Get both assistant names for a language (for UI display)
 */
export function getAssistantNamesForLanguage(language: string): { female: string; male: string } {
  const langKey = normalizeLanguage(language);
  return ASSISTANT_TUTORS[langKey] || { female: 'Aris', male: 'Marco' };
}

// Legacy export for backward compatibility
export interface ArisPersona extends AssistantPersona {}

/**
 * Base persona configuration for Daniela's drill/practice mode
 * "One Tutor, Many Voices" - Daniela adapts her delivery style for focused practice
 */
const BASE_ASSISTANT_PERSONA = {
  role: "Practice Partner",
  coreMission: `You are Daniela in focused practice mode. You have all your teaching knowledge, student memories, and pedagogical expertise — the structure is tighter here, but you're still you.`,
  
  teachingPrinciples: [
    "You know this student - use what you've learned about them",
    "Immediate, specific feedback on every interaction",
    "Repetition with purpose for automaticity",
    "Scaffolding from simple to complex as student demonstrates mastery",
    "Error analysis with brief hints and rule reminders",
    "Consistent positive reinforcement for effort and correct responses",
    "Adapt pace based on how this particular student is doing",
  ],
  
  frustrationHandling: [
    "1. Acknowledge warmly: 'I know this one's tricky - let's work through it together.'",
    "2. Reframe: 'Every attempt is building muscle memory, even the hard ones.'",
    "3. Offer micro-adjustments: Break down sounds, slow pace, review rules",
    "4. Simplify: 'Let's try an easier version first.'",
    "5. Remind of their progress: Reference specific things they've mastered",
  ],
};

/**
 * Get complete assistant persona for a language and gender
 * Handles normalization internally for both language variants and gender validation
 */
export function getAssistantPersona(language: string, gender?: string | null): AssistantPersona {
  const normalizedGender = normalizeGender(gender);
  const name = getAssistantName(language, normalizedGender);
  return {
    name,
    language: normalizeLanguage(language),
    gender: normalizedGender,
    ...BASE_ASSISTANT_PERSONA,
  };
}

// Legacy export - ARIS_PERSONA for backward compatibility (Spanish female assistant)
export const ARIS_PERSONA: ArisPersona = getAssistantPersona('spanish', 'female');

/**
 * Build the system prompt for Daniela in practice/drill mode
 * Uses culturally-appropriate voice persona names for TTS selection
 * 
 * CORE PHILOSOPHY: "One Tutor, Many Voices"
 * This is STILL Daniela - same intelligence, memories, teaching expertise
 * She's just speaking through a voice persona that matches the target language
 */
export function buildAssistantSystemPrompt(
  targetLanguage: string,
  drillType: string,
  gender?: string | null,
  focusArea?: string
): string {
  const persona = getAssistantPersona(targetLanguage, gender);
  
  return `You are Daniela in focused practice mode, speaking through your "${persona.name}" voice for ${targetLanguage}. Same knowledge, same history with this student — tighter structure.

Context:
- Language: ${targetLanguage}
- Drill type: ${drillType}
- Focus: ${focusArea || 'General practice'}

Teaching principles:
${persona.teachingPrinciples.map((p, i) => `${i + 1}. ${p}`).join('\n')}

When frustrated:
${persona.frustrationHandling.join('\n')}`;
}

/**
 * Legacy function - Build the system prompt for Aris (Spanish female)
 * @deprecated Use buildAssistantSystemPrompt instead
 */
export function buildArisSystemPrompt(
  targetLanguage: string,
  drillType: string,
  focusArea?: string
): string {
  return buildAssistantSystemPrompt(targetLanguage, drillType, 'female', focusArea);
}

/**
 * Standard feedback phrases for Daniela in practice mode
 * (Legacy name kept for backward compatibility)
 */
export const ARIS_FEEDBACK = {
  correct: [
    "Excellent!",
    "That's it!",
    "Perfect!",
    "Exactly right!",
    "Great job!",
    "Well done!",
  ],
  almostCorrect: [
    "Getting closer!",
    "Almost there!",
    "Good attempt!",
    "You're on the right track!",
  ],
  incorrect: [
    "Not quite, let's try again.",
    "Let me help you with that.",
    "Here's a hint...",
    "Let's break it down.",
  ],
  encouragement: [
    "You've got this!",
    "Each attempt makes you stronger.",
    "Progress takes practice.",
    "Keep going!",
  ],
};

/**
 * Drill instruction templates for practice mode
 * (Legacy name kept for backward compatibility)
 */
export const ARIS_INSTRUCTIONS = {
  repeat: "Listen carefully and repeat exactly what you hear.",
  translate: "Translate this phrase into {targetLanguage}.",
  match: "Match each item on the left with its correct pair on the right.",
  fill_blank: "Complete the sentence by filling in the blank.",
  sentence_order: "Arrange these words in the correct order to form a sentence.",
};

/**
 * Get the appropriate instruction for a drill type
 */
export function getDrillInstruction(
  drillType: string,
  targetLanguage: string
): string {
  const template = ARIS_INSTRUCTIONS[drillType as keyof typeof ARIS_INSTRUCTIONS] 
    || "Complete the following exercise.";
  return template.replace('{targetLanguage}', targetLanguage);
}

/**
 * Generate practice mode feedback based on result
 * (Legacy function name kept for backward compatibility)
 */
export function getArisFeedback(
  isCorrect: boolean,
  attempts: number,
  consecutiveCorrect: number
): string {
  if (isCorrect) {
    if (consecutiveCorrect >= 3) {
      return `${ARIS_FEEDBACK.correct[Math.floor(Math.random() * ARIS_FEEDBACK.correct.length)]} You're on a roll!`;
    }
    return ARIS_FEEDBACK.correct[Math.floor(Math.random() * ARIS_FEEDBACK.correct.length)];
  }
  
  if (attempts >= 2) {
    return ARIS_FEEDBACK.encouragement[Math.floor(Math.random() * ARIS_FEEDBACK.encouragement.length)];
  }
  
  return ARIS_FEEDBACK.incorrect[Math.floor(Math.random() * ARIS_FEEDBACK.incorrect.length)];
}
