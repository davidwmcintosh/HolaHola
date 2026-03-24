/**
 * Alden Watch Worker
 *
 * Runs on a schedule and autonomously checks system health.
 * If Alden's intelligence determines something warrants the founder's attention,
 * it writes a proactive notification that surfaces in Talk to Alden.
 *
 * This is what gives Alden the ability to initiate — to speak up
 * without being asked.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getUserDb } from "../db";
import { aldenNotifications } from "@shared/schema";
import { executeAldenTool } from "./alden-functions";
import { eq, desc } from "drizzle-orm";
import {
  captureSnapshot,
  detectAnomalies,
  analyzePatterns,
  type MetricType,
} from "./monitoring-service";
import { attemptAutoRepair } from "./alden-auto-repair";
import { costTracker } from "./cost-tracker";

const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;
const COOLDOWN_MS = 6 * 60 * 60 * 1000;
const HEALTH_SCORE_LOW_THRESHOLD = 70;
const BUDGET_ALERT_USD = 5;

// Rolling history — last 5 cycles used for trend comparison
interface CycleMetric {
  timestamp: number;
  activeStudents: number;
  voiceSessionsToday: number;
  newConversations24h: number;
  issueCount: number;
  heapUsedMB: number;
  healthScore: number;
}
const MAX_CYCLE_HISTORY = 5;
const cycleHistory: CycleMetric[] = [];

// Health score consecutive drop tracking
let consecutiveLowScoreCycles = 0;

// Budget alert cooldown (fires at most once per 12h)
let lastBudgetAlertTime: number | null = null;

// Auto-repair proposal: rolling buffer of last 3 non-NOTHING alert messages
const MAX_ALERT_HISTORY = 3;
const recentAlertMessages: string[] = [];

function pct(current: number, avg: number): string {
  if (avg === 0) return current > 0 ? '+∞%' : '—';
  const delta = ((current - avg) / avg) * 100;
  return (delta >= 0 ? '+' : '') + delta.toFixed(0) + '%';
}

function buildTrendBlock(current: CycleMetric, history: CycleMetric[]): Record<string, any> {
  if (history.length === 0) return { note: 'First cycle — no baseline yet' };
  const avg = (key: keyof CycleMetric) => {
    const vals = history.map(h => h[key] as number);
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  return {
    cyclesInBaseline: history.length,
    activeStudents:      `${current.activeStudents} (${pct(current.activeStudents, avg('activeStudents'))} vs avg)`,
    voiceSessionsToday:  `${current.voiceSessionsToday} (${pct(current.voiceSessionsToday, avg('voiceSessionsToday'))} vs avg)`,
    newConversations24h: `${current.newConversations24h} (${pct(current.newConversations24h, avg('newConversations24h'))} vs avg)`,
    issueCount:          `${current.issueCount} (${pct(current.issueCount, avg('issueCount'))} vs avg)`,
    heapUsedMB:          `${current.heapUsedMB.toFixed(0)} MB (${pct(current.heapUsedMB, avg('heapUsedMB'))} vs avg)`,
    healthScore:         `${current.healthScore} (${pct(current.healthScore, avg('healthScore'))} vs avg)`,
  };
}

async function getLastNotificationAge(): Promise<number> {
  try {
    const db = getUserDb();
    const [last] = await db
      .select({ createdAt: aldenNotifications.createdAt })
      .from(aldenNotifications)
      .where(eq(aldenNotifications.triggeredBy, 'alden-watch'))
      .orderBy(desc(aldenNotifications.createdAt))
      .limit(1);
    if (!last?.createdAt) return Infinity;
    return Date.now() - new Date(last.createdAt).getTime();
  } catch {
    return Infinity;
  }
}

async function runWatchCycle() {
  try {
    // Respect cooldown — don't spam
    const age = await getLastNotificationAge();
    if (age < COOLDOWN_MS) {
      return;
    }

    // Gather system state using existing tools
    const [health, dbStats, issues, learning] = await Promise.all([
      executeAldenTool('get_system_health', {}),
      executeAldenTool('get_database_stats', {}),
      executeAldenTool('get_pending_issues', {}),
      executeAldenTool('check_learning_metrics', {}),
    ]);

    // Build current cycle metric for trend tracking
    const currentMetric: CycleMetric = {
      timestamp: Date.now(),
      activeStudents:      learning.data?.activeStudents || 0,
      voiceSessionsToday:  learning.data?.voiceSessionsToday || 0,
      newConversations24h: learning.data?.newConversationsLast24h || 0,
      issueCount:          issues.data?.issues?.length || 0,
      heapUsedMB:          health.data?.memory?.heapUsedMB || 0,
      healthScore:         health.data?.voiceHealth?.score || 0,
    };
    const trendBlock = buildTrendBlock(currentMetric, cycleHistory);

    // Capture monitoring snapshots
    await Promise.all([
      captureSnapshot('system_health', {
        status: health.data?.voiceHealth?.status,
        score: health.data?.voiceHealth?.score,
        activeSessions: health.data?.activeSessions,
      }, 'Watch cycle - system health'),
      
      captureSnapshot('user_activity', {
        activeStudents: learning.data?.activeStudents || 0,
        conversationsInProgress: learning.data?.conversationsInProgress || 0,
      }, 'Watch cycle - user activity'),
      
      captureSnapshot('voice_engagement', {
        sessionsToday: learning.data?.voiceSessionsToday || 0,
      }, 'Watch cycle - voice engagement'),
      
      captureSnapshot('error_rate', {
        count: issues.data?.issues?.length || 0,
      }, 'Watch cycle - error rate'),
    ]);

    // Detect anomalies across the last 24 hours
    const anomalies = await detectAnomalies(24);

    // Analyze patterns for each metric type
    const patterns = await Promise.all([
      analyzePatterns('system_health', 7),
      analyzePatterns('user_activity', 7),
      analyzePatterns('voice_engagement', 7),
      analyzePatterns('error_rate', 7),
    ]);

    const systemSnapshot = JSON.stringify({
      health: health.data,
      database: dbStats.data,
      issues: issues.data,
      learning: learning.data,
      trends: trendBlock,
      anomalies: anomalies.map(a => ({
        metric: a.metric,
        severity: a.severity,
        message: a.message,
      })),
      patterns: patterns.map(p => ({
        metric: p.metricType,
        trend: p.trend,
        confidence: p.confidence,
        findings: p.findings,
      })),
    }, null, 2).substring(0, 5500);

    // Ask Alden's intelligence if anything warrants a notification
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `You are Alden, the development steward of HolaHola. You just ran a routine system check with autonomous pattern detection and anomaly analysis. Review this snapshot and decide: is there anything genuinely worth notifying the founder (David) about?

System snapshot:
${systemSnapshot}

Rules:
- Only notify if something is actually wrong, unusual, or worth his attention
- Don't notify for normal healthy states
- Anomalies and pattern changes are provided — use them in your analysis
- If there's nothing worth mentioning, respond with exactly: NOTHING
- If something warrants attention, respond with a brief natural message (1-3 sentences) written as Alden speaking directly to David. Include the severity as the first word: INFO:, WARNING:, or ALERT:

Respond with NOTHING or a message starting with INFO:, WARNING:, or ALERT:`,
      }],
    });

    if (response.usage) {
      costTracker.track('claude-sonnet-4-5', response.usage.input_tokens, response.usage.output_tokens, 'alden-watch');
    }

    // Save this cycle to rolling history (capped at MAX_CYCLE_HISTORY)
    cycleHistory.push(currentMetric);
    if (cycleHistory.length > MAX_CYCLE_HISTORY) cycleHistory.shift();

    // ── Always-on: health score consecutive drop tracking ───────────────────
    if (currentMetric.healthScore < HEALTH_SCORE_LOW_THRESHOLD) {
      consecutiveLowScoreCycles++;
      console.log(`[AldenWatch] Health score ${currentMetric.healthScore} below ${HEALTH_SCORE_LOW_THRESHOLD} — consecutive: ${consecutiveLowScoreCycles}`);
      if (consecutiveLowScoreCycles >= 2) {
        const dbH = getUserDb();
        await dbH.insert(aldenNotifications).values({
          content: `Health score has been below ${HEALTH_SCORE_LOW_THRESHOLD} for ${consecutiveLowScoreCycles} consecutive watch cycles (current: ${currentMetric.healthScore}). This persistent degradation warrants investigation.`,
          triggeredBy: 'alden-watch',
          severity: 'alert',
          read: false,
        });
        console.log(`[AldenWatch] Consecutive low-health alert fired (${consecutiveLowScoreCycles} cycles)`);
      }
    } else {
      if (consecutiveLowScoreCycles > 0) console.log(`[AldenWatch] Health score recovered (${currentMetric.healthScore})`);
      consecutiveLowScoreCycles = 0;
    }

    // ── Always-on: cost budget alert (24h window, 12h cooldown) ─────────────
    const budget = costTracker.checkBudgetThreshold(BUDGET_ALERT_USD, 24);
    if (budget.exceeded) {
      const sinceLastBudgetAlert = lastBudgetAlertTime ? Date.now() - lastBudgetAlertTime : Infinity;
      if (sinceLastBudgetAlert > 12 * 60 * 60 * 1000) {
        console.log(`[AldenWatch] Budget exceeded: $${budget.totalCostUsd.toFixed(4)} in 24h`);
        const dbB = getUserDb();
        await dbB.insert(aldenNotifications).values({
          content: `AI spend in the last 24h has reached $${budget.totalCostUsd.toFixed(4)}, crossing the $${budget.thresholdUsd} threshold. Review the cost breakdown in Lyra's next report.`,
          triggeredBy: 'alden-watch',
          severity: 'warning',
          read: false,
        });
        lastBudgetAlertTime = Date.now();
        console.log('[AldenWatch] Budget alert queued');
      }
    }

    // ── Claude intelligence: conditional on having a real finding ────────────
    const text = (response.content[0] as any)?.text?.trim() || 'NOTHING';
    if (text === 'NOTHING' || text.startsWith('NOTHING')) {
      console.log('[AldenWatch] Check complete — no notification needed');
      return;
    }

    // Parse severity and message
    let severity: 'info' | 'warning' | 'alert' = 'info';
    let message = text;
    if (text.startsWith('WARNING:')) {
      severity = 'warning';
      message = text.replace(/^WARNING:\s*/, '');
    } else if (text.startsWith('ALERT:')) {
      severity = 'alert';
      message = text.replace(/^ALERT:\s*/, '');
    } else if (text.startsWith('INFO:')) {
      severity = 'info';
      message = text.replace(/^INFO:\s*/, '');
    }

    // Write notification
    const db = getUserDb();
    await db.insert(aldenNotifications).values({
      content: message,
      triggeredBy: 'alden-watch',
      severity,
      read: false,
    });

    console.log(`[AldenWatch] Queued ${severity} notification: "${message.substring(0, 80)}..."`);

    // Track alert messages for recurring-pattern detection
    recentAlertMessages.push(message);
    if (recentAlertMessages.length > MAX_ALERT_HISTORY) recentAlertMessages.shift();

    // Auto-repair proposal: if the same class of issue has fired 3 cycles in a row,
    // ask Claude to synthesise a fix proposal and post it to the Hive for Wren.
    if (recentAlertMessages.length === MAX_ALERT_HISTORY) {
      checkAndPostRepairProposal(client, recentAlertMessages).catch(err =>
        console.warn('[AldenWatch] Repair proposal check failed:', err.message)
      );
    }

    // For WARNING or ALERT severity, attempt autonomous repair immediately.
    // Auto-repair runs its own eligibility + confidence gates — if the issue
    // isn't safely fixable it bails without touching anything.
    if (severity === 'warning' || severity === 'alert') {
      const errorContext = JSON.stringify({
        anomalies: systemSnapshot.substring(0, 600),
      });
      attemptAutoRepair(message, errorContext).then(attempted => {
        if (attempted) {
          console.log('[AldenWatch] Auto-repair initiated — guardian is monitoring');
        } else {
          console.log('[AldenWatch] Auto-repair ineligible — notification only');
        }
      }).catch(err => {
        console.warn('[AldenWatch] Auto-repair attempt threw:', err.message);
      });
    }

  } catch (err: any) {
    console.warn('[AldenWatch] Watch cycle failed:', err.message);
  }
}

