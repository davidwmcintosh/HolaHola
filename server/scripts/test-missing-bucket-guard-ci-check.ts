/**
 * test-missing-bucket-guard-ci-check.ts
 *
 * Meta-test: confirms that the missing-bucket guard test suite is both
 * wired into CI (npm test) AND that it actually fails when the guard logic
 * is deliberately stripped from the inlined checkBucketGuard function.
 *
 * Three checks:
 *
 *   PART 1 — Static: verify upload-madrigal-scans.test.ts is listed in
 *             package.json's "test" script so it runs on every push.
 *
 *   PART 2 — Mutation: copy the test file, strip the guard logic
 *             (`shouldExit: !bucketName` → `shouldExit: false`), run the
 *             mutated copy, and assert that it exits non-zero.  A zero exit
 *             would mean the test assertions are too weak to catch the most
 *             obvious breakage of the production guard.
 *
 *   PART 3 — Confirm the real (unmodified) suite still passes.
 *
 * Run: npx tsx server/scripts/test-missing-bucket-guard-ci-check.ts
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

const TEST_FILE   = resolve(__dirname, 'upload-madrigal-scans.test.ts');
const MUTANT_FILE = resolve(__dirname, 'upload-madrigal-scans.MUTANT.test.ts');
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

  const suiteRef = 'server/scripts/upload-madrigal-scans.test.ts';
  assert(
    `"${suiteRef}" is listed in npm test`,
    testScript.includes(suiteRef),
    testScript.includes(suiteRef)
      ? undefined
      : `Not found in: ${testScript.slice(0, 200)}…`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Mutation test: stripped guard → suite must exit non-zero
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Mutation: strip `shouldExit: !bucketName` → tests must fail'));
sep();

function runPart2() {
  const original = readFileSync(TEST_FILE, 'utf-8');

  // Verify the critical guard expression exists in the test file before mutating
  const guardPattern = /shouldExit:\s*!bucketName/;
  assert(
    'Source guard `shouldExit: !bucketName` exists in the test file',
    guardPattern.test(original),
    guardPattern.test(original)
      ? undefined
      : 'Pattern not found — test may have drifted from the production guard',
  );

  if (!guardPattern.test(original)) {
    console.log(Y('  ⚠  Skipping mutation run — guard not found, cannot mutate safely.'));
    return;
  }

  // Build the mutant: replace `shouldExit: !bucketName` with `shouldExit: false`
  // This simulates the guard being stripped — it never signals an exit, so
  // uploads would proceed even with no bucket configured.
  const mutant = original.replace(
    /shouldExit:\s*!bucketName/g,
    'shouldExit: false',
  );

  assert(
    'Mutant differs from original (replacement was applied)',
    mutant !== original,
  );

  if (mutant === original) {
    console.log(Y('  ⚠  Skipping mutation run — replacement had no effect.'));
    return;
  }

  try {
    writeFileSync(MUTANT_FILE, mutant, 'utf-8');
    console.log(Y(`  ℹ  Mutant written to ${MUTANT_FILE}`));

    const result = spawnSync(
      'npx',
      ['tsx', '--test', MUTANT_FILE],
      {
        encoding: 'utf-8',
        timeout: 30_000,
        cwd: resolve(__dirname, '../../'),
      },
    );

    const exitCode = result.status ?? -1;
    const stdoutSnippet = ((result.stdout ?? '') + (result.stderr ?? '')).slice(-800);

    console.log(Y(`  ℹ  Mutant suite exit code: ${exitCode}`));
    if (stdoutSnippet) {
      console.log(Y(`  ℹ  Mutant suite output tail:\n${stdoutSnippet.split('\n').map(l => `       ${l}`).join('\n')}`));
    }

    assert(
      'Mutant suite exits non-zero (guard tests catch the stripped guard)',
      exitCode !== 0,
      exitCode === 0
        ? 'Exit code was 0 — the missing-bucket guard tests did NOT catch the stripped guard. The assertions are too weak.'
        : undefined,
    );
  } finally {
    if (existsSync(MUTANT_FILE)) {
      try { unlinkSync(MUTANT_FILE); } catch { /* ignore */ }
      console.log(Y(`  ℹ  Mutant file cleaned up.`));
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Confirm the real suite still passes
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Real suite: upload-madrigal-scans.test.ts must pass unmodified'));
sep();

function runPart3() {
  const result = spawnSync(
    'npx',
    ['tsx', '--test', TEST_FILE],
    {
      encoding: 'utf-8',
      timeout: 30_000,
      cwd: resolve(__dirname, '../../'),
    },
  );

  const exitCode = result.status ?? -1;
  const stdoutSnippet = ((result.stdout ?? '') + (result.stderr ?? '')).slice(-600);

  console.log(Y(`  ℹ  Real suite exit code: ${exitCode}`));
  if (stdoutSnippet) {
    console.log(Y(`  ℹ  Real suite output tail:\n${stdoutSnippet.split('\n').map(l => `       ${l}`).join('\n')}`));
  }

  assert(
    'Real suite exits 0 (all missing-bucket guard tests pass)',
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
  if (existsSync(MUTANT_FILE)) { try { unlinkSync(MUTANT_FILE); } catch { /* ignore */ } }
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
}

sep();
const all = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓  All ${all} assertions passed.\n`));
  console.log(G('   • upload-madrigal-scans.test.ts is wired into npm test\n'));
  console.log(G('   • The suite catches a stripped bucket guard (non-zero exit on mutation)\n'));
  console.log(G('   • The real suite is clean\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
  process.exit(1);
}
