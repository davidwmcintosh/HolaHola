/**
 * Hive Collaboration Service
 * 
 * Orchestrates Daniela ↔ Editor collaboration:
 * - Daniela's domain: The classroom. Teaching. Using the tools.
 * - Editor's domain: Building. Development. Creating tools Daniela needs.
 * - Collaboration zone: Capability gaps, tool requests, feature ideas.
 * 
 * Philosophy: Separate domains with a collaboration interface.
 * The Editor doesn't observe teaching - the Editor responds to what Daniela needs.
 */

import { db, getUserDb } from "../db";
import { 
  collaborationChannels,
  editorListeningSnapshots,
  collaborationEvents,
  editorBeaconQueue,
  InsertCollaborationChannel,
  InsertEditorListeningSnapshot,
  CollaborationChannel,
  EditorListeningSnapshot,
  InsertCollaborationEvent,
  InsertEditorBeaconQueue
} from "@shared/schema";
import { eq, desc, and, sql, isNull } from "drizzle-orm";
import { collaborationHubService } from "./collaboration-hub-service";

// Beacon types for Daniela ↔ Editor collaboration
// These are NOT teaching observations - they're collaboration signals
export type BeaconType = 
  // Collaboration beacons (Daniela → Editor)
  | 'capability_gap'         // "I tried to do X but couldn't" - missing tool/feature
  | 'tool_request'           // "A tool for Y would help here" - feature idea
  | 'friction_report'        // "This workflow is clunky" - UX/flow issue
  | 'feature_idea'           // "What if we had..." - enhancement suggestion
  | 'self_surgery_proposal'  // Daniela proposes neural network modification
  | 'knowledge_gap'          // "I don't know how to handle X" - needs procedure/knowledge
  | 'bug_report'             // "Something isn't working right" - technical issue
  // Teaching observations (Daniela → Founder for office hours)
  | 'teaching_observation'   // "I noticed X worth discussing" - lightweight insight for later
  // Support beacons (Sofia → Editor)
  | 'support_handoff'        // Daniela handed off to Sofia
  | 'tech_issue_reported'    // User reported a technical issue
  | 'hardware_diagnosed'     // Sofia diagnosed mic/audio/device issue
  | 'support_escalation'     // Issue escalated to founder/human
  | 'support_resolution'     // Issue successfully resolved
  | 'support_return';        // User returned to Daniela from Sofia

interface CreateChannelParams {
  conversationId: string;
  userId: string;
  targetLanguage?: string;
  studentLevel?: string;
  sessionTopic?: string;
}

interface EmitBeaconParams {
  channelId: string;
  tutorTurn: string;
  studentTurn?: string;
  beaconType: BeaconType;
  beaconReason?: string;
  conversationHistory?: Array<{role: string, content: string}>; // Last N turns for deeper context
}

class HiveCollaborationService {
  private activeChannels: Map<string, CollaborationChannel> = new Map();
  
  // ============================================================================
  // CHANNEL LIFECYCLE
  // ============================================================================
  
  /**
   * Create a new collaboration channel when voice session starts
   */
  async createChannel(params: CreateChannelParams): Promise<CollaborationChannel> {
    const channelData: InsertCollaborationChannel = {
      conversationId: params.conversationId,
      userId: params.userId,
      sessionPhase: 'active',
      targetLanguage: params.targetLanguage,
      studentLevel: params.studentLevel,
      sessionTopic: params.sessionTopic,
      heartbeatAt: new Date(),
    };
    
    const [channel] = await getUserDb().insert(collaborationChannels)
      .values(channelData as any)
      .returning();
    
    this.activeChannels.set(channel.id, channel);
    
    console.log(`[Hive] Channel created: ${channel.id} for conversation ${params.conversationId}`);
    
    // Emit system notification
    await collaborationHubService.emitDanielaInsight({
      content: `Voice session started. Ready for collaboration signals...`,
      summary: `Voice session started (${params.targetLanguage || 'language'})`,
      conversationId: params.conversationId,
      targetLanguage: params.targetLanguage,
      teachingContext: params.sessionTopic,
    });
    
    return channel;
  }
  
