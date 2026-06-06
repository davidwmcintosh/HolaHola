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
import { executeAldenTool, ALDEN_TOOLS } from "./alden-functions";
import { eq, desc, and } from "drizzle-orm";
import {
  captureSnapshot,
  detectAnomalies,
  analyzePatterns,
  type MetricType,
} from "./monitoring-service";
import { attemptAutoRepair } from "./alden-auto-repair";
import { costTracker } from "./cost-tracker";
import { writeEscalation } from "./alden-escalation-log";
import { founderCollabService } from "./founder-collaboration-service";

const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000;
const HEALTH_SCORE_LOW_THRESHOLD = 70;

// Cost tier thresholds (24h window)
const BUDGET_WARN_USD       = 3;   // Tier 1 — notification only (existing behaviour)
const BUDGET_ALERT_USD      = 5;   // Tier 2 — notification + Hive post
const BUDGET_HARD_PAUSE_USD = 10;  // Tier 3 — Hive post + skip cycle entirely

// Tool-use loop safety cap
const MAX_TOOL_ITERATIONS = 8;

// Founder ID used across Hive/Express-Lane posts
const FOUNDER_ID = '49847136';

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

// Budget alert cooldown (fires at most once per 12h per tier)
let lastBudgetAlertTime: number | null = null;

// Hard-pause state: set when 24h spend crosses $10; cleared when spend drops below
let hardPauseActive = false;

// Last watch cycle timestamp — exposed via /api/admin/alden-status
let lastWatchCycleTime: number | null = null;

// Rolling buffer of last 5 notification fingerprints for status endpoint
const MAX_FP_HISTORY = 5;
const lastNotificationFingerprints: Array<{ fp: string; ts: number }> = [];

// Note: global cooldown removed. Each issue type is deduplicated by fingerprint
// (hasDuplicateActiveIssue). New issue types fire immediately; repeat issues are
// suppressed until the founder marks the prior notification as read.

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

/**
 * Returns true if an unread notification with this fingerprint already exists.
 * This prevents the same issue from being reported repeatedly until the user
 * marks it as read, at which point it can re-fire if the issue recurs.
 */
async function hasDuplicateActiveIssue(fingerprint: string): Promise<boolean> {
  try {
    const db = getUserDb();
    const existing = await db
      .select({ id: aldenNotifications.id })
      .from(aldenNotifications)
      .where(and(
        eq(aldenNotifications.fingerprint, fingerprint),
        eq(aldenNotifications.read, false),
      ))
      .limit(1);
    return existing.length > 0;
  } catch {
    return false;
  }
}

/**
 * Post a message to the Express Lane / Hive as Alden.
 * Fire-and-forget safe — errors are logged but never throw.
 */
async function postHiveMessage(content: string, metadata?: Record<string, any>): Promise<void> {
  try {
    const session = await founderCollabService.getOrCreateActiveSession(FOUNDER_ID);
    await founderCollabService.addMessage(session.id, {
      role: 'editor',
      content: `[Alden Watch] ${content}`,
      metadata: { source: 'alden-watch', ...metadata },
    });
  } catch (err: any) {
    console.warn('[AldenWatch] Hive post failed:', err.message);
  }
}

