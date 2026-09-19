import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertOwnershipForInfraMutation,
  InfraMutationBlockedError,
} from '../services/infra-mutation-guard';
import { CloudflareDnsService } from '../services/cloudflare-dns-service';
import {
  createGitHubPublishOwnershipProbe,
  createSharedSpecGitHubPublishGuard,
} from '../services/shared-spec-github-publish-guard';
import type { SpecPublicationProviderContext } from '../services/shared-spec-publication';
import type { TaskOwnershipResult } from '../services/task-ownership-service';

function ownershipResult(state: TaskOwnershipResult['state']): TaskOwnershipResult {
  return {
    ok: state !== 'unknown_stop',
    state,
    taskRef: '1455',
    evidence: {
      taskRef: '1455',
      taskArtifact: { path: '/dev/null', exists: false, regularFile: false },
      checkout: { kind: 'primary_worktree', gitMetadataPath: '/dev/null' },
      verifiedActiveMainReceipt: state === 'main_session',
    },
    contradictions: [],
    explanation: `stub:${state}`,
  };
}

/**
 * Mirrors test-task-ownership-service.ts's fixture(): TaskOwnershipService
 * (which createGitHubPublishOwnershipProbe delegates to) reads real
 * filesystem evidence -- the task artifact file and the checkout kind -- so
 * a composition-level test needs a real temp directory, not a mock.
 */
async function taskOwnershipFixture(taskRef: string) {
  const root = await mkdtemp(join(tmpdir(), 'github-publish-guard-'));
  await mkdir(join(root, '.git'));
  const taskDir = join(root, '.local', 'tasks');
  await mkdir(taskDir, { recursive: true });
  await writeFile(join(taskDir, `task-${taskRef}.md`), '# fixture task\n');
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('assertOwnershipForInfraMutation refuses on unknown_stop', async () => {
  const probe = async () => ownershipResult('unknown_stop');
  await assert.rejects(
    () => assertOwnershipForInfraMutation('1455', 'test:action', probe),
    (error: unknown) => error instanceof InfraMutationBlockedError
      && error.state === 'unknown_stop'
      && error.taskRef === '1455'
      && error.action === 'test:action',
  );
});

test('assertOwnershipForInfraMutation proceeds for main_session and isolated_agent', async () => {
  for (const state of ['main_session', 'isolated_agent'] as const) {
    const probe = async () => ownershipResult(state);
    const result = await assertOwnershipForInfraMutation('1455', 'test:action', probe);
    assert.equal(result.state, state);
  }
});

test('CloudflareDnsService.updateDnsRecordContent never calls fetch when ownership is unknown_stop', async () => {
  let fetchCalls = 0;
  const fetchImpl = (async () => {
    fetchCalls += 1;
    throw new Error('fetch must not be called when ownership is unknown_stop');
  }) as unknown as typeof fetch;
  const service = new CloudflareDnsService({
    apiToken: 'test-token',
    fetchImpl,
    probeOwnership: async () => ownershipResult('unknown_stop'),
  });
  await assert.rejects(
    () => service.updateDnsRecordContent('1455', 'zone-1', 'record-1', 'new.target.example'),
    (error: unknown) => error instanceof InfraMutationBlockedError && error.state === 'unknown_stop',
  );
  assert.equal(fetchCalls, 0, 'the gate must refuse before any network call is attempted');
});

test('CloudflareDnsService.updateDnsRecordContent calls Cloudflare exactly once when ownership is proven', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        result: {
          id: 'record-1', name: 'getholahola.com', type: 'CNAME',
          content: 'new.target.example', proxied: false,
        },
      }),
    } as Response;
  }) as unknown as typeof fetch;
  const service = new CloudflareDnsService({
    apiToken: 'test-token',
    fetchImpl,
    probeOwnership: async () => ownershipResult('main_session'),
  });
  const record = await service.updateDnsRecordContent('1455', 'zone-1', 'record-1', 'new.target.example');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/zones\/zone-1\/dns_records\/record-1$/);
  assert.equal(calls[0].init?.method, 'PATCH');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { content: 'new.target.example' });
  assert.equal(record.content, 'new.target.example');
});

test('CloudflareDnsService.listDnsRecords is read-only and does not consult ownership', async () => {
  let fetchCalls = 0;
  const fetchImpl = (async () => {
    fetchCalls += 1;
    return {
      ok: true,
      status: 200,
      json: async () => ({ success: true, result: [] }),
    } as Response;
  }) as unknown as typeof fetch;
  // No probeOwnership is provided. If the read path ever started consulting
  // ownership, this would silently fall through to a *real*
  // TaskOwnershipService probe and could behave unpredictably in CI.
  const service = new CloudflareDnsService({ apiToken: 'test-token', fetchImpl });
  const records = await service.listDnsRecords('zone-1');
  assert.deepEqual(records, []);
  assert.equal(fetchCalls, 1);
});

test('createSharedSpecGitHubPublishGuard refuses when no taskRef is supplied', async () => {
  const probe = async () => ownershipResult('main_session'); // proves the refusal is not from a failing probe
  const guard = createSharedSpecGitHubPublishGuard(probe);
  await assert.rejects(
    () => guard({ actorId: 'luca-replit' }, 'github_spec_publish:hola/specs:docs/superpowers/specs/approved.md'),
    (error: unknown) => error instanceof InfraMutationBlockedError && error.state === 'unknown_stop',
  );
});

