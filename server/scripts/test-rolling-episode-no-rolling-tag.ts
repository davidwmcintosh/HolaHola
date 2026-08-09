/**
 * test-rolling-episode-no-rolling-tag.ts
 *
 * Self-check: confirms that checkEpisodeAppend() logs a warning and skips the
 * append when the trigger file omits the "episode" field AND the DB has no row
 * tagged 'rolling'.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What is tested
 * ─────────────────────────────────────────────────────────────────────────────
 *   checkEpisodeAppend() contains the following null-guard:
 *
 *     if (!episodeFilename) {
 *       console.warn('[AgentAutosave] Episode append: no episode specified and
 *                     no rolling episode found in DB — skipping');
 *       return;
 *     }
 *
 *   When the trigger JSON has no "episode" field, the function calls
 *   getCurrentRollingEpisodeFilename().  If the DB returns no rolling rows, it
 *   returns null and the guard fires — logging the warning and returning early.
 *
 *   This script verifies both halves:
 *     1. The specific console.warn message is emitted.
 *     2. No episode .md file on disk is modified.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this self-check catches guard removal
 * ─────────────────────────────────────────────────────────────────────────────
 *   If the null-guard is removed from checkEpisodeAppend:
 *     • console.warn is not called → assertion (1) fails → script exits 1.
 *     • appendExchangeToEpisode(exchange, null) throws a TypeError in join()
 *       which is silently swallowed by checkEpisodeAppend's outer catch block,
 *       so the file-unchanged assertion (2) alone would not catch the regression.
 *   The warning-capture assertion is therefore the primary guard detector.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DB safety
 * ─────────────────────────────────────────────────────────────────────────────
 *   The test temporarily removes the 'rolling' tag from any episode rows so
 *   getCurrentRollingEpisodeFilename() returns null even when the live episode
 *   row exists.  Tags are restored in a finally block regardless of outcome.
 *
 * Run:
 *   npx tsx server/scripts/test-rolling-episode-no-rolling-tag.ts
 */

import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { checkEpisodeAppend } from '../services/agent-session-autosave';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE           = process.cwd();
const EPISODE_APPEND_PATH = join(WORKSPACE, '.local', '.episode_append');
const DOCS_DIR            = join(WORKSPACE, 'docs');
const EPISODE_RE          = /^episode-\d+\.md$/;

// ── Assertion accumulator ─────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(label: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

/** Sleep ms milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Write payload to EPISODE_APPEND_PATH and spin until its mtime is strictly
 * newer than afterMs (or 2 s elapsed).  Guards against sub-ms filesystem
 * clock resolution.
 */
async function writeAppendTrigger(payload: string, afterMs: number): Promise<number> {
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline) {
    writeFileSync(EPISODE_APPEND_PATH, payload, 'utf-8');
    const mtime = statSync(EPISODE_APPEND_PATH).mtimeMs;
    if (mtime > afterMs) return mtime;
    await sleep(5);
  }
  return statSync(EPISODE_APPEND_PATH).mtimeMs;
}

/**
 * Snapshot the mtime of every docs/episode-*.md file so we can verify none
 * were modified after the test.
 */
function snapshotEpisodeMtimes(): Map<string, number> {
  const snapshot = new Map<string, number>();
  try {
    const files = readdirSync(DOCS_DIR).filter(f => EPISODE_RE.test(f));
    for (const f of files) {
      try {
        snapshot.set(f, statSync(join(DOCS_DIR, f)).mtimeMs);
      } catch { /* ignore unreadable files */ }
    }
  } catch { /* ignore if docs/ doesn't exist */ }
  return snapshot;
}

/**
 * Compare current episode mtimes against a snapshot.
 * Returns the list of files whose mtime changed.
 */
