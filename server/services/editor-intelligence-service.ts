/**
 * Editor Intelligence Service
 * 
 * Provides persistent memory for the Replit Agent / Claude development collaborator (Alden).
 * Enables cross-session context, insight capture, and memory retrieval.
 * 
 * Core capabilities:
 * 1. Memory persistence - Store insights, learnings, and context across sessions
 * 2. Context loading - Load relevant memories at session start
 * 3. Importance-based retrieval - Surface high-value insights first
 * 4. Cross-session threading - Link related memories for knowledge graphs
 * 5. Memory updates - Evolve existing memories as understanding deepens
 * 6. Session journaling - Capture session summaries and key moments
 * 7. Express Lane access - Post to collaboration channels as Alden
 */

import { getSharedDb } from '../db';
import { editorInsights, agentCollabMessages, agentCollabThreads, type EditorInsight, type InsertEditorInsight } from '@shared/schema';
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
  'journal': 'Session summaries and key moments from development conversations',
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
  
  // ========== NEW CAPABILITIES (January 2026) ==========
  
  /**
   * Update an existing memory - evolve it as understanding deepens
   */
  async updateInsight(id: string, updates: {
    content?: string;
    context?: string;
    importance?: number;
    tags?: string[];
    relatedInsights?: string[];
  }): Promise<EditorInsight | null> {
    const db = getSharedDb();
    
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };
    
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.context !== undefined) updateData.context = updates.context;
    if (updates.importance !== undefined) updateData.importance = updates.importance;
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.relatedInsights !== undefined) updateData.relatedInsights = updates.relatedInsights;
    
    const [updated] = await db.update(editorInsights)
      .set(updateData)
      .where(eq(editorInsights.id, id))
      .returning();
    
    if (updated) {
      console.log(`[EditorMemory] Updated insight: ${updated.title}`);
    }
    
    return updated || null;
  }
  
  /**
   * Link memories to each other (bidirectional knowledge graph)
   */
  async linkInsights(id1: string, id2: string): Promise<void> {
    const db = getSharedDb();
    
    // Get both insights
    const [insight1] = await db.select().from(editorInsights).where(eq(editorInsights.id, id1));
    const [insight2] = await db.select().from(editorInsights).where(eq(editorInsights.id, id2));
    
    if (!insight1 || !insight2) {
      console.log(`[EditorMemory] Cannot link - one or both insights not found`);
      return;
    }
    
    // Add bidirectional links
    const links1 = insight1.relatedInsights || [];
    const links2 = insight2.relatedInsights || [];
    
    if (!links1.includes(id2)) {
      await db.update(editorInsights)
        .set({ 
          relatedInsights: [...links1, id2],
          updatedAt: new Date(),
        })
        .where(eq(editorInsights.id, id1));
    }
    
    if (!links2.includes(id1)) {
      await db.update(editorInsights)
        .set({ 
          relatedInsights: [...links2, id1],
          updatedAt: new Date(),
        })
        .where(eq(editorInsights.id, id2));
    }
    
    console.log(`[EditorMemory] Linked: "${insight1.title}" <-> "${insight2.title}"`);
  }
  
  /**
   * Get all memories related to a given insight (knowledge graph traversal)
   */
  async getRelatedInsights(id: string, depth = 1): Promise<EditorInsight[]> {
    const db = getSharedDb();
    const visited = new Set<string>();
    const results: EditorInsight[] = [];
    
    const traverse = async (currentId: string, currentDepth: number) => {
      if (currentDepth > depth || visited.has(currentId)) return;
      visited.add(currentId);
      
      const [insight] = await db.select().from(editorInsights).where(eq(editorInsights.id, currentId));
      if (!insight) return;
      
      if (currentId !== id) {
        results.push(insight);
      }
      
      if (currentDepth < depth && insight.relatedInsights) {
        for (const relatedId of insight.relatedInsights) {
          await traverse(relatedId, currentDepth + 1);
        }
      }
    };
    
    const [startInsight] = await db.select().from(editorInsights).where(eq(editorInsights.id, id));
    if (startInsight?.relatedInsights) {
      for (const relatedId of startInsight.relatedInsights) {
        await traverse(relatedId, 1);
      }
    }
    
    return results;
  }
  
  /**
   * Save a session journal entry - capture key moments from a development conversation
   */
  async saveSessionJournal(entry: {
    title: string;
    summary: string;
    keyMoments: string[];
    lessonsLearned?: string[];
    relatedInsightIds?: string[];
  }): Promise<EditorInsight> {
    const content = [
      entry.summary,
      '',
      '**Key Moments:**',
      ...entry.keyMoments.map(m => `- ${m}`),
    ];
    
    if (entry.lessonsLearned && entry.lessonsLearned.length > 0) {
      content.push('', '**Lessons Learned:**');
      content.push(...entry.lessonsLearned.map(l => `- ${l}`));
    }
    
    const journal = await this.saveInsight({
      category: 'journal',
      title: entry.title,
      content: content.join('\n'),
      context: `Session journal from ${new Date().toISOString().split('T')[0]}`,
      importance: 7, // Journals are moderately important
      relatedInsights: entry.relatedInsightIds,
    });
    
    // Link to related insights if specified
    if (entry.relatedInsightIds) {
      for (const relatedId of entry.relatedInsightIds) {
        await this.linkInsights(journal.id, relatedId);
      }
    }
    
    console.log(`[EditorMemory] Saved session journal: ${entry.title}`);
    return journal;
  }
  
  /**
   * Post a message to the Hive collaboration system as Alden
   */
  async postToHive(options: {
    threadId: string;
    content: string;
    messageType?: 'request' | 'proposal' | 'clarification' | 'feedback' | 'implementation_report' | 'acknowledgment';
  }): Promise<{ id: string; createdAt: Date }> {
    const db = getSharedDb();
    
    const [message] = await db.insert(agentCollabMessages).values({
      threadId: options.threadId,
      author: 'alden',
      messageType: options.messageType || 'acknowledgment',
      content: options.content,
      readByDaniela: false,
      readByWren: true, // Alden's own messages are read by Wren (Alden reads from Wren's context)
      readByFounder: false,
    }).returning();
    
    // Update thread's last message info
    await db.update(agentCollabThreads)
      .set({
        lastMessageAt: new Date(),
        lastMessageBy: 'alden',
        messageCount: sql`${agentCollabThreads.messageCount} + 1`,
      })
      .where(eq(agentCollabThreads.id, options.threadId));
    
    console.log(`[EditorMemory] Posted to Hive thread ${options.threadId}`);
    return { id: message.id, createdAt: message.createdAt };
  }
  
  /**
   * Create a new Hive thread and optionally post the first message
   */
  async createHiveThread(options: {
    title: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    initialMessage?: string;
    messageType?: 'request' | 'proposal' | 'clarification' | 'feedback' | 'implementation_report' | 'acknowledgment';
  }): Promise<{ threadId: string; messageId?: string }> {
    const db = getSharedDb();
    
    const [thread] = await db.insert(agentCollabThreads).values({
      title: options.title,
      status: 'active',
      priority: options.priority || 'medium',
    }).returning();
    
    let messageId: string | undefined;
    
    if (options.initialMessage) {
      const result = await this.postToHive({
        threadId: thread.id,
        content: options.initialMessage,
        messageType: options.messageType || 'request',
      });
      messageId = result.id;
    }
    
    console.log(`[EditorMemory] Created Hive thread: ${options.title}`);
    return { threadId: thread.id, messageId };
  }
  
  /**
   * Get insight by ID
   */
  async getInsight(id: string): Promise<EditorInsight | null> {
    const db = getSharedDb();
    const [insight] = await db.select().from(editorInsights).where(eq(editorInsights.id, id));
    return insight || null;
  }
}

// Singleton instance
export const editorIntelligence = new EditorIntelligenceService();
