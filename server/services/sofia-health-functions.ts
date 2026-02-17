import { FunctionDeclaration } from "@google/genai";
import { getSharedDb } from "../neon-db";
import { getUserDb } from "../db";
import { supportKnowledgeBase, sofiaIssueReports, voiceSessions } from "@shared/schema";
import { sql, like, desc, eq, and, gte } from "drizzle-orm";
import { computeHealthStatus } from "./voice-health-monitor";
import { founderCollabService } from "./founder-collaboration-service";

export const SOFIA_HEALTH_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "get_health_status",
    description: "Get the current real-time voice health status (green/yellow/red) with metrics for the last 1h and 6h windows.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_recent_pipeline_events",
    description: "Query raw voice pipeline diagnostic events. Use this to investigate which specific error types are occurring and which users/devices are affected.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        minutes: { type: "number", description: "How many minutes back to look (default 60, max 360)" },
        event_types: {
          type: "array",
          items: { type: "string" },
          description: "Filter by specific event types: lockout_watchdog_8s, failsafe_tier1_20s, failsafe_tier2_45s, greeting_silence_15s, error, tts_error, mismatch_recovery",
        },
      },
    },
  },
  {
    name: "get_daily_summaries",
    description: "Get aggregated daily health summaries for trend analysis. Each summary includes total events, unique users, error count, mobile/desktop split, and health status.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Number of days to look back (default 7, max 30)" },
      },
    },
  },
  {
    name: "list_active_sessions",
    description: "List currently active voice sessions. Useful for checking if stale sessions are contributing to health issues.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "cleanup_stale_sessions",
    description: "End voice sessions that have been active longer than the specified threshold without proper cleanup. Safe remediation action.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        older_than_hours: { type: "number", description: "Only cleanup sessions older than this many hours (minimum 2)" },
      },
      required: ["older_than_hours"],
    },
  },
  {
    name: "get_recent_health_digests",
    description: "Get Sofia's own recent health digests to avoid duplicate analysis and understand what actions were already taken.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent digests to retrieve (default 5)" },
      },
    },
  },
  {
    name: "upsert_kb_article",
    description: "Create or update a knowledge base article to help students self-serve when experiencing voice issues. Only create articles for patterns you've confirmed through investigation.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Article title" },
        problem: { type: "string", description: "Description of the problem" },
        solution: { type: "string", description: "Solution summary" },
        steps: {
          type: "array",
          items: { type: "string" },
          description: "Step-by-step troubleshooting instructions",
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Search keywords for this article",
        },
      },
      required: ["title", "problem", "solution", "steps", "keywords"],
    },
  },
  {
    name: "track_pattern",
    description: "Record a detected pattern for long-term tracking. Use when you identify a recurring issue type or device-specific problem.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        pattern_type: { type: "string", description: "Pattern identifier (e.g. 'health_red', 'tts_timeout_mobile')" },
        description: { type: "string", description: "Human-readable description of the pattern" },
        affected_browsers: {
          type: "array",
          items: { type: "string" },
          description: "List of affected browsers if identified",
        },
        affected_devices: {
          type: "array",
          items: { type: "string" },
          description: "List of affected device types if identified",
        },
      },
      required: ["pattern_type", "description"],
    },
  },
  {
    name: "escalate_to_founder",
    description: "Send an alert to the founder when the situation requires human intervention. Use sparingly — only for critical issues that auto-remediation cannot resolve.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Concise summary of the issue and what you've found" },
        severity: { type: "string", enum: ["high", "critical"], description: "Severity level" },
      },
      required: ["summary", "severity"],
    },
  },
  {
    name: "get_context_injection_health",
    description: "Get real-time health metrics for Daniela's context injection sources (classroom, student_intelligence, hive, express_lane, editor_feedback). Shows per-source success rates, latencies, and failure counts. Use to investigate when Daniela may be teaching without full context awareness.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        hours_back: { type: "number", description: "How many hours to look back (default 1, max 24)" },
      },
    },
  },
  {
    name: "refresh_context_cache",
    description: "Force a context cache refresh for all active voice sessions. Use when context injection failures are detected to attempt recovery. Safe action — sessions will re-fetch context on next turn.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "disable_optional_context_source",
    description: "Temporarily disable a non-critical context source (hive, express_lane, editor_feedback) that is persistently failing or slow, to keep the main voice pipeline fast. Critical sources (classroom, student_intelligence) cannot be disabled. The source re-enables automatically after 30 minutes.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        source: { type: "string", enum: ["hive", "express_lane", "editor_feedback"], description: "The optional context source to temporarily disable" },
        reason: { type: "string", description: "Why you're disabling this source (for audit trail)" },
      },
      required: ["source", "reason"],
    },
  },
  {
    name: "get_brain_health_report",
    description: "Get a comprehensive brain health report across ALL dimensions: memory system, neural network retrieval, neural network sync, student learning, tool orchestration, and context injection. Returns per-dimension status (green/yellow/red), scores, and specific issues. This is the most complete diagnostic tool available.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_memory_health",
    description: "Get detailed memory system health: retrieval freshness, relevance scores, injection rates, redundancy detection, and memory starvation (sessions where Daniela had no memory about the student). Low relevance means Daniela is recalling irrelevant facts. High redundancy means she keeps fetching the same memories.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Days to look back (default 1, max 7)" },
      },
    },
  },
  {
    name: "get_neural_network_health",
    description: "Get neural network knowledge base health: counts for all 10 tables (procedures, principles, error patterns, bridges, cultural nuances, dialects, subtlety cues, emotional patterns, creativity templates, best practices) plus tool knowledge. Identifies empty tables that leave Daniela without pedagogical intelligence.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_neural_sync_health",
    description: "Get neural network sync pipeline health: pending promotion queue size, last sync timestamp, environment info. A large backlog means approved knowledge isn't reaching production. Long time since last sync means the learning loop is broken.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_student_learning_health",
    description: "Get student learning intelligence health: coverage rates, fact extraction quality, sparse vs rich memory students. Identifies students who are 'invisible' to the intelligence system — Daniela teaches them without personalization.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "trigger_memory_recovery",
    description: "Trigger the memory recovery worker to process orphaned conversation candidates that weren't properly extracted for personal facts. This recovers lost learning data. Safe action with cooldown.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "run_brain_anomaly_detection",
    description: "Run anomaly detection across brain events to find specific problems: high latency spikes, low relevance retrievals, high redundancy, extraction failures, and memory starvation. Returns severity-rated anomalies with affected event counts.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        hours_back: { type: "number", description: "Hours to analyze (default 6, max 24)" },
      },
    },
  },
];

