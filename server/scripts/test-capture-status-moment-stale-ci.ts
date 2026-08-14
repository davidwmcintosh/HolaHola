/**
 * test-capture-status-moment-stale-ci.ts
 *
 * CI check: confirms that _writeCaptureStatusFile() escalates the moment: channel
 * to ⚠️ when a moment timestamp is more than 2 hours in the past (STALE_MOMENT_MS).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The moment: stale logic lives at the `dbCurrentLines` array in
 * _writeCaptureStatusFile() in server/services/agent-session-autosave.ts:
 *
 *   `  ${lastMomentProcessedMs === 0
 *          ? '—'
 *          : (_momentStaleCheckEnabled && (now - lastMomentProcessedMs) > STALE_MOMENT_MS)
 *            ? '⚠️'
 *            : '✓'} Moment:  ...`
 *
 * A moment is STALE when ALL of the following hold:
 *   1. lastMomentProcessedMs !== 0    (moment has fired at least once this run)
 *   2. (now - lastMomentProcessedMs) > STALE_MOMENT_MS   (> 2h since last write)
 *   3. _momentStaleCheckEnabled === true                  (the gate is active)
 *
 * Unlike felt: and thinking:, the moment: channel is NOT compared against
 * lastReplitOutputMs — it warns purely on absolute elapsed time.
 *
 * The test seam setMomentStaleCheckEnabledForTest(false) makes the threshold
 * a no-op — modelling the regression where STALE_MOMENT_MS is removed and the
 * channel reverts to "✓" even when the moment is >2h old.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Synthetic timeline
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   STALE_TS   = Date.now() - 121 min  (just over the 2h threshold)
 *   RECENT_TS  = Date.now() - 119 min  (just under the 2h threshold)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode rounds
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Round A — moment is stale (>2h old):
 *     lastMomentProcessedMs = STALE_TS  (121 min ago)
 *     Asserts: "⚠️ Moment:" present
 *
 *   Round B — moment is recent (<2h old):
 *     lastMomentProcessedMs = RECENT_TS (119 min ago)
 *     Asserts: "⚠️ Moment:" absent
 *     Asserts: "✓ Moment:" present
 *
 *   Round C — moment has never fired:
 *     lastMomentProcessedMs = 0
 *     Asserts: "⚠️ Moment:" absent
 *     Asserts: "— Moment:" present  (never-written indicator)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *   Proves the ⚠️ escalation is the active gate — removing it silences the
 *   warning and the channel reverts to "✓".
 *
 *   1. setMomentStaleCheckEnabledForTest(false) — suppresses escalation.
 *   2. Runs the stale scenario (moment = 121 min ago).
 *   3. Asserts "⚠️ Moment:" is ABSENT (shows "✓" instead).
 *   4. Re-enables the check, re-runs.
 *   5. Asserts "⚠️ Moment:" IS present — gate confirmed active.
 *
 * Run:
 *   npx tsx server/scripts/test-capture-status-moment-stale-ci.ts
 *   npx tsx server/scripts/test-capture-status-moment-stale-ci.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import {
  writeEpisodeCaptureStatusFileForTest,
  setLastReplitOutputForTest,
  setLastFeltProcessedForTest,
  setLastThinkingProcessedForTest,
  setLastMomentProcessedForTest,
  setFeltAtLastReplitOutputForTest,
  setThinkingAtLastReplitOutputForTest,
  setPrevReplitOutputForTest,
  setLastEpisodeCaptureForTest,
  setMomentStaleCheckEnabledForTest,
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
// The moment: line in Section 2 renders as:
//   "  ⚠️ Moment:    hh:mm:ss (121 min ago)"   ← stale (>2h)
//   "  ✓ Moment:    hh:mm:ss (119 min ago)"    ← recent (<2h)
//   "  — Moment:    never (—)"                 ← never fired
// We match the icon+label prefix.
const MOMENT_STALE_NEEDLE = '⚠️ Moment:';
const MOMENT_OK_NEEDLE    = '✓ Moment:';
const MOMENT_NEVER_NEEDLE = '— Moment:';

// ── Helpers ───────────────────────────────────────────────────────────────────
function readStatus(): string {
  return existsSync(CAPTURE_STATUS_PATH)
    ? readFileSync(CAPTURE_STATUS_PATH, 'utf-8')
    : '';
}

/**
 * Reset ALL ordering and readiness state to known-zero before each round.
 * Prevents state bleed between rounds (module vars are persistent within
 * a single Node process run).
 */
