/**
 * test-retrieve-episode-dialogue-no-match-by-id.ts
 *
 * CI check: confirms that retrieve-episode-dialogue.ts exits 2 and prints a
 * visible "NO RECORDS FOUND" banner when --id points to a UUID that does not
 * exist in conversation_memories.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Why this matters
 * ─────────────────────────────────────────────────────────────────────────────
 * The holahola-session-end Pre-step 0.25 can invoke retrieve-episode-dialogue.ts
 * with a specific --id.  If the loud-failure guard silently regressed on that
 * path (while the tags+date-range path still worked), Luca could proceed to
 * reconstruct dialogue from memory when the requested row is absent.
 *
 * The existing test-retrieve-episode-dialogue-no-match.ts only exercises the
 * tags+date-range path.  This file closes the gap by exercising the --id path
 * in isolation.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Normal mode
 * ─────────────────────────────────────────────────────────────────────────────
 *   1. Runs the retrieval script with --id 00000000-0000-0000-0000-000000000000
 *      (the nil UUID — guaranteed absent from any real DB).
 *   2. Asserts exit code is 2.
 *   3. Asserts stderr contains the "NO RECORDS FOUND" banner.
 *   4. Asserts stderr contains the ⛔ "Do NOT proceed" guard phrase.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * Self-check mode  (--self-check)
 * ─────────────────────────────────────────────────────────────────────────────
 * Proves this CI test would catch a regression that silences the --id guard.
 *
 * Phase A — inject a broken stub that exits 0 silently when --id is used:
 *   1. Writes a temporary stub to /tmp that mimics a regressed script — it
 *      finds --id in argv, prints nothing to stderr, and exits 0.
 *   2. Runs the full set of assertions against this stub.
 *   3. Asserts every assertion fails (if any pass, this check has a blind spot).
 *   4. Cleans up the stub.
 *
 * Phase B — confirm the real script passes all assertions.
 *
 * Run:
 *   npx tsx server/scripts/test-retrieve-episode-dialogue-no-match-by-id.ts
 *   npx tsx server/scripts/test-retrieve-episode-dialogue-no-match-by-id.ts --self-check
 *
 * Exit codes:
 *   0  — all assertions passed (or self-check confirmed guard is active)
 *   1  — assertion(s) failed
 */

import { spawnSync } from 'child_process';
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

// The nil UUID — guaranteed to never exist in conversation_memories.
const NIL_UUID = '00000000-0000-0000-0000-000000000000';

const REAL_SCRIPT = join(process.cwd(), 'server/scripts/retrieve-episode-dialogue.ts');

// Path to the stub used only in self-check Phase A.
const STUB_PATH = '/tmp/test-retrieve-episode-stub-id-silent.ts';

// Expected markers in stderr.
const NEEDLE_BANNER        = 'NO RECORDS FOUND';
const NEEDLE_GUARD         = 'Do NOT proceed';
const EXPECTED_EXIT_CODE   = 2;

// ── Broken stub (self-check Phase A) ─────────────────────────────────────
//
// Mimics a regressed retrieve-episode-dialogue.ts on the --id path:
// it detects --id in argv, writes nothing to stderr, and exits 0.
// Every assertion in runAssertions() must FAIL against this stub.

const SILENT_STUB_SOURCE = `
// Silently broken stub — detects --id, exits 0 with no banner.
// Used only by the self-check to prove CI assertions detect the regression.

const argv = process.argv.slice(2);
let id = '';
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--id' && argv[i + 1]) { id = argv[++i]; continue; }
}
// If --id was supplied, silently succeed (the regression).
if (id) {
  process.stdout.write('');
  process.exit(0);
}
// Fall through for other invocations.
process.exit(0);
`;

// ── Run helper ────────────────────────────────────────────────────────────

interface RunResult { exitCode: number; stdout: string; stderr: string; }

