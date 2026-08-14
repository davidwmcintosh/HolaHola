/**
 * test-commit-message-auto-capture.ts
 *
 * CI check: confirms that checkBuildSession() appends a "Luca Replit" turn to
 * .local/.chat_capture when .local/.commit_message is updated with new content.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The guard lives in checkBuildSession() in agent-session-autosave.ts:
 *
 *   if (_buildSessionChatCaptureEnabled) {
 *     appendChatCaptureTurn('Luca Replit', content);
 *   }
 *
 * A regression (deleting that block) would silently stop every task completion
 * from being captured as a conversation turn — the primary JSONL replacement path.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Synthetic timeline
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   1. Record the current byte length of .chat_capture (or 0 if absent).
 *   2. Seed buildLastMtime to a past value (not 0) so the startup-skip guard
 *      inside checkBuildSession() doesn't fire.
 *   3. Write a sentinel commit message to .commit_message.
 *   4. Call checkBuildSession().
 *   5. Assert .chat_capture grew and contains a "Luca Replit" turn with the
 *      sentinel content.
 *   6. Restore the original .commit_message content.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Proves the appendChatCaptureTurn call is the active gate:
 *
 *   1. setBuildSessionChatCaptureEnabledForTest(false) — disables the append
 *      (models removing the appendChatCaptureTurn line from checkBuildSession).
 *   2. Runs the normal test scenario.
 *   3. Asserts that NO new turn appears in .chat_capture — confirming the test
 *      FAILS when the append is missing.
 *   4. Re-enables the seam, re-runs, and confirms the turn IS present.
 *
 * Run:
 *   npx tsx server/scripts/test-commit-message-auto-capture.ts
 *   npx tsx server/scripts/test-commit-message-auto-capture.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join } from 'path';

// Import the test seams and the function under test.
import {
  setBuildLastMtimeForTest,
  setBuildSessionChatCaptureEnabledForTest,
  getBuildSessionChatCaptureEnabledForTest,
} from '../services/agent-session-autosave';

// Import path and capture constants.
import {
  WORKSPACE,
  CHAT_CAPTURE_PATH,
} from '../services/transcript-parser';

// ── Lazy import of checkBuildSession (not exported directly) ─────────────────
// checkBuildSession() is not exported. We re-import the module to get at the
// function via its exported test seam, then trigger the behaviour through the
// real file-watch path.  Because we cannot call checkBuildSession() directly,
// we expose it via a thin wrapper export added for this purpose.
// HOWEVER: rather than adding yet another export, we invoke the real function
// via the startAutosave / stopAutosave round-trip — but that spins up all
// watchers and DB connections, which is too heavy for CI.
//
// SOLUTION: export checkBuildSession from agent-session-autosave.ts so CI can
// call it directly.  This is a lightweight, read-only export — the function
// itself has no side effects beyond appending to .chat_capture and inserting
// one DB row (which fails gracefully in CI).
// ---------------------------------------------------------------------------

// We need checkBuildSession to be exported — see note above.
// Import it dynamically so TypeScript doesn't complain about the export
// not existing yet (it will be added to the module below as we ship this task).
// We use a top-level await inside an IIFE so the rest of the file sees a clean
// resolved value.

const COMMIT_MSG_PATH = join(WORKSPACE, '.local/.commit_message');
const SENTINEL        = `CI-test-commit-msg-auto-capture — ${Date.now()}`;

const selfCheck = process.argv.includes('--self-check');

// ── helpers ──────────────────────────────────────────────────────────────────

function pass(msg: string): void {
  console.log(`  ✓  ${msg}`);
}

function fail(msg: string): void {
  console.error(`  ✗  ${msg}`);
  process.exit(1);
}

/**
 * Current byte length of .chat_capture, or 0 if absent.
 */
function captureFileSize(): number {
  try {
    return existsSync(CHAT_CAPTURE_PATH) ? statSync(CHAT_CAPTURE_PATH).size : 0;
  } catch {
    return 0;
  }
}

/**
 * Read new bytes from .chat_capture past byteOffset and return as a string.
 * Uses Buffer slicing so byte offsets from statSync().size align correctly
 * even when the file contains multi-byte UTF-8 characters.
 */
function newRawBlock(byteOffset: number): string {
  if (!existsSync(CHAT_CAPTURE_PATH)) return '';
  try {
    const buf = readFileSync(CHAT_CAPTURE_PATH);  // returns Buffer
    if (buf.length <= byteOffset) return '';
    return buf.slice(byteOffset).toString('utf-8');
  } catch {
    return '';
  }
}

/**
 * Write a commit message to .commit_message with a mtime newer than the
 * supplied seed value.  Sleeps briefly when needed to ensure the mtime
 * actually advances on filesystems with 1s granularity.
 */
async function writeCommitMessage(content: string, seedMtime: number): Promise<void> {
  writeFileSync(COMMIT_MSG_PATH, content, 'utf-8');
  // Ensure mtime > seedMtime (file systems may have 1s granularity)
  if (statSync(COMMIT_MSG_PATH).mtimeMs <= seedMtime) {
    await new Promise(r => setTimeout(r, 1100));
    writeFileSync(COMMIT_MSG_PATH, content + ' ', 'utf-8');
  }
}

// ── main ─────────────────────────────────────────────────────────────────────

