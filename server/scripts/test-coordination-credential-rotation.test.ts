import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { and, eq, inArray } from 'drizzle-orm';
import {
  coordinationCredentialAuditEvents,
  coordinationRuntimeRegistrations,
  coordinationRuntimeRotations,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  completeCoordinationRuntimeReplacement,
  exchangeBootstrapCredential,
  markCoordinationRuntimeReplacementReady,
  registerCoordinationRuntime,
  reissueCoordinationRuntimeBootstrap,
  resolveBrokerCredential,
  revokeRuntimeCredentials,
  rollbackCoordinationRuntimeReplacement,
  setCoordinationCredentialBrokerConcurrencyTestHook,
  stageCoordinationRuntimeReplacement,
} from '../services/coordination-credential-broker';
import { formatRollbackOutcome } from './coordination-runtime-rotation';

const hasDisposableDatabase = Boolean(
  getVerifiedCiDatabaseUrl() || process.env.COORDINATION_INBOX_DISPOSABLE_BRANCH_ID,
);
const databaseTest = hasDisposableDatabase ? test : test.skip;

function createTwoPartySnapshotBarrier(expectedPoints: string[]) {
  let arrivals = 0;
  let release!: () => void;
  const bothArrived = new Promise<void>((resolve) => {
    release = resolve;
  });
  return async (point: string) => {
    assert.equal(expectedPoints.includes(point), true);
    arrivals += 1;
    if (arrivals === 2) release();
    await Promise.race([
      bothArrived,
      new Promise<void>((resolve) => setTimeout(resolve, 150)),
    ]);
  };
}

const runtimeIds = [
  `credential-rotation-source-${Date.now()}`,
  `credential-rotation-replacement-${Date.now()}`,
  `credential-rotation-rollback-${Date.now()}`,
  `credential-rotation-concurrent-source-${Date.now()}`,
  `credential-rotation-concurrent-replacement-a-${Date.now()}`,
  `credential-rotation-concurrent-replacement-b-${Date.now()}`,
  `credential-rotation-terminal-source-${Date.now()}`,
  `credential-rotation-terminal-replacement-${Date.now()}`,
  `credential-rotation-ready-rollback-source-${Date.now()}`,
  `credential-rotation-ready-rollback-replacement-${Date.now()}`,
  `credential-rotation-shared-replacement-source-a-${Date.now()}`,
  `credential-rotation-shared-replacement-source-b-${Date.now()}`,
  `credential-rotation-shared-replacement-${Date.now()}`,
  `credential-reissue-repeatable-${Date.now()}`,
  `credential-reissue-metadata-${Date.now()}`,
  `credential-reissue-revoked-source-${Date.now()}`,
  `credential-reissue-revoked-replacement-${Date.now()}`,
];

after(async () => {
  if (!hasDisposableDatabase) return;
  await getSharedDb().delete(coordinationRuntimeRotations)
    .where(inArray(coordinationRuntimeRotations.sourceRuntimeId, runtimeIds));
  await getSharedDb().delete(coordinationRuntimeRegistrations)
    .where(inArray(coordinationRuntimeRegistrations.id, runtimeIds));
  await getSharedDb().delete(coordinationCredentialAuditEvents)
    .where(inArray(coordinationCredentialAuditEvents.runtimeId, runtimeIds));
  await closeDbConnections();
});

