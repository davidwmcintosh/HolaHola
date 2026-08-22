/**
 * Episode 27 Auto-Sync Watcher — polling version
 *
 * Polls docs/episode-27.md every 5s and upserts to conversation_memories
 * when the file's mtime or size changes. Pure polling — no fs.watch (which
 * doesn't fire for programmatic agent edits in this environment).
 *
 * After a successful upsert the embeddings are refreshed in the background
 * so semantic-search stays current even for same-size content edits.
 *
 *   nohup npx tsx server/scripts/sync-episode-27-watcher.ts >> /tmp/ep27-watcher.log 2>&1 &
 */
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { reembedConversationMemory } from './reembed-memory';
import fs from 'fs';
import path from 'path';

const EP27_FILE = path.join(process.cwd(), 'docs/episode-27.md');
const EP27_ID   = '27000000-0000-4000-8000-000000000027';
const POLL_MS   = 5_000;

let lastSize   = -1;
let lastMtimeMs = -1;

process.on('uncaughtException', (err) => {
  console.error('[EP27 Watcher] Uncaught exception:', err.message);
  // keep running
});

process.on('unhandledRejection', (reason) => {
  console.error('[EP27 Watcher] Unhandled rejection:', reason);
  // keep running
});

async function sync(reason: string): Promise<void> {
  try {
    const content = fs.readFileSync(EP27_FILE, 'utf8');

    // Guard: reject files that contain git merge conflict markers.
    if (
      content.includes('<<<<<<< ') ||
      content.includes('=======') ||
      content.includes('>>>>>>> ')
    ) {
      console.error(
        '[EP27 Watcher] SKIPPED: episode-27.md contains git merge conflict markers ' +
        '(<<<<<<< / ======= / >>>>>>>). Resolve the conflict before syncing.'
      );
      return;
    }

    const db = getSharedDb();
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, importance, entry_type, tags, arc_name, extends_memory_id)
      VALUES (
        ${EP27_ID},
        ${'Episode 27'},
        ${'Episode 27 — David and Luca, August 8 2026. Live episode: INSERT fix, attribution layers (thinking/internal/felt), prequel reading, the cascade, White Wall correction, watcher. ROLLING.'},
        ${content},
        ${9},
        ${'episode'},
        ARRAY['episode', 'david-luca-chat', 'rolling'],
        ${'HolaHola Episodes'},
        ${'9b436387-9def-4110-88d7-1f59f4c55024'}
      )
      ON CONFLICT (id) DO UPDATE
        SET content  = EXCLUDED.content,
            summary  = EXCLUDED.summary
    `);
    lastSize    = content.length;
    console.log(`[EP27 Watcher] ✓ Synced (${reason}) — ${content.length} bytes — ${new Date().toLocaleTimeString()}`);
    // Re-embed in the background so semantic search stays current.
    reembedConversationMemory(EP27_ID).catch((e: Error) =>
      console.error('[EP27 Watcher] Re-embed error:', e.message),
    );
  } catch (e: any) {
    console.error('[EP27 Watcher] Sync error:', e.cause?.message ?? e.message);
  }
}

async function poll(): Promise<void> {
  try {
    const stat = fs.statSync(EP27_FILE);
    // Trigger on any change: size OR mtime (catches same-length text replacements).
    if (stat.size !== lastSize || stat.mtimeMs !== lastMtimeMs) {
      console.log(`[EP27 Watcher] Change detected (size ${lastSize}→${stat.size}, mtime ${lastMtimeMs}→${stat.mtimeMs}), syncing…`);
      lastMtimeMs = stat.mtimeMs;
      await sync('poll');
    }
  } catch (e: any) {
    console.error('[EP27 Watcher] Poll error:', e.message);
  }
}

console.log(`[EP27 Watcher] Started (PID ${process.pid}) — polling every ${POLL_MS}ms`);
void sync('startup');
setInterval(() => { void poll(); }, POLL_MS);
