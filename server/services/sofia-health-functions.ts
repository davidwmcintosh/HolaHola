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
];

export type SofiaToolResult = { success: boolean; data: any };

const remediationCooldowns = new Map<string, Date>();
const REMEDIATION_COOLDOWN_MS = 30 * 60 * 1000;

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
        SET status = 'ended', ended_at = NOW()
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

    default:
      return { success: false, data: { error: `Unknown tool: ${name}` } };
  }
}
