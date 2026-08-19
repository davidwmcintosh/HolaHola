/**
 * test-inner-life-reembed-failure.ts
 *
 * CI check: confirms that appendInnerLifeToEpisodeDb() writes the episode .md
 * exactly once per call even when reembedConversationMemory() throws, and that
 * the function still returns without throwing (reembed is fire-and-forget).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The reembed step in appendInnerLifeToEpisodeDb() is intentionally
 * fire-and-forget: a reembed failure must never:
 *   (a) prevent the .md file from being written, or
 *   (b) cause the function to throw/reject (which could make callers retry,
 *       triggering a second DB UPDATE + second .md write with duplicated content).
 *
 * Three exported test seams drive this test:
 *
 *   setReembedShouldThrowForTest(true)
 *     — the reembedConversationMemory() call inside appendInnerLifeToEpisodeDb()
 *       rejects with a synthetic error instead of running, simulating a real
 *       network / OpenAI failure.
 *
 *   resetInnerLifeFileWriteCountForTest() / getInnerLifeFileWriteCountForTest()
 *     — counts how many times writeFileSync() fires inside the function's
 *       success path so the test can assert exactly-once semantics.
 *
 *   clearEpisodeIdCacheForTest()
 *     — empties the in-memory episode ID cache so the DB lookup always runs.
 *
 * The test uses a real DB row (Episode 9999 — synthetic, created and deleted
 * inline with a fixed UUID) so the function proceeds past the ID-lookup step
 * and reaches the writeFileSync path.  A temporary docs/episode-9999.md file
 * is also created.  File content is captured INSIDE the try block, before the
 * finally cleanup, so the content assertions use real file bytes.
 *
 * Collision safety: FAKE_MEMORY_ID is a fixed, non-random UUID that cannot
 * collide with any real episode row.  The DB insert uses ON CONFLICT DO UPDATE
 * (idempotent), and the finally block always deletes the row.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Creates docs/episode-9999.md with initial content.
 *   2. Inserts a synthetic conversation_memories row for "Episode 9999".
 *   3. Forces reembed to throw via the seam.
 *   4. Resets the write counter.
 *   5. Calls appendInnerLifeToEpisodeDbForTest() — expects no throw.
 *   6. Reads .md content BEFORE finally cleanup.
 *   7. Asserts write counter === 1 (exactly one .md write).
 *   8. Asserts sentinel text appears in the .md exactly once.
 *   9. Asserts a console.error was logged for the reembed failure.
 *  10. Cleans up in finally: removes fixture file + DB row.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the test would catch a double-write regression:
 *   1. Calls appendInnerLifeToEpisodeDbForTest() TWICE (simulating a caller
 *      that retried after misinterpreting a reembed failure as a full failure).
 *   2. Reads .md content BEFORE finally cleanup.
 *   3. Asserts write counter === 2 (double-write is detectable).
 *   4. Asserts sentinel text appears in the .md exactly TWICE.
 *   These confirm the test infrastructure can detect a double-write, so the
 *   normal-mode assertion of exactly-once is load-bearing.
 *
 * Run:
 *   npx tsx server/scripts/test-inner-life-reembed-failure.ts
 *   npx tsx server/scripts/test-inner-life-reembed-failure.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getUserDb } from '../db';
import { sql } from 'drizzle-orm';

import {
  appendInnerLifeToEpisodeDbForTest,
  clearEpisodeIdCacheForTest,
  setReembedShouldThrowForTest,
  getReembedShouldThrowForTest,
  resetInnerLifeFileWriteCountForTest,
  getInnerLifeFileWriteCountForTest,
} from '../services/agent-session-autosave';

// ── Colour helpers ────────────────────────────────────────────────────────────
const GREEN  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const RED    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const BOLD   = (s: string) => `\x1b[1m${s}\x1b[0m`;

const isSelfCheck = process.argv.includes('--self-check');

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE       = process.cwd();
const DOCS_DIR        = join(WORKSPACE, 'docs');
const FAKE_FILENAME   = 'episode-9999.md';
const FAKE_PATH       = join(DOCS_DIR, FAKE_FILENAME);
// Fixed UUID — cannot collide with any real episode row; ON CONFLICT DO UPDATE
// ensures the row is always restored to INITIAL_CONTENT before each test run.
const FAKE_MEMORY_ID  = '99999999-0000-4000-8000-000000009999';
const INITIAL_CONTENT = '# Episode 9999\n\nTest fixture — CI only\n';
const SENTINEL_TEXT   = '[Luca — felt: CI-reembed-failure sentinel\nThis text must appear exactly once.]';
// Self-check uses a DISTINCT second sentinel: appendInnerLifeToEpisodeDb now
// has a content-idempotency guard (Task #1235) that correctly skips an
// identical duplicate append, so the double-write proof uses two different
// texts — write counter and content counting still detect both writes.
const SENTINEL_TEXT_2 = '[Luca — felt: CI-reembed-failure sentinel #2\nSecond distinct entry for the double-write self-check.]';

// ── Helpers ───────────────────────────────────────────────────────────────────
function pass(msg: string): void { console.log(GREEN('  PASS') + '  ' + msg); }
function fail(msg: string): void { console.log(RED('  FAIL') + '  ' + msg); }

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

// ── DB helpers ────────────────────────────────────────────────────────────────
async function insertFakeEpisodeRow(): Promise<void> {
  const db = getUserDb();
  await db.execute(sql`
    INSERT INTO conversation_memories
      (id, title, summary, content, participants, tags, importance, created_at, entry_type, arc_name)
    VALUES (
      ${FAKE_MEMORY_ID},
      'Episode 9999',
      'CI fixture — reembed-failure test',
      ${INITIAL_CONTENT},
      ARRAY['luca']::text[],
      ARRAY['rolling','ci-test']::text[],
      5,
      NOW(),
      'episode',
      'HolaHola Episodes'
    )
    ON CONFLICT (id) DO UPDATE
      SET content = ${INITIAL_CONTENT},
          title   = 'Episode 9999'
  `);
}

async function deleteFakeEpisodeRow(): Promise<void> {
  try {
    const db = getUserDb();
    await db.execute(sql`DELETE FROM conversation_memories WHERE id = ${FAKE_MEMORY_ID}`);
  } catch { /* best-effort cleanup */ }
}

