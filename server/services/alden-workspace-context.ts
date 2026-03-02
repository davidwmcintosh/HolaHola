/**
 * Alden Workspace Context
 *
 * Assembles Alden's persistent memory and awareness into a structured block
 * that is injected at the start of every conversation turn — the same
 * "push not pull" model Daniela uses for her classroom.
 *
 * Sources:
 *   1. Editor Insights      — permanent architectural decisions, project history
 *   2. Significant Messages — notable past exchanges between David and Alden
 *   3. Express Lane         — recent team collaboration and platform alerts
 */

import { db } from '../db';
import { editorInsights, aldenMessages, aldenConversations, collaborationMessages } from '@shared/schema';
import { desc, eq, and } from 'drizzle-orm';

export async function buildAldenWorkspaceContext(): Promise<string> {
  const sections: string[] = [];

  // ── 1. EDITOR INSIGHTS ─────────────────────────────────────────────────────
  // Alden's permanent memory: architectural decisions, learned rules, project history
  try {
    const insights = await db
      .select({
        category: editorInsights.category,
        title: editorInsights.title,
        content: editorInsights.content,
        importance: editorInsights.importance,
      })
      .from(editorInsights)
      .orderBy(desc(editorInsights.importance), desc(editorInsights.createdAt))
      .limit(12);

    if (insights.length > 0) {
      const lines = insights.map(i => {
        const preview = (i.content || '').substring(0, 280).replace(/\n+/g, ' ');
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

  if (sections.length === 0) {
    return '';
  }

  const divider = '━'.repeat(56);
  return [
    `${divider}`,
    `ALDEN WORKSPACE — injected ${new Date().toISOString()}`,
    `${divider}`,
    sections.join('\n\n'),
    divider,
  ].join('\n');
}
