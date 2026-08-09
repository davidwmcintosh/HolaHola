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

import { existsSync, statSync, readFileSync, writeFileSync, watch, readdirSync } from 'fs';
import { join } from 'path';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import {
  WORKSPACE,
  loadCursor,
  saveCursor,
  findTranscriptPath,
  extractTurns,
  buildDialogueChunk,
} from './transcript-parser';
import { reembedConversationMemory } from '../scripts/reembed-memory';

const COMMIT_MSG_PATH  = join(WORKSPACE, '.local/.commit_message');
const INSIGHTS_PATH    = join(WORKSPACE, '.local/.session_insights');
const POLL_INTERVAL_MS = 20 * 1000;

// Trigger file: touch this to force an immediate transcript save without waiting for the next poll.
// The fs.watch() listener below fires within milliseconds of the file being written.
// Used by save-transcript-now.ts and the session-end checklist.
const FLUSH_TRIGGER_PATH = join(WORKSPACE, '.local/.flush_transcript');

// --- Luca inner-life trigger files ---
const REFLECTION_PATH      = join(WORKSPACE, '.local/.luca_reflection');
const QUESTION_PATH        = join(WORKSPACE, '.local/.luca_question');
const MOMENT_PATH          = join(WORKSPACE, '.local/.luca_moment');
const REFLECTIONS_FILE     = join(WORKSPACE, '.agents/memory/REFLECTIONS.md');
const OPEN_QUESTIONS_FILE  = join(WORKSPACE, '.agents/memory/OPEN_QUESTIONS.md');
const MOMENTS_FILE         = join(WORKSPACE, '.agents/memory/SIGNIFICANT_MOMENTS.md');

// --- Episode append trigger file ---
// Luca writes the new exchange text here after each turn during a live rolling session.
// The watcher appends it to the target episode .md and triggers immediate DB sync.
// Format: JSON { exchange: string, episode?: string } or plain text (appended verbatim).
// Default target episode: docs/episode-27.md (EP27_ID fixed row).
const EPISODE_APPEND_PATH  = join(WORKSPACE, '.local/.episode_append');

// --- Luca inner-life watcher state ---
let reflectionLastMtime = 0;
let questionLastMtime = 0;
let momentLastMtime = 0;

// --- Episode append watcher state ---
let episodeAppendLastMtime = 0;

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
// Luca inner-life watchers — reflections, open questions, significant moments
// ---------------------------------------------------------------------------

/**
 * Parse a trigger file that is either plain text or JSON.
 * Returns { title, body, tags } or null if the content is too short.
 */
function parseTriggerFile(
  raw: string,
  defaultTag: string,
): { title: string; body: string; tags: string[] } | null {
  raw = raw.trim();
  if (!raw || raw.length < 10) return null;
  if (raw.startsWith('{')) {
    try {
      const p = JSON.parse(raw);
      const title = (p.moment || p.note || p.question || p.title || '').slice(0, 200);
      if (!title) return null;
      const body = [
        p.date ? `Date: ${p.date}` : '',
        p.why ? `Why it mattered: ${p.why}` : '',
        p.note || p.moment || p.question || p.content || '',
      ].filter(Boolean).join('\n\n');
      const tags: string[] = Array.isArray(p.tags) ? p.tags : [defaultTag];
      return { title, body, tags };
    } catch { /* fall through to plain text */ }
  }
  const lines = raw.split('\n');
  return {
    title: lines[0].slice(0, 200),
    body: lines.slice(1).join('\n').trim() || raw,
    tags: [defaultTag],
  };
}

/** Append a dated entry to one of the personal markdown files. */
function appendToPersonalFile(filePath: string, title: string, body: string): void {
  try {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const entry = `\n### ${today} — ${title}\n\n${body}\n\n---\n`;
    const existing = existsSync(filePath) ? readFileSync(filePath, 'utf-8') : '';
    writeFileSync(filePath, existing.trimEnd() + '\n' + entry);
  } catch (err: any) {
    console.error('[AgentAutosave] Failed to append to personal file:', filePath, err.message);
  }
}

