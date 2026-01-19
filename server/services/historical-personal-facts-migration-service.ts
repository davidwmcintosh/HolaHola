/**
 * Historical Personal Facts Migration Service
 * 
 * One-time migration to extract personal facts from historical conversations.
 * Scans past voice conversations and extracts personal details that should
 * have been saved as learner personal facts.
 * 
 * Pipeline:
 * 1. Query historical voice conversations for a user
 * 2. Process in batches to avoid rate limits
 * 3. Use AI to extract personal facts (family, work, goals, etc.)
 * 4. Store as learnerPersonalFacts with deduplication
 */

import { db, getSharedDb } from "../db";
import { conversations, messages, hiveSnapshots } from "@shared/schema";
import type { HiveSnapshotType } from "@shared/schema";
import { desc, eq, and, sql, asc } from "drizzle-orm";
import { callGemini, GEMINI_MODELS } from "../gemini-utils";
import { studentLearningService, type PersonalFactType, PERSONAL_FACT_TYPES } from "./student-learning-service";

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES_MS = 2000;
const MESSAGES_PER_CHUNK = 10;
const MAX_CHARS_PER_MESSAGE = 400;
const MAX_TOTAL_CHARS = 8000;

interface ConversationSummary {
  conversationId: string;
  createdAt: Date;
  language: string;
  messageCount: number;
  messages: Array<{ role: string; content: string }>;
}

interface ExtractedFact {
  factType: PersonalFactType;
  fact: string;
  context: string;
  confidence: number;
}

interface MigrationResult {
  totalConversations: number;
  processedConversations: number;
  factsCreated: number;
  factsDeduplicated: number;
  errors: number;
  skipped: number;
}

const EXTRACTION_PROMPT = `You are analyzing a language tutoring conversation to extract personal facts the student shared about their life.

Extract ONLY concrete personal details that would be valuable for the tutor to remember. Focus on:
- Family: spouse, children, siblings, parents - especially NAMES
- Life events: trips, weddings, new jobs, moving, babies
- Personal details: occupation, hobbies, pets
- Goals: why they're learning, what they want to achieve
- Relationships: family members, friends mentioned by name
- Travel: upcoming or past trips with specific destinations
- Work: job title, company, career changes, work situations
- Hobbies: activities they enjoy

DO NOT extract:
- Language learning progress (tracked separately)
- Errors or struggles (tracked separately)
- Generic small talk without personal details
- Anything the tutor said (only student's personal info)
- Vague statements without concrete facts

For each fact, provide:
- factType: one of ${PERSONAL_FACT_TYPES.join(', ')}
- fact: concise statement (max 100 chars) - be specific with names and details
- context: how it came up (max 50 chars)
- confidence: 0-1 how confident this is a real personal fact (use 0.8+ only for clear facts)

Respond with JSON only:
{
  "facts": [
    {
      "factType": "family",
      "fact": "Wife's name is Sarah",
      "context": "Mentioned during family discussion",
      "confidence": 0.95
    },
    {
      "factType": "travel",
      "fact": "Planning trip to Madrid in June 2025",
      "context": "Mentioned as motivation for learning",
      "confidence": 0.9
    }
  ]
}

If no personal facts were shared, return: {"facts": []}`;

class HistoricalPersonalFactsMigrationService {
  