databaseTest('runtime bootstrap rotation drains safely, completes only after use, and rolls back fail-closed', async () => {
  const source = await registerCoordinationRuntime({
    runtimeId: runtimeIds[0],
    actor: 'luca-replit',
    displayName: 'Credential rotation source',
    capabilities: ['coordination:read', 'coordination:credential:renew'],
    tokenTtlSeconds: 60,
  });
  const sourceCredential = await exchangeBootstrapCredential(runtimeIds[0], source.bootstrapToken);
  assert.ok(sourceCredential);

  const staged = await stageCoordinationRuntimeReplacement({
    sourceRuntimeId: runtimeIds[0],
    replacementRuntimeId: runtimeIds[1],
    replacementDisplayName: 'Credential rotation replacement',
  });
  assert.equal(staged.ok, true);
  if (!staged.ok) return;
  assert.equal(staged.actor, 'luca-replit');
  assert.deepEqual(staged.capabilities, ['coordination:read', 'coordination:credential:renew']);
  assert.equal(staged.tokenTtlSeconds, 60);
  assert.equal((await resolveBrokerCredential(sourceCredential.accessToken))?.runtimeId, runtimeIds[0]);
  assert.deepEqual(
    await stageCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[1],
      replacementRuntimeId: runtimeIds[2],
      replacementDisplayName: 'Forbidden nested replacement',
    }),
    { ok: false, reason: 'runtime_already_rotating' },
  );

  const replacementCredential = await exchangeBootstrapCredential(runtimeIds[1], staged.bootstrapToken);
  assert.ok(replacementCredential);
  assert.deepEqual(replacementCredential.credential.capabilities, sourceCredential.credential.capabilities);
  assert.deepEqual(
    await completeCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[0],
      replacementRuntimeId: runtimeIds[1],
    }),
    { ok: false, reason: 'replacement_not_ready' },
  );

  const replacementProof = await resolveBrokerCredential(replacementCredential.accessToken);
  assert.equal(replacementProof?.runtimeId, runtimeIds[1]);
  assert.ok(replacementProof);
  assert.equal((await markCoordinationRuntimeReplacementReady({
    sourceRuntimeId: runtimeIds[0],
    credential: sourceCredential.credential,
  })).ok, false, 'source credential cannot prove replacement readiness');
  assert.equal((await markCoordinationRuntimeReplacementReady({
    sourceRuntimeId: runtimeIds[0],
    credential: replacementProof,
  })).ok, true);
  assert.deepEqual(
    await completeCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[0],
      replacementRuntimeId: runtimeIds[1],
    }),
    { ok: true, actor: 'luca-replit' },
  );
  assert.equal(await exchangeBootstrapCredential(runtimeIds[0], source.bootstrapToken), null);
  assert.equal(await resolveBrokerCredential(sourceCredential.accessToken), null);
  assert.equal((await resolveBrokerCredential(replacementCredential.accessToken))?.runtimeId, runtimeIds[1]);

  const rollbackStage = await stageCoordinationRuntimeReplacement({
    sourceRuntimeId: runtimeIds[1],
    replacementRuntimeId: runtimeIds[2],
    replacementDisplayName: 'Credential rotation rollback candidate',
  });
  assert.equal(rollbackStage.ok, true);
  if (!rollbackStage.ok) return;
  const rollbackCredential = await exchangeBootstrapCredential(runtimeIds[2], rollbackStage.bootstrapToken);
  assert.ok(rollbackCredential);
  const rollbackProof = await resolveBrokerCredential(rollbackCredential.accessToken);
  assert.equal(rollbackProof?.runtimeId, runtimeIds[2]);
  assert.equal(await revokeRuntimeCredentials(runtimeIds[1], 'luca-replit'), true);
  assert.deepEqual(
    await rollbackCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[1],
      replacementRuntimeId: runtimeIds[2],
    }),
    { ok: true, actor: 'luca-replit', sourceActive: false },
  );
  assert.equal(await resolveBrokerCredential(rollbackCredential.accessToken), null);
  assert.equal(await resolveBrokerCredential(replacementCredential.accessToken), null);
  const degradedRollbackMessage = formatRollbackOutcome({
    actor: 'luca-replit',
    sourceRuntimeId: runtimeIds[1],
    replacementRuntimeId: runtimeIds[2],
    sourceActive: false,
  });
  assert.match(degradedRollbackMessage, /was not re-enabled/);
  assert.match(degradedRollbackMessage, /no runtime in this pair remains active/);
  assert.doesNotMatch(degradedRollbackMessage, /source.*remains active/i);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(inArray(coordinationCredentialAuditEvents.runtimeId, runtimeIds));
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_started' && event.success), true);
  assert.equal(auditEvents.some((event) => event.reason === 'runtime_already_rotating' && !event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_completion_failed' && !event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_ready' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_ready_failed' && !event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_completed' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_rolled_back' && event.success), true);
  assert.equal(
    auditEvents.some(
      (event) => event.eventType === 'rotation_rolled_back'
        && event.success
        && event.metadata?.sourceActive === false,
    ),
    true,
  );
  assert.equal(JSON.stringify(auditEvents).includes(staged.bootstrapToken), false);
  assert.equal(JSON.stringify(auditEvents).includes(rollbackStage.bootstrapToken), false);
});

