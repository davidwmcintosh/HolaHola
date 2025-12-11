/**
 * Aris AI Service - Daniela in Drill Mode
 * 
 * ARCHITECTURAL PRINCIPLE: "One Tutor, Many Voices"
 * 
 * Aris is NOT a separate AI. Aris is Daniela operating through a simplified
 * drill-focused interface. Same brain, same neural network, same learning -
 * just a different presentation for routine practice tasks.
 * 
 * This service now routes ALL requests through the unified TutorOrchestrator,
 * ensuring that drill feedback comes from the same neural pipeline as
 * conversational interactions.
 * 
 * The "Aris" persona is a PRESENTATION LAYER only:
 * - Avatar and UI styling
 * - Concise response expectations
 * - Drill-specific instructions
 * 
 * But the INTELLIGENCE is always Daniela's brain.
 */

import {
  OrchestratorContext,
  VoicePresentation,
  VoiceStyleDeltas,
} from "@shared/tutor-orchestration-types";
import { tutorOrchestrator } from "./tutor-orchestrator";
import { ARIS_PERSONA } from "./assistant-tutor-config";

interface DrillContext {
  targetLanguage: string;
  drillType: string;
  focusArea?: string;
  currentItem: {
    prompt: string;
    expectedAnswer: string;
    studentAnswer: string;
  };
  sessionProgress: {
    correctCount: number;
    incorrectCount: number;
    currentIndex: number;
    totalItems: number;
    struggledItems: string[];
    consecutiveCorrect: number;
    consecutiveIncorrect: number;
  };
  recentHistory?: Array<{
    prompt: string;
    wasCorrect: boolean;
    studentAnswer: string;
  }>;
}

export interface ArisFeedbackResult {
  feedback: string;
  hint?: string;
  encouragement?: string;
  patternInsight?: string;
  suggestSimplify: boolean;
  flagForDaniela: boolean;
  flagReason?: string;
}

/**
 * Voice presentation for drill mode (Aris persona)
 * This is presentation only - the intelligence is Daniela's
 */
const DRILL_MODE_VOICE: VoicePresentation = {
  voiceId: "drill-mode-aris",
  name: "Daniela (Drill Mode)",
  gender: "female",
  styleDeltas: {
    responseLength: "concise",
    formalityLevel: "neutral",
    encouragementLevel: "moderate",
    additionalInstructions: `
In drill mode, you present as "${ARIS_PERSONA.name}" - your focused practice persona.
Your responses should be:
- Under 2 sentences for feedback
- Specific to what the student got right/wrong
- Encouraging but objective
- Never give away answers, give actionable hints

Response format for feedback (JSON):
{
  "feedback": "Your immediate reaction (1-2 sentences)",
  "hint": "Optional hint if incorrect",
  "encouragement": "Optional encouragement if struggling",
  "patternInsight": "Optional insight about patterns you notice",
  "suggestSimplify": boolean,
  "flagForDaniela": boolean,
  "flagReason": "Only if flagging - what pattern needs full attention?"
}
`,
  },
};

/**
 * Convert DrillContext to OrchestratorContext
 */
function buildOrchestratorContext(
  drillContext: DrillContext,
  userId: number = 0
): OrchestratorContext {
  return {
    userId,
    targetLanguage: drillContext.targetLanguage,
    nativeLanguage: "english", // Default, could be parameterized
    proficiencyLevel: "intermediate", // Could be fetched from user profile
    conversationHistory: [],
    drillContext: {
      drillType: drillContext.drillType,
      focusArea: drillContext.focusArea,
      currentItem: drillContext.currentItem,
      sessionProgress: {
        correct: drillContext.sessionProgress.correctCount,
        incorrect: drillContext.sessionProgress.incorrectCount,
        remaining:
          drillContext.sessionProgress.totalItems -
          drillContext.sessionProgress.currentIndex -
          1,
      },
      recentAttempts: drillContext.recentHistory?.map((h) => ({
        item: { prompt: h.prompt },
        wasCorrect: h.wasCorrect,
      })),
    },
  };
}

