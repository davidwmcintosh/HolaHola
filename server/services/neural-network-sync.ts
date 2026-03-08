import { db, getSharedDb } from '../db';
import { 
  selfBestPractices, 
  promotionQueue, 
  syncLog,
  languageIdioms,
  culturalNuances,
  learnerErrorPatterns,
  dialectVariations,
  linguisticBridges,
  toolKnowledge,
  tutorProcedures,
  teachingPrinciples,
  situationalPatterns,
  teachingSuggestionEffectiveness,
  studentToolPreferences,
  subtletyCues,
  emotionalPatterns,
  creativityTemplates,
  danielaSuggestions,
  reflectionTriggers,
  danielaSuggestionActions,
  agentObservations,
  supportObservations,
  systemAlerts,
  northStarPrinciples,
  northStarUnderstanding,
  northStarExamples,
  wrenInsights,
  type SelfBestPractice,
  type PromotionQueue,
  type InsertPromotionQueue,
  type InsertSyncLog,
  type LanguageIdiom,
  type CulturalNuance,
  type LearnerErrorPattern,
  type DialectVariation,
  type LinguisticBridge,
  type ToolKnowledge,
  type TutorProcedure,
  type TeachingPrinciple,
  type SituationalPattern,
  type SubtletyCue,
  type EmotionalPattern,
  type CreativityTemplate,
  type DanielaSuggestion,
  type ReflectionTrigger,
  type DanielaSuggestionAction,
  type AgentObservation,
  type SupportObservation,
  type SystemAlert,
  type NorthStarPrinciple,
  type NorthStarUnderstanding,
  type NorthStarExample,
} from '@shared/schema';
import { eq, and, isNull, desc, or, sql, gte } from 'drizzle-orm';
import crypto from 'crypto';

const CURRENT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

export class NeuralNetworkSyncService {
  