function runScript(scriptPath: string): RunResult {
  const result = spawnSync(
    'npx',
    ['tsx', scriptPath, '--id', NIL_UUID],
    {
      encoding: 'utf8',
      timeout: 30_000,
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

interface AssertResult {
  passCount: number;
  failCount: number;
  details: Array<{ passed: boolean; label: string }>;
}

function runAssertions(run: RunResult): AssertResult {
  const details: Array<{ passed: boolean; label: string }> = [];

  // Assertion 1: Exit code must be 2.
  const a1 = run.exitCode === EXPECTED_EXIT_CODE;
  details.push({ passed: a1, label: `Exit code is ${EXPECTED_EXIT_CODE} (expected) — got ${run.exitCode}` });

  // Assertion 2: stderr must contain the "NO RECORDS FOUND" banner.
  const a2 = run.stderr.includes(NEEDLE_BANNER);
  details.push({ passed: a2, label: `stderr contains "${NEEDLE_BANNER}" banner` });

  // Assertion 3: stderr must contain the ⛔ guard phrase.
  const a3 = run.stderr.includes(NEEDLE_GUARD);
  details.push({ passed: a3, label: `stderr contains "${NEEDLE_GUARD}" guard` });

  return {
    passCount: details.filter(d => d.passed).length,
    failCount: details.filter(d => !d.passed).length,
    details,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const selfCheck = process.argv.includes('--self-check');

  console.log(B('\n══ Episode Retrieval --id No-Match CI Check ══\n'));
  if (selfCheck) {
    console.log(Y('  Mode: self-check — hermetic proof the exit-2 + banner guards fire on the --id path\n'));
  }
  sep();
  info(`Real script   : ${REAL_SCRIPT}`);
  info(`Nil UUID      : ${NIL_UUID}`);
  info(`Expected exit : ${EXPECTED_EXIT_CODE}`);
  sep();
  console.log('');

  let totalFailures = 0;

  if (!selfCheck) {
    // ── Normal mode ───────────────────────────────────────────────────────
    console.log(B(`Running retrieve-episode-dialogue.ts --id ${NIL_UUID}...\n`));
    const run = runScript(REAL_SCRIPT);

    if (process.argv.includes('--verbose')) {
      console.log('  stdout:', run.stdout.slice(0, 300) || '(empty)');
      console.log('  stderr:', run.stderr.slice(0, 300) || '(empty)');
      console.log('');
    }

    const { details, failCount } = runAssertions(run);
    for (const d of details) {
      if (d.passed) pass(d.label);
      else { fail(d.label); totalFailures++; }
    }

    if (failCount === 0) {
      console.log('');
      pass('All assertions passed — loud failure fires on the --id path.');
    }

  } else {
    // ── Self-check mode ───────────────────────────────────────────────────

    // Phase A ─────────────────────────────────────────────────────────────
    console.log(B('Phase A — inject broken (silent exit-0) stub:\n'));
    info('Writing silent-exit-0 stub to ' + STUB_PATH);
    writeFileSync(STUB_PATH, SILENT_STUB_SOURCE, 'utf8');

    console.log('');
    info('Running CI assertions against the broken stub...\n');
    const runA = runScript(STUB_PATH);

    const resA = runAssertions(runA);
    let phaseAOk = true;

    for (const d of resA.details) {
      if (!d.passed) {
        pass(`[as expected] Assertion FAILS against stub: "${d.label}"`);
      } else {
        fail(`[BLIND SPOT] Assertion passes against broken stub: "${d.label}"`);
        fail(`  → A regressed script on the --id path would NOT be caught by this assertion.`);
        totalFailures++;
        phaseAOk = false;
      }
    }

    try { unlinkSync(STUB_PATH); } catch {}

    if (phaseAOk) {
      console.log('');
      pass(`Phase A complete — all ${resA.details.length} assertions correctly fail against the broken stub.`);
      info('A regressed --id path that silently exits 0 WILL be caught.');
    } else {
      console.log('');
      fail('Phase A INCOMPLETE — some assertions passed against the broken stub (blind spots above).');
    }

    // Phase B ─────────────────────────────────────────────────────────────
    console.log('');
    sep();
    console.log('');
    console.log(B('Phase B — confirm real script passes all assertions:\n'));
    info(`Running retrieve-episode-dialogue.ts --id ${NIL_UUID}...\n`);
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
      pass('Phase B complete — real script fails loudly on --id with missing row.');
    }
  }

  // ── Result ────────────────────────────────────────────────────────────

  console.log('');
  sep();
  console.log('');

  if (totalFailures === 0) {
    if (selfCheck) {
      console.log(G('Self-check PASSED') + ' — Phase A: broken stub caught by all 3 assertions.');
      console.log('                    Phase B: real script fails loudly on missing --id row.');
    } else {
      console.log(G('PASSED') + ' — retrieve-episode-dialogue.ts fails loudly (exit 2 + banner + guard)');
      console.log('         when --id points to a non-existent row.');
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
