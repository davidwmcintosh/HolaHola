/**
 * test-capture-status-ordering.ts
 *
 * CI check: confirms that _writeEpisodeCaptureStatusFile() emits "OUT OF ORDER"
 * when a thinking: entry fires AFTER the prior exchange (reactive, not anticipatory),
 * shows ✓ when thinking fires before the prior exchange (correctly anticipatory),
 * and shows MISSING when thinking has never fired this server run.
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
 * Ordering model (anticipatory inner-life):
 *
 *   thinkingAtLastExchange > prevEpisodeCaptureMs  → fired AFTER prior exchange (reactive)  → ⚠️ OUT OF ORDER
 *   thinkingAtLastExchange === 0                   → never fired this server run             → ⚠️ MISSING
 *   0 < thinkingAtLastExchange ≤ prevEpisodeCaptureMs → fired before prior exchange (✓)     → ✓
 *
 * The out-of-order threshold is prevEpisodeCaptureMs, NOT captureMs.
 * Snapshots are taken before captureMs advances, so snapshot > captureMs is
 * unreachable in production; prevEpisodeCaptureMs is the meaningful threshold
 * that catches real reactive-write scenarios in live operation.
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
 * Normal mode rounds
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Round A — out-of-order (thinking fires AFTER the prior exchange):
 *     Sets prevEpisodeCaptureMs = T, captureMs = T+60s.
 *     thinkingAtLastExchange = T+30s (after prior exchange T → reactive → OUT OF ORDER).
 *     feltAtLastExchange     = T-30s (before prior exchange → anticipatory → ✓).
 *     Asserts: "⚠️ OUT OF ORDER  Thinking:" present.
 *     Asserts: "⚠️ OUT OF ORDER  Felt:" absent (felt is anticipatory).
 *
 *   Round B — anticipatory ✓ (thinking fires BEFORE the prior exchange):
 *     thinkingAtLastExchange = T-1ms (just before prior exchange → ✓).
 *     Asserts: "✓  Thinking:" present, OUT OF ORDER and MISSING absent.
 *
 *   Round C — MISSING (thinking never fired this server run):
 *     thinkingAtLastExchange = 0 (never fired → MISSING).
 *     Asserts: "⚠️ MISSING  Thinking:" present, OUT OF ORDER absent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the gate fails when the ordering detection is disabled (simulates
 *   the guard being removed from _writeEpisodeCaptureStatusFile()):
 *   1. Calls setOrderingCheckEnabledForTest(false) — suppresses OUT OF ORDER.
 *   2. Runs the out-of-order scenario (Round A: thinking = T+30s > T).
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
    // Ordering model: OUT OF ORDER fires when thinkingAtLastExchange > prevEpisodeCaptureMs
    // (thinking fired AFTER the prior exchange = reactive, not anticipatory).
    //
    // T           = prior exchange (prevEpisodeCaptureMs)
    // T + 60 000  = current exchange (captureMs)
    // T + 30 000  = thinking fired AFTER prior exchange but BEFORE current → OUT OF ORDER ⚠️
    //               (reactive — responded to T rather than preparing for T+60s)
    // T - 30 000  = felt/thinking fired BEFORE prior exchange → ✓ (anticipatory)
    // 0           = thinking never fired → MISSING ⚠️
    const T        = 1_000_000;
    const EXCHANGE = T + 60_000;   // captureMs (current exchange)
    // AFTER is between prior exchange (T) and current exchange (EXCHANGE).
    // Under the prevEpisodeCaptureMs model, this is OUT OF ORDER (reactive to T).
    const AFTER    = T + 30_000;   // thinking snapshot > prevEpisodeCaptureMs → OUT OF ORDER
    const BEFORE   = T - 30_000;   // felt snapshot ≤ prevEpisodeCaptureMs AND > 0 → ✓

    // ── Round A: mixed scenario — thinking reactive (OOO), felt anticipatory (✓) ──────
    info('Round A — thinking fires AFTER prior exchange (OUT OF ORDER), felt fires before (✓)');
    resetOrderingState();
    setPrevEpisodeCaptureForTest(T);
    setLastEpisodeCaptureForTest(EXCHANGE);
    // Snapshots taken at the moment the current exchange was committed:
    setFeltAtLastExchangeForTest(BEFORE);        // felt fired before prior exchange → ✓
    setThinkingAtLastExchangeForTest(AFTER);     // thinking fired after prior exchange → OUT OF ORDER
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
      // ── Round A Assertion 1: thinking (reactive) fires the warning ────────────────
      if (statusA.includes(OUT_OF_ORDER_NEEDLE)) {
        pass('Round A: ⚠️ OUT OF ORDER detected for thinking (fired after prior exchange)');
      } else {
        fail('Round A: OUT OF ORDER NOT detected for thinking — ordering guard may be broken');
        info('Status file content:\n' + statusA.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Round A Assertion 2: felt (anticipatory — before prior exchange) shows ✓, not OOO ──
      info('Round A (felt) — felt fires BEFORE prior exchange (anticipatory → ✓, NOT OUT OF ORDER)');
      const FELT_OOO_NEEDLE = '⚠️ OUT OF ORDER  Felt:';
      if (!statusA.includes(FELT_OOO_NEEDLE)) {
        pass('Round A: no spurious OUT OF ORDER for felt (fired before prior exchange)');
      } else {
        fail('Round A: felt falsely flagged OUT OF ORDER even though it fired before prior exchange');
        info('Status file content:\n' + statusA.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Round B: anticipatory ✓ (thinking fires BEFORE the prior exchange) ──────────
      //
      // BEFORE_PRIOR = T-1ms: 0 < T-1 ≤ prevEpisodeCaptureMs (T) → ✓ (anticipatory)
      // This is the happy path: thinking prepared before the prior exchange.
      const BEFORE_PRIOR = T - 1;

      info('Round B — thinking fires BEFORE prior exchange (anticipatory → ✓)');
      resetOrderingState();
      setPrevEpisodeCaptureForTest(T);
      setLastEpisodeCaptureForTest(EXCHANGE);
      setThinkingAtLastExchangeForTest(BEFORE_PRIOR);  // before prior exchange → anticipatory → ✓
      setFeltAtLastExchangeForTest(BEFORE_PRIOR);       // same
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusB = readStatus();

      const THINK_OK_NEEDLE   = '✓  Thinking:';
      const THINK_OOO_NEEDLE  = '⚠️ OUT OF ORDER  Thinking:';
      const THINK_MISS_NEEDLE = '⚠️ MISSING  Thinking:';

      if (statusB.includes(THINK_OK_NEEDLE)) {
        pass('Round B: ✓ for thinking (fired before prior exchange — anticipatory)');
      } else {
        fail('Round B: thinking before prior exchange did NOT show ✓');
        info(`Thinking line: ${statusB.split('\n').find(l => l.includes('Thinking:')) ?? '(not found)'}`);
        failures++;
      }

      if (!statusB.includes(THINK_OOO_NEEDLE)) {
        pass('Round B: no spurious OUT OF ORDER for anticipatory thinking');
      } else {
        fail('Round B: anticipatory thinking was wrongly flagged OUT OF ORDER');
        failures++;
      }

      if (!statusB.includes(THINK_MISS_NEEDLE)) {
        pass('Round B: no spurious MISSING for anticipatory thinking');
      } else {
        fail('Round B: anticipatory thinking was wrongly flagged MISSING');
        failures++;
      }

      // ── Round C: MISSING (thinking never fired this server run) ──────────────────
      //
      // thinkingAtLastExchange = 0 → never fired → MISSING
      info('Round C — thinking never fired this server run (=0 → ⚠️ MISSING)');
      resetOrderingState();
      setPrevEpisodeCaptureForTest(T);
      setLastEpisodeCaptureForTest(EXCHANGE);
      setThinkingAtLastExchangeForTest(0);  // never fired → MISSING
      setFeltAtLastExchangeForTest(0);       // same
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusC = readStatus();

      if (statusC.includes(THINK_MISS_NEEDLE)) {
        pass('Round C: ⚠️ MISSING for thinking (never fired this server run)');
      } else {
        fail('Round C: MISSING not shown for never-fired thinking');
        info(`Thinking line: ${statusC.split('\n').find(l => l.includes('Thinking:')) ?? '(not found)'}`);
        failures++;
      }

      if (!statusC.includes(THINK_OOO_NEEDLE)) {
        pass('Round C: no spurious OUT OF ORDER for never-fired thinking');
      } else {
        fail('Round C: never-fired thinking wrongly flagged OUT OF ORDER instead of MISSING');
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
