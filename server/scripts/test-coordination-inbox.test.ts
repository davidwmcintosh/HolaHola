import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq, max } from 'drizzle-orm';
import {
  COORDINATION_EVENT_TYPES,
  agentNotes,
  coordinationEvents,
  coordinationInboxActivation,
  coordinationInboxCursors,
  coordinationInboxItems,
  coordinationThreads,
  type CoordinationActorId,
  type CoordinationEventType,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import {
  COORDINATION_INBOX_ACTIVATION_ID,
  COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
  COORDINATION_INBOX_SCHEMA_VERSION,
  acknowledgeCoordinationInbox,
  deriveCoordinationInboxRecipients,
  insertCoordinationInboxItems,
  listCoordinationInbox,
  verifyCoordinationInboxIntegrity,
} from '../services/coordination-inbox-service';
import { createCoordinationThread, CoordinationError } from '../services/coordination-ledger-service';
import { createSharedSpecRouter } from '../routes/shared-spec-routes';
import { InMemorySharedSpecRepository, SharedSpecCore } from '../services/shared-spec-core';
import { HolaHolaSharedSpecNotificationSink } from '../services/shared-spec-notifications';

const actors = {
  origin: 'luca-replit',
  recipient: 'luca-claude-code',
  owner: 'alden',
  alternate: 'daniela',
} as const satisfies Record<string, CoordinationActorId>;

const thread = (overrides: Partial<{
  originActor: CoordinationActorId;
  intendedRecipient: CoordinationActorId;
  currentOwner: CoordinationActorId | null;
}> = {}) => ({
  originActor: overrides.originActor ?? actors.origin,
  intendedRecipient: overrides.intendedRecipient ?? actors.recipient,
  currentOwner: overrides.currentOwner ?? actors.owner,
  sourceReference: null,
});

function recipients(
  eventType: CoordinationEventType,
  actor: CoordinationActorId,
  explicitRecipient?: CoordinationActorId | null,
  preThread = thread(),
  postThread = thread(),
) {
  return deriveCoordinationInboxRecipients({
    eventType,
    actor,
    explicitRecipient,
    preThread,
    postThread,
  });
}

test('inbox recipient mapping exhausts every event type and never copies to its sender', () => {
  const expected: Record<CoordinationEventType, CoordinationActorId[]> = {
    created: [actors.recipient],
    delivered: [],
    accepted: [actors.origin],
    progress: [actors.origin],
    evidence_added: [actors.origin],
    blocked: [actors.origin],
    completed: [actors.origin],
    outcome_acknowledged: [actors.owner],
    reopened: [actors.alternate, actors.origin],
    reassigned: [actors.alternate, actors.origin],
    comment: [actors.alternate],
  };
  assert.deepEqual(Object.keys(expected).sort(), [...COORDINATION_EVENT_TYPES].sort());

  for (const eventType of COORDINATION_EVENT_TYPES) {
    const explicit = eventType === 'reassigned' || eventType === 'comment' || eventType === 'reopened'
      ? actors.alternate
      : undefined;
    assert.deepEqual(recipients(eventType, 'luca-holahola', explicit), expected[eventType], eventType);
  }

  assert.deepEqual(recipients('comment', actors.owner), []);
  assert.deepEqual(recipients('comment', actors.owner, actors.alternate), [actors.alternate]);
  assert.deepEqual(recipients('created', actors.recipient, actors.recipient), []);
  assert.deepEqual(recipients('accepted', actors.origin), []);
  assert.deepEqual(recipients('reopened', actors.origin), [actors.recipient]);
});

test('recipient-addressed writers reject ready activation before any inbox row is inserted', async () => {
  const readyExecutor = {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{
            id: COORDINATION_INBOX_ACTIVATION_ID,
            schemaVersion: COORDINATION_INBOX_SCHEMA_VERSION,
            recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
            state: 'ready',
          }],
        }),
      }),
    }),
    insert: () => assert.fail('ready activation must block the inbox insert'),
  };
  await assert.rejects(
    () => insertCoordinationInboxItems(readyExecutor, {
      event: {
        id: 'event-ready', eventType: 'created', actor: actors.origin, threadId: 'thread-ready',
        globalSequence: 1, createdAt: new Date(),
      } as any,
      preThread: thread(),
      postThread: thread(),
      explicitRecipient: actors.recipient,
    }),
    (error: unknown) => error instanceof CoordinationError && error.code === 'inbox_not_active',
  );
});

