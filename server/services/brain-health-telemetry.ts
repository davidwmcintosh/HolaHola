import { db } from '../db';
import { brainEvents, brainDailyMetrics, type InsertBrainEvent } from '@shared/schema';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';
import crypto from 'crypto';

type BrainEventType = 'memory_retrieval' | 'memory_injection' | 'memory_lookup_tool' | 'fact_extraction' | 'action_trigger' | 'tool_call' | 'context_injection';
type BrainEventSource = 'passive_lookup' | 'active_function' | 'extraction_service' | 'streaming_orchestrator' | 'openmicFlow' | 'context_assembly';

interface MemoryEventData {
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  targetLanguage?: string;
  memoryIds?: string[];
  memoryTypes?: string[];
  queryTerms?: string;
  resultsCount?: number;
  relevanceScore?: number;
  freshnessAvgDays?: number;
  latencyMs?: number;
  wasUsed?: boolean;
}

interface ToolEventData {
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  targetLanguage?: string;
  toolName: string;
  latencyMs?: number;
}

interface ActionTriggerEventData {
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  targetLanguage?: string;
  actionTrigger: string;
  tagPayload?: Record<string, any>;
}

interface FactExtractionEventData {
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  targetLanguage?: string;
  factType: string;
  factSpecificity: 'specific' | 'vague';
  latencyMs?: number;
}

type ContextSource = 'classroom' | 'curriculum' | 'student_intelligence' | 'hive' | 'express_lane' | 'editor_feedback' | 'neural_network' | 'journey' | 'unified_total';

interface ContextInjectionEventData {
  sessionId?: string;
  userId?: string;
  targetLanguage?: string;
  contextSource: ContextSource;
  success: boolean;
  latencyMs: number;
  richness?: number;
  errorMessage?: string;
}

class BrainHealthTelemetry {
  private eventQueue: InsertBrainEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 50;
  private readonly FLUSH_INTERVAL_MS = 5000;

  constructor() {
    this.startFlushWorker();
  }

