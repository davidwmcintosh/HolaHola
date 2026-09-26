import assert from 'node:assert/strict';
import http from 'node:http';
import express, { type RequestHandler } from 'express';
import test, { after } from 'node:test';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import type { CoordinationAuthenticatedRequest } from '../middleware/coordination-auth';

// Mirrors test-coordination-policy-http.test.ts's module-level pool lifecycle
// note: db is shared across every test in this file, so it closes once here,
// not per test.
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
    throw new Error('Coordinator credential admin HTTP test refuses an unverified/shared database');
  }
  return branchUrl;
}

async function jsonCall(
  baseUrl: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let parsed: unknown = {};
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { raw: text };
    }
  }
  return { status: response.status, body: parsed };
}

test('runtime-admin routes are actually wired to the real founder-or-capability gate in production wiring (no DI overrides)', async () => {
  // The rest of this file's coverage uses DI test doubles for
  // runtimeAdminMiddleware/coordinationAuthMiddleware -- deliberately, to
  // exercise the route handlers' own logic without ever touching real
  // COORDINATION_ALDEN_TOKEN/COORDINATION_DAVID_TOKEN secret values. That
  // leaves an unguarded gap: nothing proves the real gate composition is
  // actually attached to these three routes the way server/routes.ts wires
  // them in production (registerCoordinationCredentialRoutes(app), zero
  // dependencies). This test closes that gap without a real secret or a
  // session/passport stack: a garbage (but present) x-coordination-token
  // takes the token-validation branch in both requireFounderOrCoordination
  // Capability and requireCoordinationAuth, never the founder-session
  // fallback -- so it proves the real gate is wired without needing
  // isAuthenticated's session machinery, and resolves to a clean 401
  // ("Invalid coordination token") whether the ambient database is the
  // disposable local one or the real dev/prod Neon database, since an
  // unrecognized token matches no row in either.
  const { registerCoordinationCredentialRoutes } = await import('../routes/coordination-credential-routes');
  const app = express();
  app.use(express.json());
  registerCoordinationCredentialRoutes(app);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const garbageToken = { 'x-coordination-token': 'not-a-real-coordination-token' };
  try {
    const register = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/register-runtime', {
      runtimeId: 'unauthenticated-probe', actor: 'luca-antigravity', displayName: 'Should never register',
    }, garbageToken);
    assert.equal(register.status, 401);
    assert.deepEqual(register.body, { error: 'Invalid coordination token' });

    const revoke = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/admin-revoke-runtime', {
      runtimeId: 'unauthenticated-probe',
    }, garbageToken);
    assert.equal(revoke.status, 401);
    assert.deepEqual(revoke.body, { error: 'Invalid coordination token' });

    const list = await jsonCall(baseUrl, 'GET', '/api/coordination/credentials/runtimes', undefined, garbageToken);
    assert.equal(list.status, 401);
    assert.deepEqual(list.body, { error: 'Invalid coordination token' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('runtime-admin routes gate on a test-double admin middleware and apply Luca-hat capability defaulting', async (context) => {
  const databaseUrl = disposableTarget();
  if (!databaseUrl) {
    context.skip('requires a verified disposable PostgreSQL URL');
    return;
  }
  const { registerCoordinationCredentialRoutes } = await import('../routes/coordination-credential-routes');
  const app = express();
  app.use(express.json());

  // Test doubles standing in for the real runtimeAdminGate/requireCoordinationAuth
  // composition (already proven generically in coordination-auth.test.ts's
  // capability-matrix and founder-fallback tests). These isolate the route
  // handlers' own request-parsing, validation, and Luca-hat-defaulting logic,
  // which is new in this file and not covered anywhere else.
  const runtimeAdminMiddleware: RequestHandler = (req, res, next) => {
    const actor = req.get('x-test-admin-actor');
    if (!actor) {
      res.status(401).json({ error: 'admin authentication required' });
      return;
    }
    (req as CoordinationAuthenticatedRequest).coordinationActor = actor as CoordinationAuthenticatedRequest['coordinationActor'];
    next();
  };
  const coordinationAuthMiddleware: RequestHandler = (req, res, next) => {
    const actor = req.get('x-test-read-actor');
    if (!actor) {
      res.status(401).json({ error: 'coordination authentication required' });
      return;
    }
    next();
  };
  registerCoordinationCredentialRoutes(app, { runtimeAdminMiddleware, coordinationAuthMiddleware });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const runtimeId = `http-admin-route-${suffix}`;

  try {
    const unauthenticated = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/register-runtime', {
      runtimeId, actor: 'luca-antigravity', displayName: 'HTTP Luca hat',
    });
    assert.equal(unauthenticated.status, 401);

    const badActor = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/register-runtime', {
      runtimeId, actor: 'not-a-real-actor', displayName: 'HTTP bad actor',
    }, { 'x-test-admin-actor': 'alden' });
    assert.equal(badActor.status, 400);

    const systemActor = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/register-runtime', {
      runtimeId, actor: 'coordination-system', displayName: 'HTTP system actor',
    }, { 'x-test-admin-actor': 'alden' });
    assert.equal(systemActor.status, 400);

    const nonLucaWithoutCapabilities = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/register-runtime', {
      runtimeId, actor: 'daniela', displayName: 'HTTP non-Luca actor',
    }, { 'x-test-admin-actor': 'alden' });
    assert.equal(nonLucaWithoutCapabilities.status, 400);
    assert.deepEqual(nonLucaWithoutCapabilities.body, { error: 'capabilities is required for non-Luca-hat actors' });

    const unknownCapability = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/register-runtime', {
      runtimeId, actor: 'daniela', displayName: 'HTTP unknown capability', capabilities: ['not-a-real-capability'],
    }, { 'x-test-admin-actor': 'alden' });
    assert.equal(unknownCapability.status, 400);

    // The core "same standard capability set as every other Luca hat"
    // behavior: no explicit capabilities supplied for a luca-* actor.
    const registered = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/register-runtime', {
      runtimeId, actor: 'luca-antigravity', displayName: 'HTTP Luca hat',
    }, { 'x-test-admin-actor': 'alden' });
    assert.equal(registered.status, 201);
    const registeredBody = registered.body as { capabilities: string[]; bootstrapToken: string; actor: string };
    assert.equal(registeredBody.actor, 'luca-antigravity');
    assert.deepEqual(
      [...registeredBody.capabilities].sort(),
      ['coordination:read', 'coordination:write', 'coordination:inbox:ack', 'coordination:credential:renew', 'coordination:credential:revoke', 'observation:read'].sort(),
    );
    assert.ok(registeredBody.bootstrapToken.length > 0);

    const listUnauthenticated = await jsonCall(baseUrl, 'GET', '/api/coordination/credentials/runtimes');
    assert.equal(listUnauthenticated.status, 401);

    const listed = await jsonCall(baseUrl, 'GET', '/api/coordination/credentials/runtimes', undefined, {
      'x-test-read-actor': 'luca-replit',
    });
    assert.equal(listed.status, 200);
    const listedBody = listed.body as { runtimes: Array<{ runtimeId: string; enabled: boolean }> };
    const listedEntry = listedBody.runtimes.find((entry) => entry.runtimeId === runtimeId);
    assert.ok(listedEntry, 'the newly registered runtime must appear in the listing');
    assert.equal(listedEntry?.enabled, true);
    assert.equal(JSON.stringify(listed.body).match(/bootstrapHash|accessToken|credentialId/i), null);

    const revokeUnknown = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/admin-revoke-runtime', {
      runtimeId: 'unknown-runtime-id-that-does-not-exist',
    }, { 'x-test-admin-actor': 'alden' });
    assert.equal(revokeUnknown.status, 404);

    const revoked = await jsonCall(baseUrl, 'POST', '/api/coordination/credentials/admin-revoke-runtime', {
      runtimeId,
    }, { 'x-test-admin-actor': 'alden' });
    assert.equal(revoked.status, 204);

    const listedAfterRevoke = await jsonCall(baseUrl, 'GET', '/api/coordination/credentials/runtimes', undefined, {
      'x-test-read-actor': 'luca-replit',
    });
    const afterEntry = (listedAfterRevoke.body as { runtimes: Array<{ runtimeId: string; enabled: boolean }> })
      .runtimes.find((entry) => entry.runtimeId === runtimeId);
    assert.equal(afterEntry?.enabled, false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
