/**
 * test-pattern-signal-ci-check.ts
 *
 * Meta-test: confirms that pattern-signals-study-mode-chat.test.ts is both
 * wired into CI (npm test) AND that its source-analysis assertions actually fail
 * when the `buildTextModeSystemPrompt(systemPrompt, activePatternSignals)` call
 * is deliberately removed from daniela-caller.ts.
 *
 * Three checks:
 *
 *   PART 1 — Static: verify server/__tests__/pattern-signals-study-mode-chat.test.ts
 *             is listed in package.json's "test" script so it runs on every push.
 *
 *   PART 2 — Mutation: copy daniela-caller.ts, strip both calls to
 *             buildTextModeSystemPrompt(systemPrompt, activePatternSignals) (the
 *             simple path and the FC-loop path), point a copy of the test at the
 *             mutant caller file, run it, and assert the test exits non-zero.
 *             A zero exit would mean the source-analysis assertions are too weak
 *             to catch the most obvious removal of the injection.
 *
 *   PART 3 — Confirm the real (unmodified) test suite still passes.
 *
 * Run: npx tsx server/scripts/test-pattern-signal-ci-check.ts
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

const ROOT        = resolve(__dirname, '../..');
const CALLER_FILE = resolve(ROOT, 'server/services/daniela-caller.ts');
const MUTANT_CALLER = resolve(ROOT, 'server/services/daniela-caller.MUTANT.ts');
const TEST_FILE   = resolve(ROOT, 'server/__tests__/pattern-signals-study-mode-chat.test.ts');
const MUTANT_TEST = resolve(ROOT, 'server/__tests__/pattern-signals-study-mode-chat.MUTANT.test.ts');
const PKG_FILE    = resolve(ROOT, 'package.json');

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

  const suiteRef = 'server/__tests__/pattern-signals-study-mode-chat.test.ts';
  assert(
    `"${suiteRef}" is listed in npm test`,
    testScript.includes(suiteRef),
    !testScript.includes(suiteRef)
      ? `Not found in test script. Add "${suiteRef}" to package.json "test".`
      : undefined,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — Mutation: strip buildTextModeSystemPrompt calls from daniela-caller.ts
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 2 — Mutation: remove buildTextModeSystemPrompt injection → tests must fail'));
sep();

function runPart2() {
  const callerSrc = readFileSync(CALLER_FILE, 'utf-8');
  const testSrc   = readFileSync(TEST_FILE,   'utf-8');

  // The injection appears in two places in daniela-caller.ts:
  //
  //   1. Simple (!enableTools) path in callDaniela:
  //      systemPrompt = buildTextModeSystemPrompt(systemPrompt, activePatternSignals);
  //
  //   2. FC-loop path in runDanielaFCLoop:
  //      const effectiveSystemPrompt = buildTextModeSystemPrompt(systemPrompt, activePatternSignals);
  //
  // Both are checked by the test (Parts 2 and 3 of the test both call regionAround
  // with the anchor 'buildTextModeSystemPrompt(systemPrompt, activePatternSignals)').
  // Removing either one is sufficient to break the test; we remove both to simulate
  // a complete removal of the injection logic.

  const ANCHOR = 'buildTextModeSystemPrompt(systemPrompt, activePatternSignals)';

  assert(
    `daniela-caller.ts contains "${ANCHOR}" (simple path)`,
    callerSrc.includes(ANCHOR),
    `Pattern "${ANCHOR}" not found — production code may have changed`,
  );

  if (!callerSrc.includes(ANCHOR)) {
    console.log(Y('  ⚠  Skipping mutation run — anchor not found in production source.'));
    return;
  }

  // Count occurrences — we expect at least 2 (one per path).
  const occurrences = callerSrc.split(ANCHOR).length - 1;
  assert(
    `daniela-caller.ts contains at least 2 occurrences of "${ANCHOR}"`,
    occurrences >= 2,
    occurrences < 2
      ? `Only ${occurrences} occurrence(s) found — one of the injection paths may be missing`
      : undefined,
  );

  // Build the mutant: replace every occurrence of the injection call so the
  // source-analysis assertions in the test find nothing.
  //
  // Simple path line:
  //   systemPrompt = buildTextModeSystemPrompt(systemPrompt, activePatternSignals);
  // FC-loop line:
  //   const effectiveSystemPrompt = buildTextModeSystemPrompt(systemPrompt, activePatternSignals);
  //
  // We blank out the right-hand side of each assignment, preserving the variable
  // name on the left so the file still type-checks (avoids confounding type errors).
  let mutantCaller = callerSrc
    // FC-loop: const effectiveSystemPrompt = buildTextModeSystemPrompt(...)
    .replace(
      /const effectiveSystemPrompt = buildTextModeSystemPrompt\(systemPrompt,\s*activePatternSignals\)/g,
      'const effectiveSystemPrompt = systemPrompt /* MUTANT: injection removed */',
    )
    // Simple path: systemPrompt = buildTextModeSystemPrompt(...)
    .replace(
      /systemPrompt = buildTextModeSystemPrompt\(systemPrompt,\s*activePatternSignals\)/g,
      'systemPrompt = systemPrompt /* MUTANT: injection removed */',
    );

  assert(
    'Mutation produced a changed caller file (injection calls replaced)',
    mutantCaller !== callerSrc,
    'No change after replace — regex may be wrong',
  );

  if (mutantCaller === callerSrc) {
    console.log(Y('  ⚠  Skipping mutation run — caller file unchanged after mutation.'));
    return;
  }

  assert(
    `Mutant caller no longer contains "${ANCHOR}"`,
    !mutantCaller.includes(ANCHOR),
    `"${ANCHOR}" still present in mutant — mutation may be incomplete`,
  );

  // Build a mutant copy of the test that reads daniela-caller.MUTANT.ts
  // instead of daniela-caller.ts so the source-analysis section is exercised
  // against the mutated caller file.
  const mutantTest = testSrc.replace(
    /daniela-caller\.ts/g,
    'daniela-caller.MUTANT.ts',
  );

  assert(
    'Mutant test was redirected to daniela-caller.MUTANT.ts',
    mutantTest !== testSrc,
    'No substitution made — test file path reference may have changed',
  );

  writeFileSync(MUTANT_CALLER, mutantCaller, 'utf-8');
  writeFileSync(MUTANT_TEST,   mutantTest,   'utf-8');

  try {
    const result = spawnSync(
      'npx',
      ['tsx', '--test', MUTANT_TEST],
      {
        encoding: 'utf-8',
        timeout: 60_000,
        cwd: ROOT,
      },
    );

    const exitCode = result.status ?? -1;
    const stdoutSnippet = ((result.stdout ?? '') + (result.stderr ?? '')).slice(-1000);

    console.log(Y(`  ℹ  Mutant suite exit code: ${exitCode}`));
    if (stdoutSnippet) {
      console.log(Y(`  ℹ  Mutant suite output tail:\n${stdoutSnippet.split('\n').map(l => `       ${l}`).join('\n')}`));
    }

    assert(
      'Mutant suite exits non-zero (source-analysis guard catches removed injection)',
      exitCode !== 0,
      exitCode === 0
        ? 'Mutant exited 0 — the source-analysis assertions did NOT catch the removed ' +
          'buildTextModeSystemPrompt injection. The assertions are too weak.'
        : undefined,
    );
  } finally {
    for (const f of [MUTANT_CALLER, MUTANT_TEST]) {
      if (existsSync(f)) { try { unlinkSync(f); } catch { /* ignore */ } }
      console.log(Y(`  ℹ  Cleaned up: ${f}`));
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — Confirm the real suite passes
// ══════════════════════════════════════════════════════════════════════════════
sep();
console.log(B('PART 3 — Real suite: pattern-signals-study-mode-chat.test.ts must pass'));
sep();

function runPart3() {
  const result = spawnSync(
    'npx',
    ['tsx', '--test', TEST_FILE],
    {
      encoding: 'utf-8',
      timeout: 60_000,
      cwd: ROOT,
    },
  );

  const exitCode = result.status ?? -1;
  const stdoutSnippet = ((result.stdout ?? '') + (result.stderr ?? '')).slice(-600);

  console.log(Y(`  ℹ  Real suite exit code: ${exitCode}`));
  if (stdoutSnippet) {
    console.log(Y(`  ℹ  Real suite output tail:\n${stdoutSnippet.split('\n').map(l => `       ${l}`).join('\n')}`));
  }

  assert(
    'Real suite exits 0 (all pattern-signal study-mode tests pass)',
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
  for (const f of [MUTANT_CALLER, MUTANT_TEST]) {
    if (existsSync(f)) { try { unlinkSync(f); } catch { /* ignore */ } }
  }
  console.error(R(`\nUnhandled error: ${err?.message ?? err}`));
  process.exit(1);
}

sep();
const all = passed + failed;
if (failed === 0) {
  console.log(G(`\n✓  All ${all} assertions passed.\n`));
  console.log(G('   • pattern-signals-study-mode-chat.test.ts is wired into npm test\n'));
  console.log(G('   • The suite catches a stripped injection (non-zero exit on mutation)\n'));
  console.log(G('   • The real suite is clean\n'));
  process.exit(0);
} else {
  console.log(R(`\n✗  ${failed} of ${all} assertions failed.\n`));
  process.exit(1);
}