class ArisAIService {
  /**
   * Generate intelligent, context-aware feedback for a drill response
   * 
   * This routes through the unified TutorOrchestrator, using Daniela's
   * full neural pipeline with drill-specific presentation adjustments.
   */
  async generateFeedback(
    drillContext: DrillContext,
    isCorrect: boolean
  ): Promise<ArisFeedbackResult> {
    const context = buildOrchestratorContext(drillContext);
    
    // Build the user input describing the student's response
    const userInput = this.buildFeedbackRequest(drillContext, isCorrect);
    
    try {
      const response = await tutorOrchestrator.orchestrate({
        mode: "drill",
        responseChannel: "batch_json",
        context,
        voice: DRILL_MODE_VOICE,
        userInput,
        options: {
          temperature: 0.7,
          maxTokens: 300,
          logToNeuralNetwork: true,
        },
      });

      if (response.success && response.json) {
        const parsed = response.json;
        console.log(
          `[Daniela/Drill Mode] Generated feedback via unified pipeline`
        );
        return {
          feedback:
            parsed.feedback || (isCorrect ? "Well done!" : "Not quite."),
          hint: parsed.hint,
          encouragement: parsed.encouragement,
          patternInsight: parsed.patternInsight,
          suggestSimplify: parsed.suggestSimplify || false,
          flagForDaniela: parsed.flagForDaniela || false,
          flagReason: parsed.flagReason,
        };
      }

      // Fallback if orchestration returned text instead of JSON
      if (response.success && response.text) {
        return this.parseTextResponse(response.text, isCorrect, drillContext);
      }

      return this.getFallbackFeedback(isCorrect, drillContext);
    } catch (error: any) {
      console.error(
        "[Daniela/Drill Mode] Orchestration failed:",
        error.message
      );
      return this.getFallbackFeedback(isCorrect, drillContext);
    }
  }

  /**
   * Generate a personalized greeting when starting a drill session
   */
  async generateSessionGreeting(
    targetLanguage: string,
    drillType: string,
    focusArea: string | undefined,
    itemCount: number,
    studentName?: string
  ): Promise<string> {
    const context: OrchestratorContext = {
      userId: 0,
      targetLanguage,
      nativeLanguage: "english",
      proficiencyLevel: "intermediate",
      conversationHistory: [],
      drillContext: {
        drillType,
        focusArea,
        sessionProgress: { correct: 0, incorrect: 0, remaining: itemCount },
      },
    };

    try {
      const response = await tutorOrchestrator.orchestrate({
        mode: "greeting",
        responseChannel: "batch_text",
        context,
        voice: DRILL_MODE_VOICE,
        userInput: `Generate a brief greeting for ${studentName || "the student"} starting a ${drillType} drill with ${itemCount} items${focusArea ? ` focusing on ${focusArea}` : ""}. Keep it under 20 words.`,
        options: {
          temperature: 0.8,
          maxTokens: 50,
          logToNeuralNetwork: false, // Greetings don't need neural logging
        },
      });

      return (
        response.text?.trim() || this.getDefaultGreeting(itemCount, focusArea)
      );
    } catch (error) {
      return this.getDefaultGreeting(itemCount, focusArea);
    }
  }

  /**
   * Generate end-of-session summary and encouragement
   */
  async generateSessionSummary(
    correctCount: number,
    incorrectCount: number,
    struggledItems: string[],
    targetLanguage: string
  ): Promise<string> {
    const context: OrchestratorContext = {
      userId: 0,
      targetLanguage,
      nativeLanguage: "english",
      proficiencyLevel: "intermediate",
      conversationHistory: [],
    };

    const accuracy = Math.round(
      (correctCount / (correctCount + incorrectCount)) * 100
    );

    try {
      const response = await tutorOrchestrator.orchestrate({
        mode: "summary",
        responseChannel: "batch_text",
        context,
        voice: DRILL_MODE_VOICE,
        userInput: `Summarize this drill session: ${accuracy}% accuracy, ${correctCount} correct, ${incorrectCount} incorrect. Struggled items: ${struggledItems.join(", ") || "none"}. Keep it under 30 words, be encouraging but honest.`,
        options: {
          temperature: 0.7,
          maxTokens: 60,
          logToNeuralNetwork: true, // Summaries are worth logging
        },
      });

      return (
        response.text?.trim() ||
        `Great effort! ${accuracy}% accuracy with ${correctCount} correct answers.`
      );
    } catch (error) {
      return `Great effort! ${accuracy}% accuracy with ${correctCount} correct answers.`;
    }
  }

