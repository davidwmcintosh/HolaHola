import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { eq, inArray, like, sql } from 'drizzle-orm';
import {
  agentNotes, coordinationAdapterDeliveries, coordinationEvents, coordinationThreads,
} from '@shared/schema';
import { getVerifiedCiDatabaseUrl } from '../ci-database';
import { closeDbConnections, getSharedDb } from '../db';
import { ingestActionableAgentNoteReply, reconcileAlertBridgeApproval, replyAndIngestActionableAgentNote } from '../services/agent-note-coordination-ingress';
import { appendCoordinationEvent, createCoordinationThread } from '../services/coordination-ledger-service';

const run = `note-ingress:${randomUUID()}`;
const databaseTest = getVerifiedCiDatabaseUrl() ? test : test.skip;
const threadIds: string[] = [];

async function note(values: Partial<typeof agentNotes.$inferInsert> & Pick<typeof agentNotes.$inferInsert, 'fromAgent' | 'toAgent' | 'subject' | 'body'>) {
  const [row] = await getSharedDb().insert(agentNotes).values({
    ...values, sourceMessageKey: values.sourceMessageKey ?? `${run}:${randomUUID()}`,
  }).returning();
  return row;
}

after(async () => {
  if (!getVerifiedCiDatabaseUrl()) return;
  const db = getSharedDb();
  if (threadIds.length) await db.delete(coordinationThreads).where(inArray(coordinationThreads.id, threadIds));
  await db.delete(agentNotes).where(like(agentNotes.sourceMessageKey, `${run}%`));
  await closeDbConnections();
});

databaseTest('projected-note replies use the exact originating coordination thread', async () => {
  const created = await createCoordinationThread({
    actor: 'luca-claude-code', intendedRecipient: 'luca-replit',
    title: 'Tracked approval', description: 'Tracked approval decision',
    idempotencyKey: `${run}:projected-thread`,
  });
  threadIds.push(created.thread.id);
  const [delivery] = await getSharedDb().select().from(coordinationAdapterDeliveries)
    .where(eq(coordinationAdapterDeliveries.eventId, created.event.id));
  const parent = await note({
    fromAgent: 'luca-claude-code', toAgent: 'agent', subject: 'Tracked approval', body: 'Approve it.',
    sourceMessageKey: `coordination:${created.event.id}:agent_notes`,
  });
  await getSharedDb().update(coordinationAdapterDeliveries).set({
    externalReference: parent.id, status: 'delivered', deliveredAt: new Date(),
  }).where(eq(coordinationAdapterDeliveries.id, delivery.id));
  const reply = await note({
    fromAgent: 'agent', toAgent: 'luca-claude-code', subject: 'Re: Tracked approval',
    body: 'Accepted.', inReplyToId: parent.id,
  });
  const result = await ingestActionableAgentNoteReply({
    replyId: reply.id, actor: 'luca-replit', eventType: 'accepted',
  });
  const adversarialRetry = await ingestActionableAgentNoteReply({
    replyId: reply.id, actor: 'luca-replit', eventType: 'accepted',
  });
  assert.equal(result.threadId, created.thread.id);
  assert.equal(adversarialRetry.threadId, created.thread.id);
  assert.equal(adversarialRetry.deduplicated, true);
  assert.equal((await getSharedDb().select().from(coordinationThreads)
    .where(eq(coordinationThreads.id, created.thread.id)))[0].latestSequence, 2);
});

databaseTest('legacy actionable reply creates one source-linked thread and retries converge', async () => {
  const parent = await note({
    fromAgent: 'luca-claude-code', toAgent: 'agent', subject: 'Legacy tracked request', body: 'Please approve.',
  });
  const reply = await note({
    fromAgent: 'agent', toAgent: 'luca-claude-code', subject: 'Re: Legacy tracked request',
    body: 'Approved.', inReplyToId: parent.id,
  });
  const results = await Promise.all([1, 2].map(() => ingestActionableAgentNoteReply({
    replyId: reply.id, actor: 'luca-replit', eventType: 'accepted',
  })));
  assert.equal(results[0].threadId, results[1].threadId);
  threadIds.push(results[0].threadId!);
  const events = await getSharedDb().select().from(coordinationEvents)
    .where(eq(coordinationEvents.threadId, results[0].threadId!));
  assert.equal(events.filter((event) => event.idempotencyKey === `agent-note-ingress:${reply.id}`).length, 1);
});

databaseTest('informational and unresolvable coordination-marked replies remain notes-only', async () => {
  const ordinary = await note({ fromAgent: 'luca-claude-code', toAgent: 'agent', subject: 'FYI', body: 'Informational.' });
  const ordinaryReply = await note({ fromAgent: 'agent', toAgent: 'luca-claude-code', subject: 'Re: FYI', body: 'Thanks.', inReplyToId: ordinary.id });
  assert.equal((await ingestActionableAgentNoteReply({
    replyId: ordinaryReply.id, actor: 'luca-replit',
  })).disposition, 'notes_only');
  const projected = await note({
    fromAgent: 'luca-claude-code', toAgent: 'agent', subject: 'Projection', body: 'Delivery.',
    sourceMessageKey: 'coordination:missing-event:agent_notes',
  });
  const projectedReply = await note({ fromAgent: 'agent', toAgent: 'luca-claude-code', subject: 'Re: Projection', body: 'No loop.', inReplyToId: projected.id });
  assert.equal((await ingestActionableAgentNoteReply({
    replyId: projectedReply.id, actor: 'luca-replit', eventType: 'comment',
  })).disposition, 'notes_only');
});

