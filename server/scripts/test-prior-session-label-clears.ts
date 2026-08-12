/**
 * test-prior-session-label-clears.ts
 *
 * CI check: confirms that the "📁 prior" / "prior session" label in the
 * episode-capture-status.md file clears and live data takes over after the
 * first call to writeCaptureStatus() — i.e., after the first live exchange
 * is appended during a session.
 *
 * Background
 * ─────────────────────────────────────────────────────────────────────────────
 * At startup, seedCaptureStatusFromEpisodeFile() reads the prior session's
 * episode file, sets _seededFromPriorSession = true, and writes the status
 * file with "📁 prior" labels so Luca can immediately see the last known
 * state.  The FIRST real call to writeCaptureStatus() (triggered by
 * appendExchangeToEpisode()) must set _seededFromPriorSession = false so that
 * subsequent status-file writes show live "✓" / "⚠️ STALE" labels instead.
 *
 * If the flag-clear line were removed, the status file would permanently show
 * "📁 prior" even during an active live session, making the ordering check
 * useless.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Test seams used
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   setSeededFromPriorSessionForTest(true)
 *     — Directly sets _seededFromPriorSession = true, simulating the state
 *       after seedCaptureStatusFromEpisodeFile() without a DB round-trip.
 *
 *   resetLiveWriteHasOccurredForTest()
 *     — Resets the monotonic _liveWriteHasOccurred guard so the test can run
 *       a fresh seed-then-live-write cycle.
 *
 *   setSkipSeededFlagClearForTest(true)
 *     — Makes writeCaptureStatus() skip the `_seededFromPriorSession = false`
 *       line — used in normal mode to write the initial "seeded" status file
 *       (so both before and after states are observable), and used in
 *       self-check mode to simulate the regression.
 *
 *   writeCaptureStatusForTest(filename)
 *     — Calls the private writeCaptureStatus() from a CI script.
 *
 *   getCaptureStatusPath()
 *     — Returns the absolute path of episode-capture-status.md.
 *
 *   getSeededFromPriorSession()
 *     — Reads the current _seededFromPriorSession flag for assertions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Snapshots the status file so it can be restored in finally.
 *   2. Resets monotonic guard + sets _seededFromPriorSession = true.
 *   3. Calls writeEpisodeCaptureStatusFileForTest() directly — writes the "📁 prior"
 *      status file WITHOUT going through writeCaptureStatus(), so _liveWriteHasOccurred
 *      stays false and no flag-clear path is exercised.
 *   4. Asserts status file contains "📁 prior" and flag is still true.
 *   5. Calls writeCaptureStatusForTest() exactly ONCE — this is the first live write.
 *   6. Asserts _seededFromPriorSession is now false.
 *   7. Asserts status file no longer contains "prior session" or "📁 prior".
 *   8. Asserts the Exchange line now starts with "✓".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the check FAILS when _skipSeededFlagClearForTest is left enabled
 *   (models the regression where `_seededFromPriorSession = false` is removed
 *   from writeCaptureStatus()):
 *   1. Resets state and sets _seededFromPriorSession = true.
 *   2. Calls writeEpisodeCaptureStatusFileForTest() directly to write seeded state.
 *   3. Enables _skipSeededFlagClearForTest (bug: flag-clear line missing).
 *   4. Calls writeCaptureStatusForTest() once — first live write, but flag-clear skipped.
 *   5. Asserts _seededFromPriorSession is still true (bug confirmed).
 *   6. Asserts status file STILL contains "📁 prior" (check would have failed
 *      in normal mode → self-check is sound).
 *
 * Run:
 *   npx tsx server/scripts/test-prior-session-label-clears.ts
 *   npx tsx server/scripts/test-prior-session-label-clears.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import {
  getSeededFromPriorSession,
  setSeededFromPriorSessionForTest,
  resetLiveWriteHasOccurredForTest,
  writeCaptureStatusForTest,
  writeEpisodeCaptureStatusFileForTest,
  getCaptureStatusPath,
  setSkipSeededFlagClearForTest,
} from '../services/agent-session-autosave';

// ── Colour helpers ─────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

// ── Constants ──────────────────────────────────────────────────────────────────
// A dummy episode filename — _writeEpisodeCaptureStatusFile handles missing
// files gracefully (lineCount=0, byteCount=0), so no real file is needed.
const DUMMY_EPISODE = 'episode-ci-test-prior-label.md';

// ── CLI ────────────────────────────────────────────────────────────────────────
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

// ── Snapshot helpers ───────────────────────────────────────────────────────────
interface FileSnapshot {
  existed: boolean;
  content: string;
}

function snapshotFile(filePath: string): FileSnapshot {
  if (!existsSync(filePath)) return { existed: false, content: '' };
  return { existed: true, content: readFileSync(filePath, 'utf-8') };
}

function restoreFile(filePath: string, snap: FileSnapshot): void {
  if (snap.existed) {
    writeFileSync(filePath, snap.content, 'utf-8');
  } else if (existsSync(filePath)) {
    unlinkSync(filePath);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
const STATUS_PATH = getCaptureStatusPath();

async function runNormalMode(): Promise<void> {
  sep();
  console.log(B('Normal mode: prior-session label clears after first live write'));
  sep();

  const statusSnap = snapshotFile(STATUS_PATH);

  try {
    // ── Step 1: Simulate startup-seed state ──────────────────────────────────
    console.log('\nStep 1 — Simulating startup-seed state');
    resetLiveWriteHasOccurredForTest();
    setSeededFromPriorSessionForTest(true);

    assert(
      '_seededFromPriorSession is true after seed simulation',
      getSeededFromPriorSession() === true,
      `actual: ${getSeededFromPriorSession()}`,
    );

    // ── Step 2: Write seeded status file DIRECTLY (no live-write path) ──────
    // Use writeEpisodeCaptureStatusFileForTest() which calls _writeEpisodeCaptureStatusFile
    // directly, bypassing writeCaptureStatus() entirely.  This means _liveWriteHasOccurred
    // stays false and the skip-seam is NOT needed — the seeded display comes from
    // _seededFromPriorSession=true alone.
    console.log('\nStep 2 — Writing seeded status file directly (no live write, _liveWriteHasOccurred stays false)');
    writeEpisodeCaptureStatusFileForTest(DUMMY_EPISODE, 0 /* captureMs=0 → "never" for exchange time */);

    const seededContent = existsSync(STATUS_PATH) ? readFileSync(STATUS_PATH, 'utf-8') : '';

    assert(
      'Status file written after seed simulation',
      seededContent.length > 0,
      'Status file is empty — writeEpisodeCaptureStatusFileForTest did not write.',
    );

    assert(
      'Status file shows "📁 prior" in seeded state',
      seededContent.includes('📁 prior'),
      `Exchange line: ${seededContent.split('\n').find(l => l.includes('Exchange')) ?? '(not found)'}`,
    );

    assert(
      '_seededFromPriorSession still true (flag not yet cleared — no live write yet)',
      getSeededFromPriorSession() === true,
      `actual: ${getSeededFromPriorSession()}`,
    );

    // ── Step 3: Simulate FIRST live exchange (one call, no seam) ────────────
    console.log('\nStep 3 — Calling writeCaptureStatusForTest ONCE (first live exchange)');
    writeCaptureStatusForTest(DUMMY_EPISODE);

    const liveContent = existsSync(STATUS_PATH) ? readFileSync(STATUS_PATH, 'utf-8') : '';

    // ── Step 4: Assert label cleared ─────────────────────────────────────────
    console.log('\nStep 4 — Asserting label cleared and live data shows');

    assert(
      '_seededFromPriorSession is false after first live write',
      getSeededFromPriorSession() === false,
      `actual: ${getSeededFromPriorSession()}`,
    );

    assert(
      'Status file does not contain "📁 prior" after live write',
      !liveContent.includes('📁 prior'),
      `Exchange line: ${liveContent.split('\n').find(l => l.includes('Exchange')) ?? '(not found)'}`,
    );

    assert(
      'Status file does not contain "prior session" after live write',
      !liveContent.includes('prior session'),
      `Matching line: ${liveContent.split('\n').find(l => l.includes('prior session')) ?? '(not found)'}`,
    );

    assert(
      'Exchange channel shows "✓" (not "📁 prior") after live write',
      liveContent.split('\n').some(l => l.includes('Exchange') && l.includes('✓')),
      `Exchange line: ${liveContent.split('\n').find(l => l.includes('Exchange')) ?? '(not found)'}`,
    );

  } finally {
    // ── Restore state ─────────────────────────────────────────────────────────
    setSkipSeededFlagClearForTest(false);
    restoreFile(STATUS_PATH, statusSnap);
    console.log('\n(Status file restored to pre-test state)');
  }
}