  /**
   * Analyze patterns and generate insight for your own teaching notes
   * 
   * Since this IS Daniela, these insights go directly into her knowledge base.
   */
  async analyzeSessionPatterns(
    drillType: string,
    targetLanguage: string,
    itemAttempts: Record<string, { correct: number; incorrect: number }>,
    struggledItems: string[],
    averageResponseTimeMs: number
  ): Promise<string> {
    const context: OrchestratorContext = {
      userId: 0,
      targetLanguage,
      nativeLanguage: "english",
      proficiencyLevel: "intermediate",
      conversationHistory: [],
      drillContext: {
        drillType,
        focusArea: undefined,
      },
    };

    const fastResponses = averageResponseTimeMs < 3000;
    const slowResponses = averageResponseTimeMs > 8000;

    try {
      const response = await tutorOrchestrator.orchestrate({
        mode: "summary",
        responseChannel: "batch_text",
        context,
        voice: DRILL_MODE_VOICE,
        userInput: `Analyze this drill session for your teaching notes:
Drill Type: ${drillType}
Struggled Items: ${struggledItems.join(", ") || "none"}
Average Response Time: ${Math.round(averageResponseTimeMs / 1000)}s (${fastResponses ? "fast" : slowResponses ? "slow" : "normal"})
Item Details: ${JSON.stringify(itemAttempts)}

Generate 1-2 sentence insight: What patterns do you notice? What should you focus on next?`,
        options: {
          temperature: 0.5,
          maxTokens: 100,
          logToNeuralNetwork: true,
        },
      });

      return (
        response.text?.trim() ||
        "Session completed. Review struggled items for follow-up."
      );
    } catch (error) {
      return "Session completed. Review struggled items for follow-up.";
    }
  }

  private buildFeedbackRequest(
    context: DrillContext,
    isCorrect: boolean
  ): string {
    const { currentItem, recentHistory } = context;

    let request = `Student Response:
- Prompt: "${currentItem.prompt}"
- Expected: "${currentItem.expectedAnswer}"
- Student answered: "${currentItem.studentAnswer}"
- Result: ${isCorrect ? "CORRECT" : "INCORRECT"}
- Progress: ${context.sessionProgress.currentIndex + 1}/${context.sessionProgress.totalItems}
- Streak: ${context.sessionProgress.consecutiveCorrect} correct / ${context.sessionProgress.consecutiveIncorrect} incorrect in a row`;

    if (recentHistory && recentHistory.length > 0) {
      request += `\n\nRecent history:\n`;
      recentHistory.slice(-3).forEach((h, i) => {
        request += `${i + 1}. "${h.prompt}" → "${h.studentAnswer}" (${h.wasCorrect ? "✓" : "✗"})\n`;
      });
    }

    request += `\n\nGenerate appropriate feedback as JSON.`;

    return request;
  }

  private parseTextResponse(
    responseText: string,
    isCorrect: boolean,
    context: DrillContext | null
  ): ArisFeedbackResult {
    try {
      const cleaned = responseText.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);

      return {
        feedback:
          parsed.feedback || (isCorrect ? "Well done!" : "Not quite."),
        hint: parsed.hint,
        encouragement: parsed.encouragement,
        patternInsight: parsed.patternInsight,
        suggestSimplify: parsed.suggestSimplify || false,
        flagForDaniela: parsed.flagForDaniela || false,
        flagReason: parsed.flagReason,
      };
    } catch {
      return this.getFallbackFeedback(isCorrect, context);
    }
  }

  private getFallbackFeedback(
    isCorrect: boolean,
    context: DrillContext | null
  ): ArisFeedbackResult {
    if (isCorrect) {
      const correctPhrases = [
        "Excellent!",
        "That's it!",
        "Perfect!",
        "Great job!",
      ];
      return {
        feedback:
          correctPhrases[Math.floor(Math.random() * correctPhrases.length)],
        suggestSimplify: false,
        flagForDaniela: false,
      };
    }

    const incorrectPhrases = [
      "Not quite, let's try again.",
      "Close! Give it another shot.",
    ];
    const shouldFlag =
      context?.sessionProgress.consecutiveIncorrect &&
      context.sessionProgress.consecutiveIncorrect >= 5;

    return {
      feedback:
        incorrectPhrases[Math.floor(Math.random() * incorrectPhrases.length)],
      suggestSimplify: context?.sessionProgress.consecutiveIncorrect
        ? context.sessionProgress.consecutiveIncorrect >= 3
        : false,
      flagForDaniela: shouldFlag || false,
      flagReason: shouldFlag
        ? "Multiple consecutive errors detected"
        : undefined,
    };
  }

  private getDefaultGreeting(itemCount: number, focusArea?: string): string {
    if (focusArea) {
      return `Let's practice ${focusArea}. ${itemCount} items ready.`;
    }
    return `Ready to practice? ${itemCount} items ahead. Let's begin.`;
  }
}

export const arisAIService = new ArisAIService();