function detectEpisodeWrites(snapshot: Map<string, number>): string[] {
  const changed: string[] = [];
  for (const [filename, oldMtime] of snapshot) {
    try {
      const newMtime = statSync(join(DOCS_DIR, filename)).mtimeMs;
      if (newMtime !== oldMtime) changed.push(filename);
    } catch { /* ignore */ }
  }
  // Also catch files that didn't exist before (new files created during test)
  try {
    const currentFiles = readdirSync(DOCS_DIR).filter(f => EPISODE_RE.test(f));
    for (const f of currentFiles) {
      if (!snapshot.has(f)) changed.push(f + ' (NEW)');
    }
  } catch { /* ignore */ }
  return changed;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }

  console.log('\n' + '═'.repeat(70));
  console.log(B('  Rolling Episode Auto-Detect — No-Rolling-Tag Self-Check'));
  console.log('═'.repeat(70));
  console.log(Y('  Verifies checkEpisodeAppend() logs warning + skips when DB has no rolling rows.'));

  const db = getSharedDb();

  // ── Step 1: Find all rows currently tagged 'rolling' ─────────────────────
  sep();
  console.log(B('STEP 1 — Discover rolling episode rows'));
  sep();

  const rollingRows = await db.execute(sql`
    SELECT id, title, tags
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
  `);
  const rows: Array<{ id: string; title: string; tags: string[] }> =
    ((rollingRows as any).rows ?? (rollingRows as any)) as any[];

  console.log(Y(`  ℹ  Found ${rows.length} rolling row(s):`));
  for (const r of rows) {
    console.log(Y(`       ${r.id.slice(0, 8)}…  "${r.title}"  tags=${JSON.stringify(r.tags)}`));
  }

  // ── Step 2: Remove 'rolling' tag temporarily ──────────────────────────────
  sep();
  console.log(B('STEP 2 — Temporarily strip \'rolling\' tag from all rolling rows'));
  sep();

  try {
    if (rows.length > 0) {
      await db.execute(sql`
        UPDATE conversation_memories
        SET tags = array_remove(tags, 'rolling')
        WHERE arc_name = 'HolaHola Episodes'
          AND 'rolling' = ANY(tags)
      `);
      console.log(Y(`  ℹ  'rolling' tag removed from ${rows.length} row(s)`));
    } else {
      console.log(Y(`  ℹ  No rolling rows to strip — DB already clean`));
    }

    // Verify the strip worked
    const verifyStrip = await db.execute(sql`
      SELECT COUNT(*)::int AS n
      FROM conversation_memories
      WHERE arc_name = 'HolaHola Episodes'
        AND 'rolling' = ANY(tags)
    `);
    const countAfterStrip = Number(
      ((verifyStrip as any).rows?.[0]?.n ?? (verifyStrip as any)[0]?.n) ?? 0,
    );
    assert(
      'No rolling rows exist in DB before test (prerequisite)',
      countAfterStrip === 0,
      `Expected 0 rolling rows, found ${countAfterStrip}`,
    );

    // ── Step 3: Snapshot episode file mtimes ──────────────────────────────
    sep();
    console.log(B('STEP 3 — Snapshot episode .md mtimes'));
    sep();

    const mtimeSnapshot = snapshotEpisodeMtimes();
    console.log(Y(`  ℹ  Snapshotted ${mtimeSnapshot.size} episode file(s)`));

    // ── Step 4: Capture console.warn calls ───────────────────────────────
    sep();
    console.log(B('STEP 4 — Install console.warn interceptor'));
    sep();

    const capturedWarnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: any[]) => {
      const msg = args.map(a => String(a)).join(' ');
      capturedWarnings.push(msg);
      originalWarn(...args); // still print to stdout for visibility
    };

    // ── Step 5: Write a no-episode trigger payload ────────────────────────
    sep();
    console.log(B('STEP 5 — Write no-episode trigger payload and prime watcher'));
    sep();

    // Payload with "exchange" but no "episode" field — forces DB auto-detect
    const sentinel  = `[CI-TEST-939-${Date.now()}] no-rolling-tag self-check`;
    const exchange  = `\n<!-- ${sentinel} -->`;
    const payload   = JSON.stringify({ exchange }); // intentionally no "episode"

    const mtime0 = await writeAppendTrigger(payload, 0);
    console.log(Y(`  ℹ  Trigger written — payload: ${payload.slice(0, 80)}`));
    console.log(Y(`  ℹ  mtime0 = ${mtime0}`));

    // First call: prev === 0 → skips, stamps mtime0 into module state
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  Prime call complete (prev=0 path; watcher stamped mtime0)`));

    // ── Step 6: Re-write with fresh mtime and call watcher ────────────────
    sep();
    console.log(B('STEP 6 — Re-write trigger with fresh mtime, call checkEpisodeAppend()'));
    sep();

    const mtime1 = await writeAppendTrigger(payload, mtime0);
    console.log(Y(`  ℹ  Trigger re-written — mtime1 = ${mtime1}`));
    assert(
      'Trigger mtime advanced (prerequisite for watcher detection)',
      mtime1 > mtime0,
      `mtime1 (${mtime1}) must be > mtime0 (${mtime0})`,
    );

    // This call sees: no "episode" field → looks up DB → finds no rolling rows
    // → getCurrentRollingEpisodeFilename() returns null → null-guard fires
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  checkEpisodeAppend() returned`));

    // Restore warn before assertions that might also call it
    console.warn = originalWarn;

    // ── Step 7: Assert warning was emitted ───────────────────────────────
    sep();
    console.log(B('STEP 7 — Assert "no rolling episode found" warning was logged'));
    sep();

    const EXPECTED_WARNING = 'no rolling episode found in DB';
    const warningFound = capturedWarnings.some(w => w.includes(EXPECTED_WARNING));
    console.log(Y(`  ℹ  Captured ${capturedWarnings.length} console.warn call(s):`));
    for (const w of capturedWarnings) {
      console.log(Y(`       "${w.slice(0, 120)}"`));
    }

    assert(
      `console.warn includes "${EXPECTED_WARNING}"`,
      warningFound,
      warningFound
        ? undefined
        : `Expected warning not found. This means the null-guard in checkEpisodeAppend` +
          ` was not reached — guard may have been removed or the code path changed.` +
          `\n       Captured warnings: ${JSON.stringify(capturedWarnings)}`,
    );

    // ── Step 8: Assert no episode file was modified ───────────────────────
    sep();
    console.log(B('STEP 8 — Assert no episode .md was modified'));
    sep();

    const changedFiles = detectEpisodeWrites(mtimeSnapshot);
    assert(
      'No episode .md was written to (skip path held)',
      changedFiles.length === 0,
      changedFiles.length > 0
        ? `Files unexpectedly modified: ${changedFiles.join(', ')}`
        : undefined,
    );

    // ── Step 9: Assert sentinel does not appear in any episode file ───────
    sep();
    console.log(B('STEP 9 — Assert sentinel not present in any episode .md'));
    sep();

    let sentinelFound = false;
    let sentinelFile  = '';
    try {
      const files = readdirSync(DOCS_DIR).filter(f => EPISODE_RE.test(f));
      for (const f of files) {
        try {
          const content = readFileSync(join(DOCS_DIR, f), 'utf-8');
          if (content.includes(sentinel)) {
            sentinelFound = true;
            sentinelFile  = f;
            break;
          }
        } catch { /* ignore */ }
      }
    } catch { /* ignore */ }

    assert(
      'Sentinel text does not appear in any episode .md (append was skipped)',
      !sentinelFound,
      sentinelFound
        ? `Sentinel found in ${sentinelFile} — append was NOT skipped despite null rolling result`
        : undefined,
    );

  } finally {
    // ── Restore rolling tags ──────────────────────────────────────────────
    sep();
    console.log(B('CLEANUP — Restore \'rolling\' tag on all previously-rolling rows'));
    sep();

    // Restore console.warn in case an early error bypassed the in-try restore
    // (safe to call multiple times)

    for (const row of rows) {
      try {
        await db.execute(sql`
          UPDATE conversation_memories
          SET tags = array_append(array_remove(tags, 'rolling'), 'rolling')
          WHERE id = ${row.id}
        `);
        console.log(Y(`  ℹ  Restored 'rolling' tag on row ${row.id.slice(0, 8)}… ("${row.title}")`));
      } catch (err: any) {
        console.error(R(`  ✗  Failed to restore 'rolling' tag on ${row.id.slice(0, 8)}: ${err.message}`));
        failed++;
      }
    }

    // Clear trigger file so nothing re-fires on next poll
    try {
      if (existsSync(EPISODE_APPEND_PATH)) {
        writeFileSync(EPISODE_APPEND_PATH, '', 'utf-8');
        console.log(Y(`  ℹ  Trigger file cleared`));
      }
    } catch { /* ignore */ }

    // Verify rolling tags were restored
    try {
      const restoreCheck = await db.execute(sql`
        SELECT COUNT(*)::int AS n
        FROM conversation_memories
        WHERE arc_name = 'HolaHola Episodes'
          AND 'rolling' = ANY(tags)
      `);
      const countRestored = Number(
        ((restoreCheck as any).rows?.[0]?.n ?? (restoreCheck as any)[0]?.n) ?? 0,
      );
      assert(
        `Rolling tag restored on ${rows.length} row(s) (found ${countRestored})`,
        countRestored === rows.length,
        `Expected ${rows.length} rolling rows after restore, found ${countRestored}`,
      );
    } catch (err: any) {
      console.error(R(`  ✗  Failed to verify restore: ${err.message}`));
      failed++;
    }
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(
      `\n✓  All ${total} assertions passed.\n` +
      `   null-guard in checkEpisodeAppend is sound:\n` +
      `   • "no rolling episode found" warning was logged\n` +
      `   • No episode .md was modified\n` +
      `\n   NOTE: This script fails when the null-guard is removed because\n` +
      `   console.warn would not be called → assertion (STEP 7) exits 1.\n`,
    ));
    process.exit(0);
  } else {
    console.log(R(`\n✗  ${failed} of ${total} assertions failed.\n`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
});
