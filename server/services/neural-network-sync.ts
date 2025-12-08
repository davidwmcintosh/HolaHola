import { db } from '../db';
import { 
  selfBestPractices, 
  promotionQueue, 
  syncLog,
  type SelfBestPractice,
  type PromotionQueue,
  type InsertPromotionQueue,
  type InsertSyncLog
} from '@shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import crypto from 'crypto';

const CURRENT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

export class NeuralNetworkSyncService {
  
  async submitForPromotion(
    bestPracticeId: string, 
    submittedBy: string
  ): Promise<{ success: boolean; queueItem?: PromotionQueue; error?: string }> {
    try {
      const [bestPractice] = await db
        .select()
        .from(selfBestPractices)
        .where(eq(selfBestPractices.id, bestPracticeId))
        .limit(1);
      
      if (!bestPractice) {
        return { success: false, error: 'Best practice not found' };
      }
      
      if (bestPractice.syncStatus === 'pending_review') {
        return { success: false, error: 'Already pending review' };
      }
      
      const targetEnv = CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production';
      
      const [queueItem] = await db.insert(promotionQueue).values({
        bestPracticeId,
        sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        targetEnvironment: targetEnv as 'development' | 'production',
        status: 'pending',
        submittedBy,
      }).returning();
      
      await db
        .update(selfBestPractices)
        .set({ 
          syncStatus: 'pending_review',
          updatedAt: new Date()
        })
        .where(eq(selfBestPractices.id, bestPracticeId));
      
      return { success: true, queueItem };
    } catch (error: any) {
      console.error('[SYNC] Error submitting for promotion:', error);
      return { success: false, error: error.message };
    }
  }
  
  async reviewPromotion(
    queueItemId: string,
    reviewedBy: string,
    approved: boolean,
    reviewNotes?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [queueItem] = await db
        .select()
        .from(promotionQueue)
        .where(eq(promotionQueue.id, queueItemId))
        .limit(1);
      
      if (!queueItem) {
        return { success: false, error: 'Queue item not found' };
      }
      
      if (queueItem.status !== 'pending') {
        return { success: false, error: 'Already reviewed' };
      }
      
      const newStatus = approved ? 'approved' : 'rejected';
      const syncStatus = approved ? 'approved' : 'rejected';
      
      await db
        .update(promotionQueue)
        .set({
          status: newStatus,
          reviewedBy,
          reviewNotes,
          reviewedAt: new Date()
        })
        .where(eq(promotionQueue.id, queueItemId));
      
      await db
        .update(selfBestPractices)
        .set({
          syncStatus: syncStatus as 'approved' | 'rejected',
          reviewedBy: approved ? reviewedBy : null,
          promotedAt: approved ? new Date() : null,
          updatedAt: new Date()
        })
        .where(eq(selfBestPractices.id, queueItem.bestPracticeId));
      
      await this.logSyncOperation({
        operation: approved ? 'promote' : 'reject',
        tableName: 'self_best_practices',
        recordCount: 1,
        sourceEnvironment: queueItem.sourceEnvironment,
        targetEnvironment: queueItem.targetEnvironment,
        performedBy: reviewedBy,
        status: 'success',
        metadata: { 
          bestPracticeId: queueItem.bestPracticeId,
          approved,
          reviewNotes 
        }
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('[SYNC] Error reviewing promotion:', error);
      return { success: false, error: error.message };
    }
  }
  
  async getPendingPromotions(): Promise<Array<PromotionQueue & { bestPractice: SelfBestPractice }>> {
    const pending = await db
      .select()
      .from(promotionQueue)
      .where(eq(promotionQueue.status, 'pending'))
      .orderBy(promotionQueue.submittedAt);
    
    const result = [];
    for (const item of pending) {
      const [bp] = await db
        .select()
        .from(selfBestPractices)
        .where(eq(selfBestPractices.id, item.bestPracticeId))
        .limit(1);
      if (bp) {
        result.push({ ...item, bestPractice: bp });
      }
    }
    
    return result;
  }
  
  async getPromotionHistory(limit = 50): Promise<PromotionQueue[]> {
    return db
      .select()
      .from(promotionQueue)
      .orderBy(desc(promotionQueue.submittedAt))
      .limit(limit);
  }
  
  async getBestPracticesForExport(): Promise<SelfBestPractice[]> {
    return db
      .select()
      .from(selfBestPractices)
      .where(
        and(
          eq(selfBestPractices.isActive, true),
          eq(selfBestPractices.syncStatus, 'approved')
        )
      );
  }
  
  async importBestPractice(
    practice: Partial<SelfBestPractice>,
    importedBy: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const existingOrigin = practice.originId 
        ? await db.select().from(selfBestPractices).where(eq(selfBestPractices.originId, practice.originId)).limit(1)
        : [];
      
      if (existingOrigin.length > 0) {
        const existing = existingOrigin[0];
        const existingVersion = existing.version || 1;
        const incomingVersion = practice.version || 1;
        
        if (incomingVersion > existingVersion) {
          await db
            .update(selfBestPractices)
            .set({
              insight: practice.insight,
              context: practice.context,
              confidenceScore: practice.confidenceScore,
              version: incomingVersion,
              syncStatus: 'synced',
              updatedAt: new Date()
            })
            .where(eq(selfBestPractices.id, existing.id));
          
          return { success: true, id: existing.id };
        } else {
          return { success: true, id: existing.id };
        }
      }
      
      const [imported] = await db.insert(selfBestPractices).values({
        category: practice.category!,
        insight: practice.insight!,
        context: practice.context,
        source: practice.source || 'synced',
        confidenceScore: practice.confidenceScore || 0.5,
        originId: practice.id,
        originEnvironment: practice.originEnvironment,
        syncStatus: 'synced',
        version: practice.version || 1,
      }).returning();
      
      return { success: true, id: imported.id };
    } catch (error: any) {
      console.error('[SYNC] Error importing best practice:', error);
      return { success: false, error: error.message };
    }
  }
  