test('createSharedSpecGitHubPublishGuard refuses when no actorId is supplied', async () => {
  const probe = async () => ownershipResult('main_session'); // proves the refusal is not from a failing probe
  const guard = createSharedSpecGitHubPublishGuard(probe);
  await assert.rejects(
    () => guard({ taskRef: '1455' } as SpecPublicationProviderContext, 'github_spec_publish:hola/specs:docs/superpowers/specs/approved.md'),
    (error: unknown) => error instanceof InfraMutationBlockedError
      && error.state === 'unknown_stop'
      && error.taskRef === '1455',
  );
});

test('createSharedSpecGitHubPublishGuard refuses when the supplied taskRef resolves to unknown_stop', async () => {
  const probe = async () => ownershipResult('unknown_stop');
  const guard = createSharedSpecGitHubPublishGuard(probe);
  await assert.rejects(
    () => guard({ taskRef: '1455', actorId: 'luca-replit' }, 'github_spec_publish:hola/specs:docs/superpowers/specs/approved.md'),
    (error: unknown) => error instanceof InfraMutationBlockedError
      && error.state === 'unknown_stop'
      && error.taskRef === '1455',
  );
});

test('createSharedSpecGitHubPublishGuard proceeds for main_session and isolated_agent, threading actorId to the probe', async () => {
  for (const state of ['main_session', 'isolated_agent'] as const) {
    let probed: { taskRef?: string; actorId?: string } = {};
    const probe = async (taskRef: string, actorId?: string) => { probed = { taskRef, actorId }; return ownershipResult(state); };
    const guard = createSharedSpecGitHubPublishGuard(probe);
    await guard({ taskRef: '1455', actorId: 'luca-replit' }, 'github_spec_publish:hola/specs:docs/superpowers/specs/approved.md');
    assert.deepEqual(probed, { taskRef: '1455', actorId: 'luca-replit' });
  }
});

test('createGitHubPublishOwnershipProbe: composition-level allow-path — a matching, unexpired receipt reaches isolated_agent through a real TaskOwnershipService', async () => {
  const f = await taskOwnershipFixture('1455');
  try {
    const receiptChecks: Array<[string, string]> = [];
    const hasActiveReceipt = async (taskRef: string, actorId: string) => {
      receiptChecks.push([taskRef, actorId]);
      return taskRef === '1455' && actorId === 'luca-replit';
    };
    const probe = createGitHubPublishOwnershipProbe(hasActiveReceipt, f.root);
    const guard = createSharedSpecGitHubPublishGuard(probe);
    await guard({ taskRef: '1455', actorId: 'luca-replit' }, 'github_spec_publish:hola/specs:docs/superpowers/specs/approved.md');
    assert.deepEqual(receiptChecks, [['1455', 'luca-replit']]);
  } finally { await f.cleanup(); }
});

test('createGitHubPublishOwnershipProbe refuses when a different actor claims an active taskRef\'s receipt', async () => {
  const f = await taskOwnershipFixture('1455');
  try {
    const hasActiveReceipt = async (taskRef: string, actorId: string) => taskRef === '1455' && actorId === 'luca-replit';
    const probe = createGitHubPublishOwnershipProbe(hasActiveReceipt, f.root);
    const guard = createSharedSpecGitHubPublishGuard(probe);
    await assert.rejects(
      () => guard({ taskRef: '1455', actorId: 'luca-claude-code' }, 'github_spec_publish:hola/specs:docs/superpowers/specs/approved.md'),
      (error: unknown) => error instanceof InfraMutationBlockedError && error.state === 'unknown_stop',
    );
  } finally { await f.cleanup(); }
});

test('createGitHubPublishOwnershipProbe refuses a taskRef with no active receipt, even for a real actor', async () => {
  const f = await taskOwnershipFixture('9999');
  try {
    const probe = createGitHubPublishOwnershipProbe(async () => false, f.root);
    const guard = createSharedSpecGitHubPublishGuard(probe);
    await assert.rejects(
      () => guard({ taskRef: '9999', actorId: 'luca-replit' }, 'github_spec_publish:hola/specs:docs/superpowers/specs/approved.md'),
      (error: unknown) => error instanceof InfraMutationBlockedError && error.state === 'unknown_stop',
    );
  } finally { await f.cleanup(); }
});

test('createGitHubPublishOwnershipProbe refuses when the taskRef has no matching task artifact on disk, even with a valid receipt', async () => {
  const f = await taskOwnershipFixture('1455'); // fixture only has an artifact for task 1455
  try {
    const probe = createGitHubPublishOwnershipProbe(async () => true, f.root);
    const guard = createSharedSpecGitHubPublishGuard(probe);
    await assert.rejects(
      () => guard({ taskRef: '4242', actorId: 'luca-replit' }, 'github_spec_publish:hola/specs:docs/superpowers/specs/approved.md'),
      (error: unknown) => error instanceof InfraMutationBlockedError && error.state === 'unknown_stop',
    );
  } finally { await f.cleanup(); }
});
