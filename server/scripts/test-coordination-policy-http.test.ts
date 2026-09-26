import assert from 'node:assert/strict';
import http from 'node:http';
import express, { type Request as ExpressRequest, type RequestHandler } from 'express';
import test, { after } from 'node:test';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

// Both tests in this file share the module-level `db` pool. Closing it must
// happen once, after every test in the file has finished -- not inside each
// test's own finally -- because the exported `db` Drizzle instance wraps the
// pool it was constructed with at module load and does not reconnect after
// closeDbConnections() nulls that pool.
after(async () => {
  const { closeDbConnections } = await import('../db');
  await closeDbConnections();
});

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
  }
});

test('policy HTTP routes accept a coordination token scoped to the david actor as founder auth', async (context) => {
  const databaseUrl = disposableTarget();
  if (!databaseUrl) {
    context.skip('requires a verified disposable PostgreSQL URL');
    return;
  }
  const previousDavidToken = process.env.COORDINATION_DAVID_TOKEN;
  const previousAldenToken = process.env.COORDINATION_ALDEN_TOKEN;
  const davidToken = `test-david-token-${Date.now()}-${'a'.repeat(32)}`;
  const aldenToken = `test-alden-token-${Date.now()}-${'b'.repeat(32)}`;
  process.env.COORDINATION_DAVID_TOKEN = davidToken;
  process.env.COORDINATION_ALDEN_TOKEN = aldenToken;
  const { registerCoordinationPolicyRoutes } = await import('../routes/coordination-policy-routes');
  const app = express();
  app.use(express.json());
  const founderMiddleware: RequestHandler = (req, res) => {
    res.status(401).json({ error: { code: 'FOUNDER_REQUIRED' } });
  };
  registerCoordinationPolicyRoutes(app, { founderMiddleware: [founderMiddleware] });
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
    const noToken = await jsonRequest(baseUrl, '/api/coordination/v2/policies', {
      policyKey: `token-${suffix}`, displayName: 'Token policy', policy,
    });
    assert.equal(noToken.status, 401);
    assert.deepEqual(noToken.body, { error: { code: 'FOUNDER_REQUIRED' } });

    const nonAllowlistedActor = await jsonRequest(baseUrl, '/api/coordination/v2/policies', {
      policyKey: `token-${suffix}`, displayName: 'Token policy', policy,
    }, { 'x-coordination-token': aldenToken });
    assert.equal(nonAllowlistedActor.status, 403);

    const created = await jsonRequest(baseUrl, '/api/coordination/v2/policies', {
      policyKey: `token-${suffix}`, displayName: 'Token policy', policy, founderActor: 'body-forged-founder',
    }, { 'x-coordination-token': davidToken });
    assert.equal(created.status, 201);
    const createdBody = created.body as { version: { id: string; policyIdentityId: string; createdBy: string } };
    assert.equal(createdBody.version.createdBy, 'david');

    const approved = await jsonRequest(baseUrl, `/api/coordination/v2/policy-versions/${createdBody.version.id}/approve`, {
      requestKey: `token-approve-${suffix}`,
    }, { 'x-coordination-token': davidToken });
    assert.equal(approved.status, 200);
    const approvedBody = approved.body as { decision: { founderActor: string } };
    assert.equal(approvedBody.decision.founderActor, 'david');

    const grantReply = await jsonRequest(baseUrl, '/api/coordination/v2/operator-grants', {
      policyIdentityId: createdBody.version.policyIdentityId, operatorActor: 'operator-token-test',
      actions: ['launch'], expiresAt: new Date(Date.now() + 60_000).toISOString(),
      requestKey: `token-grant-${suffix}`,
    }, { 'x-coordination-token': davidToken });
    assert.equal(grantReply.status, 201);
    const grantBody = grantReply.body as { issuedBy: string };
    assert.equal(grantBody.issuedBy, 'david');
  } finally {
    if (previousDavidToken === undefined) delete process.env.COORDINATION_DAVID_TOKEN;
    else process.env.COORDINATION_DAVID_TOKEN = previousDavidToken;
    if (previousAldenToken === undefined) delete process.env.COORDINATION_ALDEN_TOKEN;
    else process.env.COORDINATION_ALDEN_TOKEN = previousAldenToken;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});