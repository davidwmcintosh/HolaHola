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
import * as fs from "fs";
import * as path from "path";
import { execSync, spawn } from "child_process";

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
    description: "Search the codebase for any pattern — function names, variable names, imports, API routes, SQL queries, or any text. Returns matching lines with file paths and line numbers.",
    input_schema: {
      type: "object" as const,
      properties: {
        pattern: { type: "string" as const, description: "Search pattern (regex supported, e.g. 'generateAldenResponse', 'alden.*tool', '/api/voice')" },
        directory: { type: "string" as const, description: "Sub-directory to restrict search to (optional, e.g. 'server/services', 'client/src')" },
        file_glob: { type: "string" as const, description: "File extension filter (optional, e.g. '*.ts', '*.tsx', '*.json')" },
        case_sensitive: { type: "boolean" as const, description: "Case-sensitive search (default false)" },
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

        const rgParts: string[] = [
          'rg',
          '--line-number',
          '--with-filename',
          '--no-heading',
          '--max-count=3',
          '--glob=!node_modules/**',
          '--glob=!dist/**',
          '--glob=!.git/**',
        ];
        if (!caseSensitive) rgParts.push('-i');
        if (glob) rgParts.push(`--glob=${glob}`);
        // Safely quote the pattern and directory using single quotes (escaping any single quotes inside)
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

      default:
        return { data: { error: `Unknown tool: ${toolName}` } };
    }
  } catch (error: any) {
    console.error(`[Alden Tool] ${toolName} failed:`, error.message);
    return { data: { error: error.message } };
  }
}

console.log('[Alden Functions] Loaded — 13 platform management + code tools ready');
