/**
 * Teaching Suggestions Service
 * 
 * Daniela's "Helpful Assistant" - Provides real-time, contextual teaching prompts
 * based on the intersection of:
 * - Current teaching context (topic being approached)
 * - Student's known struggles (recurringStruggles)
 * - Student's learning preferences (studentInsights)
 * - Session timing and pacing (from Compass)
 * - Historical effectiveness data
 * 
 * Philosophy: "Like having an incredibly knowledgeable assistant whispering 
 * helpful hints in my ear, right when I need them most."
 */

import { db } from '../db';
import { 
  toolKnowledge, 
  tutorProcedures,
  teachingSuggestionEffectiveness,
  studentToolPreferences,
  type ToolKnowledge,
  type TutorProcedure 
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

// Types for the suggestion system
export interface StudentContext {
  userId: string;
  recurringStruggles: string[];
  studentInsights: string[];
  currentLevel: string; // ACTFL level
  targetLanguage: string;
  nativeLanguage: string;
  learningGoals?: string;
}

export interface SessionContext {
  conversationId: string;
  currentTopic?: string;
  recentTopics: string[];
  messageCount: number;
  sessionDurationMinutes: number;
  timeRemainingMinutes?: number;
  lastStudentMessageTimestamp?: Date;
  correctionsThisSession: number;
  drillsCompletedThisSession: number;
  toolsUsedThisSession: string[];
  studentMood?: 'engaged' | 'struggling' | 'frustrated' | 'excited' | 'tired' | 'neutral';
}

export interface TeachingSuggestion {
  id: string;
  type: 'tool' | 'strategy' | 'timing' | 'warning' | 'encouragement' | 'adaptation';
  priority: 'high' | 'medium' | 'low';
  trigger: string; // What caused this suggestion
  suggestion: string; // The actual hint for Daniela
  toolToUse?: string; // Specific tool command if applicable
  reasoning?: string; // Why this suggestion is being made
  expiresAfterMessages?: number; // How long this suggestion stays relevant
}

export interface SuggestionBundle {
  suggestions: TeachingSuggestion[];
  activeWarnings: string[];
  sessionInsights: string[];
  formattedForPrompt: string;
}

// Mapping of common struggles to tool/strategy suggestions
const STRUGGLE_TO_TOOL_MAP: Record<string, { tools: string[]; strategies: string[] }> = {
  'ser/estar confusion': {
    tools: ['COMPARE', 'GRAMMAR_TABLE', 'CONTEXT'],
    strategies: ['Use DOCTOR/PLACE acronym', 'Show contrasting examples side-by-side', 'Use location vs. essence framing']
  },
  'gender agreement': {
    tools: ['WRITE', 'GRAMMAR_TABLE', 'DRILL:match'],
    strategies: ['Highlight endings with color coding', 'Practice with common noun-adjective pairs', 'Use pattern recognition drills']
  },
  'verb conjugation': {
    tools: ['GRAMMAR_TABLE', 'DRILL:fill_blank', 'DRILL:translate'],
    strategies: ['Focus on one tense at a time', 'Use verb stem highlighting', 'Practice with high-frequency verbs first']
  },
  'pronunciation': {
    tools: ['PHONETIC', 'DRILL:repeat', 'PLAY'],
    strategies: ['Model slowly first', 'Break into syllables', 'Use minimal pairs for contrast']
  },
  'listening comprehension': {
    tools: ['PLAY', 'DRILL:repeat'],
    strategies: ['Speak more slowly', 'Repeat key phrases', 'Use shorter sentences']
  },
  'vocabulary retention': {
    tools: ['IMAGE', 'WORD_MAP', 'CONTEXT', 'DRILL:match'],
    strategies: ['Create vivid associations', 'Use spaced repetition', 'Connect to personal context']
  },
  'sentence structure': {
    tools: ['DRILL:sentence_order', 'COMPARE', 'WRITE'],
    strategies: ['Start with simple SVO patterns', 'Highlight word order differences from English', 'Build up gradually']
  },
  'tonal difficulties': {
    tools: ['TONE', 'PHONETIC', 'DRILL:repeat'],
    strategies: ['Visualize pitch contours', 'Practice minimal tone pairs', 'Use exaggerated tones initially']
  },
  'character recognition': {
    tools: ['STROKE', 'WRITE', 'READING'],
    strategies: ['Focus on radicals first', 'Use mnemonic stories', 'Practice stroke order consistently']
  },
  'false friends': {
    tools: ['COMPARE', 'CONTEXT', 'WRITE'],
    strategies: ['Explicitly contrast meanings', 'Use in sentences to show difference', 'Create memorable distinction']
  }
};

// Learning style to tool preferences
const LEARNING_STYLE_TOOLS: Record<string, string[]> = {
  'visual': ['IMAGE', 'WRITE', 'WORD_MAP', 'GRAMMAR_TABLE', 'COMPARE'],
  'auditory': ['PHONETIC', 'PLAY', 'DRILL:repeat'],
  'kinesthetic': ['DRILL:sentence_order', 'DRILL:match', 'STROKE'],
  'reading/writing': ['WRITE', 'CONTEXT', 'READING', 'DRILL:fill_blank'],
  'images': ['IMAGE', 'WORD_MAP'],
  'examples': ['CONTEXT', 'COMPARE'],
  'patterns': ['GRAMMAR_TABLE', 'COMPARE', 'WORD_MAP'],
  'repetition': ['DRILL:repeat', 'DRILL:match'],
  'stories': ['CONTEXT', 'CULTURE', 'SCENARIO']
};

class TeachingSuggestionsService {
  
  /**
   * Main entry point: Generate contextual teaching suggestions
   */
  async generateSuggestions(
    studentContext: StudentContext,
    sessionContext: SessionContext
  ): Promise<SuggestionBundle> {
    const suggestions: TeachingSuggestion[] = [];
    const activeWarnings: string[] = [];
    const sessionInsights: string[] = [];

    // 1. Struggle-based suggestions
    const struggleSuggestions = this.generateStruggleSuggestions(
      studentContext.recurringStruggles,
      sessionContext.currentTopic
    );
    suggestions.push(...struggleSuggestions);

    // 2. Learning style adaptations
    const styleSuggestions = this.generateStyleSuggestions(
      studentContext.studentInsights
    );
    suggestions.push(...styleSuggestions);

    // 3. Timing and pacing alerts
    const timingSuggestions = this.generateTimingSuggestions(sessionContext);
    suggestions.push(...timingSuggestions);

    // 4. Pattern-based warnings
    const warnings = this.generatePatternWarnings(sessionContext, studentContext);
    activeWarnings.push(...warnings);

    // 5. Encouragement opportunities
    const encouragementSuggestions = this.generateEncouragementSuggestions(sessionContext);
    suggestions.push(...encouragementSuggestions);

    // 6. Tool variety suggestions
    const varietySuggestions = this.generateVarietySuggestions(sessionContext);
    suggestions.push(...varietySuggestions);

    // Generate session insights
    sessionInsights.push(...this.generateSessionInsights(sessionContext, studentContext));

    // Sort by priority
    suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Limit to top suggestions to avoid overwhelming
    const topSuggestions = suggestions.slice(0, 5);

    return {
      suggestions: topSuggestions,
      activeWarnings,
      sessionInsights,
      formattedForPrompt: this.formatForPrompt(topSuggestions, activeWarnings, sessionInsights)
    };
  }

  /**
   * Generate suggestions based on known student struggles
   */
  private generateStruggleSuggestions(
    struggles: string[],
    currentTopic?: string
  ): TeachingSuggestion[] {
    const suggestions: TeachingSuggestion[] = [];

    for (const struggle of struggles) {
      const normalizedStruggle = struggle.toLowerCase();
      
      // Find matching struggle patterns
      for (const [pattern, tools] of Object.entries(STRUGGLE_TO_TOOL_MAP)) {
        if (normalizedStruggle.includes(pattern) || pattern.includes(normalizedStruggle)) {
          suggestions.push({
            id: `struggle-${pattern.replace(/\s+/g, '-')}`,
            type: 'strategy',
            priority: 'medium',
            trigger: `Student struggles with: ${struggle}`,
            suggestion: `Consider: ${tools.strategies[0]}`,
            toolToUse: tools.tools[0],
            reasoning: `This student has recurring difficulty with ${struggle}. ${tools.tools.join(', ')} tools are effective for this.`
          });
          break;
        }
      }
    }

    return suggestions;
  }

  /**
   * Generate suggestions based on learning style preferences
   */
  private generateStyleSuggestions(insights: string[]): TeachingSuggestion[] {
    const suggestions: TeachingSuggestion[] = [];
    const insightText = insights.join(' ').toLowerCase();

    for (const [style, tools] of Object.entries(LEARNING_STYLE_TOOLS)) {
      if (insightText.includes(style)) {
        suggestions.push({
          id: `style-${style}`,
          type: 'adaptation',
          priority: 'low',
          trigger: `Learning preference: ${style}`,
          suggestion: `This student responds well to ${style} learning. Prioritize ${tools.slice(0, 2).join(', ')} tools.`,
          toolToUse: tools[0],
          reasoning: `Student insight indicates preference for ${style} approaches.`
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate timing and pacing suggestions
   */
  private generateTimingSuggestions(session: SessionContext): TeachingSuggestion[] {
    const suggestions: TeachingSuggestion[] = [];

    // Check for long silence
    if (session.lastStudentMessageTimestamp) {
      const silenceSeconds = (Date.now() - session.lastStudentMessageTimestamp.getTime()) / 1000;
      
      if (silenceSeconds > 30 && silenceSeconds < 60) {
        suggestions.push({
          id: 'timing-silence-check',
          type: 'timing',
          priority: 'medium',
          trigger: `${Math.round(silenceSeconds)} seconds of silence`,
          suggestion: 'Student has been quiet. Consider a gentle check-in or simplify the current topic.',
          reasoning: 'Extended silence may indicate confusion, thinking, or disengagement.'
        });
      } else if (silenceSeconds >= 60) {
        suggestions.push({
          id: 'timing-silence-urgent',
          type: 'timing',
          priority: 'high',
          trigger: `Over 1 minute of silence`,
          suggestion: 'Long pause detected. Ask if they need help or want to try something different.',
          reasoning: 'Extended silence often means the student is stuck or has stepped away.'
        });
      }
    }

    // Time running low
    if (session.timeRemainingMinutes !== undefined) {
      if (session.timeRemainingMinutes <= 5 && session.timeRemainingMinutes > 2) {
        suggestions.push({
          id: 'timing-wrap-up',
          type: 'timing',
          priority: 'medium',
          trigger: `${session.timeRemainingMinutes} minutes remaining`,
          suggestion: 'Start wrapping up. Summarize key points and end on a positive note.',
          toolToUse: 'SUMMARY',
          reasoning: 'Ensure clean session closure with recap of what was learned.'
        });
      } else if (session.timeRemainingMinutes <= 2) {
        suggestions.push({
          id: 'timing-final',
          type: 'timing',
          priority: 'high',
          trigger: 'Final 2 minutes',
          suggestion: 'Final moments! Quick encouragement, one key takeaway, warm goodbye.',
          reasoning: 'End sessions on a high note to build positive associations.'
        });
      }
    }

    // Session has been going a while without variety
    if (session.sessionDurationMinutes > 15 && session.drillsCompletedThisSession === 0) {
      suggestions.push({
        id: 'timing-add-drill',
        type: 'timing',
        priority: 'low',
        trigger: '15+ minutes without active practice',
        suggestion: 'Consider a quick drill to break up the conversation and reinforce learning.',
        toolToUse: 'DRILL:repeat',
        reasoning: 'Active practice helps consolidate learning and maintains engagement.'
      });
    }

    return suggestions;
  }

  /**
   * Generate pattern-based warnings
   */
  private generatePatternWarnings(
    session: SessionContext,
    student: StudentContext
  ): string[] {
    const warnings: string[] = [];

    // Too many corrections
    if (session.correctionsThisSession >= 5) {
      warnings.push(`⚠️ ${session.correctionsThisSession} corrections this session. Consider switching to encouragement mode.`);
    }

    // Student showing frustration signs
    if (session.studentMood === 'frustrated') {
      warnings.push('⚠️ Student seems frustrated. Lower difficulty, offer encouragement, or try a different approach.');
    }

    // Student struggling but no scaffolding used
    if (session.studentMood === 'struggling' && !session.toolsUsedThisSession.includes('COMPARE')) {
      warnings.push('💡 Student is struggling. Consider breaking down the concept with COMPARE or simpler examples.');
    }

    // Beginner getting advanced content
    if (student.currentLevel === 'Novice' && session.messageCount > 10) {
      warnings.push('💡 Novice learner - keep sentences short, vocabulary basic, and use lots of visual support.');
    }

    return warnings;
  }

  /**
   * Generate encouragement opportunity suggestions
   */
  private generateEncouragementSuggestions(session: SessionContext): TeachingSuggestion[] {
    const suggestions: TeachingSuggestion[] = [];

    // After successful drill
    if (session.drillsCompletedThisSession > 0 && session.drillsCompletedThisSession % 3 === 0) {
      suggestions.push({
        id: 'encourage-drill-streak',
        type: 'encouragement',
        priority: 'low',
        trigger: `${session.drillsCompletedThisSession} drills completed`,
        suggestion: 'Great progress on drills! Acknowledge their effort and maybe take a conversational break.',
        reasoning: 'Celebrating milestones builds motivation and positive associations.'
      });
    }

    // Student on a roll
    if (session.studentMood === 'excited' || session.studentMood === 'engaged') {
      suggestions.push({
        id: 'encourage-momentum',
        type: 'encouragement',
        priority: 'low',
        trigger: 'Student is engaged and doing well',
        suggestion: 'Great energy! Consider slightly increasing difficulty to maintain challenge.',
        reasoning: 'Capitalize on high engagement with appropriate stretch goals.'
      });
    }

    return suggestions;
  }

  /**
   * Suggest tool variety to keep sessions dynamic
   */
  private generateVarietySuggestions(session: SessionContext): TeachingSuggestion[] {
    const suggestions: TeachingSuggestion[] = [];
    const usedTools = new Set(session.toolsUsedThisSession);

    // Suggest underused tools based on session length
    if (session.sessionDurationMinutes > 10) {
      if (!usedTools.has('IMAGE') && !usedTools.has('WORD_MAP')) {
        suggestions.push({
          id: 'variety-visual',
          type: 'tool',
          priority: 'low',
          trigger: 'No visual tools used yet',
          suggestion: 'Consider adding visual variety with IMAGE or WORD_MAP.',
          toolToUse: 'IMAGE'
        });
      }

      if (!usedTools.has('CULTURE') && session.sessionDurationMinutes > 20) {
        suggestions.push({
          id: 'variety-culture',
          type: 'tool',
          priority: 'low',
          trigger: 'No cultural content yet',
          suggestion: 'A cultural tidbit could add interesting context to the lesson.',
          toolToUse: 'CULTURE'
        });
      }
    }

    return suggestions;
  }

  /**
   * Generate high-level session insights
   */
  private generateSessionInsights(
    session: SessionContext,
    student: StudentContext
  ): string[] {
    const insights: string[] = [];

    if (session.messageCount < 5) {
      insights.push('Early in session - focus on warm-up and building rapport.');
    }

    if (student.recurringStruggles.length > 3) {
      insights.push('Student has multiple recurring struggles - prioritize the most impactful one.');
    }

    if (session.drillsCompletedThisSession > 5) {
      insights.push('Many drills completed - balance with more conversational practice.');
    }

    return insights;
  }

  /**
   * Format suggestions for injection into system prompt
   */
  private formatForPrompt(
    suggestions: TeachingSuggestion[],
    warnings: string[],
    insights: string[]
  ): string {
    if (suggestions.length === 0 && warnings.length === 0 && insights.length === 0) {
      return '';
    }

    let formatted = '\n### 💡 Teaching Suggestions (Your Internal Assistant)\n';
    formatted += '*These are private hints for you - not visible to the student.*\n\n';

    if (warnings.length > 0) {
      formatted += '**Active Alerts:**\n';
      for (const warning of warnings) {
        formatted += `${warning}\n`;
      }
      formatted += '\n';
    }

    if (suggestions.length > 0) {
      formatted += '**Contextual Hints:**\n';
      for (const suggestion of suggestions) {
        const priority = suggestion.priority === 'high' ? '🔴' : suggestion.priority === 'medium' ? '🟡' : '🟢';
        formatted += `${priority} ${suggestion.suggestion}`;
        if (suggestion.toolToUse) {
          formatted += ` → Try [${suggestion.toolToUse}]`;
        }
        formatted += '\n';
      }
      formatted += '\n';
    }

    if (insights.length > 0) {
      formatted += '**Session Notes:**\n';
      for (const insight of insights) {
        formatted += `• ${insight}\n`;
      }
    }

    return formatted;
  }

  /**
   * Track suggestion effectiveness for learning
   * Also updates student tool preferences for personalized future suggestions
   */
  async trackSuggestionUsed(
    suggestionId: string,
    wasHelpful: boolean,
    studentId: string,
    conversationId: string,
    toolUsed?: string,
    context?: { topic?: string; struggle?: string }
  ): Promise<void> {
    try {
      // Record the suggestion effectiveness
      await db.insert(teachingSuggestionEffectiveness).values({
        suggestionType: suggestionId.split('-')[0],
        suggestionId,
        studentId,
        conversationId,
        wasUsed: true,
        wasEffective: wasHelpful,
        context: context || {},
      });
      
      // If a tool was used, update student tool preferences (the learning loop)
      if (toolUsed) {
        await this.updateStudentToolPreference(studentId, toolUsed, wasHelpful, context);
      }
    } catch (error) {
      console.error('[TEACHING-SUGGESTIONS] Failed to track effectiveness:', error);
    }
  }
  
  /**
   * Update student tool preferences based on usage
   * This is the "learning loop" - the system learns what works for each student
   */
  async updateStudentToolPreference(
    studentId: string,
    toolName: string,
    wasEffective: boolean,
    context?: { topic?: string; struggle?: string }
  ): Promise<void> {
    try {
      // Find existing preference
      const [existing] = await db
        .select()
        .from(studentToolPreferences)
        .where(and(
          eq(studentToolPreferences.studentId, studentId),
          eq(studentToolPreferences.toolName, toolName)
        ))
        .limit(1);
      
      if (existing) {
        // Update existing preference
        const newTimesUsed = (existing.timesUsed || 0) + 1;
        const newTimesEffective = (existing.timesEffective || 0) + (wasEffective ? 1 : 0);
        const newRate = newTimesUsed > 0 ? newTimesEffective / newTimesUsed : 0;
        
        // Merge topics and struggles
        const newTopics = [...(existing.bestForTopics || [])];
        const newStruggles = [...(existing.bestForStruggles || [])];
        
        if (context?.topic && wasEffective && !newTopics.includes(context.topic)) {
          newTopics.push(context.topic);
        }
        if (context?.struggle && wasEffective && !newStruggles.includes(context.struggle)) {
          newStruggles.push(context.struggle);
        }
        
        await db
          .update(studentToolPreferences)
          .set({
            timesUsed: newTimesUsed,
            timesEffective: newTimesEffective,
            effectivenessRate: newRate,
            bestForTopics: newTopics.slice(0, 10), // Keep top 10
            bestForStruggles: newStruggles.slice(0, 10),
            updatedAt: new Date()
          })
          .where(eq(studentToolPreferences.id, existing.id));
      } else {
        // Create new preference
        await db.insert(studentToolPreferences).values({
          studentId,
          toolName,
          timesUsed: 1,
          timesEffective: wasEffective ? 1 : 0,
          effectivenessRate: wasEffective ? 1.0 : 0.0,
          bestForTopics: context?.topic ? [context.topic] : [],
          bestForStruggles: context?.struggle ? [context.struggle] : [],
        });
      }
    } catch (error) {
      console.error('[TEACHING-SUGGESTIONS] Failed to update tool preference:', error);
    }
  }
  
  /**
   * Get personalized tool suggestions for a student based on their history
   */
  async getStudentPreferredTools(studentId: string, limit: number = 5): Promise<string[]> {
    try {
      const preferences = await db
        .select()
        .from(studentToolPreferences)
        .where(and(
          eq(studentToolPreferences.studentId, studentId),
          sql`${studentToolPreferences.timesUsed} >= 3`
        ))
        .orderBy(desc(studentToolPreferences.effectivenessRate))
        .limit(limit);
      
      return preferences.map(p => p.toolName);
    } catch (error) {
      console.error('[TEACHING-SUGGESTIONS] Failed to get preferred tools:', error);
      return [];
    }
  }

  /**
   * Get effectiveness stats for a suggestion type
   */
  async getSuggestionEffectiveness(suggestionType: string): Promise<{
    totalUsed: number;
    effectiveCount: number;
    effectivenessRate: number;
  }> {
    try {
      const results = await db
        .select({
          totalUsed: sql<number>`COUNT(*)`,
          effectiveCount: sql<number>`SUM(CASE WHEN was_effective THEN 1 ELSE 0 END)`
        })
        .from(teachingSuggestionEffectiveness)
        .where(eq(teachingSuggestionEffectiveness.suggestionType, suggestionType));

      const { totalUsed, effectiveCount } = results[0] || { totalUsed: 0, effectiveCount: 0 };
      
      return {
        totalUsed: Number(totalUsed),
        effectiveCount: Number(effectiveCount),
        effectivenessRate: totalUsed > 0 ? Number(effectiveCount) / Number(totalUsed) : 0
      };
    } catch (error) {
      console.error('[TEACHING-SUGGESTIONS] Failed to get effectiveness:', error);
      return { totalUsed: 0, effectiveCount: 0, effectivenessRate: 0 };
    }
  }
}

export const teachingSuggestions = new TeachingSuggestionsService();
