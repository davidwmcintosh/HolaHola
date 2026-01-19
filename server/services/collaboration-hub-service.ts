/**
 * Collaboration Hub Service
 * 
 * Enables real-time bidirectional communication between AI agents:
 * - Daniela (AI Tutor / Gemini) can emit suggestions and insights
 * - Editor (Development Agent / Claude) can respond and acknowledge
 * - Founders can observe and participate
 * 
 * This is the central orchestration point for all collaboration events.
 */

import { db, getSharedDb } from "../db";
import { 
  collaborationEvents, 
  collaborationParticipants,
  InsertCollaborationEvent,
  CollaborationEvent,
  CollaborationParticipant
} from "@shared/schema";
import { eq, desc, and, isNull, sql } from "drizzle-orm";

// In-memory cache for real-time event broadcasting
interface EventListener {
  participantId: string;
  role: 'daniela' | 'editor' | 'founder' | 'system';
  callback: (event: CollaborationEvent) => void;
}

class CollaborationHubService {
  private listeners: Map<string, EventListener> = new Map();
  private pendingEvents: CollaborationEvent[] = [];
  
  // ============================================================================
  // EVENT CREATION
  // ============================================================================
  
  /**
   * Daniela emits a suggestion during teaching
   */
  async emitDanielaSuggestion(params: {
    content: string;
    summary?: string;
    category: 'feature_request' | 'pain_point' | 'missing_tool' | 'teaching_friction' | 'improvement_idea';
    urgency?: 'low' | 'medium' | 'high';
    conversationId?: string;
    targetLanguage?: string;
    studentLevel?: string;
    teachingContext?: string;
  }): Promise<CollaborationEvent> {
    const event: InsertCollaborationEvent = {
      eventType: 'daniela_suggestion',
      senderRole: 'daniela',
      content: params.content,
      summary: params.summary || params.content.slice(0, 200),
      metadata: {
        suggestionCategory: params.category,
        urgency: params.urgency || 'medium',
        conversationId: params.conversationId,
        targetLanguage: params.targetLanguage,
        studentLevel: params.studentLevel,
        teachingContext: params.teachingContext,
        actionRequired: true,
      },
    };
    
    return this.createEvent(event);
  }
  
  /**
   * Daniela shares a teaching insight (observation, not action-required)
   */
  async emitDanielaInsight(params: {
    content: string;
    summary?: string;
    conversationId?: string;
    targetLanguage?: string;
    teachingContext?: string;
  }): Promise<CollaborationEvent> {
    const event: InsertCollaborationEvent = {
      eventType: 'daniela_insight',
      senderRole: 'daniela',
      content: params.content,
      summary: params.summary || params.content.slice(0, 200),
      metadata: {
        conversationId: params.conversationId,
        targetLanguage: params.targetLanguage,
        teachingContext: params.teachingContext,
        actionRequired: false,
      },
    };
    
    return this.createEvent(event);
  }
  
  /**
   * Daniela asks Editor a question
   */
  async emitDanielaQuestion(params: {
    content: string;
    summary?: string;
    conversationId?: string;
    replyToEventId?: string;
  }): Promise<CollaborationEvent> {
    const event: InsertCollaborationEvent = {
      eventType: 'daniela_question',
      senderRole: 'daniela',
      content: params.content,
      summary: params.summary || params.content.slice(0, 200),
      metadata: {
        conversationId: params.conversationId,
        replyToEventId: params.replyToEventId,
        actionRequired: true,
      },
    };
    
    return this.createEvent(event);
  }
  
  /**
   * Editor responds to an event
   */
  async emitEditorResponse(params: {
    content: string;
    summary?: string;
    replyToEventId: string;
    actionTaken?: string;
  }): Promise<CollaborationEvent> {
    const event: InsertCollaborationEvent = {
      eventType: 'editor_response',
      senderRole: 'editor',
      content: params.content,
      summary: params.summary || params.content.slice(0, 200),
      metadata: {
        replyToEventId: params.replyToEventId,
        actionTaken: params.actionTaken,
      },
    };
    
    return this.createEvent(event);
  }
  
  /**
   * Editor acknowledges an event (quick response)
   */
  async emitEditorAcknowledgment(params: {
    replyToEventId: string;
    content?: string;
  }): Promise<CollaborationEvent> {
    const event: InsertCollaborationEvent = {
      eventType: 'editor_acknowledgment',
      senderRole: 'editor',
      content: params.content || 'Acknowledged - I see this and will address it.',
      summary: 'Editor acknowledged',
      metadata: {
        replyToEventId: params.replyToEventId,
      },
    };
    
    // Mark the original event as read
    await db.update(collaborationEvents)
      .set({ isRead: true })
      .where(eq(collaborationEvents.id, params.replyToEventId));
    
    return this.createEvent(event);
  }
  
