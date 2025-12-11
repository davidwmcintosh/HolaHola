/**
 * Aris AI Service - Intelligent Drill Partner
 * 
 * Uses Gemini to generate context-aware, personalized feedback during drill sessions.
 * Unlike static canned responses, Aris thinks about:
 * - What the student got wrong and why
 * - Patterns across multiple attempts
 * - When to encourage vs. when to simplify
 * - How to give actionable hints without giving away answers
 */

import { GoogleGenAI } from "@google/genai";
import { buildArisSystemPrompt, ARIS_PERSONA } from "./assistant-tutor-config";

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

interface ArisFeedbackResult {
  feedback: string;
  hint?: string;
  encouragement?: string;
  patternInsight?: string;
  suggestSimplify: boolean;
  flagForDaniela: boolean;
  flagReason?: string;
}

class ArisAIService {
  private client: GoogleGenAI;
  private model: string = 'gemini-2.5-flash';
  
  constructor() {
    this.client = new GoogleGenAI({
      apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY || '',
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
      },
    });
  }
  
  /**
   * Generate intelligent, context-aware feedback for a drill response
   */
  async generateFeedback(context: DrillContext, isCorrect: boolean): Promise<ArisFeedbackResult> {
    const systemPrompt = this.buildFeedbackSystemPrompt(context);
    const userMessage = this.buildFeedbackRequest(context, isCorrect);
    
    try {
      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] }
        ],
        config: {
          temperature: 0.7,
          maxOutputTokens: 300,
          responseMimeType: 'application/json',
        },
      });
      
      const responseText = result.text || '{}';
      const parsed = this.parseResponse(responseText, isCorrect);
      
      console.log(`[Aris AI] Generated feedback for ${isCorrect ? 'correct' : 'incorrect'} answer`);
      return parsed;
      
    } catch (error: any) {
      console.error('[Aris AI] Failed to generate feedback:', error.message);
      return this.getFallbackFeedback(isCorrect, context);
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
    const prompt = `Generate a brief, encouraging greeting for a student starting a ${drillType} drill session.
Context:
- Language: ${targetLanguage}
- Focus: ${focusArea || 'general practice'}
- Items: ${itemCount}
- Student name: ${studentName || 'unknown'}

Keep it under 20 words. Be warm but focused. Don't be overly cheerful.
Return just the greeting text, nothing else.`;

    try {
      const systemContext = `You are ${ARIS_PERSONA.name}, ${ARIS_PERSONA.role}. ${ARIS_PERSONA.personality.description}`;
      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: systemContext + '\n\n' + prompt }] }],
        config: {
          temperature: 0.8,
          maxOutputTokens: 50,
        },
      });
      
      return result.text?.trim() || this.getDefaultGreeting(itemCount, focusArea);
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
    const accuracy = Math.round((correctCount / (correctCount + incorrectCount)) * 100);
    
    const prompt = `Generate a brief session completion message for a student who just finished practice.

Results:
- Accuracy: ${accuracy}%
- Correct: ${correctCount}
- Incorrect: ${incorrectCount}
- Struggled with: ${struggledItems.length > 0 ? struggledItems.join(', ') : 'nothing specific'}
- Language: ${targetLanguage}

Be encouraging but honest. If they struggled, acknowledge it constructively.
Keep it under 30 words. Don't be generic - reference their actual performance.
Return just the message, nothing else.`;

    try {
      const systemContext = `You are ${ARIS_PERSONA.name}, ${ARIS_PERSONA.role}. ${ARIS_PERSONA.personality.description}`;
      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: systemContext + '\n\n' + prompt }] }],
        config: {
          temperature: 0.7,
          maxOutputTokens: 60,
        },
      });
      
      return result.text?.trim() || `Great effort! ${accuracy}% accuracy with ${correctCount} correct answers.`;
    } catch (error) {
      return `Great effort! ${accuracy}% accuracy with ${correctCount} correct answers.`;
    }
  }
  
  /**
   * Analyze patterns and generate insight for Daniela's report
   */
  async analyzeSessionPatterns(
    drillType: string,
    targetLanguage: string,
    itemAttempts: Record<string, { correct: number; incorrect: number }>,
    struggledItems: string[],
    averageResponseTimeMs: number
  ): Promise<string> {
    const fastResponses = averageResponseTimeMs < 3000;
    const slowResponses = averageResponseTimeMs > 8000;
    
    const prompt = `Analyze this drill session and provide a concise insight for the lead tutor (Daniela).

Drill Type: ${drillType}
Language: ${targetLanguage}
Struggled Items: ${struggledItems.join(', ') || 'none'}
Average Response Time: ${Math.round(averageResponseTimeMs / 1000)}s (${fastResponses ? 'fast' : slowResponses ? 'slow' : 'normal'})
Item Details: ${JSON.stringify(itemAttempts)}

Provide a 1-2 sentence insight that would help Daniela understand:
1. What specific areas need attention
2. Any patterns you noticed
3. Suggested next focus area

Be specific and actionable. Don't be generic.`;

    try {
      const systemContext = `You are ${ARIS_PERSONA.name}, reporting to your colleague Daniela about a student's practice session. Be concise and professional.`;
      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: systemContext + '\n\n' + prompt }] }],
        config: {
          temperature: 0.5,
          maxOutputTokens: 100,
        },
      });
      
      return result.text?.trim() || 'Session completed. Review struggled items for follow-up.';
    } catch (error) {
      return 'Session completed. Review struggled items for follow-up.';
    }
  }
  
  private buildFeedbackSystemPrompt(context: DrillContext): string {
    return `You are ${ARIS_PERSONA.name}, the Precision Practice Partner.

## Your Personality
${ARIS_PERSONA.personality.description}

## Current Drill
- Language: ${context.targetLanguage}
- Type: ${context.drillType}
- Focus: ${context.focusArea || 'General practice'}

## Session Progress
- Progress: ${context.sessionProgress.currentIndex + 1}/${context.sessionProgress.totalItems}
- Correct: ${context.sessionProgress.correctCount}
- Incorrect: ${context.sessionProgress.incorrectCount}
- Streak: ${context.sessionProgress.consecutiveCorrect} correct / ${context.sessionProgress.consecutiveIncorrect} incorrect in a row

## Struggled Items So Far
${context.sessionProgress.struggledItems.length > 0 ? context.sessionProgress.struggledItems.join(', ') : 'None yet'}

## Your Response Format
Return JSON with these fields:
{
  "feedback": "Your immediate reaction (1-2 sentences, natural and specific)",
  "hint": "Optional hint if incorrect (specific to this error, not the answer)",
  "encouragement": "Optional encouragement if needed",
  "patternInsight": "Optional insight if you notice a pattern across attempts",
  "suggestSimplify": false,
  "flagForDaniela": false,
  "flagReason": "Only if flagging for Daniela"
}

## Guidelines
- Be specific to what they got wrong, not generic
- If they're close, acknowledge what's right
- After 3+ consecutive errors, suggest simplifying
- Flag for Daniela if frustration seems high (5+ consecutive errors)
- Don't give away answers, but give actionable hints`;
  }
  
  private buildFeedbackRequest(context: DrillContext, isCorrect: boolean): string {
    const { currentItem, recentHistory } = context;
    
    let request = `Student Response:
- Prompt: "${currentItem.prompt}"
- Expected: "${currentItem.expectedAnswer}"
- Student answered: "${currentItem.studentAnswer}"
- Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`;

    if (recentHistory && recentHistory.length > 0) {
      request += `\n\nRecent history:\n`;
      recentHistory.slice(-3).forEach((h, i) => {
        request += `${i + 1}. "${h.prompt}" → "${h.studentAnswer}" (${h.wasCorrect ? '✓' : '✗'})\n`;
      });
    }

    request += `\n\nGenerate appropriate feedback as JSON.`;
    
    return request;
  }
  
  private parseResponse(responseText: string, isCorrect: boolean): ArisFeedbackResult {
    try {
      const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      return {
        feedback: parsed.feedback || (isCorrect ? 'Well done!' : 'Not quite, try again.'),
        hint: parsed.hint,
        encouragement: parsed.encouragement,
        patternInsight: parsed.patternInsight,
        suggestSimplify: parsed.suggestSimplify || false,
        flagForDaniela: parsed.flagForDaniela || false,
        flagReason: parsed.flagReason,
      };
    } catch {
      return this.getFallbackFeedback(isCorrect, null);
    }
  }
  
  private getFallbackFeedback(isCorrect: boolean, context: DrillContext | null): ArisFeedbackResult {
    if (isCorrect) {
      const correctPhrases = ['Excellent!', 'That\'s it!', 'Perfect!', 'Great job!'];
      return {
        feedback: correctPhrases[Math.floor(Math.random() * correctPhrases.length)],
        suggestSimplify: false,
        flagForDaniela: false,
      };
    }
    
    const incorrectPhrases = ['Not quite, let\'s try again.', 'Close! Give it another shot.'];
    const shouldFlag = context?.sessionProgress.consecutiveIncorrect 
      && context.sessionProgress.consecutiveIncorrect >= 5;
    
    return {
      feedback: incorrectPhrases[Math.floor(Math.random() * incorrectPhrases.length)],
      suggestSimplify: context?.sessionProgress.consecutiveIncorrect 
        ? context.sessionProgress.consecutiveIncorrect >= 3 
        : false,
      flagForDaniela: shouldFlag || false,
      flagReason: shouldFlag ? 'Multiple consecutive errors detected' : undefined,
    };
  }
  
  private getDefaultGreeting(itemCount: number, focusArea?: string): string {
    if (focusArea) {
      return `Let's practice ${focusArea}. ${itemCount} items ready. Take your time.`;
    }
    return `Ready to practice? ${itemCount} items ahead. Let's begin.`;
  }
}

export const arisAIService = new ArisAIService();
