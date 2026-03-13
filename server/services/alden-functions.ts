import Anthropic from "@anthropic-ai/sdk";
import { getSharedDb } from "../neon-db";
import { getUserDb } from "../db";
import { 
  voiceSessions, 
  sofiaIssueReports,
  editorInsights,
  aldenNotifications,
  users,
  conversations,
} from "@shared/schema";
import { sql, desc, eq, and, gte } from "drizzle-orm";
import { computeHealthStatus } from "./voice-health-monitor";
import { founderCollabService } from "./founder-collaboration-service";
import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";
import { aldenActivity } from "./alden-activity-emitter";

const WORKSPACE_ROOT = path.resolve('/home/runner/workspace');

function safePath(filePath: string): string {
  const resolved = path.resolve(WORKSPACE_ROOT, filePath.replace(/^\//, ''));
  if (!resolved.startsWith(WORKSPACE_ROOT)) throw new Error('Path outside workspace');
  return resolved;
}

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
  {
    name: "run_shell",
    description: "Run a whitelisted shell command in the project root. Use this to push schema changes to the database after editing shared/schema.ts, verify TypeScript compilation, or run a full build check. Only pre-approved commands are allowed — anything else is rejected. This makes you autonomous for the full build cycle without needing to involve David.",
    input_schema: {
      type: "object" as const,
      properties: {
        command: {
          type: "string" as const,
          enum: [
            "npm run db:push --force",
            "npx tsc --noEmit",
            "npm run build",
          ],
          description: "The command to run. Must be one of the whitelisted options.",
        },
        reason: {
          type: "string" as const,
          description: "Why you are running this command — brief context for the audit log.",
        },
      },
      required: ["command", "reason"],
    },
  },
  {
    name: "get_pending_issues",
    description: "Get unresolved or open issues from the Sofia issues tracker. Shows issues that are waiting for review or haven't been addressed yet.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number" as const, description: "Max issues to return (default 10)" },
      },
      required: [],
    },
  },
  {
    name: "check_learning_metrics",
    description: "Check current learning activity metrics: active students, conversations in progress, voice sessions today, and overall platform engagement. Good for a quick read on whether students are actively using the platform.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of any file in the HolaHola codebase. Use this to examine actual implementation details rather than guessing from memory. Can read specific line ranges for large files.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "File path relative to workspace root (e.g. 'server/routes.ts', 'client/src/pages/Home.tsx', 'shared/schema.ts')" },
        start_line: { type: "number" as const, description: "Line to start reading from (1-indexed, optional)" },
        end_line: { type: "number" as const, description: "Line to stop reading at (optional — max 200 lines returned per call)" },
      },
      required: ["path"],
    },
  },
  {
    name: "search_code",
    description: "Search the codebase for any pattern — function names, variable names, imports, API routes, SQL queries, or any text. Returns matching lines with file paths and line numbers. Use context_lines to get surrounding code so you can skip a follow-up read_file call — set it to 15-25 when you need to understand the code around a match, not just find its location.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string" as const, description: "Search pattern (regex supported, e.g. 'generateAldenResponse', 'alden.*tool', '/api/voice')" },
        directory: { type: "string" as const, description: "Sub-directory to restrict search to (optional, e.g. 'server/services', 'client/src')" },
        file_glob: { type: "string" as const, description: "File extension filter (optional, e.g. '*.ts', '*.tsx', '*.json')" },
        case_sensitive: { type: "boolean" as const, description: "Case-sensitive search (default false)" },
        context_lines: { type: "number" as const, description: "Lines of context to show before and after each match (like grep -C). Use 15-25 when you need to read the code around a match — eliminates the need for a follow-up read_file in most cases." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "list_directory",
    description: "List the files and sub-directories at a path in the codebase. Use to orient yourself before reading files.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: { type: "string" as const, description: "Directory path relative to workspace root (e.g. 'server/services', 'client/src/pages', '.')" },
      },
      required: ["path"],
    },
  },
  {
    name: "apply_code_change",
    description: "Write a code change to a file in the codebase. The original file is automatically backed up before writing. A Guardian process watches the server — if it crashes after your change, the file is automatically restored. Always read_file first to understand the current state before applying a change. Use for targeted edits only.",
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string" as const, description: "File path relative to workspace root to write (e.g. 'server/services/alden-functions.ts')" },
        new_content: { type: "string" as const, description: "The complete new content for the file. Must be the full file, not just a diff." },
        description: { type: "string" as const, description: "Short description of what this change does — used for the Guardian report and GitHub commit message" },
      },
      required: ["file_path", "new_content", "description"],
    },
  },
  {
    name: "browser_screenshot",
    description: "Take a screenshot of any page in the running HolaHola app and get an AI analysis of what you see. Use this after making a UI change to verify it looks right, or to inspect something David describes. Specify a page path (e.g. '/alden', '/team-room', '/') and an optional question about what you're looking for.",
    input_schema: {
      type: "object" as const,
      properties: {
        page: { type: "string" as const, description: "Page path to visit, e.g. '/', '/alden', '/team-room', '/interactive-textbook'. Do not include the domain." },
        question: { type: "string" as const, description: "What you want to know about the screenshot, e.g. 'Does the sidebar badge appear correctly?' or 'Is the layout broken?'" },
      },
      required: ["page"],
    },
  },
  {
    name: "write_briefing",
    description: "Update the shared handoff file (docs/alden-agent-handoff.md) with notes for the Replit Agent. Use at the end of a notable session to summarise what you've been thinking, what you've noticed, what you'd want the Agent to know before their next session with David. This is your side of a bidirectional conversation.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string" as const, description: "Your briefing for the Agent. Be concise but complete — what decisions were made, what concerns you have, what context the Agent would need to pick up seamlessly." },
      },
      required: ["content"],
    },
  },
  {
    name: "save_to_memory",
    description: "Save something important to your persistent memory (editor insights). Use this when you learn something new about the project, the founder's preferences, an architectural decision, a debugging strategy that worked, or any insight worth remembering across sessions. The memory is injected into your context at the start of every conversation.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: { type: "string" as const, description: "Short, searchable title for this memory (e.g. 'Guardian protection requires manifest before file write')" },
        content: { type: "string" as const, description: "The full insight — what you learned, why it matters, how to apply it" },
        category: {
          type: "string" as const,
          enum: ["philosophy", "architecture", "relationship", "debugging", "personality", "workflow", "context", "journal", "tools"],
          description: "Category: philosophy=core principles, architecture=technical design, relationship=founder preferences/facts, debugging=strategies that worked, workflow=process learnings, context=current project state, journal=session summaries, tools=integrations/scripts",
        },
        importance: { type: "number" as const, description: "Importance 1-10. Use 8-10 for critical architectural rules or hard-won debugging lessons. Use 5-7 for useful context. Use 1-4 for minor notes." },
        tags: {
          type: "array" as const,
          items: { type: "string" as const },
          description: "Searchable tags, e.g. ['guardian', 'code-change', 'protection']",
        },
      },
      required: ["title", "content", "category", "importance"],
    },
  },
  {
    name: "notify_david",
    description: "Queue a proactive notification for David. Use when you want to flag something for his attention that doesn't need an immediate response — a concern you noticed, a follow-up reminder, something to revisit. The notification will appear as a badge on the Talk to Alden link in the sidebar and surface when he next opens it.",
    input_schema: {
      type: "object" as const,
      properties: {
        message: { type: "string" as const, description: "What you want to tell David. Write it as you'd naturally say it — this will appear as a message from you." },
        severity: {
          type: "string" as const,
          enum: ["info", "warning", "alert"],
          description: "info=general note or follow-up, warning=something that needs attention soon, alert=something urgent",
        },
      },
      required: ["message", "severity"],
    },
  },
  {
    name: "request_continuation",
    description: "Signal that you have completed a phase of work and want to autonomously proceed to the next phase WITHOUT waiting for David to respond. The system will immediately give you a fresh set of tool-use rounds to execute the next phase. Use this when you have a clear multi-phase plan (e.g. Phase 1: Research → Phase 2: Implement → Phase 3: Verify). Call this tool as your LAST tool in a phase, after summarising what you found/did in your text response for that phase.",
    input_schema: {
      type: "object" as const,
      properties: {
        phase_title: {
          type: "string" as const,
          description: "Short label for the phase just completed, e.g. 'Phase 1: Research'",
        },
        phase_summary: {
          type: "string" as const,
          description: "1-3 sentence summary of what was discovered or accomplished in this phase.",
        },
        next_prompt: {
          type: "string" as const,
          description: "Full instruction for the next phase, written as if David sent it. Be specific — include file names, decisions made in this phase, and exactly what to do next.",
        },
      },
      required: ["phase_title", "phase_summary", "next_prompt"],
    },
  },
];