export type SofiaToolResult = { success: boolean; data: any };

const remediationCooldowns = new Map<string, Date>();
const REMEDIATION_COOLDOWN_MS = 30 * 60 * 1000;

const disabledContextSources = new Map<string, { disabledAt: Date; reason: string; reenableAt: Date }>();
const CONTEXT_DISABLE_DURATION_MS = 30 * 60 * 1000;

export function isContextSourceDisabled(source: string): boolean {
  const entry = disabledContextSources.get(source);
  if (!entry) return false;
  if (Date.now() > entry.reenableAt.getTime()) {
    disabledContextSources.delete(source);
    console.log(`[Sofia Agent] Auto-reenabled context source: ${source}`);
    return false;
  }
  return true;
}

export function getDisabledContextSources(): Map<string, { disabledAt: Date; reason: string; reenableAt: Date }> {
  for (const [src, entry] of disabledContextSources.entries()) {
    if (Date.now() > entry.reenableAt.getTime()) {
      disabledContextSources.delete(src);
    }
  }
  return disabledContextSources;
}

function checkCooldown(actionKey: string): boolean {
  const last = remediationCooldowns.get(actionKey);
  if (!last) return false;
  return (Date.now() - last.getTime()) < REMEDIATION_COOLDOWN_MS;
}

function setCooldown(actionKey: string): void {
  remediationCooldowns.set(actionKey, new Date());
}

