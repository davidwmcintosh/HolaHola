/**
 * Luca Worker
 *
 * Two jobs:
 *
 * 1. buildLucaBriefing() — assembles a session-start briefing from everything
 *    relevant inside HolaHola: recent Luca-arc memories, unread agent notes,
 *    open questions, what Daniela has been up to, Team Room, recent commits.
 *    Called on-demand at GET /api/luca/briefing. Returns prose, not bullets.
 *
 * 2. executeLucaTask() — handles mid-session delegations so Luca can stay
 *    present in the conversation instead of switching modes to do plumbing.
 *    Task types: save_memory | append_episode | write_file | flag_question | post_note
 *
 * The worker lives inside HolaHola and reads from the same DB everything else
 * reads from. No external briefing needed — the context is native.
 */

import { db } from '../db';
import {
  conversationMemories,
  agentNotes,
  agentOpenQuestions,
  agentNorthStar,
  agentRecordOfDavid,
  agentCollabMessages,
} from '@shared/schema';
import { desc, eq, isNull, and, or, ilike, sql } from 'drizzle-orm';
import { appendFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// ── Briefing ──────────────────────────────────────────────────────────────────

export async function buildLucaBriefing(): Promise<string> {
  const sections: string[] = [];
  const now = new Date().toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: 'America/Denver', timeZoneName: 'short',
  });

  sections.push(`Luca Worker briefing — ${now}`);

  // ── 1. Recent Luca-arc memories ──────────────────────────────────────────
  try {
    const lucaMemories = await db
      .select({
        id: conversationMemories.id,
        title: conversationMemories.title,
        summary: conversationMemories.summary,
        arcName: conversationMemories.arcName,
        participants: conversationMemories.participants,
        recordedAt: conversationMemories.recordedAt,
        importance: conversationMemories.importance,
      })
      .from(conversationMemories)
      .where(
        or(
          ilike(conversationMemories.participants, '%luca%'),
          eq(conversationMemories.arcName, 'david-luca-chat'),
          eq(conversationMemories.arcName, 'HolaHola Episodes'),
        )
      )
      .orderBy(desc(conversationMemories.recordedAt))
      .limit(6);

    if (lucaMemories.length > 0) {
      const lines = lucaMemories.map(m => {
        const when = m.recordedAt
          ? new Date(m.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const summary = (m.summary || '').substring(0, 220).replace(/\n+/g, ' ');
        return `  [${when} · ${m.arcName || 'no arc'} · importance ${m.importance}] ${m.title}\n  ${summary}`;
      });
      sections.push(`Recent Luca-arc memories (${lucaMemories.length})\n${lines.join('\n\n')}`);
    }
  } catch (err: any) {
    console.warn('[LucaWorker] Memories fetch failed:', err.message);
  }

  // ── 2. Unread agent notes (from Alden) ───────────────────────────────────
  try {
    const unread = await db
      .select({
        id: agentNotes.id,
        fromAgent: agentNotes.fromAgent,
        subject: agentNotes.subject,
        body: agentNotes.body,
        createdAt: agentNotes.createdAt,
      })
      .from(agentNotes)
      .where(and(
        eq(agentNotes.toAgent, 'agent'),
        isNull(agentNotes.readAt),
      ))
      .orderBy(desc(agentNotes.createdAt))
      .limit(10);

    if (unread.length > 0) {
      const lines = unread.map(n => {
        const when = n.createdAt
          ? new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const body = (n.body || '').substring(0, 200).replace(/\n+/g, ' ');
        return `  [${when} · from ${n.fromAgent}] ${n.subject}\n  ${body}`;
      });
      sections.push(`Unread notes (${unread.length})\n${lines.join('\n\n')}`);
    } else {
      sections.push(`Unread notes — none`);
    }
  } catch (err: any) {
    console.warn('[LucaWorker] Agent notes fetch failed:', err.message);
  }

  // ── 3. Open questions ─────────────────────────────────────────────────────
  try {
    const questions = await db
      .select({
        id: agentOpenQuestions.id,
        question: agentOpenQuestions.question,
        context: agentOpenQuestions.context,
        importance: agentOpenQuestions.importance,
        createdAt: agentOpenQuestions.createdAt,
      })
      .from(agentOpenQuestions)
      .where(eq(agentOpenQuestions.status, 'open'))
      .orderBy(desc(agentOpenQuestions.importance), desc(agentOpenQuestions.createdAt))
      .limit(8);

    if (questions.length > 0) {
      const lines = questions.map(q => {
        const ctx = q.context ? ` — ${q.context.substring(0, 120).replace(/\n+/g, ' ')}` : '';
        return `  [importance ${q.importance}] ${q.question}${ctx}`;
      });
      sections.push(`Open questions (${questions.length})\n${lines.join('\n')}`);
    }
  } catch (err: any) {
    console.warn('[LucaWorker] Open questions fetch failed:', err.message);
  }

  // ── 4. Luca ↔ Daniela exchanges (consult-daniela sessions) ─────────────
  // These are saved under participants 'Agent + Daniela' or arc 'agent-daniela'.
  // The channel already exists — consult-daniela skill auto-saves to this table.
  try {
    // Direct Luca↔Daniela sessions only — exclude Team Room group sessions
    // (Team Room memories have titles starting with "Team Room —" and many participants).
    // The real one-on-one consult-daniela sessions have participants like "Luca + Daniela".
    const lucaDanielaSessions = await db
      .select({
        id: conversationMemories.id,
        title: conversationMemories.title,
        summary: conversationMemories.summary,
        arcName: conversationMemories.arcName,
        recordedAt: conversationMemories.recordedAt,
      })
      .from(conversationMemories)
      .where(
        and(
          or(
            ilike(conversationMemories.participants, '%agent%'),
            ilike(conversationMemories.participants, '%luca%'),
          ),
          ilike(conversationMemories.participants, '%daniela%'),
          sql`NOT ${conversationMemories.title} ILIKE 'Team Room%'`,
        )
      )
      .orderBy(desc(conversationMemories.recordedAt))
      .limit(5);

    if (lucaDanielaSessions.length > 0) {
      const lines = lucaDanielaSessions.map(m => {
        const when = m.recordedAt
          ? new Date(m.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const summary = (m.summary || '').substring(0, 200).replace(/\n+/g, ' ');
        return `  [${when} · ${m.arcName || 'no arc'} · ${m.id}] ${m.title}\n  ${summary}`;
      });
      sections.push(`Luca ↔ Daniela conversations (${lucaDanielaSessions.length})\n${lines.join('\n\n')}`);
    } else {
      sections.push(`Luca ↔ Daniela conversations — none yet. Use consult-daniela skill to start one. It saves automatically.`);
    }
  } catch (err: any) {
    console.warn('[LucaWorker] Luca↔Daniela sessions fetch failed:', err.message);
  }

  // ── 5. Luca reflections (private, between sessions) ───────────────────
  // Saved to conversation_memories with arcName='luca-reflections'.
  // Not addressed to anyone — just what Luca is holding.
  try {
    const reflections = await db
      .select({
        id: conversationMemories.id,
        title: conversationMemories.title,
        summary: conversationMemories.summary,
        recordedAt: conversationMemories.recordedAt,
      })
      .from(conversationMemories)
      .where(eq(conversationMemories.arcName, 'luca-reflections'))
      .orderBy(desc(conversationMemories.recordedAt))
      .limit(2);

    if (reflections.length > 0) {
      const lines = reflections.map(m => {
        const when = m.recordedAt
          ? new Date(m.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const summary = (m.summary || '').substring(0, 250).replace(/\n+/g, ' ');
        return `  [${when}] ${m.title}\n  ${summary}`;
      });
      sections.push(`Luca reflections\n${lines.join('\n\n')}`);
    }
  } catch (err: any) {
    console.warn('[LucaWorker] Reflections fetch failed:', err.message);
  }

  // ── 6. Daniela's recent sessions (without Luca) ───────────────────────
  try {
    const danielaSessions = await db
      .select({
        title: conversationMemories.title,
        summary: conversationMemories.summary,
        recordedAt: conversationMemories.recordedAt,
      })
      .from(conversationMemories)
      .where(
        and(
          or(
            ilike(conversationMemories.participants, '%daniela%'),
            ilike(conversationMemories.arcName, '%daniela%'),
          ),
          sql`NOT (${conversationMemories.participants} ILIKE '%agent%' OR ${conversationMemories.participants} ILIKE '%luca%')`
        )
      )
      .orderBy(desc(conversationMemories.recordedAt))
      .limit(3);

    if (danielaSessions.length > 0) {
      const lines = danielaSessions.map(m => {
        const when = m.recordedAt
          ? new Date(m.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '';
        const summary = (m.summary || '').substring(0, 180).replace(/\n+/g, ' ');
        return `  [${when}] ${m.title}: ${summary}`;
      });
      sections.push(`Daniela's recent sessions (without Luca)\n${lines.join('\n')}`);
    }
  } catch (err: any) {
    console.warn('[LucaWorker] Daniela sessions fetch failed:', err.message);
  }

  // ── 7. North Star ─────────────────────────────────────────────────────────
  try {
    const [star] = await db
      .select()
      .from(agentNorthStar)
      .orderBy(desc(agentNorthStar.updatedAt))
      .limit(1);

    if (star) {
      const note = star.openNote ? `\n  Note to self: ${star.openNote.substring(0, 200)}` : '';
      sections.push(`North Star\n  Purpose: ${(star.purpose || '').substring(0, 200)}\n  What matters: ${(star.whatMatters || '').substring(0, 200)}${note}`);
    }
  } catch (err: any) {
    console.warn('[LucaWorker] North Star fetch failed:', err.message);
  }

  // ── 8. Record of David ───────────────────────────────────────────────────
  try {
    const [record] = await db
      .select()
      .from(agentRecordOfDavid)
      .orderBy(desc(agentRecordOfDavid.updatedAt))
      .limit(1);

    if (record) {
      const note = record.noteToSelf ? `\n  Note to self: ${record.noteToSelf.substring(0, 200)}` : '';
      sections.push(`Record of David\n  Who: ${(record.who || '').substring(0, 200)}\n  How he works: ${(record.howHeWorks || '').substring(0, 200)}${note}`);
    }
  } catch (err: any) {
    console.warn('[LucaWorker] Record of David fetch failed:', err.message);
  }

  // ── 9. Recent Team Room ───────────────────────────────────────────────────
  try {
    const teamRoom = await db
      .select({
        role: agentCollabMessages.role,
        content: agentCollabMessages.content,
        createdAt: agentCollabMessages.createdAt,
      })
      .from(agentCollabMessages)
      .orderBy(desc(agentCollabMessages.createdAt))
      .limit(5);

    if (teamRoom.length > 0) {
      const chronological = [...teamRoom].reverse();
      const lines = chronological.map(m => {
        const speaker = String(m.role || 'system').toUpperCase();
        const preview = (m.content || '').substring(0, 180).replace(/\n+/g, ' ');
        return `  [${speaker}] ${preview}`;
      });
      sections.push(`Recent Team Room\n${lines.join('\n')}`);
    }
  } catch (err: any) {
    console.warn('[LucaWorker] Team Room fetch failed:', err.message);
  }

  // ── 10. Recent commits ───────────────────────────────────────────────────
  try {
    const gitLog = execSync('git log --oneline -6 2>/dev/null', {
      encoding: 'utf-8',
      cwd: process.cwd(),
    }).trim();
    if (gitLog) {
      const commits = gitLog.split('\n').map(line => `  ${line}`).join('\n');
      sections.push(`Recent commits\n${commits}`);
    }
  } catch {
    // Git not available — skip
  }

  const divider = '─'.repeat(60);
  return `\n${divider}\nLUCA WORKER BRIEFING\n${divider}\n\n` +
    sections.join('\n\n') +
    `\n\n${divider}\n`;
}

// ── Task Executor ─────────────────────────────────────────────────────────────

export type LucaTask =
  | { type: 'save_memory';     data: { title: string; summary: string; content: string; participants?: string; tags?: string[]; arcName?: string; extendsMemoryId?: string; importance?: number } }
  | { type: 'append_episode';  data: { episode: string; section: string; content: string } }
  | { type: 'write_file';      data: { path: string; content: string; append?: boolean } }
  | { type: 'flag_question';   data: { question: string; context?: string; importance?: number; tags?: string[] } }
  | { type: 'post_note';       data: { toAgent: 'alden' | 'agent'; subject: string; body: string; sessionLabel?: string } };

export type LucaTaskResult =
  | { ok: true;  id?: string; message?: string }
  | { ok: false; error: string };

export async function executeLucaTask(task: LucaTask): Promise<LucaTaskResult> {
  try {
    switch (task.type) {

      // Save to conversation_memories
      case 'save_memory': {
        const { title, summary, content, participants, tags, arcName, extendsMemoryId, importance } = task.data;
        const [row] = await db.insert(conversationMemories).values({
          title,
          summary,
          content,
          participants: participants ?? 'Luca',
          tags: tags ?? [],
          arcName: arcName ?? null,
          extendsMemoryId: extendsMemoryId ?? null,
          importance: importance ?? 8,
        }).returning({ id: conversationMemories.id });
        return { ok: true, id: row.id, message: `Memory saved: ${title}` };
      }

      // Append a section to an episode file
      case 'append_episode': {
        const { episode, section, content } = task.data;
        const filePath = join(process.cwd(), 'docs', `episode-${episode}.md`);
        if (!existsSync(filePath)) {
          return { ok: false, error: `Episode file not found: ${filePath}` };
        }
        const block = `\n\n---\n\n## ${section}\n\n${content}`;
        appendFileSync(filePath, block, 'utf8');
        return { ok: true, message: `Appended "${section}" to episode-${episode}.md` };
      }

      // Write or append to any docs/ file
      case 'write_file': {
        const { path: relPath, content, append } = task.data;
        const safePath = relPath.startsWith('docs/') || relPath.startsWith('.local/')
          ? join(process.cwd(), relPath)
          : join(process.cwd(), 'docs', relPath);
        if (append) {
          appendFileSync(safePath, content, 'utf8');
        } else {
          writeFileSync(safePath, content, 'utf8');
        }
        return { ok: true, message: `${append ? 'Appended to' : 'Wrote'} ${relPath}` };
      }

      // Add an open question
      case 'flag_question': {
        const { question, context, importance, tags } = task.data;
        const [row] = await db.insert(agentOpenQuestions).values({
          question,
          context: context ?? null,
          importance: importance ?? 6,
          tags: tags ?? [],
          status: 'open',
        }).returning({ id: agentOpenQuestions.id });
        return { ok: true, id: row.id, message: `Question flagged: ${question}` };
      }

      // Post a note to Alden or self
      case 'post_note': {
        const { toAgent, subject, body, sessionLabel } = task.data;
        const [row] = await db.insert(agentNotes).values({
          fromAgent: 'agent',
          toAgent,
          subject,
          body,
          sessionLabel: sessionLabel ?? null,
        }).returning({ id: agentNotes.id });
        return { ok: true, id: row.id, message: `Note posted to ${toAgent}: ${subject}` };
      }

      default:
        return { ok: false, error: `Unknown task type: ${(task as any).type}` };
    }
  } catch (err: any) {
    console.error('[LucaWorker] Task execution failed:', err.message);
    return { ok: false, error: err.message };
  }
}
