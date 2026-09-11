import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { sql } from 'drizzle-orm';
import { closeDbConnections, getSharedDb } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  Gate3AssignmentWindowError,
  createGate3AssignmentWindow,
  readGate3AssignmentBundle,
} from '../services/coordination-gate3-assignment-window-service';
import { submitAntigravityChallenge, registerAntigravityRuntime } from './provision-antigravity-runtime';
import { decideChallenge } from '../services/founder-task-ownership-service';
import { GATE3, createPublicProvisioningBundle } from '../services/antigravity-provisioning-bundle';
import {
  coordinationCredentialAuditEvents, coordinationEvents, coordinationInboxItems,
  coordinationRuntimeInboxWindowItems, coordinationRuntimeInboxWindows,
  coordinationThreads, coordinationRuntimeRegistrations, coordinationRuntimeProfiles,
  coordinationInboxActivation,
} from '@shared/schema';
import { digestCanonical } from '../services/coordination-runtime';

// Never use the shared Neon database, even when a branch identifier is present.
const disposableUrl = getVerifiedCiDatabaseUrl();
const databaseTest = disposableUrl ? test : test.skip;
let completedFixture: { bundle: ReturnType<typeof bundle>; receiptId: string } | undefined;
const FIXED_PROFILE_ID = 'antigravity-21cbe9f7cf3e13028d9be66720c6dc2cb30e6cf83e92b2b739963a4bdbba14a9';

after(async () => { if (disposableUrl) await closeDbConnections(); });

function bundle() {
  const pair = crypto.generateKeyPairSync('ed25519');
  const der = pair.publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
  return createPublicProvisioningBundle({
    ...GATE3,
    credentialCapabilities: [...GATE3.credentialCapabilities],
    runtimeCapabilities: [...GATE3.runtimeCapabilities],
    artifactSha256: 'a'.repeat(64),
    publicKey: der.toString('base64url'),
    keyFingerprint: crypto.createHash('sha256').update(der).digest('hex'),
    bootstrapSha256: 'b'.repeat(64),
    worktreeRealpathDigest: 'c'.repeat(64),
    startingCommit: 'd'.repeat(40),
  });
}

async function auditCount() {
  const [row] = await getSharedDb().select({ count: sql<number>`count(*)::int` })
    .from(coordinationCredentialAuditEvents);
  return row.count;
}

databaseTest('malformed attempt and bundle reject with zero audit writes', async () => {
  const before = await auditCount();
  await assert.rejects(
    () => createGate3AssignmentWindow({ bundle: bundle(), receiptId: 'r', assignmentAttemptId: 'NOT-A-UUID' }),
    (e: unknown) => e instanceof Gate3AssignmentWindowError && e.code === 'attempt_id_invalid',
  );
  await assert.rejects(
    () => createGate3AssignmentWindow({
      bundle: { ...bundle(), bundleDigest: '0'.repeat(64) },
      receiptId: 'r', assignmentAttemptId: crypto.randomUUID(),
    }),
    (e: unknown) => e instanceof Gate3AssignmentWindowError && e.code === 'invalid_bundle',
  );
  assert.equal(await auditCount(), before);
});

