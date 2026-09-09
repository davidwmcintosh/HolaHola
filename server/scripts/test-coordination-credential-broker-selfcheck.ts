import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

const root = resolve(import.meta.dirname, '../..');
const brokerPath = resolve(root, 'server/services/coordination-credential-broker.ts');
const brokerTestPath = 'server/scripts/test-coordination-credential-broker.test.ts';
const verifiedCiDatabaseUrl = getVerifiedCiDatabaseUrl();

if (!verifiedCiDatabaseUrl) {
  console.log(
    '[credential-broker-self-check] SKIP: requires CI=true and a verified job-local CI_DATABASE_URL',
  );
  process.exit(0);
}

function runRaceTest(): Promise<{ code: number | null; output: string }> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(
      resolve(root, 'node_modules/.bin/tsx'),
      ['--test', '--test-name-pattern=runtime revocation cannot', brokerTestPath],
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

async function proveMutationFails(input: {
  label: string;
  expectedFailure: RegExp;
  mutate: (source: string) => string;
}): Promise<void> {
  const originalBytes = readFileSync(brokerPath);
  const originalSource = originalBytes.toString('utf8');
  const mutantSource = input.mutate(originalSource);
  assert.notEqual(
    mutantSource,
    originalSource,
    `${input.label} mutation did not change the broker source`,
  );

  try {
    writeFileSync(brokerPath, mutantSource);
    const result = await runRaceTest();
    assert.notEqual(
      result.code,
      0,
      `${input.label} mutation unexpectedly passed the credential revocation race`,
    );
    assert.match(
      result.output,
      input.expectedFailure,
      `${input.label} mutation failed for the wrong reason:\n${result.output}`,
    );
  } finally {
    writeFileSync(brokerPath, originalBytes);
    assert.deepEqual(
      readFileSync(brokerPath),
      originalBytes,
      `${input.label} mutation did not restore broker source byte-for-byte`,
    );
  }
}

const exchangeStart = 'export async function exchangeBootstrapCredential(';
const exchangeEnd = 'export async function resolveBrokerCredential(';
const lockBlock = `    await tx.execute(sql\`
      SELECT id FROM coordination_runtime_registrations
      WHERE id = \${runtimeId}
      FOR UPDATE
    \`);
`;

await proveMutationFails({
  label: 'exchange registration lock removal',
  expectedFailure: /runtime revocation must wait while bootstrap exchange holds the registration lock/,
  mutate(source) {
    const start = source.indexOf(exchangeStart);
    const end = source.indexOf(exchangeEnd);
    assert.ok(start >= 0 && end > start, 'could not locate bootstrap exchange function');
    const exchangeSource = source.slice(start, end);
    assert.equal(
      exchangeSource.split(lockBlock).length - 1,
      1,
      'exchange lock mutation must match exactly one registration lock block',
    );
    return source.slice(0, start) + exchangeSource.replace(lockBlock, '') + source.slice(end);
  },
});

const activeRegistrationGuard =
  '!row.runtimeEnabled || row.runtimeRevokedAt || stored.revokedAt';

await proveMutationFails({
  label: 'active-registration resolution check removal',
  expectedFailure: /must not authenticate through a revoked registration/,
  mutate(source) {
    assert.equal(
      source.split(activeRegistrationGuard).length - 1,
      1,
      'active-registration mutation must match exactly one resolution guard',
    );
    return source.replace(activeRegistrationGuard, 'stored.revokedAt');
  },
});

console.log(
  '[credential-broker-self-check] PASS: the race test independently rejects removal of the exchange registration lock or active-registration resolution check',
);