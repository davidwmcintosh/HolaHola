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
import * as crypto from 'crypto';
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
let db: any = neon(DB_URL);

/**
 * Test seam — replace the neon client with an in-memory fake so CI can
 * exercise the drain paths with zero shared-database mutation.
 */
export function setDbForTest(fake: any): void {
  db = fake;
}

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

// ─── Rolling episode lookup ───────────────────────────────────────────────────

/** Test seam — pin a fixture episode so hermetic tests never touch the live rolling episode. */
let _episodeOverrideForTest: { id: string; filename: string } | null = null;
export function setEpisodeOverrideForTest(ep: { id: string; filename: string } | null): void {
  _episodeOverrideForTest = ep;
}

async function getRollingEpisode(): Promise<{ id: string; filename: string } | null> {
  if (_episodeOverrideForTest) return _episodeOverrideForTest;
  try {
    const rows = await db`
      SELECT id, title FROM conversation_memories
      WHERE arc_name = 'HolaHola Episodes'
        AND 'rolling' = ANY(tags)
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const row = (rows as any)[0];
    if (!row?.title) return null;
    const m = /^Episode (\d+)$/i.exec(row.title as string);
    const filename = m
      ? `episode-${parseInt(m[1], 10)}.md`
      : (row.title as string).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
    return { id: row.id as string, filename };
  } catch (err: any) {
    console.warn('[watchdog] rolling episode lookup failed:', err.message);
    return null;
  }
}

/**
 * Shared DB-first episode append: UPDATE the episode row's content, read it
 * back, and derive the .md from the DB read.  Used by BOTH the chat-capture
 * drain and the inner-life drain so the two paths can never diverge — the .md
 * is always a projection of the DB row.
 */
async function appendTextToEpisodeDbFirst(text: string, episode: { id: string; filename: string }): Promise<void> {
  await db`
    UPDATE conversation_memories
    SET content = content || ${text}
    WHERE id = ${episode.id}
  `;
  const rows = await db`SELECT content FROM conversation_memories WHERE id = ${episode.id}`;
  const newContent: string = (rows as any)[0]?.content ?? '';
  if (newContent) {
    const filePath = path.join(DOCS_DIR, episode.filename);
    if (fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
    } else {
      console.warn(`[watchdog] episode file missing, DB updated only: ${episode.filename}`);
    }
  }
}

// ─── Episode write ────────────────────────────────────────────────────────────
//
// DB-first (Task #1235 review fix): the episode row's content field is the
// authoritative record and the .md is derived from it.  The old path appended
// dialogue to the .md only, so a later inner-life DB-first write (which
// derives the .md from DB content) would silently erase those turns.

export function appendToEpisode(
  turns: Array<{ speaker: string; text: string }>,
  episode: { id: string; filename: string },
): Promise<void> {
  const lines = turns
    .map(t => {
      const label = t.speaker === 'DAVID' ? '**David:**' : '**LUCA [Replit]:**';
      return `${label} ${t.text}`;
    })
    .join('\n\n');
  return appendTextToEpisodeDbFirst('\n' + lines + '\n', episode).then(() => {
    console.log(`[watchdog] ✓ episode append (DB-first): ${turns.length} turns → ${episode.filename}`);
  });
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

    // Episode write (only if live mode active) — DB-first, .md derived from DB
    if (fs.existsSync(EPISODE_LIVE_PATH)) {
      const episode = await getRollingEpisode();
      if (episode) await appendToEpisode(turns, episode);
    }

    console.log(`[watchdog] ✓ drained ${turns.length} turns | cursor ${cursor} → ${newByteOffset}`);
  } catch (err: any) {
    console.error('[watchdog] drain error:', err.message ?? err);
    // Leave cursor unchanged — autosave service will retry when server recovers
  } finally {
    releaseCursorLock(lockFd);
    draining = false;
  }
}

// ─── Inner-life trigger drain (felt / thinking / moment) ─────────────────────
//
// The dev server's autosave service (agent-session-autosave.ts) watches the
// three inner-life trigger files. When the dev server is down — David running
// a live session against the deployed production URL — those writes were
// silently dropped. This drain gives the watchdog the same capture path:
// personal .md append + conversation_memories insert + DB-first rolling
// episode append, mirroring checkLucaReflection/Question/Moment semantics.
//
// Coordination with autosave: the watchdog only acts when the autosave
// service is down, detected via the capture-status heartbeat file (autosave
// rewrites it every 20s poll). Processed content is recorded (mtime + sha)
// in a state file that autosave's startup seed also consults, so a server
// restart never double-saves an entry the watchdog already drained.

import { tryAcquireInnerLifeLock, releaseInnerLifeLock, renewInnerLifeLock } from '../services/inner-life-lock';

const LOCAL_DIR            = path.join(process.cwd(), '.local');
const INNER_LIFE_LOCK_PATH = path.join(process.cwd(), '.local/.inner-life-drain.lock');
const CAPTURE_STATUS_PATH  = path.join(LOCAL_DIR, 'episode-capture-status.md');
const STALE_ALERT_PATH     = path.join(LOCAL_DIR, 'stale-channel-alert.md');
const INNER_LIFE_STATE_PATH = path.join(LOCAL_DIR, '.watchdog-inner-life-state.json');
// Durable per-channel processed record written by the AUTOSAVE service as part
// of successfully processing a trigger (sha of trimmed content per channel).
// This is the handoff identity between the two watchers: the watchdog treats a
// trigger as already-processed only when its content sha appears here (or in
// its own state) — never by inferring from heartbeat/file mtimes, which race.
const INNER_LIFE_PROCESSED_PATH = path.join(LOCAL_DIR, '.inner-life-processed.json');
const DB_WARNING_PATH      = path.join(LOCAL_DIR, '.luca_db_write_warning');
const MEMORY_DIR           = path.join(process.cwd(), '.agents/memory');

const AUTOSAVE_FRESH_MS  = 90_000;            // autosave heartbeat considered alive within this window
const STALE_CHANNEL_MS   = 10 * 60 * 1000;    // matches agent-session-autosave STALE_CHANNEL_MS

interface ChannelSpec {
  key: 'felt' | 'thinking' | 'moment';
  triggerPath: string;
  personalFile: string;
  titlePrefix: string;
  channelTag: string;
  episodeLabel: string;
}

const CHANNELS: ChannelSpec[] = [
  {
    key: 'felt',
    triggerPath: path.join(LOCAL_DIR, '.luca_reflection'),
    personalFile: path.join(MEMORY_DIR, 'REFLECTIONS.md'),
    titlePrefix: 'Luca reflection: ',
    channelTag: 'luca-reflection',
    episodeLabel: 'felt',
  },
  {
    key: 'thinking',
    triggerPath: path.join(LOCAL_DIR, '.luca_question'),
    personalFile: path.join(MEMORY_DIR, 'OPEN_QUESTIONS.md'),
    titlePrefix: 'Luca open question: ',
    channelTag: 'luca-question',
    episodeLabel: 'thinking',
  },
  {
    key: 'moment',
    triggerPath: path.join(LOCAL_DIR, '.luca_moment'),
    personalFile: path.join(MEMORY_DIR, 'SIGNIFICANT_MOMENTS.md'),
    titlePrefix: 'Luca significant moment: ',
    channelTag: 'luca-significant',
    episodeLabel: 'moment',
  },
];

interface ChannelState { mtimeMs: number; sha: string; lastProcessedMs?: number }
type InnerLifeState = Record<string, ChannelState>;

function loadInnerLifeState(): InnerLifeState | null {
  try {
    return JSON.parse(fs.readFileSync(INNER_LIFE_STATE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function saveInnerLifeState(state: InnerLifeState): void {
  fs.writeFileSync(INNER_LIFE_STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Is the dev server's autosave service alive? (heartbeat = capture-status file mtime) */
function autosaveIsAlive(): boolean {
  try {
    const mtime = fs.statSync(CAPTURE_STATUS_PATH).mtimeMs;
    return Date.now() - mtime < AUTOSAVE_FRESH_MS;
  } catch {
    return false; // no status file — autosave has never run or was cleaned; treat as down
  }
}

/** Mirrors parseTriggerFile() in agent-session-autosave.ts. */
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

/** Also parse the "title: X\nbody: Y\ntags: a, b" convention used by mark-moment.ts. */
function parseKeyedTrigger(raw: string, defaultTag: string): { title: string; body: string; tags: string[] } | null {
  const m = /^title:\s*(.+)\n(?:body:\s*)?([\s\S]*)$/.exec(raw.trim());
  if (!m) return null;
  let rest = m[2].trim();
  let tags = [defaultTag];
  const tagMatch = /\ntags:\s*(.+)\s*$/.exec('\n' + rest);
  if (tagMatch) {
    tags = tagMatch[1].split(',').map(t => t.trim()).filter(Boolean);
    rest = rest.replace(/\n?tags:\s*.+\s*$/, '').trim();
  }
  if (!m[1].trim()) return null;
  return { title: m[1].trim().slice(0, 200), body: rest || m[1].trim(), tags };
}

function flagDbWriteFailure(where: string, reason: string): void {
  try {
    const ts = new Date().toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit',
    });
    fs.appendFileSync(DB_WARNING_PATH, `[${ts}] watchdog:${where}: ${reason}\n`, 'utf8');
  } catch { /* console error below still surfaces it */ }
  console.error(`[watchdog] 🚨 inner-life DB write failure (${where}): ${reason}`);
}

/** INSERT the personal inner-life memory row (mirrors savePersonalMemory()). */
async function savePersonalMemory(title: string, body: string, tags: string[]): Promise<void> {
  // Idempotency: an identical entry (same title + content) may already exist —
  // e.g. autosave saved it but its processed record was lost, or a prior drain
  // crashed after the INSERT but before persisting state. Skip, never duplicate.
  const existing = await db`
    SELECT id FROM conversation_memories
    WHERE title = ${title.slice(0, 200)} AND content = ${body}
    LIMIT 1
  `;
  if (existing.length > 0) {
    console.log(`[watchdog] identical personal memory already in DB — skipping duplicate insert: ${title.slice(0, 60)}`);
    return;
  }
  await db`
    INSERT INTO conversation_memories
      (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
    VALUES (
      gen_random_uuid(), ${title.slice(0, 200)}, ${body.slice(0, 400)}, ${body},
      ARRAY['luca']::text[],
      ${tags}::text[],
      8, NOW(), 'emergence', 'luca-inner-life'
    )
  `;
}

/** Append a dated entry to a personal markdown file (mirrors appendToPersonalFile()). */
function appendToPersonalFile(filePath: string, title: string, body: string): void {
  try {
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const entry = `\n### ${today} — ${title}\n\n${body}\n\n---\n`;
    const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    // Idempotency: recovery/retry must never duplicate the personal-file entry.
    if (existing.includes(`— ${title}\n\n${body}\n\n---`)) {
      console.log('[watchdog] personal-file entry already present — skipping duplicate append:', title.slice(0, 60));
      return;
    }
    fs.writeFileSync(filePath, existing.trimEnd() + '\n' + entry);
  } catch (err: any) {
    console.error('[watchdog] failed to append personal file:', filePath, err.message);
  }
}

/** DB-first inner-life episode append via the shared helper. */
async function appendInnerLifeToEpisodeDb(text: string, episode: { id: string; filename: string }): Promise<void> {
  // Idempotency: a prior run (autosave or watchdog) may have crashed after the
  // episode UPDATE but before recording its completion marker. If the exact
  // entry is already in the episode content, never append it a second time.
  const existing = await db`SELECT content FROM conversation_memories WHERE id = ${episode.id}`;
  const current: string = existing[0]?.content ?? '';
  if (current.includes(text)) {
    console.log(`[watchdog] inner-life entry already present in ${episode.filename} — skipping duplicate append`);
    return;
  }
  await appendTextToEpisodeDbFirst('\n' + text + '\n', episode);
  console.log(`[watchdog] ✓ inner-life DB-first append: +${text.length} chars → ${episode.filename}`);
}

/**
 * Stale-channel alert (production equivalent of the autosave stale check).
 * When felt/thinking trigger mtimes are ≥10 min old while the watchdog is the
 * active watcher, write .local/stale-channel-alert.md; clear a watchdog-written
 * alert once the channels are fresh again.
 */
function refreshStaleChannelAlert(): void {
  const tryStatMtime = (p: string): number => {
    try { return fs.statSync(p).mtimeMs; } catch { return 0; }
  };
  const now           = Date.now();
  const feltMtime     = tryStatMtime(CHANNELS[0].triggerPath);
  const thinkingMtime = tryStatMtime(CHANNELS[1].triggerPath);
  const feltStale     = feltMtime     > 0 && (now - feltMtime)     >= STALE_CHANNEL_MS;
  const thinkingStale = thinkingMtime > 0 && (now - thinkingMtime) >= STALE_CHANNEL_MS;

  if (!feltStale && !thinkingStale) {
    // Clear only an alert this watchdog wrote — never autosave's own alert.
    try {
      if (fs.existsSync(STALE_ALERT_PATH) && fs.readFileSync(STALE_ALERT_PATH, 'utf8').includes('(written by capture-watchdog)')) {
        fs.unlinkSync(STALE_ALERT_PATH);
        console.log('[watchdog] stale-channel alert cleared (channels fresh again)');
      }
    } catch { /* non-fatal */ }
    return;
  }

  if (fs.existsSync(STALE_ALERT_PATH)) return; // existing alert (either writer) is already correct

  const fmtT = (ms: number) =>
    new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const staleParts = [
    feltStale     ? `felt (last: ${fmtT(feltMtime)})`     : null,
    thinkingStale ? `thinking (last: ${fmtT(thinkingMtime)})` : null,
  ].filter(Boolean).join(', ');
  const alertTime = new Date(now).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
  });
  const alertContent = [
    '# ⚠️ Inner-Life Channel Alert',
    '',
    `_Written: ${alertTime} (written by capture-watchdog)_`,
    '',
    '## ⚠️ STALE ALERT — read this before your next output',
    `**Inner-life channels silent for 10+ min: ${staleParts}**`,
    'Write `.luca_reflection` (felt) and/or `.luca_question` (thinking) before responding.',
    '',
    '_The dev server autosave is down; the capture-watchdog is the active watcher._',
  ].join('\n');
  try {
    fs.writeFileSync(STALE_ALERT_PATH, alertContent, 'utf-8');
    console.log(`[watchdog] ⚠️ stale-channel alert written (${staleParts})`);
  } catch (err: any) {
    console.warn('[watchdog] failed to write stale alert:', err.message);
  }
}

