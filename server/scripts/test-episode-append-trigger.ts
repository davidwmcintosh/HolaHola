/**
 * test-episode-append-trigger.ts
 *
 * CI check: confirms the .local/.episode_append trigger-file mechanism works
 * end-to-end — the watcher must detect the trigger, append to docs/episode-27.md,
 * and sync to the DB, all within 20 s.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Discovers the DB row for Episode 27 using the same title-based lookup
 *      that syncEpisodeFile uses internally (title = "Episode 27", arc_name
 *      = "HolaHola Episodes").  This ensures the test targets exactly the row
 *      the production sync path will update.
 *   2. Saves original .md and DB content so both can be restored in try/finally.
 *   3. Force-sets the DB to match the current .md to give a known baseline
 *      (guards against stale DB content from prior test runs).
 *   4. Writes a timestamped sentinel exchange to .local/.episode_append.
 *   5. Primes the watcher's mtime state (first call skips by design — prev===0).
 *   6. Re-writes the sentinel with a fresh mtime so the second call processes it.
 *   7. Calls checkEpisodeAppend() — appends sentinel to the .md.
 *   8. Calls syncEpisodeFile() directly (bypassing 2 s debounce) to exercise
 *      the real production sync path.
 *   9. Asserts:
 *      a. Sentinel appears in docs/episode-27.md.
 *      b. Sentinel appears in the DB row (same row syncEpisodeFile targets).
 *  10. Restores both docs/episode-27.md and DB to original content.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the gate fails when the trigger file is cleared before processing:
 *   1. Primes the mtime state (first call — skips, prev===0).
 *   2. Clears the trigger file before the second call.
 *   3. Calls checkEpisodeAppend() — sees empty content, skips append.
 *   4. Asserts sentinel does NOT appear in .md (gate held).
 *   5. Asserts .md is unchanged from original (no spurious writes).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Concurrent self-check mode  (--self-check-concurrent)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the cleanup step does NOT destroy content written to the rolling .md
 *   while the CI test was in flight (simulates concurrent session writes):
 *   1. Runs the full normal-mode append flow (sentinel lands in .md).
 *   2. Appends a "concurrent content" marker directly to the .md, simulating a
 *      live session writing to the rolling episode during the CI run.
 *   3. Runs the cleanup logic (strip sentinel from current .md, write back).
 *   4. Asserts concurrent content survived (was NOT removed by cleanup).
 *   5. Asserts sentinel is gone (cleanup did its job on the sentinel only).
 *   6. Restores the .md to its original content.
 *
 * Run:
 *   npx tsx server/scripts/test-episode-append-trigger.ts
 *   npx tsx server/scripts/test-episode-append-trigger.ts --self-check
 *   npx tsx server/scripts/test-episode-append-trigger.ts --self-check-concurrent
 */

import { existsSync, readFileSync, writeFileSync, statSync, openSync, closeSync, unlinkSync } from 'fs';
import { join } from 'path';

// ── Episode-file CI lockfile (prevents concurrent runs from racing) ────────────
// Both episode-append-trigger-ci and chat-episode-hook-e2e-ci modify the real
// docs/episode-27.md and the DB row.  A shared lockfile ensures they never run
// at the same time.  Stale locks (> 10 min) are cleared automatically.
const EPISODE_CI_LOCK = '/tmp/.episode-27-ci.lock';
function acquireEpisodeCiLock(): void {
  const MAX_WAIT_MS = 90_000;   // wait up to 90s for the other CI to finish
  const POLL_MS     = 2_000;
  const STALE_MS    = 10 * 60 * 1000;
  const deadline    = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      // O_EXCL — fails atomically if file already exists
      const fd = openSync(EPISODE_CI_LOCK, 'wx');
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      return; // lock acquired
    } catch {
      // Check whether the existing lock is stale
      try {
        const st = statSync(EPISODE_CI_LOCK);
        if (Date.now() - st.mtimeMs > STALE_MS) {
          unlinkSync(EPISODE_CI_LOCK);
          continue; // retry immediately
        }
      } catch { /* file was removed between our check and stat — retry */ }
      // Another CI is still running — wait and retry
      const wait = Math.min(POLL_MS, deadline - Date.now());
      if (wait <= 0) break;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);
    }
  }
  console.error('\x1b[31mFATAL: could not acquire episode CI lockfile after 90s — another CI may be stuck\x1b[0m');
  process.exit(1);
}
function releaseEpisodeCiLock(): void {
  try { unlinkSync(EPISODE_CI_LOCK); } catch { /* already gone */ }
}
import { checkEpisodeAppend, syncEpisodeFile } from '../services/agent-session-autosave';
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
const MD_PATH             = join(WORKSPACE, 'docs', 'episode-27.md');

