/**
 * test-episode-append-corrupted-json.ts
 *
 * Self-check: confirms that checkEpisodeAppend() logs a warning and skips the
 * append when the trigger file contains malformed (corrupted) JSON — even when
 * a rolling episode IS present in the DB.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What is tested
 * ─────────────────────────────────────────────────────────────────────────────
 *   parseEpisodeAppend() detects content that starts with '{' but fails
 *   JSON.parse as a corrupted/partial write and returns null with a warning:
 *
 *     } catch {
 *       console.warn('[AgentAutosave] Episode append: trigger file starts with
 *         "{" but is not valid JSON — possible partial write; skipping ...');
 *       return null;
 *     }
 *
 *   checkEpisodeAppend() then hits `if (!parsed) return;` and exits without
 *   touching any episode .md file.
 *
 *   This script verifies all of the following in a live-rolling-episode state:
 *     1. The corrupted-JSON warning is emitted.
 *     2. No episode .md file on disk is modified.
 *     3. The raw broken JSON text does not appear in any episode file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this self-check catches guard removal
 * ─────────────────────────────────────────────────────────────────────────────
 *   If the corrupted-JSON guard is removed (catch block falls through to plain
 *   text instead of returning null):
 *     • parseEpisodeAppend returns { exchange: corruptedJson, episodeFilename: null }
 *     • checkEpisodeAppend calls getCurrentRollingEpisodeFilename()
 *     • The rolling row IS in the DB → a filename is returned
 *     • appendExchangeToEpisode() runs → raw broken JSON is written to the
 *       episode .md file
 *     • Assertions (2) and (3) both fail → script exits 1.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DB safety
 * ─────────────────────────────────────────────────────────────────────────────
 *   The test does NOT modify DB state.  A real rolling episode row must exist;
 *   if none is found the test aborts early with a clear message (not a false
 *   pass).  The trigger file is cleared in the finally block.
 *
 * Run:
 *   npx tsx server/scripts/test-episode-append-corrupted-json.ts
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
  console.log(B('  Corrupted JSON Trigger — Episode Append Self-Check'));
  console.log('═'.repeat(70));
  console.log(Y('  Verifies checkEpisodeAppend() logs a warning and skips the append'));
  console.log(Y('  when the trigger file contains malformed JSON — with a rolling'));
  console.log(Y('  episode present in the DB (production-representative state).'));

  const db = getSharedDb();

  // ── Step 1: Confirm a rolling episode exists ──────────────────────────────
  sep();
  console.log(B('STEP 1 — Confirm a rolling episode exists in DB (prerequisite)'));
  sep();

  const rollingRows = await db.execute(sql`
    SELECT id, title, tags
    FROM conversation_memories
    WHERE arc_name = 'HolaHola Episodes'
      AND 'rolling' = ANY(tags)
    ORDER BY created_at DESC
    LIMIT 1
  `);
  const rollingRow: { id: string; title: string; tags: string[] } | null =
    (((rollingRows as any).rows ?? (rollingRows as any)) as any[])[0] ?? null;

  if (!rollingRow) {
    console.error(R(
      '\n  FATAL: No rolling episode found in DB.\n' +
      '  This test requires a live rolling episode row to confirm the guard\n' +
      '  fires before auto-detect can reach appendExchangeToEpisode().\n' +
      '  Ensure the active rolling episode has the "rolling" tag and retry.\n',
    ));
    process.exit(1);
  }

  console.log(Y(`  ℹ  Rolling episode: ${rollingRow.id.slice(0, 8)}… "${rollingRow.title}" tags=${JSON.stringify(rollingRow.tags)}`));
  assert(
    'Rolling episode exists in DB (production-representative state)',
    true,
  );

  // ── Step 2: Snapshot episode file mtimes ──────────────────────────────────
  sep();
  console.log(B('STEP 2 — Snapshot episode .md mtimes'));
  sep();

  const mtimeSnapshot = snapshotEpisodeMtimes();
  console.log(Y(`  ℹ  Snapshotted ${mtimeSnapshot.size} episode file(s)`));

  // ── Step 3: Capture console.warn calls ────────────────────────────────────
  sep();
  console.log(B('STEP 3 — Install console.warn interceptor'));
  sep();

  const capturedWarnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = args.map(a => String(a)).join(' ');
    capturedWarnings.push(msg);
    originalWarn(...args); // still print to stdout for visibility
  };

  try {
    // ── Step 4: Write a corrupted JSON trigger payload ──────────────────────
    sep();
    console.log(B('STEP 4 — Write corrupted JSON trigger payload and prime watcher'));
    sep();

    // Intentionally malformed JSON: starts with '{' so JSON mode is attempted,
    // but is missing the closing brace — simulates a truncated partial write.
    // The guard in parseEpisodeAppend detects this and returns null with a warning.
    const sentinel    = `[CI-TEST-956-${Date.now()}] corrupted-json-self-check`;
    const corruptedJson = `{"exchange":"${sentinel}","episode":"episode-27"`; // no closing }

    console.log(Y(`  ℹ  Payload: ${corruptedJson.slice(0, 80)}`));

    assert(
      'Payload starts with "{" (JSON mode will be attempted)',
      corruptedJson.startsWith('{'),
    );

    let isInvalidJson = false;
    try { JSON.parse(corruptedJson); } catch { isInvalidJson = true; }
    assert(
      'Payload is genuinely invalid JSON (JSON.parse throws)',
      isInvalidJson,
      'The test payload must fail JSON.parse to exercise the corrupted-JSON guard',
    );

    const mtime0 = await writeAppendTrigger(corruptedJson, 0);
    console.log(Y(`  ℹ  Trigger written — mtime0 = ${mtime0}`));

    // First call: prev === 0 → skips, stamps mtime0 into module state
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  Prime call complete (prev=0 path; watcher stamped mtime0)`));

    // ── Step 5: Re-write with fresh mtime and call watcher ────────────────
    sep();
    console.log(B('STEP 5 — Re-write trigger with fresh mtime, call checkEpisodeAppend()'));
    sep();

    const mtime1 = await writeAppendTrigger(corruptedJson, mtime0);
    console.log(Y(`  ℹ  Trigger re-written — mtime1 = ${mtime1}`));
    assert(
      'Trigger mtime advanced (prerequisite for watcher detection)',
      mtime1 > mtime0,
      `mtime1 (${mtime1}) must be > mtime0 (${mtime0})`,
    );

    // This call sees:
    //   1. Raw content starts with '{' → JSON.parse attempted → throws
    //   2. Guard: console.warn + return null (NOT plain-text fallback)
    //   3. checkEpisodeAppend: `if (!parsed) return;` → exits without any file write
    await checkEpisodeAppend();
    console.log(Y(`  ℹ  checkEpisodeAppend() returned`));

  } finally {
    // Restore warn before assertions
    console.warn = originalWarn;

    // Clear trigger file so nothing re-fires on next poll
    try {
      if (existsSync(EPISODE_APPEND_PATH)) {
        writeFileSync(EPISODE_APPEND_PATH, '', 'utf-8');
        console.log(Y(`  ℹ  Trigger file cleared`));
      }
    } catch { /* ignore */ }
  }

  // ── Step 6: Assert corrupted-JSON warning was emitted ────────────────────
  sep();
  console.log(B('STEP 6 — Assert corrupted-JSON warning was logged'));
  sep();

  const EXPECTED_WARNING = 'trigger file starts with "{" but is not valid JSON';
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
      : `Expected warning not found.\n` +
        `       This means the corrupted-JSON guard in parseEpisodeAppend is absent.\n` +
        `       Without the guard the catch block falls through to plain-text mode,\n` +
        `       raw broken JSON is treated as exchange text, the rolling episode is\n` +
        `       auto-detected, and garbage is appended to the episode .md file.\n` +
        `       Captured warnings: ${JSON.stringify(capturedWarnings)}`,
  );

  // ── Step 7: Assert no episode file was modified ───────────────────────────
  sep();
  console.log(B('STEP 7 — Assert no episode .md was modified'));
  sep();

  const changedFiles = detectEpisodeWrites(mtimeSnapshot);
  assert(
    'No episode .md was written to (corrupted-JSON guard held)',
    changedFiles.length === 0,
    changedFiles.length > 0
      ? `Files unexpectedly modified: ${changedFiles.join(', ')}\n` +
        `       This means the corrupted-JSON guard did NOT fire — raw broken JSON\n` +
        `       was treated as plain text and appended to the rolling episode file.`
      : undefined,
  );

  // ── Step 8: Assert sentinel not in any episode file ──────────────────────
  sep();
  console.log(B('STEP 8 — Assert corrupted text not present in any episode .md'));
  sep();

  const sentinel = `CI-TEST-956-`;
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
    'Corrupted sentinel text does not appear in any episode .md (append was skipped)',
    !sentinelFound,
    sentinelFound
      ? `Sentinel found in ${sentinelFile} — corrupted JSON was appended verbatim\n` +
        `       instead of being rejected by the guard.`
      : undefined,
  );

  // ── Final summary ─────────────────────────────────────────────────────────
  sep();
  const total = passed + failed;
  if (failed === 0) {
    console.log(G(
      `\n✓  All ${total} assertions passed.\n` +
      `   Corrupted-JSON guard in parseEpisodeAppend is sound:\n` +
      `   • Malformed JSON (starts with "{", parse fails) logged a warning\n` +
      `   • checkEpisodeAppend returned without calling appendExchangeToEpisode\n` +
      `   • No episode .md was modified (rolling episode was present in DB)\n` +
      `   • Corrupted text does not appear in any episode file\n` +
      `\n   NOTE: This script fails when the corrupted-JSON guard is removed:\n` +
      `   the catch block falls through to plain-text mode → raw broken JSON\n` +
      `   is appended to the rolling episode file → assertions (6-8) exit 1.\n`,
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
