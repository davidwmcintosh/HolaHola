import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq } from 'drizzle-orm';
import {
  agentNotes,
  coordinationAdapterDeliveries,
  coordinationEvents,
  coordinationThreads,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { resolveCoordinationActor } from '../middleware/coordination-auth';
import { runCoordinationDeliveryBatch } from '../services/coordination-delivery-worker';
import {
  appendCoordinationEvent,
  CoordinationError,
  createCoordinationThread,
  getCoordinationThread,
  listCoordinationFeed,
} from '../services/coordination-ledger-service';

const runId = randomUUID();
const keys = (action: string) => `coordination-test:${runId}:${action}`;
let threadId: string | null = null;
let createdEventId: string | null = null;

after(async () => {
  const db = getSharedDb();
  if (createdEventId) {
    await db.delete(agentNotes)
      .where(eq(agentNotes.sourceMessageKey, `coordination:${createdEventId}:agent_notes`));
  }
  if (threadId) await db.delete(coordinationThreads).where(eq(coordinationThreads.id, threadId));
  await closeDbConnections();
});

test('coordination auth derives actors and fails closed on ambiguous tokens', () => {
  const replit = 'r'.repeat(40);
  const claude = 'c'.repeat(40);
  const environment = {
    COORDINATION_LUCA_REPLIT_TOKEN: replit,
    COORDINATION_LUCA_CLAUDE_CODE_TOKEN: claude,
  };
  assert.deepEqual(resolveCoordinationActor(claude, undefined, environment), {
    ok: true,
    actor: 'luca-claude-code',
  });
  assert.equal(resolveCoordinationActor(undefined, replit, environment).ok, false);
  assert.deepEqual(resolveCoordinationActor(replit, undefined, {
    COORDINATION_LUCA_REPLIT_TOKEN: replit,
  }), {
    ok: true,
    actor: 'luca-replit',
  });
  assert.equal(resolveCoordinationActor('x'.repeat(40), undefined, environment).ok, false);
  const ambiguous = resolveCoordinationActor(replit, undefined, {
    COORDINATION_LUCA_REPLIT_TOKEN: replit,
    COORDINATION_LUCA_CLAUDE_CODE_TOKEN: replit,
  });
  assert.deepEqual(ambiguous, {
    ok: false,
    status: 503,
    error: 'Coordination authentication has ambiguous token bindings',
  });
});

test('canonical coordination lifecycle is ordered, idempotent, and adapter-backed', async () => {
  const created = await createCoordinationThread({
    actor: 'luca-replit',
    intendedRecipient: 'luca-claude-code',
    title: `Coordination regression ${runId}`,
    description: 'Exercise the complete Phase 1 lifecycle on isolated test data.',
    idempotencyKey: keys('create'),
    sourceReference: {
      type: 'design_spec',
      provider: 'github',
      identifier: 'docs/superpowers/specs/2026-09-02-agent-coordination-ledger-design.md',
      digest: 'sha256:1234567890abcdef',
    },
  });
  threadId = created.thread.id;
  createdEventId = created.event.id;
  assert.equal(created.thread.latestSequence, 1);
  assert.equal(created.thread.state, 'created');
  assert.equal(created.deliveryState, 'pending');
  assert.equal(created.deduplicated, false);

  const duplicateCreate = await createCoordinationThread({
    actor: 'luca-replit',
    intendedRecipient: 'luca-claude-code',
    title: `Coordination regression ${runId}`,
    description: 'Exercise the complete Phase 1 lifecycle on isolated test data.',
    idempotencyKey: keys('create'),
  });
  assert.equal(duplicateCreate.thread.id, threadId);
  assert.equal(duplicateCreate.deduplicated, true);

  assert.equal(await runCoordinationDeliveryBatch(), 1);
  assert.equal(await runCoordinationDeliveryBatch(), 0);
  const deliveredView = await getCoordinationThread(threadId, 'luca-claude-code');
  assert.deepEqual(deliveredView.events.map((event) => event.sequence), [1, 2]);
  assert.equal(deliveredView.thread.state, 'delivered');
  const [delivery] = await getSharedDb()
    .select()
    .from(coordinationAdapterDeliveries)
    .where(eq(coordinationAdapterDeliveries.eventId, createdEventId));
  assert.equal(delivery.status, 'delivered');
  const projectedNotes = await getSharedDb()
    .select()
    .from(agentNotes)
    .where(eq(agentNotes.sourceMessageKey, `coordination:${createdEventId}:agent_notes`));
  assert.equal(projectedNotes.length, 1);
  assert.match(projectedNotes[0].body, /does not mean you accepted/);

  const accepted = await appendCoordinationEvent({
    threadId,
    actor: 'luca-claude-code',
    eventType: 'accepted',
    content: 'Accepted by Claude Code.',
    idempotencyKey: keys('accept'),
    expectedSequence: 2,
  });
  assert.equal(accepted.thread.state, 'accepted');
  assert.equal(accepted.thread.currentOwner, 'luca-claude-code');
  assert.equal(accepted.event.sequence, 3);
  const duplicateAccept = await appendCoordinationEvent({
    threadId,
    actor: 'luca-claude-code',
    eventType: 'accepted',
    content: 'Retry after a lost response.',
    idempotencyKey: keys('accept'),
    expectedSequence: 2,
  });
  assert.equal(duplicateAccept.event.id, accepted.event.id);
  assert.equal(duplicateAccept.deduplicated, true);

  await assert.rejects(
    appendCoordinationEvent({
      threadId,
      actor: 'luca-claude-code',
      eventType: 'progress',
      content: 'Stale update.',
      idempotencyKey: keys('stale-progress'),
      expectedSequence: 2,
    }),
    (error: unknown) => (
      error instanceof CoordinationError
      && error.statusCode === 409
      && error.details?.currentSequence === 3
    ),
  );

  const progress = await appendCoordinationEvent({
    threadId,
    actor: 'luca-claude-code',
    eventType: 'progress',
    content: 'Implementation is underway; local changes are progress, not evidence.',
    idempotencyKey: keys('progress'),
    expectedSequence: 3,
  });
  assert.equal(progress.thread.state, 'in_progress');
  assert.equal(progress.event.sequence, 4);

  await assert.rejects(
    appendCoordinationEvent({
      threadId,
      actor: 'luca-claude-code',
      eventType: 'completed',
      content: 'Attempted completion without evidence.',
      idempotencyKey: keys('complete-without-evidence'),
      expectedSequence: 4,
    }),
    (error: unknown) => (
      error instanceof CoordinationError
      && error.code === 'completion_evidence_required'
    ),
  );
  assert.equal((await getCoordinationThread(threadId, 'luca-replit')).thread.latestSequence, 4);

  const evidence = await appendCoordinationEvent({
    threadId,
    actor: 'luca-claude-code',
    eventType: 'evidence_added',
    content: 'Pushed implementation commit.',
    idempotencyKey: keys('evidence'),
    expectedSequence: 4,
    evidence: [{
      type: 'commit',
      provider: 'github',
      identifier: 'a'.repeat(40),
      label: 'Implementation commit',
    }],
  });
  assert.equal(evidence.event.sequence, 5);

  const completed = await appendCoordinationEvent({
    threadId,
    actor: 'luca-claude-code',
    eventType: 'completed',
    content: 'Implementation complete with immutable evidence.',
    idempotencyKey: keys('complete'),
    expectedSequence: 5,
  });
  assert.equal(completed.thread.state, 'completed');
  assert.equal(completed.event.sequence, 6);

  const acknowledged = await appendCoordinationEvent({
    threadId,
    actor: 'luca-replit',
    eventType: 'outcome_acknowledged',
    content: 'Returned outcome verified.',
    idempotencyKey: keys('acknowledge'),
    expectedSequence: 6,
  });
  assert.equal(acknowledged.thread.state, 'outcome_acknowledged');

  const reopened = await appendCoordinationEvent({
    threadId,
    actor: 'luca-replit',
    eventType: 'reopened',
    content: 'Evidence needs a follow-up.',
    idempotencyKey: keys('reopen'),
    expectedSequence: 7,
  });
  assert.equal(reopened.thread.state, 'reopened');
  assert.equal(reopened.thread.currentOwner, null);

  const reassigned = await appendCoordinationEvent({
    threadId,
    actor: 'luca-replit',
    recipientActor: 'alden',
    eventType: 'reassigned',
    content: 'Reassigned to Alden for review.',
    idempotencyKey: keys('reassign'),
    expectedSequence: 8,
  });
  assert.equal(reassigned.thread.state, 'reassigned');
  assert.equal(reassigned.thread.intendedRecipient, 'alden');
  assert.equal(reassigned.event.sequence, 9);

  const feed = await listCoordinationFeed('luca-replit', 0, 100);
  const ownEvents = feed.items.filter((item) => item.thread.id === threadId);
  assert.equal(ownEvents.length, 9);
  assert.equal(feed.cursor.next >= ownEvents.at(-1)!.event.globalSequence, true);
  assert.deepEqual(ownEvents.map((item) => item.event.sequence), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('Alden cannot reassign work after another actor owns it', async () => {
  const created = await createCoordinationThread({
    actor: 'luca-replit',
    intendedRecipient: 'alden',
    title: `Alden ownership regression ${runId}`,
    description: 'Alden must own work before delegating it.',
    idempotencyKey: keys('alden-owner-create'),
  });
  const ownedByAlden = await appendCoordinationEvent({
    threadId: created.thread.id,
    actor: 'alden',
    eventType: 'accepted',
    content: 'Accepted by Alden.',
    idempotencyKey: keys('alden-owner-accept'),
    expectedSequence: 1,
  });
  const delegated = await appendCoordinationEvent({
    threadId: created.thread.id,
    actor: 'alden',
    eventType: 'reassigned',
    recipientActor: 'daniela',
    content: 'Delegated to Daniela.',
    idempotencyKey: keys('alden-owner-delegate'),
    expectedSequence: ownedByAlden.thread.latestSequence,
  });
  const ownedByDaniela = await appendCoordinationEvent({
    threadId: created.thread.id,
    actor: 'daniela',
    eventType: 'accepted',
    content: 'Accepted by Daniela.',
    idempotencyKey: keys('daniela-owner-accept'),
    expectedSequence: delegated.thread.latestSequence,
  });

  await assert.rejects(
    appendCoordinationEvent({
      threadId: created.thread.id,
      actor: 'alden',
      eventType: 'reassigned',
      recipientActor: 'luca-replit',
      content: 'Attempted reassignment after ownership transferred.',
      idempotencyKey: keys('alden-owner-invalid-reassign'),
      expectedSequence: ownedByDaniela.thread.latestSequence,
    }),
    (error: unknown) => error instanceof CoordinationError && error.code === 'not_owner',
  );

  await getSharedDb().delete(coordinationThreads).where(eq(coordinationThreads.id, created.thread.id));
});