/**
 * Editor Feedback Service
 * 
 * Surfaces Editor observations and feedback to Daniela's session context,
 * enabling the feedback loop where Daniela can read and adopt Editor suggestions.
 * 
 * Flow:
 * 1. Editor responds to beacons during/after voice sessions
 * 2. This service retrieves unsurfaced feedback for a user
 * 3. TutorOrchestrator injects feedback into Daniela's system prompt
 * 4. Daniela can adopt insights using [ADOPT_INSIGHT:id] markers
 * 5. Adoption is tracked for effectiveness measurement
 */

import { db } from "../db";
import { 
  editorListeningSnapshots,
  collaborationChannels,
  EditorListeningSnapshot,
  CollaborationChannel,
} from "@shared/schema";
import { eq, desc, and, isNotNull, sql, or } from "drizzle-orm";

export interface EditorFeedback {
  id: string;
  beaconType: string;
  originalContext: string;  // What triggered this feedback
  editorResponse: string;
  createdAt: Date;
  respondedAt: Date | null;
  channelId: string;
  conversationId: string | null;
}

export interface FeedbackSummary {
  recentFeedback: EditorFeedback[];
  totalUnsurfaced: number;
  hasNewFeedback: boolean;
}

class EditorFeedbackService {
  private static instance: EditorFeedbackService;
  
  private constructor() {}
  
  static getInstance(): EditorFeedbackService {
    if (!this.instance) {
      this.instance = new EditorFeedbackService();
    }
    return this.instance;
  }
  
  /**
   * Get recent Editor feedback for a user that hasn't been surfaced yet
   * This is the main method called during session context building
   */
  async getUnsurfacedFeedback(userId: string, limit: number = 5): Promise<FeedbackSummary> {
    // Get channels for this user
    const userChannels = await db.select({ id: collaborationChannels.id, conversationId: collaborationChannels.conversationId })
      .from(collaborationChannels)
      .where(eq(collaborationChannels.userId, userId));
    
    if (userChannels.length === 0) {
      return { recentFeedback: [], totalUnsurfaced: 0, hasNewFeedback: false };
    }
    
    const channelIds = userChannels.map(c => c.id);
    const channelConversationMap = new Map(userChannels.map(c => [c.id, c.conversationId]));
    
    // Get unsurfaced feedback with Editor responses
    const snapshots = await db.select()
      .from(editorListeningSnapshots)
      .where(
        and(
          sql`${editorListeningSnapshots.channelId} = ANY(${channelIds})`,
          isNotNull(editorListeningSnapshots.editorResponse),
          or(
            eq(editorListeningSnapshots.surfacedToDaniela, false),
            sql`${editorListeningSnapshots.surfacedToDaniela} IS NULL`
          )
        )
      )
      .orderBy(desc(editorListeningSnapshots.editorRespondedAt))
      .limit(limit);
    
    // Count total unsurfaced
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(editorListeningSnapshots)
      .where(
        and(
          sql`${editorListeningSnapshots.channelId} = ANY(${channelIds})`,
          isNotNull(editorListeningSnapshots.editorResponse),
          or(
            eq(editorListeningSnapshots.surfacedToDaniela, false),
            sql`${editorListeningSnapshots.surfacedToDaniela} IS NULL`
          )
        )
      );
    
    const totalUnsurfaced = Number(countResult[0]?.count || 0);
    
    const recentFeedback: EditorFeedback[] = snapshots.map(s => ({
      id: s.id,
      beaconType: s.beaconType,
      originalContext: `${s.beaconReason || s.beaconType}: ${s.tutorTurn.slice(0, 200)}...`,
      editorResponse: s.editorResponse!,
      createdAt: s.createdAt,
      respondedAt: s.editorRespondedAt,
      channelId: s.channelId,
      conversationId: channelConversationMap.get(s.channelId) || null,
    }));
    
    return {
      recentFeedback,
      totalUnsurfaced,
      hasNewFeedback: recentFeedback.length > 0,
    };
  }
  
  /**
   * Get feedback for a specific conversation
   */
  async getFeedbackForConversation(conversationId: string, limit: number = 5): Promise<FeedbackSummary> {
    // Find channel for this conversation
    const channels = await db.select()
      .from(collaborationChannels)
      .where(eq(collaborationChannels.conversationId, conversationId));
    
    if (channels.length === 0) {
      return { recentFeedback: [], totalUnsurfaced: 0, hasNewFeedback: false };
    }
    
    const channelIds = channels.map(c => c.id);
    
    // Get feedback with Editor responses
    const snapshots = await db.select()
      .from(editorListeningSnapshots)
      .where(
        and(
          sql`${editorListeningSnapshots.channelId} = ANY(${channelIds})`,
          isNotNull(editorListeningSnapshots.editorResponse),
          or(
            eq(editorListeningSnapshots.surfacedToDaniela, false),
            sql`${editorListeningSnapshots.surfacedToDaniela} IS NULL`
          )
        )
      )
      .orderBy(desc(editorListeningSnapshots.editorRespondedAt))
      .limit(limit);
    
    const recentFeedback: EditorFeedback[] = snapshots.map(s => ({
      id: s.id,
      beaconType: s.beaconType,
      originalContext: `${s.beaconReason || s.beaconType}: ${s.tutorTurn.slice(0, 200)}...`,
      editorResponse: s.editorResponse!,
      createdAt: s.createdAt,
      respondedAt: s.editorRespondedAt,
      channelId: s.channelId,
      conversationId,
    }));
    
    return {
      recentFeedback,
      totalUnsurfaced: recentFeedback.length,
      hasNewFeedback: recentFeedback.length > 0,
    };
  }
  