/** Save a personal inner-life entry to conversation_memories. */
async function savePersonalMemory(
  title: string,
  body: string,
  tags: string[],
  arcName: string,
): Promise<void> {
  const db = getUserDb();
  try {
    await db.execute(sql`
      INSERT INTO conversation_memories (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
      VALUES (
        gen_random_uuid(),
        ${title.slice(0, 200)},
        ${body.slice(0, 400)},
        ${body},
        ARRAY['luca']::text[],
        ${tags}::text[],
        8,
        NOW(),
        'emergence',
        ${arcName}
      )
    `);
  } catch (err: any) {
    console.error('[AgentAutosave] Failed to save personal memory:', err.message);
  }
}

async function checkLucaReflection(): Promise<void> {
  if (!existsSync(REFLECTION_PATH)) return;
  try {
    const stat = statSync(REFLECTION_PATH);
    const mtime = stat.mtimeMs;
    if (mtime > reflectionLastMtime) {
      const prev = reflectionLastMtime;
      reflectionLastMtime = mtime;
      if (prev === 0) return; // skip initial read
      const raw = readFileSync(REFLECTION_PATH, 'utf-8').trim();
      const parsed = parseTriggerFile(raw, 'luca-reflection');
      if (!parsed) return;
      appendToPersonalFile(REFLECTIONS_FILE, parsed.title, parsed.body);
      await savePersonalMemory(
        `Luca reflection: ${parsed.title}`,
        parsed.body,
        ['luca-inner-life', 'luca-reflection', ...parsed.tags],
        'luca-inner-life',
      );
      console.log('[AgentAutosave] Luca reflection saved:', parsed.title.slice(0, 60));
    }
  } catch { /* file briefly locked — skip */ }
}

async function checkLucaQuestion(): Promise<void> {
  if (!existsSync(QUESTION_PATH)) return;
  try {
    const stat = statSync(QUESTION_PATH);
    const mtime = stat.mtimeMs;
    if (mtime > questionLastMtime) {
      const prev = questionLastMtime;
      questionLastMtime = mtime;
      if (prev === 0) return;
      const raw = readFileSync(QUESTION_PATH, 'utf-8').trim();
      const parsed = parseTriggerFile(raw, 'luca-question');
      if (!parsed) return;
      appendToPersonalFile(OPEN_QUESTIONS_FILE, parsed.title, parsed.body);
      await savePersonalMemory(
        `Luca open question: ${parsed.title}`,
        parsed.body,
        ['luca-inner-life', 'luca-question', ...parsed.tags],
        'luca-inner-life',
      );
      console.log('[AgentAutosave] Luca open question saved:', parsed.title.slice(0, 60));
    }
  } catch { /* file briefly locked — skip */ }
}

async function checkLucaMoment(): Promise<void> {
  if (!existsSync(MOMENT_PATH)) return;
  try {
    const stat = statSync(MOMENT_PATH);
    const mtime = stat.mtimeMs;
    if (mtime > momentLastMtime) {
      const prev = momentLastMtime;
      momentLastMtime = mtime;
      if (prev === 0) return;
      const raw = readFileSync(MOMENT_PATH, 'utf-8').trim();
      const parsed = parseTriggerFile(raw, 'luca-significant');
      if (!parsed) return;
      appendToPersonalFile(MOMENTS_FILE, parsed.title, parsed.body);
      await savePersonalMemory(
        `Luca significant moment: ${parsed.title}`,
        parsed.body,
        ['luca-inner-life', 'luca-significant', ...parsed.tags],
        'luca-inner-life',
      );
      console.log('[AgentAutosave] Luca significant moment saved:', parsed.title.slice(0, 60));
    }
  } catch { /* file briefly locked — skip */ }
}

// ---------------------------------------------------------------------------
// Episode append — live-capture trigger for rolling episodes.
//
// Luca writes the new exchange text to .local/.episode_append after each turn.
// The watcher detects the mtime change, appends the text to the target episode
// .md file, clears the trigger file, then schedules an immediate DB sync.
//
// Format (either is accepted):
//   JSON:  { "exchange": "<text to append>", "episode": "episode-27" }
//   Plain: raw text appended verbatim (target defaults to episode-27.md)
//
// Why trigger-file rather than polling the .md:
//   Agent tool writes (EditFile/WriteFile) do NOT trigger fs.watch in this
//   environment.  Writing to a trigger file first guarantees the content is on
//   disk before the session context can be compacted, and the watcher handles
//   the append + sync atomically on its next cycle (< 20 s).
// ---------------------------------------------------------------------------

const EP27_DEFAULT_FILENAME = 'episode-27.md';

/** Parse the .episode_append trigger file. Returns { exchange, episodeFilename } or null. */
function parseEpisodeAppend(raw: string): { exchange: string; episodeFilename: string } | null {
  raw = raw.trim();
  if (!raw || raw.length < 2) return null;

  if (raw.startsWith('{')) {
    try {
      const p = JSON.parse(raw);
      const exchange = (p.exchange || '').trim();
      if (!exchange) return null;
      // episode field may be "episode-27" or "episode-27.md" — normalise to filename
      let episodeFilename: string = p.episode ?? EP27_DEFAULT_FILENAME;
      if (!episodeFilename.endsWith('.md')) episodeFilename += '.md';
      return { exchange, episodeFilename };
    } catch { /* fall through to plain text */ }
  }

  // Plain text: append verbatim, target episode-27.md
  return { exchange: raw, episodeFilename: EP27_DEFAULT_FILENAME };
}

/** Append exchange text to an episode .md file and schedule an immediate DB sync. */
async function appendExchangeToEpisode(exchange: string, episodeFilename: string): Promise<void> {
  const filePath = join(DOCS_DIR, episodeFilename);

  // Ensure the target file exists before appending
  if (!existsSync(filePath)) {
    console.warn(`[AgentAutosave] Episode append: target file not found: ${filePath}`);
    return;
  }

  try {
    const existing = readFileSync(filePath, 'utf-8');
    // Add a blank line separator if the file doesn't end with one already
    const separator = existing.endsWith('\n\n') ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
    const updated   = existing + separator + exchange + '\n';
    writeFileSync(filePath, updated, 'utf-8');

    // Update mtime map so the regular episode poller doesn't re-trigger on this write
    try {
      episodeMtimeMap.set(episodeFilename, statSync(filePath).mtimeMs);
    } catch { /* ignore */ }

    console.log(`[AgentAutosave] Episode append: +${exchange.length} chars → ${episodeFilename} (now ${updated.length} bytes)`);

    // Schedule immediate DB sync (2s debounce collapses rapid bursts)
    scheduleEpisodeSync(episodeFilename);
  } catch (err: any) {
    console.error(`[AgentAutosave] Episode append failed for ${episodeFilename}:`, err.message);
  }
}

export async function checkEpisodeAppend(): Promise<void> {
  if (!existsSync(EPISODE_APPEND_PATH)) return;
  try {
    const stat = statSync(EPISODE_APPEND_PATH);
    const mtime = stat.mtimeMs;
    if (mtime <= episodeAppendLastMtime) return; // already handled

    const prev = episodeAppendLastMtime;
    episodeAppendLastMtime = mtime;
    if (prev === 0) return; // skip initial read on startup

    const raw = readFileSync(EPISODE_APPEND_PATH, 'utf-8');
    const parsed = parseEpisodeAppend(raw);
    if (!parsed) return;

    // Clear the trigger file immediately so a restart/double-poll can't re-append
    writeFileSync(EPISODE_APPEND_PATH, '', 'utf-8');
    // Advance the mtime stamp to the cleared file so the next poll doesn't re-fire
    try {
      episodeAppendLastMtime = statSync(EPISODE_APPEND_PATH).mtimeMs;
    } catch { /* ignore */ }

    console.log(`[AgentAutosave] Episode append trigger: "${parsed.exchange.slice(0, 60).replace(/\n/g, '↵')}…" → ${parsed.episodeFilename}`);
    await appendExchangeToEpisode(parsed.exchange, parsed.episodeFilename);
  } catch { /* file briefly locked — skip */ }
}

