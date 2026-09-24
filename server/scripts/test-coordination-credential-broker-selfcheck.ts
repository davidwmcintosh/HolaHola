import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

const root = resolve(import.meta.dirname, '../..');
const brokerPath = resolve(root, 'server/services/coordination-credential-broker.ts');
const brokerTestPath = 'server/scripts/test-coordination-credential-broker.test.ts';
const rotationTestPath = 'server/scripts/test-coordination-credential-rotation.test.ts';

function inheritedTsxLoader(): string {
  const importFlagIndex = process.execArgv.findIndex(
    (arg, index) =>
      arg === '--import'
      && typeof process.execArgv[index + 1] === 'string'
      && /(?:^|[/\\])tsx(?:[/\\]|$)/.test(process.execArgv[index + 1]),
  );
  assert.ok(
    importFlagIndex >= 0,
    'credential-broker self-check must be launched by Node with a parent-resolved tsx loader',
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

function runRaceTest(): Promise<{ code: number | null; output: string }> {
  return runTsxChild([
    '--test',
    '--test-name-pattern=runtime revocation cannot',
    brokerTestPath,
  ]);
}

function runReissueTest(testNamePattern: string): () => Promise<{ code: number | null; output: string }> {
  return () => runTsxChild([
    '--test',
    `--test-name-pattern=${testNamePattern}`,
    rotationTestPath,
  ]);
}

const childProbeIndex = process.argv.indexOf('--probe-child-launch');
if (childProbeIndex >= 0) {
  const probePath = process.argv[childProbeIndex + 1];
  assert.ok(probePath, '--probe-child-launch requires a TypeScript probe path');
  const result = await runTsxChild([probePath]);
  process.stdout.write(result.output);
  process.exit(result.code ?? 1);
}

const verifiedCiDatabaseUrl = getVerifiedCiDatabaseUrl();

if (!verifiedCiDatabaseUrl) {
  console.log(
    '[credential-broker-self-check] SKIP: requires CI=true and a verified job-local CI_DATABASE_URL',
  );
  process.exit(0);
}

async function proveMutationFails(input: {
  label: string;
  expectedFailure: RegExp;
  mutate: (source: string) => string;
  runTest?: () => Promise<{ code: number | null; output: string }>;
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
    const result = await (input.runTest ?? runRaceTest)();
    assert.notEqual(
      result.code,
      0,
      `${input.label} mutation unexpectedly left the target test(s) passing`,
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

// ── reissueCoordinationRuntimeBootstrap's fail-closed guards (added for
//    Task 1556) ────────────────────────────────────────────────────────────
//
// The function has three fail-closed checks: (1) the runtime-not-found
// early return, (2) the disabled/revoked-registration early return, and
// (3) the "enabled = true AND revokedAt IS NULL" condition on the
// bootstrap-hash UPDATE's own WHERE clause. Guards 1 and 2 each get their
// own independent scenario below.
//
// Guard 3 cannot get a scenario where it alone is removed and guard 2
// stays intact: every rotation-test call that exercises this failure path
// pre-revokes the registration BEFORE calling reissue, and guard 2 always
// runs first against that already-revoked row -- so guard 3's UPDATE is
// never even reached while guard 2 exists, regardless of what its own
// WHERE clause says. This is not a limitation of the test, it is a
// mathematical consequence of the transaction design: the whole function
// runs inside one transaction that takes SELECT ... FOR UPDATE on the
// registration row (and lockRuntimePair(), used by the revoke path in
// completeCoordinationRuntimeReplacement()/rollbackCoordinationRuntimeReplacement(),
// takes the same row-level FOR UPDATE plus a pg_advisory_xact_lock before
// touching it) -- so nothing can ever change enabled/revokedAt on that row
// between guard 2's read and guard 3's UPDATE. Whenever guard 2 would
// reject, guard 3's WHERE conditions are already guaranteed to also
// reject, and whenever guard 2 accepts, those same conditions are already
// guaranteed to hold for the UPDATE. Guard 3 is only reachable, and only
// matters, once guard 2 has already been removed -- which is exactly what
// the combined scenario at the bottom of this section tests: it is the
// one mutation that produces a REAL, dangerous behavior change (a
// reissued bootstrap token for an already-revoked runtime), and it is the
// only guard-3 scenario that can honestly exist under this design. See
// .agents/memory/coordination-runtime-race-guards.md for the same pattern
// in claim().
const runtimeNotFoundGuard = `    if (!registration) {
      await audit({
        eventType: 'bootstrap_reissue_failed',
        success: false,
        runtimeId,
        reason: 'runtime_not_found',
        sourceIp,
      }, executor);
      return { ok: false, reason: 'runtime_not_found' };
    }
`;

await proveMutationFails({
  label: 'reissue runtime-not-found guard removal',
  expectedFailure: /fails closed for unknown or revoked runtimes[\s\S]*?Cannot read propert(?:y|ies) of undefined \(reading 'enabled'\)/,
  runTest: runReissueTest('fails closed for unknown or revoked runtimes'),
  mutate(source) {
    assert.equal(
      source.split(runtimeNotFoundGuard).length - 1,
      1,
      'reissue runtime-not-found mutation must match exactly one guard block',
    );
    return source.replace(runtimeNotFoundGuard, '');
  },
});

const disabledOrRevokedGuard = `    if (!registration.enabled || registration.revokedAt) {
      await audit({
        eventType: 'bootstrap_reissue_failed',
        success: false,
        runtimeId,
        actor: registration.actor,
        reason: 'runtime_disabled_or_revoked',
        sourceIp,
        // guardStage distinguishes this early rejection from the
        // structurally-identical one below that the UPDATE's own WHERE
        // clause produces. Both enforce the same enabled/revokedAt
        // condition on the same FOR-UPDATE-locked row -- this tag exists
        // so an operator (or a test) can tell which of the two fired,
        // even though neither can currently fire without the other also
        // being true for the same row. See coordination-runtime-race-guards.md.
        metadata: { guardStage: 'pre_update_check' },
      }, executor);
      return { ok: false, reason: 'runtime_disabled_or_revoked' };
    }
`;

await proveMutationFails({
  label: 'reissue disabled/revoked early-check removal (guard 2 alone)',
  expectedFailure: /not ok \d+ - bootstrap reissue refuses a revoked registration[\s\S]*?'update_where_clause'[\s\S]*?'pre_update_check'/,
  runTest: runReissueTest('bootstrap reissue refuses a revoked registration'),
  mutate(source) {
    assert.equal(
      source.split(disabledOrRevokedGuard).length - 1,
      1,
      'reissue disabled/revoked mutation must match exactly one guard block',
    );
    return source.replace(disabledOrRevokedGuard, '');
  },
});

const bootstrapUpdateGuardedWhere = `    }).where(and(
      eq(coordinationRuntimeRegistrations.id, runtimeId),
      eq(coordinationRuntimeRegistrations.enabled, true),
      isNull(coordinationRuntimeRegistrations.revokedAt),
    )).returning({ id: coordinationRuntimeRegistrations.id });`;

const bootstrapUpdateUnguardedWhere = `}).where(
      eq(coordinationRuntimeRegistrations.id, runtimeId),
    ).returning({ id: coordinationRuntimeRegistrations.id });`;

await proveMutationFails({
  label: 'reissue disabled/revoked guard and UPDATE WHERE clause removal (guards 2+3 together)',
  expectedFailure: /not ok \d+ - bootstrap reissue refuses a revoked registration[\s\S]*?runtime_disabled_or_revoked/,
  runTest: runReissueTest('bootstrap reissue refuses a revoked registration'),
  mutate(source) {
    assert.equal(
      source.split(disabledOrRevokedGuard).length - 1,
      1,
      'reissue disabled/revoked mutation must match exactly one guard block',
    );
    assert.equal(
      source.split(bootstrapUpdateGuardedWhere).length - 1,
      1,
      'reissue UPDATE WHERE mutation must match exactly one guarded WHERE clause',
    );
    return source
      .replace(disabledOrRevokedGuard, '')
      .replace(bootstrapUpdateGuardedWhere, bootstrapUpdateUnguardedWhere);
  },
});

console.log(
  '[credential-broker-self-check] PASS: the race test independently rejects removal of the exchange registration lock or active-registration resolution check, and the rotation tests independently reject removal of the reissue runtime-not-found guard, the reissue disabled/revoked early check on its own, and the combined disabled/revoked reissue protection',
);