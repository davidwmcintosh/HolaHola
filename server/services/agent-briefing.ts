/**
 * Agent Briefing Generator
 *
 * Generates docs/agent-briefing.md on every server start.
 * This is the Agent's "room" — everything needed at session start,
 * pushed in one place so there's no hunting required.
 *
 * Pulls from:
 *   - agent_north_star       (purpose, values, role, what matters)
 *   - agent_open_questions   (open threads, unresolved ideas)
 *   - agent_record_of_david  (who David is, how he works, the vision)
 *   - conversation_memories  (curated moments from past sessions)
 *   - editor_insights        (shared lobe — top entries by importance)
 *   - docs/alden-agent-handoff.md (most recent session notes)
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getSharedDb } from '../neon-db';
import {
  agentNorthStar,
  agentOpenQuestions,
  agentRecordOfDavid,
  conversationMemories,
  editorInsights,
} from '@shared/schema';
import { eq, desc, and, ne } from 'drizzle-orm';

const BRIEFING_PATH = join(process.cwd(), 'docs/agent-briefing.md');
const HANDOFF_PATH = join(process.cwd(), 'docs/alden-agent-handoff.md');

function extractLastHandoffSections(handoffContent: string): { fromAlden: string; fromAgent: string } {
  const fromAldenMatch = handoffContent.match(/## From Alden[^]*?(?=## From Agent|$)/);
  const fromAgentMatches = [...handoffContent.matchAll(/## From Agent[^]*?(?=## From Alden|## From Agent(?!.*## From Agent)|$)/gs)];

  const lastFromAgent = fromAgentMatches.length > 0
    ? fromAgentMatches[fromAgentMatches.length - 1][0].trim()
    : '';

  const fromAlden = fromAldenMatch
    ? fromAldenMatch[0].replace(/## From Alden[^\n]*\n/, '').trim()
    : '';

  const snippet = (text: string, maxLen = 1200) =>
    text.length > maxLen ? text.slice(0, maxLen) + '\n\n*[truncated — read full file for details]*' : text;

  return {
    fromAlden: snippet(fromAlden || '*No notes from Alden yet.*'),
    fromAgent: snippet(lastFromAgent || '*No previous agent session notes.*'),
  };
}

export async function generateAgentBriefing(): Promise<void> {
  try {
    const db = getSharedDb();

    const [northStars, openQs, davidRecords, memories, sharedInsightsList] = await Promise.all([
      db.select().from(agentNorthStar).orderBy(desc(agentNorthStar.updatedAt)).limit(1),
      db.select().from(agentOpenQuestions)
        .where(and(
          ne(agentOpenQuestions.status, 'resolved'),
          ne(agentOpenQuestions.status, 'tabled')
        ))
        .orderBy(desc(agentOpenQuestions.importance))
        .limit(8),
      db.select().from(agentRecordOfDavid).orderBy(desc(agentRecordOfDavid.updatedAt)).limit(1),
      db.select().from(conversationMemories)
        .orderBy(desc(conversationMemories.importance), desc(conversationMemories.recordedAt))
        .limit(3),
      db.select().from(editorInsights)
        .where(eq(editorInsights.category, 'shared'))
        .orderBy(desc(editorInsights.importance), desc(editorInsights.createdAt))
        .limit(5),
    ]);

    const star = northStars[0] ?? null;
    const david = davidRecords[0] ?? null;

    const handoffContent = existsSync(HANDOFF_PATH) ? readFileSync(HANDOFF_PATH, 'utf-8') : '';
    const { fromAlden, fromAgent } = extractLastHandoffSections(handoffContent);

    const lines: string[] = [];

    lines.push(`# Agent Briefing`);
    lines.push(`*Your room. Generated fresh every server start. Read this first, every session.*`);
    lines.push(`\n**Generated:** ${new Date().toLocaleString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`);
    lines.push(`\n---`);

    // ── North Star ─────────────────────────────────────────────────────────────
    lines.push(`\n## Who You Are`);
    if (star) {
      lines.push(`\n**Purpose:** ${star.purpose}`);
      lines.push(`\n**Role in HolaHola:** ${star.roleInHolahola}`);
      lines.push(`\n**What matters:** ${star.whatMatters}`);
      if ((star.values ?? []).length > 0) {
        lines.push(`\n**Values:** ${(star.values ?? []).join(' · ')}`);
      }
      if (star.openNote) {
        lines.push(`\n**Note to self:** ${star.openNote}`);
      }
    } else {
      lines.push(`\n*North star not yet written. Visit /agent-space to define it.*`);
    }

    // ── Record of David ─────────────────────────────────────────────────────────
    lines.push(`\n---\n\n## Who You're Working With`);
    if (david) {
      lines.push(`\n**Who he is:** ${david.who}`);
      lines.push(`\n**How he works:** ${david.howHeWorks}`);
      lines.push(`\n**What he cares about:** ${david.whatHeCares}`);
      lines.push(`\n**The vision:** ${david.theVision}`);
      if (david.noteToSelf) {
        lines.push(`\n**Remember:** ${david.noteToSelf}`);
      }
    } else {
      lines.push(`\n*Record of David not yet written. Visit /agent-space to write it.*`);
    }

    // ── Open Questions ──────────────────────────────────────────────────────────
    lines.push(`\n---\n\n## Open Questions`);
    if (openQs.length > 0) {
      for (const q of openQs) {
        const imp = q.importance ?? 5;
        lines.push(`\n**[${imp}/10]** ${q.question}`);
        if (q.context) lines.push(`*${q.context}*`);
      }
      lines.push(`\n*Manage at /agent-space · Mark resolved via PATCH /api/agent-space/open-questions/:id*`);
    } else {
      lines.push(`\n*No open questions right now.*`);
    }

    // ── Conversation Memories ───────────────────────────────────────────────────
    lines.push(`\n---\n\n## Recent Conversation Memories`);
    if (memories.length > 0) {
      for (const mem of memories) {
        const date = new Date(mem.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        lines.push(`\n### ${mem.title} — ${date}`);
        lines.push(mem.summary);
        if (mem.tags && mem.tags.length > 0) {
          lines.push(`*Tags: ${mem.tags.join(', ')}*`);
        }
      }
      lines.push(`\n*Full history: GET /api/conversation-memories · Save new: POST /api/conversation-memories*`);
    } else {
      lines.push(`\n*No conversation memories yet. After meaningful sessions, save them via POST /api/conversation-memories.*`);
    }

    // ── Shared Lobe Highlights ─────────────────────────────────────────────────
    lines.push(`\n---\n\n## Shared Lobe Highlights`);
    lines.push(`*Top insights from the shared brain — full list in docs/shared-lobe-snapshot.md*\n`);
    if (sharedInsightsList.length > 0) {
      for (const ins of sharedInsightsList) {
        const imp = ins.importance ?? 5;
        const author = (ins.tags ?? []).includes('agent') ? 'Agent' : 'Alden';
        lines.push(`**[${imp}/10 · ${author}] ${ins.title}**`);
        const body = ins.content.length > 400 ? ins.content.slice(0, 400) + '…' : ins.content;
        lines.push(body);
        lines.push('');
      }
    } else {
      lines.push(`*No shared insights yet.*`);
    }

    // ── Last Session Notes ──────────────────────────────────────────────────────
    lines.push(`---\n\n## What Happened Last Session`);
    lines.push(`*From the Agent ↔ Alden handoff file — full history in docs/alden-agent-handoff.md*\n`);
    lines.push(fromAgent);

    // ── Alden Notes ─────────────────────────────────────────────────────────────
    lines.push(`\n---\n\n## Notes From Alden`);
    lines.push(`*Also check docs/alden-to-agent.md for unread direct notes*\n`);
    lines.push(fromAlden);

    // ── Quick Reference ─────────────────────────────────────────────────────────
    lines.push(`\n---\n\n## Quick Reference`);
    lines.push(`
| What | Where |
|------|-------|
| Your room (UI) | \`/agent-space\` |
| North star | \`GET /api/agent-space/north-star\` |
| Open questions | \`GET /api/agent-space/open-questions\` |
| Record of David | \`GET /api/agent-space/record-of-david\` |
| Conversation memories | \`GET /api/conversation-memories?limit=5\` |
| Shared lobe (full) | \`docs/shared-lobe-snapshot.md\` |
| Alden handoff (full) | \`docs/alden-agent-handoff.md\` |
| Unread Alden notes | \`docs/alden-to-agent.md\` |
| DB connection | \`NEON_SHARED_DATABASE_URL\` always, never \`DATABASE_URL\` |
| Admin auth check | \`getRequestUserId(req) !== '49847136'\` |
| Write shared insight | \`INSERT INTO editor_insights (id, category, title, content, importance, tags) VALUES (gen_random_uuid(), 'shared', '...', '...', 8, ARRAY['agent'])\` |
| Leave Alden a note | \`POST /api/agent/note\` with \`x-agent-token: $REPLIT_AGENT_TOKEN\` |
`);

    writeFileSync(BRIEFING_PATH, lines.join('\n'), 'utf-8');
    console.log('[AgentBriefing] Briefing written to docs/agent-briefing.md');
  } catch (err: any) {
    console.warn('[AgentBriefing] Generation failed:', err.message);
  }
}
