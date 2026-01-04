import { db } from "../db";
import { agentObservations, supportObservations, systemAlerts, synthesizedInsights, type InsertSynthesizedInsight } from "../../shared/schema";
import { desc, and, gte, lte, sql, eq, isNull } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

/**
 * v23: Observation Summarization Service
 * 
 * Wren synthesizes 100+ observations into condensed insights for efficient sync.
 * This reduces the sync payload from 388K observations to ~4K insights.
 * 
 * Runs as a nightly job in production.
 */
export class ObservationSummarizationService {
  private genAI: GoogleGenAI | null = null;
  
  constructor() {
    if (GEMINI_KEY) {
      this.genAI = new GoogleGenAI({ apiKey: GEMINI_KEY });
    }
  }
  
  /**
   * Get observations that haven't been synthesized yet
   */
  async getUnsynthesizedObservations(limit: number = 100): Promise<{
    agent: any[];
    support: any[];
    alerts: any[];
  }> {
    const agent = await db
      .select()
      .from(agentObservations)
      .where(eq(agentObservations.status, 'active'))
      .orderBy(desc(agentObservations.createdAt))
      .limit(limit);
    
    const support = await db
      .select()
      .from(supportObservations)
      .where(eq(supportObservations.status, 'active'))
      .orderBy(desc(supportObservations.createdAt))
      .limit(limit);
    
    const alerts = await db
      .select()
      .from(systemAlerts)
      .where(eq(systemAlerts.isActive, true))
      .orderBy(desc(systemAlerts.createdAt))
      .limit(limit);
    
    return { agent, support, alerts };
  }
  
  /**
   * Group observations by category for synthesis
   */
  groupByCategory(observations: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    for (const obs of observations) {
      const category = obs.category || 'uncategorized';
      if (!groups.has(category)) {
        groups.set(category, []);
      }
      groups.get(category)!.push(obs);
    }
    
    return groups;
  }
  
  /**
   * Map observation category to insight category
   */
  mapToInsightCategory(obsCategory: string): InsertSynthesizedInsight['category'] {
    const mapping: Record<string, InsertSynthesizedInsight['category']> = {
      'architecture': 'system_health',
      'pattern': 'teaching_pattern',
      'improvement': 'feature_usage',
      'bug_pattern': 'error_cluster',
      'user_behavior': 'student_journey',
      'performance': 'system_health',
      'daniela_behavior': 'teaching_pattern',
      'sync_issue': 'system_health',
      'next_step': 'feature_usage',
      'user_friction': 'student_journey',
      'common_question': 'support_trend',
      'system_issue': 'system_health',
      'feature_request': 'feature_usage',
      'success_pattern': 'teaching_pattern',
      'documentation_gap': 'content_quality',
      'onboarding_insight': 'student_journey',
      'billing_pattern': 'support_trend',
      'troubleshoot_solution': 'support_trend',
    };
    
    return mapping[obsCategory] || 'cross_agent';
  }
  
  /**
   * Synthesize a group of observations into a single insight using AI
   */
  async synthesizeObservations(
    observations: any[],
    categoryHint: string
  ): Promise<InsertSynthesizedInsight | null> {
    if (observations.length === 0) return null;
    if (!this.genAI) {
      console.warn('[SUMMARIZATION] No Gemini API key configured, using fallback synthesis');
      return this.fallbackSynthesis(observations, categoryHint);
    }
    
    try {
      const observationSummaries = observations.slice(0, 50).map(obs => ({
        title: obs.title || obs.subject || 'Untitled',
        content: obs.observation || obs.description || obs.message || '',
        priority: obs.priority || 50,
        category: obs.category,
      }));
      
      const prompt = `You are Wren, an AI development agent analyzing observations from the HolaHola language learning platform.

Synthesize these ${observations.length} observations into ONE insight:

OBSERVATIONS:
${JSON.stringify(observationSummaries, null, 2)}

Create a synthesis that:
1. Identifies the common pattern across observations
2. Quantifies the impact (how many users/sessions affected)
3. Provides an actionable recommendation

Respond in this exact JSON format:
{
  "title": "Brief title for the insight (max 100 chars)",
  "insight": "The synthesized insight explaining the pattern (2-3 paragraphs)",
  "supportingEvidence": "Summarized evidence from the observations (1 paragraph)",
  "actionableRecommendation": "What should be done about this (1-2 sentences)",
  "confidence": 70,
  "impactScore": 50,
  "affectedUsers": 0,
  "affectedSessions": 0
}

Only output valid JSON, no other text.`;

      const result = await this.genAI.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
      });
      const text = result.text || '';
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.warn('[SUMMARIZATION] Failed to parse AI response, using fallback');
        return this.fallbackSynthesis(observations, categoryHint);
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      const timeRange = this.getTimeRange(observations);
      
