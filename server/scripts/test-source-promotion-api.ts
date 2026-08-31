import assert from 'node:assert/strict';
import express from 'express';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import {
  SourcePromotionConflictError,
  SourcePromotionInputError,
  SourcePromotionService,
  authenticateSourcePromotionToken,
  sourcePromotionApiEnabled,
} from '../services/source-promotion-service';
import {
  registerDisabledSourcePromotionRoutes,
  registerSourcePromotionRoutes,
} from '../routes/source-promotion-routes';

const SHA = 'a'.repeat(40);
const OTHER_SHA = 'b'.repeat(40);
const TOKEN = 'promotion-test-token';
const NOW = new Date('2026-08-27T18:00:00.000Z');

function writeBridgeStatus(path: string, value: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function validManifest(sha: string): Record<string, unknown> {
  const manifestVersion = 2;
  const checks = {
    typecheck: 'passed',
    build: 'passed',
    ciUnit: 'passed',
    ciGuards: 'passed',
    ciEpisodes: 'passed',
    sourceBridgeSafety: 'passed',
    githubReleaseSafety: 'passed',
    githubSyncShellGuards: 'passed',
  };
  return {
    manifestVersion,
    candidateSha: sha,
    checks,
    validationId: createHash('sha256')
      .update(JSON.stringify({ manifestVersion, candidateSha: sha, checks }))
      .digest('hex'),
  };
}

async function main(): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), 'holahola-source-promotion-test-'));
  const bridgeStatusPath = join(dir, 'bridge-status.json');
  const requestsDir = join(dir, 'requests');
  let uuidCounter = 0;
  let executions = 0;
  const env = {
    ...process.env,
    SOURCE_PROMOTION_API_ENABLED: 'true',
    SOURCE_PROMOTION_TOKEN: TOKEN,
    SOURCE_BRIDGE_STATUS_FILE: bridgeStatusPath,
    SOURCE_PROMOTION_REQUESTS_DIR: requestsDir,
  };

  const service = new SourcePromotionService({
    rootDir: dir,
    env,
    now: () => new Date(NOW),
    uuid: () => `test-id-${++uuidCounter}`,
    execBridge: async (args, options) => {
      executions += 1;
      assert.equal(options.env.SOURCE_PROMOTION_VERIFICATION_MODE, args[0] === 'record-promotion' ? 'operator_attestation' : '');
      if (args[0] === 'prepare-promotion') {
        writeBridgeStatus(bridgeStatusPath, {
          schemaVersion: 2,
          state: 'ready_to_promote',
          candidateSha: SHA,
          candidateExpiresAt: '2026-08-27T19:00:00.000Z',
          validationManifestVersion: 2,
          validation: validManifest(SHA),
        });
      } else {
        assert.deepEqual(args, ['record-promotion', SHA]);
        writeBridgeStatus(bridgeStatusPath, {
          schemaVersion: 2,
          state: 'synced',
          candidateSha: SHA,
          promotedSha: SHA,
          promotionVerificationMode: 'operator_attestation',
        });
      }
      return { exitCode: 0, stdout: 'ok', stderr: '' };
    },
  });

  try {
    assert.equal(sourcePromotionApiEnabled(env), true, 'API requires both the flag and dedicated token');
    assert.equal(sourcePromotionApiEnabled({ SOURCE_PROMOTION_API_ENABLED: 'true' }), false, 'missing token fails closed');
    assert.equal(authenticateSourcePromotionToken(TOKEN, env), true, 'exact dedicated token authenticates');
    assert.equal(authenticateSourcePromotionToken(`${TOKEN}-wrong`, env), false, 'wrong-length token fails safely');

    const first = await service.prepare({
      idempotencyKey: 'prepare-request-0001',
      actor: 'claude-code',
    });
    assert.equal(first.replayed, false);
    const prepared = await service.waitForRequest(first.request.requestId);
    assert.equal(prepared?.status, 'succeeded');
    assert.equal(prepared?.bridgeState, 'ready_to_promote');
    assert.equal(executions, 1);

    const replay = await service.prepare({
      idempotencyKey: 'prepare-request-0001',
      actor: 'claude-code',
    });
    assert.equal(replay.replayed, true, 'same request must replay the durable result');
    assert.equal(replay.request.requestId, first.request.requestId);
    assert.equal(executions, 1, 'idempotent replay must not execute the bridge again');

    await assert.rejects(
      service.record({
        idempotencyKey: 'prepare-request-0001',
        actor: 'claude-code',
        sha: SHA,
      }),
      SourcePromotionConflictError,
      'an idempotency key cannot be reused for different payload or action',
    );

    const stale = await service.record({
      idempotencyKey: 'record-stale-00001',
      actor: 'claude-code',
      sha: OTHER_SHA,
    });
    const staleResult = await service.waitForRequest(stale.request.requestId);
    assert.equal(staleResult?.status, 'failed');
    assert.match(staleResult?.error || '', /not the current unexpired/);
    assert.equal(executions, 1, 'stale record must fail before bridge execution');

    writeBridgeStatus(bridgeStatusPath, {
      schemaVersion: 2,
      state: 'ready_to_promote',
      candidateSha: SHA,
      candidateExpiresAt: '2026-08-27T19:00:00.000Z',
    });
    const missingManifest = await service.record({
      idempotencyKey: 'record-no-manifest1',
      actor: 'claude-code',
      sha: SHA,
    });
    const missingManifestResult = await service.waitForRequest(missingManifest.request.requestId);
    assert.equal(missingManifestResult?.status, 'failed');
    assert.match(missingManifestResult?.error || '', /validation manifest/);
    assert.equal(executions, 1, 'missing manifest must fail before bridge execution');

    writeBridgeStatus(bridgeStatusPath, {
      schemaVersion: 2,
      state: 'ready_to_promote',
      candidateSha: SHA,
      candidateExpiresAt: '2026-08-27T19:00:00.000Z',
      validation: validManifest(SHA),
    });
    const record = await service.record({
      idempotencyKey: 'record-valid-00001',
      actor: 'claude-code',
      sha: SHA,
      publicationReference: 'Replit Publish confirmed by operator',
    });
    const recorded = await service.waitForRequest(record.request.requestId);
    assert.equal(recorded?.status, 'succeeded');
    assert.equal(recorded?.verificationMode, 'operator_attestation');
    assert.equal(executions, 2);

    await assert.rejects(
      service.record({
        idempotencyKey: 'record-invalid-sha',
        actor: 'claude-code',
        sha: 'main',
      }),
      SourcePromotionInputError,
    );

    const orphanKeyHash = 'c'.repeat(64);
    writeFileSync(join(requestsDir, `${orphanKeyHash}.json`), `${JSON.stringify({
      schemaVersion: 1,
      requestId: 'orphan-request',
      idempotencyKeyHash: orphanKeyHash,
      payloadDigest: 'd'.repeat(64),
      action: 'prepare',
      actor: 'claude-code',
      status: 'running',
      bootId: 'old-boot',
      createdAt: '2026-08-27T17:00:00.000Z',
    })}\n`);
    const status = await service.getStatus();
    assert.equal(
      status.requests.find((request) => request.requestId === 'orphan-request')?.status,
      'ambiguous',
      'running requests from an earlier boot must become explicit ambiguous outcomes',
    );
    assert.match(readFileSync(join(requestsDir, `${orphanKeyHash}.json`), 'utf8'), /ambiguous/);

    const previousToken = process.env.SOURCE_PROMOTION_TOKEN;
    process.env.SOURCE_PROMOTION_TOKEN = TOKEN;
    const app = express();
    app.use(express.json());
    registerSourcePromotionRoutes(app, service);
    const httpServer = createServer(app);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    try {
      const address = httpServer.address();
      assert.ok(address && typeof address === 'object');
      const base = `http://127.0.0.1:${address.port}`;
      const unauthorized = await fetch(`${base}/api/admin/source-promotion/status`);
      assert.equal(unauthorized.status, 401);

      const missingHeaders = await fetch(`${base}/api/admin/source-promotion/prepare`, {
        method: 'POST',
        headers: { 'x-source-promotion-token': TOKEN, 'content-type': 'application/json' },
        body: '{}',
      });
      assert.equal(missingHeaders.status, 400);

      const authorized = await fetch(`${base}/api/admin/source-promotion/status`, {
        headers: { 'x-source-promotion-token': TOKEN },
      });
      assert.equal(authorized.status, 200);
      const body = await authorized.json() as any;
      assert.equal(body.publishBoundary.programmaticPublishSupported, false);
      assert.equal(body.publishBoundary.recordVerification, 'operator_attestation');
    } finally {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      if (previousToken === undefined) delete process.env.SOURCE_PROMOTION_TOKEN;
      else process.env.SOURCE_PROMOTION_TOKEN = previousToken;
    }

    const disabledApp = express();
    registerDisabledSourcePromotionRoutes(disabledApp);
    const disabledServer = createServer(disabledApp);
    await new Promise<void>((resolve) => disabledServer.listen(0, '127.0.0.1', resolve));
    try {
      const address = disabledServer.address();
      assert.ok(address && typeof address === 'object');
      const disabled = await fetch(`http://127.0.0.1:${address.port}/api/admin/source-promotion/status`);
      assert.equal(disabled.status, 404, 'disabled API prefix must not fall through to an SPA 200');
      assert.deepEqual(await disabled.json(), { error: 'Source-promotion API is disabled.' });
    } finally {
      await new Promise<void>((resolve) => disabledServer.close(() => resolve()));
    }

    console.log('Source-promotion API safety checks passed.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});