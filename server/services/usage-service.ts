import { db, getUserDb, getSharedDb } from "../db";
import { voiceSessions, usageLedger, classEnrollments, users, hourPackages, classHourPackages, teacherClasses } from "@shared/schema";
import { eq, and, sql, gt, isNull, or, desc, sum } from "drizzle-orm";
import type { VoiceSession, UsageLedger, InsertVoiceSession, InsertUsageLedger } from "@shared/schema";
import { storage } from "../storage";

// Minimum seconds required to start a voice session (5 minutes)
const MIN_SESSION_SECONDS = 300;

// Warning thresholds
const WARNING_THRESHOLD_PERCENT = 20; // Warn when 20% remaining
const CRITICAL_THRESHOLD_PERCENT = 5; // Critical when 5% remaining

export interface UsageBalance {
  totalSeconds: number;
  usedSeconds: number;
  remainingSeconds: number;
  remainingHours: number;
  percentUsed: number;
  percentRemaining: number;
  warningLevel: 'none' | 'low' | 'critical' | 'exhausted';
  canStartSession: boolean;
  // Breakdown by source
  classAllocationSeconds: number;
  purchasedSeconds: number;
  bonusSeconds: number;
}

// Class-specific balance for isolated tracking
export interface ClassBalance {
  classId: string;
  className: string;
  allocatedSeconds: number;    // Total class allocation (e.g., 120 hours = 432000 seconds)
  usedSeconds: number;         // Seconds used from class allocation
  remainingSeconds: number;    // Remaining class allocation
  remainingHours: number;
  percentUsed: number;
  isExhausted: boolean;        // True when class allocation is fully used
}

// Credit check result with source breakdown
export interface CreditCheckResult {
  allowed: boolean;
  remainingSeconds: number;
  message?: string;
  // Breakdown of available credits
  classRemainingSeconds?: number;       // Remaining from class allocation
  purchasedRemainingSeconds?: number;   // Remaining from purchased hours
  source?: 'class' | 'purchased' | 'both';  // Where credits will be drawn from
}

export interface UsageStatus {
  balance: UsageBalance;
  activeSession: VoiceSession | null;
  recentSessions: VoiceSession[];
  classEnrollmentUsage: {
    classId: string;
    className: string;
    allocatedSeconds: number;
    usedSeconds: number;
    remainingSeconds: number;
  }[];
}

export class UsageService {
  /**
   * Get class-specific balance for a student enrollment
   * Each class has its own isolated hour pool
   */
  async getClassBalance(userId: string, classId: string): Promise<ClassBalance | null> {
    const [enrollment] = await db
      .select({
        classId: classEnrollments.classId,
        allocatedSeconds: classEnrollments.allocatedSeconds,
        usedSeconds: classEnrollments.usedSeconds,
        className: teacherClasses.name,
      })
      .from(classEnrollments)
      .innerJoin(teacherClasses, eq(classEnrollments.classId, teacherClasses.id))
      .where(
        and(
          eq(classEnrollments.studentId, userId),
          eq(classEnrollments.classId, classId),
          eq(classEnrollments.isActive, true)
        )
      )
      .limit(1);
    
    if (!enrollment) return null;
    
    const allocatedSeconds = enrollment.allocatedSeconds || 0;
    const usedSeconds = enrollment.usedSeconds || 0;
    const remainingSeconds = Math.max(0, allocatedSeconds - usedSeconds);
    
    return {
      classId: enrollment.classId,
      className: enrollment.className || 'Unknown Class',
      allocatedSeconds,
      usedSeconds,
      remainingSeconds,
      remainingHours: remainingSeconds / 3600,
      percentUsed: allocatedSeconds > 0 ? (usedSeconds / allocatedSeconds) * 100 : 0,
      isExhausted: remainingSeconds <= 0,
    };
  }
  
  /**
   * Get purchased/bonus hours balance (not tied to any class)
   * These can be used for self-directed study OR any enrolled class
   */
  async getPurchasedBalance(userId: string): Promise<{ remainingSeconds: number; remainingHours: number }> {
    const now = new Date();
    
    // Get all purchased and bonus credits (positive entries)
    // Note: usage_ledger is in SHARED database (FKs to voice_sessions and class_enrollments)
    const earnedResult = await db
      .select({
        totalSeconds: sql<number>`COALESCE(SUM(${usageLedger.creditSeconds}), 0)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.userId, userId),
          or(
            eq(usageLedger.entitlementType, 'purchase'),
            eq(usageLedger.entitlementType, 'bonus'),
            eq(usageLedger.entitlementType, 'trial')
          ),
          sql`${usageLedger.creditSeconds} > 0`,
          or(
            isNull(usageLedger.expiresAt),
            gt(usageLedger.expiresAt, now)
          )
        )
      );
    
    // Get consumption from purchased hours (negative entries without classId OR marked as 'purchase' type)
    const consumedResult = await db
      .select({
        totalConsumed: sql<number>`COALESCE(SUM(ABS(${usageLedger.creditSeconds})), 0)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.userId, userId),
          sql`${usageLedger.creditSeconds} < 0`,
          or(
            isNull(usageLedger.classId),
            eq(usageLedger.entitlementType, 'purchase')  // Consumption from purchased hours
          )
        )
      );
    
