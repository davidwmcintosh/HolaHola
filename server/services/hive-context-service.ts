/**
 * Hive Context Service
 * 
 * The shared brain state - a unified context layer that both Editor and Daniela access.
 * This is NOT prompt injection - it's the actual shared awareness/memory layer.
 * 
 * Data Sources:
 * - Active beacons (capability gaps, tool requests, friction reports)
 * - Recent post-flight findings (what was built, what gaps remain)
 * - Sprint status (active work, priorities)
 * - Neural network insights (pedagogical knowledge)
 * - Express Lane session context (founder discussions)
 * 
 * Philosophy: Separate domains with shared awareness.
 * Both agents see the same "state of the hive" automatically.
 */

import { db } from "../db";
import { eq, desc, and, sql, gt, isNull, asc } from "drizzle-orm";
import {
  editorListeningSnapshots,
  postFlightReports,
  featureSprints,
  founderSessions,
  collaborationMessages,
  consultationThreads,
  curriculumPaths,
  classTypes,
  topics,
  grammarCompetencies,
  teacherClasses,
  agendaQueue,
  type FeatureSprint,
  type FounderSession,
  type CollaborationMessage,
} from "@shared/schema";

// ============================================================================
// TYPES
// ============================================================================

export interface ActiveBeacon {
  id: string;
  type: string;
  reason?: string;
  tutorTurn: string;
  studentTurn?: string;
  channelId: string;
  createdAt: Date;
  hasEditorResponse: boolean;
}

export interface PostFlightFinding {
  id: string;
  featureName: string;
  verdict: string;
  requiredFixes: any[];
  shouldAddress: any[];
  opportunities: any[];
  subsystemsTouched: any[];
  createdAt: Date;
  beaconEmitted: boolean;
}

export interface SprintStatus {
  id: string;
  title: string;
  stage: string;
  priority: string;
  description?: string;
}

export interface SessionSummary {
  id: string;
  title: string;
  messageCount: number;
  lastActivity: Date;
  recentTopics: string[];
}

// === EXPANDED KNOWLEDGE TYPES ===

export interface LanguageOverview {
  language: string;
  classCount: number;
  curriculumPaths: string[];
}

export interface CurriculumOverview {
  id: string;
  name: string;
  language: string;
  description?: string;
  actflTarget?: string;
}

export interface TopicCategory {
  category: string;
  count: number;
}

export interface GrammarOverview {
  language: string;
  competencyCount: number;
  levels: string[];
}

export interface AgendaItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdBy: string;
}

export interface ConsultationSummary {
  id: string;
  sprintId?: string;
  title: string;
  topic?: string;
  isResolved: boolean;
}

// === EXPANDED HIVE CONTEXT ===

export interface HiveKnowledge {
  // Languages and curricula
  languages: LanguageOverview[];
  curricula: CurriculumOverview[];
  
  // Content overview
  topicCategories: TopicCategory[];
  grammarByLanguage: GrammarOverview[];
  
  // Active work
  agendaItems: AgendaItem[];
  openConsultations: ConsultationSummary[];
}

export interface HiveContext {
  // Timestamp for cache invalidation
  buildTimestamp: Date;
  
  // Active beacons awaiting attention
  pendingBeacons: ActiveBeacon[];
  
  // Recent post-flight findings
  recentPostFlights: PostFlightFinding[];
  
  // Active sprint status
  activeSprints: SprintStatus[];
  
  // Recent founder session summaries
  recentSessions: SessionSummary[];
  
  // Aggregated insights
  systemHealth: {
    pendingBeaconCount: number;
    unresolvedIssueCount: number;
    activeSprintCount: number;
    recentActivityLevel: 'high' | 'moderate' | 'low';
  };
  
  // Key focus areas (derived from data)
  focusAreas: string[];
  
  // Comprehensive HolaHola knowledge
  knowledge: HiveKnowledge;
}

// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

class HiveContextService {
  private cache: HiveContext | null = null;
  private cacheTTL = 60 * 1000; // 1 minute cache
  private lastCacheTime = 0;
  
