import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { appendFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { and, eq, sql } from 'drizzle-orm';
import { closeDbConnections, getSharedDb } from '../db';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import {
  Gate3AssignmentWindowError,
  createGate3AssignmentWindow,
  readGate3AssignmentBundle,
} from '../services/coordination-gate3-assignment-window-service';
import { createCoordinationThread } from '../services/coordination-ledger-service';
import { submitAntigravityChallenge, registerAntigravityRuntime } from './provision-antigravity-runtime';
import { decideChallenge } from '../services/founder-task-ownership-service';
import { GATE3, createPublicProvisioningBundle } from '../services/antigravity-provisioning-bundle';
import {
  coordinationCredentialAuditEvents, coordinationEvents, coordinationInboxItems,
  coordinationRuntimeInboxWindowItems, coordinationRuntimeInboxWindows,
  coordinationThreads, coordinationRuntimeRegistrations, coordinationRuntimeProfiles,
  coordinationInboxActivation, coordinationRuntimeCredentials, coordinationGate3ProofGrants,
  coordinationRuntimePackets, taskOwnershipChallenges, taskOwnershipReceipts,
} from '@shared/schema';
import {
  CoordinationRuntimeService,
  digestCanonical,
  type RuntimePrincipal,
} from '../services/coordination-runtime';
import { PostgresCoordinationRuntimeRepository } from '../services/coordination-runtime-postgres-repository';
import {
  exchangeBootstrapCredential,
  hashCoordinationSecret,
} from '../services/coordination-credential-broker';

// Never use the shared Neon database, even when a branch identifier is present.
const disposableUrl = getVerifiedCiDatabaseUrl();
const databaseTest = disposableUrl ? test : test.skip;
let completedFixture: {
  bundle: ReturnType<typeof bundle>;
  receiptId: string;
  challengeId: string;
  attemptId: string;
  result: Awaited<ReturnType<typeof createGate3AssignmentWindow>>;
} | undefined;
const profileId = (bundle: { bundleDigest: string }) => `antigravity-${bundle.bundleDigest}`;
const taskArtifactTemplateText = readFileSync(new URL('../templates/task-1448.md', import.meta.url), 'utf8');
const TEST_STARTING_COMMIT = 'd'.repeat(40);
const STARTING_COMMIT_PLACEHOLDER = '__FINAL_STARTING_COMMIT__';

function materializeTaskArtifact(template: string, startingCommit: string) {
  const occurrences = template.split(STARTING_COMMIT_PLACEHOLDER).length - 1;
  assert.equal(occurrences, 1, 'test fixture must contain exactly one starting-commit placeholder');
  const text = template.replace(STARTING_COMMIT_PLACEHOLDER, startingCommit);
  const bytes = new TextEncoder().encode(text);
  return {
    text,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

const materializedTaskArtifact = materializeTaskArtifact(taskArtifactTemplateText, TEST_STARTING_COMMIT);

after(async () => { if (disposableUrl) await closeDbConnections(); });

function bundle(
  bootstrapSha256 = 'b'.repeat(64),
  artifactSha256 = materializedTaskArtifact.sha256,
  startingCommit = TEST_STARTING_COMMIT,
) {
  const pair = crypto.generateKeyPairSync('ed25519');
  const der = pair.publicKey.export({ format: 'der', type: 'spki' }) as Buffer;
  return createPublicProvisioningBundle({
    ...GATE3,
    credentialCapabilities: [...GATE3.credentialCapabilities],
    runtimeCapabilities: [...GATE3.runtimeCapabilities],
    artifactSha256: artifactSha256,
    publicKey: der.toString('base64url'),
    keyFingerprint: crypto.createHash('sha256').update(der).digest('hex'),
    bootstrapSha256,
    worktreeRealpathDigest: 'c'.repeat(64),
    startingCommit,
  });
}

async function auditCount() {
  const [row] = await getSharedDb().select({ count: sql<number>`count(*)::int` })
    .from(coordinationCredentialAuditEvents);
  return row.count;
}

async function authorityCounts() {
  const db = getSharedDb();
  const count = async (table: any) => {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(table);
    return row.count;
  };
  return {
    threads: await count(coordinationThreads),
    events: await count(coordinationEvents),
    ordinaryInbox: await count(coordinationInboxItems),
    runtimeItems: await count(coordinationRuntimeInboxWindowItems),
    windows: await count(coordinationRuntimeInboxWindows),
    audits: await count(coordinationCredentialAuditEvents),
  };
}

async function rejectsCode(
  operation: () => Promise<unknown>,
  code: string,
) {
  await assert.rejects(
    operation,
    (error: unknown) => error instanceof Gate3AssignmentWindowError && error.code === code,
  );
}

async function mutateDisposableFixture(operation: (tx: any) => Promise<void>) {
  await getSharedDb().transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL session_replication_role = replica`);
    await operation(tx);
  });
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
  const { bundleDigest: _digest, ...driftedBase } = bundle();
  const drifted = createPublicProvisioningBundle({
    ...driftedBase,
    artifactSha256: 'f'.repeat(64),
  });
  await assert.rejects(
    () => createGate3AssignmentWindow({
      bundle: drifted,
      receiptId: 'receipt-not-read',
      assignmentAttemptId: crypto.randomUUID(),
    }),
    (e: unknown) => e instanceof Gate3AssignmentWindowError && e.code === 'artifact_digest_mismatch',
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

databaseTest('creates exact projection for a fresh generation and preserves the prior generation', async () => {
  const initialBootstrapSecret = `gate3-initial-${crypto.randomBytes(24).toString('hex')}`;
  const initialBundle = bundle(hashCoordinationSecret(initialBootstrapSecret));
  const { bundleDigest: _initialDigest, ...generationBase } = initialBundle;
  const replacementBootstrapSecret = `gate3-second-${crypto.randomBytes(24).toString('hex')}`;
  const b = createPublicProvisioningBundle({
    ...generationBase,
    bootstrapSha256: hashCoordinationSecret(replacementBootstrapSecret),
  });
  const initialPhaseA = await submitAntigravityChallenge(initialBundle, crypto.randomUUID());
  const initialReceipt = await decideChallenge(
    initialPhaseA.challengeId,
    'approved',
    'gate3-assignment-initial-registration-test',
  );
  assert.ok('id' in initialReceipt);
  const registered = await registerAntigravityRuntime(initialBundle, initialPhaseA.challengeId);
  assert.equal(registered.status, 'created');
  await getSharedDb().transaction(async (tx) => {
    await tx.insert(coordinationInboxActivation).values({
      id: `gate3-test-${b.bundleDigest.slice(0, 16)}`, schemaVersion: 1,
      recipientRuleVersion: 1, state: 'active', backfillCutoffGlobalSequence: 0,
      completionEvidence: {}, activatedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
    });
  });
  const issued = await exchangeBootstrapCredential(initialBundle.runtimeId, initialBootstrapSecret);
  assert.ok(issued);
  await getSharedDb().update(coordinationRuntimeCredentials)
    .set({ revokedAt: new Date() })
    .where(eq(coordinationRuntimeCredentials.runtimeId, initialBundle.runtimeId));
  const oldRegistration = await getSharedDb().select().from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, registered.runtimeId));
  const oldProfile = await getSharedDb().select().from(coordinationRuntimeProfiles)
    .where(eq(coordinationRuntimeProfiles.id, registered.profileId));

  const generationPhaseA = await submitAntigravityChallenge(b, crypto.randomUUID());
  const generationReceipt = await decideChallenge(
    generationPhaseA.challengeId,
    'approved',
    'gate3-assignment-generation-test',
  );
  assert.ok('id' in generationReceipt);
  const second = await registerAntigravityRuntime(b, generationPhaseA.challengeId);
  assert.equal(second.status, 'created');
  assert.notEqual(second.runtimeId, registered.runtimeId);
  assert.notEqual(second.profileId, registered.profileId);
  assert.deepEqual(await getSharedDb().select().from(coordinationRuntimeRegistrations)
    .where(eq(coordinationRuntimeRegistrations.id, registered.runtimeId)), oldRegistration);
  assert.deepEqual(await getSharedDb().select().from(coordinationRuntimeProfiles)
    .where(eq(coordinationRuntimeProfiles.id, registered.profileId)), oldProfile);
  const replayed = await registerAntigravityRuntime(b, generationPhaseA.challengeId);
  assert.equal(replayed.status, 'replayed');
  const [generationAudit] = await getSharedDb().select().from(coordinationCredentialAuditEvents)
    .where(sql`${coordinationCredentialAuditEvents.eventType} = 'runtime_generation_provisioned'
      AND ${coordinationCredentialAuditEvents.runtimeId} = ${b.runtimeId}`);
  assert.deepEqual(generationAudit.metadata, {
    runtimeId: b.runtimeId, profileId: profileId(b),
    challengeId: generationPhaseA.challengeId, receiptId: generationReceipt.id,
    actor: b.actor, taskRef: b.taskRef, artifactSha256: b.artifactSha256,
    keyFingerprint: b.keyFingerprint, bundleDigest: b.bundleDigest,
    bootstrapSha256: b.bootstrapSha256, worktreeRealpathDigest: b.worktreeRealpathDigest,
    startingCommit: b.startingCommit, registrationOutcome: 'created',
  });
  const attempt = crypto.randomUUID();
  const result = await createGate3AssignmentWindow({
    bundle: b, receiptId: generationReceipt.id, assignmentAttemptId: attempt,
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
  assert.equal(thread.title, 'Gate 3 task 1448 assignment');
  assert.equal(thread.description, 'Approved Gate 3 assignment for task 1448.');
  assert.equal(thread.latestSequence, 1);
  assert.equal(event.threadId, thread.id);
  assert.equal(event.sequence, 1);
  assert.equal(event.idempotencyKey, `gate3-assignment:${b.bundleDigest}:${attempt}`);
  assert.deepEqual(event.payload, {
    kind: 'gate3_assignment', receiptId: generationReceipt.id, artifactSha256: b.artifactSha256,
    bundleDigest: b.bundleDigest,
    taskArtifact: materializedTaskArtifact,
    content: { assignment: { author: 'luca-replit', taskId: '1448', expectedSequence: 1 } },
  });
  assert.equal(items.length, 1);
  assert.equal(items[0].windowId, result.windowId);
  assert.equal(items[0].eventId, event.id);
  assert.equal(items[0].threadId, thread.id);
  assert.equal(items[0].taskId, '1448');
  assert.equal(items[0].sequence, 1);
  assert.deepEqual(items[0].payload, event.payload);
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
    .where(sql`${coordinationRuntimeProfiles.id} = ${profileId(b)}`);
  assert.equal(profile.runtimeRegistrationId, b.runtimeId);
  const [audit] = await getSharedDb().select().from(coordinationCredentialAuditEvents).where(
    sql`${coordinationCredentialAuditEvents.eventType} = 'gate3_assignment_window_created' AND ${coordinationCredentialAuditEvents.runtimeId} = ${b.runtimeId}`,
  );
  assert.deepEqual(Object.keys(audit.metadata).sort(), [
    'artifactSha256', 'assignmentAttemptId', 'assignmentEventId', 'boundaryDigest',
    'bundleDigest', 'receiptId', 'runtimeInboxItemId', 'threadId', 'windowId',
  ]);
  completedFixture = {
    bundle: b,
    receiptId: generationReceipt.id,
    challengeId: generationPhaseA.challengeId,
    attemptId: attempt,
    result,
  };
});

databaseTest('write-boundary hooks roll back all rows', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId } = completedFixture;
  const before = await authorityCounts();
  for (const hook of [
    'afterCanonicalThreadCreated', 'afterRuntimeInboxItemCreated',
    'afterWindowFrozen', 'afterAuditCreated',
  ] as const) {
    await assert.rejects(() => createGate3AssignmentWindow({
      bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID(),
      testHooks: { [hook]: async () => { throw new Error(`forced_${hook}`); } },
    }));
  }
  assert.deepEqual(await authorityCounts(), before);
});

databaseTest('incompatible canonical event winning the post-check race is never projected', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId } = completedFixture;
  const attemptId = crypto.randomUUID();
  const idempotencyKey = `gate3-assignment:${b.bundleDigest}:${attemptId}`;
  const before = await authorityCounts();
  await rejectsCode(
    () => createGate3AssignmentWindow({
      bundle: b,
      receiptId,
      assignmentAttemptId: attemptId,
      testHooks: {
        afterPartialEventChecked: async () => {
          await createCoordinationThread({
            actor: 'luca-replit',
            intendedRecipient: GATE3.actor,
            title: 'Incompatible Gate 3 assignment',
            description: 'This canonical event must never be projected.',
            content: 'Incompatible Gate 3 assignment.',
            priority: 'normal',
            payload: {
              kind: 'gate3_assignment',
              receiptId,
              artifactSha256: b.artifactSha256,
              bundleDigest: b.bundleDigest,
              content: {
                assignment: {
                  author: 'luca-claude-code',
                  taskId: GATE3.taskRef,
                  expectedSequence: 1,
                },
              },
            },
            idempotencyKey,
            createInboxDelivery: false,
          });
        },
      },
    }),
    'canonical_assignment_invalid',
  );
  const after = await authorityCounts();
  assert.equal(after.runtimeItems, before.runtimeItems);
  assert.equal(after.windows, before.windows);
  assert.equal(after.audits, before.audits);
});

databaseTest('concurrent new calls have one writer and one exact replay', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId } = completedFixture;
  const attemptId = crypto.randomUUID();
  const before = await authorityCounts();
  const results = await Promise.all([
    createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: attemptId }),
    createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: attemptId }),
  ]);
  assert.deepEqual(results[0], results[1]);
  const after = await authorityCounts();
  assert.equal(after.threads, before.threads + 1);
  assert.equal(after.events, before.events + 1);
  assert.equal(after.ordinaryInbox, before.ordinaryInbox + 1);
  assert.equal(after.runtimeItems, before.runtimeItems + 1);
  assert.equal(after.windows, before.windows + 1);
  assert.equal(after.audits, before.audits + 1);
});

databaseTest('exact replay performs no second writes and changed receipt binding fails', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId, attemptId, result } = completedFixture;
  const before = await authorityCounts();
  const replay = await createGate3AssignmentWindow({
    bundle: b, receiptId, assignmentAttemptId: attemptId,
  });
  assert.deepEqual(replay, result);
  assert.deepEqual(await authorityCounts(), before);
  await rejectsCode(
    () => createGate3AssignmentWindow({
      bundle: b,
      receiptId: crypto.randomUUID(),
      assignmentAttemptId: attemptId,
    }),
    'attempt_binding_conflict',
  );
  const { bundleDigest: _bundleDigest, ...unsignedBundle } = b;
  const changedBundle = createPublicProvisioningBundle({
    ...unsignedBundle,
    bootstrapSha256: '1'.repeat(64),
  });
  await rejectsCode(
    () => createGate3AssignmentWindow({
      bundle: changedBundle,
      receiptId,
      assignmentAttemptId: attemptId,
    }),
    'receipt_invalid',
  );
  assert.deepEqual(await authorityCounts(), before);
});

databaseTest('receipt and challenge authority failures create no assignment rows', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId, challengeId } = completedFixture;
  const db = getSharedDb();
  const before = await authorityCounts();
  await rejectsCode(
    () => createGate3AssignmentWindow({
      bundle: b,
      receiptId: crypto.randomUUID(),
      assignmentAttemptId: crypto.randomUUID(),
    }),
    'receipt_invalid',
  );

  const [originalReceipt] = await db.select().from(taskOwnershipReceipts)
    .where(eq(taskOwnershipReceipts.id, receiptId));
  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipReceipts)
      .set({
        issuedAt: new Date(Date.now() - 120 * 60_000),
        expiresAt: new Date(Date.now() - 60 * 60_000),
      })
      .where(eq(taskOwnershipReceipts.id, receiptId));
  });
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
    'receipt_invalid',
  );
  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipReceipts)
      .set({ issuedAt: originalReceipt.issuedAt, expiresAt: originalReceipt.expiresAt })
      .where(eq(taskOwnershipReceipts.id, receiptId));
  });

  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipReceipts)
      .set({ expiresAt: new Date(Date.now() + 10 * 60_000) })
      .where(eq(taskOwnershipReceipts.id, receiptId));
  });
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
    'receipt_invalid',
  );
  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipReceipts)
      .set({ expiresAt: originalReceipt.expiresAt })
      .where(eq(taskOwnershipReceipts.id, receiptId));
  });

  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipReceipts)
      .set({ status: 'revoked', revokedAt: new Date() })
      .where(eq(taskOwnershipReceipts.id, receiptId));
  });
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
    'receipt_invalid',
  );
  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipReceipts)
      .set({ status: 'active', revokedAt: null })
      .where(eq(taskOwnershipReceipts.id, receiptId));
  });

  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipChallenges)
      .set({ status: 'rejected' })
      .where(eq(taskOwnershipChallenges.id, challengeId));
  });
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
    'receipt_invalid',
  );
  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipChallenges)
      .set({ status: 'approved' })
      .where(eq(taskOwnershipChallenges.id, challengeId));
  });

  const [originalChallenge] = await db.select().from(taskOwnershipChallenges)
    .where(eq(taskOwnershipChallenges.id, challengeId));
  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipChallenges)
      .set({ expiresAt: new Date(Date.now() - 1) })
      .where(eq(taskOwnershipChallenges.id, challengeId));
  });
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
    'receipt_invalid',
  );
  await mutateDisposableFixture(async (tx) => {
    await tx.update(taskOwnershipChallenges)
      .set({ expiresAt: originalChallenge.expiresAt })
      .where(eq(taskOwnershipChallenges.id, challengeId));
  });

  for (const changed of [
    { artifactSha256: 'f'.repeat(64) },
    { taskRef: '1449' },
    { intendedActor: 'luca-claude-code' },
    { publicKey: `${b.publicKey}changed` },
    { keyFingerprint: 'f'.repeat(64) },
    { contextDigest: 'f'.repeat(64) },
  ]) {
    await mutateDisposableFixture(async (tx) => {
      await tx.update(taskOwnershipReceipts).set(changed)
        .where(eq(taskOwnershipReceipts.id, receiptId));
    });
    await rejectsCode(
      () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
      'receipt_invalid',
    );
    await mutateDisposableFixture(async (tx) => {
      await tx.update(taskOwnershipReceipts).set(originalReceipt)
        .where(eq(taskOwnershipReceipts.id, receiptId));
    });
  }
  assert.deepEqual(await authorityCounts(), before);
});

databaseTest('missing or mismatched generation provisioning evidence creates no assignment rows', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId } = completedFixture;
  const db = getSharedDb();
  const [generation] = await db.select().from(coordinationCredentialAuditEvents)
    .where(and(
      eq(coordinationCredentialAuditEvents.eventType, 'runtime_generation_provisioned'),
      eq(coordinationCredentialAuditEvents.runtimeId, b.runtimeId),
    ));
  assert.ok(generation);
  const originalMetadata = generation.metadata;
  const before = await authorityCounts();

  for (const mutation of [
    { success: false, metadata: originalMetadata },
    { success: true, metadata: { ...originalMetadata, bundleDigest: 'f'.repeat(64) } },
    { success: true, metadata: { ...originalMetadata, profileId: 'antigravity-wrong' } },
    { success: true, metadata: { ...originalMetadata, receiptId: 'wrong-receipt' } },
    { success: true, metadata: { ...originalMetadata, bootstrapSha256: 'f'.repeat(64) } },
  ]) {
    await db.update(coordinationCredentialAuditEvents).set(mutation)
      .where(eq(coordinationCredentialAuditEvents.id, generation.id));
    await rejectsCode(
      () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
      'generation_provisioning_missing',
    );
  }
  await db.update(coordinationCredentialAuditEvents)
    .set({ success: true, metadata: originalMetadata })
    .where(eq(coordinationCredentialAuditEvents.id, generation.id));
  assert.deepEqual(await authorityCounts(), before);
});

databaseTest('live credential and live grant block new assignment authority', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId } = completedFixture;
  const db = getSharedDb();
  const before = await authorityCounts();
  const [liveCredential] = await db.insert(coordinationRuntimeCredentials).values({
    runtimeId: b.runtimeId,
    actor: GATE3.actor,
    tokenHash: crypto.randomBytes(32).toString('hex'),
    capabilities: [...GATE3.credentialCapabilities],
    expiresAt: new Date(Date.now() + 60_000),
  }).returning();
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
    'live_credential',
  );
  await db.delete(coordinationRuntimeCredentials)
    .where(eq(coordinationRuntimeCredentials.id, liveCredential.id));

  const [expiredCredential] = await db.insert(coordinationRuntimeCredentials).values({
    runtimeId: b.runtimeId,
    actor: GATE3.actor,
    tokenHash: crypto.randomBytes(32).toString('hex'),
    capabilities: [...GATE3.credentialCapabilities],
    issuedAt: new Date(Date.now() - 120_000),
    expiresAt: new Date(Date.now() - 60_000),
  }).returning();
  const [grant] = await db.insert(coordinationGate3ProofGrants).values({
    receiptId,
    credentialId: expiredCredential.id,
    runtimeRegistrationId: b.runtimeId,
    profileId: profileId(b),
    actor: GATE3.actor,
    taskRef: GATE3.taskRef,
    artifactSha256: b.artifactSha256,
    contextDigest: b.bundleDigest,
    startingCommit: b.startingCommit,
    proofPayloadDigest: 'f'.repeat(64),
    expiresAt: new Date(Date.now() + 60_000),
  }).returning();
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
    'live_grant',
  );
  await db.delete(coordinationGate3ProofGrants)
    .where(eq(coordinationGate3ProofGrants.id, grant.id));
  await db.delete(coordinationRuntimeCredentials)
    .where(eq(coordinationRuntimeCredentials.id, expiredCredential.id));
  assert.deepEqual(await authorityCounts(), before);
});

databaseTest('packet history blocks new authority but not exact completed replay', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId, attemptId, result } = completedFixture;
  const db = getSharedDb();
  const principal: RuntimePrincipal = {
    actor: GATE3.actor,
    runtimeRegistrationId: b.runtimeId,
    credentialId: `packet-history-${crypto.randomUUID()}`,
    profileId: profileId(b),
    capabilities: [...GATE3.runtimeCapabilities],
    credentialExpiresAt: Date.now() + 60_000,
    runtimeEnabled: true,
    revoked: false,
  };
  const service = new CoordinationRuntimeService(new PostgresCoordinationRuntimeRepository(db));
  await service.createPacket(principal, result.windowId, {
    assignmentEventId: result.assignmentEventId,
    assignmentAuthor: 'luca-replit',
    taskId: GATE3.taskRef,
    threadId: result.threadId,
    expectedSequence: 1,
  }, `packet-history-${crypto.randomUUID()}`);
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: crypto.randomUUID() }),
    'packet_history',
  );
  assert.deepEqual(
    await createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: attemptId }),
    result,
  );
});

databaseTest('corrupt completed-attempt projection fails closed', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId, attemptId } = completedFixture;
  const db = getSharedDb();
  const [audit] = await db.select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.eventType, 'gate3_assignment_window_created'))
    .orderBy(sql`${coordinationCredentialAuditEvents.createdAt} ASC`)
    .limit(1);
  const metadata = audit.metadata as Record<string, unknown>;
  await db.update(coordinationCredentialAuditEvents)
    .set({ metadata: { ...metadata, windowId: crypto.randomUUID() } })
    .where(eq(coordinationCredentialAuditEvents.id, audit.id));
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: attemptId }),
    'attempt_corrupt',
  );
  await db.update(coordinationCredentialAuditEvents)
    .set({ metadata })
    .where(eq(coordinationCredentialAuditEvents.id, audit.id));
});

databaseTest('coherently re-digested runtime projection cannot diverge from canonical event', async () => {
  assert.ok(completedFixture);
  const { bundle: b, receiptId, attemptId, result } = completedFixture;
  const db = getSharedDb();
  const [item] = await db.select().from(coordinationRuntimeInboxWindowItems)
    .where(eq(coordinationRuntimeInboxWindowItems.itemId, result.runtimeInboxItemId));
  const [window] = await db.select().from(coordinationRuntimeInboxWindows)
    .where(eq(coordinationRuntimeInboxWindows.id, result.windowId));
  const [audit] = await db.select().from(coordinationCredentialAuditEvents)
    .where(eq(coordinationCredentialAuditEvents.eventType, 'gate3_assignment_window_created'))
    .orderBy(sql`${coordinationCredentialAuditEvents.createdAt} ASC`)
    .limit(1);
  const originalAuditMetadata = audit.metadata as Record<string, unknown>;
  const divergentPayload = {
    ...(item.payload as Record<string, unknown>),
    content: {
      assignment: {
        author: 'luca-claude-code',
        taskId: GATE3.taskRef,
        expectedSequence: 1,
      },
    },
  };
  const divergentItemDigest = digestCanonical({
    id: item.itemId,
    eventId: item.eventId,
    threadId: item.threadId,
    taskId: item.taskId,
    sequence: item.sequence,
    payload: divergentPayload,
  });
  const divergentWindowPayload = {
    threadId: window.threadId,
    afterExclusive: window.afterExclusive,
    throughInclusive: window.throughInclusive,
    boundaryToken: window.boundaryToken,
    orderedItemIds: window.orderedItemIds,
    itemDigests: [divergentItemDigest],
  };
  const divergentBoundaryDigest = digestCanonical(divergentWindowPayload);

  await mutateDisposableFixture(async (tx) => {
    await tx.update(coordinationRuntimeInboxWindowItems)
      .set({ payload: divergentPayload, itemDigest: divergentItemDigest })
      .where(eq(coordinationRuntimeInboxWindowItems.itemId, item.itemId));
    await tx.update(coordinationRuntimeInboxWindows)
      .set({ canonicalPayload: divergentWindowPayload, boundaryDigest: divergentBoundaryDigest })
      .where(eq(coordinationRuntimeInboxWindows.id, window.id));
    await tx.update(coordinationCredentialAuditEvents)
      .set({ metadata: { ...originalAuditMetadata, boundaryDigest: divergentBoundaryDigest } })
      .where(eq(coordinationCredentialAuditEvents.id, audit.id));
  });
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId, assignmentAttemptId: attemptId }),
    'attempt_corrupt',
  );
  await mutateDisposableFixture(async (tx) => {
    await tx.update(coordinationRuntimeInboxWindowItems)
      .set({ payload: item.payload, itemDigest: item.itemDigest })
      .where(eq(coordinationRuntimeInboxWindowItems.itemId, item.itemId));
    await tx.update(coordinationRuntimeInboxWindows)
      .set({ canonicalPayload: window.canonicalPayload, boundaryDigest: window.boundaryDigest })
      .where(eq(coordinationRuntimeInboxWindows.id, window.id));
    await tx.update(coordinationCredentialAuditEvents)
      .set({ metadata: originalAuditMetadata })
      .where(eq(coordinationCredentialAuditEvents.id, audit.id));
  });
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

databaseTest('raw template hashing fails', async () => {
  const before = await authorityCounts();
  const rawTemplateSha256 = crypto.createHash('sha256')
    .update(new TextEncoder().encode(taskArtifactTemplateText))
    .digest('hex');
  const b = bundle('b'.repeat(64), rawTemplateSha256);
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId: 'r', assignmentAttemptId: crypto.randomUUID() }),
    'artifact_digest_mismatch',
  );
  assert.deepEqual(await authorityCounts(), before);
});

databaseTest('changed starting commit changes the accepted materialized artifact', async () => {
  const before = await authorityCounts();
  const startingCommit = 'e'.repeat(40);
  const changedArtifact = materializeTaskArtifact(taskArtifactTemplateText, startingCommit);
  assert.notEqual(changedArtifact.text, materializedTaskArtifact.text);
  assert.notEqual(changedArtifact.sha256, materializedTaskArtifact.sha256);
  const b = bundle('b'.repeat(64), changedArtifact.sha256, startingCommit);
  await rejectsCode(
    () => createGate3AssignmentWindow({ bundle: b, receiptId: 'r', assignmentAttemptId: crypto.randomUUID() }),
    'receipt_invalid',
  );
  assert.deepEqual(await authorityCounts(), before);
});

databaseTest('template placeholder count mismatch fails before database writes', async () => {
  const before = await authorityCounts();
  const dir = await mkdtemp(join(tmpdir(), 'gate3-template-test-'));
  try {
    const zeroPlaceholderPath = join(dir, 'zero-placeholder.md');
    await writeFile(zeroPlaceholderPath, 'No placeholders here', 'utf8');
    await rejectsCode(
      () => createGate3AssignmentWindow({
        bundle: bundle(),
        receiptId: 'r',
        assignmentAttemptId: crypto.randomUUID(),
        testHooks: { taskArtifactPath: zeroPlaceholderPath },
      }),
      'artifact_template_invalid',
    );

    const multiplePlaceholderPath = join(dir, 'multiple-placeholders.md');
    await writeFile(multiplePlaceholderPath, '__FINAL_STARTING_COMMIT__\n__FINAL_STARTING_COMMIT__', 'utf8');
    await rejectsCode(
      () => createGate3AssignmentWindow({
        bundle: bundle(),
        receiptId: 'r',
        assignmentAttemptId: crypto.randomUUID(),
        testHooks: { taskArtifactPath: multiplePlaceholderPath },
      }),
      'artifact_template_invalid',
    );
    assert.deepEqual(await authorityCounts(), before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

databaseTest('artifact growth after stat is read through EOF and fails closed', async () => {
  const before = await authorityCounts();
  const dir = await mkdtemp(join(tmpdir(), 'gate3-template-growth-test-'));
  const path = join(dir, 'growing-template.md');
  try {
    await writeFile(path, taskArtifactTemplateText, 'utf8');
    await rejectsCode(
      () => createGate3AssignmentWindow({
        bundle: bundle(),
        receiptId: 'r',
        assignmentAttemptId: crypto.randomUUID(),
        testHooks: {
          taskArtifactPath: path,
          afterTaskArtifactStat: async () => {
            await appendFile(path, `\n${STARTING_COMMIT_PLACEHOLDER}`, 'utf8');
          },
        },
      }),
      'artifact_template_invalid',
    );
    assert.deepEqual(await authorityCounts(), before);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});