databaseTest('concurrent stages sharing a runtime create exactly one active rotation and audit the loser', async () => {
  await registerCoordinationRuntime({
    runtimeId: runtimeIds[3],
    actor: 'luca-replit',
    displayName: 'Concurrent rotation source',
    capabilities: ['coordination:read', 'coordination:credential:renew'],
    tokenTtlSeconds: 60,
  });

  setCoordinationCredentialBrokerConcurrencyTestHook(
    createTwoPartySnapshotBarrier(['stage_snapshot_read']),
  );
  const attempts = await Promise.all([
    stageCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[3],
      replacementRuntimeId: runtimeIds[4],
      replacementDisplayName: 'Concurrent replacement A',
    }),
    stageCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[3],
      replacementRuntimeId: runtimeIds[5],
      replacementDisplayName: 'Concurrent replacement B',
    }),
  ]).finally(() => {
    setCoordinationCredentialBrokerConcurrencyTestHook(undefined);
  });

  assert.equal(attempts.filter((attempt) => attempt.ok).length, 1);
  assert.equal(attempts.filter((attempt) => !attempt.ok).length, 1);
  assert.equal(attempts.find((attempt) => !attempt.ok)?.reason, 'runtime_already_rotating');

  const activeRotations = await getSharedDb().select().from(coordinationRuntimeRotations)
    .where(and(
      eq(coordinationRuntimeRotations.sourceRuntimeId, runtimeIds[3]),
      inArray(coordinationRuntimeRotations.state, ['staged', 'ready']),
    ));
  assert.equal(activeRotations.length, 1);

  const winningReplacementId = activeRotations[0].replacementRuntimeId;
  assert.equal([runtimeIds[4], runtimeIds[5]].includes(winningReplacementId), true);
  const losingReplacementId = winningReplacementId === runtimeIds[4] ? runtimeIds[5] : runtimeIds[4];
  const [losingRegistration] = await getSharedDb().select().from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, losingReplacementId));
  assert.equal(losingRegistration, undefined);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, runtimeIds[3]));
  assert.equal(auditEvents.filter((event) => event.eventType === 'rotation_started' && event.success).length, 1);
  assert.equal(auditEvents.filter((event) =>
    event.eventType === 'rotation_failed'
    && !event.success
    && event.reason === 'runtime_already_rotating'
  ).length, 1);

  assert.deepEqual(
    await rollbackCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[3],
      replacementRuntimeId: winningReplacementId,
    }),
    { ok: true, actor: 'luca-replit', sourceActive: true },
  );
  const remainingActiveRotations = await getSharedDb().select().from(coordinationRuntimeRotations)
    .where(and(
      eq(coordinationRuntimeRotations.sourceRuntimeId, runtimeIds[3]),
      inArray(coordinationRuntimeRotations.state, ['staged', 'ready']),
    ));
  assert.equal(remainingActiveRotations.length, 0);
});