test('integrity reports orphan inbox items and unsupported recipient-rule versions', async () => {
  let selectCount = 0;
  const executor = {
    select: () => {
      selectCount += 1;
      if (selectCount === 1) {
        return { from: () => ({ innerJoin: () => ({ orderBy: async () => [] }) }) };
      }
      return { from: async () => [{
        id: 'orphan-item',
        coordinationEventId: 'missing-event',
        recipientActor: actors.recipient,
        recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION - 1,
      }] };
    },
  };
  const integrity = await verifyCoordinationInboxIntegrity(executor);
  assert.equal(integrity.ok, false);
  assert.deepEqual(integrity.mismatches, [{
    eventId: 'missing-event',
    expected: [],
    actual: [actors.recipient],
  }]);
  assert.deepEqual(integrity.unsupportedRuleRows, [{
    inboxItemId: 'orphan-item',
    eventId: 'missing-event',
    recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION - 1,
  }]);
});

test('a shared-spec review decision creates a distinct recipient-addressed coordination thread', async () => {
  let id = 0;
  const core = new SharedSpecCore(new InMemorySharedSpecRepository(), {
    newId: () => `inbox-test-${++id}`,
  });
  const author = { actorId: actors.origin };
  const reviewer = { actorId: actors.recipient };
  await core.setReviewerPolicy(
    { actorId: 'policy-admin', capabilities: ['policy_admin'] },
    { actorId: reviewer.actorId, capability: 'reviewer', active: true, idempotencyKey: 'policy-on' },
  );
  const created = await core.createDocument(author, {
    title: 'Inbox discovery regression',
    summary: 'A review decision must be discoverable as its own created coordination thread.',
    kind: 'design',
    repository: 'hola-hola/app',
    gitPath: 'docs/superpowers/specs/inbox-discovery.md',
    markdown: '# Inbox discovery\n',
    idempotencyKey: 'create-document',
  });
  const review = await core.markRevisionReady(author, {
    documentId: created.document.id,
    revisionId: created.revision.id,
    requestedReviewerActorId: reviewer.actorId,
    idempotencyKey: 'ready-for-review',
  });
  await core.claimReview(reviewer, review.id, 'claim-review');

  const createdThreads: any[] = [];
  const notifications = new HolaHolaSharedSpecNotificationSink({
    create: async (input) => {
      createdThreads.push(input);
      return { deliveryState: 'pending' };
    },
  });
  const router = createSharedSpecRouter({
    core,
    authenticator: { authenticate: async () => reviewer },
    notifications,
  });
  const layer = (router as any).stack.find(
    (candidate: any) => candidate.route?.path === '/reviews/:reviewId/approve',
  );
  assert.ok(layer, 'approve route must be registered');
  let statusCode = 0;
  let body: unknown;
  await layer.route.stack[0].handle(
    {
      params: { reviewId: review.id },
      body: { rationale: 'Approved after review.' },
      header: (name: string) => name === 'idempotency-key' ? 'approve-review' : undefined,
    },
    {
      status: (code: number) => { statusCode = code; return { json: (value: unknown) => { body = value; } }; },
      json: (value: unknown) => { body = value; },
    },
  );

  assert.equal(statusCode, 0);
  assert.equal((body as { state: string }).state, 'approved');
  assert.deepEqual(createdThreads, [{
    initiatingActorId: reviewer.actorId,
    title: 'Shared spec: review_decided',
    description: `Shared spec review approved: ${created.document.id}/${created.revision.id}`,
    intendedRecipient: author.actorId,
    priority: 'normal',
    createInboxDelivery: true,
    idempotencyKey: `shared-spec:review_decided:v2:${review.id}:approved:${reviewer.actorId}`,
    sourceReference: {
      type: 'design_spec',
      provider: 'shared-spec',
      identifier: `${created.document.id}/${created.revision.id}`,
      digest: created.revision.contentHash,
    },
  }]);
});

const hasIsolatedCiDatabase = Boolean(process.env.COORDINATION_INBOX_DISPOSABLE_BRANCH_ID);
const databaseTest = hasIsolatedCiDatabase ? test : test.skip;
const runId = randomUUID();
const testThreadIds: string[] = [];
const legacyNoteIds: string[] = [];