databaseTest('oversized bundle is rejected before database writes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gate3-assignment-'));
  const path = join(dir, 'bundle.json');
  try {
    await writeFile(path, Buffer.alloc(1024 * 1024 + 1, 0x20));
    await assert.rejects(() => readGate3AssignmentBundle(path), /gate3_assignment_window_bundle_too_large/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

databaseTest('creates and exactly binds the complete canonical assignment projection', async () => {
  const b = bundle();
  const phaseA = await submitAntigravityChallenge(b, crypto.randomUUID());
  const receipt = await decideChallenge(phaseA.challengeId, 'approved', 'gate3-assignment-test');
  assert.ok('id' in receipt);
  const registered = await registerAntigravityRuntime(b, phaseA.challengeId);
  assert.equal(registered.status, 'created');
  await getSharedDb().transaction(async (tx) => {
    await tx.update(coordinationRuntimeProfiles).set({ id: FIXED_PROFILE_ID })
      .where(sql`${coordinationRuntimeProfiles.id} = ${registered.profileId}`);
    await tx.update(coordinationRuntimeRegistrations).set({ bootstrapHash: b.bootstrapSha256 })
      .where(sql`${coordinationRuntimeRegistrations.id} = ${GATE3.runtimeId}`);
    await tx.insert(coordinationInboxActivation).values({
      id: `gate3-test-${b.bundleDigest.slice(0, 16)}`, schemaVersion: 1,
      recipientRuleVersion: 1, state: 'active', backfillCutoffGlobalSequence: 0,
      completionEvidence: {}, activatedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
    await tx.insert(coordinationCredentialAuditEvents).values({
      eventType: 'runtime_bootstrap_recovered', success: true, runtimeId: GATE3.runtimeId,
      actor: GATE3.actor, reason: 'consumed_bootstrap_recovery',
      metadata: {
        oldBootstrapSha256: 'e'.repeat(64), newBootstrapSha256: b.bootstrapSha256,
        challengeId: phaseA.challengeId, receiptId: receipt.id, bundleDigest: b.bundleDigest,
        recoveryLineage: 'audited_consumption',
      },
    });
  });
  const attempt = crypto.randomUUID();
  const result = await createGate3AssignmentWindow({
    bundle: b, receiptId: receipt.id, assignmentAttemptId: attempt,
  });
  const [thread] = await getSharedDb().select().from(coordinationThreads).where(
    sql`${coordinationThreads.id} = ${result.threadId}`,
  );
  const [event] = await getSharedDb().select().from(coordinationEvents).where(
    sql`${coordinationEvents.id} = ${result.assignmentEventId}`,
  );
  const items = await getSharedDb().select().from(coordinationRuntimeInboxWindowItems).where(
    sql`${coordinationRuntimeInboxWindowItems.itemId} = ${result.runtimeInboxItemId}`,
  );
  const [window] = await getSharedDb().select().from(coordinationRuntimeInboxWindows).where(
    sql`${coordinationRuntimeInboxWindows.id} = ${result.windowId}`,
  );
  const ordinary = await getSharedDb().select().from(coordinationInboxItems).where(
    sql`${coordinationInboxItems.coordinationEventId} = ${result.assignmentEventId}`,
  );
  assert.equal(thread.originActor, 'luca-replit');
  assert.equal(thread.intendedRecipient, GATE3.actor);
  assert.equal(thread.latestSequence, 1);
  assert.equal(event.threadId, thread.id);
  assert.equal(event.sequence, 1);
  assert.equal(event.idempotencyKey, `gate3-assignment:${b.bundleDigest}:${attempt}`);
  assert.deepEqual(event.payload, {
    kind: 'gate3_assignment', receiptId: receipt.id, artifactSha256: b.artifactSha256,
    bundleDigest: b.bundleDigest,
    content: { assignment: { author: 'luca-replit', taskId: '1448', expectedSequence: 1 } },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].windowId, result.windowId);
  assert.equal(items[0].eventId, event.id);
  assert.equal(items[0].threadId, thread.id);
  assert.equal(items[0].taskId, '1448');
  assert.equal(items[0].sequence, 1);
  assert.equal(items[0].itemDigest, digestCanonical({
    id: items[0].itemId, eventId: items[0].eventId, threadId: items[0].threadId,
    taskId: items[0].taskId, sequence: items[0].sequence, payload: items[0].payload,
  }));
  assert.equal(window.threadId, thread.id);
  assert.deepEqual(window.orderedItemIds, [result.runtimeInboxItemId]);
  assert.equal(window.afterExclusive, 0);
  assert.equal(window.throughInclusive, 1);
  assert.equal(ordinary.length, 1);
  assert.equal(ordinary[0].coordinationEventId, event.id);
  assert.equal(ordinary[0].coordinationThreadId, thread.id);
  assert.equal(ordinary[0].recipientActor, GATE3.actor);
  assert.equal(ordinary[0].senderActor, 'luca-replit');
  const [profile] = await getSharedDb().select().from(coordinationRuntimeProfiles)
    .where(sql`${coordinationRuntimeProfiles.id} = ${FIXED_PROFILE_ID}`);
  assert.equal(profile.runtimeRegistrationId, GATE3.runtimeId);
  const [audit] = await getSharedDb().select().from(coordinationCredentialAuditEvents).where(
    sql`${coordinationCredentialAuditEvents.eventType} = 'gate3_assignment_window_created' AND ${coordinationCredentialAuditEvents.runtimeId} = ${GATE3.runtimeId}`,
  );
  assert.deepEqual(Object.keys(audit.metadata).sort(), [
    'artifactSha256', 'assignmentAttemptId', 'assignmentEventId', 'boundaryDigest',
    'bundleDigest', 'receiptId', 'runtimeInboxItemId', 'threadId', 'windowId',
  ]);
  completedFixture = { bundle: b, receiptId: receipt.id };
});

databaseTest('write-boundary hooks roll back all rows', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId } = completedFixture;
  const before = await auditCount();
  for (const hook of [
    'afterCanonicalThreadCreated', 'afterRuntimeInboxItemCreated',
    'afterWindowFrozen', 'afterAuditCreated',
  ] as const) {
    await assert.rejects(() => createGate3AssignmentWindow({
      bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID(),
      testHooks: { [hook]: async () => { throw new Error(`forced_${hook}`); } },
    }));
  }
  assert.equal(await auditCount(), before);
});

databaseTest('exact replay and concurrent same-attempt calls perform no second writes', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId } = completedFixture;
  const [auditBefore] = await getSharedDb().select({ count: sql<number>`count(*)::int` })
    .from(coordinationCredentialAuditEvents);
  const prior = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(sql`${coordinationCredentialAuditEvents.eventType} = 'gate3_assignment_window_created'`);
  const metadata = prior.at(-1)!.metadata as Record<string, string>;
  const replay = await createGate3AssignmentWindow({
    bundle: b, receiptId, assignmentAttemptId: metadata.assignmentAttemptId,
  });
  assert.equal(replay.threadId, metadata.threadId);
  const concurrent = await Promise.all([
    createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: metadata.assignmentAttemptId }),
    createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: metadata.assignmentAttemptId }),
  ]);
  assert.deepEqual(concurrent[0], replay);
  assert.deepEqual(concurrent[1], replay);
  const [auditAfter] = await getSharedDb().select({ count: sql<number>`count(*)::int` })
    .from(coordinationCredentialAuditEvents);
  assert.equal(auditAfter.count, auditBefore.count);
});

