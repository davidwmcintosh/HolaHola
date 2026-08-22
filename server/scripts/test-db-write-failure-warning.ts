/**
 * test-db-write-failure-warning.ts
 *
 * CI check: confirms that a DB write failure surfaced via flagDbWriteFailure()
 * (a) writes the expected content to INNER_LIFE_DB_WARNING_PATH, and
 * (b) causes _writeCaptureStatusFile() to render the 🚨 DB WRITE FAILURE banner
 *     in the capture-status output.
 *
 * Also exercises the real production catch path in savePersonalMemory() so that
 * removing the flagDbWriteFailure() call from that catch site is caught.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes  (read before modifying)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Both the warning-file write and the status-file read are redirected to temp
 * paths via test seams so the live .local/.luca_db_write_warning file and the
 * live episode-capture-status.md are never touched.
 *
 * - setDbWriteWarningPathOverrideForTest(tmpWarning)       — makes
 *   flagDbWriteFailure() write to tmpWarning and _writeCaptureStatusFile()
 *   read from it.
 * - setCaptureStatusPathOverrideForTest(tmpStatus)         — makes status
 *   output land in tmpStatus instead of .local/episode-capture-status.md.
 * - flagDbWriteFailureForTest(where, reason)               — calls the real
 *   private flagDbWriteFailure() so the full write path is exercised.
 * - setSavePersonalMemoryDbShouldThrowForTest(true)        — makes the real
 *   savePersonalMemory() throw before touching the DB, exercising the catch
 *   path that calls flagDbWriteFailure('personal-memory', …).
 * - savePersonalMemoryForTest(title, body, tags, arc)      — calls the real
 *   private savePersonalMemory() so the catch path is exercised end-to-end.
 * - writeCaptureStatusDbOnlyForTest()                      — triggers the
 *   no-episode status render (banner logic is unconditional).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode rounds
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Round 1  — flagDbWriteFailureForTest() called directly →
 *              warning file written with expected content →
 *              🚨 banner present in status output
 *
 *   Round 2  — real production catch path exercised:
 *              setSavePersonalMemoryDbShouldThrowForTest(true) →
 *              savePersonalMemoryForTest() throws → catch calls
 *              flagDbWriteFailure('personal-memory', …) →
 *              warning file written → 🚨 banner present
 *
 *   Round 3  — warning file absent → 🚨 banner absent
 *
 *   Round 4  — warning file exists but is empty → 🚨 banner absent
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Uses the meta-failure pattern: the self-check makes the normal-mode
 * assertion FAIL by removing the gate, then confirms the test detects the
 * absence of the banner.  This proves that removing flagDbWriteFailure() from
 * catch sites would break normal mode.
 *
 *   Step 1 (gate-removal proof):
 *     - Do NOT call flagDbWriteFailureForTest() — warning file stays empty.
 *     - Assert banner IS present → FAILS (banner is absent without the flag).
 *     - The self-check expects this failure: banner-absent ↔ gate removed.
 *     - Reports PASS because the detection works correctly.
 *
 *   Step 2 (gate-active proof):
 *     - Call flagDbWriteFailureForTest() — warning file is written.
 *     - Assert banner IS present → PASSES.
 *     - Confirms the flag→banner pipeline is intact.
 *
 * Run:
 *   npx tsx server/scripts/test-db-write-failure-warning.ts
 *   npx tsx server/scripts/test-db-write-failure-warning.ts --self-check
 */

