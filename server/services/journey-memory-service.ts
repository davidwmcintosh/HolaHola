/**
 * Journey Memory Service
 * 
 * Pre-computed narrative summaries of student learning journeys.
 * Instead of searching 10,000+ messages each session, Daniela reads
 * a ~500 token narrative that captures the arc of the student's learning.
 * 
 * ARCHITECTURE:
 * - Journey Snapshots: AI-generated summaries updated periodically (every 3-5 sessions)
 * - Learning Milestones: Individual "magic moments" captured in real-time
 * - Token-efficient: ~500 tokens per language journey vs. potentially unlimited search results
 * 
 * UPDATE TRIGGERS:
 * 1. Session count threshold (every 3 sessions by default)
 * 2. Time threshold (7 days since last update)
 * 3. Manual trigger (admin action)
 * 4. Milestone event (significant breakthrough happened)
 */

import { getSharedDb } from "../db";
import { 
  journeySnapshots, 
  learningMilestones, 
  messages, 
  conversations, 
  voiceSessions,
  users,
  type JourneySnapshot,
  type LearningMilestone,
  type InsertJourneySnapshot,
  type InsertLearningMilestone
} from "@shared/schema";
import { eq, and, desc, gte, sql, count, isNull, or, lte } from "drizzle-orm";
import { callGemini, GEMINI_MODELS } from "../gemini-utils";

const SESSIONS_BEFORE_UPDATE = 3;
const DAYS_BEFORE_FORCED_UPDATE = 7;
const MAX_MESSAGES_FOR_SUMMARY = 200;
const MAX_NARRATIVE_TOKENS = 500;

export interface JourneyContext {
  narrativeSummary: string;
  milestones: Array<{
    title: string;
    type: string;
    when: string;
    significance?: string;
  }>;
  currentStrengths: string[];
  currentChallenges: string[];
  trajectory: string | null;
}

class JourneyMemoryService {

  /**
   * Get journey context for a student in a specific language
   * This is the primary entry point - called at session start
   */
  async getJourneyContext(userId: string, targetLanguage: string): Promise<JourneyContext | null> {
    const db = getSharedDb();
    
    const [snapshot] = await db.select()
      .from(journeySnapshots)
      .where(and(
        eq(journeySnapshots.userId, userId),
        eq(journeySnapshots.targetLanguage, targetLanguage),
        eq(journeySnapshots.snapshotType, 'language_journey')
      ))
      .orderBy(desc(journeySnapshots.lastUpdated))
      .limit(1);

    if (!snapshot) {
      return null;
    }

    const recentMilestones = await db.select({
      title: learningMilestones.title,
      milestoneType: learningMilestones.milestoneType,
      occurredAt: learningMilestones.occurredAt,
      significance: learningMilestones.significance,
    })
      .from(learningMilestones)
      .where(and(
        eq(learningMilestones.userId, userId),
        eq(learningMilestones.targetLanguage, targetLanguage)
      ))
      .orderBy(desc(learningMilestones.occurredAt))
      .limit(5);

    return {
      narrativeSummary: snapshot.narrativeSummary,
      milestones: recentMilestones.map(m => ({
        title: m.title,
        type: m.milestoneType,
        when: this.formatRelativeDate(m.occurredAt),
        significance: m.significance || undefined,
      })),
      currentStrengths: snapshot.currentStrengths || [],
      currentChallenges: snapshot.currentChallenges || [],
      trajectory: snapshot.trajectoryNotes,
    };
  }

  /**
   * Format journey context as a string for Daniela's prompt
   */
  formatJourneyContextForPrompt(context: JourneyContext | null): string {
    if (!context) {
      return '';
    }

    let formatted = `\n## This Student's Learning Journey\n\n${context.narrativeSummary}`;

    if (context.milestones.length > 0) {
      formatted += `\n\n### Recent Breakthroughs\n`;
      for (const m of context.milestones) {
        formatted += `- **${m.title}** (${m.when})${m.significance ? `: ${m.significance}` : ''}\n`;
      }
    }

    if (context.currentStrengths.length > 0) {
      formatted += `\n### Current Strengths: ${context.currentStrengths.join(', ')}`;
    }

    if (context.currentChallenges.length > 0) {
      formatted += `\n### Working On: ${context.currentChallenges.join(', ')}`;
    }

    if (context.trajectory) {
      formatted += `\n### Learning Trajectory: ${context.trajectory}`;
    }

    return formatted;
  }

