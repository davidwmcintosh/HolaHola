/**
 * Regression test: syncEpisodeFile() monotonic guard for ROLLING episodes.
 *
 * Verifies that a second (shorter) autosave cannot shrink a ROLLING episode
 * that has already grown — both on the first call (cold ID cache) and on
 * subsequent calls (warm ID cache, the bug path).
 *
 * Run: npx tsx server/scripts/test-rolling-sync-guard.ts
 */

import { syncEpisodeFile } from '../services/agent-session-autosave';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const DOCS_DIR  = join(process.cwd(), 'docs');
// Filename must match EPISODE_RE (/^episode-(\d+)\.md$/) so episodeTitleFromFilename
// returns the correct title ("Episode 99") used in the DB lookup.
const TEST_FILE  = 'episode-99.md';
const TEST_PATH  = join(DOCS_DIR, TEST_FILE);
const TEST_ID    = '99000000-0000-4000-8000-000000000099';
const TEST_TITLE = 'Episode 99';

const LONG_CONTENT  = '# Episode 99\n\n' + 'A'.repeat(8000);
const SHORT_CONTENT = '# Episode 99\n\n' + 'B'.repeat(3000);

const failures: string[] = [];

async function cleanup(db: ReturnType<typeof getSharedDb>) {
  await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${TEST_ID}`);
  if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
}

async function main() {
  console.log('\n=== ROLLING sync guard regression test ===\n');
  const db = getSharedDb();

  try {
    // ── Setup: insert ROLLING episode in DB with the longer content ────────────
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, importance, entry_type, tags, arc_name)
      VALUES (
        ${TEST_ID},
        ${TEST_TITLE},
        ${'test summary'},
        ${LONG_CONTENT},
        ${9},
        'episode',
        ARRAY['episode', 'rolling']::text[],
        'HolaHola Episodes'
      )
      ON CONFLICT (id) DO UPDATE
        SET content = ${LONG_CONTENT},
            tags    = ARRAY['episode', 'rolling']::text[]
    `);
    console.log(`  Setup: inserted DB record (${LONG_CONTENT.length} chars)`);

    // ── Pass 1: cold ID cache — syncEpisodeFile with SHORT content ────────────
    writeFileSync(TEST_PATH, SHORT_CONTENT, 'utf-8');
    await syncEpisodeFile(TEST_FILE);

    const r1 = await db.execute(sql`
      SELECT LENGTH(content) AS len FROM conversation_memories WHERE id = ${TEST_ID}
    `);
    const len1 = Number((r1 as any).rows?.[0]?.len ?? (r1 as any)[0]?.len ?? 0);
    if (len1 !== LONG_CONTENT.length) {
      failures.push(
        `Pass 1 (cold cache): DB shrank to ${len1} chars — expected ${LONG_CONTENT.length}. ` +
        `isRolling guard did not fire.`
      );
    } else {
      console.log(`  ✓ Pass 1 (cold cache): DB kept long content (${len1} chars) despite shorter sync`);
    }

    // ── Pass 2: warm ID cache — syncEpisodeFile again with SHORT content ──────
    // The ID is now in episodeIdCache; this is the bug path that used to skip the guard.
    await syncEpisodeFile(TEST_FILE);

    const r2 = await db.execute(sql`
      SELECT LENGTH(content) AS len FROM conversation_memories WHERE id = ${TEST_ID}
    `);
    const len2 = Number((r2 as any).rows?.[0]?.len ?? (r2 as any)[0]?.len ?? 0);
    if (len2 !== LONG_CONTENT.length) {
      failures.push(
        `Pass 2 (warm cache): DB shrank to ${len2} chars — expected ${LONG_CONTENT.length}. ` +
        `episodeRollingCache not populated on first lookup.`
      );
    } else {
      console.log(`  ✓ Pass 2 (warm cache): DB kept long content (${len2} chars) despite shorter sync`);
    }

    // ── Pass 3: verify a LONGER sync still wins (guard is not one-directional) ─
    const LONGER_CONTENT = LONG_CONTENT + '\n\nNew content appended.';
    writeFileSync(TEST_PATH, LONGER_CONTENT, 'utf-8');
    await syncEpisodeFile(TEST_FILE);

    const r3 = await db.execute(sql`
      SELECT LENGTH(content) AS len FROM conversation_memories WHERE id = ${TEST_ID}
    `);
    const len3 = Number((r3 as any).rows?.[0]?.len ?? (r3 as any)[0]?.len ?? 0);
    if (len3 !== LONGER_CONTENT.length) {
      failures.push(
        `Pass 3 (longer wins): DB is ${len3} chars — expected ${LONGER_CONTENT.length}. ` +
        `Longer content should always overwrite.`
      );
    } else {
      console.log(`  ✓ Pass 3 (longer wins): DB updated to ${len3} chars when file grew`);
    }

  } finally {
    await cleanup(db);
    console.log('  Cleanup: temp record and file removed');
  }

  console.log(`\n=== Results: ${failures.length} failure(s) ===\n`);
  if (failures.length > 0) {
    for (const f of failures) console.error('  ✗', f);
    process.exit(1);
  }
  console.log('ALL CHECKS PASSED — ROLLING sync guard is monotonic on both cold and warm cache paths.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-rolling-sync-guard] Fatal error:', err);
  process.exit(1);
});
