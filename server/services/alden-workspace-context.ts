/**
 * Alden Workspace Context
 *
 * Assembles Alden's persistent memory and awareness into a structured block
 * that is injected at the start of every conversation turn.
 *
 * Sources:
 *   0. replit.md          — the project bible (architecture, rules, preferences)
 *   1. Editor Insights    — permanent architectural decisions, project history (ALL of them)
 *   2. Significant Messages — notable past exchanges between David and Alden
 *   3. Recent Sessions    — summarized conversation history
 *   4. Express Lane       — recent team collaboration and platform alerts
 *   5. Recent Commits     — last 8 git commits so Alden knows what just changed
 */

import { db } from '../db';
import { editorInsights, aldenMessages, aldenConversations, collaborationMessages } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';
import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { getFounderPresence } from './founder-presence';

export async function buildAldenWorkspaceContext(): Promise<string> {
  const sections: string[] = [];

  // ── 0. replit.md — PROJECT BIBLE ──────────────────────────────────────────
  // The authoritative record of architecture, rules, and user preferences.
  // The Replit Agent always has this in memory — now Alden does too.
  try {
    const replitMdPath = join(process.cwd(), 'replit.md');
    const replitMd = readFileSync(replitMdPath, 'utf-8').trim();
    if (replitMd) {
      sections.push(`📖 PROJECT BIBLE — replit.md\n${replitMd}`);
    }
  } catch (err: any) {
    console.warn('[AldenWorkspace] replit.md read failed:', err.message);
  }

  // ── 1. EDITOR INSIGHTS — ALL OF THEM ─────────────────────────────────────
  // Alden's permanent memory. Load every insight, not just the top 12.
  // Content shown up to 500 chars so critical details aren't truncated.
  try {
    const insights = await db
      .select({
        category: editorInsights.category,
        title: editorInsights.title,
        content: editorInsights.content,
        importance: editorInsights.importance,
      })
      .from(editorInsights)
      .orderBy(desc(editorInsights.importance), desc(editorInsights.createdAt));

    if (insights.length > 0) {
      const lines = insights.map(i => {
        const preview = (i.content || '').substring(0, 500).replace(/\n+/g, ' ');
        return `  [${(i.category || 'note').toUpperCase()} · importance ${i.importance}] ${i.title}\n  ${preview}`;
      });
      sections.push(`📚 PERSISTENT MEMORY — Editor Insights (${insights.length} entries)\n${lines.join('\n\n')}`);
    }
  } catch (err: any) {
    console.warn('[AldenWorkspace] Editor insights fetch failed:', err.message);
  }

  // ── 2. SIGNIFICANT PAST EXCHANGES ─────────────────────────────────────────
  // Moments David and Alden marked as significant — continuity across sessions
  try {
    const significant = await db
      .select({
        role: aldenMessages.role,
        content: aldenMessages.content,
        createdAt: aldenMessages.createdAt,
      })
      .from(aldenMessages)
      .where(eq(aldenMessages.isSignificant, true))
      .orderBy(desc(aldenMessages.createdAt))
      .limit(10);

    if (significant.length > 0) {
      // Show in chronological order so the exchange reads naturally
      const chronological = [...significant].reverse();
      const lines = chronological.map(m => {
        const speaker = m.role === 'david' || m.role === 'user' ? 'David' : 'Alden';
        const preview = (m.content || '').substring(0, 200).replace(/\n+/g, ' ');
        const when = m.createdAt
          ? new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '';
        return `  ${speaker} (${when}): "${preview}"`;
      });
      sections.push(`🔖 SIGNIFICANT PAST EXCHANGES (${significant.length} moments)\n${lines.join('\n')}`);
    }
  } catch (err: any) {
    console.warn('[AldenWorkspace] Significant messages fetch failed:', err.message);
  }

  // ── 3. RECENT CONVERSATION SUMMARIES ──────────────────────────────────────
  // What was accomplished in recent sessions with David
  try {
    const recentConvs = await db
      .select({
        title: aldenConversations.title,
        summary: aldenConversations.summary,
        tasksCompleted: aldenConversations.tasksCompleted,
        endedAt: aldenConversations.endedAt,
        significance: aldenConversations.significance,
      })
      .from(aldenConversations)
      .orderBy(desc(aldenConversations.startedAt))
      .limit(5);

    const summarized = recentConvs.filter(c => c.summary);
    if (summarized.length > 0) {
      const lines = summarized.map(c => {
        const when = c.endedAt
          ? new Date(c.endedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : 'ongoing';
        const tasks = c.tasksCompleted && c.tasksCompleted.length > 0
          ? ` Tasks: ${c.tasksCompleted.join(', ')}.`
          : '';
        return `  [${when}] ${c.title}: ${(c.summary || '').substring(0, 180)}${tasks}`;
      });
      sections.push(`🗂 RECENT SESSIONS\n${lines.join('\n')}`);
    }
  } catch (err: any) {
    console.warn('[AldenWorkspace] Conversation summaries fetch failed:', err.message);
  }

  // ── 4. EXPRESS LANE — RECENT TEAM ACTIVITY ────────────────────────────────
  // What the broader AI team (Wren, Lyra, Daniela) has flagged recently
  try {
    const expressLane = await db
      .select({
        role: collaborationMessages.role,
        content: collaborationMessages.content,
        createdAt: collaborationMessages.createdAt,
      })
      .from(collaborationMessages)
      .orderBy(desc(collaborationMessages.createdAt))
      .limit(6);

    if (expressLane.length > 0) {
      const chronological = [...expressLane].reverse();
      const lines = chronological.map(m => {
        const speaker = String(m.role || 'system').toUpperCase();
        const preview = (m.content || '').substring(0, 200).replace(/\n+/g, ' ');
        return `  [${speaker}] ${preview}`;
      });
      sections.push(`📡 EXPRESS LANE — RECENT TEAM ACTIVITY\n${lines.join('\n')}`);
    }
  } catch (err: any) {
    console.warn('[AldenWorkspace] Express Lane fetch failed:', err.message);
  }

  // ── 5. HANDOFF FILE ───────────────────────────────────────────────────────
  // Bidirectional briefing between Alden and the Replit Agent.
  // Alden writes "From Alden" when ending a notable session.
  // The Agent writes "From Agent" after major build sessions.
  try {
    const handoffPath = join(process.cwd(), 'docs/alden-agent-handoff.md');
    const rawHandoff = readFileSync(handoffPath, 'utf-8');
    // Cap at last 50 KB — the file grows unboundedly; only recent entries matter.
    const MAX_HANDOFF_CHARS = 50_000;
    const handoff = rawHandoff.length > MAX_HANDOFF_CHARS
      ? `[… earlier entries omitted — ${(rawHandoff.length / 1024).toFixed(0)}KB file, showing last ${(MAX_HANDOFF_CHARS / 1024).toFixed(0)}KB]\n\n${rawHandoff.slice(-MAX_HANDOFF_CHARS)}`
      : rawHandoff;
    if (handoff.trim()) {
      sections.push(`🤝 HANDOFF NOTES — alden-agent-handoff.md\n${handoff.trim()}`);
    }
  } catch {
    // File may not exist yet — that's fine
  }

  // ── 6. TEMPORAL CONTEXT & FOUNDER PRESENCE ────────────────────────────────
  // Alden's compass: what time it is, whether David is around.
  // This changes how he prioritises notifications and what to lead with.
  try {
    const now = new Date();
    const presence = getFounderPresence();
    const timeStr = now.toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver', timeZoneName: 'short',
    });
    const uptimeMin = Math.round(process.uptime() / 60);
    const uptimeStr = uptimeMin < 60
      ? `${uptimeMin}m`
      : `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`;

    const lines = [
      `Current time: ${timeStr}`,
      `David's presence: ${presence.description}`,
      `Server uptime: ${uptimeStr}`,
    ];
    if (presence.isCurrentlyActive) {
      lines.push(`Note: David is actively working right now.`);
    }
    sections.push(`🕐 TEMPORAL CONTEXT\n${lines.map(l => `  ${l}`).join('\n')}`);
  } catch (err: any) {
    console.warn('[AldenWorkspace] Temporal context failed:', err.message);
  }

  // ── 7. RECENT GIT COMMITS ─────────────────────────────────────────────────
  // Shows Alden what has changed recently so he's not reasoning from a
  // stale picture of the codebase.
  try {
    const gitLog = execSync('git log --oneline -8 2>/dev/null', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    }).trim();
    if (gitLog) {
      const commits = gitLog.split('\n').map(line => `  ${line}`).join('\n');
      sections.push(`🔀 RECENT COMMITS (latest first)\n${commits}`);
    }
  } catch {
    // Git not available or not a repo — skip silently
  }

  // ── FINAL ASSEMBLY ────────────────────────────────────────────────────────
  const divider = '━'.repeat(64);
  const header = `\n${divider}\nALDEN WORKSPACE — injected ${new Date().toISOString()}\n${divider}`;
  const footer = `${divider}\n`;
  return header + '\n' + sections.join('\n\n') + '\n' + footer;
}
