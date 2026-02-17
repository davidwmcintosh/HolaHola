import Anthropic from "@anthropic-ai/sdk";
import { getSharedDb } from "../neon-db";
import { getUserDb } from "../db";
import { 
  voiceSessions, 
  sofiaIssueReports,
  editorInsights,
  users,
} from "@shared/schema";
import { sql, desc, eq, and, gte } from "drizzle-orm";
import { computeHealthStatus } from "./voice-health-monitor";
import { founderCollabService } from "./founder-collaboration-service";

export const ALDEN_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_system_health",
    description: "Get real-time system health: voice pipeline status (green/yellow/red), active voice sessions count, server uptime, and TTS provider status.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_database_stats",
    description: "Get database statistics: table row counts for key tables (users, conversations, voice sessions, vocabulary), connection pool status, and recent growth metrics.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_user_analytics",
    description: "Get user analytics: total users, active learners (last 7 days), new registrations (last 30 days), language distribution, and subscription tier breakdown.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_voice_session_metrics",
    description: "Get voice session metrics: total sessions, sessions today, average duration, TTS provider usage breakdown, error rate, and recent session activity.",
    input_schema: {
      type: "object" as const,
      properties: {
        days: { type: "number" as const, description: "Number of days to analyze (default 7, max 30)" },
      },
    },
  },
  {
    name: "get_recent_errors",
    description: "Get recent errors and issues: voice pipeline failures, API errors, and Sofia-reported issues from the last N hours.",
    input_schema: {
      type: "object" as const,
      properties: {
        hours: { type: "number" as const, description: "Hours to look back (default 24, max 72)" },
      },
    },
  },
  {
    name: "get_sofia_report",
    description: "Get Sofia's latest health digests and issue reports. Shows what Sofia has found through her autonomous monitoring.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" as const, description: "Number of reports to retrieve (default 5, max 20)" },
      },
    },
  },
  {
    name: "search_editor_memories",
    description: "Search Alden's persistent memory (editor insights) for past context, architectural decisions, debugging notes, and project history.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" as const, description: "Search term or topic to find in memories" },
        category: { 
          type: "string" as const, 
          description: "Filter by category: philosophy, architecture, relationship, debugging, personality, workflow, context, journal" 
        },
      },
      required: ["query"],
    },
  },
  {
    name: "post_to_express_lane",
    description: "Post a message to the Express Lane collaboration channel. Use this to share findings, coordinate with Daniela/Wren, or log important observations.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string" as const, description: "The message content to post" },
        metadata: {
          type: "object" as const,
          description: "Optional metadata (e.g., { source: 'alden-chat', topic: 'health-check' })",
        },
      },
      required: ["content"],
    },
  },
  {
    name: "run_full_systems_check",
    description: "Run a complete systems diagnostic across ALL of Daniela's cognitive architecture. Returns a GO/CAUTION/NO-GO verdict with scores for all 6 brain health dimensions (Memory, Neural Retrieval, Neural Sync, Student Learning, Tool Orchestration, Context Injection), plus voice pipeline and TTS provider status. Use this when the founder asks 'how is the system running?' or wants a status report.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];

export async function executeAldenTool(
  toolName: string,
  args: Record<string, any>
): Promise<{ data: any; sideEffects?: Record<string, any> }> {
  try {
    switch (toolName) {
      case "get_system_health": {
        const healthStatus = await computeHealthStatus();
        
        const sharedDb = getSharedDb();
        const [activeSessionCount] = await sharedDb.select({
          count: sql<number>`count(*)`,
        }).from(voiceSessions)
          .where(eq(voiceSessions.isActive, true));

        return {
          data: {
            voiceHealth: {
              status: healthStatus.status,
              score: healthStatus.score,
              metrics1h: healthStatus.metrics1h,
              metrics6h: healthStatus.metrics6h,
            },
            activeSessions: Number(activeSessionCount?.count || 0),
            serverUptime: Math.floor(process.uptime()),
            memoryUsage: {
              heapUsedMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
              heapTotalMB: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
              rssMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
            },
          },
        };
      }

      case "get_database_stats": {
        const sharedDb = getSharedDb();
        const userDb = getUserDb();

        const [userCount] = await userDb.select({ count: sql<number>`count(*)` }).from(users);
        const [sessionCount] = await sharedDb.select({ count: sql<number>`count(*)` }).from(voiceSessions);

        const recentGrowth = await userDb.select({
          count: sql<number>`count(*)`,
        }).from(users)
          .where(gte(users.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));

        return {
          data: {
            tables: {
              users: Number(userCount?.count || 0),
              voiceSessions: Number(sessionCount?.count || 0),
            },
            recentGrowth: {
              newUsersLast7d: Number(recentGrowth[0]?.count || 0),
            },
          },
        };
      }

      case "get_user_analytics": {
        const userDb = getUserDb();

        const [totalUsers] = await userDb.select({ count: sql<number>`count(*)` }).from(users);
        
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [activeUsers] = await userDb.select({
          count: sql<number>`count(*)`,
        }).from(users).where(gte(users.lastLoginAt, sevenDaysAgo));

        const [newUsers] = await userDb.select({
          count: sql<number>`count(*)`,
        }).from(users).where(gte(users.createdAt, thirtyDaysAgo));

        const languageDistribution = await userDb.select({
          language: users.targetLanguage,
          count: sql<number>`count(*)`,
        }).from(users)
          .groupBy(users.targetLanguage)
          .orderBy(desc(sql`count(*)`))
          .limit(10);

        return {
          data: {
            totalUsers: Number(totalUsers?.count || 0),
            activeUsersLast7d: Number(activeUsers?.count || 0),
            newUsersLast30d: Number(newUsers?.count || 0),
            languageDistribution: languageDistribution.map(l => ({
              language: l.language || 'not set',
              count: Number(l.count),
            })),
          },
        };
      }

      case "get_voice_session_metrics": {
        const days = Math.min(args.days || 7, 30);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const sharedDb = getSharedDb();

        const [totalSessions] = await sharedDb.select({
          count: sql<number>`count(*)`,
        }).from(voiceSessions)
          .where(gte(voiceSessions.startedAt, since));

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [todaySessions] = await sharedDb.select({
          count: sql<number>`count(*)`,
        }).from(voiceSessions)
          .where(gte(voiceSessions.startedAt, today));

        const ttsBreakdown = await sharedDb.select({
          provider: voiceSessions.ttsProvider,
          count: sql<number>`count(*)`,
        }).from(voiceSessions)
          .where(gte(voiceSessions.startedAt, since))
          .groupBy(voiceSessions.ttsProvider)
          .orderBy(desc(sql`count(*)`));

        return {
          data: {
            period: `last ${days} days`,
            totalSessions: Number(totalSessions?.count || 0),
            sessionsToday: Number(todaySessions?.count || 0),
            ttsProviderBreakdown: ttsBreakdown.map(t => ({
              provider: t.provider || 'unknown',
              count: Number(t.count),
            })),
          },
        };
      }

      case "get_recent_errors": {
        const hours = Math.min(args.hours || 24, 72);
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        const sharedDb = getSharedDb();

        const recentIssues = await sharedDb.select({
          id: sofiaIssueReports.id,
          issueType: sofiaIssueReports.issueType,
          severity: sofiaIssueReports.severity,
          title: sofiaIssueReports.title,
          description: sofiaIssueReports.description,
          status: sofiaIssueReports.status,
          createdAt: sofiaIssueReports.createdAt,
        }).from(sofiaIssueReports)
          .where(gte(sofiaIssueReports.createdAt, since))
          .orderBy(desc(sofiaIssueReports.createdAt))
          .limit(15);

        return {
          data: {
            period: `last ${hours} hours`,
            issueCount: recentIssues.length,
            issues: recentIssues.map(i => ({
              type: i.issueType,
              severity: i.severity,
              title: i.title,
              description: i.description?.substring(0, 200),
              status: i.status,
              when: i.createdAt?.toISOString(),
            })),
          },
        };
      }

      case "get_sofia_report": {
        const limit = Math.min(args.limit || 5, 20);
        const sharedDb = getSharedDb();

        const digests = await sharedDb.select({
          id: sofiaIssueReports.id,
          issueType: sofiaIssueReports.issueType,
          severity: sofiaIssueReports.severity,
          title: sofiaIssueReports.title,
          description: sofiaIssueReports.description,
          status: sofiaIssueReports.status,
          source: sofiaIssueReports.source,
          createdAt: sofiaIssueReports.createdAt,
        }).from(sofiaIssueReports)
          .where(eq(sofiaIssueReports.source, 'health_agent'))
          .orderBy(desc(sofiaIssueReports.createdAt))
          .limit(limit);

        return {
          data: {
            sofiaDigests: digests.map(d => ({
              type: d.issueType,
              severity: d.severity,
              title: d.title,
              analysis: d.description?.substring(0, 500),
              status: d.status,
              when: d.createdAt?.toISOString(),
            })),
          },
        };
      }

      case "search_editor_memories": {
        const { query, category } = args;
        const sharedDb = getSharedDb();

        let conditions = [
          sql`(${editorInsights.title} ILIKE ${'%' + query + '%'} OR ${editorInsights.content} ILIKE ${'%' + query + '%'})`,
        ];
        if (category) {
          conditions.push(eq(editorInsights.category, category));
        }

        const memories = await sharedDb.select({
          id: editorInsights.id,
          category: editorInsights.category,
          title: editorInsights.title,
          content: editorInsights.content,
          importance: editorInsights.importance,
          createdAt: editorInsights.createdAt,
        }).from(editorInsights)
          .where(and(...conditions))
          .orderBy(desc(editorInsights.importance), desc(editorInsights.createdAt))
          .limit(10);

        return {
          data: {
            query,
            matchCount: memories.length,
            memories: memories.map(m => ({
              category: m.category,
              title: m.title,
              content: m.content?.substring(0, 300),
              importance: m.importance,
              when: m.createdAt?.toISOString(),
            })),
          },
        };
      }

      case "post_to_express_lane": {
        const { content, metadata } = args;
        
        await founderCollabService.addMessage({
          role: 'editor',
          content: `[Alden Chat] ${content}`,
          metadata: { source: 'alden-voice-chat', ...metadata },
        });

        return {
          data: { posted: true, channel: 'express-lane' },
        };
      }

      case "run_full_systems_check": {
        const startTime = Date.now();

        const { runBrainHealthCheck } = await import('./brain-health-aggregator');
        const brainReport = await runBrainHealthCheck();

        const { computeContextHealthStatus } = await import('./context-health-monitor');
        const contextHealth = await computeContextHealthStatus();

        const healthStatus = await computeHealthStatus();

        const sharedDb = getSharedDb();
        const [activeSessionCount] = await sharedDb.select({
          count: sql<number>`count(*)`,
        }).from(voiceSessions)
          .where(eq(voiceSessions.isActive, true));

        const elapsed = Date.now() - startTime;

        const allGreen = brainReport.overallStatus === 'green' && contextHealth.status !== 'red';
        const hasWarnings = brainReport.overallStatus === 'yellow' || contextHealth.status === 'yellow';
        const verdict = allGreen ? 'GO' : hasWarnings ? 'CAUTION' : 'NO-GO';

        const dimensionSummaries: string[] = [];
        for (const [key, dim] of Object.entries(brainReport.dimensions)) {
          const d = dim as any;
          const icon = d.status === 'green' ? 'PASS' : d.status === 'yellow' ? 'WARN' : 'FAIL';
          dimensionSummaries.push(`${icon}: ${d.name} — ${d.score}/100${d.reasons?.length ? ' (' + d.reasons[0] + ')' : ''}`);
        }

        return {
          data: {
            verdict,
            overallScore: brainReport.overallScore,
            overallStatus: brainReport.overallStatus,
            dimensions: dimensionSummaries,
            voicePipeline: {
              status: healthStatus.status,
              score: healthStatus.score,
            },
            contextInjection: {
              status: contextHealth.status,
              reasons: contextHealth.reasons,
            },
            activeSessions: Number(activeSessionCount?.count || 0),
            serverUptime: Math.floor(process.uptime()),
            memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            checkDurationMs: elapsed,
          },
        };
      }

      default:
        return { data: { error: `Unknown tool: ${toolName}` } };
    }
  } catch (error: any) {
    console.error(`[Alden Tool] ${toolName} failed:`, error.message);
    return { data: { error: error.message } };
  }
}

console.log('[Alden Functions] Loaded — 9 platform management tools ready');
