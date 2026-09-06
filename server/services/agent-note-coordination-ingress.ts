import { createHash } from 'node:crypto';
import { and, eq, or, sql } from 'drizzle-orm';
import {
  agentNotes,
  coordinationAdapterDeliveries,
  coordinationEvents,
  coordinationThreads,
  type CoordinationActorId,
  type CoordinationEventType,
} from '@shared/schema';
import { getSharedDb } from '../db';
import { replyToAgentNoteAndVerifyInTransaction, type ReplyToAgentNoteInput } from './agent-notes';
import {
  appendCoordinationEvent,
  CoordinationError,
  createCoordinationThread,
} from './coordination-ledger-service';

const ACTIONABLE_EVENTS = new Set<CoordinationEventType>([
  'accepted', 'progress', 'evidence_added', 'blocked', 'completed',
  'outcome_acknowledged', 'reopened', 'reassigned', 'comment',
]);

export function isActionableAgentNoteEventType(value: unknown): value is CoordinationEventType {
  return typeof value === 'string' && ACTIONABLE_EVENTS.has(value as CoordinationEventType);
}

export type NoteIngressResult = {
  disposition: 'notes_only' | 'imported';
  threadId?: string;
  eventId?: string;
  deduplicated?: boolean;
};

function actorForStoredSender(sender: string): CoordinationActorId | null {
  return sender === 'agent' ? 'luca-replit'
    : sender === 'luca-claude-code' ? 'luca-claude-code'
      : null;
}

function sourceReference(noteId: string) {
  return {
    type: 'agent_note' as const,
    provider: 'agent_notes',
    identifier: noteId,
  };
}

async function projectedThreadForParent(db: any, parent: typeof agentNotes.$inferSelect) {
  // A deterministic delivery source key is authoritative even before an
  // externalReference was recorded by an older delivery worker.
  const keyMatch = parent.sourceMessageKey?.match(/^coordination:([^:]+):agent_notes$/);
  const conditions = [
    eq(coordinationAdapterDeliveries.externalReference, parent.id),
    ...(keyMatch ? [eq(coordinationAdapterDeliveries.eventId, keyMatch[1])] : []),
  ];
  const rows = await db.select({ thread: coordinationThreads })
    .from(coordinationAdapterDeliveries)
    .innerJoin(coordinationEvents, eq(coordinationAdapterDeliveries.eventId, coordinationEvents.id))
    .innerJoin(coordinationThreads, eq(coordinationEvents.threadId, coordinationThreads.id))
    .where(or(...conditions))
    .orderBy(coordinationThreads.id);
  const threadIds = [...new Set(rows.map((row: { thread: { id: string } }) => row.thread.id))];
  if (threadIds.length > 1) {
    throw new CoordinationError('Conflicting exact coordination mappings for note', 409, 'conflicting_note_lineage');
  }
  return rows[0]?.thread ?? null;
}

async function sourceThreadForParent(db: any, parentId: string) {
  const rows = await db.select().from(coordinationThreads)
    .where(sql`${coordinationThreads.sourceReference}->>'type' = 'agent_note'
      AND ${coordinationThreads.sourceReference}->>'provider' = 'agent_notes'
      AND ${coordinationThreads.sourceReference}->>'identifier' = ${parentId}`)
    .orderBy(coordinationThreads.id);
  if (rows.length > 1) {
    throw new CoordinationError('Conflicting exact source-reference mappings for note', 409, 'conflicting_note_lineage');
  }
  return rows[0] ?? null;
}

async function resolveThreadForParent(db: any, parent: typeof agentNotes.$inferSelect) {
  const [projected, sourced] = await Promise.all([
    projectedThreadForParent(db, parent),
    sourceThreadForParent(db, parent.id),
  ]);
  if (projected && sourced && projected.id !== sourced.id) {
    throw new CoordinationError('Conflicting projected and source-reference coordination mappings for note', 409, 'conflicting_note_lineage');
  }
  return projected ?? sourced;
}

async function appendWithSequenceRetry(input: {
  threadId: string;
  actor: CoordinationActorId;
  eventType: CoordinationEventType;
  content: string;
  idempotencyKey: string;
  replyId: string;
  payload?: Record<string, unknown>;
  executor?: any;
}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const db = input.executor ?? getSharedDb();
    const [thread] = await db.select().from(coordinationThreads)
      .where(eq(coordinationThreads.id, input.threadId)).limit(1);
    if (!thread) throw new CoordinationError('Coordination thread not found', 404, 'thread_not_found');
    try {
      return await appendCoordinationEvent({
        ...input,
        expectedSequence: thread.latestSequence,
        evidence: [sourceReference(input.replyId)],
        payload: input.payload ?? { kind: 'agent_note_ingress', noteId: input.replyId },
      }, input.executor);
    } catch (error) {
      if (error instanceof CoordinationError && error.code === 'sequence_conflict' && attempt < 3) continue;
      throw error;
    }
  }
  throw new CoordinationError('Could not reserve coordination sequence for note ingress', 409, 'sequence_conflict');
}

