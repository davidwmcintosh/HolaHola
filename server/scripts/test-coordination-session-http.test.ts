import assert from 'node:assert/strict';
import http from 'node:http';
import express, { type RequestHandler } from 'express';
import test from 'node:test';
import { registerCoordinationSessionRoutes } from '../routes/coordination-session-routes';

test('Coordinator V2 session routes use real Express middleware and stable errors', async () => {
  const app = express();
  app.use(express.json());
  const auth: RequestHandler = (req, res, next) => {
    const actor = req.get('x-test-actor');
    if (!actor) { res.status(401).json({ error: { code: 'COORDINATION_AUTH_REQUIRED' } }); return; }
    (req as any).coordinationActor = actor;
    next();
  };
  registerCoordinationSessionRoutes(app, {
    coordinationAuthMiddleware: auth,
    services: {
      createOrResumeSession: async (input) => ({
        id: 'session-http', state: 'preparing', operatorActor: input.operatorActor,
      }) as any,
      createFreshAttempt: async () => ({ id: 'attempt-http', created: true }) as any,
      transitionCoordinationAttempt: async () => ({ id: 'attempt-http', state: 'running' }) as any,
      resumeSameCoordinationAttempt: async () => ({ id: 'attempt-http', state: 'running' }) as any,
      transitionCoordinationSession: async () => ({ id: 'session-http', state: 'preparing' }) as any,
      acceptCoordinationCompletion: async () => ({ session: { id: 'session-http' }, obligations: [] }) as any,
    },
  });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  try {
    const unauthenticated = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/sessions`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(unauthenticated.status, 401);
    const response = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/sessions`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-test-actor': 'operator-test' },
      body: JSON.stringify({ idempotencyKey: 'launch-1' }),
    });
    assert.equal(response.status, 201);
    assert.equal((await response.json()).id, 'session-http');
    const malformed = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/sessions/session-http/transitions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-actor': 'operator-test', 'Idempotency-Key': 'bad-transition' },
      body: JSON.stringify({ type: 'provider_started' }),
    });
    assert.equal(malformed.status, 422);
    assert.deepEqual(await malformed.json(), { error: { code: 'COORDINATION_INVALID_COMMAND' } });
    const attempt = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/sessions/session-http/attempts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-actor': 'operator-test', 'Idempotency-Key': 'attempt-1' },
      body: JSON.stringify({ provider: 'gemini', model: 'test', adapterVersion: 'a' }),
    });
    assert.equal(attempt.status, 201);
    const attemptTransition = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/attempts/attempt-http/transitions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-actor': 'operator-test', 'Idempotency-Key': 'attempt-transition' },
      body: JSON.stringify({ command: { type: 'provider_started' } }),
    });
    assert.equal(attemptTransition.status, 200);
    const resume = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/attempts/attempt-http/resume`, {
      method: 'POST',
      headers: { 'x-test-actor': 'operator-test', 'Idempotency-Key': 'resume-1' },
    });
    assert.equal(resume.status, 200);
    const completion = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/sessions/session-http/completion`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-actor': 'operator-test', 'Idempotency-Key': 'completion-1' },
      body: JSON.stringify({ evidence: [] }),
    });
    assert.equal(completion.status, 200);
    const unauthenticatedCompletion = await fetch(`http://127.0.0.1:${port}/api/coordination/v2/sessions/session-http/completion`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    });
    assert.equal(unauthenticatedCompletion.status, 401);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});