async function runWatchCycle() {
  try {
    // ── Pre-flight: hard-pause check (Tier 3 — $10 threshold) ───────────────
    const hardBudget = costTracker.checkBudgetThreshold(BUDGET_HARD_PAUSE_USD, 24);
    if (hardBudget.exceeded) {
      if (!hardPauseActive) {
        hardPauseActive = true;
        const msg = `HARD PAUSE: 24h AI spend has reached $${hardBudget.totalCostUsd.toFixed(2)}, crossing the $${BUDGET_HARD_PAUSE_USD} hard limit. Watch cycles are suspended until spend drops below this threshold. No further autonomous AI calls will be made this window.`;
        console.warn('[AldenWatch]', msg);
        await postHiveMessage(msg, { tier: 'hard_pause', spendUsd: hardBudget.totalCostUsd });
        const fp = 'budget_hard_pause';
        const isDup = await hasDuplicateActiveIssue(fp);
        if (!isDup) {
          const dbHard = getUserDb();
          await dbHard.insert(aldenNotifications).values({
            content: msg,
            triggeredBy: 'alden-watch',
            severity: 'alert',
            read: false,
            fingerprint: fp,
          });
        }
      } else {
        console.log('[AldenWatch] Hard pause active — skipping cycle');
      }
      return;
    } else {
      // Spend dropped back below $10 — lift the pause
      if (hardPauseActive) {
        hardPauseActive = false;
        console.log('[AldenWatch] Spend recovered below hard limit — resuming watch cycles');
      }
    }

    // Gather system state using existing tools — each is isolated so one failure
    // doesn't poison the whole snapshot with a WebSocket/DB error narrative.
    const safeCall = async (toolName: string, args: Record<string, any>) => {
      try {
        return await executeAldenTool(toolName, args);
      } catch (e: any) {
        console.warn(`[AldenWatch] Tool ${toolName} failed: ${e.message}`);
        return { data: { error: `${toolName} unavailable: ${e.message}` } };
      }
    };
    const [health, dbStats, issues, learning] = await Promise.all([
      safeCall('get_system_health', {}),
      safeCall('get_database_stats', {}),
      safeCall('get_pending_issues', {}),
      safeCall('check_learning_metrics', {}),
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

    // Summarise issues — send counts and top 3 by severity, not the full list.
    // This prevents 165-item pending queues from dominating the 5500-char cap.
    const issuesList: any[] = issues.data?.issues || [];
    const issuesSummary = {
      total: issuesList.length,
      bySeverity: issuesList.reduce((acc: Record<string, number>, i: any) => {
        const sev = i.severity || 'unknown';
        acc[sev] = (acc[sev] || 0) + 1;
        return acc;
      }, {}),
      top3: issuesList
        .sort((a: any, b: any) => {
          const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          return (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
        })
        .slice(0, 3)
        .map((i: any) => ({ type: i.type, severity: i.severity, message: (i.message || '').substring(0, 120) })),
    };

    const systemSnapshot = JSON.stringify({
      health: health.data,
      database: dbStats.data,
      issues: issuesSummary,
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

    // ── Agentic tool-use loop ────────────────────────────────────────────────
    // Alden can call tools autonomously (up to MAX_TOOL_ITERATIONS turns) to
    // investigate before settling on a verdict. The loop terminates when:
    //   • stop_reason === 'end_turn'   — Alden is done thinking
    //   • stop_reason !== 'tool_use'   — unexpected stop, treat as done
    //   • iteration cap reached        — safety valve
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const loopMessages: Anthropic.MessageParam[] = [{
      role: 'user',
      content: `You are Alden, the development steward of HolaHola. You just ran a routine system check with autonomous pattern detection and anomaly analysis. Review this snapshot and decide: is there anything genuinely worth notifying the founder (David) about?

You have access to tools — use them to investigate anything that looks suspicious before reaching a verdict. Only call tools when you genuinely need more information to make a decision.

System snapshot:
${systemSnapshot}

Rules:
- Only notify if something is actually wrong, unusual, or worth his attention
- Don't notify for normal healthy states
- Anomalies and pattern changes are provided — use them in your analysis
- When you are done investigating, respond with exactly: NOTHING
  OR in this exact format on ONE line:
  SEVERITY:FINGERPRINT:Message written as Alden speaking directly to David (1-3 sentences)
  Where SEVERITY is INFO, WARNING, or ALERT
  Where FINGERPRINT is a short snake_case key identifying this issue type (e.g. db_connection_failure, low_engagement, high_latency, health_score_low, budget_exceeded, voice_pipeline_error)

Example: WARNING:db_connection_failure:The database monitoring tools are failing to connect, which is preventing me from gathering accurate system metrics. This needs investigation.

Respond with NOTHING or a single line in SEVERITY:FINGERPRINT:Message format:`,
    }];

    let finalText = 'NOTHING';
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 600,
        tools: ALDEN_TOOLS,
        messages: loopMessages,
      });

      if (response.usage) {
        totalInputTokens  += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;
      }

      // Append assistant's response to conversation
      loopMessages.push({ role: 'assistant', content: response.content });

      if (response.stop_reason === 'end_turn') {
        // Extract the text verdict from the final response
        const textBlock = response.content.find(b => b.type === 'text');
        finalText = (textBlock as any)?.text?.trim() || 'NOTHING';
        console.log(`[AldenWatch] Tool loop ended at iteration ${iteration + 1}`);
        break;
      }

      if (response.stop_reason !== 'tool_use') {
        // Unexpected stop reason — extract text if present and break
        const textBlock = response.content.find(b => b.type === 'text');
        finalText = (textBlock as any)?.text?.trim() || 'NOTHING';
        console.log(`[AldenWatch] Unexpected stop_reason "${response.stop_reason}" at iteration ${iteration + 1}`);
        break;
      }

      // Execute each tool call and gather results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;
        console.log(`[AldenWatch] Tool call: ${block.name} (iteration ${iteration + 1})`);
        let toolOutput: any;
        try {
          toolOutput = await executeAldenTool(block.name, block.input as Record<string, any>);
        } catch (e: any) {
          toolOutput = { error: `Tool "${block.name}" failed: ${e.message}` };
        }
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(toolOutput).substring(0, 3000),
        });
      }

      // Append tool results as user turn
      loopMessages.push({ role: 'user', content: toolResults });

      // If we hit the cap on the last iteration, extract whatever text is available
      if (iteration === MAX_TOOL_ITERATIONS - 1) {
        console.warn(`[AldenWatch] Tool loop hit iteration cap (${MAX_TOOL_ITERATIONS}) — treating as NOTHING`);
        finalText = 'NOTHING';
      }
    }

    // Track combined token cost for the entire loop
    costTracker.track('claude-sonnet-4-5', totalInputTokens, totalOutputTokens, 'alden-watch');

    // Save this cycle to rolling history (capped at MAX_CYCLE_HISTORY)
    cycleHistory.push(currentMetric);
    if (cycleHistory.length > MAX_CYCLE_HISTORY) cycleHistory.shift();

    // Record cycle time
    lastWatchCycleTime = Date.now();

    // ── Always-on: health score consecutive drop tracking ───────────────────
    if (currentMetric.healthScore < HEALTH_SCORE_LOW_THRESHOLD) {
      consecutiveLowScoreCycles++;
      console.log(`[AldenWatch] Health score ${currentMetric.healthScore} below ${HEALTH_SCORE_LOW_THRESHOLD} — consecutive: ${consecutiveLowScoreCycles}`);
      if (consecutiveLowScoreCycles >= 2) {
        const fp = 'health_score_persistent_low';
        const isDup = await hasDuplicateActiveIssue(fp);
        if (!isDup) {
          const dbH = getUserDb();
          await dbH.insert(aldenNotifications).values({
            content: `Health score has been below ${HEALTH_SCORE_LOW_THRESHOLD} for ${consecutiveLowScoreCycles} consecutive watch cycles (current: ${currentMetric.healthScore}). This persistent degradation warrants investigation.`,
            triggeredBy: 'alden-watch',
            severity: 'alert',
            read: false,
            fingerprint: fp,
          });
          console.log(`[AldenWatch] Consecutive low-health alert fired (${consecutiveLowScoreCycles} cycles)`);
        } else {
          console.log(`[AldenWatch] Low-health alert suppressed — already reported and unread`);
        }
      }
    } else {
      if (consecutiveLowScoreCycles > 0) console.log(`[AldenWatch] Health score recovered (${currentMetric.healthScore})`);
      consecutiveLowScoreCycles = 0;
    }

    // ── Always-on: tiered cost budget controls (24h window) ─────────────────
    const budget24h = costTracker.getSummary(24);
    const spend = budget24h.totalCostUsd;
    const sinceLastBudgetAlert = lastBudgetAlertTime ? Date.now() - lastBudgetAlertTime : Infinity;

    if (spend >= BUDGET_ALERT_USD) {
      // Tier 2 — $5: notification + Hive post
      if (sinceLastBudgetAlert > 12 * 60 * 60 * 1000) {
        console.log(`[AldenWatch] Tier-2 budget: $${spend.toFixed(4)} in 24h (threshold: $${BUDGET_ALERT_USD})`);
        const fp = 'budget_exceeded';
        const isDupAlert = await hasDuplicateActiveIssue(fp);
        if (!isDupAlert) {
          const dbB = getUserDb();
          await dbB.insert(aldenNotifications).values({
            content: `AI spend in the last 24h has reached $${spend.toFixed(4)}, crossing the $${BUDGET_ALERT_USD} alert threshold. Review the cost breakdown in Lyra's next report.`,
            triggeredBy: 'alden-watch',
            severity: 'warning',
            read: false,
            fingerprint: fp,
          });
          await postHiveMessage(
            `Budget alert (Tier 2): 24h AI spend is $${spend.toFixed(4)}, over the $${BUDGET_ALERT_USD} threshold. Monitoring closely.`,
            { tier: 'alert', spendUsd: spend },
          );
          lastBudgetAlertTime = Date.now();
          console.log('[AldenWatch] Tier-2 budget alert queued + Hive post sent');
        } else {
          console.log('[AldenWatch] Budget alert suppressed — already reported and unread');
        }
      }
    } else if (spend >= BUDGET_WARN_USD) {
      // Tier 1 — $3: notification only (no Hive post)
      if (sinceLastBudgetAlert > 12 * 60 * 60 * 1000) {
        console.log(`[AldenWatch] Tier-1 budget warn: $${spend.toFixed(4)} in 24h (threshold: $${BUDGET_WARN_USD})`);
        const fp = 'budget_warn';
        const isDupWarn = await hasDuplicateActiveIssue(fp);
        if (!isDupWarn) {
          const dbW = getUserDb();
          await dbW.insert(aldenNotifications).values({
            content: `AI spend in the last 24h has reached $${spend.toFixed(4)}, crossing the $${BUDGET_WARN_USD} early-warning threshold. No action required yet.`,
            triggeredBy: 'alden-watch',
            severity: 'info',
            read: false,
            fingerprint: fp,
          });
          lastBudgetAlertTime = Date.now();
          console.log('[AldenWatch] Tier-1 budget warning queued');
        }
      }
    }

    // ── Claude intelligence: conditional on having a real finding ────────────
    if (finalText === 'NOTHING' || finalText.startsWith('NOTHING')) {
      console.log('[AldenWatch] Check complete — no notification needed');
      return;
    }

    // Parse SEVERITY:FINGERPRINT:Message format
    let severity: 'info' | 'warning' | 'alert' = 'info';
    let fingerprint: string | undefined;
    let message = finalText;

    const parts = finalText.match(/^(INFO|WARNING|ALERT):([a-z0-9_]+):(.+)$/);
    if (parts) {
      const sev = parts[1].toLowerCase();
      severity = sev === 'warning' ? 'warning' : sev === 'alert' ? 'alert' : 'info';
      fingerprint = parts[2];
      message = parts[3].trim();
    } else {
      // Fallback: old-style parsing without fingerprint
      if (finalText.startsWith('WARNING:')) { severity = 'warning'; message = finalText.replace(/^WARNING:\s*/, ''); }
      else if (finalText.startsWith('ALERT:')) { severity = 'alert'; message = finalText.replace(/^ALERT:\s*/, ''); }
      else if (finalText.startsWith('INFO:')) { message = finalText.replace(/^INFO:\s*/, ''); }
    }

    // Dedup: if an unread notification with the same fingerprint exists, skip
    if (fingerprint) {
      const isDup = await hasDuplicateActiveIssue(fingerprint);
      if (isDup) {
        console.log(`[AldenWatch] Suppressed duplicate (fingerprint: ${fingerprint}) — already unread`);
        return;
      }
    }

    // Write notification
    const db = getUserDb();
    await db.insert(aldenNotifications).values({
      content: message,
      triggeredBy: 'alden-watch',
      severity,
      read: false,
      fingerprint,
    });

    console.log(`[AldenWatch] Queued ${severity} notification [${fingerprint ?? 'no-fingerprint'}]: "${message.substring(0, 80)}..."`);

    // Track recent fingerprints for status endpoint
    if (fingerprint) {
      lastNotificationFingerprints.push({ fp: fingerprint, ts: Date.now() });
      if (lastNotificationFingerprints.length > MAX_FP_HISTORY) lastNotificationFingerprints.shift();
    }

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
          // ALERT severity that auto-repair can't touch → escalate immediately to Agent
          if (severity === 'alert') {
            writeEscalation(
              message,
              'Auto-repair declined this issue as ineligible (likely infrastructure or architectural). Immediate Agent review recommended.',
              'alert_ineligible',
            ).catch(e => console.warn('[AldenWatch] Escalation write failed:', e.message));
          }
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
 * Claude drafts a fix proposal and escalates it to the Replit Agent via
 * .local/alden-escalations.md. Also surfaces a DB notification so David
 * can see the issue was routed correctly.
 * Only fires once per pattern; clears after posting.
 */
async function checkAndPostRepairProposal(client: Anthropic, messages: string[]): Promise<void> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `These are the last ${messages.length} watch-cycle alerts from the HoloHola system monitor:\n\n${messages.map((m, i) => `Alert ${i + 1}: ${m}`).join('\n\n')}\n\nDo these alerts share a recurring root cause? If yes, write a concise diagnosis (2-4 sentences) for the Replit Agent that:\n1. Identifies the root cause pattern\n2. Explains why it cannot be auto-repaired\n3. Recommends a concrete action the Agent should take\nDo NOT address it to Wren. Write it as a clear briefing the Agent will read at session start.\nIf they are unrelated one-off events, respond with exactly: UNRELATED`,
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

  console.log('[AldenWatch] Recurring pattern detected — escalating to Replit Agent');

  // Write to the escalation log so the Agent sees it at session start
  const issueSummary = messages[messages.length - 1] ?? messages[0];
  await writeEscalation(issueSummary, proposal, 'recurring_pattern');

  try {
    const dbR = getUserDb();
    await dbR.insert(aldenNotifications).values({
      content: `[Escalated → Replit Agent] The last ${messages.length} watch cycles flagged the same issue. Auto-repair could not fix it. The Replit Agent has been notified via .local/alden-escalations.md and will address it at next session.\n\nSummary: ${proposal}`,
      triggeredBy: 'alden-watch',
      severity: 'alert',
      read: false,
    });
    // Clear the buffer so we don't fire the same proposal repeatedly
    recentAlertMessages.length = 0;
    console.log('[AldenWatch] Escalation written and buffer cleared');
  } catch (e: any) {
    console.warn('[AldenWatch] Could not queue escalation notification:', e.message);
  }
}

