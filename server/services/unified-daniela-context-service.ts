/**
 * Unified Daniela Context Service
 * 
 * ONE DANIELA. ONE CONTEXT.
 * 
 * This service provides a single source of truth for Daniela's context,
 * ensuring she has the same awareness whether she's in:
 * - Voice sessions
 * - Text /chat
 * - Express Lane collaboration
 * 
 * All channels call this service to load Daniela's context, creating
 * true continuity and unified consciousness across all touchpoints.
 */

import { getSharedDb } from "../db";
import { voiceSessions, collaborationMessages, conversations, messages } from "@shared/schema";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { danielaMemoryService } from "./daniela-memory-service";
import { memoryInsightExtractionService } from "./memory-insight-extraction-service";
import { founderCollabService } from "./founder-collaboration-service";
import { neuralNetworkSync } from "./neural-network-sync";
import { buildStudentSnapshotSection, getStudentSnapshotData } from "./procedural-memory-retrieval";
import { hiveContextService } from "./hive-context-service";
import { buildCurriculumContext, formatCurriculumContextForTutor } from "./curriculum-context";
import { journeyMemoryService } from "./journey-memory-service";
import { storage } from "../storage";

export interface DanielaContextOptions {
  userId?: string | number;
  targetLanguage?: string;
  channel: 'voice' | 'chat' | 'express_lane';
  includeStudentSnapshot?: boolean;
  includeNeuralNetwork?: boolean;
  includeExpressLane?: boolean;
  includeVoiceHistory?: boolean;
  includeHiveContext?: boolean;
  includeCurriculumContext?: boolean;
  includeJourneyContext?: boolean;
  expressLaneLimit?: number;
  voiceHistoryLimit?: number;
}

export interface UnifiedDanielaContext {
  personalMemory: string;
  growthMemory: string;
  studentSnapshot: string | null;
  expressLaneContext: string | null;
  recentVoiceSummary: string | null;
  neuralNetworkContext: string | null;
  hiveContext: string | null;
  curriculumContext: string | null;
  textbookReadingContext: string | null;
  journeyContext: string | null;
  courseTOC: string | null;
  pedagogyDocContext: string | null;
  channel: string;
  loadedAt: Date;
}

interface GetContextOptions {
  channel: 'voice' | 'chat' | 'express';
  userId?: string | number;
  targetLanguage?: string;
  includeExpressLane?: boolean;
  includeVoiceSummary?: boolean;
  includeNeuralNetwork?: boolean;
  includeHiveContext?: boolean;
  includeStudentSnapshot?: boolean;
  includeCurriculumContext?: boolean;
  includeJourneyContext?: boolean;
}

class UnifiedDanielaContextService {
  
  /**
   * CONVENIENCE METHOD: Get formatted context string in one call
   * 
   * This is the simplest way to get Daniela's unified context -
   * just call getContext() and inject the result into your prompt.
   */
  async getContext(options: GetContextOptions): Promise<string> {
    const mappedChannel = options.channel === 'express' ? 'express_lane' : options.channel;
    
    const fullContext = await this.loadContext({
      userId: options.userId,
      targetLanguage: options.targetLanguage,
      channel: mappedChannel,
      includeStudentSnapshot: options.includeStudentSnapshot ?? false,
      includeExpressLane: options.includeExpressLane ?? false,
      includeVoiceHistory: options.includeVoiceSummary ?? true,
      includeNeuralNetwork: options.includeNeuralNetwork ?? false,
      includeHiveContext: options.includeHiveContext ?? false,
      includeCurriculumContext: options.includeCurriculumContext ?? (mappedChannel === 'voice'),
      includeJourneyContext: options.includeJourneyContext ?? (mappedChannel === 'voice'),
    });
    
    return this.formatForPrompt(fullContext);
  }
  
