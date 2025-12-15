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
import { eq, desc, and, sql, gt, isNull } from "drizzle-orm";
import {
  editorListeningSnapshots,
  postFlightReports,
  featureSprints,
  founderSessions,
  type FeatureSprint,
  type FounderSession,
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
    ] = await Promise.all([
      this.getPendingBeacons(),
      this.getRecentPostFlights(),
      this.getActiveSprints(),
      this.getRecentSessions(),
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
}

// Singleton export
export const hiveContextService = new HiveContextService();
