/**
 * Wren Intelligence Service
 * 
 * Provides automatic insight capture, decay/reinforcement, and cross-session
 * threading for Wren's emergent intelligence system.
 * 
 * Core capabilities:
 * 1. Automatic insight capture - analyze work patterns and generate insights
 * 2. Decay/reinforcement - track usage and surface frequently-used insights
 * 3. Cross-session threading - link related insights for knowledge graphs
 */

import { db } from '../db';
import { wrenInsights, type WrenInsight, type InsertWrenInsight } from '@shared/schema';
import { eq, desc, sql, and, gte, lte, or, ilike } from 'drizzle-orm';
import { storage } from '../storage';
import { neuralNetworkSync } from './neural-network-sync';

// Insight categories and their detection patterns
const CATEGORY_PATTERNS: Record<string, RegExp[]> = {
  'pattern': [
    /pattern/i, /recurring/i, /common approach/i, /best practice/i,
    /whenever.*should/i, /always.*when/i
  ],
  'solution': [
    /fix(ed)?/i, /solved/i, /resolution/i, /workaround/i,
    /the answer/i, /solution/i
  ],
  'gotcha': [
    /gotcha/i, /pitfall/i, /watch out/i, /careful/i, /trap/i,
    /don't forget/i, /easy to miss/i, /subtle/i
  ],
  'architecture': [
    /architecture/i, /design/i, /structure/i, /system/i,
    /component/i, /service/i, /layer/i
  ],
  'debugging': [
    /debug/i, /error/i, /issue/i, /bug/i, /trace/i,
    /root cause/i, /investigation/i
  ],
  'integration': [
    /integrat/i, /connect/i, /api/i, /endpoint/i,
    /external/i, /third-party/i
  ],
  'performance': [
    /performance/i, /optimi/i, /speed/i, /cache/i,
    /efficient/i, /slow/i, /fast/i
  ]
};

// Tags commonly associated with categories
const CATEGORY_TAGS: Record<string, string[]> = {
  'pattern': ['reusable', 'convention', 'standard'],
  'solution': ['fix', 'resolved', 'working'],
  'gotcha': ['caution', 'edge-case', 'quirk'],
  'architecture': ['design', 'structure', 'system'],
  'debugging': ['troubleshooting', 'diagnosis', 'trace'],
  'integration': ['api', 'external', 'connection'],
  'performance': ['optimization', 'speed', 'efficiency']
};

export class WrenIntelligenceService {
  
  /**
   * Automatically detect the category of an insight based on content
   */
  detectCategory(content: string, context?: string): string {
    const textToAnalyze = `${content} ${context || ''}`.toLowerCase();
    
    let bestMatch = 'pattern'; // default
    let highestScore = 0;
    
    for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
      let score = 0;
      for (const pattern of patterns) {
        if (pattern.test(textToAnalyze)) {
          score++;
        }
      }
      if (score > highestScore) {
        highestScore = score;
        bestMatch = category;
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Extract suggested tags from content
   */
  extractTags(content: string, context?: string): string[] {
    const textToAnalyze = `${content} ${context || ''}`.toLowerCase();
    const tags: Set<string> = new Set();
    
    // Extract file-related tags
    const filePatterns = /\b(schema|routes?|storage|service|component|hook|util|api)\b/gi;
    let match;
    while ((match = filePatterns.exec(textToAnalyze)) !== null) {
      tags.add(match[1].toLowerCase());
    }
    
    // Extract technology tags
    const techPatterns = /\b(react|express|drizzle|postgres|gemini|anthropic|websocket|stripe)\b/gi;
    while ((match = techPatterns.exec(textToAnalyze)) !== null) {
      tags.add(match[1].toLowerCase());
    }
    
    // Extract domain tags
    const domainPatterns = /\b(auth|voice|chat|tutor|student|lesson|curriculum|billing)\b/gi;
    while ((match = domainPatterns.exec(textToAnalyze)) !== null) {
      tags.add(match[1].toLowerCase());
    }
    
    return Array.from(tags).slice(0, 10);
  }
  
  /**
   * Extract file references from content
   */
  extractFileReferences(content: string, context?: string): string[] {
    const textToAnalyze = `${content} ${context || ''}`;
    const files: Set<string> = new Set();
    
    // Match file paths
    const filePatterns = [
      /(?:^|\s)([a-zA-Z0-9_\-\/]+\.(ts|tsx|js|jsx|json|md|css|sql))\b/g,
      /`([a-zA-Z0-9_\-\/]+\.(ts|tsx|js|jsx|json|md|css|sql))`/g,
      /'([a-zA-Z0-9_\-\/]+\.(ts|tsx|js|jsx|json|md|css|sql))'/g,
    ];
    
    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(textToAnalyze)) !== null) {
        files.add(match[1]);
      }
    }
    
