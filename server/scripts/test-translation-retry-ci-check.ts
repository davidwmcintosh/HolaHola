/**
 * test-translation-retry-ci-check.ts
 *
 * Meta-test: confirms that the translation-retry test suite is both
 * wired into CI (npm test) AND that it actually fails when a core
 * contract is deliberately stripped from the production source.
 *
 * Three checks:
 *
 *   PART 1 — Static: verify client/src/components/translation-retry.test.ts
 *             is listed in package.json's "test" script so it runs on every push.
 *
 *   PART 2 — Mutation: copy ChapterIntroduction.tsx, remove the
 *             `setTranslationError(true)` call in the !r.ok branch (the critical
 *             error-state contract), point the test at the mutant copy, run it,
 *             and assert the test exits non-zero.  A zero exit would mean the
 *             test assertions are too weak to catch that breakage.
 *
 *   PART 3 — Confirm the real (unmodified) test suite still passes.
 *
 * Run: npx tsx server/scripts/test-translation-retry-ci-check.ts
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

const PROD_FILE    = resolve(__dirname, '../../client/src/components/ChapterIntroduction.tsx');
const MUTANT_FILE  = resolve(__dirname, '../../client/src/components/ChapterIntroduction.MUTANT.tsx');
const TEST_FILE    = resolve(__dirname, '../../client/src/components/translation-retry.test.ts');
const MUTANT_TEST  = resolve(__dirname, '../../client/src/components/translation-retry.MUTANT.test.ts');
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

  const suiteRef = 'client/src/components/translation-retry.test.ts';
  // Accept either the explicit path or a glob that covers it (e.g. client/src/components/*.test.ts).
  const coveredByGlob = testScript.includes('client/src/components/*.test.ts');
  const coveredExplicitly = testScript.includes(suiteRef);
  assert(
    `"${suiteRef}" is listed in npm test (directly or via glob)`,
    coveredExplicitly || coveredByGlob,
    (!coveredExplicitly && !coveredByGlob)
      ? `Not found in test script. Add "${suiteRef}" or "client/src/components/*.test.ts" to package.json "test".`
      : undefined,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Mutation: strip setTranslationError(true) from production source
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Mutation: strip setTranslationError(true) from !r.ok branch → tests must fail'));
sep();

function runPart2() {
  const prodSrc  = readFileSync(PROD_FILE,  'utf-8');
  const testSrc  = readFileSync(TEST_FILE,  'utf-8');

  // Verify the guard expression is present in the production file before mutating
  // Matches the exact block: if (!r.ok) { setTranslationError(true); ... }
  const guardPattern = /if\s*\(\s*!r\.ok\s*\)\s*\{[^}]*setTranslationError\s*\(\s*true\s*\)/s;
  assert(
    'Production source contains `if (!r.ok) { setTranslationError(true) }` block',
    guardPattern.test(prodSrc),
    guardPattern.test(prodSrc)
      ? undefined
      : 'Pattern not found in ChapterIntroduction.tsx — production code may have changed',
  );

  if (!guardPattern.test(prodSrc)) {
    console.log(Y('  ⚠  Skipping mutation run — guard not found in production source.'));
    return;
  }

  // Build the mutant production file: remove the setTranslationError(true) line
  // inside the !r.ok block.  This simulates the error-state wiring being deleted.
  const mutantProd = prodSrc.replace(
    /(\bif\s*\(\s*!r\.ok\s*\)\s*\{[^}]*)setTranslationError\s*\(\s*true\s*\)\s*;?/s,
    '$1/* MUTANT: error-state call removed */',
  );

  assert(
    'Mutation produced a changed production file',
    mutantProd !== prodSrc,
    'No change after replace — regex may be wrong',
  );

  if (mutantProd === prodSrc) {
    console.log(Y('  ⚠  Skipping mutation run — production file unchanged after mutation.'));
    return;
  }

  // Build a mutant copy of the TEST file that reads ChapterIntroduction.MUTANT.tsx
  // instead of ChapterIntroduction.tsx.
  const mutantTest = testSrc.replace(
    /ChapterIntroduction\.tsx/g,
    'ChapterIntroduction.MUTANT.tsx',
  );

  assert(
    'Mutant test file was redirected to ChapterIntroduction.MUTANT.tsx',
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
        timeout: 30_000,
        cwd: resolve(__dirname, '../../'),
      },
    );

    const exitCode = result.status ?? -1;
    const stdoutSnippet = ((result.stdout ?? '') + (result.stderr ?? '')).slice(-800);

    console.log(Y(`  ℹ  Mutant exit code: ${exitCode}`));
    if (stdoutSnippet) {
      console.log(Y(`  ℹ  Mutant output tail:\n${stdoutSnippet.split('\n').map(l => `       ${l}`).join('\n')}`));
    }

    assert(
      'Mutant suite exits non-zero (missing setTranslationError(true) is detected)',
      exitCode !== 0,
      exitCode === 0
        ? 'Mutant exited 0 — tests did not catch the removed error-state wiring'
        : undefined,
    );
  } finally {
    for (const f of [MUTANT_FILE, MUTANT_TEST]) {
      if (existsSync(f)) { try { unlinkSync(f); } catch { /* ignore */ } }
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Confirm the real suite passes
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Real suite: translation-retry.test.ts must pass'));
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
    'Real suite exits 0 (all translation-retry tests pass)',
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
  console.log(G('   • translation-retry.test.ts is wired into npm test\n'));
  console.log(G('   • The suite catches a stripped production contract (non-zero exit on mutation)\n'));
  console.log(G('   • The real suite is clean\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
  process.exit(1);
}
