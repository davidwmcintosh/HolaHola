import { db } from "../db";
import { 
  wrenCommitments, 
  InsertWrenCommitment, 
  WrenCommitment 
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";

type CommitmentStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
type CommitmentType = 'feature_sprint' | 'documentation' | 'analysis' | 'implementation' | 'investigation' | 'review' | 'general';
type CommitmentPriority = 'urgent' | 'high' | 'normal' | 'low';

interface CreateCommitmentParams {
  task: string;
  description?: string;
  commitmentType?: CommitmentType;
  priority?: CommitmentPriority;
  sourceSessionId?: string;
  sourceMessageId?: string;
  requestedBy?: string;
  estimatedEffort?: string;
  dueBy?: Date;
  metadata?: {
    originalRequest?: string;
    wrenResponse?: string;
  };
}

class WrenCommitmentsService {
  async createCommitment(params: CreateCommitmentParams): Promise<WrenCommitment> {
    const commitment: InsertWrenCommitment = {
      task: params.task,
      description: params.description,
      commitmentType: params.commitmentType || 'general',
      priority: params.priority || 'normal',
      status: 'pending',
      sourceSessionId: params.sourceSessionId,
      sourceMessageId: params.sourceMessageId,
      requestedBy: params.requestedBy || 'founder',
      assignedTo: 'agent_wren',
      estimatedEffort: params.estimatedEffort,
      dueBy: params.dueBy,
      metadata: params.metadata,
    };

    const [result] = await db.insert(wrenCommitments)
      .values([commitment as any])
      .returning();

    console.log(`[Wren Commitments] Created commitment: "${params.task}" (${params.commitmentType || 'general'})`);
    return result;
  }

  async getPendingCommitments(): Promise<WrenCommitment[]> {
    return db.select()
      .from(wrenCommitments)
      .where(
        inArray(wrenCommitments.status, ['pending', 'in_progress'])
      )
      .orderBy(
        sql`CASE 
          WHEN ${wrenCommitments.priority} = 'urgent' THEN 1
          WHEN ${wrenCommitments.priority} = 'high' THEN 2
          WHEN ${wrenCommitments.priority} = 'normal' THEN 3
          WHEN ${wrenCommitments.priority} = 'low' THEN 4
          ELSE 5
        END`,
        desc(wrenCommitments.createdAt)
      );
  }

  async getCommitmentsByStatus(status: CommitmentStatus): Promise<WrenCommitment[]> {
    return db.select()
      .from(wrenCommitments)
      .where(eq(wrenCommitments.status, status))
      .orderBy(desc(wrenCommitments.createdAt));
  }

  async getRecentCommitments(limit: number = 20): Promise<WrenCommitment[]> {
    return db.select()
      .from(wrenCommitments)
      .orderBy(desc(wrenCommitments.createdAt))
      .limit(limit);
  }

  async markInProgress(
    commitmentId: string, 
    progressNotes?: string
  ): Promise<WrenCommitment | null> {
    const [result] = await db.update(wrenCommitments)
      .set({
        status: 'in_progress',
        startedAt: new Date(),
        progressNotes,
        updatedAt: new Date(),
      })
      .where(eq(wrenCommitments.id, commitmentId))
      .returning();

    if (result) {
      console.log(`[Wren Commitments] Started: "${result.task}"`);
    }
    return result || null;
  }

  async markComplete(
    commitmentId: string,
    completionResult: string,
    relatedEntityType?: string,
    relatedEntityId?: string
  ): Promise<WrenCommitment | null> {
    const [result] = await db.update(wrenCommitments)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completionResult,
        relatedEntityType,
        relatedEntityId,
        updatedAt: new Date(),
      })
      .where(eq(wrenCommitments.id, commitmentId))
      .returning();

    if (result) {
      console.log(`[Wren Commitments] Completed: "${result.task}"`);
    }
    return result || null;
  }

  async markFailed(
    commitmentId: string,
    failureReason: string
  ): Promise<WrenCommitment | null> {
    const commitment = await this.getById(commitmentId);
    if (!commitment) return null;

    const metadata = (commitment.metadata || {}) as Record<string, unknown>;
    metadata.failureReason = failureReason;
    metadata.retryCount = ((metadata.retryCount as number) || 0) + 1;

    const [result] = await db.update(wrenCommitments)
      .set({
        status: 'failed',
        completedAt: new Date(),
        metadata: metadata as any,
        updatedAt: new Date(),
      })
      .where(eq(wrenCommitments.id, commitmentId))
      .returning();

    if (result) {
      console.log(`[Wren Commitments] Failed: "${result.task}" - ${failureReason}`);
    }
    return result || null;
  }

  async markCancelled(
    commitmentId: string,
    reason?: string
  ): Promise<WrenCommitment | null> {
    const [result] = await db.update(wrenCommitments)
      .set({
        status: 'cancelled',
        progressNotes: reason ? `Cancelled: ${reason}` : 'Cancelled',
        updatedAt: new Date(),
      })
      .where(eq(wrenCommitments.id, commitmentId))
      .returning();

    if (result) {
      console.log(`[Wren Commitments] Cancelled: "${result.task}"`);
    }
    return result || null;
  }

  async getById(commitmentId: string): Promise<WrenCommitment | null> {
    const [result] = await db.select()
      .from(wrenCommitments)
      .where(eq(wrenCommitments.id, commitmentId))
      .limit(1);
    return result || null;
  }

  async getCommitmentsSummary(): Promise<{
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    cancelled: number;
  }> {
    const results = await db.select({
      status: wrenCommitments.status,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(wrenCommitments)
    .groupBy(wrenCommitments.status);

    const summary = {
      pending: 0,
      inProgress: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };

    for (const row of results) {
      switch (row.status) {
        case 'pending': summary.pending = row.count; break;
        case 'in_progress': summary.inProgress = row.count; break;
        case 'completed': summary.completed = row.count; break;
        case 'failed': summary.failed = row.count; break;
        case 'cancelled': summary.cancelled = row.count; break;
      }
    }

    return summary;
  }

  async getForAgentWren(): Promise<{
    actionable: WrenCommitment[];
    summary: string;
  }> {
    const pending = await this.getPendingCommitments();
    
    let summary = '';
    if (pending.length === 0) {
      summary = 'No pending commitments in the queue.';
    } else {
      const urgent = pending.filter(c => c.priority === 'urgent');
      const high = pending.filter(c => c.priority === 'high');
      
      summary = `${pending.length} pending commitments. `;
      if (urgent.length > 0) {
        summary += `${urgent.length} URGENT. `;
      }
      if (high.length > 0) {
        summary += `${high.length} high priority. `;
      }
      summary += `Next: "${pending[0].task}"`;
    }

    return {
      actionable: pending,
      summary,
    };
  }
}

export const wrenCommitmentsService = new WrenCommitmentsService();