databaseTest('concurrent complete and rollback attempts produce one terminal outcome and audit the loser', async () => {
  await registerCoordinationRuntime({
    runtimeId: runtimeIds[6],
    actor: 'luca-replit',
    displayName: 'Concurrent terminal source',
    capabilities: ['coordination:read', 'coordination:credential:renew'],
    tokenTtlSeconds: 60,
  });
  const staged = await stageCoordinationRuntimeReplacement({
    sourceRuntimeId: runtimeIds[6],
    replacementRuntimeId: runtimeIds[7],
    replacementDisplayName: 'Concurrent terminal replacement',
  });
  assert.equal(staged.ok, true);
  if (!staged.ok) return;

  const issued = await exchangeBootstrapCredential(runtimeIds[7], staged.bootstrapToken);
  assert.ok(issued);
  const proof = await resolveBrokerCredential(issued.accessToken);
  assert.ok(proof);
  assert.equal((await markCoordinationRuntimeReplacementReady({
    sourceRuntimeId: runtimeIds[6],
    credential: proof,
  })).ok, true);

  setCoordinationCredentialBrokerConcurrencyTestHook(
    createTwoPartySnapshotBarrier(['complete_snapshot_read', 'rollback_snapshot_read']),
  );
  const attempts = await Promise.all([
    completeCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[6],
      replacementRuntimeId: runtimeIds[7],
    }),
    rollbackCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[6],
      replacementRuntimeId: runtimeIds[7],
    }),
  ]).finally(() => {
    setCoordinationCredentialBrokerConcurrencyTestHook(undefined);
  });
  assert.equal(attempts.filter((attempt) => attempt.ok).length, 1);
  assert.equal(attempts.filter((attempt) => !attempt.ok).length, 1);

  const [rotation] = await getSharedDb().select().from(coordinationRuntimeRotations)
    .where(eq(coordinationRuntimeRotations.id, staged.rotationId));
  assert.ok(rotation);
  assert.equal(['completed', 'rolled_back'].includes(rotation.state), true);
  assert.equal(rotation.state === 'completed', rotation.completedAt !== null);
  assert.equal(rotation.state === 'rolled_back', rotation.rolledBackAt !== null);

  const activeRotations = await getSharedDb().select().from(coordinationRuntimeRotations)
    .where(and(
      eq(coordinationRuntimeRotations.sourceRuntimeId, runtimeIds[6]),
      inArray(coordinationRuntimeRotations.state, ['staged', 'ready']),
    ));
  assert.equal(activeRotations.length, 0);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, runtimeIds[6]));
  const terminalSuccesses = auditEvents.filter((event) =>
    event.success && ['rotation_completed', 'rotation_rolled_back'].includes(event.eventType)
  );
  const terminalFailures = auditEvents.filter((event) =>
    !event.success && ['rotation_completion_failed', 'rotation_rollback_failed'].includes(event.eventType)
  );
  assert.equal(terminalSuccesses.length, 1);
  assert.equal(terminalFailures.length, 1);
});