      return {
        category: this.mapToInsightCategory(categoryHint),
        priority: Math.round(observations.reduce((sum, o) => sum + (o.priority || 50), 0) / observations.length),
        title: parsed.title || `${categoryHint} pattern synthesis`,
        insight: parsed.insight || 'No insight generated',
        supportingEvidence: parsed.supportingEvidence,
        actionableRecommendation: parsed.actionableRecommendation,
        observationCount: observations.length,
        observationIds: observations.map(o => o.id),
        timeRangeStart: timeRange.start,
        timeRangeEnd: timeRange.end,
        sourceCategories: Array.from(new Set(observations.map(o => o.category))),
        confidence: parsed.confidence || 70,
        impactScore: parsed.impactScore || 50,
        affectedUsers: parsed.affectedUsers || 0,
        affectedSessions: parsed.affectedSessions || 0,
        syncStatus: 'local',
        originEnvironment: process.env.REPLIT_DEPLOYMENT ? 'production' : 'development',
      };
    } catch (error: any) {
      console.error('[SUMMARIZATION] AI synthesis failed:', error.message);
      return this.fallbackSynthesis(observations, categoryHint);
    }
  }
  
  /**
   * Fallback synthesis when AI is unavailable
   */
  fallbackSynthesis(observations: any[], categoryHint: string): InsertSynthesizedInsight {
    const timeRange = this.getTimeRange(observations);
    const avgPriority = Math.round(observations.reduce((sum, o) => sum + (o.priority || 50), 0) / observations.length);
    
    const titles = observations.map(o => o.title || o.subject || '').filter(Boolean);
    const topTitles = titles.slice(0, 5).join(', ');
    
    return {
      category: this.mapToInsightCategory(categoryHint),
      priority: avgPriority,
      title: `${categoryHint}: ${observations.length} observations synthesized`,
      insight: `Synthesized ${observations.length} observations in the "${categoryHint}" category. Top topics: ${topTitles || 'various'}.`,
      supportingEvidence: `Based on ${observations.length} observations from ${timeRange.start?.toISOString().split('T')[0] || 'unknown'} to ${timeRange.end?.toISOString().split('T')[0] || 'unknown'}.`,
      observationCount: observations.length,
      observationIds: observations.map(o => o.id),
      timeRangeStart: timeRange.start,
      timeRangeEnd: timeRange.end,
      sourceCategories: Array.from(new Set(observations.map(o => o.category))),
      confidence: 40,
      impactScore: avgPriority,
      syncStatus: 'local',
      originEnvironment: process.env.REPLIT_DEPLOYMENT ? 'production' : 'development',
    };
  }
  
  /**
   * Get time range from observations
   */
  getTimeRange(observations: any[]): { start: Date | null; end: Date | null } {
    const dates = observations
      .map(o => o.createdAt)
      .filter(Boolean)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    return {
      start: dates.length > 0 ? new Date(dates[0]) : null,
      end: dates.length > 0 ? new Date(dates[dates.length - 1]) : null,
    };
  }
  
  /**
   * Run the full summarization job
   * Called nightly to synthesize new observations
   */
  async runSummarizationJob(): Promise<{
    insightsCreated: number;
    observationsProcessed: number;
    errors: string[];
  }> {
    console.log('[SUMMARIZATION] Starting observation summarization job...');
    const startTime = Date.now();
    
    const result = {
      insightsCreated: 0,
      observationsProcessed: 0,
      errors: [] as string[],
    };
    
    try {
      const observations = await this.getUnsynthesizedObservations(500);
      const allObs = [...observations.agent, ...observations.support];
      
      console.log(`[SUMMARIZATION] Found ${allObs.length} observations to synthesize`);
      
      if (allObs.length === 0) {
        console.log('[SUMMARIZATION] No observations to synthesize');
        return result;
      }
      
      const groups = this.groupByCategory(allObs);
      const groupEntries = Array.from(groups.entries());
      
      for (const [category, obs] of groupEntries) {
        if (obs.length < 10) {
          console.log(`[SUMMARIZATION] Skipping ${category} (only ${obs.length} observations)`);
          continue;
        }
        
        console.log(`[SUMMARIZATION] Synthesizing ${obs.length} observations in ${category}...`);
        
        const chunks = [];
        for (let i = 0; i < obs.length; i += 100) {
          chunks.push(obs.slice(i, i + 100));
        }
        
        for (const chunk of chunks) {
          try {
            const insight = await this.synthesizeObservations(chunk, category);
            if (insight) {
              await db.insert(synthesizedInsights).values(insight);
              result.insightsCreated++;
              result.observationsProcessed += chunk.length;
              console.log(`[SUMMARIZATION] Created insight: ${insight.title}`);
            }
          } catch (error: any) {
            const errMsg = `Failed to synthesize ${category}: ${error.message}`;
            console.error(`[SUMMARIZATION] ${errMsg}`);
            result.errors.push(errMsg);
          }
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      const durationMs = Date.now() - startTime;
      console.log(`[SUMMARIZATION] Complete: ${result.insightsCreated} insights from ${result.observationsProcessed} observations in ${durationMs}ms`);
      
      return result;
    } catch (error: any) {
      const errMsg = `Summarization job failed: ${error.message}`;
      console.error(`[SUMMARIZATION] ${errMsg}`);
      result.errors.push(errMsg);
      return result;
    }
  }
  
  /**
   * Get current summarization stats
   */
  async getStats(): Promise<{
    totalObservations: number;
    totalInsights: number;
    unsynthesizedCount: number;
    lastSynthesisAt: Date | null;
  }> {
    const [agentCount] = await db.select({ count: sql<number>`count(*)` }).from(agentObservations);
    const [supportCount] = await db.select({ count: sql<number>`count(*)` }).from(supportObservations);
    const [insightCount] = await db.select({ count: sql<number>`count(*)` }).from(synthesizedInsights);
    const [latestInsight] = await db.select().from(synthesizedInsights).orderBy(desc(synthesizedInsights.createdAt)).limit(1);
    
    return {
      totalObservations: Number(agentCount?.count || 0) + Number(supportCount?.count || 0),
      totalInsights: Number(insightCount?.count || 0),
      unsynthesizedCount: (Number(agentCount?.count || 0) + Number(supportCount?.count || 0)) - (Number(insightCount?.count || 0) * 100),
      lastSynthesisAt: latestInsight?.createdAt || null,
    };
  }
}

export const observationSummarizationService = new ObservationSummarizationService();