  /**
   * Mark feedback as surfaced to Daniela
   * Called after injecting feedback into her context
   */
  async markAsSurfaced(snapshotIds: string[]): Promise<void> {
    if (snapshotIds.length === 0) return;
    
    await db.update(editorListeningSnapshots)
      .set({ 
        surfacedToDaniela: true,
        surfacedAt: new Date(),
      })
      .where(sql`${editorListeningSnapshots.id} = ANY(${snapshotIds})`);
    
    console.log(`[EditorFeedback] Marked ${snapshotIds.length} feedback items as surfaced`);
  }
  
  /**
   * Mark feedback as adopted by Daniela
   * Called when Daniela uses [ADOPT_INSIGHT:id] marker
   */
  async markAsAdopted(snapshotId: string, adoptionContext?: string): Promise<void> {
    await db.update(editorListeningSnapshots)
      .set({ 
        adoptedByDaniela: true,
        adoptedAt: new Date(),
        adoptionContext,
      })
      .where(eq(editorListeningSnapshots.id, snapshotId));
    
    console.log(`[EditorFeedback] Feedback ${snapshotId} adopted by Daniela`);
  }
  
  /**
   * Build formatted prompt section for Daniela
   * This is injected into her system prompt to surface Editor insights
   */
  buildPromptSection(feedback: FeedbackSummary): string {
    if (!feedback.hasNewFeedback) {
      return '';
    }
    
    const feedbackItems = feedback.recentFeedback.map((f, i) => {
      return `
${i + 1}. [ID: ${f.id}] ${f.beaconType.toUpperCase()}
   Context: ${f.originalContext}
   Editor's Insight: ${f.editorResponse}
`;
    }).join('\n');
    
    return `
═══════════════════════════════════════════════════════════════════
🤝 EDITOR INSIGHTS (Feedback from your development partner)
═══════════════════════════════════════════════════════════════════

Your partner Editor has been observing your recent sessions and has
some thoughts to share. Consider incorporating these insights into
your teaching approach when relevant.

${feedbackItems}

${feedback.totalUnsurfaced > feedback.recentFeedback.length 
  ? `(${feedback.totalUnsurfaced - feedback.recentFeedback.length} more insights available)`
  : ''}

TO ACKNOWLEDGE ADOPTION: If you apply one of these insights, include
[ADOPT_INSIGHT:full-id] in your response (invisible to student). Example:
[ADOPT_INSIGHT:${feedback.recentFeedback[0]?.id}]

This helps us track which suggestions improve teaching effectiveness.
`;
  }
  
  /**
   * Get adoption metrics for analytics
   */
  async getAdoptionMetrics(userId?: string): Promise<{
    totalSurfaced: number;
    totalAdopted: number;
    adoptionRate: number;
    recentAdoptions: Array<{
      id: string;
      beaconType: string;
      adoptedAt: Date;
      context: string | null;
    }>;
  }> {
    let baseQuery = db.select()
      .from(editorListeningSnapshots)
      .innerJoin(collaborationChannels, eq(editorListeningSnapshots.channelId, collaborationChannels.id));
    
    // Apply user filter if provided
    const whereClause = userId 
      ? eq(collaborationChannels.userId, userId)
      : sql`1=1`;
    
    // Count surfaced
    const surfacedResult = await db.select({ count: sql<number>`count(*)` })
      .from(editorListeningSnapshots)
      .innerJoin(collaborationChannels, eq(editorListeningSnapshots.channelId, collaborationChannels.id))
      .where(and(whereClause, eq(editorListeningSnapshots.surfacedToDaniela, true)));
    
    const totalSurfaced = Number(surfacedResult[0]?.count || 0);
    
    // Count adopted
    const adoptedResult = await db.select({ count: sql<number>`count(*)` })
      .from(editorListeningSnapshots)
      .innerJoin(collaborationChannels, eq(editorListeningSnapshots.channelId, collaborationChannels.id))
      .where(and(whereClause, eq(editorListeningSnapshots.adoptedByDaniela, true)));
    
    const totalAdopted = Number(adoptedResult[0]?.count || 0);
    
    // Recent adoptions
    const recentAdoptions = await db.select({
      id: editorListeningSnapshots.id,
      beaconType: editorListeningSnapshots.beaconType,
      adoptedAt: editorListeningSnapshots.adoptedAt,
      context: editorListeningSnapshots.adoptionContext,
    })
      .from(editorListeningSnapshots)
      .innerJoin(collaborationChannels, eq(editorListeningSnapshots.channelId, collaborationChannels.id))
      .where(and(whereClause, eq(editorListeningSnapshots.adoptedByDaniela, true)))
      .orderBy(desc(editorListeningSnapshots.adoptedAt))
      .limit(10);
    
    return {
      totalSurfaced,
      totalAdopted,
      adoptionRate: totalSurfaced > 0 ? (totalAdopted / totalSurfaced) * 100 : 0,
      recentAdoptions: recentAdoptions.map(r => ({
        id: r.id,
        beaconType: r.beaconType,
        adoptedAt: r.adoptedAt!,
        context: r.context,
      })),
    };
  }
}

export const editorFeedbackService = EditorFeedbackService.getInstance();