databaseTest('rollback wins a race with replacement readiness and stale readiness is audited', async () => {
  await registerCoordinationRuntime({
    runtimeId: runtimeIds[8],
    actor: 'luca-replit',
    displayName: 'Readiness rollback race source',
    capabilities: ['coordination:read', 'coordination:credential:renew'],
    tokenTtlSeconds: 60,
  });
  const staged = await stageCoordinationRuntimeReplacement({
    sourceRuntimeId: runtimeIds[8],
    replacementRuntimeId: runtimeIds[9],
    replacementDisplayName: 'Readiness rollback race replacement',
  });
  assert.equal(staged.ok, true);
  if (!staged.ok) return;

  const issued = await exchangeBootstrapCredential(runtimeIds[9], staged.bootstrapToken);
  assert.ok(issued);
  const proof = await resolveBrokerCredential(issued.accessToken);
  assert.ok(proof);

  let readinessArrived!: () => void;
  const readinessIsWaiting = new Promise<void>((resolve) => {
    readinessArrived = resolve;
  });
  let releaseReadiness!: () => void;
  const readinessMayContinue = new Promise<void>((resolve) => {
    releaseReadiness = resolve;
  });
  setCoordinationCredentialBrokerConcurrencyTestHook(async (point) => {
    if (point !== 'ready_before_lock') return;
    readinessArrived();
    await readinessMayContinue;
  });

  const readinessAttempt = markCoordinationRuntimeReplacementReady({
    sourceRuntimeId: runtimeIds[8],
    credential: proof,
  });
  await readinessIsWaiting;
  const rollbackAttempt = await rollbackCoordinationRuntimeReplacement({
    sourceRuntimeId: runtimeIds[8],
    replacementRuntimeId: runtimeIds[9],
  });
  releaseReadiness();
  const readinessResult = await readinessAttempt.finally(() => {
    setCoordinationCredentialBrokerConcurrencyTestHook(undefined);
  });

  assert.deepEqual(rollbackAttempt, { ok: true, actor: 'luca-replit', sourceActive: true });
  assert.deepEqual(readinessResult, { ok: false, reason: 'rotation_not_staged' });
  assert.equal([rollbackAttempt, readinessResult].filter((attempt) => attempt.ok).length, 1);

  assert.equal(await resolveBrokerCredential(issued.accessToken), null);
  assert.equal(await exchangeBootstrapCredential(runtimeIds[9], staged.bootstrapToken), null);

  const [rotation] = await getSharedDb().select().from(coordinationRuntimeRotations)
    .where(eq(coordinationRuntimeRotations.id, staged.rotationId));
  assert.ok(rotation);
  assert.equal(rotation.state, 'rolled_back');
  assert.ok(rotation.rolledBackAt);
  assert.equal(rotation.readyAt, null);
  assert.equal(rotation.readyCredentialId, null);

  const activeRotations = await getSharedDb().select().from(coordinationRuntimeRotations)
    .where(and(
      eq(coordinationRuntimeRotations.sourceRuntimeId, runtimeIds[8]),
      inArray(coordinationRuntimeRotations.state, ['staged', 'ready']),
    ));
  assert.equal(activeRotations.length, 0);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, runtimeIds[8]));
  assert.equal(auditEvents.filter((event) =>
    event.eventType === 'rotation_rolled_back' && event.success
  ).length, 1);
  assert.equal(auditEvents.filter((event) =>
    event.eventType === 'rotation_ready_failed'
    && !event.success
    && event.reason === 'rotation_not_staged'
  ).length, 1);
  assert.equal(auditEvents.filter((event) =>
    event.eventType === 'rotation_ready' && event.success
  ).length, 0);
});

databaseTest('concurrent sources claiming one replacement return one audited loser without a transaction error', async () => {
  await Promise.all([
    registerCoordinationRuntime({
      runtimeId: runtimeIds[10],
      actor: 'luca-replit',
      displayName: 'Shared replacement source A',
      capabilities: ['coordination:read', 'coordination:credential:renew'],
      tokenTtlSeconds: 60,
    }),
    registerCoordinationRuntime({
      runtimeId: runtimeIds[11],
      actor: 'luca-replit',
      displayName: 'Shared replacement source B',
      capabilities: ['coordination:read', 'coordination:credential:renew'],
      tokenTtlSeconds: 60,
    }),
  ]);

  setCoordinationCredentialBrokerConcurrencyTestHook(
    createTwoPartySnapshotBarrier(['stage_snapshot_read']),
  );
  const attempts = await Promise.all([
    stageCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[10],
      replacementRuntimeId: runtimeIds[12],
      replacementDisplayName: 'Shared replacement candidate',
    }),
    stageCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[11],
      replacementRuntimeId: runtimeIds[12],
      replacementDisplayName: 'Shared replacement candidate',
    }),
  ]).finally(() => {
    setCoordinationCredentialBrokerConcurrencyTestHook(undefined);
  });

  assert.equal(attempts.filter((attempt) => attempt.ok).length, 1);
  assert.equal(attempts.filter((attempt) => !attempt.ok).length, 1);
  assert.equal(attempts.find((attempt) => !attempt.ok)?.reason, 'replacement_runtime_exists');

  const activeRotations = await getSharedDb().select().from(coordinationRuntimeRotations)
    .where(and(
      eq(coordinationRuntimeRotations.replacementRuntimeId, runtimeIds[12]),
      inArray(coordinationRuntimeRotations.state, ['staged', 'ready']),
    ));
  assert.equal(activeRotations.length, 1);
  assert.equal([runtimeIds[10], runtimeIds[11]].includes(activeRotations[0].sourceRuntimeId), true);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(inArray(coordinationCredentialAuditEvents.runtimeId, [runtimeIds[10], runtimeIds[11]]));
  assert.equal(auditEvents.filter((event) => event.eventType === 'rotation_started' && event.success).length, 1);
  assert.equal(auditEvents.filter((event) =>
    event.eventType === 'rotation_failed'
    && !event.success
    && event.reason === 'replacement_runtime_exists'
  ).length, 1);

  assert.deepEqual(
    await rollbackCoordinationRuntimeReplacement({
      sourceRuntimeId: activeRotations[0].sourceRuntimeId,
      replacementRuntimeId: runtimeIds[12],
    }),
    { ok: true, actor: 'luca-replit', sourceActive: true },
  );
});

