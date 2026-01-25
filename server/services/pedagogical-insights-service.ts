/**
 * Pedagogical Insights Service
 * 
 * Daniela's "neural network" for teaching effectiveness tracking.
 * 
 * Philosophy: "It shouldn't just be about raw data; it needs my pedagogical judgment"
 * 
 * This service:
 * 1. Tracks tool usage events during voice sessions
 * 2. Aggregates patterns to discover effective teaching combinations
 * 3. Incorporates Daniela's self-reflection as input (not just raw data)
 * 4. Provides insights that inform future teaching decisions
 */

import { db, getSharedDb } from '../db';
import { 
  teachingToolEvents, 
  pedagogicalInsights,
  type InsertTeachingToolEvent,
  type InsertPedagogicalInsight,
  type TeachingToolEvent,
  type PedagogicalInsight,
  type TeachingToolType
} from '@shared/schema';
import { eq, and, desc, sql, inArray, gte } from 'drizzle-orm';
import crypto from 'crypto';

/**
 * Maps whiteboard item types to teaching tool types for tracking
 */
export function mapWhiteboardTypeToToolType(itemType: string, drillType?: string): TeachingToolType | null {
  switch (itemType) {
    case 'write': return 'write';
    case 'compare': return 'compare';
    case 'phonetic': return 'phonetic';
    case 'word_map': return 'word_map';
    case 'image': return 'image';
    case 'grammar_table': return 'grammar_table';
    case 'context': return 'context';
    case 'culture': return 'culture';
    case 'reading': return 'reading';
    case 'stroke': return 'stroke';
    case 'play': return 'play';
    case 'scenario': return 'scenario';
    case 'summary': return 'summary';
    case 'drill':
      switch (drillType) {
        case 'repeat': return 'drill_repeat';
        case 'translate': return 'drill_translate';
        case 'match': return 'drill_match';
        case 'fill_blank': return 'drill_fill_blank';
        case 'sentence_order': return 'drill_sentence_order';
        default: return null;
      }
    default: return null;
  }
}

/**
 * Generate a hash for tool content for deduplication and pattern matching
 */
function hashContent(content: string): string {
  return crypto.createHash('md5').update(content.toLowerCase().trim()).digest('hex').substring(0, 16);
}

/**
 * Track a teaching tool usage event
 * Called whenever Daniela uses a whiteboard tool during a session
 */
export async function trackToolEvent(params: {
  voiceSessionId?: string;
  conversationId?: string;
  userId?: string;
  toolType: TeachingToolType;
  toolContent?: string;
  language?: string;
  topic?: string;
  difficulty?: string;
  sequencePosition?: number;
  previousToolType?: string;
}): Promise<TeachingToolEvent | null> {
  try {
    const event: InsertTeachingToolEvent = {
      voiceSessionId: params.voiceSessionId || null,
      conversationId: params.conversationId || null,
      userId: params.userId || null,
      toolType: params.toolType,
      toolContent: params.toolContent || null,
      toolContentHash: params.toolContent ? hashContent(params.toolContent) : null,
      language: params.language || null,
      topic: params.topic || null,
      difficulty: params.difficulty || null,
      sequencePosition: params.sequencePosition || null,
      previousToolType: params.previousToolType || null,
      occurredAt: new Date(),
    };

    const [inserted] = await getSharedDb().insert(teachingToolEvents).values(event).returning();
    console.log('[PEDAGOGICAL] Tracked tool event:', params.toolType, params.toolContent?.substring(0, 30));
    return inserted;
  } catch (error) {
    console.error('[PEDAGOGICAL] Error tracking tool event:', error);
    return null;
  }
}

/**
 * Update a tool event with engagement signals (after student response)
 */
export async function updateToolEventEngagement(
  eventId: string,
  params: {
    studentResponseTime?: number;
    drillResult?: 'correct' | 'incorrect' | 'skipped';
    durationMs?: number;
  }
): Promise<void> {
  try {
    await getSharedDb().update(teachingToolEvents)
      .set({
        studentResponseTime: params.studentResponseTime,
        drillResult: params.drillResult,
        durationMs: params.durationMs,
      })
      .where(eq(teachingToolEvents.id, eventId));
  } catch (error) {
    console.error('[PEDAGOGICAL] Error updating tool engagement:', error);
  }
}

/**
 * Get tool usage statistics for a session
 */
