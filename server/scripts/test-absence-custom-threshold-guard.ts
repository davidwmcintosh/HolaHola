/**
 * test-absence-custom-threshold-guard.ts
 *
 * Meta-test: confirms that the absence-custom-threshold test suite is both
 * wired into CI (npm test) AND that it actually fails when the filter logic
 * is deliberately broken.
 *
 * Two checks:
 *
 *   PART 1 — Static: verify the suite file is listed in package.json's "test"
 *             script so it runs on every push.
 *
 *   PART 2 — Mutation: copy the test file, invert the critical threshold guard
 *             (`daysSince < customThreshold` → `daysSince >= customThreshold`),
 *             run the mutated copy, and assert that it exits non-zero.  A zero
 *             exit would mean the test assertions are too weak to catch the
 *             most obvious breakage of the production filter.
 *
 *   PART 3 — Confirm the real (unmodified) suite still passes.
 *
 * Run: npx tsx server/scripts/test-absence-custom-threshold-guard.ts
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const B = (s: string) => `\x1b[34m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;
const sep = () => console.log('\n' + '─'.repeat(70));

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ${G('✓')} ${label}`);
    passed++;
  } else {
    console.log(`  ${R('✗')} ${label}${detail ? `\n       ${detail}` : ''}`);
    failed++;
  }
}

const TEST_FILE   = resolve(__dirname, '../__tests__/absence-custom-threshold.test.ts');
const MUTANT_FILE = resolve(__dirname, '../__tests__/absence-custom-threshold.MUTANT.test.ts');
const PKG_FILE    = resolve(__dirname, '../../package.json');

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — package.json wiring check
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 1 — package.json wiring: suite is listed in npm test'));
sep();

function runPart1() {
  const pkg = JSON.parse(readFileSync(PKG_FILE, 'utf-8'));
  const testScript: string = pkg?.scripts?.test ?? '';

  assert(
    'package.json "test" script is non-empty',
    testScript.length > 0,
    testScript || '(empty)',
  );

  const suiteRef = 'server/__tests__/absence-custom-threshold.test.ts';
  assert(
    `"${suiteRef}" is listed in npm test`,
    testScript.includes(suiteRef),
    testScript.includes(suiteRef)
      ? undefined
      : `Not found in: ${testScript.slice(0, 200)}…`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Mutation test: broken filter → suite must exit non-zero
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Mutation: invert `daysSince < customThreshold` → tests must fail'));
sep();

function runPart2() {
  const original = readFileSync(TEST_FILE, 'utf-8');

  // Verify the critical guard exists in the test's inline replica before mutating
  const guardPattern = /daysSince < customThreshold/;
  assert(
    'Source guard `daysSince < customThreshold` exists in the test file',
    guardPattern.test(original),
    guardPattern.test(original) ? undefined : 'Pattern not found — test may have drifted from production filter',
  );

  if (!guardPattern.test(original)) {
    console.log(Y('  ⚠  Skipping mutation run — guard not found, cannot mutate safely.'));
    return;
  }

  // Build the mutant: replace `daysSince < customThreshold` with `daysSince >= customThreshold`
  // This inverts the exclusion logic — students BELOW the threshold are now INCLUDED and
  // students AT OR ABOVE it are EXCLUDED — the exact opposite of the contract.
  const mutant = original.replace(
    /daysSince < customThreshold/g,
    'daysSince >= customThreshold',
  );

  assert(
    'Mutation successfully applied (pattern replaced)',
    mutant !== original,
  );

  // Write mutant to a temp file (sibling of the real test)
  try {
    writeFileSync(MUTANT_FILE, mutant, 'utf-8');
  } catch (err: any) {
    assert('Mutant file written', false, err.message);
    return;
  }

  console.log(Y(`  ℹ  Mutant written to: ${MUTANT_FILE}`));
  console.log(Y('  ℹ  Running mutant test (expect non-zero exit)…'));

  // Run the mutant with node:test via tsx
  const result = spawnSync(
    'npx', ['tsx', '--test', MUTANT_FILE],
    {
      encoding: 'utf-8',
      timeout: 30_000,
      cwd: resolve(__dirname, '../../'),
    },
  );

  // Always clean up the mutant file
  try { unlinkSync(MUTANT_FILE); } catch { /* ignore */ }

  const exitCode = result.status ?? -1;
  const stdoutSnippet = (result.stdout ?? '').slice(-400);
  const stderrSnippet = (result.stderr ?? '').slice(-200);

  console.log(Y(`  ℹ  Mutant exit code: ${exitCode}`));
  if (stdoutSnippet) {
    console.log(Y(`  ℹ  Mutant stdout tail:\n${stdoutSnippet.split('\n').map(l => `       ${l}`).join('\n')}`));
  }
  if (stderrSnippet) {
    console.log(Y(`  ℹ  Mutant stderr tail:\n${stderrSnippet.split('\n').map(l => `       ${l}`).join('\n')}`));
  }

  assert(
    'Mutant suite exits non-zero (broken filter is caught by the tests)',
    exitCode !== 0,
    exitCode === 0
      ? 'Exit code was 0 — the tests did NOT catch the inverted filter; assertions are too weak.'
      : undefined,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Real suite still passes
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Real (unmodified) test suite passes'));
sep();

function runPart3() {
  console.log(Y('  ℹ  Running real absence-custom-threshold.test.ts…'));

  const result = spawnSync(
    'npx', ['tsx', '--test', TEST_FILE],
    {
      encoding: 'utf-8',
      timeout: 30_000,
      cwd: resolve(__dirname, '../../'),
    },
  );

  const exitCode = result.status ?? -1;
  const stdoutSnippet = (result.stdout ?? '').slice(-600);

  console.log(Y(`  ℹ  Real suite exit code: ${exitCode}`));
  if (stdoutSnippet) {
    console.log(Y(`  ℹ  Real suite output tail:\n${stdoutSnippet.split('\n').map(l => `       ${l}`).join('\n')}`));
  }

  assert(
    'Real suite exits 0 (all threshold contract tests pass)',
    exitCode === 0,
    exitCode !== 0
      ? `Exit code ${exitCode}; check output above for failing tests.`
      : undefined,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 4 — Static source check: production filter still has the expected shape
//
// Reads daniela-absence-worker.ts and asserts that the key expressions from
// the eligibleStudents filter block are still present in the production file.
// If they drift (e.g. someone renames the comparison or removes the blocked-
// user guard) this check fails immediately, alerting that the inline replica
// in the test file is now out of sync with production.
//
// Expressions verified:
//   • `daysSince < customThreshold`   — the per-student threshold comparison
//   • `blockedUserIds.has(s.userId)`  — the blocked-user exclusion guard
//   • `configMap.get(s.userId)`       — the per-user config lookup
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 4 — Static source check: production filter shape has not drifted'));
sep();

const PRODUCTION_FILE = resolve(__dirname, '../services/daniela-absence-worker.ts');

function runPart4() {
  let productionSource: string;
  try {
    productionSource = readFileSync(PRODUCTION_FILE, 'utf-8');
  } catch (err: any) {
    assert('Production file readable', false, `Could not read ${PRODUCTION_FILE}: ${err.message}`);
    return;
  }

  assert(
    'Production file is non-empty',
    productionSource.length > 0,
  );

  // The critical threshold comparison — `daysSince < customThreshold` must appear
  // in the production filter block.  If someone changes this to `<=`, `>`, or any
  // other operator the test replica drifts and these tests no longer guard the real
  // production behaviour.
  const thresholdComparison = /daysSince < customThreshold/;
  assert(
    'Production filter uses `daysSince < customThreshold` (threshold comparison intact)',
    thresholdComparison.test(productionSource),
    thresholdComparison.test(productionSource)
      ? undefined
      : 'Expression not found in daniela-absence-worker.ts — production filter may have changed; update the test replica to match.',
  );

  // The blocked-user guard must remain in the filter.  If it is removed or renamed
  // the inline replica in the test file will no longer reflect production behaviour.
  const blockedGuard = /blockedUserIds\.has\(s\.userId\)/;
  assert(
    'Production filter uses `blockedUserIds.has(s.userId)` (blocked-user guard intact)',
    blockedGuard.test(productionSource),
    blockedGuard.test(productionSource)
      ? undefined
      : 'Expression not found in daniela-absence-worker.ts — blocked-user guard may have changed; update the test replica to match.',
  );

  // The per-user config lookup — `configMap.get(s.userId)` — must be present.
  // This is the lookup that retrieves the student's custom threshold from the map.
  const configLookup = /configMap\.get\(s\.userId\)/;
  assert(
    'Production filter uses `configMap.get(s.userId)` (per-user config lookup intact)',
    configLookup.test(productionSource),
    configLookup.test(productionSource)
      ? undefined
      : 'Expression not found in daniela-absence-worker.ts — configMap lookup may have changed; update the test replica to match.',
  );

  // Cross-check: the same three expressions must also be present in the test replica.
  // If they diverge, the inline copy is stale.
  let testSource: string;
  try {
    testSource = readFileSync(TEST_FILE, 'utf-8');
  } catch (err: any) {
    assert('Test file readable for cross-check', false, `Could not read ${TEST_FILE}: ${err.message}`);
    return;
  }

  assert(
    'Test replica also contains `daysSince < customThreshold` (replica matches production)',
    thresholdComparison.test(testSource),
    thresholdComparison.test(testSource)
      ? undefined
      : 'Expression missing from the test file — the inline replica has drifted; restore the expression.',
  );

  assert(
    'Test replica also contains `blockedUserIds.has(s.userId)` (replica matches production)',
    blockedGuard.test(testSource),
    blockedGuard.test(testSource)
      ? undefined
      : 'Expression missing from the test file — the inline replica has drifted; restore the expression.',
  );

  assert(
    'Test replica also contains `configMap.get(s.userId)` (replica matches production)',
    configLookup.test(testSource),
    configLookup.test(testSource)
      ? undefined
      : 'Expression missing from the test file — the inline replica has drifted; restore the expression.',
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

try {
  runPart1();
  runPart2();
  runPart3();
  runPart4();
} catch (err: any) {
  // Ensure mutant file is cleaned up even on unexpected crash
  if (existsSync(MUTANT_FILE)) { try { unlinkSync(MUTANT_FILE); } catch { /* ignore */ } }
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
}

sep();
const all = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓  All ${all} assertions passed.\n`));
  console.log(G('   • absence-custom-threshold.test.ts is wired into npm test\n'));
  console.log(G('   • The suite catches a broken filter (non-zero exit on mutation)\n'));
  console.log(G('   • The real suite is clean\n'));
  console.log(G('   • Production filter shape matches the test replica (no silent drift)\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
  process.exit(1);
}
