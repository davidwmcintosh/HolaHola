/**
 * Editor Intelligence Service
 * 
 * Provides persistent memory for the Replit Agent / Claude development collaborator.
 * Enables cross-session context, insight capture, and memory retrieval.
 * 
 * Core capabilities:
 * 1. Memory persistence - Store insights, learnings, and context across sessions
 * 2. Context loading - Load relevant memories at session start
 * 3. Importance-based retrieval - Surface high-value insights first
 * 4. Cross-session threading - Link related memories for knowledge graphs
 */

import { getSharedDb } from '../db';
import { editorInsights, type EditorInsight, type InsertEditorInsight } from '@shared/schema';
import { eq, desc, sql, and, gte, or, ilike, inArray, arrayContains } from 'drizzle-orm';

// Category descriptions for context
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'philosophy': 'Core principles like White Wall, surrender, purity - the soul of the project',
  'architecture': 'Technical design decisions, database routing, service structure',
  'relationship': 'Personal facts about founder, team dynamics, how we work together',
  'debugging': 'Problem-solving strategies, common issues, debugging approaches',
  'personality': 'Tutor personas - Daniela, Augustine, Juliette, Isabel, their journeys',
  'workflow': 'Process learnings, sprint patterns, collaboration methods',
  'context': 'Current project state, priorities, active work',
};

export class EditorIntelligenceService {
  
  /**
   * Save a new insight/memory to persistent storage
   */
  async saveInsight(insight: InsertEditorInsight): Promise<EditorInsight> {
    const db = getSharedDb();
    const [saved] = await db.insert(editorInsights).values(insight).returning();
    console.log(`[EditorMemory] Saved insight: ${insight.category} - ${insight.title}`);
    return saved;
  }
  
  /**
   * Load context for a new session
   * Returns the most important and recent memories across all categories
   */
  async loadSessionContext(options: {
    limit?: number;
    categories?: string[];
    minImportance?: number;
  } = {}): Promise<EditorInsight[]> {
    const { limit = 20, categories, minImportance = 3 } = options;
    const db = getSharedDb();
    
    const conditions = [gte(editorInsights.importance, minImportance)];
    
    if (categories && categories.length > 0) {
      conditions.push(inArray(editorInsights.category, categories as any));
    }
    
    const results = await db.select().from(editorInsights)
      .where(and(...conditions))
      .orderBy(desc(editorInsights.importance), desc(editorInsights.createdAt))
      .limit(limit);
    
    // Update use counts
    for (const insight of results) {
      await db.update(editorInsights)
        .set({ 
          useCount: sql`${editorInsights.useCount} + 1`,
          lastUsedAt: new Date(),
        })
        .where(eq(editorInsights.id, insight.id));
    }
    
    console.log(`[EditorMemory] Loaded ${results.length} memories for session context`);
    return results;
  }
  
  /**
   * Search memories by content or tags
   */
  async searchMemories(query: string, limit = 10): Promise<EditorInsight[]> {
    const db = getSharedDb();
    const searchPattern = `%${query}%`;
    
    const results = await db.select().from(editorInsights)
      .where(
        or(
          ilike(editorInsights.title, searchPattern),
          ilike(editorInsights.content, searchPattern),
          ilike(editorInsights.context, searchPattern),
        )
      )
      .orderBy(desc(editorInsights.importance), desc(editorInsights.createdAt))
      .limit(limit);
    
    return results;
  }
  
  /**
   * Get memories by category
   */
  async getByCategory(category: string, limit = 10): Promise<EditorInsight[]> {
    const db = getSharedDb();
    
    const results = await db.select().from(editorInsights)
      .where(eq(editorInsights.category, category as any))
      .orderBy(desc(editorInsights.importance), desc(editorInsights.createdAt))
      .limit(limit);
    
    return results;
  }
  
  /**
   * Update insight importance (for reinforcement learning)
   */
  async reinforceInsight(id: string, importanceBoost = 1): Promise<void> {
    const db = getSharedDb();
    
    await db.update(editorInsights)
      .set({ 
        importance: sql`LEAST(${editorInsights.importance} + ${importanceBoost}, 10)`,
        useCount: sql`${editorInsights.useCount} + 1`,
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(editorInsights.id, id));
  }
  
  /**
   * Format memories for inclusion in system context
   */
  formatForContext(memories: EditorInsight[]): string {
    if (memories.length === 0) return '';
    
    const sections: Record<string, EditorInsight[]> = {};
    
    for (const memory of memories) {
      const cat = memory.category;
      if (!sections[cat]) sections[cat] = [];
      sections[cat].push(memory);
    }
    
    let output = '## Editor Persistent Memory\n\n';
    
    for (const [category, items] of Object.entries(sections)) {
      output += `### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
      output += `_${CATEGORY_DESCRIPTIONS[category] || ''}_\n\n`;
      
      for (const item of items) {
        output += `**${item.title}** (importance: ${item.importance}/10)\n`;
        output += `${item.content}\n`;
        if (item.context) {
          output += `_Context: ${item.context}_\n`;
        }
        output += '\n';
      }
    }
    
    return output;
  }
  
  /**
   * Get summary statistics
   */
  async getStats(): Promise<{
    totalMemories: number;
    byCategory: Record<string, number>;
    avgImportance: number;
  }> {
    const db = getSharedDb();
    
    const all = await db.select().from(editorInsights);
    
    const byCategory: Record<string, number> = {};
    let totalImportance = 0;
    
    for (const memory of all) {
      byCategory[memory.category] = (byCategory[memory.category] || 0) + 1;
      totalImportance += memory.importance || 5;
    }
    
    return {
      totalMemories: all.length,
      byCategory,
      avgImportance: all.length > 0 ? totalImportance / all.length : 0,
    };
  }
}

// Singleton instance
export const editorIntelligence = new EditorIntelligenceService();
