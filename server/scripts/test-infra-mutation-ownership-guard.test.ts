import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertOwnershipForInfraMutation,
  InfraMutationBlockedError,
} from '../services/infra-mutation-guard';
import { CloudflareDnsService } from '../services/cloudflare-dns-service';
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