function resetState(): void {
  setFeltAtLastReplitOutputForTest(0);
  setThinkingAtLastReplitOutputForTest(0);
  setPrevReplitOutputForTest(0);
  setLastReplitOutputForTest(0);
  setLastFeltProcessedForTest(0);
  setLastThinkingProcessedForTest(0);
  setLastMomentProcessedForTest(0);
  setLastEpisodeCaptureForTest(0);
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
      console.log(`\n${YELLOW}Self-check mode${RESET}: confirming the moment: ⚠️ escalation is the active gate.\n`);
    } else {
      console.log('\nRunning capture-status moment: stale-escalation CI check...\n');
    }

    // ── Synthetic timestamps ──────────────────────────────────────────────────
    const now      = Date.now();
    const MIN      = 60 * 1000;
    // Just over 2h (120 min) — triggers ⚠️ on moment:
    const STALE_TS  = now - 121 * MIN;
    // Just under 2h (120 min) — below threshold, shows ✓
    const RECENT_TS = now - 119 * MIN;

    if (selfCheck) {
      // ── Self-check: moment stale escalation is the active gate ───────────
      // Disable escalation — models removing the 2h threshold.
      // With it disabled, a stale moment must NOT show ⚠️ Moment:.
      sep();
      info('Self-check step 1: escalation disabled (no-op) — ⚠️ Moment: must be absent');
      setMomentStaleCheckEnabledForTest(false);
      resetState();

      // Moment fired 121 min ago → stale if enabled
      setLastMomentProcessedForTest(STALE_TS);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusDisabled = readStatus();

      if (!statusDisabled.includes(MOMENT_STALE_NEEDLE)) {
        pass('Self-check step 1: ⚠️ Moment: absent when escalation is disabled ✓');
      } else {
        fail('Self-check step 1: ⚠️ Moment: appeared even with escalation disabled — guard may be unconditional');
        failures++;
      }

      // Confirm ✓ is shown instead (below-threshold fallback)
      if (statusDisabled.includes(MOMENT_OK_NEEDLE)) {
        pass('Self-check step 1: "✓ Moment:" shown (falls through to ok-state when escalation disabled) ✓');
      } else {
        fail('Self-check step 1: expected "✓ Moment:" but it is missing');
        info('Status file content:\n' + statusDisabled.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Step 2: re-enable — ⚠️ Moment: must now appear ──────────────────
      sep();
      info('Self-check step 2: escalation re-enabled — ⚠️ Moment: must be present');
      setMomentStaleCheckEnabledForTest(true);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusEnabled = readStatus();

      if (statusEnabled.includes(MOMENT_STALE_NEEDLE)) {
        pass('Self-check step 2: ⚠️ Moment: present when escalation is enabled — gate is confirmed active ✓');
      } else {
        fail('Self-check step 2: ⚠️ Moment: absent even with escalation enabled — logic may be broken');
        info('Status file content:\n' + statusEnabled.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

    } else {
      // ── Normal mode ────────────────────────────────────────────────────────

      // ── Round A: moment stale (121 min, >2h threshold) ───────────────────
      sep();
      info('Round A — moment is stale (121 min, >2h) → ⚠️ Moment: expected');
      resetState();
      setLastMomentProcessedForTest(STALE_TS);   // 121 min ago → stale

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusA = readStatus();

      if (statusA.includes(MOMENT_STALE_NEEDLE)) {
        pass('Round A: ⚠️ Moment: present (moment unwritten for 121 min)');
      } else {
        fail('Round A: ⚠️ Moment: absent — 2h stale escalation may be broken');
        info('Moment line: ' + (statusA.split('\n').find(l => l.includes('Moment:')) ?? '(not found)'));
        info('Status file content:\n' + statusA.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Round B: moment recent (119 min, <2h threshold) ──────────────────
      sep();
      info('Round B — moment is recent (119 min, <2h) → must NOT show ⚠️ Moment:');
      resetState();
      setLastMomentProcessedForTest(RECENT_TS);  // 119 min ago → below threshold

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusB = readStatus();

      if (!statusB.includes(MOMENT_STALE_NEEDLE)) {
        pass('Round B: ⚠️ Moment: absent (119 min — below 2h threshold, shows ✓)');
      } else {
        fail('Round B: ⚠️ Moment: appeared for a moment only 119 min old — threshold may be off');
        info('Moment line: ' + (statusB.split('\n').find(l => l.includes('Moment:')) ?? '(not found)'));
        failures++;
      }

      if (statusB.includes(MOMENT_OK_NEEDLE)) {
        pass('Round B: "✓ Moment:" present (recent moment correctly marked ok)');
      } else {
        fail('Round B: "✓ Moment:" absent — below-threshold moment not rendering correctly');
        info('Moment line: ' + (statusB.split('\n').find(l => l.includes('Moment:')) ?? '(not found)'));
        failures++;
      }

      // ── Round C: moment never fired ───────────────────────────────────────
      sep();
      info('Round C — moment has never fired (lastMomentProcessedMs === 0) → "— Moment:" expected');
      resetState();
      // lastMomentProcessedMs is 0 by default after resetState()

      writeEpisodeCaptureStatusFileForTest(null, 0);
      const statusC = readStatus();

      if (!statusC.includes(MOMENT_STALE_NEEDLE)) {
        pass('Round C: ⚠️ Moment: absent (moment has never fired — not stale, just "—")');
      } else {
        fail('Round C: ⚠️ Moment: appeared even though moment has never fired — condition may be missing the ms!==0 guard');
        failures++;
      }

      if (statusC.includes(MOMENT_NEVER_NEEDLE)) {
        pass('Round C: "— Moment:" present (never-fired indicator correctly shown)');
      } else {
        fail('Round C: "— Moment:" absent — never-fired state not rendering correctly');
        info('Moment line: ' + (statusC.split('\n').find(l => l.includes('Moment:')) ?? '(not found)'));
        failures++;
      }
    }

  } finally {
    // Restore the moment stale gate to production state
    setMomentStaleCheckEnabledForTest(true);
    // Reset all module state to zero so we don't pollute a live server
    resetState();
    // Restore the status file to its pre-test state
    if (statusSnapBefore !== null) {
      writeFileSync(CAPTURE_STATUS_PATH, statusSnapBefore);
    } else if (existsSync(CAPTURE_STATUS_PATH)) {
      unlinkSync(CAPTURE_STATUS_PATH);
    }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  sep();
  console.log('');
  if (failures === 0) {
    if (selfCheck) {
      console.log(`${GREEN}Self-check PASSED${RESET} — moment: ⚠️ escalation is confirmed as the active gate (disabling it suppresses the warning; re-enabling restores it).`);
    } else {
      console.log(`${GREEN}PASSED${RESET} — moment: ⚠️ escalation fires correctly after 2h of silence, and stays silent when the moment is recent or has never fired.`);
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
