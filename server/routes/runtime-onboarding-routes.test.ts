import assert from 'node:assert/strict';
import express, { type RequestHandler } from 'express';
import http from 'node:http';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { registerRuntimeOnboardingRoutes } from './runtime-onboarding-routes';

test('runtime onboarding routes keep browser decisions CSRF-bound and proof responses non-cacheable', async () => {
  const originalEndpoint = process.env.COORDINATION_PUBLIC_ENDPOINT;
  const originalApprovedEndpoints = process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS;
  process.env.COORDINATION_PUBLIC_ENDPOINT = 'https://coordination.example';
  process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS =
    'https://coordination.example,https://staging-coordination.example';
  const app = express();
  app.use(express.json());
  const csrf = 'route-test-csrf-token';
  const adminGate: RequestHandler = (req, res, next) => {
    if (req.get('x-test-admin') === 'yes') {
      (req as any).coordinationActor = 'alden';
      (req as any).coordinationAuthType = 'broker';
      next();
      return;
    }
    if (req.get('x-test-founder') === 'yes') {
      (req as any).authenticatedUser = { id: 'founder-session-user' };
      (req as any).session = { runtimeOnboardingCsrfToken: csrf };
      next();
      return;
    }
    res.status(401).json({ error: { code: 'FORBIDDEN' } });
  };
  const founder: RequestHandler = (req, res, next) => {
    if (req.get('x-test-founder') !== 'yes') {
      res.status(401).end();
      return;
    }
    (req as any).authenticatedUser = { id: 'founder-session-user' };
    (req as any).session = { runtimeOnboardingCsrfToken: csrf };
    next();
  };
  let decisions = 0;
  const appServer = http.createServer(app);
  registerRuntimeOnboardingRoutes(app, {
    runtimeAdminMiddleware: adminGate,
    founderMiddleware: [founder],
    services: {
      prepareRuntimeOnboardingInvitation: async () => ({
        id: 'invite-safe',
        actor: 'luca-cursor',
        runtimeId: 'cursor-runtime',
        displayName: 'Cursor',
        capabilities: ['coordination:read'],
        expiresAt: '2030-01-01T00:00:00.000Z',
        state: 'prepared',
        clientType: 'mcp-stdio',
      }),
      submitRuntimeOnboardingRequest: async () => ({
        id: 'request-safe',
        actor: 'luca-cursor',
        runtimeId: 'cursor-runtime',
        displayName: 'Cursor',
        verificationCode: '112233',
        fingerprint: 'a'.repeat(64),
        state: 'requested',
        expiresAt: '2030-01-01T00:00:00.000Z',
        capabilities: ['coordination:read'],
        provider: null,
        model: null,
        approvalPath: '/admin/runtime-onboarding?request=request-safe',
      }),
      getRuntimeOnboardingRequestStatus: async () => ({
        id: 'request-safe',
        actor: 'luca-cursor',
        runtimeId: 'cursor-runtime',
        displayName: 'Cursor',
        verificationCode: '112233',
        fingerprint: 'a'.repeat(64),
        approvalPath: '/admin/runtime-onboarding?request=request-safe',
        state: 'approved',
        expiresAt: '2030-01-01T00:00:00.000Z',
        capabilities: ['coordination:read'],
        provider: null,
        model: null,
      }),
      createRuntimeOnboardingChallenge: async ({ endpoint }) => {
        assert.equal(endpoint, 'https://coordination.example');
        return {
          challengeId: 'challenge-safe',
          nonce: 'non-secret-challenge',
          payload: '{"version":1}',
          expiresAt: '2030-01-01T00:00:00.000Z',
        };
      },
      proveRuntimeOnboardingChallenge: async ({ endpoint }) => {
        assert.equal(endpoint, 'https://coordination.example');
        return {
          accessToken: 'ct_test_once',
          credentialId: 'credential-1',
          actor: 'luca-cursor',
          runtimeId: 'cursor-runtime',
          capabilities: ['coordination:read'],
          expiresAt: '2030-01-01T00:15:00.000Z',
        };
      },
      getRuntimeOnboardingAdminView: async () => ({
        actors: [{ id: 'luca-cursor', capabilities: ['coordination:read'] }],
        invitations: [],
        requests: [],
        runtimes: [],
      }),
      decideRuntimeOnboardingRequest: async ({ decision }) => {
        decisions += 1;
        return { state: decision === 'approve' ? 'approved' : 'denied' };
      },
    },
  });
  await new Promise<void>((resolve) => appServer.listen(0, '127.0.0.1', resolve));
  const address = appServer.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const jsonHeaders = { 'content-type': 'application/json' };
  try {
    const invitationDenied = await fetch(`${baseUrl}/api/coordination/onboarding/invitations`, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify({}),
    });
    assert.equal(invitationDenied.status, 401);
    const founderWithoutCsrf = await fetch(`${baseUrl}/api/coordination/onboarding/invitations`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'x-test-founder': 'yes', origin: baseUrl },
      body: JSON.stringify({ actor: 'luca-cursor', runtimeId: 'cursor-runtime', displayName: 'Cursor' }),
    });
    assert.equal(founderWithoutCsrf.status, 403);
    const founderWithCsrf = await fetch(`${baseUrl}/api/coordination/onboarding/invitations`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'x-test-founder': 'yes', origin: baseUrl },
      body: JSON.stringify({
        actor: 'luca-cursor',
        runtimeId: 'cursor-runtime',
        displayName: 'Cursor',
        csrfToken: csrf,
      }),
    });
    assert.equal(founderWithCsrf.status, 201);

    const invitationResponse = await fetch(`${baseUrl}/api/coordination/onboarding/invitations`, {
      method: 'POST',
      headers: { ...jsonHeaders, 'x-test-admin': 'yes' },
      body: JSON.stringify({ actor: 'luca-cursor', runtimeId: 'cursor-runtime', displayName: 'Cursor' }),
    });
    assert.equal(invitationResponse.status, 201);
    const invitationBody = await invitationResponse.json() as Record<string, any>;
    assert.equal(invitationBody.invitation.id, 'invite-safe');
    assert.equal(invitationBody.setup.endpoint, 'https://coordination.example');
    assert.equal('accessToken' in invitationBody, false);
    assert.equal('bootstrapToken' in invitationBody, false);

    const requestResponse = await fetch(`${baseUrl}/api/coordination/onboarding/requests`, {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ invitationId: 'invite-safe', publicKey: 'public-key-input' }),
    });
    assert.equal(requestResponse.status, 201);
    const requestBody = await requestResponse.json() as Record<string, unknown>;
    assert.equal(requestBody.requestId, 'request-safe');
    assert.equal('publicKeyPem' in requestBody, false);

    const status = await fetch(`${baseUrl}/api/coordination/onboarding/requests/request-safe/status`, {
      method: 'POST', headers: jsonHeaders, body: '{}',
    });
    assert.equal(status.status, 200);
    assert.equal((await status.json() as Record<string, unknown>).state, 'approved');

    const invalidPurpose = await fetch(`${baseUrl}/api/coordination/onboarding/requests/request-safe/challenge`, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify({ purpose: 'unknown' }),
    });
    assert.equal(invalidPurpose.status, 400);
    process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS = 'https://staging-coordination.example';
    const unapprovedEndpoint = await fetch(`${baseUrl}/api/coordination/onboarding/requests/request-safe/challenge`, {
      method: 'POST', headers: jsonHeaders, body: JSON.stringify({ purpose: 'enroll' }),
    });
    assert.equal(unapprovedEndpoint.status, 400);
    process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS =
      'https://coordination.example,https://staging-coordination.example';
    const challenge = await fetch(`${baseUrl}/api/coordination/onboarding/requests/request-safe/challenge`, {
      method: 'POST',
      headers: { ...jsonHeaders, host: 'attacker.example' },
      body: JSON.stringify({ purpose: 'enroll' }),
    });
    assert.equal(challenge.status, 200);
    assert.equal(challenge.headers.get('cache-control'), 'no-store');

    const proof = await fetch(`${baseUrl}/api/coordination/onboarding/requests/request-safe/prove`, {
      method: 'POST', headers: jsonHeaders,
      body: JSON.stringify({ challengeId: 'challenge-safe', signature: 'AA==' }),
    });
    assert.equal(proof.status, 200);
    assert.match(proof.headers.get('cache-control') || '', /no-store/);
    assert.equal((await proof.json() as Record<string, unknown>).accessToken, 'ct_test_once');

    const admin = await fetch(`${baseUrl}/api/coordination/onboarding/admin`, {
      headers: { 'x-test-founder': 'yes' },
    });
    assert.equal(admin.status, 200);
    const adminBody = await admin.json() as Record<string, any>;
    assert.equal(adminBody.csrfToken, csrf);
    assert.equal(JSON.stringify(adminBody).includes('accessToken'), false);

    const wrongOrigin = await fetch(`${baseUrl}/api/coordination/onboarding/admin/requests/request-safe/approve`, {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        'x-test-founder': 'yes',
        origin: 'https://attacker.example',
      },
      body: JSON.stringify({ csrfToken: csrf }),
    });
    assert.equal(wrongOrigin.status, 403);
    assert.equal(decisions, 0);

    const approval = await fetch(`${baseUrl}/api/coordination/onboarding/admin/requests/request-safe/approve`, {
      method: 'POST',
      headers: {
        ...jsonHeaders,
        'x-test-founder': 'yes',
        origin: baseUrl,
      },
      body: JSON.stringify({ csrfToken: csrf }),
    });
    assert.equal(approval.status, 200);
    assert.equal(decisions, 1);
  } finally {
    await new Promise<void>((resolve) => appServer.close(() => resolve()));
    if (originalEndpoint === undefined) delete process.env.COORDINATION_PUBLIC_ENDPOINT;
    else process.env.COORDINATION_PUBLIC_ENDPOINT = originalEndpoint;
    if (originalApprovedEndpoints === undefined) {
      delete process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS;
    } else {
      process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS = originalApprovedEndpoints;
    }
  }
});