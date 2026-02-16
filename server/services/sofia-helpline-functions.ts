import { FunctionDeclaration } from "@google/genai";
import { getSharedDb } from "../neon-db";
import { getUserDb } from "../db";
import { 
  supportKnowledgeBase, 
  sofiaIssueReports, 
  voiceSessions, 
  supportTickets,
} from "@shared/schema";
import { sql, desc, eq, and, gte } from "drizzle-orm";
import { founderCollabService } from "./founder-collaboration-service";

export const SOFIA_HELPLINE_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "search_knowledge_base",
    description: "Search the troubleshooting knowledge base for articles matching the student's issue. Returns relevant guides with step-by-step solutions. Always try this first when a student reports a problem.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query based on the student's problem description" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_user_sessions",
    description: "Get the student's recent voice sessions with status, duration, and exchange counts. Use this to diagnose voice/audio issues by checking if sessions ended abnormally.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "The student's user ID" },
        hours_back: { type: "number", description: "How many hours back to look (default 2, max 24)" },
      },
      required: ["user_id"],
    },
  },
  {
    name: "get_runtime_faults",
    description: "Check recent system faults and errors. Use when the student reports something that might be a platform-wide issue rather than a user-specific problem.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent faults to retrieve (default 5)" },
      },
    },
  },
  {
    name: "get_voice_health",
    description: "Check the current voice system health status (green/yellow/red). Use to determine if there's a system-wide voice issue affecting the student.",
    parametersJsonSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_issue_report",
    description: "Create a formal issue report for this student's problem. Use when the issue is significant enough to track — voice problems, repeated failures, or bugs. Do NOT create reports for simple questions.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        issue_type: { 
          type: "string", 
          description: "Category: double_audio, no_audio, latency, connection, microphone, recognition, other" 
        },
        description: { type: "string", description: "Brief description of the issue based on what the student reported and what you found" },
      },
      required: ["issue_type", "description"],
    },
  },
  {
    name: "resolve_ticket",
    description: "Mark the current support ticket as resolved with a resolution summary. Use when the student's issue has been addressed.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        resolution: { type: "string", description: "Summary of how the issue was resolved" },
      },
      required: ["resolution"],
    },
  },
  {
    name: "escalate_ticket",
    description: "Escalate the ticket to the founder for human intervention. Use ONLY for critical issues you cannot resolve — billing problems, account issues, or persistent technical failures.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why this needs human attention" },
      },
      required: ["reason"],
    },
  },
  {
    name: "handoff_to_daniela",
    description: "Send the student back to Daniela (the language tutor). Use when the student's question is about language learning, not a technical support issue.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Brief note about why this is a learning question, not support" },
      },
      required: ["reason"],
    },
  },
];

export type HelplineToolContext = {
  ticketId: string;
  userId: string;
  deviceInfo?: { browser?: string; os?: string; device?: string };
  clientTelemetry?: Record<string, any>;
  mode?: 'user' | 'dev';
};

export type HelplineToolResult = { 
  success: boolean; 
  data: any; 
  sideEffects?: {
    shouldReturnToDaniela?: boolean;
    knowledgeUsed?: string;
    issueReportCreated?: string;
  };
};

const helplineCooldowns = new Map<string, Date>();
const HELPLINE_COOLDOWN_MS = 5 * 60 * 1000;

function checkHelplineCooldown(key: string): boolean {
  const last = helplineCooldowns.get(key);
  if (!last) return false;
  return (Date.now() - last.getTime()) < HELPLINE_COOLDOWN_MS;
}

function setHelplineCooldown(key: string): void {
  helplineCooldowns.set(key, new Date());
}

