/**
 * Agent Session Autosave
 *
 * Watches two files for changes and saves to conversation_memories automatically:
 *
 * 1. .local/.commit_message — updated at end of every build task (before mark_task_complete).
 *    Saves as entry_type='build'. Captures what code was built.
 *
 * 2. .local/.session_insights — written by the Agent mid-conversation when something
 *    important surfaces that shouldn't wait until end-of-session. Accepts JSON or plain text.
 *    Saves as entry_type='emergence'. Captures wisdom, principles, corrections.
 *
 * Format for .session_insights:
 *   JSON: { "title": "...", "summary": "...", "content": "...", "tags": ["..."] }
 *   Plain text: first line = title, rest = content (summary auto-derived from first 3 lines)
 *
 * Both watchers poll every 60 seconds. On first boot, mtime is recorded but nothing is
 * saved (avoids double-saving on restart). File is NOT cleared after save — mtime + content
 * deduplication prevents re-saving the same insight twice.
 */

import { existsSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';

const WORKSPACE = '/home/runner/workspace';
const COMMIT_MSG_PATH = join(WORKSPACE, '.local/.commit_message');
const INSIGHTS_PATH   = join(WORKSPACE, '.local/.session_insights');
const POLL_INTERVAL_MS = 60 * 1000;

// --- Build session watcher state ---
let buildLastMtime = 0;
let buildLastSavedContent = '';

// --- Session insights watcher state ---
let insightsLastMtime = 0;
let insightsLastSavedContent = '';

// ---------------------------------------------------------------------------
// Build session save (entry_type = 'build')
// ---------------------------------------------------------------------------
async function saveBuildMemory(commitMessage: string): Promise<void> {
  if (commitMessage === buildLastSavedContent) return;
  buildLastSavedContent = commitMessage;

  const db = getUserDb();
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const lines = commitMessage.trim().split('\n');
  const title   = `Agent Session — ${today}: ${lines[0].slice(0, 120)}`;
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
    console.log('[AgentAutosave] Build session saved:', title.slice(0, 80));
  } catch (err: any) {
    console.error('[AgentAutosave] Failed to save build memory:', err.message);
  }
}

async function checkBuildSession(): Promise<void> {
  if (!existsSync(COMMIT_MSG_PATH)) return;
  try {
    const stat = statSync(COMMIT_MSG_PATH);
    const mtime = stat.mtimeMs;
    if (mtime > buildLastMtime) {
      const prev = buildLastMtime;
      buildLastMtime = mtime;
      if (prev === 0) return; // skip initial read on startup
      const content = readFileSync(COMMIT_MSG_PATH, 'utf-8').trim();
      if (content.length > 20) await saveBuildMemory(content);
    }
  } catch { /* file briefly locked — skip */ }
}

// ---------------------------------------------------------------------------
// Session insights save (entry_type = 'emergence')
// ---------------------------------------------------------------------------
function parseInsights(raw: string): { title: string; summary: string; content: string; tags: string[] } | null {
  raw = raw.trim();
  if (!raw || raw.length < 10) return null;

  // Try JSON first
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      if (!parsed.title || !parsed.content) return null;
      return {
        title:   parsed.title.slice(0, 200),
        summary: (parsed.summary || parsed.content.slice(0, 400)).slice(0, 400),
        content: parsed.content,
        tags:    Array.isArray(parsed.tags) ? parsed.tags : ['emergence', 'auto-saved'],
      };
    } catch { /* fall through to plain text */ }
  }

  // Plain text: first line = title, rest = content
  const lines = raw.split('\n');
  const title   = lines[0].slice(0, 200);
  const content = lines.slice(1).join('\n').trim() || raw;
  const summary = lines.slice(0, 4).join(' ').slice(0, 400);
  return { title, summary, content, tags: ['emergence', 'auto-saved', 'conversation'] };
}

async function saveInsightsMemory(raw: string): Promise<void> {
  if (raw === insightsLastSavedContent) return;
  insightsLastSavedContent = raw;

  const parsed = parseInsights(raw);
  if (!parsed) return;

  const db = getUserDb();
  try {
    await db.execute(sql`
      INSERT INTO conversation_memories (id, title, summary, content, participants, tags, importance, created_at, entry_type)
      VALUES (
        gen_random_uuid(),
        ${parsed.title},
        ${parsed.summary},
        ${parsed.content},
        ARRAY['agent', 'david']::text[],
        ${parsed.tags}::text[],
        8,
        NOW(),
        'emergence'
      )
    `);
    console.log('[AgentAutosave] Session insight saved:', parsed.title.slice(0, 80));
  } catch (err: any) {
    console.error('[AgentAutosave] Failed to save insight memory:', err.message);
  }
}

async function checkSessionInsights(): Promise<void> {
  if (!existsSync(INSIGHTS_PATH)) return;
  try {
    const stat = statSync(INSIGHTS_PATH);
    const mtime = stat.mtimeMs;
    if (mtime > insightsLastMtime) {
      const prev = insightsLastMtime;
      insightsLastMtime = mtime;
      if (prev === 0) return; // skip initial read on startup
      const content = readFileSync(INSIGHTS_PATH, 'utf-8').trim();
      if (content.length > 10) {
        console.log('[AgentAutosave] Session insights updated — saving emergence memory...');
        await saveInsightsMemory(content);
      }
    }
  } catch { /* file briefly locked — skip */ }
}

// ---------------------------------------------------------------------------
// Bootstrap + start
// ---------------------------------------------------------------------------
export function startAgentSessionAutosave(): void {
  // Capture current mtimes without saving (don't double-save on restart)
  if (existsSync(COMMIT_MSG_PATH)) {
    try {
      buildLastMtime = statSync(COMMIT_MSG_PATH).mtimeMs;
      buildLastSavedContent = readFileSync(COMMIT_MSG_PATH, 'utf-8').trim();
    } catch { /* ignore */ }
  }
  if (existsSync(INSIGHTS_PATH)) {
    try {
      insightsLastMtime = statSync(INSIGHTS_PATH).mtimeMs;
      insightsLastSavedContent = readFileSync(INSIGHTS_PATH, 'utf-8').trim();
    } catch { /* ignore */ }
  }

  setInterval(async () => {
    await checkBuildSession();
    await checkSessionInsights();
  }, POLL_INTERVAL_MS);

  console.log('[AgentAutosave] Started — watching .commit_message (build) + .session_insights (emergence) every 60s');
}
