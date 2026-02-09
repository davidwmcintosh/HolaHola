/**
 * Daniela's Compass - Time-Aware Tutoring Service
 * 
 * Philosophy: "We define who the Tutor IS, not what the Tutor does"
 * - Provides real-time context instead of preset flexibility levels
 * - Gives Daniela a clock, syllabus visibility, and pacing awareness
 * - Trusts the tutor to balance warmth with progress
 * 
 * This service manages tutor session state with an in-memory cache
 * for fast prompt assembly (no DB reads per turn).
 */

import { getUserDb, getSharedDb } from "../db";
import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";
import {
  tutorSessions,
  tutorSessionTopics,
  tutorParkingItems,
  conversations,
  users,
  classEnrollments,
  teacherClasses,
  messages,
  type TutorSession,
  type TutorSessionTopic,
  type TutorParkingItem,
  type CompassContext,
  type InsertTutorSession,
  type InsertTutorSessionTopic,
  type InsertTutorParkingItem,
  type TopicCoverageStatus,
  type TutorFreedomLevel,
} from "@shared/schema";
import { usageService } from "./usage-service";
import { GoogleGenAI } from "@google/genai";

// Lazy-initialized Gemini client for summary generation
// (ensures env vars are available at runtime, not module load time)
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API key not configured (AI_INTEGRATIONS_GEMINI_API_KEY)');
    }
    // Must include httpOptions to match streaming service configuration
    geminiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        apiVersion: "",
        baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL || '',
      },
    });
  }
  return geminiClient;
}

// Compass is always on — credit tracking for paid accounts requires it.
// If compass fails to initialize, errors are surfaced rather than silently falling back.
export const COMPASS_ENABLED = true;

// Runtime cache for active sessions (fast prompt assembly)
interface CachedSession {
  session: TutorSession;
  topics: TutorSessionTopic[];
  parkingItems: TutorParkingItem[];
  lastUpdated: Date;
  // Credit balance cached separately with its own TTL
  creditBalance?: CompassContext['creditBalance'];
  creditBalanceUpdated?: Date;
  // ACTFL proficiency from user profile (cached for fast access)
  actflLevel: string | null;
  actflAssessed: boolean;
  actflSource: string | null;
  // Student timezone for correct CLOCK display (e.g., "America/Denver")
  studentTimezone: string | null;
}

const sessionCache = new Map<string, CachedSession>();

// Cache TTL: 5 minutes (sessions are long-lived, cache is refreshed on updates)
const CACHE_TTL_MS = 5 * 60 * 1000;
// Credit balance TTL: 1 minute (credits can change more frequently)
const CREDIT_BALANCE_TTL_MS = 60 * 1000;

export class SessionCompassService {
  /**
   * Compass is always enabled — credit tracking requires it.
   * Kept as a method for interface compatibility.
   */
  isEnabled(userId: string, classId?: string | null): boolean {
    return true;
  }

