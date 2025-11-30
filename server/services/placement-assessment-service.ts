/**
 * Placement Assessment Service
 * 
 * Handles adaptive ACTFL placement assessments for Level 2+ class enrollments.
 * When a student enrolls in a class that requires placement checks, their first
 * voice session triggers an AI assessment to verify their actual proficiency level.
 * 
 * Key responsibilities:
 * - Check if placement is needed for a class enrollment
 * - Run AI-powered ACTFL assessment on conversation content
 * - Update user's ACTFL level and enrollment placement status
 * - Calculate delta between self-reported and assessed levels
 */

import { GoogleGenAI } from "@google/genai";
import { storage } from "../storage";
import { ACTFL_LEVELS, type ActflLevel } from "../actfl-advancement";
import { toInternalActflLevel } from "../actfl-utils";
import type { Message } from "@shared/schema";

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '',
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
  }
});

export interface PlacementResult {
  assessedLevel: ActflLevel;
  confidence: number;
  delta: number;
  reasoning: string;
  recommendations: string[];
}

export interface PlacementCheckResult {
  needsPlacement: boolean;
  classId?: string;
  enrollmentId?: string;
  className?: string;
}

/**
 * Check if a student needs placement assessment for any of their class enrollments
 */
export async function checkPlacementNeeded(userId: string): Promise<PlacementCheckResult> {
  try {
    const enrollments = await storage.getStudentEnrollments(userId);
    
    for (const enrollment of enrollments) {
      if (!enrollment.isActive || enrollment.placementChecked) {
        continue;
      }
      
      const classInfo = await storage.getTeacherClass(enrollment.classId);
      if (!classInfo) continue;
      
      if (classInfo.requiresPlacementCheck && (classInfo.classLevel || 1) >= 2) {
        return {
          needsPlacement: true,
          classId: enrollment.classId,
          enrollmentId: enrollment.id,
          className: classInfo.name,
        };
      }
    }
    
    return { needsPlacement: false };
  } catch (error) {
    console.error('[PlacementAssessment] Error checking placement needed:', error);
    return { needsPlacement: false };
  }
}

/**
 * Get the numeric index of an ACTFL level for delta calculation
 */
function getActflLevelIndex(level: string | null | undefined): number {
  if (!level) return 0;
  const normalized = toInternalActflLevel(level);
  if (!normalized) return 0;
  const index = ACTFL_LEVELS.indexOf(normalized as ActflLevel);
  return index >= 0 ? index : 0;
}

/**
 * Run AI-powered ACTFL assessment on a conversation
 * Returns assessed level, confidence, and reasoning
 */
export async function assessActflLevel(
  conversationHistory: Array<{ role: string; content: string }>,
  targetLanguage: string,
  selfReportedLevel: string | null
): Promise<PlacementResult> {
  const studentMessages = conversationHistory
    .filter(m => m.role === 'user')
    .map(m => m.content)
    .join('\n');
  
  const assessmentPrompt = `You are an ACTFL-certified language assessment expert. Analyze the following student language samples in ${targetLanguage} and determine their ACTFL proficiency level.

ACTFL Proficiency Levels (from lowest to highest):
1. Novice Low - Isolated words, memorized phrases
2. Novice Mid - Words, phrases, simple statements
3. Novice High - Simple sentences, limited vocabulary
4. Intermediate Low - Simple sentences, create with the language
5. Intermediate Mid - Longer sentences, some paragraph-length discourse
6. Intermediate High - Connected paragraphs, can narrate/describe
7. Advanced Low - Paragraph-level discourse, can discuss abstract topics
8. Advanced Mid - Extended discourse, can hypothesize
9. Advanced High - Near-native fluency in most situations
10. Superior - Professional/academic proficiency
11. Distinguished - Near-native or native fluency

Student's self-reported starting level: ${selfReportedLevel || 'Not specified'}

Student language samples:
${studentMessages || 'No samples available - use self-reported level as baseline'}

Analyze based on FACT criteria:
- Functions: What communication tasks can they perform?
- Accuracy: Grammar, vocabulary, and pronunciation patterns evident
- Context: Range of topics and situations demonstrated
- Text Type: Words, sentences, paragraphs, or extended discourse

Respond in this exact JSON format:
{
  "assessed_level": "intermediate_low",
  "confidence": 0.85,
  "reasoning": "Student demonstrates ability to...",
  "recommendations": ["Focus on...", "Practice..."]
}

Use snake_case for the level (e.g., novice_low, intermediate_mid, advanced_high).
Confidence should be between 0.5 and 1.0.`;

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.0-flash",
      contents: assessmentPrompt,
    });

    const text = response.text || '';
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[PlacementAssessment] No JSON found in AI response');
      return createFallbackResult(selfReportedLevel);
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const assessedLevel = toInternalActflLevel(parsed.assessed_level) as ActflLevel || 'novice_low';
    const selfIndex = getActflLevelIndex(selfReportedLevel);
    const assessedIndex = getActflLevelIndex(assessedLevel);
    const delta = selfIndex - assessedIndex;

    return {
      assessedLevel,
      confidence: Math.min(1.0, Math.max(0.5, parsed.confidence || 0.7)),
      delta,
      reasoning: parsed.reasoning || 'Assessment completed based on conversation samples.',
      recommendations: parsed.recommendations || [],
    };
  } catch (error) {
    console.error('[PlacementAssessment] AI assessment error:', error);
    return createFallbackResult(selfReportedLevel);
  }
}

