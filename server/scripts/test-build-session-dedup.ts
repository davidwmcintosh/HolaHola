/**
 * test-build-session-dedup.ts
 *
 * CI check: confirms that checkBuildSession() deduplicates — calling it twice
 * with the same commit-message content writes exactly ONE turn to the capture
 * file, not two.
 *
 * HERMETIC: all I/O uses temp files created for this run.
 *   - _commitMsgPathOverrideForTest  → temp file; live .local/.commit_message is never touched
 *   - _chatCapturePathOverrideForTest → temp file; live .local/.chat_capture is never touched
 *   - _buildSessionDbEnabled = false → no DB inserts
 *
 * Because the live .commit_message is never written, the production autosave
 * server process (which watches that file) cannot observe the sentinel, so it
 * cannot insert rows or append to the live capture file on its own.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The dedup guard lives in checkBuildSession() in agent-session-autosave.ts:
 *
 *   if (_buildSessionDedupEnabled && content === buildLastSavedContent) {
 *     console.log('[AgentAutosave] Skipping duplicate commit message');
 *     return;
 *   }
 *
 * When this guard is present:
 *   - First call:  new content → saveBuildMemory + appendChatCaptureTurn → 1 turn
 *   - Second call: same content, new mtime → guard fires → early return → 0 turns
 *   Total turns: 1 ✓
 *
 * When this guard is removed (self-check simulation via _buildSessionDedupEnabled=false):
 *   - First call:  content → saveBuildMemory (sets buildLastSavedContent) + 1 turn
 *   - Second call: same content → saveBuildMemory's own guard blocks the DB dup, BUT
 *                  appendChatCaptureTurn is reached → 1 more turn
 *   Total turns: 2 ✗
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Synthetic timeline (normal mode)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. Create temp commit-msg file + temp capture file.
 *   2. Point checkBuildSession() at both via seams.
 *   3. Disable DB writes via _buildSessionDbEnabled seam.
 *   4. Seed buildLastMtime to a non-zero past value.
 *   5. Write sentinel content to the temp commit-msg file with mtime > seed.
 *   6. Call checkBuildSession() → first call processes; 1 turn in temp capture.
 *   7. Rewrite the SAME trimmed content with a new mtime to the temp file.
 *   8. Call checkBuildSession() again → dedup guard blocks it.
 *   9. Assert temp capture contains exactly 1 sentinel turn (not 2).
 *  10. Remove both temp files.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Proves the dedup guard is the active gate:
 *
 *   1. setBuildSessionDedupEnabledForTest(false) — disables the guard.
 *   2. Runs the same two-call scenario.
 *   3. Asserts TWO new turns appear — confirming the test FAILS when the
 *      guard is absent.
 *   4. Re-enables the guard, re-runs, confirms only ONE turn appears.
 *
 * Run:
 *   npx tsx server/scripts/test-build-session-dedup.ts
 *   npx tsx server/scripts/test-build-session-dedup.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import * as os from 'os';

import {
  setBuildLastMtimeForTest,
  setBuildSessionDedupEnabledForTest,
  setBuildSessionChatCaptureEnabledForTest,
  setBuildSessionDbEnabledForTest,
  setChatCapturePathOverrideForTest,
  setCommitMsgPathOverrideForTest,
  setTaskRefPendingPathOverrideForTest,
} from '../services/agent-session-autosave';

const SENTINEL = `CI-test-build-session-dedup — ${Date.now()}`;

const selfCheck = process.argv.includes('--self-check');

// ── helpers ──────────────────────────────────────────────────────────────────

function pass(msg: string): void {
  console.log(`  ✓  ${msg}`);
}

function fail(msg: string): void {
  console.error(`  ✗  ${msg}`);
  process.exit(1);
}

/** Read all bytes of a file as a string, or '' if absent. */
function readFile(path: string): string {
  if (!existsSync(path)) return '';
  try { return readFileSync(path, 'utf-8'); } catch { return ''; }
}

/** Count occurrences of a substring in a string. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}

/**
 * Write a commit message to the temp path with mtime strictly newer than seedMtime.
 * Sleeps briefly on filesystems with 1s granularity.
 */
async function writeCommitMessage(tmpCommit: string, content: string, seedMtime: number): Promise<void> {
  writeFileSync(tmpCommit, content, 'utf-8');
  if (statSync(tmpCommit).mtimeMs <= seedMtime) {
    await new Promise(r => setTimeout(r, 1100));
    writeFileSync(tmpCommit, content + ' ', 'utf-8');
  }
}

