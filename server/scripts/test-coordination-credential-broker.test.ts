import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { after, test } from 'node:test';
import { and, eq, sql } from 'drizzle-orm';
import {
  coordinationCredentialAuditEvents,
  coordinationGate3ProofGrants,
  coordinationRuntimeCredentials,
  coordinationRuntimeInboxWindows,
  coordinationRuntimePackets,
  coordinationRuntimeRegistrations,
  coordinationRuntimeProfiles,
  coordinationThreads,
  taskOwnershipChallenges,
  taskOwnershipReceipts,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  exchangeBootstrapCredential,
  registerCoordinationRuntime,
  registerCoordinationRuntimeWithBootstrapSha256,
  hashCoordinationSecret,
  renewBrokerCredential,
  resolveBrokerCredential,
  revokeBrokerCredential,
  revokeRuntimeCredentials,
} from '../services/coordination-credential-broker';
import {
  createPublicProvisioningBundle,
  type PublicProvisioningBundle,
} from '../services/antigravity-provisioning-bundle';
import {
  submitAntigravityChallenge,
  registerAntigravityRuntime,
} from './provision-antigravity-runtime';
import { createChallenge, decideChallenge, revokeReceipt, issueProofNonce, verifyProof } from '../services/founder-task-ownership-service';
import { canonicalJson } from '../services/task-ownership-service';
import { buildGate3ProofResponse } from '../routes/founder-task-ownership-routes';
import { parseOwnershipProof } from './coordination-runtime-antigravity';
import {
  issueGate3ProofGrant,
  computeGate3GrantExpiry,
  validateGate3ProofGrant,
  validateGate3ProofGrantForVerifier,
  withGate3ProofGrantAuthority,
} from '../services/coordination-gate3-proof-grant-service';

const hasDisposableDatabase = Boolean(
  getVerifiedCiDatabaseUrl() || process.env.COORDINATION_INBOX_DISPOSABLE_BRANCH_ID,
);
const databaseTest = hasDisposableDatabase ? test : test.skip;
const runtimeId = `credential-broker-${Date.now()}`;
const revocationRaceRuntimeId = `${runtimeId}-revocation-race`;
const prehashedRuntimeId = `${runtimeId}-prehashed`;
let operatorRuntimeId = '';
const operatorTaskRef = `operator-${Date.now()}`;

function runProvisioningCli(args: string[], bundle: PublicProvisioningBundle) {
  return spawnSync(
    'npx',
    ['tsx', 'server/scripts/provision-antigravity-runtime.ts', ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: process.env,
      input: JSON.stringify(bundle),
      timeout: 30_000,
    },
  );
}

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

after(async () => {
  if (!hasDisposableDatabase) return;
  await closeDbConnections();
});

databaseTest('trusted prehashed registration is strict, retry-safe, and never returns or audits secrets', async () => {
  const bootstrap = `cb_${crypto.randomBytes(32).toString('base64url')}`;
  const digest = hashCoordinationSecret(bootstrap);
  const input: Parameters<typeof registerCoordinationRuntimeWithBootstrapSha256>[0] = {
    runtimeId: prehashedRuntimeId,
    actor: 'luca-replit',
    displayName: 'Prehashed broker CI runtime',
    capabilities: ['coordination:read'],
    tokenTtlSeconds: 60,
    bootstrapSha256: digest,
  };

  const created = await registerCoordinationRuntimeWithBootstrapSha256(input);
  assert.equal(created.status, 'created');
  assert.equal(JSON.stringify(created).includes(digest), false);
  assert.equal(JSON.stringify(created).includes(bootstrap), false);

  const captureError = async (operation: () => Promise<unknown>): Promise<unknown> => {
    let caught: unknown;
    try {
      await operation();
    } catch (error) {
      caught = error;
    }
    assert.ok(caught, 'expected operation to reject');
    return caught;
  };
  assert.equal(await exchangeBootstrapCredential(prehashedRuntimeId, digest), null);

  const replayed = await registerCoordinationRuntimeWithBootstrapSha256(input);
  assert.equal(replayed.status, 'replayed');
  assert.deepEqual(replayed, { ...created, status: 'replayed' });
  assert.ok(await exchangeBootstrapCredential(prehashedRuntimeId, bootstrap));

  for (const invalidDigest of [
    digest.toUpperCase(),
    digest.slice(0, 63),
    `${digest}0`,
    `${digest.slice(0, 63)}g`,
  ]) {
    const error = await captureError(
      () => registerCoordinationRuntimeWithBootstrapSha256({ ...input, bootstrapSha256: invalidDigest }),
    );
    assert.match(String(error), /lowercase hexadecimal SHA-256/);
    assert.equal(String(error).includes(bootstrap), false);
    assert.equal(String(error).includes(digest), false);
  }

  const conflictError = await captureError(() => registerCoordinationRuntimeWithBootstrapSha256({
      ...input,
      actor: 'luca-claude-code',
    }));
  assert.match(String(conflictError), /conflicts with an existing record/);
  assert.equal(String(conflictError).includes(bootstrap), false);
  assert.equal(String(conflictError).includes(digest), false);
  const events = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, prehashedRuntimeId));
  const serializedEvents = JSON.stringify(events);
  assert.equal(serializedEvents.includes(bootstrap), false);
  assert.equal(events.some((event) =>
    event.eventType === 'runtime_bootstrap_consumed'
    && (event.metadata as Record<string, unknown>).approvedBootstrapSha256 === digest
  ), true);
  assert.equal(events.some((event) => event.eventType === 'runtime_registration_replayed'), true);
  assert.equal(events.some((event) => event.eventType === 'runtime_registration_rejected'), true);
});

