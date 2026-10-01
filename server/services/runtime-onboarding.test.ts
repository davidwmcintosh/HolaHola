import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  buildRuntimeOnboardingSignedPayload,
  canonicalRuntimeOnboardingPayload,
  runtimeOnboardingApprovalPath,
} from '@shared/runtime-onboarding';
import {
  RuntimeOnboardingError,
  trustedRuntimeOnboardingEndpoint,
} from './runtime-onboarding-service';

const payload = () => buildRuntimeOnboardingSignedPayload({
  endpoint: 'https://coordination.example',
  invitationId: 'invitation-1',
  requestId: 'request-1',
  actor: 'luca-cursor',
  runtimeId: 'cursor-workstation-1',
  fingerprint: `SHA256:${'A'.repeat(43)}`,
  purpose: 'enroll',
  nonce: 'fresh-challenge-nonce',
});

test('runtime onboarding payload has deterministic versioned, domain-separated canonical bytes', () => {
  const canonical = canonicalRuntimeOnboardingPayload(payload());
  assert.equal(canonical, JSON.stringify({
    version: 1,
    domain: 'holahola-coordination-runtime-onboarding',
    endpoint: 'https://coordination.example',
    invitationId: 'invitation-1',
    requestId: 'request-1',
    actor: 'luca-cursor',
    runtimeId: 'cursor-workstation-1',
    fingerprint: `SHA256:${'A'.repeat(43)}`,
    purpose: 'enroll',
    nonce: 'fresh-challenge-nonce',
  }));
  assert.equal(canonicalRuntimeOnboardingPayload(payload()), canonical);
  assert.equal(runtimeOnboardingApprovalPath('request / one'), '/admin/runtime-onboarding?request=request%20%2F%20one');
});

test('RSA-SHA256 signatures verify only the server-rebuilt bound canonical payload', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const bytes = Buffer.from(canonicalRuntimeOnboardingPayload(payload()));
  const signature = crypto.sign('RSA-SHA256', bytes, privateKey);
  assert.equal(crypto.verify('RSA-SHA256', bytes, publicKey, signature), true);

  const changed = payload();
  const differentNonce = Buffer.from(canonicalRuntimeOnboardingPayload({
    ...changed,
    nonce: 'different-fresh-challenge',
  }));
  assert.equal(crypto.verify('RSA-SHA256', differentNonce, publicKey, signature), false);

  const differentEndpoint = Buffer.from(canonicalRuntimeOnboardingPayload({
    ...changed,
    endpoint: 'https://attacker.example',
  }));
  assert.equal(crypto.verify('RSA-SHA256', differentEndpoint, publicKey, signature), false);
});

test('payload is bound to actor, runtime, invitation/request IDs, and public-key fingerprint', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const signature = crypto.sign(
    'RSA-SHA256',
    Buffer.from(canonicalRuntimeOnboardingPayload(payload())),
    privateKey,
  );
  for (const patch of [
    { actor: 'luca-openai-agents' as const },
    { runtimeId: 'another-runtime' },
    { invitationId: 'another-invitation' },
    { requestId: 'another-request' },
    { fingerprint: `SHA256:${'B'.repeat(43)}` },
    { purpose: 'recover' as const },
  ]) {
    const altered = Buffer.from(canonicalRuntimeOnboardingPayload({ ...payload(), ...patch }));
    assert.equal(crypto.verify('RSA-SHA256', altered, publicKey, signature), false);
  }
});

test('onboarding endpoint is canonical, explicitly configured, and environment-gated', () => {
  const originalEndpoint = process.env.COORDINATION_PUBLIC_ENDPOINT;
  const originalApproved = process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS;
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    process.env.COORDINATION_PUBLIC_ENDPOINT = 'https://coordination.example/';
    process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS =
      'https://coordination.example,https://staging.example';
    assert.equal(trustedRuntimeOnboardingEndpoint(), 'https://coordination.example');

    process.env.COORDINATION_PUBLIC_ENDPOINT = 'https://unapproved.example';
    assert.throws(
      () => trustedRuntimeOnboardingEndpoint(),
      (error: unknown) => error instanceof RuntimeOnboardingError && error.code === 'INVALID_INPUT',
    );
    process.env.COORDINATION_PUBLIC_ENDPOINT = 'http://coordination.example';
    process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS = 'http://coordination.example';
    assert.throws(
      () => trustedRuntimeOnboardingEndpoint(),
      (error: unknown) => error instanceof RuntimeOnboardingError && error.code === 'INVALID_INPUT',
      'production refuses a non-HTTPS canonical endpoint',
    );

    process.env.NODE_ENV = 'development';
    process.env.COORDINATION_PUBLIC_ENDPOINT = 'http://127.0.0.1:5000';
    process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS = 'http://127.0.0.1:5000';
    assert.equal(trustedRuntimeOnboardingEndpoint(), 'http://127.0.0.1:5000');
  } finally {
    if (originalEndpoint === undefined) delete process.env.COORDINATION_PUBLIC_ENDPOINT;
    else process.env.COORDINATION_PUBLIC_ENDPOINT = originalEndpoint;
    if (originalApproved === undefined) delete process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS;
    else process.env.COORDINATION_RUNTIME_ONBOARDING_APPROVED_ENDPOINTS = originalApproved;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});