/**
 * test-capture-status-db-only.ts
 *
 * CI check: confirms that the DB ordering check fires correctly when NO rolling
 * episode is open — i.e. when the output anchor is advanced by
 * markReplitOutputFromChatCapture() (chat-capture path) rather than by
 * writeCaptureStatus() (episode-append path).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Each round calls markReplitOutputFromChatCapture() directly (the exported
 * production function) rather than manually injecting its internal state.
 * This means a regression that silences or removes that function's advance step
 * (prevReplitOutputMs / feltAtLastReplitOutput / thinkingAtLastReplitOutput)
 * is caught by the normal CI rounds.
 *
 * Setup per round:
 *   1. setLastReplitOutputForTest(T)     — prior output timestamp (becomes prevReplitOutputMs
 *                                          when markReplitOutputFromChatCapture advances)
 *   2. setLastFeltProcessedForTest(...)  — inner-life channel timestamps (snapshotted into
 *      setLastThinkingProcessedForTest(...)   feltAtLastReplitOutput / thinkingAtLastReplitOutput
 *                                          inside markReplitOutputFromChatCapture)
 *   3. markReplitOutputFromChatCapture() — the production function under test; writes
 *                                          the status file (no-episode path) via
 *                                          writeCaptureStatusStaleCheck → _writeCaptureStatusFile(null,0)
 *   4. readStatus()                      — inspect the written file
 *
 * Ordering model (anticipatory inner-life):
 *
 *   snapshot > prevReplitOutputMs   → fired AFTER prior output (reactive)  → ⚠️ OUT OF ORDER
 *   snapshot === 0                  → never fired this server run           → ⚠️ MISSING
 *   0 < snapshot ≤ prevReplitOutputMs → fired before prior output (✓)      → ✓
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode rounds
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Round E  — static structure + no-prior-output wait message
 *   Round A  — felt fires AFTER prior output (reactive → OUT OF ORDER), no episode
 *   Round B  — thinking fires AFTER prior output (reactive → OUT OF ORDER), no episode
 *   Round C  — both fire BEFORE prior output (anticipatory → ✓), no episode
 *   Round D  — both never fired this server run (→ MISSING), no episode
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Confirms the test catches a no-op markReplitOutputFromChatCapture():
 *
 *   1. setChatCaptureAdvanceEnabledForTest(false) — cursor-advance block is
 *      skipped; prevReplitOutputMs stays at 0, feltAtLastReplitOutput stays 0.
 *      The status file is still refreshed so it can be read.
 *   2. With prevReplitOutputMs=0 the ordering section shows the wait message —
 *      OOO warning cannot appear.
 *   3. Assert OOO absent → proves the test WOULD fail if the advance were removed.
 *   4. Re-enable advance, call markReplitOutputFromChatCapture() again.
 *   5. Assert OOO IS present → proves the advance step is the decisive gate.
 *
 * Run:
 *   npx tsx server/scripts/test-capture-status-db-only.ts
 *   npx tsx server/scripts/test-capture-status-db-only.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import {
  markReplitOutputFromChatCapture,
  setChatCaptureAdvanceEnabledForTest,
  setLastReplitOutputForTest,
  setLastFeltProcessedForTest,
  setLastThinkingProcessedForTest,
  // Reset the snapshot vars (feltAtLastReplitOutput etc.) to known-zero
  setFeltAtLastReplitOutputForTest,
  setThinkingAtLastReplitOutputForTest,
  setPrevReplitOutputForTest,
  setLastEpisodeCaptureForTest,
  setOrderingCheckEnabledForTest,
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
// Header — present when no rolling episode is active.
const NO_EPISODE_NEEDLE    = '**No rolling episode**';
const NO_EPISODE_DB_NOTE   = 'DB channels active, no .md target';
// Shown when prevReplitOutputMs === 0 (first output this server run).
const ORDERING_WAIT_NEEDLE = 'ordering check available after the second Replit output';
// DB ordering section — always present.
const DB_ORDERING_NEEDLE   = '## DB channels — ordering check';
// Episode .md section — must be ABSENT when no episode is active.
const MD_SECTION_NEEDLE    = '## Episode .md — all four channels';
// Channel-specific OOO needles (icon+label prefix avoids footer false-positives).
const FELT_OOO_NEEDLE      = '⚠️ OUT OF ORDER  Felt:';
const THINKING_OOO_NEEDLE  = '⚠️ OUT OF ORDER  Thinking:';
const FELT_OK_NEEDLE       = '✓  Felt:';
const THINKING_OK_NEEDLE   = '✓  Thinking:';
const FELT_MISS_NEEDLE     = '⚠️ MISSING  Felt:';
const THINKING_MISS_NEEDLE = '⚠️ MISSING  Thinking:';

// ── Helpers ───────────────────────────────────────────────────────────────────
function readStatus(): string {
  return existsSync(CAPTURE_STATUS_PATH)
    ? readFileSync(CAPTURE_STATUS_PATH, 'utf-8')
    : '';
}

/**
 * Reset all ordering-related module state to known-zero before each round.
 * Zeroes both the snapshot vars (set by markReplitOutputFromChatCapture)
 * and the input vars (read by it) so rounds don't bleed into each other.
 */
