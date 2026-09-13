import assert from 'node:assert/strict';
import http from 'node:http';
import express, { type RequestHandler } from 'express';
import test from 'node:test';
import { createHostEnvelope, type HostBinding } from '../services/coordination-host-protocol';
import { registerCoordinationHostRoutes } from '../routes/coordination-host-routes';
import { CoordinationTransportLeaseError } from '../services/coordination-transport-lease-service';

const clock = Date.parse('2026-01-01T00:00:00.000Z');
const ids = {
  requestId: 'request-1', correlationId: 'session-http',
  issuedAt: new Date(clock - 1000).toISOString(), expiresAt: new Date(clock + 60_000).toISOString(),
};
const binding = (epoch: number, holderInstanceId = 'instance-a', sessionId = 'session-http'): HostBinding => ({
  policyVersionId: 'policy-http', sessionId, enrolledHostId: 'enrolled-host',
  transportLeaseId: 'lease-http', leaseEpoch: epoch, holderInstanceId, operation: 'poll',
});
const poll = (epoch: number, holderInstanceId = 'instance-a', sessionId = 'session-http') =>
  createHostEnvelope('work_poll', { binding: binding(epoch, holderInstanceId, sessionId) }, {
    ...ids, requestId: `poll-${epoch}-${holderInstanceId}-${sessionId}`,
  });

test('Coordinator V2 host routes enforce authentication, strict envelopes, bindings, and stable errors', async () => {
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
    now: () => clock,
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
  const post = (path: string, body: unknown, authenticated = true) => fetch(`${url}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authenticated ? { 'x-test-actor': 'operator' } : {}),
    },
    body: JSON.stringify(body),
  });
  try {
    const unauthenticated = await post('/api/coordination/v2/host/leases', { type: 'acquire' }, false);
    assert.equal(unauthenticated.status, 401);

    const validLease = createHostEnvelope('lease_request', {
      sessionId: 'session-http', holderInstanceId: 'instance-a', durationMs: 10_000,
    }, ids);
    const unknownVersion = { ...validLease, protocolVersion: 2 };
    const unknown = await post('/api/coordination/v2/host/leases', unknownVersion);
    assert.equal(unknown.status, 422);
    assert.deepEqual(await unknown.json(), { error: { code: 'HOST_PROTOCOL_UNKNOWN_VERSION' } });

    const unknownKind = await post('/api/coordination/v2/host/leases', { ...validLease, kind: 'unknown-kind' });
    assert.equal(unknownKind.status, 422);
    assert.deepEqual(await unknownKind.json(), { error: { code: 'HOST_PROTOCOL_UNKNOWN_KIND' } });

    const future = createHostEnvelope('lease_request', validLease.payload, {
      ...ids, issuedAt: new Date(clock + 60_000).toISOString(),
      expiresAt: new Date(clock + 120_000).toISOString(),
    });
    const futureResponse = await post('/api/coordination/v2/host/leases', future);
    assert.equal(futureResponse.status, 422);
    assert.deepEqual(await futureResponse.json(), { error: { code: 'HOST_PROTOCOL_FUTURE_SKEW' } });

    const extra = await post('/api/coordination/v2/host/leases', { ...validLease, extra: true });
    assert.equal(extra.status, 422);
    assert.deepEqual(await extra.json(), { error: { code: 'HOST_PROTOCOL_EXTRA_FIELDS' } });

    const digestMismatch = await post('/api/coordination/v2/host/leases', {
      ...validLease, digest: 'b'.repeat(64),
    });
    assert.equal(digestMismatch.status, 422);
    assert.deepEqual(await digestMismatch.json(), { error: { code: 'HOST_PROTOCOL_DIGEST_MISMATCH' } });

    const acquired = await post('/api/coordination/v2/host/leases', validLease);
    assert.equal(acquired.status, 201);
    assert.equal((await acquired.json()).epoch, 1);
    assert.equal(acquiredInput?.actorId, 'operator');
    assert.equal('enrolledHostId' in (acquiredInput ?? {}), false);

    const mismatch = await post('/api/coordination/v2/host/sessions/session-http/poll', poll(2, 'instance-a', 'other-session'));
    assert.equal(mismatch.status, 422);
    assert.deepEqual(await mismatch.json(), { error: { code: 'HOST_PROTOCOL_BINDING_MISMATCH' } });

    const stale = await post('/api/coordination/v2/host/sessions/session-http/poll', poll(1));
    assert.equal(stale.status, 409);
    assert.deepEqual(await stale.json(), { error: { code: 'LEASE_STALE_EPOCH' } });

    const valid = await post('/api/coordination/v2/host/sessions/session-http/poll', poll(2, 'instance-b'));
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), { accepted: true, operation: 'poll', epoch: 2 });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});