  /**
   * Build the complete Hive context from all data sources
   * This is the shared awareness that both agents access
   */
  async buildContext(forceRefresh = false): Promise<HiveContext> {
    const now = Date.now();
    
    // Return cached context if still valid
    if (!forceRefresh && this.cache && (now - this.lastCacheTime) < this.cacheTTL) {
      return this.cache;
    }
    
    console.log('[HiveContext] Building shared context...');
    
    // Gather data from all sources in parallel
    const [
      pendingBeacons,
      recentPostFlights,
      activeSprints,
      recentSessions,
      knowledge,
    ] = await Promise.all([
      this.getPendingBeacons(),
      this.getRecentPostFlights(),
      this.getActiveSprints(),
      this.getRecentSessions(),
      this.getHiveKnowledge(),
    ]);
    
    // Derive system health and focus areas
    const systemHealth = this.deriveSystemHealth(pendingBeacons, recentPostFlights, activeSprints);
    const focusAreas = this.deriveFocusAreas(pendingBeacons, recentPostFlights, activeSprints);
    
    const context: HiveContext = {
      buildTimestamp: new Date(),
      pendingBeacons,
      recentPostFlights,
      activeSprints,
      recentSessions,
      systemHealth,
      focusAreas,
      knowledge,
    };
    
    // Cache the result
    this.cache = context;
    this.lastCacheTime = now;
    
    console.log(`[HiveContext] Built context: ${pendingBeacons.length} beacons, ${recentPostFlights.length} post-flights, ${activeSprints.length} sprints`);
    
    return context;
  }
  
  /**
   * Get a lightweight summary for quick context injection
   */
  async getSummary(): Promise<string> {
    const ctx = await this.buildContext();
    
    const lines: string[] = [];
    
    // System health
    lines.push(`System Health: ${ctx.systemHealth.recentActivityLevel} activity`);
    
    if (ctx.pendingBeacons.length > 0) {
      lines.push(`Pending Beacons: ${ctx.pendingBeacons.length}`);
      const types = Array.from(new Set(ctx.pendingBeacons.map(b => b.type)));
      lines.push(`  Types: ${types.join(', ')}`);
    }
    
    if (ctx.recentPostFlights.length > 0) {
      const needsWork = ctx.recentPostFlights.filter(pf => pf.requiredFixes.length > 0);
      if (needsWork.length > 0) {
        lines.push(`Post-Flight Issues: ${needsWork.length} features need attention`);
      }
    }
    
    if (ctx.activeSprints.length > 0) {
      lines.push(`Active Sprints: ${ctx.activeSprints.length}`);
      ctx.activeSprints.forEach(s => {
        lines.push(`  - ${s.title} (${s.stage}, ${s.priority} priority)`);
      });
    }
    
    if (ctx.focusAreas.length > 0) {
      lines.push(`Focus Areas: ${ctx.focusAreas.join(', ')}`);
    }
    
    return lines.join('\n');
  }
  
  /**
   * Invalidate cache (call after significant changes)
   */
  invalidateCache(): void {
    this.cache = null;
    this.lastCacheTime = 0;
    console.log('[HiveContext] Cache invalidated');
  }
  
  // ============================================================================
  // DATA SOURCE QUERIES
  // ============================================================================
  
  private async getPendingBeacons(): Promise<ActiveBeacon[]> {
    try {
      const snapshots = await db.select()
        .from(editorListeningSnapshots)
        .where(isNull(editorListeningSnapshots.editorResponse))
        .orderBy(desc(editorListeningSnapshots.createdAt))
        .limit(20);
      
      return snapshots.map(s => ({
        id: s.id,
        type: s.beaconType,
        reason: s.beaconReason ?? undefined,
        tutorTurn: s.tutorTurn,
        studentTurn: s.studentTurn ?? undefined,
        channelId: s.channelId,
        createdAt: s.createdAt,
        hasEditorResponse: !!s.editorResponse,
      }));
    } catch (error) {
      console.error('[HiveContext] Error fetching beacons:', error);
      return [];
    }
  }
  
