/**
 * Regression test: syncEpisodeFile() monotonic guard for ROLLING episodes.
 *
 * Verifies that a second (shorter) autosave cannot shrink a ROLLING episode
 * that has already grown — both on the first call (cold ID cache) and on
 * subsequent calls (warm ID cache, the bug path).
 *
 * Run: npx tsx server/scripts/test-rolling-sync-guard.ts
 */

import {
  syncEpisodeFile,
  setRollingGuardInvertForTest,
} from '../services/agent-session-autosave';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { execSync } from 'child_process';
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

const SELF_CHECK = process.argv.includes('--self-check');

async function cleanup(db: ReturnType<typeof getSharedDb>) {
  await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${TEST_ID}`);
  if (existsSync(TEST_PATH)) unlinkSync(TEST_PATH);
}

/**
 * Self-check: invert the SQL comparison direction (LENGTH(content) >= incoming
 * instead of <=) and verify that Pass 3 (longer wins) now FAILS.
 *
 * Why this mutation models a real regression:
 *   Normal guard:  WHERE LENGTH(content) <= incoming  →  longer content satisfies this → DB updates
 *   Inverted guard: WHERE LENGTH(content) >= incoming →  longer content does NOT satisfy this → DB stays
 *
 * With the inverted guard, LONG_CONTENT (8014) in DB vs LONGER_CONTENT (8037) incoming:
 *   8014 >= 8037 → FALSE → update skipped → Pass 3 fails.
 * This precisely models a bug where the comparison direction is wrong and longer content
 * can no longer overwrite stale shorter DB content.
 */
async function runSelfCheck(db: ReturnType<typeof getSharedDb>): Promise<void> {
  console.log('\n=== SELF-CHECK: verifying Pass 3 fails when length comparison is inverted ===\n');

  // Setup: insert ROLLING episode with LONG content.
  // created_at is pinned to 2020-01-01 so this record always sorts BELOW real
  // rolling episodes in getCurrentRollingEpisodeFilename() (ORDER BY created_at DESC),
  // preventing cross-test contamination even if cleanup fails.
  await db.execute(sql`
    INSERT INTO conversation_memories
      (id, title, summary, content, importance, entry_type, tags, arc_name, created_at)
    VALUES (
      ${TEST_ID},
      ${TEST_TITLE},
      ${'self-check summary'},
      ${LONG_CONTENT},
      ${9},
      'episode',
      ARRAY['episode', 'rolling']::text[],
      'HolaHola Episodes',
      '2020-01-01 00:00:00+00'
    )
    ON CONFLICT (id) DO UPDATE
      SET content  = ${LONG_CONTENT},
          tags     = ARRAY['episode', 'rolling']::text[],
          created_at = '2020-01-01 00:00:00+00'
  `);
  console.log(`  Setup: inserted DB record (${LONG_CONTENT.length} chars)`);

  // Warm the ID and rolling cache with a normal sync first
  writeFileSync(TEST_PATH, LONG_CONTENT, 'utf-8');
  await syncEpisodeFile(TEST_FILE);

  // Invert the comparison — simulates the guard direction being wrong
  setRollingGuardInvertForTest(true);

  try {
    // Sync a LONGER file — with the inverted guard, longer content can no longer win
    // because LENGTH(content) >= incoming = 8014 >= 8037 = FALSE → update skipped.
    const LONGER_CONTENT = LONG_CONTENT + '\n\nNew content appended.';
    writeFileSync(TEST_PATH, LONGER_CONTENT, 'utf-8');
    await syncEpisodeFile(TEST_FILE);

    const r = await db.execute(sql`
      SELECT LENGTH(content) AS len FROM conversation_memories WHERE id = ${TEST_ID}
    `);
    const len = Number((r as any).rows?.[0]?.len ?? (r as any)[0]?.len ?? 0);

    if (len === LONGER_CONTENT.length) {
      // Inverted guard still let longer content through — seam is not working
      console.error('  ✗ SELF-CHECK FAILED: DB updated to longer length even with inverted comparison.');
      console.error('    The test would NOT have caught a wrong-direction regression — investigate the seam.');
      process.exit(1);
    } else {
      console.log(`  ✓ SELF-CHECK PASSED: with inverted comparison, DB stayed at ${len} chars`);
      console.log(`    (longer content blocked — Pass 3 would correctly report a failure).`);
    }
  } finally {
    // Always restore the guard before exiting
    setRollingGuardInvertForTest(false);
    await cleanup(db);
    console.log('  Cleanup: comparison restored, temp record and file removed');
  }
}

async function main() {
  console.log('\n=== ROLLING sync guard regression test ===\n');
  const db = getSharedDb();

  // Pre-cleanup: remove any leftover record from a previous failed run so the
  // episode-99 'rolling' row doesn't pollute getCurrentRollingEpisodeFilename()
  // for other CI tests (e.g. luca-reflection-episode-ci) that run after this one.
  await cleanup(db);

  if (SELF_CHECK) {
    try {
      await runSelfCheck(db);
    } catch (err: any) {
      setRollingGuardInvertForTest(false); // safety restore
      await cleanup(db);
      console.error('[test-rolling-sync-guard] Self-check fatal error:', err);
      process.exit(1);
    }
    console.log('\nSelf-check complete.\n');
    process.exit(0);
  }

  try {
    // ── Setup: insert ROLLING episode in DB with the longer content ────────────
    // created_at is pinned to 2020-01-01 so this test record always sorts BELOW
    // real rolling episodes in getCurrentRollingEpisodeFilename() (ORDER BY created_at DESC),
    // preventing cross-test contamination even if cleanup fails.
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, importance, entry_type, tags, arc_name, created_at)
      VALUES (
        ${TEST_ID},
        ${TEST_TITLE},
        ${'test summary'},
        ${LONG_CONTENT},
        ${9},
        'episode',
        ARRAY['episode', 'rolling']::text[],
        'HolaHola Episodes',
        '2020-01-01 00:00:00+00'
      )
      ON CONFLICT (id) DO UPDATE
        SET content    = ${LONG_CONTENT},
            tags       = ARRAY['episode', 'rolling']::text[],
            created_at = '2020-01-01 00:00:00+00'
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

  // ── Pass 4: --force-push path (restore-rolling-episodes-from-db.ts) ─────────
  // Inserts EP99 with long content in DB, writes a shorter .md, runs the
  // generalised restore script with --force-push, then verifies the DB was
  // updated to match the shorter .md — proving the flag bypasses the length guard.
  console.log('\n  ── Pass 4: force-push path (restore-rolling-episodes-from-db.ts --force-push) ──');
  try {
    // Setup: long content in DB, short content in .md
    await db.execute(sql`
      INSERT INTO conversation_memories
        (id, title, summary, content, importance, entry_type, tags, arc_name, created_at)
      VALUES (
        ${TEST_ID},
        ${TEST_TITLE},
        ${'force-push test summary'},
        ${LONG_CONTENT},
        ${9},
        'episode',
        ARRAY['episode', 'rolling']::text[],
        'HolaHola Episodes',
        '2020-01-01 00:00:00+00'
      )
      ON CONFLICT (id) DO UPDATE
        SET content    = ${LONG_CONTENT},
            tags       = ARRAY['episode', 'rolling']::text[],
            created_at = '2020-01-01 00:00:00+00'
    `);
    console.log(`  Setup: DB record at ${LONG_CONTENT.length} chars (long)`);

    writeFileSync(TEST_PATH, SHORT_CONTENT, 'utf-8');
    console.log(`  Setup: .md file at ${SHORT_CONTENT.length} chars (short)`);

    // Run restore-rolling-episodes-from-db.ts --force-push restricted to EP99
    // only. The --episode-id filter prevents the script from touching any real
    // rolling episodes (EP27, EP28) in the shared DB.
    const scriptPath = join(process.cwd(), 'server', 'scripts', 'restore-rolling-episodes-from-db.ts');
    try {
      const output = execSync(
        `npx tsx ${scriptPath} --force-push --episode-id=${TEST_ID}`,
        { encoding: 'utf8', env: process.env },
      );
      console.log('  Script output (truncated to 800 chars):');
      console.log(output.slice(0, 800).split('\n').map(l => '    ' + l).join('\n'));
    } catch (err: any) {
      failures.push(
        `Pass 4 (force-push): restore-rolling-episodes-from-db.ts --force-push exited non-zero. ` +
        `stderr: ${String(err?.stderr ?? '').slice(0, 300)}`
      );
    }

    // Verify DB now has SHORT_CONTENT
    const r4 = await db.execute(sql`
      SELECT LENGTH(content) AS len FROM conversation_memories WHERE id = ${TEST_ID}
    `);
    const len4 = Number((r4 as any).rows?.[0]?.len ?? (r4 as any)[0]?.len ?? 0);
    if (len4 !== SHORT_CONTENT.length) {
      failures.push(
        `Pass 4 (force-push): DB is ${len4} chars after --force-push — expected ${SHORT_CONTENT.length}. ` +
        `The flag did not push the shorter .md to DB.`
      );
    } else {
      console.log(`  ✓ Pass 4 (force-push): DB updated to ${len4} chars (matches shorter .md)`);
      console.log(`    --force-push bypassed the length guard correctly.`);
    }

    // ── Pass 4b: conflict-marker guard — force-push must reject a conflicted .md ─
    // Write a .md with unresolved git conflict markers, attempt force-push, and
    // verify (a) the script exits non-zero and (b) the DB content is unchanged.
    console.log('\n  ── Pass 4b: conflict-marker guard (force-push must reject conflicted .md) ──');
    const CONFLICTED_CONTENT = SHORT_CONTENT + '\n<<<<<<< HEAD\nconflict\n=======\nother\n>>>>>>> branch\n';
    writeFileSync(TEST_PATH, CONFLICTED_CONTENT, 'utf-8');
    let conflictRejected = false;
    try {
      execSync(
        `npx tsx ${scriptPath} --force-push --episode-id=${TEST_ID}`,
        { encoding: 'utf8', env: process.env },
      );
      // If we reach here the script exited 0 — that is wrong
      failures.push(
        `Pass 4b (conflict-marker guard): script exited 0 despite conflict markers in .md — should have rejected.`
      );
    } catch {
      conflictRejected = true;
    }

    if (conflictRejected) {
      // Also verify DB was NOT updated (still SHORT_CONTENT length)
      const r4b = await db.execute(sql`
        SELECT LENGTH(content) AS len FROM conversation_memories WHERE id = ${TEST_ID}
      `);
      const len4b = Number((r4b as any).rows?.[0]?.len ?? (r4b as any)[0]?.len ?? 0);
      if (len4b !== SHORT_CONTENT.length) {
        failures.push(
          `Pass 4b (conflict-marker guard): script correctly rejected, but DB was modified ` +
          `(${len4b} chars vs expected ${SHORT_CONTENT.length}) — conflict check ran after DB write.`
        );
      } else {
        console.log(`  ✓ Pass 4b (conflict-marker guard): script rejected conflicted .md (exit non-zero)`);
        console.log(`    DB unchanged at ${len4b} chars — no write occurred.`);
      }
    }

    // Restore SHORT_CONTENT to .md for cleanup consistency
    writeFileSync(TEST_PATH, SHORT_CONTENT, 'utf-8');
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
  console.log('                     --force-push correctly bypasses the length guard.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test-rolling-sync-guard] Fatal error:', err);
  process.exit(1);
});