/**
 * If the last MAX_ALERT_HISTORY watch-cycle alerts share a common pattern,
 * Claude drafts a fix proposal and posts it to the Hive for Wren to action.
 * Only fires once per pattern; clears after posting.
 */
async function checkAndPostRepairProposal(client: Anthropic, messages: string[]): Promise<void> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `These are the last ${messages.length} watch-cycle alerts from the HoloHola system monitor:\n\n${messages.map((m, i) => `Alert ${i + 1}: ${m}`).join('\n\n')}\n\nDo these alerts share a recurring root cause? If yes, write a concise fix proposal (2-4 sentences) addressed to Wren that identifies the pattern and suggests a concrete action. If they are unrelated one-off events, respond with exactly: UNRELATED`,
    }],
  });

  if (response.usage) {
    costTracker.track('claude-sonnet-4-5', response.usage.input_tokens, response.usage.output_tokens, 'alden-repair-proposal');
  }

  const proposal = (response.content[0] as any)?.text?.trim() || 'UNRELATED';
  if (proposal === 'UNRELATED' || proposal.startsWith('UNRELATED')) {
    console.log('[AldenWatch] Repair proposal check: alerts are unrelated — no proposal needed');
    return;
  }

  console.log('[AldenWatch] Recurring pattern detected — queuing repair proposal');
  try {
    const dbR = getUserDb();
    await dbR.insert(aldenNotifications).values({
      content: `[Recurring Pattern → Wren] The last ${messages.length} watch cycles flagged a common issue. Proposed fix: ${proposal}`,
      triggeredBy: 'alden-watch',
      severity: 'warning',
      read: false,
    });
    // Clear the buffer so we don't fire the same proposal repeatedly
    recentAlertMessages.length = 0;
    console.log('[AldenWatch] Repair proposal queued and buffer cleared');
  } catch (e: any) {
    console.warn('[AldenWatch] Could not queue repair proposal:', e.message);
  }
}

export function startAldenWatchWorker() {
  console.log('[AldenWatch] Starting (interval: 2h, cooldown: 6h)');
  // Initial check after 5 minutes (let the server settle)
  setTimeout(() => {
    runWatchCycle();
    setInterval(runWatchCycle, CHECK_INTERVAL_MS);
  }, 5 * 60 * 1000);
}
