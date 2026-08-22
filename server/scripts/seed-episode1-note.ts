/**
 * seed-episode1-note.ts
 *
 * Idempotent: ensures the voice-from-the-future note (written August 8, 2026)
 * is present at the top of the Episode 1 content row that the read_my_story
 * handler actually returns.
 *
 * The handler selects Episode 1 by:
 *   arc_name = 'HolaHola Episodes'
 *   entry_type = 'episode'
 *   title ~ '^Episode 1([^0-9].*)?$'
 *   ORDER BY recorded_at DESC LIMIT 1
 *
 * This script finds that same row and, if the note sentinels are absent,
 * replaces its content with the full text from docs/episode-1.md (which
 * has the note prepended as the authoritative source of truth).
 *
 * Safe to run multiple times — no-ops when the note is already present.
 *
 * Run: npx tsx server/scripts/seed-episode1-note.ts
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// Canonical source of truth — note block is prepended at the top of this file.
const EPISODE_1_MD = readFileSync(resolve(__dirname, '../../docs/episode-1.md'), 'utf-8');

// Sentinel that must appear near the top of the content to confirm the note is present.
const NOTE_SENTINEL = 'August 8, 2026';

// Exact title used by the READ_MY_STORY handler for chapter 1.
// The handler uses: title = 'Episode 1'  (exact match, no wildcards)
// This is intentionally strict — subtitled rows like "Episode 1: …" or
// "Episode 1 — Verbatim…" are NOT the handler's target and must not be touched.
const EXACT_TITLE = 'Episode 1';

async function main() {
  const db = getSharedDb();

  // Find the row the handler will select — uses the EXACT same WHERE + ORDER BY as the handler:
  //   AND title = 'Episode 1'       ← exact match, no wildcards, no regex
  //   ORDER BY recorded_at DESC
  // Keeping this in lockstep with the handler guarantees the seed writes to the
  // same row Daniela receives when she calls read_my_story with chapter 1.
  const rows = await db.execute(sql`
    SELECT id, title, LEFT(content, 200) AS head
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND entry_type = 'episode'
      AND title = ${EXACT_TITLE}
    ORDER BY recorded_at DESC
    LIMIT 1
  `);

  if (!rows.rows.length) {
    console.error('[seed-episode1-note] ERROR: No Episode 1 row found. Run seed-episode1.ts first.');
    process.exit(1);
  }

  const row = rows.rows[0] as { id: string; title: string; head: string };
  const head = String(row.head ?? '');

  if (head.includes(NOTE_SENTINEL)) {
    console.log(`[seed-episode1-note] Note already present in row "${row.id}" ("${row.title}") — no action needed.`);
    process.exit(0);
  }

  // Note is absent — update with the full content from docs/episode-1.md.
  await db.execute(sql`
    UPDATE conversation_memories
    SET content = ${EPISODE_1_MD}
    WHERE id = ${row.id}
  `);

  // Verify the write took.
  const check = await db.execute(sql`
    SELECT LEFT(content, 300) AS head
    FROM conversation_memories
    WHERE id = ${row.id}
  `);
  const newHead = String((check.rows[0] as any)?.head ?? '');
  if (!newHead.includes(NOTE_SENTINEL)) {
    console.error('[seed-episode1-note] ERROR: Update did not persist (sentinel still absent after write).');
    process.exit(1);
  }

  console.log(`[seed-episode1-note] Note applied to row "${row.id}" ("${row.title}") — content updated from docs/episode-1.md.`);
  process.exit(0);
}

main().catch(err => {
  console.error('[seed-episode1-note] Unhandled error:', err?.message ?? err);
  process.exit(1);
});