/**
 * Imports only an explicitly requested lifecycle action.  No prose is
 * classified as an approval: callers must supply the coordination event type.
 */
export async function ingestActionableAgentNoteReply(input: {
  replyId: string;
  actor: CoordinationActorId;
  eventType?: CoordinationEventType;
}): Promise<NoteIngressResult> {
  if (!input.eventType) return { disposition: 'notes_only' };
  const db = getSharedDb();
  const [reply] = await db.select().from(agentNotes).where(eq(agentNotes.id, input.replyId)).limit(1);
  if (!reply || !reply.inReplyToId) return { disposition: 'notes_only' };
  const [parent] = await db.select().from(agentNotes).where(eq(agentNotes.id, reply.inReplyToId)).limit(1);
  if (!parent) throw new CoordinationError('Reply parent note not found', 404, 'parent_note_not_found');

  let thread = await resolveThreadForParent(db, parent);
  if (!thread && parent.sourceMessageKey?.startsWith('coordination:')) {
    // A coordination-marked note can never seed another thread if its exact
    // delivery record is unavailable; failing closed prevents delivery loops.
    return { disposition: 'notes_only' };
  }
  if (!thread) {
    const originActor = actorForStoredSender(parent.fromAgent);
    if (!originActor) return { disposition: 'notes_only' };
    const created = await createCoordinationThread({
      actor: originActor,
      intendedRecipient: input.actor,
      title: parent.subject,
      description: parent.body,
      content: parent.body,
      idempotencyKey: `agent-note-thread:${parent.id}`,
      sourceReference: sourceReference(parent.id),
    });
    thread = created.thread;
  }
  const appended = await appendWithSequenceRetry({
    threadId: thread.id,
    actor: input.actor,
    eventType: input.eventType,
    content: reply.body,
    idempotencyKey: `agent-note-ingress:${reply.id}`,
    replyId: reply.id,
  });
  return {
    disposition: 'imported',
    threadId: appended.thread.id,
    eventId: appended.event.id,
    deduplicated: appended.deduplicated,
  };
}

/** Atomic actionable path; informational replies intentionally use the legacy
 * notes-only writer. Any lifecycle failure rolls back the reply and thread. */
export async function replyAndIngestActionableAgentNote(
  input: ReplyToAgentNoteInput & { eventType: CoordinationEventType },
  retryAfterReplyRace = true,
) {
  if (!isActionableAgentNoteEventType(input.eventType)) {
    throw new CoordinationError('eventType is not actionable for note ingress', 400, 'invalid_event_type');
  }
  const db = getSharedDb();
  try {
    return await db.transaction(async (tx: any) => {
    const [parent] = await tx.select().from(agentNotes).where(eq(agentNotes.id, input.parentId)).limit(1);
    if (!parent) throw new CoordinationError('Parent note not found', 404, 'parent_note_not_found');
    let thread = await resolveThreadForParent(tx, parent);
    if (!thread && parent.sourceMessageKey?.startsWith('coordination:')) {
      throw new CoordinationError('Coordination-marked note has no exact delivery mapping', 409, 'unknown_note_lineage');
    }
    const reply = await replyToAgentNoteAndVerifyInTransaction(tx, input);
    if (!thread) {
      const originActor = actorForStoredSender(parent.fromAgent);
      if (!originActor) throw new CoordinationError('Parent cannot originate coordination work', 409, 'unknown_note_lineage');
      thread = (await createCoordinationThread({
        actor: originActor, intendedRecipient: input.actor, title: parent.subject,
        description: parent.body, content: parent.body,
        idempotencyKey: `agent-note-thread:${parent.id}`, sourceReference: sourceReference(parent.id),
      }, tx)).thread;
    }
    const appended = await appendWithSequenceRetry({
      threadId: thread.id, actor: input.actor, eventType: input.eventType,
      content: reply.note.body, idempotencyKey: `agent-note-ingress:${reply.note.id}`,
      replyId: reply.note.id, executor: tx,
    });
    return { reply, coordination: { disposition: 'imported' as const, threadId: appended.thread.id, eventId: appended.event.id, deduplicated: appended.deduplicated } };
    });
  } catch (error) {
    // The note source key is unique. If another transaction won that insert,
    // re-enter from the durable reply row so both callers converge on its
    // deterministic ingress event. Other failures must remain atomic failures.
    if (retryAfterReplyRace) {
      const [existing] = await db.select({ id: agentNotes.id }).from(agentNotes)
        .where(eq(agentNotes.sourceMessageKey, input.idempotencyKey)).limit(1);
      if (existing) return replyAndIngestActionableAgentNote(input, false);
    }
    throw error;
  }
}