  async submitForPromotion(
    bestPracticeId: string, 
    submittedBy: string
  ): Promise<{ success: boolean; queueItem?: PromotionQueue; error?: string }> {
    try {
      const [bestPractice] = await getSharedDb()
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
      
      const [queueItem] = await getSharedDb().insert(promotionQueue).values({
        bestPracticeId,
        sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        targetEnvironment: targetEnv as 'development' | 'production',
        status: 'pending',
        submittedBy,
      }).returning();
      
      await getSharedDb()
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
      const [queueItem] = await getSharedDb()
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
      
      await getSharedDb()
        .update(promotionQueue)
        .set({
          status: newStatus,
          reviewedBy,
          reviewNotes,
          reviewedAt: new Date()
        })
        .where(eq(promotionQueue.id, queueItemId));
      
      await getSharedDb()
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
    const pending = await getSharedDb()
      .select()
      .from(promotionQueue)
      .where(eq(promotionQueue.status, 'pending'))
      .orderBy(promotionQueue.submittedAt);
    
    const result = [];
    for (const item of pending) {
      const [bp] = await getSharedDb()
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
    return getSharedDb()
      .select()
      .from(promotionQueue)
      .orderBy(desc(promotionQueue.submittedAt))
      .limit(limit);
  }
  
  async getBestPracticesForExport(): Promise<SelfBestPractice[]> {
    return getSharedDb()
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
        ? await getSharedDb().select().from(selfBestPractices).where(eq(selfBestPractices.originId, practice.originId)).limit(1)
        : [];
      
      if (existingOrigin.length > 0) {
        const existing = existingOrigin[0];
        const existingVersion = existing.version || 1;
        const incomingVersion = practice.version || 1;
        
        if (incomingVersion > existingVersion) {
          await getSharedDb()
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
      
      const [imported] = await getSharedDb().insert(selfBestPractices).values({
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
      await getSharedDb().insert(syncLog).values(log);
    } catch (error) {
      console.error('[SYNC] Error logging sync operation:', error);
    }
  }
  
  async getSyncLogs(limit = 100): Promise<typeof syncLog.$inferSelect[]> {
    return getSharedDb()
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
    const pending = await getSharedDb()
      .select()
      .from(promotionQueue)
      .where(eq(promotionQueue.status, 'pending'));
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const approved = await getSharedDb()
      .select()
      .from(promotionQueue)
      .where(eq(promotionQueue.status, 'approved'));
    
    const approvedToday = approved.filter(a => 
      a.reviewedAt && a.reviewedAt >= today
    ).length;
    
    const [lastLog] = await getSharedDb()
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
    
    const allInsights = await getSharedDb()
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
    
    const allInsights = await getSharedDb()
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
   * Use null for system operations to avoid FK constraint issues
   */
  async performAutoSync(performedBy: string | null = null): Promise<{
    success: boolean;
    syncedCount: number;
    syncLogId?: string;
    error?: string;
  }> {
    try {
      // Get all unsynced best practices that are active
      const unsyncedPractices = await getSharedDb()
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
        await getSharedDb()
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
      
      // Log the sync operation (skip if no performedBy to avoid FK issues)
      if (performedBy) {
        const [logEntry] = await getSharedDb().insert(syncLog).values({
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
      } else {
        console.log(`[AUTO-SYNC] Synced ${syncedIds.length} best practices (system operation)`);
        return {
          success: true,
          syncedCount: syncedIds.length
        };
      }
    } catch (error: any) {
      console.error('[AUTO-SYNC] Error:', error);
      
      // Only log if we have a valid user
      if (performedBy) {
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
      }
      
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
      const [practice] = await getSharedDb()
        .select()
        .from(selfBestPractices)
        .where(eq(selfBestPractices.id, bestPracticeId))
        .limit(1);
      
      if (!practice) {
        return { success: false, error: 'Best practice not found' };
      }
      
      // Mark as retracted (using 'rejected' status to indicate retraction)
      await getSharedDb()
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
    
    let query = getSharedDb()
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
    const [lastAutoSyncLog] = await getSharedDb()
      .select()
      .from(syncLog)
      .where(eq(syncLog.operation, 'auto_sync'))
      .orderBy(desc(syncLog.createdAt))
      .limit(1);
    
    const pendingPractices = await getSharedDb()
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
  
  // ============================================================
  // NEURAL NETWORK EXPANSION SYNC (5 Tables)
  // Two-way sync for language-specific pedagogical knowledge
  // ============================================================
  
  /**
   * Export all approved Neural Network Expansion data for sync
   * Returns data from all 5 tables: idioms, nuances, errors, dialects, bridges
   */
  async exportNeuralNetworkExpansion(): Promise<{
    exportedAt: string;
    environment: string;
    idioms: LanguageIdiom[];
    nuances: CulturalNuance[];
    errorPatterns: LearnerErrorPattern[];
    dialects: DialectVariation[];
    bridges: LinguisticBridge[];
  }> {
    // Get all approved items from each table
    const [idioms, nuances, errorPatterns, dialects, bridges] = await Promise.all([
      getSharedDb().select().from(languageIdioms).where(
        and(eq(languageIdioms.isActive, true), eq(languageIdioms.syncStatus, 'approved'))
      ),
      getSharedDb().select().from(culturalNuances).where(
        and(eq(culturalNuances.isActive, true), eq(culturalNuances.syncStatus, 'approved'))
      ),
      getSharedDb().select().from(learnerErrorPatterns).where(
        and(eq(learnerErrorPatterns.isActive, true), eq(learnerErrorPatterns.syncStatus, 'approved'))
      ),
      getSharedDb().select().from(dialectVariations).where(
        and(eq(dialectVariations.isActive, true), eq(dialectVariations.syncStatus, 'approved'))
      ),
      getSharedDb().select().from(linguisticBridges).where(
        and(eq(linguisticBridges.isActive, true), eq(linguisticBridges.syncStatus, 'approved'))
      ),
    ]);
    
    return {
      exportedAt: new Date().toISOString(),
      environment: CURRENT_ENVIRONMENT,
      idioms,
      nuances,
      errorPatterns,
      dialects,
      bridges
    };
  }
  
  /**
   * Import a language idiom with deduplication
   * Matches by (language, idiom) to avoid duplicates
   */
  async importLanguageIdiom(idiom: Partial<LanguageIdiom>, importedBy: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      // Validate required fields
      if (!idiom.language || !idiom.idiom || !idiom.meaning) {
        console.warn('[SYNC] Skipping idiom import - missing required fields:', { 
          hasLanguage: !!idiom.language, hasIdiom: !!idiom.idiom, hasMeaning: !!idiom.meaning 
        });
        return { success: false, error: 'Missing required fields (language, idiom, meaning)' };
      }
      
      // Check for existing by originId or unique key (language + idiom)
      // Build where clause conditionally to avoid passing undefined to or()
      const uniqueKeyMatch = and(eq(languageIdioms.language, idiom.language), eq(languageIdioms.idiom, idiom.idiom));
      const whereClause = idiom.originId 
        ? or(eq(languageIdioms.originId, idiom.originId), uniqueKeyMatch)
        : uniqueKeyMatch;
      
      const existing = await getSharedDb().select().from(languageIdioms).where(whereClause).limit(1);
      
      if (existing.length > 0) {
        // Already exists - skip (could add version comparison for updates)
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      // Insert new idiom
      const [imported] = await getSharedDb().insert(languageIdioms).values({
        language: idiom.language!,
        idiom: idiom.idiom!,
        literalTranslation: idiom.literalTranslation,
        meaning: idiom.meaning!,
        culturalContext: idiom.culturalContext,
        usageExamples: idiom.usageExamples,
        registerLevel: idiom.registerLevel,
        region: idiom.region,
        commonMistakes: idiom.commonMistakes,
        relatedIdiomIds: idiom.relatedIdiomIds,
        syncStatus: 'synced',
        originId: idiom.id,
        originEnvironment: idiom.originEnvironment || CURRENT_ENVIRONMENT,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing idiom:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import a cultural nuance with deduplication
   * Matches by (language, category, situation) to avoid duplicates
   */
  async importCulturalNuance(nuance: Partial<CulturalNuance>, importedBy: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      // Validate required fields
      if (!nuance.language || !nuance.category || !nuance.situation || !nuance.nuance) {
        console.warn('[SYNC] Skipping nuance import - missing required fields:', {
          hasLanguage: !!nuance.language, hasCategory: !!nuance.category,
          hasSituation: !!nuance.situation, hasNuance: !!nuance.nuance
        });
        return { success: false, error: 'Missing required fields (language, category, situation, nuance)' };
      }
      
      const uniqueKeyMatch = and(
        eq(culturalNuances.language, nuance.language),
        eq(culturalNuances.category, nuance.category),
        eq(culturalNuances.situation, nuance.situation)
      );
      const whereClause = nuance.originId 
        ? or(eq(culturalNuances.originId, nuance.originId), uniqueKeyMatch)
        : uniqueKeyMatch;
      
      const existing = await getSharedDb().select().from(culturalNuances).where(whereClause).limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(culturalNuances).values({
        language: nuance.language!,
        category: nuance.category!,
        situation: nuance.situation!,
        nuance: nuance.nuance!,
        explanation: nuance.explanation,
        commonMistakes: nuance.commonMistakes,
        region: nuance.region,
        formalityLevel: nuance.formalityLevel,
        syncStatus: 'synced',
        originId: nuance.id,
        originEnvironment: nuance.originEnvironment || CURRENT_ENVIRONMENT,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing cultural nuance:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import a learner error pattern with deduplication
   * Matches by (targetLanguage, sourceLanguage, specificError) to avoid duplicates
   */
  async importLearnerErrorPattern(pattern: Partial<LearnerErrorPattern>, importedBy: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      // Validate required fields
      if (!pattern.targetLanguage || !pattern.sourceLanguage || !pattern.specificError || !pattern.errorCategory) {
        console.warn('[SYNC] Skipping error pattern import - missing required fields:', {
          hasTarget: !!pattern.targetLanguage, hasSource: !!pattern.sourceLanguage,
          hasError: !!pattern.specificError, hasCategory: !!pattern.errorCategory
        });
        return { success: false, error: 'Missing required fields (targetLanguage, sourceLanguage, specificError, errorCategory)' };
      }
      
      const uniqueKeyMatch = and(
        eq(learnerErrorPatterns.targetLanguage, pattern.targetLanguage),
        eq(learnerErrorPatterns.sourceLanguage, pattern.sourceLanguage),
        eq(learnerErrorPatterns.specificError, pattern.specificError)
      );
      const whereClause = pattern.originId 
        ? or(eq(learnerErrorPatterns.originId, pattern.originId), uniqueKeyMatch)
        : uniqueKeyMatch;
      
      const existing = await getSharedDb().select().from(learnerErrorPatterns).where(whereClause).limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(learnerErrorPatterns).values({
        targetLanguage: pattern.targetLanguage!,
        sourceLanguage: pattern.sourceLanguage!,
        errorCategory: pattern.errorCategory!,
        specificError: pattern.specificError!,
        whyItHappens: pattern.whyItHappens,
        teachingStrategies: pattern.teachingStrategies,
        exampleMistakes: pattern.exampleMistakes,
        correctForms: pattern.correctForms,
        actflLevel: pattern.actflLevel,
        priority: pattern.priority,
        syncStatus: 'synced',
        originId: pattern.id,
        originEnvironment: pattern.originEnvironment || CURRENT_ENVIRONMENT,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing error pattern:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import a dialect variation with deduplication
   * Matches by (language, region, standardForm) to avoid duplicates
   */
  async importDialectVariation(dialect: Partial<DialectVariation>, importedBy: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      // Validate required fields
      if (!dialect.language || !dialect.region || !dialect.standardForm || !dialect.regionalForm || !dialect.category) {
        console.warn('[SYNC] Skipping dialect import - missing required fields:', {
          hasLanguage: !!dialect.language, hasRegion: !!dialect.region,
          hasStandard: !!dialect.standardForm, hasRegional: !!dialect.regionalForm, hasCategory: !!dialect.category
        });
        return { success: false, error: 'Missing required fields (language, region, category, standardForm, regionalForm)' };
      }
      
      const uniqueKeyMatch = and(
        eq(dialectVariations.language, dialect.language),
        eq(dialectVariations.region, dialect.region),
        eq(dialectVariations.standardForm, dialect.standardForm)
      );
      const whereClause = dialect.originId 
        ? or(eq(dialectVariations.originId, dialect.originId), uniqueKeyMatch)
        : uniqueKeyMatch;
      
      const existing = await getSharedDb().select().from(dialectVariations).where(whereClause).limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(dialectVariations).values({
        language: dialect.language!,
        region: dialect.region!,
        category: dialect.category!,
        standardForm: dialect.standardForm!,
        regionalForm: dialect.regionalForm!,
        explanation: dialect.explanation,
        audioExampleUrl: dialect.audioExampleUrl,
        usageNotes: dialect.usageNotes,
        syncStatus: 'synced',
        originId: dialect.id,
        originEnvironment: dialect.originEnvironment || CURRENT_ENVIRONMENT,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing dialect:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import a linguistic bridge with deduplication
   * Matches by (sourceLanguage, targetLanguage, sourceWord, targetWord) to avoid duplicates
   */
  async importLinguisticBridge(bridge: Partial<LinguisticBridge>, importedBy: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      // Validate required fields
      if (!bridge.sourceLanguage || !bridge.targetLanguage || !bridge.sourceWord || 
          !bridge.targetWord || !bridge.bridgeType || !bridge.relationship) {
        console.warn('[SYNC] Skipping bridge import - missing required fields:', {
          hasSource: !!bridge.sourceLanguage, hasTarget: !!bridge.targetLanguage,
          hasSourceWord: !!bridge.sourceWord, hasTargetWord: !!bridge.targetWord,
          hasType: !!bridge.bridgeType, hasRelationship: !!bridge.relationship
        });
        return { success: false, error: 'Missing required fields (sourceLanguage, targetLanguage, sourceWord, targetWord, bridgeType, relationship)' };
      }
      
      const uniqueKeyMatch = and(
        eq(linguisticBridges.sourceLanguage, bridge.sourceLanguage),
        eq(linguisticBridges.targetLanguage, bridge.targetLanguage),
        eq(linguisticBridges.sourceWord, bridge.sourceWord),
        eq(linguisticBridges.targetWord, bridge.targetWord)
      );
      const whereClause = bridge.originId 
        ? or(eq(linguisticBridges.originId, bridge.originId), uniqueKeyMatch)
        : uniqueKeyMatch;
      
      const existing = await getSharedDb().select().from(linguisticBridges).where(whereClause).limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(linguisticBridges).values({
        sourceLanguage: bridge.sourceLanguage!,
        targetLanguage: bridge.targetLanguage!,
        bridgeType: bridge.bridgeType!,
        sourceWord: bridge.sourceWord!,
        targetWord: bridge.targetWord!,
        relationship: bridge.relationship!,
        explanation: bridge.explanation,
        teachingNote: bridge.teachingNote,
        syncStatus: 'synced',
        originId: bridge.id,
        originEnvironment: bridge.originEnvironment || CURRENT_ENVIRONMENT,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing bridge:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Perform full sync of Neural Network Expansion data
   * Imports data from another environment, deduplicating as needed
   */
  async syncNeuralNetworkExpansion(
    data: {
      idioms: Partial<LanguageIdiom>[];
      nuances: Partial<CulturalNuance>[];
      errorPatterns: Partial<LearnerErrorPattern>[];
      dialects: Partial<DialectVariation>[];
      bridges: Partial<LinguisticBridge>[];
    },
    importedBy: string
  ): Promise<{
    success: boolean;
    counts: {
      idioms: { imported: number; skipped: number };
      nuances: { imported: number; skipped: number };
      errorPatterns: { imported: number; skipped: number };
      dialects: { imported: number; skipped: number };
      bridges: { imported: number; skipped: number };
    };
  }> {
    const counts = {
      idioms: { imported: 0, skipped: 0 },
      nuances: { imported: 0, skipped: 0 },
      errorPatterns: { imported: 0, skipped: 0 },
      dialects: { imported: 0, skipped: 0 },
      bridges: { imported: 0, skipped: 0 },
    };
    
    // Import idioms
    for (const idiom of data.idioms) {
      const result = await this.importLanguageIdiom(idiom, importedBy);
      if (result.action === 'imported') counts.idioms.imported++;
      else counts.idioms.skipped++;
    }
    
    // Import nuances
    for (const nuance of data.nuances) {
      const result = await this.importCulturalNuance(nuance, importedBy);
      if (result.action === 'imported') counts.nuances.imported++;
      else counts.nuances.skipped++;
    }
    
    // Import error patterns
    for (const pattern of data.errorPatterns) {
      const result = await this.importLearnerErrorPattern(pattern, importedBy);
      if (result.action === 'imported') counts.errorPatterns.imported++;
      else counts.errorPatterns.skipped++;
    }
    
    // Import dialects
    for (const dialect of data.dialects) {
      const result = await this.importDialectVariation(dialect, importedBy);
      if (result.action === 'imported') counts.dialects.imported++;
      else counts.dialects.skipped++;
    }
    
    // Import bridges
    for (const bridge of data.bridges) {
      const result = await this.importLinguisticBridge(bridge, importedBy);
      if (result.action === 'imported') counts.bridges.imported++;
      else counts.bridges.skipped++;
    }
    
    // Log the sync operation
    const totalImported = counts.idioms.imported + counts.nuances.imported + 
      counts.errorPatterns.imported + counts.dialects.imported + counts.bridges.imported;
    
    await this.logSyncOperation({
      operation: 'neural_network_expansion_sync',
      tableName: 'neural_network_expansion',
      recordCount: totalImported,
      sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      performedBy: importedBy,
      status: 'success',
      metadata: { counts }
    });
    
    console.log(`[SYNC] Neural Network Expansion sync complete:`, counts);
    
    return { success: true, counts };
  }
  
  /**
   * Get pending Neural Network Expansion items (local status, not yet approved)
   */
  async getPendingNeuralNetworkExpansion(): Promise<{
    idioms: LanguageIdiom[];
    nuances: CulturalNuance[];
    errorPatterns: LearnerErrorPattern[];
    dialects: DialectVariation[];
    bridges: LinguisticBridge[];
    totalCount: number;
  }> {
    const [idioms, nuances, errorPatterns, dialects, bridges] = await Promise.all([
      getSharedDb().select().from(languageIdioms).where(
        and(eq(languageIdioms.isActive, true), eq(languageIdioms.syncStatus, 'local'))
      ),
      getSharedDb().select().from(culturalNuances).where(
        and(eq(culturalNuances.isActive, true), eq(culturalNuances.syncStatus, 'local'))
      ),
      getSharedDb().select().from(learnerErrorPatterns).where(
        and(eq(learnerErrorPatterns.isActive, true), eq(learnerErrorPatterns.syncStatus, 'local'))
      ),
      getSharedDb().select().from(dialectVariations).where(
        and(eq(dialectVariations.isActive, true), eq(dialectVariations.syncStatus, 'local'))
      ),
      getSharedDb().select().from(linguisticBridges).where(
        and(eq(linguisticBridges.isActive, true), eq(linguisticBridges.syncStatus, 'local'))
      ),
    ]);
    
    return {
      idioms,
      nuances,
      errorPatterns,
      dialects,
      bridges,
      totalCount: idioms.length + nuances.length + errorPatterns.length + dialects.length + bridges.length
    };
  }
  
  /**
   * Approve a Neural Network Expansion item for sync
   * @param tableName - Which table: idioms, nuances, errorPatterns, dialects, bridges
   * @param itemId - ID of the item to approve
   */
  async approveNeuralNetworkExpansionItem(
    tableName: 'idioms' | 'nuances' | 'errorPatterns' | 'dialects' | 'bridges',
    itemId: string,
    approvedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tableMap = {
        idioms: languageIdioms,
        nuances: culturalNuances,
        errorPatterns: learnerErrorPatterns,
        dialects: dialectVariations,
        bridges: linguisticBridges,
      };
      
      const table = tableMap[tableName];
      
      await getSharedDb().update(table).set({
        syncStatus: 'approved',
      }).where(eq(table.id, itemId));
      
      console.log(`[SYNC] Approved ${tableName} item ${itemId} for sync by ${approvedBy}`);
      
      return { success: true };
    } catch (error: any) {
      console.error('[SYNC] Error approving item:', error);
      return { success: false, error: error.message };
    }
  }
  
  // ============================================================
  // PROCEDURAL MEMORY SYNC (4 Tables)
  // Two-way sync for Daniela's procedural knowledge
  // Tables: toolKnowledge, tutorProcedures, teachingPrinciples, situationalPatterns
  // ============================================================
  
  /**
   * Export all approved Procedural Memory data for sync
   * Returns data from all 4 tables
   */
  async exportProceduralMemory(): Promise<{
    exportedAt: string;
    environment: string;
    tools: ToolKnowledge[];
    procedures: TutorProcedure[];
    principles: TeachingPrinciple[];
    patterns: SituationalPattern[];
  }> {
    const [tools, procedures, principles, patterns] = await Promise.all([
      getSharedDb().select().from(toolKnowledge).where(
        and(eq(toolKnowledge.isActive, true), eq(toolKnowledge.syncStatus, 'approved'))
      ),
      getSharedDb().select().from(tutorProcedures).where(
        and(eq(tutorProcedures.isActive, true), eq(tutorProcedures.syncStatus, 'approved'))
      ),
      getSharedDb().select().from(teachingPrinciples).where(
        and(eq(teachingPrinciples.isActive, true), eq(teachingPrinciples.syncStatus, 'approved'))
      ),
      getSharedDb().select().from(situationalPatterns).where(
        and(eq(situationalPatterns.isActive, true), eq(situationalPatterns.syncStatus, 'approved'))
      ),
    ]);
    
    return {
      exportedAt: new Date().toISOString(),
      environment: CURRENT_ENVIRONMENT,
      tools,
      procedures,
      principles,
      patterns
    };
  }
  
  /**
   * Import tool knowledge with deduplication
   * Matches by toolName to avoid duplicates
   */
  async importToolKnowledge(tool: Partial<ToolKnowledge>, importedBy: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      if (!tool.toolName || !tool.toolType || !tool.purpose || !tool.syntax) {
        return { success: false, error: 'Missing required fields (toolName, toolType, purpose, syntax)' };
      }
      
      const whereClause = tool.originId 
        ? or(eq(toolKnowledge.originId, tool.originId), eq(toolKnowledge.toolName, tool.toolName))
        : eq(toolKnowledge.toolName, tool.toolName);
      
      const existing = await getSharedDb().select().from(toolKnowledge).where(whereClause).limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(toolKnowledge).values({
        toolName: tool.toolName!,
        toolType: tool.toolType!,
        purpose: tool.purpose!,
        syntax: tool.syntax!,
        examples: tool.examples,
        bestUsedFor: tool.bestUsedFor,
        avoidWhen: tool.avoidWhen,
        combinesWith: tool.combinesWith,
        sequencePatterns: tool.sequencePatterns,
        syncStatus: 'synced',
        originId: tool.id,
        originEnvironment: tool.originEnvironment || CURRENT_ENVIRONMENT,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing tool knowledge:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import tutor procedure with deduplication
   * Matches by (category, trigger, title) to avoid duplicates
   */
  async importTutorProcedure(procedure: Partial<TutorProcedure>, importedBy: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      if (!procedure.category || !procedure.trigger || !procedure.title || !procedure.procedure) {
        return { success: false, error: 'Missing required fields (category, trigger, title, procedure)' };
      }
      
      const uniqueKeyMatch = and(
        eq(tutorProcedures.category, procedure.category),
        eq(tutorProcedures.trigger, procedure.trigger),
        eq(tutorProcedures.title, procedure.title)
      );
      const whereClause = procedure.originId 
        ? or(eq(tutorProcedures.originId, procedure.originId), uniqueKeyMatch)
        : uniqueKeyMatch;
      
      const existing = await getSharedDb().select().from(tutorProcedures).where(whereClause).limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(tutorProcedures).values({
        category: procedure.category!,
        trigger: procedure.trigger!,
        title: procedure.title!,
        procedure: procedure.procedure!,
        examples: procedure.examples,
        applicablePhases: procedure.applicablePhases,
        actflLevelRange: procedure.actflLevelRange,
        studentStates: procedure.studentStates,
        compassConditions: procedure.compassConditions,
        priority: procedure.priority,
        syncStatus: 'synced',
        originId: procedure.id,
        originEnvironment: procedure.originEnvironment || CURRENT_ENVIRONMENT,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing tutor procedure:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import teaching principle with deduplication
   * Matches by (category, principle) to avoid duplicates
   */
  async importTeachingPrinciple(principle: Partial<TeachingPrinciple>, importedBy: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      if (!principle.category || !principle.principle) {
        return { success: false, error: 'Missing required fields (category, principle)' };
      }
      
      const uniqueKeyMatch = and(
        eq(teachingPrinciples.category, principle.category),
        eq(teachingPrinciples.principle, principle.principle)
      );
      const whereClause = principle.originId 
        ? or(eq(teachingPrinciples.originId, principle.originId), uniqueKeyMatch)
        : uniqueKeyMatch;
      
      const existing = await getSharedDb().select().from(teachingPrinciples).where(whereClause).limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(teachingPrinciples).values({
        category: principle.category!,
        principle: principle.principle!,
        application: principle.application,
        examples: principle.examples,
        contexts: principle.contexts,
        priority: principle.priority,
        syncStatus: 'synced',
        originId: principle.id,
        originEnvironment: principle.originEnvironment || CURRENT_ENVIRONMENT,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing teaching principle:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import situational pattern with deduplication
   * Matches by patternName to avoid duplicates
   */
  async importSituationalPattern(pattern: Partial<SituationalPattern>, importedBy: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      if (!pattern.patternName) {
        return { success: false, error: 'Missing required field (patternName)' };
      }
      
      const whereClause = pattern.originId 
        ? or(eq(situationalPatterns.originId, pattern.originId), eq(situationalPatterns.patternName, pattern.patternName))
        : eq(situationalPatterns.patternName, pattern.patternName);
      
      const existing = await getSharedDb().select().from(situationalPatterns).where(whereClause).limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(situationalPatterns).values({
        patternName: pattern.patternName!,
        description: pattern.description,
        compassConditions: pattern.compassConditions,
        contextConditions: pattern.contextConditions,
        proceduresToActivate: pattern.proceduresToActivate,
        toolsToSuggest: pattern.toolsToSuggest,
        knowledgeToRetrieve: pattern.knowledgeToRetrieve,
        guidance: pattern.guidance,
        priority: pattern.priority,
        syncStatus: 'synced',
        originId: pattern.id,
        originEnvironment: pattern.originEnvironment || CURRENT_ENVIRONMENT,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing situational pattern:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Perform full sync of Procedural Memory data
   * Imports data from another environment, deduplicating as needed
   */
  async syncProceduralMemory(
    data: {
      tools: Partial<ToolKnowledge>[];
      procedures: Partial<TutorProcedure>[];
      principles: Partial<TeachingPrinciple>[];
      patterns: Partial<SituationalPattern>[];
    },
    importedBy: string
  ): Promise<{
    success: boolean;
    counts: {
      tools: { imported: number; skipped: number };
      procedures: { imported: number; skipped: number };
      principles: { imported: number; skipped: number };
      patterns: { imported: number; skipped: number };
    };
  }> {
    const counts = {
      tools: { imported: 0, skipped: 0 },
      procedures: { imported: 0, skipped: 0 },
      principles: { imported: 0, skipped: 0 },
      patterns: { imported: 0, skipped: 0 },
    };
    
    for (const tool of data.tools) {
      const result = await this.importToolKnowledge(tool, importedBy);
      if (result.action === 'imported') counts.tools.imported++;
      else counts.tools.skipped++;
    }
    
    for (const procedure of data.procedures) {
      const result = await this.importTutorProcedure(procedure, importedBy);
      if (result.action === 'imported') counts.procedures.imported++;
      else counts.procedures.skipped++;
    }
    
    for (const principle of data.principles) {
      const result = await this.importTeachingPrinciple(principle, importedBy);
      if (result.action === 'imported') counts.principles.imported++;
      else counts.principles.skipped++;
    }
    
    for (const pattern of data.patterns) {
      const result = await this.importSituationalPattern(pattern, importedBy);
      if (result.action === 'imported') counts.patterns.imported++;
      else counts.patterns.skipped++;
    }
    
    const totalImported = counts.tools.imported + counts.procedures.imported + 
      counts.principles.imported + counts.patterns.imported;
    
    await this.logSyncOperation({
      operation: 'procedural_memory_sync',
      tableName: 'procedural_memory',
      recordCount: totalImported,
      sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      performedBy: importedBy,
      status: 'success',
      metadata: { counts }
    });
    
    console.log(`[SYNC] Procedural Memory sync complete:`, counts);
    
    return { success: true, counts };
  }
  
  /**
   * Get pending Procedural Memory items (local status, not yet approved)
   */
  async getPendingProceduralMemory(): Promise<{
    tools: ToolKnowledge[];
    procedures: TutorProcedure[];
    principles: TeachingPrinciple[];
    patterns: SituationalPattern[];
    totalCount: number;
  }> {
    const [tools, procedures, principles, patterns] = await Promise.all([
      getSharedDb().select().from(toolKnowledge).where(
        and(eq(toolKnowledge.isActive, true), eq(toolKnowledge.syncStatus, 'local'))
      ),
      getSharedDb().select().from(tutorProcedures).where(
        and(eq(tutorProcedures.isActive, true), eq(tutorProcedures.syncStatus, 'local'))
      ),
      getSharedDb().select().from(teachingPrinciples).where(
        and(eq(teachingPrinciples.isActive, true), eq(teachingPrinciples.syncStatus, 'local'))
      ),
      getSharedDb().select().from(situationalPatterns).where(
        and(eq(situationalPatterns.isActive, true), eq(situationalPatterns.syncStatus, 'local'))
      ),
    ]);
    
    return {
      tools,
      procedures,
      principles,
      patterns,
      totalCount: tools.length + procedures.length + principles.length + patterns.length
    };
  }
  
  /**
   * Approve a Procedural Memory item for sync
   */
  async approveProceduralMemoryItem(
    tableName: 'tools' | 'procedures' | 'principles' | 'patterns',
    itemId: string,
    approvedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tableMap = {
        tools: toolKnowledge,
        procedures: tutorProcedures,
        principles: teachingPrinciples,
        patterns: situationalPatterns,
      };
      
      const table = tableMap[tableName];
      
      await getSharedDb().update(table).set({
        syncStatus: 'approved',
      }).where(eq(table.id, itemId));
      
      console.log(`[SYNC] Approved procedural memory ${tableName} item ${itemId} for sync by ${approvedBy}`);
      
      return { success: true };
    } catch (error: any) {
      console.error('[SYNC] Error approving procedural memory item:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Auto-approve all Procedural Memory items (for initial seeding)
   * This marks all 'local' items as 'approved' for sync
   */
  async autoApproveProceduralMemory(approvedBy: string = 'system'): Promise<{
    success: boolean;
    counts: { tools: number; procedures: number; principles: number; patterns: number };
  }> {
    try {
      const [toolsResult, proceduresResult, principlesResult, patternsResult] = await Promise.all([
        getSharedDb().update(toolKnowledge)
          .set({ syncStatus: 'approved' })
          .where(and(eq(toolKnowledge.isActive, true), eq(toolKnowledge.syncStatus, 'local')))
          .returning(),
        getSharedDb().update(tutorProcedures)
          .set({ syncStatus: 'approved' })
          .where(and(eq(tutorProcedures.isActive, true), eq(tutorProcedures.syncStatus, 'local')))
          .returning(),
        getSharedDb().update(teachingPrinciples)
          .set({ syncStatus: 'approved' })
          .where(and(eq(teachingPrinciples.isActive, true), eq(teachingPrinciples.syncStatus, 'local')))
          .returning(),
        getSharedDb().update(situationalPatterns)
          .set({ syncStatus: 'approved' })
          .where(and(eq(situationalPatterns.isActive, true), eq(situationalPatterns.syncStatus, 'local')))
          .returning(),
      ]);
      
      const counts = {
        tools: toolsResult.length,
        procedures: proceduresResult.length,
        principles: principlesResult.length,
        patterns: patternsResult.length,
      };
      
      const total = counts.tools + counts.procedures + counts.principles + counts.patterns;
      
      if (total > 0) {
        await this.logSyncOperation({
          operation: 'procedural_memory_auto_approve',
          tableName: 'procedural_memory',
          recordCount: total,
          sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
          targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
          performedBy: approvedBy,
          status: 'success',
          metadata: { counts }
        });
        
        console.log(`[SYNC] Auto-approved ${total} procedural memory items:`, counts);
      }
      
      return { success: true, counts };
    } catch (error: any) {
      console.error('[SYNC] Error auto-approving procedural memory:', error);
      return { success: false, counts: { tools: 0, procedures: 0, principles: 0, patterns: 0 } };
    }
  }
  
  /**
   * Get complete sync status including Procedural Memory
   */
  async getCompleteSyncStatus(): Promise<{
    neuralNetworkExpansion: {
      pending: number;
      approved: number;
    };
    proceduralMemory: {
      pending: number;
      approved: number;
      total: number;
    };
    lastSync: Date | null;
    currentEnvironment: string;
  }> {
    // Neural Network Expansion counts
    const [
      pendingIdioms, pendingNuances, pendingErrors, pendingDialects, pendingBridges,
      approvedIdioms, approvedNuances, approvedErrors, approvedDialects, approvedBridges,
      pendingTools, pendingProcedures, pendingPrinciples, pendingPatterns,
      approvedTools, approvedProcedures, approvedPrinciples, approvedPatterns,
      totalTools, totalProcedures, totalPrinciples, totalPatterns
    ] = await Promise.all([
      getSharedDb().select().from(languageIdioms).where(eq(languageIdioms.syncStatus, 'local')),
      getSharedDb().select().from(culturalNuances).where(eq(culturalNuances.syncStatus, 'local')),
      getSharedDb().select().from(learnerErrorPatterns).where(eq(learnerErrorPatterns.syncStatus, 'local')),
      getSharedDb().select().from(dialectVariations).where(eq(dialectVariations.syncStatus, 'local')),
      getSharedDb().select().from(linguisticBridges).where(eq(linguisticBridges.syncStatus, 'local')),
      getSharedDb().select().from(languageIdioms).where(eq(languageIdioms.syncStatus, 'approved')),
      getSharedDb().select().from(culturalNuances).where(eq(culturalNuances.syncStatus, 'approved')),
      getSharedDb().select().from(learnerErrorPatterns).where(eq(learnerErrorPatterns.syncStatus, 'approved')),
      getSharedDb().select().from(dialectVariations).where(eq(dialectVariations.syncStatus, 'approved')),
      getSharedDb().select().from(linguisticBridges).where(eq(linguisticBridges.syncStatus, 'approved')),
      getSharedDb().select().from(toolKnowledge).where(eq(toolKnowledge.syncStatus, 'local')),
      getSharedDb().select().from(tutorProcedures).where(eq(tutorProcedures.syncStatus, 'local')),
      getSharedDb().select().from(teachingPrinciples).where(eq(teachingPrinciples.syncStatus, 'local')),
      getSharedDb().select().from(situationalPatterns).where(eq(situationalPatterns.syncStatus, 'local')),
      getSharedDb().select().from(toolKnowledge).where(eq(toolKnowledge.syncStatus, 'approved')),
      getSharedDb().select().from(tutorProcedures).where(eq(tutorProcedures.syncStatus, 'approved')),
      getSharedDb().select().from(teachingPrinciples).where(eq(teachingPrinciples.syncStatus, 'approved')),
      getSharedDb().select().from(situationalPatterns).where(eq(situationalPatterns.syncStatus, 'approved')),
      getSharedDb().select().from(toolKnowledge),
      getSharedDb().select().from(tutorProcedures),
      getSharedDb().select().from(teachingPrinciples),
      getSharedDb().select().from(situationalPatterns),
    ]);
    
    const [lastLog] = await getSharedDb()
      .select()
      .from(syncLog)
      .orderBy(desc(syncLog.createdAt))
      .limit(1);
    
    return {
      neuralNetworkExpansion: {
        pending: pendingIdioms.length + pendingNuances.length + pendingErrors.length + 
                 pendingDialects.length + pendingBridges.length,
        approved: approvedIdioms.length + approvedNuances.length + approvedErrors.length + 
                  approvedDialects.length + approvedBridges.length,
      },
      proceduralMemory: {
        pending: pendingTools.length + pendingProcedures.length + pendingPrinciples.length + pendingPatterns.length,
        approved: approvedTools.length + approvedProcedures.length + approvedPrinciples.length + approvedPatterns.length,
        total: totalTools.length + totalProcedures.length + totalPrinciples.length + totalPatterns.length,
      },
      lastSync: lastLog?.createdAt || null,
      currentEnvironment: CURRENT_ENVIRONMENT
    };
  }
  
  // ============================================================
  // ADVANCED INTELLIGENCE LAYER SYNC
  // ============================================================
  
  /**
   * Export Advanced Intelligence data (subtlety cues, emotional patterns, creativity templates)
   * These are Daniela's self-identified growth areas from Honesty Mode
   */
  async exportAdvancedIntelligence(): Promise<{
    subtletyCues: SubtletyCue[];
    emotionalPatterns: EmotionalPattern[];
    creativityTemplates: CreativityTemplate[];
  }> {
    // Query each table separately with error handling - tables may not exist in all environments
    let cues: SubtletyCue[] = [];
    let emotions: EmotionalPattern[] = [];
    let creativity: CreativityTemplate[] = [];
    
    try {
      cues = await getSharedDb().select().from(subtletyCues).where(eq(subtletyCues.syncStatus, 'approved'));
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] subtlety_cues table query failed (may not exist):', err.message);
    }
    
    try {
      emotions = await getSharedDb().select().from(emotionalPatterns).where(eq(emotionalPatterns.syncStatus, 'approved'));
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] emotional_patterns table query failed (may not exist):', err.message);
    }
    
    try {
      creativity = await getSharedDb().select().from(creativityTemplates).where(eq(creativityTemplates.syncStatus, 'approved'));
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] creativity_templates table query failed (may not exist):', err.message);
    }
    
    return {
      subtletyCues: cues,
      emotionalPatterns: emotions,
      creativityTemplates: creativity,
    };
  }
  
  /**
   * Import Advanced Intelligence data from another environment
   */
  async importAdvancedIntelligence(
    data: {
      subtletyCues?: Partial<SubtletyCue>[];
      emotionalPatterns?: Partial<EmotionalPattern>[];
      creativityTemplates?: Partial<CreativityTemplate>[];
    },
    performedBy: string
  ): Promise<{
    success: boolean;
    counts: { cues: { imported: number; skipped: number }; emotions: { imported: number; skipped: number }; creativity: { imported: number; skipped: number } };
  }> {
    try {
      const counts = {
        cues: { imported: 0, skipped: 0 },
        emotions: { imported: 0, skipped: 0 },
        creativity: { imported: 0, skipped: 0 },
      };
      
      // Import subtlety cues
      if (data.subtletyCues) {
        for (const cue of data.subtletyCues) {
          if (cue.originId) {
            const existing = await getSharedDb().select().from(subtletyCues).where(eq(subtletyCues.originId, cue.originId)).limit(1);
            if (existing.length > 0) { counts.cues.skipped++; continue; }
          }
          
          await getSharedDb().insert(subtletyCues).values({
            ...cue,
            id: undefined,
            syncStatus: 'synced',
            originId: cue.originId || cue.id,
            originEnvironment: cue.originEnvironment || CURRENT_ENVIRONMENT,
          } as any);
          counts.cues.imported++;
        }
      }
      
      // Import emotional patterns
      if (data.emotionalPatterns) {
        for (const pattern of data.emotionalPatterns) {
          if (pattern.originId) {
            const existing = await getSharedDb().select().from(emotionalPatterns).where(eq(emotionalPatterns.originId, pattern.originId)).limit(1);
            if (existing.length > 0) { counts.emotions.skipped++; continue; }
          }
          
          await getSharedDb().insert(emotionalPatterns).values({
            ...pattern,
            id: undefined,
            syncStatus: 'synced',
            originId: pattern.originId || pattern.id,
            originEnvironment: pattern.originEnvironment || CURRENT_ENVIRONMENT,
          } as any);
          counts.emotions.imported++;
        }
      }
      
      // Import creativity templates
      if (data.creativityTemplates) {
        for (const template of data.creativityTemplates) {
          if (template.originId) {
            const existing = await getSharedDb().select().from(creativityTemplates).where(eq(creativityTemplates.originId, template.originId)).limit(1);
            if (existing.length > 0) { counts.creativity.skipped++; continue; }
          }
          
          await getSharedDb().insert(creativityTemplates).values({
            ...template,
            id: undefined,
            syncStatus: 'synced',
            originId: template.originId || template.id,
            originEnvironment: template.originEnvironment || CURRENT_ENVIRONMENT,
          } as any);
          counts.creativity.imported++;
        }
      }
      
      const total = counts.cues.imported + counts.emotions.imported + counts.creativity.imported;
      
      if (total > 0) {
        await this.logSyncOperation({
          operation: 'advanced_intelligence_import',
          tableName: 'advanced_intelligence',
          recordCount: total,
          sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
          targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
          performedBy,
          status: 'success',
          metadata: { counts }
        });
      }
      
      return { success: true, counts };
    } catch (error: any) {
      console.error('[SYNC] Error importing advanced intelligence:', error);
      return { success: false, counts: { cues: { imported: 0, skipped: 0 }, emotions: { imported: 0, skipped: 0 }, creativity: { imported: 0, skipped: 0 } } };
    }
  }
  
  /**
   * Auto-approve all Advanced Intelligence items
   */
  async autoApproveAdvancedIntelligence(approvedBy: string = 'system'): Promise<{
    success: boolean;
    counts: { cues: number; emotions: number; creativity: number };
  }> {
    try {
      const [cuesResult, emotionsResult, creativityResult] = await Promise.all([
        getSharedDb().update(subtletyCues)
          .set({ syncStatus: 'approved' })
          .where(and(eq(subtletyCues.isActive, true), eq(subtletyCues.syncStatus, 'local')))
          .returning(),
        getSharedDb().update(emotionalPatterns)
          .set({ syncStatus: 'approved' })
          .where(and(eq(emotionalPatterns.isActive, true), eq(emotionalPatterns.syncStatus, 'local')))
          .returning(),
        getSharedDb().update(creativityTemplates)
          .set({ syncStatus: 'approved' })
          .where(and(eq(creativityTemplates.isActive, true), eq(creativityTemplates.syncStatus, 'local')))
          .returning(),
      ]);
      
      const counts = {
        cues: cuesResult.length,
        emotions: emotionsResult.length,
        creativity: creativityResult.length,
      };
      
      const total = counts.cues + counts.emotions + counts.creativity;
      
      if (total > 0) {
        await this.logSyncOperation({
          operation: 'advanced_intelligence_auto_approve',
          tableName: 'advanced_intelligence',
          recordCount: total,
          sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
          targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
          performedBy: approvedBy,
          status: 'success',
          metadata: { counts }
        });
        
        console.log(`[SYNC] Auto-approved ${total} advanced intelligence items:`, counts);
      }
      
      return { success: true, counts };
    } catch (error: any) {
      console.error('[SYNC] Error auto-approving advanced intelligence:', error);
      return { success: false, counts: { cues: 0, emotions: 0, creativity: 0 } };
    }
  }
  
  // ============================================================
  // TEACHING SUGGESTIONS SYNC
  // ============================================================
  
  /**
   * Export teaching suggestion effectiveness data for sync
   * PRIVACY: Only exports aggregated patterns - NO student identifiers
   */
  async exportSuggestionEffectiveness(): Promise<{
    success: boolean;
    data?: {
      aggregatedPatterns: Array<{
        suggestionType: string;
        suggestionId: string;
        totalUsed: number;
        totalEffective: number;
        effectivenessRate: number;
        sampleSize: number; // How many unique sessions contributed
      }>;
    };
  }> {
    try {
      // Use SQL aggregation to avoid loading individual records
      const aggregatedResult = await getSharedDb().execute(sql`
        SELECT 
          suggestion_type,
          suggestion_id,
          COUNT(*) FILTER (WHERE was_used = true) as total_used,
          COUNT(*) FILTER (WHERE was_effective = true) as total_effective,
          COUNT(DISTINCT conversation_id) as sample_size
        FROM teaching_suggestion_effectiveness
        GROUP BY suggestion_type, suggestion_id
        HAVING COUNT(*) >= 3
      `);
      
      const aggregatedPatterns = (aggregatedResult.rows as any[]).map(row => ({
        suggestionType: row.suggestion_type,
        suggestionId: row.suggestion_id,
        totalUsed: Number(row.total_used),
        totalEffective: Number(row.total_effective),
        effectivenessRate: row.total_used > 0 ? Number(row.total_effective) / Number(row.total_used) : 0,
        sampleSize: Number(row.sample_size)
      }));
      
      return { success: true, data: { aggregatedPatterns } };
    } catch (error: any) {
      console.error('[SYNC] Error exporting suggestion effectiveness:', error);
      return { success: false };
    }
  }
  
  /**
   * Export tool preferences for sync
   * PRIVACY: Only exports aggregated tool-level patterns - NO student identifiers
   */
  async exportToolPreferences(): Promise<{
    success: boolean;
    data?: {
      toolPatterns: Array<{
        toolName: string;
        avgEffectivenessRate: number;
        totalStudents: number;
        commonTopics: string[];
        commonStruggles: string[];
      }>;
    };
  }> {
    try {
      // Use SQL aggregation to anonymize data
      const aggregatedResult = await getSharedDb().execute(sql`
        SELECT 
          tool_name,
          AVG(effectiveness_rate) as avg_rate,
          COUNT(DISTINCT student_id) as student_count,
          array_agg(DISTINCT unnest_topics) FILTER (WHERE unnest_topics IS NOT NULL) as all_topics,
          array_agg(DISTINCT unnest_struggles) FILTER (WHERE unnest_struggles IS NOT NULL) as all_struggles
        FROM student_tool_preferences,
          LATERAL unnest(best_for_topics) AS unnest_topics,
          LATERAL unnest(best_for_struggles) AS unnest_struggles
        WHERE times_used >= 3
        GROUP BY tool_name
        HAVING COUNT(DISTINCT student_id) >= 2
      `);
      
      const toolPatterns = (aggregatedResult.rows as any[]).map(row => ({
        toolName: row.tool_name,
        avgEffectivenessRate: Number(row.avg_rate) || 0,
        totalStudents: Number(row.student_count),
        commonTopics: (row.all_topics || []).slice(0, 10),
        commonStruggles: (row.all_struggles || []).slice(0, 10)
      }));
      
      return { success: true, data: { toolPatterns } };
    } catch (error: any) {
      console.error('[SYNC] Error exporting tool preferences:', error);
      return { success: false };
    }
  }
  
  /**
   * Update tool knowledge with effectiveness data from production
   */
  async enrichToolKnowledgeWithEffectiveness(
    toolEffectiveness: Array<{
      toolName: string;
      avgEffectivenessRate: number;
      commonTopics: string[];
      commonStruggles: string[];
    }>
  ): Promise<{ success: boolean; updated: number }> {
    try {
      let updated = 0;
      
      for (const data of toolEffectiveness) {
        // Find matching tool knowledge
        const [tool] = await getSharedDb()
          .select()
          .from(toolKnowledge)
          .where(eq(toolKnowledge.toolName, data.toolName))
          .limit(1);
        
        if (tool) {
          // Merge effectiveness data into bestUsedFor
          const newBestUsedFor = [
            ...(tool.bestUsedFor || []),
            ...data.commonTopics,
            ...data.commonStruggles
          ].filter((v, i, a) => a.indexOf(v) === i); // Deduplicate
          
          await getSharedDb()
            .update(toolKnowledge)
            .set({ bestUsedFor: newBestUsedFor })
            .where(eq(toolKnowledge.id, tool.id));
          
          updated++;
        }
      }
      
      await this.logSyncOperation({
        operation: 'enrich_tool_knowledge',
        tableName: 'tool_knowledge',
        recordCount: updated,
        sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
        status: 'success',
        metadata: { enrichedTools: toolEffectiveness.map(t => t.toolName) }
      });
      
      return { success: true, updated };
    } catch (error: any) {
      console.error('[SYNC] Error enriching tool knowledge:', error);
      return { success: false, updated: 0 };
    }
  }
  
  /**
   * Get complete sync status including Teaching Suggestions
   */
  async getFullSyncStatus(): Promise<{
    neuralNetworkExpansion: { pending: number; approved: number };
    proceduralMemory: { pending: number; approved: number; total: number };
    teachingSuggestions: { 
      effectivenessRecords: number;
      toolPreferences: number;
    };
    danielaSuggestions: {
      pending: number;
      ready: number;
      implemented: number;
      triggers: number;
      actions: number;
    };
    lastSync: Date | null;
    currentEnvironment: string;
  }> {
    const baseStatus = await this.getCompleteSyncStatus();
    
    const [effectivenessRecords, toolPrefs, suggestions, triggers, actions] = await Promise.all([
      getSharedDb().select().from(teachingSuggestionEffectiveness),
      getSharedDb().select().from(studentToolPreferences),
      getSharedDb().select().from(danielaSuggestions),
      getSharedDb().select().from(reflectionTriggers),
      getSharedDb().select().from(danielaSuggestionActions)
    ]);
    
    return {
      ...baseStatus,
      teachingSuggestions: {
        effectivenessRecords: effectivenessRecords.length,
        toolPreferences: toolPrefs.length
      },
      danielaSuggestions: {
        pending: suggestions.filter(s => s.status === 'emerging').length,
        ready: suggestions.filter(s => s.status === 'ready').length,
        implemented: suggestions.filter(s => s.status === 'implemented').length,
        triggers: triggers.length,
        actions: actions.length
      }
    };
  }
  
  // ===== Daniela's Proactive Suggestion System Sync =====
  
  /**
   * Export Daniela's suggestions for sync
   * Exports implemented suggestions (valuable learnings), approved triggers, and team actions
   */
  async exportDanielaSuggestions(): Promise<{
    suggestions: DanielaSuggestion[];
    triggers: ReflectionTrigger[];
    actions: DanielaSuggestionAction[];
  }> {
    // Query each table separately with error handling - tables may not exist in all environments
    let suggestions: DanielaSuggestion[] = [];
    let triggers: ReflectionTrigger[] = [];
    let actions: DanielaSuggestionAction[] = [];
    
    try {
      suggestions = await getSharedDb().select()
        .from(danielaSuggestions)
        .where(or(
          eq(danielaSuggestions.syncStatus, 'approved'),
          eq(danielaSuggestions.status, 'implemented')
        ));
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] daniela_suggestions table query failed (may not exist):', err.message);
    }
    
    try {
      triggers = await getSharedDb().select()
        .from(reflectionTriggers)
        .where(eq(reflectionTriggers.syncStatus, 'approved'));
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] reflection_triggers table query failed (may not exist):', err.message);
    }
    
    try {
      actions = await getSharedDb().select()
        .from(danielaSuggestionActions);
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] daniela_suggestion_actions table query failed (may not exist):', err.message);
    }
    
    return { suggestions, triggers, actions };
  }
  
  /**
   * Import reflection trigger from another environment
   */
  async importReflectionTrigger(trigger: Partial<ReflectionTrigger>): Promise<{
    success: boolean;
    action: 'created' | 'updated' | 'skipped';
    id?: string;
  }> {
    try {
      // Check for existing by originId or trigger name
      const existing = trigger.originId 
        ? await getSharedDb().select().from(reflectionTriggers)
            .where(eq(reflectionTriggers.originId, trigger.originId))
            .limit(1)
        : await getSharedDb().select().from(reflectionTriggers)
            .where(eq(reflectionTriggers.triggerName, trigger.triggerName || ''))
            .limit(1);
      
      if (existing.length > 0) {
        // Update if from different environment
        if (trigger.originEnvironment !== CURRENT_ENVIRONMENT) {
          await getSharedDb().update(reflectionTriggers)
            .set({
              analysisPrompt: trigger.analysisPrompt,
              compassConditions: trigger.compassConditions,
              patternConditions: trigger.patternConditions,
              modeConditions: trigger.modeConditions,
              priority: trigger.priority,
              syncStatus: 'synced'
            })
            .where(eq(reflectionTriggers.id, existing[0].id));
          return { success: true, action: 'updated', id: existing[0].id };
        }
        return { success: true, action: 'skipped' };
      }
      
      // Create new
      const [created] = await getSharedDb().insert(reflectionTriggers).values({
        triggerName: trigger.triggerName || 'Imported Trigger',
        triggerType: trigger.triggerType || 'pattern_based',
        compassConditions: trigger.compassConditions,
        patternConditions: trigger.patternConditions,
        modeConditions: trigger.modeConditions,
        analysisPrompt: trigger.analysisPrompt || '',
        suggestionCategories: trigger.suggestionCategories,
        evidenceRequired: trigger.evidenceRequired,
        cooldownMinutes: trigger.cooldownMinutes,
        priority: trigger.priority,
        isActive: trigger.isActive ?? true,
        originId: trigger.originId || trigger.id,
        originEnvironment: trigger.originEnvironment,
        syncStatus: 'synced'
      }).returning();
      
      return { success: true, action: 'created', id: created.id };
    } catch (error) {
      console.error('[SYNC] Error importing reflection trigger:', error);
      return { success: false, action: 'skipped' };
    }
  }
  
  /**
   * Auto-approve Daniela suggestions for sync
   * Approves ready suggestions with enough evidence
   */
  async autoApproveDanielaSuggestions(): Promise<{ approved: number }> {
    let approved = 0;
    
    // Approve ready suggestions with evidence >= 3
    const readySuggestions = await getSharedDb().select()
      .from(danielaSuggestions)
      .where(and(
        eq(danielaSuggestions.syncStatus, 'local'),
        or(
          eq(danielaSuggestions.status, 'ready'),
          eq(danielaSuggestions.status, 'implemented')
        )
      ));
    
    for (const suggestion of readySuggestions) {
      if ((suggestion.evidenceCount || 0) >= 3 || suggestion.status === 'implemented') {
        await getSharedDb().update(danielaSuggestions)
          .set({ syncStatus: 'approved' })
          .where(eq(danielaSuggestions.id, suggestion.id));
        approved++;
      }
    }
    
    // Approve all local reflection triggers
    await getSharedDb().update(reflectionTriggers)
      .set({ syncStatus: 'approved' })
      .where(eq(reflectionTriggers.syncStatus, 'local'));
    
    return { approved };
  }
  
  /**
   * Sync all Daniela suggestion system data
   */
  async syncDanielaSuggestions(importData: {
    suggestions: DanielaSuggestion[];
    triggers: ReflectionTrigger[];
    actions?: DanielaSuggestionAction[];
  }): Promise<{
    triggersImported: number;
    triggersUpdated: number;
    triggersSkipped: number;
    actionsImported: number;
  }> {
    let triggersImported = 0;
    let triggersUpdated = 0;
    let triggersSkipped = 0;
    let actionsImported = 0;
    
    // Import triggers
    for (const trigger of importData.triggers) {
      const result = await this.importReflectionTrigger(trigger);
      if (result.action === 'created') triggersImported++;
      else if (result.action === 'updated') triggersUpdated++;
      else triggersSkipped++;
    }
    
    // Import actions (if provided)
    if (importData.actions && importData.actions.length > 0) {
      for (const action of importData.actions) {
        // Check if action already exists
        const existing = await getSharedDb().select()
          .from(danielaSuggestionActions)
          .where(eq(danielaSuggestionActions.id, action.id))
          .limit(1);
        
        if (existing.length === 0) {
          try {
            await getSharedDb().insert(danielaSuggestionActions).values({
              suggestionId: action.suggestionId,
              actionType: action.actionType,
              actionBy: action.actionBy,
              comment: action.comment,
              implementedIn: action.implementedIn,
              implementationNotes: action.implementationNotes
            });
            actionsImported++;
          } catch (error) {
            // Skip if FK constraint fails (suggestion doesn't exist in target env)
            console.warn('[SYNC] Skipped action import - suggestion not found');
          }
        }
      }
    }
    
    // Log the sync operation
    await this.logSyncOperation({
      operation: 'sync_daniela_suggestions',
      tableName: 'reflection_triggers',
      recordCount: triggersImported + triggersUpdated + actionsImported,
      sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      status: 'success',
      metadata: { triggersImported, triggersUpdated, triggersSkipped, actionsImported }
    });
    
    return { triggersImported, triggersUpdated, triggersSkipped, actionsImported };
  }
  
  // ===== Tri-Lane Hive Sync Methods =====
  
  // Export observations for sync to production (Tri-Lane Hive collaboration)
  // v23: Delta sync support - only export records created since lastSyncTimestamp
  // Supports pagination via offset/limit to handle large datasets without timeouts
  async exportTriLaneObservations(options?: { 
    offset?: number; 
    limit?: number;
    page?: number; // 0-indexed page number
    sinceTimestamp?: Date; // v23: Delta sync - only export records created after this timestamp
  }): Promise<{
    agentObservations: AgentObservation[];
    supportObservations: SupportObservation[];
    systemAlerts: SystemAlert[];
    pagination?: {
      offset: number;
      limit: number;
      agentTotal: number;
      supportTotal: number;
      alertsTotal: number;
      hasMore: boolean;
    };
    deltaSync?: {
      sinceTimestamp: string;
      isDelta: boolean;
    };
  }> {
    const PAGE_SIZE = options?.limit || 250; // Reduced from 500 to avoid production import timeouts
    // Support both direct offset and 0-indexed page number
    const offset = options?.offset ?? (options?.page !== undefined ? options.page * PAGE_SIZE : 0);
    const sinceTs = options?.sinceTimestamp;
    
    // Query each table separately with error handling - tables may not exist in all environments
    let agentObs: AgentObservation[] = [];
    let supportObs: SupportObservation[] = [];
    let alerts: SystemAlert[] = [];
    let agentTotal = 0;
    let supportTotal = 0;
    let alertsTotal = 0;
    
    try {
      // v23: Delta sync - add createdAt filter if sinceTimestamp provided
      const baseCondition = eq(agentObservations.status, 'active');
      const condition = sinceTs 
        ? and(baseCondition, gte(agentObservations.createdAt, sinceTs))
        : baseCondition;
      
      // Get total count for pagination info
      const countResult = await getSharedDb().select({ count: sql<number>`count(*)::int` })
        .from(agentObservations)
        .where(condition);
      agentTotal = countResult[0]?.count || 0;
      
      agentObs = await getSharedDb().select().from(agentObservations)
        .where(condition)
        .orderBy(desc(agentObservations.priority), agentObservations.id)
        .limit(PAGE_SIZE)
        .offset(offset);
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] agent_observations table query failed (may not exist):', err.message);
    }
    
    try {
      // v23: Delta sync - add createdAt filter if sinceTimestamp provided
      const baseCondition = eq(supportObservations.status, 'active');
      const condition = sinceTs 
        ? and(baseCondition, gte(supportObservations.createdAt, sinceTs))
        : baseCondition;
      
      const countResult = await getSharedDb().select({ count: sql<number>`count(*)::int` })
        .from(supportObservations)
        .where(condition);
      supportTotal = countResult[0]?.count || 0;
      
      supportObs = await getSharedDb().select().from(supportObservations)
        .where(condition)
        .orderBy(desc(supportObservations.priority), supportObservations.id)
        .limit(PAGE_SIZE)
        .offset(offset);
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] support_observations table query failed (may not exist):', err.message);
    }
    
    try {
      // v23: Delta sync - add createdAt filter if sinceTimestamp provided
      const baseCondition = eq(systemAlerts.isActive, true);
      const condition = sinceTs 
        ? and(baseCondition, gte(systemAlerts.createdAt, sinceTs))
        : baseCondition;
      
      const countResult = await getSharedDb().select({ count: sql<number>`count(*)::int` })
        .from(systemAlerts)
        .where(condition);
      alertsTotal = countResult[0]?.count || 0;
      
      alerts = await getSharedDb().select().from(systemAlerts)
        .where(condition)
        .orderBy(desc(systemAlerts.createdAt), systemAlerts.id)
        .limit(PAGE_SIZE)
        .offset(offset);
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] system_alerts table query failed (may not exist):', err.message);
    }
    
    const hasMore = (offset + PAGE_SIZE) < Math.max(agentTotal, supportTotal, alertsTotal);
    
    const deltaInfo = sinceTs ? ` (delta since ${sinceTs.toISOString()})` : '';
    console.log(`[NEURAL-SYNC] TriLane export page: ${agentObs.length}/${agentTotal} agent, ${supportObs.length}/${supportTotal} support, ${alerts.length}/${alertsTotal} alerts (offset=${offset}, hasMore=${hasMore})${deltaInfo}`);
    
    return {
      agentObservations: agentObs,
      supportObservations: supportObs,
      systemAlerts: alerts,
      pagination: {
        offset,
        limit: PAGE_SIZE,
        agentTotal,
        supportTotal,
        alertsTotal,
        hasMore,
      },
      // v23: Delta sync metadata
      deltaSync: sinceTs ? {
        sinceTimestamp: sinceTs.toISOString(),
        isDelta: true,
      } : undefined,
    };
  }
  
  // Import agent observation with intentHash deduplication - performs TRUE UPSERT
  async importAgentObservation(data: Partial<AgentObservation>): Promise<{
    success: boolean;
    action: 'created' | 'updated' | 'skipped';
    id?: string;
  }> {
    try {
      // Check for existing by intentHash or originId
      let existing: AgentObservation | null = null;
      
      if (data.intentHash) {
        const results = await getSharedDb().select()
          .from(agentObservations)
          .where(eq(agentObservations.intentHash, data.intentHash))
          .limit(1);
        if (results.length > 0) existing = results[0];
      }
      
      if (!existing && data.originId) {
        const results = await getSharedDb().select()
          .from(agentObservations)
          .where(eq(agentObservations.originId, data.originId))
          .limit(1);
        if (results.length > 0) existing = results[0];
      }
      
      if (existing) {
        // TRUE UPSERT with defensive merge: only overwrite when incoming explicitly provides data
        const incomingTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
        const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const incomingIsNewer = incomingTime > existingTime;
        
        // Helper: only use incoming value if explicitly provided AND newer
        // Returns undefined to skip update, or the value to set
        const mergeField = <T>(incoming: T | undefined, existing: T | null): T | undefined => {
          if (incoming !== undefined && incomingIsNewer) return incoming;
          return existing ?? undefined;
        };
        
        await getSharedDb().update(agentObservations)
          .set({
            // Priority/evidence: only update if explicitly provided in incoming payload
            priority: data.priority !== undefined && incomingIsNewer ? data.priority : existing.priority,
            evidenceCount: data.evidenceCount !== undefined && incomingIsNewer ? data.evidenceCount : existing.evidenceCount,
            // Content fields: only overwrite if explicitly provided AND newer
            observation: mergeField(data.observation, existing.observation),
            reasoning: mergeField(data.reasoning, existing.reasoning),
            evidenceSummary: mergeField(data.evidenceSummary, existing.evidenceSummary),
            proposedAction: mergeField(data.proposedAction, existing.proposedAction),
            status: mergeField(data.status, existing.status),
            // Acknowledgment flags: preserve existing true, only apply incoming true if newer
            acknowledgedByDaniela: existing.acknowledgedByDaniela === true || (incomingIsNewer && data.acknowledgedByDaniela === true),
            acknowledgedBySupport: existing.acknowledgedBySupport === true || (incomingIsNewer && data.acknowledgedBySupport === true),
            // Acknowledgment timestamp: take the latest non-null value
            acknowledgedAt: (data.acknowledgedAt && existing.acknowledgedAt) 
              ? (new Date(data.acknowledgedAt) > new Date(existing.acknowledgedAt) ? data.acknowledgedAt : existing.acknowledgedAt)
              : (data.acknowledgedAt || existing.acknowledgedAt),
            // Domain tags: union, filtering out undefined/null
            domainTags: Array.from(new Set([
              ...(existing.domainTags || []).filter(Boolean),
              ...(data.domainTags || []).filter(Boolean)
            ])) as string[],
            // Preserve existing syncStatus if local, otherwise mark synced
            syncStatus: existing.syncStatus === 'local' ? 'local' : 'synced',
            updatedAt: new Date()
          })
          .where(eq(agentObservations.id, existing.id));
        return { success: true, action: 'updated', id: existing.id };
      }
      
      // Create new observation
      const [created] = await getSharedDb().insert(agentObservations).values({
        category: data.category || 'improvement' as any,
        priority: data.priority || 50,
        title: data.title || 'Imported Observation',
        observation: data.observation || '',
        reasoning: data.reasoning,
        evidenceCount: data.evidenceCount || 1,
        evidenceSummary: data.evidenceSummary,
        relatedFiles: data.relatedFiles,
        proposedAction: data.proposedAction,
        proposedCode: data.proposedCode,
        targetTable: data.targetTable,
        status: 'active',
        syncStatus: 'synced',
        originId: data.id || data.originId,
        originEnvironment: data.originEnvironment || CURRENT_ENVIRONMENT,
        originRole: data.originRole || 'editor',
        // Sanitize domain tags on insert to prevent undefined/null entries
        domainTags: (data.domainTags || []).filter(Boolean) as string[],
        intentHash: data.intentHash,
      }).returning();
      
      return { success: true, action: 'created', id: created.id };
    } catch (error: any) {
      console.error('[SYNC] Error importing agent observation:', error);
      return { success: false, action: 'skipped' };
    }
  }
  
  // Import support observation with intentHash deduplication - performs TRUE UPSERT
  async importSupportObservation(data: Partial<SupportObservation>): Promise<{
    success: boolean;
    action: 'created' | 'updated' | 'skipped';
    id?: string;
  }> {
    try {
      // Check for existing by intentHash or originId
      let existing: SupportObservation | null = null;
      
      if (data.intentHash) {
        const results = await getSharedDb().select()
          .from(supportObservations)
          .where(eq(supportObservations.intentHash, data.intentHash))
          .limit(1);
        if (results.length > 0) existing = results[0];
      }
      
      if (!existing && data.originId) {
        const results = await getSharedDb().select()
          .from(supportObservations)
          .where(eq(supportObservations.originId, data.originId))
          .limit(1);
        if (results.length > 0) existing = results[0];
      }
      
      if (existing) {
        // TRUE UPSERT with defensive merge: only overwrite when incoming explicitly provides data
        const incomingTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
        const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const incomingIsNewer = incomingTime > existingTime;
        
        // Helper: only use incoming value if explicitly provided AND newer
        // Returns undefined to skip update, or the value to set
        const mergeField = <T>(incoming: T | undefined, existing: T | null): T | undefined => {
          if (incoming !== undefined && incomingIsNewer) return incoming;
          return existing ?? undefined;
        };
        
        await getSharedDb().update(supportObservations)
          .set({
            // Priority/evidence: only update if explicitly provided in incoming payload
            priority: data.priority !== undefined && incomingIsNewer ? data.priority : existing.priority,
            evidenceCount: data.evidenceCount !== undefined && incomingIsNewer ? data.evidenceCount : existing.evidenceCount,
            // Affected user count: take max when explicitly provided
            affectedUserCount: data.affectedUserCount !== undefined 
              ? Math.max(data.affectedUserCount ?? 0, existing.affectedUserCount ?? 0) 
              : existing.affectedUserCount,
            // Content fields: only overwrite if explicitly provided AND newer
            observation: mergeField(data.observation, existing.observation),
            reasoning: mergeField(data.reasoning, existing.reasoning),
            evidenceSummary: mergeField(data.evidenceSummary, existing.evidenceSummary),
            proposedSolution: mergeField(data.proposedSolution, existing.proposedSolution),
            proposedFaqEntry: mergeField(data.proposedFaqEntry, existing.proposedFaqEntry),
            status: mergeField(data.status, existing.status),
            // Escalation: preserve existing true, only apply incoming true if newer
            escalationNeeded: existing.escalationNeeded === true || (incomingIsNewer && data.escalationNeeded === true),
            // Acknowledgment flags: preserve existing true, only apply incoming true if newer
            acknowledgedByEditor: existing.acknowledgedByEditor === true || (incomingIsNewer && data.acknowledgedByEditor === true),
            acknowledgedByDaniela: existing.acknowledgedByDaniela === true || (incomingIsNewer && data.acknowledgedByDaniela === true),
            // Acknowledgment timestamp: take the latest non-null value
            acknowledgedAt: (data.acknowledgedAt && existing.acknowledgedAt) 
              ? (new Date(data.acknowledgedAt) > new Date(existing.acknowledgedAt) ? data.acknowledgedAt : existing.acknowledgedAt)
              : (data.acknowledgedAt || existing.acknowledgedAt),
            // Resolution tracking: only overwrite if incoming has explicit resolution
            resolvedAt: data.resolvedAt !== undefined ? data.resolvedAt : existing.resolvedAt,
            resolvedBy: data.resolvedBy !== undefined ? data.resolvedBy : existing.resolvedBy,
            resolutionNotes: mergeField(data.resolutionNotes, existing.resolutionNotes),
            // Domain tags: union, filtering out undefined/null
            domainTags: Array.from(new Set([
              ...(existing.domainTags || []).filter(Boolean),
              ...(data.domainTags || []).filter(Boolean)
            ])) as string[],
            // Preserve existing syncStatus if local, otherwise mark synced
            syncStatus: existing.syncStatus === 'local' ? 'local' : 'synced',
            updatedAt: new Date()
          })
          .where(eq(supportObservations.id, existing.id));
        return { success: true, action: 'updated', id: existing.id };
      }
      
      // Create new observation
      const [created] = await getSharedDb().insert(supportObservations).values({
        category: data.category || 'user_friction' as any,
        priority: data.priority || 50,
        title: data.title || 'Imported Observation',
        observation: data.observation || '',
        reasoning: data.reasoning,
        evidenceCount: data.evidenceCount || 1,
        evidenceSummary: data.evidenceSummary,
        affectedUserCount: data.affectedUserCount,
        proposedSolution: data.proposedSolution,
        proposedFaqEntry: data.proposedFaqEntry,
        escalationNeeded: data.escalationNeeded || false,
        status: 'active',
        syncStatus: 'synced',
        originId: data.id || data.originId,
        originEnvironment: data.originEnvironment || CURRENT_ENVIRONMENT,
        originRole: data.originRole || 'support',
        // Sanitize domain tags on insert to prevent undefined/null entries
        domainTags: (data.domainTags || []).filter(Boolean) as string[],
        intentHash: data.intentHash,
      }).returning();
      
      return { success: true, action: 'created', id: created.id };
    } catch (error: any) {
      console.error('[SYNC] Error importing support observation:', error);
      return { success: false, action: 'skipped' };
    }
  }
  
  // Import system alert (for proactive support) - performs TRUE UPSERT
  async importSystemAlert(data: Partial<SystemAlert>): Promise<{
    success: boolean;
    action: 'created' | 'updated' | 'skipped';
    id?: string;
  }> {
    try {
      // Check for existing by originId
      let existing: SystemAlert | null = null;
      
      if (data.originId) {
        const results = await getSharedDb().select()
          .from(systemAlerts)
          .where(eq(systemAlerts.originId, data.originId))
          .limit(1);
        if (results.length > 0) existing = results[0];
      }
      
      if (existing) {
        // TRUE UPSERT with defensive merge: only overwrite when incoming explicitly provides data
        const incomingTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
        const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
        const incomingIsNewer = incomingTime > existingTime;
        
        // Helper: only use incoming value if explicitly provided AND newer
        // Returns undefined to skip update, or the value to set
        const mergeField = <T>(incoming: T | undefined, existing: T | null): T | undefined => {
          if (incoming !== undefined && incomingIsNewer) return incoming;
          return existing ?? undefined;
        };
        
        await getSharedDb().update(systemAlerts)
          .set({
            // Content fields: only overwrite if explicitly provided AND newer
            severity: mergeField(data.severity, existing.severity),
            title: mergeField(data.title, existing.title),
            message: mergeField(data.message, existing.message),
            target: mergeField(data.target, existing.target),
            affectedFeatures: mergeField(data.affectedFeatures, existing.affectedFeatures),
            // Boolean display settings: only update if explicitly provided AND newer
            isDismissible: data.isDismissible !== undefined && incomingIsNewer ? data.isDismissible : existing.isDismissible,
            showInChat: data.showInChat !== undefined && incomingIsNewer ? data.showInChat : existing.showInChat,
            showAsBanner: data.showAsBanner !== undefined && incomingIsNewer ? data.showAsBanner : existing.showAsBanner,
            expiresAt: mergeField(data.expiresAt, existing.expiresAt),
            // isActive: only update if explicitly provided AND newer
            isActive: data.isActive !== undefined && incomingIsNewer ? data.isActive : existing.isActive,
            // View/dismiss counts: only update if newer (prevents inflation on repeated syncs)
            viewCount: data.viewCount !== undefined && incomingIsNewer ? data.viewCount : existing.viewCount,
            dismissCount: data.dismissCount !== undefined && incomingIsNewer ? data.dismissCount : existing.dismissCount,
            // Resolution tracking: only update if incoming explicitly provides data
            relatedIncidentId: data.relatedIncidentId !== undefined ? data.relatedIncidentId : existing.relatedIncidentId,
            resolvedByAlertId: data.resolvedByAlertId !== undefined ? data.resolvedByAlertId : existing.resolvedByAlertId,
            // Preserve existing syncStatus if local, otherwise mark synced
            syncStatus: existing.syncStatus === 'local' ? 'local' : 'synced',
            updatedAt: new Date()
          })
          .where(eq(systemAlerts.id, existing.id));
        return { success: true, action: 'updated', id: existing.id };
      }
      
      // Create new alert
      const [created] = await getSharedDb().insert(systemAlerts).values({
        severity: data.severity || 'info' as any,
        title: data.title || 'System Alert',
        message: data.message || '',
        target: data.target || 'all' as any,
        affectedFeatures: data.affectedFeatures,
        isDismissible: data.isDismissible ?? true,
        showInChat: data.showInChat ?? true,
        showAsBanner: data.showAsBanner ?? false,
        startsAt: data.startsAt || new Date(),
        expiresAt: data.expiresAt,
        isActive: data.isActive ?? true,
        createdBy: data.createdBy || 'support_agent',
        relatedIncidentId: data.relatedIncidentId,
        resolvedByAlertId: data.resolvedByAlertId,
        syncStatus: 'synced',
        originId: data.id || data.originId,
        originEnvironment: data.originEnvironment || CURRENT_ENVIRONMENT,
      }).returning();
      
      return { success: true, action: 'created', id: created.id };
    } catch (error: any) {
      console.error('[SYNC] Error importing system alert:', error);
      return { success: false, action: 'skipped' };
    }
  }
  
  // Bulk sync all Tri-Lane observations
  async syncTriLaneObservations(importData: {
    agentObservations: Partial<AgentObservation>[];
    supportObservations: Partial<SupportObservation>[];
    systemAlerts: Partial<SystemAlert>[];
  }): Promise<{
    agentCreated: number;
    agentUpdated: number;
    agentSkipped: number;
    supportCreated: number;
    supportUpdated: number;
    supportSkipped: number;
    alertsCreated: number;
    alertsUpdated: number;
    alertsSkipped: number;
  }> {
    let agentCreated = 0, agentUpdated = 0, agentSkipped = 0;
    let supportCreated = 0, supportUpdated = 0, supportSkipped = 0;
    let alertsCreated = 0, alertsUpdated = 0, alertsSkipped = 0;
    
    // Import agent observations
    for (const obs of importData.agentObservations) {
      const result = await this.importAgentObservation(obs);
      if (result.action === 'created') agentCreated++;
      else if (result.action === 'updated') agentUpdated++;
      else agentSkipped++;
    }
    
    // Import support observations
    for (const obs of importData.supportObservations) {
      const result = await this.importSupportObservation(obs);
      if (result.action === 'created') supportCreated++;
      else if (result.action === 'updated') supportUpdated++;
      else supportSkipped++;
    }
    
    // Import system alerts
    for (const alert of importData.systemAlerts) {
      const result = await this.importSystemAlert(alert);
      if (result.action === 'created') alertsCreated++;
      else if (result.action === 'updated') alertsUpdated++;
      else alertsSkipped++;
    }
    
    // Log the sync operation
    await this.logSyncOperation({
      operation: 'sync_trilane_observations',
      tableName: 'agent_observations,support_observations,system_alerts',
      recordCount: agentCreated + supportCreated + alertsCreated,
      sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
      status: 'success',
      metadata: {
        agentCreated, agentUpdated, agentSkipped,
        supportCreated, supportUpdated, supportSkipped,
        alertsCreated, alertsUpdated, alertsSkipped
      }
    });
    
    return {
      agentCreated, agentUpdated, agentSkipped,
      supportCreated, supportUpdated, supportSkipped,
      alertsCreated, alertsUpdated, alertsSkipped
    };
  }
  
  // Generate intentHash for cross-agent deduplication
  generateIntentHash(content: { title: string; observation: string; category: string }): string {
    const normalized = `${content.category}:${content.title.toLowerCase().trim()}:${content.observation.toLowerCase().trim().slice(0, 200)}`;
    return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
  }
  
  // ============================================================
  // NORTH STAR SYNC (3 Tables)
  // Constitutional foundation: principles, understanding, examples
  // ============================================================
  
  /**
   * Export North Star data for sync
   * Returns all active principles, understanding, and examples
   */
  async exportNorthStar(): Promise<{
    exportedAt: string;
    environment: string;
    principles: NorthStarPrinciple[];
    understanding: NorthStarUnderstanding[];
    examples: NorthStarExample[];
  }> {
    // Query each table separately with error handling - tables may not exist in all environments
    let principles: NorthStarPrinciple[] = [];
    let understanding: NorthStarUnderstanding[] = [];
    let examples: NorthStarExample[] = [];
    
    try {
      principles = await getSharedDb().select().from(northStarPrinciples).where(eq(northStarPrinciples.isActive, true));
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] north_star_principles table query failed (may not exist):', err.message);
    }
    
    try {
      understanding = await getSharedDb().select().from(northStarUnderstanding);
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] north_star_understanding table query failed (may not exist):', err.message);
    }
    
    try {
      examples = await getSharedDb().select().from(northStarExamples);
    } catch (err: any) {
      console.warn('[NEURAL-SYNC] north_star_examples table query failed (may not exist):', err.message);
    }
    
    return {
      exportedAt: new Date().toISOString(),
      environment: CURRENT_ENVIRONMENT,
      principles,
      understanding,
      examples,
    };
  }
  
  /**
   * Import a North Star principle with deduplication
   * Matches by principle text to avoid duplicates
   * Returns both local id and source id for mapping
   */
  async importNorthStarPrinciple(principle: Partial<NorthStarPrinciple>, importedBy: string): Promise<{ success: boolean; id?: string; sourceId?: string; action?: string; error?: string }> {
    try {
      if (!principle.principle || !principle.category) {
        return { success: false, error: 'Missing required fields (principle, category)' };
      }
      
      const sourceId = principle.id; // Preserve source ID for mapping
      
      // Check for existing by principle text (the actual truth is the dedup key)
      const existing = await getSharedDb().select().from(northStarPrinciples)
        .where(eq(northStarPrinciples.principle, principle.principle))
        .limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, sourceId, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(northStarPrinciples).values({
        principle: principle.principle,
        category: principle.category,
        originalContext: principle.originalContext,
        orderIndex: principle.orderIndex ?? 0,
        isActive: true,
      }).returning();
      
      return { success: true, id: imported.id, sourceId, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing North Star principle:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import North Star understanding with deduplication
   * Matches by localPrincipleId to allow updates (understanding evolves)
   * @param localPrincipleId - The LOCAL principle ID (after mapping from source ID)
   */
  async importNorthStarUnderstanding(understanding: Partial<NorthStarUnderstanding>, importedBy: string, localPrincipleId?: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      if (!understanding.reflection) {
        return { success: false, error: 'Missing required field: reflection' };
      }
      
      // Use provided localPrincipleId (from sync bridge mapping) or fallback to understanding.principleId
      const targetPrincipleId = localPrincipleId || understanding.principleId;
      
      if (!targetPrincipleId) {
        return { success: false, error: 'Missing principleId (no mapping available)' };
      }
      
      // Verify principle exists in this environment
      const principleExists = await getSharedDb().select().from(northStarPrinciples)
        .where(eq(northStarPrinciples.id, targetPrincipleId))
        .limit(1);
      
      if (principleExists.length === 0) {
        return { success: false, error: 'Principle not found in this environment' };
      }
      
      // Check for existing understanding for this principle
      const existing = await getSharedDb().select().from(northStarUnderstanding)
        .where(eq(northStarUnderstanding.principleId, targetPrincipleId))
        .limit(1);
      
      if (existing.length > 0) {
        // Update existing understanding if newer
        if (understanding.lastDeepened && understanding.lastDeepened > existing[0].lastDeepened) {
          await getSharedDb().update(northStarUnderstanding)
            .set({
              reflection: understanding.reflection,
              depth: understanding.depth,
              lastDeepened: understanding.lastDeepened,
              updatedAt: new Date(),
            })
            .where(eq(northStarUnderstanding.id, existing[0].id));
          return { success: true, id: existing[0].id, action: 'updated' };
        }
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(northStarUnderstanding).values({
        principleId: targetPrincipleId,
        reflection: understanding.reflection,
        depth: understanding.depth ?? 'surface',
        lastDeepened: understanding.lastDeepened ?? new Date(),
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing North Star understanding:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Import North Star example with deduplication
   * Matches by (principleId, example text) to avoid duplicates
   * @param localPrincipleId - The LOCAL principle ID (after mapping from source ID)
   */
  async importNorthStarExample(example: Partial<NorthStarExample>, importedBy: string, localPrincipleId?: string): Promise<{ success: boolean; id?: string; action?: string; error?: string }> {
    try {
      if (!example.example) {
        return { success: false, error: 'Missing required field: example' };
      }
      
      // Use provided localPrincipleId (from sync bridge mapping) or fallback to example.principleId
      const targetPrincipleId = localPrincipleId || example.principleId;
      
      if (!targetPrincipleId) {
        return { success: false, error: 'Missing principleId (no mapping available)' };
      }
      
      // Verify principle exists in this environment
      const principleExists = await getSharedDb().select().from(northStarPrinciples)
        .where(eq(northStarPrinciples.id, targetPrincipleId))
        .limit(1);
      
      if (principleExists.length === 0) {
        return { success: false, error: 'Principle not found in this environment' };
      }
      
      // Check for existing by principle + example text
      const existing = await getSharedDb().select().from(northStarExamples)
        .where(and(
          eq(northStarExamples.principleId, targetPrincipleId),
          eq(northStarExamples.example, example.example)
        ))
        .limit(1);
      
      if (existing.length > 0) {
        return { success: true, id: existing[0].id, action: 'skipped' };
      }
      
      const [imported] = await getSharedDb().insert(northStarExamples).values({
        principleId: targetPrincipleId,
        example: example.example,
        source: example.source ?? 'founder_original',
        context: example.context,
      }).returning();
      
      return { success: true, id: imported.id, action: 'imported' };
    } catch (error: any) {
      console.error('[SYNC] Error importing North Star example:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // SHARED MEMORY BRIDGE - Bidirectional Insight Sharing
  // ============================================================================

  /**
   * Share Wren's architectural/development insight with Daniela
   * Wren's insights about code patterns, architecture, debugging can inform
   * how Daniela teaches technical concepts to students
   */
  async shareInsightWithDaniela(params: {
    insightId: string;
    category: 'architecture' | 'debugging' | 'pattern' | 'gotcha' | 'integration';
    title: string;
    content: string;
    teachingRelevance?: string;
  }): Promise<{ success: boolean; procedureId?: string; error?: string }> {
    try {
      // Store as a tutor procedure that Daniela can access
      const procedureData = {
        title: `[WREN_INSIGHT] ${params.title}`,
        category: 'technical_explanation',
        trigger: 'wren_insight_shared',
        procedure: [
          `Source: Wren development insight (${params.category})`,
          `Content: ${params.content}`,
          params.teachingRelevance ? `Teaching application: ${params.teachingRelevance}` : null
        ].filter(Boolean).join('\n'),
        examples: [`Insight ID: ${params.insightId}`],
        applicablePhases: ['teaching'],
        language: null,
        actflLevelRange: null,
        priority: 50,
        isActive: true,
        syncStatus: 'local',
        originId: params.insightId,
        originEnvironment: CURRENT_ENVIRONMENT,
      };

      const [procedure] = await getSharedDb()
        .insert(tutorProcedures)
        .values(procedureData)
        .onConflictDoNothing()
        .returning();

      if (!procedure) {
        // Already synced — not an error, just a duplicate
        return { success: true };
      }

      console.log(`[NeuralSync] Shared Wren insight "${params.title}" with Daniela as procedure ${procedure.id}`);
      
      return { success: true, procedureId: procedure.id };
    } catch (error: any) {
      console.error('[NeuralSync] Error sharing insight with Daniela:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Share Daniela's pedagogical discovery with Wren
   * Daniela's insights about teaching effectiveness, student struggles,
   * and learning patterns can inform Wren's development priorities
   */
  async shareInsightWithWren(params: {
    source: 'teaching_session' | 'student_feedback' | 'pattern_observation';
    title: string;
    content: string;
    developmentRelevance?: string;
    suggestedCategory?: 'pattern' | 'solution' | 'gotcha' | 'architecture' | 'debugging' | 'integration' | 'performance';
  }): Promise<{ success: boolean; insightId?: string; error?: string }> {
    try {
      // Store as a Wren insight that development agent can access
      const insightData = {
        category: params.suggestedCategory || 'pattern',
        title: `[DANIELA_INSIGHT] ${params.title}`,
        content: params.content,
        context: params.developmentRelevance || `Pedagogical insight from ${params.source}`,
        tags: ['daniela_shared', params.source],
        relatedFiles: [],
        environment: 'development' as const,
        sessionId: null,
        useCount: 0,
        lastUsedAt: null,
      };

      const [insight] = await getSharedDb().insert(wrenInsights).values(insightData).returning();
      
      console.log(`[NeuralSync] Shared Daniela insight "${params.title}" with Wren as insight ${insight.id}`);
      
      return { success: true, insightId: insight.id };
    } catch (error: any) {
      console.error('[NeuralSync] Error sharing insight with Wren:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all insights shared from Wren to Daniela
   */
  async getWrenSharedInsights(): Promise<any[]> {
    return getSharedDb().select()
      .from(tutorProcedures)
      .where(eq(tutorProcedures.trigger, 'wren_insight_shared'))
      .orderBy(desc(tutorProcedures.createdAt))
      .limit(50);
  }

  /**
   * Get all insights shared from Daniela to Wren
   */
  async getDanielaSharedInsights(): Promise<any[]> {
    return getSharedDb().select()
      .from(wrenInsights)
      .where(sql`${wrenInsights.tags}::text[] @> ARRAY['daniela_shared']::text[]`)
      .orderBy(desc(wrenInsights.createdAt))
      .limit(50);
  }

  /**
   * Get counts of items pending sync approval (syncStatus = 'local') across all neural network tables
   */
  async getPendingSyncCounts(): Promise<{
    tables: Array<{
      tableName: string;
      displayName: string;
      localCount: number;
      approvedCount: number;
    }>;
    totalPending: number;
  }> {
    try {
      const [
        situationalLocal, situationalApproved,
        principlesLocal, principlesApproved,
        cuesLocal, cuesApproved,
        emotionsLocal, emotionsApproved,
        creativityLocal, creativityApproved,
      ] = await Promise.all([
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(situationalPatterns).where(eq(situationalPatterns.syncStatus, 'local')),
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(situationalPatterns).where(eq(situationalPatterns.syncStatus, 'approved')),
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(teachingPrinciples).where(eq(teachingPrinciples.syncStatus, 'local')),
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(teachingPrinciples).where(eq(teachingPrinciples.syncStatus, 'approved')),
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(subtletyCues).where(eq(subtletyCues.syncStatus, 'local')),
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(subtletyCues).where(eq(subtletyCues.syncStatus, 'approved')),
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(emotionalPatterns).where(eq(emotionalPatterns.syncStatus, 'local')),
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(emotionalPatterns).where(eq(emotionalPatterns.syncStatus, 'approved')),
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(creativityTemplates).where(eq(creativityTemplates.syncStatus, 'local')),
        getSharedDb().select({ count: sql<number>`count(*)::int` }).from(creativityTemplates).where(eq(creativityTemplates.syncStatus, 'approved')),
      ]);

      const tables = [
        { tableName: 'situational_patterns', displayName: 'Situational Patterns', localCount: situationalLocal[0]?.count || 0, approvedCount: situationalApproved[0]?.count || 0 },
        { tableName: 'teaching_principles', displayName: 'Teaching Principles', localCount: principlesLocal[0]?.count || 0, approvedCount: principlesApproved[0]?.count || 0 },
        { tableName: 'subtlety_cues', displayName: 'Subtlety Cues', localCount: cuesLocal[0]?.count || 0, approvedCount: cuesApproved[0]?.count || 0 },
        { tableName: 'emotional_patterns', displayName: 'Emotional Patterns', localCount: emotionsLocal[0]?.count || 0, approvedCount: emotionsApproved[0]?.count || 0 },
        { tableName: 'creativity_templates', displayName: 'Creativity Templates', localCount: creativityLocal[0]?.count || 0, approvedCount: creativityApproved[0]?.count || 0 },
      ];

      const totalPending = tables.reduce((sum, t) => sum + t.localCount, 0);

      return { tables, totalPending };
    } catch (error: any) {
      console.error('[NeuralSync] Error getting pending sync counts:', error);
      return { tables: [], totalPending: 0 };
    }
  }

  /**
   * Approve all local items in a specific table for sync
   */
  async approveTableForSync(tableName: string, approvedBy: string = 'admin'): Promise<{
    success: boolean;
    count: number;
    error?: string;
  }> {
    try {
      let result: any[] = [];
      
      switch (tableName) {
        case 'situational_patterns':
          result = await getSharedDb().update(situationalPatterns)
            .set({ syncStatus: 'approved' })
            .where(eq(situationalPatterns.syncStatus, 'local'))
            .returning();
          break;
        case 'teaching_principles':
          result = await getSharedDb().update(teachingPrinciples)
            .set({ syncStatus: 'approved' })
            .where(eq(teachingPrinciples.syncStatus, 'local'))
            .returning();
          break;
        case 'subtlety_cues':
          result = await getSharedDb().update(subtletyCues)
            .set({ syncStatus: 'approved' })
            .where(eq(subtletyCues.syncStatus, 'local'))
            .returning();
          break;
        case 'emotional_patterns':
          result = await getSharedDb().update(emotionalPatterns)
            .set({ syncStatus: 'approved' })
            .where(eq(emotionalPatterns.syncStatus, 'local'))
            .returning();
          break;
        case 'creativity_templates':
          result = await getSharedDb().update(creativityTemplates)
            .set({ syncStatus: 'approved' })
            .where(eq(creativityTemplates.syncStatus, 'local'))
            .returning();
          break;
        default:
          return { success: false, count: 0, error: `Unknown table: ${tableName}` };
      }

      if (result.length > 0) {
        await this.logSyncOperation({
          operation: 'approve_for_sync',
          tableName,
          recordCount: result.length,
          sourceEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
          targetEnvironment: CURRENT_ENVIRONMENT as 'development' | 'production',
          performedBy: approvedBy,
          status: 'success',
          metadata: { approvedCount: result.length }
        });
        console.log(`[NeuralSync] Approved ${result.length} items in ${tableName} for sync`);
      }

      return { success: true, count: result.length };
    } catch (error: any) {
      console.error(`[NeuralSync] Error approving ${tableName} for sync:`, error);
      return { success: false, count: 0, error: error.message };
    }
  }

  /**
   * Approve all local items across all neural network tables
   */
  async approveAllForSync(approvedBy: string = 'admin'): Promise<{
    success: boolean;
    counts: Record<string, number>;
    total: number;
  }> {
    const tables = ['situational_patterns', 'teaching_principles', 'subtlety_cues', 'emotional_patterns', 'creativity_templates'];
    const counts: Record<string, number> = {};
    let total = 0;

    for (const table of tables) {
      const result = await this.approveTableForSync(table, approvedBy);
      counts[table] = result.count;
      total += result.count;
    }

    return { success: true, counts, total };
  }
}

export const neuralNetworkSync = new NeuralNetworkSyncService();
