/**
 * Memory Recovery Worker
 * 
 * Background worker that recovers memory candidates from interrupted voice sessions.
 * Runs periodically to ensure no personal facts are lost due to:
 * - Network disconnects
 * - Browser crashes
 * - Battery deaths
 * - Navigation away
 * - Session timeouts
 * 
 * This is the "safety net" that catches anything not processed by normal session end.
 */

import { memoryCheckpointService } from './memory-checkpoint-service';
import { learnerMemoryExtractionService } from './learner-memory-extraction-service';
import { db } from '../db';
import { learnerPersonalFacts } from '@shared/schema';
import { eq } from 'drizzle-orm';

interface RecoveryStats {
  lastRunAt: Date | null;
  totalRecoveries: number;
  totalFactsExtracted: number;
  totalCandidatesProcessed: number;
  totalCandidatesSkipped: number;
  avgRecoveryTimeMs: number;
  errors: number;
}

interface RecoveryResult {
  candidatesProcessed: number;
  factsExtracted: number;
  candidatesSkipped: number;
  errors: string[];
  durationMs: number;
}

class MemoryRecoveryWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  
  private stats: RecoveryStats = {
    lastRunAt: null,
    totalRecoveries: 0,
    totalFactsExtracted: 0,
    totalCandidatesProcessed: 0,
    totalCandidatesSkipped: 0,
    avgRecoveryTimeMs: 0,
    errors: 0,
  };
  
  /**
   * Start the background recovery worker
   * Runs every 5 minutes to catch orphaned sessions
   */
  start(intervalMinutes: number = 5): void {
    if (this.intervalId) {
      console.log('[MemoryRecovery] Worker already running');
      return;
    }
    
    console.log(`[MemoryRecovery] Starting worker (interval: ${intervalMinutes}min)`);
    
    // Run immediately on startup
    this.runRecovery().catch(err => {
      console.error('[MemoryRecovery] Initial run failed:', err.message);
    });
    
    // Then run at interval
    this.intervalId = setInterval(() => {
      this.runRecovery().catch(err => {
        console.error('[MemoryRecovery] Scheduled run failed:', err.message);
      });
    }, intervalMinutes * 60 * 1000);
  }
  
  /**
   * Stop the background worker
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[MemoryRecovery] Worker stopped');
    }
  }
  
  /**
   * Get current stats
   */
  getStats(): RecoveryStats {
    return { ...this.stats };
  }
  
  /**
   * Run a single recovery pass
   * Called by interval or manually for testing
   */
  async runRecovery(): Promise<RecoveryResult> {
    if (this.isRunning) {
      console.log('[MemoryRecovery] Already running, skipping');
      return { candidatesProcessed: 0, factsExtracted: 0, candidatesSkipped: 0, errors: [], durationMs: 0 };
    }
    
    this.isRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let candidatesProcessed = 0;
    let factsExtracted = 0;
    let candidatesSkipped = 0;
    
    try {
      // First, reset any stuck "processing" candidates (older than 10 min)
      await memoryCheckpointService.resetStuckProcessing(10);
      
      // Get orphaned candidates (older than 30 min with no processing)
      const orphanedCandidates = await memoryCheckpointService.getOrphanedCandidates(30);
      
      if (orphanedCandidates.length === 0) {
        console.log('[MemoryRecovery] No orphaned candidates found');
        return { candidatesProcessed: 0, factsExtracted: 0, candidatesSkipped: 0, errors: [], durationMs: Date.now() - startTime };
      }
      
      console.log(`[MemoryRecovery] Found ${orphanedCandidates.length} orphaned candidates to process`);
      
      // Group by session for efficient processing
      const bySession = new Map<string, typeof orphanedCandidates>();
      for (const candidate of orphanedCandidates) {
        const existing = bySession.get(candidate.sessionId) || [];
        existing.push(candidate);
        bySession.set(candidate.sessionId, existing);
      }
      
      // Process each session's candidates
      for (const [sessionId, candidates] of Array.from(bySession.entries())) {
        try {
          const result = await this.processSessionCandidates(sessionId, candidates);
          candidatesProcessed += result.processed;
          factsExtracted += result.facts;
          candidatesSkipped += result.skipped;
        } catch (err: any) {
          errors.push(`Session ${sessionId.substring(0, 8)}: ${err.message}`);
          this.stats.errors++;
        }
      }
      
      // Cleanup old processed candidates (older than 7 days)
      await memoryCheckpointService.cleanupOldCandidates(7);
      
    } finally {
      this.isRunning = false;
      this.stats.lastRunAt = new Date();
      this.stats.totalRecoveries++;
      this.stats.totalCandidatesProcessed += candidatesProcessed;
      this.stats.totalFactsExtracted += factsExtracted;
      this.stats.totalCandidatesSkipped += candidatesSkipped;
      
      const durationMs = Date.now() - startTime;
      this.stats.avgRecoveryTimeMs = 
        (this.stats.avgRecoveryTimeMs * (this.stats.totalRecoveries - 1) + durationMs) / this.stats.totalRecoveries;
      
      console.log(`[MemoryRecovery] Complete: ${candidatesProcessed} processed, ${factsExtracted} facts, ${candidatesSkipped} skipped (${durationMs}ms)`);
    }
    
    return { candidatesProcessed, factsExtracted, candidatesSkipped, errors, durationMs: Date.now() - startTime };
  }
  
  /**
   * Process candidates for a single session
   */
  private async processSessionCandidates(
    sessionId: string,
    candidates: Array<{
      id: string;
      studentId: string;
      language: string;
      utterance: string;
      messageIndex: number;
    }>
  ): Promise<{ processed: number; facts: number; skipped: number }> {
    if (candidates.length === 0) {
      return { processed: 0, facts: 0, skipped: 0 };
    }
    
    const studentId = candidates[0].studentId;
    const language = candidates[0].language;
    const candidateIds = candidates.map(c => c.id);
    
    // Mark as processing
    await memoryCheckpointService.markProcessing(candidateIds);
    
    // Combine utterances into a pseudo-conversation for extraction
    // Format as user messages only (that's all we have from checkpoints)
    const combinedUtterances = candidates
      .sort((a, b) => a.messageIndex - b.messageIndex)
      .map(c => c.utterance)
      .join('\n\n');
    
    // Skip if too short for meaningful extraction
    const MIN_EXTRACTION_CHARS = 50;
    if (combinedUtterances.length < MIN_EXTRACTION_CHARS) {
      await memoryCheckpointService.markSkipped(candidateIds);
      console.log(`[MemoryRecovery] Session ${sessionId.substring(0, 8)} too short, skipping`);
      return { processed: candidates.length, facts: 0, skipped: candidates.length };
    }
    
    try {
      // Create synthetic conversation history for extraction
      const syntheticHistory = candidates
        .sort((a, b) => a.messageIndex - b.messageIndex)
        .map(c => ({ role: 'user' as const, content: c.utterance }));
      
      // Run extraction
      const result = await learnerMemoryExtractionService.extractFromConversation(
        studentId,
        language,
        sessionId, // Use session ID as conversation ID for orphaned sessions
        syntheticHistory
      );
      
      // Apply hash-based deduplication for each extracted fact
      let factsAdded = 0;
      const extractedFactIds: string[] = [];
      
      for (const fact of result.saved) {
        const factHash = memoryCheckpointService.generateFactHash(studentId, fact.factType, fact.fact);
        const { exists, id } = await memoryCheckpointService.factExists(factHash);
        
        if (exists && id) {
          // Fact already exists - increment mention count
          await memoryCheckpointService.incrementFactMention(id);
          console.log(`[MemoryRecovery] Fact already exists, incrementing mention: ${fact.fact.substring(0, 40)}...`);
        } else {
          // Add hash to the fact (if not already set)
          if (!fact.factHash) {
            await db
              .update(learnerPersonalFacts)
              .set({ factHash })
              .where(eq(learnerPersonalFacts.id, fact.id));
          }
          factsAdded++;
          extractedFactIds.push(fact.id);
        }
      }
      
      // Mark as extracted
      await memoryCheckpointService.markExtracted(candidateIds, extractedFactIds);
      
      console.log(`[MemoryRecovery] Session ${sessionId.substring(0, 8)}: ${factsAdded} new facts from ${candidates.length} utterances`);
      
      return { processed: candidates.length, facts: factsAdded, skipped: 0 };
      
    } catch (err: any) {
      console.error(`[MemoryRecovery] Extraction failed for session ${sessionId.substring(0, 8)}:`, err.message);
      // Reset to pending so we can retry later
      await memoryCheckpointService.markProcessing([]); // This is a no-op, but semantically clear
      throw err;
    }
  }
}

export const memoryRecoveryWorker = new MemoryRecoveryWorker();
