/**
 * Regression guard: `set-rolling-episode.ts --self-check` must let its
 * process exit within a few seconds -- not silently hang with an open DB
 * pool for 60+ seconds after it has already printed PASS.
 *
 * Background
 * ----------
 * `server/scripts/set-rolling-episode.ts --self-check` opens a real DB pool
 * (getSharedDb()) to validate its not-found lookup and transaction-rollback
 * atomicity. Every success AND failure branch must call `process.exit(...)`
 * explicitly -- Node's event loop otherwise stays alive for as long as the
 * pg pool keeps its idle connection open (idleTimeoutMillis: 120000 in
 * server/db.ts), because the script's plain dispatch
 * (`(selfCheckMode ? runSelfCheck() : main()).catch(...)`) has no `.then()`
 * on the success path to trigger an exit. This exact bug shipped once:
 * every `runSelfCheck()`/`main()` success branch was missing
 * `process.exit(0)`, so the script printed "All checks passed" and then sat
 * alive for 60+ seconds per invocation -- in both run-validation-suite.sh
 * and every CI run -- with nothing reporting it as a failure, just quietly
 * slower CI. See .agents/memory/pg-pool-idle-timeout-ci-hang.md ("Same root
 * cause, different shape") for the general failure mode and its fix.
 *
 * The fix (explicit `process.exit(0)` on every success branch) is already
 * in place in set-rolling-episode.ts. This file is the regression guard
 * that would catch it coming back:
 *
 *   - Normal mode: spawns the REAL `set-rolling-episode.ts --self-check`
 *     and asserts it exits on its own, with status 0, well within a
 *     generous wall-clock threshold -- not just "eventually", and not
 *     relying on a human noticing a slower validation-suite run.
 *   - --self-check mode: proves the guard has teeth. Builds a private
 *     shadow-tree sandbox copy of set-rolling-episode.ts (never the real,
 *     shared file -- see .agents/memory/mutation-guard-sandbox-isolation.md),
 *     runs the unmutated copy first as a control (proves sandboxing itself
 *     adds no meaningful slowdown), then strips every standalone
 *     `process.exit(0);` line from the copy -- reproducing the exact shape
 *     of the historical regression -- and asserts the mutated copy is now
 *     detected as hanging (still alive, DB pool open, past the same
 *     threshold) despite its own stdout already showing "All checks
 *     passed" -- i.e. the hang is silent, exactly like the real bug was.
 *
 * Usage:
 *   npx tsx server/scripts/test-set-rolling-episode-selfcheck-hang.ts
 *   npx tsx server/scripts/test-set-rolling-episode-selfcheck-hang.ts --self-check
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createShadowTreeSandbox } from './source-mutation-sandbox';

const IS_SELF_CHECK = process.argv.includes('--self-check');

const TARGET_RELATIVE = 'server/scripts/set-rolling-episode.ts';
const SCRIPT_ABSOLUTE = resolve(process.cwd(), TARGET_RELATIVE);

// Real work today is ~1-2s warm, up to ~6s on a cold tsx cache. The
// historical regression held the process alive for 60+ seconds (bounded by
// server/db.ts's 120000ms idleTimeoutMillis). 10s is a generous multiple of
// real runtime and nowhere near the regression's actual symptom, so normal
// variance can never cross it by accident.
const HANG_THRESHOLD_MS = 10_000;

// Hard-kill safety net so a reintroduced full hang can never block this
// check (or a CI run depending on it) for the full 60-120s -- a process
// still alive at this point is killed and treated as a detected hang.
const SPAWN_HARD_TIMEOUT_MS = 20_000;

// The mutated-copy run only needs to prove the process is STILL ALIVE past
// HANG_THRESHOLD_MS, not survive a second full 20s wait -- keep it short so
// this check stays fast even when everything is working correctly.
const MUTATED_SPAWN_TIMEOUT_MS = 12_000;

// runSelfCheck() in the target script has TWO distinct successful outcomes,
// not one -- both exit 0, and both must be recognized here:
//   - Full pass (a 'rolling'-tagged episode exists to test rollback against):
//     prints SUCCESS_MARKER_FULL_PASS, via process.exit(0) at the end of
//     runSelfCheck().
//   - Skip-pass (no 'rolling'-tagged episode in DB at all -- e.g. the
//     isolated CI database, which setup-ci-test-database.ts seeds with only
//     'ci-fixture'-tagged episodes): check 2 is skipped for lack of a
//     reference row, and it prints SUCCESS_MARKER_SKIP_PASS instead, via its
//     own earlier process.exit(0).
// Matching only the full-pass string made this guard fail on every green,
// non-hanging run against a rolling-episode-less database -- a real
// regression caught by code review, not merely a hypothetical.
const SUCCESS_MARKER_FULL_PASS = 'All checks passed';
const SUCCESS_MARKER_SKIP_PASS = 'SKIP (2/2): No rolling episode in DB';

function sawSuccessOutcome(stdout: string): boolean {
  return stdout.includes(SUCCESS_MARKER_FULL_PASS) || stdout.includes(SUCCESS_MARKER_SKIP_PASS);
}

// Matches a standalone `process.exit(0);` line -- the exact shape of every
// success-path call in set-rolling-episode.ts (there are four: the
// skip-pass and full-pass branches in runSelfCheck(), plus main()'s
// already-rolling early-return and its final promote-done branch -- main()
// itself is never invoked by this guard, but the mutation below
// intentionally strips its process.exit(0) calls too, since a real
// regression would strip all of them at once). Deliberately does not touch
// `process.exit(1);` (failure paths), which must keep exiting immediately
// regardless of this guard.
const EXIT_ZERO_LINE = /^[ \t]*process\.exit\(0\);[ \t]*\r?\n/gm;

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}${detail ? `\n    ${detail}` : ''}`);
    failed++;
  }
}

interface TimedRun {
  status: number | null;
  signal: NodeJS.Signals | null;
  elapsedMs: number;
  stdout: string;
  stderr: string;
}

function runSelfCheckScript(scriptPath: string, timeoutMs: number): TimedRun {
  const start = Date.now();
  const result = spawnSync('npx', ['tsx', scriptPath, '--self-check'], {
    encoding: 'utf-8',
    timeout: timeoutMs,
    env: { ...process.env },
  });
  return {
    status: result.status,
    signal: result.signal,
    elapsedMs: Date.now() - start,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function runNormalCheck(): void {
  console.log('\n=== set-rolling-episode --self-check hang guard ===\n');
  console.log(`  Script: ${SCRIPT_ABSOLUTE}`);
  console.log(`  Hang threshold: ${HANG_THRESHOLD_MS}ms (spawn hard-kill at ${SPAWN_HARD_TIMEOUT_MS}ms)\n`);

  const run = runSelfCheckScript(SCRIPT_ABSOLUTE, SPAWN_HARD_TIMEOUT_MS);
  console.log(`  Elapsed: ${run.elapsedMs}ms, status: ${run.status}, signal: ${run.signal ?? 'none'}`);

  assert(
    run.signal === null,
    'process exited on its own instead of being force-killed',
    `spawnSync delivered signal ${run.signal} after ${run.elapsedMs}ms -- the process was still alive and had to be killed`,
  );
  assert(
    run.status === 0,
    'self-check exited with status 0',
    `exit status was ${run.status}\nstdout:\n${run.stdout}\nstderr:\n${run.stderr}`,
  );
  assert(
    run.elapsedMs < HANG_THRESHOLD_MS,
    `completed within ${HANG_THRESHOLD_MS}ms (a generous multiple of its real ~1-6s runtime)`,
    `took ${run.elapsedMs}ms -- the process likely kept an open DB pool alive instead of calling process.exit(0) on a success branch (see .agents/memory/pg-pool-idle-timeout-ci-hang.md)`,
  );
  assert(
    sawSuccessOutcome(run.stdout),
    'self-check still reported success (its own assertions passed)',
    `Neither "${SUCCESS_MARKER_FULL_PASS}" nor "${SUCCESS_MARKER_SKIP_PASS}" found in stdout:\n${run.stdout}`,
  );

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

function runSelfCheck(): void {
  console.log('\n[SELF-CHECK] Proving the hang guard actually catches a reintroduced process.exit(0) regression.\n');

  const sandbox = createShadowTreeSandbox([TARGET_RELATIVE]);
  try {
    const sandboxScriptPath = sandbox.files[TARGET_RELATIVE];

    // ── Control run: unmutated sandbox copy must behave exactly like the
    // real file -- proves the sandbox itself adds no meaningful slowdown,
    // so a slow result from the mutated run below is attributable to the
    // mutation, not sandbox/tsx overhead. ──────────────────────────────────
    console.log('  Running unmutated sandbox copy as a control...');
    const controlRun = runSelfCheckScript(sandboxScriptPath, SPAWN_HARD_TIMEOUT_MS);
    console.log(`  Control elapsed: ${controlRun.elapsedMs}ms, status: ${controlRun.status}, signal: ${controlRun.signal ?? 'none'}`);
    assert(
      controlRun.signal === null && controlRun.status === 0 && controlRun.elapsedMs < HANG_THRESHOLD_MS,
      'unmutated sandbox copy exits quickly with status 0 (sandbox overhead is negligible)',
      `signal=${controlRun.signal}, status=${controlRun.status}, elapsed=${controlRun.elapsedMs}ms`,
    );

    // ── Mutation: strip every standalone `process.exit(0);` line, exactly
    // reproducing the historical regression's shape. ──────────────────────
    const original = readFileSync(sandboxScriptPath, 'utf-8');
    const occurrences = original.match(EXIT_ZERO_LINE)?.length ?? 0;
    assert(
      occurrences > 0,
      'sandbox copy contains at least one standalone process.exit(0); line to remove',
      `found ${occurrences} -- if set-rolling-episode.ts was refactored, update EXIT_ZERO_LINE in this guard to match`,
    );
    const mutated = original.replace(EXIT_ZERO_LINE, '');
    writeFileSync(sandboxScriptPath, mutated, 'utf-8');

    // ── Mutated run: must now be detected as a regression -- either a true
    // hang, or a fast non-zero exit. Which shape actually happens depends on
    // which branch the current DB state takes, and that matters here:
    //   - Full-pass branch (a 'rolling' episode exists): stripping its
    //     process.exit(0) leaves runSelfCheck() returning normally with
    //     nothing left to call exit -- the historical bug's exact shape, a
    //     true silent hang (still alive, DB pool open, past the threshold).
    //   - Skip-pass branch (no 'rolling' episode, e.g. the isolated CI
    //     database): stripping ITS process.exit(0) does not hang at all --
    //     execution falls through into code guarded by that early return
    //     (`currentRows.rows[0]` access assuming a row exists), which throws
    //     and is caught by the script's own top-level `.catch(...)`, calling
    //     `process.exit(1)` almost immediately. No hang, but also no longer
    //     the clean `status === 0` the real guard's normal mode requires --
    //     confirmed live: this is what running against the isolated
    //     no-rolling-episode CI fixture database actually produces.
    // Both shapes are "detected" in the sense that matters: the real
    // normal-mode guard above would fail one of its four assertions (signal,
    // status, elapsed, or the success marker) either way. Only requiring a
    // hang here made this self-check deterministically fail against the CI
    // fixture database, where the skip-pass branch is always the one taken.
    console.log('  Running mutated sandbox copy (process.exit(0) calls removed)...');
    const mutatedRun = runSelfCheckScript(sandboxScriptPath, MUTATED_SPAWN_TIMEOUT_MS);
    console.log(`  Mutated elapsed: ${mutatedRun.elapsedMs}ms, status: ${mutatedRun.status}, signal: ${mutatedRun.signal ?? 'none'}`);

    const detectedAsRegression =
      mutatedRun.signal !== null || mutatedRun.elapsedMs >= HANG_THRESHOLD_MS || mutatedRun.status !== 0;
    assert(
      detectedAsRegression,
      'removing process.exit(0) makes the guard detect a regression (hang past the threshold, a kill signal, or a non-zero exit)',
      `signal=${mutatedRun.signal}, status=${mutatedRun.status}, elapsed=${mutatedRun.elapsedMs}ms -- expected either a hang past ${HANG_THRESHOLD_MS}ms or a non-zero exit status`,
    );
    assert(
      sawSuccessOutcome(mutatedRun.stdout),
      'the hang is silent -- mutated copy still printed success before it hung',
      `Neither "${SUCCESS_MARKER_FULL_PASS}" nor "${SUCCESS_MARKER_SKIP_PASS}" found in stdout:\n${mutatedRun.stdout}`,
    );
  } finally {
    sandbox.cleanup();
  }

  console.log(`\n=== Self-check results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    console.error('[SELF-CHECK] FAIL -- the hang guard would not catch a reintroduced regression.');
    process.exit(1);
  }
  console.log('[SELF-CHECK] PASS -- guard is real.\n');
  process.exit(0);
}

if (IS_SELF_CHECK) {
  runSelfCheck();
} else {
  runNormalCheck();
}
