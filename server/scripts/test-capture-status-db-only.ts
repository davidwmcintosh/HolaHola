/**
 * test-capture-status-db-only.ts
 *
 * CI check: confirms that _writeCaptureStatusFile(null, 0) — the code path
 * reached when NO rolling episode is active — correctly renders the DB ordering
 * section and suppresses the episode .md section entirely.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * What this tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Round 1 — no prior output yet (prevReplitOutputMs === 0):
 *     • Header: "No rolling episode — DB channels active, no .md target"
 *     • Ordering section: "ordering check available after the second Replit output"
 *     • NO "Episode .md" section in output
 *
 *   Round 2 — both channels correct (felt/thinking before prior output):
 *     • Ordering section shows ✓ for Felt and Thinking
 *     • NO "Episode .md" section in output
 *
 *   Round 3 — felt fires AFTER prior output (reactive → ⚠️ OUT OF ORDER):
 *     • Ordering section shows "⚠️ OUT OF ORDER  Felt:"
 *     • Thinking row still shows ✓ (was anticipatory)
 *     • NO "Episode .md" section in output
 *
 *   Round 4 — thinking never fired (→ ⚠️ MISSING):
 *     • Ordering section shows "⚠️ MISSING  Thinking:"
 *     • NO "Episode .md" section in output
 *
 * Self-check mode (--self-check):
 *   Proves the ordering check is the active gate by temporarily disabling it
 *   via setOrderingCheckEnabledForTest(false) and confirming ⚠️ OUT OF ORDER
 *   disappears for the felt-AFTER scenario, then re-enabling confirms it returns.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Run:
 *   npx tsx server/scripts/test-capture-status-db-only.ts
 *   npx tsx server/scripts/test-capture-status-db-only.ts --self-check
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

import {
  writeCaptureStatusDbOnlyForTest,
  setFeltAtLastExchangeForTest,
  setThinkingAtLastExchangeForTest,
  setPrevEpisodeCaptureForTest,
  setLastEpisodeCaptureForTest,
  setLastFeltProcessedForTest,
  setLastThinkingProcessedForTest,
  setLastReplitOutputForTest,
  setOrderingCheckEnabledForTest,
  resetCaptureStatusSeedStateForTest,
} from '../services/agent-session-autosave';

// ── Colour helpers ─────────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';
const SEP    = '─'.repeat(70);

function pass(msg: string): void { console.log(`${GREEN}  ✓ PASS${RESET}  ${msg}`); }
function fail(msg: string): void { console.error(`${RED}  ✗ FAIL${RESET}  ${msg}`); }
function info(msg: string): void { console.log(`${YELLOW}  ·${RESET}      ${msg}`); }
function sep():  void { console.log(`\n${SEP}`); }

// ── Paths ──────────────────────────────────────────────────────────────────────
const WORKSPACE           = process.cwd();
const CAPTURE_STATUS_PATH = join(WORKSPACE, '.local/episode-capture-status.md');

// ── Ordering needles ───────────────────────────────────────────────────────────
// The footer always contains the literal "OUT OF ORDER" explanatory text, so we
// match the icon+label prefix to distinguish a live firing from the footer note.
const FELT_OOO_NEEDLE      = '⚠️ OUT OF ORDER  Felt:';
const FELT_OK_NEEDLE       = '✓  Felt:';
const FELT_MISS_NEEDLE     = '⚠️ MISSING  Felt:';
const THINKING_OOO_NEEDLE  = '⚠️ OUT OF ORDER  Thinking:';
const THINKING_OK_NEEDLE   = '✓  Thinking:';
const THINKING_MISS_NEEDLE = '⚠️ MISSING  Thinking:';

const NO_EPISODE_HEADER    = 'No rolling episode';
const NO_EPISODE_DB_NOTE   = 'DB channels active, no .md target';
const ORDERING_WAIT_NEEDLE = 'ordering check available after the second Replit output';
const MD_SECTION_NEEDLE    = '## Episode .md';

// ── Helpers ────────────────────────────────────────────────────────────────────
function readStatus(): string {
  return existsSync(CAPTURE_STATUS_PATH)
    ? readFileSync(CAPTURE_STATUS_PATH, 'utf-8')
    : '';
}

/** Reset all ordering + seed state to known-zero values before each round. */
function resetAll(): void {
  resetCaptureStatusSeedStateForTest();
  setFeltAtLastExchangeForTest(0);
  setThinkingAtLastExchangeForTest(0);
  setPrevEpisodeCaptureForTest(0);
  setLastEpisodeCaptureForTest(0);
  setLastReplitOutputForTest(0);
  setLastFeltProcessedForTest(0);
  setLastThinkingProcessedForTest(0);
  setOrderingCheckEnabledForTest(true);
}

// ── Main ───────────────────────────────────────────────────────────────────────
const selfCheck = process.argv.includes('--self-check');

