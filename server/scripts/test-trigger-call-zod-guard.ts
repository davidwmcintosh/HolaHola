/**
 * Self-check: confirm the trigger-call Zod guard test actually fails
 * when resolutionTypeSchema.safeParse is removed from the handler.
 *
 * Steps:
 *  1. Read server/routes.ts and locate the safeParse block.
 *  2. Comment it out (mutation) — on a private sandbox copy only.
 *  3. Run the test suite — expect the route-wiring assertions to FAIL.
 *  4. Discard the sandbox.
 *  5. Exit 0 only when the mutated run produced at least one failure.
 *
 * The mutation NEVER touches the real, shared server/routes.ts on disk. It
 * runs inside a private temp-directory sandbox copy (see
 * source-mutation-sandbox.ts) so a concurrently-running CI batch, another
 * manual test invocation, or another `gate` run sharing this working tree
 * can never observe a half-mutated file — server/routes.ts is imported by
 * the running application itself, so a concurrent reader mid-mutation is
 * not limited to causing test flakes.
 *
 * resolution-type-zod.test.ts only reads server/routes.ts and
 * server/routes/absence-nudges-history.ts as raw TEXT (never imports them
 * as modules), resolving both paths relative to `process.cwd()`. So the
 * sandbox here only needs a plain snapshot of those two files with matching
 * relative nesting, and the test is run with its `cwd` pointed at that
 * sandbox — the real, unmodified test file itself is run directly from its
 * real location.
 *
 * Register as a CI workflow:
 *   npx tsx server/scripts/test-trigger-call-zod-guard.ts
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTextSnapshotSandbox, REPO_ROOT } from './source-mutation-sandbox';

const CANONICAL_ROUTES_PATH = 'server/routes.ts';
const REAL_TEST_FILE = resolve(REPO_ROOT, 'server/__tests__/resolution-type-zod.test.ts');

// ── The exact block that validates resolutionType at the HTTP boundary ──────
const ORIGINAL_BLOCK = `      // Validate resolutionType at the HTTP boundary so a misspelled value never
      // reaches the database (which would surface as a confusing CHECK-constraint 500).
      if (resolutionType !== undefined && resolutionType !== null) {
        const parsed = resolutionTypeSchema.safeParse(resolutionType);
        if (!parsed.success) {
          return res.status(400).json({
            error: 'Invalid resolutionType',
            details: parsed.error.issues,
          });
        }
      }`;

// NOTE: The mutated block must NOT contain the literal string
// "resolutionTypeSchema.safeParse" or "status(400)" because the test checks
// for those exact tokens via a string-search on routes.ts.  Leaving them in
// comments would make the test pass even though the guard is absent.
const MUTATED_BLOCK = `      // [MUTATED for self-check: Zod guard removed — do not ship]`;

function runTest(sandboxRoot: string): { passed: boolean; output: string } {
  try {
    // cwd = sandbox root so the test's own process.cwd()-relative
    // fs.readFileSync() calls resolve into the sandbox snapshot instead of
    // the real repo. The test file itself runs from its real, unmodified
    // location -- it is never copied or mutated.
    const output = execSync(`npx tsx --test ${REAL_TEST_FILE}`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: sandboxRoot,
    });
    return { passed: true, output };
  } catch (err: any) {
    // execSync throws when the process exits non-zero
    const output: string = (err.stdout ?? '') + (err.stderr ?? '');
    return { passed: false, output };
  }
}

function main(): void {
  console.log('[self-check] Reading routes.ts …');
  const original = readFileSync(resolve(REPO_ROOT, CANONICAL_ROUTES_PATH), 'utf-8');

  if (!original.includes(ORIGINAL_BLOCK)) {
    console.error(
      '[self-check] ERROR: Could not locate the safeParse block in routes.ts.\n' +
        'The block may have been moved or reformatted. Update ORIGINAL_BLOCK in this script.',
    );
    process.exitCode = 2;
    return;
  }

  // resolution-type-zod.test.ts reads both server/routes.ts and
  // server/routes/absence-nudges-history.ts as text, so the sandbox needs a
  // snapshot of both even though only routes.ts gets mutated.
  const sandbox = createTextSnapshotSandbox([
    CANONICAL_ROUTES_PATH,
    'server/routes/absence-nudges-history.ts',
  ]);
  const sandboxRoutesPath = sandbox.files[CANONICAL_ROUTES_PATH];

  try {
    // ── Step 1: Baseline — test must PASS on the unmodified sandbox copy ──
    console.log('\n[self-check] Step 1: baseline run (expect PASS) …');
    const baseline = runTest(sandbox.root);
    if (!baseline.passed) {
      console.error(
        '[self-check] ABORT: baseline run already fails — fix the test or the handler before running this self-check.\n',
        baseline.output,
      );
      process.exitCode = 2;
      return;
    }
    console.log('[self-check] Baseline passed ✓');

    // ── Step 2: Mutate the sandbox copy — comment out the safeParse block ──
    console.log('\n[self-check] Step 2: mutating the sandbox copy of routes.ts (removing safeParse block) …');
    const mutated = original.replace(ORIGINAL_BLOCK, MUTATED_BLOCK);
    writeFileSync(sandboxRoutesPath, mutated, 'utf-8');

    // ── Step 3: Run the test — it MUST fail now ────────────────────────────
    console.log('[self-check] Step 3: running test against mutated sandbox copy (expect FAIL) …');
    let mutatedResult: { passed: boolean; output: string };
    try {
      mutatedResult = runTest(sandbox.root);
    } finally {
      // Restore the sandbox copy (not the real file -- it was never
      // touched). Not strictly required since the whole sandbox is
      // discarded below, but keeps this script's structure obviously safe.
      console.log('\n[self-check] Step 4: restoring the sandbox copy of routes.ts …');
      writeFileSync(sandboxRoutesPath, original, 'utf-8');
      console.log('[self-check] sandbox copy restored ✓');
    }

    // ── Step 5: Verify the mutated run DID fail ────────────────────────────
    console.log('\n[self-check] Mutated-run output:\n' + mutatedResult!.output.slice(0, 4000));

    if (mutatedResult!.passed) {
      console.error(
        '\n[self-check] SELF-CHECK FAILED: the route-wiring test PASSED even without safeParse.\n' +
          'The test is not catching the absence of the guard — investigate the assertion logic.',
      );
      process.exitCode = 1;
      return;
    }

    // Confirm the specific route-wiring assertions were the ones that failed
    const output = mutatedResult!.output;
    const routeWiringFailed =
      output.includes('resolutionTypeSchema.safeParse') ||
      output.includes('trigger-call handler calls') ||
      output.includes('trigger-call handler returns 400') ||
      output.includes('not ok') ||
      output.includes('AssertionError');

    if (!routeWiringFailed) {
      console.error(
        '\n[self-check] WARNING: the run failed but the output does not mention the expected\n' +
          'route-wiring assertions. Inspect the output above to verify the right tests failed.',
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      '\n[self-check] SELF-CHECK PASSED ✓\n' +
        'The route-wiring tests correctly fail when safeParse is absent.\n' +
        'The guard is real and the test is trustworthy.',
    );
    process.exitCode = 0;
  } finally {
    sandbox.cleanup();
  }
}

main();