databaseTest('in-place bootstrap reissue is repeatable, kills only prior bootstraps, and never touches issued credentials', async () => {
  const runtimeId = runtimeIds[13];
  const source = await registerCoordinationRuntime({
    runtimeId,
    actor: 'luca-claude-code',
    displayName: 'Reissue repeatable runtime',
    capabilities: ['coordination:read', 'coordination:credential:renew'],
    tokenTtlSeconds: 60,
  });
  const firstCredential = await exchangeBootstrapCredential(runtimeId, source.bootstrapToken);
  assert.ok(firstCredential);

  const firstReissue = await reissueCoordinationRuntimeBootstrap(runtimeId);
  assert.equal(firstReissue.ok, true);
  if (!firstReissue.ok) return;
  assert.equal(firstReissue.actor, 'luca-claude-code');
  assert.notEqual(firstReissue.bootstrapToken, source.bootstrapToken);

  // The original bootstrap was already consumed and stays dead after reissue.
  assert.equal(await exchangeBootstrapCredential(runtimeId, source.bootstrapToken), null);
  // The freshly reissued bootstrap works.
  const secondCredential = await exchangeBootstrapCredential(runtimeId, firstReissue.bootstrapToken);
  assert.ok(secondCredential);
  // Reissue never touched the credential issued before it ran.
  assert.equal((await resolveBrokerCredential(firstCredential.accessToken))?.runtimeId, runtimeId);

  // Reissue is repeatable: doing it again invalidates only the bootstrap, not
  // any credential issued so far.
  const secondReissue = await reissueCoordinationRuntimeBootstrap(runtimeId);
  assert.equal(secondReissue.ok, true);
  if (!secondReissue.ok) return;
  assert.notEqual(secondReissue.bootstrapToken, firstReissue.bootstrapToken);
  assert.equal(await exchangeBootstrapCredential(runtimeId, firstReissue.bootstrapToken), null);
  const thirdCredential = await exchangeBootstrapCredential(runtimeId, secondReissue.bootstrapToken);
  assert.ok(thirdCredential);
  assert.equal((await resolveBrokerCredential(firstCredential.accessToken))?.runtimeId, runtimeId);
  assert.equal((await resolveBrokerCredential(secondCredential.accessToken))?.runtimeId, runtimeId);
  assert.equal((await resolveBrokerCredential(thirdCredential.accessToken))?.runtimeId, runtimeId);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, runtimeId));
  assert.equal(auditEvents.filter((event) => event.eventType === 'bootstrap_reissued' && event.success).length, 2);
  assert.equal(JSON.stringify(auditEvents).includes(firstReissue.bootstrapToken), false);
  assert.equal(JSON.stringify(auditEvents).includes(secondReissue.bootstrapToken), false);
});

