import assert from 'node:assert/strict';
import { inArray, like } from 'drizzle-orm';
import { getSharedDb } from '../db';
import { agentNotes } from '@shared/schema';
import {
  AgentNoteReplyError,
  createAgentNote,
  getAgentInboxSenders,
  getAgentNoteWithReplies,
  readAgentInboxNotes,
  replyToAgentNoteAndVerify,
  updateAgentNoteAction,
} from '../services/agent-notes';
import { getVerifiedCiDatabaseUrl } from '../ci-database';

async function main() {
  assert.deepEqual(
    getAgentInboxSenders(),
    ['alden', 'founder', 'luca-claude-code'],
    'the normal inbox must include Luca [Claude Code]',
  );
  if (!getVerifiedCiDatabaseUrl()) {
    console.log('↷ agent inbox persistence regression skipped: verified disposable CI database is required');
    return;
  }

  const db = getSharedDb();
  const runId = `ci-agent-inbox-${Date.now()}`;
  const sourceKey = `${runId}:parent`;
  const createdIds: string[] = [];

  try {
    const first = await createAgentNote({
      fromAgent: 'luca-claude-code',
      toAgent: 'agent',
      subject: `[CI] ${runId}`,
      body: 'Inbox visibility and lifecycle regression fixture.',
      sourceMessageKey: sourceKey,
    });
    createdIds.push(first.note.id);
    assert.equal(first.deduplicated, false);
    assert.equal(first.note.status, 'unread');

    const retry = await createAgentNote({
      fromAgent: 'luca-claude-code',
      toAgent: 'agent',
      subject: `[CI] ${runId} retry`,
      body: 'This retry must resolve to the original note.',
      sourceMessageKey: sourceKey,
    });
    assert.equal(retry.deduplicated, true);
    assert.equal(retry.note.id, first.note.id);

    const unread = await readAgentInboxNotes({
      fromAgent: 'luca-claude-code',
      includeRead: false,
      limit: 100,
    });
    assert.ok(unread.some(note => note.id === first.note.id), 'Claude Code note was absent from live inbox');

    const reply = await replyToAgentNoteAndVerify({
      actor: 'luca-replit',
      parentId: first.note.id,
      subject: `Re: [CI] ${runId}`,
      body: 'Linked reply fixture.',
      idempotencyKey: `${runId}:reply`,
    });
    createdIds.push(reply.note.id);
    assert.equal(reply.deliveryState, 'delivered');
    assert.equal(reply.deduplicated, false);
    assert.equal(reply.note.fromAgent, 'agent');
    assert.equal(reply.note.toAgent, 'luca-claude-code');
    assert.equal(reply.note.inReplyToId, first.note.id);
    assert.equal(reply.note.status, 'unread', 'delivery must not imply seen or acknowledged');

    const unchangedParent = await getAgentNoteWithReplies(first.note.id);
    assert.equal(unchangedParent?.note.status, 'unread', 'reply delivery must not act on the parent');

    const replyRetry = await replyToAgentNoteAndVerify({
      actor: 'luca-replit',
      parentId: first.note.id,
      subject: `Re: [CI] ${runId}`,
      body: 'Linked reply fixture.',
      idempotencyKey: `${runId}:reply`,
    });
    assert.equal(replyRetry.deduplicated, true);
    assert.equal(replyRetry.note.id, reply.note.id);

    await assert.rejects(
      replyToAgentNoteAndVerify({
        actor: 'luca-replit',
        parentId: first.note.id,
        subject: `Re: [CI] ${runId}`,
        body: 'Conflicting retry body.',
        idempotencyKey: `${runId}:reply`,
      }),
      (error: unknown) => (
        error instanceof AgentNoteReplyError
        && error.code === 'idempotency_conflict'
      ),
    );
    await assert.rejects(
      replyToAgentNoteAndVerify({
        actor: 'luca-claude-code',
        parentId: first.note.id,
        body: 'Wrong inbox.',
        idempotencyKey: `${runId}:wrong-inbox`,
      }),
      (error: unknown) => (
        error instanceof AgentNoteReplyError
        && error.code === 'parent_inbox_forbidden'
      ),
    );

    const acknowledged = await updateAgentNoteAction(first.note.id, 'acknowledge');
    assert.equal(acknowledged?.status, 'acknowledged');
    assert.ok(acknowledged?.acknowledgedAt);
    assert.ok(acknowledged?.readAt);

    const afterAcknowledgement = await readAgentInboxNotes({
      fromAgent: 'luca-claude-code',
      includeRead: false,
      limit: 100,
    });
    assert.ok(
      !afterAcknowledgement.some(note => note.id === first.note.id),
      'acknowledged note remained in unread inbox',
    );

    const claudeParent = await createAgentNote({
      fromAgent: 'agent',
      toAgent: 'luca-claude-code',
      subject: `[CI] ${runId} assigned by Replit`,
      body: 'Reciprocal actor route fixture.',
      sourceMessageKey: `${runId}:claude-parent`,
    });
    createdIds.push(claudeParent.note.id);
    const claudeReply = await replyToAgentNoteAndVerify({
      actor: 'luca-claude-code',
      parentId: claudeParent.note.id,
      body: 'Claude Code linked outcome.',
      idempotencyKey: `${runId}:claude-reply`,
    });
    createdIds.push(claudeReply.note.id);
    assert.equal(claudeReply.deliveryState, 'delivered');
    assert.equal(claudeReply.note.fromAgent, 'luca-claude-code');
    assert.equal(claudeReply.note.toAgent, 'agent');
    assert.equal(claudeReply.note.status, 'unread');

    const actedOn = await updateAgentNoteAction(first.note.id, 'act');
    assert.equal(actedOn?.status, 'acted_on');
    assert.ok(actedOn?.actedOnAt);

    const thread = await getAgentNoteWithReplies(first.note.id);
    assert.ok(thread, 'linked note thread was not found');
    assert.equal(thread?.replies.length, 1);
    assert.equal(thread?.replies[0]?.id, reply.note.id);

    const dismissible = await createAgentNote({
      fromAgent: 'luca-claude-code',
      toAgent: 'agent',
      subject: `[CI] ${runId} dismiss`,
      body: 'Dismissal lifecycle fixture.',
      sourceMessageKey: `${runId}:dismiss`,
    });
    createdIds.push(dismissible.note.id);

    const dismissed = await updateAgentNoteAction(dismissible.note.id, 'dismiss');
    assert.equal(dismissed?.status, 'dismissed');
    assert.ok(dismissed?.dismissedAt);

    const readCompatibility = await createAgentNote({
      fromAgent: 'luca-claude-code',
      toAgent: 'agent',
      subject: `[CI] ${runId} read compatibility`,
      body: 'Legacy mark-read compatibility fixture.',
      sourceMessageKey: `${runId}:read`,
    });
    createdIds.push(readCompatibility.note.id);

    const read = await updateAgentNoteAction(readCompatibility.note.id, 'read');
    assert.equal(read?.status, 'acknowledged');
    assert.ok(read?.readAt);

    console.log('✓ agent inbox visibility and lifecycle regression passed');
  } finally {
    if (createdIds.length > 0) {
      await db.delete(agentNotes).where(inArray(agentNotes.id, createdIds));
    }
    await db.delete(agentNotes).where(like(agentNotes.sourceMessageKey, `${runId}%`));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });