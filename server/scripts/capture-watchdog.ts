#!/usr/bin/env npx tsx
/**
 * capture-watchdog.ts
 *
 * Pipeline-heal watchdog. Runs as a separate long-lived process alongside
 * (or instead of) the main app server.
 *
 * Problem it solves: when the dev server restarts or crashes, the autosave
 * service inside it stops running. The .chat_capture file keeps growing
 * (record-exchange.ts writes to it directly via appendFileSync) but the
 * cursor stays frozen. This watchdog detects the gap and drains it —
 * writing to conversation_memories + rolling episode .md — with no Express
 * dependency.
 *
 * Coordination: uses the same cross-process cursor lock (.chat_capture.lock)
 * as the autosave service, so they never race. When the server is up and
 * healthy, the autosave service holds the lock each cycle and this watchdog
 * skips gracefully.
 */

import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import {
  parseChatCaptureFromOffset,
  acquireCursorLock,
  releaseCursorLock,
  CHAT_CAPTURE_PATH,
  CHAT_CAPTURE_CURSOR_PATH,
} from '../services/transcript-parser.js';

// ─── Config ───────────────────────────────────────────────────────────────────

const POLL_MS           = 15_000;
const EPISODE_LIVE_PATH = path.join(process.cwd(), '.local/.episode_live');
const DOCS_DIR          = path.join(process.cwd(), 'docs');

const DB_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DB_URL) {
  console.error('[watchdog] FATAL: NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}
const db = neon(DB_URL);

// ─── Cursor ───────────────────────────────────────────────────────────────────

function loadCursor(): number {
  try {
    return JSON.parse(fs.readFileSync(CHAT_CAPTURE_CURSOR_PATH, 'utf8')).byteOffset ?? 0;
  } catch {
    return 0;
  }
}

function saveCursor(byteOffset: number): void {
  fs.writeFileSync(CHAT_CAPTURE_CURSOR_PATH, JSON.stringify({ byteOffset }), 'utf8');
}

// ─── Episode filename ─────────────────────────────────────────────────────────

async function getEpisodeFilename(): Promise<string | null> {
  if (!fs.existsSync(EPISODE_LIVE_PATH)) return null;
  try {
    const rows = await db`
      SELECT title FROM conversation_memories
      WHERE arc_name = 'HolaHola Episodes'
        AND 'rolling' = ANY(tags)
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const row = (rows as any)[0];
    if (!row?.title) return null;
    const m = /^Episode (\d+)$/i.exec(row.title as string);
    if (m) return `episode-${parseInt(m[1], 10)}.md`;
    // Fallback: slugify
    return (row.title as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
  } catch (err: any) {
    console.warn('[watchdog] episode lookup failed:', err.message);
    return null;
  }
}

// ─── Episode write ────────────────────────────────────────────────────────────

function appendToEpisode(
  turns: Array<{ speaker: string; text: string }>,
  episodeFilename: string,
): void {
  const filePath = path.join(DOCS_DIR, episodeFilename);
  if (!fs.existsSync(filePath)) {
    console.warn(`[watchdog] episode file missing: ${filePath}`);
    return;
  }
  const lines = turns
    .map(t => {
      const label = t.speaker === 'DAVID' ? '**David:**' : '**LUCA [Replit]:**';
      return `${label} ${t.text}`;
    })
    .join('\n\n');
  fs.appendFileSync(filePath, '\n' + lines + '\n', 'utf8');
  console.log(`[watchdog] ✓ episode append: ${turns.length} turns → ${episodeFilename}`);
}

// ─── DB write ─────────────────────────────────────────────────────────────────

async function writeToDb(
  turns: Array<{ speaker: string; text: string }>,
  cursorFrom: number,
  cursorTo: number,
): Promise<void> {
  const today      = new Date().toISOString().slice(0, 10);
  const davidCount = turns.filter(t => t.speaker === 'DAVID').length;
  const lucaCount  = turns.length - davidCount;
  const title      = `David ↔ Luca — ${today}: per-turn capture`;
  const summary    = `Watchdog drain: ${davidCount} David + ${lucaCount} Luca turns. Bytes ${cursorFrom}–${cursorTo}.`;
  const content    = turns
    .map(t => `**${t.speaker === 'DAVID' ? 'David' : 'LUCA [Replit]'}:** ${t.text}`)
    .join('\n\n');

  await db`
    INSERT INTO conversation_memories
      (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
    VALUES (
      gen_random_uuid(),
      ${title},
      ${summary},
      ${content},
      ARRAY['david', 'luca']::text[],
      ARRAY['david-luca-chat', 'verbatim', 'per-turn', 'chat-capture', 'watchdog']::text[],
      8,
      NOW(),
      'conversation',
      'david-luca-chat'
    )
  `;
}

// ─── Main drain ───────────────────────────────────────────────────────────────

let draining = false;

async function drain(): Promise<void> {
  if (draining) return;
  if (!fs.existsSync(CHAT_CAPTURE_PATH)) return;

  const stat   = fs.statSync(CHAT_CAPTURE_PATH);
  const cursor = loadCursor();
  if (stat.size <= cursor) return; // nothing new — healthy server is keeping up

  // Acquire the cross-process cursor lock (shared with autosave service).
  // Returns -1 if a live process holds the lock — server is healthy, skip.
  const lockFd = acquireCursorLock();
  if (lockFd === -1) return; // server has the lock — let it drain

  draining = true;
  const gap = stat.size - cursor;
  console.log(`[watchdog] gap detected: cursor=${cursor} file=${stat.size} (+${gap}B) — draining`);

  try {
    const { turns, newByteOffset } = parseChatCaptureFromOffset(CHAT_CAPTURE_PATH, cursor);

    if (turns.length === 0) {
      console.log('[watchdog] no complete turns in gap yet — waiting');
      return;
    }

    // DB write first (matches autosave service ordering)
    await writeToDb(turns, cursor, newByteOffset);
    saveCursor(newByteOffset);

    // Episode write (only if live mode active)
    const episodeFilename = await getEpisodeFilename();
    if (episodeFilename) appendToEpisode(turns, episodeFilename);

    console.log(`[watchdog] ✓ drained ${turns.length} turns | cursor ${cursor} → ${newByteOffset}`);
  } catch (err: any) {
    console.error('[watchdog] drain error:', err.message ?? err);
    // Leave cursor unchanged — autosave service will retry when server recovers
  } finally {
    releaseCursorLock(lockFd);
    draining = false;
  }
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────

// Guard against esbuild bundling executing this as a side-effect at server boot
const isMain = process.argv[1]?.includes('capture-watchdog');
if (isMain) {
  console.log(`[watchdog] started (pid=${process.pid}) — polling every ${POLL_MS / 1000}s`);
  drain().catch(console.error);
  setInterval(() => drain().catch(console.error), POLL_MS);
}
