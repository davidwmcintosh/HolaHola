import assert from 'node:assert/strict';
import { createHash, createPublicKey, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

const path = process.argv[2];
assert.ok(path, 'payload path is required');
const body = JSON.parse(readFileSync(path, 'utf8'));
assert.deepEqual(Object.keys(body).sort(), ['declaration', 'keyFingerprint', 'publicKey', 'signature']);
assert.deepEqual(Object.keys(body.declaration).sort(), [
  'expiresAt', 'hostId', 'issuedAt', 'keyFingerprint', 'kind',
  'protocolVersion', 'requestGeneration', 'requestKey',
]);
assert.equal(body.declaration.kind, 'host_credential_reauthorization');
assert.equal(body.declaration.protocolVersion, 1);
assert.ok(Number.isInteger(body.declaration.requestGeneration));
assert.equal(body.declaration.keyFingerprint, body.keyFingerprint);

const jwk = JSON.parse(body.publicKey);
assert.deepEqual(Object.keys(jwk).sort(), ['e', 'kty', 'n']);
assert.equal(jwk.kty, 'RSA');
const fingerprint = createHash('sha256').update(canonicalJson(jwk)).digest('hex');
assert.equal(fingerprint, body.keyFingerprint);

const issuedAt = new Date(body.declaration.issuedAt);
const expiresAt = new Date(body.declaration.expiresAt);
assert.equal(expiresAt.getTime() - issuedAt.getTime(), 60 * 60_000);
assert.equal(verify(
  'RSA-SHA256',
  Buffer.from(canonicalJson(body.declaration)),
  createPublicKey({ key: jwk, format: 'jwk' }),
  Buffer.from(body.signature, 'base64'),
), true);

console.log('[coordinator-v2] Node accepted the PowerShell wire payload');