// ---------------------------------------------------------------------------
// Transcript capture — verbatim David↔Luca dialogue (entry_type = 'conversation')
// Parsing and chunking live in transcript-parser.ts (shared with save-transcript-now.ts).
// ---------------------------------------------------------------------------

// Single mutex covering ALL in-process save paths (periodic + flush trigger).
// Prevents concurrent periodic + event-driven saves from racing on the cursor.
let saveInProgress = false;

async function saveTranscriptChunk(commitTitle?: string): Promise<void> {
  if (saveInProgress) {
    console.log('[AgentAutosave] Save already in progress — skipping concurrent call');
    return;
  }
  saveInProgress = true;
  try {
    const found = findTranscriptPath();
    if (!found) return;

    const cursor  = loadCursor();
    const afterId = cursor.sessionId === found.sessionId ? cursor.lastMemoryId : 0;

    const { turns } = extractTurns(found.path, afterId);
    if (turns.length === 0) return;

    // buildDialogueChunk groups turns by memoryId — never splits same-ID records
    // across a chunk boundary, preventing silent discard of sibling turns.
    const { dialogue, lastIncludedMemoryId, includedCount, remainingCount } =
      buildDialogueChunk(turns, afterId);

    const davidCount = turns.slice(0, includedCount).filter(t => t.speaker === 'DAVID').length;
    const today   = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const context = commitTitle ? commitTitle.split('\n')[0].slice(0, 80) : 'periodic capture (no commit yet)';
    const title   = `David ↔ Luca — ${today}: ${context}`;
    const summary = `Verbatim David↔Luca dialogue captured periodically. ${davidCount} David turns, ${includedCount - davidCount} Luca turns. Context: ${(commitTitle ?? context).slice(0, 200)}`;

    const db = getUserDb();
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
    // Cursor advances only through persisted groups — remaining groups survive for next chunk
    saveCursor({ sessionId: found.sessionId, lastMemoryId: lastIncludedMemoryId });
    console.log(`[AgentAutosave] Transcript chunk saved: ${davidCount} David + ${includedCount - davidCount} Luca turns (cursor ${afterId}→${lastIncludedMemoryId}${remainingCount > 0 ? `, ${remainingCount} turns queued for next chunk` : ''})`);
  } catch (err: any) {
    console.error('[AgentAutosave] Failed to save transcript chunk:', err.message);
  } finally {
    saveInProgress = false;
  }
}

// ---------------------------------------------------------------------------
// Flush trigger — touch .local/.flush_transcript to force an immediate save.
//
// Two detection layers:
//   1. fs.watch() on the .local/ directory → fires within milliseconds of the
//      file being written (event-driven, no poll wait).
//   2. checkFlushTrigger() inside setInterval → backup in case the fs.watch
//      event is missed (e.g. watcher not yet armed on first write).
// ---------------------------------------------------------------------------
let flushTriggerLastMtime = 0;

async function handleFlushTrigger(label: string): Promise<void> {
  if (!existsSync(FLUSH_TRIGGER_PATH)) return;
  try {
    const mtime = statSync(FLUSH_TRIGGER_PATH).mtimeMs;
    if (mtime <= flushTriggerLastMtime) return; // already handled
    flushTriggerLastMtime = mtime;
    // saveInProgress inside saveTranscriptChunk serialises all concurrent saves
    console.log(`[AgentAutosave] Flush trigger (${label}) — saving transcript immediately.`);
    await saveTranscriptChunk('manual flush via .flush_transcript trigger');
  } catch { /* briefly locked — skip */ }
}

