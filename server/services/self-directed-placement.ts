/**
 * Self-Directed Placement Service
 * 
 * Provides a quick, conversational placement assessment for self-directed learners.
 * Unlike class placement assessments (which verify proficiency), this determines:
 * 1. The learner's ACTFL proficiency level
 * 2. A recommended tutor flexibility level based on their proficiency
 * 
 * The placement uses a brief 3-5 exchange conversation to assess skills.
 */

import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { ACTFL_LEVELS, type ActflLevel } from "../actfl-advancement";
import { toInternalActflLevel } from "../actfl-utils";
import type { TutorFreedomLevel } from "@shared/schema";

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  }
});

export interface SelfDirectedPlacementResult {
  actflLevel: ActflLevel;
  recommendedFlexibility: TutorFreedomLevel;
  confidence: number;
  reasoning: string;
  tips: string[];
}

/**
 * Map ACTFL levels to recommended flexibility levels
 * - Novice: Need more structure to build foundation
 * - Intermediate: Can handle some freedom with guidance
 * - Advanced+: Can direct their own learning
 */
export function getRecommendedFlexibility(actflLevel: ActflLevel): TutorFreedomLevel {
  const level = actflLevel.toLowerCase();
  
  if (level.startsWith('novice_low') || level.startsWith('novice_mid')) {
    return 'guided';
  }
  if (level.startsWith('novice_high')) {
    return 'flexible_goals';
  }
  if (level.startsWith('intermediate_low') || level.startsWith('intermediate_mid')) {
    return 'flexible_goals';
  }
  if (level.startsWith('intermediate_high')) {
    return 'open_exploration';
  }
  // Advanced, Superior, Distinguished
  return 'free_conversation';
}

/**
 * Get human-readable name for flexibility level
 */
export function getFlexibilityDisplayName(level: TutorFreedomLevel): string {
  const names: Record<TutorFreedomLevel, string> = {
    'guided': 'Guided (Structured)',
    'flexible_goals': 'Flexible Goals',
    'open_exploration': 'Open Exploration',
    'free_conversation': 'Free Conversation',
  };
  return names[level] || level;
}

/**
 * Get description for each flexibility level
 */
export function getFlexibilityDescription(level: TutorFreedomLevel): string {
  const descriptions: Record<TutorFreedomLevel, string> = {
    'guided': 'The tutor follows a structured approach, keeps you on topic, and provides clear corrections. Best for building a strong foundation.',
    'flexible_goals': 'You can choose topics within learning goals. The tutor guides you but allows exploration within your level.',
    'open_exploration': 'You lead the conversation direction. The tutor suggests learning connections but follows your interests.',
    'free_conversation': 'Maximum practice freedom. Natural conversation with minimal structure, great for building fluency.',
  };
  return descriptions[level] || '';
}

/**
 * Run a quick AI-powered placement assessment
 * Uses conversation samples to determine ACTFL level and recommend flexibility
 */
export async function runQuickPlacementAssessment(
  conversationSamples: string[],
  targetLanguage: string,
  selfReportedDifficulty?: string
): Promise<SelfDirectedPlacementResult> {
  
  const studentMessages = conversationSamples.join('\n\n');
  
  // Map self-reported difficulty to ACTFL hint
  const difficultyHint = selfReportedDifficulty === 'beginner' ? 'novice' :
                         selfReportedDifficulty === 'intermediate' ? 'intermediate' :
                         selfReportedDifficulty === 'advanced' ? 'advanced' : 'unknown';
  
  const assessmentPrompt = `You are an ACTFL-certified language assessment expert conducting a quick placement for a self-directed learner studying ${targetLanguage}.

ACTFL Proficiency Levels (11 levels, lowest to highest):
1. novice_low - Isolated words, memorized phrases only
2. novice_mid - Words, phrases, simple practiced statements
3. novice_high - Simple sentences, limited but growing vocabulary
4. intermediate_low - Create with the language, simple sentences
5. intermediate_mid - Longer sentences, some connected discourse
6. intermediate_high - Connected paragraphs, can narrate and describe
7. advanced_low - Paragraph-level discourse, abstract topics
8. advanced_mid - Extended discourse, can hypothesize
9. advanced_high - Near-native fluency in most situations
10. superior - Professional/academic proficiency
11. distinguished - Near-native or native fluency

Student's self-reported difficulty: ${difficultyHint}

Student's language samples (in ${targetLanguage}):
${studentMessages || 'No samples yet - use self-reported level as baseline.'}

Analyze using FACT criteria:
- Functions: What tasks can they perform?
- Accuracy: Grammar, vocabulary patterns evident
- Context: Range of topics demonstrated
- Text Type: Words, sentences, or paragraphs

Respond in this exact JSON format:
{
  "actfl_level": "novice_mid",
  "confidence": 0.75,
  "reasoning": "Based on the samples, the student demonstrates...",
  "tips": ["Tip 1 for improvement", "Tip 2 for improvement"]
}

Use snake_case for the level. Confidence between 0.5-1.0.
If no samples provided, estimate from self-reported difficulty with lower confidence.`;

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: assessmentPrompt,
    });

    const text = response.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      console.error('[SelfDirectedPlacement] No JSON in AI response');
      return createFallbackResult(selfReportedDifficulty);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const actflLevel = (toInternalActflLevel(parsed.actfl_level) as ActflLevel) || 'novice_low';
    const recommendedFlexibility = getRecommendedFlexibility(actflLevel);

    return {
      actflLevel,
      recommendedFlexibility,
      confidence: Math.min(1.0, Math.max(0.5, parsed.confidence || 0.7)),
      reasoning: parsed.reasoning || 'Assessment completed.',
      tips: parsed.tips || [],
    };
  } catch (error) {
    console.error('[SelfDirectedPlacement] AI assessment error:', error);
    return createFallbackResult(selfReportedDifficulty);
  }
}

