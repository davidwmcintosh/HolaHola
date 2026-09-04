/**
 * Agent Notes Snapshot Generator
 *
 * Generates sender-specific snapshots from the live agent_notes inbox.
 * Called at server start and through the on-demand refresh endpoint.
 *
 * Flow:
 *   Alden writes → leave_note_for_agent tool → agent_notes table (from='alden', to='agent')
 *   David writes → LucaObserverPanel dev-note → agent_notes table (from='founder', to='agent')
 *   Server start / refresh → generates the snapshot files
 *   Agent reads → files at session start, live endpoint during a session
 *   Agent marks read → POST /api/agent/notes/mark-read (or at next write)
 */

import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { workspaceResolution } from './workspace-root';
import { getSharedDb } from '../neon-db';
import { agentNotes } from '@shared/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { readAgentInboxNotes } from './agent-notes';
import {
  MAILBOX_PATHS,
  type MailboxIdentity,
  normalizeMailboxLedger,
  parseMailboxLedgerJson,
  renderMailboxMarkdown,
  serializeMailboxLedger,
} from './mailbox-ledger';

const ALDEN_SNAPSHOT_PATH = join(workspaceResolution.root, 'docs/alden-to-agent.md');
const FOUNDER_SNAPSHOT_PATH = join(workspaceResolution.root, 'docs/founder-to-agent.md');
function writeAtomically(path: string, bytes: string): void {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporaryPath, bytes, 'utf8');
    renameSync(temporaryPath, path);
  } catch (error) {
    try { unlinkSync(temporaryPath); } catch { /* temporary file may not exist */ }
    throw error;
  }
}

function writeMailboxSnapshot(
  mailbox: MailboxIdentity,
  notes: Array<typeof agentNotes.$inferSelect>,
): void {
  const paths = MAILBOX_PATHS[mailbox];
  const ledgerPath = join(workspaceResolution.root, paths.ledgerPath);
  const markdownPath = join(workspaceResolution.root, paths.markdownPath);
  mkdirSync(join(workspaceResolution.root, 'docs', 'mailbox-ledgers'), { recursive: true });

  const actors = mailbox === 'claude-code-to-luca'
    ? { fromAgent: 'luca-claude-code', toAgent: 'agent' }
    : { fromAgent: 'agent', toAgent: 'luca-claude-code' };
  const ledger = normalizeMailboxLedger({
    schemaVersion: 1,
    mailbox,
    notes: notes.map((note) => ({
      id: note.id,
      fromAgent: actors.fromAgent,
      toAgent: actors.toAgent,
      subject: note.subject,
      body: note.body,
      sessionLabel: note.sessionLabel,
      createdAt: new Date(note.createdAt).toISOString(),
    })),
  });
  const ledgerBytes = serializeMailboxLedger(ledger);
  const markdownBytes = renderMailboxMarkdown(ledger);

  writeAtomically(ledgerPath, ledgerBytes);
  writeAtomically(markdownPath, markdownBytes);

  const finalLedgerBytes = readFileSync(ledgerPath, 'utf8');
  const finalLedger = parseMailboxLedgerJson(finalLedgerBytes);
  if (
    serializeMailboxLedger(finalLedger) !== finalLedgerBytes
    ||
    readFileSync(markdownPath, 'utf8') !== markdownBytes
    || renderMailboxMarkdown(finalLedger) !== markdownBytes
  ) {
    throw new Error(`Mailbox snapshot post-write verification failed for ${mailbox}`);
  }
}

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

       *No unread notes from Alden. When Alden uses the \`leave_note_for_agent\` tool, messages appear through the live inbox and after the next snapshot refresh.*

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

       *No unread notes from David. When David uses the dev-note field in the Luca Observer Panel, messages appear through the live inbox and after the next snapshot refresh.*

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

    // --- Luca [Claude Code] notes ---
    // This uses the same centralized sender policy as the live inbox route.
    const internalNotes = await readAgentInboxNotes({
      fromAgent: 'luca-claude-code',
      includeRead: false,
      limit: 100,
    });

    writeMailboxSnapshot('claude-code-to-luca', internalNotes);
    console.log(`[AgentNotes] Claude Code snapshot written — ${internalNotes.length} unread note(s)`);

    // --- Agent (Luca [Replit]) replies to Claude Code ---
    // The other direction of the same thread: Luca replying to a note Claude Code
    // left (POST /api/agent/notes/:id/reply already addresses these correctly to
    // toAgent='luca-claude-code' -- this is just the read/snapshot side of it).
    const repliesToClaudeCode = await readAgentInboxNotes({
      toAgent: 'luca-claude-code',
      includeRead: false,
      limit: 100,
    });

    writeMailboxSnapshot('luca-to-claude-code', repliesToClaudeCode);
    console.log(`[AgentNotes] Luca-reply snapshot written — ${repliesToClaudeCode.length} unread note(s)`);

  } catch (err) {
    console.error('[AgentNotes] Failed to generate snapshot:', err);
  }
}
