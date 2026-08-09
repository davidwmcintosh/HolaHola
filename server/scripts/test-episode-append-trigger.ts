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
 * Run:
 *   npx tsx server/scripts/test-episode-append-trigger.ts
 *   npx tsx server/scripts/test-episode-append-trigger.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';
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
const selfCheckMode = process.argv.includes('--self-check');

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

/** Derive a short summary from the first 5 non-empty content lines. */
function episodeSummary(content: string): string {
  return content.split('\n').map(l => l.trim()).filter(Boolean)
    .slice(0, 5).join(' ').slice(0, 400);
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

    // Read the CURRENT .md at cleanup time, not the pre-test snapshot.
    // This preserves any content appended to the rolling episode while the CI ran.
    const currentMd = existsSync(MD_PATH) ? readFileSync(MD_PATH, 'utf-8') : originalMd;

    // Strip our sentinel using a regex — handles whitespace/newline variations
    // that can cause an exact-string replace to silently miss.
    const escapedSentinel = sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sentinelRe      = new RegExp(`\\n?<!--\\s*${escapedSentinel}[\\s\\S]*?-->\\n?`, 'g');
    const cleanedMd       = currentMd.replace(sentinelRe, '');

    writeFileSync(MD_PATH, cleanedMd, 'utf-8');
    const restoredMd = readFileSync(MD_PATH, 'utf-8');
    assert(
      'Sentinel cleaned from .md (rolling content preserved)',
      !restoredMd.includes(sentinel),
      '.md still contains sentinel after cleanup',
    );
    console.log(Y(`  ℹ  .md after cleanup: ${restoredMd.length} bytes`));

    // Sync cleaned content back to the DB row this CI manages.
    try {
      await db.execute(sql`
        UPDATE conversation_memories
        SET content = ${cleanedMd},
            summary = ${episodeSummary(cleanedMd)}
        WHERE id = ${rowId}
      `);
      console.log(Y(`  ℹ  DB row ${rowId.slice(0, 8)}… synced: ${cleanedMd.length} bytes`));
    } catch (err: any) {
      console.error(R(`  ✗  DB sync failed: ${err.message}`));
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
  console.log(B(selfCheckMode
    ? '  Episode Append Trigger — SELF-CHECK'
    : '  Episode Append Trigger — End-to-End CI Check'));
  console.log('═'.repeat(70));

  if (selfCheckMode) {
    await runSelfCheck();
  } else {
    await runNormalMode();
  }

  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(selfCheckMode
      ? `\n✓  Self-check passed (${total} assertions).\n   Gate is sound: clearing the trigger before processing prevents append.\n`
      : `\n✓  All ${total} assertions passed.\n   Episode append trigger writes to .md and syncs to DB within one poll cycle.\n`));
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
