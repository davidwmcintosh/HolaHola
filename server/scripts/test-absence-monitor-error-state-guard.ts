/**
 * test-absence-monitor-error-state-guard.ts
 *
 * Meta-test: confirms that the absence-monitor-error-state test suite is both
 * wired into CI (npm test) AND that it actually fails when a `?? 0` guard is
 * deliberately removed from the inline card-expression replica.
 *
 * Three parts:
 *
 *   PART 1 — Static: verify the suite file is listed in package.json's "test"
 *             script so it runs on every push.
 *
 *   PART 2 — Mutation: copy the test file, strip one `?? 0` guard from the
 *             inline card-value expression (simulating a regression in
 *             AbsenceMonitorTab where the guard is deleted), run the mutated
 *             copy, and assert that it exits non-zero.  A zero exit would mean
 *             the assertions are too weak to catch the removal of the guard.
 *
 *   PART 3 — Confirm the real (unmodified) suite still passes.
 *
 * Run: npx tsx server/scripts/test-absence-monitor-error-state-guard.ts
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

const TEST_FILE   = resolve(__dirname, '../__tests__/absence-monitor-error-state.test.ts');
const MUTANT_FILE = resolve(__dirname, '../__tests__/absence-monitor-error-state.MUTANT.test.ts');
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

  const suiteRef = 'server/__tests__/absence-monitor-error-state.test.ts';
  assert(
    `"${suiteRef}" is listed in npm test`,
    testScript.includes(suiteRef),
    testScript.includes(suiteRef)
      ? undefined
      : `Not found in: ${testScript.slice(0, 200)}…`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Mutation test: remove ?? 0 guard → suite must exit non-zero
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Mutation: remove `?? 0` from card expression → tests must fail'));
sep();

function runPart2() {
  const original = readFileSync(TEST_FILE, 'utf-8');

  // The guard pattern we target: the `?? 0` in the `pendingCardValue` helper.
  // This helper is the inline replica of AbsenceMonitorTab's card expression:
  //
  //   function pendingCardValue(...) {
  //     return data?.summary.pending ?? 0;   ← we strip the ?? 0
  //   }
  //
  // After mutation the function returns `undefined` when data is undefined.
  // Tests at lines ~245 call `assert.strictEqual(pendingCardValue(undefined), 0)`
  // which then gets `undefined !== 0` → assertion error → non-zero exit.
  //
  // We match `return data?.summary.pending ?? 0` so the pattern is code-specific
  // and cannot accidentally match the same text appearing in comments.
  const guardPattern = /return data\?\.summary\.pending \?\? 0/;

  assert(
    'Source guard `return data?.summary.pending ?? 0` exists in the test file',
    guardPattern.test(original),
    guardPattern.test(original)
      ? undefined
      : 'Pattern not found — test may have drifted from production expressions',
  );

  if (!guardPattern.test(original)) {
    console.log(Y('  ⚠  Skipping mutation run — guard not found, cannot mutate safely.'));
    return;
  }

  // Remove ?? 0 from the pendingCardValue helper.
  // `String.replace` with a non-global pattern replaces the first match.
  const mutant = original.replace(
    /return data\?\.summary\.pending \?\? 0/,
    'return data?.summary.pending',
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
    'Mutant suite exits non-zero (removed ?? 0 guard is caught by the tests)',
    exitCode !== 0,
    exitCode === 0
      ? 'Exit code was 0 — the tests did NOT catch the removed guard; assertions are too weak.'
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
  console.log(Y('  ℹ  Running real absence-monitor-error-state.test.ts…'));

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
    'Real suite exits 0 (all ?? 0 guard contract tests pass)',
    exitCode === 0,
    exitCode !== 0
      ? `Exit code ${exitCode}; check output above for failing tests.`
      : undefined,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════

try {
  runPart1();
  runPart2();
  runPart3();
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
  console.log(G('   • absence-monitor-error-state.test.ts is wired into npm test\n'));
  console.log(G('   • The suite catches a removed ?? 0 guard (non-zero exit on mutation)\n'));
  console.log(G('   • The real suite is clean\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
  process.exit(1);
}
