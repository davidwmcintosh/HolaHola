import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Proves that the regression test added for task 1448 --
// "execution envelope violation is recoverable only through a fresh
// superseding packet" in server/scripts/test-coordination-runtime.test.ts --
// actually fails when the fresh_consumption_required protection is removed
// from claim() in server/services/coordination-runtime.ts, not just that it
// passes today. This test uses InMemoryCoordinationRepository (no database),
// so this self-check needs no CI database gating.

const root = resolve(import.meta.dirname, '../..');
const runtimePath = resolve(root, 'server/services/coordination-runtime.ts');
const runtimeTestPath = 'server/scripts/test-coordination-runtime.test.ts';
const TARGET_TEST_NAME =
  'execution envelope violation is recoverable only through a fresh superseding packet';

function inheritedTsxLoader(): string {
  const importFlagIndex = process.execArgv.findIndex(
    (arg, index) =>
      arg === '--import'
      && typeof process.execArgv[index + 1] === 'string'
      && /(?:^|[/\\])tsx(?:[/\\]|$)/.test(process.execArgv[index + 1]),
  );
  assert.ok(
    importFlagIndex >= 0,
    'envelope-violation self-check must be launched by Node with a parent-resolved tsx loader',
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

function runEnvelopeViolationTest(): Promise<{ code: number | null; output: string }> {
  return runTsxChild([
    '--test',
    `--test-name-pattern=${TARGET_TEST_NAME}`,
    runtimeTestPath,
  ]);
}

// claim() enforces "fresh_consumption_required" through two independent
// checks: (1) a packet/receipt that already has any prior claim can never be
// reclaimed, and (2) a replacement packet must properly supersede the prior
// terminal claim with evidence created after it went terminal. For the exact
// reclaim-the-same-violated-packet scenario this test exercises, each check
// alone fully covers the other's removal (both raise the same
// "fresh_consumption_required" code), so only removing both at once turns
// off the protection this test is meant to catch. Both must be mutated
// together for the self-check to prove something real.
const reclaimGuard = `      if (priorPacketClaims.length > 0) {
        fail('fresh_consumption_required', 'A terminal or expired claim requires a fresh packet');
      }
`;
const supersessionGuard = `      if (
        latestPriorClaim &&
        (
          packet.supersedesClaimId !== latestPriorClaim.id ||
          latestPriorClaim.terminalAt === null ||
          packet.createdAt < latestPriorClaim.terminalAt ||
          receipt.createdAt < packet.createdAt
        )
      ) {
        fail('fresh_consumption_required', 'Replacement evidence predates terminal claim');
      }
`;

async function proveMutationFails(input: {
  label: string;
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
    const result = await runEnvelopeViolationTest();
    assert.notEqual(
      result.code,
      0,
      `${input.label} mutation unexpectedly left the envelope-violation-recovery test passing`,
    );
    assert.match(
      result.output,
      new RegExp(TARGET_TEST_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
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
  label: 'fresh_consumption_required removal from claim()',
  expectedFailure: /Missing expected rejection/,
  mutate(source) {
    assert.equal(
      source.split(reclaimGuard).length - 1,
      1,
      'reclaim-guard mutation must match exactly one same-packet reclaim check',
    );
    assert.equal(
      source.split(supersessionGuard).length - 1,
      1,
      'supersession-guard mutation must match exactly one replacement-evidence check',
    );
    return source.replace(reclaimGuard, '').replace(supersessionGuard, '');
  },
});

// The mutation proof above already restores claim() byte-for-byte, but
// "restores the original guard afterward and confirms the test passes again"
// requires actually re-running the test against the restored source, not
// just trusting that the bytes match.
const restoredRun = await runEnvelopeViolationTest();
assert.equal(
  restoredRun.code,
  0,
  `envelope-violation-recovery test must pass again once fresh_consumption_required is restored:\n${restoredRun.output}`,
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
  '[coordination-runtime-envelope-violation-self-check] PASS: the envelope-violation-recovery test independently fails when fresh_consumption_required is removed from claim(), and passes again once restored',
);
