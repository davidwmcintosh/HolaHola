/**
 * Memory Checkpoint Service
 * 
 * Persists student utterances incrementally during voice sessions to survive interruptions.
 * Works with background recovery to ensure memories are never lost due to:
 * - Network disconnects
 * - Browser crashes  
 * - Battery deaths
 * - Navigation away
 * - Session timeouts
 * 
 * Each student utterance is checkpointed immediately, and later processed
 * by either the session end handler or background recovery worker.
 */

import { db, getSharedDb } from '../db';
import { learnerMemoryCandidates, learnerPersonalFacts } from '@shared/schema';
import { eq, and, inArray, sql, isNull, lt, desc } from 'drizzle-orm';
import crypto from 'crypto';

export type CandidateStatus = 'pending' | 'processing' | 'extracted' | 'skipped';

interface CheckpointResult {
  id: string;
  contentHash: string;
  isDuplicate: boolean;
}

interface PendingCandidate {
  id: string;
  studentId: string;
  sessionId: string;
  dbSessionId: string | null;
  language: string;
  utterance: string;
  messageIndex: number;
  status: string;
  contentHash: string | null;
  createdAt: Date;
}

class MemoryCheckpointService {
  
  /**
   * Generate a content hash for deduplication
   * Hash is based on studentId + normalized utterance
   */
  private generateContentHash(studentId: string, utterance: string): string {
    const normalized = utterance.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('sha256')
      .update(`${studentId}:${normalized}`)
      .digest('hex')
      .substring(0, 32); // Use first 32 chars for reasonable index size
  }
  
  /**
   * Generate a fact hash for deduplication during extraction
   * Hash is based on studentId + factType + normalized fact text
   */
  generateFactHash(studentId: string, factType: string, fact: string): string {
    const normalized = fact.toLowerCase().trim().replace(/\s+/g, ' ');
    return crypto.createHash('sha256')
      .update(`${studentId}:${factType}:${normalized}`)
      .digest('hex')
      .substring(0, 32);
  }
  
  /**
   * Checkpoint a student utterance during a voice session
   * Called after each student turn to persist immediately
   */
  async checkpointUtterance(
    studentId: string,
    sessionId: string,
    dbSessionId: string | null,
    language: string,
    utterance: string,
    messageIndex: number
  ): Promise<CheckpointResult> {
    const contentHash = this.generateContentHash(studentId, utterance);
    
    // Check for duplicate in same session (exact same utterance)
    const [existing] = await getSharedDb()
      .select({ id: learnerMemoryCandidates.id })
      .from(learnerMemoryCandidates)
      .where(and(
        eq(learnerMemoryCandidates.sessionId, sessionId),
        eq(learnerMemoryCandidates.contentHash, contentHash)
      ))
      .limit(1);
    
    if (existing) {
      console.log(`[MemoryCheckpoint] Duplicate utterance in session, skipping: ${utterance.substring(0, 50)}...`);
      return {
        id: existing.id,
        contentHash,
        isDuplicate: true
      };
    }
    
    // Insert new candidate
    const [inserted] = await getSharedDb()
      .insert(learnerMemoryCandidates)
      .values({
        studentId,
        sessionId,
        dbSessionId,
        language,
        utterance,
        messageIndex,
        status: 'pending',
        contentHash,
      })
      .returning({ id: learnerMemoryCandidates.id });
    
    console.log(`[MemoryCheckpoint] Checkpointed utterance ${messageIndex} for session ${sessionId.substring(0, 8)}...`);
    
    return {
      id: inserted.id,
      contentHash,
      isDuplicate: false
    };
  }
  
  /**
   * Get all pending candidates for a session
   * Used when session ends normally to process accumulated utterances
   */
  async getPendingForSession(sessionId: string): Promise<PendingCandidate[]> {
    const candidates = await getSharedDb()
      .select()
      .from(learnerMemoryCandidates)
      .where(and(
        eq(learnerMemoryCandidates.sessionId, sessionId),
        eq(learnerMemoryCandidates.status, 'pending')
      ))
      .orderBy(learnerMemoryCandidates.messageIndex);
    
    return candidates as PendingCandidate[];
  }
  
  /**
   * Get orphaned candidates from sessions that didn't end cleanly
   * These are older than staleness threshold with no processed_at
   */
  async getOrphanedCandidates(maxAgeMinutes: number = 30): Promise<PendingCandidate[]> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    
    const candidates = await getSharedDb()
      .select()
      .from(learnerMemoryCandidates)
      .where(and(
        eq(learnerMemoryCandidates.status, 'pending'),
        lt(learnerMemoryCandidates.createdAt, cutoff)
      ))
      .orderBy(learnerMemoryCandidates.createdAt)
      .limit(100); // Process in batches
    
