/**
 * Student Learning Service
 * 
 * Provides deep, persistent tracking of student learning patterns for Daniela.
 * This enables personalized tutoring by:
 * 1. Tracking granular error patterns per student
 * 2. Recording which teaching strategies work for each learner
 * 3. Surfacing learning context in Daniela's prompts
 * 
 * Addresses Daniela's core need: "Not just 'struggles with subjunctive' but 
 * WHICH specific aspects of subjunctive for THIS student"
 */

import { db } from '../db';
import { 
  recurringStruggles, 
  studentInsights, 
  sessionNotes,
  messages,
  conversations,
  type RecurringStruggle,
  type StudentInsight,
} from '@shared/schema';
import { eq, and, desc, sql, gte, ilike, or } from 'drizzle-orm';
import { storage } from '../storage';

// Error categories with granular subcategories
const ERROR_TAXONOMY: Record<string, string[]> = {
  grammar: [
    'verb_conjugation', 'tense_selection', 'mood_usage', 'agreement',
    'article_usage', 'preposition_choice', 'word_order', 'negation',
    'subjunctive_triggers', 'ser_estar', 'por_para'
  ],
  pronunciation: [
    'vowel_sounds', 'consonant_clusters', 'stress_patterns', 'intonation',
    'liaison', 'elision', 'rhythm', 'specific_phonemes'
  ],
  vocabulary: [
    'false_cognates', 'word_choice', 'collocation', 'register',
    'idiomatic_expressions', 'semantic_precision'
  ],
  cultural: [
    'formality_levels', 'social_conventions', 'nonverbal_cues',
    'cultural_references', 'pragmatics'
  ],
  comprehension: [
    'listening_speed', 'accent_variation', 'context_inference',
    'main_idea_extraction', 'detail_retention'
  ]
};

// Teaching strategy types
export const TEACHING_STRATEGIES = [
  'visual_timeline', 'role_play', 'repetition_drill', 'comparison_chart',
  'mnemonic', 'real_world_context', 'slow_pronunciation', 'written_example',
  'chunking', 'spaced_repetition', 'error_correction_immediate',
  'error_correction_delayed', 'self_discovery', 'explicit_rule',
  'implicit_exposure', 'gamification', 'storytelling'
] as const;

export type TeachingStrategy = typeof TEACHING_STRATEGIES[number];

// Export error categories for validation
export const ERROR_CATEGORIES = Object.keys(ERROR_TAXONOMY);
export { ERROR_TAXONOMY };

export interface StudentErrorEvent {
  studentId: string;
  language: string;
  errorCategory: string;
  specificError: string;
  description: string;
  studentUtterance?: string;
  correctForm?: string;
  conversationId?: string;
}

export interface StrategyOutcome {
  studentId: string;
  language: string;
  struggleArea: string;
  strategy: TeachingStrategy;
  wasEffective: boolean;
  notes?: string;
  conversationId?: string;
}

export interface StudentLearningContext {
  struggles: RecurringStruggle[];
  insights: StudentInsight[];
  effectiveStrategies: string[];
  strugglingAreas: string[];
  recentProgress: string[];
}

export class StudentLearningService {
  
  /**
   * Record an error event for a student
   * Creates or updates a recurring struggle with granular tracking
   */
  async recordError(event: StudentErrorEvent): Promise<RecurringStruggle> {
    // Check for existing struggle with same area and description
    const existing = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, event.studentId),
          eq(recurringStruggles.language, event.language),
          eq(recurringStruggles.struggleArea, event.errorCategory),
          ilike(recurringStruggles.description, `%${event.specificError}%`)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing struggle
      const struggle = existing[0];
      const newExamples = struggle.specificExamples 
        ? `${struggle.specificExamples}\n• ${event.studentUtterance || event.description}`
        : `• ${event.studentUtterance || event.description}`;
      
      const [updated] = await db
        .update(recurringStruggles)
        .set({
          occurrenceCount: sql`${recurringStruggles.occurrenceCount} + 1`,
          lastOccurredAt: new Date(),
          specificExamples: newExamples.slice(0, 2000), // Keep reasonable size
          updatedAt: new Date(),
        })
        .where(eq(recurringStruggles.id, struggle.id))
        .returning();
      
