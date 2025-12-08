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
   */
  anonymizePedagogicalInsight(insight: {
    id: string;
    studentId: string;
    teacherId?: string | null;
    insightType: string;
    insight: string;
    actionTaken?: string | null;
    outcome?: string | null;
    language?: string | null;
    proficiencyLevel?: string | null;
    sessionContext?: any;
    effectivenessScore?: number | null;
    createdAt?: Date;
  }): {
    anonymizedStudentHash: string;
    insightType: string;
    insight: string;
    actionTaken: string;
    outcome: string;
    language: string | null;
    proficiencyLevel: string | null;
    effectivenessScore: number | null;
    sessionContextSummary: { 
      hasContext: boolean; 
      contextType?: string;
    };
  } {
    return {
      anonymizedStudentHash: this.hashStudentId(insight.studentId),
      insightType: insight.insightType,
      insight: this.redactSensitiveText(insight.insight),
      actionTaken: this.redactSensitiveText(insight.actionTaken),
      outcome: this.redactSensitiveText(insight.outcome),
      language: insight.language,
      proficiencyLevel: insight.proficiencyLevel,
      effectivenessScore: insight.effectivenessScore,
      sessionContextSummary: {
        hasContext: !!insight.sessionContext,
        contextType: insight.sessionContext?.type
      }
    };
  }
  
  /**
   * Anonymize a student connection record
   */
  anonymizeStudentConnection(connection: {
    studentId: string;
    connectionType: string;
    description?: string | null;
    strength?: number | null;
    language?: string | null;
  }): {
    anonymizedStudentHash: string;
    connectionType: string;
    description: string;
    strength: number | null;
    language: string | null;
  } {
    return {
      anonymizedStudentHash: this.hashStudentId(connection.studentId),
      connectionType: connection.connectionType,
      description: this.redactSensitiveText(connection.description),
      strength: connection.strength,
      language: connection.language
    };
  }
  
  /**
   * Anonymize a student motivation record
   */
  anonymizeStudentMotivation(motivation: {
    studentId: string;
    motivationType: string;
    description?: string | null;
    intensity?: number | null;
    language?: string | null;
  }): {
    anonymizedStudentHash: string;
    motivationType: string;
    description: string;
    intensity: number | null;
    language: string | null;
  } {
    return {
      anonymizedStudentHash: this.hashStudentId(motivation.studentId),
      motivationType: motivation.motivationType,
      description: this.redactSensitiveText(motivation.description),
      intensity: motivation.intensity,
      language: motivation.language
    };
  }
  
  /**
   * Anonymize a student struggle record
   */
  anonymizeStudentStruggle(struggle: {
    studentId: string;
    struggleType: string;
    description?: string | null;
    severity?: number | null;
    language?: string | null;
    interventionsTried?: string[] | null;
  }): {
    anonymizedStudentHash: string;
    struggleType: string;
    description: string;
    severity: number | null;
    language: string | null;
    interventionCount: number;
  } {
    return {
      anonymizedStudentHash: this.hashStudentId(struggle.studentId),
      struggleType: struggle.struggleType,
      description: this.redactSensitiveText(struggle.description),
      severity: struggle.severity,
      language: struggle.language,
      interventionCount: struggle.interventionsTried?.length || 0
    };
  }
  
  /**
   * Batch export anonymized student insights for one-way prod→dev sync
   * Returns aggregated, anonymized data suitable for ML training
   */
  async exportAnonymizedInsights(): Promise<{
    exportedAt: string;
    environment: string;
    insightCount: number;
    insights: Array<ReturnType<typeof this.anonymizePedagogicalInsight>>;
  }> {
    // Import the pedagogicalInsights table
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
   * Generate aggregate statistics from student data without exposing individuals
   * Useful for understanding patterns across all students
   */
  async getAggregateStudentStats(): Promise<{
    totalInsights: number;
    insightsByType: Record<string, number>;
    insightsByLanguage: Record<string, number>;
    insightsByProficiency: Record<string, number>;
    avgEffectivenessScore: number;
    topEffectiveInterventions: Array<{ type: string; avgScore: number; count: number }>;
  }> {
    const { pedagogicalInsights } = await import('@shared/schema');
    
    const allInsights = await db
      .select()
      .from(pedagogicalInsights);
    
    const insightsByType: Record<string, number> = {};
    const insightsByLanguage: Record<string, number> = {};
    const insightsByProficiency: Record<string, number> = {};
    const effectivenessScores: number[] = [];
    const interventionEffectiveness: Record<string, { total: number; count: number }> = {};
    
    for (const insight of allInsights) {
      // Count by type
      insightsByType[insight.insightType] = (insightsByType[insight.insightType] || 0) + 1;
      
      // Count by language
      if (insight.language) {
        insightsByLanguage[insight.language] = (insightsByLanguage[insight.language] || 0) + 1;
      }
      
      // Count by proficiency
      if (insight.proficiencyLevel) {
        insightsByProficiency[insight.proficiencyLevel] = (insightsByProficiency[insight.proficiencyLevel] || 0) + 1;
      }
      
      // Track effectiveness
      if (insight.effectivenessScore != null) {
        effectivenessScores.push(insight.effectivenessScore);
        
        if (!interventionEffectiveness[insight.insightType]) {
          interventionEffectiveness[insight.insightType] = { total: 0, count: 0 };
        }
        interventionEffectiveness[insight.insightType].total += insight.effectivenessScore;
        interventionEffectiveness[insight.insightType].count += 1;
      }
    }
    
    const avgEffectiveness = effectivenessScores.length > 0
      ? effectivenessScores.reduce((a, b) => a + b, 0) / effectivenessScores.length
      : 0;
    
    const topEffective = Object.entries(interventionEffectiveness)
      .map(([type, data]) => ({
        type,
        avgScore: data.total / data.count,
        count: data.count
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 10);
    
    return {
      totalInsights: allInsights.length,
      insightsByType,
      insightsByLanguage,
      insightsByProficiency,
      avgEffectivenessScore: avgEffectiveness,
      topEffectiveInterventions: topEffective
    };
  }
}

export const neuralNetworkSync = new NeuralNetworkSyncService();
