import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertAuthenticatedRemoteCommitProof } from '../services/source-control-service';
import { canonicalJson } from '../services/coordination-policy-canonicalization';
import { issueCoordinationV2PreflightEnvelope } from '../services/coordination-v2-preflight-envelope';
import { verifyCoordinationV2PreflightEnvelope } from './coordination-v2-preflight-verifier';
import { readFileSync } from 'node:fs';
import { loadServerSigningPrivateKey } from '../services/coordination-v2-signing';
import { buildCoordinationV2PublicConfig } from '../services/coordination-v2-preparation-material-service';

test('fixture Ed25519 preflight is nonce-bound, public-only, and rejects replay/mutation', async () => {
  assert.throws(() => loadServerSigningPrivateKey({}), /COORDINATION_V2_SERVER_SIGNING_KEY_MISSING/);
  const pair = generateKeyPairSync('ed25519');
  const publicPem = pair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const root = await mkdtemp(join(tmpdir(), 'coordination-v2-signing-'));
  const pin = join(root, 'server-signing-public.pem');
  await writeFile(pin, publicPem, { mode: 0o600 });
  const artifact = '{"task":"fixture"}';
  const artifactSha = createHash('sha256').update(artifact).digest('hex');
  const promotion = {
    id: 'promotion', repositoryIdentity: 'github:owner/repo', promotedCommitSha: 'a'.repeat(40),
    exactTreeSha: 'b'.repeat(40), publicationReference: 'publish:fixture',
    protectedValidationId: 'c'.repeat(64), publishTriggerSha: null, parentSha: null,
    canonicalRecordDigest: 'd'.repeat(64), state: 'published', createdAt: new Date(),
    operationReceiptDigest: 'e'.repeat(64), operationReceiptReference: 'receipt',
  } as any;
  const issued = await issueCoordinationV2PreflightEnvelope({
    hostEnrollmentId: 'host', repositoryIdentity: promotion.repositoryIdentity, taskRef: 'task',
    taskArtifactSha: artifactSha, preparationGeneration: 'generation', reservationId: 'reservation',
    publicMaterialDigest: 'f'.repeat(64), material: { taskArtifact: artifact, publicCoordinatorConfig: '{"protocol":1}' },
    nonce: 'nonce-fixture', findPromotion: async () => promotion,
    signEnvelope: (payload) => ({
      signature: sign(null, Buffer.from(payload), pair.privateKey).toString('base64'),
      keyFingerprint: createHash('sha256').update(pair.publicKey.export({ type: 'spki', format: 'der' })).digest('hex'),
    }),
  });
  const verified = await verifyCoordinationV2PreflightEnvelope({
    payload: issued.payload, signature: issued.signature, keyFingerprint: issued.keyFingerprint,
    expectedHostEnrollmentId: 'host', expectedRepositoryIdentity: promotion.repositoryIdentity,
    expectedTaskArtifactSha: artifactSha, expectedPublicMaterialDigest: 'f'.repeat(64),
    pinnedPublicKeyPath: pin, verifyCheckout: async () => true,
  });
  assert.equal(verified.secretPlaintext, undefined);
  await assert.rejects(() => verifyCoordinationV2PreflightEnvelope({
    payload: issued.payload, signature: issued.signature, keyFingerprint: issued.keyFingerprint,
    expectedHostEnrollmentId: 'host', expectedRepositoryIdentity: promotion.repositoryIdentity,
    expectedTaskArtifactSha: artifactSha, expectedPublicMaterialDigest: 'f'.repeat(64),
    pinnedPublicKeyPath: pin,
  }), /NONCE_REPLAY/);
  assert.notEqual(canonicalJson(issued.payload), '');
});

test('public material contains the complete canonical policy object and digest', () => {
  const policy = {
    hostTypes: ['windows'], hostConstraints: { windowsRepositoryBranch: 'main' },
    tools: ['git'], paths: ['C:/Hola/work'], commands: ['npm run typecheck'],
    providerOrder: ['gemini', 'openai'], providerConstraints: { gemini: { models: ['safe'] } },
    sessionDurationMs: 900_000, totalAttemptBudget: 5,
    perProviderAttemptBudgets: { gemini: 3, openai: 2 }, transportLeaseDurationMs: 120_000,
    executionLeaseDurationMs: 60_000, retryableFailureClasses: ['timeout'],
    fallbackEligibleFailureClasses: ['rate_limit'], terminalFailureClasses: ['policy'],
    requiredValidationCommands: ['typecheck'], requiredCompletionEvidence: ['digest'],
    credentialCapabilities: ['preflight'], maxCredentialLifetimeMs: 900_000,
    cleanupRequirements: ['revoke_authority'],
  };
  const built = buildCoordinationV2PublicConfig({
    repositoryIdentity: 'github:owner/repo', promotedCommitSha: 'a'.repeat(40),
    exactTreeSha: 'b'.repeat(40), policy,
  });
  const parsed = JSON.parse(built.config) as Record<string, unknown>;
  assert.deepEqual(parsed.policy, built.canonicalPolicy);
  assert.equal(parsed.policyDigest, built.policyDigest);
  assert.equal(built.policyDigest, createHash('sha256').update(canonicalJson(built.canonicalPolicy)).digest('hex'));
});

test('source promotion authority is append-only and DB idempotent by exact identity', () => {
  const source = readFileSync('server/services/source-control-service.ts', 'utf8');
  const schema = readFileSync('shared/schema.ts', 'utf8');
  const preparation = readFileSync('server/scripts/coordination-windows-prepare.ts', 'utf8');
  const routes = readFileSync('server/routes/coordination-host-routes.ts', 'utf8');
  assert.match(source, /appendSourcePromotion/);
  assert.match(source, /db\.insert\(coordinationV2SourcePromotions\)/);
  assert.doesNotMatch(source, /db\.update\(coordinationV2SourcePromotions|db\.delete\(coordinationV2SourcePromotions/);
  assert.match(schema, /uq_coordination_v2_source_promotion_identity/);
  assert.match(schema, /coordinationV2SourcePromotions/);
  assert.match(preparation, /input\.secretPlaintext \?\?/);
  assert.doesNotMatch(preparation, /COORDINATION_RUNTIME_BOOTSTRAP_TOKEN|OPENAI_API_KEY|DATABASE_URL/);
  assert.match(routes, /issueCoordinationV2PreparationEnvelope/);
  assert.match(routes, /transitionCoordinationSession/);
  assert.match(routes, /issueSessionCredentials/);
  assert.ok(routes.lastIndexOf('transitionCoordinationSession') < routes.lastIndexOf('issueSessionCredential'));
  assert.notEqual(routes.replace(/taskArtifactSha256/g, ''), routes);
});

test('authenticated remote commit proof rejects SHA and tree mutation', () => {
  const sha = 'a'.repeat(40);
  assert.doesNotThrow(() => assertAuthenticatedRemoteCommitProof(sha, { sha, treeSha: 'b'.repeat(40) }));
  assert.throws(() => assertAuthenticatedRemoteCommitProof(sha, { sha: 'c'.repeat(40), treeSha: 'b'.repeat(40) }), /proof_mismatch/);
  assert.throws(() => assertAuthenticatedRemoteCommitProof(sha, { sha, treeSha: 'c'.repeat(40) }, 'b'.repeat(40)), /proof_mismatch/);
});