// ── Test ──────────────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  console.log(BOLD(`\ntest-inner-life-reembed-failure — ${isSelfCheck ? 'SELF-CHECK' : 'NORMAL'} mode\n`));

  // Capture the original seam state so we can restore it in finally.
  const originalReembedThrow = getReembedShouldThrowForTest();

  // Insert synthetic DB row + create .md fixture.
  await insertFakeEpisodeRow();
  writeFileSync(FAKE_PATH, INITIAL_CONTENT, 'utf-8');

  // Intercept console.error to capture reembed-failure log output.
  const errorLogs: string[] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const line = args.map(a => (typeof a === 'string' ? a : String(a))).join(' ');
    errorLogs.push(line);
    originalError(...args);
  };

  let threw = false;
  // Content captured INSIDE the try block, before finally cleanup, so
  // assertions reflect the real file bytes at the moment after the call(s).
  let contentAfterCall = INITIAL_CONTENT;

  try {
    // Always make reembed throw so we test the fire-and-forget path.
    setReembedShouldThrowForTest(true);
    // Reset write counter before the call(s).
    resetInnerLifeFileWriteCountForTest();
    // Clear the episode ID cache so a fresh DB lookup happens.
    clearEpisodeIdCacheForTest();

    if (isSelfCheck) {
      console.log(YELLOW('  [self-check] Calling function TWICE to simulate a retry — write count and content must reflect 2 writes\n'));
      await appendInnerLifeToEpisodeDbForTest(SENTINEL_TEXT, FAKE_FILENAME);
      // Second call: clear cache to force a second DB UPDATE + second .md write.
      // Uses a distinct sentinel — an identical one is now (correctly) skipped
      // by the duplicate-append idempotency guard.
      clearEpisodeIdCacheForTest();
      await appendInnerLifeToEpisodeDbForTest(SENTINEL_TEXT_2, FAKE_FILENAME);
    } else {
      // Normal mode: single call — function must return cleanly, .md written once.
      await appendInnerLifeToEpisodeDbForTest(SENTINEL_TEXT, FAKE_FILENAME);
    }

    // Capture content HERE — before finally removes the file.
    if (existsSync(FAKE_PATH)) {
      contentAfterCall = readFileSync(FAKE_PATH, 'utf-8');
    } else {
      contentAfterCall = '';
    }
  } catch (err: any) {
    threw = true;
    console.log(RED('  ERROR') + '  Function threw unexpectedly: ' + err.message);
    // Still capture what's on disk so the content assertion is meaningful.
    if (existsSync(FAKE_PATH)) {
      contentAfterCall = readFileSync(FAKE_PATH, 'utf-8');
    }
  } finally {
    // Restore seam and interceptors.
    setReembedShouldThrowForTest(originalReembedThrow);
    console.error = originalError;

    // Remove fixture file and DB row.
    try { if (existsSync(FAKE_PATH)) unlinkSync(FAKE_PATH); } catch { /* ignore */ }
    await deleteFakeEpisodeRow();
  }

  // ── Assertions ──────────────────────────────────────────────────────────────
  let failures = 0;

  if (isSelfCheck) {
    // ── Self-check: two calls → write count === 2, sentinel appears twice ─────
    // Confirms the test infrastructure can detect a double-write; therefore
    // the normal-mode assertion of exactly-once is load-bearing.

    const writeCount = getInnerLifeFileWriteCountForTest();
    if (writeCount === 2) {
      pass(`Write counter === 2 after two calls — double-write is detectable ✓`);
    } else {
      fail(`Expected write counter 2 after two calls, got ${writeCount} — self-check infrastructure broken`);
      failures++;
    }

    const sentinelCount = countOccurrences(contentAfterCall, SENTINEL_TEXT)
      + countOccurrences(contentAfterCall, SENTINEL_TEXT_2);
    if (sentinelCount === 2) {
      pass(`Both sentinel texts present in .md (2 total) — file content confirms double-write is detectable ✓`);
    } else {
      fail(`Expected 2 sentinel entries in .md, found ${sentinelCount} — self-check infrastructure broken`);
      failures++;
    }

    if (!threw) {
      pass('Neither call threw — reembed fire-and-forget path confirmed ✓');
    } else {
      fail('A call threw — unexpected');
      failures++;
    }
  } else {
    // ── Normal mode: single call with reembed throwing ────────────────────────

    // (a) Function must not throw.
    if (!threw) {
      pass('Function returned without throwing — reembed failure does not propagate ✓');
    } else {
      fail('Function threw — reembed failure must not propagate to caller');
      failures++;
    }

    // (b) Write counter must be exactly 1.
    const writeCount = getInnerLifeFileWriteCountForTest();
    if (writeCount === 1) {
      pass('Write counter === 1 — episode .md written exactly once ✓');
    } else {
      fail(`Write counter === ${writeCount} — expected exactly 1 write per append call`);
      failures++;
    }

    // (c) Sentinel text must appear exactly once in the .md.
    const sentinelCount = countOccurrences(contentAfterCall, SENTINEL_TEXT);
    if (sentinelCount === 1) {
      pass('Sentinel text appears exactly once in .md — content confirms single write ✓');
    } else if (sentinelCount === 0) {
      fail(
        `Sentinel text absent from .md — the .md write did not occur.\n` +
        `  File content (first 200 chars): ${JSON.stringify(contentAfterCall.slice(0, 200))}`,
      );
      failures++;
    } else {
      fail(`Sentinel text appears ${sentinelCount} times in .md — expected exactly 1`);
      failures++;
    }

    // (d) console.error must have been called with the reembed-failure message.
    const reembedErrorLogged = errorLogs.some(l =>
      l.includes('Re-embed failed') && l.includes(FAKE_FILENAME),
    );
    if (reembedErrorLogged) {
      pass('console.error logged reembed failure — error is not silently swallowed ✓');
    } else {
      fail(
        `Expected a "[AgentAutosave] Re-embed failed for ${FAKE_FILENAME}" error log.\n` +
        `  Captured errors:\n    ${errorLogs.join('\n    ') || '(none)'}`,
      );
      failures++;
    }
  }

  console.log('');
  if (failures === 0) {
    console.log(GREEN(BOLD('All assertions passed.\n')));
    process.exit(0);
  } else {
    console.log(RED(BOLD(`${failures} assertion(s) failed.\n`)));
    process.exit(1);
  }
}

run().catch(err => {
  console.error(RED('Unhandled error:'), err);
  process.exit(1);
});