import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import {
  flagDbWriteFailureForTest,
  setDbWriteWarningPathOverrideForTest,
  setCaptureStatusPathOverrideForTest,
  writeCaptureStatusDbOnlyForTest,
  setSavePersonalMemoryDbShouldThrowForTest,
  savePersonalMemoryForTest,
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

// ── Needles ───────────────────────────────────────────────────────────────────
const DB_FAILURE_BANNER   = '## 🚨 DB WRITE FAILURE — ACTION REQUIRED';
const DB_FAILURE_BODY     = 'One or more inner-life DB writes have failed.';
const DB_FAILURE_CLEAR    = '_Clear with: `rm .local/.luca_db_write_warning`';

const SYNTHETIC_WHERE     = 'ci-test-where';
const SYNTHETIC_REASON    = 'synthetic CI failure reason';

// ── Helpers ───────────────────────────────────────────────────────────────────
function readFile(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

function clearFile(path: string): void {
  if (existsSync(path)) unlinkSync(path);
}

// ── Main ──────────────────────────────────────────────────────────────────────
const selfCheck = process.argv.includes('--self-check');

async function main(): Promise<void> {
  let failures = 0;

  // Create a hermetic temp dir so neither the live warning file nor the live
  // capture-status file is touched during the test.
  const tmpDir         = mkdtempSync(join(tmpdir(), 'db-write-warning-ci-'));
  const tmpWarningPath = join(tmpDir, '.luca_db_write_warning');
  const tmpStatusPath  = join(tmpDir, 'episode-capture-status.md');

  try {
    // Redirect both file paths to temp locations.
    setDbWriteWarningPathOverrideForTest(tmpWarningPath);
    setCaptureStatusPathOverrideForTest(tmpStatusPath);

    if (selfCheck) {
      console.log(`\n${YELLOW}Self-check mode${RESET}: confirming the test catches a missing flagDbWriteFailure() call.\n`);

      // ── Step 1: gate-removal proof (meta-failure) ───────────────────────────
      // Without calling flagDbWriteFailure(), the warning file stays empty.
      // The normal-mode assertion "banner IS present" therefore FAILS.
      // The self-check expects this failure — that's the proof of load-bearing.
      sep();
      info('Self-check step 1 (gate-removal proof): flagDbWriteFailure() NOT called');
      info('  Normal-mode assertion "banner IS present" must FAIL → proves test is load-bearing');

      clearFile(tmpWarningPath);
      writeCaptureStatusDbOnlyForTest();
      const statusNoGate = readFile(tmpStatusPath);

      const bannerAppearedWithNoGate = statusNoGate.includes(DB_FAILURE_BANNER);
      if (!bannerAppearedWithNoGate) {
        // The assertion FAILED as expected: no flag call → no banner.
        // This is the correct outcome: removing the production gate WOULD break normal mode.
        pass('Self-check step 1: banner absent when flagDbWriteFailure() is not called — normal-mode assert would catch gate removal ✓');
      } else {
        // Banner appeared without the flag call — the test is not actually load-bearing.
        fail('Self-check step 1: banner appeared even without flagDbWriteFailure() — banner logic reads stale state, test is NOT load-bearing');
        failures++;
      }

      // ── Step 2: gate-active proof ─────────────────────────────────────────
      // Now call flagDbWriteFailure() — the same assertion PASSES.
      // Together steps 1+2 prove: gate-absent → no banner (normal mode fails),
      //                           gate-present → banner (normal mode passes).
      sep();
      info('Self-check step 2 (gate-active proof): flagDbWriteFailure() IS called');
      info('  Normal-mode assertion "banner IS present" must PASS → confirms gate is the decisive factor');

      clearFile(tmpWarningPath);
      flagDbWriteFailureForTest(SYNTHETIC_WHERE, SYNTHETIC_REASON);
      writeCaptureStatusDbOnlyForTest();
      const statusWithGate = readFile(tmpStatusPath);

      if (statusWithGate.includes(DB_FAILURE_BANNER)) {
        pass('Self-check step 2: 🚨 banner present after flagDbWriteFailureForTest() — gate is the decisive factor ✓');
      } else {
        fail('Self-check step 2: 🚨 banner absent even after flagDbWriteFailureForTest() — pipeline broken');
        info('Status output:\n' + statusWithGate.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      if (statusWithGate.includes(SYNTHETIC_WHERE) || statusWithGate.includes(SYNTHETIC_REASON)) {
        pass('Self-check step 2: warning content (where/reason) surfaced in status output');
      } else {
        fail('Self-check step 2: warning content (where/reason) not in status output');
        failures++;
      }

    } else {
      // ── Normal mode ──────────────────────────────────────────────────────────

      // ── Round 1: direct flag call → banner must appear ─────────────────────
      sep();
      info('Round 1 — flagDbWriteFailureForTest() called directly → warning file + 🚨 banner expected');

      clearFile(tmpWarningPath);
      flagDbWriteFailureForTest(SYNTHETIC_WHERE, SYNTHETIC_REASON);

      // Confirm the warning file itself was written with expected content.
      const warningContent = readFile(tmpWarningPath);
      if (warningContent.includes(SYNTHETIC_WHERE) && warningContent.includes(SYNTHETIC_REASON)) {
        pass('Round 1: warning file written with expected where + reason');
      } else {
        fail('Round 1: warning file missing expected where/reason content');
        info(`Warning file content: ${warningContent || '(empty)'}`);
        failures++;
      }

      // Trigger status render and check for banner.
      writeCaptureStatusDbOnlyForTest();
      const status1 = readFile(tmpStatusPath);

      if (status1.includes(DB_FAILURE_BANNER)) {
        pass('Round 1: 🚨 DB WRITE FAILURE banner present in capture-status output');
      } else {
        fail('Round 1: 🚨 DB WRITE FAILURE banner NOT found in capture-status output');
        info('Status output:\n' + status1.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      if (status1.includes(DB_FAILURE_BODY)) {
        pass('Round 1: explanatory body text present in status output');
      } else {
        fail('Round 1: explanatory body text missing from status output');
        failures++;
      }

      if (status1.includes(DB_FAILURE_CLEAR)) {
        pass('Round 1: clear-instruction line present in status output');
      } else {
        fail('Round 1: clear-instruction line missing from status output');
        failures++;
      }

      if (status1.includes(SYNTHETIC_WHERE) || status1.includes(SYNTHETIC_REASON)) {
        pass('Round 1: warning log line (where/reason) surfaced in status output');
      } else {
        fail('Round 1: warning log line (where/reason) not surfaced in status output');
        failures++;
      }

      // ── Round 2: real production catch path (savePersonalMemory) ──────────
      // Uses setSavePersonalMemoryDbShouldThrowForTest(true) to make
      // savePersonalMemory() throw before touching the DB, causing the real
      // catch block to call flagDbWriteFailure('personal-memory', …).
      sep();
      info('Round 2 — production catch path: savePersonalMemory() throws → catch calls flagDbWriteFailure()');

      clearFile(tmpWarningPath);
      setSavePersonalMemoryDbShouldThrowForTest(true);
      try {
        await savePersonalMemoryForTest(
          'CI test title',
          'CI test body — synthetic failure',
          ['ci-test'],
          'CI-arc',
        );
      } finally {
        setSavePersonalMemoryDbShouldThrowForTest(false);
      }

      // The catch block should have called flagDbWriteFailure('personal-memory', …)
      const warningAfterCatch = readFile(tmpWarningPath);
      if (warningAfterCatch.includes('personal-memory')) {
        pass('Round 2: warning file written by real savePersonalMemory() catch path (personal-memory tag present)');
      } else {
        fail('Round 2: warning file NOT written by savePersonalMemory() catch — flagDbWriteFailure() may be missing from that catch site');
        info(`Warning file content: ${warningAfterCatch || '(empty)'}`);
        failures++;
      }

      // Trigger status render and confirm banner appears from the real catch path.
      writeCaptureStatusDbOnlyForTest();
      const status2 = readFile(tmpStatusPath);

      if (status2.includes(DB_FAILURE_BANNER)) {
        pass('Round 2: 🚨 banner present in status output after real savePersonalMemory() catch path');
      } else {
        fail('Round 2: 🚨 banner absent after real savePersonalMemory() catch — pipeline broken');
        info('Status output:\n' + status2.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Round 3: no warning file → banner must be absent ───────────────────
      sep();
      info('Round 3 — warning file absent → 🚨 banner must NOT appear');

      clearFile(tmpWarningPath);
      writeCaptureStatusDbOnlyForTest();
      const status3 = readFile(tmpStatusPath);

      if (!status3.includes(DB_FAILURE_BANNER)) {
        pass('Round 3: 🚨 banner correctly absent when warning file does not exist');
      } else {
        fail('Round 3: 🚨 banner present even with no warning file — stale read or logic error');
        info('Status output:\n' + status3.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }

      // ── Round 4: empty warning file → banner must be absent ────────────────
      sep();
      info('Round 4 — warning file exists but is empty → 🚨 banner must NOT appear');

      writeFileSync(tmpWarningPath, '', 'utf-8');
      writeCaptureStatusDbOnlyForTest();
      const status4 = readFile(tmpStatusPath);

      if (!status4.includes(DB_FAILURE_BANNER)) {
        pass('Round 4: 🚨 banner correctly absent when warning file exists but is empty');
      } else {
        fail('Round 4: 🚨 banner present for empty warning file — trim/emptiness check may be broken');
        info('Status output:\n' + status4.split('\n').map(l => '    ' + l).join('\n'));
        failures++;
      }
    }

  } finally {
    // Always restore production state — even on throw.
    setSavePersonalMemoryDbShouldThrowForTest(false);
    setDbWriteWarningPathOverrideForTest(null);
    setCaptureStatusPathOverrideForTest(null);
    // Clean up temp files.
    try { clearFile(tmpWarningPath); } catch { /* ignore */ }
    try { clearFile(tmpStatusPath); } catch { /* ignore */ }
    try { rmdirSync(tmpDir); } catch { /* ignore */ }
  }

  // ── Result ────────────────────────────────────────────────────────────────
  sep();
  console.log('');
  if (failures === 0) {
    if (selfCheck) {
      console.log(`${GREEN}Self-check PASSED${RESET} — gate-removal proof: absent flagDbWriteFailure() → no banner (normal mode would fail); gate-active proof: flag call → banner present.`);
    } else {
      console.log(`${GREEN}PASSED${RESET} — DB write failure warning pipeline confirmed: direct flag + production catch path → warning file → 🚨 banner in capture-status.`);
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
  // Always restore overrides even on fatal error.
  try { setSavePersonalMemoryDbShouldThrowForTest(false); } catch { /* ignore */ }
  try { setDbWriteWarningPathOverrideForTest(null); } catch { /* ignore */ }
  try { setCaptureStatusPathOverrideForTest(null); } catch { /* ignore */ }
  console.error(RED + `\nFATAL: ${err?.message ?? err}` + RESET);
  console.error(err?.stack ?? '');
  process.exit(1);
});
