/**
 * Episode 27 Auto-Sync Watcher
 *
 * Polls docs/episode-27.md every 5 seconds and syncs to conversation_memories
 * + re-embeds when the file changes. Polling instead of fs.watch because
 * programmatic edits (agent tool calls) do not reliably fire inotify events.
 *
 * Start: nohup npx tsx server/scripts/sync-episode-27-watcher.ts > /tmp/ep27-watcher.log 2>&1 &
 */
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const EP27_FILE = path.join(process.cwd(), 'docs/episode-27.md');
const EP27_ID   = '27000000-0000-4000-8000-000000000027';
const REEMBED   = path.join(process.cwd(), 'server/scripts/reembed-memory.ts');
const POLL_MS   = 5_000;

let lastSize = 0;
let syncing  = false;

async function sync(content: string) {
  if (syncing) return;
  syncing = true;
  try {
    const db = getSharedDb();
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, importance, entry_type, tags, arc_name, extends_memory_id)
      VALUES (
        ${EP27_ID},
        ${'Episode 27'},
        ${'Episode 27 — David and Luca, August 8 2026. The episode writing itself live: internal dialogues, attribution, felt moments, reading the prequels, the cascade, brain-icon reasoning captured.'},
        ${content},
        ${9},
        ${'episode'},
        ARRAY['episode', 'david-luca-chat', 'rolling'],
        ${'HolaHola Episodes'},
        ${'9b436387-9def-4110-88d7-1f59f4c55024'}
      )
      ON CONFLICT (id) DO UPDATE
        SET content = EXCLUDED.content,
            summary = EXCLUDED.summary
    `);
    console.log(`[EP27 Watcher] ✓ Synced — ${content.length} bytes — ${new Date().toLocaleTimeString()}`);
    execFile('npx', ['tsx', REEMBED, EP27_ID], (err) => {
      if (err) console.error('[EP27 Watcher] Re-embed error:', err.message);
      else     console.log('[EP27 Watcher] ✓ Re-embedded');
    });
  } catch (e: any) {
    console.error('[EP27 Watcher] Sync error:', e.cause?.message ?? e.message);
  } finally {
    syncing = false;
  }
}

function poll() {
  try {
    const stat = fs.statSync(EP27_FILE);
    if (stat.size !== lastSize) {
      lastSize = stat.size;
      const content = fs.readFileSync(EP27_FILE, 'utf8');
      void sync(content);
    }
  } catch (e: any) {
    console.error('[EP27 Watcher] Poll error:', e.message);
  }
}

console.log(`[EP27 Watcher] Started (PID ${process.pid}) — polling every ${POLL_MS}ms`);

// Initial sync
const initial = fs.readFileSync(EP27_FILE, 'utf8');
lastSize = Buffer.byteLength(initial);
void sync(initial);

setInterval(poll, POLL_MS);