/**
 * Create a fallback result when AI assessment fails
 */
function createFallbackResult(selfReportedLevel: string | null): PlacementResult {
  const level = (toInternalActflLevel(selfReportedLevel) as ActflLevel) || 'novice_low';
  return {
    assessedLevel: level,
    confidence: 0.5,
    delta: 0,
    reasoning: 'Unable to perform full assessment. Using self-reported level as baseline.',
    recommendations: ['Complete more practice sessions for accurate assessment.'],
  };
}

/**
 * Complete placement assessment and update all relevant records
 */
export async function completePlacementAssessment(
  userId: string,
  enrollmentId: string,
  conversationId: string
): Promise<PlacementResult | null> {
  try {
    const user = await storage.getUser(userId);
    if (!user) {
      console.error('[PlacementAssessment] User not found:', userId);
      return null;
    }

    const conversation = await storage.getConversation(conversationId, userId);
    if (!conversation) {
      console.error('[PlacementAssessment] Conversation not found:', conversationId);
      return null;
    }

    const messages = await storage.getMessagesByConversation(conversationId);
    const conversationHistory = messages.map((m: Message) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));

    const result = await assessActflLevel(
      conversationHistory,
      conversation.language,
      user.actflLevel || user.difficultyLevel
    );

    await storage.updateUserActfl(userId, {
      actflLevel: result.assessedLevel,
      actflAssessed: true,
      assessmentSource: 'placement_test',
      lastAssessmentDate: new Date(),
    });

    await storage.updateClassEnrollment(enrollmentId, {
      placementChecked: true,
      placementActflResult: result.assessedLevel,
      placementDelta: result.delta,
      placementDate: new Date(),
    });

    console.log(`[PlacementAssessment] Completed for user ${userId}:`, {
      assessed: result.assessedLevel,
      confidence: result.confidence,
      delta: result.delta,
    });

    return result;
  } catch (error) {
    console.error('[PlacementAssessment] Error completing assessment:', error);
    return null;
  }
}

/**
 * Check if this is the first completed voice session for a placement-required enrollment
 */
export async function shouldRunPlacementAfterSession(
  userId: string,
  conversationId: string
): Promise<{ shouldRun: boolean; enrollmentId?: string }> {
  try {
    const placementCheck = await checkPlacementNeeded(userId);
    if (!placementCheck.needsPlacement || !placementCheck.enrollmentId) {
      return { shouldRun: false };
    }

    const conversation = await storage.getConversation(conversationId, userId);
    if (!conversation || conversation.classId !== placementCheck.classId) {
      return { shouldRun: false };
    }

    const messages = await storage.getMessagesByConversation(conversationId);
    const userMessages = messages.filter((m: Message) => m.role === 'user');
    
    if (userMessages.length < 3) {
      console.log('[PlacementAssessment] Not enough messages for assessment:', userMessages.length);
      return { shouldRun: false };
    }

    return { shouldRun: true, enrollmentId: placementCheck.enrollmentId };
  } catch (error) {
    console.error('[PlacementAssessment] Error checking placement eligibility:', error);
    return { shouldRun: false };
  }
}