databaseTest('operator provisioning is two-phase, receipt-bound, atomic, and concurrent-retry safe', async () => {
  const keys = crypto.generateKeyPairSync('ed25519');
  const der = keys.publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
  const publicKey = der.toString('base64url');
  const keyFingerprint = crypto.createHash('sha256').update(der).digest('hex');
  const secret = `operator-secret-${crypto.randomBytes(24).toString('hex')}`;
  const bundle = createPublicProvisioningBundle({
    runtimeId: operatorRuntimeId,
    actor: 'luca-gemini',
    credentialCapabilities: ['coordination:read', 'coordination:write', 'coordination:inbox:ack', 'coordination:credential:renew'],
    runtimeCapabilities: ['execute', 'model'],
    tokenTtlSeconds: 900,
    taskRef: '1448',
    artifactSha256: crypto.createHash('sha256').update(`${operatorTaskRef}-artifact`).digest('hex'),
    publicKey,
    keyFingerprint,
    bootstrapSha256: hashCoordinationSecret(secret),
    worktreeRealpathDigest: '1'.repeat(64),
    branch: 'luca/gemini-experiment',
    startingCommit: '2'.repeat(40),
    provider: 'gemini',
    model: 'gemini-3-flash-preview',
    adapterVersion: 'coordination-gemini-v1',
    repositoryLabel: 'HolaHola',
    worktreeLabel: 'HolaHola-antigravity',
  });
  operatorRuntimeId = bundle.runtimeId;
  const assertNoAuthority = async () => {
    assert.equal((await getSharedDb().select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, operatorRuntimeId))).length, 0);
    assert.equal((await getSharedDb().select().from(coordinationRuntimeProfiles)
      .where(eq(coordinationRuntimeProfiles.runtimeRegistrationId, operatorRuntimeId))).length, 0);
  };

  const [challengeCountBeforeInvalid] = await getSharedDb().select({
    count: sql<number>`count(*)::int`,
  }).from(taskOwnershipChallenges);
  await assert.rejects(
    () => submitAntigravityChallenge(bundle, undefined),
    /attempt_id_required/,
  );
  await assert.rejects(
    () => submitAntigravityChallenge(bundle, crypto.randomUUID().toUpperCase()),
    /attempt_id_invalid/,
  );
  await assert.rejects(
    () => submitAntigravityChallenge(bundle, 'a'.repeat(201)),
    /attempt_id_invalid/,
  );
  const [challengeCountAfterInvalid] = await getSharedDb().select({
    count: sql<number>`count(*)::int`,
  }).from(taskOwnershipChallenges);
  assert.equal(challengeCountAfterInvalid.count, challengeCountBeforeInvalid.count);

  const cliMissing = runProvisioningCli(['phase-a'], bundle);
  assert.equal(cliMissing.status, 1);
  assert.match(cliMissing.stderr, /antigravity_provisioning_attempt_id_required/);
  const cliMalformed = runProvisioningCli(['phase-a', '--attempt-id', 'NOT-A-UUID'], bundle);
  assert.equal(cliMalformed.status, 1);
  assert.match(cliMalformed.stderr, /antigravity_provisioning_attempt_id_invalid/);
  const cliOversized = runProvisioningCli(['phase-a', '--attempt-id', 'a'.repeat(201)], bundle);
  assert.equal(cliOversized.status, 1);
  assert.match(cliOversized.stderr, /antigravity_provisioning_attempt_id_invalid/);
  const cliAttemptId = crypto.randomUUID();
  const cliValid = runProvisioningCli(['phase-a', '--attempt-id', cliAttemptId], bundle);
  assert.equal(cliValid.status, 0, cliValid.stderr);
  const cliJsonLine = cliValid.stdout.split('\n').find((line) => line.startsWith('{'));
  assert.ok(cliJsonLine);
  const cliResult = JSON.parse(cliJsonLine);
  assert.equal(cliResult.attemptId, cliAttemptId);
  const cliPhaseB = runProvisioningCli(
    ['phase-b', '--challenge-id', cliResult.challengeId],
    bundle,
  );
  assert.equal(cliPhaseB.status, 1);
  assert.match(cliPhaseB.stderr, /antigravity_provisioning_challenge_not_approved/);
  assert.doesNotMatch(cliPhaseB.stderr, /attempt_id/);

  const phaseAAttemptId = crypto.randomUUID();
  const phaseA = await submitAntigravityChallenge(bundle, phaseAAttemptId);
  assert.equal(phaseA.bundleDigest, bundle.bundleDigest);
  assert.equal(phaseA.attemptId, phaseAAttemptId);
  const phaseARetry = await submitAntigravityChallenge(bundle, phaseAAttemptId);
  assert.equal(phaseARetry.challengeId, phaseA.challengeId);
  await getSharedDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL session_replication_role = replica`);
    await tx.update(taskOwnershipChallenges)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(taskOwnershipChallenges.id, phaseA.challengeId));
  });
  await assert.rejects(
    () => decideChallenge(phaseA.challengeId, 'approved', 'expired-attempt-test'),
    /CHALLENGE_EXPIRED/,
  );
  const [expiredPhaseARow] = await getSharedDb().select().from(taskOwnershipChallenges)
    .where(eq(taskOwnershipChallenges.id, phaseA.challengeId));
  assert.equal(expiredPhaseARow.status, 'expired');
  const freshAttemptId = crypto.randomUUID();
  const freshPhaseA = await submitAntigravityChallenge(bundle, freshAttemptId);
  assert.notEqual(freshPhaseA.challengeId, phaseA.challengeId);
  const [freshPhaseARow] = await getSharedDb().select().from(taskOwnershipChallenges)
    .where(eq(taskOwnershipChallenges.id, freshPhaseA.challengeId));
  assert.equal(freshPhaseARow.status, 'pending');
  assert.equal(freshPhaseARow.taskRef, bundle.taskRef);
  assert.equal(freshPhaseARow.artifactSha256, bundle.artifactSha256);
  assert.equal(freshPhaseARow.intendedActor, bundle.actor);
  assert.equal(freshPhaseARow.coordinationActor, bundle.actor);
  assert.equal(freshPhaseARow.publicKey, bundle.publicKey);
  assert.equal(freshPhaseARow.keyFingerprint, bundle.keyFingerprint);
  assert.equal(freshPhaseARow.contextDigest, bundle.bundleDigest);
  assert.equal(
    freshPhaseARow.idempotencyKey,
    `antigravity:${bundle.bundleDigest}:${freshAttemptId}`,
  );
  const [expiredPhaseARowAfterFresh] = await getSharedDb().select().from(taskOwnershipChallenges)
    .where(eq(taskOwnershipChallenges.id, phaseA.challengeId));
  assert.deepEqual(expiredPhaseARowAfterFresh, expiredPhaseARow);
  await assert.rejects(() => registerAntigravityRuntime(bundle, freshPhaseA.challengeId), /challenge_not_approved/);
  await assertNoAuthority();

  const receipt = await decideChallenge(freshPhaseA.challengeId, 'approved', 'founder-operator-test');
  assert.ok('id' in receipt);
  await getSharedDb().execute(sql`
    CREATE FUNCTION reject_antigravity_profile_insert() RETURNS trigger
    LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'forced antigravity profile insert failure';
    END
    $$
  `);
  await getSharedDb().execute(sql`
    CREATE TRIGGER reject_antigravity_profile_insert
    BEFORE INSERT ON coordination_runtime_profiles
    FOR EACH ROW EXECUTE FUNCTION reject_antigravity_profile_insert()
  `);
  try {
    await assert.rejects(
      () => registerAntigravityRuntime(bundle, freshPhaseA.challengeId),
      /Failed query: insert into "coordination_runtime_profiles"/,
    );
    await assertNoAuthority();
  } finally {
    await getSharedDb().execute(sql`
      DROP TRIGGER IF EXISTS reject_antigravity_profile_insert
      ON coordination_runtime_profiles
    `);
    await getSharedDb().execute(sql`
      DROP FUNCTION IF EXISTS reject_antigravity_profile_insert()
    `);
  }
  const registered = await registerAntigravityRuntime(bundle, freshPhaseA.challengeId);
  assert.equal(registered.status, 'created');
  assert.equal((await getSharedDb().select().from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, operatorRuntimeId))).length, 1);
  assert.equal((await getSharedDb().select().from(coordinationRuntimeProfiles)
    .where(eq(coordinationRuntimeProfiles.runtimeRegistrationId, operatorRuntimeId))).length, 1);
  const replay = await registerAntigravityRuntime(bundle, freshPhaseA.challengeId);
  assert.equal(replay.status, 'replayed');
  const exchanged = await exchangeBootstrapCredential(operatorRuntimeId, secret);
  assert.ok(exchanged);
  const brokerCredential = await resolveBrokerCredential(exchanged!.accessToken);
  assert.ok(brokerCredential);
  const renewedGrantCredential = await renewBrokerCredential(brokerCredential);
  assert.ok(renewedGrantCredential);
  const nonce = await issueProofNonce(registered.receiptId, 'luca-gemini');
  const payload = canonicalJson(nonce.signedPayload);
  const signature = crypto.sign(null, Buffer.from(payload), keys.privateKey).toString('base64url');
  const proof = await verifyProof(nonce.nonceId, signature, 'luca-gemini');
  assert.equal(proof.verified, true);
  const grant = await issueGate3ProofGrant(proof as any, renewedGrantCredential!.credential);
  assert.equal(grant.taskRef, '1448');
  assert.equal(grant.runtimeRegistrationId, operatorRuntimeId);
  assert.equal(JSON.stringify(grant).includes(secret), false);
  const syntheticIssuedAt = new Date('2026-09-11T12:00:00.000Z');
  const syntheticLateChallengeExpiry = new Date(syntheticIssuedAt.getTime() + 40_000);
  assert.equal(
    computeGate3GrantExpiry(
      syntheticIssuedAt,
      syntheticLateChallengeExpiry,
      new Date(syntheticIssuedAt.getTime() + 20 * 60_000),
      new Date(syntheticIssuedAt.getTime() + 30 * 60_000),
    ).getTime(),
    syntheticLateChallengeExpiry.getTime(),
    'late issuance must advertise no authority beyond the challenge expiry',
  );
  const routeResponse = buildGate3ProofResponse(proof as any, grant);
  assert.deepEqual(Object.keys(routeResponse).sort(), [
    'artifactSha256', 'contextDigest', 'grant', 'intendedActor', 'ok',
    'proofPayloadDigest', 'receiptId', 'taskRef', 'verified',
  ]);
  assert.deepEqual(Object.keys(routeResponse.grant).sort(), [
    'artifactSha256', 'contextDigest', 'expiresAt', 'id', 'startingCommit', 'taskRef',
  ]);
  const parsedRouteResponse = parseOwnershipProof(
    routeResponse, registered.receiptId, bundle.artifactSha256,
  );
  assert.equal(parsedRouteResponse.grant.id, grant.id);
  const [replayedGrant, concurrentGrant] = await Promise.all([
    issueGate3ProofGrant(proof as any, renewedGrantCredential!.credential),
    issueGate3ProofGrant(proof as any, renewedGrantCredential!.credential),
  ]);
  assert.equal(replayedGrant.id, grant.id);
  assert.equal(concurrentGrant.id, grant.id);
  assert.equal((await validateGate3ProofGrant(grant.id, renewedGrantCredential!.credential)).grantId, grant.id);
  assert.equal((await validateGate3ProofGrantForVerifier(grant.id)).grantId, grant.id);
  assert.equal(await renewBrokerCredential(renewedGrantCredential!.credential), null);
  const successorGrant = grant;
  await assert.rejects(() => validateGate3ProofGrant(grant.id, brokerCredential), /GATE3_PROOF_GRANT_INVALID/);
  const concurrent = await Promise.all([
    registerAntigravityRuntime(bundle, freshPhaseA.challengeId),
    registerAntigravityRuntime(bundle, freshPhaseA.challengeId),
  ]);
  assert.deepEqual(concurrent.map((result) => result.status).sort(), ['replayed', 'replayed']);
  await getSharedDb().update(coordinationRuntimeProfiles)
    .set({ model: 'conflicting-model' })
    .where(eq(coordinationRuntimeProfiles.runtimeRegistrationId, operatorRuntimeId));
  await assert.rejects(() => registerAntigravityRuntime(bundle, freshPhaseA.challengeId), /profile_conflict/);
  assert.equal((await getSharedDb().select().from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, operatorRuntimeId))).length, 1);
  await getSharedDb().update(coordinationRuntimeProfiles)
    .set({ model: bundle.model })
    .where(eq(coordinationRuntimeProfiles.runtimeRegistrationId, operatorRuntimeId));

  await assert.rejects(
    () => registerAntigravityRuntime({ ...bundle, bootstrapSha256: '3'.repeat(64) }, freshPhaseA.challengeId),
    /invalid_bundle/,
  );
  await assert.rejects(
    () => registerAntigravityRuntime({ ...bundle, keyFingerprint: '4'.repeat(64) }, freshPhaseA.challengeId),
    /invalid_bundle|receipt_mismatch/,
  );
  assert.equal(JSON.stringify(registered).includes(secret), false);
  const rollbackProbe = new Error('ROLLBACK_AUTHORITY_LOCK_PROBE');
  const authorityUpdateCases = [
    {
      name: 'grant',
      run: () => getSharedDb().transaction(async (tx) => {
        await tx.update(coordinationGate3ProofGrants).set({ revokedAt: null })
          .where(eq(coordinationGate3ProofGrants.id, successorGrant.id));
        throw rollbackProbe;
      }),
    },
    {
      name: 'receipt',
      run: () => getSharedDb().transaction(async (tx) => {
        await tx.update(taskOwnershipReceipts).set({ revokedAt: null })
          .where(eq(taskOwnershipReceipts.id, registered.receiptId));
        throw rollbackProbe;
      }),
    },
    {
      name: 'challenge',
      run: () => getSharedDb().transaction(async (tx) => {
        await tx.update(taskOwnershipChallenges).set({ status: 'approved' })
          .where(eq(taskOwnershipChallenges.id, freshPhaseA.challengeId));
        throw rollbackProbe;
      }),
    },
    {
      name: 'credential',
      run: () => getSharedDb().transaction(async (tx) => {
        await tx.update(coordinationRuntimeCredentials).set({ revokedAt: null })
          .where(eq(coordinationRuntimeCredentials.id, renewedGrantCredential!.credential.credentialId));
        throw rollbackProbe;
      }),
    },
    {
      name: 'registration',
      run: () => getSharedDb().transaction(async (tx) => {
        await tx.update(coordinationRuntimeRegistrations).set({ enabled: true })
          .where(eq(coordinationRuntimeRegistrations.id, operatorRuntimeId));
        throw rollbackProbe;
      }),
    },
    {
      name: 'profile',
      run: () => getSharedDb().transaction(async (tx) => {
        await tx.update(coordinationRuntimeProfiles).set({ status: 'active' })
          .where(eq(coordinationRuntimeProfiles.id, registered.profileId));
        throw rollbackProbe;
      }),
    },
  ];
  for (const authorityCase of authorityUpdateCases) {
    const authorityEntered = deferred();
    const releaseAuthority = deferred();
    const leasedOperation = withGate3ProofGrantAuthority(
      successorGrant.id,
      renewedGrantCredential!.credential,
      async () => {
        authorityEntered.resolve();
        await releaseAuthority.promise;
        return 'completed-under-authority';
      },
    );
    await authorityEntered.promise;
    let updateSettled = false;
    const updateAttempt = authorityCase.run().then(
      () => assert.fail(`${authorityCase.name} lock probe unexpectedly committed`),
      (error) => {
        if (error !== rollbackProbe) {
          const message = String(
            (error as { cause?: { message?: string } })?.cause?.message
            ?? (error as Error)?.message
            ?? error,
          );
          if (authorityCase.name === 'receipt') {
            assert.match(message, /invalid task ownership receipt transition/);
          } else if (authorityCase.name === 'challenge') {
            assert.match(message, /invalid task ownership challenge transition/);
          } else {
            throw error;
          }
        }
        updateSettled = true;
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(updateSettled, false, `${authorityCase.name} update must wait for the authority lease`);
    releaseAuthority.resolve();
    assert.equal(await leasedOperation, 'completed-under-authority');
    await updateAttempt;
    assert.equal(updateSettled, true);
    assert.equal(
      (await validateGate3ProofGrant(successorGrant.id, renewedGrantCredential!.credential)).grantId,
      successorGrant.id,
    );
  }

  const [probeThread] = await getSharedDb().select().from(coordinationThreads).limit(1);
  assert.ok(probeThread);
  const probeWindowId = `gate3-fk-window-${Date.now()}`;
  const probeWindowDigest = crypto.createHash('sha256').update(probeWindowId).digest('hex');
  const [probeWindow] = await getSharedDb().insert(coordinationRuntimeInboxWindows).values({
    id: probeWindowId,
    threadId: probeThread.id,
    afterExclusive: 0,
    throughInclusive: 1,
    boundaryToken: 'gate3-fk-probe',
    orderedItemIds: [`${probeWindowId}-item`],
    boundaryDigest: probeWindowDigest,
    canonicalPayload: { kind: 'gate3-fk-probe' },
  }).returning();
  await withGate3ProofGrantAuthority(
    successorGrant.id,
    renewedGrantCredential!.credential,
    async () => {
      const packetProbe = getSharedDb().transaction(async (tx) => {
        const probeId = `gate3-fk-probe-${Date.now()}`;
        await tx.insert(coordinationRuntimePackets).values({
          id: probeId,
          profileId: registered.profileId,
          runtimeRegistrationId: operatorRuntimeId,
          version: 1,
          assignmentEventId: probeId,
          assignmentTaskId: '1448',
          assignmentThreadId: probeWindow.threadId,
          assignmentAuthor: 'luca-replit',
          expectedSequence: 1,
          supersedesClaimId: null,
          windowId: probeWindow.id,
          windowDigest: probeWindow.boundaryDigest,
          orderedInboxItemIds: [probeId],
          orderedEventIds: [probeId],
          orderedThreadIds: [probeWindow.threadId],
          inheritedPayload: [],
          envelope: {},
          canonicalPayload: {},
          digest: crypto.createHash('sha256').update(probeId).digest('hex'),
          createdAt: new Date(),
        });
        throw rollbackProbe;
      });
      await assert.rejects(
        Promise.race([
          packetProbe,
          new Promise((_, reject) => setTimeout(() => reject(new Error('FK_PACKET_INSERT_DEADLOCK')), 2_000)),
        ]),
        (error: unknown) => error === rollbackProbe,
      );
    },
  );

  const phaseBLeaseEntered = deferred();
  const releasePhaseBLease = deferred();
  const phaseBLeasedOperation = withGate3ProofGrantAuthority(
    successorGrant.id,
    renewedGrantCredential!.credential,
    async () => {
      phaseBLeaseEntered.resolve();
      await releasePhaseBLease.promise;
      return 'phase-b-overlap-complete';
    },
  );
  await phaseBLeaseEntered.promise;
  let phaseBReplaySettled = false;
  const phaseBReplay = registerAntigravityRuntime(bundle, freshPhaseA.challengeId).then((value) => {
    phaseBReplaySettled = true;
    return value;
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    phaseBReplaySettled,
    false,
    'Phase B replay must wait for the authority lease without deadlocking',
  );
  releasePhaseBLease.resolve();
  assert.equal(await phaseBLeasedOperation, 'phase-b-overlap-complete');
  assert.equal((await phaseBReplay).status, 'replayed');
  assert.equal(phaseBReplaySettled, true);

  const runtimeAuthorityEntered = deferred();
  const releaseRuntimeAuthority = deferred();
  const runtimeLeasedOperation = withGate3ProofGrantAuthority(
    successorGrant.id,
    renewedGrantCredential!.credential,
    async () => {
      runtimeAuthorityEntered.resolve();
      await releaseRuntimeAuthority.promise;
      return 'runtime-revocation-overlap-complete';
    },
  );
  await runtimeAuthorityEntered.promise;
  let runtimeRevocationSettled = false;
  const runtimeRevocation = revokeRuntimeCredentials(
    operatorRuntimeId,
    'luca-gemini',
  ).then((result) => {
    runtimeRevocationSettled = true;
    return result;
  });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    runtimeRevocationSettled,
    false,
    'multi-row runtime revocation must wait for the authority lease without deadlocking',
  );
  releaseRuntimeAuthority.resolve();
  assert.equal(await runtimeLeasedOperation, 'runtime-revocation-overlap-complete');
  assert.equal(await runtimeRevocation, true);
  assert.equal(runtimeRevocationSettled, true);
  await assert.rejects(
    () => validateGate3ProofGrant(successorGrant.id, renewedGrantCredential!.credential),
    /GATE3_PROOF_GRANT_INVALID/,
  );
  // Restore only this disposable fixture so the remaining negative cases
  // continue to exercise challenge/receipt validation rather than short-circuit
  // on the runtime revocation proven above.
  await getSharedDb().update(coordinationRuntimeRegistrations)
    .set({ enabled: true, revokedAt: null, updatedAt: new Date() })
    .where(eq(coordinationRuntimeRegistrations.id, operatorRuntimeId));
  await getSharedDb().update(coordinationRuntimeCredentials)
    .set({ revokedAt: null })
    .where(eq(coordinationRuntimeCredentials.id, renewedGrantCredential!.credential.credentialId));
  assert.equal(
    (await validateGate3ProofGrant(successorGrant.id, renewedGrantCredential!.credential)).grantId,
    successorGrant.id,
  );

  await revokeReceipt(registered.receiptId, 'founder-grant-test', 'grant lifecycle test');
  await assert.rejects(
    () => validateGate3ProofGrant(successorGrant.id, renewedGrantCredential!.credential),
    /GATE3_PROOF_GRANT_INVALID/,
  );
  await assert.rejects(
    () => validateGate3ProofGrantForVerifier(successorGrant.id),
    /GATE3_PROOF_GRANT_INVALID/,
  );

  const makeChallenge = async (suffix: string) => {
    const { bundleDigest: _bundleDigest, ...unsigned } = bundle;
    const challengeBundle = createPublicProvisioningBundle({
      ...unsigned,
      artifactSha256: crypto.createHash('sha256').update(`${operatorTaskRef}-${suffix}`).digest('hex'),
    });
    const challenge = await submitAntigravityChallenge(challengeBundle, crypto.randomUUID());
    return challenge;
  };
  const rejected = await makeChallenge('rejected');
  await decideChallenge(rejected.challengeId, 'rejected', 'founder-operator-test');
  await assert.rejects(() => registerAntigravityRuntime(bundle, rejected.challengeId), /challenge_not_approved|receipt_mismatch/);
  const expired = await makeChallenge('expired');
  await decideChallenge(expired.challengeId, 'approved', 'founder-operator-test');
  await getSharedDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL session_replication_role = replica`);
    const expiredAt = new Date(Date.now() - 1);
    await tx.update(taskOwnershipChallenges)
      .set({ expiresAt: expiredAt })
      .where(eq(taskOwnershipChallenges.id, expired.challengeId));
    await tx.update(taskOwnershipReceipts)
      .set({ expiresAt: expiredAt })
      .where(eq(taskOwnershipReceipts.challengeId, expired.challengeId));
  });
  await assert.rejects(() => registerAntigravityRuntime(bundle, expired.challengeId), /challenge_expired/);
  const revoked = await makeChallenge('revoked');
  const revokedReceipt = await decideChallenge(revoked.challengeId, 'approved', 'founder-operator-test');
  assert.ok('id' in revokedReceipt);
  await revokeReceipt(revokedReceipt.id, 'founder-operator-test');
  await assert.rejects(() => registerAntigravityRuntime(bundle, revoked.challengeId), /receipt_mismatch/);
  assert.equal((await getSharedDb().select().from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, operatorRuntimeId))).length, 1);

  // A fresh bootstrap is a fresh generation, not same-runtime recovery.
  const oldRegistration = await getSharedDb().select().from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, operatorRuntimeId));
  const oldProfile = await getSharedDb().select().from(coordinationRuntimeProfiles)
    .where(eq(coordinationRuntimeProfiles.runtimeRegistrationId, operatorRuntimeId));
  const secondSecret = `second-generation-${crypto.randomBytes(24).toString('hex')}`;
  const { bundleDigest: _originalBundleDigest, ...generationBase } = bundle;
  const secondBundle = createPublicProvisioningBundle({
    ...generationBase,
    bootstrapSha256: hashCoordinationSecret(secondSecret),
  });
  assert.notEqual(secondBundle.runtimeId, bundle.runtimeId);
  const secondPhaseA = await submitAntigravityChallenge(secondBundle, crypto.randomUUID());
  const secondReceipt = await decideChallenge(
    secondPhaseA.challengeId, 'approved', 'founder-second-generation-test',
  );
  assert.ok('id' in secondReceipt);
  const second = await registerAntigravityRuntime(secondBundle, secondPhaseA.challengeId);
  assert.equal(second.status, 'created');
  assert.notEqual(second.runtimeId, registered.runtimeId);
  assert.notEqual(second.profileId, registered.profileId);
  assert.deepEqual(
    await getSharedDb().select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, operatorRuntimeId)),
    oldRegistration,
  );
  assert.deepEqual(
    await getSharedDb().select().from(coordinationRuntimeProfiles)
      .where(eq(coordinationRuntimeProfiles.runtimeRegistrationId, operatorRuntimeId)),
    oldProfile,
  );
  const generationAudits = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.eventType, 'runtime_generation_provisioned'));
  assert.equal(generationAudits.length >= 2, true);
  assert.equal(generationAudits.some((row) => {
    const metadata = row.metadata as Record<string, unknown>;
    return metadata.runtimeId === second.runtimeId
      && metadata.profileId === second.profileId
      && metadata.challengeId === secondPhaseA.challengeId
      && metadata.receiptId === secondReceipt.id
      && metadata.bundleDigest === secondBundle.bundleDigest
      && metadata.registrationOutcome === 'created';
  }), true);
  assert.equal(JSON.stringify(generationAudits).includes(secondSecret), false);
  // The exact approved challenge is idempotent before bootstrap consumption.
  assert.equal(
    (await registerAntigravityRuntime(secondBundle, secondPhaseA.challengeId)).status,
    'replayed',
  );
  const secondExchanged = await exchangeBootstrapCredential(second.runtimeId, secondSecret);
  assert.ok(secondExchanged);
  const secondCredential = await resolveBrokerCredential(secondExchanged!.accessToken);
  assert.ok(secondCredential);
  await assert.rejects(
    () => validateGate3ProofGrant(grant.id, secondCredential!.credential),
    /GATE3_PROOF_GRANT_INVALID/,
  );
  assert.equal(
    (await registerAntigravityRuntime(secondBundle, secondPhaseA.challengeId)).status,
    'replayed',
  );
  await assert.rejects(
    () => registerAntigravityRuntime(
      createPublicProvisioningBundle({
        ...generationBase,
        bootstrapSha256: hashCoordinationSecret(`third-generation-${Date.now()}`),
      }),
      secondPhaseA.challengeId,
    ),
    /challenge_not_approved|receipt_mismatch/,
  );
});