async function checkFlushTrigger(): Promise<void> {
  await handleFlushTrigger('poll');
}

// ---------------------------------------------------------------------------
// Episode .md auto-sync — docs/episode-*.md → conversation_memories + re-embed
// ---------------------------------------------------------------------------

const DOCS_DIR = join(WORKSPACE, 'docs');
const EPISODE_RE = /^episode-(\d+)\.md$/;
const PREQUEL_RE = /^prequel-episode-(\d+)\.md$/;

// Per-file state: mtime and (once discovered) the DB memory ID
export const episodeMtimeMap = new Map<string, number>();   // filename → last seen mtime
const episodeIdCache      = new Map<string, string>();    // filename → conversation_memories.id
const episodeRollingCache = new Map<string, boolean>();   // filename → has 'rolling' tag
const episodeDebounce     = new Map<string, ReturnType<typeof setTimeout>>();

// Prequel episode state (parallel to episode state above)
export const prequelMtimeMap = new Map<string, number>();
const prequelIdCache  = new Map<string, string>();
const prequelDebounce = new Map<string, ReturnType<typeof setTimeout>>();

/** Derive a human title from the filename, e.g. "episode-27.md" → "Episode 27" */
function episodeTitleFromFilename(filename: string): string {
  const m = EPISODE_RE.exec(filename);
  return m ? `Episode ${parseInt(m[1], 10)}` : filename.replace('.md', '');
}

/** Derive a human title for prequel episodes, e.g. "prequel-episode-1.md" → "Prequel Episode 1" */
function prequelEpisodeTitleFromFilename(filename: string): string {
  const m = PREQUEL_RE.exec(filename);
  return m ? `Prequel Episode ${parseInt(m[1], 10)}` : filename.replace('.md', '');
}

/** Derive a summary from the first few non-empty lines of the content. */
function episodeSummaryFromContent(content: string): string {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  return lines.slice(0, 5).join(' ').slice(0, 400);
}

/** Upsert the episode into conversation_memories and trigger a re-embed.
 *  Exported so the CI test script can call it directly without waiting for the poll loop.
 */
