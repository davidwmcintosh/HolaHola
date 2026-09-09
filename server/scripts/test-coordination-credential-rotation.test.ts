import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { inArray } from 'drizzle-orm';
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
  resolveBrokerCredential,
  revokeRuntimeCredentials,
  rollbackCoordinationRuntimeReplacement,
  stageCoordinationRuntimeReplacement,
} from '../services/coordination-credential-broker';

const hasDisposableDatabase = Boolean(
  getVerifiedCiDatabaseUrl() || process.env.COORDINATION_INBOX_DISPOSABLE_BRANCH_ID,
);
const databaseTest = hasDisposableDatabase ? test : test.skip;
const runtimeIds = [
  `credential-rotation-source-${Date.now()}`,
  `credential-rotation-replacement-${Date.now()}`,
  `credential-rotation-rollback-${Date.now()}`,
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
  assert.equal(await revokeRuntimeCredentials(runtimeIds[2], 'luca-replit'), true);
  assert.deepEqual(
    await rollbackCoordinationRuntimeReplacement({
      sourceRuntimeId: runtimeIds[1],
      replacementRuntimeId: runtimeIds[2],
    }),
    { ok: true, actor: 'luca-replit' },
  );
  assert.equal(await resolveBrokerCredential(rollbackCredential.accessToken), null);
  assert.equal((await resolveBrokerCredential(replacementCredential.accessToken))?.runtimeId, runtimeIds[1]);

  const auditEvents = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(inArray(coordinationCredentialAuditEvents.runtimeId, runtimeIds));
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_started' && event.success), true);
  assert.equal(auditEvents.some((event) => event.reason === 'runtime_already_rotating' && !event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_completion_failed' && !event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_ready' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_ready_failed' && !event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_completed' && event.success), true);
  assert.equal(auditEvents.some((event) => event.eventType === 'rotation_rolled_back' && event.success), true);
  assert.equal(JSON.stringify(auditEvents).includes(staged.bootstrapToken), false);
  assert.equal(JSON.stringify(auditEvents).includes(rollbackStage.bootstrapToken), false);
});