/**
 * Create a fallback result when AI assessment fails
 */
function createFallbackResult(selfReportedDifficulty?: string): SelfDirectedPlacementResult {
  // Map difficulty to ACTFL
  let actflLevel: ActflLevel = 'novice_low';
  if (selfReportedDifficulty === 'beginner') {
    actflLevel = 'novice_mid';
  } else if (selfReportedDifficulty === 'intermediate') {
    actflLevel = 'intermediate_low';
  } else if (selfReportedDifficulty === 'advanced') {
    actflLevel = 'advanced_low';
  }

  return {
    actflLevel,
    recommendedFlexibility: getRecommendedFlexibility(actflLevel),
    confidence: 0.5,
    reasoning: 'Using your self-reported level. Complete more conversations for accurate assessment.',
    tips: ['Practice regularly to refine your placement.'],
  };
}

/**
 * Complete self-directed placement and update user record
 */
export async function completeSelfDirectedPlacement(
  userId: string,
  conversationId: string
): Promise<SelfDirectedPlacementResult | null> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      console.error('[SelfDirectedPlacement] User not found:', userId);
      return null;
    }

    const conversation = await storage.getConversation(conversationId, userId);
    if (!conversation) {
      console.error('[SelfDirectedPlacement] Conversation not found:', conversationId);
      return null;
    }

    const messages = await storage.getMessagesByConversation(conversationId);
    const studentMessages = messages
      .filter(m => m.role === 'user')
      .map(m => m.content);

    const result = await runQuickPlacementAssessment(
      studentMessages,
      conversation.language,
      user.difficultyLevel || undefined
    );

    // Update user with placement results
    await storage.updateUserActfl(userId, {
      actflLevel: result.actflLevel,
      actflAssessed: true,
      assessmentSource: 'placement_test',
      lastAssessmentDate: new Date(),
    });

    // Update user preferences with recommended flexibility
    await storage.updateUserPreferences(userId, {
      selfDirectedFlexibility: result.recommendedFlexibility,
      selfDirectedPlacementDone: true,
    });

    console.log(`[SelfDirectedPlacement] Completed for user ${userId}:`, {
      actfl: result.actflLevel,
      flexibility: result.recommendedFlexibility,
      confidence: result.confidence,
    });

    return result;
  } catch (error) {
    console.error('[SelfDirectedPlacement] Error completing placement:', error);
    return null;
  }
}

/**
 * Check if user should be prompted for placement
 */
export function shouldPromptForPlacement(user: {
  selfDirectedPlacementDone?: boolean | null;
  actflAssessed?: boolean | null;
  onboardingCompleted?: boolean | null;
}): boolean {
  // Already did placement
  if (user.selfDirectedPlacementDone) return false;
  
  // Has an AI-verified ACTFL level already
  if (user.actflAssessed) return false;
  
  // Hasn't completed onboarding yet
  if (!user.onboardingCompleted) return false;
  
  return true;
}

/**
 * Generate placement prompts for the AI tutor to ask
 */
export function getPlacementPrompts(targetLanguage: string): string[] {
  const languagePrompts: Record<string, string[]> = {
    spanish: [
      "¡Hola! Tell me about yourself in Spanish. What's your name and where are you from?",
      "¿Qué te gusta hacer en tu tiempo libre? (What do you like to do in your free time?)",
      "Describe tu día típico. ¿A qué hora te despiertas? (Describe your typical day)",
    ],
    french: [
      "Bonjour! Présentez-vous en français. Comment vous appelez-vous? D'où venez-vous?",
      "Qu'est-ce que vous aimez faire pendant votre temps libre?",
      "Décrivez une journée typique pour vous.",
    ],
    german: [
      "Hallo! Stellen Sie sich auf Deutsch vor. Wie heißen Sie? Woher kommen Sie?",
      "Was machen Sie gerne in Ihrer Freizeit?",
      "Beschreiben Sie einen typischen Tag für Sie.",
    ],
    italian: [
      "Ciao! Presentati in italiano. Come ti chiami? Di dove sei?",
      "Cosa ti piace fare nel tempo libero?",
      "Descrivi una tua giornata tipica.",
    ],
    portuguese: [
      "Olá! Apresente-se em português. Como você se chama? De onde você é?",
      "O que você gosta de fazer no seu tempo livre?",
      "Descreva um dia típico para você.",
    ],
    japanese: [
      "こんにちは！自己紹介してください。お名前は何ですか？",
      "趣味は何ですか？(What are your hobbies?)",
      "今日は何をしましたか？(What did you do today?)",
    ],
    mandarin: [
      "你好！请自我介绍一下。你叫什么名字？你从哪里来？",
      "你有什么爱好？(What are your hobbies?)",
      "描述一下你的一天。(Describe your day)",
    ],
    korean: [
      "안녕하세요! 자기 소개 해주세요. 이름이 뭐예요?",
      "취미가 뭐예요? (What are your hobbies?)",
      "오늘 뭐 했어요? (What did you do today?)",
    ],
  };

  return languagePrompts[targetLanguage.toLowerCase()] || [
    "Hello! Tell me about yourself in the target language.",
    "What do you like to do in your free time?",
    "Describe your typical day.",
  ];
}
