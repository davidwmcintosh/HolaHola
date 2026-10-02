// Task #1470: server/services/source-promotion-service.ts's `sync` action is
// reachable over plain authenticated HTTP
// (POST /api/admin/source-promotion/sync, gated only by the dedicated
// SOURCE_PROMOTION_TOKEN bearer token) and, once invoked, calls
// SourceControlService.sync() -- a real credentialed push to GitHub `main`
// -- entirely inside the already-running main server process. Unlike
// server/scripts/source-control-cli.ts, there is no "checkout kind" to read
// here: the server process is always the primary worktree no matter which
// caller sent the HTTP request. These tests prove the new ownership gate
// refuses before any mutation is attempted, both at the service layer and
// through the real Express routes, and that `prepare`/`record` (which never
// call an external write API) remain deliberately ungated.
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SourcePromotionService,
} from '../services/source-promotion-service';
import {
  registerSourcePromotionRoutes,
} from '../routes/source-promotion-routes';
import { InfraMutationBlockedError, type OwnershipProbe } from '../services/infra-mutation-guard';
import type { TaskOwnershipResult } from '../services/task-ownership-service';

const TOKEN = 'promotion-sync-guard-test-token';

function ownershipResult(state: TaskOwnershipResult['state']): TaskOwnershipResult {
  return {
    ok: state !== 'unknown_stop',
    state,
    taskRef: '1470',
    evidence: {
      taskRef: '1470',
      taskArtifact: { path: '/dev/null', exists: false, regularFile: false },
      checkout: { kind: 'primary_worktree', gitMetadataPath: '/dev/null' },
      verifiedActiveMainReceipt: state === 'main_session',
      verifiedActiveIsolatedProof: state === 'isolated_agent',
    },
    contradictions: [],
    explanation: `stub:${state}`,
  };
}

function makeService(dir: string, probeOwnership?: OwnershipProbe) {
  return new SourcePromotionService({
    rootDir: dir,
    env: {
      ...process.env,
      SOURCE_PROMOTION_API_ENABLED: 'true',
      SOURCE_PROMOTION_TOKEN: TOKEN,
      SOURCE_BRIDGE_STATUS_FILE: join(dir, 'bridge-status.json'),
      SOURCE_PROMOTION_REQUESTS_DIR: join(dir, 'requests'),
    },
    execBridge: async () => {
      throw new Error('execBridge must not run when the ownership gate should have refused first');
    },
    probeOwnership,
  });
}

test('sync() refuses before writing any request state when ownership is unknown_stop', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'source-promotion-sync-guard-'));
  try {
    const service = makeService(dir, async () => ownershipResult('unknown_stop'));
    await assert.rejects(
      () => service.sync({ idempotencyKey: 'sync-request-000001', actor: 'claude-code', taskRef: '1470' }),
      (error: unknown) => error instanceof InfraMutationBlockedError
        && error.state === 'unknown_stop'
        && error.taskRef === '1470'
        && error.action === 'source-promotion:sync',
    );
    const { requests } = await service.getStatus();
    assert.equal(requests.length, 0, 'no request record should be durably written for a refused sync');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('sync() proceeds to the source-control operation once ownership is proven', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'source-promotion-sync-guard-'));
  try {
    let syncCalls = 0;
    const service = new SourcePromotionService({
      rootDir: dir,
      env: {
        ...process.env,
        SOURCE_PROMOTION_API_ENABLED: 'true',
        SOURCE_PROMOTION_TOKEN: TOKEN,
        SOURCE_BRIDGE_STATUS_FILE: join(dir, 'bridge-status.json'),
        SOURCE_PROMOTION_REQUESTS_DIR: join(dir, 'requests'),
      },
      sourceControlService: {
        sync: async () => {
          syncCalls += 1;
          return { ok: true, state: 'synced', local: 'a', github: 'a' };
        },
      } as any,
      probeOwnership: async () => ownershipResult('main_session'),
    });
    const { request } = await service.sync({ idempotencyKey: 'sync-request-000002', actor: 'claude-code', taskRef: '1470' });
    await service.waitForRequest(request.requestId);
    assert.equal(syncCalls, 1, 'the gate must allow the real source-control sync to be attempted once ownership is proven');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const action of ['prepare', 'record'] as const) {
  test(`${action}() never consults ownership (no external mutation to gate)`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'source-promotion-sync-guard-'));
    try {
      let probeCalled = false;
      const service = makeService(dir, async () => {
        probeCalled = true;
        return ownershipResult('unknown_stop');
      });
      const input = action === 'record'
        ? { idempotencyKey: `${action}-request-000001`, actor: 'claude-code', sha: 'a'.repeat(40) }
        : { idempotencyKey: `${action}-request-000001`, actor: 'claude-code' };
      // Neither action ever reaches execBridge here: `prepare` fails inside
      // it (the injected execBridge always throws) and `record` fails even
      // earlier because no bridge-status fixture exists in this temp dir.
      // Either way, what this test proves is that the ownership probe is
      // never consulted for these actions -- matching the CLI's
      // prepare/record scope exclusion for the identical reason: neither
      // performs a git push or any other credentialed external-system
      // write, so task #1470 does not require gating them.
      const { request } = await (service as any)[action](input);
      const finished = await service.waitForRequest(request.requestId);
      assert.equal(finished?.status, 'failed');
      assert.equal(probeCalled, false, `${action} must not consult the ownership probe at all`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

async function withHttpServer<T>(
  service: SourcePromotionService,
  fn: (base: string) => Promise<T>,
): Promise<T> {
  // requireSourcePromotionToken (server/routes/source-promotion-routes.ts)
  // authenticates against the real process.env.SOURCE_PROMOTION_TOKEN, not
  // the `env` object injected into SourcePromotionService -- matching the
  // existing server/scripts/test-source-promotion-api.ts convention of
  // temporarily setting it around a real-HTTP assertion.
  const previousToken = process.env.SOURCE_PROMOTION_TOKEN;
  process.env.SOURCE_PROMOTION_TOKEN = TOKEN;
  const app = express();
  app.use(express.json());
  registerSourcePromotionRoutes(app, service);
  const httpServer = createServer(app);
  await new Promise<void>((resolveListen) => httpServer.listen(0, '127.0.0.1', resolveListen));
  try {
    const address = httpServer.address();
    if (!address || typeof address !== 'object') throw new Error('expected a bound TCP address');
    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolveClose) => httpServer.close(() => resolveClose()));
    if (previousToken === undefined) delete process.env.SOURCE_PROMOTION_TOKEN;
    else process.env.SOURCE_PROMOTION_TOKEN = previousToken;
  }
}

