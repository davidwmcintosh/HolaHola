/**
 * test-retrieve-episode-dialogue-no-match.ts
 *
 * CI self-check: confirms that retrieve-episode-dialogue.ts exits non-zero
 * and prints a clear "NO RECORDS FOUND" warning when no DB rows match the
 * requested date/tag combination.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this matters
 * ─────────────────────────────────────────────────────────────────────────────
 * The holahola-episode skill (Step 2) instructs Luca to run
 * retrieve-episode-dialogue.ts before writing any dialogue into an episode
 * .md file.  If the script silently produced an empty output on zero results,
 * Luca could proceed to reconstruct dialogue from memory — exactly the failure
 * mode the DB-first process is designed to prevent.
 *
 * The script must:
 *   (a) exit non-zero (specifically exit 2) when no records match, AND
 *   (b) print a visible "NO RECORDS FOUND" banner + actionable guidance,
 *   (c) NOT create the output file on a zero-result run.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Runs the retrieval script with an impossible date (year 1970) and a
 *      sentinel tag that cannot exist in the DB.
 *   2. Asserts the process exits with code 2.
 *   3. Asserts the script's stderr contains the "NO RECORDS FOUND" banner.
 *   4. Asserts the script's stderr contains the ⛔ "Do NOT proceed" guard.
 *   5. Asserts no output file was created (script must not touch --out on
 *      zero-result runs).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 * Proves this CI test would catch a regression that silences the guard.
 *
 * The self-check is hermetic: it does NOT rely on re-running the real script
 * to "describe a hypothetical failure".  Instead it:
 *
 *   Phase A — inject the broken implementation:
 *     1. Writes a temporary stub script to /tmp that mimics a regressed
 *        retrieve-episode-dialogue.ts — one that silently exits 0 and creates
 *        an empty output file when no records match.
 *     2. Runs the full set of normal-mode assertions against this stub.
 *     3. Asserts that EVERY assertion fails (the stub is broken — the CI test
 *        must detect all four failure modes).
 *     4. Cleans up the stub.
 *
 *   Phase B — prove the real script is guarded:
 *     5. Re-runs the normal-mode assertions against the real script.
 *     6. Asserts all assertions pass.
 *
 * If Phase A reveals that any assertion passes against the broken stub, the
 * self-check itself fails — meaning the CI test has a blind spot and the
 * regression would go undetected.
 *
 * Run:
 *   npx tsx server/scripts/test-retrieve-episode-dialogue-no-match.ts
 *   npx tsx server/scripts/test-retrieve-episode-dialogue-no-match.ts --self-check
 *
 * Exit codes:
 *   0  — all assertions passed (normal) or self-check confirmed guard is active
 *   1  — assertion(s) failed
 */

import { spawnSync, execSync } from 'child_process';
import { existsSync, unlinkSync, writeFileSync } from 'fs';
import { join } from 'path';

// ── Colours ───────────────────────────────────────────────────────────────
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;

function sep() { console.log('─'.repeat(70)); }
function info(msg: string) { console.log(`  ${B('ℹ')}  ${msg}`); }
function pass(msg: string) { console.log(`  ${G('✓')}  ${msg}`); }
function fail(msg: string) { console.error(`  ${R('✗')}  ${msg}`); }

// ── Constants ─────────────────────────────────────────────────────────────

// A date guaranteed to have no conversation_memories rows.
const IMPOSSIBLE_DATE = '1970-01-01';
// A tag that cannot exist in any real episode record.
const SENTINEL_TAG = 'ci-no-match-sentinel-xyzzy-1134';
// Temporary output path checked in assertions.
const TMP_OUT = '/tmp/test-retrieve-episode-no-match-output.md';
// Path to the stub used only in self-check Phase A.
// NOTE: written as .cjs (CommonJS) and run with `node` directly so it does not
// need tsx to compile — avoids tsx /tmp startup latency that causes exit -1 and
// makes assertion 4 ("output file NOT created") pass against a broken stub.
const STUB_PATH = '/tmp/test-retrieve-episode-stub-silent-1134.cjs';

const REAL_SCRIPT = join(process.cwd(), 'server/scripts/retrieve-episode-dialogue.ts');

// Expected markers in the script's stderr output.
// These must match the actual text emitted by retrieve-episode-dialogue.ts
// when rows.length === 0 (the exit-2 branch at line ~309 of that file).
const NEEDLE_BANNER = 'NO RECORDS FOUND';
const NEEDLE_GUARD  = 'Do NOT reconstruct from memory';
const EXPECTED_EXIT_CODE = 2;

