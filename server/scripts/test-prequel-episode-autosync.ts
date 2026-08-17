/**
 * test-prequel-episode-autosync.ts
 *
 * CI gate: confirms that the prequel episode auto-sync watcher
 * (agent-session-autosave.ts) actually detects a prequel .md file change
 * and updates conversation_memories.
 *
 * Strategy — exercises the real watcher detection path, NOT reimplemented SQL:
 *   1. Pre-seed prequelMtimeMap for all existing prequel files so they are
 *      treated as already-known (no spurious re-syncs of real prequel records).
 *   2. Write a unique sentinel string to docs/prequel-episode-9999.md.
 *   3. Call checkPrequelEpisodeFiles() — the exact function the polling loop runs.
 *      Since the sentinel file has no mtime entry, it is detected as new and
 *      schedulePrequelEpisodeSync() (2s debounce) fires → syncPrequelEpisodeFile()
 *      → DB upsert + re-embed. Existing real prequel files are skipped entirely.
 *   4. Poll conversation_memories for up to 10s waiting for the sentinel content.
 *   5. Assert the row exists and contains the sentinel.
 *   6. Always clean up both the test file and the DB row via a finally block.
 *      Errors thrown inside try propagate to finally — no process.exit() inside
 *      try, so cleanup is guaranteed on every failure path.
 *
 * SELF-CHECK: Removing PREQUEL_RE from agent-session-autosave.ts causes
 * checkPrequelEpisodeFiles() to detect no files → no DB row → test fails.
 *
 * Run: npx tsx server/scripts/test-prequel-episode-autosync.ts
 */

