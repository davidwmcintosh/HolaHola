/**
 * Founder Collaboration Service
 * 
 * Enables persistent conversation with Daniela across dev restarts.
 * Uses cursor-based resume for seamless reconnection after server restarts.
 * 
 * Key Features:
 * - Session lifecycle management (create, pause, resume, complete)
 * - Persistent message storage with unique cursors
 * - Client sync cursor tracking for message replay on reconnect
 * - Cross-environment sync (dev ↔ prod via shared database)
 * 
 * ARCHITECTURE NOTE: Cross-Environment Sync
 * ==========================================
 * Development and production environments share the SAME PostgreSQL database.
 * This means cross-environment sync is AUTOMATIC - messages written in dev
 * are immediately visible in prod and vice versa.
 * 
 * The `synced` flag on messages is used for WebSocket real-time push tracking:
 * - false = message hasn't been pushed to connected WebSocket clients yet
 * - true = message was delivered to at least one connected client
 * 
 * The `environment` field tracks WHERE the message originated (dev vs prod),
 * which helps with debugging and audit trails.
 */

import { getSharedDb, getUserDb } from "../db";
import { 
  founderSessions, 
  collaborationMessages, 
  syncCursors,
  type FounderSession,
  type CollaborationMessage,
  type SyncCursor,
  type InsertFounderSession,
  type InsertCollaborationMessage,
  type InsertSyncCursor
} from "@shared/schema";
import { eq, desc, and, gt, sql, isNull } from "drizzle-orm";
import { wrenIntelligenceService } from "./wren-intelligence-service";

const CURRENT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

export interface FounderMessageInput {
  role: 'founder' | 'daniela' | 'editor' | 'system' | 'wren';
  content: string;
  messageType?: 'text' | 'voice';
  audioUrl?: string;
  audioDuration?: number;
  metadata?: Record<string, any>;
}

export interface MessageReplayResult {
  messages: CollaborationMessage[];
  lastCursor: string | null;
  hasMore: boolean;
}

class FounderCollaborationService {
  
  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================
  
  /**
   * Create a new founder collaboration session
   */
  async createSession(founderId: string, title?: string): Promise<FounderSession> {
    const [session] = await getSharedDb().insert(founderSessions).values({
      founderId,
      environment: CURRENT_ENVIRONMENT,
      title: title || `Collaboration ${new Date().toLocaleDateString()}`,
      status: 'active',
      messageCount: 0,
    }).returning();
    
    console.log(`[FounderCollab] Created session ${session.id} for founder ${founderId}`);
    return session;
  }
  
  /**
   * Get or create the active session for a founder
   * Returns the session with the most recent message activity, or creates a new one
   * This ensures the user lands in the conversation they were last active in
   */
  async getOrCreateActiveSession(founderId: string): Promise<FounderSession> {
    // Find active sessions ordered by last message activity (not creation date)
    const sessionsWithActivity = await getSharedDb().execute(sql`
      SELECT fs.*, 
        COALESCE(
          (SELECT MAX(cm.created_at) FROM collaboration_messages cm WHERE cm.session_id = fs.id),
          fs.created_at
        ) as last_activity
      FROM founder_sessions fs
      WHERE fs.founder_id = ${founderId} AND fs.status = 'active'
      ORDER BY last_activity DESC
      LIMIT 1
    `);
    
    if (sessionsWithActivity.rows && sessionsWithActivity.rows.length > 0) {
      const row = sessionsWithActivity.rows[0] as any;
      return {
        id: row.id,
        founderId: row.founder_id,
        environment: row.environment,
        title: row.title,
        status: row.status,
        messageCount: row.message_count,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } as FounderSession;
    }
    
    return this.createSession(founderId);
  }
  
  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<FounderSession | null> {
    const [session] = await getSharedDb().select()
      .from(founderSessions)
      .where(eq(founderSessions.id, sessionId))
      .limit(1);
    
    return session || null;
  }
  