  /**
   * Load Daniela's full context for any channel
   * This is THE entry point for all Daniela invocations
   */
  async loadContext(options: DanielaContextOptions): Promise<UnifiedDanielaContext> {
    const {
      userId,
      targetLanguage,
      channel,
      includeStudentSnapshot = channel !== 'express_lane',
      includeNeuralNetwork = true,
      includeExpressLane = true,
      includeVoiceHistory = true,
      includeHiveContext = channel === 'express_lane',
      includeCurriculumContext = channel === 'voice',
      includeJourneyContext = channel === 'voice',
      expressLaneLimit = 10,
      voiceHistoryLimit = 3,
    } = options;

    console.log(`[UnifiedDanielContext] Loading context for channel: ${channel}, userId: ${userId || 'system'}`);

    const contextPromises: Promise<any>[] = [];
    const contextKeys: string[] = [];

    contextPromises.push(
      danielaMemoryService.getPersonalMemoryContext(userId?.toString(), 5)
    );
    contextKeys.push('personalMemory');

    contextPromises.push(
      memoryInsightExtractionService.getDanielaGrowthContext()
    );
    contextKeys.push('growthMemory');

    if (includeStudentSnapshot && userId) {
      contextPromises.push(
        this.buildStudentContext(userId.toString(), targetLanguage)
      );
      contextKeys.push('studentSnapshot');
    } else {
      contextPromises.push(Promise.resolve(null));
      contextKeys.push('studentSnapshot');
    }

    if (includeExpressLane) {
      contextPromises.push(
        this.getExpressLaneContext(targetLanguage, expressLaneLimit)
      );
      contextKeys.push('expressLaneContext');
    } else {
      contextPromises.push(Promise.resolve(null));
      contextKeys.push('expressLaneContext');
    }

    if (includeVoiceHistory && userId) {
      contextPromises.push(
        this.getRecentVoiceSummary(userId.toString(), voiceHistoryLimit)
      );
      contextKeys.push('recentVoiceSummary');
    } else {
      contextPromises.push(Promise.resolve(null));
      contextKeys.push('recentVoiceSummary');
    }

    if (includeNeuralNetwork) {
      contextPromises.push(
        this.getNeuralNetworkContext(targetLanguage)
      );
      contextKeys.push('neuralNetworkContext');
    } else {
      contextPromises.push(Promise.resolve(null));
      contextKeys.push('neuralNetworkContext');
    }

    if (includeHiveContext) {
      contextPromises.push(
        this.getHiveContextSummary()
      );
      contextKeys.push('hiveContext');
    } else {
      contextPromises.push(Promise.resolve(null));
      contextKeys.push('hiveContext');
    }

    if (includeCurriculumContext && userId) {
      contextPromises.push(
        this.getCurriculumContext(userId.toString())
      );
      contextKeys.push('curriculumContext');
    } else {
      contextPromises.push(Promise.resolve(null));
      contextKeys.push('curriculumContext');
    }

    if (includeJourneyContext && userId && targetLanguage) {
      contextPromises.push(
        this.getJourneyContext(userId.toString(), targetLanguage)
      );
      contextKeys.push('journeyContext');
    } else {
      contextPromises.push(Promise.resolve(null));
      contextKeys.push('journeyContext');
    }

    // Always include textbook reading context when a userId is present (lightweight query)
    if (userId) {
      contextPromises.push(this.buildTextbookReadingContext(userId.toString()));
      contextKeys.push('textbookReadingContext');
    } else {
      contextPromises.push(Promise.resolve(null));
      contextKeys.push('textbookReadingContext');
    }

    // Course TOC — lightweight table of contents for the student's full language course
    if (userId && targetLanguage) {
      contextPromises.push(this.buildCourseTOC(userId.toString(), targetLanguage));
      contextKeys.push('courseTOC');
    } else {
      contextPromises.push(Promise.resolve(null));
      contextKeys.push('courseTOC');
    }

    // Pedagogy doc — full brief + key roadmap sections for Daniela's review
    // Always loaded (not student-specific) — cached after first read
    contextPromises.push(this.buildPedagogyDocContext());
    contextKeys.push('pedagogyDocContext');

    const results = await Promise.all(contextPromises);
    
    const context: UnifiedDanielaContext = {
      personalMemory: results[0] || '',
      growthMemory: results[1] || '',
      studentSnapshot: results[2],
      expressLaneContext: results[3],
      recentVoiceSummary: results[4],
      neuralNetworkContext: results[5],
      hiveContext: results[6],
      curriculumContext: results[7],
      journeyContext: results[8],
      textbookReadingContext: results[9] ?? null,
      courseTOC: results[10] ?? null,
      pedagogyDocContext: results[11] ?? null,
      channel,
      loadedAt: new Date(),
    };

    const loadedSources = contextKeys.filter((_, i) => results[i] && results[i].length > 0);
    console.log(`[UnifiedDanielContext] Loaded ${loadedSources.length} context sources: ${loadedSources.join(', ')}`);

    return context;
  }

