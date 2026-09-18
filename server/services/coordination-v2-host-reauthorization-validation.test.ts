import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import test from 'node:test';
import {
  CoordinationV2HostAuthError,
  validateCoordinationV2HostReauthorizationSubmission,
} from './coordination-v2-host-auth-service';
import { canonicalJson } from './coordination-policy-canonicalization';

const now = new Date('2026-09-17T12:00:00.000Z');
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' });
const publicKeyJson = JSON.stringify(jwk);
const fingerprint = createHash('sha256').update(canonicalJson(jwk)).digest('hex');

function declaration(lifetimeMs = 60 * 60_000, keyFingerprint = fingerprint) {
  return {
    kind: 'host_credential_reauthorization',
    requestKey: '11111111-1111-4111-8111-111111111111',
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lifetimeMs).toISOString(),
    protocolVersion: 1,
    hostId: 'WINDOWS-TEST',
    keyFingerprint,
    requestGeneration: 1,
  };
}

function signature(value: unknown): string {
  return sign('RSA-SHA256', Buffer.from(canonicalJson(value)), privateKey).toString('base64');
}

function rejectsCode(action: () => unknown, code: string): void {
  assert.throws(action, (error: unknown) =>
    error instanceof CoordinationV2HostAuthError && error.code === code);
}

test('valid PowerShell-compatible submission passes pure pre-insert validation', () => {
  const value = declaration();
  const result = validateCoordinationV2HostReauthorizationSubmission({
    declaration: value,
    signature: signature(value),
    publicKey: publicKeyJson,
    keyFingerprint: fingerprint,
    now,
  });
  assert.equal(result.expiry.getTime() - result.issued.getTime(), 60 * 60_000);
});

test('overlong declaration fails before public-key and signature validation', () => {
  const value = declaration(60 * 60_000 + 1);
  rejectsCode(() => validateCoordinationV2HostReauthorizationSubmission({
    declaration: value,
    signature: signature(value),
    publicKey: publicKeyJson,
    keyFingerprint: fingerprint,
    now,
  }), 'V2_HOST_REAUTH_DECLARATION_INVALID');
});

test('public-key mismatch has a bounded pre-insert code', () => {
  const wrongFingerprint = '0'.repeat(64);
  const value = declaration(60 * 60_000, wrongFingerprint);
  rejectsCode(() => validateCoordinationV2HostReauthorizationSubmission({
    declaration: value,
    signature: signature(value),
    publicKey: publicKeyJson,
    keyFingerprint: wrongFingerprint,
    now,
  }), 'V2_HOST_REAUTH_PUBLIC_KEY_INVALID');
});

test('unimportable RSA JWK is classified as a public-key failure', () => {
  const malformedJwk = { kty: 'RSA', n: 1, e: 'AQAB' };
  const malformedPublicKey = JSON.stringify(malformedJwk);
  const malformedFingerprint = createHash('sha256')
    .update(canonicalJson(malformedJwk)).digest('hex');
  const value = declaration(60 * 60_000, malformedFingerprint);
  rejectsCode(() => validateCoordinationV2HostReauthorizationSubmission({
    declaration: value,
    signature: signature(value),
    publicKey: malformedPublicKey,
    keyFingerprint: malformedFingerprint,
    now,
  }), 'V2_HOST_REAUTH_PUBLIC_KEY_INVALID');
});

test('canonical signature mismatch has a bounded pre-insert code', () => {
  const value = declaration();
  const changed = { ...value, hostId: 'CHANGED-AFTER-SIGNING' };
  rejectsCode(() => validateCoordinationV2HostReauthorizationSubmission({
    declaration: changed,
    signature: signature(value),
    publicKey: publicKeyJson,
    keyFingerprint: fingerprint,
    now,
  }), 'V2_HOST_REAUTH_SIGNATURE_INVALID');
});