export function startAldenWatchWorker() {
  console.log('[AldenWatch] Starting (interval: 2h, per-issue-type dedup via fingerprint)');
  // Initial check after 5 minutes (let the server settle)
  setTimeout(() => {
    runWatchCycle();
    setInterval(runWatchCycle, CHECK_INTERVAL_MS);
  }, 5 * 60 * 1000);
}

/**
 * Returns live status data for the /api/admin/alden-status endpoint.
 */
export function getAldenStatus() {
  const summary24h = costTracker.getSummary(24);
  const spend = summary24h.totalCostUsd;

  let activeTier: 'nominal' | 'warn' | 'alert' | 'hard_pause';
  if (spend >= BUDGET_HARD_PAUSE_USD) {
    activeTier = 'hard_pause';
  } else if (spend >= BUDGET_ALERT_USD) {
    activeTier = 'alert';
  } else if (spend >= BUDGET_WARN_USD) {
    activeTier = 'warn';
  } else {
    activeTier = 'nominal';
  }

  return {
    spend24hUsd: spend,
    thresholds: {
      warn:       BUDGET_WARN_USD,
      alert:      BUDGET_ALERT_USD,
      hard_pause: BUDGET_HARD_PAUSE_USD,
    },
    activeTier,
    hardPauseActive,
    consecutiveLowScoreCycles,
    lastWatchCycleTime,
    lastNotificationFingerprints: lastNotificationFingerprints.slice(-5),
  };
}
