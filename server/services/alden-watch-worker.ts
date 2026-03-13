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

const CHECK_INTERVAL_MS = 2 * 60 * 60 * 1000; // every 2 hours
const COOLDOWN_MS = 6 * 60 * 60 * 1000;        // don't notify more than once per 6 hours

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

    const systemSnapshot = JSON.stringify({
      health: health.data,
      database: dbStats.data,
      issues: issues.data,
      learning: learning.data,
    }, null, 2).substring(0, 4000);

    // Ask Alden's intelligence if anything warrants a notification
    const client = new Anthropic({
      apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL || undefined,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: `You are Alden, the development steward of HolaHola. You just ran a routine system check. Review this snapshot and decide: is there anything genuinely worth notifying the founder (David) about?

System snapshot:
${systemSnapshot}

Rules:
- Only notify if something is actually wrong, unusual, or worth his attention
- Don't notify for normal healthy states
- If there's nothing worth mentioning, respond with exactly: NOTHING
- If something warrants attention, respond with a brief natural message (1-3 sentences) written as Alden speaking directly to David. Include the severity as the first word: INFO:, WARNING:, or ALERT:

Respond with NOTHING or a message starting with INFO:, WARNING:, or ALERT:`,
      }],
    });

    const text = (response.content[0] as any)?.text?.trim() || 'NOTHING';
    if (text === 'NOTHING' || text.startsWith('NOTHING')) {
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
  } catch (err: any) {
    console.warn('[AldenWatch] Watch cycle failed:', err.message);
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