(async function main() {
  console.log(`\n=== test-commit-message-auto-capture (${selfCheck ? '--self-check' : 'normal'}) ===\n`);

  // We import checkBuildSession lazily to avoid running module-level side effects
  // (setInterval watchers, etc.) before we set test seams.
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

  // ── Save original .commit_message so we can restore it ───────────────────
  const originalContent = existsSync(COMMIT_MSG_PATH)
    ? readFileSync(COMMIT_MSG_PATH, 'utf-8')
    : null;

  try {
    if (selfCheck) {
      await runSelfCheck(checkBuildSession);
    } else {
      await runNormalCheck(checkBuildSession);
    }
  } finally {
    // Always restore the original .commit_message
    if (originalContent !== null) {
      writeFileSync(COMMIT_MSG_PATH, originalContent, 'utf-8');
    }
    // Restore test seam
    setBuildSessionChatCaptureEnabledForTest(true);
  }

  console.log('\n✅  All assertions passed.\n');
})();

// ── Normal check ─────────────────────────────────────────────────────────────

async function runNormalCheck(checkBuildSession: () => Promise<void>): Promise<void> {
  console.log('Round 1 — normal: appendChatCaptureTurn is active\n');

  // Record initial size and seed buildLastMtime to a non-zero past value.
  const offsetBefore = captureFileSize();
  const seedMtime    = Date.now() - 5000;
  setBuildLastMtimeForTest(seedMtime);
  setBuildSessionChatCaptureEnabledForTest(true);

  await writeCommitMessage(SENTINEL, seedMtime);
  await checkBuildSession();

  // Assert: .chat_capture grew
  const sizeAfter = captureFileSize();
  if (sizeAfter <= offsetBefore) {
    fail(
      `.chat_capture did not grow after checkBuildSession().\n` +
      `  Before: ${offsetBefore} bytes  After: ${sizeAfter} bytes\n` +
      `  The appendChatCaptureTurn call inside checkBuildSession() may be missing.`,
    );
  }
  pass(`.chat_capture grew: ${offsetBefore} → ${sizeAfter} bytes`);

  // Assert: new turn has speaker "Luca Replit"
  const rawBlock = newRawBlock(offsetBefore);

  if (!rawBlock.includes('SPEAKER: Luca Replit')) {
    fail(
      `No "SPEAKER: Luca Replit" turn found in .chat_capture after checkBuildSession().\n` +
      `  Raw new content (first 400 chars):\n  ${rawBlock.slice(0, 400)}\n` +
      `  The appendChatCaptureTurn('Luca Replit', ...) call may be missing.`,
    );
  }
  pass('New turn has SPEAKER: Luca Replit');

  // Assert: turn body contains the sentinel content
  if (!rawBlock.includes('CI-test-commit-msg-auto-capture')) {
    fail(
      `Sentinel string not found in new .chat_capture turn.\n` +
      `  Raw new content (first 400 chars):\n  ${rawBlock.slice(0, 400)}`,
    );
  }
  pass('Turn body contains the sentinel commit message content');
}

// ── Self-check ───────────────────────────────────────────────────────────────

async function runSelfCheck(checkBuildSession: () => Promise<void>): Promise<void> {
  console.log('Self-check phase 1 — append DISABLED (simulating regression)\n');

  // ── Phase 1: disable the seam, confirm no turn is written ────────────────
  const offsetBefore1 = captureFileSize();
  const seedMtime1    = Date.now() - 5000;
  setBuildLastMtimeForTest(seedMtime1);
  setBuildSessionChatCaptureEnabledForTest(false);   // ← regression simulation

  await writeCommitMessage(SENTINEL + '-disabled', seedMtime1);
  await checkBuildSession();

  const rawNew1 = newRawBlock(offsetBefore1);

  if (rawNew1.includes('SPEAKER: Luca Replit') && rawNew1.includes('CI-test-commit-msg-auto-capture')) {
    fail(
      'Self-check FAILED: a "Luca Replit" turn appeared even though the seam was disabled.\n' +
      '  setBuildSessionChatCaptureEnabledForTest(false) did not suppress the append.\n' +
      '  The guard in checkBuildSession() is not checking _buildSessionChatCaptureEnabled.',
    );
  }
  pass('Phase 1: no "Luca Replit" turn written when seam is disabled ✓ (regression confirmed)');

  // ── Phase 2: re-enable the seam, confirm the turn IS written ─────────────
  console.log('\nSelf-check phase 2 — append RE-ENABLED (confirming gate is active)\n');

  const offsetBefore2 = captureFileSize();
  const seedMtime2    = Date.now() - 5000;
  setBuildLastMtimeForTest(seedMtime2);
  setBuildSessionChatCaptureEnabledForTest(true);    // ← gate re-engaged

  await writeCommitMessage(SENTINEL + '-enabled', seedMtime2);
  await checkBuildSession();

  const rawNew2 = newRawBlock(offsetBefore2);

  if (!rawNew2.includes('SPEAKER: Luca Replit')) {
    fail(
      'Self-check FAILED: no "Luca Replit" turn appeared after re-enabling the seam.\n' +
      `  Raw new content:\n  ${rawNew2.slice(0, 400)}`,
    );
  }
  pass('Phase 2: "Luca Replit" turn written correctly when seam is enabled ✓');

  if (!rawNew2.includes('CI-test-commit-msg-auto-capture')) {
    fail('Self-check FAILED: sentinel string missing from new turn in phase 2.');
  }
  pass('Phase 2: sentinel content present in new turn ✓');

  console.log('\n✅  Self-check passed — removing appendChatCaptureTurn causes test to fail as expected.\n');
}
