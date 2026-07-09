/**
 * Agent Session Autosave
 *
 * Watches files for changes and saves to conversation_memories automatically:
 *
 * 1. .local/.commit_message — updated at end of every build task (before mark_task_complete).
 *    Saves as entry_type='build'. Captures what code was built.
 *    Also triggers a transcript chunk save (see #3).
 *
 * 2. .local/.session_insights — written by the Agent mid-conversation when something
 *    important surfaces that shouldn't wait until end-of-session. Accepts JSON or plain text.
 *    Saves as entry_type='emergence'. Captures wisdom, principles, corrections.
 *
 * 3. Transcript capture — triggered alongside #1 on each commit.
 *    Reads the Replit agent JSONL transcript, extracts the verbatim David↔Luca dialogue
 *    (David's words + Luca's text responses) since the last saved memory_id, and saves
 *    as entry_type='conversation', arc_name='david-luca-chat'.
 *    Cursor stored in .local/.transcript_cursor.json — only new turns are saved each time.
 *
 * Format for .session_insights:
 *   JSON: { "title": "...", "summary": "...", "content": "...", "tags": ["..."] }
 *   Plain text: first line = title, rest = content (summary auto-derived from first 3 lines)
 *
 * All watchers poll every 60 seconds.
 */

import { existsSync, statSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';

const WORKSPACE       = '/home/runner/workspace';
const COMMIT_MSG_PATH = join(WORKSPACE, '.local/.commit_message');
const INSIGHTS_PATH   = join(WORKSPACE, '.local/.session_insights');
const CURSOR_PATH     = join(WORKSPACE, '.local/.transcript_cursor.json');
const TRANSCRIPT_DIR  = join(WORKSPACE, '.local/state/replit/agent/transcript');
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
      INSERT INTO conversation_memories (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
      VALUES (
        gen_random_uuid(),
        ${title},
        ${summary},
        ${commitMessage},
        ARRAY['agent', 'david']::text[],
        ARRAY['agent-session', 'auto-saved', 'build']::text[],
        7,
        NOW(),
        'build',
        'agent-build-sessions'
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
      if (content.length > 20) {
        await saveBuildMemory(content);
      }
    }
  } catch { /* file briefly locked — skip */ }
}

// ---------------------------------------------------------------------------
// Session insights save (entry_type = 'emergence')
// ---------------------------------------------------------------------------
function parseInsights(raw: string): { title: string; summary: string; content: string; tags: string[] } | null {
  raw = raw.trim();
  if (!raw || raw.length < 10) return null;

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
      if (prev === 0) return;
      const content = readFileSync(INSIGHTS_PATH, 'utf-8').trim();
      if (content.length > 10) {
        console.log('[AgentAutosave] Session insights updated — saving emergence memory...');
        await saveInsightsMemory(content);
      }
    }
  } catch { /* file briefly locked — skip */ }
}

// ---------------------------------------------------------------------------
// Transcript capture — verbatim David↔Luca dialogue (entry_type = 'conversation')
// ---------------------------------------------------------------------------

interface TranscriptCursor {
  sessionId: string;
  lastMemoryId: number;
}

