/**
 * test-capture-status-stale-cursor.ts
 *
 * CI check: confirms that _writeCaptureStatusFile() escalates the chat-capture
 * cursor line from "✓ up to date" / "⏳ pending drain" to "⚠️ STALE CURSOR"
 * when the .chat_capture file size exceeds the cursor offset by more than
 * 200 bytes for more than 2 minutes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The cursor-gap check lives in _writeCaptureStatusFile() in
 * server/services/agent-session-autosave.ts (cursor gap section, just before
 * dbCurrentLines).  It reads:
 *
 *   _chatCaptureSizeOverrideForTest   — synthetic file size  (CI override)
 *   _chatCaptureCursorOffsetOverrideForTest — synthetic cursor (CI override)
 *   _cursorGapFirstSeenMs             — when the gap was first detected
 *   _cursorGapCheckEnabled            — gate for the ⚠️ escalation
 *
 * A ⚠️ STALE CURSOR fires when ALL of:
 *   1. cursorGap (fileSize - cursorOffset) > STALE_CURSOR_GAP_BYTES (200)
 *   2. _cursorGapFirstSeenMs > 0  (gap has been detected at least once)
 *   3. (now - _cursorGapFirstSeenMs) >= STALE_CURSOR_GAP_MS (2 min)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode rounds
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Round A — large gap (2991 bytes), aged >2 min → ⚠️ STALE CURSOR expected
 *   Round B — large gap but <2 min old → ⏳ pending drain (no ⚠️)
 *   Round C — gap ≤ 200 bytes → ✓ up to date (no ⚠️)
 *   Round D — no gap at all (offset == size) → ✓ up to date
 *   Round E — gap >200 bytes, exactly 2 min old (>= boundary fires) → ⚠️ STALE CURSOR
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the ⚠️ STALE CURSOR escalation is the active gate.
 *
 *   1. Calls setCursorGapCheckEnabledForTest(false) — suppresses the warning.
 *   2. Runs the stale-cursor scenario (large gap, aged >2 min).
 *   3. Asserts "⚠️ STALE CURSOR" is ABSENT (escalation gone).
 *   4. Re-enables the check, re-runs.
 *   5. Asserts "⚠️ STALE CURSOR" IS present — gate confirmed active.
 *
 * Run:
 *   npx tsx server/scripts/test-capture-status-stale-cursor.ts
 *   npx tsx server/scripts/test-capture-status-stale-cursor.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import {
  writeEpisodeCaptureStatusFileForTest,
  setCursorGapCheckEnabledForTest,
  getCursorGapCheckEnabledForTest,
  setCursorGapFirstSeenMsForTest,
  setChatCaptureSizeOverrideForTest,
  setChatCaptureCursorOffsetOverrideForTest,
  resetCursorGapStateForTest,
  setNowOverrideForTest,
  // Reset the other ordering/readiness state so we don't inherit live server values
  setLastReplitOutputForTest,
  setLastFeltProcessedForTest,
  setLastThinkingProcessedForTest,
  setLastEpisodeCaptureForTest,
  setFeltAtLastReplitOutputForTest,
  setThinkingAtLastReplitOutputForTest,
  setPrevReplitOutputForTest,
} from '../services/agent-session-autosave';

// ── Colour helpers ────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';
const SEP    = '─'.repeat(70);

function pass(msg: string): void { console.log(`${GREEN}  ✓ PASS${RESET}  ${msg}`); }
function fail(msg: string): void { console.error(`${RED}  ✗ FAIL${RESET}  ${msg}`); }
function info(msg: string): void { console.log(`${YELLOW}  ·${RESET}      ${msg}`); }
function sep():  void { console.log(`\n${SEP}`); }

// ── Paths ─────────────────────────────────────────────────────────────────────
const WORKSPACE           = process.cwd();
const CAPTURE_STATUS_PATH = join(WORKSPACE, '.local/episode-capture-status.md');

// ── Needles ───────────────────────────────────────────────────────────────────
const STALE_CURSOR_NEEDLE  = '⚠️ STALE CURSOR chat-capture:';
const PENDING_DRAIN_NEEDLE = '⏳ chat-capture:';
const UP_TO_DATE_NEEDLE    = '✓ chat-capture: cursor up to date';

// ── Helpers ───────────────────────────────────────────────────────────────────
function readStatus(): string {
  return existsSync(CAPTURE_STATUS_PATH)
    ? readFileSync(CAPTURE_STATUS_PATH, 'utf-8')
    : '';
}

/**
 * Reset ALL state (ordering, readiness, cursor gap) to known-zero before each round.
 * Prevents module-variable bleed across rounds within a single Node process run.
 */