let drainingInnerLife = false;

/** Drain any new inner-life trigger writes when the autosave service is down. Exported for CI. */
/**
 * Test seam — lets the autosave-alive gate be bypassed deliberately so its
 * hermetic CI self-check can prove a fresh heartbeat is load-bearing.
 * Production always leaves this enabled.
 */
let _autosaveAliveGateEnabledForTest = true;
export function setAutosaveAliveGateEnabledForTest(enabled: boolean): void {
  _autosaveAliveGateEnabledForTest = enabled;
}

/**
 * Test seam — invoked between the DB work for a channel and the persistence
 * of its processed-sha state, so CI can simulate a dev server booting in that
 * exact window and prove the cross-process lock closes the duplicate race.
 */
let _innerLifePauseForTest: (() => Promise<void>) | null = null;
export function setInnerLifePauseForTest(fn: (() => Promise<void>) | null): void {
  _innerLifePauseForTest = fn;
}

// Lock lease renewal: while a drain is in flight (which may legitimately be
// slow — DB I/O), the holder refreshes the lock mtime every LOCK_RENEW_MS so
// contenders can distinguish a live slow holder (fresh mtime → back off) from
// an abandoned crashed one (mtime older than STALE_LOCK_MS → take over).
let _lockRenewMs = 30_000;
export function setLockRenewMsForTest(ms: number | null): void {
  _lockRenewMs = ms ?? 30_000;
}