  /**
   * Initialize a new Compass session when voice chat starts
   * Creates session record and loads student context
   */
  async initializeSession(params: {
    conversationId: string;
    userId: string;
    classId?: string | null;
    scheduledDurationMinutes?: number;
    legacyFreedomLevel?: TutorFreedomLevel;
  }): Promise<TutorSession | null> {
    const {
      conversationId,
      userId,
      classId,
      scheduledDurationMinutes = 30,
      legacyFreedomLevel,
    } = params;

    if (!this.isEnabled(userId, classId)) {
      return null;
    }

    try {
      // Load student context
      const user = await getUserDb()
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      const student = user[0];
      if (!student) return null;

      // Get last session summary for continuity (tutorSessions is SHARED table)
      // Query for sessions that actually have a summary (completed sessions)
      // This prevents finding active sessions without summaries
      const lastSessions = await getSharedDb()
        .select()
        .from(tutorSessions)
        .where(
          and(
            eq(tutorSessions.userId, userId),
            isNotNull(tutorSessions.sessionSummary)
          )
        )
        .orderBy(desc(tutorSessions.createdAt))
        .limit(1);
      
      const lastSession = lastSessions[0];
      const lastSessionSummary = lastSession?.sessionSummary || null;
      
      if (lastSessionSummary) {
        console.log(`[Compass] Found previous session summary: "${lastSessionSummary.substring(0, 50)}..."`);
      } else {
        console.log(`[Compass] No previous session summary found for user ${userId}`);
      }

      // Build student goals from profile and class context
      let studentGoals: string | null = null;
      let studentInterests: string | null = null;

      if (classId) {
        // Get class info for context (teacherClasses is SHARED table)
        const classInfo = await getSharedDb()
          .select()
          .from(teacherClasses)
          .where(eq(teacherClasses.id, classId))
          .limit(1);
        
        if (classInfo[0]) {
          studentGoals = `Learning ${classInfo[0].language} in ${classInfo[0].name}`;
        }
      }

      // Create the session (tutorSessions is SHARED table)
      const sessionData: InsertTutorSession = {
        conversationId,
        userId,
        classId: classId || null,
        scheduledDurationMinutes,
        warmthBufferMinutes: 3, // Daniela's ideal: 2-3 min warmth buffer
        status: 'active',
        startedAt: new Date(),
        studentName: student.firstName || null,
        studentGoals,
        studentInterests,
        lastSessionSummary,
        elapsedSeconds: 0,
        topicsCoveredJson: JSON.stringify([]),
        topicsPendingJson: JSON.stringify([]),
        legacyFreedomLevel,
      };

      const [session] = await getSharedDb()
        .insert(tutorSessions)
        .values(sessionData)
        .returning();

      // Load any unresolved parking items from this user's previous sessions only
      // SECURITY: Must filter by userId to prevent data leakage
      const previousParkingItems = await getUserDb()
        .select({
          item: tutorParkingItems,
        })
        .from(tutorParkingItems)
        .innerJoin(
          tutorSessions,
          eq(tutorParkingItems.sessionId, tutorSessions.id)
        )
        .where(
          and(
            eq(tutorSessions.userId, userId), // CRITICAL: scope to current user
            eq(tutorParkingItems.carryForward, true),
            isNull(tutorParkingItems.resolvedAt)
          )
        )
        .orderBy(desc(tutorParkingItems.createdAt))
        .limit(5);

      // Cache the session (extract items from joined query result)
      // Include ACTFL proficiency from user profile for emergent neural network awareness
      sessionCache.set(conversationId, {
        session,
        topics: [],
        parkingItems: previousParkingItems.map(r => r.item),
        lastUpdated: new Date(),
        actflLevel: student.actflLevel || null,
        actflAssessed: student.actflAssessed || false,
        actflSource: student.assessmentSource || null,
        studentTimezone: student.timezone || null,
      });

      console.log(`[Compass] Initialized session for conversation ${conversationId}`);
      return session;
    } catch (error) {
      console.error('[Compass] Failed to initialize session:', error);
      return null;
    }
  }

  /**
   * Get Compass context for prompt assembly
   * Uses cache for fast access, falls back to DB if needed
   * Includes dual time tracking (clock time + credit balance)
   */
  async getCompassContext(conversationId: string): Promise<CompassContext | null> {
    // Check cache first
    let cached = sessionCache.get(conversationId);
    
    let baseContext: CompassContext;
    let userId: string;
    let classId: string | null = null;
    let needsCreditRefresh = false;
    
    if (cached && (Date.now() - cached.lastUpdated.getTime()) < CACHE_TTL_MS) {
      // Session cache is fresh - use it
      baseContext = this.buildContextFromCache(cached);
      userId = cached.session.userId;
      classId = cached.session.classId;
      
      // Check if credit balance needs refresh (separate, shorter TTL)
      needsCreditRefresh = !cached.creditBalanceUpdated || 
        (Date.now() - cached.creditBalanceUpdated.getTime()) >= CREDIT_BALANCE_TTL_MS;
    } else {
      // Cache miss or stale - load from DB (tutorSessions is SHARED table)
      const sessions = await getSharedDb()
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.conversationId, conversationId))
        .orderBy(desc(tutorSessions.createdAt))
        .limit(1);

      const session = sessions[0];
      if (!session) return null;

