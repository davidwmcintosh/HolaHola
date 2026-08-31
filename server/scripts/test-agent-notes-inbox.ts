import assert from 'node:assert/strict';
import { inArray, like } from 'drizzle-orm';
import { getSharedDb } from '../db';
import { agentNotes } from '@shared/schema';
import {
  createAgentNote,
  getAgentInboxSenders,
  getAgentNoteWithReplies,
  readAgentInboxNotes,
  updateAgentNoteAction,
} from '../services/agent-notes';

async function main() {
  const db = getSharedDb();
  const runId = `ci-agent-inbox-${Date.now()}`;
  const sourceKey = `${runId}:parent`;
  const createdIds: string[] = [];

  try {
    assert.deepEqual(
      getAgentInboxSenders(),
      ['alden', 'founder', 'luca-claude-code'],
      'the normal inbox must include Luca [Claude Code]',
    );

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

    const reply = await createAgentNote({
      fromAgent: 'agent',
      toAgent: 'luca-claude-code',
      subject: `Re: [CI] ${runId}`,
      body: 'Linked reply fixture.',
      repliedToId: first.note.id,
      sourceMessageKey: `${runId}:reply`,
    });
    createdIds.push(reply.note.id);
    assert.equal(reply.note.inReplyToId, first.note.id);

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