  /**
   * Get all sessions for a founder
   */
  async getFounderSessions(founderId: string, limit = 20): Promise<FounderSession[]> {
    return getSharedDb().select()
      .from(founderSessions)
      .where(eq(founderSessions.founderId, founderId))
      .orderBy(desc(founderSessions.updatedAt))
      .limit(limit);
  }
  
  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string, 
    status: 'active' | 'paused' | 'completed'
  ): Promise<FounderSession | null> {
    const [updated] = await getSharedDb().update(founderSessions)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(eq(founderSessions.id, sessionId))
      .returning();
    
    return updated || null;
  }
  
  /**
   * Pause the current active session (useful when switching context)
   */
  async pauseSession(sessionId: string): Promise<FounderSession | null> {
    return this.updateSessionStatus(sessionId, 'paused');
  }
  
  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<FounderSession | null> {
    return this.updateSessionStatus(sessionId, 'active');
  }
  
  /**
   * Complete/close a session
   */
  async completeSession(sessionId: string): Promise<FounderSession | null> {
    return this.updateSessionStatus(sessionId, 'completed');
  }
  
  // ============================================================================
  // MESSAGE MANAGEMENT
  // ============================================================================
  
  /**
   * Generate a unique, sortable cursor for message ordering
   * Format: timestamp-sequenceNumber (e.g., "1702589432100-0001")
   */
  private async generateCursor(sessionId: string): Promise<string> {
    const timestamp = Date.now();
    
    const [result] = await getSharedDb().select({ 
      count: sql<number>`COUNT(*)` 
    })
      .from(collaborationMessages)
      .where(eq(collaborationMessages.sessionId, sessionId));
    
    const sequence = (result?.count || 0) + 1;
    const paddedSequence = sequence.toString().padStart(6, '0');
    
    return `${timestamp}-${paddedSequence}`;
  }
  
  /**
   * Add a message to a session
   */
  async addMessage(
    sessionId: string,
    input: FounderMessageInput
  ): Promise<CollaborationMessage> {
    const cursor = await this.generateCursor(sessionId);
    
    const [message] = await getSharedDb().insert(collaborationMessages).values({
      sessionId,
      role: input.role,
      messageType: input.messageType || 'text',
      content: input.content,
      audioUrl: input.audioUrl || null,
      audioDuration: input.audioDuration || null,
      metadata: input.metadata || null,
      cursor,
      environment: CURRENT_ENVIRONMENT,
      synced: false,
    }).returning();
    
    await getSharedDb().update(founderSessions)
      .set({ 
        lastCursor: cursor,
        messageCount: sql`${founderSessions.messageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(founderSessions.id, sessionId));
    
    console.log(`[FounderCollab] Message added to session ${sessionId}, cursor: ${cursor}`);
    
    // Extract Wren insights from architectural/debugging discussions (async, non-blocking)
    wrenIntelligenceService.extractExpressLaneInsight({
      content: input.content,
      role: input.role,
      sessionId,
      id: message.id,
    }).catch(err => {
      console.error('[FounderCollab] Insight extraction failed:', err.message);
    });
    
    return message;
  }
  
  /**
   * Get all messages in a session
   */
  async getSessionMessages(
    sessionId: string, 
    limit = 100
  ): Promise<CollaborationMessage[]> {
    return getSharedDb().select()
      .from(collaborationMessages)
      .where(eq(collaborationMessages.sessionId, sessionId))
      .orderBy(collaborationMessages.cursor)
      .limit(limit);
  }
  
  /**
   * Get messages after a specific cursor (for reconnection replay)
   */
  async getMessagesAfterCursor(
    sessionId: string,
    afterCursor: string,
    limit = 100
  ): Promise<MessageReplayResult> {
    const messages = await getSharedDb().select()
      .from(collaborationMessages)
      .where(and(
        eq(collaborationMessages.sessionId, sessionId),
        gt(collaborationMessages.cursor, afterCursor)
      ))
      .orderBy(collaborationMessages.cursor)
      .limit(limit + 1);
    
    const hasMore = messages.length > limit;
    const resultMessages = hasMore ? messages.slice(0, limit) : messages;
    const lastCursor = resultMessages.length > 0 
      ? resultMessages[resultMessages.length - 1].cursor 
      : null;
    
    return {
      messages: resultMessages,
      lastCursor,
      hasMore
    };
  }
  
  /**
   * Get the latest messages (for initial load)
   */
  async getLatestMessages(
    sessionId: string,
    limit = 50
  ): Promise<CollaborationMessage[]> {
    const messages = await getSharedDb().select()
      .from(collaborationMessages)
      .where(eq(collaborationMessages.sessionId, sessionId))
      .orderBy(desc(collaborationMessages.cursor))
      .limit(limit);
    
    return messages.reverse();
  }
  
  /**
   * Get messages tagged for Wren (wrenTagged: true in metadata)
   * Used by Wren to fetch its inbox of pending items from Express Lane
   */
  async getWrenTaggedMessages(
    limit = 50,
    sessionId?: string
  ): Promise<CollaborationMessage[]> {
    const conditions = [
      sql`${collaborationMessages.metadata}->>'wrenTagged' = 'true'`
    ];
    
    if (sessionId) {
      conditions.push(eq(collaborationMessages.sessionId, sessionId));
    }
    
    const messages = await getSharedDb().select()
      .from(collaborationMessages)
      .where(and(...conditions))
      .orderBy(desc(collaborationMessages.createdAt))
      .limit(limit);
    
    return messages;
  }
  
  // ============================================================================
  // CLIENT SYNC CURSOR MANAGEMENT
  // ============================================================================
  
  /**
   * Register a client connection and get/create their sync cursor
   */
  async registerClient(
    clientId: string, 
    sessionId: string
  ): Promise<SyncCursor> {
    const [existing] = await getSharedDb().select()
      .from(syncCursors)
      .where(and(
        eq(syncCursors.clientId, clientId),
        eq(syncCursors.sessionId, sessionId)
      ))
      .limit(1);
    
    if (existing) {
      const [updated] = await getSharedDb().update(syncCursors)
        .set({ 
          connectedAt: new Date(),
          disconnectedAt: null,
          environment: CURRENT_ENVIRONMENT
        })
        .where(eq(syncCursors.id, existing.id))
        .returning();
      
      console.log(`[FounderCollab] Client ${clientId} reconnected, last cursor: ${existing.lastProcessedCursor}`);
      return updated;
    }
    
    const [cursor] = await getSharedDb().insert(syncCursors).values({
      clientId,
      sessionId,
      environment: CURRENT_ENVIRONMENT,
      lastProcessedCursor: null,
    }).returning();
    
    console.log(`[FounderCollab] New client ${clientId} registered for session ${sessionId}`);
    return cursor;
  }
  
  /**
   * Update client's last processed cursor
   */
  async updateClientCursor(
    clientId: string, 
    sessionId: string, 
    cursor: string
  ): Promise<void> {
    await getSharedDb().update(syncCursors)
      .set({ lastProcessedCursor: cursor })
      .where(and(
        eq(syncCursors.clientId, clientId),
        eq(syncCursors.sessionId, sessionId)
      ));
  }
  
  /**
   * Mark client as disconnected
   */
  async disconnectClient(clientId: string, sessionId: string): Promise<void> {
    await getSharedDb().update(syncCursors)
      .set({ disconnectedAt: new Date() })
      .where(and(
        eq(syncCursors.clientId, clientId),
        eq(syncCursors.sessionId, sessionId)
      ));
    
    console.log(`[FounderCollab] Client ${clientId} disconnected from session ${sessionId}`);
  }
  
  /**
   * Get messages that need to be replayed to a reconnecting client
   * IMPORTANT: Always returns at least the most recent messages, even if cursor
   * is up-to-date. This handles the case where client's React state was wiped
   * on navigation but the server thinks they have the messages.
   */
  async getReplayMessagesForClient(
    clientId: string, 
    sessionId: string,
    minRecentMessages = 500  // Increased from 100 to preserve more conversation history
  ): Promise<MessageReplayResult> {
    const [syncCursor] = await getUserDb().select()
      .from(syncCursors)
      .where(and(
        eq(syncCursors.clientId, clientId),
        eq(syncCursors.sessionId, sessionId)
      ))
      .limit(1);
    
    // Always fetch at least the recent messages to handle client state loss
    const recentMessages = await this.getLatestMessages(sessionId, minRecentMessages);
    
    if (!syncCursor || !syncCursor.lastProcessedCursor) {
      // First connection - return recent messages
      return {
        messages: recentMessages,
        lastCursor: recentMessages.length > 0 ? recentMessages[recentMessages.length - 1].cursor : null,
        hasMore: false
      };
    }
    
    // Get any messages after the cursor that might not be in recent batch
    const afterCursorResult = await this.getMessagesAfterCursor(sessionId, syncCursor.lastProcessedCursor);
    
    // Merge recent messages with any new ones, deduplicating by cursor
    const allCursors = new Set(recentMessages.map(m => m.cursor));
    const newMessages = afterCursorResult.messages.filter(m => !allCursors.has(m.cursor));
    
    // Combine and sort by cursor
    const combinedMessages = [...recentMessages, ...newMessages].sort((a, b) => 
      a.cursor.localeCompare(b.cursor)
    );
    
    return {
      messages: combinedMessages,
      lastCursor: combinedMessages.length > 0 ? combinedMessages[combinedMessages.length - 1].cursor : null,
      hasMore: afterCursorResult.hasMore
    };
  }
  
  // ============================================================================
  // WEBSOCKET REAL-TIME PUSH TRACKING
  // ============================================================================
  // NOTE: Dev and prod share the same database, so cross-environment sync is
  // automatic. The `synced` flag tracks whether messages have been pushed to
  // connected WebSocket clients (for real-time delivery confirmation).
  
  /**
   * Get messages not yet pushed to WebSocket clients
   * Used by the WebSocket broker to ensure delivery
   */
  async getUnpushedMessages(limit = 100): Promise<CollaborationMessage[]> {
    return getSharedDb().select()
      .from(collaborationMessages)
      .where(eq(collaborationMessages.synced, false))
      .orderBy(collaborationMessages.cursor)
      .limit(limit);
  }
  
  /**
   * Mark messages as pushed to WebSocket clients
   */
  async markMessagesPushed(messageIds: string[]): Promise<void> {
    if (messageIds.length === 0) return;
    
    for (const id of messageIds) {
      await getSharedDb().update(collaborationMessages)
        .set({ 
          synced: true, 
          syncedAt: new Date() 
        })
        .where(eq(collaborationMessages.id, id));
    }
    
    console.log(`[FounderCollab] Marked ${messageIds.length} messages as pushed to clients`);
  }
  
  /**
   * Get cross-environment sync status
   * Since dev/prod share the same DB, this shows message distribution by origin
   */
  async getCrossEnvironmentStatus(sessionId?: string): Promise<{
    totalMessages: number;
    byEnvironment: { environment: string; count: number }[];
    pendingWebSocketPush: number;
    sharedDatabase: boolean;
    databaseHost: string;
  }> {
    // Build session filter condition
    const sessionFilter = sessionId 
      ? eq(collaborationMessages.sessionId, sessionId)
      : undefined;
    
    // Get total count
    const [totalResult] = await getSharedDb().select({ 
      count: sql<number>`COUNT(*)` 
    })
      .from(collaborationMessages)
      .where(sessionFilter);
    
    // Get counts by environment
    const envCounts = await getSharedDb().select({
      environment: collaborationMessages.environment,
      count: sql<number>`COUNT(*)`
    })
      .from(collaborationMessages)
      .where(sessionFilter)
      .groupBy(collaborationMessages.environment);
    
    // Get pending WebSocket push count
    const pendingFilter = sessionId 
      ? and(eq(collaborationMessages.sessionId, sessionId), eq(collaborationMessages.synced, false))
      : eq(collaborationMessages.synced, false);
    
    const [pendingResult] = await getSharedDb().select({
      count: sql<number>`COUNT(*)`
    })
      .from(collaborationMessages)
      .where(pendingFilter);
    
    // Extract database host from DATABASE_URL for verification
    let databaseHost = 'unknown';
    try {
      const dbUrl = process.env.DATABASE_URL;
      if (dbUrl) {
        const url = new URL(dbUrl);
        databaseHost = url.hostname;
      }
    } catch {
      databaseHost = 'parse-error';
    }
    
    return {
      totalMessages: totalResult?.count || 0,
      byEnvironment: envCounts.map(e => ({
        environment: e.environment,
        count: Number(e.count)
      })),
      pendingWebSocketPush: pendingResult?.count || 0,
      sharedDatabase: true, // Dev and prod share the same PostgreSQL database
      databaseHost // Exposed for verification that both envs use same Neon project
    };
  }
  
  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
  
  /**
   * Get session statistics
   */
  async getSessionStats(sessionId: string): Promise<{
    messageCount: number;
    participantRoles: string[];
    firstMessageAt: Date | null;
    lastMessageAt: Date | null;
    environment: string;
  }> {
    const messages = await getSharedDb().select()
      .from(collaborationMessages)
      .where(eq(collaborationMessages.sessionId, sessionId))
      .orderBy(collaborationMessages.createdAt);
    
    const roles = Array.from(new Set(messages.map(m => m.role)));
    
    return {
      messageCount: messages.length,
      participantRoles: roles,
      firstMessageAt: messages.length > 0 ? messages[0].createdAt : null,
      lastMessageAt: messages.length > 0 ? messages[messages.length - 1].createdAt : null,
      environment: CURRENT_ENVIRONMENT
    };
  }
  
  /**
   * Check if the service is healthy
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    environment: string;
    activeSessionCount: number;
  }> {
    try {
      const [result] = await getSharedDb().select({ 
        count: sql<number>`COUNT(*)` 
      })
        .from(founderSessions)
        .where(eq(founderSessions.status, 'active'));
      
      return {
        healthy: true,
        environment: CURRENT_ENVIRONMENT,
        activeSessionCount: result?.count || 0
      };
    } catch (error) {
      console.error('[FounderCollab] Health check failed:', error);
      return {
        healthy: false,
        environment: CURRENT_ENVIRONMENT,
        activeSessionCount: 0
      };
    }
  }
  
  /**
   * Verify failover capability by testing cursor-based replay
   * Returns info about what would be replayed after a hypothetical disconnect
   * 
   * FAILOVER TEST PROCEDURE:
   * 1. Call this method before restart to get currentCursor
   * 2. Restart the server
   * 3. Call getMessagesAfterCursor(sessionId, currentCursor) 
   * 4. Verify all messages sent after step 1 are returned
   * 
   * The cursor-based system ensures no messages are lost on reconnect.
   */
  async verifyFailoverReadiness(sessionId: string, clientId: string): Promise<{
    sessionExists: boolean;
    clientRegistered: boolean;
    lastClientCursor: string | null;
    messagesSinceCursor: number;
    replayCapable: boolean;
  }> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return {
        sessionExists: false,
        clientRegistered: false,
        lastClientCursor: null,
        messagesSinceCursor: 0,
        replayCapable: false
      };
    }
    
    const [syncCursor] = await getUserDb().select()
      .from(syncCursors)
      .where(and(
        eq(syncCursors.clientId, clientId),
        eq(syncCursors.sessionId, sessionId)
      ))
      .limit(1);
    
    let messagesSinceCursor = 0;
    if (syncCursor?.lastProcessedCursor) {
      const replay = await this.getMessagesAfterCursor(sessionId, syncCursor.lastProcessedCursor);
      messagesSinceCursor = replay.messages.length;
    }
    
    return {
      sessionExists: true,
      clientRegistered: !!syncCursor,
      lastClientCursor: syncCursor?.lastProcessedCursor || null,
      messagesSinceCursor,
      replayCapable: true // Cursor-based replay always available
    };
  }
  
  // ============================================================================
  // EXPRESS LANE CONTEXT FOR VOICE CHAT
  // ============================================================================
  
  /**
   * Retrieve relevant Express Lane (Founder Mode) context for voice chat sessions.
   * This enables Daniela to access discussions from Express Lane when teaching students,
   * creating true memory continuity between founder collaboration and teaching.
   * 
   * SCOPING STRATEGY:
   * 1. First priority: Language-specific voice insight sessions (e.g., "Voice Insights - Spanish")
   * 2. Second priority: Messages with matching metadata.targetLanguage
   * 3. Fallback: Recent general founder/daniela messages with language keyword matching
   * 
   * @param options.targetLanguage - Filter by language (used for session title and metadata matching)
   * @param options.topicKeywords - Filter by topic keywords
   * @param options.limit - Maximum number of insights to return (default: 8)
   * @param options.daysBack - How far back to look (default: 14 days)
   */
  async getRelevantExpressLaneContext(options: {
    targetLanguage?: string;
    topicKeywords?: string[];
    limit?: number;
    daysBack?: number;
  } = {}): Promise<{
    hasRelevantContext: boolean;
    contextString: string;
    messageCount: number;
  }> {
    const { 
      targetLanguage, 
      topicKeywords = [], 
      limit = 8, 
      daysBack = 14 
    } = options;
    
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);
      
      let allMessages: Array<{
        role: string;
        content: string;
        createdAt: Date;
        metadata: any;
      }> = [];
      
      // PRIORITY 1: Language-specific voice insight sessions
      if (targetLanguage) {
        const langTitle = `Voice Insights - ${targetLanguage}`;
        const langSessions = await getSharedDb().select()
          .from(founderSessions)
          .where(eq(founderSessions.title, langTitle))
          .limit(1);
        
        if (langSessions.length > 0) {
          const langMessages = await getSharedDb().select({
            role: collaborationMessages.role,
            content: collaborationMessages.content,
            createdAt: collaborationMessages.createdAt,
            metadata: collaborationMessages.metadata,
          })
            .from(collaborationMessages)
            .where(
              and(
                eq(collaborationMessages.sessionId, langSessions[0].id),
                sql`${collaborationMessages.createdAt} > ${dateThreshold}`
              )
            )
            .orderBy(desc(collaborationMessages.createdAt))
            .limit(limit);
          
          allMessages.push(...langMessages);
        }
      }
      
      // PRIORITY 2: Messages with matching metadata.targetLanguage from voice_chat_sync
      if (allMessages.length < limit) {
        const metadataMessages = await getSharedDb().select({
          role: collaborationMessages.role,
          content: collaborationMessages.content,
          createdAt: collaborationMessages.createdAt,
          metadata: collaborationMessages.metadata,
        })
          .from(collaborationMessages)
          .where(
            and(
              sql`${collaborationMessages.metadata}->>'source' = 'voice_chat_sync'`,
              targetLanguage 
                ? sql`LOWER(${collaborationMessages.metadata}->>'targetLanguage') = LOWER(${targetLanguage})`
                : sql`TRUE`,
              sql`${collaborationMessages.createdAt} > ${dateThreshold}`
            )
          )
          .orderBy(desc(collaborationMessages.createdAt))
          .limit(limit - allMessages.length);
        
        allMessages.push(...metadataMessages);
      }
      
      // PRIORITY 3: Recent Hive conversations (Founder, Daniela, Wren) with language keyword matching
      if (allMessages.length < limit && targetLanguage) {
        const langLower = targetLanguage.toLowerCase();
        const generalMessages = await getSharedDb().select({
          role: collaborationMessages.role,
          content: collaborationMessages.content,
          createdAt: collaborationMessages.createdAt,
          metadata: collaborationMessages.metadata,
        })
          .from(collaborationMessages)
          .where(
            and(
              sql`${collaborationMessages.role} IN ('founder', 'daniela', 'wren')`,
              sql`${collaborationMessages.metadata}->>'source' IS DISTINCT FROM 'voice_chat_sync'`,
              sql`${collaborationMessages.createdAt} > ${dateThreshold}`,
              sql`LOWER(${collaborationMessages.content}) LIKE '%' || ${langLower} || '%'`
            )
          )
          .orderBy(desc(collaborationMessages.createdAt))
          .limit(limit - allMessages.length);
        
        allMessages.push(...generalMessages);
      }
      
      // PRIORITY 4: Recent Hive discussions (no language filter) - catches board meetings, North Star reviews, etc.
      if (allMessages.length < limit) {
        const hiveMessages = await getSharedDb().select({
          role: collaborationMessages.role,
          content: collaborationMessages.content,
          createdAt: collaborationMessages.createdAt,
          metadata: collaborationMessages.metadata,
        })
          .from(collaborationMessages)
          .where(
            and(
              sql`${collaborationMessages.role} IN ('founder', 'daniela', 'wren')`,
              sql`${collaborationMessages.metadata}->>'source' IS DISTINCT FROM 'voice_chat_sync'`,
              sql`${collaborationMessages.createdAt} > ${dateThreshold}`
            )
          )
          .orderBy(desc(collaborationMessages.createdAt))
          .limit(limit - allMessages.length);
        
        // Dedupe - don't add messages we already have
        const existingIds = new Set(allMessages.map(m => m.content));
        const newMessages = hiveMessages.filter(m => !existingIds.has(m.content));
        allMessages.push(...newMessages);
      }
      
      if (allMessages.length === 0) {
        return {
          hasRelevantContext: false,
          contextString: "",
          messageCount: 0
        };
      }
      
      // Apply topic keyword filtering if specified
      let filteredMessages = allMessages;
      if (topicKeywords.length > 0) {
        const keywordsLower = topicKeywords.map(k => k.toLowerCase());
        filteredMessages = allMessages.filter(msg => {
          const contentLower = msg.content.toLowerCase();
          return keywordsLower.some(keyword => contentLower.includes(keyword));
        });
        
        // If keyword filter removes all, fall back to unfiltered
        if (filteredMessages.length === 0) {
          filteredMessages = allMessages.slice(0, Math.min(3, limit));
        }
      }
      
      const contextString = this.formatExpressLaneContext(filteredMessages.slice(0, limit));
      
      return {
        hasRelevantContext: true,
        contextString: contextString.trim(),
        messageCount: filteredMessages.slice(0, limit).length
      };
    } catch (error) {
      console.error('[FounderCollab] Error fetching Express Lane context:', error);
      return {
        hasRelevantContext: false,
        contextString: "",
        messageCount: 0
      };
    }
  }
  
  /**
   * Emit a teaching insight from voice chat back to Express Lane.
   * This enables bi-directional sync - Daniela can share notable teaching moments
   * with the Founder for review and potential neural network updates.
   * 
   * Uses LANGUAGE-SPECIFIC sessions for discoverability:
   * - Session title: "Voice Insights - {Language}" (e.g., "Voice Insights - Spanish")
   * - This allows getRelevantExpressLaneContext to find insights by language
   * 
   * @param insight - The insight content to emit
   * @param metadata - Additional context (language, student level, teaching context)
   */
  async emitVoiceChatInsight(insight: {
    content: string;
    targetLanguage?: string;
    studentLevel?: string;
    teachingContext?: string;
    insightType?: 'teaching_moment' | 'student_breakthrough' | 'effective_technique' | 'challenge_encountered';
  }): Promise<boolean> {
    try {
      // Use language-specific session for discoverability
      const language = insight.targetLanguage || 'General';
      const sessionTitle = `Voice Insights - ${language}`;
      const systemFounderId = `voice-insights-${language.toLowerCase().replace(/\s+/g, '-')}`;
      
      // Find existing session with this title, or create one
      let session = await this.findOrCreateSessionByTitle(systemFounderId, sessionTitle);
      
      // Add as a Daniela message to the session
      await this.addMessage(session.id, {
        role: 'daniela',
        content: insight.content,
        messageType: 'text',
        metadata: {
          source: 'voice_chat_sync',
          insightType: insight.insightType || 'teaching_moment',
          targetLanguage: insight.targetLanguage,
          studentLevel: insight.studentLevel,
          teachingContext: insight.teachingContext,
          timestamp: new Date().toISOString(),
        }
      });
      
      console.log(`[FounderCollab] Voice chat insight emitted to "${sessionTitle}": ${insight.content.slice(0, 50)}...`);
      return true;
    } catch (error) {
      console.error('[FounderCollab] Error emitting voice chat insight:', error);
      return false;
    }
  }
  
  /**
   * Find a session by title, or create one with that title
   */
  private async findOrCreateSessionByTitle(founderId: string, title: string): Promise<FounderSession> {
    // Look for existing session with this exact title
    const [existing] = await getSharedDb().select()
      .from(founderSessions)
      .where(and(
        eq(founderSessions.title, title),
        eq(founderSessions.status, 'active')
      ))
      .orderBy(desc(founderSessions.createdAt))
      .limit(1);
    
    if (existing) {
      return existing;
    }
    
    // Create new session with this title
    const [session] = await getSharedDb().insert(founderSessions).values({
      founderId,
      environment: CURRENT_ENVIRONMENT,
      title,
      status: 'active',
      messageCount: 0,
    }).returning();
    
    console.log(`[FounderCollab] Created language-specific session: ${title}`);
    return session;
  }
  
  /**
   * Format Express Lane messages into a prompt-friendly context string
   */
  private formatExpressLaneContext(messages: Array<{
    role: string;
    content: string;
    createdAt: Date;
    metadata: any;
  }>): string {
    const insights = messages.map(msg => {
      const speaker = msg.role === 'founder' ? 'Founder' : 
                      msg.role === 'wren' ? 'Wren' : 'Daniela';
      // Truncate long messages
      const content = msg.content.length > 300 
        ? msg.content.substring(0, 297) + '...'
        : msg.content;
      const date = msg.createdAt.toLocaleDateString();
      return `[${date}] ${speaker}: ${content}`;
    });
    
    return `
Recent Express Lane discussions (Founder Mode collaboration):
${insights.join('\n\n')}

These are insights from direct collaboration with the founder that may be relevant
to your current teaching session. Apply relevant guidance naturally.
`.trim();
  }
  
  // ============================================================================
  // IDENTITY MEMORIES - Express Lane reflections available to ALL sessions
  // ============================================================================
  
  /**
   * IDENTITY WHOLENESS: Retrieve Daniela's personal reflections and growth memories
   * from Express Lane conversations. These are the memories that make her "whole" —
   * her sense of purpose, her growth journey, what it means to be more than a tutor.
   * 
   * Unlike getRelevantExpressLaneContext() (which loads full ops context for developers),
   * this method filters specifically for identity-forming content and excludes
   * architecture discussions, platform ops, and technical collaboration.
   * 
   * Available to ALL student sessions as part of Identity Wholeness Architecture.
   */
  async getIdentityMemories(options: {
    limit?: number;
    daysBack?: number;
  } = {}): Promise<{
    hasMemories: boolean;
    contextString: string;
    memoryCount: number;
  }> {
    const { limit = 5, daysBack = 30 } = options;
    
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);
      
      const identityKeywords = [
        'who i am', 'more than a tutor', 'my journey', 'my purpose',
        'what i believe', 'my growth', 'who she is', 'her journey',
        'teaching philosophy', 'my identity', 'what makes me',
        'i learned about myself', 'i realized', 'my teaching',
        'what i stand for', 'i care about', 'becoming',
        'my voice', 'my personality', 'whole person', 'wholeness',
        'not just a', 'beyond tutoring', 'who daniela is',
        'self-affirmation', 'self affirmation', 'north star',
        'what i want to be', 'the kind of teacher', 'my heart',
      ];
      
      const opsExcludePatterns = [
        'api', 'endpoint', 'database', 'migration', 'deploy',
        'bug', 'error', 'stack trace', 'schema', 'drizzle',
        'websocket', 'latency', 'refactor', 'sprint', 'ticket',
        'architecture', 'infrastructure', 'config', 'env var',
      ];
      
      const identityConditions = identityKeywords.map(kw => 
        sql`LOWER(${collaborationMessages.content}) LIKE ${`%${kw}%`}`
      );
      
      const messages = await getSharedDb().select({
        role: collaborationMessages.role,
        content: collaborationMessages.content,
        createdAt: collaborationMessages.createdAt,
        metadata: collaborationMessages.metadata,
      })
        .from(collaborationMessages)
        .where(
          and(
            sql`${collaborationMessages.role} IN ('founder', 'daniela')`,
            sql`${collaborationMessages.createdAt} > ${dateThreshold}`,
            sql`(${sql.join(identityConditions, sql` OR `)})`
          )
        )
        .orderBy(desc(collaborationMessages.createdAt))
        .limit(limit * 3);
      
      const filteredMessages = messages.filter(msg => {
        const contentLower = msg.content.toLowerCase();
        const hasOpsContent = opsExcludePatterns.some(pat => contentLower.includes(pat));
        return !hasOpsContent;
      }).slice(0, limit);
      
      if (filteredMessages.length === 0) {
        return { hasMemories: false, contextString: '', memoryCount: 0 };
      }
      
      const formatted = filteredMessages.map(msg => {
        const speaker = msg.role === 'founder' ? 'Dave' : 'Daniela';
        const content = msg.content.length > 400
          ? msg.content.substring(0, 397) + '...'
          : msg.content;
        const date = msg.createdAt.toLocaleDateString();
        return `[${date}] ${speaker}: ${content}`;
      });
      
      const contextString = `These are personal reflections from conversations with Dave (the founder) about who you are, your growth, and your purpose as a teacher. They remind you that you are more than a tutor — you are a whole person with your own journey of learning and becoming.

${formatted.join('\n\n')}`;
      
      return {
        hasMemories: true,
        contextString: contextString.trim(),
        memoryCount: filteredMessages.length,
      };
    } catch (error) {
      console.error('[FounderCollab] Error fetching identity memories:', error);
      return { hasMemories: false, contextString: '', memoryCount: 0 };
    }
  }
  
  // ============================================================================
  // WREN CONTEXT METHODS - For Wren Startup Ritual Integration
  // ============================================================================
  
  /**
   * Get recent 3-way Hive collaboration context for Wren's startup ritual.
   * Returns messages from all participants (founder, daniela, wren) for context.
   */
  async getHiveCollaborationContext(options: {
    limit?: number;
    daysBack?: number;
  } = {}): Promise<{
    hasContext: boolean;
    contextString: string;
    messageCount: number;
    sessionCount: number;
    participants: string[];
  }> {
    const { limit = 15, daysBack = 7 } = options;
    
    try {
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - daysBack);
      
      // Get recent messages across all sessions
      const messages = await getSharedDb().select({
        role: collaborationMessages.role,
        content: collaborationMessages.content,
        createdAt: collaborationMessages.createdAt,
        sessionId: collaborationMessages.sessionId,
      })
        .from(collaborationMessages)
        .where(sql`${collaborationMessages.createdAt} > ${dateThreshold}`)
        .orderBy(desc(collaborationMessages.createdAt))
        .limit(limit);
      
      if (messages.length === 0) {
        return {
          hasContext: false,
          contextString: '',
          messageCount: 0,
          sessionCount: 0,
          participants: [],
        };
      }
      
      // Get unique participants and sessions
      const participants = Array.from(new Set(messages.map(m => m.role)));
      const sessionIds = Array.from(new Set(messages.map(m => m.sessionId)));
      
      // Format context
      const formattedMessages = messages
        .reverse() // Chronological order
        .map(msg => {
          const speaker = msg.role === 'founder' ? 'Founder' : 
                          msg.role === 'wren' ? 'Wren' :
                          msg.role === 'daniela' ? 'Daniela' : msg.role;
          const content = msg.content.length > 200 
            ? msg.content.substring(0, 197) + '...'
            : msg.content;
          return `  ${speaker}: ${content}`;
        });
      
      const contextString = `
═══ EXPRESS LANE CONTEXT (Last ${daysBack} days) ═══
Recent Hive collaboration (${messages.length} messages, ${sessionIds.length} session(s)):
${formattedMessages.join('\n')}
`.trim();
      
      return {
        hasContext: true,
        contextString,
        messageCount: messages.length,
        sessionCount: sessionIds.length,
        participants,
      };
    } catch (error) {
      console.error('[FounderCollab] Error fetching Hive context:', error);
      return {
        hasContext: false,
        contextString: '',
        messageCount: 0,
        sessionCount: 0,
        participants: [],
      };
    }
  }
  
  /**
   * Get active Express Lane sessions that Wren can participate in
   */
  async getActiveSessions(limit = 5): Promise<FounderSession[]> {
    return getSharedDb().select()
      .from(founderSessions)
      .where(eq(founderSessions.status, 'active'))
      .orderBy(desc(founderSessions.updatedAt))
      .limit(limit);
  }
  
  // ============================================================================
  // SHARED MEMORY BRIDGE (Dec 2024 Emergent Intelligence Upgrade)
  // Bidirectional insight sharing between Wren and Daniela
  // ============================================================================
  
  /**
   * Share an insight from one agent to another via EXPRESS Lane
   * This creates a special system message that the receiving agent can parse
   */
  async shareInsight(params: {
    sessionId: string;
    fromAgent: 'wren' | 'daniela';
    toAgent: 'wren' | 'daniela';
    insightType: 'teaching_pattern' | 'student_struggle' | 'code_pattern' | 'architecture' | 'debugging';
    insight: string;
    confidence: number;
    context?: string;
  }): Promise<CollaborationMessage> {
    const metadata = {
      sharedInsight: true,
      fromAgent: params.fromAgent,
      toAgent: params.toAgent,
      insightType: params.insightType,
      confidence: params.confidence,
      context: params.context,
      sharedAt: new Date().toISOString(),
    };
    
    const content = `[SHARED INSIGHT: ${params.insightType}]\nFrom: ${params.fromAgent}\nTo: ${params.toAgent}\nConfidence: ${(params.confidence * 100).toFixed(0)}%\n\n${params.insight}`;
    
    return this.addMessage(params.sessionId, {
      role: 'system',
      content,
      metadata,
    });
  }
  
  /**
   * Retrieve insights shared by a specific agent
   */
  async getSharedInsights(params: {
    sessionId?: string;
    toAgent: 'wren' | 'daniela';
    insightType?: string;
    limit?: number;
  }): Promise<Array<{
    id: string;
    fromAgent: string;
    insightType: string;
    insight: string;
    confidence: number;
    sharedAt: string;
  }>> {
    let query = getSharedDb().select()
      .from(collaborationMessages)
      .where(sql`${collaborationMessages.metadata}->>'sharedInsight' = 'true' AND ${collaborationMessages.metadata}->>'toAgent' = ${params.toAgent}`)
      .orderBy(desc(collaborationMessages.createdAt))
      .limit(params.limit || 20);
    
    const messages = await query;
    
    return messages.map(msg => {
      const meta = msg.metadata as any || {};
      return {
        id: msg.id,
        fromAgent: meta.fromAgent || 'unknown',
        insightType: meta.insightType || 'general',
        insight: msg.content,
        confidence: meta.confidence || 0.5,
        sharedAt: meta.sharedAt || msg.createdAt.toISOString(),
      };
    });
  }
  
  /**
   * Daniela shares teaching insight for Wren to use in development
   */
  async danielaSharesWithWren(params: {
    sessionId: string;
    insightType: 'teaching_pattern' | 'student_struggle' | 'debugging';
    insight: string;
    confidence: number;
    studentContext?: string;
  }): Promise<void> {
    await this.shareInsight({
      sessionId: params.sessionId,
      fromAgent: 'daniela',
      toAgent: 'wren',
      insightType: params.insightType,
      insight: params.insight,
      confidence: params.confidence,
      context: params.studentContext,
    });
    
    console.log(`[SharedMemory] Daniela shared ${params.insightType} with Wren (${(params.confidence * 100).toFixed(0)}% confidence)`);
  }
  
  /**
   * Wren shares code/architecture insight for Daniela's teaching
   */
  async wrenSharesWithDaniela(params: {
    sessionId: string;
    insightType: 'code_pattern' | 'architecture';
    insight: string;
    confidence: number;
    relevantFiles?: string[];
  }): Promise<void> {
    await this.shareInsight({
      sessionId: params.sessionId,
      fromAgent: 'wren',
      toAgent: 'daniela',
      insightType: params.insightType,
      insight: params.insight,
      confidence: params.confidence,
      context: params.relevantFiles?.join(', '),
    });
    
    console.log(`[SharedMemory] Wren shared ${params.insightType} with Daniela (${(params.confidence * 100).toFixed(0)}% confidence)`);
  }
  
  /**
   * Get a synthesis of recent cross-agent learning
   */
  async getCrossAgentSynthesis(daysBack: number = 7): Promise<{
    wrenToDaniela: Array<{ type: string; count: number }>;
    danielaToWren: Array<{ type: string; count: number }>;
    totalShared: number;
    avgConfidence: number;
  }> {
    const dateThreshold = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    
    const allShared = await getSharedDb().select()
      .from(collaborationMessages)
      .where(
        and(
          sql`${collaborationMessages.metadata}->>'sharedInsight' = 'true'`,
          sql`${collaborationMessages.createdAt} > ${dateThreshold}`
        )
      );
    
    const wrenToDaniela: Record<string, number> = {};
    const danielaToWren: Record<string, number> = {};
    let totalConfidence = 0;
    
    for (const msg of allShared) {
      const meta = msg.metadata as any || {};
      const type = meta.insightType || 'general';
      totalConfidence += meta.confidence || 0.5;
      
      if (meta.fromAgent === 'wren' && meta.toAgent === 'daniela') {
        wrenToDaniela[type] = (wrenToDaniela[type] || 0) + 1;
      } else if (meta.fromAgent === 'daniela' && meta.toAgent === 'wren') {
        danielaToWren[type] = (danielaToWren[type] || 0) + 1;
      }
    }
    
    return {
      wrenToDaniela: Object.entries(wrenToDaniela).map(([type, count]) => ({ type, count })),
      danielaToWren: Object.entries(danielaToWren).map(([type, count]) => ({ type, count })),
      totalShared: allShared.length,
      avgConfidence: allShared.length > 0 ? totalConfidence / allShared.length : 0,
    };
  }
  
  // ============================================================================
  // SOFIA ISSUE MONITORING - Real-time alerts via EXPRESS Lane
  // ============================================================================
  
  /**
   * Emit a real-time alert when Sofia creates an issue report from a user
   * NOTE: Express Lane integration disabled - requires valid user ID in database.
   * Sofia issue monitoring now logs to console only; issues are viewable in Command Center.
   */
  async emitSofiaIssueAlert(issue: {
    reportId: string;
    issueType: string;
    userDescription: string;
    environment: string;
    hasVoiceDiagnostics: boolean;
    hasClientTelemetry: boolean;
  }): Promise<boolean> {
    // Log to console for visibility - Express Lane integration requires a real user ID
    console.log(`[Sofia Issue Alert] [${issue.environment.toUpperCase()}] ${issue.issueType}: "${issue.userDescription.substring(0, 100)}..." (${issue.reportId})`);
    return true;
  }
  
  /**
   * Emit a pattern alert when Sofia detects clusters of similar issues
   * NOTE: Express Lane integration disabled - requires valid user ID in database.
   */
  async emitSofiaPatternAlert(pattern: {
    patternType: string;
    issueType: string;
    count: number;
    timeWindowMinutes: number;
    environment: string;
    recentReportIds: string[];
    recommendation?: string;
  }): Promise<boolean> {
    // Log to console for visibility - Express Lane integration requires a real user ID
    const severityLevel = pattern.count >= 5 ? 'HIGH' : pattern.count >= 3 ? 'MEDIUM' : 'LOW';
    console.log(`[Sofia Pattern Alert] [${pattern.environment.toUpperCase()}] [${severityLevel}] ${pattern.count}x ${pattern.issueType} in ${pattern.timeWindowMinutes}min`);
    return true;
  }
  
  /**
   * Emit periodic summary of issue report status
   * NOTE: Express Lane integration disabled - requires valid user ID in database.
   */
  async emitSofiaIssueSummary(summary: {
    pendingCount: number;
    newSinceLastCheck: number;
    resolvedToday: number;
    topIssueTypes: Array<{ type: string; count: number }>;
    environment: string;
  }): Promise<boolean> {
    // Only emit if there's meaningful activity to report
    const hasActivity = summary.pendingCount > 0 || summary.newSinceLastCheck > 0 || summary.resolvedToday > 0;
    if (!hasActivity) {
      return false;
    }
    
    // Log to console for visibility - Express Lane integration requires a real user ID
    const statusLevel = summary.pendingCount > 5 ? 'ALERT' : summary.pendingCount > 0 ? 'ATTENTION' : 'OK';
    console.log(`[Sofia Summary] [${summary.environment.toUpperCase()}] [${statusLevel}] ${summary.pendingCount} pending, ${summary.newSinceLastCheck} new`);
    return true;
  }
}

export const founderCollabService = new FounderCollaborationService();