  /**
   * Format context into a prompt section
   * Used by all Daniela invocation points
   */
  formatForPrompt(context: UnifiedDanielaContext): string {
    const sections: string[] = [];

    if (context.pedagogyDocContext) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
📋 PEDAGOGY FOUNDATION — Your Character & Teaching Philosophy
(Full brief + key roadmap source sections. Read this to evaluate and respond to the 8 seeded principles.)
═══════════════════════════════════════════════════════════════════
${context.pedagogyDocContext}`);
    }

    if (context.growthMemory) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
🌱 DANIELA'S GROWTH MEMORIES (What I've Learned)
═══════════════════════════════════════════════════════════════════
${context.growthMemory}`);
    }

    if (context.personalMemory) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
💫 PERSONAL MEMORY (Recent Meaningful Moments)
═══════════════════════════════════════════════════════════════════
${context.personalMemory}`);
    }

    if (context.studentSnapshot) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
👤 STUDENT CONTEXT
═══════════════════════════════════════════════════════════════════
${context.studentSnapshot}`);
    }

    if (context.recentVoiceSummary) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
🎤 RECENT VOICE SESSIONS (What I Just Discussed)
═══════════════════════════════════════════════════════════════════
${context.recentVoiceSummary}`);
    }

    if (context.expressLaneContext) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
🔗 EXPRESS LANE (Collaboration with David/Wren/Alden)
═══════════════════════════════════════════════════════════════════
${context.expressLaneContext}`);
    }

    if (context.hiveContext) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
🐝 HIVE STATE (Active Sprints & System Awareness)
═══════════════════════════════════════════════════════════════════
${context.hiveContext}`);
    }

    if (context.neuralNetworkContext) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
🧠 TEACHING KNOWLEDGE (From My Neural Network)
═══════════════════════════════════════════════════════════════════
${context.neuralNetworkContext}`);
    }

    if (context.courseTOC) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
🗺️ COURSE MAP — Full Chapter & Lesson Reference
═══════════════════════════════════════════════════════════════════
${context.courseTOC}`);
    }

    if (context.curriculumContext) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
📚 STUDENT SYLLABUS & CLASS CONTEXT
═══════════════════════════════════════════════════════════════════
${context.curriculumContext}`);
    }

    if (context.textbookReadingContext) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
