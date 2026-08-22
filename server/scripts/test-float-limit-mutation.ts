/**
 * Mutation sentinel for the float-limit HTTP tests.
 *
 * This script verifies that the float-limit integration tests in
 * server/__tests__/absence-history-limit-http.test.ts ACTUALLY FAIL when the
 * regression they guard (parseInt → parseFloat) is introduced.
 *
 * Steps
 * -----
 * 1. Read the real handler source.
 * 2. Swap `parseInt(` → `parseFloat(` on the limit-parsing line.
 * 3. Write the mutated file.
 * 4. Run only the float-limit describe block.
 * 5. Assert the test run exited with a non-zero code (i.e. tests failed).
 * 6. Restore the original source unconditionally (finally block).
 *
 * Exit codes
 * ----------
 *   0 — mutation produced failures as expected  ✓
 *   1 — mutation did NOT produce failures (tests passed → false confidence!)
 *   2 — the sentinel itself errored
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const HANDLER = 'server/routes/absence-nudges-history.ts';
const TEST_FILE = 'server/__tests__/absence-history-limit-http.test.ts';

const ORIGINAL_EXPR = 'parseInt(req.query.limit as string, 10)';
const MUTANT_EXPR   = 'parseFloat(req.query.limit as string)';

function log(msg: string) {
  console.log(`[float-limit-mutation] ${msg}`);
}

const original = fs.readFileSync(HANDLER, 'utf8');

if (!original.includes(ORIGINAL_EXPR)) {
  console.error(
    `[float-limit-mutation] SENTINEL ERROR: expected expression not found in ${HANDLER}.\n` +
    `  Looking for: ${ORIGINAL_EXPR}\n` +
    `  If the handler was refactored, update this script and the test to match.`,
  );
  process.exit(2);
}

const mutant = original.replace(ORIGINAL_EXPR, MUTANT_EXPR);

log(`Applying mutation: ${ORIGINAL_EXPR}  →  ${MUTANT_EXPR}`);
fs.writeFileSync(HANDLER, mutant, 'utf8');

let mutantTestsFailed = false;

try {
  log(`Running float-limit tests against the mutated handler …`);
  try {
    // Run only the float-limit describe block via the --test-name-pattern flag.
    // Node test runner exits 1 when any test fails.
    execSync(
      `npx tsx --test --test-name-pattern "float limit" ${TEST_FILE}`,
      { stdio: 'pipe' },
    );
    // If we reach here the tests PASSED — that is the wrong outcome.
    mutantTestsFailed = false;
  } catch {
    // Non-zero exit = tests failed = correct outcome for this sentinel.
    mutantTestsFailed = true;
  }
} finally {
  log('Restoring original handler …');
  fs.writeFileSync(HANDLER, original, 'utf8');
  log('Handler restored.');
}

if (mutantTestsFailed) {
  log('✓ PASS — float-limit tests correctly FAILED on the parseInt→parseFloat mutation.');
  log('  The tests are a genuine regression guard.');
  process.exit(0);
} else {
  console.error(
    '[float-limit-mutation] ✗ FAIL — float-limit tests PASSED on the mutant.\n' +
    '  This means the tests would NOT catch the parseInt→parseFloat regression.\n' +
    '  Investigate absence-history-limit-http.test.ts and/or the handler.',
  );
  process.exit(1);
}