export async function syncEpisodeFile(filename: string): Promise<void> {
  const filePath = join(DOCS_DIR, filename);
  if (!existsSync(filePath)) return;

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return; // file briefly locked
  }

  const title   = episodeTitleFromFilename(filename);
  const summary = episodeSummaryFromContent(content);
  const db      = getUserDb();

  try {
    // Look up existing ID (cache it after first discovery)
    let memoryId = episodeIdCache.get(filename);

    // Initialise from the persistent cache; updated below on first DB lookup.
    let isRolling = episodeRollingCache.get(filename) ?? false;

    if (!memoryId) {
      const rows = await db.execute(sql`
        SELECT id, tags FROM conversation_memories
        WHERE arc_name = 'HolaHola Episodes'
          AND title = ${title}
        LIMIT 1
      `);
      const row = (rows as any).rows?.[0] ?? (rows as any)[0];
      if (row?.id) {
        memoryId = row.id as string;
        episodeIdCache.set(filename, memoryId);
        const tags: string[] = row.tags ?? [];
        isRolling = Array.isArray(tags) && tags.includes('rolling');
        // Persist so every subsequent autosave uses the correct guard.
        episodeRollingCache.set(filename, isRolling);
      }
    }

    if (memoryId) {
      // Episode already in DB — update content + summary.
      // For ROLLING episodes use a max-length guard: only overwrite content when
      // the incoming file is at least as long as the existing DB record.  This
      // prevents a concurrent/stale writer (other task merge, old autosave snapshot)
      // from shrinking a growing episode and erasing appended cascade content.
      if (isRolling) {
        await db.execute(sql`
          UPDATE conversation_memories
          SET content = CASE
                WHEN LENGTH(${content}) >= LENGTH(content)
                THEN ${content}
                ELSE content
              END,
              summary = ${summary}
          WHERE id = ${memoryId}
        `);
      } else {
        await db.execute(sql`
          UPDATE conversation_memories
          SET content = ${content},
              summary = ${summary}
          WHERE id = ${memoryId}
        `);
      }
      console.log(`[AgentAutosave] Episode synced (update${isRolling ? ', rolling-guard' : ''}): ${title} (${content.length} bytes)`);
    } else {
      // First time seeing this episode — insert it
      const inserted = await db.execute(sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, importance, entry_type, tags, arc_name)
        VALUES (
          gen_random_uuid(),
          ${title},
          ${summary},
          ${content},
          ${9},
          'episode',
          ARRAY['episode', 'auto-synced']::text[],
          'HolaHola Episodes'
        )
        RETURNING id
      `);
      const newId = (inserted as any).rows?.[0]?.id ?? (inserted as any)[0]?.id;
      if (newId) {
        episodeIdCache.set(filename, newId as string);
        memoryId = newId as string;
        console.log(`[AgentAutosave] Episode synced (insert): ${title} id=${memoryId} (${content.length} bytes)`);
      }
    }

    // Re-embed after upsert
    if (memoryId) {
      reembedConversationMemory(memoryId).catch((err: any) => {
        console.error(`[AgentAutosave] Re-embed failed for ${title}:`, err?.message ?? err);
      });
    }
  } catch (err: any) {
    console.error(`[AgentAutosave] Episode sync error for ${filename}:`, err?.message ?? err);
  }
}

/** Upsert a prequel episode into conversation_memories and trigger a re-embed. */
async function syncPrequelEpisodeFile(filename: string): Promise<void> {
  const filePath = join(DOCS_DIR, filename);
  if (!existsSync(filePath)) return;

  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return; // file briefly locked
  }

  const title   = prequelEpisodeTitleFromFilename(filename);
  const summary = episodeSummaryFromContent(content);
  const db      = getUserDb();

  try {
    let memoryId = prequelIdCache.get(filename);

    if (!memoryId) {
      const rows = await db.execute(sql`
        SELECT id FROM conversation_memories
        WHERE arc_name = 'HolaHola Episodes'
          AND title = ${title}
        LIMIT 1
      `);
      const row = (rows as any).rows?.[0] ?? (rows as any)[0];
      if (row?.id) {
        memoryId = row.id as string;
        prequelIdCache.set(filename, memoryId);
      }
    }

    if (memoryId) {
      await db.execute(sql`
        UPDATE conversation_memories
        SET content = ${content},
            summary = ${summary}
        WHERE id = ${memoryId}
      `);
      console.log(`[AgentAutosave] Prequel episode synced (update): ${title} (${content.length} bytes)`);
    } else {
      const inserted = await db.execute(sql`
        INSERT INTO conversation_memories
          (id, title, summary, content, importance, entry_type, tags, arc_name)
        VALUES (
          gen_random_uuid(),
          ${title},
          ${summary},
          ${content},
          ${9},
          'episode',
          ARRAY['episode', 'prequel', 'auto-synced']::text[],
          'HolaHola Episodes'
        )
        RETURNING id
      `);
      const newId = (inserted as any).rows?.[0]?.id ?? (inserted as any)[0]?.id;
      if (newId) {
        prequelIdCache.set(filename, newId as string);
        memoryId = newId as string;
        console.log(`[AgentAutosave] Prequel episode synced (insert): ${title} id=${memoryId} (${content.length} bytes)`);
      }
    }

    if (memoryId) {
      reembedConversationMemory(memoryId).catch((err: any) => {
        console.error(`[AgentAutosave] Re-embed failed for ${title}:`, err?.message ?? err);
      });
    }
  } catch (err: any) {
    console.error(`[AgentAutosave] Prequel episode sync error for ${filename}:`, err?.message ?? err);
  }
}

/** Schedule a debounced sync for a specific episode file (2s debounce). */
function scheduleEpisodeSync(filename: string): void {
  const existing = episodeDebounce.get(filename);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    episodeDebounce.delete(filename);
    syncEpisodeFile(filename).catch(() => { /* already logged */ });
  }, 2000);
  episodeDebounce.set(filename, timer);
}

/** Schedule a debounced sync for a specific prequel episode file (2s debounce). */
function schedulePrequelEpisodeSync(filename: string): void {
  const existing = prequelDebounce.get(filename);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    prequelDebounce.delete(filename);
    syncPrequelEpisodeFile(filename).catch(() => { /* already logged */ });
  }, 2000);
  prequelDebounce.set(filename, timer);
}

/** Poll docs/ for new or changed episode-*.md files.
 *  Exported so the CI test script can trigger a detection cycle directly.
 */
export async function checkEpisodeFiles(): Promise<void> {
  let files: string[];
  try {
    files = readdirSync(DOCS_DIR).filter(f => EPISODE_RE.test(f));
  } catch {
    return; // docs/ doesn't exist yet
  }

  for (const filename of files) {
    const filePath = join(DOCS_DIR, filename);
    try {
      const mtime = statSync(filePath).mtimeMs;
      const prev  = episodeMtimeMap.get(filename) ?? 0;
      if (mtime !== prev) {
        episodeMtimeMap.set(filename, mtime);
        // prev === 0 means this file was not present at startup (seedEpisodeMtimes
        // pre-populates all startup files). So this is a truly new episode file —
        // sync it immediately just like a changed file.
        const reason = prev === 0 ? 'new file detected' : 'change detected';
        console.log(`[AgentAutosave] Episode ${reason}: ${filename} — syncing in 2s...`);
        scheduleEpisodeSync(filename);
      }
    } catch { /* briefly locked */ }
  }
}

/** Poll docs/ for new or changed prequel-episode-*.md files. */
export async function checkPrequelEpisodeFiles(): Promise<void> {
  let files: string[];
  try {
    files = readdirSync(DOCS_DIR).filter(f => PREQUEL_RE.test(f));
  } catch {
    return; // docs/ doesn't exist yet
  }

  for (const filename of files) {
    const filePath = join(DOCS_DIR, filename);
    try {
      const mtime = statSync(filePath).mtimeMs;
      const prev  = prequelMtimeMap.get(filename) ?? 0;
      if (mtime !== prev) {
        prequelMtimeMap.set(filename, mtime);
        const reason = prev === 0 ? 'new file detected' : 'change detected';
        console.log(`[AgentAutosave] Prequel episode ${reason}: ${filename} — syncing in 2s...`);
        schedulePrequelEpisodeSync(filename);
      }
    } catch { /* briefly locked */ }
  }
}

/** Seed initial mtimes for all current episode files so restarts don't trigger mass re-embeds. */
function seedEpisodeMtimes(): void {
  let files: string[];
  try {
    files = readdirSync(DOCS_DIR).filter(f => EPISODE_RE.test(f));
  } catch {
    return;
  }
  for (const filename of files) {
    const filePath = join(DOCS_DIR, filename);
    try {
      episodeMtimeMap.set(filename, statSync(filePath).mtimeMs);
    } catch { /* ignore */ }
  }
  console.log(`[AgentAutosave] Seeded mtimes for ${files.length} episode file(s) in docs/.`);
}

/** Seed initial mtimes for all current prequel episode files so restarts don't trigger mass re-embeds. */
function seedPrequelEpisodeMtimes(): void {
  let files: string[];
  try {
    files = readdirSync(DOCS_DIR).filter(f => PREQUEL_RE.test(f));
  } catch {
    return;
  }
  for (const filename of files) {
    const filePath = join(DOCS_DIR, filename);
    try {
      prequelMtimeMap.set(filename, statSync(filePath).mtimeMs);
    } catch { /* ignore */ }
  }
  console.log(`[AgentAutosave] Seeded mtimes for ${files.length} prequel episode file(s) in docs/.`);
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

  // Seed inner-life watcher mtimes so first poll doesn't re-fire on existing files
  for (const [path, setMtime] of [
    [REFLECTION_PATH,      (m: number) => { reflectionLastMtime = m; }] as const,
    [QUESTION_PATH,        (m: number) => { questionLastMtime = m; }] as const,
    [MOMENT_PATH,          (m: number) => { momentLastMtime = m; }] as const,
    [EPISODE_APPEND_PATH,  (m: number) => { episodeAppendLastMtime = m; }] as const,
  ]) {
    if (existsSync(path)) {
      try { setMtime(statSync(path).mtimeMs); } catch { /* ignore */ }
    }
  }

  // Seed flush-trigger mtime so an existing file doesn't fire spuriously on startup
  if (existsSync(FLUSH_TRIGGER_PATH)) {
    try { flushTriggerLastMtime = statSync(FLUSH_TRIGGER_PATH).mtimeMs; } catch { /* ignore */ }
  }

  // Seed episode mtimes so an existing set of .md files doesn't trigger mass re-embeds on restart
  seedEpisodeMtimes();
  seedPrequelEpisodeMtimes();

  // --- Event-driven flush trigger (Layer 1) ---
  // fs.watch() on the .local/ directory fires within milliseconds when
  // .flush_transcript is created or modified — no poll latency.
  const localDir = join(WORKSPACE, '.local');
  try {
    watch(localDir, { persistent: false }, (eventType, filename) => {
      if (filename === '.flush_transcript') {
        // Fire asynchronously; do not await here (watch callback is sync)
        handleFlushTrigger('fs.watch').catch(() => { /* ignore */ });
      } else if (filename === '.episode_append') {
        checkEpisodeAppend().catch(() => { /* ignore */ });
      }
    });
    console.log('[AgentAutosave] fs.watch() armed on .local/ for immediate flush-trigger detection.');
  } catch (err: any) {
    console.warn('[AgentAutosave] fs.watch() unavailable — falling back to poll-only flush detection:', err.message);
  }

  // --- Event-driven episode watcher (Layer 1) ---
  // fs.watch() on docs/ fires within milliseconds when any episode-*.md or prequel-episode-*.md is saved.
  try {
    watch(DOCS_DIR, { persistent: false }, (eventType, filename) => {
      if (filename && EPISODE_RE.test(filename)) {
        console.log(`[AgentAutosave] docs/ event (${eventType}): ${filename} — scheduling episode sync.`);
        scheduleEpisodeSync(filename);
      } else if (filename && PREQUEL_RE.test(filename)) {
        console.log(`[AgentAutosave] docs/ event (${eventType}): ${filename} — scheduling prequel episode sync.`);
        schedulePrequelEpisodeSync(filename);
      }
    });
    console.log('[AgentAutosave] fs.watch() armed on docs/ for immediate episode-file detection.');
  } catch (err: any) {
    console.warn('[AgentAutosave] fs.watch() on docs/ unavailable — falling back to poll-only episode detection:', err.message);
  }

  // --- Polling loop (Layer 2 + all other watchers) ---
  setInterval(async () => {
    await checkFlushTrigger(); // backup in case fs.watch missed the event
    await checkEpisodeAppend(); // backup in case fs.watch missed the episode_append event
    await checkBuildSession();
    await checkSessionInsights();
    await checkLucaReflection();
    await checkLucaQuestion();
    await checkLucaMoment();
    await checkEpisodeFiles();        // catch any changes missed by fs.watch + detect new episode files
    await checkPrequelEpisodeFiles(); // same for prequel-episode-*.md
    await saveTranscriptChunk(); // periodic — captures conversation-only sessions too
  }, POLL_INTERVAL_MS);

  console.log('[AgentAutosave] Started — watching .commit_message (build) + .session_insights (emergence) + luca inner-life + flush trigger (.flush_transcript, event-driven + poll) + .episode_append (live episode capture, event-driven + poll) + docs/episode-*.md + docs/prequel-episode-*.md (episode auto-sync, event-driven + poll) + periodic transcript capture every 20s');
}