databaseTest('broker issues, rotates, expires from use, revokes, and audits without plaintext storage', async () => {
  const { bootstrapToken } = await registerCoordinationRuntime({
    runtimeId,
    actor: 'luca-replit',
    displayName: 'Credential broker CI runtime',
    capabilities: ['coordination:read', 'coordination:credential:renew', 'coordination:credential:revoke'],
    tokenTtlSeconds: 60,
  });
  await assert.rejects(
    () => registerCoordinationRuntime({
      runtimeId,
      actor: 'luca-claude-code',
      displayName: 'Attempted actor rebind',
      capabilities: ['coordination:read'],
    }),
  );

  assert.equal(await exchangeBootstrapCredential(runtimeId, 'wrong-bootstrap'), null);
  const issued = await exchangeBootstrapCredential(runtimeId, bootstrapToken);
  assert.ok(issued);
  assert.equal(issued.credential.actor, 'luca-replit');
  assert.deepEqual(issued.credential.capabilities, [
    'coordination:read',
    'coordination:credential:renew',
    'coordination:credential:revoke',
  ]);

  const [registration] = await getSharedDb().select().from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, runtimeId));
  assert.notEqual(registration.bootstrapHash, bootstrapToken);

  const [storedCredential] = await getSharedDb().select().from(coordinationRuntimeCredentials)
    .where(eq(coordinationRuntimeCredentials.id, issued.credential.credentialId));
  assert.notEqual(storedCredential.tokenHash, issued.accessToken);
  assert.equal(JSON.stringify(storedCredential).includes(issued.accessToken), false);

  const resolved = await resolveBrokerCredential(issued.accessToken);
  assert.equal(resolved?.runtimeId, runtimeId);

  const renewalAttempts = await Promise.all([
    renewBrokerCredential(issued.credential),
    renewBrokerCredential(issued.credential),
  ]);
  const successfulRenewals = renewalAttempts.filter((value) => value !== null);
  assert.equal(successfulRenewals.length, 1, 'concurrent renewal must mint exactly one successor');
  const renewed = successfulRenewals[0]!;
  assert.notEqual(renewed.accessToken, issued.accessToken);
  assert.equal(await resolveBrokerCredential(issued.accessToken), null);
  assert.equal((await resolveBrokerCredential(renewed.accessToken))?.actor, 'luca-replit');

  await revokeBrokerCredential(renewed.credential);
  assert.equal(await resolveBrokerCredential(renewed.accessToken), null);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, runtimeId));
  assert.equal(auditEvents.some((event) => event.eventType === 'issued' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'renewed' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'revoked' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'exchange_failed' && !event.success), true);
});

