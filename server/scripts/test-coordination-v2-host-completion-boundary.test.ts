import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const auth = readFileSync('server/middleware/coordination-v2-host-auth.ts', 'utf8');
const service = readFileSync('server/services/coordination-v2-host-auth-service.ts', 'utf8');
const factory = readFileSync('server/scripts/coordination-v2-http-factory.ts', 'utf8');
const launcher = readFileSync('scripts/hola-coordinator.ps1', 'utf8');
const schema = readFileSync('shared/schema.ts', 'utf8');

test('V2 host auth is a separate namespace and cannot fall through to legacy actors', () => {
  assert.match(auth, /x-coordination-v2-host-token/);
  assert.match(auth, /requireCoordinationV2HostAuth/);
  assert.doesNotMatch(auth, /requireCoordinationAuth|resolveCoordinationActor|resolveBrokerCredential/);
  assert.match(service, /coordinationV2HostEnrollmentRequests/);
  assert.match(service, /coordinationV2HostProofChallenges/);
  assert.match(service, /verifyProof/);
  assert.match(service, /expiresAt/);
  assert.match(service, /revokedAt/);
  assert.match(service, /hostEnrollmentId/);
  assert.match(service, /function hash/);
  assert.doesNotMatch(service, /coordinationV2HostBootstraps|bootstrapHash/);
});

test('DPAPI factory and launcher do not make internal authority operator input', () => {
  assert.match(factory, /DataProtectionScope\]\:\:CurrentUser/);
  assert.match(factory, /x-coordination-v2-session-token/);
  assert.doesNotMatch(factory, /process\.argv/);
  assert.doesNotMatch(factory, /console\.(log|error|warn)/);
  assert.match(launcher, /Split-Path\s+-Parent/);
  assert.match(launcher, /Get-AuthenticodeSignature/);
  assert.match(launcher, /Get-FileHash/);
  assert.match(launcher, /status\s+--porcelain/);
  assert.doesNotMatch(launcher, /C:\\Users\\|COORDINATION_RUNTIME_BOOTSTRAP_TOKEN/);
});

test('schema keeps host bootstrap and credential lineage additive and non-secret', () => {
  assert.match(schema, /coordinationV2HostEnrollmentRequests/);
  assert.match(schema, /coordinationV2HostProofChallenges/);
  assert.match(schema, /coordinationV2HostCredentials/);
  assert.match(schema, /coordinationV2SessionCredentials/);
  assert.match(schema, /nonceHash/);
  assert.match(schema, /tokenHash/);
  assert.match(schema, /lineageDigest/);
  assert.match(schema, /enrollmentRequestKey/);
  assert.doesNotMatch(schema, /bootstrapPlaintext|credentialPlaintext|privateKey\s*:\s*text/);
});

test('wire contract self-checks reject removal of proof, binding, and cleanup scope', () => {
  assert.match(factory, /const proof = await sign\(sessionToken\)/);
  assert.match(factory, /x-coordination-v2-session-proof/);
  assert.match(factory, /envelope\('work_poll', \{ binding: state\.binding/);
  assert.match(factory, /cleanupSessionToken/);
  assert.match(service, /row\.leaseId/);
  assert.match(service, /row\.attemptId/);
  assert.notEqual(factory.replace(/x-coordination-v2-session-proof/g, ''), factory);
  assert.notEqual(factory.replace(/binding: state\.binding/g, ''), factory);
  assert.notEqual(factory.replace(/cleanupSessionToken/g, ''), factory);
});