  async logSyncOperation(log: InsertSyncLog): Promise<void> {
    try {
      await db.insert(syncLog).values(log);
    } catch (error) {
      console.error('[SYNC] Error logging sync operation:', error);
    }
  }
  
  async getSyncLogs(limit = 100): Promise<typeof syncLog.$inferSelect[]> {
    return db
      .select()
      .from(syncLog)
      .orderBy(desc(syncLog.createdAt))
      .limit(limit);
  }
  
  async getSyncStats(): Promise<{
    pendingPromotions: number;
    approvedToday: number;
    lastSyncTime: Date | null;
    currentEnvironment: string;
  }> {
    const pending = await db
      .select()
      .from(promotionQueue)
      .where(eq(promotionQueue.status, 'pending'));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const approved = await db
      .select()
      .from(promotionQueue)
      .where(eq(promotionQueue.status, 'approved'));
    
    const approvedToday = approved.filter(a => 
      a.reviewedAt && a.reviewedAt >= today
    ).length;
    
    const [lastLog] = await db
      .select()
      .from(syncLog)
      .orderBy(desc(syncLog.createdAt))
      .limit(1);
    
    return {
      pendingPromotions: pending.length,
      approvedToday,
      lastSyncTime: lastLog?.createdAt || null,
      currentEnvironment: CURRENT_ENVIRONMENT
    };
  }

  // ============================================================
  // ANONYMIZATION UTILITIES
  // ============================================================
  
  /**
   * Hash a student ID for privacy-preserving sync
   * Uses HMAC-SHA256 with environment-specific salt
   * SECURITY: Requires SYNC_HASH_SALT env var - fails fast if not set
   */
  hashStudentId(studentId: string): string {
    const salt = process.env.SYNC_HASH_SALT;
    
    if (!salt || salt.length < 32) {
      throw new Error(
        'SYNC_HASH_SALT environment variable is required for student data anonymization. ' +
        'Must be at least 32 characters. Set a cryptographically random value in your environment.'
      );
    }
    
    return crypto
      .createHmac('sha256', salt)
      .update(studentId)
      .digest('hex')
      .substring(0, 16);
  }
  
