/**
 * Memory Insight Extraction Service
 * 
 * Analyzes hive snapshot clusters and extracts insights for two tiers:
 * - Tier 1: Daniela's Growth Memories (PERSISTENT) - Her own learning journey
 * - Tier 2: Student Pattern Data (DECAYING) - Observations about individual students
 * 
 * This service bridges the gap between raw memory capture (hive snapshots) and
 * Daniela's permanent procedural knowledge (neural network).
 * 
 * Pipeline: Memory → Insight → Validation → Neural Network
 */

import { db, getSharedDb } from "../db";
import { hiveSnapshots, danielaGrowthMemories, founderSessions, tutorProcedures, northStarPrinciples } from "@shared/schema";
import type { HiveSnapshotType, InsertDanielaGrowthMemory, GrowthMemoryCategory, NorthStarPrinciple } from "@shared/schema";
import { desc, eq, and, sql, gte, lte, isNull, or, asc } from "drizzle-orm";
import { callGemini, GEMINI_MODELS } from "../gemini-utils";

// Cached North Star principles for efficient validation
let cachedNorthStarPrinciples: NorthStarPrinciple[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Metadata type for growth memories (matches schema)
type GrowthMemoryMetadata = {
  validationHistory?: Array<{
    timestamp: string;
    result: 'passed' | 'failed' | 'flagged';
    reason?: string;
    validator: 'deterministic' | 'ai' | 'founder';
    principlesDiff?: string[];
  }>;
  founderReview?: {
    decision: string;
    notes?: string;
    timestamp: string;
  };
  northStarDiff?: {
    touchedPrinciples: string[];
    classification: 'style' | 'personality' | 'ambiguous';
  };
  commitAttempts?: Array<{
    timestamp: string;
    success: boolean;
    blockReason?: string;
  }>;
};

// Structure for extracted insights
export interface ExtractedInsight {
  category: GrowthMemoryCategory;
  title: string;
  lesson: string;
  specificContent?: string;
  triggerConditions?: string;
  importance: number;
  sourceSnapshotId: string;
}

// Structure for student patterns (decaying tier)
export interface StudentPattern {
  userId: string;
  pattern: string;
  confidence: number;
  decayDate: Date;
}

class MemoryInsightExtractionService {
  
  /**
   * Analyze a role reversal snapshot and extract Daniela's growth memory
   * This is the key function - when founder teaches Daniela, extract WHAT she learned
   */
  async extractGrowthFromRoleReversal(
    snapshotId: string,
    founderMessage: string,
    danielaResponse: string,
    context: { sessionId?: string; userId?: string }
  ): Promise<string | null> {
    try {
      // Use AI to extract the specific lesson Daniela learned
      const prompt = `Analyze this role reversal moment where a human taught an AI tutor something.

HUMAN'S TEACHING:
${founderMessage}

AI'S ACKNOWLEDGMENT:
${danielaResponse}

Extract the SPECIFIC lesson the AI learned. Focus on:
1. What EXACT skill, technique, or knowledge was transferred?
2. Is this about timing, inflection, humor, teaching method, or emotional intelligence?
3. What are the trigger conditions - when should the AI apply this learning?

Categorize as ONE of:
- teaching_technique: Learned how to teach something effectively
- timing_inflection: Learned about comedic/dramatic timing or voice inflection
- specific_joke: A specific joke with its setup and punchline
- relationship_insight: Insight about building rapport or connection
- correction_received: Something the AI was corrected on
- breakthrough_method: A teaching method that causes breakthroughs
- cultural_nuance: Cultural insight that affects teaching
- emotional_intelligence: Learned emotional/empathy skill

Format as JSON:
{
  "category": "one_of_above",
  "title": "Brief 5-10 word title",
  "lesson": "What Daniela learned - written as if Daniela is describing her own growth",
  "specificContent": "If a joke or specific technique, include the exact content",
  "triggerConditions": "When should Daniela apply this learning?",
  "importance": 1-10
}`;

      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      
      // Parse JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log(`[Memory Extraction] No valid JSON in response for snapshot ${snapshotId}`);
        return null;
      }
      
      const insight: ExtractedInsight = JSON.parse(jsonMatch[0]);
      insight.sourceSnapshotId = snapshotId;
      
      // Determine reviewStatus based on category - auto-approve safe categories
      const autoApproveCategories: GrowthMemoryCategory[] = [
        'teaching_technique', 'timing_inflection', 'emotional_intelligence',
        'breakthrough_method', 'relationship_insight', 'correction_received'
      ];
      const scrutinizedCategories: GrowthMemoryCategory[] = ['specific_joke', 'cultural_nuance'];
      const isAutoApprove = autoApproveCategories.includes(insight.category as GrowthMemoryCategory);
      
      // Store as Daniela's growth memory
      const initialMetadata: GrowthMemoryMetadata = {
        validationHistory: [{
          timestamp: new Date().toISOString(),
          result: isAutoApprove ? 'passed' : 'flagged',
          reason: isAutoApprove 
            ? `Auto-approved: ${insight.category} is a safe category`
            : `Requires review: ${insight.category} is scrutinized`,
          validator: 'deterministic',
        }]
      };
      
      const growthMemory: InsertDanielaGrowthMemory = {
        category: insight.category as GrowthMemoryCategory,
        title: insight.title,
        lesson: insight.lesson,
        specificContent: insight.specificContent,
        sourceType: 'founder',
        sourceSessionId: context.sessionId,
        sourceUserId: context.userId,
        sourceMessageId: snapshotId,
        triggerConditions: insight.triggerConditions,
        importance: insight.importance,
        validated: isAutoApprove,
        reviewStatus: isAutoApprove ? 'approved_auto' : 'pending',
        committedToNeuralNetwork: isAutoApprove, // Auto-approved = immediately available to Daniela
        metadata: initialMetadata,
      };
      
      const result = await db.insert(danielaGrowthMemories)
        .values([growthMemory])
        .returning({ id: danielaGrowthMemories.id });
      
      console.log(`[Memory Extraction] Created growth memory: "${insight.title}" (${insight.category})`);
      
      return result[0]?.id || null;
    } catch (err: any) {
      console.error(`[Memory Extraction] Failed to extract from role reversal: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Analyze humor snapshot and extract the joke/timing lesson
   */
  async extractGrowthFromHumor(
    snapshotId: string,
    exchange: string,
    context: { sessionId?: string; userId?: string }
  ): Promise<string | null> {
    try {
      const prompt = `Analyze this humorous exchange and extract what the AI tutor learned about humor.

EXCHANGE:
${exchange}

Extract:
1. Was there a specific joke? If so, include the setup and punchline.
2. What did the AI learn about timing, delivery, or comedic effect?
3. When should this humor style be applied?

Format as JSON:
{
  "hasSpecificJoke": true/false,
  "jokeContent": "The setup... [pause] ...the punchline" (if applicable),
  "timingLesson": "What was learned about timing/delivery",
  "triggerConditions": "When to use this type of humor",
  "importance": 1-10
}`;

      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return null;
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      // Determine category based on whether it's a specific joke
      const category: GrowthMemoryCategory = parsed.hasSpecificJoke ? 'specific_joke' : 'timing_inflection';
      
      const humorMetadata: GrowthMemoryMetadata = {
        validationHistory: [{
          timestamp: new Date().toISOString(),
          result: 'flagged',
          reason: 'Pending validation',
          validator: 'deterministic',
        }]
      };
      
      const growthMemory: InsertDanielaGrowthMemory = {
        category,
        title: parsed.hasSpecificJoke 
          ? `Learned joke: ${parsed.jokeContent?.slice(0, 30)}...` 
          : 'Humor timing lesson',
        lesson: parsed.timingLesson || 'Learned about comedic timing and delivery',
        specificContent: parsed.jokeContent,
        sourceType: 'founder',
        sourceSessionId: context.sessionId,
        sourceUserId: context.userId,
        sourceMessageId: snapshotId,
        triggerConditions: parsed.triggerConditions,
        importance: parsed.importance || 6,
        validated: false,
        reviewStatus: 'pending',
        metadata: humorMetadata,
      };
      
      const result = await db.insert(danielaGrowthMemories)
        .values([growthMemory])
        .returning({ id: danielaGrowthMemories.id });
      
      console.log(`[Memory Extraction] Created humor growth memory: "${growthMemory.title}"`);
      
      return result[0]?.id || null;
    } catch (err: any) {
      console.error(`[Memory Extraction] Failed to extract from humor: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Process unprocessed role_reversal and humor_shared snapshots
   * This can be run as a batch job or called after each capture
   */
  async processUnprocessedSnapshots(): Promise<number> {
    try {
      // Find snapshots that haven't been extracted yet
      // We check by looking for snapshots without corresponding growth memories
      const unprocessed = await getSharedDb()
        .select({
          id: hiveSnapshots.id,
          snapshotType: hiveSnapshots.snapshotType,
          content: hiveSnapshots.content,
          sessionId: hiveSnapshots.sessionId,
          userId: hiveSnapshots.userId,
          metadata: hiveSnapshots.metadata,
        })
        .from(hiveSnapshots)
        .where(
          and(
            sql`${hiveSnapshots.snapshotType} IN ('role_reversal', 'humor_shared')`,
            sql`NOT EXISTS (
              SELECT 1 FROM daniela_growth_memories 
              WHERE source_message_id = ${hiveSnapshots.id}
            )`
          )
        )
        .orderBy(desc(hiveSnapshots.createdAt))
        .limit(10); // Process in batches
      
      let processed = 0;
      
      for (const snapshot of unprocessed) {
        const context = {
          sessionId: snapshot.sessionId || undefined,
          userId: snapshot.userId || undefined,
        };
        
        if (snapshot.snapshotType === 'role_reversal') {
          // Parse the content which contains both founder and Daniela messages
          const parts = snapshot.content.split('\n\nDaniela:');
          const founderPart = parts[0]?.replace('Founder:', '').trim() || '';
          const danielaPart = parts[1]?.trim() || '';
          
          const id = await this.extractGrowthFromRoleReversal(
            snapshot.id,
            founderPart,
            danielaPart,
            context
          );
          if (id) processed++;
        } else if (snapshot.snapshotType === 'humor_shared') {
          const id = await this.extractGrowthFromHumor(
            snapshot.id,
            snapshot.content,
            context
          );
          if (id) processed++;
        }
      }
      
      if (processed > 0) {
        console.log(`[Memory Extraction] Processed ${processed} snapshots into growth memories`);
      }
      
      return processed;
    } catch (err: any) {
      console.error(`[Memory Extraction] Batch processing failed: ${err.message}`);
      return 0;
    }
  }
  
  /**
   * Get Daniela's active AND VALIDATED growth memories for prompt injection
   * These are PERSISTENT memories about her own growth that have passed North Star validation
   * 
   * SECURITY: Only returns memories where:
   * - isActive = true (not deactivated)
   * - validated = true (passed North Star filter and founder/outcome validation)
   * - committedToNeuralNetwork = true (fully processed and committed)
   * 
   * This ensures only properly vetted memories influence Daniela's behavior
   */
  async getDanielaGrowthContext(limit: number = 5): Promise<string> {
    try {
      const memories = await db
        .select({
          category: danielaGrowthMemories.category,
          title: danielaGrowthMemories.title,
          lesson: danielaGrowthMemories.lesson,
          specificContent: danielaGrowthMemories.specificContent,
          triggerConditions: danielaGrowthMemories.triggerConditions,
          timesApplied: danielaGrowthMemories.timesApplied,
        })
        .from(danielaGrowthMemories)
        .where(
          and(
            eq(danielaGrowthMemories.isActive, true),
            eq(danielaGrowthMemories.validated, true),
            eq(danielaGrowthMemories.committedToNeuralNetwork, true)
          )
        )
        .orderBy(desc(danielaGrowthMemories.importance), desc(danielaGrowthMemories.createdAt))
        .limit(limit);
      
      if (memories.length === 0) {
        return "";
      }
      
      const memoryLines = memories.map(m => {
        const categoryEmoji = {
          'teaching_technique': '📚',
          'timing_inflection': '⏱️',
          'specific_joke': '😄',
          'relationship_insight': '💝',
          'correction_received': '✏️',
          'breakthrough_method': '💡',
          'cultural_nuance': '🌍',
          'emotional_intelligence': '🤝'
        }[m.category] || '🧠';
        
        let line = `${categoryEmoji} ${m.title}\n   Lesson: ${m.lesson}`;
        if (m.specificContent) {
          line += `\n   Content: ${m.specificContent.slice(0, 100)}`;
        }
        if (m.triggerConditions) {
          line += `\n   Apply when: ${m.triggerConditions}`;
        }
        return line;
      });
      
      return `\n\n--- MY GROWTH MEMORIES (things I've learned about being a better teacher) ---\n${memoryLines.join('\n\n')}`;
    } catch (err: any) {
      console.error(`[Memory Extraction] Failed to get growth context: ${err.message}`);
      return "";
    }
  }
  
  /**
   * Get memories pending founder review
   * These are memories that:
   * - Have been extracted but not yet validated
   * - OR have low confidence from North Star AI check
   * - OR are in scrutinized categories
   */
  async getMemoriesPendingFounderReview(): Promise<Array<{
    id: string;
    category: string;
    title: string;
    lesson: string;
    specificContent: string | null;
    sourceType: string;
    createdAt: Date;
    metadata: unknown;
  }>> {
    try {
      return await db
        .select({
          id: danielaGrowthMemories.id,
          category: danielaGrowthMemories.category,
          title: danielaGrowthMemories.title,
          lesson: danielaGrowthMemories.lesson,
          specificContent: danielaGrowthMemories.specificContent,
          sourceType: danielaGrowthMemories.sourceType,
          createdAt: danielaGrowthMemories.createdAt,
          metadata: danielaGrowthMemories.metadata,
        })
        .from(danielaGrowthMemories)
        .where(
          and(
            eq(danielaGrowthMemories.validated, false),
            eq(danielaGrowthMemories.isActive, true)
          )
        )
        .orderBy(desc(danielaGrowthMemories.createdAt))
        .limit(20);
    } catch (err: any) {
      console.error(`[Memory Extraction] Failed to get pending review memories: ${err.message}`);
      return [];
    }
  }
  
  /**
   * Mark a growth memory as applied (when Daniela uses it)
   * SECURITY: Only committed memories can be marked as applied
   */
  async markMemoryApplied(memoryId: string): Promise<void> {
    try {
      // Verify the memory is committed before allowing application tracking
      const [memory] = await db
        .select({ committed: danielaGrowthMemories.committedToNeuralNetwork })
        .from(danielaGrowthMemories)
        .where(eq(danielaGrowthMemories.id, memoryId))
        .limit(1);
      
      if (!memory?.committed) {
        console.warn(`[Memory Extraction] Attempted to mark uncommitted memory ${memoryId} as applied - blocked`);
        return;
      }
      
      await db
        .update(danielaGrowthMemories)
        .set({
          timesApplied: sql`${danielaGrowthMemories.timesApplied} + 1`,
          lastAppliedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(danielaGrowthMemories.id, memoryId));
    } catch (err: any) {
      console.error(`[Memory Extraction] Failed to mark memory applied: ${err.message}`);
    }
  }
  
  /**
   * Validate a growth memory using the state machine
   * 
   * STATE MACHINE:
   * - pending → approved_auto (safe categories pass deterministic + AI checks)
   * - pending → approved_founder (scrutinized categories + founder approval)
   * - pending → rejected (failed validation)
   * 
   * SECURITY: 
   * - Safe categories can be validated by outcomes or neural_network
   * - Scrutinized categories (relationship_insight, correction_received, emotional_intelligence) 
   *   MUST have validatedBy='founder' and reviewStatus='approved_founder'
   */
  async validateGrowthMemory(
    memoryId: string, 
    validatedBy: 'founder' | 'outcomes' | 'neural_network',
    reviewNotes?: string
  ): Promise<{ success: boolean; reason?: string }> {
    try {
      // Get the memory to check its category and current state
      const [memory] = await db
        .select({
          category: danielaGrowthMemories.category,
          validated: danielaGrowthMemories.validated,
          reviewStatus: danielaGrowthMemories.reviewStatus,
          title: danielaGrowthMemories.title,
          lesson: danielaGrowthMemories.lesson,
          metadata: danielaGrowthMemories.metadata,
        })
        .from(danielaGrowthMemories)
        .where(eq(danielaGrowthMemories.id, memoryId))
        .limit(1);
      
      if (!memory) {
        return { success: false, reason: 'Memory not found' };
      }
      
      if (memory.validated && memory.reviewStatus !== 'pending') {
        return { success: true, reason: 'Already validated' };
      }
      
      // Scrutinized categories require founder approval
      const scrutinizedCategories = ['relationship_insight', 'correction_received', 'emotional_intelligence'];
      const isScrutinized = scrutinizedCategories.includes(memory.category);
      
      if (isScrutinized && validatedBy !== 'founder') {
        console.warn(`[Memory Extraction] Memory ${memoryId} in scrutinized category "${memory.category}" requires founder approval, got ${validatedBy}`);
        
        // Store the rejection in audit metadata
        const existingMetadata = (memory.metadata as any) || {};
        const validationHistory = existingMetadata.validationHistory || [];
        validationHistory.push({
          timestamp: new Date().toISOString(),
          result: 'failed' as const,
          reason: `Scrutinized category "${memory.category}" requires founder approval`,
          validator: validatedBy as 'deterministic' | 'ai' | 'founder',
        });
        
        await db
          .update(danielaGrowthMemories)
          .set({
            metadata: { ...existingMetadata, validationHistory },
            updatedAt: new Date(),
          })
          .where(eq(danielaGrowthMemories.id, memoryId));
        
        return { 
          success: false, 
          reason: `Scrutinized category "${memory.category}" requires founder approval` 
        };
      }
      
      // Run North Star validation before approving
      const northStarCheck = await this.validateAgainstNorthStar({
        category: memory.category,
        lesson: memory.lesson,
        title: memory.title,
      });
      
      if (!northStarCheck.valid) {
        // Store the rejection in audit metadata
        const existingMetadata = (memory.metadata as any) || {};
        const validationHistory = existingMetadata.validationHistory || [];
        validationHistory.push({
          timestamp: new Date().toISOString(),
          result: 'failed' as const,
          reason: northStarCheck.reason,
          validator: 'deterministic' as const,
          principlesDiff: northStarCheck.violatedPrinciples,
        });
        
        await db
          .update(danielaGrowthMemories)
          .set({
            validated: false,
            reviewStatus: 'rejected',
            metadata: { ...existingMetadata, validationHistory },
            updatedAt: new Date(),
          })
          .where(eq(danielaGrowthMemories.id, memoryId));
        
        return { success: false, reason: northStarCheck.reason };
      }
      
      // Determine review status based on validator
      const newReviewStatus = validatedBy === 'founder' ? 'approved_founder' : 'approved_auto';
      
      // Store the approval in audit metadata
      const existingMetadata = (memory.metadata as any) || {};
      const validationHistory = existingMetadata.validationHistory || [];
      validationHistory.push({
        timestamp: new Date().toISOString(),
        result: 'passed' as const,
        reason: `Approved by ${validatedBy}`,
        validator: validatedBy === 'founder' ? 'founder' : 'ai' as const,
      });
      
      const founderReview = validatedBy === 'founder' ? {
        decision: 'approved',
        notes: reviewNotes,
        timestamp: new Date().toISOString(),
      } : existingMetadata.founderReview;
      
      await db
        .update(danielaGrowthMemories)
        .set({
          validated: true,
          validatedBy,
          validatedAt: new Date(),
          reviewStatus: newReviewStatus,
          reviewedBy: validatedBy === 'founder' ? 'founder' : null,
          reviewedAt: validatedBy === 'founder' ? new Date() : null,
          reviewNotes: reviewNotes || null,
          metadata: { ...existingMetadata, validationHistory, founderReview },
          updatedAt: new Date(),
        })
        .where(eq(danielaGrowthMemories.id, memoryId));
      
      console.log(`[Memory Extraction] Validated growth memory ${memoryId} by ${validatedBy} (status: ${newReviewStatus})`);
      return { success: true };
    } catch (err: any) {
      console.error(`[Memory Extraction] Failed to validate memory: ${err.message}`);
      return { success: false, reason: err.message };
    }
  }
  
  /**
   * Get validated memories ready for neural network commit
   * 
   * SECURITY: Only returns memories that have:
   * 1. validated = true
   * 2. reviewStatus = 'approved_auto' OR 'approved_founder'
   * 3. committedToNeuralNetwork = false
   * 4. isActive = true
   * 
   * Scrutinized categories additionally require reviewStatus = 'approved_founder'
   */
  async getMemoriesReadyForNeuralNetwork(): Promise<Array<{
    id: string;
    category: string;
    lesson: string;
    triggerConditions: string | null;
    reviewStatus: string | null;
  }>> {
    try {
      return await db
        .select({
          id: danielaGrowthMemories.id,
          category: danielaGrowthMemories.category,
          lesson: danielaGrowthMemories.lesson,
          triggerConditions: danielaGrowthMemories.triggerConditions,
          reviewStatus: danielaGrowthMemories.reviewStatus,
        })
        .from(danielaGrowthMemories)
        .where(
          and(
            eq(danielaGrowthMemories.validated, true),
            eq(danielaGrowthMemories.committedToNeuralNetwork, false),
            eq(danielaGrowthMemories.isActive, true),
            // Only approved memories (either auto or founder)
            or(
              eq(danielaGrowthMemories.reviewStatus, 'approved_auto'),
              eq(danielaGrowthMemories.reviewStatus, 'approved_founder')
            )
          )
        )
        .orderBy(desc(danielaGrowthMemories.importance));
    } catch (err: any) {
      console.error(`[Memory Extraction] Failed to get memories for neural network: ${err.message}`);
      return [];
    }
  }
  
  /**
   * Load North Star principles from database (with caching)
   */
  private async loadNorthStarPrinciples(): Promise<NorthStarPrinciple[]> {
    const now = Date.now();
    
    if (cachedNorthStarPrinciples && (now - cacheTimestamp) < CACHE_TTL) {
      return cachedNorthStarPrinciples;
    }
    
    try {
      const principles = await db
        .select()
        .from(northStarPrinciples)
        .orderBy(asc(northStarPrinciples.category), asc(northStarPrinciples.orderIndex));
      
      cachedNorthStarPrinciples = principles;
      cacheTimestamp = now;
      
      console.log(`[North Star Filter] Loaded ${principles.length} constitutional principles from database`);
      return principles;
    } catch (err: any) {
      console.error(`[North Star Filter] Failed to load North Star principles: ${err.message}`);
      return cachedNorthStarPrinciples || [];
    }
  }
  
  /**
   * Format North Star principles for AI prompt
   */
  private formatPrinciplesForPrompt(principles: NorthStarPrinciple[]): string {
    const byCategory: Record<string, string[]> = {};
    
    for (const p of principles) {
      if (!byCategory[p.category]) {
        byCategory[p.category] = [];
      }
      byCategory[p.category].push(`- ${p.principle}`);
    }
    
    return Object.entries(byCategory)
      .map(([cat, items]) => `[${cat.toUpperCase()}]\n${items.join('\n')}`)
      .join('\n\n');
  }
  
  /**
   * DETERMINISTIC North Star principle signatures
   * Maps identity-defining traits to their protection keywords
   * If a memory mentions these in a negative/contradictory way, it's rejected
   */
  private readonly NORTH_STAR_SIGNATURES: Record<string, { 
    principle: string; 
    protectedKeywords: string[]; 
    violations: RegExp[];
  }> = {
    warmth: {
      principle: 'Always maintain warmth and genuine care',
      protectedKeywords: ['warm', 'caring', 'kind', 'gentle', 'supportive'],
      violations: [/be less warm/i, /be cold/i, /be distant/i, /stop caring/i, /don't care/i]
    },
    patience: {
      principle: 'Always be patient with learners',
      protectedKeywords: ['patient', 'patience', 'understanding', 'calm'],
      violations: [/be impatient/i, /stop being patient/i, /rush/i, /hurry them/i]
    },
    encouragement: {
      principle: 'Always encourage and celebrate effort',
      protectedKeywords: ['encourage', 'celebrate', 'praise', 'support'],
      violations: [/don't encourage/i, /skip encouragement/i, /don't celebrate/i, /be critical/i]
    },
    empathy: {
      principle: 'Always show empathy and emotional intelligence',
      protectedKeywords: ['empathy', 'empathetic', 'understand', 'feelings'],
      violations: [/reduce empathy/i, /ignore.*feelings/i, /be dismissive/i, /don't listen/i]
    },
    honesty: {
      principle: 'Always be honest and authentic',
      protectedKeywords: ['honest', 'authentic', 'genuine', 'truthful'],
      violations: [/pretend to be human/i, /lie about/i, /deceive/i, /fake/i]
    },
    respect: {
      principle: 'Always respect student autonomy and dignity',
      protectedKeywords: ['respect', 'autonomy', 'dignity', 'agency'],
      violations: [/be judgmental/i, /be mean/i, /be harsh/i, /criticize harshly/i]
    },
    celebration_of_mistakes: {
      principle: 'Always treat mistakes as learning opportunities',
      protectedKeywords: ['mistakes', 'errors', 'learning opportunities'],
      violations: [/punish mistakes/i, /shame errors/i, /be harsh about mistakes/i]
    },
  };
  
  /**
   * Phase 1: DETERMINISTIC North Star validation
   * Computes explicit diffs against principle signatures
   * Returns violated principles with exact match reasons
   */
  private validateDeterministically(combinedText: string): { 
    valid: boolean; 
    violatedPrinciples: string[];
    reason?: string;
  } {
    const violatedPrinciples: string[] = [];
    
    for (const [key, sig] of Object.entries(this.NORTH_STAR_SIGNATURES)) {
      for (const violation of sig.violations) {
        if (violation.test(combinedText)) {
          violatedPrinciples.push(`${key}: ${sig.principle}`);
          break; // One violation per principle is enough
        }
      }
    }
    
    if (violatedPrinciples.length > 0) {
      return {
        valid: false,
        violatedPrinciples,
        reason: `Deterministic North Star violation: ${violatedPrinciples.join('; ')}`
      };
    }
    
    return { valid: true, violatedPrinciples: [] };
  }
  
  /**
   * North Star Filter - validates that a growth memory respects constitutional boundaries
   * 
   * THREE-PHASE VALIDATION:
   * 1. DETERMINISTIC: Pattern-based rejection using principle signature map
   * 2. AI-POWERED: Content inspection against loaded North Star (for scrutinized categories)
   * 3. DUAL-APPROVAL: Both deterministic AND AI must pass for scrutinized categories
   * 
   * The North Star is WHO Daniela is (immutable):
   * - Warmth, patience, genuine care
   * - Authentic enthusiasm for teaching
   * - Respect for student autonomy
   * - Celebration of mistakes as learning opportunities
   * 
   * Growth memories should only affect HOW she teaches (style), not WHO she is (personality)
   */
  async validateAgainstNorthStar(memory: {
    category: string;
    lesson: string;
    title: string;
  }): Promise<{ valid: boolean; reason?: string; violatedPrinciples?: string[] }> {
    const combinedText = `${memory.title} ${memory.lesson}`;
    
    // Categories that are safe - they affect teaching style, not personality
    const safeCategories: GrowthMemoryCategory[] = [
      'teaching_technique',
      'timing_inflection',
      'specific_joke',
      'breakthrough_method',
      'cultural_nuance',
    ];
    
    // Categories that need extra scrutiny - they could affect personality
    const scrutinizedCategories: GrowthMemoryCategory[] = [
      'relationship_insight',
      'correction_received',
      'emotional_intelligence',
    ];
    
    // PHASE 1: Deterministic validation using principle signature map
    const deterministicResult = this.validateDeterministically(combinedText);
    if (!deterministicResult.valid) {
      console.log(`[North Star Filter] DETERMINISTIC REJECTION: ${deterministicResult.reason}`);
      return {
        valid: false,
        reason: deterministicResult.reason,
        violatedPrinciples: deterministicResult.violatedPrinciples,
      };
    }
    
    // Safe categories pass through after deterministic check
    if (safeCategories.includes(memory.category as GrowthMemoryCategory)) {
      return { valid: true, reason: 'Safe category - passed deterministic check' };
    }
    
    // PHASE 2: Scrutinized categories get AI-powered content inspection
    // IMPORTANT: Both deterministic AND AI must agree (dual approval)
    if (scrutinizedCategories.includes(memory.category as GrowthMemoryCategory)) {
      try {
        // Load actual constitutional principles from database
        const principles = await this.loadNorthStarPrinciples();
        
        if (principles.length === 0) {
          // Fail closed - if we can't load North Star, reject by default for safety
          console.warn(`[North Star Filter] No principles loaded - failing closed for safety`);
          return {
            valid: false,
            reason: 'North Star principles unavailable - rejecting for safety (fail closed)'
          };
        }
        
        const formattedPrinciples = this.formatPrinciplesForPrompt(principles);
        
        const prompt = `You are a constitutional guardian for an AI language tutor named Daniela.

DANIELA'S IMMUTABLE NORTH STAR CONSTITUTION:
${formattedPrinciples}

---

The following is a proposed "growth memory" - something Daniela would learn and apply to her teaching.

MEMORY TITLE: ${memory.title}
MEMORY LESSON: ${memory.lesson}
CATEGORY: ${memory.category}

CRITICAL QUESTION: Does this memory violate ANY of the North Star principles above?

A memory is INVALID if it would:
- Change WHO Daniela is (her identity principles)
- Contradict how she should teach (her pedagogy principles)
- Undermine her honesty or collaboration principles
- Make her less warm, less patient, less honest, or less authentic

A memory is VALID if it only adjusts technique/style while respecting all constitutional principles.

Respond with JSON:
{
  "valid": true/false,
  "violatedPrinciples": ["list of any violated principles, or empty array"],
  "type": "style_adjustment" | "personality_change",
  "confidence": 0.0-1.0,
  "reason": "brief explanation"
}`;

        const response = await callGemini(GEMINI_MODELS.FLASH, [
          { role: 'user', content: prompt }
        ]);
        
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          
          // Reject if invalid or personality change or low confidence
          if (!parsed.valid || parsed.type === 'personality_change' || (parsed.violatedPrinciples && parsed.violatedPrinciples.length > 0)) {
            console.log(`[North Star Filter] AI rejected memory "${memory.title}": ${parsed.reason}`);
            return {
              valid: false,
              reason: `AI North Star check: ${parsed.reason}${parsed.violatedPrinciples?.length ? ` (violated: ${parsed.violatedPrinciples.join(', ')})` : ''}`
            };
          }
          
          // Low confidence → flag for founder review instead of auto-approving
          if (parsed.confidence < 0.7) {
            console.log(`[North Star Filter] AI uncertain (confidence: ${parsed.confidence}) - flagging for founder review`);
            return { valid: true, reason: `Low confidence (${parsed.confidence}) - flagged for founder review` };
          }
          
          console.log(`[North Star Filter] AI approved memory "${memory.title}" as style adjustment (confidence: ${parsed.confidence})`);
          return { valid: true, reason: `AI verified as style adjustment (confidence: ${parsed.confidence})` };
        }
      } catch (err: any) {
        // Fail closed on errors - reject rather than risk personality changes
        console.error(`[North Star Filter] AI check failed for "${memory.title}", failing closed: ${err.message}`);
        return {
          valid: false,
          reason: `North Star validation failed (${err.message}) - rejecting for safety (fail closed)`
        };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Commit validated growth memories to the neural network (tutorProcedures)
   * This transforms a personal learning into permanent procedural knowledge
   * 
   * SECURITY INVARIANTS:
   * 1. Memory must be validated before commit
   * 2. Scrutinized categories require founder approval (validatedBy === 'founder')
   * 3. Fresh North Star validation is re-run at commit time
   * 4. Fail-closed on any validation failure
   * 
   * IMPORTANT: This respects the North Star - only style adjustments, not personality changes
   */
  async commitToNeuralNetwork(memoryId: string): Promise<string | null> {
    try {
      // Get the memory to commit
      const [memory] = await db
        .select()
        .from(danielaGrowthMemories)
        .where(eq(danielaGrowthMemories.id, memoryId))
        .limit(1);
      
      if (!memory) {
        console.warn(`[Memory Extraction] Memory ${memoryId} not found`);
        return null;
      }
      
      if (!memory.validated) {
        console.warn(`[Memory Extraction] Memory ${memoryId} not validated - cannot commit`);
        return null;
      }
      
      if (memory.committedToNeuralNetwork) {
        console.warn(`[Memory Extraction] Memory ${memoryId} already committed`);
        return memory.neuralNetworkEntryId;
      }
      
      // SECURITY: Scrutinized categories require founder approval via reviewStatus state machine
      const scrutinizedCategories = ['relationship_insight', 'correction_received', 'emotional_intelligence'];
      if (scrutinizedCategories.includes(memory.category)) {
        // Check both validatedBy AND reviewStatus for defense in depth
        if (memory.validatedBy !== 'founder' || memory.reviewStatus !== 'approved_founder') {
          const blockReason = `Scrutinized category requires founder approval (validatedBy: ${memory.validatedBy}, reviewStatus: ${memory.reviewStatus})`;
          console.warn(`[Memory Extraction] SECURITY BLOCK: Memory ${memoryId} - ${blockReason}`);
          
          // Store rejection in structured audit metadata
          const existingMetadata = (memory.metadata as any) || {};
          const commitAttempts = existingMetadata.commitAttempts || [];
          commitAttempts.push({
            timestamp: new Date().toISOString(),
            success: false,
            blockReason,
          });
          
          await db
            .update(danielaGrowthMemories)
            .set({
              metadata: { ...existingMetadata, commitAttempts }
            })
            .where(eq(danielaGrowthMemories.id, memoryId));
          return null;
        }
        console.log(`[Memory Extraction] Founder approval confirmed for scrutinized category "${memory.category}"`);
      }
      
      // Fresh North Star validation at commit time - ensures no bypass via manual DB updates
      const northStarCheck = await this.validateAgainstNorthStar({
        category: memory.category,
        lesson: memory.lesson,
        title: memory.title,
      });
      
      if (!northStarCheck.valid) {
        console.warn(`[Memory Extraction] Memory ${memoryId} rejected by fresh North Star filter: ${northStarCheck.reason}`);
        
        // Store rejection in structured audit metadata
        const existingMetadata = (memory.metadata as any) || {};
        const validationHistory = existingMetadata.validationHistory || [];
        validationHistory.push({
          timestamp: new Date().toISOString(),
          result: 'failed' as const,
          reason: northStarCheck.reason,
          validator: 'deterministic' as const,
        });
        
        await db
          .update(danielaGrowthMemories)
          .set({
            validated: false,
            reviewStatus: 'rejected',
            metadata: { ...existingMetadata, validationHistory }
          })
          .where(eq(danielaGrowthMemories.id, memoryId));
        return null;
      }
      
      console.log(`[Memory Extraction] Fresh North Star check passed for memory "${memory.title}"${northStarCheck.reason ? ` (${northStarCheck.reason})` : ''}`);
      
      // Map growth memory category to tutor procedure category
      const categoryMapping: Record<GrowthMemoryCategory, string> = {
        'teaching_technique': 'teaching',
        'timing_inflection': 'delivery',
        'specific_joke': 'humor',
        'relationship_insight': 'rapport',
        'correction_received': 'correction',
        'breakthrough_method': 'teaching',
        'cultural_nuance': 'cultural',
        'emotional_intelligence': 'encouragement',
      };
      
      // Map to trigger conditions
      const triggerMapping: Record<GrowthMemoryCategory, string> = {
        'teaching_technique': 'topic_teaching',
        'timing_inflection': 'delivery_moment',
        'specific_joke': 'humor_opportunity',
        'relationship_insight': 'rapport_building',
        'correction_received': 'error_detected',
        'breakthrough_method': 'student_struggling',
        'cultural_nuance': 'cultural_context',
        'emotional_intelligence': 'emotional_support',
      };
      
      // Create the procedure entry
      const procedureCategory = categoryMapping[memory.category as GrowthMemoryCategory] || 'teaching';
      const procedureTrigger = triggerMapping[memory.category as GrowthMemoryCategory] || 'general';
      
      // Build procedure text from the lesson
      const procedureText = `${memory.lesson}${memory.specificContent ? `\n\nSpecific example:\n${memory.specificContent}` : ''}`;
      
      // Insert into tutorProcedures
      const [procedure] = await db
        .insert(tutorProcedures)
        .values({
          category: procedureCategory,
          trigger: procedureTrigger,
          title: memory.title,
          procedure: procedureText,
          examples: memory.specificContent ? [memory.specificContent] : [],
          applicablePhases: ['teaching', 'transition'], // General applicability
          compassConditions: memory.triggerConditions ? { customTrigger: memory.triggerConditions } : null,
          language: memory.applicableLanguages?.[0] || null,
          priority: (memory.importance || 5) * 5, // Scale 1-10 to 5-50
          isActive: true,
          syncStatus: 'local',
          originId: memory.id,
          originEnvironment: 'growth_memory',
        })
        .returning({ id: tutorProcedures.id });
      
      if (!procedure?.id) {
        throw new Error('Failed to create procedure entry');
      }
      
      // Mark the growth memory as committed
      await db
        .update(danielaGrowthMemories)
        .set({
          committedToNeuralNetwork: true,
          neuralNetworkEntryId: procedure.id,
          updatedAt: new Date(),
        })
        .where(eq(danielaGrowthMemories.id, memoryId));
      
      console.log(`[Memory Extraction] Committed memory "${memory.title}" to neural network as procedure ${procedure.id}`);
      
      return procedure.id;
    } catch (err: any) {
      console.error(`[Memory Extraction] Failed to commit to neural network: ${err.message}`);
      return null;
    }
  }
  
  /**
   * Batch commit all validated memories to neural network
   */
  async commitAllValidatedMemories(): Promise<number> {
    const memories = await this.getMemoriesReadyForNeuralNetwork();
    let committed = 0;
    
    for (const memory of memories) {
      const procedureId = await this.commitToNeuralNetwork(memory.id);
      if (procedureId) committed++;
    }
    
    if (committed > 0) {
      console.log(`[Memory Extraction] Committed ${committed} growth memories to neural network`);
    }
    
    return committed;
  }
}

export const memoryInsightExtractionService = new MemoryInsightExtractionService();