async function main(): Promise<void> {
  let failures = 0;

  // ── Snapshot + restore the live capture status file ──────────────────────────
  const statusExistedBefore = existsSync(CAPTURE_STATUS_PATH);
  const statusSnapBefore    = statusExistedBefore ? readFileSync(CAPTURE_STATUS_PATH) : null;

  try {
    if (selfCheck) {
      console.log(`\n${YELLOW}Self-check mode${RESET}: confirming the DB-ordering guard fires when no episode is open.\n`);
    } else {
      console.log('\nRunning capture-status DB-only CI check (no rolling episode path)...\n');
    }

    // Synthetic timestamps
    const T        = 1_000_000;             // prevReplitOutputMs anchor
    const EXCHANGE = T + 60_000;            // lastReplitOutputMs (current output)
    const AFTER    = T + 30_000;            // snapshot > T → OUT OF ORDER
    const BEFORE   = T - 30_000;            // snapshot ≤ T AND > 0 → ✓

    if (selfCheck) {
      // ── Self-check: guard removal disables OUT OF ORDER detection ─────────────
      sep();
      info('Self-check: felt=AFTER, thinking=BEFORE, detection DISABLED');
      info('Expected: no ⚠️ OUT OF ORDER for Felt (guard removed)');
      resetAll();
      setOrderingCheckEnabledForTest(false);
      setPrevEpisodeCaptureForTest(T);
      setLastReplitOutputForTest(EXCHANGE);
      setFeltAtLastExchangeForTest(AFTER);
      setThinkingAtLastExchangeForTest(BEFORE);
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeCaptureStatusDbOnlyForTest();
      const s1 = readStatus();

      if (s1.includes(FELT_OOO_NEEDLE)) {
        fail('⚠️ OUT OF ORDER Felt: still appears with detection disabled — self-check broken');
        failures++;
      } else {
        pass('⚠️ OUT OF ORDER Felt: absent when detection is disabled');
      }

      // Re-enable and confirm it appears
      info('Self-check: re-enabling detection — ⚠️ OUT OF ORDER must reappear');
      setOrderingCheckEnabledForTest(true);
      writeCaptureStatusDbOnlyForTest();
      const s2 = readStatus();

      if (!s2.includes(FELT_OOO_NEEDLE)) {
        fail('⚠️ OUT OF ORDER Felt: still absent after re-enabling — guard is dead code');
        failures++;
      } else {
        pass('⚠️ OUT OF ORDER Felt: present after re-enabling — guard is the active gate');
      }

      // No episode .md section in either case
      if (s1.includes(MD_SECTION_NEEDLE) || s2.includes(MD_SECTION_NEEDLE)) {
        fail('"## Episode .md" section appeared in DB-only output — should be absent');
        failures++;
      } else {
        pass('"## Episode .md" section absent in all self-check rounds');
      }

    } else {
      // ── Round 1: no prior output yet (prevReplitOutputMs === 0) ─────────────
      sep();
      info('Round 1 — prevReplitOutputMs === 0 (no prior output this server run)');
      info('Expected: no-episode header, ordering-wait message, no .md section');
      resetAll();
      writeCaptureStatusDbOnlyForTest();
      const r1 = readStatus();

      if (!r1.includes(NO_EPISODE_HEADER)) {
        fail(`Header missing: "${NO_EPISODE_HEADER}"`);
        failures++;
      } else {
        pass(`Header contains "${NO_EPISODE_HEADER}"`);
      }

      if (!r1.includes(NO_EPISODE_DB_NOTE)) {
        fail(`Header missing DB note: "${NO_EPISODE_DB_NOTE}"`);
        failures++;
      } else {
        pass(`Header contains "${NO_EPISODE_DB_NOTE}"`);
      }

      if (!r1.includes(ORDERING_WAIT_NEEDLE)) {
        fail(`Ordering section missing wait message: "${ORDERING_WAIT_NEEDLE}"`);
        failures++;
      } else {
        pass(`Ordering section shows wait message (no prior output yet)`);
      }

      if (r1.includes(MD_SECTION_NEEDLE)) {
        fail('"## Episode .md" section appeared — should be absent with no episode');
        failures++;
      } else {
        pass('"## Episode .md" section absent (no rolling episode)');
      }

      // ── Round 2: both channels correct (anticipatory) ─────────────────────────
      sep();
      info('Round 2 — both channels fired BEFORE prior output (anticipatory → ✓)');
      info('Expected: ✓ for Felt and Thinking, no .md section');
      resetAll();
      setPrevEpisodeCaptureForTest(T);
      setLastReplitOutputForTest(EXCHANGE);
      setFeltAtLastExchangeForTest(BEFORE);      // before prior output → ✓
      setThinkingAtLastExchangeForTest(BEFORE);  // before prior output → ✓
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeCaptureStatusDbOnlyForTest();
      const r2 = readStatus();

      if (!r2.includes(FELT_OK_NEEDLE)) {
        fail(`Expected ✓ for Felt — not found. Output snippet:\n${r2.slice(0, 400)}`);
        failures++;
      } else {
        pass(`✓  Felt: present (anticipatory)`);
      }

      if (!r2.includes(THINKING_OK_NEEDLE)) {
        fail(`Expected ✓ for Thinking — not found`);
        failures++;
      } else {
        pass(`✓  Thinking: present (anticipatory)`);
      }

      if (r2.includes(FELT_OOO_NEEDLE) || r2.includes(THINKING_OOO_NEEDLE)) {
        fail('⚠️ OUT OF ORDER appeared when both channels were anticipatory');
        failures++;
      } else {
        pass('⚠️ OUT OF ORDER absent (both channels were anticipatory)');
      }

      if (r2.includes(MD_SECTION_NEEDLE)) {
        fail('"## Episode .md" section appeared — should be absent');
        failures++;
      } else {
        pass('"## Episode .md" section absent');
      }

      // ── Round 3: felt fires AFTER prior output (reactive → OUT OF ORDER) ──────
      sep();
      info('Round 3 — felt fires AFTER prior output (reactive → ⚠️ OUT OF ORDER Felt:)');
      info('Expected: ⚠️ OUT OF ORDER Felt:, ✓ Thinking:, no .md section');
      resetAll();
      setPrevEpisodeCaptureForTest(T);
      setLastReplitOutputForTest(EXCHANGE);
      setFeltAtLastExchangeForTest(AFTER);       // felt fired AFTER prior output → OUT OF ORDER
      setThinkingAtLastExchangeForTest(BEFORE);  // thinking was anticipatory → ✓
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(EXCHANGE + 2_000);

      writeCaptureStatusDbOnlyForTest();
      const r3 = readStatus();

      if (!r3.includes(FELT_OOO_NEEDLE)) {
        fail(`"${FELT_OOO_NEEDLE}" not found — ordering check did not fire for Felt`);
        failures++;
      } else {
        pass(`"${FELT_OOO_NEEDLE}" present — ordering check fired correctly`);
      }

      if (r3.includes(THINKING_OOO_NEEDLE)) {
        fail('⚠️ OUT OF ORDER Thinking: present — should be ✓ (thinking was anticipatory)');
        failures++;
      } else {
        pass('⚠️ OUT OF ORDER Thinking: absent — Thinking correctly shows ✓');
      }

      if (r3.includes(MD_SECTION_NEEDLE)) {
        fail('"## Episode .md" section appeared — should be absent');
        failures++;
      } else {
        pass('"## Episode .md" section absent');
      }

      // ── Round 4: thinking never fired (→ ⚠️ MISSING) ─────────────────────────
      sep();
      info('Round 4 — thinking never fired this server run (→ ⚠️ MISSING Thinking:)');
      info('Expected: ✓ Felt:, ⚠️ MISSING Thinking:, no .md section');
      resetAll();
      setPrevEpisodeCaptureForTest(T);
      setLastReplitOutputForTest(EXCHANGE);
      setFeltAtLastExchangeForTest(BEFORE);      // felt was anticipatory → ✓
      setThinkingAtLastExchangeForTest(0);       // thinking never fired → MISSING
      setLastFeltProcessedForTest(EXCHANGE + 1_000);
      setLastThinkingProcessedForTest(0);

      writeCaptureStatusDbOnlyForTest();
      const r4 = readStatus();

      if (!r4.includes(THINKING_MISS_NEEDLE)) {
        fail(`"${THINKING_MISS_NEEDLE}" not found — MISSING detection did not fire`);
        failures++;
      } else {
        pass(`"${THINKING_MISS_NEEDLE}" present — MISSING detection fires correctly`);
      }

      if (r4.includes(THINKING_OOO_NEEDLE)) {
        fail('⚠️ OUT OF ORDER Thinking: present — should be MISSING (never fired)');
        failures++;
      } else {
        pass('⚠️ OUT OF ORDER Thinking: absent when channel never fired');
      }

      if (!r4.includes(FELT_OK_NEEDLE)) {
        fail(`Expected ✓ Felt: — not found`);
        failures++;
      } else {
        pass(`✓  Felt: present (anticipatory)`);
      }

      if (r4.includes(MD_SECTION_NEEDLE)) {
        fail('"## Episode .md" section appeared — should be absent');
        failures++;
      } else {
        pass('"## Episode .md" section absent');
      }
    }

  } finally {
    // ── Restore status file ─────────────────────────────────────────────────────
    if (statusSnapBefore !== null) {
      writeFileSync(CAPTURE_STATUS_PATH, statusSnapBefore);
    } else if (existsSync(CAPTURE_STATUS_PATH)) {
      unlinkSync(CAPTURE_STATUS_PATH);
    }
    resetAll();
    setOrderingCheckEnabledForTest(true);
    console.log('');
    info('Status file restored to pre-test state.');
  }

  sep();
  if (failures === 0) {
    console.log(`\n${GREEN}✓ All DB-only ordering checks passed.${RESET}`);
    console.log(`  DB ordering section fires correctly when no rolling episode is active.\n`);
    process.exit(0);
  } else {
    console.error(`\n${RED}✗ ${failures} check(s) failed.${RESET}\n`);
    process.exit(1);
  }
}

main().catch((err: any) => {
  console.error(RED + `\nFATAL: ${err?.message ?? err}` + RESET);
  console.error(err?.stack ?? '');
  process.exit(1);
});