    return Array.from(files).slice(0, 10);
  }
  
  /**
   * Create an insight with automatic enrichment
   * Detects category, extracts tags and file references if not provided
   * Auto-shares significant insights (architecture, gotcha, solution) with Daniela
   */
  async createEnrichedInsight(params: {
    title: string;
    content: string;
    context?: string;
    category?: string;
    tags?: string[];
    relatedFiles?: string[];
    sessionId?: string;
    shareWithDaniela?: boolean;
  }): Promise<WrenInsight> {
    const category = params.category || this.detectCategory(params.content, params.context);
    const tags = params.tags?.length 
      ? params.tags 
      : this.extractTags(params.content, params.context);
    const relatedFiles = params.relatedFiles?.length 
      ? params.relatedFiles 
      : this.extractFileReferences(params.content, params.context);
    
    const insight = await storage.createWrenInsight({
      category: category as any,
      title: params.title,
      content: params.content,
      context: params.context || null,
      tags,
      relatedFiles,
      environment: 'development',
      sessionId: params.sessionId || null,
    });

    // Auto-share significant insights with Daniela
    // Categories that benefit teaching: architecture, gotcha, solution, debugging
    const shareableCategories = ['architecture', 'gotcha', 'solution', 'debugging', 'integration'];
    const shouldShare = params.shareWithDaniela !== false && shareableCategories.includes(category);
    
    if (shouldShare) {
      try {
        await neuralNetworkSync.shareInsightWithDaniela({
          insightId: insight.id,
          category: category as any,
          title: params.title,
          content: params.content,
          teachingRelevance: params.context,
        });
        console.log(`[WrenIntelligence] Auto-shared insight "${params.title}" with Daniela`);
      } catch (error) {
        console.error('[WrenIntelligence] Failed to auto-share insight with Daniela:', error);
      }
    }

    return insight;
  }
  
  // ============================================================================
  // DECAY/REINFORCEMENT SYSTEM
  // ============================================================================
  
  /**
   * Increment the use count for an insight (reinforcement)
   */
  async reinforceInsight(insightId: string): Promise<WrenInsight | null> {
    const [updated] = await db
      .update(wrenInsights)
      .set({
        useCount: sql`${wrenInsights.useCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(wrenInsights.id, insightId))
      .returning();
    
    return updated || null;
  }
  
  /**
   * Get insights ranked by relevance (use count + recency)
   * Higher use count and more recent = higher rank
   */
  async getRankedInsights(limit: number = 20): Promise<WrenInsight[]> {
    // Score = useCount * 10 + recency_bonus (days since last use, inverted)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    return db
      .select()
      .from(wrenInsights)
      .orderBy(
        desc(wrenInsights.useCount),
        desc(wrenInsights.lastUsedAt),
        desc(wrenInsights.createdAt)
      )
      .limit(limit);
  }
  
  /**
   * Get insights that haven't been used recently (candidates for review/archival)
   */
  async getStaleInsights(daysSinceUse: number = 30): Promise<WrenInsight[]> {
    const cutoff = new Date(Date.now() - daysSinceUse * 24 * 60 * 60 * 1000);
    
    return db
      .select()
      .from(wrenInsights)
      .where(
        or(
          lte(wrenInsights.lastUsedAt, cutoff),
          and(
            sql`${wrenInsights.lastUsedAt} IS NULL`,
            lte(wrenInsights.createdAt, cutoff)
          )
        )
      )
      .orderBy(wrenInsights.createdAt);
  }
  
  /**
   * Get top insights by category
   */
  async getTopInsightsByCategory(category: string, limit: number = 5): Promise<WrenInsight[]> {
    return db
      .select()
      .from(wrenInsights)
      .where(eq(wrenInsights.category, category as any))
      .orderBy(desc(wrenInsights.useCount), desc(wrenInsights.lastUsedAt))
      .limit(limit);
  }
  
  /**
   * Apply decay to stale insights
   * Reduces use count for insights not accessed in 30+ days
   * This ensures fresh insights bubble to the top over time
   */
  async applyDecay(daysSinceUse: number = 30): Promise<{ decayedCount: number }> {
    const cutoff = new Date(Date.now() - daysSinceUse * 24 * 60 * 60 * 1000);
    
    // Find insights that haven't been used recently and have a use count > 0
    const staleInsights = await db
      .select()
      .from(wrenInsights)
      .where(
        and(
          or(
            lte(wrenInsights.lastUsedAt, cutoff),
            and(
              sql`${wrenInsights.lastUsedAt} IS NULL`,
              lte(wrenInsights.createdAt, cutoff)
            )
          ),
          sql`${wrenInsights.useCount} > 0`
        )
      );
    
    if (staleInsights.length === 0) {
      return { decayedCount: 0 };
    }
    
    // Decay: reduce use count by 1 for each stale insight
    await db
      .update(wrenInsights)
      .set({
        useCount: sql`GREATEST(0, ${wrenInsights.useCount} - 1)`,
      })
      .where(
        and(
          or(
            lte(wrenInsights.lastUsedAt, cutoff),
            and(
              sql`${wrenInsights.lastUsedAt} IS NULL`,
              lte(wrenInsights.createdAt, cutoff)
            )
          ),
          sql`${wrenInsights.useCount} > 0`
        )
      );
    
    console.log(`[WrenIntelligence] Applied decay to ${staleInsights.length} stale insights`);
    return { decayedCount: staleInsights.length };
  }
  
  // ============================================================================
  // CROSS-SESSION THREADING
  // ============================================================================
  
  /**
   * Find related insights based on shared tags, files, or content similarity
   */
  async findRelatedInsights(insightId: string, limit: number = 5): Promise<WrenInsight[]> {
    const insight = await storage.getWrenInsight(insightId);
    if (!insight) return [];
    
    const relatedIds: Set<string> = new Set();
    const related: WrenInsight[] = [];
    
    // Find by shared files
    if (insight.relatedFiles?.length) {
      for (const file of insight.relatedFiles.slice(0, 3)) {
        const fileRelated = await db
          .select()
          .from(wrenInsights)
          .where(
            and(
              sql`${wrenInsights.relatedFiles} && ARRAY[${file}]::text[]`,
              sql`${wrenInsights.id} != ${insightId}`
            )
          )
          .limit(3);
        
        for (const r of fileRelated) {
          if (!relatedIds.has(r.id)) {
            relatedIds.add(r.id);
            related.push(r);
          }
        }
      }
    }
    
    // Find by shared tags
    if (insight.tags?.length) {
      for (const tag of insight.tags.slice(0, 3)) {
        const tagRelated = await db
          .select()
          .from(wrenInsights)
          .where(
            and(
              sql`${wrenInsights.tags} && ARRAY[${tag}]::text[]`,
              sql`${wrenInsights.id} != ${insightId}`
            )
          )
          .limit(3);
        
        for (const r of tagRelated) {
          if (!relatedIds.has(r.id)) {
            relatedIds.add(r.id);
            related.push(r);
          }
        }
      }
    }
    
    // Find by same category
    if (related.length < limit) {
      const categoryRelated = await db
        .select()
        .from(wrenInsights)
        .where(
          and(
            eq(wrenInsights.category, insight.category),
            sql`${wrenInsights.id} != ${insightId}`
          )
        )
        .orderBy(desc(wrenInsights.useCount))
        .limit(limit - related.length);
      
      for (const r of categoryRelated) {
        if (!relatedIds.has(r.id)) {
          relatedIds.add(r.id);
          related.push(r);
        }
      }
    }
    
    return related.slice(0, limit);
  }
  
  /**
   * Build a knowledge graph of related insights starting from a seed
   */
  async buildKnowledgeGraph(seedInsightId: string, depth: number = 2): Promise<{
    nodes: WrenInsight[];
    edges: Array<{ from: string; to: string; relationship: string }>;
  }> {
    const nodes: Map<string, WrenInsight> = new Map();
    const edges: Array<{ from: string; to: string; relationship: string }> = [];
    const visited: Set<string> = new Set();
    const queue: Array<{ id: string; currentDepth: number }> = [
      { id: seedInsightId, currentDepth: 0 }
    ];
    
    while (queue.length > 0) {
      const { id, currentDepth } = queue.shift()!;
      
      if (visited.has(id) || currentDepth > depth) continue;
      visited.add(id);
      
      const insight = await storage.getWrenInsight(id);
      if (!insight) continue;
      
      nodes.set(id, insight);
      
      if (currentDepth < depth) {
        const related = await this.findRelatedInsights(id, 3);
        for (const r of related) {
          if (!visited.has(r.id)) {
            // Determine relationship type
            let relationship = 'related';
            if (insight.relatedFiles?.some(f => r.relatedFiles?.includes(f))) {
              relationship = 'shares_file';
            } else if (insight.tags?.some(t => r.tags?.includes(t))) {
              relationship = 'shares_tag';
            } else if (insight.category === r.category) {
              relationship = 'same_category';
            }
            
            edges.push({ from: id, to: r.id, relationship });
            queue.push({ id: r.id, currentDepth: currentDepth + 1 });
          }
        }
      }
    }
    
    return { nodes: Array.from(nodes.values()), edges };
  }
  
  /**
   * Search insights with semantic matching
   */
  async searchInsights(query: string, options?: {
    category?: string;
    limit?: number;
  }): Promise<WrenInsight[]> {
    const conditions = [];
    
    // Text search across title, content, context
    const searchPattern = `%${query}%`;
    conditions.push(
      or(
        ilike(wrenInsights.title, searchPattern),
        ilike(wrenInsights.content, searchPattern),
        ilike(wrenInsights.context, searchPattern)
      )
    );
    
    if (options?.category) {
      conditions.push(eq(wrenInsights.category, options.category as any));
    }
    
    return db
      .select()
      .from(wrenInsights)
      .where(and(...conditions))
      .orderBy(desc(wrenInsights.useCount), desc(wrenInsights.lastUsedAt))
      .limit(options?.limit || 10);
  }
  
  // ============================================================================
  // EXPRESS LANE INSIGHT EXTRACTION
  // ============================================================================
  
  /**
   * Minimum content length and score thresholds for insight extraction
   */
  private readonly MIN_INSIGHT_LENGTH = 100;
  private readonly MIN_INSIGHT_SCORE = 2;
  
  /**
   * Check if EXPRESS Lane message contains extractable architectural/debugging insight
   * Returns the detected category and score, or null if not insightful
   */
  analyzeMessageForInsight(content: string, role: string): { category: string; score: number; title: string } | null {
    // Only extract from founder or wren messages (not daniela - she captures her own growth)
    if (role !== 'founder' && role !== 'wren') {
      return null;
    }
    
    // Skip short messages
    if (content.length < this.MIN_INSIGHT_LENGTH) {
      return null;
    }
    
    // Categories worth extracting from EXPRESS Lane discussions
    const extractableCategories = ['architecture', 'debugging', 'solution', 'gotcha', 'pattern', 'integration'];
    const category = this.detectCategory(content);
    
    if (!extractableCategories.includes(category)) {
      return null;
    }
    
    // Calculate insight score based on pattern matches
    let score = 0;
    const patterns = CATEGORY_PATTERNS[category] || [];
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        score++;
      }
    }
    
    // Bonus for file references (concrete, actionable)
    const fileRefs = this.extractFileReferences(content);
    score += Math.min(fileRefs.length, 3);
    
    // Bonus for decision language
    if (/should|must|always|never|important|critical|key insight|the trick is/i.test(content)) {
      score += 1;
    }
    
    // Threshold check
    if (score < this.MIN_INSIGHT_SCORE) {
      return null;
    }
    
    // Generate title from first sentence or key phrase
    const firstSentence = content.split(/[.!?]/)[0]?.trim() || '';
    const title = firstSentence.length > 60 
      ? firstSentence.substring(0, 57) + '...' 
      : firstSentence;
    
    return { category, score, title };
  }
  
  /**
   * Extract and store an insight from an EXPRESS Lane message
   * Called by founder-collaboration-service after saving messages
   */
  async extractExpressLaneInsight(
    message: { content: string; role: string; sessionId: string; id: string }
  ): Promise<string | null> {
    const analysis = this.analyzeMessageForInsight(message.content, message.role);
    
    if (!analysis) {
      return null;
    }
    
    console.log(`[WrenIntelligence] Extracting ${analysis.category} insight from EXPRESS Lane: "${analysis.title}"`);
    
    try {
      const insight = await this.createEnrichedInsight({
        title: `[EXPRESS Lane] ${analysis.title}`,
        content: message.content,
        context: `Extracted from EXPRESS Lane discussion (${message.role} message)`,
        category: analysis.category,
        sessionId: message.sessionId,
        shareWithDaniela: true, // Always share EXPRESS Lane insights
      });
      
      console.log(`[WrenIntelligence] Created insight ${insight.id} from EXPRESS Lane message ${message.id}`);
      return insight.id;
    } catch (error) {
      console.error('[WrenIntelligence] Failed to extract EXPRESS Lane insight:', error);
      return null;
    }
  }
  
  /**
   * Generate a summary of insights for a session
   */
  async generateSessionSummary(): Promise<string> {
    const [total, byCategory, topUsed, recent] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(wrenInsights),
      db.select({
        category: wrenInsights.category,
        count: sql<number>`count(*)`
      }).from(wrenInsights).groupBy(wrenInsights.category),
      this.getRankedInsights(5),
      db.select().from(wrenInsights)
        .orderBy(desc(wrenInsights.createdAt))
        .limit(5)
    ]);
    
    const lines: string[] = [
      '═══════════════════════════════════════════════════════════════════',
      '🧠 WREN INTELLIGENCE SUMMARY',
      '═══════════════════════════════════════════════════════════════════',
      '',
      `Total Insights: ${total[0]?.count || 0}`,
      '',
      'By Category:',
    ];
    
    for (const cat of byCategory) {
      lines.push(`  • ${cat.category}: ${cat.count}`);
    }
    
    lines.push('');
    lines.push('Most Used Insights:');
    for (const insight of topUsed) {
      lines.push(`  🔥 [${insight.useCount}x] ${insight.title}`);
    }
    
    lines.push('');
    lines.push('Recently Added:');
    for (const insight of recent) {
      const date = insight.createdAt 
        ? new Date(insight.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'Unknown';
      lines.push(`  📝 [${date}] ${insight.title}`);
    }
    
    lines.push('');
    
    return lines.join('\n');
  }
}

export const wrenIntelligenceService = new WrenIntelligenceService();