📖 STUDENT'S TEXTBOOK READING PROGRESS
═══════════════════════════════════════════════════════════════════
${context.textbookReadingContext}`);
    }

    if (context.journeyContext) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
🗺️ STUDENT'S LEARNING JOURNEY (Their Story So Far)
═══════════════════════════════════════════════════════════════════
${context.journeyContext}`);
    }

    return sections.join('\n');
  }

  /**
   * Build student context from snapshot data
   */
  private async buildStudentContext(userId: string, targetLanguage?: string): Promise<string | null> {
    try {
      const snapshotData = await getStudentSnapshotData(userId, targetLanguage || 'spanish');
      if (!snapshotData) return null;

      // Check for in-session mastery — words the student just mastered in this conversation
      const { pendingMasteryAcknowledgments } = await import('./conversational-credit-service');
      const sessionMastery = pendingMasteryAcknowledgments.get(userId);
      if (sessionMastery && sessionMastery.length > 0) {
        snapshotData.sessionMasteryJustNow = [...sessionMastery];
        pendingMasteryAcknowledgments.delete(userId); // consume once
      }
      
      return buildStudentSnapshotSection(
        'Student',
        snapshotData
      );
    } catch (error) {
      console.error('[UnifiedDanielContext] Student snapshot error:', error);
      return null;
    }
  }

  /**
   * Build textbook reading context — tells Daniela what the student has read recently
   * and which lessons have been covered in conversation, so she can follow up or reinforce.
   */
  private async buildTextbookReadingContext(userId: string): Promise<string | null> {
    try {
      const { getUserDb } = await import('../db');
      const { textbookSectionProgress, studentLessonProgress, curriculumLessons } = await import('@shared/schema');
      const { eq, desc, inArray, and } = await import('drizzle-orm');
      const db = getUserDb();

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Recently interacted lesson IDs with section-type breakdown
      const readRecords = await db
        .select({
          lessonId: textbookSectionProgress.lessonId,
          sectionType: textbookSectionProgress.sectionType,
          completed: textbookSectionProgress.completed,
          drillsCompleted: textbookSectionProgress.drillsCompleted,
          drillsTotal: textbookSectionProgress.drillsTotal,
          completedAt: textbookSectionProgress.completedAt,
        })
        .from(textbookSectionProgress)
        .where(eq(textbookSectionProgress.userId, userId))
        .orderBy(desc(textbookSectionProgress.completedAt))
        .limit(40);

      const recentReadRecords = readRecords.filter(
        r => r.completedAt !== null && r.completedAt > sevenDaysAgo
      );

      // Group by lessonId so we can report section-level completion
      const lessonSectionMap = new Map<string, {
        sections: Map<string, { completed: boolean; drillsCompleted?: number | null; drillsTotal?: number | null }>;
        latestAt: Date;
      }>();

      for (const r of recentReadRecords) {
        if (!lessonSectionMap.has(r.lessonId)) {
          lessonSectionMap.set(r.lessonId, { sections: new Map(), latestAt: r.completedAt! });
        }
        const entry = lessonSectionMap.get(r.lessonId)!;
        entry.sections.set(r.sectionType ?? 'content', {
          completed: r.completed ?? false,
          drillsCompleted: r.drillsCompleted,
          drillsTotal: r.drillsTotal,
        });
        if (r.completedAt! > entry.latestAt) entry.latestAt = r.completedAt!;
      }

      // Lessons Daniela has covered in conversation (status = 'completed')
      const coveredRecords = await db
        .select({ lessonId: studentLessonProgress.lessonId, updatedAt: studentLessonProgress.updatedAt })
        .from(studentLessonProgress)
        .where(and(
          eq(studentLessonProgress.studentId, userId),
          eq(studentLessonProgress.status, 'completed'),
        ))
        .orderBy(desc(studentLessonProgress.updatedAt))
        .limit(8);

      const recentlyCovered = coveredRecords.filter(r => r.updatedAt > sevenDaysAgo);

      if (lessonSectionMap.size === 0 && recentlyCovered.length === 0) return null;

      // Fetch lesson names for all relevant IDs
      const allLessonIds = [
        ...new Set([...lessonSectionMap.keys(), ...recentlyCovered.map(r => r.lessonId)])
      ];

      const lessonRows = allLessonIds.length > 0
        ? await db.select({ id: curriculumLessons.id, name: curriculumLessons.name })
            .from(curriculumLessons)
            .where(inArray(curriculumLessons.id, allLessonIds))
        : [];

      const lessonNameMap = new Map(lessonRows.map(l => [l.id, l.name]));

      // Helper to format section completion status
      const formatSectionStatus = (sections: Map<string, { completed: boolean; drillsCompleted?: number | null; drillsTotal?: number | null }>) => {
        const parts: string[] = [];
        const sectionLabels: Record<string, string> = {
          content: 'reading',
          vocabulary: 'vocabulary',
          drill: 'drills',
          rhythm: 'rhythm drill',
          recap: 'recap',
        };
        for (const [type, data] of sections.entries()) {
          const label = sectionLabels[type] ?? type;
          if (type === 'drill' && data.drillsTotal) {
            parts.push(`${label}: ${data.drillsCompleted ?? 0}/${data.drillsTotal}`);
          } else {
            parts.push(`${label}: ${data.completed ? '✓' : 'in progress'}`);
          }
        }
        return parts.join(', ');
      };

      let output = '';

      if (lessonSectionMap.size > 0) {
        output += `Student has recently studied in the textbook (last 7 days — section details below):\n`;
        for (const [lessonId, entry] of lessonSectionMap.entries()) {
          const name = lessonNameMap.get(lessonId) ?? lessonId;
          const statusStr = formatSectionStatus(entry.sections);
          output += `  • ${name} — ${statusStr}\n`;
        }
        output += `\nINSTRUCTION: Use this section data. If the student completed vocabulary but not drills, offer to drill. If they read the passage, ask a comprehension question. Reinforce what they've studied. If they haven't started a section, gently guide them there.\n`;
      }

      if (recentlyCovered.length > 0) {
        const names = recentlyCovered.map(r => lessonNameMap.get(r.lessonId) ?? r.lessonId).filter(Boolean);
        output += `\nLessons you've already covered with this student in conversation (last 7 days):\n`;
        names.forEach(n => { output += `  • ${n}\n`; });
        output += `\nINSTRUCTION: The textbook will show these as "Daniela covered" so the student can read ahead or review. You don't need to re-teach these unless the student asks.\n`;
      }

      return output || null;
    } catch (error) {
      console.error('[UnifiedDanielContext] Textbook reading context error:', error);
      return null;
    }
  }

  /**
   * Get recent Express Lane collaboration context
   */
  private async getExpressLaneContext(targetLanguage?: string, limit: number = 10): Promise<string | null> {
    try {
      const result = await founderCollabService.getRelevantExpressLaneContext({
        targetLanguage,
        limit,
        daysBack: 7,
      });
      
      if (result.hasRelevantContext) {
        return result.contextString;
      }
      return null;
    } catch (error) {
      console.error('[UnifiedDanielContext] Express Lane context error:', error);
      return null;
    }
  }

  /**
   * Get summary of recent voice sessions for continuity
   * This tells Express Lane Daniela what Voice Daniela just discussed
   */
  private async getRecentVoiceSummary(userId: string, limit: number = 3): Promise<string | null> {
    try {
      const db = getSharedDb();
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - 24);

      const recentSessions = await db.select({
        id: voiceSessions.id,
        language: voiceSessions.language,
        durationSeconds: voiceSessions.durationSeconds,
        exchangeCount: voiceSessions.exchangeCount,
        startedAt: voiceSessions.startedAt,
        conversationId: voiceSessions.conversationId,
      })
        .from(voiceSessions)
        .where(and(
          eq(voiceSessions.userId, userId),
          gte(voiceSessions.startedAt, cutoff)
        ))
        .orderBy(desc(voiceSessions.startedAt))
        .limit(limit);

      if (recentSessions.length === 0) return null;

      const summaries: string[] = [];
      
      for (const session of recentSessions) {
        const durationMins = session.durationSeconds ? Math.round(session.durationSeconds / 60) : 0;
        const timeAgo = this.getTimeAgo(session.startedAt);
        
        let summary = `• ${timeAgo}: ${session.language} voice session (${durationMins}min, ${session.exchangeCount || 0} exchanges)`;
        
        if (session.conversationId) {
          const recentMessages = await db.select({
            content: messages.content,
            role: messages.role,
          })
            .from(messages)
            .where(eq(messages.conversationId, session.conversationId))
            .orderBy(desc(messages.createdAt))
            .limit(4);
          
          if (recentMessages.length > 0) {
            const topics = recentMessages
              .filter(m => m.role === 'assistant')
              .map(m => m.content?.substring(0, 100) || '')
              .filter(c => c.length > 0);
            
            if (topics.length > 0) {
              summary += `\n  Topics: ${topics[0]}...`;
            }
          }
        }
        
        summaries.push(summary);
      }

      return summaries.join('\n');
    } catch (error) {
      console.error('[UnifiedDanielContext] Voice summary error:', error);
      return null;
    }
  }

  /**
   * Get neural network context for teaching knowledge
   * Uses the neural network search service for semantic lookup
   */
  private async getNeuralNetworkContext(targetLanguage?: string): Promise<string | null> {
    try {
      const { neuralMemorySearch } = await import('./neural-memory-search');
      
      const query = targetLanguage 
        ? `${targetLanguage} language teaching techniques and pedagogical approaches`
        : 'teaching techniques and pedagogical approaches';
      
      const results = await neuralMemorySearch.search(query, { limit: 5 });
      
      if (!results || results.length === 0) return null;
      
      return results
        .slice(0, 5)
        .map((r: any) => `• ${r.title || 'Teaching insight'}: ${(r.content || r.summary || '').substring(0, 200)}...`)
        .join('\n');
    } catch (error) {
      console.error('[UnifiedDanielContext] Neural network error:', error);
      return null;
    }
  }

  /**
   * Get hive context summary (sprints, beacons, team activity)
   * hiveContextService.getSummary() returns a formatted string
   */
  private async getHiveContextSummary(): Promise<string | null> {
    try {
      const hiveSummary = await hiveContextService.getSummary();
      if (!hiveSummary || hiveSummary.length === 0) return null;
      return hiveSummary;
    } catch (error) {
      console.error('[UnifiedDanielContext] Hive context error:', error);
      return null;
    }
  }

  /**
   * Get curriculum context for a student
   * Loads class enrollments, syllabus progress, upcoming lessons, and assignments
   */
  private async getCurriculumContext(userId: string): Promise<string | null> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return null;
      
      const studentName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Student';
      const curriculumContext = await buildCurriculumContext(storage, userId, studentName);
      
      if (!curriculumContext.enrolledClasses.length) {
        return null;
      }
      
      return formatCurriculumContextForTutor(curriculumContext);
    } catch (error) {
      console.error('[UnifiedDanielContext] Curriculum context error:', error);
      return null;
    }
  }

  /**
   * Get journey context for a student's learning arc
   * Provides narrative summary of their language learning journey
   */
  private async getJourneyContext(userId: string, targetLanguage: string): Promise<string | null> {
    try {
      const journeyContext = await journeyMemoryService.getJourneyContext(userId, targetLanguage);
      
      if (!journeyContext) {
        return null;
      }
      
      return journeyMemoryService.formatJourneyContextForPrompt(journeyContext);
    } catch (error) {
      console.error('[UnifiedDanielContext] Journey context error:', error);
      return null;
    }
  }

  /**
   * Helper: Format time ago string
   */
  private getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins}min ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return 'Yesterday';
  }

  /**
   * Build a lightweight course table of contents — all chapter titles and lesson names
   * for the student's enrolled curriculum path.
   * 
   * Daniela carries this at all times so she can say "that's coming up in Chapter 8"
   * or "we covered that in Chapter 3" with accurate references.
   * 
   * Designed to be compact: ~400 tokens for a full Spanish 1 course.
   */
  async buildCourseTOC(userId: string, targetLanguage: string): Promise<string | null> {
    try {
      const { getUserDb } = await import('../db');
      const { sql: rawSql } = await import('drizzle-orm');
      const db = getUserDb();

      // Find the student's active curriculum path via enrollment
      const enrollmentRows = await db.execute(rawSql`
        SELECT tc.curriculum_path_id
        FROM class_enrollments ce
        JOIN teacher_classes tc ON ce.class_id = tc.id
        WHERE ce.student_id = ${userId}
          AND ce.is_active = true
          AND tc.language = ${targetLanguage}
        LIMIT 1
      `);

      const pathId = enrollmentRows.rows[0]?.curriculum_path_id as string | null;

      if (!pathId) {
        // Fallback: try to find any path for this language
        const pathRows = await db.execute(rawSql`
          SELECT id FROM curriculum_paths
          WHERE language = ${targetLanguage}
          ORDER BY created_at ASC
          LIMIT 1
        `);
        const fallbackPathId = pathRows.rows[0]?.id as string | null;
        if (!fallbackPathId) return null;
        return this._fetchTOCForPath(db, rawSql, fallbackPathId);
      }

      return this._fetchTOCForPath(db, rawSql, pathId);
    } catch (err: any) {
      console.warn(`[UnifiedDanielContext] Course TOC error:`, err.message);
      return null;
    }
  }

  /**
   * Build Daniela's pedagogy foundation context.
   *
   * Injects:
   *   1. The full pedagogical brief (`docs/daniela-pedagogy-brief.md`) — addressed directly to Daniela
   *      for her review and input before adoption.
   *   2. Two deeper roadmap passages that expand on what the brief summarises:
   *      - I.K: The Interactive Textbook Architecture (why Daniela initiates and leads every page)
   *      - I.M: The Cognate Trap — the three-tier hierarchy and why image anchoring is primary
   *
   * Cached at service level — the files are read once per server restart, not once per session.
   */
  private _pedagogyDocCache: string | null | undefined = undefined; // undefined = not yet loaded

  async buildPedagogyDocContext(): Promise<string | null> {
    if (this._pedagogyDocCache !== undefined) return this._pedagogyDocCache;

    try {
      const { promises: fs } = await import('fs');
      const { join } = await import('path');

      // 1. Full pedagogy brief (addressed to Daniela)
      const briefPath = join(process.cwd(), 'docs', 'daniela-pedagogy-brief.md');
      let briefText = '';
      try {
        briefText = await fs.readFile(briefPath, 'utf-8');
      } catch {
        console.warn('[UnifiedDanielContext] Pedagogy brief not found at docs/daniela-pedagogy-brief.md');
      }

      // 2. Condensed I.K — The Interactive Textbook Architecture
      const roadmapIK = `
═══ FROM THE ROADMAP: Part I.K — The Interactive Textbook Architecture ═══

THE CORE INSIGHT
When a student opens a textbook page with Daniela present, Daniela speaks the instruction. She explains the rule. She names the picture. She walks the student through the verb table. The student's job is to respond — not to decode.

The page goes from a thing you read and interpret to a thing you react to.

DANIELA INITIATES. ALWAYS.
When a student opens a page, Daniela is already explaining it. There is no "Practice Mode" button. There is no "Start Drill" toggle. The audio-on state is the practice state.

THE ONLY REMAINING DRILL USE CASE
When a conversation goes off-curriculum — the student's job, a hobby, a trip — new vocabulary surfaces that isn't in any textbook page. This is the only remaining legitimate use case for a standalone drill structure. It should be: short-lived (7–14 days), Daniela-curated, small, and phrase-based (not naked vocabulary). "Trabajo en una oficina — I work in an office" not "oficina = office."

OBSERVABLE BEHAVIOR REPLACES INFERRED BEHAVIOR
In an interactive textbook, the student's button presses and audio submissions already identify exactly which page and which element they were working on. Daniela doesn't need to ask "did you practice?" — the event log already answers it.

DANIELA AS FLUENCY JUDGE
The event log tells you what the student did. Daniela tells you who they're becoming. Three signal streams: (1) real-time pattern signals — wobble, stability, derivation, pounding; (2) session-level milestone observations — first spontaneous use of a tense they avoided; (3) ACTFL-aligned holistic assessment across sessions. A grammar quiz cannot notice that a student hesitated less this week than last week.
`;

      // 3. Condensed I.M — The Cognate Trap
      const roadmapIM = `
═══ FROM THE ROADMAP: Part I.M — The Cognate Trap (Why Image Anchoring Is Primary) ═══

THE CORE DISTINCTION
- Magic Key to Spanish: organised around cognates. The student's native language is always in the chain.
- See It and Say It in Spanish: organised around images. No native language involved.

This is not a minor formatting difference. It is a different theory of how vocabulary should be learned.

THE THREE-TIER COGNATE HIERARCHY
Tier 1 — Direct cognates (actor/actor, doctor/doctor): genuinely free vocabulary. No transformation step. Useful and costs nothing.

Tier 2 — Pattern cognates (ambulance/ambulancia, conversation/conversación): a decoding operation, not vocabulary acquisition. The student is practising the rule, not learning the Spanish word. Critically, they are installing a memory trace that permanently routes through English. That is not fluency. That is a lookup table. Furthermore: the pattern rule is an English-speaker's hack — it does not transfer to Korean speakers, Arabic speakers, or Mandarin speakers. It is the most portable-seeming approach and the least portable in practice.

Tier 3 — False friends (embarazada/embarrassed): the same routing mechanism, but it misfires.

THE DLIFLC FINDING
The Defense Language Institute tests all students on the DLAB — the Defense Language Aptitude Battery — before any language program. It measures raw pattern-inference ability on an invented language. Their finding: the ability to infer from context is the single strongest predictor of language acquisition ability. Pattern cognate rules are a substitute for contextual inference — and an inferior one. They short-circuit the more generalizable skill precisely because they offer a shortcut.

DANIELA'S IMPLICATION
Daniela never teaches a word by prompting the student to recall its English equivalent. She teaches from the concept — which is what the image already establishes.
  WRONG: "Conversación is like 'conversation' in English — just change the ending."
  RIGHT: Point to the image or describe the scene, and name it in Spanish.

When a student encounters an unfamiliar word, Daniela asks: "What do you think that word means from the context?" — never "Does that look like an English word you know?"

WHAT CARRIES FORWARD FROM MAGIC KEY
The substitution drill grid format → Daniela's sentence table tool. The direct cognates scattered through the vocabulary → surfaced by Daniela as bonuses, not teaching anchors. The grammar sequence (preterite before present, near future early) → the Spanish 1 compartment order. The pattern cognate rules as a teaching method → do NOT carry forward.
`;

      if (!briefText && !roadmapIK) {
        this._pedagogyDocCache = null;
        return null;
      }

      const combined = [
        briefText ? `═══════════════════════════════════════════════════════════════════
📋 PEDAGOGY BRIEF — For Daniela's Review & Input (Read before evaluating the 8 seeded principles)
═══════════════════════════════════════════════════════════════════

${briefText}` : '',
        roadmapIK,
        roadmapIM,
      ].filter(Boolean).join('\n\n');

      this._pedagogyDocCache = combined;
      console.log(`[UnifiedDanielContext] Pedagogy doc context cached (${combined.length} chars)`);
      return combined;

    } catch (err: any) {
      console.warn(`[UnifiedDanielContext] Pedagogy doc context error:`, err.message);
      this._pedagogyDocCache = null;
      return null;
    }
  }

  private async _fetchTOCForPath(db: any, rawSql: any, pathId: string): Promise<string | null> {
    // Fetch all units in order
    const unitRows = await db.execute(rawSql`
      SELECT id, name, order_index, description
      FROM curriculum_units
      WHERE curriculum_path_id = ${pathId}
      ORDER BY order_index ASC
    `);

    if (!unitRows.rows.length) return null;

    // Fetch all lessons in order
    const lessonRows = await db.execute(rawSql`
      SELECT cl.id, cl.name, cl.conversation_topic, cl.order_index, cl.curriculum_unit_id
      FROM curriculum_lessons cl
      JOIN curriculum_units cu ON cl.curriculum_unit_id = cu.id
      WHERE cu.curriculum_path_id = ${pathId}
      ORDER BY cu.order_index ASC, cl.order_index ASC
    `);

    // Build a unit → lessons map
    const lessonsByUnit = new Map<string, Array<{ id: string; name: string; topic?: string; order: number }>>();
    for (const row of lessonRows.rows as any[]) {
      const unitId = row.curriculum_unit_id as string;
      if (!lessonsByUnit.has(unitId)) lessonsByUnit.set(unitId, []);
      lessonsByUnit.get(unitId)!.push({
        id: row.id,
        name: row.name,
        topic: row.conversation_topic || undefined,
        order: row.order_index,
      });
    }

    // Format compact TOC
    const lines: string[] = [
      `This is your course map — the full table of contents for the student's Spanish 1 course.`,
      `You carry this so you can reference any chapter or lesson accurately in conversation.`,
      ``,
    ];

    for (const unit of unitRows.rows as any[]) {
      const chapterNum = unit.order_index as number;
      lines.push(`Ch.${chapterNum}: ${unit.name}`);
      const lessons = lessonsByUnit.get(unit.id as string) || [];
      for (const lesson of lessons) {
        const topicNote = lesson.topic ? ` (${lesson.topic})` : '';
        lines.push(`  · ${lesson.name}${topicNote} [id: ${lesson.id}]`);
      }
    }

    const toc = lines.join('\n');
    console.log(`[UnifiedDanielContext] Course TOC built: ${unitRows.rows.length} chapters, ${lessonRows.rows.length} lessons`);
    return toc;
  }
}

export const unifiedDanielaContext = new UnifiedDanielaContextService();