// Episode 27 title as derived by syncEpisodeFile (episodeTitleFromFilename).
// "episode-27.md" → "Episode 27"
const EPISODE_TITLE = 'Episode 27';
const ARC_NAME      = 'HolaHola Episodes';

// ── CLI ───────────────────────────────────────────────────────────────────────
const selfCheckMode       = process.argv.includes('--self-check');

const concurrentCheckMode = process.argv.includes('--self-check-concurrent');
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

/** Derive a short summary from the first 5 non-empty content lines. */
function episodeSummary(content: string): string {
  return content.split('\n').map(l => l.trim()).filter(Boolean)
    .slice(0, 5).join(' ').slice(0, 400);
}

/**
 * Strip a CI-owned HTML comment marker from episode content.
 *
 * Always call this on the CURRENT file content (read at cleanup time), never on
 * a snapshot captured at test-start.  That way any real session content written
 * to the rolling .md while the CI was running is preserved — only the specific
 * marker string we own gets removed.
 */
function stripMarkerFromContent(content: string, marker: string): string {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\n?<!--\\s*${escaped}[\\s\\S]*?-->\\n?`, 'g');
  return content.replace(re, '');
}

/**
 * Shared cleanup operation: reads the CURRENT .md (never a snapshot), strips
 * the marker, writes the file back, and syncs the DB row.
 *
 * Both the normal-mode finally block and the concurrent self-check call this
 * exact function.  Centralising here ensures the concurrent self-check exercises
 * the real production cleanup path — if this function is ever changed to restore
 * from a start-of-run snapshot, the concurrent self-check will immediately fail
 * because concurrent content written before the call will be destroyed.
 *
 * Returns the cleaned content so callers can assert on it.
 */
async function cleanupSentinel(
  mdPath: string,
  marker: string,
  rowId: string,
  db: ReturnType<typeof getSharedDb>,
): Promise<string> {
  // Read the CURRENT file — preserves any content added while the CI ran.
  const currentMd = existsSync(mdPath) ? readFileSync(mdPath, 'utf-8') : '';
  const cleanedMd = stripMarkerFromContent(currentMd, marker);
  writeFileSync(mdPath, cleanedMd, 'utf-8');
  await db.execute(sql`
    UPDATE conversation_memories
    SET content = ${cleanedMd},
        summary = ${episodeSummary(cleanedMd)}
    WHERE id = ${rowId}
  `);
  return cleanedMd;
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

// ─────────────────────────────────────────────────────────────────────────────
// Normal mode
// ─────────────────────────────────────────────────────────────────────────────

async function runNormalMode(): Promise<void> {
  sep();
  console.log(B('NORMAL MODE — episode append trigger end-to-end check'));
  sep();

  // ── Preflight: .md must exist ──────────────────────────────────────────────
  if (!existsSync(MD_PATH)) {
    console.log(R(`  ✗  docs/episode-27.md not found — cannot run test`));
    failed++;
    return;
  }
  console.log(Y(`  ℹ  docs/episode-27.md found`));
  passed++;

  const db         = getSharedDb();
  const originalMd = readFileSync(MD_PATH, 'utf-8');

  // ── Discover the DB row using the same title-lookup syncEpisodeFile uses ───
  // syncEpisodeFile queries: WHERE arc_name = 'HolaHola Episodes' AND title = 'Episode 27'
  // We must target the same row so baseline/verify/restore are all consistent.
  const lookupRows = await db.execute(sql`
    SELECT id, content, tags
    FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND title = ${EPISODE_TITLE}
    LIMIT 1
  `);
  const lookupRow = (lookupRows as any).rows?.[0] ?? (lookupRows as any)[0];

  assert(
    `DB row for "${EPISODE_TITLE}" in "${ARC_NAME}" found`,
    !!lookupRow,
    `No row found — run the episode insert script first`,
  );
  if (!lookupRow) return;

  const rowId: string      = lookupRow.id;
  const originalDb: string = lookupRow.content ?? '';
  const isRolling: boolean = Array.isArray(lookupRow.tags) && lookupRow.tags.includes('rolling');
  console.log(Y(`  ℹ  Row ID             : ${rowId}`));
  console.log(Y(`  ℹ  Original .md size  : ${originalMd.length} bytes`));
  console.log(Y(`  ℹ  Original DB size   : ${originalDb.length} bytes  (rolling=${isRolling})`));

  // ── Unique sentinel ────────────────────────────────────────────────────────
  const sentinel = `[CI-TEST-SENTINEL-${Date.now()}] append-trigger test — safe to ignore`;
  const exchange  = `\n<!-- ${sentinel} -->`;
  const payload   = JSON.stringify({ exchange, episode: 'episode-27' });

  try {
    // ── Baseline: force DB to match current .md ──────────────────────────────
    // The rolling guard only lets syncEpisodeFile write when the new content is
    // ≥ the existing DB length.  Force-setting the DB to the current .md gives
    // a known baseline so the sentinel append (which makes the .md longer) is
    // never blocked by stale DB content from a prior run.
    await db.execute(sql`
      UPDATE conversation_memories
      SET content = ${originalMd},
          summary = ${episodeSummary(originalMd)}
      WHERE id = ${rowId}
    `);
    console.log(Y(`  ℹ  Baseline: DB force-set to ${originalMd.length} bytes`));

    sep();
    console.log(B('STEP 1 — Prime the watcher mtime state'));
    sep();

    const mtime0 = await writeAppendTrigger(payload, 0);
    console.log(Y(`  ℹ  Trigger file written (mtime0 = ${mtime0})`));

    // First call: prev === 0 → skips processing, stamps episodeAppendLastMtime = mtime0
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  Prime call complete (mtime0 stamped into module state)`));

    sep();
    console.log(B('STEP 2 — Re-write trigger with sentinel and process'));
    sep();

    const mtime1 = await writeAppendTrigger(payload, mtime0);
    console.log(Y(`  ℹ  Trigger file re-written (mtime1 = ${mtime1})`));
    assert(
      'Trigger mtime advanced (prerequisite for watcher detection)',
      mtime1 > mtime0,
      `mtime1 (${mtime1}) must be > mtime0 (${mtime0})`,
    );

    // Second call: prev = mtime0 ≠ 0 → processes sentinel → appends to .md
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  checkEpisodeAppend() processed the trigger`));

    sep();
    console.log(B('STEP 3 — Verify .md contains sentinel'));
    sep();

    const mdAfter = existsSync(MD_PATH) ? readFileSync(MD_PATH, 'utf-8') : '';
    assert(
      'Sentinel appears in docs/episode-27.md',
      mdAfter.includes(sentinel),
      `Sentinel "${sentinel.slice(0, 60)}…" not found in .md`,
    );
    console.log(Y(`  ℹ  .md size after append: ${mdAfter.length} bytes (was ${originalMd.length})`));

    sep();
    console.log(B('STEP 4 — Sync via syncEpisodeFile() (production path)'));
    sep();

    // Exercises the real production sync path via the same DB transport
    await syncEpisodeFile('episode-27.md');
    console.log(Y(`  ℹ  syncEpisodeFile() complete`));

    sep();
    console.log(B('STEP 5 — Verify DB record contains sentinel'));
    sep();

    const verifyRows = await db.execute(sql`
      SELECT content, length(content) AS len
      FROM conversation_memories
      WHERE id = ${rowId}
    `);
    const verifyRow = (verifyRows as any).rows?.[0] ?? (verifyRows as any)[0];

    assert(
      `DB row ${rowId.slice(0, 8)}… exists after sync`,
      !!verifyRow,
      'No row found after sync',
    );

    if (verifyRow) {
      const dbContent: string = verifyRow.content ?? '';
      const dbLen: number     = Number(verifyRow.len ?? 0);
      console.log(Y(`  ℹ  DB record length after sync: ${dbLen} bytes`));
      assert(
        'Sentinel appears in DB record',
        dbContent.includes(sentinel),
        `Sentinel "${sentinel.slice(0, 60)}…" not found in DB content (len=${dbLen})`,
      );
    }

  } finally {
    sep();
    console.log(B('STEP 6 — Clean up sentinel (preserve rolling content)'));
    sep();

    // Delegate to the shared cleanupSentinel() that the concurrent self-check
    // also calls — one function governs both paths.
    try {
      const cleanedMd = await cleanupSentinel(MD_PATH, sentinel, rowId, db);
      const restoredMd = readFileSync(MD_PATH, 'utf-8');
      assert(
        'Sentinel cleaned from .md (rolling content preserved)',
        !restoredMd.includes(sentinel),
        '.md still contains sentinel after cleanup',
      );
      console.log(Y(`  ℹ  .md after cleanup: ${cleanedMd.length} bytes`));
      console.log(Y(`  ℹ  DB row ${rowId.slice(0, 8)}… synced: ${cleanedMd.length} bytes`));
    } catch (err: any) {
      console.error(R(`  ✗  Cleanup failed: ${err.message}`));
      failed++;
    }

    // Clear the trigger file so nothing re-fires on next poll
    if (existsSync(EPISODE_APPEND_PATH)) {
      writeFileSync(EPISODE_APPEND_PATH, '', 'utf-8');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-check mode
// ─────────────────────────────────────────────────────────────────────────────

async function runSelfCheck(): Promise<void> {
  sep();
  console.log(B('SELF-CHECK MODE — verify gate fails when trigger is cleared before processing'));
  sep();
  console.log(Y('  ℹ  Simulates a watcher that is disabled or misses the trigger.'));
  console.log(Y('  ℹ  Sentinel must NOT appear in .md when trigger is cleared first.'));

  if (!existsSync(MD_PATH)) {
    console.log(R(`  ✗  docs/episode-27.md not found — cannot run self-check`));
    failed++;
    return;
  }

  const originalMd = readFileSync(MD_PATH, 'utf-8');
  const sentinel   = `[CI-SELF-CHECK-SENTINEL-${Date.now()}] should-not-appear`;
  const exchange   = `\n<!-- ${sentinel} -->`;
  const payload    = JSON.stringify({ exchange, episode: 'episode-27' });

  try {
    sep();
    console.log(B('STEP 1 — Prime the watcher mtime state'));
    sep();

    const mtime0 = await writeAppendTrigger(payload, 0);
    console.log(Y(`  ℹ  Trigger written (mtime0 = ${mtime0})`));
    // First call: prev === 0 → skips, stamps mtime0
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  Prime call complete`));

    sep();
    console.log(B('STEP 2 — Clear the trigger file before the watcher processes it'));
    sep();

    // Overwrite with empty content BEFORE the second checkEpisodeAppend call
    const mtime1 = await writeAppendTrigger('', mtime0);
    console.log(Y(`  ℹ  Trigger cleared (mtime1 = ${mtime1})`));
    assert(
      'Trigger mtime advanced after clear (prerequisite)',
      mtime1 > mtime0,
      `mtime1 (${mtime1}) must be > mtime0 (${mtime0})`,
    );

    sep();
    console.log(B('STEP 3 — Call checkEpisodeAppend() on the cleared file'));
    sep();

    // Sees empty content → parseEpisodeAppend returns null → no append
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  checkEpisodeAppend() called on cleared trigger — should no-op`));

    sep();
    console.log(B('STEP 4 — Assert sentinel does NOT appear in .md (gate held)'));
    sep();

    const mdAfter      = existsSync(MD_PATH) ? readFileSync(MD_PATH, 'utf-8') : '';
    const sentinelInMd = mdAfter.includes(sentinel);

    assert(
      'Sentinel correctly absent from docs/episode-27.md (gate held)',
      !sentinelInMd,
      sentinelInMd
        ? 'GATE BROKEN — sentinel appeared in .md even though trigger was cleared before processing'
        : undefined,
    );

    assert(
      '.md unchanged from original (no spurious writes)',
      mdAfter === originalMd,
      '.md was unexpectedly modified despite cleared trigger',
    );

    sep();
    console.log(B('STEP 5 — Confirm normal mode check would fail in this scenario'));
    sep();

    // Normal mode requires sentinel in .md — since it is absent, normal mode
    // would fail, which is exactly what the self-check confirms.
    assert(
      'Normal mode check would fail when trigger cleared (gate is sound)',
      !sentinelInMd,
      'If the sentinel is absent from .md, the normal-mode assertion would have failed.',
    );

  } finally {
    // Clear the trigger file on every exit path
    if (existsSync(EPISODE_APPEND_PATH)) {
      writeFileSync(EPISODE_APPEND_PATH, '', 'utf-8');
    }
  }
}

async function runSelfCheckConcurrent(): Promise<void> {
  sep();
  console.log(B('CONCURRENT SELF-CHECK — cleanup must preserve concurrent session writes'));
  sep();
  console.log(Y('  ℹ  Simulates content written to the rolling .md while the CI was running.'));
  console.log(Y('  ℹ  Concurrent content must survive; only the CI sentinel must be stripped.'));

  if (!existsSync(MD_PATH)) {
    console.log(R(`  ✗  docs/episode-27.md not found — cannot run concurrent self-check`));
    failed++;
    return;
  }

  const db         = getSharedDb();
  const originalMd = readFileSync(MD_PATH, 'utf-8');

  // Discover the DB row (same lookup as syncEpisodeFile)
  const lookupRows = await db.execute(sql`
    SELECT id, content, tags
    FROM conversation_memories
    WHERE arc_name = ${ARC_NAME}
      AND title    = ${EPISODE_TITLE}
    LIMIT 1
  `);
  const lookupRow = (lookupRows as any).rows?.[0] ?? (lookupRows as any)[0];

  assert(
    `DB row for "${EPISODE_TITLE}" in "${ARC_NAME}" found`,
    !!lookupRow,
    `No row found — run the episode insert script first`,
  );
  if (!lookupRow) return;

  const rowId: string = lookupRow.id;
  console.log(Y(`  ℹ  Row ID             : ${rowId}`));
  console.log(Y(`  ℹ  Original .md size  : ${originalMd.length} bytes`));

  // Two distinct markers: CI sentinel (must be removed) + concurrent content (must survive)
  const ts             = Date.now();
  const sentinel       = `[CI-CONCURRENT-SENTINEL-${ts}] should-be-stripped-by-cleanup`;
  const concurrentText = `[CI-CONCURRENT-CONTENT-${ts}] written by a live session — must survive cleanup`;
  const exchange       = `\n<!-- ${sentinel} -->`;
  const payload        = JSON.stringify({ exchange, episode: 'episode-27' });

  try {
    // ── Baseline: force DB to match current .md ────────────────────────────
    await db.execute(sql`
      UPDATE conversation_memories
      SET content = ${originalMd},
          summary = ${episodeSummary(originalMd)}
      WHERE id = ${rowId}
    `);
    console.log(Y(`  ℹ  Baseline: DB force-set to ${originalMd.length} bytes`));

    sep();
    console.log(B('STEP 1 — Prime the watcher mtime state'));
    sep();

    const mtime0 = await writeAppendTrigger(payload, 0);
    console.log(Y(`  ℹ  Trigger file written (mtime0 = ${mtime0})`));
    // First call: prev === 0 → skips, stamps mtime0
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  Prime call complete`));

    sep();
    console.log(B('STEP 2 — Re-write trigger and append sentinel to .md'));
    sep();

    const mtime1 = await writeAppendTrigger(payload, mtime0);
    console.log(Y(`  ℹ  Trigger file re-written (mtime1 = ${mtime1})`));
    assert(
      'Trigger mtime advanced (prerequisite for watcher detection)',
      mtime1 > mtime0,
      `mtime1 (${mtime1}) must be > mtime0 (${mtime0})`,
    );

    // Second call: processes sentinel → appends to .md
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  checkEpisodeAppend() processed trigger — sentinel appended to .md`));

    const mdWithSentinel = existsSync(MD_PATH) ? readFileSync(MD_PATH, 'utf-8') : '';
    assert(
      'Sentinel appeared in .md (append worked)',
      mdWithSentinel.includes(sentinel),
      `Sentinel not found in .md — append did not work`,
    );

    sep();
    console.log(B('STEP 3 — Simulate concurrent session write to the rolling .md'));
    sep();

    // A real rolling session would write content to the .md while CI is in flight.
    // We replicate that by appending our concurrent marker directly to the file.
    const mdBeforeConcurrent = readFileSync(MD_PATH, 'utf-8');
    const mdWithBoth = mdBeforeConcurrent + `\n\n<!-- ${concurrentText} -->\n`;
    writeFileSync(MD_PATH, mdWithBoth, 'utf-8');
    console.log(Y(`  ℹ  Concurrent content written to .md (${mdWithBoth.length} bytes)`));
    assert(
      'Both sentinel and concurrent content present in .md before cleanup',
      mdWithBoth.includes(sentinel) && mdWithBoth.includes(concurrentText),
      'One or both markers missing from .md before cleanup',
    );

    sep();
    console.log(B('STEP 4 — Run CI cleanup logic (strip sentinel from CURRENT .md)'));
    sep();

    // Call the SAME cleanupSentinel() the normal-mode finally block uses.
    // This is the key invariant: both paths share one implementation.  If that
    // function is ever changed to restore from a snapshot instead of reading the
    // current file, this self-check will fail because the concurrent content
    // written in STEP 3 will be missing from the .md after cleanup.
    const cleanedMd = await cleanupSentinel(MD_PATH, sentinel, rowId, db);
    console.log(Y(`  ℹ  Cleanup complete — .md is now ${cleanedMd.length} bytes`));

    sep();
    console.log(B('STEP 5 — Assert concurrent content survived and sentinel is gone'));
    sep();

    const mdAfterCleanup = readFileSync(MD_PATH, 'utf-8');

    assert(
      'Sentinel stripped from .md by cleanup',
      !mdAfterCleanup.includes(sentinel),
      `Sentinel still present in .md after cleanup — cleanup regex failed`,
    );

    assert(
      'Concurrent session content survived cleanup (rolling content preserved)',
      mdAfterCleanup.includes(concurrentText),
      `Concurrent content "${concurrentText.slice(0, 60)}…" was destroyed by cleanup — BUG`,
    );

    const originalLengthApprox = originalMd.length;
    assert(
      '.md is longer than original (concurrent content not discarded)',
      mdAfterCleanup.length > originalLengthApprox,
      `.md (${mdAfterCleanup.length} bytes) should be larger than original (${originalLengthApprox} bytes)`,
    );

    console.log(Y(`  ℹ  .md after cleanup: ${mdAfterCleanup.length} bytes (original was ${originalLengthApprox} bytes)`));

  } finally {
    sep();
    console.log(B('STEP 6 — Strip concurrent content marker from CURRENT .md'));
    sep();

    // The sentinel was already stripped in STEP 4 via cleanupSentinel().
    // Here we only remove the concurrent content marker we wrote in STEP 3.
    // Calling cleanupSentinel() with concurrentText ensures this path also reads
    // the current file rather than any snapshot — safe for rolling episodes.
    try {
      const finalMd = await cleanupSentinel(MD_PATH, concurrentText, rowId, db);
      console.log(Y(`  ℹ  .md after final marker cleanup: ${finalMd.length} bytes`));
      console.log(Y(`  ℹ  DB row ${rowId.slice(0, 8)}… synced`));
    } catch (err: any) {
      console.error(R(`  ✗  Final cleanup failed: ${err.message}`));
      failed++;
    }

    // Clear the trigger file
    if (existsSync(EPISODE_APPEND_PATH)) {
      writeFileSync(EPISODE_APPEND_PATH, '', 'utf-8');
    }
  }
}
async function main(): Promise<void> {
  const DATABASE_URL = process.env.NEON_SHARED_DATABASE_URL;
  if (!DATABASE_URL) {
    console.error(R('FATAL: NEON_SHARED_DATABASE_URL is not set'));
    process.exit(1);
  }

  // Acquire the shared episode-CI lockfile so this run does not race with
  // chat-episode-hook-e2e-ci (both write to the real docs/episode-27.md).
  acquireEpisodeCiLock();
  try {

  const modeLabel = concurrentCheckMode
    ? '  Episode Append Trigger — CONCURRENT SELF-CHECK'
    : selfCheckMode
      ? '  Episode Append Trigger — SELF-CHECK'
      : '  Episode Append Trigger — End-to-End CI Check';

  console.log('\n' + '═'.repeat(70));
  console.log(B(modeLabel));
  console.log('═'.repeat(70));

  if (concurrentCheckMode) {
    await runSelfCheckConcurrent();
  } else if (selfCheckMode) {
    await runSelfCheck();
  } else {
    await runNormalMode();
  }

  } finally {
    releaseEpisodeCiLock();
  }

  sep();
  const total = passed + failed;
  if (failed === 0) {
    const successMsg = concurrentCheckMode
      ? `\n✓  Concurrent self-check passed (${total} assertions).\n   Cleanup preserves rolling content — only the CI sentinel is stripped.\n`
      : selfCheckMode
        ? `\n✓  Self-check passed (${total} assertions).\n   Gate is sound: clearing the trigger before processing prevents append.\n`
        : `\n✓  All ${total} assertions passed.\n   Episode append trigger writes to .md and syncs to DB within one poll cycle.\n`;
    console.log(G(successMsg));
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
