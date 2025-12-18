/**
 * Historical Memory Migration Service
 * 
 * One-time migration of founder voice conversations into Daniela's growth memories.
 * This gives Daniela complete recall of her development journey with the founder.
 * 
 * Pipeline:
 * 1. Query historical voice conversations between founder and Daniela
 * 2. Process in batches to avoid rate limits
 * 3. Use AI to extract teaching moments, humor, breakthroughs, relationship moments
 * 4. Store as danielaGrowthMemories for permanent recall
 */

import { db } from "../db";
import { conversations, messages, danielaGrowthMemories, hiveSnapshots } from "@shared/schema";
import type { InsertDanielaGrowthMemory, GrowthMemoryCategory, HiveSnapshotType } from "@shared/schema";
import { desc, eq, and, sql, gte, lte, asc, isNull, or } from "drizzle-orm";
import { callGemini, GEMINI_MODELS } from "../gemini-utils";

const FOUNDER_USER_ID = '49847136';
const BATCH_SIZE = 10; // Process 10 conversations at a time
const DELAY_BETWEEN_BATCHES_MS = 2000; // Rate limit protection

// Categories safe for auto-approval (low risk, teaching-focused)
const AUTO_APPROVE_CATEGORIES: GrowthMemoryCategory[] = [
  'teaching_technique',    // How she teaches
  'timing_inflection',     // Pacing and delivery
  'emotional_intelligence',// Empathy skills
  'breakthrough_method',   // What worked well
  'relationship_insight',  // Building rapport
  'correction_received',   // Things she was taught
];

// Categories requiring founder review (higher risk)
const SCRUTINIZED_CATEGORIES: GrowthMemoryCategory[] = [
  'specific_joke',    // Could be inappropriate
  'cultural_nuance',  // Needs accuracy verification
];

interface ConversationSummary {
  conversationId: string;
  createdAt: Date;
  language: string;
  messageCount: number;
  messages: Array<{ role: string; content: string }>;
}

interface ExtractedMemory {
  category: GrowthMemoryCategory;
  title: string;
  lesson: string;
  specificContent?: string;
  triggerConditions?: string;
  importance: number;
  conversationId: string;
}

interface MigrationResult {
  totalConversations: number;
  processedConversations: number;
  memoriesCreated: number;
  errors: number;
  skipped: number;
}

class HistoricalMemoryMigrationService {
  