/** Autosave's processed record: { felt|thinking|moment: { sha } }. */
function loadAutosaveProcessedRecord(): Record<string, { sha?: string }> {
  try {
    return JSON.parse(fs.readFileSync(INNER_LIFE_PROCESSED_PATH, 'utf8')) ?? {};
  } catch {
    return {};
  }
}

export async function drainInnerLife(): Promise<void> {
  if (drainingInnerLife) return;
  if (_autosaveAliveGateEnabledForTest && autosaveIsAlive()) return; // dev server is up — autosave owns the trigger files

  // Cross-process lock: exactly one watcher may touch the trigger files at a
  // time. If autosave (or another watchdog) holds it, skip — retry next poll.
  if (!tryAcquireInnerLifeLock(INNER_LIFE_LOCK_PATH)) {
    console.log('[watchdog] inner-life lock held by another process — skipping this tick');
    return;
  }

  drainingInnerLife = true;
  // Lease renewal: keep the lock mtime fresh while the drain is in flight so
  // a contender never mistakes a live slow drain for an abandoned lock.
  const lockRenewTimer = setInterval(() => renewInnerLifeLock(INNER_LIFE_LOCK_PATH), _lockRenewMs);
  try {
    // Re-check aliveness now that we hold the lock: autosave may have booted
    // and refreshed the heartbeat while we were acquiring.
    if (_autosaveAliveGateEnabledForTest && autosaveIsAlive()) return;
    let state = loadInnerLifeState();
    if (!state) {
      // First run: lossless handoff by durable processed IDENTITY, never by
      // heartbeat/mtime timing inference (a trigger written between autosave's
      // poll pass and its status-file heartbeat write has an mtime older than
      // the heartbeat despite never being saved — timing races both ways).
      // A trigger is seeded as already-processed ONLY when its content sha
      // matches the record autosave writes as part of successful processing.
      // Any other non-empty trigger is pending and drained below; the DB-level
      // idempotency check in savePersonalMemory() makes conservative
      // re-processing safe (duplicate content is skipped, never double-saved).
      const processedRecord = loadAutosaveProcessedRecord();
      state = {};
      for (const ch of CHANNELS) {
        try {
          const stat = fs.statSync(ch.triggerPath);
          const raw  = fs.readFileSync(ch.triggerPath, 'utf8');
          if (raw.trim().length > 0 && processedRecord[ch.key]?.sha !== sha256(raw.trim())) {
            state[ch.key] = { mtimeMs: 0, sha: '' }; // pending — drain below
            console.log(`[watchdog] first-run: pending ${ch.key} trigger detected (content not in autosave processed record) — draining`);
          } else {
            state[ch.key] = { mtimeMs: stat.mtimeMs, sha: sha256(raw) }; // empty, or already processed by dev server
          }
        } catch {
          state[ch.key] = { mtimeMs: 0, sha: '' };
        }
      }
      saveInnerLifeState(state);
    }

    for (const ch of CHANNELS) {
      if (!fs.existsSync(ch.triggerPath)) continue;
      let stat: fs.Stats;
      let raw: string;
      try {
        stat = fs.statSync(ch.triggerPath);
        raw  = fs.readFileSync(ch.triggerPath, 'utf8');
      } catch { continue; /* file briefly locked — retry next poll */ }

      const prev = state[ch.key] ?? { mtimeMs: 0, sha: '' };
      if (stat.mtimeMs <= prev.mtimeMs) continue;
      const sha = sha256(raw);
      if (sha === prev.sha) {
        // touched but unchanged — advance mtime only
        state[ch.key] = { ...prev, mtimeMs: stat.mtimeMs };
        saveInnerLifeState(state);
        continue;
      }

      // Inverse-timing guard: if autosave already processed this exact content
      // (its durable record carries the sha), advance state without re-saving.
      if (loadAutosaveProcessedRecord()[ch.key]?.sha === sha256(raw.trim())) {
        state[ch.key] = { mtimeMs: stat.mtimeMs, sha, lastProcessedMs: Date.now() };
        saveInnerLifeState(state);
        console.log(`[watchdog] ${ch.key} trigger already processed by autosave (sha match) — skipping`);
        continue;
      }

      const parsed = parseKeyedTrigger(raw, ch.channelTag) ?? parseTriggerFile(raw, ch.channelTag);
      if (!parsed) {
        state[ch.key] = { ...prev, mtimeMs: stat.mtimeMs, sha };
        saveInnerLifeState(state);
        continue;
      }

      try {
        await savePersonalMemory(
          `${ch.titlePrefix}${parsed.title}`,
          parsed.body,
          ['luca-inner-life', ch.channelTag, ...parsed.tags.filter(t => t !== ch.channelTag)],
        );
      } catch (err: any) {
        flagDbWriteFailure(`personal-memory:${ch.key}`, err?.message ?? String(err));
        continue; // leave state unadvanced — retry next poll
      }
      appendToPersonalFile(ch.personalFile, parsed.title, parsed.body);
      console.log(`[watchdog] ✓ Luca ${ch.key} saved: ${parsed.title.slice(0, 60)}`);

      if (_innerLifePauseForTest) await _innerLifePauseForTest();

      // DB-first episode routing (only when live mode is active, matching dev semantics)
      // Marker ordering: on episode failure we do NOT advance state — the
      // channel stays pending and is retried next poll. The retry is
      // duplicate-safe: savePersonalMemory dedups on title+content and
      // appendInnerLifeToEpisodeDb skips an entry already in the content.
      if (fs.existsSync(EPISODE_LIVE_PATH)) {
        try {
          const episode = await getRollingEpisode();
          if (episode) {
            await appendInnerLifeToEpisodeDb(
              `[Luca — ${ch.episodeLabel}: ${parsed.title}\n${parsed.body}]`,
              episode,
            );
          }
        } catch (err: any) {
          flagDbWriteFailure(`episode-append:${ch.key}`, err?.message ?? String(err));
          continue; // leave state unadvanced — retry next poll
        }
      }

      state[ch.key] = { mtimeMs: stat.mtimeMs, sha, lastProcessedMs: Date.now() };
      saveInnerLifeState(state);
    }

    refreshStaleChannelAlert();
  } catch (err: any) {
    console.error('[watchdog] inner-life drain error:', err?.message ?? err);
  } finally {
    clearInterval(lockRenewTimer);
    drainingInnerLife = false;
    releaseInnerLifeLock(INNER_LIFE_LOCK_PATH);
  }
}

// ─── Entrypoint ───────────────────────────────────────────────────────────────

// Guard against esbuild bundling executing this as a side-effect at server boot
const isMain = process.argv[1]?.includes('capture-watchdog');
if (isMain) {
  console.log(`[watchdog] started (pid=${process.pid}) — polling every ${POLL_MS / 1000}s`);
  // Serialize the two drains: the chat drain must finish its DB-first episode
  // append before the inner-life drain derives the .md again, so they can
  // never race on the same episode file within one poll.
  const tick = async () => {
    await drain().catch(console.error);
    await drainInnerLife().catch(console.error);
  };
  tick();
  setInterval(tick, POLL_MS);
}