/**
 * Rewrite the same content to the temp path with an advanced mtime so the mtime
 * guard doesn't block the second checkBuildSession() call.  The trailing space is
 * trimmed by checkBuildSession(), keeping the effective content identical.
 */
async function touchCommitMessage(tmpCommit: string, content: string, afterMtime: number): Promise<void> {
  await new Promise(r => setTimeout(r, 50));
  writeFileSync(tmpCommit, content + ' ', 'utf-8');
  if (statSync(tmpCommit).mtimeMs <= afterMtime) {
    await new Promise(r => setTimeout(r, 1100));
    writeFileSync(tmpCommit, content + '  ', 'utf-8');
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

(async function main() {
  console.log(`\n=== test-build-session-dedup (${selfCheck ? '--self-check' : 'normal'}) ===\n`);

  // Import lazily so test seams are applied before any module-level side effects.
  const autosave = await import('../services/agent-session-autosave');
  const checkBuildSession: () => Promise<void> =
    (autosave as any).checkBuildSessionForTest;

  if (typeof checkBuildSession !== 'function') {
    fail(
      'checkBuildSessionForTest is not exported from agent-session-autosave.ts.\n' +
      '  Add: export const checkBuildSessionForTest = checkBuildSession;',
    );
    process.exit(1);
  }

  // Create temp files unique to this run — never touch any live paths.
  const ts = Date.now();
  const tmpCommit  = join(os.tmpdir(), `test-build-dedup-commit-${ts}.txt`);
  const tmpCapture = join(os.tmpdir(), `test-build-dedup-capture-${ts}.txt`);

  // A non-existent path used as the task-ref-pending override — checkBuildSession()
  // will existsSync() it (always false) and never consume the live pending file.
  const tmpPending = join(os.tmpdir(), `test-build-dedup-pending-${ts}.txt`);

  // Apply hermetic seams before any test runs.
  setCommitMsgPathOverrideForTest(tmpCommit);        // redirect commit-msg reads
  setChatCapturePathOverrideForTest(tmpCapture);     // redirect capture writes
  setTaskRefPendingPathOverrideForTest(tmpPending);  // isolate pending-task marker (never created)
  setBuildSessionDbEnabledForTest(false);             // skip DB inserts
  setBuildSessionChatCaptureEnabledForTest(true);     // keep chat-capture active (what we're testing)

  try {
    if (selfCheck) {
      await runSelfCheck(checkBuildSession, tmpCommit, tmpCapture);
    } else {
      await runNormalCheck(checkBuildSession, tmpCommit, tmpCapture);
    }
  } finally {
    // Restore all test seams.
    setCommitMsgPathOverrideForTest(null);
    setChatCapturePathOverrideForTest(null);
    setTaskRefPendingPathOverrideForTest(null);
    setBuildSessionDedupEnabledForTest(true);
    setBuildSessionDbEnabledForTest(true);
    setBuildSessionChatCaptureEnabledForTest(true);
    // Remove temp files (tmpPending is never created, so skip-if-missing is fine).
    for (const f of [tmpCommit, tmpCapture, tmpPending]) {
      try { if (existsSync(f)) unlinkSync(f); } catch { /* ignore */ }
    }
  }

  console.log('\n✅  All assertions passed.\n');
})();

// ── Normal check ─────────────────────────────────────────────────────────────

async function runNormalCheck(
  checkBuildSession: () => Promise<void>,
  tmpCommit: string,
  tmpCapture: string,
): Promise<void> {
  console.log('Normal check — dedup guard is active\n');

  setBuildSessionDedupEnabledForTest(true);

  const seedMtime = Date.now() - 5000;
  setBuildLastMtimeForTest(seedMtime);

  // ── First call: new content ───────────────────────────────────────────────
  console.log('  Call 1 — first call with sentinel content\n');
  await writeCommitMessage(tmpCommit, SENTINEL, seedMtime);
  const mtimeAfterWrite = statSync(tmpCommit).mtimeMs;
  await checkBuildSession();

  const contentAfterFirst = readFile(tmpCapture);
  const turns1 = countOccurrences(contentAfterFirst, 'CI-test-build-session-dedup');

  if (turns1 === 0) {
    fail(
      `No sentinel turn written after first checkBuildSession() call.\n` +
      `  Temp capture: ${tmpCapture}\n` +
      `  The appendChatCaptureTurn call inside checkBuildSession() may be missing or\n` +
      `  the _chatCapturePathOverrideForTest seam may not be wired.`,
    );
  }
  pass(`Call 1: ${turns1} sentinel turn(s) written to temp capture`);

  if (!contentAfterFirst.includes('SPEAKER: Luca Replit')) {
    fail(
      `No "SPEAKER: Luca Replit" turn found in temp capture after first call.\n` +
      `  Content (first 400 chars):\n  ${contentAfterFirst.slice(0, 400)}`,
    );
  }
  pass('Call 1: turn has SPEAKER: Luca Replit');

  // ── Second call: SAME content, new mtime ─────────────────────────────────
  console.log('\n  Call 2 — same content, new mtime (dedup guard should block)\n');
  await touchCommitMessage(tmpCommit, SENTINEL, mtimeAfterWrite);
  await checkBuildSession();

  const contentAfterSecond = readFile(tmpCapture);
  const turns2 = countOccurrences(contentAfterSecond, 'CI-test-build-session-dedup');

  if (turns2 !== 1) {
    fail(
      `Expected exactly 1 sentinel turn in temp capture after two calls, found ${turns2}.\n` +
      `  The "content === buildLastSavedContent" dedup guard may be missing from checkBuildSession().\n` +
      `  Temp capture content:\n  ${contentAfterSecond.slice(0, 600)}`,
    );
  }
  pass(`Exactly 1 sentinel turn in temp capture (dedup blocked the second write)`);
}

// ── Self-check ───────────────────────────────────────────────────────────────

async function runSelfCheck(
  checkBuildSession: () => Promise<void>,
  tmpCommit: string,
  tmpCapture: string,
): Promise<void> {
  console.log('Self-check phase 1 — dedup DISABLED (simulating guard removal)\n');

  // ── Phase 1: disable dedup → expect 2 turns ──────────────────────────────
  setBuildSessionDedupEnabledForTest(false);

  const seedMtime1 = Date.now() - 5000;
  setBuildLastMtimeForTest(seedMtime1);

  const sentinel1 = SENTINEL + '-selfcheck';
  await writeCommitMessage(tmpCommit, sentinel1, seedMtime1);
  const mtimeAfterWrite1 = statSync(tmpCommit).mtimeMs;
  await checkBuildSession();

  // Second call: same content, new mtime, dedup disabled → should write a second turn.
  await touchCommitMessage(tmpCommit, sentinel1, mtimeAfterWrite1);
  await checkBuildSession();

  const contentPhase1 = readFile(tmpCapture);
  const turns1 = countOccurrences(contentPhase1, sentinel1);

  if (turns1 < 2) {
    fail(
      `Self-check FAILED: expected ≥2 sentinel turns when dedup is disabled, found ${turns1}.\n` +
      `  setBuildSessionDedupEnabledForTest(false) did not bypass the guard.\n` +
      `  The guard in checkBuildSession() may not be checking _buildSessionDedupEnabled.\n` +
      `  Temp capture content:\n  ${contentPhase1.slice(0, 600)}`,
    );
  }
  pass(`Phase 1: ${turns1} sentinel turns written when dedup is disabled ✓ (regression confirmed)`);

  // ── Phase 2: re-enable dedup → expect exactly 1 turn ────────────────────
  console.log('\nSelf-check phase 2 — dedup RE-ENABLED (confirming guard is active)\n');

  // Clear the temp capture file so phase 2 starts clean.
  writeFileSync(tmpCapture, '', 'utf-8');

  setBuildSessionDedupEnabledForTest(true);

  const seedMtime2 = Date.now() - 5000;
  setBuildLastMtimeForTest(seedMtime2);

  const sentinel2 = SENTINEL + '-selfcheck-enabled';
  await writeCommitMessage(tmpCommit, sentinel2, seedMtime2);
  const mtimeAfterWrite2 = statSync(tmpCommit).mtimeMs;
  await checkBuildSession();

  await touchCommitMessage(tmpCommit, sentinel2, mtimeAfterWrite2);
  await checkBuildSession();

  const contentPhase2 = readFile(tmpCapture);
  const turns2 = countOccurrences(contentPhase2, sentinel2);

  if (turns2 !== 1) {
    fail(
      `Self-check FAILED: expected exactly 1 sentinel turn when dedup is enabled, found ${turns2}.\n` +
      `  Temp capture content:\n  ${contentPhase2.slice(0, 600)}`,
    );
  }
  pass(`Phase 2: exactly 1 sentinel turn written when dedup is enabled ✓`);

  console.log('\n✅  Self-check passed — removing the dedup guard causes duplicate turns as expected.\n');
}
