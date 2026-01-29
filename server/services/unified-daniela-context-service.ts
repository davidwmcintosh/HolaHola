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
  journeyContext: string | null;
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

    if (context.curriculumContext) {
      sections.push(`
═══════════════════════════════════════════════════════════════════
📚 STUDENT SYLLABUS & CLASS CONTEXT
═══════════════════════════════════════════════════════════════════
${context.curriculumContext}`);
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
}

export const unifiedDanielaContext = new UnifiedDanielaContextService();
