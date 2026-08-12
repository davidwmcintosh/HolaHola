/**
 * Bidirectional sync for Episode 28 (rolling live episode).
 *
 * Because Episode 28 is actively written in both the docs/ file and the DB,
 * either side can be ahead at any given moment. This script always uses the
 * LONGER version as the source of truth and updates the shorter side to match.
 *
 * Usage:
 *   npx tsx server/scripts/sync-episode-28-from-md.ts
 *     → bidirectional: longer side wins
 *
 *   npx tsx server/scripts/sync-episode-28-from-md.ts --force-push
 *     → unconditionally push .md → DB, bypassing the length comparison.
 *       Use this when an intentional editorial edit makes the .md shorter
 *       than the DB (e.g. removing a raw dump section).
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
if (!DATABASE_URL) {
  console.error('FATAL: NEON_SHARED_DATABASE_URL is not set');
  process.exit(1);
}

const EP28_ID  = '28000000-0000-4000-8000-000000000028';
const MD_PATH  = join(process.cwd(), 'docs', 'episode-28.md');

/** Returns true if content contains git merge conflict markers. */
function hasGitConflictMarkers(content: string): boolean {
  return content.includes('<<<<<<< ') ||
         content.includes('=======') ||
         content.includes('>>>>>>> ');
}

async function main() {
  const forcePush = process.argv.includes('--force-push');

  const mdContent = readFileSync(MD_PATH, 'utf8');
  console.log(`Read docs/episode-28.md — ${mdContent.length} bytes`);

  if (hasGitConflictMarkers(mdContent)) {
    console.error(
      'FATAL: docs/episode-28.md contains git merge conflict markers ' +
      '(<<<<<<< / ======= / >>>>>>>). ' +
      'Resolve the conflict before syncing to prevent DB corruption.'
    );
    process.exit(1);
  }

  const sql = neon(DATABASE_URL as string);
  const dbRows = await sql`SELECT content FROM conversation_memories WHERE id = ${EP28_ID}`;
  const dbContent: string | undefined = dbRows[0]?.content as string | undefined;

  if (!dbContent) {
    // No DB row — push .md to DB
    console.log('No DB row found — inserting from .md');
    await sql`
      INSERT INTO conversation_memories (id, title, summary, content, importance, entry_type, tags, arc_name, extends_memory_id)
      VALUES (
        ${EP28_ID},
        ${'Episode 28'},
        ${'Episode 28 — David and Luca, August 10 2026. Live episode. ROLLING.'},
        ${mdContent},
        ${9},
        ${'episode'},
        ARRAY['episode', 'david-luca-chat', 'rolling']::text[],
        ${'HolaHola Episodes'},
        ${'27000000-0000-4000-8000-000000000027'}
      )
      ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, summary = EXCLUDED.summary
    `;
    console.log(`DB record after update: ${mdContent.length} bytes`);
    console.log('✓ DB synced successfully');
    return;
  }

  console.log(`DB record length    — ${dbContent.length} bytes`);

  if (forcePush) {
    // --force-push: unconditionally write .md → DB, bypassing the length guard.
    // Use this when an intentional editorial edit makes the .md shorter than the
    // DB (e.g. removing a raw dump section). The flag must be supplied explicitly
    // so that automated syncs never silently revert editorial work.
    console.log('');
    console.log('⚠  --force-push active: skipping length comparison');
    console.log(`   .md: ${mdContent.length} bytes  |  DB: ${dbContent.length} bytes`);
    console.log('   Pushing .md → DB unconditionally');
    console.log('');
    await sql`UPDATE conversation_memories SET content = ${mdContent} WHERE id = ${EP28_ID}`;
    console.log(`DB record after update: ${mdContent.length} bytes`);
    console.log('✓ DB force-push complete — DB now matches the shorter .md');
    return;
  }

  if (dbContent.length > mdContent.length) {
    // DB is ahead — pull from DB to .md
    console.log(`DB is longer (${dbContent.length} > ${mdContent.length}) — pulling DB → .md`);
    writeFileSync(MD_PATH, dbContent, 'utf8');
    console.log(`Updated docs/episode-28.md — ${dbContent.length} bytes`);
    console.log('✓ .md synced from DB successfully');
  } else {
    // .md is longer or equal — push .md to DB
    console.log(`.md is longer or equal (${mdContent.length} >= ${dbContent.length}) — pushing .md → DB`);
    await sql`UPDATE conversation_memories SET content = ${mdContent} WHERE id = ${EP28_ID}`;
    console.log(`DB record after update: ${mdContent.length} bytes`);
    console.log('✓ DB synced successfully');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