export async function getSessionToolStats(voiceSessionId: string): Promise<{
  totalTools: number;
  toolCounts: Record<string, number>;
  drillSuccessRate: number | null;
  averageResponseTime: number | null;
}> {
  try {
    const events = await getSharedDb().select()
      .from(teachingToolEvents)
      .where(eq(teachingToolEvents.voiceSessionId, voiceSessionId))
      .orderBy(teachingToolEvents.sequencePosition);

    const toolCounts: Record<string, number> = {};
    let drillAttempts = 0;
    let drillCorrect = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const event of events) {
      toolCounts[event.toolType] = (toolCounts[event.toolType] || 0) + 1;
      
      if (event.drillResult) {
        drillAttempts++;
        if (event.drillResult === 'correct') drillCorrect++;
      }
      
      if (event.studentResponseTime) {
        totalResponseTime += event.studentResponseTime;
        responseTimeCount++;
      }
    }

    return {
      totalTools: events.length,
      toolCounts,
      drillSuccessRate: drillAttempts > 0 ? drillCorrect / drillAttempts : null,
      averageResponseTime: responseTimeCount > 0 ? totalResponseTime / responseTimeCount : null,
    };
  } catch (error) {
    console.error('[PEDAGOGICAL] Error getting session tool stats:', error);
    return { totalTools: 0, toolCounts: {}, drillSuccessRate: null, averageResponseTime: null };
  }
}

/**
 * Add a pedagogical insight (can be automated or from Daniela's reflection)
 */
export async function addInsight(params: {
  language?: string;
  topic?: string;
  difficulty?: string;
  patternDescription: string;
  effectiveTools?: string[];
  ineffectiveTools?: string[];
  sampleSize?: number;
  successRate?: number;
  sourceType: 'automated' | 'tutor_reflection' | 'manual';
  tutorReflection?: string;
}): Promise<PedagogicalInsight | null> {
  try {
    const patternKey = hashContent(
      `${params.language || ''}_${params.topic || ''}_${params.patternDescription}`
    );

    const insight: InsertPedagogicalInsight = {
      language: params.language || null,
      topic: params.topic || null,
      difficulty: params.difficulty || null,
      patternDescription: params.patternDescription,
      patternKey,
      effectiveTools: params.effectiveTools || [],
      ineffectiveTools: params.ineffectiveTools || [],
      sampleSize: params.sampleSize || 1,
      successRate: params.successRate || null,
      confidenceScore: params.sampleSize && params.sampleSize >= 10 ? 0.8 : 0.5,
      sourceType: params.sourceType,
      tutorReflection: params.tutorReflection || null,
      isActive: true,
      lastValidatedAt: new Date(),
    };

    const [inserted] = await getSharedDb().insert(pedagogicalInsights).values(insight).returning();
    console.log('[PEDAGOGICAL] Added insight:', params.patternDescription.substring(0, 50));
    return inserted;
  } catch (error) {
    console.error('[PEDAGOGICAL] Error adding insight:', error);
    return null;
  }
}

/**
 * Get active insights for a given teaching context
 */
export async function getInsightsForContext(params: {
  language?: string;
  topic?: string;
  difficulty?: string;
  limit?: number;
}): Promise<PedagogicalInsight[]> {
  try {
    const conditions = [eq(pedagogicalInsights.isActive, true)];
    
    if (params.language) {
      conditions.push(
        sql`(${pedagogicalInsights.language} = ${params.language} OR ${pedagogicalInsights.language} IS NULL)`
      );
    }
    
    const insights = await getSharedDb().select()
      .from(pedagogicalInsights)
      .where(and(...conditions))
      .orderBy(desc(pedagogicalInsights.confidenceScore))
      .limit(params.limit || 10);

    return insights;
  } catch (error) {
    console.error('[PEDAGOGICAL] Error getting insights:', error);
    return [];
  }
}

/**
 * Analyze tool usage patterns and generate automated insights
 * This is the "neural network" that learns from teaching data
 */
