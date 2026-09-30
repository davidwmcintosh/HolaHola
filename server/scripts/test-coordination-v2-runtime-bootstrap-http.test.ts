import assert from 'node:assert/strict';
import test from 'node:test';
import express, { type RequestHandler } from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CoordinationV2RuntimeError,
  issueCoordinationV2RuntimeBootstrapManifest,
  type RuntimeReleaseInput,
} from '../services/coordination-v2-runtime-bootstrap-service';
import { registerCoordinationV2RuntimeBootstrapRoutes } from '../routes/coordination-v2-runtime-bootstrap-routes';

type Json = Record<string, unknown>;
type Seen = {
  publish?: RuntimeReleaseInput;
  issue?: Json;
  stream?: Json;
  acknowledge?: Json;
  status?: Json;
  revoke?: Json;
  artifactsRequestedFor?: string;
  sourceMembersRequestedFor?: { repositoryIdentity: string; promotedCommitSha: string };
};

const seen: Seen = {};
let publishCreated = true;
let publishFailure: Error | undefined;
let server: Server;
let baseUrl: string;

let currentSourcePromotion: Record<string, unknown> | undefined = {
  id: 'source-1',
  repository_identity: 'org/repo',
  promoted_commit_sha: 'a'.repeat(40),
  exact_tree_sha: 'b'.repeat(40),
  created_at: '2026-01-01T00:00:00.000Z',
};
let currentRuntimeRelease: Record<string, unknown> | undefined = {
  id: 'release-1',
  source_promotion_id: 'source-1',
  promoted_commit_sha: 'a'.repeat(40),
  published_at: '2026-01-01T00:00:00.000Z',
};
const previewArtifacts = [{
  role: 'node_executable' as const,
  fixedDestination: 'runtime/node.exe',
  objectKey: 'coordination-v2/runtime/aa/node.exe',
  objectDigest: 'c'.repeat(64),
  byteLength: 10,
  mediaType: 'application/octet-stream',
  requiresAuthenticode: false,
}];
const previewMembers = [{ fixedPath: 'scripts/hola-coordinator.ps1', sha256: 'e'.repeat(64) }];

const founderMiddleware: RequestHandler = (req, res, next) => {
  const actor = req.header('x-founder-actor');
  if (!actor) {
    res.status(401).json({ error: { code: 'V2_FOUNDER_AUTH_REQUIRED' } });
    return;
  }
  if (actor !== 'founder-1') {
    res.status(403).json({ error: { code: 'V2_FOUNDER_REQUIRED' } });
    return;
  }
  (req as Request & { authenticatedUser?: { id: string } }).authenticatedUser = { id: actor };
  next();
};

const hostAuthMiddleware: RequestHandler = (req, res, next) => {
  const hostToken = req.header('x-host-token');
  if (!hostToken) {
    res.status(401).json({ error: { code: 'V2_HOST_AUTH_REQUIRED' } });
    return;
  }
  if (hostToken !== 'host-token') {
    res.status(403).json({ error: { code: 'V2_HOST_AUTH_DENIED' } });
    return;
  }
  (req as Request & { coordinationV2Host?: { hostEnrollmentId: string } }).coordinationV2Host = {
    hostEnrollmentId: 'enrolled-host-1',
  };
  next();
};

