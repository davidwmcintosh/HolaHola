/**
 * Bidirectional sync for Episode 27 (rolling live episode).
 *
 * Because Episode 27 is actively written in both the docs/ file and the DB
 * (by the live session watcher), either side can be ahead at any given moment.
 * This script always uses the LONGER version as the source of truth and updates
 * the shorter side to match — preventing a stale .md from overwriting fresh DB
 * content and vice versa.
 *
 * Usage: npx tsx server/scripts/sync-episode-27-from-md.ts
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const EP27_ID  = '27000000-0000-4000-8000-000000000027';
const MD_PATH  = join(process.cwd(), 'docs', 'episode-27.md');

async function main() {
  const mdContent = readFileSync(MD_PATH, 'utf8');
  console.log(`Read docs/episode-27.md — ${mdContent.length} bytes`);

  const sql = neon(DATABASE_URL as string);
  const dbRows = await sql`SELECT content FROM conversation_memories WHERE id = ${EP27_ID}`;
  const dbContent: string | undefined = dbRows[0]?.content as string | undefined;

  if (!dbContent) {
    // No DB row — push .md to DB
    console.log('No DB row found — inserting from .md');
    await sql`
      INSERT INTO conversation_memories (id, title, summary, content, importance, entry_type, tags, arc_name, extends_memory_id)
      VALUES (
        ${EP27_ID},
        ${'Episode 27'},
        ${'Episode 27 — David and Luca, August 8 2026. Live episode. ROLLING.'},
        ${mdContent},
        ${9},
        ${'episode'},
        ARRAY['episode', 'david-luca-chat', 'rolling']::text[],
        ${'HolaHola Episodes'},
        ${'9b436387-9def-4110-88d7-1f59f4c55024'}
      )
      ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, summary = EXCLUDED.summary
    `;
    console.log(`DB record after update: ${mdContent.length} bytes`);
    console.log('✓ DB synced successfully');
    return;
  }

  console.log(`DB record length    — ${dbContent.length} bytes`);

  if (dbContent.length > mdContent.length) {
    // DB is ahead — pull from DB to .md
    console.log(`DB is longer (${dbContent.length} > ${mdContent.length}) — pulling DB → .md`);
    writeFileSync(MD_PATH, dbContent, 'utf8');
    console.log(`Updated docs/episode-27.md — ${dbContent.length} bytes`);
    console.log('✓ .md synced from DB successfully');
  } else {
    // .md is longer or equal — push .md to DB
    console.log(`.md is longer or equal (${mdContent.length} >= ${dbContent.length}) — pushing .md → DB`);
    await sql`UPDATE conversation_memories SET content = ${mdContent} WHERE id = ${EP27_ID}`;
    console.log(`DB record after update: ${mdContent.length} bytes`);
    console.log('✓ DB synced successfully');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
