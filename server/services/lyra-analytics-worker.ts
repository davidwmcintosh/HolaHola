import { lyraAnalyticsService, type LyraInsight } from './lyra-analytics-service';
import { founderCollabService } from './founder-collaboration-service';
import { postToActiveTeamRoom } from './team-room-proactive-poster';
import { triggerActflAlignment } from './lyra-content-trigger-service';
import { triggerAldenCheckIn } from './alden-checkin-service';
import { resetCreditStats } from './conversational-credit-service';
import { costTracker } from './cost-tracker';
import { getSharedDb } from '../db';
import { founderSessions, users } from '@shared/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

const AUDIT_INTERVAL_MS = 12 * 60 * 60 * 1000;
const LYRA_SESSION_TITLE = 'Lyra Learning Experience Analyst';
const HISTORY_FILE = path.join(process.cwd(), '.local', 'lyra-history.json');
const MAX_HISTORY_ENTRIES = 10;

interface LyraSnapshot {
  timestamp: string;
  auditNumber: number;
  insightCount: number;
  severityCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  creditMastered: number;
  creditTurns: number;
  costUsd: number;
  topTitles: string[];
}

function loadLyraHistory(): LyraSnapshot[] {
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    return JSON.parse(raw) as LyraSnapshot[];
  } catch {
    return [];
  }
}