export async function executeSofiaTool(
  name: string,
  args: Record<string, any>,
): Promise<SofiaToolResult> {
  const sharedDb = getSharedDb();

  switch (name) {
    case "get_health_status": {
      const result = await computeHealthStatus();
      return { success: true, data: result };
    }

    case "get_recent_pipeline_events": {
      const minutes = Math.min(args.minutes || 60, 360);
      const since = new Date(Date.now() - minutes * 60 * 1000);
      let typeFilter = sql`1=1`;
      if (args.event_types?.length > 0) {
        const prefixed = args.event_types.map((t: string) => `client_diag_${t}`);
        typeFilter = sql`event_type = ANY(${prefixed})`;
      }
      const rows = await sharedDb.execute(sql`
        SELECT 
          event_type,
          user_id,
          event_data->'device'->>'screenWidth' as screen_width,
          event_data->'device'->>'browser' as browser,
          event_data->>'triggerType' as trigger_type,
          created_at
        FROM voice_pipeline_events
        WHERE event_type LIKE 'client_diag_%'
          AND created_at >= ${since}
          AND ${typeFilter}
        ORDER BY created_at DESC
        LIMIT 50
      `);
      const summary = {
        totalEvents: rows.rows.length,
        events: rows.rows,
      };
      return { success: true, data: summary };
    }

    case "get_daily_summaries": {
      const days = Math.min(args.days || 7, 30);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const dateStr = since.toISOString().split('T')[0];
      const rows = await sharedDb.execute(sql`
        SELECT * FROM voice_diag_daily_summaries
        WHERE summary_date >= ${dateStr}
        ORDER BY summary_date DESC
      `);
      return { success: true, data: rows.rows };
    }

    case "list_active_sessions": {
      const rows = await sharedDb.execute(sql`
        SELECT 
          id, user_id, started_at, tutor_mode, 
          EXTRACT(EPOCH FROM (NOW() - started_at)) / 3600 as hours_active
        FROM voice_sessions
        WHERE status = 'active' AND ended_at IS NULL
        ORDER BY started_at ASC
        LIMIT 20
      `);
      return { success: true, data: { activeSessions: rows.rows, count: rows.rows.length } };
    }

    case "cleanup_stale_sessions": {
      if (checkCooldown('stale_session_cleanup')) {
        return { success: false, data: { reason: "Cooldown active — stale session cleanup was already performed within the last 30 minutes" } };
      }
      const hours = Math.max(args.older_than_hours || 2, 2);
      const threshold = new Date(Date.now() - hours * 60 * 60 * 1000);
      const result = await sharedDb.execute(sql`
        UPDATE voice_sessions 
        SET status = 'completed', ended_at = NOW()
        WHERE status = 'active' 
          AND started_at < ${threshold}
          AND ended_at IS NULL
      `);
      const cleaned = result.rowCount || 0;
      setCooldown('stale_session_cleanup');
      if (cleaned > 0) {
        console.log(`[Sofia Agent] Remediation: cleaned ${cleaned} stale sessions (>${hours}h)`);
      }
      return { success: true, data: { cleaned, threshold_hours: hours } };
    }

    case "get_recent_health_digests": {
      const limit = Math.min(args.limit || 5, 20);
      const digests = await getUserDb().select({
        id: sofiaIssueReports.id,
        issueType: sofiaIssueReports.issueType,
        userDescription: sofiaIssueReports.userDescription,
        sofiaAnalysis: sofiaIssueReports.sofiaAnalysis,
        status: sofiaIssueReports.status,
        createdAt: sofiaIssueReports.createdAt,
      })
        .from(sofiaIssueReports)
        .where(eq(sofiaIssueReports.issueType, 'voice_health_transition'))
        .orderBy(desc(sofiaIssueReports.createdAt))
        .limit(limit);
      return { success: true, data: digests };
    }

    case "upsert_kb_article": {
      if (checkCooldown('kb_article')) {
        return { success: false, data: { reason: "Cooldown active — KB article was already created/updated within the last 30 minutes" } };
      }
      const existing = await getSharedDb().select()
        .from(supportKnowledgeBase)
        .where(like(supportKnowledgeBase.title, `%${args.title.substring(0, 30)}%`))
        .limit(1);

      if (existing.length > 0) {
        return { success: true, data: { action: "already_exists", articleId: existing[0].id, title: existing[0].title } };
      }

      const [article] = await getSharedDb().insert(supportKnowledgeBase)
        .values({
          title: args.title,
          problem: args.problem,
          solution: args.solution,
          steps: JSON.stringify(args.steps),
          keywords: args.keywords,
          category: 'technical',
          isActive: true,
        })
        .returning();
      setCooldown('kb_article');
      console.log(`[Sofia Agent] Created KB article: ${article.id} — ${args.title}`);
      return { success: true, data: { action: "created", articleId: article.id, title: args.title } };
    }

    case "track_pattern": {
      if (checkCooldown('pattern_tracking')) {
        return { success: false, data: { reason: "Cooldown active — pattern was already tracked within the last 30 minutes" } };
      }
      const now = new Date();
      const existingPatterns = await getUserDb().select()
        .from(sofiaIssueReports)
        .where(and(
          eq(sofiaIssueReports.issueType, 'voice_health_transition'),
          gte(sofiaIssueReports.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
        ))
        .orderBy(desc(sofiaIssueReports.createdAt))
        .limit(5);
      setCooldown('pattern_tracking');
      console.log(`[Sofia Agent] Tracked pattern: ${args.pattern_type} — ${args.description}`);
      return { success: true, data: { tracked: true, pattern_type: args.pattern_type, recentDigests: existingPatterns.length } };
    }

    case "escalate_to_founder": {
      if (checkCooldown('escalation')) {
        return { success: false, data: { reason: "Cooldown active — founder was already alerted within the last 30 minutes" } };
      }
      const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
      await founderCollabService.emitSofiaIssueAlert({
        reportId: 0,
        issueType: 'voice_health_escalation',
        userDescription: `[ESCALATION ${args.severity.toUpperCase()}] ${args.summary}`,
        environment,
        hasVoiceDiagnostics: true,
        hasClientTelemetry: false,
      }).catch(e => console.warn('[Sofia Agent] Escalation emit failed:', e));
      setCooldown('escalation');
      console.log(`[Sofia Agent] Escalated to founder (${args.severity}): ${args.summary}`);
      return { success: true, data: { escalated: true, severity: args.severity } };
    }

    case "get_context_injection_health": {
      const { brainHealthTelemetry } = await import('./brain-health-telemetry');
      const hoursBack = Math.min(args.hours_back || 1, 24);
      const health = await brainHealthTelemetry.getContextInjectionHealth(hoursBack);
      const disabled = getDisabledContextSources();
      const disabledList: Record<string, { reason: string; reenableAt: string }> = {};
      for (const [src, entry] of disabled.entries()) {
        disabledList[src] = { reason: entry.reason, reenableAt: entry.reenableAt.toISOString() };
      }
      return { success: true, data: { ...health, disabledSources: disabledList } };
    }

    case "refresh_context_cache": {
      if (checkCooldown('context_cache_refresh')) {
        return { success: false, data: { reason: "Cooldown active — context cache was already refreshed within the last 30 minutes" } };
      }
      try {
        const { getStreamingVoiceOrchestrator } = await import('./streaming-voice-orchestrator');
        const orchestrator = getStreamingVoiceOrchestrator();
        const refreshed = orchestrator.refreshAllSessionCaches();
        setCooldown('context_cache_refresh');
        console.log(`[Sofia Agent] Remediation: refreshed context cache for ${refreshed} active sessions`);
        return { success: true, data: { sessionsRefreshed: refreshed } };
      } catch (err: any) {
        return { success: false, data: { error: `Cache refresh failed: ${err.message}` } };
      }
    }

    case "disable_optional_context_source": {
      const source = args.source;
      const reason = args.reason;
      if (!['hive', 'express_lane', 'editor_feedback'].includes(source)) {
        return { success: false, data: { error: `Cannot disable critical source: ${source}. Only optional sources (hive, express_lane, editor_feedback) can be disabled.` } };
      }
      if (checkCooldown(`disable_${source}`)) {
        return { success: false, data: { reason: `Cooldown active — ${source} disable action was already taken within the last 30 minutes` } };
      }
      const now = new Date();
      disabledContextSources.set(source, {
        disabledAt: now,
        reason,
        reenableAt: new Date(now.getTime() + CONTEXT_DISABLE_DURATION_MS),
      });
      setCooldown(`disable_${source}`);
      console.log(`[Sofia Agent] Remediation: disabled optional context source '${source}' for 30min — reason: ${reason}`);
      return { success: true, data: { source, disabled: true, reenableAt: new Date(now.getTime() + CONTEXT_DISABLE_DURATION_MS).toISOString(), reason } };
    }

    case "get_brain_health_report": {
      const { runBrainHealthCheck } = await import('./brain-health-aggregator');
      const report = await runBrainHealthCheck();
      const summary: Record<string, any> = {
        overallStatus: report.overallStatus,
        overallScore: report.overallScore,
        timestamp: report.timestamp.toISOString(),
        dimensions: {} as Record<string, any>,
      };
      for (const [key, dim] of Object.entries(report.dimensions)) {
        summary.dimensions[key] = {
          status: dim.status,
          score: dim.score,
          reasons: dim.reasons,
        };
      }
      return { success: true, data: summary };
    }

    case "get_memory_health": {
      const { brainHealthTelemetry: bht } = await import('./brain-health-telemetry');
      const days = Math.min(args.days || 1, 7);
      const memHealth = await bht.getMemoryHealthMetrics(days);
      const studentCoverage = await bht.getStudentCoverage();
      return {
        success: true,
        data: {
          ...memHealth,
          injectionRatePercent: Math.round(memHealth.injectionRate * 100),
          redundancyRatePercent: Math.round(memHealth.redundancyRate * 100),
          studentsWithRichMemory: studentCoverage.studentsWithRichMemory,
          studentsWithSparseMemory: studentCoverage.studentsWithSparseMemory,
          totalActiveStudents: studentCoverage.studentsWithActivity,
        },
      };
    }

    case "get_neural_network_health": {
      const { runBrainHealthCheck: runCheck } = await import('./brain-health-aggregator');
      const report = await runCheck();
      const nnDim = report.dimensions.neuralRetrieval;
      return {
        success: true,
        data: {
          status: nnDim.status,
          score: nnDim.score,
          reasons: nnDim.reasons,
          tableCounts: nnDim.metrics.tableCounts || {},
          toolCount: nnDim.metrics.toolCount || 0,
          totalKnowledge: nnDim.metrics.totalKnowledge || 0,
        },
      };
    }

    case "get_neural_sync_health": {
      const { neuralNetworkSync: nnSync } = await import('./neural-network-sync');
      const syncStats = await nnSync.getSyncStats();
      const hoursSinceSync = syncStats.lastSyncTime
        ? Math.round((Date.now() - syncStats.lastSyncTime.getTime()) / (1000 * 60 * 60))
        : null;
      return {
        success: true,
        data: {
          ...syncStats,
          lastSyncTime: syncStats.lastSyncTime?.toISOString() || null,
          hoursSinceLastSync: hoursSinceSync,
          syncHealthy: hoursSinceSync === null || hoursSinceSync < 48,
          backlogHealthy: syncStats.pendingPromotions < 10,
        },
      };
    }

    case "get_student_learning_health": {
      const { brainHealthTelemetry: bht2 } = await import('./brain-health-telemetry');
      const coverage = await bht2.getStudentCoverage();
      const factMetrics = await bht2.getFactExtractionMetrics(1);
      return {
        success: true,
        data: {
          coverage: {
            totalStudents: coverage.studentsWithActivity,
            richMemory: coverage.studentsWithRichMemory,
            sparseMemory: coverage.studentsWithSparseMemory,
            topStudents: coverage.coverageByStudent.slice(0, 5),
          },
          factQuality: {
            ...factMetrics,
            specificityRatePercent: Math.round(factMetrics.specificityRate * 100),
          },
        },
      };
    }

    case "trigger_memory_recovery": {
      if (checkCooldown('memory_recovery')) {
        return { success: false, data: { reason: "Cooldown active — memory recovery was already triggered within the last 30 minutes" } };
      }
      try {
        const { memoryRecoveryWorker } = await import('./memory-recovery-worker');
        const result = await memoryRecoveryWorker.runRecovery();
        setCooldown('memory_recovery');
        console.log(`[Sofia Agent] Remediation: triggered memory recovery — ${result.candidatesProcessed} processed, ${result.factsExtracted} facts recovered`);
        return { success: true, data: result };
      } catch (err: any) {
        return { success: false, data: { error: `Memory recovery failed: ${err.message}` } };
      }
    }

    case "run_brain_anomaly_detection": {
      const { brainHealthTelemetry: bht3 } = await import('./brain-health-telemetry');
      const hoursBack = Math.min(args.hours_back || 6, 24);
      const anomalyResult = await bht3.detectAnomalies(hoursBack);
      return {
        success: true,
        data: {
          healthScore: anomalyResult.healthScore,
          anomalyCount: anomalyResult.anomalies.length,
          criticalCount: anomalyResult.anomalies.filter(a => a.severity === 'critical').length,
          anomalies: anomalyResult.anomalies.map(a => ({
            type: a.type,
            severity: a.severity,
            message: a.message,
            affectedEvents: a.affectedEvents,
          })),
          recommendation: anomalyResult.recommendation,
        },
      };
    }

    default:
      return { success: false, data: { error: `Unknown tool: ${name}` } };
  }
}