function resetAllState(): void {
  // Ordering/readiness vars
  setFeltAtLastReplitOutputForTest(0);
  setThinkingAtLastReplitOutputForTest(0);
  setPrevReplitOutputForTest(0);
  setLastReplitOutputForTest(0);
  setLastFeltProcessedForTest(0);
  setLastThinkingProcessedForTest(0);
  setLastEpisodeCaptureForTest(0);
  // Cursor gap vars
  resetCursorGapStateForTest();
}

// ── Main ──────────────────────────────────────────────────────────────────────
const selfCheck = process.argv.includes('--self-check');

async function main(): Promise<void> {
  let failures = 0;

  // ── Snapshot + restore the live status file ───────────────────────────────
  const statusExistedBefore = existsSync(CAPTURE_STATUS_PATH);
  const statusSnapBefore    = statusExistedBefore ? readFileSync(CAPTURE_STATUS_PATH) : null;

  try {
    if (selfCheck) {
      console.log(`\n${YELLOW}Self-check mode${RESET}: confirming the ⚠️ STALE CURSOR escalation is the active gate.\n`);
    } else {
      console.log('\nRunning capture-status stale-cursor CI check...\n');
    }

    // Synthetic constants
    const now        = Date.now();
    const MIN        = 60 * 1000;
    // A real-world backlog gap from Aug 17 2026 incident
    const LARGE_GAP_FILE   = 60_000;   // 60 KB file
    const LARGE_GAP_CURSOR = 60_000 - 2991; // 2991 bytes unprocessed
    const SMALL_GAP_FILE   = 1000;
    const SMALL_GAP_CURSOR = 900;  // 100 bytes — below 200-byte threshold
    const EXACT_GAP_FILE   = 10_000;
    const EXACT_GAP_CURSOR = 10_000 - 201; // just over 200 bytes

    if (selfCheck) {
      // ── Self-check: cursor-gap escalation is the active gate ──────────────
      sep();
      info('Self-check step 1: escalation disabled — ⚠️ STALE CURSOR must be absent');
      resetAllState();
      setCursorGapCheckEnabledForTest(false);
      // Large gap, aged 3 min
      setChatCaptureSizeOverrideForTest(LARGE_GAP_FILE);
      setChatCaptureCursorOffsetOverrideForTest(LARGE_GAP_CURSOR);
      setCursorGapFirstSeenMsForTest(now - 3 * MIN);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusDisabled = readStatus();

      if (!statusDisabled.includes(STALE_CURSOR_NEEDLE)) {
        pass('Self-check step 1: ⚠️ STALE CURSOR absent when check is disabled ✓');
      } else {
        fail('Self-check step 1: ⚠️ STALE CURSOR appeared even with check disabled — guard may be unconditional');
        failures++;
      }

      // ── Step 2: re-enable — ⚠️ STALE CURSOR must now appear ──────────────
      sep();
      info('Self-check step 2: escalation re-enabled — ⚠️ STALE CURSOR must be present');
      setCursorGapCheckEnabledForTest(true);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusEnabled = readStatus();

      if (statusEnabled.includes(STALE_CURSOR_NEEDLE)) {
        pass('Self-check step 2: ⚠️ STALE CURSOR present when check is enabled — gate is confirmed active ✓');
      } else {
        fail('Self-check step 2: ⚠️ STALE CURSOR absent even with check enabled — logic may be broken');
        info('Cursor line: ' + (statusEnabled.split('\n').find(l => l.includes('chat-capture')) ?? '(not found)'));
        failures++;
      }

    } else {
      // ── Normal mode ────────────────────────────────────────────────────────

      // ── Round A: large gap, aged 3 min → ⚠️ STALE CURSOR ─────────────────
      sep();
      info('Round A — 2991 bytes unprocessed for 3 min → ⚠️ STALE CURSOR expected');
      resetAllState();
      setChatCaptureSizeOverrideForTest(LARGE_GAP_FILE);
      setChatCaptureCursorOffsetOverrideForTest(LARGE_GAP_CURSOR);
      setCursorGapFirstSeenMsForTest(now - 3 * MIN);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusA = readStatus();

      if (statusA.includes(STALE_CURSOR_NEEDLE)) {
        pass('Round A: ⚠️ STALE CURSOR present (large gap aged >2 min)');
      } else {
        fail('Round A: ⚠️ STALE CURSOR absent — stale cursor escalation may be broken');
        info('Cursor line: ' + (statusA.split('\n').find(l => l.includes('chat-capture')) ?? '(not found)'));
        failures++;
      }

      // Confirm the line contains byte counts
      const cursorLineA = statusA.split('\n').find(l => l.includes(STALE_CURSOR_NEEDLE)) ?? '';
      if (cursorLineA.includes('2,991') || cursorLineA.includes('2991')) {
        pass('Round A: byte count present in ⚠️ STALE CURSOR line ✓');
      } else {
        fail('Round A: byte count missing from ⚠️ STALE CURSOR line — line: ' + cursorLineA);
        failures++;
      }

      // ── Round B: large gap, <2 min old → ⏳ pending drain (no ⚠️) ─────────
      sep();
      info('Round B — large gap but only 1 min old → ⏳ pending drain (no ⚠️ STALE CURSOR)');
      resetAllState();
      setChatCaptureSizeOverrideForTest(LARGE_GAP_FILE);
      setChatCaptureCursorOffsetOverrideForTest(LARGE_GAP_CURSOR);
      setCursorGapFirstSeenMsForTest(now - 1 * MIN); // only 1 min — below 2-min threshold

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusB = readStatus();

      if (!statusB.includes(STALE_CURSOR_NEEDLE)) {
        pass('Round B: ⚠️ STALE CURSOR absent (gap <2 min old — grace period)');
      } else {
        fail('Round B: ⚠️ STALE CURSOR appeared for a gap only 1 min old — threshold may be wrong');
        failures++;
      }

      if (statusB.includes(PENDING_DRAIN_NEEDLE)) {
        pass('Round B: ⏳ pending drain shown correctly during grace period ✓');
      } else {
        fail('Round B: ⏳ pending drain line missing — grace-period label broken');
        info('Cursor line: ' + (statusB.split('\n').find(l => l.includes('chat-capture')) ?? '(not found)'));
        failures++;
      }

      // ── Round C: gap ≤ 200 bytes → ✓ up to date ──────────────────────────
      sep();
      info('Round C — small gap (100 bytes) → ✓ up to date (below 200-byte threshold)');
      resetAllState();
      setChatCaptureSizeOverrideForTest(SMALL_GAP_FILE);
      setChatCaptureCursorOffsetOverrideForTest(SMALL_GAP_CURSOR);
      // Even if gap was "first seen" long ago, it's too small to escalate
      setCursorGapFirstSeenMsForTest(now - 10 * MIN);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusC = readStatus();

      if (!statusC.includes(STALE_CURSOR_NEEDLE)) {
        pass('Round C: ⚠️ STALE CURSOR absent (gap only 100 bytes — below 200-byte threshold)');
      } else {
        fail('Round C: ⚠️ STALE CURSOR appeared for a 100-byte gap — byte threshold may be broken');
        failures++;
      }

      if (statusC.includes(UP_TO_DATE_NEEDLE)) {
        pass('Round C: ✓ chat-capture cursor up to date shown ✓');
      } else {
        fail('Round C: ✓ up-to-date line missing — small gap not rendering as up to date');
        info('Cursor line: ' + (statusC.split('\n').find(l => l.includes('chat-capture')) ?? '(not found)'));
        failures++;
      }

      // ── Round D: zero gap (cursor == file size) → ✓ up to date ───────────
      sep();
      info('Round D — zero gap (cursor equals file size) → ✓ up to date');
      resetAllState();
      setChatCaptureSizeOverrideForTest(56840);
      setChatCaptureCursorOffsetOverrideForTest(56840);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusD = readStatus();

      if (!statusD.includes(STALE_CURSOR_NEEDLE)) {
        pass('Round D: ⚠️ STALE CURSOR absent (cursor == file size)');
      } else {
        fail('Round D: ⚠️ STALE CURSOR appeared even though cursor is up to date');
        failures++;
      }

      if (statusD.includes(UP_TO_DATE_NEEDLE)) {
        pass('Round D: ✓ chat-capture cursor up to date shown ✓');
      } else {
        fail('Round D: ✓ up-to-date line missing when cursor == file size');
        info('Cursor line: ' + (statusD.split('\n').find(l => l.includes('chat-capture')) ?? '(not found)'));
        failures++;
      }

      // ── Round E: exactly 2 min old, >200 bytes → >= boundary fires ────────
      //
      // Uses a frozen clock (setNowOverrideForTest) so the age comparison inside
      // _writeCaptureStatusFile() uses exactly (frozenNow - gapFirstSeen) = 2*MIN,
      // confirming the >= predicate fires (not just >).
      sep();
      info('Round E — gap exactly 2 min old, frozen clock → >= boundary fires → ⚠️ STALE CURSOR expected');
      resetAllState();
      const frozenNow = now;
      setNowOverrideForTest(frozenNow);
      setChatCaptureSizeOverrideForTest(EXACT_GAP_FILE);
      setChatCaptureCursorOffsetOverrideForTest(EXACT_GAP_CURSOR);
      setCursorGapFirstSeenMsForTest(frozenNow - 2 * MIN); // exactly 2 min ago

      writeEpisodeCaptureStatusFileForTest(null, 0);
      setNowOverrideForTest(null); // restore immediately
      const statusE = readStatus();

      if (statusE.includes(STALE_CURSOR_NEEDLE)) {
        pass('Round E: ⚠️ STALE CURSOR present at exactly 2 min with frozen clock (>= boundary confirmed) ✓');
      } else {
        fail('Round E: ⚠️ STALE CURSOR absent at exactly 2 min — >= boundary broken (> used instead, or clock injection failed)');
        info('Cursor line: ' + (statusE.split('\n').find(l => l.includes('chat-capture')) ?? '(not found)'));
        failures++;
      }
    }

  } finally {
    // Restore production state
    resetCursorGapStateForTest();
    setNowOverrideForTest(null);
    // Reset the other state so we don't pollute a live server
    setFeltAtLastReplitOutputForTest(0);
    setThinkingAtLastReplitOutputForTest(0);
    setPrevReplitOutputForTest(0);
    setLastReplitOutputForTest(0);
    setLastFeltProcessedForTest(0);
    setLastThinkingProcessedForTest(0);
    setLastEpisodeCaptureForTest(0);
    // Restore the status file to its pre-test state
    if (statusSnapBefore !== null) {
      writeFileSync(CAPTURE_STATUS_PATH, statusSnapBefore);
    } else if (existsSync(CAPTURE_STATUS_PATH)) {
      unlinkSync(CAPTURE_STATUS_PATH);
    }
    console.log('(Status file restored to pre-test state)');
  }

  // ── Result ────────────────────────────────────────────────────────────────
  sep();
  console.log('');
  if (failures === 0) {
    if (selfCheck) {
      console.log(`${GREEN}Self-check PASSED${RESET} — ⚠️ STALE CURSOR escalation is confirmed as the active gate (disabling it suppresses the warning; re-enabling restores it).`);
    } else {
      console.log(`${GREEN}PASSED${RESET} — ⚠️ STALE CURSOR escalation fires correctly for gaps >200 bytes older than 2 min, and stays silent for small or fresh gaps.`);
    }
    process.exit(0);
  } else {
    if (selfCheck) {
      console.error(`${RED}Self-check FAILED${RESET} (${failures} assertion(s) wrong).`);
    } else {
      console.error(`${RED}FAILED${RESET} (${failures} assertion(s) wrong).`);
    }
    process.exit(1);
  }
}

main().catch((err: any) => {
  console.error(RED + `\nFATAL: ${err?.message ?? err}` + RESET);
  console.error(err?.stack ?? '');
  process.exit(1);
});