  /**
   * Get count of unmigrated conversations for a user
   */
  async getConversationCount(userId: string): Promise<{ total: number; migrated: number; remaining: number }> {
    const [totalResult] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
      })
      .from(conversations)
      .where(
        and(
          eq(conversations.userId, userId),
          eq(conversations.conversationType, 'learning')
        )
      );
    
    const [migratedResult] = await db
      .select({
        migrated: sql<number>`COUNT(*)::int`,
      })
      .from(hiveSnapshots)
      .where(
        and(
          eq(hiveSnapshots.userId, userId),
          sql`metadata->>'migrationType' = 'personal_facts'`
        )
      );
    
    const total = totalResult?.total || 0;
    const migrated = migratedResult?.migrated || 0;
    
    return {
      total,
      migrated,
      remaining: total - migrated,
    };
  }
  
  /**
   * Get conversations that haven't been migrated yet for personal facts
   */
  async getUnmigratedConversations(userId: string, limit: number = BATCH_SIZE): Promise<ConversationSummary[]> {
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
          eq(conversations.userId, userId),
          eq(conversations.conversationType, 'learning'),
          sql`NOT EXISTS (
            SELECT 1 FROM hive_snapshots 
            WHERE conversation_id = ${conversations.id}
            AND metadata->>'migrationType' = 'personal_facts'
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
   * Split messages into chunks for processing long sessions
   */
  private chunkMessages(messages: Array<{ role: string; content: string }>): Array<Array<{ role: string; content: string }>> {
    const chunks: Array<Array<{ role: string; content: string }>> = [];
    for (let i = 0; i < messages.length; i += MESSAGES_PER_CHUNK) {
      chunks.push(messages.slice(i, i + MESSAGES_PER_CHUNK));
    }
    return chunks;
  }
  
  /**
   * Summarize a chunk of conversation for personal facts
   */
  private async summarizeChunkForFacts(messages: Array<{ role: string; content: string }>): Promise<string> {
    const transcript = messages
      .map(m => {
        const role = m.role === 'user' ? 'Student' : 'Tutor';
        const content = m.content.length > MAX_CHARS_PER_MESSAGE 
          ? m.content.slice(0, MAX_CHARS_PER_MESSAGE) + '...'
          : m.content;
        return `${role}: ${content}`;
      })
      .join('\n');
    
    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: `Summarize the personal details shared by the student in this conversation segment.
Focus ONLY on personal facts (not language learning). List any: names of family/friends, jobs, travel plans, hobbies, life events.
Keep it concise - just list the facts.
If no personal facts, respond with "No personal facts".

${transcript}` }
      ]);
      return response.trim();
    } catch (err) {
      console.warn('[PersonalFacts Migration] Failed to summarize chunk');
      return '';
    }
  }
  
  /**
   * Build optimized transcript with rolling window + summarization for long conversations
   */
  private async buildOptimizedTranscript(messages: Array<{ role: string; content: string }>): Promise<string> {
    // For short conversations, use full transcript
    if (messages.length <= MESSAGES_PER_CHUNK * 2) {
      return messages
        .map(m => {
          const role = m.role === 'user' ? 'Student' : 'Tutor';
          const content = m.content.length > MAX_CHARS_PER_MESSAGE 
            ? m.content.slice(0, MAX_CHARS_PER_MESSAGE) + '...'
            : m.content;
          return `${role}: ${content}`;
        })
        .join('\n');
    }
    
    // For long sessions: summarize earlier chunks, keep recent in full
    const chunks = this.chunkMessages(messages);
    const parts: string[] = [];
    
    // Summarize earlier chunks (all except last 2)
    const earlierChunks = chunks.slice(0, -2);
    if (earlierChunks.length > 0) {
      console.log(`[PersonalFacts Migration] Summarizing ${earlierChunks.length} earlier chunks`);
      const summaries: string[] = [];
      for (const chunk of earlierChunks) {
        const summary = await this.summarizeChunkForFacts(chunk);
        if (summary && summary !== 'No personal facts') {
          summaries.push(summary);
        }
      }
      if (summaries.length > 0) {
        parts.push(`EARLIER IN CONVERSATION (summarized):\n${summaries.join('\n')}`);
      }
    }
    
    // Keep last 2 chunks in full detail
    const recentChunks = chunks.slice(-2);
    const recentTranscript = recentChunks.flat()
      .map(m => {
        const role = m.role === 'user' ? 'Student' : 'Tutor';
        const content = m.content.length > MAX_CHARS_PER_MESSAGE 
          ? m.content.slice(0, MAX_CHARS_PER_MESSAGE) + '...'
          : m.content;
        return `${role}: ${content}`;
      })
      .join('\n');
    parts.push(`RECENT CONVERSATION:\n${recentTranscript}`);
    
    return parts.join('\n\n');
  }
  
  /**
   * Extract personal facts from a single conversation using AI
   */
  async extractFactsFromConversation(conv: ConversationSummary): Promise<ExtractedFact[]> {
    if (conv.messages.length < 2) {
      return [];
    }
    
    // Use optimized transcript for long conversations
    const conversationText = await this.buildOptimizedTranscript(conv.messages);
    
    const prompt = `${EXTRACTION_PROMPT}

CONVERSATION (${conv.language}, ${new Date(conv.createdAt).toLocaleDateString()}):
${conversationText.slice(0, MAX_TOTAL_CHARS)}`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log(`[PersonalFacts Migration] No valid JSON for conversation ${conv.conversationId}`);
        return [];
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      const facts: ExtractedFact[] = (parsed.facts || [])
        .filter((f: any) => f.confidence >= 0.7 && PERSONAL_FACT_TYPES.includes(f.factType))
        .map((f: any) => ({
          factType: f.factType as PersonalFactType,
          fact: f.fact,
          context: f.context || 'historical conversation',
          confidence: f.confidence,
        }));
      
      return facts;
    } catch (err: any) {
      console.error(`[PersonalFacts Migration] AI extraction failed for ${conv.conversationId}: ${err.message}`);
      return [];
    }
  }
  
  /**
   * Store extracted facts using the existing deduplication system
   */
  async storeFacts(userId: string, facts: ExtractedFact[], conv: ConversationSummary): Promise<{ saved: number; deduplicated: number }> {
    let saved = 0;
    let deduplicated = 0;
    
    for (const fact of facts) {
      try {
        const result = await studentLearningService.savePersonalFact({
          studentId: userId,
          factType: fact.factType,
          fact: fact.fact,
          context: `${fact.context} (historical migration)`,
          sourceConversationId: conv.conversationId,
          language: conv.language,
          confidenceScore: fact.confidence,
        });
        
        if (result) {
          saved++;
          console.log(`[PersonalFacts Migration] Saved: ${fact.factType} - ${fact.fact}`);
        }
      } catch (err: any) {
        if (err.message?.includes('duplicate') || err.message?.includes('similar')) {
          deduplicated++;
        } else {
          console.error(`[PersonalFacts Migration] Failed to store fact: ${err.message}`);
        }
      }
    }
    
    return { saved, deduplicated };
  }
  
  /**
   * Mark a conversation as migrated by creating a hive snapshot
   */
  async markConversationMigrated(userId: string, conv: ConversationSummary, factsExtracted: number): Promise<void> {
    await db.insert(hiveSnapshots).values({
      snapshotType: 'session_summary' as HiveSnapshotType,
      title: `Personal facts migration: ${conv.language} conversation`,
      content: `Migrated conversation from ${conv.createdAt.toISOString()}. Extracted ${factsExtracted} personal facts.`,
      conversationId: conv.conversationId,
      userId: userId,
      language: conv.language,
      importance: 2,
      metadata: {
        migrationType: 'personal_facts',
        factsExtracted,
        originalDate: conv.createdAt.toISOString(),
        messageCount: conv.messageCount,
      },
    });
  }
  
  /**
   * Run the migration for a batch of conversations
   */
  async runBatch(userId: string, batchSize: number = BATCH_SIZE): Promise<MigrationResult> {
    const result: MigrationResult = {
      totalConversations: 0,
      processedConversations: 0,
      factsCreated: 0,
      factsDeduplicated: 0,
      errors: 0,
      skipped: 0,
    };
    
    const convs = await this.getUnmigratedConversations(userId, batchSize);
    result.totalConversations = convs.length;
    
    for (const conv of convs) {
      try {
        if (conv.messageCount < 4) {
          await this.markConversationMigrated(userId, conv, 0);
          result.skipped++;
          continue;
        }
        
        const facts = await this.extractFactsFromConversation(conv);
        const { saved, deduplicated } = await this.storeFacts(userId, facts, conv);
        
        await this.markConversationMigrated(userId, conv, saved);
        
        result.processedConversations++;
        result.factsCreated += saved;
        result.factsDeduplicated += deduplicated;
        
        console.log(`[PersonalFacts Migration] Processed ${conv.conversationId}: ${saved} facts saved, ${deduplicated} deduplicated`);
        
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
      } catch (err: any) {
        console.error(`[PersonalFacts Migration] Error processing ${conv.conversationId}: ${err.message}`);
        result.errors++;
      }
    }
    
    return result;
  }
  
  /**
   * Run the full migration for a user
   */
  async runFullMigration(userId: string, onProgress?: (result: MigrationResult, remaining: number) => void): Promise<MigrationResult> {
    const totalResult: MigrationResult = {
      totalConversations: 0,
      processedConversations: 0,
      factsCreated: 0,
      factsDeduplicated: 0,
      errors: 0,
      skipped: 0,
    };
    
    let hasMore = true;
    
    while (hasMore) {
      const counts = await this.getConversationCount(userId);
      
      if (counts.remaining === 0) {
        hasMore = false;
        break;
      }
      
      console.log(`[PersonalFacts Migration] Processing batch... ${counts.remaining} conversations remaining`);
      
      const batchResult = await this.runBatch(userId, BATCH_SIZE);
      
      totalResult.totalConversations += batchResult.totalConversations;
      totalResult.processedConversations += batchResult.processedConversations;
      totalResult.factsCreated += batchResult.factsCreated;
      totalResult.factsDeduplicated += batchResult.factsDeduplicated;
      totalResult.errors += batchResult.errors;
      totalResult.skipped += batchResult.skipped;
      
      if (onProgress) {
        onProgress(totalResult, counts.remaining - batchResult.totalConversations);
      }
      
      if (batchResult.totalConversations === 0) {
        hasMore = false;
      }
    }
    
    console.log(`[PersonalFacts Migration] Complete! Facts created: ${totalResult.factsCreated}, Deduplicated: ${totalResult.factsDeduplicated}`);
    
    return totalResult;
  }
}

export const historicalPersonalFactsMigrationService = new HistoricalPersonalFactsMigrationService();
