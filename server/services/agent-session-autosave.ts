/**
 * Agent Session Autosave
 *
 * Monitors .local/.commit_message for changes. When the file is updated
 * (which the Agent does at the end of every task before calling mark_task_complete),
 * this worker automatically saves the session to conversation_memories.
 *
 * This gives the Agent the same memory continuity as Daniela — every session
 * is persisted without the Agent needing to manually call POST /api/conversation-memories.
 *
 * Polls every 60 seconds. On first boot, records the current mtime but does NOT save
 * (avoids double-saving old commit messages on restart).
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';

const COMMIT_MSG_PATH = join('/home/runner/workspace', '.local/.commit_message');
const POLL_INTERVAL_MS = 60 * 1000;

let lastMtime = 0;
let lastSavedContent = '';

async function saveSessionMemory(commitMessage: string): Promise<void> {
  if (commitMessage === lastSavedContent) return;
  lastSavedContent = commitMessage;

  const db = getUserDb();
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // First line of commit message is the title; rest is the full session log
  const lines = commitMessage.trim().split('\n');
  const title = `Agent Session — ${today}: ${lines[0].slice(0, 120)}`;
  const summary = lines.slice(0, 5).join(' ').slice(0, 400);

  try {
    await db.execute(sql`
      INSERT INTO conversation_memories (id, title, summary, content, participants, tags, importance, created_at, entry_type)
      VALUES (
        gen_random_uuid(),
        ${title},
        ${summary},
        ${commitMessage},
        ARRAY['agent', 'david']::text[],
        ARRAY['agent-session', 'auto-saved', 'build']::text[],
        7,
        NOW(),
        'build'
      )
    `);
    console.log('[AgentAutosave] Session committed to conversation_memories:', title.slice(0, 80));
  } catch (err: any) {
    console.error('[AgentAutosave] Failed to save session memory:', err.message);
  }
}

async function checkForNewSession(): Promise<void> {
  if (!existsSync(COMMIT_MSG_PATH)) return;

  try {
    const stat = statSync(COMMIT_MSG_PATH);
    const mtime = stat.mtimeMs;

    if (mtime > lastMtime) {
      const previousMtime = lastMtime;
      lastMtime = mtime;

      // Skip the initial read on startup (lastMtime was 0 → set it, don't save old content)
      if (previousMtime === 0) return;

      const content = readFileSync(COMMIT_MSG_PATH, 'utf-8').trim();
      if (content.length > 20) {
        console.log('[AgentAutosave] Commit message updated — autosaving session...');
        await saveSessionMemory(content);
      }
    }
  } catch {
    // File may be briefly locked during write — skip this poll cycle
  }
}

export function startAgentSessionAutosave(): void {
  // Capture current mtime without saving (don't double-save on restart)
  if (existsSync(COMMIT_MSG_PATH)) {
    try {
      lastMtime = statSync(COMMIT_MSG_PATH).mtimeMs;
      const existing = readFileSync(COMMIT_MSG_PATH, 'utf-8').trim();
      lastSavedContent = existing;
    } catch { /* ignore */ }
  }

  setInterval(checkForNewSession, POLL_INTERVAL_MS);
  console.log('[AgentAutosave] Started — polling .local/.commit_message every 60s for session changes');
}