  /**
   * Verify that the anonymization system is properly configured
   * Call this at startup in production environments
   */
  verifyAnonymizationConfig(): { configured: boolean; error?: string } {
    const salt = process.env.SYNC_HASH_SALT;
    
    if (!salt) {
      return { 
        configured: false, 
        error: 'SYNC_HASH_SALT environment variable is not set' 
      };
    }
    
    if (salt.length < 32) {
      return { 
        configured: false, 
        error: 'SYNC_HASH_SALT must be at least 32 characters for security' 
      };
    }
    
    return { configured: true };
  }
  
  /**
   * Redact sensitive information from text
   * Removes emails, phone numbers, names (via patterns), and specific keywords
   */
  redactSensitiveText(text: string | null | undefined): string {
    if (!text) return '';
    
    let redacted = text;
    
    // Redact email addresses
    redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    
    // Redact phone numbers (various formats)
    redacted = redacted.replace(/(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE]');
    
    // Redact URLs that might contain personal info
    redacted = redacted.replace(/https?:\/\/[^\s]+/g, '[URL]');
    
    // Redact patterns that look like usernames or handles
    redacted = redacted.replace(/@[a-zA-Z0-9_]+/g, '[HANDLE]');
    
    // Redact addresses (simple pattern for street addresses)
    redacted = redacted.replace(/\d+\s+[A-Za-z]+\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/gi, '[ADDRESS]');
    
    // Redact credit card patterns
    redacted = redacted.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CC]');
    
    // Redact SSN patterns
    redacted = redacted.replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '[SSN]');
    
