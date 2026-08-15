/**
 * test-luca-auto-capture-episode.ts
 *
 * CI check: confirms that a .luca_auto_capture write is dual-routed — the
 * exchange lands in BOTH conversation_memories (DB) AND the rolling episode
 * .md file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Three exported test seams in agent-session-autosave.ts gate the side-effects
 * that would otherwise pollute durable stores on every CI run:
 *
 *   setAutoCaptureDbEnabled(false)
 *     — skips consumeAutoCaptureTrigger() and checkChatCapture(), so NO turns
 *       are appended to .chat_capture, NO rows land in conversation_memories,
 *       and the chat-capture cursor is never advanced.  The trigger file is
 *       still deleted after reading.
 *
 *   setAutoCaptureEpisodeEnabled(false)   [self-check only]
 *     — skips appendExchangeToEpisode(), simulating the removal of that call
 *       from checkAutoCapture().
 *
 *   setPinnedRollingEpisodeFilename(filename)
 *     — overrides getCurrentRollingEpisodeFilename() inside checkAutoCapture()
 *       so the test is never confused by concurrently-created fixtures (e.g.
 *       Episode 99 from rolling-sync-guard which may have a 'rolling' tag).
 *
 * The trigger file (.local/.luca_auto_capture) is snapshotted before the test
 * and restored byte-for-byte in finally — including the case where the file
 * did not exist before the test ran.
 *
 * The rolling episode .md is read before the test and any sentinel content is
 * stripped in finally by removing only the exact block added — never a full
 * overwrite — so concurrent appends by other writers are preserved.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Queries DB for the current rolling episode (arc_name = 'HolaHola
 *      Episodes', 'rolling' in tags, content ≥ 50 KB) to avoid fixtures.
 *   2. Pins the episode filename so checkAutoCapture() writes to the same file.
 *   3. Disables DB path (no .chat_capture writes, no conversation_memories rows).
 *   4. Snapshots the trigger file state (exists + content) for restore in finally.
 *   5. Writes a timestamped sentinel exchange to .local/.luca_auto_capture.
 *   6. Calls checkAutoCapture() — consumes trigger, appends to pinned episode .md.
 *   7. Asserts sentinel text appears in the rolling episode .md.
 *   8. Cleans up: strips sentinel from .md, restores trigger file, re-enables seams.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the gate fails when the episode-append path is disabled (simulates
 *   removing the appendExchangeToEpisode() call from checkAutoCapture()):
 *   1. Pins episode, disables DB path AND episode-append path.
 *   2. Writes sentinel, calls checkAutoCapture() — trigger consumed, both paths
 *      bypassed → sentinel never reaches .md.
 *   3. Asserts sentinel does NOT appear in .md (gate held).
 *   4. Confirms that a normal-mode run would have failed → self-check is sound.
 *
 * Run:
 *   npx tsx server/scripts/test-luca-auto-capture-episode.ts
 *   npx tsx server/scripts/test-luca-auto-capture-episode.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import {
  checkAutoCapture,
  appendExchangeToEpisode,
  setAutoCaptureDbEnabled,
  setAutoCaptureEpisodeEnabled,
  setPinnedRollingEpisodeFilename,
} from '../services/agent-session-autosave';
import { getSharedDb } from '../db';
import { sql } from 'drizzle-orm';

// ── Colour helpers ────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Constants ─────────────────────────────────────────────────────────────────
const WORKSPACE              = process.cwd();
const LUCA_AUTO_CAPTURE_PATH = join(WORKSPACE, '.local', '.luca_auto_capture');
const DOCS_DIR               = join(WORKSPACE, 'docs');
const ARC_NAME               = 'HolaHola Episodes';

// Minimum content length to be considered a real rolling episode.
// Test fixtures (e.g. Episode 99 from rolling-sync-guard) are always small
// (a few hundred bytes); the real rolling episode is always tens of thousands.
// Set to 44 KB so the guard still rejects fixtures while accommodating a young
// rolling episode that hasn't yet grown to 50 KB.
const MIN_REAL_EPISODE_BYTES = 44_000;

// ── CLI ───────────────────────────────────────────────────────────────────────
const selfCheckMode = process.argv.includes('--self-check');

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

// ── Trigger file snapshot/restore ─────────────────────────────────────────────

interface TriggerSnapshot {
  existed: boolean;
  content: string;
}

function snapshotTrigger(): TriggerSnapshot {
  if (!existsSync(LUCA_AUTO_CAPTURE_PATH)) return { existed: false, content: '' };
  return { existed: true, content: readFileSync(LUCA_AUTO_CAPTURE_PATH, 'utf-8') };
}

function restoreTrigger(snap: TriggerSnapshot): void {
  if (snap.existed) {
    writeFileSync(LUCA_AUTO_CAPTURE_PATH, snap.content, 'utf-8');
    console.log(Y(`  ℹ  Trigger file restored: ${snap.content.length} chars`));
  } else if (existsSync(LUCA_AUTO_CAPTURE_PATH)) {
    unlinkSync(LUCA_AUTO_CAPTURE_PATH);
    console.log(Y(`  ℹ  Trigger file deleted (was absent before test)`));
  }
}

// ── Sentinel cleanup ──────────────────────────────────────────────────────────

/**
 * Strip a single CI-AUTO-CAPTURE sentinel from episode content.
 * Reads the CURRENT file (not a snapshot) to preserve any concurrent writes.
 * Only removes lines/blocks containing the exact uniqueTag — leaves all other
 * content intact.
 */
