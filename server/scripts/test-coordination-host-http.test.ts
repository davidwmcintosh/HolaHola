import assert from 'node:assert/strict';
import http from 'node:http';
import express, { type RequestHandler } from 'express';
import test from 'node:test';
import { registerCoordinationHostRoutes } from '../routes/coordination-host-routes';
import { CoordinationTransportLeaseError } from '../services/coordination-transport-lease-service';

test('Coordinator V2 host routes enforce authentication, envelopes, and stable lease errors', async () => {
  const app = express();
  app.use(express.json());
  const auth: RequestHandler = (req, res, next) => {
    const actor = req.get('x-test-actor');
    if (!actor) {
      res.status(401).json({ error: { code: 'COORDINATION_AUTH_REQUIRED' } });
      return;
    }
    (req as any).coordinationActor = actor;
    next();
  };
  let acquiredInput: Record<string, unknown> | undefined;
  registerCoordinationHostRoutes(app, {
    coordinationAuthMiddleware: auth,
    services: {
      acquireCoordinationTransportLease: async (input) => {
        acquiredInput = input as Record<string, unknown>;
        return {
          id: 'lease-http', sessionId: input.sessionId, enrolledHostId: 'derived-host',
          holderInstanceId: input.holderInstanceId, epoch: 1, state: 'active',
        } as any;
      },
      takeoverCoordinationTransportLease: async () => ({ id: 'lease-http', epoch: 2 }) as any,
      renewCoordinationTransportLease: async () => ({ id: 'lease-http', epoch: 1, state: 'active' }) as any,
      releaseCoordinationTransportLease: async () => ({ id: 'lease-http', state: 'released' }) as any,
      expireCoordinationTransportLease: async () => ({ id: 'lease-http', state: 'expired' }) as any,
      pollCoordinationTransportWork: async (input) => {
        if (input.epoch !== 2) throw new CoordinationTransportLeaseError('LEASE_STALE_EPOCH');
        return { accepted: true, operation: input.operation, epoch: 2 };
      },
      claimCoordinationTransportWork: async (input) => ({ accepted: true, operation: input.operation }),
      resultCoordinationTransportWork: async (input) => ({ accepted: true, operation: input.operation }),
      acknowledgeCoordinationCleanup: async (input) => ({ accepted: true, operation: input.operation }),
      cleanupCoordinationTransportWork: async (input) => ({ accepted: true, operation: input.operation }),
      submitStaleCoordinationLeaseReconciliation: async () => ({
        stored: true, epoch: 1, evidenceDigest: 'a'.repeat(64),
      }),
    },
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const url = `http://127.0.0.1:${port}`;
  try {
    const unauthenticated = await fetch(`${url}/api/coordination/v2/host/leases`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'acquire' }),
    });
    assert.equal(unauthenticated.status, 401);

    const malformed = await fetch(`${url}/api/coordination/v2/host/leases`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-actor': 'operator' },
      body: JSON.stringify({ type: 'not-a-command' }),
    });
    assert.equal(malformed.status, 422);
    assert.deepEqual(await malformed.json(), { error: { code: 'COORDINATION_INVALID_COMMAND' } });

    const acquired = await fetch(`${url}/api/coordination/v2/host/leases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-actor': 'operator', 'Idempotency-Key': 'lease-http-1' },
      body: JSON.stringify({
        command: {
          type: 'acquire', sessionId: 'session-http', enrolledHostId: 'enrolled-host',
          holderInstanceId: 'instance-a', durationMs: 10_000,
        },
      }),
    });
    assert.equal(acquired.status, 201);
    assert.equal((await acquired.json()).epoch, 1);
    assert.equal(acquiredInput?.actorId, 'operator');
    assert.equal('enrolledHostId' in (acquiredInput ?? {}), false);

    const spoofedHost = await fetch(`${url}/api/coordination/v2/host/leases`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-actor': 'operator' },
      body: JSON.stringify({
        type: 'acquire', sessionId: 'session-http', enrolledHostId: 'other-host',
        holderInstanceId: 'instance-a', durationMs: 10_000,
      }),
    });
    assert.equal(spoofedHost.status, 201);
    assert.equal('enrolledHostId' in (acquiredInput ?? {}), false);

    const stale = await fetch(`${url}/api/coordination/v2/host/sessions/session-http/poll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-actor': 'operator' },
      body: JSON.stringify({
        enrolledHostId: 'enrolled-host', holderInstanceId: 'instance-a', epoch: 1,
      }),
    });
    assert.equal(stale.status, 409);
    assert.deepEqual(await stale.json(), { error: { code: 'LEASE_STALE_EPOCH' } });

    const valid = await fetch(`${url}/api/coordination/v2/host/sessions/session-http/poll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-actor': 'operator', 'Idempotency-Key': 'poll-2' },
      body: JSON.stringify({
        enrolledHostId: 'enrolled-host', holderInstanceId: 'instance-b', epoch: 2,
      }),
    });
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { accepted: true, operation: 'poll', epoch: 2 });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});