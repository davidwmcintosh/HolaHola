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
}

export const neuralNetworkSync = new NeuralNetworkSyncService();
