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
    description: "Query raw voice pipeline events — both client-side diagnostics and server-side failures. Use this to investigate errors, function call failures, and latency spikes.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        minutes: { type: "number", description: "How many minutes back to look (default 60, max 360)" },
        source: {
          type: "string",
          enum: ["client", "server", "all"],
          description: "Which event source to query. 'client' = client_diag_* events (device/browser diagnostics). 'server' = server-side events like silent_function_failure, gl_turn_latency, gl_tool_failure. 'all' = both. Default: 'all'.",
        },
        event_types: {
          type: "array",
          items: { type: "string" },
          description: "Optional: filter by specific event type substrings. Client examples: lockout_watchdog_8s, failsafe_tier1_20s, error, tts_error. Server examples: silent_function_failure, gl_turn_latency, gl_tool_failure.",
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
        older_than_hours: { type: "number", description: "Only cleanup sessions older than this many hours (minimum 0.5 = 30 minutes, which matches the zombie auto-cleanup threshold)" },
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
  {
    name: "get_session_reliability_report",
    description: "Trend analysis for session reliability problems. Shows daily counts of abnormal disconnects (WS code != 1000) and tutor no-response events, broken down by close code and most-affected users. Use this to spot recurring patterns and determine if a specific problem is getting better or worse over time.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "How many days of history to include (default 7, max 30)" },
      },
    },
  },
  {
    name: "get_gl_health",
    description: "Comprehensive Gemini Live voice pipeline health dashboard. Aggregates all GL-specific telemetry from the live chat area: turn latency percentiles (p50/p90/p99), tool call success rate and per-tool failure breakdown, silent turn count (tutor no-response), mid-turn reconnect count (double-audio risk path), session establishment latency (start() → setupComplete), and barge-in frequency (student interruptions). Use this as your first call when investigating any voice quality issue.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        minutes: { type: "number", description: "How many minutes back to look (default 60, max 720)" },
      },
    },
  },
  {
    name: "get_gl_session_detail",
    description: "Drill into the full GL event timeline for a specific voice session. Returns all voice_pipeline_events for that session in chronological order — turn latencies, tool calls, reconnects, errors. Use after get_gl_health identifies a problem session to understand exactly what happened.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "The voice session ID to inspect" },
      },
      required: ["session_id"],
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
      const source: string = args.source || 'all';

      // Build source filter
      let sourceFilter: string;
      if (source === 'client') {
        sourceFilter = `event_type LIKE 'client_diag_%'`;
      } else if (source === 'server') {
        sourceFilter = `event_type NOT LIKE 'client_diag_%'`;
      } else {
        sourceFilter = `1=1`;
      }

      // Build optional event_type substring filter
      let typeClause = '';
      if (args.event_types?.length > 0) {
        const conditions = (args.event_types as string[])
          .map(t => `event_type LIKE '%${t.replace(/'/g, "''")}%'`)
          .join(' OR ');
        typeClause = `AND (${conditions})`;
      }

      const rows = await sharedDb.execute(sql.raw(`
        SELECT 
          event_type,
          user_id,
          event_data,
          created_at
        FROM voice_pipeline_events
        WHERE ${sourceFilter}
          AND created_at >= '${since.toISOString()}'
          ${typeClause}
        ORDER BY created_at DESC
        LIMIT 50
      `));
      const summary = {
        totalEvents: rows.rows.length,
        source,
        events: rows.rows.map((r: any) => ({
          eventType: r.event_type,
          userId: r.user_id,
          data: typeof r.event_data === 'string' ? JSON.parse(r.event_data) : r.event_data,
          createdAt: r.created_at,
        })),
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
      const hours = Math.max(args.older_than_hours || 0.5, 0.5);
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
        reportId: String(0),
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

    case "get_session_reliability_report": {
      const days = Math.min(args.days || 7, 30);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [disconnectRows, noResponseRows] = await Promise.all([
        sharedDb.execute(sql`
          SELECT
            DATE(created_at) AS day,
            event_data->>'closeCode' AS close_code,
            user_id,
            COUNT(*) AS cnt,
            AVG((event_data->>'sessionDurationSeconds')::float)::int AS avg_duration_s,
            AVG((event_data->>'exchangeCount')::float)::int AS avg_exchanges
          FROM voice_pipeline_events
          WHERE event_type = 'session_abnormal_disconnect'
            AND created_at >= ${since}
          GROUP BY DATE(created_at), event_data->>'closeCode', user_id
          ORDER BY day DESC, cnt DESC
        `),
        sharedDb.execute(sql`
          SELECT
            DATE(created_at) AS day,
            user_id,
            COUNT(*) AS cnt
          FROM voice_pipeline_events
          WHERE event_type = 'gl_tutor_no_response'
            AND created_at >= ${since}
          GROUP BY DATE(created_at), user_id
          ORDER BY day DESC, cnt DESC
        `),
      ]);

      // Roll up daily totals and breakdowns
      const disconnectsByDay: Record<string, { total: number; byCode: Record<string, number>; affectedUsers: number }> = {};
      const noResponseByDay: Record<string, { total: number; affectedUsers: number }> = {};
      const codeFrequency: Record<string, number> = {};
      const affectedUserSet = new Set<string>();

      for (const row of disconnectRows.rows as any[]) {
        const day = String(row.day).substring(0, 10);
        if (!disconnectsByDay[day]) disconnectsByDay[day] = { total: 0, byCode: {}, affectedUsers: 0 };
        const cnt = Number(row.cnt);
        disconnectsByDay[day].total += cnt;
        const code = row.close_code ?? 'unknown';
        disconnectsByDay[day].byCode[code] = (disconnectsByDay[day].byCode[code] || 0) + cnt;
        codeFrequency[code] = (codeFrequency[code] || 0) + cnt;
        if (row.user_id) affectedUserSet.add(String(row.user_id));
      }

      for (const row of noResponseRows.rows as any[]) {
        const day = String(row.day).substring(0, 10);
        if (!noResponseByDay[day]) noResponseByDay[day] = { total: 0, affectedUsers: 0 };
        noResponseByDay[day].total += Number(row.cnt);
        if (row.user_id) affectedUserSet.add(String(row.user_id));
      }

      const totalDisconnects = Object.values(disconnectsByDay).reduce((s, d) => s + d.total, 0);
      const totalNoResponse = Object.values(noResponseByDay).reduce((s, d) => s + d.total, 0);

      // Trend: compare last half of window vs first half
      const midpoint = new Date(since.getTime() + (days / 2) * 24 * 60 * 60 * 1000);
      const midStr = midpoint.toISOString().substring(0, 10);
      const recentDays = Object.entries(disconnectsByDay).filter(([d]) => d >= midStr);
      const olderDays = Object.entries(disconnectsByDay).filter(([d]) => d < midStr);
      const recentTotal = recentDays.reduce((s, [, d]) => s + d.total, 0);
      const olderTotal = olderDays.reduce((s, [, d]) => s + d.total, 0);
      const trend = olderTotal === 0 ? 'stable'
        : recentTotal > olderTotal * 1.2 ? 'worsening'
        : recentTotal < olderTotal * 0.8 ? 'improving'
        : 'stable';

      return {
        success: true,
        data: {
          windowDays: days,
          summary: {
            totalAbnormalDisconnects: totalDisconnects,
            totalTutorNoResponse: totalNoResponse,
            uniqueAffectedUsers: affectedUserSet.size,
            disconnectTrend: trend,
          },
          closeCodeBreakdown: Object.entries(codeFrequency)
            .sort(([, a], [, b]) => b - a)
            .map(([code, count]) => ({
              code,
              count,
              meaning: code === '1006' ? 'abnormal closure / network drop'
                : code === '1001' ? 'browser going away'
                : code === '1011' ? 'server error'
                : code === '1008' ? 'policy violation'
                : 'other',
            })),
          dailyDisconnects: Object.entries(disconnectsByDay)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([day, d]) => ({ day, total: d.total, byCode: d.byCode })),
          dailyTutorNoResponse: Object.entries(noResponseByDay)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([day, d]) => ({ day, total: d.total })),
        },
      };
    }

    case "get_gl_health": {
      const minutes = Math.min(args.minutes || 60, 720);
      const since = new Date(Date.now() - minutes * 60 * 1000);

      const [latencyRows, toolFailureRows, toolSuccessRows, reconnectRows, silentRows, midTurnRows, establishRows, bargeRows] = await Promise.all([
        // Turn latency percentiles
        sharedDb.execute(sql`
          SELECT
            COUNT(*)::int AS turn_count,
            PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY (event_data->>'latencyMs')::float)::int AS p50_ms,
            PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY (event_data->>'latencyMs')::float)::int AS p90_ms,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY (event_data->>'latencyMs')::float)::int AS p99_ms,
            AVG((event_data->>'latencyMs')::float)::int AS avg_ms,
            MAX((event_data->>'latencyMs')::float)::int AS max_ms
          FROM voice_pipeline_events
          WHERE event_type = 'gl_turn_latency'
            AND created_at >= ${since.toISOString()}
        `),
        // Tool call failures — grouped by tool name
        sharedDb.execute(sql`
          SELECT
            event_data->>'toolName' AS tool_name,
            COUNT(*)::int AS failure_count,
            MAX(created_at) AS last_seen
          FROM voice_pipeline_events
          WHERE event_type LIKE 'gl_tool_failure%'
            AND created_at >= ${since.toISOString()}
          GROUP BY event_data->>'toolName'
          ORDER BY failure_count DESC
          LIMIT 10
        `),
        // Tool call successes — total count for success rate denominator
        sharedDb.execute(sql`
          SELECT COUNT(*)::int AS count
          FROM voice_pipeline_events
          WHERE event_type = 'gl_tool_success'
            AND created_at >= ${since.toISOString()}
        `),
        // Abnormal reconnects (WS drops during session)
        sharedDb.execute(sql`
          SELECT COUNT(*)::int AS count
          FROM voice_pipeline_events
          WHERE event_type = 'session_abnormal_disconnect'
            AND created_at >= ${since.toISOString()}
        `),
        // Silent turns — tutor didn't respond
        sharedDb.execute(sql`
          SELECT COUNT(*)::int AS count
          FROM voice_pipeline_events
          WHERE event_type = 'gl_tutor_no_response'
            AND created_at >= ${since.toISOString()}
        `),
        // Mid-turn reconnects — the double-audio risk path
        sharedDb.execute(sql`
          SELECT
            COUNT(*)::int AS count,
            MAX(created_at) AS last_seen,
            string_agg(DISTINCT COALESCE(session_id, 'unknown'), ', ' ORDER BY COALESCE(session_id, 'unknown')) AS sessions
          FROM voice_pipeline_events
          WHERE event_type = 'gl_reconnect_mid_turn'
            AND created_at >= ${since.toISOString()}
        `),
        // Session establishment latency (start() → setupComplete)
        sharedDb.execute(sql`
          SELECT
            COUNT(*)::int AS session_count,
            PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY (event_data->>'establishMs')::float)::int AS p50_ms,
            PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY (event_data->>'establishMs')::float)::int AS p90_ms,
            AVG((event_data->>'establishMs')::float)::int AS avg_ms,
            MAX((event_data->>'establishMs')::float)::int AS max_ms
          FROM voice_pipeline_events
          WHERE event_type = 'gl_session_established'
            AND created_at >= ${since.toISOString()}
        `),
        // Barge-in count — student interruptions of Daniela mid-speech
        sharedDb.execute(sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE (event_data->>'tutorWasGenerating')::boolean = true)::int AS while_generating
          FROM voice_pipeline_events
          WHERE event_type = 'gl_barge_in'
            AND created_at >= ${since.toISOString()}
        `),
      ]);

      const lat = (latencyRows.rows[0] || {}) as any;
      const reconnects = Number((reconnectRows.rows[0] as any)?.count ?? 0);
      const silent = Number((silentRows.rows[0] as any)?.count ?? 0);
      const midTurn = (midTurnRows.rows[0] || {}) as any;
      const midTurnCount = Number(midTurn?.count ?? 0);
      const toolFailures = toolFailureRows.rows as any[];
      const totalToolFailures = toolFailures.reduce((s, r) => s + Number(r.failure_count), 0);
      const totalToolSuccesses = Number((toolSuccessRows.rows[0] as any)?.count ?? 0);
      const totalToolCalls = totalToolSuccesses + totalToolFailures;
      const toolSuccessRate = totalToolCalls > 0
        ? Math.round((totalToolSuccesses / totalToolCalls) * 100)
        : null;
      const estRow = (establishRows.rows[0] || {}) as any;
      const bargeRow = (bargeRows.rows[0] || {}) as any;

      // Compute a simple GL health score
      const turnCount = Number(lat.turn_count ?? 0);
      const p90 = Number(lat.p90_ms ?? 0);
      const estP90 = Number(estRow.p90_ms ?? 0);
      let status = 'green';
      if (reconnects > 5 || silent > 3 || p90 > 8000 || totalToolFailures > 10 || estP90 > 10000) status = 'red';
      else if (reconnects > 2 || silent > 1 || p90 > 5000 || totalToolFailures > 3 || midTurnCount > 0 || (toolSuccessRate !== null && toolSuccessRate < 90) || estP90 > 6000) status = 'yellow';

      return {
        success: true,
        data: {
          windowMinutes: minutes,
          status,
          latency: turnCount === 0 ? null : {
            turnCount,
            p50Ms: Number(lat.p50_ms ?? 0),
            p90Ms: Number(lat.p90_ms ?? 0),
            p99Ms: Number(lat.p99_ms ?? 0),
            avgMs: Number(lat.avg_ms ?? 0),
            maxMs: Number(lat.max_ms ?? 0),
          },
          tools: {
            totalCalls: totalToolCalls,
            successes: totalToolSuccesses,
            failures: totalToolFailures,
            successRatePct: toolSuccessRate,
            byFailedTool: toolFailures.map(r => ({
              toolName: r.tool_name ?? 'unknown',
              count: Number(r.failure_count),
              lastSeen: r.last_seen,
            })),
          },
          sessionEstablishment: Number(estRow.session_count ?? 0) === 0 ? null : {
            sessionCount: Number(estRow.session_count),
            p50Ms: Number(estRow.p50_ms ?? 0),
            p90Ms: Number(estRow.p90_ms ?? 0),
            avgMs: Number(estRow.avg_ms ?? 0),
            maxMs: Number(estRow.max_ms ?? 0),
            note: estP90 > 6000 ? 'Slow GL handshake (>6s p90) — may make first turns feel sluggish.' : 'Establishment latency nominal.',
          },
          bargeIns: {
            total: Number(bargeRow.total ?? 0),
            whileGenerating: Number(bargeRow.while_generating ?? 0),
            note: 'whileGenerating = student spoke while Daniela was mid-speech (true barge-in vs early tap).',
          },
          sessionDrops: {
            abnormalDisconnects: reconnects,
            midTurnReconnects: midTurnCount,
            midTurnLastSeen: midTurn?.last_seen ?? null,
            midTurnSessions: midTurn?.sessions ?? null,
            note: midTurnCount > 0
              ? 'Mid-turn reconnects trigger gl_audio_reset on the client (double-audio fix). Verify no complaints correlate.'
              : 'No mid-turn reconnects in this window.',
          },
          silentTurns: silent,
        },
      };
    }

    case "get_gl_session_detail": {
      const sessionId: string = args.session_id;
      if (!sessionId) return { success: false, data: { error: 'session_id is required' } };

      const rows = await sharedDb.execute(sql`
        SELECT
          event_type,
          event_data,
          created_at,
          user_id
        FROM voice_pipeline_events
        WHERE session_id = ${sessionId}
        ORDER BY created_at ASC
        LIMIT 200
      `);

      const events = (rows.rows as any[]).map(r => ({
        eventType: r.event_type,
        createdAt: r.created_at,
        userId: r.user_id,
        data: r.event_data,
      }));

      // Build a quick summary
      const byType: Record<string, number> = {};
      for (const e of events) byType[e.eventType] = (byType[e.eventType] || 0) + 1;

      const latencies = events
        .filter(e => e.eventType === 'gl_turn_latency')
        .map(e => Number(e.data?.latencyMs ?? 0))
        .filter(n => n > 0);
      const p90 = latencies.length > 0
        ? latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.9)]
        : null;

      return {
        success: true,
        data: {
          sessionId,
          totalEvents: events.length,
          eventTypeSummary: byType,
          latencyP90Ms: p90,
          hasMidTurnReconnect: !!byType['gl_reconnect_mid_turn'],
          hasToolFailures: !!(byType['gl_tool_failure'] || Object.keys(byType).some(k => k.startsWith('gl_tool_failure'))),
          hasAbnormalDisconnect: !!byType['session_abnormal_disconnect'],
          hasSilentTurn: !!byType['gl_tutor_no_response'],
          timeline: events,
        },
      };
    }

    default:
      return { success: false, data: { error: `Unknown tool: ${name}` } };
  }
}
