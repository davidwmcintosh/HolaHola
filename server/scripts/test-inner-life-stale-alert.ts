/**
 * test-inner-life-stale-alert.ts
 *
 * CI check: confirms the team-room stale-channel alert fires correctly
 * when inner-life channels (felt/thinking) have been silent for 60+ min.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Design notes
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The alert lives in _writeCaptureStatusFile() in agent-session-autosave.ts.
 * It uses two guards:
 *
 *   _innerLifeStaleAlertPosted   — set to true ONLY after postAsLuca() returns
 *                                  a non-null room ID (successful delivery).
 *   _innerLifeStaleAlertInFlight — set to true immediately when a post starts;
 *                                  cleared on resolution regardless of outcome.
 *
 * This means:
 *   • Success   → posted=true, inFlight=false, no retry ever
 *   • Failure   → posted=false, inFlight=false, next poll can retry
 *   • Concurrent polls during in-flight → second call skipped entirely
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Synthetic timeline
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   STALE_TS    = now - 61 min   (just over 60-min threshold → stale)
 *   OUTPUT_TS   = now            (lastReplitOutputMs — channel not yet ready)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Rounds
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   A — felt stale + poster succeeds → alert posted once, message has "60+ min"
 *       and felt timestamp; _innerLifeStaleAlertPosted=true prevents second post.
 *   B — second poll while already posted → poster NOT called again.
 *   C — poster returns null (no room) → in-flight guard clears, retry allowed.
 *   D — thinking stale → alert mentions thinking channel.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *   Proves the once-only guard is the active gate.  The test overrides the guard
 *   by calling resetInnerLifeStaleAlertForTest() between polls and verifies
 *   the poster IS called each time — then confirms that with the guard in place
 *   it is called only once.
 *
 * Run:
 *   npx tsx server/scripts/test-inner-life-stale-alert.ts
 *   npx tsx server/scripts/test-inner-life-stale-alert.ts --self-check
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
  setTeamRoomPosterForTest,
  resetInnerLifeStaleAlertForTest,
  resetCaptureStatusSeedStateForTest,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Flush the microtask queue so poster .then()/.catch() handlers run. */