databaseTest('conflicting exact mappings fail closed and generic callers cannot forge imports', async () => {
  const parent = await note({ fromAgent: 'luca-claude-code', toAgent: 'agent', subject: 'Conflict', body: 'Tracked.' });
  const one = await createCoordinationThread({ actor: 'luca-claude-code', intendedRecipient: 'luca-replit', title: 'One', description: 'One', idempotencyKey: `${run}:one` });
  const two = await createCoordinationThread({ actor: 'luca-claude-code', intendedRecipient: 'luca-replit', title: 'Two', description: 'Two', idempotencyKey: `${run}:two` });
  threadIds.push(one.thread.id, two.thread.id);
  const deliveries = await getSharedDb().select().from(coordinationAdapterDeliveries)
    .where(inArray(coordinationAdapterDeliveries.eventId, [one.event.id, two.event.id]));
  for (const delivery of deliveries) await getSharedDb().update(coordinationAdapterDeliveries)
    .set({ externalReference: parent.id }).where(eq(coordinationAdapterDeliveries.id, delivery.id));
  const reply = await note({ fromAgent: 'agent', toAgent: 'luca-claude-code', subject: 'Re: Conflict', body: 'Accepted', inReplyToId: parent.id });
  await assert.rejects(ingestActionableAgentNoteReply({ replyId: reply.id, actor: 'luca-replit', eventType: 'accepted' }), { code: 'conflicting_note_lineage' });
  await assert.rejects(appendCoordinationEvent({
    threadId: one.thread.id, actor: 'coordination-system', eventType: 'comment', content: 'forged',
    idempotencyKey: `${run}:forged`, expectedSequence: 1, payload: { kind: 'historical_agent_note_import' },
  }), { code: 'not_participant' });
});

databaseTest('conflicting exact source-reference mappings fail closed', async () => {
  const parent = await note({ fromAgent: 'luca-claude-code', toAgent: 'agent', subject: 'Source conflict', body: 'Tracked.' });
  const rows = await getSharedDb().insert(coordinationThreads).values([{
    title: 'Source one', description: 'one', originActor: 'luca-claude-code', intendedRecipient: 'luca-replit',
    sourceReference: { type: 'agent_note', provider: 'agent_notes', identifier: parent.id },
  }, {
    title: 'Source two', description: 'two', originActor: 'luca-claude-code', intendedRecipient: 'luca-replit',
    sourceReference: { type: 'agent_note', provider: 'agent_notes', identifier: parent.id },
  }]).returning();
  threadIds.push(...rows.map((row) => row.id));
  const reply = await note({ fromAgent: 'agent', toAgent: 'luca-claude-code', subject: 'Re: Source conflict', body: 'Accepted', inReplyToId: parent.id });
  await assert.rejects(ingestActionableAgentNoteReply({
    replyId: reply.id, actor: 'luca-replit', eventType: 'accepted',
  }), { code: 'conflicting_note_lineage' });
});

databaseTest('actionable transaction rolls back reply and legacy thread on invalid lifecycle', async () => {
  const parent = await note({ fromAgent: 'luca-claude-code', toAgent: 'agent', subject: 'Atomic request', body: 'Tracked request.' });
  const key = `${run}:atomic-invalid`;
  await assert.rejects(replyAndIngestActionableAgentNote({
    actor: 'luca-replit', parentId: parent.id, body: 'Cannot acknowledge from created.', idempotencyKey: key,
    eventType: 'outcome_acknowledged',
  }));
  assert.equal((await getSharedDb().select().from(agentNotes).where(eq(agentNotes.sourceMessageKey, key))).length, 0);
  const candidates = await getSharedDb().select().from(coordinationThreads)
    .where(sql`${coordinationThreads.sourceReference}->>'identifier' = ${parent.id}`);
  assert.equal(candidates.length, 0);
});

databaseTest('correctly hashed unrelated records cannot define a reconciliation mapping', async () => {
  const unrelated = await note({
    fromAgent: 'luca-claude-code', toAgent: 'agent', subject: 'Unrelated approval', body: 'Condition B',
  });
  const unrelatedThread = await createCoordinationThread({
    actor: 'luca-claude-code', intendedRecipient: 'luca-replit',
    title: 'Unrelated approval', description: 'Condition A', idempotencyKey: `${run}:unrelated`,
  });
  threadIds.push(unrelatedThread.thread.id);
  await assert.rejects(
    reconcileAlertBridgeApproval(`${unrelated.id}:${unrelatedThread.thread.id}`),
    { code: 'reconciliation_not_allowed' },
  );
  const events = await getSharedDb().select().from(coordinationEvents)
    .where(eq(coordinationEvents.threadId, unrelatedThread.thread.id));
  assert.equal(events.length, 1);
});