export async function executeSofiaHelplineTool(
  name: string,
  args: Record<string, any>,
  ctx: HelplineToolContext,
): Promise<HelplineToolResult> {
  const sharedDb = getSharedDb();
  const userDb = getUserDb();

  switch (name) {
    case "search_knowledge_base": {
      const query = (args.query || '').toLowerCase();
      const articles = await sharedDb.select()
        .from(supportKnowledgeBase)
        .where(eq(supportKnowledgeBase.isActive, true))
        .orderBy(desc(supportKnowledgeBase.useCount))
        .limit(50);

      const scored = articles.map(article => {
        let score = 0;
        if (article.title.toLowerCase().split(' ').some(word => word.length > 3 && query.includes(word))) score += 3;
        if (article.keywords) {
          for (const kw of article.keywords) {
            if (query.includes(kw.toLowerCase())) score += 2;
          }
        }
        if (article.problem.toLowerCase().split(' ').some(word => word.length > 3 && query.includes(word))) score += 1;
        return { article, score };
      });

      const relevant = scored
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(s => s.article);

      if (relevant.length > 0) {
        await sharedDb.update(supportKnowledgeBase)
          .set({ useCount: sql`${supportKnowledgeBase.useCount} + 1`, updatedAt: new Date() })
          .where(eq(supportKnowledgeBase.id, relevant[0].id));
      }

      const results = relevant.map(a => ({
        title: a.title,
        problem: a.problem,
        solution: a.solution,
        steps: a.steps,
      }));

      return {
        success: true,
        data: { articlesFound: results.length, articles: results },
        sideEffects: relevant.length > 0 ? { knowledgeUsed: relevant[0].id } : undefined,
      };
    }

    case "get_user_sessions": {
      const userId = args.user_id || ctx.userId;
      const hoursBack = Math.min(args.hours_back || 2, 24);
      const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

      const sessions = await sharedDb.select({
        id: voiceSessions.id,
        startedAt: voiceSessions.startedAt,
        endedAt: voiceSessions.endedAt,
        status: voiceSessions.status,
        exchangeCount: voiceSessions.exchangeCount,
        language: voiceSessions.language,
        durationSeconds: voiceSessions.durationSeconds,
      })
        .from(voiceSessions)
        .where(and(
          eq(voiceSessions.userId, userId),
          gte(voiceSessions.startedAt, since),
        ))
        .orderBy(desc(voiceSessions.startedAt))
        .limit(5);

      const sessionData = sessions.map(s => ({
        id: s.id.substring(0, 8),
        language: s.language,
        status: s.status,
        startedAt: s.startedAt ? new Date(s.startedAt).toISOString() : null,
        endedAt: s.endedAt ? new Date(s.endedAt).toISOString() : null,
        durationSeconds: s.durationSeconds,
        exchanges: s.exchangeCount || 0,
      }));

      return {
        success: true,
        data: { sessionCount: sessionData.length, sessions: sessionData, hoursBack },
      };
    }

    case "get_runtime_faults": {
      const limit = Math.min(args.limit || 5, 10);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const faults = await userDb.select({
        id: sofiaIssueReports.id,
        issueType: sofiaIssueReports.issueType,
        userDescription: sofiaIssueReports.userDescription,
        environment: sofiaIssueReports.environment,
        status: sofiaIssueReports.status,
        createdAt: sofiaIssueReports.createdAt,
      })
        .from(sofiaIssueReports)
        .where(and(
          sql`${sofiaIssueReports.createdAt} > ${oneDayAgo}`,
          sql`(${sofiaIssueReports.issueType} LIKE 'runtime_fault:%' OR ${sofiaIssueReports.issueType} LIKE 'voice_fault:%')`,
        ))
        .orderBy(desc(sofiaIssueReports.createdAt))
        .limit(limit);

      const activeFaults = faults.filter(f => f.status !== 'resolved').length;

      return {
        success: true,
        data: {
          totalFaults: faults.length,
          activeFaults,
          faults: faults.map(f => ({
            type: f.issueType,
            description: (f.userDescription || '').substring(0, 200),
            environment: f.environment,
            status: f.status,
            time: f.createdAt?.toISOString(),
          })),
        },
      };
    }

    case "get_voice_health": {
      try {
        const { computeHealthStatus } = await import('./voice-health-monitor');
        const status = await computeHealthStatus();
        return { success: true, data: status };
      } catch (err: any) {
        return { success: false, data: { error: 'Voice health check unavailable' } };
      }
    }

    case "create_issue_report": {
      const cooldownKey = `issue_report_${ctx.ticketId}`;
      if (checkHelplineCooldown(cooldownKey)) {
        return { success: false, data: { reason: "An issue report was already created for this ticket recently" } };
      }

      const [report] = await userDb.insert(sofiaIssueReports)
        .values({
          userId: ctx.userId,
          ticketId: ctx.ticketId,
          issueType: args.issue_type || 'other',
          userDescription: args.description,
          diagnosticSnapshot: {
            source: 'helpline_agent',
            deviceInfo: ctx.deviceInfo,
            clientTelemetry: ctx.clientTelemetry,
          },
          environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
          status: 'pending',
        })
        .returning();

      setHelplineCooldown(cooldownKey);
      console.log(`[Sofia Helpline] Created issue report ${report.id} for ticket ${ctx.ticketId}`);

      founderCollabService.emitSofiaIssueAlert({
        reportId: report.id,
        issueType: args.issue_type,
        userDescription: args.description,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'development',
        hasVoiceDiagnostics: false,
        hasClientTelemetry: !!ctx.clientTelemetry,
      }).catch(e => console.warn('[Sofia Helpline] Alert emit failed:', e));

      return {
        success: true,
        data: { reportId: report.id, issueType: args.issue_type },
        sideEffects: { issueReportCreated: report.id },
      };
    }

    case "resolve_ticket": {
      await userDb.update(supportTickets)
        .set({
          status: 'resolved',
          resolution: args.resolution,
          resolvedAt: new Date(),
        })
        .where(eq(supportTickets.id, ctx.ticketId));

      console.log(`[Sofia Helpline] Resolved ticket ${ctx.ticketId}`);
      return { success: true, data: { resolved: true, ticketId: ctx.ticketId } };
    }

    case "escalate_ticket": {
      const cooldownKey = `escalate_${ctx.ticketId}`;
      if (checkHelplineCooldown(cooldownKey)) {
        return { success: false, data: { reason: "This ticket was already escalated recently" } };
      }

      await userDb.update(supportTickets)
        .set({ status: 'escalated', priority: 'critical' })
        .where(eq(supportTickets.id, ctx.ticketId));

      const environment = process.env.NODE_ENV === 'production' ? 'production' : 'development';
      founderCollabService.emitSofiaIssueAlert({
        reportId: 0,
        issueType: 'ticket_escalation',
        userDescription: `[ESCALATED] ${args.reason}`,
        environment,
        hasVoiceDiagnostics: false,
        hasClientTelemetry: false,
      }).catch(e => console.warn('[Sofia Helpline] Escalation emit failed:', e));

      setHelplineCooldown(cooldownKey);
      console.log(`[Sofia Helpline] Escalated ticket ${ctx.ticketId}: ${args.reason}`);
      return { success: true, data: { escalated: true, reason: args.reason } };
    }

    case "handoff_to_daniela": {
      console.log(`[Sofia Helpline] Handoff to Daniela: ${args.reason}`);
      return {
        success: true,
        data: { handoff: true, reason: args.reason },
        sideEffects: { shouldReturnToDaniela: true },
      };
    }

    default:
      return { success: false, data: { error: `Unknown tool: ${name}` } };
  }
}