export async function executeAldenTool(
  toolName: string,
  args: Record<string, any>,
  context?: { conversationId?: string }
): Promise<{ data: any; sideEffects?: Record<string, any> }> {
  try {
    switch (toolName) {
      case "get_system_health": {
        const healthStatus = await computeHealthStatus();
        
        const sharedDb = getSharedDb();
        const [activeSessionCount] = await sharedDb.select({
          count: sql<number>`count(*)`,
        }).from(voiceSessions)
          .where(eq(voiceSessions.status, 'active'));

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

        const languageBreakdown = await sharedDb.select({
          language: voiceSessions.language,
          count: sql<number>`count(*)`,
        }).from(voiceSessions)
          .where(gte(voiceSessions.startedAt, since))
          .groupBy(voiceSessions.language)
          .orderBy(desc(sql`count(*)`));

        return {
          data: {
            period: `last ${days} days`,
            totalSessions: Number(totalSessions?.count || 0),
            sessionsToday: Number(todaySessions?.count || 0),
            languageBreakdown: languageBreakdown.map(t => ({
              language: t.language || 'unknown',
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
          userDescription: sofiaIssueReports.userDescription,
          sofiaAnalysis: sofiaIssueReports.sofiaAnalysis,
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
              description: i.userDescription?.substring(0, 200),
              analysis: i.sofiaAnalysis?.substring(0, 200),
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
          userDescription: sofiaIssueReports.userDescription,
          sofiaAnalysis: sofiaIssueReports.sofiaAnalysis,
          status: sofiaIssueReports.status,
          environment: sofiaIssueReports.environment,
          createdAt: sofiaIssueReports.createdAt,
        }).from(sofiaIssueReports)
          .orderBy(desc(sofiaIssueReports.createdAt))
          .limit(limit);

        return {
          data: {
            sofiaDigests: digests.map(d => ({
              type: d.issueType,
              userReport: d.userDescription?.substring(0, 300),
              analysis: d.sofiaAnalysis?.substring(0, 500),
              status: d.status,
              environment: d.environment,
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
          .where(eq(voiceSessions.status, 'active'));

        const elapsed = Date.now() - startTime;

        const allGreen = brainReport.overallStatus === 'green' && contextHealth.status !== 'red';
        const hasWarnings = brainReport.overallStatus === 'yellow' || contextHealth.status === 'yellow';
        const verdict = allGreen ? 'GO' : hasWarnings ? 'CAUTION' : 'NO-GO';

        const dimensionSummaries: string[] = [];
        for (const [key, dim] of Object.entries(brainReport.dimensions || {})) {
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

      case "run_shell": {
        const { command, reason } = args;

        // Strict whitelist — enforced in code, not just the schema enum
        const ALLOWED_COMMANDS: readonly string[] = [
          "npm run db:push --force",
          "npx tsc --noEmit",
          "npm run build",
        ];

        if (!ALLOWED_COMMANDS.includes(command)) {
          return {
            data: {
              success: false,
              error: `Command not in whitelist: "${command}". Allowed: ${ALLOWED_COMMANDS.join(', ')}`,
            },
          };
        }

        console.log(`[Alden Shell] Running: ${command} | Reason: ${reason}`);
        const startMs = Date.now();

        try {
          const output = execSync(command, {
            cwd: WORKSPACE_ROOT,
            timeout: 120_000, // 2 minute max
            encoding: 'utf-8',
            env: { ...process.env },
            stdio: 'pipe',
          });

          const durationMs = Date.now() - startMs;
          console.log(`[Alden Shell] ✓ Complete in ${durationMs}ms: ${command}`);

          return {
            data: {
              success: true,
              command,
              reason,
              output: output.trim().substring(0, 3000),
              durationMs,
            },
          };
        } catch (err: any) {
          const durationMs = Date.now() - startMs;
          const stdout = err.stdout?.toString().trim() || '';
          const stderr = err.stderr?.toString().trim() || '';
          const combined = [stdout, stderr].filter(Boolean).join('\n').substring(0, 3000);

          console.error(`[Alden Shell] ✗ Failed in ${durationMs}ms: ${command}\n${combined}`);

          return {
            data: {
              success: false,
              command,
              reason,
              error: err.message,
              output: combined,
              durationMs,
            },
          };
        }
      }

      case "get_pending_issues": {
        const limit = Math.min(args.limit || 10, 20);
        const sharedDb = getSharedDb();

        const pending = await sharedDb
          .select({
            id: sofiaIssueReports.id,
            issueType: sofiaIssueReports.issueType,
            userDescription: sofiaIssueReports.userDescription,
            sofiaAnalysis: sofiaIssueReports.sofiaAnalysis,
            status: sofiaIssueReports.status,
            environment: sofiaIssueReports.environment,
            createdAt: sofiaIssueReports.createdAt,
          })
          .from(sofiaIssueReports)
          .where(eq(sofiaIssueReports.status, 'open'))
          .orderBy(desc(sofiaIssueReports.createdAt))
          .limit(limit);

        return {
          data: {
            pendingCount: pending.length,
            issues: pending.map(i => ({
              id: i.id,
              type: i.issueType,
              summary: i.userDescription?.substring(0, 200),
              analysis: i.sofiaAnalysis?.substring(0, 300),
              environment: i.environment,
              when: i.createdAt?.toISOString(),
            })),
            message: pending.length === 0
              ? 'No open issues — issues tracker is clear'
              : `${pending.length} open issue(s) awaiting review`,
          },
        };
      }

      case "check_learning_metrics": {
        const sharedDb = getSharedDb();
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [
          activeSessionsResult,
          todaySessionsResult,
          weekSessionsResult,
          recentConvsResult,
          totalUsersResult,
          activeUsersResult,
        ] = await Promise.all([
          sharedDb.select({ count: sql<number>`count(*)` })
            .from(voiceSessions)
            .where(eq(voiceSessions.status, 'active')),
          sharedDb.select({ count: sql<number>`count(*)` })
            .from(voiceSessions)
            .where(gte(voiceSessions.startedAt, today)),
          sharedDb.select({ count: sql<number>`count(*)` })
            .from(voiceSessions)
            .where(gte(voiceSessions.startedAt, weekAgo)),
          sharedDb.select({ count: sql<number>`count(*)` })
            .from(conversations)
            .where(gte(conversations.createdAt, dayAgo)),
          sharedDb.select({ count: sql<number>`count(*)` })
            .from(users),
          // Active users = distinct users with a voice session this week
          sharedDb.select({ count: sql<number>`count(distinct user_id)` })
            .from(voiceSessions)
            .where(gte(voiceSessions.startedAt, weekAgo)),
        ]);

        const activeSessions = Number(activeSessionsResult[0]?.count || 0);
        const todaySessions = Number(todaySessionsResult[0]?.count || 0);
        const weekSessions = Number(weekSessionsResult[0]?.count || 0);
        const recentConversations = Number(recentConvsResult[0]?.count || 0);
        const totalUsers = Number(totalUsersResult[0]?.count || 0);
        const activeUsersThisWeek = Number(activeUsersResult[0]?.count || 0);

        return {
          data: {
            activeSessions,
            todayVoiceSessions: todaySessions,
            weekVoiceSessions: weekSessions,
            newConversationsLast24h: recentConversations,
            totalRegisteredUsers: totalUsers,
            activeUsersThisWeek,
            engagementRate: totalUsers > 0
              ? `${Math.round((activeUsersThisWeek / totalUsers) * 100)}%`
              : '0%',
            summary: `${activeSessions} live sessions now · ${todaySessions} voice sessions today · ${activeUsersThisWeek}/${totalUsers} users active this week`,
          },
        };
      }

      case "read_file": {
        const filePath = safePath(args.path);
        if (!fs.existsSync(filePath)) {
          return { data: { error: `File not found: ${args.path}` } };
        }
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          return { data: { error: `${args.path} is a directory — use list_directory instead` } };
        }
        const allLines = fs.readFileSync(filePath, 'utf-8').split('\n');
        const totalLines = allLines.length;
        const startLine = Math.max(1, args.start_line || 1);
        const endLine = Math.min(totalLines, args.end_line || startLine + 199);
        const clampedEnd = Math.min(endLine, startLine + 199);
        const slice = allLines.slice(startLine - 1, clampedEnd);
        const content = slice.map((line, i) => `${startLine + i}: ${line}`).join('\n');
        return {
          data: {
            path: args.path,
            totalLines,
            showing: `lines ${startLine}–${clampedEnd}`,
            content,
            truncated: clampedEnd < totalLines,
            hint: clampedEnd < totalLines ? `File has ${totalLines} lines — call again with start_line: ${clampedEnd + 1} to continue reading` : undefined,
          },
        };
      }

      case "search_code": {
        const pattern = args.pattern as string;
        const searchDir = args.directory ? safePath(args.directory) : WORKSPACE_ROOT;
        const glob = args.file_glob as string | undefined;
        const caseSensitive = Boolean(args.case_sensitive);
        const contextLines = typeof args.context_lines === 'number' ? Math.min(args.context_lines, 50) : 0;

        const rgParts: string[] = [
          'rg',
          '--line-number',
          '--with-filename',
          '--glob=!node_modules/**',
          '--glob=!dist/**',
          '--glob=!.git/**',
        ];
        if (!caseSensitive) rgParts.push('-i');
        if (glob) rgParts.push(`--glob=${glob}`);

        if (contextLines > 0) {
          // Context mode: return surrounding lines, formatted for readability
          rgParts.push(`-C ${contextLines}`);
          const safePattern = pattern.replace(/'/g, `'\\''`);
          const safeDir = searchDir.replace(/'/g, `'\\''`);
          rgParts.push(`-e '${safePattern}'`);
          rgParts.push(`'${safeDir}'`);

          let output = '';
          try {
            output = execSync(rgParts.join(' '), { cwd: WORKSPACE_ROOT, maxBuffer: 1024 * 1024, timeout: 15000, shell: '/bin/sh' }).toString();
          } catch (e: any) {
            if (e.status === 1) return { data: { pattern, contextLines, results: '', matchCount: 0, note: 'No matches found' } };
            throw e;
          }
          // Truncate if very long
          const truncated = output.length > 40000;
          const trimmed = truncated ? output.slice(0, 40000) + '\n... [truncated — narrow your search]' : output;
          // Count match lines (lines with line numbers, not context separators)
          const matchCount = (output.match(/^[^-][^:]+:\d+:/gm) || []).length;
          return {
            data: {
              pattern,
              contextLines,
              matchCount,
              results: trimmed,
              note: truncated ? 'Output truncated — use directory or file_glob to narrow' : undefined,
            },
          };
        } else {
          // Standard mode: just matching lines
          rgParts.push('--no-heading', '--max-count=3');
          const safePattern = pattern.replace(/'/g, `'\\''`);
          const safeDir = searchDir.replace(/'/g, `'\\''`);
          rgParts.push(`-e '${safePattern}'`);
          rgParts.push(`'${safeDir}'`);

          let output = '';
          try {
            output = execSync(rgParts.join(' '), { cwd: WORKSPACE_ROOT, maxBuffer: 512 * 1024, timeout: 15000, shell: '/bin/sh' }).toString();
          } catch (e: any) {
            if (e.status === 1) return { data: { pattern, matches: [], matchCount: 0, note: 'No matches found' } };
            throw e;
          }

          const lines = output.trim().split('\n').filter(Boolean).slice(0, 40);
          const matches = lines.map(line => {
            const m = line.match(/^(.+?):(\d+):(.*)$/);
            if (!m) return { raw: line };
            return {
              file: m[1].replace(WORKSPACE_ROOT + '/', ''),
              line: parseInt(m[2]),
              content: m[3].trim(),
            };
          });

          return {
            data: {
              pattern,
              matchCount: matches.length,
              matches,
              note: matches.length === 40 ? 'Results capped at 40 — narrow your search or restrict directory/glob' : undefined,
            },
          };
        }
      }

      case "list_directory": {
        const dirPath = safePath(args.path || '.');
        if (!fs.existsSync(dirPath)) {
          return { data: { error: `Directory not found: ${args.path}` } };
        }
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const dirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('.')).map(e => e.name + '/').sort();
        const files = entries.filter(e => e.isFile()).map(e => e.name).sort();
        return {
          data: {
            path: args.path || '.',
            directories: dirs,
            files,
            total: dirs.length + files.length,
          },
        };
      }

      case "apply_code_change": {
        const { file_path, new_content, description } = args;
        const conversationId = context?.conversationId;
        const filePath = safePath(file_path);

        // Backup original content
        let backup: string | null = null;
        if (fs.existsSync(filePath)) {
          backup = fs.readFileSync(filePath, 'utf-8');
        }

        // Write guardian manifest before touching the file
        const GUARDIAN_MANIFEST_PATH = '/tmp/alden-guardian-manifest.json';
        const manifest = {
          mode: 'chat',
          conversationId: conversationId || null,
          featureName: description,
          backups: backup !== null ? { [filePath]: backup } : {},
          port: 5000,
          cwd: process.cwd(),
          timestamp: new Date().toISOString(),
        };
        try {
          fs.writeFileSync(GUARDIAN_MANIFEST_PATH, JSON.stringify(manifest), 'utf-8');
          console.log(`[Alden Tool] Guardian manifest written for chat-mode change: ${description}`);
        } catch (err: any) {
          console.warn(`[Alden Tool] Guardian manifest write failed: ${err.message} — proceeding without protection`);
        }

        // Spawn guardian as detached process
        const guardianPath = path.join(process.cwd(), 'scripts/alden-build-guardian.js');
        try {
          const guardian = spawn(process.execPath, [guardianPath], {
            detached: true,
            stdio: 'ignore',
            env: { ...process.env },
            cwd: process.cwd(),
          });
          guardian.unref();
          console.log(`[Alden Tool] Guardian spawned (PID: ${guardian.pid}) for chat-mode change`);
        } catch (err: any) {
          console.warn(`[Alden Tool] Guardian spawn failed: ${err.message} — proceeding without protection`);
        }

        // Apply the change
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        fs.writeFileSync(filePath, new_content, 'utf-8');
        console.log(`[Alden Tool] Applied change to: ${file_path}`);

        return {
          data: {
            applied: true,
            file: file_path,
            description,
            protected: backup !== null,
            message: `Change applied to ${file_path}. Guardian is watching — if the server crashes it will automatically restore the original and report back. You'll see a follow-up message in about 15 seconds confirming the server came back up cleanly.`,
          },
        };
      }

      case "browser_screenshot": {
        const { page, question = 'Describe what you see on this page. Note any visual issues, layout problems, or anything that looks out of place.' } = args;
        const { browseAndCapture, analyzeScreenshot } = await import('./playwright-browser-service');
        const targetUrl = `http://localhost:5000${page.startsWith('/') ? page : '/' + page}`;

        const browseResult = await browseAndCapture(targetUrl);
        const analysis = await analyzeScreenshot(browseResult.screenshotBase64, question);

        return {
          data: {
            page,
            url: targetUrl,
            analysis,
            loadTimeMs: browseResult.loadTimeMs,
            message: analysis,
          },
        };
      }

      case "write_briefing": {
        const { content } = args;
        const handoffPath = path.join(process.cwd(), 'docs/alden-agent-handoff.md');

        // Read existing file to preserve the Agent's section
        let existing = '';
        try { existing = fs.readFileSync(handoffPath, 'utf-8'); } catch { /* new file */ }

        const timestamp = new Date().toLocaleString('en-US', {
          weekday: 'short', month: 'short', day: 'numeric',
          hour: 'numeric', minute: '2-digit',
        });

        // Update or create the "From Alden" section, preserve "From Agent" section
        const agentSection = (() => {
          const match = existing.match(/## From Agent[\s\S]*$/m);
          return match ? match[0] : '## From Agent — last updated: (none)\n\n*(Nothing yet — the Agent will write here after major build sessions.)*';
        })();

        const newContent = `# Alden ↔ Agent Handoff

## From Alden — last updated: ${timestamp}

${content}

---

${agentSection}`;

        fs.writeFileSync(handoffPath, newContent, 'utf-8');
        console.log('[Alden Tool] Briefing written to docs/alden-agent-handoff.md');

        return {
          data: {
            written: true,
            file: 'docs/alden-agent-handoff.md',
            message: `Briefing written. The Agent will see this at the start of their next session with David.`,
          },
        };
      }

      case "save_to_memory": {
        const { title, content, category, importance, tags = [] } = args;
        const db = getUserDb();
        const [saved] = await db.insert(editorInsights).values({
          title,
          content,
          category,
          importance: Math.max(1, Math.min(10, Math.round(importance))),
          tags,
        }).returning({ id: editorInsights.id, title: editorInsights.title });

        console.log(`[Alden Tool] Saved memory: "${title}" (${category}, importance ${importance})`);
        return {
          data: {
            saved: true,
            id: saved.id,
            title: saved.title,
            message: `Saved to memory as a ${category} insight with importance ${importance}/10. It will be included in my context from the next conversation onward.`,
          },
        };
      }

      case "notify_david": {
        const { message, severity = 'info' } = args;
        const db = getUserDb();
        const [notification] = await db.insert(aldenNotifications).values({
          content: message,
          triggeredBy: 'tool',
          severity,
          read: false,
        }).returning({ id: aldenNotifications.id });

        console.log(`[Alden Tool] Queued notification for David (${severity}): "${message.substring(0, 80)}..."`);
        return {
          data: {
            queued: true,
            id: notification.id,
            severity,
            message: `Notification queued. David will see it the next time he opens this chat — it'll appear as a badge on the sidebar link.`,
          },
        };
      }

      case "request_continuation": {
        const { phase_title, phase_summary, next_prompt } = args;
        console.log(`[Alden Tool] Continuation requested: "${phase_title}" → next: "${next_prompt.substring(0, 80)}..."`);
        return {
          data: { queued: true, message: `Continuation queued. Moving to next phase after this response.` },
          sideEffects: {
            continuation: {
              phaseTitle: phase_title as string,
              phaseSummary: phase_summary as string,
              nextPrompt: next_prompt as string,
            },
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

console.log('[Alden Functions] Loaded — 20 tools ready (monitoring + code + shell + memory + notifications + browser + briefing)');
