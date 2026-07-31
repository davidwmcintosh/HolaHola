/**
 * test-badge-render-ci-check.ts
 *
 * Meta-test: confirms that absence-return-badge-render.test.ts is both
 * wired into CI (npm test) AND that its source-analysis section actually fails
 * when the JSX condition `session.hadAbsenceReturn` is deliberately stripped
 * from CommandCenter.tsx.
 *
 * Three checks:
 *
 *   PART 1 — Static: verify client/src/components/absence-return-badge-render.test.ts
 *             is listed in package.json's "test" script so it runs on every push.
 *
 *   PART 2 — Mutation: copy CommandCenter.tsx, strip the JSX guard
 *             (`session.hadAbsenceReturn &&`), point a copy of the test at
 *             the mutant production file, run it, and assert the test exits
 *             non-zero.  A zero exit would mean the source-analysis assertions
 *             are too weak to catch the most obvious removal of the guard.
 *
 *   PART 3 — Confirm the real (unmodified) test suite still passes.
 *
 * Run: npx tsx server/scripts/test-badge-render-ci-check.ts
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

const PROD_FILE    = resolve(__dirname, '../../client/src/pages/admin/CommandCenter.tsx');
const MUTANT_FILE  = resolve(__dirname, '../../client/src/pages/admin/CommandCenter.MUTANT.tsx');
const TEST_FILE    = resolve(__dirname, '../../client/src/components/absence-return-badge-render.test.ts');
const MUTANT_TEST  = resolve(__dirname, '../../client/src/components/absence-return-badge-render.MUTANT.test.ts');
const PKG_FILE     = resolve(__dirname, '../../package.json');

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

  const suiteRef = 'client/src/components/absence-return-badge-render.test.ts';
  assert(
    `"${suiteRef}" is listed in npm test`,
    testScript.includes(suiteRef),
    testScript.includes(suiteRef)
      ? undefined
      : `Not found in test script. Add it to package.json "test".`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Mutation: strip `session.hadAbsenceReturn &&` from CommandCenter.tsx
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Mutation: strip `session.hadAbsenceReturn &&` from JSX → tests must fail'));
sep();

function runPart2() {
  const prodSrc = readFileSync(PROD_FILE, 'utf-8');
  const testSrc = readFileSync(TEST_FILE, 'utf-8');

  // Verify the JSX guard expression exists in the production file before mutating.
  // Matches:  {session.hadAbsenceReturn && (
  const guardPattern = /\{\s*session\.hadAbsenceReturn\s*&&\s*\(/;
  assert(
    'CommandCenter.tsx contains `{session.hadAbsenceReturn && (` JSX guard',
    guardPattern.test(prodSrc),
    guardPattern.test(prodSrc)
      ? undefined
      : 'Pattern not found in CommandCenter.tsx — production code may have changed',
  );

  if (!guardPattern.test(prodSrc)) {
    console.log(Y('  ⚠  Skipping mutation run — guard not found in production source.'));
    return;
  }

  // Build the mutant: remove the `session.hadAbsenceReturn &&` part so the
  // Badge renders unconditionally.  This simulates the guard being stripped.
  // The source-analysis assertions in the test use /session\.hadAbsenceReturn/
  // to verify the guard is present; with it gone the assertions must fail.
  const mutantProd = prodSrc.replace(
    /\{\s*session\.hadAbsenceReturn\s*&&\s*\(/g,
    '{( /* MUTANT: hadAbsenceReturn condition removed */',
  );

  assert(
    'Mutation produced a changed production file (guard was replaced)',
    mutantProd !== prodSrc,
    'No change after replace — regex may be wrong',
  );

  if (mutantProd === prodSrc) {
    console.log(Y('  ⚠  Skipping mutation run — production file unchanged after mutation.'));
    return;
  }

  // Verify the mutant no longer contains `session.hadAbsenceReturn`
  assert(
    'Mutant CommandCenter.tsx no longer contains `session.hadAbsenceReturn`',
    !/session\.hadAbsenceReturn/.test(mutantProd),
    'session.hadAbsenceReturn still present in mutant — mutation may be incomplete',
  );

  // Build a mutant copy of the test file that reads CommandCenter.MUTANT.tsx
  // instead of CommandCenter.tsx so the source-analysis section is exercised
  // against the mutated production file.
  const mutantTest = testSrc.replace(
    /CommandCenter\.tsx/g,
    'CommandCenter.MUTANT.tsx',
  );

  assert(
    'Mutant test file was redirected to CommandCenter.MUTANT.tsx',
    mutantTest !== testSrc,
    'No substitution made — test file path reference may have changed',
  );

  writeFileSync(MUTANT_FILE, mutantProd, 'utf-8');
  writeFileSync(MUTANT_TEST, mutantTest, 'utf-8');

  try {
    const result = spawnSync(
      'npx',
      ['tsx', '--test', MUTANT_TEST],
      {
        encoding: 'utf-8',
        timeout: 60_000,
        cwd: resolve(__dirname, '../../'),
      },
    );

    const exitCode = result.status ?? -1;
    const stdoutSnippet = ((result.stdout ?? '') + (result.stderr ?? '')).slice(-1000);

    console.log(Y(`  ℹ  Mutant suite exit code: ${exitCode}`));
    if (stdoutSnippet) {
      console.log(Y(`  ℹ  Mutant suite output tail:\n${stdoutSnippet.split('\n').map(l => `       ${l}`).join('\n')}`));
    }

    assert(
      'Mutant suite exits non-zero (source-analysis guard catches stripped JSX condition)',
      exitCode !== 0,
      exitCode === 0
        ? 'Mutant exited 0 — the source-analysis assertions did NOT catch the removed hadAbsenceReturn guard. The assertions are too weak.'
        : undefined,
    );
  } finally {
    for (const f of [MUTANT_FILE, MUTANT_TEST]) {
      if (existsSync(f)) { try { unlinkSync(f); } catch { /* ignore */ } }
      console.log(Y(`  ℹ  Cleaned up: ${f}`));
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Confirm the real suite passes
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Real suite: absence-return-badge-render.test.ts must pass'));
sep();

function runPart3() {
  const result = spawnSync(
    'npx',
    ['tsx', '--test', TEST_FILE],
    {
      encoding: 'utf-8',
      timeout: 60_000,
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
    'Real suite exits 0 (all badge-render tests pass)',
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
  for (const f of [MUTANT_FILE, MUTANT_TEST]) {
    if (existsSync(f)) { try { unlinkSync(f); } catch { /* ignore */ } }
  }
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
}

sep();
const all = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓  All ${all} assertions passed.\n`));
  console.log(G('   • absence-return-badge-render.test.ts is wired into npm test\n'));
  console.log(G('   • The suite catches a stripped JSX condition (non-zero exit on mutation)\n'));
  console.log(G('   • The real suite is clean\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
  process.exit(1);
}
