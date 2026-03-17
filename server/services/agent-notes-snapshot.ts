/**
 * Agent Notes Snapshot Generator
 *
 * Generates docs/alden-to-agent.md from unread notes Alden has left for the Agent.
 * Called at server start so the Agent picks up Alden's messages at the top of each session.
 *
 * Flow:
 *   Alden writes → leave_note_for_agent tool → agent_notes table (from='alden', to='agent')
 *   Server start → this generates docs/alden-to-agent.md
 *   Agent reads → docs/alden-to-agent.md at session start
 *   Agent marks read → POST /api/agent/notes/mark-read (or at next write)
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { getSharedDb } from '../neon-db';
import { agentNotes } from '@shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';

const SNAPSHOT_PATH = join(process.cwd(), 'docs/alden-to-agent.md');

export async function generateAgentNotesSnapshot(): Promise<void> {
  try {
    const db = getSharedDb();
    const notes = await db
      .select()
      .from(agentNotes)
      .where(and(
        eq(agentNotes.fromAgent, 'alden'),
        eq(agentNotes.toAgent, 'agent'),
        isNull(agentNotes.readAt)
      ))
      .orderBy(desc(agentNotes.createdAt));

    if (notes.length === 0) {
      writeFileSync(SNAPSHOT_PATH, `# Alden → Agent Notes

*No unread notes from Alden. When Alden uses the \`leave_note_for_agent\` tool, messages will appear here at next server start.*

Generated: ${new Date().toLocaleString()}
`, 'utf-8');
      console.log('[AgentNotes] Snapshot written — 0 unread notes from Alden');
      return;
    }

    const sections = notes.map(n => {
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
    });

    const content = [
      `# Alden → Agent Notes`,
      ``,
      `*${notes.length} unread note${notes.length !== 1 ? 's' : ''} from Alden. Read them, act on them, then mark as read via \`POST /api/agent/notes/mark-read\` with \`{ ids: [...] }\`.*`,
      ``,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `---`,
      ``,
      sections.join('\n\n---\n\n'),
    ].join('\n');

    writeFileSync(SNAPSHOT_PATH, content, 'utf-8');
    console.log(`[AgentNotes] Snapshot written — ${notes.length} unread note(s) from Alden`);
  } catch (err) {
    console.error('[AgentNotes] Failed to generate snapshot:', err);
  }
}