function saveLyraSnapshot(snapshot: LyraSnapshot): void {
  try {
    const history = loadLyraHistory();
    history.push(snapshot);
    if (history.length > MAX_HISTORY_ENTRIES) history.splice(0, history.length - MAX_HISTORY_ENTRIES);
    fs.mkdirSync(path.dirname(HISTORY_FILE), { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[Lyra Worker] Could not save history snapshot:', err.message);
  }
}

function buildTrendLine(prev: LyraSnapshot | null, current: { insightCount: number; severityCounts: Record<string, number>; categoryCounts: Record<string, number>; creditMastered: number; costUsd: number }): string {
  if (!prev) return '';

  const parts: string[] = [];
  const insightDelta = current.insightCount - prev.insightCount;
  const insightSign = insightDelta >= 0 ? '+' : '';
  parts.push(`Total insights: ${prev.insightCount} → ${current.insightCount} (${insightSign}${insightDelta})`);

  const criticalDelta = (current.severityCounts.critical || 0) - (prev.severityCounts.critical || 0);
  if (criticalDelta !== 0) {
    const sign = criticalDelta > 0 ? '+' : '';
    parts.push(`critical: ${sign}${criticalDelta}`);
  }
  const highDelta = (current.severityCounts.high || 0) - (prev.severityCounts.high || 0);
  if (highDelta !== 0) {
    const sign = highDelta > 0 ? '+' : '';
    parts.push(`high: ${sign}${highDelta}`);
  }

  const masteredDelta = current.creditMastered - prev.creditMastered;
  if (masteredDelta !== 0 || current.creditMastered > 0) {
    parts.push(`mastery via chat: ${prev.creditMastered} → ${current.creditMastered}`);
  }

  const costDelta = current.costUsd - prev.costUsd;
  if (prev.costUsd > 0) {
    const costSign = costDelta >= 0 ? '+' : '';
    parts.push(`AI cost: $${prev.costUsd.toFixed(4)} → $${current.costUsd.toFixed(4)} (${costSign}$${costDelta.toFixed(4)})`);
  }

  // Category diff — surfaces new problem areas and resolved ones
  if (prev.categoryCounts) {
    const prevCats = Object.keys(prev.categoryCounts).filter(c => (prev.categoryCounts[c] || 0) > 0);
    const currCats = Object.keys(current.categoryCounts).filter(c => (current.categoryCounts[c] || 0) > 0);
    const newCats = currCats.filter(c => !prev.categoryCounts[c]);
    const resolvedCats = prevCats.filter(c => !current.categoryCounts[c]);
    if (newCats.length > 0) parts.push(`new: ${newCats.map(c => c.replace(/_/g, ' ')).join(', ')}`);
    if (resolvedCats.length > 0) parts.push(`cleared: ${resolvedCats.map(c => c.replace(/_/g, ' ')).join(', ')}`);
  }

  const prevAge = prev ? Math.round((Date.now() - new Date(prev.timestamp).getTime()) / (60 * 60 * 1000)) : null;
  const ageNote = prevAge !== null ? ` (prev sweep ~${prevAge}h ago)` : '';

  return `Since last sweep${ageNote}: ${parts.join(' | ')}`;
}

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

function formatCompactReport(
  insights: LyraInsight[],
  severityCounts: Record<string, number>,
  trendLine?: string,
  costReport?: string,
): string {
  if (insights.length === 0) {
    const trend = trendLine ? `\n\n*${trendLine}*` : '';
    const cost = costReport ? `\n\n${costReport}` : '';
    return `**Lyra Learning Experience Sweep — All Clear**\n\nNo issues detected across content quality, student success, onboarding, and class engagement. Everything looks healthy.${trend}${cost}\n\n*Next analysis in ${AUDIT_INTERVAL_MS / (60 * 60 * 1000)}h*`;
  }

  const categoryCounts = buildCategoryCounts(insights);
  const categoryList = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => `  ${cat.replace(/_/g, ' ')}: ${count}`)
    .join('\n');

  const needsReview = insights.filter(i => i.needsReview).length;

  const topInsights = insights
    .filter(i => i.category !== 'conversational_credit')
    .slice(0, 6)
    .map(i => {
      const flag = i.needsReview ? ' [needs review]' : '';
      const conf = `${(i.confidence * 100).toFixed(0)}%`;
      return `- [${i.severity.toUpperCase()}] ${i.title} (${conf} confidence)${flag}`;
    })
    .join('\n');

  const creditInsights = insights.filter(i => i.category === 'conversational_credit');
  const creditParagraph = creditInsights.length > 0 ? formatCreditParagraph(creditInsights) : '';

  const trendSection = trendLine ? `\n*${trendLine}*\n` : '';
  const costSection = costReport ? `\n${costReport}\n` : '';

  return `**Lyra Learning Experience Analysis — ${insights.length} Insight(s)**

Severity: ${severityCounts.critical} critical, ${severityCounts.high} high, ${severityCounts.medium} medium, ${severityCounts.low} low, ${severityCounts.info} info
${needsReview > 0 ? `Flagged for Daniela review: ${needsReview}` : ''}

By category:
${categoryList}
${trendSection}
Top insights:
${topInsights}
${creditParagraph ? `\n${creditParagraph}` : ''}${costSection}
*Full analysis follows. Next sweep in ${AUDIT_INTERVAL_MS / (60 * 60 * 1000)}h.*`;
}

function formatCreditParagraph(creditInsights: LyraInsight[]): string {
  const baseline = creditInsights.find(i => i.data?.turnsProcessed !== undefined);
  if (!baseline) return '';

  const d = baseline.data as Record<string, any>;
  const turns = d.turnsProcessed ?? 0;
  const credited = d.wordsCredited ?? 0;
  const mastered = d.masteredViaChat ?? 0;
  const avg = d.avgCreditsPerTurn ?? 0;
  const skipRate = d.correctionSkipRate ?? 0;
  const highRate = d.highCreditTurnRate ?? 0;

  const flags = creditInsights
    .filter(i => i.needsReview)
    .map(i => i.title)
    .join('; ');

  const velocityInsight = creditInsights.find(i => i.data?.masteryVelocity && Array.isArray(i.data.masteryVelocity) && i.data.masteryVelocity.length > 0);
  const velocityNote = velocityInsight
    ? ` ${velocityInsight.data.masteryVelocity.length} user(s) flagged for unusually fast mastery velocity (10+ items/24h).`
    : '';

  const healthLabel = flags.length === 0 ? 'Healthy' : 'Attention needed';
  const flagNote = flags.length > 0 ? ` Flags: ${flags}.` : '';

  return `**Conversational Credit — ${healthLabel}**
In this window: ${turns} turns processed, ${credited} word credits awarded (avg ${avg}/turn). Daniela's correction markers blocked ${skipRate}% of eligible credits. ${mastered} word(s) reached mastery threshold through conversation alone.${highRate > 20 ? ` ${highRate}% of turns awarded 5+ credits (over-credit risk).` : ''}${velocityNote}${flagNote}`;
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

    // Load previous snapshot for trend comparison
    const history = loadLyraHistory();
    const prevSnapshot = history.length > 0 ? history[history.length - 1] : null;

    const { insights, contentData, studentData, onboardingData, textbookData } = await lyraAnalyticsService.runFullAnalysis();
    const severityCounts = buildSeverityCounts(insights);
    const categoryCounts = buildCategoryCounts(insights);

    stats.totalAudits++;
    stats.lastAuditTime = new Date();
    stats.lastInsightCount = insights.length;
    stats.lastSeverityCounts = severityCounts;

    // Cost summary for this 12h window
    const costSummary = costTracker.getSummary(12);
    const costReport = costTracker.formatForReport(12);

    // Credit mastered count for snapshot
    const creditInsight = insights.find(i => i.category === 'conversational_credit' && i.data?.masteredViaChat !== undefined);
    const creditMastered = creditInsight ? (creditInsight.data.masteredViaChat as number) : 0;
    const creditTurns = creditInsight ? (creditInsight.data.turnsProcessed as number) : 0;

    // Build trend line from previous snapshot
    const trendLine = buildTrendLine(prevSnapshot, {
      insightCount: insights.length,
      severityCounts,
      categoryCounts,
      creditMastered,
      costUsd: costSummary.totalCostUsd,
    });

    if (trendLine) console.log(`[Lyra Worker] Trend: ${trendLine}`);

    let sessionId: string;
    try {
      sessionId = await getOrCreateLyraSession();
    } catch {
      console.error(`[Lyra Worker] Cannot post to Hive — session unavailable`);
      return;
    }

    const compactReport = formatCompactReport(insights, severityCounts, trendLine || undefined, costReport);
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

    const urgentInsights = insights.filter(
      i => i.severity === 'critical' || i.severity === 'high' || i.needsReview
    );
    if (urgentInsights.length > 0) {
      const needsReviewCount = urgentInsights.filter(i => i.needsReview).length;
      const topTitles = urgentInsights.slice(0, 3).map(i => i.title).join(', ');
      const briefSummary = `Learning experience analysis #${stats.totalAudits} complete. Found ${insights.length} total insights — ${urgentInsights.length} need attention${needsReviewCount > 0 ? `, ${needsReviewCount} flagged for Daniela's review` : ''}. Key issues: ${topTitles}.`;
      await postToActiveTeamRoom({
        participant: 'lyra',
        briefSummary,
        source: 'Lyra Analytics Worker',
      });
    }

    if (contentData.missingActflLevels.length > 0) {
      try {
        console.log(`[Lyra Worker] Triggering ACTFL alignment for ${contentData.missingActflLevels.length} lessons...`);
        const triggerResult = await triggerActflAlignment(contentData.missingActflLevels);
        if (triggerResult.actflAssigned > 0 && triggerResult.report) {
          await founderCollabService.addMessage(sessionId, {
            role: 'system',
            content: triggerResult.report,
            metadata: {
              type: 'lyra_content_fix',
              agent: 'lyra',
              actflAssigned: triggerResult.actflAssigned,
              actflFailed: triggerResult.actflFailed,
              auditNumber: stats.totalAudits,
            },
          });
          console.log(`[Lyra Worker] ACTFL trigger complete: ${triggerResult.actflAssigned} assigned`);
        }
      } catch (err: any) {
        console.error(`[Lyra Worker] Content trigger failed:`, err.message);
      }
    }

    // Direct Alden mastery-velocity alert — bypass Gemini check, always fires when users are flagged
    const velocityInsight = insights.find(
      i => i.category === 'conversational_credit' && i.data?.masteryVelocity && (i.data.masteryVelocity as any[]).length > 0
    );
    if (velocityInsight) {
      try {
        const velocity = velocityInsight.data.masteryVelocity as Array<{ userId: string; language: string; masteredLast24h: number }>;
        const userLines = velocity.slice(0, 5).map(v =>
          `  • ${v.userId.slice(0, 12)}... — ${v.masteredLast24h} ${v.language} items in 24h`
        ).join('\n');
        const aldenNote = `**Mastery velocity alert from Lyra (Analysis #${stats.totalAudits})**

${velocity.length} user(s) mastered 10+ items in the last 24 hours via conversation. This may indicate genuine rapid learning or the credit heuristic being too generous. Please spot-check their recent transcripts.

${userLines}

Look for: rich target-language output vs. single-word appearances inside English-dominant messages. The credit marker list and token matching can be tightened if needed.

*— Lyra, ${new Date().toISOString().split('T')[0]}*`;
        await postToActiveTeamRoom({
          participant: 'lyra',
          briefSummary: `Mastery velocity flag: ${velocity.length} user(s) hit 10+ mastered items in 24h. Spot-check requested. Top user: ${velocity[0].userId.slice(0, 12)}... (${velocity[0].masteredLast24h} ${velocity[0].language} items).`,
          source: 'Lyra Credit Monitor',
        });
        await founderCollabService.addMessage(sessionId, {
          role: 'system',
          content: aldenNote,
          metadata: { type: 'lyra_mastery_velocity_alert', agent: 'lyra', velocityCount: velocity.length, auditNumber: stats.totalAudits },
        });
        console.log(`[Lyra Worker] Mastery velocity alert posted for ${velocity.length} user(s)`);
      } catch (err: any) {
        console.error(`[Lyra Worker] Mastery velocity alert error:`, err.message);
      }
    }

    try {
      const significantFindings = insights
        .filter(i => i.severity === 'critical' || i.severity === 'high' || i.needsReview)
        .slice(0, 6)
        .map(i => ({
          title: i.title,
          description: i.description,
          severity: i.severity,
          category: i.category,
          needsReview: i.needsReview,
        }));

      if (significantFindings.length > 0) {
        const checkInResult = await triggerAldenCheckIn(significantFindings, `Lyra Analysis #${stats.totalAudits}`);
        if (checkInResult.triggered) {
          console.log(`[Lyra Worker] Alden check-in triggered (confidence: ${checkInResult.confidence}): "${checkInResult.connection}"`);
        } else {
          console.log(`[Lyra Worker] No Alden check-in warranted (confidence: ${checkInResult.confidence})`);
        }
      }
    } catch (err: any) {
      console.error(`[Lyra Worker] Alden check-in error:`, err.message);
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Lyra Worker] Analysis #${stats.totalAudits} complete: ${insights.length} insights in ${elapsed}ms`);

    // Persist snapshot for next cycle's trend comparison
    saveLyraSnapshot({
      timestamp: new Date().toISOString(),
      auditNumber: stats.totalAudits,
      insightCount: insights.length,
      severityCounts,
      categoryCounts,
      creditMastered,
      creditTurns,
      costUsd: costSummary.totalCostUsd,
      topTitles: insights.slice(0, 3).map(i => i.title),
    });
    console.log(`[Lyra Worker] Snapshot saved (${insights.length} insights, $${costSummary.totalCostUsd.toFixed(4)} cost)`);

    // Reset credit stats for the next 12h window so Lyra sees a clean period each cycle
    resetCreditStats();
    costTracker.resetDevAutoResolvedCount();
    console.log(`[Lyra Worker] Credit stats and cost counters reset for next window`);

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