    return candidates as PendingCandidate[];
  }
  
  /**
   * Mark candidates as processing to prevent duplicate extraction
   */
  async markProcessing(candidateIds: string[]): Promise<void> {
    if (candidateIds.length === 0) return;
    
    await getSharedDb()
      .update(learnerMemoryCandidates)
      .set({ status: 'processing' })
      .where(inArray(learnerMemoryCandidates.id, candidateIds));
  }
  
  /**
   * Mark candidates as extracted after successful processing
   */
  async markExtracted(candidateIds: string[], extractedFactIds: string[]): Promise<void> {
    if (candidateIds.length === 0) return;
    
    await getSharedDb()
      .update(learnerMemoryCandidates)
      .set({ 
        status: 'extracted',
        extractedFactIds,
        processedAt: new Date()
      })
      .where(inArray(learnerMemoryCandidates.id, candidateIds));
  }
  
  /**
   * Mark candidates as skipped (no facts found or too short)
   */
  async markSkipped(candidateIds: string[]): Promise<void> {
    if (candidateIds.length === 0) return;
    
    await getSharedDb()
      .update(learnerMemoryCandidates)
      .set({ 
        status: 'skipped',
        processedAt: new Date()
      })
      .where(inArray(learnerMemoryCandidates.id, candidateIds));
  }
  
  /**
   * Reset stuck processing candidates back to pending
   * For recovery when extraction crashed mid-process
   */
  async resetStuckProcessing(maxAgeMinutes: number = 10): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    
    const result = await getSharedDb()
      .update(learnerMemoryCandidates)
      .set({ status: 'pending' })
      .where(and(
        eq(learnerMemoryCandidates.status, 'processing'),
        lt(learnerMemoryCandidates.createdAt, cutoff)
      ));
    
    // Drizzle doesn't return count, so we estimate
    return 0; // Will log actual count from caller
  }
  
  /**
   * Check if a fact already exists (for idempotent upserts)
   */
  async factExists(factHash: string): Promise<{ exists: boolean; id?: string }> {
    const [existing] = await getSharedDb()
      .select({ id: learnerPersonalFacts.id })
      .from(learnerPersonalFacts)
      .where(eq(learnerPersonalFacts.factHash, factHash))
      .limit(1);
    
    return existing ? { exists: true, id: existing.id } : { exists: false };
  }
  
  /**
   * Increment mention count for existing fact (when re-mentioned)
   */
  async incrementFactMention(factId: string): Promise<void> {
    await getSharedDb()
      .update(learnerPersonalFacts)
      .set({
        mentionCount: sql`${learnerPersonalFacts.mentionCount} + 1`,
        lastMentionedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(learnerPersonalFacts.id, factId));
  }
  
  /**
   * Get stats for monitoring
   */
  async getStats(): Promise<{
    totalPending: number;
    totalProcessing: number;
    totalExtracted: number;
    totalSkipped: number;
    oldestPending: Date | null;
  }> {
    const stats = await getSharedDb()
      .select({
        status: learnerMemoryCandidates.status,
        count: sql<number>`count(*)::int`,
      })
      .from(learnerMemoryCandidates)
      .groupBy(learnerMemoryCandidates.status);
    
    const [oldest] = await getSharedDb()
      .select({ createdAt: learnerMemoryCandidates.createdAt })
      .from(learnerMemoryCandidates)
      .where(eq(learnerMemoryCandidates.status, 'pending'))
      .orderBy(learnerMemoryCandidates.createdAt)
      .limit(1);
    
    const statusCounts = stats.reduce((acc, s) => {
      acc[s.status] = s.count;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalPending: statusCounts['pending'] || 0,
      totalProcessing: statusCounts['processing'] || 0,
      totalExtracted: statusCounts['extracted'] || 0,
      totalSkipped: statusCounts['skipped'] || 0,
      oldestPending: oldest?.createdAt || null
    };
  }
  
  /**
   * Clean up old extracted/skipped candidates (older than 7 days)
   */
  async cleanupOldCandidates(maxAgeDays: number = 7): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);
    
    await getSharedDb()
      .delete(learnerMemoryCandidates)
      .where(and(
        inArray(learnerMemoryCandidates.status, ['extracted', 'skipped']),
        lt(learnerMemoryCandidates.processedAt, cutoff)
      ));
    
    return 0; // Drizzle doesn't return count
  }
}

export const memoryCheckpointService = new MemoryCheckpointService();