import { existsSync, writeFileSync, unlinkSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';
import { checkPrequelEpisodeFiles, prequelMtimeMap } from '../services/agent-session-autosave';

// ── helpers ────────────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;

const DOCS_DIR   = join(process.cwd(), 'docs');
const TEST_FILE  = 'prequel-episode-9999.md';
const TEST_PATH  = join(DOCS_DIR, TEST_FILE);
const TEST_TITLE = 'Prequel Episode 9999';
// Pattern mirrors PREQUEL_RE in agent-session-autosave.ts — used for pre-seeding
const PREQUEL_RE_LOCAL = /^prequel-episode-(\d+)\.md$/;

// The debounce inside schedulePrequelEpisodeSync is 2s; allow 3.2s for debounce + sync.
const DEBOUNCE_WAIT_MS = 3200;
// Then poll the DB for up to 8s more.
const POLL_TIMEOUT_MS  = 8000;
const POLL_INTERVAL_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function safeDelete(filePath: string): void {
  try { if (existsSync(filePath)) unlinkSync(filePath); } catch { /* ignore */ }
}

async function cleanupDbRow(db: ReturnType<typeof getUserDb>, id: string): Promise<void> {
  // Delete the memory row FIRST so that any in-flight re-embed call that has not
  // yet started its SELECT will find no row and exit without creating embeddings.
  // If a re-embed call has already passed the SELECT it will finish writing
  // embeddings within a short window — we wait for that window before removing.
  try {
    await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${id}`);
    console.log(`  Deleted test DB row: ${id}`);
  } catch (err: any) {
    console.warn(`  Warning: could not remove test DB row (id=${id}): ${err.message}`);
  }

  // Wait for any in-flight re-embed (OpenAI call + DB write) to complete.
  // reembedOne() skips immediately when the memory row is missing, but if it
  // passed the SELECT before we deleted, the embedding INSERT may still land.
  // 6 s covers even a slow OpenAI batch call.
  await sleep(6000);

  // Delete memory_embeddings rows: full-content (conversation_memory),
  // summary anchor (conversation_summary), and verbatim chunks (conversation_chunk
  // with memoryId = "${id}:chunk:N"). Uses LIKE to catch all chunk variants.
  try {
    const embDeleted = await db.execute(sql`
      DELETE FROM memory_embeddings
      WHERE memory_id = ${id}
         OR memory_id LIKE ${id + ':chunk:%'}
    `);
    const count = (embDeleted as any).rowCount ?? (embDeleted as any).rows?.length ?? 0;
    console.log(`  Deleted ${count} memory_embeddings row(s) for test id=${id}`);
  } catch (err: any) {
    console.warn(`  Warning: could not remove memory_embeddings (id=${id}): ${err.message}`);
  }
}

// ── main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log(B('\n╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(B('║  PREQUEL EPISODE AUTOSYNC — CI GATE                                 ║'));
  console.log(B('╚══════════════════════════════════════════════════════════════════════╝\n'));

  const sentinel = `CI-SENTINEL-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const db = getUserDb();
  let memoryId: string | null = null;
  let failed = false;

  try {
    // ── step 1: pre-seed mtime cache for all existing prequel files ──────────
    // This prevents checkPrequelEpisodeFiles() from treating real prequel files
    // as newly-changed and syncing/re-embedding them during the test run.
    console.log(Y('Step 1: Pre-seeding prequelMtimeMap for existing prequel files…'));
    let seedCount = 0;
    try {
      for (const f of readdirSync(DOCS_DIR)) {
        if (PREQUEL_RE_LOCAL.test(f) && f !== TEST_FILE) {
          const mtime = statSync(join(DOCS_DIR, f)).mtimeMs;
          prequelMtimeMap.set(f, mtime);
          seedCount++;
          console.log(`  Seeded: ${f} (mtime=${mtime})`);
        }
      }
    } catch { /* docs/ may not be accessible — that's fine */ }
    console.log(`  Seeded ${seedCount} existing prequel file(s).\n`);

    // ── step 2: write the sentinel test file ─────────────────────────────────
    console.log(Y('Step 2: Writing sentinel test file (prequel-episode-9999.md)…'));
    prequelMtimeMap.delete(TEST_FILE); // ensure no stale entry for test file
    const content = `# Prequel Episode 9999 — CI Test\n\nSentinel: ${sentinel}\n\nThis file is written by the prequel-episode-autosync CI test and deleted after the run.\n`;
    writeFileSync(TEST_PATH, content, 'utf-8');
    console.log(`  Wrote ${TEST_PATH} (${content.length} bytes)`);
    console.log(`  Sentinel: ${sentinel}\n`);

    // ── step 3: fire the real polling detection function ─────────────────────
    console.log(Y('Step 3: Calling checkPrequelEpisodeFiles() — the polling loop function…'));
    console.log('  Only prequel-episode-9999.md has no mtime entry → only it gets scheduled.');
    await checkPrequelEpisodeFiles();
    console.log('  checkPrequelEpisodeFiles() returned — debounce timer armed for sentinel only.\n');

    // ── step 4: wait for debounce + DB write ─────────────────────────────────
    console.log(Y(`Step 4: Waiting ${DEBOUNCE_WAIT_MS}ms for debounce to fire and DB write to complete…`));
    await sleep(DEBOUNCE_WAIT_MS);
    console.log('  Done waiting.\n');

    // ── step 5: poll DB for sentinel ─────────────────────────────────────────
    console.log(Y('Step 5: Polling conversation_memories for the sentinel content…'));
    let dbContent: string | null = null;
    const deadline = Date.now() + POLL_TIMEOUT_MS;

    while (Date.now() < deadline) {
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
      await sleep(POLL_INTERVAL_MS);
    }

    // ── step 6: assert — throw instead of process.exit so finally runs ───────
    if (!memoryId) {
      failed = true;
      throw new Error(
        `No conversation_memories row found with title="${TEST_TITLE}" within timeout.\n` +
        '  Check: PREQUEL_RE pattern, checkPrequelEpisodeFiles() mtime detection,\n' +
        '  schedulePrequelEpisodeSync() debounce, or syncPrequelEpisodeFile() DB write.',
      );
    }

    if (!dbContent?.includes(sentinel)) {
      failed = true;
      throw new Error(
        `Row found (id=${memoryId}) but content does not contain the expected sentinel.\n` +
        `  Expected: ${sentinel}\n` +
        `  Got (first 300 chars): ${dbContent?.slice(0, 300)}`,
      );
    }

    console.log(G(`  ✓ Row found: id=${memoryId}`));
    console.log(G(`  ✓ Content contains sentinel — PREQUEL_RE watcher detection path confirmed working.\n`));

  } finally {
    // ── step 7: always clean up file + DB row ────────────────────────────────
    // Runs on both success and throw (process.exit is NOT used inside try).
    console.log(Y('Step 7 (finally): Cleaning up test file and DB row…'));
    safeDelete(TEST_PATH);
    if (memoryId) await cleanupDbRow(db, memoryId);
    console.log('  Cleanup complete.\n');
  }

  // Only reached on success (finally ran without re-throwing)
  if (failed) {
    // Should not reach here since we throw on failure, but guard anyway
    process.exit(1);
  }

  console.log(G('╔══════════════════════════════════════════════════════════════════════╗'));
  console.log(G('║  ✓  PASS — prequel watcher fires and updates conversation_memories  ║'));
  console.log(G('╚══════════════════════════════════════════════════════════════════════╝\n'));

  // Force exit so the Node.js event loop does not wait for the background
  // re-embed task (OpenAI HTTP + DB write) that was triggered by
  // schedulePrequelEpisodeSync(). Without this, the process can hang for up
  // to 2 minutes waiting for in-flight async work to drain.
  process.exit(0);
}

main().catch((err) => {
  console.error(R(`\n  ✗ FAIL: ${err.message}`));
  process.exit(1);
});
