/**
 * test-episode-watcher-fires.ts
 *
 * CI gate: confirms that the episode auto-sync watcher (agent-session-autosave.ts)
 * actually detects an episode .md file change and updates conversation_memories.
 *
 * Strategy — exercises the real watcher detection path, NOT just the helper:
 *   1. Write a unique sentinel string to docs/episode-9999.md.
 *   2. Clear the mtime cache entry for that file so checkEpisodeFiles() treats
 *      it as newly detected (simulating what happens after a real fs.watch event
 *      or the 20s polling loop).
 *   3. Call checkEpisodeFiles() — the exact function the polling loop runs.
 *      This detects the file, calls scheduleEpisodeSync() (2s debounce), which
 *      in turn calls syncEpisodeFile() → DB upsert + re-embed.
 *   4. Poll conversation_memories for up to 10s waiting for the sentinel content.
 *   5. Assert the row exists and contains the sentinel, then clean up.
 *
 * Run: npx tsx server/scripts/test-episode-watcher-fires.ts
 */

import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import { checkEpisodeFiles, episodeMtimeMap } from '../services/agent-session-autosave';

// ── helpers ────────────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;

const DOCS_DIR   = join(process.cwd(), 'docs');
const TEST_FILE  = 'episode-9999.md';
const TEST_PATH  = join(DOCS_DIR, TEST_FILE);
const TEST_TITLE = 'Episode 9999';

// The debounce inside scheduleEpisodeSync is 2s; allow 3s for debounce + sync.
const DEBOUNCE_WAIT_MS = 3200;
// Then poll the DB for up to 8s more.
const POLL_TIMEOUT_MS  = 8000;
const POLL_INTERVAL_MS = 500;

// ── main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(B('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(B('║  EPISODE WATCHER FIRES — CI GATE                                    ║'));
  console.log(B('╚══════════════════════════════════════════════════════════════════════╝\n'));

  const sentinel = `CI-SENTINEL-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // ── step 1: write the test episode file ────────────────────────────────────
  console.log(Y('Step 1: Writing test episode file with unique sentinel…'));
  const content = `# Episode 9999 — CI Test\n\nSentinel: ${sentinel}\n\nThis file is written by the episode-watcher-fires CI test and deleted after the run.\n`;
  writeFileSync(TEST_PATH, content, 'utf-8');
  console.log(`  Wrote ${TEST_PATH} (${content.length} bytes)\n`);

  // ── step 2: clear the mtime cache so the detector sees it as new ──────────
  console.log(Y('Step 2: Clearing mtime cache entry so watcher detects this as a new/changed file…'));
  episodeMtimeMap.delete(TEST_FILE);
  console.log(`  episodeMtimeMap entry cleared for ${TEST_FILE}\n`);

  // ── step 3: fire the polling detection function (the real watcher path) ───
  console.log(Y('Step 3: Calling checkEpisodeFiles() — the function the polling loop runs…'));
  console.log('  This detects the file via mtime comparison, schedules a 2s debounce sync.');
  try {
    await checkEpisodeFiles();
    console.log('  checkEpisodeFiles() returned — debounce timer armed.\n');
  } catch (err: any) {
    safeDelete(TEST_PATH);
    console.error(R(`  ✗ checkEpisodeFiles() threw: ${err.message}`));
    process.exit(1);
  }

  // ── step 4: wait for debounce + sync to complete ──────────────────────────
  console.log(Y(`Step 4: Waiting ${DEBOUNCE_WAIT_MS}ms for debounce to fire and DB write to complete…`));
  await sleep(DEBOUNCE_WAIT_MS);
  console.log('  Done waiting.\n');

  // ── step 5: poll DB until the sentinel appears (up to POLL_TIMEOUT_MS) ────
  console.log(Y('Step 5: Polling conversation_memories for the sentinel content…'));
  const db = getUserDb();
  let memoryId: string | null = null;
  let dbContent: string | null = null;
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const result = await db.execute(sql`
        SELECT id, content
        FROM conversation_memories
        WHERE arc_name = 'HolaHola Episodes'
          AND title    = ${TEST_TITLE}
        LIMIT 1
      `);
      const row = (result as any).rows?.[0] ?? (result as any)[0];
      if (row?.id) {
        memoryId  = row.id as string;
        dbContent = row.content as string;
        if (dbContent?.includes(sentinel)) break;
      }
    } catch (err: any) {
      safeDelete(TEST_PATH);
      console.error(R(`  ✗ DB query failed: ${err.message}`));
      process.exit(1);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  if (!memoryId) {
    safeDelete(TEST_PATH);
    console.error(R(`\n  ✗ FAIL: No conversation_memories row found with title="${TEST_TITLE}" (arc_name='HolaHola Episodes')`));
    console.error(R('         The watcher detection path did not upsert the row within the timeout.'));
    console.error(R('         Check: checkEpisodeFiles() mtime detection, scheduleEpisodeSync() debounce, or syncEpisodeFile() DB write.'));
    process.exit(1);
  }

  if (!dbContent?.includes(sentinel)) {
    await cleanupDbRow(db, memoryId);
    safeDelete(TEST_PATH);
    console.error(R(`\n  ✗ FAIL: Row found (id=${memoryId}) but content does not contain the expected sentinel.`));
    console.error(R(`         Expected: ${sentinel}`));
    console.error(R(`         Got (first 300 chars): ${dbContent?.slice(0, 300)}`));
    process.exit(1);
  }

  console.log(G(`  ✓ Row found: id=${memoryId}`));
  console.log(G(`  ✓ Content contains sentinel — watcher detection path confirmed working.\n`));

  // ── step 6: clean up ───────────────────────────────────────────────────────
  console.log(Y('Step 6: Cleaning up test file and DB row…'));
  safeDelete(TEST_PATH);
  await cleanupDbRow(db, memoryId);
  console.log('  Test file and DB row removed.\n');

  // ── result ─────────────────────────────────────────────────────────────────
  console.log(G('╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(G('║  ✓  PASS — episode watcher fires and updates conversation_memories  ║'));
  console.log(G('╚══════════════════════════════════════════════════════════════════════╝\n'));
  process.exit(0);
}

// ── utilities ─────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeDelete(filePath: string): void {
  try {
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch { /* ignore */ }
}

async function cleanupDbRow(db: ReturnType<typeof getUserDb>, id: string): Promise<void> {
  try {
    await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${id}`);
  } catch (err: any) {
    console.warn(`  Warning: could not remove test DB row (id=${id}): ${err.message}`);
  }
}

main().catch((err) => {
  console.error(R(`Unhandled error: ${err.message}`));
  process.exit(1);
});
