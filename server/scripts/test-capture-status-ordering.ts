/**
 * test-capture-status-ordering.ts
 *
 * CI check: confirms that _writeEpisodeCaptureStatusFile() emits "OUT OF ORDER"
 * when a thinking: entry fires AFTER the most recent exchange, and does NOT emit
 * that warning when thinking: fires before the exchange (the correct sequence).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The ordering check lives in _writeEpisodeCaptureStatusFile() in
 * server/services/agent-session-autosave.ts.  It compares three module-level
 * timestamps that are only mutated by the live watcher loop:
 *
 *   prevEpisodeCaptureMs    — the exchange before the most recent one
 *   feltAtLastExchange      — snapshot of lastFeltProcessedMs taken when the
 *                             most recent exchange was committed
 *   thinkingAtLastExchange  — same, for thinking:
 *
 * captureMs (parameter) represents the most recent exchange timestamp.
 *
 * OUT OF ORDER fires when:
 *   feltAtLastExchange > prevEpisodeCaptureMs   (felt fired AFTER the prior exchange)
 *   thinkingAtLastExchange > prevEpisodeCaptureMs (thinking fired AFTER the prior exchange)
 *
 * Correct order: the snapshot must be ≤ prevEpisodeCaptureMs (channel fired before
 * the prior exchange, shaping it — not reactively after it).
 *
 * These six exported test-seam setters allow CI to inject synthetic timestamps
 * without running a live server:
 *
 *   setFeltAtLastExchangeForTest(ms)
 *   setThinkingAtLastExchangeForTest(ms)
 *   setPrevEpisodeCaptureForTest(ms)
 *   setLastEpisodeCaptureForTest(ms)
 *   setLastFeltProcessedForTest(ms)
 *   setLastThinkingProcessedForTest(ms)
 *
 * The status file output is read from .local/episode-capture-status.md, which
 * is the live path — snapshotted before the test and restored in finally.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Ordering invariant (why prevEpisodeCaptureMs is the right threshold)
 * ─────────────────────────────────────────────────────────────────────────────
 * feltAtLastExchange / thinkingAtLastExchange are snapshots of lastFelt/
 * ThinkingProcessedMs taken at the START of writeCaptureStatus(), BEFORE
 * lastEpisodeCaptureMs is advanced to Date.now().  So these snapshots are
 * always ≤ captureMs — comparing them against captureMs is unreachable and
 * can never fire.
 *
 * The meaningful threshold is prevEpisodeCaptureMs (the PRIOR exchange):
 *   snapshot > prevEpisodeCaptureMs → fired AFTER the prior exchange → OUT OF ORDER
 *   snapshot ≤ prevEpisodeCaptureMs → fired before the prior exchange → ✓ or MISSING
 *
 * Example: exchange N at T, exchange N+1 at T+60s.
 *   writeCaptureStatus() runs at T+60s, capturing:
 *     prevEpisodeCaptureMs = T
 *     thinkingAtLastExchange = lastThinkingProcessedMs (snapshot taken now)
 *   If thinking fired at T+30s (AFTER exchange N):
 *     thinkingAtLastExchange = T+30s > prevEpisodeCaptureMs = T → OUT OF ORDER ✓ (reachable)
 *   If thinking fired at T-30s (BEFORE exchange N):
 *     thinkingAtLastExchange = T-30s ≤ prevEpisodeCaptureMs = T → ✓ (reachable)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   Round A — out-of-order (thinking fires AFTER prior exchange at T):
 *     1. Sets prevEpisodeCaptureMs = T, captureMs = T+60s.
 *     2. Sets thinkingAtLastExchange = T+30s (AFTER prior exchange → bad).
 *     3. Sets feltAtLastExchange = T-30s (BEFORE prior exchange → correct).
 *     4. Calls writeEpisodeCaptureStatusFileForTest().
 *     5. Asserts output contains "⚠️ OUT OF ORDER  Thinking:".
 *     6. Asserts output does NOT contain "⚠️ OUT OF ORDER  Felt:".
 *
 *   (Both conditions — fires-after and fires-before — are exercised in one round
 *    since thinking=AFTER and felt=BEFORE are set simultaneously.)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the gate fails when the ordering detection is disabled (simulates
 *   the guard being removed from _writeEpisodeCaptureStatusFile()):
 *   1. Calls setOrderingCheckEnabledForTest(false) — suppresses OUT OF ORDER.
 *   2. Runs the out-of-order scenario.
 *   3. Asserts output does NOT contain "OUT OF ORDER" (detection is gone).
 *   4. Confirms a normal-mode check would have failed → self-check is sound.
 *
 * Run:
 *   npx tsx server/scripts/test-capture-status-ordering.ts
 *   npx tsx server/scripts/test-capture-status-ordering.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import {
  writeEpisodeCaptureStatusFileForTest,
  setFeltAtLastExchangeForTest,
  setThinkingAtLastExchangeForTest,
  setPrevEpisodeCaptureForTest,
  setLastEpisodeCaptureForTest,
  setLastFeltProcessedForTest,
  setLastThinkingProcessedForTest,
  setOrderingCheckEnabledForTest,
} from '../services/agent-session-autosave';

// ── Colour helpers ────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';

function pass(msg: string): void { console.log(`${GREEN}  ✓ PASS${RESET}  ${msg}`); }
function fail(msg: string): void { console.error(`${RED}  ✗ FAIL${RESET}  ${msg}`); }
function info(msg: string): void { console.log(`${YELLOW}  ·${RESET}      ${msg}`); }

// ── Paths ─────────────────────────────────────────────────────────────────────
const WORKSPACE          = process.cwd();
const CAPTURE_STATUS_PATH = join(WORKSPACE, '.local/episode-capture-status.md');

// Synthetic episode filename — does not need to exist; the function handles
// missing episode files gracefully (shows 0 lines / 0 bytes).
const FIXTURE_EPISODE = 'episode-ci-ordering-fixture.md';

// The specific pattern that appears on the ordering-warning lines in the
// "Previous round" section.  The footer always contains the literal string
// "OUT OF ORDER" in its explanatory note, so we must match the more-specific
// icon+label prefix that only appears when the guard actually fires.
// e.g. "  ⚠️ OUT OF ORDER  Thinking: — thinking fired at ..."
const OUT_OF_ORDER_NEEDLE = '⚠️ OUT OF ORDER  Thinking:';

// ── Helpers ───────────────────────────────────────────────────────────────────
function readStatus(): string {
  return existsSync(CAPTURE_STATUS_PATH)
    ? readFileSync(CAPTURE_STATUS_PATH, 'utf-8')
    : '';
}

/** Reset all ordering state to known-zero values before each round. */
function resetOrderingState(): void {
  setFeltAtLastExchangeForTest(0);
  setThinkingAtLastExchangeForTest(0);
  setPrevEpisodeCaptureForTest(0);
  setLastEpisodeCaptureForTest(0);
  setLastFeltProcessedForTest(0);
  setLastThinkingProcessedForTest(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const selfCheck = process.argv.includes('--self-check');

async function main(): Promise<void> {
  let failures = 0;

  // ── Snapshot + restore the live capture status file ───────────────────────
  const statusExistedBefore = existsSync(CAPTURE_STATUS_PATH);
  const statusSnapBefore    = statusExistedBefore ? readFileSync(CAPTURE_STATUS_PATH) : null;

  try {
    if (selfCheck) {
      console.log(`\n${YELLOW}Self-check mode${RESET}: disabling ordering detection — OUT OF ORDER should NOT appear.\n`);
      setOrderingCheckEnabledForTest(false);
    } else {
      console.log('\nRunning capture-status ordering CI check...\n');
    }

    // ── Synthetic timeline ────────────────────────────────────────────────────
    // The ordering check compares snapshots against prevEpisodeCaptureMs (the
    // PRIOR exchange), not against captureMs (the current exchange).
    //
    // T           = prior exchange (prevEpisodeCaptureMs)
    // T + 60 000  = current exchange (captureMs)
    // T + 30 000  = thinking fired AFTER prior exchange → OUT OF ORDER ⚠️
    // T - 30 000  = felt fired BEFORE prior exchange → correct ✓
    //
    // Both conditions are exercised in a single round:
    //   thinking = T+30s (AFTER T) → should warn
    //   felt     = T-30s (BEFORE T) → should NOT warn
    const T         = 1_000_000;
    const EXCHANGE  = T + 60_000;   // captureMs (current exchange)
    const AFTER     = T + 30_000;   // thinking snapshot > prevEpisodeCaptureMs → OUT OF ORDER
    const BEFORE    = T - 30_000;   // felt snapshot ≤ prevEpisodeCaptureMs → correct

    // Needle for the felt channel when it is NOT out-of-order (correct order).
    const FELT_OK_NEEDLE = '✓  Felt:';

    // ── Round A: mixed scenario — thinking out-of-order, felt correct ──────────
    info('Round A — thinking fires AFTER prior exchange (OUT OF ORDER), felt fires before (✓)');
    resetOrderingState();
    setPrevEpisodeCaptureForTest(T);
    setLastEpisodeCaptureForTest(EXCHANGE);
    // Snapshots taken at the moment the current exchange was committed:
    setFeltAtLastExchangeForTest(BEFORE);        // felt fired before prior exchange → ✓
    setThinkingAtLastExchangeForTest(AFTER);     // thinking fired after prior exchange → bad
    // Section 2 (current-round readiness) — set to show both fired recently
    setLastFeltProcessedForTest(EXCHANGE + 1_000);
    setLastThinkingProcessedForTest(EXCHANGE + 2_000);

    writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
    const statusA = readStatus();

    if (selfCheck) {
      // With ordering detection disabled, the specific warning line must NOT appear
      if (!statusA.includes(OUT_OF_ORDER_NEEDLE)) {
        pass('Self-check: OUT OF ORDER warning absent when detection is disabled ✓');
      } else {
        fail('Self-check: OUT OF ORDER warning still appeared even with detection disabled');
        failures++;
      }
      // Confirm that normal mode WOULD have produced the warning
      // (by temporarily re-enabling the check)
      setOrderingCheckEnabledForTest(true);
      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusNormal = readStatus();
      setOrderingCheckEnabledForTest(false);

      if (statusNormal.includes(OUT_OF_ORDER_NEEDLE)) {
        pass('Self-check: normal mode does produce OUT OF ORDER — self-check is sound ✓');
      } else {
        fail('Self-check: normal mode also failed to detect OUT OF ORDER — test logic may be broken');
        failures++;
      }
    } else {
      // ── Assertion 1: thinking (out-of-order) fires the warning ───────────────
      if (statusA.includes(OUT_OF_ORDER_NEEDLE)) {
        pass('Round A: ⚠️ OUT OF ORDER detected for thinking (fired after prior exchange)');
      } else {
        fail('Round A: OUT OF ORDER NOT detected for thinking — ordering guard may be broken');
        info('Status file content:\n' + statusA.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Assertion 2: felt (correct order) does NOT fire the warning ───────────
      // Same status file, same round — felt=BEFORE means it fired before the prior
      // exchange, so it should show ✓, not OUT OF ORDER.
      info('Round A (felt) — felt fires BEFORE prior exchange (should NOT warn OUT OF ORDER)');
      const FELT_OOO_NEEDLE = '⚠️ OUT OF ORDER  Felt:';
      if (!statusA.includes(FELT_OOO_NEEDLE)) {
        pass('Round A: no spurious OUT OF ORDER for felt (fired before prior exchange)');
      } else {
        fail('Round A: felt falsely flagged OUT OF ORDER even though it fired before exchange');
        info('Status file content:\n' + statusA.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }
    }

  } finally {
    // Restore the ordering check to production state
    setOrderingCheckEnabledForTest(true);
    // Restore module-level state to zero so we don't pollute a live server
    resetOrderingState();
    // Restore the status file to its pre-test state
    if (statusSnapBefore !== null) {
      writeFileSync(CAPTURE_STATUS_PATH, statusSnapBefore);
    } else if (existsSync(CAPTURE_STATUS_PATH)) {
      unlinkSync(CAPTURE_STATUS_PATH);
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  console.log('');
  if (failures === 0) {
    if (selfCheck) {
      console.log(`${GREEN}Self-check PASSED${RESET} — ordering detection is confirmed active (removing it breaks the test).`);
    } else {
      console.log(`${GREEN}PASSED${RESET} — capture-status ordering check fires correctly.`);
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

main().catch(err => {
  console.error(`${RED}Unexpected error:${RESET}`, err);
  process.exit(1);
});
