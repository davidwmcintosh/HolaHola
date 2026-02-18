import { lyraAnalyticsService, type LyraInsight } from './lyra-analytics-service';
import { founderCollabService } from './founder-collaboration-service';
import { getSharedDb } from '../db';
import { founderSessions, users } from '@shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';

const AUDIT_INTERVAL_MS = 12 * 60 * 60 * 1000;
const LYRA_SESSION_TITLE = 'Lyra Learning Experience Analyst';

let auditInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

interface LyraStats {
  totalAudits: number;
  lastAuditTime: Date | null;
  lastInsightCount: number;
  lastSeverityCounts: Record<string, number>;
}

const stats: LyraStats = {
  totalAudits: 0,
  lastAuditTime: null,
  lastInsightCount: 0,
  lastSeverityCounts: {},
};

async function resolveFounderId(): Promise<string> {
  const [fromSession] = await getSharedDb()
    .select({ founderId: founderSessions.founderId })
    .from(founderSessions)
    .orderBy(desc(founderSessions.createdAt))
    .limit(1);
  if (fromSession?.founderId) return fromSession.founderId;

  const [adminUser] = await getSharedDb()
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.role, ['admin', 'developer']))
    .limit(1);
  if (adminUser?.id) return adminUser.id;

  throw new Error('No founder/admin user found — cannot create Lyra session');
}

async function getOrCreateLyraSession(): Promise<string> {
  try {
    const [existing] = await getSharedDb().select()
      .from(founderSessions)
      .where(and(
        eq(founderSessions.title, LYRA_SESSION_TITLE),
        eq(founderSessions.status, 'active')
      ))
      .orderBy(desc(founderSessions.createdAt))
      .limit(1);

    if (existing) return existing.id;

    const founderId = await resolveFounderId();
    const session = await founderCollabService.createSession(founderId, LYRA_SESSION_TITLE);
    console.log(`[Lyra Worker] Created Hive session: ${session.id} (founder: ${founderId})`);
    return session.id;
  } catch (err: any) {
    console.error(`[Lyra Worker] Failed to get/create session:`, err.message);
    throw err;
  }
}

function buildSeverityCounts(insights: LyraInsight[]): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const i of insights) {
    counts[i.severity] = (counts[i.severity] || 0) + 1;
  }
  return counts;
}

function buildCategoryCounts(insights: LyraInsight[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const i of insights) {
    counts[i.category] = (counts[i.category] || 0) + 1;
  }
  return counts;
}

function formatCompactReport(insights: LyraInsight[], severityCounts: Record<string, number>): string {
  if (insights.length === 0) {
    return `**Lyra Learning Experience Sweep — All Clear**\n\nNo issues detected across content quality, student success, and onboarding metrics. Everything looks healthy.\n\n*Next analysis in ${AUDIT_INTERVAL_MS / (60 * 60 * 1000)}h*`;
  }

  const categoryCounts = buildCategoryCounts(insights);
  const categoryList = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `  ${cat.replace(/_/g, ' ')}: ${count}`)
    .join('\n');

  const needsReview = insights.filter(i => i.needsReview).length;

  const topInsights = insights
    .slice(0, 6)
    .map(i => {
      const flag = i.needsReview ? ' [needs review]' : '';
      const conf = `${(i.confidence * 100).toFixed(0)}%`;
      return `- [${i.severity.toUpperCase()}] ${i.title} (${conf} confidence)${flag}`;
    })
    .join('\n');

  return `**Lyra Learning Experience Analysis — ${insights.length} Insight(s)**

Severity: ${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low, ${severityCounts.info} info
${needsReview > 0 ? `Flagged for Daniela review: ${needsReview}` : ''}

By category:
${categoryList}

Top insights:
${topInsights}

*Full analysis follows. Next sweep in ${AUDIT_INTERVAL_MS / (60 * 60 * 1000)}h.*`;
}

async function runAnalysis(): Promise<void> {
  if (isRunning) {
    console.log(`[Lyra Worker] Analysis already in progress, skipping`);
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  try {
    console.log(`[Lyra Worker] Starting learning experience analysis #${stats.totalAudits + 1}...`);

    const { insights, contentData, studentData, onboardingData, textbookData } = await lyraAnalyticsService.runFullAnalysis();
    const severityCounts = buildSeverityCounts(insights);

    stats.totalAudits++;
    stats.lastAuditTime = new Date();
    stats.lastInsightCount = insights.length;
    stats.lastSeverityCounts = severityCounts;

    let sessionId: string;
    try {
      sessionId = await getOrCreateLyraSession();
    } catch {
      console.error(`[Lyra Worker] Cannot post to Hive — session unavailable`);
      return;
    }

    const compactReport = formatCompactReport(insights, severityCounts);
    await founderCollabService.addMessage(sessionId, {
      role: 'system',
      content: compactReport,
      metadata: {
        type: 'lyra_analysis',
        agent: 'lyra',
        insightCount: insights.length,
        severityCounts,
        auditNumber: stats.totalAudits,
      },
    });

    if (insights.length > 0) {
      try {
        const geminiContentReport = await lyraAnalyticsService.enrichContentWithGemini(contentData, textbookData);
        if (geminiContentReport) {
          await founderCollabService.addMessage(sessionId, {
            role: 'system',
            content: geminiContentReport,
            metadata: { type: 'lyra_content_audit', agent: 'lyra', auditNumber: stats.totalAudits },
          });
        }
      } catch (err: any) {
        console.error('[Lyra Worker] Gemini content enrichment failed:', err.message);
      }

      try {
        const claudeReport = await lyraAnalyticsService.enrichWithClaude(insights, contentData, studentData, onboardingData, textbookData);
        await founderCollabService.addMessage(sessionId, {
          role: 'system',
          content: claudeReport,
          metadata: { type: 'lyra_full_analysis', agent: 'lyra', auditNumber: stats.totalAudits },
        });
      } catch (err: any) {
        console.error('[Lyra Worker] Claude analysis failed:', err.message);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Lyra Worker] Analysis #${stats.totalAudits} complete: ${insights.length} insights in ${elapsed}ms`);

  } catch (err: any) {
    console.error(`[Lyra Worker] Analysis failed:`, err.message);
  } finally {
    isRunning = false;
  }
}

export function startLyraAnalyticsWorker(intervalMs?: number): void {
  const interval = intervalMs || AUDIT_INTERVAL_MS;
  console.log(`[Lyra Worker] Starting (interval: ${interval / (60 * 60 * 1000)}h)`);

  setTimeout(() => {
    runAnalysis().catch(err => {
      console.error(`[Lyra Worker] Initial analysis error:`, err.message);
    });
  }, 45_000);

  auditInterval = setInterval(() => {
    runAnalysis().catch(err => {
      console.error(`[Lyra Worker] Periodic analysis error:`, err.message);
    });
  }, interval);
}

export function stopLyraAnalyticsWorker(): void {
  if (auditInterval) {
    clearInterval(auditInterval);
    auditInterval = null;
    console.log(`[Lyra Worker] Stopped`);
  }
}

export function getLyraAnalyticsStats(): LyraStats {
  return { ...stats };
}

export async function triggerLyraAnalysis(): Promise<void> {
  return runAnalysis();
}
