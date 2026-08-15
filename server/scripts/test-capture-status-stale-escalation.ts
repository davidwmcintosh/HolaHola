/**
 * test-capture-status-stale-escalation.ts
 *
 * CI check: confirms that _writeCaptureStatusFile() escalates a channel from
 * "— not yet" to "⚠️ STALE" when felt: or thinking: has not been written for
 * more than 60 minutes, regardless of whether the server was seeded from a
 * prior session.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The stale-escalation logic lives in _writeCaptureStatusFile() in
 * server/services/agent-session-autosave.ts (Section 2: DB readiness).
 *
 * A channel is STALE when ALL of the following hold:
 *   1. !feltReady   (lastFeltProcessedMs ≤ lastReplitOutputMs — channel has not
 *                    fired since the last Replit output)
 *   2. lastFeltProcessedMs > 0   (channel HAS fired at some point this run)
 *   3. (now - lastFeltProcessedMs) >= STALE_CHANNEL_MS  (≥ 60 min since last write)
 *
 * The test seam setStaleChannelCheckEnabledForTest(false) makes feltStale and
 * thinkingStale unconditionally false — modelling the regression where the
 * 60-min threshold is removed and channels silently revert to "— not yet".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Synthetic timeline
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   STALE_TS    = Date.now() - 61 min   (just over the 60-min threshold)
 *   RECENT_TS   = Date.now() - 59 min   (just under the threshold — "not yet")
 *   READY_TS    = Date.now() + 1 000    (after lastReplitOutputMs — "ready")
 *   OUTPUT_TS   = Date.now()            (lastReplitOutputMs — most recent output)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode rounds
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Round A — felt is stale (61 min, not ready):
 *     lastFeltProcessedMs  = STALE_TS   → !ready + ≥60min → ⚠️ STALE
 *     lastThinkingProcessedMs = 0       → never fired → "— not yet" (not stale)
 *     Asserts: "⚠️ STALE Felt:" present
 *     Asserts: "⚠️ STALE Thinking:" absent
 *
 *   Round B — thinking is stale (61 min, not ready):
 *     lastThinkingProcessedMs = STALE_TS → !ready + ≥60min → ⚠️ STALE
 *     lastFeltProcessedMs  = 0           → never fired → "— not yet"
 *     Asserts: "⚠️ STALE Thinking:" present
 *     Asserts: "⚠️ STALE Felt:" absent
 *
 *   Round C — both stale (61 min, neither ready):
 *     Asserts: "⚠️ STALE Felt:" present
 *     Asserts: "⚠️ STALE Thinking:" present
 *
 *   Round D — felt recent (59 min, not ready) — below threshold → "— not yet":
 *     lastFeltProcessedMs = RECENT_TS   → !ready + <60min → "— not yet"
 *     Asserts: "⚠️ STALE Felt:" absent (below threshold — soft label only)
 *
 *   Round G — felt exactly 60 min old (>= boundary):
 *     lastFeltProcessedMs = EXACT_TS    → !ready + =60min → ⚠️ STALE (>= fires)
 *     Asserts: "⚠️ STALE Felt:" present (exact boundary must fire)
 *
 *   Round E — felt ready (fired after last output) — not stale at all:
 *     lastFeltProcessedMs = READY_TS    → ready → "✓ ready"
 *     Asserts: "⚠️ STALE Felt:" absent
 *     Asserts: "✓ ready Felt:" present
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the ⚠️ STALE escalation is the active gate — removing it silences
 *   the warning and reverts channels to "— not yet".
 *
 *   1. Calls setStaleChannelCheckEnabledForTest(false) — suppresses escalation
 *      (models removing the 60-min threshold).
 *   2. Runs the stale scenario (felt=STALE_TS, not ready).
 *   3. Asserts "⚠️ STALE Felt:" is ABSENT (escalation gone, shows "— not yet").
 *   4. Temporarily re-enables the check, re-runs.
 *   5. Asserts "⚠️ STALE Felt:" IS present — proving the gate is active.
 *
 * Run:
 *   npx tsx server/scripts/test-capture-status-stale-escalation.ts
 *   npx tsx server/scripts/test-capture-status-stale-escalation.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import {
  writeEpisodeCaptureStatusFileForTest,
  setLastReplitOutputForTest,
  setLastFeltProcessedForTest,
  setLastThinkingProcessedForTest,
  setFeltAtLastReplitOutputForTest,
  setThinkingAtLastReplitOutputForTest,
  setPrevReplitOutputForTest,
  setLastEpisodeCaptureForTest,
  setStaleChannelCheckEnabledForTest,
  setNowOverrideForTest,
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
const WORKSPACE                = process.cwd();
const CAPTURE_STATUS_PATH      = join(WORKSPACE, '.local/episode-capture-status.md');
const STALE_CHANNEL_ALERT_PATH = join(WORKSPACE, '.local/stale-channel-alert.md');

// Synthetic episode filename — does not need to exist on disk.
const FIXTURE_EPISODE = 'episode-ci-stale-escalation-fixture.md';

// ── Needles ───────────────────────────────────────────────────────────────────
// The readiness lines in Section 2 are formatted as:
//   "  ⚠️ STALE Felt:      hh:mm:ss (61 min ago) ← write .luca_reflection …"
//   "  — not yet Felt:      …"
//   "  ✓ ready Felt:      …"
// We match the icon+label prefix to avoid hitting other parts of the file.
const FELT_STALE_NEEDLE      = '⚠️ STALE Felt:';
const THINKING_STALE_NEEDLE  = '⚠️ STALE Thinking:';
const FELT_READY_NEEDLE      = '✓ ready Felt:';
const FELT_NOT_YET_NEEDLE    = '— not yet Felt:';

// ── Helpers ───────────────────────────────────────────────────────────────────
function readStatus(): string {
  return existsSync(CAPTURE_STATUS_PATH)
    ? readFileSync(CAPTURE_STATUS_PATH, 'utf-8')
    : '';
}

/**
 * Reset ALL ordering and readiness state to known-zero before each round.
 * This prevents state bleed between rounds (module vars are persistent within
 * a single Node process run).
 */