// ── Broken stub (self-check Phase A) ─────────────────────────────────────
//
// This mimics a regressed retrieve-episode-dialogue.ts that silently exits 0
// and creates an empty output file when no records match — i.e. it has NO
// loud-failure behavior at all.  Every assertion in runAssertions() must
// FAIL against this stub.
//
// Written as CommonJS so it can be executed with `node` directly — no tsx
// compilation step needed.  tsx running a .ts file from /tmp can time out
// (exit -1) before writing any file, causing assertion 4 to silently pass
// (the file is never written), turning it into an undetected blind spot.

const SILENT_STUB_SOURCE = `
// Silently broken stub — exits 0 with empty output file, no banner, no guard.
// Used only by the self-check to prove CI assertions detect the regression.
const { writeFileSync, mkdirSync } = require('fs');
const { dirname } = require('path');

const argv = process.argv.slice(2);
let out = '/tmp/episode-dialogue.md';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--out' && argv[i + 1]) { out = argv[++i]; continue; }
}
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, '', 'utf8');
process.exit(0);
`;

// ── Run helpers ───────────────────────────────────────────────────────────

interface RunResult { exitCode: number; stdout: string; stderr: string; }

/** Run a real TypeScript script via npx tsx. */
function runScript(scriptPath: string): RunResult {
  // Clean up any leftover output file before each run.
  if (existsSync(TMP_OUT)) unlinkSync(TMP_OUT);

  const result = spawnSync(
    'npx',
    [
      'tsx',
      scriptPath,
      '--since', IMPOSSIBLE_DATE,
      '--until', IMPOSSIBLE_DATE,
      '--tag',   SENTINEL_TAG,
      '--out',   TMP_OUT,
    ],
    {
      encoding: 'utf8',
      // 60s: tsx compilation + DB query can take >30s when other CI tests have
      // loaded the shared DB connection pool.  30s was consistently hitting the
      // timeout when running inside the full consolidated-ci.sh suite.
      timeout: 60_000,
      env: { ...process.env },
    }
  );

  return {
    exitCode: result.status ?? -1,
    stdout:   result.stdout ?? '',
    stderr:   result.stderr ?? '',
  };
}

/**
 * Run the self-check stub via `node` directly (no tsx compilation).
 * The stub is a .cjs file — CommonJS syntax, runs immediately without tsx.
 * Using `node` avoids tsx startup latency in /tmp that can cause the stub to
 * time out (exit -1) before writing any file, which would make assertion 4
 * ("output file NOT created") silently pass against a broken stub.
 */
function runStub(stubPath: string): RunResult {
  if (existsSync(TMP_OUT)) unlinkSync(TMP_OUT);

  const result = spawnSync(
    'node',
    [
      stubPath,
      '--since', IMPOSSIBLE_DATE,
      '--until', IMPOSSIBLE_DATE,
      '--tag',   SENTINEL_TAG,
      '--out',   TMP_OUT,
    ],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env },
    }
  );

  return {
    exitCode: result.status ?? -1,
    stdout:   result.stdout ?? '',
    stderr:   result.stderr ?? '',
  };
}

// ── Assertion runner ──────────────────────────────────────────────────────
//
// Returns the number of assertions that PASSED (not failed).
// In normal mode we want this to equal 4 (all pass).
// In self-check Phase A we want this to equal 0 (all fail = stub is broken).

interface AssertResult {
  passCount: number;
  failCount: number;
  details: Array<{ passed: boolean; label: string }>;
}

