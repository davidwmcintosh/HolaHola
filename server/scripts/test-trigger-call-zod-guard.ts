/**
 * Self-check: confirm the trigger-call Zod guard test actually fails
 * when resolutionTypeSchema.safeParse is removed from the handler.
 *
 * Steps:
 *  1. Read server/routes.ts and locate the safeParse block.
 *  2. Comment it out (mutation).
 *  3. Run the test suite — expect the route-wiring assertions to FAIL.
 *  4. Restore routes.ts unconditionally.
 *  5. Exit 0 only when the mutated run produced at least one failure.
 *
 * Register as a CI workflow:
 *   npx tsx server/scripts/test-trigger-call-zod-guard.ts
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROUTES_PATH = resolve(process.cwd(), 'server/routes.ts');
const TEST_CMD =
  'npx tsx --test server/__tests__/resolution-type-zod.test.ts';

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

function runTest(): { passed: boolean; output: string } {
  try {
    const output = execSync(TEST_CMD, { encoding: 'utf-8', stdio: 'pipe' });
    return { passed: true, output };
  } catch (err: any) {
    // execSync throws when the process exits non-zero
    const output: string = (err.stdout ?? '') + (err.stderr ?? '');
    return { passed: false, output };
  }
}

function main(): void {
  console.log('[self-check] Reading routes.ts …');
  const original = readFileSync(ROUTES_PATH, 'utf-8');

  if (!original.includes(ORIGINAL_BLOCK)) {
    console.error(
      '[self-check] ERROR: Could not locate the safeParse block in routes.ts.\n' +
        'The block may have been moved or reformatted. Update ORIGINAL_BLOCK in this script.',
    );
    process.exit(2);
  }

  // ── Step 1: Baseline — test must PASS on the unmodified file ────────────
  console.log('\n[self-check] Step 1: baseline run (expect PASS) …');
  const baseline = runTest();
  if (!baseline.passed) {
    console.error(
      '[self-check] ABORT: baseline run already fails — fix the test or the handler before running this self-check.\n',
      baseline.output,
    );
    process.exit(2);
  }
  console.log('[self-check] Baseline passed ✓');

  // ── Step 2: Mutate — comment out the safeParse block ────────────────────
  console.log('\n[self-check] Step 2: mutating routes.ts (removing safeParse block) …');
  const mutated = original.replace(ORIGINAL_BLOCK, MUTATED_BLOCK);
  writeFileSync(ROUTES_PATH, mutated, 'utf-8');

  // ── Step 3: Run the test — it MUST fail now ──────────────────────────────
  console.log('[self-check] Step 3: running test against mutated file (expect FAIL) …');
  let mutatedResult: { passed: boolean; output: string };
  try {
    mutatedResult = runTest();
  } finally {
    // ── Step 4: Restore unconditionally ─────────────────────────────────────
    console.log('\n[self-check] Step 4: restoring routes.ts …');
    writeFileSync(ROUTES_PATH, original, 'utf-8');
    console.log('[self-check] routes.ts restored ✓');
  }

  // ── Step 5: Verify the mutated run DID fail ──────────────────────────────
  console.log('\n[self-check] Mutated-run output:\n' + mutatedResult!.output.slice(0, 4000));

  if (mutatedResult!.passed) {
    console.error(
      '\n[self-check] SELF-CHECK FAILED: the route-wiring test PASSED even without safeParse.\n' +
        'The test is not catching the absence of the guard — investigate the assertion logic.',
    );
    process.exit(1);
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
    process.exit(1);
  }

  console.log(
    '\n[self-check] SELF-CHECK PASSED ✓\n' +
      'The route-wiring tests correctly fail when safeParse is absent.\n' +
      'The guard is real and the test is trustworthy.',
  );
  process.exit(0);
}

main();