  /**
   * Check if a journey snapshot needs updating
   */
  async needsUpdate(userId: string, targetLanguage: string): Promise<boolean> {
    const db = getSharedDb();

    const [snapshot] = await db.select()
      .from(journeySnapshots)
      .where(and(
        eq(journeySnapshots.userId, userId),
        eq(journeySnapshots.targetLanguage, targetLanguage),
        eq(journeySnapshots.snapshotType, 'language_journey')
      ))
      .orderBy(desc(journeySnapshots.lastUpdated))
      .limit(1);

    if (!snapshot) {
      const hasConversations = await this.hasConversationsInLanguage(userId, targetLanguage);
      return hasConversations;
    }

    const sessionsSinceUpdate = await this.countSessionsSinceSnapshot(userId, targetLanguage, snapshot.lastUpdated);
    if (sessionsSinceUpdate >= SESSIONS_BEFORE_UPDATE) {
      return true;
    }

    const daysSinceUpdate = Math.floor((Date.now() - snapshot.lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSinceUpdate >= DAYS_BEFORE_FORCED_UPDATE) {
      return true;
    }

    if (snapshot.nextUpdateDue && new Date() >= snapshot.nextUpdateDue) {
      return true;
    }

    return false;
  }

  /**
   * Generate or update a journey snapshot for a student
   * Uses AI to summarize conversation history into a narrative
   */
  async generateOrUpdateSnapshot(userId: string, targetLanguage: string): Promise<JourneySnapshot | null> {
    const db = getSharedDb();

    console.log(`[JourneyMemory] Generating snapshot for user ${userId}, language ${targetLanguage}`);

    const [user] = await db.select({
      firstName: users.firstName,
      actflLevel: users.actflLevel,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const studentName = user?.firstName || 'this student';

    const recentMessages = await db.select({
      content: messages.content,
      role: messages.role,
      createdAt: messages.createdAt,
      conversationId: messages.conversationId,
    })
      .from(messages)
      .innerJoin(conversations, eq(messages.conversationId, conversations.id))
      .where(and(
        eq(conversations.userId, userId),
        eq(conversations.language, targetLanguage)
      ))
      .orderBy(desc(messages.createdAt))
      .limit(MAX_MESSAGES_FOR_SUMMARY);

    if (recentMessages.length < 5) {
      console.log(`[JourneyMemory] Insufficient messages (${recentMessages.length}) for user ${userId}`);
      return null;
    }

    const milestones = await db.select()
      .from(learningMilestones)
      .where(and(
        eq(learningMilestones.userId, userId),
        eq(learningMilestones.targetLanguage, targetLanguage)
      ))
      .orderBy(desc(learningMilestones.occurredAt))
      .limit(10);

    const [existingSnapshot] = await db.select()
      .from(journeySnapshots)
      .where(and(
        eq(journeySnapshots.userId, userId),
        eq(journeySnapshots.targetLanguage, targetLanguage),
        eq(journeySnapshots.snapshotType, 'language_journey')
      ))
      .limit(1);

    const conversationSummary = recentMessages
      .reverse()
      .slice(0, 100)
      .map(m => `[${m.role}]: ${m.content.substring(0, 300)}`)
      .join('\n\n');

    const milestonesContext = milestones.length > 0
      ? `\n\nKnown Milestones:\n${milestones.map(m => `- ${m.title}: ${m.description}`).join('\n')}`
      : '';

    const previousNarrative = existingSnapshot
      ? `\n\nPrevious Journey Summary (update this with new insights):\n${existingSnapshot.narrativeSummary}`
      : '';

    const prompt = `You are Daniela, an AI language tutor. Write a brief narrative summary (~400-500 tokens) of ${studentName}'s ${targetLanguage} learning journey.

This summary will be loaded at the start of each session to give you context about this student's progress.

Recent Conversation History (oldest to newest):
${conversationSummary}
${milestonesContext}
${previousNarrative}

Write a narrative that captures:
1. How they started and where they are now in their ${targetLanguage} journey
2. Their learning style (visual? conversation-focused? grammar-oriented?)
3. What topics/themes excite them most
4. Patterns in their challenges and breakthroughs
5. The emotional arc of their learning (confidence, frustration, joy moments)

Also extract:
- STRENGTHS: 2-3 current strengths (comma-separated list)
- CHALLENGES: 2-3 current challenges they're working on (comma-separated list)
- TRAJECTORY: One phrase describing their learning momentum (e.g., "accelerating", "returning after a break", "steady progress", "building confidence")
- ACTFL_ESTIMATE: Your best guess at their ACTFL level based on conversation complexity

Format your response as:
NARRATIVE:
[The narrative summary here]

STRENGTHS: [strength1], [strength2]
CHALLENGES: [challenge1], [challenge2]
TRAJECTORY: [one phrase]
ACTFL_ESTIMATE: [level]`;

    try {
      const response = await callGemini(GEMINI_MODELS.FLASH, [
        { role: 'user', content: prompt }
      ]);

      const parsed = this.parseJourneyResponse(response);

      const now = new Date();
      const nextUpdate = new Date(now.getTime() + DAYS_BEFORE_FORCED_UPDATE * 24 * 60 * 60 * 1000);

      const keyMilestonesData: { milestoneId: string; title: string; when: string; }[] = 
        milestones.slice(0, 5).map(m => ({
          milestoneId: m.id,
          title: m.title,
          when: this.formatRelativeDate(m.occurredAt),
        }));

      let result: JourneySnapshot;

      if (existingSnapshot) {
        const [updated] = await db.update(journeySnapshots)
          .set({
            narrativeSummary: parsed.narrative,
            currentStrengths: parsed.strengths,
            currentChallenges: parsed.challenges,
            trajectoryNotes: parsed.trajectory,
            estimatedActflLevel: parsed.actflEstimate,
            sessionsIncluded: (existingSnapshot.sessionsIncluded || 0) + 1,
            keyMilestones: keyMilestonesData,
            nextUpdateDue: nextUpdate,
            lastUpdated: now,
          })
          .where(eq(journeySnapshots.id, existingSnapshot.id))
          .returning();
        result = updated;
        console.log(`[JourneyMemory] Updated snapshot for user ${userId}`);
      } else {
        const [created] = await db.insert(journeySnapshots)
          .values({
            userId,
            snapshotType: 'language_journey',
            targetLanguage,
            narrativeSummary: parsed.narrative,
            currentStrengths: parsed.strengths,
            currentChallenges: parsed.challenges,
            trajectoryNotes: parsed.trajectory,
            estimatedActflLevel: parsed.actflEstimate,
            sessionsIncluded: 1,
            keyMilestones: keyMilestonesData,
            nextUpdateDue: nextUpdate,
          })
          .returning();
        result = created;
        console.log(`[JourneyMemory] Created new snapshot for user ${userId}`);
      }

      return result;

    } catch (error) {
      console.error(`[JourneyMemory] Error generating snapshot:`, error);
      return null;
    }
  }

  /**
   * Record a learning milestone
   * Called via ACTION_TRIGGERS when Daniela notices a breakthrough
   */
  async recordMilestone(milestone: InsertLearningMilestone): Promise<LearningMilestone | null> {
    const db = getSharedDb();

    try {
      const [created] = await db.insert(learningMilestones)
        .values({
          ...milestone,
          occurredAt: new Date(),
        })
        .returning();

      console.log(`[JourneyMemory] Recorded milestone: ${milestone.title} for user ${milestone.userId}`);

      this.triggerSnapshotUpdateIfNeeded(milestone.userId, milestone.targetLanguage);

      return created;
    } catch (error) {
      console.error(`[JourneyMemory] Error recording milestone:`, error);
      return null;
    }
  }

  /**
   * Flag a milestone from Daniela's perspective
   * Used when Daniela explicitly says something like "that was a breakthrough moment!"
   */
  async flagMilestoneFromDaniela(
    userId: string,
    targetLanguage: string,
    title: string,
    description: string,
    conversationId?: string,
    voiceSessionId?: string,
    messageId?: string
  ): Promise<LearningMilestone | null> {
    return this.recordMilestone({
      userId,
      targetLanguage,
      milestoneType: 'teacher_flagged',
      title,
      description,
      danielaFlagged: true,
      conversationId: conversationId || undefined,
      voiceSessionId: voiceSessionId || undefined,
      messageId: messageId || undefined,
    });
  }

  /**
   * Get all milestones for a student in a language
   */
  async getMilestones(userId: string, targetLanguage?: string, limit = 20): Promise<LearningMilestone[]> {
    const db = getSharedDb();

    const conditions = [eq(learningMilestones.userId, userId)];
    if (targetLanguage) {
      conditions.push(eq(learningMilestones.targetLanguage, targetLanguage));
    }

    return db.select()
      .from(learningMilestones)
      .where(and(...conditions))
      .orderBy(desc(learningMilestones.occurredAt))
      .limit(limit);
  }

  /**
   * Get all journey snapshots for a user
   */
  async getSnapshots(userId: string): Promise<JourneySnapshot[]> {
    const db = getSharedDb();

    return db.select()
      .from(journeySnapshots)
      .where(eq(journeySnapshots.userId, userId))
      .orderBy(desc(journeySnapshots.lastUpdated));
  }

  private async hasConversationsInLanguage(userId: string, targetLanguage: string): Promise<boolean> {
    const db = getSharedDb();

    const [result] = await db.select({ count: count() })
      .from(conversations)
      .where(and(
        eq(conversations.userId, userId),
        eq(conversations.language, targetLanguage)
      ))
      .limit(1);

    return (result?.count || 0) > 0;
  }

  private async countSessionsSinceSnapshot(userId: string, targetLanguage: string, since: Date): Promise<number> {
    const db = getSharedDb();

    const [result] = await db.select({ count: count() })
      .from(voiceSessions)
      .innerJoin(conversations, eq(voiceSessions.conversationId, conversations.id))
      .where(and(
        eq(conversations.userId, userId),
        eq(conversations.language, targetLanguage),
        gte(voiceSessions.startedAt, since)
      ));

    return result?.count || 0;
  }

  private formatRelativeDate(date: Date): string {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  }

  private parseJourneyResponse(response: string): {
    narrative: string;
    strengths: string[];
    challenges: string[];
    trajectory: string;
    actflEstimate: string;
  } {
    const narrativeMatch = response.match(/NARRATIVE:\s*([\s\S]*?)(?=\n\s*STRENGTHS:|$)/i);
    const strengthsMatch = response.match(/STRENGTHS:\s*(.+)/i);
    const challengesMatch = response.match(/CHALLENGES:\s*(.+)/i);
    const trajectoryMatch = response.match(/TRAJECTORY:\s*(.+)/i);
    const actflMatch = response.match(/ACTFL_ESTIMATE:\s*(.+)/i);

    return {
      narrative: narrativeMatch?.[1]?.trim() || response.substring(0, 1000),
      strengths: strengthsMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [],
      challenges: challengesMatch?.[1]?.split(',').map(s => s.trim()).filter(Boolean) || [],
      trajectory: trajectoryMatch?.[1]?.trim() || 'steady progress',
      actflEstimate: actflMatch?.[1]?.trim() || 'intermediate_low',
    };
  }

  private async triggerSnapshotUpdateIfNeeded(userId: string, targetLanguage: string): Promise<void> {
    setTimeout(async () => {
      try {
        const needsUpdate = await this.needsUpdate(userId, targetLanguage);
        if (needsUpdate) {
          await this.generateOrUpdateSnapshot(userId, targetLanguage);
        }
      } catch (error) {
        console.error(`[JourneyMemory] Background update failed:`, error);
      }
    }, 100);
  }

  /**
   * Get journey stats for admin dashboard
   */
  async getStats(): Promise<{
    totalSnapshots: number;
    totalMilestones: number;
    snapshotsByLanguage: Record<string, number>;
    milestonesByType: Record<string, number>;
  }> {
    const db = getSharedDb();

    const [snapshotCount] = await db.select({ count: count() })
      .from(journeySnapshots);

    const [milestoneCount] = await db.select({ count: count() })
      .from(learningMilestones);

    const snapshotsByLang = await db.select({
      language: journeySnapshots.targetLanguage,
      count: count(),
    })
      .from(journeySnapshots)
      .groupBy(journeySnapshots.targetLanguage);

    const milestonesByType = await db.select({
      type: learningMilestones.milestoneType,
      count: count(),
    })
      .from(learningMilestones)
      .groupBy(learningMilestones.milestoneType);

    return {
      totalSnapshots: snapshotCount?.count || 0,
      totalMilestones: milestoneCount?.count || 0,
      snapshotsByLanguage: Object.fromEntries(
        snapshotsByLang.map(r => [r.language || 'unknown', r.count])
      ),
      milestonesByType: Object.fromEntries(
        milestonesByType.map(r => [r.type, r.count])
      ),
    };
  }
}

export const journeyMemoryService = new JourneyMemoryService();