async function runSelfCheckMode(): Promise<void> {
  sep();
  console.log(Y('Self-check mode: confirms the check FAILS when flag-clear line is missing'));
  sep();
  console.log(Y('  (Simulating the regression: _seededFromPriorSession = false removed from writeCaptureStatus())'));

  const statusSnap = snapshotFile(STATUS_PATH);

  try {
    // ── Setup: seed state ────────────────────────────────────────────────────
    resetLiveWriteHasOccurredForTest();
    setSeededFromPriorSessionForTest(true);

    // Write the seeded status directly (no live write path — _liveWriteHasOccurred stays false)
    writeEpisodeCaptureStatusFileForTest(DUMMY_EPISODE, 0);

    // Enable the bug seam AFTER the seeded write so the first live call has the flag-clear removed
    setSkipSeededFlagClearForTest(true);  // bug: flag-clear line removed

    // ── Simulate FIRST live exchange (but with the bug present) ──────────────
    writeCaptureStatusForTest(DUMMY_EPISODE);

    const content = existsSync(STATUS_PATH) ? readFileSync(STATUS_PATH, 'utf-8') : '';

    // ── Assertions that prove the check would FAIL in normal mode ────────────
    console.log('\nVerifying the bug is observable:');

    assert(
      '_seededFromPriorSession is STILL true (flag-clear was skipped — bug confirmed)',
      getSeededFromPriorSession() === true,
      `actual: ${getSeededFromPriorSession()} — if false, the seam is not working`,
    );

    assert(
      'Status file STILL shows "📁 prior" (bug: normal-mode check would have caught this)',
      content.includes('📁 prior'),
      `Exchange line: ${content.split('\n').find(l => l.includes('Exchange')) ?? '(not found)'}`,
    );

    assert(
      'Status file STILL contains "prior session" text',
      content.includes('prior session'),
      `Content snippet: ${content.slice(0, 300)}`,
    );

    console.log('\n' + Y('  ↑ These assertions confirm the self-check is sound:'));
    console.log(Y('    in normal mode, the check at step 4 would have reported FAILED.'));

  } finally {
    setSkipSeededFlagClearForTest(false);
    restoreFile(STATUS_PATH, statusSnap);
    console.log('\n(Status file restored to pre-test state)');
  }
}

// ── Run ────────────────────────────────────────────────────────────────────────
(async () => {
  console.log(B(`\ntest-prior-session-label-clears — ${selfCheckMode ? 'self-check' : 'normal'} mode`));

  if (selfCheckMode) {
    await runSelfCheckMode();
  } else {
    await runNormalMode();
  }

  sep();
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(R(`\nFAILED — ${failed} assertion(s) did not hold.`));
    process.exit(1);
  } else {
    console.log(G('\nPASSED — prior-session label clears correctly after first live exchange.'));
  }
})();
