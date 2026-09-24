import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq, inArray } from 'drizzle-orm';
import {
  agentNotes,
  coordinationActorFeedCursors,
  coordinationAdapterDeliveries,
  coordinationEvents,
  coordinationThreads,
} from '@shared/schema';
import { closeDbConnections, getSharedDb } from '../db';
import { resolveCoordinationActor } from '../middleware/coordination-auth';
import { runCoordinationDeliveryBatch } from '../services/coordination-delivery-worker';
import {
  acknowledgeCoordinationFeed,
  appendCoordinationEvent,
  completeWithLinkedOutcome,
  CoordinationError,
  createCoordinationThread,
  getCoordinationThread,
  getCoordinationFeedCursor,
  listCoordinationFeed,
} from '../services/coordination-ledger-service';
import { getCoordinationInboxActivation } from '../services/coordination-inbox-service';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

const runId = randomUUID();
const keys = (action: string) => `coordination-test:${runId}:${action}`;
const hasIsolatedCiDatabase = Boolean(getVerifiedCiDatabaseUrl());
const databaseTest = hasIsolatedCiDatabase ? test : test.skip;
let threadId: string | null = null;
let createdEventId: string | null = null;

after(async () => {
  if (!hasIsolatedCiDatabase) return;
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

databaseTest('canonical coordination lifecycle is ordered, idempotent, and adapter-backed', async () => {
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

databaseTest('agent-note work requires an atomic delivered linked outcome', async () => {
  const db = getSharedDb();
  const localThreadIds: string[] = [];
  const localNoteIds: string[] = [];
  const prefix = `${keys('linked-outcome')}:`;
  try {
    const parent = await db.insert(agentNotes).values({
      fromAgent: 'luca-claude-code',
      toAgent: 'agent',
      subject: `[CI] Linked outcome ${runId}`,
      body: 'Please complete this work and reply with the outcome.',
      sourceMessageKey: `${prefix}parent`,
    }).returning();
    localNoteIds.push(parent[0].id);

    const created = await createCoordinationThread({
      actor: 'luca-claude-code',
      intendedRecipient: 'luca-replit',
      title: `Linked outcome regression ${runId}`,
      description: 'Completion must not outrun direct communication.',
      idempotencyKey: `${prefix}create`,
      createInboxDelivery: false,
      sourceReference: {
        type: 'agent_note',
        provider: 'agent_notes',
        identifier: parent[0].id,
      },
    });
    localThreadIds.push(created.thread.id);

    const accepted = await appendCoordinationEvent({
      threadId: created.thread.id,
      actor: 'luca-replit',
      eventType: 'accepted',
      content: 'Accepted linked-outcome work.',
      idempotencyKey: `${prefix}accept`,
      expectedSequence: 1,
    });
    const evidence = await appendCoordinationEvent({
      threadId: created.thread.id,
      actor: 'luca-replit',
      eventType: 'evidence_added',
      content: 'Implementation evidence.',
      idempotencyKey: `${prefix}evidence`,
      expectedSequence: 2,
      causalParentEventId: accepted.event.id,
      evidence: [{
        type: 'test_result',
        provider: 'ci',
        identifier: `${prefix}passing-test`,
      }],
    });

    await assert.rejects(
      appendCoordinationEvent({
        threadId: created.thread.id,
        actor: 'luca-replit',
        eventType: 'completed',
        content: 'Must fail without a direct linked reply.',
        idempotencyKey: `${prefix}unlinked-complete`,
        expectedSequence: 3,
      }),
      (error: unknown) => (
        error instanceof CoordinationError
        && error.code === 'linked_outcome_required'
      ),
    );

    const foreign = await createCoordinationThread({
      actor: 'luca-replit',
      intendedRecipient: 'luca-claude-code',
      title: `Foreign causal parent ${runId}`,
      description: 'Cross-thread causal references must fail.',
      idempotencyKey: `${prefix}foreign-create`,
      createInboxDelivery: false,
    });
    localThreadIds.push(foreign.thread.id);
    await assert.rejects(
      completeWithLinkedOutcome({
        threadId: created.thread.id,
        actor: 'luca-replit',
        content: 'Cross-thread causal attempt.',
        expectedSequence: 3,
        idempotencyKey: `${prefix}cross-thread`,
        causalParentEventId: foreign.event.id,
        reply: { body: 'This must not be delivered.' },
      }),
      (error: unknown) => (
        error instanceof CoordinationError
        && error.code === 'invalid_causal_parent'
        && error.statusCode === 409
      ),
    );
    assert.equal(
      (await db.select().from(agentNotes)
        .where(eq(agentNotes.sourceMessageKey, `${prefix}cross-thread`))).length,
      0,
      'causal validation must fail before reply delivery',
    );
    await assert.rejects(
      completeWithLinkedOutcome({
        threadId: created.thread.id,
        actor: 'luca-replit',
        content: 'Missing causal-parent attempt.',
        expectedSequence: 3,
        idempotencyKey: `${prefix}missing-parent`,
        causalParentEventId: '00000000-0000-4000-8000-000000000000',
        reply: { body: 'This must not be delivered either.' },
      }),
      (error: unknown) => (
        error instanceof CoordinationError
        && error.code === 'causal_parent_not_found'
        && error.statusCode === 404
      ),
    );
    assert.equal(
      (await db.select().from(agentNotes)
        .where(eq(agentNotes.sourceMessageKey, `${prefix}missing-parent`))).length,
      0,
      'missing causal validation must fail before reply delivery',
    );

    const completionKey = `${prefix}complete`;
    await assert.rejects(
      completeWithLinkedOutcome({
        threadId: created.thread.id,
        actor: 'luca-replit',
        content: 'Completion must roll back when the sequence is stale.',
        expectedSequence: 2,
        idempotencyKey: completionKey,
        causalParentEventId: evidence.event.id,
        reply: { body: 'The implementation is complete and verified.' },
      }),
      (error: unknown) => (
        error instanceof CoordinationError
        && error.code === 'sequence_conflict'
        && error.details?.currentSequence === 3
      ),
    );
    assert.equal(
      (await db.select().from(agentNotes)
        .where(eq(agentNotes.sourceMessageKey, completionKey))).length,
      0,
      'failed completion preconditions must not deliver a reply',
    );

    const completed = await completeWithLinkedOutcome({
      threadId: created.thread.id,
      actor: 'luca-replit',
      content: 'Atomic completion with a linked outcome.',
      expectedSequence: 3,
      idempotencyKey: completionKey,
      causalParentEventId: evidence.event.id,
      reply: { body: 'The implementation is complete and verified.' },
    });
    assert.equal(completed.achievedState, 'completed');
    assert.equal(completed.thread.state, 'completed');
    assert.equal(completed.event.sequence, 4);
    assert.equal(completed.linkedReply.deliveryState, 'delivered');
    assert.equal(completed.linkedReply.deduplicated, false);
    const [deliveredReply] = await db.select().from(agentNotes)
      .where(eq(agentNotes.sourceMessageKey, completionKey));
    assert.ok(deliveredReply, 'atomic success must persist the linked reply');
    localNoteIds.push(deliveredReply.id);
    assert.equal(deliveredReply.status, 'unread');
    assert.equal(deliveredReply.inReplyToId, parent[0].id);
    assert.equal(completed.linkedReply.id, deliveredReply.id);

    const retry = await completeWithLinkedOutcome({
      threadId: created.thread.id,
      actor: 'luca-replit',
      content: 'Atomic completion with a linked outcome.',
      expectedSequence: 3,
      idempotencyKey: completionKey,
      causalParentEventId: evidence.event.id,
      reply: { body: 'The implementation is complete and verified.' },
    });
    assert.equal(retry.deduplicated, true);
    assert.equal(retry.event.id, completed.event.id);
    assert.equal(retry.linkedReply.id, deliveredReply.id);

    await assert.rejects(
      completeWithLinkedOutcome({
        threadId: created.thread.id,
        actor: 'luca-replit',
        content: 'Conflicting completion content.',
        expectedSequence: 3,
        idempotencyKey: completionKey,
        causalParentEventId: evidence.event.id,
        reply: { body: 'The implementation is complete and verified.' },
      }),
      (error: unknown) => (
        error instanceof CoordinationError
        && error.code === 'idempotency_conflict'
      ),
    );
  } finally {
    if (localThreadIds.length > 0) {
      await db.delete(coordinationThreads).where(inArray(coordinationThreads.id, localThreadIds));
    }
    if (localNoteIds.length > 0) {
      await db.delete(agentNotes).where(inArray(agentNotes.id, localNoteIds));
    }
  }
});

databaseTest('Alden cannot reassign work after another actor owns it', async () => {
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

databaseTest('feed acknowledgement is durable, actor-scoped, monotonic, and separate from lifecycle state', async () => {
  const db = getSharedDb();
  const actors = ['david', 'daniela'] as const;
  const originalCursors = await db
    .select()
    .from(coordinationActorFeedCursors)
    .where(inArray(coordinationActorFeedCursors.actor, [...actors]));
  let cursorThreadId: string | null = null;

  try {
    const originalDavidCursor = await getCoordinationFeedCursor('david');
    const originalDanielaCursor = await getCoordinationFeedCursor('daniela');
    const created = await createCoordinationThread({
      actor: 'luca-replit',
      intendedRecipient: 'david',
      title: `Durable feed cursor ${runId}`,
      description: 'Verify polling progress survives a stateless client restart.',
      idempotencyKey: keys('feed-cursor-create'),
    });
    cursorThreadId = created.thread.id;

    const firstPoll = await listCoordinationFeed('david');
    assert.equal(firstPoll.cursor.previous, originalDavidCursor);
    assert.equal(firstPoll.cursor.acknowledged, originalDavidCursor);
    assert.equal(
      firstPoll.items.some((item) => item.event.id === created.event.id),
      true,
      'reading the feed from the server cursor must expose the new event',
    );
    assert.equal(
      await getCoordinationFeedCursor('david'),
      originalDavidCursor,
      'reading must not implicitly acknowledge work',
    );

    const acknowledged = await acknowledgeCoordinationFeed(
      'david',
      created.event.globalSequence,
    );
    assert.equal(acknowledged.acknowledgedGlobalSequence, created.event.globalSequence);
    assert.equal(created.thread.state, 'created', 'feed acknowledgement must not accept lifecycle work');

    const replayAfterRestart = await listCoordinationFeed('david');
    assert.equal(replayAfterRestart.cursor.previous, created.event.globalSequence);
    assert.equal(
      replayAfterRestart.items.some((item) => item.event.id === created.event.id),
      false,
      'a new client instance must resume after the durable acknowledgement',
    );

    const staleAck = await acknowledgeCoordinationFeed('david', originalDavidCursor);
    assert.equal(
      staleAck.acknowledgedGlobalSequence,
      created.event.globalSequence,
      'a delayed actor runtime must not move the durable cursor backward',
    );
    assert.equal(await getCoordinationFeedCursor('daniela'), originalDanielaCursor);

    await assert.rejects(
      acknowledgeCoordinationFeed('david', Number.MAX_SAFE_INTEGER),
      (error: unknown) => error instanceof CoordinationError && error.code === 'cursor_ahead',
    );
  } finally {
    if (cursorThreadId) {
      await db.delete(coordinationThreads).where(eq(coordinationThreads.id, cursorThreadId));
    }
    await db.delete(coordinationActorFeedCursors)
      .where(inArray(coordinationActorFeedCursors.actor, [...actors]));
    if (originalCursors.length > 0) {
      await db.insert(coordinationActorFeedCursors).values(originalCursors);
    }
  }
});

databaseTest(
  'Alden reads the full coordination feed like Luca [HolaHola], but Daniela stays scoped to her own threads',
  async () => {
    const db = getSharedDb();
    const created = await createCoordinationThread({
      actor: 'luca-replit',
      intendedRecipient: 'luca-claude-code',
      title: `Full-feed steward visibility ${runId}`,
      description: 'Neither Alden nor Daniela is origin, recipient, or owner of this thread.',
      idempotencyKey: keys('full-feed-create'),
    });
    try {
      const aldenFeed = await listCoordinationFeed('alden', 0, 200);
      assert.ok(
        aldenFeed.items.some((item) => item.event.id === created.event.id),
        "Alden's full-feed read (steward of the code) must surface a thread he does not participate in",
      );

      const lucaHolaHolaFeed = await listCoordinationFeed('luca-holahola', 0, 200);
      assert.ok(
        lucaHolaHolaFeed.items.some((item) => item.event.id === created.event.id),
        'Luca [HolaHola] must retain his existing full-feed read access unchanged',
      );

      const danielaFeed = await listCoordinationFeed('daniela', 0, 200);
      assert.equal(
        danielaFeed.items.some((item) => item.event.id === created.event.id),
        false,
        'Daniela must stay scoped to threads where she is origin, recipient, or owner -- no full-feed access',
      );
    } finally {
      await db.delete(coordinationThreads).where(eq(coordinationThreads.id, created.thread.id));
    }
  },
);

databaseTest(
  'steward_comment lets Alden interject on a thread he does not participate in, without changing thread state',
  async () => {
    const db = getSharedDb();
    const created = await createCoordinationThread({
      actor: 'luca-replit',
      intendedRecipient: 'luca-claude-code',
      title: `Steward interjection ${runId}`,
      description: 'Alden is not origin, recipient, or owner of this thread.',
      idempotencyKey: keys('steward-comment-create'),
    });
    try {
      // A pure read (no eventType) must also succeed for Alden before he
      // interjects -- this is the same bypass path interject_on_coordination_thread
      // relies on to read context first.
      const read = await getCoordinationThread(created.thread.id, 'alden');
      assert.equal(read.thread.id, created.thread.id);

      const interjection = await appendCoordinationEvent({
        threadId: created.thread.id,
        actor: 'alden',
        eventType: 'steward_comment',
        recipientActor: 'luca-replit',
        content: 'Flagging a related thread for context.',
        idempotencyKey: keys('steward-comment-append'),
        expectedSequence: created.thread.latestSequence,
      });
      assert.equal(interjection.thread.state, 'created', 'steward_comment must never change thread state');
      assert.equal(interjection.thread.currentOwner, null);
      assert.equal(interjection.event.eventType, 'steward_comment');

      // Every OTHER Alden event type must remain exactly as participant-gated
      // as before -- the steward bypass is deliberately narrow.
      await assert.rejects(
        appendCoordinationEvent({
          threadId: created.thread.id,
          actor: 'alden',
          eventType: 'accepted',
          content: 'Alden attempting to accept work he was never assigned.',
          idempotencyKey: keys('steward-comment-alden-accept-blocked'),
          expectedSequence: interjection.thread.latestSequence,
        }),
        (error: unknown) => error instanceof CoordinationError && error.code === 'not_participant',
      );
    } finally {
      await db.delete(coordinationThreads).where(eq(coordinationThreads.id, created.thread.id));
    }
  },
);

databaseTest(
  'steward_comment is reserved for Alden -- every other actor is rejected, even as a genuine participant',
  async () => {
    const db = getSharedDb();
    const created = await createCoordinationThread({
      actor: 'luca-replit',
      intendedRecipient: 'luca-claude-code',
      title: `Steward comment actor restriction ${runId}`,
      description: 'luca-replit is the origin actor -- a genuine participant, not a bystander.',
      idempotencyKey: keys('steward-comment-restriction-create'),
    });
    try {
      // luca-replit is NOT in DIRECT_ACTOR_EVENT_PERMISSIONS at all, so
      // canCoordinationActorPerform alone would wave this through -- this proves
      // the dedicated steward_comment actor check catches it regardless.
      await assert.rejects(
        appendCoordinationEvent({
          threadId: created.thread.id,
          actor: 'luca-replit',
          eventType: 'steward_comment',
          content: 'A participant attempting to forge a steward comment on their own thread.',
          idempotencyKey: keys('steward-comment-luca-replit-blocked'),
          expectedSequence: created.thread.latestSequence,
        }),
        (error: unknown) => error instanceof CoordinationError && error.code === 'operation_not_allowed',
      );

      // luca-holahola and daniela ARE listed in DIRECT_ACTOR_EVENT_PERMISSIONS,
      // and steward_comment is deliberately absent from both of their sets.
      await assert.rejects(
        appendCoordinationEvent({
          threadId: created.thread.id,
          actor: 'luca-holahola',
          eventType: 'steward_comment',
          content: 'Luca [HolaHola] has full-feed read access but not the steward_comment write.',
          idempotencyKey: keys('steward-comment-luca-holahola-blocked'),
          expectedSequence: created.thread.latestSequence,
        }),
        (error: unknown) => error instanceof CoordinationError && error.code === 'operation_not_allowed',
      );
      await assert.rejects(
        appendCoordinationEvent({
          threadId: created.thread.id,
          actor: 'daniela',
          eventType: 'steward_comment',
          content: 'Daniela cannot emit a steward_comment either.',
          idempotencyKey: keys('steward-comment-daniela-blocked'),
          expectedSequence: created.thread.latestSequence,
        }),
        (error: unknown) => error instanceof CoordinationError && error.code === 'operation_not_allowed',
      );
    } finally {
      await db.delete(coordinationThreads).where(eq(coordinationThreads.id, created.thread.id));
    }
  },
);

databaseTest(
  'the coordination inbox recipient rules stay exhaustive and active with steward_comment added',
  async () => {
    // This is a narrow regression guard for the version-compatibility question
    // this feature raised: adding a brand-new event type to RECIPIENT_RULES is
    // purely additive (no historical event ever used it, so no stored inbox
    // row's meaning can retroactively change), and must NOT require bumping
    // COORDINATION_INBOX_RECIPIENT_RULE_VERSION or touching the activation row.
    const activation = await getCoordinationInboxActivation();
    if (!activation) return; // inbox activation is environment-provisioned; skip if absent here
    assert.equal(activation.recipientRuleVersion, 1, 'steward_comment must not have required a version bump');
    assert.equal(activation.state, 'active');
  },
);