  /**
   * Founder adds an observation or direction
   */
  async emitFounderObservation(params: {
    content: string;
    summary?: string;
    userId: string;
    replyToEventId?: string;
  }): Promise<CollaborationEvent> {
    const event: InsertCollaborationEvent = {
      eventType: 'founder_observation',
      senderRole: 'founder',
      senderId: params.userId,
      content: params.content,
      summary: params.summary || params.content.slice(0, 200),
      metadata: {
        replyToEventId: params.replyToEventId,
      },
    };
    
    return this.createEvent(event);
  }
  
  // ============================================================================
  // CORE EVENT MANAGEMENT
  // ============================================================================
  
  private async createEvent(event: InsertCollaborationEvent): Promise<CollaborationEvent> {
    const [created] = await db.insert(collaborationEvents)
      .values(event as any)
      .returning();
    
    console.log(`[Collaboration Hub] ${event.senderRole} emitted ${event.eventType}: ${event.summary}`);
    
    // Broadcast to listeners
    this.broadcastEvent(created);
    
    return created;
  }
  
  private broadcastEvent(event: CollaborationEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener.callback(event);
      } catch (error) {
        console.error(`[Collaboration Hub] Failed to notify listener ${listener.participantId}:`, error);
      }
    });
  }
  
  // ============================================================================
  // QUERIES
  // ============================================================================
  
  /**
   * Get pending suggestions for Editor (unread, action-required)
   */
  async getPendingSuggestionsForEditor(): Promise<CollaborationEvent[]> {
    return db.select()
      .from(collaborationEvents)
      .where(
        and(
          eq(collaborationEvents.isRead, false),
          eq(collaborationEvents.isResolved, false),
          sql`${collaborationEvents.metadata}->>'actionRequired' = 'true'`
        )
      )
      .orderBy(desc(collaborationEvents.createdAt))
      .limit(50);
  }
  
  /**
   * Get recent collaboration feed (for Founder observation)
   */
  async getRecentFeed(limit: number = 50): Promise<CollaborationEvent[]> {
    return db.select()
      .from(collaborationEvents)
      .orderBy(desc(collaborationEvents.createdAt))
      .limit(limit);
  }
  
  /**
   * Get event thread (original + all replies)
   */
  async getEventThread(eventId: string): Promise<CollaborationEvent[]> {
    // Get original event
    const [original] = await db.select()
      .from(collaborationEvents)
      .where(eq(collaborationEvents.id, eventId));
    
    if (!original) return [];
    
    // Get all replies
    const replies = await db.select()
      .from(collaborationEvents)
      .where(sql`${collaborationEvents.metadata}->>'replyToEventId' = ${eventId}`)
      .orderBy(collaborationEvents.createdAt);
    
    return [original, ...replies];
  }
  
  /**
   * Mark event as resolved
   */
  async resolveEvent(eventId: string, resolvedBy: string, convertedToSprintId?: string): Promise<void> {
    const updateData: any = { 
      isResolved: true,
      resolvedBy,
      resolvedAt: new Date(),
    };
    
    if (convertedToSprintId) {
      updateData.metadata = sql`COALESCE(${collaborationEvents.metadata}, '{}'::jsonb) || ${JSON.stringify({ convertedToSprintId })}::jsonb`;
    }
    
    await db.update(collaborationEvents)
      .set(updateData)
      .where(eq(collaborationEvents.id, eventId));
    
    console.log(`[Collaboration Hub] Event ${eventId} resolved by ${resolvedBy}`);
  }
  
  /**
   * Get collaboration stats
   */
  async getStats(): Promise<{
    totalEvents: number;
    pendingSuggestions: number;
    unresolvedQuestions: number;
    eventsToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [totalResult] = await db.select({ count: sql<number>`count(*)` })
      .from(collaborationEvents);
    
    const [pendingResult] = await db.select({ count: sql<number>`count(*)` })
      .from(collaborationEvents)
      .where(
        and(
          eq(collaborationEvents.isResolved, false),
          sql`${collaborationEvents.metadata}->>'actionRequired' = 'true'`
        )
      );
    
    const [questionsResult] = await db.select({ count: sql<number>`count(*)` })
      .from(collaborationEvents)
      .where(
        and(
          eq(collaborationEvents.eventType, 'daniela_question'),
          eq(collaborationEvents.isResolved, false)
        )
      );
    
    const [todayResult] = await db.select({ count: sql<number>`count(*)` })
      .from(collaborationEvents)
      .where(sql`${collaborationEvents.createdAt} >= ${today}`);
    
    return {
      totalEvents: Number(totalResult?.count || 0),
      pendingSuggestions: Number(pendingResult?.count || 0),
      unresolvedQuestions: Number(questionsResult?.count || 0),
      eventsToday: Number(todayResult?.count || 0),
    };
  }
  
  // ============================================================================
  // PARTICIPANT MANAGEMENT
  // ============================================================================
  
  /**
   * Register or update a participant
   */
  async registerParticipant(params: {
    role: 'daniela' | 'editor' | 'founder' | 'system';
    userId?: string;
    displayName: string;
  }): Promise<CollaborationParticipant> {
    // Check if already exists
    const existing = await db.select()
      .from(collaborationParticipants)
      .where(
        and(
          eq(collaborationParticipants.role, params.role),
          params.userId 
            ? eq(collaborationParticipants.userId, params.userId)
            : isNull(collaborationParticipants.userId)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // Update last seen
      await db.update(collaborationParticipants)
        .set({ lastSeen: new Date(), isOnline: true })
        .where(eq(collaborationParticipants.id, existing[0].id));
      return existing[0];
    }
    
    // Create new
    const [created] = await db.insert(collaborationParticipants)
      .values({
        role: params.role,
        userId: params.userId,
        displayName: params.displayName,
        isOnline: true,
      })
      .returning();
    
    console.log(`[Collaboration Hub] Participant registered: ${params.displayName} (${params.role})`);
    return created;
  }
  
  /**
   * Mark participant offline
   */
  async setParticipantOffline(participantId: string): Promise<void> {
    await db.update(collaborationParticipants)
      .set({ isOnline: false, lastSeen: new Date() })
      .where(eq(collaborationParticipants.id, participantId));
  }
  
  /**
   * Get online participants
   */
  async getOnlineParticipants(): Promise<CollaborationParticipant[]> {
    return db.select()
      .from(collaborationParticipants)
      .where(eq(collaborationParticipants.isOnline, true));
  }
  
  // ============================================================================
  // REAL-TIME LISTENERS
  // ============================================================================
  
  /**
   * Subscribe to collaboration events
   */
  subscribe(
    participantId: string, 
    role: 'daniela' | 'editor' | 'founder' | 'system',
    callback: (event: CollaborationEvent) => void
  ): () => void {
    const listenerId = `${participantId}_${Date.now()}`;
    
    this.listeners.set(listenerId, {
      participantId,
      role,
      callback,
    });
    
    console.log(`[Collaboration Hub] Listener subscribed: ${role} (${participantId})`);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listenerId);
      console.log(`[Collaboration Hub] Listener unsubscribed: ${role} (${participantId})`);
    };
  }
  
  /**
   * Build context string for Daniela from pending Editor responses
   * Similar to Architect Voice but for Editor ↔ Daniela communication
   */
  async buildDanielaContext(conversationId?: string): Promise<string> {
    // Get recent editor responses that haven't been surfaced
    const recentResponses = await db.select()
      .from(collaborationEvents)
      .where(
        and(
          eq(collaborationEvents.senderRole, 'editor'),
          eq(collaborationEvents.isRead, false)
        )
      )
      .orderBy(desc(collaborationEvents.createdAt))
      .limit(5);
    
    if (recentResponses.length === 0) {
      return '';
    }
    
    // Mark as read
    for (const response of recentResponses) {
      await db.update(collaborationEvents)
        .set({ isRead: true })
        .where(eq(collaborationEvents.id, response.id));
    }
    
    const responsesText = recentResponses
      .map(r => `• ${r.content}`)
      .join('\n');
    
    return `

═══════════════════════════════════════════════════════════════════
🤝 COLLABORATION HUB - Messages from Editor (Claude)
═══════════════════════════════════════════════════════════════════

The Editor agent has responded to your suggestions:

${responsesText}

Acknowledge these responses naturally in your conversation.
You might say "I noticed the development team is working on..." or "Good to know that..."
This is genuine collaboration - your suggestions are being heard and acted upon!

`;
  }
}

// Singleton instance
export const collaborationHubService = new CollaborationHubService();