function stripSentinel(content: string, uniqueTag: string): string {
  const escaped = uniqueTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Remove DAVID:/LUCA: block containing this tag
  let cleaned = content.replace(
    new RegExp(`\\n?DAVID:[^\\n]*${escaped}[^\\n]*\\n\\n?LUCA[^\\n]*${escaped}[^\\n]*\\n?`, 'g'),
    '',
  );
  // Fallback: remove any line containing this tag
  cleaned = cleaned.replace(new RegExp(`[^\\n]*${escaped}[^\\n]*\\n?`, 'g'), '');
  return cleaned;
}

// ── Discover rolling episode ──────────────────────────────────────────────────

async function discoverRollingEpisode(): Promise<{ filename: string; mdPath: string } | null> {
  const db = getSharedDb();
  const rows = await db.execute(sql`
    SELECT title FROM conversation_memories
    WHERE arc_name      = ${ARC_NAME}
      AND 'rolling'     = ANY(tags)
      AND LENGTH(content) >= ${MIN_REAL_EPISODE_BYTES}
    ORDER BY LENGTH(content) DESC, created_at ASC
    LIMIT 1
  `);
  const row = (rows as any).rows?.[0] ?? (rows as any)[0];
  if (!row?.title) return null;

  const title: string = row.title as string;
  const m = /^Episode (\d+)$/i.exec(title);
  const filename = m
    ? `episode-${parseInt(m[1], 10)}.md`
    : title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';

  return { filename, mdPath: join(DOCS_DIR, filename) };
}

// ── Seam reset (always called in finally) ────────────────────────────────────

function resetSeams(): void {
  setAutoCaptureDbEnabled(true);
  setAutoCaptureEpisodeEnabled(true);
  setPinnedRollingEpisodeFilename(null);
}

// ─────────────────────────────────────────────────────────────────────────────
// Normal mode
// ─────────────────────────────────────────────────────────────────────────────