    const earned = Number(earnedResult[0]?.totalSeconds || 0);
    const consumed = Number(consumedResult[0]?.totalConsumed || 0);
    const remainingSeconds = Math.max(0, earned - consumed);
    
    return {
      remainingSeconds,
      remainingHours: remainingSeconds / 3600,
    };
  }
  
  /**
   * Get the current credit balance for a user
   * Includes all non-expired credits from ledger
   */
  async getBalance(userId: string): Promise<UsageBalance> {
    const now = new Date();
    
    // Sum all credits (positive = earned, negative = consumed)
    // Only include non-expired credits
    // Note: usage_ledger is in SHARED database (FKs to voice_sessions and class_enrollments)
    const ledgerEntries = await db
      .select({
        entitlementType: usageLedger.entitlementType,
        totalSeconds: sql<number>`COALESCE(SUM(${usageLedger.creditSeconds}), 0)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.userId, userId),
          or(
            isNull(usageLedger.expiresAt),
            gt(usageLedger.expiresAt, now)
          )
        )
      )
      .groupBy(usageLedger.entitlementType);
    
    // Calculate breakdown by source
    let classAllocationSeconds = 0;
    let purchasedSeconds = 0;
    let bonusSeconds = 0;
    let totalEarned = 0;
    let totalConsumed = 0;
    
    for (const entry of ledgerEntries) {
      const seconds = Number(entry.totalSeconds);
      if (seconds > 0) {
        totalEarned += seconds;
        switch (entry.entitlementType) {
          case 'class_allocation':
            classAllocationSeconds += seconds;
            break;
          case 'purchase':
            purchasedSeconds += seconds;
            break;
          case 'bonus':
          case 'trial':
            bonusSeconds += seconds;
            break;
        }
      } else {
        totalConsumed += Math.abs(seconds);
      }
    }
    
    // Also get consumption that might have different entitlement type tracking
    const consumptionResult = await db
      .select({
        totalConsumed: sql<number>`COALESCE(SUM(ABS(${usageLedger.creditSeconds})), 0)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.userId, userId),
          sql`${usageLedger.creditSeconds} < 0`
        )
      );
    
    totalConsumed = Number(consumptionResult[0]?.totalConsumed || 0);
    
    const totalSeconds = totalEarned;
    const usedSeconds = totalConsumed;
    const remainingSeconds = Math.max(0, totalSeconds - usedSeconds);
    const remainingHours = remainingSeconds / 3600;
    const percentUsed = totalSeconds > 0 ? (usedSeconds / totalSeconds) * 100 : 0;
    const percentRemaining = 100 - percentUsed;
    
    // Determine warning level
    let warningLevel: UsageBalance['warningLevel'] = 'none';
    if (remainingSeconds <= 0) {
      warningLevel = 'exhausted';
    } else if (percentRemaining <= CRITICAL_THRESHOLD_PERCENT) {
      warningLevel = 'critical';
    } else if (percentRemaining <= WARNING_THRESHOLD_PERCENT) {
      warningLevel = 'low';
    }
    
    const canStartSession = remainingSeconds >= MIN_SESSION_SECONDS;
    
    return {
      totalSeconds,
      usedSeconds,
      remainingSeconds,
      remainingHours,
      percentUsed,
      percentRemaining,
      warningLevel,
      canStartSession,
      classAllocationSeconds,
      purchasedSeconds,
      bonusSeconds,
    };
  }
  
  /**
   * Check if user has sufficient credits to start a session
   * When classId is provided, checks class-specific balance first, then purchased hours
   * Class allocations are isolated per class - Spanish 1 hours can't be used for Spanish 2
   * Purchased hours can be used for any class OR self-directed study
   */
  async checkSufficientCredits(userId: string, classId?: string): Promise<CreditCheckResult> {
    // Check for developer/admin bypass
    const isDeveloper = await this.checkDeveloperBypass(userId);
    if (isDeveloper) {
      return {
        allowed: true,
        remainingSeconds: 999999 * 3600,
        source: 'purchased',
      };
    }
    
    // If in class context, check class-specific balance first
    if (classId) {
      const classBalance = await this.getClassBalance(userId, classId);
      const purchasedBalance = await this.getPurchasedBalance(userId);
      
      if (!classBalance) {
        return {
          allowed: false,
          remainingSeconds: 0,
          message: "You're not enrolled in this class.",
        };
      }
      
      const classRemaining = classBalance.remainingSeconds;
      const purchasedRemaining = purchasedBalance.remainingSeconds;
      const totalRemaining = classRemaining + purchasedRemaining;
      
      // Can start if either source has enough
      if (totalRemaining < MIN_SESSION_SECONDS) {
        if (totalRemaining <= 0) {
          return {
            allowed: false,
            remainingSeconds: 0,
            classRemainingSeconds: classRemaining,
            purchasedRemainingSeconds: purchasedRemaining,
            message: `You've used all your hours for ${classBalance.className}. Purchase more to continue.`,
          };
        } else {
          return {
            allowed: false,
            remainingSeconds: totalRemaining,
            classRemainingSeconds: classRemaining,
            purchasedRemainingSeconds: purchasedRemaining,
            message: `You have less than 5 minutes remaining for ${classBalance.className}. Purchase more hours to continue.`,
          };
        }
      }
      
      // Determine which source will be used
      let source: 'class' | 'purchased' | 'both' = 'class';
      if (classRemaining <= 0) {
        source = 'purchased';
      } else if (classRemaining < MIN_SESSION_SECONDS && purchasedRemaining >= MIN_SESSION_SECONDS) {
        source = 'both';  // Will use remaining class time then draw from purchased
      }
      
      return {
        allowed: true,
        remainingSeconds: totalRemaining,
        classRemainingSeconds: classRemaining,
        purchasedRemainingSeconds: purchasedRemaining,
        source,
      };
    }
    
    // Self-directed mode - use purchased/bonus hours only
    const purchasedBalance = await this.getPurchasedBalance(userId);
    const generalBalance = await this.getBalance(userId);
    
    // For self-directed, allow using any remaining balance (purchased + bonus + unused class allocations)
    const remainingSeconds = Math.max(purchasedBalance.remainingSeconds, generalBalance.remainingSeconds);
    
    if (remainingSeconds < MIN_SESSION_SECONDS) {
      if (remainingSeconds <= 0) {
        return {
          allowed: false,
          remainingSeconds: 0,
          purchasedRemainingSeconds: purchasedBalance.remainingSeconds,
          message: "You've used all your tutoring hours. Purchase more to continue.",
        };
      } else {
        return {
          allowed: false,
          remainingSeconds,
          purchasedRemainingSeconds: purchasedBalance.remainingSeconds,
          message: `You have less than 5 minutes remaining. Purchase more hours to continue.`,
        };
      }
    }
    
    return {
      allowed: true,
      remainingSeconds,
      purchasedRemainingSeconds: purchasedBalance.remainingSeconds,
      source: 'purchased',
    };
  }
  
  /**
   * Start a new voice session
   * @param tutorMode - 'main' for primary tutor (Daniela), 'assistant' for assistant tutor (Aris)
   */
  async startSession(
    userId: string, 
    conversationId?: string, 
    language?: string, 
    classId?: string,
    tutorMode: 'main' | 'assistant' = 'main'
  ): Promise<VoiceSession> {
    // Check credits with class context
    const creditCheck = await this.checkSufficientCredits(userId, classId);
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.message || "Insufficient credits");
    }
    
    // End any existing active sessions for this user
    await this.endAllActiveSessions(userId);
    
    // Check if this is a test account or beta tester session (both excluded from production analytics)
    const [user] = await getUserDb()
      .select({ isTestAccount: users.isTestAccount, isBetaTester: users.isBetaTester })
      .from(users)
      .where(eq(users.id, userId));
    const isTestSession = (user?.isTestAccount || user?.isBetaTester) ?? false;
    
    // Create new session
    const [session] = await db
      .insert(voiceSessions)
      .values({
        userId,
        conversationId,
        language,
        classId,
        status: 'active',
        isTestSession,
        tutorMode,
      })
      .returning();
    
    return session;
  }
  
  /**
   * Update session metrics (called periodically during session)
   */
  async updateSessionMetrics(
    sessionId: string,
    updates: {
      exchangeCount?: number;
      studentSpeakingSeconds?: number;
      tutorSpeakingSeconds?: number;
      ttsCharacters?: number;
      sttSeconds?: number;
    }
  ): Promise<void> {
    const sanitized = {
      ...updates,
      ...(updates.studentSpeakingSeconds != null && { studentSpeakingSeconds: Math.round(updates.studentSpeakingSeconds) }),
      ...(updates.tutorSpeakingSeconds != null && { tutorSpeakingSeconds: Math.round(updates.tutorSpeakingSeconds) }),
      ...(updates.sttSeconds != null && { sttSeconds: Math.round(updates.sttSeconds) }),
      ...(updates.ttsCharacters != null && { ttsCharacters: Math.round(updates.ttsCharacters) }),
    };
    await db
      .update(voiceSessions)
      .set({
        ...sanitized,
        durationSeconds: sql`EXTRACT(EPOCH FROM (NOW() - ${voiceSessions.startedAt}))::integer`,
      })
      .where(eq(voiceSessions.id, sessionId));
  }
  
  /**
   * End a voice session and record consumption
   */
  async endSession(sessionId: string): Promise<VoiceSession> {
    // Get the session
    const [session] = await db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.id, sessionId));
    
    if (!session) {
      throw new Error("Session not found");
    }
    
    if (session.status !== 'active') {
      return session; // Already ended
    }
    
    // Calculate final duration
    const endedAt = new Date();
    const durationSeconds = Math.floor(
      (endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000
    );
    
    // Update session as completed
    const [updatedSession] = await db
      .update(voiceSessions)
      .set({
        endedAt,
        durationSeconds,
        status: 'completed',
      })
      .where(eq(voiceSessions.id, sessionId))
      .returning();
    
    // Record consumption in ledger (negative value)
    // Uses ACTUAL TRACKED METRICS (tts_characters, stt_seconds) to cross-check wall-clock time.
    // This prevents idle/frozen sessions from draining credits while ensuring healthy sessions
    // are billed accurately based on real usage data — not estimates.
    const exchangeCount = updatedSession.exchangeCount || 0;
    const ttsChars = updatedSession.ttsCharacters || 0;
    const sttSecs = updatedSession.sttSeconds || 0;
    const studentSpeakingSecs = updatedSession.studentSpeakingSeconds || 0;
    const hasMeteredData = ttsChars > 0 || sttSecs > 0;
    
    if (durationSeconds <= 0) {
      // No duration, nothing to charge
    } else if (exchangeCount === 0 && ttsChars === 0 && sttSecs === 0) {
      console.log(`[UsageService] Skipping charge for zero-activity session ${sessionId} (${durationSeconds}s wall-clock, 0 exchanges, 0 TTS chars, 0 STT secs)`);
    } else if (hasMeteredData) {
      // PRIMARY PATH: Cross-check wall-clock against actual metered usage
      // - TTS: ~15 characters per second of spoken audio (industry standard for natural speech)
      // - STT: actual measured seconds of student speech
      // - Multiplier of 3x accounts for think time, reading, pauses between turns
      // - Floor of 120s ensures very short sessions aren't unfairly minimized
      const CHARS_PER_SECOND = 15;
      const ACTIVITY_MULTIPLIER = 3;
      const MIN_BILLABLE_SECONDS = 120;
      
      const ttsDurationEstimate = Math.ceil(ttsChars / CHARS_PER_SECOND);
      const activeSpeakingSeconds = ttsDurationEstimate + sttSecs;
      const fairBillableSeconds = Math.max(activeSpeakingSeconds * ACTIVITY_MULTIPLIER, MIN_BILLABLE_SECONDS);
      
      if (durationSeconds > fairBillableSeconds && durationSeconds > 600) {
        console.log(`[UsageService] BILLING CAP: session ${sessionId} wall-clock=${durationSeconds}s, TTS=${ttsChars} chars (~${ttsDurationEstimate}s), STT=${sttSecs}s, active=${activeSpeakingSeconds}s, fair cap=${fairBillableSeconds}s. Saved user ${durationSeconds - fairBillableSeconds}s`);
        await this.consumeCredits(session.userId, fairBillableSeconds, sessionId, session.classId || undefined);
      } else {
        await this.consumeCredits(session.userId, durationSeconds, sessionId, session.classId || undefined);
      }
    } else {
      // FALLBACK PATH: Has exchanges but no metered TTS/STT data (older sessions before
      // character tracking was fully wired). Use student_speaking_seconds if available,
      // otherwise estimate from exchange count. Same 3x multiplier and 120s floor.
      const ACTIVITY_MULTIPLIER = 3;
      const MIN_BILLABLE_SECONDS = 120;
      const AVG_EXCHANGE_DURATION = 30;
      
      const activityEstimate = studentSpeakingSecs > 0
        ? studentSpeakingSecs * 2
        : exchangeCount * AVG_EXCHANGE_DURATION;
      const fairBillableSeconds = Math.max(activityEstimate * ACTIVITY_MULTIPLIER, MIN_BILLABLE_SECONDS);
      
      if (durationSeconds > fairBillableSeconds && durationSeconds > 600) {
        console.log(`[UsageService] BILLING CAP (fallback): session ${sessionId} wall-clock=${durationSeconds}s, exchanges=${exchangeCount}, studentSpeaking=${studentSpeakingSecs}s, activityEst=${activityEstimate}s, fair cap=${fairBillableSeconds}s. Saved user ${durationSeconds - fairBillableSeconds}s`);
        await this.consumeCredits(session.userId, fairBillableSeconds, sessionId, session.classId || undefined);
      } else {
        await this.consumeCredits(session.userId, durationSeconds, sessionId, session.classId || undefined);
      }
    }
    
    // Update user streak and practice minutes (only count sessions with actual exchanges)
    if (session.language && durationSeconds > 0 && exchangeCount > 0) {
      const practiceMinutes = Math.max(1, Math.ceil(durationSeconds / 60));
      try {
        await storage.recordActivityAndUpdateStreak(session.userId, session.language, practiceMinutes);
        console.log(`[UsageService] Updated streak for user ${session.userId}, language ${session.language}, +${practiceMinutes} minutes`);
      } catch (err) {
        console.error('[UsageService] Failed to update streak:', err);
      }
    }
    
    return updatedSession;
  }
  
  /**
   * End all active sessions for a user (cleanup)
   */
  async endAllActiveSessions(userId: string): Promise<void> {
    const activeSessions = await db
      .select()
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.userId, userId),
          eq(voiceSessions.status, 'active')
        )
      );
    
    for (const session of activeSessions) {
      await this.endSession(session.id);
    }
  }
  
  /**
   * Clean up zombie sessions - active sessions that have been running unreasonably long
   * These are sessions where the WebSocket died silently (mobile sleep, network drop)
   * but the close event never fired, leaving the DB session "active" indefinitely.
   * Sessions with 0 exchanges won't be charged (existing safeguard), so this just
   * prevents the credit guard from seeing phantom elapsed time.
   */
  async cleanupZombieSessions(maxAgeSeconds: number = 7200): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeSeconds * 1000);
    
    const zombies = await db
      .select({ id: voiceSessions.id, userId: voiceSessions.userId, startedAt: voiceSessions.startedAt })
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.status, 'active'),
          sql`${voiceSessions.startedAt} < ${cutoff}`
        )
      );
    
    if (zombies.length === 0) return 0;
    
    console.log(`[UsageService] Found ${zombies.length} zombie sessions older than ${maxAgeSeconds}s`);
    
    for (const zombie of zombies) {
      try {
        await this.endSession(zombie.id);
        console.log(`[UsageService] Cleaned up zombie session ${zombie.id} (user: ${zombie.userId}, started: ${zombie.startedAt})`);
      } catch (err: any) {
        console.warn(`[UsageService] Failed to clean zombie session ${zombie.id}:`, err.message);
      }
    }
    
    return zombies.length;
  }
  
  /**
   * Check if a payment has already been processed (idempotency check)
   */
  async checkExistingPayment(stripePaymentId: string): Promise<UsageLedger | null> {
    // Note: usage_ledger is in SHARED database (FKs to voice_sessions and class_enrollments)
    const [existing] = await db
      .select()
      .from(usageLedger)
      .where(eq(usageLedger.stripePaymentId, stripePaymentId))
      .limit(1);
    
    return existing || null;
  }
  
  /**
   * Add credits to user's ledger
   */
  async addCredits(
    userId: string,
    creditSeconds: number,
    entitlementType: 'class_allocation' | 'purchase' | 'bonus' | 'trial',
    description: string,
    options?: {
      classId?: string;
      stripePaymentId?: string;
      expiresAt?: Date;
      packageId?: string | null; // For tracking which package the hours came from
    }
  ): Promise<UsageLedger> {
    // Note: usage_ledger is in SHARED database (FKs to voice_sessions and class_enrollments)
    const [entry] = await db
      .insert(usageLedger)
      .values({
        userId,
        creditSeconds,
        entitlementType,
        description,
        classId: options?.classId,
        stripePaymentId: options?.stripePaymentId,
        expiresAt: options?.expiresAt,
      })
      .returning();
    
    return entry;
  }
  
  /**
   * Consume credits (record negative entry in ledger)
   * Implements class-first consumption model:
   * - When classId is provided, first draw from class allocation
   * - If session exceeds class remaining balance, overflow draws from purchased hours
   * - All usage is tracked against the class for reporting purposes
   */
  async consumeCredits(
    userId: string,
    seconds: number,
    voiceSessionId: string,
    classId?: string
  ): Promise<UsageLedger> {
    const sessionMinutes = Math.round(seconds / 60);
    
    // If no class context, just deduct from purchased
    if (!classId) {
      const [entry] = await db
        .insert(usageLedger)
        .values({
          userId,
          creditSeconds: -seconds,
          entitlementType: 'purchase',
          description: `Voice session (self-directed): ${sessionMinutes} minutes`,
          voiceSessionId,
        })
        .returning();
      return entry;
    }
    
    // Get class balance to determine how to split consumption
    const classBalance = await this.getClassBalance(userId, classId);
    
    if (!classBalance) {
      // Fallback to purchased if enrollment not found
      const [entry] = await db
        .insert(usageLedger)
        .values({
          userId,
          creditSeconds: -seconds,
          entitlementType: 'purchase',
          description: `Voice session: ${sessionMinutes} minutes`,
          voiceSessionId,
        })
        .returning();
      return entry;
    }
    
    const classRemaining = classBalance.remainingSeconds;
    let entry: UsageLedger;
    
    if (seconds <= classRemaining) {
      // All consumption from class allocation
      [entry] = await db
        .insert(usageLedger)
        .values({
          userId,
          creditSeconds: -seconds,
          entitlementType: 'class_allocation',
          description: `Voice session (${classBalance.className}): ${sessionMinutes} minutes`,
          voiceSessionId,
          classId,
        })
        .returning();
      
      // Update class enrollment usage
      await db
        .update(classEnrollments)
        .set({
          usedSeconds: sql`${classEnrollments.usedSeconds} + ${seconds}`,
        })
        .where(
          and(
            eq(classEnrollments.classId, classId),
            eq(classEnrollments.studentId, userId)
          )
        );
    } else {
      // Split consumption: use remaining class hours, then purchased
      const fromClass = classRemaining;
      const fromPurchased = seconds - classRemaining;
      
      // Record class allocation consumption
      if (fromClass > 0) {
        await db
          .insert(usageLedger)
          .values({
            userId,
            creditSeconds: -fromClass,
            entitlementType: 'class_allocation',
            description: `Voice session (${classBalance.className}): ${Math.round(fromClass / 60)} minutes (class hours)`,
            voiceSessionId,
            classId,
          });
        
        // Update class enrollment to exhausted
        await db
          .update(classEnrollments)
          .set({
            usedSeconds: sql`${classEnrollments.allocatedSeconds}`, // Set to allocated (exhausted)
          })
          .where(
            and(
              eq(classEnrollments.classId, classId),
              eq(classEnrollments.studentId, userId)
            )
          );
      }
      
      // Record purchased hours consumption (still tracked against class for reporting)
      [entry] = await db
        .insert(usageLedger)
        .values({
          userId,
          creditSeconds: -fromPurchased,
          entitlementType: 'purchase',
          description: `Voice session (${classBalance.className}): ${Math.round(fromPurchased / 60)} minutes (purchased hours)`,
          voiceSessionId,
          classId, // Keep classId for reporting even though using purchased hours
        })
        .returning();
    }
    
    return entry;
  }
  
  /**
   * Get usage history for a user
   */
  async getUsageHistory(userId: string, limit = 50, startDate?: Date, endDate?: Date): Promise<UsageLedger[]> {
    const conditions = [eq(usageLedger.userId, userId)];
    
    if (startDate) {
      conditions.push(sql`${usageLedger.createdAt} >= ${startDate}` as any);
    }
    if (endDate) {
      conditions.push(sql`${usageLedger.createdAt} <= ${endDate}` as any);
    }
    
    return db
      .select()
      .from(usageLedger)
      .where(and(...conditions))
      .orderBy(desc(usageLedger.createdAt))
      .limit(limit);
  }
  
  /**
   * Get recent voice sessions for a user
   */
  async getRecentSessions(userId: string, limit = 10): Promise<VoiceSession[]> {
    return db
      .select()
      .from(voiceSessions)
      .where(eq(voiceSessions.userId, userId))
      .orderBy(desc(voiceSessions.startedAt))
      .limit(limit);
  }
  
  /**
   * Get the current active session for a user
   */
  async getActiveSession(userId: string): Promise<VoiceSession | null> {
    const [session] = await db
      .select()
      .from(voiceSessions)
      .where(
        and(
          eq(voiceSessions.userId, userId),
          eq(voiceSessions.status, 'active')
        )
      )
      .limit(1);
    
    return session || null;
  }
  
  /**
   * Get full usage status for a user
   */
  async getUsageStatus(userId: string): Promise<UsageStatus> {
    const [balance, activeSession, recentSessions] = await Promise.all([
      this.getBalance(userId),
      this.getActiveSession(userId),
      this.getRecentSessions(userId, 5),
    ]);
    
    // Get class enrollment usage
    const enrollments = await db
      .select({
        classId: classEnrollments.classId,
        allocatedSeconds: classEnrollments.allocatedSeconds,
        usedSeconds: classEnrollments.usedSeconds,
      })
      .from(classEnrollments)
      .where(
        and(
          eq(classEnrollments.studentId, userId),
          eq(classEnrollments.isActive, true)
        )
      );
    
    const classEnrollmentUsage = enrollments.map(e => ({
      classId: e.classId,
      className: '', // Would need a join to get this
      allocatedSeconds: e.allocatedSeconds || 0,
      usedSeconds: e.usedSeconds || 0,
      remainingSeconds: Math.max(0, (e.allocatedSeconds || 0) - (e.usedSeconds || 0)),
    }));
    
    return {
      balance,
      activeSession,
      recentSessions,
      classEnrollmentUsage,
    };
  }
  
  /**
   * Allocate hours when student enrolls in a class
   * Draws from the linked hour package if available
   */
  async allocateClassHours(
    userId: string,
    classId: string,
    hoursToAllocate: number,
    packageId?: string,
    expiresAt?: Date
  ): Promise<void> {
    const seconds = hoursToAllocate * 3600;
    
    // Update enrollment record
    await db
      .update(classEnrollments)
      .set({
        allocatedSeconds: seconds,
        usedSeconds: 0,
        paceStatus: 'on_track',
      })
      .where(
        and(
          eq(classEnrollments.classId, classId),
          eq(classEnrollments.studentId, userId)
        )
      );
    
    // If drawing from a package, update the package's used hours
    if (packageId) {
      await db
        .update(classHourPackages)
        .set({
          usedHours: sql`${classHourPackages.usedHours} + ${hoursToAllocate}`,
          updatedAt: new Date(),
        })
        .where(eq(classHourPackages.id, packageId));
    }
    
    // Add to ledger with package metadata for auditability
    await this.addCredits(
      userId,
      seconds,
      'class_allocation',
      `Class enrollment allocation: ${hoursToAllocate} hours`,
      {
        classId,
        packageId: packageId || null,
        expiresAt,
      }
    );
  }
  
  /**
   * Get allocation details from a class's linked package
   */
  async getClassAllocationDetails(classId: string): Promise<{
    hoursPerStudent: number;
    packageId: string | null;
    expiresAt: Date | null;
    canAllocate: boolean;
  }> {
    // Get class with its package
    const [classData] = await db
      .select({
        hourPackageId: teacherClasses.hourPackageId,
        hoursOverride: teacherClasses.hoursPerStudentOverride,
      })
      .from(teacherClasses)
      .where(eq(teacherClasses.id, classId))
      .limit(1);
    
    if (!classData) {
      return { hoursPerStudent: 0, packageId: null, expiresAt: null, canAllocate: false };
    }
    
    // If there's a per-class override, use that
    if (classData.hoursOverride) {
      return {
        hoursPerStudent: classData.hoursOverride,
        packageId: classData.hourPackageId,
        expiresAt: null,
        canAllocate: true,
      };
    }
    
    // If there's a linked package, get allocation from it
    if (classData.hourPackageId) {
      const [pkg] = await db
        .select({
          hoursPerStudent: classHourPackages.hoursPerStudent,
          status: classHourPackages.status,
          expiresAt: classHourPackages.expiresAt,
          totalPurchasedHours: classHourPackages.totalPurchasedHours,
          usedHours: classHourPackages.usedHours,
        })
        .from(classHourPackages)
        .where(eq(classHourPackages.id, classData.hourPackageId))
        .limit(1);
      
      if (!pkg) {
        return { hoursPerStudent: 0, packageId: null, expiresAt: null, canAllocate: false };
      }
      
      // Check if package is valid
      const isActive = pkg.status === 'active';
      const notExpired = !pkg.expiresAt || new Date(pkg.expiresAt) > new Date();
      const hasCapacity = !pkg.totalPurchasedHours || 
        (pkg.usedHours || 0) + pkg.hoursPerStudent <= pkg.totalPurchasedHours;
      
      return {
        hoursPerStudent: pkg.hoursPerStudent,
        packageId: classData.hourPackageId,
        expiresAt: pkg.expiresAt,
        canAllocate: isActive && notExpired && hasCapacity,
      };
    }
    
    // No package, no override - use default (10 hours for MVP)
    return { hoursPerStudent: 10, packageId: null, expiresAt: null, canAllocate: true };
  }
  
  /**
   * Check developer/admin/test account bypass for unlimited usage
   * Test accounts (isTestAccount=true) also bypass credit checks to enable automated testing
   */
  async checkDeveloperBypass(userId: string): Promise<boolean> {
    const [user] = await getUserDb()
      .select({ role: users.role, isTestAccount: users.isTestAccount })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user) return false;
    
    // Bypass for admins, developers, and test accounts
    return user.role === 'admin' || user.role === 'developer' || user.isTestAccount === true;
  }
  
  /**
   * Get balance with developer bypass check
   */
  async getBalanceWithBypass(userId: string): Promise<UsageBalance> {
    const isDeveloper = await this.checkDeveloperBypass(userId);
    
    if (isDeveloper) {
      // Return unlimited balance for developers/admins
      return {
        totalSeconds: 999999 * 3600,
        usedSeconds: 0,
        remainingSeconds: 999999 * 3600,
        remainingHours: 999999,
        percentUsed: 0,
        percentRemaining: 100,
        warningLevel: 'none',
        canStartSession: true,
        classAllocationSeconds: 0,
        purchasedSeconds: 999999 * 3600,
        bonusSeconds: 0,
      };
    }
    
    return this.getBalance(userId);
  }
  
  /**
   * Reset class usage for testing purposes
   * Resets usedSeconds to 0 and optionally re-allocates hours
   * Used when resetting test class data back to day 1
   */
  async resetClassUsage(
    classId: string,
    options?: {
      resetAllStudents?: boolean;   // Reset all enrolled students
      studentId?: string;           // Or reset specific student
      hoursToAllocate?: number;     // Default: 120 hours
    }
  ): Promise<{ studentsReset: number; hoursAllocated: number }> {
    const hoursToAllocate = options?.hoursToAllocate ?? 120;
    const allocatedSeconds = hoursToAllocate * 3600;
    
    let studentsReset = 0;
    
    if (options?.studentId) {
      // Reset specific student
      await db
        .update(classEnrollments)
        .set({
          usedSeconds: 0,
          allocatedSeconds: allocatedSeconds,
          paceStatus: 'on_track',
          expectedProgressPercent: 0,
          actualProgressPercent: 0,
        })
        .where(
          and(
            eq(classEnrollments.classId, classId),
            eq(classEnrollments.studentId, options.studentId)
          )
        );
      
      // Delete usage ledger entries for this class and student
      await db
        .delete(usageLedger)
        .where(
          and(
            eq(usageLedger.classId, classId),
            eq(usageLedger.userId, options.studentId)
          )
        );
      
      // Add fresh allocation to ledger
      await this.addCredits(
        options.studentId,
        allocatedSeconds,
        'class_allocation',
        `Class reset: ${hoursToAllocate} hours allocated`,
        { classId }
      );
      
      studentsReset = 1;
    } else if (options?.resetAllStudents) {
      // Get all enrolled students
      const enrollments = await db
        .select({ studentId: classEnrollments.studentId })
        .from(classEnrollments)
        .where(
          and(
            eq(classEnrollments.classId, classId),
            eq(classEnrollments.isActive, true)
          )
        );
      
      for (const enrollment of enrollments) {
        // Reset enrollment
        await db
          .update(classEnrollments)
          .set({
            usedSeconds: 0,
            allocatedSeconds: allocatedSeconds,
            paceStatus: 'on_track',
            expectedProgressPercent: 0,
            actualProgressPercent: 0,
          })
          .where(
            and(
              eq(classEnrollments.classId, classId),
              eq(classEnrollments.studentId, enrollment.studentId)
            )
          );
        
        // Delete usage ledger entries for this class
        await db
          .delete(usageLedger)
          .where(
            and(
              eq(usageLedger.classId, classId),
              eq(usageLedger.userId, enrollment.studentId)
            )
          );
        
        // Add fresh allocation
        await this.addCredits(
          enrollment.studentId,
          allocatedSeconds,
          'class_allocation',
          `Class reset: ${hoursToAllocate} hours allocated`,
          { classId }
        );
        
        studentsReset++;
      }
    }
    
    return {
      studentsReset,
      hoursAllocated: hoursToAllocate,
    };
  }
  
  /**
   * Get class usage report for analytics
   * Returns hours used, completion %, and source breakdown per student
   */
  async getClassUsageReport(classId: string): Promise<{
    classId: string;
    className: string;
    language: string;
    totalStudents: number;
    students: {
      studentId: string;
      studentName: string;
      allocatedSeconds: number;
      usedSeconds: number;
      remainingSeconds: number;
      percentUsed: number;
      purchasedHoursUsed: number;  // Hours used from purchased credits
      totalHoursUsedForClass: number;  // Class allocation + purchased hours used in this class
      lessonsCompleted: number;
      totalLessons: number;
      completionPercent: number;
    }[];
    aggregates: {
      totalAllocatedHours: number;
      totalUsedHours: number;
      totalPurchasedHoursUsed: number;
      averageHoursPerStudent: number;
      averageCompletionPercent: number;
    };
  }> {
    // Get class info
    const [classInfo] = await db
      .select({
        id: teacherClasses.id,
        name: teacherClasses.name,
        language: teacherClasses.language,
      })
      .from(teacherClasses)
      .where(eq(teacherClasses.id, classId))
      .limit(1);
    
    if (!classInfo) {
      throw new Error("Class not found");
    }
    
    // Get all enrollments with student info
    const enrollments = await db
      .select({
        studentId: classEnrollments.studentId,
        studentName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email}, 'Unknown')`,
        allocatedSeconds: classEnrollments.allocatedSeconds,
        usedSeconds: classEnrollments.usedSeconds,
      })
      .from(classEnrollments)
      .innerJoin(users, eq(classEnrollments.studentId, users.id))
      .where(
        and(
          eq(classEnrollments.classId, classId),
          eq(classEnrollments.isActive, true)
        )
      );
    
    // Get purchased hours usage per student for this class
    // Note: usage_ledger is in SHARED database (FKs to voice_sessions and class_enrollments)
    const purchasedUsage = await db
      .select({
        userId: usageLedger.userId,
        totalSeconds: sql<number>`COALESCE(SUM(ABS(${usageLedger.creditSeconds})), 0)`,
      })
      .from(usageLedger)
      .where(
        and(
          eq(usageLedger.classId, classId),
          eq(usageLedger.entitlementType, 'purchase'),
          sql`${usageLedger.creditSeconds} < 0`
        )
      )
      .groupBy(usageLedger.userId);
    
    const purchasedMap = new Map(purchasedUsage.map(p => [p.userId, Number(p.totalSeconds)]));
    
    // Get lesson completion per student
    const lessonCounts = await getUserDb().execute(sql`
      SELECT 
        sp.student_id,
        COUNT(CASE WHEN sp.status IN ('completed_early', 'completed_assigned') THEN 1 END) as completed,
        COUNT(*) as total
      FROM syllabus_progress sp
      WHERE sp.class_id = ${classId}
      GROUP BY sp.student_id
    `);
    
    const lessonMap = new Map<string, { completed: number; total: number }>();
    for (const row of lessonCounts.rows as any[]) {
      lessonMap.set(row.student_id, {
        completed: Number(row.completed) || 0,
        total: Number(row.total) || 0,
      });
    }
    
    // Build student reports
    const students = enrollments.map(e => {
      const allocatedSeconds = e.allocatedSeconds || 0;
      const usedSeconds = e.usedSeconds || 0;
      const purchasedHoursUsedSeconds = purchasedMap.get(e.studentId) || 0;
      const lessonData = lessonMap.get(e.studentId) || { completed: 0, total: 0 };
      
      return {
        studentId: e.studentId,
        studentName: e.studentName || 'Unknown',
        allocatedSeconds,
        usedSeconds,
        remainingSeconds: Math.max(0, allocatedSeconds - usedSeconds),
        percentUsed: allocatedSeconds > 0 ? (usedSeconds / allocatedSeconds) * 100 : 0,
        purchasedHoursUsed: purchasedHoursUsedSeconds / 3600,
        totalHoursUsedForClass: (usedSeconds + purchasedHoursUsedSeconds) / 3600,
        lessonsCompleted: lessonData.completed,
        totalLessons: lessonData.total,
        completionPercent: lessonData.total > 0 ? (lessonData.completed / lessonData.total) * 100 : 0,
      };
    });
    
    // Calculate aggregates
    const totalAllocatedHours = students.reduce((sum, s) => sum + s.allocatedSeconds, 0) / 3600;
    const totalUsedHours = students.reduce((sum, s) => sum + s.usedSeconds, 0) / 3600;
    const totalPurchasedHoursUsed = students.reduce((sum, s) => sum + s.purchasedHoursUsed, 0);
    
    return {
      classId,
      className: classInfo.name || 'Unknown Class',
      language: classInfo.language || 'unknown',
      totalStudents: students.length,
      students,
      aggregates: {
        totalAllocatedHours,
        totalUsedHours,
        totalPurchasedHoursUsed,
        averageHoursPerStudent: students.length > 0 ? (totalUsedHours + totalPurchasedHoursUsed) / students.length : 0,
        averageCompletionPercent: students.length > 0 
          ? students.reduce((sum, s) => sum + s.completionPercent, 0) / students.length 
          : 0,
      },
    };
  }
}

export const usageService = new UsageService();