    return redacted;
  }
  
  /**
   * Anonymize a pedagogical insight record for cross-environment sync
   * Uses the actual PedagogicalInsight schema from the database
   */
  anonymizePedagogicalInsight(insight: {
    id: string;
    language: string | null;
    topic: string | null;
    difficulty: string | null;
    patternDescription: string;
    patternKey: string;
    effectiveTools: string[] | null;
    ineffectiveTools: string[] | null;
    sampleSize: number | null;
    successRate: number | null;
    confidenceScore: number | null;
    sourceType: string;
    tutorReflection: string | null;
    isActive: boolean | null;
  }): {
    id: string;
    language: string | null;
    topic: string | null;
    difficulty: string | null;
    patternDescription: string;
    patternKey: string;
    effectiveTools: string[] | null;
    ineffectiveTools: string[] | null;
    sampleSize: number | null;
    successRate: number | null;
    confidenceScore: number | null;
    sourceType: string;
    tutorReflection: string;
    isActive: boolean | null;
  } {
    return {
      id: insight.id,
      language: insight.language,
      topic: insight.topic,
      difficulty: insight.difficulty,
      patternDescription: this.redactSensitiveText(insight.patternDescription),
      patternKey: insight.patternKey,
      effectiveTools: insight.effectiveTools,
      ineffectiveTools: insight.ineffectiveTools,
      sampleSize: insight.sampleSize,
      successRate: insight.successRate,
      confidenceScore: insight.confidenceScore,
      sourceType: insight.sourceType,
      tutorReflection: this.redactSensitiveText(insight.tutorReflection),
      isActive: insight.isActive
    };
  }
  
  /**
   * Batch export anonymized pedagogical insights for one-way prod→dev sync
   * Returns aggregated data suitable for improving Daniela's teaching
   */
  async exportAnonymizedInsights(): Promise<{
    exportedAt: string;
    environment: string;
    insightCount: number;
    insights: Array<ReturnType<NeuralNetworkSyncService['anonymizePedagogicalInsight']>>;
  }> {
    const { pedagogicalInsights } = await import('@shared/schema');
    
    const allInsights = await db
      .select()
      .from(pedagogicalInsights)
      .orderBy(desc(pedagogicalInsights.createdAt))
      .limit(1000);
    
    const anonymized = allInsights.map(insight => 
      this.anonymizePedagogicalInsight(insight)
    );
    
    await this.logSyncOperation({
      operation: 'export_anonymized',
      tableName: 'pedagogical_insights',
      recordCount: anonymized.length,
      sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      targetEnvironment: 'development',
      status: 'success',
      metadata: { exportType: 'anonymized_insights' }
    });
    
    return {
      exportedAt: new Date().toISOString(),
      environment: CURRENT_ENVIRONMENT,
      insightCount: anonymized.length,
      insights: anonymized
    };
  }
  
  /**
   * Generate aggregate statistics from pedagogical insights
   * Useful for understanding teaching patterns
   */
  async getAggregateStudentStats(): Promise<{
    totalInsights: number;
    insightsBySourceType: Record<string, number>;
    insightsByLanguage: Record<string, number>;
    insightsByDifficulty: Record<string, number>;
    avgSuccessRate: number;
    topEffectiveTools: Array<{ tool: string; count: number }>;
  }> {
    const { pedagogicalInsights } = await import('@shared/schema');
    
    const allInsights = await db
      .select()
      .from(pedagogicalInsights);
    
    const insightsBySourceType: Record<string, number> = {};
    const insightsByLanguage: Record<string, number> = {};
    const insightsByDifficulty: Record<string, number> = {};
    const successRates: number[] = [];
    const toolCounts: Record<string, number> = {};
    
    for (const insight of allInsights) {
      // Count by source type
      insightsBySourceType[insight.sourceType] = (insightsBySourceType[insight.sourceType] || 0) + 1;
      
      // Count by language
      if (insight.language) {
        insightsByLanguage[insight.language] = (insightsByLanguage[insight.language] || 0) + 1;
      }
      
      // Count by difficulty
      if (insight.difficulty) {
        insightsByDifficulty[insight.difficulty] = (insightsByDifficulty[insight.difficulty] || 0) + 1;
      }
      
      // Track success rates
      if (insight.successRate != null) {
        successRates.push(insight.successRate);
      }
      
      // Count effective tools
      if (insight.effectiveTools) {
        for (const tool of insight.effectiveTools) {
          toolCounts[tool] = (toolCounts[tool] || 0) + 1;
        }
      }
    }
    
    const avgSuccess = successRates.length > 0
      ? successRates.reduce((a, b) => a + b, 0) / successRates.length
      : 0;
    
    const topTools = Object.entries(toolCounts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalInsights: allInsights.length,
      insightsBySourceType,
      insightsByLanguage,
      insightsByDifficulty,
      avgSuccessRate: avgSuccess,
      topEffectiveTools: topTools
    };
  }
  
  // ============================================================
  // AUTO-SYNC SYSTEM
  // ============================================================
  
  /**
   * Perform automatic sync of best practices
   * Auto-approves and syncs without manual review
   */
  async performAutoSync(performedBy: string = 'system'): Promise<{
    success: boolean;
    syncedCount: number;
    syncLogId?: string;
    error?: string;
  }> {
    try {
      // Get all unsynced best practices that are active
      const unsyncedPractices = await db
        .select()
        .from(selfBestPractices)
        .where(
          and(
            eq(selfBestPractices.isActive, true),
            eq(selfBestPractices.syncStatus, 'local')
          )
        );
      
      if (unsyncedPractices.length === 0) {
        return { success: true, syncedCount: 0 };
      }
      
      // Auto-approve and mark as synced
      const syncedIds: string[] = [];
      for (const practice of unsyncedPractices) {
        await db
          .update(selfBestPractices)
          .set({
            syncStatus: 'synced',
            promotedAt: new Date(),
            reviewedBy: performedBy,
            updatedAt: new Date()
          })
          .where(eq(selfBestPractices.id, practice.id));
        syncedIds.push(practice.id);
      }
      
      // Log the sync operation
      const [logEntry] = await db.insert(syncLog).values({
        operation: 'auto_sync',
        tableName: 'self_best_practices',
        recordCount: syncedIds.length,
        sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        targetEnvironment: CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production',
        performedBy,
        status: 'success',
        metadata: { 
          syncType: 'automatic',
          syncedIds,
          timestamp: new Date().toISOString()
        }
      }).returning();
      
      console.log(`[AUTO-SYNC] Synced ${syncedIds.length} best practices`);
      
      return {
        success: true,
        syncedCount: syncedIds.length,
        syncLogId: logEntry.id
      };
    } catch (error: any) {
      console.error('[AUTO-SYNC] Error:', error);
      
      await this.logSyncOperation({
        operation: 'auto_sync',
        tableName: 'self_best_practices',
        recordCount: 0,
        sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        targetEnvironment: CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production',
        performedBy,
        status: 'error',
        errorMessage: error.message
      });
      
      return { success: false, syncedCount: 0, error: error.message };
    }
  }
  
  /**
   * Retract a synced best practice
   * Marks it as retracted and logs the action
   */
  async retractBestPractice(
    bestPracticeId: string, 
    retractedBy: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const [practice] = await db
        .select()
        .from(selfBestPractices)
        .where(eq(selfBestPractices.id, bestPracticeId))
        .limit(1);
      
      if (!practice) {
        return { success: false, error: 'Best practice not found' };
      }
      
      // Mark as retracted (using 'rejected' status to indicate retraction)
      await db
        .update(selfBestPractices)
        .set({
          syncStatus: 'rejected',
          isActive: false,
          updatedAt: new Date()
        })
        .where(eq(selfBestPractices.id, bestPracticeId));
      
      // Log the retraction
      await this.logSyncOperation({
        operation: 'retract',
        tableName: 'self_best_practices',
        recordCount: 1,
        sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        targetEnvironment: CURRENT_ENVIRONMENT === 'production' ? 'development' : 'production',
        performedBy: retractedBy,
        status: 'success',
        metadata: { 
          bestPracticeId,
          reason,
          previousStatus: practice.syncStatus,
          retractedAt: new Date().toISOString()
        }
      });
      
      return { success: true };
    } catch (error: any) {
      console.error('[RETRACT] Error:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Get sync history with detailed information
   * Includes retraction status and ability to filter
   */
  async getSyncHistory(options: {
    limit?: number;
    includeRetracted?: boolean;
    operation?: string;
  } = {}): Promise<Array<typeof syncLog.$inferSelect & { canRetract: boolean }>> {
    const { limit = 50, operation } = options;
    
    let query = db
      .select()
      .from(syncLog)
      .orderBy(desc(syncLog.createdAt))
      .limit(limit);
    
    const logs = await query;
    
    // Add retract capability info
    return logs.map(log => ({
      ...log,
      canRetract: log.operation === 'auto_sync' || log.operation === 'promote'
    }));
  }
  
  /**
   * Get the next scheduled sync time (3 AM local time)
   */
  getNextSyncTime(): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(3, 0, 0, 0);
    
    // If it's past 3 AM today, schedule for tomorrow
    if (now >= next) {
      next.setDate(next.getDate() + 1);
    }
    
    return next;
  }
  
  /**
   * Get auto-sync configuration and status
   */
  async getAutoSyncStatus(): Promise<{
    enabled: boolean;
    nextSyncTime: string;
    lastAutoSync: Date | null;
    pendingCount: number;
  }> {
    const [lastAutoSyncLog] = await db
      .select()
      .from(syncLog)
      .where(eq(syncLog.operation, 'auto_sync'))
      .orderBy(desc(syncLog.createdAt))
      .limit(1);
    
    const pendingPractices = await db
      .select()
      .from(selfBestPractices)
      .where(
        and(
          eq(selfBestPractices.isActive, true),
          eq(selfBestPractices.syncStatus, 'local')
        )
      );
    
    return {
      enabled: true, // Auto-sync is always enabled
      nextSyncTime: this.getNextSyncTime().toISOString(),
      lastAutoSync: lastAutoSyncLog?.createdAt || null,
      pendingCount: pendingPractices.length
    };
  }
}

export const neuralNetworkSync = new NeuralNetworkSyncService();
