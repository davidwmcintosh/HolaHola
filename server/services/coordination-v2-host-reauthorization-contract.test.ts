import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(new URL('./coordination-v2-host-auth-service.ts', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../routes/coordination-v2-host-admin-routes.ts', import.meta.url), 'utf8');

test('reauthorization wire contract is isolated and exact', () => {
  assert.match(service, /REAUTH_DECLARATION_KEYS = \['kind', 'requestKey', 'issuedAt', 'expiresAt', 'protocolVersion',\s*'hostId', 'keyFingerprint', 'requestGeneration'\]/);
  assert.doesNotMatch(service.slice(service.indexOf('REAUTH_DECLARATION_KEYS'), service.indexOf('REAUTH_CHALLENGE_KEYS')), /hostEnrollmentId/);
  assert.match(routes, /exactBody\(body, \['declaration', 'signature', 'publicKey', 'keyFingerprint'\]\)/);
  assert.match(routes, /exactBody\(body, \['requestKey', 'challengeId', 'nonce', 'signature'\]\)/);
  assert.match(routes, /x-hola-reauthorization-key/);
  assert.doesNotMatch(routes.slice(routes.indexOf("host/reauthorization-requests/:id/status"), routes.indexOf("host/reauthorization-requests/:id/proof")), /req\.query\.requestKey/);
  assert.match(service, /host\.capabilities\.includes\('host:transport'\).*host\.capabilities\.includes\('host:cleanup'\)/s);
  assert.match(service, /status: 'challenge_unavailable'/);
  assert.match(service, /return \{ requestId: request\.id, status: 'expired' as const \}/);
  assert.match(service, /hash\(input\.nonce\) !== challenge\.nonceDigest/);
  assert.match(service, /digest\(signed\) !== challenge\.challengeDigest/);
  assert.match(service, /return \{ accessToken: token, expiresAt: credential\.expiresAt\.toISOString\(\) \}/);
});

test('pre-insert reauthorization failures use bounded validation stages', () => {
  assert.match(service, /V2_HOST_REAUTH_DECLARATION_INVALID/);
  assert.match(service, /V2_HOST_REAUTH_PUBLIC_KEY_INVALID/);
  assert.match(service, /V2_HOST_REAUTH_SIGNATURE_INVALID/);
  const declaration = service.indexOf("fail('V2_HOST_REAUTH_DECLARATION_INVALID')");
  const publicKey = service.indexOf("fail('V2_HOST_REAUTH_PUBLIC_KEY_INVALID')");
  const signature = service.indexOf("fail('V2_HOST_REAUTH_SIGNATURE_INVALID')", publicKey);
  const validationCall = service.indexOf('validateCoordinationV2HostReauthorizationSubmission({ ...input, now })');
  const transaction = service.indexOf('db.transaction', validationCall);
  const insert = service.indexOf('coordinationV2HostReauthorizationRequests).values');
  assert.ok(declaration >= 0 && publicKey >= 0 && signature > publicKey);
  assert.ok(validationCall > signature && transaction > validationCall && insert > transaction);
});

test('recovery context is read-only and generation checks follow exact replay under the enrollment lock', () => {
  const context = service.slice(service.indexOf('export async function getCoordinationV2HostRecoveryContext'),
    service.indexOf('function reauthDeclaration'));
  assert.match(context, /validateCoordinationV2HostRecoveryContextSubmission/);
  assert.match(context, /validateRecoveryEnrollment/);
  assert.match(context, /\.for\('share'\)/);
  assert.match(context, /Math\.max\(highest \+ 1, Number\(value\.minimumGeneration\)\)/);
  assert.doesNotMatch(context, /tx\.(insert|update|delete)|randomToken|issue.*Challenge/);
  const submit = service.slice(service.indexOf('export async function submitCoordinationV2HostReauthorizationRequest'),
    service.indexOf('export async function approveCoordinationV2HostReauthorization'));
  assert.ok(submit.indexOf(".for('update')") < submit.indexOf('if (prior[0])'));
  assert.ok(submit.indexOf('if (prior[0])') < submit.indexOf('request.generation >= generation'));
  assert.ok(submit.indexOf('request.generation >= generation') < submit.indexOf('.values({'));
  assert.match(routes, /host\/recovery-context', strictLimiter/);
  assert.match(routes, /res\.set\('Cache-Control', 'no-store'\)/);
});

test('reauthorization has no runtime/task/session authority dependencies', () => {
  assert.doesNotMatch(service, /runtime-bootstrap|task-service|session-service|Initialize-HolaCoordinatorRuntime|Invoke-HolaCoordinator/);
});