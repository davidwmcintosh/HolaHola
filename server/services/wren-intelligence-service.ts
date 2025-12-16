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
   */
  async createEnrichedInsight(params: {
    title: string;
    content: string;
    context?: string;
    category?: string;
    tags?: string[];
    relatedFiles?: string[];
    sessionId?: string;
  }): Promise<WrenInsight> {
    const category = params.category || this.detectCategory(params.content, params.context);
    const tags = params.tags?.length 
      ? params.tags 
      : this.extractTags(params.content, params.context);
    const relatedFiles = params.relatedFiles?.length 
      ? params.relatedFiles 
      : this.extractFileReferences(params.content, params.context);
    
    return storage.createWrenInsight({
      category: category as any,
      title: params.title,
      content: params.content,
      context: params.context || null,
      tags,
      relatedFiles,
      environment: 'development',
      sessionId: params.sessionId || null,
    });
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