databaseTest('bootstrap reissue records whether a live credential existed, and fails closed for unknown or revoked runtimes', async () => {
  const runtimeId = runtimeIds[14];
  await registerCoordinationRuntime({
    runtimeId,
    actor: 'luca-claude-code',
    displayName: 'Reissue metadata runtime',
    capabilities: ['coordination:read', 'coordination:credential:renew'],
    tokenTtlSeconds: 60,
  });

  // No credential has ever been issued yet.
  const reissueWithoutCredential = await reissueCoordinationRuntimeBootstrap(runtimeId);
  assert.equal(reissueWithoutCredential.ok, true);
  if (!reissueWithoutCredential.ok) return;

  const credential = await exchangeBootstrapCredential(runtimeId, reissueWithoutCredential.bootstrapToken);
  assert.ok(credential);

  // A live, unexpired credential now exists at the moment of the next reissue.
  const reissueWithCredential = await reissueCoordinationRuntimeBootstrap(runtimeId);
  assert.equal(reissueWithCredential.ok, true);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, runtimeId));
  const reissuedEvents = auditEvents
    .filter((event) => event.eventType === 'bootstrap_reissued' && event.success)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  assert.equal(reissuedEvents.length, 2);
  assert.equal(reissuedEvents[0].metadata?.hadActiveCredentialAtReissue, false);
  assert.equal(reissuedEvents[1].metadata?.hadActiveCredentialAtReissue, true);

  assert.deepEqual(
    await reissueCoordinationRuntimeBootstrap('credential-reissue-never-registered'),
    { ok: false, reason: 'runtime_not_found' },
  );
  const notFoundEvent = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(and(
      eq(coordinationCredentialAuditEvents.runtimeId, 'credential-reissue-never-registered'),
      eq(coordinationCredentialAuditEvents.eventType, 'bootstrap_reissue_failed'),
    ));
  assert.equal(notFoundEvent.some((event) => !event.success && event.reason === 'runtime_not_found'), true);
  await getSharedDb().delete(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, 'credential-reissue-never-registered'));
});

databaseTest('bootstrap reissue refuses a revoked registration', async () => {
  const sourceRuntimeId = runtimeIds[15];
  const replacementRuntimeId = runtimeIds[16];
  await registerCoordinationRuntime({
    runtimeId: sourceRuntimeId,
    actor: 'luca-claude-code',
    displayName: 'Reissue revoked source',
    capabilities: ['coordination:read', 'coordination:credential:renew'],
    tokenTtlSeconds: 60,
  });
  const staged = await stageCoordinationRuntimeReplacement({
    sourceRuntimeId,
    replacementRuntimeId,
    replacementDisplayName: 'Reissue revoked replacement',
  });
  assert.equal(staged.ok, true);
  if (!staged.ok) return;
  const replacementCredential = await exchangeBootstrapCredential(replacementRuntimeId, staged.bootstrapToken);
  assert.ok(replacementCredential);
  const replacementProof = await resolveBrokerCredential(replacementCredential.accessToken);
  assert.ok(replacementProof);
  assert.equal((await markCoordinationRuntimeReplacementReady({
    sourceRuntimeId,
    credential: replacementProof,
  })).ok, true);
  assert.deepEqual(
    await completeCoordinationRuntimeReplacement({ sourceRuntimeId, replacementRuntimeId }),
    { ok: true, actor: 'luca-claude-code' },
  );

  assert.deepEqual(
    await reissueCoordinationRuntimeBootstrap(sourceRuntimeId),
    { ok: false, reason: 'runtime_disabled_or_revoked' },
  );

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.runtimeId, sourceRuntimeId));
  assert.equal(
    auditEvents.some((event) =>
      event.eventType === 'bootstrap_reissue_failed'
      && !event.success
      && event.reason === 'runtime_disabled_or_revoked'
    ),
    true,
  );
});
