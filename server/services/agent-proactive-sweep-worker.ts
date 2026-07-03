/**
 * Agent Proactive Sweep Worker
 *
 * Runs daily. No David input needed.
 *
 * Pulls live data from: alden_escalations, agent_open_questions, system_alerts,
 * wren_insights, alden_notifications (unread), build_queue (pending).
 *
 * Claude reads all of it and produces a 5-item prioritized action list,
 * posted as a message in the active Team Room. Each item can optionally reference
 * a build_queue entry. David can say "do it" on any line — or scroll past.
 */

import Anthropic from '@anthropic-ai/sdk';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import { storage } from '../storage';
import { emitNewMessage } from './team-room-ws-broker';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const INITIAL_DELAY_MS  =  2 * 60 * 60 * 1000; // 2h after boot
const WORKSPACE = '/home/runner/workspace';

let isRunning = false;

// ── Context gathering ─────────────────────────────────────────────────────────

async function gatherSweepContext(): Promise<string> {
  const db = getUserDb();
  const parts: string[] = [];

  // 1. Unresolved escalations
  try {
    const escs = await db.execute(sql.raw(`
      SELECT issue_summary, recommended_action, created_at
      FROM alden_escalations
      WHERE resolved_at IS NULL
      ORDER BY created_at DESC LIMIT 5
    `));
    if (escs.rows.length) {
      parts.push('=== UNRESOLVED ALDEN ESCALATIONS ===');
      escs.rows.forEach((r: any) =>
        parts.push(`• ${r.issue_summary}\n  Recommended: ${r.recommended_action}`)
      );
    }
  } catch { /* table may not exist */ }

  // 2. Open questions in Agent Space
  try {
    const qs = await db.execute(sql.raw(`
      SELECT question, context FROM agent_open_questions
      WHERE status = 'open'
      ORDER BY created_at DESC LIMIT 6
    `));
    if (qs.rows.length) {
      parts.push('\n=== OPEN AGENT QUESTIONS ===');
      qs.rows.forEach((r: any) => parts.push(`• ${r.question}`));
    }
  } catch { /* table may not exist */ }

  // 3. Active system alerts
  try {
    const alerts = await db.execute(sql.raw(`
      SELECT title, message, severity FROM system_alerts
      WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY severity DESC LIMIT 5
    `));
    if (alerts.rows.length) {
      parts.push('\n=== ACTIVE SYSTEM ALERTS ===');
      alerts.rows.forEach((r: any) =>
        parts.push(`• [${r.severity}] ${r.title}: ${(r.message || '').slice(0, 100)}`)
      );
    }
  } catch { /* table may not exist */ }

  // 4. Recent Wren insights (actionable ones)
  try {
    const wren = await db.execute(sql.raw(`
      SELECT title, insight, category FROM wren_insights
      WHERE category IN ('anomaly', 'concern', 'pattern', 'recommendation')
      ORDER BY created_at DESC LIMIT 5
    `));
    if (wren.rows.length) {
      parts.push('\n=== RECENT WREN FINDINGS ===');
      wren.rows.forEach((r: any) =>
        parts.push(`• [${r.category}] ${r.title}: ${(r.insight || '').slice(0, 120)}`)
      );
    }
  } catch { /* table may not exist */ }

  // 5. Unread Alden notifications
  try {
    const notifs = await db.execute(sql.raw(`
      SELECT content, severity FROM alden_notifications
      WHERE read = false
      ORDER BY created_at DESC LIMIT 6
    `));
    if (notifs.rows.length) {
      parts.push('\n=== UNREAD ALDEN NOTIFICATIONS ===');
      notifs.rows.forEach((r: any) =>
        parts.push(`• [${r.severity}] ${(r.content || '').slice(0, 120)}`)
      );
    }
  } catch { /* table may not exist */ }

  // 6. Pending build queue items
  try {
    const queue = await db.execute(sql.raw(`
      SELECT title, description, proposed_by, is_safe_zone, priority
      FROM build_queue WHERE status = 'pending'
      ORDER BY priority DESC, proposed_at ASC LIMIT 8
    `));
    if (queue.rows.length) {
      parts.push('\n=== PENDING BUILD QUEUE ===');
      queue.rows.forEach((r: any) =>
        parts.push(`• [${r.proposed_by}] (p${r.priority}) ${r.title} — ${(r.description || '').slice(0, 100)}`)
      );
    }
  } catch { /* table may not exist */ }

  // 7. Shared lobe snapshot
  try {
    const sharedLobePath = join(WORKSPACE, 'docs/shared-lobe-snapshot.md');
    if (existsSync(sharedLobePath)) {
      const lobe = readFileSync(sharedLobePath, 'utf-8').slice(0, 1500);
      parts.push('\n=== SHARED LOBE (recent Alden→Agent insights) ===');
      parts.push(lobe);
    }
  } catch { /* file may not exist */ }

  return parts.join('\n') || 'No significant signals found in the system.';
}

// ── Sweep execution ───────────────────────────────────────────────────────────

async function runSweep(): Promise<void> {
  console.log('[AgentSweep] Starting daily proactive sweep');

  let context: string;
  try {
    context = await gatherSweepContext();
  } catch (err: any) {
    console.error('[AgentSweep] Failed to gather context:', err.message);
    return;
  }

  let sweep: string;
  try {
    const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const resp = await claude.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 800,
      system: `You are the Replit Agent — the external builder of HolaHola. You run a daily proactive sweep of system signals and produce a short prioritized action list for David.

Format: produce EXACTLY 5 numbered items. Each item is one line:
[priority] Title — what you'd do and why, in plain language.
Priority levels: CRITICAL | HIGH | MEDIUM | LOW | FYI

After the list, add one SHORT paragraph (2-3 sentences) framing the overall picture.

Rules:
- Be specific. Reference actual issues, not vague gestures.
- "Do it" items should be things that have a clear fix.
- FYI items are things David should know but don't need action now.
- If the build queue has pending items, reference them by title.
- Tone: direct, informed, confident. You've already read the data.`,
      messages: [{
        role: 'user',
        content: `Today's system snapshot:\n\n${context}\n\nWhat's the prioritized action list?`,
      }],
    });

    sweep = resp.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('');
  } catch (err: any) {
    console.error('[AgentSweep] Claude call failed:', err.message);
    return;
  }

  // Save sweep results to conversation_memories so the Agent has a persistent record
  // of system health observations across sessions.
  try {
    const db = getUserDb();
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const summary = sweep.split('\n').slice(0, 3).join(' ').slice(0, 300);
    await db.execute(sql`
      INSERT INTO conversation_memories (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
      VALUES (
        gen_random_uuid(),
        ${`Agent Daily Sweep — ${today}`},
        ${summary},
        ${sweep},
        ARRAY['agent']::text[],
        ARRAY['agent-sweep', 'daily', 'auto-saved']::text[],
        6,
        NOW(),
        'build',
        'agent-sweep-log'
      )
    `);
    console.log('[AgentSweep] Sweep saved to conversation_memories.');
  } catch (saveErr: any) {
    console.error('[AgentSweep] Failed to save sweep to conversation_memories:', saveErr.message);
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

export function startAgentSweepWorker(): void {
  if (isRunning) return;
  isRunning = true;

  console.log(`[AgentSweep] Starting — first sweep in ${INITIAL_DELAY_MS / 3600000}h, then daily`);

  setTimeout(() => {
    runSweep();
    setInterval(runSweep, SWEEP_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}

/** Trigger a sweep immediately (for testing or manual trigger from Team Room). */
export async function triggerSweep(): Promise<void> {
  await runSweep();
}
