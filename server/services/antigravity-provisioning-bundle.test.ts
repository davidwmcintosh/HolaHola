import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  GATE3, createPublicProvisioningBundle, validatePublicProvisioningBundle,
} from './antigravity-provisioning-bundle';
import { publicKeyFingerprint } from './task-ownership-key-custody';

function input() {
  const pair = generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'der' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const publicKey = pair.publicKey.toString('base64url');
  return {
    ...GATE3, capabilities: [...GATE3.capabilities], artifactSha256: 'a'.repeat(64),
    publicKey, keyFingerprint: publicKeyFingerprint(publicKey),
    bootstrapSha256: 'b'.repeat(64), worktreeRealpathDigest: 'c'.repeat(64),
    startingCommit: 'd'.repeat(40),
  };
}

test('public bundle is canonical and contains no secret', () => {
  const bundle = createPublicProvisioningBundle(input());
  assert.equal(bundle.bundleDigest.length, 64);
  assert.equal(JSON.stringify(bundle).includes('cb_'), false);
  assert.doesNotThrow(() => validatePublicProvisioningBundle(bundle));
});

test('bundle rejects tampering, unknown fields, and key mismatch', () => {
  const bundle: any = createPublicProvisioningBundle(input());
  assert.throws(() => validatePublicProvisioningBundle({ ...bundle, artifactSha256: 'A'.repeat(64) }));
  assert.throws(() => validatePublicProvisioningBundle({ ...bundle, secret: 'sentinel' }));
  assert.throws(() => validatePublicProvisioningBundle({ ...bundle, keyFingerprint: 'e'.repeat(64) }));
});