      // Load topics (tutorSessionTopics is SHARED table)
      const topics = await getSharedDb()
        .select()
        .from(tutorSessionTopics)
        .where(eq(tutorSessionTopics.sessionId, session.id))
        .orderBy(tutorSessionTopics.sortOrder);

      // Load parking items (tutorParkingItems is USER table)
      const parkingItems = await getUserDb()
        .select()
        .from(tutorParkingItems)
        .where(
          and(
            eq(tutorParkingItems.sessionId, session.id),
            isNull(tutorParkingItems.resolvedAt)
          )
        );

      // Load user's ACTFL proficiency for emergent neural network awareness
      const userResult = await getUserDb()
        .select({
          actflLevel: users.actflLevel,
          actflAssessed: users.actflAssessed,
          assessmentSource: users.assessmentSource,
          timezone: users.timezone,
        })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);
      
      const userActfl = userResult[0];

      // Update cache
      const cacheEntry: CachedSession = {
        session,
        topics,
        parkingItems,
        lastUpdated: new Date(),
        actflLevel: userActfl?.actflLevel || null,
        actflAssessed: userActfl?.actflAssessed || false,
        actflSource: userActfl?.assessmentSource || null,
        studentTimezone: userActfl?.timezone || null,
      };
      sessionCache.set(conversationId, cacheEntry);
      cached = cacheEntry;

      baseContext = this.buildContextFromCache(cacheEntry);
      userId = session.userId;
      classId = session.classId;
      needsCreditRefresh = true; // New cache entry needs credit balance
    }
    
    // DUAL TIME TRACKING: Get credit balance (with its own cache TTL)
    let creditBalance = cached?.creditBalance;
    if (needsCreditRefresh) {
      creditBalance = await this.getCreditBalance(userId, classId);
      // Update cache with fresh credit balance
      if (cached) {
        cached.creditBalance = creditBalance;
        cached.creditBalanceUpdated = new Date();
      }
    }
    
    return {
      ...baseContext,
      creditBalance,
    };
  }
  
  /**
   * Get credit balance for dual time tracking
   * Returns user's remaining credits with context for Daniela
   */
  private async getCreditBalance(userId: string, classId: string | null): Promise<CompassContext['creditBalance']> {
    try {
      // Check for developer bypass first
      const isDeveloper = await usageService.checkDeveloperBypass(userId);
      if (isDeveloper) {
        return {
          remainingSeconds: 999999,
          remainingMinutes: 999999 / 60,
          isLow: false,
          estimatedSessionsLeft: 999,
          source: 'unlimited' as const,
        };
      }
      
      // Get balance based on class context
      if (classId) {
        const classBalance = await usageService.getClassBalance(userId, classId);
        if (classBalance) {
          const remainingSeconds = classBalance.remainingSeconds;
          return {
            remainingSeconds,
            remainingMinutes: Math.round(remainingSeconds / 60),
            isLow: remainingSeconds < 600, // Under 10 minutes
            estimatedSessionsLeft: Math.floor(remainingSeconds / 1800), // 30-min sessions
            source: 'class_allocation' as const,
          };
        }
      }
      
      // Fall back to purchased balance
      const purchasedBalance = await usageService.getPurchasedBalance(userId);
      const remainingSeconds = purchasedBalance.remainingSeconds;
      
      return {
        remainingSeconds,
        remainingMinutes: Math.round(remainingSeconds / 60),
        isLow: remainingSeconds < 600, // Under 10 minutes
        estimatedSessionsLeft: Math.floor(remainingSeconds / 1800), // 30-min sessions
        source: 'purchased' as const,
      };
    } catch (error) {
      console.error('[Compass] Failed to get credit balance:', error);
      return undefined;
    }
  }

  /**
   * Build CompassContext from cached data
   * This is the fast path - no DB access
   */
  private buildContextFromCache(cached: CachedSession): CompassContext {
    const { session, topics, parkingItems } = cached;
    
    const scheduledSeconds = (session.scheduledDurationMinutes || 30) * 60;
    const elapsedSeconds = session.elapsedSeconds || 0;
    const remainingSeconds = Math.max(0, scheduledSeconds - elapsedSeconds);

    // Separate must-have from nice-to-have topics
    const mustHaveTopics = topics
      .filter(t => t.priority === 'must_have')
      .map(t => ({
        id: t.id,
        title: t.title,
        targetMinutes: t.targetMinutes || 10,
        status: (t.status || 'pending') as TopicCoverageStatus,
      }));

    const niceToHaveTopics = topics
      .filter(t => t.priority === 'nice_to_have' || t.priority === 'bonus')
      .map(t => ({
        id: t.id,
        title: t.title,
        targetMinutes: t.targetMinutes || 10,
        status: (t.status || 'pending') as TopicCoverageStatus,
      }));

    // Parse topic status arrays
    let topicsCovered: string[] = [];
    let topicsPending: string[] = [];
    try {
      topicsCovered = JSON.parse(session.topicsCoveredJson || '[]');
      topicsPending = JSON.parse(session.topicsPendingJson || '[]');
    } catch {
      // Ignore parse errors
    }

    // Calculate pacing - are we on track?
    // If we have topics, check if covered topics match expected pace
    const totalMustHaveMinutes = mustHaveTopics.reduce((sum, t) => sum + t.targetMinutes, 0);
    const coveredMustHaveMinutes = mustHaveTopics
      .filter(t => t.status === 'covered' || t.status === 'in_progress')
      .reduce((sum, t) => sum + t.targetMinutes, 0);
    
    // Rough pacing check: are we ahead or behind?
    const elapsedMinutes = elapsedSeconds / 60;
    const expectedCoveredMinutes = (elapsedMinutes / (session.scheduledDurationMinutes || 30)) * totalMustHaveMinutes;
    const isOnTrack = coveredMustHaveMinutes >= expectedCoveredMinutes * 0.8; // 80% buffer

    // Wall clock time - answers "what time is it?"
    // Use student's timezone when available so Daniela greets appropriately
    const now = new Date();
    const currentTimeUTC = now.toISOString();
    const displayTimezone = cached.studentTimezone || 'UTC';
    const timezoneLabel = cached.studentTimezone || 'UTC';
    let currentTimeFormatted: string;
    try {
      currentTimeFormatted = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: displayTimezone
      }) + ', ' + now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true,
        timeZone: displayTimezone
      }) + ` (${timezoneLabel})`;
    } catch {
      currentTimeFormatted = now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC'
      }) + ', ' + now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC'
      }) + ' UTC';
    }

    return {
      studentName: session.studentName,
      studentGoals: session.studentGoals,
      studentInterests: session.studentInterests,
      lastSessionSummary: session.lastSessionSummary,
      
      // ACTFL proficiency (emergent neural network awareness)
      studentActflLevel: cached.actflLevel,
      studentActflAssessed: cached.actflAssessed,
      studentActflSource: cached.actflSource,
      
      sessionDurationMinutes: session.scheduledDurationMinutes || 30,
      warmthBufferMinutes: session.warmthBufferMinutes || 3,
      mustHaveTopics,
      niceToHaveTopics,
      
      currentTimeUTC,
      currentTimeFormatted,
      
      elapsedSeconds,
      remainingSeconds,
      topicsCovered,
      topicsPending,
      isOnTrack,
      
      parkingLotItems: parkingItems.map(p => ({
        id: p.id,
        content: p.content,
        createdAt: p.createdAt,
      })),
      
      legacyFreedomLevel: session.legacyFreedomLevel || undefined,
    };
  }

  /**
   * Update elapsed time (called periodically during session)
   */
  async updateElapsedTime(conversationId: string, elapsedSeconds: number): Promise<void> {
    const cached = sessionCache.get(conversationId);
    if (!cached) return;

    // Update cache immediately for fast reads
    cached.session = { ...cached.session, elapsedSeconds };
    cached.lastUpdated = new Date();

    // Async DB update (non-blocking) - tutorSessions is SHARED table
    getSharedDb().update(tutorSessions)
      .set({ elapsedSeconds, updatedAt: new Date() })
      .where(eq(tutorSessions.id, cached.session.id))
      .execute()
      .catch(err => console.error('[Compass] Failed to update elapsed time:', err));
  }

  /**
   * Add topic to session roadmap
   */
  async addTopic(params: InsertTutorSessionTopic): Promise<TutorSessionTopic | null> {
    try {
      // tutorSessionTopics is SHARED table
      const [topic] = await getSharedDb()
        .insert(tutorSessionTopics)
        .values(params)
        .returning();

      // Update cache - tutorSessions is SHARED table
      const sessionResult = await getSharedDb()
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.id, params.sessionId))
        .limit(1);
      
      const session = sessionResult[0];
      if (session) {
        const cached = sessionCache.get(session.conversationId);
        if (cached) {
          cached.topics = [...cached.topics, topic];
          cached.lastUpdated = new Date();
        }
      }

      return topic;
    } catch (error) {
      console.error('[Compass] Failed to add topic:', error);
      return null;
    }
  }

  /**
   * Update topic status
   */
  async updateTopicStatus(topicId: string, status: TopicCoverageStatus, notes?: string): Promise<void> {
    try {
      // tutorSessionTopics is SHARED table
      await getSharedDb()
        .update(tutorSessionTopics)
        .set({ 
          status, 
          coverageNotes: notes,
        })
        .where(eq(tutorSessionTopics.id, topicId));

      // Invalidate cache for session containing this topic
      // (will be refreshed on next read)
      for (const [convId, cached] of Array.from(sessionCache.entries())) {
        if (cached.topics.some((t: TutorSessionTopic) => t.id === topicId)) {
          cached.topics = cached.topics.map((t: TutorSessionTopic) => 
            t.id === topicId ? { ...t, status, coverageNotes: notes || t.coverageNotes } : t
          );
          cached.lastUpdated = new Date();
          break;
        }
      }
    } catch (error) {
      console.error('[Compass] Failed to update topic status:', error);
    }
  }

  /**
   * Add item to parking lot
   * Convenience overload accepts sessionId, content, source directly
   */
  async addParkingItem(
    sessionIdOrParams: string | InsertTutorParkingItem,
    content?: string,
    source?: string
  ): Promise<TutorParkingItem | null> {
    // Support both object and positional params
    const params: InsertTutorParkingItem = typeof sessionIdOrParams === 'string'
      ? { sessionId: sessionIdOrParams, content: content!, context: source }
      : sessionIdOrParams;

    try {
      // tutorParkingItems is USER table, keep getUserDb()
      const [item] = await getUserDb()
        .insert(tutorParkingItems)
        .values(params)
        .returning();

      // Update cache - tutorSessions is SHARED table
      const sessionResult = await getSharedDb()
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.id, params.sessionId))
        .limit(1);
      
      const session = sessionResult[0];
      if (session) {
        const cached = sessionCache.get(session.conversationId);
        if (cached) {
          cached.parkingItems = [...cached.parkingItems, item];
          cached.lastUpdated = new Date();
        }
      }

      console.log(`[Compass] Parked: "${params.content.substring(0, 50)}..."`);
      return item;
    } catch (error) {
      console.error('[Compass] Failed to add parking item:', error);
      return null;
    }
  }

  /**
   * Resolve a parking item (it was addressed)
   */
  async resolveParkingItem(itemId: string, resolvedInSessionId?: string): Promise<void> {
    try {
      await getUserDb()
        .update(tutorParkingItems)
        .set({
          resolvedAt: new Date(),
          resolvedInSessionId,
          carryForward: false,
        })
        .where(eq(tutorParkingItems.id, itemId));

      // Update cache
      for (const cached of Array.from(sessionCache.values())) {
        const itemIndex = cached.parkingItems.findIndex((p: TutorParkingItem) => p.id === itemId);
        if (itemIndex >= 0) {
          cached.parkingItems = cached.parkingItems.filter((p: TutorParkingItem) => p.id !== itemId);
          cached.lastUpdated = new Date();
          break;
        }
      }
    } catch (error) {
      console.error('[Compass] Failed to resolve parking item:', error);
    }
  }

  /**
   * Generate a session summary using Gemini
   * Creates a brief, memorable summary for the next session's context
   */
  async generateSessionSummary(conversationId: string): Promise<string | null> {
    try {
      // Get conversation messages (SHARED table - use getSharedDb)
      const conversationMessages = await getSharedDb()
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(messages.createdAt);
      
      if (conversationMessages.length < 2) {
        return null; // Too short to summarize
      }
      
      // Get conversation details for context (SHARED table - use getSharedDb)
      const [conversation] = await getSharedDb()
        .select()
        .from(conversations)
        .where(eq(conversations.id, conversationId))
        .limit(1);
      
      // Build conversation transcript (last 20 messages max)
      const recentMessages = conversationMessages.slice(-20);
      const transcript = recentMessages
        .map(m => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content}`)
        .join('\n');
      
      const prompt = `You are summarizing a language tutoring session for the tutor's memory.
Create a brief, personal summary (2-3 sentences) that captures:
- What topics or vocabulary were practiced
- Any notable moments, struggles, or breakthroughs
- The emotional tone of the session
- Any interests or goals the student mentioned

Write in second person as if reminding the tutor: "You worked on..." or "The student..."
Keep it warm and conversational, not clinical.

Language being learned: ${conversation?.language || 'Spanish'}

Session transcript:
${transcript}

Summary (2-3 sentences):`;

      const response = await getGeminiClient().models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          temperature: 0.5,
          maxOutputTokens: 256,
        },
      });
      
      const summary = response.text?.trim();
      if (summary && summary.length > 10) {
        console.log(`[Compass] Generated session summary: ${summary.substring(0, 80)}...`);
        return summary;
      }
      
      return null;
    } catch (error: any) {
      console.error('[Compass] Failed to generate session summary:', error.message);
      return null;
    }
  }

  /**
   * End session and save summary
   */
  async endSession(conversationId: string, summary?: string, notes?: string): Promise<void> {
    const cached = sessionCache.get(conversationId);
    if (!cached) return;

    try {
      // Calculate deferred topics
      const deferredTopics = cached.topics
        .filter(t => t.status === 'pending' || t.status === 'partial')
        .map(t => t.title);

      // tutorSessions is a SHARED table - use getSharedDb()
      await getSharedDb()
        .update(tutorSessions)
        .set({
          status: 'completed',
          endedAt: new Date(),
          sessionSummary: summary,
          tutorNotes: notes,
          deferredTopicsJson: JSON.stringify(deferredTopics),
          updatedAt: new Date(),
        })
        .where(eq(tutorSessions.id, cached.session.id));

      // Clear cache
      sessionCache.delete(conversationId);
      
      console.log(`[Compass] Session ended for conversation ${conversationId}`);
    } catch (error) {
      console.error('[Compass] Failed to end session:', error);
    }
  }

  /**
   * Get active session for a conversation (if any)
   */
  async getActiveSession(conversationId: string): Promise<TutorSession | null> {
    const cached = sessionCache.get(conversationId);
    if (cached && cached.session.status === 'active') {
      return cached.session;
    }

    // tutorSessions is SHARED table
    const sessions = await getSharedDb()
      .select()
      .from(tutorSessions)
      .where(
        and(
          eq(tutorSessions.conversationId, conversationId),
          eq(tutorSessions.status, 'active')
        )
      )
      .limit(1);

    return sessions[0] || null;
  }

  /**
   * Get session by ID
   */
  async getSessionById(sessionId: string): Promise<TutorSession | null> {
    // tutorSessions is SHARED table
    const sessions = await getSharedDb()
      .select()
      .from(tutorSessions)
      .where(eq(tutorSessions.id, sessionId))
      .limit(1);

    return sessions[0] || null;
  }

  /**
   * Get topic by ID
   */
  async getTopicById(topicId: string): Promise<TutorSessionTopic | null> {
    // tutorSessionTopics is SHARED table
    const topics = await getSharedDb()
      .select()
      .from(tutorSessionTopics)
      .where(eq(tutorSessionTopics.id, topicId))
      .limit(1);

    return topics[0] || null;
  }

  /**
   * Clear stale cache entries (call periodically)
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [convId, cached] of Array.from(sessionCache.entries())) {
      if (now - cached.lastUpdated.getTime() > CACHE_TTL_MS) {
        sessionCache.delete(convId);
      }
    }
  }
}

// Singleton instance
export const sessionCompassService = new SessionCompassService();

// Cleanup interval (every 5 minutes)
setInterval(() => {
  sessionCompassService.cleanupCache();
}, CACHE_TTL_MS);
