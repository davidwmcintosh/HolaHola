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

import { db } from "../db";
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

const CURRENT_ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

export interface FounderMessageInput {
  role: 'founder' | 'daniela' | 'editor' | 'system';
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
    const [session] = await db.insert(founderSessions).values({
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
   * Returns existing active session or creates a new one
   */
  async getOrCreateActiveSession(founderId: string): Promise<FounderSession> {
    const [existing] = await db.select()
      .from(founderSessions)
      .where(and(
        eq(founderSessions.founderId, founderId),
        eq(founderSessions.status, 'active')
      ))
      .orderBy(desc(founderSessions.createdAt))
      .limit(1);
    
    if (existing) {
      return existing;
    }
    
    return this.createSession(founderId);
  }
  
  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<FounderSession | null> {
    const [session] = await db.select()
      .from(founderSessions)
      .where(eq(founderSessions.id, sessionId))
      .limit(1);
    
    return session || null;
  }
  
  /**
   * Get all sessions for a founder
   */
  async getFounderSessions(founderId: string, limit = 20): Promise<FounderSession[]> {
    return db.select()
      .from(founderSessions)
      .where(eq(founderSessions.founderId, founderId))
      .orderBy(desc(founderSessions.createdAt))
      .limit(limit);
  }
  
  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string, 
    status: 'active' | 'paused' | 'completed'
  ): Promise<FounderSession | null> {
    const [updated] = await db.update(founderSessions)
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
    
    const [result] = await db.select({ 
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
    
    const [message] = await db.insert(collaborationMessages).values({
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
    
    await db.update(founderSessions)
      .set({ 
        lastCursor: cursor,
        messageCount: sql`${founderSessions.messageCount} + 1`,
        updatedAt: new Date()
      })
      .where(eq(founderSessions.id, sessionId));
    
    console.log(`[FounderCollab] Message added to session ${sessionId}, cursor: ${cursor}`);
    return message;
  }
  
  /**
   * Get all messages in a session
   */
  async getSessionMessages(
    sessionId: string, 
    limit = 100
  ): Promise<CollaborationMessage[]> {
    return db.select()
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
    const messages = await db.select()
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
    const messages = await db.select()
      .from(collaborationMessages)
      .where(eq(collaborationMessages.sessionId, sessionId))
      .orderBy(desc(collaborationMessages.cursor))
      .limit(limit);
    
    return messages.reverse();
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
    const [existing] = await db.select()
      .from(syncCursors)
      .where(and(
        eq(syncCursors.clientId, clientId),
        eq(syncCursors.sessionId, sessionId)
      ))
      .limit(1);
    
    if (existing) {
      const [updated] = await db.update(syncCursors)
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
    
    const [cursor] = await db.insert(syncCursors).values({
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
    await db.update(syncCursors)
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
    await db.update(syncCursors)
      .set({ disconnectedAt: new Date() })
      .where(and(
        eq(syncCursors.clientId, clientId),
        eq(syncCursors.sessionId, sessionId)
      ));
    
    console.log(`[FounderCollab] Client ${clientId} disconnected from session ${sessionId}`);
  }
  
  /**
   * Get messages that need to be replayed to a reconnecting client
   */
  async getReplayMessagesForClient(
    clientId: string, 
    sessionId: string
  ): Promise<MessageReplayResult> {
    const [syncCursor] = await db.select()
      .from(syncCursors)
      .where(and(
        eq(syncCursors.clientId, clientId),
        eq(syncCursors.sessionId, sessionId)
      ))
      .limit(1);
    
    if (!syncCursor || !syncCursor.lastProcessedCursor) {
      const messages = await this.getLatestMessages(sessionId);
      return {
        messages,
        lastCursor: messages.length > 0 ? messages[messages.length - 1].cursor : null,
        hasMore: false
      };
    }
    
    return this.getMessagesAfterCursor(sessionId, syncCursor.lastProcessedCursor);
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
    return db.select()
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
      await db.update(collaborationMessages)
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
    const [totalResult] = await db.select({ 
      count: sql<number>`COUNT(*)` 
    })
      .from(collaborationMessages)
      .where(sessionFilter);
    
    // Get counts by environment
    const envCounts = await db.select({
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
    
    const [pendingResult] = await db.select({
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
    const messages = await db.select()
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
      const [result] = await db.select({ 
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
    
    const [syncCursor] = await db.select()
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
}

export const founderCollabService = new FounderCollaborationService();