function resetState(): void {
  // Snapshot vars — what markReplitOutputFromChatCapture produces
  setFeltAtLastReplitOutputForTest(0);
  setThinkingAtLastReplitOutputForTest(0);
  setPrevReplitOutputForTest(0);
  // Input vars — what markReplitOutputFromChatCapture reads
  setLastReplitOutputForTest(0);
  setLastFeltProcessedForTest(0);
  setLastThinkingProcessedForTest(0);
  setLastEpisodeCaptureForTest(0);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const selfCheck = process.argv.includes('--self-check');

async function main(): Promise<void> {
  let failures = 0;

  // Snapshot + restore the live capture status file
  const statusExistedBefore = existsSync(CAPTURE_STATUS_PATH);
  const statusSnapBefore    = statusExistedBefore ? readFileSync(CAPTURE_STATUS_PATH) : null;

  try {
    if (selfCheck) {
      console.log(`\n${YELLOW}Self-check mode${RESET}: confirming the test catches a no-op markReplitOutputFromChatCapture().\n`);
    } else {
      console.log('\nRunning capture-status DB-only ordering CI check (no episode path)...\n');
    }

    // ── Synthetic timeline ─────────────────────────────────────────────────────
    // T            = prior Replit output (set via setLastReplitOutputForTest;
    //                markReplitOutputFromChatCapture copies it to prevReplitOutputMs)
    // T + 30 000   = channel fired AFTER prior output → OUT OF ORDER ⚠️
    // T - 30 000   = channel fired BEFORE prior output → ✓ (anticipatory)
    // 0            = channel never fired this server run → MISSING ⚠️
    const T      = 1_000_000;
    const AFTER  = T + 30_000;  // snapshot > prevReplitOutputMs → OUT OF ORDER
    const BEFORE = T - 30_000;  // snapshot ≤ prevReplitOutputMs AND > 0 → ✓

    if (selfCheck) {
      // ── Step 1: advance disabled (no-op simulation) ───────────────────────
      // With the advance step skipped, prevReplitOutputMs never gets set from T
      // (it stays at 0 since resetState() cleared it).  The ordering section
      // therefore shows the wait message rather than an OOO warning.
      sep();
      info('Self-check step 1: advance disabled (no-op) — OOO must be absent');
      resetState();
      setChatCaptureAdvanceEnabledForTest(false);
      setLastReplitOutputForTest(T);
      setLastFeltProcessedForTest(AFTER);         // would be OUT OF ORDER if advance ran
      setLastThinkingProcessedForTest(BEFORE);

      markReplitOutputFromChatCapture();          // advance skipped → prevReplitOutputMs stays 0
      const statusNoOp = readStatus();

      if (!statusNoOp.includes(FELT_OOO_NEEDLE)) {
        pass('Self-check step 1: OOO absent when advance is disabled (no-op confirmed)');
      } else {
        fail('Self-check step 1: OOO appeared even with advance disabled — ordering logic may not require prevReplitOutputMs>0');
        failures++;
      }

      if (statusNoOp.includes(NO_EPISODE_NEEDLE)) {
        pass('Self-check step 1: "No rolling episode" header present in no-op run');
      } else {
        fail('Self-check step 1: "No rolling episode" missing from no-op run');
        failures++;
      }

      // ── Step 2: advance re-enabled (working path) ─────────────────────────
      // prevReplitOutputMs is still 0 from step 1 (no-op didn't advance it).
      // lastReplitOutputMs is still T (set above, advance was disabled).
      // Re-enable and call again — now the advance runs:
      //   prevReplitOutputMs      ← lastReplitOutputMs (=T)
      //   feltAtLastReplitOutput  ← lastFeltProcessedMs (=AFTER)
      //   lastReplitOutputMs      ← Date.now()
      // Result: AFTER > T → OOO fires.
      sep();
      info('Self-check step 2: advance re-enabled (working path) — OOO must be present');
      setChatCaptureAdvanceEnabledForTest(true);

      markReplitOutputFromChatCapture();
      const statusWorking = readStatus();

      if (statusWorking.includes(FELT_OOO_NEEDLE)) {
        pass('Self-check step 2: OOO present when advance is enabled — advance step is the active gate ✓');
      } else {
        fail('Self-check step 2: OOO absent even when advance is enabled — ordering check may be broken');
        info('Status file content:\n' + statusWorking.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      if (statusWorking.includes(NO_EPISODE_NEEDLE)) {
        pass('Self-check step 2: "No rolling episode" header present in working-path run');
      } else {
        fail('Self-check step 2: "No rolling episode" missing from working-path run');
        failures++;
      }

    } else {
      // ── Normal mode ────────────────────────────────────────────────────────

      // ── Round E: static structure + no-prior-output wait message ─────────
      sep();
      info('Round E — static structure: "No rolling episode" present, DB ordering section, no .md section');
      info('  Sub-round E1: no prior output yet (lastReplitOutputMs=0) — wait message expected');
      resetState();
      // Both input and snapshot vars are 0 — first call of the server run.
      setLastFeltProcessedForTest(BEFORE);
      setLastThinkingProcessedForTest(BEFORE);

      markReplitOutputFromChatCapture();   // prevReplitOutputMs ← 0 (still 0)
      const statusE1 = readStatus();

      if (statusE1.includes(NO_EPISODE_NEEDLE)) {
        pass('Round E1: "No rolling episode" present in header');
      } else {
        fail('Round E1: "No rolling episode" missing from header');
        info('Status file:\n' + statusE1.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      if (statusE1.includes(NO_EPISODE_DB_NOTE)) {
        pass('Round E1: DB-active note present in header');
      } else {
        fail('Round E1: DB-active note missing from header');
        failures++;
      }

      if (statusE1.includes(DB_ORDERING_NEEDLE)) {
        pass('Round E1: DB ordering section present');
      } else {
        fail('Round E1: DB ordering section missing — always-on check may not be running');
        failures++;
      }

      if (statusE1.includes(ORDERING_WAIT_NEEDLE)) {
        pass('Round E1: wait message shown when no prior output yet');
      } else {
        fail('Round E1: wait message missing when prevReplitOutputMs=0');
        failures++;
      }

      if (!statusE1.includes(MD_SECTION_NEEDLE)) {
        pass('Round E1: Episode .md section absent (no episode active)');
      } else {
        fail('Round E1: Episode .md section present — should not appear when no episode is open');
        failures++;
      }

      info('  Sub-round E2: with prior output set — wait message gone, DB ordering fires');
      // Call again so prevReplitOutputMs gets a real value from the first call.
      setLastFeltProcessedForTest(BEFORE);
      setLastThinkingProcessedForTest(BEFORE);
      markReplitOutputFromChatCapture();
      const statusE2 = readStatus();

      if (!statusE2.includes(ORDERING_WAIT_NEEDLE)) {
        pass('Round E2: wait message gone after second output (ordering check active)');
      } else {
        fail('Round E2: wait message still shown even after second output');
        failures++;
      }

      if (!statusE2.includes(MD_SECTION_NEEDLE)) {
        pass('Round E2: Episode .md section absent (no episode active)');
      } else {
        fail('Round E2: Episode .md section present — should not appear when no episode is open');
        failures++;
      }

      // ── Round A: felt=AFTER (reactive → OOO), thinking=BEFORE (✓) ────────
      sep();
      info('Round A — felt fires AFTER prior output (OUT OF ORDER), no episode');
      resetState();
      setLastReplitOutputForTest(T);          // prior output → becomes prevReplitOutputMs
      setLastFeltProcessedForTest(AFTER);     // felt fired after T → OUT OF ORDER
      setLastThinkingProcessedForTest(BEFORE);// thinking fired before T → ✓

      markReplitOutputFromChatCapture();      // snapshots then advances
      const statusA = readStatus();

      if (statusA.includes(FELT_OOO_NEEDLE)) {
        pass('Round A: ⚠️ OUT OF ORDER detected for felt (fired after prior output)');
      } else {
        fail('Round A: OUT OF ORDER NOT detected for felt — DB-path ordering guard may be broken');
        info('Status file content:\n' + statusA.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      if (!statusA.includes(THINKING_OOO_NEEDLE)) {
        pass('Round A: no spurious OUT OF ORDER for thinking (fired before prior output)');
      } else {
        fail('Round A: thinking falsely flagged OUT OF ORDER even though it fired before prior output');
        failures++;
      }

      if (!statusA.includes(MD_SECTION_NEEDLE)) {
        pass('Round A: Episode .md section absent (no episode active)');
      } else {
        fail('Round A: Episode .md section present — should not appear when no episode is open');
        failures++;
      }

      // ── Round B: thinking=AFTER (reactive → OOO), felt=BEFORE (✓) ────────
      sep();
      info('Round B — thinking fires AFTER prior output (OUT OF ORDER), no episode');
      resetState();
      setLastReplitOutputForTest(T);
      setLastFeltProcessedForTest(BEFORE);    // felt before T → ✓
      setLastThinkingProcessedForTest(AFTER); // thinking after T → OUT OF ORDER

      markReplitOutputFromChatCapture();
      const statusB = readStatus();

      if (statusB.includes(THINKING_OOO_NEEDLE)) {
        pass('Round B: ⚠️ OUT OF ORDER detected for thinking (fired after prior output)');
      } else {
        fail('Round B: OUT OF ORDER NOT detected for thinking — DB-path ordering guard may be broken');
        info('Status file content:\n' + statusB.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      if (!statusB.includes(FELT_OOO_NEEDLE)) {
        pass('Round B: no spurious OUT OF ORDER for felt (fired before prior output)');
      } else {
        fail('Round B: felt falsely flagged OUT OF ORDER even though it fired before prior output');
        failures++;
      }

      // ── Round C: both anticipatory (→ ✓) ─────────────────────────────────
      sep();
      info('Round C — both channels fire BEFORE prior output (anticipatory → ✓)');
      resetState();
      setLastReplitOutputForTest(T);
      setLastFeltProcessedForTest(BEFORE);    // both before T → ✓
      setLastThinkingProcessedForTest(BEFORE);

      markReplitOutputFromChatCapture();
      const statusC = readStatus();

      if (statusC.includes(FELT_OK_NEEDLE)) {
        pass('Round C: ✓ for felt (fired before prior output — anticipatory)');
      } else {
        fail('Round C: felt before prior output did NOT show ✓');
        info(`Felt line: ${statusC.split('\n').find(l => l.includes('⚠️') && l.includes('Felt:') || l.includes('✓') && l.includes('Felt:')) ?? statusC.split('\n').find(l => l.includes('Felt:')) ?? '(not found)'}`);
        failures++;
      }

      if (statusC.includes(THINKING_OK_NEEDLE)) {
        pass('Round C: ✓ for thinking (fired before prior output — anticipatory)');
      } else {
        fail('Round C: thinking before prior output did NOT show ✓');
        info(`Thinking line: ${statusC.split('\n').find(l => l.includes('⚠️') && l.includes('Thinking:') || l.includes('✓') && l.includes('Thinking:')) ?? statusC.split('\n').find(l => l.includes('Thinking:')) ?? '(not found)'}`);
        failures++;
      }

      if (!statusC.includes(FELT_OOO_NEEDLE) && !statusC.includes(THINKING_OOO_NEEDLE)) {
        pass('Round C: no spurious OUT OF ORDER for either channel');
      } else {
        fail('Round C: spurious OUT OF ORDER for anticipatory channel(s)');
        failures++;
      }

      // ── Round D: both MISSING (never fired this server run) ───────────────
      sep();
      info('Round D — both channels never fired this server run (→ ⚠️ MISSING)');
      resetState();
      setLastReplitOutputForTest(T);
      setLastFeltProcessedForTest(0);         // never fired → MISSING
      setLastThinkingProcessedForTest(0);

      markReplitOutputFromChatCapture();
      const statusD = readStatus();

      if (statusD.includes(FELT_MISS_NEEDLE)) {
        pass('Round D: ⚠️ MISSING for felt (never fired this server run)');
      } else {
        fail('Round D: MISSING not shown for never-fired felt');
        info(`Felt line: ${statusD.split('\n').find(l => l.includes('Felt:')) ?? '(not found)'}`);
        failures++;
      }

      if (statusD.includes(THINKING_MISS_NEEDLE)) {
        pass('Round D: ⚠️ MISSING for thinking (never fired this server run)');
      } else {
        fail('Round D: MISSING not shown for never-fired thinking');
        info(`Thinking line: ${statusD.split('\n').find(l => l.includes('Thinking:')) ?? '(not found)'}`);
        failures++;
      }

      if (!statusD.includes(FELT_OOO_NEEDLE) && !statusD.includes(THINKING_OOO_NEEDLE)) {
        pass('Round D: no spurious OUT OF ORDER for never-fired channels');
      } else {
        fail('Round D: never-fired channel wrongly flagged OUT OF ORDER instead of MISSING');
        failures++;
      }
    }

  } finally {
    // Restore production state
    setChatCaptureAdvanceEnabledForTest(true);
    setOrderingCheckEnabledForTest(true);
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
      console.log(`${GREEN}Self-check PASSED${RESET} — markReplitOutputFromChatCapture() advance step is confirmed as the active gate (disabling it suppresses OOO; re-enabling restores it).`);
    } else {
      console.log(`${GREEN}PASSED${RESET} — DB ordering check fires correctly when no episode is open (chat-capture path).`);
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