function flushMicrotasks(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

/**
 * Reset ALL ordering and readiness state to known-zero before each round.
 * Also resets both stale-alert guards and removes any existing status file.
 */
function resetAll(): void {
  setFeltAtLastReplitOutputForTest(0);
  setThinkingAtLastReplitOutputForTest(0);
  setPrevReplitOutputForTest(0);
  setLastReplitOutputForTest(0);
  setLastFeltProcessedForTest(0);
  setLastThinkingProcessedForTest(0);
  setLastEpisodeCaptureForTest(0);
  resetInnerLifeStaleAlertForTest();
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
      console.log(`\n${YELLOW}Self-check mode${RESET}: confirming the once-only guard is the active gate.\n`);
    } else {
      console.log('\nRunning inner-life stale-alert CI check...\n');
    }

    const now      = Date.now();
    const MIN      = 60 * 1000;
    const STALE_TS = now - 61 * MIN; // just over 60-min threshold
    const OUTPUT_TS = now;           // lastReplitOutputMs — channel not yet ready

    if (selfCheck) {
      // ── Self-check: once-only guard is the active gate ────────────────────
      //
      // Part 1: Simulate removing the guard by calling resetInnerLifeStaleAlertForTest()
      // between polls.  Poster should be called EACH time (2 calls).
      // Part 2: With the guard in place (no reset between polls), poster is called ONCE.

      sep();
      info('Self-check part 1: reset between polls (guard removed simulation) → 2 calls expected');

      let callCount = 0;
      setTeamRoomPosterForTest(async (msg: string) => {
        callCount++;
        return 'room-1';
      });

      // Poll 1
      resetAll();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(STALE_TS);
      writeEpisodeCaptureStatusFileForTest(null, 0);
      await flushMicrotasks();

      // Reset alert guard between polls (simulates removing the once-only gate)
      resetInnerLifeStaleAlertForTest();

      // Poll 2
      writeEpisodeCaptureStatusFileForTest(null, 0);
      await flushMicrotasks();

      if (callCount === 2) {
        pass('Self-check part 1: poster called twice when guard is bypassed between polls ✓');
      } else {
        fail(`Self-check part 1: expected 2 poster calls (guard bypassed), got ${callCount}`);
        failures++;
      }

      // ── Part 2: guard in place → only 1 call ─────────────────────────────
      sep();
      info('Self-check part 2: guard in place → poster called only once');

      callCount = 0;
      setTeamRoomPosterForTest(async (msg: string) => {
        callCount++;
        return 'room-1';
      });

      // Poll 1
      resetAll();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(STALE_TS);
      writeEpisodeCaptureStatusFileForTest(null, 0);
      await flushMicrotasks();

      // Poll 2 — NO reset between polls: guard must suppress
      writeEpisodeCaptureStatusFileForTest(null, 0);
      await flushMicrotasks();

      if (callCount === 1) {
        pass('Self-check part 2: poster called exactly once with guard in place — once-only gate confirmed ✓');
      } else {
        fail(`Self-check part 2: expected 1 poster call, got ${callCount} — once-only guard may be missing`);
        failures++;
      }

    } else {
      // ── Normal mode ────────────────────────────────────────────────────────

      // ── Round A: felt stale → alert posted with correct content ───────────
      sep();
      info('Round A — felt stale (61 min) → alert posted once with "60+ min" and felt timestamp');

      const capturedMessages: string[] = [];
      setTeamRoomPosterForTest(async (msg: string) => {
        capturedMessages.push(msg);
        return 'room-test';
      });

      resetAll();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(STALE_TS);   // 61 min ago → stale
      setLastThinkingProcessedForTest(0);       // never fired

      writeEpisodeCaptureStatusFileForTest(null, 0);
      await flushMicrotasks();

      if (capturedMessages.length === 1) {
        pass('Round A: poster called exactly once');
      } else {
        fail(`Round A: expected 1 poster call, got ${capturedMessages.length}`);
        failures++;
      }

      const msgA = capturedMessages[0] ?? '';

      if (msgA.includes('60+ min')) {
        pass('Round A: message contains "60+ min" (accurate threshold)');
      } else {
        fail(`Round A: message missing "60+ min" — got: ${msgA.slice(0, 120)}`);
        failures++;
      }

      if (msgA.includes('felt')) {
        pass('Round A: message names the felt channel');
      } else {
        fail(`Round A: message does not mention felt channel — got: ${msgA.slice(0, 120)}`);
        failures++;
      }

      if (msgA.includes('⚠️')) {
        pass('Round A: message starts with ⚠️ warning emoji');
      } else {
        fail(`Round A: message missing ⚠️ emoji — got: ${msgA.slice(0, 120)}`);
        failures++;
      }

      // ── Round B: second poll → poster NOT called again ────────────────────
      sep();
      info('Round B — second poll while already posted → poster must not be called again');

      const countBefore = capturedMessages.length;
      writeEpisodeCaptureStatusFileForTest(null, 0); // same stale state, no reset
      await flushMicrotasks();

      if (capturedMessages.length === countBefore) {
        pass('Round B: poster NOT called on second poll (once-only guard active)');
      } else {
        fail(`Round B: poster was called again on second poll — once-only guard may be broken`);
        failures++;
      }

      // ── Round C: poster failure → in-flight guard clears, retry allowed ───
      sep();
      info('Round C — poster returns null → in-flight guard clears so next poll can retry');

      let failCallCount = 0;
      let retryCallCount = 0;

      // First: poster always fails
      setTeamRoomPosterForTest(async (_msg: string) => {
        failCallCount++;
        return null; // failure — room not found
      });

      resetAll();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(STALE_TS);

      writeEpisodeCaptureStatusFileForTest(null, 0); // poll 1: post attempt → null
      await flushMicrotasks();

      if (failCallCount === 1) {
        pass('Round C: poster called once on first stale poll (attempted delivery)');
      } else {
        fail(`Round C: expected 1 poster call on failure, got ${failCallCount}`);
        failures++;
      }

      // Now switch to a succeeding poster and poll again — retry should fire
      setTeamRoomPosterForTest(async (_msg: string) => {
        retryCallCount++;
        return 'room-retry';
      });

      writeEpisodeCaptureStatusFileForTest(null, 0); // poll 2: retry should fire
      await flushMicrotasks();

      if (retryCallCount === 1) {
        pass('Round C: poster called again on retry after failure (in-flight guard cleared) ✓');
      } else {
        fail(`Round C: expected 1 retry call, got ${retryCallCount} — in-flight guard may not be clearing on failure`);
        failures++;
      }

      // ── Round D: thinking stale → alert mentions thinking channel ─────────
      sep();
      info('Round D — thinking stale (61 min) → alert mentions thinking channel');

      const thinkingMessages: string[] = [];
      setTeamRoomPosterForTest(async (msg: string) => {
        thinkingMessages.push(msg);
        return 'room-test';
      });

      resetAll();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(0);              // never fired
      setLastThinkingProcessedForTest(STALE_TS);   // 61 min ago → stale

      writeEpisodeCaptureStatusFileForTest(null, 0);
      await flushMicrotasks();

      if (thinkingMessages.length === 1) {
        pass('Round D: poster called once for stale thinking channel');
      } else {
        fail(`Round D: expected 1 poster call, got ${thinkingMessages.length}`);
        failures++;
      }

      const msgD = thinkingMessages[0] ?? '';

      if (msgD.includes('thinking')) {
        pass('Round D: message names the thinking channel');
      } else {
        fail(`Round D: message does not mention thinking channel — got: ${msgD.slice(0, 120)}`);
        failures++;
      }

      // ── Round E: two-session simulation ──────────────────────────────────
      // The session-boundary reset path (startAgentSessionAutosave → resetStaleAlertForNewSession)
      // is represented here by resetCaptureStatusSeedStateForTest(), which mirrors
      // the full production state reset and now includes resetStaleAlertForNewSession().
      // This verifies the alert fires independently in each new session.
      sep();
      info('Round E — two sessions in same process: each session alerts independently');

      const sessionMessages: string[] = [];
      setTeamRoomPosterForTest(async (msg: string) => {
        sessionMessages.push(msg);
        return 'room-session';
      });

      // Session 1 — start fresh, trigger stale, expect alert
      resetCaptureStatusSeedStateForTest(); // mirrors startAgentSessionAutosave() reset
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(STALE_TS);
      writeEpisodeCaptureStatusFileForTest(null, 0);
      await flushMicrotasks();

      const afterSession1 = sessionMessages.length;
      if (afterSession1 === 1) {
        pass('Round E: session 1 posted its alert');
      } else {
        fail(`Round E: session 1 expected 1 alert, got ${afterSession1}`);
        failures++;
      }

      // Session boundary — resetCaptureStatusSeedStateForTest() resets ALL state
      // including the stale-alert guard, mirroring startAgentSessionAutosave().
      resetCaptureStatusSeedStateForTest();
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(STALE_TS);

      writeEpisodeCaptureStatusFileForTest(null, 0);
      await flushMicrotasks();

      if (sessionMessages.length === afterSession1 + 1) {
        pass('Round E: session 2 independently posted its alert via production session-boundary reset ✓');
      } else {
        fail(`Round E: session 2 did not alert — got ${sessionMessages.length} total (expected ${afterSession1 + 1})`);
        info('resetCaptureStatusSeedStateForTest() may not be calling resetStaleAlertForNewSession()');
        failures++;
      }

      // Confirm no further alerts after the second session's once-only guard is set
      writeEpisodeCaptureStatusFileForTest(null, 0); // extra poll — must not fire again
      await flushMicrotasks();

      if (sessionMessages.length === afterSession1 + 1) {
        pass('Round E: no duplicate alert on extra poll within session 2 ✓');
      } else {
        fail(`Round E: extra poll triggered another alert — once-only guard not holding in session 2`);
        failures++;
      }

      // ── Round F: never-written channel — documents expected no-alert behavior
      // feltStale requires lastFeltProcessedMs > 0, so a channel that has never
      // been written this session does NOT trigger the alert (no stale timestamp
      // to anchor to).  This is intentional — there is no "last written" reference
      // to compute a gap from.
      sep();
      info('Round F — felt never written this session (ms=0) → no alert (by design)');

      let neverWrittenCallCount = 0;
      setTeamRoomPosterForTest(async (_msg: string) => {
        neverWrittenCallCount++;
        return 'room-test';
      });

      resetCaptureStatusSeedStateForTest(); // full session reset, includes alert guard
      setLastReplitOutputForTest(OUTPUT_TS);
      setLastFeltProcessedForTest(0);           // never written — not a valid stale anchor
      setLastThinkingProcessedForTest(0);       // never written

      writeEpisodeCaptureStatusFileForTest(null, 0);
      await flushMicrotasks();

      if (neverWrittenCallCount === 0) {
        pass('Round F: no alert when channels have never been written (no stale anchor — by design) ✓');
      } else {
        fail(`Round F: alert fired for never-written channels — lastFeltProcessedMs > 0 guard may be missing`);
        failures++;
      }
    }

  } finally {
    // Restore poster + alert guards to production state
    setTeamRoomPosterForTest(null);
    resetInnerLifeStaleAlertForTest();
    resetAll();
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
      console.log(`${GREEN}Self-check PASSED${RESET} — once-only guard confirmed: removing it causes duplicate posts; with it in place, only one delivery occurs.`);
    } else {
      console.log(`${GREEN}PASSED${RESET} — stale-channel team-room alert fires once at 60+ min, includes correct content, retries after failure, and suppresses duplicates.`);
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