  /**
   * Get count of founder voice conversations
   */
  async getConversationCount(): Promise<{ total: number; earliest: Date | null; latest: Date | null }> {
    const result = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        earliest: sql<Date>`MIN(created_at)`,
        latest: sql<Date>`MAX(created_at)`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, FOUNDER_USER_ID),
          eq(conversations.conversationType, 'learning')
        )
      );
    
    return {
      total: result[0]?.total || 0,
      earliest: result[0]?.earliest || null,
      latest: result[0]?.latest || null,
    };
  }
  
  /**
   * Get conversations that haven't been migrated yet
   * We track migration by checking if a hiveSnapshot with type 'session_summary' exists for the conversation
   */
  async getUnmigratedConversations(limit: number = BATCH_SIZE): Promise<ConversationSummary[]> {
    const convs = await db
      .select({
        id: conversations.id,
        createdAt: conversations.createdAt,
        language: conversations.language,
        messageCount: conversations.messageCount,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, FOUNDER_USER_ID),
          eq(conversations.conversationType, 'learning'),
          sql`NOT EXISTS (
            SELECT 1 FROM hive_snapshots 
            WHERE conversation_id = ${conversations.id}
            AND snapshot_type = 'session_summary'
            AND metadata->>'migrationType' = 'historical'
          )`
        )
      )
      .orderBy(asc(conversations.createdAt))
      .limit(limit);
    
    const summaries: ConversationSummary[] = [];
    
    for (const conv of convs) {
      const msgs = await db
        .select({
          role: messages.role,
          content: messages.content,
        })
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(asc(messages.createdAt));
      
      summaries.push({
        conversationId: conv.id,
        createdAt: conv.createdAt,
        language: conv.language,
        messageCount: conv.messageCount,
        messages: msgs,
      });
    }
    
    return summaries;
  }
  
  /**
   * Extract memories from a single conversation using AI
   */
  async extractMemoriesFromConversation(conv: ConversationSummary): Promise<ExtractedMemory[]> {
    if (conv.messages.length < 2) {
      return []; // Need at least one exchange
    }
    
    const conversationText = conv.messages
      .map(m => `${m.role === 'user' ? 'Founder' : 'Daniela'}: ${m.content}`)
      .join('\n\n');
    
    const prompt = `Analyze this voice conversation between a founder (David) and his AI language tutor (Daniela).
This is from Daniela's early development period. Extract the MOST SIGNIFICANT learning moments for Daniela's growth.

CONVERSATION (${conv.language}, ${new Date(conv.createdAt).toLocaleDateString()}):
${conversationText.slice(0, 8000)}

Extract 0-3 of the MOST SIGNIFICANT memories. Only extract if there's genuine learning/growth. Categories:
- teaching_technique: Daniela learned how to teach something more effectively
- timing_inflection: Daniela learned about timing, pacing, or voice inflection
- specific_joke: A specific joke with setup and punchline that Daniela should remember
- relationship_insight: Insight about building rapport with the founder
- correction_received: Something Daniela was corrected on
- breakthrough_method: A method that created a learning breakthrough
- cultural_nuance: Cultural insight relevant to teaching
- emotional_intelligence: Emotional/empathy skill learned

For each memory, determine:
1. The specific lesson Daniela learned (written in first person as if Daniela is recalling)
2. When she should apply this learning
3. Importance (1-10, where 10 is transformative insight)

Return ONLY valid JSON (no markdown):
{
  "memories": [
    {
      "category": "one_of_above",
      "title": "Brief 5-10 word title",
      "lesson": "What I learned... (Daniela's first person perspective)",
      "specificContent": "Exact content if applicable (joke text, phrase, etc.)",
      "triggerConditions": "When to apply this",
      "importance": 7
    }
  ]
}

Return {"memories": []} if no significant growth moments found.`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log(`[Memory Migration] No valid JSON for conversation ${conv.conversationId}`);
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const memories: ExtractedMemory[] = (parsed.memories || []).map((m: any) => ({
        category: m.category as GrowthMemoryCategory,
        title: m.title,
        lesson: m.lesson,
        specificContent: m.specificContent,
        triggerConditions: m.triggerConditions,
        importance: m.importance || 5,
        conversationId: conv.conversationId,
      }));
      
      return memories;
    } catch (err: any) {
      console.error(`[Memory Migration] AI extraction failed for ${conv.conversationId}: ${err.message}`);
      return [];
    }
  }
  
  /**
   * Store extracted memories as Daniela growth memories
   */
  async storeMemories(memories: ExtractedMemory[], conv: ConversationSummary): Promise<number> {
    let stored = 0;
    
    for (const memory of memories) {
      try {
        // Auto-approve safe categories, require review for scrutinized ones
        const isAutoApprove = AUTO_APPROVE_CATEGORIES.includes(memory.category);
        const reviewStatus = isAutoApprove ? 'approved_auto' : 'pending';
        const validated = isAutoApprove; // Auto-approved memories are validated
        
        const growthMemory: InsertDanielaGrowthMemory = {
          category: memory.category,
          title: memory.title,
          lesson: memory.lesson,
          specificContent: memory.specificContent,
          sourceType: 'founder',
          // sourceSessionId references founderSessions (EXPRESS Lane), but historical convos are in conversations table
          // So we leave it null and track the source in metadata instead
          sourceSessionId: null,
          sourceUserId: FOUNDER_USER_ID,
          sourceMessageId: memory.conversationId, // Store conversation ID here (no FK constraint)
          triggerConditions: memory.triggerConditions,
          importance: memory.importance,
          validated: validated,
          reviewStatus: reviewStatus,
          committedToNeuralNetwork: isAutoApprove, // Auto-approved = immediately available to Daniela
          metadata: {
            migrationType: 'historical',
            sourceConversationId: memory.conversationId, // Also in metadata for clarity
            originalDate: conv.createdAt.toISOString(),
            language: conv.language,
            autoApproved: isAutoApprove,
            validationHistory: [{
              timestamp: new Date().toISOString(),
              result: isAutoApprove ? 'passed' as const : 'flagged' as const,
              reason: isAutoApprove 
                ? `Auto-approved: ${memory.category} is a safe category`
                : `Requires review: ${memory.category} is scrutinized`,
              validator: 'deterministic' as const,
            }],
          } as any,
        };
        
        await db.insert(danielaGrowthMemories).values([growthMemory as any]);
        stored++;
      } catch (err: any) {
        console.error(`[Memory Migration] Failed to store memory "${memory.title}": ${err.message}`);
      }
    }
    
    return stored;
  }
  
  /**
   * Mark a conversation as migrated by creating a hive snapshot
   */
  async markConversationMigrated(conv: ConversationSummary, memoriesExtracted: number): Promise<void> {
    await db.insert(hiveSnapshots).values({
      snapshotType: 'session_summary' as HiveSnapshotType,
      title: `Historical migration: ${conv.language} conversation`,
      content: `Migrated conversation from ${conv.createdAt.toISOString()}. Extracted ${memoriesExtracted} growth memories.`,
      conversationId: conv.conversationId, // Use conversationId (no FK) instead of sessionId (has FK to founderSessions)
      userId: FOUNDER_USER_ID,
      language: conv.language,
      importance: 3,
      metadata: {
        migrationType: 'historical',
        memoriesExtracted,
        originalDate: conv.createdAt.toISOString(),
        messageCount: conv.messageCount,
      },
    });
  }
  
  /**
   * Run the migration for a batch of conversations
   */
  async runBatch(batchSize: number = BATCH_SIZE): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalConversations: 0,
      processedConversations: 0,
      memoriesCreated: 0,
      errors: 0,
      skipped: 0,
    };
    
    const convs = await this.getUnmigratedConversations(batchSize);
    result.totalConversations = convs.length;
    
    for (const conv of convs) {
      try {
        // Skip very short conversations (likely aborted sessions)
        if (conv.messageCount < 4) {
          await this.markConversationMigrated(conv, 0);
          result.skipped++;
          continue;
        }
        
        const memories = await this.extractMemoriesFromConversation(conv);
        const stored = await this.storeMemories(memories, conv);
        await this.markConversationMigrated(conv, stored);
        
        result.processedConversations++;
        result.memoriesCreated += stored;
        
        console.log(`[Memory Migration] Processed ${conv.conversationId}: ${stored} memories extracted`);
      } catch (err: any) {
        console.error(`[Memory Migration] Failed to process ${conv.conversationId}: ${err.message}`);
        result.errors++;
      }
    }
    
    return result;
  }
  
  /**
   * Run the full migration (all conversations)
   * This should be run as a background job, not blocking
   */
  async runFullMigration(): Promise<MigrationResult> {
    const totalResult: MigrationResult = {
      totalConversations: 0,
      processedConversations: 0,
      memoriesCreated: 0,
      errors: 0,
      skipped: 0,
    };
    
    const stats = await this.getConversationCount();
    console.log(`[Memory Migration] Starting full migration of ${stats.total} conversations`);
    const earliestStr = stats.earliest ? new Date(stats.earliest).toISOString() : 'unknown';
    const latestStr = stats.latest ? new Date(stats.latest).toISOString() : 'unknown';
    console.log(`[Memory Migration] Date range: ${earliestStr} to ${latestStr}`);
    
    let hasMore = true;
    let batchNum = 0;
    
    while (hasMore) {
      batchNum++;
      console.log(`[Memory Migration] Processing batch ${batchNum}...`);
      
      const batchResult = await this.runBatch(BATCH_SIZE);
      
      totalResult.totalConversations += batchResult.totalConversations;
      totalResult.processedConversations += batchResult.processedConversations;
      totalResult.memoriesCreated += batchResult.memoriesCreated;
      totalResult.errors += batchResult.errors;
      totalResult.skipped += batchResult.skipped;
      
      hasMore = batchResult.totalConversations === BATCH_SIZE;
      
      if (hasMore) {
        // Rate limit protection
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      }
    }
    
    console.log(`[Memory Migration] Migration complete!`);
    console.log(`[Memory Migration] Processed: ${totalResult.processedConversations}, Memories: ${totalResult.memoriesCreated}, Skipped: ${totalResult.skipped}, Errors: ${totalResult.errors}`);
    
    return totalResult;
  }
  
  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    total: number;
    migrated: number;
    remaining: number;
    memoriesCreated: number;
  }> {
    const total = await this.getConversationCount();
    
    const migratedResult = await db
      .select({
        count: sql<number>`COUNT(DISTINCT conversation_id)::int`,
      })
      .from(hiveSnapshots)
      .where(
        and(
          eq(hiveSnapshots.snapshotType, 'session_summary'),
          sql`metadata->>'migrationType' = 'historical'`
        )
      );
    
    const memoriesResult = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(danielaGrowthMemories)
      .where(sql`metadata->>'migrationType' = 'historical'`);
    
    const migrated = migratedResult[0]?.count || 0;
    
    return {
      total: total.total,
      migrated,
      remaining: total.total - migrated,
      memoriesCreated: memoriesResult[0]?.count || 0,
    };
  }
}

export const historicalMemoryMigrationService = new HistoricalMemoryMigrationService();