      console.log(`[StudentLearning] Updated struggle: ${event.specificError} (${updated.occurrenceCount}x)`);
      return updated;
    }
    
    // Create new struggle
    const [created] = await db
      .insert(recurringStruggles)
      .values({
        studentId: event.studentId,
        language: event.language,
        struggleArea: event.errorCategory,
        description: `${event.specificError}: ${event.description}`,
        specificExamples: event.studentUtterance ? `• ${event.studentUtterance}` : null,
        approachesAttempted: [],
        successfulApproaches: [],
        occurrenceCount: 1,
        lastOccurredAt: new Date(),
        status: 'active',
      })
      .returning();
    
    console.log(`[StudentLearning] Created new struggle: ${event.specificError}`);
    return created;
  }
  
  /**
   * Record the outcome of a teaching strategy
   * Tracks what works for each student
   */
  async recordStrategyOutcome(outcome: StrategyOutcome): Promise<void> {
    // Find the related struggle
    const struggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, outcome.studentId),
          eq(recurringStruggles.language, outcome.language),
          eq(recurringStruggles.struggleArea, outcome.struggleArea),
          eq(recurringStruggles.status, 'active')
        )
      )
      .limit(1);
    
    if (struggles.length === 0) {
      console.log(`[StudentLearning] No active struggle found for strategy outcome`);
      return;
    }
    
    const struggle = struggles[0];
    const attemptedApproaches = new Set(struggle.approachesAttempted || []);
    const successfulApproaches = new Set(struggle.successfulApproaches || []);
    
    attemptedApproaches.add(outcome.strategy);
    
    if (outcome.wasEffective) {
      successfulApproaches.add(outcome.strategy);
      
      // Check if we should mark as improving
      const newStatus = successfulApproaches.size >= 2 ? 'improving' : 'active';
      
      await db
        .update(recurringStruggles)
        .set({
          approachesAttempted: Array.from(attemptedApproaches),
          successfulApproaches: Array.from(successfulApproaches),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(recurringStruggles.id, struggle.id));
      
      console.log(`[StudentLearning] Strategy ${outcome.strategy} worked! Status: ${newStatus}`);
    } else {
      await db
        .update(recurringStruggles)
        .set({
          approachesAttempted: Array.from(attemptedApproaches),
          updatedAt: new Date(),
        })
        .where(eq(recurringStruggles.id, struggle.id));
      
      console.log(`[StudentLearning] Strategy ${outcome.strategy} attempted but not effective`);
    }
  }
  
  /**
   * Get complete learning context for a student
   * This is what gets injected into Daniela's prompts
   */
  async getStudentLearningContext(
    studentId: string, 
    language: string
  ): Promise<StudentLearningContext> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Get active struggles for this language
    const struggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.language, language),
          or(
            eq(recurringStruggles.status, 'active'),
            eq(recurringStruggles.status, 'improving')
          )
        )
      )
      .orderBy(desc(recurringStruggles.occurrenceCount));
    
    // Get general insights about this student
    const insights = await db
      .select()
      .from(studentInsights)
      .where(
        and(
          eq(studentInsights.studentId, studentId),
          eq(studentInsights.isActive, true),
          or(
            eq(studentInsights.language, language),
            sql`${studentInsights.language} IS NULL`
          )
        )
      )
      .orderBy(desc(studentInsights.confidenceScore));
    
    // Aggregate effective strategies across all struggles
    const effectiveStrategies = new Set<string>();
    const strugglingAreas: string[] = [];
    const recentProgress: string[] = [];
    
    for (const struggle of struggles) {
      if (struggle.successfulApproaches?.length) {
        struggle.successfulApproaches.forEach(s => effectiveStrategies.add(s));
      }
      
      if (struggle.status === 'active' && struggle.occurrenceCount && struggle.occurrenceCount > 2) {
        strugglingAreas.push(`${struggle.struggleArea}: ${struggle.description?.split(':')[0]}`);
      }
      
      if (struggle.status === 'improving') {
        recentProgress.push(`Improving at: ${struggle.description?.split(':')[0]}`);
      }
    }
    
    return {
      struggles: struggles.slice(0, 10),
      insights: insights.slice(0, 10),
      effectiveStrategies: Array.from(effectiveStrategies),
      strugglingAreas: strugglingAreas.slice(0, 5),
      recentProgress: recentProgress.slice(0, 5),
    };
  }
  
  /**
   * Format learning context for injection into Daniela's prompt
   * 
   * IMPORTANT: Keeps output concise to avoid prompt bloat.
   * - Max ~500 chars total to stay high-signal
   * - Truncates individual items to 60 chars
   * - Only includes highest-priority items
   */
  formatContextForPrompt(context: StudentLearningContext): string {
    const MAX_TOTAL_CHARS = 500;
    const MAX_ITEM_CHARS = 60;
    const lines: string[] = [];
    
    // Helper to truncate individual items
    const truncate = (s: string, max: number = MAX_ITEM_CHARS) => 
      s.length > max ? s.substring(0, max - 3) + '...' : s;
    
    // Only include if there's meaningful content
    const hasContent = context.strugglingAreas.length > 0 || 
                       context.effectiveStrategies.length > 0 ||
                       context.struggles.some(s => s.status === 'active' && (s.occurrenceCount || 0) > 1);
    
    if (!hasContent) return '';
    
    lines.push('');
    lines.push('[STUDENT LEARNING PROFILE]');
    
    // Top 2 persistent struggles (highest priority)
    const topStruggles = context.struggles
      .filter(s => s.status === 'active' && (s.occurrenceCount || 0) > 1)
      .sort((a, b) => (b.occurrenceCount || 0) - (a.occurrenceCount || 0))
      .slice(0, 2);
    
    if (topStruggles.length > 0) {
      lines.push('Struggles:');
      topStruggles.forEach(s => {
        const desc = s.description?.split(':')[0] || 'Unknown';
        lines.push(`  - ${truncate(desc)} (${s.occurrenceCount}x)`);
      });
    }
    
    // Top 2 effective strategies
    if (context.effectiveStrategies.length > 0) {
      const strategies = context.effectiveStrategies.slice(0, 2);
      lines.push('Works: ' + strategies.map(s => s.replace(/_/g, ' ')).join(', '));
    }
    
    // One progress note if improving
    if (context.recentProgress.length > 0) {
      lines.push('Progress: ' + truncate(context.recentProgress[0]));
    }
    
    const result = lines.join('\n');
    
    // Final safeguard: truncate entire output if somehow exceeded
    if (result.length > MAX_TOTAL_CHARS) {
      return result.substring(0, MAX_TOTAL_CHARS - 3) + '...';
    }
    
    return result;
  }
  
  /**
   * Record a learning style insight about a student
   */
  async recordInsight(
    studentId: string,
    insightType: string,
    insight: string,
    evidence: string,
    language?: string
  ): Promise<StudentInsight> {
    // Check for existing similar insight
    const existing = await db
      .select()
      .from(studentInsights)
      .where(
        and(
          eq(studentInsights.studentId, studentId),
          eq(studentInsights.insightType, insightType),
          ilike(studentInsights.insight, `%${insight.substring(0, 50)}%`)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Reinforce existing insight
      const [updated] = await db
        .update(studentInsights)
        .set({
          confidenceScore: sql`LEAST(${studentInsights.confidenceScore} + 0.1, 1.0)`,
          observationCount: sql`${studentInsights.observationCount} + 1`,
          evidence: `${existing[0].evidence}\n---\n${evidence}`.slice(0, 2000),
          updatedAt: new Date(),
        })
        .where(eq(studentInsights.id, existing[0].id))
        .returning();
      
      console.log(`[StudentLearning] Reinforced insight: ${insightType} (confidence: ${updated.confidenceScore})`);
      return updated;
    }
    
    // Create new insight
    const [created] = await db
      .insert(studentInsights)
      .values({
        studentId,
        language: language || null,
        insightType,
        insight,
        evidence,
        confidenceScore: 0.5,
        observationCount: 1,
        isActive: true,
      })
      .returning();
    
    console.log(`[StudentLearning] Created insight: ${insightType} - ${insight.substring(0, 50)}`);
    return created;
  }
  
  /**
   * Mark a struggle as resolved
   */
  async resolveStruggle(struggleId: string, resolutionNotes?: string): Promise<void> {
    await db
      .update(recurringStruggles)
      .set({
        status: 'resolved',
        updatedAt: new Date(),
      })
      .where(eq(recurringStruggles.id, struggleId));
    
    console.log(`[StudentLearning] Resolved struggle: ${struggleId}`);
  }
  
  /**
   * Get teaching strategy recommendations based on student history
   */
  async getStrategyRecommendations(
    studentId: string,
    language: string,
    errorCategory: string
  ): Promise<{ recommended: string[]; avoid: string[] }> {
    const struggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.language, language)
        )
      );
    
    const successfulCount: Record<string, number> = {};
    const attemptedCount: Record<string, number> = {};
    
    for (const struggle of struggles) {
      for (const strategy of (struggle.approachesAttempted || [])) {
        attemptedCount[strategy] = (attemptedCount[strategy] || 0) + 1;
      }
      for (const strategy of (struggle.successfulApproaches || [])) {
        successfulCount[strategy] = (successfulCount[strategy] || 0) + 1;
      }
    }
    
    // Calculate success rates
    const successRates: Array<{ strategy: string; rate: number; attempted: number }> = [];
    for (const strategy of Object.keys(attemptedCount)) {
      const attempted = attemptedCount[strategy];
      const successful = successfulCount[strategy] || 0;
      successRates.push({
        strategy,
        rate: attempted > 0 ? successful / attempted : 0,
        attempted,
      });
    }
    
    // Sort by success rate (with minimum attempts threshold)
    successRates.sort((a, b) => {
      if (a.attempted < 2 && b.attempted >= 2) return 1;
      if (b.attempted < 2 && a.attempted >= 2) return -1;
      return b.rate - a.rate;
    });
    
    // Top 3 recommended (success rate > 50% and used at least twice)
    const recommended = successRates
      .filter(s => s.rate >= 0.5 && s.attempted >= 2)
      .slice(0, 3)
      .map(s => s.strategy);
    
    // Strategies to avoid (used 3+ times with < 30% success)
    const avoid = successRates
      .filter(s => s.rate < 0.3 && s.attempted >= 3)
      .map(s => s.strategy);
    
    return { recommended, avoid };
  }
}

export const studentLearningService = new StudentLearningService();
