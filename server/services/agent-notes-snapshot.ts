/**
 * Agent Notes Snapshot Generator
 *
 * Generates docs/alden-to-agent.md from unread notes Alden has left for the Agent.
 * Generates docs/founder-to-agent.md from unread notes David (founder) has flagged for Agent.
 * Called at server start so the Agent picks up messages at the top of each session.
 *
 * Flow:
 *   Alden writes → leave_note_for_agent tool → agent_notes table (from='alden', to='agent')
 *   David writes → LucaObserverPanel dev-note → agent_notes table (from='founder', to='agent')
 *   Server start → this generates docs/alden-to-agent.md + docs/founder-to-agent.md
 *   Agent reads → both files at session start
 *   Agent marks read → POST /api/agent/notes/mark-read (or at next write)
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { getSharedDb } from '../neon-db';
import { agentNotes } from '@shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

const ALDEN_SNAPSHOT_PATH = join(process.cwd(), 'docs/alden-to-agent.md');
const FOUNDER_SNAPSHOT_PATH = join(process.cwd(), 'docs/founder-to-agent.md');

function formatNoteSection(n: typeof agentNotes.$inferSelect): string {
  const date = new Date(n.createdAt).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
  const session = n.sessionLabel ? `\n*During: ${n.sessionLabel}*` : '';
  return [
    `### ${n.subject}`,
    `*${date}* (id: \`${n.id}\`)${session}`,
    '',
    n.body,
  ].join('\n');
}

export async function generateAgentNotesSnapshot(): Promise<void> {
  try {
    const db = getSharedDb();

    // --- Alden notes ---
    const aldenNotes = await db
      .select()
      .from(agentNotes)
      .where(and(
        eq(agentNotes.fromAgent, 'alden'),
        eq(agentNotes.toAgent, 'agent'),
        isNull(agentNotes.readAt)
      ))
      .orderBy(desc(agentNotes.createdAt));

    if (aldenNotes.length === 0) {
      writeFileSync(ALDEN_SNAPSHOT_PATH, `# Alden → Agent Notes

*No unread notes from Alden. When Alden uses the \`leave_note_for_agent\` tool, messages will appear here at next server start.*

Generated: ${new Date().toLocaleString()}
`, 'utf-8');
      console.log('[AgentNotes] Alden snapshot written — 0 unread notes');
    } else {
      const sections = aldenNotes.map(formatNoteSection);
      const content = [
        `# Alden → Agent Notes`,
        ``,
        `*${aldenNotes.length} unread note${aldenNotes.length !== 1 ? 's' : ''} from Alden. Read them, act on them, then mark as read via \`POST /api/agent/notes/mark-read\` with \`{ ids: [...] }\`.*`,
        ``,
        `Generated: ${new Date().toLocaleString()}`,
        ``,
        `---`,
        ``,
        sections.join('\n\n---\n\n'),
      ].join('\n');
      writeFileSync(ALDEN_SNAPSHOT_PATH, content, 'utf-8');
      console.log(`[AgentNotes] Alden snapshot written — ${aldenNotes.length} unread note(s)`);
    }

    // --- Founder (David) notes ---
    const founderNotes = await db
      .select()
      .from(agentNotes)
      .where(and(
        eq(agentNotes.fromAgent, 'founder'),
        eq(agentNotes.toAgent, 'agent'),
        isNull(agentNotes.readAt)
      ))
      .orderBy(desc(agentNotes.createdAt));

    if (founderNotes.length === 0) {
      writeFileSync(FOUNDER_SNAPSHOT_PATH, `# David → Luca Notes (mid-session flags)

*No unread notes from David. When David uses the dev-note field in the Luca Observer Panel, messages will appear here at next server start.*

Generated: ${new Date().toLocaleString()}
`, 'utf-8');
      console.log('[AgentNotes] Founder snapshot written — 0 unread notes');
    } else {
      const sections = founderNotes.map(formatNoteSection);
      const content = [
        `# David → Luca Notes (mid-session flags)`,
        ``,
        `*${founderNotes.length} unread note${founderNotes.length !== 1 ? 's' : ''} from David. These were flagged mid-session via the Luca Observer Panel. Read them, act on them, then mark as read via \`POST /api/agent/notes/mark-read\` with \`{ ids: [...] }\`.*`,
        ``,
        `Generated: ${new Date().toLocaleString()}`,
        ``,
        `---`,
        ``,
        sections.join('\n\n---\n\n'),
      ].join('\n');
      writeFileSync(FOUNDER_SNAPSHOT_PATH, content, 'utf-8');
      console.log(`[AgentNotes] Founder snapshot written — ${founderNotes.length} unread note(s) from David`);
    }

  } catch (err) {
    console.error('[AgentNotes] Failed to generate snapshot:', err);
  }
}