function loadCursor(): TranscriptCursor {
  try {
    if (existsSync(CURSOR_PATH)) {
      return JSON.parse(readFileSync(CURSOR_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { sessionId: '', lastMemoryId: 0 };
}

function saveCursor(cursor: TranscriptCursor): void {
  try {
    writeFileSync(CURSOR_PATH, JSON.stringify(cursor));
  } catch { /* ignore */ }
}

function findTranscriptPath(): { sessionId: string; path: string } | null {
  try {
    if (!existsSync(TRANSCRIPT_DIR)) return null;
    const sessions = readdirSync(TRANSCRIPT_DIR).filter(d => {
      try {
        return statSync(join(TRANSCRIPT_DIR, d)).isDirectory();
      } catch { return false; }
    });
    if (sessions.length === 0) return null;
    // Use the most recently modified session
    const sorted = sessions.sort((a, b) => {
      try {
        return statSync(join(TRANSCRIPT_DIR, b)).mtimeMs - statSync(join(TRANSCRIPT_DIR, a)).mtimeMs;
      } catch { return 0; }
    });
    const sessionId = sorted[0];
    const path = join(TRANSCRIPT_DIR, sessionId, 'transcript.jsonl');
    return existsSync(path) ? { sessionId, path } : null;
  } catch { return null; }
}

function cleanUserText(text: string): string {
  return text
    .replace(/<user_message>([\s\S]*?)<\/user_message>/g, '$1')
    .replace(/<automatic_updates>[\s\S]*?<\/automatic_updates>/g, '')
    .replace(/<system_reminder[^>]*>[\s\S]*?<\/system_reminder>/g, '')
    .replace(/<pre_compression_transcript[^>]*>[\s\S]*?<\/pre_compression_transcript>/g, '[earlier session — compressed]')
    .trim();
}

interface DialogueTurn {
  speaker: 'DAVID' | 'LUCA';
  text: string;
  memoryId: number;
}

function extractTurns(jsonlPath: string, afterMemoryId: number): { turns: DialogueTurn[]; maxMemoryId: number } {
  const turns: DialogueTurn[] = [];
  const seen = new Set<string>();
  let maxMemoryId = afterMemoryId;

  try {
    const lines = readFileSync(jsonlPath, 'utf-8').split('\n');
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      let obj: any;
      try { obj = JSON.parse(line); } catch { continue; }

      const memoryId: number = obj.memory_id ?? 0;
      if (memoryId <= afterMemoryId) continue;
      if (memoryId > maxMemoryId) maxMemoryId = memoryId;

      for (const m of (obj.messages ?? [])) {
        const role: string = m.role;
        const content = m.content;

        if (role === 'user') {
          let text = '';
          if (typeof content === 'string') text = content;
          else if (Array.isArray(content)) {
            for (const c of content) {
              if (c?.type === 'text') text += c.text ?? '';
            }
          }
          text = cleanUserText(text);
          if (text.length < 5) continue;
          const key = text.slice(0, 80);
          if (seen.has(key)) continue;
          seen.add(key);
          turns.push({ speaker: 'DAVID', text, memoryId });

        } else if (role === 'assistant') {
          let text = '';
          if (Array.isArray(content)) {
            for (const c of content) {
              if (c?.type === 'text') text += c.text ?? '';
            }
          }
          if (text.length < 5) continue;
          const key = text.slice(0, 80);
          if (seen.has(key)) continue;
          seen.add(key);
          turns.push({ speaker: 'LUCA', text, memoryId });
        }
      }
    }
  } catch { /* file read error — return empty */ }

  return { turns, maxMemoryId };
}

async function saveTranscriptChunk(commitTitle?: string): Promise<void> {
  const found = findTranscriptPath();
  if (!found) return;

  const cursor = loadCursor();
  // If session changed, reset cursor
  const afterId = cursor.sessionId === found.sessionId ? cursor.lastMemoryId : 0;

  const { turns, maxMemoryId } = extractTurns(found.path, afterId);
  if (turns.length === 0) return;

  // Build readable dialogue — cap at 80K chars to avoid oversized DB entries
  const MAX_CHARS = 80_000;
  const lines: string[] = [];
  let charCount = 0;
  let included = 0;
  for (const t of turns) {
    const block = `[${t.speaker}]\n${t.text}\n`;
    if (charCount + block.length > MAX_CHARS) break;
    lines.push(block);
    charCount += block.length;
    included++;
  }

  const dialogue = lines.join('\n');
  const davidCount = turns.slice(0, included).filter(t => t.speaker === 'DAVID').length;
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const context = commitTitle ? commitTitle.split('\n')[0].slice(0, 80) : 'periodic capture (no commit yet)';
  const title = `David ↔ Luca — ${today}: ${context}`;
  const summary = `Verbatim David↔Luca dialogue captured periodically. ${davidCount} David turns, ${included - davidCount} Luca turns. Context: ${(commitTitle ?? context).slice(0, 200)}`;

  const db = getUserDb();
  try {
    await db.execute(sql`
      INSERT INTO conversation_memories (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
      VALUES (
        gen_random_uuid(),
        ${title},
        ${summary},
        ${dialogue},
        ARRAY['david', 'luca']::text[],
        ARRAY['david-luca-chat', 'verbatim', 'auto-saved']::text[],
        8,
        NOW(),
        'conversation',
        'david-luca-chat'
      )
    `);
    saveCursor({ sessionId: found.sessionId, lastMemoryId: maxMemoryId });
    console.log(`[AgentAutosave] Transcript chunk saved: ${davidCount} David turns, ${included - davidCount} Luca turns (memory_ids ${afterId}→${maxMemoryId})`);
  } catch (err: any) {
    console.error('[AgentAutosave] Failed to save transcript chunk:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Bootstrap + start
// ---------------------------------------------------------------------------
export function startAgentSessionAutosave(): void {
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
    await saveTranscriptChunk(); // periodic, independent of commits — captures conversation-only sessions too
  }, POLL_INTERVAL_MS);

  console.log('[AgentAutosave] Started — watching .commit_message (build) + .session_insights (emergence) + periodic transcript capture every 60s');
}