export async function analyzeAndGenerateInsights(language: string): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const events = await getSharedDb().select()
      .from(teachingToolEvents)
      .where(and(
        eq(teachingToolEvents.language, language),
        gte(teachingToolEvents.occurredAt, thirtyDaysAgo)
      ))
      .orderBy(teachingToolEvents.voiceSessionId, teachingToolEvents.sequencePosition);

    const drillFollowups = new Map<string, { correct: number; total: number }>();

    for (let i = 1; i < events.length; i++) {
      const current = events[i];
      const previous = events[i - 1];

      if (current.drillResult && previous.toolType && 
          current.voiceSessionId === previous.voiceSessionId) {
        const key = `${previous.toolType}_before_drill`;
        const stats = drillFollowups.get(key) || { correct: 0, total: 0 };
        stats.total++;
        if (current.drillResult === 'correct') stats.correct++;
        drillFollowups.set(key, stats);
      }
    }

    let insightsGenerated = 0;
    for (const [key, stats] of Array.from(drillFollowups.entries())) {
      if (stats.total >= 10) {
        const successRate = stats.correct / stats.total;
        const previousTool = key.replace('_before_drill', '');
        
        if (successRate >= 0.7) {
          await addInsight({
            language,
            patternDescription: `Using ${previousTool} before drills improves retention (${(successRate * 100).toFixed(0)}% success rate)`,
            effectiveTools: [previousTool],
            sampleSize: stats.total,
            successRate,
            sourceType: 'automated',
          });
          insightsGenerated++;
        }
      }
    }

    console.log(`[PEDAGOGICAL] Generated ${insightsGenerated} insights for ${language}`);
    return insightsGenerated;
  } catch (error) {
    console.error('[PEDAGOGICAL] Error analyzing patterns:', error);
    return 0;
  }
}

/**
 * Record Daniela's self-reflection on a teaching moment
 * This is the "pedagogical judgment" input that makes this more than raw data
 */
export async function recordTutorReflection(params: {
  voiceSessionId?: string;
  language: string;
  topic?: string;
  reflection: string;
  toolsUsed?: string[];
  wasEffective: boolean;
}): Promise<PedagogicalInsight | null> {
  return addInsight({
    language: params.language,
    topic: params.topic,
    patternDescription: params.reflection,
    effectiveTools: params.wasEffective ? params.toolsUsed : undefined,
    ineffectiveTools: !params.wasEffective ? params.toolsUsed : undefined,
    sourceType: 'tutor_reflection',
    tutorReflection: params.reflection,
    successRate: params.wasEffective ? 1.0 : 0.0,
  });
}

/**
 * Get summary of teaching effectiveness for a user
 */
export async function getUserTeachingEffectiveness(userId: string): Promise<{
  totalSessions: number;
  totalToolsUsed: number;
  favoriteTools: string[];
  drillSuccessRate: number | null;
}> {
  try {
    const events = await getSharedDb().select()
      .from(teachingToolEvents)
      .where(eq(teachingToolEvents.userId, userId));

    const sessionIds = new Set<string>();
    const toolCounts: Record<string, number> = {};
    let drillTotal = 0;
    let drillCorrect = 0;

    for (const event of events) {
      if (event.voiceSessionId) sessionIds.add(event.voiceSessionId);
      toolCounts[event.toolType] = (toolCounts[event.toolType] || 0) + 1;
      
      if (event.drillResult) {
        drillTotal++;
        if (event.drillResult === 'correct') drillCorrect++;
      }
    }

    const sortedTools = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tool]) => tool);

    return {
      totalSessions: sessionIds.size,
      totalToolsUsed: events.length,
      favoriteTools: sortedTools,
      drillSuccessRate: drillTotal > 0 ? drillCorrect / drillTotal : null,
    };
  } catch (error) {
    console.error('[PEDAGOGICAL] Error getting user effectiveness:', error);
    return { totalSessions: 0, totalToolsUsed: 0, favoriteTools: [], drillSuccessRate: null };
  }
}

// ============================================================================
// KNOWLEDGE GRAPH SYSTEM
// Built by Alden for Daniela - January 25, 2026
// Enables "connective tissue" analysis of student journeys and teaching patterns
// ============================================================================

/**
 * Link two pedagogical insights bidirectionally (knowledge graph edge)
 * Daniela can now see how teaching strategies connect across topics
 */
