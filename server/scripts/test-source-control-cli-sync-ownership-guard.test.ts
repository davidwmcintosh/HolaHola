import test from 'node:test';
import assert from 'node:assert/strict';
import { main } from './source-control-cli';
import { InfraMutationBlockedError } from '../services/infra-mutation-guard';
import type { TaskOwnershipResult } from '../services/task-ownership-service';
import type { SourceControlService } from '../services/source-control-service';

function ownershipResult(state: TaskOwnershipResult['state']): TaskOwnershipResult {
  return {
    ok: state !== 'unknown_stop',
    state,
    taskRef: '1470',
    evidence: {
      taskRef: '1470',
      taskArtifact: { path: '/dev/null', exists: false, regularFile: false },
      checkout: { kind: 'linked_worktree', gitMetadataPath: '/dev/null' },
      verifiedActiveMainReceipt: false,
      verifiedActiveIsolatedProof: state === 'isolated_agent',
    },
    contradictions: [],
    explanation: `stub:${state}`,
  };
}

function fakeService(onSync: () => Promise<unknown>): SourceControlService {
  return { sync: onSync } as unknown as SourceControlService;
}

async function withArgv<T>(argv: string[], fn: () => Promise<T>): Promise<T> {
  const original = process.argv;
  process.argv = ['node', 'source-control-cli.ts', ...argv];
  try {
    return await fn();
  } finally {
    process.argv = original;
  }
}

test('sync from a non-primary-worktree checkout without --task-ref refuses before touching git', async () => {
  let syncCalls = 0;
  const service = fakeService(async () => {
    syncCalls += 1;
    throw new Error('service.sync must not be called');
  });
  await withArgv(['sync'], () => assert.rejects(
    () => main({ service, resolveCheckoutKind: async () => 'linked_worktree' }),
    /Missing --task-ref/,
  ));
  assert.equal(syncCalls, 0, 'the gate must refuse before any git call is attempted');
});

test('sync from a non-primary-worktree checkout refuses when ownership is unknown_stop', async () => {
  let syncCalls = 0;
  const service = fakeService(async () => {
    syncCalls += 1;
    throw new Error('service.sync must not be called');
  });
  await withArgv(['sync', '--task-ref', '1470'], () => assert.rejects(
    () => main({
      service,
      resolveCheckoutKind: async () => 'linked_worktree',
      probeOwnership: async () => ownershipResult('unknown_stop'),
    }),
    (error: unknown) => error instanceof InfraMutationBlockedError
      && error.state === 'unknown_stop'
      && error.taskRef === '1470'
      && error.action === 'source-control:sync',
  ));
  assert.equal(syncCalls, 0, 'the gate must refuse before any git call is attempted');
});

for (const kind of ['not_a_git_worktree', 'malformed_git_metadata'] as const) {
  test(`sync from a ${kind} checkout also requires proven ownership`, async () => {
    let syncCalls = 0;
    const service = fakeService(async () => {
      syncCalls += 1;
      throw new Error('service.sync must not be called');
    });
    await withArgv(['sync', '--task-ref', '1470'], () => assert.rejects(
      () => main({
        service,
        resolveCheckoutKind: async () => kind,
        probeOwnership: async () => ownershipResult('unknown_stop'),
      }),
      (error: unknown) => error instanceof InfraMutationBlockedError && error.state === 'unknown_stop',
    ));
    assert.equal(syncCalls, 0);
  });
}

test('sync from a non-primary-worktree checkout proceeds once ownership is proven', async () => {
  let syncCalls = 0;
  let actorReceived: string | undefined;
  const service = {
    sync: async (actor: string) => {
      syncCalls += 1;
      actorReceived = actor;
      return { ok: true, state: 'synced', local: 'a', github: 'a' };
    },
  } as unknown as SourceControlService;
  await withArgv(['sync', '--task-ref', '1470', '--actor', 'isolated-task-agent'], () => main({
    service,
    resolveCheckoutKind: async () => 'linked_worktree',
    probeOwnership: async () => ownershipResult('isolated_agent'),
  }));
  assert.equal(syncCalls, 1);
  assert.equal(actorReceived, 'isolated-task-agent');
});

test('sync from the primary worktree proceeds without --task-ref (Alden Build Guardian / operator path unaffected)', async () => {
  let syncCalls = 0;
  const service = fakeService(async () => {
    syncCalls += 1;
    return { ok: true, state: 'synced', local: 'a', github: 'a' };
  });
  let probeCalled = false;
  await withArgv(['sync', '--actor', 'alden-build-guardian', '--machine-readable'], () => main({
    service,
    resolveCheckoutKind: async () => 'primary_worktree',
    // If the primary-worktree path ever started consulting ownership, this
    // would flip true -- the Guardian and `npm run source-control:sync`
    // must never be asked to prove a task ref they don't have.
    probeOwnership: async () => {
      probeCalled = true;
      return ownershipResult('unknown_stop');
    },
  }));
  assert.equal(syncCalls, 1, 'the primary-worktree sync path must be unaffected by the new gate');
  assert.equal(probeCalled, false, 'the primary-worktree path must not consult the ownership probe at all');
});