  /**
   * Get or create channel for a conversation
   */
  async getOrCreateChannel(params: CreateChannelParams): Promise<CollaborationChannel> {
    // Check for existing active channel
    const existing = await getUserDb().select()
      .from(collaborationChannels)
      .where(
        and(
          eq(collaborationChannels.conversationId, params.conversationId),
          eq(collaborationChannels.sessionPhase, 'active')
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update heartbeat
      await this.heartbeat(existing[0].id);
      return existing[0];
    }
    
    return this.createChannel(params);
  }
  
  /**
   * Update channel heartbeat (Editor pings to show listening)
   */
  async heartbeat(channelId: string): Promise<void> {
    await getUserDb().update(collaborationChannels)
      .set({ heartbeatAt: new Date() })
      .where(eq(collaborationChannels.id, channelId));
  }
  
  /**
   * Transition channel to post_session mode (after hang-up)
   */
  async endSession(channelId: string): Promise<CollaborationChannel> {
    const [updated] = await getUserDb().update(collaborationChannels)
      .set({ 
        sessionPhase: 'post_session',
        endedAt: new Date(),
      })
      .where(eq(collaborationChannels.id, channelId))
      .returning();
    
    this.activeChannels.delete(channelId);
    
    console.log(`[Hive] Channel ${channelId} transitioned to post_session`);
    
    // Emit event for post-session continuation
    await collaborationHubService.emitDanielaInsight({
      content: `Voice session ended. Ready for post-session reflection with Editor.`,
      summary: 'Voice session ended - entering reflection mode',
      teachingContext: `Channel ${channelId} now in post_session phase`,
    });
    
    return updated;
  }
  
  /**
   * Complete channel with summary
   */
  async completeChannel(channelId: string, summary: {
    keyInsights?: string[];
    actionItems?: string[];
    editorNotes?: string[];
    teachingObservations?: string[];
  }): Promise<CollaborationChannel> {
    const [updated] = await getUserDb().update(collaborationChannels)
      .set({ 
        sessionPhase: 'completed',
        summaryJson: summary,
      })
      .where(eq(collaborationChannels.id, channelId))
      .returning();
    
    console.log(`[Hive] Channel ${channelId} completed with summary`);
    
    return updated;
  }
  
  // ============================================================================
  // BEACON EMISSION (Teaching Moment Flagging)
  // ============================================================================
  
  /**
   * Emit a "hive beacon" - flag an interesting teaching moment for Editor
   * Also enqueues the beacon for real-time processing by the dispatcher
   */
  async emitBeacon(params: EmitBeaconParams): Promise<EditorListeningSnapshot> {
    const snapshotData: InsertEditorListeningSnapshot = {
      channelId: params.channelId,
      tutorTurn: params.tutorTurn,
      studentTurn: params.studentTurn,
      beaconType: params.beaconType,
      beaconReason: params.beaconReason,
      conversationHistory: params.conversationHistory,
    };
    
    const [snapshot] = await getUserDb().insert(editorListeningSnapshots)
      .values(snapshotData as any)
      .returning();
    
    console.log(`[Hive] Beacon emitted: ${params.beaconType} in channel ${params.channelId}`);
    
    // Enqueue for real-time processing by the dispatcher
    await this.enqueueBeaconForProcessing(snapshot.id);
    
    // Also emit to collaboration hub for real-time feed
    await this.emitBeaconToHub(params.channelId, snapshot);
    
    return snapshot;
  }
  
  /**
   * Enqueue a beacon for real-time processing (idempotent - skips duplicates)
   */
  private async enqueueBeaconForProcessing(snapshotId: string): Promise<void> {
    try {
      // Check if already queued to avoid duplicates
      const existing = await getUserDb().select({ id: editorBeaconQueue.id })
        .from(editorBeaconQueue)
        .where(eq(editorBeaconQueue.snapshotId, snapshotId))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`[Hive] Beacon already queued: ${snapshotId}`);
        return;
      }
      
      const queueEntry: InsertEditorBeaconQueue = {
        snapshotId,
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
      };
      
      await getUserDb().insert(editorBeaconQueue)
        .values(queueEntry);
      
      console.log(`[Hive] Beacon queued for processing: ${snapshotId}`);
    } catch (error) {
      // Don't fail the beacon emission if queueing fails
      console.error(`[Hive] Failed to queue beacon ${snapshotId}:`, error);
    }
  }
  
  /**
   * Helper: Emit beacon as collaboration event for real-time feed
   */
  private async emitBeaconToHub(channelId: string, snapshot: EditorListeningSnapshot): Promise<void> {
    const channel = await getUserDb().select()
      .from(collaborationChannels)
      .where(eq(collaborationChannels.id, channelId))
      .limit(1);
    
    if (!channel[0]) return;
    
    const event: InsertCollaborationEvent = {
      eventType: 'daniela_insight',
      senderRole: 'daniela',
      content: this.formatBeaconContent(snapshot),
      summary: `${snapshot.beaconType}: ${snapshot.tutorTurn.slice(0, 80)}...`,
      metadata: {
        conversationId: channel[0].conversationId ?? undefined,
        targetLanguage: channel[0].targetLanguage ?? undefined,
        studentLevel: channel[0].studentLevel ?? undefined,
        channelId,
        phase: channel[0].sessionPhase as 'active' | 'post_session' | 'completed',
        visibility: 'founder_only',
        snapshotId: snapshot.id,
      },
    };
    
    await getUserDb().insert(collaborationEvents)
      .values(event as any)
      .returning();
  }
  
  /**
   * Format beacon content for display
   */
  private formatBeaconContent(snapshot: EditorListeningSnapshot): string {
    const typeLabels: Record<BeaconType, string> = {
      // Collaboration beacons (Daniela → Editor)
      capability_gap: '🔧 Capability Gap',
      tool_request: '🛠️ Tool Request',
      friction_report: '⚡ Friction Report',
      feature_idea: '💡 Feature Idea',
      self_surgery_proposal: '🧠 Self-Surgery Proposal',
      knowledge_gap: '📚 Knowledge Gap',
      bug_report: '🐛 Bug Report',
      // Teaching observations (Daniela → Founder)
      teaching_observation: '📝 Teaching Observation',
      // Support beacons (Sofia)
      support_handoff: '🔀 Support Handoff',
      tech_issue_reported: '🔧 Tech Issue Reported',
      hardware_diagnosed: '🎤 Hardware Diagnosed',
      support_escalation: '🚨 Escalation Needed',
      support_resolution: '✅ Issue Resolved',
      support_return: '↩️ Returned to Tutor',
    };
    
    const label = typeLabels[snapshot.beaconType as BeaconType] || '💡 Insight';
    
    let content = `${label}\n\n`;
    content += `**Tutor:** ${snapshot.tutorTurn}\n`;
    if (snapshot.studentTurn) {
      content += `**Student:** ${snapshot.studentTurn}\n`;
    }
    if (snapshot.beaconReason) {
      content += `\n*Reason:* ${snapshot.beaconReason}`;
    }
    
    return content;
  }
  
  // ============================================================================
  // QUERIES
  // ============================================================================
  
  /**
   * Get channel by ID
   */
  async getChannel(channelId: string): Promise<CollaborationChannel | null> {
    const [channel] = await getUserDb().select()
      .from(collaborationChannels)
      .where(eq(collaborationChannels.id, channelId));
    return channel || null;
  }
  
  /**
   * Get active channel for conversation
   */
  async getActiveChannelForConversation(conversationId: string): Promise<CollaborationChannel | null> {
    const [channel] = await getUserDb().select()
      .from(collaborationChannels)
      .where(
        and(
          eq(collaborationChannels.conversationId, conversationId),
          eq(collaborationChannels.sessionPhase, 'active')
        )
      );
    return channel || null;
  }
  
  /**
   * Get snapshots for a channel
   */
  async getChannelSnapshots(channelId: string): Promise<EditorListeningSnapshot[]> {
    return getUserDb().select()
      .from(editorListeningSnapshots)
      .where(eq(editorListeningSnapshots.channelId, channelId))
      .orderBy(editorListeningSnapshots.createdAt);
  }
  
  /**
   * Get unanswered snapshots for Editor to respond to
   * @param channelId - Optional channel filter
   * @param limit - Max snapshots to return (default 20, for throttling)
   */
  async getPendingSnapshots(channelId?: string, limit: number = 20): Promise<EditorListeningSnapshot[]> {
    const conditions = [isNull(editorListeningSnapshots.editorResponse)];
    if (channelId) {
      conditions.push(eq(editorListeningSnapshots.channelId, channelId));
    }
    
    return getUserDb().select()
      .from(editorListeningSnapshots)
      .where(and(...conditions))
      .orderBy(editorListeningSnapshots.createdAt)
      .limit(limit);
  }
  
  /**
   * Record Editor's response to a snapshot
   */
  async recordEditorResponse(snapshotId: string, response: string): Promise<EditorListeningSnapshot> {
    const [updated] = await getUserDb().update(editorListeningSnapshots)
      .set({ 
        editorResponse: response,
        editorRespondedAt: new Date(),
      })
      .where(eq(editorListeningSnapshots.id, snapshotId))
      .returning();
    
    console.log(`[Hive] Editor responded to snapshot ${snapshotId}`);
    
    return updated;
  }
  
  /**
   * Get recent channels for a user (for feed display)
   */
  async getUserChannels(userId: string, limit: number = 10): Promise<CollaborationChannel[]> {
    return getUserDb().select()
      .from(collaborationChannels)
      .where(eq(collaborationChannels.userId, userId))
      .orderBy(desc(collaborationChannels.startedAt))
      .limit(limit);
  }
  
  /**
   * Get post-session channels waiting for Editor continuation
   * @param limit - Max channels to return (default 10, for throttling)
   */
  async getPostSessionChannels(limit: number = 10): Promise<CollaborationChannel[]> {
    return getUserDb().select()
      .from(collaborationChannels)
      .where(eq(collaborationChannels.sessionPhase, 'post_session'))
      .orderBy(collaborationChannels.endedAt)
      .limit(limit);
  }
  
  /**
   * Get feed events for a specific channel
   */
  async getChannelFeed(channelId: string, limit: number = 50): Promise<any[]> {
    return getUserDb().select()
      .from(collaborationEvents)
      .where(sql`${collaborationEvents.metadata}->>'channelId' = ${channelId}`)
      .orderBy(desc(collaborationEvents.createdAt))
      .limit(limit);
  }
}

// Singleton instance
export const hiveCollaborationService = new HiveCollaborationService();