const app = express();
app.use(express.json());
registerCoordinationV2RuntimeBootstrapRoutes(app, {
  founderMiddleware: [founderMiddleware],
  hostAuthMiddleware,
  publish: async (input) => {
    seen.publish = input;
    if (publishFailure) throw publishFailure;
    return publishCreated
      ? { created: true, runtimeReleaseId: 'release-1', releaseDigest: 'a'.repeat(64), publishedAt: '2026-01-01T00:00:00.000Z' }
      : { created: false, runtimeReleaseId: 'release-1', releaseDigest: 'a'.repeat(64), publishedAt: '2026-01-01T00:00:00.000Z' };
  },
  issueManifest: async (input) => {
    seen.issue = input as unknown as Json;
    return {
      created: true,
      issueId: 'issue-1',
      expiresAt: '2026-01-01T00:05:00.000Z',
      payload: { protocolVersion: 1, kind: 'runtime_bootstrap_manifest' },
      canonicalResponseDigest: 'b'.repeat(64),
      signature: 'signature',
      keyFingerprint: 'fingerprint',
      privateKey: 'must-not-leak',
    } as unknown as Awaited<ReturnType<typeof issueCoordinationV2RuntimeBootstrapManifest>>;
  },
  streamArtifact: async (input, res) => {
    seen.stream = input as unknown as Json;
    res.status(200).set({
      'content-type': 'application/octet-stream',
      'content-length': '8',
      etag: '"c'.repeat(64) + '"',
    }).end('artifact');
  },
  acknowledge: async (input) => {
    seen.acknowledge = input as unknown as Json;
    return { created: true, acknowledgementId: 'ack-1', acknowledgedAt: '2026-01-01T00:00:00.000Z', acknowledgementDigest: 'd'.repeat(64) };
  },
  status: async (input) => {
    seen.status = input as unknown as Json;
    return { acknowledged: false, executionPreflightMayProceed: false };
  },
  revoke: async (input) => {
    seen.revoke = input as unknown as Json;
    return { created: true, revoked: true, revokedAt: '2026-01-01T00:00:00.000Z' };
  },
  latestPublishedSourcePromotion: async () => currentSourcePromotion,
  latestRuntimeRelease: async () => currentRuntimeRelease,
  latestRuntimeReleaseArtifacts: async (runtimeReleaseId) => {
    seen.artifactsRequestedFor = runtimeReleaseId;
    return previewArtifacts;
  },
  previewSourceMembers: async (repositoryIdentity, promotedCommitSha) => {
    seen.sourceMembersRequestedFor = { repositoryIdentity, promotedCommitSha };
    return previewMembers;
  },
});

async function request(path: string, init: RequestInit = {}): Promise<{
  status: number;
  headers: Headers;
  body: Json | string;
}> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...(init.headers ?? {}) },
  });
  const type = response.headers.get('content-type') ?? '';
  return {
    status: response.status,
    headers: response.headers,
    body: type.includes('json') ? await response.json() as Json : await response.text(),
  };
}

function json(method: string, path: string, value: Json, headers: Record<string, string> = {}) {
  return request(path, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(value),
  });
}

