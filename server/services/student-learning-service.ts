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
  predictedStruggles,
  userMotivationAlerts,
  pedagogicalInsights,
  learnerPersonalFacts,
  hiveSnapshots,
  tutorSessions,
  type RecurringStruggle,
  type StudentInsight,
  type PredictedStruggle,
  type UserMotivationAlert,
  type LearnerPersonalFact,
} from '@shared/schema';
import { eq, and, desc, sql, gte, ilike, or, count, ne } from 'drizzle-orm';
import { storage } from '../storage';
import { neuralNetworkSync } from './neural-network-sync';

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

// ============================================================
// EXPORTED UTILITY FUNCTIONS FOR DEDUPLICATION
// These are used by the service and can be imported for testing
// ============================================================

// CJK Unicode ranges for Japanese, Mandarin, and Korean
// Preserves these while still normalizing Latin scripts
const CJK_RANGES = [
  '\u4e00-\u9fff',   // CJK Unified Ideographs (Chinese/Japanese Kanji)
  '\u3040-\u309f',   // Hiragana (Japanese)
  '\u30a0-\u30ff',   // Katakana (Japanese)
  '\uac00-\ud7af',   // Hangul Syllables (Korean)
  '\u1100-\u11ff',   // Hangul Jamo (Korean)
  '\u3400-\u4dbf',   // CJK Extension A
].join('');

// Pattern to match allowed characters: Latin alphanumeric, spaces, and CJK
const ALLOWED_CHARS_PATTERN = new RegExp(`[^a-z0-9 ${CJK_RANGES}]`, 'g');

/**
 * Generate trigrams from a string for similarity matching
 * e.g., "hello" -> ["hel", "ell", "llo"]
 * Supports CJK characters (Japanese, Mandarin, Korean)
 */