function runAssertions(run: RunResult): AssertResult {
  const details: Array<{ passed: boolean; label: string }> = [];

  // Assertion 1: Exit code must be 2 (not 0, not 1).
  const a1 = run.exitCode === EXPECTED_EXIT_CODE;
  details.push({ passed: a1, label: `Exit code is ${EXPECTED_EXIT_CODE} (expected) — got ${run.exitCode}` });

  // Assertion 2: stderr must contain the "NO RECORDS FOUND" banner.
  const a2 = run.stderr.includes(NEEDLE_BANNER);
  details.push({ passed: a2, label: `stderr contains "${NEEDLE_BANNER}" banner` });

  // Assertion 3: stderr must contain the ⛔ guard phrase.
  const a3 = run.stderr.includes(NEEDLE_GUARD);
  details.push({ passed: a3, label: `stderr contains "${NEEDLE_GUARD}" guard` });

  // Assertion 4: output file must NOT have been created.
  const fileCreated = existsSync(TMP_OUT);
  if (fileCreated) { try { unlinkSync(TMP_OUT); } catch {} }
  const a4 = !fileCreated;
  details.push({ passed: a4, label: `Output file NOT created on zero-result run` });

  return {
    passCount: details.filter(d => d.passed).length,
    failCount: details.filter(d => !d.passed).length,
    details,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const selfCheck = process.argv.includes('--self-check');

  console.log(B('\n══ Episode Retrieval No-Match CI Check ══\n'));
  if (selfCheck) {
    console.log(Y('  Mode: self-check — hermetic proof the exit-code + banner guards are active\n'));
  }
  sep();
  info(`Real script     : ${REAL_SCRIPT}`);
  info(`Impossible date : ${IMPOSSIBLE_DATE}`);
  info(`Sentinel tag    : ${SENTINEL_TAG}`);
  info(`Expected exit   : ${EXPECTED_EXIT_CODE}`);
  sep();
  console.log('');

  let totalFailures = 0;

  if (!selfCheck) {
    // ── Normal mode ───────────────────────────────────────────────────────
    console.log(B('Running retrieve-episode-dialogue.ts with impossible date/tag...\n'));
    const run = runScript(REAL_SCRIPT);

    if (process.argv.includes('--verbose')) {
      console.log('  stdout:', run.stdout.slice(0, 300) || '(empty)');
      console.log('  stderr:', run.stderr.slice(0, 300) || '(empty)');
      console.log('');
    }

    const { passCount, failCount, details } = runAssertions(run);
    for (const d of details) {
      if (d.passed) pass(d.label);
      else { fail(d.label); totalFailures++; }
    }

  } else {
    // ── Self-check mode ───────────────────────────────────────────────────
    //
    // Phase A: run assertions against the deliberately-broken silent stub.
    //          Every assertion must FAIL (stub has no exit-2, no banner, no
    //          guard, and creates an empty output file).
    //
    // Phase B: run assertions against the real script.
    //          Every assertion must PASS.

    // Phase A ─────────────────────────────────────────────────────────────
    console.log(B('Phase A — inject broken (silent exit-0) stub:\n'));
    info('Writing silent-exit-0 stub to ' + STUB_PATH);
    writeFileSync(STUB_PATH, SILENT_STUB_SOURCE, 'utf8');

    console.log('');
    info('Running CI assertions against the broken stub...\n');
    const runA = runStub(STUB_PATH);

    const resA = runAssertions(runA);
    let phaseAOk = true;

    for (const d of resA.details) {
      if (!d.passed) {
        // Good — the broken stub triggered this assertion.
        pass(`[as expected] Assertion FAILS against stub: "${d.label}"`);
      } else {
        // Bad — the assertion passes even against the broken stub → blind spot.
        fail(`[BLIND SPOT] Assertion passes against broken stub: "${d.label}"`);
        fail(`  → If a regressed script behaved this way, this CI check would NOT catch it.`);
        totalFailures++;
        phaseAOk = false;
      }
    }

    // Clean up stub.
    try { unlinkSync(STUB_PATH); } catch {}

    if (phaseAOk) {
      console.log('');
      pass(`Phase A complete — all ${resA.details.length} assertions correctly fail against the broken stub.`);
      info('A regressed retrieve-episode-dialogue.ts that silently exits 0 WILL be caught.');
    } else {
      console.log('');
      fail('Phase A INCOMPLETE — some assertions passed against the broken stub (blind spots above).');
    }

    // Phase B ─────────────────────────────────────────────────────────────
    console.log('');
    sep();
    console.log('');
    console.log(B('Phase B — confirm real script passes all assertions:\n'));
    info('Running CI assertions against the real retrieve-episode-dialogue.ts...\n');
    const runB = runScript(REAL_SCRIPT);

    const resB = runAssertions(runB);
    for (const d of resB.details) {
      if (d.passed) pass(d.label);
      else {
        fail(`Real script failed: ${d.label}`);
        totalFailures++;
      }
    }

    if (resB.failCount === 0) {
      console.log('');
      pass('Phase B complete — real script fails loudly as required.');
    }
  }

  // ── Result ────────────────────────────────────────────────────────────

  console.log('');
  sep();
  console.log('');

  if (totalFailures === 0) {
    if (selfCheck) {
      console.log(G('Self-check PASSED') + ' — Phase A: broken stub caught by all 4 assertions.');
      console.log('                    Phase B: real script fails loudly on zero results.');
    } else {
      console.log(G('PASSED') + ' — retrieve-episode-dialogue.ts fails loudly (exit 2 + banner + guard)');
      console.log('         when no DB records match the requested date/tag combination.');
    }
    console.log('');
    process.exit(0);
  } else {
    if (selfCheck) {
      console.error(R(`Self-check FAILED`) + ` (${totalFailures} problem(s) — see details above).`);
    } else {
      console.error(R(`FAILED`) + ` (${totalFailures} assertion(s) wrong).`);
    }
    console.error('');
    process.exit(1);
  }
}

main().catch((err: any) => {
  console.error(R(`\nFATAL: ${err?.message ?? err}`));
  console.error(err?.stack ?? '');
  process.exit(1);
});
