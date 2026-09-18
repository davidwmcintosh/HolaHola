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

test('first-host bootstrap is source-bound, serialized, one-use, and never persisted', () => {
  const routes = readFileSync('server/routes/coordination-v2-host-admin-routes.ts', 'utf8');
  const bootstrapStart = service.indexOf('export async function submitCoordinationV2HostEnrollmentRequest');
  const bootstrapEnd = service.indexOf('export async function approveCoordinationV2HostEnrollment', bootstrapStart);
  assert.ok(bootstrapStart >= 0 && bootstrapEnd > bootstrapStart);
  const bootstrapService = service.slice(bootstrapStart, bootstrapEnd);
  assert.match(routes, /x-coordination-initial-bootstrap/);
  assert.doesNotMatch(routes, /requireCoordinationV2HostBootstrap/);
  assert.match(service, /COORDINATION_V2_HOST_BOOTSTRAP_SECRET/);
  assert.match(bootstrapService, /pg_advisory_xact_lock\(hashtextextended\(/);
  assert.match(bootstrapService, /coordinationV2SourcePromotions\.state,\s*'published'/);
  assert.match(bootstrapService, /V2_HOST_BOOTSTRAP_CONSUMED/);
  assert.match(service, /timingSafeEqual/);
  assert.match(routes, /approveCoordinationV2HostEnrollment/);
  assert.match(routes, /\.\.\.founderSession/);
  assert.match(routes, /completeCoordinationV2HostEnrollment/);
  assert.match(service, /verifyProof/);
  assert.doesNotMatch(service, /coordinationV2HostBootstraps|bootstrapHash|bootstrapPlaintext/);
  assert.ok(bootstrapService.indexOf('pg_advisory_xact_lock') < bootstrapService.indexOf('const prior = await tx.select()'));
  assert.ok(bootstrapService.indexOf('const existingRequest = await tx.select') < bootstrapService.indexOf('assertCoordinationV2InitialBootstrap({'));
  assert.ok(bootstrapService.indexOf('assertCoordinationV2InitialBootstrap({') < bootstrapService.indexOf('const row = await tx.insert'));
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
  const pollStart = factory.indexOf('poll: async ({ state, requestKey }: any) => {');
  const pollEnd = factory.indexOf('claim: async ({ state, requestKey, offer }: any) => {', pollStart);
  assert.ok(pollStart >= 0 && pollEnd > pollStart);
  const pollFactory = factory.slice(pollStart, pollEnd);
  assert.match(factory, /const proof = await sign\(sessionToken\)/);
  assert.match(factory, /x-coordination-v2-session-proof/);
  assert.match(pollFactory, /const binding = operationBinding\(state, 'poll', payload\)/);
  assert.match(pollFactory, /envelope\('work_poll', \{ binding \}\)/);
  assert.ok(
    pollFactory.indexOf("const binding = operationBinding(state, 'poll', payload)")
      < pollFactory.indexOf("envelope('work_poll', { binding })"),
  );
  assert.match(factory, /cleanupSessionToken/);
  assert.match(service, /row\.leaseId/);
  assert.match(service, /row\.attemptId/);
  assert.notEqual(factory.replace(/x-coordination-v2-session-proof/g, ''), factory);
  assert.notEqual(pollFactory.replace(/const binding = operationBinding\(state, 'poll', payload\)/g, ''), pollFactory);
  assert.notEqual(pollFactory.replace(/envelope\('work_poll', \{ binding \}\)/g, ''), pollFactory);
  assert.notEqual(factory.replace(/cleanupSessionToken/g, ''), factory);
});