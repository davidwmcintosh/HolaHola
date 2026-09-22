import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Proves that the regression test added for task 1506 -- "verification
// rejects a verifier registration that is not designated as a standing
// verifier" in server/scripts/test-coordination-runtime.test.ts -- actually
// fails when the standingVerifier guard is removed from verify() in
// server/services/coordination-runtime.ts, not just that it passes today.
// This test uses InMemoryCoordinationRepository (no database), so this
// self-check needs no CI database gating.

const root = resolve(import.meta.dirname, '../..');
const runtimePath = resolve(root, 'server/services/coordination-runtime.ts');
const runtimeTestPath = 'server/scripts/test-coordination-runtime.test.ts';
const TARGET_TEST_NAME =
  'verification rejects a verifier registration that is not designated as a standing verifier';

function inheritedTsxLoader(): string {
  const importFlagIndex = process.execArgv.findIndex(
    (arg, index) =>
      arg === '--import'
      && typeof process.execArgv[index + 1] === 'string'
      && /(?:^|[/\\])tsx(?:[/\\]|$)/.test(process.execArgv[index + 1]),
  );
  assert.ok(
    importFlagIndex >= 0,
    'verifier-standing self-check must be launched by Node with a parent-resolved tsx loader',
  );
  return process.execArgv[importFlagIndex + 1];
}

function runTsxChild(args: string[]): Promise<{ code: number | null; output: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      process.execPath,
      [
        '--import',
        inheritedTsxLoader(),
        ...args,
      ],
      {
        cwd: root,
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let output = '';
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      output += chunk.toString();
    });
    child.on('error', rejectRun);
    child.on('close', (code) => resolveRun({ code, output }));
  });
}

function runNamedTest(name: string): Promise<{ code: number | null; output: string }> {
  return runTsxChild([
    '--test',
    `--test-name-pattern=${name}`,
    runtimeTestPath,
  ]);
}

const standingVerifierGuard = `    if (!principal.standingVerifier) {
      fail('verifier_registration_not_standing', 'Verifier registration is not designated as a standing verifier');
    }
`;

async function proveMutationFails(input: {
  label: string;
  testName: string;
  expectedFailure: RegExp;
  mutate: (source: string) => string;
}): Promise<void> {
  const originalBytes = readFileSync(runtimePath);
  const originalSource = originalBytes.toString('utf8');
  const mutantSource = input.mutate(originalSource);
  assert.notEqual(
    mutantSource,
    originalSource,
    `${input.label} mutation did not change the coordination runtime source`,
  );

  try {
    writeFileSync(runtimePath, mutantSource);
    const result = await runNamedTest(input.testName);
    assert.notEqual(
      result.code,
      0,
      `${input.label} mutation unexpectedly left the standing-verifier test passing`,
    );
    assert.match(
      result.output,
      new RegExp(input.testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      `${input.label} mutation did not fail the expected test:\n${result.output}`,
    );
    assert.match(
      result.output,
      input.expectedFailure,
      `${input.label} mutation failed for the wrong reason:\n${result.output}`,
    );
  } finally {
    writeFileSync(runtimePath, originalBytes);
    assert.deepEqual(
      readFileSync(runtimePath),
      originalBytes,
      `${input.label} mutation did not restore the coordination runtime source byte-for-byte`,
    );
  }
}

await proveMutationFails({
  label: 'standingVerifier guard removal from verify()',
  testName: TARGET_TEST_NAME,
  expectedFailure: /Missing expected rejection/,
  mutate(source) {
    assert.equal(
      source.split(standingVerifierGuard).length - 1,
      1,
      'standing-verifier guard mutation must match exactly one occurrence in verify()',
    );
    return source.replace(standingVerifierGuard, '');
  },
});

// The mutation proof above already restores verify() byte-for-byte, but
// "restores the original guard afterward and confirms the test passes again"
// requires actually re-running the test against the restored source, not
// just trusting that the bytes match.
const restoredRun = await runNamedTest(TARGET_TEST_NAME);
assert.equal(
  restoredRun.code,
  0,
  `standing-verifier test must pass again once the guard is restored:\n${restoredRun.output}`,
);
assert.match(
  restoredRun.output,
  /# pass 1/,
  `restored run must report the target test passing:\n${restoredRun.output}`,
);
assert.match(
  restoredRun.output,
  /# fail 0/,
  `restored run must report no failing tests:\n${restoredRun.output}`,
);

console.log(
  '[coordination-runtime-verifier-standing-self-check] PASS: the standing-verifier test independently fails when the standingVerifier guard is removed from verify(), and passes again once restored',
);