function resetState(): void {
  // Snapshot vars (produced by markReplitOutputFromChatCapture / writeCaptureStatus)
  setFeltAtLastReplitOutputForTest(0);
  setThinkingAtLastReplitOutputForTest(0);
  setPrevReplitOutputForTest(0);
  // Input vars (read by _writeCaptureStatusFile)
  setLastReplitOutputForTest(0);
  setLastFeltProcessedForTest(0);
  setLastThinkingProcessedForTest(0);
  setLastEpisodeCaptureForTest(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const selfCheck = process.argv.includes('--self-check');

async function main(): Promise<void> {
  let failures = 0;

  // ── Snapshot + restore the live status and alert files ───────────────────
  const statusExistedBefore = existsSync(CAPTURE_STATUS_PATH);
  const statusSnapBefore    = statusExistedBefore ? readFileSync(CAPTURE_STATUS_PATH) : null;
  const alertExistedBefore  = existsSync(STALE_CHANNEL_ALERT_PATH);
  const alertSnapBefore     = alertExistedBefore ? readFileSync(STALE_CHANNEL_ALERT_PATH) : null;

  try {
    if (selfCheck) {
      console.log(`\n${YELLOW}Self-check mode${RESET}: confirming the ⚠️ STALE escalation is the active gate.\n`);
    } else {
      console.log('\nRunning capture-status stale-escalation CI check...\n');
    }

    // ── Synthetic timestamps ──────────────────────────────────────────────────
    // All computed from Date.now() so the comparison inside _writeCaptureStatusFile
    // (which also calls Date.now()) produces a stable result.
    const now       = Date.now();
    const MIN       = 60 * 1000;
    // Just over 60 min — triggers ⚠️ STALE
    const STALE_TS  = now - 61 * MIN;
    // Exactly 60 min — triggers ⚠️ STALE (>= boundary)
    const EXACT_TS  = now - 60 * MIN;
    // Just under 60 min — below threshold, stays "— not yet"
    const RECENT_TS = now - 59 * MIN;
    // After the most recent output — channel is ready
    const OUTPUT_TS = now;
    // Fired after last output → ready
    const READY_TS  = now + 1_000;

    if (selfCheck) {
      // ── Self-check: stale escalation is the active gate ───────────────────
      // Disable escalation — models the 60-min threshold being removed.
      // With it disabled, a stale felt channel must NOT show ⚠️ STALE.
      sep();
      info('Self-check step 1: escalation disabled (no-op) — ⚠️ STALE must be absent');
      setStaleChannelCheckEnabledForTest(false);
      resetState();

      // Stale felt: fired 61 min ago, not ready (< lastReplitOutputMs)
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(STALE_TS);        // 61 min ago → stale if enabled (>60-min threshold)
      setLastThinkingProcessedForTest(0);           // never fired

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusDisabled = readStatus();

      if (!statusDisabled.includes(FELT_STALE_NEEDLE)) {
        pass('Self-check step 1: ⚠️ STALE Felt: absent when escalation is disabled ✓');
      } else {
        fail('Self-check step 1: ⚠️ STALE Felt: appeared even with escalation disabled — guard may be unconditional');
        failures++;
      }

      // Confirm "— not yet" is shown instead (soft label)
      if (statusDisabled.includes(FELT_NOT_YET_NEEDLE)) {
        pass('Self-check step 1: "— not yet Felt:" shown (soft label when escalation disabled) ✓');
      } else {
        fail('Self-check step 1: expected "— not yet Felt:" but it is missing');
        info('Status file content:\n' + statusDisabled.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Step 2: re-enable — ⚠️ STALE must now appear ─────────────────────
      sep();
      info('Self-check step 2: escalation re-enabled — ⚠️ STALE must be present');
      setStaleChannelCheckEnabledForTest(true);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusEnabled = readStatus();

      if (statusEnabled.includes(FELT_STALE_NEEDLE)) {
        pass('Self-check step 2: ⚠️ STALE Felt: present when escalation is enabled — gate is confirmed active ✓');
      } else {
        fail('Self-check step 2: ⚠️ STALE Felt: absent even with escalation enabled — logic may be broken');
        info('Status file content:\n' + statusEnabled.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

    } else {
      // ── Normal mode ────────────────────────────────────────────────────────

      // ── Round A: felt stale (61 min, not ready) ───────────────────────────
      sep();
      info('Round A — felt is stale (61 min, not ready) → ⚠️ STALE Felt: expected');
      resetState();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(STALE_TS);    // 61 min ago → stale
      setLastThinkingProcessedForTest(0);       // never fired → "— not yet"

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusA = readStatus();

      if (statusA.includes(FELT_STALE_NEEDLE)) {
        pass('Round A: ⚠️ STALE Felt: present (felt unwritten for 61 min)');
      } else {
        fail('Round A: ⚠️ STALE Felt: absent — stale escalation may be broken');
        info('Status file content:\n' + statusA.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      if (!statusA.includes(THINKING_STALE_NEEDLE)) {
        pass('Round A: ⚠️ STALE Thinking: absent (thinking never fired — not stale, just "— not yet")');
      } else {
        fail('Round A: ⚠️ STALE Thinking: appeared even though thinking has never fired (should be "— not yet")');
        failures++;
      }

      // ── Round B: thinking stale (61 min, not ready) ───────────────────────
      sep();
      info('Round B — thinking is stale (61 min, not ready) → ⚠️ STALE Thinking: expected');
      resetState();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(0);           // never fired → "— not yet"
      setLastThinkingProcessedForTest(STALE_TS);// 61 min ago → stale

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusB = readStatus();

      if (statusB.includes(THINKING_STALE_NEEDLE)) {
        pass('Round B: ⚠️ STALE Thinking: present (thinking unwritten for 61 min)');
      } else {
        fail('Round B: ⚠️ STALE Thinking: absent — stale escalation for thinking may be broken');
        info('Status file content:\n' + statusB.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      if (!statusB.includes(FELT_STALE_NEEDLE)) {
        pass('Round B: ⚠️ STALE Felt: absent (felt never fired — not stale, just "— not yet")');
      } else {
        fail('Round B: ⚠️ STALE Felt: appeared even though felt has never fired');
        failures++;
      }

      // ── Round C: both channels stale ──────────────────────────────────────
      sep();
      info('Round C — both channels stale (61 min each) → both ⚠️ STALE expected + alert file written');
      resetState();
      // Ensure no alert file lingers from a prior run.
      if (existsSync(STALE_CHANNEL_ALERT_PATH)) unlinkSync(STALE_CHANNEL_ALERT_PATH);
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(STALE_TS);
      setLastThinkingProcessedForTest(STALE_TS);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusC = readStatus();

      if (statusC.includes(FELT_STALE_NEEDLE)) {
        pass('Round C: ⚠️ STALE Felt: present');
      } else {
        fail('Round C: ⚠️ STALE Felt: absent — both-channel stale path may be broken');
        info('Felt line: ' + (statusC.split('\n').find(l => l.includes('Felt:')) ?? '(not found)'));
        failures++;
      }

      if (statusC.includes(THINKING_STALE_NEEDLE)) {
        pass('Round C: ⚠️ STALE Thinking: present');
      } else {
        fail('Round C: ⚠️ STALE Thinking: absent — both-channel stale path may be broken');
        info('Thinking line: ' + (statusC.split('\n').find(l => l.includes('Thinking:')) ?? '(not found)'));
        failures++;
      }

      // ── Alert file must be written when either channel is stale ───────────
      if (existsSync(STALE_CHANNEL_ALERT_PATH)) {
        const alertC = readFileSync(STALE_CHANNEL_ALERT_PATH, 'utf-8');
        if (alertC.includes('60+ min')) {
          pass('Round C: stale-channel-alert.md written and contains "60+ min"');
        } else {
          fail('Round C: stale-channel-alert.md written but missing "60+ min" threshold label');
          info('Alert content (first 200 chars): ' + alertC.slice(0, 200));
          failures++;
        }
      } else {
        fail('Round C: stale-channel-alert.md NOT written — alert file creation is broken');
        failures++;
      }

      // ── Round D: felt recent (59 min) — below threshold → "— not yet" ─────
      sep();
      info('Round D — felt recent (59 min, not ready) → below threshold, must NOT show ⚠️ STALE');
      resetState();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(RECENT_TS);   // 59 min ago — below 60-min threshold
      setLastThinkingProcessedForTest(0);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusD = readStatus();

      if (!statusD.includes(FELT_STALE_NEEDLE)) {
        pass('Round D: ⚠️ STALE Felt: absent (59 min — below 60-min threshold, shows "— not yet")');
      } else {
        fail('Round D: ⚠️ STALE Felt: appeared for a channel only 59 min stale — threshold may be off');
        info('Felt line: ' + (statusD.split('\n').find(l => l.includes('Felt:')) ?? '(not found)'));
        failures++;
      }

      // ── Round E: felt ready (fired after last output) — not stale ─────────
      sep();
      info('Round E — felt ready (fired after last output) → "✓ ready", not stale');
      resetState();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(READY_TS);    // after OUTPUT_TS → feltReady = true
      setLastThinkingProcessedForTest(STALE_TS);// thinking stale (control channel)

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusE = readStatus();

      if (!statusE.includes(FELT_STALE_NEEDLE)) {
        pass('Round E: ⚠️ STALE Felt: absent (channel is ready — stale only applies when !ready)');
      } else {
        fail('Round E: ⚠️ STALE Felt: appeared even though felt is ready — stale guard must require !ready');
        info('Felt line: ' + (statusE.split('\n').find(l => l.includes('Felt:')) ?? '(not found)'));
        failures++;
      }

      if (statusE.includes(FELT_READY_NEEDLE)) {
        pass('Round E: "✓ ready Felt:" present (channel correctly marked ready)');
      } else {
        fail('Round E: "✓ ready Felt:" absent — ready channel not rendering correctly');
        info('Felt line: ' + (statusE.split('\n').find(l => l.includes('Felt:')) ?? '(not found)'));
        failures++;
      }

      // Confirm the thinking stale still fires (independent channel — control check)
      if (statusE.includes(THINKING_STALE_NEEDLE)) {
        pass('Round E: ⚠️ STALE Thinking: present (thinking channel independently stale) ✓');
      } else {
        fail('Round E: ⚠️ STALE Thinking: absent — stale thinking should still fire independently');
        failures++;
      }

      // Alert file must NOT be cleared while thinking is still stale
      if (existsSync(STALE_CHANNEL_ALERT_PATH)) {
        pass('Round E: stale-channel-alert.md still present (thinking still stale — premature clear would be wrong)');
      } else {
        fail('Round E: stale-channel-alert.md was cleared prematurely — thinking is still stale; file should remain');
        failures++;
      }

      // ── Round G: felt exactly 60 min old — >= boundary must fire ──────────
      //
      // Determinism guarantee: we inject a frozen "now" via setNowOverrideForTest()
      // so that _writeCaptureStatusFile() and this test code share EXACTLY the same
      // timestamp.  Without the freeze, even 1 ms of elapsed wall-clock time between
      // computing EXACT_TS and the internal Date.now() call would make the comparison
      // (now - EXACT_TS) > 60*MIN even with a ">" predicate, silently masking the bug.
      //
      // With the freeze:
      //   frozenNow - EXACT_TS  = frozenNow - (frozenNow - 60*MIN) = exactly 60*MIN
      //   ">= 60*MIN"  → true  (stale) ✓
      //   ">  60*MIN"  → false (not stale) — would fail this assertion ✓
      sep();
      info('Round G — felt exactly 60 min old, frozen clock → >= boundary fires → ⚠️ STALE Felt: expected');
      resetState();
      // Freeze the clock at `now` (same value used to compute EXACT_TS and OUTPUT_TS).
      setNowOverrideForTest(now);
      setLastReplitOutputForTest(OUTPUT_TS);   // = now (felt not ready: EXACT_TS < OUTPUT_TS)
      setLastFeltProcessedForTest(EXACT_TS);   // = now - 60*MIN (exactly at boundary)
      setLastThinkingProcessedForTest(0);      // never fired

      writeEpisodeCaptureStatusFileForTest(null, 0);
      setNowOverrideForTest(null); // restore immediately after write
      const statusG = readStatus();

      if (statusG.includes(FELT_STALE_NEEDLE)) {
        pass('Round G: ⚠️ STALE Felt: present at exactly 60 min with frozen clock (>= boundary confirmed deterministically)');
      } else {
        fail('Round G: ⚠️ STALE Felt: absent at exactly 60 min — >= boundary broken (> used instead, or clock injection failed)');
        info('Felt line: ' + (statusG.split('\n').find(l => l.includes('Felt:')) ?? '(not found)'));
        failures++;
      }

      // ── Round F: both channels ready → alert file must be cleared ─────────
      sep();
      info('Round F — both channels ready (both fired after last output) → alert file must be cleared');
      resetState();
      // Seed a stale alert file so we can confirm it gets removed.
      writeFileSync(STALE_CHANNEL_ALERT_PATH, '# ⚠️ Inner-Life Channel Alert\n\ntest sentinel', 'utf-8');
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(READY_TS);     // after OUTPUT_TS → feltReady = true
      setLastThinkingProcessedForTest(READY_TS); // after OUTPUT_TS → thinkingReady = true

      writeEpisodeCaptureStatusFileForTest(null, 0);

      if (!existsSync(STALE_CHANNEL_ALERT_PATH)) {
        pass('Round F: stale-channel-alert.md cleared when both channels are ready ✓');
      } else {
        fail('Round F: stale-channel-alert.md still present even though both channels are ready — clear logic is broken');
        failures++;
      }
    }

  } finally {
    // Restore the stale-escalation gate to production state
    setStaleChannelCheckEnabledForTest(true);
    // Reset all module state to zero so we don't pollute a live server
    resetState();
    // Restore the status file to its pre-test state
    if (statusSnapBefore !== null) {
      writeFileSync(CAPTURE_STATUS_PATH, statusSnapBefore);
    } else if (existsSync(CAPTURE_STATUS_PATH)) {
      unlinkSync(CAPTURE_STATUS_PATH);
    }
    // Restore the alert file to its pre-test state
    if (alertSnapBefore !== null) {
      writeFileSync(STALE_CHANNEL_ALERT_PATH, alertSnapBefore);
    } else if (existsSync(STALE_CHANNEL_ALERT_PATH)) {
      unlinkSync(STALE_CHANNEL_ALERT_PATH);
    }
    console.log('(Status file restored to pre-test state)');
  }

  // ── Result ────────────────────────────────────────────────────────────────
  sep();
  console.log('');
  if (failures === 0) {
    if (selfCheck) {
      console.log(`${GREEN}Self-check PASSED${RESET} — ⚠️ STALE escalation is confirmed as the active gate (disabling it suppresses the warning; re-enabling restores it).`);
    } else {
      console.log(`${GREEN}PASSED${RESET} — ⚠️ STALE escalation fires correctly after 60 min of channel silence, and stays silent when the channel is recent or ready.`);
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
