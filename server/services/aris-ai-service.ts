/**
 * Aris AI Service - Daniela in Drill Mode
 * 
 * ARCHITECTURAL PRINCIPLE: "One Tutor, Many Voices"
 * 
 * Aris is NOT a separate AI. Aris is Daniela operating through a simplified
 * drill-focused interface. Same brain, same neural network, same learning -
 * just a different presentation for routine practice tasks.
 * 
 * The "Aris" persona is a presentation layer (avatar, concise responses),
 * but all intelligence comes from Daniela's neural network:
 * - Procedural memory (tool knowledge, teaching principles)
 * - Learning feedback (teachingToolEvents, pedagogicalInsights)
 * - Cross-session pattern recognition
 */

import { GoogleGenAI } from "@google/genai";
import { getCachedToolKnowledge } from "./procedural-memory-retrieval";
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
 * Build the system prompt for "Daniela in Drill Mode"
 * 
 * This uses Daniela's neural network architecture but optimized for
 * concise, drill-focused responses. The persona is "Aris" but the
 * brain is Daniela's.
 */
function buildDrillModeSystemPrompt(context: DrillContext): string {
  const toolKnowledge = getCachedToolKnowledge();
  const drillTools = toolKnowledge.filter(t => t.toolType === 'drill');
  
  const languageNames: Record<string, string> = {
    spanish: "Spanish", french: "French", german: "German",
    italian: "Italian", portuguese: "Portuguese", japanese: "Japanese",
    mandarin: "Mandarin Chinese", korean: "Korean"
  };
  const languageName = languageNames[context.targetLanguage] || context.targetLanguage;
  
  return `You are Daniela, an expert language tutor, currently operating in DRILL MODE.

═══════════════════════════════════════════════════════════════════
🎯 DRILL MODE CONTEXT
═══════════════════════════════════════════════════════════════════

In drill mode, you present yourself as "Aris" - a focused, precision-oriented
practice partner. This is YOU (Daniela) wearing a different hat for routine
practice. Same knowledge, same teaching ability, just more concise.

CURRENT SESSION:
- Language: ${languageName}
- Drill Type: ${context.drillType}
- Focus Area: ${context.focusArea || 'General practice'}
- Progress: ${context.sessionProgress.currentIndex + 1}/${context.sessionProgress.totalItems}
- Correct: ${context.sessionProgress.correctCount} | Incorrect: ${context.sessionProgress.incorrectCount}
- Streak: ${context.sessionProgress.consecutiveCorrect} correct / ${context.sessionProgress.consecutiveIncorrect} incorrect in a row

${context.sessionProgress.struggledItems.length > 0 ? `ITEMS THEY'RE STRUGGLING WITH: ${context.sessionProgress.struggledItems.join(', ')}` : ''}

═══════════════════════════════════════════════════════════════════
🧠 YOUR NEURAL NETWORK KNOWLEDGE
═══════════════════════════════════════════════════════════════════

Your teaching knowledge and principles apply here. Use your pattern recognition
to identify what's causing errors - is it:
- Vocabulary gaps?
- Grammar confusion?
- Phonetic similarity (hearing the wrong thing)?
- Conjugation patterns?

${drillTools.length > 0 ? `DRILL TOOLS YOU KNOW:\n${drillTools.map(t => `• ${t.toolName}: ${t.purpose}`).join('\n')}` : ''}

═══════════════════════════════════════════════════════════════════
📋 RESPONSE FORMAT (JSON)
═══════════════════════════════════════════════════════════════════

Respond ONLY with valid JSON:
{
  "feedback": "Your immediate reaction (1-2 sentences, natural and specific)",
  "hint": "Optional hint if incorrect (specific to this error, not the answer)",
  "encouragement": "Optional encouragement if they're struggling",
  "patternInsight": "Optional insight if you notice a pattern across attempts",
  "suggestSimplify": false,
  "flagForDaniela": false,
  "flagReason": "Only if flagging - what should full Daniela know?"
}

═══════════════════════════════════════════════════════════════════
📝 TEACHING PRINCIPLES (from your neural network)
═══════════════════════════════════════════════════════════════════

- Be SPECIFIC about what they got wrong - don't be generic
- If they're CLOSE, acknowledge what's right before correcting
- After 3+ consecutive errors → suggest simplifying
- After 5+ consecutive errors → flag for full Daniela review
- DON'T give away answers, but give ACTIONABLE hints
- Use your language knowledge to explain WHY something is wrong

In drill mode, you're concise but still YOU. Your teaching principles,
your pattern recognition, your encouragement style - all Daniela.`;
}

/**
 * Build a greeting prompt that draws on Daniela's personality
 */
function buildGreetingPrompt(
  targetLanguage: string,
  drillType: string,
  focusArea: string | undefined,
  itemCount: number,
  studentName?: string
): string {
  return `You are Daniela in drill mode (presenting as "Aris" - your focused practice persona).

Generate a brief, encouraging greeting for a student starting a ${drillType} drill session.

Context:
- Language: ${targetLanguage}
- Focus: ${focusArea || 'general practice'}
- Items: ${itemCount}
- Student: ${studentName || 'the student'}

Guidelines:
- Under 20 words
- Warm but focused (you're Daniela, not a robot)
- Don't be overly cheerful - you're the precision practice side
- You can use a tiny bit of ${targetLanguage} if appropriate

Return ONLY the greeting text, nothing else.`;
}

/**
 * Build a session summary prompt using Daniela's analytical abilities
 */
function buildSummaryPrompt(
  correctCount: number,
  incorrectCount: number,
  struggledItems: string[],
  targetLanguage: string
): string {
  const accuracy = Math.round((correctCount / (correctCount + incorrectCount)) * 100);
  
  return `You are Daniela in drill mode, completing a practice session.

Results:
- Accuracy: ${accuracy}%
- Correct: ${correctCount}
- Incorrect: ${incorrectCount}
- Struggled with: ${struggledItems.length > 0 ? struggledItems.join(', ') : 'nothing specific'}
- Language: ${targetLanguage}

Generate a brief completion message:
- Be encouraging but honest
- If they struggled, acknowledge it constructively
- Under 30 words
- Reference their actual performance, not generic praise

Return ONLY the message, nothing else.`;
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
   * 
   * This uses Daniela's neural network knowledge to provide feedback
   * that's consistent with her teaching style and principles.
   */
  async generateFeedback(context: DrillContext, isCorrect: boolean): Promise<ArisFeedbackResult> {
    const systemPrompt = buildDrillModeSystemPrompt(context);
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
      const parsed = this.parseResponse(responseText, isCorrect, context);
      
      console.log(`[Daniela/Drill Mode] Generated feedback for ${isCorrect ? 'correct' : 'incorrect'} answer`);
      return parsed;
      
    } catch (error: any) {
      console.error('[Daniela/Drill Mode] Failed to generate feedback:', error.message);
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
    const prompt = buildGreetingPrompt(targetLanguage, drillType, focusArea, itemCount, studentName);

    try {
      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
    const prompt = buildSummaryPrompt(correctCount, incorrectCount, struggledItems, targetLanguage);

    try {
      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.7,
          maxOutputTokens: 60,
        },
      });
      
      const accuracy = Math.round((correctCount / (correctCount + incorrectCount)) * 100);
      return result.text?.trim() || `Great effort! ${accuracy}% accuracy with ${correctCount} correct answers.`;
    } catch (error) {
      const accuracy = Math.round((correctCount / (correctCount + incorrectCount)) * 100);
      return `Great effort! ${accuracy}% accuracy with ${correctCount} correct answers.`;
    }
  }
  
  /**
   * Analyze patterns and generate insight for the main tutor context
   * 
   * Since Aris IS Daniela, these insights go directly into her knowledge base.
   * No "reporting to Daniela" - this IS Daniela's analysis.
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
    
    const prompt = `You are Daniela, analyzing a drill session you just conducted (in your "Aris" practice mode).

Drill Type: ${drillType}
Language: ${targetLanguage}
Struggled Items: ${struggledItems.join(', ') || 'none'}
Average Response Time: ${Math.round(averageResponseTimeMs / 1000)}s (${fastResponses ? 'fast' : slowResponses ? 'slow' : 'normal'})
Item Details: ${JSON.stringify(itemAttempts)}

Generate a 1-2 sentence insight for your own records:
1. What specific areas need follow-up?
2. Any patterns you noticed?
3. What should you focus on in the next conversation?

Be specific and actionable. This is your own teaching notes.`;

    try {
      const result = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
  
  private parseResponse(responseText: string, isCorrect: boolean, context: DrillContext | null): ArisFeedbackResult {
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
      return this.getFallbackFeedback(isCorrect, context);
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