  private startFlushWorker() {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        console.warn('[BrainHealth] Flush error:', err.message);
      });
    }, this.FLUSH_INTERVAL_MS);
  }

  private generateRedundancyHash(userId: string, memoryIds: string[]): string {
    const sorted = [...memoryIds].sort().join(',');
    return crypto.createHash('md5').update(`${userId}:${sorted}`).digest('hex');
  }

  async logMemoryRetrieval(data: MemoryEventData): Promise<void> {
    const event: InsertBrainEvent = {
      eventType: 'memory_retrieval',
      eventSource: 'passive_lookup',
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      userId: data.userId,
      targetLanguage: data.targetLanguage,
      memoryIds: data.memoryIds,
      memoryTypes: data.memoryTypes,
      queryTerms: data.queryTerms,
      resultsCount: data.resultsCount,
      relevanceScore: data.relevanceScore,
      freshnessAvgDays: data.freshnessAvgDays,
      latencyMs: data.latencyMs,
      wasUsed: data.wasUsed ?? false,
      redundancyHash: data.userId && data.memoryIds?.length 
        ? this.generateRedundancyHash(data.userId, data.memoryIds)
        : undefined,
    };
    this.queueEvent(event);
  }

  async logMemoryInjection(data: MemoryEventData, source: BrainEventSource = 'streaming_orchestrator'): Promise<void> {
    const event: InsertBrainEvent = {
      eventType: 'memory_injection',
      eventSource: source,
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      userId: data.userId,
      targetLanguage: data.targetLanguage,
      memoryIds: data.memoryIds,
      memoryTypes: data.memoryTypes,
      queryTerms: data.queryTerms,
      resultsCount: data.resultsCount,
      relevanceScore: data.relevanceScore,
      freshnessAvgDays: data.freshnessAvgDays,
      latencyMs: data.latencyMs,
      wasUsed: true,
      redundancyHash: data.userId && data.memoryIds?.length 
        ? this.generateRedundancyHash(data.userId, data.memoryIds)
        : undefined,
    };
    this.queueEvent(event);
  }

  async logMemoryLookupTool(data: MemoryEventData): Promise<void> {
    const event: InsertBrainEvent = {
      eventType: 'memory_lookup_tool',
      eventSource: 'active_function',
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      userId: data.userId,
      targetLanguage: data.targetLanguage,
      memoryIds: data.memoryIds,
      memoryTypes: data.memoryTypes,
      queryTerms: data.queryTerms,
      resultsCount: data.resultsCount,
      relevanceScore: data.relevanceScore,
      freshnessAvgDays: data.freshnessAvgDays,
      latencyMs: data.latencyMs,
      wasUsed: true,
    };
    this.queueEvent(event);
  }

  async logToolCall(data: ToolEventData): Promise<void> {
    const event: InsertBrainEvent = {
      eventType: 'tool_call',
      eventSource: 'streaming_orchestrator',
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      userId: data.userId,
      targetLanguage: data.targetLanguage,
      toolName: data.toolName,
      latencyMs: data.latencyMs,
    };
    this.queueEvent(event);
  }

  async logActionTrigger(data: ActionTriggerEventData): Promise<void> {
    const event: InsertBrainEvent = {
      eventType: 'action_trigger',
      eventSource: 'streaming_orchestrator',
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      userId: data.userId,
      targetLanguage: data.targetLanguage,
      actionTrigger: data.actionTrigger,
      tagPayload: data.tagPayload,
    };
    this.queueEvent(event);
  }

  async logFactExtraction(data: FactExtractionEventData): Promise<void> {
    const event: InsertBrainEvent = {
      eventType: 'fact_extraction',
      eventSource: 'extraction_service',
      sessionId: data.sessionId,
      conversationId: data.conversationId,
      userId: data.userId,
      targetLanguage: data.targetLanguage,
      factType: data.factType,
      factSpecificity: data.factSpecificity,
      latencyMs: data.latencyMs,
    };
    this.queueEvent(event);
  }

  async logContextInjection(data: ContextInjectionEventData): Promise<void> {
    const event: InsertBrainEvent = {
      eventType: 'context_injection',
      eventSource: 'context_assembly',
      sessionId: data.sessionId,
      userId: data.userId,
      targetLanguage: data.targetLanguage,
      toolName: data.contextSource,
      latencyMs: data.latencyMs,
      wasUsed: data.success,
      resultsCount: data.richness,
      queryTerms: data.errorMessage || undefined,
    };
    this.queueEvent(event);
  }

  private queueEvent(event: InsertBrainEvent): void {
    this.eventQueue.push(event);
    if (this.eventQueue.length >= this.BATCH_SIZE) {
      this.flush().catch(err => {
        console.warn('[BrainHealth] Auto-flush error:', err.message);
      });
    }
  }

  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0, this.BATCH_SIZE);
    try {
      await db.insert(brainEvents).values(batch);
      console.log(`[BrainHealth] Flushed ${batch.length} events`);
    } catch (err: any) {
      console.error('[BrainHealth] Failed to flush events:', err.message);
      this.eventQueue.unshift(...batch);
    }
  }

  async getRecentEvents(limit: number = 100): Promise<typeof brainEvents.$inferSelect[]> {
    return db
      .select()
      .from(brainEvents)
      .orderBy(desc(brainEvents.createdAt))
      .limit(limit);
  }

  async getEventsByUser(userId: string, limit: number = 50): Promise<typeof brainEvents.$inferSelect[]> {
    return db
      .select()
      .from(brainEvents)
      .where(eq(brainEvents.userId, userId))
      .orderBy(desc(brainEvents.createdAt))
      .limit(limit);
  }

  async getTodaysSummary(): Promise<{
    memoryRetrievals: number;
    memoryInjections: number;
    toolCalls: number;
    actionTriggers: number;
    factsExtracted: number;
    uniqueStudents: number;
    avgLatency: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = await db
      .select()
      .from(brainEvents)
      .where(gte(brainEvents.createdAt, today));

    const memoryRetrievals = events.filter(e => e.eventType === 'memory_retrieval').length;
    const memoryInjections = events.filter(e => e.eventType === 'memory_injection').length;
    const toolCalls = events.filter(e => e.eventType === 'tool_call').length;
    const actionTriggers = events.filter(e => e.eventType === 'action_trigger').length;
    const factsExtracted = events.filter(e => e.eventType === 'fact_extraction').length;
    const uniqueStudents = new Set(events.map(e => e.userId).filter(Boolean)).size;
    const latencies = events.map(e => e.latencyMs).filter((l): l is number => l !== null);
    const avgLatency = latencies.length > 0 
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    return {
      memoryRetrievals,
      memoryInjections,
      toolCalls,
      actionTriggers,
      factsExtracted,
      uniqueStudents,
      avgLatency,
    };
  }

  async getToolBreakdown(days: number = 7): Promise<Record<string, number>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await db
      .select()
      .from(brainEvents)
      .where(and(
        eq(brainEvents.eventType, 'tool_call'),
        gte(brainEvents.createdAt, since)
      ));

    const breakdown: Record<string, number> = {};
    for (const event of events) {
      if (event.toolName) {
        breakdown[event.toolName] = (breakdown[event.toolName] || 0) + 1;
      }
    }
    return breakdown;
  }

  async getActionTriggerBreakdown(days: number = 7): Promise<Record<string, number>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await db
      .select()
      .from(brainEvents)
      .where(and(
        eq(brainEvents.eventType, 'action_trigger'),
        gte(brainEvents.createdAt, since)
      ));

    const breakdown: Record<string, number> = {};
    for (const event of events) {
      if (event.actionTrigger) {
        breakdown[event.actionTrigger] = (breakdown[event.actionTrigger] || 0) + 1;
      }
    }
    return breakdown;
  }

  async getMemoryHealthMetrics(days: number = 7): Promise<{
    totalRetrievals: number;
    totalInjections: number;
    injectionRate: number;
    avgRelevance: number;
    avgFreshnessDays: number;
    redundancyRate: number;
    memoryTypeBreakdown: Record<string, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const memoryEvents = await db
      .select()
      .from(brainEvents)
      .where(and(
        sql`${brainEvents.eventType} IN ('memory_retrieval', 'memory_injection', 'memory_lookup_tool')`,
        gte(brainEvents.createdAt, since)
      ));

    const retrievals = memoryEvents.filter(e => e.eventType === 'memory_retrieval');
    const injections = memoryEvents.filter(e => e.eventType === 'memory_injection' || e.eventType === 'memory_lookup_tool');
    
    const totalRetrievals = retrievals.length;
    const totalInjections = injections.length;
    const injectionRate = totalRetrievals > 0 ? totalInjections / totalRetrievals : 0;

    const relevanceScores = memoryEvents.map(e => e.relevanceScore).filter((s): s is number => s !== null);
    const avgRelevance = relevanceScores.length > 0
      ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length
      : 0;

    const freshnessValues = memoryEvents.map(e => e.freshnessAvgDays).filter((f): f is number => f !== null);
    const avgFreshnessDays = freshnessValues.length > 0
      ? freshnessValues.reduce((a, b) => a + b, 0) / freshnessValues.length
      : 0;

    const hashCounts = new Map<string, number>();
    for (const event of memoryEvents) {
      if (event.redundancyHash) {
        hashCounts.set(event.redundancyHash, (hashCounts.get(event.redundancyHash) || 0) + 1);
      }
    }
    const redundantEvents = Array.from(hashCounts.values()).filter(count => count > 1).length;
    const redundancyRate = hashCounts.size > 0 ? redundantEvents / hashCounts.size : 0;

    const memoryTypeBreakdown: Record<string, number> = {};
    for (const event of memoryEvents) {
      if (event.memoryTypes) {
        for (const type of event.memoryTypes) {
          memoryTypeBreakdown[type] = (memoryTypeBreakdown[type] || 0) + 1;
        }
      }
    }

    return {
      totalRetrievals,
      totalInjections,
      injectionRate,
      avgRelevance,
      avgFreshnessDays,
      redundancyRate,
      memoryTypeBreakdown,
    };
  }

  async getFactExtractionMetrics(days: number = 7): Promise<{
    totalFacts: number;
    specificFacts: number;
    vagueFacts: number;
    specificityRate: number;
    factTypeBreakdown: Record<string, number>;
  }> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await db
      .select()
      .from(brainEvents)
      .where(and(
        eq(brainEvents.eventType, 'fact_extraction'),
        gte(brainEvents.createdAt, since)
      ));

    const totalFacts = events.length;
    const specificFacts = events.filter(e => e.factSpecificity === 'specific').length;
    const vagueFacts = events.filter(e => e.factSpecificity === 'vague').length;
    const specificityRate = totalFacts > 0 ? specificFacts / totalFacts : 0;

    const factTypeBreakdown: Record<string, number> = {};
    for (const event of events) {
      if (event.factType) {
        factTypeBreakdown[event.factType] = (factTypeBreakdown[event.factType] || 0) + 1;
      }
    }

    return {
      totalFacts,
      specificFacts,
      vagueFacts,
      specificityRate,
      factTypeBreakdown,
    };
  }

  async getContextHealthSummary(hoursBack: number = 24): Promise<{
    totalInjections: number;
    successRate: number;
    avgLatencyMs: number;
    bySource: Record<string, { total: number; successes: number; failures: number; avgLatency: number; avgRichness: number }>;
    recentFailures: { source: string; error: string; timestamp: Date }[];
  }> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const events = await db
      .select()
      .from(brainEvents)
      .where(and(
        eq(brainEvents.eventType, 'context_injection'),
        gte(brainEvents.createdAt, since)
      ))
      .orderBy(desc(brainEvents.createdAt));

    const totalInjections = events.length;
    const successes = events.filter(e => e.wasUsed === true).length;
    const successRate = totalInjections > 0 ? successes / totalInjections : 1;

    const latencies = events.map(e => e.latencyMs).filter((l): l is number => l !== null);
    const avgLatencyMs = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    const bySource: Record<string, { total: number; successes: number; failures: number; avgLatency: number; avgRichness: number }> = {};
    for (const event of events) {
      const source = event.toolName || 'unknown';
      if (!bySource[source]) {
        bySource[source] = { total: 0, successes: 0, failures: 0, avgLatency: 0, avgRichness: 0 };
      }
      const s = bySource[source];
      s.total++;
      if (event.wasUsed) s.successes++;
      else s.failures++;
      if (event.latencyMs) s.avgLatency += event.latencyMs;
      if (event.resultsCount) s.avgRichness += event.resultsCount;
    }
    for (const source of Object.keys(bySource)) {
      const s = bySource[source];
      if (s.total > 0) {
        s.avgLatency = Math.round(s.avgLatency / s.total);
        s.avgRichness = Math.round((s.avgRichness / s.total) * 10) / 10;
      }
    }

    const recentFailures = events
      .filter(e => e.wasUsed === false)
      .slice(0, 10)
      .map(e => ({
        source: e.toolName || 'unknown',
        error: e.queryTerms || 'Unknown error',
        timestamp: e.createdAt,
      }));

    return { totalInjections, successRate, avgLatencyMs, bySource, recentFailures };
  }

  async getStudentCoverage(): Promise<{
    studentsWithActivity: number;
    studentsWithRichMemory: number;
    studentsWithSparseMemory: number;
    coverageByStudent: { userId: string; eventCount: number; memoryCount: number }[];
  }> {
    const events = await db
      .select()
      .from(brainEvents)
      .where(sql`${brainEvents.userId} IS NOT NULL`);

    const studentStats = new Map<string, { eventCount: number; memoryIds: Set<string> }>();
    
    for (const event of events) {
      if (!event.userId) continue;
      
      if (!studentStats.has(event.userId)) {
        studentStats.set(event.userId, { eventCount: 0, memoryIds: new Set() });
      }
      
      const stats = studentStats.get(event.userId)!;
      stats.eventCount++;
      
      if (event.memoryIds) {
        for (const id of event.memoryIds) {
          stats.memoryIds.add(id);
        }
      }
    }

    const coverageByStudent = Array.from(studentStats.entries())
      .map(([userId, stats]) => ({
        userId,
        eventCount: stats.eventCount,
        memoryCount: stats.memoryIds.size,
      }))
      .sort((a, b) => b.memoryCount - a.memoryCount);

    const studentsWithActivity = studentStats.size;
    const studentsWithRichMemory = coverageByStudent.filter(s => s.memoryCount >= 10).length;
    const studentsWithSparseMemory = coverageByStudent.filter(s => s.memoryCount < 5).length;

    return {
      studentsWithActivity,
      studentsWithRichMemory,
      studentsWithSparseMemory,
      coverageByStudent: coverageByStudent.slice(0, 20),
    };
  }

  async runDailyAggregation(targetDate?: Date): Promise<void> {
    const date = targetDate || new Date();
    date.setHours(0, 0, 0, 0);
    const dateString = date.toISOString().split('T')[0];
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    console.log(`[BrainHealth] Running daily aggregation for ${dateString}`);

    try {
      const events = await db
        .select()
        .from(brainEvents)
        .where(and(
          gte(brainEvents.createdAt, date),
          lte(brainEvents.createdAt, nextDay)
        ));

      if (events.length === 0) {
        console.log(`[BrainHealth] No events for ${dateString}`);
        return;
      }

      const memoryRetrievalCount = events.filter(e => e.eventType === 'memory_retrieval').length;
      const memoryInjectionCount = events.filter(e => e.eventType === 'memory_injection').length;
      const memoryLookupToolCount = events.filter(e => e.eventType === 'memory_lookup_tool').length;
      const toolCallCount = events.filter(e => e.eventType === 'tool_call').length;
      const actionTriggerCount = events.filter(e => e.eventType === 'action_trigger').length;
      const factsExtractedCount = events.filter(e => e.eventType === 'fact_extraction').length;
      const specificFactsCount = events.filter(e => e.eventType === 'fact_extraction' && e.factSpecificity === 'specific').length;
      const vagueFactsCount = events.filter(e => e.eventType === 'fact_extraction' && e.factSpecificity === 'vague').length;

      const relevanceScores = events.map(e => e.relevanceScore).filter((s): s is number => s !== null);
      const avgRelevanceScore = relevanceScores.length > 0
        ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length
        : null;

      const freshnessValues = events.map(e => e.freshnessAvgDays).filter((f): f is number => f !== null);
      const avgFreshnessDays = freshnessValues.length > 0
        ? freshnessValues.reduce((a, b) => a + b, 0) / freshnessValues.length
        : null;

      const usedEvents = events.filter(e => e.wasUsed === true).length;
      const memoryUsageRate = (memoryRetrievalCount + memoryInjectionCount + memoryLookupToolCount) > 0
        ? usedEvents / (memoryRetrievalCount + memoryInjectionCount + memoryLookupToolCount)
        : null;

      const hashCounts = new Map<string, number>();
      for (const event of events) {
        if (event.redundancyHash) {
          hashCounts.set(event.redundancyHash, (hashCounts.get(event.redundancyHash) || 0) + 1);
        }
      }
      const redundantHashes = Array.from(hashCounts.values()).filter(c => c > 1).length;
      const redundancyRate = hashCounts.size > 0 ? redundantHashes / hashCounts.size : null;

      const memoryTypeDiversity: Record<string, number> = {};
      const factTypeDiversity: Record<string, number> = {};
      const toolBreakdown: Record<string, number> = {};
      const actionTriggerBreakdown: Record<string, number> = {};

      for (const event of events) {
        if (event.memoryTypes) {
          for (const type of event.memoryTypes) {
            memoryTypeDiversity[type] = (memoryTypeDiversity[type] || 0) + 1;
          }
        }
        if (event.factType) {
          factTypeDiversity[event.factType] = (factTypeDiversity[event.factType] || 0) + 1;
        }
        if (event.toolName) {
          toolBreakdown[event.toolName] = (toolBreakdown[event.toolName] || 0) + 1;
        }
        if (event.actionTrigger) {
          actionTriggerBreakdown[event.actionTrigger] = (actionTriggerBreakdown[event.actionTrigger] || 0) + 1;
        }
      }

      const uniqueSessions = new Set(events.map(e => e.sessionId).filter(Boolean));
      const uniqueStudents = new Set(events.map(e => e.userId).filter(Boolean));
      const studentsWithMemoryActivity = new Set(
        events.filter(e => e.eventType === 'memory_injection' || e.eventType === 'memory_lookup_tool')
          .map(e => e.userId).filter(Boolean)
      );

      const latencies = events.map(e => e.latencyMs).filter((l): l is number => l !== null);
      const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
      const sortedLatencies = latencies.sort((a, b) => a - b);
      const p95LatencyMs = sortedLatencies.length > 0 
        ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] 
        : null;

      const existingMetric = await db.select().from(brainDailyMetrics)
        .where(and(
          eq(brainDailyMetrics.metricDate, dateString),
          sql`${brainDailyMetrics.userId} IS NULL`
        )).limit(1);

      const metricData = {
        metricDate: dateString,
        userId: null,
        targetLanguage: null,
        memoryRetrievalCount,
        memoryInjectionCount,
        memoryLookupToolCount,
        avgRelevanceScore,
        avgFreshnessDays,
        memoryUsageRate,
        redundancyRate,
        memoryTypeDiversity,
        factTypeDiversity,
        factsExtractedCount,
        specificFactsCount,
        vagueFactsCount,
        factSpecificityRate: factsExtractedCount > 0 ? specificFactsCount / factsExtractedCount : null,
        toolCallCount,
        toolBreakdown,
        actionTriggerCount,
        actionTriggerBreakdown,
        uniqueSessionsCount: uniqueSessions.size,
        uniqueStudentsCount: uniqueStudents.size,
        studentsWithMemoryActivity: studentsWithMemoryActivity.size,
        studentCoverageRate: uniqueStudents.size > 0 ? studentsWithMemoryActivity.size / uniqueStudents.size : null,
        avgLatencyMs,
        p95LatencyMs,
      };

      if (existingMetric.length > 0) {
        await db.update(brainDailyMetrics)
          .set({ ...metricData, updatedAt: new Date() })
          .where(eq(brainDailyMetrics.id, existingMetric[0].id));
      } else {
        await db.insert(brainDailyMetrics).values(metricData);
      }

      console.log(`[BrainHealth] Aggregated ${events.length} events for ${dateString}`);
    } catch (err: any) {
      console.error(`[BrainHealth] Daily aggregation failed:`, err.message);
    }
  }

  async getDailyMetrics(days: number = 30): Promise<typeof brainDailyMetrics.$inferSelect[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceString = since.toISOString().split('T')[0];

    return db
      .select()
      .from(brainDailyMetrics)
      .where(gte(brainDailyMetrics.metricDate, sinceString))
      .orderBy(desc(brainDailyMetrics.metricDate));
  }

  async getDashboardSummary(): Promise<{
    today: {
      memoryRetrievals: number;
      memoryInjections: number;
      toolCalls: number;
      actionTriggers: number;
      factsExtracted: number;
      uniqueStudents: number;
      avgLatency: number;
    };
    trends: {
      date: string;
      injections: number;
      toolCalls: number;
      factsExtracted: number;
    }[];
    topTools: { name: string; count: number }[];
    topTriggers: { name: string; count: number }[];
    memoryHealth: {
      avgRelevance: number;
      avgFreshnessDays: number;
      injectionRate: number;
      redundancyRate: number;
    };
    factQuality: {
      totalFacts: number;
      specificityRate: number;
    };
  }> {
    const today = await this.getTodaysSummary();
    const toolBreakdown = await this.getToolBreakdown(7);
    const triggerBreakdown = await this.getActionTriggerBreakdown(7);
    const memoryHealth = await this.getMemoryHealthMetrics(7);
    const factMetrics = await this.getFactExtractionMetrics(7);

    const dailyMetrics = await this.getDailyMetrics(14);
    const trends = dailyMetrics.map(m => ({
      date: String(m.metricDate),
      injections: m.memoryInjectionCount || 0,
      toolCalls: m.toolCallCount || 0,
      factsExtracted: m.factsExtractedCount || 0,
    })).reverse();

    const topTools = Object.entries(toolBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topTriggers = Object.entries(triggerBreakdown)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      today,
      trends,
      topTools,
      topTriggers,
      memoryHealth: {
        avgRelevance: memoryHealth.avgRelevance,
        avgFreshnessDays: memoryHealth.avgFreshnessDays,
        injectionRate: memoryHealth.injectionRate,
        redundancyRate: memoryHealth.redundancyRate,
      },
      factQuality: {
        totalFacts: factMetrics.totalFacts,
        specificityRate: factMetrics.specificityRate,
      },
    };
  }

  /**
   * Get live events with filtering for real-time monitoring
   */
  async getLiveEvents(options: {
    limit?: number;
    sinceSeconds?: number;
    sessionId?: string;
    eventTypes?: string[];
  } = {}): Promise<{
    events: typeof brainEvents.$inferSelect[];
    totalCount: number;
    oldestTimestamp: Date | null;
  }> {
    const { limit = 50, sinceSeconds = 60, sessionId, eventTypes } = options;
    
    const since = new Date(Date.now() - sinceSeconds * 1000);
    
    let query = db.select().from(brainEvents);
    
    const conditions = [gte(brainEvents.createdAt, since)];
    
    if (sessionId) {
      conditions.push(eq(brainEvents.sessionId, sessionId));
    }
    
    const events = await query
      .where(and(...conditions))
      .orderBy(desc(brainEvents.createdAt))
      .limit(limit);
    
    // Filter by event types in memory if specified
    const filtered = eventTypes && eventTypes.length > 0
      ? events.filter(e => eventTypes.includes(e.eventType))
      : events;
    
    return {
      events: filtered,
      totalCount: filtered.length,
      oldestTimestamp: filtered.length > 0 ? filtered[filtered.length - 1].createdAt : null,
    };
  }

  /**
   * Get events for a specific voice session
   */
  async getSessionEvents(sessionId: string): Promise<{
    events: typeof brainEvents.$inferSelect[];
    summary: {
      memoryInjections: number;
      toolCalls: number;
      actionTriggers: number;
      factsExtracted: number;
      avgLatency: number;
      avgRelevance: number;
      duration: number | null;
    };
  }> {
    const events = await db
      .select()
      .from(brainEvents)
      .where(eq(brainEvents.sessionId, sessionId))
      .orderBy(desc(brainEvents.createdAt));
    
    const memoryInjections = events.filter(e => e.eventType === 'memory_injection').length;
    const toolCalls = events.filter(e => e.eventType === 'tool_call').length;
    const actionTriggers = events.filter(e => e.eventType === 'action_trigger').length;
    const factsExtracted = events.filter(e => e.eventType === 'fact_extraction').length;
    
    const latencies = events.map(e => e.latencyMs).filter((l): l is number => l !== null);
    const avgLatency = latencies.length > 0 
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
    
    const relevanceScores = events.map(e => e.relevanceScore).filter((s): s is number => s !== null);
    const avgRelevance = relevanceScores.length > 0
      ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length
      : 0;
    
    let duration: number | null = null;
    if (events.length >= 2) {
      const firstEvent = events[events.length - 1];
      const lastEvent = events[0];
      if (firstEvent.createdAt && lastEvent.createdAt) {
        duration = Math.round((lastEvent.createdAt.getTime() - firstEvent.createdAt.getTime()) / 1000);
      }
    }
    
    return {
      events,
      summary: {
        memoryInjections,
        toolCalls,
        actionTriggers,
        factsExtracted,
        avgLatency,
        avgRelevance,
        duration,
      },
    };
  }

  /**
   * Detect anomalies in brain health metrics for debugging
   */
  async detectAnomalies(hoursBack: number = 24): Promise<{
    anomalies: Array<{
      type: 'high_latency' | 'low_relevance' | 'high_redundancy' | 'extraction_failure' | 'memory_starvation';
      severity: 'warning' | 'critical';
      message: string;
      affectedEvents: number;
      sampleEventIds: string[];
    }>;
    healthScore: number;
    recommendation: string | null;
  }> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    const events = await db
      .select()
      .from(brainEvents)
      .where(gte(brainEvents.createdAt, since));
    
    const anomalies: Array<{
      type: 'high_latency' | 'low_relevance' | 'high_redundancy' | 'extraction_failure' | 'memory_starvation';
      severity: 'warning' | 'critical';
      message: string;
      affectedEvents: number;
      sampleEventIds: string[];
    }> = [];
    
    // Check for high latency events (>500ms)
    const highLatencyEvents = events.filter(e => e.latencyMs && e.latencyMs > 500);
    if (highLatencyEvents.length > 5) {
      const avgLatency = highLatencyEvents.reduce((a, e) => a + (e.latencyMs || 0), 0) / highLatencyEvents.length;
      anomalies.push({
        type: 'high_latency',
        severity: avgLatency > 1000 ? 'critical' : 'warning',
        message: `${highLatencyEvents.length} events with latency >500ms (avg: ${Math.round(avgLatency)}ms)`,
        affectedEvents: highLatencyEvents.length,
        sampleEventIds: highLatencyEvents.slice(0, 5).map(e => e.id),
      });
    }
    
    // Check for low relevance scores (<0.5)
    const lowRelevanceEvents = events.filter(e => e.relevanceScore !== null && e.relevanceScore < 0.5);
    const relevanceEvents = events.filter(e => e.relevanceScore !== null);
    if (relevanceEvents.length > 10 && lowRelevanceEvents.length / relevanceEvents.length > 0.3) {
      anomalies.push({
        type: 'low_relevance',
        severity: lowRelevanceEvents.length / relevanceEvents.length > 0.5 ? 'critical' : 'warning',
        message: `${Math.round(lowRelevanceEvents.length / relevanceEvents.length * 100)}% of memory retrievals have low relevance (<0.5)`,
        affectedEvents: lowRelevanceEvents.length,
        sampleEventIds: lowRelevanceEvents.slice(0, 5).map(e => e.id),
      });
    }
    
    // Check for high redundancy (same memories fetched repeatedly)
    const hashCounts = new Map<string, number>();
    for (const event of events) {
      if (event.redundancyHash) {
        hashCounts.set(event.redundancyHash, (hashCounts.get(event.redundancyHash) || 0) + 1);
      }
    }
    const redundantHashes = Array.from(hashCounts.entries()).filter(([, count]) => count > 3);
    if (redundantHashes.length > 5) {
      anomalies.push({
        type: 'high_redundancy',
        severity: redundantHashes.length > 20 ? 'critical' : 'warning',
        message: `${redundantHashes.length} memory combinations fetched 4+ times (potential caching opportunity)`,
        affectedEvents: redundantHashes.reduce((a, [, count]) => a + count, 0),
        sampleEventIds: events.filter(e => redundantHashes.some(([hash]) => e.redundancyHash === hash)).slice(0, 5).map(e => e.id),
      });
    }
    
    // Check for memory starvation (sessions with no memory injections)
    const sessionEvents = new Map<string, { injections: number; total: number }>();
    for (const event of events) {
      if (event.sessionId) {
        if (!sessionEvents.has(event.sessionId)) {
          sessionEvents.set(event.sessionId, { injections: 0, total: 0 });
        }
        const stats = sessionEvents.get(event.sessionId)!;
        stats.total++;
        if (event.eventType === 'memory_injection') {
          stats.injections++;
        }
      }
    }
    const starvedSessions = Array.from(sessionEvents.entries())
      .filter(([, stats]) => stats.total >= 5 && stats.injections === 0);
    if (starvedSessions.length > 2) {
      anomalies.push({
        type: 'memory_starvation',
        severity: starvedSessions.length > 10 ? 'critical' : 'warning',
        message: `${starvedSessions.length} sessions have no memory injections (Daniela may lack context)`,
        affectedEvents: starvedSessions.reduce((a, [, stats]) => a + stats.total, 0),
        sampleEventIds: [],
      });
    }
    
    // Calculate overall health score (0-100)
    let healthScore = 100;
    for (const anomaly of anomalies) {
      if (anomaly.severity === 'critical') {
        healthScore -= 20;
      } else {
        healthScore -= 10;
      }
    }
    healthScore = Math.max(0, healthScore);
    
    // Generate recommendation
    let recommendation: string | null = null;
    if (anomalies.length > 0) {
      const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
      if (criticalCount > 0) {
        recommendation = `${criticalCount} critical issue(s) detected. Focus on: ${anomalies.filter(a => a.severity === 'critical').map(a => a.type).join(', ')}`;
      } else {
        recommendation = `${anomalies.length} warning(s) detected. Monitor: ${anomalies.map(a => a.type).join(', ')}`;
      }
    }
    
    return {
      anomalies,
      healthScore,
      recommendation,
    };
  }

  async getContextInjectionHealth(hoursBack: number = 24): Promise<{
    sources: Record<string, { total: number; successes: number; failures: number; avgLatencyMs: number; successRate: number }>;
    overallSuccessRate: number;
    totalEvents: number;
    slowestSource: string | null;
  }> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const rows = await db.select()
      .from(brainEvents)
      .where(and(
        eq(brainEvents.eventType, 'context_injection'),
        gte(brainEvents.createdAt, since)
      ));

    const sources: Record<string, { total: number; successes: number; failures: number; totalLatency: number; avgLatencyMs: number; successRate: number }> = {};
    for (const row of rows) {
      const src = row.toolName || 'unknown';
      if (!sources[src]) {
        sources[src] = { total: 0, successes: 0, failures: 0, totalLatency: 0, avgLatencyMs: 0, successRate: 0 };
      }
      sources[src].total++;
      if (row.wasUsed) sources[src].successes++;
      else sources[src].failures++;
      sources[src].totalLatency += (row.latencyMs || 0);
    }

    let slowestSource: string | null = null;
    let slowestAvg = 0;
    for (const [src, stats] of Object.entries(sources)) {
      stats.avgLatencyMs = stats.total > 0 ? Math.round(stats.totalLatency / stats.total) : 0;
      stats.successRate = stats.total > 0 ? Math.round((stats.successes / stats.total) * 100) : 0;
      if (stats.avgLatencyMs > slowestAvg) {
        slowestAvg = stats.avgLatencyMs;
        slowestSource = src;
      }
    }

    const totalEvents = rows.length;
    const totalSuccesses = Object.values(sources).reduce((a, s) => a + s.successes, 0);
    const overallSuccessRate = totalEvents > 0 ? Math.round((totalSuccesses / totalEvents) * 100) : 100;

    const cleanSources: Record<string, { total: number; successes: number; failures: number; avgLatencyMs: number; successRate: number }> = {};
    for (const [src, stats] of Object.entries(sources)) {
      const { totalLatency, ...rest } = stats;
      cleanSources[src] = rest;
    }

    return { sources: cleanSources, overallSuccessRate, totalEvents, slowestSource };
  }

  shutdown(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    this.flush().catch(() => {});
  }
}

export const brainHealthTelemetry = new BrainHealthTelemetry();