after(async () => {
  if (!hasIsolatedCiDatabase) return;
  const db = getSharedDb();
  for (const id of testThreadIds) await db.delete(coordinationThreads).where(eq(coordinationThreads.id, id));
  for (const id of legacyNoteIds) await db.delete(agentNotes).where(eq(agentNotes.id, id));
  await db.delete(coordinationInboxCursors).where(eq(coordinationInboxCursors.recipientActor, actors.recipient));
  await db.delete(coordinationInboxCursors).where(eq(coordinationInboxCursors.recipientActor, actors.owner));
  await closeDbConnections();
});

databaseTest('materialized inbox keeps page windows stable, isolates actors, and rejects corrupted idempotency', async () => {
  const db = getSharedDb();
  process.env.COORDINATION_INBOX_TOKEN_SECRET = 'i'.repeat(32);
  await db.insert(coordinationInboxActivation).values({
    id: COORDINATION_INBOX_ACTIVATION_ID,
    schemaVersion: COORDINATION_INBOX_SCHEMA_VERSION,
    recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
    state: 'active',
  }).onConflictDoUpdate({
    target: coordinationInboxActivation.id,
    set: { state: 'active', schemaVersion: COORDINATION_INBOX_SCHEMA_VERSION, recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION },
  });
  const [{ highWater }] = await db
    .select({ highWater: max(coordinationInboxItems.eventGlobalSequence) })
    .from(coordinationInboxItems)
    .where(eq(coordinationInboxItems.recipientActor, actors.recipient));
  const [{ ownerHighWater }] = await db
    .select({ ownerHighWater: max(coordinationInboxItems.eventGlobalSequence) })
    .from(coordinationInboxItems)
    .where(eq(coordinationInboxItems.recipientActor, actors.owner));
  await db.insert(coordinationInboxCursors).values({
    recipientActor: actors.recipient,
    acknowledgedEventGlobalSequence: Number(highWater ?? 0),
  }).onConflictDoUpdate({
    target: coordinationInboxCursors.recipientActor,
    set: {
      acknowledgedEventGlobalSequence: Number(highWater ?? 0),
      updatedAt: new Date(),
    },
  });

  const insertEvent = async (recipientActor: CoordinationActorId) => {
    const threadId = randomUUID();
    testThreadIds.push(threadId);
    return db.transaction(async (tx) => {
      await tx.insert(coordinationThreads).values({
        id: threadId, title: `Inbox ${runId}`, description: 'Disposable CI inbox row.',
        originActor: actors.origin, intendedRecipient: recipientActor, state: 'created',
      });
      const [event] = await tx.insert(coordinationEvents).values({
        threadId, sequence: 1, actor: actors.origin, recipientActor, eventType: 'created',
        content: 'Inbox event.', idempotencyKey: `inbox:${runId}:${threadId}`,
      }).returning();
      await tx.insert(coordinationInboxItems).values({
        recipientActor, coordinationEventId: event.id, coordinationThreadId: threadId,
        eventGlobalSequence: event.globalSequence, senderActor: actors.origin, messageKind: 'created',
        recipientRuleVersion: COORDINATION_INBOX_RECIPIENT_RULE_VERSION,
      });
      return event;
    });
  };

  const staleWriterThreadId = randomUUID();
  await assert.rejects(
    () => db.transaction(async (tx) => {
      await tx.insert(coordinationThreads).values({
        id: staleWriterThreadId,
        title: `Stale writer ${runId}`,
        description: 'A stale runtime must not commit an explicit recipient without an inbox row.',
        originActor: actors.origin,
        intendedRecipient: actors.recipient,
        state: 'created',
      });
      await tx.insert(coordinationEvents).values({
        threadId: staleWriterThreadId,
        sequence: 1,
        actor: actors.origin,
        recipientActor: actors.recipient,
        eventType: 'created',
        content: 'This transaction deliberately omits the inbox row.',
        idempotencyKey: `inbox-stale-writer:${runId}`,
      });
    }),
    (error: unknown) => (
      error instanceof Error
      && error.message.includes('Failed query: commit')
      && error.cause instanceof Error
      && error.cause.message.includes('has no materialized inbox item')
    ),
  );

  const first = await insertEvent(actors.recipient);
  const second = await insertEvent(actors.recipient);
  const third = await insertEvent(actors.recipient);
  await insertEvent(actors.owner);
  const pageOne = await listCoordinationInbox(actors.recipient, {
    after: Number(highWater ?? 0),
    limit: 2,
  });
  assert.deepEqual(pageOne.items.map((item) => item.event.id), [first.id, second.id]);
  assert.equal(pageOne.window.complete, false);
  await assert.rejects(
    () => acknowledgeCoordinationInbox(actors.recipient, pageOne.window.token),
    (error: unknown) => error instanceof CoordinationError && error.code === 'inbox_window_incomplete',
  );

  const later = await insertEvent(actors.recipient);
  const pageTwo = await listCoordinationInbox(actors.recipient, { token: pageOne.window.nextToken! });
  assert.deepEqual(pageTwo.items.map((item) => item.event.id), [third.id]);
  assert.equal(pageTwo.window.complete, true);
  const acknowledgement = await acknowledgeCoordinationInbox(actors.recipient, pageTwo.window.token);
  assert.equal(acknowledgement.acknowledgedEventGlobalSequence, pageOne.window.through);
  const nextWindow = await listCoordinationInbox(actors.recipient, { limit: 10 });
  assert.deepEqual(nextWindow.items.map((item) => item.event.id), [later.id]);
  const isolated = await listCoordinationInbox(actors.owner, {
    after: Number(ownerHighWater ?? 0),
    limit: 10,
  });
  assert.equal(isolated.items.length, 1);
  assert.equal(isolated.items[0].inboxItem.recipientActor, actors.owner);

  const sign = (payload: Record<string, unknown>) => {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${createHmac('sha256', process.env.COORDINATION_INBOX_TOKEN_SECRET!).update(encoded).digest('base64url')}`;
  };
  await assert.rejects(
    () => listCoordinationInbox(actors.recipient, {
      token: sign({ v: 1, actor: actors.recipient, after: 0, through: 1, lastSequence: 1, lastId: 7, complete: false }),
    }),
    (error: unknown) => error instanceof CoordinationError && error.code === 'inbox_window_forbidden',
  );
  await assert.rejects(
    () => listCoordinationInbox(actors.recipient, {
      token: sign({ v: 1, actor: actors.recipient, after: 4, through: 3, lastSequence: 3, lastId: '', complete: false }),
    }),
    (error: unknown) => error instanceof CoordinationError && error.code === 'invalid_inbox_window',
  );

  const legacyNotes = await db.insert(agentNotes).values(Array.from({ length: 101 }, (_, index) => ({
    fromAgent: 'alden',
    toAgent: 'luca-claude-code',
    subject: `Inbox legacy coverage ${runId} ${index}`,
    body: 'Disposable CI legacy note.',
  }))).returning({ id: agentNotes.id });
  legacyNoteIds.push(...legacyNotes.map((note) => note.id));
  const legacyCoverage = (await listCoordinationInbox(actors.recipient, { limit: 1 })).legacyCoverage as {
    complete: boolean;
    truncated: boolean;
    continuationRequired: boolean;
    notes: unknown[];
    directNoteCount: number;
  };
  assert.equal(legacyCoverage.complete, false);
  assert.equal(legacyCoverage.truncated, true);
  assert.equal(legacyCoverage.continuationRequired, true);
  assert.equal(legacyCoverage.notes.length, 100);
  assert.ok(legacyCoverage.directNoteCount >= 101);

  const created = await createCoordinationThread({
    actor: actors.origin, intendedRecipient: actors.recipient, title: `Corruption ${runId}`,
    description: 'Verify an idempotent event cannot conceal a missing materialized inbox row.',
    idempotencyKey: `inbox-corruption:${runId}`,
  });
  testThreadIds.push(created.thread.id);
  await db.delete(coordinationInboxItems).where(eq(coordinationInboxItems.coordinationEventId, created.event.id));
  await assert.rejects(
    () => createCoordinationThread({
      actor: actors.origin, intendedRecipient: actors.recipient, title: `Corruption ${runId}`,
      description: 'Verify an idempotent event cannot conceal a missing materialized inbox row.',
      idempotencyKey: `inbox-corruption:${runId}`,
    }),
    (error: unknown) => error instanceof CoordinationError && error.code === 'inbox_ledger_corrupt',
  );
});