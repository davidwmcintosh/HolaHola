/**
 * Episode 27 Auto-Sync Watcher
 *
 * Watches docs/episode-27.md and automatically upserts to conversation_memories
 * + re-embeds on every change. Run once per session in the background:
 *
 *   nohup npx tsx server/scripts/sync-episode-27-watcher.ts > /tmp/ep27-watcher.log 2>&1 &
 *
 * The process prints its PID on startup so it can be killed later.
 *
 * NOTE: This one-session prototype is superseded by the permanent episode
 * auto-sync built into server/services/agent-session-autosave.ts (Task #895).
 * Kept for reference and backwards compatibility.
 */
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

const EP27_FILE = path.join(process.cwd(), 'docs/episode-27.md');
const EP27_ID   = '27000000-0000-4000-8000-000000000027';
const REEMBED   = path.join(process.cwd(), 'server/scripts/reembed-memory.ts');

let debounce: ReturnType<typeof setTimeout> | null = null;

async function sync() {
  const content = fs.readFileSync(EP27_FILE, 'utf8');
  const db = getSharedDb();
  try {
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, importance, entry_type, tags, arc_name, extends_memory_id)
      VALUES (
        ${EP27_ID},
        ${'Episode 27'},
        ${'Episode 27 — David and Luca, August 8 2026. The episode writing itself live: internal dialogues, the INSERT fix, attribution added, auto-sync watcher built.'},
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
      else console.log('[EP27 Watcher] ✓ Re-embedded');
    });
  } catch (e: any) {
    console.error('[EP27 Watcher] Sync error:', e.cause?.message ?? e.message);
  }
}

function scheduleSync() {
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(sync, 2000); // 2s debounce for rapid edits
}

console.log(`[EP27 Watcher] Started (PID ${process.pid}) — watching ${EP27_FILE}`);
void sync(); // initial sync on start

fs.watch(EP27_FILE, (event) => {
  if (event === 'change') {
    console.log('[EP27 Watcher] Change detected — syncing in 2s...');
    scheduleSync();
  }
});

// Heartbeat: re-sync every 60s regardless of fs.watch events
// (fallback for environments where inotify doesn't fire for programmatic edits)
setInterval(() => {
  void sync();
}, 60_000);