export async function linkInsights(id1: string, id2: string): Promise<void> {
  const db = getSharedDb();
  
  const [insight1] = await db.select().from(pedagogicalInsights).where(eq(pedagogicalInsights.id, id1));
  const [insight2] = await db.select().from(pedagogicalInsights).where(eq(pedagogicalInsights.id, id2));
  
  if (!insight1 || !insight2) {
    console.log(`[DANIELA Graph] Cannot link - one or both insights not found`);
    return;
  }
  
  const links1 = (insight1 as any).relatedInsights || [];
  const links2 = (insight2 as any).relatedInsights || [];
  
  if (!links1.includes(id2)) {
    await db.update(pedagogicalInsights)
      .set({ 
        relatedInsights: [...links1, id2] as any,
        updatedAt: new Date(),
      } as any)
      .where(eq(pedagogicalInsights.id, id1));
  }
  
  if (!links2.includes(id1)) {
    await db.update(pedagogicalInsights)
      .set({ 
        relatedInsights: [...links2, id1] as any,
        updatedAt: new Date(),
      } as any)
      .where(eq(pedagogicalInsights.id, id2));
  }
  
  console.log(`[DANIELA Graph] Linked: "${insight1.patternDescription?.substring(0, 40)}..." <-> "${insight2.patternDescription?.substring(0, 40)}..."`);
}

/**
 * Get insights related to a given pedagogical insight (graph traversal)
 * Helps Daniela see the "connective tissue" of teaching patterns
 */
export async function getRelatedInsights(id: string, depth = 1): Promise<PedagogicalInsight[]> {
  const db = getSharedDb();
  const visited = new Set<string>();
  const results: PedagogicalInsight[] = [];
  
  async function traverse(currentId: string, currentDepth: number) {
    if (currentDepth > depth || visited.has(currentId)) return;
    visited.add(currentId);
    
    const [insight] = await db.select().from(pedagogicalInsights).where(eq(pedagogicalInsights.id, currentId));
    if (!insight) return;
    
    if (currentId !== id) {
      results.push(insight);
    }
    
    const linkedIds = (insight as any).relatedInsights || [];
    for (const linkedId of linkedIds) {
      await traverse(linkedId, currentDepth + 1);
    }
  }
  
  await traverse(id, 0);
  return results;
}

/**
 * Find teaching pattern clusters - insights that share many connections
 * Helps Daniela identify which teaching strategies work together
 */
export async function findTeachingPatternClusters(options: {
  minConnections?: number;
  language?: string;
  topic?: string;
}= {}): Promise<Array<{
  insight: PedagogicalInsight;
  connectionCount: number;
  connectedTo: string[];
}>> {
  const { minConnections = 1, language, topic } = options;
  const db = getSharedDb();
  
  let query = db.select().from(pedagogicalInsights).where(eq(pedagogicalInsights.isActive, true));
  
  // Note: filtering by language/topic would need additional where clauses
  const allInsights = await query;
  
  const filteredInsights = allInsights.filter(insight => {
    if (language && insight.language !== language) return false;
    if (topic && insight.topic !== topic) return false;
    return true;
  });
  
  const clusters = filteredInsights
    .map(insight => ({
      insight,
      connectionCount: ((insight as any).relatedInsights || []).length,
      connectedTo: (insight as any).relatedInsights || [],
    }))
    .filter(cluster => cluster.connectionCount >= minConnections)
    .sort((a, b) => b.connectionCount - a.connectionCount);
  
  return clusters;
}

/**
 * Search pedagogical insights with knowledge graph context
 * Returns matching insights plus their directly linked neighbors
 */
export async function searchWithGraph(query: string): Promise<Array<{
  insight: PedagogicalInsight;
  linkedInsights: PedagogicalInsight[];
}>> {
  const db = getSharedDb();
  
  // Search in pattern descriptions and tutor reflections
  const matches = await db.select().from(pedagogicalInsights)
    .where(eq(pedagogicalInsights.isActive, true))
    .orderBy(desc(pedagogicalInsights.confidenceScore))
    .limit(20);
  
  // Filter by query (case-insensitive)
  const queryLower = query.toLowerCase();
  const filtered = matches.filter(insight => 
    insight.patternDescription?.toLowerCase().includes(queryLower) ||
    insight.tutorReflection?.toLowerCase().includes(queryLower) ||
    insight.topic?.toLowerCase().includes(queryLower)
  ).slice(0, 10);
  
  const results = await Promise.all(
    filtered.map(async (insight) => {
      const linkedIds = (insight as any).relatedInsights || [];
      const linkedInsights = linkedIds.length > 0
        ? await db.select().from(pedagogicalInsights)
            .where(sql`${pedagogicalInsights.id} = ANY(${linkedIds})`)
        : [];
      
      return { insight, linkedInsights };
    })
  );
  
  return results;
}