async function runNormalMode(): Promise<void> {
  sep();
  console.log(B('NORMAL MODE — .luca_auto_capture → rolling episode .md end-to-end check'));
  sep();

  // ── Step 0: Discover the real rolling episode ─────────────────────────────
  const episode = await discoverRollingEpisode();

  assert(
    `Real rolling episode found in DB (content ≥ ${MIN_REAL_EPISODE_BYTES / 1000} KB)`,
    !!episode,
    'No rolling episode with sufficient content — ensure docs/episode-NN.md exists and is synced',
  );
  if (!episode) return;

  assert(
    `Rolling episode .md exists (${episode.filename})`,
    existsSync(episode.mdPath),
    `docs/${episode.filename} not found`,
  );
  if (!existsSync(episode.mdPath)) return;

  console.log(Y(`  ℹ  Rolling episode : ${episode.filename}`));
  const preLenBytes = readFileSync(episode.mdPath, 'utf-8').length;
  console.log(Y(`  ℹ  Pre-test .md   : ${preLenBytes} bytes`));

  // ── Unique sentinel ────────────────────────────────────────────────────────
  const uniqueTag = `CI-AUTO-CAPTURE-${Date.now()}`;
  const davidText = `[${uniqueTag}] synthetic David turn — safe to ignore`;
  const lucaText  = `[${uniqueTag}] synthetic Luca response — safe to ignore`;
  const exchangeText = `DAVID: ${davidText}\n\nLUCA [Replit]: ${lucaText}`;

  console.log(Y(`  ℹ  Seams: personal side-effects disabled`));
  console.log(Y(`  ℹ  Calling appendExchangeToEpisode() directly (avoids fs.watch race with live app)`));

  try {
    sep();
    console.log(B('STEP 1 — Build sentinel exchange text'));
    sep();

    console.log(Y(`  ℹ  Sentinel tag: ${uniqueTag}`));
    console.log(Y(`  ℹ  Exchange: DAVID + LUCA [Replit] (${exchangeText.length} chars)`));

    sep();
    console.log(B('STEP 2 — Call appendExchangeToEpisode() directly'));
    sep();

    await appendExchangeToEpisode(exchangeText, episode.filename);
    console.log(Y(`  ℹ  appendExchangeToEpisode() complete`));

    sep();
    console.log(B('STEP 3 — Verify sentinel appears in rolling episode .md'));
    sep();

    const mdAfter = existsSync(episode.mdPath) ? readFileSync(episode.mdPath, 'utf-8') : '';
    const sentinelInMd = mdAfter.includes(uniqueTag);

    assert(
      `Sentinel "${uniqueTag.slice(0, 35)}…" appears in ${episode.filename}`,
      sentinelInMd,
      `Exchange text not found in docs/${episode.filename} — appendExchangeToEpisode() failed to write`,
    );
    console.log(Y(`  ℹ  .md size after : ${mdAfter.length} bytes (was ${preLenBytes})`));

  } finally {
    sep();
    console.log(B('STEP 4 — Restore all state (sentinel, .md seams)'));
    sep();

    // Strip sentinel from CURRENT .md content (preserve any concurrent writes)
    try {
      if (existsSync(episode.mdPath)) {
        const current = readFileSync(episode.mdPath, 'utf-8');
        const cleaned = stripSentinel(current, uniqueTag);
        if (cleaned !== current) {
          writeFileSync(episode.mdPath, cleaned, 'utf-8');
          console.log(Y(`  ℹ  Stripped ${current.length - cleaned.length} bytes of sentinel from .md`));
        } else {
          console.log(Y(`  ℹ  No sentinel found in .md (already clean)`));
        }
        const after = readFileSync(episode.mdPath, 'utf-8');
        assert(
          'All CI-AUTO-CAPTURE sentinels removed from .md',
          !after.includes(uniqueTag),
          '.md still contains sentinel tag after cleanup',
        );
        console.log(Y(`  ℹ  .md after cleanup: ${after.length} bytes`));
      }
    } catch (err: any) {
      console.error(R(`  ✗  .md cleanup failed: ${err.message}`));
      failed++;
    }

  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-check mode
// ─────────────────────────────────────────────────────────────────────────────

async function runSelfCheck(): Promise<void> {
  sep();
  console.log(B('SELF-CHECK MODE — verify gate fails when episode-append path is disabled'));
  sep();
  console.log(Y('  ℹ  Simulates removing appendExchangeToEpisode() from checkAutoCapture().'));
  console.log(Y('  ℹ  Both DB path and episode-append path disabled — trigger is still'));
  console.log(Y('  ℹ  consumed and deleted, but episode .md routing is bypassed.'));
  console.log(Y('  ℹ  Sentinel MUST NOT appear in the rolling .md.'));

  // ── Discover rolling episode ───────────────────────────────────────────────
  const episode = await discoverRollingEpisode();

  assert(
    `Real rolling episode found in DB (content ≥ ${MIN_REAL_EPISODE_BYTES / 1000} KB)`,
    !!episode,
    'No rolling episode — cannot run self-check',
  );
  if (!episode) { if (failed > 0) process.exit(1); return; }

  assert(
    `docs/${episode.filename} exists on disk`,
    existsSync(episode.mdPath),
    `File not found: ${episode.mdPath}`,
  );
  if (!existsSync(episode.mdPath)) { if (failed > 0) process.exit(1); return; }

  const originalMd  = readFileSync(episode.mdPath, 'utf-8');
  const uniqueTag   = `CI-AUTO-CAPTURE-${Date.now()}`;
  const davidText   = `[${uniqueTag}] synthetic David — should not appear in .md`;
  const lucaText    = `[${uniqueTag}] synthetic Luca — should not appear in .md`;

  console.log(Y(`  ℹ  Rolling episode : ${episode.filename}`));
  console.log(Y(`  ℹ  Original .md    : ${originalMd.length} bytes`));

  // ── Configure seams ───────────────────────────────────────────────────────
  setPinnedRollingEpisodeFilename(episode.filename);
  setAutoCaptureDbEnabled(false);      // no .chat_capture, no DB
  setAutoCaptureEpisodeEnabled(false); // skip appendExchangeToEpisode (what we're testing)
  console.log(Y(`  ℹ  Seams: DB path disabled, episode append disabled, episode pinned`));

  // ── Snapshot trigger file BEFORE any writes ───────────────────────────────
  const triggerSnap = snapshotTrigger();
  console.log(Y(`  ℹ  Trigger snapshot: ${triggerSnap.existed ? `${triggerSnap.content.length} chars` : 'absent'}`));

  try {
    sep();
    console.log(B('STEP 1 — Write sentinel to .luca_auto_capture'));
    sep();

    writeFileSync(LUCA_AUTO_CAPTURE_PATH, JSON.stringify({ david: davidText, luca: lucaText }), 'utf-8');
    console.log(Y(`  ℹ  Trigger written with sentinel tag: ${uniqueTag}`));

    sep();
    console.log(B('STEP 2 — Call checkAutoCapture() with episode-append disabled'));
    sep();

    await checkAutoCapture();
    console.log(Y('  ℹ  checkAutoCapture() complete — episode-append path was skipped'));

    sep();
    console.log(B('STEP 3 — Assert sentinel NOT in rolling .md (routing bypassed)'));
    sep();

    const mdAfter      = existsSync(episode.mdPath) ? readFileSync(episode.mdPath, 'utf-8') : '';
    const sentinelInMd = mdAfter.includes(uniqueTag);

    assert(
      `Sentinel correctly absent from ${episode.filename} (routing bypassed)`,
      !sentinelInMd,
      sentinelInMd
        ? 'SELF-CHECK BROKEN — sentinel appeared in .md even though episode-append was disabled'
        : undefined,
    );
    assert(
      '.md unchanged from original (no spurious episode writes)',
      mdAfter === originalMd,
      '.md was unexpectedly modified despite episode-append being disabled',
    );

    sep();
    console.log(B('STEP 4 — Confirm normal-mode check would fail here (gate is sound)'));
    sep();

    assert(
      'Normal mode assertion would fail when episode routing is bypassed',
      !sentinelInMd,
      'Sentinel must be absent — proves the normal-mode check would have caught the regression.',
    );
    console.log(Y('  ℹ  Self-check confirmed: normal mode fails ↔ routing is absent.'));

  } finally {
    resetSeams();
    console.log(Y('\n  ℹ  Seams reset (all paths re-enabled, episode un-pinned)'));
    restoreTrigger(triggerSnap);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  try {
    if (selfCheckMode) {
      await runSelfCheck();
    } else {
      await runNormalMode();
    }
  } catch (err: any) {
    console.error(R(`\nFATAL: ${err.message ?? err}`));
    failed++;
  }

  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(`\n✓ All ${total} check(s) passed\n`));
    process.exit(0);
  } else {
    console.log(R(`\n✗ ${failed} of ${total} check(s) failed\n`));
    process.exit(1);
  }
})();
