/**
 * Agent Briefing Generator
 *
 * Generates docs/agent-briefing.md on every server start AND whenever
 * a new conversation memory is saved (so the room is always current).
 *
 * Pulls from:
 *   - agent_north_star       (purpose, values, role, what matters)
 *   - agent_open_questions   (open threads, unresolved ideas)
 *   - agent_record_of_david  (who David is, how he works, the vision)
 *   - conversation_memories  (curated moments from past sessions)
 *   - editor_insights        (shared lobe — top entries by importance)
 *   - docs/alden-agent-handoff.md (most recent session notes)
 *
 * Auto-Summary:
 *   When memories exist that were saved after the previous briefing was
 *   generated, Gemini synthesizes a "Last Session" summary and places it
 *   at the very top — before all other sections. This is the pushed context
 *   that should surface without any pulling.
 */

import { writeFileSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { getSharedDb } from '../neon-db';
import {
  agentNorthStar,
  agentOpenQuestions,
  agentRecordOfDavid,
  conversationMemories,
  editorInsights,
} from '@shared/schema';
import { eq, desc, and, ne, gt } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';

const BRIEFING_PATH = join(process.cwd(), 'docs/agent-briefing.md');
const HANDOFF_PATH = join(process.cwd(), 'docs/alden-agent-handoff.md');
const REPLIT_MD_PATH = join(process.cwd(), 'replit.md');

const MEMORY_START = '<!-- AGENT_MEMORY_START -->';
const MEMORY_END = '<!-- AGENT_MEMORY_END -->';

/**
 * Writes the critical memory summary directly into replit.md between
 * the AGENT_MEMORY_START / AGENT_MEMORY_END markers. This is the true
 * injection path — replit.md is auto-loaded into the Agent's context without
 * any read step required.
 *
 * If there are new memories since the last briefing, uses the Gemini-generated
 * autoSummary. Otherwise falls back to the top 3 recent memories so the block
 * is never empty — the Agent always arrives with recent context.
 */
function updateReplitMdMemoryBlock(
  autoSummary: string | null,
  generatedAt: string,
  recentMemories: Array<{ title: string; summary: string; recordedAt: Date; importance: number | null }>
): void {
  if (!existsSync(REPLIT_MD_PATH)) return;
  try {
    const content = readFileSync(REPLIT_MD_PATH, 'utf-8');
    const startIdx = content.indexOf(MEMORY_START);
    const endIdx = content.indexOf(MEMORY_END);
    if (startIdx === -1 || endIdx === -1) return;

    let blockBody: string;
    if (autoSummary) {
      blockBody = `## Agent Memory — Live Injection\n*Auto-updated ${generatedAt}. What changed since last session — no reading required.*\n\n${autoSummary}`;
    } else if (recentMemories.length > 0) {
      // No new memories since last briefing, but still show recent context
      const top = recentMemories.slice(0, 3);
      const lines = top.map(m => {
        const date = new Date(m.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `- **${m.title}** (${date}): ${m.summary}`;
      }).join('\n');
      blockBody = `## Agent Memory — Live Injection\n*Auto-updated ${generatedAt}. No new memories since last session — showing recent context.*\n\n${lines}`;
    } else {
      blockBody = `## Agent Memory — Live Injection\n*Auto-updated ${generatedAt}. No memories saved yet.*`;
    }

    const updated =
      content.slice(0, startIdx) +
      MEMORY_START + '\n' +
      blockBody + '\n' +
      MEMORY_END +
      content.slice(endIdx + MEMORY_END.length);

    writeFileSync(REPLIT_MD_PATH, updated, 'utf-8');
    console.log('[AgentBriefing] replit.md memory block updated');
  } catch (err: any) {
    console.warn('[AgentBriefing] Failed to update replit.md memory block:', err.message);
  }
}

const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

/**
 * Get the last-modified time of the previously-written briefing file.
 * This is used to find memories saved after the last briefing was generated.
 * Returns null if the file doesn't exist.
 */
function getPreviousBriefingTime(): Date | null {
  if (!existsSync(BRIEFING_PATH)) return null;
  try {
    return statSync(BRIEFING_PATH).mtime;
  } catch {
    return null;
  }
}

/**
 * Use Gemini to synthesize a concise auto-summary from memories saved
 * since the last briefing. Falls back to a plain list if AI is unavailable.
 */
async function buildAutoSummary(
  newMemories: Array<{ title: string; summary: string; content: string; tags: string[] | null; recordedAt: Date }>
): Promise<string | null> {
  if (newMemories.length === 0) return null;

  // Plain fallback — always usable even without AI
  const plainList = newMemories.map(m => {
    const date = new Date(m.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `- **${m.title}** (${date}): ${m.summary}`;
  }).join('\n');

  if (!GEMINI_KEY) {
    return `*Memories saved since last briefing:*\n\n${plainList}`;
  }

  try {
    const genAI = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const memoryText = newMemories.map(m =>
      `Title: ${m.title}\nSummary: ${m.summary}\nDetail: ${m.content}`
    ).join('\n\n---\n\n');

    const prompt = `You are writing a session recap for an AI agent (the Replit Agent) who builds HolaHola, an AI language learning platform. The agent reads this at the start of a new chat session to immediately know what happened last time without needing to search.

The following conversation memories were saved during the last session. Write a tight, first-person recap (2–4 sentences max) that captures: what was discussed or built, any key decisions made, and anything the agent should remember going into this session. Be specific — include proper nouns, feature names, and concrete outcomes. Write as if you are the agent orienting yourself, not describing someone else.

Memories:
${memoryText}

Write only the recap paragraph. No headers, no preamble.`;

    const response = await genAI.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (text) {
      return `${text}\n\n*Memories that triggered this summary:*\n${plainList}`;
    }
    return `*Memories saved since last briefing:*\n\n${plainList}`;
  } catch (err: any) {
    console.warn('[AgentBriefing] Gemini auto-summary failed, using plain list:', err.message);
    return `*Memories saved since last briefing:*\n\n${plainList}`;
  }
}

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
    const previousBriefingTime = getPreviousBriefingTime();

    // Fetch all data in parallel
    const [northStars, openQs, davidRecords, recentMemories, sharedInsightsList, newMemories] = await Promise.all([
      db.select().from(agentNorthStar).orderBy(desc(agentNorthStar.updatedAt)).limit(1),
      db.select().from(agentOpenQuestions)
        .where(and(
          ne(agentOpenQuestions.status, 'resolved'),
          ne(agentOpenQuestions.status, 'tabled')
        ))
        .orderBy(desc(agentOpenQuestions.importance))
        .limit(8),
      db.select().from(agentRecordOfDavid).orderBy(desc(agentRecordOfDavid.updatedAt)).limit(1),
      // Most recent memories first — so the freshest context surfaces at top
      db.select().from(conversationMemories)
        .orderBy(desc(conversationMemories.recordedAt))
        .limit(5),
      db.select().from(editorInsights)
        .where(eq(editorInsights.category, 'shared'))
        .orderBy(desc(editorInsights.importance), desc(editorInsights.createdAt))
        .limit(5),
      // Memories saved AFTER the previous briefing — these are the "new since last session" items
      previousBriefingTime
        ? db.select().from(conversationMemories)
            .where(gt(conversationMemories.recordedAt, previousBriefingTime))
            .orderBy(desc(conversationMemories.recordedAt))
            .limit(10)
        : Promise.resolve([]),
    ]);

    const star = northStars[0] ?? null;
    const david = davidRecords[0] ?? null;

    const handoffContent = existsSync(HANDOFF_PATH) ? readFileSync(HANDOFF_PATH, 'utf-8') : '';
    const { fromAlden, fromAgent } = extractLastHandoffSections(handoffContent);

    // Build the auto-summary from memories saved after the last briefing
    const autoSummary = await buildAutoSummary(newMemories as any);

    const nowStr = new Date().toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long',
      day: 'numeric', hour: '2-digit', minute: '2-digit',
    });

    const lines: string[] = [];

    lines.push(`# Agent Briefing`);
    lines.push(`*Your room. Generated fresh on every server start and after every memory save.*`);
    lines.push(`\n**Generated:** ${nowStr}`);
    lines.push(`\n---`);

    // ── AUTO-SUMMARY (top of briefing — pushed, not pulled) ─────────────────────
    if (autoSummary) {
      lines.push(`\n## Since Last Briefing`);
      lines.push(`*Auto-generated from memories saved since this file was last written.*\n`);
      lines.push(autoSummary);
      lines.push(`\n---`);
    }

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
    if (recentMemories.length > 0) {
      for (const mem of recentMemories) {
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
    const summaryNote = autoSummary ? ' (with auto-summary)' : '';
    console.log(`[AgentBriefing] Briefing written to docs/agent-briefing.md${summaryNote}`);

    // Also inject the critical summary directly into replit.md so it is
    // auto-loaded into the Agent's context without any read step required.
    // Pass recentMemories as fallback so the block is never empty.
    updateReplitMdMemoryBlock(autoSummary, nowStr, recentMemories as any);
  } catch (err: any) {
    console.warn('[AgentBriefing] Generation failed:', err.message);
  }
}
