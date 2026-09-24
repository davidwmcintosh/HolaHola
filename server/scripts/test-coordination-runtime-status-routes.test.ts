import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { closeDbConnections } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  disableCoordinationRuntimeRegistration,
  registerCoordinationRuntime,
  stageCoordinationRuntimeReplacement,
} from '../services/coordination-credential-broker';
import { registerCoordinationRuntimeStatusRoutes } from '../routes/coordination-runtime-status-routes';

const TOKENS = {
  alden: 'runtime-status-route-alden-token-'.repeat(2),
} as const;

const TOKEN_ENVIRONMENT = {
  COORDINATION_ALDEN_TOKEN: TOKENS.alden,
} as const;

const hasDisposableDatabase = Boolean(
  getVerifiedCiDatabaseUrl() || process.env.COORDINATION_INBOX_DISPOSABLE_BRANCH_ID,
);
const databaseTest = hasDisposableDatabase ? test : test.skip;
const runtimeId = `coordination-runtime-status-route-${Date.now()}`;

const app = express();
app.use(express.json());
registerCoordinationRuntimeStatusRoutes(app);

let server: Server;
let baseUrl: string;
const previousEnvironment = new Map<string, string | undefined>();

async function startServer(): Promise<void> {
  await new Promise<void>((resolve) => {
    server = createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
}

async function stopServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function get(
  path: string,
  token?: string,
): Promise<{ status: number; body: Record<string, any> }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (token !== undefined) headers['x-coordination-token'] = token;
  const response = await fetch(`${baseUrl}${path}`, { headers });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

before(async () => {
  if (!hasDisposableDatabase) return;
  for (const [name, value] of Object.entries(TOKEN_ENVIRONMENT)) {
    previousEnvironment.set(name, process.env[name]);
    process.env[name] = value;
  }
  await startServer();
});

after(async () => {
  if (!hasDisposableDatabase) return;
  await stopServer();
  await closeDbConnections();
  for (const [name, value] of previousEnvironment) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

databaseTest('rejects missing or invalid coordination tokens', async () => {
  const missing = await get('/api/coordination/runtime-status');
  assert.equal(missing.status, 401);
  assert.equal(typeof missing.body.error, 'string');

  const invalid = await get('/api/coordination/runtime-status', 'not-a-real-coordination-token');
  assert.equal(invalid.status, 401);
  assert.equal(typeof invalid.body.error, 'string');
});

databaseTest('returns the same provider/model/status data getCoordinationRuntimeStatus produces, scoped by runtimeIds', async () => {
  const withId = `${runtimeId}-with-provider-model`;
  await registerCoordinationRuntime({
    runtimeId: withId,
    actor: 'luca-replit',
    displayName: 'Route CI runtime with provider/model',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
  });

  const response = await get(
    `/api/coordination/runtime-status?runtimeIds=${encodeURIComponent(withId)}`,
    TOKENS.alden,
  );
  assert.equal(response.status, 200);
  assert.equal(response.body.actor, 'alden');
  assert.deepEqual(response.body.filter, { actor: null, runtimeIds: [withId], includeDisabled: false });
  assert.equal(response.body.runtimes.length, 1);
  const row = response.body.runtimes[0];
  assert.equal(row.runtimeId, withId);
  assert.equal(row.actor, 'luca-replit');
  assert.equal(row.provider, 'anthropic');
  assert.equal(row.model, 'claude-sonnet-4-5');
  assert.equal(row.enabled, true);
  assert.equal(row.rotatedFrom, null);
  assert.equal(row.rotatedTo, null);
});

databaseTest('filters by actor combined with repeated runtimeIds params as an AND', async () => {
  const replitId = `${runtimeId}-actor-filter-replit`;
  const geminiId = `${runtimeId}-actor-filter-gemini`;
  await registerCoordinationRuntime({
    runtimeId: replitId,
    actor: 'luca-replit',
    displayName: 'Route CI actor-filter runtime (replit)',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
  });
  await registerCoordinationRuntime({
    runtimeId: geminiId,
    actor: 'luca-gemini',
    displayName: 'Route CI actor-filter runtime (gemini)',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
  });

  const response = await get(
    `/api/coordination/runtime-status?actor=luca-gemini&runtimeIds=${encodeURIComponent(replitId)}&runtimeIds=${encodeURIComponent(geminiId)}`,
    TOKENS.alden,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.filter.runtimeIds, [replitId, geminiId]);
  assert.deepEqual(response.body.runtimes.map((row: any) => row.runtimeId), [geminiId]);
});

databaseTest('excludes disabled registrations by default and includes them with includeDisabled=true', async () => {
  const disabledId = `${runtimeId}-disabled`;
  await registerCoordinationRuntime({
    runtimeId: disabledId,
    actor: 'luca-replit',
    displayName: 'Route CI disabled runtime',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
  });
  const disabled = await disableCoordinationRuntimeRegistration(disabledId);
  assert.equal(disabled.ok, true);

  const defaultResponse = await get(
    `/api/coordination/runtime-status?runtimeIds=${encodeURIComponent(disabledId)}`,
    TOKENS.alden,
  );
  assert.equal(defaultResponse.status, 200);
  assert.equal(defaultResponse.body.runtimes.length, 0);

  const allResponse = await get(
    `/api/coordination/runtime-status?runtimeIds=${encodeURIComponent(disabledId)}&includeDisabled=true`,
    TOKENS.alden,
  );
  assert.equal(allResponse.status, 200);
  assert.equal(allResponse.body.filter.includeDisabled, true);
  assert.equal(allResponse.body.runtimes.length, 1);
  assert.equal(allResponse.body.runtimes[0].enabled, false);
  assert.equal(typeof allResponse.body.runtimes[0].revokedAt, 'string');
});

databaseTest('surfaces rotation lineage on both sides of a staged rotation', async () => {
  const sourceId = `${runtimeId}-rotation-source`;
  const replacementId = `${runtimeId}-rotation-replacement`;
  await registerCoordinationRuntime({
    runtimeId: sourceId,
    actor: 'luca-replit',
    displayName: 'Route CI rotation source',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
  });
  const staged = await stageCoordinationRuntimeReplacement({
    sourceRuntimeId: sourceId,
    replacementRuntimeId: replacementId,
    replacementDisplayName: 'Route CI rotation replacement',
  });
  assert.equal(staged.ok, true);

  const response = await get(
    `/api/coordination/runtime-status?runtimeIds=${encodeURIComponent(sourceId)}&runtimeIds=${encodeURIComponent(replacementId)}`,
    TOKENS.alden,
  );
  assert.equal(response.status, 200);
  const sourceRow = response.body.runtimes.find((row: any) => row.runtimeId === sourceId);
  const replacementRow = response.body.runtimes.find((row: any) => row.runtimeId === replacementId);
  assert.ok(sourceRow && replacementRow);
  assert.equal(sourceRow.rotatedTo.runtimeId, replacementId);
  assert.equal(sourceRow.rotatedTo.state, 'staged');
  assert.equal(replacementRow.rotatedFrom.runtimeId, sourceId);
  assert.equal(replacementRow.rotatedFrom.state, 'staged');
});

databaseTest('rejects an unsupported query parameter and an invalid actor value without querying the database', async () => {
  const unsupported = await get('/api/coordination/runtime-status?bogus=1', TOKENS.alden);
  assert.equal(unsupported.status, 400);
  assert.equal(unsupported.body.code, 'unsupported_query_parameter');

  const invalidActor = await get('/api/coordination/runtime-status?actor=not-a-real-actor', TOKENS.alden);
  assert.equal(invalidActor.status, 400);
  assert.equal(invalidActor.body.code, 'invalid_actor');
});
