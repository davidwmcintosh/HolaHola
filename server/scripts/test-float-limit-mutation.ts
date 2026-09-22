/**
 * Mutation sentinel for the float-limit HTTP tests.
 *
 * This script verifies that the float-limit integration tests in
 * server/__tests__/absence-history-limit-http.test.ts ACTUALLY FAIL when the
 * regression they guard (parseInt → parseFloat) is introduced.
 *
 * Steps
 * -----
 * 1. Build a private sandbox copy of the handler and the test file that
 *    imports it (see source-mutation-sandbox.ts) — the real, shared
 *    server/routes/absence-nudges-history.ts is never written to, so a
 *    concurrently-running CI batch, another manual test invocation, or
 *    another `gate` run sharing this working tree can never observe a
 *    half-mutated file.
 * 2. Swap `parseInt(` → `parseFloat(` on the limit-parsing line, in the
 *    sandbox copy only.
 * 3. Run only the float-limit describe block against the sandbox copy.
 * 4. Assert the test run exited with a non-zero code (i.e. tests failed).
 * 5. Discard the sandbox (finally block).
 *
 * The test file imports the handler via a relative path
 * (`../routes/absence-nudges-history.js`), so the sandbox mirrors both
 * files at matching relative nesting — a real, independent copy, not a
 * symlink, is required for the mutation to actually be picked up.
 *
 * Exit codes
 * ----------
 *   0 — mutation produced failures as expected  ✓
 *   1 — mutation did NOT produce failures (tests passed → false confidence!)
 *   2 — the sentinel itself errored
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { createShadowTreeSandbox } from './source-mutation-sandbox';

const CANONICAL_HANDLER_PATH = 'server/routes/absence-nudges-history.ts';
const HANDLER_RELATIVE = CANONICAL_HANDLER_PATH;
const TEST_FILE_RELATIVE = 'server/__tests__/absence-history-limit-http.test.ts';

const ORIGINAL_EXPR = 'parseInt(req.query.limit as string, 10)';
const MUTANT_EXPR   = 'parseFloat(req.query.limit as string)';

function log(msg: string) {
  console.log(`[float-limit-mutation] ${msg}`);
}

const sandbox = createShadowTreeSandbox([HANDLER_RELATIVE, TEST_FILE_RELATIVE]);

try {
  const handlerSandboxPath = sandbox.files[HANDLER_RELATIVE];
  const testFileSandboxPath = sandbox.files[TEST_FILE_RELATIVE];

  const original = fs.readFileSync(handlerSandboxPath, 'utf8');

  if (!original.includes(ORIGINAL_EXPR)) {
    console.error(
      `[float-limit-mutation] SENTINEL ERROR: expected expression not found in ${CANONICAL_HANDLER_PATH}.\n` +
      `  Looking for: ${ORIGINAL_EXPR}\n` +
      `  If the handler was refactored, update this script and the test to match.`,
    );
    process.exitCode = 2;
  } else {
    const mutant = original.replace(ORIGINAL_EXPR, MUTANT_EXPR);

    log(`Applying mutation to sandbox copy: ${ORIGINAL_EXPR}  →  ${MUTANT_EXPR}`);
    fs.writeFileSync(handlerSandboxPath, mutant, 'utf8');

    let mutantTestsFailed: boolean;
    try {
      log(`Running float-limit tests against the mutated sandbox handler …`);
      // Run only the float-limit describe block via the --test-name-pattern flag.
      // Node test runner exits 1 when any test fails.
      execSync(
        `npx tsx --test --test-name-pattern "float limit" ${testFileSandboxPath}`,
        { stdio: 'pipe' },
      );
      // If we reach here the tests PASSED — that is the wrong outcome.
      mutantTestsFailed = false;
    } catch {
      // Non-zero exit = tests failed = correct outcome for this sentinel.
      mutantTestsFailed = true;
    }

    if (mutantTestsFailed) {
      log('✓ PASS — float-limit tests correctly FAILED on the parseInt→parseFloat mutation.');
      log('  The tests are a genuine regression guard.');
      process.exitCode = 0;
    } else {
      console.error(
        '[float-limit-mutation] ✗ FAIL — float-limit tests PASSED on the mutant.\n' +
        '  This means the tests would NOT catch the parseInt→parseFloat regression.\n' +
        '  Investigate absence-history-limit-http.test.ts and/or the handler.',
      );
      process.exitCode = 1;
    }
  }
} finally {
  sandbox.cleanup();
}