databaseTest('CLI rejects unknown and duplicate arguments and exits', async () => {
  for (const args of [
    ['--unknown', 'x'],
    ['--bundle', 'x', '--bundle', 'y', '--receipt-id', 'r', '--attempt-id', crypto.randomUUID()],
  ]) {
    const result = spawnSync('npx', ['tsx', 'server/scripts/coordination-gate3-assignment-window.ts', ...args], {
      cwd: process.cwd(), encoding: 'utf8', env: process.env, timeout: 30_000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /gate3_assignment_window_usage/);
    assert.ok(!result.error || result.error.code !== 'ETIMEDOUT');
  }
});

databaseTest('CLI success emits only the public allowlist and exits', async () => {
  assert.ok(completedFixture);
  const dir = await mkdtemp(join(tmpdir(), 'gate3-assignment-cli-'));
  const path = join(dir, 'bundle.json');
  try {
    await writeFile(path, JSON.stringify(completedFixture.bundle));
    const [prior] = await getSharedDb().select().from(coordinationCredentialAuditEvents)
      .where(sql`${coordinationCredentialAuditEvents.eventType} = 'gate3_assignment_window_created'`)
      .orderBy(sql`${coordinationCredentialAuditEvents.createdAt} DESC`);
    const attemptId = (prior.metadata as Record<string, string>).assignmentAttemptId;
    const result = spawnSync('npx', [
      'tsx', 'server/scripts/coordination-gate3-assignment-window.ts',
      '--bundle', path, '--receipt-id', completedFixture.receiptId,
      '--attempt-id', attemptId,
    ], { cwd: process.cwd(), encoding: 'utf8', env: process.env, timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout.trim());
    assert.deepEqual(Object.keys(output).sort(), [
      'artifactDigest', 'assignmentAttemptId', 'assignmentEventId', 'boundaryDigest',
      'bundleDigest', 'expectedSequence', 'receiptId', 'runtimeInboxItemId', 'threadId', 'windowId',
    ]);
    assert.ok(!result.error || result.error.code !== 'ETIMEDOUT');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});