export function generateTrigrams(text: string): Set<string> {
  const normalized = text.toLowerCase().trim().replace(ALLOWED_CHARS_PATTERN, '');
  const trigrams = new Set<string>();
  for (let i = 0; i <= normalized.length - 3; i++) {
    trigrams.add(normalized.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Calculate trigram cosine similarity between two strings
 * Returns value between 0 (no similarity) and 1 (identical)
 */
export function trigramSimilarity(a: string, b: string): number {
  const trigramsA = generateTrigrams(a);
  const trigramsB = generateTrigrams(b);
  
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;
  
  // Calculate intersection (dot product for binary vectors)
  let dotProduct = 0;
  for (const trigram of trigramsA) {
    if (trigramsB.has(trigram)) dotProduct++;
  }
  
  // Cosine similarity: dot product / (magnitude A * magnitude B)
  const magnitudeA = Math.sqrt(trigramsA.size);
  const magnitudeB = Math.sqrt(trigramsB.size);
  
  return dotProduct / (magnitudeA * magnitudeB);
}

// Pattern to remove punctuation but keep CJK characters
const PUNCTUATION_PATTERN = new RegExp(`[^\\w\\s${CJK_RANGES}]`, 'g');

/**
 * Normalize a fact string for fingerprinting
 * Strips diacritics from Latin scripts, lowercases, removes punctuation
 * Preserves CJK characters (Japanese, Mandarin, Korean)
 */
export function normalizeForFingerprint(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics (Latin only)
    .replace(PUNCTUATION_PATTERN, '') // Remove punctuation, keep CJK
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similarity threshold for semantic deduplication */
export const SIMILARITY_THRESHOLD = 0.82;

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

export interface BreakthroughInfo {
  struggleArea: string;
  description: string;
  occurrenceCount: number;
  successfulStrategies: string[];
  createdAt: Date;
}

export interface StudentLearningContext {
  struggles: RecurringStruggle[];
  insights: StudentInsight[];
  personalFacts: LearnerPersonalFact[];
  effectiveStrategies: string[];
  strugglingAreas: string[];
  recentProgress: string[];
  recentBreakthroughs: BreakthroughInfo[];  // Celebrate mastered struggles
}

// Personal fact types for categorization
export const PERSONAL_FACT_TYPES = [
  'life_event',      // "Getting married in June"
  'personal_detail', // "Works as a nurse"
  'goal',            // "Want to be conversational for trip"
  'preference',      // "Prefers morning practice sessions"
  'relationship',    // "Has a sister named Maria"
  'travel',          // "Planning trip to Madrid"
  'work',            // "Started new job at hospital"
  'family',          // "Just had a baby"
  'hobby',           // "Loves playing guitar"
] as const;

export type PersonalFactType = typeof PERSONAL_FACT_TYPES[number];

export interface PersonalFactInput {
  studentId: string;
  factType: PersonalFactType;
  fact: string;
  context?: string;
  language?: string;
  relevantDate?: Date;
  sourceConversationId?: string;
  confidenceScore?: number; // 0-1, defaults to 0.8 if not provided
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
      
      // Trigger root cause analysis when threshold exceeded (5+ occurrences)
      const ROOT_CAUSE_THRESHOLD = 5;
      if (updated.occurrenceCount && updated.occurrenceCount >= ROOT_CAUSE_THRESHOLD && !updated.rootCauseAnalysis) {
        try {
          // Get user's native language for L1 interference analysis
          const user = await storage.getUser(event.studentId);
          const nativeLanguage = user?.nativeLanguage || 'english';
          
          const rootCauseResult = this.analyzeRootCause(
            nativeLanguage,
            event.language,
            event.errorCategory,
            event.specificError
          );
          
          // Store root cause analysis in the struggle record
          await db
            .update(recurringStruggles)
            .set({
              rootCauseAnalysis: JSON.stringify(rootCauseResult),
              updatedAt: new Date(),
            })
            .where(eq(recurringStruggles.id, updated.id));
          
          console.log(`[StudentLearning] Root cause analysis triggered for ${event.specificError}: ${rootCauseResult.rootCause}`);
        } catch (err: any) {
          console.warn(`[StudentLearning] Root cause analysis failed:`, err.message);
        }
      }
      
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
    // Find the related struggle (include 'improving' to allow breakthrough detection)
    const struggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, outcome.studentId),
          eq(recurringStruggles.language, outcome.language),
          eq(recurringStruggles.struggleArea, outcome.struggleArea),
          or(
            eq(recurringStruggles.status, 'active'),
            eq(recurringStruggles.status, 'improving')
          )
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
      
      // BREAKTHROUGH DETECTION: Auto-resolve when 3+ successful strategies
      // This indicates the student has mastered the concept
      if (successfulApproaches.size >= 3) {
        // First, persist the successful strategy to the database
        // This ensures the snapshot includes the winning strategy
        await db
          .update(recurringStruggles)
          .set({
            approachesAttempted: Array.from(attemptedApproaches),
            successfulApproaches: Array.from(successfulApproaches),
            updatedAt: new Date(),
          })
          .where(eq(recurringStruggles.id, struggle.id));
        
        // Then trigger breakthrough celebration by resolving the struggle
        await this.resolveStruggle(struggle.id, `Mastered after ${successfulApproaches.size} successful strategies: ${Array.from(successfulApproaches).join(', ')}`);
        console.log(`[StudentLearning] BREAKTHROUGH! Student mastered ${struggle.struggleArea} with ${successfulApproaches.size} successful strategies`);
        return;
      }
      
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
    
    // Get personal facts about this student (permanent memories)
    const personalFacts = await db
      .select()
      .from(learnerPersonalFacts)
      .where(
        and(
          eq(learnerPersonalFacts.studentId, studentId),
          eq(learnerPersonalFacts.isActive, true),
          or(
            eq(learnerPersonalFacts.language, language),
            sql`${learnerPersonalFacts.language} IS NULL`
          )
        )
      )
      .orderBy(desc(learnerPersonalFacts.lastMentionedAt));
    
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
    
    // Get recent breakthroughs for celebration
    const recentBreakthroughs = await this.getRecentBreakthroughs(studentId, language);
    
    return {
      struggles: struggles.slice(0, 10),
      insights: insights.slice(0, 10),
      personalFacts: personalFacts.slice(0, 10),
      effectiveStrategies: Array.from(effectiveStrategies),
      strugglingAreas: strugglingAreas.slice(0, 5),
      recentProgress: recentProgress.slice(0, 5),
      recentBreakthroughs,
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
                       context.personalFacts.length > 0 ||
                       context.struggles.some(s => s.status === 'active' && (s.occurrenceCount || 0) > 1) ||
                       context.recentBreakthroughs?.length > 0;
    
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
    
    // BREAKTHROUGH CELEBRATION: Recently mastered struggles
    // This enables Daniela to naturally celebrate student achievements
    if (context.recentBreakthroughs && context.recentBreakthroughs.length > 0) {
      const latestBreakthrough = context.recentBreakthroughs[0];
      const hoursSince = (Date.now() - new Date(latestBreakthrough.createdAt).getTime()) / (1000 * 60 * 60);
      
      if (hoursSince < 24) {
        lines.push('');
        lines.push('[BREAKTHROUGH - CELEBRATE!]');
        lines.push(`Student just mastered: ${truncate(latestBreakthrough.struggleArea)}`);
        lines.push(`After ${latestBreakthrough.occurrenceCount}x practice sessions, they overcame this challenge!`);
        if (latestBreakthrough.successfulStrategies.length > 0) {
          lines.push(`What worked: ${latestBreakthrough.successfulStrategies.slice(0, 2).join(', ')}`);
        }
        lines.push('');
        lines.push('ACTION: Genuinely celebrate this achievement! Reference how far they\'ve come.');
      }
    }
    
    // Personal facts (things student shared about their life)
    if (context.personalFacts.length > 0) {
      const topFacts = context.personalFacts.slice(0, 3);
      lines.push('Remembers:');
      topFacts.forEach(f => {
        const dateNote = f.relevantDate && new Date(f.relevantDate) > new Date()
          ? ` (${new Date(f.relevantDate).toLocaleDateString()})`
          : '';
        lines.push(`  - ${truncate(f.fact)}${dateNote}`);
      });
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
   * Mark a struggle as resolved and record a breakthrough
   * Returns the resolved struggle for breakthrough celebration
   */
  async resolveStruggle(struggleId: string, resolutionNotes?: string): Promise<RecurringStruggle | null> {
    // Get the struggle first for breakthrough recording
    const [struggle] = await db
      .select()
      .from(recurringStruggles)
      .where(eq(recurringStruggles.id, struggleId))
      .limit(1);
    
    if (!struggle) {
      console.warn(`[StudentLearning] Struggle not found: ${struggleId}`);
      return null;
    }
    
    // Calculate time to mastery in days for velocity tracking
    const now = new Date();
    const createdAt = struggle.createdAt;
    const timeToMasteryDays = Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    // Update struggle status with velocity metrics
    const [resolved] = await db
      .update(recurringStruggles)
      .set({
        status: 'resolved',
        resolvedAt: now,
        resolutionNotes: resolutionNotes || null,
        timeToMasteryDays,
        updatedAt: now,
      })
      .where(eq(recurringStruggles.id, struggleId))
      .returning();
    
    console.log(`[StudentLearning] Velocity: ${struggle.struggleArea} mastered in ${timeToMasteryDays} days`);
    
    // Record breakthrough in hiveSnapshots for Wren awareness
    await this.recordBreakthrough({
      studentId: struggle.studentId,
      language: struggle.language,
      struggleArea: struggle.struggleArea,
      description: struggle.description || '',
      occurrenceCount: struggle.occurrenceCount || 1,
      successfulStrategies: struggle.successfulApproaches || [],
      resolutionNotes,
    });
    
    console.log(`[StudentLearning] Resolved struggle: ${struggleId} - recorded breakthrough`);
    return resolved;
  }
  
  /**
   * Record a breakthrough in hiveSnapshots for Wren awareness and celebration
   */
  private async recordBreakthrough(params: {
    studentId: string;
    language: string;
    struggleArea: string;
    description: string;
    occurrenceCount: number;
    successfulStrategies: string[];
    resolutionNotes?: string;
  }): Promise<void> {
    const { studentId, language, struggleArea, description, occurrenceCount, successfulStrategies, resolutionNotes } = params;
    
    const content = [
      `Breakthrough: Student mastered "${struggleArea}"`,
      `After ${occurrenceCount} encounters, the student has overcome this challenge.`,
      `Description: ${description}`,
      successfulStrategies.length > 0 
        ? `What worked: ${successfulStrategies.join(', ')}`
        : '',
      resolutionNotes ? `Notes: ${resolutionNotes}` : '',
    ].filter(Boolean).join('\n');
    
    await db.insert(hiveSnapshots).values({
      snapshotType: 'breakthrough',
      userId: studentId,
      language,
      content,
      importance: occurrenceCount >= 5 ? 'high' : occurrenceCount >= 3 ? 'medium' : 'low',
      metadata: {
        struggleArea,
        description,
        occurrenceCount,
        successfulStrategies,
        resolutionNotes,
      },
    });
    
    console.log(`[StudentLearning] Recorded breakthrough for ${language}/${struggleArea}`);
  }
  
  /**
   * Get recent breakthroughs for a student (for celebration injection)
   * Returns breakthroughs from the last 24 hours that haven't been celebrated
   */
  async getRecentBreakthroughs(studentId: string, language: string): Promise<Array<{
    struggleArea: string;
    description: string;
    occurrenceCount: number;
    successfulStrategies: string[];
    createdAt: Date;
  }>> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const breakthroughs = await db
      .select()
      .from(hiveSnapshots)
      .where(
        and(
          eq(hiveSnapshots.snapshotType, 'breakthrough'),
          eq(hiveSnapshots.userId, studentId),
          eq(hiveSnapshots.language, language),
          gte(hiveSnapshots.createdAt, oneDayAgo)
        )
      )
      .orderBy(desc(hiveSnapshots.createdAt))
      .limit(3);
    
    return breakthroughs.map(b => ({
      struggleArea: (b.metadata as any)?.struggleArea || 'unknown',
      description: (b.metadata as any)?.description || '',
      occurrenceCount: (b.metadata as any)?.occurrenceCount || 1,
      successfulStrategies: (b.metadata as any)?.successfulStrategies || [],
      createdAt: b.createdAt,
    }));
  }
  
  /**
   * CROSS-SESSION CONTEXT: Get recent session history for continuity
   * Returns topics covered, session summaries, and deferred topics from recent sessions
   * This enables Daniela to reference previous sessions naturally
   */
  async getCrossSessionContext(studentId: string, limit: number = 3): Promise<{
    recentSessions: Array<{
      date: Date;
      summary: string | null;
      topicsCovered: string[];
      deferredTopics: string[];
      tutorNotes: string | null;
    }>;
    allRecentTopics: string[];
    pendingTopics: string[];  // Topics deferred but not yet covered
  }> {
    // Get recent completed sessions for this student
    const sessions = await db
      .select({
        createdAt: tutorSessions.createdAt,
        sessionSummary: tutorSessions.sessionSummary,
        topicsCoveredJson: tutorSessions.topicsCoveredJson,
        deferredTopicsJson: tutorSessions.deferredTopicsJson,
        tutorNotes: tutorSessions.tutorNotes,
      })
      .from(tutorSessions)
      .where(
        and(
          eq(tutorSessions.userId, studentId),
          eq(tutorSessions.status, 'completed')
        )
      )
      .orderBy(desc(tutorSessions.createdAt))
      .limit(limit);
    
    // Parse JSON fields and collect topics
    const allTopics = new Set<string>();
    const pendingTopicsSet = new Set<string>();
    const coveredTopicsSet = new Set<string>();
    
    // Helper to safely parse topic JSON (handles strings, objects, malformed data)
    const safeParseTopics = (json: string | null): string[] => {
      if (!json) return [];
      try {
        const parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) return [];
        
        // Handle both string arrays and object arrays (e.g., { id, title })
        return parsed.map((t: any) => {
          if (typeof t === 'string') return t;
          if (typeof t === 'object' && t !== null) {
            return t.title || t.name || t.id || String(t);
          }
          return String(t);
        }).filter((t): t is string => typeof t === 'string' && t.length > 0);
      } catch (err) {
        console.warn('[CrossSession] Failed to parse topic JSON:', err);
        return [];
      }
    };
    
    const recentSessions = sessions.map(s => {
      const topicsCovered = safeParseTopics(s.topicsCoveredJson);
      const deferredTopics = safeParseTopics(s.deferredTopicsJson);
      
      // Track all topics (using string values for proper Set deduplication)
      topicsCovered.forEach((t: string) => {
        allTopics.add(t);
        coveredTopicsSet.add(t);
      });
      deferredTopics.forEach((t: string) => {
        allTopics.add(t);
        pendingTopicsSet.add(t);
      });
      
      return {
        date: s.createdAt,
        summary: s.sessionSummary,
        topicsCovered,
        deferredTopics,
        tutorNotes: s.tutorNotes,
      };
    });
    
    // Pending topics are those deferred but not yet covered (string comparison works now)
    const pendingTopics = Array.from(pendingTopicsSet).filter(t => !coveredTopicsSet.has(t));
    
    return {
      recentSessions,
      allRecentTopics: Array.from(allTopics),
      pendingTopics,
    };
  }
  
  /**
   * Format cross-session context for prompt injection
   * Concise summary of recent learning for continuity
   */
  formatCrossSessionContext(context: Awaited<ReturnType<StudentLearningService['getCrossSessionContext']>>): string {
    const lines: string[] = [];
    
    if (context.recentSessions.length === 0) {
      return '';
    }
    
    // Only include if there's meaningful content
    const hasMeaningfulContent = context.recentSessions.some(s => s.summary || s.topicsCovered.length > 0);
    if (!hasMeaningfulContent) return '';
    
    lines.push('');
    lines.push('[RECENT SESSION HISTORY]');
    
    // Most recent session summary
    const latestWithSummary = context.recentSessions.find(s => s.summary);
    if (latestWithSummary) {
      const daysSince = Math.floor((Date.now() - new Date(latestWithSummary.date).getTime()) / (1000 * 60 * 60 * 24));
      const timeAgo = daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince} days ago`;
      lines.push(`Last session (${timeAgo}): ${latestWithSummary.summary?.substring(0, 100)}...`);
    }
    
    // Topics covered across sessions
    if (context.allRecentTopics.length > 0) {
      lines.push(`Recent topics: ${context.allRecentTopics.slice(0, 5).join(', ')}`);
    }
    
    // Pending topics (deferred from previous sessions)
    if (context.pendingTopics.length > 0) {
      lines.push(`Pending from before: ${context.pendingTopics.slice(0, 3).join(', ')}`);
    }
    
    // Tutor notes from recent session
    const latestWithNotes = context.recentSessions.find(s => s.tutorNotes);
    if (latestWithNotes?.tutorNotes) {
      lines.push(`Your notes: ${latestWithNotes.tutorNotes.substring(0, 80)}...`);
    }
    
    return lines.join('\n');
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
  
  // ============================================================
  // PREDICTIVE TEACHING SYSTEM
  // Dec 2024 Emergent Intelligence Upgrade
  // ============================================================
  
  /**
   * Learning progressions: common patterns of what struggles tend to follow others
   * Built from cross-student analysis and linguistic research
   */
  private static readonly LEARNING_PROGRESSIONS: Record<string, string[]> = {
    // Spanish progressions
    'grammar:ser_estar': ['grammar:adjective_agreement', 'grammar:estar_emotions'],
    'grammar:verb_conjugation': ['grammar:tense_selection', 'grammar:irregular_verbs'],
    'grammar:tense_selection': ['grammar:subjunctive_triggers', 'grammar:mood_usage'],
    'grammar:subjunctive_triggers': ['grammar:subjunctive_imperfect', 'grammar:conditional_si_clauses'],
    'grammar:article_usage': ['grammar:definite_vs_indefinite', 'grammar:zero_article_cases'],
    'grammar:por_para': ['grammar:preposition_choice', 'grammar:verbs_with_prepositions'],
    'vocabulary:false_cognates': ['vocabulary:semantic_precision', 'vocabulary:word_families'],
    'pronunciation:stress_patterns': ['pronunciation:rhythm', 'pronunciation:intonation'],
    
    // General progressions
    'comprehension:listening_speed': ['comprehension:accent_variation', 'comprehension:connected_speech'],
    'cultural:formality_levels': ['cultural:pragmatics', 'cultural:register_switching'],
  };
  
  /**
   * Predict upcoming struggles for a student based on:
   * 1. Their current struggles (what typically follows)
   * 2. Cross-student patterns (what students at similar levels struggle with)
   * 3. Natural language learning progressions
   */
  async predictUpcomingStruggles(
    studentId: string,
    language: string,
    proficiencyLevel?: string
  ): Promise<Array<{
    predictedStruggle: string;
    reason: string;
    confidence: number;
    preventiveStrategy: string;
  }>> {
    const predictions: Array<{
      predictedStruggle: string;
      reason: string;
      confidence: number;
      preventiveStrategy: string;
    }> = [];
    
    // Get current struggles for this student
    const currentStruggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.language, language),
          eq(recurringStruggles.status, 'active')
        )
      )
      .orderBy(desc(recurringStruggles.occurrenceCount));
    
    // Prediction source 1: Known learning progressions
    for (const struggle of currentStruggles.slice(0, 5)) {
      const key = `${struggle.struggleArea}:${this.extractSubcategory(struggle.description || '')}`;
      const nextStruggles = StudentLearningService.LEARNING_PROGRESSIONS[key];
      
      if (nextStruggles) {
        for (const nextStruggle of nextStruggles) {
          const [area, subcategory] = nextStruggle.split(':');
          
          // Check if student already has this struggle
          const alreadyHas = currentStruggles.some(s => 
            s.struggleArea === area && 
            s.description?.toLowerCase().includes(subcategory.replace(/_/g, ' '))
          );
          
          if (!alreadyHas) {
            predictions.push({
              predictedStruggle: nextStruggle,
              reason: `Based on current struggle with ${struggle.description?.split(':')[0] || struggle.struggleArea}`,
              confidence: 0.75,
              preventiveStrategy: this.getPreventiveStrategy(nextStruggle),
            });
          }
        }
      }
    }
    
    // Prediction source 2: Cross-student patterns (aggregate analysis)
    const crossStudentPredictions = await this.getCrossStudentPredictions(language, proficiencyLevel);
    
    for (const csp of crossStudentPredictions) {
      // Don't duplicate predictions
      const exists = predictions.some(p => p.predictedStruggle === csp.predictedStruggle);
      if (!exists) {
        // Check if student already has this struggle
        const alreadyHas = currentStruggles.some(s => 
          `${s.struggleArea}:${this.extractSubcategory(s.description || '')}` === csp.predictedStruggle
        );
        
        if (!alreadyHas) {
          predictions.push(csp);
        }
      }
    }
    
    // Sort by confidence and limit to top 5
    return predictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5);
  }
  
  /**
   * Extract subcategory from struggle description
   */
  private extractSubcategory(description: string): string {
    const parts = description.toLowerCase().split(':');
    if (parts.length > 1) {
      return parts[0].trim().replace(/\s+/g, '_');
    }
    // Try to match against known subcategories
    const descLower = description.toLowerCase();
    for (const [category, subs] of Object.entries(ERROR_TAXONOMY)) {
      for (const sub of subs) {
        if (descLower.includes(sub.replace(/_/g, ' '))) {
          return sub;
        }
      }
    }
    return descLower.replace(/\s+/g, '_').substring(0, 30);
  }
  
  /**
   * Get preventive teaching strategy for a predicted struggle
   */
  private getPreventiveStrategy(struggle: string): string {
    const [area] = struggle.split(':');
    
    const strategyMap: Record<string, string> = {
      'grammar': 'explicit_rule with visual_timeline',
      'pronunciation': 'slow_pronunciation with repetition_drill',
      'vocabulary': 'real_world_context with chunking',
      'cultural': 'role_play with storytelling',
      'comprehension': 'chunking with spaced_repetition',
    };
    
    return strategyMap[area] || 'explicit_rule';
  }
  
  /**
   * Analyze cross-student patterns to find common struggles
   * at similar proficiency levels
   */
  private async getCrossStudentPredictions(
    language: string,
    proficiencyLevel?: string
  ): Promise<Array<{
    predictedStruggle: string;
    reason: string;
    confidence: number;
    preventiveStrategy: string;
  }>> {
    // Get most common struggles across all students for this language
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const allStruggles = await db
      .select({
        struggleArea: recurringStruggles.struggleArea,
        description: recurringStruggles.description,
        count: sql<number>`count(*)`,
        avgOccurrence: sql<number>`avg(${recurringStruggles.occurrenceCount})`,
      })
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.language, language),
          eq(recurringStruggles.status, 'active'),
          gte(recurringStruggles.updatedAt, thirtyDaysAgo)
        )
      )
      .groupBy(recurringStruggles.struggleArea, recurringStruggles.description)
      .orderBy(sql`count(*) DESC`)
      .limit(10);
    
    return allStruggles.slice(0, 3).map(s => ({
      predictedStruggle: `${s.struggleArea}:${this.extractSubcategory(s.description || '')}`,
      reason: `Common struggle among ${s.count} students learning ${language}`,
      confidence: Math.min(0.6, 0.3 + (s.count as number * 0.05)),
      preventiveStrategy: this.getPreventiveStrategy(s.struggleArea || 'grammar'),
    }));
  }
  
  /**
   * Format predictions for Daniela's prompt injection
   */
  formatPredictionsForPrompt(
    predictions: Array<{
      predictedStruggle: string;
      reason: string;
      confidence: number;
      preventiveStrategy: string;
    }>
  ): string {
    if (predictions.length === 0) return '';
    
    const lines: string[] = [];
    lines.push('');
    lines.push('[PREDICTIVE TEACHING]');
    lines.push('Anticipated struggles (address proactively):');
    
    for (const p of predictions.slice(0, 3)) {
      const struggle = p.predictedStruggle.replace(/_/g, ' ').replace(':', ': ');
      lines.push(`  • ${struggle} (${Math.round(p.confidence * 100)}%)`);
      lines.push(`    → Try: ${p.preventiveStrategy.replace(/_/g, ' ')}`);
    }
    
    return lines.join('\n');
  }
  
  // ============================================================
  // CROSS-STUDENT PATTERN SYNTHESIS
  // Dec 2024 Emergent Intelligence Upgrade
  // ============================================================
  
  /**
   * Universal teaching insights derived from aggregate student patterns
   */
  async synthesizeCrossStudentPatterns(
    language: string
  ): Promise<{
    universalInsights: Array<{
      insight: string;
      confidence: number;
      evidenceCount: number;
      recommendedApproach: string;
    }>;
    difficultyCurve: Array<{
      concept: string;
      averageAttempts: number;
      commonMistakes: string[];
    }>;
    effectiveSequences: Array<{
      fromConcept: string;
      toConcept: string;
      successRate: number;
    }>;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Get all struggles with teaching outcomes
    const allStruggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.language, language),
          gte(recurringStruggles.createdAt, thirtyDaysAgo)
        )
      );
    
    // Analyze strategy effectiveness across all students
    const strategyStats: Record<string, { success: number; total: number }> = {};
    const conceptDifficulty: Record<string, { attempts: number; resolved: number; mistakes: string[] }> = {};
    
    for (const struggle of allStruggles) {
      const concept = `${struggle.struggleArea}:${this.extractSubcategory(struggle.description || '')}`;
      
      // Track difficulty curve
      if (!conceptDifficulty[concept]) {
        conceptDifficulty[concept] = { attempts: 0, resolved: 0, mistakes: [] };
      }
      conceptDifficulty[concept].attempts += struggle.occurrenceCount || 1;
      if (struggle.status === 'resolved') {
        conceptDifficulty[concept].resolved++;
      }
      if (struggle.specificExamples) {
        const examples = struggle.specificExamples.split('\n').slice(0, 2);
        conceptDifficulty[concept].mistakes.push(...examples);
      }
      
      // Track strategy effectiveness
      for (const strategy of (struggle.approachesAttempted || [])) {
        if (!strategyStats[strategy]) {
          strategyStats[strategy] = { success: 0, total: 0 };
        }
        strategyStats[strategy].total++;
        
        if ((struggle.successfulApproaches || []).includes(strategy)) {
          strategyStats[strategy].success++;
        }
      }
    }
    
    // Generate universal insights from strategy analysis
    const universalInsights = Object.entries(strategyStats)
      .filter(([_, stats]) => stats.total >= 3) // Minimum sample size
      .map(([strategy, stats]) => ({
        insight: `${strategy.replace(/_/g, ' ')} works ${Math.round((stats.success / stats.total) * 100)}% of the time`,
        confidence: stats.total >= 10 ? 0.85 : 0.65,
        evidenceCount: stats.total,
        recommendedApproach: stats.success / stats.total >= 0.6 
          ? 'Use as primary strategy' 
          : 'Use as backup or combine with other approaches',
      }))
      .sort((a, b) => b.evidenceCount - a.evidenceCount)
      .slice(0, 10);
    
    // Generate difficulty curve
    const difficultyCurve = Object.entries(conceptDifficulty)
      .map(([concept, data]) => ({
        concept,
        averageAttempts: data.attempts / Math.max(1, data.resolved || 1),
        commonMistakes: Array.from(new Set(data.mistakes)).slice(0, 3),
      }))
      .sort((a, b) => b.averageAttempts - a.averageAttempts)
      .slice(0, 10);
    
    // Extract effective learning sequences from progressions
    const effectiveSequences = Object.entries(StudentLearningService.LEARNING_PROGRESSIONS)
      .map(([from, toList]) => ({
        fromConcept: from,
        toConcept: toList[0],
        successRate: 0.7, // Base rate, would be refined with actual data
      }))
      .slice(0, 10);
    
    // Auto-share significant patterns with Wren for development insights
    // High-confidence universal insights inform feature development
    const highConfidenceInsights = universalInsights.filter(i => i.confidence >= 0.8 && i.evidenceCount >= 5);
    if (highConfidenceInsights.length > 0) {
      try {
        const topInsight = highConfidenceInsights[0];
        await neuralNetworkSync.shareInsightWithWren({
          source: 'pattern_observation',
          title: `Cross-Student Pattern: ${topInsight.insight}`,
          content: `Based on ${topInsight.evidenceCount} student interactions in ${language}. ${topInsight.recommendedApproach}`,
          developmentRelevance: 'Validated teaching strategy that could inform UI/UX or feature development',
          suggestedCategory: 'pattern',
        });
        console.log(`[StudentLearning] Shared cross-student pattern with Wren: ${topInsight.insight}`);
      } catch (error) {
        console.error('[StudentLearning] Failed to share pattern with Wren:', error);
      }
    }
    
    return {
      universalInsights,
      difficultyCurve,
      effectiveSequences,
    };
  }
  
  // ============================================================
  // ROOT CAUSE ANALYSIS
  // Dec 2024 Emergent Intelligence Upgrade
  // ============================================================
  
  /**
   * L1 (native language) interference patterns by language pair
   * These cause predictable errors that need different treatment than conceptual gaps
   */
  private static readonly L1_INTERFERENCE_PATTERNS: Record<string, string[]> = {
    'english->spanish': [
      'ser_estar (no "be" distinction in English)',
      'por_para (both = "for" in English)',
      'adjective_placement (English: before noun)',
      'article_overuse (English uses "the" more)',
      'subjunctive_triggers (rare in English)',
      'double_negatives (ungrammatical in English)',
      'reflexive_verbs (less common in English)',
    ],
    'english->french': [
      'gendered_nouns (no grammatical gender in English)',
      'adjective_agreement (no agreement in English)',
      'tu_vous_distinction (formal/informal "you")',
      'passé_composé_vs_imparfait (simple past covers both in English)',
      'liaison_elision (no equivalent in English)',
    ],
    'english->german': [
      'case_system (no cases in English)',
      'word_order (verb-second in German)',
      'gendered_nouns (no grammatical gender in English)',
      'compound_nouns (separate in English)',
    ],
    'english->japanese': [
      'particles (no equivalent in English)',
      'verb_endings (English uses helper verbs)',
      'keigo_politeness (less stratified in English)',
      'topic_marker (English uses subject prominence)',
    ],
    'english->korean': [
      'honorific_system (minimal in English)',
      'verb_final_order (SVO in English)',
      'particles (no equivalent in English)',
    ],
    'english->chinese': [
      'tones (non-tonal English)',
      'measure_words (no classifiers in English)',
      'aspect_markers (English uses tense more)',
    ],
  };
  
  /**
   * Analyze a struggle to determine if it's L1 interference or conceptual gap
   */
  analyzeRootCause(
    nativeLanguage: string,
    targetLanguage: string,
    struggleArea: string,
    description: string
  ): {
    rootCause: 'l1_interference' | 'conceptual_gap' | 'unclear';
    confidence: number;
    explanation: string;
    teachingImplication: string;
  } {
    const langPair = `${nativeLanguage.toLowerCase()}->${targetLanguage.toLowerCase()}`;
    const patterns = StudentLearningService.L1_INTERFERENCE_PATTERNS[langPair] || [];
    
    const descLower = description.toLowerCase();
    const areaLower = struggleArea.toLowerCase();
    
    // Check if this matches known L1 interference patterns
    for (const pattern of patterns) {
      const patternKeywords = pattern.split(/[\s_()]+/).filter((w: string) => w.length > 2);
      const matchCount = patternKeywords.filter((kw: string) => 
        descLower.includes(kw.toLowerCase()) || areaLower.includes(kw.toLowerCase())
      ).length;
      
      if (matchCount >= 2 || (matchCount >= 1 && patternKeywords.length <= 3)) {
        return {
          rootCause: 'l1_interference',
          confidence: 0.85,
          explanation: `This error pattern is common for ${nativeLanguage} speakers: ${pattern}`,
          teachingImplication: 'Explicitly contrast with L1 patterns. Use comparison_chart and explicit_rule strategies.',
        };
      }
    }
    
    // If error is very basic (articles, basic conjugation) with high occurrence, likely conceptual
    const basicConcepts = ['article', 'basic_conjugation', 'present_tense', 'noun_gender'];
    const isBasic = basicConcepts.some(c => descLower.includes(c) || areaLower.includes(c));
    
    if (isBasic) {
      return {
        rootCause: 'conceptual_gap',
        confidence: 0.7,
        explanation: 'This appears to be a fundamental concept that needs systematic teaching.',
        teachingImplication: 'Build foundation with explicit_rule, then reinforce with spaced_repetition.',
      };
    }
    
    // Check for vocabulary/semantic errors (usually conceptual)
    if (areaLower.includes('vocabulary') || areaLower.includes('word_choice')) {
      return {
        rootCause: 'conceptual_gap',
        confidence: 0.65,
        explanation: 'Vocabulary gaps require exposure and practice, not just L1 comparison.',
        teachingImplication: 'Use real_world_context and chunking to build associations.',
      };
    }
    
    return {
      rootCause: 'unclear',
      confidence: 0.4,
      explanation: 'Unable to determine root cause with available information.',
      teachingImplication: 'Probe student understanding through conversation to clarify.',
    };
  }
  
  /**
   * Get enhanced learning context with predictions and root cause analysis
   */
  async getEnhancedLearningContext(
    studentId: string,
    language: string,
    nativeLanguage: string = 'english'
  ): Promise<{
    basic: StudentLearningContext;
    predictions: Awaited<ReturnType<StudentLearningService['predictUpcomingStruggles']>>;
    rootCauseAnalysis: Array<{
      struggle: string;
      rootCause: 'l1_interference' | 'conceptual_gap' | 'unclear';
      teachingImplication: string;
    }>;
  }> {
    const basic = await this.getStudentLearningContext(studentId, language);
    const predictions = await this.predictUpcomingStruggles(studentId, language);
    
    // Analyze root causes for top struggles
    const rootCauseAnalysis = basic.struggles.slice(0, 5).map(struggle => {
      const analysis = this.analyzeRootCause(
        nativeLanguage,
        language,
        struggle.struggleArea || '',
        struggle.description || ''
      );
      return {
        struggle: struggle.description?.split(':')[0] || 'Unknown',
        rootCause: analysis.rootCause,
        teachingImplication: analysis.teachingImplication,
      };
    });
    
    return { basic, predictions, rootCauseAnalysis };
  }
  
  /**
   * Format enhanced context for Daniela's prompt
   */
  formatEnhancedContextForPrompt(
    enhanced: Awaited<ReturnType<StudentLearningService['getEnhancedLearningContext']>>
  ): string {
    const lines: string[] = [];
    
    // Basic context
    const basicContext = this.formatContextForPrompt(enhanced.basic);
    if (basicContext) lines.push(basicContext);
    
    // Predictions
    const predictionsContext = this.formatPredictionsForPrompt(enhanced.predictions);
    if (predictionsContext) lines.push(predictionsContext);
    
    // Root cause insights (if L1 interference detected)
    const l1Struggles = enhanced.rootCauseAnalysis.filter(r => r.rootCause === 'l1_interference');
    if (l1Struggles.length > 0) {
      lines.push('');
      lines.push('[L1 INTERFERENCE DETECTED]');
      for (const s of l1Struggles.slice(0, 2)) {
        lines.push(`  • ${s.struggle}: ${s.teachingImplication}`);
      }
    }
    
    return lines.join('\n');
  }
  
  // ============================================================
  // MOTIVATION DIP PREDICTION
  // Dec 2024 Emergent Intelligence Upgrade
  // ============================================================
  
  /**
   * Indicators that suggest declining motivation
   */
  private static readonly MOTIVATION_DECLINE_INDICATORS = {
    sessionPattern: {
      decreasing_frequency: 0.3,     // Sessions becoming less frequent
      shorter_duration: 0.25,        // Sessions getting shorter
      time_of_day_shift: 0.1,        // Moving to less optimal times
    },
    interactionPattern: {
      less_elaboration: 0.25,        // Shorter responses
      more_errors: 0.2,              // Error rate increasing
      less_initiative: 0.15,         // Not asking questions
      slower_response: 0.1,          // Taking longer to respond
    },
    emotionalIndicators: {
      frustration_increase: 0.3,     // More negative sentiment
      confidence_decrease: 0.25,     // Less confident answers
      avoidance_behavior: 0.2,       // Skipping harder topics
    },
  };
  
  /**
   * Predict motivation dip based on student interaction patterns
   */
  async predictMotivationDip(
    studentId: string,
    language: string
  ): Promise<{
    riskLevel: 'low' | 'medium' | 'high';
    score: number;
    indicators: string[];
    suggestedInterventions: string[];
  }> {
    const indicators: string[] = [];
    let totalScore = 0;
    
    // Analyze session frequency patterns
    const recentSessions = await db
      .select({
        id: conversations.id,
        createdAt: conversations.createdAt,
        messageCount: sql<number>`(
          SELECT COUNT(*) FROM ${messages} 
          WHERE ${messages.conversationId} = ${conversations.id}
        )`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, studentId),
          eq(conversations.language, language),
          gte(conversations.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
        )
      )
      .orderBy(desc(conversations.createdAt))
      .limit(20);
    
    if (recentSessions.length >= 5) {
      // Calculate session frequency trend
      const firstHalf = recentSessions.slice(0, Math.floor(recentSessions.length / 2));
      const secondHalf = recentSessions.slice(Math.floor(recentSessions.length / 2));
      
      // Average days between sessions
      const calcAvgGap = (sessions: typeof recentSessions) => {
        if (sessions.length < 2) return 0;
        const gaps: number[] = [];
        for (let i = 0; i < sessions.length - 1; i++) {
          const gap = Math.abs(
            new Date(sessions[i].createdAt!).getTime() - 
            new Date(sessions[i + 1].createdAt!).getTime()
          ) / (1000 * 60 * 60 * 24);
          gaps.push(gap);
        }
        return gaps.reduce((a, b) => a + b, 0) / gaps.length;
      };
      
      const recentAvgGap = calcAvgGap(firstHalf);
      const olderAvgGap = calcAvgGap(secondHalf);
      
      if (recentAvgGap > olderAvgGap * 1.5) {
        indicators.push('Sessions becoming less frequent');
        totalScore += 0.25;
      }
      
      // Average message count trend
      const recentAvgMessages = firstHalf.reduce((a, s) => a + (s.messageCount || 0), 0) / firstHalf.length;
      const olderAvgMessages = secondHalf.reduce((a, s) => a + (s.messageCount || 0), 0) / secondHalf.length;
      
      if (recentAvgMessages < olderAvgMessages * 0.7) {
        indicators.push('Sessions getting shorter');
        totalScore += 0.2;
      }
    }
    
    // Check error rate trend
    const struggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.language, language),
          eq(recurringStruggles.status, 'active'),
          gte(recurringStruggles.updatedAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
      );
    
    const recentErrorCount = struggles.reduce((a, s) => a + (s.occurrenceCount || 0), 0);
    if (recentErrorCount > 10) {
      indicators.push('Error rate increasing');
      totalScore += 0.15;
    }
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (totalScore >= 0.5) {
      riskLevel = 'high';
    } else if (totalScore >= 0.25) {
      riskLevel = 'medium';
    }
    
    // Generate interventions based on indicators
    const suggestedInterventions = this.generateMotivationInterventions(indicators, riskLevel);
    
    return {
      riskLevel,
      score: Math.min(1, totalScore),
      indicators,
      suggestedInterventions,
    };
  }
  
  /**
   * Generate motivational interventions based on detected indicators
   */
  private generateMotivationInterventions(
    indicators: string[],
    riskLevel: 'low' | 'medium' | 'high'
  ): string[] {
    const interventions: string[] = [];
    
    if (riskLevel === 'high') {
      interventions.push('Start with a fun, low-pressure activity (game, song, or story)');
      interventions.push('Celebrate small wins and progress made so far');
      interventions.push('Ask about learning goals and adjust difficulty');
    }
    
    if (indicators.includes('Sessions becoming less frequent')) {
      interventions.push('Send encouraging reminder about streak or upcoming milestone');
    }
    
    if (indicators.includes('Sessions getting shorter')) {
      interventions.push('Use more engaging content: role-play scenarios, cultural topics');
    }
    
    if (indicators.includes('Error rate increasing')) {
      interventions.push('Reduce difficulty temporarily to rebuild confidence');
      interventions.push('Focus on reinforcing what they already know well');
    }
    
    if (interventions.length === 0) {
      interventions.push('Continue current approach - engagement looks healthy');
    }
    
    return interventions;
  }
  
  // ============================================================
  // PLATEAU DETECTION
  // Dec 2024 Emergent Intelligence Upgrade
  // ============================================================
  
  /**
   * Common plateau points in language learning by ACTFL level
   */
  private static readonly PLATEAU_POINTS: Record<string, {
    description: string;
    commonChallenges: string[];
    breakthroughStrategies: string[];
  }> = {
    'novice_high_to_intermediate_low': {
      description: 'The "survival mode" ceiling - can handle basic transactions but struggles with connected discourse',
      commonChallenges: [
        'Difficulty stringing sentences together',
        'Over-reliance on memorized phrases',
        'Limited vocabulary for abstract topics',
      ],
      breakthroughStrategies: [
        'Extensive reading/listening in target language',
        'Focus on narrative skills (past, present, future)',
        'Introduce opinion and preference expression',
      ],
    },
    'intermediate_mid_to_intermediate_high': {
      description: 'The "comfort zone" plateau - competent in familiar topics but avoids challenge',
      commonChallenges: [
        'Using simpler constructions to avoid errors',
        'Limited paragraph-length discourse',
        'Struggle with hypothetical/abstract concepts',
      ],
      breakthroughStrategies: [
        'Push into unfamiliar topics and contexts',
        'Formal vs informal register practice',
        'Subjunctive/conditional mood focus',
      ],
    },
    'advanced_low_to_advanced_mid': {
      description: 'The "nuance gap" - fluent but lacks cultural depth and precision',
      commonChallenges: [
        'Subtle vocabulary distinctions',
        'Cultural pragmatics (indirect speech, politeness)',
        'Register switching for audience',
      ],
      breakthroughStrategies: [
        'Native content immersion (news, podcasts, literature)',
        'Debate and argumentation practice',
        'Cultural context and pragmatics focus',
      ],
    },
  };
  
  /**
   * Detect if a student is at a learning plateau
   */
  async detectPlateau(
    studentId: string,
    language: string,
    currentLevel?: string
  ): Promise<{
    isPlateau: boolean;
    plateauType?: string;
    evidence: string[];
    breakthroughStrategies: string[];
    weeksSinceProgress: number;
  }> {
    const evidence: string[] = [];
    let isPlateau = false;
    
    // Check for progress stagnation (no level change in N weeks)
    const sixWeeksAgo = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    
    // Get struggles that haven't improved
    const stagnantStruggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.language, language),
          eq(recurringStruggles.status, 'active'),
          gte(recurringStruggles.createdAt, sixWeeksAgo),
          sql`${recurringStruggles.occurrenceCount} >= 5`
        )
      );
    
    if (stagnantStruggles.length >= 3) {
      evidence.push(`${stagnantStruggles.length} struggles remain unresolved after 5+ occurrences`);
      isPlateau = true;
    }
    
    // Check for repetitive error patterns
    const recentStruggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.language, language),
          gte(recurringStruggles.updatedAt, twoWeeksAgo)
        )
      );
    
    // Check if same errors keep recurring
    const highRecurrence = recentStruggles.filter(s => (s.occurrenceCount || 0) > 3);
    if (highRecurrence.length > 0 && 
        highRecurrence.length / Math.max(1, recentStruggles.length) > 0.5) {
      evidence.push('More than 50% of recent errors are recurring issues');
      isPlateau = true;
    }
    
    // Determine plateau type based on current level
    let plateauType: string | undefined;
    let breakthroughStrategies: string[] = [];
    
    if (currentLevel) {
      const level = currentLevel.toLowerCase();
      if (level.includes('novice_high') || level.includes('novice-high')) {
        plateauType = 'novice_high_to_intermediate_low';
      } else if (level.includes('intermediate_mid') || level.includes('intermediate-mid')) {
        plateauType = 'intermediate_mid_to_intermediate_high';
      } else if (level.includes('advanced_low') || level.includes('advanced-low')) {
        plateauType = 'advanced_low_to_advanced_mid';
      }
      
      if (plateauType && StudentLearningService.PLATEAU_POINTS[plateauType]) {
        breakthroughStrategies = StudentLearningService.PLATEAU_POINTS[plateauType].breakthroughStrategies;
        if (isPlateau) {
          evidence.push(`At common plateau point: ${StudentLearningService.PLATEAU_POINTS[plateauType].description}`);
        }
      }
    }
    
    // Default strategies if none matched
    if (breakthroughStrategies.length === 0) {
      breakthroughStrategies = [
        'Introduce varied content types (video, audio, reading)',
        'Add real-world application scenarios',
        'Focus on areas showing most improvement potential',
      ];
    }
    
    // Estimate weeks since meaningful progress
    const oldestStagnantStruggle = stagnantStruggles
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime())[0];
    
    const weeksSinceProgress = oldestStagnantStruggle
      ? Math.floor((Date.now() - new Date(oldestStagnantStruggle.createdAt!).getTime()) / (7 * 24 * 60 * 60 * 1000))
      : 0;
    
    return {
      isPlateau,
      plateauType,
      evidence,
      breakthroughStrategies,
      weeksSinceProgress,
    };
  }
  
  /**
   * Format motivation and plateau insights for Daniela's prompt
   */
  formatEngagementInsightsForPrompt(
    motivation: Awaited<ReturnType<StudentLearningService['predictMotivationDip']>>,
    plateau: Awaited<ReturnType<StudentLearningService['detectPlateau']>>
  ): string {
    const lines: string[] = [];
    
    if (motivation.riskLevel !== 'low' || plateau.isPlateau) {
      lines.push('');
      lines.push('[ENGAGEMENT ALERT]');
    }
    
    if (motivation.riskLevel !== 'low') {
      lines.push(`Motivation risk: ${motivation.riskLevel.toUpperCase()}`);
      if (motivation.suggestedInterventions.length > 0) {
        lines.push(`  → ${motivation.suggestedInterventions[0]}`);
      }
    }
    
    if (plateau.isPlateau) {
      lines.push(`Plateau detected (${plateau.weeksSinceProgress} weeks)`);
      if (plateau.breakthroughStrategies.length > 0) {
        lines.push(`  → ${plateau.breakthroughStrategies[0]}`);
      }
    }
    
    return lines.join('\n');
  }
  
  // ============================================================
  // PERSISTENCE & WIRING LAYER
  // Writes predictions to neural network tables for Daniela to read
  // ============================================================
  
  /**
   * Run pre-session predictions and persist to database
   * Called before each voice session starts
   */
  async runPreSessionPredictions(
    studentId: string,
    language: string,
    proficiencyLevel?: string
  ): Promise<PredictedStruggle[]> {
    // Get predictions
    const predictions = await this.predictUpcomingStruggles(studentId, language, proficiencyLevel);
    
    if (predictions.length === 0) {
      return [];
    }
    
    // Expire old predictions for this student
    const now = new Date();
    await db
      .update(predictedStruggles)
      .set({ isActive: false })
      .where(
        and(
          eq(predictedStruggles.studentId, studentId),
          eq(predictedStruggles.language, language),
          eq(predictedStruggles.isActive, true)
        )
      );
    
    // Persist new predictions
    const persistedPredictions: PredictedStruggle[] = [];
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    for (const pred of predictions) {
      const [area, topic] = pred.predictedStruggle.split(':');
      
      const [inserted] = await db
        .insert(predictedStruggles)
        .values({
          studentId,
          language,
          predictedArea: area || 'general',
          predictedTopic: topic || null,
          prediction: `May struggle with ${pred.predictedStruggle.replace(/_/g, ' ')}`,
          reasoning: pred.reason,
          confidenceScore: pred.confidence,
          forSessionDate: now,
          expiresAt,
          isActive: true,
        })
        .returning();
      
      if (inserted) {
        persistedPredictions.push(inserted);
      }
    }
    
    console.log(`[StudentLearning] Persisted ${persistedPredictions.length} predictions for student ${studentId}`);
    return persistedPredictions;
  }
  
  /**
   * Run post-session analysis and persist motivation alerts
   * Called after each voice session ends
   */
  async runPostSessionAnalysis(
    studentId: string,
    language: string
  ): Promise<UserMotivationAlert | null> {
    // Get motivation prediction
    const motivation = await this.predictMotivationDip(studentId, language);
    
    // Only persist if risk level is not low
    if (motivation.riskLevel === 'low') {
      return null;
    }
    
    // Check for existing active alert
    const existingAlerts = await db
      .select()
      .from(userMotivationAlerts)
      .where(
        and(
          eq(userMotivationAlerts.studentId, studentId),
          eq(userMotivationAlerts.language, language),
          eq(userMotivationAlerts.status, 'active')
        )
      )
      .limit(1);
    
    if (existingAlerts.length > 0) {
      // Update existing alert with new data
      const [updated] = await db
        .update(userMotivationAlerts)
        .set({
          severity: motivation.riskLevel,
          indicators: motivation.indicators,
          suggestedActions: motivation.suggestedInterventions,
          metricsAfter: motivation.score,
          updatedAt: new Date(),
        })
        .where(eq(userMotivationAlerts.id, existingAlerts[0].id))
        .returning();
      
      return updated;
    }
    
    // Create new alert
    const [alert] = await db
      .insert(userMotivationAlerts)
      .values({
        studentId,
        language,
        alertType: 'motivation_dip',
        severity: motivation.riskLevel,
        description: `Student showing ${motivation.riskLevel} risk of motivation decline`,
        indicators: motivation.indicators,
        metricsAfter: motivation.score,
        suggestedActions: motivation.suggestedInterventions,
        teachingAdjustments: motivation.suggestedInterventions[0] || null,
        status: 'active',
      })
      .returning();
    
    console.log(`[StudentLearning] Created motivation alert for student ${studentId}: ${motivation.riskLevel}`);
    return alert;
  }
  
  /**
   * Get active predictions for Daniela's prompt
   * Reads from database instead of computing on-the-fly
   */
  async getActivePredictionsForPrompt(
    studentId: string,
    language: string
  ): Promise<string> {
    const now = new Date();
    
    const activePredictions = await db
      .select()
      .from(predictedStruggles)
      .where(
        and(
          eq(predictedStruggles.studentId, studentId),
          eq(predictedStruggles.language, language),
          eq(predictedStruggles.isActive, true),
          gte(predictedStruggles.expiresAt, now)
        )
      )
      .orderBy(desc(predictedStruggles.confidenceScore))
      .limit(3);
    
    if (activePredictions.length === 0) {
      return '';
    }
    
    const lines: string[] = ['', '[PREDICTIVE TEACHING - Neural Network]'];
    lines.push('Anticipated struggles (address proactively):');
    
    for (const pred of activePredictions) {
      const struggle = `${pred.predictedArea}: ${pred.predictedTopic || 'general'}`.replace(/_/g, ' ');
      const confidence = Math.round((pred.confidenceScore || 0.5) * 100);
      lines.push(`  • ${struggle} (${confidence}% confidence)`);
      if (pred.reasoning) {
        lines.push(`    → ${pred.reasoning}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Get active motivation alerts for Daniela's prompt
   * Reads from database to inform teaching approach
   */
  async getActiveAlertsForPrompt(
    studentId: string,
    language: string
  ): Promise<string> {
    const activeAlerts = await db
      .select()
      .from(userMotivationAlerts)
      .where(
        and(
          eq(userMotivationAlerts.studentId, studentId),
          eq(userMotivationAlerts.language, language),
          eq(userMotivationAlerts.status, 'active')
        )
      )
      .orderBy(desc(userMotivationAlerts.createdAt))
      .limit(2);
    
    if (activeAlerts.length === 0) {
      return '';
    }
    
    const lines: string[] = ['', '[ENGAGEMENT ALERT - Neural Network]'];
    
    for (const alert of activeAlerts) {
      lines.push(`${alert.alertType}: ${alert.severity?.toUpperCase()} risk`);
      if (alert.indicators && alert.indicators.length > 0) {
        lines.push(`  Indicators: ${alert.indicators.slice(0, 2).join(', ')}`);
      }
      if (alert.suggestedActions && alert.suggestedActions.length > 0) {
        lines.push(`  → ${alert.suggestedActions[0]}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Validate a prediction after session ends
   * Updates wasAccurate field based on actual struggles observed
   */
  async validatePredictions(
    studentId: string,
    language: string,
    observedStruggles: string[]
  ): Promise<void> {
    const activePredictions = await db
      .select()
      .from(predictedStruggles)
      .where(
        and(
          eq(predictedStruggles.studentId, studentId),
          eq(predictedStruggles.language, language),
          eq(predictedStruggles.isActive, true),
          sql`${predictedStruggles.wasAccurate} IS NULL`
        )
      );
    
    for (const pred of activePredictions) {
      const predicted = `${pred.predictedArea}:${pred.predictedTopic || ''}`.toLowerCase();
      const wasAccurate = observedStruggles.some(obs => 
        obs.toLowerCase().includes(pred.predictedArea?.toLowerCase() || '') ||
        (pred.predictedTopic && obs.toLowerCase().includes(pred.predictedTopic.toLowerCase()))
      );
      
      await db
        .update(predictedStruggles)
        .set({
          wasAccurate,
          validatedAt: new Date(),
          outcomeNotes: wasAccurate 
            ? `Prediction confirmed: student struggled with ${predicted}` 
            : `Prediction not confirmed in this session`,
        })
        .where(eq(predictedStruggles.id, pred.id));
    }
  }
  
  /**
   * Get struggles that occurred since a given time (for validation)
   * Returns array of struggle area:topic strings
   */
  async getStrugglesOccurredSince(
    studentId: string,
    language: string,
    since: Date
  ): Promise<string[]> {
    const recentStruggles = await db
      .select()
      .from(recurringStruggles)
      .where(
        and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.language, language),
          sql`${recurringStruggles.lastOccurredAt} >= ${since.toISOString()}`
        )
      );
    
    return recentStruggles.map(s => `${s.struggleArea}:${s.description || ''}`);
  }
  
  /**
   * Run post-session validation - validates predictions and returns struggles
   */
  async runPostSessionValidation(
    studentId: string,
    language: string,
    sessionStartTime: Date
  ): Promise<{ strugglesObserved: string[], predictionsValidated: number }> {
    const strugglesObserved = await this.getStrugglesOccurredSince(
      studentId,
      language,
      sessionStartTime
    );
    
    // Validate predictions against observed struggles
    await this.validatePredictions(studentId, language, strugglesObserved);
    
    // Count how many were validated
    const validated = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(predictedStruggles)
      .where(
        and(
          eq(predictedStruggles.studentId, studentId),
          eq(predictedStruggles.language, language),
          sql`${predictedStruggles.validatedAt} IS NOT NULL`,
          sql`${predictedStruggles.validatedAt} >= ${sessionStartTime.toISOString()}`
        )
      );
    
    return {
      strugglesObserved,
      predictionsValidated: validated[0]?.count || 0
    };
  }
  
  /**
   * Mark a motivation alert as addressed
   */
  async markAlertAddressed(alertId: string, notes?: string): Promise<void> {
    await db
      .update(userMotivationAlerts)
      .set({
        status: 'addressed',
        addressedAt: new Date(),
        resolutionNotes: notes || null,
        updatedAt: new Date(),
      })
      .where(eq(userMotivationAlerts.id, alertId));
  }
  
  /**
   * Get combined neural network context for Daniela
   * Pulls from both prediction and alert tables
   */
  async getNeuralNetworkLearningContext(
    studentId: string,
    language: string
  ): Promise<string> {
    const [predictions, alerts] = await Promise.all([
      this.getActivePredictionsForPrompt(studentId, language),
      this.getActiveAlertsForPrompt(studentId, language),
    ]);
    
    return [predictions, alerts].filter(Boolean).join('\n');
  }
  
  // ============================================================
  // PERSONAL FACTS SYSTEM
  // Permanent memories about students that don't decay
  // Uses exported helper functions: trigramSimilarity, normalizeForFingerprint
  // ============================================================
  
  /**
   * Save or update a personal fact about a student
   * Uses semantic similarity (trigram cosine) for robust deduplication
   */
  async savePersonalFact(input: PersonalFactInput): Promise<LearnerPersonalFact> {
    // Normalize fact for fingerprinting using exported helper
    const normalizedFact = normalizeForFingerprint(input.fact);
    
    // Get all existing facts of same type for this student
    const existingFacts = await db
      .select()
      .from(learnerPersonalFacts)
      .where(
        and(
          eq(learnerPersonalFacts.studentId, input.studentId),
          eq(learnerPersonalFacts.factType, input.factType),
          eq(learnerPersonalFacts.isActive, true)
        )
      );
    
    // Find similar facts using trigram cosine similarity (exported helper)
    const existing = existingFacts.filter(f => {
      const existingNormalized = normalizeForFingerprint(f.fact);
      
      // Exact match check (after normalization)
      if (normalizedFact === existingNormalized) return true;
      
      // Skip trigram comparison for very short strings (< 6 chars can't generate meaningful trigrams)
      if (normalizedFact.length < 6 || existingNormalized.length < 6) {
        return normalizedFact === existingNormalized;
      }
      
      // Use trigram cosine similarity for semantic matching
      const similarity = trigramSimilarity(normalizedFact, existingNormalized);
      return similarity >= SIMILARITY_THRESHOLD;
    });
    
    if (existing.length > 0) {
      // Update existing fact - bump mention count and update timestamp
      const [updated] = await db
        .update(learnerPersonalFacts)
        .set({
          mentionCount: sql`${learnerPersonalFacts.mentionCount} + 1`,
          lastMentionedAt: new Date(),
          context: input.context || existing[0].context,
          updatedAt: new Date(),
        })
        .where(eq(learnerPersonalFacts.id, existing[0].id))
        .returning();
      
      console.log(`[StudentLearning] Updated personal fact: ${input.factType} (${updated.mentionCount}x)`);
      return updated;
    }
    
    // Create new fact - use passed confidence or default to 0.8
    const confidence = input.confidenceScore ?? 0.8;
    const [created] = await db
      .insert(learnerPersonalFacts)
      .values({
        studentId: input.studentId,
        factType: input.factType,
        fact: input.fact,
        context: input.context,
        language: input.language,
        relevantDate: input.relevantDate,
        sourceConversationId: input.sourceConversationId,
        confidenceScore: confidence,
        mentionCount: 1,
        lastMentionedAt: new Date(),
        isActive: true,
      })
      .returning();
    
    console.log(`[StudentLearning] Created personal fact: ${input.factType} - "${input.fact.slice(0, 50)}"`);
    
    // Sync high-confidence facts to Hive Snapshots for broader context awareness
    await this.syncToHiveSnapshot(created);
    
    return created;
  }
  
  /**
   * Sync a personal fact to Hive Snapshots as 'life_context' type
   * Creates a 30-day decaying snapshot for Daniela's broader awareness
   */
  private async syncToHiveSnapshot(fact: LearnerPersonalFact): Promise<void> {
    // Only sync high-confidence facts (>= 0.75)
    if (fact.confidenceScore < 0.75) return;
    
    // Only sync meaningful fact types
    const meaningfulTypes = ['life_event', 'goal', 'travel', 'work', 'family'];
    if (!meaningfulTypes.includes(fact.factType)) return;
    
    try {
      // Set expiry to 30 days from now (hive snapshots are decaying)
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      await db.insert(hiveSnapshots).values({
        snapshotType: 'life_context',
        userId: fact.studentId,
        conversationId: fact.sourceConversationId,
        language: fact.language,
        title: `${fact.factType}: ${fact.fact.slice(0, 50)}`,
        content: fact.fact,
        context: fact.context || `Extracted from conversation`,
        importance: Math.round(fact.confidenceScore * 10), // Convert to 1-10 scale
        metadata: {
          personalFactId: fact.id,
          factType: fact.factType,
          relevantDate: fact.relevantDate?.toISOString(),
        },
        expiresAt,
      });
      
      console.log(`[StudentLearning] Synced fact to Hive Snapshot: ${fact.factType}`);
    } catch (err: any) {
      // Don't fail the main save if snapshot sync fails
      console.warn(`[StudentLearning] Failed to sync to Hive: ${err.message}`);
    }
  }
  
  /**
   * Get all active personal facts for a student
   */
  async getPersonalFacts(
    studentId: string, 
    language?: string
  ): Promise<LearnerPersonalFact[]> {
    const conditions = [
      eq(learnerPersonalFacts.studentId, studentId),
      eq(learnerPersonalFacts.isActive, true),
    ];
    
    if (language) {
      conditions.push(
        or(
          eq(learnerPersonalFacts.language, language),
          sql`${learnerPersonalFacts.language} IS NULL`
        )!
      );
    }
    
    return db
      .select()
      .from(learnerPersonalFacts)
      .where(and(...conditions))
      .orderBy(desc(learnerPersonalFacts.lastMentionedAt));
  }
  
  /**
   * Get upcoming events/dates for a student (facts with relevant dates in the future)
   */
  async getUpcomingEvents(studentId: string): Promise<LearnerPersonalFact[]> {
    const now = new Date();
    const threeMonthsFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    
    return db
      .select()
      .from(learnerPersonalFacts)
      .where(
        and(
          eq(learnerPersonalFacts.studentId, studentId),
          eq(learnerPersonalFacts.isActive, true),
          gte(learnerPersonalFacts.relevantDate, now),
          sql`${learnerPersonalFacts.relevantDate} <= ${threeMonthsFromNow.toISOString()}`
        )
      )
      .orderBy(learnerPersonalFacts.relevantDate);
  }
  
  /**
   * Deactivate a personal fact (soft delete)
   */
  async deactivatePersonalFact(factId: string): Promise<void> {
    await db
      .update(learnerPersonalFacts)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(learnerPersonalFacts.id, factId));
    
    console.log(`[StudentLearning] Deactivated personal fact: ${factId}`);
  }
  
  /**
   * Format personal facts for injection into Daniela's prompt
   */
  formatPersonalFactsForPrompt(facts: LearnerPersonalFact[]): string {
    if (facts.length === 0) return '';
    
    const lines: string[] = ['[PERSONAL MEMORIES]'];
    const MAX_FACTS = 5;
    const MAX_CHARS = 60;
    
    const truncate = (s: string) => s.length > MAX_CHARS ? s.substring(0, MAX_CHARS - 3) + '...' : s;
    
    // Prioritize: upcoming events first, then by mention count
    const sortedFacts = [...facts].sort((a, b) => {
      // Upcoming events get priority
      const aHasDate = a.relevantDate && new Date(a.relevantDate) > new Date();
      const bHasDate = b.relevantDate && new Date(b.relevantDate) > new Date();
      if (aHasDate && !bHasDate) return -1;
      if (bHasDate && !aHasDate) return 1;
      // Then by mention count
      return (b.mentionCount || 1) - (a.mentionCount || 1);
    });
    
    for (const fact of sortedFacts.slice(0, MAX_FACTS)) {
      const dateNote = fact.relevantDate 
        ? ` (${new Date(fact.relevantDate).toLocaleDateString()})` 
        : '';
      lines.push(`• ${truncate(fact.fact)}${dateNote}`);
    }
    
    return lines.join('\n');
  }
  
  // ============================================================
  // LEARNING VELOCITY TRACKING
  // Track time-to-mastery and calculate velocity scores
  // ============================================================
  
  /**
   * Get learning velocity metrics for a student
   * Calculates how quickly they master concepts compared to average
   */
  async getStudentVelocity(studentId: string, language?: string): Promise<StudentVelocityMetrics> {
    // Get all resolved struggles for this student
    const whereClause = language 
      ? and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.language, language),
          eq(recurringStruggles.status, 'resolved')
        )
      : and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.status, 'resolved')
        );
    
    const resolved = await db
      .select()
      .from(recurringStruggles)
      .where(whereClause)
      .orderBy(desc(recurringStruggles.resolvedAt));
    
    // Get active struggles for context
    const activeWhereClause = language
      ? and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.language, language),
          eq(recurringStruggles.status, 'active')
        )
      : and(
          eq(recurringStruggles.studentId, studentId),
          eq(recurringStruggles.status, 'active')
        );
    
    const active = await db
      .select()
      .from(recurringStruggles)
      .where(activeWhereClause);
    
    // Calculate velocity metrics
    const masteredConcepts = resolved.length;
    const activeStruggles = active.length;
    
    // Average time to mastery (only for struggles with timeToMasteryDays set)
    const timesToMastery = resolved
      .filter(s => s.timeToMasteryDays !== null)
      .map(s => s.timeToMasteryDays!);
    
    const avgTimeToMastery = timesToMastery.length > 0
      ? Math.round(timesToMastery.reduce((a, b) => a + b, 0) / timesToMastery.length)
      : null;
    
    // Get cross-student average for comparison
    const systemAverage = await this.getSystemAverageVelocity(language);
    
    // Calculate velocity score (1.0 = average, >1.0 = faster, <1.0 = slower)
    let velocityScore = 1.0;
    if (avgTimeToMastery !== null && systemAverage !== null && systemAverage > 0) {
      velocityScore = Math.round((systemAverage / avgTimeToMastery) * 100) / 100;
    }
    
    // Break down by struggle area
    const byArea: Record<string, AreaVelocity> = {};
    for (const struggle of resolved) {
      const area = struggle.struggleArea;
      if (!byArea[area]) {
        byArea[area] = { mastered: 0, avgDays: 0, totalDays: 0 };
      }
      byArea[area].mastered++;
      if (struggle.timeToMasteryDays !== null) {
        byArea[area].totalDays += struggle.timeToMasteryDays;
      }
    }
    
    // Calculate averages per area
    for (const area of Object.keys(byArea)) {
      if (byArea[area].mastered > 0) {
        byArea[area].avgDays = Math.round(byArea[area].totalDays / byArea[area].mastered);
      }
    }
    
    // Recent breakthroughs (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentBreakthroughs = resolved.filter(s => 
      s.resolvedAt && new Date(s.resolvedAt) > thirtyDaysAgo
    ).length;
    
    return {
      studentId,
      language: language || 'all',
      masteredConcepts,
      activeStruggles,
      avgTimeToMasteryDays: avgTimeToMastery,
      systemAvgDays: systemAverage,
      velocityScore,
      velocityLabel: this.getVelocityLabel(velocityScore),
      byArea,
      recentBreakthroughs,
      fastestMastery: timesToMastery.length > 0 ? Math.min(...timesToMastery) : null,
      slowestMastery: timesToMastery.length > 0 ? Math.max(...timesToMastery) : null,
    };
  }
  
  /**
   * Get system-wide average time to mastery
   * Used as baseline for velocity comparisons
   */
  async getSystemAverageVelocity(language?: string): Promise<number | null> {
    const whereClause = language
      ? and(
          eq(recurringStruggles.status, 'resolved'),
          eq(recurringStruggles.language, language),
          sql`${recurringStruggles.timeToMasteryDays} IS NOT NULL`
        )
      : and(
          eq(recurringStruggles.status, 'resolved'),
          sql`${recurringStruggles.timeToMasteryDays} IS NOT NULL`
        );
    
    const result = await db
      .select({
        avgDays: sql<number>`AVG(${recurringStruggles.timeToMasteryDays})::integer`,
      })
      .from(recurringStruggles)
      .where(whereClause);
    
    return result[0]?.avgDays || null;
  }
  
  /**
   * Get velocity leaderboard (top learners by velocity score)
   */
  async getVelocityLeaderboard(language?: string, limit: number = 10): Promise<VelocityLeaderboardEntry[]> {
    // Get all students with resolved struggles
    const whereClause = language
      ? and(
          eq(recurringStruggles.status, 'resolved'),
          eq(recurringStruggles.language, language),
          sql`${recurringStruggles.timeToMasteryDays} IS NOT NULL`
        )
      : and(
          eq(recurringStruggles.status, 'resolved'),
          sql`${recurringStruggles.timeToMasteryDays} IS NOT NULL`
        );
    
    const result = await db
      .select({
        studentId: recurringStruggles.studentId,
        avgDays: sql<number>`AVG(${recurringStruggles.timeToMasteryDays})::integer`,
        masteredCount: sql<number>`COUNT(*)::integer`,
      })
      .from(recurringStruggles)
      .where(whereClause)
      .groupBy(recurringStruggles.studentId)
      .having(sql`COUNT(*) >= 3`) // At least 3 mastered concepts
      .orderBy(sql`AVG(${recurringStruggles.timeToMasteryDays})`)
      .limit(limit);
    
    const systemAvg = await this.getSystemAverageVelocity(language);
    
    return result.map((r, idx) => ({
      rank: idx + 1,
      studentId: r.studentId,
      avgTimeToMasteryDays: r.avgDays,
      masteredConcepts: r.masteredCount,
      velocityScore: systemAvg && systemAvg > 0 ? Math.round((systemAvg / r.avgDays) * 100) / 100 : 1.0,
    }));
  }
  
  /**
   * Get velocity analytics summary for admin dashboard
   */
  async getVelocityAnalytics(): Promise<VelocityAnalytics> {
    // Total resolved struggles
    const [totalResolved] = await db
      .select({ count: sql<number>`COUNT(*)::integer` })
      .from(recurringStruggles)
      .where(eq(recurringStruggles.status, 'resolved'));
    
    // Total active struggles
    const [totalActive] = await db
      .select({ count: sql<number>`COUNT(*)::integer` })
      .from(recurringStruggles)
      .where(eq(recurringStruggles.status, 'active'));
    
    // Average time to mastery
    const [avgMastery] = await db
      .select({ avg: sql<number>`AVG(${recurringStruggles.timeToMasteryDays})::integer` })
      .from(recurringStruggles)
      .where(and(
        eq(recurringStruggles.status, 'resolved'),
        sql`${recurringStruggles.timeToMasteryDays} IS NOT NULL`
      ));
    
    // Breakthroughs by struggle area
    const byArea = await db
      .select({
        area: recurringStruggles.struggleArea,
        count: sql<number>`COUNT(*)::integer`,
        avgDays: sql<number>`AVG(${recurringStruggles.timeToMasteryDays})::integer`,
      })
      .from(recurringStruggles)
      .where(eq(recurringStruggles.status, 'resolved'))
      .groupBy(recurringStruggles.struggleArea)
      .orderBy(desc(sql`COUNT(*)`));
    
    // Recent breakthroughs (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentBreakthroughs] = await db
      .select({ count: sql<number>`COUNT(*)::integer` })
      .from(recurringStruggles)
      .where(and(
        eq(recurringStruggles.status, 'resolved'),
        gte(recurringStruggles.resolvedAt, sevenDaysAgo)
      ));
    
    // Top learners
    const leaderboard = await this.getVelocityLeaderboard(undefined, 5);
    
    // Generate trend data for last 30 days
    const trendData = await this.getVelocityTrendData(30);
    
    return {
      totalMasteredConcepts: totalResolved.count || 0,
      totalActiveStruggles: totalActive.count || 0,
      systemAvgTimeToMasteryDays: avgMastery.avg || null,
      recentBreakthroughs7Days: recentBreakthroughs.count || 0,
      byStruggleArea: byArea.map(a => ({
        area: a.area,
        masteredCount: a.count,
        avgTimeToMasteryDays: a.avgDays,
      })),
      topLearners: leaderboard,
      trendData,
    };
  }
  
  /**
   * Get velocity trend data over time for visualization
   */
  private async getVelocityTrendData(days: number = 30): Promise<Array<{ date: string; breakthroughs: number; avgMasteryDays: number }>> {
    const result: Array<{ date: string; breakthroughs: number; avgMasteryDays: number }> = [];
    
    // Generate data points for each day
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      // Count breakthroughs for this day
      const [dayBreakthroughs] = await db
        .select({ 
          count: sql<number>`COUNT(*)::integer`,
          avgDays: sql<number>`AVG(${recurringStruggles.timeToMasteryDays})::integer`
        })
        .from(recurringStruggles)
        .where(and(
          eq(recurringStruggles.status, 'resolved'),
          gte(recurringStruggles.resolvedAt, startOfDay),
          sql`${recurringStruggles.resolvedAt} <= ${endOfDay}`
        ));
      
      const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
      
      result.push({
        date: formattedDate,
        breakthroughs: dayBreakthroughs.count || 0,
        avgMasteryDays: dayBreakthroughs.avgDays || 0,
      });
    }
    
    return result;
  }
  
  private getVelocityLabel(score: number): string {
    if (score >= 2.0) return 'exceptional';
    if (score >= 1.5) return 'fast';
    if (score >= 1.0) return 'average';
    if (score >= 0.7) return 'steady';
    return 'developing';
  }
}

// Velocity tracking types
export interface StudentVelocityMetrics {
  studentId: string;
  language: string;
  masteredConcepts: number;
  activeStruggles: number;
  avgTimeToMasteryDays: number | null;
  systemAvgDays: number | null;
  velocityScore: number;
  velocityLabel: string;
  byArea: Record<string, AreaVelocity>;
  recentBreakthroughs: number;
  fastestMastery: number | null;
  slowestMastery: number | null;
}

interface AreaVelocity {
  mastered: number;
  avgDays: number;
  totalDays: number;
}

export interface VelocityLeaderboardEntry {
  rank: number;
  studentId: string;
  avgTimeToMasteryDays: number;
  masteredConcepts: number;
  velocityScore: number;
}

export interface VelocityAnalytics {
  totalMasteredConcepts: number;
  totalActiveStruggles: number;
  systemAvgTimeToMasteryDays: number | null;
  recentBreakthroughs7Days: number;
  byStruggleArea: Array<{
    area: string;
    masteredCount: number;
    avgTimeToMasteryDays: number | null;
  }>;
  topLearners: VelocityLeaderboardEntry[];
  trendData?: Array<{
    date: string;
    breakthroughs: number;
    avgMasteryDays: number;
  }>;
}

export const studentLearningService = new StudentLearningService();