test.before(async () => {
  await new Promise<void>((resolve, reject) => {
    server = createServer(app);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('host and founder boundaries reject unauthenticated and non-founder callers', async () => {
  const hostUnauthenticated = await request('/api/coordination/v2/host/runtime-bootstrap/status');
  assert.equal(hostUnauthenticated.status, 401);
  assert.deepEqual(hostUnauthenticated.body, { error: { code: 'V2_HOST_AUTH_REQUIRED' } });
  const hostWrong = await request('/api/coordination/v2/host/runtime-bootstrap/status', {
    headers: { 'x-host-token': 'wrong' },
  });
  assert.equal(hostWrong.status, 403);
  const founderUnauthenticated = await json('POST', '/api/internal/coordination/v2/runtime-releases', {});
  assert.equal(founderUnauthenticated.status, 401);
  const nonFounder = await json('POST', '/api/internal/coordination/v2/runtime-releases', {}, {
    'x-founder-actor': 'not-founder',
  });
  assert.equal(nonFounder.status, 403);
});

test('publish strictly filters keys, ignores body identity, and preserves created/replay status', async () => {
  const body = {
    sourcePromotionId: 'source-1',
    artifacts: [{ role: 'node_executable' }],
    sourceMembers: [{ fixedPath: 'x', sha256: 'y' }],
  };
  const unknown = await json('POST', '/api/internal/coordination/v2/runtime-releases', {
    ...body, extra: true,
  }, { 'x-founder-actor': 'founder-1' });
  assert.equal(unknown.status, 422);
  assert.deepEqual(unknown.body, { error: { code: 'V2_RUNTIME_INVALID_REQUEST' } });
  const created = await json('POST', '/api/internal/coordination/v2/runtime-releases', body, {
    'x-founder-actor': 'founder-1',
  });
  assert.equal(created.status, 201);
  assert.deepEqual(seen.publish, {
    sourcePromotionId: 'source-1',
    artifacts: body.artifacts,
    sourceMembers: body.sourceMembers,
  });
  publishCreated = false;
  const replay = await json('POST', '/api/internal/coordination/v2/runtime-releases', {
    sourcePromotionId: 'source-1', artifacts: [], sourceMembers: [],
  }, { 'x-founder-actor': 'founder-1' });
  assert.equal(replay.status, 200);
});

test('issue returns only the signed envelope and host identity is middleware-bound', async () => {
  const response = await json('POST', '/api/coordination/v2/host/runtime-bootstrap/issues', {
    requestKey: 'request-1', protocolVersion: 1, hostEnrollmentId: 'body-forged-host',
  }, { 'x-host-token': 'host-token' });
  assert.equal(response.status, 422);
  assert.deepEqual(response.body, { error: { code: 'V2_RUNTIME_INVALID_REQUEST' } });
  const valid = await json('POST', '/api/coordination/v2/host/runtime-bootstrap/issues', {
    requestKey: 'request-1', protocolVersion: 1,
  }, { 'x-host-token': 'host-token' });
  assert.equal(valid.status, 201);
  assert.deepEqual(seen.issue, {
    hostEnrollmentId: 'enrolled-host-1', requestKey: 'request-1', protocolVersion: 1,
  });
  assert.deepEqual(valid.body, {
    payload: { protocolVersion: 1, kind: 'runtime_bootstrap_manifest' },
    canonicalResponseDigest: 'b'.repeat(64),
    signature: 'signature',
    keyFingerprint: 'fingerprint',
  });
  assert.equal(JSON.stringify(valid.body).includes('must-not-leak'), false);
});

test('artifact streaming binds host and returns bytes without storage access', async () => {
  const response = await request('/api/coordination/v2/host/runtime-bootstrap/issues/issue-1/artifacts/artifact-1', {
    headers: { 'x-host-token': 'host-token' },
  });
  assert.equal(response.status, 200);
  assert.equal(response.body, 'artifact');
  assert.deepEqual(seen.stream, {
    issueId: 'issue-1', artifactId: 'artifact-1', hostEnrollmentId: 'enrolled-host-1',
  });
});

test('acknowledgement strictly binds payload/signature and status to middleware host', async () => {
  const malformed = await json('POST', '/api/coordination/v2/host/runtime-bootstrap/issues/issue-1/acknowledge', {
    payload: ['not-an-object'], signature: 'sig',
  }, { 'x-host-token': 'host-token' });
  assert.equal(malformed.status, 422);
  assert.deepEqual(malformed.body, { error: { code: 'V2_RUNTIME_ACK_INVALID' } });
  const unknown = await json('POST', '/api/coordination/v2/host/runtime-bootstrap/issues/issue-1/acknowledge', {
    payload: { requestKey: 'request-1' }, signature: 'sig', extra: true,
  }, { 'x-host-token': 'host-token' });
  assert.equal(unknown.status, 422);
  assert.deepEqual(unknown.body, { error: { code: 'V2_RUNTIME_ACK_INVALID' } });
  const valid = await json('POST', '/api/coordination/v2/host/runtime-bootstrap/issues/issue-1/acknowledge', {
    payload: { requestKey: 'request-1', manifestDigest: 'a'.repeat(64) }, signature: 'sig',
  }, { 'x-host-token': 'host-token' });
  assert.equal(valid.status, 201);
  assert.equal((seen.acknowledge as Json).hostEnrollmentId, 'enrolled-host-1');
  const status = await request('/api/coordination/v2/host/runtime-bootstrap/status', {
    headers: { 'x-host-token': 'host-token' },
  });
  assert.equal(status.status, 200);
  assert.deepEqual(seen.status, { hostEnrollmentId: 'enrolled-host-1' });
});

test('revoke binds actor to founder middleware and stable service errors', async () => {
  const revoked = await json('POST', '/api/internal/coordination/v2/runtime-releases/release-1/revoke', {
    requestKey: 'revoke-1', reasonCode: 'TEST_REASON',
  }, { 'x-founder-actor': 'founder-1' });
  assert.equal(revoked.status, 201);
  assert.deepEqual(seen.revoke, {
    runtimeReleaseId: 'release-1', requestKey: 'revoke-1',
    reasonCode: 'TEST_REASON', revokedBy: 'founder-1',
  });
  publishFailure = new CoordinationV2RuntimeError('V2_RUNTIME_IDEMPOTENCY_CONFLICT');
  const failed = await json('POST', '/api/internal/coordination/v2/runtime-releases', {
    sourcePromotionId: 'source-1', artifacts: [], sourceMembers: [],
  }, { 'x-founder-actor': 'founder-1' });
  assert.equal(failed.status, 409);
  assert.deepEqual(failed.body, { error: { code: 'V2_RUNTIME_IDEMPOTENCY_CONFLICT' } });
  publishFailure = undefined;
});

test('runtime-release-approval GET is founder-gated and previews live state without mutating anything', async () => {
  const publishCallsBefore = seen.publish;
  const unauthenticated = await request('/coordination/v2/runtime-release-approval');
  assert.equal(unauthenticated.status, 401);
  const nonFounder = await request('/coordination/v2/runtime-release-approval', {
    headers: { 'x-founder-actor': 'not-founder' },
  });
  assert.equal(nonFounder.status, 403);
  const ok = await request('/coordination/v2/runtime-release-approval', {
    headers: { 'x-founder-actor': 'founder-1' },
  });
  assert.equal(ok.status, 200);
  assert.deepEqual(seen.publish, publishCallsBefore); // GET must never call publish
  const html = ok.body as string;
  assert.match(html, /Up to date/);
  assert.match(html, /form method="post" action="\/coordination\/v2\/runtime-release-publish"/);
  assert.match(html, /scripts\/hola-coordinator\.ps1/);
  assert.equal(html.includes('<script'), false);
});

test('runtime-release-approval GET reports stale when the latest release does not match current source', async () => {
  const previousRelease = currentRuntimeRelease;
  currentRuntimeRelease = { ...currentRuntimeRelease, source_promotion_id: 'some-older-source' };
  const stale = await request('/coordination/v2/runtime-release-approval', {
    headers: { 'x-founder-actor': 'founder-1' },
  });
  assert.equal(stale.status, 200);
  assert.match(stale.body as string, /Stale/);
  currentRuntimeRelease = previousRelease;
});

test('runtime-release-publish POST recomputes every input server-side and ignores the request body', async () => {
  publishCreated = true;
  const response = await json('POST', '/coordination/v2/runtime-release-publish', {
    sourcePromotionId: 'attacker-supplied-id',
    artifacts: [{ role: 'node_executable' }],
    sourceMembers: [{ fixedPath: 'evil', sha256: 'f'.repeat(64) }],
  }, { 'x-founder-actor': 'founder-1' });
  assert.equal(response.status, 201);
  assert.deepEqual(seen.publish, {
    sourcePromotionId: 'source-1',
    artifacts: previewArtifacts,
    sourceMembers: previewMembers,
  });
  assert.deepEqual(seen.artifactsRequestedFor, 'release-1');
  assert.deepEqual(seen.sourceMembersRequestedFor, {
    repositoryIdentity: 'org/repo',
    promotedCommitSha: 'a'.repeat(40),
  });
  assert.match(response.body as unknown as string, /published/);
});

test('runtime-release-publish POST rejects unauthenticated and non-founder callers without touching publish', async () => {
  const unauthenticated = await request('/coordination/v2/runtime-release-publish', { method: 'POST' });
  assert.equal(unauthenticated.status, 401);
  const nonFounder = await request('/coordination/v2/runtime-release-publish', {
    method: 'POST',
    headers: { 'x-founder-actor': 'not-founder' },
  });
  assert.equal(nonFounder.status, 403);
});

test('runtime-release-publish POST surfaces publication failures as the same stable error shape', async () => {
  publishFailure = new CoordinationV2RuntimeError('V2_RUNTIME_SOURCE_MEMBERS_MISMATCH');
  const failed = await request('/coordination/v2/runtime-release-publish', {
    method: 'POST',
    headers: { 'x-founder-actor': 'founder-1' },
  });
  assert.equal(failed.status, 422);
  assert.deepEqual(failed.body, { error: { code: 'V2_RUNTIME_SOURCE_MEMBERS_MISMATCH' } });
  publishFailure = undefined;
});