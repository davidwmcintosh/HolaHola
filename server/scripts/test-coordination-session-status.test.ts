import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express, { type RequestHandler } from 'express';
import { registerCoordinationSessionRoutes } from '../routes/coordination-session-routes';
import { projectCoordinationSessionStatus } from '../services/coordination-session-status';

test('safe status projection exposes lifecycle facts without internal authority data', () => {
  const secret = 'credential-secret policy-grant digest/path --command';
  const status = projectCoordinationSessionStatus({
    sessionId: 'session-1',
    state: 'succeeded',
    transition: {
      fromState: 'verifying',
      toState: 'succeeded',
      eventType: 'completion_accepted',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    activeLeaseHolder: 'holder-opaque-1',
    holderVisible: true,
    cleanupObligationStates: ['acknowledged', 'repair_required'],
  });

  assert.equal(status.canonicalState, 'succeeded');
  assert.equal(status.terminalResult, 'succeeded');
  assert.equal(status.currentActiveLeaseHolder, 'holder-opaque-1');
  assert.equal(status.lastTransition?.eventType, 'completion_accepted');
  assert.equal(status.nextAction, 'repair_cleanup');
  assert.deepEqual(status.blockingReason, {
    code: 'cleanup_required',
    phase: 'cleanup',
    retryable: true,
  });
  assert.equal(status.cleanupRequired, true);
  assert.equal(status.cleanupState, 'cleanup_required');
  assert.equal(JSON.stringify(status).includes(secret), false);
  assert.equal(Object.keys(status).some((key) => /policy|grant|credential|digest|path|command/i.test(key)), false);
});

test('cleanup_required remains separate from a terminal failure and hidden holders stay hidden', () => {
  const status = projectCoordinationSessionStatus({
    sessionId: 'session-2',
    state: 'failed',
    transition: {
      fromState: 'running',
      toState: 'failed',
      eventType: 'session_failed',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
    activeLeaseHolder: 'holder-opaque-2',
    holderVisible: false,
    cleanupObligationStates: ['pending'],
  });

  assert.equal(status.canonicalState, 'failed');
  assert.equal(status.terminalResult, 'failed');
  assert.equal(status.currentActiveLeaseHolder, null);
  assert.deepEqual(status.blockingReason, {
    code: 'cleanup_required',
    phase: 'cleanup',
    retryable: true,
  });
  assert.equal(status.cleanupRequired, true);
  assert.equal(status.nextAction, 'repair_cleanup');
});

test('status route is middleware-authenticated and binds the service to middleware actor', async () => {
  const app = express();
  const auth: RequestHandler = (req, res, next) => {
    const actor = req.get('x-test-actor');
    if (!actor) {
      res.status(401).json({ error: { code: 'COORDINATION_AUTH_REQUIRED' } });
      return;
    }
    (req as any).coordinationActor = actor;
    next();
  };
  let received: { sessionId: string; actorId: string } | undefined;
  registerCoordinationSessionRoutes(app, {
    coordinationAuthMiddleware: auth,
    services: {
      getCoordinationSessionStatus: async (input) => {
        received = input;
        return projectCoordinationSessionStatus({
          sessionId: input.sessionId,
          state: 'running',
          transition: null,
          cleanupObligationStates: [],
        });
      },
    },
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/sessions/s-1/status`);
    assert.equal(unauthenticated.status, 401);
    const response = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/sessions/s-1/status`, {
      headers: { 'x-test-actor': 'actor-from-middleware' },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).canonicalState, 'running');
    assert.deepEqual(received, { sessionId: 's-1', actorId: 'actor-from-middleware' });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});