const verifiedDisposableDatabaseTest = getVerifiedCiDatabaseUrl() ? test : test.skip;

verifiedDisposableDatabaseTest(
  'runtime revocation cannot leave an issued credential usable after an overlapping bootstrap exchange',
  async () => {
    const { bootstrapToken } = await registerCoordinationRuntime({
      runtimeId: revocationRaceRuntimeId,
      actor: 'luca-replit',
      displayName: 'Credential broker revocation race CI runtime',
      capabilities: ['coordination:read'],
      tokenTtlSeconds: 60,
    });
    const exchangePaused = deferred();
    const releaseExchange = deferred();

    const exchangePromise = exchangeBootstrapCredential(
      revocationRaceRuntimeId,
      bootstrapToken,
      undefined,
      {
        afterRegistrationLocked: async () => {
          exchangePaused.resolve();
          await releaseExchange.promise;
        },
      },
    );
    await exchangePaused.promise;

    const revocationPromise = revokeRuntimeCredentials(
      revocationRaceRuntimeId,
      'luca-replit',
    );
    const revocationFinishedBeforeRelease = await Promise.race([
      revocationPromise.then(() => true),
      new Promise<false>((resolve) => {
        setTimeout(() => resolve(false), 1_000);
      }),
    ]);
    releaseExchange.resolve();
    const [issued, revoked] = await Promise.all([exchangePromise, revocationPromise]);
    assert.equal(
      revocationFinishedBeforeRelease,
      false,
      'runtime revocation must wait while bootstrap exchange holds the registration lock',
    );

    assert.ok(issued, 'the lock-winning exchange should return its credential before revocation commits');
    assert.equal(revoked, true);

    const [registration] = await getSharedDb().select().from(coordinationRuntimeRegistrations)
      .where(eq(coordinationRuntimeRegistrations.id, revocationRaceRuntimeId));
    assert.equal(registration.enabled, false);
    assert.ok(registration.revokedAt);
    await getSharedDb().update(coordinationRuntimeCredentials)
      .set({ revokedAt: null })
      .where(eq(coordinationRuntimeCredentials.id, issued.credential.credentialId));
    assert.equal(
      await resolveBrokerCredential(issued.accessToken),
      null,
      'a credential returned by the overlapping exchange must not authenticate through a revoked registration',
    );

    const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
      .where(eq(coordinationCredentialAuditEvents.runtimeId, revocationRaceRuntimeId));
    assert.equal(
      auditEvents.some((event) => event.eventType === 'runtime_revoked' && event.success),
      true,
      'runtime revocation must be audited',
    );
    assert.equal(
      auditEvents.some((event) => (
        event.eventType === 'access_failed'
        && !event.success
        && event.reason === 'revoked'
        && event.credentialId === issued.credential.credentialId
      )),
      true,
      'denied use of the returned credential must be audited as revoked',
    );
  },
);