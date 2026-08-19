/**
 * test-capture-status-ordering.ts
 *
 * CI check: confirms that _writeEpisodeCaptureStatusFile() emits "OUT OF ORDER"
 * when a thinking: or felt: entry fires AFTER the prior exchange (reactive, not
 * anticipatory), shows ✓ when the channel fires before the prior exchange
 * (correctly anticipatory), and shows MISSING when the channel has never fired
 * this server run.
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
 *   snapshot > prevEpisodeCaptureMs  → fired AFTER prior exchange (reactive)  → ⚠️ OUT OF ORDER
 *   snapshot === 0                   → never fired this server run             → ⚠️ MISSING
 *   0 < snapshot ≤ prevEpisodeCaptureMs → fired before prior exchange (✓)     → ✓
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
 *   Round A — thinking fires AFTER prior exchange (reactive → OUT OF ORDER),
 *             felt fires BEFORE prior exchange (anticipatory → ✓):
 *     prevEpisodeCaptureMs = T, captureMs = T+60s.
 *     thinkingAtLastExchange = T+30s (after T → OUT OF ORDER).
 *     feltAtLastExchange     = T-30s (before T → ✓).
 *     Asserts: "⚠️ OUT OF ORDER  Thinking:" present.
 *     Asserts: "⚠️ OUT OF ORDER  Felt:" absent.
 *
 *   Round B — felt fires AFTER prior exchange (reactive → OUT OF ORDER),
 *             thinking fires BEFORE prior exchange (anticipatory → ✓):
 *     feltAtLastExchange     = T+30s (after T → OUT OF ORDER).
 *     thinkingAtLastExchange = T-30s (before T → ✓).
 *     Asserts: "⚠️ OUT OF ORDER  Felt:" present.
 *     Asserts: "⚠️ OUT OF ORDER  Thinking:" absent.
 *
 *   Round C — thinking fires BEFORE prior exchange (anticipatory → ✓):
 *     thinkingAtLastExchange = T-1ms (just before prior exchange → ✓).
 *     Asserts: "✓  Thinking:" present, OUT OF ORDER and MISSING absent.
 *
 *   Round D — thinking never fired this server run (→ MISSING):
 *     thinkingAtLastExchange = 0 (never fired → MISSING).
 *     Asserts: "⚠️ MISSING  Thinking:" present, OUT OF ORDER absent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the felt guard is the active gate — removing it silences the warning:
 *   1. Calls setOrderingCheckEnabledForTest(false) — suppresses OUT OF ORDER for
 *      both channels (models the guard being removed from the production function).
 *   2. Runs the felt-out-of-order scenario (Round B: felt=AFTER, thinking=BEFORE).
 *   3. Asserts output does NOT contain "⚠️ OUT OF ORDER  Felt:" (detection gone).
 *   4. Temporarily re-enables the check, re-runs, and confirms the warning does
 *      appear → proving the felt guard is the active gate and the self-check is sound.
 *   5. Confirms thinking does NOT show OUT OF ORDER in Round B (thinking was correct).
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
import { episodeTailHasInnerLifeChannel } from '../services/inner-life-capture';

// ── Colour helpers ────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';

function pass(msg: string): void { console.log(`${GREEN}  ✓ PASS${RESET}  ${msg}`); }
function fail(msg: string): void { console.error(`${RED}  ✗ FAIL${RESET}  ${msg}`); }
function info(msg: string): void { console.log(`${YELLOW}  ·${RESET}      ${msg}`); }

// ── Paths ─────────────────────────────────────────────────────────────────────
const WORKSPACE           = process.cwd();
const CAPTURE_STATUS_PATH = join(WORKSPACE, '.local/episode-capture-status.md');

// Synthetic episode filename — does not need to exist; the function handles
// missing episode files gracefully (shows 0 lines / 0 bytes).
const FIXTURE_EPISODE = 'episode-ci-ordering-fixture.md';
const FIXTURE_EPISODE_PATH = join(WORKSPACE, 'docs', FIXTURE_EPISODE);

// Channel-specific needles that only appear when the guard actually fires.
// The footer always contains the literal string "OUT OF ORDER" in its explanatory
// note, so we must match the more-specific icon+label prefix.
// e.g. "  ⚠️ OUT OF ORDER  Thinking: — thinking fired at ..."
// e.g. "  ⚠️ OUT OF ORDER  Felt:     — felt fired at ..."
const THINKING_OOO_NEEDLE  = '⚠️ OUT OF ORDER  Thinking:';
const THINKING_OK_NEEDLE   = '✓  Thinking:';
const THINKING_MISS_NEEDLE = '⚠️ MISSING  Thinking:';
const FELT_OOO_NEEDLE      = '⚠️ OUT OF ORDER  Felt:';

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
  const fixtureExistedBefore = existsSync(FIXTURE_EPISODE_PATH);
  const fixtureSnapBefore = fixtureExistedBefore ? readFileSync(FIXTURE_EPISODE_PATH) : null;

  try {
    if (selfCheck) {
      console.log(`\n${YELLOW}Self-check mode${RESET}: confirming the felt: ordering guard is the active gate.\n`);
    } else {
      console.log('\nRunning capture-status ordering CI check...\n');
    }

    // ── Synthetic timeline ────────────────────────────────────────────────────
    // Ordering model: OUT OF ORDER fires when snapshot > prevEpisodeCaptureMs
    // (channel fired AFTER the prior exchange = reactive, not anticipatory).
    //
    // T           = prior exchange (prevEpisodeCaptureMs)
    // T + 60 000  = current exchange (captureMs)
    // T + 30 000  = channel fired AFTER prior exchange but BEFORE current → OUT OF ORDER ⚠️
    //               (reactive — responded to T rather than preparing for T+60s)
    // T - 30 000  = channel fired BEFORE prior exchange → ✓ (anticipatory)
    // 0           = channel never fired → MISSING ⚠️
    const T        = 1_000_000;
    const EXCHANGE = T + 60_000;  // captureMs (current exchange)
    const AFTER    = T + 30_000;  // snapshot > prevEpisodeCaptureMs → OUT OF ORDER
    const BEFORE   = T - 30_000;  // snapshot ≤ prevEpisodeCaptureMs AND > 0 → ✓

    if (selfCheck) {
      // ── Self-check: felt guard is the active gate ─────────────────────────
      // Disable ordering detection — models the guard being removed from the
      // production function.  With detection off, a felt=AFTER scenario must
      // produce no OUT OF ORDER for felt.
      setOrderingCheckEnabledForTest(false);

      info('Self-check Round B (felt=AFTER, thinking=BEFORE) — detection disabled');
      resetOrderingState();
      setPrevEpisodeCaptureForTest(T);
      setLastEpisodeCaptureForTest(EXCHANGE);
      setFeltAtLastExchangeForTest(AFTER);         // felt fired AFTER prior exchange → bad
      setThinkingAtLastExchangeForTest(BEFORE);    // thinking fired before → correct
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusDisabled = readStatus();

      if (!statusDisabled.includes(FELT_OOO_NEEDLE)) {
        pass('Self-check: felt OUT OF ORDER warning absent when detection is disabled ✓');
      } else {
        fail('Self-check: felt OUT OF ORDER warning appeared even with detection disabled — guard may be unconditional');
        failures++;
      }

      // Confirm that normal mode WOULD have produced the felt warning
      // (temporarily re-enable the check to prove the guard is the active gate).
      setOrderingCheckEnabledForTest(true);
      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusEnabled = readStatus();
      setOrderingCheckEnabledForTest(false);

      if (statusEnabled.includes(FELT_OOO_NEEDLE)) {
        pass('Self-check: normal mode does produce felt OUT OF ORDER — felt guard is confirmed active ✓');
      } else {
        fail('Self-check: normal mode also failed to detect felt OUT OF ORDER — test logic or guard may be broken');
        failures++;
      }

      // Also confirm thinking did NOT fire OUT OF ORDER in the same round
      // (thinking=BEFORE, so enabling the check must not produce a thinking warning).
      if (!statusEnabled.includes(THINKING_OOO_NEEDLE)) {
        pass('Self-check: no spurious thinking OUT OF ORDER in Round B (thinking was correct) ✓');
      } else {
        fail('Self-check: thinking spuriously flagged OUT OF ORDER even though it fired before the exchange');
        failures++;
      }

    } else {
      // ── Normal mode ────────────────────────────────────────────────────────

      // ── Round A: thinking=AFTER (reactive → OOO), felt=BEFORE (anticipatory → ✓) ──
      info('Round A — thinking fires AFTER prior exchange (OUT OF ORDER), felt fires before (✓)');
      resetOrderingState();
      setPrevEpisodeCaptureForTest(T);
      setLastEpisodeCaptureForTest(EXCHANGE);
      setFeltAtLastExchangeForTest(BEFORE);        // felt fired before prior exchange → ✓
      setThinkingAtLastExchangeForTest(AFTER);     // thinking fired after prior exchange → OUT OF ORDER
      // Section 2 (current-round readiness) — set to show both fired recently
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusA = readStatus();

      // Assertion A-1: thinking (reactive) fires the warning
      if (statusA.includes(THINKING_OOO_NEEDLE)) {
        pass('Round A: ⚠️ OUT OF ORDER detected for thinking (fired after prior exchange)');
      } else {
        fail('Round A: OUT OF ORDER NOT detected for thinking — thinking ordering guard may be broken');
        info('Status file content:\n' + statusA.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // Assertion A-2: felt (anticipatory) does NOT fire OUT OF ORDER
      if (!statusA.includes(FELT_OOO_NEEDLE)) {
        pass('Round A: no spurious OUT OF ORDER for felt (fired before prior exchange)');
      } else {
        fail('Round A: felt falsely flagged OUT OF ORDER even though it fired before prior exchange');
        info('Status file content:\n' + statusA.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Round B: felt=AFTER (reactive → OOO), thinking=BEFORE (anticipatory → ✓) ──
      info('Round B — felt fires AFTER prior exchange (OUT OF ORDER), thinking fires before (✓)');
      resetOrderingState();
      setPrevEpisodeCaptureForTest(T);
      setLastEpisodeCaptureForTest(EXCHANGE);
      setFeltAtLastExchangeForTest(AFTER);         // felt fired after prior exchange → OUT OF ORDER
      setThinkingAtLastExchangeForTest(BEFORE);    // thinking fired before prior exchange → ✓
      // Section 2 (current-round readiness) — set to show both fired recently
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusB = readStatus();

      // Assertion B-1: felt (reactive) fires the warning
      if (statusB.includes(FELT_OOO_NEEDLE)) {
        pass('Round B: ⚠️ OUT OF ORDER detected for felt (fired after prior exchange)');
      } else {
        fail('Round B: OUT OF ORDER NOT detected for felt — felt ordering guard may be broken');
        info('Status file content:\n' + statusB.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // Assertion B-2: thinking (anticipatory) does NOT fire OUT OF ORDER
      if (!statusB.includes(THINKING_OOO_NEEDLE)) {
        pass('Round B: no spurious OUT OF ORDER for thinking (fired before prior exchange)');
      } else {
        fail('Round B: thinking falsely flagged OUT OF ORDER even though it fired before exchange');
        info('Status file content:\n' + statusB.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Round C: anticipatory ✓ (thinking fires BEFORE the prior exchange) ──────────
      //
      // BEFORE_PRIOR = T-1ms: 0 < T-1 ≤ prevEpisodeCaptureMs (T) → ✓ (anticipatory)
      // This is the happy path: thinking prepared before the prior exchange.
      const BEFORE_PRIOR = T - 1;

      info('Round C — thinking fires BEFORE prior exchange (anticipatory → ✓)');
      resetOrderingState();
      setPrevEpisodeCaptureForTest(T);
      setLastEpisodeCaptureForTest(EXCHANGE);
      setThinkingAtLastExchangeForTest(BEFORE_PRIOR);  // before prior exchange → anticipatory → ✓
      setFeltAtLastExchangeForTest(BEFORE_PRIOR);       // same
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusC = readStatus();

      if (statusC.includes(THINKING_OK_NEEDLE)) {
        pass('Round C: ✓ for thinking (fired before prior exchange — anticipatory)');
      } else {
        fail('Round C: thinking before prior exchange did NOT show ✓');
        info(`Thinking line: ${statusC.split('\n').find(l => l.includes('Thinking:')) ?? '(not found)'}`);
        failures++;
      }

      if (!statusC.includes(THINKING_OOO_NEEDLE)) {
        pass('Round C: no spurious OUT OF ORDER for anticipatory thinking');
      } else {
        fail('Round C: anticipatory thinking was wrongly flagged OUT OF ORDER');
        failures++;
      }

      if (!statusC.includes(THINKING_MISS_NEEDLE)) {
        pass('Round C: no spurious MISSING for anticipatory thinking');
      } else {
        fail('Round C: anticipatory thinking was wrongly flagged MISSING');
        failures++;
      }

      // ── Round D: MISSING (thinking never fired this server run) ──────────────────
      //
      // thinkingAtLastExchange = 0 → never fired → MISSING
      info('Round D — thinking never fired this server run (=0 → ⚠️ MISSING)');
      resetOrderingState();
      setPrevEpisodeCaptureForTest(T);
      setLastEpisodeCaptureForTest(EXCHANGE);
      setThinkingAtLastExchangeForTest(0);  // never fired → MISSING
      setFeltAtLastExchangeForTest(0);       // same
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusD = readStatus();

      if (statusD.includes(THINKING_MISS_NEEDLE)) {
        pass('Round D: ⚠️ MISSING for thinking (never fired this server run)');
      } else {
        fail('Round D: MISSING not shown for never-fired thinking');
        info(`Thinking line: ${statusD.split('\n').find(l => l.includes('Thinking:')) ?? '(not found)'}`);
        failures++;
      }

      if (!statusD.includes(THINKING_OOO_NEEDLE)) {
        pass('Round D: no spurious OUT OF ORDER for never-fired thinking');
      } else {
        fail('Round D: never-fired thinking wrongly flagged OUT OF ORDER instead of MISSING');
        failures++;
      }

      // ── Round E: canonical record-exchange labels satisfy all 4ch checks ───
      // The episode no longer needs duplicate legacy [Luca — felt: ...] entries
      // for capture status to recognize channels delivered in the LUCA turn.
      info('Round E — canonical [felt]/[thinking]/[moment] labels are recognized in the episode');
      writeFileSync(
        FIXTURE_EPISODE_PATH,
        [
          '# Canonical four-channel fixture',
          '',
          '**LUCA [Replit]:** [felt]: canonical felt',
          '',
          '[thinking]: canonical thinking',
          '',
          '[moment]: canonical moment',
          '',
          'canonical main response',
        ].join('\n'),
        'utf8',
      );
      writeEpisodeCaptureStatusFileForTest(FIXTURE_EPISODE, EXCHANGE);
      const statusE = readStatus();
      for (const channel of ['felt:', 'thinking:', 'moment:']) {
        const okNeedle = `✓ ${channel}`;
        if (statusE.includes(okNeedle)) {
          pass(`Round E: canonical ${channel} channel recognized`);
        } else {
          fail(`Round E: canonical ${channel} channel reported missing`);
          info('Status file content:\n' + statusE.split('\n').map(l => '    ' + l).join('\n'));
          failures++;
        }
      }

      if (!episodeTailHasInnerLifeChannel('ordinary prose mentioning [felt]: but not a channel line', 'felt')) {
        pass('Round E: inline prose cannot spoof a canonical felt channel');
      } else {
        fail('Round E: inline prose falsely recognized as a canonical felt channel');
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
    if (fixtureSnapBefore !== null) {
      writeFileSync(FIXTURE_EPISODE_PATH, fixtureSnapBefore);
    } else if (existsSync(FIXTURE_EPISODE_PATH)) {
      unlinkSync(FIXTURE_EPISODE_PATH);
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  console.log('');
  if (failures === 0) {
    if (selfCheck) {
      console.log(`${GREEN}Self-check PASSED${RESET} — felt: ordering guard is confirmed active (removing it breaks the test).`);
    } else {
      console.log(`${GREEN}PASSED${RESET} — capture-status ordering check fires correctly for felt: and thinking: channels.`);
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