test('POST /sync over real HTTP rejects a missing x-source-promotion-task-ref header with 400', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'source-promotion-sync-guard-'));
  try {
    let probeCalled = false;
    const service = makeService(dir, async () => {
      probeCalled = true;
      return ownershipResult('main_session');
    });
    await withHttpServer(service, async (base) => {
      const res = await fetch(`${base}/api/admin/source-promotion/sync`, {
        method: 'POST',
        headers: {
          'x-source-promotion-token': TOKEN,
          'x-source-promotion-actor': 'claude-code',
          'idempotency-key': 'sync-http-request-0001',
        },
      });
      assert.equal(res.status, 400);
      const body = await res.json() as { error: string };
      assert.match(body.error, /x-source-promotion-task-ref/);
    });
    assert.equal(probeCalled, false, 'a request rejected for a missing task-ref must never reach the ownership probe');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('POST /sync over real HTTP returns 403 when ownership resolves to unknown_stop', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'source-promotion-sync-guard-'));
  try {
    const service = makeService(dir, async () => ownershipResult('unknown_stop'));
    await withHttpServer(service, async (base) => {
      const res = await fetch(`${base}/api/admin/source-promotion/sync`, {
        method: 'POST',
        headers: {
          'x-source-promotion-token': TOKEN,
          'x-source-promotion-actor': 'claude-code',
          'idempotency-key': 'sync-http-request-0002',
          'x-source-promotion-task-ref': '1470',
        },
      });
      assert.equal(res.status, 403);
      const body = await res.json() as { error: string; state: string };
      assert.equal(body.state, 'unknown_stop');
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('POST /sync over real HTTP proceeds when ownership is proven', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'source-promotion-sync-guard-'));
  try {
    let syncCalls = 0;
    const service = new SourcePromotionService({
      rootDir: dir,
      env: {
        ...process.env,
        SOURCE_PROMOTION_API_ENABLED: 'true',
        SOURCE_PROMOTION_TOKEN: TOKEN,
        SOURCE_BRIDGE_STATUS_FILE: join(dir, 'bridge-status.json'),
        SOURCE_PROMOTION_REQUESTS_DIR: join(dir, 'requests'),
      },
      sourceControlService: {
        sync: async () => {
          syncCalls += 1;
          return { ok: true, state: 'synced', local: 'a', github: 'a' };
        },
      } as any,
      probeOwnership: async () => ownershipResult('isolated_agent'),
    });
    await withHttpServer(service, async (base) => {
      const res = await fetch(`${base}/api/admin/source-promotion/sync`, {
        method: 'POST',
        headers: {
          'x-source-promotion-token': TOKEN,
          'x-source-promotion-actor': 'claude-code',
          'idempotency-key': 'sync-http-request-0003',
          'x-source-promotion-task-ref': '1470',
        },
      });
      assert.equal(res.status, 202);
      const body = await res.json() as { request: { requestId: string } };
      // The response is 202 Accepted -- the sync runs to completion in the
      // background. Wait for it before asserting or tearing down the temp
      // dir, or the in-flight write races the test's own cleanup.
      await service.waitForRequest(body.request.requestId);
    });
    assert.equal(syncCalls, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
