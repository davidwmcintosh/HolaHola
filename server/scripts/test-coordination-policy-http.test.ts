import assert from 'node:assert/strict';
import http from 'node:http';
import express, { type Request as ExpressRequest, type RequestHandler } from 'express';
import test from 'node:test';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

function disposableTarget(): string | undefined {
  const ciUrl = getVerifiedCiDatabaseUrl();
  if (ciUrl) return ciUrl;
  const branchUrl = process.env.NEON_SHARED_DATABASE_URL;
  if (!branchUrl) return undefined;
  if (process.env.COORDINATOR_V2_TEST_DATABASE_DISPOSABLE !== '1') return undefined;
  if (process.env.COORDINATOR_V2_TEST_DATABASE_URL !== branchUrl
    || process.env.COORDINATOR_V2_FORBIDDEN_SHARED_URL === branchUrl) {
    throw new Error('Coordinator policy HTTP test refuses an unverified/shared database');
  }
  return branchUrl;
}

async function jsonRequest(baseUrl: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

test('policy HTTP routes execute through an Express listener with authority-bound middleware', async (context) => {
  const databaseUrl = disposableTarget();
  if (!databaseUrl) {
    context.skip('requires a verified disposable PostgreSQL URL');
    return;
  }
  const { registerCoordinationPolicyRoutes } = await import('../routes/coordination-policy-routes');
  const app = express();
  app.use(express.json());
  const founderMiddleware: RequestHandler = (req, res, next) => {
    const actor = req.get('x-test-founder');
    if (!actor) {
      res.status(401).json({ error: { code: 'FOUNDER_REQUIRED' } });
      return;
    }
    if (actor === 'non-founder') {
      res.status(403).json({ error: { code: 'FOUNDER_ACCESS_REQUIRED' } });
      return;
    }
    (req as ExpressRequest & { authenticatedUser?: { id: string } }).authenticatedUser = { id: actor };
    next();
  };
  const coordinationMiddleware: RequestHandler = (req, res, next) => {
    const actor = req.get('x-test-coordination-actor');
    if (!actor) {
      res.status(401).json({ error: { code: 'COORDINATION_AUTH_REQUIRED' } });
      return;
    }
    (req as ExpressRequest & { coordinationActor?: string }).coordinationActor = actor;
    next();
  };
  registerCoordinationPolicyRoutes(app, {
    founderMiddleware: [founderMiddleware],
    coordinationAuthMiddleware: coordinationMiddleware,
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const policy = {
    providerOrder: ['gemini'],
    sessionDurationMs: 60_000,
    totalAttemptBudget: 2,
    tools: ['git'],
    paths: ['workspace'],
    commands: ['npm test'],
  };
  try {
    const unauthenticated = await jsonRequest(baseUrl, '/api/coordination/v2/policies', {
      policyKey: `http-${suffix}`, displayName: 'HTTP policy', policy,
    });
    assert.equal(unauthenticated.status, 401);
    assert.deepEqual(unauthenticated.body, { error: { code: 'FOUNDER_REQUIRED' } });
    const nonFounder = await jsonRequest(baseUrl, '/api/coordination/v2/policies', {
      policyKey: `http-${suffix}`, displayName: 'HTTP policy', policy,
    }, { 'x-test-founder': 'non-founder' });
    assert.equal(nonFounder.status, 403);

    const createdReply = await jsonRequest(baseUrl, '/api/coordination/v2/policies', {
      policyKey: `http-${suffix}`, displayName: 'HTTP policy', policy,
      founderActor: 'body-forged-founder',
    }, { 'x-test-founder': 'founder-http' });
    assert.equal(createdReply.status, 201);
    const created = createdReply.body as { version: { id: string; policyIdentityId: string; policyDigest: string } };
    assert.match(created.version.policyDigest, /^[0-9a-f]{64}$/);
    assert.equal(JSON.stringify(createdReply.body).match(/private|secret|credential|apiKey/i), null);

    const approved = await jsonRequest(baseUrl, `/api/coordination/v2/policy-versions/${created.version.id}/approve`, {
      requestKey: `http-approve-${suffix}`, reason: 'http approval',
    }, { 'x-test-founder': 'founder-http' });
    assert.equal(approved.status, 200);

    const unauthenticatedGrant = await jsonRequest(baseUrl, '/api/coordination/v2/operator-grants', {
      policyIdentityId: created.version.policyIdentityId, operatorActor: 'operator-http',
      actions: ['launch'], expiresAt: new Date(Date.now() + 60_000).toISOString(),
      requestKey: `http-grant-${suffix}`,
    });
    assert.equal(unauthenticatedGrant.status, 401);
    const grantReply = await jsonRequest(baseUrl, '/api/coordination/v2/operator-grants', {
      policyIdentityId: created.version.policyIdentityId, operatorActor: 'operator-http',
      actions: ['launch'], expiresAt: new Date(Date.now() + 60_000).toISOString(),
      requestKey: `http-grant-${suffix}`, issuedBy: 'body-forged-operator',
    }, { 'x-test-founder': 'founder-http' });
    assert.equal(grantReply.status, 201);
    const grant = grantReply.body as { id: string };
    assert.equal(JSON.stringify(grantReply.body).match(/private|secret|credential|apiKey/i), null);

    const forgedActor = await jsonRequest(baseUrl, '/api/coordination/v2/operator-grants/authorize', {
      grantId: grant.id, policyVersionId: created.version.id, action: 'launch',
      operatorActor: 'operator-http',
    }, { 'x-test-coordination-actor': 'different-operator' });
    assert.equal(forgedActor.status, 403);
    assert.deepEqual(forgedActor.body, { error: { code: 'OPERATOR_GRANT_SCOPE_DENIED' } });
    const authorized = await jsonRequest(baseUrl, '/api/coordination/v2/operator-grants/authorize', {
      grantId: grant.id, policyVersionId: created.version.id, action: 'launch',
      operatorActor: 'different-operator',
    }, { 'x-test-coordination-actor': 'operator-http' });
    assert.equal(authorized.status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    const { closeDbConnections } = await import('../db');
    await closeDbConnections();
  }
});