  private async getRecentPostFlights(): Promise<PostFlightFinding[]> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 14); // Last 2 weeks
      
      const reports = await db.select()
        .from(postFlightReports)
        .where(gt(postFlightReports.createdAt, cutoff))
        .orderBy(desc(postFlightReports.createdAt))
        .limit(10);
      
      return reports.map(r => ({
        id: r.id,
        featureName: r.featureName,
        verdict: r.verdict,
        requiredFixes: (r.requiredFixes as any[]) || [],
        shouldAddress: (r.shouldAddress as any[]) || [],
        opportunities: (r.opportunities as any[]) || [],
        subsystemsTouched: (r.subsystemsTouched as any[]) || [],
        createdAt: r.createdAt,
        beaconEmitted: r.beaconEmitted ?? false,
      }));
    } catch (error) {
      console.error('[HiveContext] Error fetching post-flights:', error);
      return [];
    }
  }
  
  private async getActiveSprints(): Promise<SprintStatus[]> {
    try {
      // Get sprints that are in active stages (not shipped, not idea)
      const sprints = await db.select()
        .from(featureSprints)
        .where(eq(featureSprints.stage, 'in_progress'))
        .orderBy(desc(featureSprints.createdAt))
        .limit(5);
      
      return sprints.map(sprint => ({
        id: sprint.id,
        title: sprint.title,
        stage: sprint.stage,
        priority: sprint.priority,
        description: sprint.description ?? undefined,
      }));
    } catch (error) {
      console.error('[HiveContext] Error fetching sprints:', error);
      return [];
    }
  }
  
  private async getRecentSessions(): Promise<SessionSummary[]> {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7); // Last week
      
      const sessions = await db.select()
        .from(founderSessions)
        .where(gt(founderSessions.updatedAt, cutoff))
        .orderBy(desc(founderSessions.updatedAt))
        .limit(5);
      
      return sessions.map(s => ({
        id: s.id,
        title: s.title ?? 'Untitled Session',
        messageCount: s.messageCount ?? 0,
        lastActivity: s.updatedAt,
        recentTopics: [], // Could be derived from messages
      }));
    } catch (error) {
      console.error('[HiveContext] Error fetching sessions:', error);
      return [];
    }
  }
  
  // ============================================================================
  // DERIVED INSIGHTS
  // ============================================================================
  
  private deriveSystemHealth(
    beacons: ActiveBeacon[],
    postFlights: PostFlightFinding[],
    sprints: SprintStatus[]
  ): HiveContext['systemHealth'] {
    const pendingBeaconCount = beacons.length;
    
    const unresolvedIssueCount = postFlights.reduce((sum, pf) => 
      sum + pf.requiredFixes.length + pf.shouldAddress.length, 0
    );
    
    const activeSprintCount = sprints.length;
    
    // Determine activity level
    let recentActivityLevel: 'high' | 'moderate' | 'low';
    const totalWork = pendingBeaconCount + unresolvedIssueCount + sprints.length;
    
    if (totalWork > 10) {
      recentActivityLevel = 'high';
    } else if (totalWork > 3) {
      recentActivityLevel = 'moderate';
    } else {
      recentActivityLevel = 'low';
    }
    
    return {
      pendingBeaconCount,
      unresolvedIssueCount,
      activeSprintCount,
      recentActivityLevel,
    };
  }
  
  private deriveFocusAreas(
    beacons: ActiveBeacon[],
    postFlights: PostFlightFinding[],
    sprints: SprintStatus[]
  ): string[] {
    const areas = new Set<string>();
    
    // Add beacon types as focus areas
    beacons.forEach(b => {
      if (b.type === 'capability_gap') areas.add('Capability Gaps');
      if (b.type === 'tool_request') areas.add('Tool Development');
      if (b.type === 'friction_report') areas.add('UX Improvements');
      if (b.type === 'knowledge_gap') areas.add('Knowledge Base');
      if (b.type === 'bug_report') areas.add('Bug Fixes');
    });
    
    // Add subsystems from post-flights with issues
    postFlights.forEach(pf => {
      if (pf.requiredFixes.length > 0 || pf.shouldAddress.length > 0) {
        pf.subsystemsTouched.forEach((sub: string) => areas.add(sub));
      }
    });
    
    // Add sprint priorities
    sprints.forEach(s => {
      if (s.priority === 'high' || s.priority === 'critical') {
        areas.add(s.title);
      }
    });
    
    return Array.from(areas).slice(0, 5);
  }
  
  // ============================================================================
  // EXPANDED KNOWLEDGE QUERIES
  // ============================================================================
  
  private async getHiveKnowledge(): Promise<HiveKnowledge> {
    try {
      const [
        languages,
        curricula,
        topicCategories,
        grammarByLanguage,
        agendaItems,
        openConsultations,
      ] = await Promise.all([
        this.getLanguageOverview(),
        this.getCurriculaOverview(),
        this.getTopicCategories(),
        this.getGrammarByLanguage(),
        this.getAgendaItems(),
        this.getOpenConsultations(),
      ]);
      
      return {
        languages,
        curricula,
        topicCategories,
        grammarByLanguage,
        agendaItems,
        openConsultations,
      };
    } catch (error) {
      console.error('[HiveContext] Error building knowledge:', error);
      return {
        languages: [],
        curricula: [],
        topicCategories: [],
        grammarByLanguage: [],
        agendaItems: [],
        openConsultations: [],
      };
    }
  }
  
  private async getLanguageOverview(): Promise<LanguageOverview[]> {
    try {
      // Get classes grouped by language
      const classes = await db.select()
        .from(teacherClasses)
        .where(eq(teacherClasses.isActive, true));
      
      const languageMap = new Map<string, { count: number; paths: Set<string> }>();
      
      classes.forEach(c => {
        const lang = c.language;
        if (!languageMap.has(lang)) {
          languageMap.set(lang, { count: 0, paths: new Set() });
        }
        const entry = languageMap.get(lang)!;
        entry.count++;
        if (c.curriculumPathId) {
          entry.paths.add(c.curriculumPathId);
        }
      });
      
      return Array.from(languageMap.entries()).map(([language, data]) => ({
        language,
        classCount: data.count,
        curriculumPaths: Array.from(data.paths),
      }));
    } catch (error) {
      console.error('[HiveContext] Error fetching languages:', error);
      return [];
    }
  }
  
  private async getCurriculaOverview(): Promise<CurriculumOverview[]> {
    try {
      const paths = await db.select()
        .from(curriculumPaths)
        .orderBy(asc(curriculumPaths.language), asc(curriculumPaths.name))
        .limit(20);
      
      return paths.map(p => ({
        id: p.id,
        name: p.name,
        language: p.language,
        description: p.description ?? undefined,
        actflTarget: p.actflTarget ?? undefined,
      }));
    } catch (error) {
      console.error('[HiveContext] Error fetching curricula:', error);
      return [];
    }
  }
  
  private async getTopicCategories(): Promise<TopicCategory[]> {
    try {
      const allTopics = await db.select()
        .from(topics);
      
      const categoryMap = new Map<string, number>();
      allTopics.forEach(t => {
        const cat = t.category || 'uncategorized';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      });
      
      return Array.from(categoryMap.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      console.error('[HiveContext] Error fetching topic categories:', error);
      return [];
    }
  }
  
  private async getGrammarByLanguage(): Promise<GrammarOverview[]> {
    try {
      const competencies = await db.select()
        .from(grammarCompetencies);
      
      const languageMap = new Map<string, { count: number; levels: Set<string> }>();
      
      competencies.forEach(c => {
        const lang = c.language;
        if (!languageMap.has(lang)) {
          languageMap.set(lang, { count: 0, levels: new Set() });
        }
        const entry = languageMap.get(lang)!;
        entry.count++;
        if (c.actflLevel) {
          entry.levels.add(c.actflLevel);
        }
      });
      
      return Array.from(languageMap.entries()).map(([language, data]) => ({
        language,
        competencyCount: data.count,
        levels: Array.from(data.levels),
      }));
    } catch (error) {
      console.error('[HiveContext] Error fetching grammar:', error);
      return [];
    }
  }
  
  private async getAgendaItems(): Promise<AgendaItem[]> {
    try {
      const items = await db.select()
        .from(agendaQueue)
        .where(eq(agendaQueue.status, 'pending'))
        .orderBy(desc(agendaQueue.createdAt))
        .limit(10);
      
      return items.map(i => ({
        id: i.id,
        title: i.title,
        priority: i.priority ?? 'normal',
        status: i.status ?? 'pending',
        createdBy: i.createdBy,
      }));
    } catch (error) {
      console.error('[HiveContext] Error fetching agenda:', error);
      return [];
    }
  }
  
  private async getOpenConsultations(): Promise<ConsultationSummary[]> {
    try {
      const threads = await db.select()
        .from(consultationThreads)
        .where(eq(consultationThreads.isResolved, false))
        .orderBy(desc(consultationThreads.updatedAt))
        .limit(20);
      
      return threads.map(t => ({
        id: t.id,
        sprintId: t.sprintId ?? undefined,
        title: t.title ?? 'Untitled',
        topic: t.topic ?? undefined,
        isResolved: t.isResolved ?? false,
      }));
    } catch (error) {
      console.error('[HiveContext] Error fetching consultations:', error);
      return [];
    }
  }
  
  // ============================================================================
  // EXPRESS LANE SESSION TRANSCRIPT ACCESS
  // ============================================================================
  
  /**
   * Get full message transcript for an Express Lane session
   */
  async getSessionTranscript(sessionId: string, limit = 100): Promise<CollaborationMessage[]> {
    try {
      const messages = await db.select()
        .from(collaborationMessages)
        .where(eq(collaborationMessages.sessionId, sessionId))
        .orderBy(asc(collaborationMessages.cursor))
        .limit(limit);
      
      return messages;
    } catch (error) {
      console.error('[HiveContext] Error fetching session transcript:', error);
      return [];
    }
  }
  
  /**
   * Get the most recent messages across all sessions (for quick awareness)
   */
  async getRecentMessages(limit = 20): Promise<CollaborationMessage[]> {
    try {
      const messages = await db.select()
        .from(collaborationMessages)
        .orderBy(desc(collaborationMessages.createdAt))
        .limit(limit);
      
      return messages;
    } catch (error) {
      console.error('[HiveContext] Error fetching recent messages:', error);
      return [];
    }
  }
}

// Singleton export
export const hiveContextService = new HiveContextService();