const ALERT_BRIDGE_RECONCILIATIONS = {
  'replit-agent-alert-bridge-2026-09-05': {
    legacyNoteId: 'f09ca44b-20af-4037-9176-bb05a28234e2',
    legacyNoteFromAgent: 'luca-claude-code',
    legacyNoteCreatedAt: '2026-09-05T05:22:55.998Z',
    legacyNoteSourceMessageKey: null,
    legacyNoteBodySha256: 'a57afecd98f2026a71b396b57067c17f09180d1a05566bcae4f3fb0e5492d30b',
    legacyNoteSubjectSha256: '4d822d8731629a93d622870d86dc20b471c4769658cfe0df94dd8ae41690003d',
    coordinationThreadId: '3af017a3-82c3-42ff-9804-2925342fe197',
    coordinationThreadTitleSha256: '376675451e29b8bd752be607cbd70d5301e7fc0f2cf38f1af89dc5c5e154d2ae',
    coordinationThreadDescriptionSha256: 'bf84126971305c18df6ed712022716963f5c9ad4e57d257bd53c3cc0ff8d3db4',
    coordinationThreadSourceReferenceIdentifier:
      'docs/superpowers/specs/2026-09-04-replit-agent-coordination-alert-bridge-design.md@c78d332',
    coordinationThreadSourceReferenceSha256:
      '28d422cecfdacb378ebd5207ed39bf102fd69f3effba24a2e3dd41f697c56c86',
  },
} as const;

export type AlertBridgeReconciliationKey = keyof typeof ALERT_BRIDGE_RECONCILIATIONS;

export async function reconcileAlertBridgeApproval(reconciliationKey: string) {
  const mapping = ALERT_BRIDGE_RECONCILIATIONS[reconciliationKey as AlertBridgeReconciliationKey];
  if (!mapping) {
    throw new CoordinationError('Reconciliation key is not repository-authorized', 403, 'reconciliation_not_allowed');
  }
  const db = getSharedDb();
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  return db.transaction(async (tx: any) => {
    const [note] = await tx.select().from(agentNotes).where(eq(agentNotes.id, mapping.legacyNoteId)).limit(1);
    const [thread] = await tx.select().from(coordinationThreads).where(eq(coordinationThreads.id, mapping.coordinationThreadId)).limit(1);
    if (!note || !thread) throw new CoordinationError('Exact reconciliation source was not found', 404, 'reconciliation_source_not_found');
    if (note.sourceMessageKey !== mapping.legacyNoteSourceMessageKey
      || note.fromAgent !== mapping.legacyNoteFromAgent
      || note.createdAt.toISOString() !== mapping.legacyNoteCreatedAt
      || hash(note.body) !== mapping.legacyNoteBodySha256
      || hash(note.subject) !== mapping.legacyNoteSubjectSha256
      || hash(thread.title) !== mapping.coordinationThreadTitleSha256
      || hash(thread.description) !== mapping.coordinationThreadDescriptionSha256) {
      throw new CoordinationError('Reconciliation manifest does not match immutable source records', 409, 'reconciliation_manifest_mismatch');
    }
    if (thread.sourceReference?.identifier !== mapping.coordinationThreadSourceReferenceIdentifier
      || hash(JSON.stringify(thread.sourceReference ?? null)) !== mapping.coordinationThreadSourceReferenceSha256) {
      throw new CoordinationError('Reconciliation manifest does not match thread association', 409, 'reconciliation_manifest_mismatch');
    }
    const idempotencyKey = `alert-bridge-import:${reconciliationKey}`;
    const [existing] = await tx.select().from(coordinationEvents).where(and(
      eq(coordinationEvents.actor, 'coordination-system'), eq(coordinationEvents.idempotencyKey, idempotencyKey),
    )).limit(1);
    if (existing) return { canonicalThreadId: thread.id, importedEventId: existing.id, deduplicated: true, sourceNoteId: note.id, sourceNoteCreatedAt: note.createdAt, conditionComparison: { legacyNoteCondition: note.body, coordinationCondition: thread.description, exactTextMatch: note.body === thread.description } };
    const next = thread.latestSequence + 1;
    const [reserved] = await tx.update(coordinationThreads).set({ latestSequence: next, updatedAt: new Date() })
      .where(and(eq(coordinationThreads.id, thread.id), eq(coordinationThreads.latestSequence, thread.latestSequence))).returning();
    if (!reserved) throw new CoordinationError('Thread sequence changed', 409, 'sequence_conflict');
    const [event] = await tx.insert(coordinationEvents).values({
      threadId: thread.id, sequence: next, actor: 'coordination-system', eventType: 'comment', content: note.body,
      idempotencyKey, evidence: [sourceReference(note.id)],
      payload: { kind: 'historical_agent_note_import', sourceNoteId: note.id, sourceNoteCreatedAt: note.createdAt.toISOString() },
    }).returning();
    const [updated] = await tx.update(coordinationThreads).set({ latestGlobalSequence: event.globalSequence, updatedAt: new Date() }).where(eq(coordinationThreads.id, thread.id)).returning();
    return { canonicalThreadId: updated.id, importedEventId: event.id, deduplicated: false, sourceNoteId: note.id, sourceNoteCreatedAt: note.createdAt, conditionComparison: { legacyNoteCondition: note.body, coordinationCondition: thread.description, exactTextMatch: note.body === thread.description } };
  });
}