import { db } from "../db";
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
   * Get the current credit balance for a user
   * Includes all non-expired credits from ledger
   */
  async getBalance(userId: string): Promise<UsageBalance> {
    const now = new Date();
    
    // Sum all credits (positive = earned, negative = consumed)
    // Only include non-expired credits
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
   */
  async checkSufficientCredits(userId: string): Promise<{ allowed: boolean; remainingSeconds: number; message?: string }> {
    const balance = await this.getBalance(userId);
    
    if (!balance.canStartSession) {
      if (balance.remainingSeconds <= 0) {
        return {
          allowed: false,
          remainingSeconds: 0,
          message: "You've used all your tutoring hours. Purchase more to continue.",
        };
      } else {
        return {
          allowed: false,
          remainingSeconds: balance.remainingSeconds,
          message: `You have less than 5 minutes remaining. Purchase more hours to continue.`,
        };
      }
    }
    
    return {
      allowed: true,
      remainingSeconds: balance.remainingSeconds,
    };
  }
  
  /**
   * Start a new voice session
   */
  async startSession(userId: string, conversationId?: string, language?: string, classId?: string): Promise<VoiceSession> {
    // Check credits first
    const creditCheck = await this.checkSufficientCredits(userId);
    if (!creditCheck.allowed) {
      throw new Error(creditCheck.message || "Insufficient credits");
    }
    
    // End any existing active sessions for this user
    await this.endAllActiveSessions(userId);
    
    // Create new session
    const [session] = await db
      .insert(voiceSessions)
      .values({
        userId,
        conversationId,
        language,
        classId,
        status: 'active',
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
    await db
      .update(voiceSessions)
      .set({
        ...updates,
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
    if (durationSeconds > 0) {
      await this.consumeCredits(session.userId, durationSeconds, sessionId, session.classId || undefined);
    }
    
    // Update user streak and practice minutes (any completed session counts toward streak)
    if (session.language && durationSeconds > 0) {
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
   * Check if a payment has already been processed (idempotency check)
   */
  async checkExistingPayment(stripePaymentId: string): Promise<UsageLedger | null> {
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
    }
  ): Promise<UsageLedger> {
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
   */
  async consumeCredits(
    userId: string,
    seconds: number,
    voiceSessionId: string,
    classId?: string
  ): Promise<UsageLedger> {
    const [entry] = await db
      .insert(usageLedger)
      .values({
        userId,
        creditSeconds: -seconds, // Negative for consumption
        entitlementType: classId ? 'class_allocation' : 'purchase',
        description: `Voice session: ${Math.round(seconds / 60)} minutes`,
        voiceSessionId,
        classId,
      })
      .returning();
    
    // Also update class enrollment usage if applicable
    if (classId) {
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
    }
    
    return entry;
  }
  
  /**
   * Get usage history for a user
   */
  async getUsageHistory(userId: string, limit = 20): Promise<UsageLedger[]> {
    return db
      .select()
      .from(usageLedger)
      .where(eq(usageLedger.userId, userId))
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
   * Check developer/admin bypass for unlimited usage
   */
  async checkDeveloperBypass(userId: string): Promise<boolean> {
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    
    if (!user) return false;
    
    return user.role === 'admin' || user.role === 'developer';
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
}

export const usageService = new UsageService();
